import type { Preferences } from '../domain/schema';
import { DEFAULT_THEME_ID, findPreset, PRESET_THEMES } from './presets';
import { deriveTokens, type Tokens } from './tokens';
import { applyChartPalette } from './chartPalettes';

/** Resolve o tema efetivo (predefinido ou personalizado, claro ou escuro). */
export function resolveTokens(prefs: Preferences, systemDark: boolean): Tokens {
  const custom = prefs.customThemes.find((t) => t.id === prefs.themeId);
  if (custom) return applyChartPalette(deriveTokens(custom.colors, custom).tokens, prefs.chartPalette);
  const preset = findPreset(prefs.themeId) ?? findPreset(DEFAULT_THEME_ID) ?? PRESET_THEMES[0];
  const dark = prefs.appearance === 'dark' || (prefs.appearance === 'system' && systemDark);
  return applyChartPalette(deriveTokens(dark ? preset.dark : preset.light, preset, preset.mood?.[dark ? 'dark' : 'light']).tokens, prefs.chartPalette);
}
