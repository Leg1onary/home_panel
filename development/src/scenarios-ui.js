import {esc} from './dom.js';
import {api} from './api.js';
import {state} from './schema.js';
import {bindingDefinitions,USER_SCENARIO_LIMITS} from './preferences.js';
import {deviceTypes,areaName} from './catalog.js';
import {preferences} from './storage.js';

// Панельные сценарии: батчи команд по проверенным линиям света. Встроенные три —
// реестр на сервере; пользовательские хранятся в preferences.userScenarios и идут
// через тот же POST ha/scenario (id начинается с 'user-'). Состояние фаз держим в
// module-переменных, чтобы pollLive repaint не затирал прогресс и результат.
export const scenarios=[
 {id:'leave',icon:'log-out',label:'Уход'},
 {id:'evening',icon:'moon-star',label:'Вечер'},
 {id:'cinema',icon:'film',label:'Кино'}
];
const {max:MAX_SCENARIOS,maxSteps:MAX_STEPS,minBrightness:MIN_VALUE,maxBrightness:MAX_VALUE}=USER_SCENARIO_LIMITS;
const ui={};
for(const {id} of scenarios)ui[id]={phase:'idle',result:null,error:''};
const entry=id=>ui[id]||(ui[id]={phase:'idle',result:null,error:''});
const isUser=id=>String(id).startsWith('user-');
const userScenarios=()=>state.userScenarios||[];
let painter=()=>{};
export const bindScenarioPainter=fn=>painter=fn;
const paint=()=>painter();
const clearTimers=s=>{clearTimeout(s.confirmTimer);clearTimeout(s.fadeTimer)};
const reset=id=>{const s=ui[id];if(s)clearTimers(s);ui[id]={phase:'idle',result:null,error:''};paint()};

function chip(id,label,icon){
 const s=entry(id);
 let inner;
 if(s.phase==='confirm')inner=`<i data-lucide="triangle-alert"></i><span>Точно выполнить?</span>`;
 else if(s.phase==='run')inner=`<i data-lucide="loader-circle" class="spin"></i><span>${esc(label)}…</span>`;
 else if(s.phase==='done'&&s.result){
  const {confirmed,failed,skipped}=s.result.summary;
  inner=failed?`<i data-lucide="triangle-alert"></i><span>⚠ ${confirmed} из ${confirmed+failed} · ${failed} недоступны</span>`
   :`<i data-lucide="circle-check"></i><span>✓ ${confirmed}${skipped?` · ${skipped} не тронуты`:''}</span>`;
 }else inner=`<i data-lucide="${icon}"></i><span>${esc(label)}</span>`;
 const cls=['scenario-chip',s.phase==='confirm'?'is-confirm':s.phase==='run'?'is-run':s.phase==='done'?(s.result?.summary.failed?'is-failed':'is-ok'):'' ].filter(Boolean).join(' ');
 const details=s.result&&s.result.summary.failed?`<details class="scenario-details"><summary>Что не выполнилось</summary><ul>${s.result.results.map(r=>`<li data-scenario-line="${esc(r.id)}"><strong>${esc(r.name)}</strong><span>${esc(r.status==='confirmed'?'Подтверждено':r.status==='failed'?r.message:'Пропущено · '+r.message)}</span></li>`).join('')}</ul></details>`:'';
 const edit=s.phase==='confirm'&&isUser(id)?`<button type="button" class="scenario-edit-button" data-scenario-edit="${esc(id)}">Изменить</button>`:'';
 return `<div class="scenario-item" data-scenario-item="${esc(id)}"><button type="button" class="${cls}" data-scenario="${esc(id)}" aria-label="Сценарий ${esc(label)}">${inner}</button>${edit}${s.error?`<p class="scenario-error">${esc(s.error)}</p>`:''}${details}</div>`;
}

export function scenarioChipsRow(){
 const items=scenarios.map(({id,icon,label})=>chip(id,label,icon)).join('')
  +userScenarios().map(s=>chip(s.id,s.name,'sparkles')).join('')
  +`<div class="scenario-item"><button type="button" class="scenario-chip scenario-add" data-scenario-new aria-label="Создать свой сценарий"><i data-lucide="sparkles"></i><span>+ Сценарий</span></button></div>`;
 return `<div class="scenario-chips">${items}</div>`;
}

export function scenariosRow(){
 return `<div class="context-heading"><h2>Сценарии</h2><span class="scenario-hint">Батч команд панели · не автоматизации</span></div>${scenarioChipsRow()}`;
}

export async function runScenario(id){
 const s=entry(id);if(s.phase==='run')return;
 clearTimers(s);
 for(const key of Object.keys(ui))if(key!==id&&ui[key].phase==='confirm')reset(key);
 ui[id]={phase:'run',result:null,error:''};paint();
 try{
  const result=await api('ha/scenario',{method:'POST',body:{id}});
  ui[id]={phase:'done',result,error:''};
 }catch(error){ui[id]={phase:'done',result:null,error:error.message}}
 paint();
 ui[id].fadeTimer=setTimeout(()=>reset(id),8000);
}

