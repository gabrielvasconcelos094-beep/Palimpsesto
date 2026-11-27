import { buckets, energyCounts } from '../../../domain/analytics';
import { emotionCounts, energyValenceTable, extremesOfEnergy, monthlyCount } from '../../../domain/insights';
import { energyLabel, valenceLabel } from '../../../domain/scales';
import { Empty, fmtDate, Section } from '../../../ui/components';
import { Distribution, Evolution, HeatTable } from '../charts';
import { ENERGY_COLORS } from '../Trajectory';
import { useTrajectory } from '../useTrajectory';
import { pct, monthLabel, Note } from './shared';

/* ------------------------------------------------------------------------ */
/* Energia                                                                   */
/* ------------------------------------------------------------------------ */
export function EnergyBody() {
  const t = useTrajectory();
  const prefs = t.data.preferences;
  const withE = t.entries.filter((m) => m.energy);
  const emo = new Map(t.data.emotions.map((e) => [e.id, e.label]));
  const eLabels = [1, 2, 3, 4, 5].map((e) => energyLabel(e, prefs.energyLabels));
  const vLabels = [-2, -1, 0, 1, 2].map((v) => valenceLabel(v, prefs.valenceLabels));
  if (withE.length === 0) return <Empty title="Nenhum registro com energia neste recorte">O nível de energia é opcional em cada registro.</Empty>;
  const evo = buckets(withE, { from: new Date(t.range.from + 'T00:00:00'), to: new Date(t.range.to + 'T23:59:59') }, (e) => (e.energy ? e.energy - 1 : null), prefs.weekStartsOn);
  const table = energyValenceTable(withE);
  const low = withE.filter((m) => m.energy! <= 2);
  const lowEmo = emotionCounts(low).slice(0, 5);
  const ext = extremesOfEnergy(withE);
  const exhausted = monthlyCount(t.allFiltered.filter((m) => m.energy && m.at.slice(0, 10) <= t.range.to), (m) => m.energy === 1, 6);
  const prevE = t.prevEntries.filter((m) => m.energy);
  return (
    <>
      <Section title="Distribuição">
        <div className="card">
          <Distribution labels={eLabels} colors={ENERGY_COLORS} counts={energyCounts(withE)} compare={t.period.compare && prevE.length ? energyCounts(prevE) : null} />
          <Note>{withE.length} registro(s) com energia. Ative “comparar com o período anterior” na visão geral para ver as duas barras.</Note>
        </div>
      </Section>
      <Section title="Evolução">
        <div className="card">
          <Evolution buckets={evo.items} colors={ENERGY_COLORS} labels={eLabels} unit={evo.unit} height={120} />
        </div>
      </Section>
      <Section title="Energia e humor">
        <div className="card">
          <HeatTable rowLabels={eLabels} colLabels={vLabels.map((l) => l.split(' ').map((w) => w[0]).join('').toUpperCase())} values={table} caption={`Quantos registros combinaram cada nível de energia (linhas) com cada avaliação (colunas: ${vLabels.join(', ')}). É uma descrição conjunta, não uma relação de causa.`} />
        </div>
      </Section>
      <Section title="Emoções em registros de baixa energia">
        <div className="card small">
          {low.length < 3 ? (
            <span className="muted">Poucos registros de baixa energia ({low.length}).</span>
          ) : (
            lowEmo.map((c) => (
              <div key={c.id} className="row between">
                <span>{emo.get(c.id)}</span>
                <span className="muted">
                  {c.count} de {low.length} ({pct(c.share)})
                </span>
              </div>
            ))
          )}
        </div>
      </Section>
      <Section title="Esgotamento e extremos">
        <div className="card small stack">
          <div>
            <strong>Registros de “{eLabels[0]}” por mês:</strong> {exhausted.map((m) => `${monthLabel(m.month)}: ${m.n} de ${m.total}`).join(' · ') || '—'}
          </div>
          <div>
            <strong>Datas com energia máxima registrada:</strong> {ext.highest.slice(0, 6).map((d) => fmtDate(d, { short: true })).join(', ') || '—'}
          </div>
          <div>
            <strong>Datas com energia mínima registrada:</strong> {ext.lowest.slice(0, 6).map((d) => fmtDate(d, { short: true })).join(', ') || '—'}
          </div>
          <Note>Essas informações descrevem seus registros; o Palimpsesto não interpreta níveis de energia como sinais clínicos.</Note>
        </div>
      </Section>
    </>
  );
}
