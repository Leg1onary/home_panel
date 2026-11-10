import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import http from 'node:http';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';

// Волна A 3.2.0: /api/panel/health + тумблер yard_onvif_enabled.
const dir=await mkdtemp(join(tmpdir(),'home-panel-health-'));
const fake=http.createServer((req,res)=>{
 res.setHeader('Content-Type','application/json');
 if(req.headers.authorization!=='Bearer mock-test-only'){res.writeHead(401);return res.end('{}')}
 if(req.url==='/api/states')return res.end(JSON.stringify([{entity_id:'switch.test_living',state:'on',attributes:{friendly_name:'Test'},last_updated:new Date().toISOString()}]));
 res.writeHead(404);res.end('{}');
});
await new Promise(r=>fake.listen(3033,'127.0.0.1',r));
let child;
await new Promise((resolve_,reject)=>{
 child=spawn(process.execPath,['release/server.mjs'],{cwd:resolve('.'),env:{...process.env,PORT:'3032',PANEL_DATA:dir,HA_URL:'http://127.0.0.1:3033',HA_TOKEN:'mock-test-only',PANEL_PREVIEW:'0'},stdio:['ignore','pipe','pipe']});
 const timer=setTimeout(()=>reject(new Error('Server startup timeout')),10000);
 child.stdout.on('data',b=>{if(String(b).includes('Panel ready')){clearTimeout(timer);resolve_()}});
 child.once('exit',()=>{clearTimeout(timer);reject(new Error('Server exited'))});
});
let proof;
async function call(path,{method='GET',data}={}){
 const r=await fetch('http://127.0.0.1:3032/api/panel/'+path,{method,headers:{'Content-Type':'application/json',...(method==='GET'?{}:{'X-Panel-Proof':proof})},...(data===undefined?{}:{body:JSON.stringify(data)})});
 return {status:r.status,body:await r.json()};
}
try{
 let h=await call('health');
 assert.equal(h.status,200);
 assert.equal(h.body.ha.enabled,true,'HA настроен в тесте');
 assert.equal(h.body.ha.connected,true,'LiveFeed уже опросил fake HA');
 assert.equal(typeof h.body.onvif,'object');assert.equal(h.body.onvif.configured,false,'без creds ONVIF не конфигурирован');
 assert.equal(typeof h.body.sse.clients,'number');
 assert.equal(typeof h.body.disk.sqliteKB,'number');assert.equal(typeof h.body.disk.backups,'number');
 assert.ok(Number.isFinite(h.body.uptime.seconds),'uptime в секундах');
 assert.equal(typeof h.body.version,'string');assert.ok(h.body.version.length>0,'version строка');

 let b=await call('bootstrap');proof=b.body.proof;const p=b.body.preferences;
 assert.equal(p.yard_onvif_enabled,true,'дефолт: включено (обратная совместимость)');
 // Отключаем тумблер: статус должен показать enabled:false и не поднимать watcher.
 p.yard_onvif_enabled=false;p.yard_onvif_user='Mytapo_1';
 let saved=await call('preferences',{method:'PUT',data:p});
 assert.equal(saved.status,200);assert.equal(saved.body.preferences.yard_onvif_enabled,false);
 let s=await call('yard-onvif');
 assert.equal(s.body.enabled,false,'статус показал выключенный тумблер');
 assert.equal(s.body.configured,false,'watcher не запущен при выключенном тумблере');
 assert.equal(s.body.alive,false);assert.equal(s.body.fallback,true,'jpeg-диффер остаётся резервом');
 s=await call('health');assert.equal(s.body.onvif.enabled,false);assert.equal(s.body.onvif.fallback,true);
 // Включаем обратно: configured возвращается (creds заданы).
 saved.body.preferences.yard_onvif_enabled=true;
 saved=await call('preferences',{method:'PUT',data:saved.body.preferences});
 assert.equal(saved.status,200);assert.equal(saved.body.preferences.yard_onvif_enabled,true);
 s=await call('yard-onvif');
 assert.equal(s.body.enabled,true);assert.equal(s.body.configured,true,'после включения watcher снова конфигурируется');
 s=await call('health');assert.equal(s.body.onvif.enabled,true);
 console.log('PASS: health endpoint fields, ha connected via fake HA, yard_onvif_enabled default on, off stops watcher, on reconfigures.');
}finally{
 if(child&&child.exitCode===null){const end=new Promise(r=>child.once('exit',r));child.kill('SIGTERM');await end}
 await new Promise(r=>fake.close(r));await rm(dir,{recursive:true,force:true});
}