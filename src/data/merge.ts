/**
 * Mesclagem de dados importados com os dados atuais.
 * Registros são comparados pelo id (o mesmo registro em duas instalações
 * tem o mesmo id, pois ids são gerados uma única vez).
 */
import { COLLECTIONS, type AppData, type CollectionName } from '../domain/schema';
import { canonicalJson } from './crypto';
import { repairIntegrity } from './validate';

export type DuplicateStrategy = 'newest' | 'keepCurrent' | 'preferImported';

export interface MergeReport {
  perCollection: Record<CollectionName, { added: number; updated: number; kept: number; identical: number }>;
  totalAdded: number;
  totalUpdated: number;
}

export function mergeData(
  current: AppData,
  incoming: AppData,
  strategy: DuplicateStrategy,
  opts: { importPreferences?: boolean } = {},
): { data: AppData; report: MergeReport } {
  const out: any = { ...current };
  const perCollection = {} as MergeReport['perCollection'];
  let totalAdded = 0;
  let totalUpdated = 0;

  for (const c of COLLECTIONS) {
    const stats = { added: 0, updated: 0, kept: 0, identical: 0 };
    const map = new Map<string, any>(((current as any)[c] as any[]).map((e) => [e.id, e]));
    for (const inc of (incoming as any)[c] as any[]) {
      const cur = map.get(inc.id);
      if (!cur) {
        map.set(inc.id, inc);
        stats.added++;
        continue;
      }
      if (canonicalJson(cur) === canonicalJson(inc)) {
        stats.identical++;
        continue;
      }
      const takeIncoming =
        strategy === 'preferImported' || (strategy === 'newest' && (inc.updatedAt ?? '') > (cur.updatedAt ?? ''));
      if (takeIncoming) {
        map.set(inc.id, inc);
        stats.updated++;
      } else stats.kept++;
    }
    out[c] = [...map.values()];
    perCollection[c] = stats;
    totalAdded += stats.added;
    totalUpdated += stats.updated;
  }

  // Preferências: temas personalizados sempre são mesclados; o restante só se pedido.
  const themes = new Map(current.preferences.customThemes.map((t) => [t.id, t]));
  for (const t of incoming.preferences.customThemes) {
    const cur = themes.get(t.id);
    if (!cur || strategy === 'preferImported' || (strategy === 'newest' && t.updatedAt > cur.updatedAt)) themes.set(t.id, t);
  }
  const basePrefs = opts.importPreferences ? incoming.preferences : current.preferences;
  out.preferences = { ...basePrefs, customThemes: [...themes.values()] };

  const { data } = repairIntegrity(out as AppData);
  return { data, report: { perCollection, totalAdded, totalUpdated } };
}
