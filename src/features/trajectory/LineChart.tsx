/**
 * Gráfico em linha das oscilações de humor e energia.
 *
 * - Humor e energia compartilham UM eixo de 5 níveis (1…5); a legenda diz o que cada nível
 *   significa em cada série. Nenhum eixo duplo.
 * - Humor: linha contínua com marcadores circulares; energia: linha tracejada com marcadores
 *   quadrados — assim as séries se distinguem sem depender da cor.
 * - Lacunas (mais de 3 dias sem registro) interrompem a linha: ausência não é humor neutro.
 * - Toque, ponteiro ou setas do teclado selecionam um ponto; o detalhe mostra os nomes atuais
 *   da escala. Há também a lista de pontos em formato de tabela.
 */
import { useId, useMemo, useRef, useState } from 'react';
import { navigate } from '../../app/router';
import { useData } from '../../app/store';
import { energyLabel, valenceLabel } from '../../domain/scales';
import { dayKey } from '../../domain/util';
import { gapCount, segments, timeTicks, type SeriesMode, type SeriesPoint } from '../../domain/series';
import { fmtDate, MONTHS_SHORT } from '../../ui/components';
import { EnergyBars, ValenceMark } from '../../ui/pickers';
import { MoodSymbol } from '../../ui/symbols';

const W = 360;
const ML = 28;
const MR = 28;
const MT = 12;
const MB = 24;

export interface LineChartProps {
  points: SeriesPoint[];
  showMood: boolean;
  showEnergy: boolean;
  /** Início e fim do período (AAAA-MM-DD, inclusive). */
  from: string;
  to: string;
  mode: SeriesMode;
  height?: number;
}

const startOf = (day: string) => new Date(`${day}T00:00:00`).getTime();
const endOf = (day: string) => new Date(`${day}T23:59:59`).getTime();

export function pointTimeText(p: SeriesPoint): string {
  if (p.records > 1) return `${fmtDate(p.day, { weekday: true })} · ${p.records} registros`;
  if (p.precision === 'day') return `${fmtDate(p.day, { weekday: true })} · sem horário`;
  return `${fmtDate(p.day, { weekday: true })} · ${p.at.slice(11, 16)}`;
}

