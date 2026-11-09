// Честное решение для чипа двора: показываем только реальное движение по
// панельному детектору (кадр камеры, без биндинга и без облака) в пределах
// 5-минутного окна наблюдения. Демо-режим всегда false: демо-кадра нет.
export const YARD_MOTION_TAIL=5*60*1000;
export const YARD_REFRESH_MS=2*60*1000;
export function showYardCard({motion,lastMotionAt,now,mode}){
 if(mode==='demo')return false;
 if(!motion)return false;
 if(!Number.isFinite(lastMotionAt)||lastMotionAt>now+60000)return false;
 return now-lastMotionAt<YARD_MOTION_TAIL;
}
