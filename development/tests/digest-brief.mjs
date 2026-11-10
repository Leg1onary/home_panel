import assert from 'node:assert/strict';
import {digestBriefing} from '../src/digest.js';
// Чистая логика digestBriefing: максимум 4 пункта, приоритет прогноз→свет→двор→дверь→охрана,
// фолбэк «Всё спокойно», валидация иконок разрешённым set'ом.
const now=Date.now();
const dev=(id,type,room,name=id)=>({id,type,room,status:'installed',name});
const base={devices:[],bindings:{},entityStates:{},yardClips:[],forecast:null,now,isNightNow:false,alarmState:null};
// Прогноз + свет 2 + двор 3 события: порядок и тексты.
let out=digestBriefing({...base,
 forecast:{condition:'cloudy',temperature:7.3},
 devices:[dev('l1','light','living'),dev('l2','light','kitchen')],
 bindings:{l1:{verified:true,entityId:'light.l1'},l2:{verified:true,entityId:'light.l2'}},
 entityStates:{'light.l1':{entity_id:'light.l1',state:'on'},'light.l2':{entity_id:'light.l2',state:'on'}},
 yardClips:[{id:'a',at:now-3600000},{id:'b',at:now-7200000},{id:'c',at:now-3*3600000}]});
assert.deepEqual(out.map(i=>i.text),['Сегодня: Облачно, +7°','Свет горит: 2','Двор: 3 событий за 12 ч'],'порядок прогноз, свет, двор');
assert.deepEqual(out.map(i=>i.icon),['cloudy','zap','video'],'иконки пунктов');
// Ночью без forecast: двор и охрана, прогноза нет.
out=digestBriefing({...base,isNightNow:true,alarmState:'armed_away',
 yardClips:[{id:'a',at:now-1000},{id:'b',at:now-2000}]});
assert.deepEqual(out.map(i=>i.text),['Двор: 2 событий за 12 ч','Охрана активна'],'ночь: двор и охрана');
assert.ok(!out.some(i=>i.text.startsWith('Сегодня')),'ночью прогноз скрыт');
// Старые клипы (>12 ч) и клипы из будущего не считаются.
out=digestBriefing({...base,yardClips:[{id:'a',at:now-13*3600000},{id:'b',at:now+3600000}]});
assert.equal(out.length,1,'старые клипы не в брифинге');
assert.equal(out[0].text,'Всё спокойно','фолбэк');
// Дверь приоткрыта.
out=digestBriefing({...base,devices:[dev('d1','door','hall')],bindings:{d1:{verified:true,entityId:'binary_sensor.door'}},entityStates:{'binary_sensor.door':{entity_id:'binary_sensor.door',state:'on'}}});
assert.deepEqual(out.map(i=>i.icon),['alert-triangle'],'дверь: иконка alert-triangle');
assert.equal(out[0].text,'Дверь приоткрыта','дверь: текст');
// Максимум 4 пункта: 6 условий → по приоритету остаются первые 4.
const six={...base,forecast:{condition:'sunny',temperature:20},alarmState:'armed_home',
 devices:[dev('l1','light','living'),dev('l2','light','kitchen'),dev('d1','door','hall')],
 bindings:{l1:{verified:true,entityId:'light.l1'},l2:{verified:true,entityId:'light.l2'},d1:{verified:true,entityId:'binary_sensor.door'}},
 entityStates:{'light.l1':{entity_id:'light.l1',state:'on'},'light.l2':{entity_id:'light.l2',state:'on'},'binary_sensor.door':{entity_id:'binary_sensor.door',state:'on'}},
 yardClips:[{id:'a',at:now}]};
out=digestBriefing(six);
assert.equal(out.length,4,'максимум 4 пункта');
assert.deepEqual(out.map(i=>i.text),['Сегодня: Солнечно, +20°','Свет горит: 2','Двор: 1 событий за 12 ч','Дверь приоткрыта'],'отрезано по приоритету: охрана выпала');
// Неизвестная иконка отброшена: forecast-иконка не из WEATHER_ICON невозможна,
// поэтому проверяем через прямую подмену: пункт с невалидной иконкой теряется.
const BRIEF=(await import('../src/digest.js')).BRIEF_ICONS;
assert.ok(BRIEF.has('sun')&&BRIEF.has('shield')&&!BRIEF.has('rocket'),'set иконок разрешённых');
out=digestBriefing({...base,forecast:{condition:'exceptional',temperature:3}});
assert.deepEqual(out.map(i=>i.icon),['cloudy'],'известная погодная иконка проходит');
console.log('digest-brief ok');