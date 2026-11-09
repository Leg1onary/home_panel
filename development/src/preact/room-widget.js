// Волна 4 миграции 3.0: карточка комнаты на главной (мини-карточка #home-room-card)
// и щиток комнаты (содержимое roomSheet в #sheet-content) на Preact.
// Разметка — прежние miniRoomCard()/roomSheet()/controls()/rgbControls()/toggle()/phaseLine()
// из app.js, перенесены 1:1: классы, data-* (data-device/data-mini/data-room/data-retry/
// data-action/data-color), aria-атрибуты сохранены — клики обрабатывает прежний
// диспетчер app.js (pointerup + dispatchAction), он не тронут.
// Данные — мини-шина roomBus с replay: app.js в paintRoomCard()/updateRoomSheet()
// вызывает roomBus.notify({card, sheet}). Оптимистичный путь света: диспетчер →
// command() → sendCommand(id,value,apply,refresh) → onChange=refresh → paintRoomCard()
// → notify; подтверждённое состояние (c.on=v после ack) прилетает той же дорогой.
// SSE-патчи Home Assistant (live.js applySnapshot → onChange=refresh) идут тем же путём.
import {h,html,useEffect,useState} from './kit.js';
import {esc,disabled,timeOf} from '../dom.js';
import {createIcons,Sofa,DoorOpen,Armchair,BedDouble,Blocks,Bath,Heater,Archive,MoveUpRight,Trees,Droplets,
 X,ArrowUpRight,ArrowRight,ChevronRight,LoaderCircle,CircleCheck,TriangleAlert} from 'lucide';
