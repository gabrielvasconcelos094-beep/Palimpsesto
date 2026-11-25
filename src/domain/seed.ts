/**
 * Conteúdo inicial: emoções, fichas do Mapa e a biblioteca de perguntas.
 *
 * As perguntas são reflexivas e autorais. Algumas são inspiradas em ideias
 * conhecidas da psicologia (indicadas em `hint`), mas NÃO são instrumentos
 * clínicos validados e não produzem pontuação ou diagnóstico.
 *
 * Os ids são estáveis: novas versões podem acrescentar itens sem duplicar
 * os existentes (ver `syncBuiltIns`).
 */

export const BUILTIN_EMOTIONS: Array<[id: string, label: string]> = [
  ['emo.alegria', 'Alegria'],
  ['emo.tristeza', 'Tristeza'],
  ['emo.irritacao', 'Irritação'],
  ['emo.raiva', 'Raiva'],
  ['emo.ansiedade', 'Ansiedade'],
  ['emo.medo', 'Medo'],
  ['emo.frustracao', 'Frustração'],
  ['emo.solidao', 'Solidão'],
  ['emo.calma', 'Calma'],
  ['emo.serenidade', 'Serenidade'],
  ['emo.entusiasmo', 'Entusiasmo'],
  ['emo.culpa', 'Culpa'],
  ['emo.vergonha', 'Vergonha'],
  ['emo.saudade', 'Saudade'],
  ['emo.tedio', 'Tédio'],
  ['emo.confusao', 'Confusão'],
  ['emo.esperanca', 'Esperança'],
  ['emo.alivio', 'Alívio'],
  ['emo.indiferenca', 'Indiferença'],
  ['emo.sobrecarga', 'Sobrecarga'],
  ['emo.gratidao', 'Gratidão'],
  ['emo.ternura', 'Ternura'],
  ['emo.curiosidade', 'Curiosidade'],
  ['emo.cansaco', 'Cansaço'],
];

/**
 * Sugestões de contexto (circunstâncias) para registros. Atividades — o que a
 * pessoa fez — ficam no repertório, com sugestões próprias abaixo.
 */
export const CONTEXT_SUGGESTIONS = [
  'dormi bem',
  'dormi mal',
  'tempo só',
  'encontro social',
  'família',
  'trabalho',
  'descanso',
  'telas',
  'conflito',
  'imprevisto',
  'dia difícil',
  'cansaço físico',
  'calor',
  'dor',
];

/** Atividades sugeridas: viram itens do repertório só quando escolhidas. */
export const ACTIVITY_SUGGESTIONS = [
  'Ler',
  'Caminhar',
  'Ficar só',
  'Assistir a um filme',
  'Ouvir música',
  'Conversar com alguém',
  'Estudar',
  'Tempo ao ar livre',
  'Exercício',
  'Cozinhar',
  'Escrever',
  'Trabalhar',
];

export interface SeedSection {
  id: string;
  title: string;
  description: string;
  questions: Array<{ text: string; hint?: string }>;
}

