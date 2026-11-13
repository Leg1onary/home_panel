import {deviceId} from './compat.js';
import {
 createIcons,House,Box,Lightbulb,Power,ScanEye,SlidersHorizontal,Sun,Moon,X,ArrowRight,ArrowUpRight,Zap,Activity,
 AudioLines,Camera,ChevronRight,CircleCheck,DoorClosed,Droplets,Heater,Leaf,Radio,RotateCcw,Thermometer,Shield,
 Trees,Archive,Armchair,Bath,BedDouble,Blocks,DoorOpen,MoveUpRight,Sofa,MoonStar,Star,ChevronUp,
 ChevronDown,Check,LoaderCircle,TriangleAlert,WifiOff,Play,Pause,SkipBack,SkipForward,ChartNoAxesCombined,Volume2,ImagePlus,Settings2,Info,Maximize,Minimize,Download,Upload,Cloud,Cloudy,CloudSun,CloudRain,CloudSnow,CloudFog,CloudLightning,CloudDrizzle,CloudHail,Wind,LogOut,Film,Sparkles,Video,Plus,Search,History
} from 'lucide';
import {rooms,state,getRoom,countLights,channelsFor,sensors} from './schema.js';
import {sendCommand,commandFor,hasPending} from './commands.js';
import {preferences,loadStorage,saveStorage,flushStorage,savePhoto,removePhoto,applyPreferences} from './storage.js';
import {bindingDefinitions,validatePreferences,sanitizeEnergyReadings,sanitizeEnergyTariff} from './preferences.js';
import {readingsDateOf,formatMeterInt} from './energy.js';
import {isLive,canControl,observed,startLive,discover,readiness,setYardClipHandler} from './live.js';
import {areas,areaName,deviceTypes,sensorTypes,samePhysicalDevice} from './catalog.js';
import {api} from './api.js';
import {startCameraPlayer} from './camera-player.js';
import {houseBindings,bindingProblem} from './house-profile.js';
import {stationSupports,stationStateLabel} from './station.js';
import {buildDeviceModel,detachChannel} from './device-model.js';
import {deviceStructure,equipmentFromForm} from './device-model-ui.js';
import {homeSummary} from './home-summary.js';
import {digestItems} from './digest.js';
import {binaryValue,leakIssues} from './sensor-state.js';
import {motionObservation,elapsedLabel} from './motion.js';
import {historyState,statisticsView,inspectHistoryChart,energyChartState} from './history-ui.js';
import {numericReading,stateTimes} from './readings.js';
import {duoUI,assistantView} from './assistant-ui.js';
import {scenarioChipsRow,handleScenarioClick,bindScenarioPainter,bindScenarioHost} from './scenarios-ui.js';
import {shouldAmbient,AMBIENT_AFTER_IDLE} from './ambient.js';
import {isNight,isTime,nightLabel,nightDim} from './night.js';
import {rememberSunrise} from './day-arc.js';
import {luxValue,autoTheme,AUTO_THEME_UP,AUTO_THEME_DOWN} from './auto-theme.js';
import {render as preactRender,h as ph} from './preact/kit.js';
import {EnergyWidget} from './preact/energy-widget.js';
import {DigestWidget,digestBus} from './preact/digest-widget.js';
import {WeatherChip,weatherBus,fetchForecast} from './preact/weather-widget.js';
import {QuickWidget,quickBus} from './preact/quick-widget.js';
import {StationWidget,stationBus} from './preact/station-widget.js';
import {FactsWidget,factsBus} from './preact/facts-widget.js';
import {ICONS} from './preact/icons.js';
import {RoomCardWidget,RoomSheetWidget,roomBus} from './preact/room-widget.js';
import {YardClipsWidget,yardClipsBus} from './preact/yard-clips-widget.js';
import {YARD_REFRESH_MS} from './yard-card.js';
import {parseBrightness,scheduleWave} from './light-wave.js';
import {loadShopping,paintShopping,shoppingMutate,shoppingState,shoppingCardMarkup} from './shopping.js';
import {paintAlarm,alarmMarkup,alarmEntity,alarmAction} from './alarm.js';
import {weatherViewArgs,weatherNowMarkup,weatherArcMarkup,weatherDailyMarkup,weatherHourlyMarkup,weatherMoonMarkup,weatherEntityOf} from './weather-page.js';
import {eventsListMarkup,eventsFilterMarkup,activityMarkup,lightTodayMarkup} from './events.js';
import {parseBlocks,serializeBlocks,digestEssence,energyEssence,stationEssence} from './home-blocks.js';
import {setHomeEventHandler} from './live.js';

import {esc,disabled,timeOf,clock,date,scheduleMinute,PANEL_TIMEZONE} from './dom.js';
const $=s=>document.querySelector(s);
const I=name=>`<i data-lucide="${name}"></i>`;
const iconSet={House,Box,Lightbulb,Power,ScanEye,SlidersHorizontal,Sun,Moon,X,ArrowRight,ArrowUpRight,Zap,Activity,
 AudioLines,Camera,ChevronRight,CircleCheck,DoorClosed,Droplets,Heater,Leaf,Radio,RotateCcw,Thermometer,Shield,
 Trees,Archive,Armchair,Bath,BedDouble,Blocks,DoorOpen,MoveUpRight,Sofa,MoonStar,Star,ChevronUp,
 ChevronDown,Check,LoaderCircle,TriangleAlert,WifiOff,Play,Pause,SkipBack,SkipForward,ChartNoAxesCombined,Volume2,ImagePlus,Settings2,Info,Maximize,Minimize,Download,Upload,Cloud,Cloudy,CloudSun,CloudRain,CloudSnow,CloudFog,CloudLightning,CloudDrizzle,CloudHail,Wind,LogOut,Film,Sparkles};
const icons=()=>{
 createIcons({icons:{...iconSet,...ICONS},attrs:{'stroke-width':1.6}});
 // lucide хранит data-lucide на созданных svg и пересоздаёт их при каждом вызове: кнопка заменялась между mousedown и mouseup и браузер не генерировал click. Конвертация — одноразовая.
 document.querySelectorAll('svg[data-lucide]').forEach(s=>s.removeAttribute('data-lucide'));
 const title=$('.sheet h2');if(title)title.id='sheet-title';
};
let stationAdjusting=false;
const reading=n=>n.toFixed(1).replace('.',',');
let modelAPI=null,modelPromise=null,viewRevision=0,lastFocus=null,toastTimer,idleTimer,ambientTimer,idleAt=0,settingsOpen=false,photoBlob=null;
let techTab='connection',bindingRoom='living',techEntities=[],techMessage='';
// Unsaved form edits survive room switches and failed saves; outcome is per binding.
let bindingDraft={},bindingOutcome={};
let catalogEdit=null,cameraRevision=0,cameraURL=null,cameraPlayer=null,cameraDevice=null;
let equipmentEdit=null;
const channel=id=>rooms.flatMap(r=>r.channels).find(c=>c.id===id);
const hallPowered=()=>!!channel('hall:0')?.on;
const noConnection=()=>isLive()?!state.liveOnline:state.demoOffline;
const masterBlocked=()=>hasPending()||noConnection()||!rooms.some(r=>r.channels.some(c=>c.masterOff&&canControl(c.id)));
const binaryLabel=(id,on,off)=>{
 if(!isLive())return state.demoOffline?'Нет связи':state.devices.some(d=>d.id===id&&d.status==='installed')?`${off} · демо`:'Нет данных';
 const e=observed(id),type=state.devices.find(d=>d.id===id)?.type;
 const value=binaryValue(type,e?.state);return value===true?on:value===false?off:'Нет данных';
};
function storageStatus(){
 const node=$('#storage-status');if(node){node.textContent=state.storageMessage;node.className='storage-status '+state.storage}
 const footer=$('#footer-storage');if(footer){footer.textContent=state.storage==='saved'?'Настройки сохранены':state.storageMessage;footer.title=state.storageMessage}
 const bar=$('.shell>footer');if(bar)bar.dataset.storage=state.storage;
}
function persist(){saveStorage(storageStatus);storageStatus()}
function applyAppearance(){
 document.documentElement.dataset.theme=state.theme;document.documentElement.dataset.kiosk=String(state.kiosk);
 document.documentElement.dataset.mode=state.mode;$('#theme').innerHTML=I(state.theme==='dark'?'sun':'moon');applyNight();icons();updateThemeButton();
}
// Авто-тема по освещённости террасы: чистое решение в auto-theme.js, здесь —
// только чтение привязки и применение. Ручной переключатель блокируется честно.
let autoThemeZone=null;
function terraceLux(){
 if(!isLive())return null;
 const r=numericReading(observed('terrace-lux'),{online:state.liveOnline,unit:'lx'});
 return r.available?r.value:null;
}
function applyAutoTheme(){
 if(!state.autoTheme){autoThemeZone=null;return}
 const lux=terraceLux();
 if(lux===null){autoThemeZone=null;return}
 const next=autoTheme(lux,autoThemeZone);
 if(!next)return;
 autoThemeZone=next;
 if(next===state.theme)return;
 state.theme=next;
 document.documentElement.dataset.theme=next;
 $('#theme').innerHTML=I(next==='dark'?'sun':'moon');
 updateThemeButton();icons();
 if(state.view==='statistics')paintStatistics();
 persist();
}
function updateThemeButton(){
 const b=$('#theme');if(!b)return;
 const lux=terraceLux(),locked=state.autoTheme&&lux!==null;
 b.disabled=locked;
 const label=locked?`Авто по освещённости · ${Math.round(lux)} лк`:'Переключить тему';
 b.setAttribute('aria-label',label);b.title=label;
}

function toast(message){
 $('#toast').textContent=message;$('#toast').classList.add('visible');
 clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('visible'),3600);
}
function modal(content,room=null){
 clearInterval(duoTimer);duoGeneration++;
 clearCamera();
 $('#overlay').classList.remove('camera-overlay');
 $('.sheet').classList.remove('camera-sheet','settings-sheet','station-hub-sheet');
 $('.sheet').scrollTop=0;
 lastFocus=document.activeElement;$('#sheet-content').innerHTML=content;
 const sheet=$('.sheet');sheet.classList.remove('sheet-in');void sheet.offsetWidth;sheet.classList.add('sheet-in');
 $('#sheet-content').dataset.room=room||'';$('#overlay').hidden=false;icons();$('.close').focus();armIdle();
 $('#sheet-content').scrollTop=0;
}
function closeModal(){
 clearInterval(duoTimer);duoGeneration++;
 stationAdjusting=false;
 clearCamera();
 $('#overlay').hidden=true;$('#overlay').classList.remove('camera-overlay');settingsOpen=false;state.techOpen=false;
 if(lastFocus?.isConnected)lastFocus.focus();armIdle();
}
function lightCountLabel(){
 if(isLive()&&!state.liveOnline)return 'Нет данных о свете';
 if(isLive()){
  const channels=rooms.flatMap(r=>r.channels.filter(c=>!c.planned));
  const unknown=channels.filter(c=>!canControl(c.id)).length;
  return unknown?`Включено: ${countLights()} · без данных: ${unknown}`:`Включено: ${countLights()} · все линии доступны`;
 }
 const n=countLights();return `${n} ${n%10===1&&n%100!==11?'линия включена':n%10>=2&&n%10<=4&&!(n%100>=12&&n%100<=14)?'линии включены':'линий включено'}`;
}
function sensorStatus(id){
 const s=sensors[id];if(noConnection())return isLive()?'Нет связи с Home Assistant':'Нет связи · демо';
 if(s.quality==='unavailable')return 'Нет данных';
 if(isLive()){
  const d=state.devices.find(d=>d.type==='temperature'&&d.room===id&&d.status==='installed');
  const times=stateTimes(d?observed(d.id):null);
  return times.updatedAt?'Состояние HA обновлено '+elapsedLabel(times.updatedAt):'Время обновления HA неизвестно';
 }
 return s.quality==='stale'||Date.now()-s.receivedAt>30*60*1000?'Данные устарели':(isLive()?'Home Assistant · ':'Демопакет · ')+timeOf(s.receivedAt);
}
function climate(){
 const s=sensors.living,stale=sensorStatus('living')==='Данные устарели';
 return `<section class="climate"><div class="title-line"><span>Температура гостиной</span>${I('thermometer')}</div>
 <div class="reading"><strong>${noConnection()||stale||s.quality==='unavailable'?'—':reading(s.value)}</strong><span>°C</span></div>
 <div class="humidity">${I('droplets')}${noConnection()||s.humidity===null?'—':s.humidity+' %'} · ${sensorStatus('living')}</div>
 <div class="subreadings"><button class="sensor-row" data-sensor="well"><span>Скважина</span><strong>${noConnection()||sensors.well.quality==='unavailable'?'Нет данных':sensorStatus('well')==='Данные устарели'?'Данные устарели':reading(sensors.well.value)+'°'}</strong></button>
 <button class="sensor-row" data-sensor="attic"><span>Чердак</span><strong>${noConnection()||sensors.attic.quality==='unavailable'?'Нет данных':sensorStatus('attic')==='Данные устарели'?'Данные устарели':reading(sensors.attic.value)+'°'}</strong></button></div></section>`;
}
function station(){
 const demo=!isLive()&&state.stationMode==='demo',offline=!isLive()&&(state.stationMode==='offline'||state.demoOffline);
 const e=isLive()?observed('station'):null;
 return `<section class="station-card"><div class="station-top"><span class="eyebrow">Голос дома</span>${I('audio-lines')}</div>
 <h2>Станция · ${esc(stationRoom())}${state.stationPlaying?' <span class="eq-bars" aria-hidden="true"><i></i><i></i><i></i></span>':''}</h2><p>${esc(e?.attributes.media_title|| (isLive()?'Музыка и голос · через Home Assistant':demo?'Тестовая карточка станции.':'Голос и музыка.'))}</p>
 <button class="text-button" data-action="station">${isLive()?'Открыть управление':demo?'Открыть демоуправление':'Статус и подключение'} ${I('arrow-up-right')}</button>
 <div class="station-bottom"><span></span>${isLive()?(!state.liveOnline?'Нет связи с HA':esc(stationStateLabel(e))):offline?'Нет связи · демо':demo?(state.stationPlaying?'Воспроизведение · демо':'Пауза · демо'):'Демонстрационный режим'}</div></section>`;
}
function roomCard(r){
 const channels=channelsFor(r),on=channels.filter(c=>c.on).length;
 const unknown=isLive()&&channels.some(c=>!canControl(c.id));
 const subtitle=noConnection()&&channels.length?'Нет связи':unknown?'Есть непроверенные линии':!channels.length?(r.channels.length?'Свет планируется':'Нет линий света'):on?'Свет включён':'Свет выключен';
 // Мини-лампочки: точка на каждую линию, зажжённые — тёплым золотом (видно, где именно горит).
 const lamps=channels.length?`<div class="room-lamps" aria-hidden="true">${channels.map(c=>`<i class="${c.on&&!state.demoOffline?'is-on':''}"></i>`).join('')}</div>`:'';
 // Температура комнаты (живой сенсор) — мелко у нижнего края карточки.
 const tdev=isLive()?state.devices.find(d=>d.type==='temperature'&&d.room===r.id&&d.status==='installed'):null;
 const tv=tdev&&isLive()?Number(observed(tdev.id)?.state):NaN;
 const temp=Number.isFinite(tv)?`<span class="room-temp">${reading(tv)}°</span>`:'';
 const none=!channels.length;
 return `<button class="room-card ${on&&!state.demoOffline?'lit':''} ${none?'is-empty':''}" data-room="${r.id}">
 <div class="card-top">${I(r.icon)}${channels.length?`<span class="room-status ${noConnection()||unknown?'offline':''}">${noConnection()?I('wifi-off'):unknown?'— / '+channels.length:`${on} / ${channels.length}`}</span>`:''}</div>
 <h3>${r.short}${temp}</h3><p>${subtitle}</p>${lamps}</button>`;
}
function quietDoor(){
 const label=binaryLabel('door','Дверь открыта','Дверь закрыта');
 return `<button class="quiet-card" data-action="door"><div class="quiet-info">${I(label==='Нет данных'||noConnection()?'wifi-off':'door-closed')}
 <div><h3>${label}</h3><p>${isLive()?'Xiaomi · '+(observed('door')?'Home Assistant':'не привязан'):'Состояние демонстрационное'}</p></div></div>${I('chevron-right')}</button>`;
}
function heroStatusChip(){
 const online=isLive()&&state.liveOnline,offline=isLive()&&!state.liveOnline;
 const label=offline?`Нет связи${state.liveError?' · '+state.liveError:''}`:online?'Home Assistant · Онлайн':'Демо · без Home Assistant';
 return `<button class="hero-status-chip ${offline?'is-offline':''}" data-action="house-review" title="${esc(isLive()?[state.liveError||'Home Assistant','Проверить подключение'].join(' · '):'Реальные устройства не подключены')}" aria-label="${esc(label)}: открыть настройки подключения"><span class="hero-dot"></span>${esc(label)}</button>`;
}
let lastSunState=null;
// 3.4.4: дугу светового дня убрали с главной — она живёт на странице «Погода»
// (src/weather-page.js). Запоминание восхода остаётся здесь: app.js единственный
// видит переход below_horizon → above_horizon (в момент refresh).
function trackSunrise(){
 const e=Object.values(state.entityStates||{}).find(e=>e.entity_id==='sun.sun');
 if(!e)return;
 rememberSunrise(lastSunState,e.state,Date.now());lastSunState=e.state;
}
// 3.4.4 (планшет): статус-чип и кнопка сброса ракурса переехали из hero в шапку
// (слева): на узких экранах hero-top перестал наезжать на часы.
function headerLeftMarkup(){
 return `<span id="hero-status">${heroStatusChip()}</span><button id="reset-model" title="Вернуть исходный ракурс" aria-label="Сбросить ракурс">${I('rotate-ccw')}</button>`;
}
function paintHeaderLeft(){
 const node=$('#header-left');if(!node)return;
 const markup=headerLeftMarkup();
 if(node.dataset.rendered===markup)return;
 node.innerHTML=markup;node.dataset.rendered=markup;icons();
}
// Сворачиваемые блоки правой колонки: заголовок-строка всегда виден, тело
// (Preact-монтаж #home-digest/#home-energy/#home-station) прячется классом collapsed.
const BLOCK_IDS=['digest','energy','station'];
function blockStates(){
 try{return parseBlocks(localStorage.getItem('hp-blocks'))}catch{return {...parseBlocks(null)}}
}
function applyBlocks(){
 const s=blockStates();
 for(const id of BLOCK_IDS){
  const b=$('#home-block-'+id);if(!b)continue;
  b.classList.toggle('collapsed',!s[id]);
  b.querySelector('.home-block-head')?.setAttribute('aria-expanded',String(!!s[id]));
 }
}
function toggleBlock(id){
 if(!BLOCK_IDS.includes(id))return;
 const s=blockStates();s[id]=!s[id];
 try{localStorage.setItem('hp-blocks',serializeBlocks(s))}catch{/* приватный режим — забыли, не страшно */}
 applyBlocks();
}
// «Суть» строк-заголовков: обновляется в refresh(), данные уже посчитаны.
function updateBlockEssences(){
 const digestNode=$('#home-digest-essence');
 if(digestNode){
  const items=state.liveOnline?digestItems(digestArgs()):[];
  digestNode.textContent=digestEssence(items.length);
 }
 const energyNode=$('#home-energy-essence');
 if(energyNode)energyNode.textContent=isLive()&&meterKnownFromWidget?energyEssence(state.energy_readings,state.energy_tariff):'Показаний пока нет';
 const stationNode=$('#home-station-essence');
 if(stationNode)stationNode.textContent=stationEssence(stationArgs());
}
// Чип двора: только реальное движение по панельному детектору (ha/yard-motion).
// Детектор панельный — сравнение кадров камеры на сервере, биндинг yard-motion не нужен.
// Слот живёт внутри #home-status, чтобы частые перерисовки погоды/фактов
// не сбрасывали загруженный кадр камеры.
const WEATHER_SLOT='<span id="weather-slot"></span>';
const FACTS_SLOT='<span id="facts-slot"></span>';
const YARD_POLL_MS=3000;
let yardData=null,yardPoll={at:0,busy:false};
async function pollYardMotion(){
 if(!isLive()||yardPoll.busy)return;
 const now=Date.now();
 if(now-yardPoll.at<YARD_POLL_MS)return;
 yardPoll.busy=true;yardPoll.at=now;
 try{const data=await api('ha/yard-motion');if(data){yardData=data;factsNotify()}}catch{/* детектор недоступен — чип просто не показываем */}
 finally{yardPoll.busy=false}
}
// Энергокарточка: Preact-компонента (src/preact/energy-widget.js) сама опрашивает
// ha/energy (кеш 60 с) и управляет содержимым #home-energy. Сюда остаётся только
// одноразовый монтаж узла и флаг для дайджеста.
let meterKnownFromWidget=false;
function updateEnergyRegion(){
 const energy=$('#home-energy');
 if(!energy||!isLive())return;
 if(!energy.dataset.preact){
  preactRender(ph(EnergyWidget,{onMeterKnown:v=>{meterKnownFromWidget=v}}),energy);
  energy.dataset.preact='1';
 }
 energy.hidden=false; // Preact сам решает: без данных внутри пусто.
}
// Дайджест: Preact-компонента (src/preact/digest-widget.js) управляет содержимым
// #home-digest; app.js только монтирует узел и рассылает deps по digestBus в refresh().
function updateDigestRegion(){
 const digest=$('#home-digest');
 if(!digest||!isLive())return;
 if(!digest.dataset.preact){
  preactRender(ph(DigestWidget,{}),digest);
  digest.dataset.preact='1';
 }
 digest.hidden=false; // пустой рендер прячет правило CSS #home-digest:empty.
}
// Погодный чип: Preact-компонента (src/preact/weather-widget.js) в слоте hero-facts.
// Слот пересоздаётся при перерисовке #home-status — dataset.preact теряется, монтаж повторяется.
function updateWeatherRegion(){
 const slot=$('#weather-slot');
 if(!slot||!isLive())return;
 if(!slot.dataset.preact){
  preactRender(ph(WeatherChip,{}),slot);
  slot.dataset.preact='1';
 }
}
// Факты: Preact-компонента (src/preact/facts-widget.js) управляет содержимым
// #facts-slot внутри #home-status (двери/скважина/чердак + двор-чип). app.js
// монтирует узел и рассылает deps по factsBus в refresh() и после опроса двора.
function updateFactsRegion(){
 const slot=$('#facts-slot');
 if(!slot)return;
 if(!slot.dataset.preact){
  preactRender(ph(FactsWidget,{onYardFrame:()=>loadYardFrame()}),slot);
  slot.dataset.preact='1';
 }
}
function factsArgs(){
 const door=binaryLabel('door','Открыта','Закрыта'),terrace=binaryLabel('terrace-door','Открыта','Закрыта');
 const temperature=id=>{
  const d=state.devices.find(d=>d.room===id&&d.status==='installed'&&d.type==='temperature');
  return d?deviceReading(d):'Нет датчика';
 };
 const when=yardData?timeOf(yardData.lastMotionAt):'';
 return {devices:state.devices,door,terrace,well:temperature('well'),attic:temperature('attic'),live:isLive(),
  yard:isLive()?{data:yardData,when,mode:state.mode,now:Date.now(),frameUrl:yardFrame.url}:null};
}
function factsNotify(){factsBus.notify(factsArgs())}
// Рельса «Под рукой»: Preact-компонента (src/preact/quick-widget.js) в #home-quick.
// app.js только монтирует узел и рассылает deps по quickBus в refresh().
function updateQuickRegion(){
 const rail=$('#home-quick');
 if(!rail)return;
 if(!rail.dataset.preact){
  preactRender(ph(QuickWidget,{}),rail);
  rail.dataset.preact='1';
 }
}
// Компактная карточка станции (3.3.14): Preact-компонента (src/preact/station-widget.js)
// в #home-station, deps рассылаются по stationBus в refresh(). Показывается и в демо.
function updateStationRegion(){
 const slot=$('#home-station');
 if(!slot)return;
 if(!slot.dataset.preact){
  preactRender(ph(StationWidget,{}),slot);
  slot.dataset.preact='1';
 }
 slot.hidden=false;
}
// Лента клипов двора: Preact-виджет (src/preact/yard-clips-widget.js) в слоте
// вкладки «Двор». Слот пересоздаётся при перерисовке #room-equipment — монтаж
// повторяется, как у погодного слота. Демо: live=false → виджет не рендерится.
function updateYardClipsRegion(){
 const slot=$('#yard-clips-slot');
 if(!slot||!isLive())return;
 if(!slot.dataset.preact){
  preactRender(ph(YardClipsWidget,{live:isLive(),nightStart:state.nightStart,nightEnd:state.nightEnd}),slot);
  slot.dataset.preact='1';
 }
}
setYardClipHandler(info=>yardClipsBus.notify({kind:'new',clip:info}));
// 3.6.0: живой тикер хроники на главной — последнее событие поверх hero.
let tickerFlash=0;
function paintHomeTicker(ev){
 const node=$('#home-ticker');
 if(!node)return;
 if(!ev||!Number.isFinite(ev.at)){node.hidden=true;return}
 const meta={yard:['video','Двор'],door:['door-open','Дверь'],light:['lightbulb','Свет'],meter:['zap','Счётчик'],system:['activity','Система']}[ev.type]||['activity','Дом'];
 const time=new Date(ev.at).toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit'});
 node.hidden=false;
 node.innerHTML=`<i data-lucide="${meta[0]}"></i><span>${esc(meta[1])} · ${esc(ev.text)}</span><time>${esc(time)}</time>`;
 node.classList.add('is-flash');clearTimeout(tickerFlash);
 tickerFlash=setTimeout(()=>node.classList.remove('is-flash'),2500);
 icons();
}
let guardData=null,guardPoll=null;
function guardChipLabel(){
 if(!isLive())return 'Демо';
 const g=guardData;
 if(!g)return '…';
 if(g.alarm)return 'Тревога';
 if(g.exitRemaining>0)return 'Выход · '+g.exitRemaining+' с';
 if(g.armed)return 'Активна';
 return 'Снята';
}
function paintGuardChip(){
 const node=$('#home-guard');
 if(!node)return;
 if(!isLive()){node.hidden=true;return}
 const g=guardData||{};
 const openDoor=(g.doors||[]).find(d=>d.open);
 const label=guardChipLabel();
 const tone=g.alarm?'is-alarm':g.armed?'is-armed':'';
 node.innerHTML=`<button type="button" class="guard-chip ${tone}" data-action="guard-sheet">${I('shield')}<div><strong>Охрана · ${esc(label)}</strong><small>${openDoor?esc(openDoor.name+' открыта'):'все двери закрыты'}</small></div></button>`;
 icons();
}
async function loadGuardChip(){
 if(!isLive())return paintGuardChip();
 try{
  guardData=await api('guard');
  if(state.view==='home')paintGuardChip();
 }catch{/* чип не критичен */}
 clearInterval(guardPoll);
 guardPoll=setInterval(()=>{if(state.view==='home'&&isLive())loadGuardChip()},10000);
}
function openGuardSheet(){
 const g=guardData||{};
 const doors=(g.doors||[]).map(d=>`<div class="status-line"><span>${I('door-closed')}${esc(d.name)}</span><strong>${d.open?'Открыта':'Закрыта'}</strong></div>`).join('');
 const status=g.alarm?'ТРЕВОГА · '+esc(g.alarm.doorName):g.exitRemaining>0?'Выход · '+g.exitRemaining+' с':g.armed?'Охрана активна (вне дома)':'Охрана снята';
 simpleSheet(`<div class="guard-sheet"><div class="eyebrow">Пилотная охрана</div><h2>${status}</h2>
 ${doors||'<p class="description">Двери не привязаны — привяжи в тех.разделе.</p>'}
 <div class="sheet-actions"><button class="primary" data-action="guard-arm" ${disabled(g.armed&&!g.alarm)}>Ушёл — поставить</button>
 <button class="secondary" data-action="guard-disarm" ${disabled(!g.armed)}>Снять с охраны</button>
 ${g.exitRemaining>0?'<button class="secondary" data-action="guard-cancel">Отменить выход</button>':''}</div>
 <p class="description">Вне дома: дверь открыта дольше ${state.guardAwayMinutes||3} мин — сирена циклами (3 мин / пауза 2 мин) + свет. Ночь: алерт через ${state.guardHomeAlertMinutes||10} мин, озвучка через ${state.guardHomeAnnounceMinutes||30} мин.</p></div>`);
}
async function loadHomeTicker(){
 try{const data=await api('events?limit=1');if(state.view==='home'&&data.events?.length)paintHomeTicker(data.events[0])}
 catch{/* тикер не критичен */}
}
setHomeEventHandler(ev=>{if(state.view==='home')paintHomeTicker(ev)});
function quickArgs(){
 const camera=state.devices.find(d=>d.type==='camera'&&d.room==='yard'&&d.status==='installed');
 return {masterBlocked:masterBlocked(),cameraId:camera?.id||null};
}
// Компактная карточка станции в правой колонке главной (3.3.14): deps для
// station-widget.js. В демо — заголовок «Демо», live — media_title из HA.
function stationArgs(){
 const demo=!isLive()&&state.stationMode==='demo';
 const e=isLive()?observed('station'):null;
 const idle=!state.stationPlaying&&!(e?.attributes?.media_title);
 return {demo,playing:state.stationPlaying,
  title:isLive()?(e?.attributes?.media_title||(idle?'Тишина · запусти с пульта или Алисой':'Музыка и голос · через Home Assistant')):demo?'Демо':'Голос и музыка',
  room:stationRoom(),
  playDisabled:!canControl('station:playing')||hasPending(),
  prevDisabled:!isLive()||!stationSupports(e,'previous',true)||hasPending(),
  nextDisabled:!isLive()||!stationSupports(e,'next',true)||hasPending()};
}

