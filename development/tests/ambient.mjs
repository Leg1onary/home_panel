import assert from 'node:assert/strict';
import {shouldAmbient,AMBIENT_AFTER_IDLE} from '../src/ambient.js';
// Выключен настройкой — ambient не наступает никогда.
assert.equal(shouldAmbient({enabled:false,lastActivity:0,now:10*60*1000}),false);
// 60 секунд неактивности при задержке 60 с → ambient.
assert.equal(shouldAmbient({enabled:true,idleSeconds:60,lastActivity:0,now:60*1000}),true);
// Ещё не прошло — обычный режим.
assert.equal(shouldAmbient({enabled:true,idleSeconds:60,lastActivity:0,now:59*1000}),false);
// Активность сбрасывает: свежий lastActivity → false.
assert.equal(shouldAmbient({enabled:true,idleSeconds:60,lastActivity:59*1000,now:60*1000}),false);
// Задержка ожидания 0 (режим ожидания выключен) → ambient нет.
assert.equal(shouldAmbient({enabled:true,idleSeconds:0,lastActivity:0,now:60*60*1000}),false);
// Мусорные входы не включают ambient.
assert.equal(shouldAmbient({enabled:true,idleSeconds:NaN,lastActivity:0,now:1e12}),false);
assert.equal(shouldAmbient({enabled:true,idleSeconds:60,lastActivity:'x',now:1e12}),false);
assert.equal(shouldAmbient({enabled:true,idleSeconds:60,lastActivity:0,now:NaN}),false);
// Константа глубокой ступени существует и разумна.
assert.equal(typeof AMBIENT_AFTER_IDLE,'number');
assert.ok(AMBIENT_AFTER_IDLE>0&&AMBIENT_AFTER_IDLE<600);
// По умолчанию 90 секунд (согласовано с defaultPreferences).
assert.equal(shouldAmbient({lastActivity:0,now:90*1000}),true);
console.log('ambient: ok');