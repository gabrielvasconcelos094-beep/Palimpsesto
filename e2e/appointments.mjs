// Testes de interface: consultas (agendar, lembrete, antes/depois, pauta, PDF) e medicamentos.
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PW_PATH ?? 'playwright');
const BASE = process.env.BASE ?? 'http://localhost:5179/';
const SHOTS = process.env.SHOTS;

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 393, height: 851 }, locale: 'pt-BR', acceptDownloads: true });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
const step = (s) => console.log('•', s);
const data = () => page.evaluate(() => window.__pal.store.getState().data);
const go = async (r) => {
  await page.goto(BASE + '#' + r);
  await page.waitForTimeout(350);
};
const shot = async (n) => SHOTS && page.screenshot({ path: `${SHOTS}/${n}.png`, fullPage: true });
const day = (n) => page.evaluate((n) => {
  const d = new Date();
  d.setDate(d.getDate() + n);
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}, n);

await page.goto(BASE);
await page.waitForFunction(() => window.__pal?.store.getState().ready);
await page.evaluate(async () => {
  window.__pal.store.setDevice({ onboardingDone: true });
  await window.__pal.store.flush();
});

step('sem consultas: convite para agendar');
await go('/guia?t=acompanhamento');
await page.getByText('Agendar a próxima consulta').waitFor();

step('uma consulta realizada antes (para o "desde a última consulta")');
const before = await day(-20);
await page.evaluate((d) => window.__pal.store.upsert('appointments', { date: d, time: '10:00', forWhom: 'psiquiatria', professional: 'Dra. Helena', status: 'done' }), before);
for (let i = 1; i <= 6; i++) await page.evaluate(([d, v]) => window.__pal.store.upsert('moodEntries', { at: `${d}T09:00:00`, valence: v, timePrecision: 'exact' }), [await day(-i), i % 3 - 1]);
await page.evaluate(() => window.__pal.store.upsert('agenda', { text: 'Insônia desde a mudança de dose', forWhom: 'psiquiatria' }));
await page.evaluate(() => window.__pal.store.upsert('agenda', { text: 'Ansiedade no trabalho', forWhom: 'psicologia' }));

step('agendar: data, horário, tipo (o profissional vem da última consulta do mesmo tipo)');
await go('/guia/consulta/nova');
assert.ok(await page.getByRole('button', { name: 'Agendar', exact: true }).isDisabled(), 'exige data');
const date = await day(3);
await page.locator('[aria-label="Data da consulta"]').fill(date);
await page.locator('[aria-label="Horário da consulta"]').fill('14:30');
assert.equal(await page.getByPlaceholder('Ex.: Dra. Helena').inputValue(), 'Dra. Helena');
await page.getByRole('button', { name: 'Agendar', exact: true }).click();
await page.waitForTimeout(300);
assert.match(page.url(), /#\/guia\/consulta\/(?!nova)/);
let ap = (await data()).appointments.find((a) => a.date === date);
assert.equal(ap.time, '14:30');

step('lembrete: escolher antecedência; texto neutro por padrão');
await page.getByRole('button', { name: '1 h antes' }).click();
await page.waitForTimeout(300);
ap = (await data()).appointments.find((a) => a.date === date);
assert.equal(ap.reminderMinutes, 60);
await page.getByText(/Vai tocar .* às 13:30/).waitFor();
let sched = await page.evaluate(() => Object.values(window.__reminders?.scheduled ?? {}));
assert.equal(sched.length, 1);
assert.equal(sched[0].body, 'Você tem um compromisso às 14:30.');
await page.getByText('Mostrar na notificação que é uma consulta').click();
await page.waitForTimeout(300);
sched = await page.evaluate(() => Object.values(window.__reminders.scheduled));
assert.equal(sched[0].body, 'Consulta de psiquiatria às 14:30 com Dra. Helena.');

step('antes: resumo desde a última consulta, pauta filtrada, perguntas e pedidos');
await page.getByText(/Desde a última consulta/).waitFor();
await page.getByText(/6 registro\(s\) de humor/).waitFor();
await page.getByText('Insônia desde a mudança de dose').waitFor();
assert.equal(await page.getByText('Ansiedade no trabalho').count(), 0, 'assunto da psicologia não entra');
await page.getByPlaceholder(/esse efeito colateral passa/).fill('Posso tomar à noite?');
await page.getByRole('button', { name: 'Receita', exact: true }).click();
await page.getByPlaceholder('Novo assunto…').fill('Perguntar sobre exames de sangue');
await page.getByRole('button', { name: 'Adicionar' }).click();
await page.waitForTimeout(300);
ap = (await data()).appointments.find((a) => a.date === date);
assert.equal(ap.questions, 'Posso tomar à noite?');
assert.deepEqual(ap.requests, ['receita']);
assert.ok((await data()).agenda.some((x) => x.text === 'Perguntar sobre exames de sangue' && x.forWhom === 'psiquiatria'));
await shot('appt-before');

step('resumo em PDF desta consulta');
const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 20000 }), page.getByRole('button', { name: /Resumo em PDF para esta consulta/ }).click()]);
assert.equal(dl.suggestedFilename(), `palimpsesto-consulta-${date}.pdf`);
const fs = await import('node:fs');
assert.equal(fs.readFileSync(await dl.path()).subarray(0, 4).toString(), '%PDF');

