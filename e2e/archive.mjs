// Testes de interface (1.11) das áreas que ainda não tinham e2e: Situações, Cartas
// (lacre, busca e desfazer), Descobertas (vínculos e cascata), Repertório (uso e
// avaliação) e restauração de uma cópia de segurança automática.
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PW_PATH ?? 'playwright');
const BASE = process.env.BASE ?? 'http://localhost:5179/';

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 393, height: 851 }, locale: 'pt-BR' });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
const step = (s) => console.log('•', s);
const data = () => page.evaluate(() => window.__pal.store.getState().data);
/** Espera uma condição sobre os dados (em vez de esperas fixas). */
const until = (fn, arg) => page.waitForFunction(fn, arg, { timeout: 5000 });
const go = async (r) => {
  await page.goto(BASE + '#' + r);
  await page.waitForFunction(() => window.__pal?.store.getState().ready);
};
const future = (n) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
};

await go('/');
await page.evaluate(async () => {
  window.__pal.store.setDevice({ onboardingDone: true });
  await window.__pal.store.flush();
});

step('Situações: criar, lista de cuidados, marcar como feito');
await go('/guia?t=situacoes');
await page.getByRole('button', { name: 'Nova situação' }).first().click();
await page.getByPlaceholder('Ex.: Casamento da minha prima').fill('Viagem de trabalho');
await page.getByRole('button', { name: 'Criar', exact: true }).click();
await page.getByRole('heading', { name: 'Viagem de trabalho' }).waitFor();
await page.getByRole('textbox', { name: 'Novo cuidado' }).fill('Dormir cedo na véspera');
await page.getByRole('button', { name: 'Adicionar cuidado' }).click();
await page.getByText('Dormir cedo na véspera').waitFor();
await page.getByRole('button', { name: 'Marcar como feito' }).click();
await until(() => window.__pal.store.getState().data.situations[0]?.checklist[0]?.done === true);
const sit = (await data()).situations[0];
assert.equal(sit.title, 'Viagem de trabalho');

step('Cartas: lacrada até uma data futura; conteúdo não aparece na lista nem na busca');
await go('/guia/carta/nova');
await page.getByRole('textbox', { name: 'Título' }).fill('Para depois da viagem');
await page.getByPlaceholder('Querido eu do futuro…').fill('Lembre que o cansaço passa: palavraSecretaXYZ');
await page.locator('input[type=date]').first().fill(future(10));
await page.getByText('Lacrar até a data').click();
await until(() => window.__pal.store.getState().data.letters[0]?.sealed === true);
await go('/guia?t=cartas');
await page.getByText(/lacrada até/).waitFor();
assert.equal(await page.getByText(/palavraSecretaXYZ/).count(), 0, 'lista não mostra o conteúdo');
await go('/busca');
await page.getByRole('searchbox').or(page.getByRole('textbox')).first().fill('palavraSecretaXYZ');
await page.getByText('Nada encontrado para “palavraSecretaXYZ”.').waitFor(); // o texto lacrado não é pesquisável
await page.getByRole('searchbox').or(page.getByRole('textbox')).first().fill('depois da viagem');
await page.getByText(/resultado\(s\)/).waitFor(); // o título continua encontrável
assert.equal(await page.locator('main').getByText(/cansaço passa/).count(), 0, 'busca não revela carta lacrada');

step('Cartas: lacrada esconde o texto; abrir antes da data pede confirmação; excluir e desfazer');
const letterId = (await data()).letters[0].id;
await go(`/guia/carta/${letterId}`);
await page.getByText(/^Lacrada até/).waitFor();
assert.equal(await page.getByText(/cansaço passa/).count(), 0);
await page.getByRole('button', { name: 'Abrir mesmo assim' }).click();
await page.locator('.dialog').getByRole('button', { name: 'Abrir agora' }).click();
await until((id) => !!window.__pal.store.getState().data.letters.find((l) => l.id === id).openedAt, letterId);
await go(`/guia/carta/${letterId}`);
await page.getByText(/cansaço passa/).waitFor();
await page.getByRole('button', { name: 'Excluir carta' }).first().click();
await page.locator('.dialog').getByRole('button', { name: 'Excluir' }).click();
await page.getByRole('button', { name: 'Desfazer' }).click();
await until((id) => window.__pal.store.getState().data.letters.some((l) => l.id === id), letterId);

