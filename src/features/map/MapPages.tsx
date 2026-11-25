import { useMemo, useState } from 'react';
import { EyeOff, MoreHorizontal, Plus, Star, Trash2 } from 'lucide-react';
import { goBack, navigate, setQuery, useRoute } from '../../app/router';
import { store, useData } from '../../app/store';
import { toast } from '../../app/toast';
import type { MapNote, Question } from '../../domain/schema';
import { AutoText, Empty, Field, fmtDate, Layers, Page, Section, Segmented, Sheet, Toggle, useConfirm } from '../../ui/components';
import { TagInput, TagList } from '../../ui/pickers';
import { useAutosave, withLayer } from '../../ui/useAutosave';
import { DiscoveryList } from './Discoveries';

/* ------------------------------------------------------------------ */
/* Mapa: fichas e descobertas                                          */
/* ------------------------------------------------------------------ */
export function MapHome() {
  const data = useData();
  const route = useRoute();
  const tab = (route.query.get('t') as 'fichas' | 'descobertas') || 'fichas';
  const [newOpen, setNewOpen] = useState(false);
  const [showHidden, setShowHidden] = useState(false);

  const stats = useMemo(() => {
    const answered = new Map<string, number>();
    const qSection = new Map(data.questions.map((q) => [q.id, q.sectionId]));
    for (const a of data.answers) if (a.text.trim()) {
      const s = qSection.get(a.questionId);
      if (s) answered.set(s, (answered.get(s) ?? 0) + 1);
    }
    const notes = new Map<string, number>();
    for (const n of data.notes) notes.set(n.sectionId, (notes.get(n.sectionId) ?? 0) + 1);
    return { answered, notes };
  }, [data.answers, data.notes, data.questions]);

  const sections = [...data.sections].sort((a, b) => a.order - b.order).filter((s) => showHidden || !s.hidden);
  const hiddenCount = data.sections.filter((s) => s.hidden).length;
  const favorites = data.questions.filter((q) => q.favorite && !q.hidden);

  return (
    <Page
      title="Mapa"
      ghost="quem sou"
      subtitle="O que você sabe sobre si — escrito e reescrito com o tempo."
      actions={
        <button
          className="icon-btn filled"
          aria-label={tab === 'fichas' ? 'Nova ficha' : 'Nova descoberta'}
          onClick={() => (tab === 'fichas' ? setNewOpen(true) : navigate('/mapa/descoberta/nova'))}
        >
          <Plus size={22} />
        </button>
      }
    >
      <Segmented
        ariaLabel="Seção do mapa"
        value={tab}
        onChange={(t) => setQuery('t', t)}
        options={[
          { value: 'fichas', label: 'Fichas' },
          { value: 'descobertas', label: 'Descobertas' },
        ]}
      />
      {tab === 'descobertas' ? (
        <DiscoveryList />
      ) : (
        <>
          {favorites.length > 0 && (
            <Section kicker="Perguntas favoritas">
              <div className="list">
                {favorites.slice(0, 6).map((q) => {
                  const a = data.answers.find((x) => x.questionId === q.id);
                  return (
                    <button key={q.id} className="list-row" onClick={() => navigate(`/mapa/pergunta/${q.id}`)}>
                      <Star size={16} fill="currentColor" style={{ color: 'var(--accent-ink)', flex: 'none' }} />
                      <div className="grow">
                        <div className="title">{q.text}</div>
                        <div className="meta">{a?.text.trim() ? a.text.slice(0, 80) : 'Ainda sem resposta'}</div>
                      </div>
                    </button>
                  );
                })}
              </div>
            </Section>
          )}
          <div className="stack" style={{ marginTop: 18 }}>
            {sections.map((s) => {
              const a = stats.answered.get(s.id) ?? 0;
              const n = stats.notes.get(s.id) ?? 0;
              return (
                <button key={s.id} className="card" onClick={() => navigate(`/mapa/ficha/${s.id}`)} style={s.hidden ? { opacity: 0.6 } : undefined}>
                  <div className="row between">
                    <h2 className="h3">{s.title}</h2>
                    {s.hidden && <EyeOff size={16} className="faint" />}
                  </div>
                  {s.description && (
                    <p className="small muted" style={{ margin: '4px 0 0' }}>
                      {s.description}
                    </p>
                  )}
                  <p className="xs faint" style={{ margin: '10px 0 0' }}>
                    {a || n ? [a ? `${a} resposta${a > 1 ? 's' : ''}` : '', n ? `${n} nota${n > 1 ? 's' : ''}` : ''].filter(Boolean).join(' · ') : 'Em branco — comece por onde quiser'}
                  </p>
                </button>
              );
            })}
          </div>
          {hiddenCount > 0 && (
            <button className="btn ghost" style={{ marginTop: 12 }} onClick={() => setShowHidden(!showHidden)}>
              {showHidden ? 'Esconder fichas ocultas' : `Mostrar ${hiddenCount} ficha(s) oculta(s)`}
            </button>
          )}
        </>
      )}
      <SectionEditSheet open={newOpen} onClose={() => setNewOpen(false)} />
    </Page>
  );
}

