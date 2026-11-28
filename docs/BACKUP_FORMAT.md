# Formato de backup do Palimpsesto

Versão do formato: **1** · Versão do esquema de dados: **2** (app 1.1.0)

O backup é um arquivo JSON legível, gerado em **Ajustes → Seus dados → Exportar backup**.
Ele contém *todos* os dados pessoais e as preferências visuais. Configurações específicas
do aparelho (PIN de bloqueio, biometria, tela privada) **não** entram no backup.

## 1. Arquivo simples

```json
{
  "format": "palimpsesto-backup",
  "formatVersion": 1,
  "schemaVersion": 1,
  "appVersion": "1.0.0",
  "exportedAt": "2026-11-25T10:00:00.000Z",
  "counts": { "moodEntries": 312, "experiences": 14, "...": 0 },
  "checksum": { "algorithm": "SHA-256", "value": "9f2c…" },
  "data": { "schemaVersion": 1, "moodEntries": [], "...": [] , "preferences": {} }
}
```

| Campo | Significado |
|---|---|
| `format` | Sempre `palimpsesto-backup`. Identifica o arquivo. |
| `formatVersion` | Versão do *envelope*. Muda só se a estrutura externa mudar. |
| `schemaVersion` | Versão do modelo de dados em `data` (igual a `data.schemaVersion`). |
| `appVersion` | Versão do app que exportou (informativo). |
| `exportedAt` | Data/hora da exportação (ISO 8601, UTC). |
| `counts` | Quantidade de registros por coleção (informativo, usado no resumo). |
| `checksum` | SHA-256 do **JSON canônico** de `data` (chaves ordenadas alfabeticamente, sem espaços). |
| `data` | O documento completo (ver seção 3). |

### Checksum

`checksum.value = hex(SHA-256(canonicalJson(data)))`, em que `canonicalJson` serializa objetos
com as chaves em ordem alfabética, sem espaços, omitindo chaves com valor `undefined`.
Se o arquivo for editado à mão, remova o campo `checksum` — a importação então pula
essa verificação, mas continua validando o esquema.

## 2. Arquivo protegido por senha

```json
{
  "format": "palimpsesto-backup-encrypted",
  "formatVersion": 1,
  "kdf": { "name": "PBKDF2", "hash": "SHA-256", "iterations": 600000, "salt": "<base64, 16 bytes>" },
  "cipher": { "name": "AES-GCM", "iv": "<base64, 12 bytes>" },
  "payload": "<base64>"
}
```

- Chave: PBKDF2-HMAC-SHA256(senha em NFC, sal, 600 000 iterações) → 256 bits.
- Cifra: AES-256-GCM (a etiqueta de autenticação de 128 bits fica ao fim de `payload`).
- `payload` decifrado é **exatamente** o arquivo simples da seção 1 (texto UTF-8).
- Senha errada e arquivo adulterado produzem o mesmo erro (GCM não distingue os casos).

## 3. Conteúdo de `data` (esquema 4)

Todas as entidades têm `id` (UUID), `createdAt` e `updatedAt` (ISO 8601, instantes em UTC:
quando o registro foi escrito e alterado). Relações são feitas **por id**, nunca por texto.
Datas "de calendário" usam `YYYY-MM-DD`.

### Tempo: quando aconteceu × quando foi escrito

- `at` é o **momento em que a experiência aconteceu** (equivale a `occurred_at`). Desde o
  esquema 2, é guardado como **hora local flutuante**: `YYYY-MM-DDTHH:mm:ss`, sem fuso. Um
  registro das 21h do dia 19 permanece no dia 19 às 21h mesmo que o aparelho mude de fuso.
- `createdAt` (`created_at`) e `updatedAt` (`updated_at`) não mudam quando a data da
  experiência é editada. Um registro é **retroativo** quando foi escrito num dia posterior
  ao dia em que aconteceu.
- `timePrecision`: `exact` (horário exato), `period` (período do dia: madrugada 03:00,
  manhã 09:00, tarde 15:00, noite 20:00 como representantes) ou `day` (só a data; guardado
  às 12:00 e excluído das análises por horário).
