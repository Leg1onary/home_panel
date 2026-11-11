// Компактная сводка только реальных сигналов. Отсутствующие данные молча пропускаются.
import {areaName} from './catalog.js';
import {binaryValue} from './sensor-state.js';
import {WEATHER_LABEL,WEATHER_ICON} from './weather-const.js';
import {numericReading,stateTimes} from './readings.js';
import {findMeterEntities,meterValue} from './energy.js';
import {guardActive,doorOpenTooLong,nightYardEvents,yardAnomaly} from './guard.js';
const plural=(n,one,few,many)=>n%10===1&&n%100!==11?one:n%10>=2&&n%10<=4&&(n%100<12||n%100>14)?few:many;
const read=(deps,id)=>{const b=deps.bindings[id],d=deps.devices.find(x=>x.id===id);return d&&d.status==='installed'&&b?.verified&&b.entityId?deps.entityStates?.[b.entityId]:null};
export function digestItems({mode,liveOnline=true,devices=[],bindings={},entityStates={},now=Date.now(),alarmState,meterKnown=false}){
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
 // Счётчик ТНС: сущности есть, но значения недоступны. info по умолчанию (облачная
 // интеграция может редко обновляться); больше суток без last_updated — warn.
 const meter=findMeterEntities(entityStates);
 if((meter.reading||meter.consumption)&&meterValue(meter.reading)===null&&meterValue(meter.consumption)===null){
  const times=[meter.reading,meter.consumption].filter(Boolean).map(e=>{const t=Date.parse(e.last_updated);return Number.isFinite(t)?t:null});
  const older=times.every(t=>t===null||now-t>24*3600000);
  items.push({level:older?'warn':'info',icon:'zap',text:older?'Счётчик ТНС: нет данных больше суток':'Счётчик ТНС: нет данных'});
 }
 // Тревога охраны — самый приоритетный сигнал; alarmState приходит опционально.
 if(alarmState==='triggered')items.push({level:'danger',icon:'triangle-alert',text:'Тревога: охрана сработала'});
 // Обновление Home Assistant: только ядро (update.home_assistant_core_update), не аддоны.
 const coreUpdate=Object.values(entityStates).find(e=>e.state==='on'&&typeof e.entity_id==='string'&&e.entity_id.startsWith('update.')&&e.entity_id.includes('home_assistant_core_update'));
 if(coreUpdate)items.push({level:'warn',icon:'download',text:'Доступно обновление Home Assistant',action:{label:'Открыть системы',open:'systems'}});
 return items.sort((a,b)=>({danger:0,warn:1,info:2})[a.level]-({danger:0,warn:1,info:2})[b.level]);
}
// Волна D 3.2.3: утренний брифинг — сводка дня сверху дайджеста. Максимум 4 пункта
// по приоритету; ничего нет → «Всё спокойно». Ночью прогноз не показываем.
// 3.4.0 «Ночная охрана»: приоритет безопасность > погода —
// дверь-ночь > дверь-долго > двор-ночь > аномалия двора > прогноз > свет > двор > дверь > охрана.
export const BRIEF_ICONS=new Set(['sun','moon','zap','video','thermometer','alert-triangle','door','shield',
 'cloud-sun','cloudy','cloud-rain','cloud-snow','cloud-fog','wind','cloud-lightning','cloud-hail','cloud-drizzle']);
export function digestBriefing({entityStates={},devices=[],bindings={},yardClips=[],forecast,now=Date.now(),
 isNightNow=false,alarmState,nightStart='23:00',nightEnd='07:00',guardNight='auto',guardDoorMinutes=15}={}){
 const deps={devices,bindings,entityStates,now},items=[];
 const curMin=(d=>d.getHours()*60+d.getMinutes())(new Date(now));
 const guardOn=guardActive(curMin,nightStart,nightEnd,guardNight);
 // Дверь: открыта сейчас? Долго открыта (guardDoorMinutes)? Открыта ночью?
 const door=devices.find(d=>d.type==='door'&&d.status==='installed'&&binaryValue('door',read(deps,d.id)?.state)===true);
 const doorOpen=!!door;
 let doorLongMin=null;
 if(doorOpen){
  const changedAt=stateTimes(read(deps,door.id),now).changedAt;
  if(doorOpenTooLong(changedAt,now,guardDoorMinutes))doorLongMin=Math.round((now-changedAt)/60000);
 }
 // 1. Дверь открыта ночью (охрана активна): самый высокий приоритет.
 if(doorOpen&&guardOn)items.push({icon:'door',text:'Дверь открыта ночью'});
 // 2. Дверь открыта дольше guardDoorMinutes минут (уровень 3, независимо от ночи).
 else if(doorLongMin!==null)items.push({icon:'alert-triangle',text:`Дверь открыта (${doorLongMin} мин)`});
 // 3. Ночные события двора за 12 часов — раньше обычного двора-пункта.
 const yardNight=nightYardEvents(yardClips,now,nightStart,nightEnd);
 if(yardNight)items.push({icon:'video',text:`Двор: ${yardNight} событий ночью`,action:{label:'Открыть камеру двора',open:'yard'}});
 // 4. Аномальная активность двора за сутки (упрощённый порог ≥10 событий/24 ч).
 if(yardAnomaly(yardClips,now))items.push({icon:'alert-triangle',text:'Двор: аномальная активность'});
 // 5. Прогноз на сегодня (днём): «Сегодня: Облачно, +7°».
 if(!isNightNow&&forecast&&Number.isFinite(forecast.temperature)&&WEATHER_LABEL[forecast.condition]){
  const t=Math.round(forecast.temperature),sign=t>0?'+':'';
  items.push({icon:WEATHER_ICON[forecast.condition]||'sun',text:`Сегодня: ${WEATHER_LABEL[forecast.condition]}, ${sign}${t}°`});
 }
 // 6. Забытый свет: включённые линии света по биндингам.
 const lightsOn=devices.filter(d=>['light','rgb'].includes(d.type)&&d.status==='installed'&&read(deps,d.id)?.state==='on');
 if(lightsOn.length)items.push({icon:'zap',text:lightsOn.length===1?`Свет горит: 1 (${areaName(lightsOn[0].room)})`:`Свет горит: ${lightsOn.length}`});
 // 7. Двор за последние 12 часов; кликабельный пункт (камера двора).
 const yard=(Array.isArray(yardClips)?yardClips:[]).filter(c=>now-Number(c.at)>=0&&now-Number(c.at)<=12*3600000).length;
 if(yard)items.push({icon:'video',text:`Двор: ${yard} событий за 12 ч`,action:{label:'Открыть камеру двора',open:'yard'}});
 // 8. Дверь приоткрыта (без ночных/долгих условий — базовый факт).
 if(doorOpen&&doorLongMin===null&&!guardOn)items.push({icon:'alert-triangle',text:'Дверь приоткрыта'});
 // 9. Охрана активна (armed_*; тревога уже есть в digestItems).
 if(alarmState==='armed_away'||alarmState==='armed_home')items.push({icon:'shield',text:'Охрана активна'});
 // Валидация иконок (неизвестное имя отбрасывается вместе с пунктом) и максимум 4.
 const valid=items.filter(it=>BRIEF_ICONS.has(it.icon)).slice(0,4);
 return valid.length?valid:[{icon:'moon',text:'Всё спокойно'}];
}