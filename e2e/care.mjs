// Testes de interface do Acompanhamento (1.6): pauta da consulta, questionários
// (com aviso de segurança no item 9 do PHQ-9), plano de segurança, horas de sono,
// medicação como acontecimento e resumo em PDF.
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

await page.goto(BASE);
await page.waitForFunction(() => window.__pal?.store.getState().ready);
await page.evaluate(async () => {
  window.__pal.store.setDevice({ onboardingDone: true });
  await window.__pal.store.flush();
});

step('aba Acompanhamento no Guia');
await go('/guia?t=acompanhamento');
await page.getByRole('heading', { name: 'Pauta' }).waitFor();
await page.getByText('Ainda não respondido').first().waitFor();

step('pauta: adicionar, marcar como conversado, anotar o combinado e desfazer exclusão');
await page.getByPlaceholder(/o sono piorou/).fill('Falar sobre a insônia desde a mudança de dose');
await page.getByRole('button', { name: 'Psiquiatria', exact: true }).click();
await page.getByRole('button', { name: 'Adicionar', exact: true }).click();
await page.getByText('Falar sobre a insônia desde a mudança de dose').waitFor();
assert.equal((await data()).agenda[0].forWhom, 'psiquiatria');
await shot('care-tab');
await page.getByRole('button', { name: 'Marcar como conversado' }).click();
await page.getByPlaceholder(/O que ficou acertado/).fill('Manter a dose por mais 2 semanas');
await page.waitForTimeout(300);
let ag = (await data()).agenda[0];
assert.ok(ag.doneAt, 'marcado como conversado');
assert.match(ag.outcome, /Manter a dose/);
await page.getByRole('button', { name: 'Excluir assunto' }).click();
await page.getByRole('button', { name: 'Desfazer' }).click();
await page.waitForTimeout(200);
assert.equal((await data()).agenda.length, 1);

step('GAD-7: só salva completo; resultado com faixa');
await go('/guia/questionario/gad7');
const groups = page.locator('[role=radiogroup]');
assert.equal(await groups.count(), 7);
assert.ok(await page.getByRole('button', { name: 'Ver resultado' }).isDisabled());
for (let i = 0; i < 7; i++) await groups.nth(i).getByRole('radio').nth(i < 5 ? 2 : 1).click(); // 5×2 + 2×1 = 12
await page.getByRole('button', { name: 'Ver resultado' }).click();
await page.getByText('Faixa de sintomas').waitFor();
await page.getByText('moderados', { exact: true }).waitFor();
assert.equal(await page.locator('[role=alert]').count(), 0, 'GAD-7 não tem item 9');

step('PHQ-9 com item 9 acima de "nenhuma vez": aviso de segurança com CVV e plano');
await go('/guia/questionario/phq9');
const g9 = page.locator('[role=radiogroup][aria-label^="Pensar em se ferir"]');
for (let i = 0; i < 8; i++) await page.locator('[role=radiogroup]').nth(i).getByRole('radio').nth(1).click();
await g9.getByRole('radio').nth(1).click();
await page.getByRole('button', { name: 'Ver resultado' }).click();
await page.locator('[role=alert]').waitFor();
assert.equal(await page.locator('[role=alert] a[href="tel:188"]').count() >= 1, true);
await shot('care-phq9-result');
const phq = (await data()).assessments.find((a) => a.instrument === 'phq9');
assert.equal(phq.answers.length, 9);
assert.equal(phq.answers.reduce((a, b) => a + b, 0), 9);

step('segunda aplicação: mudança relevante e histórico com gráfico');
await page.evaluate(() => {
  const s = window.__pal.store;
  const old = s.getState().data.assessments.find((a) => a.instrument === 'phq9');
  s.patch('assessments', old.id, { date: '2026-10-01', answers: [3, 3, 2, 2, 2, 2, 1, 1, 0] }); // 16 → agora 9
});
await go('/guia/questionario/phq9?v=historico');
await page.locator('svg[role=img][aria-label^="PHQ-9"]').waitFor();
await page.getByText(/relevante/).first().waitFor();
await shot('care-phq9-history');

step('plano de segurança: preencher, persistir e números de emergência sempre visíveis');
await page.getByRole('button', { name: 'Abrir meu plano de segurança' }).count();
await go('/guia/plano');
await page.getByText('1. Meus sinais de alerta').waitFor();
assert.ok((await page.locator('a[href="tel:188"]').count()) >= 1);
await page.getByPlaceholder(/dormir muito pouco/).fill('Dormir menos de 5 h por 3 noites\nMe isolar');
await page.getByPlaceholder(/meu gato/).fill('Minha irmã');
await page.waitForTimeout(400);
const plan = (await data()).safetyPlans;
assert.equal(plan.length, 1);
assert.deepEqual(plan[0].warningSigns, ['Dormir menos de 5 h por 3 noites', 'Me isolar']);
await shot('care-plan');
await go('/guia?t=acompanhamento');
await page.getByText('Meu plano de segurança').waitFor();

