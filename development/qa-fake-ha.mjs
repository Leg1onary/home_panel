// Фейковый HA для QA: REST /api/states и /api/history/period (energy) + minimal services.
import {createServer} from 'node:http';
const now=Date.now();
const e=(id,state,updated=now,attrs={})=>({entity_id:id,state,last_changed:new Date(updated).toISOString(),last_updated:new Date(updated).toISOString(),attributes:attrs});
const states=[
 e('sensor.schetchik_no11080509_reading','29558.04',now-1800000,{friendly_name:'Счётчик показания',unit_of_measurement:'кВт·ч'}),
 e('sensor.schetchik_no11080509_consumption','12.4',now-1800000),
 e('sensor.schetchik_no11080509_readings_date','2026-11-08',now),
 e('sensor.schetchik_no11080509_meter_number','11080509',now),
 e('sensor.schetchik_no11080509_signal_level','-60',now)
];
const history=[[
 {entity_id:'sensor.schetchik_no11080509_reading',state:'29554.4',last_changed:new Date(now-30*3600000).toISOString()},
 {entity_id:'sensor.schetchik_no11080509_reading',state:'29556.1',last_changed:new Date(now-10*3600000).toISOString()},
 {entity_id:'sensor.schetchik_no11080509_reading',state:'29558.04',last_changed:new Date(now-1800000).toISOString()}
]];
createServer((req,res)=>{
 let body='';
 req.on('data',c=>body+=c);
 req.on('end',()=>{
  res.setHeader('Content-Type','application/json');
  if(req.url.startsWith('/api/states'))return res.end(JSON.stringify(states));
  if(req.url.startsWith('/api/history/period'))return res.end(JSON.stringify(history));
  res.statusCode=200;res.end(JSON.stringify({}));
 });
}).listen(9999,'127.0.0.1',()=>console.log('fake HA :9999'));
