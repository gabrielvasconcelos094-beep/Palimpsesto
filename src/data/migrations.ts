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
