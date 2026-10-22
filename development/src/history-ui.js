import {areaName,areas} from './catalog.js';
import {binaryValue} from './sensor-state.js';
export const historyState={hours:24,metric:'temperature',room:'all',eventType:'all',data:null,loading:false,error:'',request:0};
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const palette=()=>typeof document!=='undefined'&&document.documentElement.dataset.theme==='light'?['#92611f','#16727e','#7545a7','#aa3552','#42733b']:['#e6ba72','#7acbd7','#c5a4ee','#f5a5b3','#9acd9b'];
const colorFor=(g,i,colors)=>colors[({living:0,well:1,attic:2})[g.room]??i%colors.length];
const number=v=>Number.isFinite(v)?v.toLocaleString('ru-RU',{maximumFractionDigits:1}):'—';
const time=t=>new Date(t).toLocaleString('ru-RU',{timeZone:'Europe/Moscow',day:'2-digit',month:'2-digit',hour:'2-digit',minute:'2-digit'});
let chart=null;
function selectedSeries(s){return (s.data?.series||[]).filter(g=>g.type===s.metric&&(s.room==='all'||g.room===s.room))}
function graph(s){
 const colors=palette();
 const groups=selectedSeries(s),data=s.data;
 const valid=groups.flatMap(g=>g.points.filter(p=>p.value!==null));
 if(!data||!valid.length){chart=null;return '<div class="history-empty"><strong>Пока нет точек для графика</strong><span>Выбери другой период или проверь, сохраняет ли HA историю этих датчиков.</span></div>'}
 const width=typeof window==='undefined'?900:Math.max(280,window.innerWidth-(window.innerWidth>600?188:64)),height=240;
 const left=48,right=width-16,top=20,bottom=192;
 let min=Infinity,max=-Infinity;for(const p of valid){min=Math.min(min,p.value);max=Math.max(max,p.value)}
 const pad=Math.max((max-min)*.14,s.metric==='temperature'?.5:2);min-=pad;max+=pad;
 const x=t=>left+(Math.max(data.start,Math.min(data.end,t))-data.start)/(data.end-data.start)*(right-left);
 const y=v=>bottom-(v-min)/(max-min)*(bottom-top);
 chart={groups,start:data.start,end:data.end,width,left,right};
 const ticks=Array.from({length:4},(_,i)=>{const value=min+(max-min)*i/3,py=y(value);return `<line x1="${left}" y1="${py}" x2="${right}" y2="${py}" class="history-grid"/><text x="${left-9}" y="${py+4}" text-anchor="end">${number(value)}</text>`}).join('');
 const times=Array.from({length:4},(_,i)=>{const at=data.start+(data.end-data.start)*i/3,label=new Date(at).toLocaleString('ru-RU',data.end-data.start>86400000?{timeZone:'Europe/Moscow',day:'2-digit',month:'2-digit'}:{timeZone:'Europe/Moscow',hour:'2-digit',minute:'2-digit'});return `<text x="${x(at)}" y="${bottom+28}" text-anchor="${i===0?'start':i===3?'end':'middle'}">${label}</text>`}).join('');
 const paths=groups.map((g,i)=>{
  let path='',previous=null;
  for(const p of g.points){
   if(p.value===null){previous=null;continue}
   const move=!previous||p.at-previous.at>2*3600000;
   path+=(move?'M':'L')+x(p.at).toFixed(1)+','+y(p.value).toFixed(1)+' ';previous=p;
  }
  return `<path d="${path}" fill="none" stroke="${colorFor(g,i,colors)}" stroke-width="2.5" stroke-linecap="round" stroke-linejoin="round" vector-effect="non-scaling-stroke"/>${g.points.filter(p=>p.value!==null).filter((_,j,a)=>a.length<6||j===a.length-1).map(p=>`<circle cx="${x(p.at)}" cy="${y(p.value)}" r="3.5" fill="${colorFor(g,i,colors)}"/>`).join('')}`;
 }).join('');
 return `<svg class="history-svg" data-history-chart tabindex="0" role="img" aria-label="${s.metric==='temperature'?'Температура':'Влажность'} за выбранный период. Стрелки влево и вправо: просмотр показаний." viewBox="0 0 ${width} ${height}" width="100%" height="${height}">${ticks}${times}${paths}<line class="history-cursor" x1="${left}" x2="${left}" y1="${top}" y2="${bottom}" hidden/><rect x="${left}" y="${top}" width="${right-left}" height="${bottom-top}" fill="transparent"/></svg>
 <div class="history-readout" id="history-readout" role="status">Наведи на график или используй стрелки для просмотра показаний</div>`;
}
export function inspectHistoryChart(event){
 if(!chart)return;
 const svg=event.target.closest('svg[data-history-chart]');if(!svg)return;
 const rect=svg.getBoundingClientRect();
 let fraction;
 if(event.type==='keydown'){
  if(!['ArrowLeft','ArrowRight','Home','End'].includes(event.key))return;
  event.preventDefault();
  const previous=Number(svg.dataset.fraction||.5);
  fraction=event.key==='Home'?0:event.key==='End'?1:previous+(event.key==='ArrowLeft'?-.02:.02);
 }else fraction=((event.clientX-rect.left)/rect.width*chart.width-chart.left)/(chart.right-chart.left);
 fraction=Math.max(0,Math.min(1,fraction));svg.dataset.fraction=String(fraction);
 const at=chart.start+(chart.end-chart.start)*fraction,px=chart.left+(chart.right-chart.left)*fraction;
 const line=svg.querySelector('.history-cursor');line.removeAttribute('hidden');line.setAttribute('x1',px);line.setAttribute('x2',px);
 const values=chart.groups.map(g=>{
  const closest=g.points.reduce((best,p)=>!best||Math.abs(p.at-at)<Math.abs(best.at-at)?p:best,null);
  return areaName(g.room)+': '+(!closest||closest.value===null||Math.abs(closest.at-at)>2*3600000?'нет данных':number(closest.value)+(g.type==='temperature'?' °C':' %')+' · '+time(closest.at));
 });
 const output=document.querySelector('#history-readout');if(output)output.textContent=values.join('   /   ');
}
function eventText(e){
 if(['unknown','unavailable',''].includes(e.state))return 'Нет данных / недоступно';
 if(['light','door','leak','motion'].includes(e.type)){
  const value=binaryValue(e.type,e.state);
  if(value===null)return 'Неизвестное состояние: '+e.state;
  return ({light:['Включён','Выключен'],door:['Открыта','Закрыта'],leak:['Протечка','Сухо'],motion:['Движение','Нет движения']})[e.type][value?0:1];
 }
 return e.state;
}
export function statisticsView(s=historyState){
 const colors=palette();
 const d=s.data,groups=selectedSeries(s),events=(d?.events||[]).filter(e=>(s.room==='all'||e.room===s.room)&&(s.eventType==='all'||e.type===s.eventType)).slice(0,200);
 const roomIds=[...new Set([...areas.map(a=>a.id),...[...(d?.series||[]),...(d?.events||[]),...(d?.lights||[])].map(g=>g.room)])];
 const lights=(d?.lights||[]).filter(e=>s.room==='all'||e.room===s.room);
 const lineHours=lights.reduce((sum,e)=>sum+e.onMs/3600000,0),coverage=lights.length?lights.reduce((sum,e)=>sum+e.coverage,0)/lights.length:0;
 return `<div class="statistics-view"><div class="statistics-heading"><div><p class="eyebrow">ИСТОРИЯ ДОМА</p><h1>Статистика</h1><p>Показания и события из Home Assistant. Без выдуманных данных.</p></div><button class="secondary" data-action="history-reload" ${s.loading?'disabled':''}>${s.loading?'Загружаем…':'Обновить'}</button></div>
 <div class="history-toolbar"><div class="history-period" role="group" aria-label="Период">${[[6,'6 часов'],[24,'Сутки'],[168,'Неделя']].map(([v,label])=>`<button data-history-hours="${v}" aria-pressed="${s.hours===v}" ${s.loading?'disabled':''}>${label}</button>`).join('')}</div>
 <label class="history-room-label">Зона<select id="history-room"><option value="all">Весь дом</option>${roomIds.map(id=>`<option value="${esc(id)}" ${s.room===id?'selected':''}>${esc(areaName(id))}</option>`).join('')}</select></label></div>
 ${s.error?`<div class="history-notice" role="alert"><strong>Историю получить не удалось</strong><p>${esc(s.error)}</p><button class="text-button" data-action="history-reload">Повторить</button></div>`:''}
 ${s.loading?'<div class="history-loading" role="status">Читаем историю выбранных датчиков…</div>':''}
 <section class="history-chart-card ${s.loading?'is-loading':''}" aria-busy="${s.loading}">
 <div class="history-chart-heading"><div><h2>Климат дома</h2><p>${d?time(d.start)+' — '+time(d.end):'История ещё не загружена'}</p></div><div class="history-metric" role="group" aria-label="Показатель">${[['temperature','Температура'],['humidity','Влажность']].map(([v,label])=>`<button data-history-metric="${v}" aria-pressed="${s.metric===v}">${label}</button>`).join('')}</div></div>
 <div class="history-legend">${groups.map((g,i)=>`<span><i style="background:${colorFor(g,i,colors)}"></i>${esc(areaName(g.room))}<b>${number(g.last)} ${s.metric==='temperature'?'°C':'%'}</b></span>`).join('')}</div>
 ${graph(s)}
 <div class="history-ranges">${groups.map(g=>`<span>${esc(areaName(g.room))}: <b>${number(g.min)}…${number(g.max)} ${s.metric==='temperature'?'°C':'%'}</b></span>`).join('')}</div>
 <p class="history-footnote">Разрывы — нет достоверных показаний. Последняя точка относится к истории, а не обязательно к текущему состоянию.</p></section>
 <div class="history-bottom"><section class="history-events"><div class="history-section-heading"><div><h2>События</h2><p>Реальные изменения HA, без расчётных сбросов движения</p></div><select id="history-event-type" aria-label="Тип события">${[['all','Все события'],['door','Двери'],['motion','Движение'],['leak','Протечки'],['light','Свет']].map(([v,t])=>`<option value="${v}" ${s.eventType===v?'selected':''}>${t}</option>`).join('')}</select></div>
 ${events.length?`<ol class="history-timeline" tabindex="0" aria-label="Журнал изменений">${events.map(e=>`<li class="${e.type==='leak'&&binaryValue('leak',e.state)===true?'is-alarm':''}"><time datetime="${new Date(e.at).toISOString()}">${time(e.at)}</time><div><strong>${esc(e.name)}</strong><span>${esc(areaName(e.room))} · ${esc(eventText(e))}</span></div></li>`).join('')}</ol>`:'<div class="history-empty is-small">Событий за выбранный период и фильтр нет.</div>'}
 ${d?.truncated?'<p class="history-footnote">До 200 последних записей каждого типа. Общий список тоже ограничен 200 записями; выбери тип для отдельной истории.</p>':''}</section>
 <section class="history-lights"><h2>Свет за период</h2><div class="history-line-hours">${d&&coverage>0?number(lineHours):'—'}<small>линия·ч</small></div><p>Сумма времени включения всех линий, не расход электричества.</p>
 <p class="history-footnote">Покрытие достоверными состояниями: ${d?Math.round(coverage*100):'—'} %. Непривязанные линии не учитываются.</p>
 ${lights.sort((a,b)=>b.onMs-a.onMs).slice(0,6).map(e=>`<div class="history-light-row"><span>${esc(e.name)}</span><b>${e.knownMs?number(e.onMs/3600000)+' ч':'нет истории'}</b></div>`).join('')}
 <div class="history-source">Home Assistant History${d?' · загружено '+time(d.end)+'<br/>История есть для '+d.recordedCount+' из '+d.scopeCount+' сущностей':''}</div></section></div></div>`;
}
