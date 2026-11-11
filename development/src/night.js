// Волна C «Ночной режим»: чистая логика вычисления ночи по расписанию.
// Расписание задаётся строками HH:MM и может пересекать полночь (23:00 → 07:00).
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$/;
export function isTime(value){return typeof value==='string'&&TIME_RE.test(value)}
const minutes=value=>{const [h,m]=value.split(':').map(Number);return h*60+m};
// minute — минуты от полуночи (0..1439). start=end считается днём,
// но такая пара отвергается валидацией preferences.
export function isNight(minute,start,end,mode='auto'){
 if(mode==='on')return true;
 if(mode==='off')return false;
 if(!isTime(start)||!isTime(end))return false;
 const s=minutes(start),e=minutes(end);
 if(s===e)return false;
 const cur=((Math.floor(minute)%1440)+1440)%1440;
 return s<e?cur>=s&&cur<e:cur>=s||cur<e;
}
export function nightLabel(minute,start,end,mode){
 return isNight(minute,start,end,mode)?'Сейчас ночь':'Сейчас день';
}
// 3.3.3 «Плавная автояркость»: интенсивность ночного димма 0..1.
// Полная ночь → 1; за 60 минут до nightEnd — линейный спад 1→0 (рассвет);
// первые 60 минут после nightStart — линейный подъём 0→1 (вход без «щёлка»).
// mode 'on' → всегда 1 (полный димм), 'off' → 0.
export function nightDim(minute,start,end,mode='auto'){
 if(mode==='on')return 1;
 if(mode==='off')return 0;
 if(!isTime(start)||!isTime(end))return 0;
 const s=minutes(start),e=minutes(end);
 if(s===e)return 0;
 const cur=((Math.floor(minute)%1440)+1440)%1440;
 if(!isNight(cur,start,end,'auto'))return 0;
 const sinceStart=(cur-s+1440)%1440;          // минут от включения ночи
 const untilEnd=(e-cur+1440)%1440;            // минут до конца ночи
 const ramp=Math.min(1,sinceStart/60,untilEnd/60);
 return Math.max(0,Math.min(1,ramp));
}