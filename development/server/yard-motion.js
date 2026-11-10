// Панельный детектор движения двора: кадр камеры (JPEG) → сетка 32x18
// средней яркости → mean absolute diff с предыдущим кадром.
// Честно и без облака: motion — это факт смены кадра, а не «умное» распознавание.
import jpeg from 'jpeg-js';
const GRID_W=32,GRID_H=18,THROTTLE=3000,DEFAULT_THRESHOLD=6;
export const YARD_GRID={w:GRID_W,h:GRID_H};
export class YardMotion{
 constructor({ha,cameraId=null,threshold=DEFAULT_THRESHOLD}={}){
  this.ha=ha;this.cameraId=cameraId;this.threshold=threshold;
  this.prev=null;this.lastMotionAt=0;this.lastCheck=0;this.cache=null;this.busy=false;
 }
 // Средняя яркость по блокам: data — RGBA-массив декодированного JPEG.
 grid(data,width,height){
  const g=new Float32Array(GRID_W*GRID_H),bw=width/GRID_W,bh=height/GRID_H;
  for(let gy=0;gy<GRID_H;gy++)for(let gx=0;gx<GRID_W;gx++){
   let sum=0,count=0;
   const x0=Math.floor(gx*bw),x1=Math.max(x0+1,Math.min(width,Math.floor((gx+1)*bw))),y0=Math.floor(gy*bh),y1=Math.max(y0+1,Math.min(height,Math.floor((gy+1)*bh)));
   for(let y=y0;y<y1;y++)for(let x=x0;x<x1;x++){const i=(y*width+x)*4;sum+=0.299*data[i]+0.587*data[i+1]+0.114*data[i+2];count++}
   g[gy*GRID_W+gx]=count?sum/count:0;
  }
  return g;
 }
 diff(a,b){let s=0;for(let i=0;i<a.length;i++)s+=Math.abs(a[i]-b[i]);return s/a.length}
 result(available,motion,score){
  return {available,motion,lastMotionAt:this.lastMotionAt||null,score};
 }
 // Событие от внешнего детектора (ONVIF): тот же путь, что и jpeg-дифф —
 // общий lastMotionAt и общий троттлинг через cache, без дублирования логики.
 externalMotion(at=Date.now()){
  this.lastMotionAt=at;
  this.cache={available:true,motion:true,lastMotionAt:at,score:this.cache?.score??0};
  this.lastCheck=Date.now();
 }
 // entityId разрешается на каждый вызов (маршрут тянет его из активного профиля);
 // null/ошибка HA → available:false, без исключений наружу.
 async check(entityId=this.cameraId){
  if(this.busy)return this.cache||this.result(false,false,0);
  const now=Date.now();
  if(this.cache&&now-this.lastCheck<THROTTLE)return this.cache;
  if(!entityId||!this.ha?.enabled)return this.result(false,false,0);
  this.busy=true;
  try{
   if(this.cache&&Date.now()-this.lastCheck<THROTTLE)return this.cache;
   let raw=null;
   try{raw=await this.ha.requestRaw('/api/camera_proxy/'+entityId+'?width=320&height=180')}catch{raw=null}
   if(!raw||raw.type!=='image/jpeg'||!raw.bytes?.length){this.lastCheck=Date.now();return this.cache=this.result(false,false,0)}
   let frame;
   try{frame=jpeg.decode(raw.bytes,{useTArray:true})}catch{this.lastCheck=Date.now();return this.cache=this.result(false,false,0)}
   if(!frame?.data||!(frame.width>0)){this.lastCheck=Date.now();return this.cache=this.result(false,false,0)}
   const g=this.grid(frame.data,frame.width,frame.height);
   const score=this.prev?this.diff(this.prev,g):0;
   this.prev=g;
   const motion=score>this.threshold;
   if(motion)this.lastMotionAt=Date.now();
   this.lastCheck=Date.now();
   return this.cache={available:true,motion,lastMotionAt:this.lastMotionAt||null,score:Math.round(score*10)/10};
  }finally{this.busy=false}
 }
}
export {THROTTLE as YARD_THROTTLE_MS,DEFAULT_THRESHOLD as YARD_DEFAULT_THRESHOLD};
