# Palimpsesto

Aplicativo pessoal de autoconhecimento, registro emocional e reflexão — **local-first**, sem
conta, sem internet, sem anúncios. Android (APK) construído com React + TypeScript + Capacitor.

> *Palimpsesto*: manuscrito raspado e reescrito, em que as camadas antigas continuam
> discretamente visíveis. No app, respostas e descobertas podem ser reescritas sem apagar
> as versões anteriores.

O Palimpsesto **não é um instrumento clínico**: não faz diagnósticos nem substitui
acompanhamento psicológico ou psiquiátrico.

## Instalar

O APK pronto está em [`release/Palimpsesto-1.2.0.apk`](release/). No Android:
copie o arquivo para o aparelho, abra-o e permita "instalar apps desconhecidos" para o
gerenciador de arquivos quando pedido. Requer Android 7.0 ou superior.

> **Atualizações:** para instalar uma versão nova *por cima* (mantendo os dados), ela precisa
> ser assinada com a mesma chave. Se isso não for possível, exporte um backup antes,
> desinstale, instale a nova versão e importe o backup.

## O que o app faz

| Aba | Conteúdo |
|---|---|
| **Hoje** | Busca geral; **widgets** na tela inicial (ver abaixo); registro do humor em um toque; registros do dia; cartas que chegaram; situações próximas; uma "camada antiga" para reler; uma pergunta opcional; atalho "Para dias difíceis". |
| **Diário** | Humor (valência −2…+2 com nomes e símbolos personalizáveis, várias emoções, energia, atividades, indicadores opcionais, contexto, anotação), experiências e acontecimentos da linha do tempo — **inclusive retroativos** (agora, hoje, ontem ou outra data; horário exato, período do dia ou sem horário). Linha do tempo, calendário com "registrar neste dia", filtros combináveis e edição completa de registros antigos. |
| **Mapa** | 10 fichas (identidade, preferências, necessidades, valores, limites, emoções, relações, hábitos, enfrentamento, desejos) com 80 perguntas reflexivas e anotações livres; respostas com histórico em camadas; perguntas e fichas próprias; favoritas. **Descobertas** com grau de confiança (hipótese → recorrente → consolidada), histórico de mudanças e experiências que as sustentam. |
| **Guia** | **Repertório** (o que faz bem, estratégias, o que desgasta) com avaliações por circunstância; **Situações** (viagem, festa, dia difícil…) que reúnem o que *você* já registrou, com lista de cuidados e registro de como foi; **Cartas** para si, lacradas até uma data. |
| **Trajetória** | Visão geral (distribuição por registro ou por data, comparação com o período anterior, "O que seus registros mostram") e categorias: dias e horários, emoções, energia, atividades e estratégias, evolução e comparação entre intervalos, linha do tempo, padrões por contexto, calendário e regularidade. Mesmos filtros do Diário. Relatório em PDF. |
| **Ajustes** | Dois estilos visuais (Editorial minimalista e Editorial orgânico), seis famílias de símbolos da escala, 10 paletas (cada uma clara e escura), editor de temas com prévia e verificação de contraste, tipografia e tamanho do texto, nomes da escala, emoções, indicadores, backup/importação/CSV/PDF, PIN + biometria, tela privada, apagar tudo. |

## Widgets da tela inicial (Android)

Toque e segure na tela inicial → *Widgets* → *Palimpsesto*:

- **Humor (4×1, redimensionável):** os cinco símbolos da escala, na família escolhida em
  Ajustes → Escala de humor. Tocar em um abre o registro de humor já com aquele nível
  selecionado (pronto para salvar). Em alturas maiores mostra também os nomes.
- **Atalhos (3×1, redimensionável):** Registrar humor, experiência e acontecimento; cada
  um abre a tela de criação correspondente.

Seguem o tema (claro/escuro), o estilo visual e os símbolos escolhidos, funcionam com o app
fechado e se atualizam quando essas escolhas mudam. Com PIN ativado, o toque leva primeiro à
tela de bloqueio. Os widgets mostram só símbolos e nomes da escala — nenhum registro.
Detalhes técnicos em [docs/ARQUITETURA.md](docs/ARQUITETURA.md) (seção 8).