step('Descobertas: nova, firmeza, vínculo a um registro; excluir o registro limpa o vínculo e desfazer devolve');
const moodId = await page.evaluate(() => window.__pal.store.upsert('moodEntries', { at: '2026-11-20T10:00:00', valence: 1, timePrecision: 'exact' }).id);
await go('/mapa/descoberta/nova');
await page.getByPlaceholder('preciso de tempo só depois de eventos sociais').fill('Viajar me cansa mais do que eu admito');
await until(() => window.__pal.store.getState().data.discoveries.length === 1);
const discId = (await data()).discoveries[0].id;
await page.evaluate(([d, m]) => window.__pal.store.patch('discoveries', d, { moodEntryIds: [m] }), [discId, moodId]);
await page.evaluate((m) => (window.__undoMood = window.__pal.store.removeUndoable('moodEntries', m)), moodId);
assert.deepEqual((await data()).discoveries[0].moodEntryIds, []);
await page.evaluate(() => window.__undoMood());
assert.deepEqual((await data()).discoveries[0].moodEntryIds, [moodId]);
await go('/mapa?t=descobertas');
await page.getByText('Viajar me cansa mais do que eu admito').first().waitFor();

step('Repertório: nova atividade, uso avaliado, aparece no item');
await go('/guia?t=repertorio');
await go('/guia/item/novo?tipo=resource');
await page.getByPlaceholder('Ex.: Ouvir música com fones').fill('Caminhar no parque');
await until(() => window.__pal.store.getState().data.repertoire.some((i) => i.name === 'Caminhar no parque'));
const itemId = (await data()).repertoire.find((i) => i.name === 'Caminhar no parque').id;
await page.evaluate((id) => window.__pal.store.upsert('uses', { itemId: id, at: '2026-11-21T18:00:00', outcome: 'worked', tags: [], note: '' }), itemId);
await go(`/guia/item/${itemId}`);
await page.getByText(/Funcionou|funcionou/).first().waitFor();
step('Repertório: excluir o item apaga os usos; desfazer devolve item e usos');
await page.evaluate((id) => (window.__undoItem = window.__pal.store.removeUndoable('repertoire', id)), itemId);
assert.equal((await data()).uses.filter((u) => u.itemId === itemId).length, 0);
await page.evaluate(() => window.__undoItem());
assert.equal((await data()).uses.filter((u) => u.itemId === itemId).length, 1);

step('cópia de segurança automática: substituir os dados e restaurar pela interface');
const before = (await data()).moodEntries.length;
await page.evaluate(async () => {
  const s = window.__pal.store;
  await s.replaceAll({ ...s.getState().data, moodEntries: [] }, 'Antes do teste de restauração');
});
assert.equal((await data()).moodEntries.length, 0);
await go('/ajustes/dados');
const row = page.locator('.list-row', { hasText: 'Antes do teste de restauração' });
await row.getByRole('button', { name: 'Restaurar' }).click();
await page.locator('.dialog').getByRole('button', { name: 'Restaurar' }).click();
await page.getByText('Cópia restaurada.').waitFor();
assert.equal((await data()).moodEntries.length, before, 'registros de volta');
await page.locator('.list-row', { hasText: /Antes de restaurar/ }).first().waitFor(); // o estado anterior também foi guardado

assert.deepEqual(errors, [], 'sem erros de página');
console.log('\nTodos os fluxos de Situações, Cartas, Descobertas, Repertório e cópias passaram.');
await browser.close();
