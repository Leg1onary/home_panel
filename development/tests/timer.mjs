import assert from 'node:assert/strict';
// 3.9.5: бытовой таймер — чистая логика из src/timer.js.
import {parseTimerInput,timerLeft,timerExpired,timerEssence,fmtTimerLeft,timerPhrase,TIMER_MIN,TIMER_MAX} from '../src/timer.js';
// разбор ввода
assert.equal(parseTimerInput('10'),10,'просто число');
assert.equal(parseTimerInput(' 7 '),7,'с пробелами');
assert.equal(parseTimerInput('90 с'),1.5,'секунды → минуты');
assert.equal(parseTimerInput('90 сек'),1.5,'сек с суффиксом');
assert.equal(parseTimerInput('30м'),30,'суффикс м');
assert.equal(parseTimerInput('0'),null,'меньше минимума');
assert.equal(parseTimerInput('601'),null,'больше максимума');
assert.equal(parseTimerInput('9 с'),null,'меньше 10 секунд');
assert.equal(parseTimerInput('abc'),null,'мусор');
assert.equal(parseTimerInput(''),null,'пусто');
assert.equal(TIMER_MIN,1,'границы');
assert.equal(TIMER_MAX,600,'границы');
// остаток и истечение
const now=1_000_000;
const t={duration:10,until:now+65_000,label:'Каша'};
assert.equal(timerLeft(t,now),65_000,'остаток мс');
assert.equal(timerLeft(null,now),0,'нет таймера → 0');
assert.equal(timerExpired(t,now),false,'не истёк');
assert.equal(timerExpired(t,now+65_001),true,'истёк');
assert.equal(timerExpired({duration:1,until:'мусор'},now),true,'битый until → истёк');
// формат
assert.equal(fmtTimerLeft(65_000),'1:05','М:СС');
assert.equal(fmtTimerLeft(600_000),'10:00','ровно 10 мин');
assert.equal(fmtTimerLeft(45_000),'45 с','меньше минуты');
assert.equal(fmtTimerLeft(0),null,'ноль → null');
assert.equal(fmtTimerLeft(-5),null,'отрицательный → null');
assert.equal(timerEssence(t,now),'Осталось 1:05','essence активного');
assert.equal(timerEssence(t,now+70_000),null,'essence истёкшего');
// фраза для станции (≤100 символов)
assert.equal(timerPhrase(t),'Время вышло! Таймер на 10 минут «Каша»','фраза с меткой');
assert.equal(timerPhrase({duration:7}),'Время вышло! Таймер на 7 минут','фраза без метки');
assert.equal(timerPhrase({duration:1.5}),'Время вышло! Таймер на 1,5 минут','дробные минуты');
assert.equal(timerPhrase(null),'Время вышло!','битый таймер → короткая фраза');
assert.ok(timerPhrase({duration:600,label:'x'.repeat(80)}).length<=100,'фраза ≤100 символов');
console.log('timer: ok');
// 3.9.6: сон-таймер света.
import {sleepUntil,sleepExpired,sleepEssence,sleepPhrase} from '../src/timer.js';
const st=sleepUntil(30,now);
assert.equal(st.duration,30,'sleepUntil: минуты');
assert.equal(st.until,now+30*60000,'sleepUntil: until абсолютный');
assert.equal(sleepUntil('abc',now),null,'sleepUntil: мусор → null');
assert.equal(sleepExpired(st.until,now),false,'не истёк');
assert.equal(sleepExpired(st.until,now+30*60000+1),true,'истёк');
assert.equal(sleepExpired(undefined,now),true,'нет until → считается истёкшим');
assert.equal(sleepEssence(st.until,now),'Свет погаснет через 30:00','essence');
assert.equal(sleepEssence(st.until,now+31*60000),null,'essence после истечения');
assert.equal(sleepPhrase(30),'Отработал таймер: свет выключен. Был на 30 минут','фраза');
assert.equal(sleepPhrase(1.5),'Отработал таймер: свет выключен. Был на 1,5 минут','дробные');
assert.equal(sleepPhrase('мусор'),'Свет выключен.','мусор → короткая фраза');
assert.ok(sleepPhrase(600).length<=100,'фраза ≤100');
console.log('timer: ok (sleep)');

