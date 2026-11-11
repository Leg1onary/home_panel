import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import http from 'node:http';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {isNight,nightDim} from '../src/night.js';
import {journal,journalList} from '../server/journal.js';

// ─── 3.3.3 «Плавная автояркость»: nightDim ───
const S='23:00',E='07:00',hm=h=>h*60;
assert.equal(nightDim(hm(12),S,E),0);
assert.equal(nightDim(hm(22)+59,S,E),0);
assert.equal(nightDim(hm(23),S,E),0,'ровно start → 0 (плавный вход)');
assert.equal(nightDim(hm(7),S,E),0,'ровно end → 0');
assert.ok(Math.abs(nightDim(23*60+30,S,E)-0.5)<1e-9);
assert.ok(Math.abs(nightDim(23*60+15,S,E)-0.25)<1e-9);
assert.equal(nightDim(hm(0),S,E),1);
assert.equal(nightDim(hm(3),S,E),1);
assert.equal(nightDim(hm(6),S,E),1,'в 06:00 димм ещё 100%');
assert.ok(Math.abs(nightDim(6*60+30,S,E)-0.5)<1e-9,'за 30 мин до конца → 0.5');
assert.ok(nightDim(6*60+50,S,E)>0&&nightDim(6*60+50,S,E)<0.2,'за 10 мин до конца → почти 0');
assert.ok(nightDim(6*60+59,S,E)>0&&nightDim(6*60+59,S,E)<0.02);
assert.equal(nightDim(hm(1),'01:00','06:00'),0);
assert.ok(Math.abs(nightDim(1*60+30,'01:00','06:00')-0.5)<1e-9);
assert.equal(nightDim(hm(4),'01:00','06:00'),1);
assert.ok(Math.abs(nightDim(5*60+30,'01:00','06:00')-0.5)<1e-9);
assert.equal(nightDim(hm(6),'01:00','06:00'),0);
assert.equal(nightDim(hm(12),S,E,'on'),1);
assert.equal(nightDim(hm(3),S,E,'on'),1);

// ─── Журнал: journal() добавляет, cap 50, новые сверху, уровни ───
journal('тест-первый');
for(let i=0;i<60;i++)journal('тест-'+i,i%10===0?'warn':'info');
const list=journalList();
assert.equal(list.length,50,'кольцевой буфер держит ровно 50');
assert.ok(list[0].text.startsWith('тест-59'),'новые сверху');
assert.ok(list.at(-1).text!=='тест-первый','старые вытеснены');
assert.ok(list.every(e=>Number.isFinite(e.at)));
assert.ok(list.some(e=>e.level==='warn')&&list.some(e=>e.level==='info'),'уровни сохраняются');
assert.ok(list.every(e=>e.level==='warn'||e.level==='info'));
assert.equal(journalList().length,50,'повторный вызов list не мутирует');
assert.equal(nightDim(hm(3),S,E,'off'),0);
assert.equal(nightDim(hm(23),S,E,'off'),0);

// ─── Сервер: health содержит journal, profile-snapshot пишет бэкапы ───
const dir=await mkdtemp(join(tmpdir(),'home-panel-night-health-'));
const fake=http.createServer((req,res)=>{
 res.setHeader('Content-Type','application/json');
 if(req.headers.authorization!=='Bearer mock-test-only'){res.writeHead(401);return res.end('{}')}
 if(req.url==='/api/states')return res.end(JSON.stringify([{entity_id:'switch.test_living',state:'on',attributes:{friendly_name:'Test'},last_updated:new Date().toISOString()}]));
 res.writeHead(404);res.end('{}');
});
await new Promise(r=>fake.listen(3043,'127.0.0.1',r));
let child;
await new Promise((resolve_,reject)=>{
 child=spawn(process.execPath,['release/server.mjs'],{cwd:resolve('.'),env:{...process.env,PORT:'3042',PANEL_DATA:dir,HA_URL:'http://127.0.0.1:3043',HA_TOKEN:'mock-test-only',PANEL_PREVIEW:'0'},stdio:['ignore','pipe','pipe']});
 const timer=setTimeout(()=>reject(new Error('Server startup timeout')),10000);
 child.stdout.on('data',b=>{if(String(b).includes('Panel ready')){clearTimeout(timer);resolve_()}});
 child.once('exit',()=>{clearTimeout(timer);reject(new Error('Server exited'))});
});
let proof;
async function call(path,{method='GET',data}={}){
 const r=await fetch('http://127.0.0.1:3042/api/panel/'+path,{method,headers:{'Content-Type':'application/json',...(method==='GET'?{}:{'X-Panel-Proof':proof})},...(data===undefined?{}:{body:JSON.stringify(data)})});
 return {status:r.status,body:await r.json()};
}
try{
 let h=await call('health');
 assert.equal(h.status,200);
 assert.ok(Array.isArray(h.body.journal),'health отдаёт journal');
 assert.ok(h.body.journal.length>=1,'старт сервера записан в журнал');
 assert.ok(h.body.journal[0].text.includes('запущена'),'новые сверху');
 assert.ok(h.body.journal.every(e=>['at','level','text'].every(k=>k in e)));
 let b=await call('bootstrap');proof=b.body.proof;
 let snap=await call('profile-snapshot',{method:'POST'});
 assert.equal(snap.status,200);assert.equal(snap.body.ok,true);
 assert.ok(Number.isInteger(snap.body.saved)&&snap.body.saved>0,'saved > 0');
 const saved1=snap.body.saved;
 snap=await call('profile-snapshot',{method:'POST'});
 assert.equal(snap.body.ok,true);
 assert.ok(snap.body.saved>saved1,'повторный снимок увеличивает счётчик');
 h=await call('health');
 assert.ok(h.body.journal.some(e=>e.text.includes('снимок')),'снимок отражён в журнале');
 await fake.close();
 await new Promise(r=>setTimeout(r,5300));
 h=await call('health');
 assert.ok(h.body.journal.some(e=>e.level==='warn'&&e.text.includes('Home Assistant')),'ошибка связи HA → warn');
 assert.ok(h.body.journal.length<=50,'retention 50');
 child.kill();await new Promise(r=>child.once('exit',r));
}catch(error){
 child.kill();await new Promise(r=>child.once('exit',r)).catch(()=>{});throw error;
}finally{
 await new Promise(r=>setTimeout(r,400));
 await rm(dir,{recursive:true,force:true}).catch(()=>{});
}
console.log('night-health: nightDim + journal + snapshot — ок');
assert.equal(nightDim(hm(3),'25:00',E),0);
assert.equal(nightDim(hm(3),S,'x'),0);
for(const m of [0,7*60,12*60,22*60+59])assert.equal(nightDim(m,S,E)>0,isNight(m,S,E));
assert.ok(isNight(6*60+30,S,E)&&nightDim(6*60+30,S,E)>0,'за 30 мин до конца ночь ещё идёт');