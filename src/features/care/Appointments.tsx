/**
 * Consultas: agendar (com lembrete local opcional), preparar e registrar o que ficou.
 *
 * Por que estes campos (e não mais): o preparo segue o que costuma faltar numa
 * consulta curta — como você esteve, o que quer falar, o que quer perguntar e o que
 * precisa pedir (receita, atestado…). Depois, o que foi observado e o que foi
 * combinado: na psicoterapia, retomar as tarefas combinadas entre sessões faz parte
 * do tratamento. Tudo opcional; são as SUAS anotações, não um prontuário.
 */
import { useEffect, useMemo, useState } from 'react';
import { Bell, BellOff, CalendarPlus, Check, ChevronRight, FileText, Pill, Plus } from 'lucide-react';
import { goBack, navigate, useRoute } from '../../app/router';
import { store, useData, useStoreState } from '../../app/store';
import { useSystemDark } from '../../app/theme';
import { toast } from '../../app/toast';
import { removeWithUndo } from '../../app/undo';
import { periodPreset } from '../../domain/analytics';
import { agendaFor, apptTime, apptTitle, lastDone, lastGender, past, REMINDER_OPTIONS, whoWithArticle, reminderTime, REQUEST_LABELS, sinceSummary, upcoming } from '../../domain/care';
import { REQUESTS, type Appointment } from '../../domain/schema';
import { fmtHours } from '../../domain/sleep';
import { dayKey } from '../../domain/util';
import { fmtIndex } from '../../domain/valence';
import { clearExportCache, deliverFile } from '../../platform/native';
import { cancelReminder, notificationPermission, syncReminder } from '../../platform/reminders';
import { CONSULT_SECTIONS } from '../../report/sections';
import { useTrajPeriod } from '../../app/filters';
import { AgendaItemRow } from './AgendaItemRow';
import { Trash2 } from 'lucide-react';
import { resolveTokens } from '../../theme/resolve';
import { AutoText, Field, fmtDate, Page, Section, Segmented, Toggle, useConfirm } from '../../ui/components';

const WEEKDAY = ['dom', 'seg', 'ter', 'qua', 'qui', 'sex', 'sáb'];
export function apptLabel(a: Pick<Appointment, 'date' | 'time'>) {
  const d = new Date(a.date + 'T12:00:00');
  return `${WEEKDAY[d.getDay()]}, ${fmtDate(a.date, { short: true })}${a.time ? ` · ${a.time}` : ''}`;
}
function relative(a: Appointment, today: string) {
  const days = Math.round((new Date(a.date + 'T12:00:00').getTime() - new Date(today + 'T12:00:00').getTime()) / 86400000);
  return days === 0 ? 'hoje' : days === 1 ? 'amanhã' : days > 1 ? `em ${days} dias` : `há ${-days} dia(s)`;
}

/* ------------------------------------------------------------------------ */
/* Seção na aba Consultas                                                    */
/* ------------------------------------------------------------------------ */
export function AppointmentsSection() {
  const data = useData();
  const today = dayKey(new Date());
  const up = upcoming(data.appointments);
  const prev = past(data.appointments);
  const [showPast, setShowPast] = useState(false);
  const next = up[0];
  return (
    <Section title="Consultas" kicker="Agendar, preparar e anotar o que ficou" action={<button className="btn ghost sm" onClick={() => navigate('/guia/consulta/nova')}><CalendarPlus size={15} /> Agendar</button>}>
      {next ? (
        <button className="card row" onClick={() => navigate(`/guia/consulta/${next.id}`)} style={{ borderLeft: '3px solid var(--primary-ink)' }}>
          <div className="grow">
            <p className="kicker" style={{ margin: 0 }}>
              Próxima · {relative(next, today)}
            </p>
            <div className="h3">{apptTitle(next)}</div>
            <div className="small muted">
              {apptLabel(next)}
              {next.place ? ` · ${next.place}` : ''}
            </div>
            <div className="xs faint" style={{ marginTop: 4 }}>
              {[
                next.reminderMinutes != null ? 'com lembrete' : null,
                agendaFor(data.agenda, next).length ? `${agendaFor(data.agenda, next).length} assunto(s) na pauta` : null,
                next.questions.trim() ? 'perguntas anotadas' : null,
                next.requests.length ? `${next.requests.length} pedido(s)` : null,
              ]
                .filter(Boolean)
                .join(' · ') || 'Toque para preparar'}
            </div>
          </div>
          {next.reminderMinutes != null ? <Bell size={18} className="faint" /> : null}
          <ChevronRight className="chev" size={18} />
        </button>
      ) : (
        <button className="card dashed row" onClick={() => navigate('/guia/consulta/nova')}>
          <span className="ico-tile" aria-hidden>
            <CalendarPlus size={18} strokeWidth={1.8} />
          </span>
          <div className="grow">
            <div className="h3">Agendar a próxima consulta</div>
            <div className="small muted">Data, horário, lembrete opcional e um espaço para se preparar.</div>
          </div>
        </button>
      )}
      {up.length > 1 && (
        <div className="list" style={{ marginTop: 8 }}>
          {up.slice(1).map((a) => (
            <ApptRow key={a.id} a={a} today={today} />
          ))}
        </div>
      )}
      {prev.length > 0 && (
        <button className="btn ghost sm" style={{ marginTop: 6 }} onClick={() => setShowPast(!showPast)} aria-expanded={showPast}>
          {showPast ? 'Ocultar' : 'Ver'} consultas anteriores ({prev.length})
        </button>
      )}
      {showPast && (
        <div className="list" style={{ marginTop: 6 }}>
          {prev.map((a) => (
            <ApptRow key={a.id} a={a} today={today} />
          ))}
        </div>
      )}
    </Section>
  );
}