export const BUILTIN_SECTIONS: SeedSection[] = [
  {
    id: 'sec.identidade',
    title: 'Identidade e personalidade',
    description: 'Como você se percebe, seus traços, forças e dificuldades.',
    questions: [
      { text: 'Como você se define?' },
      { text: 'Quais são suas principais características?' },
      { text: 'Quais são seus pontos fortes?' },
      { text: 'Quais são suas dificuldades?' },
      { text: 'Quais características você gostaria de desenvolver?' },
      { text: 'Como gostaria que as outras pessoas percebessem você?' },
      { text: 'O que gostaria que as pessoas compreendessem sobre você?' },
      { text: 'Em quais situações você sente que está sendo verdadeiramente você?' },
      {
        text: 'Se a sua vida fosse um livro, quais seriam os títulos dos capítulos até agora?',
        hint: 'Inspirada na ideia de identidade narrativa: contamos quem somos por meio de histórias.',
      },
      {
        text: 'Qual momento da sua vida mudou a forma como você se vê?',
        hint: 'Inspirada nos "pontos de virada" estudados pela psicologia narrativa.',
      },
      {
        text: 'Que traços seus aparecem em quase todo lugar, e quais mudam conforme o ambiente?',
      },
    ],
  },
  {
    id: 'sec.preferencias',
    title: 'Preferências',
    description: 'Do que você gosta, o que evita e o que te deixa confortável.',
    questions: [
      { text: 'O que você gosta de fazer?' },
      { text: 'O que você não gosta de fazer?' },
      { text: 'O que te proporciona prazer?' },
      { text: 'O que te deixa confortável?' },
      { text: 'O que te incomoda?' },
      { text: 'Como você gosta de passar seu tempo livre?' },
      { text: 'O que costuma fazer você rir?' },
      {
        text: 'Em quais atividades você perde a noção do tempo?',
        hint: 'Inspirada no conceito de "fluxo": envolvimento profundo numa atividade.',
      },
      { text: 'Quais lugares, sons, cheiros ou texturas te acolhem?' },
    ],
  },
  {
    id: 'sec.necessidades',
    title: 'Necessidades',
    description: 'O que você precisa para ficar bem — no corpo, no tempo e nos vínculos.',
    questions: [
      { text: 'Do que você precisa para ficar bem?' },
      { text: 'Quanto tempo sozinho(a) — ou consigo — você considera necessário?' },
      { text: 'Quais condições tornam um ambiente confortável para você?' },
      { text: 'Como você precisa organizar seu tempo?' },
      { text: 'O que não pode faltar em um dia satisfatório?' },
      { text: 'O que te deixa à vontade?' },
      {
        text: 'Em que momentos você sente que tem escolha sobre o que faz?',
        hint: 'Inspirada na teoria da autodeterminação, que destaca a necessidade de autonomia.',
      },
      {
        text: 'Quando você se sente capaz e competente?',
        hint: 'Inspirada na teoria da autodeterminação: necessidade de competência.',
      },
      {
        text: 'Com quem você sente que pode ser quem é?',
        hint: 'Inspirada na teoria da autodeterminação: necessidade de vínculo.',
      },
      {
        text: 'Quais sinais do corpo indicam que você precisa parar?',
        hint: 'Fome, cansaço, tensão, sono: o corpo costuma avisar antes.',
      },
    ],
  },
  {
    id: 'sec.valores',
    title: 'Valores e propósito',
    description: 'O que é importante para você e orienta suas escolhas.',
    questions: [
      { text: 'O que você considera importante na vida?' },
      { text: 'Quais características você admira nas pessoas?' },
      { text: 'Quais comportamentos você não tolera?' },
      { text: 'O que é sucesso para você?' },
      { text: 'Quais princípios você não gostaria de abandonar?' },
      {
        text: 'Se ninguém estivesse olhando, como você gostaria de agir?',
        hint: 'Inspirada na ideia de valores como direções escolhidas, e não como regras externas.',
      },
      { text: 'Que escolha recente mostrou algo que você valoriza?' },
      { text: 'O que você gostaria que dissessem sobre o modo como você tratou as pessoas?' },
    ],
  },
  {
    id: 'sec.limites',
    title: 'Limites pessoais',
    description: 'O que você não aceita, como quer ser tratado(a) e o que tira sua tranquilidade.',
    questions: [
      { text: 'O que você não gosta que façam com você?' },
      { text: 'Em quais situações você tem dificuldade de estabelecer limites?' },
      { text: 'Como você gosta de ser tratado(a)?' },
      { text: 'O que prejudica sua tranquilidade?' },
      { text: 'Como você percebe que um limite seu foi ultrapassado?' },
      { text: 'Que frase simples ajudaria você a dizer "não" quando precisar?' },
    ],
  },
  {
    id: 'sec.emocoes',
    title: 'Emoções e sentimentos',
    description: 'Como as emoções aparecem e se movimentam em você.',
    questions: [
      { text: 'O que costuma fazer você chorar?' },
      { text: 'Quais emoções você sente com mais facilidade? E quais são mais difíceis de reconhecer?' },
      {
        text: 'Como uma emoção forte aparece no seu corpo?',
        hint: 'Perceber sinais corporais ajuda a nomear o que se sente.',
      },
      {
        text: 'Quais palavras descrevem melhor suas emoções do que "bem" ou "mal"?',
        hint: 'Inspirada na ideia de granularidade emocional: nomear emoções com precisão.',
      },
      { text: 'O que você costuma fazer quando está com raiva?' },
      { text: 'O que te ajuda a se acalmar?' },
      {
        text: 'Como você falaria com uma pessoa querida que estivesse sentindo o que você sente agora?',
        hint: 'Inspirada em práticas de autocompaixão.',
      },
    ],
  },
  {
    id: 'sec.relacoes',
    title: 'Relações e convivência',
    description: 'Como você se relaciona, se aproxima e se protege.',
    questions: [
      { text: 'Que tipo de convivência te faz bem?' },
      { text: 'Como você demonstra carinho? E como gosta de recebê-lo?' },
      { text: 'Depois de encontros sociais, como você costuma se sentir?' },
      { text: 'Quais pessoas fazem você se sentir em segurança?' },
      { text: 'Como você reage quando há um conflito com alguém próximo?' },
      { text: 'O que você precisa que as pessoas saibam para conviver bem com você?' },
      { text: 'Quando você sente falta de companhia? E quando sente falta de espaço?' },
    ],
  },
  {
    id: 'sec.habitos',
    title: 'Hábitos e comportamentos',
    description: 'Rotinas e reações que ajudam ou atrapalham.',
    questions: [
      { text: 'Quais hábitos prejudicam sua vida?' },
      { text: 'Quais hábitos contribuem para seu bem-estar?' },
      { text: 'Como você reage diante de imprevistos?' },
      { text: 'O que você costuma adiar? O que acontece quando adia?' },
      { text: 'Em que momento do dia você funciona melhor?' },
      {
        text: 'Que pequeno gesto, quando repetido, faz diferença no seu dia?',
        hint: 'Mudanças pequenas e concretas costumam ser mais sustentáveis.',
      },
      { text: 'Que comportamento seu você gostaria de entender melhor?' },
    ],
  },
  {
    id: 'sec.enfrentamento',
    title: 'Dificuldades e enfrentamento',
    description: 'O que torna as coisas difíceis e o que já ajudou você a atravessá-las.',
    questions: [
      { text: 'Quais situações exigem mais atenção de você?' },
      { text: 'O que você já fez que ajudou em um momento difícil?' },
      { text: 'O que costuma piorar as coisas quando você está mal?' },
      { text: 'Qual experiência você gostaria de compreender melhor?' },
      {
        text: 'Diante de um problema, você tende a agir sobre ele ou a cuidar do que sente? Quando cada caminho ajuda?',
        hint: 'Inspirada na distinção entre enfrentamento focado no problema e focado na emoção.',
      },
      { text: 'Quem ou o que você pode procurar quando precisa de apoio?' },
      { text: 'Que pensamento costuma voltar quando algo dá errado?' },
      { text: 'De qual dificuldade você saiu e o que levou dela?' },
    ],
  },
  {
    id: 'sec.desejos',
    title: 'Desejos e projetos de vida',
    description: 'O que você deseja, imagina e quer construir.',
    questions: [
      { text: 'O que você gostaria de mudar em sua vida?' },
      { text: 'O que você gostaria de aprender ou experimentar?' },
      { text: 'Como seria um dia comum que você gostaria de viver daqui a alguns anos?' },
      { text: 'Que projeto você deixou de lado e ainda te chama?' },
      { text: 'O que você quer preservar, mesmo que tudo mude?' },
      { text: 'Que pequeno passo aproximaria você do que deseja?' },
    ],
  },
];

