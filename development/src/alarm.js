// Охрана (alarm_control_panel): статус и подтверждаемые команды с PIN-кодом.
// Отделено из app.js (волна 5): блок самодостаточен, общие хелперы — импортом из app.js.
import {esc,disabled} from './dom.js';
import {api} from './api.js';
import {state} from './schema.js';
import {toast,updateRegion,$,I} from './app.js';
let alarmUI={askPin:false,service:'',busy:false,error:''};
export const alarmEntity=()=>Object.values(state.entityStates||{}).find(e=>e.entity_id?.startsWith('alarm_control_panel.'));
const alarmLabels={disarmed:'Снята',armed_away:'Под охраной (вне дома)',armed_home:'Под охраной (дома)',arming:'Ставится…',pending:'Ожидание…',triggered:'ТРЕВОГА'};
export function alarmMarkup(){
 const e=alarmEntity();
 if(!e||!['disarmed','armed_away','armed_home','arming','pending','triggered'].includes(e.state))return '';
 const s=e.state,needsCode=(e.attributes?.code_format||'None')!=='None';
 const btn=(service,label)=>`<button class="secondary" data-alarm-service="${service}" ${disabled(alarmUI.busy)}>${label}</button>`;
 const pin=alarmUI.askPin?`<div class="alarm-pin"><input id="alarm-pin" type="password" inputmode="numeric" maxlength="16" placeholder="PIN-код" aria-label="PIN-код охраны" ${disabled(alarmUI.busy)} autocomplete="off"/><button class="primary" data-alarm-service="${esc(alarmUI.service)}" data-alarm-confirm ${disabled(alarmUI.busy)}>Подтвердить</button><button class="text-button" data-alarm-cancel ${disabled(alarmUI.busy)}>Отмена</button></div>`:'';
 return `<div class="digest-card alarm-card ${s==='triggered'?'is-danger':''}" ${s==='triggered'?'role="alert"':''}><div class="title-line"><h3>${I('shield')}Охрана</h3></div>
 <p class="alarm-status">${esc(alarmLabels[s]||e.state)}</p>
 ${s==='disarmed'?`<div class="alarm-actions">${btn('arm_away','Поставить (вне дома)')}${btn('arm_home','Поставить (дома)')}</div>`:s==='triggered'?'':`<div class="alarm-actions">${btn('disarm','Снять с охраны')}</div>`}
 ${needsCode?pin:''}
 ${alarmUI.error?`<p class="description alarm-error">${esc(alarmUI.error)}</p>`:''}
 <p class="description">${e.attributes?.changed_by?'Изменено: '+esc(e.attributes.changed_by):'Home Assistant · alarm_control_panel'}</p></div>`;
}
export function paintAlarm(){
 const node=$('#home-alarm');if(!node)return;
 const m=alarmMarkup();
 if(m){updateRegion('#home-alarm',m);node.hidden=false}else node.hidden=true;
}
async function alarmCommand(service,code){
 const draft=$('#alarm-pin')?.value||'';
 alarmUI.busy=true;alarmUI.error='';paintAlarm();
 try{
  const r=await api('ha/alarm',{method:'POST',body:{service,code}});
  alarmUI.askPin=false;alarmUI.service='';
  toast(r.message||(r.confirmed?'Охрана: состояние подтверждено.':'Охрана: команда принята, статус не подтверждён.'));
 }catch(error){alarmUI.error=error.message;toast(error.message)}
 finally{
  alarmUI.busy=false;paintAlarm();
  // Ошибка команды не должна стирать введённый PIN: перерисовка пересоздаёт
  // поле ввода, поэтому возвращаем черновик и возвращаем фокус.
  const input=$('#alarm-pin');
  if(input&&alarmUI.askPin&&!input.value&&draft){input.value=draft;input.focus()}
 }
}
// Ветка диспетчера app.js для кнопок охраны (data-alarm-confirm/cancel/service).
export function alarmAction(b){
 if(b.hasAttribute('data-alarm-confirm'))return alarmCommand(b.dataset.alarmService,$('#alarm-pin')?.value||'');
 if(b.hasAttribute('data-alarm-cancel')){alarmUI={...alarmUI,askPin:false,service:'',error:''};paintAlarm();return}
 const needs=(alarmEntity()?.attributes?.code_format||'None')!=='None';
 if(needs&&(!alarmUI.askPin||alarmUI.service!==b.dataset.alarmService)){alarmUI={...alarmUI,askPin:true,service:b.dataset.alarmService,error:''};paintAlarm();$('#alarm-pin')?.focus();return}
 return alarmCommand(b.dataset.alarmService,needs?($('#alarm-pin')?.value||''):'');
}