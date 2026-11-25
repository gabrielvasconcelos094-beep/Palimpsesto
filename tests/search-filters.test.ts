import { describe, expect, it } from 'vitest';
import { MemoryStorage } from '../src/data/storage';
import { Store } from '../src/data/store';
import { searchAll } from '../src/domain/search';
import { contextFor, matchEvent, matchExperience, matchMood, NO_FILTERS, periodDays } from '../src/domain/filters';

async function setup() {
  const s = new Store(new MemoryStorage(), 0);
  await s.load();
  const ler = s.upsert('repertoire', { kind: 'activity', name: 'Ler' });
  s.upsert('moodEntries', { at: '2026-11-19T21:00:00', valence: -1, emotionIds: ['emo.ansiedade', 'emo.irritacao'], energy: 2, note: 'Reunião tensa', createdAt: '2026-11-25T10:00:00.000Z' });
  s.upsert('moodEntries', { at: '2026-11-20T09:00:00', valence: 1, emotionIds: ['emo.calma'], itemIds: [ler.id], energy: 4, note: 'Café e livro', createdAt: '2026-11-20T12:00:00.000Z' });
  s.upsert('moodEntries', { at: '2026-11-21T09:00:00', valence: -2, emotionIds: ['emo.ansiedade'], energy: 1, createdAt: '2026-11-21T12:00:00.000Z' });
  s.upsert('experiences', { at: '2026-11-19T20:00:00', title: 'Conversa difícil', whatHappened: 'Discussão sobre prazos', tags: ['trabalho'] });
  s.upsert('events', { title: 'Viagem a Lisboa', date: '2026-10-01', endDate: '2026-10-10', category: 'viagem', description: 'Primeira viagem sozinha' });
  const q = s.list('questions')[0];
  s.upsert('answers', { questionId: q.id, text: 'Alguém que gosta de livros antigos' });
  s.upsert('letters', { title: 'Segredo', body: 'texto escondido sobre livros', openAt: '2099-01-01', sealed: true });
  return { s, ler };
}

describe('filtros combinados', () => {
  it('desagradável E com irritação', async () => {
    const { s } = await setup();
    const d = s.getState().data;
    const f = { ...NO_FILTERS, valences: [-1, -2], emotions: ['emo.irritacao'] };
    expect(d.moodEntries.filter((m) => matchMood(m, f, contextFor(d))).map((m) => m.note)).toEqual(['Reunião tensa']);
  });
  it('todas as emoções juntas × qualquer uma', async () => {
    const { s } = await setup();
    const d = s.getState().data;
    const any = { ...NO_FILTERS, emotions: ['emo.ansiedade', 'emo.irritacao'] };
    const all = { ...any, emotionMode: 'all' as const };
    expect(d.moodEntries.filter((m) => matchMood(m, any, contextFor(d))).length).toBe(2);
    expect(d.moodEntries.filter((m) => matchMood(m, all, contextFor(d))).length).toBe(1);
  });
  it('baixa energia, atividade e só retroativos', async () => {
    const { s, ler } = await setup();
    const d = s.getState().data;
    expect(d.moodEntries.filter((m) => matchMood(m, { ...NO_FILTERS, energies: [1, 2] }, contextFor(d))).length).toBe(2);
    expect(d.moodEntries.filter((m) => matchMood(m, { ...NO_FILTERS, itemIds: [ler.id] }, contextFor(d)))[0].note).toBe('Café e livro');
    const retro = d.moodEntries.filter((m) => matchMood(m, { ...NO_FILTERS, retroOnly: true }, contextFor(d)));
    expect(retro.map((m) => m.note)).toEqual(['Reunião tensa']);
  });
  it('período usa a data em que aconteceu e inclui acontecimentos que tocam o intervalo', async () => {
    const { s } = await setup();
    const d = s.getState().data;
    const f = { ...NO_FILTERS, period: 'custom' as const, from: '2026-10-05', to: '2026-11-19' };
    const r = periodDays(f);
    expect(d.moodEntries.filter((m) => matchMood(m, f, contextFor(d), r)).length).toBe(1);
    expect(d.experiences.filter((x) => matchExperience(x, f, contextFor(d), d, r)).length).toBe(1);
    expect(d.events.filter((e) => matchEvent(e, f, r)).length).toBe(1);
  });
});

describe('busca geral', () => {
  it('encontra em vários módulos, sem acento, e respeita cartas lacradas', async () => {
    const { s } = await setup();
    const d = s.getState().data;
    const hits = searchAll(d, 'livro');
    const kinds = hits.map((h) => h.kind).sort();
    expect(kinds).toContain('mood');
    expect(kinds).toContain('answer');
    expect(kinds).not.toContain('letter');
    expect(searchAll(d, 'reuniao').some((h) => h.kind === 'mood')).toBe(true);
    expect(searchAll(d, 'LISBOA')[0].kind).toBe('event');
    expect(searchAll(d, 'ansiedade').some((h) => h.kind === 'emotion')).toBe(true);
    expect(searchAll(d, 'ler').some((h) => h.kind === 'item')).toBe(true);
  });
  it('combina texto e período', async () => {
    const { s } = await setup();
    const d = s.getState().data;
    expect(searchAll(d, 'viagem', { from: '2026-11-01', to: '2026-11-30' }).length).toBe(0);
    expect(searchAll(d, 'viagem', { from: '2026-10-01', to: '2026-10-31' }).length).toBe(1);
  });
});
