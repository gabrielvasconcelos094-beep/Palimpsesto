/**
 * Questionários padronizados de autorrelato.
 *
 * PHQ-9 e GAD-7 (Spitzer, Kroenke, Williams e colegas; tradução brasileira da
 * Pfizer). Uso livre: "No permission required to reproduce, translate, display
 * or distribute". São instrumentos de RASTREIO e de acompanhamento — não fazem
 * diagnóstico. Servem para levar números comparáveis ao longo do tempo para as
 * consultas (cuidado baseado em medidas).
 *
 * A janela de cada questionário é "as últimas 2 semanas"; por isso o app
 * sugere responder, se quiser, a cada duas semanas — sem lembretes nem cobrança.
 */
import type { Assessment, Instrument } from './schema';

export const FREQUENCY_OPTIONS = ['Nenhuma vez', 'Vários dias', 'Mais da metade dos dias', 'Quase todos os dias'] as const;
export const DIFFICULTY_QUESTION =
  'Se você assinalou qualquer um dos problemas, indique o grau de dificuldade que eles lhe causaram para realizar seu trabalho, tomar conta das coisas em casa ou para se relacionar com as pessoas.';
export const DIFFICULTY_OPTIONS = ['Nenhuma dificuldade', 'Alguma dificuldade', 'Muita dificuldade', 'Extrema dificuldade'] as const;

export interface Band {
  min: number;
  max: number;
  label: string;
}

export interface InstrumentDef {
  id: Instrument;
  name: string;
  short: string;
  about: string;
  instruction: string;
  items: string[];
  max: number;
  bands: Band[];
  /** Diferença mínima entre duas aplicações considerada clinicamente relevante. */
  minChange: number;
  minChangeSource: string;
  source: string;
}

export const INSTRUMENT_DEFS: Record<Instrument, InstrumentDef> = {
  phq9: {
    id: 'phq9',
    name: 'PHQ-9',
    short: 'Sintomas depressivos',
    about: 'Questionário sobre a Saúde do Paciente: nove itens sobre sintomas depressivos nas últimas 2 semanas.',
    instruction: 'Durante as últimas 2 semanas, com que frequência você foi incomodado(a) por qualquer um dos problemas abaixo?',
    items: [
      'Pouco interesse ou pouco prazer em fazer as coisas',
      'Se sentir “para baixo”, deprimido(a) ou sem perspectiva',
      'Dificuldade para pegar no sono ou permanecer dormindo, ou dormir mais do que de costume',
      'Se sentir cansado(a) ou com pouca energia',
      'Falta de apetite ou comendo demais',
      'Se sentir mal consigo mesmo(a) — ou achar que você é um fracasso ou que decepcionou sua família ou você mesmo(a)',
      'Dificuldade para se concentrar nas coisas, como ler o jornal ou ver televisão',
      'Lentidão para se movimentar ou falar, a ponto de as outras pessoas perceberem; ou o oposto — estar tão agitado(a) ou irrequieto(a) que você fica andando de um lado para o outro muito mais do que de costume',
      'Pensar em se ferir de alguma maneira ou que seria melhor estar morto(a)',
    ],
    max: 27,
    bands: [
      { min: 0, max: 4, label: 'mínimos' },
      { min: 5, max: 9, label: 'leves' },
      { min: 10, max: 14, label: 'moderados' },
      { min: 15, max: 19, label: 'moderadamente graves' },
      { min: 20, max: 27, label: 'graves' },
    ],
    minChange: 5,
    minChangeSource: 'Löwe et al., 2004 (Medical Care): mudança de 5 pontos ou mais como clinicamente relevante.',
    source: 'Kroenke, Spitzer & Williams, 2001 (J Gen Intern Med). Versão brasileira: Pfizer; Santos et al., 2013.',
  },
  gad7: {
    id: 'gad7',
    name: 'GAD-7',
    short: 'Sintomas de ansiedade',
    about: 'Escala de Ansiedade Generalizada: sete itens sobre sintomas de ansiedade nas últimas 2 semanas.',
    instruction: 'Durante as últimas 2 semanas, com que frequência você foi incomodado(a) pelos problemas abaixo?',
    items: [
      'Sentir-se nervoso(a), ansioso(a) ou muito tenso(a)',
      'Não ser capaz de impedir ou de controlar as preocupações',
      'Preocupar-se muito com diversas coisas',
      'Dificuldade para relaxar',
      'Ficar tão agitado(a) que se torna difícil permanecer sentado(a)',
      'Ficar facilmente aborrecido(a) ou irritado(a)',
      'Sentir medo como se algo horrível fosse acontecer',
    ],
    max: 21,
    bands: [
      { min: 0, max: 4, label: 'mínimos' },
      { min: 5, max: 9, label: 'leves' },
      { min: 10, max: 14, label: 'moderados' },
      { min: 15, max: 21, label: 'graves' },
    ],
    minChange: 4,
    minChangeSource: 'Toussaint et al., 2020 (J Affect Disord): diferença mínima clinicamente importante de 4 pontos.',
    source: 'Spitzer, Kroenke, Williams & Löwe, 2006 (Arch Intern Med). Versão brasileira: Pfizer; Moreno et al., 2016.',
  },
};

export const score = (a: Pick<Assessment, 'answers'>) => a.answers.reduce((x, y) => x + y, 0);

export function band(instrument: Instrument, total: number): Band {
  const def = INSTRUMENT_DEFS[instrument];
  return def.bands.find((b) => total >= b.min && total <= b.max) ?? def.bands[def.bands.length - 1];
}

/** PHQ-9 item 9 (pensamentos de se ferir ou de que seria melhor estar morto) respondido acima de "nenhuma vez". */
export const item9Positive = (a: Pick<Assessment, 'instrument' | 'answers'>) => a.instrument === 'phq9' && (a.answers[8] ?? 0) > 0;

export function isComplete(instrument: Instrument, answers: Array<number | null>) {
  return answers.length === INSTRUMENT_DEFS[instrument].items.length && answers.every((x) => x !== null && x >= 0 && x <= 3);
}

export interface ChangeReading {
  delta: number;
  kind: 'better' | 'worse' | 'same';
  days: number;
}

/**
 * Mudança entre duas aplicações (b depois de a). Nos dois questionários, pontuação
 * MAIOR = mais sintomas; então queda relevante = "menos sintomas".
 */
export function change(instrument: Instrument, a: Pick<Assessment, 'answers' | 'date'>, b: Pick<Assessment, 'answers' | 'date'>): ChangeReading {
  const delta = score(b) - score(a);
  const min = INSTRUMENT_DEFS[instrument].minChange;
  const days = Math.round((new Date(b.date + 'T12:00:00').getTime() - new Date(a.date + 'T12:00:00').getTime()) / 86400000);
  return { delta, days, kind: delta <= -min ? 'better' : delta >= min ? 'worse' : 'same' };
}

/** Aplicações de um questionário, da mais antiga para a mais recente. */
export function history(list: Assessment[], instrument: Instrument): Assessment[] {
  return list.filter((a) => a.instrument === instrument).sort((x, y) => x.date.localeCompare(y.date) || x.createdAt.localeCompare(y.createdAt));
}

export function daysSince(date: string, today: string) {
  return Math.round((new Date(today + 'T12:00:00').getTime() - new Date(date + 'T12:00:00').getTime()) / 86400000);
}
