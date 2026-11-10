// Headless QA волны D 3.2.3: брифинг сверху дайджеста. Live 8080 + fake HA:
// погода, 2 включённых света, дверь приоткрыта, камера двора; клипы через
// test-хук yard-clips-capture. Проверки: .digest-brief с прогнозом/светом,
// двор-пункт кликабелен → открывается щиток камеры двора, демо не сломан.
import {chromium} from 'playwright-core';
import http from 'node:http';
import {spawn} from 'node:child_process';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import jpeg from 'jpeg-js';
import {WebSocketServer} from 'ws';
const gray=v=>jpeg.encode({data:Buffer.alloc(320*180*4,v),width:320,height:180},80).data;
let cam=gray(100);
const states=[
 {entity_id:'weather.home',state:'cloudy',attributes:{temperature:7.3,humidity:60}},
 {entity_id:'light.gostinaia_levyi_vykliuchatel',state:'on',attributes:{}},
 {entity_id:'light.gostinaia_pravyi_vykliuchatel',state:'on',attributes:{}},
 {entity_id:'binary_sensor.dver',state:'on',attributes:{device_class:'door'}},
 {entity_id:'sensor.schetchik_tns_reading',state:'12345.6',attributes:{unit_of_measurement:'кВт·ч'},last_updated:new Date().toISOString(),last_reported:new Date().toISOString()},
 {entity_id:'camera.mock',state:'idle',attributes:{}}
];
const fake=http.createServer((req,res)=>{
 if(req.headers.authorization!=='Bearer mock-test-only'){res.writeHead(401);return res.end('{}')}
 if(req.url==='/api/states')return res.end(JSON.stringify(states));
 if(req.url==='/api/services/weather/get_forecasts'){
  res.writeHead(200,{'Content-Type':'application/json'});
  return res.end(JSON.stringify({service_response:{'weather.home':{forecast:[
   {datetime:new Date().toISOString(),condition:'cloudy',temperature:7.3,templow:3},
   {datetime:new Date(Date.now()+86400000).toISOString(),condition:'rainy',temperature:5}]}}}));
 }
 if(req.url?.startsWith('/api/history/period/'))return res.end(JSON.stringify([[{state:'12345.6',last_updated:new Date().toISOString()}]]));
 if(req.url?.startsWith('/api/camera_proxy/camera.mock')){res.setHeader('Content-Type','image/jpeg');return res.end(cam)}
 res.writeHead(404);res.end('{}');
});
await new Promise(r=>fake.listen(9997,'127.0.0.1',r));
// WebSocket fake для callService (weather.get_forecasts), как требует server/ha.js.
const wss=new WebSocketServer({noServer:true});
fake.on('upgrade',(req,socket,head)=>{
 wss.handleUpgrade(req,socket,head,ws=>{
  ws.send(JSON.stringify({type:'auth_required'}));
  ws.on('message',raw=>{
   const msg=JSON.parse(String(raw));
   if(msg.type==='auth')return ws.send(JSON.stringify({type:'auth_ok',ha_version:'2026.10.0'}));
   if(msg.type==='call_service')return ws.send(JSON.stringify({id:msg.id,type:'result',success:true,result:{response:{'weather.home':{forecast:[
    {datetime:new Date().toISOString(),condition:'cloudy',temperature:7.3,templow:3},
    {datetime:new Date(Date.now()+86400000).toISOString(),condition:'rainy',temperature:5}]}}}}));
  });
 });
});
const dir=await mkdtemp(join(tmpdir(),'brief-qa-'));
const child=spawn(process.execPath,['release/server.mjs'],{cwd:resolve('.'),env:{...process.env,PANEL_DATA:dir,HA_URL:'http://127.0.0.1:9997',HA_TOKEN:'mock-test-only',PANEL_PREVIEW:'0',PANEL_TEST_HOOKS:'1'},stdio:['ignore','pipe','pipe']});
await new Promise((res2,rej)=>{const t=setTimeout(()=>rej(new Error('startup timeout')),10000);child.stdout.on('data',b=>{if(String(b).includes('Panel ready')){clearTimeout(t);res2()}});child.once('exit',()=>{clearTimeout(t);rej(new Error('exited'))})});
const api=async(path,opts={})=>{const r=await fetch('http://127.0.0.1:8080/api/panel/'+path,{method:opts.method||'GET',headers:{'Content-Type':'application/json',...(opts.proof?{'X-Panel-Proof':opts.proof}:{})},...(opts.body===undefined?{}:{body:JSON.stringify(opts.body)})});return{status:r.status,body:await r.json().catch(()=>null)}};
let ok=true;
try{
 const boot=await api('bootstrap');const proof=boot.body.proof;
 let p=boot.body.preferences;p.mode='live';
 p.bindings['living:0']={entityId:'light.gostinaia_levyi_vykliuchatel',verified:true};
 p.bindings['living:1']={entityId:'light.gostinaia_pravyi_vykliuchatel',verified:true};
 p.bindings['door']={entityId:'binary_sensor.dver',verified:true};
 p.bindings['camera-yard']={entityId:'camera.mock',verified:true};
 // Сейчас вне «дневного» окна → выставляем расписание так, чтобы 00:26 MSK было днём
 // (иначе прогноз скрыт по дизайну ночного режима).
 p.nightStart='05:00';p.nightEnd='05:01';p.nightMode='auto';
 await api('preferences',{method:'PUT',proof,body:p});
 const browser=await chromium.launch({channel:'msedge',headless:true});
 const page=await browser.newPage({viewport:{width:1280,height:800}});
 const errors=[];
 page.on('pageerror',e=>errors.push('pageerror: '+e.message+' | '+(e.stack||'').split('\n').slice(0,3).join(' ~ ')));
 page.on('console',m=>{if(m.type()==='error')errors.push('console: '+m.text())});
 page.on('response',r=>{if(r.status()>=400)errors.push('HTTP '+r.status()+' '+r.url())});
 await page.goto('http://127.0.0.1:8080/',{waitUntil:'networkidle',timeout:30000});
 await page.waitForTimeout(4000);
 const brief=await page.evaluate(()=>document.querySelector('.digest-brief')?.textContent||'(none)');
 console.log('brief:',brief);
 if(!brief.includes('Сегодня:')||!brief.includes('Свет горит: 2')){ok=false;console.log('FAIL: brief text')}
 // Клипы двора через test-хук, затем двор-пункт появляется и кликается.
 await api('ha/yard-motion');
 const cap=await api('yard-clips-capture',{method:'POST',proof,body:{}});
 console.log('capture:',cap.status,JSON.stringify(cap.body));
 const energy=await api('ha/energy');
 console.log('energy probe:',energy.status,JSON.stringify(energy.body).slice(0,200));
 const fc=await api('ha/weather-forecast?entity=weather.home');
 console.log('forecast probe:',fc.status,JSON.stringify(fc.body).slice(0,200));
 await page.waitForTimeout(3000);
 const yardBtn=page.locator('.digest-brief-item.is-action');
 if(!await yardBtn.count()){ // SSE мог не дойти — перезагрузка: модульный кеш сбрасывается.
  await page.reload({waitUntil:'networkidle'});await page.waitForTimeout(4000);
 }
 const yardCount=await yardBtn.count();
 console.log('yard brief item:',yardCount,await page.evaluate(()=>document.querySelector('.digest-brief')?.textContent));
 if(!yardCount){ok=false;console.log('FAIL: no yard brief item')}
 else{
  await yardBtn.first().click();
  await page.waitForTimeout(2000);
  const sheet=await page.evaluate(()=>document.querySelector('.sheet h2')?.textContent||'(none)');
  console.log('yard sheet:',sheet);
  if(!sheet||sheet==='(none)'){ok=false;console.log('FAIL: yard sheet not opened')}
 }
 console.log('errors:',errors.length?errors:'none');
 const hard=errors.filter(e=>e.startsWith('pageerror')||(e.startsWith('HTTP')&&!e.includes('/ha/energy')&&!e.includes('/ha/rtc')&&!e.includes('/ha/stream')));
 if(hard.length)ok=false;
 await browser.close();
}catch(error){ok=false;console.error('QA FAIL:',error.message)}
child.kill('SIGTERM');
await new Promise(r=>child.once('exit',r));
try{await rm(dir,{recursive:true,force:true})}catch{}
console.log(ok?'QA OK':'QA FAILED');
process.exitCode=ok?0:1;
fake.close();
process.exit(process.exitCode);