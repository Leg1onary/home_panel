import {motionObservation,elapsedLabel} from './motion.js';
import {binaryValue} from './sensor-state.js';
export function scenePins(state,now=Date.now()){
 if(state.view!=='home')return [];
 const live=state.mode==='live';
 const read=id=>{
  const d=state.devices.find(d=>d.id===id),b=state.bindings[id];
  if(d?.status!=='installed')return null;
  if(!live)return state.demoOffline?null:{state:d.demoValue,attributes:{},demo:true};
  return state.liveOnline&&b?.verified?state.entityStates[b.entityId]:null;
 };
 const pins=[];
 const temp=read('temperature:living'),humidity=read('humidity:living');
 const fresh=temp&&(temp.demo||now-(Date.parse(temp.last_reported||temp.last_updated)||0)<=1800000);
 if(fresh&&temp.state!==''&&Number.isFinite(Number(temp.state))){
  pins.push({id:'climate',x:450,z:115,kind:'climate',action:'sensor',sensor:'living',label:Number(temp.state).toFixed(1)+'°',detail:temp.demo?'демо':humidity&&Number.isFinite(Number(humidity.state))?Math.round(Number(humidity.state))+'% · гостиная':'Гостиная',priority:2});
 }
 const motion=read('terrace-motion'),m=motionObservation(motion,now);
 if(motion&&!motion.demo&&m.kind!=='unknown')pins.push({id:'motion',x:85,z:405,kind:m.kind==='active'?'motion-active':'motion-idle',action:'motion',motionId:'terrace-motion',label:m.kind==='active'?'Движение':'Терраса',detail:m.kind==='active'?'свежее событие':elapsedLabel(m.at,now),priority:3});
 const door=read('terrace-door'),value=binaryValue('door',door?.state);
 if(value===true)pins.push({id:'door',x:220,z:180,kind:'door-open',action:'terrace-door',label:'Дверь открыта',detail:door.demo?'демо':'на террасу',priority:4});
 if(live)for(const [id,z,label]of [['leak:utility',470,'Котельная'],['leak:bath',585,'Ванная']]){
  if(!state.devices.some(d=>d.id===id&&d.status==='installed'))continue;
  const v=binaryValue('leak',read(id)?.state);
  if(v!==false)pins.push({id,x:320,z,kind:v===true?'leak-alarm':'sensor-offline',action:'leak',leakId:id,label:v===true?'Протечка!':'Нет данных',detail:label,priority:v===true?6:1});
 }
 return pins.sort((a,b)=>b.priority-a.priority);
}
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
export function pinMarkup(p){
 return `<button class="scene-pin ${p.kind}" data-pin="${esc(p.id)}" data-action="${p.action}" ${p.sensor?`data-sensor="${p.sensor}"`:''} ${p.motionId?`data-motion-id="${p.motionId}"`:''} ${p.leakId?`data-leak-id="${p.leakId}"`:''} aria-label="${esc(p.label+' · '+p.detail)}"><span class="pin-label"><strong>${esc(p.label)}</strong><small>${esc(p.detail)}</small></span><i class="pin-anchor"></i></button>`;
}