// Кадр двора: не чаще раза в 2 минуты (YARD_REFRESH_MS), ревизии против гонок,
// при ошибке кадра чип остаётся с иконкой камеры — честно без картинки.
// Кадр попадает в чип через factsNotify (deps.yard.frameUrl).
let yardFrame={url:null,at:0,rev:0,busy:false};
async function loadYardFrame(force=false){
 const thumb=$('.yard-chip .yard-thumb');
 if(!thumb||yardFrame.busy)return;
 const now=Date.now();
 if(!force&&now-yardFrame.at<YARD_REFRESH_MS)return;
 yardFrame.busy=true;const rev=++yardFrame.rev;
 try{
  const blob=await api('ha/camera',{method:'POST',body:{id:'camera-yard'},image:true});
  const url=URL.createObjectURL(blob),image=new Image();
  await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=reject;image.src=url});
  if(rev!==yardFrame.rev){URL.revokeObjectURL(url);return}
  if(yardFrame.url)URL.revokeObjectURL(yardFrame.url);
  yardFrame={url,at:now,rev,busy:false};
 }catch{if(rev===yardFrame.rev)yardFrame={...yardFrame,at:now,busy:false}}
 finally{if(rev===yardFrame.rev)yardFrame.busy=false}
 factsNotify();
}

function home(){
 const hero=`<div class="hero-overlay">
 <div class="hero-top"><div class="hero-clock" aria-label="Местное время дома"><div id="hero-clock">${clock()}</div><span id="hero-date">${date()}</span><span id="hero-greeting" class="hero-greeting" hidden></span></div></div>
 <div class="hero-facts" id="home-status">${WEATHER_SLOT}${FACTS_SLOT}</div></div>
 <div id="home-ticker" class="home-ticker" hidden data-action="events-open" role="button" aria-label="Открыть хронику"></div></div>`;
 return `<div class="view dashboard-view view-enter">
 <h1 class="visually-hidden">Мой дом</h1>
 <div class="home-stage-wrap">${sceneStage(hero)}
 <div id="home-room-card" class="home-room-card" hidden></div>
 <aside class="home-rail" aria-label="Сводка дома">
 <div class="home-block home-guard" id="home-guard"></div><div class="home-block" id="home-block-digest"><button class="home-block-head" data-block-toggle="digest" aria-expanded="true" aria-label="Свернуть дайджест"><span>Дайджест</span><span class="home-block-essence" id="home-digest-essence">…</span>${I('chevron-down')}</button><div id="home-digest" hidden></div></div>
 <div class="home-block" id="home-block-energy"><button class="home-block-head" data-block-toggle="energy" aria-expanded="false" aria-label="Развернуть электроэнергию"><span>Электроэнергия</span><span class="home-block-essence" id="home-energy-essence">…</span>${I('chevron-down')}</button><div id="home-energy" hidden></div></div>
 <div id="home-alarm" hidden></div>
 <div class="home-block" id="home-block-station"><button class="home-block-head" data-block-toggle="station" aria-expanded="false" aria-label="Развернуть станцию"><span>Станция</span><span class="home-block-essence" id="home-station-essence">…</span>${I('chevron-down')}</button><div id="home-station" hidden></div></div>
 <div id="home-light-overview">${lightOverviewBadge()}</div>
 <button class="text-button rail-allrooms" data-action="allrooms">Все комнаты ${I('arrow-up-right')}</button>
 ${!state.preview&&!state.houseProfileConfirmed&&state.devices.some(d=>houseBindings[d.id]===state.bindings[d.id]?.entityId)?'<div class="profile-invite"><div><strong>Профиль ждёт проверки</strong><p>Подтверди привязки перед управлением домом.</p></div><button class="secondary" data-action="house-review">Проверить профиль</button></div>':''}
 </aside>
 <div id="home-quick" class="home-quick-rail"></div>
 </div></div>`;
}
// Мини-карточка комнаты: тап по плану показывает климат и линии света рядом со сценой.
// Волна 4: разметка miniRoomCard() перенесена в src/preact/room-widget.js (roomCardMarkup),
// roomSheet(r) — туда же (sheetMarkup); app.js монтирует виджеты и рассылает deps по roomBus.
let activeRoomCard=null,cardGuard=0,cardPaintTimer=0;
function phaseArgs(id){
 const c=commandFor(id);
 return c?{id,phase:c.phase,message:c.message,confirmedAt:c.confirmedAt}:null;
}
// Строка линии света: снимок состояния для чистой разметки виджета (toggle/phaseLine).
// bright (3.3.0): данные мини-слайдера яркости — id команды `${id}/brightness`
// (сервер маппит 1-100 → 0-255). В live яркость доступна только rgb-линиям с
// supported_color_modes, в демо — всем установленным линиям.
function brightArgs(c){
 if(c.planned)return null;
 const d=state.devices.find(d=>d.id===c.id);
 if(!d||d.status!=='installed')return null;
 if(isLive()&&d.type!=='rgb')return null;
 return {id:`${c.id}/brightness`,value:state.lightBrightness[c.id]??70};
}
function rowArgs(c){
 return {id:c.id,name:c.name,on:c.on,planned:c.planned,
 note:c.planned?c.note||'Планируется':noConnection()?'Нет связи':isLive()&&!canControl(c.id)?'Нет данных · канал не проверен или недоступен':c.note||'Отдельная линия света',
 unknown:isLive()&&!canControl(c.id),
 blocked:c.planned||!canControl(c.id)||hasPending(),
 busy:commandFor(c.id)?.phase==='pending',
 phase:phaseArgs(c.id),bright:brightArgs(c)};
}
function roomCardArgs(){
 if(!activeRoomCard||state.view!=='home')return null;
 const r=getRoom(activeRoomCard);if(!r)return null;
 return {room:{id:r.id,name:r.name,icon:r.icon},climate:compactRoomClimate(r.id),rows:channelsFor(r).map(rowArgs)};
}
// Deps щитка комнаты: шапка + controls() той же комнаты (включая RGB-блок прихожей).
function roomSheetArgs(){
 const id=$('#sheet-content').dataset.room;
 const r=id?getRoom(id):null;if(!r)return null;
 const d=state.devices.find(d=>d.id==='rgb'),powered=d?.status==='installed'&&hallPowered();
 const rgb=d?{name:d?.name||'RGB-лампа',
 note:d?.status==='planned'?'Планируется':state.demoOffline?'Нет связи · демо':powered?(state.rgbOn?'Включена · Yeelight':'Выключена · Yeelight'):'Без питания · включи свет прихожей',
 powered,
 toggle:{name:d?.name||'RGB-лампа',on:powered&&state.rgbOn,unknown:false,busy:commandFor('rgb:on')?.phase==='pending',blocked:!powered},
 brightLabel:`${state.brightness} % · ${isLive()?'Home Assistant':'подтверждено в демо'}`,
 brightness:state.brightness,
 brightBlocked:!state.rgbOn||!canControl('rgb:brightness')||hasPending(),
 swatches:[['#e6c68c','Тёплый'],['#eef1e5','Белый'],['#d1a1e8','Сиреневый'],['#9dbddb','Голубой']].map(([c,l])=>({color:c,label:l,selected:state.rgbColor===c,blocked:!state.rgbOn||!canControl('rgb:color')||hasPending()})),
 phases:{on:phaseArgs('rgb:on'),bright:phaseArgs('rgb:brightness'),color:phaseArgs('rgb:color')}}:null;
 return {room:{id:r.id,name:r.name,short:r.short,description:r.description},
 rows:r.channels.map(rowArgs),rgb,
 corridorUnbound:r.id==='corridor'&&r.channels.some(c=>!state.bindings[c.id]?.entityId),
 hallTerrace:r.id==='hall'};
}
function updateRoomCardRegion(){
 const node=$('#home-room-card');if(!node)return;
 if(!node.dataset.preact){preactRender(ph(RoomCardWidget,{}),node);node.dataset.preact='1'}
}
function paintRoomCard(){
 const node=$('#home-room-card');if(!node)return;
 // Пока команда из карточки в полёте (optimistic apply + pending), перерисовка
 // по опросу может заменить кнопку между pointerdown и click — пропускаем.
 if(activeRoomCard&&hasPending())return;
 // 3.3.0: пока тянут мини-слайдер яркости, перерисовка убила бы drag — ждём change.
 if(activeRoomCard&&document.activeElement?.matches?.('input[data-bright]'))return;
 node.hidden=!activeRoomCard;
 // Не перекрашиваем тапабельную карточку под пальцем (бывший guard updateRegion):
 // откладываем notify на 450 мс после pointerdown.
 if(Date.now()-lastPointerDown<400){clearTimeout(cardPaintTimer);cardPaintTimer=setTimeout(()=>paintRoomCard(),450);return}
 updateRoomCardRegion();
 roomBus.notify({card:roomCardArgs(),sheet:roomSheetArgs()});
}
function toggleRoomCard(id){
 activeRoomCard=activeRoomCard===id?null:id;cardGuard=Date.now();paintRoomCard();
}
// Карточка только для комнат с линиями света; пустые зоны открывают room view как раньше.
const activeCardRoom=id=>{if(id==='yard')return false;const r=getRoom(id);return Boolean(r&&channelsFor(r).length)};
function roomClimate(id){
 return state.devices.filter(d=>d.room===id&&d.status==='installed'&&['temperature','humidity'].includes(d.type))
  .map(d=>`<span class="climate-pill">${I(deviceTypes[d.type].icon)}${esc(deviceReading(d))}</span>`).join('');
}
function favoriteRooms(){
 return state.favorites.length?state.favorites.map(id=>{
  const r=getRoom(id),cs=channelsFor(r),known=!isLive()||cs.every(c=>canControl(c.id)),on=cs.filter(c=>c.on).length;
  return `<button class="favorite-room ${on&&known&&!noConnection()?'is-lit':''}" data-room="${r.id}">
  <span class="favorite-room-title">${I(r.icon)}${esc(r.short)}</span><span class="favorite-room-detail">${compactRoomClimate(id)||(!cs.length?'Без света':noConnection()?'Нет связи':!known?'<span title="Свет временно недоступен">—</span>':on?`${on} из ${cs.length} · вкл.`:'Выключено')}</span></button>`;
 }).join(''):'<button class="empty-favorites" data-action="favorites">Добавить любимые комнаты</button>';
}
function compactRoomClimate(id){
 return state.devices.filter(d=>d.room===id&&d.status==='installed'&&['temperature','humidity'].includes(d.type))
  .map(d=>({d,value:deviceReading(d)})).filter(({value})=>/\d/.test(value)&&!value.includes('устарел'))
  .map(({d,value})=>`<span class="compact-reading">${I(deviceTypes[d.type].icon)}${esc(value)}</span>`).join('');
}
function homeLightSummary(){
 const channels=rooms.flatMap(r=>r.channels.filter(c=>!c.planned));
 return homeSummary({live:isLive(),online:!noConnection(),total:channels.length,unknown:channels.filter(c=>!canControl(c.id)).length,on:countLights()});
}
// Прогноз погоды: волна 5 — блок перенесён в src/weather-sheet.js (loadForecast/forecastSheet).
// Волна 3: разметка homeStatus() перенесена в src/preact/facts-widget.js
// (factsMarkup); данные рассылаются через factsBus.notify(factsArgs()).
function lightOverview(){
 const all=rooms.flatMap(r=>channelsFor(r).map(c=>({r,c})));
 const unknown=all.filter(({c})=>noConnection()||isLive()&&!canControl(c.id));
 const on=all.filter(({c})=>!noConnection()&&(!isLive()||canControl(c.id))&&c.on);
 return {all,unknown,on};
}
function lightOverviewBadge(){
 const {all,unknown,on}=lightOverview();
 const label=noConnection()?'Свет · нет связи':`Свет · ${on.length}/${all.length}${unknown.length?' ?':''}`;
 return `<button class="light-overview-badge ${on.length?'has-light':''}" data-action="active-lights" aria-label="Где горит свет: включено ${on.length}, без данных ${unknown.length}">${esc(label)}${I('chevron-right')}</button>`;
}
function lightOverviewSheet(){
 const {all,unknown,on}=lightOverview();
 const rows=items=>items.map(({r,c})=>`<button class="light-overview-row" data-room="${r.id}"><span><strong>${esc(r.short)}</strong><small>${esc(c.name)}</small></span>${I('arrow-up-right')}</button>`).join('');
 return `<h2>Где горит свет</h2><p class="description">${isLive()?'Текущие состояния HA':'Демонстрационные состояния'} · ${unknown.length?`известно включённых: ${on.length}; без данных: ${unknown.length}`:`${on.length} из ${all.length} линий включены`}.</p>
 ${on.length?`<div class="light-overview-list">${rows(on)}</div>`:unknown.length?'<div class="inline-note">Подтверждённых включённых линий нет, но часть состояний неизвестна.</div>':'<div class="lights-all-off">'+I('circle-check')+'<strong>Все подключённые линии выключены</strong></div>'}
 ${unknown.length?`<h3 class="light-unknown-title">Без подтверждённого состояния · ${unknown.length}</h3><div class="light-overview-list">${rows(unknown)}</div>`:''}
 <button class="secondary" data-view="rooms">Открыть всё управление светом</button>`;
}
function houseAlerts(){
 return leakIssues(state.devices,{live:isLive(),online:state.liveOnline,read:observed})
  .sort((a,b)=>Number(b.alarm)-Number(a.alarm))
  .map(d=>`<button class="house-alert ${d.alarm?'is-alarm':'is-unavailable'}" data-action="leak" data-leak-id="${esc(d.id)}" ${d.alarm?'role="alert"':''}>${I(d.alarm?'triangle-alert':'wifi-off')}<span><strong>${esc(d.alarm?d.name+'!':'Нет данных · '+d.name)}</strong><small>${d.alarm?'Проверь воду и источник протечки':'Датчик недоступен или его состояние неизвестно'}</small></span>${I('chevron-right')}</button>`).join('');
}
// Волна 2: разметка digestCard() перенесена в src/preact/digest-widget.js
// (digestMarkup); данные рассылаются в refresh() через digestBus.notify(digestArgs()).
// Волна 3 «Умное поведение»: адаптивные акценты главной. Один источник аргументов
// для дайджеста — карточка в рейле и ночная сводка в hero показывают одно и то же.
function digestArgs(){
 // Волна D: брифингу нужен флаг ночи (ночью прогноз не показываем).
 const time=new Intl.DateTimeFormat('en-GB',{hour:'numeric',minute:'2-digit',hourCycle:'h23',timeZone:PANEL_TIMEZONE}).format(Date.now());
 const [h,m]=time.split(':').map(Number);
 return {mode:state.mode,liveOnline:state.liveOnline,devices:state.devices,bindings:state.bindings,entityStates:state.entityStates||{},now:Date.now(),alarmState:alarmEntity()?.state,meterKnown:meterKnownFromWidget,isNightNow:isNight(h*60+m,state.nightStart,state.nightEnd,state.nightMode),nightStart:state.nightStart,nightEnd:state.nightEnd,guardNight:state.guardNight,guardDoorMinutes:state.guardDoorMinutes};
}
const digestSummary=()=>{const items=digestItems(digestArgs());return items.length?items.slice(0,2).map(i=>i.text).join(' · '):''};
const dayPhase=hour=>hour>=6&&hour<11?'morning':hour>=11&&hour<17?'day':hour>=17&&hour<22?'evening':'night';
 // 3.4.4: дуга переехала на страницу «Погода» — здесь только приветствие/дата.
