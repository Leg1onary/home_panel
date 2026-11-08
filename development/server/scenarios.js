import {bindingDefinitions} from '../src/preferences.js';
import {deviceTypes} from '../src/catalog.js';

// Панельные сценарии — это батчи команд по уже проверенным линиям света панели.
// Никаких HA-автоматизаций: каждая линия выполняется тем же ha.command() с readback.
const lightLines=p=>{const cached=p.__lightLines||(p.__lightLines=bindingDefinitions(p.devices).filter(b=>deviceTypes[b.type].module==='lights'&&deviceTypes[b.type].controllable&&b.device.status==='installed'));return cached};
const bound=p=>lightLines(p).filter(b=>{const v=p.bindings[b.id];return v?.verified&&v.entityId});
const inRooms=(p,rooms)=>bound(p).filter(b=>rooms.includes(b.device.room));
const skipRest=(p,run)=>lightLines(p).filter(b=>!run.some(r=>r.b===b)).map(b=>({b,message:'Нет проверенной линии или сценарий не трогает эту комнату'}));
// Яркость честно проверяем по сущности: нет подтверждённого режима — просто on.
async function supportsDim(ha,entity){
 try{const e=await ha.request('/api/states/'+entity);
  return ['on','off'].includes(e.state)&&(e.attributes.supported_color_modes||[]).some(m=>m!=='onoff');
 }catch{return false}
}
export const scenarioRegistry={
 leave:{name:'Уход',plan:async(ha,p)=>{
  const run=bound(p).map(b=>({b,request:{id:b.id,value:false},message:'Выключено'}));
  return {run,skip:skipRest(p,run)};
 }},
 evening:{name:'Вечер',plan:async(ha,p)=>{
  const lines=inRooms(p,['living','hall']),run=[];
  for(const b of lines){
   const entity=p.bindings[b.id].entityId;
   if(b.type==='rgb'&&await supportsDim(ha,entity))run.push({b,request:{id:b.id+'/brightness',value:100},message:'Включено · 100 %'});
   else run.push({b,request:{id:b.id,value:true},message:'Включено'});
  }
  return {run,skip:skipRest(p,run)};
 }},
 cinema:{name:'Кино',plan:async(ha,p)=>{
  const living=inRooms(p,['living']),run=[],skip=[];
  for(const b of bound(p).filter(b=>!living.includes(b)))run.push({b,request:{id:b.id,value:false},message:'Выключено'});
  const first=living[0];
  if(first){
   const entity=p.bindings[first.id].entityId;
   if(first.type==='rgb'&&await supportsDim(ha,entity))run.push({b:first,request:{id:first.id+'/brightness',value:30},message:'Приглушённый свет · 30 %'});
   else run.push({b:first,request:{id:first.id,value:true},message:'Яркость не подтверждена · включено полностью'});
  }else skip.push({b:null,message:'В гостиной нет проверенной линии'});
  for(const b of skipRest(p,run))if(b!==first)skip.push(b);
  return {run,skip};
 }}
};
export async function runScenario(id,ha,p){
 const def=scenarioRegistry[String(id||'')];
 if(!def)throw new Error('Неизвестный сценарий.');
 const {run,skip}=await def.plan(ha,p);
 const results=[];let confirmed=0,failed=0;
 for(const {b,request,message} of run){
  try{await ha.command(request,p);confirmed++;results.push({id:b.id,name:b.name,status:'confirmed',message})}
  catch(error){failed++;results.push({id:b.id,name:b.name,status:'failed',message:error.message})}
 }
 for(const {b,message} of skip)results.push({id:b?.id||'',name:b?.name||'Линия света',status:'skipped',message});
 return {id:String(id),name:def.name,results,summary:{total:results.length,confirmed,failed,skipped:results.length-confirmed-failed}};
}
// Пользовательский сценарий: шаги строго по порядку, тот же ha.command() с readback.
// Линия без проверенной привязки — skipped; недоступная сущность — failed только своей строки.
export async function runUserScenario(id,ha,p){
 const key=String(id||''),def=(p.userScenarios||[]).find(s=>s.id===key);
 if(!def)throw new Error('Сценарий не найден.');
 const lines=new Map(bound(p).map(b=>[b.id,b])),run=[],skip=[];
 for(const step of def.steps){
  const b=lines.get(step.deviceId);
  if(!b){skip.push({b:null,message:'Нет проверенной линии света'});continue}
  if(step.action==='brightness'&&!(b.type==='rgb'&&await supportsDim(ha,p.bindings[b.id].entityId))){
   run.push({b,request:{id:b.id,value:true},message:'Яркость не подтверждена · включено полностью'});continue;
  }
  run.push({b,request:step.action==='brightness'?{id:b.id+'/brightness',value:step.value}:{id:b.id,value:step.action==='on'},
   message:step.action==='brightness'?`Яркость ${step.value} %`:step.action==='on'?'Включено':'Выключено'});
 }
 const results=[];let confirmed=0,failed=0;
 for(const {b,request,message} of run){
  try{await ha.command(request,p);confirmed++;results.push({id:b.id,name:b.name,status:'confirmed',message})}
  catch(error){failed++;results.push({id:b.id,name:b.name,status:'failed',message:error.message})}
 }
 for(const {b,message} of skip)results.push({id:b?.id||'',name:b?.name||'Линия света',status:'skipped',message});
 return {id:key,name:def.name,results,summary:{total:results.length,confirmed,failed,skipped:results.length-confirmed-failed}};
}
