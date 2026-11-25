import { useState } from 'react';
import { Feather, Trash2, X } from 'lucide-react';
import { goBack, navigate, useRoute } from '../../app/router';
import { store, useData } from '../../app/store';
import { toast } from '../../app/toast';
import { CONFIDENCE_LABELS } from '../../domain/scales';
import { CONFIDENCE, type Confidence, type Discovery } from '../../domain/schema';
import { dayKey } from '../../domain/util';
import { AutoText, Empty, Field, fmtDate, Page, Section, Segmented, Sheet, useConfirm } from '../../ui/components';
import { TagInput, TagList } from '../../ui/pickers';
import { LAYER_AFTER_MS, useAutosave } from '../../ui/useAutosave';

export function ConfidenceBadge({ c }: { c: Confidence }) {
  const n = CONFIDENCE.indexOf(c) + 1;
  return (
    <span className="row xs" style={{ gap: 6, color: 'var(--ink-soft)' }} title={CONFIDENCE_LABELS[c].hint}>
      <span aria-hidden style={{ display: 'inline-flex', gap: 2 }}>
        {[1, 2, 3].map((i) => (
          <span key={i} className="dot xs" style={{ background: i <= n ? 'var(--primary-ink)' : 'var(--line-strong)' }} />
        ))}
      </span>
      {CONFIDENCE_LABELS[c].label}
    </span>
  );
}

