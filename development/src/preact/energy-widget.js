// Энергокарточка на Preact (волна 1 миграции 3.0). Разметка и классы — прежние
// (energyCard из ../energy.js): CSS .energy-card и потомки остаются совместимыми.
// Данные — api('ha/energy') напрямую: reading.value/consumption конечны → рисуем,
// иначе (data.stale) — карточка из серверных последних значений с пометкой «ТНС недоступна».
// Пока данных с сервера нет — откат на живые сущности state.entityStates (findMeterEntities).
import {h,html,useEffect,useState,useCallback,useRef} from './kit.js';
import {api} from '../api.js';
import {isLive} from '../live.js';
import {state} from '../schema.js';
import {energyCard,findMeterEntities} from '../energy.js';
import {paintAll} from './icons.js';
const POLL_MS=60000;
// Чистая разметка без хуков: тестируется через preact-render-to-string.
// data null → откат на entities (живые сущности); нет ни того, ни другого → null.
export function EnergyWidgetContent({data,entities,now=Date.now(),onReload}){
 let markup;
 if(data&&typeof data==='object'){
  const r=Number.isFinite(data.reading?.value)?data.reading.value:null;
  const c=Number.isFinite(data.consumption)?data.consumption:null;
  if(r===null&&c===null)return null;
  const u=data.reading?.updatedAt;
  const ents={reading:r!==null?{entity_id:data.reading?.entityId||'synthetic',state:String(r),last_updated:u}:null,
   consumption:c!==null?{entity_id:'synthetic',state:String(c),last_updated:u}:null};
  const extra={readingsDate:data.readingsDate??null,deltas:data.deltas?{day:data.deltas.day}:null,month:data.month?{prevValue:data.month.prevValue,prevDate:data.month.prevDate,delta:data.month.delta,cost:data.month.cost}:null};
  if(data.stale)extra.stale=true,extra.staleSince=data.staleSince;
  markup=energyCard(ents,now,extra,data.stale);
 }else{
  if(!entities)return null;
  markup=energyCard(entities,now);
 }
 if(!markup)return null;
 // Клик по кнопке обновления: делегирование на обёртке (data-energy-reload остаётся в разметке).
 return html`<span class="energy-widget-root" dangerouslySetInnerHTML=${{__html:markup}} onClick=${e=>{if(e.target.closest?.('[data-energy-reload]'))onReload?.()}}></span>`;
}
const paintIcons=paintAll;
export function EnergyWidget({onMeterKnown}){
 const [data,setData]=useState(null);
 const [tick,setTick]=useState(0);
 const [error,setError]=useState('');
 const pollRef=useRef({at:0,busy:false});
 const alive=useRef(true);
 const meterKnownRef=useRef(null);
 const onMeterKnownRef=useRef(onMeterKnown);
 onMeterKnownRef.current=onMeterKnown;
 const poll=useCallback(async force=>{
  if(!isLive()||pollRef.current.busy)return;
  const now=Date.now();
  if(!force&&now-pollRef.current.at<POLL_MS)return;
  pollRef.current.busy=true;pollRef.current.at=now;
  try{const result=await api('ha/energy');if(alive.current){setData(result);setError('')}}
  catch(e){if(alive.current)setError(e.message)} // история расхода недоступна — карточка остаётся с показаниями
  finally{pollRef.current.busy=false;if(alive.current)setTick(t=>t+1)}
 },[]);
 // Первый рендер — ленивый вызов; далее polling раз в 60 с (клиентский кеш, как серверный).
 useEffect(()=>{
  poll();
  const timer=setInterval(()=>{if(!document.hidden)poll()},POLL_MS);
  return()=>{alive.current=false;clearInterval(timer)};
 },[poll]);
 // digestArgs в app.js читает флаг из модульной переменной, заполненной этим колбэком.
 useEffect(()=>{
  const known=Boolean(data?.stale&&Number.isFinite(data?.reading?.value));
  if(meterKnownRef.current!==known){meterKnownRef.current=known;onMeterKnownRef.current?.(known)}
 },[data,tick]);
 useEffect(paintIcons);
 if(!isLive())return null;
 return html`<${EnergyWidgetContent} data=${data} entities=${findMeterEntities(state.entityStates||{})} now=${Date.now()} onReload=${()=>poll(true)}/>${error?html`<span hidden>${error}</span>`:null}<span hidden>${tick}</span>`;
}
