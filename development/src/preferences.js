import {defaultDevices,validateDevices,bindingDefinitions,areas} from './catalog.js';
import {isTime} from './night.js';
import {deviceTypes} from './device-types.js';
import {validateDeviceModel} from './device-model.js';
export {bindingDefinitions} from './catalog.js';

export const defaultPreferences=()=>({
 version:3,theme:'dark',favorites:['living','hall','terrace','bedroom','office','bath'],
 nightMode:'auto',nightStart:'23:00',nightEnd:'07:00',idleSeconds:90,kiosk:false,mode:'demo',ambientMode:true,autoTheme:false,devices:defaultDevices(),
 bindings:Object.fromEntries(defaultDevices().map(d=>[d.id,{entityId:'',verified:false}])),
 userScenarios:[],
 // ONVIF-события движения двора: creds хранятся серверно (в профиле SQLite),
 // пароль не отдаётся клиенту — index.js вырезает его из ответов API.
 yard_onvif_user:'',yard_onvif_pass:'',yard_onvif_host:'192.168.8.204',yard_onvif_enabled:true,
 // Камеры ONVIF (3.4.6, мультикамерный каркас): пароли хранятся серверно,
 // клиенту не отдаются (clientPreferences вырезает pass из каждого элемента).
 yardCameras:[],

 // Показания счётчика ТНС (снимаются раз в месяц) и тариф. Отсутствие ключей
 // в старых профилях = пусто (обратная совместимость).
 energy_readings:[],energy_tariff:null,
 // Ночная охрана (3.4.0): auto = активна по расписанию ночи; дверь открыта дольше
 // N минут → алерт в сводке. Отсутствие ключей в старых профилях = дефолты.
 guardNight:'auto',guardDoorMinutes:15,
 // 3.7.0: пилотная охранная система. guardArmedAway — режим «вне дома» (переживает
 // рестарт); тайминги в минутах; guardFlash — мигание светом при сирене;
 // guardMasterArms — мастер-кнопка: короткое = уход (без команд света, сцену
 // выполняет Умный дом с Алисой), длинное = снятие.
 guardArmedAway:false,guardExitDelay:120,guardAwayMinutes:3,
 guardHomeAlertMinutes:10,guardHomeAnnounceMinutes:30,guardFlash:true,guardMasterArms:true,
 // 3.7.1: сущность-мост Яндекса (input_boolean/switch): on = уход (сценарий
 // «Я ухожу»), off = снятие. Пусто — взвод только через панель.
 guardEntity:'',
 // 3.8.0: голос станции (TTS при взводе/снятии охраны) и гостевой Wi-Fi QR.
 voiceAnnounce:true,guestWifiSsid:'',guestWifiPass:''
});
// Пользовательские сценарии: строгие лимиты, неизвестные поля отбрасываем,
// целиком невалидные сценарии молча не сохраняем — остальной профиль не страдает.
export const USER_SCENARIO_LIMITS={max:8,maxSteps:12,minBrightness:30,maxBrightness:100};
// Камеры ONVIF (3.4.6): {name,host,port,user,pass,enabled}. Пароль — серверный секрет.
export const MAX_YARD_CAMERAS=4;
export function sanitizeYardCameras(raw){
 if(raw===undefined||raw===null)return [];
 if(!Array.isArray(raw))throw new Error('Камеры ONVIF: нужен массив.');
 const seen=new Set(),out=[];
 for(const c of raw){
  if(!c||typeof c!=='object'||Array.isArray(c))throw new Error('Камера ONVIF: нужен объект.');
  const rawHost=typeof c.host==='string'?c.host.trim().slice(0,120):'';
  // 'ip:port' в поле адреса — легальный формат: разделяем (порт имеет приоритет ниже).
  const colon=rawHost.match(/^([\w.\-]+):(\d+)$/);
  const host=colon?colon[1]:rawHost;
  // Строка без адреса и логина — недописанный черновик в форме: пропускаем молча.
  if(!host&&!String(c.user||'').trim())continue;
  if(!host||!/^[\w.\-]+$/.test(host))throw new Error('Камера ONVIF: нужен корректный адрес (IP или имя).');
  const port=Number.isInteger(c.port)&&c.port>0&&c.port<65536?c.port:colon?Number(colon[2]):2020;
  const key=host+':'+port;
  if(seen.has(key))continue;
  seen.add(key);
  const name=typeof c.name==='string'?c.name.trim().slice(0,24):'';
  out.push({name:name||'Камера '+(out.length+1),host,port,
   user:typeof c.user==='string'?c.user.trim().slice(0,64):'',
   pass:typeof c.pass==='string'?c.pass.slice(0,120):'',
   enabled:c.enabled!==false});
  if(out.length>=MAX_YARD_CAMERAS)break;
 }
 return out;
}
// Миграция легаси-полей (yard_onvif_host/user/pass) в список камер — ровно один раз:
// только когда в сохранённом профиле ключа yardCameras вообще не было.
export function migrateYardCameras(preferences,raw){
 if(!raw||raw.yardCameras!==undefined)return preferences;
 if(Array.isArray(preferences.yardCameras)&&preferences.yardCameras.length)return preferences;
 const host=String(raw.yard_onvif_host||'').trim();if(!host)return preferences;
 // host может быть 'ip:port' (старый формат): разделяем, иначе порт 2020.
 const colon=host.match(/^([\w.\-]+):(\d+)$/);
 return {...preferences,yardCameras:[{name:'Двор',host:(colon?colon[1]:host).slice(0,120),port:colon?Number(colon[2]):2020,
  user:String(raw.yard_onvif_user||'').trim().slice(0,64),pass:String(raw.yard_onvif_pass||'').slice(0,120),
  enabled:raw.yard_onvif_enabled!==false}]};
}

