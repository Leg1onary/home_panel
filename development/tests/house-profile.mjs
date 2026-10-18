import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import http from 'node:http';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
import Database from 'better-sqlite3';
import {defaultPreferences,validatePreferences} from '../src/preferences.js';
import {migrateHouseProfile,activateHouseProfile,houseBindings,bindingProblem} from '../src/house-profile.js';
import {deviceTypes} from '../src/catalog.js';
import {detachChannel} from '../src/device-model.js';

const old=defaultPreferences();
delete old.housePresetVersion;
old.theme='light';old.favorites=['hall'];old.kiosk=true;
old.devices.find(d=>d.id==='bath:1').status='planned';
old.bindings['living:0']={entityId:'switch.my_custom',verified:true};
old.devices.find(d=>d.id==='living:0').name='Моё название';
const p=migrateHouseProfile(old);
assert.equal(old.devices.find(d=>d.id==='bath:1').status,'planned');
assert.equal(p.devices.find(d=>d.id==='bath:1').status,'installed');
assert.equal(p.theme,'light');assert.equal(p.kiosk,true);assert.deepEqual(p.favorites,['hall']);
assert.equal(p.bindings['living:0'].entityId,'switch.my_custom');
assert.equal(p.bindings['living:0'].verified,true);
assert.equal(p.devices.find(d=>d.id==='living:0').name,'Моё название');
assert.equal(p.devices.find(d=>d.id==='hall:1').room,'terrace');
assert.equal(p.devices.some(d=>d.id==='pump'),false);
assert.equal(migrateHouseProfile(p),p);
assert.equal(p.housePresetVersion,3);
assert.equal(p.devices.filter(d=>d.type==='battery').length,6);
const deleted=defaultPreferences();deleted.devices=deleted.devices.filter(d=>d.id!=='living:1');
assert.equal(migrateHouseProfile(deleted).devices.some(d=>d.id==='living:1'),false);
const customPump=defaultPreferences();customPump.bindings.pump={entityId:'switch.owner_pump',verified:true};
assert.ok(migrateHouseProfile(customPump).devices.some(d=>d.id==='pump'));
assert.equal(validatePreferences(p,{importing:true}).bindings['living:0'].verified,false);
const previous=structuredClone(p);
previous.housePresetVersion=1;previous.mode='live';previous.houseProfileConfirmed=false;
previous.bindings['temperature:living']={entityId:'sensor.a4c1383cc159_temperature',verified:true};
previous.bindings['humidity:living']={entityId:'sensor.a4c1383cc159_humidity',verified:true};
previous.bindings['temperature:well']={entityId:'sensor.a4c1386265b5_temperature',verified:false};
previous.bindings['humidity:well']={entityId:'sensor.a4c1386265b5_humidity',verified:false};
previous.bindings['battery:living']={entityId:'sensor.a4c1383cc159_battery',verified:true};
previous.bindings['battery:well']={entityId:'sensor.a4c1386265b5_battery',verified:true};
previous.devices=previous.devices.filter(d=>d.id!=='yard-motion');
previous.deviceModel=detachChannel(previous.deviceModel,'yard-motion');
const migrated=migrateHouseProfile(previous);
for(const id of ['temperature:living','humidity:living','temperature:well','humidity:well','battery:living','battery:well']){
 assert.equal(migrated.bindings[id].entityId,houseBindings[id]);assert.equal(migrated.bindings[id].verified,false);
}
assert.equal(migrated.houseProfileConfirmed,true);
assert.equal(migrated.devices.some(d=>d.id==='yard-motion'),false,'Do not resurrect deleted devices in v2');
assert.equal(migrated.bindings.door.entityId,'binary_sensor.e4aaec90027a_contact');
assert.equal(validatePreferences(migrated,{importing:true}).houseProfileConfirmed,false);
const customClimate=structuredClone(previous);customClimate.bindings['temperature:living']={entityId:'sensor.owner_temperature',verified:true};
assert.equal(migrateHouseProfile(customClimate).bindings['temperature:living'].entityId,'sensor.owner_temperature');
assert.equal(migrateHouseProfile(migrated),migrated);

