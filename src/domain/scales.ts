/**
 * Escalas do diário. Os valores internos são fixos; apenas os rótulos
 * podem ser personalizados (Preferences.valenceLabels / energyLabels).
 */
import type { IndicatorKey, Outcome, Confidence, RepertoireKind } from './schema';

/** Índice 0..4 ↔ valor -2..+2 */
export const VALENCE_VALUES = [-2, -1, 0, 1, 2] as const;
export type ValenceValue = (typeof VALENCE_VALUES)[number];

export const DEFAULT_VALENCE_LABELS = [
  'Muito desagradável',
  'Desagradável',
  'Intermediário',
  'Agradável',
  'Muito agradável',
] as const;

export const DEFAULT_ENERGY_LABELS = [
  'Esgotado',
  'Energia baixa',
  'Energia moderada',
  'Energia alta',
  'Muito energizado',
] as const;

export const valenceToIndex = (v: number) => Math.max(0, Math.min(4, Math.round(v) + 2));
export const indexToValence = (i: number) => VALENCE_VALUES[Math.max(0, Math.min(4, i))];

export function valenceLabel(v: number, custom?: ReadonlyArray<string | null>): string {
  const i = valenceToIndex(v);
  const c = custom?.[i];
  return c && c.trim() ? c.trim() : DEFAULT_VALENCE_LABELS[i];
}

export function energyLabel(e: number, custom?: ReadonlyArray<string | null>): string {
  const i = Math.max(0, Math.min(4, Math.round(e) - 1));
  const c = custom?.[i];
  return c && c.trim() ? c.trim() : DEFAULT_ENERGY_LABELS[i];
}

export const INDICATORS: Record<IndicatorKey, { label: string; low: string; high: string; levels: string[] }> = {
  anxiety: {
    label: 'Ansiedade',
    low: 'nenhuma',
    high: 'muito intensa',
    levels: ['Nenhuma', 'Leve', 'Moderada', 'Intensa', 'Muito intensa'],
  },
  irritability: {
    label: 'Irritabilidade',
    low: 'nenhuma',
    high: 'muito intensa',
    levels: ['Nenhuma', 'Leve', 'Moderada', 'Intensa', 'Muito intensa'],
  },
  overload: {
    label: 'Sensação de sobrecarga',
    low: 'nenhuma',
    high: 'muito intensa',
    levels: ['Nenhuma', 'Leve', 'Moderada', 'Intensa', 'Muito intensa'],
  },
  loneliness: {
    label: 'Sensação de solidão',
    low: 'nenhuma',
    high: 'muito intensa',
    levels: ['Nenhuma', 'Leve', 'Moderada', 'Intensa', 'Muito intensa'],
  },
};

export const OUTCOME_LABELS: Record<Outcome, string> = {
  worked: 'Funcionou',
  partial: 'Funcionou parcialmente',
  didnt: 'Não funcionou',
  worse: 'Piorou a situação',
  unknown: 'Ainda não sei',
};
export const OUTCOME_ORDER: Outcome[] = ['worked', 'partial', 'didnt', 'worse', 'unknown'];

export const CONFIDENCE_LABELS: Record<Confidence, { label: string; hint: string }> = {
  hypothesis: { label: 'Hipótese', hint: 'Ainda estou investigando.' },
  recurring: { label: 'Observação recorrente', hint: 'Já identifiquei várias ocorrências.' },
  consolidated: { label: 'Descoberta consolidada', hint: 'Considero algo bem estabelecido sobre mim.' },
};

export const KIND_LABELS: Record<RepertoireKind, { singular: string; plural: string; hint: string }> = {
  resource: {
    singular: 'Algo que me faz bem',
    plural: 'O que me faz bem',
    hint: 'Atividades, pessoas, lugares, hábitos e experiências que trazem bem-estar.',
  },
  strategy: {
    singular: 'Estratégia',
    plural: 'Estratégias',
    hint: 'O que você faz para atravessar momentos difíceis — e como funcionou em cada contexto.',
  },
  activity: {
    singular: 'Atividade',
    plural: 'Atividades',
    hint: 'O que você faz no dia a dia — ler, caminhar, estudar… Marque-as nos registros de humor para ver, na Trajetória, como costumam aparecer.',
  },
  drain: {
    singular: 'Algo que me desgasta',
    plural: 'O que me desgasta',
    hint: 'Situações, hábitos e circunstâncias que costumam pesar ou exigir cuidado.',
  },
};

