// Curated from the owner's HA inventory, 2026-10-15. No credentials or registry IDs.
// Stable panel IDs deliberately differ from HA areas: kitchen/living and toilet/utility
// share physical rooms; the right hallway key powers the terrace.
import {deviceTypes} from './catalog.js';
import {validatePreferences} from './preferences.js';
import {detachChannel} from './device-model.js';

export const houseBindings={
 'living:0':'light.gostinaia_levyi_vykliuchatel',
 'living:1':'light.gostinaia_pravyi_vykliuchatel',
 'hall:0':'light.prikhozhaia_levyi_vykliuchatel',
 'hall:1':'light.prikhozhaia_pravyi_vykliuchatel',
 'office:0':'light.kabinet_levyi_vykliuchatel',
 'office:1':'light.kabinet_pravyi_vykliuchatel',
 'bedroom:0':'light.spalnia_levyi_vykliuchatel',
 'bedroom:1':'light.spalnia_pravyi_vykliuchatel',
 'children:0':'light.detskaia_levyi_vykliuchatel',
 'children:1':'light.detskaia_pravyi_vykliuchatel',
 'bath:0':'light.vannaia_levyi_vykliuchatel',
 'bath:1':'light.vannaia_pravyi_vykliuchatel',
 'utility:0':'light.tualet_vykliuchatel',
 'pantry:0':'light.kladovaia_vykliuchatel',
 'temperature:living':'sensor.gostinaia_datchik_temperatury_temperatura',
 'humidity:living':'sensor.gostinaia_datchik_temperatury_vlazhnost',
 'temperature:well':'sensor.skvazhina_datchik_temperatury_temperatura',
 'humidity:well':'sensor.skvazhina_datchik_temperatury_vlazhnost',
 'temperature:attic':'sensor.cherdak_datchik_temperatury_temperatura',
 'humidity:attic':'sensor.cherdak_datchik_temperatury_vlazhnost',
 door:'binary_sensor.e4aaec90027a_contact',
 'terrace-motion':'sensor.terrasa_datchik_dvizheniia_dvizhenie',
 'terrace-lux':'sensor.terrasa_datchik_dvizheniia_osveshchennost',
 'camera-yard':'camera.dvor_kamera_dvor_live_view',
 'yard-motion':'binary_sensor.dvor_c320ws_motion_alarm',
 'master-event':'sensor.prikhozhaia_master_svet_knopka',
 'station':'media_player.yandex_station_c00mp0000t4w0z',
 'battery:living':'sensor.gostinaia_datchik_temperatury_uroven_zariada',
 'battery:well':'sensor.skvazhina_datchik_temperatury_uroven_zariada',
 'battery:attic':'sensor.cherdak_datchik_temperatury_uroven_zariada',
 'battery:door':'sensor.e4aaec90027a_battery',
 'battery:terrace':'sensor.terrasa_datchik_dvizheniia_uroven_zariada',
 'battery:master':'sensor.prikhozhaia_master_svet_uroven_zariada'
};
const extra=(id,type,room,name)=>({id,type,room,name,status:'installed',masterOff:false,note:'По выгрузке HA · только наблюдение'});
export const houseExtras=[
 extra('station','station','living','Яндекс Станция Дуо Макс'),
 extra('yard-motion','motion','yard','Движение · камера двора'),
 extra('master-event','button_event','hall','Мастер-свет · последнее событие'),
 ...[
  ['living','living','Батарейка · гостиная'],['well','well','Батарейка · скважина'],
  ['attic','attic','Батарейка · чердак'],['door','hall','Батарейка · входная дверь'],
  ['terrace','terrace','Батарейка · движение террасы'],['master','hall','Батарейка · мастер-кнопка']
 ].map(([id,room,name])=>extra('battery:'+id,'battery',room,name))
];
// Promote only the untouched old placeholder. Never infer an HA entity or erase
// a manually configured/grouped extra channel. A deleted channel stays deleted.
export function migrateCorridor(input){
 let p;
 const copy=()=>p||(p=JSON.parse(JSON.stringify(input)));
 const main=input.devices.find(d=>d.id==='corridor-main');
 const other=input.devices.some(d=>d.room==='corridor'&&d.type==='light'&&d.status==='installed'&&d.id!=='corridor-main');
 if(main?.type==='light'&&main.room==='corridor'&&main.status==='planned'&&main.name==='Будущий выключатель 1'&&!other){
  const next=copy().devices.find(d=>d.id===main.id);next.status='installed';next.name='Основной свет';
  next.note='Одна установленная линия · выбери сущность HA';
  if(!input.bindings[main.id]?.entityId)next.masterOff=false;
 }
 const extra=input.devices.find(d=>d.id==='corridor-extra');
 if(extra?.status==='planned'&&extra.room==='corridor'&&extra.type==='light'&&extra.name==='Будущий выключатель 2'&&
  !input.bindings[extra.id]?.entityId&&!input.deviceModel?.groups.some(g=>g.members.includes(extra.id))){
  const next=copy();next.devices=next.devices.filter(d=>d.id!==extra.id);delete next.bindings[extra.id];
  if(next.deviceModel)next.deviceModel=detachChannel(next.deviceModel,extra.id);
 }
 return p?validatePreferences(p):input;
}
export function migrateHouseProfile(input){
 if(input.housePresetVersion===3)return migrateCorridor(input);
 const p=JSON.parse(JSON.stringify(input));
 const previousVersion=input.housePresetVersion||0;
 // Existing live installs have already confirmed bindings in 1.0.5/1.0.6.
 p.houseProfileConfirmed=input.houseProfileConfirmed===true||
  (previousVersion<2&&input.mode==='live'&&Object.values(input.bindings||{}).some(b=>b.verified));
 if(previousVersion<1){
 // Only add new capabilities. Do not resurrect a previously deleted original device.
 for(const d of houseExtras)if(!p.devices.some(x=>x.id===d.id))p.devices.push({...d});
 const bath=p.devices.find(d=>d.id==='bath:1');
 if(bath?.status==='planned'&&!p.bindings['bath:1']?.entityId){
  bath.status='installed';bath.note='Правая клавиша · установлена';
 }
 // The owner excluded the pump. Preserve only an explicitly configured custom mapping.
 p.devices=p.devices.filter(d=>d.id!=='pump'||p.bindings.pump?.entityId);
 for(const d of p.devices){
  const entityId=houseBindings[d.id],old=p.bindings[d.id];
  if(entityId&&!old?.entityId&&d.status==='installed'){
   p.bindings[d.id]={entityId,verified:false};
   if(d.type!=='light')d.note=d.type==='station'?'Yandex Station · команды и статусы через HA':'Сущность HA из выгрузки дома';
  }
  if(d.id==='smoke'&&!old?.entityId)d.status='planned';
 }
 }
 const oldClimate={
  'temperature:living':'sensor.a4c1383cc159_temperature','humidity:living':'sensor.a4c1383cc159_humidity',
  'temperature:well':'sensor.a4c1386265b5_temperature','humidity:well':'sensor.a4c1386265b5_humidity',
  'battery:living':'sensor.a4c1383cc159_battery','battery:well':'sensor.a4c1386265b5_battery'
 };
 if(previousVersion<2)for(const [id,legacy]of Object.entries(oldClimate)){
  const d=p.devices.find(d=>d.id===id),b=p.bindings[id],next=houseBindings[id];
  if(!d||!b||b.entityId!==legacy||Object.entries(p.bindings).some(([key,v])=>key!==id&&v.entityId===next))continue;
  p.bindings[id]={entityId:next,verified:false};
  d.note='Yandex Station · источник заменён по проверке владельца';
 }
 const camera=p.devices.find(d=>d.id==='camera-yard'),binding=p.bindings['camera-yard'],nextCamera=houseBindings['camera-yard'];
 if(camera&&binding?.entityId==='camera.c320ws_mainstream'&&
  !Object.entries(p.bindings).some(([id,b])=>id!=='camera-yard'&&b.entityId===nextCamera)){
  p.bindings['camera-yard']={entityId:nextCamera,verified:false};
  camera.note='TP-Link · Live View · источник заменён по выбору владельца';
 }
 p.housePresetVersion=3;
 return migrateCorridor(validatePreferences(p));
}
export function bindingProblem(d,e){
 const t=deviceTypes[d.type];
 if(!e||['unknown','unavailable',''].includes(e.state))return 'нет доступного состояния';
 if(!t.domains.includes(e.entity_id.split('.')[0]))return 'неверный домен';
 if(t.controllable&&d.type!=='station'&&!['on','off'].includes(e.state))return 'нет состояния on/off';
 if(t.classes){
  if(!t.classes.includes(e.attributes?.device_class))return 'неверный класс датчика';
  if(e.entity_id.startsWith('binary_sensor.')&&!['on','off'].includes(e.state))return 'нет состояния on/off';
 }
 if(t.unit&&(e.attributes?.unit_of_measurement!==t.unit||!Number.isFinite(Number(e.state))))return 'неверная единица или значение';
 if(d.type==='battery'&&(Number(e.state)<0||Number(e.state)>100))return 'заряд вне диапазона 0–100';
 return '';
}
export function activateHouseProfile(input,states){
 const p=validatePreferences(input),byEntity=new Map(states.map(e=>[e.entity_id,e])),report=[];
 for(const d of p.devices){
  const b=p.bindings[d.id];
  if(d.status!=='installed'||!houseBindings[d.id]||b.entityId!==houseBindings[d.id])continue;
  const problem=bindingProblem(d,byEntity.get(b.entityId));
  b.verified=!problem;
  report.push({id:d.id,name:d.name,entityId:b.entityId,ok:!problem,problem});
 }
 p.mode='live';
 p.houseProfileConfirmed=true;
 return {preferences:validatePreferences(p),report};
}
