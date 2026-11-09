import {build} from 'esbuild';
import {spawnSync} from 'node:child_process';
import {mkdir,copyFile} from 'node:fs/promises';
await mkdir('.qa',{recursive:true});
await copyFile('release/server.mjs','addon/home-panel/server.mjs');
// esbuild JS API instead of spawning the .bin shim: works on Windows too.
async function bundle(entry,outfile){
 await build({entryPoints:[entry],outfile,bundle:true,platform:'node',format:'esm',packages:'external',logLevel:'silent'});
}
function run(command,args){
 const result=spawnSync(command,args,{stdio:'inherit',timeout:45000});
 if(result.error)throw result.error;
 if(result.status!==0)throw new Error(`${command} ${args.join(' ')} failed: ${result.status}`);
}
for(const name of ['catalog','yard-card','device-model','device-model-integration','house-profile','station','assistant','shopping','voice','model-state','interior','redesign','history','readings','digest','energy','preact-energy','preact-digest','preact-weather','preact-quick','preact-facts','camera-player','rtc-player','rtc','api-session','sw','ambient','yard-motion']){
 await bundle(`tests/${name}.mjs`,`.qa/${name}.mjs`);
 run(process.execPath,[`.qa/${name}.mjs`]);
}
for(const name of ['integration','addon','stream','live-stream','scenarios','scenarios-user'])run(process.execPath,[`tests/${name}.mjs`]);
console.log('All thirty-four test suites passed.');

