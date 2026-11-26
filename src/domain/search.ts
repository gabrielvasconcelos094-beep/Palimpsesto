/**
 * Busca geral, local e instantânea. Ignora acentos e maiúsculas; todas as
 * palavras digitadas precisam aparecer (em qualquer campo do registro).
 */
import type { AppData } from './schema';
import { valenceLabel } from './scales';
import { fold, isRetroSafe } from './searchUtil';

export type SearchKind = 'mood' | 'experience' | 'event' | 'discovery' | 'answer' | 'note' | 'item' | 'letter' | 'situation' | 'emotion';

export const SEARCH_KIND_LABELS: Record<SearchKind, string> = {
  mood: 'Humor',
  experience: 'Experiências',
  event: 'Acontecimentos',
  discovery: 'Descobertas',
  answer: 'Respostas do Mapa',
  note: 'Anotações',
  item: 'Repertório',
  letter: 'Cartas',
  situation: 'Situações',
  emotion: 'Emoções',
};

export interface SearchHit {
  kind: SearchKind;
  id: string;
  title: string;
  snippet: string;
  /** Dia (AAAA-MM-DD) em que aconteceu, quando houver. */
  day: string | null;
  /** Rota para abrir o resultado. */
  route: string;
  score: number;
}

export interface SearchOptions {
  kinds?: SearchKind[];
  from?: string | null;
  to?: string | null;
  limit?: number;
}

function snippet(text: string, words: string[], max = 140): string {
  const t = text.replace(/\s+/g, ' ').trim();
  if (t.length <= max) return t;
  const f = fold(t);
  const pos = Math.max(0, Math.min(...words.map((w) => f.indexOf(w)).filter((i) => i >= 0), t.length));
  const start = Math.max(0, pos - 40);
  return (start > 0 ? '…' : '') + t.slice(start, start + max) + (start + max < t.length ? '…' : '');
}

export function searchAll(data: AppData, query: string, opts: SearchOptions = {}): SearchHit[] {
  const words = fold(query).split(' ').filter((w) => w.length >= 2);
  if (!words.length) return [];
  const kinds = new Set(opts.kinds?.length ? opts.kinds : (Object.keys(SEARCH_KIND_LABELS) as SearchKind[]));
  const inRange = (day: string | null) => !day || ((!opts.from || day >= opts.from) && (!opts.to || day <= opts.to));
  const dated = !!(opts.from || opts.to);
  const emo = new Map(data.emotions.map((e) => [e.id, e.label]));
  const items = new Map(data.repertoire.map((i) => [i.id, i.name]));
  const qText = new Map(data.questions.map((q) => [q.id, q]));
  const hits: SearchHit[] = [];

  const consider = (kind: SearchKind, h: Omit<SearchHit, 'kind' | 'score'>, fields: Array<string | undefined | null>, titleField = h.title) => {
    if (!kinds.has(kind)) return;
    if (dated && (!h.day || !inRange(h.day))) return;
    const hay = fields.filter(Boolean).map((x) => fold(x!));
    const all = hay.join(' \u0001 ');
    if (!words.every((w) => all.includes(w))) return;
    const ft = fold(titleField);
    const score = words.reduce((s, w) => s + (ft.includes(w) ? 3 : 1), 0) + (h.day ? 0.001 * Number(h.day.replace(/-/g, '')) / 1e5 : 0);
    hits.push({ kind, ...h, score });
  };

  for (const m of data.moodEntries) {
    const emotions = m.emotionIds.map((i) => emo.get(i) ?? '');
    const acts = m.itemIds.map((i) => items.get(i) ?? '');
    const label = valenceLabel(m.valence, data.preferences.valenceLabels);
    consider(
      'mood',
      { id: m.id, title: `${label}${emotions.length ? ' · ' + emotions.join(', ') : ''}`, snippet: m.note || [...acts, ...m.tags].join(', '), day: m.at.slice(0, 10), route: `/diario?registro=${m.id}` },
      [m.note, label, ...emotions, ...acts, ...m.tags],
    );
  }
  for (const x of data.experiences) {
    const body = [x.whatHappened, x.thoughts, x.alternativeThought, x.whatIDid, x.whatHelped, x.whatWorsened, x.howIFeltAfter, x.learned].filter(Boolean).join(' — ');
    consider('experience', { id: x.id, title: x.title || 'Experiência', snippet: snippet(body, words), day: x.at.slice(0, 10), route: `/diario/experiencia/${x.id}` }, [
      x.title,
      body,
      ...x.tags,
      ...x.emotionIds.map((i) => emo.get(i)),
    ]);
  }
  for (const e of data.events)
    consider('event', { id: e.id, title: e.title, snippet: snippet(e.description, words), day: e.date, route: `/diario/acontecimento/${e.id}` }, [e.title, e.description, ...e.tags]);
  for (const d of data.discoveries)
    consider('discovery', { id: d.id, title: d.title, snippet: snippet(d.description, words), day: d.at.slice(0, 10), route: `/mapa/descoberta/${d.id}` }, [
      d.title,
      d.description,
      ...d.tags,
      ...d.revisions.map((r) => `${r.title} ${r.note}`),
    ]);
  for (const a of data.answers) {
    const q = qText.get(a.questionId);
    if (!a.text.trim()) continue;
    consider('answer', { id: a.id, title: q?.text ?? 'Resposta', snippet: snippet(a.text, words), day: null, route: `/mapa/pergunta/${a.questionId}` }, [a.text, ...a.layers.map((l) => l.text)], a.text);
  }
  for (const n of data.notes)
    consider('note', { id: n.id, title: data.sections.find((s) => s.id === n.sectionId)?.title ?? 'Anotação', snippet: snippet(n.text, words), day: null, route: `/mapa/ficha/${n.sectionId}` }, [
      n.text,
      ...n.tags,
    ], n.text);
  for (const i of data.repertoire)
    consider('item', { id: i.id, title: i.name, snippet: snippet([i.description, i.circumstances, i.effect, i.notes].filter(Boolean).join(' — '), words), day: null, route: `/guia/item/${i.id}` }, [
      i.name,
      i.description,
      i.circumstances,
      i.effect,
      i.notes,
      i.category,
      ...i.tags,
    ]);
  for (const l of data.letters) {
    const sealed = isRetroSafe(l);
    consider('letter', { id: l.id, title: l.title || 'Carta', snippet: sealed ? 'Carta lacrada' : snippet(l.body, words), day: null, route: `/guia/carta/${l.id}` }, sealed ? [l.title, ...l.tags] : [l.title, l.body, ...l.tags]);
  }
  for (const s of data.situations)
    consider('situation', { id: s.id, title: s.title, snippet: snippet(s.description, words), day: s.date, route: `/guia/situacao/${s.id}` }, [s.title, s.description, ...s.tags, ...s.checklist.map((c) => c.text)]);
  for (const e of data.emotions) {
    const n = data.moodEntries.filter((m) => m.emotionIds.includes(e.id)).length;
    consider('emotion', { id: e.id, title: e.label, snippet: `${n} registro(s) de humor com esta emoção`, day: null, route: `/guia/emocao/${e.id}` }, [e.label, e.signals, e.helps, e.worsens]);
  }
  return hits.sort((a, b) => b.score - a.score).slice(0, opts.limit ?? 200);
}
