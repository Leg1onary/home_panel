// SSE live states: snapshot/patch/error over /api/panel/ha/stream plus LiveFeed subscriber hygiene.
import assert from 'node:assert/strict';
import http from 'node:http';
import {spawn} from 'node:child_process';
import {LiveFeed} from '../server/live-stream.js';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const dir=await mkdtemp(join(tmpdir(),'panel-live-'));
let flip=false,dead=false,polls=0;
const states=()=>[
 {entity_id:'light.hall',state:flip?'off':'on',attributes:{friendly_name:'Hall'}},
 {entity_id:'sensor.temp',state:'21',attributes:{unit_of_measurement:'°C'}}];
const ha=http.createServer((req,res)=>{
 assert.equal(req.headers.authorization,'Bearer fixture-only');
 if(req.url==='/api/states'){polls++;if(dead)return req.socket.destroy();res.setHeader('Content-Type','application/json');return res.end(JSON.stringify(states()))}
 res.writeHead(404);res.end('{}');
});
await new Promise(r=>ha.listen(3143,'127.0.0.1',r));
const root='http://127.0.0.1:3144/api/panel/';
let child;
try{
 child=spawn(process.execPath,['release/server.mjs'],{env:{...process.env,PORT:'3144',HA_URL:'http://127.0.0.1:3143',HA_TOKEN:'fixture-only',PANEL_DATA:dir},stdio:['ignore','pipe','inherit']});
 await new Promise((resolve,reject)=>{child.stdout.on('data',d=>{if(String(d).includes('Panel ready'))resolve()});child.once('exit',c=>reject(new Error('server exited '+c)))});
 const raw=(headers)=>fetch(root+'ha/stream',{headers});
 assert.equal((await raw({'Sec-Fetch-Site':'cross-site'})).status,403);
 const response=await raw({'Sec-Fetch-Site':'same-origin','X-Panel-Id':'testpage'});
 assert.equal(response.status,200);
 assert.match(response.headers.get('content-type'),/text\/event-stream/);
 const reader=response.body.getReader(),decoder=new TextDecoder();
 let buffer='';
 const event=async type=>{
  for(;;){
   const end=buffer.indexOf('\n\n');
   if(end>=0){
    const chunk=buffer.slice(0,end);buffer=buffer.slice(end+2);
    const name=(chunk.match(/^event: (.+)$/m)||[])[1],data=(chunk.match(/^data: (.+)$/m)||[])[1];
    if(type===undefined)return {name,data};
    if(name===type)return {name,data};
    continue;
   }
   const next=await reader.read();
   assert.equal(next.done,false,'stream ended unexpectedly');
   buffer+=decoder.decode(next.value,{stream:true});
  }
 };
 const snapshot=await event('snapshot');
 const parsed=JSON.parse(snapshot.data);
 assert.deepEqual(parsed.states.map(e=>e.entity_id),['light.hall','sensor.temp']);
 assert.equal(parsed.states[0].attributes.friendly_name,'Hall');
 flip=true;
 const patch=await event('patch');
 const changed=JSON.parse(patch.data);
 assert.equal(changed.length,1);
 assert.equal(changed[0].entity_id,'light.hall');
 assert.equal(changed[0].state,'off');
 dead=true;
 const errorEvent=await event('error');
 assert.match(JSON.parse(errorEvent.data).message,/Home Assistant/);
 // Connection must survive HA feed outage: a read stays pending, stream not closed.
 let stillOpen;
 const probe=reader.read().then(()=>stillOpen=false);
 await Promise.race([probe,new Promise((_,reject)=>setTimeout(()=>{stillOpen=true;reject(new Error('probe'))},1500))]).catch(()=>{});
 assert.equal(stillOpen,true,'SSE соединение закрылось после ошибки HA.');
 await reader.cancel().catch(()=>{});
 // Subscriber removal on client close, poller keeps running: direct LiveFeed check.
 const feed=new LiveFeed({ha:{enabled:true,states:async()=>states()}});
 let writes=0;
 const fake={writeHead(){},write(){writes++},writableEnded:false,destroyed:false,on(name,fn){fake.closed=fn}};
 feed.subscribe(fake);
 assert.equal(feed.clients.size,1);
 fake.closed();
 assert.equal(feed.clients.size,0);
 assert.notEqual(feed.timer,null,'таймер поллера не должен умирать вместе с клиентом');
 const before=polls;
 await new Promise(r=>setTimeout(r,5300));
 assert.ok(polls>before,'поллер продолжает тикать без подписчиков');
 feed.stop();
 console.log('PASS: SSE snapshot then minimal patch, cross-site 403, error event on HA outage with connection alive, subscriber removed on close while poller keeps ticking.');
}finally{
 if(child&&child.exitCode===null){const done=new Promise(r=>child.once('exit',r));child.kill();await done}
 ha.closeAllConnections();await new Promise(r=>ha.close(r));
 await rm(dir,{recursive:true,force:true});
}
