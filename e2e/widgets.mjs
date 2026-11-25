// Testes de interface da integração com os widgets (lado web).
// Uso: npx vite --port 5179 & node e2e/widgets.mjs
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PW_PATH ?? 'playwright');
const BASE = process.env.BASE ?? 'http://localhost:5179/';

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 393, height: 851 }, locale: 'pt-BR' });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
page.on('framenavigated', (f) => f === page.mainFrame() && process.env.DEBUG_NAV && console.log('  nav:', f.url()));
const step = (s) => console.log('•', s);
const data = () => page.evaluate(() => window.__pal.store.getState().data);
const flush = () => page.evaluate(() => window.__pal.store.flush());
const last = () => page.evaluate(() => window.__widgetLast);
const emit = async (a) => {
  // O app registra o ouvinte ao iniciar; espera por ele, como o nativo faz com o evento retido.
  await page.waitForFunction(() => window.__widgetsWeb?.listeners?.widgetAction?.length > 0, null, { timeout: 15000 });
  await page.evaluate((x) => window.__widgetsWeb.emit(x), a);
};
const boot = async () => {
  await page.goto(BASE);
  await page.waitForFunction(() => window.__pal?.store.getState().ready);
};
const pngInfo = (b64) => {
  const b = Buffer.from(b64, 'base64');
  assert.equal(b.slice(1, 4).toString(), 'PNG');
  return { w: b.readUInt32BE(16), h: b.readUInt32BE(20), bytes: b.length, hash: b.toString('base64').slice(60, 200) };
};

await boot();
await page.evaluate(async () => {
  window.__pal.store.setDevice({ onboardingDone: true });
  await window.__pal.store.flush();
});
await page.reload();
await page.waitForFunction(() => window.__pal?.store.getState().ready);

step('ao abrir, o app envia aos widgets a aparência padrão: 5 + 2 PNGs por variante');
await page.waitForFunction(() => window.__widgetLast, null, { timeout: 15000 });
let p = await last();
assert.equal(p.appearance, 'system');
assert.equal(p.style, 'minimal');
assert.deepEqual(Object.keys(p.variants).sort(), ['dark', 'light']);
for (const v of Object.values(p.variants)) {
  assert.equal(v.mood.length, 5);
  assert.equal(v.actions.length, 2);
  for (const b of [...v.mood, ...v.actions]) {
    const i = pngInfo(b);
    assert.equal(i.w, 128);
    assert.equal(i.h, 128);
    assert.ok(i.bytes > 200 && i.bytes < 20000, `tamanho ${i.bytes}`);
  }
}
const natureHashes = p.variants.light.mood.map((b) => pngInfo(b).hash);
assert.equal(new Set(natureHashes).size, 5, 'os cinco níveis são desenhos distintos');
fs.mkdirSync('/tmp/widget-icons', { recursive: true });
p.variants.light.mood.forEach((b, i) => fs.writeFileSync(`/tmp/widget-icons/nature-${i}.png`, Buffer.from(b, 'base64')));

step('trocar a família de símbolos atualiza os widgets (e as imagens mudam)');
await page.evaluate(() => (window.__widgetLast = null));
await page.evaluate(() => window.__pal.store.setPreferences({ symbolSet: 'moon' }));
await page.waitForFunction(() => window.__widgetLast, null, { timeout: 15000 });
p = await last();
const moonHashes = p.variants.light.mood.map((b) => pngInfo(b).hash);
assert.notDeepEqual(moonHashes, natureHashes);
p.variants.light.mood.forEach((b, i) => fs.writeFileSync(`/tmp/widget-icons/moon-${i}.png`, Buffer.from(b, 'base64')));

