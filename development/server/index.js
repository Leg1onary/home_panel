import http from 'node:http';
import {readFile,stat,mkdir} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {spawn} from 'node:child_process';
import {isIP} from 'node:net';
import {randomBytes,createHash,timingSafeEqual} from 'node:crypto';
import Database from 'better-sqlite3';
import {defaultPreferences,validatePreferences,bindingDefinitions,sanitizeEnergyReadings,migrateYardCameras} from '../src/preferences.js';
import {onvifDiscover} from './onvif-discover.js';
import {HomeAssistant} from './ha.js';
import {CameraStreams} from './stream.js';
import {CameraRTC} from './rtc.js';
import {LiveFeed} from './live-stream.js';
import {YardMotion} from './yard-motion.js';
import {onvifWatch,onvifSnapshots} from './yard-onvif.js';
import {YardClips} from './yard-clips.js';
import {journal,journalList} from './journal.js';
import {meterValue,monthDelta,monthCost,monthForecast,monthComparison} from '../src/energy.js';
import {computeAnalytics} from '../src/events.js';
import {isNight} from '../src/night.js';
import {energyDeltas} from './ha.js';

import {deviceTypes,samePhysicalDevice,resolveAction} from '../src/catalog.js';
import {migrateHouseProfile,activateHouseProfile,bindingProblem} from '../src/house-profile.js';
import {seedDeviceModel,buildDeviceModel} from '../src/device-model.js';
import {loadHistory} from './history.js';
import {StationAssistant} from './assistant.js';
import {runScenario,runUserScenario} from './scenarios.js';

const port=Number(process.env.PORT||8080),preview=process.env.PANEL_PREVIEW==='1';
const startedAt=Date.now();
let PANEL_VERSION='3.2.0';
// Порядок чтения: поздний источник побеждает. config.json аддона — авторитетный (пишется build.mjs).
try{PANEL_VERSION=JSON.parse(await readFile(resolve('addon/home-panel/manifest.json'),'utf8')).version||PANEL_VERSION}catch{}
try{PANEL_VERSION=JSON.parse(await readFile(resolve('package.json'),'utf8')).version||PANEL_VERSION}catch{}
try{PANEL_VERSION=JSON.parse(await readFile(resolve('config.json'),'utf8')).version||PANEL_VERSION}catch{}
const addon=process.env.PANEL_ADDON==='1';
if(addon&&preview)throw new Error('Home Panel: add-on must not run in preview mode.');
const root=resolve(process.env.PANEL_ROOT||'dist'),data=resolve(process.env.PANEL_DATA||'data');
await mkdir(data,{recursive:true});
const db=new Database(resolve(data,'panel.sqlite'));
db.pragma('journal_mode = WAL');
db.exec('CREATE TABLE IF NOT EXISTS profiles (id TEXT PRIMARY KEY, preferences TEXT NOT NULL, photo BLOB);');
db.exec('CREATE TABLE IF NOT EXISTS profile_backups (profile_id TEXT NOT NULL, reason TEXT NOT NULL, preferences TEXT NOT NULL, PRIMARY KEY(profile_id,reason));');
// Хроника дома (3.5.0): пользовательские события — двор/двери/свет/показания/система.
// Отдельно от журнала «Здоровья»: здесь то, что интересно хозяину, а не диагностика.
db.exec('CREATE TABLE IF NOT EXISTS events (id INTEGER PRIMARY KEY AUTOINCREMENT, at INTEGER NOT NULL, type TEXT NOT NULL, text TEXT NOT NULL, ref TEXT);');
const eventInsert=db.prepare('INSERT INTO events(at,type,text,ref) VALUES(?,?,?,?)');
const eventPrune=db.prepare('DELETE FROM events WHERE id NOT IN (SELECT id FROM events ORDER BY id DESC LIMIT 500)');
const recordEvent=(type,text,ref=null)=>{
 const at=Date.now();
 eventInsert.run(at,String(type).slice(0,16),String(text).slice(0,160),ref!=null?String(ref).slice(0,40):null);
 eventPrune.run();
 try{live?.broadcast?.('home-event',JSON.stringify({at,type,text:String(text).slice(0,160)}))}catch{}
 return at;
};
const ha=new HomeAssistant({url:process.env.HA_URL,token:process.env.HA_TOKEN,preview});
const streams=new CameraStreams(ha);
const rtc=new CameraRTC(ha);
setInterval(()=>streams.prune(),30000).unref();
setInterval(()=>rtc.prune(),30000).unref();
// Панельный детектор движения двора: без биндинга yard-motion и без облака.
// Сущность камеры разрешается из проверенного биндинга camera-yard на каждый вызов;
// нет проверенной привязки → детектор unavailable.
const yardCameraEntity=p=>{const b=p?.bindings['camera-yard'];return p?.mode==='live'&&b?.verified&&/^camera\.[a-z0-9_]+$/.test(b.entityId||'')?b.entityId:null};
const yardMotion=new YardMotion({ha});
// ONVIF-события движения двора (события железа вместо jpeg-диффа). Creds — из
// preferences-профиля (серверно), ошибки → jpeg-диффер остаётся fallback-ом.
// 3.4.6: watcher'ов может быть несколько — по одному на камеру из yardCameras.
let yardOnvifWatchers=[],yardOnvifConfigKey='';
const clientPreferences=prefs=>{
 const c={...prefs};
 delete c.yard_onvif_pass;
 c.yardCameras=(c.yardCameras||[]).map(({pass,...rest})=>({...rest,pass:''}));
 return c;
};
// Активные камеры: тумблер yard_onvif_enabled выключен → пусто (jpeg-диффер — резерв).
// Список yardCameras приоритетен; если он пуст — легаси-поля yard_onvif_* (старые профили).
const yardOnvifConfigOf=prefs=>{
 if(prefs.yard_onvif_enabled===false)return [];
 const list=(Array.isArray(prefs.yardCameras)?prefs.yardCameras:[])
  .filter(c=>c&&c.enabled!==false&&c.host&&String(c.user||'').trim())
  .map(c=>({name:c.name,host:c.host,port:c.port||2020,user:c.user,pass:c.pass}));
 if(list.length)return list;
 const user=String(prefs.yard_onvif_user||'').trim();
 if(!user)return [];
 let host=String(prefs.yard_onvif_host||'').trim()||'192.168.8.204',port;
 const colon=host.match(/^([\w.\-]+):(\d+)$/);
 if(colon){host=colon[1];port=Number(colon[2])}
 return [{name:'Двор',host,port:port||2020,user,pass:String(prefs.yard_onvif_pass||'')}];
};
const yardOnvifStatuses=()=>yardOnvifWatchers.map(w=>({name:w.name,host:w.host,port:w.port,...w.watch.status()}));
const yardOnvifEnsure=prefs=>{
 const list=yardOnvifConfigOf(prefs);
 const sig=JSON.stringify(list);
 if(sig===yardOnvifConfigKey)return yardOnvifWatchers.length>0;
 yardOnvifConfigKey=sig;
 for(const w of yardOnvifWatchers){try{w.watch.stop()}catch{}}
 yardOnvifWatchers=list.map(cam=>{
  // Живые снимки (3.3.9): тот же creds/host, отдельный клиент GetSnapshotUri+GET.
  const snapshots=onvifSnapshots({host:cam.host,port:cam.port,user:cam.user,pass:cam.pass,log:(...a)=>console.log('ONVIF snapshot['+cam.name+']:',...a)});
  const watch=onvifWatch({host:cam.host,port:cam.port,user:cam.user,pass:cam.pass,label:cam.name,
   onMotion:()=>{yardMotion.externalMotion();yardClips.record({source:'onvif:'+cam.name,snap:snapshots}).catch(error=>journal('Клип '+cam.name+' не записан: '+(error?.message||error),'warn'))},
   onError:error=>{console.log('ONVIF['+cam.name+'] fallback to jpeg diff:',error?.message||error);journal('ONVIF-события недоступны ('+cam.name+'): '+(error?.message||error)+' — работает резерв по кадрам','warn')}});
  return {name:cam.name,host:cam.host,port:cam.port,watch,snapshots};
 });
 if(yardOnvifWatchers.length)journal('ONVIF-детекторы запущены: '+yardOnvifWatchers.map(w=>w.name+' ('+w.host+':'+w.port+')').join(', '));
 return yardOnvifWatchers.length>0;
};

