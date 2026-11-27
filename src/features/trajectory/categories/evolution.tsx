import { useState } from 'react';
import { buckets } from '../../../domain/analytics';
import { emotionCounts, isPleasant, isUnpleasant, weeklyUnpleasant } from '../../../domain/insights';
import { valenceLabel } from '../../../domain/scales';
import type { MoodEntry } from '../../../domain/schema';
import { inDays } from '../../../domain/filters';
import { fmtDate, Section, Segmented } from '../../../ui/components';
import { Evolution } from '../charts';
import { COMPARE_MIN_DATES, COMPARE_MIN_RECORDS, compareIndex, fmtIndex, instability, MIN_RELEVANT_CHANGE, monthRange, stability, STABILITY_MIN_DATES, STABILITY_MIN_RECORDS, weekRange } from '../../../domain/valence';
import { dayKey as dayKeyOf } from '../../../domain/util';
import { MOOD_COLORS } from '../Trajectory';
import { useTrajectory } from '../useTrajectory';
import { pct, monthLabel, Note } from './shared';

/* ------------------------------------------------------------------------ */
/* Evolução e comparação                                                     */
/* ------------------------------------------------------------------------ */
export function EvolutionBody() {
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
  const inst = instability(t.entries);
  const byMonth = new Map<string, MoodEntry[]>();
  t.entries.forEach((m) => byMonth.set(m.at.slice(0, 7), [...(byMonth.get(m.at.slice(0, 7)) ?? []), m]));
  const monthStab = [...byMonth.entries()].sort((x, y) => x[0].localeCompare(y[0])).map(([month, l]) => ({ month, ...stability(l) }));
  const rangeText = (r: { from: string; to: string }) => `${fmtDate(r.from, { short: true })} a ${fmtDate(r.to, { short: true, withYear: true })}`;
  const verdictText =
    cmp.verdict === 'insufficient'
      ? `Ainda não dá para comparar com segurança: cada período precisa de pelo menos ${COMPARE_MIN_RECORDS} registros em ${COMPARE_MIN_DATES} datas diferentes.`
      : cmp.verdict === 'same'
        ? cmp.chance
          ? `Sem diferença clara: os períodos diferem em ${fmtIndex(cmp.delta)} ponto(s), mas, com esta quantidade de datas, diferenças desse tamanho aparecem com frequência por puro acaso. Mais registros ajudam a distinguir.`
          : `Sem mudança relevante: a diferença ficou abaixo de ${MIN_RELEVANT_CHANGE.toLocaleString('pt-BR')} ponto.`
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
                Diferença observada: {fmtIndex(cmp.delta)} ponto(s) {cmp.verdict === 'up' ? '↑' : cmp.verdict === 'down' ? '↓' : '≈'}
              </strong>
            )}
            {verdictText}
          </div>
          <Note>
            Índice de −2 a +2 com peso igual por data (média de cada data, depois média das datas); a barra mostra os cinco níveis com o mesmo peso. Só se diz que “subiu” ou “desceu” quando a diferença passa de 0,25 ponto e um teste de permutação entre as datas indica que ela é improvável por acaso (p menor que 0,05). É um resumo descritivo de uma
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
          {inst.rmssd !== null && (
            <div className="card tight soft small">
              <strong>De um registro para o seguinte:</strong> variação de {inst.rmssd.toLocaleString('pt-BR', { maximumFractionDigits: 2 })} nível(is) (RMSSD, em {inst.pairs} pares
              de registros); em {pct(inst.bigJumps ?? 0)} deles a avaliação mudou 2 níveis ou mais.
              <span className="faint">
                {' '}
                A estabilidade acima olha o conjunto; esta medida olha a ordem — oscilações rápidas, de um registro para o próximo, pesam mais que uma mudança lenta. Pares separados por mais de 3
                dias não entram. O valor depende do ritmo de registro (vários por dia ou um a cada poucos dias): compare períodos em que você registrou com frequência parecida.
              </span>
            </div>
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
