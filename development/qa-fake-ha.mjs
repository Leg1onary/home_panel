// Фейковый HA для QA: REST /api/states и /api/history/period (energy) + minimal services.
import {createServer} from 'node:http';
const now=Date.now();
const e=(id,state,updated=now,attrs={})=>({entity_id:id,state,last_changed:new Date(updated).toISOString(),last_updated:new Date(updated).toISOString(),attributes:attrs});
const states=[
 e('sensor.schetchik_no11080509_reading','29558.04',now-1800000,{friendly_name:'Счётчик показания',unit_of_measurement:'кВт·ч'}),
 e('sensor.schetchik_no11080509_consumption','12.4',now-1800000),
 e('sensor.schetchik_no11080509_readings_date','2026-11-08',now),
 e('sensor.schetchik_no11080509_meter_number','11080509',now),
 e('sensor.schetchik_no11080509_signal_level','-60',now),
 // Погодная сущность и батарейка дачика протечки (волна 2: погодный чип + дайджест).
 e('weather.home','cloudy',now,{temperature:7.3,humidity:60}),
 e('sensor.vannaia_datchik_protechki_vody_uroven_zariada','15',now,{unit_of_measurement:'%',friendly_name:'Батарейка датчика протечки'}),
 // Волна 4: линии света гостиной (включены) и спальни (выключены) — как в выгрузке HA.
 e('light.gostinaia_levyi_vykliuchatel','on'),
 e('light.gostinaia_pravyi_vykliuchatel','on'),
 e('light.spalnia_levyi_vykliuchatel','off'),
 e('light.spalnia_pravyi_vykliuchatel','off')
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
  // Волна 4: эмулируем переключение света (/api/services/light/turn_on|turn_off),
  // чтобы тогглы карточки/щитка комнаты меняли состояние в /api/states.
  const m=req.url.match(/^\/api\/services\/light\/(turn_on|turn_off)/);
  if(m&&req.method==='POST'){
   let entity='';try{entity=JSON.parse(body).entity_id||''}catch{}
   const next=m[1]==='turn_on'?'on':'off';
   const s=states.find(s=>s.entity_id===entity);
   if(s){s.state=next;s.last_changed=s.last_updated=new Date().toISOString()}
  }
  if(req.url.startsWith('/api/history/period'))return res.end(JSON.stringify(history));
  // Волна 4: одна сущность (/api/states/<entity_id>) — сервер читает её до и после команды.
  const single=req.url.match(/^\/api\/states\/([a-z_]+\.[a-z0-9_]+)$/);
  if(single){const s=states.find(x=>x.entity_id===single[1]);res.statusCode=s?200:404;return res.end(JSON.stringify(s||{entity_id:single[1],state:'unknown',attributes:{}}))}
  if(req.url.startsWith('/api/states'))return res.end(JSON.stringify(states));
  res.statusCode=200;res.end(JSON.stringify({}));
 });
}).listen(9999,'127.0.0.1',()=>console.log('fake HA :9999'));
// Примечание (волна 2): /api/panel/ha/weather-forecast возвращает 400, потому что
// fake HA не эмулирует HA WebSocket (weather.get_forecasts). Щиток прогноза при
// этом открывается и честно показывает «Прогноз недоступен» — путь forecastSheet()
// не менялся в волне 2.
