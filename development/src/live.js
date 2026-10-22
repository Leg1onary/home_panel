import {api} from './api.js';
import {state,rooms,sensors} from './schema.js';
import {bindingDefinitions} from './preferences.js';
import {deviceTypes,findDevice,resolveAction} from './catalog.js';
import {stationSupports} from './station.js';

export const isLive=()=>state.mode==='live';
export function observed(id){
 const b=state.bindings[id];
 return state.liveOnline&&findDevice(state.devices,id)?.status==='installed'&&b?.verified&&b.entityId?state.entityStates[b.entityId]:null;
}
export function canControl(id){
 if(id.startsWith('station:'))return !isLive()?state.stationMode==='demo'&&!state.demoOffline:stationSupports(observed('station'),id.slice(8),id==='station:playing'?!state.stationPlaying:true);
 const {device:d,key,action}=resolveAction(id,state.devices);
 if(!d||d.status!=='installed'||!deviceTypes[d.type].controllable)return false;
 if(d.powerId){
  const c=rooms.flatMap(r=>r.channels).find(c=>c.id===d.powerId);
  if(!c?.on)return false;
 }
 if(!isLive())return !state.demoOffline;
 const e=observed(key);
 if(!e||!['on','off'].includes(e.state))return false;
 if(action==='brightness')return d.type==='rgb'&&(e.attributes.supported_color_modes||[]).some(m=>!['onoff'].includes(m));
 if(action==='color')return d.type==='rgb'&&(e.attributes.supported_color_modes||[]).includes('rgb');
 return action==='on';
}
function applySnapshot(list){
 state.entityStates=Object.fromEntries(list.map(e=>[e.entity_id,e]));
 for(const r of rooms)r.channels.forEach(c=>{
  const e=observed(c.id);c.on=e?.state==='on';
 });
 const rgb=observed('rgb');state.rgbOn=rgb?.state==='on';
 const station=observed('station');state.stationPlaying=station?.state==='playing';
 if(Number.isFinite(station?.attributes.volume_level))state.stationVolume=Math.round(station.attributes.volume_level*100);
 if(Number.isFinite(rgb?.attributes.brightness))state.brightness=Math.round(rgb.attributes.brightness/255*100);
 if(rgb?.attributes.rgb_color?.length===3)state.rgbColor='#'+rgb.attributes.rgb_color.map(n=>n.toString(16).padStart(2,'0')).join('');
 for(const id of ['living','well','attic']){
  const temp=state.devices.find(d=>d.type==='temperature'&&d.room===id&&d.status==='installed');
  const humidity=state.devices.find(d=>d.type==='humidity'&&d.room===id&&d.status==='installed');
  const t=temp?observed(temp.id):null,h=humidity?observed(humidity.id):null;
  const valid=t&&!['unknown','unavailable',''].includes(t.state)&&Number.isFinite(Number(t.state));
  const celsius=valid&&t.attributes.unit_of_measurement==='°C';
  sensors[id]={value:celsius?Number(t.state):0,humidity:h&&!['unknown','unavailable',''].includes(h.state)&&h.attributes.unit_of_measurement==='%'&&Number.isFinite(Number(h.state))?Number(h.state):null,
   receivedAt:t?Date.parse(t.last_reported||t.last_updated)||0:0,quality:celsius?'live':'unavailable'};
 }
}
let timer,busy=false,revision=0;
export async function pollLive(onChange=()=>{}){
 if(!isLive()||busy)return;busy=true;const rev=revision;
 try{
  const result=await api('ha/states');
  if(rev!==revision||!isLive())return;
  state.liveOnline=true;state.liveError='';state.liveUpdatedAt=Date.now();applySnapshot(result.states);
 }catch(error){if(rev===revision){state.liveOnline=false;state.liveError=error.message;applySnapshot([])}}
 finally{busy=false;onChange()}
}
export function startLive(onChange=()=>{}){
 clearInterval(timer);revision++;state.liveOnline=false;state.entityStates={};
 if(isLive()){
  for(const r of rooms)for(const c of r.channels)c.on=false;
  for(const id of Object.keys(sensors))sensors[id]={value:0,humidity:null,receivedAt:0,quality:'unavailable'};
  pollLive(onChange);timer=setInterval(()=>{if(!document.hidden)pollLive(onChange)},5000);
 }else{
  for(const r of rooms)for(const c of r.channels)c.on=!c.planned&&!!c.demoOn;
  for(const id of Object.keys(sensors)){
   const t=state.devices.find(d=>d.type==='temperature'&&d.room===id&&d.status==='installed');
   const h=state.devices.find(d=>d.type==='humidity'&&d.room===id&&d.status==='installed');
   sensors[id]={value:t?.demoValue??0,humidity:h?.demoValue??null,receivedAt:Date.now()-(t?.demoStale?172800000:0),quality:t?.demoValue===undefined?'unavailable':t.demoStale?'stale':'sample'};
  }
 }
}
export async function sendLive(request){
 if(!canControl(request.id))throw new Error('Канал недоступен или не проверен.');
 const result=await api('ha/command',{method:'POST',body:{id:request.id,value:request.value}});
 return {...result,source:'ha'};
}
export async function discover(){return api('ha/states')}
export function readiness(){
 const defs=bindingDefinitions(state.devices).filter(b=>b.type==='light'&&b.device.status==='installed');
 return {total:defs.length,verified:defs.filter(b=>state.bindings[b.id]?.verified).length};
}
