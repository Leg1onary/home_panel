// Волна 3 миграции 3.0: рельса «Под рукой» на Preact. 3.3.14: плеер вынесен
// из рельсы в компактную карточку станции в правой колонке (station-widget.js).
// Классы .quick-device и все data-action/data-camera сохранены 1:1 — клики
// обрабатывает существующий диспетчер app.js. Данные — мини-шина quickBus.
import {h,html,useEffect,useState} from './kit.js';
import {disabled} from '../dom.js';
import {paintAll} from './icons.js';
export const quickBus={fns:[],last:undefined,sub(fn){this.fns.push(fn);if(this.last!==undefined)fn(this.last)},notify(deps){this.last=deps;this.fns.forEach(f=>f(deps))}};
const I=name=>`<i data-lucide="${name}"></i>`;
// Чистая разметка (тестируется через preact-render-to-string). deps — вычисленные
// deps — флаги из app.js: masterBlocked, cameraId.
export function quickMarkup(deps){
 return `<div class="quick-devices">
 <button class="quick-device light-shortcut" data-action="master" ${disabled(deps.masterBlocked)}><span class="quick-device-icon">${I('power')}</span><span><strong>Весь свет</strong><small>Выключить</small></span></button>
 ${deps.cameraId?`<button class="quick-device camera-shortcut" data-camera="${deps.cameraId}" aria-label="Двор: открыть прямой эфир"><span class="quick-device-icon">${I('video')}</span><span><strong>Двор</strong><small>Камера</small></span></button>`:''}
 </div>`;
}
const paintIcons=paintAll;
export function QuickContent({deps}){
 const markup=quickMarkup(deps);
 return markup?html`<span class="quick-widget-root" dangerouslySetInnerHTML=${{__html:markup}}></span>`:null;
}
export function QuickWidget(){
 const [deps,setDeps]=useState(null);
 useEffect(()=>{quickBus.sub(d=>setDeps(d))},[]);
 useEffect(()=>{if(deps&&quickMarkup(deps))paintIcons()},[deps]);
 return deps?html`<${QuickContent} deps=${deps}/>`:null;
}
