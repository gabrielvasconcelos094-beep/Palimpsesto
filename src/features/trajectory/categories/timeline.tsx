import { apptTitle, medChanges } from '../../../domain/care';
import { navigate } from '../../../app/router';
import { valenceCounts } from '../../../domain/analytics';
import { valenceLabel } from '../../../domain/scales';
import { Empty, fmtDate, Section } from '../../../ui/components';
import { EventIcon, eventRange } from '../../journal/EventEditor';
import { MOOD_COLORS } from '../Trajectory';
import { useTrajectory } from '../useTrajectory';

/* ------------------------------------------------------------------------ */
/* Linha do tempo                                                            */
/* ------------------------------------------------------------------------ */
export function TimelineBody() {
  const t = useTrajectory();
  const labels = t.data.preferences.valenceLabels;
  const events = [...t.events].sort((a, b) => b.date.localeCompare(a.date));
  const meds = medChanges(t.data.medications, t.range.from, t.range.to).reverse();
  const visits = t.data.appointments.filter((a) => a.status === 'done' && a.date >= t.range.from && a.date <= t.range.to).sort((a, b) => b.date.localeCompare(a.date));
  return (
    <>
      <p className="small muted">
        Acontecimentos do período, com os registros de humor feitos enquanto eles aconteciam. Estar no mesmo período não significa que um causou o outro.
      </p>
      {(meds.length > 0 || visits.length > 0) && (
        <Section title="Consultas e medicação no período">
          <div className="list">
            {[...meds.map((c) => ({ date: c.date, key: `m${c.date}${c.med.id}${c.kind}`, title: `${c.med.name}: ${c.kind === 'start' ? 'início' : c.kind === 'dose' ? 'nova dose' : 'suspenso'}`, meta: c.text, to: `/guia/remedio/${c.med.id}` })),
              ...visits.map((v) => ({ date: v.date, key: v.id, title: `Consulta · ${apptTitle(v)}`, meta: v.agreements ? `Combinados: ${v.agreements}` : '', to: `/guia/consulta/${v.id}` }))]
              .sort((a, b) => b.date.localeCompare(a.date))
              .map((r) => (
                <button key={r.key} className="list-row" onClick={() => navigate(r.to)}>
                  <div className="grow">
                    <div className="title">{r.title}</div>
                    <div className="meta">
                      {fmtDate(r.date, { withYear: true })}
                      {r.meta ? ` · ${r.meta.slice(0, 120)}` : ''}
                    </div>
                  </div>
                </button>
              ))}
          </div>
        </Section>
      )}
      {events.length === 0 ? (
        <Empty
          title="Nenhum acontecimento neste período"
          action={
            <button className="btn primary" onClick={() => navigate('/diario/acontecimento/novo')}>
              Registrar um acontecimento
            </button>
          }
        >
          Viagens, mudanças, conquistas, começos e fins — inclusive de meses atrás.
        </Empty>
      ) : (
        <div className="stack">
          {events.map((e) => {
            const during = t.entries.filter((m) => m.at.slice(0, 10) >= e.date && m.at.slice(0, 10) <= (e.endDate ?? e.date));
            const c = valenceCounts(during);
            return (
              <button key={e.id} className="card tight" onClick={() => navigate(`/diario/acontecimento/${e.id}`)}>
                <div className="row">
                  <EventIcon c={e.category} />
                  <div className="grow">
                    <div style={{ fontWeight: 600 }}>{e.title}</div>
                    <div className="xs muted">{eventRange(e)}</div>
                  </div>
                </div>
                {during.length > 0 ? (
                  <>
                    <div className="stackbar" style={{ marginTop: 8 }}>
                      {c.map((x, i) => (x ? <div key={i} style={{ width: `${(x / during.length) * 100}%`, background: MOOD_COLORS[i] }} /> : null))}
                    </div>
                    <p className="xs faint" style={{ margin: '4px 0 0' }}>
                      {during.length} registro(s) no período · mais frequente: {valenceLabel(c.indexOf(Math.max(...c)) - 2, labels).toLowerCase()}
                    </p>
                  </>
                ) : (
                  <p className="xs faint" style={{ margin: '6px 0 0' }}>Sem registros de humor nesse período.</p>
                )}
              </button>
            );
          })}
        </div>
      )}
    </>
  );
}
