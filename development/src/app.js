import {deviceId} from './compat.js';
import {
 createIcons,House,Box,Lightbulb,Power,ScanEye,SlidersHorizontal,Sun,Moon,X,ArrowRight,ArrowUpRight,
 AudioLines,Camera,ChevronRight,CircleCheck,DoorClosed,Droplets,Heater,Leaf,Radio,RotateCcw,Thermometer,
 Trees,Archive,Armchair,Bath,BedDouble,Blocks,DoorOpen,MoveUpRight,Sofa,MoonStar,Star,ChevronUp,
 ChevronDown,Check,LoaderCircle,TriangleAlert,WifiOff,Play,Pause,SkipBack,SkipForward,ChartNoAxesCombined,Volume2,ImagePlus,Settings2,Info,Maximize,Minimize,Download,Upload
} from 'lucide';
import {rooms,state,getRoom,countLights,channelsFor,sensors} from './schema.js';
import {sendCommand,commandFor,hasPending} from './commands.js';
import {preferences,loadStorage,saveStorage,flushStorage,savePhoto,removePhoto,applyPreferences} from './storage.js';
import {bindingDefinitions,validatePreferences} from './preferences.js';
import {isLive,canControl,observed,startLive,discover,readiness} from './live.js';
import {areas,areaName,deviceTypes,sensorTypes,samePhysicalDevice} from './catalog.js';
import {api} from './api.js';
import {startCameraPlayer} from './camera-player.js';
import {houseBindings,bindingProblem} from './house-profile.js';
import {stationSupports,stationStateLabel} from './station.js';
import {buildDeviceModel,detachChannel} from './device-model.js';
import {deviceStructure,equipmentFromForm} from './device-model-ui.js';
import {homeSummary} from './home-summary.js';
import {binaryValue,leakIssues} from './sensor-state.js';
import {motionObservation,elapsedLabel} from './motion.js';
import {historyState,statisticsView,inspectHistoryChart} from './history-ui.js';

const $=s=>document.querySelector(s);
const I=name=>`<i data-lucide="${name}"></i>`;
const iconSet={House,Box,Lightbulb,Power,ScanEye,SlidersHorizontal,Sun,Moon,X,ArrowRight,ArrowUpRight,
 AudioLines,Camera,ChevronRight,CircleCheck,DoorClosed,Droplets,Heater,Leaf,Radio,RotateCcw,Thermometer,
 Trees,Archive,Armchair,Bath,BedDouble,Blocks,DoorOpen,MoveUpRight,Sofa,MoonStar,Star,ChevronUp,
 ChevronDown,Check,LoaderCircle,TriangleAlert,WifiOff,Play,Pause,SkipBack,SkipForward,ChartNoAxesCombined,Volume2,ImagePlus,Settings2,Info,Maximize,Minimize,Download,Upload};
const icons=()=>{
 createIcons({icons:iconSet,attrs:{'stroke-width':1.6}});
 const title=$('.sheet h2');if(title)title.id='sheet-title';
};
const esc=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/"/g,'&quot;');
const disabled=value=>value?'disabled':'';
let stationAdjusting=false;
const timeOf=t=>new Intl.DateTimeFormat('ru-RU',{hour:'2-digit',minute:'2-digit',timeZone:'Europe/Moscow'}).format(t);
const clock=()=>timeOf(Date.now());
const date=()=>new Intl.DateTimeFormat('ru-RU',{weekday:'long',day:'numeric',month:'long',timeZone:'Europe/Moscow'}).format(new Date());
const reading=n=>n.toFixed(1).replace('.',',');
let modelAPI=null,modelPromise=null,viewRevision=0,lastFocus=null,toastTimer,idleTimer,settingsOpen=false,photoBlob=null;
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
 document.documentElement.dataset.mode=state.mode;$('#theme').innerHTML=I(state.theme==='dark'?'sun':'moon');applyNight();icons();
}

