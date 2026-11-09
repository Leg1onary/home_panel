import assert from 'node:assert/strict';
import {h} from '../src/preact/kit.js';
import {WeatherChipContent,weatherBus,WEATHER_ICON} from '../src/preact/weather-widget.js';
import {render} from 'preact-render-to-string';
const now=Date.now();
const states=condition=>({'weather.home':{entity_id:'weather.home',state:condition,last_changed:new Date(now).toISOString(),last_updated:new Date(now).toISOString(),attributes:{temperature:7.3,humidity:60}}});
const html=entityStates=>render(h(WeatherChipContent,{entityStates,now}));
// Облачно 7.3 °C → 'Облачно', '7,3', классы и data-атрибуты прежние.
let out=html(states('cloudy'));
assert.ok(out.includes('weather-chip'),'класс .weather-chip сохранён');
assert.ok(out.includes('home-fact'),'класс .home-fact сохранён');
assert.ok(out.includes('Облачно'),'метка «Облачно»');
assert.ok(out.includes('7,3'),'температура с запятой');
assert.ok(out.includes('data-weather="cloudy"'),'атрибут анимации');
assert.ok(out.includes('data-action="weather-forecast"'),'открытие щитка прогноза');
assert.ok(out.includes('aria-label')&&out.includes('Открыть прогноз'),'aria чипа');
assert.ok(out.includes('60 %'),'влажность');
assert.equal(WEATHER_ICON.cloudy,'cloudy','экспорт констант иконок');
// Недоступная погода → null; нет температуры → null; нет сущности → null.
assert.equal(html(states('unavailable')),'','unavailable не рендерится');
assert.equal(html({'weather.home':{entity_id:'weather.home',state:'cloudy',attributes:{}}})+'','','нет температуры — не рендерится');
assert.equal(html({}),'','нет погодной сущности');
// Ясно → data-weather=sunny для анимации.
assert.ok(html(states('clear')).includes('data-weather="sunny"'),'sunny-анимация');
// Шина: notify доставляет {entityStates,now}.
let seen=null;
weatherBus.sub(d=>{seen=d});
weatherBus.notify({entityStates:states('cloudy'),now});
assert.ok(seen.entityStates['weather.home'].state==='cloudy','weatherBus доставляет payload');
console.log('preact-weather ok');