// 3.4.0 «Ночная охрана»: чистая логика без DOM и без alarm_control_panel.
// Охрана — производная ночного режима: guardNight 'auto' = активна по расписанию ночи.
import {isNight} from './night.js';
// guardActive: on → всегда охрана, off → никогда, auto → ночное расписание
// (та же математика, что isNight с mode='auto'; мусорные времена → день).
export function guardActive(nowMin,nightStart,nightEnd,guardNight='auto'){
 if(guardNight==='on')return true;
 if(guardNight==='off')return false;
 return isNight(nowMin,nightStart,nightEnd,'auto');
}
// Дверь открыта дольше minutes минут → true; нет данных (нет last_changed) → null;
// ровно N минут → true (граница включительно).
export function doorOpenTooLong(openedLastChangedMs,nowMs,minutes){
 if(!Number.isFinite(openedLastChangedMs)||!Number.isInteger(minutes))return null;
 return nowMs-openedLastChangedMs>=minutes*60000;
}
// Ночные события двора за последние 12 часов. Клипы хранят ms; ночь события
// определяется по ЛОКАЛЬНОМУ времени панели в момент события (new Date(at) →
// часы/минуты), т.е. той же математикой, что isNight для «сейчас». Оценка «ночь ли
// событие» не зависит от того, день или ночь сейчас — только от окна расписания.
export function nightYardEvents(clips,nowMs,nightStart,nightEnd){
 return (Array.isArray(clips)?clips:[]).filter(c=>{
  const at=Number(c?.at);
  if(!Number.isFinite(at))return false;
  const age=nowMs-at;
  if(age<0||age>12*3600000)return false;
  const d=new Date(at);
  return isNight(d.getHours()*60+d.getMinutes(),nightStart,nightEnd,'auto');
 }).length;
}
// Аномальная активность двора: упрощённый порог — 10 и более событий за 24 часа.
// Средние за несколько дней накопятся позже; порог честно упрощён и будет
// пересмотрен по факту реальных данных ленты.
export const YARD_ANOMALY_THRESHOLD=10;
export function yardAnomaly(clips,nowMs=Date.now()){
 const count=(Array.isArray(clips)?clips:[]).filter(c=>{
  const at=Number(c?.at);
  return Number.isFinite(at)&&nowMs-at>=0&&nowMs-at<=24*3600000;
 }).length;
 return count>=YARD_ANOMALY_THRESHOLD;
}