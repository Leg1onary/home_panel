import assert from 'node:assert/strict';
import {monthDelta,monthCost,energyCard} from '../src/energy.js';
import {defaultPreferences,validatePreferences,sanitizeEnergyReadings,sanitizeEnergyTariff,MAX_ENERGY_READINGS} from '../src/preferences.js';
// Волна 3.2.6: месячный расход по показаниям ТНС (снимаются раз в месяц).
// Чистый monthDelta: prev — показание с максимальной датой строго меньше
// readings_date из energyData. История вносит пользователь через UI/API.
const readings=[{date:'2026-02-26',value:25771},{date:'2026-09-25',value:29428}];
// Текущее 29558 (26.10) → prev 29428 (25.09), delta 130.
let m=monthDelta(29558,'2026-10-26',readings);
assert.deepEqual(m,{prevValue:29428,prevDate:'2026-09-25',delta:130});
// Стоимость по тарифу: 130 × 4.68 = 608.4 → округление до рубля.
assert.equal(monthCost(m.delta,4.68),608);
assert.equal(monthCost(130,4.68),608);
// Без тарифа стоимость не считается.
assert.equal(monthCost(130,null),null);
assert.equal(monthCost(130,0),null);
// Пустые readings или нет предыдущего → delta null (fallback карточки).
assert.deepEqual(monthDelta(29558,'2026-10-26',[]),{prevValue:null,prevDate:null,delta:null});
assert.deepEqual(monthDelta(29558,'2026-10-26',null),{prevValue:null,prevDate:null,delta:null});
assert.deepEqual(monthDelta(29558,'2026-10-26',[{date:'2026-11-01',value:30000}]),{prevValue:null,prevDate:null,delta:null});
// current<prev (откат счётчика) → delta null, prev известен.
m=monthDelta(29400,'2026-10-26',readings);
assert.deepEqual(m,{prevValue:29428,prevDate:'2026-09-25',delta:null});
assert.equal(monthCost(m.delta,4.68),null);
// Некорректные дата/значение → null.
assert.deepEqual(monthDelta(29558,'',readings).delta,null);
assert.deepEqual(monthDelta(null,'2026-10-26',readings).delta,null);
assert.deepEqual(monthDelta(29558,'26.10.2026',readings).delta,null);
assert.deepEqual(monthDelta(29558,'2026-10-26',[{date:'плохо',value:100}]).delta,null);
assert.deepEqual(monthDelta(29558,'2026-10-26',[{date:'2026-09-25',value:NaN}]).delta,null);
// Дробные показания допустимы в расчёте (значение приходит с сущности).
assert.deepEqual(monthDelta(29558.4,'2026-10-26',readings).delta,130.4);
// Карточка: строка «Месяц» с расходом и стоимостью, «Неделя» удалена из разметки.
let html=energyCard({reading:{entity_id:'sensor.r',state:'29558',last_updated:new Date().toISOString()}},Date.now(),{deltas:{day:null},month:{prevValue:29428,prevDate:'2026-09-25',delta:130,cost:608}});
assert.match(html,/Месяц/);assert.match(html,/130,0 кВт·ч/);assert.match(html,/≈\s*608\s*₽/);
assert.ok(!html.includes('Неделя'),'строки «Неделя» больше нет в разметке');
// prev нет → прежняя заглушка «Расход появится».
html=energyCard({reading:{entity_id:'sensor.r',state:'29558',last_updated:new Date().toISOString()}},Date.now(),{deltas:{day:null},month:{prevValue:null,prevDate:null,delta:null,cost:null}});
assert.match(html,/Расход появится после следующей передачи показаний/);
assert.ok(!html.includes('Месяц'));
// PREFS: валидация показаний и тарифа.
// Плохая дата / не-целое / неположительное значение — ошибка.
for(const bad of [
 [{date:'26.09.2026',value:100}],[{date:'2026-09-31',value:100}],[{date:'2026-09-25',value:100.5}],
 [{date:'2026-09-25',value:0}],[{date:'2026-09-25',value:-5}],[{date:'2026-09-25',value:'29428'}]
]){
 assert.throws(()=>sanitizeEnergyReadings(bad),JSON.stringify(bad));
}
// 35 записей ок, 37 уникальных дат — ошибка (лимит ≤36).
const many=n=>Array.from({length:n},(_,i)=>({date:new Date(Date.UTC(2024,0,1+i)).toISOString().slice(0,10),value:100+i}));
assert.deepEqual(sanitizeEnergyReadings(many(35)).length,35);
assert.throws(()=>sanitizeEnergyReadings(many(37)),/36/);
// Дедуп по дате: повторная дата заменяет значение; результат отсортирован.
let out=sanitizeEnergyReadings([{date:'2026-09-25',value:29428},{date:'2026-02-26',value:25771},{date:'2026-09-25',value:29430}]);
assert.deepEqual(out,[{date:'2026-02-26',value:25771},{date:'2026-09-25',value:29430}]);
// Тариф: диапазон 0.01..99, отсутствие = null.
assert.equal(sanitizeEnergyTariff(4.68),4.68);
assert.equal(sanitizeEnergyTariff(null),null);
assert.equal(sanitizeEnergyTariff(undefined),null);
for(const bad of [0,0.001,100,-1,'4.68',true])assert.throws(()=>sanitizeEnergyTariff(bad),String(bad));
// Обратная совместимость: старый профиль без новых ключей валидируется → пусто.
let p=validatePreferences(defaultPreferences());
assert.deepEqual(p.energy_readings,[]);assert.equal(p.energy_tariff,null);
assert.equal(defaultPreferences().energy_readings.length,0);
// Полный профиль с ключами проходит PUT-валидацию.
p=validatePreferences({...defaultPreferences(),energy_readings:readings,energy_tariff:4.68});
assert.deepEqual(p.energy_readings,readings);assert.equal(p.energy_tariff,4.68);
assert.equal(MAX_ENERGY_READINGS,36);
console.log('PASS: месяц по показаниям ТНС — monthDelta (prev строго раньше readings_date, current<prev → null), cost по тарифу, карточка «Месяц» вместо «Неделя», валидация prefs (дата/значение/лимит 36/дедуп/тариф) и обратная совместимость.');
