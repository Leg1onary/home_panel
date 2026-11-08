import assert from 'node:assert/strict';
import {readFile} from 'node:fs/promises';
const sw=await readFile('sw.js','utf8');
// Cache versioning comes from package.json version (injected at build time or kept as placeholder).
assert.match(sw,/const VERSION='(__PANEL_VERSION__|[0-9][^']*)'/,'SW version placeholder or real version');
assert.match(sw,/home-panel-v/,'versioned cache name');
assert.match(sw,/addEventListener\('activate'/,'old caches cleaned on activate');
// /api/ is explicitly excluded from every cache strategy; SSE (EventSource) untouched.
assert.match(sw,/startsWith\('\/api\/'\)\)\s*return/,'api requests are never cached');
assert.doesNotMatch(sw,/EventSource/,'SSE is not touched');
// Strategies: runtime cache-first for immutable assets, network-first for shell.
assert.match(sw,/IMMUTABLE\.test\(path\)/,'cache-first for assets/fonts/images');
assert.match(sw,/SHELL\.test\(path\)/,'network-first with cache fallback for shell');
// Registration in index.html: only over http(s), never file:.
const html=await readFile('index.html','utf8');
assert.match(html,/serviceWorker'\s+in\s+navigator/,'SW registration present');
assert.match(html,/navigator\.serviceWorker\.register\('sw\.js'\)/,'registers sw.js');
assert.match(html,/location\.protocol/,'guards on protocol');
// Server serves sw.js with the JS content-type via the same allowlist.
const server=await readFile('server/index.js','utf8');
assert.match(server,/index\\\.html\|sw\\\.js/,'allowlist includes sw.js');
// Build pipeline ships sw.js into dist (addon serves dist).
assert.match(await readFile('build.mjs','utf8'),/copyFile\('sw\.js','dist\/sw\.js'\)/,'build copies sw.js to dist');
// Profile export endpoint: server route with attachment header, client handler.
assert.match(server,/route==='profile\/export'/,'profile/export route');
assert.match(server,/Content-Disposition':'attachment/,'attachment header');
assert.match(server,/exportedAt/,'export includes exportedAt');
const app=await readFile('src/app.js','utf8');
assert.match(app,/profile-export/,'backup tab button');
assert.match(app,/home-panel-profile-/,'download filename with date');
console.log('PASS: SW api-exclusion and strategies, registration, allowlist, build pipeline, profile export endpoint and UI.');