import http from 'node:http';
import {readFile,stat,mkdir} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {spawn} from 'node:child_process';
import {isIP} from 'node:net';
import {randomBytes,createHash,timingSafeEqual} from 'node:crypto';
import Database from 'better-sqlite3';
import {defaultPreferences,validatePreferences,bindingDefinitions} from '../src/preferences.js';
import {HomeAssistant} from './ha.js';
import {CameraStreams} from './stream.js';
import {CameraRTC} from './rtc.js';
import {LiveFeed} from './live-stream.js';
import {YardMotion} from './yard-motion.js';
import {onvifWatch} from './yard-onvif.js';
import {meterValue} from '../src/energy.js';
import {energyDeltas} from './ha.js';

import {deviceTypes,samePhysicalDevice} from '../src/catalog.js';
import {migrateHouseProfile,activateHouseProfile,bindingProblem} from '../src/house-profile.js';
import {seedDeviceModel,buildDeviceModel} from '../src/device-model.js';
import {loadHistory} from './history.js';
import {StationAssistant} from './assistant.js';
import {runScenario,runUserScenario} from './scenarios.js';

const port=Number(process.env.PORT||8080),preview=process.env.PANEL_PREVIEW==='1';
const startedAt=Date.now();
let PANEL_VERSION='3.2.0';
try{PANEL_VERSION=JSON.parse(await readFile(resolve('addon/home-panel/manifest.json'),'utf8')).version||PANEL_VERSION}catch{}
const addon=process.env.PANEL_ADDON==='1';
if(addon&&preview)throw new Error('Home Panel: add-on must not run in preview mode.');
const root=resolve(process.env.PANEL_ROOT||'dist'),data=resolve(process.env.PANEL_DATA||'data');
await mkdir(data,{recursive:true});
const db=new Database(resolve(data,'panel.sqlite'));
db.pragma('journal_mode = WAL');
db.exec('CREATE TABLE IF NOT EXISTS profiles (id TEXT PRIMARY KEY, preferences TEXT NOT NULL, photo BLOB);');
db.exec('CREATE TABLE IF NOT EXISTS profile_backups (profile_id TEXT NOT NULL, reason TEXT NOT NULL, preferences TEXT NOT NULL, PRIMARY KEY(profile_id,reason));');
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
let yardOnvifWatch=null,yardOnvifConfigKey='';
const clientPreferences=prefs=>{const c={...prefs};delete c.yard_onvif_pass;return c};
const yardOnvifStatus=()=>yardOnvifWatch?.status?.()||null;
const yardOnvifEnsure=prefs=>{
 // Тумблер ONVIF-датчика (preferences.yard_onvif_enabled, по умолчанию включено):
 // выключен → watcher останавливается, движение двора ловит jpeg-диффер (резерв).
 if(prefs.yard_onvif_enabled===false){if(yardOnvifWatch){yardOnvifWatch.stop();yardOnvifWatch=null;yardOnvifConfigKey=''}return false}
 let host=String(prefs.yard_onvif_host||'').trim()||'192.168.8.204',port;
 // host может быть 'ip:port' (как в статусе живой камеры): разделяем, иначе порт 2020.
 const colon=host.match(/^([\w.\[\]:-]+):(\d+)$/);
 if(colon){host=colon[1].replace(/^\[|\]$/g,'');port=Number(colon[2])}
 const user=String(prefs.yard_onvif_user||'').trim(),pass=String(prefs.yard_onvif_pass||'');
 if(!user){if(yardOnvifWatch){yardOnvifWatch.stop();yardOnvifWatch=null;yardOnvifConfigKey=''}return false}
 const key=host+'|'+port+'|'+user+'|'+pass;
 if(yardOnvifWatch&&key===yardOnvifConfigKey)return true;
 if(yardOnvifWatch)yardOnvifWatch.stop();
 yardOnvifConfigKey=key;
 yardOnvifWatch=onvifWatch({host,...(port?{port}:{}) ,user,pass,
  onMotion:()=>yardMotion.externalMotion(),
  onError:error=>console.log('Yard ONVIF fallback to jpeg diff:',error?.message||error)});
 return true;
};

