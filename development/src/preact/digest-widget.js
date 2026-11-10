// Волна 2 миграции 3.0: дайджест дома на Preact. Разметка — прежний digestCard()
// из app.js (классы .digest-card/.digest-item/.digest-action совместимы с Aurora CSS,
// пункты собираются digestItems из ../digest.js — логика дайджеста не дублируется).
// Данные приходят по мини-шине digestBus: app.js в refresh() вызывает
// digestBus.notify(digestArgs()) — без внешнего стора.
import {h,html,useEffect,useState} from './kit.js';
import {digestItems,digestBriefing} from '../digest.js';
import {esc} from '../dom.js';
import {api} from '../api.js';
import {WEATHER_LABEL} from '../weather-const.js';
import {yardClipsBus} from './yard-clips-widget.js';
import {createIcons,Info,Radio,Droplets,WifiOff,Lightbulb,Thermometer,Zap,TriangleAlert,Download,
 Sun,Moon,Cloudy,CloudSun,CloudRain,CloudSnow,CloudFog,Wind,CloudLightning,CloudDrizzle,CloudHail,Video,Shield} from 'lucide';
export const digestBus={fns:[],last:undefined,sub(fn){this.fns.push(fn);if(this.last!==undefined)fn(this.last)},notify(deps){this.last=deps;this.fns.forEach(f=>f(deps))}};
const I=name=>`<i data-lucide="${name}"></i>`;
// Чистая разметка (тестируется через preact-render-to-string).
// meterKnown:true — энерговиджет подтвердил показание ТНС: строку
// «Счётчик ТНС: нет данных» не показываем, чтобы не противоречить энергокарточке.
export function digestMarkup(deps){
 const items=digestItems(deps)
  .filter(it=>!(deps.meterKnown&&it.icon==='zap'&&String(it.text).startsWith('Счётчик ТНС')));
 // Волна D 3.2.3: блок «Сводка» (утренний брифинг) сверху дайджеста — deps.brief
 // собирается асинхронно в DigestWidget (yard-clips/прогноз с кешем 10 мин).
 const brief=Array.isArray(deps.brief)&&deps.brief.length
  ?`<div class="digest-brief">${deps.brief.map(b=>{
    const inner=`${I(b.icon)}<span>${esc(b.text)}</span>`;
    return b.action?.open==='yard'
     ?`<button class="digest-brief-item is-action" data-camera="camera-yard" aria-label="${esc(b.text)} · ${esc(b.action.label)}">${inner}</button>`
     :`<div class="digest-brief-item">${inner}</div>`;
   }).join('')}</div>`:'';
 if(!items.length&&!brief)return '';
 return `<div class="digest-card ${items[0]?.level==='danger'?'is-danger':''}"><h3>${I('info')}Дайджест дома</h3>${brief}<ul>${items.map(it=>it.action
  ?`<li class="digest-item digest-${it.level}"><button class="digest-action" ${it.action.open?`data-digest-open="${it.action.open}"`:`data-room="${esc(it.action.room)}"`} aria-label="${esc(it.text)} · ${esc(it.action.label)}">${I(it.icon)}<span>${esc(it.text)}</span><small>${esc(it.action.label)}</small></button></li>`
  :`<li class="digest-item digest-${it.level}">${I(it.icon)}<span>${esc(it.text)}</span></li>`).join('')}</ul></div>`;
}
const paintIcons=()=>{
 createIcons({icons:{Info,Radio,Droplets,WifiOff,Lightbulb,Thermometer,Zap,TriangleAlert,Download,
  Sun,Moon,Cloudy,CloudSun,CloudRain,CloudSnow,CloudFog,Wind,CloudLightning,CloudDrizzle,CloudHail,Video,Shield},attrs:{'stroke-width':1.6}});
 // lucide оставляет data-lucide на созданных svg: без снятия повторный вызов пересоздаёт svg.
 document.querySelectorAll('svg[data-lucide]').forEach(s=>s.removeAttribute('data-lucide'));
};
export function DigestContent({deps}){
 const markup=digestMarkup(deps);
 return markup?html`<span class="digest-widget-root" dangerouslySetInnerHTML=${{__html:markup}}></span>`:null;
}
// Волна D 3.2.3: briefing дотягивает данные лениво, не блокируя основной рендер.
// digestBus даёт базовые deps (синхронно); yard-clips и прогноз — async с кешем 10 мин.
const BRIEF_CACHE_MS=10*60*1000;
let briefCache={at:0,clips:null,forecast:null};
const todayForecast=list=>{
 const f=(Array.isArray(list)?list:[]).find(f=>f&&WEATHER_LABEL[f.condition]&&Number.isFinite(f.temperature));
 return f?{condition:f.condition,temperature:f.temperature}:null;
};
const buildBrief=(deps,cache)=>digestBriefing({
 entityStates:deps.entityStates,devices:deps.devices||[],bindings:deps.bindings||{},
 yardClips:cache.clips||[],forecast:cache.forecast||null,now:deps.now,
 isNightNow:!!deps.isNightNow,alarmState:deps.alarmState});
export function DigestWidget(){
 const [deps,setDeps]=useState(null);
 const [extra,setExtra]=useState({});
 const [tick,setTick]=useState(0);
 useEffect(()=>{digestBus.sub(d=>setDeps(d))},[]);
 // Новый клип двора (SSE через app.js) → кеш брифинга по клипам сбрасывается.
 useEffect(()=>{yardClipsBus.sub(()=>{briefCache={at:0,clips:null,forecast:briefCache.forecast};setTick(t=>t+1)})},[]);
 useEffect(()=>{
  if(!deps)return;
  let alive=true;
  const fresh=briefCache.at&&Date.now()-briefCache.at<BRIEF_CACHE_MS;
  if(fresh){setExtra({brief:buildBrief(deps,briefCache)});return}
  const weather=Object.values(deps.entityStates||{}).find(e=>e.entity_id?.startsWith('weather.'));
  Promise.all([
   api('yard-clips?limit=20').then(list=>{briefCache.clips=Array.isArray(list)?list:[]}).catch(()=>{}),
   api(`ha/weather-forecast?entity=${encodeURIComponent(weather?.entity_id||'')}`)
    .then(r=>{briefCache.forecast=todayForecast(r?.forecast)}).catch(()=>{})
  ]).then(()=>{briefCache.at=Date.now();if(alive)setExtra({brief:buildBrief(deps,briefCache)})});
  return()=>{alive=false};
 },[deps,tick]);
 const merged=deps?{...deps,brief:extra.brief}:null;
 useEffect(()=>{if(merged&&digestMarkup(merged))paintIcons()},[merged]);
 return deps?html`<${DigestContent} deps=${merged}/>`:null;
}