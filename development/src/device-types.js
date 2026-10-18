// Trusted type registry shared by the browser and backend. Imported preferences
// contain channel IDs and presentation, never service names or command grants.
const types={
 light:{label:'Линия света',icon:'lightbulb',module:'lights',domains:['light','switch'],controllable:true,capabilities:['power']},
 rgb:{label:'RGB-лампа',icon:'lightbulb',module:'lights',domains:['light'],controllable:true,capabilities:['power','brightness','color']},
 temperature:{label:'Температура',icon:'thermometer',module:'sensors',domains:['sensor'],unit:'°C'},
 humidity:{label:'Влажность',icon:'droplets',module:'sensors',domains:['sensor'],unit:'%'},
 illuminance:{label:'Освещённость',icon:'sun',module:'sensors',domains:['sensor'],unit:'lx'},
 door:{label:'Открытие',icon:'door-open',module:'sensors',domains:['binary_sensor'],classes:['door','opening','window','garage_door']},
 smoke:{label:'Дым',icon:'radio',module:'sensors',domains:['binary_sensor'],classes:['smoke']},
 motion:{label:'Движение',icon:'scan-eye',module:'sensors',domains:['binary_sensor','sensor'],classes:['motion','occupancy','enum']},
 battery:{label:'Батарейка',icon:'radio',module:'sensors',domains:['sensor'],unit:'%'},
 button_event:{label:'Мастер-кнопка · событие',icon:'power',module:'sensors',domains:['sensor'],classes:['enum']},
 station:{label:'Медиаплеер / станция',icon:'audio-lines',module:'media',domains:['media_player'],controllable:true,capabilities:['play','pause','volume']},
 leak:{label:'Протечка',icon:'droplets',module:'sensors',domains:['binary_sensor'],classes:['moisture']},
 camera:{label:'Камера',icon:'camera',module:'cameras',domains:['camera'],capabilities:['snapshot','live']},
 curtain:{label:'Шторы / карниз · наблюдение',icon:'door-open',module:'covers',domains:['cover'],locked:true,capabilities:['state','position']},
 vacuum:{label:'Робот-пылесос · наблюдение',icon:'radio',module:'cleaning',domains:['vacuum'],locked:true,capabilities:['state','battery']},
 gate:{label:'Откатные ворота',icon:'door-open',module:'engineering',domains:['cover'],locked:true},
 heating:{label:'Отопление / котёл',icon:'heater',module:'engineering',domains:['climate'],locked:true},
 pump:{label:'Питание насоса',icon:'heater',module:'engineering',domains:['switch'],locked:true}
};
function freeze(value){
 for(const child of Object.values(value))if(child&&typeof child==='object')freeze(child);
 return Object.freeze(value);
}
export const deviceTypes=freeze(types);
