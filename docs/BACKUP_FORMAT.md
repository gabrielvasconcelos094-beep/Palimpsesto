# Formato de backup do Palimpsesto

Versão do formato: **1** · Versão do esquema de dados: **1**

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

## 3. Conteúdo de `data` (esquema 1)

Todas as entidades têm `id` (UUID), `createdAt` e `updatedAt` (ISO 8601). Relações são
feitas **por id**, nunca por texto. Datas "de calendário" usam `YYYY-MM-DD`.

| Coleção | Conteúdo | Relações |
|---|---|---|
| `moodEntries` | Registros de humor: `at`, `valence` (−2…+2), `energy` (1…5 ou `null`), `emotionIds`, `indicators` (`sleep`, `anxiety`, `irritability`, `overload`, `loneliness`: 1…5), `tags`, `note` | `emotionIds → emotions` |
| `emotions` | Emoções nativas (`builtIn`, ids `emo.*`) e personalizadas; `hidden` | — |
| `experiences` | Experiências: o que aconteceu, `feelingBefore`/`feelingAfter` (−2…+2), o que fez/ajudou/piorou, aprendizado, `tags` | `situationId → situations` |
| `repertoire` | Itens do repertório: `kind` = `resource` (faz bem), `strategy`, `drain` (desgasta); categoria, circunstâncias, efeito, frequência percebida (1…4) | — |
| `uses` | Cada uso de um item, com `outcome` (`worked`, `partial`, `didnt`, `worse`, `unknown`) e `tags` de contexto | `itemId → repertoire`, `experienceId → experiences` |
| `sections` | Fichas do Mapa (nativas `sec.*` e criadas) | — |
| `questions` | Perguntas (nativas `q.*` e criadas), `favorite`, `hidden` | `sectionId → sections` |
| `answers` | Resposta atual + `layers` (versões anteriores, da mais antiga para a mais nova) | `questionId → questions` |
| `notes` | Anotações livres das fichas, com `layers` | `sectionId → sections` |
| `discoveries` | Descobertas: `confidence` (`hypothesis`, `recurring`, `consolidated`), `status` (`active`, `superseded`), `revisions` (estados anteriores, com `note` explicando a mudança), `origin` | `sectionId`, `experienceIds` |
| `situations` | Situações especiais: datas opcionais, `tags`, `checklist`, itens fixados | `itemIds`, `discoveryIds`, `questionIds`, `noteIds`, `letterIds` |
| `letters` | Cartas: `openAt`, `sealed`, `openedAt` | `situationId → situations` |
| `preferences` | `valenceLabels`/`energyLabels` (5 posições; `null` = nome original), indicadores ativos, tema ativo, aparência, `customThemes`, tipografia, etc. | — |

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
8. Reparo de integridade: ids duplicados são unificados (fica o mais recente) e referências
   para registros inexistentes são removidas — tudo informado no resumo.

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

- Campos desconhecidos são **preservados** (os esquemas são "abertos"), então um arquivo
  de uma versão futura com o mesmo `schemaVersion` não perde informação ao passar por
  uma versão mais antiga do app.
- Para mudar o modelo: incrementar `SCHEMA_VERSION` (`src/domain/schema.ts`), adicionar a
  migração `N → N+1` em `src/data/migrations.ts` e um teste em `tests/backup.test.ts`.
  Backups antigos continuarão importáveis indefinidamente.
- `formatVersion` só muda se o envelope mudar; a importação recusa versões desconhecidas
  com mensagem clara.

## 6. Exportações complementares

- **CSV** (humor e experiências): separador `;`, UTF-8 com BOM, quebras de linha CRLF.
  Valência sai como nível (1–5), valor (−2…+2) e rótulo atual. Células que começam com
  `=`, `+`, `-` ou `@` (exceto números) recebem `'` para evitar fórmulas em planilhas.
- **PDF**: relatório gerado no aparelho, com período e seções escolhidos.