const proofs=new Map(),pendingScopes=new Map();
const live=new LiveFeed({ha}),liveIds=new Map();
let forecastCache=null,forecastKey='',shoppingCache=null,energyCache=null,energyLastKnown=null;
// Кольцевой буфер кадров двора → клипы по движению (ONVIF и jpeg-диффер — общий путь).
// Сущность камеры — подсказка от последнего опроса детектора (разрешается из
// проверенного биндинга camera-yard профиля на каждый вызов ha/yard-motion).
let yardEntityHint=null;
const yardClips=new YardClips({ha,db,getEntityId:()=>yardEntityHint,
 getSnaps:()=>yardOnvifWatchers.map(w=>w.snapshots),
 notify:info=>{
  live.broadcast('yard-clip',JSON.stringify(info));
  // Хроника (3.5.0): каждый записанный клип — событие двора (любой детектор).
  recordEvent('yard','Движение · '+String(info.source||'двор').replace(/^onvif:/,''),'clip:'+info.id);
 }});
 yardClips.start();
 // 3.6.0: автоснимки профиля — раз в сутки около 03:00, хранить последние 7.
 const autoPrune=db.prepare("DELETE FROM profile_backups WHERE reason LIKE 'auto-%' AND reason NOT IN (SELECT reason FROM profile_backups WHERE reason LIKE 'auto-%' ORDER BY reason DESC LIMIT 7)");
 let lastAutoDate='';
 setInterval(()=>{
  const now=new Date();
  const today=now.toISOString().slice(0,10);
  if(now.getHours()!==3||lastAutoDate===today)return;
  lastAutoDate=today;
  try{
   const reason='auto-'+today;
   for(const {id} of db.prepare('SELECT id FROM profiles').all()){
    const prefs=getProfile(id).preferences;
    db.prepare('INSERT OR REPLACE INTO profile_backups(profile_id,reason,preferences) VALUES(?,?,?)').run(id,reason,JSON.stringify(prefs));
   }
   autoPrune.run();
   journal('Автоснимки профилей сохранены ('+today+')');
  }catch(error){journal('Автоснимок не удался: '+(error?.message||error),'warn')}
 },30*60000).unref();
 // Хроника дверей (3.5.0): раз в 20 с сверяем состояния дверных привязок;
 // переход открыта↔закрыта → событие. Живой кеш LiveFeed — без лишних запросов в HA.
 const doorTracker=new Map();
 setInterval(async()=>{
  if(!ha.enabled)return;
  try{
   const prefs=getProfile(addon?'home':'local').preferences;
   const defs=bindingDefinitions(prefs.devices).filter(d=>d.type==='door'&&d.device.status==='installed'
    &&prefs.bindings[d.id]?.verified&&prefs.bindings[d.id]?.entityId);
   if(!defs.length)return;
   const byId=new Map(((live.states&&live.states.length?live.states:await ha.states())||[]).map(s=>[s.entity_id,s]));
   for(const d of defs){
    const eid=prefs.bindings[d.id].entityId,e=byId.get(eid);
    if(!e)continue;
    const open=e.state==='on',prev=doorTracker.get(eid);
    if(prev===undefined){doorTracker.set(eid,{open,since:open?Date.now():0});continue}
    if(prev.open!==open){
     doorTracker.set(eid,{open,since:open?Date.now():0});
     recordEvent('door',d.device.name+(open?' открыта':' закрыта'));
    }
   }
  }catch(error){console.log('Door poll:',error?.message||error)}
 },Number(process.env.PANEL_DOOR_POLL_MS)||20000).unref();
