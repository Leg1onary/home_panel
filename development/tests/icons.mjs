import {readFileSync} from 'node:fs';
// Регрессия 3.9.0: иконки QrCode/Wifi использовались в iconSet, но не были импортированы
// из lucide — панель падала с ReferenceError при первом рендере.
const src=readFileSync(new URL('../src/app.js',import.meta.url),'utf8');
const importBlock=src.match(/import\s*\{([^}]*)\}\s*from\s*'lucide'/s)?.[1]||'';
const imported=new Set(importBlock.split(',').map(s=>s.trim()).filter(Boolean));
// Имена из iconSet (строка-литерал const iconSet={...})
const setBlock=src.match(/const iconSet=\{([^}]*)\}/s)?.[1]||'';
const setNames=setBlock.split(',').map(s=>s.trim()).filter(n=>/^[A-Z][A-Za-z0-9]+$/.test(n));
const missing=setNames.filter(n=>!imported.has(n));
if(missing.length)throw new Error(`Icons used in iconSet but not imported from lucide: ${missing.join(', ')}`);
// Имена, передаваемые в I('...') / I("...")
const used=new Set();
for(const m of src.matchAll(/\bI\(\s*['"]([A-Z][A-Za-z0-9]+)['"]\s*\)/g))used.add(m[1]);
const missingUsed=[...used].filter(n=>!imported.has(n));
if(missingUsed.length)throw new Error(`Icons passed to I() but not imported from lucide: ${missingUsed.join(', ')}`);
console.log(`icons: ${imported.size} imported, ${setNames.length} in iconSet, ${used.size} via I() — ok`);
