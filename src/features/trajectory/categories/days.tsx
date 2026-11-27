import { useState } from 'react';
import { dayPartStats, isPleasant, isUnpleasant, weekdayHighlight, weekdayStats, withinDay, WEEKDAYS_FULL, WEEKDAY_MIN_DATES, type Unit } from '../../../domain/insights';
import { energyLabel, valenceLabel } from '../../../domain/scales';
import type { MoodEntry } from '../../../domain/schema';
import { Section } from '../../../ui/components';
import { IndexBars, StackRows } from '../charts';
import { fmtIndex, weekdayIndex, WEEKDAY_INDEX_MIN_DATES } from '../../../domain/valence';
import { ENERGY_COLORS, MOOD_COLORS } from '../Trajectory';
import { useTrajectory } from '../useTrajectory';
import { pct, Note, VerdictText, UnitToggle } from './shared';

/* ------------------------------------------------------------------------ */
/* Dias e horários                                                           */
/* ------------------------------------------------------------------------ */
export function DaysBody() {
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
            registro não contam como neutros. “Mais alto” e “mais baixo” só aparecem quando um teste de permutação entre as datas indica que a diferença é improvável por acaso (p menor que 0,05). É uma associação com o dia da semana, não uma causa.
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