function toast(message){
 $('#toast').textContent=message;$('#toast').classList.add('visible');
 clearTimeout(toastTimer);toastTimer=setTimeout(()=>$('#toast').classList.remove('visible'),3600);
}
function modal(content,room=null){
 clearCamera();
 $('#overlay').classList.remove('camera-overlay');
 $('.sheet').classList.remove('camera-sheet','settings-sheet');
 $('.sheet').scrollTop=0;
 lastFocus=document.activeElement;$('#sheet-content').innerHTML=content;
 $('#sheet-content').dataset.room=room||'';$('#overlay').hidden=false;icons();$('.close').focus();armIdle();
 $('#sheet-content').scrollTop=0;
}
function closeModal(){
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
 <h2>Станция · ${esc(stationRoom())}</h2><p>${esc(e?.attributes.media_title|| (isLive()?'Музыка и голос · через Home Assistant':demo?'Тестовая карточка станции.':'Голос и музыка.'))}</p>
 <button class="text-button" data-action="station">${isLive()?'Открыть управление':demo?'Открыть демоуправление':'Статус и подключение'} ${I('arrow-up-right')}</button>
 <div class="station-bottom"><span></span>${isLive()?(!state.liveOnline?'Нет связи с HA':esc(stationStateLabel(e))):offline?'Нет связи · демо':demo?(state.stationPlaying?'Воспроизведение · демо':'Пауза · демо'):'Демонстрационный режим'}</div></section>`;
}
function roomCard(r){
 const channels=channelsFor(r),on=channels.filter(c=>c.on).length;
 const unknown=isLive()&&channels.some(c=>!canControl(c.id));
 const subtitle=noConnection()&&channels.length?'Нет связи':unknown?'Есть непроверенные линии':!channels.length?(r.channels.length?'Свет планируется':'Нет линий света'):on?'Свет включён':'Свет выключен';
 return `<button class="room-card ${on&&!state.demoOffline?'lit':''}" data-room="${r.id}">
 <div class="card-top">${I(r.icon)}${channels.length?`<span class="room-status ${noConnection()||unknown?'offline':''}">${noConnection()?I('wifi-off'):unknown?'— / '+channels.length:`${on} / ${channels.length}`}</span>`:''}</div>
 <h3>${r.short}</h3><p>${subtitle}</p></button>`;
}
function quietDoor(){
 const label=binaryLabel('door','Дверь открыта','Дверь закрыта');
 return `<button class="quiet-card" data-action="door"><div class="quiet-info">${I(label==='Нет данных'||noConnection()?'wifi-off':'door-closed')}
 <div><h3>${label}</h3><p>${isLive()?'Xiaomi · '+(observed('door')?'Home Assistant':'не привязан'):'Состояние демонстрационное'}</p></div></div>${I('chevron-right')}</button>`;
}
function home(){
 return `<div class="view dashboard-view">
 <h1 class="visually-hidden">Мой дом</h1>
 <div class="dashboard-layout"><div class="house-column">${sceneStage()}
 <div class="house-status" id="home-status">${homeStatus()}</div></div>
 <aside class="home-context">
 <div class="context-heading quick-heading"><h2>Под рукой</h2></div>
 <div id="home-quick">${homeQuick()}</div>
 <div class="context-heading rooms-heading"><h2>Комнаты</h2><button class="text-button" data-action="favorites" aria-label="Настроить избранные комнаты">${I('sliders-horizontal')}</button></div>
 <div class="favorite-rooms" id="home-favorites">${favoriteRooms()}</div>
 <button class="all-zones-link text-button" data-action="allrooms">Все комнаты и зоны ${I('arrow-up-right')}</button>
 ${!state.preview&&!state.houseProfileConfirmed&&state.devices.some(d=>houseBindings[d.id]===state.bindings[d.id]?.entityId)?'<div class="profile-invite"><div><strong>Профиль ждёт проверки</strong><p>Подтверди привязки перед управлением домом.</p></div><button class="secondary" data-action="house-review">Проверить профиль</button></div>':''}
 </aside></div></div>`;
}
function roomClimate(id){
 return state.devices.filter(d=>d.room===id&&d.status==='installed'&&['temperature','humidity'].includes(d.type))
  .map(d=>`<span class="climate-pill">${I(deviceTypes[d.type].icon)}${esc(deviceReading(d))}</span>`).join('');
}
function favoriteRooms(){
 return state.favorites.length?state.favorites.map(id=>{
  const r=getRoom(id),cs=channelsFor(r),known=!isLive()||cs.every(c=>canControl(c.id)),on=cs.filter(c=>c.on).length;
  return `<button class="favorite-room ${on&&known&&!noConnection()?'is-lit':''}" data-room="${r.id}">
  <span class="favorite-room-title">${I(r.icon)}${esc(r.short)}</span><span class="favorite-room-detail">${compactRoomClimate(id)||(!cs.length?'Без света':noConnection()?'Нет связи':!known?'<span title="Свет временно недоступен">—</span>':on?`${on} из ${cs.length} · вкл.`:'Выключен')}</span></button>`;
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
function homeStatus(){
 const terraceDoor=state.devices.find(d=>d.id==='terrace-door'&&d.status==='installed');
 return `<button class="status-chip" data-action="door" aria-label="Входная дверь: ${esc(binaryLabel('door','открыта','закрыта'))}">${I('door-closed')}${esc(binaryLabel('door','Вход открыт','Вход закрыт'))}</button>
 ${terraceDoor?`<button class="status-chip" data-action="terrace-door" aria-label="Дверь на террасу: ${esc(binaryLabel('terrace-door','открыта','закрыта'))}">${I('door-open')}${esc(binaryLabel('terrace-door','Терраса открыта','Терраса закрыта'))}</button>`:''}
 <button class="status-chip" data-view="watch">${I('thermometer')}Климат</button>
 <button class="status-chip well-chip" data-room="well">${I('droplets')}Скважина ${compactRoomClimate('well')}</button>`;
}
function houseAlerts(){
 return leakIssues(state.devices,{live:isLive(),online:state.liveOnline,read:observed})
  .sort((a,b)=>Number(b.alarm)-Number(a.alarm))
  .map(d=>`<button class="house-alert ${d.alarm?'is-alarm':'is-unavailable'}" data-action="leak" data-leak-id="${esc(d.id)}" ${d.alarm?'role="alert"':''}>${I(d.alarm?'triangle-alert':'wifi-off')}<span><strong>${esc(d.alarm?d.name+'!':'Нет данных · '+d.name)}</strong><small>${d.alarm?'Проверь воду и источник протечки':'Датчик недоступен или его состояние неизвестно'}</small></span>${I('chevron-right')}</button>`).join('');
}
function stationRoom(){return areaName(state.devices.find(d=>d.id==='station')?.room||'corridor')}
function stationSkipButtons(){
 const e=isLive()?observed('station'):null;
 return `<div class="station-skip"><button class="icon-button" data-action="station-previous" aria-label="Предыдущий трек" ${disabled(!isLive()||!stationSupports(e,'previous',true)||hasPending())}>${I('skip-back')}</button>
 <button class="icon-button" data-action="station-next" aria-label="Следующий трек" ${disabled(!isLive()||!stationSupports(e,'next',true)||hasPending())}>${I('skip-forward')}</button></div>`;
}
function homeQuick(){
 const camera=state.devices.find(d=>d.type==='camera'&&d.room==='yard'&&d.status==='installed');
 const media=state.devices.find(d=>d.id==='station'&&d.status==='installed');
 return `<div class="quick-devices">
 <button class="quick-device light-shortcut" data-action="master" ${disabled(masterBlocked())}><span class="quick-device-icon">${I('power')}</span><span><strong>Весь свет</strong><small>Выключить</small></span></button>
 ${camera?`<button class="quick-device camera-shortcut" data-camera="${camera.id}" aria-label="Двор: открыть прямой эфир"><span class="quick-device-icon">${I('camera')}</span><span><strong>Двор</strong><small>Камера</small></span></button>`:''}
 ${media?`<div class="quick-device media-shortcut">
 <button class="quick-device-icon" data-action="station-play" aria-label="${state.stationPlaying?'Пауза на станции':'Продолжить на станции'}" ${disabled(!canControl('station:playing')||hasPending())}>${I(state.stationPlaying?'pause':'play')}</button>
 <button class="media-details" data-action="station" aria-label="Станция · ${esc(stationRoom())}: открыть управление"><strong>Музыка</strong><small title="${esc(observed('station')?.attributes?.media_title||stationRoom())}">${esc(observed('station')?.attributes?.media_title||stationRoom())}</small></button>
 ${stationSkipButtons()}</div>`:''}
 </div>`;
}
function sceneStage(){
 return `<section class="model-stage spatial-stage"><canvas id="canvas" aria-label="Интерактивная объёмная модель дома"></canvas>
 <div id="model-loading" class="model-loading">${I('loader-circle')}Загружаем план дома</div>
 <div class="model-top"><span id="model-name">${state.view==='room'?esc(getRoom(state.selected).short):'Первый этаж'}</span><button id="reset-model" title="Вернуть исходный ракурс" aria-label="Сбросить ракурс">${I('rotate-ccw')}</button></div>
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
 return `<div class="control-group"><div class="control-row"><div><h3>${esc(c.name)}</h3><p>${esc(note||'Планируется')}</p></div>
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
function roomPage(){
 const r=getRoom(state.selected),external=['attic','well','yard'].includes(r.id);
 return `<div class="view room-view"><div class="room-heading"><div><button class="room-back text-button" data-view="home">${I('house')}Мой дом ${I('chevron-right')}</button><h1>${esc(r.name)}</h1></div><div class="room-climate" id="room-climate">${roomClimate(r.id)}</div></div>
 <div class="room-layout"><div class="room-visual-column">${external?`<section class="zone-stage">${I(r.icon)}<h2>${esc(r.short)}</h2><p>Показания и доступность устройств</p><div class="room-climate">${roomClimate(r.id)}</div></section>`:sceneStage()}
 <div class="room-equipment" id="room-equipment">${roomEquipment(r)}</div></div><aside class="room-control-column"><div id="selected-room">${selectedRoom()}</div><details class="room-other-zones"><summary>Другие комнаты</summary>${rooms.filter(x=>x.id!==r.id&&x.id!=='yard').map(x=>`<button data-room="${x.id}">${I(x.icon)}${esc(x.short)}${I('chevron-right')}</button>`).join('')}</details></aside></div></div>`;
}
function roomEquipment(r){
 const cards=logicalSensorCards(r.id);
 return `${state.devices.some(d=>d.id==='station'&&d.room===r.id&&d.status==='installed')?station():''}
 ${cards}${state.devices.filter(d=>d.room===r.id&&['curtain','vacuum'].includes(d.type)).map(sensorCard).join('')}`;
}
function lights(){
 return `<div class="view"><div class="view-title"><div><div class="eyebrow">Управление</div><h1>Свет в доме</h1><p>Выбери комнату. Все линии доступны независимо.</p></div>
 <span class="demo-badge">${state.demoOffline?'Нет связи · демо':lightCountLabel()}</span></div>
 <div class="room-list">${rooms.map(roomCard).join('')}</div><div class="wide-hint"><span>Инженерное оборудование не входит в мастер-свет.</span><button data-action="catalog">Каталог устройств ${I('arrow-right')}</button></div></div>`;
}
function watch(){
 const motion=state.devices.find(d=>d.id==='terrace-motion'&&d.status==='installed');
 const terraceDoor=state.devices.find(d=>d.id==='terrace-door'&&d.status==='installed');
 const leaks=state.devices.filter(d=>d.type==='leak'&&d.status==='installed');
 return `<div class="view"><div class="view-title"><div><div class="eyebrow">Наблюдение</div><h1>Климат и датчики</h1><p>Всё, что сообщает твой дом.</p></div></div>
 <div class="watch-grid"><section class="camera-empty">${I('camera')}<h2>Двор под присмотром</h2>
 <p>Нажми на камеру для прямого эфира. Видео работает только в открытом окне просмотра.</p>
 <div class="module-list">${state.devices.filter(d=>d.type==='camera'&&d.status==='installed').map(d=>`<button class="quiet-card" data-camera="${d.id}"><div class="quiet-info">${I('camera')}<div><h3>${esc(d.name)}</h3><p>${isLive()&&observed(d.id)?'Подключена · прямой эфир':'Установлена · подключение не проверено'}</p></div></div>${I('chevron-right')}</button>`).join('')||'<p>Камеры добавляются через каталог.</p>'}</div></section>
 <aside class="side-stack"><section class="overview-status">
 <div class="status-line"><span>${I('door-closed')}Входная дверь</span><strong>${binaryLabel('door','Открыта','Закрыта')}</strong></div>
 ${terraceDoor?`<div class="status-line"><span>${I('door-open')}Дверь на террасу</span><strong>${binaryLabel('terrace-door','Открыта','Закрыта')}</strong></div>`:''}
 ${leaks.map(d=>`<div class="status-line"><span>${I('droplets')}${esc(d.name)}</span><strong>${binaryLabel(d.id,'Тревога','Сухо')}</strong></div>`).join('')}
 ${state.devices.some(d=>d.id==='smoke'&&d.status==='installed')?`<div class="status-line"><span>${I('radio')}Дым</span><strong>${binaryLabel('smoke','Тревога','Нет тревоги')}</strong></div>`:''}
 ${motion?`<button class="status-line motion-detail" data-action="motion" data-motion-id="${esc(motion.id)}"><span>${I('trees')}Терраса</span><strong>${esc(deviceReading(motion))}</strong></button>`:''}
 ${state.devices.some(d=>d.id==='rgb')?`<div class="status-line"><span>${I('lightbulb')}RGB прихожей</span><strong>${noConnection()?'Нет связи':isLive()&&!observed('hall:0')?'Нет данных':hallPowered()?'Есть питание':'Без питания'}</strong></div>`:''}</section>
 ${climate()}</aside></div>${deviceHealth()}<section class="sensor-catalog"><div class="section-heading"><div><h2>Датчики дома</h2><p>Логические устройства: показания и батарейка вместе</p></div></div><div class="module-grid">${logicalSensorCards()||'<p>Датчики пока не добавлены.</p>'}</div></section>
 ${state.devices.some(d=>['curtain','vacuum'].includes(d.type))?`<section class="sensor-catalog"><div class="section-heading"><div><h2>Новые категории</h2><p>Карнизы и пылесосы: пока только наблюдение, без команд</p></div></div><div class="module-grid">${state.devices.filter(d=>['curtain','vacuum'].includes(d.type)).map(sensorCard).join('')}</div></section>`:''}</div>`;
}
function logicalSensorCards(roomId){
 const byId=new Map(state.devices.map(d=>[d.id,d]));
 return buildDeviceModel(preferences(),state.entityStates,isLive()&&state.liveOnline)
  .map(g=>({...g,components:g.components.filter(c=>sensorTypes.includes(c.type)&&c.installed&&(!roomId||c.room===roomId))}))
  .filter(g=>g.components.some(c=>c.type!=='battery'))
  .map(g=>`<article class="module-card"><div class="title-line"><span>${esc(areaName(g.room))}</span>${I(g.icon)}</div><h3>${esc(g.name)}</h3>
   ${g.components.map(c=>`<div class="status-line"><span>${esc(deviceTypes[c.type].label)}</span><strong>${esc(deviceReading(byId.get(c.id)))}</strong></div>`).join('')}
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
 if(isLive()&&['temperature','humidity','illuminance'].includes(d.type)){
  const reported=Date.parse(e.last_reported||e.last_updated)||0;
  if(Date.now()-reported>30*60*1000)return 'Данные устарели';
 }
 if(type.unit)return Number.isFinite(Number(value))?`${reading(Number(value))} ${type.unit}`:'Нет данных';
 if(d.type==='button_event')return String(value);
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
 return `<article class="module-card"><div class="title-line"><span>${esc(areaName(d.room))}</span>${I(deviceTypes[d.type].icon)}</div><h3>${esc(d.name)}</h3><strong class="module-reading">${esc(deviceReading(d))}</strong><p>${d.status==='planned'?'Будущее устройство':isLive()?'Только проверенные данные HA':'Демонстрационный режим'}${d.demoStale&&!isLive()?' · пример устарел':''}</p></article>`;
}
function engineering(){
 return `<div class="view"><div class="view-title"><div><h1>Инженерия дома</h1><p>Отдельно от света. Пока только наблюдение, без команд оборудованию.</p></div></div><div class="module-grid">${state.devices.filter(d=>deviceTypes[d.type].module==='engineering').map(d=>`<article class="module-card engineering-card"><div class="title-line"><span>${esc(areaName(d.room))}</span>${I(deviceTypes[d.type].icon)}</div><h2>${esc(d.name)}</h2><strong class="module-reading">${esc(deviceReading(d))}</strong><p>${esc(d.note)}</p><div class="inline-note">${d.type==='gate'?'Управление воротами заблокировано. Нужны проверка привода, положения и защиты от препятствий.':d.type==='heating'?'Управление котлом заблокировано. Внешний интерфейс допускается только после проверки документации и специалистом.':'Управление питанием заблокировано. Подача питания не доказывает циркуляцию воды.'}</div></article>`).join('')||'<p>Оборудование добавляется через каталог.</p>'}</div><div class="wide-hint"><span>ESP32 и другие будущие модули подключаются через проверенные сущности Home Assistant.</span><button data-action="catalog">Каталог устройств ${I('arrow-right')}</button></div></div>`;
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
function cameraSheet(id){
 const d=state.devices.find(d=>d.id===id);if(!d)return;
 const e=observed(id),enabled=isLive()&&!state.preview&&d.status==='installed'&&e&&!['unknown','unavailable'].includes(e.state);
 modal(`<div class="eyebrow">${esc(areaName(d.room))}</div><h2>${esc(d.name)}</h2><p class="description">${d.status==='planned'?'Камера ещё не установлена.':'Прямой эфир по запросу. Закрой окно, чтобы остановить просмотр.'}</p><div id="camera-frame" class="camera-frame"><span>${enabled?'Подключаем видео…':'Сначала привяжи и проверь сущность камеры в настройках'}</span></div><p id="camera-status" role="status">${enabled?'Подключаем прямой эфир…':'Подключение камеры ещё не проверено'}</p><div class="camera-actions"><button class="primary" data-camera-start="${id}" ${disabled(!enabled)}>${I('play')}Прямой эфир</button><button class="secondary" data-action="camera-stop" ${disabled(!enabled)}>${I('pause')}Стоп</button><button class="secondary" data-action="camera-fullscreen" ${disabled(!enabled)}>${I('maximize')}На весь экран</button><button class="text-button" data-camera-hls="${id}" ${disabled(!enabled)}>HLS · резерв</button><button class="text-button" data-camera-frame="${id}" ${disabled(!enabled)}>${I('camera')}Снимок</button></div>`);
 $('.sheet').classList.add('camera-sheet');$('#overlay').classList.add('camera-overlay');cameraDevice=id;
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
 const revision=++viewRevision;modelAPI?.disposeModel();
 $('#main').innerHTML=state.view==='home'?home():state.view==='room'?roomPage():state.view==='model'?model():state.view==='rooms'?lights():state.view==='engineering'?engineering():state.view==='statistics'?statisticsView():watch();
 document.documentElement.dataset.view=state.view;
 if(!animate&&$('#main .view'))$('#main .view').style.animation='none';
 document.querySelectorAll('nav button').forEach(b=>{
  const active=b.dataset.view===state.view||(['room','model'].includes(state.view)&&b.dataset.view==='home');
  b.classList.toggle('active',active);if(active)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');
 });
 $('#master').disabled=masterBlocked();updateHeader();storageStatus();icons();
 if(state.view==='statistics')loadStatistics();
 if($('#canvas')){
  modelPromise ||= import('./model.js');
  modelPromise.then(api=>{
   if(revision!==viewRevision||!$('#canvas'))return;
   modelAPI=api;$('#model-loading').hidden=true;
   api.mountModel($('#canvas'),rooms,state,id=>{
    if(state.view==='model'){state.selected=id;updateDetail();api.updateModel(rooms,state)}else openRoom(id);
   });
  }).catch(()=>{if(revision===viewRevision&&$('#model-loading'))$('#model-loading').innerHTML='План недоступен в этом браузере. Все комнаты доступны в разделе «Свет».'});
 }
}
function updateRegion(selector,markup){
 const node=$(selector);if(!node||node.dataset.rendered===markup)return;
 node.innerHTML=markup;node.dataset.rendered=markup;
}
function updateDetail(){
 const editingRange=document.activeElement?.matches('input[type="range"]');
 if($('#selected-room')&&!editingRange)updateRegion('#selected-room',selectedRoom());
 if($('#model-name'))$('#model-name').textContent=state.view==='room'?getRoom(state.selected).short:'Первый этаж';
 if($('#room-climate'))$('#room-climate').innerHTML=roomClimate(state.selected);
 updateRegion('.zone-stage .room-climate',roomClimate(state.selected));
 if($('#room-equipment')&&!editingRange)updateRegion('#room-equipment',roomEquipment(getRoom(state.selected)));
 const id=$('#sheet-content').dataset.room;
 if(!$('#overlay').hidden&&id)$('#sheet-content').innerHTML=roomSheet(getRoom(id));
 icons();
}
function refresh(){
 const focus=document.activeElement?.getAttribute('aria-label');
 if(['home','model','room'].includes(state.view)){
  updateDetail();modelAPI?.updateModel(rooms,state);
  if(state.view==='home'){
   updateRegion('#home-favorites',favoriteRooms());updateRegion('#home-status',homeStatus());updateRegion('#home-quick',homeQuick());
  }
 }else if(state.view!=='statistics')render(false);
 if(!$('#overlay').hidden){
  if(state.techOpen&&techTab==='diagnostics')$('#sheet-content').innerHTML=technical();
  else if(settingsOpen){/* HA polling must not replace an open form or its focus. */}
  else if($('#sheet-content').dataset.station==='true'&&!stationAdjusting)$('#sheet-content').innerHTML=stationSheet();
  else updateDetail();
 }
 $('#master').disabled=masterBlocked();updateHeader();
 updateRegion('#house-alerts',houseAlerts());$('#house-alerts').hidden=!$('#house-alerts').innerHTML;
 document.documentElement.dataset.leakAlert=String(!$('#house-alerts').hidden);
 icons();
 const motionSheet=$('[data-motion-sheet]');
 if(motionSheet)motionSheet.innerHTML=motionSheetMarkup(motionSheet.dataset.motionSheet);
 if(focus){const target=[...document.querySelectorAll('button')].find(b=>b.getAttribute('aria-label')===focus&&!b.disabled);target?.focus({preventScroll:true})}
}
function paintStatistics(){
 if(state.view!=='statistics')return;
 $('#main').innerHTML=statisticsView();icons();
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
 <div class="motion-timestamp"><span>Последнее обновление события</span><strong>${m.at?new Date(m.at).toLocaleString('ru-RU',{timeZone:'Europe/Moscow'}):'Неизвестно'}</strong><small>${m.at?esc(elapsedLabel(m.at)):''}</small></div>
 <p class="description">${m.kind==='unknown'?'Без достоверного состояния или времени не считаем, что движения нет.':'Сущность HA не изменяется. Расчётный статус применяется только в панели.'}</p>`;
}
function roomSheet(r){
 return `<div class="eyebrow">${r.short}</div><h2 style="margin-top:12px">${r.name}</h2><p class="description">${r.description||'Каждая линия управляется отдельно.'}</p>${controls(r)}`;
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
 else{const c=channel(id);if(!c||!canControl(id))return Promise.resolve(false);apply=v=>c.on=v}
 return sendCommand(id,value,apply,refresh);
}
function master(){
 settingsOpen=false;$('#sheet-content').dataset.station='';
 modal(`<h2>Выключить весь свет?</h2><p class="description">${isLive()?'Выключатся только привязанные и проверенные линии света. Это реальные команды Home Assistant.':'Команды выполнятся только в демомакете.'} Результат проверяется по состоянию каждой линии.</p>
 <div class="inline-note">Только линии, включённые в мастер-свет в каталоге. Камера, музыка и датчики не затрагиваются.</div>
 <div class="sheet-actions"><button class="primary" data-action="confirm-master">Выключить</button><button class="secondary" data-action="cancel">Отмена</button></div>`);
}
async function masterConfirm(){
 if(masterBlocked())return;
 closeModal();state.batchPending=true;
 const jobs=rooms.flatMap(r=>r.channels).filter(c=>c.masterOff&&c.on&&!c.planned&&canControl(c.id));
 const results=await Promise.all(jobs.map(c=>command(c.id,false)));
 state.batchPending=false;refresh();
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
 <p class="description">Переключение треков, пауза и громкость доступны при поддержке интеграцией. Команды выполняются станцией в коридоре, не браузером. При потере связи управление блокируется.</p>`;
 return `<h2>Станция · ${esc(stationRoom())}</h2><p class="description">Голос и музыка. Это демонстрационное управление, не настоящая станция.</p>
 <div class="inline-note">${offline?'Нет связи · демонстрация':enabled?'Демоуправление включено для проверки интерфейса. Это не связь с реальной станцией.':'Не подключена к панели. Реальный статус и возможности пока неизвестны.'}</div>
 <div class="control-group"><div class="control-row"><div><h3>Воспроизведение</h3><p>${enabled?(state.stationPlaying?'Играет · демо, без аудиопотока':'Пауза · демо'):'Доступность уточним после интеграции'}</p></div>
 <button class="icon-button" data-action="station-play" aria-label="${state.stationPlaying?'Пауза':'Воспроизвести'}" ${disabled(!enabled||hasPending())}>${I(state.stationPlaying?'pause':'play')}</button></div>${phaseLine('station:playing')}</div>
 <div class="rgb-control"><label for="station-volume">Громкость <span id="station-volume-label">${enabled?state.stationVolume+' % · демо':'Недоступна'}</span></label>
 <input id="station-volume" type="range" min="0" max="100" value="${state.stationVolume}" ${disabled(!enabled||hasPending())}/>${phaseLine('station:volume')}</div>
 <p class="description">Эти функции условно показаны в деморежиме. В рабочей версии появятся только подтверждённые возможности интеграции. Эта веб-панель не предназначена для запуска на экране станции.</p>`;
}
function sensorSheet(id){
 const s=sensors[id],name={living:'Гостиная',well:'Скважина',attic:'Чердак'}[id];
 return `<h2>Температура · ${name}</h2><p class="description">${sensorStatus(id)}</p>
 <div class="sensor-detail">${s.quality==='unavailable'?'—':reading(s.value)} °C <span>${s.humidity===null?'—':s.humidity+' %'} влажности</span></div>
 <div class="inline-note">${isLive()?(s.quality==='unavailable'?'Датчик не привязан или недоступен.':sensorStatus(id)==='Данные устарели'?'Последнее значение устарело.':'Значение из состояния Home Assistant, не независимая проверка датчика.'):'Это демонстрационный пример, не измерение из твоего дома.'}</div>
 <p class="description">${s.receivedAt?'Время пакета: '+new Intl.DateTimeFormat('ru-RU',{dateStyle:'short',timeStyle:'short',timeZone:'Europe/Moscow'}).format(s.receivedAt):'Пакет ещё не получен'}. Источник: ${isLive()?'Home Assistant':'демонстрационный адаптер'}.</p>`;
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
 <label class="setting-field">Ночной интерфейс<select id="night-setting">${[['auto','Автоматически · 22:00–07:00 МСК'],['on','Всегда включён'],['off','Выключен']].map(([v,l])=>`<option value="${v}" ${state.nightMode===v?'selected':''}>${l}</option>`).join('')}</select></label>
 <p class="setting-help">Приглушается оформление панели, не аппаратная яркость планшета. Свет в доме не переключается.</p>
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
 const [r,i]=id.split(':');return (getRoom(r)?.short||r)+' · '+(getRoom(r)?.channels[Number(i)]?.name||'');
}
function updateHeader(){
 const node=$('#connection-badge'),summary=homeLightSummary(),warning=isLive()&&summary.warning;
 const label=warning?summary.label:isLive()?'Home Assistant':'Демонстрационный режим';
 node.innerHTML=`<span></span>${esc(label)}`;node.dataset.warning=String(warning);
 node.title=isLive()?[state.liveError||'Home Assistant',summary.detail].join(' · '):'Реальные устройства не подключены';
 node.setAttribute('aria-label',`${label}. Открыть настройки подключения`);
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
function technical(){
 const ready=readiness();
 const tabs=[['connection','Связь'],['structure','Устройства'],['catalog','Каталог'],['bindings','Привязки'],['diagnostics','Проверка'],['backup','Копия'],['checklist','На месте']];
 let content='';
 if(techTab==='connection')content=`
  ${!state.preview?houseProfileReview():''}
  <div class="connection-status">${I(state.liveOnline?'circle-check':'radio')}<div><h3>${state.liveOnline?'Состояния Home Assistant доступны':state.haConfigured?'Адрес и токен заданы на сервере':'Дом пока не подключён'}</h3><p>${state.preview?'Это приватное демопревью. Доступ к дому в нём отключён.':esc(state.liveError||'Синхронизация раз в 5 секунд')}</p></div></div>
  <label class="setting-field">Источник данных<select id="mode-setting" ${disabled(hasPending())}><option value="demo" ${!isLive()?'selected':''}>Демонстрационный макет</option><option value="live" ${isLive()?'selected':''}>Home Assistant · реальные состояния</option></select></label>
  <div class="inline-note">В рабочем режиме нет подстановки демоданных: до получения состояния линии и датчики недоступны.</div>
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
}
function updateTechnical({keepForm=true}={}){
 if(!state.techOpen)return;
 // Any re-render (other actions, profile check) keeps what the owner typed but has not saved.
 if(keepForm&&techTab==='bindings')captureBindingDraft();
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
 const hour=+new Intl.DateTimeFormat('en-GB',{hour:'numeric',hourCycle:'h23',timeZone:'Europe/Moscow'}).format(Date.now());
 const night=state.nightMode==='on'||state.nightMode==='auto'&&(hour>=22||hour<7);
 document.documentElement.dataset.night=String(night);
}
function updateClocks(){
 for(const id of ['clock','idle-clock'])if($('#'+id))$('#'+id).textContent=clock();
 for(const id of ['date','idle-date'])if($('#'+id))$('#'+id).textContent=date();
 $('#idle-climate').textContent=noConnection()||sensors.living.quality==='unavailable'||sensors.well.quality==='unavailable'?'Датчики недоступны':sensorStatus('living')==='Данные устарели'||sensorStatus('well')==='Данные устарели'?'Показания устарели':`Гостиная ${reading(sensors.living.value)}°  ·  Скважина ${reading(sensors.well.value)}°  ·  ${isLive()?'Home Assistant':'демоданные'}`;
}
function armIdle(){
 clearTimeout(idleTimer);
 if(state.idle||document.hidden||!state.idleSeconds||cameraPlayer)return;
 idleTimer=setTimeout(()=>{if(hasPending()){armIdle();return}enterIdle()},state.idleSeconds*1000);
}
function enterIdle(){
 if(hasPending()){toast('Сначала дождёмся подтверждения команды.');return}
 closeModal();state.idle=true;clearTimeout(idleTimer);updateClocks();
 $('#idle-screen').style.setProperty('--hero-image',state.heroURL?`url('${state.heroURL}')`:'url(assets/interior.webp)');
 $('#idle-screen').hidden=false;$('.shell').inert=true;$('#overlay').inert=true;modelAPI?.setModelPaused(true);$('#idle-screen').focus();
}
function wake(){
 state.idle=false;$('#idle-screen').hidden=true;$('.shell').inert=false;$('#overlay').inert=false;
 modelAPI?.setModelPaused(false);$('#standby').focus({preventScroll:true});armIdle();
}
function simpleSheet(content){settingsOpen=false;$('#sheet-content').dataset.station='';modal(content)}

document.addEventListener('click',e=>{
 const b=e.target.closest('button');if(!b)return;
 if(b.dataset.view)return navigate(b.dataset.view);
 if(b.dataset.historyHours){historyState.hours=Number(b.dataset.historyHours);historyState.data=null;loadStatistics(true);return}
 if(b.dataset.historyMetric){historyState.metric=b.dataset.historyMetric;paintStatistics();return}
 if(b.dataset.room)return openRoom(b.dataset.room);
 if(b.dataset.sensor)return simpleSheet(sensorSheet(b.dataset.sensor));
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
 if(a==='history-reload')return loadStatistics(true);
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
 if(a==='favorites')return openSettings('favorites');
 if(a==='cancel')return closeModal();
 if(a==='standby')return enterIdle();
 if(a==='about')return about();
 if(a==='technical')return openTechnical();
 if(a==='fullscreen')return fullscreen();
 if(a==='save-bindings')return saveBindings();
 if(a==='export')return downloadSettings();
 if(a==='discover'){
  techMessage='Загружаем список…';updateTechnical();
  captureBindingDraft();discover().then(result=>{techEntities=result.states;techMessage=`Получено ${techEntities.length} сущностей. Проверь соответствие физическим устройствам.`;updateTechnical()})
   .catch(error=>{techMessage=error.message;updateTechnical()});return;
 }
 if(a==='reconnect'){startLive(refresh);techMessage=isLive()?'Проверяем связь…':'Выбран деморежим. Подключение к дому не выполняется.';updateTechnical();return}
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
 if(a==='station'){settingsOpen=false;modal(stationSheet());$('#sheet-content').dataset.station='true';return}
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
 if(b.id==='reset-model')return modelAPI?.resetModel();
});
document.addEventListener('change',async e=>{
 if(e.target.id==='history-room'){historyState.room=e.target.value;paintStatistics();return}
 if(e.target.id==='history-event-type'){historyState.eventType=e.target.value;paintStatistics();return}
 const id=e.target.id;
 if(id==='brightness')return command('rgb:brightness',+e.target.value);
 if(id==='station-volume'){stationAdjusting=false;return command('station:volume',+e.target.value)}
 if(id==='idle-setting'){state.idleSeconds=+e.target.value;armIdle();persist()}
 if(id==='night-setting'){state.nightMode=e.target.value;applyNight();persist()}
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
 if(e.target.id==='equipment-filter'){
  const query=e.target.value.trim().toLowerCase();
  $('.sheet').querySelectorAll('[data-equipment-option]').forEach(el=>{el.hidden=!el.dataset.search.includes(query)});
 }
 if(e.target.id==='brightness')$('#brightness-label').textContent=e.target.value+' % · ещё не отправлено';
 if(e.target.id==='station-volume'){stationAdjusting=true;$('#station-volume-label').textContent=e.target.value+' % · ещё не отправлено'}
});
$('.brand').onclick=e=>{e.preventDefault();navigate('home')};
document.addEventListener('pointermove',e=>{if(state.view==='statistics')inspectHistoryChart(e)});
document.addEventListener('keydown',e=>{if(state.view==='statistics')inspectHistoryChart(e)});
let historyResizeTimer;
window.addEventListener('resize',()=>{clearTimeout(historyResizeTimer);if(state.view==='statistics')historyResizeTimer=setTimeout(paintStatistics,150)});
$('#master').onclick=master;$('#info').onclick=()=>openSettings();
$('#standby').onclick=enterIdle;$('#idle-screen').onclick=e=>{e.preventDefault();e.stopPropagation();wake()};
$('#theme').onclick=()=>{
 state.theme=state.theme==='dark'?'light':'dark';document.documentElement.dataset.theme=state.theme;
 $('#theme').innerHTML=I(state.theme==='dark'?'sun':'moon');icons();persist();
 if(state.view==='statistics')paintStatistics();
};
$('#fullscreen').onclick=fullscreen;
document.addEventListener('fullscreenchange',()=>{
 $('#fullscreen').innerHTML=I(document.fullscreenElement?'minimize':'maximize');
 $('#fullscreen').setAttribute('aria-label',document.fullscreenElement?'Выйти из полного экрана':'Полный экран');icons();
});
$('.close').onclick=closeModal;
$('#overlay').addEventListener('click',e=>{if(e.target===$('#overlay'))closeModal()});
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
document.addEventListener('visibilitychange',()=>{if(document.hidden){clearTimeout(idleTimer);if(cameraPlayer)cameraStop()}else armIdle()});
window.addEventListener('pagehide',clearCamera);
setInterval(()=>{updateClocks();applyNight();if(state.view==='home'&&!state.idle&&!hasPending())refresh()},10000);
$('#main').innerHTML='<div class="boot-state" role="status">Подготавливаем твою панель…</div>';
loadStorage().then(()=>{applyAppearance();startLive(refresh);render();updateClocks();armIdle();window.__homePanelReady=true});
