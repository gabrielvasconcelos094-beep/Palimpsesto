import { useEffect, useState } from 'react';
import { ChevronDown, Sparkles, Trash2 } from 'lucide-react';
import { navigate } from '../../app/router';
import { store, useData } from '../../app/store';
import { toast } from '../../app/toast';
import type { IndicatorKey, MoodEntry } from '../../domain/schema';
import { INDICATORS } from '../../domain/scales';
import { composeAt, dayKey } from '../../domain/util';
import { Field, AutoText, Sheet, fmtDate, useConfirm } from '../../ui/components';
import { ActivityPicker, EmotionPicker, EnergyPicker, LevelPicker, TagInput, ValencePicker } from '../../ui/pickers';
import { nowWhen, WhenPicker } from '../../ui/WhenPicker';

type Draft = Omit<MoodEntry, 'id' | 'createdAt' | 'updatedAt'> & { id?: string };

const blank = (valence: number | null, day?: string | null): Draft => ({
  ...(day && day !== dayKey(new Date()) ? { at: composeAt(day, '12:00'), timePrecision: 'day' as const } : nowWhen()),
  valence: (valence ?? 0) as number,
  energy: null,
  emotionIds: [],
  indicators: {},
  tags: [],
  itemIds: [],
  note: '',
});

/** "Registrado em 25 nov, às 10:12 · alterado em …" — distingue quando aconteceu de quando foi escrito. */
export function RecordMeta({ createdAt, updatedAt, at }: { createdAt: string; updatedAt: string; at: string }) {
  const created = new Date(createdAt);
  const retro = dayKey(created) > at.slice(0, 10);
  const hm = (d: Date) => d.toLocaleTimeString('pt-BR', { hour: '2-digit', minute: '2-digit' });
  return (
    <p className="xs faint" style={{ margin: 0 }}>
      {retro ? 'Registro retroativo · ' : ''}Escrito em {fmtDate(createdAt, { withYear: true })}, {hm(created)}
      {updatedAt.slice(0, 16) !== createdAt.slice(0, 16) && ` · alterado em ${fmtDate(updatedAt, { withYear: true })}, ${hm(new Date(updatedAt))}`}
    </p>
  );
}

/**
 * Registro de humor. Só a valência é necessária: um toque e "Salvar".
 * Quando aconteceu fica visível (agora, hoje, ontem, outra data); todo o resto
 * é aprofundamento opcional.
 */
