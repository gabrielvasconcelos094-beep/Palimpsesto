# Arquitetura do Palimpsesto

## 1. Decisões principais

### Tecnologia: React + TypeScript empacotados com Capacitor (Android)

| Alternativa | Por que não (para esta versão) |
|---|---|
| Kotlin + Jetpack Compose | Melhor integração nativa, mas o ciclo de desenvolvimento e verificação visual é muito mais lento, e o sistema de temas personalizáveis em tempo real é mais trabalhoso. Para um app de formulários, textos e gráficos, o ganho de desempenho não compensa. |
| Flutter | Boa opção, mas exigiria reescrever toda a camada visual em widgets e adicionar um ecossistema extra (Dart). |
| React Native / Expo | Mais peças móveis (Metro, módulos nativos, Hermes) e builds mais frágeis para um app que não precisa de desempenho gráfico nativo. |
| **Capacitor + web** ✔ | Interface com CSS de verdade (tokens de design, tipografia, temas instantâneos), gráficos em SVG sem bibliotecas, testes de lógica e de interface rodando no Node/Chromium, e um APK pequeno (~4 MB). O conteúdo é empacotado no APK: nada é carregado da rede. |

### Armazenamento: documento JSON local, com gravação atômica

Em vez de SQLite, os dados vivem num único documento validado (`AppData`), mantido em memória
e gravado na área privada do app (`Directory.Data`).

- **Por quê:** o volume é pequeno (10 anos de uso intenso ≈ poucos MB); consultas são
  filtros simples; o arquivo local tem *o mesmo modelo do backup*, então exportar, importar,
  migrar e validar usam um único código, testado. Transações são naturais: cada alteração
  produz um novo documento validado, gravado de uma vez.
- **Segurança da gravação:** escreve em `.tmp`, confere o conteúdo, remove o antigo e renomeia.
  Na leitura, se o principal faltar, usa o `.tmp`. A cada sessão, o último arquivo bom é copiado
  para `data.prev.json`; se o principal estiver corrompido, o app recupera dessa cópia e guarda
  o arquivo danificado à parte (`corrupt-*`) — e avisa o usuário.
- **Gravações serializadas e com *debounce*** (350 ms), com `flush()` ao pausar o app.
- **Limite conhecido:** como o documento é regravado por inteiro, a abordagem é adequada até
  dezenas de MB. A camada `StorageAdapter`/`Store` isola isso; migrar para SQLite no futuro não
  afeta as telas.

### Segurança e privacidade

- **Nenhuma conexão externa:** o código não acessa a rede e a política de segurança da página
  (`connect-src 'self'`, `default-src 'self'`) bloqueia qualquer endereço de fora. A permissão
  `INTERNET` permanece no manifesto porque o WebView do Capacitor a usa para servir o próprio
  conteúdo empacotado (`https://localhost`); removê-la é uma melhoria a validar em aparelho real.
- `allowBackup="false"` + regras de extração: os dados não vão para o backup do Google nem para
  transferências entre aparelhos ou `adb backup`.
- **Bloqueio por PIN** (4–8 dígitos), guardado apenas como hash PBKDF2-SHA256 (210 000 iterações,
  sal aleatório), comparação em tempo constante, espera crescente após 5 erros. **Biometria**
  (plugin nativo próprio, `BiometricPrompt`) como atalho. Rebloqueio configurável ao voltar do
  segundo plano.
- **Tela privada** (`FLAG_SECURE`), ativada por padrão: oculta o conteúdo no seletor de apps e
  bloqueia capturas de tela.
- **Backups cifrados** com senha (PBKDF2 600 000 iterações + AES-256-GCM).
- **Apagar tudo** remove arquivos principais, cópias e configurações.
- **Decisão consciente:** o arquivo local **não** é cifrado pelo app nesta versão. Ele já está
  protegido pelo isolamento de apps do Android e pela criptografia de armazenamento do próprio
  aparelho. Cifrá-lo com chave do Keystore exigiria testes em aparelhos reais (há relatos de
  perda de chaves em alguns fabricantes) — e perder o diário de alguém é o pior resultado
  possível. Fica como melhoria planejada (ver README).
- O CSP do `index.html` proíbe qualquer conexão externa também no nível da página.

### Sistema de temas: tokens derivados com contraste garantido

Cada tema (pronto ou personalizado) define seis cores — principal, destaque, fundo,
superfície e dois complementos — além de raio dos cantos, estilo dos cartões e fonte dos
títulos. `deriveTokens()` calcula ~35 tokens (texto, texto secundário, bordas, preenchimentos
de botão, cores da escala de humor e de energia…) e **ajusta** automaticamente o que for
preciso para atingir os contrastes WCAG:

| Uso | Mínimo |
|---|---|
| Texto principal sobre fundo/cartão | 7:1 (alvo 9:1) |
| Texto secundário e terciário | 4,5:1 |
| Cor principal/destaque usada como texto | 4,5:1 |
| Rótulo sobre botão preenchido | 4,5:1 |
| Bordas de campos e cores da escala de humor | 3:1 |

Fundos de tom médio (que não permitem texto legível em nenhuma cor) são clareados ou
escurecidos. O editor mostra o relatório de contraste e avisa quando algo foi ajustado.
Os tokens viram variáveis CSS em `<html>`, então a troca de tema é instantânea em todas as
telas. As prévias da galeria e do editor aplicam os tokens só num elemento.
Testes (`tests/themes.test.ts`) verificam todos os temas nos modos claro e escuro.

## 2. Organização das telas

O documento original propunha cinco áreas. A proposta foi mantida em espírito, mas
reorganizada para eliminar redundâncias:

| Aba | Conteúdo | Origem no pedido |
|---|---|---|
| **Hoje** | Registro rápido do humor (um toque), registros do dia, cartas que chegaram, situações próximas, uma "camada antiga" para reler, uma pergunta opcional, atalhos (inclusive "Para dias difíceis") | nova |
| **Diário** | Linha do tempo de humor e experiências, calendário emocional, filtros (tipo, período, valência, emoções, texto) | Área 3 |
| **Mapa** — *quem sou* | Fichas temáticas + Descobertas | Áreas 1 e 4.1–4.2 |
| **Guia** — *como cuidar de mim* | Repertório (faz bem / estratégias / desgasta), Situações, Cartas | Áreas 2 e 4.3–4.4 |
| **Trajetória** | Distribuições, evolução, energia, indicadores, emoções, contextos, repertório, descobertas, padrões, relatório | Área 5 |

