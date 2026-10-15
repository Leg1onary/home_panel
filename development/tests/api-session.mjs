import assert from 'node:assert/strict';
globalThis.location={hostname:'localhost'};
const {api}=await import('../src/api.js');
let phase='initial',refreshes=0,posts=0,executions=0;
const ok=body=>({ok:true,json:async()=>body});
const rejected=(error,code)=>({ok:false,json:async()=>({error,...(code?{code}:{})})});
globalThis.fetch=async(url,options)=>{
 if(url.endsWith('/bootstrap'))return ok({proof:'before-restart'});
 if(url.endsWith('/session')){
  refreshes++;await new Promise(r=>setTimeout(r,10));
  return ok({proof:'after-restart'});
 }
 posts++;
 if(phase==='transport')throw new Error('connection reset after action may have executed');
 if(phase==='ha-error')return rejected('HA command readback timeout');
 if(phase==='origin')return rejected('Запрос из другой страницы запрещён.');
 if(phase==='always-expired')return rejected('expired','PANEL_PROOF_REQUIRED');
 if(options.headers['X-Panel-Proof']!=='after-restart')return rejected('expired','PANEL_PROOF_REQUIRED');
 executions++;
 return ok({confirmed:true});
};
await api('bootstrap');
await Promise.all([
 api('ha/command',{method:'POST',body:{id:'station:volume',value:42}}),
 api('ha/command',{method:'POST',body:{id:'living:0',value:true}})
]);
assert.equal(refreshes,1,'Concurrent stale requests share one proof refresh');
assert.equal(posts,4);assert.equal(executions,2,'Only requests rejected before action entry may be retried');
for(const failure of ['transport','ha-error','origin']){
 phase=failure;const before=posts,refreshBefore=refreshes;
 await assert.rejects(()=>api('ha/command',{method:'POST',body:{id:'station:volume',value:43}}));
 assert.equal(posts,before+1,'Never retry ambiguous transport, HA or origin errors');
 assert.equal(refreshes,refreshBefore);
}
phase='always-expired';const before=posts,refreshBefore=refreshes;
await assert.rejects(()=>api('ha/command',{method:'POST',body:{id:'station:volume',value:44}}),/expired/);
assert.equal(posts,before+2,'At most one retry');
assert.equal(refreshes,refreshBefore+1);
console.log('PASS: stale proof refresh, concurrent single-flight, exactly one safe retry, no retries on transport/HA/origin errors, no infinite retries.');
