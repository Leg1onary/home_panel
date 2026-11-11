import assert from 'node:assert/strict';
import {energyBars} from '../src/energy.js';
// 3.2.8: месячные дельты для графика «Статистики». Данные — реальные показания
// счётчика ТНС (допустимо использовать в тестах, в продукт не хардкодятся).
const readings=[
 {date:'2025-12-26',value:25771},{date:'2026-01-26',value:26753},{date:'2026-02-26',value:27110},
 {date:'2026-03-26',value:27488},{date:'2026-04-26',value:27931},{date:'2026-05-26',value:28450},
 {date:'2026-06-26',value:28905},{date:'2026-07-26',value:29428}];
// 8 точек → 7 дельт; label «мм.гг» из даты предыдущей записи (конец периода).
let bars=energyBars(readings,null,null);
assert.equal(bars.length,7);
assert.deepEqual(bars[0],{label:'12.25',delta:982,cost:null});
assert.equal(bars[1].delta,357);assert.equal(bars[1].label,'01.26');
assert.equal(bars[2].delta,378);assert.equal(bars[2].label,'02.26');
assert.equal(bars[3].delta,443);assert.equal(bars[3].label,'03.26');
assert.equal(bars[4].delta,519);assert.equal(bars[4].label,'04.26');
assert.equal(bars[5].delta,455);assert.equal(bars[5].label,'05.26');
assert.equal(bars[6].delta,523);assert.equal(bars[6].label,'06.26');
assert.ok(bars.every(b=>!b.open));
// Тариф: стоимость каждого месяца, 982 × 4.68 = 4595.76 → 4596.
bars=energyBars(readings,4.68,null);
assert.equal(bars[0].cost,4596);
assert.equal(bars[6].cost,Math.round(523*4.68));
// Текущий открытый месяц: 29558 от 26.10 → delta 130, open:true.
bars=energyBars(readings,4.68,{date:'2026-10-26',value:29558});
assert.equal(bars.length,8);
assert.deepEqual(bars.at(-1),{label:'10.26',delta:130,cost:608,open:true});
// current раньше последнего показания (откат) → открытого пункта нет.
assert.equal(energyBars(readings,null,{date:'2026-07-01',value:29000}).length,7);
// current<last → открытого пункта нет.
assert.equal(energyBars(readings,null,{date:'2026-11-26',value:29000}).length,7);
// Лимит 12 последних.
const many=[];for(let i=0;i<20;i++)many.push({date:new Date(Date.UTC(2025,i,10)).toISOString().slice(0,10),value:10000+i*100});
bars=energyBars(many,null,null);
assert.equal(bars.length,12);
assert.deepEqual(bars.map(b=>b.label),['08.25','09.25','10.25','11.25','12.25','01.26','02.26','03.26','04.26','05.26','06.26','07.26']);
assert.deepEqual(bars.map(b=>b.delta),Array(12).fill(100));
// Мусор пропускается: невалидные даты/значения, отрицательная дельта, пустой вход.
assert.deepEqual(energyBars([{date:'плохо',value:5},{date:'2026-01-10',value:500},{date:'2026-02-10',value:NaN},{date:'2026-02-10',value:-3},{date:'2026-03-10',value:420},{date:'2026-04-10',value:400}],null,null),[]);
assert.deepEqual(energyBars([],null,null),[]);
assert.deepEqual(energyBars(null,null,null),[]);
assert.deepEqual(energyBars('мусор',null,null),[]);
// Сортировка не по порядку входа — дельты всё равно по датам.
bars=energyBars([{date:'2026-03-10',value:300},{date:'2026-01-10',value:100},{date:'2026-02-10',value:200}],null,null);
assert.deepEqual(bars.map(b=>b.delta),[100,100]);
assert.deepEqual(bars.map(b=>b.label),['01.26','02.26']);
console.log('energy-chart: ок');
