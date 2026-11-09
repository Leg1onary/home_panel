import {api} from './api.js';
// Голосовые команды: STT в браузере (Chrome/Edge) → HA conversation.
const SR=window.SpeechRecognition||window.webkitSpeechRecognition;
let recognition=null,timer=null;
export const voiceSupported=()=>!!SR;
export const voiceButton=()=>`<button id="voice-command" class="voice-button" hidden title="Голосовая команда" aria-label="Голосовая команда" aria-pressed="false"><svg xmlns="http://www.w3.org/2000/svg" width="20" height="20" viewBox="0 0 24 24" fill="none" stroke="currentColor" stroke-width="1.8" stroke-linecap="round" stroke-linejoin="round" aria-hidden="true"><path d="M12 2a3 3 0 0 0-3 3v7a3 3 0 0 0 6 0V5a3 3 0 0 0-3-3Z"/><path d="M19 10v2a7 7 0 0 1-14 0v-2"/><path d="M12 19v3"/></svg></button><span id="voice-status" class="voice-status" hidden></span>`;
const ui=()=>({b:document.getElementById('voice-command'),s:document.getElementById('voice-status')});
export function voiceSync(){
 const {b}=ui();if(!b)return;
 b.hidden=!voiceSupported();
}
function status(text,ms=6000){
 const {s}=ui();if(!s)return;
 s.textContent=text;s.hidden=!text;
 clearTimeout(timer);if(text)timer=setTimeout(()=>{s.hidden=true},ms);
}
function listening(on){
 const {b}=ui();if(!b)return;
 b.classList.toggle('is-listening',on);b.setAttribute('aria-pressed',String(on));
 status(on?'Слушаю…':'',0);
}
async function submit(text){
 try{
  const r=await api('ha/converse',{method:'POST',body:{text}});
  status('Дом: '+(r.speech||'Нет ответа.'));
 }catch(error){status(error.message)}
}
function toggle(){
 if(recognition){recognition.stop();return}
 if(!SR)return;
 recognition=new SR();
 Object.assign(recognition,{lang:'ru-RU',continuous:false,interimResults:false});
 recognition.onresult=event=>{
  recognition=null;listening(false);
  const text=(event.results[0][0].transcript||'').trim();
  if(text)submit(text);else status('Не услышал речь. Попробуй ещё раз.');
 };
 recognition.onerror=event=>{
  recognition=null;listening(false);
  const reason={not_allowed:'Микрофон недоступен: разреши доступ в браузере.',no_speech:'Не услышал речь. Попробуй ещё раз.'};
  status(reason[event.error]||'Распознавание не удалось: '+event.error);
 };
 recognition.onend=()=>{if(recognition){recognition=null;listening(false)}};
 recognition.start();listening(true);
}
export function bindVoice(){
 document.addEventListener('click',e=>{if(e.target.closest('#voice-command'))toggle()});
}