function updateHeroTime(){
 const hour=+new Intl.DateTimeFormat('en-GB',{hour:'numeric',hourCycle:'h23',timeZone:PANEL_TIMEZONE}).format(Date.now());
 const greeting=$('#hero-greeting'),dateNode=$('#hero-date');
 if(!greeting||!dateNode)return;
 const phase=dayPhase(hour);
 if(phase==='night'){
  const summary=digestSummary();
  if(summary){dateNode.hidden=true;greeting.textContent=summary;greeting.hidden=false}
  else{greeting.hidden=true;greeting.textContent='';dateNode.hidden=false}
 }else{
  dateNode.hidden=false;
  const text=phase==='morning'?'Доброе утро':phase==='evening'?'Добрый вечер':'';
  greeting.textContent=text;greeting.hidden=!text;
 }
}
// Покупки (волна 5): блок перенесён в src/shopping.js (loadShopping/shoppingMutate/paintShopping).
// Охрана (волна 5): блок перенесён в src/alarm.js (paintAlarm/alarmEntity/alarmAction).
async function sendTTS(){
 const input=$('#tts-text'),status=$('#tts-status'),button=$('[data-action="tts-send"]');
 if(!input||!status)return;
 const text=input.value.trim();status.textContent=text?'Отправляем на станцию…':'';
 if(button)button.disabled=true;
 try{const r=await api('ha/announce',{method:'POST',body:{text}});status.textContent=r.accepted?'Отправлено · подтверждение озвучивания невозможно':r.message||'Отправлено'}
 catch(error){status.textContent=error.message}
 finally{if(button)button.disabled=false}
}
function stationRoom(){return areaName(state.devices.find(d=>d.id==='station')?.room||'corridor')}
function stationSkipButtons(){
 const e=isLive()?observed('station'):null;
 return `<div class="station-skip"><button class="icon-button" data-action="station-previous" aria-label="Предыдущий трек" ${disabled(!isLive()||!stationSupports(e,'previous',true)||hasPending())}>${I('skip-back')}</button>
 <button class="icon-button" data-action="station-next" aria-label="Следующий трек" ${disabled(!isLive()||!stationSupports(e,'next',true)||hasPending())}>${I('skip-forward')}</button></div>`;
}
function sceneStage(hero=''){
 return `<section class="model-stage spatial-stage${hero?' hero-stage':''}"><canvas id="canvas" aria-label="Интерактивная объёмная модель дома"></canvas>
 <div id="model-loading" class="model-loading">${I('loader-circle')}Загружаем план дома</div>
 ${hero?hero:`<div class="model-top"><span id="model-name">${state.view==='room'?esc(getRoom(state.selected).short):'Первый этаж'}</span></div>`}
 </section>`;
}
function phaseLine(id){
 const c=commandFor(id);if(!c)return '';
 return `<div class="command-status ${c.phase}" role="status">${I(c.phase==='pending'?'loader-circle':c.phase==='success'?'circle-check':'triangle-alert')}
 <span>${esc(c.message)}${c.phase==='success'?' · '+timeOf(c.confirmedAt):''}</span>
 ${c.phase==='error'?`<button class="retry-button" data-retry="${id}">Повторить</button>`:''}</div>`;
}
function toggle(id,label,on,blocked,attrs=''){
 const unknown=isLive()&&!canControl(id);
 return `<button ${unknown?'':`role="switch" aria-checked="${on}"`} aria-label="${esc(label)}${unknown?' · нет подтверждённого состояния':''}" aria-busy="${commandFor(id)?.phase==='pending'}"
 class="toggle" ${attrs} ${disabled(blocked||!canControl(id)||hasPending())}><span class="toggle-track"></span></button>`;
}
function controls(r){
 return `${r.channels.map(c=>{
 const id=c.id;
 const note=c.planned?c.note:isLive()&&!canControl(id)?'Нет данных · канал не проверен или недоступен':noConnection()?'Нет связи':c.note||'Отдельная линия света';
const isPlanned=c.planned;
 return `<div class="control-group${isPlanned?' is-planned':''}"><div class="control-row"><div><h3>${esc(c.name)}</h3><p>${esc(note||'Планируется')}</p></div>
 ${toggle(id,c.name,c.on,c.planned,`data-device="${id}"`)}</div>${phaseLine(id)}</div>`;
 }).join('')}${state.devices.some(d=>d.id==='rgb'&&d.room===r.id)?rgbControls():''}
 ${!r.channels.length?'<p class="empty-room-note">Здесь нет линий света. Другие устройства доступны ниже.</p>':''}
 ${r.id==='corridor'&&r.channels.some(c=>!state.bindings[c.id]?.entityId)?'<button class="text-button" data-action="corridor-binding">Выбрать сущность света коридора '+I('arrow-right')+'</button>':''}
 ${r.id==='hall'?'<button class="text-button" data-room="terrace">Свет террасы · отдельная зона '+I('arrow-right')+'</button>':''}`;
}
function rgbControls(){
 const d=state.devices.find(d=>d.id==='rgb'),powered=d?.status==='installed'&&hallPowered();
 return `<div class="control-group"><div class="control-row"><div><h3>${esc(d?.name||'RGB-лампа')}</h3><p>${d?.status==='planned'?'Планируется':state.demoOffline?'Нет связи · демо':powered?(state.rgbOn?'Включена · Yeelight':'Выключена · Yeelight'):'Без питания · включи свет прихожей'}</p></div>
 ${toggle('rgb:on',d?.name||'RGB-лампа',powered&&state.rgbOn,!powered,'data-action="rgb"')}</div>${phaseLine('rgb:on')}</div>
 ${powered?`<div class="rgb-control"><label for="brightness">Яркость <span id="brightness-label">${state.brightness} % · ${isLive()?'Home Assistant':'подтверждено в демо'}</span></label>
 <input id="brightness" type="range" min="1" max="100" value="${state.brightness}" ${disabled(!state.rgbOn||!canControl('rgb:brightness')||hasPending())}/>
 ${phaseLine('rgb:brightness')}<div class="swatches">${[['#e6c68c','Тёплый'],['#eef1e5','Белый'],['#d1a1e8','Сиреневый'],['#9dbddb','Голубой']].map(([c,l])=>
 `<button style="--swatch:${c}" aria-label="${l} цвет" class="${state.rgbColor===c?'selected':''}" data-color="${c}" ${disabled(!state.rgbOn||!canControl('rgb:color')||hasPending())}></button>`).join('')}</div>${phaseLine('rgb:color')}</div>`:''}`;
}
function selectedRoom(){
 const r=getRoom(state.selected);
 return `<section class="selected-room"><div class="eyebrow">${esc(r.short)}</div><h2>Свет</h2><p class="description">${r.channels.length?'Каждая линия независима':'Устройства этой зоны'}</p>${controls(r)}</section>`;
}
function model(){
 return `<div class="view"><div class="view-title"><div><div class="eyebrow">Пространство</div><h1>План дома</h1><p>Выбери комнату на плане или в списке.</p></div>
 <button class="secondary" data-action="allrooms">Все комнаты ${I('arrow-right')}</button></div><div class="model-layout">
 ${sceneStage()}<aside class="side-stack"><div id="selected-room">${selectedRoom()}</div><button class="secondary" data-room="${state.selected}">Открыть комнату ${I('arrow-up-right')}</button><p class="model-note">Мебель и размеры показаны схематично.</p></aside></div></div>`;
}
// Сценарии на экране комнаты — только если в ней есть установленная линия света
// с подтверждённой привязкой (в live — canControl, в демо — достаточно установки).
const roomHasLight=r=>r.channels.some(c=>!c.planned&&(!isLive()||canControl(c.id)));
function roomPage(){
 const r=getRoom(state.selected),external=['attic','well','yard'].includes(r.id);
 return `<div class="view room-view"><div class="room-heading"><div><button class="room-back text-button" data-view="home">${I('house')}Мой дом ${I('chevron-right')}</button><h1>${esc(r.name)}</h1></div><div class="room-climate" id="room-climate">${roomClimate(r.id)}</div></div>
 <div class="room-layout"><div class="room-visual-column">${external?`<section class="zone-stage">${I(r.icon)}<h2>${esc(r.short)}</h2><p>Показания и доступность устройств</p><div class="room-climate">${roomClimate(r.id)}</div></section>`:sceneStage()}
 <div class="room-equipment" id="room-equipment">${roomEquipment(r)}</div></div><aside class="room-control-column">${roomHasLight(r)?`<div id="room-scenarios">${scenarioChipsRow()}</div>`:''}<div id="selected-room">${selectedRoom()}</div><details class="room-other-zones"><summary>Другие комнаты</summary>${rooms.filter(x=>x.id!==r.id&&x.id!=='yard').map(x=>`<button data-room="${x.id}">${I(x.icon)}${esc(x.short)}${I('chevron-right')}</button>`).join('')}</details></aside></div></div>`;
}
function roomEquipment(r){
 const cards=logicalSensorCards(r.id);
 return `${state.devices.some(d=>d.id==='station'&&d.room===r.id&&d.status==='installed')?station():''}
 ${cards}${state.devices.filter(d=>d.room===r.id&&['curtain','vacuum'].includes(d.type)).map(sensorCard).join('')}${r.id==='yard'?'<span id="yard-clips-slot"></span>':''}`;
}
function lights(){
 return `<div class="view"><div class="view-title"><div><div class="eyebrow">Управление</div><h1>Свет в доме</h1><p>Выбери комнату. Все линии доступны независимо.</p></div>
 <span class="demo-badge">${state.demoOffline?'Нет связи · демо':lightCountLabel()}</span></div>
 <div id="lights-scenarios" class="lights-scenarios">${scenarioChipsRow()}</div>
 <div id="lights-today"></div>
 <div class="room-list">${rooms.map(roomCard).join('')}</div><div class="wide-hint"><span>Инженерное оборудование не входит в мастер-свет.</span><button data-action="catalog">Каталог устройств ${I('arrow-right')}</button></div></div>`;
}
// 3.5.0: раздел «События» — хроника дома. Данные разом (≤200), фильтр на клиенте;
// клипы двора открываются общим щитком (data-action=yard-clip).
let eventsRows=[],eventsFilter='all',eventsBusy=false,eventsQuery='';
function eventsView(){
 return `<div class="view events-view"><div class="view-title"><div><div class="eyebrow">Хроника</div><h1>События</h1><p>Что происходило в доме: двор, двери, свет, показания.</p></div>
 <button class="icon-button" data-action="events-reload" ${disabled(eventsBusy)} aria-label="Обновить события"><i data-lucide="rotate-ccw"></i></button></div>
 <input class="events-search" data-events-search type="search" placeholder="Поиск по событиям…" value="${esc(eventsQuery)}" aria-label="Поиск по событиям"/>
 <div data-events-filters>${eventsFilterMarkup(eventsFilter,eventsRows)}</div>
 <div class="events-list" data-events-list>${eventsListMarkup(eventsRows.filter(r=>eventsFilter==='all'||r.type===eventsFilter))}</div></div>`;
}
let lightsTodayData=null;
function paintLightsToday(){
 const node=$('#lights-today');
 if(!node)return;
 node.innerHTML=lightsTodayData?lightTodayMarkup(lightsTodayData.lightDays,lightsTodayData.rooms):'';
 icons();
}
async function loadLightsToday(){
 try{
  const a=await api('analytics');
  if(state.view!=='rooms')return;
  lightsTodayData=a;paintLightsToday();
 }catch{/* агрегат не критичен */}
}
async function loadActivity(){
 try{
  const a=await api('analytics');
  if(state.view!=='statistics')return;
  const node=$('[data-activity]');
  if(node){node.innerHTML=activityMarkup(a);icons()}
 }catch{/* активность не критична */}
}
async function loadEvents(force=false){
 if(eventsBusy)return;
 eventsBusy=true;
 const list=$('[data-events-list]'),btn=$('[data-action="events-reload"]');
 if(btn)btn.disabled=true;
 if(force&&list)list.style.opacity='.5';
 try{
  const data=await api('events?limit=200');
  if(state.view!=='events')return;
  eventsRows=Array.isArray(data.events)?data.events:[];
  const node=$('[data-events-list]');
  if(node)node.innerHTML=eventsListMarkup(eventsRows.filter(r=>eventsFilter==='all'||r.type===eventsFilter));
  const filters=$('[data-events-filters]');
  if(filters)filters.innerHTML=eventsFilterMarkup(eventsFilter,eventsRows);
  icons();
 }catch(error){
  if(state.view==='events'&&list)list.innerHTML=`<p class="description">События сейчас не получить: ${esc(error.message)}</p>`;
 }finally{
  eventsBusy=false;
  if(btn)btn.disabled=false;
  const list2=$('[data-events-list]');if(list2)list2.style.opacity='';
 }
}
// 3.5.1: раздел «Двор» — камера, детектор, лента клипов и уличный климат в одном месте.
let yardDetector=null,yardEvents=[],yardToday=0;
function yardView(){
 const camera=state.devices.find(d=>d.type==='camera'&&d.room==='yard'&&d.status==='installed');
 const motion=state.devices.find(d=>d.id==='terrace-motion'&&d.status==='installed');
 const outdoor=state.devices.filter(d=>['terrace','yard','well','attic'].includes(d.room)
  &&['temperature','humidity'].includes(d.type)&&d.status==='installed');
 const det=yardDetector;
 const detText=!isLive()?'Демо · события не пишутся':det===null?'Статус запрашивается…':det&&det.enabled===false?'Выключено · резерв по кадрам'
  :det&&det.cameras?.length?det.cameras.map(c=>`${c.name}: ${c.alive?'активна':'недоступна'}`).join(' · ')
  :det&&det.configured?'События активны':'Не настроен';
 return `<div class="view yard-view"><div class="view-title"><div><div class="eyebrow">Улица</div><h1>Двор</h1><p>Камера, движение и погода за окном.</p></div>
 <button class="icon-button" data-action="events-open" aria-label="События двора"><i data-lucide="history"></i></button></div>
 <section class="yard-live-card">${camera
  ?`<button type="button" class="yard-live" data-camera="${esc(camera.id)}">${I('video')}<div><h2>Прямой эфир</h2><p>${esc(camera.name)} · нажми, чтобы открыть</p></div>${I('chevron-right')}</button>`
  :`<div class="yard-live is-empty">${I('camera')}<div><h2>Камера не привязана</h2><p>Добавь камеру двора в каталоге и привяжи сущность camera.*</p></div></div>`}</section>
 <div class="yard-columns">
  <section class="yard-status-card"><div class="status-line"><span>${I('scan-eye')}Детектор движения</span><strong>${esc(detText)}</strong></div>
  ${motion?`<button class="status-line motion-detail" data-action="motion" data-motion-id="${esc(motion.id)}"><span>${I('trees')}Движение у террасы</span><strong>${esc(deviceReading(motion))}</strong></button>`:''}
  ${outdoor.map(d=>`<div class="status-line"><span>${I(deviceTypes[d.type].icon)}${esc(areaName(d.room))} · ${deviceTypes[d.type].label}</span><strong>${esc(deviceReading(d))}</strong></div>`).join('')}
  </section>
  <section class="yard-clips-card"><h2>События камеры</h2>${isLive()?'<span id="yard-clips-slot"></span>':'<p class="description">В деморежиме лента недоступна.</p>'}</section>
 </div>
 <section class="yard-events-card"><h2>Последние события двора</h2><div data-yard-events>${yardEvents.length?eventsListMarkup(yardEvents):'<p class="description">Пока тихо — движения не было.</p>'}</div>
 <button class="secondary" data-action="events-open">${I('history')}Вся хроника дома</button></section></div>`;
}
async function loadYardView(){
 updateYardClipsRegion();
 try{
  const [det,ev]=await Promise.all([api('yard-onvif').catch(()=>null),api('events?type=yard&limit=50').catch(()=>null)]);
  if(state.view!=='yard')return;
  yardDetector=det;
  const all=ev&&Array.isArray(ev.events)?ev.events:[];
  const dayStart=new Date();dayStart.setHours(0,0,0,0);
  yardToday=all.filter(e=>e.at>=dayStart.getTime()).length;
  yardEvents=all.slice(0,6);
 }catch{if(state.view==='yard')yardDetector=null}
 if(state.view!=='yard')return;
 // перерисовываем карточку статуса с живым ответом детектора
 const card=$('.yard-status-card');
 if(card){
  const det=yardDetector;
  const detText=!isLive()?'Демо · события не пишутся':det===null?'Статус запрашивается…':det&&det.enabled===false?'Выключено · резерв по кадрам'
   :det&&det.cameras?.length?det.cameras.map(c=>`${c.name}: ${c.alive?'активна':'недоступна'}`).join(' · ')
   :det&&det.configured?'События активны':'Не настроен';
  const motion=state.devices.find(d=>d.id==='terrace-motion'&&d.status==='installed');
  const outdoor=state.devices.filter(d=>['terrace','yard','well','attic'].includes(d.room)&&['temperature','humidity'].includes(d.type)&&d.status==='installed');
  card.innerHTML=`<div class="status-line"><span>${I('scan-eye')}Детектор движения</span><strong>${esc(detText)}${yardToday?` · за сегодня ${yardToday}`:''}</strong></div>`
   +(motion?`<button class="status-line motion-detail" data-action="motion" data-motion-id="${esc(motion.id)}"><span>${I('trees')}Движение у террасы</span><strong>${esc(deviceReading(motion))}</strong></button>`:'')
   +outdoor.map(d=>`<div class="status-line"><span>${I(deviceTypes[d.type].icon)}${esc(areaName(d.room))} · ${deviceTypes[d.type].label}</span><strong>${esc(deviceReading(d))}</strong></div>`).join('');
 }
 const evNode=$('[data-yard-events]');
 if(evNode){evNode.innerHTML=yardEvents.length?eventsListMarkup(yardEvents):'<p class="description">Пока тихо — движения не было.</p>';icons()}
}
// 3.4.5: страница «Погода». Чистая разметка — src/weather-page.js; здесь только
// сборка аргументов, кеш прогноза (fetchForecast, 10 мин), «Обновлено HH:MM»
// (время последнего успешного fetch) и живое обновление арки.
let weatherForecast=[],weatherFetchedAt=0;
function weatherPage(){
 trackSunrise();
 const args=weatherViewArgs(state.entityStates,weatherForecast);
 return `<div class="view weather-view"><div class="view-title"><div><div class="eyebrow">Среда</div><h1>Погода</h1><p>Сейчас, световой день и прогноз.</p></div></div>
 <section class="weather-now-card">${weatherNowMarkup(args)}</section>
 <section class="weather-arc-card"><div id="weather-arc">${args?.sun?weatherArcMarkup(args.sun):''}</div></section>
 <section class="weather-moon-card"><h2>Луна</h2>${weatherMoonMarkup(Date.now())}</section>
 <section class="weather-forecast-card"><h2>Прогноз на дни</h2><div id="weather-daily">${args?weatherDailyMarkup(args.daily):'<p class="description forecast-error">Прогноз недоступен</p>'}</div></section>
 ${args?.hourly?.length?`<section class="weather-forecast-card"><h2>По часам</h2>${weatherHourlyMarkup(args.hourly)}</section>`:''}
 <p class="weather-updated" id="weather-updated">${weatherFetchedAt?`Обновлено ${timeOf(weatherFetchedAt)}`:''}</p>
 </div>`;
}
function paintWeatherArc(){
 const node=$('#weather-arc');if(!node)return;
 const args=weatherViewArgs(state.entityStates,weatherForecast);
 const markup=args?.sun?weatherArcMarkup(args.sun):node.innerHTML;
 if(markup&&node.dataset.rendered!==markup){node.innerHTML=markup;node.dataset.rendered=markup;icons()}
}
async function loadWeatherForecast(){
 const e=weatherEntityOf(state.entityStates||{});if(!e)return;
 const forecast=await fetchForecast(e.entity_id)||[];
 if(state.view!=='weather'||!forecast.length)return;
 weatherForecast=forecast;
 weatherFetchedAt=Date.now();
 const args=weatherViewArgs(state.entityStates,weatherForecast);
 if(!args)return;
 updateRegion('#weather-daily',weatherDailyMarkup(args.daily));
 updateRegion('#weather-updated',`Обновлено ${timeOf(weatherFetchedAt)}`);
 icons();
 const tape=document.querySelector('.weather-view .weather-hourly-tape');
 if(!tape&&args.hourly?.length){
  const last=$('.weather-view')?.lastElementChild;
  last?.insertAdjacentHTML('afterend',`<section class="weather-forecast-card"><h2>По часам</h2>${weatherHourlyMarkup(args.hourly)}</section>`);icons();
 }
}
function watch(){
 const terraceDoor=state.devices.find(d=>d.id==='terrace-door'&&d.status==='installed');
 const leaks=state.devices.filter(d=>d.type==='leak'&&d.status==='installed');
 // 3.5.2: уличные датчики — отдельной секцией; «Двор» — компактный чип в шапке.
 const OUTSIDE=['terrace','yard','well','attic'];
 return `<div class="view watch-view"><div class="view-title"><div><div class="eyebrow">Наблюдение</div><h1>Датчики и климат</h1><p>Всё, что сообщает твой дом.</p></div>
 <button type="button" class="watch-yard-chip" data-action="yard-open" aria-label="Открыть раздел Двор">${I('video')}Двор ${I('chevron-right')}</button></div>
 <div class="watch-grid"><section class="overview-status">
 <div class="status-line"><span>${I('door-closed')}Входная дверь</span><strong>${binaryLabel('door','Открыта','Закрыта')}</strong></div>
 ${terraceDoor?`<div class="status-line"><span>${I('door-open')}Дверь на террасу</span><strong>${binaryLabel('terrace-door','Открыта','Закрыта')}</strong></div>`:''}
 ${leaks.map(d=>`<div class="status-line"><span>${I('droplets')}${esc(d.name)}</span><strong>${binaryLabel(d.id,'Тревога','Сухо')}</strong></div>`).join('')}
 ${state.devices.some(d=>d.id==='smoke'&&d.status==='installed')?`<div class="status-line"><span>${I('radio')}Дым</span><strong>${binaryLabel('smoke','Тревога','Нет тревоги')}</strong></div>`:''}
 <button type="button" class="status-line watch-yard-row" data-action="yard-open"><span>${I('video')}Двор: камера и клипы</span><strong>Раздел ${I('chevron-right')}</strong></button>
 </section>
 <aside class="side-stack">${climate()}</aside></div>${deviceHealth()}
 <section class="sensor-catalog"><div class="section-heading"><div><h2>Датчики дома</h2><p>Логические устройства: показания и батарейка вместе</p></div></div><div class="module-grid">${logicalSensorCards({exclude:OUTSIDE})||'<p>Датчики пока не добавлены.</p>'}</div></section>
 <section class="sensor-catalog"><div class="section-heading"><div><h2>Вне дома</h2><p>Терраса, двор, скважина и чердак</p></div></div><div class="module-grid">${logicalSensorCards({only:OUTSIDE})||'<p>Уличных датчиков пока нет.</p>'}</div></section></div>`;
}
function logicalSensorCards(opts={}){
 const roomId=typeof opts==='string'?opts:opts.room;
 const only=Array.isArray(opts.only)?opts.only:null,exclude=Array.isArray(opts.exclude)?opts.exclude:null;
 const byId=new Map(state.devices.map(d=>[d.id,d]));
 return buildDeviceModel(preferences(),state.entityStates,isLive()&&state.liveOnline)
  .map(g=>({...g,components:g.components.filter(c=>sensorTypes.includes(c.type)&&c.installed&&(!roomId||c.room===roomId))}))
  .filter(g=>g.components.some(c=>c.type!=='battery'))
  .filter(g=>(!only||only.includes(g.room))&&(!exclude||!exclude.includes(g.room)))
  .map(g=>`<article class="module-card sensor-card"><div class="title-line"><span>${esc(areaName(g.room))}</span>${I(g.icon)}</div><h3>${esc(g.name)}</h3>
   ${g.components.map(c=>{const text=deviceReading(byId.get(c.id));return `<div class="status-line"><span>${esc(deviceTypes[c.type].label)}</span><strong${text==='Нет данных'?' class="is-unavailable"':''}>${esc(text)}</strong></div>`}).join('')}
   <p>${isLive()?'Только проверенные данные HA':'Демонстрационный режим'}</p></article>`).join('');
}
function deviceHealth(){
 const batteries=state.devices.filter(d=>d.type==='battery'&&d.status==='installed');
 if(!batteries.length)return '';
 const rows=batteries.map(d=>{
  const e=isLive()?observed(d.id):null,n=e&&!['unknown','unavailable',''].includes(e.state)?Number(e.state):NaN;
  const valid=Number.isFinite(n)&&n>=0&&n<=100&&e?.attributes.unit_of_measurement==='%';
  return {d,e,n,valid,low:valid&&n<=20};
 }).sort((a,b)=>Number(b.low)-Number(a.low)||(a.valid?a.n:101)-(b.valid?b.n:101));
 return `<section class="sensor-catalog"><div class="section-heading"><div><h2>Батарейки и связь</h2><p>${isLive()?'Заряд до 20% выделен. Нет данных не означает разряженную батарейку.':'Реальные батарейки появятся после подключения HA.'}</p></div><button class="text-button" data-action="house-review">Привязки ${I('arrow-right')}</button></div><div class="module-grid">${rows.map(({d,e,n,valid,low})=>`<article class="module-card battery-card ${low?'battery-low':''}"><div class="title-line"><span>${esc(areaName(d.room))}</span>${I(low?'triangle-alert':'radio')}</div><h3>${esc(d.name)}</h3><strong class="module-reading">${valid?n+' %':isLive()&&!state.liveOnline?'Нет связи':'Нет данных'}</strong><p>${valid?(low?'Пора заменить · ':'Последний отчёт · ')+timeOf(Date.parse(e.last_reported||e.last_updated)||0):state.bindings[d.id]?.verified?'Сущность недоступна':'Привязка не подтверждена'}</p></article>`).join('')}</div></section>`;
}
function deviceReading(d){
 if(d.status==='planned')return 'Планируется';
 const e=isLive()?observed(d.id):null,type=deviceTypes[d.type];
 if(noConnection())return 'Нет связи';
 const value=isLive()?e?.state:d.demoStale?undefined:d.demoValue;
 if(value===undefined||value===null||['unknown','unavailable',''].includes(value))return 'Нет данных';
 if(isLive()&&['temperature','humidity','illuminance'].includes(d.type)&&!numericReading(e,{unit:type.unit}).available)return 'Нет данных';
 if(type.unit)return Number.isFinite(Number(value))?`${reading(Number(value))} ${type.unit}`:'Нет данных';
 if(d.type==='button_event'){
  const label=({single:'Нажатие',double:'Двойное нажатие',triple:'Тройное нажатие',hold:'Удержание',long:'Удержание',long_press:'Удержание',release:'Отпускание'})[String(value).toLowerCase()]||String(value);
  const at=Date.parse(e?.last_changed||'')||NaN;
  return Number.isFinite(at)?`${label} · ${timeOf(at)}`:label;
 }
 if(d.type==='motion'&&isLive())return motionObservation(e).text;
 const labels={door:['Открыта','Закрыта'],smoke:['Тревога','Нет тревоги'],motion:['Есть движение','Нет движения'],leak:['Протечка','Сухо'],pump:['Питание включено','Питание выключено']};
 if(labels[d.type]){const v=binaryValue(d.type,value);return v===true?labels[d.type][0]:v===false?labels[d.type][1]:'Нет данных'}
 if(d.type==='gate')return ({open:'Открыты',closed:'Закрыты',opening:'Открываются',closing:'Закрываются'})[value]||'Положение неизвестно';
 if(d.type==='curtain')return (({open:'Открыты',closed:'Закрыты',opening:'Открываются',closing:'Закрываются',stopped:'Остановлены'})[value]||String(value))+(Number.isFinite(e?.attributes.current_position)?` · ${e.attributes.current_position} %`:'');
 if(d.type==='vacuum')return (({cleaning:'Убирает',docked:'На базе',returning:'Возвращается',idle:'Ожидание',paused:'Пауза',error:'Ошибка'})[value]||String(value))+(Number.isFinite(e?.attributes.battery_level)?` · заряд ${e.attributes.battery_level} %`:'');
 if(d.type==='heating')return e?.attributes.current_temperature!==undefined?`${e.attributes.current_temperature} ${e.attributes.temperature_unit||e.attributes.unit_of_measurement||'(единицы HA)'} · ${value}`:String(value);
 return 'Нет данных';
}
function sensorCard(d){
 const reading=deviceReading(d);
 return `<article class="module-card sensor-card"><div class="title-line"><span>${esc(areaName(d.room))}</span>${I(deviceTypes[d.type].icon)}</div><h3>${esc(d.name)}</h3><strong class="module-reading${reading==='Нет данных'?' is-unavailable':''}">${esc(reading)}</strong><p>${d.status==='planned'?'Будущее устройство':isLive()?'Только проверенные данные HA':'Демонстрационный режим'}${d.demoStale&&!isLive()?' · пример устарел':''}</p></article>`;
}
function engineering(){
 const order={pump:0,heating:1,gate:2,filter:3};
 return `<div class="view"><div class="view-title"><div><h1>Инженерия дома</h1><p>Отдельно от света. Пока только наблюдение, без команд оборудованию.</p></div></div><div class="module-grid">${state.devices.filter(d=>deviceTypes[d.type].module==='engineering').sort((a,b)=>(order[a.type]??9)-(order[b.type]??9)).map(d=>{
  const reading=deviceReading(d),unavailable=reading==='Нет данных'||reading==='Нет связи';
  return `<article class="module-card engineering-card"><div class="title-line"><span>${esc(areaName(d.room))}</span><span class="sys-badge${unavailable?' is-muted':''}" role="img" aria-label="${unavailable?'Нет данных':'В системе'}"></span>${I(deviceTypes[d.type].icon)}</div><h2>${esc(d.name)}</h2><strong class="module-reading${unavailable?' is-unavailable':''}">${esc(reading)}</strong><p>${esc(d.note)}</p><div class="inline-note">${d.type==='gate'?'Управление воротами заблокировано. Нужны проверка привода, положения и защиты от препятствий.':d.type==='heating'?'Управление котлом заблокировано. Внешний интерфейс допускается только после проверки документации и специалистом.':'Управление питанием заблокировано. Подача питания не доказывает циркуляцию воды.'}</div></article>`}).join('')||'<p>Оборудование добавляется через каталог.</p>'}</div><div class="wide-hint"><span>ESP32 и другие будущие модули подключаются через проверенные сущности Home Assistant.</span><button data-action="catalog">Каталог устройств ${I('arrow-right')}</button></div></div>`;
}
function clearCamera(){
 cameraRevision++;if(cameraPlayer)cameraPlayer.stop();cameraPlayer=null;cameraDevice=null;
 if(cameraURL)URL.revokeObjectURL(cameraURL);cameraURL=null;
}
function openYardCamera(){
 const d=state.devices.find(d=>d.type==='camera'&&d.room==='yard'&&d.status==='installed');
 if(d)return cameraSheet(d.id);
 simpleSheet('<h2>Камера двора</h2><p class="description">Добавь установленную камеру в зону «Двор» и привяжи её к проверенной сущности camera.* в настройках панели.</p>');
}
// Щиток клипа двора: все кадры события крупнее + дата/время. Кадры грузятся
// через yard-clip/<id>/<idx>, объектные URL живут до следующего открытия.
let yardClipUrls=[];
async function openYardClipSheet(b){
 const id=Number(b.dataset.clipId),at=Number(b.dataset.clipAt),count=Math.min(4,Number(b.dataset.clipCount)||1),source=b.dataset.clipSource||'';
 if(!Number.isFinite(id)||!Number.isFinite(at))return;
 for(const u of yardClipUrls)URL.revokeObjectURL(u);yardClipUrls=[];
 const frames=Array.from({length:count},(_,i)=>`<div class="yard-clip-frame" data-clip-idx="${i}"><span>Загрузка…</span></div>`).join('');
 simpleSheet(`<div class="yard-clip-sheet"><div class="eyebrow">Двор</div><h2>Событие · ${esc(timeOf(at))}</h2><p class="description">${esc(source==='frames'?'Движение по кадрам камеры':'Датчик камеры · ONVIF')} · ${esc(new Date(at).toLocaleString())}</p><div class="yard-clip-frames">${frames}</div></div>`);
 for(let i=0;i<count;i++){
  try{
   const blob=await api(`yard-clip/${id}/${i}`,{image:true});
   const url=URL.createObjectURL(blob);yardClipUrls.push(url);
   const slot=$(`.yard-clip-frames [data-clip-idx="${i}"]`);if(slot)slot.innerHTML=`<img src="${url}" alt="Кадр ${i+1}"/>`;
  }catch{const slot=$(`.yard-clip-frames [data-clip-idx="${i}"]`);if(slot)slot.innerHTML='<span>Кадр недоступен</span>'}
 }
}
function cameraSheet(id){
 const d=state.devices.find(d=>d.id===id);if(!d)return;
 const e=observed(id),enabled=isLive()&&!state.preview&&d.status==='installed'&&e&&!['unknown','unavailable'].includes(e.state);
 modal(`<div class="eyebrow">${esc(areaName(d.room))}</div><h2>${esc(d.name)}</h2><p class="description">${d.status==='planned'?'Камера ещё не установлена.':'Прямой эфир по запросу. Закрой окно, чтобы остановить просмотр.'}</p><div id="camera-frame" class="camera-frame"><span>${enabled?'Подключаем видео…':'Сначала привяжи и проверь сущность камеры в настройках'}</span></div><p id="camera-status" role="status">${enabled?'Подключаем прямой эфир…':'Подключение камеры ещё не проверено'}</p><div class="camera-actions"><button class="primary" data-camera-start="${id}" ${disabled(!enabled)}>${I('play')}Прямой эфир</button><button class="secondary" data-action="camera-stop" ${disabled(!enabled)}>${I('pause')}Стоп</button><button class="secondary" data-action="camera-fullscreen" ${disabled(!enabled)}>${I('maximize')}На весь экран</button><button class="text-button" data-camera-hls="${id}" ${disabled(!enabled)}>HLS · резерв</button><button class="text-button" data-camera-frame="${id}" ${disabled(!enabled)}>${I('camera')}Снимок</button></div>${d.room==='yard'?'<span id="yard-clips-slot"></span>':''}`);
 $('.sheet').classList.add('camera-sheet');$('#overlay').classList.add('camera-overlay');cameraDevice=id;
 updateYardClipsRegion();
 if(enabled)cameraStart(id);
}
function cameraStart(id,transport='auto'){
 clearCamera();cameraDevice=id;
 $('#camera-frame').innerHTML='<video id="camera-video" controls autoplay muted playsinline webkit-playsinline aria-label="Прямой эфир камеры двора"></video>';
 const video=$('#camera-video');video.muted=true;
 cameraPlayer=startCameraPlayer(id,video,$('#camera-status'),{transport});
 clearTimeout(idleTimer);
}
function cameraStop(){
 const id=cameraDevice;clearCamera();cameraDevice=id;
 if($('#camera-frame'))$('#camera-frame').innerHTML='<span>Просмотр остановлен</span>';
 if($('#camera-status'))$('#camera-status').textContent='Нажми «Прямой эфир», чтобы продолжить';armIdle();
}
function cameraFullscreen(){
 const video=$('#camera-video');if(!video){toast('Сначала запусти прямой эфир.');return}
 try{
  const request=video.requestFullscreen||video.webkitRequestFullscreen||video.webkitEnterFullscreen;
  if(!request){toast('Полный экран недоступен в этом браузере.');return}
  const result=request.call(video);if(result&&result.catch)result.catch(()=>toast('Браузер не разрешил полный экран.'));
 }catch{toast('Браузер не разрешил полный экран.')}
}
async function cameraFrame(id,button){
 clearCamera();cameraDevice=id;armIdle();
 const rev=++cameraRevision;button.disabled=true;$('#camera-status').textContent='Получаем кадр…';
 try{
  const blob=await api('ha/camera',{method:'POST',body:{id},image:true});
  if(rev!==cameraRevision||$('#overlay').hidden)return;
  const nextURL=URL.createObjectURL(blob),image=new Image();
  try{
   await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=reject;image.src=nextURL});
  }catch{URL.revokeObjectURL(nextURL);throw new Error('Кадр не удалось прочитать. Попробуй запросить новый.')}
  if(rev!==cameraRevision||$('#overlay').hidden){URL.revokeObjectURL(nextURL);return}
  if(cameraURL)URL.revokeObjectURL(cameraURL);cameraURL=nextURL;
  $('#camera-frame').innerHTML=`<img src="${cameraURL}" alt="Кадр камеры, полученный по запросу"/>`;
  $('#camera-status').textContent='Кадр получен в '+clock()+' · не прямой эфир';
 }catch(error){if(rev===cameraRevision&&$('#camera-status'))$('#camera-status').textContent=error.message}
 finally{if(rev===cameraRevision)button.disabled=false}
}
function render(animate=true){
 const revision=++viewRevision;modelAPI?.disposeModel();if(state.view!=='home')activeRoomCard=null;
 $('#main').innerHTML=state.view==='home'?home():state.view==='room'?roomPage():state.view==='model'?model():state.view==='rooms'?lights():state.view==='yard'?yardView():state.view==='engineering'?engineering():state.view==='statistics'?statisticsView():state.view==='weather'?weatherPage():state.view==='events'?eventsView():watch();
 document.documentElement.dataset.view=state.view;
 if(!animate&&$('#main .view'))$('#main .view').style.animation='none';
 paintHeaderLeft();
 if(state.view==='home')applyBlocks();
 if(state.view==='home')loadHomeTicker();
 if(state.view==='home')loadGuardChip();
 if(state.view==='weather')loadWeatherForecast();
 document.querySelectorAll('nav button').forEach(b=>{
  const active=b.dataset.view===state.view||(['room','model'].includes(state.view)&&b.dataset.view==='home');
  b.classList.toggle('active',active);if(active)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');
 });
 $('#master').disabled=masterBlocked();updateHeader();storageStatus();icons();
 if($('#sheet-content').dataset.station==='hub'&&!shoppingState.loaded&&!shoppingState.busy)loadShopping();
 if(state.view==='statistics')loadStatistics();
 if(state.view==='events')loadEvents();
 if(state.view==='statistics')loadActivity();
 if(state.view==='yard')loadYardView();
 if(state.view==='rooms')loadLightsToday();
 if($('#canvas')){
  modelPromise ||= import('./model.js');
  modelPromise.then(api=>{
   if(revision!==viewRevision||!$('#canvas'))return;
   modelAPI=api;$('#model-loading').hidden=true;
   api.mountModel($('#canvas'),rooms,state,id=>{
    if(state.view==='model'){state.selected=id;updateDetail();api.updateModel(rooms,state)}
     else if(state.view==='home'&&activeCardRoom(id))toggleRoomCard(id);
     else openRoom(id);
   });
  }).catch(error=>{
   if(revision!==viewRevision||!$('#model-loading'))return;
   // Retryable failure: dynamic import or WebGL mount can fail on stale caches
   // or old GPU drivers; keep the reason visible instead of an endless loader.
   modelPromise=null;modelAPI=null;state.modelError=String(error?.message||error);
   $('#model-loading').innerHTML=`<strong>План дома не загрузился</strong><span class="model-error-detail">${esc(state.modelError)}</span><button class="text-button" data-action="model-retry">Повторить попытку</button>`;
   console.error('Home Panel: model mount failed',error);
  });
 }
}
document.addEventListener('input',e=>{
 const t=e.target;
 if(!t||!t.matches?.('[data-events-search]'))return;
 eventsQuery=t.value||'';
 const node=$('[data-events-list]');
 if(node)node.innerHTML=eventsListMarkup(eventsRows.filter(r=>(eventsFilter==='all'||r.type===eventsFilter)
  &&(!eventsQuery||String(r.text||'').toLowerCase().includes(eventsQuery.toLowerCase()))));
});
function updateRegion(selector,markup){
 if(selector==='#home-energy')return; // энергокарточка на Preact — содержимым управляет виджет
 if(selector==='#home-quick'||selector==='#home-status')return; // рельса и факты на Preact — app.js монтирует узлы и шлёт deps по шинам
 const node=$(selector);if(!node||node.dataset.rendered===markup)return;
 // Не перекрашиваем тапабельные рельсы под пальцем: кнопка может «уехать» между pointerdown и click.
 if(Date.now()-lastPointerDown<400&&(selector==='#home-quick'||selector==='#home-status'||selector==='#home-room-card')){setTimeout(()=>{if($(selector)&&$(selector).dataset.rendered!==markup)updateRegion(selector,markup)},450);return}
 node.innerHTML=markup;node.dataset.rendered=markup;
}
function updateDetail(){
 const editingRange=document.activeElement?.matches('input[type="range"]');
 if($('#selected-room')&&!editingRange)updateRegion('#selected-room',selectedRoom());
 if($('#model-name'))$('#model-name').textContent=state.view==='room'?getRoom(state.selected).short:'Первый этаж';
 if($('#room-climate'))$('#room-climate').innerHTML=roomClimate(state.selected);
 updateRegion('.zone-stage .room-climate',roomClimate(state.selected));
 if($('#room-equipment')&&!editingRange)updateRegion('#room-equipment',roomEquipment(getRoom(state.selected)));
 updateYardClipsRegion();
 if(!$('#overlay').hidden&&$('#sheet-content').dataset.room)updateRoomSheet();
 icons();
}
function refresh(){
 const focus=document.activeElement?.getAttribute('aria-label');
  applyAutoTheme();
  trackSunrise();
 if(['home','model','room'].includes(state.view)){
  updateDetail();modelAPI?.updateModel(rooms,state);
  const weatherEntity=Object.values(state.entityStates||{}).find(e=>e.entity_id?.startsWith('weather.')),weatherTemp=weatherEntity?.attributes?.temperature;
  modelAPI?.setModelWeather(weatherTemp<0&&weatherEntity?.state==='snowy'?'snow':weatherTemp<0&&weatherEntity?.state==='rainy'?'rain':null);
  if(state.view==='home'){
   updateFactsRegion();factsNotify();pollYardMotion();updateQuickRegion();quickBus.notify(quickArgs());updateStationRegion();stationBus.notify(stationArgs());updateRegion('#home-light-overview',lightOverviewBadge());updateRegion('#hero-status',heroStatusChip());paintRoomCard();
    updateWeatherRegion();
    // Погодный чип на Preact: notify только в live-режиме (в демо чипа нет — deps null).
    if(isLive())weatherBus.notify({entityStates:state.entityStates||{},now:Date.now()});
    updateDigestRegion();
    // Пустой liveOnline (демопревью без HA или обрыв связи) → notify не шлём:
    // hero-статус уже сообщает о потере связи, дайджест остаётся пустым.
    if(state.liveOnline)digestBus.notify(digestArgs()); // пустые items → узел пуст → CSS #home-digest:empty прячет.
    paintAlarm(); // #home-alarm скрыт (3.3.6); alarmMarkup не рендерим в обход.
    const energy=$('#home-energy');if(energy)updateEnergyRegion();
    updateHeroTime();
    updateBlockEssences();
  }else if(state.view==='room'&&$('#room-scenarios'))updateRegion('#room-scenarios',scenarioChipsRow());
 }else if(state.view==='weather'){paintWeatherArc();loadWeatherForecast()}
 else if(state.view!=='statistics')render(false);
 if(!$('#overlay').hidden){
  if(state.techOpen&&techTab==='diagnostics')$('#sheet-content').innerHTML=technical();
  else if(settingsOpen){/* HA polling must not replace an open form or its focus. */}
  else if($('#sheet-content').dataset.station==='true'&&!stationAdjusting&&!document.activeElement?.matches('#shopping-input'))$('#sheet-content').innerHTML=stationSheet();
  else if(duoOpen()&&duoUI.tab==='music'&&!stationAdjusting&&!duoUI.busy)updateRegion('#assistant-music',stationSheet());
  const sheetShop=$('#sheet-shopping');
  if(sheetShop&&!document.activeElement?.matches('#shopping-input'))paintShopping();
  else updateDetail();
 }
 $('#master').disabled=masterBlocked();updateHeader();
 updateRegion('#house-alerts',houseAlerts());$('#house-alerts').hidden=!$('#house-alerts').innerHTML;
 document.documentElement.dataset.leakAlert=String(!$('#house-alerts').hidden);
 const lightsSheet=$('[data-lights-overview]');
 if(lightsSheet&&!$('#overlay').hidden)updateRegion('[data-lights-overview]',lightOverviewSheet());
 const climateSheet=$('[data-climate-sheet]');
 if(climateSheet&&!$('#overlay').hidden){
  const content=document.createElement('div');content.innerHTML=sensorSheet(climateSheet.dataset.climateSheet);
  for(const part of ['.description','.sensor-detail','.sensor-provenance','.inline-note']){
   const next=content.querySelector(part);
   if(next)updateRegion(`[data-climate-sheet] ${part}`,next.innerHTML);
  }
 }
 icons();
 const motionSheet=$('[data-motion-sheet]');
 if(motionSheet)motionSheet.innerHTML=motionSheetMarkup(motionSheet.dataset.motionSheet);
 if(focus){const target=[...document.querySelectorAll('button')].find(b=>b.getAttribute('aria-label')===focus&&!b.disabled);target?.focus({preventScroll:true})}
}
// 3.2.8: ленивая загрузка данных для графика расхода по месяцам (кеш 10 минут).
// Демо-режим молча пропускается — блок «Электроэнергия · месяцы» просто скрыт.
async function loadEnergyStatistics(){
 if(!isLive()||state.view!=='statistics')return;
 if(energyChartState.data&&Date.now()-energyChartState.at<10*60*1000)return;
 const request=++energyChartState.request;
 try{
  const data=await api('ha/energy');
  if(request!==energyChartState.request||state.view!=='statistics')return;
  energyChartState.data=data;energyChartState.at=Date.now();
 }catch(error){return}
 paintStatistics();
}
function paintStatistics(){
 if(state.view!=='statistics')return;
 $('#main').innerHTML=statisticsView();icons();
 loadEnergyStatistics();
}
async function loadStatistics(force=false){
 if(historyState.loading)return;
 if(!isLive()){
  historyState.data=null;historyState.error='История доступна после подключения Home Assistant. В демопревью графики не подделываем.';paintStatistics();return;
 }
 if(historyState.data&&!force)return;
 const request=++historyState.request,hours=historyState.hours;
 historyState.loading=true;historyState.error='';paintStatistics();
 try{
  const data=await api('ha/history?hours='+hours);
  if(request!==historyState.request||!isLive())return;
  historyState.data=data;
 }catch(error){if(request===historyState.request)historyState.error=error.message}
 finally{if(request===historyState.request){historyState.loading=false;paintStatistics()}}
}
function motionSheetMarkup(id){
 const d=state.devices.find(d=>d.id===id),e=isLive()?observed(id):null,m=motionObservation(e);
 return `<h2>${esc(d?.name||'Движение')}</h2><p class="description">${isLive()?esc(m.text):'Демонстрационный режим'}</p>
 <div class="inline-note">Для датчика террасы активное окно — 5 минут. «Нет новых движений» означает истечение этого окна, а не новое показание датчика.</div>
 <div class="motion-timestamp"><span>Последнее обновление события</span><strong>${m.at?new Date(m.at).toLocaleString('ru-RU',{timeZone:PANEL_TIMEZONE}):'Неизвестно'}</strong><small>${m.at?esc(elapsedLabel(m.at)):''}</small></div>
 <p class="description">${m.kind==='unknown'?'Без достоверного состояния или времени не считаем, что движения нет.':'Сущность HA не изменяется. Расчётный статус применяется только в панели.'}</p>`;
}
// Волна 4: содержимое щитка на Preact — roomSheet() отдаёт только слот-корень,
// разметка и repaint живут в room-widget.js (sheetMarkup) по roomBus.
function roomSheet(r){
 return `<div id="room-sheet-root"></div>`;
}
function updateRoomSheet(){
 const root=$('#room-sheet-root');
 if(!root)return;
 if(!root.dataset.preact){preactRender(ph(RoomSheetWidget,{}),root);root.dataset.preact='1'}
 roomBus.notify({card:null,sheet:roomSheetArgs()});
}
function openRoom(id){
 if(id==='yard')return openYardCamera();
 if(!getRoom(id))return;
 state.selected=id;settingsOpen=false;$('#sheet-content').dataset.station='';
 navigate('room');
}
function navigate(v){
 closeModal();$('#sheet-content').dataset.room='';$('#sheet-content').dataset.station='';
 state.view=v;render();window.scrollTo({top:0,left:0,behavior:'instant'});
}
function command(id,value){
 let apply;
 if(id==='rgb:on'){if(!canControl(id))return Promise.resolve(false);apply=v=>state.rgbOn=v}
 else if(id==='rgb:brightness')apply=v=>state.brightness=v;
 else if(id==='rgb:color')apply=v=>state.rgbColor=v;
 else if(id==='station:volume')apply=v=>state.stationVolume=v;
 else if(id==='station:playing')apply=v=>state.stationPlaying=v;
 else if(['station:next','station:previous'].includes(id)){if(!canControl(id))return Promise.resolve(false);apply=()=>{}}
 else if(id.endsWith('/brightness')){
  // Яркость линии света (3.3.0): `${id}/brightness`, 1-100 (сервер маппит в 0-255).
  const key=id.slice(0,-'/brightness'.length),c=channel(key);
  if(!c||!canControl(id))return Promise.resolve(false);
  apply=v=>{state.lightBrightness[key]=v};
 }
 else{const c=channel(id);if(!c||!canControl(id))return Promise.resolve(false);apply=v=>c.on=v}
 return sendCommand(id,value,apply,refresh);
}
function master(){
 settingsOpen=false;$('#sheet-content').dataset.station='';
 modal(`<h2>Выключить весь свет?</h2><p class="description">${isLive()?'Выключатся только привязанные и проверенные линии света. Это реальные команды Home Assistant.':'Команды выполнятся только в демомакете.'} Результат проверяется по состоянию каждой линии.</p>
 <div class="inline-note">Только линии, включённые в мастер-свет в каталоге. Камера, музыка и датчики не затрагиваются.</div>
 <div class="sheet-actions"><button class="primary" data-action="confirm-master">Выключить</button><button class="secondary" data-action="cancel">Отмена</button></div>`);
}
const masterWave={active:false}; // 3.3.0: флаг идущей «волны выключения» — повторный тап не дублирует команды.
async function masterConfirm(){
 if(masterBlocked()||masterWave.active)return;
 closeModal();state.batchPending=true;masterWave.active=true;
 // Каскад (3.3.0): комнаты гаснут последовательно с шагом 300 мс (порядок —
 // rooms/избранное), линии внутри комнаты — параллельно. Прогресс виден:
 // c.on снимается по ack каждой линии, refresh() перекрашивает сетку, счётчик
 // «Свет · N/M» в рейле тикает вниз. scheduleWave из src/light-wave.js.
 const groups=[];
 for(const r of rooms){
  const list=r.channels.filter(c=>c.masterOff&&c.on&&!c.planned&&canControl(c.id));
  if(list.length)groups.push(list);
 }
 const wave=scheduleWave(groups,c=>command(c.id,false));
 const results=await wave.all();
 state.batchPending=false;masterWave.active=false;refresh();
 toast(results.every(Boolean)?(isLive()?'Проверенные линии выключены по данным HA.':'Свет выключен и подтверждён в демо.'):'Не все линии подтвердили выключение. Проверь сообщения в комнатах.');
}
function stationSheet(){
 const enabled=!isLive()&&state.stationMode==='demo'&&!state.demoOffline,offline=!isLive()&&(state.stationMode==='offline'||state.demoOffline);
 const e=isLive()?observed('station'):null;
 if(isLive())return `<h2>Станция · ${esc(stationRoom())}</h2><p class="description">${esc(!state.liveOnline?'Нет связи с Home Assistant':stationStateLabel(e))}</p>
 <div class="inline-note">${esc(e?.attributes.media_title||'Название трека не передано')}${e?.attributes.media_artist?' · '+esc(e.attributes.media_artist):''}</div>
 <div class="control-group"><div class="control-row"><div><h3>Воспроизведение</h3><p>Команды только через media_player в HA</p></div><button class="icon-button" data-action="station-play" aria-label="${state.stationPlaying?'Пауза':'Воспроизвести'}" ${disabled(!stationSupports(e,'playing',!state.stationPlaying)||hasPending())}>${I(state.stationPlaying?'pause':'play')}</button></div>${phaseLine('station:playing')}</div>
 <div class="rgb-control"><label for="station-volume">Громкость <span id="station-volume-label">${Number.isFinite(e?.attributes.volume_level)?state.stationVolume+' %':'Недоступна'}</span></label><input id="station-volume" type="range" min="0" max="100" value="${state.stationVolume}" ${disabled(!stationSupports(e,'volume')||hasPending())}/>${phaseLine('station:volume')}</div>
 ${stationSkipButtons()}${phaseLine('station:previous')}${phaseLine('station:next')}
 <div id="sheet-shopping">${shoppingState.loaded?shoppingCardMarkup():'<p class="description">Загружаем список покупок…</p>'}</div>
 <div class="control-group tts-block"><h3>Сказать на станции</h3>
  <div class="tts-presets">${['Гость пришёл','Ужин готов','Пора домой'].map(t=>`<button class="tts-preset" data-tts-preset="${esc(t)}" ${disabled(!state.liveOnline)}>${esc(t)}</button>`).join('')}</div>
  <label for="tts-text">Своя фраза · до 100 символов</label>
  <div class="tts-row"><input id="tts-text" maxlength="100" placeholder="Текст для станции" ${disabled(!state.liveOnline)}/><span id="tts-count">0/100</span><button class="secondary" data-action="tts-send" ${disabled(!state.liveOnline)}>Сказать</button></div>
  <p id="tts-status" class="description" role="status" aria-live="polite"></p>
  <p class="description">Отправка через media_player.play_media. Home Assistant не подтверждает сам факт озвучивания — панель честно показывает «отправлено».</p></div>
 <p class="description">Переключение треков, пауза и громкость доступны при поддержке интеграцией. Команды выполняются станцией в коридоре, не браузером. При потере связи управление блокируется.</p>`;
 return `<h2>Станция · ${esc(stationRoom())}</h2><p class="description">Голос и музыка. Это демонстрационное управление, не настоящая станция.</p>
 <div class="inline-note">${offline?'Нет связи · демонстрация':enabled?'Демоуправление включено для проверки интерфейса. Это не связь с реальной станцией.':'Не подключена к панели. Реальный статус и возможности пока неизвестны.'}</div>
 <div class="control-group"><div class="control-row"><div><h3>Воспроизведение</h3><p>${enabled?(state.stationPlaying?'Играет · демо, без аудиопотока':'Пауза · демо'):'Доступность уточним после интеграции'}</p></div>
 <button class="icon-button" data-action="station-play" aria-label="${state.stationPlaying?'Пауза':'Воспроизвести'}" ${disabled(!enabled||hasPending())}>${I(state.stationPlaying?'pause':'play')}</button></div>${phaseLine('station:playing')}</div>
 <div class="rgb-control"><label for="station-volume">Громкость <span id="station-volume-label">${enabled?state.stationVolume+' % · демо':'Недоступна'}</span></label>
 <input id="station-volume" type="range" min="0" max="100" value="${state.stationVolume}" ${disabled(!enabled||hasPending())}/>${phaseLine('station:volume')}</div>
 <p class="description">Эти функции условно показаны в деморежиме. В рабочей версии появятся только подтверждённые возможности интеграции. Эта веб-панель не предназначена для запуска на экране станции.</p>`;
}
let duoTimer,duoGeneration=0,duoInFlight=-1;
function clearDuoResult(){duoUI.message='';duoUI.error='';duoUI.phase='';const result=$('.duo-result');if(result)result.hidden=true}
function duoOpen(){return !$('#overlay').hidden&&$('#sheet-content').dataset.station==='hub'}
function paintDuo(){
 if(!duoOpen())return;
 const tab=document.activeElement?.dataset.duoTab;
 $('#sheet-content').innerHTML=assistantView(stationRoom(),stationSheet(),{live:isLive(),online:state.liveOnline});icons();
 if(tab)$(`[data-duo-tab="${tab}"]`)?.focus({preventScroll:true});
}
async function refreshDuo(){
 if(!duoOpen()||duoUI.busy)return;
 if(!isLive()){duoUI.status=null;duoUI.loading=false;paintDuo();return}
 const generation=duoGeneration;if(duoInFlight===generation)return;duoInFlight=generation;
 try{const status=await api('assistant/status');if(generation!==duoGeneration||!duoOpen())return;duoUI.status=status;duoUI.statusError=''}
 catch(error){if(generation===duoGeneration)duoUI.statusError=error.message}
 finally{if(duoInFlight===generation)duoInFlight=-1}
 if(generation!==duoGeneration||!duoOpen())return;
 duoUI.loading=false;
 if(!document.activeElement?.matches('#sheet-content input,#sheet-content textarea,#sheet-content select'))paintDuo();
}
async function openDuo(){
 settingsOpen=false;duoUI.confirm=null;duoUI.tool=null;duoUI.tab='home';duoUI.loading=isLive();duoUI.error='';duoUI.message='';
 modal('');$('#sheet-content').dataset.station='hub';$('.sheet').classList.add('station-hub-sheet');paintDuo();
 const generation=duoGeneration;await refreshDuo();
 if(generation===duoGeneration&&duoOpen()){clearInterval(duoTimer);duoTimer=setInterval(refreshDuo,10000)}
}
async function loadDuoList(){
 if(!isLive()){duoUI.listError='Нужен подключённый HA.';paintDuo();return}
 try{const data=await api('assistant/shopping');duoUI.items=data.items;duoUI.listLoaded=true;duoUI.listError=''}
 catch(error){duoUI.listError=error.message}
 if(duoUI.tab==='shopping')paintDuo();
}
async function runDuo(action,extra={}){
 if(duoUI.busy||!isLive()||!state.liveOnline)return;
 duoUI.busy=true;duoUI.error='';duoUI.message='';duoUI.confirm=null;paintDuo();$('.sheet').scrollTop=0;
 try{
  await flushStorage();
  const result=await api('assistant/action',{method:'POST',timeout:60000,body:{action,requestId:deviceId(),...extra}});
  duoUI.phase=result.phase;duoUI.message=result.message;
  if(result.shopping){duoUI.items=result.shopping.items;duoUI.listLoaded=true;duoUI.listError=''}
  if(action==='shoppingSync'&&result.phase==='accepted')await loadDuoList();
  if(action==='announce'&&result.phase==='accepted')duoUI.draft='';
  if(action==='shoppingAdd'&&result.phase==='confirmed')duoUI.item='';
  if(result.warnings?.length)duoUI.message+=' Замечания: '+result.warnings.map(w=>(w.room?areaName(w.room)+' / ':'')+w.name+(w.kind==='unknown'?' — нет данных':w.kind==='alarm'?' — тревога':' — открыта')).join('; ');
  if(result.results?.some(r=>!r.ok))duoUI.message+=' Не подтверждено: '+result.results.filter(r=>!r.ok).map(r=>(r.room?areaName(r.room)+' / ':'')+r.name).join('; ');
  if(result.speech?.phase==='unknown')duoUI.message+=' Озвучивание не подтверждено.';
 }catch(error){duoUI.error=error.message;duoUI.phase='unknown'}
 finally{duoUI.busy=false;paintDuo();if(duoOpen())$('.sheet').scrollTop=0;await refreshDuo()}
}
function sensorSheet(id){
 const s=sensors[id],name={living:'Гостиная',well:'Скважина',attic:'Чердак'}[id];
 const d=state.devices.find(d=>d.type==='temperature'&&d.room===id&&d.status==='installed'),times=stateTimes(d?observed(d.id):null);
 const stamp=at=>at?new Date(at).toLocaleString('ru-RU',{timeZone:PANEL_TIMEZONE}):'Нет достоверной метки';
 return `<h2>Температура · ${name}</h2><p class="description">${sensorStatus(id)}</p>
 <div class="sensor-detail">${noConnection()||s.quality==='unavailable'?'—':reading(s.value)} °C <span>${noConnection()||s.humidity===null?'—':s.humidity+' %'} влажности</span></div>
 <div class="inline-note">${isLive()?(s.quality==='unavailable'||noConnection()?'Нет доступного проверенного состояния HA.':'HA отдаёт это значение. Давность изменения не означает неисправность; новое физическое измерение этим не подтверждается.'):'Это демонстрационный пример, не измерение из твоего дома.'}</div>
 ${isLive()?`<details class="sensor-meta"><summary>Временные метки HA</summary><dl class="sensor-provenance"><div><dt>Изменение значения</dt><dd>${stamp(times.changedAt)}</dd></div><div><dt>Изменение состояния или атрибутов</dt><dd>${stamp(times.updatedAt)}</dd></div><div><dt>Запись состояния в HA</dt><dd>${stamp(times.reportedAt)}</dd></div><div><dt>Последний успешный опрос HA панелью</dt><dd>${stamp(state.liveUpdatedAt||null)}</dd></div></dl><p class="history-footnote">Опрос HA не считается отчётом датчика. Для контроля молчания физического устройства нужна достоверная метка last_seen его интеграции.</p></details><button class="secondary sensor-history-link" data-history-zone="${id}">История показаний ${I('arrow-up-right')}</button>`:`<p class="description">Время демонстрационного примера: ${s.receivedAt?stamp(s.receivedAt):'неизвестно'}.</p>`}`;
}
function settings(){
 const tab=state.settingsTab;
 return `<h2>Настройки панели</h2><p id="storage-status" class="storage-status ${state.storage}">${esc(state.storageMessage)}</p>
 <div class="settings-tabs" role="tablist">${[['panel','Панель'],['favorites','Избранное']].map(([id,title])=>
 `<button role="tab" aria-selected="${tab===id}" class="${tab===id?'active':''}" data-settings-tab="${id}">${title}</button>`).join('')}</div>
 ${tab==='panel'?panelSettings():favoriteSettings()}`;
}
function panelSettings(){
 return `<div class="panel-settings-grid"><section class="settings-section"><h3>Экран и режим ожидания</h3><label class="setting-field">Режим ожидания<select id="idle-setting">${[[0,'Выключен'],[10,'10 секунд · для проверки'],[60,'Через минуту'],[90,'Через 90 секунд'],[180,'Через 3 минуты']].map(([v,l])=>`<option value="${v}" ${state.idleSeconds===v?'selected':''}>${l}</option>`).join('')}</select></label>
 <button class="secondary full-width" data-action="standby">${I('moon-star')}Посмотреть экран ожидания</button>
 <label class="setting-field setting-check"><input id="ambient-setting" type="checkbox" ${state.ambientMode!==false?'checked':''}/>Тихий режим</label>
 <p class="setting-help">Через минуту после экрана ожидания панель затихает: только большие часы, дата и температура. Любое касание возвращает обычный режим.</p>
 <label class="setting-field">Ночной интерфейс<select id="night-setting">${[['auto','Автоматически · по расписанию'],['on','Всегда включён'],['off','Выключен']].map(([v,l])=>`<option value="${v}" ${state.nightMode===v?'selected':''}>${l}</option>`).join('')}</select></label>
 <div class="night-times"><label class="setting-field">Ночь с<input id="night-start" type="time" value="${state.nightStart||'23:00'}"/></label><label class="setting-field">Ночь до<input id="night-end" type="time" value="${state.nightEnd||'07:00'}"/></label></div>
 <p class="setting-help" id="night-status">${nightLabel(new Date().getHours()*60+new Date().getMinutes(),state.nightStart||'23:00',state.nightEnd||'07:00',state.nightMode)}</p>
 <p class="setting-help">Приглушается оформление панели, не аппаратная яркость планшета. Свет в доме не переключается.</p>
 <div class="night-times"><label class="setting-field">Охрана ночью<select id="guard-setting">${[['auto','Автоматически · по расписанию'],['on','Всегда включена'],['off','Выключена']].map(([v,l])=>`<option value="${v}" ${(state.guardNight||'auto')===v?'selected':''}>${l}</option>`).join('')}</select></label><label class="setting-field">Дверь открыта дольше, мин<input id="guard-minutes" type="number" min="5" max="120" step="1" value="${state.guardDoorMinutes||15}"/></label></div>
 <div class="night-times"><label class="setting-field">Сирена через, мин (вне дома)<input id="guard-away-minutes" type="number" min="1" max="30" step="1" value="${state.guardAwayMinutes||3}"/></label><label class="setting-field">Секунды на выход<input id="guard-exit-delay" type="number" min="0" max="600" step="1" value="${state.guardExitDelay??120}"/></label></div>
 <div class="night-times"><label class="setting-field setting-check"><input id="guard-flash-setting" type="checkbox" ${state.guardFlash!==false?'checked':''}/>Мигание светом при сирене</label><label class="setting-field setting-check"><input id="guard-master-setting" type="checkbox" ${state.guardMasterArms!==false?'checked':''}/>Мастер-кнопка ставит/снимает охрану</label></div>
 <label class="setting-field">Сущность охраны (мост Яндекса)<input id="guard-entity" value="${esc(state.guardEntity||'')}" placeholder="input_boolean.ohrana" spellcheck="false" autocomplete="off"/></label>
 <p class="setting-help">Создай в HA помощник-выключатель «Охрана», отдай его в Яндекс (интеграция Yandex Smart Home) и добавь в сценарий «Я ухожу» шаг «Охрана — включить». Вкл = уход и охрана, выкл = снятие. Пусто — взвод только с панели.</p>
 <p class="setting-help">«Авто» — охрана активна в ночное окно из расписания выше. Если дверь открыта дольше указанного времени, в сводке появляется алерт; ночью открытая дверь и события двора помечаются как ночные.</p>
 </section><section class="settings-section"><h3>Оформление и обслуживание</h3><label class="setting-field">Постоянный экран<select id="kiosk-setting"><option value="off" ${!state.kiosk?'selected':''}>Обычная панель</option><option value="on" ${state.kiosk?'selected':''}>Компактный режим для экрана</option></select></label>
 <button class="secondary full-width" data-action="fullscreen">${I('maximize')}Полный экран</button>
 <p class="setting-help">Полный экран включается по нажатию; Esc возвращает обычный режим. Настройки не скрываются и не блокируются паролем.</p>
 <label class="setting-field">Фото для экрана ожидания<input id="hero-upload" type="file" accept="image/jpeg,image/png,image/webp"/></label>
 <p class="setting-help">${state.preview?'В превью фото остаётся во вкладке. Постоянное сохранение доступно только при локальном запуске.':'Фото сначала остаётся во вкладке. По отдельной кнопке сохраняется в локальную базу на этом компьютере.'} До 10 МБ; сохраняем уменьшенный JPEG.</p>
 ${state.heroURL&&photoBlob&&!state.preview?'<button class="secondary full-width" data-action="save-photo">Сохранить фото на этом компьютере</button>':''}
 ${state.heroURL?'<button class="text-button" data-action="reset-photo">Вернуть интерьерный референс</button>':''}
 <div class="technical-entry"><button class="text-button" data-action="technical">${I('settings-2')}Технический раздел</button><button class="text-button" data-action="about">${I('info')}О панели</button></div></section></div>`;
}
function favoriteSettings(){
 return `<p class="setting-help">До шести комнат. Порядок списка совпадает с порядком на главной.</p>
 <div class="favorite-list">${state.favorites.map((id,i)=>`<div class="favorite-row"><span>${I(getRoom(id).icon)}${getRoom(id).short}</span>
 <div><button class="icon-button" aria-label="Поднять ${getRoom(id).short}" data-move="${id}" data-step="-1" ${disabled(i===0)}>${I('chevron-up')}</button>
 <button class="icon-button" aria-label="Опустить ${getRoom(id).short}" data-move="${id}" data-step="1" ${disabled(i===state.favorites.length-1)}>${I('chevron-down')}</button>
 <button class="icon-button" aria-label="Убрать ${getRoom(id).short}" data-favorite="${id}">${I('x')}</button></div></div>`).join('')}</div>
 ${state.favorites.length<6?`<div class="favorite-add">${rooms.filter(r=>!state.favorites.includes(r.id)).map(r=>`<button class="secondary" data-favorite="${r.id}">${I('star')}${r.short}</button>`).join('')}</div>`:'<p class="setting-help">Убери одну комнату, чтобы добавить другую.</p>'}
 ${!state.favorites.length?'<div class="inline-note">Выбери хотя бы одну комнату для главной.</div>':''}`;
}
function testSettings(){
 return `<div class="inline-note">${isLive()?'В рабочем режиме симулятор заблокирован. Для проверки ошибок переключись на демонстрационный источник.':'Все переключатели ниже моделируют состояния. Они не отключают настоящие устройства.'}</div>
 <label class="setting-field">Связь с демоустройствами<select id="network-setting" ${disabled(isLive())}><option value="online" ${!state.demoOffline?'selected':''}>Демосвязь доступна</option><option value="offline" ${state.demoOffline?'selected':''}>Имитировать потерю связи</option></select></label>
 <button class="secondary full-width" data-action="fail-next" ${disabled(isLive()||state.failNext||hasPending())}>${I('triangle-alert')}${state.failNext?'Следующая команда завершится ошибкой':'Ошибка следующей команды'}</button>
 <label class="setting-field">Карточка Дуо Макс<select id="station-setting" ${disabled(isLive())}>${[['unconfigured','Не подключена · обычный режим'],['demo','Включить условное демоуправление'],['offline','Имитировать нет связи']].map(([v,l])=>`<option value="${v}" ${state.stationMode===v?'selected':''}>${l}</option>`).join('')}</select></label>
 <div class="command-log"><h3>Последние команды · ${isLive()?'Home Assistant':'демо'}</h3>${state.commandHistory.length?state.commandHistory.slice(0,5).map(c=>
 `<div><span>${esc(commandLabel(c.id))}<small>${timeOf(c.finishedAt)}</small></span><strong class="${c.phase}">${c.phase==='success'?'Подтверждено':'Ошибка'}</strong></div>`).join(''):'<p class="setting-help">Пока команд нет.</p>'}</div>`;
}
function commandLabel(id){
 if(id.startsWith('rgb:'))return 'RGB-лампа';
 if(id.startsWith('station:'))return 'Дуо Макс';
 if(id.endsWith('/brightness')){
  const [r,i]=id.slice(0,-'/brightness'.length).split(':');
  return (getRoom(r)?.short||r)+' · '+(getRoom(r)?.channels[Number(i)]?.name||'')+' · яркость';
 }
 const [r,i]=id.split(':');return (getRoom(r)?.short||r)+' · '+(getRoom(r)?.channels[Number(i)]?.name||'');
}
function updateHeader(){
 const node=$('#connection-badge');
 if(node){
  const summary=homeLightSummary(),warning=isLive()&&summary.warning;
  const label=warning?summary.label:isLive()?'Home Assistant':'Демонстрационный режим';
  node.innerHTML=`<span></span>${esc(label)}`;node.dataset.warning=String(warning);
  node.title=isLive()?[state.liveError||'Home Assistant',summary.detail].join(' · '):'Реальные устройства не подключены';
  node.setAttribute('aria-label',`${label}. Открыть настройки подключения`);
 }
 document.documentElement.dataset.mode=state.mode;
}
function catalogSettings(){
 const d=catalogEdit==='new'?{type:'light',room:'corridor',name:'',status:'planned',note:'',masterOff:false}:state.devices.find(d=>d.id===catalogEdit);
 if(d)return `<div class="eyebrow">${d.id?'Редактирование · '+esc(d.id):'Новое устройство'}</div>
  <label class="setting-field">Тип<select id="catalog-type" ${disabled(!!d.id)}>${Object.entries(deviceTypes).map(([id,t])=>`<option value="${id}" ${d.type===id?'selected':''}>${t.label}</option>`).join('')}</select></label>
  <label class="setting-field">Комната / зона<select id="catalog-room">${areas.map(a=>`<option value="${a.id}" ${d.room===a.id?'selected':''}>${a.name}</option>`).join('')}</select></label>
  <label class="setting-field">Название<input id="catalog-name" value="${esc(d.name)}" maxlength="64" placeholder="Например, коридор · основной свет"/></label>
  <label class="setting-field">Наличие<select id="catalog-status"><option value="planned" ${d.status==='planned'?'selected':''}>Планируется</option><option value="installed" ${d.status==='installed'?'selected':''}>Установлено</option></select></label>
  <label class="setting-field">Примечание<input id="catalog-note" maxlength="240" value="${esc(d.note)}"/></label>
  <label class="check-field"><input id="catalog-master" type="checkbox" ${d.masterOff?'checked':''} ${disabled(!!d.powerId)}/>Включить в мастер-выключение света (только для световых устройств)</label>
  <div class="inline-note">ID постоянный. Изменение комнаты или наличия снимает проверку привязки. Котёл, насос и ворота остаются заблокированными независимо от настроек.</div>
  <div class="sheet-actions"><button class="primary" data-action="save-device" ${disabled(hasPending())}>Сохранить устройство</button><button class="secondary" data-action="catalog-back">К списку</button></div>`;
 return `<p class="setting-help">Каждая клавиша выключателя добавляется отдельной линией. Каталог, названия и порядок сохраняются локально и входят в JSON-копию. До 128 устройств.</p>
  <button class="primary full-width" data-action="new-device" ${disabled(hasPending()||state.devices.length>=128)}>Добавить устройство</button>
  <div class="catalog-list">${state.devices.map((d,i)=>`<article class="binding-card catalog-item"><div class="title-line"><h3>${esc(d.name)}</h3>${I(deviceTypes[d.type].icon)}</div><p>${esc(areaName(d.room))} · ${deviceTypes[d.type].label} · ${d.status==='planned'?'планируется':'установлено'}</p><code>${d.id}</code><div class="catalog-actions"><button class="secondary" data-edit-device="${d.id}" ${disabled(hasPending())}>Изменить</button><button class="icon-button" data-order-device="${d.id}" data-step="-1" aria-label="Поднять ${esc(d.name)}" ${disabled(i===0||hasPending())}>${I('chevron-up')}</button><button class="icon-button" data-order-device="${d.id}" data-step="1" aria-label="Опустить ${esc(d.name)}" ${disabled(i===state.devices.length-1||hasPending())}>${I('chevron-down')}</button><button class="text-button" data-delete-device="${d.id}" ${disabled(hasPending())}>Удалить</button></div></article>`).join('')}</div>`;
}
async function commitCatalog(next){
 if(hasPending())return;
 const old=preferences();
 try{applyPreferences(next);await flushStorage();state.commands.clear();startLive(refresh);refresh();catalogEdit=null;techMessage='Каталог сохранён. Новые и перемещённые устройства требуют проверки привязки.';updateTechnical()}
 catch(error){applyPreferences(old);techMessage='Каталог не изменён: '+error.message;updateTechnical()}
}
function saveDevice(){
 const next=preferences(),old=next.devices.find(d=>d.id===catalogEdit);
 const d={...(old||{id:'device-'+deviceId(),type:$('#catalog-type').value}),room:$('#catalog-room').value,name:$('#catalog-name').value,status:$('#catalog-status').value,note:$('#catalog-note').value,masterOff:$('#catalog-master').checked};
 if(old){next.devices[next.devices.findIndex(d=>d.id===old.id)]=d;if(!samePhysicalDevice(old,d))next.bindings[d.id].verified=false}
 else{next.devices.push(d);next.bindings[d.id]={entityId:'',verified:false}}
 commitCatalog(next);
}
async function saveEquipmentModel(next){
 if(hasPending())return;
 const old=preferences();
 try{
  applyPreferences(next);await flushStorage();equipmentEdit=null;
  techMessage='Структура сохранена. Entity_id и отметки проверки не менялись.';
  refresh();updateTechnical();
 }catch(error){
  applyPreferences(old);techMessage='Структура не изменена: '+error.message;updateTechnical();
 }
}
// Волна A 3.2.0: статус ONVIF-датчика двора и лист «Здоровье системы».
let techOnvif=null,healthBusy=false;
function loadTechOnvif(){
 api('yard-onvif').then(v=>{techOnvif=v;if(state.techOpen)updateTechnical()}).catch(()=>{techOnvif=null});
}
function yardOnvifLine(){
 if(state.yard_onvif_enabled===false)return 'Выключено. Резерв: детект по кадрам камеры.';
 const cams=(techOnvif&&techOnvif.cameras)||[];
 if(!cams.length)return techOnvif?'Камер не добавлено. Резерв: детект по кадрам камеры.':'Статус запрашивается…';
 return cams.map(c=>{
  const st=c.alive?'активна':c.lastError?'недоступна':'подключается…';
  return `${c.name} (${c.host}) — ${st}`;
 }).join(' · ');
}
// 3.4.6: редактор списка ONVIF-камер. Черновик полей живёт в camDraft —
// перерисовки (обновление статусов) не стирают недописанные строки.
let camDraft=[];
function captureCamDraft(){
 const rows=$('.sheet')?.querySelectorAll('[data-cam-row]')||[];
 camDraft=[];
 rows.forEach(row=>{
  const i=+row.dataset.camRow,o={};
  row.querySelectorAll('[data-cam-field]').forEach(el=>{o[el.dataset.camField]=el.type==='checkbox'?el.checked:el.value});
  camDraft[i]=o;
 });
}
const camValue=(c,i,f)=>camDraft[i]&&camDraft[i][f]!==undefined?camDraft[i][f]:(f==='pass'?'':(c[f]??''));
function camEditor(){
 const cams=Array.isArray(state.yardCameras)?state.yardCameras:[];
 const statuses=(techOnvif&&techOnvif.cameras)||[];
 const rows=cams.map((c,i)=>{
  const st=statuses[i];
  const line=st?st.alive?'активна':st.lastError?'недоступна':'подключается…':'';
  return `<fieldset class="cam-edit-row" data-cam-row="${i}">
   <legend>${esc(c.name||('Камера '+(i+1)))}${line?` · <span data-cam-status>${esc(line)}</span>`:''}</legend>
   <label class="setting-field compact">Имя<input data-cam-field="name" data-cam-idx="${i}" value="${esc(camValue(c,i,'name'))}" maxlength="24"/></label>
   <label class="setting-field compact">Адрес<input data-cam-field="host" data-cam-idx="${i}" value="${esc(camValue(c,i,'host'))}" placeholder="192.168.8.x" spellcheck="false"/></label>
   <label class="setting-field compact">Порт<input data-cam-field="port" data-cam-idx="${i}" type="number" min="1" max="65535" value="${esc(String(camValue(c,i,'port')||2020))}"/></label>
   <label class="setting-field compact">Логин<input data-cam-field="user" data-cam-idx="${i}" value="${esc(camValue(c,i,'user'))}" spellcheck="false"/></label>
   <label class="setting-field compact">Пароль<input data-cam-field="pass" data-cam-idx="${i}" type="password" value="${esc(camValue(c,i,'pass'))}" placeholder="${c.pass?'хранится':'не задан'}" autocomplete="new-password"/></label>
   <label class="setting-field setting-check"><input data-cam-field="enabled" data-cam-idx="${i}" type="checkbox" ${camValue(c,i,'enabled')!==false?'checked':''}/>Включена</label>
   <button class="text-button" data-action="camera-del" data-cam-del="${i}">Удалить</button>
  </fieldset>`;
 }).join('');
 return `${rows||'<p class="setting-help">Камер пока нет — добавь вручную или найди в сети.</p>'}
  <div class="cam-edit-actions">
   <button class="secondary" data-action="camera-add" ${disabled(cams.length>=4)}>${I('plus')}Добавить камеру</button>
   <button class="secondary" data-action="camera-discover" ${disabled(hasPending())}>${I('search')}Найти в сети</button>
  </div>
  <p class="setting-help">Пустой пароль = хранится прежний. «Найти в сети» шлёт WS-Discovery: камеры ONVIF отвечают своим адресом.</p>`;
}
function healthRow(name,status,detail,tone){
 return `<div class="health-row"><span class="health-dot is-${tone}"></span><div class="health-text"><strong>${esc(name)}</strong><span>${esc(status)}</span></div><small>${esc(detail)}</small></div>`;
}
function healthMarkup(h,error){
 if(error||!h)return `<p class="setting-help">Здоровье системы сейчас не получить: ${esc(error||'нет данных')}.</p><button class="secondary full-width" data-health-reload ${disabled(healthBusy)}>Обновить</button>`;
 const ha=h.ha||{},on=h.onvif||{};
 const haTone=ha.connected?'ok':ha.enabled?'warn':'warn';
 const haStatus=ha.connected?'Состояния поступают':ha.enabled?(ha.lastError?'Нет связи: '+ha.lastError:'Ждём первое обновление'):'Не настроен · деморежим';
 const haDetail=ha.latencyMs!=null?`задержка ${ha.latencyMs} мс`:'—';
 const onTone=on.configured&&on.alive?'ok':'warn';
  // 3.4.6: по строке на каждую камеру; если сервер старый — одна агрегированная строка.
  const onRows=(Array.isArray(on.cameras)&&on.cameras.length?on.cameras:[]).map(c=>{
   const tone=c.alive?'ok':'warn';
   const status=!on.enabled?'Выключено · резерв по кадрам':c.alive?'События ONVIF активны':'События недоступны · резерв по кадрам';
   const detail=c.alive?(c.subscription?String(c.subscription).slice(0,60):'—'):(c.lastError?String(c.lastError).slice(0,120):'—');
   return healthRow('Камера '+c.name+' ('+c.host+')',status,detail,tone);
  }).join('')||healthRow('Датчик двора (ONVIF)',onStatus,onDetail,onTone);
  const sse=(h.sse&&h.sse.clients)||0,disk=h.disk||{},up=(h.uptime&&h.uptime.seconds)||0;
 return `<div class="health-list">
  ${healthRow('Home Assistant',haStatus,haDetail,haTone)}
  ${onRows}
  ${healthRow('Прямая трансляция (SSE)','Клиентов: '+sse,'канал состояний',sse>=0?'ok':'warn')}
  ${healthRow('Данные',`SQLite: ${disk.sqliteKB||0} КБ`,`резервных копий: ${disk.backups||0}`,'ok')}
  ${healthRow('Время работы','с старта сервера: '+up+' с','процесс панели','ok')}
  ${healthRow('Версия',h.version||'—','панель','ok')}
 </div>${healthJournal(h.journal)}${healthSnapshotMsg?`<p class="setting-help" data-health-snapshot-msg>${esc(healthSnapshotMsg)}</p>`:''}<button class="secondary full-width" data-health-snapshot ${disabled(healthBusy)}>${I('archive')}Снимок профиля</button><button class="secondary full-width" data-health-reload ${disabled(healthBusy)}>${I('rotate-ccw')}Обновить</button>`;
}
// 3.3.3: журнал событий сервера (последние 50, новые сверху) + ручной снимок профиля.
let healthSnapshotMsg='';
function journalRows(entries){
 const rows=(Array.isArray(entries)?entries:[]).slice(0,50);
 if(!rows.length)return `<p class="setting-help" data-health-journal>Журнал пуст: событий пока не было.</p>`;
 return `<div class="health-journal" data-health-journal>${rows.map(e=>{const d=new Date(e.at||Date.now());
  const time=d.toLocaleTimeString('ru-RU',{hour:'2-digit',minute:'2-digit',second:'2-digit'});
  return `<div class="health-row journal-row"><span class="health-dot is-${e.level==='warn'?'warn':'ok'}"></span><div class="health-text"><strong>${esc(time)}</strong><span>${esc(e.text||'')}</span></div><small>${esc(e.level||'info')}</small></div>`}).join('')}</div>`;
}
const healthJournal=entries=>`<div class="health-journal-block"><h3>Журнал</h3>${journalRows(entries)}</div>`;
async function loadHealth(){
 healthBusy=true;paintHealth();
 try{healthData=await api('health')}catch(error){healthError=error.message}
 healthBusy=false;paintHealth();
}
let healthData=null,healthError='';
function paintHealth(){const box=$('[data-health-sheet]');if(box){box.innerHTML=healthMarkup(healthData,healthError);icons()}}
function openHealth(){
 healthData=null;healthError='';
 simpleSheet(`<h2>Здоровье системы</h2><p class="description">Живые данные локального сервера: подключение, датчик двора, клиенты, данные.</p><div data-health-sheet>${healthMarkup(null,'Загружаем…')}</div>`);
 loadHealth();
}
// Блок «Показания счётчика» (тех.раздел, вкладка «Связь»): тариф и справочник
// месячных показаний ТНС. Сохранение — общий preferences-путь (PUT с proof).
function energyMeterBlock(){
 const readings=(state.energy_readings||[]).slice().sort((a,b)=>a.date<b.date?-1:1);
 const last=readings.at(-1),prior=readings.at(-2),tariff=state.energy_tariff;
 let summary='Внеси минимум два показания — здесь появится расход за месяц.';
 if(last&&prior){
  const delta=last.value-prior.value;
  if(delta<0)summary='Значение ниже предыдущего — счётчик откатился, ждём новый месяц.';
  else{
   const cost=tariff!=null?Math.round(delta*tariff):null;
   summary=`Предыдущее: ${readingsDateOf(prior.date)} · ${formatMeterInt(prior.value)} → месяц: ${formatMeterInt(delta)} кВт·ч${cost!==null?` ≈ ${formatMeterInt(cost)} ₽`:' · тариф не задан'}`;
  }
 }
 return `
  <label class="setting-field">Тариф, ₽/кВт·ч<input id="energy-tariff" type="number" min="0.01" max="99" step="0.01" value="${tariff==null?'':tariff}" placeholder="не задан"/></label>
  <div class="energy-reading-list">${readings.map(r=>`<div class="energy-reading-row"><span>${esc(readingsDateOf(r.date)||r.date)}</span><strong>${esc(formatMeterInt(r.value))}</strong><button class="energy-reading-del" data-energy-reading-del="${esc(r.date)}" title="Удалить показание" aria-label="Удалить показание ${esc(readingsDateOf(r.date)||r.date)}">✕</button></div>`).join('')||'<p class="setting-help">Показаний пока нет.</p>'}</div>
  <div class="energy-reading-add"><input id="energy-reading-date" type="date" aria-label="Дата показания"/><input id="energy-reading-value" type="number" min="1" step="1" placeholder="кВт·ч" aria-label="Значение показания"/><button class="secondary" data-action="energy-reading-add" ${disabled(hasPending())}>Добавить</button></div>
  <p class="setting-help">${esc(summary)}</p>
  <p class="setting-help">ТНС снимает показания раз в месяц: расход «Месяц» считается от последнего внесённого показания, недельная история не используется.</p>`;
}
function technical(){
 const ready=readiness();
 const tabs=[['connection','Связь'],['structure','Устройства'],['catalog','Каталог'],['bindings','Привязки'],['diagnostics','Проверка'],['backup','Копия'],['checklist','На месте']];
 let content='';
 if(techTab==='connection')content=`
  ${!state.preview?houseProfileReview():''}
  <div class="connection-status">${I(state.liveOnline?'circle-check':'radio')}<div><h3>${state.liveOnline?'Состояния Home Assistant доступны':state.haConfigured?'Адрес и токен заданы на сервере':'Дом пока не подключён'}</h3><p>${state.preview?'Это приватное демопревью. Доступ к дому в нём отключён.':esc(state.liveError||'Синхронизация раз в 5 секунд')}</p></div></div>
  <label class="setting-field">Источник данных<select id="mode-setting" ${disabled(hasPending())}><option value="demo" ${!isLive()?'selected':''}>Демонстрационный макет</option><option value="live" ${isLive()?'selected':''}>Home Assistant · реальные состояния</option></select></label>
  <label class="setting-field setting-check"><input id="auto-theme-setting" type="checkbox" ${state.autoTheme?'checked':''} ${disabled(!state.autoTheme&&terraceLux()===null)}/>Тема по освещённости</label>
  <p class="setting-help">${terraceLux()!==null?`Освещённость террасы сейчас ${Math.round(terraceLux())} лк: от ${AUTO_THEME_UP} лк — светлая тема, ниже ${AUTO_THEME_DOWN} лк — тёмная. Пока авто-тема работает, ручной переключатель темы заблокирован.`:'Нужна проверенная привязка «Освещённость террасы» и число лк из Home Assistant — без данных опция недоступна.'}</p>
  <div class="inline-note">В рабочем режиме нет подстановки демоданных: до получения состояния линии и датчики недоступны.</div>
   <div class="setting-block onvif-block">
    <label class="setting-field setting-check"><input id="yard-onvif-setting" type="checkbox" ${state.yard_onvif_enabled!==false?'checked':''} ${disabled(hasPending())}/>Датчики движения камер (ONVIF)</label>
    <p class="setting-help" data-yard-onvif-status>${esc(yardOnvifLine())}</p>
    <p class="setting-help">При выключении движение определяется по кадрам камер (jpeg-диффер) — резерв без событий железа.</p>
    ${camEditor()}
   </div>
   <button class="secondary full-width" data-action="health-sheet">${I('activity')}Здоровье системы</button>
   <div class="setting-block onvif-block" id="energy-meter-block">
    <h3>Показания счётчика</h3>
    ${energyMeterBlock()}
   </div>
  ${state.addon?'<ol class="setup-list"><li>Home Panel работает на системнике Home Assistant OS.</li><li>Доступ к HA настроен автоматически через Supervisor. .env и личный токен не нужны.</li><li>Во вкладке «Привязки» загрузи сущности и проверь соответствие каждой линии.</li></ol><p class="setting-help">Настройки сохраняются в /data/homepanel. Панель доступна в доверенной домашней сети; порт 8090 не выставляй в интернет.</p>':'<ol class="setup-list"><li>Локальный запуск через <code>Запустить.cmd</code>.</li><li>На месте создай <code>.env</code> по примеру. Адрес и токен вводятся только в локальный файл, не в браузер и не в чат.</li><li>Перезапусти сервер, загрузи список сущностей и проверь каждую привязку.</li></ol><p class="setting-help">Токен не включается в сборку и резервную копию. Локальный сервер слушает только этот компьютер; сетевой доступ для отдельного планшета настроим позже безопасным способом.</p>'}`;
 if(techTab==='catalog')content=catalogSettings();
 if(techTab==='structure')content=deviceStructure(preferences(),{editing:equipmentEdit,esc,areaName,areas,blocked:hasPending()});
 if(techTab==='bindings')content=`
  <div class="readiness"><strong>${ready.verified} / ${ready.total}</strong><span>линий света отмечено проверенными</span></div>
  <label class="setting-field">Группа устройств<select id="binding-room">${[...areas.map(a=>({...a,short:a.name})),{id:'all',short:'Все устройства'}].map(r=>`<option value="${r.id}" ${bindingRoom===r.id?'selected':''}>${r.short}</option>`).join('')}</select></label>
  <button class="secondary full-width" data-action="discover" ${disabled(hasPending())}>${I('radio')}Загрузить сущности из Home Assistant</button>
  <datalist id="ha-entities">${techEntities.map(e=>`<option value="${esc(e.entity_id)}">${esc(e.attributes.friendly_name||e.entity_id)} · ${esc(e.state)}</option>`).join('')}</datalist>
  <p class="setting-help">Не угадываем entity_id. Галочка означает, что ты физически проверил соответствие устройства и канала. Наличие сущности само по себе этого не доказывает.</p>
  ${bindingSummary()}
  <div class="binding-grid">${bindingDefinitions(state.devices).filter(b=>bindingRoom==='all'||b.device.room===bindingRoom).map(bindingCard).join('')}</div>
  <button class="primary full-width binding-save" data-action="save-bindings" ${disabled(hasPending())}>Сохранить привязки</button>
  <p class="setting-help">Планируемые устройства заблокированы. Камера открывается по нажатию; инженерное оборудование доступно только для наблюдения.</p>`;
 if(techTab==='diagnostics')content=testSettings()+`
  <p class="setting-help">Журнал хранится только до перезапуска вкладки. Реальные команды автоматически не повторяются.</p>
  <button class="secondary full-width" data-action="reconnect" ${disabled(hasPending())}>Перепроверить связь</button>`;
 if(techTab==='backup')content=`
  <div class="inline-note">Копия v3 содержит оформление, избранное, каталог, entity_id и модель устройств v1. Старые копии v3 принимаются с автоматическим созданием структуры. Без токена, фото и состояний устройств.</div>
  <button class="primary full-width" data-action="export">${I('download')}Скачать настройки JSON</button>
  <button class="secondary full-width" data-action="profile-export">${I('download')}Скачать копию профиля</button>
  <label class="setting-field">Восстановить настройки<input id="import-settings" type="file" accept="application/json,.json" ${disabled(hasPending())}/></label>
  <p class="setting-help">Импорт всегда включает деморежим и снимает отметки проверки каналов. Перед рабочим управлением их потребуется подтвердить снова.</p>`;
 if(techTab==='checklist')content=`
  <ul class="site-checklist">
   <li>${I('circle-check')}Панель, сохранение и демосценарии подготовлены</li>
   <li>${I('radio')}Завершить первичную настройку Home Assistant в доме</li>
   <li>${I('lightbulb')}Подключить гостиную и проверить два канала света</li>
   <li>${I('door-open')}Проверить левый канал прихожей и правый канал террасы</li>
   <li>${I('thermometer')}Привязать три температуры и влажность, проверить единицы</li>
   <li>${I('scan-eye')}Проверить датчики двери и дыма; панель не заменяет сигнализацию</li>
   <li>${I('wifi-off')}Проверить потерю связи и восстановление без ложных состояний</li>
   <li>${I('camera')}Отдельно проверить Tapo и доступные функции Дуо Макс</li>
   <li>${I('heater')}Насос и котёл оставлены заблокированными</li>
  </ul><p class="setting-help">Этот список является планом приёмки, а не заявлением, что интеграции уже настроены.</p>`;
 return `<div class="eyebrow">Для настройки и обслуживания</div><h2>Технический раздел</h2><p class="description">Отдельно от повседневного управления. Это не защищённая админка.</p>
  <div class="settings-tabs tech-tabs" role="tablist">${tabs.map(([id,title])=>`<button role="tab" aria-selected="${techTab===id}" class="${techTab===id?'active':''}" data-tech-tab="${id}">${title}</button>`).join('')}</div>
  ${techMessage?`<div class="inline-note tech-message" role="status">${esc(techMessage)}</div>`:''}${content}`;
}
function houseProfileReview(){
 const devices=state.devices.filter(d=>houseBindings[d.id]&&state.bindings[d.id]?.entityId===houseBindings[d.id]);
 return `<section class="house-profile"><h3>Профиль твоего дома</h3><p class="setting-help">${state.houseProfileConfirmed?'Профиль уже подтверждён. Повторная проверка доступна здесь; недоступные датчики не означают, что дом не подключён.':'Проверь соответствия перед первым включением управления.'} Температура, влажность и батарейки гостиной, чердака и скважины — через Yandex Station. Дверь — через Xiaomi Gateway 3. Сценарии Алисы не меняются.</p>
 <details><summary>Проверить соответствия · ${devices.length}</summary><div class="profile-mappings">${devices.map(d=>`<div><strong>${esc(areaName(d.room))} · ${esc(d.name)}</strong><code>${esc(state.bindings[d.id].entityId)}</code></div>`).join('')}</div></details>
 <p class="setting-help">Кнопка ниже подтверждает выбранные соответствия, проверяет доступность и включает рабочий режим. Недоступные сущности останутся заблокированы. Команды устройствам не отправляются; существующие другие привязки не заменяются.</p>
 <button class="primary full-width" data-action="house-activate" ${disabled(!state.haConfigured||hasPending()||state.profileBusy)}>Подтвердить привязки и включить HA</button></section>`;
}
function openTechnical(tab='connection'){
 settingsOpen=false;state.techOpen=true;techTab=tab;techMessage='';bindingDraft={};bindingOutcome={};$('#sheet-content').dataset.station='';
 modal(technical());$('.sheet').classList.add('settings-sheet');state.techOpen=true;
 loadTechOnvif();
}
function updateTechnical({keepForm=true}={}){
 if(!state.techOpen)return;
 // Any re-render (other actions, profile check) keeps what the owner typed but has not saved.
 if(keepForm&&techTab==='bindings')captureBindingDraft();
 if(keepForm&&techTab==='connection')captureCamDraft();
 $('#sheet-content').innerHTML=technical();icons();
}
async function fullscreen(){
 try{
  if(document.fullscreenElement)await document.exitFullscreen();
  else if(document.documentElement.requestFullscreen)await document.documentElement.requestFullscreen();
  else throw new Error();
 }catch{toast('В этом превью полный экран недоступен. При локальном запуске используй кнопку или F11.')}
}
function captureBindingDraft(){
 $('.sheet')?.querySelectorAll('[data-binding]').forEach(el=>{
  const id=el.dataset.binding;bindingDraft[id]={entityId:el.value.trim(),verified:$('.sheet').querySelector(`[data-verified="${id}"]`)?.checked===true};
 });
}
function formBinding(id){return bindingDraft[id]||state.bindings[id]}
// What HA reports for an entity right now, independent of the verified flag.
function haEntity(entityId){return state.entityStates[entityId]||techEntities.find(e=>e.entity_id===entityId)}
function haKnown(){return Object.keys(state.entityStates).length>0||techEntities.length>0}
function bindingHealth(b){
 const f=formBinding(b.id);
 if(!f.entityId)return {kind:'empty',text:'Не привязано'};
 if(!haKnown())return {kind:'unknown',text:'Состояние HA ещё не загружено'};
 const e=haEntity(f.entityId);
 if(!e)return {kind:'bad',text:'Не найдена в Home Assistant — вероятно, сменился entity_id'};
 if(['unknown','unavailable',''].includes(e.state))return {kind:'offline',text:'В HA есть, но сейчас недоступна'};
 const problem=bindingProblem(b.device,e);
 if(problem)return {kind:'bad',text:'Не подходит: '+problem};
 return {kind:'ok',text:`На связи · ${e.state}${e.attributes?.unit_of_measurement?' '+e.attributes.unit_of_measurement:''}`};
}
// Unbound, currently available entities of a compatible type, best name match first.
function bindingSuggestions(b){
 const pool=Object.keys(state.entityStates).length?Object.values(state.entityStates):techEntities;
 const used=new Set(bindingDefinitions(state.devices).filter(x=>x.id!==b.id).map(x=>formBinding(x.id)?.entityId).filter(Boolean));
 const words=String(b.device.name+' '+areaName(b.device.room)).toLowerCase().split(/[^а-яёa-z0-9]+/).filter(w=>w.length>3).map(w=>w.slice(0,5));
 const score=e=>{const n=(e.entity_id+' '+(e.attributes?.friendly_name||'')).toLowerCase();return words.filter(w=>n.includes(w)).length};
 return pool.filter(e=>!used.has(e.entity_id)&&!['unknown','unavailable',''].includes(e.state)&&!bindingProblem(b.device,e))
  .filter(e=>score(e)>0).sort((x,y)=>score(y)-score(x)).slice(0,3);
}
function bindingCard(b){
 const f=formBinding(b.id),h=bindingHealth(b),o=bindingOutcome[b.id];
 const suggest=['bad','offline','empty'].includes(h.kind)&&b.device.status==='installed'&&haKnown()?bindingSuggestions(b):[];
 return `<fieldset class="binding-card" data-health="${h.kind}"><legend>${esc(b.name)}</legend>
  <p class="setting-help">${deviceTypes[b.type].label} · ${b.device.status==='planned'?'планируется':deviceTypes[b.type].locked?'только наблюдение':'установлено'}</p>
  <label class="setting-field compact">Сущность Home Assistant<input data-binding="${b.id}" list="ha-entities" placeholder="${b.domains.join(' / ')} · пока не привязано" value="${esc(f.entityId)}" autocomplete="off" spellcheck="false"/></label>
  <p class="binding-health">${esc(h.text)}</p>
  ${suggest.length?`<div class="binding-suggest"><span>Доступные варианты:</span>${suggest.map(e=>`<button class="text-button" data-suggest="${b.id}" data-entity="${esc(e.entity_id)}" title="${esc(e.attributes?.friendly_name||'')}">${esc(e.entity_id)}</button>`).join('')}</div>`:''}
  <label class="check-field"><input type="checkbox" data-verified="${b.id}" ${f.verified?'checked':''} ${disabled(b.device.status==='planned')}/>Соответствие проверено на месте</label>
  ${o?`<p class="binding-outcome" data-kind="${o.kind}">${esc(o.text)}</p>`:''}
 </fieldset>`;
}
function bindingSummary(){
 const defs=bindingDefinitions(state.devices).filter(b=>b.device.status==='installed');
 if(!haKnown())return '<p class="setting-help">Нажми «Загрузить сущности», чтобы увидеть состояние каждой привязки.</p>';
 const problems=defs.map(b=>({b,h:bindingHealth(b)})).filter(x=>['bad','offline'].includes(x.h.kind));
 if(!problems.length)return '<div class="inline-note">Все привязанные сущности на связи.</div>';
 return `<div class="binding-problems"><strong>Требуют внимания: ${problems.length}</strong>${problems.map(({b,h})=>`<button class="text-button" data-binding-jump="${b.device.room}">${esc(b.name)} — ${esc(h.kind==='offline'?'недоступна':'не найдена или не подходит')}</button>`).join('')}</div>`;
}
async function saveBindings(){
 if(hasPending())return;
 captureBindingDraft();
 const next=preferences();
 for(const [id,b] of Object.entries(bindingDraft))if(next.bindings[id])next.bindings[id]=b;
 const old=preferences(),wanted=structuredClone(bindingDraft);
 try{
  validatePreferences(next);applyPreferences(next);
  const result=await flushStorage();
  bindingOutcome={};
  for(const r of result.rejected||[])bindingOutcome[r.id]={kind:'bad',text:'Отметка не сохранена: '+r.problem+'. Entity_id сохранён.'};
  for(const r of result.offline||[])bindingOutcome[r.id]={kind:'offline',text:'Отметка сохранена. Данные появятся, когда устройство выйдет на связь в HA.'};
  bindingDraft={};
  const bad=(result.rejected||[]).length,off=(result.offline||[]).length;
  techMessage=bad?`Сохранено. У ${bad} привязок отметка не принята — причина в карточке.`:off?`Сохранено. ${off} сейчас недоступны в HA, отметки оставлены.`:'Привязки сохранены.';
  // Keep the last HA snapshot so card health does not blink while polling restarts.
  if(Object.keys(state.entityStates).length)techEntities=Object.values(state.entityStates);
  toast(techMessage);startLive(refresh);refresh();updateTechnical({keepForm:false});
 }catch(error){
  applyPreferences(old);bindingDraft=wanted;
  techMessage='Не сохранено: '+error.message+' Введённое в форме не потеряно.';
  toast(techMessage);updateTechnical({keepForm:false});
 }
}
function downloadSettings(){
 const blob=new Blob([JSON.stringify({format:'home-panel',version:3,preferences:preferences()},null,2)],{type:'application/json'});
 const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download='home-panel-settings.json';a.hidden=true;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
}
function downloadProfile(){
 const name='home-panel-profile-'+new Date().toISOString().slice(0,10).replace(/-/g,'')+'.json';
 api('profile/export',{raw:true}).then(blob=>{
  const url=URL.createObjectURL(blob),a=document.createElement('a');a.href=url;a.download=name;a.hidden=true;document.body.append(a);a.click();a.remove();setTimeout(()=>URL.revokeObjectURL(url),1000);
  toast('Копия профиля сохранена.');
 }).catch(error=>toast(error.message));
}
function openSettings(tab='panel'){
 state.settingsTab=tab;settingsOpen=true;$('#sheet-content').dataset.station='';
 modal(settings());$('.sheet').classList.add('settings-sheet');settingsOpen=true;
}
function updateSettings(){
 if(!settingsOpen)return;
 const label=document.activeElement?.getAttribute('aria-label'),id=document.activeElement?.id;
 $('#sheet-content').innerHTML=settings();icons();
 const target=id?$('#'+id):[...$('.sheet').querySelectorAll('button')].find(b=>b.getAttribute('aria-label')===label);
 if(target&&!target.disabled)target.focus({preventScroll:true});
}
function about(){
 settingsOpen=false;modal(`<h2>Красиво. И честно.</h2><p class="description">${isLive()?'Рабочий режим. Управление доступно только проверенным сущностям.':'Демонстрационный режим. Реальные устройства не затрагиваются.'}</p>
 <ul><li>Настройки сохраняются в SQLite локального сервера. Состояния устройств не сохраняются как актуальные.</li><li>При обычном HTTP-сервере без backend работает только макет, без сохранения.</li><li>У температур есть источник и время пакета.</li><li>3D загружается по требованию и не отрисовывается постоянно.</li><li>Размеры и мебель условные.</li><li>Насос и газовый котёл заблокированы.</li><li>Станция и камера требуют отдельной проверки интеграций на месте.</li></ul>`);
}
function applyNight(){
 const time=new Intl.DateTimeFormat('en-GB',{hour:'numeric',minute:'2-digit',hourCycle:'h23',timeZone:PANEL_TIMEZONE}).format(Date.now());
 const [h,m]=time.split(':').map(Number);
 if(applyNight.hour!==h){applyNight.hour=h;modelAPI?.setModelTime(h)}
 const minute=h*60+m;
 const night=isNight(minute,state.nightStart,state.nightEnd,state.nightMode);
 if(document.documentElement.dataset.night!==String(night))document.documentElement.dataset.night=String(night);
 // 3.3.3 «Плавная автояркость»: интенсивность димма из nightDim (линейный вход
 // за 60 мин после nightStart и спад за 60 мин до nightEnd), обновляется тиком.
 const dim=nightDim(minute,state.nightStart,state.nightEnd,state.nightMode);
 document.documentElement.style.setProperty('--night-dim',String(dim));
 const status=$('#night-status');if(status)status.textContent=nightLabel(minute,state.nightStart,state.nightEnd,state.nightMode);
}
function updateClocks(){
 for(const id of ['clock','idle-clock','hero-clock'])if($('#'+id))$('#'+id).textContent=clock();
 for(const id of ['date','idle-date','hero-date'])if($('#'+id))$('#'+id).textContent=date();
 updateHeroTime();
 $('#idle-climate').textContent=noConnection()||sensors.living.quality==='unavailable'||sensors.well.quality==='unavailable'?'Датчики недоступны':sensorStatus('living')==='Данные устарели'||sensorStatus('well')==='Данные устарели'?'Показания устарели':`Гостиная ${reading(sensors.living.value)}°  ·  Скважина ${reading(sensors.well.value)}°  ·  ${isLive()?'Home Assistant':'демоданные'}`;
}
function armIdle(){
 clearTimeout(idleTimer);clearTimeout(ambientTimer);
 if(state.idle||document.hidden||!state.idleSeconds||cameraPlayer)return;
 idleTimer=setTimeout(()=>{if(hasPending()){armIdle();return}enterIdle()},state.idleSeconds*1000);
}
// Волна 2 «Тишина»: глубокая ступень после экрана ожидания. Тонально гаснет всё,
// остаются только огромные тонкие часы, дата и одна строка температуры.
function enterAmbient(){
 if(!state.idle||state.ambientMode===false)return;
 if(!shouldAmbient({enabled:true,idleSeconds:AMBIENT_AFTER_IDLE,lastActivity:idleAt,now:Date.now()}))return;
 document.body.classList.add('is-ambient');
 for(const id of ['idle-place','idle-hint'])$('#'+id)?.setAttribute('aria-hidden','true');
 updateClocks();
}
function exitAmbient(){
 document.body.classList.remove('is-ambient');
 for(const id of ['idle-place','idle-hint'])$('#'+id)?.removeAttribute('aria-hidden');
}
function enterIdle(){
 if(hasPending()){toast('Сначала дождёмся подтверждения команды.');return}
 closeModal();state.idle=true;clearTimeout(idleTimer);updateClocks();
 $('#idle-screen').style.setProperty('--hero-image',state.heroURL?`url('${state.heroURL}')`:'url(assets/interior.webp)');
 $('#idle-screen').hidden=false;$('.shell').inert=true;$('#overlay').inert=true;modelAPI?.setModelPaused(true);$('#idle-screen').focus();
 exitAmbient();idleAt=Date.now();clearTimeout(ambientTimer);
 if(state.ambientMode!==false&&state.idleSeconds)ambientTimer=setTimeout(enterAmbient,AMBIENT_AFTER_IDLE*1000);
}
function wake(){
 state.idle=false;$('#idle-screen').hidden=true;$('.shell').inert=false;$('#overlay').inert=false;
 clearTimeout(ambientTimer);exitAmbient();
 modelAPI?.setModelPaused(false);$('#standby').focus({preventScroll:true});armIdle();
}
function simpleSheet(content){settingsOpen=false;$('#sheet-content').dataset.station='';modal(content)}

