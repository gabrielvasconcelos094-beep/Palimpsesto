/**
 * Acompanhamento: o que ajuda a levar dados e assuntos para as consultas
 * (psiquiatria, psicologia) e a cuidar de si em momentos de crise.
 *
 * - Questionários padronizados (PHQ-9, GAD-7): medidas comparáveis ao longo do
 *   tempo — base do "cuidado baseado em medidas" (Fortney et al., 2017).
 * - Plano de segurança (modelo Stanley & Brown).
 * - Pauta da próxima consulta e resumo em PDF.
 *
 * Nada aqui envia avisos ou cobra frequência.
 */
import { useEffect, useMemo, useState } from 'react';
import { ChevronRight, ClipboardList, FileText, Phone, Plus, ShieldCheck, Trash2 } from 'lucide-react';
import { goBack, navigate, useRoute } from '../../app/router';
import { store, useData, useStoreState } from '../../app/store';
import { useSystemDark } from '../../app/theme';
import { toast } from '../../app/toast';
import { removeWithUndo } from '../../app/undo';
import { periodPreset } from '../../domain/analytics';
import {
  band,
  change,
  daysSince,
  DIFFICULTY_OPTIONS,
  DIFFICULTY_QUESTION,
  FREQUENCY_OPTIONS,
  history,
  INSTRUMENT_DEFS,
  isComplete,
  item9Positive,
  score,
} from '../../domain/assessments';
import { INSTRUMENTS, type AgendaItem, type Assessment, type Instrument, type SafetyPlan } from '../../domain/schema';
import { dayKey } from '../../domain/util';
import { clearExportCache, deliverFile } from '../../platform/native';
import { CONSULT_SECTIONS } from '../../report/sections';
import { AppointmentsSection } from './Appointments';
import { lastGender, whoLabel } from '../../domain/care';
import { AgendaItemRow } from './AgendaItemRow';
import { MedicationsSection } from './Medications';
import { resolveTokens } from '../../theme/resolve';
import { AutoText, Field, fmtDate, Page, Section, Segmented, useConfirm } from '../../ui/components';



/* ------------------------------------------------------------------------ */
/* Aba do Guia                                                               */
/* ------------------------------------------------------------------------ */
export function CareTab() {
  // PDFs gerados aqui não ficam no cache depois que você sai da tela.
  useEffect(() => () => void clearExportCache(), []);
  const data = useData();
  const today = dayKey(new Date());
  const plan = data.safetyPlans[0];
  const filled = plan ? Object.values(PLAN_STEPS).filter((s) => (plan[s.key] as string[]).some((x) => x.trim())).length : 0;
  return (
    <div style={{ marginTop: 16 }}>
      <p className="small muted" style={{ marginTop: 0 }}>
        Para levar às consultas o que você observou — e para cuidar de si quando o dia pesar. Tudo opcional; lembretes só quando você pedir, por consulta.
      </p>
      <nav className="chips jump" aria-label="Ir para">
        {(
          [
            ['c-consultas', 'Consultas'],
            ['c-pauta', 'Pauta'],
            ['c-remedios', 'Medicamentos'],
            ['c-questionarios', 'Questionários'],
            ['c-plano', 'Plano de segurança'],
            ['c-pdf', 'Resumo em PDF'],
          ] as const
        ).map(([id, l]) => (
          <button key={id} className="chip" onClick={() => document.getElementById(id)?.scrollIntoView({ behavior: 'smooth', block: 'start' })}>
            {l}
          </button>
        ))}
      </nav>

      <div id="c-consultas" className="anchor" />
      <AppointmentsSection />

      <div id="c-pauta" className="anchor" />
      <AgendaSection />

      <div id="c-remedios" className="anchor" />
      <MedicationsSection />

      <div id="c-questionarios" className="anchor" />
      <Section title="Questionários" kicker="Medidas padronizadas, para comparar ao longo do tempo">
        <div className="list">
          {INSTRUMENTS.map((id) => {
            const def = INSTRUMENT_DEFS[id];
            const h = history(data.assessments, id);
            const last = h[h.length - 1];
            return (
              <button key={id} className="list-row" onClick={() => navigate(`/guia/questionario/${id}`)}>
                <span className="ico-tile" aria-hidden>
                  <ClipboardList size={18} strokeWidth={1.8} />
                </span>
                <div className="grow">
                  <div className="title">
                    {def.name} · {def.short}
                  </div>
                  <div className="meta">
                    {last
                      ? `Último: ${score(last)} de ${def.max} (sintomas ${band(id, score(last)).label}) · ${daysSince(last.date, today) === 0 ? 'hoje' : `há ${daysSince(last.date, today)} dia(s)`}`
                      : 'Ainda não respondido'}
                  </div>
                </div>
                <ChevronRight className="chev" size={18} />
              </button>
            );
          })}
        </div>
        <p className="xs faint" style={{ margin: '8px 0 0' }}>
          Cada questionário pergunta sobre as últimas 2 semanas — responder a cada duas semanas costuma bastar. São instrumentos de rastreio e acompanhamento, não de diagnóstico.
        </p>
      </Section>

      <div id="c-plano" className="anchor" />
      <Section title="Plano de segurança" kicker="Para momentos de crise">
        <button className="card row" onClick={() => navigate('/guia/plano')}>
          <ShieldCheck size={22} />
          <div className="grow">
            <div className="h3">{plan ? 'Meu plano de segurança' : 'Montar meu plano de segurança'}</div>
            <div className="small muted">{plan ? `${filled} de ${Object.keys(PLAN_STEPS).length} partes preenchidas` : 'Sinais de alerta, o que ajuda, quem chamar. Melhor montado com calma — de preferência com quem te acompanha.'}</div>
          </div>
          <ChevronRight className="chev" size={18} />
        </button>
      </Section>

      <div id="c-pdf" className="anchor" />
      <ConsultReport />
    </div>
  );
}

