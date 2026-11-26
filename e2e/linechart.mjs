// Testes de interface do gráfico em linha (oscilações de humor e energia).
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PW_PATH ?? 'playwright');
const BASE = process.env.BASE ?? 'http://localhost:5179/';

const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 393, height: 851 }, locale: 'pt-BR' })).newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
const step = (s) => console.log('•', s);
const data = () => page.evaluate(() => window.__pal.store.getState().data);
const go = async (r) => {
  await page.goto(BASE + '#' + r);
  await page.waitForTimeout(300);
};
const chart = () => page.locator('svg[role=group][aria-label^="Gráfico em linha"]');

await page.goto(BASE);
await page.waitForFunction(() => window.__pal?.store.getState().ready);
await page.evaluate(async () => {
  window.__pal.store.setDevice({ onboardingDone: true });
  await window.__pal.store.flush();
});
await page.reload();
await page.waitForFunction(() => window.__pal?.store.getState().ready);

step('sem registros: estado vazio claro, sem gráfico quebrado');
await go('/trajetoria/oscilacoes');
await page.getByText('Sem registros neste recorte').first().waitFor();

step('com dados: linhas de humor e energia, legenda e eixos com os símbolos escolhidos');
await page.evaluate(async () => window.__pal.seed());
await go('/trajetoria/oscilacoes');
await chart().waitFor();
const svg = chart();
assert.ok((await svg.locator('path[stroke="var(--ink-soft)"]').count()) >= 1, 'linha de humor');
assert.ok((await svg.locator('path[stroke-dasharray="6 4"]').count()) >= 1, 'linha de energia tracejada');
assert.ok((await svg.locator('circle').count()) > 5, 'marcadores de humor');
assert.ok((await svg.locator('rect[width="7"]').count()) > 5, 'marcadores quadrados da energia');
await page.getByText(/Humor, à esquerda/).waitFor();
await page.getByText(/Energia, à direita/).waitFor();
// 5 símbolos do humor à esquerda + 5 ícones de energia à direita
assert.ok((await svg.locator('g[transform] > svg').count()) >= 5);

step('marcadores usam a cor de cada nível (muda com a paleta)');
const fills = await svg.locator('circle').evaluateAll((els) => [...new Set(els.map((e) => e.getAttribute('fill')))].filter((f) => f?.startsWith('var(--mood-')));
assert.ok(fills.length >= 3, `cores de nível: ${fills}`);

step('lacunas de mais de 3 dias interrompem a linha');
const segs = await svg.locator('path[stroke="var(--ink-soft)"]').count();
const expectedGaps = await page.evaluate(async () => {
  const d = window.__pal.store.getState().data;
  const to = new Date();
  const from = new Date(to.getTime() - 29 * 86400000);
  const day = (x) => `${x.getFullYear()}-${String(x.getMonth() + 1).padStart(2, '0')}-${String(x.getDate()).padStart(2, '0')}`;
  const pts = d.moodEntries.filter((m) => m.at.slice(0, 10) >= day(from)).map((m) => new Date(m.timePrecision === 'day' ? m.at.slice(0, 10) + 'T12:00:00' : m.at).getTime()).sort((a, b) => a - b);
  let n = 1;
  for (let i = 1; i < pts.length; i++) if (pts[i] - pts[i - 1] > 3 * 86400000) n++;
  return n;
});
assert.equal(segs, expectedGaps);

step('tocar num ponto mostra o detalhe com os nomes da escala e abre o registro');
const box = await svg.boundingBox();
await page.mouse.click(box.x + box.width * 0.55, box.y + box.height * 0.5);
await page.getByRole('button', { name: /Abrir este registro/ }).waitFor();
assert.match(await page.locator('[aria-live=polite]').first().innerText(), /(Muito )?(agradável|desagradável)|Intermediário/i);
await page.getByRole('button', { name: /Abrir este registro/ }).click();
await page.getByRole('dialog', { name: /Editar registro/ }).waitFor();
await page.getByRole('button', { name: 'Fechar' }).click();

