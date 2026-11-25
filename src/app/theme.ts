import { useEffect, useMemo, useSyncExternalStore } from 'react';
import type { Preferences } from '../domain/schema';
import { resolveTokens } from '../theme/resolve';
import { tokensToCss, type Tokens } from '../theme/tokens';
import { syncStatusBar } from '../platform/lifecycle';

const mq = typeof matchMedia !== 'undefined' ? matchMedia('(prefers-color-scheme: dark)') : null;
export function useSystemDark() {
  return useSyncExternalStore(
    (l) => {
      mq?.addEventListener('change', l);
      return () => mq?.removeEventListener('change', l);
    },
    () => !!mq?.matches,
  );
}

export { resolveTokens };

export function applyTokens(t: Tokens, prefs: Preferences, target: HTMLElement = document.documentElement) {
  const vars = tokensToCss(t, {
    displayFont: prefs.displayFont === 'theme' ? undefined : prefs.displayFont,
    textScale: prefs.textScale,
  });
  for (const [k, v] of Object.entries(vars)) target.style.setProperty(k, v);
  if (target === document.documentElement) {
    target.dataset.dark = String(t.dark);
    target.dataset.reduceMotion = String(prefs.reduceMotion);
    // Estilo visual independente da paleta.
    target.dataset.style = prefs.visualStyle;
  }
}

export function useApplyTheme(prefs: Preferences) {
  const systemDark = useSystemDark();
  const tokens = useMemo(() => resolveTokens(prefs, systemDark), [prefs, systemDark]);
  useEffect(() => {
    applyTokens(tokens, prefs);
    void syncStatusBar(tokens.bg, tokens.dark);
  }, [tokens, prefs]);
  return tokens;
}
