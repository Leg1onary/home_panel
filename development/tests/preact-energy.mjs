import assert from 'node:assert/strict';
import {h} from '../src/preact/kit.js';
import {EnergyWidgetContent} from '../src/preact/energy-widget.js';
import {render} from 'preact-render-to-string';
// Чистая разметка EnergyWidgetContent (без хуков) рендерится в строку.
const html=data=>render(h(EnergyWidgetContent,{data,now:new Date('2026-11-09T12:00:00').getTime()}));
// Обычные данные: показание, дельта суток, классы прежние.
let out=html({reading:{value:29558.04,updatedAt:'2026-11-09T09:10:00.000Z'},consumption:12.4,deltas:{day:1.2,week:null},readingsDate:'2026-11-08',stale:false});
assert.ok(out.includes('energy-card'),'карточка сохраняет .energy-card');
assert.ok(/29[\s\u00A0]558,0/.test(out),'показание форматируется ru-RU');
assert.ok(out.includes('Сутки'),'строка дельты суток');
assert.ok(out.includes('Дата показаний: 08.11'),'readingsDate');
assert.ok(out.includes('energy-reload'),'кнопка обновления');
// stale: пометка «ТНС недоступна» и приглушённая мета.
out=html({reading:{value:29558.04,updatedAt:'2026-11-08T09:10:00.000Z'},consumption:null,deltas:null,readingsDate:'2026-11-08',stale:true});
assert.ok(out.includes('ТНС недоступна'),'stale-пометка');
assert.ok(out.includes('is-stale'),'stale-класс');
assert.ok(out.includes('Расход появится'),'fallback без дельт');
// Нет данных вовсе → null.
assert.equal(html(null),'','нет данных — карточка не рендерится (пусто)');
assert.equal(html({}),'','пустые показания — карточка не рендерится');
// data есть, но значения null → пусто.
assert.equal(html({reading:{value:null},consumption:null,deltas:null,stale:false}),'');
console.log('preact-energy ok');
