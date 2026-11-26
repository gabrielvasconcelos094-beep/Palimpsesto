/**
 * Modelo de dados do Palimpsesto (schemaVersion 2).
 *
 * Os esquemas zod são a fonte única de verdade: deles derivam os tipos
 * TypeScript, a validação de importações e a validação do arquivo local.
 *
 * Princípios:
 * - Toda entidade tem `id` estável (UUID), `createdAt` e `updatedAt` (ISO 8601).
 * - Relações são feitas por id, nunca por texto (renomear não quebra nada).
 * - Campos desconhecidos são preservados (`.passthrough()` / `looseObject`) para
 *   que um backup feito por uma versão mais nova, de mesmo schema, não perca dados.
 * - Valores numéricos de escalas são fixos; rótulos são apenas apresentação.
 *
 * Tempo (esquema 2):
 * - `at` é o momento em que a experiência ACONTECEU (o "occurred_at"), guardado
 *   como hora local "flutuante" — `YYYY-MM-DDTHH:mm:ss`, sem fuso. Um registro
 *   das 21h do dia 19 continua sendo do dia 19 às 21h mesmo que o aparelho mude
 *   de fuso. Todas as estatísticas usam `at`.
 * - `createdAt` e `updatedAt` são instantes absolutos (ISO 8601 em UTC): quando o
 *   registro foi criado e alterado pela última vez neste aplicativo.
 * - `timePrecision` diz quão preciso é o horário de `at`: exato, aproximado
 *   (período do dia) ou desconhecido (só a data).
 */
import { z } from 'zod';

export const SCHEMA_VERSION = 3;

/**
 * Remove a assinatura de índice que `looseObject` acrescenta ao tipo, mantendo
 * apenas as chaves conhecidas (a preservação de campos desconhecidos continua
 * valendo em tempo de execução).
 */
export type Known<T> = { [K in keyof T as string extends K ? never : number extends K ? never : K]: T[K] };

const id = z.string().min(1).max(120);
const iso = z.string().min(10).max(40);
const text = (max = 20000) => z.string().max(max);
const tags = z.array(z.string().min(1).max(60)).max(60).default([]);
/** Hora local flutuante: YYYY-MM-DDTHH:mm[:ss], sem fuso. */
export const LOCAL_AT_RE = /^\d{4}-\d{2}-\d{2}T\d{2}:\d{2}(:\d{2}(\.\d{1,3})?)?$/;
const localAt = z.string().regex(LOCAL_AT_RE, 'data/hora local esperada (AAAA-MM-DDTHH:mm:ss)');
export const TIME_PRECISION = ['exact', 'period', 'day'] as const;
export type TimePrecision = (typeof TIME_PRECISION)[number];
const timePrecision = z.enum(TIME_PRECISION).default('exact');

const base = {
  id,
  createdAt: iso,
  updatedAt: iso,
};

/** Valência: -2 (muito desagradável) … +2 (muito agradável). */
export const Valence = z.number().int().min(-2).max(2);
/** Energia: 1 (esgotado) … 5 (muito energizado). */
export const Energy = z.number().int().min(1).max(5);
/** Indicadores complementares: 1 … 5. */
export const Level5 = z.number().int().min(1).max(5);

/** A qualidade do sono saiu daqui na versão 3: o sono é uma vez por noite (ver SleepLogSchema). */
export const INDICATOR_KEYS = ['anxiety', 'irritability', 'overload', 'loneliness'] as const;
export type IndicatorKey = (typeof INDICATOR_KEYS)[number];
export const IndicatorKeySchema = z.enum(INDICATOR_KEYS);

/* ------------------------------------------------------------------ */
/* Diário                                                              */
/* ------------------------------------------------------------------ */

