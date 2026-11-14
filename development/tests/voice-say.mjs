import assert from 'node:assert/strict';
import {voiceEnabled,armPhrase,disarmPhrase,cancelExitPhrase,doorOpenPhrase} from '../src/voice-phrases.js';
// 3.8.0 «Дом говорит»: фразы ≤100 символов (лимит ha.announce).
for(const [name,f] of [['arm',()=>armPhrase(120)],['arm0',()=>armPhrase(0)],['disarm',disarmPhrase],['cancel',cancelExitPhrase],['door',()=>doorOpenPhrase('Входная дверь')]]){
 const t=f();
 assert.ok(t.length<=100,name+': длиннее 100 — '+t.length);
 assert.ok(t.length>3,name+': пустая фраза');
}
assert.match(armPhrase(120),/через 2 минуты/,'2 минуты из 120 с');
assert.match(armPhrase(60),/через 1 минуту/,'1 минута из 60 с');
assert.match(armPhrase(240),/через 4 минуты/,'4 минуты из 240 с');
assert.equal(doorOpenPhrase('Входная дверь'),'Внимание, открыта входная дверь','нижний регистр имени');
// Гейт: voiceAnnounce===false → молчим; отсутствие ключа → говорим (совместимость).
assert.equal(voiceEnabled({voiceAnnounce:false}),false);
assert.equal(voiceEnabled({}),true);
assert.equal(voiceEnabled(null),true);
