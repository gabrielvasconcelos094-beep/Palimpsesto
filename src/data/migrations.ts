/**
 * Migrações de esquema.
 *
 * Cada função leva os dados da versão N para N+1. A mesma cadeia é usada
 * para o arquivo local e para backups importados, garantindo que um backup
 * antigo sempre possa ser restaurado por uma versão mais nova do app.
 *
 * Para criar a versão 2: incremente SCHEMA_VERSION em schema.ts e adicione
 * `1: (d) => ({ ...d, schemaVersion: 2, novoCampo: ... })` abaixo, com teste.
 */
import { SCHEMA_VERSION } from '../domain/schema';
import { toLocalAt } from '../domain/util';

type Migration = (data: any) => any;

export const MIGRATIONS: Record<number, Migration> = {
  /**
   * 1 → 2
   * - `at` (quando aconteceu) passa de instante UTC para hora local flutuante,
   *   usando o fuso do aparelho no momento da migração; nada muda de dia aqui.
   * - `timePrecision: 'exact'` para registros antigos (o horário era exato).
   * - Novos campos com valores vazios: atividades nos registros de humor,
   *   acontecimentos, vínculos de descobertas e novas preferências.
   */
  1: (d) => ({
    ...d,
    schemaVersion: 2,
    moodEntries: (d.moodEntries ?? []).map((m: any) => ({ ...m, at: toLocalAt(String(m.at)), timePrecision: m.timePrecision ?? 'exact', itemIds: m.itemIds ?? [] })),
    experiences: (d.experiences ?? []).map((x: any) => ({ ...x, at: toLocalAt(String(x.at)), timePrecision: x.timePrecision ?? 'exact' })),
    uses: (d.uses ?? []).map((u: any) => ({ ...u, at: toLocalAt(String(u.at)) })),
    discoveries: (d.discoveries ?? []).map((x: any) => ({ ...x, moodEntryIds: x.moodEntryIds ?? [], eventIds: x.eventIds ?? [] })),
    events: d.events ?? [],
  }),

  /**
   * 2 → 3 — o sono passa a ser UMA vez por noite.
   * Antes, a qualidade do sono (`indicators.sleep`) e as horas (`sleepHours`, 1.6)
   * ficavam em cada registro de humor; com vários registros no dia, a mesma noite
   * podia ser contada várias vezes. Agora vão para `sleepLogs`, uma por data:
   * de cada data, o valor do registro mais recente que o tinha (o último que você
   * informou). Os campos saem dos registros de humor; nada mais muda.
   */
  2: (d) => {
    const moods: any[] = d.moodEntries ?? [];
    const by = new Map<string, { hours: any; quality: any; hAt: string; qAt: string; createdAt: string }>();
    for (const m of moods) {
      const date = String(m.at ?? '').slice(0, 10);
      if (!/^\d{4}-\d{2}-\d{2}$/.test(date)) continue;
      const q = m.indicators?.sleep;
      const h = m.sleepHours;
      if (q == null && h == null) continue;
      const cur = by.get(date) ?? { hours: null, quality: null, hAt: '', qAt: '', createdAt: m.createdAt };
      if (h != null && String(m.at) >= cur.hAt) Object.assign(cur, { hours: h, hAt: String(m.at) });
      if (q != null && String(m.at) >= cur.qAt) Object.assign(cur, { quality: q, qAt: String(m.at) });
      by.set(date, cur);
    }
    const now = new Date().toISOString();
    const sleepLogs = [...(d.sleepLogs ?? [])];
    const have = new Set(sleepLogs.map((s: any) => s.date));
    for (const [date, v] of by) {
      if (have.has(date)) continue;
      sleepLogs.push({ id: `sleep-${date}`, createdAt: v.createdAt ?? now, updatedAt: now, date, hours: v.hours, quality: v.quality, troubles: [], note: '' });
    }
    const prefs = { ...d.preferences };
    const enabled: string[] = prefs.enabledIndicators ?? [];
    prefs.trackSleep = Boolean(prefs.trackSleep || prefs.trackSleepHours || enabled.includes('sleep'));
    prefs.enabledIndicators = enabled.filter((k) => k !== 'sleep');
    delete prefs.trackSleepHours;
    return {
      ...d,
      schemaVersion: 3,
      moodEntries: moods.map((m: any) => {
        const { sleepHours: _h, ...rest } = m;
        const ind = { ...m.indicators };
        delete ind.sleep;
        return { ...rest, indicators: ind };
      }),
      sleepLogs,
      preferences: prefs,
    };
  },
};

export class NewerSchemaError extends Error {
  constructor(public found: number) {
    super(
      `Estes dados foram criados por uma versão mais nova do Palimpsesto (esquema ${found}). Atualize o aplicativo para abri-los.`,
    );
  }
}

export class UnknownSchemaError extends Error {
  constructor() {
    super('Não foi possível identificar a versão do esquema destes dados.');
  }
}

export function migrate(raw: any, target = SCHEMA_VERSION, migrations = MIGRATIONS): { data: any; from: number } {
  if (!raw || typeof raw !== 'object') throw new UnknownSchemaError();
  const from = Number(raw.schemaVersion);
  if (!Number.isInteger(from) || from < 1) throw new UnknownSchemaError();
  if (from > target) throw new NewerSchemaError(from);
  let data = raw;
  for (let v = from; v < target; v++) {
    const m = migrations[v];
    if (!m) throw new Error(`Migração ausente da versão ${v} para ${v + 1}.`);
    data = m(data);
    if (data.schemaVersion !== v + 1) throw new Error(`Migração ${v}→${v + 1} não atualizou schemaVersion.`);
  }
  return { data, from };
}
