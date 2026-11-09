// Временный headless smoke главной (энергия v1). Запуск: node qa_smoke_energy.mjs
const {chromium}=await import('file:///C:/Users/ssholokhov/AppData/Local/npm-cache/_npx/e41f203b7505f1fb/node_modules/playwright/index.mjs');
import {strict as assert} from 'node:assert';
import {spawn} from 'node:child_process';
import http from 'node:http';
import {mkdtemp,rm} from 'node:fs/promises';
import {tmpdir} from 'node:os';
import {join,resolve} from 'node:path';
const dir=await mkdtemp(join(tmpdir(),'home-panel-smoke-'));
const state=(id,v,u)=>({entity_id:id,state:v,last_changed:new Date().toISOString(),last_updated:new Date().toISOString(),attributes:{...(u?{unit_of_measurement:u}:{})}});
const states=[
 state('sensor.schetchik_no11080509_reading','1234.5','kWh'),
 state('sensor.schetchik_no11080509_consumption','45.2','kWh'),
 state('sensor.schetchik_no11080509_meter_number','11080509'),
 state('sensor.meter_signal_level','-60','dBm'),
 state('weather.home','clear',{temperature:5}.temperature?'temperature':'temperature')];
states[states.length-1].attributes={temperature:5};
const fake=http.createServer((req,res)=>{
 if(req.headers.authorization!=='Bearer mock-smoke'){res.writeHead(401);return res.end('{}')}
 res.setHeader('Content-Type','application/json');
 if(req.url==='/api/states')return res.end(JSON.stringify(states));
 res.writeHead(404);res.end('{}');
});
await new Promise(r=>fake.listen(3028,'127.0.0.1',r));
let portURL='http://127.0.0.1:3035',child;
async function launch(env={},port=3035){portURL='http://127.0.0.1:'+port;child=spawn(process.execPath,['release/server.mjs'],{cwd:resolve('.'),env:{...process.env,PORT:String(port),PANEL_DATA:dir,...env},stdio:['ignore','pipe','pipe']});
 await new Promise((res,rej)=>{const t=setTimeout(()=>rej(new Error('startup')),10000);child.stdout.on('data',b=>{if(String(b).includes('Panel ready')){clearTimeout(t);res()}})})}
async function stop(){if(child&&child.exitCode===null){const e=new Promise(r=>child.once('exit',r));child.kill('SIGTERM');await e}}
const browser=await chromium.launch();
try{
 await launch({HA_URL:'http://127.0.0.1:3028',HA_TOKEN:'mock-smoke'});
 const bootstrap=await (await fetch(portURL+'/api/panel/bootstrap')).json();
 const prefs={...bootstrap.preferences,mode:'live'};
 const put=await fetch(portURL+'/api/panel/preferences',{method:'PUT',headers:{'Content-Type':'application/json','X-Panel-Proof':bootstrap.proof},body:JSON.stringify(prefs)});
 assert.equal(put.status,200);
 const page=await browser.newPage();
 await page.goto(portURL+'/');
 await page.waitForSelector('#home-energy .energy-card',{timeout:10000});
 const text=await page.$eval('#home-energy',el=>el.textContent);
 assert.match(text,/234,5/);assert.match(text,/кВт·ч/);assert.match(text,/Потребление/);assert.match(text,/45,2/);
 console.log('smoke energy: live карточка рендерится с показаниями и потреблением');
 await stop();
 await rm(dir,{recursive:true,force:true});
 // Демо: карточка не рисуется.
 const dir2=await mkdtemp(join(tmpdir(),'home-panel-smoke-'));
 await launch({},3036);
 await new Promise(r=>setTimeout(r,2500));
 const page2=await browser.newPage();
 await page2.goto('http://127.0.0.1:3036/');
 await page2.waitForTimeout(2500);
 const demo=await page2.$eval('#home-energy',el=>el.innerHTML);
 assert.ok(!demo.includes('energy-card'),'в демо карточки быть не должно');
 console.log('smoke energy: демо — карточка не рисуется');
 await rm(dir2,{recursive:true,force:true});
}catch(error){console.error(error);process.exitCode=1}finally{await browser.close();await stop();await new Promise(r=>fake.close(r))}