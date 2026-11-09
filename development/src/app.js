import {deviceId} from './compat.js';
import {
 createIcons,House,Box,Lightbulb,Power,ScanEye,SlidersHorizontal,Sun,Moon,X,ArrowRight,ArrowUpRight,Zap,
 AudioLines,Camera,ChevronRight,CircleCheck,DoorClosed,Droplets,Heater,Leaf,Radio,RotateCcw,Thermometer,Shield,
 Trees,Archive,Armchair,Bath,BedDouble,Blocks,DoorOpen,MoveUpRight,Sofa,MoonStar,Star,ChevronUp,
 ChevronDown,Check,LoaderCircle,TriangleAlert,WifiOff,Play,Pause,SkipBack,SkipForward,ChartNoAxesCombined,Volume2,ImagePlus,Settings2,Info,Maximize,Minimize,Download,Upload,Cloud,Cloudy,CloudSun,CloudRain,CloudSnow,CloudFog,CloudLightning,CloudDrizzle,CloudHail,Wind,LogOut,Film,Sparkles
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
import {digestItems} from './digest.js';
import {binaryValue,leakIssues} from './sensor-state.js';
import {motionObservation,elapsedLabel} from './motion.js';
import {historyState,statisticsView,inspectHistoryChart} from './history-ui.js';
import {numericReading,stateTimes} from './readings.js';
import {duoUI,assistantView} from './assistant-ui.js';
import {scenarioChipsRow,handleScenarioClick,bindScenarioPainter,bindScenarioHost} from './scenarios-ui.js';
import {shouldAmbient,AMBIENT_AFTER_IDLE} from './ambient.js';
import {luxValue,autoTheme,AUTO_THEME_UP,AUTO_THEME_DOWN} from './auto-theme.js';
import {energyCard,findMeterEntities} from './energy.js';
import {showYardCard,YARD_REFRESH_MS} from './yard-card.js';

import {esc,disabled,timeOf,clock,date,scheduleMinute,PANEL_TIMEZONE} from './dom.js';
import {voiceButton,voiceSync,bindVoice} from './voice.js';
const $=s=>document.querySelector(s);
const I=name=>`<i data-lucide="${name}"></i>`;
const iconSet={House,Box,Lightbulb,Power,ScanEye,SlidersHorizontal,Sun,Moon,X,ArrowRight,ArrowUpRight,Zap,
 AudioLines,Camera,ChevronRight,CircleCheck,DoorClosed,Droplets,Heater,Leaf,Radio,RotateCcw,Thermometer,Shield,
 Trees,Archive,Armchair,Bath,BedDouble,Blocks,DoorOpen,MoveUpRight,Sofa,MoonStar,Star,ChevronUp,
 ChevronDown,Check,LoaderCircle,TriangleAlert,WifiOff,Play,Pause,SkipBack,SkipForward,ChartNoAxesCombined,Volume2,ImagePlus,Settings2,Info,Maximize,Minimize,Download,Upload,Cloud,Cloudy,CloudSun,CloudRain,CloudSnow,CloudFog,CloudLightning,CloudDrizzle,CloudHail,Wind,LogOut,Film,Sparkles};
const icons=()=>{
 createIcons({icons:iconSet,attrs:{'stroke-width':1.6}});
 // lucide СЃРѕС…СЂР°РЅСЏРµС‚ data-lucide РЅР° СЃРѕР·РґР°РЅРЅС‹С… svg Рё РїРµСЂРµСЃРѕР·РґР°С‘С‚ РёС… РїСЂРё РєР°Р¶РґРѕРј
 // РІС‹Р·РѕРІРµ вЂ” РёР·-Р·Р° СЌС‚РѕРіРѕ РєРЅРѕРїРєР° Р·Р°РјРµРЅСЏР»Р°СЃСЊ РјРµР¶РґСѓ mousedown Рё mouseup Рё Р±СЂР°СѓР·РµСЂ
 // РЅРµ РіРµРЅРµСЂРёСЂРѕРІР°Р» click (Р±Р°Рі В«РєРЅРѕРїРєРё РЅРµ СЂР°Р±РѕС‚Р°СЋС‚В»). РЎРЅСЏРІ Р°С‚СЂРёР±СѓС‚, РґРµР»Р°РµРј
 // РєРѕРЅРІРµСЂС‚Р°С†РёСЋ РѕРґРЅРѕСЂР°Р·РѕРІРѕР№: svg Р±РѕР»СЊС€Рµ РЅРёРєРѕРіРґР° РЅРµ РїРµСЂРµСЃРѕР·РґР°СЋС‚СЃСЏ РїРѕРґ РїР°Р»СЊС†РµРј.
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
 if(!isLive())return state.demoOffline?'РќРµС‚ СЃРІСЏР·Рё':state.devices.some(d=>d.id===id&&d.status==='installed')?`${off} В· РґРµРјРѕ`:'РќРµС‚ РґР°РЅРЅС‹С…';
 const e=observed(id),type=state.devices.find(d=>d.id===id)?.type;
 const value=binaryValue(type,e?.state);return value===true?on:value===false?off:'РќРµС‚ РґР°РЅРЅС‹С…';
};
function storageStatus(){
 const node=$('#storage-status');if(node){node.textContent=state.storageMessage;node.className='storage-status '+state.storage}
 const footer=$('#footer-storage');if(footer){footer.textContent=state.storage==='saved'?'РќР°СЃС‚СЂРѕР№РєРё СЃРѕС…СЂР°РЅРµРЅС‹':state.storageMessage;footer.title=state.storageMessage}
 const bar=$('.shell>footer');if(bar)bar.dataset.storage=state.storage;
}
function persist(){saveStorage(storageStatus);storageStatus()}
function applyAppearance(){
 document.documentElement.dataset.theme=state.theme;document.documentElement.dataset.kiosk=String(state.kiosk);
 document.documentElement.dataset.mode=state.mode;$('#theme').innerHTML=I(state.theme==='dark'?'sun':'moon');applyNight();icons();updateThemeButton();
}
// РђРІС‚Рѕ-С‚РµРјР° РїРѕ РѕСЃРІРµС‰С‘РЅРЅРѕСЃС‚Рё С‚РµСЂСЂР°СЃС‹: С‡РёСЃС‚РѕРµ СЂРµС€РµРЅРёРµ РІ auto-theme.js, Р·РґРµСЃСЊ вЂ”
// С‚РѕР»СЊРєРѕ С‡С‚РµРЅРёРµ РїСЂРёРІСЏР·РєРё Рё РїСЂРёРјРµРЅРµРЅРёРµ. Р СѓС‡РЅРѕР№ РїРµСЂРµРєР»СЋС‡Р°С‚РµР»СЊ Р±Р»РѕРєРёСЂСѓРµС‚СЃСЏ С‡РµСЃС‚РЅРѕ.
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
 const label=locked?`РђРІС‚Рѕ РїРѕ РѕСЃРІРµС‰С‘РЅРЅРѕСЃС‚Рё В· ${Math.round(lux)} Р»Рє`:'РџРµСЂРµРєР»СЋС‡РёС‚СЊ С‚РµРјСѓ';
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
 if(isLive()&&!state.liveOnline)return 'РќРµС‚ РґР°РЅРЅС‹С… Рѕ СЃРІРµС‚Рµ';
 if(isLive()){
  const channels=rooms.flatMap(r=>r.channels.filter(c=>!c.planned));
  const unknown=channels.filter(c=>!canControl(c.id)).length;
  return unknown?`Р’РєР»СЋС‡РµРЅРѕ: ${countLights()} В· Р±РµР· РґР°РЅРЅС‹С…: ${unknown}`:`Р’РєР»СЋС‡РµРЅРѕ: ${countLights()} В· РІСЃРµ Р»РёРЅРёРё РґРѕСЃС‚СѓРїРЅС‹`;
 }
 const n=countLights();return `${n} ${n%10===1&&n%100!==11?'Р»РёРЅРёСЏ РІРєР»СЋС‡РµРЅР°':n%10>=2&&n%10<=4&&!(n%100>=12&&n%100<=14)?'Р»РёРЅРёРё РІРєР»СЋС‡РµРЅС‹':'Р»РёРЅРёР№ РІРєР»СЋС‡РµРЅРѕ'}`;
}
function sensorStatus(id){
 const s=sensors[id];if(noConnection())return isLive()?'РќРµС‚ СЃРІСЏР·Рё СЃ Home Assistant':'РќРµС‚ СЃРІСЏР·Рё В· РґРµРјРѕ';
 if(s.quality==='unavailable')return 'РќРµС‚ РґР°РЅРЅС‹С…';
 if(isLive()){
  const d=state.devices.find(d=>d.type==='temperature'&&d.room===id&&d.status==='installed');
  const times=stateTimes(d?observed(d.id):null);
  return times.updatedAt?'РЎРѕСЃС‚РѕСЏРЅРёРµ HA РѕР±РЅРѕРІР»РµРЅРѕ '+elapsedLabel(times.updatedAt):'Р’СЂРµРјСЏ РѕР±РЅРѕРІР»РµРЅРёСЏ HA РЅРµРёР·РІРµСЃС‚РЅРѕ';
 }
 return s.quality==='stale'||Date.now()-s.receivedAt>30*60*1000?'Р”Р°РЅРЅС‹Рµ СѓСЃС‚Р°СЂРµР»Рё':(isLive()?'Home Assistant В· ':'Р”РµРјРѕРїР°РєРµС‚ В· ')+timeOf(s.receivedAt);
}
function climate(){
 const s=sensors.living,stale=sensorStatus('living')==='Р”Р°РЅРЅС‹Рµ СѓСЃС‚Р°СЂРµР»Рё';
 return `<section class="climate"><div class="title-line"><span>РўРµРјРїРµСЂР°С‚СѓСЂР° РіРѕСЃС‚РёРЅРѕР№</span>${I('thermometer')}</div>
 <div class="reading"><strong>${noConnection()||stale||s.quality==='unavailable'?'вЂ”':reading(s.value)}</strong><span>В°C</span></div>
 <div class="humidity">${I('droplets')}${noConnection()||s.humidity===null?'вЂ”':s.humidity+' %'} В· ${sensorStatus('living')}</div>
 <div class="subreadings"><button class="sensor-row" data-sensor="well"><span>РЎРєРІР°Р¶РёРЅР°</span><strong>${noConnection()||sensors.well.quality==='unavailable'?'РќРµС‚ РґР°РЅРЅС‹С…':sensorStatus('well')==='Р”Р°РЅРЅС‹Рµ СѓСЃС‚Р°СЂРµР»Рё'?'Р”Р°РЅРЅС‹Рµ СѓСЃС‚Р°СЂРµР»Рё':reading(sensors.well.value)+'В°'}</strong></button>
 <button class="sensor-row" data-sensor="attic"><span>Р§РµСЂРґР°Рє</span><strong>${noConnection()||sensors.attic.quality==='unavailable'?'РќРµС‚ РґР°РЅРЅС‹С…':sensorStatus('attic')==='Р”Р°РЅРЅС‹Рµ СѓСЃС‚Р°СЂРµР»Рё'?'Р”Р°РЅРЅС‹Рµ СѓСЃС‚Р°СЂРµР»Рё':reading(sensors.attic.value)+'В°'}</strong></button></div></section>`;
}
function station(){
 const demo=!isLive()&&state.stationMode==='demo',offline=!isLive()&&(state.stationMode==='offline'||state.demoOffline);
 const e=isLive()?observed('station'):null;
 return `<section class="station-card"><div class="station-top"><span class="eyebrow">Р“РѕР»РѕСЃ РґРѕРјР°</span>${I('audio-lines')}</div>
 <h2>РЎС‚Р°РЅС†РёСЏ В· ${esc(stationRoom())}${state.stationPlaying?' <span class="eq-bars" aria-hidden="true"><i></i><i></i><i></i></span>':''}</h2><p>${esc(e?.attributes.media_title|| (isLive()?'РњСѓР·С‹РєР° Рё РіРѕР»РѕСЃ В· С‡РµСЂРµР· Home Assistant':demo?'РўРµСЃС‚РѕРІР°СЏ РєР°СЂС‚РѕС‡РєР° СЃС‚Р°РЅС†РёРё.':'Р“РѕР»РѕСЃ Рё РјСѓР·С‹РєР°.'))}</p>
 <button class="text-button" data-action="station">${isLive()?'РћС‚РєСЂС‹С‚СЊ СѓРїСЂР°РІР»РµРЅРёРµ':demo?'РћС‚РєСЂС‹С‚СЊ РґРµРјРѕСѓРїСЂР°РІР»РµРЅРёРµ':'РЎС‚Р°С‚СѓСЃ Рё РїРѕРґРєР»СЋС‡РµРЅРёРµ'} ${I('arrow-up-right')}</button>
 <div class="station-bottom"><span></span>${isLive()?(!state.liveOnline?'РќРµС‚ СЃРІСЏР·Рё СЃ HA':esc(stationStateLabel(e))):offline?'РќРµС‚ СЃРІСЏР·Рё В· РґРµРјРѕ':demo?(state.stationPlaying?'Р’РѕСЃРїСЂРѕРёР·РІРµРґРµРЅРёРµ В· РґРµРјРѕ':'РџР°СѓР·Р° В· РґРµРјРѕ'):'Р”РµРјРѕРЅСЃС‚СЂР°С†РёРѕРЅРЅС‹Р№ СЂРµР¶РёРј'}</div></section>`;
}
function roomCard(r){
 const channels=channelsFor(r),on=channels.filter(c=>c.on).length;
 const unknown=isLive()&&channels.some(c=>!canControl(c.id));
 const subtitle=noConnection()&&channels.length?'РќРµС‚ СЃРІСЏР·Рё':unknown?'Р•СЃС‚СЊ РЅРµРїСЂРѕРІРµСЂРµРЅРЅС‹Рµ Р»РёРЅРёРё':!channels.length?(r.channels.length?'РЎРІРµС‚ РїР»Р°РЅРёСЂСѓРµС‚СЃСЏ':'РќРµС‚ Р»РёРЅРёР№ СЃРІРµС‚Р°'):on?'РЎРІРµС‚ РІРєР»СЋС‡С‘РЅ':'РЎРІРµС‚ РІС‹РєР»СЋС‡РµРЅ';
 return `<button class="room-card ${on&&!state.demoOffline?'lit':''}" data-room="${r.id}">
 <div class="card-top">${I(r.icon)}${channels.length?`<span class="room-status ${noConnection()||unknown?'offline':''}">${noConnection()?I('wifi-off'):unknown?'вЂ” / '+channels.length:`${on} / ${channels.length}`}</span>`:''}</div>
 <h3>${r.short}</h3><p>${subtitle}</p></button>`;
}
function quietDoor(){
 const label=binaryLabel('door','Р”РІРµСЂСЊ РѕС‚РєСЂС‹С‚Р°','Р”РІРµСЂСЊ Р·Р°РєСЂС‹С‚Р°');
 return `<button class="quiet-card" data-action="door"><div class="quiet-info">${I(label==='РќРµС‚ РґР°РЅРЅС‹С…'||noConnection()?'wifi-off':'door-closed')}
 <div><h3>${label}</h3><p>${isLive()?'Xiaomi В· '+(observed('door')?'Home Assistant':'РЅРµ РїСЂРёРІСЏР·Р°РЅ'):'РЎРѕСЃС‚РѕСЏРЅРёРµ РґРµРјРѕРЅСЃС‚СЂР°С†РёРѕРЅРЅРѕРµ'}</p></div></div>${I('chevron-right')}</button>`;
}
function heroStatusChip(){
 const online=isLive()&&state.liveOnline,offline=isLive()&&!state.liveOnline;
 const label=offline?`РќРµС‚ СЃРІСЏР·Рё${state.liveError?' В· '+state.liveError:''}`:online?'Home Assistant В· РћРЅР»Р°Р№РЅ':'Р”РµРјРѕ В· Р±РµР· Home Assistant';
 return `<button class="hero-status-chip ${offline?'is-offline':''}" data-action="house-review" title="${esc(isLive()?[state.liveError||'Home Assistant','РџСЂРѕРІРµСЂРёС‚СЊ РїРѕРґРєР»СЋС‡РµРЅРёРµ'].join(' В· '):'Р РµР°Р»СЊРЅС‹Рµ СѓСЃС‚СЂРѕР№СЃС‚РІР° РЅРµ РїРѕРґРєР»СЋС‡РµРЅС‹')}" aria-label="${esc(label)}: РѕС‚РєСЂС‹С‚СЊ РЅР°СЃС‚СЂРѕР№РєРё РїРѕРґРєР»СЋС‡РµРЅРёСЏ"><span class="hero-dot"></span>${esc(label)}</button>`;
}
function dayProgress(){
 const e=Object.values(state.entityStates||{}).find(e=>e.entity_id==='sun.sun');
 const dawn=e?.attributes?.next_dawn,dusk=e?.attributes?.next_dusk;
 if(!dawn||!dusk)return '';
 const now=Date.now(),a=Date.parse(dawn),b=Date.parse(dusk);
 if(![a,b].every(Number.isFinite)||now<a||now>b)return '';
 const p=Math.round(Math.min(1,Math.max(0,(now-a)/(b-a)))*100);
 return `<div class="day-progress" role="img" aria-label="РџСЂРѕР№РґРµРЅРѕ ${p} % СЃРІРµС‚РѕРІРѕРіРѕ РґРЅСЏ РѕС‚ СЂР°СЃСЃРІРµС‚Р° РґРѕ Р·Р°РєР°С‚Р°"><span style="width:${p}%"></span></div>`;
}
// Р§РёРї РґРІРѕСЂР°: С‚РѕР»СЊРєРѕ СЂРµР°Р»СЊРЅРѕРµ РґРІРёР¶РµРЅРёРµ РїРѕ РїР°РЅРµР»СЊРЅРѕРјСѓ РґРµС‚РµРєС‚РѕСЂСѓ (ha/yard-motion).
// Р”РµС‚РµРєС‚РѕСЂ РїР°РЅРµР»СЊРЅС‹Р№ вЂ” СЃСЂР°РІРЅРµРЅРёРµ РєР°РґСЂРѕРІ РєР°РјРµСЂС‹ РЅР° СЃРµСЂРІРµСЂРµ, Р±РёРЅРґРёРЅРі yard-motion РЅРµ РЅСѓР¶РµРЅ.
// РЎР»РѕС‚ Р¶РёРІС‘С‚ РІРЅСѓС‚СЂРё #home-status, С‡С‚РѕР±С‹ С‡Р°СЃС‚С‹Рµ РїРµСЂРµСЂРёСЃРѕРІРєРё РїРѕРіРѕРґС‹/С„Р°РєС‚РѕРІ
// РЅРµ СЃР±СЂР°СЃС‹РІР°Р»Рё Р·Р°РіСЂСѓР¶РµРЅРЅС‹Р№ РєР°РґСЂ РєР°РјРµСЂС‹.
const YARD_SLOT='<span id="yard-slot" class="yard-slot"></span>';
const YARD_POLL_MS=3000;
let yardData=null,yardPoll={at:0,busy:false};
async function pollYardMotion(){
 if(!isLive()||yardPoll.busy)return;
 const now=Date.now();
 if(now-yardPoll.at<YARD_POLL_MS)return;
 yardPoll.busy=true;yardPoll.at=now;
 try{const data=await api('ha/yard-motion');if(data){yardData=data;paintYardChip()}}catch{/* РґРµС‚РµРєС‚РѕСЂ РЅРµРґРѕСЃС‚СѓРїРµРЅ вЂ” С‡РёРї РїСЂРѕСЃС‚Рѕ РЅРµ РїРѕРєР°Р·С‹РІР°РµРј */}
 finally{yardPoll.busy=false}
}
function yardMarkup(){
 if(!isLive()||!yardData||yardData.available===false)return '';
 if(!showYardCard({motion:yardData.motion,lastMotionAt:yardData.lastMotionAt,now:Date.now(),mode:state.mode}))return '';
 const when=timeOf(yardData.lastMotionAt);
 return `<button class="home-fact yard-chip" data-camera="camera-yard" title="РџР°РЅРµР»СЊРЅРѕРµ СЂР°СЃРїРѕР·РЅР°РІР°РЅРёРµ РґРІРёР¶РµРЅРёСЏ РїРѕ РєР°РґСЂСѓ РєР°РјРµСЂС‹" aria-label="Р”РІРѕСЂ: РґРІРёР¶РµРЅРёРµ РІ ${esc(when)}. РћС‚РєСЂС‹С‚СЊ РєР°РјРµСЂСѓ РґРІРѕСЂР°"><span class="yard-thumb" aria-hidden="true">${I('camera')}</span><strong>Р”РІРёР¶РµРЅРёРµ В· ${esc(when)}</strong></button>`;
}
function paintYardChip(){
 const slot=$('#yard-slot');if(!slot)return;
 const markup=yardMarkup();
 if(markup){
  const leaving=slot.querySelector('.yard-chip.is-leaving');
  if(leaving){leaving.classList.remove('is-leaving');return}
  if(!slot.querySelector('.yard-chip')){slot.innerHTML=markup;icons();loadYardFrame()}
  return;
 }
 const chip=slot.querySelector('.yard-chip');
 if(chip&&!chip.classList.contains('is-leaving')){
  chip.classList.add('is-leaving');
  setTimeout(()=>{const c=$('#yard-slot .yard-chip');if(c?.classList.contains('is-leaving'))c.remove()},500);
 }
}
// РљР°РґСЂ РґРІРѕСЂР°: РЅРµ С‡Р°С‰Рµ СЂР°Р·Р° РІ 2 РјРёРЅСѓС‚С‹ (YARD_REFRESH_MS), СЂРµРІРёР·РёРё РїСЂРѕС‚РёРІ РіРѕРЅРѕРє,
// РїСЂРё РѕС€РёР±РєРµ РєР°РґСЂР° С‡РёРї РѕСЃС‚Р°С‘С‚СЃСЏ СЃ РёРєРѕРЅРєРѕР№ РєР°РјРµСЂС‹ вЂ” С‡РµСЃС‚РЅРѕ Р±РµР· РєР°СЂС‚РёРЅРєРё.
let yardFrame={url:null,at:0,rev:0,busy:false};
function paintYardThumb(thumb){
 if(!thumb)return;
 thumb.innerHTML=yardFrame.url?`<img src="${yardFrame.url}" alt=""/>`:'';
}
async function loadYardFrame(force=false){
 const thumb=$('.yard-chip .yard-thumb');
 if(!thumb||yardFrame.busy)return;
 const now=Date.now();
 if(!force&&now-yardFrame.at<YARD_REFRESH_MS)return paintYardThumb(thumb);
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
 paintYardThumb($('.yard-chip .yard-thumb'));
}

