import assert from 'node:assert/strict';
import {bindingProblem} from '../src/house-profile.js';
import {spawn} from 'node:child_process';
import http from 'node:http';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {eventsListMarkup,eventsFilterMarkup,EVENT_TYPES} from '../src/events.js';

// 3.5.0: хроника дома — события двора (клип-хук), дверей (поллинг), света (команда),
// старт системы; лента с фильтром и кадр-каунтом.
const dir=await mkdtemp(join(tmpdir(),'home-panel-events-'));
let doorState='off';
const light={entity_id:'light.test',state:'off',attributes:{friendly_name:'Тест свет',brightness:128},last_updated:new Date().toISOString()};
const door={entity_id:'binary_sensor.test_door',state:'off',attributes:{friendly_name:'Тест дверь',device_class:'door'},last_updated:new Date().toISOString()};
const fake=http.createServer((req,res)=>{
 res.setHeader('Content-Type','application/json');
 if(req.headers.authorization!=='Bearer mock-test-only'){res.writeHead(401);return res.end('{}')}
 if(req.url==='/api/states')return res.end(JSON.stringify([light,door,door].map(e=>({...e,state:e.entity_id==='binary_sensor.test_door'?doorState:e.state}))));
 if(req.url==='/api/states/light.test')return res.end(JSON.stringify({...light,state:'on'}));
 if(req.url.startsWith('/api/services/light/turn_on')){light.state='on';return res.end('[]')}
 res.writeHead(404);res.end('{}');
});
await new Promise(r=>fake.listen(3053,'127.0.0.1',r));
let child;
await new Promise((resolve_,reject)=>{
 child=spawn(process.execPath,['release/server.mjs'],{cwd:resolve('.'),env:{...process.env,PORT:'3052',PANEL_DATA:dir,HA_URL:'http://127.0.0.1:3053',HA_TOKEN:'mock-test-only',PANEL_PREVIEW:'0',PANEL_TEST_HOOKS:'1',PANEL_DOOR_POLL_MS:'400',PANEL_DOOR_DEBUG:'1'},stdio:['ignore','pipe','pipe']});
 const timer=setTimeout(()=>reject(new Error('Server startup timeout')),10000);
 child.stdout.on('data',b=>{if(String(b).includes('Panel ready')){clearTimeout(timer);resolve_()}});
 child.once('exit',()=>{clearTimeout(timer);reject(new Error('Server exited'))});
});
let proof;
async function call(path,{method='GET',data}={}){
 const r=await fetch('http://127.0.0.1:3052/api/panel/'+path,{method,headers:{'Content-Type':'application/json',...(method==='GET'?{}:{'X-Panel-Proof':proof})},...(data===undefined?{}:{body:JSON.stringify(data)})});
 return {status:r.status,body:await r.json()};
}
try{
 let b=await call('bootstrap');proof=b.body.proof;
 const p=b.body.preferences;
 // привязываем дверь и свет: устройство installed + проверенная сущность; live-режим
 for(const d of p.devices)if(['door','rgb','light'].includes(d.type))d.status='installed';
 p.mode='live';
 p.bindings=Object.fromEntries(Object.entries(p.bindings).map(([k,v])=>[k,{...v,verified:false}]));
 const {bindingDefinitions}=await import('../src/catalog.js');
 const {deviceTypes}=await import('../src/device-types.js');
 const lightDef=bindingDefinitions(p.devices).find(d=>deviceTypes[d.type].module==='lights'&&deviceTypes[d.type].controllable);
 const doorDef=bindingDefinitions(p.devices).find(d=>d.type==='door');
 const doorId=doorDef.id,rgbId=lightDef.id;
 p.devices.find(d=>d.id===doorId).status='installed';
 p.devices.find(d=>d.id===rgbId).status='installed';
 p.bindings[doorId]={entityId:'binary_sensor.test_door',verified:true};
 p.bindings[rgbId]={entityId:'light.test',verified:true};
 let saved=await call('preferences',{method:'PUT',data:p});
 assert.equal(saved.status,200,'привязки сохранены');
 const savedBindings=saved.body.preferences.bindings;
 const prob=bindingProblem(doorDef,{entity_id:'binary_sensor.test_door',state:'off',attributes:{friendly_name:'Тест дверь',device_class:'door'}});
 console.log('door problem:',JSON.stringify(prob),'doorDef:',doorDef.id,doorDef.device.status,'bindingDef:',JSON.stringify(savedBindings[doorId]));
 // хук: клип двора → событие yard
 const cap=await call('yard-clips-capture',{method:'POST',data:{}});
 assert.ok(cap.body.id,'клип создан');
 // команда света → событие light
 const cmd=await call('ha/command',{method:'POST',data:{id:rgbId,value:true}});
 assert.equal(cmd.status,200,'команда света прошла');
 // дверь: поллинг заметит off→on (живой кеш LiveFeed обновляется своим тактом)
 doorState='on';
 let doorSeen=false;
 for(let i=0;i<24&&!doorSeen;i++){
  await new Promise(r=>setTimeout(r,500));
  const probe=await call('events?type=door');
  if(probe.body.events.length)doorSeen=true;
 }
 assert.ok(doorSeen,'событие двери от поллинга');
 let list=await call('events');
 const types=list.body.events.map(e=>e.type);
 assert.ok(types.includes('system'),'стартовое системное событие');
 assert.ok(types.includes('yard'),'событие двора от клипа');
 assert.ok(types.includes('light'),'событие света от команды');
 assert.ok(types.includes('door'),'событие двери от поллинга');
 const yard=list.body.events.find(e=>e.type==='yard');
 assert.match(yard.text,/Движение/,'текст двора');
 assert.equal(yard.frameCount>=1,true,'кадр-каунт у дворового события');
 const yardRow=list.body.events.find(e=>e.type==='yard');
 assert.match(yardRow.ref,/^clip:\d+$/,'ref ссылается на клип');
 // фильтр
 const filtered=await call('events?type=light');
 assert.equal(filtered.body.events.every(e=>e.type==='light'),true,'фильтр по типу');
 // разметка: группировка/фильтры/кликабельность
 const markup=eventsListMarkup(list.body.events);
 assert.match(markup,/Сегодня/,'группа «Сегодня»');
 assert.match(markup,/data-action="yard-clip"/,'клип кликабелен');
 assert.match(eventsFilterMarkup('door',list.body.events),/is-active/,'активный фильтр');
 assert.equal(Object.keys(EVENT_TYPES).length,5,'пять типов');
 console.log('events: ok');
}finally{
 if(child&&child.exitCode===null){const end=new Promise(r=>child.once('exit',r));child.kill('SIGTERM');await end}
 await new Promise(r=>fake.close(r));await rm(dir,{recursive:true,force:true});
}