export function handleScenarioClick(id){
 const s=entry(id);if(s.phase==='run')return;
 if(s.phase==='confirm')return void runScenario(id);
 clearTimers(s);
 ui[id]={phase:'confirm',result:null,error:''};paint();
 ui[id].confirmTimer=setTimeout(()=>reset(id),4000);
}
// Клик мимо открытых подтверждений — отмена всех.
if(typeof document!=='undefined')document.addEventListener('pointerdown',e=>{
 if(e.target.closest?.('[data-scenario-item]'))return;
 for(const [id,s] of Object.entries(ui))if(s.phase==='confirm'){clearTimers(s);ui[id]={phase:'idle',result:null,error:''}}
 paint();
},{passive:true});
// ── Редактор пользовательских сценариев ──────────────────────────────────────
let editor=null;
let host={};
export function bindScenarioHost(h){host=h}
const $=s=>document.querySelector(s);
const I=name=>`<i data-lucide="${name}"></i>`;
const disabled=b=>b?'disabled':'';
const lightLines=()=>bindingDefinitions(state.devices).filter(b=>deviceTypes[b.type].module==='lights'&&deviceTypes[b.type].controllable&&b.device.status==='installed');
const scenarioSheet=()=>{
 const remove=editor.confirmDelete
  ?`<p class="description">Удалить «${esc(editor.name||'')}»? Шаги будут потеряны.</p><div class="sheet-actions"><button class="primary" data-scenario-delete-confirm>Удалить</button><button class="secondary" data-scenario-delete-cancel>Отмена</button></div>`
  :`<div class="sheet-actions"><button class="secondary" data-scenario-delete>Удалить сценарий</button></div>`;
 return `<h2>${editor.id?'Изменить сценарий':'Новый сценарий'}</h2>
 <p class="description">Порядок команд по установленным линиям света. Выполняется только по проверенным привязкам, каждая команда подтверждается состоянием в Home Assistant. Максимум ${MAX_SCENARIOS} сценариев по ${MAX_STEPS} шагов, яркость ${MIN_VALUE}–${MAX_VALUE} %.</p>
 <label class="scenario-field"><span>Название</span><input id="scenario-name" maxlength="30" value="${esc(editor.name)}" placeholder="Например, «Ночь»"></label>
 <div id="scenario-steps"></div>
 <button class="secondary full-width" data-scenario-add-step ${disabled(editor.steps.length>=MAX_STEPS)}>Добавить шаг</button>
 <p id="scenario-editor-error" class="scenario-error">${esc(editor.error||'')}</p>
 <div class="sheet-actions"><button class="primary" data-scenario-save>Сохранить</button><button class="secondary" data-scenario-editor-close>Отмена</button></div>
 ${editor.id?remove:''}`;
};
const stepRow=(st,i)=>`<div class="scenario-step">
 <select data-step-device="${i}" aria-label="Устройство шага ${i+1}">${lightLines().map(b=>`<option value="${esc(b.id)}" ${b.id===st.deviceId?'selected':''}>${esc(areaName(b.device.room))} · ${esc(b.name)}</option>`).join('')}</select>
 <select data-step-action="${i}" aria-label="Действие шага ${i+1}">${[['on','Включить'],['off','Выключить'],['brightness','Яркость']].map(([v,l])=>`<option value="${v}" ${st.action===v?'selected':''}>${l}</option>`).join('')}</select>
 ${st.action==='brightness'?`<input type="range" min="${MIN_VALUE}" max="${MAX_VALUE}" step="1" value="${st.value||70}" data-step-value="${i}" aria-label="Яркость"><span class="scenario-value" data-step-value-label="${i}">${st.value||70} %</span>`:''}
 <span class="scenario-step-order">
 <button type="button" class="icon-button" data-step-up data-step-index="${i}" aria-label="Поднять шаг" ${disabled(i===0)}>${I('chevron-up')}</button>
 <button type="button" class="icon-button" data-step-down data-step-index="${i}" aria-label="Опустить шаг" ${disabled(i===editor.steps.length-1)}>${I('chevron-down')}</button>
 <button type="button" class="icon-button" data-step-remove data-step-index="${i}" aria-label="Удалить шаг">${I('x')}</button></span></div>`;
