/**
 * Categorias da Trajetória. Cada uma responde a perguntas concretas e diz
 * qual unidade de análise usou e quantos registros sustentam o resultado.
 */
import { useMemo, useState, type ReactNode } from 'react';
import { Activity, BatteryLow, CalendarDays, ChartLine, Clock, Flag, GitCompareArrows, Heart, Layers3, Repeat2 } from 'lucide-react';
import { OscillationPanel } from './Oscillations';
import { navigate, useRoute } from '../../app/router';
import { setSharedFilters, NO_FILTERS } from '../../app/filters';
import { buckets, findPatterns, valenceCounts, energyCounts, PATTERN_MIN_ENTRIES } from '../../domain/analytics';
import {
  activityStats,
  countsByWeek,
  dayPartStats,
  difficultMoments,
  emotionCounts,
  emotionPairs,
  emotionsByMonth,
  energyValenceTable,
  extremesOfEnergy,
  isPleasant,
  isUnpleasant,
  monthlyCount,
  regularity,
  strategyGroups,
  weekdayHighlight,
  weekdayStats,
  weeklyUnpleasant,
  withinDay,
  WEEKDAYS_FULL,
  WEEKDAYS_SHORT,
  WEEKDAY_MIN_DATES,
  ACTIVITY_MIN,
  type Unit,
  type Verdict,
} from '../../domain/insights';
import { energyLabel, INDICATORS, valenceLabel } from '../../domain/scales';
import type { MoodEntry } from '../../domain/schema';
import { inDays } from '../../domain/filters';
import { Empty, fmtDate, MONTHS_SHORT, Page, Section, Segmented } from '../../ui/components';
import { EventIcon, eventRange } from '../journal/EventEditor';
import { CalendarView } from '../journal/Journal';
import { OutcomeBar, OutcomeLegend } from '../guide/Repertoire';
import { Bars, Distribution, Evolution, HeatTable, IndexBars, StackRows } from './charts';
import { COMPARE_MIN_DATES, COMPARE_MIN_RECORDS, compareIndex, fmtIndex, MIN_RELEVANT_CHANGE, monthRange, stability, STABILITY_MIN_DATES, STABILITY_MIN_RECORDS, weekdayIndex, weekRange, WEEKDAY_INDEX_MIN_DATES } from '../../domain/valence';
import { dayKey as dayKeyOf } from '../../domain/util';
import { ENERGY_COLORS, MOOD_COLORS, PeriodBar } from './Trajectory';
import { useTrajectory } from './useTrajectory';

const pct = (x: number) => `${Math.round(x * 100)}%`;
const monthLabel = (k: string) => `${MONTHS_SHORT[Number(k.slice(5, 7)) - 1]}/${k.slice(2, 4)}`;

export const CATEGORIES = [
  { id: 'oscilacoes', title: 'Oscilações', question: 'Gráfico em linha: como humor e energia variaram ao longo do tempo?', icon: ChartLine },
  { id: 'dias', title: 'Dias e horários', question: 'Há dias da semana ou horários diferentes dos outros?', icon: Clock },
  { id: 'emocoes', title: 'Emoções', question: 'Quais emoções aparecem, juntas ou separadas?', icon: Heart },
  { id: 'energia', title: 'Energia e disposição', question: 'Como sua energia varia e o que a acompanha?', icon: BatteryLow },
  { id: 'atividades', title: 'Atividades e estratégias', question: 'O que você fez e como avaliou o que tentou?', icon: Activity },
  { id: 'evolucao', title: 'Evolução e comparação', question: 'Como as coisas mudaram ao longo do tempo?', icon: GitCompareArrows },
  { id: 'linha', title: 'Linha do tempo', question: 'O que estava acontecendo em cada período?', icon: Flag },
  { id: 'contextos', title: 'Padrões por contexto', question: 'Que marcadores aparecem associados a quê?', icon: Layers3 },
  { id: 'calendario', title: 'Calendário emocional', question: 'Um mês de cada vez.', icon: CalendarDays },
  { id: 'regularidade', title: 'Regularidade dos registros', question: 'Quando você costuma registrar (só descritivo).', icon: Repeat2 },
] as const;

function Note({ children }: { children: ReactNode }) {
  return (
    <p className="xs muted" style={{ margin: '10px 0 0' }}>
      {children}
    </p>
  );
}

function VerdictText({ v, what }: { v: Verdict; what: string }) {
  if (!v.ok) return <p className="small muted" style={{ margin: 0 }}>{v.reason}</p>;
  const h = v.h;
  return (
    <p style={{ margin: 0 }}>
      Nos registros disponíveis, <strong>{h.label}</strong> apresentou a maior proporção de {what} ({pct(h.share)}; em seguida, {h.runnerUpLabel}, com {pct(h.runnerUpShare!)}).{' '}
      <span className="small muted">
        Foram considerados {h.records} registro(s) em {h.dates} data(s) nesse dia, de um total de {h.totalRecords} registro(s) em {h.totalDates} data(s).{' '}
        {h.unit === 'day' ? 'Cada data pesa o mesmo.' : 'Cada registro pesa o mesmo.'} Isso descreve os dados registrados — não estabelece que esse seja seu melhor ou pior dia.
      </span>
    </p>
  );
}

function UnitToggle({ unit, setUnit }: { unit: Unit; setUnit: (u: Unit) => void }) {
  return (
    <Segmented
      ariaLabel="Unidade de análise"
      value={unit}
      onChange={setUnit}
      options={[
        { value: 'day', label: 'Cada data pesa igual' },
        { value: 'record', label: 'Cada registro' },
      ]}
    />
  );
}

function Insufficient({ n, need, what = 'registros' }: { n: number; need: number; what?: string }) {
  return (
    <div className="card dashed small muted">
      Ainda não há observações suficientes ({n} de pelo menos {need} {what}). Isso aparece sozinho quando houver mais dados — sem pressa.
    </div>
  );
}

/* ------------------------------------------------------------------------ */
export function TrajectoryCategory() {
  const route = useRoute();
  const cat = CATEGORIES.find((c) => c.id === route.parts[1]);
  const t = useTrajectory();
  if (!cat)
    return (
      <Page back="/trajetoria" noNav title="Categoria não encontrada">
        <span />
      </Page>
    );
  const Body = BODIES[cat.id];
  return (
    <Page back="/trajetoria" noNav kicker="Trajetória" title={cat.title} subtitle={cat.question} ghost={cat.title.split(' ')[0].toLowerCase()}>
      <PeriodBar />
      <div style={{ marginTop: 8 }}>{t.entries.length === 0 && cat.id !== 'linha' && cat.id !== 'atividades' ? <Empty title="Sem registros neste recorte">Escolha outro período ou ajuste os filtros.</Empty> : <Body />}</div>
    </Page>
  );
}

