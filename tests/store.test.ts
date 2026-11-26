import { describe, expect, it } from 'vitest';
import { MemoryStorage } from '../src/data/storage';
import { KEY_DATA, KEY_PREV, Store } from '../src/data/store';
import { BUILTIN_EMOTIONS } from '../src/domain/seed';
import { localIso } from '../src/domain/util';

const mk = async (storage = new MemoryStorage()) => {
  const s = new Store(storage, 0);
  await s.load();
  return { s, storage };
};

describe('Store — persistência', () => {
  it('cria dados iniciais e grava no primeiro uso', async () => {
    const { s, storage } = await mk();
    expect(s.getState().ready).toBe(true);
    expect(s.list('emotions').length).toBe(BUILTIN_EMOTIONS.length);
    expect(s.list('questions').length).toBeGreaterThan(60);
    expect(storage.map.has(KEY_DATA)).toBe(true);
  });

  it('registros de humor sobrevivem a reinício', async () => {
    const { s, storage } = await mk();
    const e = s.upsert('moodEntries', { at: localIso(), valence: 1, energy: 3, emotionIds: ['emo.calma'], indicators: { anxiety: 4 }, tags: ['tempo só'], note: 'ok' });
    await s.flush();
    const { s: s2 } = await mk(storage);
    const got = s2.get('moodEntries', e.id)!;
    expect(got.valence).toBe(1);
    expect(got.emotionIds).toEqual(['emo.calma']);
    expect(got.indicators.anxiety).toBe(4);
  });

  it('rótulos personalizados não alteram valores gravados', async () => {
    const { s, storage } = await mk();
    s.upsert('moodEntries', { at: localIso(), valence: -2, energy: null, emotionIds: [], indicators: {}, tags: [], note: '' });
    s.setPreferences({ valenceLabels: ['Tempestade', null, 'Névoa', null, 'Sol'] });
    await s.flush();
    const { s: s2 } = await mk(storage);
    expect(s2.list('moodEntries')[0].valence).toBe(-2);
    expect(s2.getState().data.preferences.valenceLabels[0]).toBe('Tempestade');
    s2.setPreferences({ valenceLabels: [null, null, null, null, null] });
    expect(s2.list('moodEntries')[0].valence).toBe(-2);
  });

  it('rejeita entidades inválidas sem alterar o estado', async () => {
    const { s } = await mk();
    const before = s.getState().data;
    expect(() => s.upsert('moodEntries', { at: localIso(), valence: 7 } as any)).toThrow();
    expect(s.getState().data).toBe(before);
  });

  it('recupera da cópia da sessão anterior se o arquivo principal estiver corrompido', async () => {
    const { s, storage } = await mk();
    s.upsert('discoveries', { title: 'Preciso de silêncio', at: '2026-01-01' } as any);
    await s.flush();
    // Nova sessão: data.json bom vira data.prev.json
    await mk(storage);
    expect(storage.map.has(KEY_PREV)).toBe(true);
    storage.map.set(KEY_DATA, '{"schemaVersion":1, quebrado');
    const { s: s3 } = await mk(storage);
    expect(s3.getState().recoveryNotice).toMatch(/restaurados/);
    expect(s3.list('discoveries')[0].title).toBe('Preciso de silêncio');
    expect([...storage.map.keys()].some((k) => k.startsWith('corrupt-'))).toBe(true);
  });

  it('falha de escrita é sinalizada e reenviada na próxima gravação', async () => {
    const { s, storage } = await mk();
    storage.failNextWrite = true;
    s.upsert('letters', { title: 'Para depois', body: 'oi' } as any);
    await s.flush();
    expect(s.getState().saveStatus).toBe('error');
    s.upsert('letters', { title: 'Outra', body: '' } as any);
    await s.flush();
    expect(s.getState().saveStatus).toBe('saved');
    expect(JSON.parse(storage.map.get(KEY_DATA)!).letters.length).toBe(2);
  });

  it('remoção em cascata limpa referências', async () => {
    const { s } = await mk();
    const item = s.upsert('repertoire', { kind: 'strategy', name: 'Caminhar' } as any);
    const exp = s.upsert('experiences', { at: localIso(), title: 'Dia longo' } as any);
    s.upsert('uses', { itemId: item.id, at: exp.at, outcome: 'worked', experienceId: exp.id } as any);
    const sit = s.upsert('situations', { title: 'Viagem', itemIds: [item.id] } as any);
    s.remove('repertoire', item.id);
    expect(s.list('uses').length).toBe(0);
    expect(s.get('situations', sit.id)!.itemIds).toEqual([]);
  });

  it('desfazer exclusão restaura a entidade e as referências da cascata', async () => {
    const { s } = await mk();
    const item = s.upsert('repertoire', { kind: 'strategy', name: 'Caminhar' } as any);
    const exp = s.upsert('experiences', { at: localIso(), title: 'Dia longo' } as any);
    s.upsert('uses', { itemId: item.id, at: exp.at, outcome: 'worked', experienceId: exp.id } as any);
    const sit = s.upsert('situations', { title: 'Viagem', itemIds: [item.id] } as any);
    const undo = s.removeUndoable('repertoire', item.id);
    expect(s.get('repertoire', item.id)).toBeUndefined();
    undo();
    expect(s.get('repertoire', item.id)!.name).toBe('Caminhar');
    expect(s.list('uses').length).toBe(1);
    expect(s.get('situations', sit.id)!.itemIds).toEqual([item.id]);
  });

  it('desfazer depois de outras alterações não apaga o que veio depois', async () => {
    const { s } = await mk();
    const a = s.upsert('moodEntries', { at: localIso(), valence: 1 } as any);
    const undo = s.removeUndoable('moodEntries', a.id);
    const b = s.upsert('moodEntries', { at: localIso(), valence: -1 } as any);
    undo();
    expect(s.get('moodEntries', a.id)!.valence).toBe(1);
    expect(s.get('moodEntries', b.id)!.valence).toBe(-1);
    expect(s.list('moodEntries').length).toBe(2);
  });

  it('remover uma ficha remove perguntas, respostas e notas dela', async () => {
    const { s } = await mk();
    const q = s.list('questions').find((q) => q.sectionId === 'sec.valores')!;
    s.upsert('answers', { questionId: q.id, text: 'Honestidade' } as any);
    s.upsert('notes', { sectionId: 'sec.valores', text: 'nota' } as any);
    s.remove('sections', 'sec.valores');
    expect(s.list('questions').some((x) => x.sectionId === 'sec.valores')).toBe(false);
    expect(s.list('answers').length).toBe(0);
    expect(s.list('notes').length).toBe(0);
  });

  it('cria cópia de segurança antes de substituir tudo', async () => {
    const { s } = await mk();
    s.upsert('letters', { title: 'Antiga', body: '' } as any);
    const replacement = { ...s.getState().data, letters: [] };
    await s.replaceAll(replacement, 'teste');
    expect(s.list('letters').length).toBe(0);
    const copies = await s.listSafetyCopies();
    expect(copies.length).toBe(1);
    await s.restoreSafetyCopy(copies[0].key);
    expect(s.list('letters')[0].title).toBe('Antiga');
  });

  it('apagar tudo remove dados e configurações', async () => {
    const { s, storage } = await mk();
    s.upsert('letters', { title: 'x', body: 'y' } as any);
    s.setDevice({ onboardingDone: true });
    await s.flush();
    await s.eraseEverything();
    expect(s.list('letters').length).toBe(0);
    expect(s.getState().device.onboardingDone).toBe(false);
    expect([...storage.map.keys()].sort()).toEqual(['data.json', 'device.json']);
  });
});
