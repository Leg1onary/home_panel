import assert from 'node:assert/strict';
import {h} from '../src/preact/kit.js';
import {RoomCardWidget,RoomSheetWidget,RoomCardContent,RoomSheetContent,roomBus,roomCardMarkup,sheetMarkup} from '../src/preact/room-widget.js';
import {render} from 'preact-render-to-string';
const row=over=>({id:'living:0',name:'Зона гостиной',on:false,planned:false,note:'Ближе к террасе',unknown:false,blocked:false,busy:false,phase:null,...over});
const cardDeps=over=>({room:{id:'living',name:'Гостиная / кухня',icon:'sofa'},climate:'',rows:[row({on:true})],...over});
// Карточка: включённая линия → тоггл с data-device/data-mini, aria-checked=true.
let out=roomCardMarkup(cardDeps());
assert.ok(out.includes('room-card')||out.includes('mini-head'),'карточка рендерится');
assert.ok(out.includes('aria-label="Карточка комнаты Гостиная / кухня"'),'aria карточки');
assert.ok(out.includes('data-device="living:0"')&&out.includes('data-mini="1"'),'тоггл с data-device/data-mini');
assert.ok(out.includes('aria-checked="true"'),'включённая линия aria-checked');
assert.ok(out.includes('Зона гостиной'),'название линии');
assert.ok(out.includes('data-action="close-room-card"'),'кнопка закрытия');
assert.ok(out.includes('data-room="living"'),'кнопка открытия комнаты');
// Выключенная линия → aria-checked=false; unknown-канал → без role/aria-checked.
assert.ok(roomCardMarkup(cardDeps({rows:[row()]})).includes('aria-checked="false"'),'выключенная линия');
const unknown=roomCardMarkup(cardDeps({rows:[row({unknown:true,blocked:true})]}));
assert.ok(!unknown.includes('role="switch"')&&unknown.includes('нет подтверждённого состояния'),'unknown-канал');
// Строка ошибки команды → phaseLine с retry.
const err=roomCardMarkup(cardDeps({rows:[row({phase:{id:'living:0',phase:'error',message:'Нет связи · демонстрация',confirmedAt:0}})]}));
assert.ok(err.includes('command-status error')&&err.includes('data-retry="living:0"')&&err.includes('Повторить'),'phaseLine ошибки');
// Пустые deps → пустая строка (null-рендер виджета).
assert.equal(roomCardMarkup(null),'','card: нет deps');
assert.equal(roomCardMarkup({rows:[]}),'','card: нет комнаты');
assert.ok(roomCardMarkup(cardDeps({rows:[]})).includes('mini-empty'),'комната без света');
// Щиток: две линии, одна включена.
const sheetDeps=over=>({room:{id:'living',name:'Гостиная / кухня',short:'Гостиная',description:'Две зоны одного пространства'},rows:[row({on:true}),row({id:'living:1',name:'Зона кухни',on:false})],rgb:null,...over});
out=sheetMarkup(sheetDeps());
assert.ok(out.includes('eyebrow')&&out.includes('Гостиная'),'шапка щитка');
assert.ok(out.includes('data-device="living:0"')&&out.includes('data-device="living:1"'),'data-device обеих линий');
assert.ok(out.includes('aria-checked="true"')&&out.includes('aria-checked="false"'),'состояния тогглов');
assert.ok(out.includes('Зона кухни')&&out.includes('Две зоны одного пространства'),'названия и описание');
assert.ok(!out.includes('id="brightness"'),'без RGB — без слайдера');
// Прихожая с RGB: слайдер яркости и свотчи с data-color.
const rgb={name:'RGB-лампа',note:'Включена · Yeelight',powered:true,toggle:{name:'RGB-лампа',on:true,unknown:false,busy:false,blocked:false},
 brightLabel:'75 % · Home Assistant',brightness:75,brightBlocked:false,
 swatches:[{color:'#e6c68c',label:'Тёплый',selected:true,blocked:false},{color:'#eef1e5',label:'Белый',selected:false,blocked:false}],
 phases:{on:null,bright:null,color:null}};
out=sheetMarkup({...sheetDeps(),room:{id:'hall',name:'Прихожая',short:'Прихожая',description:''},rows:[],rgb});
assert.ok(out.includes('id="brightness"')&&out.includes('type="range"')&&out.includes('value="75"'),'слайдер яркости');
assert.ok(out.includes('for="brightness"')&&out.includes('brightness-label'),'label слайдера');
assert.ok((out.match(/data-color=/g)||[]).length===2,'свотчи data-color');
assert.ok(out.includes('data-action="rgb"')&&out.includes('aria-checked="true"'),'тоггл RGB');
assert.ok(out.includes('empty-room-note'),'нет линий — пометка');
// Коридор/прихожая: текстовые кнопки.
assert.ok(sheetMarkup({...sheetDeps(),corridorUnbound:true}).includes('corridor-binding'),'коридор-биндинг');
assert.ok(sheetMarkup({...sheetDeps(),hallTerrace:true}).includes('data-room="terrace"'),'кнопка террасы');
assert.equal(sheetMarkup(null),'','sheet: нет deps');
// Шина с replay: подписка после notify получает последний payload.
let seen=null;
roomBus.notify({card:cardDeps(),sheet:null});
roomBus.sub(d=>{seen=d});
assert.ok(seen.card.rows[0].on,'roomBus replay');
// Виджеты: без deps → null, с deps → разметка.
assert.equal(render(h(RoomCardWidget)),'','карточка без deps — null');
assert.equal(render(h(RoomSheetWidget)),'','щиток без deps — null');
assert.ok(render(h(RoomCardContent,{deps:cardDeps()})).includes('data-device="living:0"'),'карточка рендерит тогглы');
assert.ok(render(h(RoomSheetContent,{deps:sheetDeps()})).includes('data-device="living:1"'),'щиток рендерит тогглы');
console.log('preact-room ok');