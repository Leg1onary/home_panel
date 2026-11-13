// 3.5.0: раздел «События» — чистая разметка хроники дома (двор/двери/свет/показания/система).
// Группировка по дням («Сегодня», «Вчера», дата), фильтр по типу, клипы двора
// открываются штатным щитком (data-action=yard-clip). DOM здесь не трогаем.
import {esc,timeOf} from './dom.js';
export const EVENT_TYPES={
 yard:{icon:'video',label:'Двор'},
 door:{icon:'door-open',label:'Двери'},
 light:{icon:'lightbulb',label:'Свет'},
 meter:{icon:'zap',label:'Показания'},
 system:{icon:'activity',label:'Система'}
};
const dayKey=at=>new Date(at).toDateString();
const dayLabel=(at,now=Date.now())=>{
 const today=new Date(now).toDateString(),yest=new Date(now-86400000).toDateString();
 if(dayKey(at)===today)return 'Сегодня';
 if(dayKey(at)===yest)return 'Вчера';
 return new Intl.DateTimeFormat('ru-RU',{day:'numeric',month:'long',timeZone:'Europe/Moscow'}).format(new Date(at));
};
export function eventsListMarkup(rows,now=Date.now()){
 const valid=(Array.isArray(rows)?rows:[]).filter(r=>r&&Number.isFinite(r.at)&&EVENT_TYPES[r.type]);
 if(!valid.length)return '<p class="description" data-events-empty>Событий пока нет — хроника заполнится по мере жизни дома.</p>';
 const groups=[];
 for(const r of valid){
  let g=groups.at(-1);
  if(!g||g.key!==dayKey(r.at)){g={key:dayKey(r.at),label:dayLabel(r.at,now),items:[]};groups.push(g)}
  g.items.push(r);
 }
 return groups.map(g=>`<div class="events-day"><h3>${esc(g.label)}</h3>${g.items.map(r=>{
  const meta=EVENT_TYPES[r.type];
  const clip=r.ref&&r.ref.startsWith('clip:')?Number(r.ref.slice(5)):null;
  const inner=`<span class="event-icon"><i data-lucide="${meta.icon}"></i></span><span class="event-text"><strong>${esc(r.text)}</strong><small>${esc(timeOf(r.at))}</small></span>${clip!==null&&Number.isFinite(clip)?'<i data-lucide="chevron-right"></i>':''}`;
  const row=clip!==null&&Number.isFinite(clip)
   ?`<button type="button" class="event-row is-clickable" data-action="yard-clip" data-clip-id="${clip}" data-clip-at="${r.at}" data-clip-source="onvif">${inner}</button>`
   :`<div class="event-row">${inner}</div>`;
  return row;
 }).join('')}</div>`).join('');
}
export function eventsFilterMarkup(filter,rows,now=Date.now()){
 const valid=(Array.isArray(rows)?rows:[]).filter(r=>r&&EVENT_TYPES[r.type]);
 const counts={all:valid.length};
 for(const r of valid)counts[r.type]=(counts[r.type]||0)+1;
 const chips=[['all','Все'],...Object.entries(EVENT_TYPES).map(([id,m])=>[id,m.label])];
 return `<div class="events-filters">${chips.map(([id,label])=>`<button type="button" class="events-filter${filter===id?' is-active':''}" data-action="events-filter" data-filter="${id}">${esc(label)}${counts[id]?` <small>${counts[id]}</small>`:''}</button>`).join('')}</div>`;
}
