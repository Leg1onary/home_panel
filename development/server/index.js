import http from 'node:http';
import {readFile,stat,mkdir} from 'node:fs/promises';
import {resolve,extname} from 'node:path';
import {spawn} from 'node:child_process';
import {isIP} from 'node:net';
import {randomBytes,createHash,timingSafeEqual} from 'node:crypto';
import Database from 'better-sqlite3';
import {defaultPreferences,validatePreferences,bindingDefinitions} from '../src/preferences.js';
import {HomeAssistant} from './ha.js';
import {CameraStreams} from './stream.js';
import {CameraRTC} from './rtc.js';
import {deviceTypes,samePhysicalDevice} from '../src/catalog.js';
import {migrateHouseProfile,activateHouseProfile,bindingProblem} from '../src/house-profile.js';

const port=Number(process.env.PORT||8080),preview=process.env.PANEL_PREVIEW==='1';
const addon=process.env.PANEL_ADDON==='1';
if(addon&&preview)throw new Error('Home Panel: add-on must not run in preview mode.');
const root=resolve(process.env.PANEL_ROOT||'dist'),data=resolve(process.env.PANEL_DATA||'data');
await mkdir(data,{recursive:true});
const db=new Database(resolve(data,'panel.sqlite'));
db.pragma('journal_mode = WAL');
db.exec('CREATE TABLE IF NOT EXISTS profiles (id TEXT PRIMARY KEY, preferences TEXT NOT NULL, photo BLOB);');
const ha=new HomeAssistant({url:process.env.HA_URL,token:process.env.HA_TOKEN,preview});
const streams=new CameraStreams(ha);
const rtc=new CameraRTC(ha);
setInterval(()=>streams.prune(),30000).unref();
setInterval(()=>rtc.prune(),30000).unref();
const proofs=new Map(),pendingScopes=new Map();
const getProfile=id=>{
 let row=db.prepare('SELECT * FROM profiles WHERE id=?').get(id);
 if(!row){db.prepare('INSERT INTO profiles(id,preferences) VALUES(?,?)').run(id,JSON.stringify(defaultPreferences()));row=db.prepare('SELECT * FROM profiles WHERE id=?').get(id)}
 const stored=validatePreferences(JSON.parse(row.preferences));
 const preferences=migrateHouseProfile(stored);
 if(preferences!==stored)db.prepare('UPDATE profiles SET preferences=? WHERE id=?').run(JSON.stringify(preferences),id);
 return {preferences,photo:row.photo};
};
const json=(res,code,body)=>{res.writeHead(code,{'Content-Type':'application/json; charset=utf-8','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});res.end(JSON.stringify(body))};
async function body(req,max=131072){
 const chunks=[];let n=0;
 for await(const c of req){n+=c.length;if(n>max)throw new Error('Файл или запрос слишком большой.');chunks.push(c)}
 return Buffer.concat(chunks);
}
function identify(req){
 if(addon){
  const address=(req.socket.remoteAddress||'').replace(/^::ffff:/,'');
  const hostname=new URL('http://'+(req.headers.host||'')).hostname.replace(/^\[|\]$/g,'');
  const privateAddress=ip=>ip==='::1'||/^f[cd][0-9a-f]*:/i.test(ip)||/^fe80:/i.test(ip)||(isIP(ip)===4&&(
   ip.startsWith('10.')||ip.startsWith('192.168.')||ip.startsWith('127.')||
   /^172\.(1[6-9]|2\d|3[01])\./.test(ip)));
  if(!privateAddress(address))throw new Error('Home Panel доступна только из локальной сети.');
  if(!privateAddress(hostname)&&hostname!=='localhost'&&!/^[a-z0-9-]+\.local$/i.test(hostname))throw new Error('Открой панель по локальному IP или имени .local.');
  return 'home';
 }
 const host=req.headers.host||'',direct=/^(localhost|127\.0\.0\.1|\[::1\]):\d+$/.test(host);
 const visitor=req.headers['x-visitor-id'];
 if(preview&&visitor)return 'preview:'+createHash('sha256').update(String(visitor)).digest('hex');
 if(direct&&['127.0.0.1','::1','::ffff:127.0.0.1'].includes(req.socket.remoteAddress))return 'local';
 throw new Error('Доступ разрешён только с этого компьютера или через приватное превью.');
}
function authorize(req,id){
 const expected=proofs.get(id),actual=String(req.headers['x-panel-proof']||'');
 if(!expected||Buffer.byteLength(actual)!==Buffer.byteLength(expected)||!timingSafeEqual(Buffer.from(actual),Buffer.from(expected))){
  const error=new Error('Защитный ключ панели устарел. Обновляем соединение.');
  error.code='PANEL_PROOF_REQUIRED';throw error;
 }
 const origin=req.headers.origin;
 const allowed=addon?[`http://${req.headers.host}`]:[`http://localhost:${port}`,`http://127.0.0.1:${port}`,`http://[::1]:${port}`];
 if(!preview&&origin&&!allowed.includes(origin))throw new Error('Запрос из другой страницы запрещён.');
 if(!preview&&req.headers['sec-fetch-site']==='cross-site')throw new Error('Межсайтовый запрос запрещён.');
}
const server=http.createServer(async(req,res)=>{
 try{
  const url=new URL(req.url,'http://localhost'),path=decodeURIComponent(url.pathname);
  if(path==='/health'&&req.method==='GET')return json(res,200,{ok:true});
  if(path.startsWith('/api/panel/')){
   const id=identify(req),p=getProfile(id),route=path.slice('/api/panel/'.length);
   if(req.method==='GET'&&route==='session'){
    if(!proofs.has(id))proofs.set(id,randomBytes(32).toString('hex'));
    return json(res,200,{proof:proofs.get(id)});
   }
   if(req.method==='GET'&&route==='bootstrap'){
    if(!proofs.has(id))proofs.set(id,randomBytes(32).toString('hex'));
    return json(res,200,{preferences:p.preferences,photo:!!p.photo,proof:proofs.get(id),preview,addon,haConfigured:ha.enabled});
   }
   if(req.method!=='GET')authorize(req,id);
   if(route==='house-profile'&&req.method==='POST'){
    if(preview)throw new Error('Профиль дома применяется только на локальной панели.');
    if(pendingScopes.has(id))throw new Error('Сначала дождись завершения команды.');
    const result=activateHouseProfile(p.preferences,await ha.states());
    if(!result.report.some(r=>r.ok))throw new Error('Ни одна сущность профиля недоступна. Проверь интеграции и привязки.');
    db.prepare('UPDATE profiles SET preferences=? WHERE id=?').run(JSON.stringify(result.preferences),id);
    return json(res,200,result);
   }
   if(route==='preferences'&&req.method==='PUT'){
    if(pendingScopes.has(id))throw new Error('Сначала дождись завершения команды.');
    const next=validatePreferences(JSON.parse((await body(req)).toString()));
    for(const d of next.devices){
     const old=p.preferences.devices.find(old=>old.id===d.id);
     if(old&&old.type!==d.type)throw new Error('Тип существующего устройства нельзя менять.');
     if(!samePhysicalDevice(old,d))next.bindings[d.id].verified=false;
    }
    const newVerified=bindingDefinitions(next.devices).filter(d=>{
     const b=next.bindings[d.id],old=p.preferences.bindings[d.id];
     return b.verified&&(!old?.verified||old.entityId!==b.entityId);
    });
    if(newVerified.length){
     const list=await ha.states(),entities=new Map(list.map(e=>[e.entity_id,e]));
     for(const def of newVerified){
      const e=entities.get(next.bindings[def.id].entityId);
      if(!e)throw new Error(`Сущность не найдена: ${def.name}`);
      const problem=bindingProblem(def.device,e);
      if(problem)throw new Error(`${def.name}: ${problem}.`);
     }
    }
    db.prepare('UPDATE profiles SET preferences=? WHERE id=?').run(JSON.stringify(next),id);
    return json(res,200,{saved:true,preferences:next});
   }
   if(route==='photo'){
    if(req.method==='GET'&&p.photo){res.writeHead(200,{'Content-Type':'image/jpeg','Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});return res.end(p.photo)}
    if(req.method==='PUT'){
     if(preview)throw new Error('В облачном превью фото не сохраняется. Используй локальный запуск.');
     const bytes=await body(req,2*1024*1024);
     if(req.headers['content-type']!=='image/jpeg'||bytes[0]!==255||bytes[1]!==216||bytes.at(-2)!==255||bytes.at(-1)!==217)throw new Error('Нужен корректный JPEG до 2 МБ.');
     db.prepare('UPDATE profiles SET photo=? WHERE id=?').run(bytes,id);return json(res,200,{saved:true});
    }
    if(req.method==='DELETE'){db.prepare('UPDATE profiles SET photo=NULL WHERE id=?').run(id);return json(res,200,{saved:true})}
   }
   if(route==='ha/states'&&req.method==='GET')return json(res,200,{states:await ha.states(),receivedAt:Date.now()});
   if(route==='ha/stream/start'&&req.method==='POST'){
    const request=JSON.parse((await body(req)).toString());
    return json(res,200,await streams.start(request.id,p.preferences,id));
   }
   if(route==='ha/rtc/start'&&req.method==='POST'){
    const request=JSON.parse((await body(req)).toString());
    return json(res,200,await rtc.start(request.id,p.preferences,id));
   }
   const rtcRoute=/^ha\/rtc\/([a-f0-9]{48})(?:\/(offer|candidate|events))?$/.exec(route);
   if(rtcRoute){
    const [,key,action]=rtcRoute;
    if(req.method==='DELETE'&&!action){rtc.get(key,id,p.preferences);rtc.close(key);return json(res,200,{stopped:true})}
    if(req.method==='GET'&&action==='events'){
     if(req.headers['sec-fetch-site']==='cross-site')throw new Error('Межсайтовый запрос запрещён.');
     if([...url.searchParams.keys()].some(k=>k!=='after'))throw new Error('Неверный параметр WebRTC.');
     return json(res,200,rtc.events(key,id,p.preferences,Number(url.searchParams.get('after')||0)));
    }
    if(req.method==='POST'&&['offer','candidate'].includes(action)){
     const request=JSON.parse((await body(req,140000)).toString());
     return json(res,200,action==='offer'?await rtc.offer(key,id,p.preferences,request.offer):await rtc.addCandidate(key,id,p.preferences,request.candidate));
    }
   }
   const streamRoute=/^ha\/stream\/([a-f0-9]{48})(?:\/(.+))?$/.exec(route);
   if(streamRoute){
    const [,key,asset]=streamRoute;
    if(req.method==='DELETE'&&!asset){streams.get(key,id,p.preferences);streams.close(key);return json(res,200,{stopped:true})}
    if(req.method==='GET'&&asset){
     if(req.headers['sec-fetch-site']==='cross-site')throw new Error('Межсайтовый запрос запрещён.');
     return await streams.proxy(key,asset,url.searchParams,id,p.preferences,req,res);
    }
   }
   if(route==='ha/camera'&&req.method==='POST'){
    const request=JSON.parse((await body(req)).toString()),image=await ha.camera(request.id,p.preferences);
    res.writeHead(200,{'Content-Type':image.type,'Cache-Control':'no-store','X-Content-Type-Options':'nosniff'});return res.end(image.bytes);
   }
   if(route==='ha/command'&&req.method==='POST'){
    const request=JSON.parse((await body(req)).toString());
    pendingScopes.set(id,(pendingScopes.get(id)||0)+1);
    try{return json(res,200,await ha.command(request,p.preferences))}
    finally{const n=pendingScopes.get(id)-1;if(n)pendingScopes.set(id,n);else pendingScopes.delete(id)}
   }
   return json(res,404,{error:'Маршрут не найден.'});
  }
  if(req.method!=='GET'&&req.method!=='HEAD')return json(res,405,{error:'Метод запрещён.'});
  const relative=path==='/'?'index.html':path.slice(1);
  // Explicit allowlist: no SQLite database, secrets, server code or arbitrary file access.
  if(!/^(index\.html|style\.css|app\.js|model-[A-Za-z0-9_-]+\.js|assets\/[A-Za-z0-9_./-]+\.(webp|woff2|ttf|txt|js))$/.test(relative)||relative.includes('..'))return json(res,404,{error:'Файл не найден.'});
  const file=resolve(root,relative);
  await stat(file);
  const type={'.html':'text/html; charset=utf-8','.js':'text/javascript; charset=utf-8','.css':'text/css; charset=utf-8','.webp':'image/webp','.woff2':'font/woff2','.ttf':'font/ttf','.txt':'text/plain; charset=utf-8'}[extname(file)];
  res.writeHead(200,{'Content-Type':type,'Cache-Control':'no-cache','X-Content-Type-Options':'nosniff','Referrer-Policy':'same-origin'});
  res.end(req.method==='HEAD'?undefined:await readFile(file));
 }catch(error){
  if(res.headersSent)return res.end();
  const message=error instanceof SyntaxError?'Некорректный JSON.':error.code==='ENOENT'?'Файл не найден.':error.message;
  json(res,error.code==='ENOENT'?404:400,{error:message,...(error.code==='PANEL_PROOF_REQUIRED'?{code:error.code}:{})});
 }
});
server.requestTimeout=25000;
server.listen(port,preview||addon?'0.0.0.0':'127.0.0.1',()=>{
 console.log(`Panel ready: port ${port} · ${addon?'Home Assistant add-on':preview?'private preview':'local only'} · HA ${ha.enabled?'configured':'not configured'}`);
 if(process.platform==='win32'&&process.argv.includes('--open'))spawn('rundll32.exe',['url.dll,FileProtocolHandler',`http://127.0.0.1:${port}`],{stdio:'ignore'}).on('error',()=>{});
});
server.on('error',error=>{console.error(error.code==='EADDRINUSE'?`Port ${port} is busy. Close the other panel server or set PORT in .env.`:'Panel server could not start.');process.exitCode=1});
for(const signal of ['SIGINT','SIGTERM'])process.on(signal,()=>server.close(()=>{db.close();process.exit(0)}));
