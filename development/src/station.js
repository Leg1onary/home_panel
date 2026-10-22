// HA MediaPlayerEntityFeature flags, not service names supplied by a client.
export const mediaFeatures={PAUSE:1,VOLUME_SET:4,PREVIOUS_TRACK:16,NEXT_TRACK:32,PLAY:16384};
export function stationAvailable(e){
 return !!e&&['playing','paused','idle','on','buffering'].includes(e.state);
}
export function stationSupports(e,action,value){
 if(!stationAvailable(e))return false;
 const mask=Number(e.attributes?.supported_features)||0;
 if(action==='volume')return !!(mask&mediaFeatures.VOLUME_SET)&&Number.isFinite(e.attributes?.volume_level);
 if(action==='playing')return typeof value==='boolean'&&!!(mask&(value?mediaFeatures.PLAY:mediaFeatures.PAUSE));
 if(action==='next')return value===true&&!!(mask&mediaFeatures.NEXT_TRACK);
 if(action==='previous')return value===true&&!!(mask&mediaFeatures.PREVIOUS_TRACK);
 return false;
}
export const stationStateLabel=e=>!e?'Не подключена':({
 playing:'Играет',paused:'Пауза',idle:'Ожидание',on:'Включена',off:'Выключена',
 unavailable:'Нет связи',unknown:'Статус неизвестен',buffering:'Загрузка'
}[e.state]||'Статус HA: '+e.state);
