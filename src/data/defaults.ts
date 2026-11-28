import { AppDataSchema, DeviceSettingsSchema, SCHEMA_VERSION, type AppData, type DeviceSettings } from '../domain/schema';
import { BUILTIN_EMOTIONS, BUILTIN_SECTIONS, SEED_REVISION } from '../domain/seed';

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

export const builtInQuestionId = (sectionId: string, index: number) => `${sectionId.replace('sec.', 'q.')}.${String(index + 1).padStart(2, '0')}`;

/**
 * Acrescenta emoções, fichas e perguntas nativas que ainda não existam
 * (por id). Nunca altera nem reativa itens que o usuário editou ou ocultou.
 * Depois, uma única vez por revisão do conteúdo (preferences.seedRevision), aplica
 * reformulações e retiradas — ver reviseBuiltIns.
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
        order: s.order ?? si,
        builtIn: true,
        hidden: false,
        createdAt: now,
        updatedAt: now,
      });
      changed = true;
    }
    s.questions.forEach((q, qi) => {
      const qid = builtInQuestionId(s.id, qi);
      // Retiradas não são criadas; a posição (e o id) continua reservada.
      if (!qIds.has(qid) && !q.retired) {
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
  const synced = changed ? { ...data, emotions, sections, questions } : data;
  return reviseBuiltIns(synced, now);
}

/**
 * Aplica a revisão do conteúdo nativo do Mapa a dados existentes, uma vez:
 * - reformulação: troca o texto só se a pergunta não foi editada (o texto guardado é
 *   um dos anteriores) E não tem resposta — quem respondeu continua vendo a pergunta
 *   que respondeu;
 * - dica: atualizada quando o texto é o nativo (dicas não são conteúdo do usuário);
 * - retirada: oculta só se não foi editada, não tem resposta e não é favorita.
 * Depois grava preferences.seedRevision, para que escolhas posteriores da pessoa
 * (ex.: mostrar de novo uma pergunta retirada) nunca sejam desfeitas.
 */
export function reviseBuiltIns(data: AppData, now = new Date().toISOString()): AppData {
  if (data.preferences.seedRevision >= SEED_REVISION) return data;
  const answered = new Set(data.answers.filter((a) => a.text.trim()).map((a) => a.questionId));
  const seeds = new Map<string, (typeof BUILTIN_SECTIONS)[number]['questions'][number]>();
  BUILTIN_SECTIONS.forEach((s) => s.questions.forEach((q, qi) => seeds.set(builtInQuestionId(s.id, qi), q)));
  const questions = data.questions.map((q) => {
    const seed = q.builtIn ? seeds.get(q.id) : undefined;
    if (!seed) return q;
    const isCurrent = q.text === seed.text;
    const isOld = (seed.was ?? []).includes(q.text);
    if (!isCurrent && !isOld) return q; // editada pela pessoa: intocada
    if (seed.retired) return !answered.has(q.id) && !q.favorite && !q.hidden ? { ...q, hidden: true, updatedAt: now } : q;
    if (isOld && !answered.has(q.id)) return { ...q, text: seed.text, hint: seed.hint ?? '', updatedAt: now };
    if (isCurrent && q.hint !== (seed.hint ?? '')) return { ...q, hint: seed.hint ?? '', updatedAt: now };
    return q;
  });
  return { ...data, questions, preferences: { ...data.preferences, seedRevision: SEED_REVISION } };
}