export function LineChart(props: LineChartProps) {
  const data = useData();
  const prefs = data.preferences;
  const uid = useId();
  const svgRef = useRef<SVGSVGElement>(null);
  const [sel, setSel] = useState<number | null>(null);
  const H = props.height ?? 220;
  const plotW = W - ML - MR;
  const plotH = H - MT - MB;

  const fromMs = startOf(props.from);
  const toMs = Math.max(endOf(props.to), fromMs + 86400000);
  const x = (t: number) => ML + ((t - fromMs) / (toMs - fromMs)) * plotW;
  const y = (level: number) => MT + ((5 - level) / 4) * plotH;

  const visible = useMemo(() => props.points.filter((p) => p.t >= fromMs && p.t <= toMs && ((props.showMood && p.mood !== null) || (props.showEnergy && p.energy !== null))), [props.points, props.showMood, props.showEnergy, fromMs, toMs]);
  const moodSegs = useMemo(() => (props.showMood ? segments(visible, 'mood') : []), [visible, props.showMood]);
  const energySegs = useMemo(() => (props.showEnergy ? segments(visible, 'energy') : []), [visible, props.showEnergy]);
  const dense = visible.length > 80;
  const ticks = useMemo(() => timeTicks(fromMs, toMs, 5), [fromMs, toMs]);
  const selected = sel !== null ? visible[sel] : null;

  const path = (seg: ReturnType<typeof segments>[number]) => seg.points.map((p, i) => `${i ? 'L' : 'M'}${x(p.t).toFixed(1)} ${y(p.v).toFixed(1)}`).join(' ');

  const nearest = (clientX: number) => {
    const box = svgRef.current?.getBoundingClientRect();
    if (!box || !visible.length) return;
    const tx = fromMs + (((clientX - box.left) / box.width) * W - ML) / plotW * (toMs - fromMs);
    let best = 0;
    for (let i = 1; i < visible.length; i++) if (Math.abs(visible[i].t - tx) < Math.abs(visible[best].t - tx)) best = i;
    setSel(best);
  };

  const onKey = (e: React.KeyboardEvent) => {
    if (!visible.length) return;
    if (e.key === 'ArrowRight' || e.key === 'ArrowLeft') {
      e.preventDefault();
      const d = e.key === 'ArrowRight' ? 1 : -1;
      setSel(sel === null ? (d > 0 ? 0 : visible.length - 1) : Math.max(0, Math.min(visible.length - 1, sel + d)));
    }
    if (e.key === 'Escape') setSel(null);
  };

  const desc = (() => {
    const parts: string[] = [];
    if (props.showMood) parts.push(`humor em ${visible.filter((p) => p.mood !== null).length} ponto(s)`);
    if (props.showEnergy) parts.push(`energia em ${visible.filter((p) => p.energy !== null).length} ponto(s)`);
    return `Gráfico em linha de ${parts.join(' e ')}, de ${fmtDate(props.from, { short: true })} a ${fmtDate(props.to, { short: true })}. Use as setas para percorrer os pontos.`;
  })();

  const gaps = { mood: props.showMood ? gapCount(visible, 'mood') : 0, energy: props.showEnergy ? gapCount(visible, 'energy') : 0 };

  return (
    <div>
      <svg
        ref={svgRef}
        viewBox={`0 0 ${W} ${H}`}
        width="100%"
        role="group"
        aria-label={desc}
        tabIndex={0}
        onKeyDown={onKey}
        onPointerDown={(e) => nearest(e.clientX)}
        onPointerMove={(e) => e.pointerType === 'mouse' && nearest(e.clientX)}
        style={{ touchAction: 'pan-y', display: 'block', outlineOffset: 2 }}
      >
        <title id={`${uid}-t`}>{desc}</title>
        {/* grade recessiva e eixo de níveis */}
        {[1, 2, 3, 4, 5].map((lv) => (
          <g key={lv}>
            <line x1={ML} x2={W - MR} y1={y(lv)} y2={y(lv)} stroke="var(--line)" strokeWidth={lv === 3 ? 1.2 : 1} strokeDasharray={lv === 3 ? undefined : '2 4'} />
            {/* Humor: símbolos da família escolhida à esquerda. Energia: ícones à direita. Mesmas 5 posições. */}
            {props.showMood ? (
              <g transform={`translate(${ML - 23} ${y(lv) - 8})`}>
                <MoodSymbol v={lv - 3} set={prefs.symbolSet} size={16} />
              </g>
            ) : (
              <g transform={`translate(${ML - 20} ${y(lv) - 6})`}>
                <EnergyBars e={lv} size={12} />
              </g>
            )}
            {props.showMood && props.showEnergy && (
              <g transform={`translate(${W - MR + 8} ${y(lv) - 6})`}>
                <EnergyBars e={lv} size={12} />
              </g>
            )}
          </g>
        ))}
        {ticks.map((t) => {
          const d = new Date(t);
          return (
            <g key={t}>
              <line x1={x(t)} x2={x(t)} y1={H - MB} y2={H - MB + 4} stroke="var(--line-strong)" />
              <text x={x(t)} y={H - 6} textAnchor="middle" fontSize={10} fill="var(--ink-faint)">
                {d.getDate()} {MONTHS_SHORT[d.getMonth()]}
              </text>
            </g>
          );
        })}

        {/* energia (tracejada) por baixo, humor (contínua) por cima */}
        {energySegs.map((s, i) => (
          <path key={`e${i}`} d={path(s)} fill="none" stroke="var(--comp1-ink)" strokeWidth={2} strokeDasharray="6 4" strokeLinecap="round" strokeLinejoin="round" />
        ))}
        {moodSegs.map((s, i) => (
          <path key={`m${i}`} d={path(s)} fill="none" stroke="var(--ink-soft)" strokeWidth={2} strokeLinecap="round" strokeLinejoin="round" />
        ))}

        {energySegs.flatMap((s) =>
          s.points
            .filter((p) => !dense || s.points.length === 1 || p.point === selected)
            .map((p) => (
              <rect key={`e${p.point.ids[0]}-${p.t}`} x={x(p.t) - 3.5} y={y(p.v) - 3.5} width={7} height={7} rx={1.5} fill="var(--surface)" stroke="var(--comp1-ink)" strokeWidth={2} />
            )),
        )}
        {moodSegs.flatMap((s) =>
          s.points
            .filter((p) => !dense || s.points.length === 1 || p.point === selected)
            .map((p) => <circle key={`m${p.point.ids[0]}-${p.t}`} cx={x(p.t)} cy={y(p.v)} r={4.5} fill={`var(--mood-${p.v})`} stroke="var(--surface)" strokeWidth={2} />),
        )}

        {/* seleção */}
        {selected && (
          <g pointerEvents="none">
            <line x1={x(selected.t)} x2={x(selected.t)} y1={MT} y2={H - MB} stroke="var(--ink-soft)" strokeWidth={1} strokeDasharray="3 3" />
            {props.showEnergy && selected.energy !== null && (
              <rect x={x(selected.t) - 5} y={y(selected.energy) - 5} width={10} height={10} rx={2} fill="var(--comp1-ink)" stroke="var(--surface)" strokeWidth={2} />
            )}
            {props.showMood && selected.mood !== null && <circle cx={x(selected.t)} cy={y(selected.mood)} r={7} fill={`var(--mood-${selected.mood})`} stroke="var(--ink)" strokeWidth={2} />}
          </g>
        )}

        {!visible.length && (
          <text x={W / 2} y={H / 2} textAnchor="middle" fontSize={12} fill="var(--ink-faint)">
            Sem registros neste recorte
          </text>
        )}
      </svg>

      {/* legenda sempre visível */}
      <div className="chart-legend">
        {props.showMood && (
          <span>
            <svg width={26} height={10} aria-hidden>
              <line x1={1} x2={25} y1={5} y2={5} stroke="var(--ink-soft)" strokeWidth={2} strokeLinecap="round" />
              <circle cx={13} cy={5} r={3.5} fill="var(--mood-4)" stroke="var(--surface)" strokeWidth={1.5} />
            </svg>
            Humor, à esquerda ({valenceLabel(-2, prefs.valenceLabels).toLowerCase()} → {valenceLabel(2, prefs.valenceLabels).toLowerCase()})
          </span>
        )}
        {props.showEnergy && (
          <span>
            <svg width={26} height={10} aria-hidden>
              <line x1={1} x2={25} y1={5} y2={5} stroke="var(--comp1-ink)" strokeWidth={2} strokeDasharray="5 3" strokeLinecap="round" />
              <rect x={9.5} y={1.5} width={7} height={7} rx={1.5} fill="var(--surface)" stroke="var(--comp1-ink)" strokeWidth={2} />
            </svg>
            Energia{props.showMood ? ', à direita' : ''} ({energyLabel(1, prefs.energyLabels).toLowerCase()} → {energyLabel(5, prefs.energyLabels).toLowerCase()})
          </span>
        )}
      </div>

      {gaps.mood + gaps.energy > 0 && (
        <p className="xs faint" style={{ margin: '8px 0 0' }}>
          A linha é interrompida quando passam mais de 3 dias sem registro — dias sem registro não contam como neutros.
        </p>
      )}

      {/* detalhe do ponto selecionado */}
      <div className="card tight" style={{ marginTop: 10, minHeight: 64 }} aria-live="polite">
        {selected ? (
          <div className="stack" style={{ gap: 6 }}>
            <div className="small faint">{pointTimeText(selected)}</div>
            {selected.mood !== null && props.showMood && (
              <div className="row" style={{ gap: 8 }}>
                <ValenceMark v={selected.mood - 3} size={20} />
                <span>
                  {valenceLabel(selected.mood - 3, prefs.valenceLabels)}
                  {selected.records > 1 ? ' (mediana do dia)' : ''}
                </span>
              </div>
            )}
            {selected.energy !== null && props.showEnergy && (
              <div className="row" style={{ gap: 8 }}>
                <EnergyBars e={selected.energy} size={16} />
                <span>
                  {energyLabel(selected.energy, prefs.energyLabels)}
                  {selected.records > 1 ? ' (mediana do dia)' : ''}
                </span>
              </div>
            )}
            {selected.emotionIds.length > 0 && (
              <div className="small muted">
                {selected.emotionIds
                  .map((id) => data.emotions.find((e) => e.id === id)?.label)
                  .filter(Boolean)
                  .join(', ')}
              </div>
            )}
            <button
              className="btn ghost sm"
              style={{ alignSelf: 'flex-start', paddingLeft: 0 }}
              onClick={() => navigate(props.mode === 'record' && selected.records === 1 ? `/diario?registro=${selected.ids[0]}` : `/diario?de=${selected.day}&ate=${selected.day}`)}
            >
              {props.mode === 'record' && selected.records === 1 ? 'Abrir este registro' : 'Ver os registros desta data'}
            </button>
          </div>
        ) : (
          <p className="small muted" style={{ margin: 0 }}>
            Toque no gráfico (ou use as setas do teclado) para ver um ponto. {props.mode === 'day' ? 'Cada ponto resume uma data pela mediana, não por média.' : 'Cada ponto é um registro.'}
          </p>
        )}
      </div>
    </div>
  );
}