const GUARD_SCALE=Number(process.env.PANEL_GUARD_SCALE)||1;
const guard={exitUntil:0,alarm:null,timers:[],alerted:new Map(),flashTimer:null,flashOn:false,armedBy:null};
const guardTimers=[];const gT=(fn,ms)=>{const t=setTimeout(fn,ms);guardTimers.push(t);return t};
const guardClearTimers=()=>{for(const t of guardTimers.splice(0))clearTimeout(t);if(guard.flashTimer){clearInterval(guard.flashTimer);guard.flashTimer=null}};
const guardProfileId=()=>addon?'home':'local';
const guardPrefs=()=>getProfile(guardProfileId()).preferences;
async function guardDoors(){
 const prefs=guardPrefs();
 const defs=bindingDefinitions(prefs.devices).filter(d=>d.type==='door'&&d.device.status==='installed'
  &&prefs.bindings[d.id]?.verified&&prefs.bindings[d.id]?.entityId);
 // 3.7.0: для охраны состояния всегда свежие — кеш LiveFeed может отставать.
 const byId=new Map(((await ha.states())||[]).map(s=>[s.entity_id,s]));
 // 3.7.1: единый писатель трекера дверей — здесь же фиксируются переходы
 // открыта↔закрыта в хронику (бывший поллер объединён, без гонок).
 const out=defs.map(d=>{
  const eid=prefs.bindings[d.id].entityId,e=byId.get(eid);
  const stateOpen=e?e.state==='on':false;
  const tr=doorTracker.get(eid);
  const since=stateOpen?(tr?.since&&tr.since>0?tr.since:Date.now()):0;
  if(!tr){doorTracker.set(eid,{open:stateOpen,since})}
  else if(tr.open!==stateOpen){doorTracker.set(eid,{open:stateOpen,since});recordEvent('door',d.device.name+(stateOpen?' открыта':' закрыта'))}
  return {id:d.id,name:d.device.name,entityId:eid,open:stateOpen,since,state:e?.state};
 });
 return out;
 // since — из трекера, а если дверь открыта, но времени открытия мы не видели —
 // считаем от текущего момента (честно для пилота).
 return out;
}
async function guardLights(on){
 const prefs=guardPrefs();
 for(const def of bindingDefinitions(prefs.devices).filter(d=>['light','rgb'].includes(d.type)&&d.device.status==='installed'&&prefs.bindings[d.id]?.verified&&prefs.bindings[d.id]?.entityId)){
  try{await ha.command({id:def.id,value:on},prefs)}catch(error){journal('Охрана: свет '+def.name+' — '+(error?.message||error),'warn')}
 }
}
async function guardSiren(){
 // Пилот: интент станции «включи песню «Полицейская сирена»» через conversation;
 // при неудаче — громкая TTS-озвучка (гарантированный запасной вариант).
 try{
  const r=await ha.converse('включи песню Полицейская сирена');
  journal('Охрана: интент сирены — '+(r.speech||'без ответа'));
 }catch(error){
  journal('Охрана: интент не сработал ('+(error?.message||error)+') — TTS-сирена','warn');
  try{await ha.announce('Внимание! Внимание! Откройте дверь и уберите руки!',guardPrefs())}catch(e2){journal('Охрана: TTS-сирена не удалась: '+(e2?.message||e2),'warn')}
 }
}
async function guardSwitchSet(on){
 // 3.7.1: синхронизация помощника «Охрана» (мост Яндекс ↔ HA).
 const prefs=guardPrefs();
 if(!prefs.guardEntity)return;
 try{
  const domain=prefs.guardEntity.split('.')[0];
  await ha.request('/api/services/'+domain+'/turn_'+(on?'on':'off'),{entity_id:prefs.guardEntity});
 }catch(error){journal('Охрана: помощник '+(on?'вкл':'выкл')+' — '+(error?.message||error),'warn')}
}
async function guardSirenStop(){
 try{await ha.command({id:'station:playing',value:false},guardPrefs())}catch(error){journal('Охрана: стоп сирены — '+(error?.message||error),'warn')}
}
function guardStopFlash(){if(guard.flashTimer){clearInterval(guard.flashTimer);guard.flashTimer=null}guard.flashOn=false}
function guardStartAlarmCycle(doorName){
 guard.alarm={startedAt:Date.now(),doorName};
 recordEvent('guard','Сирена · '+doorName+' (цикл)');
 guardLights(true).then(()=>{
  if(guardPrefs().guardFlash){
   guard.flashOn=true;
   guard.flashTimer=setInterval(()=>{guardLights(guard.flashOn=!guard.flashOn)},2000);
  }
 });
 guardSiren();
 const play=3*60000*GUARD_SCALE,pause=2*60000*GUARD_SCALE;
 gT(async()=>{guardStopFlash();await guardSirenStop()},play);
 gT(async()=>{
  if(!guardPrefs().guardArmedAway)return;
  recordEvent('guard','Сирена · пауза 2 мин, ждём снятия');
  gT(async()=>{if(guardPrefs().guardArmedAway)guardStartAlarmCycle(doorName)},pause);
 },play+pause);
}
async function guardStopAlarm(silent=false){
 guardClearTimers();guardStopFlash();guard.alarm=null;
 if(!silent){await guardSirenStop().catch(()=>{});await guardLights(false).catch(()=>{})}
}
async function guardTick(){
 try{
  let prefs;
  try{prefs=guardPrefs()}catch{return}
 const now=Date.now();
 const armed=prefs.guardArmedAway===true;
 // 3.7.1: мост «Я ухожу» — помощник охраны as source of truth.
 if(prefs.guardEntity){
  const states=await ha.states().catch(e=>{console.log('GUARDSTATES ERR:',e?.message);return[]});
  if(process.env.PANEL_DOOR_DEBUG)console.log('GUARDSTATES n=',states.length,'ib=',states.find(x=>x.entity_id===prefs.guardEntity)?.state);
  const sw=states.find(e=>e.entity_id===prefs.guardEntity);
  const swOn=sw?sw.state==='on':false;
  if(process.env.PANEL_DOOR_DEBUG)console.log('GUARDTICK swOn=',swOn,'armed=',armed,'ge=',prefs.guardEntity);
  if(swOn&&!armed){
   // сценарий «Я ухожу»: взвод без preflight (выход-отсчёт покрывает выход)
   prefs.guardArmedAway=true;
   db.prepare('UPDATE profiles SET preferences=? WHERE id=?').run(JSON.stringify(prefs),guardProfileId());
   guard.exitUntil=Date.now()+prefs.guardExitDelay*1000*GUARD_SCALE;
   guard.armedBy='bridge';
   await guardStopAlarm(true);
   recordEvent('guard','Охрана включена Яндекс-сценарием · выход '+prefs.guardExitDelay+' с');
   journal('Охрана: взвод от помощника '+prefs.guardEntity);
   return;
  }
  if(!swOn&&armed&&guard.armedBy==='bridge'){
   prefs.guardArmedAway=false;
   db.prepare('UPDATE profiles SET preferences=? WHERE id=?').run(JSON.stringify(prefs),guardProfileId());
   guard.exitUntil=0;
   await guardStopAlarm();
   recordEvent('guard','Охрана снята помощником '+prefs.guardEntity);
   journal('Охрана: снятие от помощника');
   return;
  }
 }
 const doors=await guardDoors();
 // 3.7.1: режим могли сменить, пока читали состояния HA — не продолжаем со старым.
 if((guardPrefs().guardArmedAway===true)!==armed)return;
 // выход-отсчёт: двери игнорируем, пока не вышли
 if(guard.exitUntil>now)return;
 const open=doors.filter(d=>d.open&&Number.isFinite(d.since)&&d.since>0);
 if(!guard.alarm){
  const trigger=open.find(d=>now-d.since>=prefs.guardAwayMinutes*60000*GUARD_SCALE);
  if(trigger){recordEvent('guard','Тревога: '+trigger.name+' открыта дольше '+prefs.guardAwayMinutes+' мин');await guardStartAlarmCycle(trigger.name);return}
 }
 // ночь = armed home: >alert минут → алерт-событие, >announce минут → озвучка
 const d=new Date(now),minutes=d.getHours()*60+d.getMinutes();
 const night=prefs.guardNight!=='off'&&isNight(minutes,prefs.nightStart,prefs.nightEnd,prefs.guardNight);
 if(night&&!guard.alarm){
  for(const door of open){
   const openMin=(now-door.since)/60000;
   const keyA=door.entityId+':a',keyN=door.entityId+':n';
   if(openMin>=prefs.guardHomeAlertMinutes&&!guard.alerted.has(keyA)){
    guard.alerted.set(keyA,now);recordEvent('door',door.name+' открыта дольше '+prefs.guardHomeAlertMinutes+' мин (ночь)');
   }
   if(openMin>=prefs.guardHomeAnnounceMinutes&&!guard.alerted.has(keyN)){
    guard.alerted.set(keyN,now);recordEvent('door',door.name+' открыта дольше '+prefs.guardHomeAnnounceMinutes+' мин — озвучка');
    try{await ha.announce('Внимание, открыта '+door.name,prefs)}catch(error){journal('Охрана: озвучка не удалась — '+(error?.message||error),'warn')}
   }
  }
 }
 }catch(error){console.log('Guard tick:',error?.message||error)}
}
setInterval(guardTick,Math.max(250,5000*GUARD_SCALE)).unref();

