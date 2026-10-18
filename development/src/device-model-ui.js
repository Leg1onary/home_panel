import {buildDeviceModel} from './device-model.js';
import {deviceTypes} from './device-types.js';

export function deviceStructure(p,{editing=null,esc,areaName,areas,blocked=false}){
 const disabled=blocked?'disabled':'',model=buildDeviceModel(p);
 const entry=editing==='new'?null:model.find(g=>g.id===editing);
 if(editing){
  const selected=entry?.components.map(c=>c.id)||[];
  const taken=new Set(p.deviceModel.groups.filter(g=>g.id!==editing).flatMap(g=>g.members));
  return `<div class="equipment-editor"><div class="eyebrow">Логическое устройство</div>
   <p class="setting-help">Объедини каналы одного физического устройства. Entity_id и команды остаются у каналов; группировка не снимает блокировки.</p>
   <label class="setting-field">Название устройства<input id="equipment-name" maxlength="64" value="${esc(entry?.name||'')}" placeholder="Например, датчик спальни"/></label>
   <label class="setting-field">Основная комната<select id="equipment-room">${areas.map(a=>`<option value="${a.id}" ${a.id===(entry?.room||'living')?'selected':''}>${esc(a.name)}</option>`).join('')}</select></label>
   <label class="setting-field">Поиск каналов<input id="equipment-filter" type="search" placeholder="Название, комната или entity_id" autocomplete="off"/></label>
   <fieldset class="binding-card equipment-members"><legend>Каналы устройства</legend>
   ${p.devices.map(d=>`<div data-equipment-option data-search="${esc([d.name,d.id,areaName(d.room),deviceTypes[d.type].label,p.bindings[d.id]?.entityId||''].join(' ').toLowerCase())}"><label class="check-field"><input type="checkbox" data-equipment-member="${d.id}" ${selected.includes(d.id)?'checked':''} ${taken.has(d.id)?'disabled':''}/><span>${esc(d.name)} · ${esc(areaName(d.room))}<br><small>${esc(deviceTypes[d.type].label)}${taken.has(d.id)?' · уже в другом устройстве':''}</small></span></label></div>`).join('')}
   </fieldset>
   <label class="setting-field">Связь с будущим планом<select id="equipment-visual"><option value="room" ${entry?.visual.mode!=='none'?'selected':''}>По комнате</option><option value="none" ${entry?.visual.mode==='none'?'selected':''}>Без размещения на плане</option></select></label>
   <p class="setting-help">Это метаданные для нового плана, не перестройка текущей 3D-сцены. Устройство работает независимо от размещения.</p>
   <div class="sheet-actions"><button class="primary" data-action="save-equipment" ${disabled}>Сохранить устройство</button><button class="secondary" data-action="equipment-back">К списку</button></div></div>`;
 }
 return `<p class="setting-help">Модель v1: ${model.length} устройств · ${p.devices.length} каналов. Датчик может объединять температуру, влажность и батарейку. Несгруппированный канал сам образует устройство.</p>
  <button class="primary full-width" data-action="new-equipment" ${disabled}>Объединить каналы в устройство</button>
  <div class="catalog-list equipment-list">${model.map(g=>`<article class="binding-card equipment-card"><div class="title-line"><h3>${esc(g.name)}</h3><span>${g.components.length} кан.</span></div>
   <p>${esc(areaName(g.room))} · ${g.implicit?'отдельный канал':'логическое устройство'}</p>
   <ul>${g.components.map(c=>`<li>${esc(c.name)} · ${esc(deviceTypes[c.type].label)}${c.locked?' · только наблюдение':''}</li>`).join('')}</ul>
   <div class="catalog-actions"><button class="secondary" data-edit-equipment="${g.id}" ${disabled}>${g.implicit?'Настроить / объединить':'Изменить'}</button>${!g.implicit?`<button class="text-button" data-dissolve-equipment="${g.id}" ${disabled}>Разгруппировать</button>`:''}</div>
  </article>`).join('')}</div>
  <p class="setting-help">«Каталог» редактирует каналы. «Привязки» связывают их с HA. В этом разделе меняется только логическая структура.</p>`;
}
export function equipmentFromForm(root,p,editing,newId){
 const existing=p.deviceModel.groups.find(g=>g.id===editing);
 return {id:existing?.id||newId,name:root.querySelector('#equipment-name').value,
  room:root.querySelector('#equipment-room').value,
  members:[...root.querySelectorAll('[data-equipment-member]:checked')].map(el=>el.dataset.equipmentMember),
  visual:{mode:root.querySelector('#equipment-visual').value}};
}
