/**
 * Minhas emoções: cada emoção de perto — quando aparece, o que vem junto, o que
 * passou pela cabeça, o que você fez e como foi — e um guia pessoal (o que ela
 * costuma sinalizar, o que ajuda, o que piora), para ir aprendendo a lidar com ela.
 *
 * Base: a ideia, comum à terapia comportamental dialética e às terapias focadas em
 * emoção, de que emoções têm FUNÇÃO (informam, preparam para agir) e de que conhecer
 * os próprios padrões e respostas ajuda a regulá-las. Aqui tudo vem dos SEUS registros;
 * as frases gerais são só um ponto de partida para conversar com a(o) psicóloga(o).
 */
import { ChevronRight } from 'lucide-react';
import { navigate, useRoute } from '../../app/router';
import { store, useData } from '../../app/store';
import { DISTORTION_LABELS, OUTCOME_LABELS, OUTCOME_ORDER, valenceLabel } from '../../domain/scales';
import type { Emotion } from '../../domain/schema';
import { valenceCounts } from '../../domain/analytics';
import { WEEKDAYS_FULL } from '../../domain/insights';
import { AutoText, Empty, Field, fmtDate, Page, Section } from '../../ui/components';
import { ValenceMark } from '../../ui/pickers';
import { Distribution } from '../trajectory/charts';
import { MOOD_COLORS } from '../trajectory/Trajectory';

/** Para que cada emoção costuma servir — ponto de partida, não regra. */
export const EMOTION_FUNCTION: Record<string, string> = {
  'emo.alegria': 'Sinaliza que algo importa e está indo bem; convida a se aproximar e repetir.',
  'emo.tristeza': 'Costuma aparecer diante de perdas ou do que não aconteceu; pede pausa, cuidado e, às vezes, apoio.',
  'emo.irritacao': 'Sinal de que algo incomoda ou passou de um limite — muitas vezes antes de virar raiva.',
  'emo.raiva': 'Aparece quando algo parece injusto ou um limite foi cruzado; dá energia para se defender ou mudar algo.',
  'emo.ansiedade': 'Prepara para uma ameaça possível ou incerta; útil em dose pequena, cansativa quando fica ligada.',
  'emo.medo': 'Alerta para um perigo percebido agora; prepara para proteger-se.',
  'emo.frustracao': 'Surge quando algo esperado é bloqueado; pode indicar a necessidade de mudar o caminho ou a expectativa.',
  'emo.solidao': 'Sinaliza necessidade de conexão e pertencimento.',
  'emo.calma': 'Indica segurança no momento; bom para pensar com clareza.',
  'emo.serenidade': 'Um estado de equilíbrio; vale notar o que o favorece.',
  'emo.entusiasmo': 'Energia para algo que importa; ajuda a começar.',
  'emo.culpa': 'Aparece quando sentimos que agimos contra os próprios valores; pode pedir reparo — ou revisão de regras rígidas demais.',
  'emo.vergonha': 'Ligada ao medo de ser rejeitado ou avaliado; costuma pedir esconder-se, mesmo quando conversar ajudaria.',
  'emo.saudade': 'Mostra o valor do que (ou de quem) está longe.',
  'emo.tedio': 'Pode sinalizar falta de sentido, de estímulo ou de descanso de verdade.',
  'emo.confusao': 'Sinal de que falta informação ou tempo para entender.',
  'emo.esperanca': 'Sustenta o esforço quando algo bom parece possível.',
  'emo.alivio': 'Aparece quando uma ameaça passa; mostra o que pesava.',
  'emo.indiferenca': 'Pode ser descanso — ou desligamento quando há coisa demais; vale observar quando aparece.',
  'emo.sobrecarga': 'Sinaliza mais demanda do que recursos no momento; pede priorizar, dividir ou parar.',
  'emo.gratidao': 'Reconhece o que recebeu; fortalece vínculos.',
  'emo.ternura': 'Vontade de cuidar e de se aproximar.',
  'emo.curiosidade': 'Convida a explorar e aprender.',
  'emo.cansaco': 'Pede descanso — do corpo, da cabeça ou das relações.',
};

/* ------------------------------------------------------------------------ */
/* Lista                                                                     */
/* ------------------------------------------------------------------------ */
export function EmotionsListPage() {
  const data = useData();
  const rows = data.emotions
    .filter((e) => !e.hidden)
    .map((e) => {
      const moods = data.moodEntries.filter((m) => m.emotionIds.includes(e.id));
      const exps = data.experiences.filter((x) => x.emotionIds.includes(e.id));
      const last = [...moods.map((m) => m.at), ...exps.map((x) => x.at)].sort().pop();
      return { e, n: moods.length + exps.length, last, guided: !!(e.signals || e.helps || e.worsens) };
    })
    .sort((a, b) => b.n - a.n || a.e.label.localeCompare(b.e.label, 'pt-BR'));
  return (
    <Page back="/guia" noNav kicker="Guia" title="Minhas emoções" subtitle="Cada emoção de perto: quando aparece, o que vem junto e o que ajuda você a lidar com ela." ghost="sentir">
      <div className="list">
        {rows.map(({ e, n, last, guided }) => (
          <button key={e.id} className="list-row" onClick={() => navigate(`/guia/emocao/${e.id}`)}>
            <div className="grow">
              <div className="title">{e.label}</div>
              <div className="meta">
                {n ? `${n} registro(s) · última vez ${fmtDate(last!, { short: true })}` : 'Ainda não registrada'}
                {guided ? ' · com seu guia' : ''}
              </div>
            </div>
            <ChevronRight className="chev" size={18} />
          </button>
        ))}
      </div>
    </Page>
  );
}

