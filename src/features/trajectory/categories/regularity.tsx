import { countsByWeek, monthlyCount, regularity } from '../../../domain/insights';
import { fmtDate, Section } from '../../../ui/components';
import { Bars } from '../charts';
import { useTrajectory } from '../useTrajectory';
import { monthLabel, Note } from './shared';

/* ------------------------------------------------------------------------ */
/* Regularidade                                                              */
/* ------------------------------------------------------------------------ */
export function RegularityBody() {
  const t = useTrajectory();
  const r = regularity(t.entries, t.range.from, t.range.to);
  const weeks = countsByWeek(t.allFiltered, 12, new Date(t.range.to + 'T12:00:00'), t.data.preferences.weekStartsOn);
  const months = monthlyCount(t.allFiltered.filter((m) => m.at.slice(0, 10) <= t.range.to), () => true, 12);
  const parts = [
    ['Madrugada', 0, 5],
    ['Manhã', 6, 11],
    ['Tarde', 12, 17],
    ['Noite', 18, 23],
  ] as const;
  return (
    <>
      <div className="notice calm small">Isto só descreve quando você registrou. Não há meta, sequência ou frequência “certa”.</div>
      <Section title="No período">
        <div className="grid-3">
          <div className="card tight stat">
            <span className="n">{r.withRecords}</span>
            <span className="l">datas com registro</span>
          </div>
          <div className="card tight stat">
            <span className="n">{r.without}</span>
            <span className="l">datas sem registro</span>
          </div>
          <div className="card tight stat">
            <span className="n">{r.retro}</span>
            <span className="l">escritos depois</span>
          </div>
        </div>
      </Section>
      <Section title="Registros por semana">
        <div className="card">
          <Bars rows={weeks.map((w) => ({ label: `sem. ${fmtDate(w.start, { short: true })}`, value: w.n }))} color="var(--comp1-ink)" />
        </div>
      </Section>
      {months.length > 1 && (
        <Section title="Registros por mês">
          <div className="card">
            <Bars rows={months.map((m) => ({ label: monthLabel(m.month), value: m.total }))} color="var(--comp1-ink)" />
          </div>
        </Section>
      )}
      <Section title="Quando você costuma escrever">
        <div className="card">
          <Bars rows={parts.map(([l, a, b]) => ({ label: l, value: r.hours.slice(a, b + 1).reduce((x, y) => x + y, 0) }))} color="var(--comp1-ink)" />
          <Note>Pelo horário em que os registros foram criados no aplicativo (não o horário em que as experiências aconteceram).</Note>
        </div>
      </Section>
    </>
  );
}
