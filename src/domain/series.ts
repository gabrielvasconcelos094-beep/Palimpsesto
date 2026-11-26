/**
 * Séries temporais de humor e energia para o gráfico em linha.
 *
 * Cuidados (escala ordinal, ver docs/ARQUITETURA.md §4):
 * - Resumo por data: o mesmo "resultado do dia" do calendário (`dayResult`, em valence.ts):
 *   média dos registros da data arredondada ao nível mais próximo (empate → longe do centro).
 *   É só a forma de desenhar a data; os registros originais continuam consultáveis.
 * - Ausência de registro não é humor neutro: a linha é INTERROMPIDA quando há uma lacuna
 *   maior que `GAP_DAYS` (por padrão, mais de 3 dias sem registros).
 * - Humor e energia usam o mesmo eixo de 5 níveis (1…5): humor = valência + 3.
 */
import type { MoodEntry } from './schema';
import { dayResult } from './valence';

export const GAP_DAYS = 3;
const DAY_MS = 86400000;

export type SeriesMode = 'record' | 'day';

export interface SeriesPoint {
  /** Instante (ms) em hora local; registros "sem horário" ficam ao meio-dia. */
  t: number;
  day: string;
  /** Nível 1…5 (valência + 3); null se não houver. */
  mood: number | null;
  /** Nível 1…5; null se não houver. */
  energy: number | null;
  records: number;
  /** Registros que compõem o ponto (um por registro; vários no resumo por data). */
  ids: string[];
  /** Horário aproximado ou ausente (para o texto do detalhe). */
  precision: MoodEntry['timePrecision'];
  at: string;
  emotionIds: string[];
}

/** Mediana ordinal: a categoria do meio (em número par, a inferior). */
export function lowerMedian(values: number[]): number | null {
  if (!values.length) return null;
  const s = [...values].sort((a, b) => a - b);
  return s[Math.floor((s.length - 1) / 2)];
}

const timeOf = (m: Pick<MoodEntry, 'at' | 'timePrecision'>) => {
  const day = m.at.slice(0, 10);
  return new Date(m.timePrecision === 'day' ? `${day}T12:00:00` : m.at).getTime();
};

/** Um ponto por registro, em ordem cronológica. */
export function recordSeries(entries: MoodEntry[]): SeriesPoint[] {
  return [...entries]
    .sort((a, b) => timeOf(a) - timeOf(b) || a.createdAt.localeCompare(b.createdAt))
    .map((m) => ({
      t: timeOf(m),
      day: m.at.slice(0, 10),
      mood: m.valence + 3,
      energy: m.energy,
      records: 1,
      ids: [m.id],
      precision: m.timePrecision,
      at: m.at,
      emotionIds: m.emotionIds,
    }));
}

/** Um ponto por data (meio-dia): resultado do dia para humor e energia (ver `dayResult`). */
export function daySeries(entries: MoodEntry[]): SeriesPoint[] {
  const by = new Map<string, MoodEntry[]>();
  for (const m of entries) by.set(m.at.slice(0, 10), [...(by.get(m.at.slice(0, 10)) ?? []), m]);
  return [...by.entries()]
    .sort((a, b) => a[0].localeCompare(b[0]))
    .map(([day, list]) => {
      const sorted = [...list].sort((a, b) => a.at.localeCompare(b.at));
      return {
        t: new Date(`${day}T12:00:00`).getTime(),
        day,
        mood: dayResult(list.map((m) => m.valence + 3), 3),
        energy: dayResult(list.filter((m) => m.energy).map((m) => m.energy as number), 3),
        records: list.length,
        ids: sorted.map((m) => m.id),
        precision: 'day' as const,
        at: `${day}T12:00:00`,
        emotionIds: [...new Set(list.flatMap((m) => m.emotionIds))],
      };
    });
}

export function buildSeries(entries: MoodEntry[], mode: SeriesMode): SeriesPoint[] {
  return mode === 'record' ? recordSeries(entries) : daySeries(entries);
}

export interface Segment {
  /** Pontos consecutivos sem lacuna grande entre eles. */
  points: Array<{ t: number; v: number; point: SeriesPoint }>;
}

/** Divide a série de `key` em trechos; uma lacuna > gapDays interrompe a linha. */
export function segments(points: SeriesPoint[], key: 'mood' | 'energy', gapDays = GAP_DAYS): Segment[] {
  const out: Segment[] = [];
  let cur: Segment | null = null;
  let lastT = 0;
  for (const p of points) {
    const v = p[key];
    if (v === null) continue; // sem esse dado: o ponto não entra nesta linha, e a lacuna é medida pelo último que entrou
    if (!cur || p.t - lastT > gapDays * DAY_MS) {
      cur = { points: [] };
      out.push(cur);
    }
    cur.points.push({ t: p.t, v, point: p });
    lastT = p.t;
  }
  return out;
}

/** Quantas lacunas (> gapDays) interrompem a linha. */
export function gapCount(points: SeriesPoint[], key: 'mood' | 'energy', gapDays = GAP_DAYS): number {
  return Math.max(0, segments(points, key, gapDays).length - 1);
}

/** Pontos de uma linha com a variação em relação ao ponto anterior (para descrever oscilações). */
export function changes(points: SeriesPoint[], key: 'mood' | 'energy', gapDays = GAP_DAYS) {
  let up = 0;
  let down = 0;
  let same = 0;
  for (const seg of segments(points, key, gapDays))
    for (let i = 1; i < seg.points.length; i++) {
      const d = seg.points[i].v - seg.points[i - 1].v;
      if (d > 0) up++;
      else if (d < 0) down++;
      else same++;
    }
  return { up, down, same, total: up + down + same };
}

/** Marcas do eixo do tempo: poucos rótulos, em passos "redondos" de dias. */
export function timeTicks(fromMs: number, toMs: number, maxTicks = 5): number[] {
  const days = Math.max(1, Math.round((toMs - fromMs) / DAY_MS));
  const steps = [1, 2, 3, 7, 14, 30, 60, 91, 182, 365];
  const step = steps.find((s) => days / s <= maxTicks) ?? 365;
  const ticks: number[] = [];
  const start = new Date(fromMs);
  start.setHours(12, 0, 0, 0);
  for (let t = start.getTime(); t <= toMs; ) {
    ticks.push(t);
    const d = new Date(t);
    d.setDate(d.getDate() + step);
    t = d.getTime();
  }
  return ticks;
}
