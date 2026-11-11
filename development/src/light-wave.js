// Волна 3.3 «Свет»: каскад мастер-выключения и мини-слайдер яркости.
// parseBrightness(): валидация значения слайдера — целое 1..100, всё остальное → 1.
export function parseBrightness(input){
 const n=Math.round(Number(input));
 return Number.isFinite(n)?Math.min(100,Math.max(1,n)):1;
}
// scheduleWave(): каскад групп команд. jobs — массив групп (по комнате, в порядке
// комнат), run(item) — функция выключения одной линии. Группа i стартует через
// i*step мс (первая — немедленно), внутри группы — параллельно. Возвращает
// {promises, all(), cancel()}: all() ждёт все ack, cancel() снимает невыпущенные
// таймеры (новая волна/отмена не дублируют команды).
export function scheduleWave(jobs,run,{step=300,setTimeout:setTimeoutFn=(fn,ms)=>setTimeout(fn,ms),clearTimeout:clearTimeoutFn=t=>clearTimeout(t)}={}){
 const timers=[],promises=[];
 jobs.forEach((group,i)=>group.forEach(item=>{
  promises.push(new Promise(resolve=>{
   const timer={id:0,resolve,done:false};
   timer.id=setTimeoutFn(()=>{
    if(timer.done)return;timer.done=true;
    Promise.resolve(run(item)).then(resolve,()=>resolve(false));
   },i*step);
   timers.push(timer);
  }));
 }));
 return {promises,all:()=>Promise.all(promises),cancel:()=>timers.forEach(t=>{if(t.done)return;t.done=true;clearTimeoutFn(t.id);t.resolve(false)})};
}