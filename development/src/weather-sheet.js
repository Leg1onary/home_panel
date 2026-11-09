// Прогноз погоды: щиток и загрузка прогноза из HA (кеш 15 минут).
// Отделено из app.js (волна 5): блок самодостаточен, общие хелперы — импортом из app.js.
import {esc,PANEL_TIMEZONE} from './dom.js';
import {WEATHER_ICON} from './preact/weather-widget.js';
import {api} from './api.js';
import {isLive} from './live.js';
import {state} from './schema.js';
import {icons,simpleSheet,$,I} from './app.js';
let forecastCache=null,forecastEntity='';
const forecastWeek=t=>new Intl.DateTimeFormat('ru-RU',{weekday:'short',day:'numeric',month:'short',timeZone:PANEL_TIMEZONE}).format(new Date(t));
function forecastMarkup(list,error,busy){
 const retry=`<div class="sheet-actions"><button class="secondary" data-forecast-reload>${I('rotate-ccw')}Обновить</button></div>`;
 if(error)return `<p class="description forecast-error">Прогноз недоступен: ${esc(error)}</p>${retry}`;
 if(!list)return `<div class="forecast-status" aria-busy="true"><i data-lucide="loader-circle" class="spin"></i>Загружаем прогноз…</div>`;
 if(!list.length)return `<p class="description forecast-error">Прогноз недоступен: Home Assistant не вернул пункты прогноза.</p>${retry}`;
 return `<ul class="forecast-list">${list.map(f=>`<li class="forecast-row"><span class="forecast-day">${esc(forecastWeek(f.datetime))}</span>${I(WEATHER_ICON[f.condition]||'cloudy')}<b>${Math.round(f.temperature)}°${Number.isFinite(f.templow)?' / '+Math.round(f.templow)+'°':''}</b>${Number.isFinite(f.precipitationProbability)?`<span class="forecast-prec" title="Вероятность осадков">${I('droplets')}${f.precipitationProbability} %</span>`:''}</li>`).join('')}</ul>${retry}`;
}
function paintForecast(list,error,busy){
 const node=$('[data-forecast-sheet]');
 if(node){node.innerHTML=forecastMarkup(list,error,busy);icons()}
}
export async function loadForecast(force=false){
 if(force)forecastCache=null;
 if(!forecastEntity)return paintForecast(null,'Нет сущности погоды.');
 if(forecastCache&&!force&&Date.now()-forecastCache.at<15*60*1000)return paintForecast(forecastCache.data);
 paintForecast(null,null,true);
 try{
  const result=await api('ha/weather-forecast'+(forecastEntity?`?entity=${encodeURIComponent(forecastEntity)}`:''));
  forecastCache={at:Date.now(),data:result.forecast};
  paintForecast(result.forecast);
 }catch(error){paintForecast(null,error.message)}
}
export function forecastSheet(){
 const e=Object.values(state.entityStates||{}).find(e=>e.entity_id?.startsWith('weather.'));
 forecastEntity=e?.entity_id||'';
 simpleSheet(`<h2>Прогноз погоды</h2><div data-forecast-sheet>${forecastMarkup(null,null,true)}</div>`);
 if(!isLive()||!forecastEntity)return paintForecast(null,'Home Assistant не настроен.');
 loadForecast();
}