/** Os mesmos pontos em formato de tabela (alternativa acessível ao gráfico). */
export function SeriesTable({ points, showMood, showEnergy, limit = 60 }: { points: SeriesPoint[]; showMood: boolean; showEnergy: boolean; limit?: number }) {
  const prefs = useData().preferences;
  const rows = [...points].filter((p) => (showMood && p.mood !== null) || (showEnergy && p.energy !== null)).reverse().slice(0, limit);
  return (
    <details>
      <summary className="small" style={{ cursor: 'pointer' }}>
        Ver como tabela ({rows.length}
        {points.length > rows.length ? ` mais recentes de ${points.length}` : ''})
      </summary>
      <div style={{ overflowX: 'auto', marginTop: 8 }}>
        <table style={{ borderCollapse: 'collapse', width: '100%', fontSize: 12.5 }}>
          <thead>
            <tr style={{ textAlign: 'left' }}>
              <th style={{ padding: '4px 6px' }}>Quando</th>
              {showMood && <th style={{ padding: '4px 6px' }}>Humor</th>}
              {showEnergy && <th style={{ padding: '4px 6px' }}>Energia</th>}
            </tr>
          </thead>
          <tbody>
            {rows.map((p) => (
              <tr key={p.ids.join('|')} style={{ borderTop: '1px solid var(--line)' }}>
                <td style={{ padding: '4px 6px' }}>{pointTimeText(p)}</td>
                {showMood && <td style={{ padding: '4px 6px' }}>{p.mood === null ? '—' : valenceLabel(p.mood - 3, prefs.valenceLabels)}</td>}
                {showEnergy && <td style={{ padding: '4px 6px' }}>{p.energy === null ? '—' : energyLabel(p.energy, prefs.energyLabels)}</td>}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
    </details>
  );
}

export { dayKey };
