import {chromium} from 'playwright-core';
const browser=await chromium.launch({channel:'msedge',headless:true});
const page=await browser.newPage();
const errors=[];
page.on('pageerror',e=>errors.push('pageerror: '+e.message));
page.on('console',m=>{if(m.type()==='error')errors.push('console: '+m.text())});
const url=process.env.QA_URL||'http://127.0.0.1:8080/';
await page.goto(url,{waitUntil:'networkidle',timeout:30000});
await page.waitForTimeout(3000);
// Переключаем источник на live, как пользователь: Настройки → select #mode-setting.
// В превью переключение источника недоступно — пропускаем.
if(!process.env.QA_PREVIEW){
 await page.keyboard.press('Escape');
 await page.waitForTimeout(600);
 const chip=page.locator('.hero-status-chip');
 if(await chip.count()){await chip.first().click();await page.waitForTimeout(1200)}
 console.log('mode-setting present:',await page.locator('#mode-setting').count());
 if(await page.locator('#mode-setting').count()===0){
  console.log('sheet text:',(await page.evaluate(()=>document.querySelector('.sheet')?.innerText.replace(/\s+/g,' ').slice(0,300)))||'(none)');
 }else{
  await page.selectOption('#mode-setting',process.env.QA_MODE||'live');
  await page.waitForTimeout(6000);
 }
}
console.log('body snippet:',(await page.evaluate(()=>document.body.innerText.replace(/\s+/g,' ').slice(0,200))));
console.log('has home?',await page.evaluate(()=>!!document.querySelector('#master, .home, #home-energy, main')));
console.log('html:',(await page.content()).slice(0,400));
const energy=page.locator('#home-energy');
const present=await energy.count();
const card=await energy.locator('.energy-card').count();
const text=present?await energy.innerText():'(no node)';
console.log('energy node:',present,'card:',card,'text:',text.replace(/\s+/g,' ').slice(0,160));
// клик по кнопке обновления не ломает
const btn=energy.locator('.energy-reload');
if(await btn.count()){
 await btn.first().click({force:true});
 await page.waitForTimeout(1500);
 console.log('after click card:',await energy.locator('.energy-card').count());
}else console.log('no reload button');
console.log('errors:',errors.length?errors:'none (favicon 404 допустим)');
await browser.close();