export const MoodEntrySchema = z.looseObject({
  ...base,
  /** Quando a experiência aconteceu (hora local; pode ser retroativo). */
  at: localAt,
  timePrecision,
  valence: Valence,
  energy: Energy.nullable().default(null),
  emotionIds: z.array(id).max(60).default([]),
  indicators: z.partialRecord(IndicatorKeySchema, Level5).default({}),
  /** Contexto: o que estava acontecendo (ex.: "dormi mal", "tempo só"). */
  tags,
  /** Atividades (itens do repertório) feitas ou vividas nesse momento. */
  itemIds: z.array(id).max(60).default([]),
  note: text().default(''),
});
export type MoodEntry = Known<z.infer<typeof MoodEntrySchema>>;

export const EmotionSchema = z.looseObject({
  ...base,
  label: z.string().min(1).max(60),
  builtIn: z.boolean().default(false),
  hidden: z.boolean().default(false),
  /** Seu guia para esta emoção (opcional): o que costuma sinalizar, o que ajuda, o que piora. */
  signals: text(4000).default(''),
  helps: text(4000).default(''),
  worsens: text(4000).default(''),
});
export type Emotion = Known<z.infer<typeof EmotionSchema>>;

export const DISTORTIONS = [
  'catastrofizacao',
  'tudo_ou_nada',
  'leitura_mental',
  'adivinhacao',
  'generalizacao',
  'filtro_negativo',
  'desqualificar_positivo',
  'raciocinio_emocional',
  'deverias',
  'rotulacao',
  'personalizacao',
  'comparacao',
] as const;
export type Distortion = (typeof DISTORTIONS)[number];
const Percent = z.number().int().min(0).max(100);

export const ExperienceSchema = z.looseObject({
  ...base,
  at: localAt,
  timePrecision,
  title: text(200).default(''),
  whatHappened: text().default(''),
  feelingBefore: Valence.nullable().default(null),
  emotionIds: z.array(id).max(60).default([]),
  /** Registro de Pensamentos (adaptado do RPD de Beck): intensidade da emoção 0–100. */
  intensityBefore: Percent.nullable().default(null),
  /** Pensamentos automáticos: o que passou pela cabeça. */
  thoughts: text().default(''),
  /** Quanto acreditou no pensamento (0–100), no momento. */
  beliefBefore: Percent.nullable().default(null),
  /** Armadilhas de pensamento reconhecidas (opcional). */
  distortions: z.array(z.enum(DISTORTIONS)).max(20).default([]),
  evidenceFor: text().default(''),
  evidenceAgainst: text().default(''),
  /** Um pensamento alternativo, mais equilibrado. */
  alternativeThought: text().default(''),
  /** Depois de examinar: quanto ainda acredita no pensamento original e intensidade da emoção. */
  beliefAfter: Percent.nullable().default(null),
  intensityAfter: Percent.nullable().default(null),
  whatIDid: text().default(''),
  whatHelped: text().default(''),
  whatWorsened: text().default(''),
  feelingAfter: Valence.nullable().default(null),
  howIFeltAfter: text().default(''),
  learned: text().default(''),
  tags,
  /** Situação especial à qual esta experiência pertence (opcional). */
  situationId: id.nullable().default(null),
});
export type Experience = Known<z.infer<typeof ExperienceSchema>>;

/* ------------------------------------------------------------------ */
/* Repertório                                                          */
/* ------------------------------------------------------------------ */

export const REPERTOIRE_KINDS = ['resource', 'strategy', 'drain', 'activity'] as const;
export type RepertoireKind = (typeof REPERTOIRE_KINDS)[number];

export const RepertoireItemSchema = z.looseObject({
  ...base,
  kind: z.enum(REPERTOIRE_KINDS),
  name: z.string().min(1).max(200),
  description: text().default(''),
  category: text(60).default(''),
  /** Em quais circunstâncias costuma ajudar / aparecer. */
  circumstances: text().default(''),
  /** Efeito que costuma produzir. */
  effect: text().default(''),
  /** Frequência percebida (1 raramente … 4 quase sempre). null = não sei. */
  perceivedFrequency: z.number().int().min(1).max(4).nullable().default(null),
  notes: text().default(''),
  /** Para itens que prejudicam: gostaria de modificar esse hábito/comportamento. */
  wantToChange: z.boolean().default(false),
  tags,
  archived: z.boolean().default(false),
});
export type RepertoireItem = Known<z.infer<typeof RepertoireItemSchema>>;

