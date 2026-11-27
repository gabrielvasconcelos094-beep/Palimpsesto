import { useMemo, useState } from 'react';
import { Archive, Check, Feather, Mail, Pin, PinOff, Plus, Trash2, X } from 'lucide-react';
import { goBack, navigate, useRoute } from '../../app/router';
import { store, useData } from '../../app/store';
import { removeWithUndo } from '../../app/undo';
import { toast } from '../../app/toast';
import { gatherForSituation, isUpcoming } from '../../domain/situations';
import { KIND_LABELS } from '../../domain/scales';
import type { Situation } from '../../domain/schema';
import { SITUATION_TEMPLATES } from '../../domain/seed';
import { fold, newId } from '../../domain/util';
import { AutoText, Empty, Field, fmtDate, Page, Section, Sheet, useConfirm } from '../../ui/components';
import { TagInput, TagList } from '../../ui/pickers';
import { useAutosave } from '../../ui/useAutosave';
import { ConfidenceBadge } from '../map/Discoveries';

export function SituationsTab() {
  const data = useData();
  const [newOpen, setNewOpen] = useState(false);
  const [title, setTitle] = useState('');
  const active = data.situations.filter((s) => !s.archived);
  const dated = active.filter((s) => s.date).sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''));
  const upcoming = dated.filter((s) => isUpcoming(s, new Date(), 3650));
  const past = dated.filter((s) => !upcoming.includes(s));
  const recurring = active.filter((s) => !s.date);
  const archived = data.situations.filter((s) => s.archived);

  const create = (t: string, tags: string[]) => {
    const s = store.upsert('situations', { title: t, tags });
    setNewOpen(false);
    setTitle('');
    navigate(`/guia/situacao/${s.id}`);
  };

  const block = (label: string, list: Situation[]) =>
    list.length > 0 && (
      <Section kicker={label}>
        <div className="list">
          {list.map((s) => (
            <button key={s.id} className="list-row" onClick={() => navigate(`/guia/situacao/${s.id}`)}>
              <div className="grow">
                <div className="title">{s.title}</div>
                <div className="meta">
                  {s.date ? fmtDate(s.date, { weekday: true }) : 'Sempre que acontecer'}
                  {s.checklist.length ? ` · ${s.checklist.filter((c) => c.done).length}/${s.checklist.length} cuidados` : ''}
                </div>
              </div>
            </button>
          ))}
        </div>
      </Section>
    );

  return (
    <div style={{ marginTop: 16 }}>
      <p className="small muted" style={{ margin: '0 2px 12px' }}>
        Antes de uma viagem, festa ou período intenso, o Palimpsesto reúne o que <em>você</em> já registrou sobre si e pode ser útil.
      </p>
      {active.length === 0 && archived.length === 0 ? (
        <Empty
          title="Prepare-se para algo"
          action={
            <button className="btn primary" onClick={() => setNewOpen(true)}>
              Nova situação
            </button>
          }
        >
          Crie uma situação — com data ou recorrente — e veja suas necessidades, estratégias e experiências anteriores reunidas.
        </Empty>
      ) : (
        <>
          {block('Próximas', upcoming)}
          {block('Recorrentes', recurring)}
          {block('Passadas', past.reverse())}
          {block('Arquivadas', archived)}
        </>
      )}
      <button className="btn secondary block" style={{ marginTop: 16 }} onClick={() => setNewOpen(true)}>
        <Plus size={16} /> Nova situação
      </button>
      <Sheet open={newOpen} onClose={() => setNewOpen(false)} title="Nova situação">
        <div className="stack lg">
          <Field label="Nome">
            <input className="input" value={title} onChange={(e) => setTitle(e.target.value)} placeholder="Ex.: Casamento da minha prima" maxLength={200} />
          </Field>
          <button className="btn primary" disabled={!title.trim()} onClick={() => create(title.trim(), [])}>
            Criar
          </button>
          <div>
            <p className="kicker">Ou comece de um modelo</p>
            <div className="chips">
              {SITUATION_TEMPLATES.map((t) => (
                <button key={t.title} className="chip" onClick={() => create(t.title, t.tags)}>
                  {t.title}
                </button>
              ))}
            </div>
            <p className="xs faint" style={{ marginTop: 8 }}>
              Os modelos trazem só um nome e marcadores — nenhum conselho pronto.
            </p>
          </div>
        </div>
      </Sheet>
    </div>
  );
}