/* ------------------------------------------------------------------------ */
/* Pauta da consulta                                                         */
/* ------------------------------------------------------------------------ */
function AgendaSection() {
  const data = useData();
  const [textV, setText] = useState('');
  const [forWhom, setForWhom] = useState<AgendaItem['forWhom']>('ambos');
  const [showDone, setShowDone] = useState(false);
  const today = dayKey(new Date());
  // Marcados hoje continuam à vista (riscados), para anotar o que foi combinado.
  const open = data.agenda.filter((a) => !a.doneAt || a.doneAt === today).sort((a, b) => a.createdAt.localeCompare(b.createdAt));
  const done = data.agenda.filter((a) => a.doneAt && a.doneAt !== today).sort((a, b) => (b.doneAt ?? '').localeCompare(a.doneAt ?? ''));
  const add = () => {
    const t = textV.trim();
    if (!t) return;
    store.upsert('agenda', { text: t, forWhom });
    setText('');
  };
  return (
    <Section title="Pauta" kicker="Assuntos que você não quer esquecer — entram no preparo de cada consulta">
      <div className="card stack">
        <AutoText value={textV} onChange={setText} placeholder="Ex.: o sono piorou desde a mudança de dose; quero falar sobre o trabalho…" minRows={2} />
        <div className="row between wrap" style={{ gap: 8 }}>
          <div className="chips" role="group" aria-label="Para quem">
            {(['psiquiatria', 'psicologia', 'ambos', 'outro'] as AgendaItem['forWhom'][]).map((k) => (
              <button key={k} className="chip" aria-pressed={forWhom === k} onClick={() => setForWhom(k)}>
                {k === 'ambos' ? 'Os dois' : whoLabel(k, lastGender(data.appointments, 'psicologia'))}
              </button>
            ))}
          </div>
          <button className="btn primary sm" disabled={!textV.trim()} onClick={add}>
            <Plus size={16} /> Adicionar
          </button>
        </div>
      </div>
      {open.length > 0 && (
        <div className="list" style={{ marginTop: 10 }}>
          {open.map((a) => (
            <AgendaRow key={a.id} a={a} />
          ))}
        </div>
      )}
      {done.length > 0 && (
        <button className="btn ghost sm" style={{ marginTop: 6 }} onClick={() => setShowDone(!showDone)} aria-expanded={showDone}>
          {showDone ? 'Ocultar' : 'Ver'} {done.length} assunto(s) já conversado(s)
        </button>
      )}
      {showDone && (
        <div className="list" style={{ marginTop: 6 }}>
          {done.map((a) => (
            <AgendaRow key={a.id} a={a} />
          ))}
        </div>
      )}
    </Section>
  );
}