export const OUTCOMES = ['worked', 'partial', 'didnt', 'worse', 'unknown'] as const;
export type Outcome = (typeof OUTCOMES)[number];

/** Um uso concreto de um item do repertório, com sua avaliação naquele contexto. */
export const StrategyUseSchema = z.looseObject({
  ...base,
  itemId: id,
  at: localAt,
  timePrecision,
  outcome: z.enum(OUTCOMES).default('unknown'),
  tags,
  note: text().default(''),
  experienceId: id.nullable().default(null),
});
export type StrategyUse = Known<z.infer<typeof StrategyUseSchema>>;

/* ------------------------------------------------------------------ */
/* Mapa (fichas, perguntas, respostas, notas, descobertas)             */
/* ------------------------------------------------------------------ */

export const MapSectionSchema = z.looseObject({
  ...base,
  title: z.string().min(1).max(120),
  description: text(400).default(''),
  order: z.number().default(0),
  builtIn: z.boolean().default(false),
  hidden: z.boolean().default(false),
});
export type MapSection = Known<z.infer<typeof MapSectionSchema>>;

export const QuestionSchema = z.looseObject({
  ...base,
  sectionId: id,
  text: z.string().min(1).max(500),
  hint: text(400).default(''),
  builtIn: z.boolean().default(false),
  favorite: z.boolean().default(false),
  hidden: z.boolean().default(false),
  order: z.number().default(0),
});
export type Question = Known<z.infer<typeof QuestionSchema>>;

/** Uma camada anterior de um texto reescrito. */
export const LayerSchema = z.looseObject({
  text: text(),
  at: iso,
});
export type Layer = Known<z.infer<typeof LayerSchema>>;

export const AnswerSchema = z.looseObject({
  ...base,
  questionId: id,
  text: text(),
  /** "Ainda estou pensando": resposta em aberto. */
  unfinished: z.boolean().default(false),
  /** Versões anteriores, da mais antiga para a mais recente. */
  layers: z.array(LayerSchema).max(500).default([]),
});
export type Answer = Known<z.infer<typeof AnswerSchema>>;

export const MapNoteSchema = z.looseObject({
  ...base,
  sectionId: id,
  text: z.string().min(1).max(20000),
  tags,
  layers: z.array(LayerSchema).max(500).default([]),
});
export type MapNote = Known<z.infer<typeof MapNoteSchema>>;

export const CONFIDENCE = ['hypothesis', 'recurring', 'consolidated'] as const;
export type Confidence = (typeof CONFIDENCE)[number];

export const DiscoveryRevisionSchema = z.looseObject({
  at: iso,
  title: text(300),
  description: text(),
  confidence: z.enum(CONFIDENCE),
  status: z.enum(['active', 'superseded']).default('active'),
  /** Por que a percepção mudou. */
  note: text().default(''),
});
export type DiscoveryRevision = Known<z.infer<typeof DiscoveryRevisionSchema>>;

export const DiscoverySchema = z.looseObject({
  ...base,
  title: z.string().min(1).max(300),
  description: text().default(''),
  sectionId: id.nullable().default(null),
  /** Data da descoberta (YYYY-MM-DD ou ISO). */
  at: iso,
  tags,
  confidence: z.enum(CONFIDENCE).default('hypothesis'),
  /** "superseded": a percepção mudou e deixou de valer. */
  status: z.enum(['active', 'superseded']).default('active'),
  /** Estado anterior a cada alteração relevante (camadas). */
  revisions: z.array(DiscoveryRevisionSchema).max(500).default([]),
  experienceIds: z.array(id).max(500).default([]),
  moodEntryIds: z.array(id).max(500).default([]),
  eventIds: z.array(id).max(500).default([]),
  /** Se nasceu de uma associação sugerida pela Trajetória, guardamos a origem. */
  origin: z.enum(['user', 'pattern', 'experience']).default('user'),
});
export type Discovery = Known<z.infer<typeof DiscoverySchema>>;

