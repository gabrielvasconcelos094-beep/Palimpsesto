/**
 * Medicamentos: o que você toma (dose e frequência), o histórico de doses, os que
 * já tomou (e por que parou) e as suas observações datadas.
 *
 * Por que assim: numa consulta de psiquiatria, as perguntas mais comuns são "o que
 * você toma hoje, em que dose?", "desde quando?", "o que já tomou e por que parou?"
 * e "notou algum efeito?". O histórico de tentativas anteriores (dose e duração)
 * orienta as próximas escolhas. Não há banco de remédios, cálculo de dose nem
 * lembrete de tomar: é um registro seu, para levar e conferir com quem prescreve.
 */
import { useState } from 'react';
import { ChevronRight, Pill, Plus } from 'lucide-react';
import { goBack, navigate, useRoute } from '../../app/router';
import { store, useData } from '../../app/store';
import { toast } from '../../app/toast';
import { removeWithUndo } from '../../app/undo';
import { activeMeds, currentDose, isActive, pastMeds, STOP_REASON_LABELS } from '../../domain/care';
import { STOP_REASONS, type Medication } from '../../domain/schema';
import { dayKey } from '../../domain/util';
import { AutoText, Field, fmtDate, Page, Section, useConfirm } from '../../ui/components';

const SCHEDULE_HINTS = ['1x ao dia, de manhã', '1x ao dia, à noite', '2x ao dia', 'se necessário'];

function since(date: string, today: string) {
  const days = Math.round((new Date(today + 'T12:00:00').getTime() - new Date(date + 'T12:00:00').getTime()) / 86400000);
  if (days < 0) return `a partir de ${fmtDate(date, { short: true })}`;
  if (days < 60) return `há ${days} dia(s)`;
  const months = Math.round(days / 30.4);
  return months < 24 ? `há ${months} meses` : `há ${Math.round(months / 12)} anos`;
}

/* ------------------------------------------------------------------------ */
/* Seção na aba Consultas                                                    */
/* ------------------------------------------------------------------------ */
export function MedicationsSection() {
  const data = useData();
  const today = dayKey(new Date());
  const act = activeMeds(data.medications, today);
  const old = pastMeds(data.medications, today);
  const [showOld, setShowOld] = useState(false);
  return (
    <Section title="Medicamentos" kicker="O que você toma e já tomou" action={<button className="btn ghost sm" aria-label="Adicionar medicamento" onClick={() => navigate('/guia/remedio/novo')}><Plus size={15} /> Adicionar</button>}>
      <div id="remedios" />
      {act.length === 0 && old.length === 0 ? (
        <button className="card dashed row" onClick={() => navigate('/guia/remedio/novo')}>
          <span className="ico-tile" aria-hidden>
            <Pill size={18} strokeWidth={1.8} />
          </span>
          <div className="grow">
            <div className="h3">Registrar um medicamento</div>
            <div className="small muted">Nome, dose, frequência e desde quando. Se não toma nenhum, pode ignorar esta parte.</div>
          </div>
        </button>
      ) : (
        <>
          {act.length > 0 ? (
            <div className="list">
              {act.map((m) => (
                <MedRow key={m.id} m={m} today={today} />
              ))}
            </div>
          ) : (
            <p className="small muted">Nenhum medicamento em uso no momento.</p>
          )}
          {old.length > 0 && (
            <button className="btn ghost sm" style={{ marginTop: 6 }} onClick={() => setShowOld(!showOld)} aria-expanded={showOld}>
              {showOld ? 'Ocultar' : 'Ver'} medicamentos anteriores ({old.length})
            </button>
          )}
          {showOld && (
            <div className="list" style={{ marginTop: 6 }}>
              {old.map((m) => (
                <MedRow key={m.id} m={m} today={today} />
              ))}
            </div>
          )}
        </>
      )}
      <p className="xs faint" style={{ margin: '8px 0 0' }}>
        Um registro seu, para levar à consulta. Nunca comece, pare ou mude a dose sem orientação de quem prescreve.
      </p>
    </Section>
  );
}

function MedRow({ m, today }: { m: Medication; today: string }) {
  const d = currentDose(m);
  const on = isActive(m, today);
  return (
    <button className="list-row" onClick={() => navigate(`/guia/remedio/${m.id}`)}>
      <span className="ico-tile" aria-hidden>
        <Pill size={18} strokeWidth={1.8} />
      </span>
      <div className="grow">
        <div className="title">
          {m.name} · {d.dose}
        </div>
        <div className="meta">
          {on
            ? `${d.schedule || 'frequência não informada'} · ${since(m.startDate, today)}`
            : `${fmtDate(m.startDate, { short: true, withYear: true })} a ${fmtDate(m.endDate!, { short: true, withYear: true })}${m.stopReason ? ` · ${STOP_REASON_LABELS[m.stopReason].toLowerCase()}` : ''}`}
        </div>
      </div>
      <ChevronRight className="chev" size={18} />
    </button>
  );
}

