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
