import { describe, expect, it } from 'vitest';
import { apptTitle, reminderText, whoLabel, whoWithArticle } from '../src/domain/care';
import { CHART_PALETTES } from '../src/theme/chartPalettes';
import { contrast } from '../src/theme/color';
import { PRESET_THEMES } from '../src/theme/presets';
import { resolveTokens } from '../src/theme/resolve';
import { AppDataSchema } from '../src/domain/schema';

const prefs = (o: any = {}) => ({ ...AppDataSchema.parse({ schemaVersion: 3 }).preferences, ...o });

describe('nomenclatura: quem atende, não a área', () => {
  it('psiquiatra, psicóloga, psicólogo', () => {
    expect(whoLabel('psiquiatria')).toBe('Psiquiatra');
    expect(whoLabel('psicologia', 'f')).toBe('Psicóloga');
    expect(whoLabel('psicologia', 'm')).toBe('Psicólogo');
    expect(whoLabel('psicologia', null)).toBe('Psicóloga(o)');
    expect(whoWithArticle('psicologia', 'f')).toBe('a psicóloga');
  });
  it('título da consulta e lembrete', () => {
    expect(apptTitle({ forWhom: 'psicologia', professionalGender: 'f', professional: 'Ana' })).toBe('Psicóloga · Ana');
    expect(apptTitle({ forWhom: 'outro', professionalGender: null, professional: 'Nutricionista' })).toBe('Nutricionista');
    expect(reminderText({ time: '14:00', forWhom: 'psicologia', professional: '', reminderShowsType: true, professionalGender: 'f' }).body).toBe('Sessão com a psicóloga às 14:00.');
    expect(reminderText({ time: '14:00', forWhom: 'psicologia', professional: '', reminderShowsType: false, professionalGender: 'f' }).body).toBe('Você tem um compromisso às 14:00.');
  });
});

describe('paletas dos gráficos', () => {
  it('em todos os temas, claro e escuro: cinco cores distintas e contraste ≥ 3:1 com a superfície', () => {
    for (const th of PRESET_THEMES)
      for (const appearance of ['light', 'dark'] as const)
        for (const p of CHART_PALETTES) {
          const t = resolveTokens(prefs({ themeId: th.id, appearance, chartPalette: p.id }), false);
          expect(new Set(t.mood).size, `${th.id} ${appearance} ${p.id}`).toBe(5);
          if (p.id !== 'theme') for (const c of t.mood) expect(contrast(c, t.surface), `${th.id} ${appearance} ${p.id} ${c}`).toBeGreaterThanOrEqual(3);
        }
  });
  it('"Do tema" não muda nada; as outras substituem só a escala do humor', () => {
    const base = resolveTokens(prefs({ chartPalette: 'theme' }), false);
    const viv = resolveTokens(prefs({ chartPalette: 'vibrant' }), false);
    expect(viv.surface).toBe(base.surface);
    expect(viv.energy).toEqual(base.energy);
    expect(viv.mood).not.toEqual(base.mood);
  });
});