/* ------------------------------------------------------------------------ */
/* Dias e horários                                                           */
/* ------------------------------------------------------------------------ */
function DaysBody() {
  const t = useTrajectory();
  const [unit, setUnit] = useState<Unit>('day');
  const labels = t.data.preferences.valenceLabels;
  const vLabels = [-2, -1, 0, 1, 2].map((v) => valenceLabel(v, labels));
  const emo = new Map(t.data.emotions.map((e) => [e.id, e.label]));
  const ws = t.data.preferences.weekStartsOn;
  const order = Array.from({ length: 7 }, (_, i) => (i + ws) % 7);
  const stats = weekdayStats(t.entries);
  const best = weekdayHighlight(t.entries, (m) => isPleasant(m.valence), unit);
  const worst = weekdayHighlight(t.entries, (m) => isUnpleasant(m.valence), unit);
  const withEnergy = t.entries.filter((m) => m.energy);
  const lowE = weekdayHighlight(withEnergy, (m) => (m.energy ?? 5) <= 2, unit);
  const parts = dayPartStats(t.entries);
  const wd = withinDay(t.entries);
  const wIdx = weekdayIndex(t.entries);
  const weightedCounts = (list: MoodEntry[], pick: (m: MoodEntry) => number | null) => {
    if (unit === 'record') {
      const c = [0, 0, 0, 0, 0];
      list.forEach((m) => {
        const v = pick(m);
        if (v !== null) c[v]++;
      });
      return c;
    }
    const byDay = new Map<string, number[]>();
    list.forEach((m) => {
      const v = pick(m);
      if (v !== null) byDay.set(m.at.slice(0, 10), [...(byDay.get(m.at.slice(0, 10)) ?? []), v]);
    });
    const c = [0, 0, 0, 0, 0];
    byDay.forEach((vals) => vals.forEach((v) => (c[v] += 1 / vals.length)));
    return c;
  };

  return (
    <>
      <Section title="Índice por dia da semana" kicker="Quais dias tendem a ser avaliados de forma mais agradável">
        <div className="card stack lg">
          {wIdx.highest && wIdx.lowest ? (
            <p style={{ margin: 0 }}>
              Neste recorte, <strong>{WEEKDAYS_FULL[wIdx.highest.wd].toLowerCase()}</strong> teve o índice mais alto ({fmtIndex(wIdx.highest.index)}, em {wIdx.highest.dates} datas) e{' '}
              <strong>{WEEKDAYS_FULL[wIdx.lowest.wd].toLowerCase()}</strong> o mais baixo ({fmtIndex(wIdx.lowest.index)}, em {wIdx.lowest.dates} datas).
            </p>
          ) : (
            <p className="small muted" style={{ margin: 0 }}>
              {wIdx.reason}
            </p>
          )}
          <IndexBars
            rows={order.map((d) => {
              const x = wIdx.days[d];
              return {
                label: WEEKDAYS_FULL[d],
                index: x.index,
                note: `${x.records} reg. · ${x.dates} data(s)`,
                dim: !x.eligible,
                tag: wIdx.highest?.wd === d ? 'mais alto' : wIdx.lowest?.wd === d ? 'mais baixo' : undefined,
              };
            })}
          />
          <Note>
            Índice descritivo de −2 a +2: primeiro a média dos registros de cada data, depois a média das datas daquele dia da semana — uma data com muitos registros não pesa mais. A
            escala é ordinal, então o índice é uma aproximação, não uma medida. Dias com menos de {WEEKDAY_INDEX_MIN_DATES} datas aparecem esmaecidos e não entram no destaque; dias sem
            registro não contam como neutros. É uma associação com o dia da semana, não uma causa.
          </Note>
        </div>
      </Section>
      <UnitToggle unit={unit} setUnit={setUnit} />
      <Section title="Os cinco níveis em cada dia da semana">
        <div className="card stack lg">
          <VerdictText v={best} what="avaliações agradáveis" />
          <VerdictText v={worst} what="avaliações desagradáveis" />
          <StackRows
            colors={MOOD_COLORS}
            legend={vLabels}
            rows={order.map((d) => ({
              label: WEEKDAYS_FULL[d],
              counts: weightedCounts(stats[d].entries, (m) => m.valence + 2),
              note: `${stats[d].records} reg. · ${stats[d].dates} data(s)`,
              dim: stats[d].dates < WEEKDAY_MIN_DATES,
            }))}
          />
          <Note>Dias com menos de {WEEKDAY_MIN_DATES} datas aparecem esmaecidos e não entram nas comparações.</Note>
        </div>
      </Section>
      {withEnergy.length > 0 && (
        <Section title="Energia por dia da semana">
          <div className="card stack lg">
            <VerdictText v={lowE} what="registros de baixa energia" />
            <StackRows
              colors={ENERGY_COLORS}
              legend={[1, 2, 3, 4, 5].map((e) => energyLabel(e, t.data.preferences.energyLabels))}
              rows={order.map((d) => ({
                label: WEEKDAYS_FULL[d],
                counts: weightedCounts(stats[d].entries, (m) => (m.energy ? m.energy - 1 : null)),
                note: `${stats[d].entries.filter((m) => m.energy).length} reg.`,
                dim: new Set(stats[d].entries.filter((m) => m.energy).map((m) => m.at.slice(0, 10))).size < WEEKDAY_MIN_DATES,
              }))}
            />
          </div>
        </Section>
      )}
      <Section title="Emoções mais frequentes em cada dia">
        <div className="list">
          {order.map((d) => (
            <div key={d} className="list-row" style={{ minHeight: 44 }}>
              <span style={{ width: 92, fontWeight: 600 }}>{WEEKDAYS_FULL[d]}</span>
              <span className="grow small muted">
                {stats[d].topEmotions.length ? stats[d].topEmotions.map((e) => `${emo.get(e.id)} (${e.count})`).join(', ') : '—'}
              </span>
            </div>
          ))}
        </div>
        <Note>Contagem de registros em que cada emoção apareceu naquele dia da semana.</Note>
      </Section>
      <Section title="Períodos do dia">
        <div className="card">
          <StackRows
            colors={MOOD_COLORS}
            legend={vLabels}
            rows={parts.parts.map((p) => ({
              label: p.label,
              counts: weightedCounts(p.entries, (m) => m.valence + 2),
              note: `${p.records} reg. · ${p.records ? pct(p.entries.filter((m) => isPleasant(m.valence)).length / p.records) + ' agradáveis' : ''}`,
              dim: p.dates < WEEKDAY_MIN_DATES,
            }))}
          />
          <Note>
            Madrugada 0–5 h · manhã 6–11 h · tarde 12–17 h · noite 18–23 h. {parts.untimed ? `${parts.untimed} registro(s) sem horário ficaram de fora.` : ''}
          </Note>
        </div>
      </Section>
      <Section title="Ao longo do mesmo dia">
        <div className="card">
          {wd.days < 3 ? (
            <p className="small muted" style={{ margin: 0 }}>
              Ainda são poucas as datas com dois ou mais registros com horário ({wd.days}) para observar a variação dentro do dia.
            </p>
          ) : (
            <p style={{ margin: 0 }}>
              Em {wd.days} data(s) com dois ou mais registros, a avaliação mudou de categoria ao longo do dia em {wd.varied} ({pct(wd.varied / wd.days)}). Do primeiro ao último registro
              do dia: subiu em {wd.up}, desceu em {wd.down} e ficou igual em {wd.same}.
            </p>
          )}
        </div>
      </Section>
    </>
  );
}

