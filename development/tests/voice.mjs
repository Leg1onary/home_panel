import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import http from 'node:http';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import {HomeAssistant} from '../server/ha.js';
import {defaultPreferences} from '../src/preferences.js';
import {migrateHouseProfile} from '../src/house-profile.js';

// --- Серверный уровень: ha.converse с фейковым HA ---
const p=migrateHouseProfile(defaultPreferences());p.mode='live';
const ha=new HomeAssistant({url:'http://qa.invalid',token:'qa'});
let processBody=null;
ha.request=async(path,body)=>{
 if(!path.startsWith('/api/services/conversation/process'))throw new Error('Unexpected URL '+path);
 processBody=structuredClone(body);
 return {response:{speech:{plain:{speech:'Включила свет в гостиной.'}},conversation_id:'qa-1'}};
};
let r=await ha.converse('Включи свет в гостиной');
assert.deepEqual(processBody,{text:'Включи свет в гостиной',language:'ru'});
assert.equal(r.speech,'Включила свет в гостиной.');assert.equal(r.success,true);
// Пустой speech → честная пустая строка.
ha.request=async()=>({response:{speech:{plain:{}}}});
r=await ha.converse('Привет');assert.equal(r.speech,'');assert.equal(r.success,true);
// Валидация.
await assert.rejects(()=>ha.converse(''),/от 1 до 120/);
await assert.rejects(()=>ha.converse('  '),/от 1 до 120/);
await assert.rejects(()=>ha.converse('x'.repeat(121)),/от 1 до 120/);
await assert.rejects(()=>ha.converse(null),/от 1 до 120/);
// Ошибка HA → throw с русским сообщением.
ha.request=async()=>{throw new Error('Нет связи с Home Assistant. Проверь сеть и адрес локального сервера.')};
await assert.rejects(()=>ha.converse('Включи свет'),/Нет связи с Home Assistant/);
// Выключенный HA.
const off=new HomeAssistant({url:'',token:''});
await assert.rejects(()=>off.converse('Включи свет'),/не настроен/);

// --- Интеграционный уровень: реальный сервер + фейковый HA ---
const dir=await mkdtemp(join(tmpdir(),'home-panel-voice-'));
let speechText='Включила свет в гостиной.',processCalls=0,fail=false;
const fake=http.createServer(async(req,res)=>{
 if(req.headers.authorization!=='Bearer mock-test-only'){res.writeHead(401);return res.end('{}')}
 res.setHeader('Content-Type','application/json');
 if(req.url==='/api/services/conversation/process'){
  processCalls++;
  if(fail){res.writeHead(500);return res.end('{}')}
  let raw='';for await(const c of req)raw+=c;
  const body=JSON.parse(raw);
  if(!body.text||body.language!=='ru'){res.writeHead(400);return res.end('{}')}
  return res.end(JSON.stringify(body.text==='молчание'?{response:{speech:{plain:{speech:''}}}}:{response:{speech:{plain:{speech:speechText}},conversation_id:'qa'}}));
 }
 if(req.url==='/api/states')return res.end('[]');
 res.writeHead(404);res.end('{}');
});
await new Promise(r2=>fake.listen(3022,'127.0.0.1',r2));
let child,proof;
async function launch(withHA){
 child=spawn(process.execPath,['release/server.mjs'],{cwd:resolve('.'),env:{...process.env,PORT:'3023',PANEL_DATA:dir,...(withHA?{HA_URL:'http://127.0.0.1:3022',HA_TOKEN:'mock-test-only'}:{})},stdio:['ignore','pipe','pipe']});
 await new Promise((res,rej)=>{
  const timer=setTimeout(()=>rej(new Error('Server startup timeout')),10000);
  child.stdout.on('data',b=>{if(String(b).includes('Panel ready')){clearTimeout(timer);res()}});
  child.once('exit',()=>{clearTimeout(timer);rej(new Error('Server exited'))});
 });
}
async function stop(){if(child&&child.exitCode===null){const end=new Promise(r2=>child.once('exit',r2));child.kill('SIGTERM');await end}}
async function call(path,{method='GET',data,header={}}={}){
 const res=await fetch('http://127.0.0.1:3023/api/panel/'+path,{method,headers:{'Content-Type':'application/json',...(method==='GET'?{}:{'X-Panel-Proof':proof}),...header},...(data===undefined?{}:{body:JSON.stringify(data)})});
 return {status:res.status,body:await res.json()};
}
try{
 // Выключенный HA: честная 400.
 await launch(false);
 proof=(await call('bootstrap')).body.proof;
 let res=await call('ha/converse',{method:'POST',data:{text:'Включи свет'}});
 assert.equal(res.status,400);assert.match(res.body.error,/не настроен/);
 await stop();
 // Настроенный HA.
 await launch(true);
 proof=(await call('bootstrap')).body.proof;
 res=await call('ha/converse',{method:'POST',data:{text:'Включи свет в гостиной'}});
 assert.equal(res.status,200);assert.equal(res.body.speech,speechText);assert.equal(res.body.success,true);
 assert.equal(processCalls,1);
 res=await call('ha/converse',{method:'POST',data:{text:'молчание'}});
 assert.equal(res.status,200);assert.equal(res.body.speech,'');
 res=await call('ha/converse',{method:'POST',data:{text:'x'.repeat(121)}});
 assert.equal(res.status,400);assert.match(res.body.error,/от 1 до 120/);
 res=await call('ha/converse',{method:'POST',data:{text:'Включи свет'},header:{'X-Panel-Proof':'wrong'}});
 assert.equal(res.status,400);assert.equal(res.body.code,'PANEL_PROOF_REQUIRED');
 fail=true;
 res=await call('ha/converse',{method:'POST',data:{text:'Включи свет'}});
 assert.equal(res.status,400);fail=false;
 assert.equal(processCalls,3);
 console.log('voice: ok (converse: process вызов, speech, пустая строка, валидация, proof, выключенный и упавший HA)');
}finally{await stop();await new Promise(r2=>fake.close(r2));await rm(dir,{recursive:true,force:true})}


