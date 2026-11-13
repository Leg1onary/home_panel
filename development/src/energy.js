// Энергия v1: поиск сущностей счётчика (ТНС-Энерго) и карточка «Электроэнергия».
// Полные entity_id не хардкодятся: sensor.* содержащий schetchik/meter, исключая signal*.
import {esc,timeOf} from './dom.js';
const BAD=['unavailable','unknown',''];
export const findMeterEntities=(states={})=>{
 const list=Object.values(states).filter(e=>typeof e?.entity_id==='string'&&e.entity_id.startsWith('sensor.')&&/schetchik|meter/.test(e.entity_id)&&!/signal/.test(e.entity_id));
 const by=tag=>list.find(e=>e.entity_id.endsWith('_'+tag))||null;
 return {reading:by('reading'),consumption:by('consumption')};
};
export const meterValue=e=>e&&!BAD.includes(e.state)&&Number.isFinite(Number(e.state))?Number(e.state):null;
const fmt=n=>new Intl.NumberFormat('ru-RU',{minimumFractionDigits:1,maximumFractionDigits:1}).format(n);
// readings_date из HA ('2026-10-26') → '26.10'; некорректное значение → null.
export const readingsDateOf=value=>{const m=/^(\d{4})-(\d{2})-(\d{2})/.exec(String(value??''));return m?`${m[3]}.${m[2]}`:null};
const intFmt=n=>new Intl.NumberFormat('ru-RU').format(Math.round(n));
export const formatMeterInt=intFmt;
const READING_DATE=/^\d{4}-\d{2}-\d{2}$/;
// Месячный расход (ТНС снимает показания раз в месяц): предыдущее показание —
// максимальное по дате строго раньше текущей даты показаний. current<prev → null
// (счётчик откатился — ждём новый месяц). Чистая функция: единая логика для
// сервера (ha/energy) и расчётов в карточке.
export const monthDelta=(currentValue,currentDate,readings)=>{
 const date=READING_DATE.exec(String(currentDate??''))&&String(currentDate);
 const current=Number(currentValue);
 if(!date||!Number.isFinite(current))return {prevValue:null,prevDate:null,delta:null};
 const prev=(Array.isArray(readings)?readings:[])
  .filter(r=>r&&READING_DATE.test(String(r?.date))&&Number.isFinite(Number(r?.value))&&String(r.date)<date)
  .sort((a,b)=>a.date<b.date?-1:1).at(-1);
 if(!prev)return {prevValue:null,prevDate:null,delta:null};
 const prevValue=Number(prev.value);
 return {prevValue,prevDate:String(prev.date),delta:current<prevValue?null:Math.round((current-prevValue)*10)/10};
};
// Стоимость по тарифу: null без тарифа; округление до рубля.
export const monthCost=(delta,tariff)=>Number.isFinite(delta)&&Number.isFinite(tariff)&&tariff>0?Math.round(delta*tariff):null;
// Месячные дельты для графика вкладки «Статистика» (3.2.8). По соседним парам
// показаний (сортировка по дате): label «мм.гг» из даты предыдущей записи —
// конец периода. Текущий открытый месяц — от последнего показания к
// currentReading {date,value}, если его дата позже. Отсекающий лимит — 12
// последних; отрицательные и некорректные точки пропускаются.
const monthLabelOf=date=>{const m=/^(\d{4})-(\d{2})-\d{2}$/.exec(String(date??''));return m?`${m[2]}.${m[1].slice(2)}`:null};
export function energyBars(readings,tariff,currentReading){
 const valid=(Array.isArray(readings)?readings:[])
  .map(r=>({date:String(r?.date??''),value:Number(r?.value)}))
  .filter(r=>READING_DATE.test(r.date)&&Number.isFinite(r.value)&&r.value>=0)
  .sort((a,b)=>a.date<b.date?-1:1);
 const bars=[];
 for(let i=0;i<valid.length-1;i++){
  const delta=Math.round((valid[i+1].value-valid[i].value)*10)/10,label=monthLabelOf(valid[i].date);
  if(!label||delta<0)continue;
  bars.push({label,delta,cost:monthCost(delta,tariff)});
 }
 const cur=currentReading&&typeof currentReading==='object'?currentReading:null;
 const curDate=cur&&READING_DATE.test(String(cur.date??''))?String(cur.date):null;
 const curValue=cur&&Number.isFinite(Number(cur.value))?Number(cur.value):null;
 const last=valid.at(-1);
 if(curDate&&curValue!==null&&last&&curDate>last.date&&curValue>=last.value){
  const delta=Math.round((curValue-last.value)*10)/10,label=monthLabelOf(curDate);
  if(label&&delta>=0)bars.push({label,delta,cost:monthCost(delta,tariff),open:true});
 }
 return bars.slice(-12);
}
const deltaRow=(label,value,cost)=>`<p class="energy-delta"><span>${label}</span><strong>${fmt(value)} кВт·ч${cost!=null?` <small class="energy-cost">≈ ${esc(intFmt(cost))} ₽</small>`:''}</strong></p>`;
const FALLBACK='Расход появится после следующей передачи показаний';
// 3.4.8: прогноз до конца месяца — темп текущего интервала × дни до календарного
// конца месяца. prevDate — начало интервала (последнее внесённое показание).
export function monthForecast(month,now=Date.now()){
 const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(String(month?.prevDate??''));
 const delta=Number(month?.delta);
 if(!m||month?.delta==null||!Number.isFinite(delta)||delta<0)return null;
 const prev=Date.UTC(Number(m[1]),Number(m[2])-1,Number(m[3]));
 const elapsedDays=(now-prev)/86400000;
 if(!(elapsedDays>=1))return null;
 const rate=delta/elapsedDays;
 const d=new Date(now),end=Date.UTC(d.getUTCFullYear(),d.getUTCMonth()+1,1);
 const daysToGo=Math.max(0,Math.round((end-now)/86400000));
 return {projected:Math.round((delta+rate*daysToGo)*10)/10,ratePerDay:Math.round(rate*100)/100,daysToGo};
}
// Сравнение темпа с «обычным»: средний суточный темп последних ≤3 закрытых
// интервалов (оба конца строго не позже prevDate) против текущего.
export function monthComparison(readings,month,now=Date.now()){
 const m=/^(\d{4})-(\d{2})-(\d{2})$/.exec(String(month?.prevDate??''));
 const delta=Number(month?.delta);
 if(!m||month?.delta==null||!Number.isFinite(delta)||delta<0)return null;
 const prev=Date.UTC(Number(m[1]),Number(m[2])-1,Number(m[3]));
 const elapsedDays=(now-prev)/86400000;
 if(!(elapsedDays>=1))return null;
 const valid=(Array.isArray(readings)?readings:[])
  .map(r=>({date:String(r?.date??''),value:Number(r?.value)}))
  .filter(r=>READING_DATE.test(r.date)&&Number.isFinite(r.value)&&r.value>=0)
  .sort((a,b)=>a.date<b.date?-1:1);
 const spans=[];
 for(let i=0;i<valid.length-1;i++){
  const a=valid[i],b=valid[i+1];
  if(b.date>String(m[0]))continue;
  const days=(Date.parse(b.date+'T00:00:00Z')-Date.parse(a.date+'T00:00:00Z'))/86400000;
  const d=Math.round((b.value-a.value)*10)/10;
  if(days>=20&&days<=40&&d>=0)spans.push({days,d});
 }
 const recent=spans.slice(-3);
 if(!recent.length)return null;
 const avgRate=recent.reduce((s,x)=>s+x.d,0)/recent.reduce((s,x)=>s+x.days,0);
 if(!(avgRate>0))return null;
 return {ratio:Math.round(delta/elapsedDays/avgRate*100)/100,avgRate:Math.round(avgRate*100)/100};
}
const comparisonText=c=>{
 if(!c)return '';
 const pct=Math.round(Math.abs(c.ratio-1)*100);
 if(c.ratio>=1.15)return `Темп выше обычного на ~${pct} %`;
 if(c.ratio<=0.85)return `Темп ниже обычного на ~${pct} %`;
 return 'Темп в обычном ритме';
};
const deltaMarkup=extra=>{
 if(!extra||(extra.deltas===undefined&&extra.month===undefined))return '';
 const rows=[];
 if(Number.isFinite(extra.deltas?.day))rows.push(deltaRow('Сутки',extra.deltas.day));
 const m=extra.month;
 if(m&&Number.isFinite(m.delta)){
  rows.push(deltaRow('Месяц',m.delta,m.cost));
  const f=m.forecast;
  if(f)rows.push(`<p class="energy-delta energy-forecast"><span>Прогноз до конца месяца</span><strong>${fmt(f.projected)} кВт·ч${m.cost!=null&&m.delta>0?` <small class="energy-cost">≈ ${esc(intFmt(m.cost/m.delta*f.projected))} ₽</small>`:''}</strong></p>`);
  const cmp=comparisonText(m.comparison);
  if(cmp)rows.push(`<p class="energy-note">${esc(cmp)}</p>`);
 }
 else rows.push(`<p class="energy-deltas is-faint">${FALLBACK}</p>`);
 return rows.join('');
};
export function energyCard(entities,now=Date.now(),extra,staleFlag=false){
 const {reading,consumption}=entities||{},r=meterValue(reading),c=meterValue(consumption);
 if(r===null&&c===null)return '';
 const stale=e=>staleFlag||(() => {const t=Date.parse(e?.last_updated);return !(Number.isFinite(t)&&now-t<6*3600000)})();
 const head=e=>meterValue(e)===null?`<strong class="is-faint">нет данных</strong><small class="energy-meta is-stale">Счётчик</small>`:`<strong>${fmt(meterValue(e))} кВт·ч</strong><small class="energy-meta ${stale(e)?'is-stale':''}">Счётчик · обновлено ${timeOf(Date.parse(e.last_updated))}${staleFlag?' · ТНС недоступна':''}</small>`;
 // Дайджест: когда сервер помнит последние значения, пункт «нет данных» не нужен — виджет их показывает.
 if(staleFlag&&extra?.readingsDate===undefined)extra={...(extra||{}),readingsDate:extra?.readingsDate};
 const dateLine=readingsDateOf(extra?.readingsDate);
 const consumptionRow=c===null?'':`<p class="energy-consumption"><span>Потребление</span><strong>${fmt(c)+' кВт·ч'}</strong></p>`;
 return `<section class="digest-card energy-card"><h3><i data-lucide="zap"></i>Электроэнергия<button class="energy-reload" data-energy-reload title="Обновить расход" aria-label="Обновить расход"><i data-lucide="rotate-ccw"></i></button></h3><p class="energy-reading">${head(reading)}${dateLine?`<small class="energy-meta">Дата показаний: ${esc(dateLine)}</small>`:''}</p>${consumptionRow}<div class="energy-deltas">${deltaMarkup(extra)}</div></section>`;
}