/* ------------------------------------------------------------------------ */
/* Emoções                                                                   */
/* ------------------------------------------------------------------------ */
function EmotionsBody() {
  const t = useTrajectory();
  const emo = new Map(t.data.emotions.map((e) => [e.id, e.label]));
  const counts = emotionCounts(t.entries);
  const pleasant = t.entries.filter((m) => isPleasant(m.valence));
  const unpleasant = t.entries.filter((m) => isUnpleasant(m.valence));
  const pairs = emotionPairs(t.entries).slice(0, 6);
  const upairs = emotionPairs(unpleasant).slice(0, 4);
  const top = counts.slice(0, 6).map((c) => c.id);
  const byMonth = emotionsByMonth(t.allFiltered.filter((m) => m.at.slice(0, 10) <= t.range.to), top, 6);
  const prev = new Map(emotionCounts(t.prevEntries).map((c) => [c.id, c]));
  const changes = counts
    .filter((c) => c.count >= 3 || (prev.get(c.id)?.count ?? 0) >= 3)
    .map((c) => ({ id: c.id, now: c.share, before: prev.get(c.id)?.share ?? 0 }))
    .filter((c) => Math.abs(c.now - c.before) >= 0.1)
    .sort((a, b) => Math.abs(b.now - b.before) - Math.abs(a.now - a.before))
    .slice(0, 5);
  const withEmo = t.entries.filter((m) => m.emotionIds.length).length;
  if (!withEmo) return <Empty title="Nenhuma emoção registrada neste recorte">As emoções são opcionais em cada registro.</Empty>;
  const used = t.data.emotions.filter((e) => !e.hidden);
  const rare = used.map((e) => ({ e, n: counts.find((c) => c.id === e.id)?.count ?? 0 })).sort((a, b) => a.n - b.n);
  return (
    <>
      <Section title="Mais frequentes">
        <div className="card">
          <Bars rows={counts.slice(0, 10).map((c) => ({ label: emo.get(c.id) ?? '?', value: c.count, note: `${c.count} · ${pct(c.share)}` }))} />
          <Note>Em quantos dos {t.entries.length} registros cada emoção apareceu ({withEmo} registros têm ao menos uma emoção).</Note>
        </div>
      </Section>
      <Section title="Menos frequentes">
        <div className="card small">
          {rare.slice(0, 8).map(({ e, n }) => `${e.label} (${n})`).join(' · ')}
          <Note>Entre as emoções disponíveis na sua lista. Pouca frequência não é bom nem ruim.</Note>
        </div>
      </Section>
      <Section title="Em registros agradáveis e desagradáveis">
        <div className="grid-2">
          {[
            ['Agradáveis', pleasant],
            ['Desagradáveis', unpleasant],
          ].map(([label, list]) => (
            <div key={label as string} className="card tight">
              <p className="kicker">
                {label as string} · {(list as MoodEntry[]).length}
              </p>
              {(list as MoodEntry[]).length < 3 ? (
                <p className="xs muted">Poucos registros.</p>
              ) : (
                emotionCounts(list as MoodEntry[])
                  .slice(0, 5)
                  .map((c) => (
                    <div key={c.id} className="row between small">
                      <span>{emo.get(c.id)}</span>
                      <span className="muted">{pct(c.share)}</span>
                    </div>
                  ))
              )}
            </div>
          ))}
        </div>
      </Section>
      <Section title="Emoções que aparecem juntas">
        <div className="card">
          {pairs.length === 0 ? (
            <p className="small muted" style={{ margin: 0 }}>
              Nenhum par de emoções apareceu junto duas vezes ou mais.
            </p>
          ) : (
            <div className="stack" style={{ gap: 6 }}>
              {pairs.map((p) => (
                <div key={p.a + p.b} className="row between small">
                  <span>
                    {emo.get(p.a)} + {emo.get(p.b)}
                  </span>
                  <span className="muted">
                    {p.together}× · {pct(p.together / p.either)} das vezes em que alguma apareceu
                  </span>
                </div>
              ))}
            </div>
          )}
          {upairs.length > 0 && (
            <>
              <p className="kicker" style={{ marginTop: 14 }}>
                Só nos registros desagradáveis ({unpleasant.length})
              </p>
              {upairs.map((p) => (
                <p key={p.a + p.b} className="small" style={{ margin: '4px 0' }}>
                  {emo.get(p.a)} e {emo.get(p.b)} apareceram juntas em {p.together} ocasião(ões) ({pct(p.together / unpleasant.length)} dos registros desagradáveis).
                </p>
              ))}
            </>
          )}
        </div>
      </Section>
      {byMonth.months.length >= 2 && (
        <Section title="Ao longo dos meses">
          <div className="card">
            <HeatTable
              rowLabels={byMonth.rows.map((r) => emo.get(r.id) ?? '?')}
              colLabels={byMonth.months.map(monthLabel)}
              values={byMonth.rows.map((r) => r.values.map((v) => v.n))}
              caption={`Registros com cada emoção por mês. Total de registros por mês: ${byMonth.rows[0]?.values.map((v) => v.total).join(', ')}.`}
            />
          </div>
        </Section>
      )}
      <Section title="Mudanças em relação ao período anterior">
        <div className="card small">
          {t.prevEntries.length < 5 ? (
            <span className="muted">Poucos registros no período anterior ({t.prevEntries.length}) para comparar.</span>
          ) : changes.length === 0 ? (
            <span className="muted">Nenhuma emoção mudou de frequência em 10 pontos percentuais ou mais.</span>
          ) : (
            changes.map((c) => (
              <div key={c.id} className="row between">
                <span>{emo.get(c.id)}</span>
                <span className="muted">
                  {pct(c.before)} → {pct(c.now)}
                </span>
              </div>
            ))
          )}
          <Note>
            Proporção de registros com a emoção: período anterior ({t.prevEntries.length} registros) → atual ({t.entries.length}).
          </Note>
        </div>
      </Section>
    </>
  );
}

