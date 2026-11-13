import assert from 'node:assert/strict';
import {sanitizeYardCameras,migrateYardCameras,defaultPreferences} from '../src/preferences.js';
import {parseDiscoveryAddrs} from '../server/onvif-discover.js';
import {YardClips} from '../server/yard-clips.js';
import {join,resolve} from 'node:path';

// ─── sanitizeYardCameras ───
assert.deepEqual(sanitizeYardCameras(undefined),[],'нет ключа → пусто');
assert.deepEqual(sanitizeYardCameras(null),[],'null → пусто');
assert.throws(()=>sanitizeYardCameras('мусор'),'не массив → ошибка');
assert.throws(()=>sanitizeYardCameras([{host:'плохой host!'}]),'кривой адрес → ошибка');
const cams=sanitizeYardCameras([
 {host:'192.168.8.204:2020',user:'u1',pass:'p1',name:'Двор'},
 {host:'192.168.8.205',port:2020,user:'u2'},
 {host:'',user:'',name:'черновик'},
 {host:'192.168.8.204',port:2020,user:'u3'},
 {host:'192.168.8.206',user:'u4',enabled:false},
]);
assert.equal(cams.length,3,'дубль host:port отброшен, черновик пропущен');
assert.equal(cams[0].name,'Двор');assert.equal(cams[0].port,2020,'порт из host:port');
assert.equal(cams[1].port,2020,'порт по умолчанию');assert.equal(cams[1].name,'Камера 2','имя по умолчанию');
assert.equal(cams[2].enabled,false,'enabled:false сохранён');
const four=sanitizeYardCameras(Array.from({length:6},(_,i)=>({host:'10.0.0.'+i})));
assert.equal(four.length,4,'максимум 4 камеры');
// ─── migrateYardCameras: легаси → одна камера, ровно один раз ───
const legacy=migrateYardCameras(defaultPreferences(),{yard_onvif_host:'192.168.8.204:2020',yard_onvif_user:'Mytapo_1',yard_onvif_pass:'secret'});
assert.equal(legacy.yardCameras.length,1,'легаси → камера');
assert.deepEqual(legacy.yardCameras[0],{name:'Двор',host:'192.168.8.204',port:2020,user:'Mytapo_1',pass:'secret',enabled:true});
assert.equal(migrateYardCameras(defaultPreferences(),{}).yardCameras.length,0,'без легаси → пусто');
assert.equal(migrateYardCameras(defaultPreferences(),{yardCameras:[],yard_onvif_host:'1.2.3.4'}).yardCameras.length,0,'ключ уже есть → не мигрируем');
// ─── parseDiscoveryAddrs ───
const reply='<XAddrs>http://192.168.8.204:2020/onvif/device_service https://192.168.8.210:884/onvif</XAddrs>';
assert.deepEqual(parseDiscoveryAddrs(reply),[{host:'192.168.8.204',port:2020,url:'http://192.168.8.204:2020/onvif/device_service'},{host:'192.168.8.210',port:884,url:'https://192.168.8.210:884/onvif'}],'XAddrs разобраны');
assert.deepEqual(parseDiscoveryAddrs('мусор'),[],'мусор → пусто');
// ─── YardClips: несколько камер, приоритет событийного снимка ───
const db={exec(){},prepare(){return {run(){return {lastInsertRowid:1}},get(){return null},all(){return []}}}};
const seen=[];
const mkSnap=tag=>({getSnapshot:async()=>{seen.push(tag);return {type:'image/jpeg',bytes:[1,2,3]}}});
const clips=new YardClips({db,getSnaps:()=>[mkSnap('двор'),mkSnap('коридор')]});
const frame=await clips.capture(mkSnap('событие'));
assert.equal(seen[0],'событие','предпочтителен снимочник события');
assert.equal(frame,'AQID','кадр base64');
await clips.capture();await clips.capture();
assert.ok(seen.includes('двор')&&seen.includes('коридор'),'обе камеры попадают в кольцо');
const clips2=new YardClips({db,getSnaps:()=>[]});
await clips2.record({posts:false,snap:mkSnap('событие2'),dedup:false});
assert.equal(seen[seen.length-1],'событие2','кадр события от камеры-источника');
// ─── серверная интеграция: PUT с камерами, статус, защита пароля ───
const {spawn}=await import('node:child_process');
const httpd=await import('node:http');
const fs=await import('node:fs/promises');
const os=await import('node:os');
const pathMod=await import('node:path');
const dir=await fs.mkdtemp(join(await os.tmpdir(),'home-panel-cams-'));
const fake=httpd.createServer((req,res)=>{
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
 let b=await call('bootstrap');proof=b.body.proof;
 assert.deepEqual(b.body.preferences.yardCameras,[],'дефолт: камер нет, паролей нет');
 b.body.preferences.yardCameras=[{name:'Двор',host:'127.0.0.1',port:3043,user:'Mytapo_1',pass:'pass-one',enabled:true}];
 let saved=await call('preferences',{method:'PUT',data:b.body.preferences});
 assert.equal(saved.status,200);
 assert.equal(saved.body.preferences.yardCameras.length,1,'камера сохранена');
 assert.equal(saved.body.preferences.yardCameras[0].pass,'','пароль не возвращается клиенту');
 let s=await call('yard-onvif');
 assert.equal(s.body.configured,true,'watcher запущен по камере');
 assert.equal(s.body.cameras.length,1,'статус по одной камере');
 assert.equal(s.body.cameras[0].name,'Двор');
 // Сохранение с ПУСТЫМ паролем не стирает хранящийся.
 b=await call('bootstrap');
 b.body.preferences.yardCameras=[{name:'Двор',host:'127.0.0.1',port:3043,user:'Mytapo_1',pass:'',enabled:true}];
 saved=await call('preferences',{method:'PUT',data:b.body.preferences});
 assert.equal(saved.status,200);
 s=await call('yard-onvif');
 assert.equal(s.body.configured,true,'пустой pass в PUT не стирает учётку');
 // Старый клиент (без ключа yardCameras) тоже не стирает список.
 b=await call('bootstrap');
 const noCams={...b.body.preferences};delete noCams.yardCameras;
 saved=await call('preferences',{method:'PUT',data:noCams});
 s=await call('yard-onvif');
 assert.equal(s.body.configured,true,'старый клиент не трогает камеры');
 // Выключение тумблера: watcher остановлен, cameras пусто, fallback.
 b=await call('bootstrap');
 b.body.preferences.yard_onvif_enabled=false;
 saved=await call('preferences',{method:'PUT',data:b.body.preferences});
 s=await call('yard-onvif');
 assert.equal(s.body.enabled,false);assert.equal(s.body.configured,false);assert.equal(s.body.fallback,true);
 s=await call('health');
 assert.equal(s.body.onvif.enabled,false);assert.equal(Array.isArray(s.body.onvif.cameras),true);
 // Кривой адрес отклоняется целиком.
 b=await call('bootstrap');
 b.body.preferences.yardCameras=[{host:'bad host!',user:'x'}];
 saved=await call('preferences',{method:'PUT',data:b.body.preferences});
 assert.ok([400,500].includes(saved.status),'невалидная камера → ошибка сохранения');
 console.log('yard-cameras: ok');
}finally{
 if(child&&child.exitCode===null){const end=new Promise(r=>child.once('exit',r));child.kill('SIGTERM');await end}
 await new Promise(r=>fake.close(r));await fs.rm(dir,{recursive:true,force:true});
}