Ajustes ficam no ícone de engrenagem da aba Hoje.

Mudanças importantes em relação ao pedido:

1. **"Meu Mapa" e "Mapa do autoconhecimento" foram unificados.** As fichas (Identidade,
   Preferências, Necessidades…) e as coleções de perguntas se sobrepunham ("Como me defino?"
   aparecia nos dois). Agora existe uma única biblioteca: cada ficha é uma coleção de perguntas
   + anotações livres. Responder uma pergunta preenche a ficha. São 10 fichas e 80 perguntas
   iniciais; o usuário cria fichas e perguntas próprias, favorita, oculta e responde no seu ritmo.
2. **Repertório com três tipos num só modelo.** "O que me faz bem", "Estratégias" e "O que me
   prejudica" são o mesmo tipo de item com `kind` diferente. Qualquer item que ajuda pode
   receber **usos avaliados por contexto** — a avaliação ("funcionou", "piorou"…) pertence ao
   *uso*, não ao item, porque uma estratégia pode funcionar num contexto e não em outro.
3. **Marcadores como fio condutor.** Um vocabulário livre de marcadores ("tempo só", "viagem",
   "encontro social") aparece em registros, experiências, itens, usos, descobertas, notas, cartas
   e situações. É isso que permite às Situações reunir o que importa e à Trajetória encontrar
   padrões, sem formulários adicionais.
4. **"Dia difícil" é uma situação recorrente**, não uma área à parte: reúne estratégias que
   funcionaram em dias difíceis, cartas escritas para esses dias e descobertas relacionadas.

## 3. Ideias que diferenciam o Palimpsesto de um diário comum

- **Camadas.** Respostas e anotações reescritas guardam a versão anterior como camada
  (riscada, em itálico, com data). Descobertas registram *como e por que* a percepção mudou.
  É o conceito de palimpsesto aplicado ao autoconhecimento: você se reescreve sem se apagar.
- **Reencontro.** A tela inicial oferece um texto seu de mais de 30 dias (preferindo
  "aniversários") com a pergunta "isso ainda é verdade?" — convite, não cobrança.