function ApptRow({ a, today }: { a: Appointment; today: string }) {
  const status = a.status === 'done' ? 'realizada' : a.status === 'canceled' ? 'cancelada' : a.date < today ? 'não marcada como realizada' : relative(a, today);
  return (
    <button className="list-row" onClick={() => navigate(`/guia/consulta/${a.id}`)}>
      <div className="grow">
        <div className="title" style={{ textDecoration: a.status === 'canceled' ? 'line-through' : undefined }}>
          {apptTitle(a)}
        </div>
        <div className="meta">
          {apptLabel(a)} · {status}
        </div>
      </div>
      <ChevronRight className="chev" size={18} />
    </button>
  );
}

/* ------------------------------------------------------------------------ */
/* Página da consulta                                                        */
/* ------------------------------------------------------------------------ */
export function AppointmentPage() {
  // PDFs gerados aqui não ficam no cache depois que você sai da tela.
  useEffect(() => () => void clearExportCache(), []);
  const route = useRoute();
  const id = route.parts[2];
  const data = useData();
  const a = id && id !== 'nova' ? data.appointments.find((x) => x.id === id) : undefined;
  if (id === 'nova' || !a) return <NewAppointment notFound={id !== 'nova'} />;
  return <AppointmentDetail a={a} />;
}

function NewAppointment({ notFound }: { notFound: boolean }) {
  const data = useData();
  const route = useRoute();
  const last = [...data.appointments].sort((x, y) => y.date.localeCompare(x.date))[0];
  const tipo = (route.query.get('tipo') as Appointment['forWhom']) ?? last?.forWhom ?? 'psiquiatria';
  const g = route.query.get('genero');
  const [d, setD] = useState({
    date: route.query.get('data') ?? '',
    time: '',
    forWhom: tipo,
    professionalGender: (g === 'f' || g === 'm' ? g : (lastGender(data.appointments, tipo) ?? null)) as Appointment['professionalGender'],
    professional: route.query.get('prof') ?? (last && last.forWhom === tipo ? last.professional : ''),
    place: route.query.get('local') ?? '',
  });
  const save = () => {
    const created = store.upsert('appointments', { ...d, time: d.time || null });
    navigate(`/guia/consulta/${created.id}`, { replace: true });
  };
  return (
    <Page back="/guia?t=acompanhamento" noNav kicker="Consultas" title={notFound ? 'Consulta não encontrada' : 'Agendar consulta'} ghost="agenda">
      <div className="stack lg">
        <ApptFields value={d} onChange={(p) => setD({ ...d, ...p })} />
        <button className="btn primary block" disabled={!d.date} onClick={save}>
          Agendar
        </button>
        <p className="xs faint" style={{ margin: 0 }}>
          Depois de agendar, você pode ativar um lembrete e preparar a consulta. Fica só neste aparelho.
        </p>
      </div>
    </Page>
  );
}

