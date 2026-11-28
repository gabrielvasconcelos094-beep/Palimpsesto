// 1.13 pela interface: medicamento antigo com o que não se lembra e observações da
// interrupção; contexto no registro de humor; "Para este momento" no Hoje levando à
// origem; resumo de contextos na Trajetória; fichas novas do Mapa.
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
const until = (fn, arg) => page.waitForFunction(fn, arg, { timeout: 5000 });
const go = async (r) => {
  await page.goto(BASE + '#' + r);
  await page.waitForFunction(() => window.__pal?.store.getState().ready);
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
};

await go('/');
await page.evaluate(() => window.__pal.store.setDevice({ onboardingDone: true }));

step('medicamento antigo: ano de início, dose e fim desconhecidos, motivo e observações');
await go('/guia/remedio/novo');
await page.getByPlaceholder('Ex.: Sertralina').fill('Fluoxetina');
await page.getByRole('button', { name: 'Não me lembro da dose' }).click();
const startGroup = page.getByRole('group', { name: 'Data de início: precisão' });
await startGroup.getByRole('button', { name: 'Só o ano' }).click();
// Digitando tecla por tecla, como no aparelho (com fill() o defeito do ano não aparecia).
await page.getByRole('textbox', { name: 'Data de início' }).pressSequentially('2019');
assert.equal(await page.getByRole('textbox', { name: 'Data de início' }).inputValue(), '2019');
await page.getByText('Já parei de tomar').click();
await page.getByRole('group', { name: 'Data em que parou: precisão' }).getByRole('button', { name: 'Não me lembro' }).click();
await page.getByRole('button', { name: 'Efeitos colaterais' }).click();
await page.getByPlaceholder('Ex.: sonolência excessiva durante o dia e tontura.').fill('Sonolência excessiva durante o dia e tontura.');
await page.getByRole('button', { name: 'Salvar', exact: true }).click();
await until(() => window.__pal.store.getState().data.medications.length === 1);
let m = (await data()).medications[0];
assert.deepEqual(
  [m.startDate, m.endDate, m.endUnknown, m.stopReason, m.stopNote, m.doses[0].dose, m.doses[0].doseUnknown, m.doses[0].date],
  ['2019', null, true, 'efeitos', 'Sonolência excessiva durante o dia e tontura.', '', true, '2019'],
);
await page.getByText('dose desconhecida').first().waitFor();
await page.getByText(/data desconhecida · Parou/).waitFor();
await page.getByText(/Efeitos colaterais — Sonolência excessiva/).waitFor();

step('observações editáveis depois; "voltei a tomar" guarda a interrupção como observação');
await page.getByText(/Editar dados, interrupção e datas/).click();
const note = page.getByPlaceholder('Ex.: sonolência excessiva durante o dia e tontura.');
await note.fill('Sonolência excessiva e tontura; parei após conversar com a psiquiatra.');
await until(() => /psiquiatra/.test(window.__pal.store.getState().data.medications[0].stopNote));
await page.getByRole('button', { name: 'Voltei a tomar' }).click();
await until(() => !window.__pal.store.getState().data.medications[0].endUnknown);
m = (await data()).medications[0];
assert.equal(m.stopNote, '');
assert.match(m.notes[0].text, /Interrupção anterior: Efeitos colaterais — Sonolência excessiva e tontura/);

step('registro de humor com contexto (área + marcador próprio) e descrição');
await page.evaluate(() => {
  const s = window.__pal.store;
  s.upsert('repertoire', { kind: 'resource', name: 'Ouvir música', circumstances: 'Durante o trabalho', tags: [] });
  const frus = s.list('emotions').find((e) => e.label === 'Frustração');
  s.patch('emotions', frus.id, { helps: 'Respirar antes de responder.' });
});
await go('/');
await page.getByRole('button', { name: 'Intermediário', exact: true }).first().click();
await page.locator('.sheet').getByRole('button', { name: 'Frustração' }).click();
const ctx = page.locator('.sheet').getByRole('group', { name: 'Contexto' });
await ctx.getByRole('button', { name: 'trabalho', exact: true }).click();
await ctx.getByRole('button', { name: 'outro' }).click();
await page.getByRole('textbox', { name: 'Novo contexto' }).fill('prazo apertado');
await page.locator('.sheet').getByRole('button', { name: 'Adicionar', exact: true }).click();
await page.getByPlaceholder('Ex.: fiquei frustrado com uma dificuldade no trabalho.').fill('Uma dificuldade com o prazo do projeto.');
assert.equal(await ctx.getByRole('button', { name: 'trabalho', exact: true }).getAttribute('aria-pressed'), 'true');
await page.locator('.sheet .sheet-actions .btn.primary').click();
await until(() => window.__pal.store.getState().data.moodEntries.length === 1);
const e = (await data()).moodEntries[0];
assert.deepEqual(e.tags, ['trabalho', 'prazo apertado']);
assert.match(e.note, /prazo do projeto/);

