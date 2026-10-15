import {cp,mkdir,rm,copyFile} from 'node:fs/promises';
import {spawnSync} from 'node:child_process';
import {resolve} from 'node:path';
const output=resolve('addon-package'),app=resolve(output,'home_panel');
await rm(output,{recursive:true,force:true});
await mkdir(app,{recursive:true});
for(const name of ['config.json','Dockerfile','.dockerignore','startup.mjs']){
 await copyFile(resolve('addon/home-panel',name==='config.json'?'manifest.json':name),resolve(app,name));
}
for(const name of ['server.mjs','package.json','package-lock.json']){
 await copyFile(resolve('release',name),resolve(app,name));
}
await cp(resolve('dist'),resolve(app,'dist'),{recursive:true});
await copyFile(resolve('addon/INSTALL.md'),resolve(output,'INSTALL.md'));
await copyFile(resolve('addon/install-home-panel.sh'),resolve(output,'install-home-panel.sh'));
const archive=resolve('home-panel-v3-ha-addon.zip');
await rm(archive,{force:true});
const packed=spawnSync('zip',['-qr',archive,'home_panel','INSTALL.md','install-home-panel.sh'],{cwd:output,stdio:'inherit'});
if(packed.status!==0)throw new Error('zip failed');
console.log('Built '+archive+'; no credentials, database, preview mode, repository placeholder or Windows launcher included.');