async function dispatchAction(e){
 const b=e.target.closest('button');if(!b){
  // Клик мимо мини-карточки закрывает её; тап по сцене мог только что открыть/сменить карточку.
  if(activeRoomCard&&state.view==='home'&&!e.target.closest('#home-room-card')&&(!e.target.closest('#canvas')||Date.now()-cardGuard>80)){activeRoomCard=null;paintRoomCard()}
  return;
 }
 if(b.dataset.view)return navigate(b.dataset.view);
 if(b.dataset.historyHours){historyState.hours=Number(b.dataset.historyHours);historyState.data=null;loadStatistics(true);return}
 if(b.dataset.historyMetric){historyState.metric=b.dataset.historyMetric;paintStatistics();return}
 if(b.dataset.historyZone){historyState.room=b.dataset.historyZone;return navigate('statistics')}
 if(b.dataset.digestOpen){activeRoomCard=null;paintRoomCard();return navigate(b.dataset.digestOpen==='sensors'?'watch':'engineering')}
 if(b.classList.contains('digest-action')&&b.dataset.room){activeRoomCard=null;paintRoomCard();return openRoom(b.dataset.room)}
 if(b.dataset.room)return openRoom(b.dataset.room);
 if(b.dataset.sensor)return simpleSheet(`<div data-climate-sheet="${esc(b.dataset.sensor)}">${sensorSheet(b.dataset.sensor)}</div>`);
 if(b.dataset.duoTab){
  clearDuoResult();duoUI.tab=b.dataset.duoTab;duoUI.confirm=null;duoUI.tool=null;paintDuo();$('.sheet').scrollTop=0;
  if(duoUI.tab==='shopping')loadDuoList();return;
 }
 if(b.dataset.duoTool){clearDuoResult();duoUI.tool=b.dataset.duoTool;paintDuo();return}
 if(b.hasAttribute('data-duo-back')){clearDuoResult();duoUI.tool=null;paintDuo();return}
 if(b.hasAttribute('data-duo-cancel')){duoUI.confirm=null;paintDuo();return}
 if(b.hasAttribute('data-duo-list-reload'))return loadDuoList();
 if(b.dataset.duoComplete)return runDuo('shoppingComplete',{uid:b.dataset.duoComplete});
  if(b.dataset.scenario)return handleScenarioClick(b.dataset.scenario);

 if(b.dataset.duoExecute)return runDuo(b.dataset.duoExecute,{confirmed:true});
 if(b.dataset.duoAction){
  const action=b.dataset.duoAction;
  if(b.dataset.duoConfirm){clearDuoResult();duoUI.confirm=action;paintDuo();return}
  return runDuo(action,action==='announce'?{text:duoUI.draft}:action==='timer'?{minutes:duoUI.timer}:action==='shoppingAdd'?{item:duoUI.item}:{});
 }
 if(b.hasAttribute('data-duo-save')){
  const settings={leakAlerts:$('#duo-leaks').checked,doorAlerts:$('#duo-doors').checked,doorMinutes:Number($('#duo-door-minutes').value),quietNight:$('#duo-quiet').checked,volume:Number($('#duo-alert-volume').value)/100,cameraName:$('#duo-camera-name').value};
  if(duoUI.busy)return;duoUI.busy=true;paintDuo();
  try{await api('assistant/settings',{method:'PUT',body:settings});duoUI.settingsDraft=null;duoUI.message='Настройки сохранены на сервере. Оповещения не зависят от открытой вкладки.';duoUI.phase='confirmed';duoUI.error=''}
  catch(error){duoUI.error=error.message}
  finally{duoUI.busy=false;paintDuo();await refreshDuo();if(duoOpen())$('.sheet').scrollTop=0}return;
 }
 if(b.dataset.camera)return cameraSheet(b.dataset.camera);
 if(b.dataset.cameraStart)return cameraStart(b.dataset.cameraStart);
 if(b.dataset.cameraHls)return cameraStart(b.dataset.cameraHls,'hls');
 if(b.dataset.cameraFrame)return cameraFrame(b.dataset.cameraFrame,b);
 if(b.dataset.editDevice){catalogEdit=b.dataset.editDevice;techMessage='';updateTechnical();return}
 if(b.dataset.orderDevice){
  const next=preferences(),i=next.devices.findIndex(d=>d.id===b.dataset.orderDevice),j=i+Number(b.dataset.step);
  if(j>=0&&j<next.devices.length){[next.devices[i],next.devices[j]]=[next.devices[j],next.devices[i]];commitCatalog(next)}return;
 }
 if(b.dataset.deleteDevice){
  const d=state.devices.find(d=>d.id===b.dataset.deleteDevice);if(!d)return;
  techMessage=`Удалить «${d.name}» и его привязку? Это не удалит устройство из Home Assistant.`;
  $('#sheet-content').innerHTML=`<h2>Удалить устройство?</h2><p class="description">${esc(techMessage)}</p><div class="sheet-actions"><button class="primary" data-confirm-delete="${d.id}">Удалить из панели</button><button class="secondary" data-action="catalog-back">Отмена</button></div>`;icons();return;
 }
 if(b.dataset.confirmDelete){
  const next=preferences();next.devices=next.devices.filter(d=>d.id!==b.dataset.confirmDelete);delete next.bindings[b.dataset.confirmDelete];next.deviceModel=detachChannel(next.deviceModel,b.dataset.confirmDelete);return commitCatalog(next);
 }
 if(b.dataset.editEquipment){equipmentEdit=b.dataset.editEquipment;techMessage='';updateTechnical();return}
 if(b.dataset.dissolveEquipment){
  const next=preferences();next.deviceModel.groups=next.deviceModel.groups.filter(g=>g.id!==b.dataset.dissolveEquipment);
  return saveEquipmentModel(next);
 }
 if(b.dataset.settingsTab){state.settingsTab=b.dataset.settingsTab;updateSettings();return}
 if(b.dataset.techTab){captureBindingDraft();techTab=b.dataset.techTab;techMessage='';updateTechnical();return}
 if(b.dataset.suggest){
  captureBindingDraft();const id=b.dataset.suggest;
  bindingDraft[id]={entityId:b.dataset.entity,verified:false};delete bindingOutcome[id];
  techMessage='Подставлено. Проверь на месте, отметь галочку и сохрани.';updateTechnical({keepForm:false});
  $(`[data-binding="${CSS.escape(id)}"]`)?.focus();return;
 }
 if(b.dataset.bindingJump){captureBindingDraft();bindingRoom=b.dataset.bindingJump;updateTechnical();return}
 if(b.dataset.favorite){
  const id=b.dataset.favorite,i=state.favorites.indexOf(id);
  if(i>=0)state.favorites.splice(i,1);else if(state.favorites.length<6)state.favorites.push(id);
  persist();if(state.view==='home')render();updateSettings();return;
 }
 if(b.dataset.move){
  const i=state.favorites.indexOf(b.dataset.move),j=i+Number(b.dataset.step);
  if(j>=0&&j<state.favorites.length)[state.favorites[i],state.favorites[j]]=[state.favorites[j],state.favorites[i]];
  persist();if(state.view==='home')render();updateSettings();return;
 }
 if(b.dataset.device){
  const c=channel(b.dataset.device);
  if(c&&!hasPending())command(c.id,!c.on);return;
 }
 if(b.dataset.color&&!hasPending())return command('rgb:color',b.dataset.color);
 if(b.dataset.retry&&!hasPending()){
  const c=commandFor(b.dataset.retry);if(c)return command(c.id,c.value);return;
 }
 const a=b.dataset.action;
 if(b.dataset.shoppingComplete)return shoppingMutate('complete',b.dataset.shoppingComplete);
 if(b.hasAttribute('data-alarm-confirm')||b.hasAttribute('data-alarm-cancel')||b.dataset.alarmService)return alarmAction(b);
 if(a==='shopping-add')return shoppingMutate('add',$('#shopping-input')?.value||'');
 if(a==='shopping-refresh')return loadShopping();
 if(b.dataset.ttsPreset){const i=$('#tts-text');if(i){i.value=b.dataset.ttsPreset;const c=$('#tts-count');if(c)c.textContent=b.dataset.ttsPreset.length+'/100'}return}
 if(a==='tts-send')return sendTTS();
 if(a==='weather-forecast'){state.view='weather';render();return;}
 if(a==='model-retry'){state.modelError='';render(false);return}
 if(b.hasAttribute('data-forecast-reload'))return; // щиток прогноза заменён страницей «Погода» (3.4.4)
  if(b.hasAttribute('data-energy-reload'))return; // кнопку обновления обрабатывает Preact-виджет
  if(b.dataset.energyReadingDel){
   state.energy_readings=state.energy_readings.filter(r=>r.date!==b.dataset.energyReadingDel);
   techMessage='Показание удалено.';persist();updateTechnical({keepForm:false});return;
  }
  if(a==='camera-add'){
   const list=Array.isArray(state.yardCameras)?state.yardCameras:[];
   state.yardCameras=[...list,{name:'Камера '+(list.length+1),host:'',port:2020,user:'',pass:'',enabled:true}];
   camDraft=[];persist();updateTechnical({keepForm:false});return;
  }
  if(a==='camera-del'){
   const i=Number(b.dataset.camDel);
   state.yardCameras=(Array.isArray(state.yardCameras)?state.yardCameras:[]).filter((_,x)=>x!==i);
   camDraft=[];techMessage='Камера удалена.';persist();updateTechnical({keepForm:false});return;
  }
  if(a==='camera-discover'){
   const btn=b;btn.disabled=true;btn.textContent='Ищем…';
   (async()=>{
    try{
     const r=await api('onvif-discover',{method:'POST'});
     const known=new Set((state.yardCameras||[]).map(c=>c.host+':'+(c.port||2020)));
     const fresh=(r.cameras||[]).filter(c=>!known.has(c.host+':'+c.port));
     if(!fresh.length){toast((r.cameras||[]).length?'Новые камеры не найдены — найденные уже в списке.':'Камеры не найдены'+(r.error?': '+r.error:'.'))}
     else{
      const list=Array.isArray(state.yardCameras)?state.yardCameras:[];
      state.yardCameras=[...list,...fresh.map((c,x)=>({name:'Камера '+(list.length+x+1),host:c.host,port:c.port,user:'',pass:'',enabled:true}))];
      camDraft=[];techMessage='Найдено камер: '+fresh.length+'.';persist();
     }
    }catch(error){toast('Поиск не удался: '+error.message)}
    updateTechnical({keepForm:false});
   })();
   return;
  }
  if(a==='energy-reading-add'){
   const date=$('#energy-reading-date')?.value||'',value=Number($('#energy-reading-value')?.value);
   try{
    state.energy_readings=sanitizeEnergyReadings([...state.energy_readings,{date,value}]);
    techMessage='Показание сохранено.';persist();
   }catch(error){techMessage=error.message}
   updateTechnical({keepForm:false});return;
  }

 if(a==='events-filter'){
  const f=b.dataset.filter;
  if(f===eventsFilter)return;
  eventsFilter=f;
  const node=$('[data-events-list]');
  if(node)node.innerHTML=eventsListMarkup(eventsRows.filter(r=>eventsFilter==='all'||r.type===eventsFilter));
  const filters=$('[data-events-filters]');
  if(filters)filters.innerHTML=eventsFilterMarkup(eventsFilter,eventsRows);
  icons();
  return;
 }
 if(a==='events-reload')return loadEvents(true);
 if(a==='events-open'){state.view='events';render();return}
 if(a==='guard-sheet')return openGuardSheet();
 if(a==='guard-arm'||a==='guard-disarm'||a==='guard-cancel'){
  const action=a==='guard-arm'?'arm':a==='guard-disarm'?'disarm':'cancel-exit';
  try{
   await api('guard',{method:'POST',body:{action}});
   if(action==='arm'){state.guardArmedAway=true;toast('Уход: охрана через '+(state.guardExitDelay||120)+' с')}
   else{state.guardArmedAway=false;toast(action==='cancel-exit'?'Выход отменён':'Охрана снята')}
   guardData=null;loadGuardChip();closeModal();
  }catch(error){toast(error.message)}
  return;
 }
 if(a==='yard-open'){state.view='yard';render();return}
 if(a==='history-reload')return loadStatistics(true);
 if(a==='history-focus-clear'){historyState.focus=null;paintStatistics();return}
 if(a==='active-lights'){simpleSheet(`<div data-lights-overview>${lightOverviewSheet()}</div>`);return}
 if(a==='motion'){
  const id=b.dataset.motionId||'terrace-motion';
  simpleSheet(`<div data-motion-sheet="${esc(id)}">${motionSheetMarkup(id)}</div>`);return;
 }
 if(a==='master')return master();
 if(a==='new-equipment'){equipmentEdit='new';techMessage='';updateTechnical();return}
 if(a==='equipment-back'){equipmentEdit=null;techMessage='';updateTechnical();return}
 if(a==='save-equipment'){
  const next=preferences(),g=equipmentFromForm($('.sheet'),next,equipmentEdit,'unit-'+deviceId());
  const index=next.deviceModel.groups.findIndex(x=>x.id===g.id);
  if(index<0)next.deviceModel.groups.push(g);else next.deviceModel.groups[index]=g;
  return saveEquipmentModel(next);
 }
 if(a==='house-review')return openTechnical('connection');
 if(a==='corridor-binding'){bindingRoom='corridor';return openTechnical('bindings')}
 if(a==='house-activate'){
  if(state.profileBusy||hasPending())return;
  state.profileBusy=true;techMessage='Проверяем сущности профиля…';updateTechnical();
  (async()=>{
   try{
    await flushStorage();
    const result=await api('house-profile',{method:'POST',body:{}});
    applyPreferences(result.preferences);startLive(refresh);render(false);
    const failed=result.report.filter(r=>!r.ok);
    techMessage=`На связи ${result.report.length-failed.length} / ${result.report.length}. Команды не отправлялись.`+(failed.length?' Требуют внимания: '+failed.map(r=>`${r.name} — ${r.problem}${r.kept?', отметка сохранена':''}`).join('; ')+'. Подробности и замена — во вкладке «Привязки».':'');
   }catch(error){techMessage=error.message}
   finally{state.profileBusy=false;updateTechnical()}
  })();return;
 }
 if(a==='camera-stop')return cameraStop();
 if(a==='camera-fullscreen')return cameraFullscreen();
 if(a==='catalog')return openTechnical('catalog');
 if(a==='new-device'){catalogEdit='new';techMessage='';updateTechnical();return}
 if(a==='catalog-back'){catalogEdit=null;techMessage='';updateTechnical();return}
 if(a==='save-device')return saveDevice();
 if(a==='model')return navigate('model');
 if(a==='allrooms')return navigate('rooms');
 if(a==='close-room-card'){activeRoomCard=null;paintRoomCard();return}
 if(a==='favorites')return openSettings('favorites');
 if(a==='cancel')return closeModal();
 if(a==='standby')return enterIdle();
 if(a==='about')return about();
 if(a==='technical')return openTechnical();
 if(a==='fullscreen')return fullscreen();
 if(a==='save-bindings')return saveBindings();
 if(a==='export')return downloadSettings();
 if(a==='profile-export')return downloadProfile();
 if(a==='discover'){
  techMessage='Загружаем список…';updateTechnical();
  captureBindingDraft();discover().then(result=>{techEntities=result.states;techMessage=`Получено ${techEntities.length} сущностей. Проверь соответствие физическим устройствам.`;updateTechnical()})
   .catch(error=>{techMessage=error.message;updateTechnical()});return;
 }
 if(a==='reconnect'){startLive(refresh);techMessage=isLive()?'Проверяем связь…':'Выбран деморежим. Подключение к дому не выполняется.';updateTechnical();return}
  if(a==='health-sheet')return openHealth();
  if(b.hasAttribute('data-health-reload'))return loadHealth();
  if(b.hasAttribute('data-health-snapshot')){
   healthSnapshotMsg='Сохраняем снимок…';paintHealth();
   api('profile-snapshot',{method:'POST'})
    .then(r=>{healthSnapshotMsg='Снимок сохранён · всего снимков '+(r.saved??'?');paintHealth()})
    .catch(error=>{healthSnapshotMsg='Снимок не сохранён: '+error.message;paintHealth()});
   return;
  }
 if(a==='save-photo'){
  if(!photoBlob)return;
  savePhoto(photoBlob).then(()=>{toast('Фото сохранено в локальную базу этого компьютера.');photoBlob=null;refresh()}).catch(error=>toast(error.message));return;
 }
 if(a==='rgb'&&!hasPending())return command('rgb:on',!state.rgbOn);
 if(a==='confirm-master')return masterConfirm();
 if(a==='fail-next'&&!isLive()){state.failNext=true;updateTechnical();return}
 if(a==='reset-photo'){
  const clear=()=>{if(state.heroURL)URL.revokeObjectURL(state.heroURL);state.heroURL=null;photoBlob=null;state.photoSaved=false;if(state.view==='home')render();updateSettings()};
  if(state.photoStored)removePhoto().then(clear).catch(error=>toast(error.message));else clear();return;
 }
 if(a==='station')return openDuo();
 if(a==='station-play'&&!hasPending())return command('station:playing',!state.stationPlaying);
 if(['station-next','station-previous'].includes(a)&&!hasPending()){
  const id=a==='station-next'?'station:next':'station:previous';
  return command(id,true).then(ok=>{if(!ok)toast(commandFor(id)?.message||'Переключение недоступно')});
 }
 if(a==='pump')return simpleSheet(`<h2>Насос тёплого пола</h2><p class="description">Yeelight подаёт или отключает питание. Две карточки в Алисе не означают два насоса.</p>
 <div class="inline-note">Привязка канала не проверена. Управление заблокировано; подача питания не подтверждает работу насоса.</div>
 <div class="control-row"><h3>После проверки на месте</h3><button class="toggle" disabled aria-label="Насос недоступен"><span class="toggle-track"></span></button></div>`);
 if(a==='door')return simpleSheet(`<h2>Входная дверь</h2><p class="description">${binaryLabel('door','Открыта','Закрыта')}. ${isLive()?'Данные только из проверенной сущности Home Assistant.':'Это демонстрационное состояние.'}</p>`);
 if(a==='terrace-door')return simpleSheet(`<h2>Дверь на террасу</h2><p class="description">${binaryLabel('terrace-door','Открыта','Закрыта')}. Датчик открытия висит на двери между гостиной и террасой. ${isLive()?'Данные только из проверенной сущности Home Assistant.':'Это демонстрационное состояние.'}</p>`);
 if(a==='leak'){
  const d=state.devices.find(x=>x.id===(b.dataset.leakId||'leak:utility'));
  const place=d?.id==='leak:bath'?'в ванной':'в котельной у туалета';
  return simpleSheet(`<h2>${esc(d?.name||'Протечка')}</h2><p class="description">${binaryLabel(d?.id||'leak:utility','Тревога','Сухо')}. Датчик Яндекса лежит ${place}. ${isLive()?'Данные только из проверенной сущности Home Assistant.':'Это демонстрационное состояние.'}</p>
  <div class="inline-note">Проверь срабатывание вручную: намочи контакты датчика и убедись, что состояние меняется.</div>`);
 }
 if(a==='camera')return openYardCamera();
 if(a==='yard-clip')return openYardClipSheet(b);
 if(b.dataset.blockToggle){toggleBlock(b.dataset.blockToggle);return}
 if(b.id==='reset-model')return modelAPI?.resetModel();
}
document.addEventListener('change',async e=>{
 if(e.target.id==='history-room'){historyState.room=e.target.value;paintStatistics();return}
 // селектор типа событий удалён вместе со старым блоком «События» (3.6.1)
 const id=e.target.id;
 if(id==='brightness')return command('rgb:brightness',+e.target.value);
 // Мини-слайдер яркости линии (3.3.0): data-bright = `${id}/brightness`.
 // Если линия выключена — сначала включаем, потом яркость (удобнее, чем блок).
 if(e.target.dataset.bright){
  const brightId=e.target.dataset.bright,key=brightId.slice(0,-'/brightness'.length),c=channel(key);
  if(!c)return;
  const turn=!c.on?command(c.id,true):null;
  (turn||Promise.resolve()).then(ok=>{if(ok!==false)return command(brightId,parseBrightness(e.target.value))});
  return;
 }
 if(id==='station-volume'){stationAdjusting=false;return command('station:volume',+e.target.value)}
 if(id==='idle-setting'){state.idleSeconds=+e.target.value;armIdle();persist()}
 if(id==='ambient-setting'){state.ambientMode=e.target.checked;if(state.idle&&!state.ambientMode)exitAmbient();persist()}
 if(id==='auto-theme-setting'){state.autoTheme=e.target.checked;autoThemeZone=null;persist();applyAutoTheme();updateThemeButton();updateTechnical();return}
  if(id==='yard-onvif-setting'){state.yard_onvif_enabled=e.target.checked;persist();updateTechnical();return}
 if(e.target.dataset.camField){
  const i=+e.target.dataset.camIdx,c=(state.yardCameras||[])[i];
  if(!c)return;
  const f=e.target.dataset.camField;
  if(f==='enabled')c.enabled=e.target.checked;
  else if(f==='port')c.port=Number(e.target.value)||2020;
  else c[f]=e.target.value;
  if(f==='enabled'){persist();updateTechnical()}
  return;
 }
  if(id==='energy-tariff'){
   try{state.energy_tariff=sanitizeEnergyTariff(e.target.value===''?null:Number(e.target.value));persist()}
   catch(error){e.target.value=state.energy_tariff==null?'':state.energy_tariff;toast(error.message)}
   return;
  }
 if(id==='night-setting'){state.nightMode=e.target.value;applyNight();persist()}
 if(id==='guard-setting'){state.guardNight=e.target.value;persist();refresh()}
 if(id==='guard-away-minutes'||id==='guard-exit-delay'){
  const v=Math.round(Number(e.target.value));
  const ok=id==='guard-away-minutes'?(v>=1&&v<=30):(v>=0&&v<=600);
  if(!ok){toast(id==='guard-away-minutes'?'Сирена через: от 1 до 30 минут.':'Секунды на выход: от 0 до 600.');return}
  if(id==='guard-away-minutes')state.guardAwayMinutes=v;else state.guardExitDelay=v;
  persist();
 }
 if(id==='guard-flash-setting'){state.guardFlash=e.target.checked;persist()}
 if(id==='guard-master-setting'){state.guardMasterArms=e.target.checked;persist()}
 if(id==='guard-entity'){
  const v=e.target.value.trim();
  if(v&&!/^(input_boolean|switch)\.[a-z0-9_]+$/.test(v)){toast('Сущность охраны: input_boolean.* или switch.*');return}
  state.guardEntity=v;persist();
 }
 if(id==='guard-minutes'){
  const v=Math.round(Number(e.target.value));
  if(!Number.isInteger(v)||v<5||v>120){toast('Минуты открытия двери: от 5 до 120.');e.target.value=state.guardDoorMinutes||15;return}
  state.guardDoorMinutes=v;persist();refresh();
 }
 if(id==='night-start'||id==='night-end'){
  const v=e.target.value;
  if(!isTime(v))return;
  const other=id==='night-start'?state.nightEnd:state.nightStart;
  if(v===other){toast('Начало и конец ночи не должны совпадать.');e.target.value=id==='night-start'?state.nightStart:state.nightEnd;return}
  if(id==='night-start')state.nightStart=v;else state.nightEnd=v;
  applyNight();persist();
 }
 if(id==='kiosk-setting'){state.kiosk=e.target.value==='on';applyAppearance();persist()}
 if(id==='network-setting'&&!isLive()){state.demoOffline=e.target.value==='offline';refresh();updateTechnical()}
 if(id==='station-setting'&&!isLive()){state.stationMode=e.target.value;refresh();updateTechnical()}
 if(id==='binding-room'){captureBindingDraft();bindingRoom=e.target.value;techMessage='';updateTechnical()}
 if(e.target.dataset.binding){
  const box=$('.sheet').querySelector(`[data-verified="${e.target.dataset.binding}"]`);if(box)box.checked=false;
 }
 if(id==='mode-setting'){
  if(hasPending())return;
  const old=state.mode;state.mode=e.target.value;
  try{await flushStorage();state.commands.clear();state.commandHistory=[];state.stationMode='unconfigured';state.demoOffline=false;startLive(refresh);applyAppearance();refresh();updateTechnical()}
  catch(error){state.mode=old;techMessage=error.message;updateTechnical()}
 }
 if(id==='import-settings'){
  const file=e.target.files?.[0];if(!file||hasPending())return;
  const old=preferences();
  try{
   if(file.size>131072)throw new Error('Копия должна быть меньше 128 КБ.');
   const parsed=JSON.parse(await file.text());
   if(parsed.format!=='home-panel'||parsed.version!==3)throw new Error('Нужна копия панели v3.');
   applyPreferences(validatePreferences(parsed.preferences,{importing:true}));await flushStorage();
   state.commands.clear();state.demoOffline=false;state.stationMode='unconfigured';startLive(refresh);applyAppearance();refresh();
   techMessage='Настройки восстановлены. Включён деморежим; все привязки нужно проверить заново.';updateTechnical();
  }catch(error){applyPreferences(old);techMessage='Импорт отменён: '+error.message;updateTechnical()}
 }
 if(id==='hero-upload'){
  const file=e.target.files?.[0];if(!file)return;
  if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>10*1024*1024){toast('Выбери JPEG, PNG или WebP до 10 МБ.');return}
  const url=URL.createObjectURL(file),image=new Image();image.src=url;
  try{await image.decode()}catch{URL.revokeObjectURL(url);toast('Не удалось прочитать изображение. Старое фото сохранено.');return}
  if(image.naturalWidth*image.naturalHeight>24000000){URL.revokeObjectURL(url);toast('Фото слишком большое. Уменьши его до 24 мегапикселей.');return}
  const canvas=document.createElement('canvas'),scale=Math.min(1,2048/Math.max(image.naturalWidth,image.naturalHeight));
  canvas.width=Math.round(image.naturalWidth*scale);canvas.height=Math.round(image.naturalHeight*scale);
  canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);
  const compressed=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',.85));
  if(!compressed||compressed.size>2*1024*1024){URL.revokeObjectURL(url);toast('Не удалось уменьшить фото до 2 МБ. Выбери другое.');return}
  if(state.heroURL)URL.revokeObjectURL(state.heroURL);
  URL.revokeObjectURL(url);state.heroURL=URL.createObjectURL(compressed);photoBlob=compressed;state.photoSaved=false;
  if(state.view==='home')render();updateSettings();toast('Фото пока только во вкладке. Для сохранения есть отдельная кнопка.');
 }
});
document.addEventListener('input',e=>{
 if(e.target.id.startsWith('duo-'))clearDuoResult();
 if(e.target.id==='duo-message')duoUI.draft=e.target.value;
 if(e.target.id==='duo-item')duoUI.item=e.target.value;
 if(e.target.id==='duo-minutes')duoUI.timer=Number(e.target.value);
 if(duoOpen()&&duoUI.tab==='settings'&&e.target.id.startsWith('duo-')&&$('#duo-leaks')){
  duoUI.settingsDraft={leakAlerts:$('#duo-leaks').checked,doorAlerts:$('#duo-doors').checked,doorMinutes:Number($('#duo-door-minutes').value),quietNight:$('#duo-quiet').checked,volume:Number($('#duo-alert-volume').value)/100,cameraName:$('#duo-camera-name').value};
 }
 if(e.target.id==='equipment-filter'){
  const query=e.target.value.trim().toLowerCase();
  $('.sheet').querySelectorAll('[data-equipment-option]').forEach(el=>{el.hidden=!el.dataset.search.includes(query)});
 }
 if(e.target.id==='brightness')$('#brightness-label').textContent=e.target.value+' % · ещё не отправлено';
 // Оптимистичный показ % мини-слайдера линии (3.3.0) — до подтверждения от HA.
 if(e.target.dataset.bright){
  const lab=e.target.closest('.mini-bright')?.querySelector('[data-bright-label]');
  if(lab)lab.textContent=parseBrightness(e.target.value)+' %';
 }
 if(e.target.id==='station-volume'){stationAdjusting=true;$('#station-volume-label').textContent=e.target.value+' % · ещё не отправлено'}
 if(e.target.id==='tts-text'){const c=$('#tts-count');if(c)c.textContent=e.target.value.length+'/100'}
});
document.addEventListener('keydown',e=>{if(e.key==='Enter'&&e.target?.id==='shopping-input'){e.preventDefault();shoppingMutate('add',e.target.value||'')}});
$('.brand').onclick=e=>{e.preventDefault();navigate('home')};
document.addEventListener('pointermove',e=>{if(state.view==='statistics')inspectHistoryChart(e)});
document.addEventListener('keydown',e=>{
 if(state.view==='statistics')inspectHistoryChart(e);
});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&activeRoomCard&&state.view==='home'&&$('#overlay').hidden){activeRoomCard=null;paintRoomCard()}});
let historyResizeTimer;
window.addEventListener('resize',()=>{clearTimeout(historyResizeTimer);if(state.view==='statistics')historyResizeTimer=setTimeout(paintStatistics,150)});
let guardPressTimer=null,guardLong=false;
$('#master').addEventListener('pointerdown',()=>{
 guardLong=false;
 if(!(isLive()&&state.guardMasterArms!==false))return;
 guardPressTimer=setTimeout(()=>{guardLong=true;toast(state.guardArmedAway?'Длинное нажатие: снимаем охрану…':'Длинное нажатие: охрана уже снята')},600);
});
$('#master').addEventListener('pointerup',()=>clearTimeout(guardPressTimer));
$('#master').addEventListener('pointercancel',()=>clearTimeout(guardPressTimer));
$('#master').addEventListener('click',async()=>{
 if(isLive()&&state.guardMasterArms!==false){
  if(guardLong){guardLong=false;await guardDisarm();return}
  if(state.guardArmedAway){toast('Охрана активна · длинное нажатие — снять');return}
  await guardArm();return;
 }
 master();
});
async function guardArm(){
 try{
  const r=await api('guard',{method:'POST',body:{action:'arm'}});
  state.guardArmedAway=true;toast('Уход: охрана через '+r.exitDelay+' с');refresh();
 }catch(error){toast(error.message)}
}
async function guardDisarm(){
 try{
  await api('guard',{method:'POST',body:{action:'disarm'}});
  state.guardArmedAway=false;toast('Охрана снята');refresh();
 }catch(error){toast(error.message)}
}$('#info').onclick=()=>openSettings();
$('#standby').onclick=enterIdle;$('#idle-screen').onclick=e=>{e.preventDefault();e.stopPropagation();wake()};
$('#theme').onclick=()=>{
 if(state.autoTheme&&terraceLux()!==null){toast('Температура темы задаётся освещённостью террасы.');return}
 state.theme=state.theme==='dark'?'light':'dark';document.documentElement.dataset.theme=state.theme;
 $('#theme').innerHTML=I(state.theme==='dark'?'sun':'moon');icons();persist();
 if(state.view==='statistics')paintStatistics();
};
$('.close').onclick=closeModal;
// Тап-устойчивость: на некоторых планшетах click после pointer-событий не доходит.
document.addEventListener('pointerup',e=>{if(e.target?.closest?.('.sheet .close'))closeModal()});
let lastPointerDown=0;
document.addEventListener('pointerdown',()=>{lastPointerDown=Date.now()},{passive:true});
$('#overlay').addEventListener('click',e=>{if(e.target===$('#overlay'))closeModal()});
 // Тап-устойчивый ввод: физические указатели обрабатываются на pointerup — DOM-перерисовка под пальцем не убивает действие. click остаётся для клавиатуры (detail=0).
 let pointerDownAt=null,lastActionButton=null,lastActionTime=0;
 document.addEventListener('pointerdown',e=>{pointerDownAt={x:e.clientX,y:e.clientY,btn:e.target.closest('button')}},{passive:true});
 document.addEventListener('pointerup',e=>{
  const moved=pointerDownAt&&Math.hypot(e.clientX-pointerDownAt.x,e.clientY-pointerDownAt.y)>10;
  let b=pointerDownAt?.btn;if(b&&!b.isConnected)b=null;
  if(!b&&!moved&&Number.isFinite(e.clientX))b=document.elementFromPoint(e.clientX,e.clientY)?.closest('button');
  if(!b){
   if(!moved&&activeRoomCard&&state.view==='home'&&!e.target.closest('#home-room-card')&&(!e.target.closest('#canvas')||Date.now()-cardGuard>80)){activeRoomCard=null;paintRoomCard()}
   pointerDownAt=null;return;
  }
  if(moved){pointerDownAt=null;return}
  const now=Date.now();if(b===lastActionButton&&now-lastActionTime<600){pointerDownAt=null;return}
  lastActionButton=b;lastActionTime=now;pointerDownAt=null;
  return dispatchAction({target:b});
 });
 document.addEventListener('click',e=>{if(e.detail>0)return;return dispatchAction(e)});