step('sono: ativar; uma noite por data, mesmo com vários registros no dia');
await go('/ajustes/indicadores');
await page.getByText('Sono', { exact: true }).click();
await page.waitForTimeout(200);
assert.equal((await data()).preferences.trackSleep, true);
for (let i = 1; i <= 8; i++) {
  await page.evaluate((i) => {
    const d = new Date();
    d.setDate(d.getDate() - i);
    const k = `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
    window.__pal.store.upsert('moodEntries', { at: `${k}T09:00:00`, valence: i % 2 ? -1 : 1, timePrecision: 'exact' });
    window.__pal.store.setSleep(k, { hours: i % 2 ? 5 : 8, quality: i % 2 ? 2 : 4 });
  }, i);
}
step('"Como foi a noite?" no início: qualidade com descrição de cada nível');
await go('/');
await page.getByText('Como foi a noite?').click();
await page.getByText('Quase não descansei; acordei exausto(a).').waitFor();
await page.getByRole('button', { name: 'Mais meia hora' }).click(); // 7
await page.getByRole('radio', { name: /^Ruim/ }).click();
await page.getByRole('button', { name: 'Acordei durante a noite' }).click();
await shot('care-night-sheet');
await page.locator('.sheet .sheet-actions .btn.primary').click();
await page.waitForTimeout(250);
const today = await page.evaluate(() => {
  const d = new Date();
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
});
let todays = (await data()).sleepLogs.filter((x) => x.date === today);
assert.equal(todays.length, 1);
assert.deepEqual([todays[0].hours, todays[0].quality, todays[0].troubles], [7, 2, ['awakenings']]);
await page.getByText('Noite registrada', { exact: true }).waitFor();

step('três registros de humor no mesmo dia: a mesma noite aparece e é editada, sem duplicar');
for (let k = 0; k < 3; k++) {
  await page.getByRole('button', { name: 'Agradável', exact: true }).first().click();
  await page.getByRole('button', { name: /^Sono · noite de/ }).click();
  assert.equal(await page.getByRole('spinbutton', { name: 'Horas de sono' }).inputValue(), k === 0 ? '7' : '6.5');
  if (k === 0) await page.getByRole('button', { name: 'Menos meia hora' }).click(); // 6,5
  await page.locator('.sheet .sheet-actions .btn.primary').click();
  await page.waitForTimeout(250);
}
todays = (await data()).sleepLogs.filter((x) => x.date === today);
assert.equal(todays.length, 1, 'uma noite só');
assert.equal(todays[0].hours, 6.5);
assert.equal(todays[0].quality, 2, 'a qualidade informada antes foi preservada');

step('Trajetória → Sono: noites, qualidade, dificuldades e comparações');
await go('/trajetoria/sono');
await page.getByText('noites informadas').waitFor();
await page.getByText('Qualidade e dificuldades').waitFor();
await page.getByText(/Acordei durante a noite: 1 noite/).waitFor();
await page.getByText(/menos de 6 h/).first().waitFor();
await page.getByText(/qualidade ruim ou muito ruim/).waitFor();
await shot('care-sleep');

step('medicação como acontecimento');
await go('/diario/acontecimento/novo');
await page.getByPlaceholder('Ex.: Comecei no trabalho novo').fill('Sertralina: 50 → 100 mg');
await page.getByRole('button', { name: 'Medicação' }).click();
await page.getByText(/Nunca mude a medicação por conta própria/).waitFor();
await page.waitForTimeout(600);
assert.ok((await data()).events.some((e) => e.category === 'medicacao'));

step('instabilidade entre registros consecutivos na Evolução');
await go('/trajetoria/evolucao');
await page.getByText(/De um registro para o seguinte/).waitFor();

step('resumo em PDF para a consulta');
await go('/guia?t=acompanhamento');
const [dl] = await Promise.all([page.waitForEvent('download', { timeout: 20000 }), page.getByRole('button', { name: 'Gerar resumo em PDF' }).click()]);
assert.match(dl.suggestedFilename(), /^palimpsesto-consulta-.*\.pdf$/);
const fs = await import('node:fs');
const p = await dl.path();
const buf = fs.readFileSync(p);
assert.equal(buf.subarray(0, 4).toString(), '%PDF');
assert.ok(buf.length > 3000);

assert.deepEqual(errors, [], 'sem erros de página');
console.log('\nTodos os fluxos do acompanhamento passaram.');
await browser.close();
