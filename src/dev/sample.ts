/**
 * Dados de exemplo para desenvolvimento e capturas de tela.
 * Só é carregado em modo de desenvolvimento (import.meta.env.DEV).
 */
import type { Store } from '../data/store';
import { localIso, seededRandom } from '../domain/util';

export function seedSample(store: Store) {
  const r = seededRandom('palimpsesto');
  const pick = <T,>(a: T[]) => a[Math.floor(r() * a.length)];
  const now = new Date();
  const day = (n: number, h = 12, m = 0) => {
    const d = new Date(now);
    d.setDate(d.getDate() - n);
    d.setHours(h, m, 0, 0);
    return localIso(d);
  };
  for (let n = 0; n < 120; n++) {
    if (r() < 0.25) continue; // lacunas naturais
    const count = r() < 0.3 ? 2 : 1;
    for (let k = 0; k < count; k++) {
      const tags: string[] = [];
      if (r() < 0.3) tags.push('tempo só');
      if (r() < 0.25) tags.push('encontro social');
      if (r() < 0.2) tags.push('dormi mal');
      if (r() < 0.35) tags.push('trabalho');
      if (r() < 0.15) tags.push('natureza');
      let v = Math.round(r() * 2 - 0.6);
      if (tags.includes('tempo só')) v += 1;
      if (tags.includes('natureza')) v += 1;
      if (tags.includes('dormi mal')) v -= 1;
      if (tags.includes('encontro social') && r() < 0.6) v -= 1;
      v = Math.max(-2, Math.min(2, v));
      const emos: string[] = [];
      if (v >= 1) emos.push(pick(['emo.calma', 'emo.alegria', 'emo.serenidade', 'emo.entusiasmo', 'emo.gratidao']));
      if (v <= -1) emos.push(pick(['emo.ansiedade', 'emo.tristeza', 'emo.irritacao', 'emo.frustracao']));
      if (tags.includes('encontro social') && r() < 0.7) emos.push('emo.sobrecarga');
      if (tags.includes('dormi mal')) emos.push('emo.cansaco');
      store.upsert('moodEntries', {
        at: day(n, k ? 21 : 9 + Math.floor(r() * 4), Math.floor(r() * 59)),
        valence: v,
        energy: Math.max(1, Math.min(5, 3 + v + (tags.includes('dormi mal') ? -1 : 0) + (r() < 0.3 ? 1 : 0))),
        emotionIds: [...new Set(emos)],
        indicators: { sleep: tags.includes('dormi mal') ? 2 : 4, overload: tags.includes('encontro social') ? 4 : 2 },
        tags,
        note: r() < 0.15 ? pick(['Dia comprido, mas terminou bem.', 'Muita gente ao mesmo tempo.', 'Caminhei até o parque e voltei mais leve.', 'Acordei pesado.']) : '',
      } as any);
    }
  }
  const film = store.upsert('repertoire', { kind: 'strategy', name: 'Assistir a um filme conhecido', category: 'Distração', circumstances: 'Dias difíceis, à noite', effect: 'Acalma e desacelera', tags: ['dia difícil'] } as any);
  const walk = store.upsert('repertoire', { kind: 'resource', name: 'Caminhar sem destino', category: 'Atividade', circumstances: 'Quando a cabeça está cheia', effect: 'Clareia os pensamentos', perceivedFrequency: 3, tags: ['natureza'] } as any);
  store.upsert('repertoire', { kind: 'resource', name: 'Cuidar das plantas', category: 'Hábito', effect: 'Presença', tags: [] } as any);
  store.upsert('repertoire', { kind: 'resource', name: 'Conversar com a Lia', category: 'Pessoa', circumstances: 'Quando preciso ser ouvida', tags: [] } as any);
  const phone = store.upsert('repertoire', { kind: 'strategy', name: 'Rolar o celular para me distrair', category: 'Distração', tags: [] } as any);
  store.upsert('repertoire', { kind: 'drain', name: 'Agenda cheia demais', category: 'Situação', circumstances: 'Semanas com muitos compromissos seguidos', effect: 'Irritação e cansaço', wantToChange: true, tags: ['trabalho'] } as any);
  store.upsert('repertoire', { kind: 'drain', name: 'Festas longas sem pausa', category: 'Situação', effect: 'Sobrecarga no dia seguinte', tags: ['encontro social', 'festa'] } as any);
  const exp = store.upsert('experiences', {
    at: day(12, 20),
    title: 'Reunião difícil e um filme',
    whatHappened: 'A reunião terminou com críticas que não esperava. Cheguei em casa remoendo cada frase.',
    feelingBefore: -2,
    emotionIds: ['emo.frustracao', 'emo.ansiedade'],
    whatIDid: 'Desliguei o computador e coloquei um filme que já conheço.',
    whatHelped: 'Saber como o filme termina. Chá.',
    whatWorsened: 'Reler as mensagens antes de dormir.',
    feelingAfter: 0,
    howIFeltAfter: 'Mais leve, mas ainda com um fundo de preocupação.',
    learned: 'Filmes conhecidos me ajudam a sair do ciclo de remoer.',
    tags: ['trabalho', 'dia difícil'],
  } as any);
  store.upsert('uses', { itemId: film.id, at: exp.at, outcome: 'worked', tags: ['dia difícil'], experienceId: exp.id } as any);
  store.upsert('uses', { itemId: film.id, at: day(40, 21), outcome: 'partial', tags: ['dia difícil'] } as any);
  store.upsert('uses', { itemId: film.id, at: day(70, 21), outcome: 'didnt', tags: ['viagem'] } as any);
  store.upsert('uses', { itemId: phone.id, at: day(5, 23), outcome: 'worse', tags: ['dia difícil'] } as any);
  store.upsert('uses', { itemId: walk.id, at: day(3, 18), outcome: 'worked', tags: ['natureza'] } as any);
  store.upsert('experiences', { at: day(33, 23), title: 'Aniversário da Bia', whatHappened: 'Festa de cinco horas, muita música alta.', feelingBefore: 1, feelingAfter: -1, learned: 'Depois de festas longas preciso de uma manhã inteira só minha.', tags: ['encontro social', 'festa'] } as any);
  store.upsert('discoveries', { title: 'Preciso de tempo só depois de eventos sociais longos', description: 'Quando emendo compromissos sociais, no dia seguinte fico irritadiça e cansada.', at: day(60).slice(0, 10), confidence: 'consolidated', tags: ['encontro social'], revisions: [{ at: day(100), title: 'Acho que eventos sociais me cansam', description: '', confidence: 'hypothesis', status: 'active', note: 'Percebi que não é qualquer evento: são os longos.' }] } as any);
  store.upsert('discoveries', { title: 'Filmes conhecidos ajudam em dias difíceis', at: day(12).slice(0, 10), confidence: 'recurring', tags: ['dia difícil'], experienceIds: [exp.id], origin: 'experience' } as any);
  store.upsert('discoveries', { title: 'Tenho tendência a remoer conversas', at: day(20).slice(0, 10), confidence: 'hypothesis', tags: [] } as any);
  const qs = store.list('questions');
  const ans = (id: string, text: string, layers: any[] = []) => store.upsert('answers', { questionId: id, text, layers } as any);
  ans(qs.find((q) => q.text.startsWith('Como você se define'))!.id, 'Alguém que observa antes de falar. Curiosa, um pouco teimosa, leal.', [{ text: 'Tímida.', at: day(200) }]);
  ans(qs.find((q) => q.text.startsWith('Do que você precisa para ficar bem'))!.id, 'Silêncio pela manhã, uma caminhada, ao menos uma conversa de verdade na semana.');
  ans(qs.find((q) => q.text.startsWith('Depois de encontros sociais'))!.id, 'Cansada, mesmo quando foi bom. Preciso de algumas horas sozinha para voltar a mim.');
  store.upsert('notes', { sectionId: 'sec.preferencias', text: 'Chuva fina, cheiro de livro velho, café coado na hora.', tags: [] } as any);
  const sit = store.upsert('situations', { title: 'Viagem para Ouro Preto', date: day(-9).slice(0, 10), endDate: day(-13).slice(0, 10), tags: ['viagem', 'encontro social'], checklist: [{ id: 'c1', text: 'Reservar uma manhã livre no meio da viagem', done: false }, { id: 'c2', text: 'Levar fones', done: true }] } as any);
  store.upsert('letters', { title: 'Para o primeiro dia da viagem', body: 'Lembra que você não precisa dar conta de tudo. Se cansar, volte para o quarto sem culpa.', openAt: day(-9).slice(0, 10), sealed: true, situationId: sit.id } as any);
  store.upsert('letters', { title: 'Para um dia difícil', body: 'Você já atravessou outros. Assista aquele filme, tome um chá, durma cedo.', tags: ['dia difícil'] } as any);
  store.setPreferences({ enabledIndicators: ['sleep', 'overload'] });
  store.setDevice({ onboardingDone: true });
}
