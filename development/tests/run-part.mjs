import {build} from 'esbuild';
import {spawnSync} from 'node:child_process';
import {mkdir} from 'node:fs/promises';
await mkdir('.qa',{recursive:true});
async function bundle(entry,outfile){
 await build({entryPoints:[entry],outfile,bundle:true,platform:'node',format:'esm',packages:'external',logLevel:'silent'});
}
function run(command,args){
 const result=spawnSync(command,args,{stdio:'inherit',timeout:45000});
 if(result.error)throw result.error;
 if(result.status!==0)throw new Error(`${command} ${args.join(' ')} failed: ${result.status}`);
}
const all=['catalog','yard-card','device-model','device-model-integration','house-profile','station','assistant','shopping','voice','model-state','interior','redesign','history','readings','digest','digest-brief','guard','energy','energy-month','energy-chart','preact-energy','preact-digest','preact-weather','preact-quick','preact-facts','preact-room','light-wave','camera-player','rtc-player','rtc','api-session','sw','ambient','night-mode','night-health','yard-motion','yard-onvif','yard-topics','yard-snapshot','yard-clips','yard-cameras','main-context','weather-page','weather-rich','energy-forecast','events','security','voice-say','guest-wifi','icons'];
const part=process.argv[2]||'A';
const list=part==='A'?all.slice(0,25):all.slice(25);
for(const name of list){
 await bundle(`tests/${name}.mjs`,`.qa/${name}.mjs`);
 run(process.execPath,[`.qa/${name}.mjs`]);
}
console.log(`Part ${part} ok (${list.length} suites).`);