const AgendaRow = AgendaItemRow;

/* ------------------------------------------------------------------------ */
/* Resumo em PDF para a consulta                                             */
/* ------------------------------------------------------------------------ */
function ConsultReport() {
  const st = useStoreState();
  const systemDark = useSystemDark();
  const lastVisit = st.data.agenda
    .map((a) => a.doneAt)
    .filter(Boolean)
    .sort()
    .pop() as string | undefined;
  const [kind, setKind] = useState<'since' | '30d' | '90d'>(lastVisit ? 'since' : '30d');
  const [busy, setBusy] = useState(false);
  const run = async () => {
    setBusy(true);
    try {
      const to = new Date();
      to.setHours(23, 59, 59, 999);
      const from = kind === 'since' && lastVisit ? new Date(lastVisit + 'T00:00:00') : periodPreset(kind === '90d' ? '90d' : '30d').from;
      const { buildReport } = await import('../../report/pdf');
      const bytes = buildReport(st.data, { from, to }, CONSULT_SECTIONS, resolveTokens({ ...st.data.preferences, appearance: 'light' }, systemDark), { title: 'Resumo para a consulta' });
      await deliverFile(`palimpsesto-consulta-${dayKey(from)}-a-${dayKey(to)}.pdf`, bytes, 'application/pdf');
    } catch (e: any) {
      toast(`Não foi possível gerar o resumo: ${e?.message ?? e}`, 5000);
    } finally {
      setBusy(false);
    }
  };
  return (
    <Section title="Resumo para a consulta" kicker="PDF para mostrar ou enviar">
      <div className="card stack lg">
        <p className="small muted" style={{ margin: 0 }}>
          Assuntos em aberto, questionários, gráfico de humor e energia, índice e estabilidade, sono, emoções mais frequentes e acontecimentos (inclusive mudanças de medicação). Gerado
          no aparelho; você decide com quem compartilhar.
        </p>
        <div className="chips" role="group" aria-label="Período do resumo">
          {lastVisit && (
            <button className="chip" aria-pressed={kind === 'since'} onClick={() => setKind('since')}>
              Desde {fmtDate(lastVisit, { short: true })}
            </button>
          )}
          <button className="chip" aria-pressed={kind === '30d'} onClick={() => setKind('30d')}>
            30 dias
          </button>
          <button className="chip" aria-pressed={kind === '90d'} onClick={() => setKind('90d')}>
            3 meses
          </button>
        </div>
        <button className="btn primary" disabled={busy} onClick={run}>
          <FileText size={16} /> {busy ? 'Gerando…' : 'Gerar resumo em PDF'}
        </button>
        {lastVisit && <p className="xs faint" style={{ margin: 0 }}>“Desde” usa a data em que você marcou o último assunto como conversado.</p>}
      </div>
    </Section>
  );
}

