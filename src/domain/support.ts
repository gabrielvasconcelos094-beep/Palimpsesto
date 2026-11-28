/**
 * "Para este momento" (Hoje, 1.13): depois de um registro difícil, o app devolve o que a
 * PRÓPRIA pessoa já registrou e que tem relação com aquele contexto ou emoção.
 *
 * Princípios (ver docs/ARQUITETURA.md §19):
 * - só registros dela — nada de conselho genérico; cada sugestão diz de onde veio e
 *   leva ao registro original;
 * - ligação explícita, não adivinhação: mesmo marcador de contexto, mesma emoção, ou
 *   palavras do contexto no texto de um item (como na reunião de situações);
 * - o histórico pesa: o que foi avaliado como "não funcionou/piorou" naquele contexto
 *   não é sugerido; o que funcionou mostra quantas vezes, sem prometer nada;
 * - pouco e variado: no máximo 3, no máximo 2 do mesmo tipo;
 * - nada de "o que desgasta" nem de "o que piora": isso não é apoio para o momento.
 */
import { outcomeCounts } from './analytics';
import { strategyGroups } from './insights';
import type { AppData, MoodEntry, RepertoireItem } from './schema';
import { stems } from './situations';
import { dayKey, fold, tagsOverlap } from './util';

export type SupportKind = 'item' | 'emotion' | 'situation' | 'discovery' | 'letter' | 'pattern';

export interface Suggestion {
  /** Chave estável (tipo|id) — evita repetir a mesma fonte. */
  key: string;
  kind: SupportKind;
  title: string;
  /** O que a pessoa registrou (citação ou resumo fiel). */
  text: string;
  /** Por que apareceu agora. */
  why: string;
  href: string;
  /** Maior = mais específico para este momento. */
  score: number;
}

export const SUPPORT_MAX = 3;
export const SUPPORT_WINDOW_HOURS = 12;

/** O registro que motiva as sugestões: o mais recente de hoje, se for difícil (≤ intermediário) e recente. */
export function supportTarget(data: Pick<AppData, 'moodEntries'>, now = new Date()): MoodEntry | null {
  const today = dayKey(now);
  const nowLocal = `${today}T${String(now.getHours()).padStart(2, '0')}:${String(now.getMinutes()).padStart(2, '0')}`;
  const latest = data.moodEntries
    .filter((m) => m.at.slice(0, 10) === today && m.at.slice(0, 16) <= nowLocal)
    .sort((a, b) => b.at.localeCompare(a.at))[0];
  if (!latest || latest.valence > 0) return null;
  const ageH = (now.getTime() - new Date(latest.at).getTime()) / 3600000;
  return ageH <= SUPPORT_WINDOW_HOURS ? latest : null;
}

const KIND_TEXT: Record<RepertoireItem['kind'], string> = { resource: 'Você registrou que faz bem', strategy: 'Uma estratégia sua', activity: 'Uma atividade sua', drain: '' };
const lowerFirst = (s: string) => s.charAt(0).toLowerCase() + s.slice(1);
const clip = (s: string, n = 180) => (s.length > n ? s.slice(0, n - 1).trimEnd() + '…' : s);
const quote = (tags: string[]) => tags.map((t) => `“${t}”`).join(', ');
/** O texto contém palavras do marcador (mesmo radical simples usado nas situações)? */
const inText = (tag: string, text: string) => {
  const ws = fold(text).split(/[^a-z0-9]+/);
  return stems([tag]).some((s) => ws.some((w) => w.startsWith(s)));
};

