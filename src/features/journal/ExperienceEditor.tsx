import { useState } from 'react';
import { Link2, Plus, Sparkles, Trash2 } from 'lucide-react';
import { goBack, navigate, useRoute } from '../../app/router';
import { store, useData } from '../../app/store';
import { removeWithUndo } from '../../app/undo';
import { KIND_LABELS, OUTCOME_LABELS, OUTCOME_ORDER } from '../../domain/scales';
import type { Experience, Outcome, RepertoireKind } from '../../domain/schema';
import { AutoText, Field, Page, Section, Sheet, useConfirm } from '../../ui/components';
import { describeWhen, nowWhen, WhenPicker } from '../../ui/WhenPicker';
import { composeAt } from '../../domain/util';
import { RecordMeta } from './MoodSheet';
import { EmotionPicker, TagInput, ValencePicker } from '../../ui/pickers';
import { useAutosave } from '../../ui/useAutosave';

type Draft = Omit<Experience, 'id' | 'createdAt' | 'updatedAt'>;

const fields: Array<[keyof Draft, string, string]> = [
  ['whatIDid', 'O que você fez diante da situação?', 'Reações, escolhas, gestos…'],
  ['whatHelped', 'O que ajudou?', ''],
  ['whatWorsened', 'O que piorou?', ''],
];

export function ExperienceEditor() {
  const route = useRoute();
  const data = useData();
  const paramId = route.parts[2];
  const isNew = paramId === 'nova';
  const existing = !isNew ? data.experiences.find((x) => x.id === paramId) : undefined;
  const [draft, setDraft] = useState<Draft>(() =>
    existing
      ? { ...existing }
      : {
          ...(route.query.get('dia') ? { at: composeAt(route.query.get('dia')!, '12:00'), timePrecision: 'day' as const } : nowWhen()),
          title: '',
          whatHappened: '',
          feelingBefore: null,
          emotionIds: [],
          whatIDid: '',
          whatHelped: '',
          whatWorsened: '',
          feelingAfter: null,
          howIFeltAfter: '',
          learned: '',
          tags: [],
          situationId: route.query.get('situacao'),
        },
  );
  const [linkOpen, setLinkOpen] = useState(false);
  const { ask, node } = useConfirm();
  const meaningful = (d: Draft) =>
    !!(d.title.trim() || d.whatHappened.trim() || d.learned.trim() || d.whatHelped.trim() || d.whatIDid.trim() || d.feelingBefore !== null || d.emotionIds.length);
  const auto = useAutosave('experiences', draft, {
    initialId: existing?.id ?? null,
    meaningful,
    onCreated: (id) => navigate(`/diario/experiencia/${id}`, { replace: true }),
  });
  const set = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));

  if (!isNew && !existing && !auto.id.current) {
    return (
      <Page back="/diario" title="Experiência não encontrada" noNav>
        <p className="muted">Ela pode ter sido excluída.</p>
      </Page>
    );
  }

  const expId = auto.id.current;
  const uses = expId ? data.uses.filter((u) => u.experienceId === expId) : [];
  const situation = draft.situationId ? data.situations.find((s) => s.id === draft.situationId) : undefined;

  const ensureId = () => {
    if (auto.id.current) return auto.id.current;
    const saved = store.upsert('experiences', { ...draft, title: draft.title || 'Experiência' } as any);
    auto.id.current = saved.id;
    navigate(`/diario/experiencia/${saved.id}`, { replace: true });
    return saved.id;
  };

  const link = (itemId: string) => {
    const id = ensureId();
    if (data.uses.some((u) => u.experienceId === id && u.itemId === itemId)) return;
    store.upsert('uses', { itemId, at: draft.at, outcome: 'unknown', tags: draft.tags, note: '', experienceId: id } as any);
  };

  const remove = async () => {
    const ok = await ask({
      title: 'Excluir esta experiência?',
      body: 'O registro e as avaliações de estratégias feitas nele serão removidos.',
      confirm: 'Excluir',
      danger: true,
    });
    if (!ok) return;
    auto.cancel();
    if (auto.id.current) removeWithUndo('experiences', auto.id.current, 'Experiência excluída.');
    goBack('/diario');
  };

  return (
    <Page
      back="/diario"
      noNav
      kicker={describeWhen(draft).replace(/^./, (c) => c.toUpperCase())}
      title={isNew && !expId ? 'Nova experiência' : draft.title || 'Experiência'}
      ghost="vivido"
      actions={
        expId && (
          <button className="icon-btn" aria-label="Excluir" onClick={remove} style={{ color: 'var(--danger)' }}>
            <Trash2 size={20} />
          </button>
        )
      }
    >
      <div className="stack lg">
        {situation && (
          <div className="notice calm">
            Parte da situação <strong>{situation.title}</strong>.
          </div>
        )}
        <Field label="Título" optional>
          <input className="input" value={draft.title} maxLength={200} onChange={(e) => set({ title: e.target.value })} placeholder="Um nome curto para lembrar" />
        </Field>
        <Field label="O que aconteceu?" optional>
          <AutoText writing value={draft.whatHappened} onChange={(whatHappened) => set({ whatHappened })} placeholder="Conte do seu jeito…" />
        </Field>
        <WhenPicker value={draft} onChange={(w) => set(w)} allowNow={!existing && !route.query.get('dia')} />
        <Field label="Como você estava se sentindo?" optional>
          <ValencePicker value={draft.feelingBefore} onChange={(feelingBefore) => set({ feelingBefore: draft.feelingBefore === feelingBefore ? null : feelingBefore })} />
        </Field>
        <Field label="Emoções que apareceram" optional>
          <EmotionPicker value={draft.emotionIds} onChange={(emotionIds) => set({ emotionIds })} />
        </Field>
        {fields.map(([k, label, ph]) => (
          <Field key={k} label={label} optional>
            <AutoText value={draft[k] as string} onChange={(v) => set({ [k]: v } as any)} placeholder={ph} minRows={2} />
          </Field>
        ))}

        <Section kicker="Do seu repertório" className="">
          <p className="small muted" style={{ marginTop: -4 }}>
            Vincule o que você usou ou viveu e diga como funcionou <em>nesta</em> situação.
          </p>
          {uses.length > 0 && (
            <div className="list" style={{ marginBottom: 10 }}>
              {uses.map((u) => {
                const item = data.repertoire.find((i) => i.id === u.itemId);
                return (
                  <div key={u.id} className="list-row" style={{ flexDirection: 'column', alignItems: 'stretch' }}>
                    <div className="row between">
                      <strong>{item?.name}</strong>
                      <button className="btn danger-ghost sm" onClick={() => store.remove('uses', u.id)}>
                        Desvincular
                      </button>
                    </div>
                    <select
                      className="select"
                      value={u.outcome}
                      aria-label={`Como funcionou: ${item?.name}`}
                      onChange={(e) => store.patch('uses', u.id, { outcome: e.target.value as Outcome })}
                    >
                      {OUTCOME_ORDER.map((o) => (
                        <option key={o} value={o}>
                          {OUTCOME_LABELS[o]}
                        </option>
                      ))}
                    </select>
                  </div>
                );
              })}
            </div>
          )}
          <button className="btn secondary" onClick={() => setLinkOpen(true)}>
            <Link2 size={16} /> Vincular do repertório
          </button>
        </Section>

        <Field label="Como você se sentiu depois?" optional>
          <ValencePicker value={draft.feelingAfter} onChange={(feelingAfter) => set({ feelingAfter: draft.feelingAfter === feelingAfter ? null : feelingAfter })} />
          <AutoText value={draft.howIFeltAfter} onChange={(howIFeltAfter) => set({ howIFeltAfter })} placeholder="Em palavras, se quiser" minRows={2} />
        </Field>
        <Field label="O que você aprendeu com essa experiência?" optional>
          <AutoText writing value={draft.learned} onChange={(learned) => set({ learned })} placeholder="Algo que vale guardar…" />
        </Field>
        {draft.learned.trim().length > 3 && (
          <button
            className="btn secondary"
            onClick={() => {
              const id = ensureId();
              navigate(`/mapa/descoberta/nova?de=${id}`);
            }}
          >
            <Sparkles size={16} /> Transformar o aprendizado em descoberta
          </button>
        )}
        <Field label="Marcadores" optional help="Ajudam a reencontrar esta experiência em situações parecidas.">
          <TagInput value={draft.tags} onChange={(tags) => set({ tags })} />
        </Field>
        {existing && <RecordMeta createdAt={existing.createdAt} updatedAt={existing.updatedAt} at={existing.at} />}
        <p className="xs faint">{auto.savedAt || expId ? 'Salvo automaticamente.' : 'Será salvo automaticamente assim que tiver conteúdo.'}</p>
        <button className="btn primary block" onClick={() => goBack('/diario')}>
          Concluir
        </button>
      </div>
      <LinkSheet open={linkOpen} onClose={() => setLinkOpen(false)} onPick={(id) => link(id)} excluded={uses.map((u) => u.itemId)} />
      {node}
    </Page>
  );
}

