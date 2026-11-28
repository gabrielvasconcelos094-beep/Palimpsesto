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
/**
 * Áreas da vida oferecidas como contexto do registro de humor (1.13). São marcadores
 * comuns — o mesmo vocabulário do Guia, das situações e da Trajetória —, não uma
 * classificação nova: um registro antigo com "trabalho" já pertence à área "trabalho".
 * A escolha segue áreas de vida usadas em diários de humor e em escalas de estresse
 * cotidiano (trabalho/estudo, família, relações, saúde, dinheiro, casa), mais sono e
 * solidão, que a própria pessoa costuma relatar como pano de fundo de um dia.
 */
export const CONTEXT_AREAS = ['trabalho', 'estudos', 'família', 'relacionamento', 'amizades', 'saúde', 'sono', 'dinheiro', 'casa', 'solidão'];

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

/**
 * Pergunta nativa do Mapa. O id é POSICIONAL (q.<ficha>.NN, pela ordem no array) e as
 * respostas apontam para ele: por isso nada é inserido no meio nem removido.
 * - novas perguntas entram sempre no FIM da ficha;
 * - `was`: textos anteriores; a revisão troca o texto só se a pessoa não respondeu nem
 *   editou a pergunta (a resposta continua ao lado da pergunta que ela leu);
 * - `retired`: deixa de ser criada e é ocultada se ainda não tiver resposta nem favorito
 *   (fica em "perguntas ocultas"; nada se perde).
 * Detalhes e referências: docs/PESQUISA.md, "Perguntas do Mapa".
 */
export interface SeedQuestion {
  text: string;
  hint?: string;
  was?: string[];
  retired?: boolean;
}
export interface SeedSection {
  id: string;
  title: string;
  description: string;
  /** Posição entre as fichas (as antigas usam o índice; as novas, frações para se encaixar). */
  order?: number;
  questions: SeedQuestion[];
}

/** Sobe quando o conteúdo nativo muda de um jeito que precisa ser aplicado a dados existentes. */
export const SEED_REVISION = 1;

