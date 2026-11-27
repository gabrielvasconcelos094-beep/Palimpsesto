/**
 * Famílias de símbolos da escala de valência. Os valores internos (−2…+2)
 * não mudam; só a representação. Cada símbolo é desenhado numa grade 24×24,
 * com traço arredondado, para continuar legível em 14–36 px.
 *
 * A cor vem do token do nível (--mood-1…5), então todos funcionam em
 * qualquer paleta, clara, escura ou personalizada. A forma também muda de
 * nível a nível, para não depender só da cor.
 */
import type { ReactNode } from 'react';

export type SymbolSet = 'nature' | 'faces' | 'fine' | 'moon' | 'weather' | 'emoji';

export const SYMBOL_SETS: Array<{ id: SymbolSet; name: string; description: string }> = [
  { id: 'nature', name: 'Elementos da natureza', description: 'Da planta murcha à planta florida: uma progressão de vitalidade.' },
  { id: 'faces', name: 'Clássico minimalista', description: 'Cinco rostos simples, de traço firme.' },
  { id: 'fine', name: 'Traço delicado', description: 'Rostos em linhas finas, com expressões discretas.' },
  { id: 'moon', name: 'Fases da lua', description: 'Da lua nova à lua cheia: luminosidade crescente.' },
  { id: 'weather', name: 'Clima e atmosfera', description: 'Chuva, nuvens, céu nublado, sol entre nuvens e sol.' },
  { id: 'emoji', name: 'Emojis', description: 'Expressões básicas do teclado, sem exageros.' },
];

const EMOJI = ['😣', '🙁', '😐', '🙂', '😄'];

/* ------------------------------------------------------------------ */
/* Elementos da natureza                                               */
/* ------------------------------------------------------------------ */
/**
 * Folha: base em (x, y), apontando para `deg` graus (0 = direita, −90 = para
 * cima). A borda de cima é mais cheia que a de baixo, como uma folha de verdade;
 * `flip` espelha a curva para as folhas do lado esquerdo.
 */
function leaf(x: number, y: number, deg: number, len: number, w: number, color: string, o: { flip?: boolean; k?: number | string; opacity?: number } = {}): ReactNode {
  const s = o.flip ? -1 : 1;
  const a = -w * 1.15 * s;
  const b = w * 0.75 * s;
  const d = `M0 0C${len * 0.22} ${a} ${len * 0.68} ${a} ${len} 0C${len * 0.7} ${b} ${len * 0.3} ${b} 0 0Z`;
  return <path key={o.k} d={d} transform={`translate(${x} ${y}) rotate(${deg})`} fill={color} stroke={color} strokeWidth={0.6} opacity={o.opacity} />;
}

/**
 * Cores próprias da família "Elementos da natureza" (como os emojis, ela não
 * usa as cores do tema): terracota, ocre, verde acinzentado, verde e o
 * amarelo da flor. São tons médios, legíveis sobre fundo claro e escuro.
 */
export const NATURE_COLORS = {
  ground: '#D6BFA9',
  wilted: '#B0503A',
  weak: '#C47A3D',
  sprout: '#8C9A7E',
  leaf: '#6B8B58',
  leafDeep: '#5E7F50',
  bud: '#B4BE6E',
  petal: '#F1B830',
  center: '#8A5A2E',
} as const;

/** Cor principal de cada nível (−2…+2) — usada, por exemplo, para tingir os poços do widget. */
export const NATURE_LEVEL_COLORS = [NATURE_COLORS.wilted, NATURE_COLORS.weak, NATURE_COLORS.sprout, NATURE_COLORS.leaf, NATURE_COLORS.petal];

