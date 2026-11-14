import assert from 'node:assert/strict';
import {windCompass,feelsLike,moonPhase,dayLengthDelta,tempColor,weatherViewArgs,weatherNowMarkup,weatherDailyMarkup,weatherHourlyMarkup,weatherArcMarkup,weatherMoonMarkup} from '../src/weather-page.js';
const H=3600000,now=Date.parse('2026-11-12T10:00:00Z'),iso=h=>new Date(now+h*H).toISOString();
// ─── windCompass ───
assert.equal(windCompass(0),'С','0 → С');
assert.equal(windCompass(45),'СВ','45 → СВ');
assert.equal(windCompass(90),'В','90 → В');
assert.equal(windCompass(360),'С','360 → С');
assert.equal(windCompass(270),'З','270 → З');
assert.equal(windCompass(315),'СЗ','315 → СЗ');
assert.equal(windCompass('мусор'),'—','мусор → —');
assert.equal(windCompass(undefined),'—','undefined → —');
// ─── feelsLike: wind chill при t<10 и ветре >1.6 м/с (5.76 км/ч) ───
assert.equal(feelsLike(7.3,12.4),6,'wind chill: 7.3−√3.44·0.7 ≈ 6.0');
assert.equal(feelsLike(15,40),15,'тепло >10° — без поправки');
assert.equal(feelsLike(5,2),5,'штиль ≤1.6 м/с — без поправки');
assert.equal(feelsLike(5,5.76),5,'ровно 1.6 м/с — порог не превышен, без поправки');
assert.equal(feelsLike(5,7.2),4,'7.2 км/ч = 2 м/с: 5−√2·0.7 ≈ 4.01 → 4');
assert.equal(feelsLike(-2,20),-3.6,'минус: ms=5.56, √=2.357, ·0.7=1.65 → −3.65 → −3.6');
assert.equal(feelsLike('мусор',5),null,'мусор температуры → null');
// ─── moonPhase: референс — новолуние 2000-01-06 18:14 UTC ───
const NM=Date.UTC(2000,0,6,18,14);
assert.equal(moonPhase(NM).phase,0,'новолуние → фаза 0');
assert.equal(moonPhase(NM).name,'Новолуние','новолуние');
assert.equal(moonPhase(NM).illumination,0,'освещённость 0 %');
let m=moonPhase(NM+Math.round(29.53058867*86400000));
assert.equal(m.name,'Новолуние','через синодический месяц — снова новолуние');
assert.ok(m.illumination<3,'освещённость почти 0');
m=moonPhase(NM+Math.round(14.765*86400000));
assert.equal(m.name,'Полнолуние','полycвет ≈0.5 → Полнолуние');
assert.equal(m.illumination,100,'полнолуние — 100 %');
m=moonPhase(NM+Math.round(7.38*86400000));
assert.equal(m.name,'Первая четверть','первая четверть');
assert.ok(m.illumination>45&&m.illumination<55,'освещённость ≈50 %');
assert.equal(moonPhase(NaN),null,'мусор → null');
// ─── dayLengthDelta: минуты (завтра − сегодня) ───
assert.equal(dayLengthDelta(now,now+7*H,now+6.5*H,now+13*H),-30,'день убывает на 30 мин');
assert.equal(dayLengthDelta(now,now+7*H,now+6.5*H,now+14*H),30,'день прибывает на 30 мин');
assert.equal(dayLengthDelta(now,now+7*H,now+7*H,now+14*H),0,'длина не меняется');
assert.equal(dayLengthDelta(now,now+7*H,null,now+14*H),0,'нет данных → 0');
// ─── tempColor ───
assert.match(tempColor(-15),/91,142,201/,'холод — синеватый');
assert.match(tempColor(25),/216,162,62/,'тепло — золотой');
assert.equal(tempColor(NaN),'var(--muted)','мусор → muted');
// ─── разметка «сейчас»: компас, ощущение, влажность ───
const states={'weather.home':{entity_id:'weather.home',state:'sunny',attributes:{temperature:7.3,humidity:60,wind_speed:12.4,wind_bearing:45,pressure:1013}}};
let args=weatherViewArgs(states,[{datetime:iso(2),condition:'rainy',temperature:6,templow:3,precipitation_probability:80,precipitation:2.5},{datetime:iso(26),condition:'cloudy',temperature:5,templow:2,precipitationProbability:40},{datetime:iso(1),condition:'rainy',temperature:7,precipitation_probability:90,precipitation:1.2}]);
const nm=weatherNowMarkup(args);
assert.match(nm,/км\/ч · СВ/,'компас в ветре');
assert.match(nm,/Ощущается как 6,0°/,'ощущается как');
assert.match(nm,/Влажность/,'влажность');
assert.match(nm,/data-weather="sunny"/,'анимация состояния');
// camelCase от сервера читается
assert.equal(args.daily[0].prec,80,'prec из snake_case');
assert.equal(args.daily[1].prec,40,'prec из camelCase');
assert.equal(args.daily[0].mm,2.5,'мм осадков в daily');
assert.equal(args.hourly[0].mm,1.2,'мм осадков в hourly');
// ─── daily-бары: data-min/max, шкала, цвет ───
const dl=weatherDailyMarkup(args.daily);
assert.match(dl,/data-min="3" data-max="6"/,'бар дня с data-min/max');
assert.match(dl,/data-scale="2..6"/,'общая шкала');
assert.match(dl,/forecast-range-bar/,'бар-элемент');
assert.match(dl,/80 %/,'вероятность осадков в daily');
assert.match(dl,/2,5 мм/,'мм в daily');
assert.equal(weatherDailyMarkup([]).includes('forecast-range'),false,'пустой прогноз без баров');
// ─── hourly: столбики вероятности и мм ───
const tape=weatherHourlyMarkup(args.hourly);
assert.match(tape,/hour-prec/,'столбик вероятности');
assert.match(tape,/height:90%/,'высота по вероятности');
assert.match(tape,/ · 1,2 мм/,'мм в hourly');
assert.equal(weatherHourlyMarkup([]),'','пустая лента → пусто');
// ─── арка с длиной дня и динамикой ───
const storage={store:new Map(),getItem(k){return this.store.get(k)??null},setItem(k,v){this.store.set(k,String(v))}};
const sun={above:true,sunrise:now-2*H,sunset:now+5*H,progress:29,nextDawn:now+18.5*H,nextDusk:now+25*H};
const arc=weatherArcMarkup(sun,now);
assert.match(arc,/Длина дня 07:00/,'длина дня 07:00');
assert.match(arc,/день убывает на 30 мин/,'динамика: убывает');
const sunGrow={...sun,nextDawn:now+19*H,nextDusk:now+26.5*H};
assert.match(weatherArcMarkup(sunGrow,now),/день прибывает на 30 мин/,'динамика: прибывает');
assert.equal(weatherArcMarkup({...sun,nextDawn:null,nextDusk:null},now).includes('weather-arc-length'),false,'нет данных — строки нет');
assert.equal(weatherArcMarkup(null,now).includes('недоступ'),false,'null sun → другой текст');
// ─── луна: разметка ───
const moon=weatherMoonMarkup(NM+Math.round(14.765*86400000));
assert.match(moon,/Полнолуние/,'фаза в разметке');
assert.match(moon,/Освещённость 100 %/,'освещённость в разметке');
assert.match(moon,/moon-lit|moon-shadow/,'svg кружки');
assert.equal(weatherMoonMarkup(NaN),'','мусор → пусто');
// 3.9.2: недельная сводка, давление в мм рт. ст.
import {weatherWeeklyMarkup,mmPressure} from '../src/weather-page.js';
const mm=mmPressure(1013);
assert.equal(mm,760,'гПа → мм рт. ст.'); // 1013*0.750062 ≈ 760
assert.equal(mmPressure('мусор'),null,'мусорное давление → null');
const nm2=weatherNowMarkup({temp:5,wind:null,humidity:60,pressure:1000,icon:'cloudy',label:'Облачно'});
assert.match(nm2,/750 мм рт\. ст\./,'давление в мм рт. ст. в разметке «сейчас»');
const weekly=weatherWeeklyMarkup([
 {day:'пн',max:5,min:0},{day:'вт',max:8,min:2},{day:'ср',max:-3,min:-8},{day:'чт',max:2,min:-1}]);
