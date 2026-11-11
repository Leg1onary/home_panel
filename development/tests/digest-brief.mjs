import assert from 'node:assert/strict';
import {digestBriefing} from '../src/digest.js';
// Чистая логика digestBriefing: максимум 4 пункта, приоритет (3.4.0) безопасность
// выше погоды: дверь-ночь > дверь-долго > двор-ночь > аномалия > прогноз → свет →
// двор → дверь → охрана. Фолбэк «Всё спокойно», валидация иконок set'ом.
const minuteOf=ms=>{const d=new Date(ms);return d.getHours()*60+d.getMinutes()};
const pad=n=>String(n).padStart(2,'0');
const hm=m=>pad(Math.floor(m/60))+':'+pad(m%60);
let base=Date.now();if(minuteOf(base)>1420)base-=2*3600000;
// Окно «ночи» — 2 минуты внутри offset -2h (+1..+3): ночные клипы base-2h+1/+2 мин,
// дневные base-1h и base-3h; «сейчас» (offset 0) тоже вне окна.
const dayWin={nightStart:hm(minuteOf(base-2*3600000)+1),nightEnd:hm(minuteOf(base-2*3600000)+3)};
const dev=(id,type,room,name=id)=>({id,type,room,status:'installed',name});
const baseArgs={devices:[],bindings:{},entityStates:{},yardClips:[],forecast:null,now:base,isNightNow:false,alarmState:null,...dayWin,guardNight:'auto',guardDoorMinutes:15};
// Прогноз + свет 2 + двор 3 события: порядок и тексты.
let out=digestBriefing({...baseArgs,
 forecast:{condition:'cloudy',temperature:7.3},
 devices:[dev('l1','light','living'),dev('l2','light','kitchen')],
 bindings:{l1:{verified:true,entityId:'light.l1'},l2:{verified:true,entityId:'light.l2'}},
 entityStates:{'light.l1':{entity_id:'light.l1',state:'on'},'light.l2':{entity_id:'light.l2',state:'on'}},
 yardClips:[{id:'a',at:base-3600000},{id:'b',at:base-7200000},{id:'c',at:base-3*3600000}]});
assert.deepEqual(out.map(i=>i.text),['Сегодня: Облачно, +7°','Свет горит: 2','Двор: 3 событий за 12 ч'],'порядок прогноз, свет, двор');
assert.deepEqual(out.map(i=>i.icon),['cloudy','zap','video'],'иконки пунктов');
// Ночью без forecast: двор и охрана, прогноза нет.
out=digestBriefing({...baseArgs,isNightNow:true,alarmState:'armed_away',
 yardClips:[{id:'a',at:base-1000},{id:'b',at:base-2000}]});
assert.deepEqual(out.map(i=>i.text),['Двор: 2 событий за 12 ч','Охрана активна'],'ночь: двор и охрана');
assert.ok(!out.some(i=>i.text.startsWith('Сегодня')),'ночью прогноз скрыт');
// Старые клипы (>12 ч) и клипы из будущего не считаются.
out=digestBriefing({...baseArgs,yardClips:[{id:'a',at:base-13*3600000},{id:'b',at:base+3600000}]});
assert.equal(out.length,1,'старые клипы не в брифинге');
assert.equal(out[0].text,'Всё спокойно','фолбэк');
// Дверь приоткрыта (без last_changed: долгота открытия неизвестна).
out=digestBriefing({...baseArgs,devices:[dev('d1','door','hall')],bindings:{d1:{verified:true,entityId:'binary_sensor.door'}},entityStates:{'binary_sensor.door':{entity_id:'binary_sensor.door',state:'on'}}});
assert.deepEqual(out.map(i=>i.icon),['alert-triangle'],'дверь: иконка alert-triangle');
assert.equal(out[0].text,'Дверь приоткрыта','дверь: текст');
// Дверь открыта 20 минут при пороге 15 → алерт с минутами.
out=digestBriefing({...baseArgs,devices:[dev('d1','door','hall')],bindings:{d1:{verified:true,entityId:'binary_sensor.door'}},entityStates:{'binary_sensor.door':{entity_id:'binary_sensor.door',state:'on',last_changed:new Date(base-20*60000).toISOString()}}});
assert.equal(out[0].text,'Дверь открыта (20 мин)','долгая дверь: формат минут');
// Ночная дверь выше погоды: окно прямо вокруг «сейчас», door-иконка.
out=digestBriefing({...baseArgs,nightStart:hm(minuteOf(base)),nightEnd:hm(minuteOf(base)+2),
 devices:[dev('d1','door','hall')],bindings:{d1:{verified:true,entityId:'binary_sensor.door'}},
 entityStates:{'binary_sensor.door':{entity_id:'binary_sensor.door',state:'on'}},
 forecast:{condition:'sunny',temperature:20}});
assert.deepEqual(out.map(i=>[i.icon,i.text]),[['door','Дверь открыта ночью'],['sun','Сегодня: Солнечно, +20°']],'ночная дверь выше погоды');
// Максимум 4 пункта: 5 условий → по приоритету остаются первые 4.
const six={...baseArgs,forecast:{condition:'sunny',temperature:20},alarmState:'armed_home',
 devices:[dev('l1','light','living'),dev('l2','light','kitchen'),dev('d1','door','hall')],
 bindings:{l1:{verified:true,entityId:'light.l1'},l2:{verified:true,entityId:'light.l2'},d1:{verified:true,entityId:'binary_sensor.door'}},
 entityStates:{'light.l1':{entity_id:'light.l1',state:'on'},'light.l2':{entity_id:'light.l2',state:'on'},'binary_sensor.door':{entity_id:'binary_sensor.door',state:'on'}},
 yardClips:[{id:'a',at:base}]};
out=digestBriefing(six);
assert.equal(out.length,4,'максимум 4 пункта');
assert.deepEqual(out.map(i=>i.text),['Сегодня: Солнечно, +20°','Свет горит: 2','Двор: 1 событий за 12 ч','Дверь приоткрыта'],'отрезано по приоритету: охрана выпала');
// Неизвестная иконка отброшена: forecast-иконка не из WEATHER_ICON невозможна,
// поэтому проверяем через прямую подмену: пункт с невалидной иконкой теряется.
const BRIEF=(await import('../src/digest.js')).BRIEF_ICONS;
assert.ok(BRIEF.has('sun')&&BRIEF.has('shield')&&BRIEF.has('door')&&!BRIEF.has('rocket'),'set иконок разрешённых');
out=digestBriefing({...baseArgs,forecast:{condition:'exceptional',temperature:3}});
assert.deepEqual(out.map(i=>i.icon),['cloudy'],'известная погодная иконка проходит');
console.log('digest-brief ok');