/* ------------------------------------------------------------------------ */
/* Questionário                                                              */
/* ------------------------------------------------------------------------ */
export function AssessmentPage() {
  const route = useRoute();
  const id = route.parts[2] as Instrument;
  const def = INSTRUMENT_DEFS[id];
  const data = useData();
  const h = useMemo(() => (def ? history(data.assessments, id) : []), [data.assessments, id, def]);
  const [view, setView] = useState<'answer' | 'history'>(route.query.get('v') === 'historico' ? 'history' : 'answer');
  const [answers, setAnswers] = useState<Array<number | null>>(() => Array(def?.items.length ?? 0).fill(null));
  const [difficulty, setDifficulty] = useState<number | null>(null);
  const [date, setDate] = useState(dayKey(new Date()));
  const [saved, setSaved] = useState<Assessment | null>(null);
  const { ask, node } = useConfirm();
  const wantHistory = route.query.get('v') === 'historico';
  useEffect(() => {
    if (wantHistory) {
      setSaved(null);
      setView('history');
    }
  }, [wantHistory]);
  if (!def)
    return (
      <Page back="/guia?t=acompanhamento" noNav title="Questionário não encontrado">
        <span />
      </Page>
    );
  const complete = isComplete(id, answers);
  const save = () => {
    const a = store.upsert('assessments', { instrument: id, date, answers: answers as number[], difficulty: id === 'phq9' ? difficulty : null }) as Assessment;
    setSaved(a);
    window.scrollTo?.(0, 0);
  };
  const prev = saved ? h.filter((x) => x.id !== saved.id && (x.date < saved.date || (x.date === saved.date && x.createdAt < saved.createdAt))).pop() : undefined;

  return (
    <Page back="/guia?t=acompanhamento" noNav kicker="Acompanhamento" title={def.name} subtitle={def.about} ghost="medida">
      {saved ? (
        <AssessmentResult a={saved} prev={prev} onAgain={() => navigate('/guia?t=acompanhamento')} onHistory={() => (setSaved(null), setView('history'))} />
      ) : (
        <>
          {h.length > 0 && (
            <Segmented
              ariaLabel="Questionário"
              value={view}
              onChange={setView}
              options={[
                { value: 'answer', label: 'Responder' },
                { value: 'history', label: `Histórico (${h.length})` },
              ]}
            />
          )}
          {view === 'history' && h.length > 0 ? (
            <AssessmentHistory id={id} list={h} ask={ask} />
          ) : (
            <div className="stack lg" style={{ marginTop: 16 }}>
              <p className="h3" style={{ margin: 0 }}>
                {def.instruction}
              </p>
              {def.items.map((item, i) => (
                <fieldset key={i} className="card tight" style={{ border: 0 }}>
                  <legend className="small" style={{ fontWeight: 600, padding: 0, marginBottom: 8 }}>
                    {i + 1}. {item}
                  </legend>
                  <div className="chips" role="radiogroup" aria-label={item}>
                    {FREQUENCY_OPTIONS.map((o, v) => (
                      <button
                        key={v}
                        role="radio"
                        aria-checked={answers[i] === v}
                        className="chip"
                        aria-pressed={answers[i] === v}
                        onClick={() => setAnswers(answers.map((x, j) => (j === i ? v : x)))}
                      >
                        {o}
                      </button>
                    ))}
                  </div>
                </fieldset>
              ))}
              {id === 'phq9' && (
                <Field label={DIFFICULTY_QUESTION} optional>
                  <div className="chips" role="radiogroup" aria-label="Dificuldade">
                    {DIFFICULTY_OPTIONS.map((o, v) => (
                      <button key={v} role="radio" aria-checked={difficulty === v} className="chip" aria-pressed={difficulty === v} onClick={() => setDifficulty(difficulty === v ? null : v)}>
                        {o}
                      </button>
                    ))}
                  </div>
                </Field>
              )}
              <Field label="Data em que está respondendo" help="Vale para as 2 semanas anteriores a esta data.">
                <input type="date" className="input" value={date} max={dayKey(new Date())} onChange={(e) => e.target.value && setDate(e.target.value)} />
              </Field>
              <div className="row sheet-actions" style={{ margin: 0, padding: '12px 0 4px', background: 'var(--bg)' }}>
                <span className="small muted grow">
                  {answers.filter((x) => x !== null).length} de {def.items.length} respondidas
                </span>
                <button className="btn primary" disabled={!complete} onClick={save}>
                  Ver resultado
                </button>
              </div>
              <p className="xs faint" style={{ margin: 0 }}>
                {def.source} Instrumento de rastreio e acompanhamento: não faz diagnóstico. Use o resultado como ponto de partida para conversar com quem te acompanha.
              </p>
            </div>
          )}
        </>
      )}
      {node}
    </Page>
  );
}

