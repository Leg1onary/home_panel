// 3.4.5: страница «Погода» — чистые функции (аргументы вида, разметка «сейчас»,
// арка светового дня с восходом/закатом и динамикой длины дня, прогноз на дни
// с температурными полосками, почасовая лента с вероятностью осадков, луна).
// Разметку монтирует app.js (render()/refresh()); здесь нет обращения к DOM.
import {esc,timeOf,PANEL_TIMEZONE} from './dom.js';
import {WEATHER_LABEL,WEATHER_ICON,WEATHER_DATA} from './weather-const.js';
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
// Вероятность осадков: сервер отдаёт precipitationProbability (camelCase,
// см. server/ha.js), сырой HA-прогноз — precipitation_probability. Берём обе.
const precOf=f=>{
 if(Number.isFinite(Number(f.precipitation_probability)))return Number(f.precipitation_probability);
 if(Number.isFinite(Number(f.precipitationProbability)))return Number(f.precipitationProbability);
 return null};
const mmOf=f=>Number.isFinite(Number(f.precipitation))?Number(f.precipitation):null;
// Аргументы страницы: null когда погодной сущности нет или она недоступна.
export function weatherViewArgs(entityStates,forecast=[],now=Date.now()){
 const e=weatherEntityOf(entityStates);
 if(!e||['unknown','unavailable',''].includes(e.state))return null;
 const a=e.attributes||{},label=WEATHER_LABEL[e.state],temp=a.temperature;
 if(!label||!Number.isFinite(temp))return null;
 const {daily,hourly}=splitForecast(forecast);
 return {label,icon:WEATHER_ICON[e.state]||'cloudy',state:e.state,data:WEATHER_DATA[e.state]||'cloudy',
  temp,humidity:Number.isFinite(a.humidity)?Math.round(a.humidity):null,
  wind:Number.isFinite(a.wind_speed)?a.wind_speed:null,
  bearing:Number.isFinite(a.wind_bearing)?a.wind_bearing:null,
  pressure:Number.isFinite(a.pressure)?a.pressure:null,
  daily:daily.slice(0,7).map(f=>({day:weekday(Date.parse(f.datetime)),icon:WEATHER_ICON[f.condition]||'cloudy',
   condition:WEATHER_LABEL[f.condition],min:Number.isFinite(f.templow)?Math.round(f.templow):null,
   max:Number.isFinite(f.temperature)?Math.round(f.temperature):null,
   prec:precOf(f),mm:mmOf(f)})),
  hourly:hourly.slice(0,24).map(f=>({time:timeOf(Date.parse(f.datetime)),icon:WEATHER_ICON[f.condition]||'cloudy',
   temp:Number.isFinite(f.temperature)?Math.round(f.temperature):null,
   prec:precOf(f),mm:mmOf(f)})),
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
 return {above,sunrise:rise,sunset:Date.parse(e.attributes.next_dusk),progress,
  nextDawn:Number.isFinite(Date.parse(e.attributes.next_dawn))?Date.parse(e.attributes.next_dawn):null,
  nextDusk:Number.isFinite(Date.parse(e.attributes.next_setting))?Date.parse(e.attributes.next_setting):null};
}
// Ощущается как: упрощённый wind chill — ниже +10 °C и ветер сильнее 1.6 м/с
// (≈5.8 км/ч): feels = temp − √(wind м/с) · 0.7. Иначе ощущается как есть.
export function feelsLike(temp,windKmh){
 if(!Number.isFinite(temp))return null;
 const ms=Number.isFinite(windKmh)?windKmh/3.6:0;
 if(temp<10&&ms>1.6)return Math.round((temp-Math.sqrt(ms)*0.7)*10)/10;
 return temp;
}
// Компас: bearing 0–360 → 8 румбов (0 = север). Мусор → '—'.
export function windCompass(deg){
 if(!Number.isFinite(Number(deg)))return '—';
 return ['С','СВ','В','ЮВ','Ю','ЮЗ','З','СЗ'][Math.round(((Number(deg)%360)+360)%360/45)%8];
}
// Луна: фазы от новолуния 2000-01-06 18:14 UTC, синодический месяц 29.53058867
// сут. phase 0..1 (0 = новолуние, 0.5 = полнолуние), освещённость
// (1−cos(2π·phase))/2·100 — геометрическая доля видимого диска.
const SYNODIC=29.53058867,NEW_MOON=Date.UTC(2000,0,6,18,14);
const MOON_NAMES=['Новолуние','Молодая луна','Первая четверть','Растущая луна','Полнолуние','Убывающая луна','Последняя четверть','Старая луна'];
export function moonPhase(dateMs){
 if(!Number.isFinite(dateMs))return null;
 const phase=(((dateMs-NEW_MOON)/86400000/SYNODIC)%1+1)%1;
 return {phase:+phase.toFixed(4),name:MOON_NAMES[Math.round(phase*8)%8],
  illumination:Math.round((1-Math.cos(2*Math.PI*phase))/2*100)};
}
// Динамика длины дня: сравниваю завтрашний световой день (next_setting−next_dawn
// из sun.sun) с сегодняшним (dusk−dawn). Приближение честное — обе длины из
// атрибутов солнца; вчерашние HA не отдаёт, поэтому «вчера» не используется.
// Возвращает минуты: >0 — день прибывает, <0 — убывает.
export function dayLengthDelta(dawnMs,duskMs,nextDawnMs,nextDuskMs){
 if(![dawnMs,duskMs,nextDawnMs,nextDuskMs].every(Number.isFinite))return 0;
 return Math.round(((nextDuskMs-nextDawnMs)-(duskMs-dawnMs))/60000);
}
// Цвет температурной полоски: −15 °C — синеватый, +25 °C — золотой, между —
// линейная интерполяция.
export function tempColor(t){
 if(!Number.isFinite(t))return 'var(--muted)';
 const x=Math.max(0,Math.min(1,(t+15)/40));
 const cold=[0x5b,0x8e,0xc9],warm=[0xd8,0xa2,0x3e];
 return `rgb(${cold.map((c,i)=>Math.round(c+(warm[i]-c)*x)).join(',')})`;
}
// «Сейчас»: крупная температура + состояние + ощущение + влажность/ветер/давление.
export function weatherNowMarkup(args){
 if(!args)return '<p class="description">Данные погоды недоступны.</p>';
 const t=args.temp.toFixed(1).replace('.',',');
 const feel=feelsLike(args.temp,args.wind);
 const feelLabel=feel!==null&&Math.abs(feel-args.temp)>=0.05?`${feel.toFixed(1).replace('.',',')}°`:'';
 const facts=[['Влажность',args.humidity!==null?args.humidity+' %':null],
  ['Ветер',args.wind!==null?`${args.wind} км/ч · ${windCompass(args.bearing)}`:null],
  ['Давление',args.pressure!==null?args.pressure+' гПа':null]]
  .filter(([,v])=>v!==null).map(([k,v])=>`<div class="weather-fact"><span>${esc(k)}</span><strong>${esc(v)}</strong></div>`).join('');
 return `<div class="weather-now-main" data-weather="${esc(args.data||'cloudy')}">${I(args.icon)}<div><strong class="weather-temp">${esc(t)}°</strong><span class="weather-label">${esc(args.label)}</span>${feelLabel?`<span class="weather-feels">Ощущается как ${esc(feelLabel)}</span>`:''}</div></div>
 <div class="weather-facts">${facts||'<span class="weather-fact is-faint">Подробностей у сущности нет</span>'}</div>`;
}
// Луна: фаза + освещённость + svg-кружок, «тень» которого сдвигается по фазе
// (приближение: круг-маска скользит по диску, у полнолуния уходит за край).
export function weatherMoonMarkup(now=Date.now()){
 const m=moonPhase(now);
 if(!m)return '';
 const off=Math.abs(m.phase-0.5)*2; // 1 у новолуния (тень закрывает всё), 0 у полнолуния
 const dx=(1-off)*28;
 return `<div class="weather-moon"><svg viewBox="0 0 32 32" role="img" aria-label="${esc(m.name)}, освещённость ${m.illumination} %" focusable="false"><circle cx="16" cy="16" r="12" class="moon-lit"/><circle cx="16" cy="16" r="12" class="moon-shadow" style="transform:translate(${dx.toFixed(1)}px)"/></svg><div><strong>${esc(m.name)}</strong><span>Освещённость ${m.illumination} %</span></div></div>`;
}
// Арка светового дня: днём — большая дуга с подписями восход/закат и процентом,
// плюс длина дня и динамика (завтра vs сегодня, next_setting−next_dawn);
// ночью — строка «взошёл в HH:MM · зайдёт в HH:MM» без дуги.
const lengthLabel=ms=>{
 const m=Math.round(ms/60000),h=Math.floor(m/60);
 return `${String(h).padStart(2,'0')}:${String(m%60).padStart(2,'0')}`;
};
const mmLabel=mm=>String(mm).replace('.',',');
function dayLengthText(sun){
 if(![sun.sunrise,sun.sunset,sun.nextDawn,sun.nextDusk].every(Number.isFinite))return '';
 const delta=dayLengthDelta(sun.sunrise,sun.sunset,sun.nextDawn,sun.nextDusk);
 const length=(sun.sunset-sun.sunrise);
 if(!Number.isFinite(length)||length<=0)return '';
 const tail=delta<0?` · день убывает на ${-delta} мин`:delta>0?` · день прибывает на ${delta} мин`:' · длина дня не меняется';
 return `<p class="weather-arc-length">Длина дня ${lengthLabel(length)}${tail}</p>`;
}
export function weatherArcMarkup(sun,now=Date.now()){
 if(!sun||sun.sunset==null)return '<p class="description">Время восхода неизвестно.</p>';
 const rise=sun.sunrise?timeOf(sun.sunrise):'—',set=timeOf(sun.sunset);
 if(sun.above&&sun.progress!==null){
  return `<div class="weather-arc day-arc-wrap" role="img" aria-label="Светового дня пройдено ${sun.progress} % от рассвета до заката">${dayArcMarkup(sun.progress)}
  <div class="weather-arc-times"><span>Восход ${esc(rise)}</span><span>Закат ${esc(set)}</span></div>
  <p class="weather-arc-progress">Пройдено ${sun.progress} %</p></div>${dayLengthText(sun)}`;
 }
 return `<div class="weather-arc-night"><span>Солнце взошло в ${esc(rise)}</span><span>·</span><span>зайдёт в ${esc(set)}</span></div>`;
}
// Прогноз на дни: строка — день недели, иконка, min/max, полоска-диапазон на
// общей шкале (min/max за все дни), вероятность осадков и мм под баром.
export function weatherDailyMarkup(daily){
 if(!daily||!daily.length)return '<p class="description forecast-error">Прогноз недоступен</p>';
 const known=daily.filter(f=>f.min!==null||f.max!==null);
 const lo=Math.min(...known.map(f=>f.min??f.max??0)),hi=Math.max(...known.map(f=>f.max??f.min??0));
 const span=Math.max(1,hi-lo);
 return `<ul class="forecast-list">${daily.map(f=>{
  const left=f.min!==null?(f.min-lo)/span*100:0;
  const width=f.min!==null&&f.max!==null?Math.max(6,(f.max-f.min)/span*100):6;
  const mid=f.min!==null&&f.max!==null?(f.min+f.max)/2:f.min??f.max??0;
  return `<li class="forecast-row"><span class="forecast-day">${esc(f.day)}</span>${I(f.icon)}<b>${f.max!==null?esc(String(f.max))+'°':'—'}${f.min!==null?' / '+esc(String(f.min))+'°':''}</b><span class="forecast-range" data-min="${f.min??''}" data-max="${f.max??''}" data-scale="${lo}..${hi}"><span class="forecast-range-bar" style="left:${left.toFixed(1)}%;width:${width.toFixed(1)}%;background:${tempColor(mid)}"></span></span>${f.prec!==null?`<span class="forecast-prec" title="Вероятность осадков">${I('droplets')}${f.prec} %</span>`:''}${f.mm>0?`<small class="forecast-mm">${mmLabel(f.mm)} мм</small>`:''}</li>`}).join('')}</ul>`;
}
// Почасовая лента: время / иконка / температура / столбик вероятности осадков /
// подпись «N %» и мм при осадках >0.
export function weatherHourlyMarkup(hourly){
 if(!hourly||!hourly.length)return '';
 return `<div class="weather-hourly-tape">${hourly.map(f=>{
  const prec=f.prec??0;
  return `<div class="weather-hour${f.prec?' is-wet':''}"><span>${esc(f.time)}</span>${I(f.icon)}<b>${f.temp!==null?esc(String(f.temp))+'°':'—'}</b><span class="hour-prec" role="img" aria-label="Вероятность осадков ${prec} %"><span style="height:${prec}%"></span></span><small>${f.prec!==null?`${f.prec} %`:'&nbsp;'}${f.mm>0?` · ${mmLabel(f.mm)} мм`:''}</small></div>`}).join('')}</div>`;
}