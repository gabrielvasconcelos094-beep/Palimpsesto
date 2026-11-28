import { describe, expect, it } from 'vitest';
import { activeMeds, agendaFor, currentDose, lastDone, medChanges, past, pastMeds, reminderText, reminderTime, sinceSummary, upcoming } from '../src/domain/care';
import { AppDataSchema } from '../src/domain/schema';
import { notificationId, syncReminder } from '../src/platform/reminders';

const A = (o: any) => ({ id: o.id ?? Math.random().toString(36), createdAt: '2026-11-01T00:00:00Z', updatedAt: '2026-11-01T00:00:00Z', time: null, forWhom: 'psiquiatria', professional: '', place: '', status: 'scheduled', reminderMinutes: null, reminderShowsType: false, sinceLast: '', questions: '', requests: [], observations: '', agreements: '', ...o }) as any;
const MED = (o: any) => ({ id: o.name, createdAt: '2026-11-01T00:00:00Z', updatedAt: '2026-11-01T00:00:00Z', purpose: '', prescriber: '', endDate: null, stopReason: null, notes: [], ...o }) as any;

describe('consultas', () => {
  it('lembrete: antecedência a partir do horário; sem horário, às 8h (ou 1 dia antes às 8h)', () => {
    expect(reminderTime(A({ date: '2026-12-10', time: '14:30', reminderMinutes: 60 }))!.getHours()).toBe(13);
    const dayBefore = reminderTime(A({ date: '2026-12-10', time: '09:00', reminderMinutes: 1440 }))!;
    expect([dayBefore.getDate(), dayBefore.getHours()]).toEqual([9, 9]);
    expect(reminderTime(A({ date: '2026-12-10', reminderMinutes: 60 }))!.getHours()).toBe(8);
    expect(reminderTime(A({ date: '2026-12-10', reminderMinutes: 1440 }))!.getDate()).toBe(9);
    expect(reminderTime(A({ date: '2026-12-10', time: '14:30' }))).toBeNull();
  });
  it('texto da notificação é neutro por padrão (privacidade na tela de bloqueio)', () => {
    expect(reminderText(A({ time: '14:30', professional: 'Dra. Helena' }))).toEqual({ title: 'Lembrete', body: 'Você tem um compromisso às 14:30.' });
    expect(reminderText(A({ time: '14:30', professional: 'Dra. Helena', reminderShowsType: true })).body).toBe('Consulta de psiquiatria às 14:30 com Dra. Helena.');
  });
  it('próximas (inclui hoje até marcar como realizada) e anteriores', () => {
    const now = new Date('2026-11-20T15:00:00');
    const list = [A({ id: 'a', date: '2026-11-20', time: '10:00' }), A({ id: 'b', date: '2026-12-01' }), A({ id: 'c', date: '2026-11-10', status: 'done' }), A({ id: 'd', date: '2026-11-25', status: 'canceled' }), A({ id: 'e', date: '2026-11-15' })];
    expect(upcoming(list, now).map((x) => x.id)).toEqual(['a', 'b']);
    expect(past(list, now).map((x) => x.id)).toEqual(['d', 'e', 'c']);
  });
  it('última consulta realizada do mesmo tipo', () => {
    const list = [A({ date: '2026-10-01', status: 'done', forWhom: 'psicologia' }), A({ id: 'x', date: '2026-10-20', status: 'done' }), A({ date: '2026-11-01', status: 'canceled' })];
    expect(lastDone(list, '2026-11-15', 'psiquiatria')!.id).toBe('x');
    expect(lastDone(list, '2026-10-10', 'psiquiatria')).toBeUndefined();
  });
  it('pauta da consulta: do mesmo tipo e "ambos"; nunca os já conversados', () => {
    const ag = [
      { id: '1', text: 'a', forWhom: 'psiquiatria', doneAt: null, createdAt: '1' },
      { id: '2', text: 'b', forWhom: 'ambos', doneAt: null, createdAt: '2' },
      { id: '3', text: 'c', forWhom: 'psicologia', doneAt: null, createdAt: '3' },
      { id: '4', text: 'd', forWhom: 'psiquiatria', doneAt: '2026-11-01', createdAt: '4' },
    ] as any;
    expect(agendaFor(ag, { forWhom: 'psiquiatria' }).map((x) => x.id)).toEqual(['1', '2']);
    expect(agendaFor(ag, { forWhom: 'outro' }).map((x) => x.id)).toEqual([]);
  });
  it('identificador da notificação é estável e positivo; sem lembrete não agenda', async () => {
    expect(notificationId('abc')).toBe(notificationId('abc'));
    expect(notificationId('abc')).toBeGreaterThan(0);
    expect(notificationId('abc')).not.toBe(notificationId('abd'));
    expect(await syncReminder(A({ date: '2026-12-10', time: '14:00' }))).toBeNull();
    expect(await syncReminder(A({ date: '2020-01-01', time: '14:00', reminderMinutes: 60 }))).toBeNull(); // já passou
  });
});

describe('medicamentos', () => {
  const sert = MED({ name: 'Sertralina', startDate: '2026-08-01', doses: [{ date: '2026-08-01', dose: '50 mg', schedule: 'manhã', note: '' }, { date: '2026-10-15', dose: '100 mg', schedule: 'manhã', note: 'orientação' }], notes: [{ date: '2026-08-05', text: 'enjoo' }] });
  const quet = MED({ name: 'Quetiapina', startDate: '2026-06-01', endDate: '2026-09-01', stopReason: 'efeitos', doses: [{ date: '2026-06-01', dose: '25 mg', schedule: 'noite', note: '' }] });
  const futuro = MED({ name: 'Bupropiona', startDate: '2026-12-01', doses: [{ date: '2026-12-01', dose: '150 mg', schedule: '', note: '' }] });
  it('dose atual = a última; em uso × anteriores (com data de fim)', () => {
    expect(currentDose(sert).dose).toBe('100 mg');
    expect(activeMeds([sert, quet, futuro], '2026-11-20').map((m) => m.name)).toEqual(['Sertralina']);
    expect(pastMeds([sert, quet], '2026-11-20').map((m) => m.name)).toEqual(['Quetiapina']);
    expect(activeMeds([quet], '2026-08-31').length).toBe(1);
  });
  it('mudanças num período: início, nova dose e suspensão com motivo', () => {
    const ch = medChanges([sert, quet], '2026-08-01', '2026-10-31');
    expect(ch.map((c) => `${c.date} ${c.med.name} ${c.kind}`)).toEqual(['2026-08-01 Sertralina start', '2026-09-01 Quetiapina stop', '2026-10-15 Sertralina dose']);
    expect(ch[1].text).toBe('Efeitos colaterais');
  });
  it('esquema: exige nome e pelo menos uma dose', () => {
    expect(() => AppDataSchema.parse({ schemaVersion: 4, medications: [{ ...sert, doses: [] }] })).toThrow();
    expect(() => AppDataSchema.parse({ schemaVersion: 4, medications: [{ ...sert, name: '' }] })).toThrow();
    expect(AppDataSchema.parse({ schemaVersion: 4, medications: [sert], appointments: [A({ date: '2026-12-01' })] }).medications).toHaveLength(1);
  });
  it('resumo desde a última consulta conta mudanças de medicação', () => {
    const d = AppDataSchema.parse({ schemaVersion: 4, medications: [sert] });
    expect(sinceSummary(d, '2026-10-01', '2026-11-20').medChanges).toBe(1);
  });
});
