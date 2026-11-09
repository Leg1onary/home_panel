import assert from 'node:assert/strict';
import {showYardCard,YARD_MOTION_TAIL,YARD_REFRESH_MS} from '../src/yard-card.js';
const now=Date.now();
// Чип двора честный: реальное движение панельного детектора в 5-минутном окне.
// Свежее движение → true.
assert.equal(showYardCard({motion:true,lastMotionAt:now-30*1000,now,mode:'live'}),true);
assert.equal(showYardCard({motion:true,lastMotionAt:now-YARD_MOTION_TAIL+1000,now,mode:'live'}),true);
// motion=false → false независимо от времени.
assert.equal(showYardCard({motion:false,lastMotionAt:now-30*1000,now,mode:'live'}),false);
assert.equal(showYardCard({motion:undefined,lastMotionAt:now-30*1000,now,mode:'live'}),false);
// Демо → false: демо-кадра камеры не существует, показывать выдумку нельзя.
assert.equal(showYardCard({motion:true,lastMotionAt:now-30*1000,now,mode:'demo'}),false);
// Движение закончилось 5+ мин назад → false (окно наблюдения истекло).
assert.equal(showYardCard({motion:true,lastMotionAt:now-YARD_MOTION_TAIL-1000,now,mode:'live'}),false);
// Неизвестное/сдвинутое в будущее время события → false (нет данных ≠ движение).
assert.equal(showYardCard({motion:true,lastMotionAt:NaN,now,mode:'live'}),false);
assert.equal(showYardCard({motion:true,lastMotionAt:now+10*60*1000,now,mode:'live'}),false);
assert.equal(showYardCard({motion:true,lastMotionAt:null,now,mode:'live'}),false);
// Константы: окно движения 5 мин, обновление кадра не чаще раза в 2 мин.
assert.equal(YARD_MOTION_TAIL,5*60*1000);
assert.equal(YARD_REFRESH_MS,2*60*1000);
console.log('PASS: yard-card — чип только по факту движения панельного детектора ≤5 мин; демо и отсутствие данных никогда не показывают карточку; сдвинутое/неизвестное время события не считается движением.');