- Estatísticas, calendário, filtros, busca e relatórios usam sempre `at`.

| Coleção | Conteúdo | Relações |
|---|---|---|
| `moodEntries` | Registros de humor: `at`, `timePrecision`, `valence` (−2…+2), `energy` (1…5 ou `null`), `emotionIds`, `indicators` (`anxiety`, `irritability`, `overload`, `loneliness`: 1…5), `tags` (contexto), `itemIds` (atividades), `note` | `emotionIds → emotions`, `itemIds → repertoire` |
| `emotions` | Emoções nativas (`builtIn`, ids `emo.*`) e personalizadas; `hidden`; guia pessoal (1.9): `signals`, `helps`, `worsens` | — |
| `experiences` | Experiências (`at`, `timePrecision`): o que aconteceu, `feelingBefore`/`feelingAfter` (−2…+2), o que fez/ajudou/piorou, aprendizado, `tags`; registro de pensamentos (1.9): `intensityBefore`/`intensityAfter` e `beliefBefore`/`beliefAfter` (0–100 ou `null`), `thoughts`, `distortions`, `evidenceFor`, `evidenceAgainst`, `alternativeThought` | `situationId → situations` |
| `repertoire` | Itens do repertório: `kind` = `resource` (faz bem), `strategy`, `activity` (atividade), `drain` (desgasta); categoria, circunstâncias, efeito, frequência percebida (1…4) | — |
| `uses` | Cada uso de um item (`at`, `timePrecision`), com `outcome` (`worked`, `partial`, `didnt`, `worse`, `unknown`) e `tags` de contexto | `itemId → repertoire`, `experienceId → experiences` |
| `sections` | Fichas do Mapa (nativas `sec.*` e criadas) | — |
| `questions` | Perguntas (nativas `q.*` e criadas), `favorite`, `hidden` | `sectionId → sections` |
| `answers` | Resposta atual + `layers` (versões anteriores, da mais antiga para a mais nova) | `questionId → questions` |
| `notes` | Anotações livres das fichas, com `layers` | `sectionId → sections` |
| `discoveries` | Descobertas: `confidence` (`hypothesis`, `recurring`, `consolidated`), `status` (`active`, `superseded`), `revisions` (estados anteriores, com `note` explicando a mudança), `origin` | `sectionId`, `experienceIds`, `moodEntryIds`, `eventIds` |
| `situations` | Situações especiais: datas opcionais, `tags`, `checklist`, itens fixados | `itemIds`, `discoveryIds`, `questionIds`, `noteIds`, `letterIds` |
| `letters` | Cartas: `openAt`, `sealed`, `openedAt` | `situationId → situations` |
| `events` | Acontecimentos da linha do tempo: `title`, `description`, `date`, `endDate` (opcional), `category` (`viagem`, `trabalho`, `relacoes`, `conflito`, `conquista`, `projeto`, `rotina`, `inicio`, `encerramento`, `saude`, `medicacao` (desde a 1.6), `outro`), `tags` | — |
| `sleepLogs` | Sono (esquema 3): **no máximo uma noite por data**. `date` = manhã em que a noite terminou; `hours` (0–24 ou `null`), `quality` (1–5 ou `null`), `troubles` (`onset`, `awakenings`, `early`, `nightmares`), `factors` (o que pode ter atrapalhado, 1.9), `note` | — |
| `appointments` | Consultas (1.8): `date`, `time`, `forWhom` (`psiquiatria`, `psicologia`, `outro`), `professionalGender` (`f`, `m` ou `null`; 1.10), `professional`, `place`, `status` (`scheduled`, `done`, `canceled`), `reminderMinutes` (ou `null`), `reminderShowsType`, antes: `sinceLast`, `questions`, `requests` (`receita`, `atestado`, `exames`, `relatorio`, `outro`); depois: `observations`, `agreements` | — |
| `medications` | Medicamentos (1.8; esquema 4): `name`, `purpose`, `prescriber`, `startDate` (data aproximada — `AAAA-MM-DD`, `AAAA-MM` ou `AAAA` — ou `null` = não se lembra), `endDate` (data aproximada; `null` = em uso, ou parou sem lembrar quando), `endUnknown` (`true` = parou, data desconhecida), `stopReason` (`efeitos`, `sem_efeito`, `melhora`, `troca`, `custo`, `outro`, `nao_lembra`; `null` = não informado), `stopNote` (observações sobre a interrupção), `doses` (histórico: `date` aproximada ou `null`, `dose`, `doseUnknown`, `schedule`, `note`; a primeira é a inicial, a última a atual), `notes` (observações datadas) | — |
| `assessments` | Questionários respondidos (1.6): `instrument` (`phq9`, `gad7`), `date` (AAAA-MM-DD), `answers` (0–3 por item; 9 no PHQ-9, 7 no GAD-7), `difficulty` (0–3 ou `null`), `note` | — |
| `agenda` | Assuntos para a consulta (1.6): `text`, `forWhom` (`psiquiatria`, `psicologia`, `ambos`, `outro`), `doneAt` (data em que foi conversado ou `null`), `outcome`, `appointmentId` (consulta em que foi conversado), `dates` (dias relacionados) | — |
| `safetyPlans` | Plano de segurança (1.6; no máximo um): listas de texto `warningSigns`, `copingAlone`, `distractions`, `helpers`, `professionals`, `safeEnvironment`, `reasons` | — |
| `preferences` | `valenceLabels`/`energyLabels` (5 posições; `null` = nome original), indicadores ativos, tema ativo (`themeId`), aparência, `customThemes`, tipografia, `visualStyle` (`minimal`/`organic`), `symbolSet` (`nature`, `faces`, `fine`, `moon`, `weather`, `emoji`), `trajectoryHidden`, `showInsights`, `dismissedInsights`, `trackSleep`, `hemisphere` (`south`/`north`, para as estações), `chartPalette` (`theme`, `vibrant`, `aurora`, `nature`, `ocean`; 1.10) | — |

