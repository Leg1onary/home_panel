import assert from 'node:assert/strict';
import {monthForecast,monthComparison,energyCard} from '../src/energy.js';
const DAY=86400000;
const prev='2026-10-25';
const now=Date.parse('2026-11-13T12:00:00Z');
// ─── monthForecast ───
// интервал 25.10 00:00 → 13.11 12:00 = 19.5 дней, delta 200 → темп 10.256/сут;
// до конца ноября (01.12 00:00) 17.5 дней → 18 округлённо
const f=monthForecast({prevDate:prev,delta:200,cost:936},now);
assert.equal(f.daysToGo,18,'дней до конца ноября');
assert.equal(f.projected,384.6,'проекция 200+10.2564·18(округлённые дни)');
assert.equal(f.ratePerDay,10.26,'суточный темп');
assert.equal(monthForecast({prevDate:prev,delta:null},now),null,'нет дельты → null');
assert.equal(monthForecast({prevDate:prev,delta:-5},now),null,'отрицательная дельта → null');
assert.equal(monthForecast({prevDate:'криво',delta:10},now),null,'кривая дата → null');
assert.equal(monthForecast({prevDate:prev,delta:10},Date.parse(prev)+1000),null,'интервал < суток → null');
// ─── monthComparison ───
const readings=[
 {date:'2026-07-26',value:29257},{date:'2026-08-26',value:29370}, // 31 д, 113
 {date:'2026-09-25',value:29428}, // 30 д, 58
 {date:'2026-10-25',value:29558}, // 30 д, 130
];
// закрытые интервалы до prevDate(25.10): 113/31=3.645, 58/30=1.933, 130/30=4.333
// avgRate=(113+58+130)/(31+30+30)=301/91=3.3077
const cmp=monthComparison(readings,{prevDate:'2026-10-25',delta:200},now);
assert.equal(cmp.avgRate,3.31,'средний темп по 3 закрытым интервалам');
assert.equal(cmp.ratio,3.1,'текущий темп 10.256/3.308 ≈ 3.1');
// единственный закрытый интервал 45 дней отбрасывается фильтром 20..40 → null
const weird=monthComparison([{date:'2026-09-10',value:29000},{date:'2026-10-25',value:29100}],{prevDate:'2026-11-13',delta:20},now);
assert.equal(weird,null,'единственный интервал вне 20..40 дней → null');
// а с тремя нормальными интервалами — считается даже с коротким свежим
const mixed=monthComparison([...readings,{date:'2026-11-09',value:29603}],{prevDate:'2026-11-09',delta:45},now);
assert.equal(mixed.avgRate,3.31,'короткий интервал отфильтрован, среднее по нормальным');
assert.equal(monthComparison([],{prevDate:'2026-10-25',delta:10},now),null,'нет истории → null');
// ─── разметка карточки: прогноз и сравнение ───
const ents={reading:{entity_id:'sensor.x_reading',state:'29688',last_updated:new Date(now).toISOString()},
 consumption:{entity_id:'sensor.x_consumption',state:'12.3',last_updated:new Date(now).toISOString()}};
const extra={readingsDate:'13.11',month:{prevValue:29558,prevDate:prev,delta:130,cost:608,
 forecast:{projected:330,ratePerDay:10.5,daysToGo:17},comparison:{ratio:1.5,avgRate:3.3}}};
const card=energyCard(ents,now,extra);
assert.match(card,/Прогноз до конца месяца/,'строка прогноза');
assert.match(card,/330,0 кВт·ч/,'число прогноза');
assert.match(card,new RegExp('≈ 1[ \\u00A0]543 ₽'),'стоимость прогноза 608/130·330 = 1543');
assert.match(card,/Темп выше обычного на ~50 %/,'сравнение с обычным');
const calm=energyCard(ents,now,{...extra,month:{...extra.month,forecast:null,comparison:{ratio:1.02,avgRate:3.3}}});
assert.equal(calm.includes('Прогноз до конца месяца'),false,'нет прогноза — нет строки');
assert.match(calm,/Темп в обычном ритме/,'мягкое сравнение');
const plain=energyCard(ents,now,{readingsDate:'13.11',month:{prevValue:29558,prevDate:prev,delta:130,cost:608}});
assert.equal(plain.includes('energy-note'),false,'без forecast/comparison — как раньше');
console.log('energy-forecast: ok');
