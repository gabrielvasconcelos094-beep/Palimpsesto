/**
 * Visões do calendário emocional além do mês: o ano dia a dia, as semanas, as
 * estações e os anos. Sempre a partir do "resultado do dia" (dayResult) e do índice
 * com peso igual por data (valenceIndex) — as mesmas regras do resto do app.
 */
import type { MoodEntry } from './schema';
import { addDays, dayKey, startOfWeek } from './util';
import { dayResult, roundAway, valenceIndex, dayWeightedShares } from './valence';

export function dayResults(entries: Pick<MoodEntry, 'at' | 'valence'>[]): Map<string, { result: number; n: number }> {
  const by = new Map<string, number[]>();
  for (const m of entries) by.set(m.at.slice(0, 10), [...(by.get(m.at.slice(0, 10)) ?? []), m.valence]);
  return new Map([...by].map(([k, v]) => [k, { result: dayResult(v)!, n: v.length }]));
}

export interface PeriodRow {
  key: string;
  label: string;
  from: string;
  to: string;
  index: number | null;
  /** Índice arredondado ao nível mais próximo (empate → longe do zero), para o símbolo. */
  result: number | null;
  dates: number;
  records: number;
  shares: number[];
}

function row(key: string, label: string, from: string, to: string, entries: Pick<MoodEntry, 'at' | 'valence'>[]): PeriodRow {
  const list = entries.filter((m) => m.at.slice(0, 10) >= from && m.at.slice(0, 10) <= to);
  const s = valenceIndex(list);
  return { key, label, from, to, index: s.index, result: s.index === null ? null : roundAway(s.index), dates: s.dates, records: s.records, shares: dayWeightedShares(list) };
}

/** Semanas de um ano (as que começam nele), até hoje. */
export function weeksOfYear(entries: Pick<MoodEntry, 'at' | 'valence'>[], year: number, weekStartsOn: 0 | 1, today = dayKey(new Date())): PeriodRow[] {
  const out: PeriodRow[] = [];
  let s = startOfWeek(new Date(year, 0, 1, 12), weekStartsOn);
  if (s.getFullYear() < year) s = addDays(s, 7);
  while (s.getFullYear() === year && dayKey(s) <= today) {
    const from = dayKey(s);
    const to = dayKey(addDays(s, 6));
    out.push(row(from, from, from, to, entries));
    s = addDays(s, 7);
  }
  return out;
}

export type Season = 'verao' | 'outono' | 'inverno' | 'primavera';
export const SEASON_LABELS: Record<Season, string> = { verao: 'Verão', outono: 'Outono', inverno: 'Inverno', primavera: 'Primavera' };

/**
 * Estação astronômica aproximada (equinócios e solstícios em 20/3, 21/6, 22/9 e 21/12),
 * pelo hemisfério escolhido — sem usar localização. O verão do Sul atravessa o ano:
 * "Verão 2025/26" vai de 21/12/2025 a 19/3/2026.
 */
export function seasonOf(day: string, hemisphere: 'south' | 'north'): { season: Season; year: number } {
  const y = Number(day.slice(0, 4));
  const md = day.slice(5);
  const south: Season[] = ['verao', 'outono', 'inverno', 'primavera'];
  const north: Season[] = ['inverno', 'primavera', 'verao', 'outono'];
  const order = hemisphere === 'south' ? south : north;
  if (md >= '12-21') return { season: order[0], year: y };
  if (md < '03-20') return { season: order[0], year: y - 1 };
  if (md < '06-21') return { season: order[1], year: y };
  if (md < '09-22') return { season: order[2], year: y };
  return { season: order[3], year: y };
}

export function seasonRange(season: Season, year: number, hemisphere: 'south' | 'north') {
  const order: Season[] = hemisphere === 'south' ? ['verao', 'outono', 'inverno', 'primavera'] : ['inverno', 'primavera', 'verao', 'outono'];
  const i = order.indexOf(season);
  if (i === 0) return { from: `${year}-12-21`, to: `${year + 1}-03-19` };
  return [
    { from: `${year}-03-20`, to: `${year}-06-20` },
    { from: `${year}-06-21`, to: `${year}-09-21` },
    { from: `${year}-09-22`, to: `${year}-12-20` },
  ][i - 1];
}

/** Cada estação de cada ano com registros, da mais recente para a mais antiga. */
export function seasonsRows(entries: Pick<MoodEntry, 'at' | 'valence'>[], hemisphere: 'south' | 'north'): Array<PeriodRow & { season: Season }> {
  const keys = new Map<string, { season: Season; year: number }>();
  for (const m of entries) {
    const s = seasonOf(m.at.slice(0, 10), hemisphere);
    keys.set(`${s.year}-${s.season}`, s);
  }
  return [...keys.values()]
    .map(({ season, year }) => {
      const r = seasonRange(season, year, hemisphere);
      const crosses = r.from.slice(0, 4) !== r.to.slice(0, 4);
      return { ...row(`${year}-${season}`, `${SEASON_LABELS[season]} ${crosses ? `${year}/${String(year + 1).slice(2)}` : year}`, r.from, r.to, entries), season };
    })
    .sort((a, b) => b.from.localeCompare(a.from));
}

/** As quatro estações somando todos os anos (peso igual por data). */
export function seasonsAll(entries: Pick<MoodEntry, 'at' | 'valence'>[], hemisphere: 'south' | 'north') {
  const order: Season[] = ['verao', 'outono', 'inverno', 'primavera'];
  return order.map((season) => {
    const list = entries.filter((m) => seasonOf(m.at.slice(0, 10), hemisphere).season === season);
    const years = new Set(list.map((m) => seasonOf(m.at.slice(0, 10), hemisphere).year)).size;
    return { season, years, ...valenceIndex(list) };
  });
}

export function yearsRows(entries: Pick<MoodEntry, 'at' | 'valence'>[]): PeriodRow[] {
  const years = [...new Set(entries.map((m) => m.at.slice(0, 4)))].sort().reverse();
  return years.map((y) => row(y, y, `${y}-01-01`, `${y}-12-31`, entries));
}