step('todas as famílias geram PNGs válidos (inclusive emojis)');
const seen = new Set();
for (const set of ['nature', 'faces', 'fine', 'moon', 'weather', 'emoji']) {
  await page.evaluate(() => (window.__widgetLast = null));
  await page.evaluate((s) => window.__pal.store.setPreferences({ symbolSet: s }), set);
  await page.waitForFunction(() => window.__widgetLast, null, { timeout: 15000 });
  p = await last();
  const hs = p.variants.light.mood.map((b) => pngInfo(b).hash);
  assert.equal(new Set(hs).size, 5, `${set}: níveis distintos`);
  seen.add(hs.join('|'));
  p.variants.light.mood.forEach((b, i) => fs.writeFileSync(`/tmp/widget-icons/${set}-${i}.png`, Buffer.from(b, 'base64')));
}
assert.equal(seen.size, 6, 'seis famílias, seis conjuntos diferentes');

step('trocar tema e estilo atualiza cores e estilo');
await page.evaluate(() => (window.__widgetLast = null));
await page.evaluate(() => window.__pal.store.setPreferences({ symbolSet: 'nature', themeId: 'menta', visualStyle: 'organic' }));
await page.waitForFunction(() => window.__widgetLast, null, { timeout: 15000 });
p = await last();
assert.equal(p.style, 'organic');
assert.equal(p.variants.light.bg.toLowerCase(), '#eef6f1');

step('nomes personalizados da escala chegam aos widgets');
await page.evaluate(() => (window.__widgetLast = null));
await page.evaluate(() => window.__pal.store.setPreferences({ valenceLabels: ['Tempestade', null, null, null, 'Sol'] }));
await page.waitForFunction(() => window.__widgetLast, null, { timeout: 15000 });
p = await last();
assert.deepEqual([p.labels[0], p.labels[4]], ['Tempestade', 'Sol']);
await page.evaluate(() => window.__pal.store.setPreferences({ valenceLabels: [null, null, null, null, null], themeId: 'papel', visualStyle: 'minimal' }));

step('mudanças sem efeito visual não reenviam nada');
await page.waitForTimeout(900);
await page.evaluate(() => (window.__widgetLast = null));
await page.evaluate(() => window.__pal.store.setPreferences({ textScale: 1.1, weekStartsOn: 0 }));
await page.waitForTimeout(1200);
assert.equal(await last(), null);

step('toque num símbolo do widget (app aberto): registro de humor já com a valência');
for (const [v, label] of [
  [2, 'Muito agradável'],
  [-2, 'Muito desagradável'],
  [0, 'Intermediário'],
]) {
  await page.goto(BASE + '#/guia');
  await page.waitForTimeout(300);
  await emit(`mood/${v}`);
  await page.getByRole('dialog', { name: 'Como você está?' }).waitFor({ timeout: 5000 }).catch(async (e) => {
    console.log('FALHOU erros:', errors, 'em v =', v, 'hash', await page.evaluate(() => location.hash), 'diálogos', await page.evaluate(() => [...document.querySelectorAll('[role=dialog]')].map((d) => d.getAttribute('aria-label'))), 'sheet?', await page.locator('.sheet').count(), 'listeners', await page.evaluate(() => JSON.stringify(Object.keys(window.__widgetsWeb.listeners || {}).map((k) => k + ':' + window.__widgetsWeb.listeners[k].length))), 'device', await page.evaluate(() => JSON.stringify({ ob: window.__pal.store.getState().device.onboardingDone, lock: window.__pal.store.getState().device.lock.enabled })), 'body', await page.evaluate(() => document.body.innerText.slice(0, 80)));
    throw e;
  });
  assert.equal(await page.getByRole('dialog').getByRole('radio', { name: label, exact: true }).getAttribute('aria-checked'), 'true');
  assert.equal(await page.getByRole('button', { name: 'Salvar', exact: true }).isEnabled(), true);
  assert.equal(await page.evaluate(() => location.hash), `#/?novo=humor&v=${v}`);
  await page.getByRole('button', { name: 'Fechar' }).click();
  await page.waitForFunction(() => location.hash === '#/' || location.hash === '');
  assert.equal(await page.getByRole('dialog').count(), 0);
}