const scenarioIdOk=id=>typeof id==='string'&&/^[a-z0-9-]{1,40}$/.test(id);
export function sanitizeUserScenarios(raw,devices){
 if(!Array.isArray(raw))return [];
 const ids=new Set(),out=[];
 for(const s of raw){
  const name=typeof s?.name==='string'?s.name.trim():'';
  if(!scenarioIdOk(s?.id)||ids.has(s.id)||name.length<1||name.length>30||!Array.isArray(s.steps))continue;
  const steps=[];let ok=s.steps.length<=USER_SCENARIO_LIMITS.maxSteps&&s.steps.length>0;
  for(const st of s.steps){
   if(!ok)break;
   // Шаги сценария адресуют только линии света: существующий deviceId станции
   // или датчика отбрасывается целиком (сценарий сохранён не будет).
   const target=devices.find(d=>d.id===st?.deviceId),type=target&&deviceTypes[target.type];
   if(!target||!type||type.module!=='lights'||!type.controllable||!['on','off','brightness'].includes(st?.action)||(st.action!=='brightness'&&st.value!==undefined)){ok=false;break}
   const step={deviceId:st.deviceId,action:st.action};
   if(st.action==='brightness'){
    if(!Number.isInteger(st.value)||st.value<1||st.value>100){ok=false;break}
    step.value=st.value;
   }
   steps.push(step);
  }
  if(!ok)continue;
  ids.add(s.id);out.push({id:s.id,name,steps});
  if(out.length>=USER_SCENARIO_LIMITS.max)break;
 }
 return out;
}
// Показания счётчика: {date:'YYYY-MM-DD', value:int>0}. Повторная дата заменяет
// предыдущее (дедуп), результат сортируется по дате. Максимум 36 записей.
export const MAX_ENERGY_READINGS=36;
const READING_DATE=/^\d{4}-\d{2}-\d{2}$/;
export function sanitizeEnergyReadings(raw){
 if(raw===undefined||raw===null)return [];
 if(!Array.isArray(raw))throw new Error('Показания счётчика: нужен массив.');
 const byDate=new Map();
 for(const r of raw){
  if(!r||typeof r!=='object'||Array.isArray(r))throw new Error('Показание счётчика: нужен объект с датой и значением.');
  const md=/^(\d{4})-(\d{2})-(\d{2})$/.exec(r.date);
  const dt=md?new Date(Date.UTC(Number(md[1]),Number(md[2])-1,Number(md[3]))):null;
  if(!dt||dt.getUTCFullYear()!==Number(md[1])||dt.getUTCMonth()!==Number(md[2])-1||dt.getUTCDate()!==Number(md[3]))throw new Error('Показание счётчика: дата в формате ГГГГ-ММ-ДД.');
  if(!Number.isInteger(r.value)||r.value<=0)throw new Error('Показание счётчика: значение — целое число больше нуля.');
  byDate.set(r.date,r.value);
 }
 const out=[...byDate].map(([date,value])=>({date,value})).sort((a,b)=>a.date<b.date?-1:1);
 if(out.length>MAX_ENERGY_READINGS)throw new Error(`Показаний не больше ${MAX_ENERGY_READINGS}.`);
 return out;
}
// Тариф, ₽/кВт·ч: null — не задан (стоимость не считается).
export function sanitizeEnergyTariff(raw){
 if(raw===undefined||raw===null)return null;
 if(typeof raw!=='number'||!Number.isFinite(raw)||raw<0.01||raw>99)throw new Error('Тариф: число от 0,01 до 99 ₽/кВт·ч.');
 return raw;
}
export function validatePreferences(input,{importing=false}={}){
 if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('Нужен объект настроек.');
 if(input.version!==3)throw new Error('Версия настроек не поддерживается. Нужна копия v3.');
 const raw=input,p=defaultPreferences();
 if(Number.isInteger(raw.housePresetVersion)&&raw.housePresetVersion>=0&&raw.housePresetVersion<=5)p.housePresetVersion=raw.housePresetVersion;
 p.houseProfileConfirmed=!importing&&raw.houseProfileConfirmed===true;
 if(!['dark','light'].includes(raw.theme))throw new Error('Неизвестная тема.');
 if(!['auto','on','off'].includes(raw.nightMode))throw new Error('Неизвестный ночной режим.');
 if(raw.nightStart!==undefined||raw.nightEnd!==undefined){
  if(!isTime(raw.nightStart)||!isTime(raw.nightEnd))throw new Error('Время ночи указывается строкой ЧЧ:ММ.');
  if(raw.nightStart===raw.nightEnd)throw new Error('Начало и конец ночи не должны совпадать.');
 }
 if(![0,10,60,90,180].includes(raw.idleSeconds))throw new Error('Неверная задержка ожидания.');
 if(raw.ambientMode!==undefined&&typeof raw.ambientMode!=='boolean')throw new Error('Неверный тихий режим.');
 if(!Array.isArray(raw.favorites)||raw.favorites.length>6||new Set(raw.favorites).size!==raw.favorites.length||raw.favorites.some(id=>!areas.some(r=>r.id===id)))throw new Error('Проверь список избранных комнат.');
 if(!['demo','live'].includes(raw.mode))throw new Error('Неизвестный источник данных.');
 Object.assign(p,{theme:raw.theme,nightMode:raw.nightMode,nightStart:raw.nightStart===undefined?p.nightStart:raw.nightStart,nightEnd:raw.nightEnd===undefined?p.nightEnd:raw.nightEnd,idleSeconds:raw.idleSeconds,favorites:[...raw.favorites],kiosk:raw.kiosk===true,mode:importing?'demo':raw.mode,ambientMode:raw.ambientMode!==false,devices:validateDevices(raw.devices)});
 p.deviceModel=validateDeviceModel(raw.deviceModel,p.devices,areas);
 p.autoTheme=raw.autoTheme===true;
 // ONVIF двора: строки, host по умолчанию, пустой user — детектор не конфигурирован.
 p.yard_onvif_user=typeof raw.yard_onvif_user==='string'?raw.yard_onvif_user.trim().slice(0,64):'';
 p.yard_onvif_pass=typeof raw.yard_onvif_pass==='string'?raw.yard_onvif_pass.slice(0,120):'';
 p.yard_onvif_host=typeof raw.yard_onvif_host==='string'&&raw.yard_onvif_host.trim()?raw.yard_onvif_host.trim().slice(0,120):'192.168.8.204';
 // Тумблер ONVIF-датчика: отсутствие ключа = включено (обратная совместимость со старыми профилями).
 p.yard_onvif_enabled=raw.yard_onvif_enabled!==false;
 // Камеры ONVIF (3.4.6): до 4 штук, dedup по host:port. Отсутствие ключа = пустой
 // список (легаси-поля продолжают работать через серверную миграцию migrateYardCameras).
 p.yardCameras=sanitizeYardCameras(raw.yardCameras);

 // Показания счётчика и тариф: отсутствие ключей = пусто (старые профили без изменений).
 p.energy_readings=sanitizeEnergyReadings(raw.energy_readings);
 p.energy_tariff=sanitizeEnergyTariff(raw.energy_tariff);
 // Ночная охрана (3.4.0): отсутствие ключей = дефолты (обратная совместимость).
 if(raw.guardNight!==undefined&&!['auto','on','off'].includes(raw.guardNight))throw new Error('Неизвестный режим охраны.');
 p.guardNight=raw.guardNight===undefined?'auto':raw.guardNight;
 if(raw.guardDoorMinutes!==undefined&&(!Number.isInteger(raw.guardDoorMinutes)||raw.guardDoorMinutes<5||raw.guardDoorMinutes>120))throw new Error('Минуты открытия двери: целое число от 5 до 120.');
 p.guardDoorMinutes=raw.guardDoorMinutes===undefined?15:raw.guardDoorMinutes;
 // 3.7.0: охранная система — значения и валидация.
 if(raw.guardArmedAway!==undefined&&typeof raw.guardArmedAway!=='boolean')throw new Error('Неверный флаг охраны.');
 p.guardArmedAway=raw.guardArmedAway===true;
 if(raw.guardExitDelay!==undefined&&(!Number.isInteger(raw.guardExitDelay)||raw.guardExitDelay<0||raw.guardExitDelay>600))throw new Error('Задержка выхода: целое от 0 до 600 секунд.');
 p.guardExitDelay=raw.guardExitDelay===undefined?120:raw.guardExitDelay;
 if(raw.guardAwayMinutes!==undefined&&(!Number.isInteger(raw.guardAwayMinutes)||raw.guardAwayMinutes<1||raw.guardAwayMinutes>30))throw new Error('Минуты до сирены: целое от 1 до 30.');
 p.guardAwayMinutes=raw.guardAwayMinutes===undefined?3:raw.guardAwayMinutes;
 if(raw.guardHomeAlertMinutes!==undefined&&(!Number.isInteger(raw.guardHomeAlertMinutes)||raw.guardHomeAlertMinutes<5||raw.guardHomeAlertMinutes>120))throw new Error('Алерт дома: целое от 5 до 120 минут.');
 p.guardHomeAlertMinutes=raw.guardHomeAlertMinutes===undefined?10:raw.guardHomeAlertMinutes;
 if(raw.guardHomeAnnounceMinutes!==undefined&&(!Number.isInteger(raw.guardHomeAnnounceMinutes)||raw.guardHomeAnnounceMinutes<5||raw.guardHomeAnnounceMinutes>240))throw new Error('Озвучка дома: целое от 5 до 240 минут.');
 p.guardHomeAnnounceMinutes=raw.guardHomeAnnounceMinutes===undefined?30:raw.guardHomeAnnounceMinutes;
 p.guardFlash=raw.guardFlash!==false;
 p.guardMasterArms=raw.guardMasterArms!==false;
 p.guardEntity=typeof raw.guardEntity==='string'?raw.guardEntity.trim().slice(0,80):'';
 if(p.guardEntity&&!/^(input_boolean|switch)\.[a-z0-9_]+$/.test(p.guardEntity))throw new Error('Сущность охраны: ожидается input_boolean.* или switch.*.');
 // 3.8.0: голос станции и гостевой Wi-Fi (SSID/пароль хранятся в профиле панели).
 p.voiceAnnounce=raw.voiceAnnounce!==false;
 p.guestWifiSsid=typeof raw.guestWifiSsid==='string'?raw.guestWifiSsid.trim().slice(0,32):'';
 p.guestWifiPass=typeof raw.guestWifiPass==='string'?raw.guestWifiPass.slice(0,64):'';

 const used=new Set();p.bindings={};
 for(const definition of bindingDefinitions(p.devices)){
  const b=raw.bindings?.[definition.id]||{},entityId=typeof b.entityId==='string'?b.entityId.trim():'';
  if(entityId&&(!/^[a-z_]+\.[a-z0-9_]+$/.test(entityId)||!definition.domains.includes(entityId.split('.')[0])))throw new Error(`Неверная сущность: ${definition.name}`);
  if(entityId&&used.has(entityId))throw new Error('Одна сущность не может быть привязана к двум устройствам.');
  if(entityId)used.add(entityId);
  if(definition.device.status==='planned'&&b.verified&&!importing)throw new Error('Планируемое устройство нельзя отмечать проверенным.');
  p.bindings[definition.id]={entityId,verified:!importing&&definition.device.status==='installed'&&!!entityId&&b.verified===true};
 }
 p.userScenarios=sanitizeUserScenarios(raw.userScenarios,p.devices);

 return p;
}
