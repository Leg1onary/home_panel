// Волна 3 миграции 3.0: рельса «Под рукой» на Preact. Разметка — прежний
// homeQuick() из app.js (классы .quick-device/.media-details, все data-action/
// data-camera сохранены 1:1 — клики обрабатывает существующий диспетчер app.js).
// Данные — мини-шина quickBus: app.js в refresh() вызывает
// quickBus.notify(quickArgs()); диспетчер и updateRegion не тронуты.
import {h,html,useEffect,useState} from './kit.js';
import {esc,disabled} from '../dom.js';
import {paintAll} from './icons.js';
export const quickBus={fns:[],last:undefined,sub(fn){this.fns.push(fn);if(this.last!==undefined)fn(this.last)},notify(deps){this.last=deps;this.fns.forEach(f=>f(deps))}};
const I=name=>`<i data-lucide="${name}"></i>`;
// Чистая разметка (тестируется через preact-render-to-string). deps — вычисленные
// в app.js флаги: masterBlocked, cameraId, media, stationPlaying, playDisabled,
// prevDisabled, nextDisabled, stationRoom, stationTitle.
export function quickMarkup(deps){
 return `<div class="quick-devices">
 <button class="quick-device light-shortcut" data-action="master" ${disabled(deps.masterBlocked)}><span class="quick-device-icon">${I('power')}</span><span><strong>Весь свет</strong><small>Выключить</small></span></button>
 ${deps.cameraId?`<button class="quick-device camera-shortcut" data-camera="${deps.cameraId}" aria-label="Двор: открыть прямой эфир"><span class="quick-device-icon">${I('video')}</span><span><strong>Двор</strong><small>Камера</small></span></button>`:''}
 ${deps.media?`<div class="quick-device media-shortcut">
 <button class="quick-device-icon" data-action="station-play" aria-label="${deps.stationPlaying?'Пауза на станции':'Продолжить на станции'}" ${disabled(deps.playDisabled)}>${I(deps.stationPlaying?'pause':'play')}</button>
 <button class="media-details" data-action="station" aria-label="Станция · ${esc(deps.stationRoom)}: открыть управление"><span class="media-title-line"><strong>Станция</strong>${deps.stationPlaying?'<span class="eq-bars" aria-hidden="true"><i></i><i></i><i></i></span>':''}</span><small title="${esc(deps.stationTitle)}">${esc(deps.stationTitle)}</small></button>
 <div class="station-skip"><button class="icon-button" data-action="station-previous" aria-label="Предыдущий трек" ${disabled(deps.prevDisabled)}>${I('skip-back')}</button>
 <button class="icon-button" data-action="station-next" aria-label="Следующий трек" ${disabled(deps.nextDisabled)}>${I('skip-forward')}</button></div></div>`:''}
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