function nature(i: number): ReactNode {
  const N = NATURE_COLORS;
  // A mesma terra e a mesma base de caule em todos os níveis: só a planta muda.
  const ground = <path d="M4.6 21.6C6.6 19.7 17.4 19.7 19.4 21.6Z" fill={N.ground} fillOpacity={0.85} stroke="none" />;
  const stem = (d: string, color: string) => <path d={d} stroke={color} strokeWidth={1.9} fill="none" />;
  switch (i) {
    case 0: // muito murcha: caule fortemente arqueado, folhas caídas
      return (
        <>
          {ground}
          {stem('M9.4 20.6C9 15 9.8 8.4 13 7.3C15.5 6.5 16.9 8.7 16.6 11.4', N.wilted)}
          {leaf(9.5, 15.2, 196, 5.4, 2.1, N.wilted, { flip: true, k: 1 })}
          {leaf(16.7, 11.2, 112, 5, 1.7, N.wilted, { k: 2 })}
          {leaf(16.5, 11.3, 66, 4.6, 1.6, N.wilted, { flip: true, k: 3, opacity: 0.85 })}
        </>
      );
    case 1: // debilitada: caule inclinado, folhas pendendo
      return (
        <>
          {ground}
          {stem('M11 20.6C10.6 15.6 11.8 10.8 15.2 9.2', N.weak)}
          {leaf(15.1, 9.2, 16, 6, 2.4, N.weak, { k: 1 })}
          {leaf(11, 16.2, 192, 5, 2, N.weak, { flip: true, k: 2 })}
        </>
      );
    case 2: // broto nascendo: caule curto, duas folhas recém-abertas
      return (
        <>
          {ground}
          {stem('M12 20.6C12 18.4 11.8 16.6 12 14.8', N.sprout)}
          {leaf(12, 15, -158, 5.4, 2.2, N.sprout, { flip: true, k: 1 })}
          {leaf(12, 15, -24, 5.4, 2.2, N.sprout, { k: 2 })}
        </>
      );
    case 3: // saudável e ereta, com um botão no topo
      return (
        <>
          {ground}
          {stem('M12 20.6V7.4', N.leaf)}
          {leaf(12, 18, -22, 6.2, 2.4, N.leaf, { k: 1 })}
          {leaf(12, 14.4, -158, 5.8, 2.3, N.leaf, { flip: true, k: 2 })}
          {leaf(12, 11.2, -32, 4.8, 1.9, N.leaf, { k: 3 })}
          <path d="M12 2.2C13.9 3.7 14.4 5.9 13.3 7.7H10.7C9.6 5.9 10.1 3.7 12 2.2Z" fill={N.bud} stroke="none" />
          {leaf(12, 8, -112, 3.4, 1.3, N.leaf, { flip: true, k: 4 })}
          {leaf(12, 8, -68, 3.4, 1.3, N.leaf, { k: 5 })}
        </>
      );
    default: // florida: folhas verdes e uma flor amarela aberta
      return (
        <>
          {ground}
          {stem('M12 20.6V9', N.leafDeep)}
          {leaf(12, 16.6, -152, 6.6, 2.5, N.leafDeep, { flip: true, k: 1 })}
          {leaf(12, 15.2, -28, 6.6, 2.5, N.leafDeep, { k: 2 })}
          {Array.from({ length: 12 }, (_, k) => (
            <ellipse key={`p${k}`} cx={12} cy={3.05} rx={1.2} ry={2.25} transform={`rotate(${k * 30} 12 6.3)`} fill={N.petal} stroke="none" />
          ))}
          <circle cx={12} cy={6.3} r={2.15} fill={N.center} stroke="none" />
        </>
      );
  }
}

