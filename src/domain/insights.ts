/**
 * Estatísticas descritivas da Trajetória.
 *
 * Cuidados metodológicos (ver docs/ARQUITETURA.md §4):
 * - A valência é ordinal: usamos contagens e proporções, nunca médias.
 * - "Agradável" = categorias +1 e +2; "desagradável" = −1 e −2.
 * - Ausência de registro NÃO é humor neutro: dias sem registro ficam de fora.
 * - Dias da semana: por padrão cada DATA pesa o mesmo (proporção calculada em
 *   cada data e depois combinada), para que um dia com muitos registros não
 *   domine. A contagem por registro também é oferecida, e a unidade é sempre
 *   informada.
 * - Comparações só são apresentadas quando há dados mínimos e uma diferença
 *   mínima; caso contrário, dizemos que ainda não há observações suficientes.
 */
import type { AppData, MoodEntry, StrategyUse } from './schema';
import { addDays, dayKey } from './util';
import { outcomeCounts } from './analytics';

export type Counts5 = [number, number, number, number, number];
const z5 = (): Counts5 => [0, 0, 0, 0, 0];
export const isPleasant = (v: number) => v >= 1;
export const isUnpleasant = (v: number) => v <= -1;
const dayOf = (m: { at: string }) => m.at.slice(0, 10);
const wdOf = (day: string) => new Date(day + 'T12:00:00').getDay();
const pct = (x: number) => `${Math.round(x * 100)}%`;

export const WEEKDAYS_FULL = ['domingo', 'segunda-feira', 'terça-feira', 'quarta-feira', 'quinta-feira', 'sexta-feira', 'sábado'];
export const WEEKDAYS_SHORT = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];

/* ------------------------------------------------------------------------ */
/* Unidade de análise                                                        */
/* ------------------------------------------------------------------------ */
export type Unit = 'day' | 'record';

/**
 * Proporção de registros que satisfazem `pred`:
 * - por registro: (registros que satisfazem) / (registros);
 * - por dia: média, entre as datas, da proporção dentro de cada data.
 */
export function shareBy(entries: MoodEntry[], pred: (m: MoodEntry) => boolean, unit: Unit): number {
  if (!entries.length) return 0;
  if (unit === 'record') return entries.filter(pred).length / entries.length;
  const byDay = new Map<string, MoodEntry[]>();
  for (const m of entries) byDay.set(dayOf(m), [...(byDay.get(dayOf(m)) ?? []), m]);
  let acc = 0;
  for (const list of byDay.values()) acc += list.filter(pred).length / list.length;
  return acc / byDay.size;
}

/** Distribuição das 5 categorias (proporções) por registro ou por dia. */
export function distributionBy(values: Array<{ day: string; v: number }>, unit: Unit): Counts5 {
  const out = z5();
  if (!values.length) return out;
  if (unit === 'record') {
    values.forEach((x) => out[x.v]++);
    return out.map((c) => c / values.length) as Counts5;
  }
  const byDay = new Map<string, number[]>();
  values.forEach((x) => byDay.set(x.day, [...(byDay.get(x.day) ?? []), x.v]));
  for (const list of byDay.values()) list.forEach((v) => (out[v] += 1 / list.length / byDay.size));
  return out;
}

/* ------------------------------------------------------------------------ */
/* Dias da semana                                                            */
/* ------------------------------------------------------------------------ */
export const WEEKDAY_MIN_DATES = 3;
export const WEEKDAY_MIN_ELIGIBLE = 4;
export const WEEKDAY_MIN_GAP = 0.1;

export interface WeekdayStat {
  wd: number;
  records: number;
  dates: number;
  valence: Counts5; // contagens por registro
  energy: Counts5;
  entries: MoodEntry[];
  topEmotions: Array<{ id: string; count: number }>;
}

