// Волна 3 «Умное поведение»: авто-тема по освещённости террасы.
// Гистерезис: светлая тема включается от AUTO_THEME_UP лк и выше,
// тёмная — только при спуске ниже AUTO_THEME_DOWN лк (зона 30–39 лк
// сохраняет предыдущую тему, чтобы панель не мигала у границы).
export const AUTO_THEME_UP=40,AUTO_THEME_DOWN=30;
export function luxValue(e,online=true){
 const s=e?.state;
 if(!online||!e||typeof s!=='string'||['unknown','unavailable',''].includes(s.trim())||!Number.isFinite(Number(s)))return null;
 return Number(s);
}
export function autoTheme(lux,zone){
 if(!Number.isFinite(lux))return null;
 if(lux>=AUTO_THEME_UP)return 'light';
 if(lux<AUTO_THEME_DOWN)return 'dark';
 return zone;
}