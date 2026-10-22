import {defaultDevices,validateDevices,bindingDefinitions,areas} from './catalog.js';
import {validateDeviceModel} from './device-model.js';
export {bindingDefinitions} from './catalog.js';

export const defaultPreferences=()=>({
 version:3,theme:'dark',favorites:['living','hall','terrace','bedroom','office','bath'],
 nightMode:'auto',idleSeconds:90,kiosk:false,mode:'demo',devices:defaultDevices(),
 bindings:Object.fromEntries(defaultDevices().map(d=>[d.id,{entityId:'',verified:false}]))
});
export function validatePreferences(input,{importing=false}={}){
 if(!input||typeof input!=='object'||Array.isArray(input))throw new Error('Нужен объект настроек.');
 if(input.version!==3)throw new Error('Версия настроек не поддерживается. Нужна копия v3.');
 const raw=input,p=defaultPreferences();
 if(Number.isInteger(raw.housePresetVersion)&&raw.housePresetVersion>=0&&raw.housePresetVersion<=5)p.housePresetVersion=raw.housePresetVersion;
 p.houseProfileConfirmed=!importing&&raw.houseProfileConfirmed===true;
 if(!['dark','light'].includes(raw.theme))throw new Error('Неизвестная тема.');
 if(!['auto','on','off'].includes(raw.nightMode))throw new Error('Неизвестный ночной режим.');
 if(![0,10,60,90,180].includes(raw.idleSeconds))throw new Error('Неверная задержка ожидания.');
 if(!Array.isArray(raw.favorites)||raw.favorites.length>6||new Set(raw.favorites).size!==raw.favorites.length||raw.favorites.some(id=>!areas.some(r=>r.id===id)))throw new Error('Проверь список избранных комнат.');
 if(!['demo','live'].includes(raw.mode))throw new Error('Неизвестный источник данных.');
 Object.assign(p,{theme:raw.theme,nightMode:raw.nightMode,idleSeconds:raw.idleSeconds,favorites:[...raw.favorites],kiosk:raw.kiosk===true,mode:importing?'demo':raw.mode,devices:validateDevices(raw.devices)});
 p.deviceModel=validateDeviceModel(raw.deviceModel,p.devices,areas);
 const used=new Set();p.bindings={};
 for(const definition of bindingDefinitions(p.devices)){
  const b=raw.bindings?.[definition.id]||{},entityId=typeof b.entityId==='string'?b.entityId.trim():'';
  if(entityId&&(!/^[a-z_]+\.[a-z0-9_]+$/.test(entityId)||!definition.domains.includes(entityId.split('.')[0])))throw new Error(`Неверная сущность: ${definition.name}`);
  if(entityId&&used.has(entityId))throw new Error('Одна сущность не может быть привязана к двум устройствам.');
  if(entityId)used.add(entityId);
  if(definition.device.status==='planned'&&b.verified&&!importing)throw new Error('Планируемое устройство нельзя отмечать проверенным.');
  p.bindings[definition.id]={entityId,verified:!importing&&definition.device.status==='installed'&&!!entityId&&b.verified===true};
 }
 return p;
}
