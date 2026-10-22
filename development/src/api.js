const port='__PORT_3010__';
const local=['127.0.0.1','localhost','[::1]'].includes(location.hostname);
const base=local||port.startsWith('__')?'':port;
let proof='';
let refreshingProof;
export const panelURL=path=>`${base}/api/panel/${path}`;
export const assetURL=path=>`${base}/${path}`;
export function api(path,options={}){
 return request(path,options,false);
}
async function refreshProof(){
 if(!refreshingProof)refreshingProof=api('session').finally(()=>{refreshingProof=null});
 await refreshingProof;
}
async function request(path,options,refreshed){
 const {method='GET',body,raw=false,image=false,timeout=35000}=options;
 let response,timer;
 const controller=typeof AbortController==='function'?new AbortController():null;
 if(controller)timer=setTimeout(()=>controller.abort(),timeout);
 try{response=await fetch(panelURL(path),{
  method,credentials:'same-origin',...(controller?{signal:controller.signal}:{}),
  headers:{...(body!==undefined?{'Content-Type':raw?'image/jpeg':'application/json'}:{}),...(method!=='GET'?{'X-Panel-Proof':proof}:{})},
  body:body===undefined?undefined:raw?body:JSON.stringify(body)
 })}catch{throw new Error(path==='ha/command'||path==='assistant/action'?'Сервер не подтвердил результат. Действие могло выполниться; проверь состояние перед повтором. Автоповтора нет.':'Сервер недоступен. Настройки не сохранены.')}
 finally{clearTimeout(timer)}
 if(!response.ok){
  let message='Локальный сервер недоступен.',code;
  try{const error=await response.json();message=error.error||message;code=error.code}catch{}
  // The server returns this code ONLY before entering the action handler.
  // Retry once after refreshing session proof, never after transport/HA errors:
  // an ambiguous response could mean the physical command already executed.
  if(method!=='GET'&&code==='PANEL_PROOF_REQUIRED'&&!refreshed){
   await refreshProof();
   return request(path,options,true);
  }
  throw new Error(message);
 }
 if(image||raw&&method==='GET')return response.blob();
 const result=await response.json();
 if(result.proof)proof=result.proof;
 return result;
}
