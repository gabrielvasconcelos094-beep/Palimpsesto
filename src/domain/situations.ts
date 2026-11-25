/**
 * Reúne o que o próprio usuário já registrou e que pode ser útil diante de
 * uma situação. Nada aqui é conselho genérico: só aparecem registros do
 * usuário, com o motivo pelo qual apareceram.
 */
import type { AppData, Answer, Discovery, Experience, Letter, MapNote, RepertoireItem, Situation } from './schema';
import { fold, tagsOverlap } from './util';
import { outcomeCounts } from './analytics';

const STOP = new Set(
  'para com sem uma umas uns que como mais muito pouco depois antes quando onde porque sobre entre ate pela pelo pelas pelos nas nos das dos meu minha meus minhas seu sua seus suas este esta esse essa isso isto aquele aquela dia dias'.split(
    ' ',
  ),
);

/** Radicais simples (6 letras) das palavras relevantes. */
export function stems(texts: string[]): string[] {
  const out = new Set<string>();
  for (const t of texts)
    for (const w of fold(t).split(/[^a-z0-9]+/)) {
      if (w.length < 4 || STOP.has(w)) continue;
      out.add(w.slice(0, Math.min(6, Math.max(4, w.length - 2))));
    }
  return [...out];
}

function textMatches(text: string, st: string[]): boolean {
  if (!st.length) return false;
  const words = fold(text).split(/[^a-z0-9]+/);
  return st.some((s) => words.some((w) => w.startsWith(s)));
}

export type Why = 'vinculado' | 'marcador' | 'palavras';

export interface Gathered {
  discoveries: Array<{ x: Discovery; why: Why }>;
  items: Array<{ x: RepertoireItem; why: Why; worked: number; total: number }>;
  answers: Array<{ x: Answer; question: string; section: string; why: Why }>;
  notes: Array<{ x: MapNote; section: string; why: Why }>;
  experiences: Array<{ x: Experience; why: Why | 'situação' }>;
  letters: Array<{ x: Letter; why: Why | 'situação' }>;
  /** Necessidades e limites registrados (sempre relevantes para preparação). */
  essentials: Array<{ question: string; text: string; section: string }>;
}

export function gatherForSituation(data: AppData, s: Situation): Gathered {
  const st = stems([s.title, ...s.tags]);
  const secTitle = new Map(data.sections.map((x) => [x.id, x.title]));
  const qMap = new Map(data.questions.map((q) => [q.id, q]));

  const why = (linked: boolean, tags: string[], ...texts: string[]): Why | null => {
    if (linked) return 'vinculado';
    if (tagsOverlap(tags, s.tags).length) return 'marcador';
    if (textMatches(texts.join(' '), st)) return 'palavras';
    return null;
  };
  const rank = (w: string) => ({ vinculado: 0, 'situação': 0, marcador: 1, palavras: 2 })[w] ?? 3;
  const byWhy = <T extends { why: string }>(a: T, b: T) => rank(a.why) - rank(b.why);

  const discoveries = data.discoveries
    .filter((d) => d.status === 'active')
    .map((x) => ({ x, why: why(s.discoveryIds.includes(x.id), x.tags, x.title, x.description) }))
    .filter((r): r is { x: Discovery; why: Why } => r.why !== null)
    .sort(byWhy);

  const items = data.repertoire
    .filter((i) => !i.archived)
    .map((x) => {
      const uses = data.uses.filter((u) => u.itemId === x.id);
      const ctxUses = uses.filter((u) => tagsOverlap(u.tags, s.tags).length);
      const relevantUses = ctxUses.length ? ctxUses : uses;
      const c = outcomeCounts(relevantUses);
      const useTags = uses.flatMap((u) => u.tags);
      return {
        x,
        why: why(s.itemIds.includes(x.id), [...x.tags, ...useTags], x.name, x.circumstances, x.description),
        worked: c.worked + c.partial,
        total: relevantUses.length,
      };
    })
    .filter((r): r is { x: RepertoireItem; why: Why; worked: number; total: number } => r.why !== null)
    .sort((a, b) => byWhy(a, b) || b.worked - a.worked);

  const answers = data.answers
    .filter((a) => a.text.trim())
    .map((x) => {
      const q = qMap.get(x.questionId);
      return {
        x,
        question: q?.text ?? '',
        section: secTitle.get(q?.sectionId ?? '') ?? '',
        why: why(s.questionIds.includes(x.questionId), [], x.text, q?.text ?? ''),
      };
    })
    .filter((r): r is Gathered['answers'][number] => r.why !== null)
    .sort(byWhy);

  const notes = data.notes
    .map((x) => ({ x, section: secTitle.get(x.sectionId) ?? '', why: why(s.noteIds.includes(x.id), x.tags, x.text) }))
    .filter((r): r is Gathered['notes'][number] => r.why !== null)
    .sort(byWhy);

  const experiences = data.experiences
    .map((x) => ({
      x,
      why: x.situationId === s.id ? ('situação' as const) : why(false, x.tags, x.title),
    }))
    .filter((r): r is Gathered['experiences'][number] => r.why !== null)
    .sort((a, b) => byWhy(a, b) || b.x.at.localeCompare(a.x.at));

  const letters = data.letters
    .map((x) => ({
      x,
      why: x.situationId === s.id || s.letterIds.includes(x.id) ? ('situação' as const) : why(false, x.tags, x.title),
    }))
    .filter((r): r is Gathered['letters'][number] => r.why !== null);

  const essentialSections = new Set(['sec.necessidades', 'sec.limites']);
  const shownAnswers = new Set(answers.map((a) => a.x.id));
  const essentials = data.answers
    .filter((a) => a.text.trim() && !shownAnswers.has(a.id))
    .map((a) => ({ a, q: qMap.get(a.questionId) }))
    .filter(({ q }) => q && essentialSections.has(q.sectionId))
    .map(({ a, q }) => ({ question: q!.text, text: a.text, section: secTitle.get(q!.sectionId) ?? '' }));

  return { discoveries, items, answers, notes, experiences, letters, essentials };
}

export function isUpcoming(s: Situation, now = new Date(), days = 21): boolean {
  if (!s.date || s.archived) return false;
  const d = new Date(s.date.slice(0, 10) + 'T12:00:00');
  const end = s.endDate ? new Date(s.endDate.slice(0, 10) + 'T23:59:59') : new Date(s.date.slice(0, 10) + 'T23:59:59');
  const diff = (d.getTime() - now.getTime()) / 86400000;
  return diff <= days && end.getTime() >= now.getTime() - 86400000;
}