export function DiscoveryList() {
  const data = useData();
  const [filter, setFilter] = useState<'active' | Confidence | 'superseded'>('active');
  const list = data.discoveries
    .filter((d) => (filter === 'superseded' ? d.status === 'superseded' : d.status === 'active' && (filter === 'active' || d.confidence === filter)))
    .sort((a, b) => b.at.localeCompare(a.at));
  const supersededCount = data.discoveries.filter((d) => d.status === 'superseded').length;
  return (
    <div style={{ marginTop: 16 }}>
      <div className="chips" style={{ marginBottom: 14 }}>
        {(
          [
            ['active', 'Todas'],
            ['hypothesis', 'Hipóteses'],
            ['recurring', 'Recorrentes'],
            ['consolidated', 'Consolidadas'],
            ...(supersededCount ? [['superseded', 'Superadas']] : []),
          ] as Array<[typeof filter, string]>
        ).map(([v, l]) => (
          <button key={v} className="chip" aria-pressed={filter === v} onClick={() => setFilter(v)}>
            {l}
          </button>
        ))}
      </div>
      {list.length === 0 ? (
        <Empty
          title="Nenhuma descoberta aqui"
          action={
            <button className="btn primary" onClick={() => navigate('/mapa/descoberta/nova')}>
              Anotar uma descoberta
            </button>
          }
        >
          Conclusões e hipóteses sobre você: “Descobri que preciso de tempo só depois de eventos sociais.” Elas podem ganhar ou perder força com o tempo.
        </Empty>
      ) : (
        <div className="stack">
          {list.map((d) => (
            <button key={d.id} className="card" onClick={() => navigate(`/mapa/descoberta/${d.id}`)}>
              <div className="row between" style={{ marginBottom: 6 }}>
                <ConfidenceBadge c={d.confidence} />
                <span className="xs faint">{fmtDate(d.at)}</span>
              </div>
              <p className="h3" style={{ margin: 0, textDecoration: d.status === 'superseded' ? 'line-through' : undefined }}>
                {d.title}
              </p>
              {d.description && (
                <p className="small muted" style={{ margin: '6px 0 0', display: '-webkit-box', WebkitLineClamp: 3, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                  {d.description}
                </p>
              )}
              {(d.tags.length > 0 || d.revisions.length > 0) && (
                <div className="row wrap" style={{ marginTop: 10 }}>
                  <TagList tags={d.tags} />
                  {d.revisions.length > 0 && <span className="xs faint">{d.revisions.length} camada(s)</span>}
                </div>
              )}
            </button>
          ))}
        </div>
      )}
    </div>
  );
}

type Draft = Omit<Discovery, 'id' | 'createdAt' | 'updatedAt'>;

export function DiscoveryPage() {
  const route = useRoute();
  const id = route.parts[2];
  const exists = useData().discoveries.some((d) => d.id === id);
  if (id !== 'nova' && !exists)
    return (
      <Page back="/mapa?t=descobertas" title="Descoberta não encontrada" noNav>
        <span />
      </Page>
    );
  return <DiscoveryEditor key={id === 'nova' ? 'nova' : 'edit'} />;
}

function DiscoveryEditor() {
  const route = useRoute();
  const data = useData();
  const paramId = route.parts[2];
  const existing = paramId !== 'nova' ? data.discoveries.find((d) => d.id === paramId) : undefined;
  const fromExp = route.query.get('de');
  const exp = fromExp ? data.experiences.find((x) => x.id === fromExp) : undefined;
  const [draft, setDraft] = useState<Draft>(() =>
    existing
      ? { ...existing }
      : {
          title: route.query.get('titulo') ?? '',
          description: exp?.learned ?? route.query.get('texto') ?? '',
          sectionId: null,
          at: dayKey(new Date()),
          tags: exp?.tags ?? [],
          confidence: 'hypothesis',
          status: 'active',
          revisions: [],
          experienceIds: exp ? [exp.id] : [],
          origin: exp ? 'experience' : route.query.get('origem') === 'padrao' ? 'pattern' : 'user',
        },
  );
  const [changeOpen, setChangeOpen] = useState(false);
  const [linkOpen, setLinkOpen] = useState(false);
  const { ask, node } = useConfirm();

  const auto = useAutosave('discoveries', draft, {
    initialId: existing?.id ?? null,
    meaningful: (d: Draft) => !!d.title.trim(),
    onCreated: (nid) => navigate(`/mapa/descoberta/${nid}`, { replace: true }),
    // Alterações em uma descoberta "assentada" guardam o estado anterior como camada.
    transform: (prev: any, d: Draft) => {
      if (!prev) return d;
      const settled = Date.now() - new Date(prev.updatedAt).getTime() > LAYER_AFTER_MS;
      const changed = prev.title !== d.title || prev.description !== d.description || prev.confidence !== d.confidence || prev.status !== d.status;
      if (settled && changed)
        return {
          ...d,
          revisions: [
            ...prev.revisions,
            { at: prev.updatedAt, title: prev.title, description: prev.description, confidence: prev.confidence, status: prev.status, note: '' },
          ],
        };
      return { ...d, revisions: prev.revisions };
    },
  });
  const set = (p: Partial<Draft>) => setDraft((d) => ({ ...d, ...p }));
  const saved = auto.id.current ? data.discoveries.find((d) => d.id === auto.id.current) : undefined;
  const revisions = saved?.revisions ?? [];
  const sections = [...data.sections].filter((s) => !s.hidden).sort((a, b) => a.order - b.order);
  const linked = draft.experienceIds.map((eid) => data.experiences.find((x) => x.id === eid)).filter(Boolean);

  return (
    <Page
      back="/mapa?t=descobertas"
      noNav
      kicker={saved ? `Registrada em ${fmtDate(saved.createdAt, { withYear: true })}` : 'Nova descoberta'}
      actions={
        saved && (
          <button
            className="icon-btn"
            aria-label="Excluir descoberta"
            style={{ color: 'var(--danger)' }}
            onClick={async () => {
              if (await ask({ title: 'Excluir esta descoberta?', body: 'Ela e todas as suas camadas serão excluídas.', confirm: 'Excluir', danger: true })) {
                auto.cancel();
                store.remove('discoveries', saved.id);
                goBack('/mapa?t=descobertas');
              }
            }}
          >
            <Trash2 size={20} />
          </button>
        )
      }
    >
      <div className="stack lg" style={{ marginTop: 8 }}>
        {draft.origin === 'pattern' && !saved && (
          <div className="notice calm small">
            Esta hipótese nasceu de uma associação observada pela Trajetória. Ela só vira uma descoberta sua se você quiser — ajuste o texto com suas palavras.
          </div>
        )}
        <Field label="Descobri que…">
          <AutoText writing value={draft.title} onChange={(title) => set({ title })} placeholder="preciso de tempo só depois de eventos sociais" minRows={2} autoFocus={!existing} maxLength={300} />
        </Field>
        <Field label="Descrição" optional>
          <AutoText value={draft.description} onChange={(description) => set({ description })} placeholder="Como percebeu, exemplos, nuances…" minRows={3} />
        </Field>
        <Field label="Quão firme é esta percepção?">
          <div className="stack" style={{ gap: 8 }} role="radiogroup">
            {CONFIDENCE.map((c) => (
              <button
                key={c}
                role="radio"
                aria-checked={draft.confidence === c}
                className="card tight"
                style={draft.confidence === c ? { borderColor: 'var(--ink)', background: 'var(--surface-2)' } : undefined}
                onClick={() => set({ confidence: c })}
              >
                <ConfidenceBadge c={c} />
                <div className="xs muted" style={{ marginTop: 4 }}>
                  {CONFIDENCE_LABELS[c].hint}
                </div>
              </button>
            ))}
          </div>
        </Field>
        {saved && (
          <button className="btn secondary" onClick={() => setChangeOpen(true)}>
            Minha percepção mudou…
          </button>
        )}
        <div className="grid-2">
          <Field label="Data">
            <input type="date" className="input" value={draft.at.slice(0, 10)} onChange={(e) => e.target.value && set({ at: e.target.value })} />
          </Field>
          <Field label="Ficha" optional>
            <select className="select" value={draft.sectionId ?? ''} onChange={(e) => set({ sectionId: e.target.value || null })}>
              <option value="">—</option>
              {sections.map((s) => (
                <option key={s.id} value={s.id}>
                  {s.title}
                </option>
              ))}
            </select>
          </Field>
        </div>
        <Field label="Marcadores" optional help="Fazem a descoberta aparecer em situações relacionadas (ex.: “viagem”, “encontro social”).">
          <TagInput value={draft.tags} onChange={(tags) => set({ tags })} />
        </Field>

        <Section kicker="Experiências que sustentam esta descoberta">
          {linked.length > 0 && (
            <div className="list" style={{ marginBottom: 10 }}>
              {linked.map((x) => (
                <div key={x!.id} className="list-row">
                  <Feather size={16} className="faint" />
                  <button className="grow" style={{ background: 'none', border: 0, textAlign: 'left', padding: 0 }} onClick={() => navigate(`/diario/experiencia/${x!.id}`)}>
                    <div className="title">{x!.title || 'Experiência'}</div>
                    <div className="meta">{fmtDate(x!.at)}</div>
                  </button>
                  <button className="icon-btn" aria-label="Desvincular" onClick={() => set({ experienceIds: draft.experienceIds.filter((e) => e !== x!.id) })}>
                    <X size={16} />
                  </button>
                </div>
              ))}
            </div>
          )}
          <button className="btn secondary sm" onClick={() => setLinkOpen(true)} disabled={!data.experiences.length}>
            Vincular experiência
          </button>
          {!data.experiences.length && <p className="xs faint">Registre experiências no Diário para vinculá-las aqui.</p>}
        </Section>

        {revisions.length > 0 && (
          <Section kicker="Como esta percepção mudou">
            <div className="layers">
              {[...revisions].reverse().map((r, i) => (
                <div key={i} className="layer">
                  <div className="when">
                    {fmtDate(r.at, { withYear: true })} · {CONFIDENCE_LABELS[r.confidence].label}
                    {r.status === 'superseded' ? ' · superada' : ''}
                  </div>
                  <div className="layer-text">{r.title}</div>
                  {r.note && (
                    <div className="small" style={{ fontStyle: 'normal', fontFamily: 'var(--font-body)', color: 'var(--ink-soft)', marginTop: 4 }}>
                      Por quê: {r.note}
                    </div>
                  )}
                </div>
              ))}
            </div>
          </Section>
        )}
        <button
          className="btn primary block"
          disabled={!draft.title.trim()}
          onClick={() => {
            auto.saveNow();
            toast('Descoberta guardada.');
            goBack('/mapa?t=descobertas');
          }}
        >
          Concluir
        </button>
      </div>

      <ChangeSheet
        open={changeOpen}
        onClose={() => setChangeOpen(false)}
        current={draft}
        onApply={(patch, note) => {
          if (!saved) return;
          const rev = { at: new Date().toISOString(), title: saved.title, description: saved.description, confidence: saved.confidence, status: saved.status, note };
          const next = { ...draft, ...patch };
          store.upsert('discoveries', { ...saved, ...next, revisions: [...saved.revisions, rev] } as any);
          // Atualiza o rascunho sem disparar nova camada automática.
          setDraft({ ...next, revisions: [...saved.revisions, rev] });
          toast('Mudança registrada.');
        }}
      />
      <Sheet open={linkOpen} onClose={() => setLinkOpen(false)} title="Vincular experiência">
        <div className="list">
          {[...data.experiences]
            .sort((a, b) => b.at.localeCompare(a.at))
            .filter((x) => !draft.experienceIds.includes(x.id))
            .slice(0, 60)
            .map((x) => (
              <button
                key={x.id}
                className="list-row"
                onClick={() => {
                  set({ experienceIds: [...draft.experienceIds, x.id] });
                  setLinkOpen(false);
                }}
              >
                <div className="grow">
                  <div className="title">{x.title || 'Experiência'}</div>
                  <div className="meta">{fmtDate(x.at)}</div>
                </div>
              </button>
            ))}
        </div>
      </Sheet>
      {node}
    </Page>
  );
}

function ChangeSheet(props: {
  open: boolean;
  onClose: () => void;
  current: Draft;
  onApply: (patch: Partial<Draft>, note: string) => void;
}) {
  const [confidence, setConfidence] = useState<Confidence>(props.current.confidence);
  const [superseded, setSuperseded] = useState(props.current.status === 'superseded');
  const [note, setNote] = useState('');
  return (
    <Sheet open={props.open} onClose={props.onClose} title="Minha percepção mudou">
      <div className="stack lg">
        <p className="small muted" style={{ margin: 0 }}>
          A versão atual será guardada como uma camada, com a explicação que você der.
        </p>
        <Field label="O que mudou e por quê?" optional>
          <AutoText value={note} onChange={setNote} minRows={3} placeholder="Ex.: percebi que isso só acontece quando durmo mal." />
        </Field>
        <Field label="Firmeza agora">
          <Segmented
            value={confidence}
            onChange={setConfidence}
            options={CONFIDENCE.map((c) => ({ value: c, label: CONFIDENCE_LABELS[c].label.split(' ')[0] }))}
          />
        </Field>
        <label className="row small">
          <input type="checkbox" checked={superseded} onChange={(e) => setSuperseded(e.target.checked)} /> Isso deixou de valer para mim (marcar como superada)
        </label>
        <button
          className="btn primary block"
          onClick={() => {
            props.onApply({ confidence, status: superseded ? 'superseded' : 'active' }, note.trim());
            setNote('');
            props.onClose();
          }}
        >
          Registrar mudança
        </button>
      </div>
    </Sheet>
  );
}
