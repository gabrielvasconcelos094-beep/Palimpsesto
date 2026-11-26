/**
 * Lembretes de consulta: notificações LOCAIS agendadas no próprio aparelho
 * (AlarmManager), sem internet e sem servidor. Só existem se você pedir, por
 * consulta. O texto é neutro por padrão — a notificação pode aparecer na tela
 * de bloqueio.
 */
import { Capacitor } from '@capacitor/core';
import { reminderText, reminderTime } from '../domain/care';
import type { Appointment } from '../domain/schema';

/** Identificador numérico estável a partir do id da consulta. */
export function notificationId(id: string): number {
  let h = 2166136261;
  for (let i = 0; i < id.length; i++) h = Math.imul(h ^ id.charCodeAt(i), 16777619);
  return (h >>> 1) % 2000000000 || 1;
}

type Dev = { scheduled: Record<number, { at: string; title: string; body: string }> };
const dev = (): Dev | null => (import.meta.env.DEV && typeof window !== 'undefined' ? ((window as any).__reminders ??= { scheduled: {} }) : null);

async function plugin() {
  if (!Capacitor.isNativePlatform()) return null;
  try {
    return (await import('@capacitor/local-notifications')).LocalNotifications;
  } catch {
    return null;
  }
}

/** Chamadas ao plugin nunca podem travar o app: no máximo 4 s e nunca lançam erro. */
function guarded<T>(p: Promise<T>, ms = 4000): Promise<T | undefined> {
  return Promise.race([p, new Promise<undefined>((r) => setTimeout(() => r(undefined), ms))]).catch(() => undefined);
}

export type PermissionState = 'granted' | 'denied' | 'prompt' | 'unsupported';

export async function notificationPermission(ask = false): Promise<PermissionState> {
  const ln = await plugin();
  if (!ln) return 'unsupported';
  try {
    const cur = (await ln.checkPermissions()).display;
    if (cur === 'granted' || !ask) return cur === 'granted' ? 'granted' : cur === 'denied' ? 'denied' : 'prompt';
    const r = (await ln.requestPermissions()).display;
    return r === 'granted' ? 'granted' : 'denied';
  } catch {
    return 'unsupported';
  }
}

/** Agenda (ou cancela) o lembrete de uma consulta. Devolve quando vai tocar, ou null. */
export async function syncReminder(a: Appointment, now = new Date()): Promise<Date | null> {
  const id = notificationId(a.id);
  const at = a.status === 'scheduled' ? reminderTime(a) : null;
  const ln = await plugin();
  const d = dev();
  try {
    if (ln) await guarded(ln.cancel({ notifications: [{ id }] }));
    if (d) delete d.scheduled[id];
    if (!at || at <= now) return null;
    const { title, body } = reminderText(a);
    if (ln) {
      await guarded(ln.schedule({
        notifications: [{ id, title, body, schedule: { at, allowWhileIdle: true }, extra: { appointmentId: a.id }, smallIcon: 'ic_stat_palimpsesto' }],
      }));
    }
    if (d) d.scheduled[id] = { at: at.toISOString(), title, body };
    return at;
  } catch {
    return null;
  }
}

export async function cancelReminder(id: string) {
  const d = dev();
  if (d) delete d.scheduled[notificationId(id)];
  const ln = await plugin();
  if (ln) await guarded(ln.cancel({ notifications: [{ id: notificationId(id) }] }));
}

/** Reagenda todos (ao abrir o app, depois de importar um backup etc.). */
export async function syncAllReminders(list: Appointment[]) {
  for (const a of list) if (a.reminderMinutes != null) await syncReminder(a);
}

/** Tocar na notificação abre a consulta. */
export async function onReminderTap(open: (appointmentId: string) => void) {
  const ln = await plugin();
  if (!ln) return;
  await ln.addListener('localNotificationActionPerformed', (e) => {
    const id = e.notification?.extra?.appointmentId;
    if (id) open(String(id));
  });
}
