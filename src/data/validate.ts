import { AppDataSchema, COLLECTIONS, type AppData, type CollectionName } from '../domain/schema';
import { migrate } from './migrations';

export interface IntegrityReport {
  duplicateIds: number;
  danglingRefs: number;
  notes: string[];
}

export interface ParseResult {
  ok: true;
  data: AppData;
  migratedFrom: number;
  integrity: IntegrityReport;
}
export interface ParseError {
  ok: false;
  error: string;
  details?: string[];
}

/** Migra, valida e repara referências. Nunca lança: devolve erro descritivo. */
export function parseAppData(raw: unknown): ParseResult | ParseError {
  let migrated;
  try {
    migrated = migrate(raw);
  } catch (e: any) {
    return { ok: false, error: e?.message ?? String(e) };
  }
  const res = AppDataSchema.safeParse(migrated.data);
  if (!res.success) {
    const details = res.error.issues.slice(0, 12).map((i) => `${i.path.join('.')}: ${i.message}`);
    return { ok: false, error: 'O conteúdo não corresponde ao formato esperado.', details };
  }
  const { data, report } = repairIntegrity(res.data);
  return { ok: true, data, migratedFrom: migrated.from, integrity: report };
}

/**
 * Remove ids duplicados (mantém a versão mais recente) e limpa
 * referências para entidades inexistentes.
 */
const SAFETY_PLAN_FIELDS = ['warningSigns', 'copingAlone', 'distractions', 'helpers', 'professionals', 'safeEnvironment', 'reasons'] as const;

