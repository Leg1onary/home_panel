import assert from 'node:assert/strict';
import {h} from '../src/preact/kit.js';
import {FactsContent,FactsWidget,factsBus,factsMarkup,yardMarkup} from '../src/preact/facts-widget.js';
import {render} from 'preact-render-to-string';
const devices=installed=>[{id:'terrace-door',status:installed?'installed':'planned'}];
const deps=over=>({devices:devices(true),door:'Закрыта',terrace:'Закрыта',well:'16,5 °C',attic:'Нет данных',live:false,yard:null,...over});
// Дверь закрыта → 'Входная' 'Закрыта' и прежние data-атрибуты.
let out=render(h(FactsContent,{deps:deps()}));
assert.ok(out.includes('home-fact'),'класс .home-fact сохранён');
assert.ok(out.includes('Входная')&&out.includes('Закрыта'),'входная дверь закрыта');
assert.ok(out.includes('data-action="door"'),'кнопка двери с data-action');
assert.ok(out.includes('aria-label="Входная дверь: Закрыта"'),'aria двери');
assert.ok(out.includes('data-action="terrace-door"')&&out.includes('Терраса'),'дверь террасы');
assert.ok(out.includes('data-sensor="well"')&&out.includes('Скважина')&&out.includes('16,5 °C'),'скважина');
assert.ok(out.includes('data-sensor="attic"')&&out.includes('Чердак'),'чердак');
// Датчик без данных → is-faint + «Нет данных».
assert.ok(out.includes('is-faint'),'faint-датчик помечен');
assert.ok((out.match(/Нет данных/g)||[]).length===1,'один faint-датчик');
// Открытая дверь → needs-attention.
assert.ok(render(h(FactsContent,{deps:deps({door:'Открыта'})})).includes('needs-attention'),'открытая дверь — внимание');
// Демо-лейбл: «Закрыта · демо» проходит насквозь.
out=render(h(FactsContent,{deps:deps({door:'Закрыта · демо',terrace:'Закрыта · демо'})}));
assert.ok(out.includes('· демо'),'демо-лейбл');
// Терраса не установлена → факта террасы нет.
assert.ok(!render(h(FactsContent,{deps:deps({devices:devices(false)})})).includes('terrace-door'),'без террасы');
// Двор-чип: разметка 1:1 с прежним yardMarkup.
const yard={data:{available:true,motion:true,lastMotionAt:Date.now()-60000},when:'10:44',mode:'live',now:Date.now()};
out=yardMarkup(yard);
assert.ok(out.includes('yard-chip')&&out.includes('data-camera="camera-yard"'),'двор-чип');
assert.ok(out.includes('Движение · 10:44'),'время движения');
assert.ok(!yardMarkup({...yard,data:{available:false}}),'недоступный детектор — чипа нет');
// Шина с replay.
let seen=null;
factsBus.notify(deps());
factsBus.sub(d=>{seen=d});
assert.ok(seen.door==='Закрыта','factsBus доставляет payload');
// Виджет до notify → null.
assert.equal(render(h(FactsWidget)),'','виджет без deps рендерит null');
console.log('preact-facts ok');
