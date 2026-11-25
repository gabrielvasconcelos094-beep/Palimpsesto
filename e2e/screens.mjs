// Percorre as telas principais no Chromium (viewport de celular) e salva capturas.
// Uso: npx vite --port 5179 & node e2e/screens.mjs [tema] [claro|escuro]
import { createRequire } from 'node:module';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PW_PATH ?? 'playwright');
import fs from 'node:fs';

const BASE = process.env.BASE ?? 'http://localhost:5179/';
const theme = process.argv[2] ?? 'papel';
const mode = process.argv[3] ?? 'light';
const OUT = `e2e/screens/${theme}-${mode}`;
fs.mkdirSync(OUT, { recursive: true });

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 393, height: 851 }, deviceScaleFactor: 1, colorScheme: mode === 'dark' ? 'dark' : 'light', locale: 'pt-BR' });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('console', (m) => m.type() === 'error' && errors.push(m.text()));

await page.goto(BASE);
await page.waitForFunction(() => window.__pal?.store.getState().ready);
await page.evaluate(async (t) => {
  await window.__pal.seed();
  window.__pal.store.setPreferences({ themeId: t, appearance: 'system' });
  await window.__pal.store.flush();
}, theme);

const shots = [
  ['01-hoje', '/'],
  ['02-diario', '/diario'],
  ['03-calendario', '/diario?v=calendario'],
  ['04-mapa', '/mapa'],
  ['05-descobertas', '/mapa?t=descobertas'],
  ['06-ficha', '/mapa/ficha/sec.necessidades'],
  ['07-guia', '/guia'],
  ['08-estrategias', '/guia?t=repertorio&k=strategy'],
  ['09-situacoes', '/guia?t=situacoes'],
  ['10-cartas', '/guia?t=cartas'],
  ['11-trajetoria', '/trajetoria'],
  ['12-ajustes', '/ajustes'],
  ['13-temas', '/ajustes/temas'],
  ['14-dados', '/ajustes/dados'],
  ['15-escala', '/ajustes/escala'],
  ['16-privacidade', '/ajustes/privacidade'],
];
for (const [name, path] of shots) {
  await page.goto(BASE + '#' + path);
  await page.waitForTimeout(350);
  await page.screenshot({ path: `${OUT}/${name}.png`, fullPage: process.env.FULL === '1' });
}
// Detalhes navegando pela interface
const sit = await page.evaluate(() => window.__pal.store.list('situations')[0].id);
await page.goto(BASE + '#/guia/situacao/' + sit);
await page.waitForTimeout(300);
await page.screenshot({ path: `${OUT}/17-situacao.png`, fullPage: true });
const item = await page.evaluate(() => window.__pal.store.list('repertoire')[0].id);
await page.goto(BASE + '#/guia/item/' + item);
await page.waitForTimeout(300);
await page.screenshot({ path: `${OUT}/18-item.png`, fullPage: true });
const exp = await page.evaluate(() => window.__pal.store.list('experiences')[0].id);
await page.goto(BASE + '#/diario/experiencia/' + exp);
await page.waitForTimeout(300);
await page.screenshot({ path: `${OUT}/19-experiencia.png`, fullPage: true });
const q = await page.evaluate(() => window.__pal.store.list('answers')[0].questionId);
await page.goto(BASE + '#/mapa/pergunta/' + q);
await page.waitForTimeout(300);
await page.screenshot({ path: `${OUT}/20-pergunta.png` });
// Registro rápido de humor
await page.goto(BASE + '#/');
await page.waitForTimeout(300);
await page.getByRole('button', { name: /^Agradável$/ }).first().click();
await page.waitForTimeout(400);
await page.screenshot({ path: `${OUT}/21-registro.png` });
await page.goto(BASE + '#/trajetoria');
await page.waitForTimeout(300);
await page.screenshot({ path: `${OUT}/22-trajetoria-full.png`, fullPage: true });

console.log(errors.length ? 'ERROS:\n' + errors.join('\n') : 'Sem erros no console.');
await browser.close();
