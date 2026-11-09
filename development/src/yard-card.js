// Честное решение для чипа двора: показываем только при проверенной привязке
// yard-motion и активном движении в пределах 5-минутного окна наблюдения.
// Демо-режим всегда false: демо-кадра камеры нет, показывать выдумку нельзя.
export const YARD_MOTION_TAIL=5*60*1000;
export const YARD_REFRESH_MS=2*60*1000;
export function showYardCard({bindingVerified,motionState,lastEventAt,now,mode}){
 if(mode==='demo')return false;
 if(!bindingVerified)return false;
 if(motionState!=='active')return false;
 if(!Number.isFinite(lastEventAt)||lastEventAt>now+60000)return false;
 return now-lastEventAt<YARD_MOTION_TAIL;
}