const clean=migrateHouseProfile(defaultPreferences()),states=clean.devices.filter(d=>houseBindings[d.id]).map(d=>{
 const t=deviceTypes[d.type],domain=houseBindings[d.id].split('.')[0];
 return {entity_id:houseBindings[d.id],state:d.type==='camera'||d.type==='station'?'idle':d.type==='button_event'?'click':domain==='sensor'?(t.unit?'65':'not_detected'):'off',
  last_reported:new Date().toISOString(),last_updated:new Date().toISOString(),
  attributes:{...(t.unit?{unit_of_measurement:t.unit}:{}),...(t.classes?{device_class:domain==='sensor'?'enum':t.classes[0]}:{})}};
});
const all=activateHouseProfile(clean,states);
assert.equal(all.report.length,33);assert.equal(all.report.every(r=>r.ok),true);
assert.equal(all.preferences.mode,'live');
const v2=structuredClone(all.preferences);v2.housePresetVersion=2;
v2.bindings['camera-yard']={entityId:'camera.c320ws_mainstream',verified:true};
// A deliberate manual climate choice after v2 must not be re-migrated.
v2.bindings['temperature:living']={entityId:'sensor.a4c1383cc159_temperature',verified:true};
const cameraUpgrade=migrateHouseProfile(v2);
assert.deepEqual(cameraUpgrade.bindings['camera-yard'],{entityId:'camera.dvor_kamera_dvor_live_view',verified:false});
assert.equal(cameraUpgrade.bindings['temperature:living'].entityId,'sensor.a4c1383cc159_temperature');
assert.equal(cameraUpgrade.bindings['temperature:living'].verified,true);
assert.deepEqual(cameraUpgrade.bindings.door,v2.bindings.door);
assert.equal(cameraUpgrade.houseProfileConfirmed,true);
assert.equal(migrateHouseProfile(cameraUpgrade),cameraUpgrade);
const manualCamera=structuredClone(v2);
manualCamera.bindings['camera-yard']={entityId:'camera.owner_custom',verified:true};
assert.deepEqual(migrateHouseProfile(manualCamera).bindings['camera-yard'],manualCamera.bindings['camera-yard']);
const alreadySelected=structuredClone(v2);
alreadySelected.bindings['camera-yard']={entityId:houseBindings['camera-yard'],verified:true};
assert.equal(migrateHouseProfile(alreadySelected).bindings['camera-yard'].verified,true);
const removedCamera=structuredClone(v2);removedCamera.devices=removedCamera.devices.filter(d=>d.id!=='camera-yard');delete removedCamera.bindings['camera-yard'];
removedCamera.deviceModel=detachChannel(removedCamera.deviceModel,'camera-yard');
assert.equal(migrateHouseProfile(removedCamera).devices.some(d=>d.id==='camera-yard'),false);
const duplicateCamera=structuredClone(v2);
duplicateCamera.bindings['camera-extra-1']={entityId:houseBindings['camera-yard'],verified:false};
assert.equal(migrateHouseProfile(duplicateCamera).bindings['camera-yard'].entityId,'camera.c320ws_mainstream');
const partial=activateHouseProfile(clean,states.filter(e=>e.entity_id!==houseBindings['bath:1']));
assert.equal(partial.preferences.bindings['bath:1'].verified,false);
assert.equal(partial.preferences.houseProfileConfirmed,true,'Unavailable sensors must not resurrect onboarding');
assert.equal(partial.report.filter(r=>r.ok).length,32);
const battery=clean.devices.find(d=>d.type==='battery');
assert.ok(bindingProblem(battery,{entity_id:houseBindings[battery.id],state:'-1',attributes:{unit_of_measurement:'%'}}));
assert.ok(bindingProblem(clean.devices.find(d=>d.id==='door'),{entity_id:houseBindings.door,state:'off',attributes:{device_class:'motion'}}));
assert.ok(bindingProblem(clean.devices.find(d=>d.id==='terrace-motion'),{entity_id:houseBindings['terrace-motion'],state:'unavailable',attributes:{device_class:'enum'}}));