function SectionEditSheet(props: { open: boolean; onClose: () => void; sectionId?: string }) {
  const data = useData();
  const s = props.sectionId ? data.sections.find((x) => x.id === props.sectionId) : undefined;
  const [title, setTitle] = useState(s?.title ?? '');
  const [description, setDescription] = useState(s?.description ?? '');
  return (
    <Sheet open={props.open} onClose={props.onClose} title={s ? 'Editar ficha' : 'Nova ficha'}>
      <div className="stack lg">
        <Field label="Nome">
          <input className="input" value={title} maxLength={120} onChange={(e) => setTitle(e.target.value)} placeholder="Ex.: Corpo e saúde, Trabalho, Criatividade" />
        </Field>
        <Field label="Descrição" optional>
          <input className="input" value={description} maxLength={400} onChange={(e) => setDescription(e.target.value)} />
        </Field>
        <button
          className="btn primary block"
          disabled={!title.trim()}
          onClick={() => {
            const saved = store.upsert('sections', {
              ...(s ?? { builtIn: false, hidden: false, order: data.sections.length + 1 }),
              title: title.trim(),
              description: description.trim(),
            } as any);
            props.onClose();
            if (!s) navigate(`/mapa/ficha/${saved.id}`);
          }}
        >
          Salvar
        </button>
      </div>
    </Sheet>
  );
}

