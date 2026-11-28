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
import { activeMeds, currentDose, doseLabel, insertDose, fmtFuzzy, hasStopped, isActive, pastMeds, precisionOf, stopText, STOP_REASON_LABELS, periodLabel, type DatePrecision } from '../../domain/care';
import { STOP_REASONS, type Medication } from '../../domain/schema';
import { dayKey } from '../../domain/util';
import { AutoText, Field, fmtDate, Page, Section, useConfirm } from '../../ui/components';

const SCHEDULE_HINTS = ['1x ao dia, de manhã', '1x ao dia, à noite', '2x ao dia', 'se necessário'];

/** "há N dias/meses/anos" para datas exatas; datas aproximadas ou desconhecidas viram texto do período. */
function since(m: Medication, today: string) {
  const date = m.startDate;
  if (date == null || date.length < 10) return periodLabel(m, today);
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
          {m.name} · {doseLabel(d)}
        </div>
        <div className="meta">
          {on
            ? `${d.schedule || 'frequência não informada'} · ${since(m, today)}`
            : `${periodLabel(m, today)}${m.stopReason ? ` · ${STOP_REASON_LABELS[m.stopReason].toLowerCase()}` : ''}`}
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

/**
 * Data que pode ser aproximada ou desconhecida. Devolve AAAA-MM-DD, AAAA-MM, AAAA,
 * null (não me lembro) ou '' (ainda incompleta). Trocar para uma precisão menor só
 * corta o que já foi digitado; nunca completa dia ou mês por conta própria.
 */
function FuzzyDateInput({ label, value, onChange, allowUnknown = true, unknownLabel = 'Não me lembro' }: { label: string; value: string | null; onChange: (v: string | null) => void; allowUnknown?: boolean; unknownLabel?: string }) {
  const [prec, setPrec] = useState<DatePrecision>(value === '' ? 'day' : precisionOf(value));
  const opts: Array<[DatePrecision, string]> = [
    ['day', 'Data exata'],
    ['month', 'Mês e ano'],
    ['year', 'Só o ano'],
    ...(allowUnknown ? ([['unknown', unknownLabel]] as Array<[DatePrecision, string]>) : []),
  ];
  const pick = (p: DatePrecision) => {
    setPrec(p);
    if (p === 'unknown') return onChange(null);
    const len = p === 'year' ? 4 : p === 'month' ? 7 : 10;
    onChange(value && value.length >= len ? value.slice(0, len) : '');
  };
  const year = value?.slice(0, 4) ?? '';
  return (
    <div className="stack" style={{ gap: 8 }}>
      <div className="chips" role="group" aria-label={`${label}: precisão`}>
        {opts.map(([p, l]) => (
          <button key={p} className="chip" aria-pressed={prec === p} onClick={() => pick(p)}>
            {l}
          </button>
        ))}
      </div>
      {prec === 'day' && <input type="date" className="input" aria-label={label} value={value ?? ''} onChange={(e) => onChange(e.target.value)} />}
      {prec === 'month' && <input type="month" className="input" aria-label={label} value={value ?? ''} onChange={(e) => onChange(e.target.value)} />}
      {prec === 'year' && (
        <input
          className="input"
          inputMode="numeric"
          maxLength={4}
          placeholder="Ex.: 2019"
          aria-label={label}
          value={year}
          onChange={(e) => {
            const y = e.target.value.replace(/\D/g, '').slice(0, 4);
            onChange(y.length === 4 ? y : '');
          }}
        />
      )}
      {prec === 'unknown' && <p className="xs muted" style={{ margin: 0 }}>Fica registrado como desconhecido — nenhuma data é inventada.</p>}
    </div>
  );
}

/** Uma data aproximada é válida se completa no formato escolhido (ou desconhecida, quando permitido). */
const fuzzyOk = (v: string | null) => v === null || /^\d{4}(-\d{2}(-\d{2})?)?$/.test(v);
/** Compara só até a precisão comum: "2019" não é anterior a "2019-05". */
const notBefore = (end: string | null, start: string | null) => {
  if (end == null || start == null) return true;
  const n = Math.min(end.length, start.length);
  return end.slice(0, n) >= start.slice(0, n);
};

function DoseInput({ value, unknown, onChange }: { value: string; unknown: boolean; onChange: (v: { dose: string; doseUnknown: boolean }) => void }) {
  return (
    <div className="stack" style={{ gap: 8 }}>
      {!unknown && <input className="input" value={value} maxLength={80} placeholder="Ex.: 50 mg" aria-label="Dose" onChange={(e) => onChange({ dose: e.target.value, doseUnknown: false })} />}
      <div className="chips">
        <button className="chip" aria-pressed={unknown} onClick={() => onChange({ dose: unknown ? value : '', doseUnknown: !unknown })}>
          Não me lembro da dose
        </button>
      </div>
    </div>
  );
}

function StopFields({ v, set }: { v: { reason: Medication['stopReason']; note: string }; set: (p: Partial<{ reason: Medication['stopReason']; note: string }>) => void }) {
  return (
    <>
      <StopReasonPicker value={v.reason} onChange={(reason) => set({ reason })} />
      <Field label="Observações sobre a interrupção" optional help="Complementa o motivo: o que aconteceu, o que percebeu, o que foi orientado.">
        <AutoText value={v.note} onChange={(note) => set({ note })} placeholder="Ex.: sonolência excessiva durante o dia e tontura." minRows={2} />
      </Field>
    </>
  );
}

function NewMedication({ notFound }: { notFound: boolean }) {
  const today = dayKey(new Date());
  const [d, setD] = useState({
    name: '',
    dose: '',
    doseUnknown: false,
    schedule: '',
    startDate: today as string | null,
    purpose: '',
    prescriber: '',
    past: false,
    endDate: today as string | null,
    stopReason: null as Medication['stopReason'],
    stopNote: '',
  });
  const ok =
    d.name.trim() &&
    (d.doseUnknown || d.dose.trim()) &&
    d.startDate !== '' &&
    fuzzyOk(d.startDate) &&
    (!d.past || (d.endDate !== '' && fuzzyOk(d.endDate) && notBefore(d.endDate, d.startDate)));
  const save = () => {
    const created = store.upsert('medications', {
      name: d.name.trim(),
      purpose: d.purpose.trim(),
      prescriber: d.prescriber.trim(),
      startDate: d.startDate,
      endDate: d.past ? d.endDate : null,
      endUnknown: d.past && d.endDate === null,
      stopReason: d.past ? d.stopReason : null,
      stopNote: d.past ? d.stopNote.trim() : '',
      doses: [{ date: d.startDate, dose: d.doseUnknown ? '' : d.dose.trim(), doseUnknown: d.doseUnknown, schedule: d.schedule.trim(), note: '' }],
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
        <Field label="Dose">
          <DoseInput value={d.dose} unknown={d.doseUnknown} onChange={(x) => setD({ ...d, ...x })} />
        </Field>
        <Field label="Desde" help="Se não lembrar o dia, informe só o mês ou o ano — ou marque que não se lembra.">
          <FuzzyDateInput label="Data de início" value={d.startDate} onChange={(startDate) => setD({ ...d, startDate })} />
        </Field>
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
              <FuzzyDateInput label="Data em que parou" value={d.endDate} onChange={(endDate) => setD({ ...d, endDate })} />
            </Field>
            {!notBefore(d.endDate, d.startDate) && <p className="xs" style={{ margin: 0, color: 'var(--danger)' }}>A data em que parou é anterior ao início.</p>}
            <StopFields v={{ reason: d.stopReason, note: d.stopNote }} set={(p) => setD({ ...d, ...(p.reason !== undefined ? { stopReason: p.reason } : {}), ...(p.note !== undefined ? { stopNote: p.note } : {}) })} />
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
  const [dose, setDose] = useState({ date: today as string | null, dose: cur.dose, doseUnknown: cur.doseUnknown, schedule: cur.schedule, note: '' });
  const [note, setNote] = useState({ date: today, text: '' });
  const [stop, setStop] = useState({ date: today as string | null, reason: null as Medication['stopReason'], note: '' });
  const patch = (p: Partial<Medication>) => store.patch('medications', m.id, p);

  // Itens sem data ficam no fim (mais antigos que tudo), mas o fim do uso fica sempre no topo.
  const order = (t: { date: string | null; type: string }) => (t.type === 'end' ? '~' : (t.date ?? ''));
  const timeline = [
    ...m.doses.map((d, i) => ({ date: d.date, kind: i === 0 ? 'Início' : 'Nova dose', text: `${doseLabel(d)}${d.schedule ? ` · ${d.schedule}` : ''}${d.note ? ` — ${d.note}` : ''}`, key: `d${i}`, idx: i, type: 'dose' as const })),
    ...m.notes.map((n, i) => ({ date: n.date as string | null, kind: 'Observação', text: n.text, key: `n${i}`, idx: i, type: 'note' as const })),
    ...(hasStopped(m) ? [{ date: m.endDate, kind: 'Parou', text: stopText(m), key: 'end', idx: 0, type: 'end' as const }] : []),
  ].sort((a, b) => order(b).localeCompare(order(a)) || (a.type === 'end' ? -1 : 0));

  return (
    <Page
      back="/guia?t=acompanhamento"
      noNav
      kicker={on ? 'Medicamento em uso' : 'Medicamento anterior'}
      title={m.name}
      subtitle={`${doseLabel(cur)}${cur.schedule ? ` · ${cur.schedule}` : ''} · ${on ? since(m, today) : periodLabel(m, today)}`}
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
                // O que foi registrado sobre a interrupção anterior não se perde: vira uma observação.
                const prev = stopText(m);
                patch({
                  endDate: null,
                  endUnknown: false,
                  stopReason: null,
                  stopNote: '',
                  notes: prev ? [...m.notes, { date: today, text: `Interrupção anterior${m.endDate ? ` (${fmtFuzzy(m.endDate)})` : ''}: ${prev}` }] : m.notes,
                });
                toast('Marcado como em uso.');
              }}
            >
              Voltei a tomar
            </button>
          )}
        </div>

        {mode === 'dose' && (
          <div className="card stack">
            <Field label="Nova dose">
              <DoseInput value={dose.dose} unknown={dose.doseUnknown} onChange={(x) => setDose({ ...dose, ...x })} />
            </Field>
            <Field label="A partir de">
              <FuzzyDateInput label="Data da mudança" value={dose.date} onChange={(date) => setDose({ ...dose, date })} />
            </Field>
            <Field label="Frequência" optional>
              <ScheduleInput value={dose.schedule} onChange={(schedule) => setDose({ ...dose, schedule })} />
            </Field>
            <Field label="Motivo ou orientação" optional>
              <input className="input" value={dose.note} maxLength={1000} placeholder="Ex.: orientação da Dra. Helena na consulta" onChange={(e) => setDose({ ...dose, note: e.target.value })} />
            </Field>
            <button
              className="btn primary"
              disabled={(!dose.doseUnknown && !dose.dose.trim()) || dose.date === '' || !fuzzyOk(dose.date)}
              onClick={() => {
                // Sem data, a mudança entra por último (é a dose atual informada agora).
                const added = { date: dose.date, dose: dose.doseUnknown ? '' : dose.dose.trim(), doseUnknown: dose.doseUnknown, schedule: dose.schedule.trim(), note: dose.note.trim() };
                const doses = insertDose(m.doses, added);
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
              <FuzzyDateInput label="Data em que parou" value={stop.date} onChange={(date) => setStop({ ...stop, date })} />
            </Field>
            <StopFields v={stop} set={(p) => setStop({ ...stop, ...p })} />
            <p className="xs muted" style={{ margin: 0 }}>
              Se ainda não conversou com quem prescreveu, converse antes de parar: alguns medicamentos precisam de redução gradual.
            </p>
            <button
              className="btn primary"
              disabled={stop.date === '' || !fuzzyOk(stop.date) || !notBefore(stop.date, m.startDate)}
              onClick={() => {
                patch({ endDate: stop.date, endUnknown: stop.date === null, stopReason: stop.reason, stopNote: stop.note.trim() });
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
                    {fmtFuzzy(t.date)} · {t.kind}
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
          <summary className="small muted">Editar dados{hasStopped(m) ? ', interrupção' : ''} e datas</summary>
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
              <FuzzyEdit
                label="Data de início"
                value={m.startDate}
                onSave={(startDate) => patch({ startDate, doses: m.doses.map((d, i) => (i === 0 && d.date === m.startDate ? { ...d, date: startDate } : d)) })}
              />
            </Field>
            {hasStopped(m) && (
              <>
                <Field label="Parou em">
                  <FuzzyEdit label="Data em que parou" value={m.endDate} onSave={(endDate) => patch({ endDate, endUnknown: endDate === null })} />
                </Field>
                <StopFields v={{ reason: m.stopReason, note: m.stopNote }} set={(p) => patch({ ...(p.reason !== undefined ? { stopReason: p.reason } : {}), ...(p.note !== undefined ? { stopNote: p.note } : {}) })} />
              </>
            )}
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

/** Edição imediata de uma data aproximada: só grava quando a data estiver completa (ou desconhecida). */
function FuzzyEdit({ label, value, onSave }: { label: string; value: string | null; onSave: (v: string | null) => void }) {
  const [v, setV] = useState<string | null>(value);
  return (
    <FuzzyDateInput
      label={label}
      value={v}
      onChange={(x) => {
        setV(x);
        if (x !== '' && fuzzyOk(x)) onSave(x);
      }}
    />
  );
}

