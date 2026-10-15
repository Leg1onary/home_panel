import {api} from './api.js';
import {frameLoss} from './camera-policy.js';
import {startHlsCameraPlayer} from './hls-camera-player.js';

export function startCameraPlayer(id,video,status,{transport='auto'}={}){
 let stopped=false,rtcClosed=false,session,peer,stream,hls,pollTimer,startTimer,statsTimer,disconnectTimer,cursor=0,sessionReady=false,answered=false,flushing=false;
 const local=[],remote=[];
 const message=text=>{if(!stopped)status.textContent=text};
 const cleanupRTC=()=>{
  if(rtcClosed)return;rtcClosed=true;
  clearTimeout(pollTimer);clearTimeout(startTimer);clearTimeout(disconnectTimer);clearInterval(statsTimer);
  video.removeEventListener('playing',playing);video.removeEventListener('waiting',waiting);
  if(peer){peer.onicecandidate=null;peer.ontrack=null;peer.onconnectionstatechange=null;peer.close()}
  stream?.getTracks().forEach(t=>t.stop());video.pause();video.srcObject=null;video.removeAttribute('src');video.load();
  if(session)api('ha/rtc/'+session.key,{method:'DELETE'}).catch(()=>{});
 };
 const fallback=reason=>{
  if(stopped||hls)return;
  cleanupRTC();
  const notice=reason?'Резерв HLS: '+reason+' · ':'';
  hls=startHlsCameraPlayer(id,video,{set textContent(text){message(notice+text)}});
 };
 const play=()=>{
  if(stopped||rtcClosed)return;
  const result=video.play();result?.catch(()=>message('WebRTC подключён. Нажми ▶ на видео.'));
 };
 const playing=()=>{if(stopped||rtcClosed)return;clearTimeout(startTimer);message(`Прямой эфир · WebRTC · ${video.videoWidth}×${video.videoHeight} · пропущено кадров ${frameLoss(video)}`)};
 const waiting=()=>message('WebRTC · ожидаем видеоданные…');
 const flushLocal=async()=>{
  if(flushing||!sessionReady||stopped||rtcClosed)return;flushing=true;
  try{while(local.length&&!stopped&&!rtcClosed)await api('ha/rtc/'+session.key+'/candidate',{method:'POST',body:{candidate:local.shift()}})}
  catch{fallback('не удалось передать ICE-кандидат')}
  finally{flushing=false}
 };
 const addRemote=async c=>{
  if(stopped||rtcClosed)return;
  await peer.addIceCandidate(c.sdpMid!=null||c.sdpMLineIndex!=null?c:{...c,sdpMid:'0'});
 };
 const poll=async()=>{
  if(stopped||rtcClosed)return;
  try{
   const result=await api('ha/rtc/'+session.key+'/events?after='+cursor);
   if(stopped||rtcClosed)return;
   for(const e of result.events){
    if(stopped||rtcClosed)return;
    if(e.type==='session'){sessionReady=true;flushLocal()}
    else if(e.type==='answer'){
     if(!answered){await peer.setRemoteDescription({type:'answer',sdp:e.answer});answered=true;
      while(remote.length&&!stopped&&!rtcClosed)await addRemote(remote.shift())}
    }else if(e.type==='candidate'){
     if(answered)await addRemote(e.candidate);else remote.push(e.candidate);
    }else if(e.type==='error'){fallback('HA не подготовил WebRTC');return}
   }
   cursor=result.cursor;
   if(!stopped&&!rtcClosed)pollTimer=setTimeout(poll,500);
  }catch{fallback('сигнальный канал WebRTC недоступен')}
 };
 const ready=(async()=>{
  if(transport==='hls'){fallback('');await hls.ready;return}
  if(typeof RTCPeerConnection==='undefined'||typeof MediaStream==='undefined'){fallback('WebRTC не поддерживается браузером');await hls.ready;return}
  message('Проверяем WebRTC камеры…');
  startTimer=setTimeout(()=>fallback('WebRTC не подключился за 20 секунд'),20000);
  try{
   let created;
   try{created=await api('ha/rtc/start',{method:'POST',body:{id}})}
   catch(error){fallback(error.message?.includes('не поддерживает')?'HA не предоставляет WebRTC для этой сущности':'WebRTC API HA недоступен');return}
   if(stopped||rtcClosed){api('ha/rtc/'+created.key,{method:'DELETE'}).catch(()=>{});return}
   session=created;peer=new RTCPeerConnection(created.configuration);
   if(created.dataChannel)peer.createDataChannel(created.dataChannel);
   stream=new MediaStream();
   peer.ontrack=e=>{
    if(stopped||rtcClosed)return;
    if(e.track.kind==='audio'&&video.muted)return;
    stream.addTrack(e.track);video.srcObject=stream;play();
   };
   peer.onicecandidate=e=>{
    if(!e.candidate?.candidate||stopped||rtcClosed)return;
    if(local.length>=128){fallback('слишком много ICE-кандидатов');return}
    local.push(e.candidate.toJSON());flushLocal();
   };
   peer.onconnectionstatechange=()=>{
    if(stopped||rtcClosed)return;
    if(peer.connectionState==='failed'){fallback('нет маршрута WebRTC до камеры');return}
    if(peer.connectionState==='disconnected'){
     clearTimeout(disconnectTimer);disconnectTimer=setTimeout(()=>fallback('соединение WebRTC потеряно'),8000);
    }else clearTimeout(disconnectTimer);
   };
   video.addEventListener('playing',playing);video.addEventListener('waiting',waiting);
   statsTimer=setInterval(()=>{if(!stopped&&!rtcClosed&&!video.paused&&video.readyState>=2)playing()},1000);
   peer.addTransceiver('audio',{direction:'recvonly'});peer.addTransceiver('video',{direction:'recvonly'});
   const offer=await peer.createOffer();
   if(stopped||rtcClosed)return;
   await peer.setLocalDescription(offer);
   if(stopped||rtcClosed)return;
   await api('ha/rtc/'+session.key+'/offer',{method:'POST',body:{offer:offer.sdp}});
   if(stopped||rtcClosed)return;
   message('WebRTC · устанавливаем соединение…');poll();
  }catch{if(!stopped&&!rtcClosed)fallback('WebRTC недоступен для этой камеры')}
 })();
 return {ready,stop(){if(stopped)return;stopped=true;cleanupRTC();hls?.stop()}};
}
