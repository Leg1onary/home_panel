export const floorPalette={
 off:'#303a35',partial:'#796946',on:'#aa905e',unknown:'#4c5356',uncontrolled:'#383e39'
};
// Treat a missing state as unknown, never as a verified light-off state.
export function floorVisual(channels,state){
 const active=(channels||[]).filter(c=>!c.planned);
 if(!active.length)return {status:'uncontrolled',color:floorPalette.uncontrolled};
 const readings=active.map(c=>{
  if(state.mode!=='live')return state.demoOffline?'unknown':c.on?'on':'off';
  const b=state.bindings?.[c.id],e=b?.verified?state.entityStates?.[b.entityId]:null;
  return state.liveOnline&&['on','off'].includes(e?.state)?e.state:'unknown';
 });
 const count=readings.filter(v=>v==='on').length;
 const status=count?(count===readings.length?'on':'partial'):readings.includes('unknown')?'unknown':'off';
 return {status,color:floorPalette[status]};
}
