// Mirrors Supervisor's recursive config discovery, including ignored directories.
import assert from 'node:assert/strict';
import {readdir,readFile} from 'node:fs/promises';
import {join,relative,resolve} from 'node:path';
const root=resolve(new URL('..',import.meta.url).pathname),manifests=[];
async function walk(path){
 for(const item of await readdir(path,{withFileTypes:true})){
  if(item.name.startsWith('.')||item.name==='rootfs')continue;
  const full=join(path,item.name);
  if(item.isDirectory())await walk(full);
  else if(/^config\..*\.(json|ya?ml)$/.test(item.name)||/^config\.(json|ya?ml)$/.test(item.name))manifests.push(relative(root,full));
 }
}
await walk(root);
assert.deepEqual(manifests,['home_panel/config.json'],'Supervisor must discover only the installable add-on, never a source template.');
const app=JSON.parse(await readFile(join(root,manifests[0]),'utf8'));
assert.equal(app.slug,'home_panel');assert.equal(app.version,'1.1.0');
for(const file of ['Dockerfile','package.json','package-lock.json','server.mjs','startup.mjs','dist/index.html']){
 assert.ok((await readFile(join(root,'home_panel',file))).length,`Missing Docker build input: ${file}`);
}
console.log('PASS: recursive Supervisor discovery finds exactly one home_panel manifest; all Docker build inputs exist.');
