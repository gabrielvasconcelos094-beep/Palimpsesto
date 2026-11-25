// Captura os estilos computados dos componentes principais (para provar que o
// Editorial minimalista não mudou). Uso: BASE=http://localhost:5179/ node e2e/style-snapshot.mjs saida.json
import { createRequire } from 'node:module';
import fs from 'node:fs';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PW_PATH ?? 'playwright');
const BASE = process.env.BASE ?? 'http://localhost:5179/';
const out = process.argv[2] ?? 'style.json';
const PROPS = ['backgroundColor', 'color', 'borderTopLeftRadius', 'borderTopRightRadius', 'borderBottomLeftRadius', 'borderBottomRightRadius', 'borderTopWidth', 'borderTopColor', 'boxShadow', 'fontFamily', 'fontSize', 'fontWeight', 'lineHeight', 'paddingTop', 'paddingLeft', 'marginTop', 'width', 'height', 'letterSpacing', 'textTransform', 'gap', 'display', 'position'];
const ROUTES = {
  '/': ['.page', '.page-title', '.kicker', '.card', '.list', '.list-row', '.nav', '.nav button', '.icon-btn', '.grid-2 .card', 'h2.h3'],
  '/diario': ['.segmented', '.segmented button', '.day-head .d', '.icon-btn.filled', '.list-row .title', '.list-row .meta', '.chip.static'],
  '/mapa': ['.card', '.card .h3', '.page-sub', '.segmented button[aria-pressed="true"]'],
  '/guia': ['.chip', '.card.tight', '.chart-legend'],
  '/ajustes/escala': ['.input', '.btn.primary', '.btn.secondary', '.section-head'],
  '/ajustes/dados': ['.switch', '.btn.primary', '.field .label', '.help'],
  '/trajetoria': ['.stat .n', '.bar-track', '.card.tight'],
};
const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 393, height: 851 } });
await page.goto(BASE);
await page.waitForFunction(() => window.__pal?.store.getState().ready);
await page.evaluate(async () => {
  await window.__pal.seed();
  window.__pal.store.setPreferences({ themeId: 'papel', appearance: 'light' });
  await window.__pal.store.flush();
});
const result = {};
for (const [route, sels] of Object.entries(ROUTES)) {
  await page.goto(BASE + '#' + route);
  await page.evaluate(() => document.fonts.ready);
  await page.waitForTimeout(500);
  for (const sel of sels) {
    result[`${route} ${sel}`] = await page.evaluate(
      ([s, props]) => {
        const el = document.querySelector(s);
        if (!el) return null;
        const cs = getComputedStyle(el);
        return Object.fromEntries(props.map((p) => [p, cs[p]]));
      },
      [sel, PROPS],
    );
  }
}
fs.writeFileSync(out, JSON.stringify(result, null, 1));
console.log('estilos capturados:', Object.keys(result).length, 'seletores →', out);
await browser.close();
