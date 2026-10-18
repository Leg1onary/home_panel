import * as THREE from 'three';
import {OrbitControls} from 'three/addons/controls/OrbitControls.js';
import {buildInterior} from './interior.js';
import {floorVisual} from './model-state.js';
import {modelLevels} from './model-geometry.js';
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
function roomAt(x,y){
 for(const [id,points]of Object.entries(floorPoints)){
  let inside=false;
  for(let i=0,j=points.length-1;i<points.length;j=i++){
   const [xi,yi]=points[i],[xj,yj]=points[j];
   if((yi>y)!==(yj>y)&&x<(xj-xi)*(y-yi)/(yj-yi)+xi)inside=!inside;
  }
  if(inside)return id;
 }
}
function material(color,roughness=.85){return new THREE.MeshStandardMaterial({color,roughness})}
function box(scene,x,z,w,d,h,color,y=0,r=0){let m=new THREE.Mesh(new THREE.BoxGeometry(w,h,d),material(color));m.position.set(x,y+h/2,z);m.rotation.y=r;m.castShadow=true;m.receiveShadow=true;scene.add(m);return m}
function shapeFloor(scene,id,pts){
 const s=new THREE.Shape();pts.map(project).forEach(([x,z],i)=>i?s.lineTo(x,-z):s.moveTo(x,-z));s.closePath();
 const g=new THREE.ShapeGeometry(s);
 const mat=new THREE.MeshStandardMaterial({color:'#303a35',side:THREE.DoubleSide,roughness:1});
 const m=new THREE.Mesh(g,mat);m.rotation.x=-Math.PI/2;m.position.y=modelLevels.floor;m.receiveShadow=true;m.userData.room=id;scene.add(m);return m;
}
function wall(scene,a,b,height=.63){
 const axis=a[0]===b[0]?1:0,range=b[axis]-a[axis];
 const cuts=[0,1,...Object.values(floorPoints).flat().map(p=>(p[axis]-a[axis])/range).filter(t=>t>0&&t<1)];
 const sorted=[...new Set(cuts)].sort((x,y)=>x-y);
 for(let i=1;i<sorted.length;i++){
  const u=a.map((v,k)=>v+(b[k]-v)*sorted[i-1]),v=a.map((n,k)=>n+(b[k]-n)*sorted[i]);
  const [x1,z1]=project(u),[x2,z2]=project(v),dx=x2-x1,dz=z2-z1;
  const m=box(scene,(x1+x2)/2,(z1+z2)/2,Math.hypot(dx,dz),.13,height,'#a0a4b0',.09,-Math.atan2(dz,dx));
  const length=Math.hypot(v[0]-u[0],v[1]-u[1]),px=-(v[1]-u[1])/length*6,py=(v[0]-u[0])/length*6;
  m.userData.rooms=[roomAt((u[0]+v[0])/2+px,(u[1]+v[1])/2+py),roomAt((u[0]+v[0])/2-px,(u[1]+v[1])/2-py)].filter(Boolean);
 }
}
function floorLabel(scene,x,z,label,w=1.35){
 const c=document.createElement('canvas');c.width=512;c.height=100;const ctx=c.getContext('2d');ctx.font='600 54px Manrope, sans-serif';ctx.fillStyle='#292d23';ctx.textAlign='center';ctx.fillText(label,256,65);
 const t=new THREE.CanvasTexture(c);const m=new THREE.Sprite(new THREE.SpriteMaterial({map:t,depthTest:false,transparent:true,opacity:1}));m.scale.set(w,.3,1);m.position.set(x,.3,z);scene.add(m);
}
export function mountModel(canvas,rooms,state,onSelect){
 disposeModel();
 let renderer;
 try{renderer=new THREE.WebGLRenderer({canvas,antialias:true,alpha:true})}catch(e){
  canvas.hidden=true;
  canvas.insertAdjacentHTML('afterend','<div class="model-fallback" role="status"><strong>План недоступен в этом браузере</strong><p>Комнатами и устройствами можно управлять без 3D.</p><button class="secondary" data-view="rooms">Открыть список комнат</button></div>');
  return;
 }
 const modest=(navigator.hardwareConcurrency||4)<=4;
 renderer.setPixelRatio(Math.min(window.devicePixelRatio||1,modest?1:1.5));renderer.shadowMap.enabled=true;renderer.shadowMap.type=THREE.PCFSoftShadowMap;renderer.outputColorSpace=THREE.SRGBColorSpace;renderer.toneMapping=THREE.ACESFilmicToneMapping;renderer.toneMappingExposure=1.02;
 const scene=new THREE.Scene();
 const camera=new THREE.OrthographicCamera(-10,10,9,-9,.1,100);camera.position.set(12,17,16);camera.zoom=1;
 const orbit=new OrbitControls(camera,canvas);orbit.target.set(0,0,0);orbit.enablePan=false;orbit.minZoom=.45;orbit.maxZoom=3;orbit.minPolarAngle=.3;orbit.maxPolarAngle=1.1;
 // Direct manipulation: no inertia tail that keeps a wall tablet rendering.
 orbit.enableDamping=false;orbit.rotateSpeed=.45;
 scene.add(new THREE.AmbientLight('#c5cce8',1.1));
 const hemisphere=new THREE.HemisphereLight('#d7dff4','#353349',2);scene.add(hemisphere);
 const sun=new THREE.DirectionalLight('#ffe3b9',3);sun.position.set(-6,18,-9);sun.castShadow=true;sun.shadow.mapSize.set(modest?512:1024,modest?512:1024);sun.shadow.camera.left=-12;sun.shadow.camera.right=12;sun.shadow.camera.top=12;sun.shadow.camera.bottom=-12;sun.shadow.normalBias=.025;sun.shadow.bias=-.00015;scene.add(sun);
 const ground=new THREE.Mesh(new THREE.PlaneGeometry(200,200),new THREE.ShadowMaterial({opacity:.14}));ground.rotation.x=-Math.PI/2;ground.position.y=modelLevels.ground;ground.receiveShadow=true;scene.add(ground);
 scene.add(sun.target);
 const base=box(scene,1,0,7.45,12,modelLevels.houseThickness,'#363b51',modelLevels.foundationTop-modelLevels.houseThickness);base.userData.foundation=true;
 const deck=box(scene,-3.85,-1.85,2.5,8.3,modelLevels.terraceThickness,'#42455c',modelLevels.foundationTop-modelLevels.terraceThickness);deck.userData.foundation=true;
 // Living room is covered by exactly two adjacent zone faces, not a third base.
 const floors={};for(const [id,pts]of Object.entries(floorPoints))if(id!=='living')floors[id]=shapeFloor(scene,id,pts);
 // Independent living and kitchen zones, sharing one physical room.
 const zoneFloors=[
 shapeFloor(scene,'living',[[220,27],[486,27],[486,291],[220,291]]),
 shapeFloor(scene,'living',[[486,27],[744,27],[744,291],[486,291]])
 ];
 // Cutaways have solid edges, with no second visible top face.
 for(const floor of [...Object.values(floors),...zoneFloors]){
  const invisible=new THREE.MeshBasicMaterial();invisible.visible=false;
  const skirt=new THREE.Mesh(new THREE.ExtrudeGeometry(floor.geometry.parameters.shapes,{depth:.16,bevelEnabled:false}),[invisible,material('#30374c')]);
  skirt.geometry.rotateX(-Math.PI/2);skirt.position.y=modelLevels.floor-.16;
  skirt.userData.focusOnly=floor.userData.room;skirt.visible=false;skirt.castShadow=true;scene.add(skirt);
 }
 const outlines={};
 for(const [id,pts]of Object.entries(floorPoints)){
  const geometry=new THREE.BufferGeometry().setFromPoints(pts.map(project).map(([x,z])=>new THREE.Vector3(x,modelLevels.outline,z)));
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
 ];segments.forEach(([a,b],i)=>{
  if(i<25){wall(scene,a,b,i===1?.44:i===24?.26:.72);return}
  const [x1,z1]=project(a),[x2,z2]=project(b),length=Math.hypot(x2-x1,z2-z1),rotation=-Math.atan2(z2-z1,x2-x1);
  const rail=box(scene,(x1+x2)/2,(z1+z2)/2,length,.035,.035,'#363b49',.65,rotation);rail.userData.room='terrace';
  const lower=box(scene,(x1+x2)/2,(z1+z2)/2,length,.025,.025,'#363b49',.36,rotation);lower.userData.room='terrace';
  for(let j=0,n=Math.ceil(length/.8);j<=n;j++){const p=box(scene,x1+(x2-x1)*j/n,z1+(z2-z1)*j/n,.035,.035,.58,'#363b49',.09);p.userData.room='terrace'}
 });
 const interior=buildInterior(scene,{project,roomAt,floor:modelLevels.floor});
 canvas.dataset.interiorBatches=String(interior.batches);
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
 function frame(focusRoom){
  const r=canvas.getBoundingClientRect();if(!r.width||!r.height)return;
  renderer.setSize(r.width,r.height,false);
  const members=focusRoom==='living'?zoneFloors:focusRoom?[floors[focusRoom]].filter(Boolean):[...Object.values(floors),...zoneFloors];
  const bounds=new THREE.Box3();
  for(const m of members)bounds.union(new THREE.Box3().setFromObject(m));
  const center=members.length?bounds.getCenter(new THREE.Vector3()):new THREE.Vector3(0,0,0);
  const size=bounds.getSize(new THREE.Vector3()),shadowRadius=focusRoom?Math.max(size.x,size.z)*.75+1.5:12;
  sun.position.copy(center).add(new THREE.Vector3(-6,18,-9));sun.target.position.copy(center);
  Object.assign(sun.shadow.camera,{left:-shadowRadius,right:shadowRadius,top:shadowRadius,bottom:-shadowRadius});
  sun.shadow.camera.updateProjectionMatrix();sun.shadow.needsUpdate=true;
  const aspect=r.width/r.height,h=6.1;
  camera.left=-h*aspect;camera.right=h*aspect;camera.top=h;camera.bottom=-h;
  camera.zoom=1;
  camera.position.copy(center).add(new THREE.Vector3(12,16,19));orbit.target.copy(center);
  camera.updateProjectionMatrix();orbit.update();camera.updateMatrixWorld(true);
  let extentX=0,extentY=0;
  for(const m of members){
   m.updateWorldMatrix(true,false);
   const points=m.geometry.attributes.position;
   for(let i=0;i<points.count;i++)for(const lift of [0,.9]){
    const p=new THREE.Vector3().fromBufferAttribute(points,i).applyMatrix4(m.matrixWorld);p.y+=lift;p.project(camera);
    extentX=Math.max(extentX,Math.abs(p.x));extentY=Math.max(extentY,Math.abs(p.y));
   }
  }
  camera.zoom=Math.max(.45,Math.min(3,.93/(extentX||1),.90/(extentY||1)));
  canvas.dataset.fitZoom=String(camera.zoom.toFixed(3));
  camera.updateProjectionMatrix();invalidate();
 }
 const observer=new ResizeObserver(()=>frame(current?.focusRoom));observer.observe(canvas);
 current={
  renderer,scene,camera,orbit,floors,zoneFloors,outlines,observer,invalidate,frame,focusRoom:undefined,framed:false,
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
 const focusRoom=state.view==='room'&&floorPoints[state.selected]?state.selected:undefined;
 current.scene.traverse(o=>{
  if(o.userData.lightAccentRoom){
   const status=floorVisual(rooms.find(r=>r.id===o.userData.lightAccentRoom)?.channels,state).status;
   o.material.emissive.set(status==='on'||status==='partial'?'#e4a65c':'#000000');
  }
  if(o.userData.focusOnly)o.visible=Boolean(focusRoom&&o.userData.focusOnly===focusRoom);
  else if(o.userData.foundation)o.visible=!focusRoom;
  else if(o.userData.rooms)o.visible=!focusRoom||o.userData.rooms.includes(focusRoom);
  else if(o.userData.room)o.visible=(!focusRoom||o.userData.room===focusRoom);
 });
 if(!current.framed||focusRoom!==current.focusRoom){current.focusRoom=focusRoom;current.framed=true;current.frame(focusRoom)}
 current.invalidate();
}
export function resetModel(){current?.frame(current.focusRoom)}
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
