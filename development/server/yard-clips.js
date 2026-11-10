// Кольцевой буфер снимков двора → клипы по событиям движения (волна 3.2.1).
// Механизм кадров тот же, что у панельного детектора: ha.requestRaw('/api/camera_proxy/…').
// Низкочастотный фон: каждые TICK_MS кадр в кольцо последних RING (pre-event кадры).
// Событие (ONVIF или jpeg-диффер — общий путь через index.js) → клип: pre-кадры из
// кольца + пост-кадры через POST_DELAYS. Хранение — SQLite, ретеншен KEEP последних.
// Ошибки камеры/HA — тихий пропуск тика, без спама в лог.
import jpeg from 'jpeg-js';
const RING=3,TICK_MS=8000,DEDUP_MS=15000,POST_DELAYS=[3000,9000],KEEP=30;
const BLANK=jpeg.encode({data:Buffer.alloc(4,255),width:1,height:1},80).data.toString('base64');
export {RING as YARD_CLIPS_RING,TICK_MS as YARD_CLIPS_TICK_MS,DEDUP_MS as YARD_CLIPS_DEDUP_MS,KEEP as YARD_CLIPS_KEEP};
export class YardClips{
 constructor({ha,db,notify=null,getEntityId=()=>null}={}){
  this.ha=ha;this.notify=notify;this.getEntityId=getEntityId;
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
 async capture(){
  const entityId=this.getEntityId();
  if(!entityId||!this.ha?.enabled)return null;
  let raw=null;
  try{raw=await this.ha.requestRaw('/api/camera_proxy/'+entityId+'?width=320&height=180')}catch{return null}
  if(!raw||raw.type!=='image/jpeg'||!raw.bytes?.length)return null;
  const b64=Buffer.from(raw.bytes).toString('base64');
  this.ring.push(b64);if(this.ring.length>RING)this.ring=this.ring.slice(-RING);
  return b64;
 }
 // Событие движения → клип. Дедуп: <15с от последнего клипа — окно продлевается,
 // новый клип не создаётся. pre-кадры из кольца, пост-кадры через POST_DELAYS.
 async record({at=Date.now(),source='onvif',dedup=true,posts=true}={}){
  if(dedup&&this.lastClipAt&&at-this.lastClipAt<DEDUP_MS){this.lastClipAt=at;return null}
  this.lastClipAt=at;
  const frames=[...this.ring];
  if(!frames.length){const f=await this.capture();if(f)frames.push(f)}
  if(!frames.length)frames.push(BLANK);
  if(posts){
   for(const ms of POST_DELAYS){
    const timer=setTimeout(async()=>{try{const f=await this.capture();if(f)frames.push(f)}catch{}},ms);
    timer.unref?.();
   }
   await new Promise(r=>setTimeout(r,Math.max(...POST_DELAYS)+500));
  }
  const info=this.insert.run(at,source,Buffer.from(JSON.stringify(frames)));
  this.prune.run(KEEP);
  const result={id:Number(info.lastInsertRowid),at,source,frameCount:frames.length};
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