/* ------------------------------------------------------------------ */
/* Página da situação                                                  */
/* ------------------------------------------------------------------ */
export function SituationPage() {
  const route = useRoute();
  const s = useData().situations.find((x) => x.id === route.parts[2]);
  if (!s)
    return (
      <Page back="/guia?t=situacoes" title="Situação não encontrada" noNav>
        <span />
      </Page>
    );
  return <SituationView key={s.id} s={s} />;
}

function SituationView({ s }: { s: Situation }) {
  const data = useData();
  const [edit, setEdit] = useState(false);
  const [item, setItem] = useState('');
  const g = useMemo(() => gatherForSituation(data, s), [data, s]);
  const { ask, node } = useConfirm();
  const hard = s.tags.some((t) => fold(t) === 'dia dificil');

  const toggleLink = (field: 'itemIds' | 'discoveryIds' | 'questionIds' | 'noteIds', id: string) => {
    const has = s[field].includes(id);
    store.patch('situations', s.id, { [field]: has ? s[field].filter((x) => x !== id) : [...s[field], id] });
    toast(has ? 'Desafixado.' : 'Fixado nesta situação.');
  };
  // Função (não componente): um componente criado a cada render seria remontado e o foco do botão se perderia ao fixar.
  const pinBtn = ({ field, id, linked }: { field: Parameters<typeof toggleLink>[0]; id: string; linked: boolean }) => (
    <button className="icon-btn" aria-label={linked ? 'Desafixar' : 'Fixar nesta situação'} onClick={() => toggleLink(field, id)} style={{ color: linked ? 'var(--primary-ink)' : 'var(--ink-faint)' }}>
      {linked ? <PinOff size={17} /> : <Pin size={17} />}
    </button>
  );
  const whyLabel = (w: string) => (w === 'vinculado' ? 'fixado' : w === 'marcador' ? 'marcador em comum' : w === 'palavras' ? 'palavras em comum' : 'desta situação');

  const addCheck = () => {
    if (!item.trim()) return;
    store.patch('situations', s.id, { checklist: [...s.checklist, { id: newId(), text: item.trim(), done: false }] });
    setItem('');
  };
  const nothing = !g.discoveries.length && !g.items.length && !g.answers.length && !g.notes.length && !g.essentials.length;

  return (
    <Page
      back="/guia?t=situacoes"
      noNav
      kicker={s.date ? fmtDate(s.date, { weekday: true }) + (s.endDate ? ` → ${fmtDate(s.endDate)}` : '') : 'Situação recorrente'}
      title={s.title}
      ghost="cuidado"
      subtitle={s.description}
      actions={
        <button className="btn ghost sm" onClick={() => setEdit(true)}>
          Editar
        </button>
      }
    >
      {s.tags.length > 0 && <TagList tags={s.tags} />}

      <Section kicker="Minha lista de cuidados">
        <div className="list">
          {s.checklist.map((c) => (
            <div key={c.id} className="list-row">
              <button
                className="icon-btn"
                aria-label={c.done ? 'Desmarcar' : 'Marcar como feito'}
                aria-pressed={c.done}
                style={{ width: 32, height: 32, border: '1.5px solid var(--line-strong)', borderRadius: 8, background: c.done ? 'var(--primary-fill)' : 'transparent', color: 'var(--on-primary)' }}
                onClick={() => store.patch('situations', s.id, { checklist: s.checklist.map((x) => (x.id === c.id ? { ...x, done: !x.done } : x)) })}
              >
                {c.done && <Check size={16} />}
              </button>
              <span className="grow" style={c.done ? { textDecoration: 'line-through', color: 'var(--ink-faint)' } : undefined}>
                {c.text}
              </span>
              <button className="icon-btn" aria-label="Remover" onClick={() => store.patch('situations', s.id, { checklist: s.checklist.filter((x) => x.id !== c.id) })}>
                <X size={16} />
              </button>
            </div>
          ))}
          <div className="list-row">
            <input
              className="input"
              value={item}
              onChange={(e) => setItem(e.target.value)}
              onKeyDown={(e) => e.key === 'Enter' && addCheck()}
              placeholder="Ex.: reservar uma tarde livre depois"
              maxLength={500}
              aria-label="Novo cuidado"
            />
            <button className="icon-btn" aria-label="Adicionar cuidado" onClick={addCheck} disabled={!item.trim()}>
              <Plus size={20} />
            </button>
          </div>
        </div>
      </Section>

      <Section kicker="O que você já sabe sobre si">
        {nothing ? (
          <div className="card dashed small muted">
            Ainda não há registros seus ligados a esta situação. Adicione marcadores (em “Editar”) como “viagem” ou “encontro social”, ou use esses marcadores em descobertas,
            estratégias e anotações — eles aparecerão aqui.
          </div>
        ) : (
          <div className="stack">
            {g.discoveries.map(({ x, why }) => (
              <div key={x.id} className="card tight row" style={{ alignItems: 'flex-start' }}>
                <button className="grow" style={{ background: 'none', border: 0, textAlign: 'left', padding: 0 }} onClick={() => navigate(`/mapa/descoberta/${x.id}`)}>
                  <p className="kicker" style={{ marginBottom: 4 }}>
                    Descoberta · {whyLabel(why)}
                  </p>
                  <div className="h3">{x.title}</div>
                  <div style={{ marginTop: 6 }}>
                    <ConfidenceBadge c={x.confidence} />
                  </div>
                </button>
                {pinBtn({ field: 'discoveryIds', id: x.id, linked: why === 'vinculado' })}
              </div>
            ))}
            {g.answers.map(({ x, question, why }) => (
              <div key={x.id} className="card tight row" style={{ alignItems: 'flex-start' }}>
                <button className="grow" style={{ background: 'none', border: 0, textAlign: 'left', padding: 0 }} onClick={() => navigate(`/mapa/pergunta/${x.questionId}`)}>
                  <p className="kicker" style={{ marginBottom: 4 }}>
                    {question} · {whyLabel(why)}
                  </p>
                  <div className="ink-text" style={{ fontSize: 'var(--fs-md)' }}>
                    {x.text.length > 280 ? x.text.slice(0, 280) + '…' : x.text}
                  </div>
                </button>
                {pinBtn({ field: 'questionIds', id: x.questionId, linked: why === 'vinculado' })}
              </div>
            ))}
            {g.notes.map(({ x, section, why }) => (
              <div key={x.id} className="card tight row" style={{ alignItems: 'flex-start' }}>
                <button className="grow" style={{ background: 'none', border: 0, textAlign: 'left', padding: 0 }} onClick={() => navigate(`/mapa/ficha/${x.sectionId}`)}>
                  <p className="kicker" style={{ marginBottom: 4 }}>
                    Nota · {section} · {whyLabel(why)}
                  </p>
                  <div className="prose">{x.text}</div>
                </button>
                {pinBtn({ field: 'noteIds', id: x.id, linked: why === 'vinculado' })}
              </div>
            ))}
            {g.essentials.length > 0 && (
              <details className="card tight">
                <summary style={{ cursor: 'pointer', fontWeight: 600 }}>Suas necessidades e limites registrados ({g.essentials.length})</summary>
                <div className="stack" style={{ marginTop: 10 }}>
                  {g.essentials.map((e, i) => (
                    <div key={i}>
                      <p className="xs faint" style={{ margin: 0 }}>
                        {e.question}
                      </p>
                      <p className="ink-text" style={{ margin: '2px 0 0', fontSize: 'var(--fs-md)' }}>
                        {e.text}
                      </p>
                    </div>
                  ))}
                </div>
              </details>
            )}
          </div>
        )}
      </Section>

      {g.items.length > 0 && (
        <Section kicker="Do seu repertório">
          <div className="list">
            {g.items.map(({ x, why, worked, total }) => (
              <div key={x.id} className="list-row">
                <button className="grow" style={{ background: 'none', border: 0, textAlign: 'left', padding: 0 }} onClick={() => navigate(`/guia/item/${x.id}`)}>
                  <div className="title">{x.name}</div>
                  <div className="meta">
                    {KIND_LABELS[x.kind].singular} · {whyLabel(why)}
                    {total ? ` · funcionou ao menos em parte ${worked} de ${total} vez(es)` : ''}
                  </div>
                </button>
                {pinBtn({ field: 'itemIds', id: x.id, linked: why === 'vinculado' })}
              </div>
            ))}
          </div>
        </Section>
      )}

      <Section kicker="Experiências anteriores">
        {g.experiences.length === 0 ? (
          <p className="small muted">Nenhuma experiência relacionada ainda.</p>
        ) : (
          <div className="list">
            {g.experiences.slice(0, 12).map(({ x }) => (
              <button key={x.id} className="list-row" onClick={() => navigate(`/diario/experiencia/${x.id}`)}>
                <Feather size={16} className="faint" />
                <div className="grow">
                  <div className="title">{x.title || 'Experiência'}</div>
                  <div className="meta">{x.learned ? `Aprendi: ${x.learned.slice(0, 120)}` : fmtDate(x.at, { withYear: true })}</div>
                </div>
              </button>
            ))}
          </div>
        )}
        <button className="btn secondary" style={{ marginTop: 10 }} onClick={() => navigate(`/diario/experiencia/nova?situacao=${s.id}`)}>
          <Feather size={16} /> Registrar como foi
        </button>
      </Section>

      <Section kicker="Cartas para este momento">
        {g.letters.length > 0 && (
          <div className="list" style={{ marginBottom: 10 }}>
            {g.letters.map(({ x }) => (
              <button key={x.id} className="list-row" onClick={() => navigate(`/guia/carta/${x.id}`)}>
                <Mail size={16} className="faint" />
                <div className="grow">
                  <div className="title">{x.title || 'Carta'}</div>
                  <div className="meta">Escrita em {fmtDate(x.createdAt, { withYear: true })}</div>
                </div>
              </button>
            ))}
          </div>
        )}
        <button className="btn secondary" onClick={() => navigate(`/guia/carta/nova?situacao=${s.id}`)}>
          <Mail size={16} /> Escrever para mim neste momento
        </button>
      </Section>

      {hard && (
        <div className="notice calm small" style={{ marginTop: 10 }}>
          Se o sofrimento estiver intenso ou você pensar em se machucar, procure apoio agora: no Brasil, o CVV atende 24h pelo telefone 188 (ligação gratuita) e em cvv.org.br. Em
          emergências, ligue 192 (SAMU).
          <div className="row wrap" style={{ gap: 6, marginTop: 8 }}>
            <button className="btn sm" onClick={() => navigate('/guia/plano')}>
              {data.safetyPlans.length ? 'Abrir meu plano de segurança' : 'Montar meu plano de segurança'}
            </button>
            <button className="btn ghost sm" onClick={() => navigate('/guia/emocoes')}>
              Minhas emoções
            </button>
          </div>
        </div>
      )}

      <Sheet open={edit} onClose={() => setEdit(false)} title="Editar situação">
        <SituationForm s={s} onClose={() => setEdit(false)} onDelete={async () => {
          setEdit(false);
          if (await ask({ title: 'Excluir esta situação?', body: 'A lista de cuidados será excluída. Experiências e cartas ligadas a ela são mantidas.', confirm: 'Excluir', danger: true })) {
            // O formulário já foi fechado e gravado; nada mais a salvar.
            removeWithUndo('situations', s.id, 'Situação excluída.');
            goBack('/guia?t=situacoes');
          }
        }} />
      </Sheet>
      {node}
    </Page>
  );
}