/* ------------------------------------------------------------------------ */
/* Energia                                                                   */
/* ------------------------------------------------------------------------ */
function EnergyBody() {
  const t = useTrajectory();
  const prefs = t.data.preferences;
  const withE = t.entries.filter((m) => m.energy);
  const emo = new Map(t.data.emotions.map((e) => [e.id, e.label]));
  const eLabels = [1, 2, 3, 4, 5].map((e) => energyLabel(e, prefs.energyLabels));
  const vLabels = [-2, -1, 0, 1, 2].map((v) => valenceLabel(v, prefs.valenceLabels));
  if (withE.length === 0) return <Empty title="Nenhum registro com energia neste recorte">O nível de energia é opcional em cada registro.</Empty>;
  const evo = buckets(withE, { from: new Date(t.range.from + 'T00:00:00'), to: new Date(t.range.to + 'T23:59:59') }, (e) => (e.energy ? e.energy - 1 : null), prefs.weekStartsOn);
  const table = energyValenceTable(withE);
  const low = withE.filter((m) => m.energy! <= 2);
  const lowEmo = emotionCounts(low).slice(0, 5);
  const ext = extremesOfEnergy(withE);
  const exhausted = monthlyCount(t.allFiltered.filter((m) => m.energy && m.at.slice(0, 10) <= t.range.to), (m) => m.energy === 1, 6);
  const prevE = t.prevEntries.filter((m) => m.energy);
  return (
    <>
      <Section title="Distribuição">
        <div className="card">
          <Distribution labels={eLabels} colors={ENERGY_COLORS} counts={energyCounts(withE)} compare={t.period.compare && prevE.length ? energyCounts(prevE) : null} />
          <Note>{withE.length} registro(s) com energia. Ative “comparar com o período anterior” na visão geral para ver as duas barras.</Note>
        </div>
      </Section>
      <Section title="Evolução">
        <div className="card">
          <Evolution buckets={evo.items} colors={ENERGY_COLORS} labels={eLabels} unit={evo.unit} height={120} />
        </div>
      </Section>
      <Section title="Energia e humor">
        <div className="card">
          <HeatTable rowLabels={eLabels} colLabels={vLabels.map((l) => l.split(' ').map((w) => w[0]).join('').toUpperCase())} values={table} caption={`Quantos registros combinaram cada nível de energia (linhas) com cada avaliação (colunas: ${vLabels.join(', ')}). É uma descrição conjunta, não uma relação de causa.`} />
        </div>
      </Section>
      <Section title="Emoções em registros de baixa energia">
        <div className="card small">
          {low.length < 3 ? (
            <span className="muted">Poucos registros de baixa energia ({low.length}).</span>
          ) : (
            lowEmo.map((c) => (
              <div key={c.id} className="row between">
                <span>{emo.get(c.id)}</span>
                <span className="muted">
                  {c.count} de {low.length} ({pct(c.share)})
                </span>
              </div>
            ))
          )}
        </div>
      </Section>
      <Section title="Esgotamento e extremos">
        <div className="card small stack">
          <div>
            <strong>Registros de “{eLabels[0]}” por mês:</strong> {exhausted.map((m) => `${monthLabel(m.month)}: ${m.n} de ${m.total}`).join(' · ') || '—'}
          </div>
          <div>
            <strong>Datas com energia máxima registrada:</strong> {ext.highest.slice(0, 6).map((d) => fmtDate(d, { short: true })).join(', ') || '—'}
          </div>
          <div>
            <strong>Datas com energia mínima registrada:</strong> {ext.lowest.slice(0, 6).map((d) => fmtDate(d, { short: true })).join(', ') || '—'}
          </div>
          <Note>Essas informações descrevem seus registros; o Palimpsesto não interpreta níveis de energia como sinais clínicos.</Note>
        </div>
      </Section>
    </>
  );
}

