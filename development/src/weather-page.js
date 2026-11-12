// 3.4.4: страница «Погода» — чистые функции (аргументы вида, разметка «сейчас»,
// арка светового дня с восходом/закатом, прогноз на дни, почасовая лента).
// Разметку монтирует app.js (render()/refresh()); здесь нет обращения к DOM.
import {esc,timeOf,PANEL_TIMEZONE} from './dom.js';
import {WEATHER_LABEL,WEATHER_ICON} from './weather-const.js';
import {dayArcMarkup,dayProgressParams,storedSunrise} from './day-arc.js';
const I=name=>`<i data-lucide="${name}"></i>`;
const weekday=t=>new Intl.DateTimeFormat('ru-RU',{weekday:'short',day:'numeric',month:'short',timeZone:PANEL_TIMEZONE}).format(new Date(t));
export function weatherEntityOf(entityStates){
 return Object.values(entityStates||{}).find(e=>e.entity_id?.startsWith('weather.'))||null;
}
// Разбиение прогноза HA: пункты с templow — дни (daily), остальные — часы.
export function splitForecast(forecast){
 const daily=[],hourly=[];
 for(const f of Array.isArray(forecast)?forecast:[]){
  if(!f||!f.datetime)continue;
  if(Number.isFinite(f.templow))daily.push(f);else hourly.push(f);
 }
 return {daily,hourly};
}
// Аргументы страницы: null когда погодной сущности нет или она недоступна.
export function weatherViewArgs(entityStates,forecast=[],now=Date.now()){
 const e=weatherEntityOf(entityStates);
 if(!e||['unknown','unavailable',''].includes(e.state))return null;
 const a=e.attributes||{},label=WEATHER_LABEL[e.state],temp=a.temperature;
 if(!label||!Number.isFinite(temp))return null;
 const {daily,hourly}=splitForecast(forecast);
 return {label,icon:WEATHER_ICON[e.state]||'cloudy',
  temp,humidity:Number.isFinite(a.humidity)?Math.round(a.humidity):null,
  wind:Number.isFinite(a.wind_speed)?a.wind_speed:null,
  pressure:Number.isFinite(a.pressure)?a.pressure:null,
  daily:daily.slice(0,7).map(f=>({day:weekday(Date.parse(f.datetime)),icon:WEATHER_ICON[f.condition]||'cloudy',
   condition:WEATHER_LABEL[f.condition],min:Number.isFinite(f.templow)?Math.round(f.templow):null,
   max:Number.isFinite(f.temperature)?Math.round(f.temperature):null,
   prec:Number.isFinite(f.precipitation_probability)?f.precipitation_probability:null})),
  hourly:hourly.slice(0,24).map(f=>({time:timeOf(Date.parse(f.datetime)),icon:WEATHER_ICON[f.condition]||'cloudy',
   temp:Number.isFinite(f.temperature)?Math.round(f.temperature):null,
   prec:Number.isFinite(f.precipitation_probability)?f.precipitation_probability:null})),
  sun:sunInfo(entityStates,now)};
}
// Солнце: восход — из localStorage (запись делает rememberSunrise в app.js),
// fallback next_dawn − 24 ч; закат — next_dusk. Ночью прогресс null.
export function sunInfo(entityStates,now=Date.now(),storage=globalThis.localStorage){
 const e=Object.values(entityStates||{}).find(x=>x.entity_id==='sun.sun');
 if(!e||!Number.isFinite(Date.parse(e.attributes?.next_dusk)))return null;
 const above=e.state==='above_horizon';
 let rise=storedSunrise(now,storage);
 if(!rise)rise=Date.parse(e.attributes.next_dawn)-24*3600*1000;
 if(!Number.isFinite(rise))rise=null;
 const progress=above&&rise!==null?dayProgressParams(now,rise,Date.parse(e.attributes.next_dusk)):null;
 return {above,sunrise:rise,sunset:Date.parse(e.attributes.next_dusk),progress};
}
// «Сейчас»: крупная температура + состояние + влажность/ветер/давление.
export function weatherNowMarkup(args){
 if(!args)return '<p class="description">Данные погоды недоступны.</p>';
 const t=args.temp.toFixed(1).replace('.',',');
 const facts=[['Влажность',args.humidity!==null?args.humidity+' %':null],
  ['Ветер',args.wind!==null?args.wind+' км/ч':null],
  ['Давление',args.pressure!==null?args.pressure+' гПа':null]]
  .filter(([,v])=>v!==null).map(([k,v])=>`<div class="weather-fact"><span>${esc(k)}</span><strong>${esc(v)}</strong></div>`).join('');
 return `<div class="weather-now-main">${I(args.icon)}<div><strong class="weather-temp">${esc(t)}°</strong><span class="weather-label">${esc(args.label)}</span></div></div>
 <div class="weather-facts">${facts||'<span class="weather-fact is-faint">Подробностей у сущности нет</span>'}</div>`;
}
// Арка светового дня: днём — большая дуга с подписями восход/закат и процентом,
// ночью — строка «взошёл в HH:MM · зайдёт в HH:MM» без дуги.
export function weatherArcMarkup(sun,now=Date.now()){
 if(!sun||sun.sunset==null)return '<p class="description">Время восхода неизвестно.</p>';
 const rise=sun.sunrise?timeOf(sun.sunrise):'—',set=timeOf(sun.sunset);
 if(sun.above&&sun.progress!==null){
  return `<div class="weather-arc day-arc-wrap" role="img" aria-label="Светового дня пройдено ${sun.progress} % от рассвета до заката">${dayArcMarkup(sun.progress)}
  <div class="weather-arc-times"><span>Восход ${esc(rise)}</span><span>Закат ${esc(set)}</span></div>
  <p class="weather-arc-progress">Пройдено ${sun.progress} %</p></div>`;
 }
 return `<div class="weather-arc-night"><span>Солнце взошло в ${esc(rise)}</span><span>·</span><span>зайдёт в ${esc(set)}</span></div>`;
}
// Прогноз на дни: строка — день недели, иконка, min/max, осадки.
export function weatherDailyMarkup(daily){
 if(!daily||!daily.length)return '<p class="description forecast-error">Прогноз недоступен</p>';
 return `<ul class="forecast-list">${daily.map(f=>`<li class="forecast-row"><span class="forecast-day">${esc(f.day)}</span>${I(f.icon)}<b>${f.max!==null?esc(String(f.max))+'°':'—'}${f.min!==null?' / '+esc(String(f.min))+'°':''}</b>${f.prec!==null?`<span class="forecast-prec" title="Вероятность осадков">${I('droplets')}${f.prec} %</span>`:''}</li>`).join('')}</ul>`;
}
// Почасовая лента: время / иконка / температура, осадки подсвечены.
export function weatherHourlyMarkup(hourly){
 if(!hourly||!hourly.length)return '';
 return `<div class="weather-hourly-tape">${hourly.map(f=>`<div class="weather-hour${f.prec?' is-wet':''}"><span>${esc(f.time)}</span>${I(f.icon)}<b>${f.temp!==null?esc(String(f.temp))+'°':'—'}</b>${f.prec?`<small>${f.prec} %</small>`:''}</div>`).join('')}</div>`;
}