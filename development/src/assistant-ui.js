import {areaName} from './catalog.js';
export const duoUI={tab:'home',tool:null,status:null,loading:false,busy:false,error:'',statusError:'',message:'',phase:'',draft:'',timer:15,item:'',items:[],listLoaded:false,listError:'',confirm:null,settingsDraft:null};
const esc=s=>String(s??'').replace(/[&<>"']/g,c=>({'&':'&amp;','<':'&lt;','>':'&gt;','"':'&quot;',"'":'&#39;'}[c]));
const disabled=value=>value?'disabled':'';
export function assistantView(room,musicHTML,{live,online}){
 const u=duoUI,s=u.status,blocked=!live||!online||u.busy||u.loading,voiceBlocked=blocked||!s?.playMedia;
 const action=(id,title,subtitle='',confirm=false)=>`<button class="duo-action" data-duo-action="${id}" ${confirm?'data-duo-confirm="true"':''} ${disabled(voiceBlocked)}><strong>${title}</strong><small>${subtitle}</small></button>`;
 const tool=(id,title,subtitle)=>`<button class="duo-action" data-duo-tool="${id}" ${disabled(u.busy||u.loading)}><strong>${title}</strong><small>${subtitle}</small></button>`;
 const settings=u.settingsDraft||s?.settings||{leakAlerts:true,doorAlerts:true,doorMinutes:10,quietNight:true,volume:.45,cameraName:'двор'};
 let content='';
 if(u.confirm){
  const type=u.confirm,confirmations={
   leave:{title:'Запустить «Я ухожу»?',body:`Выключатся только проверенные включённые линии мастер-света на момент запуска. Сейчас их ${s?.leave?.lights.length||0}: ${(s?.leave?.lights||[]).map(d=>areaName(d.room)+' / '+d.name).join(', ')||'нет'}. Играющая музыка будет поставлена на паузу, затем станция получит запрос озвучить сводку. Двери, замки, вода и охрана не переключаются.`},
   camera:{title:'Попросить показать камеру?',body:`На станцию ${room} будет отправлена команда «Покажи камеру ${settings.cameraName}». Камера должна быть отдельно подключена к «Дому с Алисой». Наличие видео в HA не гарантирует показ на Дуо Макс; панель не передаёт Яндексу адрес видеопотока.`},
   shoppingSync:{title:'Синхронизировать покупки?',body:'Двусторонняя синхронизация с todo.shopping_list меняет оба списка. Выполненные и ранее синхронизированные, затем удалённые из HA позиции могут удалиться из Алисы. Новые позиции передаются между списками; отсутствующие в результате Алисы записи HA могут быть удалены, в том числе выполненные. Нужна актуальная YandexStation с поддержкой todo. Автоматической синхронизации нет; точный результат проверяй обновлением списка.'},
   cancelTimers:{title:'Отменить все таймеры?',body:`Станция ${room} получит команду «Отмени все таймеры». Панель не знает, какие таймеры сейчас стоят, и не обещает подтверждение их отмены.`}
  };
  const c=confirmations[type];
  content=`<div class="duo-confirm"><h3>${c.title}</h3><p>${esc(c.body)}</p><div class="sheet-actions"><button class="primary" data-duo-execute="${type}" ${disabled(blocked)}>Подтвердить</button><button class="secondary" data-duo-cancel>Отмена</button></div></div>`;
 }else if(u.tab==='home'&&u.tool==='announce'){
  content=`<button class="text-button duo-back" data-duo-back>Назад к действиям</button><section><h3>Сказать дома</h3><label class="duo-field" for="duo-message">Текст объявления · до 100 символов</label><textarea id="duo-message" maxlength="100" rows="3" placeholder="Я подъезжаю, выходите" ${disabled(u.busy)}>${esc(u.draft)}</textarea><p class="duo-note">Одностороннее объявление · ${esc(room)}. ${s?.local?'Временная громкость берётся из настроек оповещений.':'Без подтверждённого локального канала используется обычная громкость станции.'}</p><button class="secondary" data-duo-action="announce" ${disabled(voiceBlocked)}>Произнести на станции</button></section>`;
 }else if(u.tab==='home'&&u.tool==='timer'){
  content=`<button class="text-button duo-back" data-duo-back>Назад к действиям</button><section><h3>Таймер</h3><div class="duo-timer"><label for="duo-minutes">Минут</label><input id="duo-minutes" type="number" min="1" max="180" value="${u.timer}" ${disabled(u.busy)}/><button class="secondary" data-duo-action="timer" ${disabled(voiceBlocked)}>Поставить</button><button class="text-button" data-duo-action="cancelTimers" data-duo-confirm="true" ${disabled(voiceBlocked)}>Отменить все</button></div><p class="duo-note">Отправляем обычную команду Алисе. Таймер на станции и его выполнение не отслеживаются панелью.</p></section>`;
 }else if(u.tab==='home'){
  content=`<div class="duo-actions">${action('brief','Как дела дома?','Озвучить сводку из HA')}${tool('announce','Сказать дома','Твоё сообщение в коридоре')}${action('leave','Я ухожу','Свет, музыка и замечания',true)}${action('camera','Двор на экране','Запрос Алисе, не трансляция HA',true)}${tool('timer','Таймер','Поставить или отменить')}${action('weather','Какая погода?','Спросить станцию')}</div>
  ${s?.brief?`<details class="duo-brief"><summary>Что войдёт в сводку</summary><p>${esc(s.brief)}</p></details>`:''}`;
 }else if(u.tab==='music'){
  content=`<div id="assistant-music">${musicHTML}</div><button class="secondary full-width" data-duo-action="favorite" ${disabled(voiceBlocked)}>Включить «Мою волну»</button><p class="duo-note">Запрос контента обрабатывает Алиса с учётом твоего аккаунта и подписки.</p>`;
 }else if(u.tab==='shopping'){
  content=`<div class="duo-shopping-head"><div><h3>Покупки</h3><p class="duo-note">Список HA · todo.shopping_list</p></div><button class="text-button" data-duo-list-reload ${disabled(blocked)}>Обновить</button></div>
  ${u.listError?`<p class="duo-inline-error" role="alert">${esc(u.listError)}</p>`:''}
  <div class="duo-add"><label class="visually-hidden" for="duo-item">Новая покупка</label><input id="duo-item" maxlength="160" placeholder="Что купить?" value="${esc(u.item)}" ${disabled(blocked)}/><button class="secondary" data-duo-action="shoppingAdd" ${disabled(blocked)}>Добавить</button></div>
  <div class="duo-shopping-list">${u.items.length?u.items.map(i=>`<button class="duo-shopping-item" data-duo-complete="${esc(i.uid)}" aria-label="Отметить выполненной: ${esc(i.summary)}" ${disabled(blocked)}><span class="duo-checkbox"></span><span>${esc(i.summary)}</span></button>`).join(''):`<p class="duo-note">${u.listLoaded?'Список пуст.':live?'Читаем список…':'Список доступен только с подключённым HA.'}</p>`}</div>
  <div class="duo-sync"><strong>Связать с голосовым списком Алисы</strong><p class="duo-note">Добавление выше меняет только список HA. Двусторонний обмен запускается отдельно, только локально и с подтверждением.</p><button class="secondary" data-duo-action="shoppingSync" data-duo-confirm="true" ${disabled(voiceBlocked||!s?.local)}>Синхронизировать с Алисой</button></div>`;
 }else{
  content=`<h3>Оповещения без открытой панели</h3><p class="duo-note">Работают на сервере надстройки при проверенной локальной связи со станцией. Один запрос на событие, без повторного крика при каждом опросе или перезапуске.</p><p class="duo-note">${s?.automation?.lastPollAt?'Фоновый опрос надстройки: '+new Date(s.automation.lastPollAt).toLocaleTimeString('ru-RU',{timeZone:'Europe/Moscow'})+' МСК.':'Первый фоновый опрос ещё не подтверждён.'} ${s?.automation?.lastError?esc(s.automation.lastError):''}</p>
  <label class="duo-setting"><input id="duo-leaks" type="checkbox" ${settings.leakAlerts?'checked':''} ${disabled(blocked)}/><span>Сообщать о протечке</span></label>
  <label class="duo-setting"><input id="duo-doors" type="checkbox" ${settings.doorAlerts?'checked':''} ${disabled(blocked)}/><span>Напоминать об открытой двери</span></label>
  <label class="duo-setting"><span>Через сколько минут</span><input id="duo-door-minutes" type="number" min="5" max="60" value="${settings.doorMinutes}" ${disabled(blocked)}/></label>
  <label class="duo-setting"><input id="duo-quiet" type="checkbox" ${settings.quietNight?'checked':''} ${disabled(blocked)}/><span>Не напоминать о дверях с 22:00 до 08:00 МСК</span></label>
  <p class="duo-note">Протечки — исключение из ночной тишины. Голос не заменяет независимые средства защиты и оповещения.</p>
  <label class="duo-setting"><span>Громкость объявления · %</span><input id="duo-alert-volume" type="number" min="10" max="70" value="${Math.round(settings.volume*100)}" ${disabled(blocked)}/></label>
  <label class="duo-field" for="duo-camera-name">Имя камеры в «Доме с Алисой»</label><input id="duo-camera-name" maxlength="40" value="${esc(settings.cameraName)}" ${disabled(blocked)}/>
  <p class="duo-note">Временную громкость и её восстановление выполняет локальный режим YandexStation. Если локальное состояние не подтверждено, фоновые объявления не отправляются.</p>
  ${u.settingsDraft?'<p class="duo-note">Есть несохранённые изменения.</p>':''}<button class="primary" data-duo-save ${disabled(blocked||!s)}>Сохранить настройки</button>`;
 }
 const activity=(s?.activity||[]).slice(0,4);
 return `<div class="station-hub"><div class="duo-heading"><h2>Станция · ${esc(room)}</h2><p class="duo-transport">${!live?'Демонстрационное превью · реальные действия заблокированы':!online?'Нет связи с HA':u.loading?'Проверяем возможности…':s?.local?'Локальное состояние станции подтверждено':'Локальное состояние не подтверждено · функции ограничены'}</p></div>
 <div class="duo-tabs" role="tablist" aria-label="Раздел станции">${[['home','Дом'],['music','Музыка'],['shopping','Покупки'],['settings','Сигналы']].map(([id,label])=>`<button role="tab" aria-selected="${u.tab===id}" data-duo-tab="${id}" ${disabled(u.busy)}>${label}</button>`).join('')}</div>
 <div class="duo-result ${esc(u.phase)}" role="status" aria-live="polite" ${!u.message&&!u.error&&!u.statusError&&!u.busy?'hidden':''}>${esc(u.busy?'Действие выполняется. Не повторяй запрос.':u.error||u.statusError||u.message)}</div>
 <div class="duo-content">${content}</div>
 ${activity.length?`<details class="duo-activity"><summary>Последние запросы</summary>${activity.map(a=>`<p><time>${new Date(a.created_at).toLocaleTimeString('ru-RU',{timeZone:'Europe/Moscow',hour:'2-digit',minute:'2-digit'})}</time><span>${esc(a.label)}</span><small>${esc(({accepted:'Принят HA',confirmed:'Подтверждён',partial:'Частично',unknown:'Результат неизвестен',running:'В обработке'})[a.status]||a.status)}</small></p>`).join('')}</details>`:''}</div>`;
}
