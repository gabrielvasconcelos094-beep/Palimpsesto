// Testes de interface das estatísticas da Trajetória (1.5): resultado do dia no
// calendário, distribuição clicável, índice por dia da semana, comparação de
// semanas/meses, estabilidade e atualização ao editar e excluir registros.
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
const go = async (r) => {
  await page.goto(BASE + '#' + r);
  // Em vez de uma espera fixa: app pronto e dois quadros desenhados após a troca de rota.
  await page.waitForFunction(() => window.__pal?.store.getState().ready);
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
};
const pad = (n) => String(n).padStart(2, '0');
const localDay = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;

await page.goto(BASE);
await page.waitForFunction(() => window.__pal?.store.getState().ready);
await page.evaluate(async () => {
  window.__pal.store.setDevice({ onboardingDone: true });
  window.__pal.store.setPreferences({ symbolSet: 'nature' });
  await window.__pal.store.flush();
});

// Dados controlados (sem dados fictícios nos gráficos do app: só neste teste).
const today = new Date();
const ago = (n) => localDay(new Date(today.getFullYear(), today.getMonth(), today.getDate() - n));
const add = (day, valence, time = '10:00') =>
  page.evaluate(([at, v]) => window.__pal.store.upsert('moodEntries', { at, valence: v, timePrecision: 'exact' }).id, [`${day}T${time}:00`, valence]);

step('estatísticas sem registros: nada de números inventados');
await go('/trajetoria/evolucao');
await page.getByText('Sem registros neste recorte').first().waitFor();
assert.equal(await page.locator('.index-track, .stackbar').count(), 0);

step('calendário: um símbolo por data, com o resultado do dia (−2 e +1 → −1)');
const d1 = ago(1);
const idA = await add(d1, -2, '08:00');
await add(d1, 1, '20:00');
await go('/trajetoria/calendario');
const cell = page.locator('.cal .day', { hasText: new RegExp(`^${Number(d1.slice(8))}`) }).filter({ has: page.locator('.cal-n') }).first();
await cell.waitFor();
assert.equal(await cell.locator('.cal-mark svg').count(), 1, 'um único símbolo');
assert.equal((await cell.locator('.cal-n').textContent()).trim(), '2');
assert.match(await cell.getAttribute('aria-label'), /Desagradável \(resultado de 2 registros: Muito desagradável, Agradável\)/);
step('poucos dados: índice por dia da semana e estabilidade não concluem');
await go('/trajetoria/dias');
await page.getByText(/é preciso ter pelo menos 3 dias da semana/i).first().waitFor();
await go('/trajetoria/evolucao');
await page.getByText(/É preciso ter pelo menos 5 registros/).first().waitFor();
await go('/trajetoria/calendario');
await cell.waitFor();
step('tocar na data mostra todos os registros individuais, com horário');
await cell.click();
await page.getByText('08:00').first().waitFor();
await page.getByText('20:00').first().waitFor();

step('editar um registro atualiza o resultado do dia');
await page.evaluate((id) => window.__pal.store.patch('moodEntries', id, { valence: 2 }), idA);
await page.waitForTimeout(200);
assert.match(await cell.getAttribute('aria-label'), /^\d+: Muito agradável \(resultado de 2/); // (2 + 1)/2 = 1,5 → 2
step('excluir um registro atualiza o calendário');
await page.evaluate((id) => window.__pal.store.remove('moodEntries', id), idA);
await page.waitForTimeout(200);
assert.equal(await cell.locator('.cal-n').count(), 0);

step('distribuição: total e toque num nível abre os registros daquele nível no Diário');
for (let i = 2; i <= 9; i++) await add(ago(i), i % 2 ? 1 : -1);
await go('/trajetoria');
await page.getByText(/Total: \d+ registros em \d+ datas/).first().waitFor();
await page.getByRole('button', { name: /Ver os registros “Agradável” deste período/ }).click();
await page.waitForTimeout(400);
assert.match(page.url(), /#\/diario\?de=.*&valencia=1/);
const shown = await page.locator('.list-row').count();
const expected = await page.evaluate(() => window.__pal.store.getState().data.moodEntries.filter((m) => m.valence === 1).length);
assert.ok(shown >= 1 && shown <= expected, `diário filtrado (${shown} de ${expected})`);
await page.getByText(/Agradável/).first().waitFor();
assert.equal(await page.getByText('Desagradável', { exact: true }).count(), 0, 'só o nível escolhido');

step('índice por dia da semana aparece com contagem de registros e datas');
await go('/trajetoria/dias');
await page.getByText('Índice por dia da semana').waitFor();
assert.ok((await page.locator('.index-track').count()) === 7);
await page.getByText(/reg\. · \d data\(s\)/).first().waitFor();

step('comparar dois meses escolhidos livremente');
await go('/trajetoria/evolucao');
await page.getByText('Agradável', { exact: true }).first().waitFor(); // o filtro do Diário vale aqui também (compartilhado)
await page.getByRole('button', { name: 'Limpar' }).click();
await page.getByRole('button', { name: 'Meses', exact: true }).click();
const month = localDay(today).slice(0, 7);
await page.getByLabel('Mês B').fill(month);
await page.getByLabel('Mês A').fill('2020-01');
await page.waitForTimeout(200);
await page.getByText(/Ainda não dá para comparar/).first().waitFor(); // janeiro de 2020 está vazio
await page.getByRole('button', { name: 'Semanas', exact: true }).click();
await page.getByText(/índice/).first().waitFor();

step('estabilidade aparece com o período, a contagem e o aviso de que não é bem-estar');
await page.getByText('Estabilidade das avaliações').waitFor();
await page.getByText(/de 100/).first().waitFor();
await page.getByText(/Estabilidade não é bem-estar/).waitFor();

step('Sobre mostra o criador');
await go('/ajustes/sobre');
await page.getByText('Antonio Gabriel Pereira Vasconcelos').waitFor();

assert.deepEqual(errors, [], 'sem erros de página');
console.log('\nTodos os fluxos das estatísticas passaram.');
await browser.close();