const proofs=new Map(),pendingScopes=new Map();
const live=new LiveFeed({ha}),liveIds=new Map();
let forecastCache=null,forecastKey='',shoppingCache=null,energyCache=null,energyLastKnown=null;
const getProfile=id=>{
 let row=db.prepare('SELECT * FROM profiles WHERE id=?').get(id);
 if(!row){db.prepare('INSERT INTO profiles(id,preferences) VALUES(?,?)').run(id,JSON.stringify(defaultPreferences()));row=db.prepare('SELECT * FROM profiles WHERE id=?').get(id)}
 const raw=JSON.parse(row.preferences),stored=validatePreferences(raw);
 let preferences=migrateHouseProfile(stored);
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
   /^172\.(1[6-9]|2\d|3[01])\./.test(ip)));
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
    return json(res,200,{...(await yardMotion.check(yardCameraEntity(p.preferences))),checkedAt:Date.now()});
   }
   // Диагностика ONVIF-детектора двора: статус для живой панели (без пароля).
   if(route==='yard-onvif'&&req.method==='GET'){
    const enabled=p.preferences.yard_onvif_enabled!==false;
    const configured=yardOnvifEnsure(p.preferences);
    const s=yardOnvifStatus()||{};
    return json(res,200,{enabled,configured,alive:!!s.alive,eventService:s.eventService||null,
     subscription:s.subscription||null,lastMotionAt:s.lastMotionAt||null,lastError:s.lastError||null,
     restarts:s.restarts||0,fallback:!configured||!s.alive});
   }
   // Агрегированное здоровье системы: один GET, те же права, что у остальных API.
   if(route==='health'&&req.method==='GET'){
    const onvifOk=yardOnvifEnsure(p.preferences),onvifStatus=yardOnvifStatus()||{};
    let sqliteKB=0;
    try{sqliteKB=Math.round((await stat(resolve(data,'panel.sqlite'))).size/1024)}catch{}
    return json(res,200,{
     ha:{enabled:ha.enabled,connected:ha.enabled&&live.states.length>0,lastError:live.lastError||null,latencyMs:live.lastLatencyMs},
     onvif:{enabled:p.preferences.yard_onvif_enabled!==false,configured:onvifOk,alive:!!onvifStatus.alive,
      subscription:onvifStatus.subscription||null,lastMotionAt:onvifStatus.lastMotionAt||null,
      lastError:onvifStatus.lastError||null,fallback:!onvifOk||!onvifStatus.alive},
     sse:{clients:live.clients.size},
     disk:{sqliteKB,backups:db.prepare('SELECT COUNT(*) c FROM profile_backups').get().c},
     uptime:{seconds:Math.floor((Date.now()-startedAt)/1000)},
     version:PANEL_VERSION
    });
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
     if(energyCache&&Date.now()-energyCache.at<60000)return json(res,200,{...energyCache.data,cached:true});
     if(!ha.enabled)throw new Error('Home Assistant не настроен. Расход электроэнергии недоступен.');
     const all=await ha.states();
     // Счётчик ТНС: sensor.* с schetchik/meter, без signal; суффиксы как в src/energy.js.
     const list=all.filter(e=>typeof e?.entity_id==='string'&&e.entity_id.startsWith('sensor.')&&/schetchik|meter/.test(e.entity_id)&&!/signal/.test(e.entity_id));
     const by=tag=>list.find(e=>e.entity_id.endsWith('_'+tag))||null;
     const reading=by('reading'),consumption=by('consumption'),meterNumber=by('meter_number'),readingsDate=by('readings_date');
     const readingValue=meterValue(reading);
     // Окно 168 ч один раз: сутки — это первые 24 ч того же окна.
     const history=readingValue===null?[]:await ha.energyHistory(reading.entity_id,168);
     const data={reading:{value:readingValue,entityId:reading?.entity_id??null,updatedAt:reading?.last_updated??null},
      consumption:meterValue(consumption),meterNumber:meterNumber?.state??null,readingsDate:readingsDate?.state??null,
      deltas:energyDeltas(history)};
     // ТНС «мигает» (неудачный опрос помечает сущности unavailable): помним последние
     // валидные значения и отдаём их с пометкой stale, чтобы виджет не мигал.
     if(readingValue!==null||meterValue(consumption)!==null){energyLastKnown={at:Date.now(),data};data.stale=false}
     else{
      if(!energyLastKnown){
       // Первая загрузка после «мигания»: последняя валидная точка из истории HA.
       const hist=await ha.energyHistory((reading||readingsDate||{entity_id:''}).entity_id,168);
       const last=[...hist].reverse().find(p=>Number.isFinite(p.value));
       if(last)energyLastKnown={at:last.at,data:{reading:{value:last.value,entityId:reading?.entity_id??null,updatedAt:new Date(last.at).toISOString()},
        consumption:meterValue(consumption),meterNumber:meterNumber?.state??null,readingsDate:readingsDate?.state??null,deltas:energyDeltas(hist)}};
      }
      if(energyLastKnown)return json(res,200,{...energyLastKnown.data,stale:true,staleSince:energyLastKnown.at});
     }
     energyCache={at:Date.now(),data};
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
   if(route==='ha/command'&&req.method==='POST'){
    if(assistantScopes.has(id))throw new Error('Дождись завершения действия станции.');
    const request=JSON.parse((await body(req)).toString());
    pendingScopes.set(id,(pendingScopes.get(id)||0)+1);
    try{return json(res,200,await ha.command(request,p.preferences))}
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
  if(!/^(index\.html|sw\.js|style\.css|app\.js|(?:model|chunk)-[A-Za-z0-9_-]+\.js|assets\/[A-Za-z0-9_./-]+\.(webp|woff2|ttf|txt|js))$/.test(relative)||relative.includes('..'))return json(res,404,{error:'Файл не найден.'});
  const file=resolve(root,relative);
  await stat(file);
  const type={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.webp':'image/webp','.woff2':'font/woff2','.ttf':'font/ttf','.txt':'text/plain; charset=utf-8'}[extname(file)];
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
 if(process.platform==='win32'&&process.argv.includes('--open'))spawn('rundll32.exe',['url.dll,FileProtocolHandler',`http://127.0.0.1:${port}`],{stdio:'ignore'}).on('error',()=>{});
});
server.on('error',error=>{console.error(error.code==='EADDRINUSE'?`Port ${port} is busy. Close the other panel server or set PORT in .env.`:'Panel server could not start.');process.exitCode=1});
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>server.close(()=>{live.stop();db.close();process.exit(0)}));
