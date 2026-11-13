import assert from 'node:assert/strict';
import http from 'node:http';
import {usernameTokenEnvelope,onvifWatch} from '../server/yard-onvif.js';

// РІвЂќР‚РІвЂќР‚ Р В®Р Р…Р С‘РЎвЂљ: WS-Security UsernameToken digest (Р Т‘Р ВµРЎвЂљР ВµРЎР‚Р СР С‘Р Р…Р С‘РЎР‚Р С•Р Р†Р В°Р Р…Р Р…РЎвЂ№Р в„–) РІвЂќР‚РІвЂќР‚
const env=usernameTokenEnvelope('Mytapo_1','test-camera-pass','<x/>','2026-01-01T00:00:00Z','AAAAAAAAAAAAAAAAAAAAAA==');
assert.ok(env.includes('wsse:Security')&&env.includes('wsse:Nonce')&&env.includes('wsu:Created'));
assert.ok(env.includes('<wsse:Username>Mytapo_1</wsse:Username>'));
assert.ok(/PasswordDigest/.test(env)&&env.includes('AAAAAAAAAAAAAAAAAAAAAA=='));

// РІвЂќР‚РІвЂќР‚ Fake ONVIF SOAP-РЎРѓР ВµРЎР‚Р Р†Р ВµРЎР‚ РІвЂќР‚РІвЂќР‚
const counters={pull:0,renew:0,unsubscribe:0,caps:0,time:0,create:0};
const motionEvery=2; // Р С”Р В°Р В¶Р Т‘РЎвЂ№Р в„– 2-Р в„– PullMessage РЎРѓР С•Р Т‘Р ВµРЎР‚Р В¶Р С‘РЎвЂљ Р Т‘Р Р†Р С‘Р В¶Р ВµР Р…Р С‘Р Вµ
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
   // Topic Р С”Р В°Р С” РЎС“ Tapo C320WS: tns1:RuleEngine/tnsx:MotionDetected + SimpleItem IsMotion.
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

// РІвЂќР‚РІвЂќР‚ Р РЋРЎвЂ Р ВµР Р…Р В°РЎР‚Р С‘Р в„– A: happy path РІвЂќР‚РІвЂќР‚
let readyAt=0,motionAt=0,motionCount=0,errorA=null;
const w=onvifWatch({host,port,...T,user:'Mytapo_1',pass:'test-camera-pass',
 onReady:()=>{readyAt=Date.now()},onMotion:()=>{motionCount++;motionAt=Date.now()},onError:e=>{errorA=errorA||e}});
await wait(()=>motionCount>0&&counters.renew>0);
assert.ok(readyAt&&readyAt<=motionAt,'onReady РЎР‚Р В°Р Р…РЎРЉРЎв‚¬Р Вµ onMotion');
assert.equal(motionCount,1,'РЎвЂљРЎР‚Р С•РЎвЂљРЎвЂљР В»Р С‘Р Р…Р С–: РЎР‚Р С•Р Р†Р Р…Р С• 1 onMotion');
assert.ok(counters.time>=1&&counters.caps>=1&&counters.create===1,'probe+caps+create');
assert.ok(counters.pull>=2,'PullMessages РЎвЂ Р С‘Р С”Р В» Р С‘Р Т‘РЎвЂРЎвЂљ');
assert.ok(counters.renew>=1,'Renew Р С—Р С•Р Т‘Р С—Р С‘РЎРѓР С”Р С‘ Р Р†РЎвЂ№Р В·РЎвЂ№Р Р†Р В°Р ВµРЎвЂљРЎРѓРЎРЏ');
const st=w.status();
assert.equal(st.alive,true);assert.ok(st.subscription.includes('/pp'));assert.ok(st.eventService.includes('/evs'),'EventXAddr Р С‘Р В· GetCapabilities');
assert.ok(st.lastMotionAt>0,'lastMotionAt Р В·Р В°РЎвЂћР С‘Р С”РЎРѓР С‘РЎР‚Р С•Р Р†Р В°Р Р…');
w.stop();
await wait(()=>counters.unsubscribe>0);
assert.ok(counters.unsubscribe>=1,'graceful shutdown РІвЂ вЂ™ Unsubscribe');
assert.ok(!errorA,'happy path Р В±Р ВµР В· Р С•РЎв‚¬Р С‘Р В±Р С•Р С”');

// РІвЂќР‚РІвЂќР‚ Р РЋРЎвЂ Р ВµР Р…Р В°РЎР‚Р С‘Р в„– B: 3 Р С•РЎв‚¬Р С‘Р В±Р С”Р С‘ PullMessages Р С—Р С•Р Т‘РЎР‚РЎРЏР Т‘ РІвЂ вЂ™ onError РІвЂќР‚РІвЂќР‚
failPull=true;
const errs=[];let subB=0;
const w2=onvifWatch({host,port,...T,user:'u',pass:'p',
 onReady:()=>{subB++},onMotion:()=>assert.fail('Р Т‘Р Р†Р С‘Р В¶Р ВµР Р…Р С‘РЎРЏ Р Р…Р ВµРЎвЂљ Р С—РЎР‚Р С‘ Р С—Р В°Р Т‘Р В°РЎР‹РЎвЂ°Р ВµР С pull'),onError:e=>errs.push(e)});
await wait(()=>errs.length>=1);
assert.ok(subB>=1,'Р С—Р С•Р Т‘Р С—Р С‘РЎРѓР С”Р В° B РЎРѓР С•Р В·Р Т‘Р В°Р Р…Р В°');
assert.ok(counters.pull>=3,'Р Р…Р Вµ Р СР ВµР Р…РЎРЉРЎв‚¬Р Вµ 3 Р С—Р В°Р Т‘Р В°РЎР‹РЎвЂ°Р С‘РЎвЂ¦ PullMessages');
assert.ok(w2.status().lastError,'lastError Р В·Р В°Р С—Р С‘РЎРѓР В°Р Р…');
w2.stop();
server.closeAllConnections?.();
server.close();
console.log('yard-onvif: ok');
process.exit(0);