export function repairIntegrity(input: AppData): { data: AppData; report: IntegrityReport } {
  const report: IntegrityReport = { duplicateIds: 0, danglingRefs: 0, notes: [] };
  const data: any = { ...input };
  for (const c of COLLECTIONS) {
    const map = new Map<string, any>();
    for (const e of (input as any)[c] as any[]) {
      const prev = map.get(e.id);
      if (prev) {
        report.duplicateIds++;
        if ((e.updatedAt ?? '') >= (prev.updatedAt ?? '')) map.set(e.id, e);
      } else map.set(e.id, e);
    }
    data[c] = [...map.values()];
  }
  // Sono: no máximo uma noite por data (fica a versão alterada por último).
  const nights = new Map<string, any>();
  for (const s of data.sleepLogs as any[]) {
    const prev = nights.get(s.date);
    if (!prev || (s.updatedAt ?? '') >= (prev.updatedAt ?? '')) nights.set(s.date, s);
  }
  if (nights.size !== data.sleepLogs.length) report.notes.push(`${data.sleepLogs.length - nights.size} noite(s) de sono repetida(s) na mesma data foram unificadas.`);
  data.sleepLogs = [...nights.values()];
  const has = (c: CollectionName) => new Set<string>((data[c] as any[]).map((e) => e.id));
  const emo = has('emotions');
  const items = has('repertoire');
  const exps = has('experiences');
  const secs = has('sections');
  const qs = has('questions');
  const notes = has('notes');
  const discs = has('discoveries');
  const sits = has('situations');
  const letters = has('letters');
  const moods = has('moodEntries');
  const evs = has('events');

  const keep = (set: Set<string>) => (ids: string[]) => {
    const out = ids.filter((i) => set.has(i));
    report.danglingRefs += ids.length - out.length;
    return out;
  };
  const nullIfMissing = (set: Set<string>, v: string | null) => {
    if (v && !set.has(v)) {
      report.danglingRefs++;
      return null;
    }
    return v;
  };

  data.moodEntries = data.moodEntries.map((m: any) => ({ ...m, emotionIds: keep(emo)(m.emotionIds), itemIds: keep(items)(m.itemIds ?? []) }));
  data.experiences = data.experiences.map((x: any) => ({
    ...x,
    emotionIds: keep(emo)(x.emotionIds),
    situationId: nullIfMissing(sits, x.situationId),
  }));
  const usesBefore = data.uses.length;
  data.uses = data.uses
    .filter((u: any) => items.has(u.itemId))
    .map((u: any) => ({ ...u, experienceId: nullIfMissing(exps, u.experienceId) }));
  if (data.uses.length !== usesBefore) {
    report.danglingRefs += usesBefore - data.uses.length;
    report.notes.push(`${usesBefore - data.uses.length} uso(s) de estratégia sem item correspondente foram descartados.`);
  }
  const qBefore = data.questions.length;
  data.questions = data.questions.filter((q: any) => secs.has(q.sectionId));
  report.danglingRefs += qBefore - data.questions.length;
  const qs2 = new Set<string>(data.questions.map((q: any) => q.id));
  const aBefore = data.answers.length;
  data.answers = data.answers.filter((a: any) => qs2.has(a.questionId));
  report.danglingRefs += aBefore - data.answers.length;
  const nBefore = data.notes.length;
  data.notes = data.notes.filter((n: any) => secs.has(n.sectionId));
  report.danglingRefs += nBefore - data.notes.length;
  data.discoveries = data.discoveries.map((d: any) => ({
    ...d,
    sectionId: nullIfMissing(secs, d.sectionId),
    experienceIds: keep(exps)(d.experienceIds),
    moodEntryIds: keep(moods)(d.moodEntryIds ?? []),
    eventIds: keep(evs)(d.eventIds ?? []),
  }));
  data.situations = data.situations.map((s: any) => ({
    ...s,
    itemIds: keep(items)(s.itemIds),
    discoveryIds: keep(discs)(s.discoveryIds),
    questionIds: keep(qs)(s.questionIds),
    noteIds: keep(notes)(s.noteIds),
    letterIds: keep(letters)(s.letterIds),
  }));
  data.letters = data.letters.map((l: any) => ({ ...l, situationId: nullIfMissing(sits, l.situationId) }));
  // Pauta: vínculo com uma consulta que não existe mais vira "sem consulta".
  const appts = has('appointments');
  data.agenda = data.agenda.map((a: any) => ({ ...a, appointmentId: nullIfMissing(appts, a.appointmentId ?? null) }));
  // Plano de segurança: no máximo um. Ao mesclar dois aparelhos podem chegar dois
  // planos com ids diferentes; em vez de recusar a importação (ou descartar um deles),
  // fica o alterado por último, somando as linhas do outro que ele não tinha.
  if (data.safetyPlans.length > 1) {
    const plans = [...data.safetyPlans].sort((a: any, b: any) => (b.updatedAt ?? '').localeCompare(a.updatedAt ?? ''));
    const merged: any = { ...plans[0] };
    for (const f of SAFETY_PLAN_FIELDS) {
      const seen = new Set<string>();
      const out: string[] = [];
      for (const p of plans)
        for (const line of (p[f] ?? []) as string[]) {
          const k = line.trim().toLocaleLowerCase('pt-BR');
          if (!k || seen.has(k)) continue;
          seen.add(k);
          out.push(line);
        }
      merged[f] = out.slice(0, 30);
    }
    report.notes.push(`${plans.length} planos de segurança foram unidos em um só (nenhuma linha foi perdida, exceto repetidas).`);
    data.safetyPlans = [merged];
  }
  if (report.duplicateIds) report.notes.push(`${report.duplicateIds} registro(s) com identificador repetido foram unificados.`);
  return { data: data as AppData, report };
}

export function countData(data: AppData): Record<CollectionName, number> {
  const out = {} as Record<CollectionName, number>;
  for (const c of COLLECTIONS) out[c] = (data as any)[c].length;
  return out;
}

export const COLLECTION_LABELS: Record<CollectionName, string> = {
  moodEntries: 'Registros de humor',
  emotions: 'Emoções (nativas e personalizadas)',
  experiences: 'Experiências',
  repertoire: 'Itens do repertório',
  uses: 'Usos de estratégias',
  sections: 'Fichas do mapa',
  questions: 'Perguntas',
  answers: 'Respostas',
  notes: 'Notas das fichas',
  discoveries: 'Descobertas',
  situations: 'Situações',
  letters: 'Cartas',
  events: 'Acontecimentos da linha do tempo',
  assessments: 'Questionários respondidos',
  agenda: 'Assuntos para a consulta',
  safetyPlans: 'Plano de segurança',
  sleepLogs: 'Noites de sono',
  appointments: 'Consultas',
  medications: 'Medicamentos',
};
