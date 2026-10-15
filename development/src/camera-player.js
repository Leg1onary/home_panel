import {api,panelURL,assetURL} from './api.js';

let library;
function loadHls(){
 if(window.HomePanelHls)return Promise.resolve(window.HomePanelHls);
 if(!library)library=new Promise((resolve,reject)=>{
  const script=document.createElement('script');script.src=assetURL('assets/hls-player.js');
  script.onload=()=>window.HomePanelHls?resolve(window.HomePanelHls):reject(new Error('Не загрузился видеоплеер.'));
  script.onerror=()=>{script.remove();library=null;reject(new Error('Не загрузился видеоплеер. Перезагрузи панель.'))};
  document.head.appendChild(script);
 });
 return library;
}
export function startCameraPlayer(id,video,status){
 let disposed=false,session=null,hls=null,timer,stalledTimer,engine='подключение',codec='',recoveries=0,recoveryTimer,recovering=false;
 const message=text=>{if(!disposed)status.textContent=text};
 const diagnostic=()=>`${engine}${codec?' · '+codec:''}${video.videoWidth?' · '+video.videoWidth+'×'+video.videoHeight:''}`;
 const fail=text=>{if(disposed)return;message(text+' ['+diagnostic()+'] Можно повторить запуск или получить снимок.');cleanup()};
 const release=key=>api('ha/stream/'+key,{method:'DELETE'}).catch(()=>{});
 const cleanup=()=>{
  if(disposed)return;disposed=true;clearTimeout(timer);clearTimeout(stalledTimer);clearTimeout(recoveryTimer);
  if(hls)hls.destroy();video.pause();video.removeAttribute('src');video.load();
  if(session)release(session.key);
 };
 const playback=()=>{
  if(disposed)return;
  const result=video.play();
  if(result&&result.catch)result.catch(()=>message('Нажми ▶ на видео для начала просмотра.'));
 };
 const playing=()=>{recovering=false;clearTimeout(timer);clearTimeout(stalledTimer);clearTimeout(recoveryTimer);message('Прямой эфир · '+diagnostic()+' · возможна задержка')};
 const waiting=()=>{message('Буферизация видео…');clearTimeout(stalledTimer);stalledTimer=setTimeout(()=>fail('Поток перестал обновляться.'),25000)};
 const recover=()=>{
  if(disposed||!hls||recoveries)return false;
  recoveries++;recovering=true;message('Перезапускаем видеодекодер · '+diagnostic());
  // One bounded recovery, not an endless flashing/reconnect loop.
  recoveryTimer=setTimeout(()=>{
   if(disposed)return;
   try{hls.recoverMediaError();timer=setTimeout(()=>fail('После восстановления видео не запустилось.'),15000)}
   catch{fail('Не удалось восстановить видеодекодер.')}
  },200);
  return true;
 };
 const videoError=()=>{
  const code=video.error?.code;
  if(code===3&&recover())return;
  if(code===3&&recovering)return;
  const label=({1:'Просмотр прерван',2:'Ошибка загрузки видео',3:'Ошибка декодирования видео',4:'Формат видео не поддерживается'})[code]||'Не удалось воспроизвести видео';
  fail(label+' (MediaError '+(code||'неизвестен')+').');
 };
 video.addEventListener('playing',playing);video.addEventListener('waiting',waiting);video.addEventListener('error',videoError);
 message('Подключаем прямой эфир…');
 const ready=(async()=>{
  try{
   const nativeSupport=!!video.canPlayType('application/vnd.apple.mpegurl');
   let Hls;
   try{Hls=await loadHls()}catch(error){if(!nativeSupport)throw error}
   if(disposed)return;
   // canPlayType may return "maybe" while the native HLS implementation fails.
   // Prefer MSE/HLS.js whenever available; native HLS is a last capability fallback.
   const mse=!!Hls&&Hls.isSupported();
   if(!mse&&!nativeSupport)throw new Error('Этот WebView не поддерживает HLS-видео. Обнови WebView или используй снимок.');
   engine=mse?'HLS.js':'встроенный HLS';
   session=await api('ha/stream/start',{method:'POST',body:{id}});
   if(disposed){release(session.key);return}
   timer=setTimeout(()=>fail('Видео не началось за 30 секунд.'),30000);
   const source=panelURL(session.url);
   if(!mse){video.src=source;video.addEventListener('loadedmetadata',playback,{once:true});playback()}
   else{
    hls=new Hls({lowLatencyMode:false,maxBufferLength:10,backBufferLength:0,enableWorker:false});
    hls.on(Hls.Events.MANIFEST_PARSED,(_,data)=>{
     const value=data.levels?.[0]?.videoCodec;
     if(typeof value==='string'&&/^[a-zA-Z0-9.,_-]{1,64}$/.test(value))codec=value;
     playback();
    });
    hls.on(Hls.Events.ERROR,(_,data)=>{
     if(!data.fatal||disposed)return;
     if(data.type===Hls.ErrorTypes.MEDIA_ERROR){
      if(recover()||recovering)return;
     }
     const detail=/^[a-zA-Z0-9_-]{1,80}$/.test(data.details||'')?data.details:'unknown';
     fail(`Ошибка видеопотока (${detail}). Проверь эту сущность в HA на том же устройстве.`);
    });
    hls.loadSource(source);hls.attachMedia(video);
   }
  }catch(error){fail(error.message)}
 })();
 return {ready,stop(){
  video.removeEventListener('playing',playing);video.removeEventListener('waiting',waiting);video.removeEventListener('error',videoError);
  cleanup();
 }};
}
