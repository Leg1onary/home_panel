import assert from 'node:assert/strict';
import {weatherHint} from '../src/weather-hint.js';
import {tempTint} from '../src/thermal.js';
import {arcParams,dayArcPath} from '../src/day-arc.js';
// База: «сегодня 12:00» — пункты строим от now.
const now=Date.parse('2026-11-20T12:00:00Z');
const iso=min=>new Date(now+min*60000).toISOString();
// ─── weatherHint: hourly ───
// Дождь через 42 мин → округление до 5 → «через ~40 мин».
let hint=weatherHint([{datetime:iso(42),condition:'rainy',temperature:8}],now);
assert.equal(hint,'Дождь через ~40 мин','дождь через ~40 мин');
// Снег через 90 мин → «после HH:MM».
hint=weatherHint([{datetime:iso(90),condition:'snowy',temperature:1}],now);
assert.match(hint,/Снег после \d{2}:\d{2}/,'снег после HH:MM');
// Осадки уже в текущем пункте (t<=now) → «сейчас».
hint=weatherHint([{datetime:iso(-30),condition:'drizzle',temperature:9}],now);
assert.equal(hint,'Дождь сейчас','идущий дождь');
// Без осадков в 6 ч → null (ничего не придумываем).
assert.equal(weatherHint([{datetime:iso(30),condition:'cloudy',temperature:8},{datetime:iso(120),condition:'partlycloudy',temperature:9}],now),null,'без осадков → null');
// ─── weatherHint: daily-only ───
// Пункты за пределами 6 ч с шагом ≥20 ч: завтра с осадками → «Завтра: Дождь».
hint=weatherHint([{datetime:iso(8*60),condition:'cloudy',temperature:6},{datetime:iso(32*60),condition:'rainy',temperature:5}],now);
assert.equal(hint,'Завтра: Дождь','завтра дождь');
// Завтра без осадков → null.
assert.equal(weatherHint([{datetime:iso(32*60),condition:'partlycloudy',temperature:5}],now),null,'завтра ясно → null');
// ─── мусор ───
assert.equal(weatherHint(null,now),null,'null → null');
assert.equal(weatherHint('мусор',now),null,'строка → null');
assert.equal(weatherHint([],now),null,'пустой → null');
assert.equal(weatherHint([{datetime:'бред',condition:'rainy'}],now),null,'битая дата → null');
assert.equal(weatherHint([{datetime:iso(42)}],now),null,'нет condition → null');
// ─── tempTint ───
assert.deepEqual(tempTint(24),{kind:'warm',color:'#c98a3e',intensity:.2},'24 → warm');
assert.equal(tempTint(20),null,'20 → нейтрально');
assert.deepEqual(tempTint(15),{kind:'cold',color:'#4f7fb5',intensity:.2},'15 → cold');
assert.equal(tempTint(22),null,'граница 22 → нейтрально');
assert.equal(tempTint(17),null,'граница 17 → нейтрально');
assert.equal(tempTint(null),null,'null → нейтрально');
assert.equal(tempTint(NaN),null,'NaN → нейтрально');
// ─── дуга светового дня ───
const full=arcParams(100),half=arcParams(50),zero=arcParams(0),over=arcParams(150),junk=arcParams('бред');
assert.ok(full.path.startsWith('M 10 56'),'полукруг: старт в (10,56)');
assert.equal(full.dashoffset,'0','100 % → полное заполнение');
assert.equal(half.dashoffset,String(Math.round(full.length/2*100)/100),'50 % → половина длины');
assert.equal(zero.dashoffset,'157.08','0 % → пустая дуга');
assert.deepEqual(arcParams(150),full,'>100 % зажимается');
assert.equal(arcParams(-5).dashoffset,'157.08','<0 % зажимается');
assert.equal(junk.dashoffset,'157.08','мусор → 0 %');
assert.ok(dayArcPath().includes('A 50 50'),'радиус дуги 50');
console.log('main-context ok');
