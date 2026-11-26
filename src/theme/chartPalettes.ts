/**
 * Paletas para gráficos e para a escala do humor (−2 … +2), independentes do tema.
 * "Do tema" mantém a escala derivada das cores do tema. As outras são divergentes:
 * desagradável (quente) → neutro (cinza) → agradável (frio/verde), escolhidas para
 * continuar distinguíveis por quem tem daltonismo vermelho-verde (as pontas diferem
 * também em claridade, e o neutro é cinza). O contraste com o fundo é garantido em
 * `applyChartPalette` (≥ 3:1, o mínimo para elementos gráficos).
 */
import { ensureContrast } from './color';
import type { Tokens } from './tokens';

export type ChartPalette = 'theme' | 'vibrant' | 'nature' | 'aurora' | 'ocean';

export const CHART_PALETTES: Array<{ id: ChartPalette; name: string; description: string; colors: [string, string, string, string, string] | null }> = [
  { id: 'theme', name: 'Do tema', description: 'A escala acompanha as cores do tema escolhido.', colors: null },
  { id: 'vibrant', name: 'Vibrante', description: 'Cores vivas e bem separadas: vermelho, laranja, cinza, verde-azulado e azul.', colors: ['#E5383B', '#F48C06', '#9CA3AF', '#0FA37F', '#3A6FF7'] },
  { id: 'aurora', name: 'Aurora', description: 'Do magenta do entardecer ao azul da manhã.', colors: ['#C2416B', '#EA8A55', '#A19CAB', '#3FA7A0', '#6366F1'] },
  { id: 'nature', name: 'Natureza', description: 'As cores das plantas da escala: terracota, ocre, sálvia, verde e girassol.', colors: ['#B0503A', '#C9822F', '#8C9A7E', '#5E8F4E', '#D9A21B'] },
  { id: 'ocean', name: 'Mar e coral', description: 'Coral e areia de um lado, verde-água e azul-profundo do outro.', colors: ['#E4572E', '#F3A65A', '#9AA5A8', '#2BB3A3', '#1F6FB2'] },
];

export function applyChartPalette(t: Tokens, id: ChartPalette | undefined): Tokens {
  const p = CHART_PALETTES.find((x) => x.id === id)?.colors;
  if (!p) return t;
  const mood = p.map((c) => ensureContrast(c, [t.surface], 3)) as Tokens['mood'];
  const moodOrganic = p.map((c) => ensureContrast(c, [t.surface, ...t.tints], 3)) as Tokens['mood'];
  return { ...t, mood, moodOrganic };
}
