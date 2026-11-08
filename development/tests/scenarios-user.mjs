import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import http from 'node:http';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';

// Фейковый HA: living_a — свет с яркостью, living_b — on/off,
// rgb_lamp — rgb с яркостью, office_a — недоступна.
const mk=(entity_id,state,attributes={})=>({entity_id,state,attributes,last_updated:new Date().toISOString()});
const entities={
 'light.living_a':mk('light.living_a','on',{supported_color_modes:['color_temp','brightness']}),
 'light.living_b':mk('light.living_b','off',{supported_color_modes:['onoff']}),
 'light.rgb_lamp':mk('light.rgb_lamp','off',{supported_color_modes:['rgb','brightness']}),
 'light.office_a':mk('light.office_a','unavailable',{supported_color_modes:['onoff']}),
 'light.bath_a':mk('light.bath_a','off')
};
let calls=0;
const fake=http.createServer((req,res)=>{
 if(req.headers.authorization!=='Bearer mock-user-scenario'){res.writeHead(401);return res.end('{}')}
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
await new Promise(r=>fake.listen(3034,'127.0.0.1',r));
const dir=await mkdtemp(join(tmpdir(),'home-panel-user-scenarios-'));
let child;
await new Promise((resolve2,reject)=>{
 child=spawn(process.execPath,['release/server.mjs'],{cwd:resolve('.'),env:{...process.env,PORT:'3033',PANEL_DATA:dir,HA_URL:'http://127.0.0.1:3034',HA_TOKEN:'mock-user-scenario'},stdio:['ignore','pipe','pipe']});
 const timer=setTimeout(()=>reject(new Error('Server startup timeout')),10000);
 child.stdout.on('data',b=>{if(String(b).includes('Panel ready')){clearTimeout(timer);resolve2()}});
 child.once('exit',()=>{clearTimeout(timer);reject(new Error('Server exited'))});
});
let proof;
async function call(path,{method='GET',data,noProof=false}={}){
 const r=await fetch('http://127.0.0.1:3033/api/panel/'+path,{method,headers:{'Content-Type':'application/json',...(method==='GET'||noProof?{}:{'X-Panel-Proof':proof})},...(data===undefined?{}:{body:JSON.stringify(data)})});
 return {status:r.status,body:await r.json()};
}
try{
 const boot=await call('bootstrap');proof=boot.body.proof;let p=boot.body.preferences;
 assert.deepEqual(p.userScenarios,[],'Fresh profile has empty userScenarios');
 p.mode='live';
 let saved=await call('preferences',{method:'PUT',data:p});assert.equal(saved.status,200);
 p=saved.body.preferences;
 p.devices.push({id:'rgb-test',type:'rgb',room:'living',name:'RGB-лампа',status:'installed',masterOff:false,note:''});
 saved=await call('preferences',{method:'PUT',data:p});assert.equal(saved.status,200,'New custom rgb device adds unverified');
 p=saved.body.preferences;
 for(const [id,entityId] of [['living:0','light.living_a'],['living:1','light.living_b'],['rgb-test','light.rgb_lamp'],['office:0','light.office_a'],['bath:0','light.bath_a']])p.bindings[id]={entityId,verified:true};
 saved=await call('preferences',{method:'PUT',data:p});assert.equal(saved.status,200);p=saved.body.preferences;
 const bad=[
  {id:'user-bad id',name:'Пробел в id',steps:[{deviceId:'living:0',action:'on'}]},
  {id:'user-'+('x'.repeat(41)),name:'Длинный id',steps:[{deviceId:'living:0',action:'on'}]},
  {id:'user-noname',name:'',steps:[{deviceId:'living:0',action:'on'}]},
  {id:'user-longname',name:'н'.repeat(31),steps:[{deviceId:'living:0',action:'on'}]},
  {id:'user-nosteps',name:'Без шагов',steps:[]},
  {id:'user-ghost',name:'Нет устройства',steps:[{deviceId:'nope',action:'on'}]},
  {id:'user-badaction',name:'Плохое действие',steps:[{deviceId:'living:0',action:'dim'}]},
  {id:'user-badvalue',name:'Яркость 101',steps:[{deviceId:'rgb-test',action:'brightness',value:101}]},
  {id:'user-value-onoff',name:'Яркость у выключателя',steps:[{deviceId:'living:0',action:'off',value:50}]},
  {id:'user-many',name:'Слишком много шагов',steps:Array.from({length:13},()=>({deviceId:'living:0',action:'off'}))},
  {id:'user-dup',name:'Дубль id',steps:[{deviceId:'living:0',action:'on'}]}
 ];
 p.userScenarios.push({id:'user-night',name:'Дубль id',steps:[{deviceId:'living:0',action:'on'}]});
 const night={id:'user-night',name:'  Ночь кино  ',unknown:1,steps:[
  {deviceId:'living:1',action:'off',extra:1},
  {deviceId:'rgb-test',action:'brightness',value:40},
  {deviceId:'living:0',action:'on'},
  {deviceId:'office:0',action:'off'}
 ]};
 p.userScenarios=[night,{id:'user-ok2',name:'Второй валидный',steps:[{deviceId:'bath:0',action:'on'}]},...bad];
 for(let i=2;i<10;i++)p.userScenarios.push({id:'user-fill'+i,name:'Филлер '+i,steps:[{deviceId:'living:0',action:'on'}]});
 saved=await call('preferences',{method:'PUT',data:p});
 assert.equal(saved.status,200,'Validation drops bad scenarios instead of rejecting the whole save');
 p=saved.body.preferences;
 assert.deepEqual(p.userScenarios.map(s=>s.id),['user-night','user-ok2','user-dup','user-fill2','user-fill3','user-fill4','user-fill5','user-fill6'],'Only first 8 valid scenarios kept, duplicate id and 9th+ dropped');
 assert.equal(p.userScenarios[0].name,'Ночь кино','Name is trimmed, unknown fields dropped');
 assert.deepEqual(p.userScenarios[0].steps[0],{deviceId:'living:1',action:'off'},'Step sanitized');

 // Выполнение по порядку с readback; недоступная линия — failed только своя.
 const run=await call('ha/scenario',{method:'POST',data:{id:'user-night'}});
 assert.equal(run.status,200);
 assert.equal(run.body.id,'user-night');assert.equal(run.body.name,'Ночь кино');
 const byId=Object.fromEntries(run.body.results.map(r=>[r.id,r]));
 assert.deepEqual(run.body.results.filter(r=>r.status==='confirmed').map(r=>r.id),['living:1','rgb-test','living:0'],'Steps execute in order');
 assert.equal(byId['office:0'].status,'failed','Unavailable line fails alone');
 assert.match(byId['office:0'].message,/недоступна/);
 assert.equal(entities['light.living_b'].state,'off');
 assert.equal(entities['light.rgb_lamp'].attributes.brightness,102,'40 % brightness = 102/255');
 assert.equal(entities['light.living_a'].state,'on');
 assert.equal(run.body.summary.confirmed,3);
 assert.equal(run.body.summary.failed,1);
 assert.ok(run.body.results.every(r=>r.name&&r.message));
 // Непроверенная линия из шагов — skipped, не failed и не блокирует остальные.
 p.bindings['bath:0'].verified=false;
 saved=await call('preferences',{method:'PUT',data:p});assert.equal(saved.status,200);p=saved.body.preferences;
 const partial=await call('ha/scenario',{method:'POST',data:{id:'user-ok2'}});
 assert.equal(partial.status,200);
 assert.equal(partial.body.results[0].status,'skipped');
 assert.match(partial.body.results[0].message,/проверенной линии/);
 assert.equal(entities['light.bath_a'].state,'off','Skipped line stays untouched');
 // Brightness на не-rgb линии: честный откат к «включено полностью».
 p.userScenarios[0]={...p.userScenarios[0],steps:[{deviceId:'living:0',action:'brightness',value:55}]};
 saved=await call('preferences',{method:'PUT',data:p});assert.equal(saved.status,200);p=saved.body.preferences;
 const dim=await call('ha/scenario',{method:'POST',data:{id:'user-night'}});
 assert.equal(dim.status,200);
 const line=dim.body.results.find(r=>r.id==='living:0');
 assert.equal(line.status,'confirmed');assert.match(line.message,/не подтверждена/);
 assert.equal(entities['light.living_a'].state,'on');
 // Неизвестный пользовательский сценарий → 400.
 const missing=await call('ha/scenario',{method:'POST',data:{id:'user-ghost'}});
 assert.equal(missing.status,400);assert.match(missing.body.error,/Сценарий не найден/);
 // CRUD: сценарий переживает перечитывание хранилища.
 const reboot=await call('bootstrap');
 assert.equal(reboot.body.preferences.userScenarios.length,p.userScenarios.length,'userScenarios survive storage round-trip');
 // Удаление через preferences endpoint.
 p.userScenarios=p.userScenarios.filter(s=>s.id!=='user-ok2');
 saved=await call('preferences',{method:'PUT',data:p});assert.equal(saved.status,200);
 assert.equal((await call('bootstrap')).body.preferences.userScenarios.some(s=>s.id==='user-ok2'),false,'Deletion persists');
 const gone=await call('ha/scenario',{method:'POST',data:{id:'user-ok2'}});
 assert.equal(gone.status,400);
 assert.ok(calls>0,'HA commands were issued');
 console.log('PASS: user scenarios — strict validation drops bad id/name/steps, 8/12 limits enforced, ordered run with readback, unavailable line fails alone, brightness fallback honesty, unknown id 400, CRUD through preferences endpoint.');
}catch(error){
 console.error(error);process.exitCode=1;
}finally{
 if(child&&!child.killed&&child.exitCode===null){const end=new Promise(r=>child.once('exit',r));child.kill('SIGTERM');await end}
 await new Promise(r=>fake.close(r));
 await rm(dir,{recursive:true,force:true});
}