## Desenvolvimento

Requisitos: Node 20+; para o APK, JDK 21 e Android SDK (plataforma 36, build-tools 36).

```bash
npm install
npm run dev          # app no navegador (http://localhost:5173), dados no IndexedDB
npm test             # 95 testes (Vitest)
npm run typecheck
npm run build        # gera dist/
```

No modo de desenvolvimento, o console expõe `__pal.seed()` para carregar dados de exemplo.

### Gerar o APK

```bash
npm run build && npx cap sync android
cd android
echo "sdk.dir=/caminho/para/android-sdk" > local.properties
./gradlew assembleRelease      # app/build/outputs/apk/release/app-release.apk
```

A assinatura de release lê `android/keystore.properties` (não versionado):

```properties
storeFile=/caminho/palimpsesto-release.jks
storePassword=...
keyAlias=palimpsesto
keyPassword=...
```

ou as variáveis `PALIMPSESTO_KEYSTORE`, `PALIMPSESTO_KEYSTORE_PASSWORD`,
`PALIMPSESTO_KEY_ALIAS` e `PALIMPSESTO_KEY_PASSWORD`. Sem elas, gera-se um APK não assinado
(use `assembleDebug` para testes).

Ícones e telas de abertura: `node scripts/icons.mjs` (a partir de `assets/icon.svg`).
Capturas de tela: `npx vite --port 5179 & node e2e/screens.mjs <tema> <light|dark>`.
Testes de interface: `node e2e/flows.mjs`, `node e2e/flows2.mjs` e `node e2e/widgets.mjs` (com o servidor na porta 5179).
Testes nativos dos widgets (precisam de um dispositivo ou emulador):
`cd android && ./gradlew :app:assembleDebug :app:assembleDebugAndroidTest`, instale os dois APKs e rode
`adb shell am instrument -w -e class app.palimpsesto.WidgetRenderTest app.palimpsesto.test/androidx.test.runner.AndroidJUnitRunner`.
Recursos padrão e pré-visualizações dos widgets: `node scripts/widgets-assets.mjs`.
Regressão do estilo minimalista: `BASE=<url> node e2e/style-snapshot.mjs saida.json` na versão
anterior e na atual, e compare os arquivos.

## Documentação

- [Arquitetura e decisões](docs/ARQUITETURA.md) — tecnologia, armazenamento, segurança,
  temas, reorganização das áreas, análise de padrões, estrutura do código.
- [Formato de backup](docs/BACKUP_FORMAT.md) — estrutura, criptografia, validação,
  importação, compatibilidade.

## Melhorias recomendadas para versões futuras

1. **Validar em aparelhos reais e remover a permissão INTERNET** do manifesto (o app já não faz conexões; a permissão só é usada pelo WebView para servir o conteúdo local).
2. **Cifrar o arquivo local** com chave do Android Keystore (ou SQLCipher), depois de testes
   em aparelhos de vários fabricantes.
3. **Lembretes gentis e opcionais** (notificações locais, desligadas por padrão, sem cobrança).
4. **Busca global** em todas as áreas.
5. **Linha do tempo de uma descoberta** com os registros de humor que a sustentam.
6. **Análise por dia** (além de por registro) e padrões entre itens do repertório e o humor
   dos dias seguintes.
7. **Anexos** (fotos, áudio) em experiências e cartas.
8. **Sincronização opcional e cifrada de ponta a ponta** entre aparelhos do próprio usuário
   (por arquivo em pasta escolhida, sem servidor próprio).
9. **Widget** de registro rápido na tela inicial do Android.
10. Versão iOS (o código já é compatível com Capacitor iOS).
11. Tradução da interface.

## Licença das fontes e bibliotecas

Fraunces, Cormorant Garamond, Lora e Inter (SIL Open Font License); React, Capacitor, Zod,
jsPDF, Lucide (licenças MIT/ISC/Apache).
