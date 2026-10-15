import {state} from './schema.js';
import {isLive,sendLive} from './live.js';

// This transport never contacts a device. Replace it with a verified HA adapter
// whose response resolves only when the requested state is observed.
export class DemoTransport {
 async send(request) {
  const offline=state.demoOffline;
  const fail=state.failNext;
  if(fail)state.failNext=false;
  await new Promise(resolve=>setTimeout(resolve,700));
  if(offline||state.demoOffline)throw new Error('Нет связи · демонстрация');
  if(request.id.startsWith('station:')&&state.stationMode!=='demo')throw new Error('Станция не подключена к панели · демо');
  if(fail)throw new Error('Подтверждение не получено · демонстрация');
  return {id:request.id,value:request.value,confirmedAt:Date.now(),source:'demo'};
 }
}
const transport=new DemoTransport();
export const hasPending=()=>state.batchPending||[...state.commands.values()].some(c=>c.phase==='pending');
export const commandFor=id=>state.commands.get(id);

export async function sendCommand(id,value,apply,onChange=()=>{}) {
 if(commandFor(id)?.phase==='pending')return false;
 const request={id,value,sequence:++state.commandSequence};
 const live=isLive();
 const entry={...request,phase:'pending',startedAt:Date.now(),message:live?'Ожидаем состояние Home Assistant':'Ожидаем подтверждения · демо'};
 state.commands.set(id,entry);
 onChange();
 try {
  const ack=await (live?sendLive(request):transport.send(request));
  // No optimistic mutation: confirmed demo state is applied only after ack.
  apply(ack.value);
  Object.assign(entry,{phase:'success',confirmedAt:ack.confirmedAt,message:live?'Состояние подтверждено Home Assistant':'Подтверждено в деморежиме'});
 } catch(error) {
  Object.assign(entry,{phase:'error',message:error.message});
 }
 state.commandHistory.unshift({...entry,finishedAt:Date.now()});
 state.commandHistory=state.commandHistory.slice(0,12);
 onChange();
 return entry.phase==='success';
}
