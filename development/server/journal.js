// 3.3.3 «Журнал событий»: кольцевой буфер последних 50 системных событий
// в памяти. journal(text, level) добавляет событие; journalList() отдаёт
// копию, новые сверху, для GET /api/panel/health → поле journal.
const MAX_JOURNAL=50;
const journalBuf=[];
export function journal(text,level='info'){
 journalBuf.push({at:Date.now(),level:level==='warn'?'warn':'info',text:String(text).slice(0,200)});
 if(journalBuf.length>MAX_JOURNAL)journalBuf.shift();
}
export function journalList(){
 return [...journalBuf].reverse();
}