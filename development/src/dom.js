// Shared DOM/escaping/time helpers. Single source of truth for the panel
// timezone so a portable tablet can switch by editing one constant.
export const PANEL_TIMEZONE='Europe/Moscow';
// Full escaping: attributes may contain single quotes and text may contain '>'.
const MAP={'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'};
export const esc=s=>String(s??'').replace(/[&<>"']/g,c=>MAP[c]);
export const disabled=value=>value?'disabled':'';
export const timeOf=t=>new Intl.DateTimeFormat('ru-RU',{hour:'2-digit',minute:'2-digit',timeZone:PANEL_TIMEZONE}).format(t);
export const clock=()=>timeOf(Date.now());
export const date=()=>new Intl.DateTimeFormat('ru-RU',{weekday:'long',day:'numeric',month:'long',timeZone:PANEL_TIMEZONE}).format(new Date());
// Minute-aligned scheduling for the home clock so it never drifts or skips.
export function scheduleMinute(fn){
 const tick=()=>{fn();const d=new Date();setTimeout(tick,1000+(60-(d.getSeconds()*1000+d.getMilliseconds()))%60000)};
 tick();
}
