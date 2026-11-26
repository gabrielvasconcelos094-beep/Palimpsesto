import { describe, expect, it } from 'vitest';
import { buildSeries, changes, daySeries, gapCount, lowerMedian, recordSeries, segments, timeTicks } from '../src/domain/series';
import type { MoodEntry } from '../src/domain/schema';

let n = 0;
const E = (at: string, valence: number, energy: number | null = null, extra: Partial<MoodEntry> = {}): MoodEntry => ({
  id: `e${n++}`,
  createdAt: '2026-11-25T10:00:00.000Z',
  updatedAt: '2026-11-25T10:00:00.000Z',
  at,
  timePrecision: 'exact',
  valence,
  energy,
  emotionIds: [],
  indicators: {},
  tags: [],
  itemIds: [],
  note: '',
  ...extra,
});

describe('séries do gráfico em linha', () => {
  it('um ponto por registro, em ordem, com humor 1…5 e energia', () => {
    const s = recordSeries([E('2026-11-03T20:00:00', 2, 5), E('2026-11-01T08:00:00', -2, 1), E('2026-11-02T12:00:00', 0, null)]);
    expect(s.map((p) => p.day)).toEqual(['2026-11-01', '2026-11-02', '2026-11-03']);
    expect(s.map((p) => p.mood)).toEqual([1, 3, 5]);
    expect(s.map((p) => p.energy)).toEqual([1, null, 5]);
  });
  it('usa a data em que aconteceu (retroativo) e não a de criação', () => {
    const s = recordSeries([E('2026-10-05T09:00:00', 1, null, { createdAt: '2026-11-25T10:00:00.000Z' })]);
    expect(s[0].day).toBe('2026-10-05');
    expect(new Date(s[0].t).getMonth()).toBe(9);
  });
  it('registro sem horário fica ao meio-dia', () => {
    const s = recordSeries([E('2026-11-05T03:00:00', 1, null, { timePrecision: 'day' })]);
    expect(new Date(s[0].t).getHours()).toBe(12);
  });
  it('mediana ordinal: categoria do meio, a inferior em número par — nunca uma média', () => {
    expect(lowerMedian([1, 5])).toBe(1);
    expect(lowerMedian([1, 2, 5])).toBe(2);
    expect(lowerMedian([5, 1, 4, 2])).toBe(2);
    expect(lowerMedian([])).toBeNull();
  });
  it('resumo por data = resultado do dia (média arredondada, empate para longe do centro)', () => {
    const d = daySeries([E('2026-11-01T08:00:00', -2, 1), E('2026-11-01T20:00:00', 1, 5)]);
    expect(d).toHaveLength(1);
    expect(d[0].mood).toBe(2); // −0,5 → −1 → nível 2
    expect(d[0].energy).toBe(3); // (1+5)/2 = 3
    expect(d[0].records).toBe(2);
    expect(d[0].ids).toHaveLength(2);
  });
  it('resumo por data: energia ignora registros sem energia', () => {
    const d = daySeries([E('2026-11-01T08:00:00', 1, null), E('2026-11-01T20:00:00', 1, 4)]);
    expect(d[0].energy).toBe(4);
    expect(daySeries([E('2026-11-01T08:00:00', 1, null)])[0].energy).toBeNull();
  });
  it('lacunas maiores que 3 dias interrompem a linha (ausência não é neutro)', () => {
    const pts = recordSeries([E('2026-11-01T10:00:00', 1), E('2026-11-03T10:00:00', 2), E('2026-11-10T10:00:00', -1), E('2026-11-11T10:00:00', 0)]);
    const seg = segments(pts, 'mood');
    expect(seg.map((s) => s.points.length)).toEqual([2, 2]);
    expect(gapCount(pts, 'mood')).toBe(1);
    // exatamente 3 dias ainda liga; 3 dias e uma hora, não.
    const edge = recordSeries([E('2026-11-01T10:00:00', 1), E('2026-11-04T10:00:00', 1), E('2026-11-07T11:00:00', 1)]);
    expect(segments(edge, 'mood').map((s) => s.points.length)).toEqual([2, 1]);
  });
  it('energia: pontos sem energia não entram na linha e a lacuna conta do último com energia', () => {
    const pts = recordSeries([E('2026-11-01T10:00:00', 1, 3), E('2026-11-02T10:00:00', 1, null), E('2026-11-03T10:00:00', 1, null), E('2026-11-04T10:00:00', 1, 4), E('2026-11-12T10:00:00', 1, 2)]);
    expect(segments(pts, 'energy').map((s) => s.points.map((p) => p.v))).toEqual([[3, 4], [2]]);
  });
  it('variações entre pontos consecutivos do mesmo trecho', () => {
    const pts = recordSeries([E('2026-11-01T10:00:00', -1), E('2026-11-02T10:00:00', 1), E('2026-11-03T10:00:00', 1), E('2026-11-04T10:00:00', -2), E('2026-11-20T10:00:00', 2)]);
    expect(changes(pts, 'mood')).toEqual({ up: 1, down: 1, same: 1, total: 3 });
  });
  it('buildSeries escolhe a unidade', () => {
    const list = [E('2026-11-01T08:00:00', 1), E('2026-11-01T20:00:00', 2)];
    expect(buildSeries(list, 'record')).toHaveLength(2);
    expect(buildSeries(list, 'day')).toHaveLength(1);
  });
  it('marcas do eixo do tempo: poucas e dentro do intervalo', () => {
    const from = new Date('2026-10-01T00:00:00').getTime();
    for (const days of [7, 30, 90, 365]) {
      const to = from + days * 86400000;
      const t = timeTicks(from, to);
      expect(t.length).toBeGreaterThanOrEqual(2);
      expect(t.length).toBeLessThanOrEqual(7);
      expect(t.every((x) => x >= from && x <= to)).toBe(true);
    }
  });
});
