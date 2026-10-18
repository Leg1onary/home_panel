import {spawnSync} from 'node:child_process';
import {mkdir,copyFile} from 'node:fs/promises';
await mkdir('.qa',{recursive:true});
await copyFile('release/server.mjs','addon/home-panel/server.mjs');
function run(command,args){
 const result=spawnSync(command,args,{stdio:'inherit',timeout:45000});
 if(result.error)throw result.error;
 if(result.status!==0)throw new Error(`${command} ${args.join(' ')} failed: ${result.status}`);
}
for(const name of ['catalog','device-model','device-model-integration','house-profile','station','model-state','camera-player','rtc-player','rtc','api-session']){
 run('node_modules/.bin/esbuild',[`tests/${name}.mjs`,'--bundle','--platform=node','--format=esm','--packages=external',`--outfile=.qa/${name}.mjs`]);
 run(process.execPath,[`.qa/${name}.mjs`]);
}
for(const name of ['integration','addon','stream'])run(process.execPath,[`tests/${name}.mjs`]);
console.log('All thirteen test suites passed.');
