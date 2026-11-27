import { describe, expect, it } from 'vitest';
import { compareIndex, dayResult, dayWeightedShares, fmtIndex, monthRange, roundAway, stability, valenceIndex, weekdayIndex, weekRange } from '../src/domain/valence';
import { daySeries } from '../src/domain/series';

const E = (at: string, valence: number) => ({ id: at + valence + Math.random(), at, valence }) as any;

describe('resultado do dia (média arredondada, empate para longe do zero)', () => {
  it('exemplos da especificação', () => {
    expect(dayResult([-1, 1])).toBe(0);
    expect(dayResult([-2, 1])).toBe(-1);
    expect(dayResult([-2, -1])).toBe(-2);
    expect(dayResult([1, 2])).toBe(2);
  });
  it('um registro, vários registros e nenhum', () => {
    expect(dayResult([2])).toBe(2);
    expect(dayResult([0, 0, 1])).toBe(0); // 0,33
    expect(dayResult([1, 1, 2])).toBe(1); // 1,33
    expect(dayResult([-2, -2, 1])).toBe(-1);
    expect(dayResult([])).toBeNull();
  });
  it('empate exato com ponto flutuante não erra o lado', () => {
    expect(roundAway(0.5)).toBe(1);
    expect(roundAway(-0.5)).toBe(-1);
    expect(roundAway(-1.5)).toBe(-2);
    expect(roundAway(3.5, 3)).toBe(4);
    expect(roundAway(2.5, 3)).toBe(2);
    expect(dayResult([0, 0, 0])).toBe(0);
  });
  it('o resumo por data do gráfico usa a mesma regra do calendário', () => {
    const d = daySeries([E('2026-11-01T08:00:00', -2), E('2026-11-01T20:00:00', -1)].map((m) => ({ ...m, energy: null, emotionIds: [], timePrecision: 'exact', createdAt: '2026-11-01T00:00:00Z' })));
    expect(d[0].mood! - 3).toBe(-2);
  });
});

describe('índice com peso igual por data', () => {
  it('uma data com muitos registros não pesa mais', () => {
    const list = [E('2026-11-02T08:00:00', 2), E('2026-11-02T09:00:00', 2), E('2026-11-02T10:00:00', 2), E('2026-11-02T11:00:00', 2), E('2026-11-03T08:00:00', -2)];
    const s = valenceIndex(list);
    expect(s.index).toBe(0); // (2 + (−2)) / 2, e não (8 − 2) / 5
    expect(s.records).toBe(5);
    expect(s.dates).toBe(2);
    const sh = dayWeightedShares(list);
    expect(sh[4]).toBeCloseTo(0.5);
    expect(sh[0]).toBeCloseTo(0.5);
  });
  it('sem registros: índice vazio, nunca zero (ausência não é neutro)', () => {
    expect(valenceIndex([])).toEqual({ index: null, records: 0, dates: 0 });
  });
});

describe('índice por dia da semana', () => {
  // 2026-11-02 é segunda-feira.
  const mk = (day: string, vals: number[]) => vals.map((v, i) => E(`${day}T${String(8 + i).padStart(2, '0')}:00:00`, v));
  it('média das datas de cada dia da semana, com destaque só com dados suficientes', () => {
    const list = [
      ...['2026-11-02', '2026-11-09', '2026-11-16'].flatMap((d) => mk(d, [2, 2])), // segundas: +2
      ...['2026-11-03', '2026-11-10', '2026-11-17'].flatMap((d) => mk(d, [-2, 0])), // terças: −1
      ...['2026-11-04', '2026-11-11', '2026-11-18'].flatMap((d) => mk(d, [0])), // quartas: 0
      ...mk('2026-11-05', [-2]), // uma quinta só: não elegível
    ];
    const w = weekdayIndex(list);
    expect(w.days[1].index).toBe(2);
    expect(w.days[2].index).toBe(-1);
    expect(w.days[4].eligible).toBe(false);
    expect(w.highest?.wd).toBe(1);
    expect(w.lowest?.wd).toBe(2); // a quinta (−2) não entra por ter 1 data
  });
  it('amostra insuficiente: sem destaque e com explicação', () => {
    const w = weekdayIndex(mk('2026-11-02', [1, 2]));
    expect(w.highest).toBeNull();
    expect(w.reason).toMatch(/pelo menos/);
  });
  it('dias próximos entre si: sem destaque', () => {
    const list = ['2026-11-02', '2026-11-09', '2026-11-16', '2026-11-03', '2026-11-10', '2026-11-17', '2026-11-04', '2026-11-11', '2026-11-18'].flatMap((d) => mk(d, [1]));
    const w = weekdayIndex(list);
    expect(w.highest).toBeNull();
    expect(w.reason).toMatch(/próximos/);
  });
});

