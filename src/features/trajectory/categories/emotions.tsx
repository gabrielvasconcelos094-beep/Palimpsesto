import { ALPHA, benjaminiHochberg, fisherExactP } from '../../../domain/stats';
import { navigate } from '../../../app/router';
import { emotionCounts, emotionPairs, emotionsByMonth, isPleasant, isUnpleasant } from '../../../domain/insights';
import type { MoodEntry } from '../../../domain/schema';
import { Empty, Section } from '../../../ui/components';
import { Bars, HeatTable } from '../charts';
import { useTrajectory } from '../useTrajectory';
import { pct, monthLabel, Note } from './shared';

/* ------------------------------------------------------------------------ */
/* Emoções                                                                   */
/* ------------------------------------------------------------------------ */
export function EmotionsBody() {
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
  // Só mostra mudanças improváveis por acaso (Fisher exato + Benjamini-Hochberg entre as emoções testadas).
  const candidates = counts
    .filter((c) => c.count >= 3 || (prev.get(c.id)?.count ?? 0) >= 3)
    .map((c) => {
      const before = prev.get(c.id)?.count ?? 0;
      return {
        id: c.id,
        now: c.share,
        before: t.prevEntries.length ? before / t.prevEntries.length : 0,
        p: fisherExactP(c.count, t.entries.length - c.count, before, t.prevEntries.length - before),
      };
    });
  const cq = benjaminiHochberg(candidates.map((c) => c.p));
  const changes = candidates
    .filter((c, i) => Math.abs(c.now - c.before) >= 0.1 && cq[i] < ALPHA)
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
          <div className="chips" style={{ marginTop: 10 }}>
            {counts.slice(0, 8).map((c) => (
              <button key={c.id} className="chip" onClick={() => navigate(`/guia/emocao/${c.id}`)}>
                {emo.get(c.id)} →
              </button>
            ))}
          </div>
          <Note>Toque numa emoção para ver como ela aparece em você e o que ajuda a lidar com ela.</Note>
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
            <span className="muted">Nenhuma mudança clara: nenhuma emoção mudou de frequência mais do que o acaso costuma produzir com esta quantidade de registros.</span>
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
            Proporção de registros com a emoção: período anterior ({t.prevEntries.length} registros) → atual ({t.entries.length}). Só aparecem mudanças de 10 pontos ou mais que um
            teste (Fisher exato, corrigido para várias emoções) indica serem improváveis por acaso.
          </Note>
        </div>
      </Section>
    </>
  );
}
