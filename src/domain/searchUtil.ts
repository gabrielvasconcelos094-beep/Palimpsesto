import type { Letter } from './schema';
import { dayKey } from './util';
export { fold } from './util';

/** Cartas lacradas não revelam o conteúdo na busca. */
export function isRetroSafe(l: Letter): boolean {
  return l.sealed && !!l.openAt && !l.openedAt && l.openAt.slice(0, 10) > dayKey(new Date());
}
