import assert from 'node:assert/strict';
import http from 'node:http';
import {usernameTokenEnvelope,onvifWatch} from '../server/yard-onvif.js';

// в”Ђв”Ђ Р®РЅРёС‚: WS-Security UsernameToken digest (РґРµС‚РµСЂРјРёРЅРёСЂРѕРІР°РЅРЅС‹Р№) в”Ђв”Ђ
const env=usernameTokenEnvelope('Mytapo_1','Mkzsqa12!','<x/>','2026-01-01T00:00:00Z','AAAAAAAAAAAAAAAAAAAAAA==');
assert.ok(env.includes('wsse:Security')&&env.includes('wsse:Nonce')&&env.includes('wsu:Created'));
assert.ok(env.includes('<wsse:Username>Mytapo_1</wsse:Username>'));
assert.ok(/PasswordDigest/.test(env)&&env.includes('AAAAAAAAAAAAAAAAAAAAAA=='));

// в”Ђв”Ђ Fake ONVIF SOAP-СЃРµСЂРІРµСЂ в”Ђв”Ђ
const counters={pull:0,renew:0,unsubscribe:0,caps:0,time:0,create:0};
const motionEvery=2; // РєР°Р¶РґС‹Р№ 2-Р№ PullMessage СЃРѕРґРµСЂР¶РёС‚ РґРІРёР¶РµРЅРёРµ
let failPull=false;
const nowUtc=()=>{
 const d=new Date();
 return `<tt:UTCDateTime><tt:Time><tt:Hour>${d.getUTCHours()}</tt:Hour><tt:Minute>${d.getUTCMinutes()}</tt:Minute><tt:Second>${d.getUTCSeconds()}</tt:Second></tt:Time>`
  +`<tt:Date><tt:Year>${d.getUTCFullYear()}</tt:Year><tt:Month>${d.getUTCMonth()+1}</tt:Month><tt:Day>${d.getUTCDate()}</tt:Day></tt:Date></tt:UTCDateTime>`;
};
let port=0;
const server=http.createServer(async(req,res)=>{
 let body='';for await(const c of req)body+=c;
 const ok=payload=>{res.writeHead(200,{'Content-Type':'application/soap+xml; charset=utf-8'});
  res.end('<s:Envelope xmlns:s="http://www.w3.org/2003/05/soap-envelope" xmlns:tt="http://www.onvif.org/ver10/schema"'
  +' xmlns:tev="http://www.onvif.org/ver10/events/wsdl" xmlns:tns1="http://www.onvif.org/ver10/topics" xmlns:tnsx="http://www.q-security.ru/2023/event"><s:Body>'+payload+'</s:Body></s:Envelope>')};
  if(req.url==='/onvif/device_service'||req.url==='/evs'){
  if(body.includes('GetSystemDateAndTime')&&req.url==='/onvif/device_service'){counters.time++;return ok(`<tds:GetSystemDateAndTimeResponse xmlns:tds="http://www.onvif.org/ver10/device/wsdl"><tds:SystemDateAndTime><tt:DateTimeType>NTP</tt:DateTimeType>${nowUtc()}</tt:SystemDateAndTime></tds:GetSystemDateAndTimeResponse>`)}
  if(body.includes('GetCapabilities')&&req.url==='/onvif/device_service'){counters.caps++;
   return ok('<tds:GetCapabilitiesResponse xmlns:tds="http://www.onvif.org/ver10/device/wsdl"><tds:Capabilities><tt:Events><tt:XAddr>http://127.0.0.1:X/evs</tt:XAddr></tt:Events></tds:Capabilities></tds:GetCapabilitiesResponse>'.replaceAll(':X/',`:${port}/`))}
  if(body.includes('CreatePullPointSubscription')){counters.create++;
   return ok('<tev:CreatePullPointSubscriptionResponse><tev:SubscriptionReference><wsa:Address xmlns:wsa="http://www.w3.org/2005/08/addressing">http://127.0.0.1:X/pp</wsa:Address></tev:SubscriptionReference><tev:TerminationTime>2026-01-01T00:05:00Z</tev:TerminationTime></tev:CreatePullPointSubscriptionResponse>'.replaceAll(':X/',`:${port}/`))}
 }
 if(req.url==='/pp'){
  if(body.includes('PullMessages')){counters.pull++;
   if(failPull){res.writeHead(500);return res.end('boom')}
   if(counters.pull%motionEvery)return ok('<tev:PullMessagesResponse><tev:CurrentTime>2026-01-01T00:00:00Z</tev:CurrentTime><tev:TerminationTime>2026-01-01T00:05:00Z</tev:TerminationTime><tev:NotificationMessage/></tev:PullMessagesResponse>');
   // Topic РєР°Рє Сѓ Tapo C320WS: tns1:RuleEngine/tnsx:MotionDetected + SimpleItem IsMotion.
   return ok('<tev:PullMessagesResponse><tev:CurrentTime>2026-01-01T00:00:00Z</tev:CurrentTime><tev:TerminationTime>2026-01-01T00:05:00Z</tev:TerminationTime>'
    +'<tev:NotificationMessage><tev:Topic Dialect="http://www.onvif.org/ver10/tev/topicExpression/ConcreteSet">tns1:RuleEngine/tnsx:MotionDetected</tev:Topic><tev:Message><tt:Source UtcTime="2026-01-01T00:00:00Z"><tt:SimpleItem Name="IsMotion" Value="true"/></tt:Source></tev:Message></tev:NotificationMessage></tev:PullMessagesResponse>')}
  if(body.includes('Renew')){counters.renew++;return ok('<tev:RenewResponse><tev:TerminationTime>2026-01-01T00:05:00Z</tev:TerminationTime></tev:RenewResponse>')}
  if(body.includes('Unsubscribe')){counters.unsubscribe++;return ok('<tev:UnsubscribeResponse/>')}
 }
 res.writeHead(404);res.end();
});
await new Promise(r=>{server.listen(0,'127.0.0.1',()=>{port=server.address().port;r()})});
const host='127.0.0.1';
const T={pullIntervalMs:15,responseTimeoutMs:600,renewIntervalMs:120,retryLimit:3,restartPausesMs:[60,60,60],motionThrottleMs:2000};
const wait=cond=>new Promise(r=>{const i=setInterval(()=>{if(cond()){clearInterval(i);r()}},20)});