document.addEventListener('keydown',e=>{
 if(state.idle){if(['Enter',' ','Escape'].includes(e.key)){e.preventDefault();wake()}return}
 if($('#overlay').hidden)return;
 if(e.key==='Escape')closeModal();
 if(e.key==='Tab'){
  const all=[...$('.sheet').querySelectorAll('button:not(:disabled),input:not(:disabled),select,a[href]')],first=all[0],last=all[all.length-1];
  if(!$('.sheet').contains(document.activeElement)){e.preventDefault();(e.shiftKey?last:first).focus()}
  else if(e.shiftKey&&document.activeElement===first){e.preventDefault();last.focus()}
  else if(!e.shiftKey&&document.activeElement===last){e.preventDefault();first.focus()}
 }
});
for(const event of ['pointerdown','keydown','wheel','input','change'])document.addEventListener(event,()=>{if(!state.idle)armIdle()},{passive:true});
// «Тишина»: движение мыши будит только из ambient-ступени.
document.addEventListener('mousemove',()=>{if(state.idle&&document.body.classList.contains('is-ambient'))wake()},{passive:true});
document.addEventListener('visibilitychange',()=>{if(document.hidden){clearTimeout(idleTimer);if(cameraPlayer)cameraStop()}else armIdle()});
window.addEventListener('pagehide',clearCamera);
bindScenarioPainter(refresh);
// Редактор пользовательских сценариев: тот же sheet, сохранение через preferences.
bindScenarioHost({
 openSheet:simpleSheet,closeSheet:closeModal,icons,
 commit:async next=>{
  const old=preferences();
  try{applyPreferences(next);await flushStorage();refresh();return true}
  catch(error){applyPreferences(old);toast('Сценарий не сохранён: '+error.message);return false}
 }
});

setInterval(()=>{updateClocks();applyNight();if(state.view==='home'&&!state.idle&&!hasPending())refresh()},10000);
$('#main').innerHTML='<div class="boot-state" role="status">Подготавливаем твою панель…</div>';
loadStorage().then(()=>{applyAppearance();startLive(refresh);render();updateClocks();armIdle();window.__homePanelReady=true});

// Общие хелперы для вынесенных в волне 5 модулей (shopping.js / alarm.js / weather-sheet.js).
// Циклический импорт безопасен: модули используют их только внутри функций во время работы.
export {$,I,icons,toast,simpleSheet,updateRegion};
