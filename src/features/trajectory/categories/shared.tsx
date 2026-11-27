/** Peças comuns às categorias da Trajetória (textos de veredito, avisos, unidade de análise). */
import { type ReactNode } from 'react';
import { type Unit, type Verdict } from '../../../domain/insights';
import { MONTHS_SHORT, Segmented } from '../../../ui/components';

export const pct = (x: number) => `${Math.round(x * 100)}%`;
export const monthLabel = (k: string) => `${MONTHS_SHORT[Number(k.slice(5, 7)) - 1]}/${k.slice(2, 4)}`;

export function Note({ children }: { children: ReactNode }) {
  return (
    <p className="xs muted" style={{ margin: '10px 0 0' }}>
      {children}
    </p>
  );
}

export function VerdictText({ v, what }: { v: Verdict; what: string }) {
  if (!v.ok) return <p className="small muted" style={{ margin: 0 }}>{v.reason}</p>;
  const h = v.h;
  return (
    <p style={{ margin: 0 }}>
      Nos registros disponíveis, <strong>{h.label}</strong> apresentou a maior proporção de {what} ({pct(h.share)}; em seguida, {h.runnerUpLabel}, com {pct(h.runnerUpShare!)}).{' '}
      <span className="small muted">
        Foram considerados {h.records} registro(s) em {h.dates} data(s) nesse dia, de um total de {h.totalRecords} registro(s) em {h.totalDates} data(s).{' '}
        {h.unit === 'day' ? 'Cada data pesa o mesmo.' : 'Cada registro pesa o mesmo.'} Isso descreve os dados registrados — não estabelece que esse seja seu melhor ou pior dia.
      </span>
    </p>
  );
}

export function UnitToggle({ unit, setUnit }: { unit: Unit; setUnit: (u: Unit) => void }) {
  return (
    <Segmented
      ariaLabel="Unidade de análise"
      value={unit}
      onChange={setUnit}
      options={[
        { value: 'day', label: 'Cada data pesa igual' },
        { value: 'record', label: 'Cada registro' },
      ]}
    />
  );
}

export function Insufficient({ n, need, what = 'registros' }: { n: number; need: number; what?: string }) {
  return (
    <div className="card dashed small muted">
      Ainda não há observações suficientes ({n} de pelo menos {need} {what}). Isso aparece sozinho quando houver mais dados — sem pressa.
    </div>
  );
}