/* ------------------------------------------------------------------ */
/* Linha do tempo: acontecimentos significativos                       */
/* ------------------------------------------------------------------ */

export const EVENT_CATEGORIES = ['viagem', 'trabalho', 'relacoes', 'conflito', 'conquista', 'projeto', 'rotina', 'inicio', 'encerramento', 'saude', 'medicacao', 'outro'] as const;
export type EventCategory = (typeof EVENT_CATEGORIES)[number];

export const LifeEventSchema = z.looseObject({
  ...base,
  title: z.string().min(1).max(200),
  description: text().default(''),
  /** Data de início (YYYY-MM-DD, calendário local). Pode ser retroativa. */
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  /** Fim, para acontecimentos que duram um período. */
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().default(null),
  category: z.enum(EVENT_CATEGORIES).default('outro'),
  tags,
});
export type LifeEvent = Known<z.infer<typeof LifeEventSchema>>;

/* ------------------------------------------------------------------ */
/* Guia                                                                */
/* ------------------------------------------------------------------ */

export const ChecklistItemSchema = z.looseObject({
  id,
  text: z.string().min(1).max(500),
  done: z.boolean().default(false),
});

export const SituationSchema = z.looseObject({
  ...base,
  title: z.string().min(1).max(200),
  description: text().default(''),
  /** Data de início (YYYY-MM-DD) para eventos; null para situações recorrentes. */
  date: z.string().max(40).nullable().default(null),
  endDate: z.string().max(40).nullable().default(null),
  tags,
  itemIds: z.array(id).max(500).default([]),
  discoveryIds: z.array(id).max(500).default([]),
  questionIds: z.array(id).max(500).default([]),
  noteIds: z.array(id).max(500).default([]),
  letterIds: z.array(id).max(500).default([]),
  checklist: z.array(ChecklistItemSchema).max(300).default([]),
  archived: z.boolean().default(false),
});
export type Situation = Known<z.infer<typeof SituationSchema>>;

export const LetterSchema = z.looseObject({
  ...base,
  title: text(200).default(''),
  body: text(100000).default(''),
  /** Data (YYYY-MM-DD) a partir da qual a carta deve ser aberta. */
  openAt: z.string().max(40).nullable().default(null),
  /** Se lacrada, o conteúdo fica oculto até openAt. */
  sealed: z.boolean().default(false),
  openedAt: iso.nullable().default(null),
  situationId: id.nullable().default(null),
  tags,
});
export type Letter = Known<z.infer<typeof LetterSchema>>;

/* ------------------------------------------------------------------ */
/* Sono: uma noite por data                                            */
/* ------------------------------------------------------------------ */

export const SLEEP_TROUBLES = ['onset', 'awakenings', 'early', 'nightmares'] as const;
export const SLEEP_FACTORS = ['worry', 'anxiety', 'sadness', 'pain', 'environment', 'screens', 'caffeine', 'alcohol', 'late', 'nap', 'obligation', 'care', 'medication'] as const;
export type SleepFactor = (typeof SLEEP_FACTORS)[number];
export type SleepTrouble = (typeof SLEEP_TROUBLES)[number];

/**
 * A noite que TERMINOU na manhã de `date` (ex.: noite de 25 para 26 → date 26).
 * Há no máximo uma por data — por isso não fica dentro dos registros de humor,
 * que podem ser vários no mesmo dia.
 */
export const SleepLogSchema = z.looseObject({
  ...base,
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  /** Horas dormidas (0–24, em meias horas). */
  hours: z.number().min(0).max(24).nullable().default(null),
  /** Qualidade percebida, 1 (muito ruim) … 5 (muito boa) — como no Diário de Sono Consensual. */
  quality: Level5.nullable().default(null),
  /** Dificuldades: pegar no sono, acordar durante a noite, acordar cedo demais. */
  troubles: z.array(z.enum(SLEEP_TROUBLES)).max(4).default([]),
  /** O que pode ter atrapalhado (opcional) — para cruzar com a qualidade depois. */
  factors: z.array(z.enum(SLEEP_FACTORS)).max(13).default([]),
  note: text(2000).default(''),
});
export type SleepLog = Known<z.infer<typeof SleepLogSchema>>;

