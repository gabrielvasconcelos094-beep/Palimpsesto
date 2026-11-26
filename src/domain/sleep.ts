/**
 * Sono informado nos registros (horas da noite anterior, opcional).
 *
 * Por que: a duração e, sobretudo, a REGULARIDADE do sono acompanham o humor em
 * estudos com diários e EMA (ex.: Kaufmann et al., 2016, J Psychiatr Res, em transtorno
 * bipolar: a variabilidade da duração, mais que a média, acompanhou os sintomas), e mudanças de sono costumam aparecer entre os sinais de
 * alerta pessoais. Aqui tudo é descritivo: associação no mesmo dia, nunca causa.
 */
import type { MoodEntry } from './schema';
import { valenceIndex } from './valence';

export const SLEEP_MIN_NIGHTS = 5;
export const SLEEP_GROUP_MIN_DATES = 3;
export const SHORT_SLEEP = 6;
export const ENOUGH_SLEEP = 7;

/** Uma noite por data: o valor informado mais recente naquela data. */
export function nights(entries: MoodEntry[]): Array<{ day: string; hours: number }> {
  const by = new Map<string, { at: string; hours: number }>();
  for (const m of entries) {
    if (m.sleepHours == null) continue;
    const k = m.at.slice(0, 10);
    const cur = by.get(k);
    if (!cur || m.at > cur.at) by.set(k, { at: m.at, hours: m.sleepHours });
  }
  return [...by.entries()].map(([day, v]) => ({ day, hours: v.hours })).sort((a, b) => a.day.localeCompare(b.day));
}

export interface SleepSummary {
  nights: number;
  median: number | null;
  /** Desvio-padrão das horas entre as noites (regularidade: menor = mais regular). */
  sd: number | null;
  shortShare: number | null;
  /** Índice de valência nas datas após noites curtas (< 6 h) e após noites de 7 h ou mais. */
  short: { index: number | null; dates: number; records: number };
  enough: { index: number | null; dates: number; records: number };
  comparable: boolean;
}

export function sleepSummary(entries: MoodEntry[]): SleepSummary {
  const n = nights(entries);
  const hours = n.map((x) => x.hours).sort((a, b) => a - b);
  const mean = hours.reduce((a, b) => a + b, 0) / (hours.length || 1);
  const ok = n.length >= SLEEP_MIN_NIGHTS;
  const shortDays = new Set(n.filter((x) => x.hours < SHORT_SLEEP).map((x) => x.day));
  const enoughDays = new Set(n.filter((x) => x.hours >= ENOUGH_SLEEP).map((x) => x.day));
  const short = valenceIndex(entries.filter((m) => shortDays.has(m.at.slice(0, 10))));
  const enough = valenceIndex(entries.filter((m) => enoughDays.has(m.at.slice(0, 10))));
  return {
    nights: n.length,
    median: hours.length ? hours[Math.floor((hours.length - 1) / 2)] : null,
    sd: ok ? Math.sqrt(hours.reduce((a, b) => a + (b - mean) ** 2, 0) / hours.length) : null,
    shortShare: ok ? shortDays.size / n.length : null,
    short,
    enough,
    comparable: short.dates >= SLEEP_GROUP_MIN_DATES && enough.dates >= SLEEP_GROUP_MIN_DATES,
  };
}

export const fmtHours = (h: number | null) => (h === null ? '—' : `${h.toLocaleString('pt-BR', { maximumFractionDigits: 1 })} h`);
