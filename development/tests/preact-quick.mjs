import assert from 'node:assert/strict';
import {h} from '../src/preact/kit.js';
import {QuickContent,QuickWidget,quickBus,quickMarkup} from '../src/preact/quick-widget.js';
import {render} from 'preact-render-to-string';
const deps=cameraId=>({masterBlocked:false,cameraId:cameraId||null,media:false,stationPlaying:false,
 playDisabled:false,prevDisabled:true,nextDisabled:true,stationRoom:'Коридор',stationTitle:'Коридор'});
// Привязка камеры → кнопка с data-camera и подписью «Двор»; «Весь свет» на месте.
let out=render(h(QuickContent,{deps:deps('camera-yard')}));
assert.ok(out.includes('quick-devices'),'контейнер рельсы');
assert.ok(out.includes('data-action="master"'),'кнопка «Весь свет» с data-action');
assert.ok(out.includes('Весь свет')&&out.includes('Выключить'),'подписи главной кнопки');
assert.ok(out.includes('data-camera="camera-yard"'),'привязка камеры сохранена 1:1');
assert.ok(out.includes('Двор')&&out.includes('Камера'),'подписи камеры');
assert.ok(!out.includes('media-shortcut'),'без станции — медиа-кнопок нет');
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
console.log('preact-quick ok');