/* ------------------------------------------------------------------ */
/* Acompanhamento: questionários, pauta da consulta, plano de segurança */
/* ------------------------------------------------------------------ */

export const INSTRUMENTS = ['phq9', 'gad7'] as const;
export type Instrument = (typeof INSTRUMENTS)[number];

/** Uma aplicação de um questionário padronizado (PHQ-9, GAD-7). */
export const AssessmentSchema = z.looseObject({
  ...base,
  instrument: z.enum(INSTRUMENTS),
  /** Data em que foi respondido (calendário local); a janela é "as últimas 2 semanas". */
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  /** Respostas item a item (0–3). */
  answers: z.array(z.number().int().min(0).max(3)).min(7).max(9),
  /** Pergunta final de dificuldade funcional (0–3), opcional. */
  difficulty: z.number().int().min(0).max(3).nullable().default(null),
  note: text(4000).default(''),
});
export type Assessment = Known<z.infer<typeof AssessmentSchema>>;

/** Assuntos para levar à próxima consulta. */
export const AgendaItemSchema = z.looseObject({
  ...base,
  text: z.string().min(1).max(2000),
  /** Para quem: psiquiatra, psicóloga(o), ambos ou outro profissional. */
  forWhom: z.enum(['psiquiatria', 'psicologia', 'ambos', 'outro']).default('ambos'),
  /** Já conversado; com a data. */
  doneAt: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().default(null),
  /** O que ficou combinado/anotado depois da consulta. */
  outcome: text(4000).default(''),
  /** Consulta em que foi (ou será) conversado. */
  appointmentId: id.nullable().default(null),
  /** Dias relacionados ("quando aconteceu"), para abrir os registros na consulta. */
  dates: z.array(z.string().regex(/^\d{4}-\d{2}-\d{2}$/)).max(60).default([]),
});
export type AgendaItem = Known<z.infer<typeof AgendaItemSchema>>;

export const PROFESSIONS = ['psiquiatria', 'psicologia', 'outro'] as const;
export const REQUESTS = ['receita', 'atestado', 'exames', 'relatorio', 'outro'] as const;

/** Uma consulta: antes (preparo), o dia (lembrete) e depois (o que ficou). */
export const AppointmentSchema = z.looseObject({
  ...base,
  date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  time: z.string().regex(/^\d{2}:\d{2}$/).nullable().default(null),
  forWhom: z.enum(PROFESSIONS).default('psiquiatria'),
  /** Nome do profissional (opcional). */
  professional: z.string().max(120).default(''),
  /** Local ou "online". */
  place: z.string().max(200).default(''),
  status: z.enum(['scheduled', 'done', 'canceled']).default('scheduled'),
  /** Lembrete local: minutos antes; null = sem lembrete. */
  reminderMinutes: z.number().int().min(0).max(10080).nullable().default(null),
  /** Mostrar o tipo de consulta na notificação (padrão: texto neutro, por privacidade). */
  reminderShowsType: z.boolean().default(false),
  // Antes
  sinceLast: text(8000).default(''),
  questions: text(8000).default(''),
  requests: z.array(z.enum(REQUESTS)).max(5).default([]),
  // Depois
  observations: text(8000).default(''),
  agreements: text(8000).default(''),
});
export type Appointment = Known<z.infer<typeof AppointmentSchema>>;

export const STOP_REASONS = ['efeitos', 'sem_efeito', 'melhora', 'troca', 'custo', 'outro'] as const;

