// A opção escolhida precisa ser inconfundível em qualquer estilo e tema (1.12).
// Antes, no Editorial orgânico, a família de símbolos e a paleta selecionadas não
// tinham nenhuma marca (o estilo remove contornos e o destaque era só a cor da borda).
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PW_PATH ?? 'playwright');
const BASE = process.env.BASE ?? 'http://localhost:5179/';

const browser = await chromium.launch();
const errors = [];
for (const mode of ['light', 'dark']) {
  for (const style of ['minimal', 'organic']) {
    const page = await (await browser.newContext({ viewport: { width: 393, height: 851 }, colorScheme: mode })).newPage();
    page.on('pageerror', (e) => errors.push(String(e)));
    await page.goto(BASE);
    await page.waitForFunction(() => window.__pal?.store.getState().ready);
    await page.evaluate((style) => {
      window.__pal.store.setDevice({ onboardingDone: true });
      window.__pal.store.setPreferences({ appearance: 'system', visualStyle: style, symbolSet: 'moon', chartPalette: 'aurora' });
    }, style);
    for (const route of ['/ajustes/escala', '/ajustes/temas']) {
      await page.goto(BASE + '#' + route);
      await page.locator('.opt').first().waitFor();
      const r = await page.evaluate(() =>
        [...document.querySelectorAll('.opt')].map((el) => {
          const cs = getComputedStyle(el);
          const ring = cs.boxShadow !== 'none' || (parseFloat(cs.borderTopWidth) > 0 && cs.borderTopColor !== 'rgba(0, 0, 0, 0)');
          const on = el.getAttribute('aria-checked') === 'true' || el.getAttribute('aria-pressed') === 'true';
          return { on, ring, check: !!el.querySelector('.opt-check'), name: el.textContent.trim().slice(0, 24) };
        }),
      );
      const sel = r.filter((x) => x.on);
      assert.ok(sel.length >= 1, `${mode}/${style} ${route}: há opção selecionada`);
      for (const x of sel) {
        assert.ok(x.ring, `${mode}/${style} ${route}: contorno visível em “${x.name}”`);
        assert.ok(x.check, `${mode}/${style} ${route}: selo ✓ em “${x.name}”`);
      }
      for (const x of r.filter((y) => !y.on)) assert.ok(!x.check, `${mode}/${style} ${route}: sem selo em “${x.name}”`);
    }
    // Controle segmentado: o botão escolhido tem fundo próprio, diferente do trilho.
    const seg = await page.evaluate(() => {
      const on = document.querySelector('.segmented button[aria-pressed="true"]');
      return { on: getComputedStyle(on).backgroundColor, rail: getComputedStyle(on.parentElement).backgroundColor };
    });
    assert.notEqual(seg.on, seg.rail, `${mode}/${style}: segmento escolhido se destaca`);
    console.log('•', mode, style, 'ok');
    await page.close();
  }
}
assert.deepEqual(errors, []);
console.log('\nA seleção fica visível em todos os estilos e modos.');
await browser.close();
