import { useEffect, useMemo, useState } from 'react';
import { ChevronLeft, ChevronRight, Feather, Flag, Plus, Search, SlidersHorizontal } from 'lucide-react';
import { navigate, setQuery, useRoute } from '../../app/router';
import { useSharedFilters } from '../../app/filters';
import { useData } from '../../app/store';
import { energyLabel, valenceLabel, VALENCE_VALUES } from '../../domain/scales';
import type { Experience, LifeEvent, MoodEntry } from '../../domain/schema';
import { activeCount, contextFor, describeFilters, isRetro, matchEvent, matchExperience, matchMood, NO_FILTERS, periodDays } from '../../domain/filters';
import { addDays, dayKey, startOfWeek } from '../../domain/util';
import { dayResult } from '../../domain/valence';
import { Empty, fmtDate, fmtMonth, Page, relativeDay, Segmented, Sheet } from '../../ui/components';
import { FilterSheet, FilterSummary } from '../../ui/FilterSheet';
import { MoodDot, TagList, ValenceMark } from '../../ui/pickers';
import { periodOfHour } from '../../ui/WhenPicker';
import { EventIcon, eventRange } from './EventEditor';
import { MoodSheet } from './MoodSheet';

type Item = { kind: 'mood'; day: string; at: string; m: MoodEntry } | { kind: 'exp'; day: string; at: string; x: Experience } | { kind: 'event'; day: string; at: string; e: LifeEvent };

/** Horário exibido conforme a precisão registrada. */
export function timeLabel(at: string, precision: MoodEntry['timePrecision']) {
  if (precision === 'day') return 'sem horário';
  if (precision === 'period') return periodOfHour(Number(at.slice(11, 13))).label.toLowerCase();
  return at.slice(11, 16);
}

export function RetroBadge({ createdAt, at }: { createdAt: string; at: string }) {
  if (!isRetro(createdAt, at)) return null;
  return (
    <span className="xs faint" title={`Escrito em ${fmtDate(createdAt, { withYear: true })}`}>
      · escrito em {fmtDate(createdAt)}
    </span>
  );
}

/** Folha "Registrar" com as três opções, opcionalmente para um dia específico. */
export function AddSheet({ open, onClose, day, onMood }: { open: boolean; onClose: () => void; day: string | null; onMood: () => void }) {
  const q = day ? `?dia=${day}` : '';
  return (
    <Sheet open={open} onClose={onClose} title={day && day !== dayKey(new Date()) ? `Registrar em ${fmtDate(day)}` : 'Registrar'}>
      <div className="stack">
        <button
          className="card row"
          onClick={() => {
            onClose();
            onMood();
          }}
        >
          <ValenceMark v={1} size={26} />
          <div className="grow">
            <div className="h3">Humor</div>
            <div className="small muted">Como você estava — rápido, com detalhes opcionais.</div>
          </div>
        </button>
        <button
          className="card row"
          onClick={() => {
            onClose();
            navigate(`/diario/experiencia/nova${q}`);
          }}
        >
          <Feather size={24} />
          <div className="grow">
            <div className="h3">Experiência</div>
            <div className="small muted">Um acontecimento: o que houve, o que ajudou, o que aprendeu.</div>
          </div>
        </button>
        <button
          className="card row"
          onClick={() => {
            onClose();
            navigate(`/diario/acontecimento/novo${q}`);
          }}
        >
          <Flag size={24} />
          <div className="grow">
            <div className="h3">Acontecimento</div>
            <div className="small muted">Um marco na linha do tempo: viagem, mudança, conquista, começo ou fim de algo.</div>
          </div>
        </button>
      </div>
    </Sheet>
  );
}

