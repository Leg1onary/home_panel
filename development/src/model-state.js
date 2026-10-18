export const floorPalette={
 off:'#66666a',partial:'#968368',on:'#bca17a',unknown:'#586274',uncontrolled:'#63666b'
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
