import assert from 'node:assert/strict';
import {voiceEnabled,voiceQuiet,shouldSpeak,armPhrase,disarmPhrase,cancelExitPhrase,doorOpenPhrase} from '../src/voice-phrases.js';
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
// 3.9.0 «Вежливый голос»: ночью молчим (кроме срочных), фраза не чаще раза в 10 мин.
const S='23:00',E='07:00',prefsNight={nightStart:S,nightEnd:E};
assert.equal(voiceQuiet(prefsNight,3*60),true,'03:00 — тихо');
assert.equal(voiceQuiet(prefsNight,23*60+30),true,'23:30 — тихо');
assert.equal(voiceQuiet(prefsNight,12*60),false,'полдень — говорим');
assert.equal(voiceQuiet(prefsNight,6*60+59),true,'06:59 — ещё тихо');
assert.equal(voiceQuiet({},12*60),false,'без ночного окна — не тихо');
assert.equal(shouldSpeak('x',0,1000),true,'первый раз — говорим');
assert.equal(shouldSpeak('x',900,1000,60000),false,'только что говорили — молчим');
assert.equal(shouldSpeak('x',1000-61000,1000,60000),true,'прошло 61 с из 60 — говорим');
assert.equal(shouldSpeak('x',1000-59999,1000,60000),false,'59.9 с — ещё молчим');
// срочные фразы (дверь) не гейтятся тихими часами — это проверяет сервер; тут чистый контракт quiet.
assert.notEqual(doorOpenPhrase(),undefined);
