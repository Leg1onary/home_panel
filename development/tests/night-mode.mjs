import assert from 'node:assert/strict';
import {isNight,isTime,nightLabel,ambientSkinClass} from '../src/night.js';
import {defaultPreferences,validatePreferences} from '../src/preferences.js';
const hm=h=>h*60;
// Расписание 23:00 → 07:00 пересекает полночь.
const S='23:00',E='07:00';
// Ночь: 23:00 (граница включительно), 23:30, 03:00, 06:59.
assert.equal(isNight(hm(23),S,E),true);
assert.equal(isNight(23*60+30,S,E),true);
assert.equal(isNight(3*60,S,E),true);
assert.equal(isNight(6*60+59,S,E),true);
// День: 07:00 (конец исключителен), 12:00, 22:59.
assert.equal(isNight(7*60,S,E),false);
assert.equal(isNight(12*60,S,E),false);
assert.equal(isNight(22*60+59,S,E),false);
// Расписание внутри суток 01:00 → 06:00.
assert.equal(isNight(2*60,'01:00','06:00'),true);
assert.equal(isNight(6*60,'01:00','06:00'),false);
assert.equal(isNight(0,'01:00','06:00'),false);
// on → всегда ночь, off → всегда день (даже днём по расписанию наоборот).
assert.equal(isNight(12*60,S,E,'on'),true);
assert.equal(isNight(3*60,S,E,'on'),true);
assert.equal(isNight(3*60,S,E,'off'),false);
assert.equal(isNight(12*60,S,E,'off'),false);
// Мусорные времена → день (без падения).
assert.equal(isNight(3*60,'25:00',E),false);
assert.equal(isNight(3*60,S,'x'),false);
// старт = конец: вычислитель считает днём, валидация отвергает пару.
assert.equal(isNight(3*60,'07:00','07:00'),false);
assert.throws(()=>validatePreferences({...defaultPreferences(),nightStart:'07:00',nightEnd:'07:00'}),/совпадать/);
// 3.7.3 «Ночная заставка»: ночью — кожа is-night, днём — нет; уважает on/off.
assert.equal(ambientSkinClass(3*60,S,E),'is-night');
assert.equal(ambientSkinClass(12*60,S,E),'');
assert.equal(ambientSkinClass(12*60,S,E,'on'),'is-night');
assert.equal(ambientSkinClass(3*60,S,E,'off'),'');
// Валидация preferences: плохие строки отклоняются.
for(const bad of ['24:00','7:00','23:0','abc','','23:60','-1:00'])
 assert.throws(()=>validatePreferences({...defaultPreferences(),nightStart:bad}),/ноч|ЧЧ:ММ/,'nightStart='+bad);
for(const bad of ['24:00','7:00','abc'])
 assert.throws(()=>validatePreferences({...defaultPreferences(),nightEnd:bad}),/ноч|ЧЧ:ММ/,'nightEnd='+bad);
// Старый профиль v3 без новых ключей валиден, ключи добираются дефолтами.
const legacy={...defaultPreferences()};delete legacy.nightStart;delete legacy.nightEnd;
assert.equal(validatePreferences(legacy).nightStart,'23:00');
assert.equal(validatePreferences(legacy).nightEnd,'07:00');
// Хорошие строки принимаются и попадают в профиль.
const p=validatePreferences({...defaultPreferences(),nightStart:'22:15',nightEnd:'06:45',nightMode:'auto'});
assert.equal(p.nightStart,'22:15');
assert.equal(p.nightEnd,'06:45');
// Дефолты согласованы: 23:00–07:00.
const d=defaultPreferences();
assert.equal(d.nightStart,'23:00');
assert.equal(d.nightEnd,'07:00');
// Формат времени и подпись статуса.
assert.equal(isTime('00:00'),true);
assert.equal(isTime('23:59'),true);
assert.equal(isTime('23:60'),false);
assert.equal(nightLabel(3*60,S,E),'Сейчас ночь');
assert.equal(nightLabel(12*60,S,E),'Сейчас день');
console.log('night-mode: ok');