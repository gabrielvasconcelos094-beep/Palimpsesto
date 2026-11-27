/**
 * Gráficos em SVG/HTML próprios, guiados pelos tokens do tema.
 * - Valência é ordinal: os gráficos de distribuição mostram contagens e proporções. Onde
 *   há um "índice" (média com peso igual por data), ele é rotulado como aproximação descritiva
 *   e vem acompanhado das contagens (ver docs/ARQUITETURA.md §4 e domain/valence.ts).
 * - Identidade nunca depende só da cor: legenda sempre visível e valores no toque.
 */
import { useId, useState } from 'react';
import type { Bucket, Counts5 } from '../../domain/analytics';
import { shares, sum } from '../../domain/analytics';
import { fmtIndex } from '../../domain/valence';

const pct = (x: number) => `${Math.round(x * 100)}%`;

/** Distribuição em linhas (uma por categoria), com comparação opcional. */
export function Distribution(props: {
  labels: string[];
  colors: string[];
  counts: Counts5;
  compare?: Counts5 | null;
  marks?: (i: number) => React.ReactNode;
  /** Mostra só as proporções (quando os números não são contagens). */
  hideCounts?: boolean;
  /** Toque num nível (ex.: abrir os registros daquela categoria). */
  onSelect?: (i: number) => void;
  selectLabel?: (i: number) => string;
}) {
  const s = shares(props.counts);
  const c = props.compare ? shares(props.compare) : null;
  const max = Math.max(...s, ...(c ?? []), 0.0001);
  return (
    <div className="stack" style={{ gap: 12 }}>
      {props.labels.map((label, i) => {
        const Row = props.onSelect ? 'button' : 'div';
        return (
        <Row
          key={i}
          className={props.onSelect ? 'dist-row' : undefined}
          {...(props.onSelect ? { type: 'button' as const, onClick: () => props.onSelect!(i), 'aria-label': props.selectLabel?.(i) } : {})}
        >
          <div className="row between small" style={{ marginBottom: 4 }}>
            <span className="row" style={{ gap: 8 }}>
              {props.marks?.(i)}
              {label}
            </span>
            <span className="muted xs" style={{ fontVariantNumeric: 'tabular-nums' }}>
              {props.hideCounts ? '' : `${props.counts[i]} · `}
              {pct(s[i])}
              {c && <span className="faint"> (antes {pct(c[i])})</span>}
            </span>
          </div>
          <div className="bar-track" style={{ height: 12 }}>
            <div className="bar-fill" style={{ width: `${(s[i] / max) * 100}%`, background: props.colors[i] }} />
          </div>
          {c && (
            <div className="bar-track" style={{ height: 6, marginTop: 3, background: 'transparent' }} aria-hidden>
              <div className="bar-fill" style={{ width: `${(c[i] / max) * 100}%`, background: `repeating-linear-gradient(135deg, ${props.colors[i]} 0 3px, transparent 3px 6px)` }} />
            </div>
          )}
        </Row>
        );
      })}
      {c && (
        <div className="chart-legend">
          <span>
            <span style={{ width: 18, height: 8, borderRadius: 4, background: 'var(--ink-soft)', display: 'inline-block' }} /> Período atual
          </span>
          <span>
            <span style={{ width: 18, height: 6, borderRadius: 3, background: 'repeating-linear-gradient(135deg, var(--ink-soft) 0 3px, transparent 3px 6px)', display: 'inline-block' }} />
            Período anterior
          </span>
        </div>
      )}
    </div>
  );
}

/** Barra empilhada única (100%). */
export function StackBar({ counts, colors, labels }: { counts: number[]; colors: string[]; labels: string[] }) {
  const n = sum(counts);
  if (!n) return null;
  return (
    <div className="stackbar" role="img" aria-label={labels.map((l, i) => `${l}: ${counts[i]}`).join(', ')} style={{ height: 16 }}>
      {counts.map((c, i) => (c ? <div key={i} style={{ width: `${(c / n) * 100}%`, background: colors[i] }} /> : null))}
    </div>
  );
}

