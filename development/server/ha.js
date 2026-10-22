import {bindingDefinitions} from '../src/preferences.js';
import {resolveAction} from '../src/catalog.js';
import {stationSupports} from '../src/station.js';

export class HomeAssistant {
 constructor({url='',token='',preview=false}={}){
  this.enabled=!!url&&!!token&&!preview;this.token=token;this.url=null;this.pending=new Set();
  if(this.enabled){
   let u;try{u=new URL(url)}catch{throw new Error('HA_URL имеет неверный формат.')}
   if(!['http:','https:'].includes(u.protocol)||u.username||u.password||u.search||u.hash)throw new Error('HA_URL должен быть HTTP(S)-адресом без пароля, query и fragment.');
   this.url=u.href.replace(/\/$/,'');
  }
 }
 async request(path,body){
  if(!this.enabled)throw new Error('Home Assistant не настроен. На месте добавим HA_URL и HA_TOKEN в .env локального сервера.');
  let response;
  try{
   response=await fetch(this.url+path,{
    method:body===undefined?'GET':'POST',redirect:'error',
    headers:{Authorization:`Bearer ${this.token}`,'Content-Type':'application/json'},
    ...(body===undefined?{}:{body:JSON.stringify(body)}),signal:AbortSignal.timeout(6000)
   });
  }catch{throw new Error('Нет связи с Home Assistant. Проверь сеть и адрес локального сервера.')}
  if(response.status===401||response.status===403)throw new Error('Home Assistant отклонил авторизацию. Проверь локальный токен.');
  if(!response.ok)throw new Error(`Home Assistant: запрос отклонён (${response.status}).`);
  try{return await response.json()}catch{throw new Error('Некорректный ответ Home Assistant.')}
 }
 sanitize(e){
  const keys=['friendly_name','device_class','unit_of_measurement','temperature_unit','brightness','rgb_color','supported_color_modes','current_position','battery_level','current_temperature','temperature','hvac_action','supported_features','volume_level','media_title','media_artist'];
  return {entity_id:e.entity_id,state:e.state,last_updated:e.last_updated,last_reported:e.last_reported,
   attributes:Object.fromEntries(keys.filter(k=>e.attributes?.[k]!==undefined).map(k=>[k,e.attributes[k]]))};
 }
 async states(){
  const all=await this.request('/api/states');
  if(!Array.isArray(all))throw new Error('Некорректный список сущностей.');
  return all.filter(e=>/^(light|switch|sensor|binary_sensor|camera|cover|climate|media_player|vacuum)\.[a-z0-9_]+$/.test(e.entity_id)).map(e=>this.sanitize(e));
 }
 cameraEntity(id,p){
  const d=p.devices.find(d=>d.id===id),b=p.bindings[id];
  if(p.mode!=='live'||d?.type!=='camera'||d.status!=='installed'||!b?.verified||!/^camera\.[a-z0-9_]+$/.test(b.entityId))throw new Error('Камера не подключена или не проверена.');
  if(!this.enabled)throw new Error('Камера недоступна в демопревью.');
  return b.entityId;
 }
 async camera(id,p){
  const entity=this.cameraEntity(id,p);
  let response;
  try{response=await fetch(this.url+'/api/camera_proxy/'+entity,{headers:{Authorization:`Bearer ${this.token}`},redirect:'error',signal:AbortSignal.timeout(10000)})}
  catch{throw new Error('Не удалось получить кадр камеры.')}
  const type=response.headers.get('content-type')?.split(';')[0];
  if(!response.ok||!['image/jpeg','image/png','image/webp'].includes(type))throw new Error('Home Assistant не вернул изображение камеры.');
  const reader=response.body.getReader(),parts=[];let size=0;
  try{while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>5*1024*1024)throw new Error('Кадр превышает 5 МБ.');parts.push(Buffer.from(value))}}
  finally{await reader.cancel()}
  return {type,bytes:Buffer.concat(parts)};
 }
 async command(request,p){
  if(p.mode!=='live')throw new Error('Команды Home Assistant доступны только в рабочем режиме.');
  if(!request||typeof request.id!=='string')throw new Error('Неверная команда.');
  if(request.id.startsWith('station:'))return this.stationCommand(request,p);
  const {key,action,device}=resolveAction(request.id,p.devices);
  const def=bindingDefinitions(p.devices).find(b=>b.id===key),binding=p.bindings[key];
  if(!def||device.status!=='installed'||!['light','rgb'].includes(def.type)||!binding?.verified||!binding.entityId)throw new Error('Управление этим каналом заблокировано.');
  const entity=binding.entityId,domain=entity.split('.')[0];
  if(!def.domains.includes(domain)||this.pending.has(entity))throw new Error('Канал занят или домен запрещён.');
  let service,data,target;
  if(action==='brightness'&&def.type==='rgb'){
   if(!Number.isInteger(request.value)||request.value<1||request.value>100)throw new Error('Неверная яркость.');
   service='turn_on';data={brightness:Math.round(request.value*255/100)};
   target=e=>e.state==='on'&&Math.abs((e.attributes.brightness??-999)-data.brightness)<=2;
  }else if(action==='color'&&def.type==='rgb'){
   if(!/^#[a-fA-F0-9]{6}$/.test(request.value))throw new Error('Неверный RGB-цвет.');
   const rgb=[1,3,5].map(i=>parseInt(request.value.slice(i,i+2),16));service='turn_on';data={rgb_color:rgb};
   target=e=>e.state==='on'&&e.attributes.rgb_color?.length===3&&e.attributes.rgb_color.every((n,i)=>Math.abs(n-rgb[i])<=3);
  }else{
   if(action!=='on'||typeof request.value!=='boolean')throw new Error('Неверное значение выключателя.');
   service=request.value?'turn_on':'turn_off';data={};target=e=>e.state===(request.value?'on':'off');
  }
  this.pending.add(entity);
  try{
   const before=await this.request('/api/states/'+entity);
   if(!['on','off'].includes(before.state))throw new Error('Сущность недоступна. Команда не отправлена.');
   if(action==='brightness'&&!before.attributes.supported_color_modes?.some(m=>m!=='onoff'))throw new Error('Яркость не поддерживается сущностью.');
   if(action==='color'&&!before.attributes.supported_color_modes?.includes('rgb'))throw new Error('RGB-цвет не подтверждён как поддерживаемый.');
   if(device.powerId){
    const power=p.bindings[device.powerId];
    if(!power?.verified||!power.entityId)throw new Error('Сначала проверь канал питания прихожей.');
    const e=await this.request('/api/states/'+power.entityId);
    if(e.state!=='on')throw new Error('У RGB-лампы нет подтверждённого питания.');
   }
   if(target(before))return {id:request.id,value:request.value,confirmedAt:Date.now()};
   await this.request(`/api/services/${domain}/${service}`,{entity_id:entity,...data});
   const deadline=Date.now()+10000;
   do{
    const e=await this.request('/api/states/'+entity);
    if(target(e))return {id:request.id,value:request.value,confirmedAt:Date.now()};
    await new Promise(r=>setTimeout(r,350));
   }while(Date.now()<deadline);
   throw new Error('Состояние не подтверждено. Команда могла выполниться; проверь устройство перед повтором.');
  }finally{this.pending.delete(entity)}
 }
 async stationCommand(request,p){
  const d=p.devices.find(d=>d.id==='station'),b=p.bindings.station,action=request.id.slice(8);
  if(d?.type!=='station'||d.status!=='installed'||!b?.verified||!/^media_player\.[a-z0-9_]+$/.test(b.entityId))throw new Error('Станция не подключена или не проверена.');
  if(action==='volume'){
   if(!Number.isInteger(request.value)||request.value<0||request.value>100)throw new Error('Громкость должна быть от 0 до 100.');
  }else if(!['playing','next','previous'].includes(action)||typeof request.value!=='boolean'||(['next','previous'].includes(action)&&request.value!==true))throw new Error('Команда станции запрещена.');
  const entity=b.entityId;
  if(this.pending.has(entity))throw new Error('Станция занята предыдущей командой.');
  this.pending.add(entity);
  try{
   const before=await this.request('/api/states/'+entity);
   if(!stationSupports(before,action,request.value))throw new Error('Функция станции недоступна или не поддерживается интеграцией.');
   const skip=['next','previous'].includes(action);
   const target=skip?e=>!!(
    (e.attributes?.media_title&&e.attributes.media_title!==before.attributes?.media_title)||
    (e.attributes?.media_artist&&e.attributes.media_artist!==before.attributes?.media_artist)||
    (Number.isFinite(e.attributes?.media_position)&&Number.isFinite(before.attributes?.media_position)&&e.attributes.media_position<before.attributes.media_position-2)
   ):action==='volume'?e=>Number.isFinite(e.attributes?.volume_level)&&Math.abs(e.attributes.volume_level-request.value/100)<=0.015:e=>e.state===(request.value?'playing':'paused');
   if(!skip&&target(before))return {id:request.id,value:request.value,confirmedAt:Date.now()};
   const service=skip?(action==='next'?'media_next_track':'media_previous_track'):action==='volume'?'volume_set':request.value?'media_play':'media_pause';
   await this.request('/api/services/media_player/'+service,{entity_id:entity,...(action==='volume'?{volume_level:request.value/100}:{})});
   const deadline=Date.now()+10000;
   do{
    if(target(await this.request('/api/states/'+entity)))return {id:request.id,value:request.value,confirmedAt:Date.now()};
    await new Promise(r=>setTimeout(r,350));
   }while(Date.now()<deadline);
   throw new Error('Станция не подтвердила состояние. Команда могла выполниться; автоматического повтора нет.');
  }finally{this.pending.delete(entity)}
 }
}
