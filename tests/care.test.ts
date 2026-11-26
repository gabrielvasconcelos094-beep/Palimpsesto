import { describe, expect, it } from 'vitest';
import { band, change, history, INSTRUMENT_DEFS, isComplete, item9Positive, score } from '../src/domain/assessments';
import { nights, sleepSummary } from '../src/domain/sleep';
import { instability } from '../src/domain/valence';
import { AppDataSchema } from '../src/domain/schema';
import { parseAppData } from '../src/data/validate';

const A = (instrument: 'phq9' | 'gad7', answers: number[], date = '2026-11-01') => ({ id: date + answers.join(''), createdAt: date, updatedAt: date, instrument, date, answers, difficulty: null, note: '' }) as any;

describe('questionários', () => {
  it('itens e faixas oficiais', () => {
    expect(INSTRUMENT_DEFS.phq9.items).toHaveLength(9);
    expect(INSTRUMENT_DEFS.gad7.items).toHaveLength(7);
    expect(INSTRUMENT_DEFS.phq9.max).toBe(27);
    expect(INSTRUMENT_DEFS.gad7.max).toBe(21);
  });
  it('pontuação e faixas nos limites', () => {
    const p = (n: number) => band('phq9', n).label;
    expect([0, 4, 5, 9, 10, 14, 15, 19, 20, 27].map(p)).toEqual(['mínimos', 'mínimos', 'leves', 'leves', 'moderados', 'moderados', 'moderadamente graves', 'moderadamente graves', 'graves', 'graves']);
    const g = (n: number) => band('gad7', n).label;
    expect([4, 5, 10, 15, 21].map(g)).toEqual(['mínimos', 'leves', 'moderados', 'graves', 'graves']);
    expect(score(A('phq9', [3, 3, 3, 3, 3, 3, 3, 3, 3]))).toBe(27);
  });
  it('só aceita questionário completo', () => {
    expect(isComplete('gad7', [0, 1, 2, 3, 0, 1, 2])).toBe(true);
    expect(isComplete('gad7', [0, 1, 2, 3, 0, 1, null])).toBe(false);
    expect(isComplete('phq9', [0, 1, 2, 3, 0, 1, 2])).toBe(false);
  });
  it('item 9 do PHQ-9 acima de "nenhuma vez" aciona o aviso de segurança', () => {
    expect(item9Positive(A('phq9', [0, 0, 0, 0, 0, 0, 0, 0, 1]))).toBe(true);
    expect(item9Positive(A('phq9', [3, 3, 3, 3, 3, 3, 3, 3, 0]))).toBe(false);
    expect(item9Positive(A('gad7', [0, 0, 0, 0, 0, 0, 3]))).toBe(false);
  });
  it('mudança clinicamente relevante: PHQ-9 ≥ 5, GAD-7 ≥ 4', () => {
    expect(change('phq9', A('phq9', [2, 2, 2, 2, 2, 2, 0, 0, 0]), A('phq9', [1, 1, 1, 1, 1, 1, 1, 0, 0], '2026-11-15'))).toEqual({ delta: -5, kind: 'better', days: 14 });
    expect(change('phq9', A('phq9', [1, 1, 1, 1, 0, 0, 0, 0, 0]), A('phq9', [2, 2, 1, 1, 1, 0, 0, 0, 0])).kind).toBe('same');
    expect(change('gad7', A('gad7', [0, 0, 0, 0, 0, 0, 0]), A('gad7', [1, 1, 1, 1, 0, 0, 0])).kind).toBe('worse');
  });
  it('histórico em ordem cronológica e por instrumento', () => {
    const h = history([A('phq9', [1, 0, 0, 0, 0, 0, 0, 0, 0], '2026-11-10'), A('gad7', [0, 0, 0, 0, 0, 0, 0]), A('phq9', [0, 0, 0, 0, 0, 0, 0, 0, 0], '2026-10-01')], 'phq9');
    expect(h.map((x) => x.date)).toEqual(['2026-10-01', '2026-11-10']);
  });
  it('o documento aceita as novas coleções e recusa respostas fora de 0–3', () => {
    const base = AppDataSchema.parse({ schemaVersion: 2 });
    expect(base.assessments).toEqual([]);
    expect(base.agenda).toEqual([]);
    expect(base.safetyPlans).toEqual([]);
    expect(() => AppDataSchema.parse({ schemaVersion: 2, assessments: [{ ...A('gad7', [0, 0, 0, 0, 0, 0, 4]) }] })).toThrow();
  });
  it('backup antigo (sem as novas coleções) continua válido', () => {
    const r = parseAppData({ schemaVersion: 2, moodEntries: [{ id: 'm1', createdAt: '2026-11-01T00:00:00Z', updatedAt: '2026-11-01T00:00:00Z', at: '2026-11-01T10:00:00', valence: 1 }] });
    expect(r.ok).toBe(true);
    if (r.ok) {
      expect(r.data.assessments).toEqual([]);
      expect(r.data.moodEntries[0].sleepHours).toBeNull();
    }
  });
});

