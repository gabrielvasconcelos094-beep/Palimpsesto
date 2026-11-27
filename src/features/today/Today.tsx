import { useEffect, useMemo, useState } from 'react';
import { BookOpen, Feather, LifeBuoy, Mail, Search, Settings, Sparkles } from 'lucide-react';
import { timeLabel } from '../journal/Journal';
import { navigate, useRoute } from '../../app/router';
import { parseValence } from '../../app/widgetActions';
import { store, useData } from '../../app/store';
import { pickResurface } from '../../domain/analytics';
import { energyLabel, valenceLabel, VALENCE_VALUES } from '../../domain/scales';
import { isUpcoming } from '../../domain/situations';
import { dayKey, fold, seededRandom } from '../../domain/util';
import { fmtDate, Page, Section, WEEKDAYS, MONTHS } from '../../ui/components';
import { ValenceMark } from '../../ui/pickers';
import { MoodSheet } from '../journal/MoodSheet';
import { SITUATION_TEMPLATES } from '../../domain/seed';
import { daySeries } from '../../domain/series';
import { SleepSheet } from '../../ui/SleepFields';
import { SLEEP_QUALITY } from '../../domain/scales';
import { CalendarClock, Moon } from 'lucide-react';
import { upcoming, whoLabel } from '../../domain/care';

/**
 * Os últimos sete dias num relance: o símbolo de cada data é o resultado do
 * dia (média dos registros arredondada; ver `dayResult`). Dias vazios ficam vazios —
 * não é sequência, nem meta: lacunas não são problema.
 */
