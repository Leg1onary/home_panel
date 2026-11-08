import assert from 'node:assert/strict';
import {HomeAssistant} from '../server/ha.js';
import {defaultPreferences} from '../src/preferences.js';
import {migrateHouseProfile} from '../src/house-profile.js';
const p=migrateHouseProfile(defaultPreferences());p.mode='live';
for(const b of Object.values(p.bindings))if(b.entityId)b.verified=true;
const entity='todo.shopping_list',stationId=p.bindings.station.entityId;
let items=[],altForm=false,emptyResponse=false;
const states={[stationId]:{entity_id:stationId,state:'idle',attributes:{supported_features:516,alice_state:'IDLE'}}};
const playCalls=[];
const ha=new HomeAssistant({url:'http://qa.invalid',token:'qa'});
ha.request=async(path,body)=>{
 if(path==='/api/states')return [{entity_id:entity,state:'open',attributes:{friendly_name:'Список покупок',supported_features:11}},...Object.values(states)];
 if(path==='/api/states/'+entity)return {entity_id:entity,state:'open',attributes:{}};
 if(path.startsWith('/api/states/'))return states[path.slice(12)];
 if(!path.startsWith('/api/services/'))throw new Error('Unexpected URL '+path);
 if(path.includes('todo/get_items')){
  if(emptyResponse)return [];
  const payload={items:items.filter(i=>i.status!=='completed')};
  return altForm?{[entity]:payload}:{service_response:{[entity]:payload}};
 }
 if(path.includes('todo/add_item')){items.push({uid:'u'+items.length,summary:body.item,status:'needs_action'});return []}
 if(path.includes('todo/update_item')){items.find(i=>i.uid===body.item||i.summary===body.item).status=body.status;return []}
 if(path.endsWith('/media_player/play_media')){playCalls.push(structuredClone(body));return []}
 throw new Error('Unexpected service '+path);
};
// Роутинг состояний: домен todo допущен в /api/states.
const all=await ha.states();
assert.ok(all.some(e=>e.entity_id===entity));
assert.ok(all.some(e=>e.entity_id===stationId));
// Чтение: обе формы ответа сервиса.
assert.deepEqual((await ha.shoppingItems()).items,[]);
altForm=true;items=[{uid:'a1',summary:'Молоко',status:'needs_action'}];
assert.equal((await ha.shoppingItems()).items[0].summary,'Молоко');altForm=false;
emptyResponse=true;await assert.rejects(()=>ha.shoppingItems(),/не вернул содержимое/);emptyResponse=false;
// Добавление с подтверждением чтением.
let r=await ha.shoppingMutate('add','Хлеб');
assert.equal(r.confirmed,true);assert.ok(r.items.some(i=>i.summary==='Хлеб'));
await assert.rejects(()=>ha.shoppingMutate('add','хлеб'),/уже есть/);
await assert.rejects(()=>ha.shoppingMutate('add',''),/от 1 до 80/);
await assert.rejects(()=>ha.shoppingMutate('add','x'.repeat(81)),/от 1 до 80/);
// Отметка купленным по uid с подтверждением.
r=await ha.shoppingMutate('complete',r.items.find(i=>i.summary==='Хлеб').uid);
assert.equal(r.confirmed,true);assert.ok(!r.items.some(i=>i.summary==='Хлеб'));
await assert.rejects(()=>ha.shoppingMutate('complete','нет-такой'),/не найдена/);
await assert.rejects(()=>ha.shoppingMutate('clear','x'),/запрещено/);
// Честный partial: сервис принят, но повторное чтение не удалось.
const realRequest=ha.request;let readFails=0;
ha.request=async(path,body)=>{if(path.includes('todo/get_items')&&++readCount===2)throw new Error('QA readback failure');return realRequest(path,body)};
let readCount=0; // падает только чтение после записи, не чтение before.
r=await ha.shoppingMutate('add','Соль');
assert.equal(r.confirmed,false);assert.ok(/проверь обновлением/i.test(r.message));
ha.request=realRequest;
// TTS на станцию: тот же формат, что в assistant.sendMedia, честный accepted.
r=await ha.announce('Гость пришёл',p);
assert.equal(r.accepted,true);assert.match(r.message,/Подтверждение/);
assert.deepEqual(playCalls.at(-1),{entity_id:stationId,media_content_type:'text',media_content_id:'Гость пришёл'});
await assert.rejects(()=>ha.announce('',p),/от 1 до 100/);
await assert.rejects(()=>ha.announce('x'.repeat(101),p),/от 1 до 100/);
const noStation=structuredClone(p);noStation.bindings.station.verified=false;
await assert.rejects(()=>ha.announce('Тест',noStation),/не подключена или не проверена/);
states[stationId].state='unavailable';
await assert.rejects(()=>ha.announce('Тест',p),/недоступна/);
states[stationId].state='idle';
states[stationId].attributes.supported_features=516&~512;
await assert.rejects(()=>ha.announce('Тест',p),/play_media не поддерживается/);
states[stationId].attributes.supported_features=516;
ha.pending.add(stationId);
await assert.rejects(()=>ha.announce('Тест',p),/занята/);
ha.pending.delete(stationId);
// Без настроенного HA — честная ошибка, а не пустой список.
const off=new HomeAssistant({url:'',token:''});
await assert.rejects(()=>off.shoppingItems(),/не настроен/);
await assert.rejects(()=>off.announce('Тест',p),/не настроен|не подключена/);
assert.equal(playCalls.length,1);
console.log('shopping: ok');