step('concluir o registro rápido: salvo com a valência do widget, no momento atual');
await page.goto(BASE + '#/guia');
await emit('mood/1');
await page.getByRole('dialog').getByRole('radio', { name: 'Agradável', exact: true }).waitFor();
await page.getByRole('button', { name: 'Salvar', exact: true }).click();
await page.getByText('Registrado.').waitFor();
let d = await data();
assert.equal(d.moodEntries.length, 1);
assert.equal(d.moodEntries[0].valence, 1);
assert.equal(d.moodEntries[0].timePrecision, 'exact');
assert.ok(Math.abs(new Date(d.moodEntries[0].at).getTime() - Date.now()) < 120000);
assert.equal(await page.evaluate(() => location.hash), '#/');
await page.waitForTimeout(300);
await page.goBack().catch(() => {});

step('atalhos abrem as telas de criação');
await page.goto(BASE + '#/');
await emit('experience');
await page.getByRole('heading', { name: 'Nova experiência' }).waitFor();
await page.goto(BASE + '#/');
await emit('event');
await page.getByRole('heading', { name: 'Novo acontecimento' }).waitFor();
await page.goto(BASE + '#/');
await emit('mood/new');
const dlg = page.getByRole('dialog', { name: /Como você/ });
await dlg.waitFor();
assert.equal(await dlg.getByRole('radio', { checked: true }).count(), 0);
assert.equal(await page.getByRole('button', { name: 'Salvar', exact: true }).isDisabled(), true);

step('ação inválida é ignorada');
await page.goto(BASE + '#/guia');
await emit('mood/9');
await emit('apagar-tudo');
await page.waitForTimeout(500);
assert.equal(await page.evaluate(() => location.hash), '#/guia');

step('toque no widget com o app a frio (aberto pelo widget): executa após carregar');
await page.addInitScript(() => {
  if (!sessionStorage.getItem('__launched')) {
    sessionStorage.setItem('__launched', '1');
    window.__launchAction = 'mood/-1';
  }
});
await page.reload();
await page.getByRole('dialog', { name: /Como você/ }).waitFor();
assert.equal(await page.getByRole('dialog').getByRole('radio', { name: 'Desagradável', exact: true }).getAttribute('aria-checked'), 'true');
await page.getByRole('button', { name: 'Fechar' }).click();
await page.waitForFunction(() => location.hash === '#/' || location.hash === '');
await page.reload(); // reabrir o app não repete a ação já tratada
await page.waitForTimeout(800);
assert.equal(await page.getByRole('dialog').count(), 0);

step('com PIN: o widget só leva ao registro depois do desbloqueio');
await page.evaluate(async () => {
  const { hashPin } = await import('/src/data/crypto.ts');
  const h = await hashPin('1357');
  window.__pal.store.setDevice({ lock: { enabled: true, pinHash: h.hash, salt: h.salt, iterations: h.iterations, biometric: false, timeoutSec: 0 }, failedUnlocks: 0, lockedUntil: 0 });
  await window.__pal.store.flush();
});
await page.reload();
await page.waitForFunction(() => window.__pal?.store.getState().ready);
await page.getByText('Digite seu PIN').waitFor();
await emit('mood/2');
await page.waitForTimeout(400);
assert.equal(await page.getByRole('dialog').count(), 0, 'nada abre antes do PIN');
for (const k of '1357') await page.getByRole('button', { name: k, exact: true }).click();
await page.getByRole('button', { name: 'Confirmar' }).click();
await page.getByRole('dialog', { name: /Como você/ }).waitFor({ timeout: 15000 });
assert.equal(await page.getByRole('dialog').getByRole('radio', { name: 'Muito agradável', exact: true }).getAttribute('aria-checked'), 'true');

assert.deepEqual(errors, []);
console.log('\nTodos os fluxos dos widgets passaram.');
await browser.close();
