/**
 * Pergunta do dia (Hoje). Determinística por data: o mesmo dia mostra sempre a mesma
 * pergunta (nada "pisca" ao reabrir o app).
 *
 * Desde a 1.13 o sorteio é em dois passos — primeiro a ficha, depois a pergunta — e a
 * ficha muda todo dia. Antes, sorteava-se direto entre
 * todas as perguntas abertas: fichas com mais perguntas apareciam mais, e o mesmo tema
 * podia se repetir em dias seguidos. Agora as fichas se revezam (ver sectionOfDay).
 * As favoritas continuam tendo prioridade.
 */
import type { AppData, Question } from './schema';
import { seededRandom } from './util';

export function openQuestions(data: Pick<AppData, 'questions' | 'answers' | 'sections'>): Question[] {
  const answered = new Set(data.answers.filter((a) => a.text.trim()).map((a) => a.questionId));
  const hiddenSections = new Set(data.sections.filter((s) => s.hidden).map((s) => s.id));
  return data.questions.filter((q) => !q.hidden && !answered.has(q.id) && !hiddenSections.has(q.sectionId));
}

/** Dias desde uma data fixa (contagem estável, sem fuso). */
const dayNumber = (day: string) => Math.round(Date.UTC(+day.slice(0, 4), +day.slice(5, 7) - 1, +day.slice(8, 10)) / 86400000);

function shuffled<T>(xs: T[], seed: string): T[] {
  const r = seededRandom(seed);
  const a = [...xs];
  for (let i = a.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    [a[i], a[j]] = [a[j], a[i]];
  }
  return a;
}

/**
 * Ficha do dia: rodízio em ciclos de k dias (k = fichas com perguntas disponíveis).
 * Em cada ciclo, cada ficha aparece uma vez, numa ordem embaralhada pela semente do
 * ciclo; na virada, se a primeira do ciclo novo repetir a última do anterior, as duas
 * primeiras trocam de lugar. Assim nenhuma ficha se repete em dias seguidos.
 */
export function sectionOfDay(sectionIds: string[], day: string): string | null {
  const secs = [...new Set(sectionIds)].sort();
  const k = secs.length;
  if (!k) return null;
  if (k === 1) return secs[0];
  const n = dayNumber(day);
  const c = Math.floor(n / k);
  const order = (cycle: number) => {
    const o = shuffled(secs, 'ciclo' + cycle);
    if (cycle > 0) {
      const prevLast = shuffled(secs, 'ciclo' + (cycle - 1))[k - 1];
      if (o[0] === prevLast) [o[0], o[1]] = [o[1], o[0]];
    }
    return o;
  };
  return order(c)[n - c * k];
}

export function dailyQuestion(data: Pick<AppData, 'questions' | 'answers' | 'sections'>, day: string): Question | null {
  const open = openQuestions(data);
  const favs = open.filter((q) => q.favorite);
  const pool = favs.length ? favs : open;
  const sec = sectionOfDay(pool.map((q) => q.sectionId), day);
  if (!sec) return null;
  const qs = pool.filter((q) => q.sectionId === sec).sort((a, b) => a.id.localeCompare(b.id));
  return qs[Math.floor(seededRandom('q' + day)() * qs.length)];
}
