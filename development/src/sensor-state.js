// Shared by validation, display and safety alerts. Unrecognized values are never
// coerced to "closed" / "dry". Yandex exposes these Zigbee sensors as sensor.enum.
export function binaryValue(type,value){
 const v=String(value??'').trim().toLowerCase();
 if(v==='on'||v==='true')return true;
 if(v==='off'||v==='false')return false;
 if(type==='door')return v==='open'?true:v==='closed'?false:null;
 if(type==='leak')return ['wet','leak','detected'].includes(v)?true:['dry','no_leak','not_detected'].includes(v)?false:null;
 if(type==='motion')return ['detected','motion'].includes(v)?true:['not_detected','no_motion'].includes(v)?false:null;
 return null;
}
export function leakIssues(devices,{live,online,read}){
 if(!live)return [];
 return devices.filter(d=>d.type==='leak'&&d.status==='installed').flatMap(d=>{
  const value=online?binaryValue('leak',read(d.id)?.state):null;
  return value===false?[]:[{id:d.id,name:d.name,room:d.room,alarm:value===true}];
 });
}
