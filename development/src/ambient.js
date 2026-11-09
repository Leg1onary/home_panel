// Волна 2 «Тишина»: чистая логика решения ambient-состояния.
// Ambient — глубокая ступень после обычного экрана ожидания: включается,
// только если режим разрешён настройкой и с момента последней активности
// прошло не меньше idleSeconds (в приложении это пауза после входа в ожидание).
export const AMBIENT_AFTER_IDLE=60;
export function shouldAmbient({enabled=true,idleSeconds=90,lastActivity=0,now=Date.now()}={}){
 if(!enabled)return false;
 if(!Number.isFinite(idleSeconds)||idleSeconds<=0)return false;
 if(!Number.isFinite(lastActivity)||!Number.isFinite(now))return false;
 return now-lastActivity>=idleSeconds*1000;
}