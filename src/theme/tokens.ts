/**
 * Design tokens: tudo o que a interface usa vem daqui, como variáveis CSS.
 * A derivação garante contrastes mínimos (WCAG):
 *   texto principal ≥ 7:1 · texto secundário ≥ 4.5:1 · texto de cor ≥ 4.5:1
 *   rótulo sobre botão ≥ 4.5:1 · bordas de campos e cores do humor ≥ 3:1
 */
import type { ThemeColors } from '../domain/schema';
import { bestOn, contrast, ensureContrast, isDarkColor, mix } from './color';
import type { CardStyle, DisplayFont } from './presets';

export interface Tokens {
  dark: boolean;
  bg: string;
  surface: string;
  surface2: string;
  ink: string;
  inkSoft: string;
  inkFaint: string;
  ghost: string;
  line: string;
  lineStrong: string;
  primary: string;
  primaryInk: string;
  primaryFill: string;
  onPrimary: string;
  primarySoft: string;
  accent: string;
  accentInk: string;
  accentFill: string;
  onAccent: string;
  accentSoft: string;
  comp1: string;
  comp2: string;
  comp1Ink: string;
  comp2Ink: string;
  danger: string;
  dangerSoft: string;
  mood: [string, string, string, string, string];
  energy: [string, string, string, string, string];
  radius: number;
  cardStyle: CardStyle;
  displayFont: DisplayFont;
}

export interface ContrastCheck {
  label: string;
  ratio: number;
  min: number;
  adjusted: boolean;
}

export function deriveTokens(
  colors: ThemeColors,
  shape: { radius: number; cardStyle: CardStyle; displayFont: DisplayFont },
  moodPoles?: [string, string],
): { tokens: Tokens; checks: ContrastCheck[] } {
  const dark = isDarkColor(colors.background);
  // Fundos de tom médio não permitem texto legível: clareamos/escurecemos o necessário.
  const ground = (c: string) => ensureContrast(c, [dark ? '#ffffff' : '#000000'], 11);
  const bg = ground(colors.background);
  // Superfície precisa se distinguir minimamente do fundo; se forem iguais, ajusta.
  let surface = ground(colors.surface);
  if (contrast(surface, bg) < 1.04) surface = mix(surface, dark ? '#ffffff' : '#ffffff', dark ? 0.06 : 0.5);
  const surface2 = mix(surface, dark ? '#ffffff' : colors.primary, dark ? 0.05 : 0.05);
  const grounds = [bg, surface, surface2];

  const baseInk = mix(colors.primary, dark ? '#ffffff' : '#000000', 0.8);
  const ink = ensureContrast(baseInk, grounds, 9);
  const inkSoft = ensureContrast(mix(ink, bg, 0.32), grounds, 5.2);
  const inkFaint = ensureContrast(mix(ink, bg, 0.5), grounds, 4.5);
  const ghost = mix(ink, bg, 0.93);
  const line = mix(ink, surface, 0.86);
  const lineStrong = ensureContrast(mix(ink, surface, 0.62), [surface], 3);

  const fill = (base: string) => {
    let f = base;
    let on = bestOn(f, base);
    if (contrast(on, f) < 4.5) {
      // Ajusta o preenchimento até o rótulo ficar legível.
      f = ensureContrast(f, [on], 4.5);
      on = bestOn(f, base);
    }
    return { f, on };
  };
  const p = fill(colors.primary);
  const a = fill(colors.accent);
  const primaryInk = ensureContrast(colors.primary, grounds, 4.6);
  const accentInk = ensureContrast(colors.accent, grounds, 4.6);
  const primarySoft = mix(colors.primary, surface, dark ? 0.78 : 0.86);
  const accentSoft = mix(colors.accent, surface, dark ? 0.78 : 0.84);
  const comp1Ink = ensureContrast(colors.complement1, grounds, 4.5);
  const comp2Ink = ensureContrast(colors.complement2, grounds, 4.5);
  const danger = ensureContrast(dark ? '#F28B82' : '#B3261E', grounds, 4.6);
  const dangerSoft = mix(danger, surface, 0.88);

  // Escala divergente do humor: complemento 1 (desagradável) → neutro → destaque (agradável).
  const neg = moodPoles?.[0] ?? colors.complement1;
  const pos = moodPoles?.[1] ?? colors.accent;
  const neutral = mix(ink, surface, 0.55);
  const m2 = ensureContrast(mix(neg, surface, 0.28), [surface], 3);
  const m4 = ensureContrast(mix(pos, surface, 0.28), [surface], 3);
  const m1 = ensureContrast(neg, [surface], Math.max(4.5, contrast(m2, surface) + 1.6));
  const m5 = ensureContrast(pos, [surface], Math.max(4.5, contrast(m4, surface) + 1.6));
  const m3 = ensureContrast(neutral, [surface], 3);
  const mood: Tokens['mood'] = [m1, m2, m3, m4, m5];

  // Energia: sequencial no tom principal (mais intenso = mais energia).
  const e5 = ensureContrast(colors.primary, [surface], 5);
  const energy = [0.78, 0.6, 0.42, 0.22, 0].map((t, i) =>
    ensureContrast(mix(e5, surface, t), [surface], i === 0 ? 1.4 : 1.8),
  ) as Tokens['energy'];

  const tokens: Tokens = {
    dark,
    bg,
    surface,
    surface2,
    ink,
    inkSoft,
    inkFaint,
    ghost,
    line,
    lineStrong,
    primary: colors.primary,
    primaryInk,
    primaryFill: p.f,
    onPrimary: p.on,
    primarySoft,
    accent: colors.accent,
    accentInk,
    accentFill: a.f,
    onAccent: a.on,
    accentSoft,
    comp1: colors.complement1,
    comp2: colors.complement2,
    comp1Ink,
    comp2Ink,
    danger,
    dangerSoft,
    mood,
    energy,
    radius: shape.radius,
    cardStyle: shape.cardStyle,
    displayFont: shape.displayFont,
  };

  const checks: ContrastCheck[] = [
    {
      label: 'Fundo e cartões em tom que permite leitura',
      ratio: Math.min(contrast(bg, dark ? '#ffffff' : '#000000'), contrast(surface, dark ? '#ffffff' : '#000000')),
      min: 8,
      adjusted: bg.toLowerCase() !== colors.background.toLowerCase() || surface.toLowerCase() !== colors.surface.toLowerCase(),
    },
    { label: 'Texto sobre o fundo', ratio: contrast(ink, bg), min: 7, adjusted: ink !== baseInk },
    { label: 'Texto sobre cartões', ratio: contrast(ink, surface), min: 7, adjusted: ink !== baseInk },
    { label: 'Texto secundário', ratio: Math.min(contrast(inkSoft, bg), contrast(inkSoft, surface)), min: 4.5, adjusted: false },
    {
      label: 'Cor principal como texto',
      ratio: Math.min(contrast(primaryInk, bg), contrast(primaryInk, surface)),
      min: 4.5,
      adjusted: primaryInk.toLowerCase() !== colors.primary.toLowerCase(),
    },
    {
      label: 'Rótulo em botões principais',
      ratio: contrast(p.on, p.f),
      min: 4.5,
      adjusted: p.f.toLowerCase() !== colors.primary.toLowerCase(),
    },
    {
      label: 'Cor de destaque como texto',
      ratio: Math.min(contrast(accentInk, bg), contrast(accentInk, surface)),
      min: 4.5,
      adjusted: accentInk.toLowerCase() !== colors.accent.toLowerCase(),
    },
    {
      label: 'Rótulo em botões de destaque',
      ratio: contrast(a.on, a.f),
      min: 4.5,
      adjusted: a.f.toLowerCase() !== colors.accent.toLowerCase(),
    },
  ];
  return { tokens, checks };
}

