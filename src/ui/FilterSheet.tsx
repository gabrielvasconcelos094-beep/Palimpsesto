import { useMemo } from 'react';
import { useData } from '../app/store';
import { energyLabel, valenceLabel, VALENCE_VALUES } from '../domain/scales';
import { NO_FILTERS, PERIOD_LABELS, type PeriodKind, type RecordFilters } from '../domain/filters';
import { fold } from '../domain/util';
import { Field, Segmented, Sheet, Toggle } from './components';
import { ValenceMark } from './pickers';

/** Folha de filtros usada no Diário e na Trajetória — mesmas regras nos dois. */
export function FilterSheet(props: {
  open: boolean;
  onClose: () => void;
  value: RecordFilters;
  onChange: (f: RecordFilters) => void;
  resultLabel: string;
  showType?: boolean;
  showPeriod?: boolean;
}) {
  const data = useData();
  const f = props.value;
  const set = (p: Partial<RecordFilters>) => props.onChange({ ...f, ...p });
  const toggle = <T,>(arr: T[], v: T) => (arr.includes(v) ? arr.filter((x) => x !== v) : [...arr, v]);
  const labels = data.preferences.valenceLabels;

  const usedItems = useMemo(() => {
    const ids = new Set<string>();
    data.moodEntries.forEach((m) => m.itemIds.forEach((i) => ids.add(i)));
    data.uses.forEach((u) => ids.add(u.itemId));
    return data.repertoire.filter((i) => ids.has(i.id));
  }, [data.moodEntries, data.uses, data.repertoire]);
  const tags = useMemo(() => {
    const m = new Map<string, { t: string; n: number }>();
    [...data.moodEntries, ...data.experiences, ...data.events].forEach((x) =>
      x.tags.forEach((t) => {
        const k = fold(t);
        const c = m.get(k);
        if (c) c.n++;
        else m.set(k, { t, n: 1 });
      }),
    );
    return [...m.values()].sort((a, b) => b.n - a.n).slice(0, 30).map((x) => x.t);
  }, [data.moodEntries, data.experiences, data.events]);

  return (
    <Sheet open={props.open} onClose={props.onClose} title="Filtrar registros">
      <div className="stack lg">
        <p className="xs muted" style={{ margin: 0 }}>
          Categorias diferentes se somam (ex.: desagradável <em>e</em> com irritação). Dentro de uma categoria, basta uma das opções.
        </p>
        {props.showType !== false && (
          <Field label="Tipo">
            <Segmented
              value={f.type}
              onChange={(type) => set({ type })}
              options={[
                { value: 'all', label: 'Tudo' },
                { value: 'mood', label: 'Humor' },
                { value: 'exp', label: 'Experiências' },
                { value: 'event', label: 'Acontec.' },
              ]}
            />
          </Field>
        )}
        {props.showPeriod !== false && (
          <Field label="Período (quando aconteceu)">
            <div className="chips">
              {(['7d', '30d', '90d', '365d', 'all', 'custom'] as PeriodKind[]).map((p) => (
                <button key={p} className="chip" aria-pressed={f.period === p} onClick={() => set({ period: p })}>
                  {PERIOD_LABELS[p]}
                </button>
              ))}
            </div>
            {f.period === 'custom' && (
              <div className="grid-2">
                <input type="date" className="input" aria-label="De" value={f.from ?? ''} max={f.to ?? undefined} onChange={(e) => set({ from: e.target.value || null })} />
                <input type="date" className="input" aria-label="Até" value={f.to ?? ''} min={f.from ?? undefined} onChange={(e) => set({ to: e.target.value || null })} />
              </div>
            )}
          </Field>
        )}
        <Field label="Valência">
          <div className="chips">
            {VALENCE_VALUES.map((v) => (
              <button key={v} className="chip" aria-pressed={f.valences.includes(v)} onClick={() => set({ valences: toggle(f.valences, v) })}>
                <ValenceMark v={v} size={16} /> {valenceLabel(v, labels)}
              </button>
            ))}
          </div>
        </Field>
        <Field label="Emoções">
          <div className="chips">
            {data.emotions
              .filter((e) => !e.hidden || f.emotions.includes(e.id))
              .map((e) => (
                <button key={e.id} className="chip" aria-pressed={f.emotions.includes(e.id)} onClick={() => set({ emotions: toggle(f.emotions, e.id) })}>
                  {e.label}
                </button>
              ))}
          </div>
          {f.emotions.length > 1 && (
            <Segmented
              ariaLabel="Combinação de emoções"
              value={f.emotionMode}
              onChange={(emotionMode) => set({ emotionMode })}
              options={[
                { value: 'any', label: 'Qualquer uma' },
                { value: 'all', label: 'Todas juntas' },
              ]}
            />
          )}
        </Field>
        <Field label="Energia">
          <div className="chips">
            {[1, 2, 3, 4, 5].map((e) => (
              <button key={e} className="chip" aria-pressed={f.energies.includes(e)} onClick={() => set({ energies: toggle(f.energies, e) })}>
                {energyLabel(e, data.preferences.energyLabels)}
              </button>
            ))}
          </div>
        </Field>
        {usedItems.length > 0 && (
          <Field label="Atividades e estratégias">
            <div className="chips">
              {usedItems.map((i) => (
                <button key={i.id} className="chip" aria-pressed={f.itemIds.includes(i.id)} onClick={() => set({ itemIds: toggle(f.itemIds, i.id) })}>
                  {i.name}
                </button>
              ))}
            </div>
          </Field>
        )}
        {tags.length > 0 && (
          <Field label="Contexto (marcadores)">
            <div className="chips">
              {tags.map((t) => (
                <button key={t} className="chip tag" aria-pressed={f.tags.some((x) => fold(x) === fold(t))} onClick={() => set({ tags: f.tags.some((x) => fold(x) === fold(t)) ? f.tags.filter((x) => fold(x) !== fold(t)) : [...f.tags, t] })}>
                  {t}
                </button>
              ))}
            </div>
          </Field>
        )}
        <div className="list">
          <Toggle label="Só registros retroativos" help="Escritos num dia posterior ao que aconteceram." checked={f.retroOnly} onChange={(retroOnly) => set({ retroOnly })} />
        </div>
        <Field label="Texto">
          <input className="input" value={f.q} onChange={(e) => set({ q: e.target.value })} placeholder="Palavras nas anotações, títulos…" />
        </Field>
        <div className="row">
          <button className="btn secondary" onClick={() => props.onChange({ ...NO_FILTERS, period: props.showPeriod === false ? f.period : 'all' })}>
            Limpar
          </button>
          <button className="btn primary block" onClick={props.onClose}>
            {props.resultLabel}
          </button>
        </div>
      </div>
    </Sheet>
  );
}

export function FilterSummary({ items, onClear }: { items: string[]; onClear: () => void }) {
  if (!items.length) return null;
  return (
    <div className="row wrap" style={{ gap: 6, marginTop: 12 }}>
      <span className="xs faint">Filtros:</span>
      {items.map((t, i) => (
        <span key={i} className="chip static">
          {t}
        </span>
      ))}
      <button className="btn ghost sm" onClick={onClear}>
        Limpar
      </button>
    </div>
  );
}
