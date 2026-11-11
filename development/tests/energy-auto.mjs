import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import http from 'node:http';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';

// 3.2.7: авто-пополнение energy_readings из свежего съёма ТНС. Fake HA отдаёт
// показания (reading + readings_date), сервер сам дополняет историю профиля:
// дубли не создаются, новая дата добавляется, откат счётчика игнорируется.
const dir=await mkdtemp(join(tmpdir(),'home-panel-energy-auto-'));
const meter={reading:'29558',date:'2026-10-26'};
const state=(id,v)=>({entity_id:id,state:v,attributes:{},last_updated:new Date().toISOString(),last_changed:new Date().toISOString()});
const fake=http.createServer((req,res)=>{
 if(req.headers.authorization!=='Bearer mock-test-only'){res.writeHead(401);return res.end('{}')}
 res.setHeader('Content-Type','application/json');
 if(req.url.startsWith('/api/history/period/'))return res.end('[]');
 res.end(JSON.stringify([
  state('sensor.schetchik_no11080509_reading',meter.reading),
  state('sensor.schetchik_no11080509_consumption','45.2'),
  state('sensor.schetchik_no11080509_meter_number','11080509'),
  state('sensor.schetchik_no11080509_readings_date',meter.date),
  state('weather.home','cloudy')
 ]));
});
await new Promise(r=>fake.listen(3026,'127.0.0.1',r));
const child=spawn(process.execPath,['release/server.mjs'],{cwd:resolve('.'),
 env:{...process.env,PORT:'3025',PANEL_DATA:dir,HA_URL:'http://127.0.0.1:3026',HA_TOKEN:'mock-test-only',PANEL_PREVIEW:'0'},
 stdio:['ignore','pipe','pipe']});
try{
 await new Promise((ok,fail)=>{
  const timer=setTimeout(()=>fail(new Error('Server startup timeout')),10000);
  child.stdout.on('data',b=>{if(String(b).includes('Panel ready')){clearTimeout(timer);ok()}});
  child.once('exit',()=>{clearTimeout(timer);fail(new Error('Server exited'))});
 });
 let proof;
 const call=async path=>{
  const r=await fetch('http://127.0.0.1:3025/api/panel/'+path,{headers:{'X-Panel-Proof':proof}});
  return {status:r.status,body:await r.json()};
 };
 {
  const b=await call('bootstrap');proof=b.body.proof;
  const p=b.body.preferences;
  // Стенд: 8 показаний, максимум 2026-10-26 = 29558 (уже внесён через PUT).
  p.mode='live';
  p.energy_readings=[
   {date:'2026-03-25',value:27010},{date:'2026-04-25',value:27380},{date:'2026-05-25',value:27760},
   {date:'2026-06-25',value:28120},{date:'2026-07-25',value:28500},{date:'2026-08-25',value:28870},
   {date:'2026-09-25',value:29210},{date:'2026-10-26',value:29558}];
  p.energy_tariff=4.68;
  const r=await fetch('http://127.0.0.1:3025/api/panel/preferences',{method:'PUT',
   headers:{'Content-Type':'application/json','X-Panel-Proof':proof},body:JSON.stringify(p)});
  assert.equal(r.status,200);
  assert.equal((await r.json()).preferences.energy_readings.length,8);
 }
 // 1. Тот же съём (2026-10-26, 29558): дубли НЕ создаются — остаётся 8.
 meter.reading='29558';meter.date='2026-10-26';
 let e=await call('ha/energy');
 assert.equal(e.status,200);
 assert.equal(e.body.reading.value,29558);
 // prev — строго раньше даты съёма: 2026-09-25, а не одноимённая запись 2026-10-26.
 assert.equal(e.body.month.prevValue,29210);
 assert.equal(e.body.month.prevDate,'2026-09-25');
 {
  const b=await call('bootstrap');
  assert.equal(b.body.preferences.energy_readings.length,8,'Same date must not duplicate');
  assert.equal(b.body.preferences.energy_readings.at(-1).value,29558);
 }
 // 2. Новый съём (2026-11-25, 29600): список стал 9, месяц prev 29558 → delta 42.
 meter.reading='29600';meter.date='2026-11-25';
 e=await call('ha/energy');
 assert.equal(e.status,200);
 assert.equal(e.body.month.prevValue,29558,'Month prev is the previous reading');
 assert.equal(e.body.month.delta,42,'29600 − 29558 = 42');
 assert.equal(e.body.month.prevDate,'2026-10-26');
 {
  const b=await call('bootstrap');
  const readings=b.body.preferences.energy_readings;
  assert.equal(readings.length,9,'New TNS reading is auto-appended');
  assert.deepEqual(readings.at(-1),{date:'2026-11-25',value:29600});
  // Отсортирован по дате, без дублей.
  assert.deepEqual([...readings].sort((a,c)=>a.date<c.date?-1:1),readings);
 }
 // 3. Откат счётчика (2026-10-01, 29500): список не меняется.
 meter.reading='29500';meter.date='2026-10-01';
 e=await call('ha/energy');
 assert.equal(e.status,200);
 {
  const b=await call('bootstrap');
  assert.equal(b.body.preferences.energy_readings.length,9,'Meter rollback is ignored');
  assert.equal(b.body.preferences.energy_readings.at(-1).date,'2026-11-25');
 }
 // 4. Та же дата с уточнённым значением: 2026-11-25 = 29605 — запись обновляется.
 meter.reading='29605';meter.date='2026-11-25';
 e=await call('ha/energy');
 assert.equal(e.status,200);
 {
  const b=await call('bootstrap');
  const readings=b.body.preferences.energy_readings;
  assert.equal(readings.length,9,'Same-date update does not add a row');
  assert.deepEqual(readings.at(-1),{date:'2026-11-25',value:29605});
 }
 assert.equal((await call('ha/energy')).body.month.delta,47);
 console.log('PASS: TNS readings auto-append — no duplicate for same date, new later date appended and month recalculated, rollback ignored, same-date refinement updates the value.');
}finally{
 if(child&&!child.killed&&child.exitCode===null){const end=new Promise(r=>child.once('exit',r));child.kill('SIGTERM');await end}
 fake.close();
 await rm(dir,{recursive:true,force:true});
}