**Escalas:** os valores numéricos são fixos. Os nomes personalizados ficam apenas em
`preferences.valenceLabels`; trocá-los nunca altera registros.

## 4. Importação

Etapas, todas **antes** de qualquer alteração nos dados atuais:

1. Leitura do JSON (rejeita arquivos truncados ou que não sejam JSON).
2. Identificação do formato (`format`) e da versão (`formatVersion`).
3. Se protegido, pedido de senha e decifragem.
4. Recusa de `schemaVersion` maior que a suportada ("atualize o aplicativo").
5. Verificação do checksum.
6. **Migração** de esquemas antigos para o atual (mesma cadeia usada no armazenamento local).
7. Validação completa do esquema (tipos, limites, valores permitidos).
8. Revisão do conteúdo nativo do Mapa, se ainda não aplicada (`preferences.seedRevision`): novas
   perguntas e fichas entram; reformulações e retiradas só afetam perguntas nativas sem resposta e
   não editadas (as retiradas ficam ocultas, nunca apagadas).
9. Reparo de integridade: ids duplicados são unificados (fica o mais recente) e referências
   para registros inexistentes são removidas (inclusive `agenda.appointmentId` de consulta
   apagada) — tudo informado no resumo. Na mesclagem, se os dois lados tiverem plano de
   segurança, eles viram um só (fica o alterado por último, com as linhas do outro que ele
   não tinha; repetidas são ignoradas) — desde a 1.11.

O usuário então vê um resumo (contagens, intervalo de datas, versão) e escolhe:

- **Mesclar**: acrescenta registros novos; para registros com o mesmo `id` que diferem,
  aplica a regra escolhida — *mais recente* (`updatedAt`), *manter o do aparelho* ou
  *usar o do arquivo*. Importar o mesmo arquivo duas vezes não duplica nada. Temas
  personalizados são sempre mesclados; as demais preferências só se o usuário pedir.
- **Substituir**: troca tudo pelo conteúdo do arquivo. Exige digitar `SUBSTITUIR`.

Em ambos os casos, uma **cópia de segurança** do estado atual é criada antes e pode ser
restaurada em *Cópias de segurança* (as cinco mais recentes são mantidas). A gravação é
atômica: se falhar, os dados anteriores permanecem.