export function weekdayStats(entries: MoodEntry[]): WeekdayStat[] {
  return Array.from({ length: 7 }, (_, wd) => {
    const list = entries.filter((m) => wdOf(dayOf(m)) === wd);
    const valence = z5();
    const energy = z5();
    const emo = new Map<string, number>();
    for (const m of list) {
      valence[m.valence + 2]++;
      if (m.energy) energy[m.energy - 1]++;
      m.emotionIds.forEach((e) => emo.set(e, (emo.get(e) ?? 0) + 1));
    }
    return {
      wd,
      records: list.length,
      dates: new Set(list.map(dayOf)).size,
      valence,
      energy,
      entries: list,
      topEmotions: [...emo.entries()].map(([id, count]) => ({ id, count })).sort((a, b) => b.count - a.count).slice(0, 3),
    };
  });
}

export interface Highlight {
  key: string;
  label: string;
  share: number;
  runnerUpLabel: string | null;
  runnerUpShare: number | null;
  records: number;
  dates: number;
  unit: Unit;
  totalRecords: number;
  totalDates: number;
}

export type Verdict = { ok: true; h: Highlight } | { ok: false; reason: string };

/**
 * Qual dia da semana tem a maior proporção de registros que satisfazem `pred`.
 * Só responde se houver dias suficientes e uma diferença mínima para o segundo.
 */
export function weekdayHighlight(entries: MoodEntry[], pred: (m: MoodEntry) => boolean, unit: Unit = 'day', base: MoodEntry[] = entries): Verdict {
  const stats = weekdayStats(base).filter((s) => s.dates >= WEEKDAY_MIN_DATES);
  if (stats.length < WEEKDAY_MIN_ELIGIBLE)
    return {
      ok: false,
      reason: `Ainda não há observações suficientes: é preciso ter registros em pelo menos ${WEEKDAY_MIN_ELIGIBLE} dias da semana diferentes, cada um com ${WEEKDAY_MIN_DATES} datas ou mais.`,
    };
  const ranked = stats.map((s) => ({ s, share: shareBy(s.entries, pred, unit) })).sort((a, b) => b.share - a.share);
  const [top, second] = ranked;
  if (top.share === 0) return { ok: false, reason: 'Nenhum registro deste tipo entre os dias com dados suficientes.' };
  if (top.share - second.share < WEEKDAY_MIN_GAP)
    return { ok: false, reason: `Não há diferença clara entre os dias (menos de ${Math.round(WEEKDAY_MIN_GAP * 100)} pontos percentuais entre o primeiro e o segundo).` };
  return {
    ok: true,
    h: {
      key: String(top.s.wd),
      label: WEEKDAYS_FULL[top.s.wd],
      share: top.share,
      runnerUpLabel: WEEKDAYS_FULL[second.s.wd],
      runnerUpShare: second.share,
      records: top.s.records,
      dates: top.s.dates,
      unit,
      totalRecords: base.length,
      totalDates: new Set(base.map(dayOf)).size,
    },
  };
}

/* ------------------------------------------------------------------------ */
/* Períodos do dia                                                           */
/* ------------------------------------------------------------------------ */
export const DAY_PARTS = [
  { key: 'dawn', label: 'Madrugada', from: 0, to: 5 },
  { key: 'morning', label: 'Manhã', from: 6, to: 11 },
  { key: 'afternoon', label: 'Tarde', from: 12, to: 17 },
  { key: 'evening', label: 'Noite', from: 18, to: 23 },
] as const;

export function partOf(at: string) {
  const h = Number(at.slice(11, 13));
  return DAY_PARTS.find((p) => h >= p.from && h <= p.to)!;
}

export function dayPartStats(entries: MoodEntry[]) {
  const timed = entries.filter((m) => m.timePrecision !== 'day');
  return {
    untimed: entries.length - timed.length,
    parts: DAY_PARTS.map((p) => {
      const list = timed.filter((m) => partOf(m.at).key === p.key);
      const valence = z5();
      list.forEach((m) => valence[m.valence + 2]++);
      return { ...p, records: list.length, dates: new Set(list.map(dayOf)).size, valence, entries: list };
    }),
  };
}