function home(){
 const hero=`<div class="hero-overlay">
 <div class="hero-top"><div class="hero-clock" aria-label="РњРµСЃС‚РЅРѕРµ РІСЂРµРјСЏ РґРѕРјР°"><div id="hero-clock">${clock()}</div><span id="hero-date">${date()}</span><span id="hero-greeting" class="hero-greeting" hidden></span>${dayProgress()}</div>
 <div class="hero-top-right">${isLive()?voiceButton():''}<span id="hero-status">${heroStatusChip()}</span><button id="reset-model" title="Р’РµСЂРЅСѓС‚СЊ РёСЃС…РѕРґРЅС‹Р№ СЂР°РєСѓСЂСЃ" aria-label="РЎР±СЂРѕСЃРёС‚СЊ СЂР°РєСѓСЂСЃ">${I('rotate-ccw')}</button></div></div>
 <div class="hero-facts" id="home-status">${YARD_SLOT}${weatherCard()}${homeStatus()}</div></div>`;
 return `<div class="view dashboard-view view-enter">
 <h1 class="visually-hidden">РњРѕР№ РґРѕРј</h1>
 <div class="home-stage-wrap">${sceneStage(hero)}
 <div id="home-room-card" class="home-room-card" hidden>${miniRoomCard()}</div>
 <aside class="home-rail" aria-label="РЎРІРѕРґРєР° РґРѕРјР°">
 <div id="home-digest" hidden></div>
 <div id="home-energy" hidden></div>
 <div id="home-alarm" hidden></div>
 <div id="home-light-overview">${lightOverviewBadge()}</div>
 <button class="text-button rail-allrooms" data-action="allrooms">Р’СЃРµ РєРѕРјРЅР°С‚С‹ ${I('arrow-up-right')}</button>
 ${!state.preview&&!state.houseProfileConfirmed&&state.devices.some(d=>houseBindings[d.id]===state.bindings[d.id]?.entityId)?'<div class="profile-invite"><div><strong>РџСЂРѕС„РёР»СЊ Р¶РґС‘С‚ РїСЂРѕРІРµСЂРєРё</strong><p>РџРѕРґС‚РІРµСЂРґРё РїСЂРёРІСЏР·РєРё РїРµСЂРµРґ СѓРїСЂР°РІР»РµРЅРёРµРј РґРѕРјРѕРј.</p></div><button class="secondary" data-action="house-review">РџСЂРѕРІРµСЂРёС‚СЊ РїСЂРѕС„РёР»СЊ</button></div>':''}
 </aside>
 <div id="home-quick" class="home-quick-rail">${homeQuick()}</div>
 </div></div>`;
}
// РњРёРЅРё-РєР°СЂС‚РѕС‡РєР° РєРѕРјРЅР°С‚С‹: С‚Р°Рї РїРѕ РїР»Р°РЅСѓ РїРѕРєР°Р·С‹РІР°РµС‚ РєР»РёРјР°С‚ Рё Р»РёРЅРёРё СЃРІРµС‚Р° СЂСЏРґРѕРј СЃРѕ СЃС†РµРЅРѕР№.
let activeRoomCard=null,cardGuard=0;
function miniRoomCard(){
 if(!activeRoomCard||state.view!=='home')return '';
 const r=getRoom(activeRoomCard);if(!r)return '';
 const cs=channelsFor(r);
 return `<div role="dialog" aria-label="РљР°СЂС‚РѕС‡РєР° РєРѕРјРЅР°С‚С‹ ${esc(r.name)}">
 <div class="mini-head"><span class="mini-icon">${I(r.icon)}</span><strong>${esc(r.name)}</strong><span class="mini-climate">${compactRoomClimate(r.id)}</span><button class="icon-button" data-action="close-room-card" aria-label="Р—Р°РєСЂС‹С‚СЊ РєР°СЂС‚РѕС‡РєСѓ РєРѕРјРЅР°С‚С‹">${I('x')}</button></div>
 ${cs.map(c=>`<div class="control-row mini-row"><div><h3>${esc(c.name)}</h3><p>${esc(c.planned?c.note||'РџР»Р°РЅРёСЂСѓРµС‚СЃСЏ':noConnection()?'РќРµС‚ СЃРІСЏР·Рё':isLive()&&!canControl(c.id)?'РќРµС‚ РґР°РЅРЅС‹С… В· РєР°РЅР°Р» РЅРµ РїСЂРѕРІРµСЂРµРЅ РёР»Рё РЅРµРґРѕСЃС‚СѓРїРµРЅ':c.note||'РћС‚РґРµР»СЊРЅР°СЏ Р»РёРЅРёСЏ СЃРІРµС‚Р°')}</p></div>${toggle(c.id,c.name,c.on,c.planned,`data-device="${c.id}" data-mini="1"`)}</div>${phaseLine(c.id)}`).join('')}
 ${cs.length?'':`<p class="mini-empty">Р›РёРЅРёР№ СЃРІРµС‚Р° РІ СЌС‚РѕР№ РєРѕРјРЅР°С‚Рµ РЅРµС‚.</p>`}
 <button class="secondary mini-open" data-room="${r.id}">РћС‚РєСЂС‹С‚СЊ РєРѕРјРЅР°С‚Сѓ ${I('arrow-up-right')}</button></div>`;
}
function paintRoomCard(){
 const node=$('#home-room-card');if(!node)return;
 // РџРѕРєР° РєРѕРјР°РЅРґР° РёР· РєР°СЂС‚РѕС‡РєРё РІ РїРѕР»С‘С‚Рµ (optimistic apply + pending), РїРµСЂРµСЂРёСЃРѕРІРєР°
 // РїРѕ РѕРїСЂРѕСЃСѓ РјРѕР¶РµС‚ Р·Р°РјРµРЅРёС‚СЊ РєРЅРѕРїРєСѓ РјРµР¶РґСѓ pointerdown Рё click вЂ” РїСЂРѕРїСѓСЃРєР°РµРј.
 if(activeRoomCard&&hasPending())return;
 updateRegion('#home-room-card',miniRoomCard());node.hidden=!activeRoomCard;icons();
}
function toggleRoomCard(id){
 activeRoomCard=activeRoomCard===id?null:id;cardGuard=Date.now();paintRoomCard();
}
// РљР°СЂС‚РѕС‡РєР° С‚РѕР»СЊРєРѕ РґР»СЏ РєРѕРјРЅР°С‚ СЃ Р»РёРЅРёСЏРјРё СЃРІРµС‚Р°; РїСѓСЃС‚С‹Рµ Р·РѕРЅС‹ РѕС‚РєСЂС‹РІР°СЋС‚ room view РєР°Рє СЂР°РЅСЊС€Рµ.
const activeCardRoom=id=>{if(id==='yard')return false;const r=getRoom(id);return Boolean(r&&channelsFor(r).length)};
function roomClimate(id){
 return state.devices.filter(d=>d.room===id&&d.status==='installed'&&['temperature','humidity'].includes(d.type))
  .map(d=>`<span class="climate-pill">${I(deviceTypes[d.type].icon)}${esc(deviceReading(d))}</span>`).join('');
}
function favoriteRooms(){
 return state.favorites.length?state.favorites.map(id=>{
  const r=getRoom(id),cs=channelsFor(r),known=!isLive()||cs.every(c=>canControl(c.id)),on=cs.filter(c=>c.on).length;
  return `<button class="favorite-room ${on&&known&&!noConnection()?'is-lit':''}" data-room="${r.id}">
  <span class="favorite-room-title">${I(r.icon)}${esc(r.short)}</span><span class="favorite-room-detail">${compactRoomClimate(id)||(!cs.length?'Р‘РµР· СЃРІРµС‚Р°':noConnection()?'РќРµС‚ СЃРІСЏР·Рё':!known?'<span title="РЎРІРµС‚ РІСЂРµРјРµРЅРЅРѕ РЅРµРґРѕСЃС‚СѓРїРµРЅ">вЂ”</span>':on?`${on} РёР· ${cs.length} В· РІРєР».`:'Р’С‹РєР»СЋС‡РµРЅРѕ')}</span></button>`;
 }).join(''):'<button class="empty-favorites" data-action="favorites">Р”РѕР±Р°РІРёС‚СЊ Р»СЋР±РёРјС‹Рµ РєРѕРјРЅР°С‚С‹</button>';
}
function compactRoomClimate(id){
 return state.devices.filter(d=>d.room===id&&d.status==='installed'&&['temperature','humidity'].includes(d.type))
  .map(d=>({d,value:deviceReading(d)})).filter(({value})=>/\d/.test(value)&&!value.includes('СѓСЃС‚Р°СЂРµР»'))
  .map(({d,value})=>`<span class="compact-reading">${I(deviceTypes[d.type].icon)}${esc(value)}</span>`).join('');
}
function homeLightSummary(){
 const channels=rooms.flatMap(r=>r.channels.filter(c=>!c.planned));
 return homeSummary({live:isLive(),online:!noConnection(),total:channels.length,unknown:channels.filter(c=>!canControl(c.id)).length,on:countLights()});
}
const WEATHER_LABEL={clear:'РЇСЃРЅРѕ',sunny:'РЎРѕР»РЅРµС‡РЅРѕ',cloudy:'РћР±Р»Р°С‡РЅРѕ',partlycloudy:'РџРµСЂРµРјРµРЅРЅР°СЏ РѕР±Р»Р°С‡РЅРѕСЃС‚СЊ',rainy:'Р”РѕР¶РґСЊ',snowy:'РЎРЅРµРі',fog:'РўСѓРјР°РЅ',windy:'Р’РµС‚СЂРµРЅРѕ',lightning:'Р“СЂРѕР·Р°',hail:'Р“СЂР°Рґ',drizzle:'РњРѕСЂРѕСЃСЊ',exceptional:'РџР°СЃРјСѓСЂРЅРѕ'};
const WEATHER_ICON={clear:'sun',sunny:'sun',partlycloudy:'cloud-sun',cloudy:'cloudy',rainy:'cloud-rain',snowy:'cloud-snow',fog:'cloud-fog',windy:'wind',lightning:'cloud-lightning',hail:'cloud-hail',drizzle:'cloud-drizzle',exceptional:'cloudy'};
const WEATHER_DATA={clear:'sunny',sunny:'sunny',partlycloudy:'cloudy',cloudy:'cloudy',rainy:'rain',snowy:'snow',fog:'fog',windy:'cloudy',lightning:'rain',hail:'rain',drizzle:'rain',exceptional:'cloudy'};
function weatherCard(){
 if(!isLive())return '';
 const e=Object.values(state.entityStates||{}).find(e=>e.entity_id?.startsWith('weather.'));
 if(!e||['unknown','unavailable',''].includes(e.state))return '';
 const label=WEATHER_LABEL[e.state];
 const t=e.attributes?.temperature,h=e.attributes?.humidity;
 if(!label||!Number.isFinite(t))return '';
 const icon=WEATHER_ICON[e.state]||'cloudy';
 const temp=t.toFixed(1).replace('.',','),aria=`РџРѕРіРѕРґР°: ${label}, С‚РµРјРїРµСЂР°С‚СѓСЂР° ${temp} В°C${Number.isFinite(h)?', РІР»Р°Р¶РЅРѕСЃС‚СЊ '+Math.round(h)+' %':''}`;
 return `<button class="home-fact weather-chip" data-weather="${WEATHER_DATA[e.state]||'cloudy'}" data-action="weather-forecast" role="img" aria-label="${esc(aria)}. РћС‚РєСЂС‹С‚СЊ РїСЂРѕРіРЅРѕР·" title="РћС‚РєСЂС‹С‚СЊ РїСЂРѕРіРЅРѕР· РїРѕРіРѕРґС‹"><span>${I(icon)}РџРѕРіРѕРґР°</span><strong>${esc(label)} В· ${temp} В°C${Number.isFinite(h)?' В· '+Math.round(h)+' %':''}</strong></button>`;
}
let forecastCache=null,forecastEntity='';
const forecastWeek=t=>new Intl.DateTimeFormat('ru-RU',{weekday:'short',day:'numeric',month:'short',timeZone:PANEL_TIMEZONE}).format(new Date(t));
function forecastMarkup(list,error,busy){
 const retry=`<div class="sheet-actions"><button class="secondary" data-forecast-reload>${I('rotate-ccw')}РћР±РЅРѕРІРёС‚СЊ</button></div>`;
 if(error)return `<p class="description forecast-error">РџСЂРѕРіРЅРѕР· РЅРµРґРѕСЃС‚СѓРїРµРЅ: ${esc(error)}</p>${retry}`;
 if(!list)return `<div class="forecast-status" aria-busy="true"><i data-lucide="loader-circle" class="spin"></i>Р—Р°РіСЂСѓР¶Р°РµРј РїСЂРѕРіРЅРѕР·вЂ¦</div>`;
 if(!list.length)return `<p class="description forecast-error">РџСЂРѕРіРЅРѕР· РЅРµРґРѕСЃС‚СѓРїРµРЅ: Home Assistant РЅРµ РІРµСЂРЅСѓР» РїСѓРЅРєС‚С‹ РїСЂРѕРіРЅРѕР·Р°.</p>${retry}`;
 return `<ul class="forecast-list">${list.map(f=>`<li class="forecast-row"><span class="forecast-day">${esc(forecastWeek(f.datetime))}</span>${I(WEATHER_ICON[f.condition]||'cloudy')}<b>${Math.round(f.temperature)}В°${Number.isFinite(f.templow)?' / '+Math.round(f.templow)+'В°':''}</b>${Number.isFinite(f.precipitationProbability)?`<span class="forecast-prec" title="Р’РµСЂРѕСЏС‚РЅРѕСЃС‚СЊ РѕСЃР°РґРєРѕРІ">${I('droplets')}${f.precipitationProbability} %</span>`:''}</li>`).join('')}</ul>${retry}`;
}
function paintForecast(list,error,busy){
 const node=$('[data-forecast-sheet]');
 if(node){node.innerHTML=forecastMarkup(list,error,busy);icons()}
}
async function loadForecast(force=false){
 if(force)forecastCache=null;
 if(!forecastEntity)return paintForecast(null,'РќРµС‚ СЃСѓС‰РЅРѕСЃС‚Рё РїРѕРіРѕРґС‹.');
 if(forecastCache&&!force&&Date.now()-forecastCache.at<15*60*1000)return paintForecast(forecastCache.data);
 paintForecast(null,null,true);
 try{
  const result=await api('ha/weather-forecast'+(forecastEntity?`?entity=${encodeURIComponent(forecastEntity)}`:''));
  forecastCache={at:Date.now(),data:result.forecast};
  paintForecast(result.forecast);
 }catch(error){paintForecast(null,error.message)}
}
function forecastSheet(){
 const e=Object.values(state.entityStates||{}).find(e=>e.entity_id?.startsWith('weather.'));
 forecastEntity=e?.entity_id||'';
 simpleSheet(`<h2>РџСЂРѕРіРЅРѕР· РїРѕРіРѕРґС‹</h2><div data-forecast-sheet>${forecastMarkup(null,null,true)}</div>`);
 if(!isLive()||!forecastEntity)return paintForecast(null,'Home Assistant РЅРµ РЅР°СЃС‚СЂРѕРµРЅ.');
 loadForecast();
}
function homeStatus(){
 const terraceDoor=state.devices.find(d=>d.id==='terrace-door'&&d.status==='installed');
 const door=binaryLabel('door','РћС‚РєСЂС‹С‚Р°','Р—Р°РєСЂС‹С‚Р°'),terrace=binaryLabel('terrace-door','РћС‚РєСЂС‹С‚Р°','Р—Р°РєСЂС‹С‚Р°');
 const fact=(label,value,attrs,attention=false)=>`<button class="home-fact ${attention?'needs-attention':''} ${/РќРµС‚ |вЂ”/.test(value)?'is-faint':''}" ${attrs}><span>${label}</span><strong>${esc(value)}</strong></button>`;
 const temperature=id=>{
  const d=state.devices.find(d=>d.room===id&&d.status==='installed'&&d.type==='temperature');
  return d?deviceReading(d):'РќРµС‚ РґР°С‚С‡РёРєР°';
 };
 return fact('Р’С…РѕРґРЅР°СЏ',door,`data-action="door" aria-label="Р’С…РѕРґРЅР°СЏ РґРІРµСЂСЊ: ${esc(door)}"`,door==='РћС‚РєСЂС‹С‚Р°')+
 (terraceDoor?fact('РўРµСЂСЂР°СЃР°',terrace,'data-action="terrace-door"',terrace==='РћС‚РєСЂС‹С‚Р°'):'')+
 fact('РЎРєРІР°Р¶РёРЅР°',temperature('well'),'data-sensor="well"')+
 fact('Р§РµСЂРґР°Рє',temperature('attic'),'data-sensor="attic"');
}
function lightOverview(){
 const all=rooms.flatMap(r=>channelsFor(r).map(c=>({r,c})));
 const unknown=all.filter(({c})=>noConnection()||isLive()&&!canControl(c.id));
 const on=all.filter(({c})=>!noConnection()&&(!isLive()||canControl(c.id))&&c.on);
 return {all,unknown,on};
}
function lightOverviewBadge(){
 const {all,unknown,on}=lightOverview();
 const label=noConnection()?'РЎРІРµС‚ В· РЅРµС‚ СЃРІСЏР·Рё':`РЎРІРµС‚ В· ${on.length}/${all.length}${unknown.length?' ?':''}`;
 return `<button class="light-overview-badge ${on.length?'has-light':''}" data-action="active-lights" aria-label="Р“РґРµ РіРѕСЂРёС‚ СЃРІРµС‚: РІРєР»СЋС‡РµРЅРѕ ${on.length}, Р±РµР· РґР°РЅРЅС‹С… ${unknown.length}">${esc(label)}${I('chevron-right')}</button>`;
}
function lightOverviewSheet(){
 const {all,unknown,on}=lightOverview();
 const rows=items=>items.map(({r,c})=>`<button class="light-overview-row" data-room="${r.id}"><span><strong>${esc(r.short)}</strong><small>${esc(c.name)}</small></span>${I('arrow-up-right')}</button>`).join('');
 return `<h2>Р“РґРµ РіРѕСЂРёС‚ СЃРІРµС‚</h2><p class="description">${isLive()?'РўРµРєСѓС‰РёРµ СЃРѕСЃС‚РѕСЏРЅРёСЏ HA':'Р”РµРјРѕРЅСЃС‚СЂР°С†РёРѕРЅРЅС‹Рµ СЃРѕСЃС‚РѕСЏРЅРёСЏ'} В· ${unknown.length?`РёР·РІРµСЃС‚РЅРѕ РІРєР»СЋС‡С‘РЅРЅС‹С…: ${on.length}; Р±РµР· РґР°РЅРЅС‹С…: ${unknown.length}`:`${on.length} РёР· ${all.length} Р»РёРЅРёР№ РІРєР»СЋС‡РµРЅС‹`}.</p>
 ${on.length?`<div class="light-overview-list">${rows(on)}</div>`:unknown.length?'<div class="inline-note">РџРѕРґС‚РІРµСЂР¶РґС‘РЅРЅС‹С… РІРєР»СЋС‡С‘РЅРЅС‹С… Р»РёРЅРёР№ РЅРµС‚, РЅРѕ С‡Р°СЃС‚СЊ СЃРѕСЃС‚РѕСЏРЅРёР№ РЅРµРёР·РІРµСЃС‚РЅР°.</div>':'<div class="lights-all-off">'+I('circle-check')+'<strong>Р’СЃРµ РїРѕРґРєР»СЋС‡С‘РЅРЅС‹Рµ Р»РёРЅРёРё РІС‹РєР»СЋС‡РµРЅС‹</strong></div>'}
 ${unknown.length?`<h3 class="light-unknown-title">Р‘РµР· РїРѕРґС‚РІРµСЂР¶РґС‘РЅРЅРѕРіРѕ СЃРѕСЃС‚РѕСЏРЅРёСЏ В· ${unknown.length}</h3><div class="light-overview-list">${rows(unknown)}</div>`:''}
 <button class="secondary" data-view="rooms">РћС‚РєСЂС‹С‚СЊ РІСЃС‘ СѓРїСЂР°РІР»РµРЅРёРµ СЃРІРµС‚РѕРј</button>`;
}
function houseAlerts(){
 return leakIssues(state.devices,{live:isLive(),online:state.liveOnline,read:observed})
  .sort((a,b)=>Number(b.alarm)-Number(a.alarm))
  .map(d=>`<button class="house-alert ${d.alarm?'is-alarm':'is-unavailable'}" data-action="leak" data-leak-id="${esc(d.id)}" ${d.alarm?'role="alert"':''}>${I(d.alarm?'triangle-alert':'wifi-off')}<span><strong>${esc(d.alarm?d.name+'!':'РќРµС‚ РґР°РЅРЅС‹С… В· '+d.name)}</strong><small>${d.alarm?'РџСЂРѕРІРµСЂСЊ РІРѕРґСѓ Рё РёСЃС‚РѕС‡РЅРёРє РїСЂРѕС‚РµС‡РєРё':'Р”Р°С‚С‡РёРє РЅРµРґРѕСЃС‚СѓРїРµРЅ РёР»Рё РµРіРѕ СЃРѕСЃС‚РѕСЏРЅРёРµ РЅРµРёР·РІРµСЃС‚РЅРѕ'}</small></span>${I('chevron-right')}</button>`).join('');
}
function digestCard(){
 const items=digestItems(digestArgs());
 if(!items.length)return '';
 return `<div class="digest-card ${items[0].level==='danger'?'is-danger':''}"><h3>${I('info')}Р”Р°Р№РґР¶РµСЃС‚ РґРѕРјР°</h3><ul>${items.map(it=>it.action
  ?`<li class="digest-item digest-${it.level}"><button class="digest-action" ${it.action.open?`data-digest-open="${it.action.open}"`:`data-room="${esc(it.action.room)}"`} aria-label="${esc(it.text)} В· ${esc(it.action.label)}">${I(it.icon)}<span>${esc(it.text)}</span><small>${esc(it.action.label)}</small></button></li>`
  :`<li class="digest-item digest-${it.level}">${I(it.icon)}<span>${esc(it.text)}</span></li>`).join('')}</ul></div>`;
}
// Р’РѕР»РЅР° 3 В«РЈРјРЅРѕРµ РїРѕРІРµРґРµРЅРёРµВ»: Р°РґР°РїС‚РёРІРЅС‹Рµ Р°РєС†РµРЅС‚С‹ РіР»Р°РІРЅРѕР№. РћРґРёРЅ РёСЃС‚РѕС‡РЅРёРє Р°СЂРіСѓРјРµРЅС‚РѕРІ
// РґР»СЏ РґР°Р№РґР¶РµСЃС‚Р° вЂ” РєР°СЂС‚РѕС‡РєР° РІ СЂРµР№Р»Рµ Рё РЅРѕС‡РЅР°СЏ СЃРІРѕРґРєР° РІ hero РїРѕРєР°Р·С‹РІР°СЋС‚ РѕРґРЅРѕ Рё С‚Рѕ Р¶Рµ.
function digestArgs(){
 return {mode:state.mode,liveOnline:state.liveOnline,devices:state.devices,bindings:state.bindings,entityStates:state.entityStates||{},now:Date.now(),alarmState:alarmEntity()?.state};
}
const digestSummary=()=>{const items=digestItems(digestArgs());return items.length?items.slice(0,2).map(i=>i.text).join(' В· '):''};
const dayPhase=hour=>hour>=6&&hour<11?'morning':hour>=11&&hour<17?'day':hour>=17&&hour<22?'evening':'night';
function updateHeroTime(){
 if(state.view!=='home')return;
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
  const text=phase==='morning'?'Р”РѕР±СЂРѕРµ СѓС‚СЂРѕ':phase==='evening'?'Р”РѕР±СЂС‹Р№ РІРµС‡РµСЂ':'';
  greeting.textContent=text;greeting.hidden=!text;
 }
}
// РЎРїРёСЃРѕРє РїРѕРєСѓРїРѕРє: РґР°РЅРЅС‹Рµ С‚РѕР»СЊРєРѕ СЃ СЃРµСЂРІРµСЂР° (todo/get_items), Р±РµР· РѕРїСЂРѕСЃР° РєР°Р¶РґС‹Рµ 5 СЃРµРєСѓРЅРґ.
let shoppingState={loaded:false,items:[],busy:false,error:'',note:'',truncated:false};
function shoppingMarkup(){
 const items=shoppingState.items.slice(0,5);
 return `<div class="digest-card shopping-card"><div class="title-line"><h3>${I('box')}РџРѕРєСѓРїРєРё${shoppingState.truncated?' В· РїРµСЂРІС‹Рµ 5':''}</h3><button class="text-button" data-action="shopping-refresh" aria-label="РћР±РЅРѕРІРёС‚СЊ СЃРїРёСЃРѕРє РїРѕРєСѓРїРѕРє" ${disabled(shoppingState.busy||!isLive())}>${I('rotate-ccw')}РћР±РЅРѕРІРёС‚СЊ</button></div>
 <ul class="shopping-list">${shoppingState.error?`<li class="shopping-empty">${esc(shoppingState.error)}</li>`:items.length?items.map(i=>`<li><button class="shopping-check" data-shopping-complete="${esc(i.uid)}" aria-label="РћС‚РјРµС‚РёС‚СЊ РєСѓРїР»РµРЅРЅС‹Рј: ${esc(i.summary)}" ${disabled(shoppingState.busy||!isLive())}></button><span class="shopping-text">${esc(i.summary)}</span></li>`).join(''):'<li class="shopping-empty">РЎРїРёСЃРѕРє РїСѓСЃС‚</li>'}</ul>
 <div class="shopping-add"><input id="shopping-input" maxlength="80" placeholder="Р”РѕР±Р°РІРёС‚СЊ РїРѕРєСѓРїРєСѓ" aria-label="РќРѕРІР°СЏ РїРѕР·РёС†РёСЏ СЃРїРёСЃРєР° РїРѕРєСѓРїРѕРє" ${disabled(shoppingState.busy||!isLive())}/><button class="secondary" data-action="shopping-add" ${disabled(shoppingState.busy||!isLive())}>Р”РѕР±Р°РІРёС‚СЊ</button></div>
 ${shoppingState.note?`<p class="description">${esc(shoppingState.note)}</p>`:''}</div>`;
}
function paintShopping(){
 // Р РµРіРёРѕРЅ РїРѕРєСѓРїРѕРє С‚РµРїРµСЂСЊ Р¶РёРІС‘С‚ РІ С€РёС‚Рµ СЃС‚Р°РЅС†РёРё (#sheet-shopping); updateRegion
 // СЃ dataset.rendered-guard РЅРµ РїРµСЂРµСЂРёСЃРѕРІС‹РІР°РµС‚ РѕРґРёРЅР°РєРѕРІС‹Р№ DOM, С„РѕРєСѓСЃ input СЃРѕС…СЂР°РЅСЏРµС‚СЃСЏ.
 const m=shoppingState.loaded?shoppingMarkup():'<p class="description">Р—Р°РіСЂСѓР¶Р°РµРј СЃРїРёСЃРѕРє РїРѕРєСѓРїРѕРєвЂ¦</p>';
 if($('#sheet-shopping'))updateRegion('#sheet-shopping',m);
}
async function loadShopping(){
 if(!isLive()){shoppingState={...shoppingState,loaded:true,error:'РЎРїРёСЃРѕРє РїРѕРєСѓРїРѕРє СЂР°Р±РѕС‚Р°РµС‚ РІ СЂР°Р±РѕС‡РµРј СЂРµР¶РёРјРµ СЃ РїРѕРґРєР»СЋС‡С‘РЅРЅС‹Рј Home Assistant.',note:''};paintShopping();return}
 if(shoppingState.busy)return;
 shoppingState.busy=true;paintShopping();
 try{const d=await api('ha/shopping');shoppingState={...shoppingState,loaded:true,items:d.items||[],truncated:!!d.truncated,error:'',note:''}}
 catch(error){shoppingState={...shoppingState,loaded:true,error:error.message,note:''}}
 finally{shoppingState.busy=false;paintShopping()}
}
async function shoppingMutate(action,target){
 const input=$('#shopping-input'),draft=input?.value||'';
 shoppingState.busy=true;paintShopping();
 try{
  const r=await api('ha/shopping',{method:'POST',body:{action,target}});
  shoppingState={...shoppingState,items:r.items||[],note:r.message,error:''};toast(r.message);
 }catch(error){shoppingState={...shoppingState,note:error.message};toast(error.message)}
 finally{shoppingState.busy=false;paintShopping();const i=$('#shopping-input');if(i)i.value=action==='add'?'':draft}
}
// РћС…СЂР°РЅР° (alarm_control_panel): СЃС‚Р°С‚СѓСЃ Рё РїРѕРґС‚РІРµСЂР¶РґР°РµРјС‹Рµ РєРѕРјР°РЅРґС‹ СЃ PIN-РєРѕРґРѕРј.
let alarmUI={askPin:false,service:'',busy:false,error:''};
const alarmEntity=()=>Object.values(state.entityStates||{}).find(e=>e.entity_id?.startsWith('alarm_control_panel.'));
const alarmLabels={disarmed:'РЎРЅСЏС‚Р°',armed_away:'РџРѕРґ РѕС…СЂР°РЅРѕР№ (РІРЅРµ РґРѕРјР°)',armed_home:'РџРѕРґ РѕС…СЂР°РЅРѕР№ (РґРѕРјР°)',arming:'РЎС‚Р°РІРёС‚СЃСЏвЂ¦',pending:'РћР¶РёРґР°РЅРёРµвЂ¦',triggered:'РўР Р•Р’РћР“Рђ'};
function alarmMarkup(){
 const e=alarmEntity();
 if(!e||!['disarmed','armed_away','armed_home','arming','pending','triggered'].includes(e.state))return '';
 const s=e.state,needsCode=(e.attributes?.code_format||'None')!=='None';
 const btn=(service,label)=>`<button class="secondary" data-alarm-service="${service}" ${disabled(alarmUI.busy)}>${label}</button>`;
 const pin=alarmUI.askPin?`<div class="alarm-pin"><input id="alarm-pin" type="password" inputmode="numeric" maxlength="16" placeholder="PIN-РєРѕРґ" aria-label="PIN-РєРѕРґ РѕС…СЂР°РЅС‹" ${disabled(alarmUI.busy)} autocomplete="off"/><button class="primary" data-alarm-service="${esc(alarmUI.service)}" data-alarm-confirm ${disabled(alarmUI.busy)}>РџРѕРґС‚РІРµСЂРґРёС‚СЊ</button><button class="text-button" data-alarm-cancel ${disabled(alarmUI.busy)}>РћС‚РјРµРЅР°</button></div>`:'';
 return `<div class="digest-card alarm-card ${s==='triggered'?'is-danger':''}" ${s==='triggered'?'role="alert"':''}><div class="title-line"><h3>${I('shield')}РћС…СЂР°РЅР°</h3></div>
 <p class="alarm-status">${esc(alarmLabels[s]||e.state)}</p>
 ${s==='disarmed'?`<div class="alarm-actions">${btn('arm_away','РџРѕСЃС‚Р°РІРёС‚СЊ (РІРЅРµ РґРѕРјР°)')}${btn('arm_home','РџРѕСЃС‚Р°РІРёС‚СЊ (РґРѕРјР°)')}</div>`:s==='triggered'?'':`<div class="alarm-actions">${btn('disarm','РЎРЅСЏС‚СЊ СЃ РѕС…СЂР°РЅС‹')}</div>`}
 ${needsCode?pin:''}
 ${alarmUI.error?`<p class="description alarm-error">${esc(alarmUI.error)}</p>`:''}
 <p class="description">${e.attributes?.changed_by?'РР·РјРµРЅРµРЅРѕ: '+esc(e.attributes.changed_by):'Home Assistant В· alarm_control_panel'}</p></div>`;
}
function paintAlarm(){
 const node=$('#home-alarm');if(!node)return;
 const m=alarmMarkup();
 if(m){updateRegion('#home-alarm',m);node.hidden=false}else node.hidden=true;
}
async function alarmCommand(service,code){
 const draft=$('#alarm-pin')?.value||'';
 alarmUI.busy=true;alarmUI.error='';paintAlarm();
 try{
  const r=await api('ha/alarm',{method:'POST',body:{service,code}});
  alarmUI.askPin=false;alarmUI.service='';
  toast(r.message||(r.confirmed?'РћС…СЂР°РЅР°: СЃРѕСЃС‚РѕСЏРЅРёРµ РїРѕРґС‚РІРµСЂР¶РґРµРЅРѕ.':'РћС…СЂР°РЅР°: РєРѕРјР°РЅРґР° РїСЂРёРЅСЏС‚Р°, СЃС‚Р°С‚СѓСЃ РЅРµ РїРѕРґС‚РІРµСЂР¶РґС‘РЅ.'));
 }catch(error){alarmUI.error=error.message;toast(error.message)}
 finally{
  alarmUI.busy=false;paintAlarm();
  // РћС€РёР±РєР° РєРѕРјР°РЅРґС‹ РЅРµ РґРѕР»Р¶РЅР° СЃС‚РёСЂР°С‚СЊ РІРІРµРґС‘РЅРЅС‹Р№ PIN: РїРµСЂРµСЂРёСЃРѕРІРєР° РїРµСЂРµСЃРѕР·РґР°С‘С‚
  // РїРѕР»Рµ РІРІРѕРґР°, РїРѕСЌС‚РѕРјСѓ РІРѕР·РІСЂР°С‰Р°РµРј С‡РµСЂРЅРѕРІРёРє Рё РІРѕР·РІСЂР°С‰Р°РµРј С„РѕРєСѓСЃ.
  const input=$('#alarm-pin');
  if(input&&alarmUI.askPin&&!input.value&&draft){input.value=draft;input.focus()}
 }
}
async function sendTTS(){
 const input=$('#tts-text'),status=$('#tts-status'),button=$('[data-action="tts-send"]');
 if(!input||!status)return;
 const text=input.value.trim();status.textContent=text?'РћС‚РїСЂР°РІР»СЏРµРј РЅР° СЃС‚Р°РЅС†РёСЋвЂ¦':'';
 if(button)button.disabled=true;
 try{const r=await api('ha/announce',{method:'POST',body:{text}});status.textContent=r.accepted?'РћС‚РїСЂР°РІР»РµРЅРѕ В· РїРѕРґС‚РІРµСЂР¶РґРµРЅРёРµ РѕР·РІСѓС‡РёРІР°РЅРёСЏ РЅРµРІРѕР·РјРѕР¶РЅРѕ':r.message||'РћС‚РїСЂР°РІР»РµРЅРѕ'}
 catch(error){status.textContent=error.message}
 finally{if(button)button.disabled=false}
}
function stationRoom(){return areaName(state.devices.find(d=>d.id==='station')?.room||'corridor')}
function stationSkipButtons(){
 const e=isLive()?observed('station'):null;
 return `<div class="station-skip"><button class="icon-button" data-action="station-previous" aria-label="РџСЂРµРґС‹РґСѓС‰РёР№ С‚СЂРµРє" ${disabled(!isLive()||!stationSupports(e,'previous',true)||hasPending())}>${I('skip-back')}</button>
 <button class="icon-button" data-action="station-next" aria-label="РЎР»РµРґСѓСЋС‰РёР№ С‚СЂРµРє" ${disabled(!isLive()||!stationSupports(e,'next',true)||hasPending())}>${I('skip-forward')}</button></div>`;
}
function homeQuick(){
 const camera=state.devices.find(d=>d.type==='camera'&&d.room==='yard'&&d.status==='installed');
 const media=state.devices.find(d=>d.id==='station'&&d.status==='installed');
 return `<div class="quick-devices">
 <button class="quick-device light-shortcut" data-action="master" ${disabled(masterBlocked())}><span class="quick-device-icon">${I('power')}</span><span><strong>Р’РµСЃСЊ СЃРІРµС‚</strong><small>Р’С‹РєР»СЋС‡РёС‚СЊ</small></span></button>
 ${camera?`<button class="quick-device camera-shortcut" data-camera="${camera.id}" aria-label="Р”РІРѕСЂ: РѕС‚РєСЂС‹С‚СЊ РїСЂСЏРјРѕР№ СЌС„РёСЂ"><span class="quick-device-icon">${I('camera')}</span><span><strong>Р”РІРѕСЂ</strong><small>РљР°РјРµСЂР°</small></span></button>`:''}
 ${media?`<div class="quick-device media-shortcut">
 <button class="quick-device-icon" data-action="station-play" aria-label="${state.stationPlaying?'РџР°СѓР·Р° РЅР° СЃС‚Р°РЅС†РёРё':'РџСЂРѕРґРѕР»Р¶РёС‚СЊ РЅР° СЃС‚Р°РЅС†РёРё'}" ${disabled(!canControl('station:playing')||hasPending())}>${I(state.stationPlaying?'pause':'play')}</button>
 <button class="media-details" data-action="station" aria-label="РЎС‚Р°РЅС†РёСЏ В· ${esc(stationRoom())}: РѕС‚РєСЂС‹С‚СЊ СѓРїСЂР°РІР»РµРЅРёРµ"><span class="media-title-line"><strong>РЎС‚Р°РЅС†РёСЏ</strong>${state.stationPlaying?'<span class="eq-bars" aria-hidden="true"><i></i><i></i><i></i></span>':''}</span><small title="${esc(observed('station')?.attributes?.media_title||stationRoom())}">${esc(observed('station')?.attributes?.media_title||stationRoom())}</small></button>
 ${stationSkipButtons()}</div>`:''}
 </div>`;
}
function sceneStage(hero=''){
 return `<section class="model-stage spatial-stage${hero?' hero-stage':''}"><canvas id="canvas" aria-label="РРЅС‚РµСЂР°РєС‚РёРІРЅР°СЏ РѕР±СЉС‘РјРЅР°СЏ РјРѕРґРµР»СЊ РґРѕРјР°"></canvas>
 <div id="model-loading" class="model-loading">${I('loader-circle')}Р—Р°РіСЂСѓР¶Р°РµРј РїР»Р°РЅ РґРѕРјР°</div>
 ${hero?hero:`<div class="model-top"><span id="model-name">${state.view==='room'?esc(getRoom(state.selected).short):'РџРµСЂРІС‹Р№ СЌС‚Р°Р¶'}</span><button id="reset-model" title="Р’РµСЂРЅСѓС‚СЊ РёСЃС…РѕРґРЅС‹Р№ СЂР°РєСѓСЂСЃ" aria-label="РЎР±СЂРѕСЃРёС‚СЊ СЂР°РєСѓСЂСЃ">${I('rotate-ccw')}</button></div>`}
 </section>`;
}
function phaseLine(id){
 const c=commandFor(id);if(!c)return '';
 return `<div class="command-status ${c.phase}" role="status">${I(c.phase==='pending'?'loader-circle':c.phase==='success'?'circle-check':'triangle-alert')}
 <span>${esc(c.message)}${c.phase==='success'?' В· '+timeOf(c.confirmedAt):''}</span>
 ${c.phase==='error'?`<button class="retry-button" data-retry="${id}">РџРѕРІС‚РѕСЂРёС‚СЊ</button>`:''}</div>`;
}
function toggle(id,label,on,blocked,attrs=''){
 const unknown=isLive()&&!canControl(id);
 return `<button ${unknown?'':`role="switch" aria-checked="${on}"`} aria-label="${esc(label)}${unknown?' В· РЅРµС‚ РїРѕРґС‚РІРµСЂР¶РґС‘РЅРЅРѕРіРѕ СЃРѕСЃС‚РѕСЏРЅРёСЏ':''}" aria-busy="${commandFor(id)?.phase==='pending'}"
 class="toggle" ${attrs} ${disabled(blocked||!canControl(id)||hasPending())}><span class="toggle-track"></span></button>`;
}
function controls(r){
 return `${r.channels.map(c=>{
 const id=c.id;
 const note=c.planned?c.note:isLive()&&!canControl(id)?'РќРµС‚ РґР°РЅРЅС‹С… В· РєР°РЅР°Р» РЅРµ РїСЂРѕРІРµСЂРµРЅ РёР»Рё РЅРµРґРѕСЃС‚СѓРїРµРЅ':noConnection()?'РќРµС‚ СЃРІСЏР·Рё':c.note||'РћС‚РґРµР»СЊРЅР°СЏ Р»РёРЅРёСЏ СЃРІРµС‚Р°';
const isPlanned=c.planned;
 return `<div class="control-group${isPlanned?' is-planned':''}"><div class="control-row"><div><h3>${esc(c.name)}</h3><p>${esc(note||'РџР»Р°РЅРёСЂСѓРµС‚СЃСЏ')}</p></div>
 ${toggle(id,c.name,c.on,c.planned,`data-device="${id}"`)}</div>${phaseLine(id)}</div>`;
 }).join('')}${state.devices.some(d=>d.id==='rgb'&&d.room===r.id)?rgbControls():''}
 ${!r.channels.length?'<p class="empty-room-note">Р—РґРµСЃСЊ РЅРµС‚ Р»РёРЅРёР№ СЃРІРµС‚Р°. Р”СЂСѓРіРёРµ СѓСЃС‚СЂРѕР№СЃС‚РІР° РґРѕСЃС‚СѓРїРЅС‹ РЅРёР¶Рµ.</p>':''}
 ${r.id==='corridor'&&r.channels.some(c=>!state.bindings[c.id]?.entityId)?'<button class="text-button" data-action="corridor-binding">Р’С‹Р±СЂР°С‚СЊ СЃСѓС‰РЅРѕСЃС‚СЊ СЃРІРµС‚Р° РєРѕСЂРёРґРѕСЂР° '+I('arrow-right')+'</button>':''}
 ${r.id==='hall'?'<button class="text-button" data-room="terrace">РЎРІРµС‚ С‚РµСЂСЂР°СЃС‹ В· РѕС‚РґРµР»СЊРЅР°СЏ Р·РѕРЅР° '+I('arrow-right')+'</button>':''}`;
}
function rgbControls(){
 const d=state.devices.find(d=>d.id==='rgb'),powered=d?.status==='installed'&&hallPowered();
 return `<div class="control-group"><div class="control-row"><div><h3>${esc(d?.name||'RGB-Р»Р°РјРїР°')}</h3><p>${d?.status==='planned'?'РџР»Р°РЅРёСЂСѓРµС‚СЃСЏ':state.demoOffline?'РќРµС‚ СЃРІСЏР·Рё В· РґРµРјРѕ':powered?(state.rgbOn?'Р’РєР»СЋС‡РµРЅР° В· Yeelight':'Р’С‹РєР»СЋС‡РµРЅР° В· Yeelight'):'Р‘РµР· РїРёС‚Р°РЅРёСЏ В· РІРєР»СЋС‡Рё СЃРІРµС‚ РїСЂРёС…РѕР¶РµР№'}</p></div>
 ${toggle('rgb:on',d?.name||'RGB-Р»Р°РјРїР°',powered&&state.rgbOn,!powered,'data-action="rgb"')}</div>${phaseLine('rgb:on')}</div>
 ${powered?`<div class="rgb-control"><label for="brightness">РЇСЂРєРѕСЃС‚СЊ <span id="brightness-label">${state.brightness} % В· ${isLive()?'Home Assistant':'РїРѕРґС‚РІРµСЂР¶РґРµРЅРѕ РІ РґРµРјРѕ'}</span></label>
 <input id="brightness" type="range" min="1" max="100" value="${state.brightness}" ${disabled(!state.rgbOn||!canControl('rgb:brightness')||hasPending())}/>
 ${phaseLine('rgb:brightness')}<div class="swatches">${[['#e6c68c','РўС‘РїР»С‹Р№'],['#eef1e5','Р‘РµР»С‹Р№'],['#d1a1e8','РЎРёСЂРµРЅРµРІС‹Р№'],['#9dbddb','Р“РѕР»СѓР±РѕР№']].map(([c,l])=>
 `<button style="--swatch:${c}" aria-label="${l} С†РІРµС‚" class="${state.rgbColor===c?'selected':''}" data-color="${c}" ${disabled(!state.rgbOn||!canControl('rgb:color')||hasPending())}></button>`).join('')}</div>${phaseLine('rgb:color')}</div>`:''}`;
}
function selectedRoom(){
 const r=getRoom(state.selected);
 return `<section class="selected-room"><div class="eyebrow">${esc(r.short)}</div><h2>РЎРІРµС‚</h2><p class="description">${r.channels.length?'РљР°Р¶РґР°СЏ Р»РёРЅРёСЏ РЅРµР·Р°РІРёСЃРёРјР°':'РЈСЃС‚СЂРѕР№СЃС‚РІР° СЌС‚РѕР№ Р·РѕРЅС‹'}</p>${controls(r)}</section>`;
}
function model(){
 return `<div class="view"><div class="view-title"><div><div class="eyebrow">РџСЂРѕСЃС‚СЂР°РЅСЃС‚РІРѕ</div><h1>РџР»Р°РЅ РґРѕРјР°</h1><p>Р’С‹Р±РµСЂРё РєРѕРјРЅР°С‚Сѓ РЅР° РїР»Р°РЅРµ РёР»Рё РІ СЃРїРёСЃРєРµ.</p></div>
 <button class="secondary" data-action="allrooms">Р’СЃРµ РєРѕРјРЅР°С‚С‹ ${I('arrow-right')}</button></div><div class="model-layout">
 ${sceneStage()}<aside class="side-stack"><div id="selected-room">${selectedRoom()}</div><button class="secondary" data-room="${state.selected}">РћС‚РєСЂС‹С‚СЊ РєРѕРјРЅР°С‚Сѓ ${I('arrow-up-right')}</button><p class="model-note">РњРµР±РµР»СЊ Рё СЂР°Р·РјРµСЂС‹ РїРѕРєР°Р·Р°РЅС‹ СЃС…РµРјР°С‚РёС‡РЅРѕ.</p></aside></div></div>`;
}
// РЎС†РµРЅР°СЂРёРё РЅР° СЌРєСЂР°РЅРµ РєРѕРјРЅР°С‚С‹ вЂ” С‚РѕР»СЊРєРѕ РµСЃР»Рё РІ РЅРµР№ РµСЃС‚СЊ СѓСЃС‚Р°РЅРѕРІР»РµРЅРЅР°СЏ Р»РёРЅРёСЏ СЃРІРµС‚Р°
// СЃ РїРѕРґС‚РІРµСЂР¶РґС‘РЅРЅРѕР№ РїСЂРёРІСЏР·РєРѕР№ (РІ live вЂ” canControl, РІ РґРµРјРѕ вЂ” РґРѕСЃС‚Р°С‚РѕС‡РЅРѕ СѓСЃС‚Р°РЅРѕРІРєРё).
const roomHasLight=r=>r.channels.some(c=>!c.planned&&(!isLive()||canControl(c.id)));
function roomPage(){
 const r=getRoom(state.selected),external=['attic','well','yard'].includes(r.id);
 return `<div class="view room-view"><div class="room-heading"><div><button class="room-back text-button" data-view="home">${I('house')}РњРѕР№ РґРѕРј ${I('chevron-right')}</button><h1>${esc(r.name)}</h1></div><div class="room-climate" id="room-climate">${roomClimate(r.id)}</div></div>
 <div class="room-layout"><div class="room-visual-column">${external?`<section class="zone-stage">${I(r.icon)}<h2>${esc(r.short)}</h2><p>РџРѕРєР°Р·Р°РЅРёСЏ Рё РґРѕСЃС‚СѓРїРЅРѕСЃС‚СЊ СѓСЃС‚СЂРѕР№СЃС‚РІ</p><div class="room-climate">${roomClimate(r.id)}</div></section>`:sceneStage()}
 <div class="room-equipment" id="room-equipment">${roomEquipment(r)}</div></div><aside class="room-control-column">${roomHasLight(r)?`<div id="room-scenarios">${scenarioChipsRow()}</div>`:''}<div id="selected-room">${selectedRoom()}</div><details class="room-other-zones"><summary>Р”СЂСѓРіРёРµ РєРѕРјРЅР°С‚С‹</summary>${rooms.filter(x=>x.id!==r.id&&x.id!=='yard').map(x=>`<button data-room="${x.id}">${I(x.icon)}${esc(x.short)}${I('chevron-right')}</button>`).join('')}</details></aside></div></div>`;
}
function roomEquipment(r){
 const cards=logicalSensorCards(r.id);
 return `${state.devices.some(d=>d.id==='station'&&d.room===r.id&&d.status==='installed')?station():''}
 ${cards}${state.devices.filter(d=>d.room===r.id&&['curtain','vacuum'].includes(d.type)).map(sensorCard).join('')}`;
}
function lights(){
 return `<div class="view"><div class="view-title"><div><div class="eyebrow">РЈРїСЂР°РІР»РµРЅРёРµ</div><h1>РЎРІРµС‚ РІ РґРѕРјРµ</h1><p>Р’С‹Р±РµСЂРё РєРѕРјРЅР°С‚Сѓ. Р’СЃРµ Р»РёРЅРёРё РґРѕСЃС‚СѓРїРЅС‹ РЅРµР·Р°РІРёСЃРёРјРѕ.</p></div>
 <span class="demo-badge">${state.demoOffline?'РќРµС‚ СЃРІСЏР·Рё В· РґРµРјРѕ':lightCountLabel()}</span></div>
 <div class="room-list">${rooms.map(roomCard).join('')}</div><div class="wide-hint"><span>РРЅР¶РµРЅРµСЂРЅРѕРµ РѕР±РѕСЂСѓРґРѕРІР°РЅРёРµ РЅРµ РІС…РѕРґРёС‚ РІ РјР°СЃС‚РµСЂ-СЃРІРµС‚.</span><button data-action="catalog">РљР°С‚Р°Р»РѕРі СѓСЃС‚СЂРѕР№СЃС‚РІ ${I('arrow-right')}</button></div></div>`;
}
function watch(){
 const motion=state.devices.find(d=>d.id==='terrace-motion'&&d.status==='installed');
 const terraceDoor=state.devices.find(d=>d.id==='terrace-door'&&d.status==='installed');
 const leaks=state.devices.filter(d=>d.type==='leak'&&d.status==='installed');
 return `<div class="view"><div class="view-title"><div><div class="eyebrow">РќР°Р±Р»СЋРґРµРЅРёРµ</div><h1>РљР»РёРјР°С‚ Рё РґР°С‚С‡РёРєРё</h1><p>Р’СЃС‘, С‡С‚Рѕ СЃРѕРѕР±С‰Р°РµС‚ С‚РІРѕР№ РґРѕРј.</p></div></div>
 <div class="watch-grid"><section class="camera-empty">${I('camera')}<h2>Р”РІРѕСЂ РїРѕРґ РїСЂРёСЃРјРѕС‚СЂРѕРј</h2>
 <p>РќР°Р¶РјРё РЅР° РєР°РјРµСЂСѓ РґР»СЏ РїСЂСЏРјРѕРіРѕ СЌС„РёСЂР°. Р’РёРґРµРѕ СЂР°Р±РѕС‚Р°РµС‚ С‚РѕР»СЊРєРѕ РІ РѕС‚РєСЂС‹С‚РѕРј РѕРєРЅРµ РїСЂРѕСЃРјРѕС‚СЂР°.</p>
 <div class="module-list">${state.devices.filter(d=>d.type==='camera'&&d.status==='installed').map(d=>`<button class="quiet-card" data-camera="${d.id}"><div class="quiet-info">${I('camera')}<div><h3>${esc(d.name)}</h3><p>${isLive()&&observed(d.id)?'РџРѕРґРєР»СЋС‡РµРЅР° В· РїСЂСЏРјРѕР№ СЌС„РёСЂ':'РЈСЃС‚Р°РЅРѕРІР»РµРЅР° В· РїРѕРґРєР»СЋС‡РµРЅРёРµ РЅРµ РїСЂРѕРІРµСЂРµРЅРѕ'}</p></div></div>${I('chevron-right')}</button>`).join('')||'<p>РљР°РјРµСЂС‹ РґРѕР±Р°РІР»СЏСЋС‚СЃСЏ С‡РµСЂРµР· РєР°С‚Р°Р»РѕРі.</p>'}</div></section>
 <aside class="side-stack"><section class="overview-status">
 <div class="status-line"><span>${I('door-closed')}Р’С…РѕРґРЅР°СЏ РґРІРµСЂСЊ</span><strong>${binaryLabel('door','РћС‚РєСЂС‹С‚Р°','Р—Р°РєСЂС‹С‚Р°')}</strong></div>
 ${terraceDoor?`<div class="status-line"><span>${I('door-open')}Р”РІРµСЂСЊ РЅР° С‚РµСЂСЂР°СЃСѓ</span><strong>${binaryLabel('terrace-door','РћС‚РєСЂС‹С‚Р°','Р—Р°РєСЂС‹С‚Р°')}</strong></div>`:''}
 ${leaks.map(d=>`<div class="status-line"><span>${I('droplets')}${esc(d.name)}</span><strong>${binaryLabel(d.id,'РўСЂРµРІРѕРіР°','РЎСѓС…Рѕ')}</strong></div>`).join('')}
 ${state.devices.some(d=>d.id==='smoke'&&d.status==='installed')?`<div class="status-line"><span>${I('radio')}Р”С‹Рј</span><strong>${binaryLabel('smoke','РўСЂРµРІРѕРіР°','РќРµС‚ С‚СЂРµРІРѕРіРё')}</strong></div>`:''}
 ${motion?`<button class="status-line motion-detail" data-action="motion" data-motion-id="${esc(motion.id)}"><span>${I('trees')}РўРµСЂСЂР°СЃР°</span><strong>${esc(deviceReading(motion))}</strong></button>`:''}
 ${state.devices.some(d=>d.id==='rgb')?`<div class="status-line"><span>${I('lightbulb')}RGB РїСЂРёС…РѕР¶РµР№</span><strong>${noConnection()?'РќРµС‚ СЃРІСЏР·Рё':isLive()&&!observed('hall:0')?'РќРµС‚ РґР°РЅРЅС‹С…':hallPowered()?'Р•СЃС‚СЊ РїРёС‚Р°РЅРёРµ':'Р‘РµР· РїРёС‚Р°РЅРёСЏ'}</strong></div>`:''}</section>
 ${climate()}</aside></div>${deviceHealth()}<section class="sensor-catalog"><div class="section-heading"><div><h2>Р”Р°С‚С‡РёРєРё РґРѕРјР°</h2><p>Р›РѕРіРёС‡РµСЃРєРёРµ СѓСЃС‚СЂРѕР№СЃС‚РІР°: РїРѕРєР°Р·Р°РЅРёСЏ Рё Р±Р°С‚Р°СЂРµР№РєР° РІРјРµСЃС‚Рµ</p></div></div><div class="module-grid">${logicalSensorCards()||'<p>Р”Р°С‚С‡РёРєРё РїРѕРєР° РЅРµ РґРѕР±Р°РІР»РµРЅС‹.</p>'}</div></section>
 ${state.devices.some(d=>['curtain','vacuum'].includes(d.type))?`<section class="sensor-catalog"><div class="section-heading"><div><h2>РќРѕРІС‹Рµ РєР°С‚РµРіРѕСЂРёРё</h2><p>РљР°СЂРЅРёР·С‹ Рё РїС‹Р»РµСЃРѕСЃС‹: РїРѕРєР° С‚РѕР»СЊРєРѕ РЅР°Р±Р»СЋРґРµРЅРёРµ, Р±РµР· РєРѕРјР°РЅРґ</p></div></div><div class="module-grid">${state.devices.filter(d=>['curtain','vacuum'].includes(d.type)).map(sensorCard).join('')}</div></section>`:''}</div>`;
}
function logicalSensorCards(roomId){
 const byId=new Map(state.devices.map(d=>[d.id,d]));
 return buildDeviceModel(preferences(),state.entityStates,isLive()&&state.liveOnline)
  .map(g=>({...g,components:g.components.filter(c=>sensorTypes.includes(c.type)&&c.installed&&(!roomId||c.room===roomId))}))
  .filter(g=>g.components.some(c=>c.type!=='battery'))
  .map(g=>`<article class="module-card sensor-card"><div class="title-line"><span>${esc(areaName(g.room))}</span>${I(g.icon)}</div><h3>${esc(g.name)}</h3>
   ${g.components.map(c=>{const text=deviceReading(byId.get(c.id));return `<div class="status-line"><span>${esc(deviceTypes[c.type].label)}</span><strong${text==='РќРµС‚ РґР°РЅРЅС‹С…'?' class="is-unavailable"':''}>${esc(text)}</strong></div>`}).join('')}
   <p>${isLive()?'РўРѕР»СЊРєРѕ РїСЂРѕРІРµСЂРµРЅРЅС‹Рµ РґР°РЅРЅС‹Рµ HA':'Р”РµРјРѕРЅСЃС‚СЂР°С†РёРѕРЅРЅС‹Р№ СЂРµР¶РёРј'}</p></article>`).join('');
}
function deviceHealth(){
 const batteries=state.devices.filter(d=>d.type==='battery'&&d.status==='installed');
 if(!batteries.length)return '';
 const rows=batteries.map(d=>{
  const e=isLive()?observed(d.id):null,n=e&&!['unknown','unavailable',''].includes(e.state)?Number(e.state):NaN;
  const valid=Number.isFinite(n)&&n>=0&&n<=100&&e?.attributes.unit_of_measurement==='%';
  return {d,e,n,valid,low:valid&&n<=20};
 }).sort((a,b)=>Number(b.low)-Number(a.low)||(a.valid?a.n:101)-(b.valid?b.n:101));
 return `<section class="sensor-catalog"><div class="section-heading"><div><h2>Р‘Р°С‚Р°СЂРµР№РєРё Рё СЃРІСЏР·СЊ</h2><p>${isLive()?'Р—Р°СЂСЏРґ РґРѕ 20% РІС‹РґРµР»РµРЅ. РќРµС‚ РґР°РЅРЅС‹С… РЅРµ РѕР·РЅР°С‡Р°РµС‚ СЂР°Р·СЂСЏР¶РµРЅРЅСѓСЋ Р±Р°С‚Р°СЂРµР№РєСѓ.':'Р РµР°Р»СЊРЅС‹Рµ Р±Р°С‚Р°СЂРµР№РєРё РїРѕСЏРІСЏС‚СЃСЏ РїРѕСЃР»Рµ РїРѕРґРєР»СЋС‡РµРЅРёСЏ HA.'}</p></div><button class="text-button" data-action="house-review">РџСЂРёРІСЏР·РєРё ${I('arrow-right')}</button></div><div class="module-grid">${rows.map(({d,e,n,valid,low})=>`<article class="module-card battery-card ${low?'battery-low':''}"><div class="title-line"><span>${esc(areaName(d.room))}</span>${I(low?'triangle-alert':'radio')}</div><h3>${esc(d.name)}</h3><strong class="module-reading">${valid?n+' %':isLive()&&!state.liveOnline?'РќРµС‚ СЃРІСЏР·Рё':'РќРµС‚ РґР°РЅРЅС‹С…'}</strong><p>${valid?(low?'РџРѕСЂР° Р·Р°РјРµРЅРёС‚СЊ В· ':'РџРѕСЃР»РµРґРЅРёР№ РѕС‚С‡С‘С‚ В· ')+timeOf(Date.parse(e.last_reported||e.last_updated)||0):state.bindings[d.id]?.verified?'РЎСѓС‰РЅРѕСЃС‚СЊ РЅРµРґРѕСЃС‚СѓРїРЅР°':'РџСЂРёРІСЏР·РєР° РЅРµ РїРѕРґС‚РІРµСЂР¶РґРµРЅР°'}</p></article>`).join('')}</div></section>`;
}
function deviceReading(d){
 if(d.status==='planned')return 'РџР»Р°РЅРёСЂСѓРµС‚СЃСЏ';
 const e=isLive()?observed(d.id):null,type=deviceTypes[d.type];
 if(noConnection())return 'РќРµС‚ СЃРІСЏР·Рё';
 const value=isLive()?e?.state:d.demoStale?undefined:d.demoValue;
 if(value===undefined||value===null||['unknown','unavailable',''].includes(value))return 'РќРµС‚ РґР°РЅРЅС‹С…';
 if(isLive()&&['temperature','humidity','illuminance'].includes(d.type)&&!numericReading(e,{unit:type.unit}).available)return 'РќРµС‚ РґР°РЅРЅС‹С…';
 if(type.unit)return Number.isFinite(Number(value))?`${reading(Number(value))} ${type.unit}`:'РќРµС‚ РґР°РЅРЅС‹С…';
 if(d.type==='button_event'){
  const label=({single:'РќР°Р¶Р°С‚РёРµ',double:'Р”РІРѕР№РЅРѕРµ РЅР°Р¶Р°С‚РёРµ',triple:'РўСЂРѕР№РЅРѕРµ РЅР°Р¶Р°С‚РёРµ',hold:'РЈРґРµСЂР¶Р°РЅРёРµ',long:'РЈРґРµСЂР¶Р°РЅРёРµ',long_press:'РЈРґРµСЂР¶Р°РЅРёРµ',release:'РћС‚РїСѓСЃРєР°РЅРёРµ'})[String(value).toLowerCase()]||String(value);
  const at=Date.parse(e?.last_changed||'')||NaN;
  return Number.isFinite(at)?`${label} В· ${timeOf(at)}`:label;
 }
 if(d.type==='motion'&&isLive())return motionObservation(e).text;
 const labels={door:['РћС‚РєСЂС‹С‚Р°','Р—Р°РєСЂС‹С‚Р°'],smoke:['РўСЂРµРІРѕРіР°','РќРµС‚ С‚СЂРµРІРѕРіРё'],motion:['Р•СЃС‚СЊ РґРІРёР¶РµРЅРёРµ','РќРµС‚ РґРІРёР¶РµРЅРёСЏ'],leak:['РџСЂРѕС‚РµС‡РєР°','РЎСѓС…Рѕ'],pump:['РџРёС‚Р°РЅРёРµ РІРєР»СЋС‡РµРЅРѕ','РџРёС‚Р°РЅРёРµ РІС‹РєР»СЋС‡РµРЅРѕ']};
 if(labels[d.type]){const v=binaryValue(d.type,value);return v===true?labels[d.type][0]:v===false?labels[d.type][1]:'РќРµС‚ РґР°РЅРЅС‹С…'}
 if(d.type==='gate')return ({open:'РћС‚РєСЂС‹С‚С‹',closed:'Р—Р°РєСЂС‹С‚С‹',opening:'РћС‚РєСЂС‹РІР°СЋС‚СЃСЏ',closing:'Р—Р°РєСЂС‹РІР°СЋС‚СЃСЏ'})[value]||'РџРѕР»РѕР¶РµРЅРёРµ РЅРµРёР·РІРµСЃС‚РЅРѕ';
 if(d.type==='curtain')return (({open:'РћС‚РєСЂС‹С‚С‹',closed:'Р—Р°РєСЂС‹С‚С‹',opening:'РћС‚РєСЂС‹РІР°СЋС‚СЃСЏ',closing:'Р—Р°РєСЂС‹РІР°СЋС‚СЃСЏ',stopped:'РћСЃС‚Р°РЅРѕРІР»РµРЅС‹'})[value]||String(value))+(Number.isFinite(e?.attributes.current_position)?` В· ${e.attributes.current_position} %`:'');
 if(d.type==='vacuum')return (({cleaning:'РЈР±РёСЂР°РµС‚',docked:'РќР° Р±Р°Р·Рµ',returning:'Р’РѕР·РІСЂР°С‰Р°РµС‚СЃСЏ',idle:'РћР¶РёРґР°РЅРёРµ',paused:'РџР°СѓР·Р°',error:'РћС€РёР±РєР°'})[value]||String(value))+(Number.isFinite(e?.attributes.battery_level)?` В· Р·Р°СЂСЏРґ ${e.attributes.battery_level} %`:'');
 if(d.type==='heating')return e?.attributes.current_temperature!==undefined?`${e.attributes.current_temperature} ${e.attributes.temperature_unit||e.attributes.unit_of_measurement||'(РµРґРёРЅРёС†С‹ HA)'} В· ${value}`:String(value);
 return 'РќРµС‚ РґР°РЅРЅС‹С…';
}
function sensorCard(d){
 const reading=deviceReading(d);
 return `<article class="module-card sensor-card"><div class="title-line"><span>${esc(areaName(d.room))}</span>${I(deviceTypes[d.type].icon)}</div><h3>${esc(d.name)}</h3><strong class="module-reading${reading==='РќРµС‚ РґР°РЅРЅС‹С…'?' is-unavailable':''}">${esc(reading)}</strong><p>${d.status==='planned'?'Р‘СѓРґСѓС‰РµРµ СѓСЃС‚СЂРѕР№СЃС‚РІРѕ':isLive()?'РўРѕР»СЊРєРѕ РїСЂРѕРІРµСЂРµРЅРЅС‹Рµ РґР°РЅРЅС‹Рµ HA':'Р”РµРјРѕРЅСЃС‚СЂР°С†РёРѕРЅРЅС‹Р№ СЂРµР¶РёРј'}${d.demoStale&&!isLive()?' В· РїСЂРёРјРµСЂ СѓСЃС‚Р°СЂРµР»':''}</p></article>`;
}
function engineering(){
 const order={pump:0,heating:1,gate:2,filter:3};
 return `<div class="view"><div class="view-title"><div><h1>РРЅР¶РµРЅРµСЂРёСЏ РґРѕРјР°</h1><p>РћС‚РґРµР»СЊРЅРѕ РѕС‚ СЃРІРµС‚Р°. РџРѕРєР° С‚РѕР»СЊРєРѕ РЅР°Р±Р»СЋРґРµРЅРёРµ, Р±РµР· РєРѕРјР°РЅРґ РѕР±РѕСЂСѓРґРѕРІР°РЅРёСЋ.</p></div></div><div class="module-grid">${state.devices.filter(d=>deviceTypes[d.type].module==='engineering').sort((a,b)=>(order[a.type]??9)-(order[b.type]??9)).map(d=>{
  const reading=deviceReading(d),unavailable=reading==='РќРµС‚ РґР°РЅРЅС‹С…'||reading==='РќРµС‚ СЃРІСЏР·Рё';
  return `<article class="module-card engineering-card"><div class="title-line"><span>${esc(areaName(d.room))}</span><span class="sys-badge${unavailable?' is-muted':''}" role="img" aria-label="${unavailable?'РќРµС‚ РґР°РЅРЅС‹С…':'Р’ СЃРёСЃС‚РµРјРµ'}"></span>${I(deviceTypes[d.type].icon)}</div><h2>${esc(d.name)}</h2><strong class="module-reading${unavailable?' is-unavailable':''}">${esc(reading)}</strong><p>${esc(d.note)}</p><div class="inline-note">${d.type==='gate'?'РЈРїСЂР°РІР»РµРЅРёРµ РІРѕСЂРѕС‚Р°РјРё Р·Р°Р±Р»РѕРєРёСЂРѕРІР°РЅРѕ. РќСѓР¶РЅС‹ РїСЂРѕРІРµСЂРєР° РїСЂРёРІРѕРґР°, РїРѕР»РѕР¶РµРЅРёСЏ Рё Р·Р°С‰РёС‚С‹ РѕС‚ РїСЂРµРїСЏС‚СЃС‚РІРёР№.':d.type==='heating'?'РЈРїСЂР°РІР»РµРЅРёРµ РєРѕС‚Р»РѕРј Р·Р°Р±Р»РѕРєРёСЂРѕРІР°РЅРѕ. Р’РЅРµС€РЅРёР№ РёРЅС‚РµСЂС„РµР№СЃ РґРѕРїСѓСЃРєР°РµС‚СЃСЏ С‚РѕР»СЊРєРѕ РїРѕСЃР»Рµ РїСЂРѕРІРµСЂРєРё РґРѕРєСѓРјРµРЅС‚Р°С†РёРё Рё СЃРїРµС†РёР°Р»РёСЃС‚РѕРј.':'РЈРїСЂР°РІР»РµРЅРёРµ РїРёС‚Р°РЅРёРµРј Р·Р°Р±Р»РѕРєРёСЂРѕРІР°РЅРѕ. РџРѕРґР°С‡Р° РїРёС‚Р°РЅРёСЏ РЅРµ РґРѕРєР°Р·С‹РІР°РµС‚ С†РёСЂРєСѓР»СЏС†РёСЋ РІРѕРґС‹.'}</div></article>`}).join('')||'<p>РћР±РѕСЂСѓРґРѕРІР°РЅРёРµ РґРѕР±Р°РІР»СЏРµС‚СЃСЏ С‡РµСЂРµР· РєР°С‚Р°Р»РѕРі.</p>'}</div><div class="wide-hint"><span>ESP32 Рё РґСЂСѓРіРёРµ Р±СѓРґСѓС‰РёРµ РјРѕРґСѓР»Рё РїРѕРґРєР»СЋС‡Р°СЋС‚СЃСЏ С‡РµСЂРµР· РїСЂРѕРІРµСЂРµРЅРЅС‹Рµ СЃСѓС‰РЅРѕСЃС‚Рё Home Assistant.</span><button data-action="catalog">РљР°С‚Р°Р»РѕРі СѓСЃС‚СЂРѕР№СЃС‚РІ ${I('arrow-right')}</button></div></div>`;
}
function clearCamera(){
 cameraRevision++;if(cameraPlayer)cameraPlayer.stop();cameraPlayer=null;cameraDevice=null;
 if(cameraURL)URL.revokeObjectURL(cameraURL);cameraURL=null;
}
function openYardCamera(){
 const d=state.devices.find(d=>d.type==='camera'&&d.room==='yard'&&d.status==='installed');
 if(d)return cameraSheet(d.id);
 simpleSheet('<h2>РљР°РјРµСЂР° РґРІРѕСЂР°</h2><p class="description">Р”РѕР±Р°РІСЊ СѓСЃС‚Р°РЅРѕРІР»РµРЅРЅСѓСЋ РєР°РјРµСЂСѓ РІ Р·РѕРЅСѓ В«Р”РІРѕСЂВ» Рё РїСЂРёРІСЏР¶Рё РµС‘ Рє РїСЂРѕРІРµСЂРµРЅРЅРѕР№ СЃСѓС‰РЅРѕСЃС‚Рё camera.* РІ РЅР°СЃС‚СЂРѕР№РєР°С… РїР°РЅРµР»Рё.</p>');
}
function cameraSheet(id){
 const d=state.devices.find(d=>d.id===id);if(!d)return;
 const e=observed(id),enabled=isLive()&&!state.preview&&d.status==='installed'&&e&&!['unknown','unavailable'].includes(e.state);
 modal(`<div class="eyebrow">${esc(areaName(d.room))}</div><h2>${esc(d.name)}</h2><p class="description">${d.status==='planned'?'РљР°РјРµСЂР° РµС‰С‘ РЅРµ СѓСЃС‚Р°РЅРѕРІР»РµРЅР°.':'РџСЂСЏРјРѕР№ СЌС„РёСЂ РїРѕ Р·Р°РїСЂРѕСЃСѓ. Р—Р°РєСЂРѕР№ РѕРєРЅРѕ, С‡С‚РѕР±С‹ РѕСЃС‚Р°РЅРѕРІРёС‚СЊ РїСЂРѕСЃРјРѕС‚СЂ.'}</p><div id="camera-frame" class="camera-frame"><span>${enabled?'РџРѕРґРєР»СЋС‡Р°РµРј РІРёРґРµРѕвЂ¦':'РЎРЅР°С‡Р°Р»Р° РїСЂРёРІСЏР¶Рё Рё РїСЂРѕРІРµСЂСЊ СЃСѓС‰РЅРѕСЃС‚СЊ РєР°РјРµСЂС‹ РІ РЅР°СЃС‚СЂРѕР№РєР°С…'}</span></div><p id="camera-status" role="status">${enabled?'РџРѕРґРєР»СЋС‡Р°РµРј РїСЂСЏРјРѕР№ СЌС„РёСЂвЂ¦':'РџРѕРґРєР»СЋС‡РµРЅРёРµ РєР°РјРµСЂС‹ РµС‰С‘ РЅРµ РїСЂРѕРІРµСЂРµРЅРѕ'}</p><div class="camera-actions"><button class="primary" data-camera-start="${id}" ${disabled(!enabled)}>${I('play')}РџСЂСЏРјРѕР№ СЌС„РёСЂ</button><button class="secondary" data-action="camera-stop" ${disabled(!enabled)}>${I('pause')}РЎС‚РѕРї</button><button class="secondary" data-action="camera-fullscreen" ${disabled(!enabled)}>${I('maximize')}РќР° РІРµСЃСЊ СЌРєСЂР°РЅ</button><button class="text-button" data-camera-hls="${id}" ${disabled(!enabled)}>HLS В· СЂРµР·РµСЂРІ</button><button class="text-button" data-camera-frame="${id}" ${disabled(!enabled)}>${I('camera')}РЎРЅРёРјРѕРє</button></div>`);
 $('.sheet').classList.add('camera-sheet');$('#overlay').classList.add('camera-overlay');cameraDevice=id;
 if(enabled)cameraStart(id);
}
function cameraStart(id,transport='auto'){
 clearCamera();cameraDevice=id;
 $('#camera-frame').innerHTML='<video id="camera-video" controls autoplay muted playsinline webkit-playsinline aria-label="РџСЂСЏРјРѕР№ СЌС„РёСЂ РєР°РјРµСЂС‹ РґРІРѕСЂР°"></video>';
 const video=$('#camera-video');video.muted=true;
 cameraPlayer=startCameraPlayer(id,video,$('#camera-status'),{transport});
 clearTimeout(idleTimer);
}
function cameraStop(){
 const id=cameraDevice;clearCamera();cameraDevice=id;
 if($('#camera-frame'))$('#camera-frame').innerHTML='<span>РџСЂРѕСЃРјРѕС‚СЂ РѕСЃС‚Р°РЅРѕРІР»РµРЅ</span>';
 if($('#camera-status'))$('#camera-status').textContent='РќР°Р¶РјРё В«РџСЂСЏРјРѕР№ СЌС„РёСЂВ», С‡С‚РѕР±С‹ РїСЂРѕРґРѕР»Р¶РёС‚СЊ';armIdle();
}
function cameraFullscreen(){
 const video=$('#camera-video');if(!video){toast('РЎРЅР°С‡Р°Р»Р° Р·Р°РїСѓСЃС‚Рё РїСЂСЏРјРѕР№ СЌС„РёСЂ.');return}
 try{
  const request=video.requestFullscreen||video.webkitRequestFullscreen||video.webkitEnterFullscreen;
  if(!request){toast('РџРѕР»РЅС‹Р№ СЌРєСЂР°РЅ РЅРµРґРѕСЃС‚СѓРїРµРЅ РІ СЌС‚РѕРј Р±СЂР°СѓР·РµСЂРµ.');return}
  const result=request.call(video);if(result&&result.catch)result.catch(()=>toast('Р‘СЂР°СѓР·РµСЂ РЅРµ СЂР°Р·СЂРµС€РёР» РїРѕР»РЅС‹Р№ СЌРєСЂР°РЅ.'));
 }catch{toast('Р‘СЂР°СѓР·РµСЂ РЅРµ СЂР°Р·СЂРµС€РёР» РїРѕР»РЅС‹Р№ СЌРєСЂР°РЅ.')}
}
async function cameraFrame(id,button){
 clearCamera();cameraDevice=id;armIdle();
 const rev=++cameraRevision;button.disabled=true;$('#camera-status').textContent='РџРѕР»СѓС‡Р°РµРј РєР°РґСЂвЂ¦';
 try{
  const blob=await api('ha/camera',{method:'POST',body:{id},image:true});
  if(rev!==cameraRevision||$('#overlay').hidden)return;
  const nextURL=URL.createObjectURL(blob),image=new Image();
  try{
   await new Promise((resolve,reject)=>{image.onload=resolve;image.onerror=reject;image.src=nextURL});
  }catch{URL.revokeObjectURL(nextURL);throw new Error('РљР°РґСЂ РЅРµ СѓРґР°Р»РѕСЃСЊ РїСЂРѕС‡РёС‚Р°С‚СЊ. РџРѕРїСЂРѕР±СѓР№ Р·Р°РїСЂРѕСЃРёС‚СЊ РЅРѕРІС‹Р№.')}
  if(rev!==cameraRevision||$('#overlay').hidden){URL.revokeObjectURL(nextURL);return}
  if(cameraURL)URL.revokeObjectURL(cameraURL);cameraURL=nextURL;
  $('#camera-frame').innerHTML=`<img src="${cameraURL}" alt="РљР°РґСЂ РєР°РјРµСЂС‹, РїРѕР»СѓС‡РµРЅРЅС‹Р№ РїРѕ Р·Р°РїСЂРѕСЃСѓ"/>`;
  $('#camera-status').textContent='РљР°РґСЂ РїРѕР»СѓС‡РµРЅ РІ '+clock()+' В· РЅРµ РїСЂСЏРјРѕР№ СЌС„РёСЂ';
 }catch(error){if(rev===cameraRevision&&$('#camera-status'))$('#camera-status').textContent=error.message}
 finally{if(rev===cameraRevision)button.disabled=false}
}
function render(animate=true){
 const revision=++viewRevision;modelAPI?.disposeModel();if(state.view!=='home')activeRoomCard=null;
 $('#main').innerHTML=state.view==='home'?home():state.view==='room'?roomPage():state.view==='model'?model():state.view==='rooms'?lights():state.view==='engineering'?engineering():state.view==='statistics'?statisticsView():watch();
 document.documentElement.dataset.view=state.view;
 if(!animate&&$('#main .view'))$('#main .view').style.animation='none';
 document.querySelectorAll('nav button').forEach(b=>{
  const active=b.dataset.view===state.view||(['room','model'].includes(state.view)&&b.dataset.view==='home');
  b.classList.toggle('active',active);if(active)b.setAttribute('aria-current','page');else b.removeAttribute('aria-current');
 });
 $('#master').disabled=masterBlocked();updateHeader();storageStatus();icons();
 if($('#sheet-content').dataset.station==='hub'&&!shoppingState.loaded&&!shoppingState.busy)loadShopping();
 if(state.view==='statistics')loadStatistics();
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
   $('#model-loading').innerHTML=`<strong>РџР»Р°РЅ РґРѕРјР° РЅРµ Р·Р°РіСЂСѓР·РёР»СЃСЏ</strong><span class="model-error-detail">${esc(state.modelError)}</span><button class="text-button" data-action="model-retry">РџРѕРІС‚РѕСЂРёС‚СЊ РїРѕРїС‹С‚РєСѓ</button>`;
   console.error('Home Panel: model mount failed',error);
  });
 }
}
function updateRegion(selector,markup){
 const node=$(selector);if(!node||node.dataset.rendered===markup)return;
 // РќРµ РїРµСЂРµРєСЂР°С€РёРІР°РµРј С‚Р°РїР°Р±РµР»СЊРЅС‹Рµ СЂРµР»СЊСЃС‹ РїРѕРґ РїР°Р»СЊС†РµРј: РєРЅРѕРїРєР° РјРѕР¶РµС‚ В«СѓРµС…Р°С‚СЊВ» РјРµР¶РґСѓ pointerdown Рё click.
 if(Date.now()-lastPointerDown<400&&(selector==='#home-quick'||selector==='#home-status'||selector==='#home-room-card')){setTimeout(()=>{if($(selector)&&$(selector).dataset.rendered!==markup)updateRegion(selector,markup)},450);return}
 node.innerHTML=markup;node.dataset.rendered=markup;
}
function updateDetail(){
 const editingRange=document.activeElement?.matches('input[type="range"]');
 if($('#selected-room')&&!editingRange)updateRegion('#selected-room',selectedRoom());
 if($('#model-name'))$('#model-name').textContent=state.view==='room'?getRoom(state.selected).short:'РџРµСЂРІС‹Р№ СЌС‚Р°Р¶';
 if($('#room-climate'))$('#room-climate').innerHTML=roomClimate(state.selected);
 updateRegion('.zone-stage .room-climate',roomClimate(state.selected));
 if($('#room-equipment')&&!editingRange)updateRegion('#room-equipment',roomEquipment(getRoom(state.selected)));
 const id=$('#sheet-content').dataset.room;
 if(!$('#overlay').hidden&&id)$('#sheet-content').innerHTML=roomSheet(getRoom(id));
 icons();
}
function refresh(){
 const focus=document.activeElement?.getAttribute('aria-label');
  applyAutoTheme();
 if(['home','model','room'].includes(state.view)){
  updateDetail();modelAPI?.updateModel(rooms,state);
  const weatherEntity=Object.values(state.entityStates||{}).find(e=>e.entity_id?.startsWith('weather.')),weatherTemp=weatherEntity?.attributes?.temperature;
  modelAPI?.setModelWeather(weatherTemp<0&&weatherEntity?.state==='snowy'?'snow':weatherTemp<0&&weatherEntity?.state==='rainy'?'rain':null);
  if(state.view==='home'){
   updateRegion('#home-status',YARD_SLOT+weatherCard()+homeStatus());paintYardChip();pollYardMotion();updateRegion('#home-quick',homeQuick());updateRegion('#home-light-overview',lightOverviewBadge());updateRegion('#hero-status',heroStatusChip());voiceSync();paintRoomCard();
    const digest=$('#home-digest');if(digest){updateRegion('#home-digest',digestCard());digest.hidden=!digest.querySelector('.digest-card')}
    const alarm=$('#home-alarm');if(alarm){updateRegion('#home-alarm',alarmMarkup());alarm.hidden=!alarm.querySelector('.alarm-card')}
    const energy=$('#home-energy');if(energy){updateRegion('#home-energy',isLive()?energyCard(findMeterEntities(state.entityStates||{}),Date.now()):'');energy.hidden=!energy.querySelector('.energy-card')}
    updateHeroTime();
  }else if(state.view==='room'&&$('#room-scenarios'))updateRegion('#room-scenarios',scenarioChipsRow());
 }else if(state.view!=='statistics')render(false);
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
function paintStatistics(){
 if(state.view!=='statistics')return;
 $('#main').innerHTML=statisticsView();icons();
}
async function loadStatistics(force=false){
 if(historyState.loading)return;
 if(!isLive()){
  historyState.data=null;historyState.error='РСЃС‚РѕСЂРёСЏ РґРѕСЃС‚СѓРїРЅР° РїРѕСЃР»Рµ РїРѕРґРєР»СЋС‡РµРЅРёСЏ Home Assistant. Р’ РґРµРјРѕРїСЂРµРІСЊСЋ РіСЂР°С„РёРєРё РЅРµ РїРѕРґРґРµР»С‹РІР°РµРј.';paintStatistics();return;
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
 return `<h2>${esc(d?.name||'Р”РІРёР¶РµРЅРёРµ')}</h2><p class="description">${isLive()?esc(m.text):'Р”РµРјРѕРЅСЃС‚СЂР°С†РёРѕРЅРЅС‹Р№ СЂРµР¶РёРј'}</p>
 <div class="inline-note">Р”Р»СЏ РґР°С‚С‡РёРєР° С‚РµСЂСЂР°СЃС‹ Р°РєС‚РёРІРЅРѕРµ РѕРєРЅРѕ вЂ” 5 РјРёРЅСѓС‚. В«РќРµС‚ РЅРѕРІС‹С… РґРІРёР¶РµРЅРёР№В» РѕР·РЅР°С‡Р°РµС‚ РёСЃС‚РµС‡РµРЅРёРµ СЌС‚РѕРіРѕ РѕРєРЅР°, Р° РЅРµ РЅРѕРІРѕРµ РїРѕРєР°Р·Р°РЅРёРµ РґР°С‚С‡РёРєР°.</div>
 <div class="motion-timestamp"><span>РџРѕСЃР»РµРґРЅРµРµ РѕР±РЅРѕРІР»РµРЅРёРµ СЃРѕР±С‹С‚РёСЏ</span><strong>${m.at?new Date(m.at).toLocaleString('ru-RU',{timeZone:PANEL_TIMEZONE}):'РќРµРёР·РІРµСЃС‚РЅРѕ'}</strong><small>${m.at?esc(elapsedLabel(m.at)):''}</small></div>
 <p class="description">${m.kind==='unknown'?'Р‘РµР· РґРѕСЃС‚РѕРІРµСЂРЅРѕРіРѕ СЃРѕСЃС‚РѕСЏРЅРёСЏ РёР»Рё РІСЂРµРјРµРЅРё РЅРµ СЃС‡РёС‚Р°РµРј, С‡С‚Рѕ РґРІРёР¶РµРЅРёСЏ РЅРµС‚.':'РЎСѓС‰РЅРѕСЃС‚СЊ HA РЅРµ РёР·РјРµРЅСЏРµС‚СЃСЏ. Р Р°СЃС‡С‘С‚РЅС‹Р№ СЃС‚Р°С‚СѓСЃ РїСЂРёРјРµРЅСЏРµС‚СЃСЏ С‚РѕР»СЊРєРѕ РІ РїР°РЅРµР»Рё.'}</p>`;
}
function roomSheet(r){
 return `<div class="eyebrow">${r.short}</div><h2 style="margin-top:12px">${r.name}</h2><p class="description">${r.description||'РљР°Р¶РґР°СЏ Р»РёРЅРёСЏ СѓРїСЂР°РІР»СЏРµС‚СЃСЏ РѕС‚РґРµР»СЊРЅРѕ.'}</p>${controls(r)}`;
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
 modal(`<h2>Р’С‹РєР»СЋС‡РёС‚СЊ РІРµСЃСЊ СЃРІРµС‚?</h2><p class="description">${isLive()?'Р’С‹РєР»СЋС‡Р°С‚СЃСЏ С‚РѕР»СЊРєРѕ РїСЂРёРІСЏР·Р°РЅРЅС‹Рµ Рё РїСЂРѕРІРµСЂРµРЅРЅС‹Рµ Р»РёРЅРёРё СЃРІРµС‚Р°. Р­С‚Рѕ СЂРµР°Р»СЊРЅС‹Рµ РєРѕРјР°РЅРґС‹ Home Assistant.':'РљРѕРјР°РЅРґС‹ РІС‹РїРѕР»РЅСЏС‚СЃСЏ С‚РѕР»СЊРєРѕ РІ РґРµРјРѕРјР°РєРµС‚Рµ.'} Р РµР·СѓР»СЊС‚Р°С‚ РїСЂРѕРІРµСЂСЏРµС‚СЃСЏ РїРѕ СЃРѕСЃС‚РѕСЏРЅРёСЋ РєР°Р¶РґРѕР№ Р»РёРЅРёРё.</p>
 <div class="inline-note">РўРѕР»СЊРєРѕ Р»РёРЅРёРё, РІРєР»СЋС‡С‘РЅРЅС‹Рµ РІ РјР°СЃС‚РµСЂ-СЃРІРµС‚ РІ РєР°С‚Р°Р»РѕРіРµ. РљР°РјРµСЂР°, РјСѓР·С‹РєР° Рё РґР°С‚С‡РёРєРё РЅРµ Р·Р°С‚СЂР°РіРёРІР°СЋС‚СЃСЏ.</div>
 <div class="sheet-actions"><button class="primary" data-action="confirm-master">Р’С‹РєР»СЋС‡РёС‚СЊ</button><button class="secondary" data-action="cancel">РћС‚РјРµРЅР°</button></div>`);
}
async function masterConfirm(){
 if(masterBlocked())return;
 closeModal();state.batchPending=true;
 const jobs=rooms.flatMap(r=>r.channels).filter(c=>c.masterOff&&c.on&&!c.planned&&canControl(c.id));
 const results=await Promise.all(jobs.map(c=>command(c.id,false)));
 state.batchPending=false;refresh();
 toast(results.every(Boolean)?(isLive()?'РџСЂРѕРІРµСЂРµРЅРЅС‹Рµ Р»РёРЅРёРё РІС‹РєР»СЋС‡РµРЅС‹ РїРѕ РґР°РЅРЅС‹Рј HA.':'РЎРІРµС‚ РІС‹РєР»СЋС‡РµРЅ Рё РїРѕРґС‚РІРµСЂР¶РґС‘РЅ РІ РґРµРјРѕ.'):'РќРµ РІСЃРµ Р»РёРЅРёРё РїРѕРґС‚РІРµСЂРґРёР»Рё РІС‹РєР»СЋС‡РµРЅРёРµ. РџСЂРѕРІРµСЂСЊ СЃРѕРѕР±С‰РµРЅРёСЏ РІ РєРѕРјРЅР°С‚Р°С….');
}
function stationSheet(){
 const enabled=!isLive()&&state.stationMode==='demo'&&!state.demoOffline,offline=!isLive()&&(state.stationMode==='offline'||state.demoOffline);
 const e=isLive()?observed('station'):null;
 if(isLive())return `<h2>РЎС‚Р°РЅС†РёСЏ В· ${esc(stationRoom())}</h2><p class="description">${esc(!state.liveOnline?'РќРµС‚ СЃРІСЏР·Рё СЃ Home Assistant':stationStateLabel(e))}</p>
 <div class="inline-note">${esc(e?.attributes.media_title||'РќР°Р·РІР°РЅРёРµ С‚СЂРµРєР° РЅРµ РїРµСЂРµРґР°РЅРѕ')}${e?.attributes.media_artist?' В· '+esc(e.attributes.media_artist):''}</div>
 <div class="control-group"><div class="control-row"><div><h3>Р’РѕСЃРїСЂРѕРёР·РІРµРґРµРЅРёРµ</h3><p>РљРѕРјР°РЅРґС‹ С‚РѕР»СЊРєРѕ С‡РµСЂРµР· media_player РІ HA</p></div><button class="icon-button" data-action="station-play" aria-label="${state.stationPlaying?'РџР°СѓР·Р°':'Р’РѕСЃРїСЂРѕРёР·РІРµСЃС‚Рё'}" ${disabled(!stationSupports(e,'playing',!state.stationPlaying)||hasPending())}>${I(state.stationPlaying?'pause':'play')}</button></div>${phaseLine('station:playing')}</div>
 <div class="rgb-control"><label for="station-volume">Р“СЂРѕРјРєРѕСЃС‚СЊ <span id="station-volume-label">${Number.isFinite(e?.attributes.volume_level)?state.stationVolume+' %':'РќРµРґРѕСЃС‚СѓРїРЅР°'}</span></label><input id="station-volume" type="range" min="0" max="100" value="${state.stationVolume}" ${disabled(!stationSupports(e,'volume')||hasPending())}/>${phaseLine('station:volume')}</div>
 ${stationSkipButtons()}${phaseLine('station:previous')}${phaseLine('station:next')}
 <div id="sheet-shopping">${shoppingState.loaded?shoppingMarkup():'<p class="description">Р—Р°РіСЂСѓР¶Р°РµРј СЃРїРёСЃРѕРє РїРѕРєСѓРїРѕРєвЂ¦</p>'}</div>
 <div class="control-group tts-block"><h3>РЎРєР°Р·Р°С‚СЊ РЅР° СЃС‚Р°РЅС†РёРё</h3>
  <div class="tts-presets">${['Р“РѕСЃС‚СЊ РїСЂРёС€С‘Р»','РЈР¶РёРЅ РіРѕС‚РѕРІ','РџРѕСЂР° РґРѕРјРѕР№'].map(t=>`<button class="tts-preset" data-tts-preset="${esc(t)}" ${disabled(!state.liveOnline)}>${esc(t)}</button>`).join('')}</div>
  <label for="tts-text">РЎРІРѕСЏ С„СЂР°Р·Р° В· РґРѕ 100 СЃРёРјРІРѕР»РѕРІ</label>
  <div class="tts-row"><input id="tts-text" maxlength="100" placeholder="РўРµРєСЃС‚ РґР»СЏ СЃС‚Р°РЅС†РёРё" ${disabled(!state.liveOnline)}/><span id="tts-count">0/100</span><button class="secondary" data-action="tts-send" ${disabled(!state.liveOnline)}>РЎРєР°Р·Р°С‚СЊ</button></div>
  <p id="tts-status" class="description" role="status" aria-live="polite"></p>
  <p class="description">РћС‚РїСЂР°РІРєР° С‡РµСЂРµР· media_player.play_media. Home Assistant РЅРµ РїРѕРґС‚РІРµСЂР¶РґР°РµС‚ СЃР°Рј С„Р°РєС‚ РѕР·РІСѓС‡РёРІР°РЅРёСЏ вЂ” РїР°РЅРµР»СЊ С‡РµСЃС‚РЅРѕ РїРѕРєР°Р·С‹РІР°РµС‚ В«РѕС‚РїСЂР°РІР»РµРЅРѕВ».</p></div>
 <p class="description">РџРµСЂРµРєР»СЋС‡РµРЅРёРµ С‚СЂРµРєРѕРІ, РїР°СѓР·Р° Рё РіСЂРѕРјРєРѕСЃС‚СЊ РґРѕСЃС‚СѓРїРЅС‹ РїСЂРё РїРѕРґРґРµСЂР¶РєРµ РёРЅС‚РµРіСЂР°С†РёРµР№. РљРѕРјР°РЅРґС‹ РІС‹РїРѕР»РЅСЏСЋС‚СЃСЏ СЃС‚Р°РЅС†РёРµР№ РІ РєРѕСЂРёРґРѕСЂРµ, РЅРµ Р±СЂР°СѓР·РµСЂРѕРј. РџСЂРё РїРѕС‚РµСЂРµ СЃРІСЏР·Рё СѓРїСЂР°РІР»РµРЅРёРµ Р±Р»РѕРєРёСЂСѓРµС‚СЃСЏ.</p>`;
 return `<h2>РЎС‚Р°РЅС†РёСЏ В· ${esc(stationRoom())}</h2><p class="description">Р“РѕР»РѕСЃ Рё РјСѓР·С‹РєР°. Р­С‚Рѕ РґРµРјРѕРЅСЃС‚СЂР°С†РёРѕРЅРЅРѕРµ СѓРїСЂР°РІР»РµРЅРёРµ, РЅРµ РЅР°СЃС‚РѕСЏС‰Р°СЏ СЃС‚Р°РЅС†РёСЏ.</p>
 <div class="inline-note">${offline?'РќРµС‚ СЃРІСЏР·Рё В· РґРµРјРѕРЅСЃС‚СЂР°С†РёСЏ':enabled?'Р”РµРјРѕСѓРїСЂР°РІР»РµРЅРёРµ РІРєР»СЋС‡РµРЅРѕ РґР»СЏ РїСЂРѕРІРµСЂРєРё РёРЅС‚РµСЂС„РµР№СЃР°. Р­С‚Рѕ РЅРµ СЃРІСЏР·СЊ СЃ СЂРµР°Р»СЊРЅРѕР№ СЃС‚Р°РЅС†РёРµР№.':'РќРµ РїРѕРґРєР»СЋС‡РµРЅР° Рє РїР°РЅРµР»Рё. Р РµР°Р»СЊРЅС‹Р№ СЃС‚Р°С‚СѓСЃ Рё РІРѕР·РјРѕР¶РЅРѕСЃС‚Рё РїРѕРєР° РЅРµРёР·РІРµСЃС‚РЅС‹.'}</div>
 <div class="control-group"><div class="control-row"><div><h3>Р’РѕСЃРїСЂРѕРёР·РІРµРґРµРЅРёРµ</h3><p>${enabled?(state.stationPlaying?'РРіСЂР°РµС‚ В· РґРµРјРѕ, Р±РµР· Р°СѓРґРёРѕРїРѕС‚РѕРєР°':'РџР°СѓР·Р° В· РґРµРјРѕ'):'Р”РѕСЃС‚СѓРїРЅРѕСЃС‚СЊ СѓС‚РѕС‡РЅРёРј РїРѕСЃР»Рµ РёРЅС‚РµРіСЂР°С†РёРё'}</p></div>
 <button class="icon-button" data-action="station-play" aria-label="${state.stationPlaying?'РџР°СѓР·Р°':'Р’РѕСЃРїСЂРѕРёР·РІРµСЃС‚Рё'}" ${disabled(!enabled||hasPending())}>${I(state.stationPlaying?'pause':'play')}</button></div>${phaseLine('station:playing')}</div>
 <div class="rgb-control"><label for="station-volume">Р“СЂРѕРјРєРѕСЃС‚СЊ <span id="station-volume-label">${enabled?state.stationVolume+' % В· РґРµРјРѕ':'РќРµРґРѕСЃС‚СѓРїРЅР°'}</span></label>
 <input id="station-volume" type="range" min="0" max="100" value="${state.stationVolume}" ${disabled(!enabled||hasPending())}/>${phaseLine('station:volume')}</div>
 <p class="description">Р­С‚Рё С„СѓРЅРєС†РёРё СѓСЃР»РѕРІРЅРѕ РїРѕРєР°Р·Р°РЅС‹ РІ РґРµРјРѕСЂРµР¶РёРјРµ. Р’ СЂР°Р±РѕС‡РµР№ РІРµСЂСЃРёРё РїРѕСЏРІСЏС‚СЃСЏ С‚РѕР»СЊРєРѕ РїРѕРґС‚РІРµСЂР¶РґС‘РЅРЅС‹Рµ РІРѕР·РјРѕР¶РЅРѕСЃС‚Рё РёРЅС‚РµРіСЂР°С†РёРё. Р­С‚Р° РІРµР±-РїР°РЅРµР»СЊ РЅРµ РїСЂРµРґРЅР°Р·РЅР°С‡РµРЅР° РґР»СЏ Р·Р°РїСѓСЃРєР° РЅР° СЌРєСЂР°РЅРµ СЃС‚Р°РЅС†РёРё.</p>`;
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
 if(!isLive()){duoUI.listError='РќСѓР¶РµРЅ РїРѕРґРєР»СЋС‡С‘РЅРЅС‹Р№ HA.';paintDuo();return}
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
  if(result.warnings?.length)duoUI.message+=' Р—Р°РјРµС‡Р°РЅРёСЏ: '+result.warnings.map(w=>(w.room?areaName(w.room)+' / ':'')+w.name+(w.kind==='unknown'?' вЂ” РЅРµС‚ РґР°РЅРЅС‹С…':w.kind==='alarm'?' вЂ” С‚СЂРµРІРѕРіР°':' вЂ” РѕС‚РєСЂС‹С‚Р°')).join('; ');
  if(result.results?.some(r=>!r.ok))duoUI.message+=' РќРµ РїРѕРґС‚РІРµСЂР¶РґРµРЅРѕ: '+result.results.filter(r=>!r.ok).map(r=>(r.room?areaName(r.room)+' / ':'')+r.name).join('; ');
  if(result.speech?.phase==='unknown')duoUI.message+=' РћР·РІСѓС‡РёРІР°РЅРёРµ РЅРµ РїРѕРґС‚РІРµСЂР¶РґРµРЅРѕ.';
 }catch(error){duoUI.error=error.message;duoUI.phase='unknown'}
 finally{duoUI.busy=false;paintDuo();if(duoOpen())$('.sheet').scrollTop=0;await refreshDuo()}
}
function sensorSheet(id){
 const s=sensors[id],name={living:'Р“РѕСЃС‚РёРЅР°СЏ',well:'РЎРєРІР°Р¶РёРЅР°',attic:'Р§РµСЂРґР°Рє'}[id];
 const d=state.devices.find(d=>d.type==='temperature'&&d.room===id&&d.status==='installed'),times=stateTimes(d?observed(d.id):null);
 const stamp=at=>at?new Date(at).toLocaleString('ru-RU',{timeZone:PANEL_TIMEZONE}):'РќРµС‚ РґРѕСЃС‚РѕРІРµСЂРЅРѕР№ РјРµС‚РєРё';
 return `<h2>РўРµРјРїРµСЂР°С‚СѓСЂР° В· ${name}</h2><p class="description">${sensorStatus(id)}</p>
 <div class="sensor-detail">${noConnection()||s.quality==='unavailable'?'вЂ”':reading(s.value)} В°C <span>${noConnection()||s.humidity===null?'вЂ”':s.humidity+' %'} РІР»Р°Р¶РЅРѕСЃС‚Рё</span></div>
 <div class="inline-note">${isLive()?(s.quality==='unavailable'||noConnection()?'РќРµС‚ РґРѕСЃС‚СѓРїРЅРѕРіРѕ РїСЂРѕРІРµСЂРµРЅРЅРѕРіРѕ СЃРѕСЃС‚РѕСЏРЅРёСЏ HA.':'HA РѕС‚РґР°С‘С‚ СЌС‚Рѕ Р·РЅР°С‡РµРЅРёРµ. Р”Р°РІРЅРѕСЃС‚СЊ РёР·РјРµРЅРµРЅРёСЏ РЅРµ РѕР·РЅР°С‡Р°РµС‚ РЅРµРёСЃРїСЂР°РІРЅРѕСЃС‚СЊ; РЅРѕРІРѕРµ С„РёР·РёС‡РµСЃРєРѕРµ РёР·РјРµСЂРµРЅРёРµ СЌС‚РёРј РЅРµ РїРѕРґС‚РІРµСЂР¶РґР°РµС‚СЃСЏ.'):'Р­С‚Рѕ РґРµРјРѕРЅСЃС‚СЂР°С†РёРѕРЅРЅС‹Р№ РїСЂРёРјРµСЂ, РЅРµ РёР·РјРµСЂРµРЅРёРµ РёР· С‚РІРѕРµРіРѕ РґРѕРјР°.'}</div>
 ${isLive()?`<details class="sensor-meta"><summary>Р’СЂРµРјРµРЅРЅС‹Рµ РјРµС‚РєРё HA</summary><dl class="sensor-provenance"><div><dt>РР·РјРµРЅРµРЅРёРµ Р·РЅР°С‡РµРЅРёСЏ</dt><dd>${stamp(times.changedAt)}</dd></div><div><dt>РР·РјРµРЅРµРЅРёРµ СЃРѕСЃС‚РѕСЏРЅРёСЏ РёР»Рё Р°С‚СЂРёР±СѓС‚РѕРІ</dt><dd>${stamp(times.updatedAt)}</dd></div><div><dt>Р—Р°РїРёСЃСЊ СЃРѕСЃС‚РѕСЏРЅРёСЏ РІ HA</dt><dd>${stamp(times.reportedAt)}</dd></div><div><dt>РџРѕСЃР»РµРґРЅРёР№ СѓСЃРїРµС€РЅС‹Р№ РѕРїСЂРѕСЃ HA РїР°РЅРµР»СЊСЋ</dt><dd>${stamp(state.liveUpdatedAt||null)}</dd></div></dl><p class="history-footnote">РћРїСЂРѕСЃ HA РЅРµ СЃС‡РёС‚Р°РµС‚СЃСЏ РѕС‚С‡С‘С‚РѕРј РґР°С‚С‡РёРєР°. Р”Р»СЏ РєРѕРЅС‚СЂРѕР»СЏ РјРѕР»С‡Р°РЅРёСЏ С„РёР·РёС‡РµСЃРєРѕРіРѕ СѓСЃС‚СЂРѕР№СЃС‚РІР° РЅСѓР¶РЅР° РґРѕСЃС‚РѕРІРµСЂРЅР°СЏ РјРµС‚РєР° last_seen РµРіРѕ РёРЅС‚РµРіСЂР°С†РёРё.</p></details><button class="secondary sensor-history-link" data-history-zone="${id}">РСЃС‚РѕСЂРёСЏ РїРѕРєР°Р·Р°РЅРёР№ ${I('arrow-up-right')}</button>`:`<p class="description">Р’СЂРµРјСЏ РґРµРјРѕРЅСЃС‚СЂР°С†РёРѕРЅРЅРѕРіРѕ РїСЂРёРјРµСЂР°: ${s.receivedAt?stamp(s.receivedAt):'РЅРµРёР·РІРµСЃС‚РЅРѕ'}.</p>`}`;
}
function settings(){
 const tab=state.settingsTab;
 return `<h2>РќР°СЃС‚СЂРѕР№РєРё РїР°РЅРµР»Рё</h2><p id="storage-status" class="storage-status ${state.storage}">${esc(state.storageMessage)}</p>
 <div class="settings-tabs" role="tablist">${[['panel','РџР°РЅРµР»СЊ'],['favorites','РР·Р±СЂР°РЅРЅРѕРµ']].map(([id,title])=>
 `<button role="tab" aria-selected="${tab===id}" class="${tab===id?'active':''}" data-settings-tab="${id}">${title}</button>`).join('')}</div>
 ${tab==='panel'?panelSettings():favoriteSettings()}`;
}
function panelSettings(){
 return `<div class="panel-settings-grid"><section class="settings-section"><h3>Р­РєСЂР°РЅ Рё СЂРµР¶РёРј РѕР¶РёРґР°РЅРёСЏ</h3><label class="setting-field">Р РµР¶РёРј РѕР¶РёРґР°РЅРёСЏ<select id="idle-setting">${[[0,'Р’С‹РєР»СЋС‡РµРЅ'],[10,'10 СЃРµРєСѓРЅРґ В· РґР»СЏ РїСЂРѕРІРµСЂРєРё'],[60,'Р§РµСЂРµР· РјРёРЅСѓС‚Сѓ'],[90,'Р§РµСЂРµР· 90 СЃРµРєСѓРЅРґ'],[180,'Р§РµСЂРµР· 3 РјРёРЅСѓС‚С‹']].map(([v,l])=>`<option value="${v}" ${state.idleSeconds===v?'selected':''}>${l}</option>`).join('')}</select></label>
 <button class="secondary full-width" data-action="standby">${I('moon-star')}РџРѕСЃРјРѕС‚СЂРµС‚СЊ СЌРєСЂР°РЅ РѕР¶РёРґР°РЅРёСЏ</button>
 <label class="setting-field setting-check"><input id="ambient-setting" type="checkbox" ${state.ambientMode!==false?'checked':''}/>РўРёС…РёР№ СЂРµР¶РёРј</label>
 <p class="setting-help">Р§РµСЂРµР· РјРёРЅСѓС‚Сѓ РїРѕСЃР»Рµ СЌРєСЂР°РЅР° РѕР¶РёРґР°РЅРёСЏ РїР°РЅРµР»СЊ Р·Р°С‚РёС…Р°РµС‚: С‚РѕР»СЊРєРѕ Р±РѕР»СЊС€РёРµ С‡Р°СЃС‹, РґР°С‚Р° Рё С‚РµРјРїРµСЂР°С‚СѓСЂР°. Р›СЋР±РѕРµ РєР°СЃР°РЅРёРµ РІРѕР·РІСЂР°С‰Р°РµС‚ РѕР±С‹С‡РЅС‹Р№ СЂРµР¶РёРј.</p>
 <label class="setting-field">РќРѕС‡РЅРѕР№ РёРЅС‚РµСЂС„РµР№СЃ<select id="night-setting">${[['auto','РђРІС‚РѕРјР°С‚РёС‡РµСЃРєРё В· 22:00вЂ“07:00 РњРЎРљ'],['on','Р’СЃРµРіРґР° РІРєР»СЋС‡С‘РЅ'],['off','Р’С‹РєР»СЋС‡РµРЅ']].map(([v,l])=>`<option value="${v}" ${state.nightMode===v?'selected':''}>${l}</option>`).join('')}</select></label>
 <p class="setting-help">РџСЂРёРіР»СѓС€Р°РµС‚СЃСЏ РѕС„РѕСЂРјР»РµРЅРёРµ РїР°РЅРµР»Рё, РЅРµ Р°РїРїР°СЂР°С‚РЅР°СЏ СЏСЂРєРѕСЃС‚СЊ РїР»Р°РЅС€РµС‚Р°. РЎРІРµС‚ РІ РґРѕРјРµ РЅРµ РїРµСЂРµРєР»СЋС‡Р°РµС‚СЃСЏ.</p>
 </section><section class="settings-section"><h3>РћС„РѕСЂРјР»РµРЅРёРµ Рё РѕР±СЃР»СѓР¶РёРІР°РЅРёРµ</h3><label class="setting-field">РџРѕСЃС‚РѕСЏРЅРЅС‹Р№ СЌРєСЂР°РЅ<select id="kiosk-setting"><option value="off" ${!state.kiosk?'selected':''}>РћР±С‹С‡РЅР°СЏ РїР°РЅРµР»СЊ</option><option value="on" ${state.kiosk?'selected':''}>РљРѕРјРїР°РєС‚РЅС‹Р№ СЂРµР¶РёРј РґР»СЏ СЌРєСЂР°РЅР°</option></select></label>
 <button class="secondary full-width" data-action="fullscreen">${I('maximize')}РџРѕР»РЅС‹Р№ СЌРєСЂР°РЅ</button>
 <p class="setting-help">РџРѕР»РЅС‹Р№ СЌРєСЂР°РЅ РІРєР»СЋС‡Р°РµС‚СЃСЏ РїРѕ РЅР°Р¶Р°С‚РёСЋ; Esc РІРѕР·РІСЂР°С‰Р°РµС‚ РѕР±С‹С‡РЅС‹Р№ СЂРµР¶РёРј. РќР°СЃС‚СЂРѕР№РєРё РЅРµ СЃРєСЂС‹РІР°СЋС‚СЃСЏ Рё РЅРµ Р±Р»РѕРєРёСЂСѓСЋС‚СЃСЏ РїР°СЂРѕР»РµРј.</p>
 <label class="setting-field">Р¤РѕС‚Рѕ РґР»СЏ СЌРєСЂР°РЅР° РѕР¶РёРґР°РЅРёСЏ<input id="hero-upload" type="file" accept="image/jpeg,image/png,image/webp"/></label>
 <p class="setting-help">${state.preview?'Р’ РїСЂРµРІСЊСЋ С„РѕС‚Рѕ РѕСЃС‚Р°С‘С‚СЃСЏ РІРѕ РІРєР»Р°РґРєРµ. РџРѕСЃС‚РѕСЏРЅРЅРѕРµ СЃРѕС…СЂР°РЅРµРЅРёРµ РґРѕСЃС‚СѓРїРЅРѕ С‚РѕР»СЊРєРѕ РїСЂРё Р»РѕРєР°Р»СЊРЅРѕРј Р·Р°РїСѓСЃРєРµ.':'Р¤РѕС‚Рѕ СЃРЅР°С‡Р°Р»Р° РѕСЃС‚Р°С‘С‚СЃСЏ РІРѕ РІРєР»Р°РґРєРµ. РџРѕ РѕС‚РґРµР»СЊРЅРѕР№ РєРЅРѕРїРєРµ СЃРѕС…СЂР°РЅСЏРµС‚СЃСЏ РІ Р»РѕРєР°Р»СЊРЅСѓСЋ Р±Р°Р·Сѓ РЅР° СЌС‚РѕРј РєРѕРјРїСЊСЋС‚РµСЂРµ.'} Р”Рѕ 10 РњР‘; СЃРѕС…СЂР°РЅСЏРµРј СѓРјРµРЅСЊС€РµРЅРЅС‹Р№ JPEG.</p>
 ${state.heroURL&&photoBlob&&!state.preview?'<button class="secondary full-width" data-action="save-photo">РЎРѕС…СЂР°РЅРёС‚СЊ С„РѕС‚Рѕ РЅР° СЌС‚РѕРј РєРѕРјРїСЊСЋС‚РµСЂРµ</button>':''}
 ${state.heroURL?'<button class="text-button" data-action="reset-photo">Р’РµСЂРЅСѓС‚СЊ РёРЅС‚РµСЂСЊРµСЂРЅС‹Р№ СЂРµС„РµСЂРµРЅСЃ</button>':''}
 <div class="technical-entry"><button class="text-button" data-action="technical">${I('settings-2')}РўРµС…РЅРёС‡РµСЃРєРёР№ СЂР°Р·РґРµР»</button><button class="text-button" data-action="about">${I('info')}Рћ РїР°РЅРµР»Рё</button></div></section></div>`;
}
function favoriteSettings(){
 return `<p class="setting-help">Р”Рѕ С€РµСЃС‚Рё РєРѕРјРЅР°С‚. РџРѕСЂСЏРґРѕРє СЃРїРёСЃРєР° СЃРѕРІРїР°РґР°РµС‚ СЃ РїРѕСЂСЏРґРєРѕРј РЅР° РіР»Р°РІРЅРѕР№.</p>
 <div class="favorite-list">${state.favorites.map((id,i)=>`<div class="favorite-row"><span>${I(getRoom(id).icon)}${getRoom(id).short}</span>
 <div><button class="icon-button" aria-label="РџРѕРґРЅСЏС‚СЊ ${getRoom(id).short}" data-move="${id}" data-step="-1" ${disabled(i===0)}>${I('chevron-up')}</button>
 <button class="icon-button" aria-label="РћРїСѓСЃС‚РёС‚СЊ ${getRoom(id).short}" data-move="${id}" data-step="1" ${disabled(i===state.favorites.length-1)}>${I('chevron-down')}</button>
 <button class="icon-button" aria-label="РЈР±СЂР°С‚СЊ ${getRoom(id).short}" data-favorite="${id}">${I('x')}</button></div></div>`).join('')}</div>
 ${state.favorites.length<6?`<div class="favorite-add">${rooms.filter(r=>!state.favorites.includes(r.id)).map(r=>`<button class="secondary" data-favorite="${r.id}">${I('star')}${r.short}</button>`).join('')}</div>`:'<p class="setting-help">РЈР±РµСЂРё РѕРґРЅСѓ РєРѕРјРЅР°С‚Сѓ, С‡С‚РѕР±С‹ РґРѕР±Р°РІРёС‚СЊ РґСЂСѓРіСѓСЋ.</p>'}
 ${!state.favorites.length?'<div class="inline-note">Р’С‹Р±РµСЂРё С…РѕС‚СЏ Р±С‹ РѕРґРЅСѓ РєРѕРјРЅР°С‚Сѓ РґР»СЏ РіР»Р°РІРЅРѕР№.</div>':''}`;
}
function testSettings(){
 return `<div class="inline-note">${isLive()?'Р’ СЂР°Р±РѕС‡РµРј СЂРµР¶РёРјРµ СЃРёРјСѓР»СЏС‚РѕСЂ Р·Р°Р±Р»РѕРєРёСЂРѕРІР°РЅ. Р”Р»СЏ РїСЂРѕРІРµСЂРєРё РѕС€РёР±РѕРє РїРµСЂРµРєР»СЋС‡РёСЃСЊ РЅР° РґРµРјРѕРЅСЃС‚СЂР°С†РёРѕРЅРЅС‹Р№ РёСЃС‚РѕС‡РЅРёРє.':'Р’СЃРµ РїРµСЂРµРєР»СЋС‡Р°С‚РµР»Рё РЅРёР¶Рµ РјРѕРґРµР»РёСЂСѓСЋС‚ СЃРѕСЃС‚РѕСЏРЅРёСЏ. РћРЅРё РЅРµ РѕС‚РєР»СЋС‡Р°СЋС‚ РЅР°СЃС‚РѕСЏС‰РёРµ СѓСЃС‚СЂРѕР№СЃС‚РІР°.'}</div>
 <label class="setting-field">РЎРІСЏР·СЊ СЃ РґРµРјРѕСѓСЃС‚СЂРѕР№СЃС‚РІР°РјРё<select id="network-setting" ${disabled(isLive())}><option value="online" ${!state.demoOffline?'selected':''}>Р”РµРјРѕСЃРІСЏР·СЊ РґРѕСЃС‚СѓРїРЅР°</option><option value="offline" ${state.demoOffline?'selected':''}>РРјРёС‚РёСЂРѕРІР°С‚СЊ РїРѕС‚РµСЂСЋ СЃРІСЏР·Рё</option></select></label>
 <button class="secondary full-width" data-action="fail-next" ${disabled(isLive()||state.failNext||hasPending())}>${I('triangle-alert')}${state.failNext?'РЎР»РµРґСѓСЋС‰Р°СЏ РєРѕРјР°РЅРґР° Р·Р°РІРµСЂС€РёС‚СЃСЏ РѕС€РёР±РєРѕР№':'РћС€РёР±РєР° СЃР»РµРґСѓСЋС‰РµР№ РєРѕРјР°РЅРґС‹'}</button>
 <label class="setting-field">РљР°СЂС‚РѕС‡РєР° Р”СѓРѕ РњР°РєСЃ<select id="station-setting" ${disabled(isLive())}>${[['unconfigured','РќРµ РїРѕРґРєР»СЋС‡РµРЅР° В· РѕР±С‹С‡РЅС‹Р№ СЂРµР¶РёРј'],['demo','Р’РєР»СЋС‡РёС‚СЊ СѓСЃР»РѕРІРЅРѕРµ РґРµРјРѕСѓРїСЂР°РІР»РµРЅРёРµ'],['offline','РРјРёС‚РёСЂРѕРІР°С‚СЊ РЅРµС‚ СЃРІСЏР·Рё']].map(([v,l])=>`<option value="${v}" ${state.stationMode===v?'selected':''}>${l}</option>`).join('')}</select></label>
 <div class="command-log"><h3>РџРѕСЃР»РµРґРЅРёРµ РєРѕРјР°РЅРґС‹ В· ${isLive()?'Home Assistant':'РґРµРјРѕ'}</h3>${state.commandHistory.length?state.commandHistory.slice(0,5).map(c=>
 `<div><span>${esc(commandLabel(c.id))}<small>${timeOf(c.finishedAt)}</small></span><strong class="${c.phase}">${c.phase==='success'?'РџРѕРґС‚РІРµСЂР¶РґРµРЅРѕ':'РћС€РёР±РєР°'}</strong></div>`).join(''):'<p class="setting-help">РџРѕРєР° РєРѕРјР°РЅРґ РЅРµС‚.</p>'}</div>`;
}
function commandLabel(id){
 if(id.startsWith('rgb:'))return 'RGB-Р»Р°РјРїР°';
 if(id.startsWith('station:'))return 'Р”СѓРѕ РњР°РєСЃ';
 const [r,i]=id.split(':');return (getRoom(r)?.short||r)+' В· '+(getRoom(r)?.channels[Number(i)]?.name||'');
}
function updateHeader(){
 const node=$('#connection-badge'),summary=homeLightSummary(),warning=isLive()&&summary.warning;
 const label=warning?summary.label:isLive()?'Home Assistant':'Р”РµРјРѕРЅСЃС‚СЂР°С†РёРѕРЅРЅС‹Р№ СЂРµР¶РёРј';
 node.innerHTML=`<span></span>${esc(label)}`;node.dataset.warning=String(warning);
 node.title=isLive()?[state.liveError||'Home Assistant',summary.detail].join(' В· '):'Р РµР°Р»СЊРЅС‹Рµ СѓСЃС‚СЂРѕР№СЃС‚РІР° РЅРµ РїРѕРґРєР»СЋС‡РµРЅС‹';
 node.setAttribute('aria-label',`${label}. РћС‚РєСЂС‹С‚СЊ РЅР°СЃС‚СЂРѕР№РєРё РїРѕРґРєР»СЋС‡РµРЅРёСЏ`);
 document.documentElement.dataset.mode=state.mode;
}
function catalogSettings(){
 const d=catalogEdit==='new'?{type:'light',room:'corridor',name:'',status:'planned',note:'',masterOff:false}:state.devices.find(d=>d.id===catalogEdit);
 if(d)return `<div class="eyebrow">${d.id?'Р РµРґР°РєС‚РёСЂРѕРІР°РЅРёРµ В· '+esc(d.id):'РќРѕРІРѕРµ СѓСЃС‚СЂРѕР№СЃС‚РІРѕ'}</div>
  <label class="setting-field">РўРёРї<select id="catalog-type" ${disabled(!!d.id)}>${Object.entries(deviceTypes).map(([id,t])=>`<option value="${id}" ${d.type===id?'selected':''}>${t.label}</option>`).join('')}</select></label>
  <label class="setting-field">РљРѕРјРЅР°С‚Р° / Р·РѕРЅР°<select id="catalog-room">${areas.map(a=>`<option value="${a.id}" ${d.room===a.id?'selected':''}>${a.name}</option>`).join('')}</select></label>
  <label class="setting-field">РќР°Р·РІР°РЅРёРµ<input id="catalog-name" value="${esc(d.name)}" maxlength="64" placeholder="РќР°РїСЂРёРјРµСЂ, РєРѕСЂРёРґРѕСЂ В· РѕСЃРЅРѕРІРЅРѕР№ СЃРІРµС‚"/></label>
  <label class="setting-field">РќР°Р»РёС‡РёРµ<select id="catalog-status"><option value="planned" ${d.status==='planned'?'selected':''}>РџР»Р°РЅРёСЂСѓРµС‚СЃСЏ</option><option value="installed" ${d.status==='installed'?'selected':''}>РЈСЃС‚Р°РЅРѕРІР»РµРЅРѕ</option></select></label>
  <label class="setting-field">РџСЂРёРјРµС‡Р°РЅРёРµ<input id="catalog-note" maxlength="240" value="${esc(d.note)}"/></label>
  <label class="check-field"><input id="catalog-master" type="checkbox" ${d.masterOff?'checked':''} ${disabled(!!d.powerId)}/>Р’РєР»СЋС‡РёС‚СЊ РІ РјР°СЃС‚РµСЂ-РІС‹РєР»СЋС‡РµРЅРёРµ СЃРІРµС‚Р° (С‚РѕР»СЊРєРѕ РґР»СЏ СЃРІРµС‚РѕРІС‹С… СѓСЃС‚СЂРѕР№СЃС‚РІ)</label>
  <div class="inline-note">ID РїРѕСЃС‚РѕСЏРЅРЅС‹Р№. РР·РјРµРЅРµРЅРёРµ РєРѕРјРЅР°С‚С‹ РёР»Рё РЅР°Р»РёС‡РёСЏ СЃРЅРёРјР°РµС‚ РїСЂРѕРІРµСЂРєСѓ РїСЂРёРІСЏР·РєРё. РљРѕС‚С‘Р», РЅР°СЃРѕСЃ Рё РІРѕСЂРѕС‚Р° РѕСЃС‚Р°СЋС‚СЃСЏ Р·Р°Р±Р»РѕРєРёСЂРѕРІР°РЅРЅС‹РјРё РЅРµР·Р°РІРёСЃРёРјРѕ РѕС‚ РЅР°СЃС‚СЂРѕРµРє.</div>
  <div class="sheet-actions"><button class="primary" data-action="save-device" ${disabled(hasPending())}>РЎРѕС…СЂР°РЅРёС‚СЊ СѓСЃС‚СЂРѕР№СЃС‚РІРѕ</button><button class="secondary" data-action="catalog-back">Рљ СЃРїРёСЃРєСѓ</button></div>`;
 return `<p class="setting-help">РљР°Р¶РґР°СЏ РєР»Р°РІРёС€Р° РІС‹РєР»СЋС‡Р°С‚РµР»СЏ РґРѕР±Р°РІР»СЏРµС‚СЃСЏ РѕС‚РґРµР»СЊРЅРѕР№ Р»РёРЅРёРµР№. РљР°С‚Р°Р»РѕРі, РЅР°Р·РІР°РЅРёСЏ Рё РїРѕСЂСЏРґРѕРє СЃРѕС…СЂР°РЅСЏСЋС‚СЃСЏ Р»РѕРєР°Р»СЊРЅРѕ Рё РІС…РѕРґСЏС‚ РІ JSON-РєРѕРїРёСЋ. Р”Рѕ 128 СѓСЃС‚СЂРѕР№СЃС‚РІ.</p>
  <button class="primary full-width" data-action="new-device" ${disabled(hasPending()||state.devices.length>=128)}>Р”РѕР±Р°РІРёС‚СЊ СѓСЃС‚СЂРѕР№СЃС‚РІРѕ</button>
  <div class="catalog-list">${state.devices.map((d,i)=>`<article class="binding-card catalog-item"><div class="title-line"><h3>${esc(d.name)}</h3>${I(deviceTypes[d.type].icon)}</div><p>${esc(areaName(d.room))} В· ${deviceTypes[d.type].label} В· ${d.status==='planned'?'РїР»Р°РЅРёСЂСѓРµС‚СЃСЏ':'СѓСЃС‚Р°РЅРѕРІР»РµРЅРѕ'}</p><code>${d.id}</code><div class="catalog-actions"><button class="secondary" data-edit-device="${d.id}" ${disabled(hasPending())}>РР·РјРµРЅРёС‚СЊ</button><button class="icon-button" data-order-device="${d.id}" data-step="-1" aria-label="РџРѕРґРЅСЏС‚СЊ ${esc(d.name)}" ${disabled(i===0||hasPending())}>${I('chevron-up')}</button><button class="icon-button" data-order-device="${d.id}" data-step="1" aria-label="РћРїСѓСЃС‚РёС‚СЊ ${esc(d.name)}" ${disabled(i===state.devices.length-1||hasPending())}>${I('chevron-down')}</button><button class="text-button" data-delete-device="${d.id}" ${disabled(hasPending())}>РЈРґР°Р»РёС‚СЊ</button></div></article>`).join('')}</div>`;
}
async function commitCatalog(next){
 if(hasPending())return;
 const old=preferences();
 try{applyPreferences(next);await flushStorage();state.commands.clear();startLive(refresh);refresh();catalogEdit=null;techMessage='РљР°С‚Р°Р»РѕРі СЃРѕС…СЂР°РЅС‘РЅ. РќРѕРІС‹Рµ Рё РїРµСЂРµРјРµС‰С‘РЅРЅС‹Рµ СѓСЃС‚СЂРѕР№СЃС‚РІР° С‚СЂРµР±СѓСЋС‚ РїСЂРѕРІРµСЂРєРё РїСЂРёРІСЏР·РєРё.';updateTechnical()}
 catch(error){applyPreferences(old);techMessage='РљР°С‚Р°Р»РѕРі РЅРµ РёР·РјРµРЅС‘РЅ: '+error.message;updateTechnical()}
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
  techMessage='РЎС‚СЂСѓРєС‚СѓСЂР° СЃРѕС…СЂР°РЅРµРЅР°. Entity_id Рё РѕС‚РјРµС‚РєРё РїСЂРѕРІРµСЂРєРё РЅРµ РјРµРЅСЏР»РёСЃСЊ.';
  refresh();updateTechnical();
 }catch(error){
  applyPreferences(old);techMessage='РЎС‚СЂСѓРєС‚СѓСЂР° РЅРµ РёР·РјРµРЅРµРЅР°: '+error.message;updateTechnical();
 }
}
function technical(){
 const ready=readiness();
 const tabs=[['connection','РЎРІСЏР·СЊ'],['structure','РЈСЃС‚СЂРѕР№СЃС‚РІР°'],['catalog','РљР°С‚Р°Р»РѕРі'],['bindings','РџСЂРёРІСЏР·РєРё'],['diagnostics','РџСЂРѕРІРµСЂРєР°'],['backup','РљРѕРїРёСЏ'],['checklist','РќР° РјРµСЃС‚Рµ']];
 let content='';
 if(techTab==='connection')content=`
  ${!state.preview?houseProfileReview():''}
  <div class="connection-status">${I(state.liveOnline?'circle-check':'radio')}<div><h3>${state.liveOnline?'РЎРѕСЃС‚РѕСЏРЅРёСЏ Home Assistant РґРѕСЃС‚СѓРїРЅС‹':state.haConfigured?'РђРґСЂРµСЃ Рё С‚РѕРєРµРЅ Р·Р°РґР°РЅС‹ РЅР° СЃРµСЂРІРµСЂРµ':'Р”РѕРј РїРѕРєР° РЅРµ РїРѕРґРєР»СЋС‡С‘РЅ'}</h3><p>${state.preview?'Р­С‚Рѕ РїСЂРёРІР°С‚РЅРѕРµ РґРµРјРѕРїСЂРµРІСЊСЋ. Р”РѕСЃС‚СѓРї Рє РґРѕРјСѓ РІ РЅС‘Рј РѕС‚РєР»СЋС‡С‘РЅ.':esc(state.liveError||'РЎРёРЅС…СЂРѕРЅРёР·Р°С†РёСЏ СЂР°Р· РІ 5 СЃРµРєСѓРЅРґ')}</p></div></div>
  <label class="setting-field">РСЃС‚РѕС‡РЅРёРє РґР°РЅРЅС‹С…<select id="mode-setting" ${disabled(hasPending())}><option value="demo" ${!isLive()?'selected':''}>Р”РµРјРѕРЅСЃС‚СЂР°С†РёРѕРЅРЅС‹Р№ РјР°РєРµС‚</option><option value="live" ${isLive()?'selected':''}>Home Assistant В· СЂРµР°Р»СЊРЅС‹Рµ СЃРѕСЃС‚РѕСЏРЅРёСЏ</option></select></label>
  <label class="setting-field setting-check"><input id="auto-theme-setting" type="checkbox" ${state.autoTheme?'checked':''} ${disabled(!state.autoTheme&&terraceLux()===null)}/>РўРµРјР° РїРѕ РѕСЃРІРµС‰С‘РЅРЅРѕСЃС‚Рё</label>
  <p class="setting-help">${terraceLux()!==null?`РћСЃРІРµС‰С‘РЅРЅРѕСЃС‚СЊ С‚РµСЂСЂР°СЃС‹ СЃРµР№С‡Р°СЃ ${Math.round(terraceLux())} Р»Рє: РѕС‚ ${AUTO_THEME_UP} Р»Рє вЂ” СЃРІРµС‚Р»Р°СЏ С‚РµРјР°, РЅРёР¶Рµ ${AUTO_THEME_DOWN} Р»Рє вЂ” С‚С‘РјРЅР°СЏ. РџРѕРєР° Р°РІС‚Рѕ-С‚РµРјР° СЂР°Р±РѕС‚Р°РµС‚, СЂСѓС‡РЅРѕР№ РїРµСЂРµРєР»СЋС‡Р°С‚РµР»СЊ С‚РµРјС‹ Р·Р°Р±Р»РѕРєРёСЂРѕРІР°РЅ.`:'РќСѓР¶РЅР° РїСЂРѕРІРµСЂРµРЅРЅР°СЏ РїСЂРёРІСЏР·РєР° В«РћСЃРІРµС‰С‘РЅРЅРѕСЃС‚СЊ С‚РµСЂСЂР°СЃС‹В» Рё С‡РёСЃР»Рѕ Р»Рє РёР· Home Assistant вЂ” Р±РµР· РґР°РЅРЅС‹С… РѕРїС†РёСЏ РЅРµРґРѕСЃС‚СѓРїРЅР°.'}</p>
  <div class="inline-note">Р’ СЂР°Р±РѕС‡РµРј СЂРµР¶РёРјРµ РЅРµС‚ РїРѕРґСЃС‚Р°РЅРѕРІРєРё РґРµРјРѕРґР°РЅРЅС‹С…: РґРѕ РїРѕР»СѓС‡РµРЅРёСЏ СЃРѕСЃС‚РѕСЏРЅРёСЏ Р»РёРЅРёРё Рё РґР°С‚С‡РёРєРё РЅРµРґРѕСЃС‚СѓРїРЅС‹.</div>
  ${state.addon?'<ol class="setup-list"><li>Home Panel СЂР°Р±РѕС‚Р°РµС‚ РЅР° СЃРёСЃС‚РµРјРЅРёРєРµ Home Assistant OS.</li><li>Р”РѕСЃС‚СѓРї Рє HA РЅР°СЃС‚СЂРѕРµРЅ Р°РІС‚РѕРјР°С‚РёС‡РµСЃРєРё С‡РµСЂРµР· Supervisor. .env Рё Р»РёС‡РЅС‹Р№ С‚РѕРєРµРЅ РЅРµ РЅСѓР¶РЅС‹.</li><li>Р’Рѕ РІРєР»Р°РґРєРµ В«РџСЂРёРІСЏР·РєРёВ» Р·Р°РіСЂСѓР·Рё СЃСѓС‰РЅРѕСЃС‚Рё Рё РїСЂРѕРІРµСЂСЊ СЃРѕРѕС‚РІРµС‚СЃС‚РІРёРµ РєР°Р¶РґРѕР№ Р»РёРЅРёРё.</li></ol><p class="setting-help">РќР°СЃС‚СЂРѕР№РєРё СЃРѕС…СЂР°РЅСЏСЋС‚СЃСЏ РІ /data/homepanel. РџР°РЅРµР»СЊ РґРѕСЃС‚СѓРїРЅР° РІ РґРѕРІРµСЂРµРЅРЅРѕР№ РґРѕРјР°С€РЅРµР№ СЃРµС‚Рё; РїРѕСЂС‚ 8090 РЅРµ РІС‹СЃС‚Р°РІР»СЏР№ РІ РёРЅС‚РµСЂРЅРµС‚.</p>':'<ol class="setup-list"><li>Р›РѕРєР°Р»СЊРЅС‹Р№ Р·Р°РїСѓСЃРє С‡РµСЂРµР· <code>Р—Р°РїСѓСЃС‚РёС‚СЊ.cmd</code>.</li><li>РќР° РјРµСЃС‚Рµ СЃРѕР·РґР°Р№ <code>.env</code> РїРѕ РїСЂРёРјРµСЂСѓ. РђРґСЂРµСЃ Рё С‚РѕРєРµРЅ РІРІРѕРґСЏС‚СЃСЏ С‚РѕР»СЊРєРѕ РІ Р»РѕРєР°Р»СЊРЅС‹Р№ С„Р°Р№Р», РЅРµ РІ Р±СЂР°СѓР·РµСЂ Рё РЅРµ РІ С‡Р°С‚.</li><li>РџРµСЂРµР·Р°РїСѓСЃС‚Рё СЃРµСЂРІРµСЂ, Р·Р°РіСЂСѓР·Рё СЃРїРёСЃРѕРє СЃСѓС‰РЅРѕСЃС‚РµР№ Рё РїСЂРѕРІРµСЂСЊ РєР°Р¶РґСѓСЋ РїСЂРёРІСЏР·РєСѓ.</li></ol><p class="setting-help">РўРѕРєРµРЅ РЅРµ РІРєР»СЋС‡Р°РµС‚СЃСЏ РІ СЃР±РѕСЂРєСѓ Рё СЂРµР·РµСЂРІРЅСѓСЋ РєРѕРїРёСЋ. Р›РѕРєР°Р»СЊРЅС‹Р№ СЃРµСЂРІРµСЂ СЃР»СѓС€Р°РµС‚ С‚РѕР»СЊРєРѕ СЌС‚РѕС‚ РєРѕРјРїСЊСЋС‚РµСЂ; СЃРµС‚РµРІРѕР№ РґРѕСЃС‚СѓРї РґР»СЏ РѕС‚РґРµР»СЊРЅРѕРіРѕ РїР»Р°РЅС€РµС‚Р° РЅР°СЃС‚СЂРѕРёРј РїРѕР·Р¶Рµ Р±РµР·РѕРїР°СЃРЅС‹Рј СЃРїРѕСЃРѕР±РѕРј.</p>'}`;
 if(techTab==='catalog')content=catalogSettings();
 if(techTab==='structure')content=deviceStructure(preferences(),{editing:equipmentEdit,esc,areaName,areas,blocked:hasPending()});
 if(techTab==='bindings')content=`
  <div class="readiness"><strong>${ready.verified} / ${ready.total}</strong><span>Р»РёРЅРёР№ СЃРІРµС‚Р° РѕС‚РјРµС‡РµРЅРѕ РїСЂРѕРІРµСЂРµРЅРЅС‹РјРё</span></div>
  <label class="setting-field">Р“СЂСѓРїРїР° СѓСЃС‚СЂРѕР№СЃС‚РІ<select id="binding-room">${[...areas.map(a=>({...a,short:a.name})),{id:'all',short:'Р’СЃРµ СѓСЃС‚СЂРѕР№СЃС‚РІР°'}].map(r=>`<option value="${r.id}" ${bindingRoom===r.id?'selected':''}>${r.short}</option>`).join('')}</select></label>
  <button class="secondary full-width" data-action="discover" ${disabled(hasPending())}>${I('radio')}Р—Р°РіСЂСѓР·РёС‚СЊ СЃСѓС‰РЅРѕСЃС‚Рё РёР· Home Assistant</button>
  <datalist id="ha-entities">${techEntities.map(e=>`<option value="${esc(e.entity_id)}">${esc(e.attributes.friendly_name||e.entity_id)} В· ${esc(e.state)}</option>`).join('')}</datalist>
  <p class="setting-help">РќРµ СѓРіР°РґС‹РІР°РµРј entity_id. Р“Р°Р»РѕС‡РєР° РѕР·РЅР°С‡Р°РµС‚, С‡С‚Рѕ С‚С‹ С„РёР·РёС‡РµСЃРєРё РїСЂРѕРІРµСЂРёР» СЃРѕРѕС‚РІРµС‚СЃС‚РІРёРµ СѓСЃС‚СЂРѕР№СЃС‚РІР° Рё РєР°РЅР°Р»Р°. РќР°Р»РёС‡РёРµ СЃСѓС‰РЅРѕСЃС‚Рё СЃР°РјРѕ РїРѕ СЃРµР±Рµ СЌС‚РѕРіРѕ РЅРµ РґРѕРєР°Р·С‹РІР°РµС‚.</p>
  ${bindingSummary()}
  <div class="binding-grid">${bindingDefinitions(state.devices).filter(b=>bindingRoom==='all'||b.device.room===bindingRoom).map(bindingCard).join('')}</div>
  <button class="primary full-width binding-save" data-action="save-bindings" ${disabled(hasPending())}>РЎРѕС…СЂР°РЅРёС‚СЊ РїСЂРёРІСЏР·РєРё</button>
  <p class="setting-help">РџР»Р°РЅРёСЂСѓРµРјС‹Рµ СѓСЃС‚СЂРѕР№СЃС‚РІР° Р·Р°Р±Р»РѕРєРёСЂРѕРІР°РЅС‹. РљР°РјРµСЂР° РѕС‚РєСЂС‹РІР°РµС‚СЃСЏ РїРѕ РЅР°Р¶Р°С‚РёСЋ; РёРЅР¶РµРЅРµСЂРЅРѕРµ РѕР±РѕСЂСѓРґРѕРІР°РЅРёРµ РґРѕСЃС‚СѓРїРЅРѕ С‚РѕР»СЊРєРѕ РґР»СЏ РЅР°Р±Р»СЋРґРµРЅРёСЏ.</p>`;
 if(techTab==='diagnostics')content=testSettings()+`
  <p class="setting-help">Р–СѓСЂРЅР°Р» С…СЂР°РЅРёС‚СЃСЏ С‚РѕР»СЊРєРѕ РґРѕ РїРµСЂРµР·Р°РїСѓСЃРєР° РІРєР»Р°РґРєРё. Р РµР°Р»СЊРЅС‹Рµ РєРѕРјР°РЅРґС‹ Р°РІС‚РѕРјР°С‚РёС‡РµСЃРєРё РЅРµ РїРѕРІС‚РѕСЂСЏСЋС‚СЃСЏ.</p>
  <button class="secondary full-width" data-action="reconnect" ${disabled(hasPending())}>РџРµСЂРµРїСЂРѕРІРµСЂРёС‚СЊ СЃРІСЏР·СЊ</button>`;
 if(techTab==='backup')content=`
  <div class="inline-note">РљРѕРїРёСЏ v3 СЃРѕРґРµСЂР¶РёС‚ РѕС„РѕСЂРјР»РµРЅРёРµ, РёР·Р±СЂР°РЅРЅРѕРµ, РєР°С‚Р°Р»РѕРі, entity_id Рё РјРѕРґРµР»СЊ СѓСЃС‚СЂРѕР№СЃС‚РІ v1. РЎС‚Р°СЂС‹Рµ РєРѕРїРёРё v3 РїСЂРёРЅРёРјР°СЋС‚СЃСЏ СЃ Р°РІС‚РѕРјР°С‚РёС‡РµСЃРєРёРј СЃРѕР·РґР°РЅРёРµРј СЃС‚СЂСѓРєС‚СѓСЂС‹. Р‘РµР· С‚РѕРєРµРЅР°, С„РѕС‚Рѕ Рё СЃРѕСЃС‚РѕСЏРЅРёР№ СѓСЃС‚СЂРѕР№СЃС‚РІ.</div>
  <button class="primary full-width" data-action="export">${I('download')}РЎРєР°С‡Р°С‚СЊ РЅР°СЃС‚СЂРѕР№РєРё JSON</button>
  <button class="secondary full-width" data-action="profile-export">${I('download')}РЎРєР°С‡Р°С‚СЊ РєРѕРїРёСЋ РїСЂРѕС„РёР»СЏ</button>
  <label class="setting-field">Р’РѕСЃСЃС‚Р°РЅРѕРІРёС‚СЊ РЅР°СЃС‚СЂРѕР№РєРё<input id="import-settings" type="file" accept="application/json,.json" ${disabled(hasPending())}/></label>
  <p class="setting-help">РРјРїРѕСЂС‚ РІСЃРµРіРґР° РІРєР»СЋС‡Р°РµС‚ РґРµРјРѕСЂРµР¶РёРј Рё СЃРЅРёРјР°РµС‚ РѕС‚РјРµС‚РєРё РїСЂРѕРІРµСЂРєРё РєР°РЅР°Р»РѕРІ. РџРµСЂРµРґ СЂР°Р±РѕС‡РёРј СѓРїСЂР°РІР»РµРЅРёРµРј РёС… РїРѕС‚СЂРµР±СѓРµС‚СЃСЏ РїРѕРґС‚РІРµСЂРґРёС‚СЊ СЃРЅРѕРІР°.</p>`;
 if(techTab==='checklist')content=`
  <ul class="site-checklist">
   <li>${I('circle-check')}РџР°РЅРµР»СЊ, СЃРѕС…СЂР°РЅРµРЅРёРµ Рё РґРµРјРѕСЃС†РµРЅР°СЂРёРё РїРѕРґРіРѕС‚РѕРІР»РµРЅС‹</li>
   <li>${I('radio')}Р—Р°РІРµСЂС€РёС‚СЊ РїРµСЂРІРёС‡РЅСѓСЋ РЅР°СЃС‚СЂРѕР№РєСѓ Home Assistant РІ РґРѕРјРµ</li>
   <li>${I('lightbulb')}РџРѕРґРєР»СЋС‡РёС‚СЊ РіРѕСЃС‚РёРЅСѓСЋ Рё РїСЂРѕРІРµСЂРёС‚СЊ РґРІР° РєР°РЅР°Р»Р° СЃРІРµС‚Р°</li>
   <li>${I('door-open')}РџСЂРѕРІРµСЂРёС‚СЊ Р»РµРІС‹Р№ РєР°РЅР°Р» РїСЂРёС…РѕР¶РµР№ Рё РїСЂР°РІС‹Р№ РєР°РЅР°Р» С‚РµСЂСЂР°СЃС‹</li>
   <li>${I('thermometer')}РџСЂРёРІСЏР·Р°С‚СЊ С‚СЂРё С‚РµРјРїРµСЂР°С‚СѓСЂС‹ Рё РІР»Р°Р¶РЅРѕСЃС‚СЊ, РїСЂРѕРІРµСЂРёС‚СЊ РµРґРёРЅРёС†С‹</li>
   <li>${I('scan-eye')}РџСЂРѕРІРµСЂРёС‚СЊ РґР°С‚С‡РёРєРё РґРІРµСЂРё Рё РґС‹РјР°; РїР°РЅРµР»СЊ РЅРµ Р·Р°РјРµРЅСЏРµС‚ СЃРёРіРЅР°Р»РёР·Р°С†РёСЋ</li>
   <li>${I('wifi-off')}РџСЂРѕРІРµСЂРёС‚СЊ РїРѕС‚РµСЂСЋ СЃРІСЏР·Рё Рё РІРѕСЃСЃС‚Р°РЅРѕРІР»РµРЅРёРµ Р±РµР· Р»РѕР¶РЅС‹С… СЃРѕСЃС‚РѕСЏРЅРёР№</li>
   <li>${I('camera')}РћС‚РґРµР»СЊРЅРѕ РїСЂРѕРІРµСЂРёС‚СЊ Tapo Рё РґРѕСЃС‚СѓРїРЅС‹Рµ С„СѓРЅРєС†РёРё Р”СѓРѕ РњР°РєСЃ</li>
   <li>${I('heater')}РќР°СЃРѕСЃ Рё РєРѕС‚С‘Р» РѕСЃС‚Р°РІР»РµРЅС‹ Р·Р°Р±Р»РѕРєРёСЂРѕРІР°РЅРЅС‹РјРё</li>
  </ul><p class="setting-help">Р­С‚РѕС‚ СЃРїРёСЃРѕРє СЏРІР»СЏРµС‚СЃСЏ РїР»Р°РЅРѕРј РїСЂРёС‘РјРєРё, Р° РЅРµ Р·Р°СЏРІР»РµРЅРёРµРј, С‡С‚Рѕ РёРЅС‚РµРіСЂР°С†РёРё СѓР¶Рµ РЅР°СЃС‚СЂРѕРµРЅС‹.</p>`;
 return `<div class="eyebrow">Р”Р»СЏ РЅР°СЃС‚СЂРѕР№РєРё Рё РѕР±СЃР»СѓР¶РёРІР°РЅРёСЏ</div><h2>РўРµС…РЅРёС‡РµСЃРєРёР№ СЂР°Р·РґРµР»</h2><p class="description">РћС‚РґРµР»СЊРЅРѕ РѕС‚ РїРѕРІСЃРµРґРЅРµРІРЅРѕРіРѕ СѓРїСЂР°РІР»РµРЅРёСЏ. Р­С‚Рѕ РЅРµ Р·Р°С‰РёС‰С‘РЅРЅР°СЏ Р°РґРјРёРЅРєР°.</p>
  <div class="settings-tabs tech-tabs" role="tablist">${tabs.map(([id,title])=>`<button role="tab" aria-selected="${techTab===id}" class="${techTab===id?'active':''}" data-tech-tab="${id}">${title}</button>`).join('')}</div>
  ${techMessage?`<div class="inline-note tech-message" role="status">${esc(techMessage)}</div>`:''}${content}`;
}
function houseProfileReview(){
 const devices=state.devices.filter(d=>houseBindings[d.id]&&state.bindings[d.id]?.entityId===houseBindings[d.id]);
 return `<section class="house-profile"><h3>РџСЂРѕС„РёР»СЊ С‚РІРѕРµРіРѕ РґРѕРјР°</h3><p class="setting-help">${state.houseProfileConfirmed?'РџСЂРѕС„РёР»СЊ СѓР¶Рµ РїРѕРґС‚РІРµСЂР¶РґС‘РЅ. РџРѕРІС‚РѕСЂРЅР°СЏ РїСЂРѕРІРµСЂРєР° РґРѕСЃС‚СѓРїРЅР° Р·РґРµСЃСЊ; РЅРµРґРѕСЃС‚СѓРїРЅС‹Рµ РґР°С‚С‡РёРєРё РЅРµ РѕР·РЅР°С‡Р°СЋС‚, С‡С‚Рѕ РґРѕРј РЅРµ РїРѕРґРєР»СЋС‡С‘РЅ.':'РџСЂРѕРІРµСЂСЊ СЃРѕРѕС‚РІРµС‚СЃС‚РІРёСЏ РїРµСЂРµРґ РїРµСЂРІС‹Рј РІРєР»СЋС‡РµРЅРёРµРј СѓРїСЂР°РІР»РµРЅРёСЏ.'} РўРµРјРїРµСЂР°С‚СѓСЂР°, РІР»Р°Р¶РЅРѕСЃС‚СЊ Рё Р±Р°С‚Р°СЂРµР№РєРё РіРѕСЃС‚РёРЅРѕР№, С‡РµСЂРґР°РєР° Рё СЃРєРІР°Р¶РёРЅС‹ вЂ” С‡РµСЂРµР· Yandex Station. Р”РІРµСЂСЊ вЂ” С‡РµСЂРµР· Xiaomi Gateway 3. РЎС†РµРЅР°СЂРёРё РђР»РёСЃС‹ РЅРµ РјРµРЅСЏСЋС‚СЃСЏ.</p>
 <details><summary>РџСЂРѕРІРµСЂРёС‚СЊ СЃРѕРѕС‚РІРµС‚СЃС‚РІРёСЏ В· ${devices.length}</summary><div class="profile-mappings">${devices.map(d=>`<div><strong>${esc(areaName(d.room))} В· ${esc(d.name)}</strong><code>${esc(state.bindings[d.id].entityId)}</code></div>`).join('')}</div></details>
 <p class="setting-help">РљРЅРѕРїРєР° РЅРёР¶Рµ РїРѕРґС‚РІРµСЂР¶РґР°РµС‚ РІС‹Р±СЂР°РЅРЅС‹Рµ СЃРѕРѕС‚РІРµС‚СЃС‚РІРёСЏ, РїСЂРѕРІРµСЂСЏРµС‚ РґРѕСЃС‚СѓРїРЅРѕСЃС‚СЊ Рё РІРєР»СЋС‡Р°РµС‚ СЂР°Р±РѕС‡РёР№ СЂРµР¶РёРј. РќРµРґРѕСЃС‚СѓРїРЅС‹Рµ СЃСѓС‰РЅРѕСЃС‚Рё РѕСЃС‚Р°РЅСѓС‚СЃСЏ Р·Р°Р±Р»РѕРєРёСЂРѕРІР°РЅС‹. РљРѕРјР°РЅРґС‹ СѓСЃС‚СЂРѕР№СЃС‚РІР°Рј РЅРµ РѕС‚РїСЂР°РІР»СЏСЋС‚СЃСЏ; СЃСѓС‰РµСЃС‚РІСѓСЋС‰РёРµ РґСЂСѓРіРёРµ РїСЂРёРІСЏР·РєРё РЅРµ Р·Р°РјРµРЅСЏСЋС‚СЃСЏ.</p>
 <button class="primary full-width" data-action="house-activate" ${disabled(!state.haConfigured||hasPending()||state.profileBusy)}>РџРѕРґС‚РІРµСЂРґРёС‚СЊ РїСЂРёРІСЏР·РєРё Рё РІРєР»СЋС‡РёС‚СЊ HA</button></section>`;
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
 }catch{toast('Р’ СЌС‚РѕРј РїСЂРµРІСЊСЋ РїРѕР»РЅС‹Р№ СЌРєСЂР°РЅ РЅРµРґРѕСЃС‚СѓРїРµРЅ. РџСЂРё Р»РѕРєР°Р»СЊРЅРѕРј Р·Р°РїСѓСЃРєРµ РёСЃРїРѕР»СЊР·СѓР№ РєРЅРѕРїРєСѓ РёР»Рё F11.')}
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
 if(!f.entityId)return {kind:'empty',text:'РќРµ РїСЂРёРІСЏР·Р°РЅРѕ'};
 if(!haKnown())return {kind:'unknown',text:'РЎРѕСЃС‚РѕСЏРЅРёРµ HA РµС‰С‘ РЅРµ Р·Р°РіСЂСѓР¶РµРЅРѕ'};
 const e=haEntity(f.entityId);
 if(!e)return {kind:'bad',text:'РќРµ РЅР°Р№РґРµРЅР° РІ Home Assistant вЂ” РІРµСЂРѕСЏС‚РЅРѕ, СЃРјРµРЅРёР»СЃСЏ entity_id'};
 if(['unknown','unavailable',''].includes(e.state))return {kind:'offline',text:'Р’ HA РµСЃС‚СЊ, РЅРѕ СЃРµР№С‡Р°СЃ РЅРµРґРѕСЃС‚СѓРїРЅР°'};
 const problem=bindingProblem(b.device,e);
 if(problem)return {kind:'bad',text:'РќРµ РїРѕРґС…РѕРґРёС‚: '+problem};
 return {kind:'ok',text:`РќР° СЃРІСЏР·Рё В· ${e.state}${e.attributes?.unit_of_measurement?' '+e.attributes.unit_of_measurement:''}`};
}
// Unbound, currently available entities of a compatible type, best name match first.
function bindingSuggestions(b){
 const pool=Object.keys(state.entityStates).length?Object.values(state.entityStates):techEntities;
 const used=new Set(bindingDefinitions(state.devices).filter(x=>x.id!==b.id).map(x=>formBinding(x.id)?.entityId).filter(Boolean));
 const words=String(b.device.name+' '+areaName(b.device.room)).toLowerCase().split(/[^Р°-СЏС‘a-z0-9]+/).filter(w=>w.length>3).map(w=>w.slice(0,5));
 const score=e=>{const n=(e.entity_id+' '+(e.attributes?.friendly_name||'')).toLowerCase();return words.filter(w=>n.includes(w)).length};
 return pool.filter(e=>!used.has(e.entity_id)&&!['unknown','unavailable',''].includes(e.state)&&!bindingProblem(b.device,e))
  .filter(e=>score(e)>0).sort((x,y)=>score(y)-score(x)).slice(0,3);
}
function bindingCard(b){
 const f=formBinding(b.id),h=bindingHealth(b),o=bindingOutcome[b.id];
 const suggest=['bad','offline','empty'].includes(h.kind)&&b.device.status==='installed'&&haKnown()?bindingSuggestions(b):[];
 return `<fieldset class="binding-card" data-health="${h.kind}"><legend>${esc(b.name)}</legend>
  <p class="setting-help">${deviceTypes[b.type].label} В· ${b.device.status==='planned'?'РїР»Р°РЅРёСЂСѓРµС‚СЃСЏ':deviceTypes[b.type].locked?'С‚РѕР»СЊРєРѕ РЅР°Р±Р»СЋРґРµРЅРёРµ':'СѓСЃС‚Р°РЅРѕРІР»РµРЅРѕ'}</p>
  <label class="setting-field compact">РЎСѓС‰РЅРѕСЃС‚СЊ Home Assistant<input data-binding="${b.id}" list="ha-entities" placeholder="${b.domains.join(' / ')} В· РїРѕРєР° РЅРµ РїСЂРёРІСЏР·Р°РЅРѕ" value="${esc(f.entityId)}" autocomplete="off" spellcheck="false"/></label>
  <p class="binding-health">${esc(h.text)}</p>
  ${suggest.length?`<div class="binding-suggest"><span>Р”РѕСЃС‚СѓРїРЅС‹Рµ РІР°СЂРёР°РЅС‚С‹:</span>${suggest.map(e=>`<button class="text-button" data-suggest="${b.id}" data-entity="${esc(e.entity_id)}" title="${esc(e.attributes?.friendly_name||'')}">${esc(e.entity_id)}</button>`).join('')}</div>`:''}
  <label class="check-field"><input type="checkbox" data-verified="${b.id}" ${f.verified?'checked':''} ${disabled(b.device.status==='planned')}/>РЎРѕРѕС‚РІРµС‚СЃС‚РІРёРµ РїСЂРѕРІРµСЂРµРЅРѕ РЅР° РјРµСЃС‚Рµ</label>
  ${o?`<p class="binding-outcome" data-kind="${o.kind}">${esc(o.text)}</p>`:''}
 </fieldset>`;
}
function bindingSummary(){
 const defs=bindingDefinitions(state.devices).filter(b=>b.device.status==='installed');
 if(!haKnown())return '<p class="setting-help">РќР°Р¶РјРё В«Р—Р°РіСЂСѓР·РёС‚СЊ СЃСѓС‰РЅРѕСЃС‚РёВ», С‡С‚РѕР±С‹ СѓРІРёРґРµС‚СЊ СЃРѕСЃС‚РѕСЏРЅРёРµ РєР°Р¶РґРѕР№ РїСЂРёРІСЏР·РєРё.</p>';
 const problems=defs.map(b=>({b,h:bindingHealth(b)})).filter(x=>['bad','offline'].includes(x.h.kind));
 if(!problems.length)return '<div class="inline-note">Р’СЃРµ РїСЂРёРІСЏР·Р°РЅРЅС‹Рµ СЃСѓС‰РЅРѕСЃС‚Рё РЅР° СЃРІСЏР·Рё.</div>';
 return `<div class="binding-problems"><strong>РўСЂРµР±СѓСЋС‚ РІРЅРёРјР°РЅРёСЏ: ${problems.length}</strong>${problems.map(({b,h})=>`<button class="text-button" data-binding-jump="${b.device.room}">${esc(b.name)} вЂ” ${esc(h.kind==='offline'?'РЅРµРґРѕСЃС‚СѓРїРЅР°':'РЅРµ РЅР°Р№РґРµРЅР° РёР»Рё РЅРµ РїРѕРґС…РѕРґРёС‚')}</button>`).join('')}</div>`;
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
  for(const r of result.rejected||[])bindingOutcome[r.id]={kind:'bad',text:'РћС‚РјРµС‚РєР° РЅРµ СЃРѕС…СЂР°РЅРµРЅР°: '+r.problem+'. Entity_id СЃРѕС…СЂР°РЅС‘РЅ.'};
  for(const r of result.offline||[])bindingOutcome[r.id]={kind:'offline',text:'РћС‚РјРµС‚РєР° СЃРѕС…СЂР°РЅРµРЅР°. Р”Р°РЅРЅС‹Рµ РїРѕСЏРІСЏС‚СЃСЏ, РєРѕРіРґР° СѓСЃС‚СЂРѕР№СЃС‚РІРѕ РІС‹Р№РґРµС‚ РЅР° СЃРІСЏР·СЊ РІ HA.'};
  bindingDraft={};
  const bad=(result.rejected||[]).length,off=(result.offline||[]).length;
  techMessage=bad?`РЎРѕС…СЂР°РЅРµРЅРѕ. РЈ ${bad} РїСЂРёРІСЏР·РѕРє РѕС‚РјРµС‚РєР° РЅРµ РїСЂРёРЅСЏС‚Р° вЂ” РїСЂРёС‡РёРЅР° РІ РєР°СЂС‚РѕС‡РєРµ.`:off?`РЎРѕС…СЂР°РЅРµРЅРѕ. ${off} СЃРµР№С‡Р°СЃ РЅРµРґРѕСЃС‚СѓРїРЅС‹ РІ HA, РѕС‚РјРµС‚РєРё РѕСЃС‚Р°РІР»РµРЅС‹.`:'РџСЂРёРІСЏР·РєРё СЃРѕС…СЂР°РЅРµРЅС‹.';
  // Keep the last HA snapshot so card health does not blink while polling restarts.
  if(Object.keys(state.entityStates).length)techEntities=Object.values(state.entityStates);
  toast(techMessage);startLive(refresh);refresh();updateTechnical({keepForm:false});
 }catch(error){
  applyPreferences(old);bindingDraft=wanted;
  techMessage='РќРµ СЃРѕС…СЂР°РЅРµРЅРѕ: '+error.message+' Р’РІРµРґС‘РЅРЅРѕРµ РІ С„РѕСЂРјРµ РЅРµ РїРѕС‚РµСЂСЏРЅРѕ.';
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
  toast('РљРѕРїРёСЏ РїСЂРѕС„РёР»СЏ СЃРѕС…СЂР°РЅРµРЅР°.');
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
 settingsOpen=false;modal(`<h2>РљСЂР°СЃРёРІРѕ. Р С‡РµСЃС‚РЅРѕ.</h2><p class="description">${isLive()?'Р Р°Р±РѕС‡РёР№ СЂРµР¶РёРј. РЈРїСЂР°РІР»РµРЅРёРµ РґРѕСЃС‚СѓРїРЅРѕ С‚РѕР»СЊРєРѕ РїСЂРѕРІРµСЂРµРЅРЅС‹Рј СЃСѓС‰РЅРѕСЃС‚СЏРј.':'Р”РµРјРѕРЅСЃС‚СЂР°С†РёРѕРЅРЅС‹Р№ СЂРµР¶РёРј. Р РµР°Р»СЊРЅС‹Рµ СѓСЃС‚СЂРѕР№СЃС‚РІР° РЅРµ Р·Р°С‚СЂР°РіРёРІР°СЋС‚СЃСЏ.'}</p>
 <ul><li>РќР°СЃС‚СЂРѕР№РєРё СЃРѕС…СЂР°РЅСЏСЋС‚СЃСЏ РІ SQLite Р»РѕРєР°Р»СЊРЅРѕРіРѕ СЃРµСЂРІРµСЂР°. РЎРѕСЃС‚РѕСЏРЅРёСЏ СѓСЃС‚СЂРѕР№СЃС‚РІ РЅРµ СЃРѕС…СЂР°РЅСЏСЋС‚СЃСЏ РєР°Рє Р°РєС‚СѓР°Р»СЊРЅС‹Рµ.</li><li>РџСЂРё РѕР±С‹С‡РЅРѕРј HTTP-СЃРµСЂРІРµСЂРµ Р±РµР· backend СЂР°Р±РѕС‚Р°РµС‚ С‚РѕР»СЊРєРѕ РјР°РєРµС‚, Р±РµР· СЃРѕС…СЂР°РЅРµРЅРёСЏ.</li><li>РЈ С‚РµРјРїРµСЂР°С‚СѓСЂ РµСЃС‚СЊ РёСЃС‚РѕС‡РЅРёРє Рё РІСЂРµРјСЏ РїР°РєРµС‚Р°.</li><li>3D Р·Р°РіСЂСѓР¶Р°РµС‚СЃСЏ РїРѕ С‚СЂРµР±РѕРІР°РЅРёСЋ Рё РЅРµ РѕС‚СЂРёСЃРѕРІС‹РІР°РµС‚СЃСЏ РїРѕСЃС‚РѕСЏРЅРЅРѕ.</li><li>Р Р°Р·РјРµСЂС‹ Рё РјРµР±РµР»СЊ СѓСЃР»РѕРІРЅС‹Рµ.</li><li>РќР°СЃРѕСЃ Рё РіР°Р·РѕРІС‹Р№ РєРѕС‚С‘Р» Р·Р°Р±Р»РѕРєРёСЂРѕРІР°РЅС‹.</li><li>РЎС‚Р°РЅС†РёСЏ Рё РєР°РјРµСЂР° С‚СЂРµР±СѓСЋС‚ РѕС‚РґРµР»СЊРЅРѕР№ РїСЂРѕРІРµСЂРєРё РёРЅС‚РµРіСЂР°С†РёР№ РЅР° РјРµСЃС‚Рµ.</li></ul>`);
}
function applyNight(){
 const hour=+new Intl.DateTimeFormat('en-GB',{hour:'numeric',hourCycle:'h23',timeZone:PANEL_TIMEZONE}).format(Date.now());
 if(applyNight.hour!==hour){applyNight.hour=hour;modelAPI?.setModelTime(hour)}
 const night=state.nightMode==='on'||state.nightMode==='auto'&&(hour>=22||hour<7);
 document.documentElement.dataset.night=String(night);
}
function updateClocks(){
 for(const id of ['clock','idle-clock','hero-clock'])if($('#'+id))$('#'+id).textContent=clock();
 for(const id of ['date','idle-date','hero-date'])if($('#'+id))$('#'+id).textContent=date();
 updateHeroTime();
 $('#idle-climate').textContent=noConnection()||sensors.living.quality==='unavailable'||sensors.well.quality==='unavailable'?'Р”Р°С‚С‡РёРєРё РЅРµРґРѕСЃС‚СѓРїРЅС‹':sensorStatus('living')==='Р”Р°РЅРЅС‹Рµ СѓСЃС‚Р°СЂРµР»Рё'||sensorStatus('well')==='Р”Р°РЅРЅС‹Рµ СѓСЃС‚Р°СЂРµР»Рё'?'РџРѕРєР°Р·Р°РЅРёСЏ СѓСЃС‚Р°СЂРµР»Рё':`Р“РѕСЃС‚РёРЅР°СЏ ${reading(sensors.living.value)}В°  В·  РЎРєРІР°Р¶РёРЅР° ${reading(sensors.well.value)}В°  В·  ${isLive()?'Home Assistant':'РґРµРјРѕРґР°РЅРЅС‹Рµ'}`;
}
function armIdle(){
 clearTimeout(idleTimer);clearTimeout(ambientTimer);
 if(state.idle||document.hidden||!state.idleSeconds||cameraPlayer)return;
 idleTimer=setTimeout(()=>{if(hasPending()){armIdle();return}enterIdle()},state.idleSeconds*1000);
}
// Р’РѕР»РЅР° 2 В«РўРёС€РёРЅР°В»: РіР»СѓР±РѕРєР°СЏ СЃС‚СѓРїРµРЅСЊ РїРѕСЃР»Рµ СЌРєСЂР°РЅР° РѕР¶РёРґР°РЅРёСЏ. РўРѕРЅР°Р»СЊРЅРѕ РіР°СЃРЅРµС‚ РІСЃС‘,
// РѕСЃС‚Р°СЋС‚СЃСЏ С‚РѕР»СЊРєРѕ РѕРіСЂРѕРјРЅС‹Рµ С‚РѕРЅРєРёРµ С‡Р°СЃС‹, РґР°С‚Р° Рё РѕРґРЅР° СЃС‚СЂРѕРєР° С‚РµРјРїРµСЂР°С‚СѓСЂС‹.
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
 if(hasPending()){toast('РЎРЅР°С‡Р°Р»Р° РґРѕР¶РґС‘РјСЃСЏ РїРѕРґС‚РІРµСЂР¶РґРµРЅРёСЏ РєРѕРјР°РЅРґС‹.');return}
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
 window.__actions=(window.__actions||[]);window.__actions.push('dispatch '+(e.target?.closest?.('button')?.dataset?.camera||e.target?.closest?.('button')?.dataset?.action||e.target?.closest?.('button')?.getAttribute?.('class')||'?').slice(0,30));
 const li=e.target.closest('.history-timeline li[data-history-event-id]');
 if(li){const f=historyState.focus,id=li.dataset.historyEventId,at=Number(li.dataset.historyEventAt);historyState.focus=f&&f.id===id&&f.at===at?null:{id,at};paintStatistics();return}
 const b=e.target.closest('button');if(!b){
  // РљР»РёРє РјРёРјРѕ РјРёРЅРё-РєР°СЂС‚РѕС‡РєРё Р·Р°РєСЂС‹РІР°РµС‚ РµС‘; С‚Р°Рї РїРѕ СЃС†РµРЅРµ РјРѕРі С‚РѕР»СЊРєРѕ С‡С‚Рѕ РѕС‚РєСЂС‹С‚СЊ/СЃРјРµРЅРёС‚СЊ РєР°СЂС‚РѕС‡РєСѓ.
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
  try{await api('assistant/settings',{method:'PUT',body:settings});duoUI.settingsDraft=null;duoUI.message='РќР°СЃС‚СЂРѕР№РєРё СЃРѕС…СЂР°РЅРµРЅС‹ РЅР° СЃРµСЂРІРµСЂРµ. РћРїРѕРІРµС‰РµРЅРёСЏ РЅРµ Р·Р°РІРёСЃСЏС‚ РѕС‚ РѕС‚РєСЂС‹С‚РѕР№ РІРєР»Р°РґРєРё.';duoUI.phase='confirmed';duoUI.error=''}
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
  techMessage=`РЈРґР°Р»РёС‚СЊ В«${d.name}В» Рё РµРіРѕ РїСЂРёРІСЏР·РєСѓ? Р­С‚Рѕ РЅРµ СѓРґР°Р»РёС‚ СѓСЃС‚СЂРѕР№СЃС‚РІРѕ РёР· Home Assistant.`;
  $('#sheet-content').innerHTML=`<h2>РЈРґР°Р»РёС‚СЊ СѓСЃС‚СЂРѕР№СЃС‚РІРѕ?</h2><p class="description">${esc(techMessage)}</p><div class="sheet-actions"><button class="primary" data-confirm-delete="${d.id}">РЈРґР°Р»РёС‚СЊ РёР· РїР°РЅРµР»Рё</button><button class="secondary" data-action="catalog-back">РћС‚РјРµРЅР°</button></div>`;icons();return;
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
  techMessage='РџРѕРґСЃС‚Р°РІР»РµРЅРѕ. РџСЂРѕРІРµСЂСЊ РЅР° РјРµСЃС‚Рµ, РѕС‚РјРµС‚СЊ РіР°Р»РѕС‡РєСѓ Рё СЃРѕС…СЂР°РЅРё.';updateTechnical({keepForm:false});
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
 if(b.hasAttribute('data-alarm-confirm'))return alarmCommand(b.dataset.alarmService,$('#alarm-pin')?.value||'');
 if(b.hasAttribute('data-alarm-cancel')){alarmUI={...alarmUI,askPin:false,service:'',error:''};paintAlarm();return}
 if(b.dataset.alarmService){
  const needs=(alarmEntity()?.attributes?.code_format||'None')!=='None';
  if(needs&&(!alarmUI.askPin||alarmUI.service!==b.dataset.alarmService)){alarmUI={...alarmUI,askPin:true,service:b.dataset.alarmService,error:''};paintAlarm();$('#alarm-pin')?.focus();return}
  return alarmCommand(b.dataset.alarmService,needs?($('#alarm-pin')?.value||''):'');
 }
 if(a==='shopping-add')return shoppingMutate('add',$('#shopping-input')?.value||'');
 if(a==='shopping-refresh')return loadShopping();
 if(b.dataset.ttsPreset){const i=$('#tts-text');if(i){i.value=b.dataset.ttsPreset;const c=$('#tts-count');if(c)c.textContent=b.dataset.ttsPreset.length+'/100'}return}
 if(a==='tts-send')return sendTTS();
 if(a==='weather-forecast')return forecastSheet();
 if(a==='model-retry'){state.modelError='';render(false);return}
 if(b.hasAttribute('data-forecast-reload'))return loadForecast(true);
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
  state.profileBusy=true;techMessage='РџСЂРѕРІРµСЂСЏРµРј СЃСѓС‰РЅРѕСЃС‚Рё РїСЂРѕС„РёР»СЏвЂ¦';updateTechnical();
  (async()=>{
   try{
    await flushStorage();
    const result=await api('house-profile',{method:'POST',body:{}});
    applyPreferences(result.preferences);startLive(refresh);render(false);
    const failed=result.report.filter(r=>!r.ok);
    techMessage=`РќР° СЃРІСЏР·Рё ${result.report.length-failed.length} / ${result.report.length}. РљРѕРјР°РЅРґС‹ РЅРµ РѕС‚РїСЂР°РІР»СЏР»РёСЃСЊ.`+(failed.length?' РўСЂРµР±СѓСЋС‚ РІРЅРёРјР°РЅРёСЏ: '+failed.map(r=>`${r.name} вЂ” ${r.problem}${r.kept?', РѕС‚РјРµС‚РєР° СЃРѕС…СЂР°РЅРµРЅР°':''}`).join('; ')+'. РџРѕРґСЂРѕР±РЅРѕСЃС‚Рё Рё Р·Р°РјРµРЅР° вЂ” РІРѕ РІРєР»Р°РґРєРµ В«РџСЂРёРІСЏР·РєРёВ».':'');
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
  techMessage='Р—Р°РіСЂСѓР¶Р°РµРј СЃРїРёСЃРѕРєвЂ¦';updateTechnical();
  captureBindingDraft();discover().then(result=>{techEntities=result.states;techMessage=`РџРѕР»СѓС‡РµРЅРѕ ${techEntities.length} СЃСѓС‰РЅРѕСЃС‚РµР№. РџСЂРѕРІРµСЂСЊ СЃРѕРѕС‚РІРµС‚СЃС‚РІРёРµ С„РёР·РёС‡РµСЃРєРёРј СѓСЃС‚СЂРѕР№СЃС‚РІР°Рј.`;updateTechnical()})
   .catch(error=>{techMessage=error.message;updateTechnical()});return;
 }
 if(a==='reconnect'){startLive(refresh);techMessage=isLive()?'РџСЂРѕРІРµСЂСЏРµРј СЃРІСЏР·СЊвЂ¦':'Р’С‹Р±СЂР°РЅ РґРµРјРѕСЂРµР¶РёРј. РџРѕРґРєР»СЋС‡РµРЅРёРµ Рє РґРѕРјСѓ РЅРµ РІС‹РїРѕР»РЅСЏРµС‚СЃСЏ.';updateTechnical();return}
 if(a==='save-photo'){
  if(!photoBlob)return;
  savePhoto(photoBlob).then(()=>{toast('Р¤РѕС‚Рѕ СЃРѕС…СЂР°РЅРµРЅРѕ РІ Р»РѕРєР°Р»СЊРЅСѓСЋ Р±Р°Р·Сѓ СЌС‚РѕРіРѕ РєРѕРјРїСЊСЋС‚РµСЂР°.');photoBlob=null;refresh()}).catch(error=>toast(error.message));return;
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
  return command(id,true).then(ok=>{if(!ok)toast(commandFor(id)?.message||'РџРµСЂРµРєР»СЋС‡РµРЅРёРµ РЅРµРґРѕСЃС‚СѓРїРЅРѕ')});
 }
 if(a==='pump')return simpleSheet(`<h2>РќР°СЃРѕСЃ С‚С‘РїР»РѕРіРѕ РїРѕР»Р°</h2><p class="description">Yeelight РїРѕРґР°С‘С‚ РёР»Рё РѕС‚РєР»СЋС‡Р°РµС‚ РїРёС‚Р°РЅРёРµ. Р”РІРµ РєР°СЂС‚РѕС‡РєРё РІ РђР»РёСЃРµ РЅРµ РѕР·РЅР°С‡Р°СЋС‚ РґРІР° РЅР°СЃРѕСЃР°.</p>
 <div class="inline-note">РџСЂРёРІСЏР·РєР° РєР°РЅР°Р»Р° РЅРµ РїСЂРѕРІРµСЂРµРЅР°. РЈРїСЂР°РІР»РµРЅРёРµ Р·Р°Р±Р»РѕРєРёСЂРѕРІР°РЅРѕ; РїРѕРґР°С‡Р° РїРёС‚Р°РЅРёСЏ РЅРµ РїРѕРґС‚РІРµСЂР¶РґР°РµС‚ СЂР°Р±РѕС‚Сѓ РЅР°СЃРѕСЃР°.</div>
 <div class="control-row"><h3>РџРѕСЃР»Рµ РїСЂРѕРІРµСЂРєРё РЅР° РјРµСЃС‚Рµ</h3><button class="toggle" disabled aria-label="РќР°СЃРѕСЃ РЅРµРґРѕСЃС‚СѓРїРµРЅ"><span class="toggle-track"></span></button></div>`);
 if(a==='door')return simpleSheet(`<h2>Р’С…РѕРґРЅР°СЏ РґРІРµСЂСЊ</h2><p class="description">${binaryLabel('door','РћС‚РєСЂС‹С‚Р°','Р—Р°РєСЂС‹С‚Р°')}. ${isLive()?'Р”Р°РЅРЅС‹Рµ С‚РѕР»СЊРєРѕ РёР· РїСЂРѕРІРµСЂРµРЅРЅРѕР№ СЃСѓС‰РЅРѕСЃС‚Рё Home Assistant.':'Р­С‚Рѕ РґРµРјРѕРЅСЃС‚СЂР°С†РёРѕРЅРЅРѕРµ СЃРѕСЃС‚РѕСЏРЅРёРµ.'}</p>`);
 if(a==='terrace-door')return simpleSheet(`<h2>Р”РІРµСЂСЊ РЅР° С‚РµСЂСЂР°СЃСѓ</h2><p class="description">${binaryLabel('terrace-door','РћС‚РєСЂС‹С‚Р°','Р—Р°РєСЂС‹С‚Р°')}. Р”Р°С‚С‡РёРє РѕС‚РєСЂС‹С‚РёСЏ РІРёСЃРёС‚ РЅР° РґРІРµСЂРё РјРµР¶РґСѓ РіРѕСЃС‚РёРЅРѕР№ Рё С‚РµСЂСЂР°СЃРѕР№. ${isLive()?'Р”Р°РЅРЅС‹Рµ С‚РѕР»СЊРєРѕ РёР· РїСЂРѕРІРµСЂРµРЅРЅРѕР№ СЃСѓС‰РЅРѕСЃС‚Рё Home Assistant.':'Р­С‚Рѕ РґРµРјРѕРЅСЃС‚СЂР°С†РёРѕРЅРЅРѕРµ СЃРѕСЃС‚РѕСЏРЅРёРµ.'}</p>`);
 if(a==='leak'){
  const d=state.devices.find(x=>x.id===(b.dataset.leakId||'leak:utility'));
  const place=d?.id==='leak:bath'?'РІ РІР°РЅРЅРѕР№':'РІ РєРѕС‚РµР»СЊРЅРѕР№ Сѓ С‚СѓР°Р»РµС‚Р°';
  return simpleSheet(`<h2>${esc(d?.name||'РџСЂРѕС‚РµС‡РєР°')}</h2><p class="description">${binaryLabel(d?.id||'leak:utility','РўСЂРµРІРѕРіР°','РЎСѓС…Рѕ')}. Р”Р°С‚С‡РёРє РЇРЅРґРµРєСЃР° Р»РµР¶РёС‚ ${place}. ${isLive()?'Р”Р°РЅРЅС‹Рµ С‚РѕР»СЊРєРѕ РёР· РїСЂРѕРІРµСЂРµРЅРЅРѕР№ СЃСѓС‰РЅРѕСЃС‚Рё Home Assistant.':'Р­С‚Рѕ РґРµРјРѕРЅСЃС‚СЂР°С†РёРѕРЅРЅРѕРµ СЃРѕСЃС‚РѕСЏРЅРёРµ.'}</p>
  <div class="inline-note">РџСЂРѕРІРµСЂСЊ СЃСЂР°Р±Р°С‚С‹РІР°РЅРёРµ РІСЂСѓС‡РЅСѓСЋ: РЅР°РјРѕС‡Рё РєРѕРЅС‚Р°РєС‚С‹ РґР°С‚С‡РёРєР° Рё СѓР±РµРґРёСЃСЊ, С‡С‚Рѕ СЃРѕСЃС‚РѕСЏРЅРёРµ РјРµРЅСЏРµС‚СЃСЏ.</div>`);
 }
 if(a==='camera')return openYardCamera();
 if(b.id==='reset-model')return modelAPI?.resetModel();
}
document.addEventListener('change',async e=>{
 if(e.target.id==='history-room'){historyState.room=e.target.value;paintStatistics();return}
 if(e.target.id==='history-event-type'){historyState.eventType=e.target.value;paintStatistics();return}
 const id=e.target.id;
 if(id==='brightness')return command('rgb:brightness',+e.target.value);
 if(id==='station-volume'){stationAdjusting=false;return command('station:volume',+e.target.value)}
 if(id==='idle-setting'){state.idleSeconds=+e.target.value;armIdle();persist()}
 if(id==='ambient-setting'){state.ambientMode=e.target.checked;if(state.idle&&!state.ambientMode)exitAmbient();persist()}
 if(id==='auto-theme-setting'){state.autoTheme=e.target.checked;autoThemeZone=null;persist();applyAutoTheme();updateThemeButton();updateTechnical();return}
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
   if(file.size>131072)throw new Error('РљРѕРїРёСЏ РґРѕР»Р¶РЅР° Р±С‹С‚СЊ РјРµРЅСЊС€Рµ 128 РљР‘.');
   const parsed=JSON.parse(await file.text());
   if(parsed.format!=='home-panel'||parsed.version!==3)throw new Error('РќСѓР¶РЅР° РєРѕРїРёСЏ РїР°РЅРµР»Рё v3.');
   applyPreferences(validatePreferences(parsed.preferences,{importing:true}));await flushStorage();
   state.commands.clear();state.demoOffline=false;state.stationMode='unconfigured';startLive(refresh);applyAppearance();refresh();
   techMessage='РќР°СЃС‚СЂРѕР№РєРё РІРѕСЃСЃС‚Р°РЅРѕРІР»РµРЅС‹. Р’РєР»СЋС‡С‘РЅ РґРµРјРѕСЂРµР¶РёРј; РІСЃРµ РїСЂРёРІСЏР·РєРё РЅСѓР¶РЅРѕ РїСЂРѕРІРµСЂРёС‚СЊ Р·Р°РЅРѕРІРѕ.';updateTechnical();
  }catch(error){applyPreferences(old);techMessage='РРјРїРѕСЂС‚ РѕС‚РјРµРЅС‘РЅ: '+error.message;updateTechnical()}
 }
 if(id==='hero-upload'){
  const file=e.target.files?.[0];if(!file)return;
  if(!['image/jpeg','image/png','image/webp'].includes(file.type)||file.size>10*1024*1024){toast('Р’С‹Р±РµСЂРё JPEG, PNG РёР»Рё WebP РґРѕ 10 РњР‘.');return}
  const url=URL.createObjectURL(file),image=new Image();image.src=url;
  try{await image.decode()}catch{URL.revokeObjectURL(url);toast('РќРµ СѓРґР°Р»РѕСЃСЊ РїСЂРѕС‡РёС‚Р°С‚СЊ РёР·РѕР±СЂР°Р¶РµРЅРёРµ. РЎС‚Р°СЂРѕРµ С„РѕС‚Рѕ СЃРѕС…СЂР°РЅРµРЅРѕ.');return}
  if(image.naturalWidth*image.naturalHeight>24000000){URL.revokeObjectURL(url);toast('Р¤РѕС‚Рѕ СЃР»РёС€РєРѕРј Р±РѕР»СЊС€РѕРµ. РЈРјРµРЅСЊС€Рё РµРіРѕ РґРѕ 24 РјРµРіР°РїРёРєСЃРµР»РµР№.');return}
  const canvas=document.createElement('canvas'),scale=Math.min(1,2048/Math.max(image.naturalWidth,image.naturalHeight));
  canvas.width=Math.round(image.naturalWidth*scale);canvas.height=Math.round(image.naturalHeight*scale);
  canvas.getContext('2d').drawImage(image,0,0,canvas.width,canvas.height);
  const compressed=await new Promise(resolve=>canvas.toBlob(resolve,'image/jpeg',.85));
  if(!compressed||compressed.size>2*1024*1024){URL.revokeObjectURL(url);toast('РќРµ СѓРґР°Р»РѕСЃСЊ СѓРјРµРЅСЊС€РёС‚СЊ С„РѕС‚Рѕ РґРѕ 2 РњР‘. Р’С‹Р±РµСЂРё РґСЂСѓРіРѕРµ.');return}
  if(state.heroURL)URL.revokeObjectURL(state.heroURL);
  URL.revokeObjectURL(url);state.heroURL=URL.createObjectURL(compressed);photoBlob=compressed;state.photoSaved=false;
  if(state.view==='home')render();updateSettings();toast('Р¤РѕС‚Рѕ РїРѕРєР° С‚РѕР»СЊРєРѕ РІРѕ РІРєР»Р°РґРєРµ. Р”Р»СЏ СЃРѕС…СЂР°РЅРµРЅРёСЏ РµСЃС‚СЊ РѕС‚РґРµР»СЊРЅР°СЏ РєРЅРѕРїРєР°.');
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
 if(e.target.id==='brightness')$('#brightness-label').textContent=e.target.value+' % В· РµС‰С‘ РЅРµ РѕС‚РїСЂР°РІР»РµРЅРѕ';
 if(e.target.id==='station-volume'){stationAdjusting=true;$('#station-volume-label').textContent=e.target.value+' % В· РµС‰С‘ РЅРµ РѕС‚РїСЂР°РІР»РµРЅРѕ'}
 if(e.target.id==='tts-text'){const c=$('#tts-count');if(c)c.textContent=e.target.value.length+'/100'}
});
document.addEventListener('keydown',e=>{if(e.key==='Enter'&&e.target?.id==='shopping-input'){e.preventDefault();shoppingMutate('add',e.target.value||'')}});
// РўР°Рї-СѓСЃС‚РѕР№С‡РёРІС‹Р№ РІРІРѕРґ: С„РёР·РёС‡РµСЃРєРёРµ СѓРєР°Р·Р°С‚РµР»Рё РѕР±СЂР°Р±Р°С‚С‹РІР°СЋС‚СЃСЏ РЅР° pointerup вЂ”
// DOM-РїРµСЂРµСЂРёСЃРѕРІРєР° РїРѕРґ РїР°Р»СЊС†РµРј (icons/updateRegion) РЅРµ СѓР±РёРІР°РµС‚ РґРµР№СЃС‚РІРёРµ.
// click РѕСЃС‚Р°С‘С‚СЃСЏ С‚РѕР»СЊРєРѕ РґР»СЏ РєР»Р°РІРёР°С‚СѓСЂС‹ (detail=0) Рё РїСЂРѕРіСЂР°РјРјРЅС‹С… РІС‹Р·РѕРІРѕРІ.
window.__pudebug=[];let pointerDownAt=null,lastActionButton=null,lastActionTime=0;
document.addEventListener('pointerdown',e=>{pointerDownAt={x:e.clientX,y:e.clientY,btn:e.target.closest('button')}},{passive:true});
document.addEventListener('pointerup',e=>{
 if(window.__pudebug!==undefined)window.__pudebug.push('pup target='+(e.target.getAttribute&&(e.target.getAttribute('class')||e.target.tagName)).toString().slice(0,20)+' btn='+(pointerDownAt?.btn?'yes':'null'));
 const moved=pointerDownAt&&Math.hypot(e.clientX-pointerDownAt.x,e.clientY-pointerDownAt.y)>10;
 // РљРЅРѕРїРєР° РјРѕРіР»Р° Р±С‹С‚СЊ Р·Р°РјРµРЅРµРЅР° РїРµСЂРµСЂРёСЃРѕРІРєРѕР№ РјРµР¶РґСѓ down Рё up: Р±РµСЂС‘Рј СЃРѕС…СЂР°РЅС‘РЅРЅСѓСЋ
 // РІ pointerdown, Р° РµСЃР»Рё РѕРЅР° РѕС‚СЃРѕРµРґРёРЅРµРЅР° вЂ” СЌР»РµРјРµРЅС‚ РїРѕРґ РєРѕРѕСЂРґРёРЅР°С‚РѕР№.
 let b=pointerDownAt?.btn;
 if(b&&!b.isConnected)b=null;
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
$('.brand').onclick=e=>{e.preventDefault();navigate('home')};
document.addEventListener('pointermove',e=>{if(state.view==='statistics')inspectHistoryChart(e)});
document.addEventListener('keydown',e=>{
 if(state.view==='statistics'){
  inspectHistoryChart(e);
  if(['Enter',' '].includes(e.key)){
   const li=document.activeElement?.closest?.('.history-timeline li[data-history-event-id]');
   if(li){e.preventDefault();const f=historyState.focus,id=li.dataset.historyEventId,at=Number(li.dataset.historyEventAt);historyState.focus=f&&f.id===id&&f.at===at?null:{id,at};paintStatistics()}
  }
 }
});
document.addEventListener('keydown',e=>{if(e.key==='Escape'&&activeRoomCard&&state.view==='home'&&$('#overlay').hidden){activeRoomCard=null;paintRoomCard()}});
let historyResizeTimer;
window.addEventListener('resize',()=>{clearTimeout(historyResizeTimer);if(state.view==='statistics')historyResizeTimer=setTimeout(paintStatistics,150)});
$('#master').onclick=master;$('#info').onclick=()=>openSettings();
$('#standby').onclick=enterIdle;$('#idle-screen').onclick=e=>{e.preventDefault();e.stopPropagation();wake()};
$('#theme').onclick=()=>{
 if(state.autoTheme&&terraceLux()!==null){toast('РўРµРјРїРµСЂР°С‚СѓСЂР° С‚РµРјС‹ Р·Р°РґР°С‘С‚СЃСЏ РѕСЃРІРµС‰С‘РЅРЅРѕСЃС‚СЊСЋ С‚РµСЂСЂР°СЃС‹.');return}
 state.theme=state.theme==='dark'?'light':'dark';document.documentElement.dataset.theme=state.theme;
 $('#theme').innerHTML=I(state.theme==='dark'?'sun':'moon');icons();persist();
 if(state.view==='statistics')paintStatistics();
};
$('#fullscreen').onclick=fullscreen;
document.addEventListener('fullscreenchange',()=>{
 $('#fullscreen').innerHTML=I(document.fullscreenElement?'minimize':'maximize');
 $('#fullscreen').setAttribute('aria-label',document.fullscreenElement?'Р’С‹Р№С‚Рё РёР· РїРѕР»РЅРѕРіРѕ СЌРєСЂР°РЅР°':'РџРѕР»РЅС‹Р№ СЌРєСЂР°РЅ');icons();
});
$('.close').onclick=closeModal;
// РўР°Рї-СѓСЃС‚РѕР№С‡РёРІРѕСЃС‚СЊ: РЅР° РЅРµРєРѕС‚РѕСЂС‹С… РїР»Р°РЅС€РµС‚Р°С… click РїРѕСЃР»Рµ pointer-СЃРѕР±С‹С‚РёР№ РЅРµ РґРѕС…РѕРґРёС‚.
document.addEventListener('pointerup',e=>{if(e.target?.closest?.('.sheet .close'))closeModal()});
let lastPointerDown=0;
document.addEventListener('pointerdown',()=>{lastPointerDown=Date.now()},{passive:true});
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
// В«РўРёС€РёРЅР°В»: РґРІРёР¶РµРЅРёРµ РјС‹С€Рё Р±СѓРґРёС‚ С‚РѕР»СЊРєРѕ РёР· ambient-СЃС‚СѓРїРµРЅРё.
document.addEventListener('mousemove',()=>{if(state.idle&&document.body.classList.contains('is-ambient'))wake()},{passive:true});
document.addEventListener('visibilitychange',()=>{if(document.hidden){clearTimeout(idleTimer);if(cameraPlayer)cameraStop()}else armIdle()});
window.addEventListener('pagehide',clearCamera);
bindScenarioPainter(refresh);
bindVoice();
// Р РµРґР°РєС‚РѕСЂ РїРѕР»СЊР·РѕРІР°С‚РµР»СЊСЃРєРёС… СЃС†РµРЅР°СЂРёРµРІ: С‚РѕС‚ Р¶Рµ sheet, СЃРѕС…СЂР°РЅРµРЅРёРµ С‡РµСЂРµР· preferences.
bindScenarioHost({
 openSheet:simpleSheet,closeSheet:closeModal,icons,
 commit:async next=>{
  const old=preferences();
  try{applyPreferences(next);await flushStorage();refresh();return true}
  catch(error){applyPreferences(old);toast('РЎС†РµРЅР°СЂРёР№ РЅРµ СЃРѕС…СЂР°РЅС‘РЅ: '+error.message);return false}
 }
});

setInterval(()=>{updateClocks();applyNight();if(state.view==='home'&&!state.idle&&!hasPending())refresh()},10000);
$('#main').innerHTML='<div class="boot-state" role="status">РџРѕРґРіРѕС‚Р°РІР»РёРІР°РµРј С‚РІРѕСЋ РїР°РЅРµР»СЊвЂ¦</div>';
loadStorage().then(()=>{applyAppearance();startLive(refresh);render();updateClocks();armIdle();window.__homePanelReady=true});
