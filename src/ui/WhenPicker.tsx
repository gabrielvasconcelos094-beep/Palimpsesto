/**
 * "Quando aconteceu?" — escolha rápida de data e horário para registros,
 * inclusive retroativos. Produz `at` (hora local) + `timePrecision`.
 *
 *   [Agora] [Hoje] [Ontem] [Outra data]
 *   [Madrugada] [Manhã] [Tarde] [Noite] [Horário exato] [Não sei]
 */
import { useState } from 'react';
import type { TimePrecision } from '../domain/schema';
import { addDays, composeAt, dayKey, localIso } from '../domain/util';
import { fmtDate } from './components';

export interface When {
  at: string;
  timePrecision: TimePrecision;
}

export const PERIODS: Array<{ key: string; label: string; time: string; from: number; to: number }> = [
  { key: 'dawn', label: 'Madrugada', time: '03:00', from: 0, to: 5 },
  { key: 'morning', label: 'Manhã', time: '09:00', from: 6, to: 11 },
  { key: 'afternoon', label: 'Tarde', time: '15:00', from: 12, to: 17 },
  { key: 'evening', label: 'Noite', time: '20:00', from: 18, to: 23 },
];
export const periodOfHour = (h: number) => PERIODS.find((p) => h >= p.from && h <= p.to) ?? PERIODS[1];

const hourOf = (at: string) => Number(at.slice(11, 13)) || 0;
const timeOf = (at: string) => at.slice(11, 16);

/** Texto curto: "agora", "hoje à tarde", "19 de novembro, 21:30", "3 de março (sem horário)". */
export function describeWhen(w: When, now = new Date()): string {
  const day = w.at.slice(0, 10);
  const today = dayKey(now);
  const yesterday = dayKey(addDays(now, -1));
  const dayText = day === today ? 'hoje' : day === yesterday ? 'ontem' : fmtDate(day, { weekday: true });
  if (w.timePrecision === 'day') return `${dayText} (sem horário)`;
  if (w.timePrecision === 'period') return `${dayText}, ${periodOfHour(hourOf(w.at)).label.toLowerCase()}`;
  return `${dayText}, ${timeOf(w.at)}`;
}

export function nowWhen(): When {
  return { at: localIso(new Date()), timePrecision: 'exact' };
}

export function WhenPicker({ value, onChange, allowNow = true, label = 'Quando aconteceu?' }: { value: When; onChange: (w: When) => void; allowNow?: boolean; label?: string }) {
  const today = dayKey(new Date());
  const yesterday = dayKey(addDays(new Date(), -1));
  const day = value.at.slice(0, 10);
  const [now, setNow] = useState(() => allowNow && value.timePrecision === 'exact' && Math.abs(new Date(value.at).getTime() - Date.now()) < 5 * 60e3);
  const [other, setOther] = useState(() => day !== today && day !== yesterday);
  const [exactOpen, setExactOpen] = useState(() => !now && value.timePrecision === 'exact');

  const setDay = (d: string) => {
    if (now) {
      // Saindo de "agora": usa o período do horário atual como ponto de partida.
      setNow(false);
      onChange({ at: composeAt(d, periodOfHour(hourOf(value.at)).time), timePrecision: 'period' });
    } else onChange({ at: composeAt(d, timeOf(value.at) || '12:00'), timePrecision: value.timePrecision });
  };
  const pickPeriod = (time: string) => {
    setExactOpen(false);
    onChange({ at: composeAt(day, time), timePrecision: 'period' });
  };
  const curPeriod = value.timePrecision === 'period' ? periodOfHour(hourOf(value.at)).key : null;

  return (
    <div className="stack" style={{ gap: 8 }} role="group" aria-label={label}>
      <span className="label">{label}</span>
      <div className="chips">
        {allowNow && (
          <button
            className="chip"
            aria-pressed={now}
            onClick={() => {
              setNow(true);
              setOther(false);
              setExactOpen(false);
              onChange(nowWhen());
            }}
          >
            Agora
          </button>
        )}
        <button className="chip" aria-pressed={!now && !other && day === today} onClick={() => (setOther(false), setDay(today))}>
          Hoje
        </button>
        <button className="chip" aria-pressed={!now && !other && day === yesterday} onClick={() => (setOther(false), setDay(yesterday))}>
          Ontem
        </button>
        <button
          className="chip"
          aria-pressed={!now && other}
          onClick={() => {
            setOther(true);
            if (now || day === today) setDay(dayKey(addDays(new Date(), -2)));
          }}
        >
          Outra data
        </button>
      </div>
      {!now && other && (
        <input
          type="date"
          className="input"
          aria-label="Data"
          value={day}
          max={today}
          onChange={(e) => e.target.value && setDay(e.target.value)}
        />
      )}
      {!now && (
        <div className="chips" role="group" aria-label="Horário">
          {PERIODS.map((p) => (
            <button key={p.key} className="chip" aria-pressed={curPeriod === p.key && !exactOpen} onClick={() => pickPeriod(p.time)}>
              {p.label}
            </button>
          ))}
          <button
            className="chip"
            aria-pressed={exactOpen || value.timePrecision === 'exact'}
            onClick={() => {
              setExactOpen(true);
              onChange({ at: value.at, timePrecision: 'exact' });
            }}
          >
            Horário exato
          </button>
          <button
            className="chip"
            aria-pressed={value.timePrecision === 'day'}
            onClick={() => {
              setExactOpen(false);
              onChange({ at: composeAt(day, '12:00'), timePrecision: 'day' });
            }}
          >
            Não sei
          </button>
        </div>
      )}
      {!now && (exactOpen || value.timePrecision === 'exact') && (
        <input
          type="time"
          className="input"
          aria-label="Horário exato"
          value={timeOf(value.at)}
          onChange={(e) => e.target.value && onChange({ at: composeAt(day, e.target.value), timePrecision: 'exact' })}
          style={{ maxWidth: 160 }}
        />
      )}
      {!now && <span className="help">{describeWhen(value).replace(/^./, (c) => c.toUpperCase())}</span>}
    </div>
  );
}

/** Só a data (acontecimentos), com atalhos. */
export function DatePicker({ value, onChange, label, optional, min }: { value: string | null; onChange: (d: string | null) => void; label: string; optional?: boolean; min?: string }) {
  const today = dayKey(new Date());
  const yesterday = dayKey(addDays(new Date(), -1));
  return (
    <div className="stack" style={{ gap: 8 }} role="group" aria-label={label}>
      <span className="label">
        {label} {optional && <span className="opt">· opcional</span>}
      </span>
      <div className="row wrap" style={{ gap: 8 }}>
        <button className="chip" aria-pressed={value === today} onClick={() => onChange(today)}>
          Hoje
        </button>
        <button className="chip" aria-pressed={value === yesterday} onClick={() => onChange(yesterday)}>
          Ontem
        </button>
        <input type="date" className="input" aria-label={`${label} (data)`} style={{ width: "auto", flex: 1, minWidth: 150 }} value={value ?? ''} min={min} onChange={(e) => onChange(e.target.value || (optional ? null : value))} />
      </div>
    </div>
  );
}
