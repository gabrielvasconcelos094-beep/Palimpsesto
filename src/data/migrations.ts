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

type Migration = (data: any) => any;

export const MIGRATIONS: Record<number, Migration> = {
  // 1: (d) => ({ ...d, schemaVersion: 2 }),
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
