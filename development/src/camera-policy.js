// Prefer continuity over minimum live latency on wall tablets.
export const stableHlsConfig=Object.freeze({
 lowLatencyMode:false,
 maxBufferLength:30,
 maxMaxBufferLength:60,
 backBufferLength:30,
 liveSyncDurationCount:4,
 maxLiveSyncPlaybackRate:1,
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
