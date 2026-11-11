import assert from 'node:assert/strict';
import {guardActive,doorOpenTooLong,nightYardEvents,yardAnomaly,YARD_ANOMALY_THRESHOLD} from '../src/guard.js';
import {defaultPreferences,validatePreferences} from '../src/preferences.js';
import {digestBriefing} from '../src/digest.js';
const S='23:00',E='07:00';
// guardActive: auto = ночное расписание (включая пересечение полуночи).
assert.equal(guardActive(3*60,S,E,'auto'),true,'auto ночь');
assert.equal(guardActive(12*60,S,E,'auto'),false,'auto день');
assert.equal(guardActive(23*60,S,E,'auto'),true,'граница начала');
assert.equal(guardActive(7*60,S,E,'auto'),false,'граница конца исключительна');
assert.equal(guardActive(0,S,E,'auto'),true,'полночь — ночь');
// on/off перекрывают расписание.
assert.equal(guardActive(12*60,S,E,'on'),true,'on днём — охрана');
assert.equal(guardActive(3*60,S,E,'off'),false,'off ночью — нет');
assert.equal(guardActive(12*60,S,E),false,'дефолт auto');
// Мусорные времена без падения.
assert.equal(guardActive(3*60,'25:00',E,'auto'),false);
assert.equal(guardActive(3*60,S,'x','auto'),false);
// doorOpenTooLong: null без данных; граница N минут включительно.
const now=Date.now();
assert.equal(doorOpenTooLong(null,now,15),null,'нет last_changed');
assert.equal(doorOpenTooLong(undefined,now,15),null);
assert.equal(doorOpenTooLong(now-15*60000,now,15),true,'ровно 15 минут');
assert.equal(doorOpenTooLong(now-15*60000+1,now,15),false,'чуть меньше порога');
assert.equal(doorOpenTooLong(now-20*60000,now,15),true,'дольше порога');
assert.equal(doorOpenTooLong(now-5*60000,now,15),false,'свежее открытие');
assert.equal(doorOpenTooLong(now-20*60000,now,15.5),null,'нечелые минуты → нет данных');
// nightYardEvents: окно пересекает полночь (23:59→00:01) или локальный полдень,
// если местная полночь старше 12 часов (окно 11:59→12:01).
const midnight=new Date();midnight.setHours(0,0,0,0);
let wS='23:59',wE='00:01',clipAt=midnight.getTime();
if(now-clipAt>12*3600000){wS='11:59';wE='12:01';const noon=new Date();noon.setHours(12,0,0,0);clipAt=noon.getTime()}
const clips=[
 {id:'n1',at:clipAt},{id:'n2',at:clipAt+30000},
 {id:'d1',at:clipAt-120000},
 {id:'old',at:now-13*3600000}
];
assert.equal(nightYardEvents(clips,now,wS,wE),2,'два ночных события из четырёх');
assert.equal(nightYardEvents(clips,now,'12:00','12:01'),0,'не наше окно — ноль');
assert.equal(nightYardEvents([],now,S,E),0,'пустой список');
assert.equal(nightYardEvents([{at:'x'}],now,wS,wE),0,'мусорный at');
// yardAnomaly: упрощённый порог 10 событий за 24 ч.
const recent=i=>({id:'c'+i,at:now-(i+1)*3600000});
// Валидация prefs: guardNight/guardDoorMinutes + обратная совместимость.
const legacy={...defaultPreferences()};delete legacy.guardNight;delete legacy.guardDoorMinutes;
const lp=validatePreferences(legacy);
assert.equal(lp.guardNight,'auto','старый профиль: guardNight по умолчанию');
assert.equal(lp.guardDoorMinutes,15,'старый профиль: минуты по умолчанию');
for(const bad of ['always','1',null])assert.throws(()=>validatePreferences({...defaultPreferences(),guardNight:bad}),/охраны/,'guardNight='+bad);
for(const bad of [4,121,2.5,'15',null])assert.throws(()=>validatePreferences({...defaultPreferences(),guardDoorMinutes:bad}),/5 до 120/,'minutes='+bad);
assert.equal(validatePreferences({...defaultPreferences(),guardNight:'on',guardDoorMinutes:120}).guardDoorMinutes,120,'границы принимаются');
// digestBriefing: ночной двор и аномалия; приоритет безопасность > погода.
const minuteOf=ms=>{const d=new Date(ms);return d.getHours()*60+d.getMinutes()};
const pad=n=>String(n).padStart(2,'0');
const hm=m=>pad(Math.floor(m/60))+':'+pad(m%60);
let base=now;if(minuteOf(base)>1420)base-=2*3600000;
// «Дневное» окно вокруг base-1h: клипы у base заведомо вне окна.
const dayWin={nightStart:hm(minuteOf(base-2*3600000)+1),nightEnd:hm(minuteOf(base-2*3600000)+3)};
const dev=(id,type,room,name=id)=>({id,type,room,status:'installed',name});
const baseCfg={devices:[],bindings:{},entityStates:{},yardClips:[],forecast:null,now:base,isNightNow:false,alarmState:null,...dayWin,guardNight:'auto',guardDoorMinutes:15};
let out=digestBriefing({...baseCfg,yardClips:[{id:'n1',at:base-2*3600000+60000},{id:'n2',at:base-2*3600000+120000},{id:'d1',at:base-3600000},{id:'d2',at:base-3*3600000}]});
assert.deepEqual(out.map(i=>i.text),['Двор: 2 событий ночью','Двор: 4 событий за 12 ч'],'ночной двор раньше обычного');
assert.equal(out[0].icon,'video','ночной двор: иконка video');
// Аномалия: 10 событий за 24 ч (13-14 ч назад, вне 12-часового двора-пункта).
out=digestBriefing({...baseCfg,yardClips:Array.from({length:10},(_,i)=>({id:'a'+i,at:base-(13*3600000+i*60000)}))});
assert.deepEqual(out.map(i=>[i.icon,i.text]),[['alert-triangle','Двор: аномальная активность']],'аномалия двора');
// Дверь открыта дольше N минут: формат «(N мин)», иконка alert-triangle.
const doorOpen={devices:[dev('d1','door','hall')],bindings:{d1:{verified:true,entityId:'binary_sensor.door'}},
 entityStates:{'binary_sensor.door':{entity_id:'binary_sensor.door',state:'on',last_changed:new Date(base-20*60000).toISOString()}}};
