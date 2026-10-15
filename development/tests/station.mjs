import assert from 'node:assert/strict';
import {HomeAssistant} from '../server/ha.js';
import {defaultPreferences} from '../src/preferences.js';
import {migrateHouseProfile} from '../src/house-profile.js';
import {stationSupports,mediaFeatures} from '../src/station.js';
const p=migrateHouseProfile(defaultPreferences());p.mode='live';
p.bindings.station.verified=true;
const entity=p.bindings.station.entityId;
const e={entity_id:entity,state:'playing',attributes:{
 supported_features:mediaFeatures.PAUSE|mediaFeatures.PLAY|mediaFeatures.VOLUME_SET,
 volume_level:0.35,media_title:'Test track',media_artist:'Test artist',
 access_token:'NEVER_EXPORT',media_content_id:'https://private.invalid/secret'
}};
const ha=new HomeAssistant(),calls=[];
ha.request=async(path,body)=>{
 calls.push({path,body});
 if(path.startsWith('/api/states/'))return structuredClone(e);
 if(path==='/api/states')return [structuredClone(e)];
 if(path.endsWith('/media_pause'))e.state='paused';
 else if(path.endsWith('/media_play'))e.state='playing';
 else if(path.endsWith('/volume_set'))e.attributes.volume_level=body.volume_level;
 else throw new Error('Unexpected service');
 return [];
};
assert.equal((await ha.states())[0].attributes.media_title,'Test track');
assert.ok(!JSON.stringify(await ha.states()).includes('NEVER_EXPORT'));
assert.ok(!JSON.stringify(await ha.states()).includes('private.invalid'));
assert.equal(stationSupports(e,'playing',false),true);
await ha.command({id:'station:playing',value:false},p);assert.equal(e.state,'paused');
await ha.command({id:'station:playing',value:true},p);assert.equal(e.state,'playing');
await ha.command({id:'station:volume',value:58},p);assert.equal(e.attributes.volume_level,0.58);
const services=()=>calls.filter(c=>c.path.startsWith('/api/services/'));
assert.equal(services().length,3);
await ha.command({id:'station:volume',value:58},p);assert.equal(services().length,3);
for(const request of [{id:'station:volume',value:101},{id:'station:volume',value:0.5},{id:'station:playing',value:'true'},{id:'station:tts',value:'hello'}]){
 await assert.rejects(()=>ha.command(request,p));
}
e.attributes.supported_features=0;
await assert.rejects(()=>ha.command({id:'station:playing',value:false},p),/не поддерживается/);
e.state='unavailable';
assert.equal(stationSupports(e,'volume'),false);
await assert.rejects(()=>ha.command({id:'station:volume',value:30},p));
p.bindings.station.verified=false;
await assert.rejects(()=>ha.command({id:'station:playing',value:true},p),/не проверена/);
p.mode='demo';
await assert.rejects(()=>ha.command({id:'station:playing',value:true},p),/рабочем режиме/);
assert.equal(services().length,3);
console.log('PASS: media discovery/secret filtering, pause/play/volume readback, unchanged target no-op, features/offline/unverified locks, strict action/value allowlist, demo isolation.');
