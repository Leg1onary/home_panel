// Browser QA only: emulate HA's rolling LL-HLS playlist and blocking reload.
// Uses ffmpeg-generated 1-second fMP4 fragments in HLS_FIXTURE, never real video.
import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {join} from 'node:path';
import {WebSocketServer} from 'ws';
const root=process.env.HLS_FIXTURE;
if(!root)throw new Error('HLS_FIXTURE must point to test-only init.mp4 and segment/0..59.m4s');
let epoch=Date.now(),requests={parts:0,segments:0,blocking:0};
const available=()=>Math.min(59,20+Math.floor((Date.now()-epoch)/1000));
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
const server=http.createServer(async(req,res)=>{
 try{
  const url=new URL(req.url,'http://fixture');
  if(url.pathname==='/fixture/reset'){epoch=Date.now();requests={parts:0,segments:0,blocking:0};return res.end('{}')}
  if(url.pathname==='/fixture/stats')return res.end(JSON.stringify(requests));
  if(req.headers.authorization!=='Bearer mock-test-only'){res.writeHead(401);return res.end('{}')}
  if(url.pathname==='/api/states')return res.end(JSON.stringify([{entity_id:'camera.qa_yard',state:'idle',attributes:{}}]));
  if(url.pathname.endsWith('master_playlist.m3u8')){
   res.setHeader('Content-Type','application/vnd.apple.mpegurl');
   return res.end('#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=1500000,CODECS="avc1.42c01e"\nplaylist.m3u8\n');
  }
  if(url.pathname.endsWith('playlist.m3u8')){
   const msn=Number(url.searchParams.get('_HLS_msn')),part=Number(url.searchParams.get('_HLS_part')||0);
   if(url.searchParams.has('_HLS_msn')){
    requests.blocking++;
    const target=msn*6+part;
    const deadline=Date.now()+8000;
    while(available()<=target&&Date.now()<deadline&&!res.destroyed)await sleep(30);
   }
   const n=available(),complete=Math.floor(n/6),first=Math.max(0,complete-3);
   const lines=['#EXTM3U','#EXT-X-VERSION:6','#EXT-X-INDEPENDENT-SEGMENTS',
    '#EXT-X-MAP:URI="init.mp4"','#EXT-X-TARGETDURATION:6',`#EXT-X-MEDIA-SEQUENCE:${first}`,
    '#EXT-X-DISCONTINUITY-SEQUENCE:0','#EXT-X-PART-INF:PART-TARGET=1.000',
    '#EXT-X-SERVER-CONTROL:CAN-BLOCK-RELOAD=YES,PART-HOLD-BACK=2.000',
    '#EXT-X-START:TIME-OFFSET=-2.000,PRECISE=YES'];
   for(let seq=first;seq<=complete;seq++){
    for(let p=0;p<6&&seq*6+p<n;p++)lines.push(`#EXT-X-PART:DURATION=1.000,URI="./segment/${seq}.${p}.m4s",INDEPENDENT=YES`);
    if(seq<complete)lines.push(`#EXTINF:6.000,\n./segment/${seq}.m4s`);
   }
   lines.push(`#EXT-X-PRELOAD-HINT:TYPE=PART,URI="./segment/${Math.floor(n/6)}.${n%6}.m4s"`);
   res.setHeader('Content-Type','application/vnd.apple.mpegurl');return res.end(lines.join('\n')+'\n');
  }
  if(url.pathname.endsWith('init.mp4')){res.setHeader('Content-Type','video/mp4');return res.end(await readFile(join(root,'init.mp4')))}
  const m=/\/segment\/(\d+)(?:\.(\d+))?\.m4s$/.exec(url.pathname);
  if(m){
   const seq=Number(m[1]),part=m[2]===undefined?null:Number(m[2]),target=seq*6+(part||0);
   const deadline=Date.now()+3000;
   while(available()<=target&&Date.now()<deadline&&!res.destroyed)await sleep(25);
   if(available()<=target){res.writeHead(404);return res.end()}
   res.setHeader('Content-Type','video/iso.segment');
   if(part!==null){requests.parts++;return res.end(await readFile(join(root,`segment/${target}.m4s`)))}
   requests.segments++;
   const chunks=[];for(let i=seq*6;i<Math.min(seq*6+6,available());i++)chunks.push(await readFile(join(root,`segment/${i}.m4s`)));
   return res.end(Buffer.concat(chunks));
  }
  res.writeHead(404);res.end('{}');
 }catch{if(!res.headersSent)res.writeHead(500);res.end()}
});
const sockets=new WebSocketServer({server,path:'/api/websocket'});
sockets.on('connection',ws=>{
 ws.send(JSON.stringify({type:'auth_required'}));
 ws.on('message',bytes=>{
  const m=JSON.parse(bytes);
  if(m.type==='auth')return ws.send(JSON.stringify({type:m.access_token==='mock-test-only'?'auth_ok':'auth_invalid'}));
  ws.send(JSON.stringify({type:'result',id:m.id,success:true,result:{url:'/api/hls/abcd/master_playlist.m3u8'}}));
 });
});
server.listen(3155,'127.0.0.1',()=>console.log('Rolling LL-HLS fixture ready'));