assert.match(weekly,/днём в среднем \+3°, ночью −2°/,'средние за неделю');
assert.match(weekly,/самый тёплый — вт \(\+8°\)/,'тёплый день');
assert.match(weekly,/самая холодная ночь — ср \(−8°\)/,'холодная ночь');
assert.equal(weatherWeeklyMarkup([]),'','пустой daily → пусто');
assert.equal(weatherWeeklyMarkup([{day:'пн',max:1,min:0}]),'','один день → сводки нет');
console.log('weather-rich: ok (weekly, mmHg)');
// 3.9.4: советы по погоде — только из реальных данных.
import {weatherAdvice} from '../src/weather-page.js';
assert.equal(weatherAdvice(null),'','нет аргументов → нет советов');
// дождь через ~40 мин → зонт
const rainForecast=[{datetime:new Date(now+40*60000).toISOString(),condition:'rainy',temperature:8}];
const advRain=weatherAdvice({temp:8,wind:null,state:'cloudy',label:'Облачно'},rainForecast,now);
assert.match(advRain,/Возьми зонт — дождь через ~40 мин/,'зонт при скором дожде');
// мороз с ветром
const advCold=weatherAdvice({temp:-5,wind:36,state:'snowy',label:'Снег'},[],now);
assert.match(advCold,/Мороз -?\d+° — тёплая куртка/,'совет при морозе');
assert.match(advCold,/Сильный ветер 36 км\/ч/,'совет при сильном ветре');
// жара
assert.match(weatherAdvice({temp:29,wind:null,state:'sunny',label:'Ясно'},[],now),/Жарко — пей воду/,'совет в жару');
// ясная идилия
assert.match(weatherAdvice({temp:20,wind:8,state:'sunny',label:'Ясно'},[],now),/Ясно и спокойно/,'совет в ясную погоду');
// облачно, ветер слабый, осадков нет → честно пусто (не выдумываем)
assert.equal(weatherAdvice({temp:15,wind:10,state:'cloudy',label:'Облачно'},[],now),'','нет повода → нет советов');
console.log('weather-rich: ok (advice)');


