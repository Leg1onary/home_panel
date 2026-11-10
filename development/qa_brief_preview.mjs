// Демо-превью (PANEL_PREVIEW=1) не должно ломаться волной D: брифинг не монтируется
// в демо (updateDigestRegion только в live), страница грузится без ошибок консоли.
import {chromium} from 'playwright-core';
import {spawn} from 'node:child_process';
import {resolve} from 'node:path';
const pv=spawn(process.execPath,['release/server.mjs'],{cwd:resolve('.'),env:{...process.env,PORT:'8098',PANEL_DATA:'.data_preview',PANEL_PREVIEW:'1',PANEL_TEST_HOOKS:'1'},stdio:['ignore','pipe','pipe']});
await new Promise((res,rej)=>{const t=setTimeout(()=>rej(new Error('preview startup timeout')),10000);pv.stdout.on('data',b=>{if(String(b).includes('Panel ready')){clearTimeout(t);res()}});pv.once('exit',()=>{clearTimeout(t);rej(new Error('preview exited'))})});
let ok=true;
try{
 const browser=await chromium.launch({channel:'msedge',headless:true});
 const page=await browser.newPage({viewport:{width:1280,height:800}});
 const errors=[];
 page.on('pageerror',e=>errors.push('pageerror: '+e.message));
 page.on('console',m=>{if(m.type()==='error')errors.push('console: '+m.text())});
 await page.goto('http://127.0.0.1:8098/',{waitUntil:'networkidle',timeout:30000});
 await page.waitForTimeout(3000);
 console.log('demo errors:',errors.length?errors:'none');
 if(errors.length)ok=false;
 await browser.close();
}catch(error){ok=false;console.error('PREVIEW QA FAIL:',error.message)}
pv.kill('SIGTERM');
await new Promise(r=>pv.once('exit',r));
console.log(ok?'PREVIEW OK':'PREVIEW FAILED');
process.exit(ok?0:1);