/** Um medicamento: doses ao longo do tempo e observações datadas. */
export const MedicationSchema = z.looseObject({
  ...base,
  name: z.string().min(1).max(120),
  /** Para que foi indicado (nas suas palavras). */
  purpose: z.string().max(300).default(''),
  prescriber: z.string().max(120).default(''),
  startDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
  /** null = em uso. */
  endDate: z.string().regex(/^\d{4}-\d{2}-\d{2}$/).nullable().default(null),
  stopReason: z.enum(STOP_REASONS).nullable().default(null),
  /** Histórico de dose: a primeira é a inicial; a última, a atual. */
  doses: z
    .array(
      z.looseObject({
        date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/),
        dose: z.string().max(80),
        schedule: z.string().max(160).default(''),
        note: z.string().max(1000).default(''),
      }),
    )
    .min(1)
    .max(200),
  /** Observações datadas: efeitos percebidos, dúvidas, como se sentiu. */
  notes: z.array(z.looseObject({ date: z.string().regex(/^\d{4}-\d{2}-\d{2}$/), text: z.string().min(1).max(4000) })).max(500).default([]),
});
export type Medication = Known<z.infer<typeof MedicationSchema>>;

const lines = z.array(z.string().max(500)).max(30).default([]);
/** Plano de segurança (modelo Stanley-Brown). Há no máximo um. */
export const SafetyPlanSchema = z.looseObject({
  ...base,
  warningSigns: lines,
  copingAlone: lines,
  distractions: lines,
  helpers: lines,
  professionals: lines,
  safeEnvironment: lines,
  reasons: lines,
});
export type SafetyPlan = Known<z.infer<typeof SafetyPlanSchema>>;

/* ------------------------------------------------------------------ */
/* Preferências (exportáveis)                                          */
/* ------------------------------------------------------------------ */

export const ThemeColorsSchema = z.looseObject({
  primary: z.string(),
  accent: z.string(),
  background: z.string(),
  surface: z.string(),
  complement1: z.string(),
  complement2: z.string(),
});
export type ThemeColors = Known<z.infer<typeof ThemeColorsSchema>>;

export const CustomThemeSchema = z.looseObject({
  ...base,
  name: z.string().min(1).max(60),
  colors: ThemeColorsSchema,
  radius: z.number().min(0).max(28).default(14),
  cardStyle: z.enum(['outline', 'filled', 'paper']).default('filled'),
  displayFont: z.enum(['fraunces', 'cormorant', 'lora']).default('fraunces'),
});
export type CustomTheme = Known<z.infer<typeof CustomThemeSchema>>;

export const PreferencesSchema = z.looseObject({
  /** Rótulos personalizados das 5 categorias de valência; null = padrão. */
  valenceLabels: z.array(z.string().max(60).nullable()).length(5).default([null, null, null, null, null]),
  energyLabels: z.array(z.string().max(60).nullable()).length(5).default([null, null, null, null, null]),
  enabledIndicators: z.array(IndicatorKeySchema).default([]),
  showEnergy: z.boolean().default(true),
  themeId: z.string().default('papel'),
  appearance: z.enum(['system', 'light', 'dark']).default('system'),
  customThemes: z.array(CustomThemeSchema).default([]),
  displayFont: z.enum(['theme', 'fraunces', 'cormorant', 'lora']).default('theme'),
  textScale: z.number().min(0.85).max(1.4).default(1),
  reduceMotion: z.boolean().default(false),
  weekStartsOn: z.union([z.literal(0), z.literal(1)]).default(1),
  /** Mostrar "camadas antigas" na tela inicial. */
  resurfacing: z.boolean().default(true),
  /** Estilo visual, independente da paleta: minimalista (padrão) ou orgânico. */
  visualStyle: z.enum(['minimal', 'organic']).default('minimal'),
  /** Família de símbolos da escala de valência. */
  symbolSet: z.enum(['nature', 'faces', 'fine', 'moon', 'weather', 'emoji']).default('nature'),
  /** Categorias da Trajetória que o usuário escolheu ocultar. */
  trajectoryHidden: z.array(z.string().max(40)).max(40).default([]),
  /** Hemisfério, para as estações do ano no calendário (sem usar localização). */
  hemisphere: z.enum(['south', 'north']).default('south'),
  /** Acompanhar o sono (horas, qualidade e dificuldades), uma vez por noite. */
  trackSleep: z.boolean().default(false),
  /** Mostrar "O que seus registros mostram". */
  showInsights: z.boolean().default(true),
  /** Observações sugeridas que o usuário ocultou (por id). */
  dismissedInsights: z.array(z.string().max(200)).max(500).default([]),
});
export type Preferences = Known<z.infer<typeof PreferencesSchema>>;

