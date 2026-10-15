import {api} from './api.js';
import {state,hydrateRooms} from './schema.js';
import {validatePreferences} from './preferences.js';

export function preferences(){
 return validatePreferences({version:3,...Object.fromEntries(['housePresetVersion','theme','favorites','nightMode','idleSeconds','kiosk','mode','bindings','devices'].map(k=>[k,state[k]]))});
}
export function applyPreferences(p){
 Object.assign(state,validatePreferences(p));
 hydrateRooms();
}
let timer,queue=Promise.resolve(),generation=0;
export async function loadStorage(){
 try{
 const b=await api('bootstrap');state.preview=b.preview;state.addon=b.addon===true;state.haConfigured=b.haConfigured;
  applyPreferences(b.preferences);state.storage='saved';state.storageMessage='Настройки сохранены';
  state.photoStored=!!b.photo;
  if(b.photo){
   const image=await api('photo',{raw:true});state.heroURL=URL.createObjectURL(image);state.photoSaved=true;
  }
 }catch(error){state.storage='unavailable';state.storageMessage='Хранилище недоступно · '+error.message}
}
export function saveStorage(onChange=()=>{}){
 if(state.storage==='unavailable'||state.storage==='loading')return;
 clearTimeout(timer);state.storage='saving';state.storageMessage='Сохраняем…';onChange();
 const current=++generation;
 const p=preferences();
 timer=setTimeout(()=>{
  queue=queue.catch(()=>{}).then(()=>api('preferences',{method:'PUT',body:p})).then(()=>{
   if(current!==generation)return;
   state.storage='saved';state.storageMessage='Настройки сохранены';onChange();
  }).catch(error=>{if(current===generation){state.storage='error';state.storageMessage='Не сохранено · '+error.message;onChange()}});
 },250);
}
export async function flushStorage(){
 clearTimeout(timer);generation++;await queue.catch(()=>{});const result=await api('preferences',{method:'PUT',body:preferences()});
 if(result.preferences)applyPreferences(result.preferences);
 state.storage='saved';state.storageMessage='Настройки сохранены';return result;
}
export async function savePhoto(blob){
 await api('photo',{method:'PUT',body:blob,raw:true});state.photoSaved=true;state.photoStored=true;
}
export async function removePhoto(){await api('photo',{method:'DELETE'});state.photoSaved=false;state.photoStored=false}
