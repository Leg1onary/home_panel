import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import http from 'node:http';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';

// Fake HA: light.living_a supports brightness, light.office_a is unavailable.
const mk=(entity_id,state,attributes={})=>({entity_id,state,attributes,last_updated:new Date().toISOString()});
const entities={
 'light.living_a':mk('light.living_a','on',{supported_color_modes:['color_temp','brightness']}),
 'light.living_b':mk('light.living_b','off',{supported_color_modes:['onoff']}),
 'light.hall_a':mk('light.hall_a','off',{supported_color_modes:['onoff']}),
 'light.office_a':mk('light.office_a','unavailable',{supported_color_modes:['onoff']}),
 'light.bath_a':mk('light.bath_a','off'),
 'light.rgb_lamp':mk('light.rgb_lamp','off',{supported_color_modes:['rgb','brightness']}),
 'switch.corridor':mk('switch.corridor','off')
};
let calls=0;
const fake=http.createServer((req,res)=>{
 if(req.headers.authorization!=='Bearer mock-scenario'){res.writeHead(401);return res.end('{}')}
 res.setHeader('Content-Type','application/json');
 const service=/^\/api\/services\/([a-z_]+)\/([a-z_]+)$/.exec(req.url);
 if(req.url==='/api/states')return res.end(JSON.stringify(Object.values(entities)));
 const single=/^\/api\/states\/(.+)$/.exec(req.url);
 if(single){
  const e=entities[single[1]];
  if(!e){res.writeHead(404);return res.end('{}')}
  return res.end(JSON.stringify(e));
 }
 if(service){
  calls++;
  let data={};req.on('data',c=>data=JSON.parse(c));
  req.on('end',()=>{
   const e=entities[data.entity_id];
   if(!e){res.writeHead(404);return res.end('[]')}
   if(service[2]==='turn_on'){e.state='on';if(data.brightness!==undefined)e.attributes={...e.attributes,brightness:data.brightness}}
   else if(service[2]==='turn_off')e.state='off';
   res.end('[]');
  });
  return;
 }
 res.writeHead(404);res.end('{}');
});
await new Promise(r=>fake.listen(3032,'127.0.0.1',r));
const dir=await mkdtemp(join(tmpdir(),'home-panel-scenarios-'));
let child;
await new Promise((resolve2,reject)=>{
 child=spawn(process.execPath,['release/server.mjs'],{cwd:resolve('.'),env:{...process.env,PORT:'3031',PANEL_DATA:dir,HA_URL:'http://127.0.0.1:3032',HA_TOKEN:'mock-scenario'},stdio:['ignore','pipe','pipe']});
 const timer=setTimeout(()=>reject(new Error('Server startup timeout')),10000);
 child.stdout.on('data',b=>{if(String(b).includes('Panel ready')){clearTimeout(timer);resolve2()}});
 child.once('exit',()=>{clearTimeout(timer);reject(new Error('Server exited'))});
});
let proof;
async function call(path,{method='GET',data,noProof=false}={}){
 const r=await fetch('http://127.0.0.1:3031/api/panel/'+path,{method,headers:{'Content-Type':'application/json',...(method==='GET'||noProof?{}:{'X-Panel-Proof':proof})},...(data===undefined?{}:{body:JSON.stringify(data)})});
 return {status:r.status,body:await r.json()};
}
try{
 const boot=await call('bootstrap');proof=boot.body.proof;let p=boot.body.preferences;
 p.mode='live';
 p.devices.push({id:'rgb-test',type:'rgb',room:'living',name:'RGB-лампа',status:'installed',masterOff:false,note:''});
 let staged=await call('preferences',{method:'PUT',data:p});assert.equal(staged.status,200,'New custom rgb device adds unverified');
 p=staged.body.preferences;p.bindings['rgb-test']={entityId:'light.rgb_lamp',verified:true};
 for(const [id,entityId] of [['living:0','light.living_a'],['living:1','light.living_b'],['rgb-test','light.rgb_lamp'],['hall:0','light.hall_a'],['office:0','light.office_a'],['bath:0','light.bath_a'],['corridor-main','switch.corridor']])p.bindings[id]={entityId,verified:true};
 const saved=await call('preferences',{method:'PUT',data:p});
 assert.equal(saved.status,200);p=saved.body.preferences;
 if(saved.status!==200)console.log('PUT ERR',JSON.stringify(saved.body));
 // Без proof — отказ до любого действия.
 const before=calls;
 const noProof=await call('ha/scenario',{method:'POST',data:{id:'leave'},noProof:true});
 assert.equal(noProof.status,400);assert.equal(noProof.body.code,'PANEL_PROOF_REQUIRED');assert.equal(calls,before);
 // Злонамеренный id → 400.
 const bad=await call('ha/scenario',{method:'POST',data:{id:'deploy-the-missiles'}});
 assert.equal(bad.status,400);assert.match(bad.body.error,/Неизвестный сценарий/);
 assert.equal((await call('ha/scenario',{method:'POST',data:{}})).status,400);

 // Уход: все проверенные линии выключены, каждая — confirmed по readback;
 // недоступная сущность даёт failed, но не валит сценарий.
 const leave=await call('ha/scenario',{method:'POST',data:{id:'leave'}});
 assert.equal(leave.status,200);
 assert.equal(leave.body.name,'Уход');
 const byId=Object.fromEntries(leave.body.results.map(r=>[r.id,r]));
 for(const id of ['living:0','living:1','rgb-test','hall:0','bath:0','corridor-main'])assert.equal(byId[id].status,'confirmed',id);
 assert.equal(byId['office:0'].status,'failed');assert.match(byId['office:0'].message,/недоступна/);
 assert.equal(entities['light.living_a'].state,'off');
 assert.equal(entities['switch.corridor'].state,'off');
 assert.equal(leave.body.summary.confirmed,6);
 assert.equal(leave.body.summary.failed,1);
 assert.equal(leave.body.summary.skipped,9,'Only installed panel light lines are counted, others skipped honestly');
 assert.ok(leave.body.results.every(r=>r.name&&r.message));
 // Вечер: только гостиная+прихожая; RGB-линия с подтверждённой яркостью — 100 %.
 const evening=await call('ha/scenario',{method:'POST',data:{id:'evening'}});
 assert.equal(evening.status,200);
 assert.deepEqual(evening.body.results.filter(r=>r.status==='confirmed').map(r=>r.id).sort(),['hall:0','living:0','living:1','rgb-test']);
 assert.equal(entities['light.living_a'].state,'on');
 assert.equal(entities['light.rgb_lamp'].state,'on');assert.equal(entities['light.rgb_lamp'].attributes.brightness,255,'100 % brightness on RGB-capable line');
 assert.equal(entities['light.living_b'].state,'on');
 assert.equal(entities['light.bath_a'].state,'off','Other rooms untouched');
 assert.equal(entities['switch.corridor'].state,'off');
 assert.equal(evening.body.summary.skipped,12);
 // Кино: всё выключить кроме гостиной, первая линия гостиной — приглушённо.
 const cinema=await call('ha/scenario',{method:'POST',data:{id:'cinema'}});
 assert.equal(cinema.status,200);
 const cine=Object.fromEntries(cinema.body.results.map(r=>[r.id,r]));
 assert.equal(cine['living:0'].status,'confirmed');assert.match(cine['living:0'].message,/не подтверждена/,'Light-only line honestly falls back to full on');
 assert.equal(entities['light.living_a'].state,'on');
 assert.equal(cine['hall:0'].status,'confirmed');assert.equal(entities['light.hall_a'].state,'off');
 assert.equal(entities['light.rgb_lamp'].state,'on','Other living lines stay untouched');
 assert.equal(cine['office:0'].status,'failed','Unavailable entity keeps failing its own line only');
 assert.equal(entities['light.bath_a'].state,'off');
 assert.equal(cinema.body.summary.skipped,11);
 // 30 %: когда первая линия гостиной — RGB с подтверждённой яркостью.
 const p3={...p,bindings:{...p.bindings,'living:0':{entityId:'',verified:false},'living:1':{entityId:'',verified:false}}};
 const saved2=await call('preferences',{method:'PUT',data:p3});
 assert.equal(saved2.status,200);
 const p2=saved2.body.preferences;
 assert.equal(p2.bindings['living:0'].verified,false);assert.equal(p2.bindings['living:1'].verified,false);
 p=p2;
 const cinemaDim=await call('ha/scenario',{method:'POST',data:{id:'cinema'}});
 const cine2=Object.fromEntries(cinemaDim.body.results.map(r=>[r.id,r]));
 assert.equal(cine2['rgb-test'].status,'confirmed');assert.match(cine2['rgb-test'].message,/30 %/);
 assert.equal(entities['light.rgb_lamp'].attributes.brightness,77,'30 % dim');
 // Деморежим честно сообщает об отказе построчно, не падая.
 p.mode='demo';
 assert.equal((await call('preferences',{method:'PUT',data:p})).status,200);
 const demo=await call('ha/scenario',{method:'POST',data:{id:'leave'}});
 assert.equal(demo.status,200);assert.equal(demo.body.summary.confirmed,0);assert.equal(demo.body.summary.failed,5);
 console.log('PASS: panel scenarios (leave/evening/cinema), per-line readback, unavailable line fails alone, verified-only batching, room scoping, dim fallback honesty, bad id 400, proof required.');
}finally{
 if(child&&!child.killed&&child.exitCode===null){const end=new Promise(r=>child.once('exit',r));child.kill('SIGTERM');await end}
 await new Promise(r=>fake.close(r));
 await rm(dir,{recursive:true,force:true});
}