/** Variação dentro de um mesmo dia (datas com 2+ registros com horário). */
export function withinDay(entries: MoodEntry[]) {
  const byDay = new Map<string, MoodEntry[]>();
  for (const m of entries.filter((x) => x.timePrecision !== 'day')) byDay.set(dayOf(m), [...(byDay.get(dayOf(m)) ?? []), m]);
  let days = 0;
  let varied = 0;
  let up = 0;
  let down = 0;
  let same = 0;
  for (const list of byDay.values()) {
    if (list.length < 2) continue;
    days++;
    const sorted = [...list].sort((a, b) => a.at.localeCompare(b.at));
    const vals = sorted.map((m) => m.valence);
    if (Math.max(...vals) - Math.min(...vals) >= 1) varied++;
    const d = vals[vals.length - 1] - vals[0];
    if (d > 0) up++;
    else if (d < 0) down++;
    else same++;
  }
  return { days, varied, up, down, same };
}

/* ------------------------------------------------------------------------ */
/* Emoções                                                                   */
/* ------------------------------------------------------------------------ */
export function emotionCounts(entries: MoodEntry[]) {
  const m = new Map<string, number>();
  entries.forEach((e) => new Set(e.emotionIds).forEach((id) => m.set(id, (m.get(id) ?? 0) + 1)));
  return [...m.entries()].map(([id, count]) => ({ id, count, share: entries.length ? count / entries.length : 0 })).sort((a, b) => b.count - a.count);
}

export interface Pair {
  a: string;
  b: string;
  together: number;
  either: number;
}
/** Emoções que aparecem juntas: vezes juntas e registros com qualquer uma das duas. */
export function emotionPairs(entries: MoodEntry[], min = 2): Pair[] {
  const counts = new Map<string, number>();
  const single = new Map<string, number>();
  for (const e of entries) {
    const ids = [...new Set(e.emotionIds)].sort();
    ids.forEach((id) => single.set(id, (single.get(id) ?? 0) + 1));
    for (let i = 0; i < ids.length; i++) for (let j = i + 1; j < ids.length; j++) counts.set(`${ids[i]}|${ids[j]}`, (counts.get(`${ids[i]}|${ids[j]}`) ?? 0) + 1);
  }
  return [...counts.entries()]
    .filter(([, n]) => n >= min)
    .map(([k, together]) => {
      const [a, b] = k.split('|');
      return { a, b, together, either: (single.get(a) ?? 0) + (single.get(b) ?? 0) - together };
    })
    .sort((x, y) => y.together - x.together || y.together / y.either - x.together / x.either);
}

/** Frequência das emoções por mês (últimos `months` meses com registros). */
export function emotionsByMonth(entries: MoodEntry[], ids: string[], months = 6) {
  const keys = [...new Set(entries.map((m) => m.at.slice(0, 7)))].sort().slice(-months);
  return {
    months: keys,
    rows: ids.map((id) => ({
      id,
      values: keys.map((k) => {
        const list = entries.filter((m) => m.at.startsWith(k));
        const n = list.filter((m) => m.emotionIds.includes(id)).length;
        return { n, total: list.length };
      }),
    })),
  };
}

/* ------------------------------------------------------------------------ */
/* Energia                                                                   */
/* ------------------------------------------------------------------------ */
export function energyValenceTable(entries: MoodEntry[]): number[][] {
  const t = Array.from({ length: 5 }, () => [0, 0, 0, 0, 0]);
  entries.forEach((m) => m.energy && t[m.energy - 1][m.valence + 2]++);
  return t;
}

export function extremesOfEnergy(entries: MoodEntry[]) {
  const days = (e: number) => [...new Set(entries.filter((m) => m.energy === e).map(dayOf))].sort().reverse();
  return { highest: days(5), lowest: days(1) };
}

export function monthlyCount(entries: MoodEntry[], pred: (m: MoodEntry) => boolean, months = 6) {
  const keys = [...new Set(entries.map((m) => m.at.slice(0, 7)))].sort().slice(-months);
  return keys.map((k) => {
    const list = entries.filter((m) => m.at.startsWith(k));
    return { month: k, n: list.filter(pred).length, total: list.length };
  });
}

