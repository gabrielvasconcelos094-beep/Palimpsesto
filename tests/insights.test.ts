import { describe, expect, it } from 'vitest';
import {
  activityStats,
  buildInsights,
  dayPartStats,
  emotionPairs,
  regularity,
  shareBy,
  strategyGroups,
  weekdayHighlight,
  weekdayStats,
  withinDay,
  isPleasant,
} from '../src/domain/insights';
import { initialData } from '../src/data/defaults';
import type { MoodEntry, StrategyUse } from '../src/domain/schema';

let n = 0;
const E = (day: string, valence: number, extra: Partial<MoodEntry> = {}): MoodEntry => ({
  id: `e${n++}`,
  createdAt: `${day}T15:00:00.000Z`,
  updatedAt: `${day}T15:00:00.000Z`,
  at: `${day}T12:00:00`,
  timePrecision: 'exact',
  valence,
  energy: null,
  emotionIds: [],
  indicators: {},
  tags: [],
  itemIds: [],
  note: '',
  sleepHours: null,
  ...extra,
});

// Semanas de nov/2026: 2 (seg) … 8 (dom); 9 … 15; 16 … 22; 23 … 29.
const weeks = ['2026-11-02', '2026-11-09', '2026-11-16', '2026-11-23'];
const shift = (d: string, k: number) => {
  const x = new Date(d + 'T12:00:00');
  x.setDate(x.getDate() + k);
  return x.toISOString().slice(0, 10);
};

describe('dias da semana', () => {
  it('por dia: uma data com muitos registros não domina', () => {
    const list: MoodEntry[] = [];
    // Uma segunda-feira com 10 registros agradáveis; outras 3 segundas desagradáveis.
    for (let i = 0; i < 10; i++) list.push(E('2026-11-02', 2));
    for (const w of weeks.slice(1)) list.push(E(w, -1));
    const mondays = weekdayStats(list)[1];
    expect(mondays.records).toBe(13);
    expect(mondays.dates).toBe(4);
    expect(shareBy(mondays.entries, (m) => isPleasant(m.valence), 'record')).toBeCloseTo(10 / 13);
    expect(shareBy(mondays.entries, (m) => isPleasant(m.valence), 'day')).toBeCloseTo(0.25);
  });

  it('só aponta um dia quando há dados suficientes e diferença clara', () => {
    const few = [E('2026-11-02', 2), E('2026-11-03', -1)];
    const r1 = weekdayHighlight(few, (m) => isPleasant(m.valence));
    expect(r1.ok).toBe(false);
    if (!r1.ok) expect(r1.reason).toMatch(/observações suficientes/);

    const list: MoodEntry[] = [];
    for (const w of weeks)
      for (let k = 0; k < 7; k++) list.push(E(shift(w, k), k === 3 ? 2 : k % 2 ? -1 : 0)); // quinta (k=3) sempre agradável
    const r2 = weekdayHighlight(list, (m) => isPleasant(m.valence));
    expect(r2.ok).toBe(true);
    if (r2.ok) {
      expect(r2.h.label).toBe('quinta-feira');
      expect(r2.h.dates).toBe(4);
      expect(r2.h.unit).toBe('day');
    }
  });

  it('sem diferença clara entre os dias, não declara vencedor', () => {
    const list: MoodEntry[] = [];
    for (const w of weeks) for (let k = 0; k < 7; k++) list.push(E(shift(w, k), 1));
    const r = weekdayHighlight(list, (m) => isPleasant(m.valence));
    expect(r.ok).toBe(false);
  });
});

describe('horários e variação no dia', () => {
  it('registros sem horário ficam fora da análise por período do dia', () => {
    const s = dayPartStats([E('2026-11-02', 1, { at: '2026-11-02T08:00:00' }), E('2026-11-02', 1, { timePrecision: 'day' }), E('2026-11-03', 0, { at: '2026-11-03T21:00:00' })]);
    expect(s.untimed).toBe(1);
    expect(s.parts.find((p) => p.key === 'morning')!.records).toBe(1);
    expect(s.parts.find((p) => p.key === 'evening')!.records).toBe(1);
  });
  it('variação dentro do dia', () => {
    const w = withinDay([E('2026-11-02', -1, { at: '2026-11-02T08:00:00' }), E('2026-11-02', 1, { at: '2026-11-02T20:00:00' }), E('2026-11-03', 0)]);
    expect(w).toMatchObject({ days: 1, varied: 1, up: 1, down: 0 });
  });
});

describe('emoções, atividades e estratégias', () => {
  it('pares de emoções', () => {
    const list = [
      E('2026-11-02', -1, { emotionIds: ['a', 'b'] }),
      E('2026-11-03', -1, { emotionIds: ['a', 'b', 'c'] }),
      E('2026-11-04', -2, { emotionIds: ['a'] }),
    ];
    const p = emotionPairs(list)[0];
    expect(p).toMatchObject({ a: 'a', b: 'b', together: 2, either: 3 });
  });
  it('atividades: proporção com e sem e comparação com o registro anterior do dia', () => {
    const list = [
      E('2026-11-02', -1, { at: '2026-11-02T08:00:00' }),
      E('2026-11-02', 1, { at: '2026-11-02T18:00:00', itemIds: ['ler'] }),
      E('2026-11-03', 2, { itemIds: ['ler'] }),
      E('2026-11-04', -1),
    ];
    const a = activityStats(list).find((x) => x.itemId === 'ler')!;
    expect(a.records).toBe(2);
    expect(a.pleasantShare).toBe(1);
    expect(a.othersPleasantShare).toBe(0);
    expect(a.change).toEqual({ compared: 1, up: 1, same: 0, down: 0 });
  });
  it('agrupa estratégias pelas avaliações', () => {
    const u = (itemId: string, outcome: StrategyUse['outcome']): StrategyUse => ({ id: Math.random() + '', createdAt: '', updatedAt: '', itemId, at: '2026-11-02T12:00:00', timePrecision: 'exact', outcome, tags: [], note: '', experienceId: null });
    const g = strategyGroups([u('a', 'worked'), u('a', 'worked'), u('a', 'partial'), u('b', 'worse'), u('b', 'worked'), u('c', 'unknown')]);
    expect(g.find((x) => x.itemId === 'a')!.group).toBe('effective');
    expect(g.find((x) => x.itemId === 'b')!.group).toBe('ineffective');
    expect(g.find((x) => x.itemId === 'c')!.group).toBe('unknown');
  });
});

describe('regularidade e observações', () => {
  it('conta dias com e sem registro sem tratá-los como neutros', () => {
    const r = regularity([E('2026-11-02', 0), E('2026-11-02', 1), E('2026-11-05', 1)], '2026-11-01', '2026-11-07');
    expect(r).toMatchObject({ span: 7, withRecords: 2, without: 5 });
  });
  it('não gera observações sem dados suficientes e respeita as ocultadas', () => {
    const d = initialData();
    expect(buildInsights(d, [E('2026-11-02', 2)], [])).toEqual([]);
    const list: MoodEntry[] = [];
    for (const w of weeks) for (let k = 0; k < 7; k++) list.push(E(shift(w, k), k === 3 ? 2 : -1));
    const ins = buildInsights(d, list, []);
    const wd = ins.find((i) => i.id.startsWith('wd-pleasant'));
    expect(wd?.text).toMatch(/quinta-feira/);
    expect(wd?.basis).toMatch(/4 data/);
    d.preferences.dismissedInsights = [wd!.id];
    expect(buildInsights(d, list, []).some((i) => i.id === wd!.id)).toBe(false);
  });
});
