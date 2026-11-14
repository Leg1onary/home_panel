// 3.8.0 «Дом говорит»: короткие фразы для TTS станции при взводе/снятии охраны.
// Лимит ha.announce — 100 символов; фразы короткие, без команд света.
export function voiceEnabled(prefs){return prefs?.voiceAnnounce!==false}
export function armPhrase(exitSec=120){
 const min=Math.max(1,Math.round((Number(exitSec)||120)/60));
 return `Ухожу. Охрана встанет через ${min} ${min===1?'минуту':'минуты'}. До вечера!`;
}
export function disarmPhrase(){return 'Охрана снята. Добро пожаловать домой!'}
export function cancelExitPhrase(){return 'Выход отменён, охрана не включена.'}
export function doorOpenPhrase(name='входная дверь'){return `Внимание, открыта ${String(name).toLowerCase().slice(0,60)}`}
