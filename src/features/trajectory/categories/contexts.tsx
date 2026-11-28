import { useMemo } from 'react';
import { contextSummary, CONTEXT_MIN_RECORDS, findPatterns, PATTERN_MIN_ENTRIES } from '../../../domain/analytics';
import { INDICATORS, valenceLabel } from '../../../domain/scales';
import { navigate } from '../../../app/router';
import { Section } from '../../../ui/components';
import { StackRows } from '../charts';
import { MOOD_COLORS } from '../Trajectory';
import { useTrajectory } from '../useTrajectory';
import { pct, Insufficient, Note } from './shared';

/* ------------------------------------------------------------------------ */
/* Contextos: o que foi relatado (descritivo) e associações testadas          */
/* ------------------------------------------------------------------------ */
export function ContextsBody() {
  const t = useTrajectory();
  const prefs = t.data.preferences;
  const emo = new Map(t.data.emotions.map((e) => [e.id, e.label]));
  const sum = useMemo(() => contextSummary(t.entries), [t.entries]);
  const vLabels = [-2, -1, 0, 1, 2].map((v) => valenceLabel(v, prefs.valenceLabels));
  const row = (r: (typeof sum.rows)[number], dim = false) => ({
    label: r.tag,
    counts: [...r.valence],
    note: `${r.records} reg. · ${r.dates} data(s)${r.emotions.length ? ` · ${r.emotions.map((e) => `${(emo.get(e.id) ?? '?').toLowerCase()} ${pct(e.share)}`).join(', ')}` : ''}`,
    dim,
  });
  return (
    <>
      <Section title="O que você relatou" kicker="Contextos marcados nos registros de humor">
        {sum.rows.length === 0 ? (
          <div className="card dashed small muted">
            Nenhum contexto marcado ao menos {CONTEXT_MIN_RECORDS} vezes neste recorte. Ao registrar o humor, você pode marcar o contexto (trabalho, família, sono…) — é opcional.
          </div>
        ) : (
          <div className="card stack">
            <StackRows colors={MOOD_COLORS} legend={vLabels} rows={[...sum.rows.slice(0, 12).map((r) => row(r)), ...(sum.none.records ? [row(sum.none, true)] : [])]} />
            <div className="chips">
              {sum.rows.slice(0, 12).map((r) => (
                <button key={r.tag} className="chip tag" onClick={() => navigate(`/diario?de=${t.range.from}&ate=${t.range.to}&marcador=${encodeURIComponent(r.tag)}`)}>
                  {r.tag}
                </button>
              ))}
            </div>
            <Note>
              Por registro: cada barra mostra como foram avaliados os registros em que você marcou aquele contexto, e ao lado as emoções que mais apareceram junto (em % desses
              registros). Um registro pode ter vários contextos. É o que você relatou — não mostra que o contexto causou o humor. Toque num contexto para ver os registros. {sum.withContext} de{' '}
              {t.entries.length} registros têm contexto marcado.
            </Note>
          </div>
        )}
      </Section>
      <Section title="Associações que resistem ao acaso" kicker="Comparação com e sem cada contexto">
        <PatternsPart />
      </Section>
    </>
  );
}

function PatternsPart() {
  const t = useTrajectory();
  const prefs = t.data.preferences;
  const res = useMemo(() => findPatterns(t.entries, { indicators: prefs.enabledIndicators }), [t.entries, prefs.enabledIndicators]);
  const emo = new Map(t.data.emotions.map((e) => [e.id, e.label]));
  if (!res.enough) return <Insufficient n={res.total} need={PATTERN_MIN_ENTRIES} />;
  const metricName = (m: string) =>
    m === 'valence' ? 'avaliação' : m === 'energy' ? 'energia' : m.startsWith('emotion:') ? (emo.get(m.slice(8)) ?? 'emoção').toLowerCase() : INDICATORS[m as keyof typeof INDICATORS]?.label.toLowerCase();
  return (
    <>
      <p className="small muted">
        Comparação dos registros com e sem cada marcador de contexto. Escalas ordenadas usam o delta de Cliff (|δ| ≥ 0,3) e o teste de Mann-Whitney; emoções, a diferença de proporções
        (≥ 25 pontos) e o teste exato de Fisher. Como muitas comparações são feitas ao mesmo tempo ({res.tests ?? 0} neste recorte), só aparece o que continua improvável por acaso
        depois da correção de Benjamini-Hochberg. Exige 20 registros no período e 5 em cada grupo. São associações, não causas.
      </p>
      {res.patterns.length === 0 ? (
        <div className="card dashed small muted">
          Nenhuma associação clara neste recorte: as diferenças encontradas estão dentro do que o acaso costuma produzir com esta quantidade de registros. Isso também é informação.
        </div>
      ) : (
        <div className="stack">
          {res.patterns.slice(0, 12).map((p) => (
            <div key={p.id} className="card tight" style={{ borderLeft: '3px solid var(--comp1-ink)' }}>
              <p className="xs faint" style={{ margin: 0 }}>
                “{p.tag}” × {metricName(p.metric)} · {p.withN} com o marcador, {p.withoutN} sem
              </p>
              <p style={{ margin: '4px 0 0' }}>
                {p.metric.startsWith('emotion:')
                  ? `${metricName(p.metric)} apareceu em ${pct(p.withShare)} dos registros com “${p.tag}”, contra ${pct(p.withoutShare)} nos demais.`
                  : `Com “${p.tag}”, ${pct(p.withShare)} dos registros ficaram nas duas categorias mais altas de ${metricName(p.metric)}, contra ${pct(p.withoutShare)} nos demais.`}
              </p>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

/**
 * Calendário emocional: não usa o período nem os filtros da Trajetória (eles não
 * fazem sentido num calendário que se navega mês a mês). Em vez disso, cinco visões.
 */
