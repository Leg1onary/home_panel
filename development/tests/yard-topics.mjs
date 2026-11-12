import assert from 'node:assert/strict';
import {isMotionMessage} from '../server/yard-onvif.js';
import {dayProgressParams,rememberSunrise,storedSunrise,sunriseKey} from '../src/day-arc.js';

// ── 3.4.2: распознавание движения по топикам (yard-onvif) ──
// MotionAlarm + IsMotion true → движение (как у Tapo C320WS).
assert.ok(isMotionMessage('<tev:Topic>tns1:RuleEngine/tnsx:MotionDetected</tev:Topic><tt:SimpleItem Name="IsMotion" Value="true"/>'),'MotionAlarm+IsMotion true');
// VehicleDetect + Value="true" → движение.
assert.ok(isMotionMessage('<tev:Topic>tnsx:VehicleDetect</tev:Topic><tt:SimpleItem Name="IsVehicle" Value="true"/>'),'VehicleDetect true');
// VehicleDetect + Value="false" → НЕ движение (сброс).
assert.ok(!isMotionMessage('<tev:Topic>tnsx:VehicleDetect</tev:Topic><tt:SimpleItem Name="IsVehicle" Value="false"/>'),'VehicleDetect false');
// IsMotion false → НЕ движение.
assert.ok(!isMotionMessage('<tev:Topic>tns1:RuleEngine/tnsx:MotionDetected</tev:Topic><tt:SimpleItem Name="IsMotion" Value="false"/>'),'IsMotion false');
// Неизвестный топик → НЕ движение.
assert.ok(!isMotionMessage('<tev:Topic>tnsx:SomethingElse</tev:Topic><tt:SimpleItem Name="X" Value="true"/>'),'unknown topic');
// Топик известен, значения в теле нет → в сомнении НЕ движение.
assert.ok(!isMotionMessage('<tev:Topic>tnsx:CellMotion</tev:Topic>'),'no value');
// Текстовая форма истины (CellMotion/HumanDetect, >true</).
assert.ok(isMotionMessage('<tt:Data Name="State">true</tt:Data><tev:Topic>tnsx:CellMotion</tev:Topic>'),'CellMotion >true<');
assert.ok(isMotionMessage('<tev:Topic>tns1:Device/HumanDetect</tev:Topic><tt:SimpleItem Name="IsHuman" Value="1"/>'),'HumanDetect Value=1');
assert.ok(!isMotionMessage('<tev:Topic>tnsx:LineCrossing</tev:Topic><tt:SimpleItem Value="0"/>'),'LineCrossing 0');
// Case-insensitive.
assert.ok(isMotionMessage('<TEV:TOPIC>vehicledetect</TEV:TOPIC><TT:SIMPLEITEM NAME="IsVehicle" VALUE="TRUE"/>'),'case-insensitive');

// ── 3.4.2: дуга светового дня — dayProgressParams ──
const DAY=6*3600*1000; // окно 6 часов
assert.equal(dayProgressParams(100,0,1000),10,'внутри окна');
assert.equal(dayProgressParams(0,0,1000),0,'граница начала');
assert.equal(dayProgressParams(1000,0,1000),100,'граница конца');
assert.equal(dayProgressParams(-1,0,1000),null,'раньше окна');
assert.equal(dayProgressParams(1001,0,1000),null,'позже окна');
assert.equal(dayProgressParams(500,500,500),null,'пустое окно');
assert.equal(dayProgressParams(500,1000,0),null,'перевёрнутое окно');
assert.equal(dayProgressParams(NaN,0,1000),null,'мусор now');
assert.equal(dayProgressParams(500,NaN,1000),null,'мусор dawn');
assert.equal(dayProgressParams(500,0,'x'),null,'мусор dusk');
const noon=DAY/2;
assert.equal(dayProgressParams(noon,0,DAY),50,'полдень ~50%');

// ── 3.4.2: запоминание восхода (localStorage-инъекция) ──
const store=new Map();
const storage={getItem:k=>store.has(k)?store.get(k):null,setItem:(k,v)=>{store.set(k,String(v))}};
const now=Date.UTC(2026,10,12,10,0,0);
assert.ok(rememberSunrise('below_horizon','above_horizon',now,storage),'переход ниже→выше запоминается');
assert.equal(storedSunrise(now,storage),now,'записанный восход читается');
assert.equal(sunriseKey(now),'hp-sunrise-2026-11-12','ключ — локальная дата');
assert.ok(!rememberSunrise('above_horizon','below_horizon',now,storage),'обратный переход не пишется');
assert.ok(!rememberSunrise('above_horizon','above_horizon',now,storage),'повтор above не перезаписывает');
store.set(sunriseKey(now),'abc');assert.equal(storedSunrise(now,storage),null,'мусор в хранилище → null');
assert.equal(storedSunrise(now,{getItem:()=>{throw new Error('x')}}),null,'битое хранилище не падает');
