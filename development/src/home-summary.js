// Presentation only. Missing observations never become a real "off" state.
export function homeSummary({live,online,total,unknown,on}){
 if(!live)return {label:online===false?'Нет связи · демо':on?'Свет включён · демо':'Свет выключен · демо',warning:false,detail:'Демонстрационный режим'};
 if(!online)return {label:'Нет связи с домом',warning:true,detail:'Home Assistant недоступен. Управление заблокировано.'};
 if(total>0&&unknown===total)return {label:'Свет временно недоступен',warning:true,detail:`Нет доступного состояния у ${unknown} линий. Сохранённые привязки не изменены.`};
 if(unknown>0)return {label:'Часть света недоступна',warning:true,detail:`Без доступного состояния: ${unknown} из ${total}. Остальные проверенные линии доступны.`};
 return {label:on?'В доме горит свет':'Свет выключен',warning:false,detail:`Включено ${on} из ${total} линий.`};
}