/* ------------------------------------------------------------------------ */
/* Atividades e estratégias                                                  */
/* ------------------------------------------------------------------------ */
export const ACTIVITY_MIN = 5;

export interface ActivityStat {
  itemId: string;
  records: number;
  dates: number;
  pleasantShare: number;
  unpleasantShare: number;
  othersPleasantShare: number;
  othersRecords: number;
  /** Comparação com o registro anterior no mesmo dia (quando existe). */
  change: { compared: number; up: number; same: number; down: number };
}

export function activityStats(entries: MoodEntry[]): ActivityStat[] {
  const ids = new Set(entries.flatMap((m) => m.itemIds));
  const byDay = new Map<string, MoodEntry[]>();
  entries.filter((m) => m.timePrecision !== 'day').forEach((m) => byDay.set(dayOf(m), [...(byDay.get(dayOf(m)) ?? []), m]));
  byDay.forEach((l) => l.sort((a, b) => a.at.localeCompare(b.at)));
  return [...ids]
    .map((itemId) => {
      const withIt = entries.filter((m) => m.itemIds.includes(itemId));
      const others = entries.filter((m) => !m.itemIds.includes(itemId));
      const change = { compared: 0, up: 0, same: 0, down: 0 };
      for (const m of withIt) {
        const list = byDay.get(dayOf(m));
        if (!list) continue;
        const i = list.indexOf(m);
        if (i <= 0) continue;
        const prev = list[i - 1];
        change.compared++;
        if (m.valence > prev.valence) change.up++;
        else if (m.valence < prev.valence) change.down++;
        else change.same++;
      }
      return {
        itemId,
        records: withIt.length,
        dates: new Set(withIt.map(dayOf)).size,
        pleasantShare: withIt.filter((m) => isPleasant(m.valence)).length / withIt.length,
        unpleasantShare: withIt.filter((m) => isUnpleasant(m.valence)).length / withIt.length,
        othersPleasantShare: others.length ? others.filter((m) => isPleasant(m.valence)).length / others.length : 0,
        othersRecords: others.length,
        change,
      };
    })
    .sort((a, b) => b.records - a.records);
}

export type StrategyGroup = 'effective' | 'partial' | 'ineffective' | 'unknown';
/** Agrupa itens pelas avaliações registradas (a mais frequente; empate → mais cautelosa). */
export function strategyGroups(uses: StrategyUse[]) {
  const byItem = new Map<string, StrategyUse[]>();
  uses.forEach((u) => byItem.set(u.itemId, [...(byItem.get(u.itemId) ?? []), u]));
  return [...byItem.entries()].map(([itemId, list]) => {
    const c = outcomeCounts(list);
    const evaluated = c.worked + c.partial + c.didnt + c.worse;
    let group: StrategyGroup = 'unknown';
    if (evaluated) {
      const neg = c.didnt + c.worse;
      if (neg >= c.worked && neg >= c.partial) group = 'ineffective';
      else if (c.partial >= c.worked) group = 'partial';
      else group = 'effective';
    }
    return { itemId, uses: list.length, evaluated, counts: c, group };
  });
}

/** Itens usados em momentos difíceis: usos marcados "dia difícil", em experiências desagradáveis ou em registros desagradáveis. */
export function difficultMoments(data: AppData, entries: MoodEntry[], uses: StrategyUse[]) {
  const counts = new Map<string, number>();
  const add = (id: string) => counts.set(id, (counts.get(id) ?? 0) + 1);
  const hardExp = new Set(data.experiences.filter((x) => x.feelingBefore !== null && x.feelingBefore <= -1).map((x) => x.id));
  uses.forEach((u) => {
    if (u.tags.some((t) => t.toLowerCase().includes('difíc') || t.toLowerCase().includes('dific')) || (u.experienceId && hardExp.has(u.experienceId))) add(u.itemId);
  });
  entries.filter((m) => isUnpleasant(m.valence)).forEach((m) => m.itemIds.forEach(add));
  return [...counts.entries()].map(([itemId, n]) => ({ itemId, n })).sort((a, b) => b.n - a.n);
}

