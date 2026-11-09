import assert from 'node:assert/strict';
import {h} from '../src/preact/kit.js';
import {DigestContent,digestBus} from '../src/preact/digest-widget.js';
import {render} from 'preact-render-to-string';
// Чистая разметка DigestContent (без хуков) рендерится в строку; deps — те же
// аргументы digestItems из ../digest.js, что рассылает app.js через digestBus.
const now=new Date('2026-11-09T12:00:00').getTime(),old=new Date(now-7*3600000).toISOString();
const base={mode:'live',liveOnline:true,devices:[],bindings:{},entityStates:{},now,alarmState:null,meterKnown:false};
const dev=(id,type,room,name=id)=>({id,type,room,status:'installed',name});
const ent=(state,attrs={},changed=old,id='e')=>({entity_id:id,state,last_changed:changed,attributes:attrs});
const html=deps=>render(h(DigestContent,{deps}));
// Батарейка 15 % → warn-пункт «Батарейка · Гостиная…».
let deps={...base,devices:[dev('b1','battery','living','Батарейка')],
 bindings:{b1:{verified:true,entityId:'sensor.bat'}},
 entityStates:{'sensor.bat':ent('15',{unit_of_measurement:'%'},old,'sensor.bat')}};
let out=html(deps);
assert.ok(out.includes('digest-card'),'карточка .digest-card сохранена');
assert.ok(out.includes('digest-item'),'пункт дайджеста');
assert.ok(out.includes('digest-warn'),'уровень warn для 15 %');
assert.ok(out.includes('Батарейка'),'текст «Батарейка»');
assert.ok(out.includes('Гостиная'),'зона из areaName');
assert.ok(out.includes('digest-action')&&out.includes('data-digest-open'),'обработчик открытия датчиков');
// Протечка → danger-карточка.
deps={...base,devices:[dev('l1','leak','bath','Протечка')],
 bindings:{l1:{verified:true,entityId:'binary_sensor.leak'}},
 entityStates:{'binary_sensor.leak':ent('on',{},old,'binary_sensor.leak')}};
out=html(deps);
assert.ok(out.includes('is-danger'),'danger-класс на карточке');
assert.ok(out.includes('Протечка'),'текст «Протечка»');
// Счётчик ТНС без данных: без meterKnown пункт есть, с meterKnown:true — подавлен.
deps={...base,entityStates:{'sensor.meter_reading':ent('unavailable',{},old,'sensor.meter_reading')}};
assert.ok(html(deps).includes('Счётчик ТНС'),'пункт счётчика без meterKnown');
deps={...deps,meterKnown:true};
assert.equal(html(deps),'','meterKnown:true подавляет «Счётчик ТНС»');
// Пустые deps → null (узел слота остаётся пустым, CSS :empty прячет).
assert.equal(html(base),'','пустой дайджест не рендерится');
// Шина: подписка получает deps от notify.
let seen=null;
digestBus.sub(d=>{seen=d});
digestBus.notify({marker:1});
assert.equal(seen.marker,1,'digestBus доставляет payload подписчикам');
console.log('preact-digest ok');