import assert from 'node:assert/strict';
import {digestItems} from '../src/digest.js';
const now=Date.now(),old=new Date(now-7*3600000).toISOString(),fresh=new Date(now-3600000).toISOString();
const base={mode:'live',liveOnline:true,now};
const ent=(state,attrs={},changed=old,id)=>({entity_id:id,state,...(changed?{last_changed:changed}:{}),attributes:attrs});
assert.deepEqual(digestItems({...base}),[],'Пустой дайджест не рисует пунктов.');
// Батарейка 15 % → warn с комнатой.
let s={...base,devices:[{id:'battery:bath',type:'battery',room:'bath',name:'Батарейка',status:'installed'}],
 bindings:{'battery:bath':{entityId:'sensor.b_bath',verified:true}},entityStates:{'sensor.b_bath':ent('15',{unit_of_measurement:'%'})}};
let items=digestItems(s);
assert.equal(items.length,1);assert.equal(items[0].level,'warn');assert.match(items[0].text,/Ванная: 15 %/);
// Мягкий уровень 30 % → info.
s.entityStates['sensor.b_bath']=ent('30',{unit_of_measurement:'%'});
assert.equal(digestItems(s)[0].level,'info');
// Три батареи → один агрегат.
s={...base,devices:[1,2,3].map(i=>({id:'b'+i,type:'battery',room:'living',name:'B'+i,status:'installed'})),
 bindings:Object.fromEntries([1,2,3].map(i=>['b'+i,{entityId:'e'+i,verified:true}])),
 entityStates:{e1:ent('12',{unit_of_measurement:'%'}),e2:ent('18',{unit_of_measurement:'%'}),e3:ent('30',{unit_of_measurement:'%'})}};
items=digestItems(s);
assert.equal(items.length,1);assert.equal(items[0].level,'warn');assert.match(items[0].text,/3 батарейки разряжены/);
// Протечка → danger и выше остальных.
s={...base,devices:[{id:'leak:bath',type:'leak',room:'bath',name:'Протечка в ванной',status:'installed'},
 {id:'battery:x',type:'battery',room:'bath',name:'B',status:'installed'}],
 bindings:{'leak:bath':{entityId:'binary_sensor.leak',verified:true},'battery:x':{entityId:'sensor.bx',verified:true}},
 entityStates:{'binary_sensor.leak':ent('on'),'sensor.bx':ent('10',{unit_of_measurement:'%'})}};
items=digestItems(s);
assert.equal(items[0].level,'danger');assert.match(items[0].text,/Протечка · Ванная/);
// Биндинг не проверен → недоступный датчик не показывается; проверен → агрегат «Нет связи».
s={...base,devices:[{id:'door',type:'door',room:'hall',name:'Входная дверь',status:'installed'}],
 bindings:{door:{entityId:'binary_sensor.door',verified:false}},entityStates:{'binary_sensor.door':ent('unavailable')}};
assert.equal(digestItems(s).length,0);
s.bindings.door.verified=true;
items=digestItems(s);
assert.equal(items.length,1);assert.equal(items[0].level,'warn');assert.match(items[0].text,/Нет связи: Входная дверь/);
// Нет связи с HA в live-режиме → warn; в демо — нет.
s={...base,liveOnline:false,devices:[],bindings:{},entityStates:{}};
assert.ok(digestItems(s).some(i=>i.text==='Нет связи с Home Assistant'));
assert.equal(digestItems({...s,mode:'demo'}).length,0);
// Свет горел 7 часов → info, свежий last_changed → пункта нет.
s={...base,devices:[{id:'corridor-main',type:'light',room:'living',name:'Свет',status:'installed'}],
 bindings:{'corridor-main':{entityId:'light.corridor',verified:true}},entityStates:{'light.corridor':ent('on',{},old)}};
items=digestItems(s);
assert.equal(items.length,1);assert.equal(items[0].level,'info');assert.match(items[0].text,/свет горит 7 ч/);
s.entityStates['light.corridor']=ent('on',{},fresh);
assert.equal(digestItems(s).length,0);
// Мороз → info.
s={...base,devices:[],bindings:{},entityStates:{'weather.home':ent('snowy',{temperature:-8},old,'weather.home')}};
items=digestItems(s);
assert.equal(items.length,1);assert.equal(items[0].level,'info');assert.match(items[0].text,/Мороз: -8 °C/);
assert.equal(digestItems({...s,entityStates:{'weather.home':ent('snowy',{temperature:-3},old,'weather.home')}}).length,0);
// Сортировка danger → warn → info.
s={...base,devices:[{id:'leak:bath',type:'leak',room:'bath',name:'L',status:'installed'},
 {id:'door',type:'door',room:'hall',name:'D',status:'installed'},
 {id:'battery:x',type:'battery',room:'bath',name:'B',status:'installed'}],
 bindings:{'leak:bath':{entityId:'binary_sensor.leak',verified:true},door:{entityId:'binary_sensor.door',verified:true},'battery:x':{entityId:'sensor.bx',verified:true}},
 entityStates:{'binary_sensor.leak':ent('on'),'binary_sensor.door':ent('unavailable'),'sensor.bx':ent('15',{unit_of_measurement:'%'}),'weather.home':ent('snowy',{temperature:-9},old,'weather.home')}};
assert.deepEqual(digestItems(s).map(i=>i.level),['danger','warn','warn','info']);
console.log('PASS: дайджест показывает только реальные сигналы — батарейки/агрегат, протечка danger, offline, недоступные датчики только с проверенным биндингом, забытый свет, мороз, сортировка.');