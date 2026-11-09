// Волна 3 миграции 3.0: факты дома (двери/скважина/чердак) и двор-чип на Preact.
// Разметка — прежние homeStatus() и yardMarkup() из app.js (классы .home-fact,
// .yard-chip, aria-атрибуты и data-action/data-sensor сохранены 1:1 — диспетчер
// app.js не тронут). Данные — мини-шина factsBus: app.js в refresh() и после
// опроса движения двора вызывает factsBus.notify(factsArgs()); демо-режим тоже
// шлёт deps (факты в демо есть: «Закрыта · демо» и т.п.). Погодный чип —
// отдельный виджет в слоте #weather-slot, здесь не дублируется.
import {h,html,useEffect,useState,useRef} from './kit.js';
import {esc} from '../dom.js';
import {showYardCard} from '../yard-card.js';
import {createIcons,Camera} from 'lucide';
export const factsBus={fns:[],last:undefined,sub(fn){this.fns.push(fn);if(this.last!==undefined)fn(this.last)},notify(deps){this.last=deps;this.fns.forEach(f=>f(deps))}};
const I=name=>`<i data-lucide="${name}"></i>`;
// Двор-чип: deps.yard = {data, when, mode, now, frameUrl, leaving?}.
export function yardMarkup(yard){
 if(!yard||!yard.data||yard.data.available===false)return '';
 if(!showYardCard({motion:yard.data.motion,lastMotionAt:yard.data.lastMotionAt,now:yard.now,mode:yard.mode}))return '';
 const when=esc(yard.when);
 const thumb=yard.frameUrl?`<img src="${esc(yard.frameUrl)}" alt=""/>`:I('camera');
 return `<button class="home-fact yard-chip${yard.leaving?' is-leaving':''}" data-camera="camera-yard" title="Панельное распознавание движения по кадру камеры" aria-label="Двор: движение в ${when}. Открыть камеру двора"><span class="yard-thumb" aria-hidden="true">${thumb}</span><strong>Движение · ${when}</strong></button>`;
}
// Факты: deps = {devices, door, terrace, well, attic}. door/terrace/well/attic —
// готовые строки из app.js (binaryLabel/deviceReading), devices — для наличия
// установленной двери на террасу.
export function factsMarkup(deps){
 const terraceDoor=deps.devices?.some?.(d=>d.id==='terrace-door'&&d.status==='installed')??deps.terraceDoor;
 const fact=(label,value,attrs,attention=false)=>`<button class="home-fact ${attention?'needs-attention':''} ${/Нет |—/.test(value)?'is-faint':''}" ${attrs}><span>${label}</span><strong>${esc(value)}</strong></button>`;
 return factsYard(deps)+fact('Входная',deps.door,`data-action="door" aria-label="Входная дверь: ${esc(deps.door)}"`,deps.door==='Открыта')+
 (terraceDoor?fact('Терраса',deps.terrace,'data-action="terrace-door"',deps.terrace==='Открыта'):'')+
 fact('Скважина',deps.well,'data-sensor="well"')+
 fact('Чердак',deps.attic,'data-sensor="attic"');
}
function factsYard(deps){
 if(!deps.live)return '';
 return yardMarkup(deps.yard);
}
const paintIcons=()=>{
 createIcons({icons:{Camera},attrs:{'stroke-width':1.6}});
 document.querySelectorAll('svg[data-lucide]').forEach(s=>s.removeAttribute('data-lucide'));
};
export function FactsContent({deps}){
 const markup=factsMarkup(deps);
 return markup?html`<span class="facts-widget-root" dangerouslySetInnerHTML=${{__html:markup}}></span>`:null;
}
// Наличие двора-чипа в deps (для анимации исчезновения is-leaving).
export function hasYardChip(deps){
 return !!(deps&&deps.live&&deps.yard&&deps.yard.data&&deps.yard.data.available!==false&&
  showYardCard({motion:deps.yard.data.motion,lastMotionAt:deps.yard.data.lastMotionAt,now:deps.yard.now,mode:deps.yard.mode}));
}
export function FactsWidget({onYardFrame}={}){
 const [deps,setDeps]=useState(null);
 const [leaving,setLeaving]=useState(null); // последний двор-чип, замирающий с is-leaving
 const yardRef=useRef(null);
 useEffect(()=>{factsBus.sub(d=>{
  setDeps(d);
  if(hasYardChip(d)){yardRef.current=d.yard}
  else if(yardRef.current){
   const y=yardRef.current;yardRef.current=null;
   setLeaving(y);
   setTimeout(()=>setLeaving(cur=>cur===y?null:cur),500);
  }
 })},[]);
 // Кадр двора: просим app.js догрузить превью, когда чип появился без кадра.
 useEffect(()=>{if(hasYardChip(deps)&&!deps.yard.frameUrl&&onYardFrame)onYardFrame()},[deps]);
 useEffect(()=>{if(deps&&factsMarkup(deps))paintIcons()},[deps]);
 const shown=deps?{...deps,yard:hasYardChip(deps)?deps.yard:(leaving?{...leaving,leaving:true}:null)}:null;
 return shown?html`<${FactsContent} deps=${shown}/>`:null;
}
