import assert from 'node:assert/strict';
import {bindingProblem} from '../src/house-profile.js';
import {spawn} from 'node:child_process';
import http from 'node:http';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {eventsListMarkup,eventsFilterMarkup,EVENT_TYPES,activityMarkup,lightTodayMarkup,computeAnalytics,durationLabel} from '../src/events.js';
const dayStart=t=>{const d=new Date(t);d.setHours(0,0,0,0);return d.getTime()};

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
 // 3.9.2: стартовое системное событие больше не пишется (тикер удалён);
 // guard пишет свои события при взводе/тревоге, здесь их не проверяем.
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
 // аналитика из хроники (3.6.0)
 const a=await call('analytics');
 assert.equal(a.body.lightDays.length,14,'14 дней');
 assert.ok(a.body.totals.light>=1,'свет посчитан');
 assert.ok(a.body.totals.yard>=1,'двор посчитан');
 assert.ok(a.body.totals.door>=1,'двери посчитаны');
 assert.equal(a.body.yardHours.length,24,'24 часа двора');
 const lightDay=a.body.lightDays.at(-1);
 assert.ok(lightDay.count>=1,'сегодняшний свет в последнем дне');
 // разметка активности
 const act=activityMarkup(a.body);
 assert.match(act,/Свет · 14 дней/,'заголовок света');
 assert.match(act,/Двор по часам/,'почасовой двор');
 const empty=activityMarkup(null);
 assert.match(empty,/Аналитика появится/,'пустое состояние');
 // 3.7.2: «Свет сегодня»
 const lt=lightTodayMarkup([{label:'12.11',start:0,count:3},{label:'13.11',start:86400000,count:5}],[{name:'Гостиная',count:6}]);
 assert.match(lt,/Сегодня: <strong>5 включений/,'сегодняшний счёт');
 assert.match(lt,/за неделю 8/,'сумма недели');
 assert.match(lt,/чаще всего: Гостиная \(6\)/,'топ-комната');
 // разметка: группировка/фильтры/кликабельность
 const markup=eventsListMarkup(list.body.events);
 assert.match(markup,/Сегодня/,'группа «Сегодня»');
 assert.match(markup,/data-action="yard-clip"/,'клип кликабелен');
 assert.match(eventsFilterMarkup('door',list.body.events),/is-active/,'активный фильтр');
 assert.equal(Object.keys(EVENT_TYPES).length,6,'шесть типов (двор, двери, свет, показания, система, охрана)');
 // 3.9.10: только реальные «включения» + время горения по комнатам.
const mk=(at,type,text)=>({at,type,text});
const base=dayStart(1_700_000_000_000);
const rows=[
 mk(base+1000,'light','Гостиная · Левый выключатель: включено'),
 mk(base+60_000,'light','Гостиная · Левый выключатель: выключено'),
 mk(base+120_000,'light','Гостиная · Правый выключатель: включено'),
 mk(base+240_000,'light','Гостиная · Правый выключатель: выключено'),
 mk(base+300_000,'door','Входная дверь открыта'),
 mk(base+360_000,'yard','Движение · onvif'),
];
const an=computeAnalytics(rows,base+400_000);
assert.equal(an.totals.light,2,'включений ровно 2 (выключения не считаются)');
assert.equal(an.lightDays.at(-1).count,2,'сегодняшний счётчик — 2 включения');
assert.equal(an.lightDays.at(-2).count,0,'позавчера — ноль');
const guest=an.roomMinutes.find(r=>r.name.startsWith('Гостиная'));
assert.ok(guest&&guest.min>=1,"время горения гостиной учтено (мин)");
// 1+2=3 мин суммарно по двум линиям (левая 59 с, правая 120 с)
assert.equal(an.roomMinutes.filter(r=>r.name.startsWith('Гостиная')).reduce((s,r)=>s+r.min,0),3,'сумма ms 59+120');
// не выключенный до конца свет считается до «сейчас»
const rows2=[mk(base+1000,'light','Коридор · Основной свет: включено')];
const an2=computeAnalytics(rows2,base+90_000);
assert.equal(an2.totals.light,1,'1 включение');
assert.equal(an2.roomMinutes[0].min,1,'горит до «сейчас»: 89 с');
// durationLabel
assert.equal(durationLabel(372),'6 ч 12 мин','часы+минуты');
assert.equal(durationLabel(45),'45 мин','минуты');
assert.equal(durationLabel(0.4),'меньше минуты','секунды');
// «выключено» не проходит за «включено»
const an3=computeAnalytics([mk(base+1000,'light','Прихожая · Свет: выключено')],base+2000);
assert.equal(an3.totals.light,0,'одиночное выключение — не включение');
assert.equal(an3.roomMinutes.length,0,'висячее выключение не даёт времени');
console.log('events: ok (analytics v2)');

}finally{
 if(child&&child.exitCode===null){const end=new Promise(r=>child.once('exit',r));child.kill('SIGTERM');await end}
 await new Promise(r=>fake.close(r));await rm(dir,{recursive:true,force:true});
}