/** Colunas empilhadas ao longo do tempo. Toque numa coluna para ver os valores. */
export function Evolution(props: { buckets: Bucket[]; colors: string[]; labels: string[]; unit: 'day' | 'week' | 'month'; height?: number }) {
  const [sel, setSel] = useState<number | null>(null);
  const H = props.height ?? 150;
  const n = props.buckets.length;
  const W = Math.max(280, n * 18);
  const max = Math.max(1, ...props.buckets.map((b) => b.total));
  const colW = W / n;
  const barW = Math.max(4, Math.min(22, colW - 4));
  const ticks = max <= 4 ? [max] : [Math.round(max / 2), max];
  const labelEvery = Math.ceil(n / 7);
  const unitName = { day: 'Dia', week: 'Semana de', month: 'Mês' }[props.unit];
  const s = sel !== null ? props.buckets[sel] : null;
  const idBase = useId().replace(/[^a-zA-Z0-9_-]/g, '');

  return (
    <div>
      <div style={{ overflowX: 'auto' }}>
        <svg viewBox={`0 0 ${W} ${H + 22}`} width="100%" style={{ minWidth: Math.min(W, 640), maxHeight: H + 40 }} role="img" aria-label="Evolução ao longo do tempo">
          {ticks.map((t) => {
            const y = H - (t / max) * H;
            return (
              <g key={t}>
                <line x1={0} x2={W} y1={y} y2={y} stroke="var(--line)" strokeWidth={1} strokeDasharray="3 4" />
                <text x={2} y={y - 3} fontSize={10} fill="var(--ink-faint)">
                  {t}
                </text>
              </g>
            );
          })}
          <line x1={0} x2={W} y1={H} y2={H} stroke="var(--line-strong)" strokeWidth={1} />
          {props.buckets.map((b, i) => {
            const x = i * colW + (colW - barW) / 2;
            let y = H;
            const segs = b.counts.map((c, k) => {
              if (!c) return null;
              const h = (c / max) * H;
              y -= h;
              // Blocos encostados (sem frestas), separados por um fio da cor do fundo.
              return <rect key={k} x={x} y={y} width={barW} height={Math.max(1, h)} fill={props.colors[k]} stroke="var(--surface)" strokeWidth={0.75} />;
            });
            const top = H - (b.total / max) * H;
            const cid = `evo-${idBase}-${i}`;
            return (
              <g key={i} onClick={() => setSel(sel === i ? null : i)} style={{ cursor: 'pointer' }}>
                <rect x={i * colW} y={0} width={colW} height={H + 20} rx={6} fill={sel === i ? 'var(--surface-2)' : 'transparent'} />
                <clipPath id={cid}>
                  <rect x={x} y={top} width={barW} height={H - top} rx={Math.min(5, barW / 2.5)} />
                </clipPath>
                <g clipPath={`url(#${cid})`}>{segs}</g>
                {i % labelEvery === 0 && (
                  <text x={i * colW + colW / 2} y={H + 15} fontSize={10} fill="var(--ink-faint)" textAnchor="middle">
                    {b.label}
                  </text>
                )}
              </g>
            );
          })}
        </svg>
      </div>
      <div className="chart-legend">
        {props.labels.map((l, i) => (
          <span key={i}>
            <span className="dot xs" style={{ background: props.colors[i] }} />
            {l}
          </span>
        ))}
      </div>
      <p className="xs muted" style={{ minHeight: 18, marginTop: 8 }}>
        {s
          ? `${unitName} ${s.label}: ${s.total ? props.labels.map((l, i) => (s.counts[i] ? `${s.counts[i]} ${l.toLowerCase()}` : '')).filter(Boolean).join(', ') : 'sem registros'}`
          : 'Toque numa coluna para ver os valores. Espaços vazios são só dias sem registro.'}
      </p>
    </div>
  );
}