export const roomBus={fns:[],last:undefined,sub(fn){this.fns.push(fn);if(this.last!==undefined)fn(this.last)},notify(deps){this.last=deps;this.fns.forEach(f=>f(deps))}};
const I=name=>`<i data-lucide="${name}"></i>`;
// phaseLine(): статус команды линии (pending/success/error + повтор).
export function phaseMarkup(phase){
 if(!phase)return '';
 return `<div class="command-status ${phase.phase}" role="status">${I(phase.phase==='pending'?'loader-circle':phase.phase==='success'?'circle-check':'triangle-alert')}
 <span>${esc(phase.message)}${phase.phase==='success'?' · '+timeOf(phase.confirmedAt):''}</span>
 ${phase.phase==='error'?`<button class="retry-button" data-retry="${esc(phase.id)}">Повторить</button>`:''}</div>`;
}
// toggle(): прежняя разметка тоггла линии света. unknown (live, канал не проверен) —
// без role/aria-checked и с пометкой в aria-label.
export function toggleMarkup(row,attrs=''){
 const unknown=row.unknown;
 return `<button ${unknown?'':`role="switch" aria-checked="${row.on}"`} aria-label="${esc(row.name)}${unknown?' · нет подтверждённого состояния':''}" aria-busy="${row.busy}"
 class="toggle" ${attrs} ${disabled(row.blocked)}><span class="toggle-track"></span></button>`;
}
// Мини-карточка комнаты: прежнее тело miniRoomCard() из app.js.
export function roomCardMarkup(deps){
 if(!deps||!deps.room)return '';
 const r=deps.room;
 return `<div role="dialog" aria-label="Карточка комнаты ${esc(r.name)}">
 <div class="mini-head"><span class="mini-icon">${I(r.icon)}</span><strong>${esc(r.name)}</strong><span class="mini-climate">${deps.climate||''}</span><button class="icon-button" data-action="close-room-card" aria-label="Закрыть карточку комнаты">${I('x')}</button></div>
 ${deps.rows.map(row=>`<div class="control-row mini-row"><div><h3>${esc(row.name)}</h3><p>${esc(row.note)}</p></div>${toggleMarkup(row,`data-device="${esc(row.id)}" data-mini="1"`)}</div>${phaseMarkup(row.phase)}`).join('')}
 ${deps.rows.length?'':`<p class="mini-empty">Линий света в этой комнате нет.</p>`}
 <button class="secondary mini-open" data-room="${esc(r.id)}">Открыть комнату ${I('arrow-up-right')}</button></div>`;
}
// rgbControls(): RGB-лампа прихожей — тоггл, слайдер яркости (#brightness), свотчи цвета.
export function rgbMarkup(rgb){
 if(!rgb)return '';
 return `<div class="control-group"><div class="control-row"><div><h3>${esc(rgb.name)}</h3><p>${esc(rgb.note)}</p></div>
 ${toggleMarkup(rgb.toggle,'data-action="rgb"')}</div>${phaseMarkup(rgb.phases.on)}</div>
 ${rgb.powered?`<div class="rgb-control"><label for="brightness">Яркость <span id="brightness-label">${esc(rgb.brightLabel)}</span></label>
 <input id="brightness" type="range" min="1" max="100" value="${rgb.brightness}" ${disabled(rgb.brightBlocked)}/>
 ${phaseMarkup(rgb.phases.bright)}<div class="swatches">${rgb.swatches.map(sw=>
 `<button style="--swatch:${sw.color}" aria-label="${esc(sw.label)} цвет" class="${sw.selected?'selected':''}" data-color="${sw.color}" ${disabled(sw.blocked)}></button>`).join('')}</div>${phaseMarkup(rgb.phases.color)}</div>`:''}`;
}
// controls(): список линий света комнаты — прежнее тело controls(r) из app.js.
export function controlsMarkup(deps){
 return `${deps.rows.map(row=>{
 return `<div class="control-group${row.planned?' is-planned':''}"><div class="control-row"><div><h3>${esc(row.name)}</h3><p>${esc(row.note||'Планируется')}</p></div>
 ${toggleMarkup(row,`data-device="${esc(row.id)}"`)}</div>${phaseMarkup(row.phase)}</div>`;
 }).join('')}${rgbMarkup(deps.rgb)}
 ${!deps.rows.length?'<p class="empty-room-note">Здесь нет линий света. Другие устройства доступны ниже.</p>':''}
 ${deps.corridorUnbound?'<button class="text-button" data-action="corridor-binding">Выбрать сущность света коридора '+I('arrow-right')+'</button>':''}
 ${deps.hallTerrace?'<button class="text-button" data-room="terrace">Свет террасы · отдельная зона '+I('arrow-right')+'</button>':''}`;
}
// Щиток комнаты: прежнее тело roomSheet(r) из app.js (шапка + controls).
export function sheetMarkup(deps){
 if(!deps||!deps.room)return '';
 return `<div class="eyebrow">${esc(deps.room.short)}</div><h2 style="margin-top:12px">${esc(deps.room.name)}</h2><p class="description">${esc(deps.room.description||'Каждая линия управляется отдельно.')}</p>${controlsMarkup(deps)}`;
}
const ROOM_ICONS={Sofa,DoorOpen,Armchair,BedDouble,Blocks,Bath,Heater,Archive,MoveUpRight,Trees,Droplets};
const paintIcons=()=>{
 createIcons({icons:{...ROOM_ICONS,X,ArrowUpRight,ArrowRight,ChevronRight,LoaderCircle,CircleCheck,TriangleAlert},attrs:{'stroke-width':1.6}});
 document.querySelectorAll('svg[data-lucide]').forEach(s=>s.removeAttribute('data-lucide'));
};
// deps = {card: cardDeps|null, sheet: sheetDeps|null}; до первого notify — null → пусто.
export function RoomCardContent({deps}){
 const markup=deps&&roomCardMarkup(deps);
 return markup?html`<span class="room-card-widget-root" dangerouslySetInnerHTML=${{__html:markup}}></span>`:null;
}
export function RoomSheetContent({deps}){
 const markup=deps&&sheetMarkup(deps);
 return markup?html`<span class="room-sheet-widget-root" dangerouslySetInnerHTML=${{__html:markup}}></span>`:null;
}
export function RoomCardWidget(){
 const [deps,setDeps]=useState(null);
 useEffect(()=>roomBus.sub(d=>setDeps(d?.card??null)),[]);
 useEffect(()=>{if(deps&&roomCardMarkup(deps))paintIcons()},[deps]);
 return html`<${RoomCardContent} deps=${deps}/>`;
}
export function RoomSheetWidget(){
 const [deps,setDeps]=useState(null);
 useEffect(()=>roomBus.sub(d=>setDeps(d?.sheet??null)),[]);
 useEffect(()=>{if(deps&&sheetMarkup(deps))paintIcons()},[deps]);
 return html`<${RoomSheetContent} deps=${deps}/>`;
}