export function Journal() {
  const data = useData();
  const route = useRoute();
  const view = (route.query.get('v') as 'lista' | 'calendario') || 'lista';
  const [sheet, setSheet] = useState<{ open: boolean; id: string | null; day: string | null }>({ open: false, id: null, day: null });
  const [add, setAdd] = useState<{ open: boolean; day: string | null }>({ open: false, day: null });
  const [filtersOpen, setFiltersOpen] = useState(false);
  const [f, setF] = useSharedFilters();
  const [limit, setLimit] = useState(30);
  const labels = data.preferences.valenceLabels;
  const ctx = useMemo(() => contextFor(data), [data]);

  // Links vindos de outras telas (ex.: período de um acontecimento).
  useEffect(() => {
    const de = route.query.get('de');
    const ate = route.query.get('ate');
    const valencia = route.query.get('valencia');
    const vq = valencia !== null && /^-?[0-2]$/.test(valencia) ? [Number(valencia)] : [];
    if (de && ate) setF({ ...NO_FILTERS, period: 'custom', from: de, to: ate, valences: vq, type: vq.length ? 'mood' : 'all' });
    const emocao = route.query.get('emocao');
    if (emocao) setF({ ...NO_FILTERS, emotions: [emocao] });
    const registro = route.query.get('registro');
    if (registro) setSheet({ open: true, id: registro, day: null });
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [route.query.get('registro'), route.query.get('emocao'), route.query.get('de'), route.query.get('ate'), route.query.get('valencia')]);

  const active = activeCount(f);
  const items = useMemo(() => {
    const range = periodDays(f);
    const out: Item[] = [];
    for (const m of data.moodEntries) if (matchMood(m, f, ctx, range)) out.push({ kind: 'mood', day: m.at.slice(0, 10), at: m.at, m });
    for (const x of data.experiences) if (matchExperience(x, f, ctx, data, range)) out.push({ kind: 'exp', day: x.at.slice(0, 10), at: x.at, x });
    for (const e of data.events) if (matchEvent(e, f, range)) out.push({ kind: 'event', day: e.date, at: `${e.date}T23:59:59`, e });
    return out.sort((a, b) => b.at.localeCompare(a.at));
  }, [data, f, ctx]);

  const days = useMemo(() => {
    const map = new Map<string, Item[]>();
    for (const it of items) map.set(it.day, [...(map.get(it.day) ?? []), it]);
    return [...map.entries()];
  }, [items]);

  return (
    <Page
      title="Diário"
      ghost="diário"
      subtitle="Humor, experiências e acontecimentos — de hoje ou de antes."
      actions={
        <>
          <button className="icon-btn" aria-label="Buscar em tudo" onClick={() => navigate('/busca')}>
            <Search size={21} strokeWidth={1.6} />
          </button>
          <button className="icon-btn" aria-label={`Filtros${active ? ` (${active} ativos)` : ''}`} onClick={() => setFiltersOpen(true)} style={active ? { color: 'var(--primary-ink)' } : undefined}>
            <SlidersHorizontal size={21} strokeWidth={1.6} />
          </button>
          <button className="icon-btn filled" aria-label="Novo registro" onClick={() => setAdd({ open: true, day: null })}>
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

      <FilterSummary items={describeFilters(f, data, (v) => valenceLabel(v, labels))} onClear={() => setF(NO_FILTERS)} />
      {active > 0 && <p className="xs muted" style={{ margin: '6px 0 0' }}>{items.length} resultado(s)</p>}

      {view === 'calendario' ? (
        <CalendarView
          entries={items.filter((i): i is Extract<Item, { kind: 'mood' }> => i.kind === 'mood').map((i) => i.m)}
          events={items.filter((i): i is Extract<Item, { kind: 'event' }> => i.kind === 'event').map((i) => i.e)}
          experiences={items.filter((i): i is Extract<Item, { kind: 'exp' }> => i.kind === 'exp').map((i) => i.x)}
          onOpen={(id) => setSheet({ open: true, id, day: null })}
          onAdd={(day) => setAdd({ open: true, day })}
        />
      ) : days.length === 0 ? (
        <div style={{ marginTop: 20 }}>
          <Empty
            title={active ? 'Nada encontrado' : 'Ainda não há registros'}
            action={
              !active && (
                <button className="btn primary" onClick={() => setAdd({ open: true, day: null })}>
                  Fazer um registro
                </button>
              )
            }
          >
            {active ? 'Tente ajustar os filtros.' : 'Registre quando quiser — inclusive coisas de dias anteriores. Não há sequência a manter.'}
          </Empty>
        </div>
      ) : (
        <div>
          {days.slice(0, limit).map(([k, list]) => (
            <div key={k}>
              <div className="day-head">
                <span className="d">{relativeDay(k + 'T12:00:00')}</span>
              </div>
              <div className="list">
                {list.map((it) =>
                  it.kind === 'mood' ? (
                    <MoodRow key={it.m.id} m={it.m} onOpen={() => setSheet({ open: true, id: it.m.id, day: null })} />
                  ) : it.kind === 'exp' ? (
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
                        <div className="xs faint">
                          {timeLabel(it.x.at, it.x.timePrecision)} <RetroBadge createdAt={it.x.createdAt} at={it.x.at} />
                        </div>
                      </div>
                    </button>
                  ) : (
                    <button key={it.e.id} className="list-row" onClick={() => navigate(`/diario/acontecimento/${it.e.id}`)} style={{ background: 'var(--accent-soft)' }}>
                      <span className="vmark" style={{ width: 22, height: 22, color: 'var(--accent-ink)' }}>
                        <EventIcon c={it.e.category} />
                      </span>
                      <div className="grow">
                        <div className="title">{it.e.title}</div>
                        <div className="meta">Acontecimento · {eventRange(it.e)}</div>
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

      <AddSheet open={add.open} day={add.day} onClose={() => setAdd({ open: false, day: add.day })} onMood={() => setSheet({ open: true, id: null, day: add.day })} />
      <FilterSheet open={filtersOpen} onClose={() => setFiltersOpen(false)} value={f} onChange={setF} resultLabel={`Ver ${items.length} resultado(s)`} />
      <MoodSheet open={sheet.open} onClose={() => setSheet({ ...sheet, open: false })} entryId={sheet.id} initialDay={sheet.day} />
    </Page>
  );
}

export function MoodRow({ m, onOpen }: { m: MoodEntry; onOpen: () => void }) {
  const data = useData();
  const ctx = useMemo(() => contextFor(data), [data]);
  return (
    <button className="list-row" onClick={onOpen}>
      <MoodDot v={m.valence} title={valenceLabel(m.valence, data.preferences.valenceLabels)} />
      <div className="grow">
        <div className="title">{valenceLabel(m.valence, data.preferences.valenceLabels)}</div>
        <div className="meta">
          {[m.emotionIds.map(ctx.emotionLabel).filter(Boolean).join(', '), m.energy ? energyLabel(m.energy, data.preferences.energyLabels) : '', m.itemIds.map(ctx.itemName).filter(Boolean).join(', ')]
            .filter(Boolean)
            .join(' · ')}
        </div>
        {m.note && (
          <div className="small" style={{ marginTop: 4, display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
            {m.note}
          </div>
        )}
        {m.tags.length > 0 && (
          <div style={{ marginTop: 6 }}>
            <TagList tags={m.tags} />
          </div>
        )}
        {isRetro(m.createdAt, m.at) && (
          <div className="xs faint" style={{ marginTop: 4 }}>
            Escrito em {fmtDate(m.createdAt)}
          </div>
        )}
      </div>
      <span className="xs faint" style={{ whiteSpace: 'nowrap' }}>
        {timeLabel(m.at, m.timePrecision)}
      </span>
    </button>
  );
}

const WD = ['D', 'S', 'T', 'Q', 'Q', 'S', 'S'];

export function CalendarView({
  entries,
  events = [],
  experiences = [],
  onOpen,
  onAdd,
}: {
  entries: MoodEntry[];
  events?: LifeEvent[];
  experiences?: Experience[];
  onOpen: (id: string) => void;
  onAdd?: (day: string) => void;
}) {
  const data = useData();
  const labels = data.preferences.valenceLabels;
  const ws = data.preferences.weekStartsOn;
  const [month, setMonth] = useState(() => {
    const n = new Date();
    return new Date(n.getFullYear(), n.getMonth(), 1);
  });
  const [selected, setSelected] = useState<string | null>(dayKey(new Date()));
  // Agrupado pelo dia em que aconteceu (`at`), em ordem de horário.
  const cal = useMemo(() => {
    const map = new Map<string, number[]>();
    for (const e of [...entries].sort((a, b) => a.at.localeCompare(b.at))) map.set(e.at.slice(0, 10), [...(map.get(e.at.slice(0, 10)) ?? []), e.valence]);
    return map;
  }, [entries]);
  const start = startOfWeek(month, ws);
  const cells = Array.from({ length: 42 }, (_, i) => addDays(start, i));
  const today = dayKey(new Date());
  const eventOn = (k: string) => events.filter((e) => k >= e.date && k <= (e.endDate ?? e.date));
  const selEntries = selected ? entries.filter((e) => e.at.slice(0, 10) === selected).sort((a, b) => a.at.localeCompare(b.at)) : [];
  const selExps = selected ? experiences.filter((x) => x.at.slice(0, 10) === selected) : [];
  const selEvents = selected ? eventOn(selected) : [];
  const monthKey = `${month.getFullYear()}-${String(month.getMonth() + 1).padStart(2, '0')}`;
  const monthEntries = entries.filter((e) => e.at.startsWith(monthKey));

  return (
    <div style={{ marginTop: 18 }}>
      <div className="row between" style={{ marginBottom: 10 }}>
        <button className="icon-btn" aria-label="Mês anterior" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() - 1, 1))}>
          <ChevronLeft size={20} />
        </button>
        <div className="h3">{fmtMonth(month).replace(/^./, (c) => c.toUpperCase())}</div>
        <button className="icon-btn" aria-label="Próximo mês" onClick={() => setMonth(new Date(month.getFullYear(), month.getMonth() + 1, 1))}>
          <ChevronRight size={20} />
        </button>
      </div>
      <div className="cal" role="group" aria-label="Calendário emocional">
        {Array.from({ length: 7 }, (_, i) => (
          <div key={i} className="wd" aria-hidden>
            {WD[(i + ws) % 7]}
          </div>
        ))}
        {cells.map((d) => {
          const k = dayKey(d);
          const vals = cal.get(k) ?? [];
          // Um símbolo por data: o resultado do dia (média arredondada). Os registros não mudam.
          const res = dayResult(vals);
          const out = d.getMonth() !== month.getMonth();
          const evs = eventOn(k);
          return (
            <button
              key={k}
              className={`day${out ? ' out' : ''}${k === today ? ' today' : ''}`}
              style={{ ...(selected === k ? { borderColor: 'var(--ink)', background: 'var(--surface-2)' } : {}), ...(evs.length ? { boxShadow: 'inset 0 3px 0 var(--accent-ink)' } : {}) }}
              onClick={() => setSelected(k)}
              aria-label={`${d.getDate()}: ${
                vals.length
                  ? `${valenceLabel(res!, labels)}${vals.length > 1 ? ` (resultado de ${vals.length} registros: ${vals.map((v) => valenceLabel(v, labels)).join(', ')})` : ''}`
                  : 'sem registros de humor'
              }${evs.length ? `; ${evs.map((e) => e.title).join(', ')}` : ''}`}
            >
              <span className="row between" style={{ width: '100%' }}>
                <span>{d.getDate()}</span>
                {vals.length > 1 && <span className="cal-n" aria-hidden>{vals.length}</span>}
              </span>
              <span className="cal-mark">{res !== null && <ValenceMark v={res} size={26} />}</span>
            </button>
          );
        })}
      </div>
      <div className="chart-legend">
        {VALENCE_VALUES.map((v) => (
          <span key={v}>
            <ValenceMark v={v} size={16} />
            {valenceLabel(v, labels)}
          </span>
        ))}
        {events.length > 0 && (
          <span>
            <span style={{ width: 14, height: 3, background: 'var(--accent-ink)', display: 'inline-block' }} /> acontecimento
          </span>
        )}
      </div>
      <p className="small muted" style={{ marginTop: 12 }}>
        {monthEntries.length} registro(s) de humor neste mês, em {new Set(monthEntries.map((e) => e.at.slice(0, 10))).size} dia(s). Com mais de um registro, o símbolo é o resultado
        do dia (a média arredondada ao nível mais próximo; no empate, para longe do neutro) e o número indica quantos registros há. Toque no dia para ver cada um. Dias sem registro
        ficam em branco — não contam como neutros.
      </p>
      {selected && (
        <div style={{ marginTop: 14 }}>
          <div className="row between">
            <p className="kicker" style={{ margin: 0 }}>
              {relativeDay(selected + 'T12:00:00')}
            </p>
            {onAdd && selected <= today && (
              <button className="btn ghost sm" onClick={() => onAdd(selected)}>
                <Plus size={14} /> Registrar neste dia
              </button>
            )}
          </div>
          <div className="stack" style={{ marginTop: 8 }}>
            {selEvents.map((e) => (
              <button key={e.id} className="card tight row" style={{ background: 'var(--accent-soft)' }} onClick={() => navigate(`/diario/acontecimento/${e.id}`)}>
                <EventIcon c={e.category} />
                <div className="grow">
                  <div style={{ fontWeight: 600 }}>{e.title}</div>
                  <div className="xs muted">{eventRange(e)}</div>
                </div>
              </button>
            ))}
            {selEntries.length > 0 && (
              <div className="list">
                {selEntries.map((m) => (
                  <MoodRow key={m.id} m={m} onOpen={() => onOpen(m.id)} />
                ))}
              </div>
            )}
            {selExps.map((x) => (
              <button key={x.id} className="card tight row" onClick={() => navigate(`/diario/experiencia/${x.id}`)}>
                <Feather size={16} />
                <span className="grow">{x.title || 'Experiência'}</span>
              </button>
            ))}
            {!selEntries.length && !selExps.length && !selEvents.length && <p className="small faint">Nenhum registro neste dia.</p>}
          </div>
        </div>
      )}
    </div>
  );
}