/* ------------------------------------------------------------------------ */
/* Perfil de uma emoção                                                      */
/* ------------------------------------------------------------------------ */
export function EmotionProfilePage() {
  const route = useRoute();
  const data = useData();
  const e = data.emotions.find((x) => x.id === route.parts[2]);
  if (!e)
    return (
      <Page back="/guia/emocoes" noNav title="Emoção não encontrada">
        <span />
      </Page>
    );
  return <Profile e={e} />;
}

function top<T extends string>(list: T[], n = 5) {
  const m = new Map<T, number>();
  list.forEach((x) => m.set(x, (m.get(x) ?? 0) + 1));
  return [...m.entries()].sort((a, b) => b[1] - a[1]).slice(0, n);
}

function Profile({ e }: { e: Emotion }) {
  const data = useData();
  const labels = data.preferences.valenceLabels;
  const emo = new Map(data.emotions.map((x) => [x.id, x.label]));
  const items = new Map(data.repertoire.map((i) => [i.id, i.name]));
  const moods = data.moodEntries.filter((m) => m.emotionIds.includes(e.id)).sort((a, b) => b.at.localeCompare(a.at));
  const exps = data.experiences.filter((x) => x.emotionIds.includes(e.id)).sort((a, b) => b.at.localeCompare(a.at));
  const dates = new Set(moods.map((m) => m.at.slice(0, 10))).size;
  const share = data.moodEntries.length ? moods.length / data.moodEntries.length : 0;
  const withOthers = top(moods.flatMap((m) => m.emotionIds.filter((x) => x !== e.id)));
  const contexts = top(moods.flatMap((m) => m.tags));
  const acts = top(moods.flatMap((m) => m.itemIds));
  const weekdays = top(moods.map((m) => String(new Date(m.at.slice(0, 10) + 'T12:00:00').getDay())), 3);
  const parts = top(
    moods.filter((m) => m.timePrecision !== 'day').map((m) => {
      const h = Number(m.at.slice(11, 13));
      return h < 6 ? 'madrugada' : h < 12 ? 'manhã' : h < 18 ? 'tarde' : 'noite';
    }),
    2,
  );
  const thoughts = exps.filter((x) => x.thoughts.trim()).slice(0, 4);
  const traps = top(exps.flatMap((x) => x.distortions), 4);
  const helped = exps.filter((x) => x.whatHelped.trim()).slice(0, 4);
  const expIds = new Set(exps.map((x) => x.id));
  const uses = data.uses.filter((u) => u.experienceId && expIds.has(u.experienceId));
  const byItem = new Map<string, Record<string, number>>();
  uses.forEach((u) => {
    const r = byItem.get(u.itemId) ?? {};
    r[u.outcome] = (r[u.outcome] ?? 0) + 1;
    byItem.set(u.itemId, r);
  });
  const intensity = exps.filter((x) => x.intensityBefore != null && x.intensityAfter != null);
  const patch = (p: Partial<Emotion>) => store.patch('emotions', e.id, p);
  const total = moods.length + exps.length;

  return (
    <Page back="/guia/emocoes" noNav kicker="Minhas emoções" title={e.label} subtitle={EMOTION_FUNCTION[e.id]} ghost="sentir">
      <div className="stack lg">
        {total === 0 ? (
          <Empty title="Ainda não registrada">Quando ela aparecer nos seus registros de humor ou experiências, este espaço mostra seus padrões com ela.</Empty>
        ) : (
          <>
            <div className="grid-3">
              <div className="card tight stat">
                <span className="n">{moods.length}</span>
                <span className="l">registros de humor</span>
              </div>
              <div className="card tight stat">
                <span className="n">{dates}</span>
                <span className="l">datas</span>
              </div>
              <div className="card tight stat">
                <span className="n">{exps.length}</span>
                <span className="l">experiências</span>
              </div>
            </div>
            {moods.length > 0 && (
              <Section title="Quando ela aparece">
                <div className="card stack">
                  <p className="small" style={{ margin: 0 }}>
                    Em {Math.round(share * 100)}% dos seus registros de humor. Última vez: {fmtDate(moods[0].at, { withYear: true })}.
                    {moods.length >= 5 && weekdays.length ? ` Mais em: ${weekdays.map(([d, n]) => `${WEEKDAYS_FULL[Number(d)]} (${n})`).join(', ')}.` : ''}
                    {moods.length >= 5 && parts.length ? ` Período do dia mais comum: ${parts.map(([p, n]) => `${p} (${n})`).join(', ')}.` : ''}
                  </p>
                  <Distribution labels={[-2, -1, 0, 1, 2].map((v) => valenceLabel(v, labels))} colors={MOOD_COLORS} counts={valenceCounts(moods)} marks={(i) => <ValenceMark v={i - 2} size={16} />} />
                  {withOthers.length > 0 && <p className="small" style={{ margin: 0 }}>Costuma vir junto com: {withOthers.map(([id, n]) => `${emo.get(id)} (${n})`).join(', ')}.</p>}
                  {contexts.length > 0 && <p className="small" style={{ margin: 0 }}>Contextos marcados: {contexts.map(([t, n]) => `${t} (${n})`).join(', ')}.</p>}
                  {acts.length > 0 && <p className="small" style={{ margin: 0 }}>Atividades no momento: {acts.map(([id, n]) => `${items.get(id)} (${n})`).join(', ')}.</p>}
                  <button className="btn ghost sm" style={{ alignSelf: 'flex-start', paddingLeft: 0 }} onClick={() => navigate(`/diario?emocao=${e.id}`)}>
                    Ver todos esses registros no Diário
                  </button>
                  <p className="xs faint" style={{ margin: 0 }}>Associações nos seus registros, não causas.</p>
                </div>
              </Section>
            )}
            {(thoughts.length > 0 || traps.length > 0) && (
              <Section title="O que costuma passar pela cabeça">
                <div className="card stack">
                  {thoughts.map((x) => (
                    <button key={x.id} className="card tight" style={{ textAlign: 'left' }} onClick={() => navigate(`/diario/experiencia/${x.id}`)}>
                      <p className="quote" style={{ margin: 0 }}>“{x.thoughts}”</p>
                      {x.alternativeThought && <p className="small" style={{ margin: '6px 0 0' }}>Mais equilibrado: {x.alternativeThought}</p>}
                      <p className="xs faint" style={{ margin: '4px 0 0' }}>{fmtDate(x.at, { withYear: true })}</p>
                    </button>
                  ))}
                  {traps.length > 0 && <p className="small" style={{ margin: 0 }}>Armadilhas de pensamento que você reconheceu: {traps.map(([d, n]) => `${DISTORTION_LABELS[d].label} (${n})`).join(', ')}.</p>}
                </div>
              </Section>
            )}
            {(helped.length > 0 || byItem.size > 0 || intensity.length > 0) && (
              <Section title="O que você fez e como foi">
                <div className="card stack">
                  {[...byItem.entries()].map(([id, r]) => (
                    <div key={id} className="row between small" style={{ gap: 8 }}>
                      <span>{items.get(id)}</span>
                      <span className="muted" style={{ textAlign: 'right' }}>
                        {OUTCOME_ORDER.filter((o) => r[o]).map((o) => `${OUTCOME_LABELS[o].toLowerCase()}: ${r[o]}`).join(' · ')}
                      </span>
                    </div>
                  ))}
                  {helped.map((x) => (
                    <p key={x.id} className="small" style={{ margin: 0 }}>
                      <span className="faint">{fmtDate(x.at, { short: true })}:</span> {x.whatHelped}
                    </p>
                  ))}
                  {intensity.length > 0 && (
                    <p className="small" style={{ margin: 0 }}>
                      Nas {intensity.length} experiência(s) em que você mediu a intensidade antes e depois, ela{' '}
                      {(() => {
                        const d = intensity.map((x) => (x.intensityAfter as number) - (x.intensityBefore as number)).sort((a, b) => a - b);
                        const med = d[Math.floor((d.length - 1) / 2)];
                        return med < 0 ? `caiu ${-med} pontos (mediana)` : med > 0 ? `subiu ${med} pontos (mediana)` : 'ficou igual (mediana)';
                      })()}
                      .
                    </p>
                  )}
                </div>
              </Section>
            )}
          </>
        )}
        <Section title={`Meu guia para a ${e.label.toLowerCase()}`} kicker="Construído aos poucos — de preferência junto com a terapia">
          <div className="stack lg">
            <Field label="O que ela costuma me sinalizar?" optional help="Qual necessidade ou limite ela aponta, para você.">
              <AutoText value={e.signals} onChange={(signals) => patch({ signals })} placeholder="Ex.: que estou sem descanso há dias" minRows={2} />
            </Field>
            <Field label="O que me ajuda quando ela aparece?" optional help="Quando você registrar um momento difícil com esta emoção, o início pode lembrar o que você escreveu aqui.">
              <AutoText value={e.helps} onChange={(helps) => patch({ helps })} placeholder="Ex.: nomear o que sinto; caminhar; falar com a Lia" minRows={2} />
            </Field>
            <Field label="O que costuma piorar?" optional>
              <AutoText value={e.worsens} onChange={(worsens) => patch({ worsens })} placeholder="Ex.: ficar no celular; decidir com pressa" minRows={2} />
            </Field>
          </div>
        </Section>
      </div>
    </Page>
  );
}
