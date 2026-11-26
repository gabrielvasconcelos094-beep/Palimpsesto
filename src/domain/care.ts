/**
 * Consultas e medicamentos: regras puras (sem interface), para testar à parte.
 */
import { history, score } from './assessments';
import type { AgendaItem, AppData, Appointment, Medication } from './schema';
import { sleepSummary } from './sleep';
import { valenceIndex } from './valence';

export const PROFESSION_LABELS: Record<Appointment['forWhom'], string> = { psiquiatria: 'Psiquiatria', psicologia: 'Psicologia', outro: 'Outro profissional' };
export const REQUEST_LABELS: Record<Appointment['requests'][number], string> = {
  receita: 'Receita',
  atestado: 'Atestado ou declaração',
  exames: 'Pedido de exames',
  relatorio: 'Relatório ou laudo',
  outro: 'Outro pedido',
};
export const STOP_REASON_LABELS: Record<NonNullable<Medication['stopReason']>, string> = {
  efeitos: 'Efeitos colaterais',
  sem_efeito: 'Não fez o efeito esperado',
  melhora: 'Melhora / fim do tratamento',
  troca: 'Troca por outro',
  custo: 'Custo ou acesso',
  outro: 'Outro motivo',
};
export const REMINDER_OPTIONS: Array<{ minutes: number; label: string }> = [
  { minutes: 30, label: '30 min antes' },
  { minutes: 60, label: '1 h antes' },
  { minutes: 120, label: '2 h antes' },
  { minutes: 1440, label: '1 dia antes' },
];

/** Momento da consulta (hora local). Sem horário: meio-dia, só para ordenar. */
export function apptTime(a: Pick<Appointment, 'date' | 'time'>): Date {
  return new Date(`${a.date}T${a.time ?? '12:00'}:00`);
}

/** Quando o lembrete deve tocar. Sem horário marcado, avisa às 8h do dia (menos a antecedência, se for de 1 dia). */
export function reminderTime(a: Pick<Appointment, 'date' | 'time' | 'reminderMinutes'>): Date | null {
  if (a.reminderMinutes == null) return null;
  const base = new Date(`${a.date}T${a.time ?? '08:00'}:00`);
  const mins = a.time ? a.reminderMinutes : a.reminderMinutes >= 1440 ? a.reminderMinutes : 0;
  return new Date(base.getTime() - mins * 60000);
}

export function reminderText(a: Pick<Appointment, 'time' | 'forWhom' | 'professional' | 'reminderShowsType'>) {
  const when = a.time ? `às ${a.time}` : 'hoje';
  if (!a.reminderShowsType) return { title: 'Lembrete', body: `Você tem um compromisso ${when}.` };
  const who = a.forWhom === 'outro' ? 'Consulta' : `Consulta de ${PROFESSION_LABELS[a.forWhom].toLowerCase()}`;
  return { title: 'Lembrete de consulta', body: `${who} ${when}${a.professional ? ` com ${a.professional}` : ''}.` };
}

export function upcoming(list: Appointment[], now = new Date()): Appointment[] {
  // Agendadas de hoje em diante (a de hoje continua aqui até ser marcada como realizada).
  const today = localDay(now);
  return list
    .filter((a) => a.status === 'scheduled' && a.date >= today)
    .sort((a, b) => apptTime(a).getTime() - apptTime(b).getTime());
}

export function past(list: Appointment[], now = new Date()): Appointment[] {
  const up = new Set(upcoming(list, now).map((a) => a.id));
  return list.filter((a) => !up.has(a.id)).sort((a, b) => apptTime(b).getTime() - apptTime(a).getTime());
}

/** Última consulta realizada antes de `before`, do mesmo tipo (ou de qualquer tipo). */
export function lastDone(list: Appointment[], before: string, forWhom?: Appointment['forWhom']): Appointment | undefined {
  return list
    .filter((a) => a.status === 'done' && a.date < before && (!forWhom || a.forWhom === forWhom))
    .sort((a, b) => b.date.localeCompare(a.date))[0];
}

/** Assuntos em aberto que valem para esta consulta ("ambos" vale para psiquiatria e psicologia). */
export function agendaFor(agenda: AgendaItem[], a: Pick<Appointment, 'forWhom'>): AgendaItem[] {
  return agenda
    .filter((x) => !x.doneAt && (x.forWhom === a.forWhom || (x.forWhom === 'ambos' && a.forWhom !== 'outro')))
    .sort((x, y) => x.createdAt.localeCompare(y.createdAt));
}

export const currentDose = (m: Medication) => m.doses[m.doses.length - 1];
export const isActive = (m: Medication, today: string) => m.startDate <= today && (!m.endDate || m.endDate > today);

export function activeMeds(list: Medication[], today: string) {
  return list.filter((m) => isActive(m, today)).sort((a, b) => a.name.localeCompare(b.name, 'pt-BR'));
}
export function pastMeds(list: Medication[], today: string) {
  return list.filter((m) => !isActive(m, today)).sort((a, b) => (b.endDate ?? b.startDate).localeCompare(a.endDate ?? a.startDate));
}

/** Mudanças de medicação num intervalo (início, mudança de dose, suspensão), em ordem. */
export function medChanges(list: Medication[], from: string, to: string) {
  const out: Array<{ date: string; med: Medication; kind: 'start' | 'dose' | 'stop'; text: string }> = [];
  for (const m of list) {
    m.doses.forEach((d, i) => {
      if (d.date < from || d.date > to) return;
      out.push({ date: d.date, med: m, kind: i === 0 ? 'start' : 'dose', text: `${d.dose}${d.schedule ? ` — ${d.schedule}` : ''}${d.note ? ` (${d.note})` : ''}` });
    });
    if (m.endDate && m.endDate >= from && m.endDate <= to) out.push({ date: m.endDate, med: m, kind: 'stop', text: m.stopReason ? STOP_REASON_LABELS[m.stopReason] : '' });
  }
  return out.sort((a, b) => a.date.localeCompare(b.date));
}

/** Um resumo do período desde a última consulta, para o preparo. */
export function sinceSummary(data: AppData, from: string, to: string) {
  const entries = data.moodEntries.filter((m) => m.at.slice(0, 10) >= from && m.at.slice(0, 10) <= to);
  const idx = valenceIndex(entries);
  const sleep = sleepSummary(
    data.sleepLogs.filter((s) => s.date >= from && s.date <= to),
    entries,
  );
  const last = (ins: 'phq9' | 'gad7') => history(data.assessments, ins).filter((a) => a.date >= from && a.date <= to).pop();
  const phq = last('phq9');
  const gad = last('gad7');
  return {
    records: idx.records,
    dates: idx.dates,
    index: idx.index,
    sleepMedian: sleep.median,
    nights: sleep.logged,
    phq9: phq ? { score: score(phq), date: phq.date } : null,
    gad7: gad ? { score: score(gad), date: gad.date } : null,
    events: data.events.filter((e) => (e.endDate ?? e.date) >= from && e.date <= to).length,
    medChanges: medChanges(data.medications, from, to).length,
  };
}

function localDay(d: Date) {
  return `${d.getFullYear()}-${String(d.getMonth() + 1).padStart(2, '0')}-${String(d.getDate()).padStart(2, '0')}`;
}
