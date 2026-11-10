import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import http from 'node:http';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import Database from 'better-sqlite3';
import jpeg from 'jpeg-js';
import {YardClips,YARD_CLIPS_RING,YARD_CLIPS_KEEP,YARD_CLIPS_DEDUP_MS} from '../server/yard-clips.js';

// ── Юнит: кольцевой буфер, дедуп, ретеншен на in-memory SQLite ──
assert.equal(YARD_CLIPS_RING,3);assert.equal(YARD_CLIPS_KEEP,30);
assert.equal(YARD_CLIPS_DEDUP_MS,15000);
const gray=v=>jpeg.encode({data:Buffer.alloc(320*180*4,v),width:320,height:180},80).data;
const frameA=gray(90),frameB=gray(180);
let next=frameA;
const fakeHa={enabled:true,requestRaw:async()=>({type:'image/jpeg',bytes:Buffer.from(next)})};
const db=new Database(':memory:');
const clips=new YardClips({ha:fakeHa,db,getEntityId:()=>'camera.mock'});
assert.deepEqual(clips.list(20),[],'Пустая таблица → пустой список');
const c1=await clips.testCapture({at:1000});
assert.ok(c1&&c1.frameCount>=1,'Клип создан, есть кадр');
assert.equal(c1.at,1000);assert.equal(c1.source,'onvif');
assert.deepEqual(clips.list(20).map(c=>[c.id,c.frameCount]),[[c1.id,1]]);
const got=clips.frame(c1.id,0);
assert.ok(got&&got[0]===255&&got[1]===216,'Кадр — корректный JPEG (SOI)');
assert.equal(clips.frame(c1.id,5),null,'Индекс вне диапазона → null');
assert.equal(clips.frame(9999,0),null,'Чужой id → null');
// Дедуп: второе событие <15с — окна продлевается, клипа нет.
assert.equal(await clips.testCapture({at:2000}),null,'Дедуп <15с: клип не создаётся');
// Ретеншен: 40 клипов → хранится не больше KEEP, самые свежие первыми.
for(let i=0;i<40;i++)await clips.testCapture({at:100000+i,dedup:false});
const all=clips.list(30);
assert.ok(all.length<=YARD_CLIPS_KEEP,'Ретеншен: не больше '+YARD_CLIPS_KEEP);
assert.ok(all[0].at>=all[all.length-1].at,'Свежие первыми');

// ── Интеграция: release/server.mjs + фейковый HA + тест-хук ──
const dir=await mkdtemp(join(tmpdir(),'yard-clips-test-'));
const entity={entity_id:'camera.mock',state:'idle',attributes:{}};
const fake=http.createServer(async(req,res)=>{
 if(req.headers.authorization!=='Bearer mock-test-only'){res.writeHead(401);return res.end('{}')}
 if(req.url==='/api/states')return res.end(JSON.stringify([entity]));
 if(req.url?.startsWith('/api/camera_proxy/camera.mock')){res.setHeader('Content-Type','image/jpeg');return res.end(next)}
 res.writeHead(404);res.end('{}');
});
await new Promise(r=>fake.listen(3046,'127.0.0.1',r));
let child;
async function launch(){
 child=spawn(process.execPath,['release/server.mjs'],{cwd:resolve('.'),env:{...process.env,PORT:'3045',PANEL_DATA:dir,HA_URL:'http://127.0.0.1:3046',HA_TOKEN:'mock-test-only',PANEL_PREVIEW:'0',PANEL_TEST_HOOKS:'1'},stdio:['ignore','pipe','pipe']});
 await new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>reject(new Error('Server startup timeout')),10000);
  child.stdout.on('data',b=>{if(String(b).includes('Panel ready')){clearTimeout(timer);resolve()}});
  child.once('exit',()=>{clearTimeout(timer);reject(new Error('Server exited'))});
 });
}
async function stop(){if(child&&!child.killed&&child.exitCode===null){const end=new Promise(r=>child.once('exit',r));child.kill('SIGTERM');await end}}
let proof;
async function call(path,{method='GET',data,raw=false}={}){
 const r=await fetch('http://127.0.0.1:3045/api/panel/'+path,{method,headers:{'Content-Type':'application/json',...(method==='GET'?{}:{'X-Panel-Proof':proof})},...(data===undefined?{}:{body:JSON.stringify(data)})});
 if(raw)return {status:r.status,type:r.headers.get('content-type'),bytes:Buffer.from(await r.arrayBuffer())};
 return {status:r.status,body:await r.json()};
}
try{
 await launch();
 let b=await call('bootstrap');proof=b.body.proof;
 // (a) Таблица создаётся, пусто → 200 и пустой список.
 const empty=await call('yard-clips');
 assert.equal(empty.status,200);assert.deepEqual(empty.body,[]);
 // (b) Тест-хук (testCapture) → клип; список отдаёт запись с кадрами; кадр — image/jpeg.
 const cap=await call('yard-clips-capture',{method:'POST',data:{}});
 assert.equal(cap.status,200);assert.ok(cap.body.frameCount>=1,'Клип создан через тест-хук');
 const list=await call('yard-clips?limit=20');
 assert.equal(list.status,200);assert.equal(list.body.length,1);
 assert.equal(list.body[0].id,cap.body.id);assert.ok(list.body[0].frameCount>=1);
 const img=await call('yard-clip/'+cap.body.id+'/0',{raw:true});
 assert.equal(img.status,200);assert.equal(img.type,'image/jpeg');
 assert.ok(img.bytes[0]===255&&img.bytes[1]===216,'Кадр — JPEG');
 assert.equal((await call('yard-clip/'+cap.body.id+'/3',{raw:true})).status,404,'Индекс за пределами кадра → 404');
 // (c) Ретеншен через хук: 40 клипов → в списке ≤30, свежие первыми.
 for(let i=0;i<40;i++)await call('yard-clips-capture',{method:'POST',data:{dedup:false,at:Date.now()+i}});
 const retained=await call('yard-clips?limit=30');
 assert.ok(retained.body.length<=30,'Ретеншен сервера: ≤30');
 assert.ok(retained.body[0].at>=retained.body[retained.body.length-1].at,'Свежие первыми');
 // (d) Дедуп: два события подряд <15с → один клип (at явно за пределами окна (c)).
 const before=(await call('yard-clips?limit=30')).body.length;
 const first=await call('yard-clips-capture',{method:'POST',data:{at:Date.now()+60000}});
 assert.ok(first.body.id,'Первое событие создаёт клип');
 const second=await call('yard-clips-capture',{method:'POST',data:{at:Date.now()+61000}});
 assert.equal(second.body.created,false,'Второе <15с — продление окна, без клипа');
 const after=await call('yard-clips?limit=30');
 assert.equal(after.body.length,Math.min(30,before+1),'Клип ровно один (с учётом ретеншена)');
 assert.equal(after.body[0].id,first.body.id,'Новый клип — только от первого события');
 console.log('PASS: yard-clips — таблица/пустой список, testCapture → клип + JPEG-кадр, ретеншен ≤30, дедуп <15с.');
}finally{
 await stop();
 await new Promise(r=>fake.close(r));
 await rm(dir,{recursive:true,force:true});
}
