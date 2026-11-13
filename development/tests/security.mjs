import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import http from 'node:http';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';

// 3.7.0: пилотная охрана — arm/disarm, preflight, тревога по двери, цикл сирены
// (интент + свет), остановка при снятии. PANEL_GUARD_SCALE=0.02 сжимает тайминги.
const dir=await mkdtemp(join(tmpdir(),'home-panel-security-'));
const seen=[];let doorState='off';
const door={entity_id:'binary_sensor.test_door',state:'off',attributes:{friendly_name:'Тест дверь',device_class:'door'},last_updated:new Date().toISOString()};
const light={entity_id:'light.test',state:'off',attributes:{friendly_name:'Тест свет',brightness:128},last_updated:new Date().toISOString()};
const mp={entity_id:'media_player.test',state:'idle',attributes:{friendly_name:'Тест станция',volume_level:0.5,supported_features:65535},last_updated:new Date().toISOString()};
const fake=http.createServer((req,res)=>{
 res.setHeader('Content-Type','application/json');
 seen.push(req.url);
 if(req.headers.authorization!=='Bearer mock-test-only'){res.writeHead(401);return res.end('{}')}
 if(req.url==='/api/states')return res.end(JSON.stringify([door,light,mp].map(e=>({...e,state:e.entity_id==='binary_sensor.test_door'?doorState:e.state}))));
 if(req.url==='/api/states/light.test')return res.end(JSON.stringify({...light,state:light.state}));
 if(req.url.startsWith('/api/services/light/turn_on')){light.state='on';return res.end('[]')}
 if(req.url.startsWith('/api/services/light/turn_off')){light.state='off';return res.end('[]')}
 if(req.url.startsWith('/api/services/media_player/')){
  if(req.url.endsWith('media_pause'))mp.state='paused';
  if(req.url.endsWith('media_play'))mp.state='playing';
  if(req.url.endsWith('volume_set'))mp.attributes={...mp.attributes,volume_level:0.85};
  return res.end('[]');
 }
 if(req.url==='/api/states/media_player.test')return res.end(JSON.stringify(mp));
 if(req.url==='/api/services/conversation/process')return res.end(JSON.stringify({response:{speech:{plain:{speech:'Включаю Полицейская сирена'}}}}));
 res.writeHead(404);console.log('FAKE404:',req.url);res.end('{}');
});
await new Promise(r=>fake.listen(3063,'127.0.0.1',r));
let child;
await new Promise((resolve_,reject)=>{
 child=spawn(process.execPath,['release/server.mjs'],{cwd:resolve('.'),env:{...process.env,PORT:'3062',PANEL_DATA:dir,HA_URL:'http://127.0.0.1:3063',HA_TOKEN:'mock-test-only',PANEL_PREVIEW:'0',PANEL_GUARD_SCALE:'0.02',PANEL_DOOR_DEBUG:'1'},stdio:['ignore','pipe','pipe']});
 const timer=setTimeout(()=>reject(new Error('Server startup timeout')),10000);
 child.stdout.on('data',b=>{if(String(b).includes('Panel ready')){clearTimeout(timer);resolve_()}});
 child.once('exit',()=>{clearTimeout(timer);reject(new Error('Server exited'))});
});
let proof;
async function call(path,{method='GET',data}={}){
 const r=await fetch('http://127.0.0.1:3062/api/panel/'+path,{method,headers:{'Content-Type':'application/json',...(method==='GET'?{}:{'X-Panel-Proof':proof})},...(data===undefined?{}:{body:JSON.stringify(data)})});
 return {status:r.status,body:await r.json()};
}
const waitFor=async fn=>{for(let i=0;i<60;i++){if(await fn())return true;await new Promise(r=>setTimeout(r,300))}return false};
try{
 let b=await call('bootstrap');proof=b.body.proof;
 const p=b.body.preferences;
 // live, станция и свет installed+verified, дверь verified
 p.mode='live';
 for(const d of p.devices)if(['door','rgb','light','station'].includes(d.type))d.status='installed';
 p.bindings=Object.fromEntries(Object.entries(p.bindings).map(([k,v])=>[k,{...v,verified:false}]));
 const {bindingDefinitions}=await import('../src/catalog.js');
 const {deviceTypes}=await import('../src/device-types.js');
 const doorDef=bindingDefinitions(p.devices).find(d=>d.type==='door');
 const lightDef=bindingDefinitions(p.devices).find(d=>deviceTypes[d.type].module==='lights'&&deviceTypes[d.type].controllable);
 const stationDef=bindingDefinitions(p.devices).find(d=>d.type==='station');
 p.bindings[doorDef.id]={entityId:'binary_sensor.test_door',verified:true};
 p.bindings[lightDef.id]={entityId:'light.test',verified:true};
 p.bindings[stationDef.id]={entityId:'media_player.test',verified:true};
 p.guardAwayMinutes=1;
 let saved=await call('preferences',{method:'PUT',data:p});
 console.log('REJECTED:',JSON.stringify(saved.body.rejected),'OFFLINE:',JSON.stringify(saved.body.offline));
 assert.equal(saved.status,200,'привязки и тайминги сохранены');
 // preflight: дверь открыта → 409
 doorState='on';
 await new Promise(r=>setTimeout(r,600));
 const blocked=await call('guard',{method:'POST',data:{action:'arm'}});
 console.log('DEBUG blocked:',JSON.stringify(blocked.body).slice(0,300));
 assert.equal(blocked.status,409,'нельзя встать на охрану с открытой дверью');
 doorState='off';
 await new Promise(r=>setTimeout(r,600));
 // arm
 const arm=await call('guard',{method:'POST',data:{action:'arm'}});
 assert.equal(arm.status,200);assert.equal(arm.body.armed,true);
 let st=await call('guard');
 assert.equal(st.body.armed,true,'охрана активна');
 // дверь открыта → тревога через ~1 мин * 0.02 = ~1.2 с
 doorState='on';
 const alarmSeen=await waitFor(async()=>{const s=await call('guard');return s.body.alarm!==null});
 assert.ok(alarmSeen,'тревога началась');
 // интент сирены ушёл в conversation
 const intentSeen=await waitFor(()=>seen.some(u=>u.startsWith('/api/services/conversation/process')));
 assert.ok(intentSeen,'интент сирены отправлен');
 // свет включён каскадом
 const onSeen=await waitFor(()=>seen.some(u=>u.startsWith('/api/services/light/turn_on')));
 assert.ok(onSeen,'свет включён при тревоге');
 // disarm: сирена стоп + свет off
 const disarm=await call('guard',{method:'POST',data:{action:'disarm'}});
 assert.equal(disarm.status,200);assert.equal(disarm.body.armed,false);
 st=await call('guard');assert.equal(st.body.alarm,null,'тревога остановлена');
 const offSeen=await waitFor(()=>seen.some(u=>u.startsWith('/api/services/light/turn_off')));
 assert.ok(offSeen,'свет выключен при снятии');
 const pauseSeen=await waitFor(()=>seen.some(u=>u.startsWith('/api/services/media_player/media_pause')));
 const j=await call('health');console.log('JOURNAL:',(j.body.journal||[]).slice(0,6).map(x=>x.text).join(' | '));
 assert.ok(pauseSeen,'сирена остановлена паузой');
 // хроника содержит guard-события
 const events=await call('events?type=guard');
 assert.ok(events.body.events.length>=2,'guard-события в хронике');
 console.log('security: ok');
}finally{
 if(child&&child.exitCode===null){const end=new Promise(r=>child.once('exit',r));child.kill('SIGTERM');await end}
 await new Promise(r=>fake.close(r));await rm(dir,{recursive:true,force:true});
}
