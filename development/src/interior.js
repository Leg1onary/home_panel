import * as THREE from 'three';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {mergeGeometries} from 'three/addons/utils/BufferGeometryUtils.js';

// Schematic interior dressing. It carries no device IDs or command authority.
export function buildInterior(scene,{project,roomAt,floor}){
 const materials=new Map(),geometries=new Map(),pieces=[];
 let oakGrain=null;
 if(typeof document!=='undefined'){
  const canvas=document.createElement('canvas');canvas.width=128;canvas.height=128;
  const ctx=canvas.getContext('2d');ctx.fillStyle='#ebe6dc';ctx.fillRect(0,0,128,128);
  ctx.strokeStyle='rgba(119,99,75,.18)';ctx.lineWidth=1;
  for(let i=0;i<13;i++){
   const x=i*10;ctx.beginPath();ctx.moveTo(x,0);ctx.bezierCurveTo(x+5,36,x-5,92,x,128);ctx.stroke();
  }
  oakGrain=new THREE.CanvasTexture(canvas);oakGrain.colorSpace=THREE.SRGBColorSpace;
  oakGrain.wrapS=oakGrain.wrapT=THREE.RepeatWrapping;
 }
 const palette={oak:'#a88b68',oakDark:'#69513c',linen:'#c6c1b9',cream:'#e7e0d4',ink:'#202635',metal:'#46494f',sage:'#65716d',leaf:'#435d4a',pot:'#b3a18e',rug:'#726c70'};
 const mat=(key,roughness=.82)=>{
  if(!materials.has(key))materials.set(key,new THREE.MeshStandardMaterial({color:palette[key]||key,roughness,metalness:key==='metal'?.35:0,map:['oak','oakDark'].includes(key)?oakGrain:null}));
  return materials.get(key);
 };
 const geometry=(key,create)=>{if(!geometries.has(key))geometries.set(key,create());return geometries.get(key)};
 const rounded=(w,h,d,r=.04)=>geometry(`r:${w}:${h}:${d}:${r}`,()=>new RoundedBoxGeometry(w,h,d,2,Math.min(r,w/4,h/4,d/4)));
 const mesh=(parent,g,m,x,y,z)=>{
  const o=new THREE.Mesh(g,m);o.position.set(x,y,z);o.castShadow=true;o.receiveShadow=true;parent.add(o);return o;
 };
 const block=(p,x,y,z,w,h,d,key,r=.035)=>mesh(p,rounded(w,h,d,r),mat(key),x,y+h/2,z);
 const cylinder=(p,x,y,z,rt,rb,h,key)=>mesh(p,geometry(`c:${rt}:${rb}:${h}`,()=>new THREE.CylinderGeometry(rt,rb,h,12)),mat(key),x,y+h/2,z);
 const piece=(x,z,build)=>{
  const group=new THREE.Group(),point=project([x,z]);group.position.set(point[0],floor+.012,point[1]);
  group.userData.room=roomAt(x,z);scene.add(group);pieces.push(group);build(group);return group;
 };
 const legs=(p,w,d,h=.16)=>{
  for(const x of [-w/2+.08,w/2-.08])for(const z of [-d/2+.08,d/2-.08])cylinder(p,x,0,z,.018,.014,h,'oakDark');
 };
 function plant(x,z,scale=1){
  piece(x,z,p=>{
   p.scale.setScalar(scale);
   cylinder(p,0,0,0,.16,.11,.29,'pot');
   cylinder(p,0,.27,0,.013,.015,.45,'oakDark');
   for(let i=0;i<5;i++){
    const a=i*2.4,leaf=mesh(p,geometry('leaf',()=>new THREE.SphereGeometry(1,8,6)),mat('leaf'),Math.sin(a)*.12,.55+i*.045,Math.cos(a)*.12);
    leaf.scale.set(.10,.28,.055);leaf.rotation.set(Math.cos(a)*.6,0,-Math.sin(a)*.6);
   }
  });
 }
 function lamp(p,x,z){
  cylinder(p,x,.34,z,.08,.09,.025,'metal');
  cylinder(p,x,.36,z,.012,.012,.16,'metal');
  cylinder(p,x,.50,z,.07,.11,.14,'cream');
  const bulb=cylinder(p,x,.48,z,.045,.045,.03,'cream');
  bulb.material=bulb.material.clone();bulb.userData.lightAccentRoom=p.userData.room;
 }
 function bed(x,z,blanket){
  piece(x,z,p=>{
   legs(p,1.62,2,.12);
   block(p,0,.12,0,1.62,.18,2,'oak');
   block(p,0,.30,0,1.51,.22,1.94,'cream',.08);
   block(p,0,.12,-1.02,1.76,.70,.12,'linen',.07);
   block(p,0,.523,.35,1.49,.024,1.15,blanket,.015);
   block(p,0,.549,.73,1.5,.035,.30,'linen',.015);
   for(const xx of [-.39,.39]){
    const pillow=block(p,xx,.53,-.63,.64,.12,.43,'cream',.09);pillow.rotation.y=xx*.1;
   }
   for(const xx of [-1.02,1.02]){
    block(p,xx,.04,-.69,.35,.32,.42,'oak');
    block(p,xx,.367,-.69,.37,.018,.44,'oakDark',.01);
    block(p,xx,.18,-.472,.25,.012,.015,'metal',.005);
   }
   lamp(p,-1.02,-.69);
  });
 }
 // Living room: upholstered seating, inset rug and layered coffee table.
 piece(320,135,p=>{
  block(p,0,.007,0,2.64,.018,1.95,'rug',.08);
  block(p,-.36,.12,-.63,1.93,.26,.73,'linen',.08);
  block(p,-.36,.33,-.94,1.96,.43,.16,'linen',.08);
  block(p,-1.30,.16,-.65,.14,.49,.84,'linen',.06);
  block(p,.59,.16,-.65,.14,.49,.84,'linen',.06);
  for(let i=0;i<3;i++)block(p,-.94+i*.59,.38,-.61,.55,.13,.60,'cream',.08);
  const pillow=block(p,-1.01,.51,-.77,.37,.32,.13,'sage',.06);pillow.rotation.z=.24;
  legs(p,1.90,.68,.14);
  block(p,.40,.08,.30,.85,.27,.57,'oakDark',.06);
  block(p,.40,.35,.30,.92,.045,.63,'oak',.025);
  block(p,.48,.40,.27,.30,.025,.23,'cream',.01);
  cylinder(p,.14,.40,.40,.05,.04,.09,'pot');
 });
 piece(336,262,p=>{
  block(p,0,.08,0,1.82,.25,.35,'oak');
  block(p,0,.42,.04,1.31,.70,.055,'ink',.02);
  block(p,0,.33,.04,.05,.10,.10,'metal');
  for(const x of [-.63,0,.63])block(p,x,.20,.18,.48,.009,.009,'oakDark',.001);
 });
 // Kitchen: cabinet divisions, countertop, inset hob and sink.
 piece(642,53,p=>{
  block(p,0,0,0,2.05,.58,.48,'oak');
  block(p,0,.58,0,2.13,.045,.54,'cream',.014);
  for(let i=0;i<5;i++){
   block(p,-.82+i*.41,.025,.249,.39,.52,.018,'linen',.005);
   block(p,-.82+i*.41,.43,.263,.18,.014,.012,'metal',.003);
  }
  block(p,-.45,.63,0,.59,.014,.37,'ink',.006);
  for(const x of [-.60,-.31])for(const z of [-.08,.08]){
   const ring=mesh(p,geometry('hob',()=>new THREE.TorusGeometry(.057,.006,4,12)),mat('metal'),x,.647,z);ring.rotation.x=Math.PI/2;
  }
  block(p,.51,.63,0,.48,.012,.32,'metal',.04);
  block(p,.51,.645,0,.36,.008,.24,'ink',.03);
  cylinder(p,.51,.65,-.17,.012,.012,.16,'metal');
 });
 piece(715,111,p=>{
  block(p,0,0,0,.39,.58,1.02,'oak');
  block(p,0,.58,0,.45,.045,1.07,'cream',.014);
  for(const z of [-.34,0,.34])block(p,-.203,.03,z,.018,.51,.31,'linen',.005);
 });
 piece(637,158,p=>{
  cylinder(p,0,.06,0,.055,.14,.47,'oakDark');
  block(p,0,.53,0,.88,.06,.74,'oak',.09);
  cylinder(p,.05,.60,0,.075,.06,.14,'pot');
  for(const x of [-.66,.66]){
   const chair=new THREE.Group();chair.position.set(x,0,0);p.add(chair);
   legs(chair,.42,.45,.29);
   block(chair,0,.29,0,.45,.08,.45,'sage',.06);
   block(chair,x<0?-.19:.19,.34,0,.08,.35,.46,'sage',.05);
  }
 });
 // Desk, upholstered chair and shelving.
 piece(650,354,p=>{
  legs(p,1.52,.63,.52);block(p,0,.52,0,1.62,.06,.69,'oak');
  block(p,-.23,.72,-.13,.69,.41,.035,'ink',.012);
  block(p,-.23,.58,-.13,.04,.14,.08,'metal');
  block(p,-.23,.61,.18,.49,.013,.16,'metal',.008);
  block(p,.42,.61,.13,.21,.035,.27,'cream',.008);
 });
 piece(644,425,p=>{
  cylinder(p,0,0,0,.22,.22,.035,'metal');cylinder(p,0,.03,0,.024,.024,.30,'metal');
  block(p,0,.33,0,.50,.10,.48,'sage',.07);
  block(p,0,.40,.21,.50,.44,.09,'sage',.06);
 });
 bed(321,825,'#8a9698');bed(635,820,'#a1968b');
 piece(253,568,p=>{
  block(p,0,.015,0,.60,.32,1.13,'cream',.14);
  block(p,0,.338,0,.44,.015,.91,'#a8b0b1',.11);
 });
 piece(368,548,p=>{
  block(p,0,0,0,.52,.44,.42,'oak');
  block(p,0,.45,0,.55,.055,.44,'cream',.03);
  cylinder(p,0,.51,0,.11,.13,.04,'cream');
 });
 piece(293,471,p=>{
  cylinder(p,0,0,0,.16,.16,.28,'cream');
  block(p,0,.27,.06,.35,.08,.44,'cream',.12);
  block(p,0,.28,-.19,.32,.37,.12,'cream',.06);
 });
 piece(371,470,p=>{block(p,0,0,0,.53,.56,.48,'metal');block(p,0,.56,0,.56,.035,.52,'ink',.01)});
 piece(666,618,p=>{
  block(p,0,0,0,1.38,.60,.39,'oakDark');
  for(const y of [.10,.32,.55])block(p,0,y,-.01,1.44,.04,.43,'oak');
  for(let i=0;i<6;i++)block(p,-.52+i*.20,.36,-.02,.13,.17,.21,i%2?'linen':'sage',.008);
 });
 piece(87,128,p=>{
  block(p,0,.02,0,1.59,.02,1.54,'#77706a',.10);
  block(p,0,.16,-.38,1.41,.22,.48,'oakDark');
  block(p,0,.38,-.38,1.39,.10,.48,'linen',.06);
  block(p,0,.34,-.62,1.41,.37,.09,'linen');
  block(p,.28,.10,.40,.62,.32,.50,'oak');
 });
 plant(248,245,.85);plant(710,708,.8);plant(158,545,1.15);
 // Batch decorative meshes by room/material. Detailed furniture must not mean
 // hundreds of extra draw calls on the old tablet.
 scene.updateMatrixWorld(true);
 const batches=new Map();
 for(const p of pieces)p.traverse(o=>{
  if(!o.isMesh)return;
  const transformed=o.geometry.clone().applyMatrix4(o.matrixWorld);
  const g=transformed.index?transformed.toNonIndexed():transformed;if(g!==transformed)transformed.dispose();
  if(o.userData.lightAccentRoom){
   const accent=new THREE.Mesh(g,o.material);accent.userData={room:p.userData.room,lightAccentRoom:o.userData.lightAccentRoom};
   accent.castShadow=true;scene.add(accent);return;
  }
  const key=p.userData.room+':'+o.material.uuid;
  if(!batches.has(key))batches.set(key,{room:p.userData.room,material:o.material,geometries:[]});
  batches.get(key).geometries.push(g);
 });
 for(const p of pieces)scene.remove(p);
 for(const batch of batches.values()){
  const merged=mergeGeometries(batch.geometries,false);
  if(!merged)throw new Error('Interior geometry could not be batched');
  for(const g of batch.geometries)g.dispose();
  const o=new THREE.Mesh(merged,batch.material);o.userData.room=batch.room;o.castShadow=true;o.receiveShadow=true;scene.add(o);
 }
 for(const g of geometries.values())g.dispose();
 return {batches:batches.size};
}