function WeekStrip({ now }: { now: Date }) {
  const data = useData();
  const labels = data.preferences.valenceLabels;
  const days = useMemo(() => {
    const keys = Array.from({ length: 7 }, (_, i) => {
      const d = new Date(now.getFullYear(), now.getMonth(), now.getDate() - (6 - i));
      return { key: dayKey(d), d };
    });
    const first = keys[0].key;
    const pts = new Map(daySeries(data.moodEntries.filter((m) => m.at.slice(0, 10) >= first)).map((p) => [p.day, p]));
    return keys.map((k) => ({ ...k, p: pts.get(k.key) }));
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [data.moodEntries, dayKey(now)]);
  if (!days.some((d) => d.p)) return null;
  return (
    <Section kicker="Últimos 7 dias" action={<button className="btn ghost sm" onClick={() => navigate('/trajetoria')}>Trajetória</button>}>
      <div className="week-strip" role="list">
        {days.map(({ key, d, p }, i) => {
          const name = `${WEEKDAYS[d.getDay()]}, ${d.getDate()}`;
          const v = p?.mood != null ? p.mood - 3 : null;
          return (
            <button
              key={key}
              role="listitem"
              className={`week-day${i === 6 ? ' today' : ''}`}
              disabled={!p}
              aria-label={p ? `${name}: ${valenceLabel(v!, labels)}${p.records > 1 ? ` (resultado de ${p.records} registros)` : ''}` : `${name}: sem registro`}
              onClick={() => navigate(`/diario?de=${key}&ate=${key}`)}
            >
              <span className="wd">{i === 6 ? 'hoje' : WEEKDAYS[d.getDay()].slice(0, 3).toLowerCase()}</span>
              {v != null ? <ValenceMark v={v} size={26} /> : <span className="week-empty" aria-hidden />}
            </button>
          );
        })}
      </div>
    </Section>
  );
}

function greeting(d: Date) {
  const h = d.getHours();
  if (h < 5) return 'Boa noite';
  if (h < 12) return 'Bom dia';
  if (h < 18) return 'Boa tarde';
  return 'Boa noite';
}

export function openHardDay() {
  const d = store.getState().data;
  const s = d.situations.find((x) => !x.archived && x.tags.some((t) => fold(t) === 'dia dificil'));
  if (s) return navigate(`/guia/situacao/${s.id}`);
  const t = SITUATION_TEMPLATES[0];
  const created = store.upsert('situations', { title: t.title, tags: t.tags, description: 'Um lugar para o que você já sabe que ajuda quando o dia pesa.' });
  navigate(`/guia/situacao/${created.id}`);
}

export function Today() {
  const data = useData();
  const now = new Date();
  const route = useRoute();
  // Aberto por um widget (?novo=humor&v=2): o registro já vem com a valência escolhida.
  const novo = route.query.get('novo');
  const novoValence = parseValence(route.query.get('v'));
  const [sheet, setSheet] = useState<{ open: boolean; valence: number | null; id: string | null }>({ open: false, valence: null, id: null });
  useEffect(() => {
    if (novo === 'humor') setSheet({ open: true, valence: novoValence, id: null });
  }, [novo, novoValence]);
  const labels = data.preferences.valenceLabels;
  const emo = useMemo(() => new Map(data.emotions.map((e) => [e.id, e.label])), [data.emotions]);

  const todayKey = dayKey(now);
  const todays = data.moodEntries.filter((m) => m.at.slice(0, 10) === todayKey).sort((a, b) => b.at.localeCompare(a.at));
  const lettersReady = data.letters.filter((l) => l.openAt && !l.openedAt && l.openAt.slice(0, 10) <= todayKey);
  const upcoming = data.situations.filter((s) => isUpcoming(s, now)).sort((a, b) => (a.date ?? '').localeCompare(b.date ?? ''));
  const layer = useMemo(
    () => (data.preferences.resurfacing ? pickResurface(data, now, seededRandom(todayKey)) : null),
    // eslint-disable-next-line react-hooks/exhaustive-deps
    [data.answers, data.experiences, data.discoveries, data.notes, todayKey, data.preferences.resurfacing],
  );
  const question = useMemo(() => {
    const answered = new Set(data.answers.filter((a) => a.text.trim()).map((a) => a.questionId));
    const hiddenSections = new Set(data.sections.filter((s) => s.hidden).map((s) => s.id));
    const open = data.questions.filter((q) => !q.hidden && !answered.has(q.id) && !hiddenSections.has(q.sectionId));
    const favs = open.filter((q) => q.favorite);
    const pool = favs.length ? favs : open;
    if (!pool.length) return null;
    return pool[Math.floor(seededRandom('q' + todayKey)() * pool.length)];
  }, [data.questions, data.answers, data.sections, todayKey]);

  const openLayer = () => {
    if (!layer) return;
    if (layer.kind === 'answer') {
      const a = data.answers.find((x) => x.id === layer.id);
      if (a) navigate(`/mapa/pergunta/${a.questionId}`);
    } else if (layer.kind === 'experience') navigate(`/diario/experiencia/${layer.id}`);
    else if (layer.kind === 'discovery') navigate(`/mapa/descoberta/${layer.id}`);
    else {
      const n = data.notes.find((x) => x.id === layer.id);
      if (n) navigate(`/mapa/ficha/${n.sectionId}`);
    }
  };

  return (
    <Page
      kicker={`${WEEKDAYS[now.getDay()]}, ${now.getDate()} de ${MONTHS[now.getMonth()]}`}
      title={greeting(now)}
      ghost="hoje"
      actions={
        <>
          <button className="icon-btn" aria-label="Buscar" onClick={() => navigate('/busca')}>
            <Search size={21} strokeWidth={1.6} />
          </button>
          <button className="icon-btn" aria-label="Ajustes" onClick={() => navigate('/ajustes')}>
            <Settings size={22} strokeWidth={1.6} />
          </button>
        </>
      }
    >
      <div className="card feature">
        <p className="h3" style={{ marginBottom: 14 }}>
          Como você está agora?
        </p>
        <div className="row" style={{ justifyContent: 'space-between' }}>
          {VALENCE_VALUES.map((v) => (
            <button
              key={v}
              className="icon-btn"
              style={{ width: 52, height: 52 }}
              aria-label={valenceLabel(v, labels)}
              onClick={() => setSheet({ open: true, valence: v, id: null })}
            >
              <ValenceMark v={v} size={38} />
            </button>
          ))}
        </div>
        <div className="row between xs faint" style={{ marginTop: 6, padding: '0 6px' }}>
          <span>{valenceLabel(-2, labels)}</span>
          <span>{valenceLabel(2, labels)}</span>
        </div>
      </div>

      {data.preferences.trackSleep && <NightRow day={todayKey} />}
      <NextAppointmentRow today={todayKey} />

      <WeekStrip now={now} />

      {todays.length > 0 && (
        <Section kicker="Registros de hoje">
          <div className="list">
            {todays.map((m) => (
              <button key={m.id} className="list-row" onClick={() => setSheet({ open: true, valence: null, id: m.id })}>
                <ValenceMark v={m.valence} size={28} />
                <div className="grow">
                  <div className="title">{valenceLabel(m.valence, labels)}</div>
                  <div className="meta">
                    {[m.emotionIds.map((id) => emo.get(id)).filter(Boolean).join(', '), m.energy ? energyLabel(m.energy, data.preferences.energyLabels) : '']
                      .filter(Boolean)
                      .join(' · ') || 'Sem detalhes'}
                  </div>
                </div>
                <span className="xs faint">{timeLabel(m.at, m.timePrecision)}</span>
              </button>
            ))}
          </div>
        </Section>
      )}

      {lettersReady.length > 0 && (
        <Section kicker="Cartas para hoje">
          <div className="stack">
            {lettersReady.map((l) => (
              <button key={l.id} className="card accent row" onClick={() => navigate(`/guia/carta/${l.id}`)}>
                <Mail size={20} />
                <div className="grow">
                  <div className="h3">{l.title || 'Uma carta para você'}</div>
                  <div className="small muted">Escrita em {fmtDate(l.createdAt, { withYear: true })}. Ela pode ser aberta.</div>
                </div>
              </button>
            ))}
          </div>
        </Section>
      )}

      {upcoming.length > 0 && (
        <Section kicker="Vem aí">
          <div className="list">
            {upcoming.map((s) => (
              <button key={s.id} className="list-row" onClick={() => navigate(`/guia/situacao/${s.id}`)}>
                <div className="grow">
                  <div className="title">{s.title}</div>
                  <div className="meta">{fmtDate(s.date!, { weekday: true })} · rever o que você já sabe</div>
                </div>
              </button>
            ))}
          </div>
        </Section>
      )}

      {layer && (
        <Section kicker="Uma camada antiga">
          <button className="card" onClick={openLayer}>
            <p className="xs faint" style={{ margin: 0 }}>
              {fmtDate(layer.at, { withYear: true })} · {layer.title}
            </p>
            <p className="quote" style={{ margin: '8px 0 0', display: '-webkit-box', WebkitLineClamp: 5, WebkitBoxOrient: 'vertical', overflow: 'hidden' }}>
              {layer.excerpt}
            </p>
            <p className="small muted" style={{ margin: '10px 0 0' }}>
              Isso ainda é verdade? Você pode reler, reescrever ou deixar como está.
            </p>
          </button>
        </Section>
      )}

      {question && (
        <Section kicker="Uma pergunta, se quiser">
          <button className="card soft" onClick={() => navigate(`/mapa/pergunta/${question.id}`)}>
            <p className="quote" style={{ margin: 0 }}>
              {question.text}
            </p>
            <p className="xs muted" style={{ margin: '8px 0 0' }}>
              {data.sections.find((s) => s.id === question.sectionId)?.title}
            </p>
          </button>
        </Section>
      )}

      <Section kicker="Atalhos">
        <div className="grid-2">
          <button className="card tight" onClick={() => navigate('/diario/experiencia/nova')}>
            <Feather size={20} />
            <div style={{ marginTop: 8, fontWeight: 600 }}>Registrar uma experiência</div>
          </button>
          <button className="card tight" onClick={openHardDay}>
            <LifeBuoy size={20} />
            <div style={{ marginTop: 8, fontWeight: 600 }}>Para dias difíceis</div>
          </button>
          <button className="card tight" onClick={() => navigate('/mapa/descoberta/nova')}>
            <Sparkles size={20} />
            <div style={{ marginTop: 8, fontWeight: 600 }}>Anotar uma descoberta</div>
          </button>
          <button className="card tight" onClick={() => navigate('/guia/carta/nova')}>
            <BookOpen size={20} />
            <div style={{ marginTop: 8, fontWeight: 600 }}>Escrever para mim</div>
          </button>
        </div>
      </Section>

      <MoodSheet
        open={sheet.open}
        onClose={() => {
          setSheet({ ...sheet, open: false });
          if (novo) navigate('/', { replace: true });
        }}
        initialValence={sheet.valence}
        entryId={sheet.id}
      />
    </Page>
  );
}

/** "Como foi a noite?" — a noite que terminou hoje, uma vez só. */
function NightRow({ day }: { day: string }) {
  const data = useData();
  const [open, setOpen] = useState(false);
  const log = data.sleepLogs.find((s) => s.date === day);
  const summary = log
    ? [log.hours != null ? `${String(log.hours).replace('.', ',')} h` : null, log.quality != null ? SLEEP_QUALITY[log.quality - 1].label.toLowerCase() : null].filter(Boolean).join(' · ')
    : null;
  return (
    <>
      <button className="list-row" style={{ marginTop: 12, border: '1px solid var(--line)', borderRadius: 'var(--radius-sm)' }} onClick={() => setOpen(true)}>
        <Moon size={18} strokeWidth={1.6} className="faint" />
        <div className="grow">
          <div className="title">{log ? 'Noite registrada' : 'Como foi a noite?'}</div>
          <div className="meta">{summary || (log ? 'Toque para completar' : 'Horas, qualidade e dificuldades — uma vez por noite')}</div>
        </div>
        <span className="xs faint">{log ? 'Editar' : 'Registrar'}</span>
      </button>
      <SleepSheet open={open} date={day} onClose={() => setOpen(false)} />
    </>
  );
}

/** Consulta nos próximos 7 dias: um lembrete discreto, sem cobrança. */
function NextAppointmentRow({ today }: { today: string }) {
  const data = useData();
  const next = upcoming(data.appointments)[0];
  if (!next) return null;
  const days = Math.round((new Date(next.date + 'T12:00:00').getTime() - new Date(today + 'T12:00:00').getTime()) / 86400000);
  if (days > 7) return null;
  const when = days === 0 ? 'hoje' : days === 1 ? 'amanhã' : `em ${days} dias`;
  return (
    <button className="list-row" style={{ marginTop: 12, border: '1px solid var(--line)', borderRadius: 'var(--radius-sm)' }} onClick={() => navigate(`/guia/consulta/${next.id}`)}>
      <CalendarClock size={18} strokeWidth={1.6} className="faint" />
      <div className="grow">
        <div className="title">
          {next.forWhom === 'outro' ? next.professional || 'Consulta' : whoLabel(next.forWhom, next.professionalGender)} {when}
          {next.time ? `, ${next.time}` : ''}
        </div>
        <div className="meta">
          {next.professional && next.forWhom !== 'outro' ? `${next.professional} · ` : ''}
          {days === 0 && next.time ? 'Toque para ver o preparo' : 'Preparar: pauta, perguntas e pedidos'}
        </div>
      </div>
    </button>
  );
}
