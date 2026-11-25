import { useEffect, useState } from 'react';
import { ChevronDown, Trash2 } from 'lucide-react';
import { store, useData } from '../../app/store';
import { toast } from '../../app/toast';
import type { IndicatorKey, MoodEntry } from '../../domain/schema';
import { INDICATORS } from '../../domain/scales';
import { Field, AutoText, Sheet, fromLocalInput, toLocalInput, useConfirm } from '../../ui/components';
import { EmotionPicker, EnergyPicker, LevelPicker, TagInput, ValencePicker } from '../../ui/pickers';

type Draft = Omit<MoodEntry, 'id' | 'createdAt' | 'updatedAt'> & { id?: string };

const blank = (valence: number | null): Draft => ({
  at: new Date().toISOString(),
  valence: (valence ?? 0) as number,
  energy: null,
  emotionIds: [],
  indicators: {},
  tags: [],
  note: '',
});

/**
 * Registro de humor. Só a valência é necessária: um toque e "Salvar".
 * Todo o resto é aprofundamento opcional.
 */
export function MoodSheet(props: { open: boolean; onClose: () => void; initialValence?: number | null; entryId?: string | null }) {
  const data = useData();
  const prefs = data.preferences;
  const existing = props.entryId ? data.moodEntries.find((m) => m.id === props.entryId) : undefined;
  const [draft, setDraft] = useState<Draft>(() => (existing ? { ...existing } : blank(props.initialValence ?? null)));
  const [picked, setPicked] = useState<boolean>(!!existing || props.initialValence != null);
  const [more, setMore] = useState(false);
  const { ask, node } = useConfirm();

  useEffect(() => {
    if (!props.open) return;
    const ex = props.entryId ? store.get('moodEntries', props.entryId) : undefined;
    setDraft(ex ? { ...ex } : blank(props.initialValence ?? null));
    setPicked(!!ex || props.initialValence != null);
    setMore(!!ex && (!!ex.note || ex.tags.length > 0 || Object.keys(ex.indicators).length > 0));
  }, [props.open, props.entryId, props.initialValence]);

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

  return (
    <Sheet open={props.open} onClose={props.onClose} title={existing ? 'Editar registro' : 'Como você está?'}>
      <div className="stack lg">
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
                <Field label="O que estava acontecendo?" optional help="Marcadores ajudam a Trajetória a encontrar padrões.">
                  <TagInput value={draft.tags} onChange={(tags) => set({ tags })} />
                </Field>
                <Field label="Anotação" optional>
                  <AutoText value={draft.note} onChange={(note) => set({ note })} placeholder="Algo que queira lembrar…" minRows={2} />
                </Field>
                <Field label="Momento">
                  <input
                    type="datetime-local"
                    className="input"
                    value={toLocalInput(draft.at)}
                    max={toLocalInput(new Date(Date.now() + 86400000).toISOString())}
                    onChange={(e) => set({ at: fromLocalInput(e.target.value) })}
                  />
                </Field>
              </div>
            )}
          </>
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
