import { useMemo, useState } from 'react';
import { FileText, Info, Lightbulb } from 'lucide-react';
import { navigate } from '../../app/router';
import { useData } from '../../app/store';
import {
  buckets,
  emotionFrequency,
  energyCounts,
  findPatterns,
  inPeriod,
  indicatorCounts,
  medianCategory,
  mostUsedItems,
  PATTERN_MIN_ENTRIES,
  periodPreset,
  previousPeriod,
  tagFrequency,
  valenceCounts,
  type Pattern,
  type Period,
} from '../../domain/analytics';
import { CONFIDENCE_LABELS, energyLabel, INDICATORS, valenceLabel } from '../../domain/scales';
import { CONFIDENCE, type AppData } from '../../domain/schema';
import { dayKey } from '../../domain/util';
import { Empty, fmtDate, Page, Section, Sheet, Toggle } from '../../ui/components';
import { ValenceMark } from '../../ui/pickers';
import { CalendarView } from '../journal/Journal';
import { OutcomeBar, OutcomeLegend } from '../guide/Repertoire';
import { Bars, Distribution, Evolution } from './charts';

type PeriodKind = '7d' | '30d' | '90d' | '365d' | 'all';
const PERIODS: Array<[PeriodKind, string]> = [
  ['7d', '7 dias'],
  ['30d', '30 dias'],
  ['90d', '3 meses'],
  ['365d', '12 meses'],
  ['all', 'Tudo'],
];
const MOOD_COLORS = [1, 2, 3, 4, 5].map((i) => `var(--mood-${i})`);
const ENERGY_COLORS = [1, 2, 3, 4, 5].map((i) => `var(--energy-${i})`);

