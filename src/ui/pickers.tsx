import { useMemo, useState } from 'react';
import { Plus } from 'lucide-react';
import { store, useData } from '../app/store';
import { DEFAULT_ENERGY_LABELS, energyLabel, valenceLabel, VALENCE_VALUES } from '../domain/scales';
import { ACTIVITY_SUGGESTIONS, CONTEXT_AREAS, CONTEXT_SUGGESTIONS } from '../domain/seed';
import { cleanTag, fold, uniqTags } from '../domain/util';
import { MoodSymbol, type SymbolSet } from './symbols';

/* ------------------------------------------------------------------ */
/* Marca de valência: família de símbolos escolhida pelo usuário        */
/* ------------------------------------------------------------------ */
export function ValenceMark({ v, size = 22, title, set }: { v: number; size?: number; title?: string; set?: SymbolSet }) {
  const prefs = useData().preferences;
  return <MoodSymbol v={v} size={size} title={title} set={set ?? prefs.symbolSet} />;
}

/** Símbolo do humor sobre um disco tingido pela cor do nível (listas de registros). */
export function MoodDot({ v, size = 26, title }: { v: number; size?: number; title?: string }) {
  return (
    <span className="mood-dot" style={{ ['--m' as string]: `var(--mood-${v + 3})` }}>
      <ValenceMark v={v} size={size} title={title} />
    </span>
  );
}

export function ValencePicker({ value, onChange }: { value: number | null; onChange: (v: number) => void }) {
  const labels = useData().preferences.valenceLabels;
  // Lista vertical: acomoda nomes personalizados longos; "para cima" = mais agradável.
  return (
    <div className="vscale" role="radiogroup" aria-label="Como você está se sentindo">
      {[...VALENCE_VALUES].reverse().map((v) => (
        <button key={v} role="radio" aria-checked={value === v} aria-pressed={value === v} onClick={() => onChange(v)}>
          <ValenceMark v={v} size={24} />
          <span>{valenceLabel(v, labels)}</span>
        </button>
      ))}
    </div>
  );
}

export function EnergyBars({ e, size = 16 }: { e: number; size?: number }) {
  return (
    <svg width={size * 1.2} height={size} viewBox="0 0 24 20" aria-hidden style={{ flex: 'none' }}>
      {[0, 1, 2, 3, 4].map((i) => (
        <rect
          key={i}
          x={i * 5}
          y={20 - (i + 1) * 4}
          width={3.4}
          height={(i + 1) * 4}
          rx={1}
          fill={i < e ? 'var(--primary-ink)' : 'var(--line-strong)'}
          opacity={i < e ? 1 : 0.5}
        />
      ))}
    </svg>
  );
}

export function EnergyPicker({ value, onChange }: { value: number | null; onChange: (v: number | null) => void }) {
  const labels = useData().preferences.energyLabels;
  return (
    <div className="scale" role="radiogroup" aria-label="Nível de energia">
      {[1, 2, 3, 4, 5].map((e) => (
        <button key={e} role="radio" aria-checked={value === e} aria-pressed={value === e} onClick={() => onChange(value === e ? null : e)}>
          <EnergyBars e={e} size={20} />
          <span>{energyLabel(e, labels)}</span>
        </button>
      ))}
    </div>
  );
}