out=digestBriefing({...baseCfg,...doorOpen});
assert.equal(out[0].text,'Дверь открыта (20 мин)','долгая дверь: формат');
assert.equal(out[0].icon,'alert-triangle','долгая дверь: иконка');
// Ночная дверь выше погоды: окно прямо вокруг «сейчас».
const nightNowWin={nightStart:hm(minuteOf(base)),nightEnd:hm(minuteOf(base)+2)};
out=digestBriefing({...baseCfg,...doorOpen,forecast:{condition:'sunny',temperature:20},...nightNowWin});
assert.deepEqual(out.map(i=>[i.icon,i.text]),[['door','Дверь открыта ночью'],['sun','Сегодня: Солнечно, +20°']],'ночная дверь выше погоды');
console.log('guard: ok');
assert.equal(yardAnomaly(Array.from({length:9},(_,i)=>recent(i)),now),false,'9 → нет');
assert.equal(yardAnomaly(Array.from({length:10},(_,i)=>recent(i)),now),true,'10 → аномалия');
assert.equal(yardAnomaly([...Array.from({length:9},(_,i)=>recent(i)),{id:'old',at:now-25*3600000}],now),false,'старше 24 ч не считается');
assert.equal(YARD_ANOMALY_THRESHOLD,10,'порог задокументирован');