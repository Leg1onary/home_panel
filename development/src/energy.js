// Энергия v1: поиск сущностей счётчика (ТНС-Энерго) и карточка «Электроэнергия».
// Полные entity_id не хардкодятся: sensor.* содержащий schetchik/meter, исключая signal*.
import {esc,timeOf} from './dom.js';
const BAD=['unavailable','unknown',''];
export const findMeterEntities=(states={})=>{
 const list=Object.values(states).filter(e=>typeof e?.entity_id==='string'&&e.entity_id.startsWith('sensor.')&&/schetchik|meter/.test(e.entity_id)&&!/signal/.test(e.entity_id));
 const by=tag=>list.find(e=>e.entity_id.includes('_'+tag))||null;
 return {reading:by('reading'),consumption:by('consumption')};
};
export const meterValue=e=>e&&!BAD.includes(e.state)&&Number.isFinite(Number(e.state))?Number(e.state):null;
const fmt=n=>new Intl.NumberFormat('ru-RU',{maximumFractionDigits:1}).format(n);
export function energyCard(entities,now=Date.now()){
 const {reading,consumption}=entities||{},r=meterValue(reading),c=meterValue(consumption);
 if(r===null&&c===null)return '';
 const stale=e=>{const t=Date.parse(e?.last_updated);return !(Number.isFinite(t)&&now-t<6*3600000)};
 const head=e=>meterValue(e)===null?`<strong class="is-faint">нет данных</strong><small class="energy-meta is-stale">Счётчик</small>`:`<strong>${fmt(meterValue(e))} кВт·ч</strong><small class="energy-meta ${stale(e)?'is-stale':''}">Счётчик · обновлено ${timeOf(Date.parse(e.last_updated))}</small>`;
 return `<section class="digest-card energy-card"><h3><i data-lucide="zap"></i>Электроэнергия</h3><p class="energy-reading">${head(reading)}</p><p class="energy-consumption ${c===null?'is-faint':''}"><span>Потребление</span><strong>${c===null?'нет данных':fmt(c)+' кВт·ч'}</strong></p></section>`;
}