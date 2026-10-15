// Test-only fake HA. Checks real WebSocket handshake and HLS proxy boundaries.
import assert from 'node:assert/strict';
import http from 'node:http';
import {spawn} from 'node:child_process';
import {WebSocketServer} from 'ws';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join} from 'node:path';
const dir=await mkdtemp(join(tmpdir(),'panel-stream-'));
let child,proof,p,streamCalls=0,rtcCalls=0,badURL=false,evilPlaylist=false,slowMedia=false,finishMedia,lastPlaylistQuery;
const ha=http.createServer((req,res)=>{
 assert.equal(req.headers.authorization,'Bearer fixture-only');
 res.setHeader('Content-Type','application/json');
 if(req.url==='/api/states')return res.end(JSON.stringify([{entity_id:'camera.test',state:'idle',attributes:{access_token:'camera-secret'}}]));
 if(req.url.startsWith('/api/hls/abc123/')){
  if(req.url.includes('master_playlist'))return res.end('#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=1000000\n'+(evilPlaylist?'http://127.0.0.1/secrets':'playlist.m3u8')+'\n');
  if(req.url.includes('playlist.m3u8')){
   lastPlaylistQuery=new URL(req.url,'http://fixture').search;
   return res.end('#EXTM3U\n#EXT-X-MAP:URI="/api/hls/abc123/init.mp4"\n#EXT-X-PART-INF:PART-TARGET=0.5\n#EXT-X-SERVER-CONTROL:CAN-BLOCK-RELOAD=YES,PART-HOLD-BACK=1.0\n#EXT-X-START:TIME-OFFSET=-1.0,PRECISE=YES\n#EXTINF:1,\nsegment/1.m4s\n#EXT-X-PART:DURATION=0.5,URI="./segment/2.0.m4s"\n#EXT-X-PRELOAD-HINT:TYPE=PART,URI="./segment/2.1.m4s"\n');
  }
  if(slowMedia){res.write('first-');finishMedia=()=>res.end('last');return}
  return res.end('segment-fixture');
 }
 res.writeHead(404);res.end('{}');
});
const ws=new WebSocketServer({server:ha,path:'/api/websocket'});
ws.on('connection',s=>{
 s.send(JSON.stringify({type:'auth_required'}));
 s.on('message',bytes=>{
  const m=JSON.parse(bytes);
  if(m.type==='auth'){assert.equal(m.access_token,'fixture-only');return s.send(JSON.stringify({type:'auth_ok'}))}
  if(m.type.startsWith('camera/')&&m.type!=='camera/stream'){
   assert.equal(m.entity_id,'camera.test');rtcCalls++;
   let result=m.type==='camera/capabilities'?{frontend_stream_types:['web_rtc','hls']}:{configuration:{iceServers:[]}};
   if(m.type==='camera/webrtc/offer'){
    s.send(JSON.stringify({type:'result',id:m.id,success:true,result:null}));
    s.send(JSON.stringify({type:'event',id:m.id,event:{type:'session',session_id:'private-rtc-session'}}));
    return s.send(JSON.stringify({type:'event',id:m.id,event:{type:'answer',answer:'v=0\r\ns=fixture\r\n'}}));
   }
   if(m.type==='camera/webrtc/candidate'){assert.equal(m.session_id,'private-rtc-session');result=null}
   return s.send(JSON.stringify({type:'result',id:m.id,success:true,result}));
  }
  assert.equal(m.type,'camera/stream');assert.equal(m.entity_id,'camera.test');assert.equal(m.format,'hls');streamCalls++;
  s.send(JSON.stringify({type:'result',id:m.id,success:true,result:{url:badURL?'http://evil.example/video':'/api/hls/abc123/master_playlist.m3u8'}}));
 });
});
await new Promise(r=>ha.listen(3142,'127.0.0.1',r));
const root='http://127.0.0.1:3141/api/panel/';
const raw=(path,method='GET',data,headers={})=>fetch(root+path,{method,headers:{'Content-Type':'application/json',...(method==='GET'?{}:{'X-Panel-Proof':proof}),...headers},...(data===undefined?{}:{body:JSON.stringify(data)})});
const call=async(...args)=>{const r=await raw(...args);return {code:r.status,body:await r.json()}};
try{
 child=spawn(process.execPath,['release/server.mjs'],{env:{...process.env,PORT:'3141',HA_URL:'http://127.0.0.1:3142',HA_TOKEN:'fixture-only',PANEL_DATA:dir},stdio:['ignore','pipe','inherit']});
 await new Promise((resolve,reject)=>{child.stdout.on('data',b=>{if(String(b).includes('Panel ready'))resolve()});child.on('exit',()=>reject(new Error('Early exit')))});
 const boot=await call('bootstrap');proof=boot.body.proof;p=boot.body.preferences;
 assert.equal((await call('ha/stream/start','POST',{id:'camera-yard'})).code,400);assert.equal(streamCalls,0);
 assert.equal((await call('ha/rtc/start','POST',{id:'camera-yard'})).code,400);assert.equal(rtcCalls,0);
 p.mode='live';p.bindings['camera-yard']={entityId:'camera.test',verified:true};
 assert.equal((await call('preferences','PUT',p)).code,200);
 assert.equal((await call('ha/stream/start','POST',{id:'camera-yard'},{'X-Panel-Proof':''})).code,400);
 assert.equal((await call('ha/stream/start','POST',{id:'camera-extra-1'})).code,400);
 assert.equal((await call('ha/rtc/start','POST',{id:'camera-yard'},{'X-Panel-Proof':''})).code,400);assert.equal(rtcCalls,0);
 assert.equal((await call('ha/rtc/start','POST',{id:'camera-extra-1'})).code,400);
 const rtcStarted=await call('ha/rtc/start','POST',{id:'camera-yard'});assert.equal(rtcStarted.code,200);
 const rk=rtcStarted.body.key;assert.match(rk,/^[a-f0-9]{48}$/);assert.equal(rtcCalls,2);
 assert.equal((await call(`ha/rtc/${rk}/offer`,'POST',{offer:'v=0\r\ns=client\r\n'})).code,200);
 await new Promise(r=>setTimeout(r,20));
 const signals=await call(`ha/rtc/${rk}/events?after=0`);
 assert.equal(signals.code,200);assert.deepEqual(signals.body.events.map(e=>e.type),['session','answer']);
 assert.ok(!JSON.stringify(signals).includes('private-rtc-session'));
 assert.equal((await call(`ha/rtc/${rk}/candidate`,'POST',{candidate:{candidate:'candidate:test',sdpMid:'0'}})).code,200);
 assert.equal((await raw(`ha/rtc/${rk}/events?after=0`,'GET',undefined,{'Sec-Fetch-Site':'cross-site'})).status,400);
 assert.equal((await call(`ha/rtc/${rk}/events?url=http://evil.invalid`)).code,400);
 assert.equal((await call(`ha/rtc/${rk}/events?after=-1`)).code,400);
 assert.equal((await call(`ha/rtc/${rk}/offer`,'POST',{offer:'v=0\r\n'})).code,400);
 assert.equal((await call('ha/rtc/'+rk,'DELETE')).code,200);
 assert.equal((await call(`ha/rtc/${rk}/events`)).code,400);
 const started=await call('ha/stream/start','POST',{id:'camera-yard'});assert.equal(started.code,200);
 const {key,url}=started.body;assert.equal(JSON.stringify(started).includes('abc123'),false);assert.match(key,/^[a-f0-9]{48}$/);
 let r=await raw(url),text=await r.text();assert.equal(r.status,200);assert.match(text,new RegExp('ha/stream/'+key+'/playlist'));assert.ok(!text.includes('abc123'));
 r=await raw(`ha/stream/${key}/playlist.m3u8?_HLS_msn=2&_HLS_part=0`);text=await r.text();assert.equal(r.status,200);assert.match(text,new RegExp('URI="/api/panel/ha/stream/'+key+'/init.mp4"'));assert.ok(!text.includes('abc123'));
 assert.equal(lastPlaylistQuery,'?_HLS_msn=2&_HLS_part=0');
 assert.match(text,/#EXT-X-SERVER-CONTROL:CAN-BLOCK-RELOAD=YES,PART-HOLD-BACK=1.0/);
 assert.match(text,new RegExp('#EXT-X-PRELOAD-HINT:TYPE=PART,URI="/api/panel/ha/stream/'+key+'/segment/2.1.m4s"'));
 assert.match(text,/#EXT-X-START:TIME-OFFSET=-1.0,PRECISE=YES/);
 r=await raw(`ha/stream/${key}/segment/2.0.m4s`);assert.equal(r.status,200);assert.equal(await r.text(),'segment-fixture');
 slowMedia=true;
 let firstRead;
 try{
  const first=raw(`ha/stream/${key}/segment/3.m4s`).then(async response=>{
   const reader=response.body.getReader();
   firstRead=reader;
   return new TextDecoder().decode((await reader.read()).value);
  });
  let deadline;
  try{
   assert.equal(await Promise.race([first,new Promise((_,reject)=>{deadline=setTimeout(()=>reject(new Error('Proxy buffered the entire segment instead of forwarding first bytes')),2000)})]),'first-');
  }finally{clearTimeout(deadline)}
 }finally{finishMedia?.();slowMedia=false}
 assert.equal(new TextDecoder().decode((await firstRead.read()).value),'last');
 assert.equal((await firstRead.read()).done,true);
 assert.equal((await raw(url,'GET',undefined,{'Sec-Fetch-Site':'cross-site'})).status,400);
 assert.equal((await raw(url+'?url=http://evil.example')).status,400);
 assert.equal((await raw(`ha/stream/${key}/invalid-file`)).status,400);
 evilPlaylist=true;assert.equal((await raw(url)).status,400);evilPlaylist=false;
 assert.equal((await call('ha/stream/'+key,'DELETE')).code,200);assert.equal((await raw(url)).status,400);
 badURL=true;assert.equal((await call('ha/stream/start','POST',{id:'camera-yard'})).code,400);badURL=false;
 const another=await call('ha/stream/start','POST',{id:'camera-yard'});p.mode='demo';await call('preferences','PUT',p);
 assert.equal((await raw(another.body.url)).status,400);
 console.log('PASS: WS auth/stream command, verified camera only, CSRF, HLS rewrites incl init/parts, progressive first bytes before upstream completion, secret filtering, query/file allowlists, SSRF rejection, stop invalidates session, mode change blocks existing stream.');
}finally{
 if(child&&child.exitCode===null){const done=new Promise(r=>child.once('exit',r));child.kill();await done}
 for(const client of ws.clients)client.terminate();await new Promise(r=>ws.close(r));ha.closeAllConnections();await new Promise(r=>ha.close(r));
 await rm(dir,{recursive:true,force:true});
}
