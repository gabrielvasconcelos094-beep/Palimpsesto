import { describe, expect, it } from 'vitest';
import { PRESET_THEMES } from '../src/theme/presets';
import { deriveTokens } from '../src/theme/tokens';
import { contrast, mix } from '../src/theme/color';

describe('temas predefinidos', () => {
  for (const theme of PRESET_THEMES) {
    for (const mode of ['light', 'dark'] as const) {
      it(`${theme.name} (${mode}) cumpre os contrastes mínimos`, () => {
        const { tokens: t, checks } = deriveTokens(theme[mode], theme, theme.mood?.[mode]);
        for (const c of checks) expect(c.ratio, c.label).toBeGreaterThanOrEqual(c.min);
        expect(contrast(t.ink, t.bg)).toBeGreaterThanOrEqual(7);
        expect(contrast(t.inkFaint, t.surface)).toBeGreaterThanOrEqual(4.5);
        expect(contrast(t.lineStrong, t.surface)).toBeGreaterThanOrEqual(3);
        for (const m of t.mood) expect(contrast(m, t.surface)).toBeGreaterThanOrEqual(3);
        for (const m of t.moodOrganic) expect(contrast(m, t.surface)).toBeGreaterThanOrEqual(3);
        // Cartões suaves (estilo minimalista): texto principal e secundário legíveis.
        for (const soft of [t.primarySoft, t.accentSoft]) {
          expect(contrast(t.ink, soft)).toBeGreaterThanOrEqual(7);
          expect(contrast(t.inkSoft, soft)).toBeGreaterThanOrEqual(4.5);
          expect(contrast(t.inkFaint, soft)).toBeGreaterThanOrEqual(4.5);
        }
        // Ícones nas placas tingidas (.ico-tile: destaque 16% sobre a superfície; 22% no orgânico).
        for (const t2 of [0.84, 0.78]) expect(contrast(t.accentInk, mix(t.accentFill, t.surface, t2))).toBeGreaterThanOrEqual(3);
        // Blocos pastel do estilo orgânico continuam legíveis.
        for (const tint of t.tints) {
          expect(contrast(t.ink, tint)).toBeGreaterThanOrEqual(7);
          expect(contrast(t.inkSoft, tint)).toBeGreaterThanOrEqual(4.5);
          expect(contrast(t.inkFaint, tint)).toBeGreaterThanOrEqual(4.5);
          for (const m of t.moodOrganic) expect(contrast(m, tint)).toBeGreaterThanOrEqual(3);
          expect(tint).not.toBe(t.surface);
        }
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
