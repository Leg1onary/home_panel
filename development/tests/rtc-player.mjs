import assert from 'node:assert/strict';
const wait=ms=>new Promise(r=>setTimeout(r,ms));
class Video extends EventTarget{
 muted=true;paused=true;readyState=0;videoWidth=640;videoHeight=360;srcObject=null;
 play(){this.paused=false;return Promise.resolve()}pause(){this.paused=true}removeAttribute(){}load(){}
 canPlayType(){return 'maybe'}
 buffered={length:0};
 getVideoPlaybackQuality(){return {droppedVideoFrames:0,totalVideoFrames:50}}
}
const peers=[];let stoppedTracks=0;
globalThis.MediaStream=class{tracks=[];addTrack(t){this.tracks.push(t)}getTracks(){return this.tracks}};
globalThis.RTCPeerConnection=class{
 connectionState='new';remoteCandidates=[];transceivers=[];
 constructor(){peers.push(this)}
 addTransceiver(kind){this.transceivers.push(kind)}
 async createOffer(){return {type:'offer',sdp:'v=0\r\ns=local\r\n'}}
 async setLocalDescription(){this.onicecandidate?.({candidate:{candidate:'local',toJSON:()=>({candidate:'local',sdpMid:'0'})}})}
 async setRemoteDescription(){this.remote=true;this.ontrack?.({track:{kind:'video',stop(){stoppedTracks++}}})}
 async addIceCandidate(c){assert.ok(this.remote,'Remote candidates wait for SDP answer');this.remoteCandidates.push(c)}
 close(){this.closed=true}
};
globalThis.location={hostname:'localhost'};
globalThis.window={};
let requests=[],eventRound=0,delayedStart,holdStart=false;
globalThis.fetch=async(url,options={})=>{
 requests.push({url,method:options.method});
 if(url.endsWith('/rtc/start')){
  if(holdStart)await new Promise(r=>delayedStart=r);
  return {ok:true,json:async()=>({key:'rtc-key',configuration:{iceServers:[]}})};
 }
 if(url.includes('/events?'))return {ok:true,json:async()=>eventRound++?{events:[],cursor:3}:{events:[
  {seq:1,type:'candidate',candidate:{candidate:'remote'}},
  {seq:2,type:'session'},
  {seq:3,type:'answer',answer:'v=0\r\ns=answer\r\n'},
 ],cursor:3}};
 if(url.endsWith('/stream/start'))return {ok:true,json:async()=>({key:'hls-key',url:'ha/stream/hls-key/master_playlist.m3u8'})};
 return {ok:true,json:async()=>({accepted:true})};
};
const {startCameraPlayer}=await import('../src/camera-player.js');
const v=new Video(),status={textContent:''},player=startCameraPlayer('camera-yard',v,status);
await player.ready;await wait(30);
assert.deepEqual(peers[0].transceivers,['audio','video']);
assert.equal(peers[0].remoteCandidates[0].sdpMid,'0');
assert.ok(v.srcObject);assert.equal(v.srcObject.getTracks().length,1);
assert.ok(requests.some(r=>r.url.endsWith('/candidate')));
v.readyState=4;v.dispatchEvent(new Event('playing'));assert.match(status.textContent,/Прямой эфир · WebRTC/);
assert.ok(!requests.some(r=>r.url.includes('/stream/')),'Do not start HLS in parallel');
player.stop();await wait(10);assert.equal(v.srcObject,null);assert.equal(stoppedTracks,1);assert.ok(peers[0].closed);
assert.equal(requests.filter(r=>r.method==='DELETE').length,1);
const text=status.textContent;v.dispatchEvent(new Event('playing'));assert.equal(status.textContent,text);
holdStart=true;
const late=startCameraPlayer('camera-yard',new Video(),{textContent:''});
late.stop();delayedStart();await late.ready;await wait(10);
assert.equal(peers.length,1,'Stop during creation never creates a peer');
assert.equal(requests.filter(r=>r.method==='DELETE').length,2,'Late server session is released');
holdStart=false;
const hlsInstances=[];
window.HomePanelHls=class{
 static DefaultConfig={loader:class{}};
 static Events={MANIFEST_PARSED:'manifest',ERROR:'error',LEVEL_LOADED:'level',FRAG_LOADED:'fragment'};
 static isSupported(){return true}handlers={};
 constructor(){hlsInstances.push(this)}on(e,fn){this.handlers[e]=fn}
 loadSource(){}attachMedia(){this.handlers.manifest?.('',{levels:[]})}
 destroy(){this.closed=true}
};
const forced=startCameraPlayer('camera-yard',new Video(),{textContent:''},{transport:'hls'});
await forced.ready;assert.equal(hlsInstances.length,1);assert.equal(peers.length,1);
forced.stop();
globalThis.RTCPeerConnection=undefined;
const unsupported=startCameraPlayer('camera-yard',new Video(),{textContent:''});
await unsupported.ready;assert.equal(hlsInstances.length,2);unsupported.stop();
assert.ok(hlsInstances.every(h=>h.closed));
console.log('PASS: WebRTC-only startup, recvonly tracks, ICE ordering/default mid, diagnostics, no parallel HLS, session cleanup/stop-during-start, explicit HLS and unsupported-browser fallback.');
