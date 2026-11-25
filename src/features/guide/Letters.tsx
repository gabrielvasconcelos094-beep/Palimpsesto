import { useState } from 'react';
import { Lock, Mail, MailOpen, Plus, Trash2 } from 'lucide-react';
import { goBack, navigate, useRoute } from '../../app/router';
import { store, useData } from '../../app/store';
import { toast } from '../../app/toast';
import type { Letter } from '../../domain/schema';
import { dayKey } from '../../domain/util';
import { AutoText, Empty, Field, fmtDate, Page, Toggle, useConfirm } from '../../ui/components';
import { TagInput } from '../../ui/pickers';
import { useAutosave } from '../../ui/useAutosave';

export const isSealedNow = (l: Letter) => l.sealed && !!l.openAt && !l.openedAt && l.openAt.slice(0, 10) > dayKey(new Date());

export function LettersTab() {
  const data = useData();
  const letters = [...data.letters].sort((a, b) => b.createdAt.localeCompare(a.createdAt));
  return (
    <div style={{ marginTop: 16 }}>
      <p className="small muted" style={{ margin: '0 2px 12px' }}>
        Mensagens para o seu eu do futuro — para uma data, uma situação ou um dia difícil.
      </p>
      {letters.length === 0 ? (
        <Empty
          title="Nenhuma carta ainda"
          action={
            <button className="btn primary" onClick={() => navigate('/guia/carta/nova')}>
              Escrever uma carta
            </button>
          }
        >
          Você pode lacrar uma carta até uma data — ela fica oculta até lá.
        </Empty>
      ) : (
        <div className="stack">
          {letters.map((l) => {
            const sealed = isSealedNow(l);
            const situation = l.situationId ? data.situations.find((s) => s.id === l.situationId) : undefined;
            return (
              <button key={l.id} className="card tight row" onClick={() => navigate(`/guia/carta/${l.id}`)}>
                {sealed ? <Lock size={20} className="faint" /> : l.openedAt || !l.openAt ? <MailOpen size={20} className="faint" /> : <Mail size={20} style={{ color: 'var(--accent-ink)' }} />}
                <div className="grow">
                  <div className="h3">{l.title || 'Sem título'}</div>
                  <div className="xs muted">
                    Escrita em {fmtDate(l.createdAt, { withYear: true })}
                    {l.openAt ? ` · ${sealed ? 'lacrada até' : 'para'} ${fmtDate(l.openAt, { withYear: true })}` : ''}
                    {situation ? ` · ${situation.title}` : ''}
                  </div>
                </div>
              </button>
            );
          })}
        </div>
      )}
      <button className="btn secondary block" style={{ marginTop: 16 }} onClick={() => navigate('/guia/carta/nova')}>
        <Plus size={16} /> Nova carta
      </button>
    </div>
  );
}

export function LetterPage() {
  const route = useRoute();
  const id = route.parts[2];
  const letter = useData().letters.find((l) => l.id === id);
  // Só mostra a carta como lacrada se ela já estava lacrada ao abrir a tela
  // (evita esconder o texto enquanto ela está sendo escrita).
  const [sealedAtOpen] = useState(() => !!letter && isSealedNow(letter));
  if (id !== 'nova' && !letter)
    return (
      <Page back="/guia?t=cartas" title="Carta não encontrada" noNav>
        <span />
      </Page>
    );
  if (letter && sealedAtOpen && isSealedNow(letter)) return <SealedLetter l={letter} />;
  return <LetterEditor />;
}

function SealedLetter({ l }: { l: Letter }) {
  const { ask, node } = useConfirm();
  return (
    <Page back="/guia?t=cartas" noNav title={l.title || 'Carta lacrada'} ghost="depois">
      <div className="card" style={{ textAlign: 'center', padding: '32px 20px' }}>
        <Lock size={28} style={{ margin: '0 auto 12px' }} />
        <p className="h3">Lacrada até {fmtDate(l.openAt!, { withYear: true })}</p>
        <p className="small muted">Escrita em {fmtDate(l.createdAt, { withYear: true })}. O conteúdo fica oculto até lá.</p>
        <button
          className="btn secondary"
          style={{ marginTop: 10 }}
          onClick={async () => {
            if (await ask({ title: 'Abrir antes da data?', body: 'Você escolheu esperar até esse dia. Pode abrir agora mesmo assim, se preferir.', confirm: 'Abrir agora' }))
              store.patch('letters', l.id, { openedAt: new Date().toISOString() });
          }}
        >
          Abrir mesmo assim
        </button>
      </div>
      {node}
    </Page>
  );
}

type Draft = Omit<Letter, 'id' | 'createdAt' | 'updatedAt'>;

