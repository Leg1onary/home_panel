import assert from 'node:assert/strict';
import {showYardCard,YARD_MOTION_TAIL,YARD_REFRESH_MS} from '../src/yard-card.js';
const now=Date.now();
// Чип двора честный: только проверенный биндинг + активное движение в 5-минутном окне.
// verified + свежее движение → true.
assert.equal(showYardCard({bindingVerified:true,motionState:'active',lastEventAt:now-30*1000,now,mode:'live'}),true);
assert.equal(showYardCard({bindingVerified:true,motionState:'active',lastEventAt:now-YARD_MOTION_TAIL+1000,now,mode:'live'}),true);
// Биндинг не проверен → false, даже если движение активно.
assert.equal(showYardCard({bindingVerified:false,motionState:'active',lastEventAt:now-30*1000,now,mode:'live'}),false);
assert.equal(showYardCard({bindingVerified:undefined,motionState:'active',lastEventAt:now-30*1000,now,mode:'live'}),false);
// Демо → false: демо-кадра камеры не существует, показывать выдумку нельзя.
assert.equal(showYardCard({bindingVerified:true,motionState:'active',lastEventAt:now-30*1000,now,mode:'demo'}),false);
// Движение закончилось 5+ мин назад → false (окно наблюдения истекло).
assert.equal(showYardCard({bindingVerified:true,motionState:'active',lastEventAt:now-YARD_MOTION_TAIL-1000,now,mode:'live'}),false);
assert.equal(showYardCard({bindingVerified:true,motionState:'expired',lastEventAt:now-6*60*1000,now,mode:'live'}),false);
assert.equal(showYardCard({bindingVerified:true,motionState:'idle',lastEventAt:now-30*1000,now,mode:'live'}),false);
assert.equal(showYardCard({bindingVerified:true,motionState:'unknown',lastEventAt:now-30*1000,now,mode:'live'}),false);
// Неизвестное/сдвинутое в будущее время события → false (нет данных ≠ движение).
assert.equal(showYardCard({bindingVerified:true,motionState:'active',lastEventAt:NaN,now,mode:'live'}),false);
assert.equal(showYardCard({bindingVerified:true,motionState:'active',lastEventAt:now+10*60*1000,now,mode:'live'}),false);
assert.equal(showYardCard({bindingVerified:true,motionState:'active',lastEventAt:null,now,mode:'live'}),false);
// Константы: окно движения 5 мин, обновление кадра не чаще раза в 2 мин.
assert.equal(YARD_MOTION_TAIL,5*60*1000);
assert.equal(YARD_REFRESH_MS,2*60*1000);
console.log('PASS: yard-card — чип только при verified-биндинге и активном движении ≤5 мин; демо и непроверенные привязки никогда не показывают карточку; сдвинутое/неизвестное время события не считается движением.');
