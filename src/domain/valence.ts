/**
 * Índices descritivos da valência (−2…+2).
 *
 * A escala é ORDINAL. Médias aqui são indicadores aproximados, para leitura
 * descritiva — não medidas clínicas — e vêm sempre acompanhadas de quantos
 * registros e quantas datas entraram na conta. Dias sem registro nunca contam
 * como neutros: simplesmente não entram.
 *
 * Peso por data: primeiro a média dos registros de cada data, depois a média
 * entre as datas. Assim, um dia com seis registros não pesa seis vezes mais
 * que um dia com um só.
 */
import type { MoodEntry } from './schema';
import { addDays, dayKey, startOfWeek } from './util';

/** Arredonda ao inteiro mais próximo; no empate (x,5), para longe do centro. */
export function roundAway(x: number, center = 0): number {
  const d = x - center;
  // Pequena tolerância para erros de ponto flutuante (ex.: 1/3 + 1/3 + …).
  const r = Math.round(Math.abs(d) + 1e-9);
  return center + Math.sign(d) * r;
}

/**
 * Resultado de uma data: média dos valores, arredondada (empate → longe do zero).
 * Ex.: (−1, +1) → 0; (−2, +1) → −1; (−2, −1) → −2; (+1, +2) → +2.
 * Não altera os registros: é só a forma de mostrar a data num símbolo.
 */
export function dayResult(values: number[], center = 0): number | null {
  if (!values.length) return null;
  return roundAway(values.reduce((a, b) => a + b, 0) / values.length, center);
}

const mean = (v: number[]) => v.reduce((a, b) => a + b, 0) / v.length;

/** Média de cada data (valência −2…+2). */
export function dayMeans(entries: Pick<MoodEntry, 'at' | 'valence'>[]): Map<string, { mean: number; records: number; values: number[] }> {
  const by = new Map<string, number[]>();
  for (const m of entries) {
    const k = m.at.slice(0, 10);
    by.set(k, [...(by.get(k) ?? []), m.valence]);
  }
  return new Map([...by].map(([k, values]) => [k, { mean: mean(values), records: values.length, values }]));
}

export interface IndexSummary {
  /** Índice médio (−2…+2), ou null sem registros. */
  index: number | null;
  records: number;
  dates: number;
}

/** Índice médio de valência com peso igual por data. */
export function valenceIndex(entries: Pick<MoodEntry, 'at' | 'valence'>[]): IndexSummary {
  const days = dayMeans(entries);
  if (!days.size) return { index: null, records: 0, dates: 0 };
  return { index: mean([...days.values()].map((d) => d.mean)), records: entries.length, dates: days.size };
}

/** Distribuição dos cinco níveis com peso igual por data (proporções que somam 1). */
export function dayWeightedShares(entries: Pick<MoodEntry, 'at' | 'valence'>[]): number[] {
  const days = dayMeans(entries);
  const out = [0, 0, 0, 0, 0];
  if (!days.size) return out;
  for (const d of days.values()) d.values.forEach((v) => (out[v + 2] += 1 / d.values.length / days.size));
  return out;
}

/* ------------------------------------------------------------------------ */
/* Dia da semana                                                             */
/* ------------------------------------------------------------------------ */
/** Mínimo de datas para um dia da semana entrar no "maior" e "menor" índice. */
export const WEEKDAY_INDEX_MIN_DATES = 3;
/** Mínimo de dias da semana elegíveis para apontar maior e menor. */
export const WEEKDAY_INDEX_MIN_DAYS = 3;
/** Diferença mínima (pontos) entre o maior e o menor para destacá-los. */
export const MIN_RELEVANT_CHANGE = 0.25;

export interface WeekdayIndex extends IndexSummary {
  wd: number;
  eligible: boolean;
  shares: number[];
}

export function weekdayIndex(entries: Pick<MoodEntry, 'at' | 'valence'>[]): {
  days: WeekdayIndex[];
  highest: WeekdayIndex | null;
  lowest: WeekdayIndex | null;
  reason: string | null;
} {
  const days = Array.from({ length: 7 }, (_, wd) => {
    const list = entries.filter((m) => new Date(m.at.slice(0, 10) + 'T12:00:00').getDay() === wd);
    const s = valenceIndex(list);
    return { ...s, wd, eligible: s.dates >= WEEKDAY_INDEX_MIN_DATES, shares: dayWeightedShares(list) };
  });
  const ok = days.filter((d) => d.eligible).sort((a, b) => (b.index ?? 0) - (a.index ?? 0));
  if (ok.length < WEEKDAY_INDEX_MIN_DAYS)
    return {
      days,
      highest: null,
      lowest: null,
      reason: `Para comparar os dias da semana, é preciso ter pelo menos ${WEEKDAY_INDEX_MIN_DAYS} dias da semana com ${WEEKDAY_INDEX_MIN_DATES} datas ou mais cada.`,
    };
  const hi = ok[0];
  const lo = ok[ok.length - 1];
  if ((hi.index ?? 0) - (lo.index ?? 0) < MIN_RELEVANT_CHANGE)
    return { days, highest: null, lowest: null, reason: `Os dias da semana ficaram próximos entre si (menos de ${MIN_RELEVANT_CHANGE.toLocaleString('pt-BR')} ponto de diferença).` };
  return { days, highest: hi, lowest: lo, reason: null };
}