function AssessmentResult({ a, prev, onAgain, onHistory }: { a: Assessment; prev?: Assessment; onAgain: () => void; onHistory: () => void }) {
  const def = INSTRUMENT_DEFS[a.instrument];
  const t = score(a);
  const b = band(a.instrument, t);
  const ch = prev ? change(a.instrument, prev, a) : null;
  return (
    <div className="stack lg" style={{ marginTop: 8 }}>
      {item9Positive(a) && <SafetyNotice />}
      <div className="card stack">
        <p className="kicker" style={{ margin: 0 }}>
          Resultado de {fmtDate(a.date, { withYear: true })}
        </p>
        <p style={{ margin: 0 }}>
          <span style={{ fontSize: 'var(--fs-2xl)', fontFamily: 'var(--font-display)' }}>{t}</span> <span className="muted">de {def.max}</span>
        </p>
        <p style={{ margin: 0 }}>
          Faixa de sintomas <strong>{b.label}</strong> ({b.min}–{b.max}).
        </p>
        <ScoreScale id={a.instrument} value={t} />
        {ch && (
          <p className="small" style={{ margin: 0 }}>
            Em relação a {fmtDate(prev!.date, { short: true })} ({score(prev!)}): {ch.delta > 0 ? '+' : ''}
            {ch.delta} ponto(s).{' '}
            {ch.kind === 'better' ? 'Uma redução clinicamente relevante.' : ch.kind === 'worse' ? 'Um aumento clinicamente relevante — vale levar à consulta.' : `Dentro da variação esperada (menos de ${def.minChange} pontos).`}
          </p>
        )}
        <p className="xs faint" style={{ margin: 0 }}>
          Rastreio, não diagnóstico. A interpretação cabe a você junto com quem te acompanha. {def.minChangeSource}
        </p>
      </div>
      <div className="row wrap" style={{ gap: 8 }}>
        <button className="btn" onClick={onHistory}>
          Ver histórico
        </button>
        <button className="btn ghost" onClick={onAgain}>
          Voltar ao acompanhamento
        </button>
      </div>
    </div>
  );
}

/** Faixas do questionário com a posição da pontuação. */
function ScoreScale({ id, value }: { id: Instrument; value: number }) {
  const def = INSTRUMENT_DEFS[id];
  return (
    <div aria-hidden>
      <div style={{ display: 'flex', gap: 2, height: 10 }}>
        {def.bands.map((b, i) => (
          <div
            key={b.min}
            style={{
              flex: b.max - b.min + 1,
              borderRadius: 4,
              background: `color-mix(in srgb, var(--ink) ${8 + i * 9}%, transparent)`,
              outline: value >= b.min && value <= b.max ? '2px solid var(--primary-ink)' : undefined,
            }}
          />
        ))}
      </div>
      <div className="row between xs faint" style={{ marginTop: 4 }}>
        <span>0</span>
        <span>{def.max}</span>
      </div>
    </div>
  );
}

function AssessmentHistory({ id, list, ask }: { id: Instrument; list: Assessment[]; ask: ReturnType<typeof useConfirm>['ask'] }) {
  const def = INSTRUMENT_DEFS[id];
  return (
    <div className="stack lg" style={{ marginTop: 16 }}>
      <div className="card">
        <ScoreChart id={id} list={list} />
      </div>
      <div className="list">
        {[...list].reverse().map((a, i, arr) => {
          const prev = arr[i + 1];
          const ch = prev ? change(id, prev, a) : null;
          return (
            <div key={a.id} className="list-row">
              <div className="grow">
                <div className="title">
                  {score(a)} · sintomas {band(id, score(a)).label}
                </div>
                <div className="meta">
                  {fmtDate(a.date, { withYear: true })}
                  {ch ? ` · ${ch.delta > 0 ? '+' : ''}${ch.delta} desde a anterior${ch.kind !== 'same' ? ' (relevante)' : ''}` : ''}
                  {item9Positive(a) ? ' · item 9 acima de “nenhuma vez”' : ''}
                </div>
              </div>
              <button
                className="icon-btn"
                aria-label="Excluir esta aplicação"
                onClick={async () => {
                  if (await ask({ title: 'Excluir esta aplicação?', body: `${def.name} de ${fmtDate(a.date, { withYear: true })}.`, confirm: 'Excluir', danger: true }))
                    removeWithUndo('assessments', a.id, 'Aplicação excluída.');
                }}
              >
                <Trash2 size={16} />
              </button>
            </div>
          );
        })}
      </div>
      <p className="xs faint" style={{ margin: 0 }}>
        Mudanças de {def.minChange} pontos ou mais costumam ser consideradas clinicamente relevantes. {def.minChangeSource}
      </p>
    </div>
  );
}

