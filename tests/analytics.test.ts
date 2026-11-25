import { describe, expect, it } from 'vitest';
import { cliffsDelta, findPatterns, valenceCounts, buckets, periodPreset, previousPeriod, medianCategory, outcomesByContext, pickResurface } from '../src/domain/analytics';
import { gatherForSituation, stems } from '../src/domain/situations';
import { initialData } from '../src/data/defaults';
import type { MoodEntry } from '../src/domain/schema';
import { localIso } from '../src/domain/util';

const entry = (i: number, valence: number, tags: string[], extra: Partial<MoodEntry> = {}): MoodEntry => ({
  id: `m${i}`,
  createdAt: '2026-01-01T00:00:00.000Z',
  updatedAt: '2026-01-01T00:00:00.000Z',
  at: localIso(new Date(2026, 0, 1 + i, 12)),
  timePrecision: 'exact',
  itemIds: [],
  valence,
  energy: 3,
  emotionIds: [],
  indicators: {},
  tags,
  note: '',
  ...extra,
});

describe('estatística ordinal', () => {
  it('delta de Cliff', () => {
    expect(cliffsDelta([2, 2, 2], [0, 0, 0])).toBe(1);
    expect(cliffsDelta([0, 0], [2, 2])).toBe(-1);
    expect(cliffsDelta([1, 1], [1, 1])).toBe(0);
  });
  it('contagens e mediana categórica', () => {
    const c = valenceCounts([entry(1, -2, []), entry(2, 1, []), entry(3, 1, [])]);
    expect(c).toEqual([1, 0, 0, 2, 0]);
    expect(medianCategory(c)).toBe(3);
  });
  it('períodos e período anterior', () => {
    const p = periodPreset('7d', new Date(2026, 5, 10, 15));
    expect(p.from.getDate()).toBe(4);
    const prev = previousPeriod(p);
    expect(prev.to.getDate()).toBe(3);
    expect(prev.from.getDate()).toBe(28);
  });
  it('baldes semanais cobrem o período inclusive sem registros', () => {
    const p = periodPreset('30d', new Date(2026, 0, 31, 12));
    const b = buckets([entry(5, 1, [])], p, (e) => e.valence + 2);
    expect(b.unit).toBe('week');
    expect(b.items.length).toBeGreaterThanOrEqual(5);
    expect(b.items.reduce((a, x) => a + x.total, 0)).toBe(1);
  });
});

describe('padrões', () => {
  it('não gera conclusões com poucos dados', () => {
    const r = findPatterns([entry(1, 2, ['tempo só'])]);
    expect(r.enough).toBe(false);
    expect(r.patterns).toEqual([]);
  });
  it('identifica associação clara e ignora ruído', () => {
    const list: MoodEntry[] = [];
    for (let i = 0; i < 12; i++) list.push(entry(i, i % 3 === 0 ? 1 : 2, ['tempo só']));
    for (let i = 12; i < 30; i++) list.push(entry(i, i % 2 ? -1 : 0, i % 2 ? ['trabalho'] : ['casa']));
    const r = findPatterns(list);
    expect(r.enough).toBe(true);
    const solo = r.patterns.find((p) => p.metric === 'valence' && p.tag === 'tempo só');
    expect(solo?.direction).toBe('higher');
    expect(solo?.withN).toBe(12);
  });
  it('associa marcadores a emoções', () => {
    const list: MoodEntry[] = [];
    for (let i = 0; i < 10; i++) list.push(entry(i, 0, ['festa'], { emotionIds: ['emo.sobrecarga'] }));
    for (let i = 10; i < 30; i++) list.push(entry(i, 0, ['casa'], { emotionIds: i % 5 ? [] : ['emo.sobrecarga'] }));
    const r = findPatterns(list);
    expect(r.patterns.some((p) => p.metric === 'emotion:emo.sobrecarga' && p.tag === 'festa' && p.direction === 'higher')).toBe(true);
  });
});

describe('repertório e situações', () => {
  it('avaliações por contexto', () => {
    const base = { createdAt: '', updatedAt: '', itemId: 'i', at: '', note: '', experienceId: null, timePrecision: 'exact' as const };
    const r = outcomesByContext([
      { ...base, id: '1', outcome: 'worked', tags: ['dia difícil'] },
      { ...base, id: '2', outcome: 'worse', tags: ['viagem'] },
      { ...base, id: '3', outcome: 'worked', tags: ['dia difícil'] },
    ]);
    expect(r[0]).toMatchObject({ tag: 'dia difícil', n: 2 });
    expect(r[1].counts.worse).toBe(1);
  });

  it('reúne registros do usuário relacionados à situação', () => {
    const d = initialData();
    const now = '2026-01-01T00:00:00.000Z';
    const q = d.questions.find((x) => x.sectionId === 'sec.relacoes')!;
    d.answers.push({ id: 'a1', createdAt: now, updatedAt: now, questionId: q.id, text: 'Depois de eventos sociais longos preciso ficar sozinho.', unfinished: false, layers: [] });
    d.discoveries.push({ id: 'd1', createdAt: now, updatedAt: now, title: 'Viagens me cansam no 3º dia', description: '', sectionId: null, at: now, tags: ['viagem'], confidence: 'recurring', status: 'active', revisions: [], experienceIds: [], moodEntryIds: [], eventIds: [], origin: 'user' });
    const sit = { id: 's1', createdAt: now, updatedAt: now, title: 'Festa de aniversário', description: '', date: null, endDate: null, tags: ['encontro social'], itemIds: [], discoveryIds: [], questionIds: [], noteIds: [], letterIds: [], checklist: [], archived: false };
    const g = gatherForSituation(d, sit);
    expect(g.answers.map((a) => a.x.id)).toContain('a1');
    expect(g.discoveries.length).toBe(0);
    expect(stems(['encontro social'])).toContain('soci');
  });

  it('reencontro só usa textos com mais de 30 dias', () => {
    const d = initialData();
    const now = new Date(2026, 5, 15);
    d.notes.push({ id: 'n1', sectionId: 'sec.valores', text: 'antiga', tags: [], layers: [], createdAt: new Date(2026, 0, 15).toISOString(), updatedAt: '' });
    d.notes.push({ id: 'n2', sectionId: 'sec.valores', text: 'recente', tags: [], layers: [], createdAt: new Date(2026, 5, 10).toISOString(), updatedAt: '' });
    expect(pickResurface(d, now, () => 0)?.id).toBe('n1');
  });
});
