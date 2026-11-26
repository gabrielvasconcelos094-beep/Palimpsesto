// Testes de interface da 1.9: visões do calendário, pauta (riscada, dias, excluir),
// excluir consulta, período entre sessões, fatores do sono, registro de pensamentos,
// minhas emoções e categoria Pensamentos.
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PW_PATH ?? 'playwright');
const BASE = process.env.BASE ?? 'http://localhost:5179/';
const SHOTS = process.env.SHOTS;

const browser = await chromium.launch();
const page = await (await browser.newContext({ viewport: { width: 393, height: 851 }, locale: 'pt-BR' })).newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
const step = (s) => console.log('•', s);
const data = () => page.evaluate(() => window.__pal.store.getState().data);
const go = async (r) => {
  await page.goto(BASE + '#' + r);
  await page.waitForTimeout(350);
};
const shot = async (n) => SHOTS && page.screenshot({ path: `${SHOTS}/${n}.png`, fullPage: true });
const day = (n) =>
  page.evaluate((n) => {
    const d = new Date();
    d.setDate(d.getDate() + n);
    return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
  }, n);

await page.goto(BASE);
await page.waitForFunction(() => window.__pal?.store.getState().ready);
await page.evaluate(async () => {
  window.__pal.store.setDevice({ onboardingDone: true });
  await window.__pal.seed();
  await window.__pal.store.flush();
});

step('calendário: sem barra de período/filtros; cinco visões');
await go('/trajetoria/calendario');
assert.equal(await page.getByRole('button', { name: '30 dias' }).count(), 0, 'sem período');
assert.equal(await page.getByRole('button', { name: /Filtrar registros/ }).count(), 0, 'sem filtros');
await page.getByRole('button', { name: 'Ano dia a dia' }).click();
await page.locator('.pixels').waitFor();
assert.ok((await page.locator('.px:not(.empty):not(.none)').count()) > 10, 'dias com registro coloridos');
await shot('cal-year');
await page.getByRole('button', { name: 'Semanas', exact: true }).click();
await page.getByText('Semana a semana').waitFor();
assert.ok((await page.locator('.week-row').count()) > 3);
await page.getByRole('button', { name: 'Estações' }).click();
await page.getByText('Estação a estação').waitFor();
await page.getByText(/pelo menos dois anos seguidos/).waitFor();
await page.getByRole('button', { name: 'Hemisfério Norte' }).click();
await page.waitForTimeout(200);
assert.equal((await data()).preferences.hemisphere, 'north');
await page.getByRole('button', { name: 'Hemisfério Sul' }).click();
await shot('cal-seasons');
await page.getByRole('button', { name: 'Anos', exact: true }).click();
await page.getByText('Ano a ano').waitFor();

step('pauta: marcado fica riscado com "o que ficou acertado"; dias vinculados; excluir');
await page.evaluate(() => window.__pal.store.upsert('agenda', { text: 'Briga no trabalho', forWhom: 'psicologia' }));
await go('/guia?t=acompanhamento');
await page.getByRole('button', { name: 'Vincular um dia: Briga no trabalho' }).click();
const d3 = await day(-3);
await page.locator('[aria-label="Dia relacionado"]').fill(d3);
await page.waitForTimeout(250);
assert.deepEqual((await data()).agenda.find((x) => x.text === 'Briga no trabalho').dates, [d3]);
await page.getByRole('button', { name: 'Marcar como conversado: Briga no trabalho' }).click();
await page.getByPlaceholder('O que ficou acertado sobre esse assunto…').fill('Tentar conversar com calma');
await page.waitForTimeout(250);
let item = (await data()).agenda.find((x) => x.text === 'Briga no trabalho');
assert.ok(item.doneAt);
assert.equal(item.outcome, 'Tentar conversar com calma');
assert.ok(await page.getByText('Briga no trabalho').isVisible(), 'continua visível, riscado');
await page.getByRole('button', { name: /Ver os registros de/ }).first().click();
await page.waitForTimeout(300);
assert.match(page.url(), new RegExp(`de=${d3}&ate=${d3}`));