const M = (at: string, valence: number, sleepHours: number | null = null) => ({ id: at, at, valence, sleepHours, energy: null, emotionIds: [], indicators: {}, tags: [], itemIds: [], note: '', timePrecision: 'exact', createdAt: at, updatedAt: at }) as any;

describe('sono', () => {
  it('uma noite por data (o valor mais recente) e datas sem informação não contam', () => {
    const n = nights([M('2026-11-01T08:00:00', 0, 6), M('2026-11-01T20:00:00', 0, 7), M('2026-11-02T08:00:00', 1)]);
    expect(n).toEqual([{ day: '2026-11-01', hours: 7 }]);
  });
  it('mediana, variação e comparação com amostra suficiente', () => {
    const list = [
      ...['01', '02', '03'].map((d) => M(`2026-11-${d}T09:00:00`, -1, 5)),
      ...['04', '05', '06'].map((d) => M(`2026-11-${d}T09:00:00`, 1, 8)),
    ];
    const s = sleepSummary(list);
    expect(s.nights).toBe(6);
    expect(s.median).toBe(5);
    expect(s.sd).toBeCloseTo(1.5);
    expect(s.shortShare).toBeCloseTo(0.5);
    expect(s.comparable).toBe(true);
    expect(s.short.index).toBe(-1);
    expect(s.enough.index).toBe(1);
  });
  it('poucas noites: sem variação nem comparação', () => {
    const s = sleepSummary([M('2026-11-01T09:00:00', 0, 7), M('2026-11-02T09:00:00', 0, 5)]);
    expect(s.sd).toBeNull();
    expect(s.comparable).toBe(false);
  });
});

describe('instabilidade entre registros consecutivos (RMSSD)', () => {
  const seq = (vals: number[]) => vals.map((v, i) => M(`2026-11-${String(1 + i).padStart(2, '0')}T10:00:00`, v));
  it('sem mudança = 0; alternância máxima = 4', () => {
    expect(instability(seq([1, 1, 1, 1, 1, 1])).rmssd).toBe(0);
    expect(instability(seq([-2, 2, -2, 2, -2, 2])).rmssd).toBe(4);
  });
  it('mesma dispersão, ordem diferente: oscilação rápida > mudança lenta', () => {
    const slow = instability(seq([-2, -2, -1, -1, 0, 0, 1, 1, 2, 2])).rmssd!;
    const fast = instability(seq([-2, 2, -1, 1, 0, 0, 1, -1, 2, -2])).rmssd!;
    expect(fast).toBeGreaterThan(slow);
  });
  it('lacunas de mais de 3 dias não viram "saltos"; poucos pares = sem número', () => {
    const r = instability([M('2026-11-01T10:00:00', -2), M('2026-11-10T10:00:00', 2), M('2026-11-20T10:00:00', -2)]);
    expect(r.pairs).toBe(0);
    expect(r.rmssd).toBeNull();
  });
});