/** Modelos de situações. Não trazem conselhos genéricos: apenas título e marcadores. */
export const SITUATION_TEMPLATES: Array<{ title: string; tags: string[] }> = [
  { title: 'Dia difícil', tags: ['dia difícil'] },
  { title: 'Viagem', tags: ['viagem'] },
  { title: 'Aniversário', tags: ['aniversário', 'encontro social'] },
  { title: 'Festa', tags: ['festa', 'encontro social'] },
  { title: 'Férias', tags: ['férias', 'descanso'] },
  { title: 'Compromisso profissional', tags: ['trabalho'] },
  { title: 'Período de trabalho intenso', tags: ['trabalho', 'sobrecarga'] },
  { title: 'Encontro social', tags: ['encontro social'] },
];

export const RESOURCE_CATEGORIES = ['Atividade', 'Pessoa', 'Lugar', 'Hábito', 'Experiência', 'Objeto', 'Outro'];
export const ACTIVITY_CATEGORIES = ['Lazer', 'Corpo', 'Convívio', 'Estudo', 'Trabalho', 'Casa', 'Criação', 'Outro'];
export const DRAIN_CATEGORIES = ['Situação', 'Hábito', 'Comportamento', 'Ambiente', 'Relação', 'Pensamento', 'Outro'];
export const STRATEGY_CATEGORIES = ['Corpo', 'Pausa', 'Conversa', 'Distração', 'Organização', 'Expressão', 'Outro'];
