import { useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Feather, Plus, SlidersHorizontal } from 'lucide-react';
import { navigate, setQuery, useRoute } from '../../app/router';
import { useData } from '../../app/store';
import { calendarMap } from '../../domain/analytics';
import { energyLabel, valenceLabel, VALENCE_VALUES } from '../../domain/scales';
import type { Experience, MoodEntry } from '../../domain/schema';
import { addDays, dayKey, fold, matchesSearch, startOfWeek } from '../../domain/util';
import { Empty, fmtMonth, fmtTime, Page, relativeDay, Segmented, Sheet, Field } from '../../ui/components';
import { TagList, ValenceMark } from '../../ui/pickers';
import { MoodSheet } from './MoodSheet';

type Item = { kind: 'mood'; at: string; m: MoodEntry } | { kind: 'exp'; at: string; x: Experience };

interface Filters {
  type: 'all' | 'mood' | 'exp';
  period: 'all' | '7' | '30' | '90';
  emotions: string[];
  valences: number[];
  q: string;
}
const NO_FILTERS: Filters = { type: 'all', period: 'all', emotions: [], valences: [], q: '' };

export function Journal() {
  const data = useData();
  const route = useRoute();
  const view = (route.query.get('v') as 'lista' | 'calendario') || 'lista';
  const [sheet, setSheet] = useState<{ open: boolean; id: string | null }>({ open: false, id: null });
  const [addOpen, setAddOpen] = useState(false);
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [f, setF] = useState<Filters>(NO_FILTERS);
  const [limit, setLimit] = useState(30);
  const labels = data.preferences.valenceLabels;
  const emo = useMemo(() => new Map(data.emotions.map((e) => [e.id, e.label])), [data.emotions]);
  const activeFilters = f.type !== 'all' || f.period !== 'all' || f.emotions.length > 0 || f.valences.length > 0 || f.q.trim() !== '';

  const items = useMemo(() => {
    const since = f.period === 'all' ? '' : addDays(new Date(), -Number(f.period)).toISOString();
    const out: Item[] = [];
    if (f.type !== 'exp')
      for (const m of data.moodEntries) {
        if (since && m.at < since) continue;
        if (f.valences.length && !f.valences.includes(m.valence)) continue;
        if (f.emotions.length && !f.emotions.some((e) => m.emotionIds.includes(e))) continue;
        if (f.q && !matchesSearch([m.note, ...m.tags, ...m.emotionIds.map((i) => emo.get(i))], f.q)) continue;
        out.push({ kind: 'mood', at: m.at, m });
      }
    if (f.type !== 'mood')
      for (const x of data.experiences) {
        if (since && x.at < since) continue;
        if (f.valences.length && !(f.valences.includes(x.feelingBefore as number) || f.valences.includes(x.feelingAfter as number))) continue;
        if (f.emotions.length && !f.emotions.some((e) => x.emotionIds.includes(e))) continue;
        if (f.q && !matchesSearch([x.title, x.whatHappened, x.learned, x.whatHelped, x.whatWorsened, x.whatIDid, ...x.tags], f.q)) continue;
        out.push({ kind: 'exp', at: x.at, x });
      }
    return out.sort((a, b) => b.at.localeCompare(a.at));
  }, [data.moodEntries, data.experiences, f, emo]);

  const days = useMemo(() => {
    const map = new Map<string, Item[]>();
    for (const it of items) {
      const k = dayKey(it.at);
      map.set(k, [...(map.get(k) ?? []), it]);
    }
    return [...map.entries()];
  }, [items]);

  return (
    <Page
      title="Diário"
      ghost="diário"
      subtitle="Humor e experiências, no seu ritmo."
      actions={
        <>
          <button className="icon-btn" aria-label="Filtros" onClick={() => setFiltersOpen(true)} style={activeFilters ? { color: 'var(--primary-ink)' } : undefined}>
            <SlidersHorizontal size={21} strokeWidth={1.6} />
          </button>
          <button className="icon-btn filled" aria-label="Novo registro" onClick={() => setAddOpen(true)}>
            <Plus size={22} />
          </button>
        </>
      }
    >
      <Segmented
        ariaLabel="Visualização"
        value={view}
        onChange={(v) => setQuery('v', v)}
        options={[
          { value: 'lista', label: 'Linha do tempo' },
          { value: 'calendario', label: 'Calendário' },
        ]}
      />

      {activeFilters && (
        <div className="row between small" style={{ marginTop: 12 }}>
          <span className="muted">{items.length} registro(s) com os filtros atuais</span>
          <button className="btn ghost sm" onClick={() => setF(NO_FILTERS)}>
            Limpar filtros
          </button>
        </div>
      )}

      {view === 'calendario' ? (
        <CalendarView entries={items.filter((i): i is Extract<Item, { kind: 'mood' }> => i.kind === 'mood').map((i) => i.m)} onOpen={(id) => setSheet({ open: true, id })} />
      ) : days.length === 0 ? (
        <div style={{ marginTop: 20 }}>
          <Empty
            title={activeFilters ? 'Nada encontrado' : 'Ainda não há registros'}
            action={
              !activeFilters && (
                <button className="btn primary" onClick={() => setAddOpen(true)}>
                  Fazer um registro
                </button>
              )
            }
          >
            {activeFilters ? 'Tente ajustar os filtros.' : 'Registre quando quiser — um toque basta. Não há sequência a manter.'}
          </Empty>
        </div>
      ) : (
        <div>
          {days.slice(0, limit).map(([k, list]) => (
            <div key={k}>
              <div className="day-head">
                <span className="d">{relativeDay(list[0].at)}</span>
              </div>
              <div className="list">
                {list.map((it) =>
                  it.kind === 'mood' ? (
                    <button key={it.m.id} className="list-row" onClick={() => setSheet({ open: true, id: it.m.id })}>
                      <ValenceMark v={it.m.valence} size={22} title={valenceLabel(it.m.valence, labels)} />
                      <div className="grow">
                        <div className="title">{valenceLabel(it.m.valence, labels)}</div>
                        <div className="meta">
                          {[it.m.emotionIds.map((id) => emo.get(id)).filter(Boolean).join(', '), it.m.energy ? energyLabel(it.m.energy, data.preferences.energyLabels) : '']
                            .filter(Boolean)
                            .join(' · ')}
                        </div>
                        {it.m.note && (
                          <div className="small" style={{ marginTop: 4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                            {it.m.note}
                          </div>
                        )}
                        {it.m.tags.length > 0 && (
                          <div style={{ marginTop: 6 }}>
                            <TagList tags={it.m.tags} />
                          </div>
                        )}
                      </div>
                      <span className="xs faint">{fmtTime(it.m.at)}</span>
                    </button>
                  ) : (
                    <button key={it.x.id} className="list-row" onClick={() => navigate(`/diario/experiencia/${it.x.id}`)}>
                      <span className="vmark" style={{ width: 22, height: 22, background: 'var(--primary-soft)', color: 'var(--primary-ink)' }}>
                        <Feather size={13} />
                      </span>
                      <div className="grow">
                        <div className="title serif" style={{ fontSize: 'var(--fs-lg)' }}>
                          {it.x.title || 'Experiência'}
                        </div>
                        <div className="meta" style={{ display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                          {it.x.learned ? `Aprendizado: ${it.x.learned}` : it.x.whatHappened}
                        </div>
                      </div>
                    </button>
                  ),
                )}
              </div>
            </div>
          ))}
          {days.length > limit && (
            <button className="btn secondary block" style={{ marginTop: 18 }} onClick={() => setLimit(limit + 30)}>
              Mostrar dias anteriores
            </button>
          )}
        </div>
      )}

      <Sheet open={addOpen} onClose={() => setAddOpen(false)} title="Registrar">
        <div className="stack">
          <button
            className="card row"
            onClick={() => {
              setAddOpen(false);
              setSheet({ open: true, id: null });
            }}
          >
            <ValenceMark v={1} size={26} />
            <div className="grow">
              <div className="h3">Humor</div>
              <div className="small muted">Como você está agora — rápido, com detalhes opcionais.</div>
            </div>
          </button>
          <button
            className="card row"
            onClick={() => {
              setAddOpen(false);
              navigate('/diario/experiencia/nova');
            }}
          >
            <Feather size={24} />
            <div className="grow">
              <div className="h3">Experiência</div>
              <div className="small muted">Um acontecimento: o que houve, o que ajudou, o que aprendeu.</div>
            </div>
          </button>
        </div>
      </Sheet>

      <Sheet open={filtersOpen} onClose={() => setFiltersOpen(false)} title="Filtros">
        <div className="stack lg">
          <Field label="Tipo">
            <Segmented
              value={f.type}
              onChange={(type) => setF({ ...f, type })}
              options={[
                { value: 'all', label: 'Tudo' },
                { value: 'mood', label: 'Humor' },
                { value: 'exp', label: 'Experiências' },
              ]}
            />
          </Field>
          <Field label="Período">
            <Segmented
              value={f.period}
              onChange={(period) => setF({ ...f, period })}
              options={[
                { value: '7', label: '7 dias' },
                { value: '30', label: '30 dias' },
                { value: '90', label: '90 dias' },
                { value: 'all', label: 'Tudo' },
              ]}
            />
          </Field>
          <Field label="Valência">
            <div className="chips">
              {VALENCE_VALUES.map((v) => (
                <button
                  key={v}
                  className="chip"
                  aria-pressed={f.valences.includes(v)}
                  onClick={() => setF({ ...f, valences: f.valences.includes(v) ? f.valences.filter((x) => x !== v) : [...f.valences, v] })}
                >
                  <ValenceMark v={v} size={14} /> {valenceLabel(v, labels)}
                </button>
              ))}
            </div>
          </Field>
          <Field label="Emoções">
            <div className="chips">
              {data.emotions
                .filter((e) => !e.hidden)
                .map((e) => (
                  <button
                    key={e.id}
                    className="chip"
                    aria-pressed={f.emotions.includes(e.id)}
                    onClick={() => setF({ ...f, emotions: f.emotions.includes(e.id) ? f.emotions.filter((x) => x !== e.id) : [...f.emotions, e.id] })}
                  >
                    {e.label}
                  </button>
                ))}
            </div>
          </Field>
          <Field label="Buscar texto">
            <input className="input" value={f.q} onChange={(e) => setF({ ...f, q: e.target.value })} placeholder="Palavras, marcadores…" />
          </Field>
          <div className="row">
            <button className="btn secondary" onClick={() => setF(NO_FILTERS)}>
              Limpar
            </button>
            <button className="btn primary block" onClick={() => setFiltersOpen(false)}>
              Ver {items.length} registro(s)
            </button>
          </div>
        </div>
      </Sheet>

      <MoodSheet open={sheet.open} onClose={() => setSheet({ ...sheet, open: false })} entryId={sheet.id} />
    </Page>
  );
}

const WD = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

export function CalendarView({ entries, onOpen }: { entries: MoodEntry[]; onOpen: (id: string) => void }) {
  const data = useData();
  const labels = data.preferences.valenceLabels;
  const ws = data.preferences.weekStartsOn;
  const [month, setMonth] = useState(() => {
    const n = new Date();
    return new Date(n.getFullYear(), n.getMonth(), 1);
  });
  const [selected, setSelected] = useState<string | null>(dayKey(new Date()));
  const cal = useMemo(() => calendarMap(entries), [entries]);
  const start = startOfWeek(month, ws);
  const cells = Array.from({ length: 42 }, (_, i) => addDays(start, i));
  const today = dayKey(new Date());
  const selEntries = selected ? entries.filter((e) => dayKey(e.at) === selected).sort((a, b) => a.at.localeCompare(b.at)) : [];
  const monthEntries = entries.filter((e) => {
    const d = new Date(e.at);
    return d.getMonth() === month.getMonth() && d.getFullYear() === month.getFullYear();
  });

  return (
    <div style={{ marginTop: 18 }}>
      <div className="row between" style={{ marginBottom: 10 }}>
        <button className="icon-btn" aria-label="Mês anterior" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}>
          <ChevronLeft size={20} />
        </button>
        <div className="h3">
          {fmtMonth(month).replace(/^./, (c) => c.toUpperCase())}
        </div>
        <button className="icon-btn" aria-label="Próximo mês" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}>
          <ChevronRight size={20} />
        </button>
      </div>
      <div className="cal" role="grid" aria-label="Calendário emocional">
        {Array.from({ length: 7 }, (_, i) => (
          <div key={i} className="wd" aria-hidden>
            {WD[(i + ws) % 7]}
          </div>
        ))}
        {cells.map((d) => {
          const k = dayKey(d);
          const vals = cal.get(k) ?? [];
          const out = d.getMonth() !== month.getMonth();
          return (
            <button
              key={k}
              className={`day${out ? ' out' : ''}${k === today ? ' today' : ''}`}
              style={selected === k ? { borderColor: 'var(--ink)', background: 'var(--surface-2)' } : undefined}
              onClick={() => setSelected(k)}
              aria-label={`${d.getDate()}: ${vals.length ? vals.map((v) => valenceLabel(v, labels)).join(', ') : 'sem registros'}`}
            >
              <span>{d.getDate()}</span>
              <span className="dots">
                {vals.slice(0, 6).map((v, i) => (
                  <span key={i} className="dot xs" style={{ background: `var(--mood-${v + 3})` }} />
                ))}
              </span>
            </button>
          );
        })}
      </div>
      <div className="chart-legend">
        {VALENCE_VALUES.map((v) => (
          <span key={v}>
            <span className="dot xs" style={{ background: `var(--mood-${v + 3})` }} />
            {valenceLabel(v, labels)}
          </span>
        ))}
      </div>
      <p className="small muted" style={{ marginTop: 12 }}>
        {monthEntries.length} registro(s) neste mês, em {new Set(monthEntries.map((e) => dayKey(e.at))).size} dia(s).
      </p>
      {selected && (
        <div style={{ marginTop: 14 }}>
          <p className="kicker">{relativeDay(selected + 'T12:00:00')}</p>
          {selEntries.length ? (
            <div className="list">
              {selEntries.map((m) => (
                <button key={m.id} className="list-row" onClick={() => onOpen(m.id)}>
                  <ValenceMark v={m.valence} size={20} />
                  <div className="grow">
                    <div className="title">{valenceLabel(m.valence, labels)}</div>
                    {m.note && <div className="meta">{m.note.slice(0, 120)}</div>}
                  </div>
                  <span className="xs faint">{fmtTime(m.at)}</span>
                </button>
              ))}
            </div>
          ) : (
            <p className="small faint">Nenhum registro neste dia.</p>
          )}
        </div>
      )}
    </div>
  );
}

export { fold };
