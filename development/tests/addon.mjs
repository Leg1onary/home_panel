import assert from 'node:assert/strict';
import {spawn} from 'node:child_process';
import http from 'node:http';
import {mkdtemp,rm,readFile} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';

const dir=await mkdtemp(join(tmpdir(),'home-panel-addon-'));
const token='fake-supervisor-token-for-tests';
const light={entity_id:'switch.test_living',state:'on',attributes:{friendly_name:'Test light'},last_updated:new Date().toISOString()};
const camera={entity_id:'camera.test_yard',state:'idle',attributes:{access_token:'camera-secret-must-not-leak'}};
const seen=[];let denied=false,child;
const fake=http.createServer(async(req,res)=>{
 seen.push(req.url);
 if(denied||req.headers.authorization!==`Bearer ${token}`){res.writeHead(401);return res.end('{}')}
 if(req.url==='/core/api/camera_proxy/camera.test_yard'){
  res.setHeader('Content-Type','image/webp');return res.end(await readFile('assets/interior.webp'));
 }
 res.setHeader('Content-Type','application/json');
 if(req.url==='/core/api/states')return res.end(JSON.stringify([light,camera]));
 if(req.url==='/core/api/states/switch.test_living')return res.end(JSON.stringify(light));
 if(req.url.startsWith('/core/api/services/switch/')){
  light.state=req.url.endsWith('turn_off')?'off':'on';return res.end('[]');
 }
 res.writeHead(404);res.end('{}');
});
await new Promise(r=>fake.listen(3122,'127.0.0.1',r));
const host='192.168.8.182:8090';
let proof;
async function launch(){
 child=spawn(process.execPath,['startup.mjs'],{
  cwd:resolve('addon/home-panel'),
  env:{...process.env,SUPERVISOR_TOKEN:token,HA_TOKEN:'wrong-token-ignored',HA_URL:'http://127.0.0.1:3122/core',PORT:'3121',PANEL_ROOT:resolve('dist'),PANEL_DATA:dir},
  stdio:['ignore','pipe','inherit']
 });
 await new Promise((resolve,reject)=>{
  const timeout=setTimeout(()=>reject(new Error('Startup timeout')),10000);
  child.stdout.on('data',b=>{if(String(b).includes('Panel ready:')){clearTimeout(timeout);resolve()}});
  child.once('exit',()=>{clearTimeout(timeout);reject(new Error('Unexpected server exit'))});
 });
}
async function stop(){
 if(child&&!child.killed&&child.exitCode===null){const ended=new Promise(r=>child.once('exit',r));child.kill('SIGTERM');await ended}
}
async function call(route,{method='GET',data,headers={}}={}){
 const response=await raw('/api/panel/'+route,{method,data,headers});
 return {status:response.status,body:JSON.parse(response.bytes.toString())};
}
async function raw(path,{method='GET',data,headers={}}={}){
 return await new Promise((resolve,reject)=>{
  const req=http.request({hostname:'127.0.0.1',port:3121,path,method,
   headers:{Host:host,'Content-Type':'application/json',...(method==='GET'?{}:{Origin:'http://'+host,'X-Panel-Proof':proof}),...headers}
  },res=>{
   const chunks=[];res.on('data',b=>chunks.push(b));
   res.on('end',()=>resolve({status:res.statusCode,headers:res.headers,bytes:Buffer.concat(chunks)}));
   res.on('error',reject);
  });
  req.on('error',reject);req.end(data===undefined?undefined:JSON.stringify(data));
 });
}
try{
 const manifest=JSON.parse(await readFile('addon/home-panel/manifest.json','utf8'));
 assert.equal(manifest.name,'Home Panel');assert.equal(manifest.homeassistant_api,true);
 assert.equal(manifest.ports['8090/tcp'],8090);assert.equal(manifest.image,undefined);
 assert.deepEqual(manifest.arch,['amd64']);
 await launch();
 let boot=await call('bootstrap');assert.equal(boot.status,200);proof=boot.body.proof;
 assert.equal(boot.body.preview,false);assert.equal(boot.body.haConfigured,true);
 let p=boot.body.preferences;assert.equal(p.mode,'demo');assert.equal(p.devices.some(d=>d.id==='rgb'),false);
 assert.equal((await call('bootstrap',{headers:{Host:'evil.example'}})).status,400);
 assert.equal((await call('preferences',{method:'PUT',data:p,headers:{Origin:'http://evil.example'}})).status,400);
 assert.equal((await call('preferences',{method:'PUT',data:p,headers:{'X-Panel-Proof':'bad'}})).status,400);
 p.theme='light';p.favorites=['hall'];p.mode='live';
 p.bindings['living:0']={entityId:light.entity_id,verified:true};
 p.bindings['camera-yard']={entityId:camera.entity_id,verified:true};
 assert.equal((await call('preferences',{method:'PUT',data:p})).status,200);
 const states=await call('ha/states');assert.equal(states.status,200);
 assert.equal(JSON.stringify(states).includes('camera-secret'),false);
 assert.equal(JSON.stringify(states).includes(token),false);
 assert.equal((await call('ha/command',{method:'POST',data:{id:'living:0',value:false}})).status,200);
 assert.equal(light.state,'off');
 const frame=await raw('/api/panel/ha/camera',{method:'POST',data:{id:'camera-yard'}});
 assert.equal(frame.status,200);assert.equal(frame.headers['content-type'],'image/webp');
 assert.ok(frame.bytes.byteLength>1000);
 assert.equal((await fetch('http://127.0.0.1:3121/data/panel.sqlite')).status,404);
 assert.equal((await fetch('http://127.0.0.1:3121/startup.mjs')).status,404);
 denied=true;assert.equal((await call('ha/states')).status,400);denied=false;
 const oldProof=proof;await stop();await launch();
 boot=await call('bootstrap');proof=boot.body.proof;
 assert.notEqual(proof,oldProof);assert.equal(boot.body.preferences.theme,'light');
 assert.deepEqual(boot.body.preferences.favorites,['hall']);
 assert.equal(boot.body.preferences.mode,'live');assert.equal(boot.body.preferences.bindings['living:0'].verified,true);
 const other=await call('bootstrap',{headers:{Host:'homeassistant.local:8090'}});
 assert.equal(other.body.preferences.theme,'light');assert.deepEqual(other.body.preferences.favorites,['hall']);
 assert.ok(seen.every(p=>p.startsWith('/core/api/')));
 assert.equal((await fetch('http://127.0.0.1:3121/health')).status,200);
 console.log('PASS: local manifest, Supervisor token, correct /core/api routes, LAN Host/Origin/CSRF, shared SQLite profile, saved theme/favorites/mode/bindings after restart, light command/readback, camera frame, secret filtering, HA auth error, health.');
}finally{await stop();await new Promise(r=>fake.close(r));await rm(dir,{recursive:true,force:true})}
