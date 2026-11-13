// 3.5.0: раздел «События» — чистая разметка хроники дома (двор/двери/свет/показания/система).
// Группировка по дням («Сегодня», «Вчера», дата), фильтр по типу, клипы двора
// открываются штатным щитком (data-action=yard-clip). DOM здесь не трогаем.
import {esc,timeOf} from './dom.js';
export const EVENT_TYPES={
 yard:{icon:'video',label:'Двор'},
 door:{icon:'door-open',label:'Двери'},
 light:{icon:'lightbulb',label:'Свет'},
 meter:{icon:'zap',label:'Показания'},
 system:{icon:'activity',label:'Система'},
 guard:{icon:'shield',label:'Охрана'}
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
// 3.6.0: аналитика из хроники — свет/двери по дням, двор по часам. Всё честно
// из событий: нет событий за день → ноль, не «подделка».
const DAY_LABEL=d=>`${String(d.getDate()).padStart(2,'0')}.${String(d.getMonth()+1).padStart(2,'0')}`;
export function computeAnalytics(rows,now=Date.now()){
 const valid=(Array.isArray(rows)?rows:[]).filter(r=>r&&Number.isFinite(r.at)&&EVENT_TYPES[r.type]);
 const dayStart=t=>{const d=new Date(t);d.setHours(0,0,0,0);return d.getTime()};
 const days=[];for(let i=13;i>=0;i--){const t=dayStart(now)-i*86400000;days.push({start:t,label:DAY_LABEL(new Date(t))})}
 const inDay=t=>{const k=dayStart(t);return days.findIndex(d=>d.start===k)};
 const lightDays=days.map(d=>({...d,count:0})),doorDays=days.map(d=>({...d,count:0}));
 const lightRooms=new Map(),yardHours=Array.from({length:24},()=>0);
 let lights=0,doors=0,yards=0;
 for(const r of valid){
  const idx=inDay(r.at);if(idx<0)continue;
  if(r.type==='light'){lightDays[idx].count++;lights++;const room=String(r.text||'').split(':')[0].trim();if(room)lightRooms.set(room,(lightRooms.get(room)||0)+1)}
  if(r.type==='door'){doorDays[idx].count++;doors++}
  if(r.type==='yard'){yardHours[new Date(r.at).getHours()]++;yards++}
 }
 const rooms=[...lightRooms.entries()].map(([name,count])=>({name,count})).sort((a,b)=>b.count-a.count).slice(0,5);
 return {lightDays,doorDays,yardHours,rooms,totals:{light:lights,door:doors,yard:yards},since:days[0].start};
}
// Разметка «Активность дома»: три мини-графика на HTML-барах (без библиотек).
const barRow=(bars,max)=>`<div class="activity-bars">${bars.map(b=>`<span class="activity-bar" data-count="${b.count}" title="${esc(b.title)}"><i style="height:${max?Math.round(b.count/max*100):0}%"></i></span>`).join('')}</div>`;
export function activityMarkup(a,now=Date.now()){
 if(!a||!Array.isArray(a.lightDays))return '<p class="description" data-activity-empty>Аналитика появится, когда накопятся события.</p>';
 const maxLight=Math.max(1,...a.lightDays.map(d=>d.count));
 const maxDoor=Math.max(1,...a.doorDays.map(d=>d.count));
 const maxYard=Math.max(1,...a.yardHours);
 const hourLabel=h=>String(h).padStart(2,'0');
 const lightBars=a.lightDays.map(d=>({count:d.count,title:`${d.label}: ${d.count}`}));
 const doorBars=a.doorDays.map(d=>({count:d.count,title:`${d.label}: ${d.count}`}));
 const yardBars=a.yardHours.map((count,h)=>({count,title:`${hourLabel(h)}:00 — ${count}`}));
 return `<div class="activity-grid">
  <div class="activity-item"><h3>Свет · 14 дней <small>${a.totals.light} включений</small></h3>${barRow(lightBars,maxLight)}</div>
  <div class="activity-item"><h3>Двери · 14 дней <small>${a.totals.door} открытий</small></h3>${barRow(doorBars,maxDoor)}</div>
  <div class="activity-item activity-hours"><h3>Двор по часам <small>${a.totals.yard} событий</small></h3>${barRow(yardBars,maxYard)}<div class="activity-hours-axis">${Array.from({length:24},(_,h)=>`<span>${h%6===0?hourLabel(h):''}</span>`).join('')}</div></div>
 </div>${a.rooms.length?`<p class="activity-rooms">${a.rooms.map(r=>`${esc(r.name)} — ${r.count}`).join(' · ')}</p>`:''}`;
}
// 3.7.2: «Свет сегодня» — агрегат из хроники для раздела «Свет».
export function lightTodayMarkup(lightDays,rooms){
 if(!Array.isArray(lightDays)||!lightDays.length)return '';
 const today=lightDays.at(-1);
 const week=lightDays.slice(-7).reduce((s,d)=>s+d.count,0);
 const top=Array.isArray(rooms)?rooms[0]:null;
 const topText=top&&top.count>0?` · чаще всего: ${esc(top.name)} (${top.count})`:'';
 return `<p class="lights-today">💡 Сегодня: <strong>${today.count} включений</strong> · за неделю ${week}${topText}</p>`;
}
export function eventsFilterMarkup(filter,rows,now=Date.now()){
 const valid=(Array.isArray(rows)?rows:[]).filter(r=>r&&EVENT_TYPES[r.type]);
 const counts={all:valid.length};
 for(const r of valid)counts[r.type]=(counts[r.type]||0)+1;
 const chips=[['all','Все'],...Object.entries(EVENT_TYPES).map(([id,m])=>[id,m.label])];
 return `<div class="events-filters">${chips.map(([id,label])=>`<button type="button" class="events-filter${filter===id?' is-active':''}" data-action="events-filter" data-filter="${id}">${esc(label)}${counts[id]?` <small>${counts[id]}</small>`:''}</button>`).join('')}</div>`;
}
