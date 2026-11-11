import assert from 'node:assert/strict';
import {h} from '../src/preact/kit.js';
import {QuickContent,QuickWidget,quickBus,quickMarkup} from '../src/preact/quick-widget.js';
import {StationContent,StationWidget,stationBus} from '../src/preact/station-widget.js';
import {render} from 'preact-render-to-string';
const deps=cameraId=>({masterBlocked:false,cameraId:cameraId||null});
// Привязка камеры → кнопка с data-camera и подписью «Двор»; «Весь свет» на месте.
let out=render(h(QuickContent,{deps:deps('camera-yard')}));
assert.ok(out.includes('quick-devices'),'контейнер рельсы');
assert.ok(out.includes('data-action="master"'),'кнопка «Весь свет» с data-action');
assert.ok(out.includes('Весь свет')&&out.includes('Выключить'),'подписи главной кнопки');
assert.ok(out.includes('data-camera="camera-yard"'),'привязка камеры сохранена 1:1');
assert.ok(out.includes('Двор')&&out.includes('Камера'),'подписи камеры');
assert.ok(!out.includes('media-shortcut')&&!out.includes('station-play'),'3.3.14: плеера в рельсе нет');
// Без камеры → камеры нет; master-кнопка остаётся.
out=render(h(QuickContent,{deps:deps()}));
assert.ok(!out.includes('camera-shortcut'),'пустая привязка — камеры нет');
assert.ok(out.includes('data-action="master"'),'мастер-кнопка сохраняется');
// Пусто (виджет до notify) → null.
assert.equal(render(h(QuickWidget)),'','виджет без deps рендерит null');
// Шина с replay: подписка после notify получает последний payload.
let seen=null;
quickBus.notify(deps('camera-yard'));
quickBus.sub(d=>{seen=d});
assert.ok(seen.cameraId==='camera-yard','quickBus доставляет payload с replay');
// 3.3.14: компактная карточка станции — трек, play/pause, skip, демо-лейбл.
const st={playing:true,title:'Эхо Москвы',room:'Коридор',demo:false,playDisabled:false,prevDisabled:false,nextDisabled:false};
out=render(h(StationContent,{deps:st}));
assert.ok(out.includes('station-compact'),'контейнер карточки станции');
assert.ok(out.includes('Станция · Коридор'),'заголовок с комнатой');
assert.ok(out.includes('Эхо Москвы')&&out.includes('eq-bars'),'трек и эквалайзер при игре');
assert.ok(out.includes('data-action="station-play"')&&out.includes('data-action="station-next"')&&out.includes('data-action="station-previous"'),'контролы через существующие data-action');
assert.ok(out.includes('data-lucide="pause"'),'playing → пауза');
assert.ok(!out.includes('Пауза на станции')||out.includes('aria-label="Пауза"'),'aria переключается');
out=render(h(StationContent,{deps:{...st,playing:false,demo:true,playDisabled:true,title:'Демо'}}));
assert.ok(out.includes('Демо'),'демо-лейбл');
assert.ok(out.includes('data-lucide="play"'),'пауза → play');
assert.ok(out.includes('disabled'),'заблокированная кнопка честно disabled');
assert.ok(render(h(StationWidget))==='','виджет без deps рендерит null');
seen=null;
stationBus.notify(st);
stationBus.sub(d=>{seen=d});
assert.ok(seen.title==='Эхо Москвы','stationBus доставляет payload с replay');
console.log('preact-quick ok');
