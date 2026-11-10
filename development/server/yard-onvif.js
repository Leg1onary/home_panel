// ONVIF-детектор движения камеры (Tapo C320WS): события железа вместо jpeg-диффа.
// Минимальный SOAP-клиент без внешних зависимостей: WS-Security UsernameToken digest
// (nonce base64 + created ISO UTC + base64(sha1(raw nonce + created + password))),
// PullPoint-подписка, PullMessages-цикл, Renew, ретраи с экспоненциальной паузой.
// XML разбирается namespace-независимыми строковыми метками (MotionDetected|MotionAlarm|IsMotion).
import {createHash,randomBytes} from 'node:crypto';

const WSSE='http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-secext-1.0.xsd';
const WSU='http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-wssecurity-utility-1.0.xsd';
const DIGEST_DEFAULTS={pullIntervalMs:1000,responseTimeoutMs:6000,renewIntervalMs:2*60*1000,retryLimit:3,
 restartPausesMs:[5000,15000,60000],motionThrottleMs:2000};

const enc=s=>String(s).replace(/&/g,'&amp;').replace(/</g,'&lt;').replace(/>/g,'&gt;');
export function usernameTokenEnvelope(user,pass,bodyXml,created,nonceB64){
 const raw=Buffer.from(nonceB64,'base64');
 const digest=createHash('sha1').update(Buffer.concat([raw,Buffer.from(created,'utf8'),Buffer.from(pass,'utf8')])).digest('base64');
 return `<s:Envelope xmlns:s="http://www.w3.org/2003/05/soap-envelope" xmlns:wsse="${WSSE}" xmlns:wsu="${WSU}">`
  +'<s:Header><wsse:Security s:mustUnderstand="1"><wsse:UsernameToken>'
  +`<wsse:Username>${enc(user)}</wsse:Username>`
  +`<wsse:Password Type="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-username-token-profile-1.0#PasswordDigest">${digest}</wsse:Password>`
  +`<wsse:Nonce EncodingType="http://docs.oasis-open.org/wss/2004/01/oasis-200401-wss-soap-message-security-1.0#Base64Binary">${nonceB64}</wsse:Nonce>`
  +`<wsu:Created>${created}</wsu:Created></wsse:UsernameToken></wsse:Security></s:Header>`
  +`<s:Body>${bodyXml}</s:Body></s:Envelope>`;
}

export async function soapPost(url,bodyXml,{user,pass},timeoutMs=5000,{created,nonce}={}){
 const body=usernameTokenEnvelope(user,pass,bodyXml,created||new Date().toISOString(),nonce||randomBytes(16).toString('base64'));
 const ctrl=new AbortController(),timer=setTimeout(()=>ctrl.abort(),timeoutMs);
 try{
  const res=await fetch(url,{method:'POST',signal:ctrl.signal,headers:{
   'Content-Type':'application/soap+xml; charset=utf-8','Content-Length':String(Buffer.byteLength(body))},body});
  const text=await res.text();
  if(!res.ok)throw new Error(`SOAP ${res.status} ${url}: ${text.slice(0,200)}`);
  if(/:Fault[\s>]|<Fault[\s>]/.test(text.slice(0,4000)))throw new Error(`SOAP Fault: ${text.replace(/\s+/g,' ').slice(0,300)}`);
  return text;
 }finally{clearTimeout(timer)}
}

// GetSystemDateAndTime без авторизации: живость камеры + offset часов для digest created.
async function probeDeviceTime(url,creds,timeoutMs){
 const body='<tds:GetSystemDateAndTime xmlns:tds="http://www.onvif.org/ver10/device/wsdl"/>';
 const text=await soapPost(url,body,creds,timeoutMs);
 const tag=text.match(/<[\w:.-]*UTCDateTime[\s\S]{0,400}?<\/[\w:.-]*UTCDateTime>/)?.[0];
 let offset=0;
 if(tag){
  const num=k=>Number(tag.match(new RegExp(`<[^>]*:${k}>(-?\\d+)</`))?.[1]??NaN);
  const h=num('Hour'),m=num('Minute'),s=num('Second'),y=num('Year'),mo=num('Month'),d=num('Day');
  if([h,m,s,y,mo,d].every(Number.isFinite)){
   const cam=new Date(Date.UTC(y,mo-1,d,h,m,s,0)).getTime();
   const local=new Date(Date.UTC(new Date().getUTCFullYear(),new Date().getUTCMonth(),new Date().getUTCDate(),
    new Date().getUTCHours(),new Date().getUTCMinutes(),new Date().getUTCSeconds(),0)).getTime();

   offset=cam-local;
  }
 }
 return {offset};
}

