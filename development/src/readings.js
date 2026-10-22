// Stored HA values, state timestamps and panel polling are different signals.
export function stateTimes(e,now=Date.now()){
 const parse=value=>{
  const at=typeof value==='string'?Date.parse(value):NaN;
  return Number.isFinite(at)&&at<=now+60000?at:null;
 };
 return {reportedAt:parse(e?.last_reported),updatedAt:parse(e?.last_updated),changedAt:parse(e?.last_changed)};
}
export function numericReading(e,{online=true,unit,now=Date.now()}={}){
 const times=stateTimes(e,now),raw=e?.state;
 const valid=online&&e&&typeof raw==='string'&&raw.trim()!==''&&!['unknown','unavailable'].includes(raw)&&Number.isFinite(Number(raw));
 const available=Boolean(valid&&(!unit||e.attributes?.unit_of_measurement===unit));
 return {...times,available,value:available?Number(raw):null,
  reason:!online?'ha-offline':!e?'missing':!valid?'unavailable':unit&&e.attributes?.unit_of_measurement!==unit?'wrong-unit':null};
}
