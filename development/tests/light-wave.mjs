import assert from 'node:assert/strict';
import {parseBrightness,scheduleWave} from '../src/light-wave.js';
import {rooms} from '../src/schema.js';
import {sendCommand} from '../src/commands.js';

// parseBrightness: чистая функция — clamp 1..100.
assert.equal(parseBrightness(50),50);
assert.equal(parseBrightness('75'),75);
assert.equal(parseBrightness(0),1,'0 → 1');
assert.equal(parseBrightness(-5),1,'отрицательное → 1');
assert.equal(parseBrightness(150),100,'150 → 100');
assert.equal(parseBrightness('abc'),1,'мусор → 1');
assert.equal(parseBrightness(49.6),50,'округление');
assert.equal(parseBrightness(undefined),1,'undefined → 1');

// scheduleWave: порядок групп и интервал 300 мс, внутри группы — параллельно.
const fakeTimers=[];
const fakeSetTimeout=(fn,ms)=>{fakeTimers.push({fn,ms});return fakeTimers.length};
const fakeClearTimeout=id=>{const t=fakeTimers.find(t=>t.id===id);if(t)t.cancelled=true};
const fired=[];
const run=item=>{fired.push(item);return Promise.resolve(true)};
const jobs=[['a1','a2'],['b1'],['c1','c2']];
const wave=scheduleWave(jobs,run,{step:300,setTimeout:fakeSetTimeout,clearTimeout:fakeClearTimeout});
// Ничего не выполнено до тика таймеров.
assert.equal(fired.length,0);
const flush=async()=>{
 let guard=0;
 while(fakeTimers.some(t=>!t.cancelled&&t.fn)&&guard++<100){
  const next=fakeTimers.filter(t=>!t.cancelled&&t.fn).sort((x,y)=>x.ms-y.ms)[0];
  next.cancelled=true;next.fn();
  await Promise.resolve();
 }
};
await flush();
assert.deepEqual(fired.slice(0,2),['a1','a2'],'первая группа сразу');
assert.ok(fakeTimers.every(t=>t.cancelled||[0,300,600].includes(t.ms)),'интервалы 0/300/600');
const results=await wave.all();
assert.deepEqual(results,[true,true,true,true,true],'все ack true');
assert.deepEqual(fired,['a1','a2','b1','c1','c2'],'порядок комнат сохранён');

// cancel: невыпущенные группы не срабатывают, но их промахи резолвятся false (без висящих await).
const wave2=scheduleWave([['x'],['y']],run,{step:300,setTimeout:fakeSetTimeout,clearTimeout:fakeClearTimeout});
wave2.cancel();
const results2=await wave2.all();
assert.ok(!fired.includes('y'),'отменённая группа не выполнена');
assert.deepEqual(results2,[false,false],'cancel → false, промисы не висят');

// Демо-интеграция: волна через sendCommand — все линии off, дубликаты исключены.
for(const r of rooms)r.channels.forEach(c=>{c.on=!c.planned&&c.masterOff!==false});
const groups=rooms.map(r=>r.channels.filter(c=>c.on&&!c.planned)).filter(g=>g.length);
assert.ok(groups.length>=3,'есть что гасить');
const before=groups.reduce((n,g)=>n+g.length,0);
const demoWave=scheduleWave(groups,c=>sendCommand(c.id,false,v=>{c.on=v},()=>{}),{step:0});
const demoResults=await demoWave.all();
assert.equal(demoResults.every(Boolean),true,'демо ack все линии');
assert.equal(groups.reduce((n,g)=>n+g.filter(c=>c.on).length,0),0,'все линии off');
assert.equal(demoResults.length,before,'по одной команде на линию, без дублей');
console.log('light-wave ok');