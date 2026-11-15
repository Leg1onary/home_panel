// Кольцевой буфер снимков двора → клипы по событиям движения (волна 3.2.1).
// Механизм кадров тот же, что у панельного детектора: ha.requestRaw('/api/camera_proxy/…').
// Низкочастотный фон: каждые TICK_MS кадр в кольцо последних RING (pre-event кадры).
// Событие (ONVIF или jpeg-диффер — общий путь через index.js) → клип: pre-кадры из
// кольца + пост-кадры через POST_DELAYS (0/6/12 с — событие «происходит сейчас»,
// разброс минутами бессмыслен). Хранение — SQLite, ретеншен KEEP последних.
// Ошибки камеры/HA — тихий пропуск тика, без спама в лог.
import jpeg from 'jpeg-js';
const RING=3,TICK_MS=8000,DEDUP_MS=15000,POST_DELAYS=[6000,12000],KEEP=30;
// 3.9.7: подтверждение ONVIF-события диффом кадров. Камеры Tapo шлют motion
// ложными срабатываниями (ночь/тени/сенсор), а их snapshot-эндпоинт обновляется
// раз в минуты. Клип пишется только если post-кадр реально отличается от pre.
const VERIFY_GRID={w:32,h:18},VERIFY_THRESHOLD=5;
const VERIFY_MIN_PRE_MS=20000; // pre-кадры старше этого — кольцо «протухло», верим событию
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
  this.ring=[];this.timer=null;this.busy=false;this.lastClipAt=0;this.lastRingAt=0;
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
   this.lastRingAt=Date.now();
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
   this.lastRingAt=Date.now();
   return b64;
  }catch{return null}
 }
 // 3.9.7: верификационный кадр — ТОЛЬКО через живой camera_proxy (тот же путь,
 // что у панельного детектора движения). ONVIF-snapshot у Tapo обновляется раз
 // в минуты и для подтверждения бесполезен.
 async captureProxy(){
  const entityId=this.getEntityId();
  if(!entityId||!this.ha?.enabled)return null;
  try{const raw=await this.ha.requestRaw('/api/camera_proxy/'+entityId+'?width=320&height=180');
   if(!raw||raw.type!=='image/jpeg'||!raw.bytes?.length)return null;
   return Buffer.from(raw.bytes).toString('base64');
  }catch{return null}
 }
 // 3.9.7: анти-ложняк. ONVIF motion у Tapo срабатывает на пустом дворе, а
 // snapshot обновляется редко. Если pre-кадры свежие (< VERIFY_MIN_PRE_MS) и
 // post-кадр от них практически не отличается (grid-diff < VERIFY_THRESHOLD) —
 // событие ложное: клип не пишется, хроника не загрязняется, окно дедупа не
 // закрывается (реальное движение через секунду всё равно запишется).
 gridScore(a,b){
  const da=jpeg.decode(Buffer.from(a,'base64'),{useTArray:true}),db=jpeg.decode(Buffer.from(b,'base64'),{useTArray:true});
  const {w:gw,h:gh}=VERIFY_GRID,step=4;
  const grid=(d)=>{const g=new Array(gw*gh).fill(0),cnt=new Array(gw*gh).fill(0);
   for(let y=0;y<d.height;y+=step)for(let x=0;x<d.width;x+=step){
    const i=(y*d.width+x)*4,lum=0.299*d.data[i]+0.587*d.data[i+1]+0.114*d.data[i+2];
    const gx=Math.min(gw-1,Math.floor(x/d.width*gw)),gy=Math.min(gh-1,Math.floor(y/d.height*gh));
    g[gy*gw+gx]+=lum;cnt[gy*gw+gx]++}
   return g.map((v,i)=>cnt[i]?v/cnt[i]:0)};
  const ga=grid(da),gb=grid(db);
  let s=0;for(let i=0;i<ga.length;i++)s+=Math.abs(ga[i]-gb[i]);
  return s/ga.length;
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
  // 3.9.7: анти-ложняк ONVIF — только для полного цикла (posts=true) и источника
  // onvif:*. Верификация по живым кадрам camera_proxy: два кадра с паузой 5 с;
  // если сцена не изменилась (grid-diff < VERIFY_THRESHOLD) — событие пустое:
  // клип не пишется, хроника не загрязняется, дедуп-окно не закрывается.
  // camera_proxy недоступен (нет биндинга/HA) → верим событию, как раньше.
  if(posts&&String(source).startsWith('onvif')){
   const v1=await this.captureProxy();
   if(v1){
    await new Promise(r=>setTimeout(r,5000));
    const v2=await this.captureProxy();
    if(v2){
     let score=NaN;
     try{score=this.gridScore(v1,v2)}catch{/* не декодировали — верим событию */}
     if(Number.isFinite(score)&&score<VERIFY_THRESHOLD){this.lastClipAt=0;return null}
     // Событие подтверждено: свежий живой кадр — первым в клип (snapshot-кадры
     // могут отставать от реальности на минуты).
     frames.unshift(v2);
    }
   }
  }
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
