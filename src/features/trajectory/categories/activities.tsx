import { navigate } from '../../../app/router';
import { setSharedFilters, NO_FILTERS } from '../../../app/filters';
import { activityStats, activityTests, difficultMoments, isPleasant, monthlyCount, strategyGroups, ACTIVITY_MIN } from '../../../domain/insights';
import { Section } from '../../../ui/components';
import { OutcomeBar, OutcomeLegend } from '../../guide/Repertoire';
import { Bars } from '../charts';
import { useTrajectory } from '../useTrajectory';
import { pct, monthLabel, Note } from './shared';

/* ------------------------------------------------------------------------ */
/* Atividades e estratégias                                                  */
/* ------------------------------------------------------------------------ */
export function ActivitiesBody() {
  const t = useTrajectory();
  const items = new Map(t.data.repertoire.map((i) => [i.id, i]));
  const tests = new Map(activityTests(t.entries).map((a) => [a.itemId, a]));
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
                  {!enough ? (
                    <p className="xs faint" style={{ margin: '6px 0 0' }}>Poucos registros para comparar com segurança.</p>
                  ) : tests.get(a.itemId)?.clear ? (
                    <p className="xs" style={{ margin: '6px 0 0' }}>
                      <strong>Diferença clara</strong> entre os registros com e sem a atividade (improvável por acaso, mesmo considerando todas as atividades comparadas).
                    </p>
                  ) : (
                    <p className="xs faint" style={{ margin: '6px 0 0' }}>Sem diferença clara: a diferença entre com e sem a atividade está dentro do que o acaso costuma produzir.</p>
                  )}
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