export function Trajectory() {
  const data = useData();
  const prefs = data.preferences;
  const [kind, setKind] = useState<PeriodKind>('30d');
  const [compare, setCompare] = useState(false);
  const [howOpen, setHowOpen] = useState(false);

  const earliest = useMemo(() => {
    const all = [...data.moodEntries.map((m) => m.at), ...data.experiences.map((x) => x.at)].sort();
    return all[0] ? new Date(all[0]) : undefined;
  }, [data.moodEntries, data.experiences]);
  const period = useMemo(() => periodPreset(kind, new Date(), earliest), [kind, earliest]);
  const prev = useMemo(() => previousPeriod(period), [period]);
  const entries = useMemo(() => data.moodEntries.filter((m) => inPeriod(m.at, period)), [data.moodEntries, period]);
  const prevEntries = useMemo(() => (compare ? data.moodEntries.filter((m) => inPeriod(m.at, prev)) : []), [data.moodEntries, prev, compare]);
  const vLabels = [-2, -1, 0, 1, 2].map((v) => valenceLabel(v, prefs.valenceLabels));
  const eLabels = [1, 2, 3, 4, 5].map((e) => energyLabel(e, prefs.energyLabels));

  const vc = valenceCounts(entries);
  const pvc = compare ? valenceCounts(prevEntries) : null;
  const ec = energyCounts(entries);
  const pec = compare ? energyCounts(prevEntries) : null;
  const evo = useMemo(() => buckets(entries, period, (e) => e.valence + 2, prefs.weekStartsOn), [entries, period, prefs.weekStartsOn]);
  const evoE = useMemo(() => buckets(entries, period, (e) => (e.energy ? e.energy - 1 : null), prefs.weekStartsOn), [entries, period, prefs.weekStartsOn]);
  const emo = new Map(data.emotions.map((e) => [e.id, e.label]));
  const emotions = emotionFrequency(entries).slice(0, 10);
  const prevEmo = compare ? new Map(emotionFrequency(prevEntries).map((x) => [x.id, x])) : null;
  const tags = tagFrequency(entries).slice(0, 10);
  const daysWith = new Set(entries.map((e) => dayKey(e.at))).size;
  const exps = data.experiences.filter((x) => inPeriod(x.at, period));
  const discs = data.discoveries.filter((d) => inPeriod(d.at.length <= 10 ? d.at + 'T12:00:00' : d.at, period));
  const used = mostUsedItems(data, period).slice(0, 6);
  const withEnergy = sum5(ec);
  const median = medianCategory(vc);
  const mode = vc.indexOf(Math.max(...vc));

  const improved = exps.filter((x) => x.feelingBefore !== null && x.feelingAfter !== null && x.feelingAfter > x.feelingBefore).length;
  const comparable = exps.filter((x) => x.feelingBefore !== null && x.feelingAfter !== null).length;

  return (
    <Page title="Trajetória" ghost="caminho" subtitle="O que seus registros mostram — sem julgamento e sem pressa.">
      <div className="chips" role="group" aria-label="Período">
        {PERIODS.map(([k, l]) => (
          <button key={k} className="chip" aria-pressed={kind === k} onClick={() => setKind(k)}>
            {l}
          </button>
        ))}
      </div>
      <div className="list" style={{ marginTop: 12 }}>
        <Toggle
          label="Comparar com o período anterior"
          help={compare ? `${fmtDate(prev.from.toISOString(), { short: true })} – ${fmtDate(prev.to.toISOString(), { short: true })}` : undefined}
          checked={compare}
          onChange={setCompare}
        />
      </div>

      <div className="grid-3" style={{ marginTop: 18 }}>
        <div className="card tight stat">
          <span className="n">{entries.length}</span>
          <span className="l">registros de humor</span>
        </div>
        <div className="card tight stat">
          <span className="n">{daysWith}</span>
          <span className="l">dias com registro</span>
        </div>
        <div className="card tight stat">
          <span className="n">{exps.length}</span>
          <span className="l">experiências</span>
        </div>
      </div>

      {entries.length === 0 ? (
        <div style={{ marginTop: 20 }}>
          <Empty title="Sem registros neste período">Escolha outro período ou faça um registro no Diário. Não há problema em ter lacunas.</Empty>
        </div>
      ) : (
        <>
          <Section title="Valência" kicker="Como você tem se sentido">
            <div className="card">
              <Distribution labels={vLabels} colors={MOOD_COLORS} counts={vc} compare={pvc} marks={(i) => <ValenceMark v={i - 2} size={14} />} />
              {median !== null && (
                <p className="small muted" style={{ marginTop: 14, marginBottom: 0 }}>
                  A categoria mais frequente foi <strong>{vLabels[mode].toLowerCase()}</strong>. Metade dos registros ficou em <strong>{vLabels[median].toLowerCase()}</strong>{' '}
                  {median < 4 ? 'ou acima' : ''}.
                  {pvc && sum5(pvc) > 0 && (
                    <>
                      {' '}
                      No período anterior foram {sum5(pvc)} registro(s).
                    </>
                  )}
                </p>
              )}
            </div>
          </Section>

          <Section title="Evolução" kicker={evo.unit === 'day' ? 'Por dia' : evo.unit === 'week' ? 'Por semana' : 'Por mês'}>
            <div className="card">
              <Evolution buckets={evo.items} colors={MOOD_COLORS} labels={vLabels} unit={evo.unit} />
            </div>
          </Section>

          {prefs.showEnergy && withEnergy > 0 && (
            <Section title="Energia" kicker={`${withEnergy} registro(s) com energia`}>
              <div className="card stack lg">
                <Distribution labels={eLabels} colors={ENERGY_COLORS} counts={ec} compare={pec} />
                <Evolution buckets={evoE.items} colors={ENERGY_COLORS} labels={eLabels} unit={evoE.unit} height={110} />
              </div>
            </Section>
          )}

          {prefs.enabledIndicators.map((k) => {
            const c = indicatorCounts(entries, k);
            if (!sum5(c)) return null;
            return (
              <Section key={k} title={INDICATORS[k].label} kicker="Indicador">
                <div className="card">
                  <Distribution labels={INDICATORS[k].levels} colors={ENERGY_COLORS} counts={c} compare={compare ? indicatorCounts(prevEntries, k) : null} />
                </div>
              </Section>
            );
          })}

          {emotions.length > 0 && (
            <Section title="Emoções recorrentes" kicker="Em quantos registros apareceram">
              <div className="card">
                <Bars
                  rows={emotions.map((e) => ({
                    label: emo.get(e.id) ?? '?',
                    value: e.count,
                    note: prevEmo ? `${e.count} (antes ${prevEmo.get(e.id)?.count ?? 0})` : `${e.count} · ${Math.round(e.share * 100)}%`,
                  }))}
                />
              </div>
            </Section>
          )}

          {tags.length > 0 && (
            <Section title="Contextos frequentes" kicker="Marcadores dos registros">
              <div className="card">
                <Bars rows={tags.map((t) => ({ label: t.tag, value: t.count }))} color="var(--comp1-ink)" />
              </div>
            </Section>
          )}
        </>
      )}

      <Section title="Calendário emocional">
        <CalendarView entries={data.moodEntries} onOpen={() => navigate('/diario?v=calendario')} />
      </Section>

      {(used.length > 0 || exps.length > 0) && (
        <Section title="Repertório e experiências">
          <div className="stack">
            {exps.length > 0 && (
              <button className="card" onClick={() => navigate('/diario')}>
                <p className="h3" style={{ margin: 0 }}>
                  {exps.length} experiência(s) registrada(s)
                </p>
                {comparable > 0 && (
                  <p className="small muted" style={{ margin: '6px 0 0' }}>
                    Em {improved} de {comparable} em que você registrou o antes e o depois, terminou se sentindo melhor do que começou.
                  </p>
                )}
                {exps.filter((x) => x.learned.trim()).slice(0, 2).map((x) => (
                  <p key={x.id} className="quote" style={{ margin: '10px 0 0', fontSize: 'var(--fs-md)' }}>
                    “{x.learned.slice(0, 160)}”
                  </p>
                ))}
              </button>
            )}
            {used.length > 0 && (
              <div className="card">
                <p className="kicker">Mais usados no período</p>
                <div className="stack" style={{ gap: 12 }}>
                  {used.map((u) => (
                    <button key={u.item!.id} style={{ background: 'none', border: 0, padding: 0, textAlign: 'left' }} onClick={() => navigate(`/guia/item/${u.item!.id}`)}>
                      <div className="row between small">
                        <span>{u.item!.name}</span>
                        <span className="xs faint">{u.uses.length} uso(s)</span>
                      </div>
                      <div style={{ marginTop: 4 }}>
                        <OutcomeBar counts={u.counts} />
                      </div>
                    </button>
                  ))}
                </div>
                <OutcomeLegend />
              </div>
            )}
          </div>
        </Section>
      )}

      <Section title="Descobertas" kicker="Registradas por você">
        {data.discoveries.length === 0 ? (
          <p className="small muted">Nenhuma descoberta ainda.</p>
        ) : (
          <div className="card">
            <div className="grid-3">
              {CONFIDENCE.map((c) => (
                <div key={c} className="stat">
                  <span className="n">{data.discoveries.filter((d) => d.status === 'active' && d.confidence === c).length}</span>
                  <span className="l">{CONFIDENCE_LABELS[c].label}</span>
                </div>
              ))}
            </div>
            {discs.length > 0 && (
              <p className="small muted" style={{ marginBottom: 0 }}>
                {discs.length} nova(s) neste período. Mais recente: “{discs.sort((a, b) => b.at.localeCompare(a.at))[0].title}”.
              </p>
            )}
          </div>
        )}
      </Section>

      <Patterns data={data} period={period} onHow={() => setHowOpen(true)} />

      <Section title="Relatório">
        <button className="card row" onClick={() => navigate('/ajustes/dados?secao=relatorio')}>
          <FileText size={22} />
          <div className="grow">
            <div className="h3">Gerar relatório em PDF</div>
            <div className="small muted">Escolha o período e o que incluir — por exemplo, para levar a uma consulta.</div>
          </div>
        </button>
      </Section>

      <Sheet open={howOpen} onClose={() => setHowOpen(false)} title="Como os padrões são calculados">
        <div className="stack small" style={{ lineHeight: 1.6 }}>
          <p style={{ margin: 0 }}>
            O Palimpsesto compara registros <strong>com</strong> e <strong>sem</strong> cada marcador de contexto (por exemplo, “tempo só”).
          </p>
          <p style={{ margin: 0 }}>
            Para valência, energia e indicadores, que são escalas ordenadas, usa o <em>delta de Cliff</em>: a chance de um registro com o marcador estar numa categoria acima de um
            registro sem ele, menos a chance inversa. Só aparecem diferenças de pelo menos {Math.round(0.3 * 100)} pontos.
          </p>
          <p style={{ margin: 0 }}>
            Para emoções, compara a proporção de registros em que cada emoção aparece nos dois grupos (diferença mínima de 25 pontos percentuais).
          </p>
          <p style={{ margin: 0 }}>
            Exigimos ao menos {PATTERN_MIN_ENTRIES} registros no período e 5 em cada grupo. Mesmo assim, com muitas comparações algumas associações podem surgir por acaso.
          </p>
          <p style={{ margin: 0 }}>
            <strong>São associações, não causas.</strong> Um marcador pode acompanhar outro fator que você não registrou. Use-as como pistas para observar — se fizer sentido,
            transforme numa hipótese sua e acompanhe.
          </p>
          <p style={{ margin: 0 }}>Todo o cálculo é feito no aparelho. Nada é enviado para lugar nenhum.</p>
        </div>
      </Sheet>
    </Page>
  );
}

