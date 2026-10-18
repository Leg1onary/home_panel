import assert from 'node:assert/strict';
import {defaultPreferences,validatePreferences} from '../src/preferences.js';
import {migrateHouseProfile} from '../src/house-profile.js';
import {deviceTypes,areas,validateDevices} from '../src/catalog.js';
import {seedDeviceModel,validateDeviceModel,buildDeviceModel,detachChannel,effectiveCapabilities} from '../src/device-model.js';
import {deviceStructure} from '../src/device-model-ui.js';
import {HomeAssistant} from '../server/ha.js';
const raw=defaultPreferences(),before=JSON.stringify(raw);
raw.mode='live';raw.theme='light';
raw.bindings['living:0']={entityId:'light.owner_lamp',verified:true};
const p=migrateHouseProfile(validatePreferences(raw));
assert.equal(JSON.stringify(defaultPreferences()),before);
assert.equal(p.version,3);
assert.equal(p.deviceModel.version,1);
assert.deepEqual(validatePreferences(p),p,'Normalization is idempotent');
assert.equal(p.bindings['living:0'].verified,true);
assert.equal(p.bindings['living:0'].entityId,'light.owner_lamp');
assert.equal(p.theme,'light');
const seeded=seedDeviceModel(p.devices);
assert.deepEqual(seeded.groups.find(g=>g.id==='unit-climate-living').members,['temperature:living','humidity:living','battery:living']);
assert.equal(seeded.groups.some(g=>g.members.includes('pump')),false);
const q=validatePreferences({...p,deviceModel:seeded});
const reversed=validatePreferences({...q,devices:[...q.devices].reverse()});
assert.deepEqual(reversed.deviceModel,q.deviceModel);
const model=buildDeviceModel(q);
assert.equal(model.flatMap(g=>g.components).length,q.devices.length);
assert.equal(new Set(model.flatMap(g=>g.components).map(c=>c.id)).size,q.devices.length);
assert.equal(model.find(g=>g.id==='unit-climate-living').components.length,3);
assert.deepEqual(model.find(g=>g.id==='unit-yard-camera').modules,['cameras','sensors'],'A multi-function device can appear in multiple sections without losing its sensor');
assert.equal(model.some(g=>g.id==='channel:living:0'),true);
assert.equal(model.some(g=>g.id==='channel:temperature:living'),false);
assert.equal(buildDeviceModel({...q,deviceModel:{version:1,groups:[]}}).length,q.devices.length,'Dissolved groups stay dissolved');
const renamed=structuredClone(q);renamed.deviceModel.groups[0].name='Мой датчик';
assert.deepEqual(validatePreferences(renamed).bindings,q.bindings);
const imported=validatePreferences(q,{importing:true});
assert.deepEqual(imported.deviceModel,q.deviceModel);
assert.equal(imported.mode,'demo');
assert.ok(Object.values(imported.bindings).every(b=>!b.verified));
const d=q.devices.find(d=>d.id==='temperature:living');
const states={[q.bindings[d.id].entityId]:{state:'22.7',attributes:{unit_of_measurement:'°C'}}};
q.bindings[d.id].verified=true;
let live=buildDeviceModel(q,states,true).find(g=>g.id==='unit-climate-living');
assert.equal(live.availability,'partial');
assert.equal(live.components[0].state,'22.7');
q.bindings[d.id].verified=false;
live=buildDeviceModel(q,states,true).find(g=>g.id==='unit-climate-living');
assert.equal(live.availability,'unavailable');
assert.equal(live.components[0].state,null,'Unverified channels must not expose a live reading');
const detached=detachChannel(q.deviceModel,d.id);
assert.ok(!detached.groups.some(g=>g.members.includes(d.id)));
assert.equal(q.deviceModel.groups.some(g=>g.members.includes(d.id)),true);
const bad=fn=>assert.throws(fn);
bad(()=>validateDeviceModel({version:99,groups:[]},q.devices,areas));
bad(()=>validateDeviceModel({version:1,groups:[{...seeded.groups[0],members:['missing']}]},q.devices,areas));
bad(()=>validateDeviceModel({version:1,groups:[seeded.groups[0],{...seeded.groups[0],id:'unit-duplicate'}]},q.devices,areas));
bad(()=>validateDeviceModel({version:1,groups:[{...seeded.groups[0],visual:{mode:'execute'}}]},q.devices,areas));
bad(()=>validateDeviceModel({version:1,groups:[{...seeded.groups[0],members:[]}]},q.devices,areas));
bad(()=>validateDevices([{id:'test-spoof',type:'toString',room:'living',name:'x',status:'installed'}]));
const spoofed=validateDeviceModel({version:1,groups:[{...seeded.groups[0],controllable:true,services:['shell_command.run'],visual:{mode:'room',script:'alert(1)'}}]},q.devices,areas);
assert.equal(spoofed.groups[0].controllable,undefined);
assert.equal(spoofed.groups[0].visual.script,undefined);
assert.ok(Object.isFrozen(deviceTypes));assert.ok(Object.isFrozen(deviceTypes.light.domains));
const curtain={id:'device-curtain',type:'curtain',room:'bedroom',name:'Карниз',status:'installed',note:'',masterOff:true};
const vacuum={...curtain,id:'device-vacuum',type:'vacuum',name:'Пылесос'};
const future=validatePreferences({...q,devices:[...q.devices,curtain,vacuum],bindings:{...q.bindings,
 [curtain.id]:{entityId:'cover.test',verified:false},[vacuum.id]:{entityId:'vacuum.test',verified:false}}});
