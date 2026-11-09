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
const fmt=n=>new Intl.NumberFormat('ru-RU',{minimumFractionDigits:1,maximumFractionDigits:1}).format(n);
// readings_date из HA ('2026-10-26') → '26.10'; некорректное значение → null.
export const readingsDateOf=value=>{const m=/^(\d{4})-(\d{2})-(\d{2})/.exec(String(value??''));return m?`${m[3]}.${m[2]}`:null};
const deltaRow=(label,value)=>`<p class="energy-delta"><span>${label}</span><strong>${fmt(value)} кВт·ч</strong></p>`;
const FALLBACK='Расход появится после следующей передачи показаний';
const deltaMarkup=extra=>{
 if(!extra||extra.deltas===undefined)return '';
 if(extra.deltas===null)return `<p class="energy-deltas is-faint">${FALLBACK}</p>`;
 const rows=[Number.isFinite(extra.deltas.day)?deltaRow('Сутки',extra.deltas.day):null,Number.isFinite(extra.deltas.week)?deltaRow('Неделя',extra.deltas.week):null].filter(Boolean);
 return rows.length?rows.join(''):`<p class="energy-deltas is-faint">${FALLBACK}</p>`;
};
export function energyCard(entities,now=Date.now(),extra){
 const {reading,consumption}=entities||{},r=meterValue(reading),c=meterValue(consumption);
 if(r===null&&c===null)return '';
 const stale=e=>{const t=Date.parse(e?.last_updated);return !(Number.isFinite(t)&&now-t<6*3600000)};
 const head=e=>meterValue(e)===null?`<strong class="is-faint">нет данных</strong><small class="energy-meta is-stale">Счётчик</small>`:`<strong>${fmt(meterValue(e))} кВт·ч</strong><small class="energy-meta ${stale(e)?'is-stale':''}">Счётчик · обновлено ${timeOf(Date.parse(e.last_updated))}</small>`;
 const dateLine=readingsDateOf(extra?.readingsDate);
 const consumptionRow=c===null?'':`<p class="energy-consumption"><span>Потребление</span><strong>${fmt(c)+' кВт·ч'}</strong></p>`;
 return `<section class="digest-card energy-card"><h3><i data-lucide="zap"></i>Электроэнергия<button class="energy-reload" data-energy-reload title="Обновить расход" aria-label="Обновить расход"><i data-lucide="rotate-ccw"></i></button></h3><p class="energy-reading">${head(reading)}${dateLine?`<small class="energy-meta">Дата показаний: ${esc(dateLine)}</small>`:''}</p>${consumptionRow}<div class="energy-deltas">${deltaMarkup(extra)}</div></section>`;
}
