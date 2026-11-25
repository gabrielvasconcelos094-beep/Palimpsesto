/**
 * Galeria de temas. Cada tema define a mesma meia dúzia de cores que o
 * editor de temas personalizados oferece; todos os demais tokens são
 * derivados por `deriveTokens`, que garante o contraste mínimo.
 *
 * Os temas variam também em forma (raio dos cantos), estilo das superfícies
 * e tipografia de títulos — para terem personalidades distintas.
 */
import type { ThemeColors } from '../domain/schema';

export type CardStyle = 'outline' | 'filled' | 'paper';
export type DisplayFont = 'fraunces' | 'cormorant' | 'lora';

export interface ThemeDefinition {
  id: string;
  name: string;
  description: string;
  radius: number;
  cardStyle: CardStyle;
  displayFont: DisplayFont;
  light: ThemeColors;
  dark: ThemeColors;
  /** Polos opcionais da escala de humor [desagradável, agradável], quando as cores do tema não servem. */
  mood?: { light: [string, string]; dark: [string, string] };
}

const c = (
  background: string,
  surface: string,
  primary: string,
  accent: string,
  complement1: string,
  complement2: string,
): ThemeColors => ({ background, surface, primary, accent, complement1, complement2 });

export const PRESET_THEMES: ThemeDefinition[] = [
  {
    id: 'papel',
    name: 'Papel',
    description: 'Areia, papel e grafite. Sóbrio, com sépia de tinteiro.',
    radius: 4,
    cardStyle: 'outline',
    displayFont: 'cormorant',
    light: c('#F4EFE6', '#FBF8F2', '#3E3A36', '#A0522D', '#5B6C8F', '#B8A07E'),
    dark: c('#1C1B1A', '#262422', '#E8E1D5', '#D9895B', '#8FA3C9', '#C7B08A'),
  },
  {
    id: 'lavanda',
    name: 'Lavanda',
    description: 'Lilás e violeta suave sobre papel claro, com toque de mel.',
    radius: 18,
    cardStyle: 'filled',
    displayFont: 'fraunces',
    light: c('#F3F0FA', '#FFFFFF', '#6B5CA5', '#D4A24C', '#5E7CA8', '#B9A6E0'),
    dark: c('#1D1A26', '#272335', '#B9A8F0', '#E7BE6E', '#8DA8D6', '#7E6CB8'),
  },
  {
    id: 'pessego',
    name: 'Pêssego',
    description: 'Rosa-pêssego, coral suave e creme, com um verde-água de contraponto.',
    radius: 22,
    cardStyle: 'filled',
    displayFont: 'fraunces',
    light: c('#FFF3EC', '#FFFBF8', '#C8644A', '#3F8A87', '#6C7FA8', '#F2B8A0'),
    dark: c('#241B18', '#2F2420', '#F2A48A', '#6FC2BD', '#9AAAD0', '#C77B63'),
  },
  {
    id: 'menta',
    name: 'Menta',
    description: 'Verde-menta e sálvia, claros e frescos, com coral.',
    radius: 14,
    cardStyle: 'outline',
    displayFont: 'lora',
    light: c('#EEF6F1', '#FAFDFB', '#2F7A5F', '#D9736A', '#6B7FB0', '#A8D5C0'),
    dark: c('#15201B', '#1D2A24', '#7FD0AE', '#F0A097', '#9EB0DE', '#3F7F66'),
  },
  {
    id: 'ceu',
    name: 'Céu',
    description: 'Azul-claro, azul acinzentado e branco quente, com damasco.',
    radius: 16,
    cardStyle: 'paper',
    displayFont: 'lora',
    light: c('#EEF3F8', '#FFFFFF', '#3D6A96', '#E39B5B', '#8A6FAF', '#A9C6E3'),
    dark: c('#141B24', '#1C2531', '#8DB8E3', '#F2B27A', '#B59BDB', '#3F6A94'),
  },
  {
    id: 'rosa',
    name: 'Rosa antigo',
    description: 'Rosa queimado, blush e bege, com folhas de sálvia.',
    radius: 10,
    cardStyle: 'paper',
    displayFont: 'cormorant',
    light: c('#F8EEEE', '#FFF9F8', '#9C4F5E', '#6F8F6B', '#5F6E94', '#E2B7B9'),
    dark: c('#221819', '#2D2122', '#E3A3AE', '#A6C49F', '#9DA9CF', '#8A4B57'),
  },
  {
    id: 'manteiga',
    name: 'Manteiga',
    description: 'Amarelo suave, creme e ocre, com azul-centáurea.',
    radius: 12,
    cardStyle: 'filled',
    displayFont: 'lora',
    light: c('#FBF6E4', '#FFFDF5', '#8A6420', '#5874B8', '#8E5A7A', '#F1DC8F'),
    dark: c('#1F1C12', '#2A261A', '#EBC86E', '#93A9E3', '#C795B4', '#8A6C2A'),
  },
  {
    id: 'jardim',
    name: 'Jardim',
    description: 'Verdes botânicos e terracota, como um caderno de herbário.',
    radius: 20,
    cardStyle: 'outline',
    displayFont: 'fraunces',
    light: c('#EEF1E6', '#FAFBF5', '#3E6B3A', '#C0643B', '#6D5D99', '#B5C99A'),
    dark: c('#161B14', '#1F261C', '#9CCB8C', '#E59468', '#A698D2', '#4E6E3F'),
  },
  {
    id: 'malva',
    name: 'Malva',
    description: 'Lavanda, malva e ameixa, com bronze.',
    radius: 16,
    cardStyle: 'filled',
    displayFont: 'cormorant',
    light: c('#F5EEF4', '#FFFAFE', '#7E4A7A', '#B7864A', '#4F6FA0', '#D9B8D6'),
    dark: c('#1F1720', '#2A1F2B', '#D7A6D2', '#E0B27A', '#93AEDD', '#7A4877'),
  },
  {
    id: 'tinta',
    name: 'Tinta',
    description: 'Papel branco, tinta azul-marinho e carmim de revisão.',
    radius: 2,
    cardStyle: 'outline',
    displayFont: 'fraunces',
    light: c('#F7F7F4', '#FFFFFF', '#22365C', '#B23A48', '#3F7F7A', '#C9CFDC'),
    dark: c('#0F1420', '#18202F', '#A9BEEA', '#F08A96', '#7CC4BD', '#2E3C5A'),
    mood: { light: ['#6E5A8A', '#3F7F7A'], dark: ['#B3A1D6', '#7CC4BD'] },
  },
];

export const DEFAULT_THEME_ID = 'papel';

export function findPreset(id: string) {
  return PRESET_THEMES.find((t) => t.id === id);
}
