// Testes de fluxo das melhorias (estilos, símbolos, retroativos, acontecimentos,
// atividades, busca, filtros, Trajetória, importação de backup antigo).
// Uso: npx vite --port 5179 & node e2e/flows2.mjs
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
const step = (s) => console.log('•', s);
const data = () => page.evaluate(() => window.__pal.store.getState().data);
const flush = () => page.evaluate(() => window.__pal.store.flush());
const go = async (r) => {
  await page.goto(BASE + '#' + r);
  await page.waitForTimeout(250);
};
const pad = (n) => String(n).padStart(2, '0');
const dk = (d) => `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
const today = dk(new Date());
const yest = dk(new Date(Date.now() - 86400000));

await page.goto(BASE);
await page.waitForFunction(() => window.__pal?.store.getState().ready);
await page.evaluate(async () => { window.__pal.store.setDevice({ onboardingDone: true }); await window.__pal.store.flush(); });
await page.reload();
await page.waitForFunction(() => window.__pal?.store.getState().ready);

step('padrões: Editorial minimalista + Elementos da natureza');
let d = await data();
assert.equal(d.preferences.visualStyle, 'minimal');
assert.equal(d.preferences.symbolSet, 'nature');
assert.equal(await page.evaluate(() => document.documentElement.dataset.style), 'minimal');

step('registro de humor retroativo (ontem, à tarde) com atividade sugerida');
await go('/diario');
await page.getByRole('button', { name: 'Novo registro' }).click();
await page.getByRole('button', { name: /^Humor/ }).click();
await page.getByRole('button', { name: 'Ontem' }).click();
await page.getByRole('button', { name: 'Tarde' }).click();
await page.getByRole('radio', { name: 'Agradável', exact: true }).click();
await page.getByRole('button', { name: 'Adicionar atividade Ler' }).click();
await page.getByRole('button', { name: 'Salvar', exact: true }).click();
await page.getByText('Registrado.').waitFor();
d = await data();
let m = d.moodEntries[0];
assert.equal(m.at.slice(0, 10), yest);
assert.equal(m.timePrecision, 'period');
assert.equal(Number(m.at.slice(11, 13)) >= 12 && Number(m.at.slice(11, 13)) <= 17, true);
assert.notEqual(m.createdAt.slice(0, 10), m.at.slice(0, 10) === today ? 'x' : m.at.slice(0, 10)); // escrito hoje, aconteceu ontem
const ler = d.repertoire.find((i) => i.name === 'Ler');
assert.equal(ler.kind, 'activity');
assert.deepEqual(m.itemIds, [ler.id]);
await page.getByText('Ontem').first().waitFor();
await page.getByText(/Escrito em/).first().waitFor();

step('outra data, horário exato, e vários registros na mesma data');
for (const [hora, v] of [
  ['08:15', 'Desagradável'],
  ['21:40', 'Muito agradável'],
]) {
  await page.getByRole('button', { name: 'Novo registro' }).click();
  await page.getByRole('button', { name: /^Humor/ }).click();
  await page.getByRole('button', { name: 'Outra data' }).click();
  await page.getByLabel('Data', { exact: true }).fill('2026-10-03');
  await page.getByRole('button', { name: 'Horário exato' }).click();
  await page.getByLabel('Horário exato').fill(hora);
  await page.getByRole('radio', { name: v, exact: true }).click();
  await page.getByRole('button', { name: 'Salvar', exact: true }).click();
  await page.waitForTimeout(300);
}
d = await data();
const oct3 = d.moodEntries.filter((x) => x.at.startsWith('2026-10-03'));
assert.equal(oct3.length, 2);
assert.deepEqual(oct3.map((x) => x.at.slice(11, 16)).sort(), ['08:15', '21:40']);

step('editar registro antigo: muda data e categoria, preserva a data de criação');
const old = oct3.find((x) => x.at.includes('08:15'));
await go(`/diario?registro=${old.id}`);
await page.getByText('Editar registro').waitFor();
await page.getByRole('button', { name: 'Outra data' }).click();
await page.getByLabel('Data', { exact: true }).fill('2026-10-02');
await page.getByRole('radio', { name: 'Intermediário', exact: true }).click();
await page.getByRole('button', { name: 'Salvar alterações' }).click();
d = await data();
const edited = d.moodEntries.find((x) => x.id === old.id);
assert.equal(edited.at.slice(0, 10), '2026-10-02');
assert.equal(edited.valence, 0);
assert.equal(edited.createdAt, old.createdAt);
assert.notEqual(edited.updatedAt, old.updatedAt);

step('calendário: registrar num dia passado');
await go('/diario?v=calendario');
await page.getByRole('button', { name: 'Mês anterior' }).click();
await page.getByRole('button', { name: /^3: / }).click();
await page.getByRole('button', { name: 'Registrar neste dia' }).click();
await page.getByRole('button', { name: /^Humor/ }).click();
await page.getByRole('radio', { name: 'Muito desagradável', exact: true }).click();
await page.getByRole('button', { name: 'Salvar', exact: true }).click();
d = await data();
const prevMonth = new Date(new Date().getFullYear(), new Date().getMonth() - 1, 3);
const cal = d.moodEntries.find((x) => x.valence === -2);
assert.equal(cal.at.slice(0, 10), dk(prevMonth));
assert.equal(cal.timePrecision, 'day');

step('acontecimento retroativo aparece no Diário e na Trajetória');
await go('/diario/acontecimento/novo');
await page.getByLabel('O que aconteceu?').fill('Viagem à serra');
await page.getByRole('button', { name: /Viagem$/ }).click();
await page.getByLabel('Quando começou (data)').fill('2026-10-01');
await page.getByLabel('Até quando (data)').fill('2026-10-04');
await page.waitForTimeout(800);
await page.getByRole('button', { name: 'Concluir' }).click();
d = await data();
assert.equal(d.events.length, 1);
assert.equal(d.events[0].date, '2026-10-01');
assert.equal(d.events[0].endDate, '2026-10-04');
assert.equal(d.events[0].category, 'viagem');
await go('/trajetoria');
await page.getByRole('button', { name: 'Tudo', exact: true }).click();
await go('/trajetoria/linha');
await page.getByText('Viagem à serra').waitFor();
await page.getByText(/2 registro\(s\) no período|3 registro\(s\) no período/).waitFor();

step('filtros combinados no Diário (desagradável + data)');
await go('/diario');
await page.getByRole('button', { name: /^Filtros/ }).click();
await page.getByRole('dialog', { name: 'Filtrar registros' }).getByRole('button', { name: 'Muito desagradável' }).click();
await page.getByRole('button', { name: /^Ver \d+ resultado/ }).click();
await page.getByText(/1 resultado\(s\)/).waitFor();
await page.getByRole('button', { name: 'Limpar' }).first().click();

step('busca geral');
await go('/busca');
await page.getByLabel('Buscar em todo o Palimpsesto').fill('serra');
await page.getByText('Acontecimentos · 1').waitFor();
await page.getByLabel('Buscar em todo o Palimpsesto').fill('ler');
await page.getByText(/Repertório · /).waitFor();

step('estilo Editorial orgânico + paleta Menta, persistentes');
await go('/ajustes/temas');
await page.getByRole('radio', { name: /Editorial orgânico/ }).click();
await page.getByRole('button', { name: 'Tema Menta' }).click();
await flush();
await page.reload();
await page.waitForFunction(() => window.__pal?.store.getState().ready);
assert.equal(await page.evaluate(() => document.documentElement.dataset.style), 'organic');
assert.equal((await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--bg'))).trim().toLowerCase(), '#eef6f1');
await go('/');
assert.match(await page.evaluate(() => getComputedStyle(document.querySelector('.nav')).borderTopLeftRadius), /30px/);

step('símbolos: Fases da lua, persistentes, sem alterar registros');
const before = (await data()).moodEntries.map((x) => [x.id, x.valence]);
await go('/ajustes/escala');
await page.getByRole('radio', { name: /Fases da lua/ }).click();
await flush();
await page.reload();
await page.waitForFunction(() => window.__pal?.store.getState().ready);
d = await data();
assert.equal(d.preferences.symbolSet, 'moon');
assert.deepEqual(d.moodEntries.map((x) => [x.id, x.valence]), before);

step('voltar ao minimalista com paleta personalizada');
await page.evaluate(() => {
  const s = window.__pal.store;
  const now = new Date().toISOString();
  s.setPreferences({ customThemes: [{ id: 'meu', name: 'Meu', createdAt: now, updatedAt: now, colors: { primary: '#7a3e9d', accent: '#e0a030', background: '#fbf7ff', surface: '#ffffff', complement1: '#3f6fa0', complement2: '#d8c0ea' }, radius: 12, cardStyle: 'outline', displayFont: 'lora' }], themeId: 'meu', visualStyle: 'organic' });
});
await page.waitForTimeout(200);
assert.equal((await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--tint-1'))).trim().length > 0, true);
await go('/ajustes/temas');
await page.getByRole('radio', { name: /Editorial minimalista/ }).click();
assert.equal(await page.evaluate(() => document.documentElement.dataset.style), 'minimal');

step('Trajetória: observação ocultável e categorias personalizáveis');
await page.evaluate(async () => {
  await window.__pal.seed();
});
await go('/trajetoria');
await page.getByRole('button', { name: 'Tudo', exact: true }).click();
const hidden = await page.getByRole('button', { name: 'Ocultar' }).count();
if (hidden) {
  await page.getByRole('button', { name: 'Ocultar' }).first().click();
  assert.equal((await data()).preferences.dismissedInsights.length, 1);
}
await page.getByRole('button', { name: 'Personalizar' }).click();
await page.getByRole('switch', { name: /Regularidade dos registros/ }).click();
assert.ok((await data()).preferences.trajectoryHidden.includes('regularidade'));
await page.keyboard.press('Escape');
for (const c of ['dias', 'emocoes', 'energia', 'atividades', 'evolucao', 'contextos', 'calendario', 'regularidade']) await go(`/trajetoria/${c}`);

step('importar um backup do formato antigo (v1) pela interface');
const v1 = {
  format: 'palimpsesto-backup',
  formatVersion: 1,
  schemaVersion: 1,
  appVersion: '1.0.0',
  exportedAt: '2026-03-01T10:00:00.000Z',
  data: {
    schemaVersion: 1,
    moodEntries: [{ id: 'antigo-1', createdAt: '2026-03-01T10:00:00.000Z', updatedAt: '2026-03-01T10:00:00.000Z', at: '2026-02-19T23:30:00.000Z', valence: 2, energy: 4, emotionIds: [], indicators: {}, tags: [], note: 'do formato antigo' }],
    emotions: [], experiences: [], repertoire: [], uses: [], sections: [], questions: [], answers: [], notes: [], discoveries: [], situations: [], letters: [],
    preferences: {},
  },
};
fs.writeFileSync('/tmp/backup-v1.json', JSON.stringify(v1));
await go('/ajustes/dados');
const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.getByRole('button', { name: 'Escolher arquivo' }).click()]);
await chooser.setFiles('/tmp/backup-v1.json');
await page.getByText(/convertido do esquema 1/).waitFor();
await page.getByRole('button', { name: 'Mesclar dados' }).click();
await page.getByText(/Mesclagem concluída/).waitFor();
d = await data();
const imported = d.moodEntries.find((x) => x.id === 'antigo-1');
assert.ok(imported);
assert.match(imported.at, /^2026-02-(19|20)T\d\d:30:00$/);
assert.equal(imported.timePrecision, 'exact');

assert.deepEqual(errors, []);
console.log('\nTodos os fluxos das melhorias passaram.');
await browser.close();
