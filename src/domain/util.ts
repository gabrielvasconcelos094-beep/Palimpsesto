/** Utilidades puras: ids, datas e marcadores. */

export function newId(): string {
  const c = (globalThis as any).crypto;
  if (c?.randomUUID) return c.randomUUID();
  // Fallback RFC4122 v4 com getRandomValues.
  const b = new Uint8Array(16);
  c.getRandomValues(b);
  b[6] = (b[6] & 0x0f) | 0x40;
  b[8] = (b[8] & 0x3f) | 0x80;
  const h = [...b].map((x) => x.toString(16).padStart(2, '0')).join('');
  return `${h.slice(0, 8)}-${h.slice(8, 12)}-${h.slice(12, 16)}-${h.slice(16, 20)}-${h.slice(20)}`;
}

export const nowIso = () => new Date().toISOString();

const pad = (n: number) => String(n).padStart(2, '0');

/**
 * Hora local "flutuante" (sem fuso): AAAA-MM-DDTHH:mm:ss. É o formato de `at`
 * (quando a experiência aconteceu). `new Date(valor)` a interpreta como hora local.
 */
export function localIso(d: Date = new Date()): string {
  return `${d.getFullYear()}-${pad(d.getMonth() + 1)}-${pad(d.getDate())}T${pad(d.getHours())}:${pad(d.getMinutes())}:${pad(d.getSeconds())}`;
}

/** Converte um instante absoluto (com Z ou deslocamento) em hora local flutuante. */
export function toLocalAt(value: string): string {
  if (/([zZ]|[+-]\d{2}:?\d{2})$/.test(value)) {
    const d = new Date(value);
    if (!isNaN(d.getTime())) return localIso(d);
  }
  if (/^\d{4}-\d{2}-\d{2}$/.test(value)) return `${value}T12:00:00`;
  return value;
}

/** Data (AAAA-MM-DD) de um `at` local, sem passar por conversões de fuso. */
export function atDay(at: string): string {
  return /^\d{4}-\d{2}-\d{2}T/.test(at) && !/([zZ]|[+-]\d{2}:?\d{2})$/.test(at) ? at.slice(0, 10) : dayKey(at);
}

/** Monta um `at` local a partir de data (AAAA-MM-DD) e hora (HH:mm). */
export function composeAt(day: string, time = '12:00'): string {
  return `${day}T${time.length === 5 ? time + ':00' : time}`;
}

/** Data local no formato YYYY-MM-DD. */
export function dayKey(d: Date | string): string {
  const x = typeof d === 'string' ? new Date(d) : d;
  return `${x.getFullYear()}-${pad(x.getMonth() + 1)}-${pad(x.getDate())}`;
}

/** Converte YYYY-MM-DD em Date local (meio-dia, evita bordas de fuso). */
export function fromDayKey(k: string): Date {
  const [y, m, d] = k.slice(0, 10).split('-').map(Number);
  return new Date(y, (m || 1) - 1, d || 1, 12, 0, 0);
}

export function startOfDay(d: Date): Date {
  return new Date(d.getFullYear(), d.getMonth(), d.getDate());
}

export function addDays(d: Date, n: number): Date {
  const x = new Date(d);
  x.setDate(x.getDate() + n);
  return x;
}

export function startOfWeek(d: Date, weekStartsOn: 0 | 1 = 1): Date {
  const x = startOfDay(d);
  const diff = (x.getDay() - weekStartsOn + 7) % 7;
  return addDays(x, -diff);
}

export function daysBetween(a: Date, b: Date): number {
  return Math.round((startOfDay(b).getTime() - startOfDay(a).getTime()) / 86400000);
}

/** Normaliza para comparação: minúsculas, sem acento, espaços colapsados. */
export function fold(s: string): string {
  return s
    .normalize('NFD')
    .replace(/[̀-ͯ]/g, '')
    .toLowerCase()
    .replace(/\s+/g, ' ')
    .trim();
}

export function cleanTag(s: string): string {
  return s.replace(/\s+/g, ' ').replace(/^#/, '').trim().slice(0, 60);
}

/** Remove duplicatas de marcadores comparando de forma tolerante. */
export function uniqTags(list: string[]): string[] {
  const seen = new Set<string>();
  const out: string[] = [];
  for (const raw of list) {
    const t = cleanTag(raw);
    if (!t) continue;
    const k = fold(t);
    if (seen.has(k)) continue;
    seen.add(k);
    out.push(t);
  }
  return out;
}

export function tagsOverlap(a: string[], b: string[]): string[] {
  const set = new Set(b.map(fold));
  return a.filter((t) => set.has(fold(t)));
}

export function matchesSearch(haystack: Array<string | undefined | null>, q: string): boolean {
  const n = fold(q);
  if (!n) return true;
  return haystack.some((h) => h && fold(h).includes(n));
}

export function clamp(n: number, min: number, max: number) {
  return Math.max(min, Math.min(max, n));
}

/** Gerador pseudoaleatório determinístico (para escolhas "do dia"). */
export function seededRandom(seed: string): () => number {
  let h = 1779033703 ^ seed.length;
  for (let i = 0; i < seed.length; i++) {
    h = Math.imul(h ^ seed.charCodeAt(i), 3432918353);
    h = (h << 13) | (h >>> 19);
  }
  return () => {
    h = Math.imul(h ^ (h >>> 16), 2246822507);
    h = Math.imul(h ^ (h >>> 13), 3266489909);
    h ^= h >>> 16;
    return (h >>> 0) / 4294967296;
  };
}
