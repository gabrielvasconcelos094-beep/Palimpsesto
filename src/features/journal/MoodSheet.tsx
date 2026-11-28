import { useEffect, useState } from 'react';
import { ChevronDown, Sparkles, Trash2 } from 'lucide-react';
import { navigate } from '../../app/router';
import { store, useData } from '../../app/store';
import { removeWithUndo } from '../../app/undo';
import { toast } from '../../app/toast';
import type { IndicatorKey, MoodEntry } from '../../domain/schema';
import { INDICATORS, SLEEP_QUALITY } from '../../domain/scales';
import { composeAt, dayKey } from '../../domain/util';
import { Field, AutoText, Sheet, fmtDate, useConfirm } from '../../ui/components';
import { ActivityPicker, ContextPicker, EmotionPicker, EnergyPicker, LevelPicker, ValencePicker } from '../../ui/pickers';
import { nowWhen, WhenPicker } from '../../ui/WhenPicker';
import { nightLabel, sleepOf, SleepFields, type SleepValue } from '../../ui/SleepFields';

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
  // Sono: a noite da DATA do registro (uma por data), não um campo do registro.
  const [sleep, setSleep] = useState<SleepValue>(() => sleepOf(undefined));
  const [sleepTouched, setSleepTouched] = useState(false);
  const [sleepOpen, setSleepOpen] = useState(false);
  const sleepDate = draft.at.slice(0, 10);
  useEffect(() => {
    if (!props.open) return;
    setSleep(sleepOf(store.getState().data.sleepLogs.find((s) => s.date === sleepDate)));
    setSleepTouched(false);
  }, [props.open, sleepDate]);
  const { ask, node } = useConfirm();

  useEffect(() => {
    if (!props.open) return;
    const ex = props.entryId ? store.get('moodEntries', props.entryId) : undefined;
    setDraft(ex ? { ...ex } : blank(props.initialValence ?? null, props.initialDay));
    setPicked(!!ex || props.initialValence != null);
    setMore(!!ex && Object.keys(ex.indicators).length > 0);
    setSleepOpen(false);
    setPickerKey((k) => k + 1);
  }, [props.open, props.entryId, props.initialValence, props.initialDay]);

  const set = (patch: Partial<Draft>) => setDraft((d) => ({ ...d, ...patch }));
  const save = () => {
    store.upsert('moodEntries', draft as MoodEntry);
    if (sleepTouched) store.setSleep(sleepDate, sleep);
    toast(existing ? 'Registro atualizado.' : 'Registrado.');
    props.onClose();
  };
  const remove = async () => {
    if (!existing) return;
    const ok = await ask({ title: 'Excluir este registro?', body: 'Ele será removido definitivamente.', confirm: 'Excluir', danger: true });
    if (!ok) return;
    removeWithUndo('moodEntries', existing.id, 'Registro excluído.');
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

            <Field label="Contexto" optional help="O que você relaciona a este momento — uma ou mais áreas, ou um marcador seu. Não precisa ser a causa.">
              <ContextPicker value={draft.tags} onChange={(tags) => set({ tags })} />
            </Field>
            <Field label="O que aconteceu?" optional>
              <AutoText value={draft.note} onChange={(note) => set({ note })} placeholder="Ex.: fiquei frustrado com uma dificuldade no trabalho." minRows={2} />
            </Field>

            <Field label="O que você fez ou estava fazendo?" optional help="Atividades ficam no seu repertório e alimentam a Trajetória.">
              <ActivityPicker value={draft.itemIds} onChange={(itemIds) => set({ itemIds })} />
            </Field>

            {prefs.trackSleep && (
              <div className="card tight stack" style={{ gap: 8 }}>
                <button className="row between" style={{ background: 'none', border: 0, padding: 0, font: 'inherit', color: 'inherit', cursor: 'pointer', textAlign: 'left' }} onClick={() => setSleepOpen(!sleepOpen)} aria-expanded={sleepOpen}>
                  <span>
                    <span className="small" style={{ fontWeight: 600 }}>
                      Sono · {nightLabel(sleepDate).replace('Noite de ', 'noite de ')}
                    </span>
                    <span className="xs muted" style={{ display: 'block' }}>
                      {sleep.hours != null || sleep.quality != null
                        ? [sleep.hours != null ? `${String(sleep.hours).replace('.', ',')} h` : null, sleep.quality != null ? SLEEP_QUALITY[sleep.quality - 1].label.toLowerCase() : null].filter(Boolean).join(' · ') + ' — vale para o dia todo'
                        : 'Uma vez por noite; vale para todos os registros do dia'}
                    </span>
                  </span>
                  <ChevronDown size={16} style={{ transform: sleepOpen ? 'rotate(180deg)' : undefined, transition: 'transform .2s', flex: 'none' }} />
                </button>
                {sleepOpen && (
                  <SleepFields
                    value={sleep}
                    onChange={(v) => {
                      setSleep(v);
                      setSleepTouched(true);
                    }}
                  />
                )}
              </div>
            )}

            {prefs.enabledIndicators.length > 0 && (
              <button className="btn ghost" style={{ alignSelf: 'flex-start' }} onClick={() => setMore(!more)} aria-expanded={more}>
                <ChevronDown size={16} style={{ transform: more ? 'rotate(180deg)' : undefined, transition: 'transform .2s' }} />
                {more ? 'Ocultar indicadores' : 'Indicadores'}
              </button>
            )}

            {more && prefs.enabledIndicators.length > 0 && (
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

        <div className="row sheet-actions">
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