export function MoodSheet(props: { open: boolean; onClose: () => void; initialValence?: number | null; entryId?: string | null; initialDay?: string | null }) {
  const data = useData();
  const prefs = data.preferences;
  const existing = props.entryId ? data.moodEntries.find((m) => m.id === props.entryId) : undefined;
  const [draft, setDraft] = useState<Draft>(() => (existing ? { ...existing } : blank(props.initialValence ?? null, props.initialDay)));
  const [picked, setPicked] = useState<boolean>(!!existing || props.initialValence != null);
  const [more, setMore] = useState(false);
  const [pickerKey, setPickerKey] = useState(0);
  const { ask, node } = useConfirm();

  useEffect(() => {
    if (!props.open) return;
    const ex = props.entryId ? store.get('moodEntries', props.entryId) : undefined;
    setDraft(ex ? { ...ex } : blank(props.initialValence ?? null, props.initialDay));
    setPicked(!!ex || props.initialValence != null);
    setMore(!!ex && (!!ex.note || ex.tags.length > 0 || Object.keys(ex.indicators).length > 0));
    setPickerKey((k) => k + 1);
  }, [props.open, props.entryId, props.initialValence, props.initialDay]);

  const set = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));
  const save = () => {
    store.upsert('moodEntries', draft as MoodEntry);
    toast(existing ? 'Registro atualizado.' : 'Registrado.');
    props.onClose();
  };
  const remove = async () => {
    if (!existing) return;
    const ok = await ask({ title: 'Excluir este registro?', body: 'Ele será removido definitivamente.', confirm: 'Excluir', danger: true });
    if (!ok) return;
    store.remove('moodEntries', existing.id);
    toast('Registro excluído.');
    props.onClose();
  };
  const retro = draft.at.slice(0, 10) !== dayKey(new Date()) || draft.timePrecision !== 'exact';
  const linkedDiscoveries = existing ? data.discoveries.filter((d) => d.moodEntryIds.includes(existing.id)) : [];

  return (
    <Sheet open={props.open} onClose={props.onClose} title={existing ? 'Editar registro' : retro ? 'Como você estava?' : 'Como você está?'}>
      <div className="stack lg">
        <WhenPicker key={pickerKey} value={draft} onChange={(w) => set(w)} allowNow={!existing} />

        <ValencePicker
          value={picked ? draft.valence : null}
          onChange={(v) => {
            set({ valence: v });
            setPicked(true);
          }}
        />

        {picked && (
          <>
            <Field label="Emoções presentes" optional>
              <EmotionPicker value={draft.emotionIds} onChange={(emotionIds) => set({ emotionIds })} />
            </Field>

            {prefs.showEnergy && (
              <Field label="Energia" optional>
                <EnergyPicker value={draft.energy} onChange={(energy) => set({ energy })} />
              </Field>
            )}

            <Field label="O que você fez ou estava fazendo?" optional help="Atividades ficam no seu repertório e alimentam a Trajetória.">
              <ActivityPicker value={draft.itemIds} onChange={(itemIds) => set({ itemIds })} />
            </Field>

            <button className="btn ghost" style={{ alignSelf: 'flex-start' }} onClick={() => setMore(!more)} aria-expanded={more}>
              <ChevronDown size={16} style={{ transform: more ? 'rotate(180deg)' : undefined, transition: 'transform .2s' }} />
              {more ? 'Menos detalhes' : 'Contexto, anotação e mais'}
            </button>

            {more && (
              <div className="stack lg">
                {prefs.enabledIndicators.map((k: IndicatorKey) => (
                  <Field key={k} label={INDICATORS[k].label} optional>
                    <LevelPicker
                      label={INDICATORS[k].label}
                      levels={INDICATORS[k].levels}
                      value={draft.indicators[k]}
                      onChange={(v) => {
                        const ind = { ...draft.indicators };
                        if (v === undefined) delete ind[k];
                        else ind[k] = v;
                        set({ indicators: ind });
                      }}
                    />
                  </Field>
                ))}
                <Field label="Contexto: o que estava acontecendo?" optional help="Marcadores ajudam a Trajetória a encontrar padrões.">
                  <TagInput value={draft.tags} onChange={(tags) => set({ tags })} />
                </Field>
                <Field label="Anotação" optional>
                  <AutoText value={draft.note} onChange={(note) => set({ note })} placeholder="Algo que queira lembrar…" minRows={2} />
                </Field>
              </div>
            )}
          </>
        )}

        {existing && (
          <div className="stack" style={{ gap: 6 }}>
            <RecordMeta createdAt={existing.createdAt} updatedAt={existing.updatedAt} at={existing.at} />
            {linkedDiscoveries.map((d) => (
              <p key={d.id} className="xs" style={{ margin: 0 }}>
                Sustenta a descoberta “{d.title}”
              </p>
            ))}
            <button
              className="btn ghost sm"
              style={{ alignSelf: 'flex-start', paddingLeft: 0 }}
              onClick={() => {
                props.onClose();
                navigate(`/mapa/descoberta/nova?registro=${existing.id}`);
              }}
            >
              <Sparkles size={14} /> Anotar uma descoberta a partir deste registro
            </button>
          </div>
        )}

        <div className="row" style={{ marginTop: 4 }}>
          {existing && (
            <button className="icon-btn" aria-label="Excluir registro" onClick={remove} style={{ color: 'var(--danger)' }}>
              <Trash2 size={20} />
            </button>
          )}
          <button className="btn primary block" disabled={!picked} onClick={save}>
            {existing ? 'Salvar alterações' : 'Salvar'}
          </button>
        </div>
      </div>
      {node}
    </Sheet>
  );
}
