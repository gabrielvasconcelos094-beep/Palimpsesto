/**
 * Campos do sono de UMA noite: horas, qualidade (com descrição de cada nível) e
 * dificuldades. Usado no registro de humor e no "Como foi a noite?" da tela Hoje;
 * os dois leem e gravam a mesma noite da data (`store.setSleep`), sem duplicar.
 */
import { useState } from 'react';
import { Sheet, fmtDate } from './components';
import { store, useData } from '../app/store';
import { toast } from '../app/toast';
import { SLEEP_FACTOR_LABELS, SLEEP_QUALITY, SLEEP_TROUBLE_LABELS } from '../domain/scales';
import { SLEEP_FACTORS, SLEEP_TROUBLES, type SleepLog, type SleepTrouble } from '../domain/schema';
import { nightBefore } from '../domain/sleep';

export type SleepValue = Pick<SleepLog, 'hours' | 'quality' | 'troubles' | 'factors'>;
export const EMPTY_SLEEP: SleepValue = { hours: null, quality: null, troubles: [], factors: [] };
export const sleepOf = (log?: SleepLog): SleepValue =>
  log ? { hours: log.hours, quality: log.quality, troubles: [...log.troubles], factors: [...(log.factors ?? [])] } : { ...EMPTY_SLEEP, troubles: [], factors: [] };

export function nightLabel(date: string) {
  return `Noite de ${fmtDate(nightBefore(date), { short: true })} para ${fmtDate(date, { short: true })}`;
}

export function SleepFields({ value, onChange }: { value: SleepValue; onChange: (v: SleepValue) => void }) {
  const set = (p: Partial<SleepValue>) => onChange({ ...value, ...p });
  const h = value.hours;
  return (
    <div className="stack lg">
      <div className="stack" style={{ gap: 6 }}>
        <span className="small" style={{ fontWeight: 600 }}>
          Quantas horas você dormiu?
        </span>
        <div className="row" style={{ gap: 8 }}>
          <button className="icon-btn" aria-label="Menos meia hora" onClick={() => set({ hours: Math.max(0, (h ?? 7.5) - 0.5) })}>
            −
          </button>
          <input
            className="input"
            style={{ width: 90, textAlign: 'center' }}
            type="number"
            inputMode="decimal"
            min={0}
            max={24}
            step={0.5}
            aria-label="Horas de sono"
            placeholder="—"
            value={h ?? ''}
            onChange={(e) => {
              const v = e.target.value === '' ? null : Math.max(0, Math.min(24, Math.round(Number(e.target.value.replace(',', '.')) * 2) / 2));
              set({ hours: v === null || Number.isNaN(v) ? null : v });
            }}
          />
          <button className="icon-btn" aria-label="Mais meia hora" onClick={() => set({ hours: Math.min(24, (h ?? 6.5) + 0.5) })}>
            +
          </button>
          <span className="small muted">horas</span>
        </div>
        <span className="xs faint">Uma estimativa basta. Como referência geral, adultos costumam precisar de 7 a 9 h — varia de pessoa para pessoa.</span>
      </div>

      <div className="stack" style={{ gap: 6 }}>
        <span className="small" style={{ fontWeight: 600 }}>
          Como foi a qualidade do sono?
        </span>
        <div className="sleep-quality" role="radiogroup" aria-label="Qualidade do sono">
          {SLEEP_QUALITY.map((q, i) => {
            const v = i + 1;
            const on = value.quality === v;
            return (
              <button key={q.label} role="radio" aria-checked={on} aria-pressed={on} onClick={() => set({ quality: on ? null : v })}>
                <span className="q-label">{q.label}</span>
                <span className="q-hint">{q.hint}</span>
              </button>
            );
          })}
        </div>
        <span className="xs faint">A qualidade é sobre o quanto você descansou — independe das horas: dá para dormir muito e mal.</span>
      </div>

      <div className="stack" style={{ gap: 6 }}>
        <span className="small" style={{ fontWeight: 600 }}>
          Alguma dificuldade? <span className="faint" style={{ fontWeight: 400 }}>· opcional</span>
        </span>
        <div className="chips" role="group" aria-label="Dificuldades para dormir">
          {SLEEP_TROUBLES.map((t: SleepTrouble) => {
            const on = value.troubles.includes(t);
            return (
              <button key={t} className="chip" aria-pressed={on} onClick={() => set({ troubles: on ? value.troubles.filter((x) => x !== t) : [...value.troubles, t] })}>
                {SLEEP_TROUBLE_LABELS[t]}
              </button>
            );
          })}
        </div>
      </div>

      <div className="stack" style={{ gap: 6 }}>
        <span className="small" style={{ fontWeight: 600 }}>
          O que pode ter atrapalhado? <span className="faint" style={{ fontWeight: 400 }}>· opcional</span>
        </span>
        <div className="chips" role="group" aria-label="O que pode ter atrapalhado o sono">
          {SLEEP_FACTORS.map((f) => {
            const on = value.factors.includes(f);
            return (
              <button key={f} className="chip" aria-pressed={on} onClick={() => set({ factors: on ? value.factors.filter((x) => x !== f) : [...value.factors, f] })}>
                {SLEEP_FACTOR_LABELS[f]}
              </button>
            );
          })}
        </div>
        <span className="xs faint">Com o tempo, a Trajetória mostra quais desses aparecem mais nas noites ruins — pistas para conversar na consulta.</span>
      </div>
    </div>
  );
}

/** Folha rápida: só a noite de uma data, sem registro de humor. */
export function SleepSheet({ open, date, onClose }: { open: boolean; date: string; onClose: () => void }) {
  const data = useData();
  const log = data.sleepLogs.find((s) => s.date === date);
  const [v, setV] = useState<SleepValue>(() => sleepOf(log));
  const [opened, setOpened] = useState(false);
  if (open && !opened) {
    setOpened(true);
    setV(sleepOf(log));
  }
  if (!open && opened) setOpened(false);
  return (
    <Sheet open={open} onClose={onClose} title="Como foi a noite?">
      <div className="stack lg">
        <p className="small muted" style={{ margin: 0 }}>
          {nightLabel(date)}. Uma vez por noite: se você já informou, edita a mesma noite.
        </p>
        <SleepFields value={v} onChange={setV} />
        <div className="row sheet-actions">
          <button
            className="btn primary block"
            onClick={() => {
              store.setSleep(date, v);
              toast(log ? 'Noite atualizada.' : 'Noite registrada.');
              onClose();
            }}
          >
            Salvar
          </button>
        </div>
      </div>
    </Sheet>
  );
}