export function supportFor(data: AppData, entry: MoodEntry): Suggestion[] {
  const ctx = entry.tags;
  const words = (t: string) => ctx.some((tag) => inText(tag, t));
  const out: Suggestion[] = [];

  // 1. Repertório: o que faz bem, estratégias e atividades ligadas ao contexto.
  for (const it of data.repertoire) {
    if (it.archived || it.kind === 'drain') continue;
    const uses = data.uses.filter((u) => u.itemId === it.id);
    const ctxUses = ctx.length ? uses.filter((u) => tagsOverlap(u.tags, ctx).length) : [];
    const c = outcomeCounts(ctxUses);
    const helped = c.worked + c.partial;
    const evaluated = helped + c.didnt + c.worse;
    // Avaliado neste contexto e nunca ajudou: não sugerir.
    if (evaluated > 0 && helped === 0) continue;
    const tagHit = tagsOverlap(it.tags, ctx);
    const wordHit = !tagHit.length && words([it.name, it.circumstances, it.description].join(' '));
    if (!helped && !tagHit.length && !wordHit) continue;
    const detail = it.circumstances.trim() || it.description.trim();
    const what = `${KIND_TEXT[it.kind]}${detail ? ` — ${lowerFirst(clip(detail, 120))}` : ''}.`;
    const why = helped
      ? `Ajudou ao menos em parte ${helped} de ${evaluated} vez(es) em que você avaliou com ${quote(tagsOverlap(ctxUses.flatMap((u) => u.tags), ctx).slice(0, 2))}.`
      : tagHit.length
        ? `Você o associou a ${quote(tagHit)}.`
        : `O que você escreveu sobre ele menciona ${quote(ctx.filter((t) => inText(t, [it.name, it.circumstances, it.description].join(' '))).slice(0, 2))}.`;
    out.push({ key: `item|${it.id}`, kind: 'item', title: it.name, text: what, why, href: `/guia/item/${it.id}`, score: helped ? 10 + helped : tagHit.length ? 6 : 3 });
  }

  // 2. Minhas emoções: o que a pessoa escreveu que ajuda com cada emoção do registro.
  const emo = new Map(data.emotions.map((e) => [e.id, e]));
  for (const id of entry.emotionIds) {
    const e = emo.get(id);
    if (!e || !e.helps.trim()) continue;
    out.push({
      key: `emotion|${e.id}`,
      kind: 'emotion',
      title: `Quando sente ${e.label.toLowerCase()}`,
      text: clip(e.helps.trim()),
      why: `Você escreveu isso em Minhas emoções, sobre ${e.label.toLowerCase()}.`,
      href: `/guia/emocao/${e.id}`,
      score: 9,
    });
  }

  if (ctx.length) {
    // 3. Situações preparadas para esse contexto.
    for (const s of data.situations) {
      const hit = tagsOverlap(s.tags, ctx);
      if (s.archived || !hit.length) continue;
      out.push({ key: `situation|${s.id}`, kind: 'situation', title: s.title, text: 'Uma situação que você preparou, com o que já sabe que ajuda.', why: `Marcada com ${quote(hit)}.`, href: `/guia/situacao/${s.id}`, score: 7 });
    }
    // 4. Descobertas ativas com o mesmo marcador.
    for (const d of data.discoveries) {
      const hit = tagsOverlap(d.tags, ctx);
      if (d.status !== 'active' || !hit.length) continue;
      out.push({ key: `discovery|${d.id}`, kind: 'discovery', title: 'Uma descoberta sua', text: `“${clip(d.title, 160)}”`, why: `Marcada com ${quote(hit)}.`, href: `/mapa/descoberta/${d.id}`, score: 5 });
    }
    // 5. Cartas que podem ser lidas e foram escritas para momentos assim.
    const today = dayKey(new Date());
    for (const l of data.letters) {
      const hit = tagsOverlap(l.tags, ctx);
      const sealed = l.sealed && !!l.openAt && !l.openedAt && l.openAt.slice(0, 10) > today;
      if (sealed || !hit.length || !l.body.trim()) continue;
      out.push({ key: `letter|${l.id}`, kind: 'letter', title: l.title || 'Uma carta sua', text: 'Você escreveu para si mesmo(a), para momentos assim.', why: `Marcada com ${quote(hit)}.`, href: `/guia/carta/${l.id}`, score: 5 });
    }
    // 6. O que você estava fazendo em registros AGRADÁVEIS com o mesmo contexto (≥ 2 vezes).
    const counts = new Map<string, number>();
    for (const m of data.moodEntries)
      if (m.id !== entry.id && m.valence >= 1 && tagsOverlap(m.tags, ctx).length) for (const id of new Set(m.itemIds)) counts.set(id, (counts.get(id) ?? 0) + 1);
    const items = new Map(data.repertoire.map((i) => [i.id, i]));
    for (const [id, n] of counts) {
      const it = items.get(id);
      if (n < 2 || !it || it.archived || it.kind === 'drain' || out.some((x) => x.key === `item|${id}`)) continue;
      out.push({
        key: `item|${id}`,
        kind: 'pattern',
        title: it.name,
        text: `Em ${n} registros agradáveis com ${quote(ctx)}, você estava fazendo isso.`,
        why: 'Uma coincidência nos seus registros — não quer dizer que foi a causa.',
        href: `/guia/item/${id}`,
        score: 4,
      });
    }
  }

  // 7. Sem nada específico e num momento desagradável: estratégias que você avaliou como eficazes em geral.
  if (!out.length && entry.valence <= -1) {
    const items = new Map(data.repertoire.map((i) => [i.id, i]));
    for (const g of strategyGroups(data.uses).filter((x) => x.group === 'effective' && x.evaluated >= 3)) {
      const it = items.get(g.itemId);
      if (!it || it.archived || it.kind === 'drain') continue;
      out.push({
        key: `item|${it.id}`,
        kind: 'item',
        title: it.name,
        text: `${KIND_TEXT[it.kind]}.`,
        why: `Funcionou ${g.counts.worked} de ${g.evaluated} vezes que você avaliou (em geral, não especificamente neste contexto).`,
        href: `/guia/item/${it.id}`,
        score: 1,
      });
    }
  }

  // No máximo 3, no máximo 2 do mesmo tipo, do mais específico ao mais geral.
  const picked: Suggestion[] = [];
  const perKind = new Map<string, number>();
  for (const s of out.sort((a, b) => b.score - a.score || a.title.localeCompare(b.title, 'pt-BR'))) {
    const k = s.kind === 'pattern' ? 'item' : s.kind;
    if ((perKind.get(k) ?? 0) >= 2 || picked.some((p) => p.key === s.key)) continue;
    picked.push(s);
    perKind.set(k, (perKind.get(k) ?? 0) + 1);
    if (picked.length >= SUPPORT_MAX) break;
  }
  return picked;
}