step('Hoje mostra a consulta dos próximos dias');
await go('/');
await page.getByText(/Psiquiatria em 3 dias, 14:30/).waitFor();
await page.getByText(/Psiquiatria em 3 dias/).click();
await page.waitForTimeout(300);
assert.match(page.url(), /#\/guia\/consulta\//);

step('depois: marcar como realizada cancela o lembrete; observações, combinados e pauta conversada');
await page.getByRole('button', { name: 'Marcar como realizada' }).click();
await page.waitForTimeout(300);
sched = await page.evaluate(() => Object.values(window.__reminders.scheduled));
assert.equal(sched.length, 0, 'lembrete cancelado');
await page.getByPlaceholder(/ela notou que a ansiedade/).fill('Notou melhora do sono');
await page.getByPlaceholder(/registrar os pensamentos/).fill('Manter 100 mg; voltar em 30 dias');
await page.getByLabel('Conversado: Insônia desde a mudança de dose').click();
await page.waitForTimeout(300);
ap = (await data()).appointments.find((a) => a.date === date);
assert.equal(ap.status, 'done');
assert.equal(ap.observations, 'Notou melhora do sono');
assert.ok((await data()).agenda.find((x) => x.text.startsWith('Insônia')).doneAt);
await shot('appt-after');

step('agendar a próxima a partir desta (mesmo profissional)');
await page.getByRole('button', { name: 'Agendar a próxima' }).click();
await page.waitForTimeout(300);
assert.equal(await page.getByPlaceholder('Ex.: Dra. Helena').inputValue(), 'Dra. Helena');

step('medicamentos: novo, mudança de dose, observação, parar e histórico');
await go('/guia/remedio/novo');
await page.getByPlaceholder('Ex.: Sertralina').fill('Sertralina');
await page.getByPlaceholder('Ex.: 50 mg').fill('50 mg');
await page.locator('[aria-label="Data de início"]').fill(await day(-60));
await page.getByRole('button', { name: '1x ao dia, de manhã' }).click();
await page.getByRole('button', { name: 'Salvar' }).click();
await page.waitForTimeout(300);
await page.getByRole('button', { name: 'Mudou a dose ou a frequência' }).click();
await page.locator('.card input.input').first().fill('100 mg');
await page.locator('[aria-label="Data da mudança"]').fill(await day(-10));
await page.getByRole('button', { name: 'Registrar mudança' }).click();
await page.waitForTimeout(200);
await page.getByRole('button', { name: 'Anotar observação' }).click();
await page.getByPlaceholder(/sono mais pesado/).fill('Enjoo nos primeiros dias');
await page.getByRole('button', { name: 'Salvar observação' }).click();
await page.waitForTimeout(300);
let med = (await data()).medications.find((m) => m.name === 'Sertralina');
assert.deepEqual(med.doses.map((d) => d.dose), ['50 mg', '100 mg']);
assert.equal(med.notes[0].text, 'Enjoo nos primeiros dias');
await page.getByText('Nova dose').waitFor();
await shot('med-detail');
await go('/guia/remedio/novo');
await page.getByPlaceholder('Ex.: Sertralina').fill('Quetiapina');
await page.getByPlaceholder('Ex.: 50 mg').fill('25 mg');
await page.locator('[aria-label="Data de início"]').fill(await day(-200));
await page.getByText('Já parei de tomar').click();
await page.locator('[aria-label="Data em que parou"]').fill(await day(-120));
await page.getByRole('button', { name: 'Efeitos colaterais' }).click();
await page.getByRole('button', { name: 'Salvar' }).click();
await page.waitForTimeout(300);
await go('/guia?t=acompanhamento');
await page.getByText('Sertralina · 100 mg').waitFor();
assert.equal(await page.getByText('Quetiapina · 25 mg').count(), 0, 'anterior fica recolhido');
await page.getByRole('button', { name: /medicamentos anteriores \(1\)/ }).click();
await page.getByText(/efeitos colaterais/).waitFor();
await shot('care-tab-2');

assert.deepEqual(errors, [], 'sem erros de página');
console.log('\nTodos os fluxos de consultas e medicamentos passaram.');
await browser.close();