assert.equal(future.devices.at(-1).masterOff,false);
assert.deepEqual(effectiveCapabilities(curtain,{state:'closed',attributes:{current_position:0}}),['state','position']);
assert.deepEqual(effectiveCapabilities(vacuum,{state:'docked',attributes:{battery_level:80}}),['state','battery']);
assert.deepEqual(effectiveCapabilities({type:'station',status:'installed'},{state:'off',attributes:{supported_features:16389}}),['state']);
assert.deepEqual(effectiveCapabilities({type:'rgb',status:'installed'},{state:'on',attributes:{supported_color_modes:['onoff']}}),['state','power']);
assert.deepEqual(effectiveCapabilities({type:'rgb',status:'installed'},{state:'on',attributes:{supported_color_modes:['rgb']}}),['state','power','brightness','color']);
let networkCalls=0;
const ha=new HomeAssistant({url:'http://127.0.0.1:1',token:'test-only'});
ha.request=async()=>{networkCalls++;return []};
for(const [id,entityId]of [[curtain.id,'cover.test'],[vacuum.id,'vacuum.test']]){
 future.bindings[id]={entityId,verified:true};
 for(const suffix of ['', '/open','/start']){
  await assert.rejects(()=>ha.command({id:id+suffix,value:true},future),/заблокировано/);
 }
}
assert.equal(networkCalls,0,'New observation types do not gain command permissions');
ha.request=async()=>[
 {entity_id:'vacuum.test',state:'docked',attributes:{battery_level:75,access_token:'private-token',entity_picture:'/private-image'}},
 {entity_id:'cover.test',state:'closed',attributes:{current_position:0}},
 {entity_id:'lock.private',state:'locked',attributes:{}}
];
const discovered=await ha.states();
assert.equal(discovered.length,2);
assert.equal(discovered[0].attributes.battery_level,75);
assert.equal(discovered[1].attributes.current_position,0);
assert.equal(JSON.stringify(discovered).includes('private-token'),false);
assert.equal(JSON.stringify(discovered).includes('/private-image'),false);
const html=deviceStructure(q,{editing:null,esc:String,areaName:String,areas});
assert.ok(html.includes('Модель v1'));
assert.ok(html.includes('unit-climate-living'));
const editor=deviceStructure(q,{editing:'unit-climate-living',esc:String,areaName:String,areas});
assert.ok(editor.includes('data-equipment-member="temperature:living" checked'));
console.log('PASS: additive device model v1, logical groups, components, stable bindings, capabilities, imports, validation, read-only new families, no command escalation.');
