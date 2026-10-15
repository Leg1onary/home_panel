import WebSocket from 'ws';
import {randomBytes} from 'node:crypto';
import {Readable,Transform} from 'node:stream';
import {pipeline} from 'node:stream/promises';

// Only HA's HLS endpoints are accepted, never a camera URL or arbitrary proxy target.
const assetPattern=/^(?:master_playlist\.m3u8|playlist\.m3u8|init\.mp4|segment\/\d+(?:\.\d+)?\.m4s)$/;
export class CameraStreams {
 constructor(ha){this.ha=ha;this.sessions=new Map()}
 prune(){for(const [key,s] of this.sessions)if(s.expires<Date.now())this.close(key)}
 close(key){const s=this.sessions.get(key);if(s)for(const c of s.pending)c.abort();this.sessions.delete(key)}
 async start(id,preferences,owner){
  this.prune();
  const entity=this.ha.cameraEntity(id,preferences);
  if(this.sessions.size>=12)throw new Error('Слишком много открытых просмотров. Закрой другое окно камеры.');
  const url=await this.streamURL(entity);
  const match=/^\/api\/hls\/([a-f0-9]+)\/master_playlist\.m3u8$/.exec(url);
  if(!match)throw new Error('Home Assistant вернул неподдерживаемый адрес HLS.');
  const key=randomBytes(24).toString('hex');
  this.sessions.set(key,{owner,id,entity,token:match[1],expires:Date.now()+90000,pending:new Set()});
  return {key,url:`ha/stream/${key}/master_playlist.m3u8`};
 }
 streamURL(entity){
  const endpoint=new URL(this.ha.url);
  endpoint.protocol=endpoint.protocol==='https:'?'wss:':'ws:';
  // Supervisor exposes /core/websocket; direct Core exposes /api/websocket.
  endpoint.pathname=endpoint.hostname==='supervisor'?'/core/websocket':endpoint.pathname.replace(/\/$/,'')+'/api/websocket';
  return new Promise((resolve,reject)=>{
   let settled=false;
   const ws=new WebSocket(endpoint,{headers:{Authorization:`Bearer ${this.ha.token}`},maxPayload:1024*1024,followRedirects:false});
   const finish=(error,url)=>{if(settled)return;settled=true;clearTimeout(timer);ws.close();error?reject(error):resolve(url)};
   const timer=setTimeout(()=>{finish(new Error('Home Assistant не подготовил поток за 25 секунд. Проверь видео в HA.'));ws.terminate()},25000);
   ws.on('error',()=>finish(new Error('Нет соединения с видео API Home Assistant.')));
   ws.on('close',()=>{if(!settled)finish(new Error('Соединение с видео API Home Assistant закрыто.'))});
   ws.on('message',bytes=>{
    try{
     const message=JSON.parse(bytes.toString());
     if(message.type==='auth_required')ws.send(JSON.stringify({type:'auth',access_token:this.ha.token}));
     else if(message.type==='auth_invalid')finish(new Error('Home Assistant отклонил авторизацию видео.'));
     else if(message.type==='auth_ok')ws.send(JSON.stringify({id:1,type:'camera/stream',entity_id:entity,format:'hls'}));
     else if(message.type==='result'&&message.id===1){
      if(message.success&&typeof message.result?.url==='string')finish(null,message.result.url);
      else finish(new Error('Камера не отдала HLS-поток. Проверь воспроизведение этой сущности в Home Assistant и интеграцию Stream.'));
     }
    }catch{finish(new Error('Некорректный ответ видео API Home Assistant.'))}
   });
  });
 }
 get(key,owner,p){
  this.prune();const s=this.sessions.get(key);
  if(!s||s.owner!==owner)throw new Error('Просмотр завершён. Открой камеру заново.');
  if(this.ha.cameraEntity(s.id,p)!==s.entity){this.close(key);throw new Error('Привязка камеры изменилась. Открой её заново.')}
  s.expires=Date.now()+90000;return s;
 }
 async proxy(key,asset,query,owner,p,req,res){
  if(!assetPattern.test(asset))throw new Error('Недопустимый файл потока.');
  const s=this.get(key,owner,p),params=new URLSearchParams();
  for(const [name,value] of query){
   if(!['_HLS_msn','_HLS_part','_HLS_skip'].includes(name)||!(/^\d{1,12}$/.test(value)||name==='_HLS_skip'&&['YES','v2'].includes(value)))throw new Error('Недопустимый параметр потока.');
   params.set(name,value);
  }
  const controller=new AbortController();s.pending.add(controller);
  const abort=()=>controller.abort(),timer=setTimeout(abort,30000);
  res.once('close',abort);
  try{
   const upstream=await fetch(`${this.ha.url}/api/hls/${s.token}/${asset}${params.size?'?'+params:''}`,{
    headers:{Authorization:`Bearer ${this.ha.token}`},redirect:'error',signal:controller.signal
   });
   if(!upstream.ok){await upstream.body?.cancel();throw new Error(`Поток Home Assistant недоступен (${upstream.status}).`)}
   const playlist=asset.endsWith('.m3u8'),limit=playlist?512*1024:24*1024*1024;
   if(!playlist){
    // Forward media progressively with backpressure; never await the entire
    // segment in memory before the browser can start receiving it.
    let size=0;
    const bounded=new Transform({transform(chunk,encoding,callback){
     size+=chunk.length;
     callback(size>limit?new Error('Слишком большой фрагмент видео.'):null,chunk);
    }});
    res.writeHead(200,{'Content-Type':asset==='init.mp4'?'video/mp4':'video/iso.segment','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'});
    await pipeline(Readable.fromWeb(upstream.body),bounded,res,{signal:controller.signal});
    return;
   }
   const reader=upstream.body.getReader(),parts=[];let size=0;
   try{
    while(true){const {done,value}=await reader.read();if(done)break;size+=value.length;if(size>limit)throw new Error('Слишком большой фрагмент видео.');parts.push(Buffer.from(value))}
   }finally{await reader.cancel()}
   let bytes=Buffer.concat(parts);
   if(playlist){
    const text=bytes.toString('utf8');
    if(!text.startsWith('#EXTM3U'))throw new Error('Некорректный HLS-плейлист.');
    const rewrite=value=>{
     const u=new URL(value,`http://stream/api/hls/${s.token}/${asset}`);
     const prefix=`/api/hls/${s.token}/`,relative=u.pathname.slice(prefix.length);
     if(u.origin!=='http://stream'||!u.pathname.startsWith(prefix)||!assetPattern.test(relative)||u.search||u.hash)throw new Error('Неподдерживаемый ресурс HLS.');
     return `/api/panel/ha/stream/${key}/${relative}`;
    };
    bytes=Buffer.from(text.split('\n').map(line=>line.startsWith('#')?line.replace(/URI="([^"]+)"/g,(_,value)=>`URI="${rewrite(value)}"`):line.trim()?rewrite(line.trim()):line).join('\n'));
   }
   if(!res.destroyed){res.writeHead(200,{'Content-Type':playlist?'application/vnd.apple.mpegurl':asset==='init.mp4'?'video/mp4':'video/iso.segment','Cache-Control':'no-store','X-Content-Type-Options':'nosniff','Referrer-Policy':'no-referrer'});res.end(bytes)}
  }finally{clearTimeout(timer);res.removeListener('close',abort);s.pending.delete(controller)}
 }
}
