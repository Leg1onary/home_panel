import {esc} from './dom.js';
import {api} from './api.js';

// Панельные сценарии: батчи команд по проверенным линиям света. Состояние держим
// в module-переменных, чтобы pollLive repaint не затирал прогресс и результат.
export const scenarios=[
 {id:'leave',icon:'log-out',label:'Уход'},
 {id:'evening',icon:'moon-star',label:'Вечер'},
 {id:'cinema',icon:'film',label:'Кино'}
];
const ui={};
for(const {id} of scenarios)ui[id]={phase:'idle',result:null,error:''};
let painter=()=>{};
export const bindScenarioPainter=fn=>painter=fn;
const paint=()=>painter();
const clearTimers=id=>{clearTimeout(ui[id].confirmTimer);clearTimeout(ui[id].fadeTimer)};
const reset=id=>{clearTimers(id);ui[id]={phase:'idle',result:null,error:''};paint()};

export function scenariosRow(){
 const items=scenarios.map(({id,icon,label})=>{
  const s=ui[id];
  let chip;
  if(s.phase==='confirm')chip=`<i data-lucide="triangle-alert"></i><span>Точно выполнить?</span>`;
  else if(s.phase==='run')chip=`<i data-lucide="loader-circle" class="spin"></i><span>${esc(label)}…</span>`;
  else if(s.phase==='done'&&s.result){
   const {confirmed,failed,skipped}=s.result.summary;
   chip=failed?`<i data-lucide="triangle-alert"></i><span>⚠ ${confirmed} из ${confirmed+failed} · ${failed} недоступны</span>`
    :`<i data-lucide="circle-check"></i><span>✓ ${confirmed}${skipped?` · ${skipped} не тронуты`:''}</span>`;
  }else chip=`<i data-lucide="${icon}"></i><span>${esc(label)}</span>`;
  const cls=['scenario-chip',s.phase==='confirm'?'is-confirm':s.phase==='run'?'is-run':s.phase==='done'?(s.result?.summary.failed?'is-failed':'is-ok'):'' ].filter(Boolean).join(' ');
  const lines=s.result?.results.filter(r=>r.status!=='confirmed')||[];
  const details=s.result&&s.result.summary.failed?`<details class="scenario-details"><summary>Что не выполнилось</summary><ul>${s.result.results.map(r=>`<li data-scenario-line="${esc(r.id)}"><strong>${esc(r.name)}</strong><span>${esc(r.status==='confirmed'?'Подтверждено':r.status==='failed'?r.message:'Пропущено · '+r.message)}</span></li>`).join('')}</ul></details>`:'';
  return `<div class="scenario-item" data-scenario-item="${id}"><button type="button" class="${cls}" data-scenario="${id}" aria-label="Сценарий ${esc(label)}">${chip}</button>${s.error?`<p class="scenario-error">${esc(s.error)}</p>`:''}${details}</div>`;
 }).join('');
 return `<div class="context-heading"><h2>Сценарии</h2><span class="scenario-hint">Батч команд панели · не автоматизации</span></div><div class="scenario-chips">${items}</div>`;
}

export async function runScenario(id){
 const s=ui[id];if(!s||s.phase==='run')return;
 clearTimers(id);
 for(const other of scenarios)if(other.id!==id&&ui[other.id].phase==='confirm')reset(other.id);
 ui[id]={phase:'run',result:null,error:''};paint();
 try{
  const result=await api('ha/scenario',{method:'POST',body:{id}});
  ui[id]={phase:'done',result,error:''};
 }catch(error){ui[id]={phase:'done',result:null,error:error.message}}
 paint();
 ui[id].fadeTimer=setTimeout(()=>reset(id),8000);
}

export function handleScenarioClick(id){
 const s=ui[id];if(!s||s.phase==='run')return;
 if(s.phase==='confirm')return void runScenario(id);
 clearTimers(id);
 ui[id]={phase:'confirm',result:null,error:''};paint();
 ui[id].confirmTimer=setTimeout(()=>reset(id),4000);
}
// Клик мимо открытого подтверждения — отмена.
if(typeof document!=='undefined')document.addEventListener('pointerdown',e=>{
 for(const {id} of scenarios)if(ui[id].phase==='confirm'&&!e.target.closest?.('[data-scenario-item]'))clearTimeout(ui[id].confirmTimer),ui[id]={phase:'idle',result:null,error:''},paint();
},{passive:true});
