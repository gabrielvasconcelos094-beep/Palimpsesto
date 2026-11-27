import { DISTORTION_LABELS } from '../../../domain/scales';
import type { Distortion } from '../../../domain/schema';
import { navigate } from '../../../app/router';
import { Empty, fmtDate, Section } from '../../../ui/components';
import { Bars } from '../charts';
import { useTrajectory } from '../useTrajectory';
import { Note } from './shared';

/* ------------------------------------------------------------------------ */
/* Pensamentos (registro de pensamentos das experiências)                    */
/* ------------------------------------------------------------------------ */
export function ThoughtsBody() {
  const t = useTrajectory();
  const emo = new Map(t.data.emotions.map((e) => [e.id, e.label]));
  const withT = t.experiences.filter((x) => x.thoughts.trim()).sort((a, b) => b.at.localeCompare(a.at));
  if (!withT.length)
    return (
      <Empty title="Nenhum pensamento registrado neste recorte" action={<button className="btn" onClick={() => navigate('/diario/experiencia/nova')}>Registrar uma experiência</button>}>
        Ao registrar uma experiência, há um espaço para “o que passou pela sua cabeça”, adaptado do Registro de Pensamentos usado na terapia cognitivo-comportamental.
      </Empty>
    );
  const traps = new Map<string, number>();
  withT.forEach((x) => x.distortions.forEach((d) => traps.set(d, (traps.get(d) ?? 0) + 1)));
  const trapRows = [...traps.entries()].sort((a, b) => b[1] - a[1]);
  const med = (v: number[]) => {
    const s = [...v].sort((a, b) => a - b);
    return s[Math.floor((s.length - 1) / 2)];
  };
  const belief = withT.filter((x) => x.beliefBefore != null && x.beliefAfter != null);
  const inten = t.experiences.filter((x) => x.intensityBefore != null && x.intensityAfter != null);
  const emoCount = new Map<string, number>();
  withT.forEach((x) => x.emotionIds.forEach((id) => emoCount.set(id, (emoCount.get(id) ?? 0) + 1)));
  const alt = withT.filter((x) => x.alternativeThought.trim()).slice(0, 6);
  return (
    <>
      <div className="grid-3">
        <div className="card tight stat">
          <span className="n">{withT.length}</span>
          <span className="l">experiências com pensamentos</span>
        </div>
        <div className="card tight stat">
          <span className="n">{belief.length ? `${med(belief.map((x) => (x.beliefBefore as number) - (x.beliefAfter as number)))}` : '—'}</span>
          <span className="l">queda na crença (pontos, mediana)</span>
        </div>
        <div className="card tight stat">
          <span className="n">{inten.length ? `${med(inten.map((x) => (x.intensityBefore as number) - (x.intensityAfter as number)))}` : '—'}</span>
          <span className="l">queda na intensidade (mediana)</span>
        </div>
      </div>
      {trapRows.length > 0 && (
        <Section title="Armadilhas de pensamento mais frequentes">
          <div className="card">
            <Bars rows={trapRows.map(([d, n]) => ({ label: DISTORTION_LABELS[d as Distortion].label, value: n, note: String(n) }))} />
            <Note>Quantas vezes você reconheceu cada uma. Reconhecer já é parte do trabalho — não é um julgamento.</Note>
          </div>
        </Section>
      )}
      {emoCount.size > 0 && (
        <Section title="Emoções que vieram com esses pensamentos">
          <div className="chips">
            {[...emoCount.entries()]
              .sort((a, b) => b[1] - a[1])
              .slice(0, 8)
              .map(([id, n]) => (
                <button key={id} className="chip" onClick={() => navigate(`/guia/emocao/${id}`)}>
                  {emo.get(id)} ({n})
                </button>
              ))}
          </div>
        </Section>
      )}
      {alt.length > 0 && (
        <Section title="Pensamentos mais equilibrados que você construiu" kicker="Para reler quando precisar">
          <div className="stack">
            {alt.map((x) => (
              <button key={x.id} className="card tight" style={{ textAlign: 'left' }} onClick={() => navigate(`/diario/experiencia/${x.id}`)}>
                <p className="small muted" style={{ margin: 0 }}>“{x.thoughts}”</p>
                <p style={{ margin: '6px 0 0' }}>{x.alternativeThought}</p>
                <p className="xs faint" style={{ margin: '4px 0 0' }}>
                  {fmtDate(x.at, { withYear: true })}
                  {x.beliefBefore != null && x.beliefAfter != null ? ` · crença ${x.beliefBefore}% → ${x.beliefAfter}%` : ''}
                </p>
              </button>
            ))}
          </div>
        </Section>
      )}
    </>
  );
}
