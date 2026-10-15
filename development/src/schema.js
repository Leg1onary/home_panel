import house from '../config/house.json';
import {cloneSettings} from './compat.js';
import {defaultPreferences} from './preferences.js';
export const rooms=[...cloneSettings(house.rooms),
 {id:'attic',name:'Чердак',short:'Чердак',icon:'archive',channels:[]},
 {id:'well',name:'Скважина',short:'Скважина',icon:'droplets',channels:[]},
 {id:'yard',name:'Двор',short:'Двор',icon:'trees',channels:[]}
];
export const state={
 view:'home',selected:'living',theme:'dark',rgbOn:true,rgbColor:'#d1a1e8',brightness:75,pumpPower:true,
 favorites:['living','hall','terrace','bedroom','office','bath'],
 nightMode:'auto',idleSeconds:90,idle:false,heroURL:null,
 demoOffline:false,failNext:false,commandSequence:0,commands:new Map(),commandHistory:[],batchPending:false,
 stationMode:'unconfigured',stationVolume:35,stationPlaying:false,settingsTab:'panel',
 ...defaultPreferences(),storage:'loading',storageMessage:'Подключаем хранилище…',preview:false,
 liveOnline:false,liveError:'Home Assistant ещё не подключён',liveUpdatedAt:0,entityStates:{},
 photoSaved:false,techOpen:false
};
export const getRoom=id=>rooms.find(r=>r.id===id);
export const countLights=()=>rooms.reduce((n,r)=>n+r.channels.filter(c=>c.on&&!c.planned).length,0);
export const channelsFor=r=>r.channels.filter(c=>!c.planned);
export function hydrateRooms(){
 for(const r of rooms){
  const previous=new Map(r.channels.map(c=>[c.id,c.on]));
  r.channels=state.devices.filter(d=>(d.type==='light'||d.type==='rgb'&&d.id!=='rgb')&&d.room===r.id).map(d=>({...d,planned:d.status==='planned',on:d.status==='planned'?false:previous.get(d.id)??(state.mode==='demo'&&!!d.demoOn)}));
 }
}
export const sensors={
 living:{value:20.4,humidity:53,receivedAt:Date.now()-60000,quality:'sample'},
 well:{value:16.5,humidity:86,receivedAt:Date.now()-120000,quality:'sample'},
 attic:{value:40,humidity:24,receivedAt:Date.now()-172800000,quality:'stale'}
};
hydrateRooms();