/* ------------------------------------------------------------------------ */
/* Atividades e estratégias                                                  */
/* ------------------------------------------------------------------------ */
function ActivitiesBody() {
  const t = useTrajectory();
  const items = new Map(t.data.repertoire.map((i) => [i.id, i]));
  const acts = activityStats(t.entries).filter((a) => items.has(a.itemId));
  const groups = strategyGroups(t.uses).filter((g) => items.has(g.itemId));
  const hard = difficultMoments(t.data, t.entries, t.uses).filter((x) => items.has(x.itemId)).slice(0, 6);
  const overallPleasant = t.entries.length ? t.entries.filter((m) => isPleasant(m.valence)).length / t.entries.length : 0;
  const expWith = t.experiences.filter((x) => x.feelingBefore !== null && x.feelingAfter !== null && t.data.uses.some((u) => u.experienceId === x.id));
  const byItemExp = new Map<string, { up: number; same: number; down: number }>();
  expWith.forEach((x) =>
    t.data.uses
      .filter((u) => u.experienceId === x.id)
      .forEach((u) => {
        const c = byItemExp.get(u.itemId) ?? { up: 0, same: 0, down: 0 };
        const d = x.feelingAfter! - x.feelingBefore!;
        if (d > 0) c.up++;
        else if (d < 0) c.down++;
        else c.same++;
        byItemExp.set(u.itemId, c);
      }),
  );
  const usage = (id: string) => monthlyCount(t.allFiltered.filter((m) => m.at.slice(0, 10) <= t.range.to), (m) => m.itemIds.includes(id), 6);
  const groupLabels = { effective: 'Avaliadas como eficazes', partial: 'Parcialmente eficazes', ineffective: 'Não funcionaram ou pioraram', unknown: 'Ainda sem avaliação' } as const;

  return (
    <>
      <Section title="Atividades nos registros de humor">
        {acts.length === 0 ? (
          <div className="card dashed small muted">
            Nenhuma atividade marcada nos registros deste recorte. Ao registrar o humor, use “O que você fez ou estava fazendo?” — você pode criar suas próprias atividades.
          </div>
        ) : (
          <div className="stack">
            {acts.map((a) => {
              const it = items.get(a.itemId)!;
              const enough = a.records >= ACTIVITY_MIN && a.othersRecords >= ACTIVITY_MIN;
              const months = usage(a.itemId);
              return (
                <div key={a.itemId} className="card tight">
                  <div className="row between">
                    <button style={{ background: 'none', border: 0, padding: 0, fontWeight: 600, color: 'inherit' }} onClick={() => navigate(`/guia/item/${a.itemId}`)}>
                      {it.name}
                    </button>
                    <span className="xs muted">
                      {a.records} reg. · {a.dates} data(s)
                    </span>
                  </div>
                  <div className="stack" style={{ gap: 4, marginTop: 8 }}>
                    <div className="row between xs">
                      <span>Com a atividade</span>
                      <span className="muted">{pct(a.pleasantShare)} agradáveis · {pct(a.unpleasantShare)} desagradáveis</span>
                    </div>
                    <div className="row between xs">
                      <span>Demais registros ({a.othersRecords})</span>
                      <span className="muted">{pct(a.othersPleasantShare)} agradáveis</span>
                    </div>
                  </div>
                  {a.change.compared > 0 && (
                    <p className="xs" style={{ margin: '6px 0 0' }}>
                      Comparado ao registro anterior do mesmo dia ({a.change.compared} vez(es)): melhor em {a.change.up}, igual em {a.change.same}, pior em {a.change.down}.
                    </p>
                  )}
                  {months.length > 1 && (
                    <p className="xs faint" style={{ margin: '6px 0 0' }}>
                      Por mês: {months.map((m) => `${monthLabel(m.month)} ${m.n}`).join(' · ')}
                    </p>
                  )}
                  {!enough && <p className="xs faint" style={{ margin: '6px 0 0' }}>Poucos registros para comparar com segurança.</p>}
                  <button
                    className="btn ghost sm"
                    style={{ paddingLeft: 0 }}
                    onClick={() => {
                      setSharedFilters({ ...NO_FILTERS, itemIds: [a.itemId], type: 'mood' });
                      navigate('/diario');
                    }}
                  >
                    Ver registros
                  </button>
                </div>
              );
            })}
            <Note>Proporção geral de registros agradáveis no recorte: {pct(overallPleasant)}. Uma atividade que aparece com registros agradáveis não necessariamente os causa.</Note>
          </div>
        )}
      </Section>

      <Section title="Estratégias e recursos avaliados">
        {groups.length === 0 ? (
          <div className="card dashed small muted">Nenhum uso avaliado neste recorte. Registre usos na página de cada item do Repertório ou ao escrever uma experiência.</div>
        ) : (
          <div className="stack">
            {(['effective', 'partial', 'ineffective', 'unknown'] as const).map((g) => {
              const list = groups.filter((x) => x.group === g);
              if (!list.length) return null;
              return (
                <div key={g} className="card tight">
                  <p className="kicker">{groupLabels[g]}</p>
                  <div className="stack" style={{ gap: 10 }}>
                    {list.map((x) => (
                      <div key={x.itemId}>
                        <div className="row between small">
                          <span>{items.get(x.itemId)!.name}</span>
                          <span className="xs muted">{x.uses} uso(s)</span>
                        </div>
                        <div style={{ marginTop: 4 }}>
                          <OutcomeBar counts={x.counts} />
                        </div>
                      </div>
                    ))}
                  </div>
                </div>
              );
            })}
            <OutcomeLegend />
            <Note>Agrupamento pela avaliação mais frequente que você deu; em empate, vale a mais cautelosa.</Note>
          </div>
        )}
      </Section>

      {hard.length > 0 && (
        <Section title="Mais usados em momentos difíceis">
          <div className="card">
            <Bars rows={hard.map((h) => ({ label: items.get(h.itemId)!.name, value: h.n }))} color="var(--comp1-ink)" />
            <Note>Usos marcados como “dia difícil”, usados em experiências que começaram desagradáveis ou marcados em registros desagradáveis.</Note>
          </div>
        </Section>
      )}

      {byItemExp.size > 0 && (
        <Section title="Antes e depois, nas experiências">
          <div className="card small">
            {[...byItemExp.entries()].map(([id, c]) => (
              <div key={id} className="row between">
                <span>{items.get(id)?.name}</span>
                <span className="muted">
                  melhorou {c.up} · igual {c.same} · piorou {c.down}
                </span>
              </div>
            ))}
            <Note>Como você se sentiu antes e depois em experiências nas quais o item foi usado. Muitas coisas acontecem ao mesmo tempo; não é medida de eficácia.</Note>
          </div>
        </Section>
      )}
    </>
  );
}