step('"Para este momento": o que você registrou, com a origem; dispensar');
const card = page.locator('section', { hasText: 'Para este momento' });
await card.getByText('Quando sente frustração').waitFor();
await card.getByText('Você registrou que faz bem — durante o trabalho.').waitFor();
await card.getByText('Ouvir música').click();
await until(() => location.hash.startsWith('#/guia/item/'));
assert.equal(await page.locator('input[placeholder="Ex.: Ouvir música com fones"]').inputValue(), 'Ouvir música');
await go('/');
await card.getByRole('button', { name: 'Dispensar' }).click();
await until(() => window.__pal.store.getState().device.dismissedSupport.length === 1);
assert.equal(await page.locator('section', { hasText: 'Para este momento' }).count(), 0);

step('pode ser desligado nos ajustes');
await page.evaluate(() => window.__pal.store.setDevice({ dismissedSupport: [] }));
await go('/ajustes/indicadores');
await page.getByText('Lembrar do que já ajudou, em momentos difíceis').click();
await until(() => window.__pal.store.getState().data.preferences.supportSuggestions === false);
await go('/');
await page.getByText('Registros de hoje').waitFor();
assert.equal(await page.locator('section', { hasText: 'Para este momento' }).count(), 0);

step('Trajetória → Contextos: resumo descritivo e filtro no Diário');
await page.evaluate(() => {
  const s = window.__pal.store;
  for (let i = 1; i <= 3; i++) {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    s.upsert('moodEntries', { at: `${k}T10:00:00`, timePrecision: 'exact', valence: -1, tags: ['trabalho'] });
  }
});
await go('/trajetoria/contextos');
await page.getByRole('heading', { name: 'O que você relatou' }).waitFor();
await page.getByText(/4 reg\. · 4 data\(s\)/).waitFor();
await page.locator('.chips').getByRole('button', { name: 'trabalho' }).click();
await until(() => location.hash.startsWith('#/diario'));
await page.getByText(/Uma dificuldade com o prazo/).waitFor();

step('Mapa: fichas novas, na ordem, com dicas e referências');
await go('/mapa');
const titles = await page.locator('main .card .h3').allTextContents();
assert.equal(titles[1].trim(), 'História de vida');
assert.ok(titles.includes('Pensamentos e crenças') && titles.includes('Sofrimento e cuidado') && titles.at(-1).trim() === 'Existência e sentido');
await go('/mapa/pergunta/q.existencia.05');
await page.getByText(/plano de segurança ou ligue 188/).waitFor();

step('1.13.1: atalhos logo abaixo da caixa de humor; horas com vírgula; cor sem #');
await page.evaluate(() => window.__pal.store.setPreferences({ trackSleep: true }));
await go('/');
const boxes = await page.evaluate(() => {
  const mood = [...document.querySelectorAll('main .card')].find((c) => c.textContent.includes('Como você está agora?')).getBoundingClientRect();
  const quick = document.querySelector('nav.quick').getBoundingClientRect();
  return { gap: quick.top - mood.bottom, n: document.querySelectorAll('nav.quick button').length };
});
assert.ok(boxes.gap >= 0 && boxes.gap < 30, `atalhos logo abaixo (distância ${boxes.gap})`);
assert.equal(boxes.n, 4);
await page.getByRole('button', { name: 'Escrever para mim' }).click();
await until(() => location.hash.startsWith('#/guia/carta/nova'));
await go('/');
await page.getByText(/Como foi a noite\?|Noite registrada/).first().click();
const hours = page.getByRole('spinbutton', { name: 'Horas de sono' });
await hours.fill('');
await hours.pressSequentially('7,5');
assert.equal(await hours.inputValue(), '7,5');
await page.locator('.sheet .sheet-actions .btn.primary').click();
await until(() => window.__pal.store.getState().data.sleepLogs.some((s) => s.hours === 7.5));
await go('/ajustes/tema/novo?base=papel');
const hex = page.getByRole('textbox', { name: 'Cor principal (hexadecimal)' });
await hex.fill('');
await hex.pressSequentially('1a2b3c');
assert.equal(await hex.inputValue(), '#1a2b3c');

assert.deepEqual(errors, [], 'sem erros de página');
console.log('\nTodos os fluxos da 1.13 passaram.');
await browser.close();