export const FREQUENCY_LABELS = ['Raramente', 'Às vezes', 'Frequentemente', 'Quase sempre'];

/**
 * Qualidade do sono (1–5), como no Diário de Sono Consensual (Carney et al., 2012).
 * As descrições ancoram cada nível no quanto você DESCANSOU — não em horas: duração
 * e qualidade são medidas diferentes (dá para dormir 8 h e mal).
 */
export const SLEEP_QUALITY = [
  { label: 'Muito ruim', hint: 'Quase não descansei; acordei exausto(a).' },
  { label: 'Ruim', hint: 'Sono agitado ou interrompido; acordei cansado(a).' },
  { label: 'Razoável', hint: 'Descansei em parte.' },
  { label: 'Boa', hint: 'Dormi bem e acordei razoavelmente descansado(a).' },
  { label: 'Muito boa', hint: 'Sono profundo e reparador; acordei descansado(a).' },
] as const;

export const SLEEP_TROUBLE_LABELS: Record<'onset' | 'awakenings' | 'early' | 'nightmares', string> = {
  onset: 'Demorei a pegar no sono',
  awakenings: 'Acordei durante a noite',
  early: 'Acordei cedo demais',
  nightmares: 'Tive pesadelos',
};

/**
 * O que pode ter atrapalhado o sono — fatores comuns na avaliação de insônia
 * (higiene do sono e TCC-I). Servem para cruzar com a qualidade depois.
 */
export const SLEEP_FACTOR_LABELS: Record<'worry' | 'anxiety' | 'sadness' | 'pain' | 'environment' | 'screens' | 'caffeine' | 'alcohol' | 'late' | 'nap' | 'obligation' | 'care' | 'medication', string> = {
  worry: 'Pensamentos acelerados / preocupação',
  anxiety: 'Ansiedade',
  sadness: 'Tristeza',
  pain: 'Dor ou desconforto',
  environment: 'Barulho, luz ou temperatura',
  screens: 'Telas até tarde',
  caffeine: 'Cafeína à tarde/noite',
  alcohol: 'Álcool',
  late: 'Dormi mais tarde que o costume',
  nap: 'Cochilo durante o dia',
  obligation: 'Precisei acordar cedo',
  care: 'Cuidar de alguém (filho, pet…)',
  medication: 'Efeito de remédio',
};

/** Armadilhas de pensamento (distorções cognitivas, Beck e Burns), em linguagem simples. */
export const DISTORTION_LABELS: Record<
  'catastrofizacao' | 'tudo_ou_nada' | 'leitura_mental' | 'adivinhacao' | 'generalizacao' | 'filtro_negativo' | 'desqualificar_positivo' | 'raciocinio_emocional' | 'deverias' | 'rotulacao' | 'personalizacao' | 'comparacao',
  { label: string; hint: string }
> = {
  catastrofizacao: { label: 'Catastrofização', hint: 'Imaginar o pior desfecho como o mais provável.' },
  tudo_ou_nada: { label: 'Tudo ou nada', hint: 'Ver em extremos: perfeito ou fracasso, sem meio-termo.' },
  leitura_mental: { label: 'Leitura mental', hint: 'Ter certeza do que os outros estão pensando.' },
  adivinhacao: { label: 'Adivinhar o futuro', hint: 'Prever que vai dar errado, como se fosse fato.' },
  generalizacao: { label: 'Generalização', hint: '“Sempre”, “nunca”, “todo mundo” a partir de um caso.' },
  filtro_negativo: { label: 'Filtro negativo', hint: 'Enxergar só o que deu errado.' },
  desqualificar_positivo: { label: 'Desqualificar o positivo', hint: '“Não conta”, “foi sorte”.' },
  raciocinio_emocional: { label: 'Raciocínio emocional', hint: '“Sinto, logo é verdade.”' },
  deverias: { label: '“Deveria” / “tenho que”', hint: 'Regras rígidas sobre si ou os outros.' },
  rotulacao: { label: 'Rotulação', hint: '“Sou um fracasso” em vez de “errei nisso”.' },
  personalizacao: { label: 'Personalização', hint: 'Tomar para si a culpa pelo que não depende de você.' },
  comparacao: { label: 'Comparação', hint: 'Medir-se pelos outros, sempre em desvantagem.' },
};
