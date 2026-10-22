const types=new Set(['temperature','humidity','door','motion','leak','light']);
const cache=new Map();
export function historyScope(p){
 return p.devices.filter(d=>d.status==='installed'&&types.has(d.type)&&p.bindings[d.id]?.verified&&p.bindings[d.id]?.entityId)
  .map(d=>({id:d.id,name:d.name,room:d.room,type:d.type,entityId:p.bindings[d.id].entityId}));
}
// Retain extrema, first/last and explicit unavailable gaps without emitting
// hundreds of thousands of recorder rows to an old wall tablet.
function chartPoints(rows,limit=420){
 if(rows.length<=limit)return rows;
 const result=[],step=Math.ceil(rows.length/(limit/5));
 for(let i=0;i<rows.length;i+=step){
  const bucket=rows.slice(i,i+step),valid=bucket.filter(p=>p.value!==null);
  const chosen=[bucket[0],bucket[bucket.length-1]];
  if(bucket.some(p=>p.value===null))chosen.push(bucket.find(p=>p.value===null));
  if(valid.length){chosen.push(valid.reduce((a,b)=>a.value<b.value?a:b));chosen.push(valid.reduce((a,b)=>a.value>b.value?a:b))}
  for(const p of [...new Set(chosen)].sort((a,b)=>a.at-b.at))result.push(p);
 }
 return result;
}
export function summarizeHistory(raw,scope,start,end){
 if(!Array.isArray(raw))throw new Error('HA вернул некорректную историю.');
 const allowed=new Map(scope.map(d=>[d.entityId,d])),series=[],events=[],lights=[],recorded=new Set();
 for(const group of raw){
  if(!Array.isArray(group)||!group.length)continue;
  const d=allowed.get(group[0]?.entity_id);if(!d)continue;
  const rows=group.map(r=>({at:Date.parse(r.last_changed||r.last_updated),state:String(r.state??'')}))
   .filter(r=>Number.isFinite(r.at)&&r.at<=end).sort((a,b)=>a.at-b.at);
  if(rows.length)recorded.add(d.id);
  if(['temperature','humidity'].includes(d.type)){
   const points=rows.map(r=>({at:Math.max(start,r.at),value:!['unknown','unavailable',''].includes(r.state)&&Number.isFinite(Number(r.state))?Number(r.state):null}));
   const valid=points.filter(p=>p.value!==null);
   series.push({...d,points:chartPoints(points),count:valid.length,min:valid.length?valid.reduce((n,p)=>Math.min(n,p.value),Infinity):null,max:valid.length?valid.reduce((n,p)=>Math.max(n,p.value),-Infinity):null,last:points.at(-1)?.value??null});
  }else{
   let last;
   for(const r of rows){
    if(r.at>start&&r.state!==last)events.push({...d,at:r.at,state:r.state});
    last=r.state;
   }
   if(d.type==='light'){
    let onMs=0,knownMs=0;
    rows.forEach((r,i)=>{const from=Math.max(start,r.at),to=Math.min(end,rows[i+1]?.at??end),ms=Math.max(0,to-from);
     if(['on','off'].includes(r.state)){knownMs+=ms;if(r.state==='on')onMs+=ms}
    });
    lights.push({...d,onMs,knownMs,coverage:Math.min(1,knownMs/(end-start))});
   }
  }
 }
 for(const d of scope){
  if(d.type==='light'&&!lights.some(e=>e.id===d.id))lights.push({...d,onMs:0,knownMs:0,coverage:0});
  if(['temperature','humidity'].includes(d.type)&&!series.some(e=>e.id===d.id))series.push({...d,points:[],count:0,min:null,max:null,last:null});
 }
 const count=events.length;
 events.sort((a,b)=>b.at-a.at);
 const perType={};
 const retained=events.filter(e=>{perType[e.type]=(perType[e.type]||0)+1;return perType[e.type]<=200});
 return {source:'Home Assistant History',start,end,series,events:retained,eventCount:count,lights,
  scopeCount:scope.length,recordedCount:recorded.size,
  truncated:count>200};
}
export async function loadHistory(ha,p,hoursText){
 const hours=Number(hoursText||24);
 if(![6,24,168].includes(hours))throw new Error('Период истории: 6, 24 или 168 часов.');
 if(p.mode!=='live'||!ha.enabled)throw new Error('История доступна в рабочем режиме с подключённым Home Assistant. Демоисторию не рисуем.');
 const scope=historyScope(p);
 const key=JSON.stringify([ha.url,hours,scope.map(d=>[d.id,d.entityId,d.room,d.name])]);
 const saved=cache.get(key);if(saved&&Date.now()-saved.at<30000)return saved.promise;
 const promise=(async()=>{
  const end=Date.now(),start=end-hours*3600000;
  if(!scope.length)return summarizeHistory([],scope,start,end);
  const query=new URLSearchParams({filter_entity_id:scope.map(d=>d.entityId).join(','),end_time:new Date(end).toISOString(),minimal_response:'',no_attributes:'',significant_changes_only:'0'});
  let raw;
  try{raw=await ha.request('/api/history/period/'+encodeURIComponent(new Date(start).toISOString())+'?'+query)}
  catch(error){throw new Error('История HA недоступна. Проверь History/Recorder и сохранение нужных сущностей. '+error.message)}
  return summarizeHistory(raw,scope,start,end);
 })();
 if(cache.size>=12)cache.delete(cache.keys().next().value);
 cache.set(key,{at:Date.now(),promise});
 try{return await promise}catch(error){cache.delete(key);throw error}
}
