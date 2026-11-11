// 3.3.14: компактная карточка станции в правой колонке главной. Плеер вынесен
// из quick-рельсы (кнопки 52×52 расплющивали подпись «Станция»): название трека,
// play/pause и skip через существующие data-action диспетчера app.js.
// Данные — мини-шина stationBus: app.js в refresh() вызывает
// stationBus.notify(stationArgs()); разметка тестируется через render-to-string.
import {h,html,useEffect,useState} from './kit.js';
import {esc,disabled} from '../dom.js';
import {paintAll} from './icons.js';
export const stationBus={fns:[],last:undefined,sub(fn){this.fns.push(fn);if(this.last!==undefined)fn(this.last)},notify(deps){this.last=deps;this.fns.forEach(f=>f(deps))}};
const I=name=>`<i data-lucide="${name}"></i>`;
// deps: playing, title, room, demo, playDisabled, prevDisabled, nextDisabled.
export function stationMarkup(deps){
 return `<section class="station-card station-compact"><div class="station-top"><span class="eyebrow">Станция · ${esc(deps.room)}${deps.demo?' · демо':''}</span>${deps.playing?'<span class="eq-bars" aria-hidden="true"><i></i><i></i><i></i></span>':I('audio-lines')}</div>
 <button class="station-compact-title" data-action="station" title="${esc(deps.title)}"><strong>${esc(deps.title)}</strong></button>
 <div class="station-compact-controls"><button class="icon-button" data-action="station-previous" aria-label="Предыдущий трек" ${disabled(deps.prevDisabled)}>${I('skip-back')}</button>
 <button class="icon-button station-compact-play" data-action="station-play" aria-label="${deps.playing?'Пауза':'Продолжить на станции'}" ${disabled(deps.playDisabled)}>${I(deps.playing?'pause':'play')}</button>
 <button class="icon-button" data-action="station-next" aria-label="Следующий трек" ${disabled(deps.nextDisabled)}>${I('skip-forward')}</button></div></section>`;
}
const paintIcons=paintAll;
export function StationContent({deps}){
 return html`<span class="station-widget-root" dangerouslySetInnerHTML=${{__html:stationMarkup(deps)}}></span>`;
}
export function StationWidget(){
 const [deps,setDeps]=useState(null);
 useEffect(()=>{stationBus.sub(d=>setDeps(d))},[]);
 useEffect(()=>{if(deps)paintIcons()},[deps]);
 return deps?html`<${StationContent} deps=${deps}/>`:null;
}