export function LevelPicker({
  value,
  onChange,
  levels,
  label,
}: {
  value: number | undefined;
  onChange: (v: number | undefined) => void;
  levels: string[];
  label: string;
}) {
  return (
    <div className="scale compact" role="radiogroup" aria-label={label}>
      {levels.map((l, i) => (
        <button key={l} role="radio" aria-checked={value === i + 1} aria-pressed={value === i + 1} onClick={() => onChange(value === i + 1 ? undefined : i + 1)}>
          <span>{l}</span>
        </button>
      ))}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Emoções                                                             */
/* ------------------------------------------------------------------ */
export function EmotionPicker({ value, onChange }: { value: string[]; onChange: (ids: string[]) => void }) {
  const data = useData();
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState('');
  const [showAll, setShowAll] = useState(false);

  // Emoções mais usadas primeiro; as selecionadas sempre visíveis.
  const ordered = useMemo(() => {
    const freq = new Map<string, number>();
    for (const m of data.moodEntries) for (const id of m.emotionIds) freq.set(id, (freq.get(id) ?? 0) + 1);
    const builtOrder = new Map(data.emotions.map((e, i) => [e.id, i]));
    return data.emotions
      .filter((e) => !e.hidden || value.includes(e.id))
      .sort((a, b) => (freq.get(b.id) ?? 0) - (freq.get(a.id) ?? 0) || builtOrder.get(a.id)! - builtOrder.get(b.id)!);
  }, [data.emotions, data.moodEntries, value]);
  const LIMIT = 14;
  const visible = showAll ? ordered : ordered.filter((e, i) => i < LIMIT || value.includes(e.id));

  const toggle = (id: string) => onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id]);
  const add = () => {
    const label = draft.trim();
    if (!label) return setAdding(false);
    const existing = data.emotions.find((e) => fold(e.label) === fold(label));
    const e = existing ?? store.upsert('emotions', { label, builtIn: false, hidden: false });
    if (existing?.hidden) store.patch('emotions', existing.id, { hidden: false });
    if (!value.includes(e.id)) onChange([...value, e.id]);
    setDraft('');
    setAdding(false);
  };

  return (
    <div className="chips" role="group" aria-label="Emoções">
      {visible.map((e) => (
        <button key={e.id} className="chip" aria-pressed={value.includes(e.id)} onClick={() => toggle(e.id)}>
          {e.label}
        </button>
      ))}
      {!showAll && ordered.length > visible.length && (
        <button className="chip add" onClick={() => setShowAll(true)}>
          mais {ordered.length - visible.length}…
        </button>
      )}
      {adding ? (
        <input
          className="input"
          style={{ width: 180, minHeight: 36, padding: '6px 12px' }}
          autoFocus
          value={draft}
          placeholder="Nome da emoção"
          maxLength={60}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => e.key === 'Enter' && add()}
          onBlur={add}
        />
      ) : (
        <button className="chip add" onClick={() => setAdding(true)}>
          <Plus size={14} /> outra
        </button>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Marcadores (contexto)                                               */
/* ------------------------------------------------------------------ */
export function useAllTags(): string[] {
  const d = useData();
  return useMemo(() => {
    const all = [
      ...d.moodEntries.flatMap((x) => x.tags),
      ...d.experiences.flatMap((x) => x.tags),
      ...d.repertoire.flatMap((x) => x.tags),
      ...d.uses.flatMap((x) => x.tags),
      ...d.discoveries.flatMap((x) => x.tags),
      ...d.situations.flatMap((x) => x.tags),
      ...d.letters.flatMap((x) => x.tags),
      ...d.notes.flatMap((x) => x.tags),
    ];
    const freq = new Map<string, { t: string; n: number }>();
    for (const t of all) {
      const k = fold(t);
      const c = freq.get(k);
      if (c) c.n++;
      else freq.set(k, { t, n: 1 });
    }
    return [...freq.values()].sort((a, b) => b.n - a.n).map((x) => x.t);
  }, [d]);
}

export function TagInput({
  value,
  onChange,
  suggestions,
  placeholder = 'Novo marcador',
  max = 10,
}: {
  value: string[];
  onChange: (t: string[]) => void;
  suggestions?: string[];
  placeholder?: string;
  max?: number;
}) {
  const existing = useAllTags();
  const [draft, setDraft] = useState('');
  const pool = uniqTags([...existing, ...(suggestions ?? CONTEXT_SUGGESTIONS)]);
  const selected = new Set(value.map(fold));
  const q = fold(draft);
  const options = pool.filter((t) => !selected.has(fold(t)) && (!q || fold(t).includes(q))).slice(0, q ? 8 : max);
  const add = (t: string) => {
    const c = cleanTag(t);
    if (!c) return;
    onChange(uniqTags([...value, c]));
    setDraft('');
  };
  return (
    <div className="stack" style={{ gap: 8 }}>
      {value.length > 0 && (
        <div className="chips">
          {value.map((t) => (
            <button key={t} className="chip tag" aria-pressed="true" aria-label={`Remover ${t}`} onClick={() => onChange(value.filter((x) => x !== t))}>
              {t} <span aria-hidden>×</span>
            </button>
          ))}
        </div>
      )}
      <input
        className="input"
        value={draft}
        placeholder={placeholder}
        maxLength={60}
        onChange={(e) => setDraft(e.target.value)}
        onKeyDown={(e) => {
          if (e.key === 'Enter' || e.key === ',') {
            e.preventDefault();
            add(draft);
          }
        }}
        enterKeyHint="done"
      />
      <div className="chips">
        {draft.trim() && !pool.some((t) => fold(t) === q) && (
          <button className="chip add" onClick={() => add(draft)}>
            <Plus size={14} /> criar “{cleanTag(draft)}”
          </button>
        )}
        {options.map((t) => (
          <button key={t} className="chip tag" aria-pressed="false" onClick={() => add(t)}>
            {t}
          </button>
        ))}
      </div>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Contexto do registro (áreas da vida e marcadores próprios)          */
/* ------------------------------------------------------------------ */
/**
 * Contexto em um toque: áreas da vida + os marcadores que você mais usa, como chips
 * de liga/desliga. "Outro" abre o campo para criar um marcador seu. Grava nos mesmos
 * `tags` de sempre — o vocabulário que o Guia e a Trajetória já entendem.
 */
export function ContextPicker({ value, onChange }: { value: string[]; onChange: (t: string[]) => void }) {
  const used = useAllTags();
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState('');
  const sel = new Set(value.map(fold));
  const areas = new Set(CONTEXT_AREAS.map(fold));
  const mine = used.filter((t) => !areas.has(fold(t))).slice(0, 6);
  const chips = uniqTags([...CONTEXT_AREAS, ...mine, ...value]);
  const toggle = (t: string) => onChange(sel.has(fold(t)) ? value.filter((x) => fold(x) !== fold(t)) : uniqTags([...value, t]));
  const add = () => {
    const c = cleanTag(draft);
    if (c) onChange(uniqTags([...value, c]));
    setDraft('');
    setAdding(false);
  };
  return (
    <div className="stack" style={{ gap: 8 }}>
      <div className="chips" role="group" aria-label="Contexto">
        {chips.map((t) => (
          <button key={fold(t)} className="chip" aria-pressed={sel.has(fold(t))} onClick={() => toggle(t)}>
            {t}
          </button>
        ))}
        {!adding && (
          <button className="chip add" onClick={() => setAdding(true)}>
            <Plus size={14} /> outro
          </button>
        )}
      </div>
      {adding && (
        <div className="row" style={{ gap: 8 }}>
          <input
            className="input grow"
            value={draft}
            autoFocus
            maxLength={60}
            placeholder="Ex.: mudança de casa"
            aria-label="Novo contexto"
            enterKeyHint="done"
            onChange={(e) => setDraft(e.target.value)}
            onKeyDown={(e) => {
              if (e.key === 'Enter') {
                e.preventDefault();
                add();
              }
            }}
          />
          <button className="btn sm" disabled={!cleanTag(draft)} onClick={add}>
            Adicionar
          </button>
        </div>
      )}
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Atividades (itens do repertório)                                    */
/* ------------------------------------------------------------------ */
export function ActivityPicker({ value, onChange }: { value: string[]; onChange: (ids: string[]) => void }) {
  const data = useData();
  const [adding, setAdding] = useState(false);
  const [draft, setDraft] = useState('');
  const [showAll, setShowAll] = useState(false);
  const items = useMemo(() => {
    const freq = new Map<string, number>();
    for (const m of data.moodEntries) for (const id of m.itemIds) freq.set(id, (freq.get(id) ?? 0) + 1);
    const kindOrder = { activity: 0, resource: 1, strategy: 2, drain: 3 } as const;
    return data.repertoire
      .filter((i) => (!i.archived && i.kind !== 'drain') || value.includes(i.id))
      .sort((a, b) => (freq.get(b.id) ?? 0) - (freq.get(a.id) ?? 0) || kindOrder[a.kind] - kindOrder[b.kind] || a.name.localeCompare(b.name));
  }, [data.repertoire, data.moodEntries, value]);
  const known = new Set(data.repertoire.map((i) => fold(i.name)));
  const suggestions = ACTIVITY_SUGGESTIONS.filter((s) => !known.has(fold(s)));
  const LIMIT = 12;
  const visible = showAll ? items : items.filter((x, i) => i < LIMIT || value.includes(x.id));
  const toggle = (id: string) => onChange(value.includes(id) ? value.filter((x) => x !== id) : [...value, id]);
  const create = (name: string) => {
    const n = name.trim();
    if (!n) return;
    const existing = data.repertoire.find((i) => fold(i.name) === fold(n));
    const it = existing ?? store.upsert('repertoire', { kind: 'activity', name: n, category: '' });
    if (!value.includes(it.id)) onChange([...value, it.id]);
  };
  return (
    <div className="chips" role="group" aria-label="Atividades">
      {visible.map((i) => (
        <button key={i.id} className="chip" aria-pressed={value.includes(i.id)} onClick={() => toggle(i.id)}>
          {i.name}
        </button>
      ))}
      {!showAll && items.length > visible.length && (
        <button className="chip add" onClick={() => setShowAll(true)}>
          mais {items.length - visible.length}…
        </button>
      )}
      {(showAll || items.length < 6) &&
        suggestions.slice(0, 8).map((s) => (
          <button key={s} className="chip add" onClick={() => create(s)} aria-label={`Adicionar atividade ${s}`}>
            <Plus size={13} /> {s}
          </button>
        ))}
      {adding ? (
        <input
          className="input"
          style={{ width: 180, minHeight: 36, padding: '6px 12px' }}
          autoFocus
          value={draft}
          placeholder="Nome da atividade"
          maxLength={200}
          onChange={(e) => setDraft(e.target.value)}
          onKeyDown={(e) => {
            if (e.key === 'Enter') {
              create(draft);
              setDraft('');
              setAdding(false);
            }
          }}
          onBlur={() => {
            create(draft);
            setDraft('');
            setAdding(false);
          }}
        />
      ) : (
        <button className="chip add" onClick={() => setAdding(true)}>
          <Plus size={14} /> nova
        </button>
      )}
    </div>
  );
}

export function TagList({ tags }: { tags: string[] }) {
  if (!tags.length) return null;
  return (
    <div className="chips" style={{ gap: 6 }}>
      {tags.map((t) => (
        <span key={t} className="chip static tag">
          {t}
        </span>
      ))}
    </div>
  );
}

export { DEFAULT_ENERGY_LABELS };
