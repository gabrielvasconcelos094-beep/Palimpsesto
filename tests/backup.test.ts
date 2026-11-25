import { describe, expect, it } from 'vitest';
import { exportBackupText, inspectBackup, buildBackup } from '../src/data/backup';
import { mergeData } from '../src/data/merge';
import { migrate, NewerSchemaError } from '../src/data/migrations';
import { moodCsv, experiencesCsv, csvCell } from '../src/data/csv';
import { MemoryStorage } from '../src/data/storage';
import { Store } from '../src/data/store';
import type { AppData } from '../src/domain/schema';

async function sampleData(): Promise<AppData> {
  const s = new Store(new MemoryStorage(), 0);
  await s.load();
  const strategy = s.upsert('repertoire', { kind: 'strategy', name: 'Ver um filme', tags: ['dia difícil'] } as any);
  const exp = s.upsert('experiences', { at: '2026-03-02T20:00:00.000Z', title: 'Dia difícil no trabalho', learned: 'Filmes ajudam', tags: ['trabalho'], emotionIds: ['emo.ansiedade'] } as any);
  s.upsert('uses', { itemId: strategy.id, at: exp.at, outcome: 'worked', experienceId: exp.id, tags: ['dia difícil'] } as any);
  s.upsert('moodEntries', { at: '2026-03-01T10:00:00.000Z', valence: -1, energy: 2, emotionIds: ['emo.ansiedade', 'emo.cansaco'], indicators: { sleep: 2 }, tags: ['dormi mal'], note: 'Linha 1\n"aspas"; ponto e vírgula' } as any);
  s.upsert('moodEntries', { at: '2026-03-02T10:00:00.000Z', valence: 2, energy: 4, emotionIds: [], indicators: {}, tags: [], note: '' } as any);
  const custom = s.upsert('emotions', { label: 'Melancolia doce' } as any);
  s.upsert('moodEntries', { at: '2026-03-03T10:00:00.000Z', valence: 0, energy: null, emotionIds: [custom.id], indicators: {}, tags: [], note: '' } as any);
  const q = s.list('questions')[0];
  s.upsert('answers', { questionId: q.id, text: 'Hoje', layers: [{ text: 'Ontem', at: '2026-01-01T00:00:00.000Z' }] } as any);
  s.upsert('discoveries', { title: 'Preciso de tempo só depois de eventos', at: '2026-03-04', confidence: 'recurring', revisions: [{ at: '2026-02-01T00:00:00.000Z', title: 'Talvez', description: '', confidence: 'hypothesis' }] } as any);
  const sit = s.upsert('situations', { title: 'Viagem', date: '2026-12-20', tags: ['viagem'], itemIds: [strategy.id], checklist: [{ id: 'c1', text: 'Reservar uma tarde livre' }] } as any);
  s.upsert('letters', { title: 'Para a viagem', body: 'Respire.', situationId: sit.id, openAt: '2026-12-20', sealed: true } as any);
  s.setPreferences({ valenceLabels: ['Tempestade', null, null, null, 'Sol'], themeId: 'lavanda' });
  s.setPreferences({
    customThemes: [
      { id: 't1', name: 'Meu tema', createdAt: '2026-01-01T00:00:00.000Z', updatedAt: '2026-01-01T00:00:00.000Z', colors: { primary: '#112233', accent: '#aa5500', background: '#ffffff', surface: '#f8f8f8', complement1: '#335577', complement2: '#ccbbaa' }, radius: 8, cardStyle: 'outline', displayFont: 'lora' },
    ],
  });
  return s.getState().data;
}

describe('backup completo', () => {
  it('exporta e reimporta preservando tudo', async () => {
    const data = await sampleData();
    const text = await exportBackupText(data);
    const res = await inspectBackup(text);
    expect(res.kind).toBe('ok');
    if (res.kind !== 'ok') return;
    expect(res.data).toEqual(data);
    expect(res.counts.moodEntries).toBe(3);
    expect(res.data.preferences.valenceLabels[0]).toBe('Tempestade');
    expect(res.data.preferences.customThemes[0].name).toBe('Meu tema');
    expect(res.data.answers[0].layers[0].text).toBe('Ontem');
    expect(res.data.discoveries[0].revisions.length).toBe(1);
    expect(res.range.from).toBe('2026-03-01T10:00:00.000Z');
  });

  it('backup protegido por senha: exige a senha correta', async () => {
    const data = await sampleData();
    const text = await exportBackupText(data, 'segredo forte');
    expect(text).not.toContain('Dia difícil');
    expect((await inspectBackup(text)).kind).toBe('needs-password');
    const wrong = await inspectBackup(text, 'errada');
    expect(wrong.kind).toBe('error');
    const ok = await inspectBackup(text, 'segredo forte');
    expect(ok.kind).toBe('ok');
    if (ok.kind === 'ok') {
      expect(ok.data).toEqual(data);
      expect(ok.meta.encrypted).toBe(true);
    }
  }, 30000);

  it('detecta adulteração ou corrupção', async () => {
    const data = await sampleData();
    const obj = JSON.parse(await exportBackupText(data));
    obj.data.moodEntries[0].valence = 2;
    const res = await inspectBackup(JSON.stringify(obj));
    expect(res.kind).toBe('error');
    if (res.kind === 'error') expect(res.error).toMatch(/integridade/);
  });

  it('rejeita JSON inválido, truncado e arquivos alheios', async () => {
    const data = await sampleData();
    const text = await exportBackupText(data);
    expect((await inspectBackup(text.slice(0, text.length / 2))).kind).toBe('error');
    expect((await inspectBackup('{"foo":1}')).kind).toBe('error');
    expect((await inspectBackup('não é json')).kind).toBe('error');
  });

  it('rejeita backup de versão mais nova com mensagem clara', async () => {
    const data = await sampleData();
    const file: any = await buildBackup(data);
    file.data.schemaVersion = 99;
    delete file.checksum;
    const res = await inspectBackup(JSON.stringify(file));
    expect(res.kind).toBe('error');
    if (res.kind === 'error') expect(res.error).toMatch(/mais nova/);
  });

  it('valida o esquema e informa detalhes', async () => {
    const data = await sampleData();
    const file: any = await buildBackup(data);
    file.data.moodEntries[0].valence = 9;
    delete file.checksum;
    const res = await inspectBackup(JSON.stringify(file));
    expect(res.kind).toBe('error');
    if (res.kind === 'error') expect(res.details?.join(' ')).toMatch(/moodEntries/);
  });

  it('preserva campos desconhecidos (compatibilidade futura)', async () => {
    const data = await sampleData();
    const file: any = await buildBackup(data);
    file.data.moodEntries[0].campoFuturo = 'x';
    delete file.checksum;
    const res = await inspectBackup(JSON.stringify(file));
    expect(res.kind).toBe('ok');
    if (res.kind === 'ok') expect((res.data.moodEntries[0] as any).campoFuturo).toBe('x');
  });

  it('repara referências quebradas ao importar', async () => {
    const data = await sampleData();
    const file: any = await buildBackup(data);
    file.data.uses.push({ ...file.data.uses[0], id: 'orfao', itemId: 'nao-existe' });
    file.data.moodEntries[0].emotionIds.push('emo.inexistente');
    delete file.checksum;
    const res = await inspectBackup(JSON.stringify(file));
    expect(res.kind).toBe('ok');
    if (res.kind === 'ok') {
      expect(res.data.uses.find((u) => u.id === 'orfao')).toBeUndefined();
      expect(res.data.moodEntries[0].emotionIds).not.toContain('emo.inexistente');
      expect(res.integrity.danglingRefs).toBeGreaterThan(0);
    }
  });
});

