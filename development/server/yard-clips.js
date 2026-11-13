// Кольцевой буфер снимков двора → клипы по событиям движения (волна 3.2.1).
// Механизм кадров тот же, что у панельного детектора: ha.requestRaw('/api/camera_proxy/…').
// Низкочастотный фон: каждые TICK_MS кадр в кольцо последних RING (pre-event кадры).
// Событие (ONVIF или jpeg-диффер — общий путь через index.js) → клип: pre-кадры из
// кольца + пост-кадры через POST_DELAYS (0/6/12 с — событие «происходит сейчас»,
// разброс минутами бессмыслен). Хранение — SQLite, ретеншен KEEP последних.
// Ошибки камеры/HA — тихий пропуск тика, без спама в лог.
import jpeg from 'jpeg-js';
const RING=3,TICK_MS=8000,DEDUP_MS=15000,POST_DELAYS=[6000,12000],KEEP=30;
const BLANK=jpeg.encode({data:Buffer.alloc(4,255),width:1,height:1},80).data.toString('base64');
export {RING as YARD_CLIPS_RING,TICK_MS as YARD_CLIPS_TICK_MS,DEDUP_MS as YARD_CLIPS_DEDUP_MS,KEEP as YARD_CLIPS_KEEP};
export class YardClips{
 constructor({ha,db,notify=null,getEntityId=()=>null,yardOnvif=null,getSnaps=null}={}){
  this.ha=ha;this.notify=notify;this.getEntityId=getEntityId;
  // yardOnvif — getter () => {getSnapshot}|null (onvifSnapshots из index.js): живой кадр
  // через ONVIF-снимок камеры вместо закешированного camera_proxy (3.3.9).
  this.yardOnvif=yardOnvif;
  // getSnaps (3.4.6, мультикамера): () => массив {getSnapshot} по всем камерам.
  // Кольцо вращается по камерам — pre-кадры могут быть от разных, событийный кадр
  // приоритетен (snap из record).
  this.getSnaps=getSnaps;
  this.ring=[];this.timer=null;this.busy=false;this.lastClipAt=0;
  db.exec('CREATE TABLE IF NOT EXISTS yard_clips (id INTEGER PRIMARY KEY AUTOINCREMENT, at INTEGER NOT NULL, source TEXT NOT NULL, frames BLOB NOT NULL);');
  this.insert=db.prepare('INSERT INTO yard_clips(at,source,frames) VALUES(?,?,?)');
  this.prune=db.prepare('DELETE FROM yard_clips WHERE id NOT IN (SELECT id FROM yard_clips ORDER BY at DESC, id DESC LIMIT ?)');
  this.byId=db.prepare('SELECT * FROM yard_clips WHERE id=?');
  this.recent=db.prepare('SELECT id,at,source,frames FROM yard_clips ORDER BY at DESC, id DESC LIMIT ?');
 }
 start(){
  if(this.timer)return;
  this.timer=setInterval(()=>this.tick(),TICK_MS);this.timer.unref();
 }
 stop(){if(this.timer){clearInterval(this.timer);this.timer=null}}
 async tick(){
  if(this.busy)return;this.busy=true;
  try{await this.capture()}catch{/* тише едешь — камера подхватится на следующем тике */}
  finally{this.busy=false}
 }
 // Один кадр камеры тем же путём, что yard-motion: base64 jpeg или null.
 // preferred — конкретный снимочник (кадр от камеры, вызвавшей событие).
 // Идентичный последнему кадр не останавливает перебор: пробуем следующую камеру.
 async capture(preferred=null){
  const snaps=[];
  if(preferred?.getSnapshot)snaps.push(preferred);
  if(this.getSnaps){try{snaps.push(...(this.getSnaps()||[]).filter(s=>s?.getSnapshot))}catch{}}
  else if(this.yardOnvif?.()){const s=this.yardOnvif();if(s?.getSnapshot)snaps.push(s)}
  let identicalB64=null;
  for(const s of snaps){
   let raw=null;
   try{raw=await s.getSnapshot()}catch{/* следующая камера */}
   if(!raw||raw.type!=='image/jpeg'||!raw.bytes?.length)continue;
   const b64=Buffer.from(raw.bytes).toString('base64');
   if(this.ring.length&&this.ring[this.ring.length-1]===b64){identicalB64=b64;continue}
   this.ring.push(b64);if(this.ring.length>RING)this.ring=this.ring.slice(-RING);
   return b64;
  }
  if(identicalB64)return identicalB64;
  const entityId=this.getEntityId();
  if(!entityId||!this.ha?.enabled)return null;
  try{const raw=await this.ha.requestRaw('/api/camera_proxy/'+entityId+'?width=320&height=180');
   if(!raw||raw.type!=='image/jpeg'||!raw.bytes?.length)return null;
   const b64=Buffer.from(raw.bytes).toString('base64');
   if(this.ring.length&&this.ring[this.ring.length-1]===b64)return b64;
   this.ring.push(b64);if(this.ring.length>RING)this.ring=this.ring.slice(-RING);
   return b64;
  }catch{return null}
 }
 // Событие движения → клип. Дедуп: <15с от последнего клипа — окно продлевается,
 // новый клип не создаётся. pre-кадры из кольца, пост-кадры через POST_DELAYS.
 // snap — снимочник камеры-источника события (3.4.6).
 async record({at=Date.now(),source='onvif',dedup=true,posts=true,snap=null}={}){
  if(dedup&&this.lastClipAt&&at-this.lastClipAt<DEDUP_MS){this.lastClipAt=at;return null}
  this.lastClipAt=at;
  const frames=[...this.ring];
  if(!frames.length){const f=await this.capture(snap);if(f)frames.push(f)}
  if(!frames.length)frames.push(BLANK);
  if(posts){
   for(const ms of POST_DELAYS){
    const timer=setTimeout(async()=>{try{const f=await this.capture(snap);if(f)frames.push(f)}catch{}},ms);
    timer.unref?.();
   }
   await new Promise(r=>setTimeout(r,Math.max(...POST_DELAYS)+500));
  }
  // Дедуп кадров (3.3.9): подряд идущие одинаковые base64-строки схлопываем —
  // в клипе минимум 1, максимум количество РАЗЛИЧНЫХ кадров.
  const unique=[];
  for(const f of frames)if(!unique.length||unique[unique.length-1]!==f)unique.push(f);
  const info=this.insert.run(at,source,Buffer.from(JSON.stringify(unique)));
  this.prune.run(KEEP);
  const result={id:Number(info.lastInsertRowid),at,source,frameCount:unique.length};
  this.notify?.(result);
  return result;
 }
 // Тест-хук: клип сразу, без ожидания пост-кадров; дедуп по флагу.
 testCapture(opts={}){return this.record({posts:false,...opts})}
 list(limit=20){
  const n=Math.min(KEEP,Math.max(1,Number(limit)||20));
  return this.recent.all(n).map(({id,at,source,frames})=>({id,at,source,frameCount:JSON.parse(frames.toString('utf8')).length}));
 }
 frame(id,idx){
  const row=this.byId.get(id);
  if(!row)return null;
  const frames=JSON.parse(row.frames.toString('utf8'));
  if(!Number.isInteger(idx)||idx<0||idx>=frames.length)return null;
  return Buffer.from(frames[idx],'base64');
 }
}