step('teclado: setas percorrem os pontos');
await go('/trajetoria/oscilacoes');
await chart().focus();
await page.keyboard.press('ArrowRight');
const t1 = await page.locator('[aria-live=polite]').first().innerText();
await page.keyboard.press('ArrowRight');
const t2 = await page.locator('[aria-live=polite]').first().innerText();
assert.notEqual(t1, t2);
await page.keyboard.press('Escape');
await page.getByText(/Toque no gráfico/).waitFor();

step('desligar a energia remove a linha tracejada; ao menos uma série fica ligada');
await page.getByRole('button', { name: 'Energia', exact: true }).click();
assert.equal(await chart().locator('path[stroke-dasharray="6 4"]').count(), 0);
await page.getByRole('button', { name: 'Humor', exact: true }).click();
assert.equal(await page.getByRole('button', { name: 'Humor', exact: true }).getAttribute('aria-pressed'), 'true');
await page.getByRole('button', { name: 'Energia', exact: true }).click();
await page.getByRole('button', { name: 'Humor', exact: true }).click();
assert.ok((await chart().locator('path[stroke-dasharray="6 4"]').count()) >= 1);
await page.getByRole('button', { name: 'Humor', exact: true }).click();

step('resumo por data usa o resultado do dia (um ponto por data)');
const before = await chart().locator('circle').count();
await page.getByRole('button', { name: 'Resumo por data' }).click();
await page.getByText(/resultado da data/i).first().waitFor();
const dates = await page.evaluate(() => new Set(window.__pal.store.getState().data.moodEntries.map((m) => m.at.slice(0, 10))).size);
assert.ok((await chart().locator('circle').count()) <= before);
await page.getByRole('button', { name: 'Humor', exact: true }).click();

step('tabela alternativa e descrição das variações');
await page.getByText(/Ver como tabela/).click();
assert.ok((await page.locator('details table tbody tr').count()) > 5);
await page.getByText(/subiu em .*desceu em/).first().waitFor();

step('registro retroativo aparece na data em que aconteceu');
await page.evaluate(() => {
  const s = window.__pal.store;
  const d = new Date(Date.now() - 10 * 86400000);
  const day = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  s.upsert('moodEntries', { at: `${day}T23:15:00`, timePrecision: 'exact', valence: -2, energy: 1, note: 'retroativo-teste' });
});
await go('/trajetoria/oscilacoes');
await chart().waitFor();
await page.getByRole('button', { name: 'Cada registro' }).click();
await page.evaluate(() => (document.querySelector('details').open = true));
await page.locator('details table tbody tr', { hasText: '23:15' }).first().waitFor();

step('visão geral: alternar entre distribuição e linha do tempo');
await go('/trajetoria');
await page.getByRole('button', { name: 'Linha do tempo', exact: true }).click();
await chart().waitFor();
await page.getByRole('button', { name: 'Ver em detalhe' }).click();
await page.getByRole('heading', { name: 'Oscilações' }).waitFor();
await go('/trajetoria');
await page.getByRole('button', { name: 'Distribuição' }).click();
await page.getByText(/Cada registro conta uma vez/).waitFor();

step('filtros compartilhados valem para o gráfico');
await go('/trajetoria/oscilacoes');
const total = await chart().locator('circle').count();
await page.evaluate(() => window.__pal.store.setPreferences({ symbolSet: 'moon' }));
await page.getByRole('button', { name: /Filtrar registros/ }).click();
await page.getByRole('dialog', { name: 'Filtrar registros' }).getByRole('button', { name: 'Muito desagradável' }).click();
await page.getByRole('button', { name: /Ver estatísticas/ }).click();
await page.waitForTimeout(300);
assert.ok((await chart().locator('circle').count()) < total);

assert.deepEqual(errors, []);
console.log('\nTodos os fluxos do gráfico em linha passaram.');
await browser.close();
