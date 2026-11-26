import { AppDataSchema, DeviceSettingsSchema, SCHEMA_VERSION, type AppData, type DeviceSettings } from '../domain/schema';
import { BUILTIN_EMOTIONS, BUILTIN_SECTIONS } from '../domain/seed';

export function emptyData(): AppData {
  return AppDataSchema.parse({ schemaVersion: SCHEMA_VERSION });
}

export function defaultDevice(): DeviceSettings {
  return DeviceSettingsSchema.parse({});
}

/** Dados iniciais de uma instalação nova. */
export function initialData(now = new Date().toISOString()): AppData {
  return syncBuiltIns(emptyData(), now);
}

/**
 * Acrescenta emoções, fichas e perguntas nativas que ainda não existam
 * (por id). Nunca altera nem reativa itens que o usuário editou ou ocultou.
 */
export function syncBuiltIns(data: AppData, now = new Date().toISOString()): AppData {
  const emoIds = new Set(data.emotions.map((e) => e.id));
  const secIds = new Set(data.sections.map((s) => s.id));
  const qIds = new Set(data.questions.map((q) => q.id));
  const emotions = [...data.emotions];
  const sections = [...data.sections];
  const questions = [...data.questions];
  let changed = false;

  for (const [id, label] of BUILTIN_EMOTIONS) {
    if (!emoIds.has(id)) {
      emotions.push({ id, label, builtIn: true, hidden: false, signals: '', helps: '', worsens: '', createdAt: now, updatedAt: now });
      changed = true;
    }
  }
  BUILTIN_SECTIONS.forEach((s, si) => {
    if (!secIds.has(s.id)) {
      sections.push({
        id: s.id,
        title: s.title,
        description: s.description,
        order: si,
        builtIn: true,
        hidden: false,
        createdAt: now,
        updatedAt: now,
      });
      changed = true;
    }
    s.questions.forEach((q, qi) => {
      const qid = `${s.id.replace('sec.', 'q.')}.${String(qi + 1).padStart(2, '0')}`;
      if (!qIds.has(qid)) {
        questions.push({
          id: qid,
          sectionId: s.id,
          text: q.text,
          hint: q.hint ?? '',
          builtIn: true,
          favorite: false,
          hidden: false,
          order: qi,
          createdAt: now,
          updatedAt: now,
        });
        changed = true;
      }
    });
  });
  return changed ? { ...data, emotions, sections, questions } : data;
}
