import assert from 'node:assert/strict';
import {stableHlsConfig,bufferedPlaylist,bufferedPlaylistLoader,bufferedAhead,frameLoss} from '../src/camera-policy.js';
assert.equal(stableHlsConfig.lowLatencyMode,true);
assert.equal(stableHlsConfig.backBufferLength,60);
assert.equal(stableHlsConfig.maxLiveSyncPlaybackRate,1,'Never accelerate the decoder to catch up');
assert.equal(stableHlsConfig.liveSyncDuration,8);
assert.equal(stableHlsConfig.liveMaxLatencyDuration,30);
assert.equal(stableHlsConfig.liveSyncDurationCount,undefined,'Use seconds, not segment counts');
assert.equal(stableHlsConfig.maxBufferLength,undefined,'Use HA/HLS.js buffer defaults');
const playlist='#EXTM3U\r\n#EXT-X-START:TIME-OFFSET=-2,PRECISE=YES\r\n#EXT-X-PART-INF:PART-TARGET=1\r\n#EXT-X-PART:DURATION=1,URI="segment/1.0.m4s"\r\n';
assert.equal(bufferedPlaylist(playlist),playlist.replace('#EXT-X-START:TIME-OFFSET=-2,PRECISE=YES\r\n',''));
assert.equal(bufferedPlaylist('#EXTM3U\n#EXT-X-START:TIME-OFFSET=-1'),'#EXTM3U\n');
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
 static DefaultConfig={loader:class {load(context,config,callbacks){callbacks.onSuccess(context.response,'stats',context,'network')}}};
 static Events={MANIFEST_PARSED:'manifest',ERROR:'error',LEVEL_LOADED:'level',FRAG_LOADED:'fragment'};
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
const Loader=bufferedPlaylistLoader(FakeHls),loader=new Loader();
const original={data:playlist,url:'/safe/playlist.m3u8'};
let loaded;
loader.load({response:original},{},{onSuccess:(...args)=>{loaded=args}});
assert.equal(loaded[0].data,bufferedPlaylist(playlist));assert.equal(original.data,playlist);
assert.equal(loaded[0].url,original.url);assert.equal(loaded[1],'stats');assert.equal(loaded[3],'network');
const binary={data:new Uint8Array([1,2,3])};
loader.load({response:binary},{},{onSuccess:r=>{assert.equal(r,binary)}});
const noHint={data:'#EXTM3U\n#EXTINF:1,\nsegment/1.m4s\n'};
loader.load({response:noHint},{},{onSuccess:r=>{assert.equal(r.data,noHint.data)}});
globalThis.window={HomePanelHls:FakeHls};
globalThis.location={hostname:'localhost'};
globalThis.fetch=async(url,options)=>{
 if(options.method==='DELETE')releases++;
 return {ok:true,json:async()=>({key:'test-session',url:'ha/stream/test-session/master_playlist.m3u8'})};
};
const {startHlsCameraPlayer:startCameraPlayer}=await import('../src/hls-camera-player.js');
const status={textContent:''},video=new Video();
const player=startCameraPlayer('camera-yard',video,status);
await player.ready;
let hls=instances.at(-1);
assert.equal(hls.sources,1);const {pLoader,...policy}=hls.config;
assert.deepEqual(policy,stableHlsConfig);assert.equal(typeof pLoader,'function');
video.dispatchEvent(new Event('playing'));
assert.match(status.textContent,/буфер 12.0 с/);
assert.match(status.textContent,/пропущено кадров 2 \/ 120/);
assert.match(status.textContent,/скорость 1.00×/);assert.match(status.textContent,/стабильный режим/);
hls.latency=8.25;video.dispatchEvent(new Event('playing'));assert.match(status.textContent,/задержка 8.3 с/);
hls.emit('level',{details:{partTarget:1}});
hls.emit('fragment',{part:{index:0}});
video.dispatchEvent(new Event('playing'));
assert.match(status.textContent,/LL-HLS/);assert.match(status.textContent,/частей 1/);
hls.emit('level',{details:{partTarget:0}});
video.dispatchEvent(new Event('playing'));
assert.ok(!status.textContent.includes('LL-HLS'),'Normal playlists remain supported without a manual switch');
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
console.log('PASS: buffered LL-HLS at 1x, narrow start-hint removal, loader callback/binary safety, part delivery, ordinary HLS fallback, rate/latency/frame diagnostics, bounded recovery and cleanup.');