/* ------------------------------------------------------------------ */
/* Documento completo                                                  */
/* ------------------------------------------------------------------ */

export const COLLECTIONS = [
  'moodEntries',
  'emotions',
  'experiences',
  'repertoire',
  'uses',
  'sections',
  'questions',
  'answers',
  'notes',
  'discoveries',
  'situations',
  'letters',
  'events',
  'assessments',
  'agenda',
  'safetyPlans',
  'sleepLogs',
  'appointments',
  'medications',
] as const;
export type CollectionName = (typeof COLLECTIONS)[number];

export const CollectionSchemas = {
  moodEntries: MoodEntrySchema,
  emotions: EmotionSchema,
  experiences: ExperienceSchema,
  repertoire: RepertoireItemSchema,
  uses: StrategyUseSchema,
  sections: MapSectionSchema,
  questions: QuestionSchema,
  answers: AnswerSchema,
  notes: MapNoteSchema,
  discoveries: DiscoverySchema,
  situations: SituationSchema,
  letters: LetterSchema,
  events: LifeEventSchema,
  assessments: AssessmentSchema,
  agenda: AgendaItemSchema,
  safetyPlans: SafetyPlanSchema,
  sleepLogs: SleepLogSchema,
  appointments: AppointmentSchema,
  medications: MedicationSchema,
} as const;

export type EntityOf<C extends CollectionName> = Known<z.infer<(typeof CollectionSchemas)[C]>>;

export const AppDataSchema = z.looseObject({
  schemaVersion: z.literal(SCHEMA_VERSION),
  moodEntries: z.array(MoodEntrySchema).default([]),
  emotions: z.array(EmotionSchema).default([]),
  experiences: z.array(ExperienceSchema).default([]),
  repertoire: z.array(RepertoireItemSchema).default([]),
  uses: z.array(StrategyUseSchema).default([]),
  sections: z.array(MapSectionSchema).default([]),
  questions: z.array(QuestionSchema).default([]),
  answers: z.array(AnswerSchema).default([]),
  notes: z.array(MapNoteSchema).default([]),
  discoveries: z.array(DiscoverySchema).default([]),
  situations: z.array(SituationSchema).default([]),
  letters: z.array(LetterSchema).default([]),
  events: z.array(LifeEventSchema).default([]),
  assessments: z.array(AssessmentSchema).default([]),
  agenda: z.array(AgendaItemSchema).default([]),
  safetyPlans: z.array(SafetyPlanSchema).max(1).default([]),
  sleepLogs: z.array(SleepLogSchema).default([]),
  appointments: z.array(AppointmentSchema).default([]),
  medications: z.array(MedicationSchema).default([]),
  preferences: PreferencesSchema.default(PreferencesSchema.parse({})),
});
export type AppData = Known<z.infer<typeof AppDataSchema>>;

/**
 * Configurações do dispositivo — NÃO fazem parte do backup.
 * (Bloqueio, hash do PIN e afins pertencem a esta instalação.)
 */
export const DeviceSettingsSchema = z.looseObject({
  lock: z
    .looseObject({
      enabled: z.boolean().default(false),
      pinHash: z.string().default(''),
      salt: z.string().default(''),
      iterations: z.number().int().default(0),
      biometric: z.boolean().default(false),
      /** Segundos em segundo plano antes de bloquear novamente. */
      timeoutSec: z.number().int().min(0).default(60),
    })
    .default({ enabled: false, pinHash: '', salt: '', iterations: 0, biometric: false, timeoutSec: 60 }),
  privacyScreen: z.boolean().default(true),
  onboardingDone: z.boolean().default(false),
  lastBackupAt: iso.nullable().default(null),
  failedUnlocks: z.number().int().default(0),
  lockedUntil: z.number().default(0),
});
export type DeviceSettings = Known<z.infer<typeof DeviceSettingsSchema>>;
