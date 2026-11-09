// Компактная сводка только реальных сигналов. Отсутствующие данные молча пропускаются.
import {areaName} from './catalog.js';
import {binaryValue} from './sensor-state.js';
import {numericReading,stateTimes} from './readings.js';
const plural=(n,one,few,many)=>n%10===1&&n%100!==11?one:n%10>=2&&n%10<=4&&(n%100<12||n%100>14)?few:many;
const read=(deps,id)=>{const b=deps.bindings[id],d=deps.devices.find(x=>x.id===id);return d&&d.status==='installed'&&b?.verified&&b.entityId?deps.entityStates?.[b.entityId]:null};
export function digestItems({mode,liveOnline=true,devices=[],bindings={},entityStates={},now=Date.now(),alarmState}){
 const deps={devices,bindings,entityStates,now},items=[];
 const batteries=devices.filter(d=>d.type==='battery'&&d.status==='installed')
  .map(d=>({d,value:numericReading(read(deps,d.id),{online:liveOnline,unit:'%',now}).value}))
  .filter(b=>b.value!==null&&b.value<35).sort((a,b)=>a.value-b.value);
const openSensors={label:'Открыть датчики',open:'sensors'};
 if(batteries.length===1)items.push({level:batteries[0].value<20?'warn':'info',icon:'radio',text:`Батарейка · ${areaName(batteries[0].d.room)}: ${batteries[0].value} %`,action:openSensors});
 else if(batteries.length===2)for(const b of batteries)items.push({level:b.value<20?'warn':'info',icon:'radio',text:`Батарейка · ${areaName(b.d.room)}: ${b.value} %`,action:openSensors});
 else if(batteries.length>2)items.push({level:'warn',icon:'radio',text:`${batteries.length} ${plural(batteries.length,'батарейка','батарейки','батареек')} разряжены`,action:openSensors});
 for(const d of devices.filter(d=>d.type==='leak'&&d.status==='installed'))
  if(binaryValue('leak',read(deps,d.id)?.state)===true)items.push({level:'danger',icon:'droplets',text:`Протечка · ${areaName(d.room)}`,action:openSensors});
 if(mode==='live'&&!liveOnline)items.push({level:'warn',icon:'wifi-off',text:'Нет связи с Home Assistant'});
 const offline=devices.filter(d=>['door','motion','smoke','leak'].includes(d.type)&&d.status==='installed'&&read(deps,d.id)?.state==='unavailable').map(d=>d.name);
 if(offline.length)items.push({level:'warn',icon:'wifi-off',text:`Нет связи: ${offline.join(', ')}`,action:openSensors});
 for(const d of devices.filter(d=>['light','rgb'].includes(d.type)&&d.status==='installed')){
  const e=read(deps,d.id),changed=e?.state==='on'?stateTimes(e,now).changedAt:null;
  if(changed===null||now-changed<=6*3600000)continue;
  items.push({level:'info',icon:'lightbulb',text:`${areaName(d.room)} · свет горит ${Math.floor((now-changed)/3600000)} ч`,action:{label:"Открыть комнату",room:d.room}});break;
 }
 const weather=Object.values(entityStates).find(e=>e.entity_id?.startsWith('weather.')),t=weather?.attributes?.temperature;
 if(Number.isFinite(t)&&t<-5)items.push({level:'info',icon:'thermometer',text:`Мороз: ${Math.round(t)} °C`});
 // Тревога охраны — самый приоритетный сигнал; alarmState приходит опционально.
 if(alarmState==='triggered')items.push({level:'danger',icon:'triangle-alert',text:'Тревога: охрана сработала'});
 // Обновление Home Assistant: только ядро (update.home_assistant_core_update), не аддоны.
 const coreUpdate=Object.values(entityStates).find(e=>e.state==='on'&&typeof e.entity_id==='string'&&e.entity_id.startsWith('update.')&&e.entity_id.includes('home_assistant_core_update'));
 if(coreUpdate)items.push({level:'warn',icon:'download',text:'Доступно обновление Home Assistant',action:{label:'Открыть системы',open:'systems'}});
 return items.sort((a,b)=>({danger:0,warn:1,info:2})[a.level]-({danger:0,warn:1,info:2})[b.level]);
}