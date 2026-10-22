import {deviceTypes} from './device-types.js';
import {stationSupports} from './station.js';

// v1 is an additive layer over stable channel IDs. Legacy command routes and
// verified HA mappings stay intact. A group never supplies permissions.
export const DEVICE_MODEL_VERSION=1;
const object=v=>v&&typeof v==='object'&&!Array.isArray(v);
const modes=['room','none'];
export function seedDeviceModel(devices){
 const groups=[];
 const add=(id,name,ids)=>{
  const members=ids.filter(id=>devices.some(d=>d.id===id));
  const found=members.map(id=>devices.find(d=>d.id===id));
  // Curated groups only. Never infer a physical association from a similar name.
  if(members.length<2||new Set(found.map(d=>d.room)).size!==1)return;
  groups.push({id:'unit-'+id,name,room:found[0].room,members,visual:{mode:'room'}});
 };
 for(const [id,label]of [['living','гостиная'],['attic','чердак'],['well','скважина']]){
  add('climate-'+id,'Датчик климата · '+label,['temperature:'+id,'humidity:'+id,'battery:'+id]);
 }
 add('door','Входная дверь',['door','battery:door']);
 add('terrace-motion','Датчик движения · терраса',['terrace-motion','terrace-lux','battery:terrace']);
 add('master-button','Мастер-кнопка',['master-event','battery:master']);
 add('yard-camera','Камера двора',['camera-yard','yard-motion']);
 add('terrace-door','Дверь на террасу',['terrace-door','battery:terrace-door']);
 add('leak-utility','Протечка в котельной',['leak:utility','battery:leak-utility']);
 add('leak-bath','Протечка в ванной',['leak:bath','battery:leak-bath']);
 return {version:DEVICE_MODEL_VERSION,groups};
}
export function validateDeviceModel(input,devices,areas){
 if(input===undefined)return seedDeviceModel(devices);
 if(!object(input)||input.version!==DEVICE_MODEL_VERSION)throw new Error('Версия модели устройств не поддерживается.');
 if(!Array.isArray(input.groups)||input.groups.length>128)throw new Error('Не более 128 логических устройств.');
 const ids=new Set(),assigned=new Set(),byId=new Map(devices.map(d=>[d.id,d]));
 const groups=input.groups.map(g=>{
  if(!object(g)||typeof g.id!=='string'||!/^unit-[a-z0-9][a-z0-9_-]{1,58}$/.test(g.id)||ids.has(g.id))throw new Error('ID логического устройства неверный или повторяется.');
  ids.add(g.id);
  if(typeof g.name!=='string'||!g.name.trim()||g.name.trim().length>64)throw new Error('Название устройства: от 1 до 64 символов.');
  if(!areas.some(a=>a.id===g.room))throw new Error('Неизвестная зона логического устройства.');
  if(!Array.isArray(g.members)||!g.members.length||g.members.length>32)throw new Error('В устройстве должно быть от 1 до 32 каналов.');
  const members=g.members.map(id=>{
   if(typeof id!=='string'||!byId.has(id)||assigned.has(id))throw new Error('Канал отсутствует или уже включён в другое устройство.');
   assigned.add(id);return id;
  });
  if(g.visual!==undefined&&!object(g.visual))throw new Error('Неверные настройки отображения устройства.');
  const mode=g.visual?.mode??'room';
  if(!modes.includes(mode))throw new Error('Неизвестный режим отображения устройства.');
  return {id:g.id,name:g.name.trim(),room:g.room,members,visual:{mode}};
 });
 return {version:DEVICE_MODEL_VERSION,groups};
}
// Explicit UI deletion only, not a repair applied silently to malformed imports.
export function detachChannel(model,id){
 return {...model,groups:model.groups.map(g=>({...g,members:g.members.filter(m=>m!==id)})).filter(g=>g.members.length)};
}
export function roleFor(type){return ({light:'power',rgb:'power',station:'media',camera:'camera',button_event:'event'})[type]||type}
export function effectiveCapabilities(channel,entity){
 const type=deviceTypes[channel.type];
 if(!type)return [];
 const result=['state'];
 if(!entity||['unknown','unavailable',''].includes(entity.state))return result;
 if(channel.type==='curtain'&&Number.isFinite(entity.attributes?.current_position))result.push('position');
 if(channel.type==='vacuum'&&Number.isFinite(entity.attributes?.battery_level))result.push('battery');
 // These describe supported observations/actions, not authorization. The command
 // adapter still checks live mode, binding, status, state and actual support.
 if(type.controllable&&channel.status==='installed'&&!type.locked){
  if(['light','rgb'].includes(channel.type)&&['on','off'].includes(entity.state)){
   result.push('power');
   const colors=entity.attributes?.supported_color_modes||[];
   if(channel.type==='rgb'&&colors.some(c=>c!=='onoff'))result.push('brightness');
   if(channel.type==='rgb'&&colors.includes('rgb'))result.push('color');
  }
  if(channel.type==='station'){
   if(stationSupports(entity,'playing',true))result.push('play');
   if(stationSupports(entity,'playing',false))result.push('pause');
   if(stationSupports(entity,'volume'))result.push('volume');
  }
 }
 if(channel.type==='camera')result.push('snapshot','live');
 return result;
}
export function buildDeviceModel(preferences,entities={},online){
 const devices=preferences.devices,model=preferences.deviceModel||seedDeviceModel(devices);
 const assigned=new Set(model.groups.flatMap(g=>g.members));
 const groups=[...model.groups,...devices.filter(d=>!assigned.has(d.id)).map(d=>({
  id:'channel:'+d.id,name:d.name,room:d.room,members:[d.id],visual:{mode:'room'},implicit:true
 }))];
 const byId=new Map(devices.map(d=>[d.id,d]));
 return groups.map(g=>{
  const components=g.members.map(id=>{
   const d=byId.get(id),b=preferences.bindings[id],t=deviceTypes[d.type];
   const entity=online&&d.status==='installed'&&b?.verified?entities[b.entityId]:undefined;
   const available=!!entity&&!['unknown','unavailable',''].includes(entity.state);
   return {id:d.id,role:roleFor(d.type),type:d.type,room:d.room,name:d.name,
    module:t.module,installed:d.status==='installed',verified:b?.verified===true,
    available,state:available?entity.state:null,unit:t.unit||null,
    capabilities:effectiveCapabilities(d,entity),locked:!!t.locked};
  });
  const primary=components.find(c=>c.type!=='battery')||components[0];
  const count=components.filter(c=>c.installed).length,available=components.filter(c=>c.available).length;
  return {id:g.id,name:g.name,room:g.room,visual:g.visual,implicit:g.implicit===true,
   module:primary.module,modules:[...new Set(components.map(c=>c.module))],icon:deviceTypes[primary.type].icon,components,
   availability:!count?'planned':online===undefined?'unobserved':!online?'offline':!available?'unavailable':available===count?'available':'partial'};
 });
}