/* ------------------------------------------------------------------------ */
/* Página                                                                    */
/* ------------------------------------------------------------------------ */
export function MedicationPage() {
  const route = useRoute();
  const id = route.parts[2];
  const data = useData();
  const m = id && id !== 'novo' ? data.medications.find((x) => x.id === id) : undefined;
  if (!m) return <NewMedication notFound={id !== 'novo'} />;
  return <MedicationDetail m={m} />;
}

function ScheduleInput({ value, onChange }: { value: string; onChange: (v: string) => void }) {
  return (
    <div className="stack" style={{ gap: 6 }}>
      <input className="input" value={value} maxLength={160} placeholder="Ex.: 1x ao dia, de manhã" aria-label="Frequência" onChange={(e) => onChange(e.target.value)} />
      <div className="chips">
        {SCHEDULE_HINTS.map((h) => (
          <button key={h} className="chip" aria-pressed={value === h} onClick={() => onChange(h)}>
            {h}
          </button>
        ))}
      </div>
    </div>
  );
}

function NewMedication({ notFound }: { notFound: boolean }) {
  const today = dayKey(new Date());
  const [d, setD] = useState({ name: '', dose: '', schedule: '', startDate: today, purpose: '', prescriber: '', past: false, endDate: today, stopReason: null as Medication['stopReason'] });
  const ok = d.name.trim() && d.dose.trim() && d.startDate && (!d.past || d.endDate >= d.startDate);
  const save = () => {
    const created = store.upsert('medications', {
      name: d.name.trim(),
      purpose: d.purpose.trim(),
      prescriber: d.prescriber.trim(),
      startDate: d.startDate,
      endDate: d.past ? d.endDate : null,
      stopReason: d.past ? d.stopReason : null,
      doses: [{ date: d.startDate, dose: d.dose.trim(), schedule: d.schedule.trim(), note: '' }],
    });
    toast('Medicamento registrado.');
    navigate(`/guia/remedio/${created.id}`, { replace: true });
  };
  return (
    <Page back="/guia?t=acompanhamento" noNav kicker="Medicamentos" title={notFound ? 'Medicamento não encontrado' : 'Novo medicamento'} ghost="remédio">
      <div className="stack lg">
        <Field label="Nome">
          <input className="input" value={d.name} maxLength={120} placeholder="Ex.: Sertralina" onChange={(e) => setD({ ...d, name: e.target.value })} />
        </Field>
        <div className="grid-2">
          <Field label="Dose">
            <input className="input" value={d.dose} maxLength={80} placeholder="Ex.: 50 mg" onChange={(e) => setD({ ...d, dose: e.target.value })} />
          </Field>
          <Field label="Desde">
            <input type="date" className="input" aria-label="Data de início" value={d.startDate} onChange={(e) => setD({ ...d, startDate: e.target.value })} />
          </Field>
        </div>
        <Field label="Frequência" optional>
          <ScheduleInput value={d.schedule} onChange={(schedule) => setD({ ...d, schedule })} />
        </Field>
        <Field label="Para quê" optional help="Nas suas palavras — ex.: ansiedade, sono.">
          <input className="input" value={d.purpose} maxLength={300} onChange={(e) => setD({ ...d, purpose: e.target.value })} />
        </Field>
        <Field label="Quem prescreveu" optional>
          <input className="input" value={d.prescriber} maxLength={120} onChange={(e) => setD({ ...d, prescriber: e.target.value })} />
        </Field>
        <label className="row" style={{ gap: 10 }}>
          <input type="checkbox" checked={d.past} onChange={(e) => setD({ ...d, past: e.target.checked })} />
          <span className="small">Já parei de tomar (para registrar o histórico)</span>
        </label>
        {d.past && (
          <>
            <Field label="Até">
              <input type="date" className="input" aria-label="Data em que parou" value={d.endDate} min={d.startDate} onChange={(e) => setD({ ...d, endDate: e.target.value })} />
            </Field>
            <StopReasonPicker value={d.stopReason} onChange={(stopReason) => setD({ ...d, stopReason })} />
          </>
        )}
        <button className="btn primary block" disabled={!ok} onClick={save}>
          Salvar
        </button>
      </div>
    </Page>
  );
}

function StopReasonPicker({ value, onChange }: { value: Medication['stopReason']; onChange: (v: Medication['stopReason']) => void }) {
  return (
    <Field label="Por que parou" optional>
      <div className="chips" role="group" aria-label="Motivo">
        {STOP_REASONS.map((r) => (
          <button key={r} className="chip" aria-pressed={value === r} onClick={() => onChange(value === r ? null : r)}>
            {STOP_REASON_LABELS[r]}
          </button>
        ))}
      </div>
    </Field>
  );
}

