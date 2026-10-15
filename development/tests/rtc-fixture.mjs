// Local, generated-video-only HA signaling fixture. Never packaged.
import http from 'node:http';
import {WebSocketServer} from 'ws';
import {readFile} from 'node:fs/promises';
const jobs=new Map();let sequence=0,supported=true,offers=0,hlsCalls=0,closed=0;
const send=(res,data)=>{if(!res.headersSent)res.setHeader('Content-Type','application/json');res.end(JSON.stringify(data))};
async function body(req){const chunks=[];for await(const c of req)chunks.push(c);return JSON.parse(Buffer.concat(chunks).toString())}
const server=http.createServer(async(req,res)=>{
 try{
  const u=new URL(req.url,'http://fixture');
  if(u.pathname==='/qa/peer'){res.setHeader('Content-Type','text/html');return res.end(await readFile(new URL('./rtc-peer.html',import.meta.url)))}
  if(u.pathname==='/qa/jobs')return send(res,[...jobs.values()].map(j=>({key:j.key,offer:j.offer,candidates:j.candidates.splice(0)})));
  if(u.pathname==='/qa/answer'){
   const b=await body(req),j=jobs.get(b.key);
   if(!j){res.writeHead(404);return send(res,{})}
   j.ws.send(JSON.stringify({type:'event',id:j.id,event:{type:'answer',answer:b.answer}}));return send(res,{});
  }
  if(u.pathname==='/qa/supported'){supported=u.searchParams.get('value')!=='0';return send(res,{supported})}
  if(u.pathname==='/qa/stats')return send(res,{offers,hlsCalls,closed,jobs:jobs.size});
  if(req.headers.authorization!=='Bearer rtc-fixture-only'){res.writeHead(401);return send(res,{})}
  if(u.pathname==='/api/states')return send(res,[{entity_id:'camera.qa_yard',state:'idle',attributes:{friendly_name:'Generated WebRTC camera'}}]);
  if(u.pathname.startsWith('/api/hls/')){
   const r=await fetch('http://127.0.0.1:3155'+u.pathname+u.search,{headers:{Authorization:'Bearer mock-test-only'}});
   res.writeHead(r.status,{'Content-Type':r.headers.get('content-type')});return res.end(Buffer.from(await r.arrayBuffer()));
  }
  res.writeHead(404);send(res,{});
 }catch{if(!res.headersSent)res.writeHead(500);send(res,{})}
});
const sockets=new WebSocketServer({server,path:'/api/websocket'});
sockets.on('connection',ws=>{
 ws.send(JSON.stringify({type:'auth_required'}));
 ws.on('close',()=>{closed++;for(const [key,j]of jobs)if(j.ws===ws)jobs.delete(key)});
 ws.on('message',bytes=>{
  const m=JSON.parse(bytes);
  if(m.type==='auth')return ws.send(JSON.stringify({type:m.access_token==='rtc-fixture-only'?'auth_ok':'auth_invalid'}));
  let result={};
  if(m.type==='camera/capabilities')result={frontend_stream_types:supported?['web_rtc','hls']:['hls']};
  else if(m.type==='camera/webrtc/get_client_config')result={configuration:{iceServers:[]}};
  else if(m.type==='camera/stream'){hlsCalls++;result={url:'/api/hls/abcd/master_playlist.m3u8'}}
  else if(m.type==='camera/webrtc/offer'){
   offers++;const key=String(++sequence);jobs.set(key,{key,id:m.id,ws,offer:m.offer,candidates:[]});
   ws.send(JSON.stringify({id:m.id,type:'result',success:true,result:null}));
   return ws.send(JSON.stringify({id:m.id,type:'event',event:{type:'session',session_id:key}}));
  }else if(m.type==='camera/webrtc/candidate'){jobs.get(m.session_id)?.candidates.push(m.candidate)}
  else throw new Error('Unsupported fixture command');
  ws.send(JSON.stringify({id:m.id,type:'result',success:true,result}));
 });
});
server.listen(3165,'127.0.0.1',()=>console.log('Generated WebRTC fixture ready'));
