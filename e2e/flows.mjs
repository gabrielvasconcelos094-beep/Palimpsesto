// Testes de fluxo da interface (Chromium, viewport de celular).
// Uso: npx vite --port 5179 & node e2e/flows.mjs
import { createRequire } from 'node:module';
import assert from 'node:assert/strict';
import fs from 'node:fs';
const require = createRequire(import.meta.url);
const { chromium } = require(process.env.PW_PATH ?? 'playwright');
const BASE = process.env.BASE ?? 'http://localhost:5179/';

const browser = await chromium.launch();
const ctx = await browser.newContext({ viewport: { width: 393, height: 851 }, acceptDownloads: true, locale: 'pt-BR' });
const page = await ctx.newPage();
const errors = [];
page.on('pageerror', (e) => errors.push(String(e)));
const step = (s) => console.log('•', s);
const ready = () => page.waitForFunction(() => window.__pal?.store.getState().ready);
const data = () => page.evaluate(() => window.__pal.store.getState().data);

await page.goto(BASE);
await ready();

step('onboarding em três passos');
await page.getByRole('button', { name: 'Continuar' }).click();
await page.getByRole('button', { name: 'Continuar' }).click();
await page.getByRole('button', { name: 'Tema Lavanda' }).or(page.getByRole('button', { name: /Lavanda/ })).first().click();
await page.getByRole('button', { name: 'Começar' }).click();
await page.getByText('Como você está agora?').waitFor();

step('registro de humor em um toque + detalhes');
await page.getByRole('button', { name: 'Muito agradável' }).click();
await page.getByRole('button', { name: 'Calma' }).click();
await page.getByRole('button', { name: 'Salvar', exact: true }).click();
await page.getByText('Registrado.').waitFor();
let d = await data();
assert.equal(d.moodEntries.length, 1);
assert.equal(d.moodEntries[0].valence, 2);
assert.deepEqual(d.moodEntries[0].emotionIds, ['emo.calma']);

step('persistência após recarregar (tema e registro)');
await page.evaluate(() => window.__pal.store.flush());
await page.reload();
await ready();
d = await data();
assert.equal(d.moodEntries.length, 1);
assert.equal(d.preferences.themeId, 'lavanda');
const bg = await page.evaluate(() => getComputedStyle(document.documentElement).getPropertyValue('--bg').trim());
assert.equal(bg.toLowerCase(), '#f3f0fa');

