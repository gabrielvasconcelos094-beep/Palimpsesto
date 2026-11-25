import { useEffect, useMemo, useSyncExternalStore } from 'react';
import type { Preferences } from '../domain/schema';
import { DEFAULT_THEME_ID, findPreset, PRESET_THEMES } from '../theme/presets';
import { deriveTokens, tokensToCss, type Tokens } from '../theme/tokens';
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

/** Resolve o tema efetivo (predefinido ou personalizado, claro ou escuro). */
export function resolveTokens(prefs: Preferences, systemDark: boolean): Tokens {
  const custom = prefs.customThemes.find((t) => t.id === prefs.themeId);
  if (custom) return deriveTokens(custom.colors, custom).tokens;
  const preset = findPreset(prefs.themeId) ?? findPreset(DEFAULT_THEME_ID) ?? PRESET_THEMES[0];
  const dark = prefs.appearance === 'dark' || (prefs.appearance === 'system' && systemDark);
  return deriveTokens(dark ? preset.dark : preset.light, preset, preset.mood?.[dark ? 'dark' : 'light']).tokens;
}

export function applyTokens(t: Tokens, prefs: Preferences, target: HTMLElement = document.documentElement) {
  const vars = tokensToCss(t, {
    displayFont: prefs.displayFont === 'theme' ? undefined : prefs.displayFont,
    textScale: prefs.textScale,
  });
  for (const [k, v] of Object.entries(vars)) target.style.setProperty(k, v);
  if (target === document.documentElement) {
    target.dataset.dark = String(t.dark);
    target.dataset.reduceMotion = String(prefs.reduceMotion);
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