describe('migrações', () => {
  it('aplica a cadeia de migrações em ordem', () => {
    const migrations = { 1: (d: any) => ({ ...d, schemaVersion: 2, a: 1 }), 2: (d: any) => ({ ...d, schemaVersion: 3, b: d.a + 1 }) };
    const { data, from } = migrate({ schemaVersion: 1 }, 3, migrations);
    expect(from).toBe(1);
    expect(data).toEqual({ schemaVersion: 3, a: 1, b: 2 });
  });
  it('recusa versões mais novas', () => {
    expect(() => migrate({ schemaVersion: 5 }, 1)).toThrow(NewerSchemaError);
  });
  it('recusa dados sem versão', () => {
    expect(() => migrate({}, 1)).toThrow();
  });
});

describe('mesclagem', () => {
  it('acrescenta novos e trata duplicados conforme a estratégia', async () => {
    const base = await sampleData();
    const current: AppData = JSON.parse(JSON.stringify(base));
    const incoming: AppData = JSON.parse(JSON.stringify(base));
    incoming.moodEntries[0] = { ...incoming.moodEntries[0], note: 'versão importada', updatedAt: '2099-01-01T00:00:00.000Z' };
    current.moodEntries[1] = { ...current.moodEntries[1], note: 'versão local', updatedAt: '2099-01-01T00:00:00.000Z' };
    incoming.moodEntries[1] = { ...incoming.moodEntries[1], note: 'antiga importada', updatedAt: '2000-01-01T00:00:00.000Z' };
    incoming.letters.push({ ...incoming.letters[0], id: 'nova-carta', title: 'Nova' });

    const newest = mergeData(current, incoming, 'newest');
    expect(newest.data.moodEntries.find((m) => m.id === base.moodEntries[0].id)!.note).toBe('versão importada');
    expect(newest.data.moodEntries.find((m) => m.id === base.moodEntries[1].id)!.note).toBe('versão local');
    expect(newest.data.letters.length).toBe(2);
    expect(newest.report.perCollection.letters.added).toBe(1);

    const keep = mergeData(current, incoming, 'keepCurrent');
    expect(keep.data.moodEntries.find((m) => m.id === base.moodEntries[0].id)!.note).not.toBe('versão importada');

    const prefer = mergeData(current, incoming, 'preferImported');
    expect(prefer.data.moodEntries.find((m) => m.id === base.moodEntries[1].id)!.note).toBe('antiga importada');
  });

  it('importar o mesmo backup duas vezes não duplica nada', async () => {
    const base = await sampleData();
    const once = mergeData(base, base, 'newest');
    expect(once.data.moodEntries.length).toBe(base.moodEntries.length);
    expect(once.report.totalAdded).toBe(0);
  });
});

describe('CSV', () => {
  it('exporta humor com rótulos atuais e valores fixos', async () => {
    const data = await sampleData();
    const csv = moodCsv(data);
    expect(csv.startsWith('﻿')).toBe(true);
    const lines = csv.trim().split('\r\n');
    expect(lines[0]).toContain('valencia_valor');
    expect(lines.length).toBeGreaterThanOrEqual(4);
    expect(csv).toContain(';Sol;');
    expect(csv).toContain('Melancolia doce');
    expect(csv).toContain('"Linha 1\n""aspas""; ponto e vírgula"');
  });
  it('exporta experiências com estratégias associadas', async () => {
    const data = await sampleData();
    const csv = experiencesCsv(data);
    expect(csv).toContain('Ver um filme (Funcionou)');
  });
  it('neutraliza fórmulas de planilha', () => {
    expect(csvCell('=SOMA(A1)')).toBe("'=SOMA(A1)");
    expect(csvCell('-2')).toBe('-2');
  });
});
