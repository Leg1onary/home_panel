import assert from 'node:assert/strict';
import {findMeterEntities,meterValue,energyCard,readingsDateOf} from '../src/energy.js';
import {digestItems} from '../src/digest.js';
import {HomeAssistant,energyDeltas} from '../server/ha.js';
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
// Только reading → строки «Потребление» нет (consumption недоступен — не показываем).
html=energyCard({reading:m.reading,consumption:e('sensor.c','unavailable')},now);
assert.ok(!html.includes('Потребление'));
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
// v2: дата показаний readings_date → dd.mm; некорректное значение → нет строки.
assert.equal(readingsDateOf('2026-10-26'),'26.10');
assert.equal(readingsDateOf('некорректно'),null);
html=energyCard(m,now,{readingsDate:'2026-10-26'});
assert.match(html,/Дата показаний: 26\.10/);
assert.ok(!energyCard(m,now,{deltas:{day:12.3,week:85.4}}).includes('Дата показаний'));
// Расход: строки «Сутки»/«Неделя» с числами; кВт·ч формат с одной дробной.
html=energyCard(m,now,{deltas:{day:12.3,week:85.4}});
assert.match(html,/Сутки/);assert.match(html,/12,3 кВт·ч/);assert.match(html,/Неделя/);assert.match(html,/85,4 кВт·ч/);
// Показания крупно с нулем дробной части: 29 558,0.
assert.match(energyCard({'reading':e('sensor.r','29558')},now),/29\u00a0558,0 кВт·ч/);
// Дельты null (данных ещё нет) → одна muted-строка-заглушка, без спама.
html=energyCard(m,now,{deltas:null});
assert.match(html,/Расход появится после следующей передачи показаний/);
assert.ok(html.split('Расход появится').length-1===1);
assert.ok(!energyCard(m,now).includes('Расход появится'));
// Кнопка обновления расхода в карточке.
assert.ok(energyCard(m,now).includes('data-energy-reload'));
// Сервер: история расхода — фейковый HA (стиль shopping-тестов), запрос к /api/history/period.
const entity='sensor.schetchik_no11080509_reading',h0=Date.now();
const day=86400000,row=(state,ageDays)=>({entity_id:entity,state,last_changed:new Date(h0-ageDays*day).toISOString(),last_updated:new Date(h0-ageDays*day).toISOString()});
let historyCalls=0,historyPath='';
const ha=new HomeAssistant({url:'http://qa.invalid',token:'qa'});
ha.request=async path=>{
 if(!path.startsWith('/api/history/period/'))throw new Error('Unexpected URL '+path);
 historyPath=path;historyCalls++;
 const query=path.slice(path.indexOf('?'));
 assert.ok(query.includes('filter_entity_id='+entity)&&query.includes('minimal_response')&&query.includes('no_attributes'));
 return [[row('29558.0',7),row('unavailable',3),row('unknown',2),row('29620.5',1),row('29625.5',0.2)]];
};
let points=await ha.energyHistory(entity,168);
// unavailable/unknown отфильтрованы, state → число, last_changed → at.
assert.deepEqual(points,[{at:h0-7*day,value:29558},{at:h0-day,value:29620.5},{at:h0-Math.round(0.2*day),value:29625.5}]);
// Кеш 60 с: повторный вызов не бьёт в HA.
await ha.energyHistory(entity,168);assert.equal(historyCalls,1);
// Валидация параметров.
await assert.rejects(()=>ha.energyHistory(entity,6),/24 или 168/);
await assert.rejects(()=>ha.energyHistory('camera.x',168),/Некорректная сущность/);
assert.ok(/\/api\/history\/period\//.test(historyPath));
// Расход: чистая функция energyDeltas из server/ha.js.
const wday=day,wk=7*day;
const pts=[{at:h0-wk,value:29000},{at:h0-2*wday,value:29500},{at:h0-wday,value:29512.3},{at:h0,value:29558}];
// <2 точек → обе дельты null.
assert.deepEqual(energyDeltas([]),{day:null,week:null});
assert.deepEqual(energyDeltas([{at:h0,value:5}]),{day:null,week:null});
// Сутки = последняя − первая в окне 24 ч; неделя = по всему окну 168 ч.
assert.deepEqual(energyDeltas(pts,h0),{day:45.7,week:558});
// Окно суток с одной точкой → day null, week считается.
assert.deepEqual(energyDeltas([{at:h0-3*wday,value:100},{at:h0,value:150}],h0),{day:null,week:50});
// Некорректные точки игнорируются.
assert.deepEqual(energyDeltas([{at:h0,value:1},{at:h0-wday,value:NaN},{at:null,value:2},{at:h0-2*wday,value:3}],h0),{day:null,week:-2});

console.log('PASS: энергия v2 — поиск счётчика, карточка рельсы (показания/дата показаний/потребление/сутки/неделя/заглушка), история расхода (energyHistory: /api/history/period, фильтр unavailable, кеш 60 с) и energyDeltas (окна 24/168 ч, <2 точек → null).');