function MedicationDetail({ m }: { m: Medication }) {
  const today = dayKey(new Date());
  const on = isActive(m, today);
  const cur = currentDose(m);
  const { ask, node } = useConfirm();
  const [mode, setMode] = useState<null | 'dose' | 'note' | 'stop'>(null);
  const [dose, setDose] = useState({ date: today, dose: cur.dose, schedule: cur.schedule, note: '' });
  const [note, setNote] = useState({ date: today, text: '' });
  const [stop, setStop] = useState({ date: today, reason: null as Medication['stopReason'] });
  const patch = (p: Partial<Medication>) => store.patch('medications', m.id, p);

  const timeline = [
    ...m.doses.map((d, i) => ({ date: d.date, kind: i === 0 ? 'Início' : 'Nova dose', text: `${d.dose}${d.schedule ? ` · ${d.schedule}` : ''}${d.note ? ` — ${d.note}` : ''}`, key: `d${i}`, idx: i, type: 'dose' as const })),
    ...m.notes.map((n, i) => ({ date: n.date, kind: 'Observação', text: n.text, key: `n${i}`, idx: i, type: 'note' as const })),
    ...(m.endDate ? [{ date: m.endDate, kind: 'Parou', text: m.stopReason ? STOP_REASON_LABELS[m.stopReason] : '', key: 'end', idx: 0, type: 'end' as const }] : []),
  ].sort((a, b) => b.date.localeCompare(a.date) || (a.type === 'end' ? -1 : 0));

  return (
    <Page
      back="/guia?t=acompanhamento"
      noNav
      kicker={on ? 'Medicamento em uso' : 'Medicamento anterior'}
      title={m.name}
      subtitle={`${cur.dose}${cur.schedule ? ` · ${cur.schedule}` : ''}${on ? ` · ${since(m.startDate, today)}` : ''}`}
      ghost="remédio"
    >
      <div className="stack lg">
        <div className="row wrap" style={{ gap: 8 }}>
          {on && (
            <button className="btn sm" aria-pressed={mode === 'dose'} onClick={() => setMode(mode === 'dose' ? null : 'dose')}>
              Mudou a dose ou a frequência
            </button>
          )}
          <button className="btn sm" aria-pressed={mode === 'note'} onClick={() => setMode(mode === 'note' ? null : 'note')}>
            Anotar observação
          </button>
          {on ? (
            <button className="btn ghost sm" aria-pressed={mode === 'stop'} onClick={() => setMode(mode === 'stop' ? null : 'stop')}>
              Parei de tomar
            </button>
          ) : (
            <button
              className="btn ghost sm"
              onClick={() => {
                patch({ endDate: null, stopReason: null });
                toast('Marcado como em uso.');
              }}
            >
              Voltei a tomar
            </button>
          )}
        </div>

        {mode === 'dose' && (
          <div className="card stack">
            <div className="grid-2">
              <Field label="Nova dose">
                <input className="input" value={dose.dose} maxLength={80} onChange={(e) => setDose({ ...dose, dose: e.target.value })} />
              </Field>
              <Field label="A partir de">
                <input type="date" className="input" aria-label="Data da mudança" value={dose.date} min={m.startDate} onChange={(e) => setDose({ ...dose, date: e.target.value })} />
              </Field>
            </div>
            <Field label="Frequência" optional>
              <ScheduleInput value={dose.schedule} onChange={(schedule) => setDose({ ...dose, schedule })} />
            </Field>
            <Field label="Motivo ou orientação" optional>
              <input className="input" value={dose.note} maxLength={1000} placeholder="Ex.: orientação da Dra. Helena na consulta" onChange={(e) => setDose({ ...dose, note: e.target.value })} />
            </Field>
            <button
              className="btn primary"
              disabled={!dose.dose.trim() || !dose.date}
              onClick={() => {
                const doses = [...m.doses, { date: dose.date, dose: dose.dose.trim(), schedule: dose.schedule.trim(), note: dose.note.trim() }].sort((a, b) => a.date.localeCompare(b.date));
                patch({ doses });
                setMode(null);
                toast('Mudança registrada.');
              }}
            >
              Registrar mudança
            </button>
          </div>
        )}
        {mode === 'note' && (
          <div className="card stack">
            <Field label="Observação" help="Efeitos que percebeu, dúvidas, como tem se sentido com o remédio.">
              <AutoText value={note.text} onChange={(text) => setNote({ ...note, text })} placeholder="Ex.: sono mais pesado na primeira semana" minRows={2} />
            </Field>
            <Field label="Data">
              <input type="date" className="input" aria-label="Data da observação" value={note.date} onChange={(e) => setNote({ ...note, date: e.target.value })} />
            </Field>
            <button
              className="btn primary"
              disabled={!note.text.trim()}
              onClick={() => {
                patch({ notes: [...m.notes, { date: note.date || today, text: note.text.trim() }] });
                setNote({ date: today, text: '' });
                setMode(null);
                toast('Observação anotada.');
              }}
            >
              Salvar observação
            </button>
          </div>
        )}
        {mode === 'stop' && (
          <div className="card stack">
            <Field label="Parei em">
              <input type="date" className="input" aria-label="Data em que parou" value={stop.date} min={m.startDate} onChange={(e) => setStop({ ...stop, date: e.target.value })} />
            </Field>
            <StopReasonPicker value={stop.reason} onChange={(reason) => setStop({ ...stop, reason })} />
            <p className="xs muted" style={{ margin: 0 }}>
              Se ainda não conversou com quem prescreveu, converse antes de parar: alguns medicamentos precisam de redução gradual.
            </p>
            <button
              className="btn primary"
              onClick={() => {
                patch({ endDate: stop.date || today, stopReason: stop.reason });
                setMode(null);
                toast('Registrado. Ele fica no histórico.');
              }}
            >
              Confirmar
            </button>
          </div>
        )}

        <Section title="Histórico">
          <div className="list">
            {timeline.map((t) => (
              <div key={t.key} className="list-row" style={{ alignItems: 'flex-start' }}>
                <div className="grow">
                  <div className="xs faint">
                    {fmtDate(t.date, { withYear: true })} · {t.kind}
                  </div>
                  <div className="small" style={{ whiteSpace: 'pre-wrap' }}>
                    {t.text || '—'}
                  </div>
                </div>
                {t.type === 'note' && (
                  <button className="btn ghost sm" aria-label="Excluir observação" onClick={() => patch({ notes: m.notes.filter((_, i) => i !== t.idx) })}>
                    Excluir
                  </button>
                )}
                {t.type === 'dose' && m.doses.length > 1 && (
                  <button className="btn ghost sm" aria-label="Excluir esta dose do histórico" onClick={() => patch({ doses: m.doses.filter((_, i) => i !== t.idx) })}>
                    Excluir
                  </button>
                )}
              </div>
            ))}
          </div>
        </Section>

        <details>
          <summary className="small muted">Editar nome, indicação e quem prescreveu</summary>
          <div className="stack lg" style={{ marginTop: 12 }}>
            <Field label="Nome">
              <NameInput value={m.name} onSave={(name) => patch({ name })} />
            </Field>
            <Field label="Para quê" optional>
              <input className="input" value={m.purpose} maxLength={300} onChange={(e) => patch({ purpose: e.target.value })} />
            </Field>
            <Field label="Quem prescreveu" optional>
              <input className="input" value={m.prescriber} maxLength={120} onChange={(e) => patch({ prescriber: e.target.value })} />
            </Field>
            <Field label="Início">
              <input type="date" className="input" aria-label="Data de início" value={m.startDate} onChange={(e) => e.target.value && patch({ startDate: e.target.value, doses: m.doses.map((d, i) => (i === 0 ? { ...d, date: e.target.value } : d)) })} />
            </Field>
            <button
              className="btn danger-ghost sm"
              style={{ alignSelf: 'flex-start' }}
              onClick={async () => {
                if (await ask({ title: `Excluir “${m.name}”?`, body: 'O histórico e as observações dele também serão excluídos. Se você parou de tomar, prefira “Parei de tomar” — assim ele fica no histórico.', confirm: 'Excluir', danger: true })) {
                  removeWithUndo('medications', m.id, 'Medicamento excluído.');
                  goBack('/guia?t=acompanhamento');
                }
              }}
            >
              Excluir medicamento
            </button>
          </div>
        </details>
        {m.prescriber && <p className="xs faint" style={{ margin: 0 }}>Prescrito por {m.prescriber}.{m.purpose ? ` Para: ${m.purpose}.` : ''}</p>}
        <p className="xs faint" style={{ margin: 0 }}>Nunca comece, pare ou mude a dose sem orientação de quem prescreve.</p>
      </div>
      {node}
    </Page>
  );
}

/** O nome pode ficar vazio enquanto se digita; só grava um nome não vazio (ao digitar ou ao sair do campo). */
function NameInput({ value, onSave }: { value: string; onSave: (v: string) => void }) {
  const [v, setV] = useState(value);
  return (
    <input
      className="input"
      value={v}
      maxLength={120}
      aria-label="Nome do medicamento"
      onChange={(e) => {
        setV(e.target.value);
        if (e.target.value.trim()) onSave(e.target.value.trim());
      }}
      onBlur={() => !v.trim() && setV(value)}
    />
  );
}
