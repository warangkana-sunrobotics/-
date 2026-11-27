// npm run test:e2e — ตรวจ engine (ผ่าน vite SSR) + เบราว์เซอร์จริง (Playwright) แล้วเขียนผลลง tests/e2e/out/results.json
// ถ้าพอร์ต 4173 ยังไม่เปิด จะ build + เปิด vite preview เอง; ล้มเหลวข้อใด → exit code 1
import fs from 'fs';
import path from 'path';
import { OUT, ensureServer, stopServer, loadGameModules, closeGameModules, loadPlaywright } from './lib.mjs';
import { engineChecks } from './engine-checks.mjs';
import { browserChecks } from './browser-checks.mjs';

const only = process.argv.slice(2); // เช่น `node tests/e2e/run.mjs engine`
fs.mkdirSync(OUT, { recursive: true });
let results = [];
let code = 0;
try {
  const mods = await loadGameModules();
  if (!only.length || only.includes('engine')) {
    const er = engineChecks(mods);
    for (const r of er) console.log(`${r.pass ? 'PASS' : 'FAIL'} ${r.id} ${r.name} — ${r.evidence}`);
    results.push(...er);
  }
  if (!only.length || only.includes('browser')) {
    await ensureServer();
    const pw = await loadPlaywright();
    const chromium = pw.chromium ?? pw.default?.chromium;
    results.push(...(await browserChecks({ chromium, engine: mods.engine, maps: mods.maps })));
  }
} catch (e) {
  console.error('E2E crashed:', e);
  code = 1;
} finally {
  await closeGameModules().catch(() => {});
  stopServer();
}
fs.writeFileSync(path.join(OUT, 'results.json'), JSON.stringify(results, null, 2));
const failed = results.filter((r) => !r.pass);
console.log(`\n${results.length - failed.length}/${results.length} passed`);
if (failed.length) {
  console.log('FAILED: ' + failed.map((r) => r.id).join(', '));
  code = 1;
}
process.exit(code);