describe('comparação entre dois períodos', () => {
  const days = (start: number, vals: number[]) => vals.map((v, i) => E(`2026-11-${String(start + i).padStart(2, '0')}T10:00:00`, v));
  it('diferença em pontos e direção', () => {
    const c = compareIndex(days(2, [-1, -1, 0, -1, 0]), days(9, [1, 1, 2, 0, 1]));
    expect(c.a.index).toBeCloseTo(-0.6);
    expect(c.b.index).toBeCloseTo(1);
    expect(c.delta).toBeCloseTo(1.6);
    expect(c.verdict).toBe('up');
    expect(compareIndex(days(9, [1, 1, 2, 0, 1]), days(2, [-1, -1, 0, -1, 0])).verdict).toBe('down');
  });
  it('sem mudança relevante abaixo de 0,25 ponto', () => {
    expect(compareIndex(days(2, [1, 1, 1, 1, 1]), days(9, [1, 1, 1, 1, 2])).verdict).toBe('same');
  });
  it('amostra pequena ou período vazio: não conclui', () => {
    expect(compareIndex(days(2, [1, 1]), days(9, [2, 2, 2, 2, 2])).verdict).toBe('insufficient');
    const empty = compareIndex([], days(9, [2, 2, 2, 2, 2]));
    expect(empty.verdict).toBe('insufficient');
    expect(empty.delta).toBeNull();
  });
  it('semanas e meses escolhidos livremente', () => {
    expect(weekRange('2026-11-05', 1)).toEqual({ from: '2026-11-02', to: '2026-11-08' });
    expect(weekRange('2026-11-05', 0)).toEqual({ from: '2026-11-01', to: '2026-11-07' });
    expect(monthRange('2026-02')).toEqual({ from: '2026-02-01', to: '2026-02-28' });
    expect(monthRange('2024-02').to).toBe('2024-02-29');
  });
});

describe('estabilidade', () => {
  const recs = (vals: number[]) => vals.map((v, i) => E(`2026-11-${String(1 + (i % 5)).padStart(2, '0')}T${String(8 + i).padStart(2, '0')}:00:00`, v));
  it('sem variação = 100, mesmo se todas forem desagradáveis (estabilidade não é bem-estar)', () => {
    expect(stability(recs([-2, -2, -2, -2, -2])).score).toBe(100);
    expect(stability(recs([2, 2, 2, 2, 2])).score).toBe(100);
  });
  it('variação máxima = 0; valores intermediários entre 0 e 100', () => {
    expect(stability(recs([-2, 2, -2, 2, -2, 2])).score).toBe(0);
    const s = stability(recs([0, 1, 0, -1, 0]));
    expect(s.sd).toBeCloseTo(Math.sqrt(0.4));
    expect(s.score).toBe(Math.round(100 * (1 - Math.sqrt(0.4) / 2)));
  });
  it('amostra pequena não gera número', () => {
    expect(stability(recs([1, 2, 1])).score).toBeNull();
    expect(stability([E('2026-11-01T08:00:00', 1), E('2026-11-01T09:00:00', 1), E('2026-11-01T10:00:00', 1), E('2026-11-01T11:00:00', 1), E('2026-11-01T12:00:00', 1)]).score).toBeNull(); // 1 data só
  });
});

describe('formatação', () => {
  it('sinal e vírgula', () => {
    expect(fmtIndex(0.84)).toBe('+0,8');
    expect(fmtIndex(-1.25)).toBe('−1,3');
    expect(fmtIndex(0.02)).toBe('0,0');
    expect(fmtIndex(null)).toBe('—');
  });
});
