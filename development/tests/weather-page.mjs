import assert from 'node:assert/strict';
import {weatherViewArgs,weatherArcMarkup,weatherNowMarkup,weatherDailyMarkup,weatherHourlyMarkup,sunInfo} from '../src/weather-page.js';
import {parseBlocks,serializeBlocks,digestEssence,energyEssence,stationEssence,BLOCK_DEFAULTS} from '../src/home-blocks.js';
import {esc} from '../src/dom.js';
const now=Date.parse('2026-11-12T10:00:00Z');
const iso=h=>new Date(now+h*3600000).toISOString();
// ─── weatherViewArgs ───
const states={
 'weather.home':{entity_id:'weather.home',state:'partlycloudy',attributes:{temperature:7.3,humidity:60,wind_speed:12.4,pressure:1013}},
 'sun.sun':{entity_id:'sun.sun',state:'above_horizon',attributes:{next_dusk:iso(5),next_dawn:iso(19)}}
};
let args=weatherViewArgs(states,[{datetime:iso(2),condition:'rainy',temperature:6,templow:3,precipitation_probability:80},{datetime:iso(26),condition:'cloudy',temperature:5,templow:2}]);
assert.equal(args.label,'Переменная облачность','WEATHER_LABEL');
assert.equal(args.temp,7.3,'температура без изменений');
assert.equal(args.humidity,60,'влажность');
assert.equal(args.wind,12.4,'ветер');
assert.equal(args.pressure,1013,'давление');
assert.equal(args.icon,'cloud-sun','иконка partlycloudy');
assert.equal(args.daily.length,2,'daily только templow-пункты');
assert.equal(args.daily[0].max,6,'max');
assert.equal(args.daily[0].min,3,'min');
assert.equal(args.daily[0].prec,80,'осадки');
assert.equal(args.daily[0].condition,'Дождь','condition подпись');
assert.equal(args.hourly.length,0,'hourly пуст в daily-ответе');
// ─── арка: день ───
// Восход сегодня: storedSunrise читает localStorage — в тесте storage-мок.
const storage={store:new Map(),getItem(k){return this.store.get(k)??null},setItem(k,v){this.store.set(k,String(v))}};
storage.store.set(`hp-sunrise-${new Date(now).getFullYear()}-undefined-${new Date(now).getDate()}`,'x'); // мусор — не мешает
// Корректная запись через key-формат из day-arc.js:
const d=new Date(now),key='hp-sunrise-'+`${d.getFullYear()}-${String(d.getMonth()+1).padStart(2,'0')}-${String(d.getDate()).padStart(2,'0')}`;
storage.store.set(key,String(now-2*3600000));
let sun=sunInfo(states,now,storage);
assert.equal(sun.above,true,'над горизонтом');
assert.ok(Number.isFinite(sun.sunrise)&&Number.isFinite(sun.sunset),'восход/закат числа');
assert.equal(sun.progress,29,'2 ч прошло из 7 ч светового дня → 29 %');
let arc=weatherArcMarkup(sun,now);
assert.match(arc,/day-arc-fill/,'днём есть дуга');
assert.match(arc,/aria-label="Светового дня пройдено 29 %/,'aria дуги');
assert.match(arc,/Восход \d{2}:\d{2}/,'подпись восхода');
assert.match(arc,/Закат \d{2}:\d{2}/,'подпись заката');
assert.match(arc,/пройдено 29 %/,'прогресс-подпись');
// ─── арка: ночь ───
const night={...states,'sun.sun':{entity_id:'sun.sun',state:'below_horizon',attributes:{next_dusk:iso(-3),next_dawn:iso(9)}}};
sun=sunInfo(night,now,storage);
assert.equal(sun.progress,null,'ночью прогресс null');
arc=weatherArcMarkup(sun,now);
assert.ok(!arc.includes('day-arc-fill'),'ночью дуги нет');
assert.match(arc,/взошл[аооо] в \d{2}:\d{2}/,'ночная строка взошёл');
assert.match(arc,/зайдёт в \d{2}:\d{2}/,'ночная строка зайдёт');
// ─── недоступная погода → null ───
assert.equal(weatherViewArgs({'weather.home':{entity_id:'weather.home',state:'unavailable',attributes:{}}},[]),null,'unavailable → null');
assert.equal(weatherViewArgs({},[]),null,'нет сущности → null');
assert.equal(weatherViewArgs({'weather.home':{entity_id:'weather.home',state:'cloudy',attributes:{}}},[]),null,'нет температуры → null');
assert.match(weatherNowMarkup(null),/недоступны/,'разметка «сейчас» для null');
// ─── hourly ───
args=weatherViewArgs(states,[{datetime:iso(1),condition:'rainy',temperature:7,precipitation_probability:90},{datetime:iso(2),condition:'clear',temperature:9,precipitation_probability:5}]);
assert.equal(args.hourly.length,2,'hourly без templow');
let tape=weatherHourlyMarkup(args.hourly);
assert.match(tape,/weather-hour is-wet/,'осадки подсвечены');
assert.match(tape,/\d{2}:\d{2}/,'время в ленте');
assert.equal(weatherHourlyMarkup([]),'','пустой hourly → пусто');
// ─── прогноз: пусто ───
assert.match(weatherDailyMarkup([]),/Прогноз недоступен/,'пустой прогноз');
assert.match(weatherDailyMarkup([{day:'12 нояб.',icon:'sun',condition:'Ясно',min:3,max:6,prec:80}]),/forecast-row/,'строка прогноза');
// ─── коллапс блоков ───
let blocks=parseBlocks(null);
assert.deepEqual(blocks,BLOCK_DEFAULTS,'дефолты: digest открыт, energy/station свернуты');
assert.equal(BLOCK_DEFAULTS.digest,true,'digest default true');
assert.equal(BLOCK_DEFAULTS.energy,false,'energy default false');
assert.equal(BLOCK_DEFAULTS.station,false,'station default false');
blocks=parseBlocks('{"digest":false,"energy":true}');
assert.equal(blocks.digest,false,'сохранённое перекрывает');
assert.equal(blocks.energy,true,'сохранённое перекрывает');
assert.equal(blocks.station,false,'недостающий ключ → дефолт');
assert.equal(blocks.extra,undefined,'лишний ключ отброшен');
assert.deepEqual(parseBlocks('мусор'),BLOCK_DEFAULTS,'мусор → дефолты');
assert.equal(serializeBlocks({digest:false}),'{"digest":false,"energy":false,"station":false}','serialize с дефолтами');
assert.match(digestEssence(1),/1 событие/,'1 событие');
assert.match(digestEssence(3),/3 события/,'3 события');
assert.match(digestEssence(5),/5 событий/,'5 событий');
assert.equal(energyEssence([{date:'2026-10-01',value:100},{date:'2026-11-01',value:130}],5).includes('кВт·ч'),true,'энергия кВт·ч');
assert.equal(energyEssence([],5),'Показаний пока нет','нет показаний');
assert.equal(energyEssence([{date:'2026-11-01',value:130}],5),'Нужны два показания','одно показание');
assert.match(stationEssence({playing:false,title:'Тишина · запусти с пульта или Алисой'}),/Тишина/,'станция тишина');
assert.match(stationEssence({playing:true,title:'Кино FM · через Home Assistant'}),/Кино FM/,'станция трек');
console.log('weather-page: ok');