## 5. Compatibilidade e evolução

### Migração 1 → 2 (app 1.1.0)

- `at` de `moodEntries`, `experiences` e `uses` passa de instante UTC para hora local
  flutuante, usando o fuso do aparelho no momento da migração. O instante não muda.
- `timePrecision: "exact"` para registros antigos; `itemIds: []`; `events: []`;
  `moodEntryIds`/`eventIds: []` nas descobertas; novas preferências com valores padrão
  (`visualStyle: "minimal"`, `symbolSet: "nature"`).
- Ao abrir dados antigos, o app guarda o arquivo original intacto (`pre-migration-v1.json`)
  e uma cópia de segurança restaurável ("Antes da atualização do formato dos dados").
- Backups do esquema 1 continuam importáveis: passam pela mesma migração.

### Migração 2 → 3 (app 1.7.0) — sono uma vez por noite

- A qualidade do sono (`indicators.sleep`) e as horas (`sleepHours`) saem dos registros de
  humor e vão para `sleepLogs`, **uma noite por data**: de cada data, o valor do registro mais
  recente que o tinha. Assim, vários registros no mesmo dia não contam a mesma noite várias vezes.
- `preferences.trackSleep` fica ligado se o indicador de sono ou as horas estavam ativos;
  `"sleep"` sai de `enabledIndicators`.
- Como em toda migração, o arquivo original e uma cópia de segurança são guardados antes.
- Na importação e na mesclagem, duas noites na mesma data viram uma (fica a alterada por último).

### Migração 3 → 4 (app 1.13.0) — medicamentos com o que não se lembra

- Medicamentos ganham `endUnknown: false`, `stopNote: ""` e, em cada dose, `doseUnknown: false`.
  Datas e doses antigas não mudam: o formato novo aceita os valores antigos como estão.
- Três estados distintos, nunca preenchidos automaticamente: **não se aplica** (`endDate: null`
  e `endUnknown: false` = em uso), **não me lembro** (`startDate: null`, `endUnknown: true`,
  `doseUnknown: true`, `date: null` numa dose, `stopReason: "nao_lembra"`) e **não informado**
  (`stopReason: null`, textos vazios).
- `preferences.seedRevision` (0 nos dados antigos) marca a revisão do conteúdo nativo do Mapa já
  aplicada; `preferences.supportSuggestions` (padrão `true`) liga "Para este momento" no início.
- Uma versão anterior do app recusa o backup ("criado por uma versão mais nova"), sem alterar nada.

### Acréscimos da 1.6 (esquema 2)

As coleções `assessments`, `agenda` e `safetyPlans`, o campo `sleepHours` (movido na 1.7) e a categoria
`medicacao` são opcionais e têm valor padrão (`[]`/`null`). Backups anteriores importam sem
migração; um backup da 1.6 aberto numa versão anterior preserva os campos desconhecidos.


- Campos desconhecidos são **preservados** (os esquemas são "abertos"), então um arquivo
  de uma versão futura com o mesmo `schemaVersion` não perde informação ao passar por
  uma versão mais antiga do app.
- Para mudar o modelo: incrementar `SCHEMA_VERSION` (`src/domain/schema.ts`), adicionar a
  migração `N → N+1` em `src/data/migrations.ts` e um teste em `tests/backup.test.ts`.
  Backups antigos continuarão importáveis indefinidamente.
- `formatVersion` só muda se o envelope mudar; a importação recusa versões desconhecidas
  com mensagem clara.

## 6. Exportações complementares

- **CSV** (humor, experiências e acontecimentos): separador `;`, UTF-8 com BOM, quebras de
  linha CRLF. Valência sai como nível (1–5), valor (−2…+2) e rótulo atual. Data e hora vêm de
  `at` (quando aconteceu), com a precisão do horário; `escrito_em`/`alterado_em` vêm de
  `createdAt`/`updatedAt`. Atividades saem pelo nome. Células que começam com
  `=`, `+`, `-` ou `@` (exceto números) recebem `'` para evitar fórmulas em planilhas.
- **PDF**: relatório gerado no aparelho, com período e seções escolhidos.
