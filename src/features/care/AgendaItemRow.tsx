/**
 * Um assunto da pauta. Marcado como conversado, NÃO some: fica riscado, com o que
 * ficou acertado. Pode ser vinculado a dias ("quando aconteceu") — tocar num dia
 * abre os registros dele, útil durante a sessão — e à consulta em que foi conversado.
 */
import { useState } from 'react';
import { CalendarPlus, Check, Trash2, X } from 'lucide-react';
import { navigate } from '../../app/router';
import { store, useData } from '../../app/store';
import { removeWithUndo } from '../../app/undo';
import { apptTitle, lastGender, whoLabel } from '../../domain/care';
import type { AgendaItem, Appointment } from '../../domain/schema';
import { dayKey } from '../../domain/util';
import { AutoText, fmtDate } from '../../ui/components';


export function AgendaItemRow({ a, appointment }: { a: AgendaItem; appointment?: Appointment }) {
  const data = useData();
  const today = dayKey(new Date());
  const [addingDay, setAddingDay] = useState(false);
  const [showNote, setShowNote] = useState(false);
  const linked = a.appointmentId ? data.appointments.find((x) => x.id === a.appointmentId) : undefined;
  const toggle = () => {
    if (a.doneAt) store.patch('agenda', a.id, { doneAt: null, appointmentId: appointment ? null : a.appointmentId });
    else {
      const when = appointment && appointment.date <= today ? appointment.date : today;
      store.patch('agenda', a.id, { doneAt: when, appointmentId: appointment?.id ?? a.appointmentId });
      setShowNote(true);
    }
  };
  return (
    <div className="list-row" style={{ alignItems: 'flex-start', flexDirection: 'column', gap: 6 }}>
      <div className="row" style={{ width: '100%', alignItems: 'flex-start' }}>
        <button
          className="icon-btn"
          aria-label={a.doneAt ? `Marcar como não conversado: ${a.text}` : `Marcar como conversado: ${a.text}`}
          aria-pressed={!!a.doneAt}
          onClick={toggle}
          style={{ border: '1.5px solid var(--line)', width: 28, height: 28, minWidth: 28, borderRadius: 8, background: a.doneAt ? 'var(--primary-ink)' : 'transparent', color: 'var(--bg)' }}
        >
          {a.doneAt && <Check size={16} />}
        </button>
        <div className="grow">
          <div style={{ textDecoration: a.doneAt ? 'line-through' : undefined, color: a.doneAt ? 'var(--ink-soft)' : undefined }}>{a.text}</div>
          <div className="xs faint">
            {a.forWhom === 'ambos' ? 'Psiquiatra e psicóloga(o)' : whoLabel(a.forWhom, lastGender(data.appointments, 'psicologia'))} · anotado em {fmtDate(a.createdAt, { short: true })}
            {a.doneAt ? ` · conversado em ${fmtDate(a.doneAt, { short: true })}` : ''}
            {linked && !appointment ? ` (${apptTitle(linked)})` : ''}
          </div>
        </div>
        <button className="icon-btn" aria-label={`Vincular um dia: ${a.text}`} onClick={() => setAddingDay(!addingDay)}>
          <CalendarPlus size={16} />
        </button>
        <button className="icon-btn" aria-label={`Excluir assunto: ${a.text}`} onClick={() => removeWithUndo('agenda', a.id, 'Assunto excluído.')}>
          <Trash2 size={16} />
        </button>
      </div>
      {(a.dates.length > 0 || addingDay) && (
        <div className="row wrap" style={{ gap: 6, paddingLeft: 40 }}>
          {a.dates.map((d) => (
            <span key={d} className="chip static xs" style={{ gap: 4, padding: '2px 4px 2px 10px' }}>
              <button className="link-btn" onClick={() => navigate(`/diario?de=${d}&ate=${d}`)} aria-label={`Ver os registros de ${fmtDate(d, { withYear: true })}`}>
                {fmtDate(d, { short: true })}
              </button>
              <button className="link-btn" aria-label={`Desvincular ${fmtDate(d, { short: true })}`} onClick={() => store.patch('agenda', a.id, { dates: a.dates.filter((x) => x !== d) })}>
                <X size={12} />
              </button>
            </span>
          ))}
          {addingDay && (
            <input
              type="date"
              className="input"
              style={{ width: 170, minHeight: 34, padding: '4px 8px' }}
              aria-label="Dia relacionado"
              max={today}
              onChange={(e) => {
                const d = e.target.value;
                if (d && !a.dates.includes(d)) store.patch('agenda', a.id, { dates: [...a.dates, d].sort() });
                setAddingDay(false);
              }}
            />
          )}
        </div>
      )}
      {a.doneAt && (showNote || a.outcome || a.doneAt === today) && (
        <div style={{ width: '100%', paddingLeft: 40 }}>
          <AutoText value={a.outcome} onChange={(outcome) => store.patch('agenda', a.id, { outcome })} placeholder="O que ficou acertado sobre esse assunto…" minRows={1} />
        </div>
      )}
      {a.doneAt && !(showNote || a.outcome || a.doneAt === today) && (
        <button className="btn ghost sm" style={{ marginLeft: 32 }} onClick={() => setShowNote(true)}>
          Anotar o que ficou acertado
        </button>
      )}
    </div>
  );
}