const dir=await mkdtemp(join(tmpdir(),'panel-house-profile-'));
let child,commands=0;
const fake=http.createServer((req,res)=>{
 assert.equal(req.headers.authorization,'Bearer profile-fixture');
 res.setHeader('Content-Type','application/json');
 if(req.url==='/api/states')return res.end(JSON.stringify(states));
 if(req.url.startsWith('/api/services/'))commands++;
 res.writeHead(404);res.end('{}');
});
await new Promise(r=>fake.listen(32152,'127.0.0.1',r));
let proof;
const call=async(path,method='GET',data,headers={})=>{
 const r=await fetch('http://127.0.0.1:32151/api/panel/'+path,{method,headers:{'Content-Type':'application/json',...(method!=='GET'?{'X-Panel-Proof':proof}:{}),...headers},...(data?{body:JSON.stringify(data)}:{})});
 return {code:r.status,body:await r.json()};
};
async function start(){
 child=spawn(process.execPath,['release/server.mjs'],{env:{...process.env,PORT:'32151',PANEL_DATA:dir,HA_URL:'http://127.0.0.1:32152',HA_TOKEN:'profile-fixture'},stdio:['ignore','pipe','inherit']});
 await new Promise((resolve,reject)=>{child.stdout.on('data',b=>{if(String(b).includes('Panel ready'))resolve()});child.once('exit',()=>reject(new Error('Server exited')))});
}
async function stop(){if(child?.exitCode===null){const ended=new Promise(r=>child.once('exit',r));child.kill();await ended}}
try{
 // Simulate the existing pre-1.0.5 database, including a photo.
 const db=new Database(join(dir,'panel.sqlite'));
 db.exec('CREATE TABLE profiles (id TEXT PRIMARY KEY, preferences TEXT NOT NULL, photo BLOB)');
 db.prepare('INSERT INTO profiles VALUES (?,?,?)').run('local',JSON.stringify(old),Buffer.from('keep-photo'));db.close();
 await start();
 let boot=await call('bootstrap');proof=boot.body.proof;
 assert.equal(boot.body.preferences.theme,'light');assert.equal(boot.body.photo,true);
 assert.equal((await call('house-profile','POST',{}, {'X-Panel-Proof':''})).code,400);
 let result=await call('house-profile','POST',{});
 assert.equal(result.code,200);assert.equal(result.body.preferences.bindings['living:0'].entityId,'switch.my_custom');
 assert.equal(result.body.preferences.bindings['bath:1'].verified,true);assert.equal(commands,0);
 assert.equal((await call('ha/command','POST',{id:'master-event',value:true})).code,400);
 assert.equal((await call('ha/command','POST',{id:'battery:living',value:true})).code,400);
 await stop();await start();
 boot=await call('bootstrap');proof=boot.body.proof;
 assert.equal(boot.body.preferences.mode,'live');assert.equal(boot.body.preferences.theme,'light');
 assert.equal(boot.body.preferences.bindings['bath:1'].verified,true);assert.equal(boot.body.photo,true);
 assert.equal(boot.body.preferences.houseProfileConfirmed,true);
 assert.equal((await call('house-profile','POST',{})).code,200);assert.equal(commands,0);
 console.log('PASS: 33 curated bindings, dual bathroom, migration/idempotency, theme/photo/custom mappings preserved, partial activation, numeric units/classes, CSRF, zero service calls, read-only events/batteries, persistence.');
}finally{await stop();await new Promise(r=>fake.close(r));await rm(dir,{recursive:true,force:true})}
