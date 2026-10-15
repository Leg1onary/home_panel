const port='__PORT_3010__';
const local=['127.0.0.1','localhost','[::1]'].includes(location.hostname);
const base=local||port.startsWith('__')?'':port;
let proof='';
export const panelURL=path=>`${base}/api/panel/${path}`;
export const assetURL=path=>`${base}/${path}`;
export async function api(path,{method='GET',body,raw=false,image=false}={}){
 let response,timer;
 const controller=typeof AbortController==='function'?new AbortController():null;
 if(controller)timer=setTimeout(()=>controller.abort(),35000);
 try{response=await fetch(panelURL(path),{
  method,credentials:'same-origin',...(controller?{signal:controller.signal}:{}),
  headers:{...(body!==undefined?{'Content-Type':raw?'image/jpeg':'application/json'}:{}),...(method!=='GET'?{'X-Panel-Proof':proof}:{})},
  body:body===undefined?undefined:raw?body:JSON.stringify(body)
 })}catch{throw new Error(path==='ha/command'?'Сервер не подтвердил результат. Команда могла выполниться; проверь состояние перед повтором.':'Сервер недоступен. Настройки не сохранены.')}
 finally{clearTimeout(timer)}
 if(!response.ok){
  let message='Локальный сервер недоступен.';
  try{message=(await response.json()).error||message}catch{}
  throw new Error(message);
 }
 if(image||raw&&method==='GET')return response.blob();
 const result=await response.json();
 if(result.proof)proof=result.proof;
 return result;
}
