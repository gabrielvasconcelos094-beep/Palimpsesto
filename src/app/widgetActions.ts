/** Ações enviadas pelos widgets e a rota que cada uma abre. */

/**
 * "mood/-2"…"mood/2": registro de humor com a valência (valor interno) já escolhida;
 * "mood/new": registro de humor sem valência; "experience"; "event".
 */
export function routeForWidgetAction(action: string): string | null {
  const m = /^mood\/(-[12]|0|[12]|new)$/.exec(action);
  if (m) return m[1] === 'new' ? '/?novo=humor' : `/?novo=humor&v=${m[1]}`;
  if (action === 'experience') return '/diario/experiencia/nova';
  if (action === 'event') return '/diario/acontecimento/novo';
  return null;
}

/** Valência vinda da URL, validada (−2…+2) ou null. */
export function parseValence(v: string | null): number | null {
  if (v === null || !/^(-[12]|0|[12])$/.test(v)) return null;
  return Number(v);
}
