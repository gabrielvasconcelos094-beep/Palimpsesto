import { useMemo, useState } from 'react';
import { Feather, Plus, Trash2 } from 'lucide-react';
import { goBack, navigate, setQuery, useRoute } from '../../app/router';
import { store, useData } from '../../app/store';
import { toast } from '../../app/toast';
import { outcomeCounts, outcomesByContext } from '../../domain/analytics';
import { FREQUENCY_LABELS, KIND_LABELS, OUTCOME_LABELS, OUTCOME_ORDER } from '../../domain/scales';
import type { Outcome, RepertoireItem, RepertoireKind, StrategyUse } from '../../domain/schema';
import { DRAIN_CATEGORIES, RESOURCE_CATEGORIES, STRATEGY_CATEGORIES } from '../../domain/seed';
import { fold } from '../../domain/util';
import { AutoText, Empty, Field, fmtDate, fromLocalInput, Page, Section, Segmented, Sheet, toLocalInput, Toggle, useConfirm } from '../../ui/components';
import { TagInput, TagList } from '../../ui/pickers';
import { useAutosave } from '../../ui/useAutosave';

export const OUTCOME_COLORS: Record<Outcome, string> = {
  worked: 'var(--mood-5)',
  partial: 'var(--mood-4)',
  didnt: 'var(--mood-3)',
  worse: 'var(--mood-1)',
  unknown: 'var(--line-strong)',
};

export function OutcomeBar({ counts }: { counts: Record<Outcome, number> }) {
  const total = OUTCOME_ORDER.reduce((a, o) => a + counts[o], 0);
  if (!total) return null;
  return (
    <div className="stackbar" role="img" aria-label={OUTCOME_ORDER.filter((o) => counts[o]).map((o) => `${OUTCOME_LABELS[o]}: ${counts[o]}`).join(', ')}>
      {OUTCOME_ORDER.filter((o) => counts[o]).map((o) => (
        <div key={o} style={{ width: `${(counts[o] / total) * 100}%`, background: OUTCOME_COLORS[o] }} />
      ))}
    </div>
  );
}

export function OutcomeLegend() {
  return (
    <div className="chart-legend">
      {OUTCOME_ORDER.map((o) => (
        <span key={o}>
          <span className="dot xs" style={{ background: OUTCOME_COLORS[o] }} />
          {OUTCOME_LABELS[o]}
        </span>
      ))}
    </div>
  );
}

const CATS: Record<RepertoireKind, string[]> = { resource: RESOURCE_CATEGORIES, strategy: STRATEGY_CATEGORIES, drain: DRAIN_CATEGORIES };

