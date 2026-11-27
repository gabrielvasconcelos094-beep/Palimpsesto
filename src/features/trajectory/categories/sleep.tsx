import { FACTOR_MIN_NIGHTS, fmtHours, sleepSummary, nights as sleepNights, SLEEP_GROUP_MIN_DATES, SLEEP_MIN_NIGHTS } from '../../../domain/sleep';
import { SLEEP_FACTOR_LABELS, SLEEP_QUALITY, SLEEP_TROUBLE_LABELS } from '../../../domain/scales';
import { navigate } from '../../../app/router';
import { Empty, fmtDate, Section } from '../../../ui/components';
import { Distribution } from '../charts';
import { fmtIndex } from '../../../domain/valence';
import { MOOD_COLORS } from '../Trajectory';
import { useTrajectory } from '../useTrajectory';
import { pct, Note } from './shared';

/* ------------------------------------------------------------------------ */
/* Sono                                                                      */
/* ------------------------------------------------------------------------ */
export function SleepBody() {
  const t = useTrajectory();
  const logs = t.data.sleepLogs.filter((s) => s.date >= t.range.from && s.date <= t.range.to);
  const s = sleepSummary(logs, t.entries);
  const n = sleepNights(logs);
  if (s.logged === 0)
    return (
      <Empty title="Nenhuma noite informada neste recorte" action={!t.data.preferences.trackSleep ? <button className="btn" onClick={() => navigate('/ajustes/indicadores')}>Ativar “Sono”</button> : undefined}>
        O sono é opcional e registrado uma vez por noite: ative em Ajustes → Indicadores; ele aparece no início (“Como foi a noite?”) e no registro de humor.
      </Empty>
    );
  const max = Math.max(10, ...n.map((x) => x.hours));
  const qTotal = s.quality.reduce((a, b) => a + b, 0);
  return (
    <>
      <div className="grid-3">
        <div className="card tight stat">
          <span className="n">{s.logged}</span>
          <span className="l">noites informadas</span>
        </div>
        <div className="card tight stat">
          <span className="n">{fmtHours(s.median)}</span>
          <span className="l">mediana</span>
        </div>
        <div className="card tight stat">
          <span className="n">{s.sd === null ? '—' : fmtHours(s.sd)}</span>
          <span className="l">variação entre noites</span>
        </div>
      </div>
      {n.length > 0 && (
        <Section title="Noite a noite">
          <div className="card">
            <div className="sleep-bars" style={{ position: 'relative' }} role="img" aria-label={n.map((x) => `${fmtDate(x.day, { short: true })}: ${fmtHours(x.hours)}`).join('; ')}>
              {n.slice(-60).map((x) => (
                <div key={x.day} className="sleep-bar" title={`${fmtDate(x.day, { short: true })}: ${fmtHours(x.hours)}`}>
                  <span style={{ height: `${(x.hours / max) * 100}%`, background: x.hours < 6 ? 'var(--accent-ink)' : 'var(--comp1-ink)', opacity: x.hours < 6 ? 1 : 0.75 }} />
                </div>
              ))}
              <span className="sleep-guide" style={{ bottom: `${(6 / max) * 100}%` }} aria-hidden>
                6 h
              </span>
            </div>
            <div className="row between xs faint" style={{ marginTop: 6 }}>
              <span>{fmtDate(n[Math.max(0, n.length - 60)].day, { short: true })}</span>
              <span>{fmtDate(n[n.length - 1].day, { short: true })}</span>
            </div>
            <Note>Cada barra é uma noite (pela manhã em que terminou). Noites com menos de 6 h aparecem em outro tom; a linha tracejada marca 6 h. Noites sem informação não aparecem.</Note>
          </div>
        </Section>
      )}
      {qTotal > 0 && (
        <Section title="Qualidade e dificuldades">
          <div className="card stack lg">
            <Distribution labels={SLEEP_QUALITY.map((q) => q.label)} colors={MOOD_COLORS} counts={s.quality} />
            {(s.troubles.onset || s.troubles.awakenings || s.troubles.early || s.troubles.nightmares) > 0 && (
              <p className="small" style={{ margin: 0 }}>
                {(['onset', 'awakenings', 'early', 'nightmares'] as const)
                  .filter((k) => s.troubles[k])
                  .map((k) => `${SLEEP_TROUBLE_LABELS[k]}: ${s.troubles[k]} noite(s)`)
                  .join(' · ')}
              </p>
            )}
            <Note>Contagem por noite: cada noite conta uma vez, mesmo com vários registros de humor no dia.</Note>
          </div>
        </Section>
      )}
      {s.factors.length > 0 && (
        <Section title="O que pode ter atrapalhado">
          <div className="card stack">
            {s.factors.map((f) => (
              <div key={f.factor} className="row between small" style={{ gap: 10 }}>
                <span>{SLEEP_FACTOR_LABELS[f.factor]}</span>
                <span className="muted" style={{ textAlign: 'right' }}>
                  {f.nights} noite(s)
                  {f.badWith != null ? ` · ${pct(f.badWith)} ruins (sem ele: ${pct(f.badWithout!)})` : ''}
                  {f.badWith != null && <span style={{ display: 'block', fontWeight: f.clear ? 600 : 400 }}>{f.clear ? 'diferença clara' : 'sem diferença clara'}</span>}
                </span>
              </div>
            ))}
            <Note>
              “Ruins” = qualidade ruim ou muito ruim, entre as noites com qualidade informada. A comparação aparece quando há pelo menos {FACTOR_MIN_NIGHTS} noites com e sem o fator;
              “diferença clara” só quando o teste exato de Fisher, corrigido para vários fatores, indica que ela é improvável por acaso.
              Associação, não causa — mas é uma boa pista para levar à consulta.
            </Note>
          </div>
        </Section>
      )}
      <Section title="Sono e humor no mesmo dia">
        <div className="card stack">
          {s.comparable ? (
            <p style={{ margin: 0 }}>
              Nas datas após noites com <strong>menos de 6 h</strong>, o índice de humor foi <strong>{fmtIndex(s.short.index)}</strong> ({s.short.dates} datas); após noites de{' '}
              <strong>7 h ou mais</strong>, <strong>{fmtIndex(s.enough.index)}</strong> ({s.enough.dates} datas).{' '}
              {s.shortClear ? <strong>Diferença clara.</strong> : <span className="muted">Sem diferença clara: pode ser acaso com esta quantidade de datas.</span>}
            </p>
          ) : (
            <p className="small muted" style={{ margin: 0 }}>
              Duração: para comparar, é preciso ter pelo menos {SLEEP_GROUP_MIN_DATES} datas com noites de menos de 6 h e {SLEEP_GROUP_MIN_DATES} com 7 h ou mais, com registro de humor (há{' '}
              {s.short.dates} e {s.enough.dates}).
            </p>
          )}
          {s.qualityComparable ? (
            <p style={{ margin: 0 }}>
              Após noites de qualidade <strong>ruim ou muito ruim</strong>, o índice foi <strong>{fmtIndex(s.bad.index)}</strong> ({s.bad.dates} datas); após noites{' '}
              <strong>boas ou muito boas</strong>, <strong>{fmtIndex(s.good.index)}</strong> ({s.good.dates} datas).{' '}
              {s.qualityClear ? <strong>Diferença clara.</strong> : <span className="muted">Sem diferença clara: pode ser acaso com esta quantidade de datas.</span>}
            </p>
          ) : (
            qTotal > 0 && (
              <p className="small muted" style={{ margin: 0 }}>
                Qualidade: para comparar, é preciso ter pelo menos {SLEEP_GROUP_MIN_DATES} datas com noites ruins e {SLEEP_GROUP_MIN_DATES} com noites boas, com registro de humor.
              </p>
            )
          )}
          {s.sd === null && n.length > 0 && <p className="xs faint" style={{ margin: 0 }}>A variação entre noites aparece a partir de {SLEEP_MIN_NIGHTS} noites com horas informadas.</p>}
          <Note>
            “Diferença clara” = um teste de permutação entre as datas indica que é improvável por acaso. Mesmo assim, é associação, não causa: o humor também pode afetar o sono, e outras coisas podem afetar os dois. Por que olhar a regularidade: em estudos com
            diários, a variação da duração do sono de uma noite para outra acompanhou os sintomas de humor mais do que a média de horas (ex.: Kaufmann et al., 2016).
          </Note>
        </div>
      </Section>
    </>
  );
}