/* ------------------------------------------------------------------ */
/* Ficha                                                               */
/* ------------------------------------------------------------------ */
export function SectionPage() {
  const data = useData();
  const route = useRoute();
  const id = route.parts[2];
  const section = data.sections.find((s) => s.id === id);
  const [noteDraft, setNoteDraft] = useState('');
  const [editNote, setEditNote] = useState<MapNote | null>(null);
  const [qOpen, setQOpen] = useState(false);
  const [menu, setMenu] = useState(false);
  const [editOpen, setEditOpen] = useState(false);
  const [showHiddenQ, setShowHiddenQ] = useState(false);
  const { ask, node } = useConfirm();

  if (!section)
    return (
      <Page back="/mapa" title="Ficha não encontrada" noNav>
        <span />
      </Page>
    );

  const questions = data.questions.filter((q) => q.sectionId === id).sort((a, b) => a.order - b.order);
  const answers = new Map(data.answers.map((a) => [a.questionId, a]));
  const answered = questions.filter((q) => !q.hidden && answers.get(q.id)?.text.trim());
  const open = questions.filter((q) => !q.hidden && !answers.get(q.id)?.text.trim());
  const hiddenQ = questions.filter((q) => q.hidden);
  const notes = data.notes.filter((n) => n.sectionId === id).sort((a, b) => b.createdAt.localeCompare(a.createdAt));

  const addNote = () => {
    if (!noteDraft.trim()) return;
    store.upsert('notes', { sectionId: id, text: noteDraft.trim(), tags: [], layers: [] } as any);
    setNoteDraft('');
  };

  return (
    <Page
      back="/mapa"
      noNav
      title={section.title}
      ghost={section.title.split(' ')[0].toLowerCase()}
      subtitle={section.description}
      actions={
        <button className="icon-btn" aria-label="Opções da ficha" onClick={() => setMenu(true)}>
          <MoreHorizontal size={22} />
        </button>
      }
    >
      {answered.length === 0 && notes.length === 0 && (
        <div className="notice calm" style={{ marginBottom: 8 }}>
          Nada aqui é obrigatório. Responda só o que fizer sentido, anote fragmentos soltos, volte quando quiser.
        </div>
      )}

      {answered.length > 0 && (
        <Section kicker="O que você já escreveu">
          <div className="stack lg">
            {answered.map((q) => {
              const a = answers.get(q.id)!;
              return (
                <button key={q.id} className="card" onClick={() => navigate(`/mapa/pergunta/${q.id}`)}>
                  <p className="small muted" style={{ margin: 0 }}>
                    {q.text}
                  </p>
                  <p className="ink-text" style={{ margin: '8px 0 0', display: '-webkit-box', WebkitLineClamp: 6, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
                    {a.text}
                  </p>
                  <p className="xs faint" style={{ margin: '10px 0 0' }}>
                    {a.unfinished ? 'Em aberto · ' : ''}
                    {fmtDate(a.updatedAt)}
                    {a.layers.length ? ` · ${a.layers.length} camada(s) anterior(es)` : ''}
                  </p>
                </button>
              );
            })}
          </div>
        </Section>
      )}

      <Section kicker="Anotações livres">
        <div className="card stack">
          <AutoText value={noteDraft} onChange={setNoteDraft} placeholder="Um fragmento, uma lista, uma frase…" minRows={2} ariaLabel="Nova anotação" />
          <button className="btn secondary sm" style={{ alignSelf: 'flex-end' }} disabled={!noteDraft.trim()} onClick={addNote}>
            Anotar
          </button>
        </div>
        {notes.length > 0 && (
          <div className="list" style={{ marginTop: 10 }}>
            {notes.map((n) => (
              <button key={n.id} className="list-row" onClick={() => setEditNote(n)}>
                <div className="grow">
                  <div className="prose">{n.text}</div>
                  <div className="row wrap" style={{ marginTop: 6 }}>
                    <span className="xs faint">{fmtDate(n.createdAt)}</span>
                    <TagList tags={n.tags} />
                  </div>
                </div>
              </button>
            ))}
          </div>
        )}
      </Section>

      <Section kicker="Perguntas para explorar" action={<button className="btn ghost sm" onClick={() => setQOpen(true)}><Plus size={14} /> Pergunta</button>}>
        {open.length === 0 ? (
          <p className="small muted">Todas as perguntas desta ficha têm resposta. Você pode criar outras.</p>
        ) : (
          <div className="list">
            {open.map((q) => (
              <div key={q.id} className="row" style={{ paddingRight: 6 }}>
                <button className="list-row grow" onClick={() => navigate(`/mapa/pergunta/${q.id}`)}>
                  <div className="grow">
                    <div>{q.text}</div>
                    {answers.get(q.id) && <div className="meta">Rascunho iniciado</div>}
                  </div>
                </button>
                <button
                  className="icon-btn"
                  aria-label={q.favorite ? 'Remover dos favoritos' : 'Favoritar'}
                  aria-pressed={q.favorite}
                  onClick={() => store.patch('questions', q.id, { favorite: !q.favorite })}
                  style={{ color: q.favorite ? 'var(--accent-ink)' : 'var(--ink-faint)' }}
                >
                  <Star size={18} fill={q.favorite ? 'currentColor' : 'none'} />
                </button>
              </div>
            ))}
          </div>
        )}
        {hiddenQ.length > 0 && (
          <>
            <button className="btn ghost sm" style={{ marginTop: 8 }} onClick={() => setShowHiddenQ(!showHiddenQ)}>
              {showHiddenQ ? 'Esconder' : 'Ver'} {hiddenQ.length} pergunta(s) oculta(s)
            </button>
            {showHiddenQ && (
              <div className="list">
                {hiddenQ.map((q) => (
                  <Row2 key={q.id} q={q} />
                ))}
              </div>
            )}
          </>
        )}
      </Section>

      <NoteSheet note={editNote} onClose={() => setEditNote(null)} />
      <NewQuestionSheet open={qOpen} onClose={() => setQOpen(false)} sectionId={id} />
      <SectionEditSheet key={section.updatedAt} open={editOpen} onClose={() => setEditOpen(false)} sectionId={id} />
      <Sheet open={menu} onClose={() => setMenu(false)} title="Ficha">
        <div className="list">
          <button className="list-row" onClick={() => (setMenu(false), setEditOpen(true))}>
            Renomear ou descrever
          </button>
          <button
            className="list-row"
            onClick={() => {
              store.patch('sections', id, { hidden: !section.hidden });
              setMenu(false);
              toast(section.hidden ? 'Ficha visível novamente.' : 'Ficha oculta. Seus textos continuam guardados.');
            }}
          >
            {section.hidden ? 'Mostrar esta ficha' : 'Ocultar esta ficha'}
          </button>
          {!section.builtIn && (
            <button
              className="list-row"
              style={{ color: 'var(--danger)' }}
              onClick={async () => {
                setMenu(false);
                const ok = await ask({
                  title: 'Excluir a ficha?',
                  body: 'As perguntas, respostas e anotações desta ficha serão excluídas definitivamente.',
                  confirm: 'Excluir',
                  danger: true,
                });
                if (ok) {
                  store.remove('sections', id);
                  goBack('/mapa');
                }
              }}
            >
              Excluir ficha
            </button>
          )}
        </div>
      </Sheet>
      {node}
    </Page>
  );
}

function Row2({ q }: { q: Question }) {
  return (
    <div className="list-row">
      <div className="grow faint">{q.text}</div>
      <button className="btn ghost sm" onClick={() => store.patch('questions', q.id, { hidden: false })}>
        Mostrar
      </button>
    </div>
  );
}

function NoteSheet({ note, onClose }: { note: MapNote | null; onClose: () => void }) {
  return (
    <Sheet open={!!note} onClose={onClose} title="Anotação">
      {note && <NoteEditor key={note.id} note={note} onClose={onClose} />}
    </Sheet>
  );
}

function NoteEditor({ note, onClose }: { note: MapNote; onClose: () => void }) {
  const [draft, setDraft] = useState({ text: note.text, tags: note.tags });
  const current = useData().notes.find((n) => n.id === note.id);
  const auto = useAutosave('notes', draft, {
    initialId: note.id,
    meaningful: (d) => !!d.text.trim(),
    transform: (prev, d) => ({ ...d, layers: withLayer(prev as any, d.text) }),
  });
  return (
    <div className="stack lg">
      <AutoText writing value={draft.text} onChange={(text) => setDraft({ ...draft, text })} ariaLabel="Texto da anotação" />
      <Layers layers={current?.layers ?? []} />
      <Field label="Marcadores" optional help="Permitem que esta anotação apareça em situações relacionadas.">
        <TagInput value={draft.tags} onChange={(tags) => setDraft({ ...draft, tags })} />
      </Field>
      <div className="row">
        <button
          className="icon-btn"
          aria-label="Excluir anotação"
          style={{ color: 'var(--danger)' }}
          onClick={() => {
            auto.cancel();
            store.remove('notes', note.id);
            toast('Anotação excluída.');
            onClose();
          }}
        >
          <Trash2 size={20} />
        </button>
        <button
          className="btn primary block"
          onClick={() => {
            auto.saveNow();
            onClose();
          }}
        >
          Concluir
        </button>
      </div>
    </div>
  );
}

function NewQuestionSheet(props: { open: boolean; onClose: () => void; sectionId: string }) {
  const [text, setText] = useState('');
  const count = useData().questions.filter((q) => q.sectionId === props.sectionId).length;
  return (
    <Sheet open={props.open} onClose={props.onClose} title="Nova pergunta">
      <div className="stack lg">
        <AutoText value={text} onChange={setText} placeholder="O que você gostaria de se perguntar?" minRows={2} autoFocus />
        <button
          className="btn primary block"
          disabled={!text.trim()}
          onClick={() => {
            const q = store.upsert('questions', { sectionId: props.sectionId, text: text.trim(), builtIn: false, order: count + 1 } as any);
            setText('');
            props.onClose();
            navigate(`/mapa/pergunta/${q.id}`);
          }}
        >
          Criar e responder
        </button>
      </div>
    </Sheet>
  );
}

/* ------------------------------------------------------------------ */
/* Pergunta e resposta (com camadas)                                   */
/* ------------------------------------------------------------------ */
export function QuestionPage() {
  const data = useData();
  const route = useRoute();
  const qid = route.parts[2];
  const q = data.questions.find((x) => x.id === qid);
  if (!q)
    return (
      <Page back="/mapa" title="Pergunta não encontrada" noNav>
        <span />
      </Page>
    );
  return <QuestionEditor key={q.id} q={q} />;
}

function QuestionEditor({ q }: { q: Question }) {
  const data = useData();
  const answer = data.answers.find((a) => a.questionId === q.id);
  const section = data.sections.find((s) => s.id === q.sectionId);
  const [draft, setDraft] = useState({ questionId: q.id, text: answer?.text ?? '', unfinished: answer?.unfinished ?? false });
  const [editQ, setEditQ] = useState(false);
  const [qText, setQText] = useState(q.text);
  const { ask, node } = useConfirm();
  const auto = useAutosave('answers', draft, {
    initialId: answer?.id ?? null,
    meaningful: (d) => !!d.text.trim() || !!answer,
    transform: (prev, d) => ({ ...d, layers: withLayer(prev as any, d.text) }),
  });

  return (
    <Page
      back={`/mapa/ficha/${q.sectionId}`}
      noNav
      kicker={section?.title}
      actions={
        <>
          <button
            className="icon-btn"
            aria-label={q.favorite ? 'Remover dos favoritos' : 'Favoritar'}
            aria-pressed={q.favorite}
            onClick={() => store.patch('questions', q.id, { favorite: !q.favorite })}
            style={{ color: q.favorite ? 'var(--accent-ink)' : undefined }}
          >
            <Star size={20} fill={q.favorite ? 'currentColor' : 'none'} />
          </button>
          <button className="icon-btn" aria-label="Opções da pergunta" onClick={() => setEditQ(true)}>
            <MoreHorizontal size={22} />
          </button>
        </>
      }
    >
      <header className="page-head">
        {section && <p className="kicker">{section.title}</p>}
        <h1 className="page-title" style={{ fontSize: 'calc(var(--fs-2xl) * .86)' }}>
          {q.text}
        </h1>
        {q.hint && <p className="page-sub">{q.hint}</p>}
      </header>
      <div className="stack lg">
        <AutoText writing value={draft.text} onChange={(text) => setDraft({ ...draft, text })} placeholder="Escreva no seu tempo. Fica salvo automaticamente." minRows={5} ariaLabel="Resposta" />
        <Toggle
          label="Ainda estou pensando"
          help="Marca a resposta como em aberto."
          checked={draft.unfinished}
          onChange={(unfinished) => setDraft({ ...draft, unfinished })}
        />
        <Layers layers={data.answers.find((a) => a.questionId === q.id)?.layers ?? []} />
        <p className="xs faint">
          Ao reescrever uma resposta antiga, a versão anterior é guardada como camada — nada se perde.
        </p>
        <button
          className="btn primary block"
          onClick={() => {
            auto.saveNow();
            goBack(`/mapa/ficha/${q.sectionId}`);
          }}
        >
          Concluir
        </button>
      </div>

      <Sheet open={editQ} onClose={() => setEditQ(false)} title="Pergunta">
        <div className="stack lg">
          {!q.builtIn && (
            <Field label="Texto da pergunta">
              <AutoText value={qText} onChange={setQText} minRows={2} />
              <button className="btn secondary sm" disabled={!qText.trim()} onClick={() => (store.patch('questions', q.id, { text: qText.trim() }), setEditQ(false))}>
                Salvar texto
              </button>
            </Field>
          )}
          <div className="list">
            <button
              className="list-row"
              onClick={() => {
                store.patch('questions', q.id, { hidden: !q.hidden });
                setEditQ(false);
                toast(q.hidden ? 'Pergunta visível.' : 'Pergunta oculta.');
              }}
            >
              {q.hidden ? 'Mostrar pergunta' : 'Ocultar pergunta'}
            </button>
            {answer && (
              <button
                className="list-row"
                style={{ color: 'var(--danger)' }}
                onClick={async () => {
                  setEditQ(false);
                  if (await ask({ title: 'Apagar a resposta?', body: 'A resposta e todas as suas camadas serão excluídas.', confirm: 'Apagar', danger: true })) {
                    auto.cancel();
                    store.remove('answers', answer.id);
                    goBack(`/mapa/ficha/${q.sectionId}`);
                  }
                }}
              >
                Apagar resposta e camadas
              </button>
            )}
            {!q.builtIn && (
              <button
                className="list-row"
                style={{ color: 'var(--danger)' }}
                onClick={async () => {
                  setEditQ(false);
                  if (await ask({ title: 'Excluir a pergunta?', body: 'A pergunta e sua resposta serão excluídas.', confirm: 'Excluir', danger: true })) {
                    auto.cancel();
                    store.remove('questions', q.id);
                    goBack(`/mapa/ficha/${q.sectionId}`);
                  }
                }}
              >
                Excluir pergunta
              </button>
            )}
          </div>
        </div>
      </Sheet>
      {node}
    </Page>
  );
}

export { Empty };
