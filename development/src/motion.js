import {binaryValue} from './sensor-state.js';
export const MOTION_WINDOW=5*60*1000;
export function motionObservation(e,now=Date.now()){
 const value=binaryValue('motion',e?.state);
 if(value===null)return {kind:'unknown',text:'Нет данных',at:null,derived:false};
 // Native binary sensors have an explicit reset; do not expire occupancy.
 if(e.entity_id?.startsWith('binary_sensor.'))return {kind:value?'active':'idle',text:value?'Есть движение':'Нет движения',at:Date.parse(e.last_changed||e.last_updated)||null,derived:false};
 // last_reported may advance on integration polling without a new motion event.
 const at=Date.parse(e.last_updated||e.last_changed);
 if(!Number.isFinite(at)||at>now+60000)return {kind:'unknown',text:'Время события неизвестно',at:null,derived:false};
 if(!value)return {kind:'idle',text:'Нет движения',at,derived:false};
 const active=now-at<MOTION_WINDOW;
 return {kind:active?'active':'expired',text:active?'Есть движение':'Нет новых движений',at,derived:!active,expiresAt:at+MOTION_WINDOW};
}
export function elapsedLabel(at,now=Date.now()){
 if(!Number.isFinite(at))return 'Время неизвестно';
 const minutes=Math.max(0,Math.floor((now-at)/60000));
 if(minutes<1)return 'только что';
 if(minutes<60)return `${minutes} мин назад`;
 if(minutes<1440)return `${Math.floor(minutes/60)} ч назад`;
 return `${Math.floor(minutes/1440)} дн назад`;
}
