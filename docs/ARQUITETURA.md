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

- Sem permissão de **INTERNET** no manifesto: o app é fisicamente incapaz de transmitir dados.
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

`npm test` executa 59 testes, cobrindo:
- persistência, reinício, falha de escrita e nova tentativa, recuperação de arquivo corrompido,
  cascatas, cópias de segurança, apagar tudo;
- exportação/importação completa (igualdade profunda), backups cifrados, senha errada,
  adulteração, JSON truncado, arquivos alheios, versões mais novas, erros de esquema, campos
  desconhecidos, reparo de referências;
- cadeia de migrações; mesclagem com as três estratégias e idempotência;
- CSV (rótulos personalizados, escape, fórmulas);
- estatística ordinal, períodos, padrões (inclusive ausência de conclusões com poucos dados);
- contraste de todos os temas e de paletas personalizadas extremas.