/* ------------------------------------------------------------------ */
/* Rostos — clássico minimalista                                       */
/* ------------------------------------------------------------------ */
function faces(i: number, c: string): ReactNode {
  const mouths = [
    'M8 16.9Q12 12.7 16 16.9',
    'M8.8 16.1Q12 14.2 15.2 16.1',
    'M8.8 15.3H15.2', // neutro: linha reta, olhos normais
    'M8.8 14.5Q12 16.6 15.2 14.5',
  ];
  return (
    <>
      <circle cx={12} cy={12} r={9.2} fill={c} fillOpacity={0.12} />
      <circle cx={9} cy={10} r={1.15} fill={c} stroke="none" />
      <circle cx={15} cy={10} r={1.15} fill={c} stroke="none" />
      {i < 4 ? <path d={mouths[i]} /> : <path d="M8 13.6H16Q16 18.3 12 18.3Q8 18.3 8 13.6Z" fill={c} />}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Rostos — traço delicado                                             */
/* ------------------------------------------------------------------ */
function fine(i: number, c: string): ReactNode {
  const head = <path d="M15.9 3.9A9 9 0 1 0 19.6 7.3" strokeWidth={1.05} />;
  const eyes =
    i === 4 ? (
      <>
        <path d="M7.9 10.5Q9 9.2 10.1 10.5" strokeWidth={1.05} />
        <path d="M13.9 10.5Q15 9.2 16.1 10.5" strokeWidth={1.05} />
      </>
    ) : (
      <>
        <circle cx={9} cy={10.2} r={0.8} fill={c} stroke="none" />
        <circle cx={15} cy={10.2} r={0.8} fill={c} stroke="none" />
      </>
    );
  const brows =
    i === 0 ? (
      <>
        <path d="M7.4 8.3L10.1 7.3" strokeWidth={1.05} />
        <path d="M16.6 8.3L13.9 7.3" strokeWidth={1.05} />
      </>
    ) : i === 1 ? (
      <>
        <path d="M7.7 7.9L10 7.5" strokeWidth={1.05} />
        <path d="M16.3 7.9L14 7.5" strokeWidth={1.05} />
      </>
    ) : null;
  const mouth = ['M9.2 16.6Q12 14.2 14.8 16.6', 'M9.8 16Q12 15 14.2 16', 'M10.2 15.5H13.8', 'M9.5 14.8Q12 16.5 14.5 14.8', 'M8.9 14.2Q12 17.9 15.1 14.2'][i];
  return (
    <>
      {head}
      {brows}
      {eyes}
      <path d={mouth} strokeWidth={1.1} />
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Fases da lua                                                        */
/* ------------------------------------------------------------------ */
function moon(i: number, c: string): ReactNode {
  const lit = [
    null,
    'M12 3.5A8.5 8.5 0 0 1 12 20.5A5.6 8.5 0 0 0 12 3.5Z',
    'M12 3.5A8.5 8.5 0 0 1 12 20.5Z',
    'M12 3.5A8.5 8.5 0 0 1 12 20.5A5.2 8.5 0 0 1 12 3.5Z',
    null,
  ][i];
  return (
    <>
      <circle cx={12} cy={12} r={8.5} strokeWidth={1.4} fill={i === 4 ? c : c} fillOpacity={i === 4 ? 1 : 0.1} />
      {lit && <path d={lit} fill={c} stroke="none" />}
    </>
  );
}

/* ------------------------------------------------------------------ */
/* Clima e atmosfera                                                   */
/* ------------------------------------------------------------------ */
const CLOUD = 'M7.2 17.6H16.6A3.4 3.4 0 0 0 16.4 10.8A4.9 4.9 0 0 0 7 11.8A2.9 2.9 0 0 0 7.2 17.6Z';
function weather(i: number, c: string): ReactNode {
  switch (i) {
    case 0: // chuva
      return (
        <>
          <path d={CLOUD} transform="translate(0 -3)" fill={c} fillOpacity={0.55} />
          <path d="M8.6 17.6L7.6 20.4M12.1 17.6L11.1 20.4M15.6 17.6L14.6 20.4" />
        </>
      );
    case 1: // nuvens carregadas
      return (
        <>
          <path d={CLOUD} transform="translate(3.4 -4.2) scale(0.78)" fill={c} fillOpacity={0.3} />
          <path d={CLOUD} transform="translate(-1 0.6)" fill={c} fillOpacity={0.45} />
        </>
      );
    case 2: // céu nublado (neutro)
      return <path d={CLOUD} fill={c} fillOpacity={0.12} />;
    case 3: // sol entre nuvens
      return (
        <>
          <circle cx={15.3} cy={8.3} r={3.3} fill={c} fillOpacity={0.6} />
          <path d="M15.3 2.6V3.6M20.9 8.3H19.9M19.3 4.3L18.6 5M11.3 4.3L12 5" />
          <path d={CLOUD} transform="translate(-2.2 1.6) scale(0.92)" fill="var(--surface)" />
        </>
      );
    default: // sol
      return (
        <>
          <circle cx={12} cy={12} r={4.3} fill={c} />
          <path d="M12 2.8V5M12 19V21.2M2.8 12H5M19 12H21.2M5.5 5.5L7.1 7.1M16.9 16.9L18.5 18.5M5.5 18.5L7.1 16.9M16.9 7.1L18.5 5.5" />
        </>
      );
  }
}

const DRAW: Record<Exclude<SymbolSet, 'emoji'>, (i: number, c: string) => ReactNode> = { nature: (i) => nature(i), faces, fine, moon, weather };

/** Com título: imagem nomeada. Sem título: decorativo (o texto ao lado já diz o que é). */
const a11y = (title?: string) => (title ? { role: 'img' as const, 'aria-label': title } : { 'aria-hidden': true as const });

export function MoodSymbol({ v, set, size = 22, title }: { v: number; set: SymbolSet; size?: number; title?: string }) {
  const i = Math.max(0, Math.min(4, Math.round(v) + 2));
  if (set === 'emoji')
    return (
      <span {...a11y(title)} style={{ fontSize: size * 0.88, lineHeight: 1, width: size, height: size, display: 'inline-grid', placeItems: 'center', flex: 'none' }}>
        {EMOJI[i]}
      </span>
    );
  const c = `var(--mood-${i + 1})`;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" {...a11y(title)} style={{ flex: 'none' }} fill="none" stroke={c} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
      {DRAW[set](i, c)}
    </svg>
  );
}