// в”Ђв”Ђ РЎС†РµРЅР°СЂРёР№ A: happy path в”Ђв”Ђ
let readyAt=0,motionAt=0,motionCount=0,errorA=null;
const w=onvifWatch({host,port,...T,user:'Mytapo_1',pass:'Mkzsqa12!',
 onReady:()=>{readyAt=Date.now()},onMotion:()=>{motionCount++;motionAt=Date.now()},onError:e=>{errorA=errorA||e}});
await wait(()=>motionCount>0&&counters.renew>0);
assert.ok(readyAt&&readyAt<=motionAt,'onReady СЂР°РЅСЊС€Рµ onMotion');
assert.equal(motionCount,1,'С‚СЂРѕС‚С‚Р»РёРЅРі: СЂРѕРІРЅРѕ 1 onMotion');
assert.ok(counters.time>=1&&counters.caps>=1&&counters.create===1,'probe+caps+create');
assert.ok(counters.pull>=2,'PullMessages С†РёРєР» РёРґС‘С‚');
assert.ok(counters.renew>=1,'Renew РїРѕРґРїРёСЃРєРё РІС‹Р·С‹РІР°РµС‚СЃСЏ');
const st=w.status();
assert.equal(st.alive,true);assert.ok(st.subscription.includes('/pp'));assert.ok(st.eventService.includes('/evs'),'EventXAddr РёР· GetCapabilities');
assert.ok(st.lastMotionAt>0,'lastMotionAt Р·Р°С„РёРєСЃРёСЂРѕРІР°РЅ');
w.stop();
await wait(()=>counters.unsubscribe>0);
assert.ok(counters.unsubscribe>=1,'graceful shutdown в†’ Unsubscribe');
assert.ok(!errorA,'happy path Р±РµР· РѕС€РёР±РѕРє');

// в”Ђв”Ђ РЎС†РµРЅР°СЂРёР№ B: 3 РѕС€РёР±РєРё PullMessages РїРѕРґСЂСЏРґ в†’ onError в”Ђв”Ђ
failPull=true;
const errs=[];let subB=0;
const w2=onvifWatch({host,port,...T,user:'u',pass:'p',
 onReady:()=>{subB++},onMotion:()=>assert.fail('РґРІРёР¶РµРЅРёСЏ РЅРµС‚ РїСЂРё РїР°РґР°СЋС‰РµРј pull'),onError:e=>errs.push(e)});
await wait(()=>errs.length>=1);
assert.ok(subB>=1,'РїРѕРґРїРёСЃРєР° B СЃРѕР·РґР°РЅР°');
assert.ok(counters.pull>=3,'РЅРµ РјРµРЅСЊС€Рµ 3 РїР°РґР°СЋС‰РёС… PullMessages');
assert.ok(w2.status().lastError,'lastError Р·Р°РїРёСЃР°РЅ');
w2.stop();
server.closeAllConnections?.();
server.close();
console.log('yard-onvif: ok');
process.exit(0);