export function RepertoireTab() {
  const data = useData();
  const route = useRoute();
  const kind = (route.query.get('k') as RepertoireKind) || 'resource';
  const [ctx, setCtx] = useState<string | null>(null);

  const contexts = useMemo(() => {
    const m = new Map<string, string>();
    for (const u of data.uses) for (const t of u.tags) m.set(fold(t), t);
    for (const i of data.repertoire) for (const t of i.tags) m.set(fold(t), t);
    return [...m.values()].slice(0, 30);
  }, [data.uses, data.repertoire]);

  const items = data.repertoire
    .filter((i) => i.kind === kind && !i.archived)
    .filter((i) => !ctx || i.tags.some((t) => fold(t) === fold(ctx)) || data.uses.some((u) => u.itemId === i.id && u.tags.some((t) => fold(t) === fold(ctx))))
    .map((i) => {
      const uses = data.uses.filter((u) => u.itemId === i.id && (!ctx || u.tags.some((t) => fold(t) === fold(ctx))));
      return { i, uses, counts: outcomeCounts(uses) };
    })
    .sort((a, b) => b.uses.length - a.uses.length || a.i.name.localeCompare(b.i.name));

  return (
    <div style={{ marginTop: 16 }}>
      <Segmented
        ariaLabel="Tipo"
        value={kind}
        onChange={(k) => setQuery('k', k)}
        options={[
          { value: 'resource', label: 'Faz bem' },
          { value: 'strategy', label: 'Estratégias' },
          { value: 'drain', label: 'Desgasta' },
        ]}
      />
      <p className="small muted" style={{ margin: '12px 2px' }}>
        {KIND_LABELS[kind].hint}
      </p>
      {kind !== 'drain' && contexts.length > 0 && (
        <div style={{ marginBottom: 14 }}>
          <p className="kicker">Consultar por circunstância</p>
          <div className="chips">
            {contexts.map((t) => (
              <button key={t} className="chip tag" aria-pressed={ctx === t} onClick={() => setCtx(ctx === t ? null : t)}>
                {t}
              </button>
            ))}
          </div>
        </div>
      )}
      {items.length === 0 ? (
        <Empty
          title={ctx ? `Nada registrado para “${ctx}”` : 'Ainda vazio'}
          action={
            <button className="btn primary" onClick={() => navigate(`/guia/item/novo?tipo=${kind}`)}>
              Adicionar
            </button>
          }
        >
          {kind === 'resource' && 'Ler, caminhar, uma pessoa, um lugar, cuidar de plantas…'}
          {kind === 'strategy' && 'O que você já tentou em momentos difíceis — e como funcionou em cada situação.'}
          {kind === 'drain' && 'Situações desgastantes, hábitos que pesam, circunstâncias que pedem cuidado.'}
        </Empty>
      ) : (
        <div className="stack">
          {items.map(({ i, uses, counts }) => (
            <button key={i.id} className="card tight" onClick={() => navigate(`/guia/item/${i.id}`)}>
              <div className="row between">
                <span className="h3">{i.name}</span>
                {i.category && <span className="chip static">{i.category}</span>}
              </div>
              {(i.circumstances || i.description) && (
                <p className="small muted" style={{ margin: '4px 0 0', display: '-webkit-box', WebkitLineClamp: 2, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                  {i.circumstances || i.description}
                </p>
              )}
              {uses.length > 0 && (
                <div style={{ marginTop: 10 }}>
                  <OutcomeBar counts={counts} />
                  <p className="xs faint" style={{ margin: '6px 0 0' }}>
                    {uses.length} uso(s){ctx ? ` em “${ctx}”` : ''} · funcionou ao menos em parte em {counts.worked + counts.partial}
                  </p>
                </div>
              )}
              {kind === 'drain' && i.wantToChange && <p className="xs" style={{ margin: '8px 0 0', color: 'var(--accent-ink)' }}>Quero modificar</p>}
            </button>
          ))}
          {items.some((x) => x.uses.length) && <OutcomeLegend />}
        </div>
      )}
      <button className="btn secondary block" style={{ marginTop: 16 }} onClick={() => navigate(`/guia/item/novo?tipo=${kind}`)}>
        <Plus size={16} /> {KIND_LABELS[kind].singular}
      </button>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Item do repertório                                                  */
/* ------------------------------------------------------------------ */
type Draft = Omit<RepertoireItem, 'id' | 'createdAt' | 'updatedAt'>;

export function ItemPage() {
  const route = useRoute();
  const id = route.parts[2];
  const exists = useData().repertoire.some((i) => i.id === id);
  if (id !== 'novo' && !exists)
    return (
      <Page back="/guia" title="Item não encontrado" noNav>
        <span />
      </Page>
    );
  return <ItemEditor />;
}

function ItemEditor() {
  const route = useRoute();
  const data = useData();
  const paramId = route.parts[2];
  const existing = paramId !== 'novo' ? data.repertoire.find((i) => i.id === paramId) : undefined;
  const [draft, setDraft] = useState<Draft>(() =>
    existing
      ? { ...existing }
      : {
          kind: (route.query.get('tipo') as RepertoireKind) || 'resource',
          name: '',
          description: '',
          category: '',
          circumstances: '',
          effect: '',
          perceivedFrequency: null,
          notes: '',
          wantToChange: false,
          tags: [],
          archived: false,
        },
  );
  const [useSheet, setUseSheet] = useState<{ open: boolean; use: StrategyUse | null }>({ open: false, use: null });
  const { ask, node } = useConfirm();
  const auto = useAutosave('repertoire', draft, {
    initialId: existing?.id ?? null,
    meaningful: (d: Draft) => !!d.name.trim(),
    onCreated: (nid) => navigate(`/guia/item/${nid}`, { replace: true }),
  });
  const set = (p: Partial<Draft>) => setDraft((d) => ({ ...d, ...p }));
  const itemId = auto.id.current;
  const uses = itemId ? data.uses.filter((u) => u.itemId === itemId).sort((a, b) => b.at.localeCompare(a.at)) : [];
  const byCtx = outcomesByContext(uses);
  const isDrain = draft.kind === 'drain';

  return (
    <Page
      back={`/guia?t=repertorio&k=${draft.kind}`}
      noNav
      kicker={KIND_LABELS[draft.kind].singular}
      actions={
        itemId && (
          <button
            className="icon-btn"
            aria-label="Excluir"
            style={{ color: 'var(--danger)' }}
            onClick={async () => {
              if (
                await ask({
                  title: `Excluir “${draft.name}”?`,
                  body: uses.length ? `Os ${uses.length} uso(s) e avaliações registrados também serão excluídos.` : 'O item será excluído.',
                  confirm: 'Excluir',
                  danger: true,
                })
              ) {
                auto.cancel();
                store.remove('repertoire', itemId);
                toast('Item excluído.');
                goBack('/guia');
              }
            }}
          >
            <Trash2 size={20} />
          </button>
        )
      }
    >
      <div className="stack lg" style={{ marginTop: 8 }}>
        <Field label="Nome">
          <input
            className="input"
            style={{ fontFamily: 'var(--font-display)', fontSize: 'var(--fs-xl)', padding: '10px 12px' }}
            value={draft.name}
            maxLength={200}
            autoFocus={!existing}
            onChange={(e) => set({ name: e.target.value })}
            placeholder={isDrain ? 'Ex.: Agenda cheia demais' : 'Ex.: Ouvir música com fones'}
          />
        </Field>
        <Field label="Tipo">
          <Segmented
            value={draft.kind}
            onChange={(kind) => set({ kind })}
            options={[
              { value: 'resource', label: 'Faz bem' },
              { value: 'strategy', label: 'Estratégia' },
              { value: 'drain', label: 'Desgasta' },
            ]}
          />
        </Field>
        <Field label="Categoria" optional>
          <div className="chips">
            {CATS[draft.kind].map((c) => (
              <button key={c} className="chip" aria-pressed={draft.category === c} onClick={() => set({ category: draft.category === c ? '' : c })}>
                {c}
              </button>
            ))}
          </div>
        </Field>
        <Field label="Descrição" optional>
          <AutoText value={draft.description} onChange={(description) => set({ description })} minRows={2} />
        </Field>
        <Field label={isDrain ? 'Em quais circunstâncias costuma aparecer?' : 'Em quais circunstâncias costuma ajudar?'} optional>
          <AutoText value={draft.circumstances} onChange={(circumstances) => set({ circumstances })} minRows={2} />
        </Field>
        <Field label={isDrain ? 'Que efeito costuma ter em você?' : 'Que efeito costuma produzir?'} optional>
          <AutoText value={draft.effect} onChange={(effect) => set({ effect })} minRows={2} />
        </Field>
        <Field label={isDrain ? 'Com que frequência pesa?' : 'Com que frequência costuma funcionar?'} optional>
          <div className="chips">
            {FREQUENCY_LABELS.map((l, i) => (
              <button key={l} className="chip" aria-pressed={draft.perceivedFrequency === i + 1} onClick={() => set({ perceivedFrequency: draft.perceivedFrequency === i + 1 ? null : i + 1 })}>
                {l}
              </button>
            ))}
          </div>
        </Field>
        {isDrain && (
          <div className="list">
            <Toggle label="Gostaria de modificar isso" checked={draft.wantToChange} onChange={(wantToChange) => set({ wantToChange })} />
          </div>
        )}
        <Field label="Observações pessoais" optional>
          <AutoText value={draft.notes} onChange={(notes) => set({ notes })} minRows={2} />
        </Field>
        <Field label="Marcadores" optional help="Contextos em que isso costuma importar — usados pelas Situações.">
          <TagInput value={draft.tags} onChange={(tags) => set({ tags })} />
        </Field>

        {!isDrain && itemId && (
          <Section kicker="Usos e avaliações" action={<button className="btn ghost sm" onClick={() => setUseSheet({ open: true, use: null })}><Plus size={14} /> Registrar uso</button>}>
            {uses.length === 0 ? (
              <p className="small muted">
                Cada vez que usar, registre como funcionou <em>naquela</em> circunstância. Uma estratégia pode ajudar em um contexto e não em outro.
              </p>
            ) : (
              <div className="stack">
                <div className="card tight">
                  <p className="kicker">Por circunstância</p>
                  <div className="stack" style={{ gap: 12 }}>
                    {byCtx.map((g) => (
                      <div key={g.tag}>
                        <div className="row between small">
                          <span>{g.tag}</span>
                          <span className="faint xs">{g.n} uso(s)</span>
                        </div>
                        <div style={{ marginTop: 4 }}>
                          <OutcomeBar counts={g.counts} />
                        </div>
                      </div>
                    ))}
                  </div>
                  <OutcomeLegend />
                </div>
                <div className="list">
                  {uses.map((u) => {
                    const exp = u.experienceId ? data.experiences.find((x) => x.id === u.experienceId) : undefined;
                    return (
                      <button key={u.id} className="list-row" onClick={() => (exp ? navigate(`/diario/experiencia/${exp.id}`) : setUseSheet({ open: true, use: u }))}>
                        <span className="dot sm" style={{ background: OUTCOME_COLORS[u.outcome] }} />
                        <div className="grow">
                          <div className="title">{OUTCOME_LABELS[u.outcome]}</div>
                          <div className="meta">
                            {fmtDate(u.at)}
                            {exp ? ` · na experiência “${exp.title || 'sem título'}”` : ''}
                            {u.note ? ` · ${u.note}` : ''}
                          </div>
                          {u.tags.length > 0 && (
                            <div style={{ marginTop: 4 }}>
                              <TagList tags={u.tags} />
                            </div>
                          )}
                        </div>
                        {exp && <Feather size={14} className="faint" />}
                      </button>
                    );
                  })}
                </div>
              </div>
            )}
          </Section>
        )}
        <button
          className="btn primary block"
          disabled={!draft.name.trim()}
          onClick={() => {
            auto.saveNow();
            goBack(`/guia?t=repertorio&k=${draft.kind}`);
          }}
        >
          Concluir
        </button>
      </div>
      {itemId && <UseSheet open={useSheet.open} use={useSheet.use} itemId={itemId} onClose={() => setUseSheet({ open: false, use: null })} />}
      {node}
    </Page>
  );
}

function UseSheet(props: { open: boolean; onClose: () => void; itemId: string; use: StrategyUse | null }) {
  return (
    <Sheet open={props.open} onClose={props.onClose} title={props.use ? 'Editar uso' : 'Registrar uso'}>
      {props.open && <UseForm key={props.use?.id ?? 'new'} {...props} />}
    </Sheet>
  );
}

function UseForm(props: { onClose: () => void; itemId: string; use: StrategyUse | null }) {
  const [at, setAt] = useState(props.use?.at ?? new Date().toISOString());
  const [outcome, setOutcome] = useState<Outcome>(props.use?.outcome ?? 'unknown');
  const [tags, setTags] = useState<string[]>(props.use?.tags ?? []);
  const [note, setNote] = useState(props.use?.note ?? '');
  return (
    <div className="stack lg">
      <Field label="Como funcionou?">
        <div className="stack" style={{ gap: 6 }} role="radiogroup">
          {OUTCOME_ORDER.map((o) => (
            <button
              key={o}
              role="radio"
              aria-checked={outcome === o}
              className="chip"
              aria-pressed={outcome === o}
              onClick={() => setOutcome(o)}
              style={{ justifyContent: 'flex-start' }}
            >
              <span className="dot xs" style={{ background: OUTCOME_COLORS[o] }} /> {OUTCOME_LABELS[o]}
            </button>
          ))}
        </div>
      </Field>
      <Field label="Em que circunstância?" optional>
        <TagInput value={tags} onChange={setTags} placeholder="Ex.: dia difícil, viagem" />
      </Field>
      <Field label="Quando">
        <input type="datetime-local" className="input" value={toLocalInput(at)} onChange={(e) => setAt(fromLocalInput(e.target.value))} />
      </Field>
      <Field label="Observação" optional>
        <AutoText value={note} onChange={setNote} minRows={2} />
      </Field>
      <div className="row">
        {props.use && (
          <button
            className="icon-btn"
            aria-label="Excluir uso"
            style={{ color: 'var(--danger)' }}
            onClick={() => {
              store.remove('uses', props.use!.id);
              props.onClose();
            }}
          >
            <Trash2 size={20} />
          </button>
        )}
        <button
          className="btn primary block"
          onClick={() => {
            store.upsert('uses', { ...(props.use ?? { experienceId: null }), itemId: props.itemId, at, outcome, tags, note } as any);
            toast('Uso registrado.');
            props.onClose();
          }}
        >
          Salvar
        </button>
      </div>
    </div>
  );
}