export const BUILTIN_SECTIONS: SeedSection[] = [
  {
    id: 'sec.identidade',
    title: 'Identidade e personalidade',
    description: 'Como você se percebe, seus traços, forças e dificuldades.',
    questions: [
      { text: 'Como você se define?' },
      {
        text: 'Que palavras as pessoas próximas usam para descrever você? Quais você reconhece e quais estranha?',
        was: ['Quais são suas principais características?'],
        hint: 'Comparar a própria visão com a dos outros revela pontos cegos — e também qualidades que você não se atribui.',
      },
      {
        text: 'Quais são seus pontos fortes?',
        hint: 'Vale pensar em forças de caráter, como curiosidade, gentileza, persistência ou senso de justiça (Peterson & Seligman, 2004).',
      },
      { text: 'Quais são suas dificuldades?' },
      { text: 'Quais características você gostaria de desenvolver?' },
      // Retirada na revisão 1: sobrepõe-se à seguinte e põe o foco na imagem, não na compreensão.
      { text: 'Como gostaria que as outras pessoas percebessem você?', retired: true },
      { text: 'O que gostaria que as pessoas compreendessem sobre você?' },
      {
        text: 'Em quais situações você sente que está sendo verdadeiramente você?',
        hint: 'Inspirada na ideia de congruência de Carl Rogers: a sintonia entre o que se vive por dentro e o que se mostra.',
      },
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
        hint: 'A personalidade tem algo de estável e algo que depende da situação — um debate clássico da psicologia (Walter Mischel).',
      },
      {
        text: 'Há partes suas que você costuma esconder? O que aconteceria se elas aparecessem?',
        hint: 'Inspirada na distinção de Donald Winnicott entre um "self verdadeiro" e um "falso self" que se adapta para agradar ou se proteger.',
      },
      {
        text: 'O que em você continua igual desde a infância — e o que mudou tanto que você mal se reconhece?',
        hint: 'Uma questão clássica da filosofia: o que faz de nós a mesma pessoa ao longo do tempo (John Locke, Derek Parfit).',
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
      {
        text: 'Que pequenos prazeres, ao seu alcance, você costuma esquecer de se dar?',
        was: ['O que te proporciona prazer?'],
        hint: 'A ativação comportamental, usada no cuidado da depressão, parte justamente de retomar atividades prazerosas e significativas.',
      },
      { text: 'O que te deixa confortável?' },
      {
        text: 'Que incômodos pequenos e frequentes você tolera sem perceber o quanto pesam?',
        was: ['O que te incomoda?'],
      },
      { text: 'Como você gosta de passar seu tempo livre?' },
      { text: 'O que costuma fazer você rir?' },
      {
        text: 'Em quais atividades você perde a noção do tempo?',
        hint: 'Inspirada no conceito de "fluxo" (Mihaly Csikszentmihalyi): envolvimento profundo numa atividade.',
      },
      { text: 'Quais lugares, sons, cheiros ou texturas te acolhem?' },
      {
        text: 'O que você gostava de fazer e deixou de fazer? O que aconteceu?',
        hint: 'Abandonar o que antes dava prazer pode acompanhar fases difíceis; perceber isso já é uma informação valiosa.',
      },
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
      // Retirada na revisão 1: repete "O que te deixa confortável?" e "Quais condições tornam um ambiente confortável".
      { text: 'O que te deixa à vontade?', retired: true },
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
      {
        text: 'Como andam seu sono, sua alimentação e seu movimento? Qual deles costuma desandar primeiro quando a vida aperta?',
        hint: 'Cuidados básicos do corpo costumam ser os primeiros a falhar e estão entre os mais rápidos de retomar.',
      },
      { text: 'Do que você precisa nos dias em que não consegue pedir nada?' },
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
      {
        text: 'Em que área da vida — trabalho, relações, saúde, lazer, aprendizado — você está mais longe de como gostaria de viver?',
        hint: 'Inspirada no trabalho com valores da terapia de aceitação e compromisso (ACT), que compara a importância de cada área com o quanto se vive de acordo com ela.',
      },
      {
        text: 'Quando dois valores seus entram em conflito — segurança e liberdade, por exemplo —, qual costuma vencer?',
        hint: 'Inspirada na teoria dos valores humanos de Shalom Schwartz, em que alguns valores tendem a se opor.',
      },
      { text: 'O que você faz só por obrigação e gostaria de fazer por convicção — ou deixar de fazer?' },
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
      { text: 'Que pedido você evita fazer por medo de incomodar?' },
      { text: 'Quando dizer "sim" a alguém significa dizer "não" a você mesmo(a)?' },
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
        hint: 'Inspirada na ideia de granularidade emocional (Lisa Feldman Barrett): nomear emoções com precisão.',
      },
      { text: 'O que você costuma fazer quando está com raiva?' },
      { text: 'O que te ajuda a se acalmar?' },
      {
        text: 'Como você falaria com uma pessoa querida que estivesse sentindo o que você sente agora?',
        hint: 'Inspirada em práticas de autocompaixão (Kristin Neff).',
      },
      {
        text: 'Que emoção, na sua família, parecia não ser permitida?',
        hint: 'Inspirada em estudos sobre como as famílias ensinam a lidar com as emoções — a "meta-emoção" (Gottman, Katz & Hooven).',
      },
      {
        text: 'Que emoção costuma vir escondida atrás de outra — raiva cobrindo tristeza, por exemplo?',
        hint: 'Inspirada na distinção entre emoções primárias e secundárias da terapia focada nas emoções (Leslie Greenberg).',
      },
      {
        text: 'O que você faz para não sentir algo? E o que isso custa?',
        hint: 'Inspirada no conceito de esquiva experiencial da terapia de aceitação e compromisso (Steven Hayes).',
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
      {
        text: 'Quando alguém importante se afasta, você tende a buscar mais proximidade ou a se recolher?',
        hint: 'Inspirada na teoria do apego (John Bowlby) e em seus estudos com adultos (Hazan & Shaver).',
      },
      {
        text: 'Com quem você se sente visto(a) como pessoa inteira, e não pelo que faz ou oferece?',
        hint: 'Inspirada em Martin Buber, que distingue a relação "Eu–Tu", de encontro, da relação "Eu–Isso", de uso.',
      },
      {
        text: 'Onde você sente que pertence?',
        hint: 'A necessidade de pertencer é considerada uma das motivações humanas fundamentais (Baumeister & Leary, 1995).',
      },
      { text: 'Há alguém que você ainda não perdoou — ou a quem gostaria de pedir perdão? O que isso move em você?' },
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
      {
        text: 'Antes de um hábito que você quer mudar, o que costuma acontecer? E o que ele te dá em troca?',
        hint: 'Inspirada na análise funcional da terapia comportamental: o que vem antes, o comportamento e o que vem depois.',
      },
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
        hint: 'Inspirada na distinção entre enfrentamento focado no problema e focado na emoção (Lazarus & Folkman).',
      },
      { text: 'Quem ou o que você pode procurar quando precisa de apoio?' },
      { text: 'Que pensamento costuma voltar quando algo dá errado?' },
      { text: 'De qual dificuldade você saiu e o que levou dela?' },
      {
        text: 'Numa preocupação de agora, o que depende de você e o que não depende?',
        hint: 'Inspirada na distinção estoica (Epicteto, "Manual") entre o que está e o que não está sob nosso controle.',
      },
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
      {
        text: 'O que você deseja porque realmente quer, e o que deseja porque esperam de você?',
        hint: 'Inspirada na distinção entre aspirações intrínsecas e extrínsecas (Kasser & Ryan).',
      },
      {
        text: 'Quem você teme se tornar? E quem espera se tornar?',
        hint: 'Inspirada nos "eus possíveis" (Markus & Nurius, 1986): imagens desejadas e temidas de quem podemos vir a ser.',
      },
    ],
  },
  // --- Fichas novas (revisão 1) -------------------------------------------------
  {
    id: 'sec.historia',
    title: 'História de vida',
    description: 'Os momentos que contam quem você é — e o jeito como você os conta.',
    order: 0.5,
    questions: [
      {
        text: 'Qual é a sua lembrança mais antiga? O que ela parece contar sobre você?',
        hint: 'As perguntas desta ficha se inspiram na entrevista de história de vida de Dan McAdams: lembrança mais antiga, ponto alto, ponto baixo, ponto de virada.',
      },
      { text: 'Qual foi um ponto alto da sua vida — um momento em que você se sentiu especialmente vivo(a)?' },
      {
        text: 'Qual foi um ponto baixo? Como ele continua — ou não — presente em você?',
        hint: 'Na pesquisa de McAdams, histórias em que algo ruim leva a algo bom ("redenção") costumam acompanhar mais bem-estar do que as em que o bom se estraga ("contaminação").',
      },
      { text: 'Que pessoa marcou quem você é hoje? O que ela deixou em você?' },
      { text: 'Que história a sua família conta sobre você? Ela ainda é verdadeira?' },
      { text: 'O que você sabe hoje que gostaria de ter sabido aos quinze anos?' },
      { text: 'Em que momento você agiu de um jeito de que se orgulha até hoje?' },
      { text: 'Que capítulo da sua vida você gostaria de reescrever? E qual não mudaria de jeito nenhum?' },
      { text: 'Como você imagina o próximo capítulo?' },
    ],
  },
  {
    id: 'sec.pensamentos',
    title: 'Pensamentos e crenças',
    description: 'O que você diz a si mesmo(a) e o que toma por verdade.',
    order: 5.5,
    questions: [
      { text: 'Que frase você costuma dizer a si mesmo(a) quando erra?' },
      {
        text: 'Que crenças sobre você parecem verdades absolutas? De onde elas vieram?',
        hint: 'Inspirada na terapia cognitiva de Aaron Beck: crenças centrais sobre si, sobre os outros e sobre o futuro.',
      },
      { text: 'Quando imagina o futuro, o que você costuma prever? Essas previsões costumam se confirmar?' },
      {
        text: 'Que regras do tipo "eu deveria" ou "eu tenho que" governam seus dias?',
        hint: 'Karen Horney chamou de "tirania dos deverias" as exigências internas rígidas; a terapia cognitiva as trata como regras que podem ser revistas.',
      },
      {
        text: 'Sobre o que você pensa e repensa sem chegar a lugar nenhum? Esse pensar ajuda ou só gira?',
        hint: 'Pesquisas distinguem a ruminação que remói (associada a mais sofrimento) da reflexão que busca entender ou resolver (Treynor, Gonzalez & Nolen-Hoeksema, 2003).',
      },
      {
        text: 'Se uma pessoa amiga pensasse sobre si o que você pensa sobre você, o que diria a ela?',
        hint: 'Inspirada na técnica do "duplo padrão" da terapia cognitiva: costumamos ser mais justos com os outros do que conosco.',
      },
      {
        text: 'Que pensamento você costuma tratar como se fosse um fato?',
        hint: 'Inspirada na "desfusão cognitiva" da terapia de aceitação e compromisso: notar que um pensamento é um pensamento.',
      },
      { text: 'Que ideia sobre você mudou nos últimos anos? O que permitiu a mudança?' },
      { text: 'Como você reage quando alguém discorda de algo em que você acredita?' },
    ],
  },
  {
    id: 'sec.cuidado',
    title: 'Sofrimento e cuidado',
    description: 'Como o sofrimento aparece em você e o que ajuda — nas suas palavras, sem diagnósticos.',
    order: 8.5,
    questions: [
      {
        text: 'Como você descreveria, com suas palavras, o que sente nos seus piores dias — sem usar nomes de diagnósticos?',
        hint: 'Descrever a própria experiência com palavras próprias ajuda a comunicá-la a quem cuida de você. Se o sofrimento estiver muito intenso agora, priorize seu plano de segurança ou ligue 188 (CVV).',
      },
      {
        text: 'Quais são os primeiros sinais de que você está entrando numa fase difícil?',
        hint: 'Sinais de alerta precoces costumam se repetir de uma crise para outra e podem ser aprendidos — base de abordagens de prevenção de recaídas (Birchwood, Spencer & McGovern, 2000).',
      },
      { text: 'O que as pessoas ao seu redor percebem antes de você quando você não está bem?' },
      {
        text: 'O que significa, para você, estar melhorando — mesmo que nem tudo desapareça?',
        hint: 'Inspirada no conceito de recuperação pessoal: conexão, esperança, identidade, sentido e autonomia — o modelo CHIME (Leamy et al., 2011).',
      },
      { text: 'O que já te deu esperança num momento difícil?' },
      { text: 'Como você gostaria de ser tratado(a) quando está em sofrimento?' },
      { text: 'Que parte de você continua inteira, mesmo quando você está mal?' },
      { text: 'O que você gostaria de dizer a quem cuida da sua saúde e ainda não disse?' },
      {
        text: 'Que ideia sobre saúde mental você carrega e que talvez pese mais do que precisa?',
        hint: 'Inspirada nos estudos sobre autoestigma (Patrick Corrigan): crenças negativas que a pessoa passa a aplicar ao próprio sofrimento.',
      },
    ],
  },
  {
    id: 'sec.existencia',
    title: 'Existência e sentido',
    description: 'Liberdade, tempo, finitude e o que faz a vida valer a pena.',
    order: 10,
    questions: [
      {
        text: 'O que faz a sua vida valer a pena — mesmo nos dias difíceis?',
        hint: 'Inspirada em Viktor Frankl: o sentido pode ser encontrado no que fazemos, no que amamos e na atitude diante do sofrimento inevitável.',
      },
      {
        text: 'Que escolha importante você está adiando? O que está escolhendo ao não escolher?',
        hint: 'Inspirada no existencialismo (Jean-Paul Sartre): mesmo deixar de escolher é uma escolha.',
      },
      { text: 'Pelo que você se sente responsável — e o que tem carregado sem ser seu?' },
      {
        text: 'Em que momentos o tempo parece bem vivido? E quando ele parece escorrer?',
        hint: 'Sêneca, em "Sobre a brevidade da vida": a vida não é curta; nós é que a desperdiçamos.',
      },
      {
        text: 'Como você se relaciona com a ideia de que a vida tem fim? Isso muda o que importa para você?',
        hint: 'A consciência da finitude como bússola é tema de Epicuro a Heidegger e Irvin Yalom. Se pensar na morte trouxer sofrimento intenso, use seu plano de segurança ou ligue 188 (CVV).',
      },
      {
        text: 'Que tipo de solidão nenhuma companhia resolve? Como você convive com ela?',
        hint: 'Irvin Yalom chama de "isolamento existencial" a distância que nenhuma relação elimina por completo — um dos quatro temas da psicoterapia existencial, ao lado de morte, liberdade e sentido.',
      },
      {
        text: 'O que é felicidade para você: sentir-se bem, viver de acordo com o que valoriza ou outra coisa?',
        hint: 'Aristóteles distinguia o prazer da eudaimonia, uma vida bem vivida; a psicologia retomou a distinção entre bem-estar hedônico e eudaimônico (Ryan & Deci, 2001).',
      },
      { text: 'Do que você precisaria abrir mão para ser mais livre?' },
      {
        text: 'Quando a vida parece não fazer sentido, o que mantém você em movimento?',
        hint: 'Albert Camus, em "O mito de Sísifo", sugere que o sentido não está dado: é preciso viver mesmo diante do absurdo.',
      },
      {
        text: 'O que você gostaria de deixar para quem vier depois?',
        hint: 'Erik Erikson chamou de "generatividade" o cuidado com o que fica para as próximas gerações.',
      },
      { text: 'Em que você acredita sem poder provar?' },
      {
        text: 'Pelo que você é grato(a), mesmo sabendo que pode perder?',
        hint: 'A impermanência, central no budismo e nos estoicos, costuma ser lembrada como razão para valorizar o presente, não para temê-lo.',
      },
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
