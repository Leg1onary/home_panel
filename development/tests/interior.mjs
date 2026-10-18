import assert from 'node:assert/strict';
import * as THREE from 'three';
import {buildInterior} from '../src/interior.js';
import {homeSummary} from '../src/home-summary.js';
const missing=homeSummary({live:true,online:true,total:15,unknown:15,on:0});
assert.equal(missing.label,'Свет временно недоступен');
assert.equal(missing.warning,true);assert.match(missing.detail,/15/);
assert.notEqual(missing.label,'Свет выключен');
assert.equal(homeSummary({live:true,online:false,total:15,unknown:15,on:0}).label,'Нет связи с домом');
assert.equal(homeSummary({live:true,online:true,total:15,unknown:2,on:3}).warning,true);
assert.equal(homeSummary({live:true,online:true,total:15,unknown:0,on:0}).label,'Свет выключен');
const scene=new THREE.Scene();
const result=buildInterior(scene,{project:([x,z])=>[x/78,z/78],roomAt:(x,z)=>z>700?'bedroom':x<190?'terrace':'living',floor:.08});
assert.ok(result.batches>10&&result.batches<60,'Furniture is batched by room/material, not hundreds of draw calls');
assert.ok(scene.children.every(o=>o.isMesh&&o.userData.room),'Every decorative batch has a room for cutaway filtering');
assert.equal(scene.children.filter(o=>o.userData.lightAccentRoom).length,2);
for(const o of scene.children){
 assert.ok(o.geometry.attributes.position.count>0);
 assert.ok([...o.geometry.attributes.position.array].every(Number.isFinite));
 o.geometry.dispose();o.material.dispose();
}
console.log('PASS: unavailable light observations stay unknown; detailed schematic interior is batched and room-tagged.');
