/**
 * Confiabilidade estatística (1.11): os testes usados para decidir o que DESTACAR e
 * simulações com dados aleatórios. Em dados sem nenhum padrão real, o app quase nunca
 * deve apontar "dia mais alto", "subiu", "padrão" ou "diferença clara"; com um efeito
 * real e dados suficientes, deve continuar apontando.
 */
import { describe, expect, it } from 'vitest';
import { benjaminiHochberg, fisherExactP, mannWhitneyP, permutationDiffMeans, permutationRange, rng } from '../src/domain/stats';
import { compareIndex, weekdayIndex } from '../src/domain/valence';
import { findPatterns } from '../src/domain/analytics';
import { activityTests, buildInsights, weekdayHighlight } from '../src/domain/insights';
import { factorStats, sleepSummary } from '../src/domain/sleep';
import { emptyData } from '../src/data/defaults';
import { SLEEP_FACTORS, type MoodEntry, type SleepLog } from '../src/domain/schema';

const pad = (n: number) => String(n).padStart(2, '0');
const dateAt = (start: Date, i: number) => {
  const d = new Date(start);
  d.setDate(d.getDate() + i);
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}`;
};
const pick = <T,>(r: () => number, xs: readonly T[]) => xs[Math.floor(r() * xs.length)];

/** Registros aleatórios: valência, energia, marcadores, emoções e atividades independentes entre si. */
function randomEntries(seed: number, dates: number, perDay = 1.5, start = new Date(2026, 0, 5)): MoodEntry[] {
  const r = rng(seed);
  const out: MoodEntry[] = [];
  for (let i = 0; i < dates; i++) {
    const k = Math.max(1, Math.round(perDay + (r() - 0.5) * 2));
    for (let j = 0; j < k; j++) {
      out.push({
        id: `e${i}-${j}`,
        createdAt: '2026-01-01T00:00:00Z',
        updatedAt: '2026-01-01T00:00:00Z',
        at: `${dateAt(start, i)}T${pad(8 + j * 4)}:00:00`,
        timePrecision: 'exact',
        valence: pick(r, [-2, -1, 0, 1, 2] as const),
        energy: 1 + Math.floor(r() * 5),
        emotionIds: ['ans', 'tri', 'rai', 'cal', 'ale'].filter(() => r() < 0.3),
        indicators: { anxiety: 1 + Math.floor(r() * 5) },
        tags: ['trabalho', 'família', 'chuva', 'sozinho', 'exercício'].filter(() => r() < 0.35),
        itemIds: ['cam', 'mus', 'ler', 'med'].filter(() => r() < 0.3),
        note: '',
      } as MoodEntry);
    }
  }
  return out;
}

function randomSleep(seed: number, dates: number, start = new Date(2026, 0, 5)): SleepLog[] {
  const r = rng(seed ^ 0x9e3779b9);
  return Array.from({ length: dates }, (_, i) => ({
    id: `s${i}`,
    createdAt: '2026-01-01T00:00:00Z',
    updatedAt: '2026-01-01T00:00:00Z',
    date: dateAt(start, i),
    hours: 4 + Math.round(r() * 10) / 2,
    quality: 1 + Math.floor(r() * 5),
    troubles: [],
    note: '',
    factors: SLEEP_FACTORS.filter(() => r() < 0.3),
  })) as SleepLog[];
}

const rate = (trials: number, f: (seed: number) => boolean) => {
  let hits = 0;
  for (let s = 1; s <= trials; s++) if (f(s * 7919)) hits++;
  return hits / trials;
};

describe('testes básicos', () => {
  it('Fisher exato bilateral confere com valores de referência', () => {
    // Chá da senhora (Fisher, 1935): [[3,1],[1,3]] → p bilateral = 0,486
    expect(fisherExactP(3, 1, 1, 3)).toBeCloseTo(0.4857, 3);
    // [[10,0],[0,10]] → 2/C(20,10)
    expect(fisherExactP(10, 0, 0, 10)).toBeCloseTo(2 / 184756, 8);
    expect(fisherExactP(0, 0, 3, 4)).toBe(1);
  });
  it('Mann-Whitney: grupos idênticos ≈ 1; separados → p pequeno', () => {
    expect(mannWhitneyP([1, 2, 3, 4, 5], [1, 2, 3, 4, 5])).toBeGreaterThan(0.9);
    expect(mannWhitneyP([0, 0, 1, 0, 1, 0, 0, 1], [4, 3, 4, 4, 3, 4, 3, 4])).toBeLessThan(0.01);
    expect(mannWhitneyP([2, 2, 2], [2, 2, 2])).toBe(1); // só empates
  });
  it('Benjamini-Hochberg: valores q monótonos e conhecidos', () => {
    const q = benjaminiHochberg([0.01, 0.04, 0.03, 0.2]);
    expect(q.map((x) => +x.toFixed(4))).toEqual([0.04, 0.0533, 0.0533, 0.2]);
    expect(benjaminiHochberg([])).toEqual([]);
  });
  it('permutação: determinística (mesmos dados → mesmo p) e coerente', () => {
    const a = [1, 1.5, 2, 1, 2, 1.5];
    const b = [-1, -0.5, 0, -1, -1.5, 0];
    expect(permutationDiffMeans(a, b)).toBe(permutationDiffMeans(a, b));
    expect(permutationDiffMeans(a, b)).toBeLessThan(0.01);
    expect(permutationDiffMeans([0, 1, 0, 1], [1, 0, 1, 0])).toBeGreaterThan(0.5);
    expect(permutationDiffMeans([], [1])).toBe(1);
    expect(permutationRange([[1, 2], [1, 2], [2, 1]])).toBeGreaterThan(0.5);
    expect(permutationRange([[1]])).toBe(1);
  });
});

describe('dados aleatórios não geram conclusões', () => {
  // Antes da 1.11: dia da semana 100%, comparação 45–76%, padrões 70–94%, fatores do sono 34%.
  it('dia da semana com índice mais alto/baixo: raro em dados aleatórios', () => {
    expect(rate(150, (s) => weekdayIndex(randomEntries(s, 42)).highest !== null)).toBeLessThanOrEqual(0.1);
  });
  it('dia da semana com mais registros agradáveis: raro em dados aleatórios', () => {
    expect(rate(150, (s) => weekdayHighlight(randomEntries(s, 42), (m) => m.valence >= 1, 'day').ok)).toBeLessThanOrEqual(0.1);
  });
  it('comparação de períodos: "subiu/desceu" raro; o resto vira "sem diferença clara"', () => {
    let chance = 0;
    const fp = rate(200, (s) => {
      const e = randomEntries(s, 40);
      const c = compareIndex(e.slice(0, Math.floor(e.length / 2)), e.slice(Math.floor(e.length / 2)));
      if (c.chance) chance++;
      return c.verdict === 'up' || c.verdict === 'down';
    });
    expect(fp).toBeLessThanOrEqual(0.08);
    expect(chance).toBeGreaterThan(0); // diferenças "grandes" por acaso são explicadas como tal
  });
  it('padrões de contexto (marcadores × humor, energia, indicadores e emoções): raros', () => {
    for (const n of [20, 35, 60]) {
      const fp = rate(80, (s) => findPatterns(randomEntries(s, Math.round(n / 1.5)), { indicators: ['anxiety'] }).patterns.length > 0);
      expect(fp, `${n} registros`).toBeLessThanOrEqual(0.1);
    }
  });
  it('atividades com "diferença clara": raras', () => {
    expect(rate(150, (s) => activityTests(randomEntries(s, 60)).some((a) => a.clear))).toBeLessThanOrEqual(0.1);
  });
  it('fatores do sono e comparações de sono: raros', () => {
    expect(rate(150, (s) => factorStats(randomSleep(s, 40)).some((f) => f.clear))).toBeLessThanOrEqual(0.1);
    expect(
      rate(150, (s) => {
        const ss = sleepSummary(randomSleep(s, 40), randomEntries(s, 40));
        return ss.shortClear || ss.qualityClear;
      }),
    ).toBeLessThanOrEqual(0.12); // dois testes independentes a 5%
  });
  it('observações automáticas (exceto as avaliações de estratégias feitas pela pessoa): raras', () => {
    const data = emptyData();
    const now = new Date(2026, 2, 10, 12);
    const fp = rate(100, (s) => buildInsights(data, randomEntries(s, 64, 1.5, new Date(2026, 0, 5)), [], now).length > 0);
    expect(fp).toBeLessThanOrEqual(0.12);
  });
});

describe('efeitos reais continuam sendo detectados', () => {
  it('sábados claramente melhores → dia mais alto apontado', () => {
    const e = randomEntries(11, 70).map((m) => (new Date(m.at).getDay() === 6 ? { ...m, valence: 2 as const } : { ...m, valence: (m.valence > 0 ? -1 : m.valence) as MoodEntry['valence'] }));
    const wi = weekdayIndex(e);
    expect(wi.highest?.wd).toBe(6);
    expect(wi.p).toBeLessThan(0.05);
  });
  it('período melhor → "subiu"', () => {
    const a = randomEntries(3, 20).map((m) => ({ ...m, valence: (m.valence > 0 ? -m.valence : m.valence) as MoodEntry['valence'] }));
    const b = randomEntries(4, 20, 1.5, new Date(2026, 2, 1)).map((m) => ({ ...m, valence: (m.valence < 0 ? -m.valence : m.valence) as MoodEntry['valence'] }));
    const c = compareIndex(a, b);
    expect(c.verdict).toBe('up');
    expect(c.chance).toBe(false);
  });
  it('marcador associado a humor baixo → padrão encontrado', () => {
    const e = randomEntries(5, 40).map((m) => (m.tags.includes('trabalho') ? { ...m, valence: pick(rng(m.id.length), [-2, -1] as const) } : m));
    const res = findPatterns(e);
    expect(res.patterns.some((p) => p.tag === 'trabalho' && p.metric === 'valence' && p.direction === 'lower')).toBe(true);
  });
  it('emoções que vêm juntas de verdade → observação do par', () => {
    const e = randomEntries(21, 50).map((m, i) => ({ ...m, valence: -1 as const, emotionIds: i % 3 === 0 ? ['ans', 'tri'] : i % 3 === 1 ? ['rai'] : ['cal'] }));
    expect(buildInsights(emptyData(), e, [], new Date(2026, 2, 10)).some((x) => x.id.startsWith('pair-unpleasant|ans|tri'))).toBe(true);
  });
  it('fator do sono ligado a noites ruins → diferença clara', () => {
    const logs = randomSleep(9, 60).map((s) => ({ ...s, quality: (s.factors.includes('screens') ? 1 : 4) as SleepLog['quality'] }));
    expect(factorStats(logs).find((f) => f.factor === 'screens')!.clear).toBe(true);
  });
});
