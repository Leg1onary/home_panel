// Список покупок: данные только с сервера (todo/get_items), без опроса каждые 5 секунд.
// Отделено из app.js (волна 5): блок самодостаточен, общие хелперы — импортом из app.js.
import {esc,disabled} from './dom.js';
import {api} from './api.js';
import {isLive} from './live.js';
import {toast,updateRegion,$,I} from './app.js';
export let shoppingState={loaded:false,items:[],busy:false,error:'',note:'',truncated:false};
// Карточка покупок также используется в щите станции (app.js, #sheet-shopping).
export function shoppingCardMarkup(){return shoppingMarkup()}
function shoppingMarkup(){
 const items=shoppingState.items.slice(0,5);
 return `<div class="digest-card shopping-card"><div class="title-line"><h3>${I('box')}Покупки${shoppingState.truncated?' · первые 5':''}</h3><button class="text-button" data-action="shopping-refresh" aria-label="Обновить список покупок" ${disabled(shoppingState.busy||!isLive())}>${I('rotate-ccw')}Обновить</button></div>
 <ul class="shopping-list">${shoppingState.error?`<li class="shopping-empty">${esc(shoppingState.error)}</li>`:items.length?items.map(i=>`<li><button class="shopping-check" data-shopping-complete="${esc(i.uid)}" aria-label="Отметить купленным: ${esc(i.summary)}" ${disabled(shoppingState.busy||!isLive())}></button><span class="shopping-text">${esc(i.summary)}</span></li>`).join(''):'<li class="shopping-empty">Список пуст</li>'}</ul>
 <div class="shopping-add"><input id="shopping-input" maxlength="80" placeholder="Добавить покупку" aria-label="Новая позиция списка покупок" ${disabled(shoppingState.busy||!isLive())}/><button class="secondary" data-action="shopping-add" ${disabled(shoppingState.busy||!isLive())}>Добавить</button></div>
 ${shoppingState.note?`<p class="description">${esc(shoppingState.note)}</p>`:''}</div>`;
}
export function paintShopping(){
 // Регион покупок теперь живёт в шите станции (#sheet-shopping); updateRegion
 // с dataset.rendered-guard не перерисовывает одинаковый DOM, фокус input сохраняется.
 const m=shoppingState.loaded?shoppingMarkup():'<p class="description">Загружаем список покупок…</p>';
 if($('#sheet-shopping'))updateRegion('#sheet-shopping',m);
}
export async function loadShopping(){
 if(!isLive()){shoppingState={...shoppingState,loaded:true,error:'Список покупок работает в рабочем режиме с подключённым Home Assistant.',note:''};paintShopping();return}
 if(shoppingState.busy)return;
 shoppingState.busy=true;paintShopping();
 try{const d=await api('ha/shopping');shoppingState={...shoppingState,loaded:true,items:d.items||[],truncated:!!d.truncated,error:'',note:''}}
 catch(error){shoppingState={...shoppingState,loaded:true,error:error.message,note:''}}
 finally{shoppingState.busy=false;paintShopping()}
}
export async function shoppingMutate(action,target){
 const input=$('#shopping-input'),draft=input?.value||'';
 shoppingState.busy=true;paintShopping();
 try{
  const r=await api('ha/shopping',{method:'POST',body:{action,target}});
  shoppingState={...shoppingState,items:r.items||[],note:r.message,error:''};toast(r.message);
 }catch(error){shoppingState={...shoppingState,note:error.message};toast(error.message)}
 finally{shoppingState.busy=false;paintShopping();const i=$('#shopping-input');if(i)i.value=action==='add'?'':draft}
}