const sum5 = (c: number[]) => c.reduce((a, b) => a + b, 0);

function Patterns({ data, period, onHow }: { data: AppData; period: Period; onHow: () => void }) {
  const entries = data.moodEntries.filter((m) => inPeriod(m.at, period));
  const res = useMemo(() => findPatterns(entries, { indicators: data.preferences.enabledIndicators }), [entries, data.preferences.enabledIndicators]);
  const emo = new Map(data.emotions.map((e) => [e.id, e.label]));
  const labels = data.preferences.valenceLabels;

  const sentence = (p: Pattern) => {
    const pc = (x: number) => `${Math.round(x * 100)}%`;
    if (p.metric.startsWith('emotion:')) {
      const name = (emo.get(p.metric.slice(8)) ?? 'uma emoção').toLowerCase();
      return `${name.charAt(0).toUpperCase() + name.slice(1)} apareceu em ${pc(p.withShare)} dos registros com “${p.tag}”, contra ${pc(p.withoutShare)} nos demais.`;
    }
    const what =
      p.metric === 'valence'
        ? `${valenceLabel(1, labels).toLowerCase()} ou ${valenceLabel(2, labels).toLowerCase()}`
        : p.metric === 'energy'
          ? 'com energia alta'
          : `com ${INDICATORS[p.metric as keyof typeof INDICATORS].label.toLowerCase()} intensa`;
    const subject =
      p.metric === 'valence' ? 'avaliações mais agradáveis' : p.metric === 'energy' ? 'mais energia' : `${INDICATORS[p.metric as keyof typeof INDICATORS].label.toLowerCase()} mais alta`;
    const dir =
      p.direction === 'higher' ? subject : subject.replace('mais agradáveis', 'menos agradáveis').replace('mais alta', 'mais baixa').replace('mais energia', 'menos energia');
    return `Registros com “${p.tag}” aparecem associados a ${dir}: ${pc(p.withShare)} foram ${what}, contra ${pc(p.withoutShare)} nos demais.`;
  };

  return (
    <Section
      title="Padrões observados"
      kicker="Hipóteses do sistema — não conclusões"
      action={
        <button className="icon-btn" aria-label="Como funciona" onClick={onHow}>
          <Info size={20} />
        </button>
      }
    >
      {!res.enough ? (
        <div className="card dashed small muted">
          Ainda há poucos registros neste período para observar padrões com algum cuidado ({res.total} de {PATTERN_MIN_ENTRIES}). Use marcadores de contexto nos registros (“tempo
          só”, “dormi mal”…) — é a partir deles que associações podem aparecer.
        </div>
      ) : res.patterns.length === 0 ? (
        <div className="card dashed small muted">Nenhuma associação forte o bastante apareceu neste período. Isso também é informação.</div>
      ) : (
        <div className="stack">
          {res.patterns.slice(0, 8).map((p) => (
            <div key={p.id} className="card tight" style={{ borderLeft: '3px solid var(--comp1-ink)' }}>
              <p className="xs faint" style={{ margin: 0 }}>
                Associação observada · {p.withN} registros com o marcador, {p.withoutN} sem
              </p>
              <p style={{ margin: '6px 0 0' }}>{sentence(p)}</p>
              {p.withCounts && p.withoutCounts && p.metric === 'valence' && (
                <div className="stack" style={{ gap: 4, marginTop: 10 }}>
                  <MiniStack label={`com “${p.tag}”`} counts={p.withCounts} />
                  <MiniStack label="sem" counts={p.withoutCounts} />
                </div>
              )}
              <button
                className="btn ghost sm"
                style={{ marginTop: 6, paddingLeft: 0 }}
                onClick={() => navigate(`/mapa/descoberta/nova?origem=padrao&titulo=${encodeURIComponent('')}&texto=${encodeURIComponent(sentence(p))}`)}
              >
                <Lightbulb size={14} /> Investigar como hipótese
              </button>
            </div>
          ))}
        </div>
      )}
    </Section>
  );
}

function MiniStack({ label, counts }: { label: string; counts: number[] }) {
  const n = counts.reduce((a, b) => a + b, 0) || 1;
  return (
    <div className="row" style={{ gap: 8 }}>
      <span className="xs faint" style={{ width: 92, flex: 'none', overflow: 'hidden', textOverflow: 'ellipsis', whiteSpace: 'nowrap' }}>
        {label}
      </span>
      <div className="stackbar grow" style={{ height: 10 }}>
        {counts.map((c, i) => (c ? <div key={i} style={{ width: `${(c / n) * 100}%`, background: `var(--mood-${i + 1})` }} /> : null))}
      </div>
    </div>
  );
}
