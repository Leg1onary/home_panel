// Follow Home Assistant's one-camera HLS profile. LL-HLS playlists advertise
// short parts and a part-level start offset; do not force whole-segment mode.
// https://raw.githubusercontent.com/home-assistant/frontend/dev/src/components/ha-hls-player.ts
export const stableHlsConfig=Object.freeze({
 lowLatencyMode:true,
 backBufferLength:60,
 maxLiveSyncPlaybackRate:2,
 manifestLoadingTimeOut:30000,
 levelLoadingTimeOut:30000,
 fragLoadingTimeOut:30000,
 enableWorker:true
});
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