- **Do vivido à descoberta.** Uma experiência pode virar descoberta ("transformar o aprendizado
  em descoberta"), que nasce como hipótese e pode se consolidar, com as experiências que a
  sustentam vinculadas.
- **Padrões → hipóteses do usuário.** Associações encontradas pelo sistema ficam visualmente
  separadas dos dados do usuário e só viram "descobertas" se o usuário quiser, com suas palavras.
- **Situações que lembram você de você.** Antes de uma viagem, o app mostra *suas* necessidades,
  *suas* estratégias com histórico de eficácia naquele contexto e *suas* experiências anteriores —
  nunca conselhos genéricos — e explica por que cada item apareceu (fixado, marcador, palavras).
- **Cartas lacradas** até uma data ou ligadas a uma situação.

## 4. Análise de padrões (como funciona)

Arquivo: `src/domain/analytics.ts`.

- A valência é **ordinal**: o app não calcula médias. Mostra contagens, proporções,
  distribuições e a categoria central (mediana categórica) com texto explicativo.
- Para cada marcador com pelo menos 5 registros com e 5 sem, compara os dois grupos:
  - valência, energia e indicadores: **delta de Cliff** (P(com > sem) − P(com < sem)), exigindo |δ| ≥ 0,3;
  - emoções: diferença de proporções ≥ 25 pontos percentuais.
- Exige ao menos 20 registros no período; abaixo disso, explica que ainda não há dados suficientes.
- Cada associação mostra os números (n com/sem, proporções) e a frase "associação, não causa".
  A tela "Como funciona" explica o método, incluindo o risco de comparações múltiplas.

## 5. Estrutura do código

```
src/
  domain/        regras puras, sem React: esquema (zod), escalas, conteúdo inicial,
                 análises, reunião de situações, utilidades
  data/          persistência: Store, adaptadores, migrações, validação/integridade,
                 backup (exportação/inspeção), mesclagem, CSV, criptografia
  theme/         cores, contraste, temas predefinidos, derivação de tokens
  platform/      ponte com o Android (arquivos, compartilhamento, biometria, ciclo de vida)
  app/           integração React: store, roteador (hash, com pilha para o "voltar"),
                 sobreposições, avisos, aplicação do tema
  ui/            componentes visuais e seletores (escalas, emoções, marcadores), autosave
  features/      telas: today, journal, map, guide, trajectory, settings, onboarding
  report/        relatório em PDF (carregado sob demanda)
  dev/           dados de exemplo (só em desenvolvimento)
android/         projeto Android (Capacitor) + plugin nativo PalimpsestoSecurity
tests/           testes unitários e de integração (Vitest)
e2e/             roteiro de capturas de tela (Playwright)
scripts/         geração de ícones
```

Regras da camada de dados:
- Toda gravação passa pelo esquema (`Store.upsert` valida; inválido lança erro e não altera nada).
- Exclusões aplicam **cascata** explícita (`removeWithCascade`), ex.: excluir um item do
  repertório remove seus usos e o desfixa das situações.
- Editores usam **salvamento automático** (`useAutosave`): nada se perde ao voltar, e nada é
  criado enquanto o rascunho está vazio.

## 6. Testes

`npm test` executa os testes unitários (82 na versão 1.1), cobrindo:
- persistência, reinício, falha de escrita e nova tentativa, recuperação de arquivo corrompido,
  cascatas, cópias de segurança, apagar tudo;
- exportação/importação completa (igualdade profunda), backups cifrados, senha errada,
  adulteração, JSON truncado, arquivos alheios, versões mais novas, erros de esquema, campos
  desconhecidos, reparo de referências;
- cadeia de migrações; mesclagem com as três estratégias e idempotência;
- CSV (rótulos personalizados, escape, fórmulas);
- estatística ordinal, períodos, padrões (inclusive ausência de conclusões com poucos dados);
- contraste de todos os temas e de paletas personalizadas extremas.

---

## 7. Versão 1.1 — decisões das melhorias

### Tempo: "aconteceu" × "escrito"
- `at` = quando aconteceu (`occurred_at`), em **hora local flutuante** (sem fuso), para que
  nenhuma conversão desloque um registro de dia. `createdAt`/`updatedAt` = quando foi
  escrito/alterado. Tudo o que é estatística, calendário, filtro, busca e relatório usa `at`.
- `timePrecision` (exato, período do dia, sem horário) permite registrar algo de semanas
  atrás sem inventar um horário. Registros "sem horário" ficam fora das análises por período.
- **"Quando aconteceu?"** aparece no topo de cada registro (Agora · Hoje · Ontem · Outra data
  + Madrugada/Manhã/Tarde/Noite/Horário exato/Não sei). No calendário, "Registrar neste dia".
  Registros retroativos mostram "Escrito em…", e há um filtro "só retroativos".
- O esquema foi para a versão 2, com migração testada, cópia do arquivo original e cópia de
  segurança restaurável.

### Atividades = itens do repertório
Em vez de criar um terceiro vocabulário (além de marcadores e repertório), atividades são
itens do Repertório com um novo tipo, `activity`. No registro de humor, "O que você fez?"
lista atividades, recursos e estratégias; sugestões (Ler, Caminhar, Ficar só…) só viram
itens quando escolhidas. Assim, a mesma "Caminhada" aparece no Diário, no Repertório (com
seus usos avaliados), nas Situações e na Trajetória, sem duplicação.
Marcadores continuam como **contexto** (circunstâncias: "dormi mal", "trabalho").

### Acontecimentos (linha do tempo) × experiências × situações
- **Experiência**: um episódio refletido (o que houve, o que ajudou, o que aprendeu).
- **Acontecimento**: um marco datado, que pode durar um período (viagem, mudança de trabalho,
  começo de um projeto). Serve de contexto: aparece na linha do tempo do Diário, no
  calendário e na Trajetória com os registros feitos durante ele — sem sugerir causa.
- **Situação**: preparação para algo (futuro ou recorrente), no Guia.

### Filtros e busca
- Um único modelo de filtros (`src/domain/filters.ts`) serve Diário, Trajetória e relatório:
  categorias diferentes se combinam com **E**; opções da mesma categoria com **OU** (emoções
  podem exigir "todas juntas"). O Diário e a Trajetória compartilham os filtros; cada um tem
  seu período (o Diário mostra tudo por padrão, a Trajetória começa em 30 dias).
- Busca geral (`src/domain/search.ts`) em todos os módulos, sem acentos e sem maiúsculas,
  com tipos e período; cartas lacradas não revelam conteúdo.

### Trajetória
Visão geral enxuta (período, filtros, distribuição da valência por registro **ou por
data**, observações) e nove categorias que se abrem sob demanda — e podem ser ocultadas:
dias e horários, emoções, energia, atividades e estratégias, evolução e comparação (inclusive
dois intervalos escolhidos), linha do tempo, padrões por contexto, calendário e regularidade.

Critérios (`src/domain/insights.ts`):
- **Dias da semana**: por padrão cada **data** pesa o mesmo (proporção calculada em cada data
  e depois combinada); a contagem por registro também está disponível. Só se aponta um dia
  quando há pelo menos 4 dias da semana com 3 datas ou mais e uma diferença ≥ 10 pontos
  percentuais para o segundo colocado. O texto informa registros, datas e a unidade usada.
- **Atividades**: compara a proporção de registros agradáveis com e sem a atividade; exige
  5 registros em cada grupo para destacar. A "mudança percebida" compara cada registro com o
  anterior do mesmo dia.
- **Estratégias**: agrupadas pela avaliação mais frequente; em empate, vale a mais cautelosa.
- Ausência de registro nunca é tratada como neutra; regularidade é apenas descritiva.
- **"O que seus registros mostram"**: observações só aparecem com dados suficientes, sempre
  com a base numérica; podem ser ocultadas ou transformadas em hipótese (descoberta). Nada é
  notificado nem cobrado.

### Estilos visuais e símbolos
- Estilo (minimalista/orgânico), paleta e família de símbolos são **três preferências
  independentes**, combináveis livremente (inclusive com paletas personalizadas).
- O Editorial orgânico vive em `src/styles/organic.css`, inteiramente sob
  `:root[data-style='organic']`, e usa tokens derivados da paleta: quatro matizes pastel
  (texto ≥ 7:1, secundário ≥ 4,5:1) e uma variante dos tons do humor (≥ 3:1 sobre os matizes).
  O minimalista não recebeu nenhuma regra nova.
- **Regressão do minimalista**: `e2e/style-snapshot.mjs` mede estilos computados de 36
  componentes (805 propriedades) e compara com a versão anterior; a única diferença
  remanescente é largura causada por conteúdo diferente.
- Seis famílias de símbolos (`src/ui/symbols.tsx`), desenhadas em SVG numa grade 24×24:
  Elementos da natureza (padrão), Clássico minimalista, Traço delicado, Fases da lua, Clima e
  atmosfera e Emojis. O nível intermediário é neutro em todas (rosto com boca reta, meia-lua,
  céu nublado, broto). Valores internos não mudam.

### Testes adicionados
- Unitários (82 no total): migração 1→2 (conversão de hora, cópias, idempotência), hora local
  estrita, registros retroativos e na mesma data, filtros combinados, busca, dias da semana
  com peso por data, critérios de suficiência, pares de emoções, atividades, estratégias,
  regularidade, observações ocultáveis, contraste dos matizes, PDF com todas as seções.
- Interface (`e2e/flows.mjs` + `e2e/flows2.mjs`): retroativo (ontem/tarde), outra data com
  horário exato, vários na mesma data, edição de registro antigo preservando `createdAt`,
  registro pelo calendário, acontecimento retroativo na Trajetória, filtros, busca, estilo
  orgânico + paleta persistentes, símbolos persistentes sem alterar registros, paleta
  personalizada nos dois estilos, observações ocultáveis, categorias personalizáveis,
  importação de backup do esquema 1 pela interface.

---

## 8. Widgets da tela inicial (versão 1.2)

### Escolha técnica
Widgets do Android são desenhados pelo launcher a partir de `RemoteViews` (um conjunto
restrito de views); não podem executar o WebView nem o React do app. Por isso o app **não
desenha** os widgets: ele entrega ao código nativo a *aparência* atual e o nativo monta os
`RemoteViews`, mesmo com o app fechado. Alternativas consideradas:

| Alternativa | Por que não |
|---|---|
| Jetpack Glance (Compose) | Exigiria Kotlin + Compose só para dois widgets simples e novas dependências. `RemoteViews` clássico funciona desde o Android 7 (minSdk 24) sem acrescentar bibliotecas. |
| Redesenhar cada widget inteiro como imagem | Quebra acessibilidade (texto), tamanhos adaptáveis e consome memória em widgets grandes. |
| Reimplementar os símbolos em código nativo | Duplicaria os seis desenhos (risco de divergência). Em vez disso, os símbolos **são rasterizados pelo próprio app** a partir do mesmo código SVG. |

### Fluxo
1. **Aparência → nativo.** Ao abrir o app e sempre que mudar tema, estilo, símbolos ou nomes
   da escala (`widgetAppearanceKey`), o app gera (`src/platform/widgets.ts`) uma carga com cores
   derivadas dos tokens (já com contraste garantido), o estilo, os nomes e os ícones em PNG
   128×128 — 5 níveis + 2 atalhos —, para a variante clara **e** a escura. Mudanças sem efeito
   visual (tamanho do texto, etc.) não reenviam nada.
2. **Gravação segura.** O plugin `PalimpsestoWidgets` grava os PNGs com nomes novos e troca o
   `config.json` por último, de forma atômica; depois apaga os arquivos antigos e pede aos
   dois providers que se redesenhem. Nenhum dado pessoal passa por aqui.
3. **Desenho.** `WidgetRenderer` escolhe a variante (fixa, ou a do modo noturno do sistema),
   pinta o fundo (forma de cantos arredondados tingida com a cor da superfície; contorno fino
   no minimalista; cantos assimétricos e uma forma abstrata discreta no orgânico) e coloca os
   ícones. Os ícones têm tamanho limitado e ficam centralizados em qualquer redimensionamento;
   nomes aparecem quando a altura permite. Se o app nunca sincronizou (ou o arquivo estiver
   corrompido), usa o conjunto padrão empacotado em `assets/widget-defaults`.
4. **Toque → app.** Cada área tem um `PendingIntent` imutável para `MainActivity` com um URI
   `palimpsesto://widget/mood/<-2…2>`, `mood/new`, `experience` ou `event`. O valor enviado é o
   **valor interno** da valência: trocar símbolos ou nomes nunca muda o que é registrado.
   O plugin entrega a ação ao app (evento retido, para o caso de o app ainda estar abrindo) e
   a limpa da intent, para que nada se repita ao reabrir ou restaurar a atividade.
5. **No app** (`src/app/widgetActions.ts`): a ação é validada (qualquer outra é ignorada) e só
   executada com o app desbloqueado. `mood/N` abre a tela inicial com o registro de humor já com
   a valência escolhida e o botão Salvar ativo; os atalhos abrem as telas de criação.

### Consumo e compatibilidade
- Sem serviços em segundo plano, sem alarmes, sem permissões novas. O Android atualiza o widget
  a cada 30 min (`updatePeriodMillis`) apenas para acompanhar o modo escuro do sistema; fora
  isso, só quando o app envia uma nova aparência ou o widget é redimensionado.
- Receivers não exportados. Tamanhos: `minResize`/`maxResize` + `targetCell` (Android 12+).
- **Limite conhecido:** o Android não avisa widgets sobre a troca claro/escuro do sistema.
  Com a aparência em "Do sistema", o widget acompanha a troca na próxima atualização (até 30
  min) ou quando o app é aberto. Temas personalizados têm aparência fixa.
- Os nomes das categorias aparecem no widget de humor quando ele é alto o bastante; se isso for
  indesejado, basta usar a altura de 1 célula (só símbolos).

### Testes
- `tests/widgets.test.ts` (13): rotas das ações e validação, SVGs sem variáveis CSS nas 5 famílias,
  famílias distintas, variantes claro/escuro, tema personalizado, estilo orgânico, nomes
  personalizados, contraste em todos os temas, chave de aparência.
- `e2e/widgets.mjs`: PNGs válidos nas 6 famílias (inclusive emojis), atualização ao trocar
  símbolos/tema/estilo/nomes, nada reenviado sem mudança visual, toque abrindo o registro
  com a valência correta e salvando, atalhos, ação inválida ignorada, abertura a frio sem
  repetir, e PIN (nada abre antes do desbloqueio).
- `WidgetRenderTest` (Android, 7 testes, em emulador): infla os `RemoteViews` reais em
  tamanho de widget, confere cinco ícones, textos, descrições de acessibilidade, cliques,
  fundo/contorno/forma por estilo, variante pelo modo noturno, redimensionamentos, ida e volta
  das ações pelos URIs e recuperação de configuração corrompida (que revelou e corrigiu um
  defeito de fallback).

---

## 9. Versão 1.3 — widgets redesenhados e gráfico em linha

### Widgets: novo desenho
A primeira versão tinha só ícones soltos sobre um retângulo. O redesenho segue a linguagem do app:

- **Humor:** cada nível ganha um *poço* circular tingido com a **cor daquele nível** (mistura de
  12% da cor sobre a superfície) com um anel suave; o símbolo da família escolhida fica no centro,
  em até 52 dp, centralizado em qualquer redimensionamento. Com 2+ linhas de altura aparece o
  título **"Como você está?" em fonte serifada** (desenhado pelo app com a própria fonte do
  tema, já que `RemoteViews` não carrega fontes do app em todos os launchers) e, a partir de ~3
  linhas, os nomes dos níveis.
- **Atalhos:** três *tiles* pastel com ícone e rótulo em negrito; no minimalista, um único tom
  discreto; no orgânico, matizes diferentes e cantos assimétricos (cada tile com o seu).
- **Minimalista:** cartão na cor da superfície, fio fino do tema, cantos conforme o tema.
  **Orgânico:** bloco pastel de cantos assimétricos, duas formas abstratas pequenas e círculos
  brancos no lugar dos poços tingidos.
- **Toque:** ripple discreto visível em fundo claro e escuro.
- A carga enviada ao nativo agora inclui `moodColors` (cor de cada nível), `tints` (quatro
  matizes pastel) e `title`. Uma configuração gravada pela 1.2 (sem esses campos) é descartada
  e o widget volta ao visual padrão empacotado até o app ser aberto uma vez.
- **Pré-visualizações do seletor** vêm do render real do código nativo (`WidgetRenderTest`),
  não de uma maquete.

### Gráfico em linha das oscilações
Onde: **Trajetória → Valência → "Linha do tempo"** (versão compacta) e **Trajetória →
Oscilações** (completa, com período, filtros, unidade, resumo e tabela). Também no relatório
em PDF (seção "Oscilações de humor e energia").

Decisões (`src/domain/series.ts`, `src/features/trajectory/LineChart.tsx`):
- **Eixo único de 5 níveis.** Humor (valência + 3) e energia compartilham as mesmas 5 posições;
  os **símbolos da família escolhida** rotulam o lado esquerdo (humor) e ícones de energia o
  direito. Não há dois eixos com escalas diferentes. Se só uma série está ligada, o eixo
  usa os ícones dela.
- **Distinção sem depender de cor:** humor = linha contínua com marcadores circulares
  preenchidos com a cor de cada nível; energia = linha tracejada com marcadores quadrados.
- **Lacunas:** mais de 3 dias sem registro interrompem a linha (ausência ≠ neutro).
- **Unidades:** *cada registro* (um ponto por registro, no horário em que aconteceu — registros
  retroativos aparecem na data certa; "sem horário" fica ao meio-dia) ou *resumo por data*, em
  que o ponto é a **mediana** da data (a categoria do meio; em número par, a inferior). Não há
  médias, porque a escala é ordinal e uma média de −2 e +2 ("0") seria uma categoria que a
  pessoa não registrou.
- **Interação e acessibilidade:** toque/ponteiro e setas do teclado selecionam o ponto; o
  detalhe mostra os nomes atuais da escala e abre o registro; a mesma informação existe como
  tabela. Legenda sempre visível; rótulos no gráfico em texto de contraste ≥ 4,5:1.
- **Descritivo:** o resumo conta quantas vezes a linha subiu, desceu ou ficou igual entre pontos
  consecutivos (sem atravessar lacunas) e avisa quando há poucos pontos; não interpreta.

### Testes
- `tests/series.test.ts` (10): pontos por registro, data em que aconteceu (retroativo), mediana
  ordinal, lacunas (inclusive o limite exato de 3 dias), energia ausente, variações, marcas do
  eixo. `tests/widgets.test.ts` (14): + cores por nível e legibilidade do símbolo sobre o poço
  tingido em todos os temas e estilos.
- `e2e/linechart.mjs`: estado vazio; linhas de humor e energia, legenda e eixos com símbolos;
  marcadores com a cor dos níveis; lacunas = trechos esperados; seleção por toque (abre o
  registro) e por teclado; ligar/desligar séries; resumo por data; tabela; registro retroativo
  na data certa; alternância na visão geral; filtros compartilhados.
- `WidgetRenderTest` (Android, 8 testes, rodados em emulador) cobre o novo desenho: poços, anéis,
  título, forma orgânica só na linha do título, tiles, nomes com altura uniforme e
  redimensionamentos; e gera as pré-visualizações do seletor em 3x a partir do render real.
  Durante essa validação apareceram dois problemas que foram corrigidos: formas decorativas que
  invadiam os poços no orgânico e poços de tamanhos desiguais quando os nomes ocupavam uma ou
  duas linhas.

## 10. Versão 1.4 — símbolos da natureza redesenhados, widgets sem texto e refinamentos

### "Elementos da natureza", novo desenho
Os cinco símbolos foram redesenhados como uma única planta que cresce, com a mesma terra e a
mesma base de caule em todos os níveis (`src/ui/symbols.tsx`):
**planta murcha** (caule arqueado, folhas pendendo) → **broto inclinado** → **broto reto com
duas folhinhas** (neutro, simétrico) → **planta jovem** → **planta em flor**. As folhas são
sólidas e têm uma borda mais cheia que a outra (função `leaf()`), o caule é mais fino (1,5) e
nada depende de transparências baixas, que ficavam "lavadas" em tamanhos pequenos. A forma muda
de nível a nível — não só a cor. Como os widgets rasterizam os mesmos SVGs, eles também mudam.

### Widgets sem texto
O título "Como você está?" e os nomes dos níveis saíram do widget de humor, e os rótulos saíram
do widget de atalhos: só símbolos e ícones, em qualquer tamanho. Os nomes continuam em
`contentDescription` (leitores de tela). A carga não tem mais `title`; uma configuração antiga
que ainda o traga é simplesmente ignorada. Os layouts não têm mais `TextView`.
`WidgetRenderTest` verifica que **nenhum texto visível** aparece em nenhum tamanho.

### Refinamentos
- **Desfazer exclusões:** toda exclusão (registro, experiência, acontecimento, item do
  repertório, situação, carta, descoberta, ficha, pergunta, resposta, anotação, emoção) mostra
  "Desfazer" por 6 s. `Store.removeUndoable()` devolve o estado anterior exatamente (inclusive
  as referências limpas pela cascata) se nada mudou desde então; se houve outras alterações,
  só recoloca o que foi removido, sem apagar o que veio depois. A confirmação continua.
- **Hoje → Últimos 7 dias:** uma faixa com o símbolo de cada data (mediana ordinal dos
  registros dela). Dias sem registro ficam vazios — não há contagem de sequência nem meta.
  Tocar abre o Diário filtrado naquela data.
- **"Salvar" sempre visível** no registro de humor (rodapé fixo da folha).
- **Bordas da tela (Android 15+):** o app passou a usar as variáveis `--safe-area-inset-*`
  injetadas pelo Capacitor (com `env()` como reserva), para o conteúdo não ficar sob a barra
  de status ou de navegação no modo de tela cheia.
- **Sem clarão branco no modo escuro:** fundo da janela, abertura e WebView seguem o modo do
  sistema (`values-night/colors.xml`, `MainActivity`) até o tema do app carregar.
- Símbolos um pouco maiores nas listas do Diário e do Hoje.

### Testes
`tests/store.test.ts` (+2: desfazer com cascata; desfazer depois de outras alterações),
`tests/widgets.test.ts` (carga sem título), `e2e/widgets.mjs` (carga sem título),
`WidgetRenderTest` (sem texto em nenhum tamanho); regressão do estilo minimalista: só mudaram
alturas e larguras de conteúdo (a faixa nova e os símbolos maiores).

## 11. Versão 1.5 — auditoria das estatísticas, novos símbolos da natureza e índices

### Diagnóstico (antes das mudanças)
- **Mantido:** gráfico em linha (Oscilações) com 5 níveis, seleção de pontos, períodos 7 dias…tudo
  e personalizado, símbolos no eixo e lacunas que não contam como neutro; distribuição dos níveis
  por dia da semana com peso igual por data e amostra mínima; calendário com toque no dia
  listando todos os registros; contagem de registros e de datas em todas as telas.
- **Aprimorado:** símbolos "natureza" (novo desenho e cores próprias); calendário (de uma bolinha
  por registro para **um símbolo por data**); resumo por data do gráfico e da faixa "Últimos 7
  dias" (mesma regra do calendário); detalhe do gráfico (lista todos os registros de uma data);
  distribuição (total e toque num nível → Diário filtrado); comparação de intervalos (índice,
  diferença em pontos, veredito, atalhos de semana e mês); "Meses mais estáveis" (substituído
  pelo indicador de estabilidade, para não haver duas noções de estabilidade).
- **Implementado:** índice médio por dia da semana; indicador de estabilidade; autoria em Sobre.
- **Não implementado, de propósito:** sequências ("dias seguidos"), conquistas e metas — o
  Palimpsesto não tem obrigações nem gamificação.

### Regras de cálculo (`src/domain/valence.ts`)
- **Resultado do dia** (`dayResult`): média dos valores da data arredondada ao inteiro mais
  próximo; no empate (x,5), para longe do zero. (−1,+1)→0; (−2,+1)→−1; (−2,−1)→−2; (+1,+2)→+2.
  Usado no calendário, na faixa de 7 dias e no "resumo por data" do gráfico (energia: mesma regra
  em torno de 3). Substitui a mediana inferior usada até a 1.4, para que a mesma data nunca
  apareça com símbolos diferentes em telas diferentes. Os registros não são alterados.
- **Índice de valência** (`valenceIndex`): média de cada data, depois média das datas (peso igual
  por data). Sempre exibido com registros e datas. A escala é ordinal: o índice é descritivo e
  aproximado, nunca uma medida clínica. Sem registros, o índice é vazio (não zero).
- **Por dia da semana** (`weekdayIndex`): índice de cada dia da semana; um dia só entra no "mais
  alto/mais baixo" com ≥ 3 datas; o destaque exige ≥ 3 dias elegíveis e diferença ≥ 0,25 ponto.
- **Comparação** (`compareIndex`): B − A em pontos; "sem mudança relevante" abaixo de 0,25;
  "insuficiente" se algum lado tiver < 5 registros ou < 3 datas. Semanas, meses ou datas livres,
  quaisquer duas (não só atual × anterior).
- **Estabilidade** (`stability`): 100 × (1 − desvio-padrão populacional ÷ 2), limitada a 0–100;
  exige ≥ 5 registros em ≥ 3 datas. A interface diz explicitamente que **estabilidade não é
  bem-estar** (só avaliações negativas = muito estável).

### Símbolos "Elementos da natureza"
Planta murcha (terracota) → debilitada (ocre) → broto (verde acinzentado) → planta com botão
(verde) → planta florida com flor amarela e centro castanho. Como os emojis, a família tem cores
próprias (`NATURE_COLORS`) e não usa as cores do tema; as outras famílias continuam iguais.
Aparecem em todos os lugares que usam `MoodSymbol`/`ValenceMark` (registro, Hoje, Diário,
calendário, gráficos, estatísticas) e nos widgets, que rasterizam o mesmo SVG. No widget, com essa família,
os poços são tingidos com as cores das plantas (`NATURE_LEVEL_COLORS`), e não com as do tema.

### Testes
`tests/valence.test.ts` (18): exemplos do resultado do dia, empates, ponto flutuante, peso por
data, dia da semana (elegibilidade, amostra pequena, dias próximos), comparação (alta, baixa, sem
mudança, insuficiente, período vazio), semanas/meses, estabilidade (sem variação positiva e
negativa = 100, máxima = 0, intermediária, amostra pequena) e formatação.
`e2e/stats.mjs`: estado vazio, calendário com um símbolo e contagem, registros do dia com
horário, atualização ao editar e ao excluir, distribuição clicável, índice por dia da semana,
comparação de meses e semanas (com período vazio), estabilidade e Sobre.

## 12. Versão 1.6 — acompanhamento clínico baseado em evidências

Fundamentação e fontes em [PESQUISA.md](PESQUISA.md). Princípios mantidos: local, sem
lembretes, sem diagnóstico, sem causalidade.

- **Questionários** (`src/domain/assessments.ts`, `src/features/care/Care.tsx`): PHQ-9 e GAD-7,
  coleção `assessments`. Só salva completo; pontuação, faixa, mudança relevante (PHQ-9 ≥ 5,
  GAD-7 ≥ 4), histórico com gráfico e faixas. Item 9 do PHQ-9 > 0 → `SafetyNotice` (CVV 188,
  SAMU 192, plano de segurança).
- **Plano de segurança** (Stanley & Brown): coleção `safetyPlans` (no máximo um), 6 passos +
  razões para viver; números de emergência fixos; atalho também em Ajustes → Sobre.
- **Pauta da consulta**: coleção `agenda` (assunto, para quem, conversado em, o que foi
  combinado). Itens marcados hoje continuam à vista para anotar o combinado.
- **Resumo para a consulta**: `buildReport` com `CONSULT_SECTIONS` e título próprio; período
  "desde a última consulta" (último `doneAt` da pauta), 30 ou 90 dias. Novas seções do PDF:
  `agenda`, `assessments` (logo após o resumo) e `sleep`; RMSSD na seção de valência.
- **Sono**: `MoodEntry.sleepHours` (opcional; preferência `trackSleepHours`), categoria "Sono"
  na Trajetória (`src/domain/sleep.ts`): uma noite por data (o valor mais recente), mediana,
  desvio-padrão entre noites (≥ 5 noites), noites < 6 h, índice de humor após < 6 h × ≥ 7 h
  (≥ 3 datas em cada grupo). Coluna `horas_de_sono` no CSV.
- **Instabilidade (RMSSD)** (`instability` em `valence.ts`): raiz da média dos quadrados das
  diferenças entre registros consecutivos; pares com mais de 3 dias de distância não entram;
  mínimo de 5 pares; mostrada junto à estabilidade, que continua sendo a do desvio-padrão.
- **Medicação**: categoria `medicacao` nos acontecimentos, com orientação no formulário.
- **Esquema**: tudo opcional e com padrão — o esquema continua 2, sem migração (ver
  BACKUP_FORMAT.md). Coleções novas entram automaticamente em backup, mesclagem, validação,
  "Desfazer" e contagens.

### Testes
`tests/care.test.ts` (14): itens e faixas, limites das faixas, completude, item 9, mudança
relevante, histórico, esquema (respostas fora de 0–3 recusadas; dados antigos válidos), sono
(uma noite por data, mediana, variação, comparação, amostra pequena), RMSSD (0, máximo,
ordem importa, lacunas). `e2e/care.mjs`: pauta (adicionar, conversado, combinado, desfazer),
GAD-7, PHQ-9 com aviso de segurança, histórico e mudança, plano de segurança, horas de sono
(ajuste, registro, Trajetória), medicação, RMSSD na Evolução e o PDF da consulta (download e
cabeçalho `%PDF`).

## 13. Versão 1.7 — sono uma vez por noite (esquema 3)

**Problema:** a qualidade do sono era um indicador do registro de humor (e as horas, um campo
dele). Com vários registros no dia, a mesma noite podia ser informada — e contada — várias
vezes, inclusive com valores diferentes.

**Solução:** o sono virou uma entidade própria, `sleepLogs`, com **uma noite por data**
(`date` = manhã em que a noite terminou). O registro de humor mostra e edita a noite da sua
data ("Sono · noite de 25 para 26"), sem criar outra; a tela Hoje tem "Como foi a noite?";
`store.setSleep(date, patch)` cria ou atualiza a noite daquela data e a remove se ficar vazia;
`repairIntegrity` unifica noites repetidas na mesma data (importação/mesclagem). Migração
2 → 3 em `src/data/migrations.ts` (ver BACKUP_FORMAT.md).

**Três medidas, como no Diário de Sono Consensual (Carney et al., 2012, *Sleep*):**
- **Duração** em horas, com a referência geral de 7–9 h para adultos (Hirshkowitz et al.,
  2015, National Sleep Foundation) — referência, não julgamento.
- **Qualidade** 1–5 com descrição de cada nível ancorada no quanto descansou
  (`SLEEP_QUALITY` em `scales.ts`). As descrições **não usam horas**: duração e qualidade são
  medidas diferentes (dá para dormir 8 h fragmentadas e acordar exausto).
- **Dificuldades**: demorar a pegar no sono, acordar durante a noite, acordar cedo demais — os
  três padrões de insônia que a psiquiatria pergunta (o PHQ-9 também tem um item de sono).

**Trajetória → Sono:** noites informadas, mediana de horas, variação entre noites, barras
noite a noite (com linha de 6 h), distribuição da qualidade e contagem das dificuldades (cada
noite conta uma vez), e duas comparações descritivas do índice de humor: após noites < 6 h ×
≥ 7 h e após noites ruins × boas (≥ 3 datas em cada grupo). CSV próprio ("Sono"), uma linha
por noite; seção "Sono" do PDF atualizada.

Testes: `tests/care.test.ts` (migração 2 → 3, noites repetidas unificadas, `setSleep` sem
duplicar e removendo quando vazio, vários registros no dia não multiplicam a noite, qualidade
e comparações); `e2e/care.mjs` ("Como foi a noite?" com as descrições, três registros de humor
no mesmo dia editando a mesma noite, Trajetória → Sono).

## 14. Versão 1.8 — consultas com data e lembrete, e medicamentos

Avaliação do pedido (o que entrou, o que mudou e por quê):

- **Data e alarme da consulta — entrou, com cuidado.** O app evitava notificações porque não
  quer cobrar nada; um lembrete *pedido por você, para uma consulta* é outra coisa. Fica
  desligado por padrão, é escolhido por consulta (30 min, 1 h, 2 h ou 1 dia antes) e usa
  notificação **local** (`@capacitor/local-notifications`, AlarmManager; sobrevive a
  reinícios). O texto é **neutro por padrão** ("Você tem um compromisso às 14:30"), porque a
  notificação pode aparecer na tela de bloqueio; mostrar "Consulta de psiquiatria" é opção.
  Não pedimos permissão de alarme exato (`SCHEDULE_EXACT_ALARM` removida do manifesto): o
  aviso pode chegar com alguns minutos de diferença — aceitável para uma consulta e uma
  permissão a menos. Ao marcar como realizada/cancelada ou excluir, o lembrete é cancelado;
  ao abrir o app, todos são reagendados (ex.: após importar um backup).
- **Campos certinhos — entraram, mas poucos.** Antes: "como estive desde a última consulta"
  (com um resumo automático do período: registros, índice, sono, PHQ-9/GAD-7, mudanças de
  medicação e acontecimentos), assuntos da pauta (filtrados por profissional), perguntas e
  pedidos (receita, atestado, exames, relatório). Depois: "o que foi observado ou dito" e
  "combinados até a próxima". Evitei um formulário longo: numa consulta curta, o que mais se
  perde são as perguntas e os pedidos.
- **Observações do terapeuta — entrou com outro nome.** "O que foi observado ou dito", nas
  suas palavras: são anotações suas, não um prontuário do profissional.
- **Histórico de remédios — entrou como módulo próprio**, no lugar de depender de
  "acontecimentos" de medicação: em uso (dose, frequência, desde quando, para quê, quem
  prescreveu), histórico de doses, observações datadas e anteriores (até quando e por que
  parou). O histórico de tentativas anteriores é das primeiras perguntas da psiquiatria.
  **Ficou de fora, de propósito:** banco de remédios, cálculo/validação de dose e lembrete de
  tomar (riscos de erro e de cobrança); "Parei de tomar" lembra que alguns precisam de redução
  gradual e que nada deve mudar sem orientação.

Implementação: coleções `appointments` e `medications` (esquema 3, com padrão — sem
migração); regras puras em `src/domain/care.ts`; lembretes em `src/platform/reminders.ts`;
telas em `src/features/care/Appointments.tsx` e `Medications.tsx`; atalho na tela Hoje para
consultas dos próximos 7 dias; PDF com "Para esta consulta" e "Medicamentos" (em uso e
mudanças no período); o resumo de uma consulta cobre desde a última consulta realizada do
mesmo tipo.

Testes: `tests/appointments.test.ts` (horário do lembrete com e sem horário, texto neutro,
próximas × anteriores, última realizada do mesmo tipo, pauta por profissional, id estável da
notificação, dose atual, em uso × anteriores, mudanças no período, esquema). `e2e/appointments.mjs`:
agendar (herdando o profissional), lembrete e texto neutro/explícito, preparo com resumo,
pauta filtrada, perguntas e pedidos, PDF da consulta, atalho na tela Hoje, marcar como
realizada cancelando o lembrete, anotações e pauta conversada, agendar a próxima,
medicamentos (novo, mudança de dose, observação, anterior com motivo).
Não testado em aparelho: a notificação tocando de fato (o emulador deste ambiente não roda
o WebView do app).

## 15. Versão 1.9 — avaliação das sugestões e o que entrou

Cada sugestão foi avaliada antes de entrar:

- **Calendário emocional sem filtros — aceito.** O período e os filtros da Trajetória não
  faziam sentido num calendário navegado mês a mês (e, pior, escondiam meses fora do período).
  A categoria agora não tem a barra e oferece cinco visões, todas com o "resultado do dia" e o
  índice com peso igual por data: **Mês**; **Ano dia a dia** (12 linhas × 31 dias, cada dia na
  cor do seu resultado); **Semanas**; **Estações** e **Anos** (`src/domain/calendar.ts`).
- **Estações "com base na localização" — adaptado.** Em vez de pedir localização (o app não
  usa nada do tipo), o usuário escolhe o hemisfério (padrão: Sul); as estações seguem as datas
  astronômicas aproximadas. A tela avisa que o padrão sazonal só é considerado quando se repete
  por **dois anos seguidos** (critério do DSM-5) e que, perto do equador, a luz do dia varia
  pouco — para observar e levar à consulta, não para concluir.
- **Assunto marcado não some — aceito.** Fica riscado, com "o que ficou acertado", na aba e
  na consulta. **Excluir** e **vincular dias** (tocar no dia abre os registros dele, útil na
  sessão para explicar o que houve) em cada assunto; ao marcar dentro de uma consulta, o assunto
  fica ligado a ela (`appointmentId`). Componente único: `AgendaItemRow`.
- **Intervalo entre sessões como período padrão — aceito no contexto certo.** No preparo da
  consulta, o resumo usa por padrão "desde a última consulta" e o início é editável; um botão
  leva esse período para a Trajetória. Na Trajetória há o atalho "Desde a última consulta",
  mas o padrão geral continua 30 dias (a Trajetória serve a outros usos).
- **Excluir consultas — corrigido.** Já existia, mas escondido em "Editar"; agora há um botão
  de excluir no topo da consulta (com "Desfazer"); os assuntos da pauta são mantidos.
- **Por que o sono foi ruim — aceito.** Além das dificuldades (agora com "pesadelos"), "o que
  pode ter atrapalhado": 13 fatores comuns na avaliação da insônia (preocupação, ansiedade,
  tristeza, dor, ambiente, telas, cafeína, álcool, horário, cochilo, obrigação, cuidar de
  alguém, remédio). A Trajetória → Sono mostra, por fator, em quantas noites apareceu e a
  proporção de noites ruins com e sem ele (≥ 3 noites de cada lado) — associação, não causa.
