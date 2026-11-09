const {chromium}=await import('file:///C:/Users/ssholokhov/AppData/Local/npm-cache/_npx/e41f203b7505f1fb/node_modules/playwright/index.mjs');
import {strict as assert} from 'node:assert';
import {spawn} from 'node:child_process';
import http from 'node:http';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
const dir=await mkdtemp(join(tmpdir(),'home-panel-smoke-'));
const fake=http.createServer((req,res)=>{
 if(req.headers.authorization!=='Bearer mock-smoke'){res.writeHead(401);return res.end('{}')}
 res.setHeader('Content-Type','application/json');
 if(req.url==='/api/states')return res.end('[]');
 res.writeHead(404);res.end('{}');
});
await new Promise(r=>fake.listen(3028,'127.0.0.1',r));
const base=()=>portURL;
let portURL='http://127.0.0.1:3027';
let child;
async function launch(env={},port=3027){portURL='http://127.0.0.1:'+port;child=spawn(process.execPath,['release/server.mjs'],{cwd:resolve('.'),env:{...process.env,PORT:String(port),PANEL_DATA:dir,...env},stdio:['ignore','pipe','pipe']});
 child.stderr.on("data",b=>process.stderr.write("CHILD:"+b));await new Promise((res,rej)=>{const t=setTimeout(()=>rej(new Error('startup')),10000);child.stdout.on('data',b=>{if(String(b).includes('Panel ready')){clearTimeout(t);res()}})})}
async function stop(){if(child&&child.exitCode===null){const e=new Promise(r=>child.once('exit',r));child.kill('SIGTERM');await e}}
const browser=await chromium.launch();
try{
 // Демо: кнопки mic быть не должно.
 await launch({});
 const page=await browser.newPage();
 await page.goto(portURL+'/');
 await page.waitForTimeout(2500);
 assert.ok(await page.$('#voice-command')===null,'в демо не должно быть кнопки mic');
 // Live: mic-кнопка в hero-top-right, ДО статуса.
 await stop();
 await launch({HA_URL:'http://127.0.0.1:3028',HA_TOKEN:'mock-smoke'},3031);
 const proof=(await (await fetch(portURL+'/api/panel/bootstrap')).json()).proof;
 let prefs=(await (await fetch(portURL+'/api/panel/bootstrap')).json()).preferences;
 prefs.mode='live';
 const put=await fetch(portURL+'/api/panel/preferences',{method:'PUT',headers:{'Content-Type':'application/json','X-Panel-Proof':proof},body:JSON.stringify(prefs)});
 assert.equal(put.status,200);
 const page2=await browser.newPage();
 await page2.goto(portURL+'/');
 await page2.waitForSelector('#voice-command',{timeout:8000});
 const markup=await page2.$eval('.hero-top-right',el=>el.innerHTML);
 assert.ok(markup.indexOf('voice-command')<markup.indexOf('hero-status'),'mic должен идти ДО статуса');
 assert.ok(await page2.$('#reset-model'),'hero остался целым');
 console.log('smoke voice: demo без mic, live mic в hero-top-right до статуса');
}catch(error){console.error(error)}finally{await browser.close();await stop();await new Promise(r=>fake.close(r));await rm(dir,{recursive:true,force:true})}

