import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import http from 'node:http';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import Database from 'better-sqlite3';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';

const dir=await mkdtemp(join(tmpdir(),'home-panel-test-'));
const entity={entity_id:'switch.test_living',state:'on',attributes:{friendly_name:'Test light'},last_updated:new Date().toISOString()};
let deny=false,hold=false,calls=0;
let imageCalls=0;
const extras=[
 {entity_id:'camera.private',state:'idle',attributes:{access_token:'NOT_FOR_CLIENT'}},
 {entity_id:'cover.qa_gate',state:'closed',attributes:{current_position:0}},
 {entity_id:'climate.qa_boiler',state:'heat',attributes:{current_temperature:42,temperature:50}},
 {entity_id:'switch.qa_pump',state:'off',attributes:{}},
 {entity_id:'switch.qa_corridor',state:'off',attributes:{}},
 {entity_id:'binary_sensor.offline_door',state:'unavailable',attributes:{device_class:'door'}}
];
const fake=http.createServer(async(req,res)=>{
 if(req.headers.authorization!=='Bearer mock-test-only'){res.writeHead(401);return res.end('{}')}
 if(deny){res.writeHead(401);return res.end('{}')}
 res.setHeader('Content-Type','application/json');
 if(req.url==='/api/states')return res.end(JSON.stringify([entity,...extras]));
 if(req.url==='/api/camera_proxy/camera.private'){imageCalls++;res.setHeader('Content-Type','image/webp');return res.end(await readFile('assets/interior.webp'))}
 if(req.url==='/api/states/switch.test_living')return res.end(JSON.stringify(entity));
 if(req.url.startsWith('/api/services/')){
  calls++;if(!hold)entity.state=req.url.endsWith('turn_off')?'off':'on';
  return res.end('[]');
 }
 res.writeHead(404);res.end('{}');
});
await new Promise(r=>fake.listen(3022,'127.0.0.1',r));
let child;
async function launch(preview=false){
 child=spawn(process.execPath,['release/server.mjs'],{cwd:resolve('.'),env:{...process.env,PORT:'3021',PANEL_DATA:dir,HA_URL:'http://127.0.0.1:3022',HA_TOKEN:'mock-test-only',PANEL_PREVIEW:preview?'1':'0'},stdio:['ignore','pipe','pipe']});
 await new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>reject(new Error('Server startup timeout')),10000);
  child.stdout.on('data',b=>{if(String(b).includes('Panel ready')){clearTimeout(timer);resolve()}});
  child.once('exit',()=>{clearTimeout(timer);reject(new Error('Server exited'))});
 });
}
async function stop(){if(child&&!child.killed&&child.exitCode===null){const end=new Promise(r=>child.once('exit',r));child.kill('SIGTERM');await end}}
let proof;
async function call(path,{method='GET',data,header={}}={}){
 const r=await fetch('http://127.0.0.1:3021/api/panel/'+path,{method,headers:{'Content-Type':'application/json',...(method==='GET'?{}:{'X-Panel-Proof':proof}),...header},...(data===undefined?{}:{body:JSON.stringify(data)})});
 return {status:r.status,body:await r.json()};
}
try{
 await launch();
 let b=await call('bootstrap');assert.equal(b.status,200);proof=b.body.proof;let p=b.body.preferences;
 assert.equal(p.mode,'demo');assert.equal(Object.values(p.bindings).some(b=>b.verified),false);
 assert.equal(p.version,3);assert.equal(b.body.photo,false);
 assert.equal(p.housePresetVersion,5);
 assert.equal(p.bindings['hall:1'].entityId,'light.prikhozhaia_pravyi_vykliuchatel');
 assert.ok(p.devices.some(d=>d.id==='leak:bath'&&d.status==='installed'));
 assert.equal(p.devices.some(d=>d.id==='pump'),false);
 assert.equal((await call('preferences',{method:'PUT',data:{...p,version:2}})).status,400);
 assert.equal((await call('preferences',{method:'PUT',data:p,header:{'X-Panel-Proof':''}})).status,400);
 assert.equal((await call('preferences',{method:'PUT',data:p,header:{Origin:'http://malicious.example'}})).status,400);
 assert.equal((await fetch('http://127.0.0.1:3021/.env')).status,404);
 assert.equal((await fetch('http://127.0.0.1:3021/data/panel.sqlite')).status,404);
 assert.equal((await fetch('http://127.0.0.1:3021/assets/manrope-400.ttf')).status,200);
 p.theme='light';p.kiosk=true;p.favorites=['hall','living'];p.devices.find(d=>d.id==='living:0').name='Диван';
 assert.equal((await call('preferences',{method:'PUT',data:p})).status,200);
 await stop();await launch();
 const stale=await call('ha/command',{method:'POST',data:{id:'living:0',value:false}});
 assert.equal(stale.body.code,'PANEL_PROOF_REQUIRED');assert.equal(calls,0,'Stale proof is rejected before any physical action');
 const session=await call('session');assert.deepEqual(Object.keys(session.body),['proof']);
 assert.notEqual(session.body.proof,proof);
 b=await call('bootstrap');proof=b.body.proof;p=b.body.preferences;
 assert.equal(proof,session.body.proof,'Refreshing a session never rotates another tab’s valid proof');
 assert.equal(p.theme,'light');assert.equal(p.kiosk,true);assert.deepEqual(p.favorites,['hall','living']);
 assert.equal(p.devices.find(d=>d.id==='living:0').name,'Диван');
 assert.equal((await call('ha/command',{method:'POST',data:{id:'living:0',value:false}})).status,400);
 p.mode='live';p.bindings['living:0']={entityId:'switch.test_living',verified:true};
 assert.equal((await call('preferences',{method:'PUT',data:p})).status,200);
 const list=await call('ha/states');assert.equal(list.body.states.length,7);assert.equal(JSON.stringify(list).includes('NOT_FOR_CLIENT'),false);
 const off=await call('ha/command',{method:'POST',data:{id:'living:0',value:false}});assert.equal(off.status,200);assert.equal(entity.state,'off');assert.equal(calls,1);
 assert.equal((await call('ha/command',{method:'POST',data:{id:'living:0',value:false}})).status,200);assert.equal(calls,1);
 assert.equal((await call('ha/command',{method:'POST',data:{id:'pump',value:true}})).status,400);
 assert.equal((await call('ha/command',{method:'POST',data:{id:'bath:1',value:true}})).status,400);
 assert.equal((await call('ha/command',{method:'POST',data:{id:'station:playing',value:true}})).status,400);
 assert.equal((await call('ha/command',{method:'POST',data:{id:'living:0',value:'on'}})).status,400);
 p.bindings['living:1']={entityId:'switch.test_living',verified:true};
 assert.equal((await call('preferences',{method:'PUT',data:p})).status,400);p.bindings['living:1']={entityId:'',verified:false};
 // One bad binding never discards the rest of the form: entity_id is kept, the mark is not.
 p.bindings['door']={entityId:'binary_sensor.missing',verified:true};
 let partialSave=await call('preferences',{method:'PUT',data:p});
 assert.equal(partialSave.status,200);
 assert.deepEqual(partialSave.body.preferences.bindings.door,{entityId:'binary_sensor.missing',verified:false});
 assert.equal(partialSave.body.rejected[0].id,'door');
 assert.equal(partialSave.body.preferences.bindings['living:0'].verified,true,'Other verified bindings survive');
 // Owner-verified but temporarily offline entity keeps its mark and stays non-controllable.
 p=partialSave.body.preferences;p.bindings['door']={entityId:'binary_sensor.offline_door',verified:true};
 partialSave=await call('preferences',{method:'PUT',data:p});
 assert.equal(partialSave.status,200);assert.equal(partialSave.body.preferences.bindings.door.verified,true);
 assert.equal(partialSave.body.offline[0].id,'door');assert.equal(partialSave.body.rejected.length,0);
 p=partialSave.body.preferences;p.bindings.door={entityId:'',verified:false};
 assert.equal((await call('preferences',{method:'PUT',data:p})).status,200);
 deny=true;const bad=await call('ha/states');assert.equal(bad.status,400);assert.match(bad.body.error,/авторизацию/);deny=false;
 hold=true;const timeout=await call('ha/command',{method:'POST',data:{id:'living:0',value:true}});assert.equal(timeout.status,400);assert.match(timeout.body.error,/могла выполниться/);assert.equal(entity.state,'off');hold=false;
 // Reorder and rename preserve stable mappings; moving resets verification.
 p.devices.reverse();p.devices.find(d=>d.id==='living:0').name='Переименованная линия';
 let saved=await call('preferences',{method:'PUT',data:p});assert.equal(saved.status,200);p=saved.body.preferences;
 assert.equal(p.bindings['living:0'].verified,true);
 p.devices.find(d=>d.id==='living:0').room='office';
 saved=await call('preferences',{method:'PUT',data:p});p=saved.body.preferences;assert.equal(p.bindings['living:0'].verified,false);
 assert.equal((await call('ha/command',{method:'POST',data:{id:'living:0',value:true}})).status,400);
 // All engineering states may be read, never actuated, even with verified bindings.
 p.devices.push({id:'pump',type:'pump',room:'utility',name:'Тестовый насос',status:'installed',masterOff:false,note:''});
 p.bindings.pump={entityId:'',verified:false};
 p.devices.find(d=>d.id==='sliding-gate').status='installed';
 saved=await call('preferences',{method:'PUT',data:p});p=saved.body.preferences;
 for(const [id,entityId] of [['sliding-gate','cover.qa_gate'],['boiler','climate.qa_boiler'],['pump','switch.qa_pump'],['camera-yard','camera.private']])p.bindings[id]={entityId,verified:true};
 saved=await call('preferences',{method:'PUT',data:p});assert.equal(saved.status,200);p=saved.body.preferences;
 const beforeSafety=calls;
 for(const id of ['sliding-gate','sliding-gate/open','boiler','pump','camera-yard'])assert.equal((await call('ha/command',{method:'POST',data:{id,value:true}})).status,400);
 assert.equal(calls,beforeSafety);
 assert.equal(imageCalls,0);
 const photo=await fetch('http://127.0.0.1:3021/api/panel/ha/camera',{method:'POST',headers:{'Content-Type':'application/json','X-Panel-Proof':proof},body:JSON.stringify({id:'camera-yard'})});
 assert.equal(photo.status,200);assert.equal(photo.headers.get('content-type'),'image/webp');assert.ok((await photo.arrayBuffer()).byteLength>100);assert.equal(imageCalls,1);
 assert.equal((await call('ha/camera',{method:'POST',data:{id:'camera-extra-1'}})).status,400);
 assert.equal((await call('ha/camera',{method:'POST',data:{id:'http://malicious.example'}})).status,400);
 // Clean installation creates only its own schema, never a migration table.
 await stop();
 const sql=new Database(join(dir,'panel.sqlite'));
 assert.equal(sql.prepare("SELECT name FROM sqlite_master WHERE type='table' AND name='migrations'").get(),undefined);
 const unsupported=JSON.stringify({...p,version:99});
 sql.prepare('UPDATE profiles SET preferences=? WHERE id=?').run(unsupported,'local');sql.close();
 await launch();assert.equal((await call('bootstrap')).status,400);await stop();
 const unchanged=new Database(join(dir,'panel.sqlite'));
 assert.equal(unchanged.prepare('SELECT preferences FROM profiles WHERE id=?').get('local').preferences,unsupported);unchanged.close();
 await launch(true);
 const a=await call('bootstrap',{header:{'X-Visitor-Id':'qa-visitor-a'}}),b2=await call('bootstrap',{header:{'X-Visitor-Id':'qa-visitor-b'}});
 assert.equal(a.body.preview,true);assert.equal(a.body.haConfigured,false);assert.notEqual(a.body.proof,b2.body.proof);
 assert.equal((await call('preferences',{method:'PUT',data:a.body.preferences,header:{'X-Visitor-Id':'qa-visitor-b','X-Panel-Proof':a.body.proof}})).status,400);
 a.body.preferences.theme='light';proof=a.body.proof;
 assert.equal((await call('preferences',{method:'PUT',data:a.body.preferences,header:{'X-Visitor-Id':'qa-visitor-a'}})).status,200);
 assert.equal((await call('bootstrap',{header:{'X-Visitor-Id':'qa-visitor-b'}})).body.preferences.theme,'dark');
 assert.equal((await call('photo',{method:'PUT',data:{},header:{'X-Visitor-Id':'qa-visitor-a'}})).status,400);
 assert.equal((await call('ha/states',{header:{'X-Visitor-Id':'qa-visitor-a'}})).status,400);
 console.log('PASS: clean v3 initialization, no migration schema, old formats rejected, persistence, CSRF, verified mappings, stable reorder, move resets verification, HA command/readback, locked engineering, camera images, secret filtering, unknown format leaves database unchanged, preview isolation.');
}finally{await stop();await new Promise(r=>fake.close(r));await rm(dir,{recursive:true,force:true})}
