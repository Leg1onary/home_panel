import assert from 'node:assert/strict';
import http from 'node:http';
import {WebSocketServer} from 'ws';
import {CameraRTC} from '../server/rtc.js';

let supported=true,rejectAuth=false,offers=0,candidates=0,closed=0;
const server=http.createServer(),wss=new WebSocketServer({server,path:'/api/websocket'});
wss.on('connection',ws=>{
 assert.equal(ws._socket!=null,true);
 ws.send(JSON.stringify({type:'auth_required'}));
 ws.on('close',()=>closed++);
 ws.on('message',bytes=>{
  const m=JSON.parse(bytes);
  if(m.type==='auth'){assert.equal(m.access_token,'ha-private');return ws.send(JSON.stringify({type:rejectAuth?'auth_invalid':'auth_ok'}))}
  assert.equal(m.entity_id,'camera.test');
  let result={};
  if(m.type==='camera/capabilities')result={frontend_stream_types:supported?['hls','web_rtc']:['hls'],access_token:'not-for-browser'};
  else if(m.type==='camera/webrtc/get_client_config')result={configuration:{iceServers:[{urls:'stun:127.0.0.1:3478'}],access_token:'not-for-browser'},access_token:'not-for-browser'};
  else if(m.type==='camera/webrtc/offer'){
   offers++;ws.send(JSON.stringify({id:m.id,type:'result',success:true,result:null}));
   for(const event of [
    {type:'session',session_id:'ha-internal-session'},
    {type:'candidate',candidate:{candidate:'candidate:remote',sdpMid:'0'}},
    {type:'answer',answer:'v=0\r\ns=fixture\r\n'},
    {type:'error',message:'rtsp://camera-user:camera-password@private.invalid',access_token:'ha-private'},
   ])ws.send(JSON.stringify({id:m.id,type:'event',event}));
   return;
  }else if(m.type==='camera/webrtc/candidate'){assert.equal(m.session_id,'ha-internal-session');candidates++}
  else throw new Error('Unexpected command '+m.type);
  ws.send(JSON.stringify({id:m.id,type:'result',success:true,result}));
 });
});
await new Promise(r=>server.listen(0,'127.0.0.1',r));
const ha={url:`http://127.0.0.1:${server.address().port}`,token:'ha-private',cameraEntity(id,p){
 if(p.mode!=='live'||!p.verified||id!=='camera-yard')throw new Error('Unverified camera');
 return p.entity;
}};
const p={mode:'live',verified:true,entity:'camera.test'},rtc=new CameraRTC(ha);
try{
 await assert.rejects(rtc.start('camera-yard',{...p,verified:false},'owner'),/Unverified/);
 const started=await rtc.start('camera-yard',p,'owner'),key=started.key;
 assert.match(key,/^[a-f0-9]{48}$/);assert.deepEqual(started.configuration,{iceServers:[{urls:['stun:127.0.0.1:3478']}]});
 assert.ok(!JSON.stringify(started).includes('private'));
 assert.throws(()=>rtc.get(key,'other',p));
 await assert.rejects(rtc.offer(key,'owner',p,'garbage'),/offer/);
 await assert.rejects(rtc.addCandidate(key,'owner',p,{candidate:'x'}),/создана/);
 await rtc.offer(key,'owner',p,'v=0\r\ns=client\r\n');
 await new Promise(r=>setTimeout(r,20));
 const events=rtc.events(key,'owner',p,0);
 assert.deepEqual(events.events.map(e=>e.type),['session','candidate','answer','error']);
 assert.ok(!JSON.stringify(events).includes('ha-private'));assert.ok(!JSON.stringify(events).includes('rtsp:'));
 assert.ok(!JSON.stringify(events).includes('ha-internal-session'));
 assert.deepEqual(rtc.events(key,'owner',p,events.cursor).events,[]);
 assert.throws(()=>rtc.events(key,'owner',p,-1));assert.throws(()=>rtc.events(key,'owner',p,999));
 await assert.rejects(rtc.offer(key,'owner',p,'v=0\r\n'),/уже/);assert.equal(offers,1);
 await rtc.addCandidate(key,'owner',p,{candidate:'candidate:local',sdpMid:'0',evil:'not-sent'});assert.equal(candidates,1);
 await assert.rejects(rtc.addCandidate(key,'owner',p,{candidate:'x',sdpMLineIndex:100}));
 rtc.close(key);assert.throws(()=>rtc.get(key,'owner',p));
 supported=false;await assert.rejects(rtc.start('camera-yard',p,'owner'),/не поддерживает/);assert.equal(rtc.sessions.size,0);
 supported=true;rejectAuth=true;await assert.rejects(rtc.start('camera-yard',p,'owner'),/авторизацию/);assert.equal(rtc.sessions.size,0);rejectAuth=false;
 const changed=await rtc.start('camera-yard',p,'owner');
 assert.throws(()=>rtc.get(changed.key,'owner',{...p,entity:'camera.changed'}),/изменилась/);
 const expired=await rtc.start('camera-yard',p,'owner');rtc.sessions.get(expired.key).expires=0;rtc.prune();assert.equal(rtc.sessions.size,0);
 await new Promise(r=>setTimeout(r,20));assert.ok(closed>=4);
 console.log('PASS: HA WebRTC auth/capabilities/config, bounded owned sessions, offer/subscription/trickle ICE/events, fixed camera scope, secret filtering, unsupported/auth rejection, binding changes, expiry and close.');
}finally{
 for(const key of rtc.sessions.keys())rtc.close(key);
 for(const ws of wss.clients)ws.terminate();
 await new Promise(r=>wss.close(r));await new Promise(r=>server.close(r));
}
