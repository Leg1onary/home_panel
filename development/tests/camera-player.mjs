import assert from 'node:assert/strict';
import {stableHlsConfig,bufferedAhead,frameLoss} from '../src/camera-policy.js';
assert.equal(stableHlsConfig.lowLatencyMode,false);
assert.ok(stableHlsConfig.maxBufferLength>=30);
assert.ok(stableHlsConfig.backBufferLength>=30);
assert.equal(stableHlsConfig.maxLiveSyncPlaybackRate,1);
const wait=ms=>new Promise(r=>setTimeout(r,ms));
class Video extends EventTarget {
 currentTime=3;videoWidth=1920;videoHeight=1080;paused=false;
 buffered={length:1,start:()=>0,end:()=>15};
 play(){this.paused=false;return Promise.resolve()}
 pause(){this.paused=true}
 removeAttribute(){}
 load(){}
 canPlayType(){return 'maybe'}
 getVideoPlaybackQuality(){return {droppedVideoFrames:2,totalVideoFrames:120}}
}
assert.equal(bufferedAhead(new Video()),12);
assert.equal(frameLoss(new Video()),'2 / 120');
let instances=[],releases=0;
class FakeHls {
 static Events={MANIFEST_PARSED:'manifest',ERROR:'error'};
 static ErrorTypes={MEDIA_ERROR:'media',NETWORK_ERROR:'network'};
 static isSupported(){return true}
 handlers={};sources=0;recoveries=0;loads=0;
 constructor(config){this.config=config;instances.push(this)}
 on(type,fn){this.handlers[type]=fn}
 emit(type,data){this.handlers[type]?.(type,data)}
 loadSource(){this.sources++}
 attachMedia(){this.emit('manifest',{levels:[{videoCodec:'avc1.4d0029'}]})}
 recoverMediaError(){this.recoveries++}
 startLoad(){this.loads++}
 destroy(){this.destroyed=true}
}
globalThis.window={HomePanelHls:FakeHls};
globalThis.location={hostname:'localhost'};
globalThis.fetch=async(url,options)=>{
 if(options.method==='DELETE')releases++;
 return {ok:true,json:async()=>({key:'test-session',url:'ha/stream/test-session/master_playlist.m3u8'})};
};
const {startCameraPlayer}=await import('../src/camera-player.js');
const status={textContent:''},video=new Video();
const player=startCameraPlayer('camera-yard',video,status);
await player.ready;
let hls=instances.at(-1);
assert.equal(hls.sources,1);assert.deepEqual(hls.config,stableHlsConfig);
video.dispatchEvent(new Event('playing'));
assert.match(status.textContent,/буфер 12.0 с/);
assert.match(status.textContent,/пропущено кадров 2 \/ 120/);
video.dispatchEvent(new Event('waiting'));video.dispatchEvent(new Event('waiting'));
assert.match(status.textContent,/остановок 1/);
video.dispatchEvent(new Event('playing'));
hls.emit('error',{fatal:false,details:'bufferStalledError'});
assert.ok(!hls.destroyed,'Nonfatal buffer errors do not restart or destroy playback');
hls.emit('error',{fatal:true,type:'media',details:'bufferAppendError'});
await wait(230);
assert.equal(hls.recoveries,1);assert.equal(hls.sources,1,'Decoder recovery must never reload the source');
video.dispatchEvent(new Event('playing'));
hls.emit('error',{fatal:true,type:'media',details:'bufferAppendError'});
assert.equal(hls.destroyed,true,'Only one decoder recovery per session');
assert.match(status.textContent,/bufferAppendError/);
const stoppedStatus=status.textContent;
video.dispatchEvent(new Event('waiting'));
assert.equal(status.textContent,stoppedStatus,'Disposed events cannot update UI or arm timers');
player.stop();
const netVideo=new Video(),netStatus={textContent:''};
const net=startCameraPlayer('camera-yard',netVideo,netStatus);await net.ready;hls=instances.at(-1);
for(let i=1;i<=2;i++){
 hls.emit('error',{fatal:true,type:'network',details:'fragLoadError'});
 await wait(i*1500+60);
 assert.equal(hls.loads,i);
 netVideo.dispatchEvent(new Event('playing'));
}
hls.emit('error',{fatal:true,type:'network',details:'fragLoadError'});
assert.equal(hls.destroyed,true,'Network retries are bounded');
assert.equal(hls.sources,1,'Network retry must not recreate the stream');
net.stop();await wait(10);
assert.equal(releases,2);
console.log('PASS: stable HLS policy, real buffer/frame diagnostics, stall counting, MSE preference, one decoder recovery, two network retries, no source reload or disposed-event timers.');
