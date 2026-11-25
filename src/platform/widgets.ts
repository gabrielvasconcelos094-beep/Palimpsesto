/**
 * Widgets da tela inicial (Android).
 *
 * O app não desenha os widgets: ele entrega ao código nativo a APARÊNCIA atual
 * (cores do tema, estilo visual, nomes da escala e os ícones dos símbolos já
 * rasterizados em PNG) e o nativo os redesenha com RemoteViews, mesmo com o app
 * fechado. Nenhum dado pessoal é enviado — só aparência.
 *
 * Para o modo escuro do sistema, enviamos as duas variantes (clara e escura) e o
 * nativo escolhe pela configuração do aparelho no momento de desenhar.
 */
import { createElement } from 'react';
import { Feather, Flag } from 'lucide-react';
import { Capacitor, registerPlugin } from '@capacitor/core';
import type { Preferences } from '../domain/schema';
import { valenceLabel, VALENCE_VALUES } from '../domain/scales';
import { resolveTokens } from '../theme/resolve';
import type { Tokens } from '../theme/tokens';
import { MoodSymbol, type SymbolSet } from '../ui/symbols';

export const ICON_PX = 128;

export interface WidgetVariant {
  bg: string;
  surface: string;
  ink: string;
  inkSoft: string;
  line: string;
  tint1: string;
  tint2: string;
  radius: number;
  /** PNG em base64: os cinco níveis, de −2 a +2. */
  mood: string[];
  /** PNG em base64: experiência e acontecimento. */
  actions: string[];
}

export interface WidgetPayload {
  appearance: 'system' | 'light' | 'dark';
  style: 'minimal' | 'organic';
  labels: string[];
  variants: Partial<Record<'light' | 'dark', WidgetVariant>>;
}

/** Converte um SVG (texto) ou um emoji em PNG base64. Injetável para testes. */
export type Rasterizer = (item: { svg: string } | { emoji: string }, px: number) => Promise<string>;

/* ------------------------------------------------------------------------ */
/* SVG dos símbolos, sem variáveis CSS                                        */
/* ------------------------------------------------------------------------ */
const XMLNS = 'xmlns="http://www.w3.org/2000/svg"';

function withNamespace(svg: string) {
  return svg.includes('xmlns=') ? svg : svg.replace('<svg ', `<svg ${XMLNS} `);
}

/** SVG do símbolo `v` (−2…+2) da família `set`, com cores reais (nada de var(--…)). */
export async function symbolSvg(set: Exclude<SymbolSet, 'emoji'>, v: number, mood: string[], surface: string, size = ICON_PX): Promise<string> {
  const { renderToStaticMarkup } = await import('react-dom/server');
  const html = renderToStaticMarkup(createElement(MoodSymbol, { v, set, size }));
  return withNamespace(html)
    .replace(/var\(--mood-(\d)\)/g, (_, n) => mood[Number(n) - 1])
    .replace(/var\(--surface\)/g, surface);
}

async function lucideSvg(icon: typeof Feather | typeof Flag, color: string, size = ICON_PX) {
  const { renderToStaticMarkup } = await import('react-dom/server');
  return withNamespace(renderToStaticMarkup(createElement(icon, { size, color, strokeWidth: 1.7 })));
}

const EMOJI = ['😣', '🙁', '😐', '🙂', '😄'];

export const canvasRasterizer: Rasterizer = async (item, px) => {
  const canvas = document.createElement('canvas');
  canvas.width = px;
  canvas.height = px;
  const ctx = canvas.getContext('2d')!;
  if ('emoji' in item) {
    ctx.font = `${Math.round(px * 0.78)}px "Noto Color Emoji", "Apple Color Emoji", "Segoe UI Emoji", sans-serif`;
    ctx.textAlign = 'center';
    ctx.textBaseline = 'middle';
    ctx.fillText(item.emoji, px / 2, px / 2 + px * 0.04);
  } else {
    const img = new Image();
    await new Promise<void>((resolve, reject) => {
      img.onload = () => resolve();
      img.onerror = () => reject(new Error('Falha ao desenhar o símbolo.'));
      img.src = 'data:image/svg+xml;charset=utf-8,' + encodeURIComponent(item.svg);
    });
    ctx.drawImage(img, 0, 0, px, px);
  }
  return canvas.toDataURL('image/png').split(',')[1];
};