const renderSteps=()=>{const node=$('#scenario-steps');if(node)node.innerHTML=editor.steps.length?editor.steps.map(stepRow).join(''):'<p class="description">Пока нет шагов.</p>'};
const rerender=()=>{host.openSheet(scenarioSheet());renderSteps();host.icons?.()};
const toastMax=()=>{editor=null;host.toast?.(`Максимум ${MAX_SCENARIOS} сценариев.`)};
export function newScenarioEditor(){
 if(userScenarios().length>=MAX_SCENARIOS)return toastMax();
 const first=lightLines()[0];
 editor={id:null,name:'',steps:first?[{deviceId:first.id,action:'on'}]:[],error:'',confirmDelete:false};
 rerender();
}
export function editScenario(id){
 const s=userScenarios().find(x=>x.id===id);
 if(!s)return;
 editor={id:s.id,name:s.name,steps:s.steps.map(x=>({...x})),error:'',confirmDelete:false};
 rerender();
}
function saveScenario(){
 const name=editor.name.trim();
 editor.error='';
 if(!name)editor.error='Введи название сценария.';
 else if(!editor.steps.length)editor.error='Добавь хотя бы один шаг.';
 else{
  const next=preferences();
  next.userScenarios=next.userScenarios||[];
  const clean=editor.steps.map(st=>st.action==='brightness'
   ?{deviceId:st.deviceId,action:'brightness',value:Math.min(MAX_VALUE,Math.max(MIN_VALUE,Number(st.value)||70))}
   :{deviceId:st.deviceId,action:st.action});
  if(editor.id){
   const i=next.userScenarios.findIndex(s=>s.id===editor.id);
   if(i<0)editor.error='Сценарий уже удалён.';else next.userScenarios[i]={id:editor.id,name,steps:clean};
if(typeof document!=='undefined'){
 document.addEventListener('click',e=>{
  const b=e.target.closest('button');if(!b)return;
  if(b.hasAttribute('data-scenario-new'))return newScenarioEditor();
  if(b.hasAttribute('data-scenario-edit')){const id=b.dataset.scenarioEdit;reset(id);return editScenario(id)}
  if(!editor)return;
  if(b.hasAttribute('data-scenario-add-step')){
   if(editor.steps.length>=MAX_STEPS)return;
   const first=lightLines()[0];
   if(!first){editor.error='Нет установленных линий света.';return rerender()}
   editor.steps.push({deviceId:first.id,action:'on'});return rerender();
  }
  const i=Number(b.dataset.stepIndex);
  if(b.hasAttribute('data-step-remove')&&editor.steps[i]){editor.steps.splice(i,1);return rerender()}
  if(b.hasAttribute('data-step-up')&&i>0){[editor.steps[i-1],editor.steps[i]]=[editor.steps[i],editor.steps[i-1]];return rerender()}
  if(b.hasAttribute('data-step-down')&&i<editor.steps.length-1){[editor.steps[i],editor.steps[i+1]]=[editor.steps[i+1],editor.steps[i]];return rerender()}
  if(b.hasAttribute('data-scenario-save'))return saveScenario();
  if(b.hasAttribute('data-scenario-editor-close')){editor=null;return host.closeSheet?.()}
  if(b.hasAttribute('data-scenario-delete')){editor.confirmDelete=true;return rerender()}
  if(b.hasAttribute('data-scenario-delete-cancel')){editor.confirmDelete=false;return rerender()}
  if(b.hasAttribute('data-scenario-delete-confirm'))return deleteScenario();
 });
 // Поле имени просто копим в черновик; смена действия перерисовывает шаг (нужен слайдер);
 // слайдер яркости обновляет только подпись, чтобы не дёргать фокус при перетаскивании.
 const track=e=>{
  if(!editor)return;
  const t=e.target,i=Number(t.dataset.stepDevice??t.dataset.stepAction??t.dataset.stepValue??NaN);
  if(t.id==='scenario-name')editor.name=t.value;
  else if(t.dataset.stepDevice!==undefined&&editor.steps[i])editor.steps[i].deviceId=t.value;
  else if(t.dataset.stepAction!==undefined&&editor.steps[i]){
   const st=editor.steps[i];st.action=t.value;if(st.action==='brightness'&&!st.value)st.value=70;rerender();
  }else if(t.dataset.stepValue!==undefined&&editor.steps[i]){
   editor.steps[i].value=Number(t.value);
   const label=$(`[data-step-value-label="${i}"]`);if(label)label.textContent=t.value+' % · ещё не сохранено';
  }
 };
 document.addEventListener('input',track);
 document.addEventListener('change',track);
}
  }else if(next.userScenarios.length>=MAX_SCENARIOS)editor.error=`Максимум ${MAX_SCENARIOS} сценариев.`;
  else next.userScenarios.push({id:'user-'+Date.now(),name,steps:clean});
 }
 if(editor.error)return rerender();
 return host.commit(next).then(ok=>{if(ok){editor=null;host.closeSheet?.()}});
}
function deleteScenario(){
 const next=preferences();
 next.userScenarios=(next.userScenarios||[]).filter(s=>s.id!==editor.id);
 return host.commit(next).then(ok=>{if(ok){editor=null;host.closeSheet?.()}});
}