function ApptFields({
  value,
  onChange,
}: {
  value: { date: string; time: string; forWhom: Appointment['forWhom']; professionalGender: Appointment['professionalGender']; professional: string; place: string };
  onChange: (p: Partial<{ date: string; time: string; forWhom: Appointment['forWhom']; professionalGender: Appointment['professionalGender']; professional: string; place: string }>) => void;
}) {
  const opts: Array<{ forWhom: Appointment['forWhom']; g: Appointment['professionalGender']; label: string }> = [
    { forWhom: 'psiquiatria', g: null, label: 'Psiquiatra' },
    { forWhom: 'psicologia', g: 'f', label: 'Psicóloga' },
    { forWhom: 'psicologia', g: 'm', label: 'Psicólogo' },
    { forWhom: 'outro', g: null, label: 'Outro profissional' },
  ];
  return (
    <>
      <Field label="Com quem" help={value.forWhom === 'psicologia' && !value.professionalGender ? 'Escolha “Psicóloga” ou “Psicólogo” para o app usar o nome certo.' : undefined}>
        <div className="chips" role="group" aria-label="Com quem">
          {opts.map((o) => (
            <button
              key={o.label}
              className="chip"
              aria-pressed={value.forWhom === o.forWhom && (o.forWhom !== 'psicologia' || value.professionalGender === o.g)}
              onClick={() => onChange({ forWhom: o.forWhom, professionalGender: o.forWhom === 'psicologia' ? o.g : value.forWhom === o.forWhom ? value.professionalGender : null })}
            >
              {o.label}
            </button>
          ))}
        </div>
      </Field>
      <div className="grid-2">
        <Field label="Data">
          <input type="date" className="input" aria-label="Data da consulta" value={value.date} onChange={(e) => onChange({ date: e.target.value })} />
        </Field>
        <Field label="Horário" optional>
          <input type="time" className="input" aria-label="Horário da consulta" value={value.time} onChange={(e) => onChange({ time: e.target.value })} />
        </Field>
      </div>
      <Field label="Profissional" optional>
        <input className="input" value={value.professional} maxLength={120} placeholder="Ex.: Dra. Helena" onChange={(e) => onChange({ professional: e.target.value })} />
      </Field>
      <Field label="Local" optional>
        <input className="input" value={value.place} maxLength={200} placeholder="Ex.: consultório, online" onChange={(e) => onChange({ place: e.target.value })} />
      </Field>
    </>
  );
}