/* ------------------------------------------------------------------------ */
/* Evolução e comparação                                                     */
/* ------------------------------------------------------------------------ */
function EvolutionBody() {
  const t = useTrajectory();
  const prefs = t.data.preferences;
  const vLabels = [-2, -1, 0, 1, 2].map((v) => valenceLabel(v, prefs.valenceLabels));
  const emo = new Map(t.data.emotions.map((e) => [e.id, e.label]));
  const evo = buckets(t.entries, { from: new Date(t.range.from + 'T00:00:00'), to: new Date(t.range.to + 'T23:59:59') }, (e) => e.valence + 2, prefs.weekStartsOn);
  const heavy = weeklyUnpleasant(t.entries, prefs.weekStartsOn).filter((w) => w.unpleasant > 0).slice(0, 3);
  // Comparação livre entre dois períodos: semanas, meses ou datas quaisquer.
  const ws = prefs.weekStartsOn;
  const today = t.range.to;
  const prevWeekDay = dayKeyOf(new Date(new Date(today + 'T12:00:00').getTime() - 7 * 86400000));
  const thisMonth = today.slice(0, 7);
  const prevMonth = (() => {
    const d = new Date(today + 'T12:00:00');
    d.setDate(1);
    d.setMonth(d.getMonth() - 1);
    return dayKeyOf(d).slice(0, 7);
  })();
  const [mode, setMode] = useState<'week' | 'month' | 'free'>('week');
  const [wA, setWA] = useState(prevWeekDay);
  const [wB, setWB] = useState(today);
  const [mA, setMA] = useState(prevMonth);
  const [mB, setMB] = useState(thisMonth);
  const [a, setA] = useState({ from: t.prevRange.from, to: t.prevRange.to });
  const [b, setB] = useState({ from: t.range.from, to: today });
  const rA = mode === 'week' ? weekRange(wA, ws) : mode === 'month' ? monthRange(mA) : a;
  const rB = mode === 'week' ? weekRange(wB, ws) : mode === 'month' ? monthRange(mB) : b;
  const pick = (r: { from: string; to: string }) => t.allFiltered.filter((m) => inDays(m.at.slice(0, 10), r));
  const A = pick(rA);
  const B = pick(rB);
  const cmp = compareIndex(A, B);
  const extra = (list: MoodEntry[]) => {
    const n = list.length;
    return {
      pleasant: n ? list.filter((m) => isPleasant(m.valence)).length / n : 0,
      unpleasant: n ? list.filter((m) => isUnpleasant(m.valence)).length / n : 0,
      lowEnergy: list.filter((m) => m.energy).length ? list.filter((m) => m.energy && m.energy <= 2).length / list.filter((m) => m.energy).length : null,
      topEmotions: emotionCounts(list).slice(0, 3),
    };
  };
  const ea = extra(A);
  const eb = extra(B);
  const stab = stability(t.entries);
  const byMonth = new Map<string, MoodEntry[]>();
  t.entries.forEach((m) => byMonth.set(m.at.slice(0, 7), [...(byMonth.get(m.at.slice(0, 7)) ?? []), m]));
  const monthStab = [...byMonth.entries()].sort((x, y) => x[0].localeCompare(y[0])).map(([month, l]) => ({ month, ...stability(l) }));
  const rangeText = (r: { from: string; to: string }) => `${fmtDate(r.from, { short: true })} a ${fmtDate(r.to, { short: true, withYear: true })}`;
  const verdictText =
    cmp.verdict === 'insufficient'
      ? `Ainda não dá para comparar com segurança: cada período precisa de pelo menos ${COMPARE_MIN_RECORDS} registros em ${COMPARE_MIN_DATES} datas diferentes.`
      : cmp.verdict === 'same'
        ? `Sem mudança relevante: a diferença ficou abaixo de ${MIN_RELEVANT_CHANGE.toLocaleString('pt-BR')} ponto.`
        : cmp.verdict === 'up'
          ? `O índice de B ficou ${fmtIndex(cmp.delta)} ponto(s) em relação a A — avaliações, em conjunto, mais agradáveis.`
          : `O índice de B ficou ${fmtIndex(cmp.delta)} ponto(s) em relação a A — avaliações, em conjunto, menos agradáveis.`;
  return (
    <>
      <Section title="Ao longo do período">
        <div className="card">
          <Evolution buckets={evo.items} colors={MOOD_COLORS} labels={vLabels} unit={evo.unit} />
        </div>
      </Section>
      <Section title="Comparar dois períodos" kicker="Quaisquer duas semanas, dois meses ou dois intervalos">
        <div className="card stack lg">
          <Segmented
            ariaLabel="Tipo de período"
            value={mode}
            onChange={setMode}
            options={[
              { value: 'week', label: 'Semanas' },
              { value: 'month', label: 'Meses' },
              { value: 'free', label: 'Datas livres' },
            ]}
          />
          {(
            [
              ['A', rA, cmp.a, ea],
              ['B', rB, cmp.b, eb],
            ] as const
          ).map(([name, r, sm, e]) => (
            <div key={name} className="stack" style={{ gap: 6 }}>
              <div className="row" style={{ gap: 6 }}>
                <strong style={{ width: 18 }}>{name}</strong>
                {mode === 'week' && (
                  <input
                    type="date"
                    className="input"
                    aria-label={`Um dia da semana ${name}`}
                    value={name === 'A' ? wA : wB}
                    onChange={(ev) => ev.target.value && (name === 'A' ? setWA : setWB)(ev.target.value)}
                  />
                )}
                {mode === 'month' && (
                  <input
                    type="month"
                    className="input"
                    aria-label={`Mês ${name}`}
                    value={name === 'A' ? mA : mB}
                    onChange={(ev) => ev.target.value && (name === 'A' ? setMA : setMB)(ev.target.value)}
                  />
                )}
                {mode === 'free' && (
                  <>
                    <input type="date" className="input" aria-label={`Início do intervalo ${name}`} value={r.from} max={r.to} onChange={(ev) => ev.target.value && (name === 'A' ? setA : setB)({ ...r, from: ev.target.value })} />
                    <input type="date" className="input" aria-label={`Fim do intervalo ${name}`} value={r.to} min={r.from} onChange={(ev) => ev.target.value && (name === 'A' ? setA : setB)({ ...r, to: ev.target.value })} />
                  </>
                )}
              </div>
              <div className="row between small">
                <span className="muted">{rangeText(r)}</span>
                <span>
                  índice <strong>{fmtIndex(sm.index)}</strong>
                </span>
              </div>
              <div className="stackbar" role="img" aria-label={vLabels.map((l, i) => `${l}: ${pct(sm.shares[i])}`).join(', ')}>
                {sm.shares.map((x, i) => (x ? <div key={i} style={{ width: `${x * 100}%`, background: MOOD_COLORS[i] }} /> : null))}
              </div>
              <p className="xs muted" style={{ margin: 0 }}>
                {sm.records} registro(s) em {sm.dates} data(s)
                {sm.records ? ` · ${pct(e.pleasant)} agradáveis · ${pct(e.unpleasant)} desagradáveis` : ''}
                {e.lowEnergy !== null ? ` · ${pct(e.lowEnergy)} com baixa energia` : ''}
                {e.topEmotions.length ? ` · mais frequentes: ${e.topEmotions.map((x) => emo.get(x.id)).join(', ')}` : ''}
              </p>
            </div>
          ))}
          <div className={`notice ${cmp.verdict === 'insufficient' ? '' : 'calm'} small`} aria-live="polite">
            {cmp.delta !== null && cmp.verdict !== 'insufficient' && (
              <strong style={{ display: 'block', marginBottom: 2 }}>
                Diferença: {fmtIndex(cmp.delta)} ponto(s) {cmp.verdict === 'up' ? '↑' : cmp.verdict === 'down' ? '↓' : '≈'}
              </strong>
            )}
            {verdictText}
          </div>
          <Note>
            Índice de −2 a +2 com peso igual por data (média de cada data, depois média das datas); a barra mostra os cinco níveis com o mesmo peso. É um resumo descritivo de uma
            escala ordinal, não uma medida clínica, e não diz por que algo mudou. Os mesmos filtros da Trajetória valem aqui.
          </Note>
        </div>
      </Section>
      <Section title="Estabilidade das avaliações" kicker="Quanto as avaliações variaram — não quão boas foram">
        <div className="card stack lg">
          {stab.score === null ? (
            <p className="small muted" style={{ margin: 0 }}>
              É preciso ter pelo menos {STABILITY_MIN_RECORDS} registros em {STABILITY_MIN_DATES} datas diferentes neste recorte (há {stab.records} em {stab.dates}).
            </p>
          ) : (
            <div className="row" style={{ gap: 16, alignItems: 'center' }}>
              <div className="card tight stat" style={{ minWidth: 92, textAlign: 'center' }}>
                <span className="n">{stab.score}</span>
                <span className="l">de 100</span>
              </div>
              <StabilityStrip entries={t.entries} />
            </div>
          )}
          {stab.score !== null && (
            <p className="xs muted" style={{ margin: 0 }}>
              {rangeText(t.range)} · {stab.records} registros em {stab.dates} datas · desvio-padrão {stab.sd!.toLocaleString('pt-BR', { maximumFractionDigits: 2 })}
            </p>
          )}
          {monthStab.length > 1 && (
            <div className="stack" style={{ gap: 4 }}>
              {monthStab.map((m) => (
                <div key={m.month} className="row between small">
                  <span>{monthLabel(m.month)}</span>
                  <span className="muted">{m.score === null ? `poucos registros (${m.records})` : `${m.score} · ${m.records} reg. em ${m.dates} datas`}</span>
                </div>
              ))}
            </div>
          )}
          <Note>
            Estabilidade = 100 × (1 − desvio-padrão ÷ 2), entre 0 e 100. Quanto mais alto, menos as avaliações variaram entre si. <strong>Estabilidade não é bem-estar:</strong> uma
            sequência só de avaliações desagradáveis também é muito estável. O indicador é descritivo e não diz nada sobre causas.
          </Note>
        </div>
      </Section>
      <Section title="Semanas com mais registros desagradáveis">
        <div className="card small">
          {heavy.length === 0 ? (
            <span className="muted">Nenhuma semana com 3 ou mais registros e algum desagradável.</span>
          ) : (
            heavy.map((w) => (
              <div key={w.week} className="row between">
                <span>Semana de {fmtDate(w.week, { short: true })}</span>
                <span className="muted">
                  {w.unpleasant} de {w.records} ({pct(w.share)})
                </span>
              </div>
            ))
          )}
          <Note>Consideradas só semanas com pelo menos 3 registros.</Note>
        </div>
      </Section>
    </>
  );
}