const getProfile=id=>{
 let row=db.prepare('SELECT * FROM profiles WHERE id=?').get(id);
 if(!row){db.prepare('INSERT INTO profiles(id,preferences) VALUES(?,?)').run(id,JSON.stringify(defaultPreferences()));row=db.prepare('SELECT * FROM profiles WHERE id=?').get(id)}
 const raw=JSON.parse(row.preferences),stored=validatePreferences(raw);
 // Миграция легаси-ONVIF (yard_onvif_*) в список камер — до сохранения/использования.
 let preferences=migrateHouseProfile(migrateYardCameras(stored,raw));
 if(raw.deviceModel===undefined)preferences=validatePreferences({...preferences,deviceModel:seedDeviceModel(preferences.devices)});
 const normalized=JSON.stringify(preferences);
 if(normalized!==row.preferences)db.transaction(()=>{
  if(raw.deviceModel===undefined)db.prepare('INSERT OR IGNORE INTO profile_backups(profile_id,reason,preferences) VALUES(?,?,?)').run(id,'before-device-model-v1',row.preferences);
  if((raw.housePresetVersion||0)<5&&preferences.housePresetVersion===5)db.prepare('INSERT OR IGNORE INTO profile_backups(profile_id,reason,preferences) VALUES(?,?,?)').run(id,'before-inventory-2026-10-22',row.preferences);
  if(raw.deviceModel!==undefined&&JSON.stringify(raw.devices)!==JSON.stringify(preferences.devices))db.prepare('INSERT OR IGNORE INTO profile_backups(profile_id,reason,preferences) VALUES(?,?,?)').run(id,'before-spatial-redesign',row.preferences);
  db.prepare('UPDATE profiles SET preferences=? WHERE id=?').run(normalized,id);
 })();
 return {preferences,photo:row.photo};
};
const assistant=new StationAssistant(ha,db,()=>db.prepare('SELECT id FROM profiles').all().map(({id})=>({id,preferences:getProfile(id).preferences})));
const assistantScopes=new Set();
if(!preview)setInterval(()=>assistant.tick(),15000).unref();
const json=(res,code,body)=>{res.writeHead(code,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(body))};
async function body(req,max=131072){
 const chunks=[];let n=0;
 for await(const c of req){n+=c.length;if(n>max)throw new Error('Файл или запрос слишком большой.');chunks.push(c)}
 return Buffer.concat(chunks);
}
function identify(req){
 if(addon){
  const address=(req.socket.remoteAddress||'').replace(/^::ffff:/,'');
  const hostname=new URL('http://'+(req.headers.host||'')).hostname.replace(/^\[|\]$/g,'');
  const privateAddress=ip=>ip==='::1'||/^f[cd][0-9a-f]*:/i.test(ip)||/^fe80:/i.test(ip)||(isIP(ip)===4&&(
   ip.startsWith('10.')||ip.startsWith('192.168.')||ip.startsWith('127.')||
   /^172\.(1[6-9]|2\d|3[01])\./.test(ip)||
   // Tailscale/CGNAT 100.64.0.0/10 (3.4.7): удалённое управление через tailnet.
   /^100\.(6[4-9]|[7-9]\d|1[01]\d|12[0-7])\./.test(ip)));
  if(!privateAddress(address))throw new Error('Home Panel доступна только из локальной сети.');
  if(!privateAddress(hostname)&&hostname!=='localhost'&&!/^[a-z0-9-]+\.local$/i.test(hostname))throw new Error('Открой панель по локальному IP или имени .local.');
  return 'home';
 }
 const host=req.headers.host||'',direct=/^(localhost|127\.0\.0\.1|\[::1\]):\d+$/.test(host);
 const visitor=req.headers['x-visitor-id'];
 if(preview&&visitor)return 'preview:'+createHash('sha256').update(String(visitor)).digest('hex');
 if(direct&&['127.0.0.1','::1','::ffff:127.0.0.1'].includes(req.socket.remoteAddress))return 'local';
 throw new Error('Доступ разрешён только с этого компьютера или через приватное превью.');
}
function authorize(req,id){
 const expected=proofs.get(id),actual=String(req.headers['x-panel-proof']||'');
 if(!expected||Buffer.byteLength(actual)!==Buffer.byteLength(expected)||!timingSafeEqual(Buffer.from(actual),Buffer.from(expected))){
  const error=new Error('Защитный ключ панели устарел. Обновляем соединение.');
  error.code='PANEL_PROOF_REQUIRED';throw error;
 }
 const origin=req.headers.origin;
 const allowed=addon?[`http://${req.headers.host}`]:[`http://localhost:${port}`,`http://127.0.0.1:${port}`,`http://[::1]:${port}`];
 if(!preview&&origin&&!allowed.includes(origin))throw new Error('Запрос из другой страницы запрещён.');
 if(!preview&&req.headers['sec-fetch-site']==='cross-site')throw new Error('Межсайтовый запрос запрещён.');
}
const server=http.createServer(async(req,res)=>{
 try{
  const url=new URL(req.url,'http://localhost'),path=decodeURIComponent(url.pathname);
  if(path==='/health'&&req.method==='GET')return json(res,200,{ok:true});
  if(path.startsWith('/api/panel/')){
   const id=identify(req),p=getProfile(id),route=path.slice('/api/panel/'.length);
   if(req.method==='GET'&&route==='session'){
    if(!proofs.has(id))proofs.set(id,randomBytes(32).toString('hex'));
    return json(res,200,{proof:proofs.get(id)});
   }
   if(req.method==='GET'&&route==='bootstrap'){
    if(!proofs.has(id))proofs.set(id,randomBytes(32).toString('hex'));
    return json(res,200,{preferences:clientPreferences(p.preferences),photo:!!p.photo,proof:proofs.get(id),preview,addon,haConfigured:ha.enabled});
   }
   if(req.method==='GET'&&route==='profile/export'){
    const data=Buffer.from(JSON.stringify({exportedAt:new Date().toISOString(),version:3,preferences:clientPreferences(p.preferences)},null,2));
    res.writeHead(200,{'Content-Type':'application/json; charset=utf-8','Content-Disposition':'attachment; filename="home-panel-profile.json"','Cache-Control':'no-store'});
    return res.end(data);
   }
   if(req.method!=='GET')authorize(req,id);
   if(route==='assistant/status'&&req.method==='GET')return json(res,200,await assistant.status(id,p.preferences));
   if(route==='assistant/shopping'&&req.method==='GET')return json(res,200,await assistant.shopping(p.preferences));
   if(route==='assistant/settings'&&req.method==='PUT'){
    if(pendingScopes.has(id))throw new Error('Дождись завершения действия.');
    return json(res,200,{settings:assistant.saveSettings(id,JSON.parse((await body(req)).toString()))});
   }
   if(route==='assistant/action'&&req.method==='POST'){
    if(pendingScopes.has(id))throw new Error('Дождись завершения предыдущего действия.');
    pendingScopes.set(id,(pendingScopes.get(id)||0)+1);assistantScopes.add(id);
    try{return json(res,200,await assistant.execute(id,p.preferences,JSON.parse((await body(req)).toString())))}
    finally{assistantScopes.delete(id);const n=pendingScopes.get(id)-1;if(n)pendingScopes.set(id,n);else pendingScopes.delete(id)}
   }
   if(route==='ha/history'&&req.method==='GET'){
    if(url.searchParams.has('entity_id')||url.searchParams.has('filter_entity_id'))throw new Error('Сущности истории определяются только проверенными привязками профиля.');
    return json(res,200,await loadHistory(ha,p.preferences,url.searchParams.get('hours')));
   }
   if(route==='house-profile'&&req.method==='POST'){
    if(preview)throw new Error('Профиль дома применяется только на локальной панели.');
    if(pendingScopes.has(id))throw new Error('Сначала дождись завершения команды.');
    const result=activateHouseProfile(p.preferences,await ha.states());
    if(!result.report.some(r=>r.ok))throw new Error('Ни одна сущность профиля недоступна. Проверь интеграции и привязки.');
    db.prepare('UPDATE profiles SET preferences=? WHERE id=?').run(JSON.stringify(result.preferences),id);
    return json(res,200,result);
   }
   if(route==='preferences'&&req.method==='PUT'){
    if(pendingScopes.has(id))throw new Error('Сначала дождись завершения команды.');
    const input=JSON.parse((await body(req)).toString());
    // Клиент никогда не видел yard_onvif_pass — пустое поле в PUT не затирает пароль.
    if(input&&typeof input==='object'&&Array.isArray(input.devices)&&input.yard_onvif_pass===undefined)
     input.yard_onvif_pass=p.preferences.yard_onvif_pass;
    // Старый клиент (вкладка без Ctrl+F5 после 3.3.x) шлёт профиль без ONVIF/энергия-ключей:
    // отсутствие ключа = храним старые значения, иначе каждое сохранение настроек
    // событийно стирало учётку детектора (configured:false после обновлений).
    if(input&&typeof input==='object'&&Array.isArray(input.devices)){
     // Пустой user из любого клиента — «не трогать» (учётка камере нужна; сброс не юз-кейс).
     if(!input.yard_onvif_user&&p.preferences.yard_onvif_user)input.yard_onvif_user=p.preferences.yard_onvif_user;
     if(input.yard_onvif_user===undefined)input.yard_onvif_user=p.preferences.yard_onvif_user;
     if(input.yard_onvif_host===undefined)input.yard_onvif_host=p.preferences.yard_onvif_host;
     if(input.yard_onvif_enabled===undefined)input.yard_onvif_enabled=p.preferences.yard_onvif_enabled;
     // Камеры ONVIF: ключа нет у старого клиента → храним список; пароль внутри
     // элемента пустой → подставляем хранящийся (по host:port+user, иначе по позиции).
     if(input.yardCameras===undefined)input.yardCameras=p.preferences.yardCameras;
     if(Array.isArray(input.yardCameras)){
      const stored=p.preferences.yardCameras||[];
      input.yardCameras=input.yardCameras.map((c,i)=>{
       if(c&&typeof c==='object'&&((c.pass===undefined)||(c.pass===''))){
        const match=stored.find(s=>s.host===c?.host&&s.port===(c?.port||2020)&&s.user===c?.user)||stored[i];
        if(match?.pass)return {...c,pass:match.pass};
       }
       return c;
      });
     }

     if(input.energy_readings===undefined)input.energy_readings=p.preferences.energy_readings;
     if(input.energy_tariff===undefined)input.energy_tariff=p.preferences.energy_tariff;
     if(input.guardArmedAway===undefined)input.guardArmedAway=p.preferences.guardArmedAway;
     if(input.guardEntity===undefined)input.guardEntity=p.preferences.guardEntity;
    }
    // A still-open older client does not know the additive layer. Its theme or
    // binding save must not erase newer groups. Legacy channel deletion detaches
    // that channel explicitly; malformed current-schema requests still reject.
    if(input&&typeof input==='object'&&input.deviceModel===undefined&&Array.isArray(input.devices)){
     const ids=new Set(input.devices.map(d=>d?.id));
     input.deviceModel={...p.preferences.deviceModel,groups:p.preferences.deviceModel.groups
      .map(g=>({...g,members:g.members.filter(id=>ids.has(id))})).filter(g=>g.members.length)};
    }
    const next=validatePreferences(input);
    for(const d of next.devices){
     const old=p.preferences.devices.find(old=>old.id===d.id);
     if(old&&old.type!==d.type)throw new Error('Тип существующего устройства нельзя менять.');
     if(!samePhysicalDevice(old,d))next.bindings[d.id].verified=false;
    }
    const newVerified=bindingDefinitions(next.devices).filter(d=>{
     const b=next.bindings[d.id],old=p.preferences.bindings[d.id];
     return b.verified&&(!old?.verified||old.entityId!==b.entityId);
    });
    // Per-binding outcome: one bad or offline entity must not discard the whole form.
    // Missing / wrong type -> saved unverified. Existing but offline -> verified kept
    // (owner checked it on site); it stays without data until HA reports a state.
    const rejected=[],offline=[];
    if(newVerified.length){
     const list=await ha.states(),entities=new Map(list.map(e=>[e.entity_id,e]));
     for(const def of newVerified){
      const b=next.bindings[def.id],e=entities.get(b.entityId);
      if(!e){b.verified=false;rejected.push({id:def.id,name:def.name,problem:'сущность не найдена в Home Assistant'});continue}
      if(['unknown','unavailable',''].includes(e.state)){offline.push({id:def.id,name:def.name,problem:'сейчас недоступна в Home Assistant'});continue}
      const problem=bindingProblem(def.device,e);
      if(problem){b.verified=false;rejected.push({id:def.id,name:def.name,problem})}
     }
    }
    db.prepare('UPDATE profiles SET preferences=? WHERE id=?').run(JSON.stringify(next),id);
    // Тумблер ONVIF-датчика применяется сразу: сервер перезапускает/останавливает watcher.
    yardOnvifEnsure(next);
    journal('Профиль сохранён ('+(rejected.length?'отклонено: '+rejected.length:'все привязки подтверждены')+')');
    // Показания/тариф меняют месячный расчёт: кеш энергии сбрасываем немедленно.
    energyCache=null;energyLastKnown=null;
    return json(res,200,{saved:true,preferences:clientPreferences(next),rejected,offline});
   }
   if(route==='photo'){
    if(req.method==='GET'&&p.photo){res.writeHead(200,{'Content-Type':'image/jpeg','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});return res.end(p.photo)}
    if(req.method==='PUT'){
     if(preview)throw new Error('В облачном превью фото не сохраняется. Используй локальный запуск.');
     const bytes=await body(req,2*1024*1024);
     if(req.headers['content-type']!=='image/jpeg'||bytes[0]!==255||bytes[1]!==216||bytes.at(-2)!==255||bytes.at(-1)!==217)throw new Error('Нужен корректный JPEG до 2 МБ.');
     db.prepare('UPDATE profiles SET photo=? WHERE id=?').run(bytes,id);return json(res,200,{saved:true});
    }
    if(req.method==='DELETE'){db.prepare('UPDATE profiles SET photo=NULL WHERE id=?').run(id);return json(res,200,{saved:true})}
   }
   if(route==='ha/states'&&req.method==='GET')return json(res,200,{states:await ha.states(),receivedAt:Date.now()});
   // Панельный детектор двора: кадр камеры сравнивается на сервере (jpeg-js), троттлинг внутри check().
   if(route==='ha/yard-motion'&&req.method==='GET'){
    yardOnvifEnsure(p.preferences);
    const entity=yardCameraEntity(p.preferences);if(entity)yardEntityHint=entity;
    const motion=await yardMotion.check(entity);
    // Движение увидел диффер (ONVIF молчит) — клип всё равно пишется; дедуп 15с в record().
    if(motion.motion)yardClips.record().catch(error=>journal('Клип двора не записан: '+(error?.message||error),'warn'));
    return json(res,200,{...motion,checkedAt:Date.now()});
   }
   // Клипы двора: список без байтов и кадр по индексу (0..3).
   if(route==='yard-clips'&&req.method==='GET'){
    const limit=Math.min(30,Math.max(1,Number(url.searchParams.get('limit'))||20));
    return json(res,200,yardClips.list(limit));
   }
   const clipRoute=/^yard-clip\/(\d+)\/([0-3])$/.exec(route);
   if(clipRoute&&req.method==='GET'){
    const frame=yardClips.frame(Number(clipRoute[1]),Number(clipRoute[2]));
    if(!frame)return json(res,404,{error:'Кадр не найден.'});
    res.writeHead(200,{'Content-Type':'image/jpeg','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});return res.end(frame);
   }
   if(route==='yard-clips-capture'&&req.method==='POST'&&process.env.PANEL_TEST_HOOKS==='1'){
    const request=JSON.parse((await body(req)).toString()||'{}');
    const clip=await yardClips.testCapture({...(!Number.isFinite(request?.at)?{}:{at:request.at}),...(request?.dedup===false?{dedup:false}:{})});
    return json(res,200,clip?{id:clip.id,at:clip.at,source:clip.source,frameCount:clip.frameCount}:{created:false});
   }
   // Диагностика ONVIF-детекторов: статус по каждой камере + агрегат (без паролей).
   if(route==='yard-onvif'&&req.method==='GET'){
    const enabled=p.preferences.yard_onvif_enabled!==false;
    const configured=yardOnvifEnsure(p.preferences);
    const cams=yardOnvifStatuses();
    const aliveCam=cams.filter(c=>c.alive);
    const lastMotionAt=cams.reduce((m,c)=>Math.max(m,c.lastMotionAt||0),0);
    return json(res,200,{enabled,configured,alive:aliveCam.length>0,
     subscription:aliveCam[0]?.subscription||null,lastMotionAt:lastMotionAt||null,
     lastError:cams.find(c=>c.lastError)?.lastError||null,
     restarts:cams.reduce((m,c)=>Math.max(m,c.restarts||0),0),
     fallback:!configured||!aliveCam.length,
     cameras:cams.map(({name,host,port,alive,subscription,lastMotionAt:at,lastError,restarts:r})=>({name,host,port,alive,subscription:subscription||null,lastMotionAt:at||null,lastError:lastError||null,restarts:r||0}))});
   }
   // Хроника дома (3.5.0): лента пользовательских событий, фильтр по типу.
   if(route==='events'&&req.method==='GET'){
    const limit=Math.min(200,Math.max(1,Number(url.searchParams.get('limit'))||120));
    const type=url.searchParams.get('type');
    const rows=type&&['yard','door','light','meter','system','guard'].includes(type)
     ?db.prepare('SELECT * FROM events WHERE type=? ORDER BY id DESC LIMIT ?').all(type,limit)
     :db.prepare('SELECT * FROM events ORDER BY id DESC LIMIT ?').all(limit);
    // клипы двора: кадр-каунт для щитка (ref 'clip:<id>')
    const clipCount=db.prepare('SELECT frames FROM yard_clips WHERE id=?');
    const events=rows.map(r=>{
     const ref=typeof r.ref==='string'&&r.ref.startsWith('clip:')?Number(r.ref.slice(5)):null;
     if(ref===null||!Number.isInteger(ref))return {...r,frameCount:0};
     let frameCount=1;
     try{frameCount=JSON.parse(clipCount.get(ref)?.frames??'[]').length}catch{}
     return {...r,frameCount};
    });
    return json(res,200,{events});
   }
   // 3.6.0: аналитика из хроники — свет/двери по дням, двор по часам (14 дней).
   if(route==='analytics'&&req.method==='GET'){
    const rows=db.prepare('SELECT at,type,text FROM events WHERE at>? ORDER BY at ASC').all(Date.now()-14*86400000);
    return json(res,200,computeAnalytics(rows));
   }
   // 3.7.0: охрана — статус и команды взвода/снятия.
   if(route==='guard'&&req.method==='GET'){
    const prefs=p.preferences,doors=await guardDoors().catch(()=>[]);
    return json(res,200,{armed:prefs.guardArmedAway===true,
     exitRemaining:guard.exitUntil>Date.now()?Math.round((guard.exitUntil-Date.now())/1000):0,
     alarm:guard.alarm?{doorName:guard.alarm.doorName,startedAt:guard.alarm.startedAt}:null,
     flash:prefs.guardFlash,masterArms:prefs.guardMasterArms,
     doors:doors.map(d=>({name:d.name,open:d.open}))});
   }
   if(route==='guard'&&req.method==='POST'){
    const request=JSON.parse((await body(req)).toString());
    const prefs=p.preferences;
    if(request.action==='arm'){
     const doors=await guardDoors();
     const open=doors.find(d=>d.open);
     if(open)return json(res,409,{error:'Нельзя поставить на охрану: '+open.name+' открыта.'});
     prefs.guardArmedAway=true;
     db.prepare('UPDATE profiles SET preferences=? WHERE id=?').run(JSON.stringify(prefs),id);
     guard.exitUntil=Date.now()+prefs.guardExitDelay*1000*GUARD_SCALE;
     guard.armedBy='panel';
     await guardSwitchSet(true);
     await guardStopAlarm(true);
     recordEvent('guard','Охрана: выход, '+prefs.guardExitDelay+' с на дверь');
     return json(res,200,{armed:true,exitDelay:prefs.guardExitDelay});
    }
    if(request.action==='disarm'){
     const was=guard.alarm!==null;
     prefs.guardArmedAway=false;guard.armedBy=null;
     await guardSwitchSet(false);
     db.prepare('UPDATE profiles SET preferences=? WHERE id=?').run(JSON.stringify(prefs),id);
     guard.exitUntil=0;
     await guardStopAlarm();
     recordEvent('guard',was?'Охрана снята — сирена остановлена':'Охрана снята');
     return json(res,200,{armed:false});
    }
    if(request.action==='cancel-exit'){
     guard.exitUntil=0;prefs.guardArmedAway=false;
     db.prepare('UPDATE profiles SET preferences=? WHERE id=?').run(JSON.stringify(prefs),id);
     recordEvent('guard','Выход отменён — охрана не включена');
     return json(res,200,{armed:false});
    }
    return json(res,400,{error:'Неизвестное действие охраны.'});
   }
   // 3.4.6: поиск ONVIF-камер в локальной сети (WS-Discovery) — для формы в тех.разделе.
   if(route==='onvif-discover'&&req.method==='POST'){
    try{
     const found=await onvifDiscover({timeoutMs:3000});
     return json(res,200,{cameras:found});
    }catch(error){return json(res,200,{cameras:[],error:error.message})}
   }
   // Агрегированное здоровье системы: один GET, те же права, что у остальных API.
   if(route==='health'&&req.method==='GET'){
    const onvifOk=yardOnvifEnsure(p.preferences);
    const cams=yardOnvifStatuses();
    const aliveCam=cams.filter(c=>c.alive);
    const lastMotionAt=cams.reduce((m,c)=>Math.max(m,c.lastMotionAt||0),0);
    let sqliteKB=0;
    try{sqliteKB=Math.round((await stat(resolve(data,'panel.sqlite'))).size/1024)}catch{}
    return json(res,200,{
     ha:{enabled:ha.enabled,connected:ha.enabled&&live.states.length>0,lastError:live.lastError||null,latencyMs:live.lastLatencyMs},
     onvif:{enabled:p.preferences.yard_onvif_enabled!==false,configured:onvifOk,alive:aliveCam.length>0,
      subscription:aliveCam[0]?.subscription||null,lastMotionAt:lastMotionAt||null,
      lastError:cams.find(c=>c.lastError)?.lastError||null,fallback:!onvifOk||!aliveCam.length,
      cameras:cams.map(({name,host,port,alive,subscription,lastMotionAt:at,lastError,restarts:r})=>({name,host,port,alive,subscription:subscription||null,lastMotionAt:at||null,lastError:lastError||null,restarts:r||0}))},
     sse:{clients:live.clients.size},
     disk:{sqliteKB,backups:db.prepare('SELECT COUNT(*) c FROM profile_backups').get().c},
     uptime:{seconds:Math.floor((Date.now()-startedAt)/1000)},
     version:PANEL_VERSION,
     journal:journalList()
    });
   }
   // 3.3.3 «Бэкап профиля в один тап»: серверный снимок текущего профиля в
   // profile_backups (не путать с profile/export — скачиванием файла).
   if(route==='profile-snapshot'&&req.method==='POST'){
    const existing=db.prepare("SELECT COUNT(*) c FROM profile_backups WHERE profile_id=? AND reason LIKE 'manual%'").get(id).c;
    const reason=existing?'manual-'+(existing+1):'manual';
    db.prepare('INSERT OR REPLACE INTO profile_backups(profile_id,reason,preferences) VALUES(?,?,?)').run(id,reason,JSON.stringify(p.preferences));
    const saved=db.prepare('SELECT COUNT(*) c FROM profile_backups').get().c;
    journal('Профиль: ручной снимок сохранён (всего снимков '+saved+')');
    return json(res,200,{ok:true,saved});
   }
   if(route==='ha/weather-forecast'&&req.method==='GET'){
    const asked=url.searchParams.get('entity')||'',entityId=/^weather\.[a-z0-9_]+$/.test(asked)?asked:(await ha.states()).find(e=>e.entity_id.startsWith('weather.'))?.entity_id||'';
    if(!entityId)return json(res,400,{error:'Сущность погоды не найдена в Home Assistant.'});
    if(forecastCache&&forecastKey===entityId&&Date.now()-forecastCache.at<15*60*1000)return json(res,200,{...forecastCache.data,cached:true});
    const data={entityId,forecast:await ha.weatherForecast(entityId)};
    forecastCache={at:Date.now(),data};forecastKey=entityId;
    return json(res,200,data);
   }
    // Электроэнергия: показания/потребление/дата показаний из состояний + расход за сутки и неделю из истории.
    if(route==='ha/energy'&&req.method==='GET'){
     if(!ha.enabled)throw new Error('Home Assistant не настроен. Расход электроэнергии недоступен.');
     const all=await ha.states();
     // Счётчик ТНС: sensor.* с schetchik/meter, без signal; суффиксы как в src/energy.js.
     const list=all.filter(e=>typeof e?.entity_id==='string'&&e.entity_id.startsWith('sensor.')&&/schetchik|meter/.test(e.entity_id)&&!/signal/.test(e.entity_id));
     const by=tag=>list.find(e=>e.entity_id.endsWith('_'+tag))||null;
     const reading=by('reading'),consumption=by('consumption'),meterNumber=by('meter_number'),readingsDate=by('readings_date');
     const readingValue=meterValue(reading);
     // Кеш валиден только для той же пары «значение + дата показаний»: ТНС может
     // отдать новый съём раньше, чем истечёт минута — тогда кеш не мешает.
     const cacheKey=String(readingValue)+'|'+String(readingsDate?.state??'');
     if(energyCache&&Date.now()-energyCache.at<60000&&energyCache.key===cacheKey)return json(res,200,{...energyCache.data,cached:true});
     // Автопополнение истории показаний (3.2.7): свежий съём ТНС сам попадает в
     // energy_readings профиля. Новая дата позже максимума — добавляется; та же
     // дата с другим значением — обновляется (уточнение съёма за тот же день);
     // дата старше максимума (откат счётчика) или невалидное показание — молча
     // игнорируются. Запись через тот же sanitize-путь, что и PUT preferences.
     const autoDate=String(readingsDate?.state??'');
     if(readingValue!==null&&Number.isInteger(readingValue)&&readingValue>0&&/^\d{4}-\d{2}-\d{2}$/.test(autoDate)){
      const readings=Array.isArray(p.preferences.energy_readings)?p.preferences.energy_readings:[];
      const existing=readings.find(r=>r?.date===autoDate);
      const maxDate=readings.reduce((m,r)=>String(r?.date)>m?String(r.date):m,'');
      const candidate=existing
       ?(existing.value!==readingValue?readings.map(r=>r?.date===autoDate?{date:autoDate,value:readingValue}:r):null)
       :(autoDate>maxDate?[...readings,{date:autoDate,value:readingValue}]:null);
      if(candidate)try{
       const nextReadings=sanitizeEnergyReadings(candidate);
       if(JSON.stringify(nextReadings)!==JSON.stringify(readings)){
        p.preferences.energy_readings=nextReadings;
        db.prepare('UPDATE profiles SET preferences=? WHERE id=?').run(JSON.stringify(p.preferences),id);
        energyCache=null;energyLastKnown=null;
        console.log('Energy: показания ТНС '+autoDate+' = '+readingValue+' автоматически добавлены в историю ('+nextReadings.length+' записей).');
        journal('Счётчик ТНС: показания '+autoDate+' = '+readingValue+' добавлены в историю автоматически');
        recordEvent('meter','Показания ТНС: '+readingValue+' кВт·ч');
       }
      }catch(error){console.log('Energy: автопополнение отклонено: '+(error?.message||error))}
     }
     // Месячный расход: от последнего внесённого показания (профиль) до текущей
     // даты показаний — ТНС снимает показания раз в месяц. Расчёт живёт на
     // сервере: единый источник истины для карточки.
     const monthRaw=monthDelta(readingValue,readingsDate?.state,p.preferences.energy_readings);
     const month={...monthRaw,cost:monthCost(monthRaw.delta,p.preferences.energy_tariff),
      forecast:monthForecast(monthRaw),comparison:monthComparison(p.preferences.energy_readings,monthRaw)};
     // История показаний и тариф одним ответом: вкладка «Статистика» строит
     // месячный график без второго запроса. Компактный формат {date,value}, ≤36.
     const profileReadings=(Array.isArray(p.preferences.energy_readings)?p.preferences.energy_readings:[])
      .slice(-36).map(r=>({date:String(r?.date??''),value:Number(r?.value)}));
     const profileTariff=Number(p.preferences.energy_tariff);
     const tariff=Number.isFinite(profileTariff)&&profileTariff>0?profileTariff:null;
     // Окно 168 ч один раз: сутки — это первые 24 ч того же окна.
     const history=readingValue===null?[]:await ha.energyHistory(reading.entity_id,168);
     const data={reading:{value:readingValue,entityId:reading?.entity_id??null,updatedAt:reading?.last_updated??null},
      consumption:meterValue(consumption),meterNumber:meterNumber?.state??null,readingsDate:readingsDate?.state??null,
      deltas:energyDeltas(history),month,readings:profileReadings,tariff};
     // ТНС «мигает» (неудачный опрос помечает сущности unavailable): помним последние
     // валидные значения и отдаём их с пометкой stale, чтобы виджет не мигал.
     if(readingValue!==null||meterValue(consumption)!==null){energyLastKnown={at:Date.now(),data};data.stale=false}
     else{
      if(!energyLastKnown){
       // Первая загрузка после «мигания»: последняя валидная точка из истории HA.
       const hist=await ha.energyHistory((reading||readingsDate||{entity_id:''}).entity_id,168);
       const last=[...hist].reverse().find(p=>Number.isFinite(p.value));
       if(last)energyLastKnown={at:last.at,data:{reading:{value:last.value,entityId:reading?.entity_id??null,updatedAt:new Date(last.at).toISOString()},
        consumption:meterValue(consumption),meterNumber:meterNumber?.state??null,readingsDate:readingsDate?.state??null,deltas:energyDeltas(hist),
        month:{...monthRaw,delta:null,cost:null},readings:profileReadings,tariff}};
      }
      if(energyLastKnown)return json(res,200,{...energyLastKnown.data,stale:true,staleSince:energyLastKnown.at});
     }
     energyCache={at:Date.now(),data,key:cacheKey};
     return json(res,200,data);
    }

   if(route==='ha/stream'&&req.method==='GET'){
    if(req.headers['sec-fetch-site']==='cross-site')return json(res,403,{error:'Межсайтовый запрос запрещён.'});
    if(!ha.enabled)return json(res,400,{error:'Home Assistant не настроен.'});
    req.socket.setNoDelay(true);req.socket.setTimeout(0);req.setTimeout(0);
    const pid=req.headers['x-panel-id']||'',old=liveIds.get(pid);
    if(old&&!old.writableEnded)old.end();
    if(pid)liveIds.set(pid,res);
    res.on('close',()=>{if(liveIds.get(pid)===res)liveIds.delete(pid)});
    live.subscribe(res);return;
   }
   if(route==='device-model'&&req.method==='GET')return json(res,200,{version:1,devices:buildDeviceModel(p.preferences)});
   if(route==='ha/stream/start'&&req.method==='POST'){
    const request=JSON.parse((await body(req)).toString());
    return json(res,200,await streams.start(request.id,p.preferences,id));
   }
   if(route==='ha/rtc/start'&&req.method==='POST'){
    const request=JSON.parse((await body(req)).toString());
    return json(res,200,await rtc.start(request.id,p.preferences,id));
   }
   const rtcRoute=/^ha\/rtc\/([a-f0-9]{48})(?:\/(offer|candidate|events))?$/.exec(route);
   if(rtcRoute){
    const [,key,action]=rtcRoute;
    if(req.method==='DELETE'&&!action){rtc.get(key,id,p.preferences);rtc.close(key);return json(res,200,{stopped:true})}
    if(req.method==='GET'&&action==='events'){
     if(req.headers['sec-fetch-site']==='cross-site')throw new Error('Межсайтовый запрос запрещён.');
     if([...url.searchParams.keys()].some(k=>k!=='after'))throw new Error('Неверный параметр WebRTC.');
     return json(res,200,rtc.events(key,id,p.preferences,Number(url.searchParams.get('after')||0)));
    }
    if(req.method==='POST'&&['offer','candidate'].includes(action)){
     const request=JSON.parse((await body(req,140000)).toString());
     return json(res,200,action==='offer'?await rtc.offer(key,id,p.preferences,request.offer):await rtc.addCandidate(key,id,p.preferences,request.candidate));
    }
   }
   const streamRoute=/^ha\/stream\/([a-f0-9]{48})(?:\/(.+))?$/.exec(route);
   if(streamRoute){
    const [,key,asset]=streamRoute;
    if(req.method==='DELETE'&&!asset){streams.get(key,id,p.preferences);streams.close(key);return json(res,200,{stopped:true})}
    if(req.method==='GET'&&asset){
     if(req.headers['sec-fetch-site']==='cross-site')throw new Error('Межсайтовый запрос запрещён.');
     return await streams.proxy(key,asset,url.searchParams,id,p.preferences,req,res);
    }
   }
   if(route==='ha/camera'&&req.method==='POST'){
    const request=JSON.parse((await body(req)).toString()),image=await ha.camera(request.id,p.preferences);
    res.writeHead(200,{'Content-Type':image.type,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});return res.end(image.bytes);
   }
   // 3.4.6: самообновление аддона — только из локальной сети и только в режиме add-on.
   // addon-info: slug/версия через Supervisor (fallback — hostname контейнера).
   if(route==='addon-info'&&req.method==='GET'){
    if(!addon)throw new Error('Доступно только внутри Home Assistant.');
    let slug=null,version=null,source='supervisor';
    try{
     const r=await fetch('http://supervisor/addons/self/info',{headers:{Authorization:'Bearer '+process.env.SUPERVISOR_TOKEN}});
     if(r.ok){const info=await r.json();slug=info.data?.slug||null;version=info.data?.version||null}
    }catch{}
    if(!slug){slug=process.env.HOSTNAME||null;source='hostname'}
    return json(res,200,{addon:true,slug,version,source});
   }
   // addon-update: POST Supervisor /addons/self/update в фоне — контейнер
   // пересобирается и перезапускается, поэтому ответ уходит до завершения.
   if(route==='addon-update'&&req.method==='POST'){
    if(!addon)throw new Error('Доступно только внутри Home Assistant.');
    fetch('http://supervisor/addons/self/update',{method:'POST',headers:{Authorization:'Bearer '+process.env.SUPERVISOR_TOKEN}})
     .then(async r=>{
      const text=await r.text().catch(()=>'');
      journal(r.ok?'Обновление аддона запущено (Supervisor)':'Supervisor отклонил обновление: '+text.slice(0,200),r.ok?'info':'warn');
     })
     .catch(e=>journal('Обновление аддона не запущено: '+(e?.message||e),'warn'));
    return json(res,202,{started:true});
   }
   if(route==='ha/command'&&req.method==='POST'){
    if(assistantScopes.has(id))throw new Error('Дождись завершения действия станции.');
    const request=JSON.parse((await body(req)).toString());
    pendingScopes.set(id,(pendingScopes.get(id)||0)+1);
    try{
     const result=await ha.command(request,p.preferences);
     // Хроника (3.5.0): подтверждённая команда линии света → событие.
     try{
      const {key,action}=resolveAction(String(request.id||''),p.preferences.devices);
      const def=bindingDefinitions(p.preferences.devices).find(d=>d.id===key);
      if(def&&['light','rgb'].includes(def.type)){
       const verb=action==='brightness'?'яркость '+Math.round(Number(request.value))+' %':Number(request.value)?'включено':'выключено';
       recordEvent('light',def.name+': '+verb);
      }
     }catch{}
     return json(res,200,result);
    }
    finally{const n=pendingScopes.get(id)-1;if(n)pendingScopes.set(id,n);else pendingScopes.delete(id)}
   }
   // Код охраны валидируется в ha.alarmService и никогда не возвращается в ответах/ошибках.
   if(route==='ha/alarm'&&req.method==='POST'){
    const request=JSON.parse((await body(req)).toString());
    return json(res,200,await ha.alarmService(request?.service,request?.code));
   }
   if(route==='ha/shopping'&&req.method==='GET'){
    if(shoppingCache&&Date.now()-shoppingCache.at<10000)return json(res,200,{...shoppingCache.data,cached:true});
    const data=await ha.shoppingItems();shoppingCache={at:Date.now(),data};return json(res,200,data);
   }
   if(route==='ha/shopping'&&req.method==='POST'){
    const request=JSON.parse((await body(req)).toString());
    const result=await ha.shoppingMutate(request?.action==='complete'?'complete':'add',request?.target);
    if(Array.isArray(result.items))shoppingCache={at:Date.now(),data:{entity:'todo.shopping_list',count:result.items.length,items:result.items}};
    return json(res,200,{action:result.action,confirmed:result.confirmed,message:result.message,items:result.items});
   }
   if(route==='ha/announce'&&req.method==='POST'){
    const request=JSON.parse((await body(req)).toString());
    return json(res,200,await ha.announce(request?.text,p.preferences));
   }
   if(route==='ha/converse'&&req.method==='POST'){
    if(assistantScopes.has(id))throw new Error('Дождись завершения действия станции.');
    const request=JSON.parse((await body(req)).toString());
    return json(res,200,await ha.converse(request?.text));
   }
   if(route==='ha/scenario'&&req.method==='POST'){
    if(assistantScopes.has(id))throw new Error('Дождись завершения действия станции.');
    const request=JSON.parse((await body(req)).toString());
    pendingScopes.set(id,(pendingScopes.get(id)||0)+1);
    const scenarioId=String(request?.id||'');
    try{
     const result=scenarioId.startsWith('user-')?await runUserScenario(scenarioId,ha,p.preferences):await runScenario(scenarioId,ha,p.preferences);
     return json(res,200,result);
    }
    finally{const n=pendingScopes.get(id)-1;if(n)pendingScopes.set(id,n);else pendingScopes.delete(id)}
   }
   return json(res,404,{error:'Маршрут не найден.'});
  }
  if(req.method!=='GET'&&req.method!=='HEAD')return json(res,405,{error:'Метод запрещён.'});
  const relative=path==='/'?'index.html':path.slice(1);
  // Explicit allowlist: no SQLite database, secrets, server code or arbitrary file access.
  if(!/^(index\.html|sw\.js|style\.css|app\.js|manifest\.json|(?:model|chunk)-[A-Za-z0-9_-]+\.js|assets\/[A-Za-z0-9_./-]+\.(webp|woff2|ttf|txt|js|svg|json))$/.test(relative)||relative.includes('..'))return json(res,404,{error:'Файл не найден.'});
  const file=resolve(root,relative);
  await stat(file);
  const type={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.webp':'image/webp','.woff2':'font/woff2','.ttf':'font/ttf','.txt':'text/plain; charset=utf-8','.json':'application/manifest+json','.svg':'image/svg+xml'}[extname(file)]||'application/octet-stream';
  res.writeHead(200,{'Content-Type':type,'Cache-Control':'no-cache','X-Content-Type-Options':'nosniff','Referrer-Policy':'same-origin'});
  res.end(req.method==='HEAD'?undefined:await readFile(file));
 }catch(error){
  if(res.headersSent)return res.end();
  const message=error instanceof SyntaxError?'Некорректный JSON.':error.code==='ENOENT'?'Файл не найден.':error.message;
  json(res,error.code==='ENOENT'?404:400,{error:message,...(error.code==='PANEL_PROOF_REQUIRED'?{code:error.code}:{})});
 }
});
server.requestTimeout=25000;
server.listen(port,preview||addon?'0.0.0.0':'127.0.0.1',()=>{
 console.log(`Panel ready: port ${port} · ${addon?'Home Assistant add-on':preview?'private preview':'local only'} · HA ${ha.enabled?'configured':'not configured'}`);
  journal('Панель запущена: порт '+port+(addon?' · add-on':preview?' · превью':' · локально')+(ha.enabled?' · Home Assistant настроен':' · деморежим'));
 recordEvent('system','Панель запущена · версия '+PANEL_VERSION);
 if(process.platform==='win32'&&process.argv.includes('--open'))spawn('rundll32.exe',['url.dll,FileProtocolHandler',`http://127.0.0.1:${port}`],{stdio:'ignore'}).on('error',()=>{});
});
server.on('error',error=>{console.error(error.code==='EADDRINUSE'?`Port ${port} is busy. Close the other panel server or set PORT in .env.`:'Panel server could not start.');process.exitCode=1});
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>server.close(()=>{live.stop();db.close();process.exit(0)}));
