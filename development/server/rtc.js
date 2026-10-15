import WebSocket from 'ws';
import {randomBytes} from 'node:crypto';

function candidate(value){
 if(!value||typeof value.candidate!=='string'||value.candidate.length>4096)throw new Error('Неверный ICE-кандидат.');
 const result={candidate:value.candidate};
 if(value.sdpMid!=null){if(typeof value.sdpMid!=='string'||value.sdpMid.length>64)throw new Error('Неверный ICE mid.');result.sdpMid=value.sdpMid}
 if(value.sdpMLineIndex!=null){if(!Number.isInteger(value.sdpMLineIndex)||value.sdpMLineIndex<0||value.sdpMLineIndex>32)throw new Error('Неверный ICE index.');result.sdpMLineIndex=value.sdpMLineIndex}
 if(value.usernameFragment!=null&&typeof value.usernameFragment==='string'&&value.usernameFragment.length<=256)result.usernameFragment=value.usernameFragment;
 return result;
}
function clientConfig(raw){
 const c=raw?.configuration||{},configuration={};
 // Only RTC-specific configuration crosses the bridge. Never forward HA
 // authentication, integration data, or arbitrary result attributes.
 if(Array.isArray(c.iceServers)){
  configuration.iceServers=c.iceServers.slice(0,12).map(server=>{
   const urls=(Array.isArray(server.urls)?server.urls:[server.urls]).filter(u=>typeof u==='string'&&/^(stun|stuns|turn|turns):[^@\s]+$/.test(u)&&u.length<2048);
   if(!urls.length)throw new Error('Неподдерживаемая конфигурация ICE.');
   const out={urls};
   for(const key of ['username','credential'])if(typeof server[key]==='string'&&server[key].length<=4096)out[key]=server[key];
   return out;
  });
 }
 for(const [key,values] of Object.entries({iceTransportPolicy:['all','relay'],bundlePolicy:['balanced','max-compat','max-bundle'],rtcpMuxPolicy:['require']}))if(values.includes(c[key]))configuration[key]=c[key];
 const out={configuration};
 if(typeof raw?.dataChannel==='string'&&raw.dataChannel.length<=128)out.dataChannel=raw.dataChannel;
 return out;
}
export class CameraRTC {
 constructor(ha){this.ha=ha;this.sessions=new Map()}
 prune(){for(const [key,s]of this.sessions)if(s.expires<Date.now())this.close(key)}
 close(key){
  const s=this.sessions.get(key);if(!s)return;
  this.sessions.delete(key);s.closed=true;
  for(const pending of s.pending.values()){clearTimeout(pending.timer);pending.reject(new Error('Просмотр завершён.'))}
  s.pending.clear();
  if(s.ws.readyState===WebSocket.OPEN)s.ws.close();else s.ws.terminate();
 }
 get(key,owner,p){
  this.prune();const s=this.sessions.get(key);
  if(!s||s.owner!==owner)throw new Error('WebRTC-просмотр завершён.');
  if(this.ha.cameraEntity(s.id,p)!==s.entity){this.close(key);throw new Error('Привязка камеры изменилась.')}
  s.expires=Date.now()+90000;return s;
 }
 push(s,event){
  if(s.closed)return;
  // A bounded queue is sufficient for initial negotiation and a few ICE rounds.
  if(s.events.length>=128){s.events.shift()}
  s.events.push({seq:++s.seq,...event});
 }
 call(s,type,fields={}){
  if(s.closed||s.ws.readyState!==WebSocket.OPEN)return Promise.reject(new Error('Нет связи с видео API HA.'));
  const id=++s.counter;
  return new Promise((resolve,reject)=>{
   const timer=setTimeout(()=>{s.pending.delete(id);reject(new Error('Видео API HA не ответил за 12 секунд.'))},12000);
   s.pending.set(id,{resolve,reject,timer});
   s.ws.send(JSON.stringify({id,type,...fields}));
  });
 }
 async start(id,p,owner){
  this.prune();
  const entity=this.ha.cameraEntity(id,p);
  if(this.sessions.size>=6)throw new Error('Слишком много WebRTC-просмотров.');
  const endpoint=new URL(this.ha.url);endpoint.protocol=endpoint.protocol==='https:'?'wss:':'ws:';
  endpoint.pathname=endpoint.hostname==='supervisor'?'/core/websocket':endpoint.pathname.replace(/\/$/,'')+'/api/websocket';
  const key=randomBytes(24).toString('hex');
  const ws=new WebSocket(endpoint,{headers:{Authorization:`Bearer ${this.ha.token}`},maxPayload:256*1024,followRedirects:false});
  const s={key,owner,id,entity,ws,expires:Date.now()+90000,counter:0,pending:new Map(),events:[],seq:0,closed:false,offered:false,subscription:null,sessionId:null,candidates:0};
  this.sessions.set(key,s);
  try{
   await new Promise((resolve,reject)=>{
    const timer=setTimeout(()=>reject(new Error('Нет связи с WebRTC API HA.')),12000);
    const done=error=>{clearTimeout(timer);error?reject(error):resolve()};
    ws.on('message',bytes=>{
     try{
      const m=JSON.parse(bytes.toString());
      if(m.type==='auth_required')ws.send(JSON.stringify({type:'auth',access_token:this.ha.token}));
      else if(m.type==='auth_invalid')done(new Error('HA отклонил авторизацию WebRTC.'));
      else if(m.type==='auth_ok')done();
      else if(m.type==='result'){
       const request=s.pending.get(m.id);
       if(request){s.pending.delete(m.id);clearTimeout(request.timer);m.success?request.resolve(m.result):request.reject(new Error('HA отклонил запрос WebRTC.'))}
      }else if(m.type==='event'&&m.id===s.subscription){
       const e=m.event;
       if(e?.type==='session'&&typeof e.session_id==='string'&&e.session_id.length<=256){s.sessionId=e.session_id;this.push(s,{type:'session'})}
       else if(e?.type==='answer'&&typeof e.answer==='string'&&e.answer.startsWith('v=0')&&e.answer.length<=131072)this.push(s,{type:'answer',answer:e.answer});
       else if(e?.type==='candidate')this.push(s,{type:'candidate',candidate:candidate(e.candidate)});
       else if(e?.type==='error')this.push(s,{type:'error',message:'Home Assistant не смог подготовить WebRTC-поток.'});
      }
     }catch{this.push(s,{type:'error',message:'Некорректный ответ видео API HA.'})}
    });
    ws.on('error',()=>done(new Error('Нет связи с WebRTC API HA.')));
    ws.on('close',()=>{
     done(new Error('Соединение WebRTC с HA закрыто.'));
     if(!s.closed){
      for(const request of s.pending.values()){clearTimeout(request.timer);request.reject(new Error('Соединение WebRTC с HA закрыто.'))}
      s.pending.clear();this.push(s,{type:'error',message:'Соединение видео API HA закрыто.'});
     }
    });
   });
   const caps=await this.call(s,'camera/capabilities',{entity_id:entity});
   if(!caps?.frontend_stream_types?.includes('web_rtc'))throw new Error('Эта сущность HA не поддерживает WebRTC.');
   const config=clientConfig(await this.call(s,'camera/webrtc/get_client_config',{entity_id:entity}));
   return {key,...config};
  }catch(error){this.close(key);throw error}
 }
 async offer(key,owner,p,offer){
  const s=this.get(key,owner,p);
  if(s.offered)throw new Error('WebRTC offer уже отправлен.');
  if(typeof offer!=='string'||!offer.startsWith('v=0')||offer.length>131072)throw new Error('Неверный WebRTC offer.');
  s.offered=true;s.subscription=s.counter+1;
  await this.call(s,'camera/webrtc/offer',{entity_id:s.entity,offer});return {accepted:true};
 }
 async addCandidate(key,owner,p,value){
  const s=this.get(key,owner,p),c=candidate(value);
  if(!s.sessionId)throw new Error('ICE-сессия ещё не создана.');
  if(++s.candidates>128)throw new Error('Слишком много ICE-кандидатов.');
  await this.call(s,'camera/webrtc/candidate',{entity_id:s.entity,session_id:s.sessionId,candidate:c});return {accepted:true};
 }
 events(key,owner,p,after){
  if(!Number.isSafeInteger(after)||after<0)throw new Error('Неверный курсор WebRTC.');
  const s=this.get(key,owner,p);
  if(after>s.seq||s.events.length&&after<s.events[0].seq-1)throw new Error('WebRTC-сигналы устарели. Открой камеру заново.');
  return {events:s.events.filter(e=>e.seq>after),cursor:s.seq};
 }
}
