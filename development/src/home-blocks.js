// 3.4.4: сворачиваемые блоки правой колонки главной (дайджест/энергия/станция).
// Чистые функции: разбор состояния из localStorage ('hp-blocks') и «суть»
// для строки-заголовка. Класс collapsed вешает app.js (applyBlocks()).
import {monthDelta,monthCost} from './energy.js';
export const BLOCK_DEFAULTS={digest:true,energy:false,station:false};
// raw — JSON-строка или null. Мусор/частичный JSON → дефолты; недостающие
// ключи дополняются дефолтами, лишние игнорируются.
export function parseBlocks(raw,defaults=BLOCK_DEFAULTS){
 let saved={};
 try{const v=JSON.parse(raw??'');if(v&&typeof v==='object'&&!Array.isArray(v))saved=v}catch{saved={}}
 const out={};
 for(const key of Object.keys(defaults))out[key]=typeof saved[key]==='boolean'?saved[key]:defaults[key];
 return out;
}
export const serializeBlocks=states=>JSON.stringify({...BLOCK_DEFAULTS,...(states||{})});
// «Суть» в заголовке блока (обновляется в refresh()).
export const digestEssence=count=>`${count} ${count===1?'событие':count%10===1&&count%100!==11&&count%100<10?'событие':count%10>=2&&count%10<=4&&(count%100<10||count%100>=20)?'события':'событий'}`;
// Энергия: последняя закрытая пара показаний — прирост за месяц и стоимость.
export function energyEssence(readings,tariff){
 const valid=(Array.isArray(readings)?readings:[]).filter(r=>r&&/^\d{4}-\d{2}-\d{2}$/.test(r?.date)&&Number.isFinite(r?.value))
  .sort((a,b)=>a.date<b.date?-1:1);
 if(!valid.length)return 'Показаний пока нет';
 const cur=valid[valid.length-1];
 const {delta}=monthDelta(cur.value,cur.date,valid);
 if(!Number.isFinite(delta))return 'Нужны два показания';
 const cost=monthCost(delta,tariff);
 return `Месяц ${delta} кВт·ч${cost!==null?` ≈ ${cost} ₽`:''}`;
}
export function stationEssence(args){
 if(!args)return 'Нет данных';
 const title=String(args.title||'');
 if(args.demo)return title||'Демо';
 if(args.playing)return title.includes('·')?title.split('·')[0].trim():title;
 return title.includes('Тишина')?'Тишина':title||'Тишина';
}