step('nova experiência: digitação contínua sem perder o foco');
await page.getByRole('button', { name: 'Registrar uma experiência' }).click();
const title = page.getByPlaceholder('Um nome curto para lembrar');
await title.click();
await title.pressSequentially('Conversa', { delay: 30 });
await page.waitForTimeout(900); // dispara o salvamento automático e a troca /nova → /<id>
await page.keyboard.type(' importante', { delay: 30 });
await page.waitForTimeout(900);
assert.match(await page.evaluate(() => location.hash), /#\/diario\/experiencia\/[0-9a-f-]{36}/);
assert.equal(await title.inputValue(), 'Conversa importante');
d = await data();
assert.equal(d.experiences[0].title, 'Conversa importante');

step('voltar retorna à tela anterior (Hoje), não à padrão');
await page.getByRole('button', { name: 'Voltar' }).click();
await page.getByText('Como você está agora?').waitFor();
assert.equal(await page.evaluate(() => location.hash || '#/'), '#/');

step('resposta no Mapa com camadas');
await page.getByRole('button', { name: 'Mapa' }).click();
await page.getByRole('button', { name: /Valores e propósito/ }).click();
await page.getByRole('button', { name: 'O que é sucesso para você?' }).click();
await page.getByRole('textbox', { name: 'Resposta' }).fill('Tempo livre.');
await page.waitForTimeout(800);
// simula que a resposta "assentou" há 2 horas e reescreve
await page.evaluate(() => {
  const s = window.__pal.store;
  const a = s.list('answers')[0];
  s.transact((d) => ({ ...d, answers: d.answers.map((x) => (x.id === a.id ? { ...x, updatedAt: new Date(Date.now() - 7200e3).toISOString() } : x)) }));
});
await page.getByRole('textbox', { name: 'Resposta' }).fill('Tempo livre e gente querida.');
await page.waitForTimeout(800);
d = await data();
assert.equal(d.answers[0].text, 'Tempo livre e gente querida.');
assert.equal(d.answers[0].layers.length, 1);
assert.equal(d.answers[0].layers[0].text, 'Tempo livre.');

step('nomes personalizados da escala não alteram valores');
await page.goto(BASE + '#/ajustes/escala');
await page.getByLabel(/nível 5/).fill('Céu aberto');
await page.getByRole('button', { name: 'Salvar' }).click();
d = await data();
assert.equal(d.preferences.valenceLabels[4], 'Céu aberto');
assert.equal(d.moodEntries[0].valence, 2);
await page.goto(BASE + '#/diario');
await page.getByText('Céu aberto').first().waitFor();

step('exportar backup protegido e reimportar (substituir)');
await page.goto(BASE + '#/ajustes/dados');
await page.getByLabel('Senha', { exact: true }).fill('senha-de-teste');
await page.getByLabel('Repita a senha').fill('senha-de-teste');
const [download] = await Promise.all([page.waitForEvent('download'), page.getByRole('button', { name: /Exportar backup/ }).click()]);
const file = await download.path();
const text = fs.readFileSync(file, 'utf8');
assert.ok(text.includes('palimpsesto-backup-encrypted'));
assert.ok(!text.includes('Conversa importante'));
const before = await data();
// apaga um registro e restaura pelo backup
await page.evaluate(() => window.__pal.store.remove('experiences', window.__pal.store.list('experiences')[0].id));
const [chooser] = await Promise.all([page.waitForEvent('filechooser'), page.getByRole('button', { name: 'Escolher arquivo' }).click()]);
await chooser.setFiles(file);
await page.getByLabel('Senha do backup').fill('senha-de-teste');
await page.getByRole('button', { name: 'Abrir' }).click();
await page.getByText(/Arquivo válido e íntegro/).waitFor({ timeout: 20000 });
await page.getByRole('button', { name: 'Substituir' }).click();
await page.getByLabel(/digite SUBSTITUIR/).fill('substituir');
await page.getByRole('button', { name: 'Substituir dados' }).click();
await page.getByRole('alertdialog').getByRole('button', { name: 'Substituir' }).click();
await page.getByText(/Dados substituídos com sucesso/).waitFor();
const after = await data();
assert.deepEqual(after.experiences, before.experiences);
assert.deepEqual(after.answers, before.answers);
assert.equal((await page.evaluate(() => window.__pal.store.listSafetyCopies())).length, 1);

step('arquivo inválido é recusado sem alterar nada');
fs.writeFileSync('/tmp/ruim.json', '{"format":"palimpsesto-backup","formatVersion":1,"data":{"schemaVersion":1,"moodEntries":[{"id":"x"}]}}');
const [ch2] = await Promise.all([page.waitForEvent('filechooser'), page.getByRole('button', { name: 'Escolher arquivo' }).click()]);
await ch2.setFiles('/tmp/ruim.json');
await page.getByText('Seus dados atuais não foram alterados.').waitFor();
assert.deepEqual((await data()).moodEntries, after.moodEntries);

step('bloqueio por PIN');
await page.goto(BASE + '#/ajustes/privacidade');
await page.getByRole('switch', { name: /Pedir PIN/ }).click();
for (const k of '1357') await page.getByRole('button', { name: k, exact: true }).click();
await page.getByRole('button', { name: 'Continuar' }).click();
for (const k of '1357') await page.getByRole('button', { name: k, exact: true }).click();
await page.getByRole('button', { name: 'Confirmar' }).click();
await page.getByText('Bloqueio ativado.').waitFor();
await page.evaluate(() => window.__pal.store.flush());
await page.reload();
await page.getByText('Digite seu PIN').waitFor();
assert.equal(await page.getByText('Como você está agora?').count(), 0);
for (const k of '0000') await page.getByRole('button', { name: k, exact: true }).click();
await page.getByRole('button', { name: 'Confirmar' }).click();
await page.getByText('PIN incorreto.').waitFor();
for (const k of '1357') await page.getByRole('button', { name: k, exact: true }).click();
await page.getByRole('button', { name: 'Confirmar' }).click();
await page.getByRole('heading', { name: 'Privacidade e segurança' }).waitFor();

assert.deepEqual(errors, []);
console.log('\nTodos os fluxos passaram.');
await browser.close();
