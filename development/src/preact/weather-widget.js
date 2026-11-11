// Волна 2 миграции 3.0: погодный чип главной на Preact. Разметка — прежний
// weatherCard() из app.js (классы .home-fact/.weather-chip, анимация data-weather,
// открытие щитка прогноза через data-action="weather-forecast" — щиток остаётся
// на старом пути). Данные — мини-шина weatherBus: app.js в refresh() вызывает
// weatherBus.notify({entityStates,now}); в демо notify не вызывается → чипа нет.
import {h,html,useEffect,useState} from './kit.js';
import {esc} from '../dom.js';
import {paintAll} from './icons.js';
export const weatherBus={fns:[],last:undefined,sub(fn){this.fns.push(fn);if(this.last!==undefined)fn(this.last)},notify(deps){this.last=deps;this.fns.forEach(f=>f(deps))}};
// Константы погодных состояний HA: единый источник — src/weather-const.js.
import {WEATHER_LABEL,WEATHER_ICON,WEATHER_DATA} from '../weather-const.js';
import {weatherHint} from '../weather-hint.js';
import {api} from '../api.js';
import {isLive} from '../live.js';
import {state} from '../schema.js';
export {WEATHER_LABEL,WEATHER_ICON,WEATHER_DATA};
const I=name=>`<i data-lucide="${name}"></i>`;
// Чистая разметка (тестируется через preact-render-to-string): недоступная погода,
// неизвестное состояние или температура без числа → null (узел слота пуст).
export function weatherMarkup(entityStates){
 const e=Object.values(entityStates||{}).find(e=>e.entity_id?.startsWith('weather.'));
 if(!e||['unknown','unavailable',''].includes(e.state))return '';
 const label=WEATHER_LABEL[e.state];
 const t=e.attributes?.temperature,h=e.attributes?.humidity;
 if(!label||!Number.isFinite(t))return '';
 const icon=WEATHER_ICON[e.state]||'cloudy';
 const temp=t.toFixed(1).replace('.',','),aria=`Погода: ${label}, температура ${temp} °C${Number.isFinite(h)?', влажность '+Math.round(h)+' %':''}`;
 return `<button class="home-fact weather-chip" data-weather="${WEATHER_DATA[e.state]||'cloudy'}" data-action="weather-forecast" role="img" aria-label="${esc(aria)}. Открыть прогноз" title="Открыть прогноз погоды"><span>${I(icon)}Погода</span><strong>${esc(label)} · ${temp} °C${Number.isFinite(h)?' · '+Math.round(h)+' %':''}</strong></button>`;
}
const paintIcons=paintAll;
// Контекстный чип прогноза (3.3.2): чистая разметка chip + мелкая строка-уточнение
// .weather-hint под чипом (не отдельная карточка). forecast — пункты прогноза,
// now — метка времени для weatherHint.
export function weatherChipMarkup(entityStates,forecast,now=Date.now()){
 const chip=weatherMarkup(entityStates);
 if(!chip)return '';
 const hint=weatherHint(forecast,now);
 return chip+(hint?`<span class="weather-hint" role="status">${esc(hint)}</span>`:'');
}
// Загрузка прогноза с кешем 10 минут (сервер и так кеширует 15 мин — это защита
// от частых перерисовок refresh()). Ошибки молча: чип остаётся без уточнения.
let forecastCache=null,forecastKey='';
export async function fetchForecast(entityId,force=false){
 if(!entityId)return null;
 if(forecastCache&&forecastKey===entityId&&!force&&Date.now()-forecastCache.at<10*60*1000)return forecastCache.data;
 try{const result=await api('ha/weather-forecast'+(entityId?`?entity=${encodeURIComponent(entityId)}`:''));
  forecastCache={at:Date.now(),data:result.forecast};forecastKey=entityId;return result.forecast}
 catch{if(!forecastCache||forecastKey!==entityId)forecastCache=null;return forecastKey===entityId?forecastCache?.data??null:null}
}
export function WeatherChipContent({entityStates,forecast}){
 const markup=weatherChipMarkup(entityStates,forecast);
 return markup?html`<span class="weather-widget-root" dangerouslySetInnerHTML=${{__html:markup}}></span>`:null;
}
export function WeatherChip(){
 const [deps,setDeps]=useState(null);
 const [forecast,setForecast]=useState(null);
 useEffect(()=>{weatherBus.sub(d=>setDeps(d))},[]);
 useEffect(()=>{if(deps&&weatherMarkup(deps.entityStates))paintIcons()},[deps]);
 // Прогноз: тянем один раз при появлении погодной сущности (кеш 10 мин внутри).
 useEffect(()=>{
  if(!deps||!isLive()||!state.liveOnline)return;
  const e=Object.values(deps.entityStates||{}).find(e=>e.entity_id?.startsWith('weather.'));
  if(!e)return;
  let alive=true;
  fetchForecast(e.entity_id).then(f=>{if(f&&alive)setForecast(f)});
  return ()=>{alive=false};
 },[deps]);
 return deps?html`<${WeatherChipContent} entityStates=${deps.entityStates} forecast=${forecast}/>`:null;
}