/** Pontuações ao longo do tempo, com as faixas ao fundo. */
function ScoreChart({ id, list }: { id: Instrument; list: Assessment[] }) {
  const def = INSTRUMENT_DEFS[id];
  const W = 320;
  const H = 150;
  const pad = { l: 26, r: 10, t: 8, b: 22 };
  const ts = list.map((a) => new Date(a.date + 'T12:00:00').getTime());
  const t0 = Math.min(...ts);
  const t1 = Math.max(...ts);
  const x = (t: number) => (t1 === t0 ? (pad.l + W - pad.r) / 2 : pad.l + ((t - t0) / (t1 - t0)) * (W - pad.l - pad.r));
  const y = (v: number) => pad.t + (1 - v / def.max) * (H - pad.t - pad.b);
  const pts = list.map((a, i) => ({ x: x(ts[i]), y: y(score(a)), a }));
  return (
    <svg viewBox={`0 0 ${W} ${H}`} style={{ width: '100%', height: 'auto' }} role="img" aria-label={`${def.name}: ${list.map((a) => `${fmtDate(a.date, { short: true })} ${score(a)}`).join(', ')}`}>
      {def.bands.map((b, i) => (
        <g key={b.min}>
          <rect x={pad.l} width={W - pad.l - pad.r} y={y(b.max + (i === def.bands.length - 1 ? 0 : 0.5))} height={y(b.min - (i === 0 ? 0 : 0.5)) - y(b.max + (i === def.bands.length - 1 ? 0 : 0.5))} fill="var(--ink)" opacity={0.025 + i * 0.03} />
          <text x={pad.l - 4} y={y(b.min) - 1} textAnchor="end" fontSize={8} fill="var(--ink-faint)">
            {b.min}
          </text>
        </g>
      ))}
      {pts.length > 1 && <polyline points={pts.map((p) => `${p.x},${p.y}`).join(' ')} fill="none" stroke="var(--primary-ink)" strokeWidth={1.8} strokeLinejoin="round" />}
      {pts.map((p) => (
        <circle key={p.a.id} cx={p.x} cy={p.y} r={3.4} fill="var(--surface)" stroke="var(--primary-ink)" strokeWidth={1.8} />
      ))}
      <text x={pad.l} y={H - 6} fontSize={8.5} fill="var(--ink-faint)">
        {fmtDate(list[0].date, { short: true })}
      </text>
      {list.length > 1 && (
        <text x={W - pad.r} y={H - 6} fontSize={8.5} textAnchor="end" fill="var(--ink-faint)">
          {fmtDate(list[list.length - 1].date, { short: true })}
        </text>
      )}
    </svg>
  );
}

/* ------------------------------------------------------------------------ */
/* Segurança                                                                 */
/* ------------------------------------------------------------------------ */
export function SafetyNotice() {
  return (
    <div className="card" role="alert" style={{ borderLeft: '3px solid var(--danger)' }}>
      <p style={{ marginTop: 0 }}>
        <strong>Você indicou pensamentos de se ferir ou de que seria melhor estar morto(a).</strong> Isso merece cuidado agora, e você não precisa passar por isso sozinho(a).
      </p>
      <ul className="small" style={{ paddingLeft: 18, margin: '0 0 10px', lineHeight: 1.7 }}>
        <li>
          Fale com o <strong>CVV</strong> (24 h, gratuito): ligue <a href="tel:188">188</a> ou acesse cvv.org.br.
        </li>
        <li>
          Em emergência, ligue <a href="tel:192">192</a> (SAMU) ou procure uma UPA ou pronto-socorro.
        </li>
        <li>Avise o quanto antes seu psiquiatra ou sua psicóloga — e, se puder, alguém de confiança.</li>
      </ul>
      <div className="row wrap" style={{ gap: 8 }}>
        <a className="btn primary sm" href="tel:188">
          <Phone size={14} /> Ligar para o CVV (188)
        </a>
        <button className="btn sm" onClick={() => navigate('/guia/plano')}>
          <ShieldCheck size={14} /> Abrir meu plano de segurança
        </button>
      </div>
    </div>
  );
}

