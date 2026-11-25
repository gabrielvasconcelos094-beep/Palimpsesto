// Gera, a partir do próprio app (tema Papel + Elementos da natureza), os recursos padrão dos
// widgets (android/app/src/main/assets/widget-defaults) e as pré-visualizações do seletor.
// Uso: npx vite --port 5179 & node scripts/widgets-assets.mjs
import { createRequire } from 'node:module';
import fs from 'node:fs';
import path from 'node:path';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PW_PATH ?? 'playwright');
const BASE = process.env.BASE ?? 'http://localhost:5179/';
const root = path.resolve(path.dirname(new URL(import.meta.url).pathname), '..');
const assets = path.join(root, 'android/app/src/main/assets/widget-defaults');
const res = path.join(root, 'android/app/src/main/res/drawable-nodpi');
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
  const mood = v.mood.map((b, i) => (fs.writeFileSync(path.join(assets, `d_${key}_m${i}.png`), Buffer.from(b, 'base64')), `d_${key}_m${i}.png`));
  const actions = v.actions.map((b, i) => (fs.writeFileSync(path.join(assets, `d_${key}_a${i}.png`), Buffer.from(b, 'base64')), `d_${key}_a${i}.png`));
  config.variants[key] = { bg: v.bg, surface: v.surface, ink: v.ink, inkSoft: v.inkSoft, line: v.line, tint1: v.tint1, tint2: v.tint2, radius: v.radius, mood, actions };
}
fs.writeFileSync(path.join(assets, 'config.json'), JSON.stringify(config, null, 1));

// Pré-visualizações (modo claro): desenho fiel ao layout nativo.
const v = payload.variants.light;
const img = (b64, size) => `<img src="data:image/png;base64,${b64}" style="width:${size}px;height:${size}px;object-fit:contain">`;
const card = (w, h, inner) => `<div style="width:${w}px;height:${h}px;box-sizing:border-box;background:${v.surface};border:1px solid ${v.line};border-radius:${v.radius}px;display:flex;align-items:center;padding:2px 6px;font-family:Inter,system-ui,sans-serif">${inner}</div>`;
const mood = card(
  300,
  76,
  v.mood.map((b) => `<div style="flex:1;display:grid;place-items:center">${img(b, 46)}</div>`).join(''),
);
const shortcuts = card(
  220,
  76,
  [[v.mood[3], 'Humor'], [v.actions[0], 'Experiência'], [v.actions[1], 'Acontecimento']]
    .map(([b, l]) => `<div style="flex:1;display:flex;flex-direction:column;align-items:center;gap:2px">${img(b, 32)}<span style="font-size:10px;color:${v.ink}">${l}</span></div>`)
    .join(''),
);
for (const [name, html, w, h] of [['mood', mood, 300, 76], ['shortcuts', shortcuts, 220, 76]]) {
  await page.setViewportSize({ width: w + 24, height: h + 24 });
  await page.setContent(`<body style="margin:0;background:transparent"><div style="padding:12px">${html}</div></body>`);
  await page.screenshot({ path: path.join(res, `widget_preview_${name}.png`), omitBackground: false });
}
await browser.close();
console.log('widget-defaults:', fs.readdirSync(assets).length, 'arquivos; previews gerados');