- **RPD nas experiências — aceito, integrado.** A experiência segue agora a lógica do Registro
  de Pensamentos (Beck): situação → emoções e intensidade (0–100) → **o que passou pela cabeça**
  e quanto acreditou → armadilhas de pensamento (12, em linguagem simples) → examinar
  (evidências a favor e contra, pensamento mais equilibrado, crença depois) → o que fez →
  intensidade depois. Tudo opcional; os campos de ação continuam. Nova categoria
  **Trajetória → Pensamentos**: armadilhas mais frequentes, queda mediana da crença e da
  intensidade, emoções associadas e os pensamentos equilibrados para reler.
- **Como lido com cada emoção — não existia; criado.** "Minhas emoções" (Guia → Repertório):
  para cada emoção, quando aparece (dias, períodos, níveis), o que vem junto (emoções,
  contextos, atividades), o que passou pela cabeça, o que você fez e como foi (estratégias e
  intensidade antes/depois) e um **guia pessoal** (o que ela sinaliza, o que ajuda, o que piora).
  Uma frase sobre a função de cada emoção nativa serve de ponto de partida (ideia comum à TCD
  e às terapias focadas em emoção). Ligado à Trajetória → Emoções, à categoria Pensamentos e à
  busca.

Incongruências e conexões corrigidas: aviso "sem lembretes" desatualizado; o tipo de
acontecimento "Medicação" agora aponta para o módulo de medicamentos; a linha do tempo da
Trajetória mostra mudanças de medicação e consultas realizadas; a situação "Dia difícil" liga
ao plano de segurança e às emoções; o PDF inclui o registro de pensamentos das experiências e
os dias vinculados aos assuntos; a busca encontra pensamentos e o guia das emoções; índice
rápido na aba Consultas.

Testes: `tests/v19.test.ts` (estações nos dois hemisférios e virada do ano, ano/semanas/anos,
fatores do sono com amostra mínima, esquema com padrões e limites) e `e2e/v19.mjs` (todas as
visões do calendário, pauta riscada com dia vinculado, consulta com período editável e exclusão,
atalho de período, fatores do sono, registro de pensamentos, categoria Pensamentos, perfil da
emoção com guia).
