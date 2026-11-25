// Gera, a partir do próprio app (tema Papel + Elementos da natureza), os recursos padrão dos
// widgets (android/app/src/main/assets/widget-defaults). As pré-visualizações do seletor vêm
// dos renders reais do código nativo (WidgetRenderTest#previews), não de uma maquete.
// Uso: npx vite --port 5179 & node scripts/widgets-assets.mjs
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PW_PATH ?? 'playwright');
const BASE = process.env.BASE ?? 'http://localhost:5179/';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const assets = path.join(root, 'android/app/src/main/assets/widget-defaults');
fs.rmSync(assets, { recursive: true, force: true });
fs.mkdirSync(assets, { recursive: true });

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 700, height: 300 }, deviceScaleFactor: 2 });
await page.goto(BASE);
await page.waitForFunction(() => window.__pal?.store.getState().ready);
await page.evaluate(() => window.__pal.store.setPreferences({ themeId: 'papel', appearance: 'system', symbolSet: 'nature', visualStyle: 'minimal', valenceLabels: [null, null, null, null, null] }));
const payload = await page.evaluate(() => window.__pal.buildWidgets());

const config = { v: 1, appearance: payload.appearance, style: payload.style, labels: payload.labels, variants: {} };
for (const [key, v] of Object.entries(payload.variants)) {
  const save = (b, name) => (fs.writeFileSync(path.join(assets, name), Buffer.from(b, 'base64')), name);
  config.variants[key] = {
    bg: v.bg, surface: v.surface, ink: v.ink, inkSoft: v.inkSoft, line: v.line, radius: v.radius,
    moodColors: v.moodColors, tints: v.tints,
    mood: v.mood.map((b, i) => save(b, `d_${key}_m${i}.png`)),
    actions: v.actions.map((b, i) => save(b, `d_${key}_a${i}.png`)),
  };
}
fs.writeFileSync(path.join(assets, 'config.json'), JSON.stringify(config, null, 1));
await browser.close();
console.log('widget-defaults:', fs.readdirSync(assets).length, 'arquivos');
