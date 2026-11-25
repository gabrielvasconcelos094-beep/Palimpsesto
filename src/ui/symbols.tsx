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
  { id: 'nature', name: 'Elementos da natureza', description: 'Da planta murcha à planta em flor: uma progressão de vitalidade.' },
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
function leaf(x: number, y: number, deg: number, len: number, w: number, c: string, o: { fill?: number; flip?: boolean; k?: number } = {}): ReactNode {
  const s = o.flip ? -1 : 1;
  const a = -w * 1.15 * s;
  const b = w * 0.75 * s;
  const d = `M0 0C${len * 0.22} ${a} ${len * 0.68} ${a} ${len} 0C${len * 0.7} ${b} ${len * 0.3} ${b} 0 0Z`;
  const fill = o.fill ?? 1;
  return <path key={o.k} d={d} transform={`translate(${x} ${y}) rotate(${deg})`} fill={c} fillOpacity={fill} strokeWidth={fill < 1 ? 1.1 : 0.8} />;
}

function nature(i: number, c: string): ReactNode {
  // A mesma terra e a mesma base de caule em todos os níveis: só a planta muda.
  const ground = <path d="M5.2 21.4C7.6 19.7 16.4 19.7 18.8 21.4Z" fill={c} fillOpacity={0.32} stroke="none" />;
  const stem = (d: string) => <path d={d} strokeWidth={1.5} />;
  switch (i) {
    case 0: // planta murcha: caule arqueado, folhas secas pendendo
      return (
        <>
          {ground}
          {stem('M11 20.4C10.8 15.2 11.6 10.6 14.4 9.4C16.6 8.5 17.9 10.3 17.6 12.6')}
          {leaf(17.6, 12.6, 100, 5, 1.6, c, { fill: 1, k: 1 })}
          {leaf(11.1, 15.4, 150, 4.4, 1.5, c, { fill: 1, flip: true, k: 2 })}
        </>
      );
    case 1: // broto cansado, inclinado
      return (
        <>
          {ground}
          {stem('M11.4 20.4C11.2 16.2 11.9 12.8 14 10.6')}
          {leaf(14, 10.6, 10, 5.8, 2.2, c, { fill: 1, k: 1 })}
          {leaf(11.4, 16.2, 198, 4.4, 1.7, c, { fill: 1, flip: true, k: 2 })}
        </>
      );
    case 2: // broto reto com duas folhinhas (neutro, simétrico)
      return (
        <>
          {ground}
          {stem('M12 20.4V12.2')}
          {leaf(12, 12.4, -150, 6, 2.3, c, { fill: 1, flip: true, k: 1 })}
          {leaf(12, 12.4, -30, 6, 2.3, c, { fill: 1, k: 2 })}
        </>
      );
    case 3: // planta jovem, crescendo
      return (
        <>
          {ground}
          {stem('M12 20.4V7')}
          {leaf(12, 16.6, -145, 5.4, 2.1, c, { flip: true, k: 1 })}
          {leaf(12, 12.6, -35, 5.4, 2.1, c, { k: 2 })}
          {leaf(12, 7.6, -90, 4, 1.6, c, { k: 3 })}
        </>
      );
    default: // planta em flor
      return (
        <>
          {ground}
          {stem('M12 20.4V6.6')}
          {leaf(12, 17.4, -145, 5.2, 2, c, { flip: true, k: 1 })}
          {leaf(12, 13.8, -35, 5.2, 2, c, { k: 2 })}
          {[0, 72, 144, 216, 288].map((a) => (
            <ellipse key={a} cx={12} cy={2.85} rx={1.35} ry={1.75} transform={`rotate(${a} 12 5.2)`} fill={c} fillOpacity={0.62} stroke="none" />
          ))}
          <circle cx={12} cy={5.2} r={1.5} fill={c} stroke="none" />
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

const DRAW: Record<Exclude<SymbolSet, 'emoji'>, (i: number, c: string) => ReactNode> = { nature, faces, fine, moon, weather };

export function MoodSymbol({ v, set, size = 22, title }: { v: number; set: SymbolSet; size?: number; title?: string }) {
  const i = Math.max(0, Math.min(4, Math.round(v) + 2));
  if (set === 'emoji')
    return (
      <span role="img" aria-label={title ?? ''} style={{ fontSize: size * 0.88, lineHeight: 1, width: size, height: size, display: 'inline-grid', placeItems: 'center', flex: 'none' }}>
        {EMOJI[i]}
      </span>
    );
  const c = `var(--mood-${i + 1})`;
  return (
    <svg width={size} height={size} viewBox="0 0 24 24" role="img" aria-label={title ?? ''} style={{ flex: 'none' }} fill="none" stroke={c} strokeWidth={1.7} strokeLinecap="round" strokeLinejoin="round">
      {DRAW[set](i, c)}
    </svg>
  );
}
