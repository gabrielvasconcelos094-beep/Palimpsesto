/**
 * Modelo de dados do Palimpsesto (schemaVersion 1).
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
 */
import { z } from 'zod';

export const SCHEMA_VERSION = 1;

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

export const INDICATOR_KEYS = ['sleep', 'anxiety', 'irritability', 'overload', 'loneliness'] as const;
export type IndicatorKey = (typeof INDICATOR_KEYS)[number];
export const IndicatorKeySchema = z.enum(INDICATOR_KEYS);

/* ------------------------------------------------------------------ */
/* Diário                                                              */
/* ------------------------------------------------------------------ */

export const MoodEntrySchema = z.looseObject({
  ...base,
  /** Momento ao qual o registro se refere (editável). */
  at: iso,
  valence: Valence,
  energy: Energy.nullable().default(null),
  emotionIds: z.array(id).max(60).default([]),
  indicators: z.partialRecord(IndicatorKeySchema, Level5).default({}),
  /** Contexto: o que estava acontecendo (ex.: "dormi mal", "tempo só"). */
  tags,
  note: text().default(''),
});
export type MoodEntry = Known<z.infer<typeof MoodEntrySchema>>;

export const EmotionSchema = z.looseObject({
  ...base,
  label: z.string().min(1).max(60),
  builtIn: z.boolean().default(false),
  hidden: z.boolean().default(false),
});
export type Emotion = Known<z.infer<typeof EmotionSchema>>;

export const ExperienceSchema = z.looseObject({
  ...base,
  at: iso,
  title: text(200).default(''),
  whatHappened: text().default(''),
  feelingBefore: Valence.nullable().default(null),
  emotionIds: z.array(id).max(60).default([]),
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

export const REPERTOIRE_KINDS = ['resource', 'strategy', 'drain'] as const;
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
  at: iso,
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
  /** Se nasceu de uma associação sugerida pela Trajetória, guardamos a origem. */
  origin: z.enum(['user', 'pattern', 'experience']).default('user'),
});
export type Discovery = Known<z.infer<typeof DiscoverySchema>>;

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
