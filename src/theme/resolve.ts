import type { Preferences } from '../domain/schema';
import { DEFAULT_THEME_ID, findPreset, PRESET_THEMES } from './presets';
import { deriveTokens, type Tokens } from './tokens';

/** Resolve o tema efetivo (predefinido ou personalizado, claro ou escuro). */
export function resolveTokens(prefs: Preferences, systemDark: boolean): Tokens {
  const custom = prefs.customThemes.find((t) => t.id === prefs.themeId);
  if (custom) return deriveTokens(custom.colors, custom).tokens;
  const preset = findPreset(prefs.themeId) ?? findPreset(DEFAULT_THEME_ID) ?? PRESET_THEMES[0];
  const dark = prefs.appearance === 'dark' || (prefs.appearance === 'system' && systemDark);
  return deriveTokens(dark ? preset.dark : preset.light, preset, preset.mood?.[dark ? 'dark' : 'light']).tokens;
}
