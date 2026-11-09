// Волна 2 миграции 3.0: дайджест дома на Preact. Разметка — прежний digestCard()
// из app.js (классы .digest-card/.digest-item/.digest-action совместимы с Aurora CSS,
// пункты собираются digestItems из ../digest.js — логика дайджеста не дублируется).
// Данные приходят по мини-шине digestBus: app.js в refresh() вызывает
// digestBus.notify(digestArgs()) — без внешнего стора.
import {h,html,useEffect,useState} from './kit.js';
import {digestItems} from '../digest.js';
import {esc} from '../dom.js';
import {createIcons,Info,Radio,Droplets,WifiOff,Lightbulb,Thermometer,Zap,TriangleAlert,Download} from 'lucide';
export const digestBus={fns:[],last:undefined,sub(fn){this.fns.push(fn);if(this.last!==undefined)fn(this.last)},notify(deps){this.last=deps;this.fns.forEach(f=>f(deps))}};
const I=name=>`<i data-lucide="${name}"></i>`;
// Чистая разметка (тестируется через preact-render-to-string).
// meterKnown:true — энерговиджет подтвердил показание ТНС: строку
// «Счётчик ТНС: нет данных» не показываем, чтобы не противоречить энергокарточке.
export function digestMarkup(deps){
 const items=digestItems(deps)
  .filter(it=>!(deps.meterKnown&&it.icon==='zap'&&String(it.text).startsWith('Счётчик ТНС')));
 if(!items.length)return '';
 return `<div class="digest-card ${items[0].level==='danger'?'is-danger':''}"><h3>${I('info')}Дайджест дома</h3><ul>${items.map(it=>it.action
  ?`<li class="digest-item digest-${it.level}"><button class="digest-action" ${it.action.open?`data-digest-open="${it.action.open}"`:`data-room="${esc(it.action.room)}"`} aria-label="${esc(it.text)} · ${esc(it.action.label)}">${I(it.icon)}<span>${esc(it.text)}</span><small>${esc(it.action.label)}</small></button></li>`
  :`<li class="digest-item digest-${it.level}">${I(it.icon)}<span>${esc(it.text)}</span></li>`).join('')}</ul></div>`;
}
const paintIcons=()=>{
 createIcons({icons:{Info,Radio,Droplets,WifiOff,Lightbulb,Thermometer,Zap,TriangleAlert,Download},attrs:{'stroke-width':1.6}});
 // lucide оставляет data-lucide на созданных svg: без снятия повторный вызов пересоздаёт svg.
 document.querySelectorAll('svg[data-lucide]').forEach(s=>s.removeAttribute('data-lucide'));
};
export function DigestContent({deps}){
 const markup=digestMarkup(deps);
 return markup?html`<span class="digest-widget-root" dangerouslySetInnerHTML=${{__html:markup}}></span>`:null;
}
export function DigestWidget(){
 const [deps,setDeps]=useState(null);
 useEffect(()=>{digestBus.sub(d=>setDeps(d))},[]);
 useEffect(()=>{if(deps&&digestMarkup(deps))paintIcons()},[deps]);
 return deps?html`<${DigestContent} deps=${deps}/>`:null;
}