// 3.9.5: бытовой таймер на панели (кухня/стирка/полив). Чистая логика без DOM:
// разбор ввода, остаток времени, формат подписи. Состояние живёт в app.js
// (localStorage), истечение обрабатывается диспетчером: TTS «Время вышло!»
// через станцию (если включён голос) + алерт на панели.
export const TIMER_MIN=1,TIMER_MAX=600;
// '10' → 10; '90 с'/'90с' → 1.5 мин; мусор/вне диапазона → null.
export function parseTimerInput(raw){
 const s=String(raw??'').trim().toLowerCase().replace(',', '.');
 if(!s)return null;
 const secMatch=/^(\d{1,4})\s*(?:с|сек|секунд[аы]?|s)$/.exec(s);
 if(secMatch){
  const sec=Number(secMatch[1]);
  if(!Number.isFinite(sec)||sec<10||sec>3600)return null;
  const min=sec/60;
  return min>=TIMER_MIN?min:null;
 }
 const minMatch=/^(\d{1,3})(?:\s*(?:м|мин|минут[а-я]*|m))?$/.exec(s);
 if(!minMatch)return null;
 const min=Number(minMatch[1]);
 if(!Number.isFinite(min)||min<TIMER_MIN||min>TIMER_MAX)return null;
 return min;
}
// Остаток в мс; просроченный/битый таймер → 0.
export function timerLeft(t,now=Date.now()){
 if(!t||!Number.isFinite(t.until))return 0;
 return Math.max(0,t.until-now);
}
export function timerExpired(t,now=Date.now()){
 return timerLeft(t,now)<=0;
}
// '12:05' для длинных, '0:45' короткие тоже мм:сс? Бытовой формат:
// ≥ 1 мин → 'М:СС', < 1 мин → 'СС с'. Битое → null.
export function fmtTimerLeft(ms){
 if(!Number.isFinite(ms)||ms<=0)return null;
 const total=Math.round(ms/1000);
 const m=Math.floor(total/60),s=total%60;
 if(total<60)return `${s} с`;
 return `${m}:${String(s).padStart(2,'0')}`;
}
// Подпись для essence-строки блока: активен → «Осталось 12:05», нет → null.
export function timerEssence(t,now=Date.now()){
 const left=timerLeft(t,now);
 if(left<=0)return null;
 const f=fmtTimerLeft(left);
 return f?`Осталось ${f}`:null;
}
// Фраза для TTS: ≤100 символов (ограничение ha.announce).
export function timerPhrase(t){
 const min=Number(t?.duration);
 if(!Number.isFinite(min)||min<=0)return 'Время вышло!';
 const label=typeof t.label==='string'&&t.label.trim()?` «${t.label.trim().slice(0,40)}»`:'';
 const mins=Number.isInteger(min)?String(min):String(Math.round(min*10)/10).replace('.',',');
 return `Время вышло! Таймер на ${mins} минут${label}`.slice(0,100);
}