/* ------------------------------------------------------------------------ */
/* Evolução                                                                  */
/* ------------------------------------------------------------------------ */
export function weeklyUnpleasant(entries: MoodEntry[], weekStartsOn: 0 | 1 = 1, min = 3) {
  const byWeek = new Map<string, MoodEntry[]>();
  for (const m of entries) {
    const d = new Date(dayOf(m) + 'T12:00:00');
    const diff = (d.getDay() - weekStartsOn + 7) % 7;
    const k = dayKey(addDays(d, -diff));
    byWeek.set(k, [...(byWeek.get(k) ?? []), m]);
  }
  return [...byWeek.entries()]
    .filter(([, l]) => l.length >= min)
    .map(([week, l]) => ({ week, records: l.length, unpleasant: l.filter((m) => isUnpleasant(m.valence)).length, share: l.filter((m) => isUnpleasant(m.valence)).length / l.length }))
    .sort((a, b) => b.share - a.share || b.records - a.records);
}

/* ------------------------------------------------------------------------ */
/* Regularidade                                                              */
/* ------------------------------------------------------------------------ */
export function regularity(entries: MoodEntry[], from: string, to: string) {
  const dates = new Set(entries.map(dayOf));
  const span = Math.round((new Date(to + 'T12:00:00').getTime() - new Date(from + 'T12:00:00').getTime()) / 86400000) + 1;
  const hours = new Array(24).fill(0);
  entries.forEach((m) => hours[new Date(m.createdAt).getHours()]++);
  const retro = entries.filter((m) => dayKey(m.createdAt) > dayOf(m)).length;
  return { span, withRecords: dates.size, without: Math.max(0, span - dates.size), hours, retro };
}

export function countsByWeek(entries: MoodEntry[], weeks: number, now = new Date(), weekStartsOn: 0 | 1 = 1) {
  const out: Array<{ start: string; n: number }> = [];
  const d = new Date(now);
  const diff = (d.getDay() - weekStartsOn + 7) % 7;
  const thisWeek = addDays(d, -diff);
  for (let i = weeks - 1; i >= 0; i--) {
    const start = dayKey(addDays(thisWeek, -7 * i));
    const end = dayKey(addDays(thisWeek, -7 * i + 6));
    out.push({ start, n: entries.filter((m) => dayOf(m) >= start && dayOf(m) <= end).length });
  }
  return out;
}

/* ------------------------------------------------------------------------ */
/* "O que seus registros mostram"                                            */
/* ------------------------------------------------------------------------ */
export interface Insight {
  id: string;
  text: string;
  basis: string;
  /** Texto sugerido caso o usuário queira transformar em hipótese. */
  hypothesis: string;
}