step('consulta: pauta da consulta riscada após conversar; período editável; excluir pelo topo');
await page.evaluate(() => window.__pal.store.upsert('agenda', { text: 'Sono ruim', forWhom: 'psiquiatria' }));
const prevDate = await day(-15);
await page.evaluate((d) => window.__pal.store.upsert('appointments', { date: d, forWhom: 'psiquiatria', status: 'done', agreements: 'Caminhar 3x na semana' }), prevDate);
const apDate = await day(2);
const apId = await page.evaluate((d) => window.__pal.store.upsert('appointments', { date: d, time: '10:00', forWhom: 'psiquiatria' }).id, apDate);
await go(`/guia/consulta/${apId}`);
await page.getByText('Combinados: Caminhar 3x na semana').waitFor();
assert.equal(await page.locator('[aria-label="Início do período"]').inputValue(), prevDate, 'padrão = desde a última consulta');
await page.locator('[aria-label="Início do período"]').fill(await day(-40));
await page.getByText('No período escolhido').waitFor();
await page.getByRole('button', { name: 'Ver este período na Trajetória' }).click();
await page.waitForTimeout(300);
assert.match(page.url(), /#\/trajetoria$/);
await page.getByRole('button', { name: 'Personalizado' }).and(page.locator('[aria-pressed="true"]')).waitFor();
await go(`/guia/consulta/${apId}`);
await page.getByRole('button', { name: 'Marcar como conversado: Sono ruim' }).click();
await page.waitForTimeout(250);
assert.ok(await page.getByText('Sono ruim').isVisible(), 'continua na consulta, riscado');
assert.equal((await data()).agenda.find((x) => x.text === 'Sono ruim').appointmentId, apId);
await page.getByRole('button', { name: 'Excluir consulta' }).click();
await page.locator('.dialog').getByRole('button', { name: 'Excluir' }).click();
await page.waitForTimeout(300);
assert.equal((await data()).appointments.some((a) => a.id === apId), false);
assert.ok((await data()).agenda.some((x) => x.text === 'Sono ruim'), 'assuntos continuam');

step('Trajetória: atalho "Desde a última consulta"');
await go('/trajetoria');
await page.getByRole('button', { name: 'Desde a última consulta' }).click();
await page.getByText(new RegExp(`^${Number(prevDate.slice(8))} de `)).first().waitFor();

step('sono: o que pode ter atrapalhado; aparece na Trajetória');
await page.evaluate(() => window.__pal.store.setPreferences({ trackSleep: true }));
await go('/');
await page.getByText(/Como foi a noite\?|Noite registrada/).first().click();
await page.getByRole('button', { name: 'Telas até tarde' }).click();
await page.getByRole('button', { name: 'Tive pesadelos' }).click();
await page.locator('.sheet .sheet-actions .btn.primary').click();
await page.waitForTimeout(250);
const today = await day(0);
const night = (await data()).sleepLogs.find((s) => s.date === today);
assert.ok(night.factors.includes('screens'));
assert.ok(night.troubles.includes('nightmares'));
await go('/trajetoria/sono');
await page.getByText('O que pode ter atrapalhado').waitFor();
await page.getByText(/Telas até tarde/).first().waitFor();

step('experiência com registro de pensamentos (RPD adaptado)');
await go('/diario/experiencia/nova');
await page.getByPlaceholder('Um nome curto para lembrar').fill('Reunião');
await page.getByRole('button', { name: 'Ansiedade' }).first().click();
await page.getByRole('slider', { name: 'Intensidade da emoção mais forte' }).fill('80');
await page.getByPlaceholder('Pensei que…').fill('Vão achar que sou incompetente');
await page.getByRole('slider', { name: 'Quanto você acreditou nesse pensamento?' }).fill('90');
await page.getByRole('button', { name: /Reconhece alguma armadilha/ }).click();
await page.getByRole('button', { name: /Leitura mental/ }).click();
await page.getByRole('button', { name: /Examinar o pensamento/ }).click();
await page.getByText('O que não combina com ele?').waitFor();
const fields = page.locator('textarea');
await page.getByText('Um pensamento mais equilibrado').locator('..').locator('textarea').fill('Errei um dado, não o trabalho todo');
await page.getByRole('slider', { name: 'Agora, quanto acredita no pensamento original?' }).fill('40');
await page.waitForTimeout(1200);
await shot('rpd');
const x = (await data()).experiences.find((e) => e.title === 'Reunião');
assert.equal(x.thoughts, 'Vão achar que sou incompetente');
assert.deepEqual([x.intensityBefore, x.beliefBefore, x.beliefAfter], [80, 90, 40]);
assert.deepEqual(x.distortions, ['leitura_mental']);
assert.equal(x.alternativeThought, 'Errei um dado, não o trabalho todo');
void fields;

step('Trajetória → Pensamentos');
await go('/trajetoria/pensamentos');
await page.getByText('Leitura mental').first().waitFor();
await page.getByText('Errei um dado, não o trabalho todo').waitFor();
await page.getByText(/queda na crença/).waitFor();

step('Minhas emoções: perfil e guia pessoal');
await go('/guia');
await page.getByText('Minhas emoções').click();
await page.waitForTimeout(250);
await page.getByRole('button', { name: /^Ansiedade/ }).click();
await page.getByRole('heading', { name: 'Quando ela aparece' }).waitFor();
await page.getByRole('heading', { name: 'O que costuma passar pela cabeça' }).waitFor();
await page.getByText('“Vão achar que sou incompetente”').waitFor();
await page.getByPlaceholder('Ex.: nomear o que sinto; caminhar; falar com a Lia').fill('Respirar devagar e escrever o pensamento');
await page.waitForTimeout(300);
assert.equal((await data()).emotions.find((e) => e.id === 'emo.ansiedade').helps, 'Respirar devagar e escrever o pensamento');
await shot('emotion');

assert.deepEqual(errors, [], 'sem erros de página');
console.log('\nTodos os fluxos da 1.9 passaram.');
await browser.close();
