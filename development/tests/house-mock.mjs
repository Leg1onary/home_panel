// Test-only local fixture. Never installed in the HA add-on.
import http from 'node:http';
import {defaultPreferences} from '../src/preferences.js';
import {migrateHouseProfile,houseBindings} from '../src/house-profile.js';
import {deviceTypes} from '../src/catalog.js';
const p=migrateHouseProfile(defaultPreferences());
const states=p.devices.filter(d=>houseBindings[d.id]).map(d=>{
 const t=deviceTypes[d.type],domain=houseBindings[d.id].split('.')[0];
 const value=d.type==='station'?'playing':d.type==='camera'?'idle':d.type==='button_event'?'click':domain==='sensor'?(t.unit?(d.id==='battery:well'?'12':d.type==='temperature'?'22.4':'53'):'not_detected'):'off';
 return {entity_id:houseBindings[d.id],state:value,last_reported:new Date().toISOString(),last_updated:new Date().toISOString(),
  attributes:{friendly_name:d.name,...(t.unit?{unit_of_measurement:t.unit}:{}),...(t.classes?{device_class:domain==='sensor'?'enum':t.classes[0]}:{}),
   ...(d.type==='station'?{supported_features:16389,volume_level:0.35,media_title:'Музыка дома',media_artist:'Тестовый исполнитель'}:{})}};
});
http.createServer(async(req,res)=>{
 res.setHeader('Content-Type','application/json');
 if(req.url==='/fixture/offline'){
  states.forEach(e=>e.state='unavailable');return res.end('{}');
 }
 if(req.headers.authorization!=='Bearer house-fixture'){res.writeHead(401);return res.end('{}')}
 if(req.url==='/api/states')return res.end(JSON.stringify(states));
 if(req.url.startsWith('/api/states/')){
  const e=states.find(e=>e.entity_id===req.url.slice('/api/states/'.length));
  res.writeHead(e?200:404);return res.end(JSON.stringify(e||{}));
 }
 if(req.url.startsWith('/api/services/')){
  const parts=[];for await(const c of req)parts.push(c);
  const body=JSON.parse(Buffer.concat(parts)),e=states.find(e=>e.entity_id===body.entity_id);
  if(!e){res.writeHead(404);return res.end('{}')}
  if(req.url.endsWith('/volume_set'))e.attributes.volume_level=body.volume_level;
  else e.state=req.url.endsWith('/media_pause')?'paused':req.url.endsWith('/media_play')?'playing':req.url.endsWith('/turn_on')?'on':'off';
  res.end('[]');return;
 }
 res.writeHead(404);res.end('{}');
}).listen(32162,'127.0.0.1',()=>console.log('House fixture ready'));
