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
  { id: 'nature', name: 'Elementos da natureza', description: 'Do ramo seco à planta vigorosa: uma progressão de vitalidade.' },
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
function nature(i: number, c: string): ReactNode {
  const ground = <path d="M5.5 21.2H18.5" stroke={c} strokeWidth={1.3} opacity={0.55} />;
  const fillO = [0, 0.2, 0.35, 0.55, 0.85][i];
  const leaf = (d: string, k: number) => <path key={k} d={d} fill={c} fillOpacity={fillO} />;
  switch (i) {
    case 0: // ramo seco, quebrado, sem folhas
      return (
        <>
          {ground}
          <path d="M12 21L12.2 15.6L9.6 10.8L10.3 5.8" />
          <path d="M12.1 15.8L15.4 13.1L16.1 10.9" />
          <path d="M10.4 9.3L7.6 7.6" />
          <path d="M14.4 13.9L15.6 15.3" opacity={0.7} />
        </>
      );
    case 1: // uma folha isolada, pendente
      return (
        <>
          {ground}
          <path d="M11.6 21C11.6 16.2 12.2 13.1 14.1 11.2" />
          {leaf('M14.1 11.2C17.9 10.7 19.8 13.6 18.8 17.4C15.5 16.9 13.6 14.6 14.1 11.2Z', 1)}
        </>
      );
    case 2: // broto começando a surgir
      return (
        <>
          {ground}
          <path d="M12 21V15.2" />
          {leaf('M12 15.4C9.3 15.4 7.7 13.8 7.7 11.6C10.4 11.6 12 13.2 12 15.4Z', 1)}
          {leaf('M12 15.4C14.7 15.4 16.3 13.8 16.3 11.6C13.6 11.6 12 13.2 12 15.4Z', 2)}
        </>
      );
    case 3: // planta jovem
      return (
        <>
          {ground}
          <path d="M12 21V6.8" />
          {leaf('M12 17.6C8.4 17.8 6 15.8 5.6 12.9C9 12.7 11.6 14.7 12 17.6Z', 1)}
          {leaf('M12 13.4C15.6 13.6 18 11.6 18.4 8.7C15 8.5 12.4 10.5 12 13.4Z', 2)}
          {leaf('M12 8.8C10.9 7.6 10.9 5.8 12 4.6C13.1 5.8 13.1 7.6 12 8.8Z', 3)}
        </>
      );
    default: // planta vigorosa, folhas abertas
      return (
        <>
          {ground}
          <path d="M12 21V4.6" />
          {leaf('M12 18.4C8.4 18.6 6 16.6 5.6 13.7C9 13.5 11.6 15.5 12 18.4Z', 1)}
          {leaf('M12 16.6C15.6 16.8 18 14.8 18.4 11.9C15 11.7 12.4 13.7 12 16.6Z', 2)}
          {leaf('M12 12.6C9.1 12.6 7.3 10.8 7.3 8.4C10.1 8.4 12 10.2 12 12.6Z', 3)}
          {leaf('M12 10.4C14.9 10.4 16.7 8.6 16.7 6.2C13.9 6.2 12 8 12 10.4Z', 4)}
          {leaf('M12 6.4C10.8 5.2 10.8 3.4 12 2.2C13.2 3.4 13.2 5.2 12 6.4Z', 5)}
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