/** Cada registro do recorte, em ordem, na altura do seu nível; a faixa mostra média ± desvio-padrão. */
function StabilityStrip({ entries }: { entries: MoodEntry[] }) {
  const list = [...entries].sort((x, y) => x.at.localeCompare(y.at));
  const n = list.length;
  const v = list.map((m) => m.valence);
  const mu = v.reduce((x, y) => x + y, 0) / n;
  const sd = Math.sqrt(v.reduce((x, y) => x + (y - mu) ** 2, 0) / n);
  const W = 220;
  const H = 64;
  const y = (val: number) => 6 + ((2 - val) / 4) * (H - 12);
  const x = (i: number) => (n === 1 ? W / 2 : 6 + (i / (n - 1)) * (W - 12));
  return (
    <svg viewBox={`0 0 ${W} ${H}`} className="grow" style={{ width: '100%', height: 'auto', maxHeight: 90 }} role="img" aria-label={`${n} registros; faixa de variação em torno da média`}>
      <rect x={0} y={y(Math.min(2, mu + sd))} width={W} height={Math.max(1, y(Math.max(-2, mu - sd)) - y(Math.min(2, mu + sd)))} fill="var(--surface-2)" rx={4} />
      <line x1={0} x2={W} y1={y(0)} y2={y(0)} stroke="var(--line)" strokeDasharray="3 3" />
      {list.map((m, i) => (
        <circle key={m.id} cx={x(i)} cy={y(m.valence)} r={n > 60 ? 1.8 : 2.6} fill={`var(--mood-${m.valence + 3})`} />
      ))}
    </svg>
  );
}

/* ------------------------------------------------------------------------ */
/* Linha do tempo                                                            */
/* ------------------------------------------------------------------------ */
function TimelineBody() {
  const t = useTrajectory();
  const labels = t.data.preferences.valenceLabels;
  const events = [...t.events].sort((a, b) => b.date.localeCompare(a.date));
  return (
    <>
      <p className="small muted">
        Acontecimentos do período, com os registros de humor feitos enquanto eles aconteciam. Estar no mesmo período não significa que um causou o outro.
      </p>
      {events.length === 0 ? (
        <Empty
          title="Nenhum acontecimento neste período"
          action={
            <button className="btn primary" onClick={() => navigate('/diario/acontecimento/novo')}>
              Registrar um acontecimento
            </button>
          }
        >
          Viagens, mudanças, conquistas, começos e fins — inclusive de meses atrás.
        </Empty>
      ) : (
        <div className="stack">
          {events.map((e) => {
            const during = t.entries.filter((m) => m.at.slice(0, 10) >= e.date && m.at.slice(0, 10) <= (e.endDate ?? e.date));
            const c = valenceCounts(during);
            return (
              <button key={e.id} className="card tight" onClick={() => navigate(`/diario/acontecimento/${e.id}`)}>
                <div className="row">
                  <EventIcon c={e.category} />
                  <div className="grow">
                    <div style={{ fontWeight: 600 }}>{e.title}</div>
                    <div className="xs muted">{eventRange(e)}</div>
                  </div>
                </div>
                {during.length > 0 ? (
                  <>
                    <div className="stackbar" style={{ marginTop: 8 }}>
                      {c.map((x, i) => (x ? <div key={i} style={{ width: `${(x / during.length) * 100}%`, background: MOOD_COLORS[i] }} /> : null))}
                    </div>
                    <p className="xs faint" style={{ margin: '4px 0 0' }}>
                      {during.length} registro(s) no período · mais frequente: {valenceLabel(c.indexOf(Math.max(...c)) - 2, labels).toLowerCase()}
                    </p>
                  </>
                ) : (
                  <p className="xs faint" style={{ margin: '6px 0 0' }}>Sem registros de humor nesse período.</p>
                )}
              </button>
            );
          })}
        </div>
      )}
    </>
  );
}

