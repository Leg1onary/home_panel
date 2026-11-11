import assert from 'node:assert/strict';
import http from 'node:http';
import jpeg from 'jpeg-js';
import Database from 'better-sqlite3';
import {onvifSnapshots} from '../server/yard-onvif.js';
import {YardClips} from '../server/yard-clips.js';

const gray=v=>jpeg.encode({data:Buffer.alloc(320*180*4,v),width:320,height:180},80).data;
const snap=Buffer.from(gray(90)),snap2=Buffer.from(gray(180));
// Итоговые jpeg байты (контракт как у requestRaw: {type:'image/jpeg',bytes}).

// ── Fake ONVIF: media_service → GetSnapshotUri → URI на фейковый snapshot-сервер ──
let mediaCalls=0,snapCalls=0,snapAuths=[],requireBasic=false,altUri=false;
const media=http.createServer((req,res)=>{
 let body='';req.on('data',c=>body+=c);req.on('end',()=>{
  if(req.url==='/onvif/media_service'&&body.includes('GetSnapshotUri')){
   mediaCalls++;
   const uri='http://127.0.0.1:'+(altUri?'8085':'8084')+'/onvif-http/snapshot';
   res.writeHead(200,{'Content-Type':'application/soap+xml; charset=utf-8'});
   return res.end('<s:Envelope xmlns:s="http://www.w3.org/2003/05/soap-envelope" xmlns:tt="t"><s:Body>'
    +'<trt:GetSnapshotUriResponse xmlns:trt="http://www.onvif.org/ver10/media/wsdl">'
    +'<trt:MediaUri><tt:Uri>'+uri+'</tt:Uri></trt:MediaUri></trt:GetSnapshotUriResponse></s:Body></s:Envelope>');
  }
  res.writeHead(404);res.end();
 });
});
const snapper=http.createServer((req,res)=>{
 snapCalls++;snapAuths.push(req.headers.authorization||null);
 if(requireBasic&&req.headers.authorization!=='Basic '+Buffer.from('u:p').toString('base64')){
  res.writeHead(401);return res.end();
 }
 res.setHeader('Content-Type','image/jpeg');
 res.end(snapCalls%2?snap:snap2); // чередуем два разных кадра
});
await new Promise(r=>media.listen(8083,'127.0.0.1',r));
await new Promise(r=>snapper.listen(8084,'127.0.0.1',r));

// ── 1) getSnapshot: URI выдернут, jpeg возвращён, URI кешируется (media вызван 1 раз) ──
const cli=onvifSnapshots({host:'127.0.0.1',port:8083,user:'u',pass:'p'});
let shot=await cli.getSnapshot();
assert.equal(shot.type,'image/jpeg');
assert.ok(shot.bytes[0]===255&&shot.bytes[1]===216,'Кадр — JPEG (SOI)');
assert.equal(mediaCalls,1);
shot=await cli.getSnapshot();
assert.equal(mediaCalls,1,'URI кешируется: второй getSnapshot без GetSnapshotUri');
assert.equal(snapCalls,2);

// ── 2) capture() берёт из ONVIF, camera_proxy НЕ дёргается ──
let proxyCalls=0;
const fakeHa={enabled:true,requestRaw:async()=>{proxyCalls++;return {type:'image/jpeg',bytes:snap}}};
const db=new Database(':memory:');
const clips=new YardClips({ha:fakeHa,db,getEntityId:()=>'camera.mock',yardOnvif:()=>cli});
const c1=await clips.testCapture({at:1000});
assert.equal(c1.frameCount,1);
assert.equal(proxyCalls,0,'ONVIF доступен → camera_proxy не вызывался');

// ── 3) Дедуп кадров: два одинаковых снимка → в клипе 1 кадр ──
const stillHa={enabled:true,requestRaw:async()=>({type:'image/jpeg',bytes:snap})};
const stillCli={getSnapshot:async()=>({type:'image/jpeg',bytes:snap})};
const db2=new Database(':memory:');
const still=new YardClips({ha:stillHa,db:db2,getEntityId:()=>'camera.mock',yardOnvif:()=>stillCli});
const c2=await still.testCapture({at:2000,dedup:false});
assert.equal(c2.frameCount,1,'Два одинаковых кадра → 1 различный кадр в клипе');
assert.equal(still.ring.length,1,'Ring: идентичные кадры не накапливаются');

// ── 4) 401 → повтор с Authorization Basic ──
requireBasic=true;
let got=null,err=null;
try{got=await cli.getSnapshot()}catch(e){err=e}
assert.ok(!err&&got,'401 → basic-ретрай возвращает снимок');
assert.ok(snapAuths.filter(a=>a==='Basic '+Buffer.from('u:p').toString('base64')).length>=1,'Basic заголовок корректный');
requireBasic=false;

// ── 5) Fallback: ONVIF недоступен → camera_proxy ──
const deadCli={getSnapshot:async()=>{throw new Error('connection refused')}};
const db3=new Database(':memory:');
const fb=new YardClips({ha:fakeHa,db:db3,getEntityId:()=>'camera.mock',yardOnvif:()=>deadCli});
const c3=await fb.testCapture({at:3000});
assert.equal(c3.frameCount,1);
assert.equal(proxyCalls,1,'Fallback на camera_proxy сработал');

media.close();snapper.close();
console.log('PASS: yard-snapshot — GetSnapshotUri+GET, кеш URI, ONVIF-первоисточник без camera_proxy, дедуп одинаковых, basic при 401, fallback.');