const FONT_STACKS: Record<DisplayFont, string> = {
  fraunces: "'Fraunces Variable', 'Fraunces', Georgia, serif",
  cormorant: "'Cormorant Garamond', Garamond, Georgia, serif",
  lora: "'Lora Variable', 'Lora', Georgia, serif",
};

export function tokensToCss(t: Tokens, opts: { displayFont?: DisplayFont; textScale?: number } = {}): Record<string, string> {
  const font = opts.displayFont ?? t.displayFont;
  const cardBg = t.cardStyle === 'outline' ? t.surface : t.surface;
  const cardBorder =
    t.cardStyle === 'outline' ? `1px solid ${t.line}` : t.cardStyle === 'paper' ? `1px solid ${mix(t.line, t.surface, 0.4)}` : '1px solid transparent';
  const cardShadow =
    t.cardStyle === 'paper'
      ? t.dark
        ? '0 1px 0 rgba(0,0,0,.35), 0 6px 18px -10px rgba(0,0,0,.6)'
        : `0 1px 0 ${mix(t.line, t.bg, 0.2)}, 0 8px 22px -14px ${mix(t.ink, t.bg, 0.55)}`
      : 'none';
  const vars: Record<string, string> = {
    '--bg': t.bg,
    '--surface': t.surface,
    '--surface-2': t.surface2,
    '--ink': t.ink,
    '--ink-soft': t.inkSoft,
    '--ink-faint': t.inkFaint,
    '--ghost': t.ghost,
    '--line': t.line,
    '--line-strong': t.lineStrong,
    '--primary': t.primary,
    '--primary-ink': t.primaryInk,
    '--primary-fill': t.primaryFill,
    '--on-primary': t.onPrimary,
    '--primary-soft': t.primarySoft,
    '--accent': t.accent,
    '--accent-ink': t.accentInk,
    '--accent-fill': t.accentFill,
    '--on-accent': t.onAccent,
    '--accent-soft': t.accentSoft,
    '--comp1': t.comp1,
    '--comp2': t.comp2,
    '--comp1-ink': t.comp1Ink,
    '--comp2-ink': t.comp2Ink,
    '--danger': t.danger,
    '--danger-soft': t.dangerSoft,
    '--radius': `${t.radius}px`,
    '--radius-sm': `${Math.max(2, Math.round(t.radius * 0.55))}px`,
    '--radius-pill': t.radius <= 4 ? `${Math.max(2, t.radius)}px` : '999px',
    '--card-bg': cardBg,
    '--card-border': cardBorder,
    '--card-shadow': cardShadow,
    '--font-display': FONT_STACKS[font],
    '--display-weight': font === 'cormorant' ? '600' : '500',
    '--display-scale': font === 'cormorant' ? '1.12' : '1',
    '--text-scale': String(opts.textScale ?? 1),
  };
  t.mood.forEach((m, i) => (vars[`--mood-${i + 1}`] = m));
  t.energy.forEach((m, i) => (vars[`--energy-${i + 1}`] = m));
  return vars;
}
