// Isolated browser QA fixture. Never shipped in the local installation.
import http from 'node:http';
import {readFile} from 'node:fs/promises';
import {WebSocketServer} from 'ws';
import {join} from 'node:path';
const make=(entity_id,state,attributes={})=>({entity_id,state,attributes,last_updated:new Date().toISOString(),last_reported:new Date().toISOString()});
const states=[
 make('switch.qa_living','on',{friendly_name:'QA living'}),
 make('switch.qa_kitchen','off',{friendly_name:'QA kitchen'}),
 make('sensor.qa_living_temperature','21.7',{unit_of_measurement:'°C',device_class:'temperature'}),
 make('sensor.qa_living_humidity','51',{unit_of_measurement:'%',device_class:'humidity'}),
 make('binary_sensor.qa_door','off',{device_class:'door'}),
 make('binary_sensor.qa_smoke','off',{device_class:'smoke'}),
 make('switch.qa_corridor','off'),
 make('camera.qa_yard','idle',{access_token:'DO_NOT_EXPORT'}),
 make('cover.qa_gate','unknown',{current_position:null}),
 make('climate.qa_boiler','heat',{current_temperature:44,temperature:50}),
 make('switch.qa_pump','off'),
 make('binary_sensor.qa_leak','off',{device_class:'moisture'}),
 make('sensor.qa_lux','140',{unit_of_measurement:'lx'})
];
const server=http.createServer(async(req,res)=>{
 res.setHeader('Content-Type','application/json');
 if(req.headers.authorization!=='Bearer mock-test-only'){res.writeHead(401);return res.end('{}')}
 if(req.url==='/api/states')return res.end(JSON.stringify(states));
 if(req.url.startsWith('/api/hls/abcd/')){
  const asset=new URL(req.url,'http://mock').pathname.slice('/api/hls/abcd/'.length);
  if(asset==='master_playlist.m3u8'){res.setHeader('Content-Type','application/vnd.apple.mpegurl');return res.end('#EXTM3U\n#EXT-X-STREAM-INF:BANDWIDTH=1500000,CODECS="avc1.42c01e",RESOLUTION=640x360\nplaylist.m3u8\n')}
  if(process.env.HLS_FIXTURE&&/^(playlist\.m3u8|init\.mp4|segment\/\d+\.m4s)$/.test(asset)){
   try{res.setHeader('Content-Type',asset.endsWith('.m3u8')?'application/vnd.apple.mpegurl':'video/mp4');return res.end(await readFile(join(process.env.HLS_FIXTURE,asset)))}catch{res.writeHead(404);return res.end('{}')}
  }
 }
 if(req.url==='/api/camera_proxy/camera.qa_yard'){await new Promise(r=>setTimeout(r,1000));res.setHeader('Content-Type','image/webp');return res.end(await readFile('assets/interior.webp'))}
 if(req.url.startsWith('/api/states/')){
  const e=states.find(e=>e.entity_id===req.url.split('/').at(-1));
  if(!e){res.writeHead(404);return res.end('{}')}return res.end(JSON.stringify(e));
 }
 if(req.url.startsWith('/api/services/')){
  const chunks=[];for await(const c of req)chunks.push(c);
  const payload=JSON.parse(Buffer.concat(chunks)),e=states.find(e=>e.entity_id===payload.entity_id);
  if(!e){res.writeHead(404);return res.end('{}')}
  await new Promise(r=>setTimeout(r,300));e.state=req.url.endsWith('turn_on')?'on':'off';e.last_reported=e.last_updated=new Date().toISOString();
  return res.end(JSON.stringify([e]));
 }
 res.writeHead(404);res.end('{}');
});
const sockets=new WebSocketServer({server,path:'/api/websocket'});
sockets.on('connection',ws=>{
 ws.send(JSON.stringify({type:'auth_required'}));
 ws.on('message',bytes=>{
  const m=JSON.parse(bytes);
  if(m.type==='auth')return ws.send(JSON.stringify({type:m.access_token==='mock-test-only'?'auth_ok':'auth_invalid'}));
  if(m.type==='camera/stream')return ws.send(JSON.stringify({id:m.id,type:'result',success:true,result:{url:'/api/hls/abcd/master_playlist.m3u8'}}));
 });
});
server.listen(Number(process.env.MOCK_PORT||3031),'127.0.0.1',()=>console.log('Mock HA ready, localhost only'));
