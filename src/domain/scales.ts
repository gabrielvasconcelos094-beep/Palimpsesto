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
  sleep: {
    label: 'Qualidade do sono',
    low: 'muito ruim',
    high: 'muito boa',
    levels: ['Muito ruim', 'Ruim', 'Razoável', 'Boa', 'Muito boa'],
  },
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
  drain: {
    singular: 'Algo que me desgasta',
    plural: 'O que me desgasta',
    hint: 'Situações, hábitos e circunstâncias que costumam pesar ou exigir cuidado.',
  },
};

export const FREQUENCY_LABELS = ['Raramente', 'Às vezes', 'Frequentemente', 'Quase sempre'];
