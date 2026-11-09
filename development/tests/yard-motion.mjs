import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import http from 'node:http';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import jpeg from 'jpeg-js';
import {YardMotion,YARD_GRID,YARD_THROTTLE_MS,YARD_DEFAULT_THRESHOLD} from '../server/yard-motion.js';

// ── Юнит: сетка и диф яркости ──
const gray=v=>Buffer.alloc(320*180*4,0).map((_,i)=>i%4===3?255:v);
const bright=v=>Buffer.alloc(320*180*4,0).map((_,i)=>i%4===3?255:(i%8<4?v:Math.min(255,v+120)));
const det=grid=>{const d=new YardMotion({ha:{enabled:true}});return d.diff(d.grid(grid,320,180),d.grid(gray(100),320,180))};
assert.equal(YARD_GRID.w,32);assert.equal(YARD_GRID.h,18);
assert.equal(YARD_THROTTLE_MS,3000);assert.equal(YARD_DEFAULT_THRESHOLD,6);
assert.equal(Math.round(det(gray(100))),0,'Одинаковые сетки → diff 0');
assert.equal(Math.round(det(gray(130))),30,'Сдвиг яркости на 30 → diff 30');
assert.ok(det(bright(120))>6,'Полэкрана светлее → порог превышен');

// ── Юнит: детектор на фейковом requestRaw ──
const frame=jpeg.encode({data:gray(100),width:320,height:180},80).data;
const frame2=jpeg.encode({data:bright(120),width:320,height:180},80).data;
let next=frame;
const fakeHa={enabled:true,requestRaw:async()=>({type:'image/jpeg',bytes:Buffer.from(next)})};
const d1=new YardMotion({ha:fakeHa});
let r=await d1.check('camera.mock');
assert.equal(r.available,true);assert.equal(r.motion,false,'Первый кадр — базы для сравнения нет, motion false');
r=await d1.check('camera.mock');
assert.equal(r.motion,false,'Два одинаковых JPEG → motion false');
await new Promise(r=>setTimeout(r,3100));
next=frame2;
r=await d1.check('camera.mock');
assert.equal(r.motion,true,'Разные кадры → motion true');
assert.ok(Number.isFinite(r.lastMotionAt));assert.ok(r.score>6);
assert.ok(r.lastMotionAt<=Date.now());
// Троттлинг: повтор в пределах 3с возвращает кеш (кадр уже другой, но motion остался прежним).
next=frame;
assert.equal((await d1.check('camera.mock')).motion,true,'Второй вызов <3с отдаёт кешированный результат');
// Недоступная камера → available:false без паники.
const d2=new YardMotion({ha:{enabled:true,requestRaw:async()=>null}});
assert.deepEqual({...await d2.check('camera.mock')},{available:false,motion:false,lastMotionAt:null,score:0});
const d3=new YardMotion({ha:{enabled:false}});
assert.equal((await d3.check('camera.mock')).available,false);
const d4=new YardMotion({ha:{enabled:true,requestRaw:async()=>{throw new Error('Нет связи')}}});
assert.equal((await d4.check('camera.mock')).available,false,'Ошибка HA → unavailable, без исключения');
const d5=new YardMotion({ha:{enabled:true}});
assert.equal((await d5.check(null)).available,false,'Нет сущности камеры → unavailable');
// Порог настраиваемый.

// ── Интеграция: release/server.mjs + фейковый HA ──
const dir=await mkdtemp(join(tmpdir(),'yard-motion-test-'));
const entity={entity_id:'camera.mock',state:'idle',attributes:{}};
let cameraJpeg=frame;
const fake=http.createServer(async(req,res)=>{
 if(req.headers.authorization!=='Bearer mock-test-only'){res.writeHead(401);return res.end('{}')}
 if(req.url==='/api/states')return res.end(JSON.stringify([entity]));
 if(req.url?.startsWith('/api/camera_proxy/camera.mock')){res.setHeader('Content-Type','image/jpeg');return res.end(cameraJpeg)}
 res.writeHead(404);res.end('{}');
});
await new Promise(r=>fake.listen(3042,'127.0.0.1',r));
let child;
async function launch(){
 child=spawn(process.execPath,['release/server.mjs'],{cwd:resolve('.'),env:{...process.env,PORT:'3041',PANEL_DATA:dir,HA_URL:'http://127.0.0.1:3042',HA_TOKEN:'mock-test-only',PANEL_PREVIEW:'0'},stdio:['ignore','pipe','pipe']});
 await new Promise((resolve,reject)=>{
  const timer=setTimeout(()=>reject(new Error('Server startup timeout')),10000);
  child.stdout.on('data',b=>{if(String(b).includes('Panel ready')){clearTimeout(timer);resolve()}});
  child.once('exit',()=>{clearTimeout(timer);reject(new Error('Server exited'))});
 });
}
async function stop(){if(child&&!child.killed&&child.exitCode===null){const end=new Promise(r=>child.once('exit',r));child.kill('SIGTERM');await end}}
let proof;
async function call(path,{method='GET',data}={}){
 const r=await fetch('http://127.0.0.1:3041/api/panel/'+path,{method,headers:{'Content-Type':'application/json',...(method==='GET'?{}:{'X-Panel-Proof':proof})},...(data===undefined?{}:{body:JSON.stringify(data)})});
 return {status:r.status,body:await r.json()};
}
try{
 await launch();
 let b=await call('bootstrap');proof=b.body.proof;let p=b.body.preferences;
 // Без биндинга: детектор unavailable — панель честно молчит.
 let y=await call('ha/yard-motion');
 assert.equal(y.status,200);assert.equal(y.body.available,false);
 // Проверенная привязка camera-yard (движение к биндингу yard-motion не сводится).
 p.mode='live';p.bindings['camera-yard']={entityId:'camera.mock',verified:true};
 assert.equal((await call('preferences',{method:'PUT',data:p})).status,200);
 y=await call('ha/yard-motion');
 assert.equal(y.body.available,true);assert.equal(y.body.motion,false,'Одинаковые кадры → движения нет');
 await new Promise(r=>setTimeout(r,3100));
 cameraJpeg=frame2;
 y=await call('ha/yard-motion');
 assert.equal(y.body.motion,true,'Смена кадра → движение');
 assert.ok(y.body.lastMotionAt>0);assert.ok(y.body.score>6);
 const at=y.body.lastMotionAt;
 // Троттлинг детектора: следующий запрос <3с вернёт кеш даже со сменой кадра.
 cameraJpeg=frame;
 y=await call('ha/yard-motion');
 assert.equal(y.body.motion,true);assert.equal(y.body.lastMotionAt,at,'Кеш <3с: lastMotionAt не изменился');
 // После рестарта памяти нет — движения нет, чип честно пуст.
 await stop();await launch();
 b=await call('bootstrap');proof=b.body.proof;
 y=await call('ha/yard-motion');
 assert.equal(y.body.available,true);assert.equal(y.body.motion,false,'После рестарта истории нет в памяти — движения нет');
 console.log('PASS: yard-motion — сетка-диф (0/порог), детектор на requestRaw, endpoint ha/yard-motion, троттлинг 3с, недоступность без паники.');
}finally{
 await stop();
 await new Promise(r=>fake.close(r));
 await rm(dir,{recursive:true,force:true});
}

const d6=new YardMotion({ha:fakeHa,threshold:200});
assert.equal((await d6.check('camera.mock')).motion,false,'Высокий порог гасит движение');
