import { describe, expect, it } from 'vitest';
import { MemoryStorage } from '../src/data/storage';
import { KEY_DATA, Store } from '../src/data/store';
import { inspectBackup } from '../src/data/backup';
import { canonicalJson, sha256Hex } from '../src/data/crypto';
import { SCHEMA_VERSION } from '../src/domain/schema';
import { localIso } from '../src/domain/util';

/** Um documento no formato da versão 1.0.0 (esquema 1), com horários em UTC. */
function v1Doc() {
  const t = '2026-03-01T10:00:00.000Z';
  return {
    schemaVersion: 1,
    moodEntries: [
      { id: 'm1', createdAt: t, updatedAt: t, at: '2026-02-19T23:30:00.000Z', valence: 1, energy: 3, emotionIds: ['emo.calma'], indicators: {}, tags: ['tempo só'], note: 'antigo' },
    ],
    emotions: [{ id: 'emo.calma', label: 'Calma', builtIn: true, hidden: false, createdAt: t, updatedAt: t }],
    experiences: [{ id: 'x1', createdAt: t, updatedAt: t, at: '2026-02-10T12:00:00.000Z', title: 'Viagem', whatHappened: '', feelingBefore: null, emotionIds: [], whatIDid: '', whatHelped: '', whatWorsened: '', feelingAfter: null, howIFeltAfter: '', learned: '', tags: [], situationId: null }],
    repertoire: [{ id: 'r1', createdAt: t, updatedAt: t, kind: 'strategy', name: 'Filme' }],
    uses: [{ id: 'u1', createdAt: t, updatedAt: t, itemId: 'r1', at: '2026-02-10T20:00:00.000Z', outcome: 'worked', tags: [], note: '', experienceId: 'x1' }],
    sections: [],
    questions: [],
    answers: [],
    notes: [],
    discoveries: [{ id: 'd1', createdAt: t, updatedAt: t, title: 'X', at: '2026-02-01', experienceIds: ['x1'] }],
    situations: [],
    letters: [],
    preferences: { valenceLabels: ['Tempestade', null, null, null, 'Sol'], themeId: 'lavanda' },
  };
}

describe('migração 1 → 2', () => {
  it('converte "at" para hora local sem mudar o momento e preenche campos novos', async () => {
    const doc = v1Doc();
    const file = { format: 'palimpsesto-backup', formatVersion: 1, schemaVersion: 1, appVersion: '1.0.0', exportedAt: '2026-03-01T10:00:00.000Z', checksum: { algorithm: 'SHA-256', value: await sha256Hex(canonicalJson(doc)) }, data: doc };
    const res = await inspectBackup(JSON.stringify(file));
    expect(res.kind).toBe('ok');
    if (res.kind !== 'ok') return;
    expect(res.migratedFrom).toBe(1);
    expect(res.data.schemaVersion).toBe(SCHEMA_VERSION);
    const m = res.data.moodEntries[0];
    expect(m.at).toBe(localIso(new Date('2026-02-19T23:30:00.000Z')));
    expect(new Date(m.at).getTime()).toBe(new Date('2026-02-19T23:30:00.000Z').getTime());
    expect(m.timePrecision).toBe('exact');
    expect(m.itemIds).toEqual([]);
    expect(m.createdAt).toBe('2026-03-01T10:00:00.000Z');
    expect(res.data.uses[0].at).toBe(localIso(new Date('2026-02-10T20:00:00.000Z')));
    expect(res.data.discoveries[0].moodEntryIds).toEqual([]);
    expect(res.data.events).toEqual([]);
    expect(res.data.preferences.valenceLabels[0]).toBe('Tempestade');
    expect(res.data.preferences.visualStyle).toBe('minimal');
    expect(res.data.preferences.symbolSet).toBe('nature');
  });

  it('ao abrir dados antigos, guarda o original intacto e uma cópia de segurança', async () => {
    const storage = new MemoryStorage();
    const original = JSON.stringify(v1Doc());
    storage.map.set(KEY_DATA, original);
    const s = new Store(storage, 0);
    await s.load();
    expect(s.getState().recoveryNotice).toBeNull();
    expect(storage.map.get('pre-migration-v1.json')).toBe(original);
    const copies = await s.listSafetyCopies();
    expect(copies[0].reason).toMatch(/v1 → v2/);
    expect(JSON.parse(storage.map.get(KEY_DATA)!).schemaVersion).toBe(2);
    expect(s.list('moodEntries')[0].note).toBe('antigo');
    // A cópia de segurança pode ser restaurada (passa de novo pela migração).
    s.remove('moodEntries', 'm1');
    await s.restoreSafetyCopy(copies[0].key);
    expect(s.list('moodEntries')[0].id).toBe('m1');
  });

  it('a migração é idempotente ao reabrir', async () => {
    const storage = new MemoryStorage();
    storage.map.set(KEY_DATA, JSON.stringify(v1Doc()));
    await new Store(storage, 0).load();
    const after1 = storage.map.get(KEY_DATA);
    const s2 = new Store(storage, 0);
    await s2.load();
    expect(JSON.parse(storage.map.get(KEY_DATA)!)).toEqual(JSON.parse(after1!));
    expect((await s2.listSafetyCopies()).length).toBe(1);
  });
});

describe('tempo: aconteceu × escrito', () => {
  it('registro retroativo mantém o dia em que aconteceu e o dia em que foi escrito', async () => {
    const s = new Store(new MemoryStorage(), 0);
    await s.load();
    const e = s.upsert('moodEntries', { at: '2026-11-19T21:30:00', timePrecision: 'exact', valence: -1 });
    expect(e.at.slice(0, 10)).toBe('2026-11-19');
    expect(e.createdAt.slice(0, 10)).not.toBe('2026-11-19');
    const edited = s.patch('moodEntries', e.id, { at: '2026-11-18T08:00:00', timePrecision: 'period' })!;
    expect(edited.createdAt).toBe(e.createdAt);
    expect(edited.at).toBe('2026-11-18T08:00:00');
  });

  it('rejeita horários com fuso em "at" (evita deslocar o dia)', async () => {
    const s = new Store(new MemoryStorage(), 0);
    await s.load();
    expect(() => s.upsert('moodEntries', { at: '2026-11-19T21:30:00.000Z', valence: 0 })).toThrow();
  });

  it('vários registros na mesma data', async () => {
    const s = new Store(new MemoryStorage(), 0);
    await s.load();
    for (const h of ['08', '13', '22']) s.upsert('moodEntries', { at: `2026-10-02T${h}:00:00`, valence: 0 });
    expect(s.list('moodEntries').filter((m) => m.at.startsWith('2026-10-02')).length).toBe(3);
  });
});