export function buildInsights(data: AppData, entries: MoodEntry[], uses: StrategyUse[], now = new Date()): Insight[] {
  const out: Insight[] = [];
  const emo = new Map(data.emotions.map((e) => [e.id, e.label.toLowerCase()]));
  const items = new Map(data.repertoire.map((i) => [i.id, i.name]));

  const best = weekdayHighlight(entries, (m) => isPleasant(m.valence), 'day');
  if (best.ok)
    out.push({
      id: `wd-pleasant|${best.h.key}`,
      text: `Nos registros disponíveis, ${best.h.label} teve a maior proporção de avaliações agradáveis (${pct(best.h.share)}, contra ${pct(best.h.runnerUpShare!)} em ${best.h.runnerUpLabel}).`,
      basis: `${best.h.records} registro(s) em ${best.h.dates} data(s) nesse dia da semana; cada data pesa o mesmo. Descreve os dados, não estabelece um “melhor dia”.`,
      hypothesis: `Talvez ${best.h.label} costume ser um dia mais leve para mim.`,
    });

  const withEnergy = entries.filter((m) => m.energy);
  const low = weekdayHighlight(withEnergy, (m) => (m.energy ?? 5) <= 2, 'day');
  if (low.ok)
    out.push({
      id: `wd-lowenergy|${low.h.key}`,
      text: `${low.h.label.replace(/^./, (c) => c.toUpperCase())} concentrou a maior proporção de registros de baixa energia (${pct(low.h.share)}).`,
      basis: `${low.h.records} registro(s) com energia em ${low.h.dates} data(s); cada data pesa o mesmo.`,
      hypothesis: `Minha energia costuma estar mais baixa às ${low.h.label}s.`,
    });

  for (const a of activityStats(entries).filter((x) => x.records >= ACTIVITY_MIN && x.othersRecords >= ACTIVITY_MIN)) {
    if (a.pleasantShare - a.othersPleasantShare >= 0.2) {
      const name = items.get(a.itemId) ?? 'Uma atividade';
      out.push({
        id: `act-pleasant|${a.itemId}`,
        text: `“${name}” apareceu com frequência nos seus registros agradáveis: ${pct(a.pleasantShare)} dos registros com ela foram agradáveis, contra ${pct(a.othersPleasantShare)} nos demais.`,
        basis: `${a.records} registro(s) com a atividade em ${a.dates} data(s), comparados a ${a.othersRecords} sem ela. É uma associação, não um efeito comprovado.`,
        hypothesis: `${name} costuma estar presente em momentos agradáveis para mim.`,
      });
    }
  }

  const unpleasant = entries.filter((m) => isUnpleasant(m.valence));
  const pair = emotionPairs(unpleasant, 3).find((p) => p.together / p.either >= 0.3);
  if (pair) {
    const a = emo.get(pair.a) ?? '?';
    const b = emo.get(pair.b) ?? '?';
    out.push({
      id: `pair-unpleasant|${pair.a}|${pair.b}`,
      text: `Nos registros desagradáveis, ${a} e ${b} apareceram juntas ${pair.together} vez(es) — em ${pct(pair.together / pair.either)} dos registros em que alguma das duas apareceu.`,
      basis: `${unpleasant.length} registro(s) desagradável(is) considerados.`,
      hypothesis: `Quando estou mal, ${a} e ${b} costumam vir juntas.`,
    });
  }

  // Baixa energia: últimos 30 dias × 30 anteriores (por registro, ambos com 8+ registros com energia).
  const d30 = dayKey(addDays(now, -29));
  const d60 = dayKey(addDays(now, -59));
  const recent = withEnergy.filter((m) => dayOf(m) >= d30);
  const before = withEnergy.filter((m) => dayOf(m) >= d60 && dayOf(m) < d30);
  if (recent.length >= 8 && before.length >= 8) {
    const r = recent.filter((m) => m.energy! <= 2).length / recent.length;
    const b = before.filter((m) => m.energy! <= 2).length / before.length;
    if (Math.abs(r - b) >= 0.15)
      out.push({
        id: `lowenergy-30|${dayKey(now).slice(0, 7)}|${r > b ? 'up' : 'down'}`,
        text: `Seus registros de baixa energia foram ${r > b ? 'mais' : 'menos'} frequentes nos últimos 30 dias (${pct(r)}) do que nos 30 anteriores (${pct(b)}).`,
        basis: `${recent.length} e ${before.length} registros com energia, respectivamente.`,
        hypothesis: `Minha energia tem estado ${r > b ? 'mais baixa' : 'melhor'} ultimamente.`,
      });
  }

  for (const g of strategyGroups(uses).filter((x) => x.evaluated >= 3 && x.group === 'effective')) {
    const name = items.get(g.itemId) ?? 'Uma estratégia';
    out.push({
      id: `strategy|${g.itemId}`,
      text: `Você avaliou “${name}” como eficaz na maior parte das vezes (${g.counts.worked} de ${g.evaluated} avaliações).`,
      basis: `Avaliações registradas por você nos usos dessa estratégia.`,
      hypothesis: `${name} costuma me ajudar.`,
    });
  }

  const dismissed = new Set(data.preferences.dismissedInsights);
  return out.filter((i) => !dismissed.has(i.id));
}
