// Волна 2 миграции 3.0: погодный чип главной на Preact. Разметка — прежний
// weatherCard() из app.js (классы .home-fact/.weather-chip, анимация data-weather,
// открытие щитка прогноза через data-action="weather-forecast" — щиток остаётся
// на старом пути). Данные — мини-шина weatherBus: app.js в refresh() вызывает
// weatherBus.notify({entityStates,now}); в демо notify не вызывается → чипа нет.
import {h,html,useEffect,useState} from './kit.js';
import {esc} from '../dom.js';
import {createIcons,Sun,Cloudy,CloudSun,CloudRain,CloudSnow,CloudFog,Wind,CloudLightning,CloudDrizzle,CloudHail} from 'lucide';
export const weatherBus={fns:[],last:undefined,sub(fn){this.fns.push(fn);if(this.last!==undefined)fn(this.last)},notify(deps){this.last=deps;this.fns.forEach(f=>f(deps))}};
// Константы погодных состояний HA: единый источник — src/weather-const.js.
import {WEATHER_LABEL,WEATHER_ICON,WEATHER_DATA} from '../weather-const.js';
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
const paintIcons=()=>{
 createIcons({icons:{Sun,Cloudy,CloudSun,CloudRain,CloudSnow,CloudFog,Wind,CloudLightning,CloudDrizzle,CloudHail},attrs:{'stroke-width':1.6}});
 document.querySelectorAll('svg[data-lucide]').forEach(s=>s.removeAttribute('data-lucide'));
};
export function WeatherChipContent({entityStates}){
 const markup=weatherMarkup(entityStates);
 return markup?html`<span class="weather-widget-root" dangerouslySetInnerHTML=${{__html:markup}}></span>`:null;
}
export function WeatherChip(){
 const [deps,setDeps]=useState(null);
 useEffect(()=>{weatherBus.sub(d=>setDeps(d))},[]);
 useEffect(()=>{if(deps&&weatherMarkup(deps.entityStates))paintIcons()},[deps]);
 return deps?html`<${WeatherChipContent} entityStates=${deps.entityStates}/>`:null;
}