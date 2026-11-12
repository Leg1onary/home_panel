// 3.3.2: дуга светового дня над hero-часами. Чистая геометрия — экспортируется
// для тестов; разметка собирается здесь же (svg с двумя путями: track + fill).
// Заполнение через stroke-dasharray/dashoffset: трек — полукруг радиуса r
// (длина πr), заполнение «доезжает» слева направо по проценту дня.
const R=50,CX=60,CY=56;
export function dayArcPath(r=R,cx=CX,cy=CY){
 return `M ${cx-r} ${cy} A ${r} ${r} 0 0 1 ${cx+r} ${cy}`;
}
// p — процент 0..100 (мусор и выход за границы зажимаются). Возвращает dasharray
// и dashoffset для stroke, а также длину дуги.
export function arcParams(p,r=R,cx=CX,cy=CY){
 const length=Math.PI*r;
 const share=Math.min(1,Math.max(0,Number.isFinite(+p)?+p/100:0));
 return {path:dayArcPath(r,cx,cy),length,r,cx,cy,
  dasharray:String(length),dashoffset:String(+(length*(1-share)).toFixed(2))};
}
// Разметка дуги: aria — «Светового дня пройдено N %». Вставляется внутрь
// .hero-clock (позиционируется CSS поверх/над цифрами, pointer-events нет).
export function dayArcMarkup(p){
 const a=arcParams(p);
 return `<svg class="day-arc" viewBox="0 0 120 64" aria-hidden="true" focusable="false">
 <defs><linearGradient id="day-arc-gradient" x1="0" y1="1" x2="1" y2="0">
 <stop offset="0" style="stop-color:var(--accent-teal)"/><stop offset="1" style="stop-color:var(--accent)"/>
 </linearGradient></defs>
 <path class="day-arc-track" d="${a.path}"/>
 <path class="day-arc-fill" d="${a.path}" stroke="url(#day-arc-gradient)" style="stroke-dasharray:${a.dasharray};stroke-dashoffset:${a.dashoffset}"/>
 </svg>`;
}
// 3.4.2: процент светового дня — чистая математика (тестится отдельно).
// nowMs внутри окна [dawnMs..duskMs] → 0..100; мусор/вне окна → null.
export function dayProgressParams(nowMs,dawnMs,duskMs){
 if(![nowMs,dawnMs,duskMs].every(Number.isFinite)||duskMs<=dawnMs)return null;
 if(nowMs<dawnMs||nowMs>duskMs)return null;
 return Math.round(Math.min(1,Math.max(0,(nowMs-dawnMs)/(duskMs-dawnMs)))*100);
}
// Запоминание восхода (3.4.2): пока солнце над горизонтом sun.next_dawn HA
// указывает уже на ЗАВТРАШНИЙ рассвет, поэтому начало дня — восход сегодня.
// При переходе below_horizon → above_horizon фиксируем текущее время в
// localStorage ('hp-sunrise-<YYYY-MM-DD>', локальная дата).
export const sunriseKey=nowMs=>{const d=new Date(nowMs);
 return 'hp-sunrise-'+`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`};
export function rememberSunrise(prevState,nextState,nowMs,storage=globalThis.localStorage){
 if(prevState!=='below_horizon'||nextState!=='above_horizon')return false;
 try{storage?.setItem(sunriseKey(nowMs),String(nowMs));return true}catch{return false}
}
export function storedSunrise(nowMs,storage=globalThis.localStorage){
 try{const v=Number(storage?.getItem(sunriseKey(nowMs)));return Number.isFinite(v)&&v>0?v:null}catch{return null}
}