export function LinkSheet(props: { open: boolean; onClose: () => void; onPick: (itemId: string) => void; excluded: string[] }) {
  const data = useData();
  const [name, setName] = useState('');
  const [kind, setKind] = useState<RepertoireKind>('strategy');
  const groups: RepertoireKind[] = ['strategy', 'resource', 'drain'];
  return (
    <Sheet open={props.open} onClose={props.onClose} title="Vincular do repertório">
      <div className="stack lg">
        {groups.map((k) => {
          const list = data.repertoire.filter((i) => i.kind === k && !i.archived && !props.excluded.includes(i.id));
          if (!list.length) return null;
          return (
            <div key={k}>
              <p className="kicker">{KIND_LABELS[k].plural}</p>
              <div className="chips">
                {list.map((i) => (
                  <button
                    key={i.id}
                    className="chip"
                    onClick={() => {
                      props.onPick(i.id);
                      props.onClose();
                    }}
                  >
                    {i.name}
                  </button>
                ))}
              </div>
            </div>
          );
        })}
        <div className="card dashed stack">
          <p className="label" style={{ margin: 0 }}>
            Criar novo item
          </p>
          <input className="input" value={name} onChange={(e) => setName(e.target.value)} placeholder="Ex.: Caminhar sem destino" maxLength={200} />
          <select className="select" value={kind} onChange={(e) => setKind(e.target.value as RepertoireKind)}>
            <option value="strategy">Estratégia</option>
            <option value="resource">Algo que me faz bem</option>
            <option value="drain">Algo que me desgasta</option>
          </select>
          <button
            className="btn primary"
            disabled={!name.trim()}
            onClick={() => {
              const it = store.upsert('repertoire', { kind, name: name.trim() } as any);
              props.onPick(it.id);
              setName('');
              props.onClose();
            }}
          >
            <Plus size={16} /> Criar e vincular
          </button>
        </div>
      </div>
    </Sheet>
  );
}
