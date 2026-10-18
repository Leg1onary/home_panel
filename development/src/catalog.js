import house from '../config/house.json';
import './compat.js';
import {deviceTypes} from './device-types.js';
export {deviceTypes} from './device-types.js';

export const areas=[
 ...house.rooms.map(r=>({id:r.id,name:r.name})),
 {id:'attic',name:'Чердак'},{id:'well',name:'Скважина'},{id:'yard',name:'Двор'}
];
export const areaName=id=>areas.find(a=>a.id===id)?.name||id;
const lightIDs={
 living:['living:0','living:1'],hall:['hall:0','hall:1'],office:['office:0','office:1'],
 bedroom:['bedroom:0','bedroom:1'],children:['children:0','children:1'],bath:['bath:0','bath:1'],
 utility:['utility:0'],pantry:['pantry:0']
};
const make=(id,type,room,name,extra={})=>({id,type,room,name,status:'installed',masterOff:type==='light',note:'',...extra});
export function defaultDevices(){
 return [
  ...house.rooms.flatMap(r=>r.channels.map((c,i)=>make(lightIDs[r.id][i],'light',r.id==='hall'&&i===1?'terrace':r.id,c.name,{status:c.planned?'planned':'installed',note:c.note||'',demoOn:c.demoOn}))),
  ...[['living',20.4,53],['attic',40,24],['well',16.5,86]].flatMap(([id,t,h])=>[
   make(`temperature:${id}`,'temperature',id,`Температура · ${areaName(id)}`,{note:'miaomiaoce.sensor_ht.t2 · BLE; подключение к HA ещё не проверено',demoValue:t,demoStale:id==='attic'}),
   make(`humidity:${id}`,'humidity',id,`Влажность · ${areaName(id)}`,{note:'miaomiaoce.sensor_ht.t2 · BLE; подключение к HA ещё не проверено',demoValue:h,demoStale:id==='attic'})
  ]),
  make('door','door','hall','Входная дверь',{note:'isa.magnet.dw2hl · BLE; подключение к HA ещё не проверено',demoValue:'off'}),
  make('smoke','smoke','living','Датчик дыма над кухней',{note:'DIGMA SmartLife · подключение отложено',demoValue:'off'}),
  make('terrace-motion','motion','terrace','Движение на террасе',{note:'lumi.motion.agl02 · Zigbee; сценарий пока остаётся в Алисе'}),
  make('terrace-lux','illuminance','terrace','Освещённость террасы',{note:'lumi.motion.agl02 · Zigbee; подключение к HA ещё не проверено'}),
  make('camera-yard','camera','yard','Двор · Tapo C320WS',{note:'Учётная запись камеры создана; ONVIF в HA ещё не проверен'}),
  make('corridor-main','light','corridor','Будущий выключатель 1',{status:'planned',note:'Количество клавиш и линии уточним'}),
  make('corridor-extra','light','corridor','Будущий выключатель 2',{status:'planned',note:'Количество клавиш и линии уточним'}),
  make('camera-extra-1','camera','yard','Камера 2 · планируется',{status:'planned',note:'Место установки ещё не выбрано'}),
  make('camera-extra-2','camera','yard','Камера 3 · резерв',{status:'planned',note:'Не куплена; необязательное расширение'}),
  make('sliding-gate','gate','yard','Откатные ворота',{status:'planned',note:'Модель привода, интерфейс и датчики положения не проверены'}),
  make('boiler','heating','utility','Газовый котёл Kentatsu',{note:'Внешнее управление и совместимость не проверены'}),
  make('pump','pump','utility','Насос тёплого пола',{note:'yeelink.switch.sw1 · канал ещё не проверен; питание не подтверждает работу насоса'})
 ];
}
export const bindingDefinitions=(devices=defaultDevices())=>devices.map(d=>({
 id:d.id,type:d.type,name:`${areaName(d.room)} · ${d.name}`,
 domains:deviceTypes[d.type].domains,device:d
}));
export const findDevice=(devices,id)=>devices.find(d=>d.id===id);
export const sensorTypes=Object.keys(deviceTypes).filter(t=>deviceTypes[t].module==='sensors');
export function resolveAction(id,devices){
 // Permanent device keys, not array offsets. RGB commands include an action.
 const normalized=id.startsWith('rgb:')?'rgb/'+id.slice(4):id;
 const slash=normalized.lastIndexOf('/');
 const key=slash<0?normalized:normalized.slice(0,slash),action=slash<0?'on':normalized.slice(slash+1);
 return {device:findDevice(devices,key),key,action};
}
export function validateDevices(input){
 if(!Array.isArray(input)||input.length>128)throw new Error('В каталоге может быть не более 128 устройств.');
 const defaults=defaultDevices(),used=new Set();
 return input.map(raw=>{
  if(!raw||typeof raw!=='object'||!Object.prototype.hasOwnProperty.call(deviceTypes,raw.type)||!areas.some(a=>a.id===raw.room))throw new Error('Неизвестный тип или зона устройства.');
  if(typeof raw.id!=='string'||!/^[a-z][a-z0-9:_-]{1,63}$/.test(raw.id)||used.has(raw.id))throw new Error('ID устройства неверный или повторяется.');
  used.add(raw.id);
  const seed=defaults.find(d=>d.id===raw.id);
  if(seed&&seed.type!==raw.type)throw new Error('Тип исходного устройства нельзя подменять.');
  if(!['installed','planned'].includes(raw.status))throw new Error('Неверный статус установки.');
  if(typeof raw.name!=='string'||!raw.name.trim()||raw.name.trim().length>64)throw new Error('Название устройства: от 1 до 64 символов.');
  if(raw.note!==undefined&&(typeof raw.note!=='string'||raw.note.length>240))throw new Error('Примечание: до 240 символов.');
  return {
   id:raw.id,type:raw.type,room:raw.room,name:raw.name.trim(),status:raw.status,note:raw.note||'',
   masterOff:['light','rgb'].includes(raw.type)&&raw.masterOff===true&&!seed?.powerId,
   ...(seed?.powerId?{powerId:seed.powerId}:{}),
   ...(seed?.demoOn!==undefined?{demoOn:seed.demoOn}:{}),
   ...(seed?.demoValue!==undefined?{demoValue:seed.demoValue}:{}),
   ...(seed?.demoStale?{demoStale:true}:{})
  };
 });
}
export function samePhysicalDevice(a,b){
 return !!a&&!!b&&a.type===b.type&&a.room===b.room&&a.status===b.status&&a.powerId===b.powerId;
}
