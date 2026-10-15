// Keep LL-HLS part delivery, but prefer a jitter cushion to chasing the live edge.
// HA's 2x catch-up can increase decoder pressure and drain that cushion.
export const stableHlsConfig=Object.freeze({
 lowLatencyMode:true,
 backBufferLength:60,
 liveSyncDuration:8,
 liveMaxLatencyDuration:30,
 maxLiveSyncPlaybackRate:1,
 manifestLoadingTimeOut:30000,
 levelLoadingTimeOut:30000,
 fragLoadingTimeOut:30000,
 enableWorker:true
});
export function bufferedPlaylist(text){
 // HA's EXT-X-START commonly requests only 1–2 seconds behind the edge.
 // It overrides the configured initial live-sync position in HLS.js. Strip
 // just that start hint; retain parts, blocking reload and every media URI.
 return text.replace(/^#EXT-X-START:[^\r\n]*(?:\r?\n|$)/gm,'');
}
export function bufferedPlaylistLoader(Hls){
 return class extends Hls.DefaultConfig.loader {
  load(context,config,callbacks){
   super.load(context,config,{...callbacks,onSuccess:(response,...args)=>{
    const data=response.data;
    callbacks.onSuccess(typeof data==='string'&&data.startsWith('#EXTM3U')?
     {...response,data:bufferedPlaylist(data)}:response,...args);
   }});
  }
 };
}
export function bufferedAhead(video){
 const time=video.currentTime||0;
 for(let i=0;i<video.buffered.length;i++){
  if(video.buffered.start(i)<=time+.05&&video.buffered.end(i)>time)return video.buffered.end(i)-time;
 }
 return 0;
}
export function frameLoss(video){
 try{
  const q=video.getVideoPlaybackQuality?.();
  if(q)return `${q.droppedVideoFrames} / ${q.totalVideoFrames}`;
 }catch{}
 return Number.isFinite(video.webkitDroppedFrameCount)?String(video.webkitDroppedFrameCount):'н/д';
}
