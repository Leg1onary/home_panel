import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {RoundedBoxGeometry} from 'three/addons/geometries/RoundedBoxGeometry.js';
import {floorVisual} from './model-state.js';
let current;
const floorPoints={
 living:[[220,27],[744,27],[744,291],[220,291]],
 hall:[[220,302],[422,302],[422,408],[220,408]],
 utility:[[220,433],[422,433],[422,503],[220,503]],
 bath:[[220,517],[422,517],[422,640],[220,640]],
 children:[[220,655],[422,655],[422,775],[464,775],[464,918],[220,918]],
 office:[[548,302],[744,302],[744,560],[548,560]],
 pantry:[[548,576],[744,576],[744,657],[548,657]],
 bedroom:[[548,674],[744,674],[744,918],[478,918],[478,775],[548,775]],
 corridor:[[436,302],[533,302],[533,759],[436,759]],
 terrace:[[0,0],[190,0],[190,640],[0,640]]
};
const project=([x,y])=>[(x-390)/78,(y-470)/78];
function material(color,roughness=.85){return new THREE.MeshStandardMaterial({color,roughness})}
function box(scene,x,z,w,d,h,color,y=0,r=0){let m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material(color));m.position.set(x,y+h/2,z);m.rotation.y=r;m.castShadow=true;m.receiveShadow=true;scene.add(m);return m}
function shapeFloor(scene,id,pts){
 const s=new THREE.Shape();pts.map(project).forEach(([x,z],i)=>i?s.lineTo(x,-z):s.moveTo(x,-z));s.closePath();
 const g=new THREE.ShapeGeometry(s);
 const mat=new THREE.MeshBasicMaterial({color:'#303a35',side:THREE.DoubleSide,toneMapped:false});
 const m=new THREE.Mesh(g,mat);m.rotation.x=-Math.PI/2;m.position.y=.08;m.userData.room=id;scene.add(m);return m;
}
function wall(scene,a,b,height=.63){
 const [x1,z1]=project(a),[x2,z2]=project(b),dx=x2-x1,dz=z2-z1;
 return box(scene,(x1+x2)/2,(z1+z2)/2,Math.hypot(dx,dz),.13,height,'#dfdccf',.09,-Math.atan2(dz,dx));
}
function floorLabel(scene,x,z,label,w=1.35){
 const c=document.createElement('canvas');c.width=512;c.height=100;const ctx=c.getContext('2d');ctx.font='600 54px Manrope, sans-serif';ctx.fillStyle='#292d23';ctx.textAlign='center';ctx.fillText(label,256,65);
 const t=new THREE.CanvasTexture(c);const m=new THREE.Sprite(new THREE.SpriteMaterial({map:t,depthTest:false,transparent:true,opacity:1}));m.scale.set(w,.3,1);m.position.set(x,.3,z);scene.add(m);
}
export function mountModel(canvas,rooms,state,onSelect){
 disposeModel();
 let renderer;
 try{renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:true})}catch(e){canvas.insertAdjacentHTML('afterend','<p class="inline-note">Объёмный режим недоступен в этом браузере. Все комнаты доступны во вкладке «Свет».</p>');return}
 renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,2));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.22;
 const scene=new THREE.Scene();
 const camera=new THREE.OrthographicCamera(-10,10,9,-9,.1,100);camera.position.set(10,16,16);camera.zoom=1.3;
 const orbit=new OrbitControls(camera,canvas);orbit.target.set(0,0,0);orbit.enablePan=false;orbit.minZoom=.72;orbit.maxZoom=1.8;orbit.minPolarAngle=.3;orbit.maxPolarAngle=1.1;
 // Direct manipulation: no inertia tail that keeps a wall tablet rendering.
 orbit.enableDamping=false;orbit.rotateSpeed=.45;
 scene.add(new THREE.AmbientLight('#e9dfca',1.2));
 const hemisphere=new THREE.HemisphereLight('#f3f0e9','#625d50',2);scene.add(hemisphere);
 const sun=new THREE.DirectionalLight('#ffedcf',3);sun.position.set(-6,18,-9);sun.castShadow=true;sun.shadow.mapSize.set(2048,2048);sun.shadow.camera.left=-12;sun.shadow.camera.right=12;sun.shadow.camera.top=12;sun.shadow.camera.bottom=-12;sun.shadow.normalBias=.025;sun.shadow.bias=-.00015;scene.add(sun);
 const ground=new THREE.Mesh(new THREE.PlaneGeometry(200,200),new THREE.ShadowMaterial({opacity:.24}));ground.rotation.x=-Math.PI/2;ground.position.y=-.11;ground.receiveShadow=true;scene.add(ground);
 box(scene,1,0,7.45,12,.18,'#9c998b',-.1);box(scene,-3.85,-1.85,2.5,8.3,.14,'#6c6e60',-.1);
 // Living room is covered by exactly two adjacent zone faces, not a third base.
 const floors={};for(const [id,pts]of Object.entries(floorPoints))if(id!=='living')floors[id]=shapeFloor(scene,id,pts);
 // Independent living and kitchen zones, sharing one physical room.
 const zoneFloors=[
 shapeFloor(scene,'living',[[220,27],[486,27],[486,291],[220,291]]),
 shapeFloor(scene,'living',[[486,27],[744,27],[744,291],[486,291]])
 ];
 const outlines={};
 for(const [id,pts]of Object.entries(floorPoints)){
  const geometry=new THREE.BufferGeometry().setFromPoints(pts.map(project).map(([x,z])=>new THREE.Vector3(x,.095,z)));
  const outline=new THREE.LineLoop(geometry,new THREE.LineBasicMaterial({color:'#d5e7b0',toneMapped:false}));
  outline.visible=false;scene.add(outline);outlines[id]=outline;
 }
 const segments=[
 [[220,27],[744,27]],[[744,27],[744,918]],[[220,27],[220,285]],
 [[220,302],[220,408]],[[220,433],[220,503]],[[220,517],[220,640]],[[220,655],[220,918]],
 [[220,291],[448,291]],[[523,291],[744,291]],[[220,408],[422,408]],[[220,503],[422,503]],[[220,640],[422,640]],
 [[422,302],[422,327]],[[422,389],[422,435]],[[422,493],[422,553]],[[422,620],[422,704]],
 [[548,302],[548,429]],[[548,492],[548,590]],[[548,645],[548,685]],[[548,750],[548,775]],
 [[548,560],[744,560]],[[548,657],[744,657]],[[478,775],[548,775]],[[478,775],[478,918]],[[220,918],[744,918]],
 [[0,0],[190,0]],[[0,0],[0,640]],[[0,640],[190,640]]
 ];segments.forEach(([a,b],i)=>wall(scene,a,b,i>=23?.24:.63));
 // Conditional, schematic furniture. No actual furniture layout is asserted.
 const f=(x,z,w,d,h,c,y=0)=>{const p=project([x,z]);const m=new THREE.Mesh(new RoundedBoxGeometry(w/78,h,d/78,3,Math.min(.06,h/3)),material(c));m.position.set(p[0],y+.12+h/2,p[1]);m.castShadow=true;m.receiveShadow=true;scene.add(m);return m};
 f(303,90,123,52,.3,'#d3cbbb');f(303,66,123,15,.54,'#c1b5a1');f(249,104,15,73,.49,'#c1b5a1');f(357,137,45,40,.23,'#6a5b47');
 f(290,92,40,43,.09,'#e0d7c4',.3);f(335,92,40,43,.09,'#e0d7c4',.3);
 f(648,55,150,34,.46,'#dedaca');f(705,113,35,88,.46,'#dedaca');f(636,154,69,55,.4,'#8b7357');
 f(651,359,122,50,.42,'#9a8569');f(641,431,38,41,.29,'#e0d6c5');f(321,825,123,156,.24,'#a99274');f(321,825,110,147,.28,'#d6d0bf',.18);f(321,757,107,28,.12,'#eeeadb',.48);
 f(635,820,123,156,.24,'#a99274');f(635,820,110,147,.28,'#d6d0bf',.18);f(635,752,107,28,.12,'#eeeadb',.48);
 f(253,568,40,76,.22,'#e7e4d7');f(253,568,31,64,.04,'#b6b9b0',.22);
 f(675,618,100,30,.47,'#a89372');f(291,472,38,30,.25,'#e2e4d9');f(371,472,39,35,.52,'#73766d');
 f(87,113,100,38,.25,'#b0a48c');f(73,172,38,30,.2,'#665b4a');
 // Room names are shown in the readable HTML inspector, not tiny 3D labels.
 const ray=new THREE.Raycaster(),pointer=new THREE.Vector2();let down;
 const select=e=>{if(!down||Math.hypot(e.clientX-down[0],e.clientY-down[1])>8)return;const r=canvas.getBoundingClientRect();pointer.set((e.clientX-r.left)/r.width*2-1,-((e.clientY-r.top)/r.height)*2+1);ray.setFromCamera(pointer,camera);const hit=ray.intersectObjects([...Object.values(floors),...zoneFloors])[0];if(hit)onSelect(hit.object.userData.room)};
 const pointerDown=e=>{down=[e.clientX,e.clientY]};
 canvas.addEventListener('pointerdown',pointerDown);canvas.addEventListener('pointerup',select);
 let raf=0,paused=false,dead=false,frames=0;
 function invalidate(){
  if(!raf&&!dead&&!paused&&!document.hidden)raf=requestAnimationFrame(draw);
 }
 function draw(){
  raf=0;if(dead||paused||document.hidden)return;
  const moving=orbit.update();
  renderer.render(scene,camera);canvas.dataset.renderFrames=String(++frames);
  if(moving)invalidate();
 }
 const visibility=()=>{
  if(document.hidden){cancelAnimationFrame(raf);raf=0}else invalidate();
 };
 orbit.addEventListener('change',invalidate);
 document.addEventListener('visibilitychange',visibility);
 const observer=new ResizeObserver(()=>{
  const r=canvas.getBoundingClientRect();renderer.setSize(r.width,r.height,false);
  const aspect=r.width/r.height,h=7.3;
  camera.left=-h*aspect;camera.right=h*aspect;camera.top=h;camera.bottom=-h;
  camera.zoom=r.width<600?.78:1.3;camera.updateProjectionMatrix();invalidate();
 });observer.observe(canvas);
 current={
  renderer,scene,camera,orbit,floors,zoneFloors,outlines,observer,invalidate,
  setPaused:value=>{paused=value;if(value){cancelAnimationFrame(raf);raf=0}else invalidate()},
  cancel:()=>{
   dead=true;cancelAnimationFrame(raf);orbit.removeEventListener('change',invalidate);
   document.removeEventListener('visibilitychange',visibility);
   canvas.removeEventListener('pointerdown',pointerDown);canvas.removeEventListener('pointerup',select);
  }
 };
 updateModel(rooms,state);
}
export function updateModel(rooms,state){
 if(!current)return;
 const {floors,zoneFloors,outlines}=current;
 for(const [id,m]of Object.entries(floors)){
   const visual=floorVisual(rooms.find(x=>x.id===id)?.channels,state);
   m.material.color.set(visual.color);
 }
 zoneFloors.forEach((m,i)=>{
  const c=rooms.find(x=>x.id==='living')?.channels.find(c=>c.id===`living:${i}`);
  m.material.color.set(floorVisual(c?[c]:[],state).color);
 });
 for(const [id,outline]of Object.entries(outlines))outline.visible=state.selected===id;
 current.invalidate();
}
export function resetModel(){if(current){current.camera.position.set(10,16,16);current.camera.zoom=current.renderer.domElement.clientWidth<600?.78:1.3;current.orbit.target.set(0,0,0);current.camera.updateProjectionMatrix();current.orbit.update();current.invalidate()}}
export function setModelPaused(paused){current?.setPaused(paused)}
export function disposeModel(){
 if(!current)return;
 current.cancel();current.observer.disconnect();current.orbit.dispose();
 const textures=new Set(),materials=new Set(),geometries=new Set();
 current.scene.traverse(o=>{
  if(o.geometry)geometries.add(o.geometry);
  if(o.material)for(const m of Array.isArray(o.material)?o.material:[o.material]){
   materials.add(m);if(m.map)textures.add(m.map);
  }
 });
 textures.forEach(t=>t.dispose());materials.forEach(m=>m.dispose());geometries.forEach(g=>g.dispose());
 current.renderer.dispose();current=null;
}
