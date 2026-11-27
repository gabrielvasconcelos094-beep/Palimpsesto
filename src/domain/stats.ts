/**
 * Testes estatísticos usados para decidir se uma diferença merece ser DESTACADA.
 *
 * Por quê: com poucos dados, diferenças aparecem por puro acaso. Sem um teste, o app
 * apontava "dia mais alto", "subiu", "padrão" etc. mesmo em dados aleatórios (auditoria
 * 1.10: 100% dos casos para o dia da semana). Aqui ficam testes simples, clássicos e
 * sem suposições fortes sobre a escala ordinal:
 *
 * - Permutação (aleatorização): diferença de médias entre dois grupos e amplitude
 *   (maior − menor média) entre vários grupos. A unidade é a DATA (média de cada data),
 *   o que respeita o peso igual por data e reduz a dependência entre registros do mesmo dia.
 * - Mann-Whitney (aproximação normal com correção de empates): dois grupos ordinais.
 * - Fisher exato (bilateral): duas proporções.
 * - Benjamini-Hochberg: controla a taxa de falsas descobertas quando muitas comparações
 *   são feitas ao mesmo tempo (marcadores × métricas, fatores do sono, atividades…).
 *
 * As permutações usam um gerador com SEMENTE derivada dos próprios dados: o mesmo
 * conjunto de dados dá sempre o mesmo resultado (nada "pisca" entre uma visita e outra).
 */

export const ALPHA = 0.05;
export const PERMUTATIONS = 2000;

/** Gerador pseudoaleatório determinístico (mulberry32). */
export function rng(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Semente estável a partir dos valores (mesmos dados → mesma semente). */
export function seedOf(values: number[]): number {
  let h = 2166136261;
  for (const v of values) h = Math.imul(h ^ Math.round(v * 1000), 16777619);
  return h >>> 0;
}

const mean = (v: number[]) => v.reduce((a, b) => a + b, 0) / v.length;

function shuffle(arr: number[], r: () => number) {
  for (let i = arr.length - 1; i > 0; i--) {
    const j = Math.floor(r() * (i + 1));
    const t = arr[i];
    arr[i] = arr[j];
    arr[j] = t;
  }
}

/** p bilateral de |média(a) − média(b)| por permutação. Retorna 1 se algum grupo estiver vazio. */
export function permutationDiffMeans(a: number[], b: number[], iters = PERMUTATIONS): number {
  if (!a.length || !b.length) return 1;
  const all = [...a, ...b];
  const obs = Math.abs(mean(a) - mean(b));
  const r = rng(seedOf(all));
  let hits = 0;
  const pool = [...all];
  for (let k = 0; k < iters; k++) {
    shuffle(pool, r);
    let sa = 0;
    for (let i = 0; i < a.length; i++) sa += pool[i];
    let sb = 0;
    for (let i = a.length; i < pool.length; i++) sb += pool[i];
    if (Math.abs(sa / a.length - sb / b.length) >= obs - 1e-12) hits++;
  }
  return (hits + 1) / (iters + 1);
}

/** p da amplitude (maior − menor média) entre grupos, por permutação dos rótulos. */
export function permutationRange(groups: number[][], iters = PERMUTATIONS): number {
  const gs = groups.filter((g) => g.length);
  if (gs.length < 2) return 1;
  const range = (ms: number[]) => Math.max(...ms) - Math.min(...ms);
  const obs = range(gs.map(mean));
  const all = gs.flat();
  const sizes = gs.map((g) => g.length);
  const r = rng(seedOf(all));
  const pool = [...all];
  let hits = 0;
  for (let k = 0; k < iters; k++) {
    shuffle(pool, r);
    let i = 0;
    const ms = sizes.map((n) => {
      let s = 0;
      for (let j = 0; j < n; j++) s += pool[i++];
      return s / n;
    });
    if (range(ms) >= obs - 1e-12) hits++;
  }
  return (hits + 1) / (iters + 1);
}

/** Função de distribuição normal padrão (aproximação de Abramowitz-Stegun 7.1.26). */
function normCdf(z: number) {
  const t = 1 / (1 + 0.3275911 * Math.abs(z) / Math.SQRT2);
  const y = 1 - ((((1.061405429 * t - 1.453152027) * t + 1.421413741) * t - 0.284496736) * t + 0.254829592) * t * Math.exp(-(z * z) / 2);
  return z >= 0 ? (1 + y) / 2 : (1 - y) / 2;
}

/** Mann-Whitney U bilateral (aproximação normal, correção de empates e de continuidade). */
export function mannWhitneyP(a: number[], b: number[]): number {
  const n1 = a.length;
  const n2 = b.length;
  if (!n1 || !n2) return 1;
  const all = [...a.map((v) => ({ v, g: 0 })), ...b.map((v) => ({ v, g: 1 }))].sort((x, y) => x.v - y.v);
  const N = all.length;
  let r1 = 0;
  let tie = 0;
  for (let i = 0; i < N; ) {
    let j = i;
    while (j + 1 < N && all[j + 1].v === all[i].v) j++;
    const rank = (i + j + 2) / 2;
    const t = j - i + 1;
    tie += t ** 3 - t;
    for (let k = i; k <= j; k++) if (all[k].g === 0) r1 += rank;
    i = j + 1;
  }
  const u = r1 - (n1 * (n1 + 1)) / 2;
  const mu = (n1 * n2) / 2;
  const sigma = Math.sqrt(((n1 * n2) / 12) * (N + 1 - tie / (N * (N - 1))));
  if (!sigma) return 1;
  const z = (Math.abs(u - mu) - 0.5) / sigma;
  return Math.min(1, 2 * (1 - normCdf(Math.max(0, z))));
}

/**
 * Fisher exato bilateral para a tabela 2×2 [[a, b], [c, d]]
 * (a = "sim" no grupo 1, b = "não" no grupo 1, c e d no grupo 2).
 */
export function fisherExactP(a: number, b: number, c: number, d: number): number {
  const r1 = a + b;
  const r2 = c + d;
  const c1 = a + c;
  const n = r1 + r2;
  if (!r1 || !r2 || !c1 || c1 === n) return 1;
  const lf = new Float64Array(n + 1);
  for (let i = 2; i <= n; i++) lf[i] = lf[i - 1] + Math.log(i);
  const logP = (x: number) => lf[r1] + lf[r2] + lf[c1] + lf[n - c1] - lf[n] - lf[x] - lf[r1 - x] - lf[c1 - x] - lf[r2 - c1 + x];
  const obs = logP(a);
  let p = 0;
  for (let x = Math.max(0, c1 - r2); x <= Math.min(r1, c1); x++) {
    const lp = logP(x);
    if (lp <= obs + 1e-9) p += Math.exp(lp);
  }
  return Math.min(1, p);
}

/** Benjamini-Hochberg: valores q (p ajustados) na mesma ordem. */
export function benjaminiHochberg(ps: number[]): number[] {
  const m = ps.length;
  const order = ps.map((p, i) => ({ p, i })).sort((x, y) => x.p - y.p);
  const q = new Array<number>(m);
  let min = 1;
  for (let k = m - 1; k >= 0; k--) {
    min = Math.min(min, (order[k].p * m) / (k + 1));
    q[order[k].i] = min;
  }
  return q;
}

/** Texto padrão quando a diferença observada não supera o acaso. */
export const NOT_CLEAR = 'Sem diferença clara: com esta quantidade de dados, uma diferença desse tamanho aparece com frequência por puro acaso.';