function AppointmentDetail({ a }: { a: Appointment }) {
  const st = useStoreState();
  const data = st.data;
  const systemDark = useSystemDark();
  const today = dayKey(new Date());
  const { ask, node } = useConfirm();
  const [tab, setTab] = useState<'antes' | 'depois'>(a.status === 'done' ? 'depois' : 'antes');
  const [perm, setPerm] = useState<string | null>(null);
  const [nextAt, setNextAt] = useState<Date | null>(null);
  const patch = (p: Partial<Appointment>) => store.patch('appointments', a.id, p);
  const prev = lastDone(data.appointments, a.date, a.forWhom);
  const defaultFrom = prev?.date ?? dayKey(periodPreset('30d').from);
  const [fromSel, setFromSel] = useState<string | null>(null);
  const from = fromSel ?? defaultFrom;
  const to = a.status === 'done' ? a.date : today < a.date ? today : a.date;
  const sum = useMemo(() => sinceSummary(data, from, to), [data, from, to]);
  const [, setTrajPeriod] = useTrajPeriod();
  // Pauta desta consulta: os em aberto do mesmo tipo + os já conversados NESTA consulta (riscados).
  const open = agendaFor(data.agenda, a);
  const pauta = [...open, ...data.agenda.filter((x) => x.appointmentId === a.id && x.doneAt && !open.includes(x))];
  const [newTopic, setNewTopic] = useState('');

  // O lembrete acompanha data, horário, antecedência, status e o texto.
  useEffect(() => {
    let alive = true;
    void syncReminder(a).then((at) => alive && setNextAt(at));
    return () => {
      alive = false;
    };
  }, [a.date, a.time, a.reminderMinutes, a.status, a.reminderShowsType, a.forWhom, a.professional]); // eslint-disable-line react-hooks/exhaustive-deps

  const setReminder = async (minutes: number | null) => {
    if (minutes != null) {
      const p = await notificationPermission(true);
      setPerm(p);
      if (p === 'denied') toast('Sem permissão de notificações: ative nas configurações do Android para receber o lembrete.', 5000);
    }
    patch({ reminderMinutes: minutes });
  };

  const markDone = async () => {
    patch({ status: 'done' });
    setTab('depois');
    if (open.length) toast(`Marque na pauta o que foi conversado (${open.length} assunto(s)).`, 4000);
  };

  const report = async () => {
    try {
      const { buildReport } = await import('../../report/pdf');
      const period = { from: new Date(from + 'T00:00:00'), to: new Date(to + 'T23:59:59.999') };
      const bytes = buildReport(data, period, CONSULT_SECTIONS, resolveTokens({ ...data.preferences, appearance: 'light' }, systemDark), {
        title: `Resumo para a consulta de ${apptLabel(a)}`,
        appointment: a,
      });
      await deliverFile(`palimpsesto-consulta-${a.date}.pdf`, bytes, 'application/pdf');
    } catch (e: any) {
      toast(`Não foi possível gerar o resumo: ${e?.message ?? e}`, 5000);
    }
  };

  const rem = reminderTime(a);
  return (
    <Page
      back="/guia?t=acompanhamento"
      noNav
      kicker={`Consulta · ${a.status === 'done' ? 'realizada' : a.status === 'canceled' ? 'cancelada' : relative(a, today)}`}
      title={apptTitle(a)}
      subtitle={`${apptLabel(a)}${a.place ? ` · ${a.place}` : ''}`}
      ghost="consulta"
      actions={
        <button
          className="icon-btn"
          aria-label="Excluir consulta"
          onClick={async () => {
            if (await ask({ title: 'Excluir esta consulta?', body: 'As anotações dela também serão excluídas (dá para desfazer logo em seguida). Os assuntos da pauta continuam.', confirm: 'Excluir', danger: true })) {
              // Exclui primeiro; o lembrete é cancelado em segundo plano (no Android, o plugin
              // de notificações não pode atrasar nem impedir a exclusão).
              removeWithUndo('appointments', a.id, 'Consulta excluída.');
              void cancelReminder(a.id);
              goBack('/guia?t=acompanhamento');
            }
          }}
        >
          <Trash2 size={19} />
        </button>
      }
    >
      <div className="stack lg">
        {/* Status */}
        <div className="row wrap" style={{ gap: 8 }}>
          {a.status !== 'done' && (
            <button className="btn primary sm" onClick={markDone}>
              <Check size={15} /> Marcar como realizada
            </button>
          )}
          {a.status === 'scheduled' && (
            <button className="btn ghost sm" onClick={() => patch({ status: 'canceled' })}>
              Cancelada
            </button>
          )}
          {a.status !== 'scheduled' && (
            <button className="btn ghost sm" onClick={() => patch({ status: 'scheduled' })}>
              Voltar para agendada
            </button>
          )}
        </div>

        {/* Lembrete */}
        {a.status === 'scheduled' && (
          <div className="card stack">
            <div className="row" style={{ gap: 8 }}>
              {a.reminderMinutes != null ? <Bell size={18} /> : <BellOff size={18} className="faint" />}
              <strong className="grow">Lembrete</strong>
            </div>
            <div className="chips" role="group" aria-label="Lembrete">
              <button className="chip" aria-pressed={a.reminderMinutes == null} onClick={() => setReminder(null)}>
                Sem lembrete
              </button>
              {REMINDER_OPTIONS.map((o) => (
                <button key={o.minutes} className="chip" aria-pressed={a.reminderMinutes === o.minutes} onClick={() => setReminder(o.minutes)}>
                  {o.label}
                </button>
              ))}
            </div>
            {a.reminderMinutes != null && (
              <>
                <p className="xs muted" style={{ margin: 0 }}>
                  {rem && rem > new Date()
                    ? `Vai tocar ${fmtDate(dayKey(rem), { short: true })} às ${String(rem.getHours()).padStart(2, '0')}:${String(rem.getMinutes()).padStart(2, '0')}${a.time ? '' : ' (sem horário marcado: avisa às 8h)'}.`
                    : 'Esse horário já passou — escolha outra antecedência ou atualize a data.'}
                  {perm === 'unsupported' || (perm === null && nextAt === null && rem && rem > new Date()) ? ' No navegador, o lembrete só funciona no aplicativo instalado.' : ''}
                </p>
                <Toggle
                  label="Mostrar na notificação que é uma consulta"
                  help="Desligado, aparece só “Você tem um compromisso às …” — mais discreto na tela de bloqueio."
                  checked={a.reminderShowsType}
                  onChange={(reminderShowsType) => patch({ reminderShowsType })}
                />
              </>
            )}
          </div>
        )}

        <Segmented
          ariaLabel="Momento da consulta"
          value={tab}
          onChange={setTab}
          options={[
            { value: 'antes', label: 'Antes' },
            { value: 'depois', label: 'Depois' },
          ]}
        />

        {tab === 'antes' ? (
          <>
            {prev && (prev.agreements.trim() || prev.observations.trim()) && (
              <div className="card tight small" style={{ borderLeft: '3px solid var(--comp1-ink)' }}>
                <strong>Da última consulta ({fmtDate(prev.date, { short: true })})</strong>
                {prev.agreements.trim() && <p style={{ margin: '4px 0 0', whiteSpace: 'pre-wrap' }}>Combinados: {prev.agreements}</p>}
                {prev.observations.trim() && <p className="muted" style={{ margin: '4px 0 0', whiteSpace: 'pre-wrap' }}>Observado: {prev.observations}</p>}
              </div>
            )}
            <div className="card tight soft small stack" style={{ gap: 8 }}>
              <div className="row wrap" style={{ gap: 6 }}>
                <span>Período:</span>
                <input type="date" className="input" style={{ width: 160, minHeight: 32, padding: '2px 8px' }} aria-label="Início do período" value={from} max={to} onChange={(e) => e.target.value && setFromSel(e.target.value)} />
                <span>a {fmtDate(to, { short: true })}</span>
                {fromSel && fromSel !== defaultFrom && (
                  <button className="btn ghost sm" onClick={() => setFromSel(null)}>
                    {prev ? 'desde a última consulta' : 'últimos 30 dias'}
                  </button>
                )}
              </div>
              <div>
              <strong>
                {fromSel ? 'No período escolhido' : prev ? `Desde a última consulta (${fmtDate(prev.date, { short: true })})` : 'Nos últimos 30 dias'}
                {to < a.date ? ' até hoje' : ''}:
              </strong>{' '}
              {sum.records ? `${sum.records} registro(s) de humor em ${sum.dates} data(s), índice ${fmtIndex(sum.index)}` : 'nenhum registro de humor'}
              {sum.nights ? ` · sono: ${sum.nights} noite(s), mediana ${fmtHours(sum.sleepMedian)}` : ''}
              {sum.phq9 ? ` · PHQ-9 ${sum.phq9.score}` : ''}
              {sum.gad7 ? ` · GAD-7 ${sum.gad7.score}` : ''}
              {sum.medChanges ? ` · ${sum.medChanges} mudança(s) de medicação` : ''}
              {sum.events ? ` · ${sum.events} acontecimento(s)` : ''}.
              </div>
              <button
                className="btn ghost sm"
                style={{ alignSelf: 'flex-start', paddingLeft: 0 }}
                onClick={() => {
                  setTrajPeriod({ kind: 'custom', from, to, compare: false });
                  navigate('/trajetoria');
                }}
              >
                Ver este período na Trajetória
              </button>
            </div>
            <Field label="Como estive desde a última consulta" optional help="Em poucas linhas, nas suas palavras. Os números acima ajudam a lembrar.">
              <AutoText value={a.sinceLast} onChange={(sinceLast) => patch({ sinceLast })} placeholder="Ex.: semana boa até quinta; depois voltou a insônia…" minRows={3} />
            </Field>
            <Field label="Assuntos que quero levar" optional help={`Da pauta geral, os que valem para ${whoWithArticle(a.forWhom, a.professionalGender)}.`}>
              <div className="stack" style={{ gap: 6 }}>
                {pauta.length > 0 && (
                  <div className="list">
                    {pauta.map((x) => (
                      <AgendaItemRow key={x.id} a={x} appointment={a} />
                    ))}
                  </div>
                )}
                {!pauta.length && <span className="small faint">Nenhum assunto em aberto.</span>}
                <div className="row" style={{ gap: 6 }}>
                  <input className="input grow" value={newTopic} placeholder="Novo assunto…" onChange={(e) => setNewTopic(e.target.value)} />
                  <button
                    className="btn sm"
                    disabled={!newTopic.trim()}
                    onClick={() => {
                      store.upsert('agenda', { text: newTopic.trim(), forWhom: a.forWhom === 'outro' ? 'outro' : a.forWhom });
                      setNewTopic('');
                    }}
                  >
                    <Plus size={15} /> Adicionar
                  </button>
                </div>
              </div>
            </Field>
            <Field label="Perguntas que quero fazer" optional>
              <AutoText value={a.questions} onChange={(questions) => patch({ questions })} placeholder="Ex.: esse efeito colateral passa? Quanto tempo até fazer efeito?" minRows={2} />
            </Field>
            <Field label="Preciso pedir" optional>
              <div className="chips" role="group" aria-label="Pedidos">
                {REQUESTS.map((r) => {
                  const on = a.requests.includes(r);
                  return (
                    <button key={r} className="chip" aria-pressed={on} onClick={() => patch({ requests: on ? a.requests.filter((x) => x !== r) : [...a.requests, r] })}>
                      {REQUEST_LABELS[r]}
                    </button>
                  );
                })}
              </div>
            </Field>
            {data.medications.length > 0 && a.forWhom === 'psiquiatria' && (
              <button className="card row" onClick={() => navigate('/guia?t=acompanhamento')}>
                <Pill size={18} />
                <span className="grow small">Revisar meus medicamentos antes da consulta</span>
                <ChevronRight className="chev" size={18} />
              </button>
            )}
            <button className="btn" onClick={report}>
              <FileText size={16} /> Resumo em PDF para esta consulta
            </button>
          </>
        ) : (
          <>
            <Field label="O que foi observado ou dito" optional help="Nas suas palavras: o que o(a) profissional percebeu, explicou ou sugeriu. São as suas anotações, não um prontuário.">
              <AutoText value={a.observations} onChange={(observations) => patch({ observations })} placeholder="Ex.: ela notou que a ansiedade aparece mais nos domingos…" minRows={3} />
            </Field>
            <Field label="Combinados até a próxima" optional help="Tarefas, exercícios, mudanças de rotina — retomá-los na próxima sessão faz parte do tratamento.">
              <AutoText value={a.agreements} onChange={(agreements) => patch({ agreements })} placeholder="Ex.: registrar os pensamentos antes de dormir; caminhar 3x na semana" minRows={3} />
            </Field>
            {pauta.length > 0 && (
              <Field label="Da pauta, o que foi conversado?" optional help="Marcados ficam riscados, com o que ficou acertado.">
                <div className="list">
                  {pauta.map((x) => (
                    <AgendaItemRow key={x.id} a={x} appointment={a} />
                  ))}
                </div>
              </Field>
            )}
            <div className="row wrap" style={{ gap: 8 }}>
              {a.forWhom === 'psiquiatria' && (
                <button className="btn sm" onClick={() => navigate('/guia/remedio/novo')}>
                  <Pill size={15} /> Registrar mudança de medicação
                </button>
              )}
              <button
                className="btn sm"
                onClick={() => navigate(`/guia/consulta/nova?tipo=${a.forWhom}${a.professionalGender ? `&genero=${a.professionalGender}` : ''}&prof=${encodeURIComponent(a.professional)}&local=${encodeURIComponent(a.place)}`)}
              >
                <CalendarPlus size={15} /> Agendar a próxima
              </button>
            </div>
          </>
        )}

        <details>
          <summary className="small muted">Editar data, horário e profissional</summary>
          <div className="stack lg" style={{ marginTop: 12 }}>
            <ApptFields
              value={{ date: a.date, time: a.time ?? '', forWhom: a.forWhom, professionalGender: a.professionalGender, professional: a.professional, place: a.place }}
              onChange={(p) => {
                if (p.date !== undefined && !p.date) return; // a consulta precisa de uma data
                patch({ ...p, ...(p.time !== undefined ? { time: p.time || null } : {}) });
              }}
            />
            <button
              className="btn danger-ghost sm"
              style={{ alignSelf: 'flex-start' }}
              onClick={async () => {
                if (await ask({ title: 'Excluir esta consulta?', body: 'As anotações dela também serão excluídas (dá para desfazer logo em seguida).', confirm: 'Excluir', danger: true })) {
                  removeWithUndo('appointments', a.id, 'Consulta excluída.');
                  void cancelReminder(a.id);
                  goBack('/guia?t=acompanhamento');
                }
              }}
            >
              Excluir consulta
            </button>
          </div>
        </details>
        <p className="xs faint" style={{ margin: 0 }}>
          Criada em {fmtDate(a.createdAt, { withYear: true })}. {apptTime(a) < new Date() && a.status === 'scheduled' ? 'A data já passou: marque como realizada ou cancelada.' : ''}
        </p>
      </div>
      {node}
    </Page>
  );
}
