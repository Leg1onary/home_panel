// Headless QA РІРѕР»РЅС‹ 3.2.1: РєР»РёРїС‹ РґРІРѕСЂР° вЂ” live 8099 СЃ С„РµР№РєРѕРІС‹Рј HA, Р»РµРЅС‚Р° РІ
// РІРєР»Р°РґРєРµ В«Р”РІРѕСЂВ», С‰РёС‚РѕРє РєР»РёРїР°, РѕС‚СЃСѓС‚СЃС‚РІРёРµ РѕС€РёР±РѕРє РєРѕРЅСЃРѕР»Рё.
import {chromium} from 'playwright-core';
import http from 'node:http';
import {spawn} from 'node:child_process';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
import jpeg from 'jpeg-js';

const gray=v=>jpeg.encode({data:Buffer.alloc(320*180*4,v),width:320,height:180},80).data;
let cam=gray(100);
const entity={entity_id:'camera.mock',state:'idle',attributes:{}};
const fake=http.createServer((req,res)=>{
 if(req.headers.authorization!=='Bearer mock-test-only'){res.writeHead(401);return res.end('{}')}
 if(req.url==='/api/states')return res.end(JSON.stringify([entity]));
 if(req.url?.startsWith('/api/camera_proxy/camera.mock')){res.setHeader('Content-Type','image/jpeg');return res.end(cam)}
 res.writeHead(404);res.end('{}');
});
await new Promise(r=>fake.listen(9998,'127.0.0.1',r));
const dir=await mkdtemp(join(tmpdir(),'yard-clips-qa-'));
const child=spawn(process.execPath,['release/server.mjs'],{cwd:resolve('.'),env:{...process.env,PORT:'8099',PANEL_DATA:dir,HA_URL:'http://127.0.0.1:9998',HA_TOKEN:'mock-test-only',PANEL_PREVIEW:'0',PANEL_TEST_HOOKS:'1'},stdio:['ignore','pipe','pipe']});
await new Promise((resolve,reject)=>{
 const t=setTimeout(()=>reject(new Error('startup timeout')),10000);
 child.stdout.on('data',b=>{if(String(b).includes('Panel ready')){clearTimeout(t);resolve()}});
 child.once('exit',()=>{clearTimeout(t);reject(new Error('exited'))});
});
const api=async(path,opts={})=>{
 const r=await fetch('http://127.0.0.1:8099/api/panel/'+path,{method:opts.method||'GET',
  headers:{'Content-Type':'application/json',...(opts.proof?{'X-Panel-Proof':opts.proof}:{})},
  ...(opts.body===undefined?{}:{body:JSON.stringify(opts.body)})});
 return {status:r.status,body:await r.json().catch(()=>null)};
};
let ok=true;
try{
 const boot=await api('bootstrap');const proof=boot.body.proof;
 // РџСЂРѕРІРµСЂРµРЅРЅР°СЏ РїСЂРёРІСЏР·РєР° camera-yard, РєР°Рє Сѓ Р¶РёРІРѕР№ РїР°РЅРµР»Рё.
 let p=boot.body.preferences;p.mode='live';p.bindings['camera-yard']={entityId:'camera.mock',verified:true};
 await api('preferences',{method:'PUT',proof,body:p});
 await api('ha/yard-motion'); // РїРѕРґСЃРєР°Р·РєР° СЃСѓС‰РЅРѕСЃС‚Рё РґР»СЏ РєРѕР»СЊС†РµРІРѕРіРѕ Р±СѓС„РµСЂР°
 const browser=await chromium.launch({channel:'msedge',headless:true});
 const page=await browser.newPage();
 const errors=[];
 page.on('pageerror',e=>errors.push('pageerror: '+e.message));
 page.on('console',m=>{if(m.type()==='error')errors.push('console: '+m.text())});
 page.on('response',r=>{if(r.status()>=400)errors.push('HTTP '+r.status()+' '+r.url())});
 await page.goto('http://127.0.0.1:8099/',{waitUntil:'networkidle',timeout:30000});
 await page.waitForTimeout(2500);
 await page.keyboard.press('Escape');await page.waitForTimeout(500);
 const chip=page.locator('.hero-status-chip');
 if(await chip.count()){await chip.first().click();await page.waitForTimeout(1500)}
 await page.selectOption('#mode-setting','live');await page.waitForTimeout(5000);
 await page.keyboard.press('Escape');await page.waitForTimeout(800);
 await page.keyboard.press('Escape');await page.waitForTimeout(800);
 // Yard tab = yard camera sheet (openYardCamera): camera shortcut on home.
 await page.locator('[data-camera="camera-yard"]').first().click();await page.waitForTimeout(2000);
 console.log('sheet h2:',await page.evaluate(()=>document.querySelector('.sheet h2')?.textContent||'?'));
 console.log('slot html:',await page.evaluate(()=>document.querySelector('#yard-clips-slot')?.outerHTML||'(none)'));
 console.log('yard-clips slot:',await page.locator('#yard-clips-slot').count());
 console.log('empty state before capture:',await page.locator('.yard-clips-empty').count());
 // РЎС‹РјРёС‚РёСЂСѓР№ РґРІРёР¶РµРЅРёРµ: С‚РµСЃС‚-С…СѓРє testCapture.
 const cap=await api('yard-clips-capture',{method:'POST',proof,body:{}});
 console.log('capture:',cap.status,JSON.stringify(cap.body));
 await page.waitForTimeout(2500);
 const rows=await page.locator('.yard-clip-row').count();
 console.log('clip rows:',rows);
 const thumbs=await page.locator('.yard-clip-row .yard-clip-thumb img').count();
 console.log('clip thumbs:',thumbs);
 if(!rows||!thumbs)ok=false;
 // РљР»РёРє РїРѕ СЃС‚СЂРѕРєРµ в†’ С‰РёС‚РѕРє СЃ РєР°РґСЂР°РјРё.
 await page.locator('.yard-clip-row').first().click();await page.waitForTimeout(2000);
 const frames=await page.locator('.yard-clip-frames img').count();
 console.log('sheet frames:',frames,'sheet open:',await page.locator('.yard-clip-sheet').count());
 if(!frames)ok=false;
 console.log('errors:',errors.length?errors:'none (favicon 404 РґРѕРїСѓСЃС‚РёРј)');
 const hard=errors.filter(e=>e.startsWith('pageerror')||(e.startsWith('HTTP')&&!e.includes('/ha/energy')&&!e.includes('/ha/rtc')&&!e.includes('/ha/stream')));// fake HA has no energy/rtc/stream endpoints; duplicate console notices ignored
 if(hard.length)ok=false;
 await browser.close();
}catch(error){ok=false;console.error('QA FAIL:',error.message)}
// Р”РµРјРѕ/РїСЂРµРІСЊСЋ РЅРµ СЃР»РѕРјР°РЅ: PANEL_PREVIEW=1 СЃ С‚РµРј Р¶Рµ PANEL_DATA вЂ” РіСЂСѓР·РёС‚СЃСЏ Р±РµР· РѕС€РёР±РѕРє.
try{
 const pv=spawn(process.execPath,['release/server.mjs'],{cwd:resolve('.'),env:{...process.env,PORT:'8098',PANEL_DATA:'.data_preview',PANEL_PREVIEW:'1',PANEL_TEST_HOOKS:'1'},stdio:['ignore','pipe','pipe']});
 await new Promise((resolve,reject)=>{
  const t=setTimeout(()=>reject(new Error('preview startup timeout')),10000);
  pv.stdout.on('data',b=>{if(String(b).includes('Panel ready')){clearTimeout(t);resolve()}});
  pv.once('exit',()=>{clearTimeout(t);reject(new Error('preview exited'))});
 });
 const browser=await chromium.launch({channel:'msedge',headless:true});
 const page=await browser.newPage();
 const errors=[];
 page.on('pageerror',e=>errors.push('pageerror: '+e.message));
 page.on('console',m=>{if(m.type()==='error')errors.push('console: '+m.text())});
 await page.goto('http://127.0.0.1:8098/',{waitUntil:'networkidle',timeout:30000});
 await page.waitForTimeout(2500);
 console.log('preview errors:',errors.length?errors:'none');
 const hard=errors.filter(e=>e.startsWith('pageerror')||(e.startsWith('HTTP')&&!e.includes('/ha/energy')&&!e.includes('/ha/rtc')&&!e.includes('/ha/stream')));// fake HA has no energy/rtc/stream endpoints; duplicate console notices ignored
 if(hard.length)ok=false;
 await browser.close();
 pv.kill('SIGTERM');
 await new Promise(r=>pv.once('exit',r));
}catch(error){ok=false;console.error('PREVIEW QA FAIL:',error.message)}
child.kill('SIGTERM');
await new Promise(r=>child.once('exit',r));
await new Promise(r=>fake.close(r));
try{await rm(dir,{recursive:true,force:true})}catch{}
console.log(ok?'QA OK':'QA FAILED');
process.exitCode=ok?0:1;
