import { describe, expect, it } from 'vitest';
import { PRESET_THEMES } from '../src/theme/presets';
import { deriveTokens } from '../src/theme/tokens';
import { contrast } from '../src/theme/color';

describe('temas predefinidos', () => {
  for (const theme of PRESET_THEMES) {
    for (const mode of ['light', 'dark'] as const) {
      it(`${theme.name} (${mode}) cumpre os contrastes mínimos`, () => {
        const { tokens: t, checks } = deriveTokens(theme[mode], theme);
        for (const c of checks) expect(c.ratio, c.label).toBeGreaterThanOrEqual(c.min);
        expect(contrast(t.ink, t.bg)).toBeGreaterThanOrEqual(7);
        expect(contrast(t.inkFaint, t.surface)).toBeGreaterThanOrEqual(4.5);
        expect(contrast(t.lineStrong, t.surface)).toBeGreaterThanOrEqual(3);
        for (const m of t.mood) expect(contrast(m, t.surface)).toBeGreaterThanOrEqual(3);
        expect(t.dark).toBe(mode === 'dark');
      });
    }
  }

  it('os temas são distintos entre si', () => {
    const bgs = new Set(PRESET_THEMES.map((t) => t.light.background.toLowerCase()));
    expect(bgs.size).toBe(PRESET_THEMES.length);
    const shapes = new Set(PRESET_THEMES.map((t) => `${t.radius}-${t.cardStyle}-${t.displayFont}`));
    expect(shapes.size).toBeGreaterThan(5);
  });
});

describe('temas personalizados', () => {
  it('corrige automaticamente combinações ilegíveis', () => {
    const { tokens: t, checks } = deriveTokens(
      { background: '#FFFF00', surface: '#FFFF66', primary: '#FFEE00', accent: '#FFFFFF', complement1: '#EEEEEE', complement2: '#FFFFEE' },
      { radius: 10, cardStyle: 'filled', displayFont: 'lora' },
    );
    for (const c of checks) expect(c.ratio, c.label).toBeGreaterThanOrEqual(c.min);
    expect(checks.some((c) => c.adjusted)).toBe(true);
    expect(contrast(t.onAccent, t.accentFill)).toBeGreaterThanOrEqual(4.5);
  });

  it('funciona com fundos escuros e cinza médio', () => {
    for (const bg of ['#000000', '#777777', '#3a3a6a']) {
      const { checks } = deriveTokens(
        { background: bg, surface: bg, primary: '#888888', accent: '#999999', complement1: '#777777', complement2: '#666666' },
        { radius: 10, cardStyle: 'filled', displayFont: 'lora' },
      );
      for (const c of checks) expect(c.ratio, `${bg} ${c.label}`).toBeGreaterThanOrEqual(c.min);
    }
  });
});
