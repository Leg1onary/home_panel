import {build} from 'esbuild';
import {mkdir,copyFile,cp,readdir,rm,writeFile,readFile} from 'node:fs/promises';
await mkdir('dist',{recursive:true});
for(const name of await readdir('dist'))if(name.endsWith('.js'))await rm('dist/'+name);
await build({
 entryPoints:['src/app.js'],bundle:true,minify:true,splitting:true,format:'esm',target:'chrome64',
 outdir:'dist',entryNames:'app',chunkNames:'[name]-[hash]'
});
await copyFile('index.html','dist/index.html');
await copyFile('style.css','dist/style.css');
await copyFile('sw.js','dist/sw.js');
const pkg=JSON.parse(await readFile('package.json','utf8'));
await writeFile('dist/sw.js',(await readFile('dist/sw.js','utf8')).replace('__PANEL_VERSION__',pkg.version));
await cp('assets','dist/assets',{recursive:true});
await build({entryPoints:['src/hls-player.js'],bundle:true,minify:true,format:'iife',target:'chrome64',outfile:'dist/assets/hls-player.js'});
await build({entryPoints:['server/index.js'],bundle:true,platform:'node',format:'esm',target:'node20',external:['better-sqlite3','ws'],outfile:'release/server.mjs'});
await rm('release/dist',{recursive:true,force:true});
await rm('release/config',{recursive:true,force:true});
await mkdir('release/dist',{recursive:true});
await cp('dist','release/dist',{recursive:true});
await cp('runtime','release',{recursive:true});
await copyFile('README.md','release/README.md');
await writeFile('release/package.json',JSON.stringify({name:'home-panel-runtime',private:true,version:'3.0.0',scripts:{start:'node server.mjs'},dependencies:{'better-sqlite3':'11.10.0','jpeg-js':'^0.4.4',ws:'8.18.3'}},null,2));
// Keep the add-on bundle (home_panel/) in sync with the freshly built dist/server.
const addon='../home_panel';
await copyFile('release/server.mjs',addon+'/server.mjs');
await copyFile('release/package.json',addon+'/package.json');
await rm(addon+'/dist',{recursive:true,force:true});
await cp('dist',addon+'/dist',{recursive:true});
console.log('Ready: dist (preview), release (local server, launcher, SQLite), home_panel (add-on).');