/* ------------------------------------------------------------------------ */
/* Padrões por contexto (associações já existentes)                          */
/* ------------------------------------------------------------------------ */
function ContextsBody() {
  const t = useTrajectory();
  const prefs = t.data.preferences;
  const res = useMemo(() => findPatterns(t.entries, { indicators: prefs.enabledIndicators }), [t.entries, prefs.enabledIndicators]);
  const emo = new Map(t.data.emotions.map((e) => [e.id, e.label]));
  if (!res.enough) return <Insufficient n={res.total} need={PATTERN_MIN_ENTRIES} />;
  const metricName = (m: string) =>
    m === 'valence' ? 'avaliação' : m === 'energy' ? 'energia' : m.startsWith('emotion:') ? (emo.get(m.slice(8)) ?? 'emoção').toLowerCase() : INDICATORS[m as keyof typeof INDICATORS]?.label.toLowerCase();
  return (
    <>
      <p className="small muted">
        Comparação dos registros com e sem cada marcador de contexto. Escalas ordenadas usam o delta de Cliff (|δ| ≥ 0,3); emoções, a diferença de proporções (≥ 25 pontos). Exige 20
        registros no período e 5 em cada grupo. São associações, não causas.
      </p>
      {res.patterns.length === 0 ? (
        <div className="card dashed small muted">Nenhuma associação forte o bastante neste recorte. Isso também é informação.</div>
      ) : (
        <div className="stack">
          {res.patterns.slice(0, 12).map((p) => (
            <div key={p.id} className="card tight" style={{ borderLeft: '3px solid var(--comp1-ink)' }}>
              <p className="xs faint" style={{ margin: 0 }}>
                “{p.tag}” × {metricName(p.metric)} · {p.withN} com o marcador, {p.withoutN} sem
              </p>
              <p style={{ margin: '4px 0 0' }}>
                {p.metric.startsWith('emotion:')
                  ? `${metricName(p.metric)} apareceu em ${pct(p.withShare)} dos registros com “${p.tag}”, contra ${pct(p.withoutShare)} nos demais.`
                  : `Com “${p.tag}”, ${pct(p.withShare)} dos registros ficaram nas duas categorias mais altas de ${metricName(p.metric)}, contra ${pct(p.withoutShare)} nos demais.`}
              </p>
            </div>
          ))}
        </div>
      )}
    </>
  );
}

function CalendarBody() {
  const t = useTrajectory();
  return <CalendarView entries={t.entries} events={t.events} experiences={t.experiences} onOpen={(id) => navigate(`/diario?registro=${id}`)} />;
}

/* ------------------------------------------------------------------------ */
/* Regularidade                                                              */
/* ------------------------------------------------------------------------ */
function RegularityBody() {
  const t = useTrajectory();
  const r = regularity(t.entries, t.range.from, t.range.to);
  const weeks = countsByWeek(t.allFiltered, 12, new Date(t.range.to + 'T12:00:00'), t.data.preferences.weekStartsOn);
  const months = monthlyCount(t.allFiltered.filter((m) => m.at.slice(0, 10) <= t.range.to), () => true, 12);
  const parts = [
    ['Madrugada', 0, 5],
    ['Manhã', 6, 11],
    ['Tarde', 12, 17],
    ['Noite', 18, 23],
  ] as const;
  return (
    <>
      <div className="notice calm small">Isto só descreve quando você registrou. Não há meta, sequência ou frequência “certa”.</div>
      <Section title="No período">
        <div className="grid-3">
          <div className="card tight stat">
            <span className="n">{r.withRecords}</span>
            <span className="l">datas com registro</span>
          </div>
          <div className="card tight stat">
            <span className="n">{r.without}</span>
            <span className="l">datas sem registro</span>
          </div>
          <div className="card tight stat">
            <span className="n">{r.retro}</span>
            <span className="l">escritos depois</span>
          </div>
        </div>
      </Section>
      <Section title="Registros por semana">
        <div className="card">
          <Bars rows={weeks.map((w) => ({ label: `sem. ${fmtDate(w.start, { short: true })}`, value: w.n }))} color="var(--comp1-ink)" />
        </div>
      </Section>
      {months.length > 1 && (
        <Section title="Registros por mês">
          <div className="card">
            <Bars rows={months.map((m) => ({ label: monthLabel(m.month), value: m.total }))} color="var(--comp1-ink)" />
          </div>
        </Section>
      )}
      <Section title="Quando você costuma escrever">
        <div className="card">
          <Bars rows={parts.map(([l, a, b]) => ({ label: l, value: r.hours.slice(a, b + 1).reduce((x, y) => x + y, 0) }))} color="var(--comp1-ink)" />
          <Note>Pelo horário em que os registros foram criados no aplicativo (não o horário em que as experiências aconteceram).</Note>
        </div>
      </Section>
    </>
  );
}

const BODIES: Record<(typeof CATEGORIES)[number]['id'], () => ReactNode> = {
  oscilacoes: () => <OscillationPanel />,
  dias: DaysBody,
  emocoes: EmotionsBody,
  energia: EnergyBody,
  atividades: ActivitiesBody,
  evolucao: EvolutionBody,
  linha: TimelineBody,
  contextos: ContextsBody,
  calendario: CalendarBody,
  regularidade: RegularityBody,
};

export { WEEKDAYS_SHORT };
