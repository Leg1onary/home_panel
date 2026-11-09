import assert from 'node:assert/strict';
import {findMeterEntities,meterValue,energyCard} from '../src/energy.js';
import {digestItems} from '../src/digest.js';
const now=Date.now(),fresh=new Date(now-3600000).toISOString(),old=new Date(now-25*3600000).toISOString();
const e=(id,state,updated=fresh,attrs={})=>({entity_id:id,state,last_updated:updated,last_changed:updated,attributes:attrs});
// Поиск: schetchik-сущности с _reading/_consumption; помехи исключаются.
const s={'sensor.schetchik_no11080509_reading':e('sensor.schetchik_no11080509_reading','1234.5'),
 'sensor.schetchik_no11080509_consumption':e('sensor.schetchik_no11080509_consumption','45.2'),
 'sensor.schetchik_no11080509_meter_number':e('sensor.schetchik_no11080509_meter_number','11080509'),
 'sensor.meter_signal_level':e('sensor.meter_signal_level','-60'),'light.schetchik_lamp':e('light.schetchik_lamp','on')};
let m=findMeterEntities(s);
assert.equal(m.reading.entity_id,'sensor.schetchik_no11080509_reading');
assert.equal(m.consumption.entity_id,'sensor.schetchik_no11080509_consumption');
assert.equal(meterValue(m.reading),1234.5);assert.equal(meterValue(m.consumption),45.2);
// Другое именование (meter) тоже находится.
assert.equal(findMeterEntities({'sensor.electricity_meter_reading':e('sensor.electricity_meter_reading','10'),'sensor.electricity_meter_consumption':e('sensor.electricity_meter_consumption','1')}).reading.state,'10');
assert.deepEqual(findMeterEntities({'sensor.temperature':e('sensor.temperature','20')}),{reading:null,consumption:null});
// Карточка: оба доступны → обе строки, число и подпись обновления.
let html=energyCard(m,now);
assert.match(html,/234,5/);assert.match(html,/кВт·ч/);assert.match(html,/Потребление/);assert.match(html,/45,2/);assert.match(html,/обновлено/);
// Только reading → потребление «нет данных» приглушённо.
html=energyCard({reading:m.reading,consumption:e('sensor.c','unavailable')},now);
assert.match(html,/нет данных/);assert.match(html,/is-faint/);
// Все unavailable → карточки нет.
assert.equal(energyCard({reading:e('sensor.r','unavailable'),consumption:e('sensor.c','unavailable')},now),'');
assert.equal(energyCard(null,now),'');
// Давно не обновлялось → is-stale.
html=energyCard({'reading':e('sensor.r','100',old)},now);
assert.match(html,/is-stale/);
// Дайджест: сущности есть, обе недоступны, свежий last_updated → info.
let items=digestItems({mode:'live',liveOnline:true,now,devices:[],bindings:{},entityStates:{
 'sensor.schetchik_no11080509_reading':e('sensor.schetchik_no11080509_reading','unavailable'),
 'sensor.schetchik_no11080509_consumption':e('sensor.schetchik_no11080509_consumption','unavailable')}});
assert.equal(items.length,1);assert.equal(items[0].level,'info');assert.match(items[0].text,/Счётчик ТНС: нет данных/);
// Недоступно больше суток → warn.
items=digestItems({mode:'live',liveOnline:true,now,devices:[],bindings:{},entityStates:{
 'sensor.schetchik_no11080509_reading':e('sensor.schetchik_no11080509_reading','unavailable',old),
 'sensor.schetchik_no11080509_consumption':e('sensor.schetchik_no11080509_consumption','unavailable',old)}});
assert.equal(items[0].level,'warn');assert.match(items[0].text,/больше суток/);
// Reading доступен → пункта нет.
assert.equal(digestItems({mode:'live',liveOnline:true,now,devices:[],bindings:{},entityStates:{
 'sensor.schetchik_no11080509_reading':e('sensor.schetchik_no11080509_reading','1234.5',old),
 'sensor.schetchik_no11080509_consumption':e('sensor.schetchik_no11080509_consumption','unavailable',old)}}).length,0);
// Сущностей нет вообще → пункта нет.
assert.equal(digestItems({mode:'live',liveOnline:true,now,devices:[],bindings:{},entityStates:{}}).length,0);
// Демо: дайджест без сущностей не рисует пунктов (пустые entityStates).
assert.equal(digestItems({mode:'demo',liveOnline:true,now,devices:[],bindings:{},entityStates:{}}).length,0);
console.log('PASS: энергия v1 — поиск счётчика (schetchik/meter, без signal), карточка рельсы (обе строки/нет данных/пусто/stale) и дайджест ТНС (info → warn >24ч, доступный reading без пункта).');