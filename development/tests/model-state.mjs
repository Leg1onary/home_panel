import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
import {floorVisual,floorPalette} from '../src/model-state.js';
const channels=[{id:'bath:0',on:false},{id:'bath:1',on:false}];
assert.equal(floorVisual(channels,{mode:'demo'}).status,'off');
assert.equal(floorVisual([{id:'bath:0',on:true},channels[1]],{mode:'demo'}).status,'partial');
assert.equal(floorVisual(channels.map(c=>({...c,on:true})),{mode:'demo'}).status,'on');
assert.equal(floorVisual(channels,{mode:'demo',demoOffline:true}).status,'unknown');
assert.equal(floorVisual([{planned:true}],{mode:'demo'}).status,'uncontrolled');
const live={mode:'live',liveOnline:true,bindings:{
 'bath:0':{entityId:'light.left',verified:true},'bath:1':{entityId:'light.right',verified:true}
},entityStates:{'light.left':{state:'off'},'light.right':{state:'off'}}};
assert.equal(floorVisual(channels,live).color,floorPalette.off);
live.entityStates['light.right'].state='unavailable';
assert.equal(floorVisual(channels,live).status,'unknown');
live.entityStates['light.left'].state='on';
assert.equal(floorVisual(channels,live).status,'partial');
live.liveOnline=false;
assert.equal(floorVisual(channels,live).status,'unknown');
assert.equal(floorVisual([],live).status,'uncontrolled');
const source=await readFile('src/model.js','utf8');
assert.ok(!source.includes('woodTexture'),'No high frequency floor texture');
assert.match(source,/if\(id!=='living'\)/,'No overlapping living base beneath the two zones');
assert.ok(source.includes('LineLoop'),'Selection is an outline, not a light state');
console.log('PASS: flat floor lighting off/partial/on/unknown, offline and planned states, no texture or overlapping living base, independent selection outline.');
