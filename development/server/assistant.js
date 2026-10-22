import {createHash} from 'node:crypto';
import {stationAvailable,stationSupports} from '../src/station.js';
import {binaryValue} from '../src/sensor-state.js';
import {numericReading} from '../src/readings.js';
const DEFAULTS={leakAlerts:true,doorAlerts:true,doorMinutes:10,quietNight:true,volume:0.45,cameraName:'двор'};
const PLAY_MEDIA=512;
const labels={brief:'Сводка дома',announce:'Объявление',leave:'Я ухожу',camera:'Двор на экране',timer:'Таймер',cancelTimers:'Отмена таймеров',favorite:'Моя волна',weather:'Погода',shoppingAdd:'Добавление покупки',shoppingComplete:'Покупка выполнена',shoppingSync:'Синхронизация покупок',alert:'Голосовое предупреждение'};
const todo='todo.shopping_list';
export function validateAssistantSettings(input){
 if(!input||typeof input!=='object'||Array.isArray(input)||Object.keys(input).some(k=>!Object.prototype.hasOwnProperty.call(DEFAULTS,k)))throw new Error('Неверные настройки станции.');
 const s={...DEFAULTS,...input};
 if(['leakAlerts','doorAlerts','quietNight'].some(k=>typeof s[k]!=='boolean'))throw new Error('Неверные переключатели оповещений.');
 if(!Number.isInteger(s.doorMinutes)||s.doorMinutes<5||s.doorMinutes>60)throw new Error('Напоминание о двери: от 5 до 60 минут.');
 if(!Number.isFinite(s.volume)||s.volume<.1||s.volume>.7)throw new Error('Громкость объявления: 10–70%.');
 if(typeof s.cameraName!=='string'||!s.cameraName.trim()||s.cameraName.length>40||!/^[- а-яёa-z0-9]+$/iu.test(s.cameraName)||/(^|\s)(и|затем|потом|включи|выключи|открой|закрой|удали|скажи|отмени)(\s|$)/iu.test(s.cameraName))throw new Error('Укажи только короткое имя камеры, не команду.');
 s.cameraName=s.cameraName.trim();return s;
}
export function homeBrief(p,states){
 const byId=new Map(states.map(e=>[e.entity_id,e]));
 const read=id=>{const d=p.devices.find(d=>d.id===id),b=p.bindings[id];return d?.status==='installed'&&b?.verified?byId.get(b.entityId):null};
 const parts=['По HA:'];
 for(const [id,name]of [['leak:utility','котельная'],['leak:bath','ванная']])if(binaryValue('leak',read(id)?.state)===true)parts.push('протечка, '+name+'.');
 const missing=[['door','вход'],['terrace-door','терраса'],['leak:utility','котельная'],['leak:bath','ванная']].filter(([id])=>{
  const d=p.devices.find(d=>d.id===id&&d.status==='installed');return d&&binaryValue(d.type,read(id)?.state)===null;
 }).map(([,name])=>name);
 if(missing.length)parts.push('нет данных: '+missing.join(', ')+'.');
 for(const [id,name]of [['door','вход'],['terrace-door','терраса']]){
  const v=binaryValue('door',read(id)?.state);
  if(v===true)parts.push(name+' открыт'+(id==='terrace-door'?'а':'')+'.');
 }
 const lights=p.devices.filter(d=>d.status==='installed'&&['light','rgb'].includes(d.type));
 const unknown=lights.filter(d=>!['on','off'].includes(read(d.id)?.state)).length;
 const on=lights.filter(d=>read(d.id)?.state==='on').length;
 parts.push(!lights.length?'нет линий света.':unknown?`свет: ${on} включено, ${unknown} неизвестно.`:on?`свет: ${on} включено.`:'свет выключен.');
 for(const [id,name]of [['temperature:living','гостиная'],['temperature:well','скважина']]){
  const v=numericReading(read(id),{unit:'°C'});
  parts.push(v.available?`${name} ${String(v.value).replace('.',',')} градуса.`:`${name}: нет данных.`);
 }
 let text='';
 for(const part of parts)if((text+' '+part).trim().length<=100)text=(text+' '+part).trim();
 return text;
}
export class StationAssistant{
 constructor(ha,db,profiles,{now=()=>Date.now()}={}){
  this.ha=ha;this.db=db;this.profiles=profiles;this.now=now;this.ticking=false;
  // Additive tables only. The profile and settings v3 remain untouched.
  db.exec(`CREATE TABLE IF NOT EXISTS assistant_settings(profile_id TEXT PRIMARY KEY,settings TEXT NOT NULL);
   CREATE TABLE IF NOT EXISTS assistant_requests(profile_id TEXT NOT NULL,request_id TEXT NOT NULL,fingerprint TEXT NOT NULL,action TEXT NOT NULL,status TEXT NOT NULL,result TEXT,created_at INTEGER NOT NULL,PRIMARY KEY(profile_id,request_id));
   CREATE TABLE IF NOT EXISTS assistant_observations(profile_id TEXT NOT NULL,device_id TEXT NOT NULL,entity_id TEXT NOT NULL,active INTEGER NOT NULL,opened_at INTEGER,notified INTEGER NOT NULL DEFAULT 0,PRIMARY KEY(profile_id,device_id,entity_id));
   CREATE INDEX IF NOT EXISTS assistant_requests_by_profile_time ON assistant_requests(profile_id,created_at DESC);`);
 }
 settings(id){const row=this.db.prepare('SELECT settings FROM assistant_settings WHERE profile_id=?').get(id);return row?validateAssistantSettings(JSON.parse(row.settings)):{...DEFAULTS}}
 saveSettings(id,input){const s=validateAssistantSettings(input);this.db.prepare('INSERT INTO assistant_settings VALUES(?,?) ON CONFLICT(profile_id) DO UPDATE SET settings=excluded.settings').run(id,JSON.stringify(s));return s}
 requireLive(p){if(!this.ha.enabled||p.mode!=='live')throw new Error('Действия станции доступны только в рабочем режиме с HA. Демо ничего не отправляет.')}
 binding(p){
  this.requireLive(p);const b=p.bindings.station,d=p.devices.find(d=>d.id==='station');
  if(d?.type!=='station'||d.status!=='installed'||!b?.verified||!/^media_player\.[a-z0-9_]+$/.test(b.entityId))throw new Error('Станция не привязана или не проверена.');
  return b.entityId;
 }
 features(e){return {available:stationAvailable(e),playMedia:stationAvailable(e)&&!!(Number(e.attributes?.supported_features)&PLAY_MEDIA),local:stationAvailable(e)&&typeof e?.attributes?.alice_state==='string'&&e.attributes.alice_state.length>0&&!!(Number(e.attributes?.supported_features)&1)&&e.attributes.assumed_state!==true}}
 async status(id,p){
  this.requireLive(p);const entity=this.binding(p),states=await this.ha.states(),station=states.find(e=>e.entity_id===entity);
  const f=this.features(station),settings=this.settings(id),read=key=>{const b=p.bindings[key];return b?.verified?states.find(e=>e.entity_id===b.entityId):null};
  const lights=p.devices.filter(d=>['light','rgb'].includes(d.type)&&d.status==='installed'&&d.masterOff&&read(d.id)?.state==='on').map(d=>({id:d.id,name:d.name,room:d.room}));
  const warnings=[];
  for(const d of p.devices.filter(d=>d.status==='installed'&&['door','leak'].includes(d.type))){
   const v=binaryValue(d.type,read(d.id)?.state);if(v!==false)warnings.push({id:d.id,name:d.name,room:d.room,kind:v===true?(d.type==='leak'?'alarm':'open'):'unknown'});
  }
  for(const d of p.devices.filter(d=>d.status==='installed'&&['light','rgb'].includes(d.type)&&d.masterOff))if(!['on','off'].includes(read(d.id)?.state))warnings.push({id:d.id,name:d.name,room:d.room,kind:'unknown'});
  return {...f,entity,brief:homeBrief(p,states),settings,leave:{lights,pause:station?.state==='playing'&&stationSupports(station,'playing',false),warnings},
   automation:{pollEverySeconds:15,lastPollAt:this.lastPollAt||null,lastError:this.lastError||null},
   activity:this.db.prepare('SELECT action,status,created_at FROM assistant_requests WHERE profile_id=? ORDER BY created_at DESC LIMIT 8').all(id).map(r=>({...r,label:labels[r.action]||r.action}))};
 }
 async sendMedia(p,type,text,{volume,localOnly=false}={}){
  const entity=this.binding(p);
  if(this.ha.pending.has(entity))throw new Error('Станция занята. Дождись завершения предыдущего действия.');
  this.ha.pending.add(entity);
  try{
   const e=await this.ha.request('/api/states/'+entity),f=this.features(e);
   if(!f.playMedia)throw new Error('Станция недоступна или play_media не поддерживается.');
   if(localOnly&&!f.local)throw new Error('Нужна подтверждённая локальная связь со станцией.');
   await this.ha.request('/api/services/media_player/play_media',{entity_id:entity,media_content_type:type,media_content_id:text,
    ...(type==='text'&&f.local&&volume!==undefined?{extra:{volume_level:volume}}:{})},{timeout:type==='shopping_list'?45000:6000});
   return {phase:'accepted',message:'HA принял запрос. Фактическое озвучивание или выполнение станцией не подтверждено.'};
  }finally{this.ha.pending.delete(entity)}
 }
 async shopping(p){
  this.requireLive(p);
  const e=await this.ha.request('/api/states/'+todo);
  if(['unknown','unavailable'].includes(e.state)||e.entity_id!==todo)throw new Error('Список todo.shopping_list недоступен. Добавь стандартный список покупок в HA.');
  const result=await this.ha.request('/api/services/todo/get_items?return_response',{entity_id:todo,status:'needs_action'});
  const items=result?.service_response?.[todo]?.items;
  if(!Array.isArray(items))throw new Error('HA не вернул содержимое списка покупок.');
  return {entity:todo,items:items.slice(0,100).filter(i=>typeof i.uid==='string'&&typeof i.summary==='string').map(i=>({uid:i.uid,summary:i.summary,status:i.status})),truncated:items.length>100};
 }
 validateAction(r){
  if(!r||!Object.prototype.hasOwnProperty.call(labels,r.action)||r.action==='alert')throw new Error('Действие запрещено.');
  if(typeof r.requestId!=='string'||!/^[a-zA-Z0-9_-]{8,80}$/.test(r.requestId))throw new Error('Нет уникального идентификатора запроса.');
  if(['leave','camera','shoppingSync','cancelTimers'].includes(r.action)&&r.confirmed!==true)throw new Error('Сначала подтверди действие и его область.');
  if(r.action==='announce'&&(typeof r.text!=='string'||!r.text.trim()||r.text.length>100||/[<>\x00-\x08\x0b-\x1f]/.test(r.text)))throw new Error('Объявление: 1–100 символов обычного текста, без разметки.');
  if(r.action==='timer'&&(!Number.isInteger(r.minutes)||r.minutes<1||r.minutes>180))throw new Error('Таймер: от 1 до 180 минут.');
  if(r.action==='shoppingAdd'&&(typeof r.item!=='string'||!r.item.trim()||r.item.length>160||/[\x00-\x1f]/.test(r.item)))throw new Error('Покупка: 1–160 символов.');
  if(r.action==='shoppingComplete'&&(typeof r.uid!=='string'||r.uid.length>200))throw new Error('Неверная запись списка.');
  if(Object.keys(r).some(k=>!['action','requestId','confirmed','text','minutes','item','uid'].includes(k)))throw new Error('Лишние параметры действия.');
 }
 async execute(id,p,r){
  this.requireLive(p);this.validateAction(r);
  const fingerprint=createHash('sha256').update(JSON.stringify(r)).digest('hex');
  const previous=this.db.prepare('SELECT * FROM assistant_requests WHERE profile_id=? AND request_id=?').get(id,r.requestId);
  if(previous){
   if(previous.fingerprint!==fingerprint)throw new Error('Идентификатор уже принадлежит другому запросу.');
   return previous.result?JSON.parse(previous.result):{phase:'unknown',message:'Этот запрос уже принят или был прерван. Повтора нет; проверь станцию.'};
  }
  this.db.prepare('INSERT INTO assistant_requests VALUES(?,?,?,?,?,?,?)').run(id,r.requestId,fingerprint,r.action,'running',null,this.now());
  try{
   const result=await this.perform(id,p,r);
   this.db.prepare('UPDATE assistant_requests SET status=?,result=? WHERE profile_id=? AND request_id=?').run(result.phase,JSON.stringify(result),id,r.requestId);
   return result;
  }catch(error){
   const result={phase:'unknown',message:error.message+' Автоповтора нет. Если запрос дошёл до HA, действие могло выполниться.'};
   this.db.prepare('UPDATE assistant_requests SET status=?,result=? WHERE profile_id=? AND request_id=?').run('unknown',JSON.stringify(result),id,r.requestId);
   return result;
  }
 }
 async perform(id,p,r){
  const settings=this.settings(id);
  if(r.action==='brief')return this.sendMedia(p,'text',homeBrief(p,await this.ha.states()),{volume:settings.volume});
  if(r.action==='announce')return this.sendMedia(p,'text',r.text.trim(),{volume:settings.volume});
  if(r.action==='camera')return this.sendMedia(p,'command','Покажи камеру '+settings.cameraName);
  if(r.action==='timer')return this.sendMedia(p,'command',`Поставь таймер на ${r.minutes} минут`);
  if(r.action==='cancelTimers')return this.sendMedia(p,'command','Отмени все таймеры');
  if(r.action==='favorite')return this.sendMedia(p,'command','Включи мою волну');
  if(r.action==='weather')return this.sendMedia(p,'command','Какая сегодня погода');
  if(r.action==='shoppingSync')return this.sendMedia(p,'shopping_list',todo,{localOnly:true});
  if(['shoppingAdd','shoppingComplete'].includes(r.action)){
   const before=await this.shopping(p);
   if(r.action==='shoppingComplete'&&!before.items.some(i=>i.uid===r.uid))throw new Error('Запись уже отсутствует. Обнови список.');
   await this.ha.request('/api/services/todo/'+(r.action==='shoppingAdd'?'add_item':'update_item'),{entity_id:todo,...(r.action==='shoppingAdd'?{item:r.item.trim()}:{item:r.uid,status:'completed'})});
   const after=await this.shopping(p);
   const confirmed=r.action==='shoppingComplete'?!after.items.some(i=>i.uid===r.uid):after.items.some(i=>i.summary===r.item.trim()&&!before.items.some(b=>b.uid===i.uid));
   return {phase:confirmed?'confirmed':'accepted',message:confirmed?'Изменение списка подтверждено чтением HA.':'HA принял изменение; проверь список.',shopping:after};
  }
  if(r.action==='leave'){
   const snapshot=await this.status(id,p);
   const results=await Promise.all(snapshot.leave.lights.map(async d=>{
    try{await this.ha.command({id:d.id,value:false},p);return {name:d.name,room:d.room,ok:true}}catch(error){return {name:d.name,room:d.room,ok:false,message:error.message}}
   }));
   if(snapshot.leave.pause)try{await this.ha.command({id:'station:playing',value:false},p)}catch(error){results.push({name:'Музыка',ok:false,message:error.message})}
   let speech;
   try{speech=await this.sendMedia(p,'text',homeBrief(p,await this.ha.states()),{volume:settings.volume})}catch(error){speech={phase:'unknown',message:error.message}}
   const warnings=(await this.status(id,p)).leave.warnings,ok=results.every(r=>r.ok)&&!warnings.some(w=>w.kind==='unknown');
   return {phase:ok?'confirmed':'partial',message:`По данным HA выключено линий: ${results.filter(r=>r.ok).length}/${snapshot.leave.lights.length}. ${ok?'Проверь замечания по дверям и датчикам.':'Не всё подтверждено; проверь устройства.'}`,results,speech,warnings};
  }
  throw new Error('Действие запрещено.');
 }
 async tick(){
  if(this.ticking||!this.ha.enabled)return;this.ticking=true;
  try{
   const profiles=this.profiles().filter(x=>x.preferences.mode==='live');if(!profiles.length)return;
   const states=await this.ha.states(),byId=new Map(states.map(e=>[e.entity_id,e])),now=this.now();this.lastPollAt=now;this.lastError=null;
   for(const {id,preferences:p}of profiles){
    const b=p.bindings.station;if(!b?.verified)continue;
    const f=this.features(byId.get(b.entityId)),canSpeak=f.playMedia&&f.local&&!this.ha.pending.has(b.entityId)&&p.devices.some(d=>d.id==='station'&&d.type==='station'&&d.status==='installed')&&byId.get(b.entityId).attributes.alice_state.toUpperCase()==='IDLE';
    const s=this.settings(id),hour=Number(new Intl.DateTimeFormat('en-GB',{timeZone:'Europe/Moscow',hour:'2-digit',hourCycle:'h23'}).format(now));
    for(const d of p.devices.filter(d=>d.status==='installed'&&['leak','door'].includes(d.type)).sort((a,b)=>(a.type==='leak'?0:1)-(b.type==='leak'?0:1))){
     const binding=p.bindings[d.id];if(!binding?.verified)continue;
     const e=byId.get(binding.entityId),value=binaryValue(d.type,e?.state);if(value===null)continue;
     let row=this.db.prepare('SELECT * FROM assistant_observations WHERE profile_id=? AND device_id=? AND entity_id=?').get(id,d.id,binding.entityId);
     const key=[id,d.id,binding.entityId];
     if(!value){
      if(!row||row.active||row.notified)this.db.prepare('INSERT INTO assistant_observations VALUES(?,?,?,0,NULL,0) ON CONFLICT(profile_id,device_id,entity_id) DO UPDATE SET active=0,opened_at=NULL,notified=0').run(...key);
      continue;
     }
     if(!row?.active){
      const timestamp=Date.parse(e.last_changed||e.last_updated);
      const opened=Number.isFinite(timestamp)&&timestamp<=now?timestamp:now;
      this.db.prepare('INSERT INTO assistant_observations VALUES(?,?,?,1,?,0) ON CONFLICT(profile_id,device_id,entity_id) DO UPDATE SET active=1,opened_at=excluded.opened_at,notified=0').run(...key,opened);
      row={opened_at:opened,notified:0};
     }
     if(row.notified)continue;
     const due=d.type==='leak'?s.leakAlerts:s.doorAlerts&&now-row.opened_at>=s.doorMinutes*60000&&(!s.quietNight||hour>=8&&hour<22);
     if(!due||!canSpeak)continue;
     // Claim BEFORE the external action. An ambiguous failure must not speak again
     // on each poll or after a restart; only a clear state rearms this alert.
     this.db.prepare('UPDATE assistant_observations SET notified=1 WHERE profile_id=? AND device_id=? AND entity_id=?').run(...key);
     const requestId='alert_'+createHash('sha256').update(JSON.stringify([...key,row.opened_at])).digest('hex');
     this.db.prepare('INSERT OR IGNORE INTO assistant_requests VALUES(?,?,?,?,?,?,?)').run(id,requestId,requestId,'alert','running',null,now);
     let result;
     try{result=await this.sendMedia(p,'text',d.type==='leak'?'Внимание! '+d.name.slice(0,60)+'.':'Проверь: '+d.name.slice(0,60)+' долго открыта.',{volume:s.volume,localOnly:true})}
     catch(error){result={phase:'unknown',message:error.message}}
     this.db.prepare('UPDATE assistant_requests SET status=?,result=? WHERE profile_id=? AND request_id=?').run(result.phase,JSON.stringify(result),id,requestId);
     // One announcement per tick avoids interrupting an announcement just sent.
     break;
    }
   }
  }catch(error){this.lastError=error.message}finally{this.ticking=false}
 }
}