type PlanKey = Exclude<keyof SafetyPlan, 'id' | 'createdAt' | 'updatedAt'>;
const PLAN_STEPS: Record<string, { key: PlanKey; title: string; hint: string; placeholder: string }> = {
  warningSigns: {
    key: 'warningSigns',
    title: '1. Meus sinais de alerta',
    hint: 'Pensamentos, sentimentos, situações ou mudanças (sono, isolamento…) que costumam vir antes de uma crise.',
    placeholder: 'Ex.: dormir muito pouco por vários dias',
  },
  copingAlone: {
    key: 'copingAlone',
    title: '2. O que eu posso fazer sozinho(a)',
    hint: 'Coisas que ajudam a atravessar o momento sem precisar de ninguém.',
    placeholder: 'Ex.: tomar um banho morno, caminhar 15 minutos',
  },
  distractions: {
    key: 'distractions',
    title: '3. Pessoas e lugares que me distraem',
    hint: 'Onde ir ou com quem estar para mudar de ambiente — sem precisar falar da crise.',
    placeholder: 'Ex.: a praça perto de casa; ligar para a Ana',
  },
  helpers: {
    key: 'helpers',
    title: '4. Pessoas a quem posso pedir ajuda',
    hint: 'Nome e telefone de quem pode ajudar se eu disser que não estou bem.',
    placeholder: 'Ex.: Mãe — (11) 9…',
  },
  professionals: {
    key: 'professionals',
    title: '5. Profissionais e serviços',
    hint: 'Seu psiquiatra, sua psicóloga, o CAPS da sua região. O CVV e o SAMU já aparecem abaixo.',
    placeholder: 'Ex.: Dra. … — (11) 3…',
  },
  safeEnvironment: {
    key: 'safeEnvironment',
    title: '6. Deixar o ambiente mais seguro',
    hint: 'O que afastar ou guardar com outra pessoa em momentos difíceis (ex.: medicamentos em excesso).',
    placeholder: 'Ex.: pedir que alguém guarde os remédios',
  },
  reasons: {
    key: 'reasons',
    title: 'Minhas razões para viver',
    hint: 'O que importa para você — pessoas, projetos, coisas pequenas.',
    placeholder: 'Ex.: meu gato; terminar o curso',
  },
};

export function SafetyPlanPage() {
  const data = useData();
  const plan = data.safetyPlans[0];
  const { ask, node } = useConfirm();
  const get = (k: PlanKey) => ((plan?.[k] as string[] | undefined) ?? []).join('\n');
  const put = (k: PlanKey, v: string) => {
    const lines = v.split('\n').slice(0, 30).map((x) => x.slice(0, 500));
    if (plan) store.patch('safetyPlans', plan.id, { [k]: lines });
    else store.upsert('safetyPlans', { [k]: lines });
  };
  return (
    <Page
      back="/guia?t=acompanhamento"
      noNav
      kicker="Acompanhamento"
      title="Plano de segurança"
      ghost="cuidado"
      subtitle="Um roteiro curto para momentos de crise, montado com calma, antes de precisar."
      actions={
        plan && (
          <button
            className="icon-btn"
            aria-label="Apagar o plano"
            onClick={async () => {
              if (await ask({ title: 'Apagar o plano de segurança?', body: 'Você poderá desfazer logo em seguida.', confirm: 'Apagar', danger: true })) {
                removeWithUndo('safetyPlans', plan.id, 'Plano apagado.');
                goBack('/guia?t=acompanhamento');
              }
            }}
          >
            <Trash2 size={18} />
          </button>
        )
      }
    >
      <div className="card small" style={{ borderLeft: '3px solid var(--danger)' }}>
        <strong>Se você está em perigo agora:</strong> ligue <a href="tel:192">192</a> (SAMU) ou vá a uma UPA ou pronto-socorro. Para conversar, o <strong>CVV</strong> atende 24 h pelo{' '}
        <a href="tel:188">188</a>, de graça.
      </div>
      <div className="stack lg" style={{ marginTop: 16 }}>
        {Object.values(PLAN_STEPS).map((s) => (
          <Field key={s.key} label={s.title} help={s.hint}>
            <AutoText value={get(s.key)} onChange={(v) => put(s.key, v)} placeholder={s.placeholder + ' (um por linha)'} minRows={2} />
          </Field>
        ))}
        <div className="card soft small">
          <strong>Sempre disponíveis:</strong> CVV <a href="tel:188">188</a> (24 h, gratuito) · SAMU <a href="tel:192">192</a> · Bombeiros <a href="tel:193">193</a>.
        </div>
        <p className="xs faint" style={{ margin: 0 }}>
          Baseado no Plano de Segurança de Stanley &amp; Brown (2012), uma intervenção breve associada a menos comportamentos suicidas e a mais procura por tratamento (Stanley et al., 2018,
          JAMA Psychiatry). Funciona melhor montado junto com quem te acompanha. Fica só neste aparelho.
        </p>
      </div>
      {node}
    </Page>
  );
}
