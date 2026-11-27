// ตัวช่วยร่วมสำหรับ e2e: โหลดโมดูล TS ของเกม (ผ่าน vite ssrLoadModule), เปิด/ตรวจ preview server, require playwright
import { createRequire } from 'module';
import { spawn, execSync } from 'child_process';
import path from 'path';
import { fileURLToPath } from 'url';

export const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
export const OUT = path.join(ROOT, 'tests/e2e/out');
export const PORT = 4173;
export const BASE = `http://127.0.0.1:${PORT}/`;

const require = createRequire(import.meta.url);
export async function loadPlaywright() {
  try {
    return await import('playwright');
  } catch {
    return require('playwright');
  }
}

let viteServer = null;
/** โหลด engine/maps/characters (TS) ด้วย vite แบบ SSR — ใช้ตรรกะจริงของเกม */
export async function loadGameModules() {
  const vite = await import(path.join(ROOT, 'node_modules/vite/dist/node/index.js'));
  viteServer = await vite.createServer({
    root: ROOT,
    logLevel: 'error',
    server: { middlewareMode: true, hmr: false },
    appType: 'custom',
    optimizeDeps: { noDiscovery: true, include: [] },
  });
  const engine = await viteServer.ssrLoadModule('/src/game/engine.ts');
  const maps = await viteServer.ssrLoadModule('/src/data/maps/index.ts');
  const chars = await viteServer.ssrLoadModule('/src/data/characters.ts');
  const save = await viteServer.ssrLoadModule('/src/game/save.ts');
  return { engine, maps, chars, save };
}
export async function closeGameModules() {
  if (viteServer) await viteServer.close();
}

async function isUp() {
  try {
    const r = await fetch(BASE);
    return r.ok;
  } catch {
    return false;
  }
}

let previewProc = null;
/** ถ้าพอร์ตยังไม่เปิด: build แล้วเปิด vite preview เอง */
export async function ensureServer(log = console.log) {
  if (await isUp()) {
    log(`preview server already up at ${BASE}`);
    return;
  }
  log('building (npx vite build)…');
  execSync('npx vite build', { cwd: ROOT, stdio: 'inherit' });
  log('starting vite preview…');
  previewProc = spawn('npx', ['vite', 'preview', '--host', '127.0.0.1', '--port', String(PORT), '--strictPort'], {
    cwd: ROOT,
    stdio: 'ignore',
    detached: true,
  });
  for (let i = 0; i < 60; i++) {
    if (await isUp()) return;
    await new Promise((r) => setTimeout(r, 500));
  }
  throw new Error('preview server did not start');
}
export function stopServer() {
  if (previewProc) {
    try {
      process.kill(-previewProc.pid);
    } catch {
      /* ignore */
    }
  }
}
