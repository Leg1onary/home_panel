// 3.3.2: контекстный чип погоды — уточнение к погодному чипу hero-facts.
// Чистая функция: forecast — нормализованный массив пунктов прогноза
// ({datetime, condition, temperature, ...} как отдаёт ha/weather-forecast),
// now — Date.now(). Правила:
//  · есть пункты внутри ближайших 6 ч (hourly) → ближайший дождь/снег:
//      < 60 мин  → «Дождь через ~40 мин» (минуты, округление до 5, минимум 5);
//      ≥ 60 мин  → «Снег после 18:00» (время панели);
//      уже идёт  → «Дождь сейчас».
//  · без осадков в 6 ч → null (ничего не придумываем).
//  · hourly нет, только daily (первый пункт за пределами 6 ч) → завтрашний
//    пункт с осадками → «Завтра: Дождь»; без осадков → null.
//  · мусор (не массив, пусто, битые даты) → null.
import {PANEL_TIMEZONE} from './dom.js';
const PRECIP_LABEL={rainy:'Дождь',drizzle:'Дождь',lightning:'Гроза',hail:'Град',snowy:'Снег'};
const minutesOf=t=>new Intl.DateTimeFormat('ru-RU',{hour:'2-digit',minute:'2-digit',timeZone:PANEL_TIMEZONE}).format(new Date(t));
export function weatherHint(forecast,now=Date.now()){
  const list=(Array.isArray(forecast)?forecast:[]).filter(p=>p&&typeof p.datetime==='string'&&Number.isFinite(Date.parse(p.datetime))&&typeof p.condition==='string')
   .map(p=>({...p,t:Date.parse(p.datetime)})).sort((a,b)=>a.t-b.t);
  if(!list.length)return null;
  // hourly или daily? Суточные пункты идут с шагом ~24 ч: если все соседние
  // промежутки ≥ 20 ч (или пункт один) — считаем daily, иначе hourly.
  const gaps=list.slice(1).map((p,i)=>p.t-list[i].t);
  const hourly=list.length<2||gaps.some(g=>g<20*3600000);
  const HORIZON=6*3600000;
  if(hourly){ // ближайшие 6 ч
   const wet=list.find(p=>p.t<=now+HORIZON&&PRECIP_LABEL[p.condition]);
   if(!wet)return null;
   const label=PRECIP_LABEL[wet.condition];
   if(wet.t<=now)return `${label} сейчас`;
   const mins=Math.max(5,Math.round((wet.t-now)/60000/5)*5);
   if(mins<60)return `${label} через ~${mins} мин`;
   return `${label} после ${minutesOf(wet.t)}`;
  }
  // daily: первый пункт строго завтра (дата больше сегодняшней в tz панели).
  const today=new Intl.DateTimeFormat('en-CA',{timeZone:PANEL_TIMEZONE}).format(new Date(now));
  const next=list.find(p=>new Intl.DateTimeFormat('en-CA',{timeZone:PANEL_TIMEZONE}).format(new Date(p.t))>today);
  if(!next)return null;
  const label=PRECIP_LABEL[next.condition];
  return label?`Завтра: ${label}`:null;
}
