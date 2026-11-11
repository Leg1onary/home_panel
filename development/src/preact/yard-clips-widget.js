// Лента клипов двора (волна 3.2.1): последние события движения с миниатюрой.
// Данные — GET /api/panel/yard-clips (без байтов), кадры — yard-clip/<id>/<idx>.
// Обновление: yardClipsBus (SSE-событие yard-clip через app.js) и при монтаже.
// Демо/превью: live=false → лента не рендерится, ничего не ломается.
import {h,html,useEffect,useState} from './kit.js';
import {api} from '../api.js';
import {esc,timeOf} from '../dom.js';
export const yardClipsBus={fns:[],last:undefined,sub(fn){this.fns.push(fn);if(this.last!==undefined)fn(this.last)},notify(v){this.last=v;this.fns.forEach(f=>f(v))}};
const CACHE_MS=10000,SHOW_LIMIT=10;
let listCache={at:0,clips:null};
const sourceLabel=s=>s==='onvif'?'Датчик камеры · ONVIF':s==='frames'?'Кадры камеры':'Движение';
const ClipThumb=({id})=>{
 const [url,setUrl]=useState(null);
 useEffect(()=>{
  let alive=true,objectUrl=null;
  api(`yard-clip/${id}/0`,{image:true}).then(blob=>{
   if(!alive)return;objectUrl=URL.createObjectURL(blob);setUrl(objectUrl);
  }).catch(()=>{/* нет кадра — остаётся иконка */});
  return()=>{alive=false;if(objectUrl)URL.revokeObjectURL(objectUrl)};
 },[id]);
 return html`<span class="yard-clip-thumb" aria-hidden="true">${url?html`<img src=${url} alt=""/>`:html`<i data-lucide="video"></i>`}</span>`;
};
export function YardClipsWidget({live}){
 const [clips,setClips]=useState(listCache.clips);
 const load=async force=>{
  if(!live)return;
  const now=Date.now();
  if(!force&&listCache.clips&&now-listCache.at<CACHE_MS)return setClips(listCache.clips);
  try{
   const list=await api('yard-clips?limit=10');
   listCache={at:Date.now(),clips:Array.isArray(list)?list:[]};
   setClips(listCache.clips);
  }catch{/* сервер недоступен — лента просто не обновляется */}
 };
 useEffect(()=>{yardClipsBus.sub(()=>load(true));return()=>{}},[]);
 useEffect(()=>{load(true)},[live]);
 if(!live||!clips)return null;
 if(!clips.length)return html`<section class="yard-clips"><p class="yard-clips-empty">Событий пока нет</p></section>`;
 return html`<section class="yard-clips">
  <div class="section-heading"><div><h2>События двора</h2><p>Клипы по движению: до и после срабатывания</p></div></div>
  <div class="yard-clip-list">${clips.slice(0,SHOW_LIMIT).map(c=>html`
   <button key=${c.id} class="yard-clip-row" data-action="yard-clip" data-clip-id=${c.id}
    data-clip-at=${c.at} data-clip-count=${Math.min(4,c.frameCount||1)} data-clip-source=${esc(c.source||'')}
    aria-label=${'Клип двора, '+timeOf(c.at)}>
    <${ClipThumb} id=${c.id}/>
    <span class="yard-clip-meta"><strong>${timeOf(c.at)}</strong><small>${esc(sourceLabel(c.source))}</small></span>
    <i data-lucide="chevron-right"></i>
   </button>`)}
  </div>
 </section>`;
}
