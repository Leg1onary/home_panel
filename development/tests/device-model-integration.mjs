import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import {mkdtemp,rm} from 'node:fs/promises';
import Database from 'better-sqlite3';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {defaultPreferences,validatePreferences} from '../src/preferences.js';
import {migrateHouseProfile} from '../src/house-profile.js';
import {detachChannel} from '../src/device-model.js';

const dir=await mkdtemp(join(tmpdir(),'panel-model-v1-'));
const old=migrateHouseProfile(defaultPreferences());
delete old.deviceModel;
old.theme='light';old.mode='live';old.favorites=['office','hall'];old.houseProfileConfirmed=true;
old.devices.find(d=>d.id==='temperature:living').name='Мой датчик';
old.bindings['living:0']={entityId:'light.owner_custom',verified:true};
const original=JSON.stringify(old);
const db=new Database(join(dir,'panel.sqlite'));
db.exec('CREATE TABLE profiles (id TEXT PRIMARY KEY, preferences TEXT NOT NULL, photo BLOB)');
db.prepare('INSERT INTO profiles VALUES (?,?,?)').run('local',original,Buffer.from('photo-preserved'));
db.close();
let child,proof;
async function launch(){
 child=spawn(process.execPath,['release/server.mjs'],{cwd:resolve('.'),env:{...process.env,PORT:'3181',PANEL_DATA:dir,HA_URL:'',HA_TOKEN:'',PANEL_PREVIEW:'0'},stdio:['ignore','pipe','pipe']});
 await new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>reject(new Error('Model server start timeout')),10000);
  child.stdout.on('data',data=>{if(String(data).includes('Panel ready')){clearTimeout(timer);resolve()}});
  child.once('exit',()=>{clearTimeout(timer);reject(new Error('Model server exited'))});
 });
}
async function stop(){if(child&&child.exitCode===null){const ended=new Promise(r=>child.once('exit',r));child.kill();await ended}}
async function call(path,body){
 const r=await fetch('http://127.0.0.1:3181/api/panel/'+path,{method:body===undefined?'GET':'PUT',headers:{'Content-Type':'application/json','X-Panel-Proof':proof||''},...(body===undefined?{}:{body:JSON.stringify(body)})});
 return {status:r.status,body:await r.json()};
}
function inspect(fn){const db=new Database(join(dir,'panel.sqlite'));try{return fn(db)}finally{db.close()}}
try{
 await launch();
 const first=await call('bootstrap');assert.equal(first.status,200);proof=first.body.proof;
 let p=first.body.preferences;
 assert.equal(p.deviceModel.version,1);
 assert.equal(p.theme,'light');assert.equal(p.mode,'live');
 assert.equal(p.houseProfileConfirmed,true);assert.equal(first.body.photo,true);
 assert.deepEqual(p.bindings,old.bindings);
 assert.deepEqual(p.favorites,old.favorites);
 assert.deepEqual(p.devices,old.devices);
 assert.equal(p.deviceModel.groups.find(g=>g.id==='unit-climate-living').members.length,3);
 assert.equal(inspect(db=>db.prepare('SELECT preferences FROM profile_backups WHERE profile_id=? AND reason=?').get('local','before-device-model-v1').preferences),original);
 const response=await call('device-model');assert.equal(response.status,200);
 assert.equal(response.body.devices.flatMap(d=>d.components).length,p.devices.length);
 assert.equal(JSON.stringify(response).includes('access_token'),false);
 p.deviceModel.groups[0].name='Датчик с новым именем';
 let saved=await call('preferences',p);assert.equal(saved.status,200);
 assert.deepEqual(saved.body.preferences.bindings,old.bindings,'Grouping metadata does not reset verification or contact HA');
 const stable=JSON.stringify(saved.body.preferences);
 const legacy=structuredClone(saved.body.preferences);delete legacy.deviceModel;legacy.kiosk=true;
 const legacySaved=await call('preferences',legacy);assert.equal(legacySaved.status,200);
 assert.equal(legacySaved.body.preferences.deviceModel.groups[0].name,'Датчик с новым именем','An older open browser must not erase new model metadata');
 p=legacySaved.body.preferences;
 const afterLegacy=JSON.stringify(p);
 let bad=structuredClone(p);bad.deviceModel.version=99;
 assert.equal((await call('preferences',bad)).status,400);
 assert.equal(JSON.stringify((await call('bootstrap')).body.preferences),afterLegacy);
 bad=structuredClone(p);bad.deviceModel.groups[0].members.push('missing-channel');
 assert.equal((await call('preferences',bad)).status,400);
 const removed='humidity:living';
 p.devices=p.devices.filter(d=>d.id!==removed);delete p.bindings[removed];
 p.deviceModel=detachChannel(p.deviceModel,removed);
 saved=await call('preferences',p);assert.equal(saved.status,200);
 assert.equal(saved.body.preferences.deviceModel.groups[0].members.includes(removed),false);
 p=validatePreferences(saved.body.preferences);
 const newLight={id:'device-new-light',type:'light',room:'bedroom',name:'Новый торшер',status:'installed',note:'',masterOff:false};
 p.devices.push(newLight);p.bindings[newLight.id]={entityId:'light.new_floor_lamp',verified:false};
 saved=await call('preferences',p);assert.equal(saved.status,200);
 assert.ok((await call('device-model')).body.devices.some(g=>g.id==='channel:device-new-light'),'A new channel gets a logical device without scene placement or a code change');
 p=saved.body.preferences;p.deviceModel.groups=[];
 saved=await call('preferences',p);assert.equal(saved.status,200);
 await stop();await launch();
 const again=await call('bootstrap');assert.deepEqual(again.body.preferences.deviceModel.groups,[]);
 assert.equal(again.body.preferences.bindings['living:0'].verified,true);
 assert.equal(again.body.preferences.theme,'light');assert.equal(again.body.photo,true);
 assert.equal(inspect(db=>db.prepare('SELECT preferences FROM profile_backups WHERE profile_id=? AND reason=?').get('local','before-device-model-v1').preferences),original,'Original migration backup is never overwritten');
 assert.equal(inspect(db=>db.prepare('SELECT photo FROM profiles WHERE id=?').get('local').photo.toString()),'photo-preserved');
 console.log('PASS: real SQLite migration, original backup, idempotent restart, preserved theme/photo/live mappings, grouping CRUD, new device without a plan, unknown versions rejected without mutation.');
}finally{await stop();await rm(dir,{recursive:true,force:true})}