function LetterEditor() {
  const route = useRoute();
  const data = useData();
  const paramId = route.parts[2];
  const existing = paramId !== 'nova' ? data.letters.find((l) => l.id === paramId) : undefined;
  const [draft, setDraft] = useState<Draft>(() =>
    existing
      ? { ...existing }
      : { title: '', body: '', openAt: null, sealed: false, openedAt: null, situationId: route.query.get('situacao'), tags: [] },
  );
  // Ao abrir uma carta cuja data chegou, marca como aberta.
  const [justOpened] = useState(() => {
    if (existing && existing.openAt && !existing.openedAt && existing.openAt.slice(0, 10) <= dayKey(new Date())) {
      store.patch('letters', existing.id, { openedAt: new Date().toISOString() });
      return true;
    }
    return false;
  });
  const [editing, setEditing] = useState(!existing || !existing.body);
  const { ask, node } = useConfirm();
  const auto = useAutosave('letters', draft, {
    initialId: existing?.id ?? null,
    meaningful: (d: Draft) => !!(d.title.trim() || d.body.trim()),
    onCreated: (nid) => navigate(`/guia/carta/${nid}`, { replace: true }),
  });
  const set = (p: Partial<Draft>) => setDraft((d) => ({ ...d, ...p }));
  const id = auto.id.current;
  const situations = data.situations.filter((s) => !s.archived || s.id === draft.situationId);

  const del = async () => {
    if (!id) return goBack('/guia?t=cartas');
    if (await ask({ title: 'Excluir esta carta?', body: 'Ela será apagada definitivamente.', confirm: 'Excluir', danger: true })) {
      auto.cancel();
      store.remove('letters', id);
      toast('Carta excluída.');
      goBack('/guia?t=cartas');
    }
  };

  if (!editing && existing)
    return (
      <Page
        back="/guia?t=cartas"
        noNav
        kicker={`Escrita em ${fmtDate(existing.createdAt, { withYear: true })}`}
        title={draft.title || 'Carta'}
        ghost="carta"
        actions={
          <>
            <button className="btn ghost sm" onClick={() => setEditing(true)}>
              Editar
            </button>
            <button className="icon-btn" aria-label="Excluir carta" style={{ color: 'var(--danger)' }} onClick={del}>
              <Trash2 size={20} />
            </button>
          </>
        }
      >
        {justOpened && <div className="notice calm small" style={{ marginBottom: 16 }}>Chegou o dia desta carta.</div>}
        <div className="card">
          <p className="ink-text" style={{ margin: 0 }}>
            {draft.body}
          </p>
        </div>
        {node}
      </Page>
    );

  return (
    <Page
      back="/guia?t=cartas"
      noNav
      title={existing ? 'Editar carta' : 'Para mim'}
      ghost="carta"
      actions={
        id && (
          <button className="icon-btn" aria-label="Excluir carta" style={{ color: 'var(--danger)' }} onClick={del}>
            <Trash2 size={20} />
          </button>
        )
      }
    >
      <div className="stack lg">
        <Field label="Título" optional>
          <input className="input" value={draft.title} maxLength={200} onChange={(e) => set({ title: e.target.value })} placeholder="Para quando…" />
        </Field>
        <AutoText writing value={draft.body} onChange={(body) => set({ body })} placeholder="Querido eu do futuro…" minRows={8} ariaLabel="Texto da carta" maxLength={100000} />
        <Field label="Abrir em" optional help="Deixe em branco para uma carta sempre disponível.">
          <input type="date" className="input" value={draft.openAt ?? ''} onChange={(e) => set({ openAt: e.target.value || null, sealed: e.target.value ? draft.sealed : false, openedAt: null })} />
        </Field>
        {draft.openAt && (
          <div className="list">
            <Toggle label="Lacrar até a data" help="O conteúdo fica oculto até o dia escolhido." checked={draft.sealed} onChange={(sealed) => set({ sealed })} />
          </div>
        )}
        <Field label="Para uma situação" optional>
          <select className="select" value={draft.situationId ?? ''} onChange={(e) => set({ situationId: e.target.value || null })}>
            <option value="">—</option>
            {situations.map((s) => (
              <option key={s.id} value={s.id}>
                {s.title}
              </option>
            ))}
          </select>
        </Field>
        <Field label="Marcadores" optional help="Ex.: “dia difícil” faz a carta aparecer nessa situação.">
          <TagInput value={draft.tags} onChange={(tags) => set({ tags })} />
        </Field>
        <button
          className="btn primary block"
          disabled={!draft.title.trim() && !draft.body.trim()}
          onClick={() => {
            auto.saveNow();
            toast(draft.sealed ? `Carta lacrada até ${fmtDate(draft.openAt!, { withYear: true })}.` : 'Carta guardada.');
            goBack('/guia?t=cartas');
          }}
        >
          {draft.sealed ? 'Lacrar e guardar' : 'Guardar'}
        </button>
      </div>
      {node}
    </Page>
  );
}
