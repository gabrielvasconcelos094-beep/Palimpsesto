/**
 * Gráficos em SVG/HTML próprios, guiados pelos tokens do tema.
 * - Valência é ordinal: mostramos contagens e proporções, nunca médias.
 * - Identidade nunca depende só da cor: legenda sempre visível e valores no toque.
 */
import { useState } from 'react';
import type { Bucket, Counts5 } from '../../domain/analytics';
import { shares, sum } from '../../domain/analytics';

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
}) {
  const s = shares(props.counts);
  const c = props.compare ? shares(props.compare) : null;
  const max = Math.max(...s, ...(c ?? []), 0.0001);
  return (
    <div className="stack" style={{ gap: 12 }}>
      {props.labels.map((label, i) => (
        <div key={i}>
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
          <div className="bar-track" style={{ height: 9 }}>
            <div className="bar-fill" style={{ width: `${(s[i] / max) * 100}%`, background: props.colors[i] }} />
          </div>
          {c && (
            <div className="bar-track" style={{ height: 6, marginTop: 3, background: 'transparent' }} aria-hidden>
              <div className="bar-fill" style={{ width: `${(c[i] / max) * 100}%`, background: `repeating-linear-gradient(135deg, ${props.colors[i]} 0 3px, transparent 3px 6px)` }} />
            </div>
          )}
        </div>
      ))}
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

  return (
    <div>
      <div style={{ overflowX: 'auto' }}>
        <svg viewBox={`0 0 ${W} ${H + 22}`} width="100%" style={{ minWidth: Math.min(W, 640), maxHeight: H + 40 }} role="img" aria-label="Evolução ao longo do tempo">
          {ticks.map((t) => {
            const y = H - (t / max) * H;
            return (
              <g key={t}>
                <line x1={0} x2={W} y1={y} y2={y} stroke="var(--line)" strokeWidth={1} />
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
              return <rect key={k} x={x} y={y + 1} width={barW} height={Math.max(1, h - 2)} rx={Math.min(3, barW / 3)} fill={props.colors[k]} />;
            });
            return (
              <g key={i} onClick={() => setSel(sel === i ? null : i)} style={{ cursor: 'pointer' }}>
                <rect x={i * colW} y={0} width={colW} height={H + 20} fill={sel === i ? 'var(--surface-2)' : 'transparent'} />
                {segs}
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
      <table style={{ borderCollapse: 'separate', borderSpacing: 3, fontSize: 12, width: '100%' }}>
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
                    background: v ? `color-mix(in srgb, var(--primary-ink) ${Math.round(6 + (v / max) * 22)}%, var(--surface))` : 'var(--surface-2)',
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
