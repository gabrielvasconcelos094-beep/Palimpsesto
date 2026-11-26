import { useState } from 'react';
import { Briefcase, Flag, Heart, Plane, Repeat, Sparkles, Pill, Stethoscope, Swords, Trash2, Trophy, Play, Square, Circle } from 'lucide-react';
import { goBack, navigate, useRoute } from '../../app/router';
import { useData } from '../../app/store';
import { removeWithUndo } from '../../app/undo';
import { EVENT_CATEGORIES, type EventCategory, type LifeEvent } from '../../domain/schema';
import { dayKey } from '../../domain/util';
import { AutoText, Field, fmtDate, Page, useConfirm } from '../../ui/components';
import { TagInput } from '../../ui/pickers';
import { useAutosave } from '../../ui/useAutosave';
import { DatePicker } from '../../ui/WhenPicker';
import { RecordMeta } from './MoodSheet';

export const EVENT_LABELS: Record<EventCategory, string> = {
  viagem: 'Viagem',
  trabalho: 'Trabalho',
  relacoes: 'Relações',
  conflito: 'Conflito',
  conquista: 'Conquista',
  projeto: 'Projeto',
  rotina: 'Mudança de rotina',
  inicio: 'Começo',
  encerramento: 'Encerramento',
  saude: 'Saúde',
  medicacao: 'Medicação',
  outro: 'Outro',
};
const ICONS: Record<EventCategory, typeof Plane> = {
  viagem: Plane,
  trabalho: Briefcase,
  relacoes: Heart,
  conflito: Swords,
  conquista: Trophy,
  projeto: Sparkles,
  rotina: Repeat,
  inicio: Play,
  encerramento: Square,
  saude: Stethoscope,
  medicacao: Pill,
  outro: Circle,
};
export function EventIcon({ c, size = 16 }: { c: EventCategory; size?: number }) {
  const I = ICONS[c] ?? Flag;
  return <I size={size} strokeWidth={1.7} />;
}
export function eventRange(e: Pick<LifeEvent, 'date' | 'endDate'>) {
  return e.endDate && e.endDate !== e.date ? `${fmtDate(e.date)} → ${fmtDate(e.endDate)}` : fmtDate(e.date, { weekday: true });
}

type Draft = Omit<LifeEvent, 'id' | 'createdAt' | 'updatedAt'>;

export function EventPage() {
  const route = useRoute();
  const id = route.parts[2];
  const exists = useData().events.some((e) => e.id === id);
  if (id !== 'novo' && !exists)
    return (
      <Page back="/diario" title="Acontecimento não encontrado" noNav>
        <span />
      </Page>
    );
  return <EventEditor />;
}

function EventEditor() {
  const route = useRoute();
  const data = useData();
  const paramId = route.parts[2];
  const existing = paramId !== 'novo' ? data.events.find((e) => e.id === paramId) : undefined;
  const [draft, setDraft] = useState<Draft>(() =>
    existing ? { ...existing } : { title: '', description: '', date: route.query.get('dia') ?? dayKey(new Date()), endDate: null, category: 'outro', tags: [] },
  );
  const { ask, node } = useConfirm();
  const auto = useAutosave('events', draft, {
    initialId: existing?.id ?? null,
    meaningful: (d: Draft) => !!d.title.trim(),
    onCreated: (nid) => navigate(`/diario/acontecimento/${nid}`, { replace: true }),
  });
  const set = (p: Partial<Draft>) => setDraft((d) => ({ ...d, ...p }));
  const id = auto.id.current;
  const from = draft.date;
  const to = draft.endDate ?? draft.date;
  const moods = data.moodEntries.filter((m) => m.at.slice(0, 10) >= from && m.at.slice(0, 10) <= to);
  const exps = data.experiences.filter((x) => x.at.slice(0, 10) >= from && x.at.slice(0, 10) <= to);

  return (
    <Page
      back="/diario"
      noNav
      kicker="Linha do tempo"
      title={existing ? draft.title || 'Acontecimento' : 'Novo acontecimento'}
      ghost="marco"
      actions={
        id && (
          <button
            className="icon-btn"
            aria-label="Excluir acontecimento"
            style={{ color: 'var(--danger)' }}
            onClick={async () => {
              if (await ask({ title: 'Excluir este acontecimento?', body: 'Os registros do Diário desse período não são afetados.', confirm: 'Excluir', danger: true })) {
                auto.cancel();
                removeWithUndo('events', id, 'Acontecimento excluído.');
                goBack('/diario');
              }
            }}
          >
            <Trash2 size={20} />
          </button>
        )
      }
    >
      <div className="stack lg">
        <p className="small muted" style={{ margin: 0 }}>
          Marcos da sua vida — uma viagem, uma mudança de trabalho, o começo de um projeto. Eles aparecem no Diário e na Trajetória para lembrar o que estava acontecendo em cada
          período.
        </p>
        <Field label="O que aconteceu?">
          <input className="input" value={draft.title} maxLength={200} autoFocus={!existing} onChange={(e) => set({ title: e.target.value })} placeholder="Ex.: Comecei no trabalho novo" />
        </Field>
        <Field label="Tipo">
          <div className="chips">
            {EVENT_CATEGORIES.map((c) => (
              <button key={c} className="chip" aria-pressed={draft.category === c} onClick={() => set({ category: c })}>
                <EventIcon c={c} size={14} /> {EVENT_LABELS[c]}
              </button>
            ))}
          </div>
        </Field>
        {draft.category === 'medicacao' && (
          <p className="xs muted" style={{ margin: '-8px 0 0' }}>
            Registre início, mudança de dose, troca ou suspensão — com o nome, a dose e quem orientou, se quiser. Efeitos que você notar podem ir na descrição. Essas datas aparecem na
            Trajetória e no resumo para a consulta, ajudando a ver o humor antes e depois. Nunca mude a medicação por conta própria.
          </p>
        )}
        <DatePicker label="Quando começou" value={draft.date} onChange={(d) => d && set({ date: d, endDate: draft.endDate && draft.endDate < d ? null : draft.endDate })} />
        <DatePicker label="Até quando" optional value={draft.endDate} min={draft.date} onChange={(endDate) => set({ endDate: endDate && endDate < draft.date ? draft.date : endDate })} />
        <Field label="Descrição" optional>
          <AutoText value={draft.description} onChange={(description) => set({ description })} minRows={3} />
        </Field>
        <Field label="Marcadores" optional>
          <TagInput value={draft.tags} onChange={(tags) => set({ tags })} />
        </Field>
        {id && (
          <div className="card tight small">
            Nesse período: {moods.length} registro(s) de humor e {exps.length} experiência(s).{' '}
            {moods.length + exps.length > 0 && (
              <button className="btn ghost sm" style={{ paddingLeft: 0 }} onClick={() => navigate(`/diario?de=${from}&ate=${to}`)}>
                Ver no Diário
              </button>
            )}
          </div>
        )}
        {existing && <RecordMeta createdAt={existing.createdAt} updatedAt={existing.updatedAt} at={`${existing.date}T12:00:00`} />}
        <button
          className="btn primary block"
          disabled={!draft.title.trim()}
          onClick={() => {
            auto.saveNow();
            goBack('/diario');
          }}
        >
          Concluir
        </button>
      </div>
      {node}
    </Page>
  );
}