/* ------------------------------------------------------------------------ */
/* Comparação entre dois períodos                                            */
/* ------------------------------------------------------------------------ */
export const COMPARE_MIN_RECORDS = 5;
export const COMPARE_MIN_DATES = 3;

export interface Comparison {
  a: IndexSummary & { shares: number[] };
  b: IndexSummary & { shares: number[] };
  /** b − a, em pontos da escala; null se algum lado não tem registros. */
  delta: number | null;
  verdict: 'up' | 'down' | 'same' | 'insufficient';
}

export function compareIndex(a: Pick<MoodEntry, 'at' | 'valence'>[], b: Pick<MoodEntry, 'at' | 'valence'>[]): Comparison {
  const A = { ...valenceIndex(a), shares: dayWeightedShares(a) };
  const B = { ...valenceIndex(b), shares: dayWeightedShares(b) };
  const delta = A.index !== null && B.index !== null ? B.index - A.index : null;
  const enough = (s: IndexSummary) => s.records >= COMPARE_MIN_RECORDS && s.dates >= COMPARE_MIN_DATES;
  const verdict = delta === null || !enough(A) || !enough(B) ? 'insufficient' : Math.abs(delta) < MIN_RELEVANT_CHANGE ? 'same' : delta > 0 ? 'up' : 'down';
  return { a: A, b: B, delta, verdict };
}

/** Intervalo (datas locais) da semana que contém `day`. */
export function weekRange(day: string, weekStartsOn: 0 | 1 = 1): { from: string; to: string } {
  const s = startOfWeek(new Date(day + 'T12:00:00'), weekStartsOn);
  return { from: dayKey(s), to: dayKey(addDays(s, 6)) };
}

/** Intervalo do mês "AAAA-MM". */
export function monthRange(month: string): { from: string; to: string } {
  const [y, m] = month.split('-').map(Number);
  const last = new Date(y, m, 0).getDate();
  return { from: `${month}-01`, to: `${month}-${String(last).padStart(2, '0')}` };
}

/* ------------------------------------------------------------------------ */
/* Estabilidade                                                              */
/* ------------------------------------------------------------------------ */
export const STABILITY_MIN_RECORDS = 5;
export const STABILITY_MIN_DATES = 3;

export interface Stability {
  /** 0…100, ou null se a amostra for pequena demais. */
  score: number | null;
  sd: number | null;
  records: number;
  dates: number;
}

/**
 * Estabilidade = 100 × (1 − desvio-padrão / 2), limitada a 0…100.
 * Desvio-padrão populacional dos valores registrados (−2…+2): o máximo
 * possível é 2 (metade em −2, metade em +2), que dá 0.
 *
 * Estabilidade NÃO é bem-estar: uma sequência só de avaliações negativas é
 * muito estável. É apenas quão pouco as avaliações variaram.
 */
export function stability(entries: Pick<MoodEntry, 'at' | 'valence'>[]): Stability {
  const records = entries.length;
  const dates = new Set(entries.map((m) => m.at.slice(0, 10))).size;
  if (records < STABILITY_MIN_RECORDS || dates < STABILITY_MIN_DATES) return { score: null, sd: null, records, dates };
  const v = entries.map((m) => m.valence);
  const mu = mean(v);
  const sd = Math.sqrt(mean(v.map((x) => (x - mu) ** 2)));
  return { score: Math.max(0, Math.min(100, Math.round(100 * (1 - sd / 2)))), sd, records, dates };
}

/** Formata um índice com sinal e uma casa: "+0,8", "−1,2", "0,0". */
export function fmtIndex(x: number | null): string {
  if (x === null) return '—';
  const r = roundAway(x * 10) / 10;
  const s = Math.abs(r).toLocaleString('pt-BR', { minimumFractionDigits: 1, maximumFractionDigits: 1 });
  return r > 0 ? `+${s}` : r < 0 ? `−${s}` : s;
}