export function onvifWatch({host,port=2020,user,pass,onMotion,onError,onReady,log=()=>{},...timing}={}){
 const t={...DIGEST_DEFAULTS,...timing};
 let stopped=false,restarts=0,pullFailures=0;
 let status={alive:false,eventService:null,subscription:null,lastMotionAt:0,lastError:null};
 const state=()=>({...status,alive:!stopped&&status.alive,restarts});
 const controller={status:state,stop:()=>{stopped=true;status={...status,alive:false}}};
 const fail=error=>{status={...status,alive:false,lastError:String(error?.message||error).slice(0,300)};onError?.(error)};
 (async()=>{
  const base=`http://${host}:${port}`;
  let deviceService=base+'/onvif/device_service';
  // Экспоненциальные паузы между полными рестартами: 5с, 15с, 60с, дальше 60с.
  while(!stopped){
   let pullPoint=null,offset=0;
   try{
    ({offset}=await probeDeviceTime(deviceService,{user,pass},t.responseTimeoutMs));
    const creds={user,pass},opts=()=>({created:new Date(Date.now()+offset).toISOString()});
    // GetCapabilities: ищем EventXAddr (или XAddr внутри блока Events) в ответе.
    const caps=await soapPost(deviceService,
     '<tds:GetCapabilities xmlns:tds="http://www.onvif.org/ver10/device/wsdl"><tds:Category>Device</tds:Category></tds:GetCapabilities>',
     creds,t.responseTimeoutMs,opts());
    const eventAddr=caps.match(/EventXAddr[^>]*>([^<]+)</)?.[1]
     ||caps.match(/<[^>]*Events[^>]*>[\s\S]{0,600}?<[^>]*XAddr[^>]*>(https?:\/\/[^<]+)</)?.[1];
    if(eventAddr)deviceService=eventAddr;
    status={...status,eventService:deviceService};
    // CreatePullPointSubscription: TopicExpression по умолчанию (без фильтра тем).
    const sub=await soapPost(deviceService,
     '<tev:CreatePullPointSubscription xmlns:tev="http://www.onvif.org/ver10/events/wsdl"/>',
     creds,t.responseTimeoutMs,opts());
    pullPoint=sub.match(/SubscriptionReference[\s\S]{0,800}?Address[^>]*>([^<]+)</)?.[1]
     ||sub.match(/https?:\/\/[^<\s"]+/)?.[0];
    if(!pullPoint)throw new Error('PullPoint address not found in CreatePullPointSubscription response');
    status={...status,subscription:pullPoint,alive:true,lastError:null};
    pullFailures=0;restarts=0;
    onReady?.({eventService:deviceService,subscription:pullPoint});
    let lastMotion=0,lastRenew=Date.now();
    // Цикл PullMessages: сразу новый запрос после ответа (Timeout PT5S, MessageLimit 10).
    while(!stopped){
     let text=null,error=null;
     try{text=await soapPost(pullPoint,
      '<tev:PullMessages xmlns:tev="http://www.onvif.org/ver10/events/wsdl">'
      +'<tev:Timeout>PT5S</tev:Timeout><tev:MessageLimit>10</tev:MessageLimit></tev:PullMessages>',
      creds,t.responseTimeoutMs,opts())}
     catch(e){error=e}
     if(stopped)break;
     if(error){
      pullFailures++;status={...status,lastError:String(error?.message||error).slice(0,300)};
      log('pull failure',pullFailures,error?.message);
      if(pullFailures>=t.retryLimit){fail(error);break}
      await sleep(Math.min(1000,t.responseTimeoutMs));continue;
     }
     pullFailures=0;
     // Движение: topic/data содержит MotionDetected|MotionAlarm или SimpleItem IsMotion=true.
     if(/MotionDetected|MotionAlarm/.test(text)||/IsMotion[^>]*>\s*(true|1)\s*</i.test(text)){
      const now=Date.now();
      status={...status,lastMotionAt:now};
      if(now-lastMotion>=t.motionThrottleMs){lastMotion=now;onMotion?.()}
     }
     if(Date.now()-lastRenew>=t.renewIntervalMs){
      lastRenew=Date.now();
      try{await soapPost(pullPoint,
       '<tev:Renew xmlns:tev="http://www.onvif.org/ver10/events/wsdl"><tev:TerminationTime>PT5M</tev:TerminationTime></tev:Renew>',
       creds,t.responseTimeoutMs,opts())}
      catch(e){status={...status,lastError:'renew: '+String(e?.message||e).slice(0,250)}}
     }
     await sleep(t.pullIntervalMs);
    }
   }catch(error){fail(error)}
   // Graceful shutdown: Unsubscribe до выхода. Затем экспоненциальная пауза до нового рестарта.
   if(pullPoint)await unsubscribe(pullPoint,{user,pass},t);
   if(stopped)break;
   const pause=t.restartPausesMs[Math.min(restarts,t.restartPausesMs.length-1)];
   restarts++;log('restart',restarts,'pause',pause);
   for(let waited=0;waited<pause&&!stopped;waited+=250)await sleep(Math.min(250,pause-waited));
  }
 })();
 return controller;
}
async function unsubscribe(pullPoint,creds,t){
 try{await soapPost(pullPoint,'<tev:Unsubscribe xmlns:tev="http://www.onvif.org/ver10/events/wsdl"/>',creds,t.responseTimeoutMs,{})}catch{}
}
const sleep=ms=>new Promise(r=>setTimeout(r,ms));
export {DIGEST_DEFAULTS as ONVIF_DEFAULTS};