/* ------------------------------------------------------------------------ */
/* Carga completa                                                            */
/* ------------------------------------------------------------------------ */
async function variantFor(t: Tokens, set: SymbolSet, organic: boolean, raster: Rasterizer): Promise<WidgetVariant> {
  const mood = organic ? t.moodOrganic : t.mood;
  const mk = async (v: number) =>
    set === 'emoji' ? raster({ emoji: EMOJI[v + 2] }, ICON_PX) : raster({ svg: await symbolSvg(set, v, mood, t.surface) }, ICON_PX);
  return {
    bg: t.bg,
    surface: t.surface,
    ink: t.ink,
    inkSoft: t.inkSoft,
    line: t.line,
    tint1: t.tints[0],
    tint2: t.tints[1],
    radius: t.radius,
    mood: await Promise.all(VALENCE_VALUES.map(mk)),
    actions: [await raster({ svg: await lucideSvg(Feather, t.primaryInk) }, ICON_PX), await raster({ svg: await lucideSvg(Flag, t.primaryInk) }, ICON_PX)],
  };
}

export async function buildWidgetPayload(prefs: Preferences, raster: Rasterizer = canvasRasterizer): Promise<WidgetPayload> {
  const custom = prefs.customThemes.find((t) => t.id === prefs.themeId);
  const organic = prefs.visualStyle === 'organic';
  const variants: WidgetPayload['variants'] = {};
  let appearance: WidgetPayload['appearance'] = prefs.appearance;
  if (custom) {
    // Tema personalizado tem aparência única, definida pelas cores escolhidas.
    const t = resolveTokens(prefs, false);
    appearance = t.dark ? 'dark' : 'light';
    variants[appearance] = await variantFor(t, prefs.symbolSet, organic, raster);
  } else {
    variants.light = await variantFor(resolveTokens({ ...prefs, appearance: 'light' }, false), prefs.symbolSet, organic, raster);
    variants.dark = await variantFor(resolveTokens({ ...prefs, appearance: 'dark' }, true), prefs.symbolSet, organic, raster);
  }
  return {
    appearance,
    style: prefs.visualStyle,
    labels: VALENCE_VALUES.map((v) => valenceLabel(v, prefs.valenceLabels)),
    variants,
  };
}

/** Chave que muda quando algo que afeta a aparência dos widgets muda. */
export function widgetAppearanceKey(prefs: Preferences): string {
  const custom = prefs.customThemes.find((t) => t.id === prefs.themeId);
  return JSON.stringify([prefs.symbolSet, prefs.themeId, prefs.appearance, prefs.visualStyle, prefs.valenceLabels, custom ? [custom.colors, custom.radius, custom.updatedAt] : null]);
}

/* ------------------------------------------------------------------------ */
/* Plugin nativo                                                             */
/* ------------------------------------------------------------------------ */
export interface PalimpsestoWidgetsPlugin {
  updateWidgets(payload: WidgetPayload): Promise<void>;
  consumeLaunchAction(): Promise<{ action: string | null }>;
  addListener(event: 'widgetAction', fn: (e: { action: string }) => void): Promise<{ remove: () => Promise<void> }>;
}

// Uma única instância web, mesmo com chamadas simultâneas (ouvinte e consulta de abertura).
let webImpl: Promise<any> | null = null;
export const Widgets = registerPlugin<PalimpsestoWidgetsPlugin>('PalimpsestoWidgets', {
  web: () => (webImpl ??= import('./widgetsWeb').then((m) => new m.WidgetsWeb())),
});

export async function syncWidgets(prefs: Preferences): Promise<void> {
  const payload = await buildWidgetPayload(prefs);
  if (import.meta.env.DEV) (window as any).__widgetLast = payload;
  if (Capacitor.isNativePlatform() || import.meta.env.DEV) await Widgets.updateWidgets(payload);
}