function SituationForm({ s, onClose, onDelete }: { s: Situation; onClose: () => void; onDelete: () => void }) {
  const [draft, setDraft] = useState({ title: s.title, description: s.description, date: s.date, endDate: s.endDate, tags: s.tags });
  const auto = useAutosave('situations', draft, { initialId: s.id, meaningful: (d) => !!d.title.trim() });
  const set = (p: Partial<typeof draft>) => setDraft((d) => ({ ...d, ...p }));
  return (
    <div className="stack lg">
      <Field label="Nome">
        <input className="input" value={draft.title} onChange={(e) => set({ title: e.target.value })} maxLength={200} />
      </Field>
      <Field label="Descrição" optional>
        <AutoText value={draft.description} onChange={(description) => set({ description })} minRows={2} />
      </Field>
      <div className="grid-2">
        <Field label="Data" optional>
          <input type="date" className="input" value={draft.date ?? ''} onChange={(e) => set({ date: e.target.value || null })} />
        </Field>
        <Field label="Até" optional>
          <input type="date" className="input" value={draft.endDate ?? ''} min={draft.date ?? undefined} onChange={(e) => set({ endDate: e.target.value || null })} />
        </Field>
      </div>
      <p className="xs faint" style={{ marginTop: -8 }}>
        Sem data, a situação fica como recorrente (ex.: “dia difícil”).
      </p>
      <Field label="Marcadores" help="É por eles que o Palimpsesto encontra seus registros relacionados.">
        <TagInput value={draft.tags} onChange={(tags) => set({ tags })} placeholder="Ex.: encontro social, viagem" />
      </Field>
      <div className="row">
        <button className="btn secondary" onClick={() => store.patch('situations', s.id, { archived: !s.archived })}>
          <Archive size={16} /> {s.archived ? 'Desarquivar' : 'Arquivar'}
        </button>
        <button className="icon-btn" aria-label="Excluir situação" style={{ color: 'var(--danger)' }} onClick={() => (auto.saveNow(), onDelete())}>
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