/** Barras horizontais simples (frequências). */
export function Bars(props: { rows: Array<{ label: string; value: number; note?: string }>; max?: number; color?: string }) {
  const max = props.max ?? Math.max(1, ...props.rows.map((r) => r.value));
  return (
    <div className="stack" style={{ gap: 10 }}>
      {props.rows.map((r) => (
        <div key={r.label} className="bar-row">
          <span style={{ overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>{r.label}</span>
          <div className="bar-track">
            <div className="bar-fill" style={{ width: `${(r.value / max) * 100}%`, background: props.color ?? 'var(--primary-ink)' }} />
          </div>
          <span className="xs muted" style={{ fontVariantNumeric: 'tabular-nums', minWidth: 34, textAlign: 'right' }}>
            {r.note ?? r.value}
          </span>
        </div>
      ))}
    </div>
  );
}

/** Linhas com barra empilhada (ex.: um dia da semana por linha). */
export function StackRows(props: {
  rows: Array<{ label: string; counts: number[]; note: string; dim?: boolean }>;
  colors: string[];
  legend: string[];
}) {
  return (
    <div className="stack" style={{ gap: 10 }}>
      {props.rows.map((r) => {
        const n = r.counts.reduce((a, b) => a + b, 0);
        return (
          <div key={r.label} style={{ opacity: r.dim ? 0.55 : 1 }}>
            <div className="row between xs" style={{ marginBottom: 3 }}>
              <span style={{ fontWeight: 600 }}>{r.label}</span>
              <span className="muted">{r.note}</span>
            </div>
            {n ? (
              <div className="stackbar" role="img" aria-label={`${r.label}: ${props.legend.map((l, i) => `${l} ${Math.round((r.counts[i] / n) * 100)}%`).join(', ')}`}>
                {r.counts.map((c, i) => (c ? <div key={i} style={{ width: `${(c / n) * 100}%`, background: props.colors[i] }} /> : null))}
              </div>
            ) : (
              <div className="xs faint">sem registros</div>
            )}
          </div>
        );
      })}
      <div className="chart-legend">
        {props.legend.map((l, i) => (
          <span key={l}>
            <span className="dot xs" style={{ background: props.colors[i] }} />
            {l}
          </span>
        ))}
      </div>
    </div>
  );
}

/** Tabela de contagens com intensidade (o número sempre visível). */
export function HeatTable(props: { rowLabels: string[]; colLabels: string[]; values: number[][]; caption: string }) {
  const max = Math.max(1, ...props.values.flat());
  return (
    <div style={{ overflowX: 'auto' }}>
      <table className="heat-table" style={{ borderCollapse: 'separate', borderSpacing: 3, fontSize: 12, width: '100%' }}>
        <caption className="xs muted" style={{ textAlign: 'left', captionSide: 'bottom', paddingTop: 6 }}>
          {props.caption}
        </caption>
        <thead>
          <tr>
            <th />
            {props.colLabels.map((c) => (
              <th key={c} className="faint" style={{ fontWeight: 500, padding: '0 2px' }}>
                {c}
              </th>
            ))}
          </tr>
        </thead>
        <tbody>
          {props.rowLabels.map((r, i) => (
            <tr key={r}>
              <th style={{ textAlign: 'left', fontWeight: 500, paddingRight: 6, whiteSpace: 'nowrap' }}>{r}</th>
              {props.values[i].map((v, j) => (
                <td
                  key={j}
                  style={{
                    textAlign: 'center',
                    padding: '6px 2px',
                    borderRadius: 6,
                    background: v ? `color-mix(in srgb, var(--primary-ink) ${Math.round(8 + (v / max) * 40)}%, var(--surface))` : 'var(--surface-2)',
                    color: v / max > 0.62 ? 'var(--on-primary)' : undefined,
                    fontWeight: v / max > 0.62 ? 600 : undefined,
                    fontVariantNumeric: 'tabular-nums',
                  }}
                >
                  {v || '·'}
                </td>
              ))}
            </tr>
          ))}
        </tbody>
      </table>
    </div>
  );
}

/**
 * Barras divergentes do índice de valência (−2…+2), a partir do zero (neutro).
 * O índice é descritivo: média por data, depois média entre as datas.
 */
export function IndexBars({
  rows,
}: {
  rows: Array<{ label: string; index: number | null; note: string; dim?: boolean; tag?: string; mark?: React.ReactNode }>;
}) {
  return (
    <div className="stack" style={{ gap: 10 }} role="list">
      {rows.map((r) => {
        const v = r.index;
        const lvl = v === null ? null : Math.max(1, Math.min(5, Math.sign(v) * Math.round(Math.abs(v) + 1e-9) + 3));
        const w = v === null ? 0 : (Math.abs(v) / 2) * 50;
        return (
          <div key={r.label} role="listitem" style={{ opacity: r.dim ? 0.5 : 1 }} aria-label={`${r.label}: índice ${fmtIndex(v)}; ${r.note}${r.tag ? `; ${r.tag}` : ''}`}>
            <div className="row between small" style={{ marginBottom: 4 }}>
              <span className="row" style={{ gap: 8 }}>
                {r.mark}
                {r.label}
                {r.tag && <span className="chip static xs" style={{ padding: '1px 8px', minHeight: 0 }}>{r.tag}</span>}
              </span>
              <span className="xs muted" style={{ fontVariantNumeric: 'tabular-nums' }}>
                <strong style={{ color: 'var(--ink)' }}>{fmtIndex(v)}</strong> · {r.note}
              </span>
            </div>
            <div className="index-track tinted" aria-hidden>
              <span className="index-zero" />
              {v !== null && (
                <span
                  className="index-fill"
                  style={{ left: v >= 0 ? '50%' : `${50 - w}%`, width: `${Math.max(w, 0.8)}%`, background: `var(--mood-${lvl})` }}
                />
              )}
            </div>
          </div>
        );
      })}
      <div className="row between xs faint" aria-hidden>
        <span>−2</span>
        <span>0</span>
        <span>+2</span>
      </div>
    </div>
  );
}



/**
 * Arco-resumo da distribuição: um semicírculo dividido pelas proporções dos cinco
 * níveis, com o total no centro e os símbolos com a contagem logo abaixo. Tocar num
 * símbolo pode abrir os registros daquele nível.
 */
export function MoodArc(props: {
  counts: number[];
  total: number;
  totalLabel: string;
  colors: string[];
  labels: string[];
  marks: (i: number) => React.ReactNode;
  onSelect?: (i: number) => void;
  /** Mostra proporções em vez de contagens (ex.: quando cada data pesa igual). */
  sharesOnly?: boolean;
}) {
  const sumC = props.counts.reduce((a, b) => a + b, 0);
  const R = 92;
  const SW = 22;
  const cx = 120;
  const cy = 112;
  const gap = sumC && props.counts.filter(Boolean).length > 1 ? 0.025 : 0;
  let a0 = Math.PI;
  const arcs = props.counts.map((c, i) => {
    if (!c || !sumC) return null;
    const span = (c / sumC) * Math.PI;
    const s0 = a0 + (i === 0 ? 0 : gap / 2);
    const s1 = a0 + span - gap / 2;
    a0 += span;
    const p = (a: number) => [cx + R * Math.cos(a), cy + R * Math.sin(a)];
    const [x0, y0] = p(s0);
    const [x1, y1] = p(Math.max(s0 + 0.0001, s1));
    return <path key={i} d={`M${x0.toFixed(2)} ${y0.toFixed(2)} A${R} ${R} 0 0 1 ${x1.toFixed(2)} ${y1.toFixed(2)}`} stroke={props.colors[i]} strokeWidth={SW} fill="none" strokeLinecap="butt" />;
  });
  return (
    <div className="mood-arc">
      <svg viewBox="0 0 240 124" width="100%" style={{ maxWidth: 320, display: 'block', margin: '0 auto' }} role="img" aria-label={`${props.total} ${props.totalLabel}: ${props.labels.map((l, i) => `${l} ${sumC ? Math.round((props.counts[i] / sumC) * 100) : 0}%`).join(', ')}`}>
        <path d={`M${cx - R} ${cy} A${R} ${R} 0 0 1 ${cx + R} ${cy}`} stroke="var(--surface-2)" strokeWidth={SW} fill="none" />
        {arcs}
        <text x={cx} y={cy - 14} textAnchor="middle" fontSize={34} fontFamily="var(--font-display)" fill="var(--ink)">
          {props.total}
        </text>
        <text x={cx} y={cy + 4} textAnchor="middle" fontSize={11} fill="var(--ink-soft)">
          {props.totalLabel}
        </text>
      </svg>
      <div className="arc-marks">
        {props.counts.map((c, i) => {
          const pct = sumC ? Math.round((c / sumC) * 100) : 0;
          const inner = (
            <>
              <span className="arc-mark-sym">
                {props.marks(i)}
                <span className="arc-badge" style={{ ['--badge' as any]: props.colors[i] }}>
                  {props.sharesOnly ? `${pct}%` : c}
                </span>
              </span>
              <span className="xs muted">{props.sharesOnly ? '' : `${pct}%`}</span>
            </>
          );
          return props.onSelect ? (
            <button key={i} className="arc-mark" onClick={() => props.onSelect!(i)} aria-label={`${props.labels[i]}: ${props.sharesOnly ? `${pct}%` : `${c} (${pct}%)`}`}>
              {inner}
            </button>
          ) : (
            <span key={i} className="arc-mark" aria-label={`${props.labels[i]}: ${c}`}>
              {inner}
            </span>
          );
        })}
      </div>
    </div>
  );
}
