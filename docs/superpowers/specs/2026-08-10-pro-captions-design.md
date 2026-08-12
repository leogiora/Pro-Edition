# Pro Captions — desenho

**Data:** 2026-08-10
**Status:** desenho aprovado, pronto para virar plano de implementação
**Fonte da spec funcional:** `CLAUDE_START_HERE_LEO_CAPTIONS.md` (48 seções)

Este documento não repete a spec funcional. Ele registra as **decisões de
arquitetura** e, principalmente, **onde a spec original estava errada** — cada
correção abaixo veio de fato medido, não de opinião.

---

## 1. O que mudou em relação à spec original

A spec foi escrita antes de alguém abrir a API do Premiere. Três premissas dela
não sobrevivem ao contato com a API real da versão 26.3.

### 1.1. Não existe transcrição no nível da sequência

A §6 assume um `PremiereTranscriptProvider` que "lê o transcript da sequência".
Não existe. Medido no projeto `auto-broll-premiere` (`docs/API_PROOFS.md`, P3.1):

- a caption track da sequência tem 1029 itens, mas nenhum texto acessível
  (`getName()` = `"SyntheticCaption"`, `getProjectItem()` = `null`,
  `getComponentChain().getComponentCount()` = **0**);
- a classe `Transcript` só opera sobre `ClipProjectItem`.

**Consequência:** a fala do corte final tem de ser **reconstruída** clipe a
clipe. Para cada clipe da timeline, pega-se a transcrição da mídia de origem e
mantêm-se só as palavras entre `inPoint` e `outPoint`, remapeadas para tempo de
sequência.

Fórmula, válida para `speed == 1` (provada em API_PROOFS):

```
tempoNaSequencia = start + (tempoNaOrigem - inPoint)
   para inPoint <= tempoNaOrigem < outPoint
```

Isso já está implementado e testado em `auto-broll-premiere/src/transcript.ts` e
`src/domain.ts`. É código copiado, não reescrito.

### 1.2. MOGRT saiu do projeto

A §17 elege MOGRT como estratégia preferida de renderização. **Decisão do
usuário: não usar MOGRT.** As legendas vão para a caption track nativa (C1),
porque assim ele consegue corrigir qualquer coisa direto na timeline, no fluxo
que já conhece, sem gráfico nenhum poluindo a sequência.

MOGRT era apenas um meio para garantir os dois tamanhos de fonte. Ver 1.3.

### 1.3. O plugin não aplica tamanho de fonte

A §2.2 exige `STYLE_NORMAL` = 96 e `STYLE_PRICE` = 150. No Premiere, estilo de
legenda é aplicado à track, não ao item, e a API de `CaptionTrack` não expõe
escrita de aparência — só `createSetNameAction`, `setMute`, `getMediaType`,
`getIndex`, `isMuted`, `getTrackItems`.

**Decisão do usuário:** uma track só. O plugin **isola o preço no bloco próprio**
(regra mantida, é hard constraint) e **lista quais blocos são preço** na UI. O
usuário seleciona esses blocos e aumenta a fonte na mão — são 1 a 4 por vídeo.

**Consequência de desenho:** `StyleType` deixa de ser propriedade de renderização
e vira **metadado**. O núcleo continua marcando `style: "price"`; ninguém aplica
isso ao Premiere.

### 1.4. A largura de linha vira orçamento de caracteres

A §13 pede um estimador de largura baseado em métrica de fonte. Como o plugin não
controla nem consegue ler a fonte da caption track, medir largura real é
impossível pela API.

**Decisão:** limite configurável de caracteres por bloco, ajustado depois de ver
saída real na tela. Um número num arquivo de config, não um subsistema. Preço é
sempre curto (`197 REAIS`, `1.000 REAIS`) e nunca corre risco de estourar, mesmo
sendo depois aumentado para 150 pelo usuário.

### 1.5. Boa parte da segmentação da §12 é desnecessária

O JSON de transcrição do Premiere entrega, por palavra:

```json
{ "text": "relógio.", "start": 1.62, "duration": 0.63,
  "confidence": 1, "eos": true, "tags": [], "type": "word" }
```

- **`eos`** (end of sentence) dá as fronteiras de frase de graça. A segmentação
  não precisa de NLP: agrupa até `eos`, e só quebra mais se estourar o orçamento
  de caracteres ou se houver preço no meio.
- **`confidence`** por palavra alimenta a fila de revisão da §24 sem nenhum ASR.
  Isso empurra a Fase 4 (ASR secundário) para bem longe, e possivelmente para
  nunca.
- **`type`** nem sempre é `"word"`. Não presumir.

### 1.6. Padrão obrigatório do estilo visual das legendas

Como a API não escreve aparência (§1.3), este estilo é aplicado à mão pelo
usuário, uma vez, no style da caption track. Não é referência solta — é o
preset obrigatório, fechado em 2026-08-11. **Não trocar fonte, tamanho,
alinhamento, posição ou sombra por conta própria.** Se um nome de propriedade
não bater exatamente com a UI do Premiere, achar o parâmetro equivalente e
preservar o mesmo resultado visual, nunca "melhorar" o valor.

| Propriedade | Valor |
|---|---|
| Fonte | Bebas Neue |
| Estilo | Regular |
| Tamanho da fonte | 96 — bate com `STYLE_NORMAL` da §2.2; preço vai a 150 (§1.3, D-03) |
| Alinhamento do texto | Centralizado |
| Posicionamento horizontal | Centralizado |
| Posição (X, Y) | X = 0, Y = -329 |
| Tracking (espaçamento entre caracteres) | 0 |
| Espaçamento vertical | 0 |

Sombra da legenda:

| Propriedade | Valor |
|---|---|
| Ativada | Sim |
| Cor | Preta |
| Opacidade / intensidade | 96 |
| Ângulo | 137° |
| Distância | 11,3 |
| Suavização / blur | 15,6 |
| Último parâmetro (nome não confirmado na UI) | 40 |

---

## 2. Como as legendas chegam na timeline

**Decisão do usuário:** escrever o transcript corrigido de volta no
`ClipProjectItem` e deixar o Premiere gerar as legendas.

Caminho, o único que a API oferece:

```
Transcript.importFromJSON(json) → TextSegments
Transcript.createImportTextSegmentsAction(textSegments, clipProjectItem) → Action
```

### 2.1. Risco aceito, registrado uma vez

1. **É destrutivo.** Sobrescreve a transcrição original da mídia, e o clipe pode
   estar em outras sequências.
2. **O Premiere re-segmenta.** Ao gerar legendas, ele aplica as regras dele de
   caracteres e linhas. Se ignorar nossos blocos, a regra de 1 linha e a de preço
   isolado morrem na última etapa — que é onde está todo o valor do produto.

O usuário optou por esta rota conhecendo os dois riscos. A alternativa descartada
foi gerar `.srt` e arrastar para a C1 (sem re-segmentação, custo de um arrasto
manual por vídeo). Ela volta à mesa se a Fase 0 falhar.

### 2.2. Mitigação obrigatória: backup antes de escrever

`Transcript.exportToJSON` já está provado. Antes de qualquer import, o plugin
grava o transcript original em `PluginData/`, nomeado pelo clipe e por data.
Permite desfazer mesmo depois de fechar o Premiere, quando o `Ctrl+Z` já não vale.
Sem esse backup, nenhuma escrita acontece.

### 2.3. A aposta central: um bloco = um `segment`

No JSON, `segments[]` é a unidade de parágrafo. A aposta é que o Premiere crie uma
legenda por segment. Se criar, nossos blocos chegam intactos.

**Isto tem de ser a primeira coisa medida**, antes de qualquer regra de preço,
coloquial ou porquê. Ver Fase 0.

---

## 3. Arquitetura

```
Premiere (I/O)          Núcleo puro (sem Premiere)                Premiere (I/O)
──────────────          ──────────────────────────                ──────────────
sequência ativa
clipes de V1     ─┐
transcript por    ├──▶  remontar fala do corte final
ClipProjectItem  ─┘     ↓
cortes de V1     ─────▶ termos protegidos
                        ↓
                        coloquial · é/e · porquês
                        ↓
                        detectar e formatar preço
                        ↓
                        segmentar em blocos de 1 linha
                        (preço isolado · corte harmonizado)
                        ↓
                        validar (nenhum \n, nenhum preço misturado)
                        ↓
                        blocos ─────────────────────────────▶  backup
                        ↓                                      ↓
                        preços + avisos ──▶ UI                 escrever transcript
```

Três propriedades que essa forma garante:

1. **O núcleo não conhece o Premiere.** Recebe palavras com tempo e cortes,
   devolve blocos. Roda em `node --test` sem abrir o Premiere — o único jeito
   viável de iterar em regra de texto, já que não existe hot reload e cada
   alteração custa um reinício do aplicativo.
2. **Análise e escrita são etapas separadas.** O painel mostra os blocos antes de
   tocar no projeto. Nada é escrito sem o usuário ver antes.
3. **Falha isolada.** Um clipe sem transcrição, uma palavra com campo faltando ou
   um preço ambíguo derrubam só aquele item, nunca a análise inteira.

---

## 4. Módulos

Estrutura plana, seguindo o padrão que já funciona no auto-broll. A §28 da spec
sugere pastas por camada; foi deliberadamente achatada — são arquivos de 100 a
250 linhas e a pasta extra não paga o custo de navegação.

```
Pro-Captions/
├─ manifest.json
├─ package.json          node --test nativo, esbuild, sem framework de teste
├─ tsconfig.json
├─ icons/                icon@1x.png e icon@2x.png — sem eles o plugin não carrega
├─ scripts/
│  ├─ build.mjs          embute CSS e JS no HTML (copiado)
│  └─ install-link.ps1   symlink na pasta que o Premiere varre (copiado)
├─ src/
│  ├─ domain.ts          TimelineClip, sourceToSequence          [copiado]
│  ├─ transcript.ts      parse + remontagem da fala               [copiado]
│  ├─ premiere.ts        I/O: sequência, clipes, cortes, backup, import
│  ├─ texto.ts           termos protegidos · coloquial · é/e · porquês
│  ├─ preco.ts           detecção de contexto monetário + formatação BRL
│  ├─ segmentar.ts       blocos de 1 linha · preço isolado · snap em corte
│  ├─ preset.ts          config central: limites, termos, track de cortes
│  └─ ui/
│     ├─ index.html
│     ├─ main.ts
│     └─ styles.css      flexbox — CSS Grid não funciona no UXP
├─ tests/
│  ├─ preco.test.ts
│  ├─ texto.test.ts
│  ├─ segmentar.test.ts
│  └─ fixtures/          transcript real anonimizado
└─ docs/
   ├─ DEV_NOTES.md       capacidade confirmada, limitação, decisão
   ├─ API_PROOFS.md      só o que for medido no Premiere real
   └─ UXP_ARMADILHAS.md  copiado do auto-broll, atualizado
```

`texto.ts` junta quatro regras que a spec separa, porque todas fazem a mesma
coisa: percorrem o array de palavras corrigindo grafia. Separá-las em quatro
arquivos criaria quatro assinaturas idênticas e uma cadeia de imports sem ganho.

Pontuação não tem módulo próprio: vírgula pendurada é decisão de fronteira de
bloco, e portanto pertence a `segmentar.ts`.

---

## 5. Erro e diagnóstico

Regras herdadas do auto-broll, cada uma paga com um ciclo de depuração:

- **Toda chamada ao Premiere passa por um wrapper com timeout.** Há APIs que
  penduram para sempre sem rejeitar (`getFileForOpening`,
  `ComponentParam.getStartValue`). Sem timeout, o painel fica preso em
  "carregando" sem erro e sem log, e o diagnóstico vira adivinhação.
- **Erro dentro de `lockedAccess` não propaga.** Capturar em variável e relançar
  depois, senão a falha passa por sucesso.
- **`addEventListener` antes de qualquer `await`.** Se o I/O pendurar antes,
  o painel abre bonito e completamente morto.
- **Toda análise grava `ultimo-log.json` em `PluginData/`**, guardando as dez
  execuções mais recentes. Ler o arquivo é mais confiável que captura de tela; o
  painel UXP não deixa selecionar nem copiar texto.
- **Número zero também se escreve.** Uma etapa que só registra quando tem algo a
  dizer produz silêncio, e silêncio é indistinguível de funcionalidade quebrada.
- **O que importa vai no fim do log.** O log rola sozinho para baixo; resumo se
  guarda em variável e se registra no `finally`.

Na UI, erro mostra: o que aconteceu, em que etapa, o que dá para fazer, e o
detalhe técnico em área expansível. Nunca stack trace cru como UX principal.

---

## 6. Testes

`node --test` sobre `.ts` nativo do Node 24. Sem framework, sem fixture
elaborada. Gate: `npm run verify` = tipos + testes + build.

Os casos de aceitação 1 a 13 da §35 da spec viram tabela de teste direto. Os
casos de timeline da §36 não são automatizáveis pela API e viram checklist manual
em `docs/TEST_PLAN.md`.

A caption track da sequência serve como **oráculo de timing**: ela diz onde o
Premiere considera que há fala no corte final. Se a reconstrução produzir fala
onde a caption track diz que há silêncio, há bug. Fixture de validação, nunca
fonte.

---

## 7. Fases

### Fase 0 — provar a escrita (bloqueante)

Nada de regra de negócio, nada de UI acabada. Só a prova:

1. ler o transcript de um clipe real da sequência;
2. remontar como cinco `segments` curtos e forçados —
   `MEU NOME É` / `CRISTIANO ESTIVALET` / `HOJE TÁ POR` / `197 REAIS` / `E OLHA SÓ`;
3. gravar o backup do transcript original;
4. importar de volta com `createImportTextSegmentsAction`;
5. gerar legendas no Premiere e **conferir se saíram cinco blocos de uma linha**.

**Critério de saída:** um bloco do nosso JSON produz uma legenda no Premiere.
Se não produzir, o desenho da entrega volta à mesa e o `.srt` é reavaliado, com
resultado medido em vez de hipótese.

Spikes A, B, C e E da §29 da spec **já estão provados** em
`auto-broll-premiere/docs/API_PROOFS.md` e não serão refeitos. O Spike D (MOGRT)
foi cancelado junto com o MOGRT.

### Fase 1 — núcleo de texto

`preco.ts` e `texto.ts` com testes, sem tocar no Premiere. Formatação BRL,
detecção de contexto monetário, coloquial aprovado, é/e, porquês, termos
protegidos.

### Fase 2 — segmentação

`segmentar.ts`. Primeiro só por `eos`. Depois orçamento de caracteres. Depois
preço isolado. Depois snap em corte. Nessa ordem, cada etapa com teste.

### Fase 3 — painel e fluxo real

Ligar tudo: sequência ativa, seletor de track de cortes, botão único, prévia dos
blocos, lista de preços, avisos, escrita com backup.

### Fase 4 — revisão e confiança

Fila de revisão alimentada por `confidence`. ASR secundário só se a revisão
manual provar ser insuficiente na prática — provavelmente não será.

---

## 8. Decisões fechadas nesta sessão

| # | Decisão | Motivo |
|---|---|---|
| D-01 | Sem MOGRT | Legenda nativa é editável na timeline pelo usuário |
| D-02 | Uma caption track só | API não aplica aparência por item |
| D-03 | Preço isolado no bloco, fonte aumentada à mão | 1 a 4 por vídeo; zero risco técnico |
| D-04 | Escrever transcript de volta no `ClipProjectItem` | Escolha do usuário, riscos conhecidos e registrados |
| D-05 | Backup do transcript antes de toda escrita | A rota é destrutiva e sobrevive ao `Ctrl+Z` |
| D-06 | Largura por orçamento de caracteres | Fonte da caption track é inacessível pela API |
| D-07 | Segmentação baseada em `eos`, sem NLP | O Premiere já entrega fronteira de frase |
| D-08 | Repositório novo, esqueleto copiado do auto-broll | Armadilhas do UXP já resolvidas; produtos independentes |
| D-09 | `StyleType` é metadado, não renderização | Decorre de D-02 e D-03 |
| D-10 | Nome do produto: **Pro Captions** | Fecha a pendência de nome comercial da §42 da spec funcional |
| D-11 | Estilo visual fixo (fonte, tamanho, posição, sombra) — ver §1.6 | Preset obrigatório do usuário, fechado em 2026-08-11; não é mais aberto de propósito |
| D-12 | "Criar legendas a partir da transcrição" continua manual, sem tentativa de automação | Confirmado na tipagem 26.3 (P4.1-P4.3, `API_PROOFS.md`): nenhuma classe expõe esse comando nem controle de layout/estilo/duração mínima, e não há escape hatch genérico de comando de menu |
| D-13 | O caminho das legendas é o `.srt`, não o transcript | E5 falhou (o Premiere re-segmenta os segments); E5b provou que a importação de `.srt` preserva um cue por legenda. Evidência em `API_PROOFS.md` |
| D-14 | Depois de "Cristiano" exato, palavra a até metade de distância do sobrenome vira "Estivalet" automaticamente | Decisão do usuário em 2026-08-11 ("Cristiano Valete" no primeiro vídeo real); substitui a rota só-sugestão da §5 para este caso — contexto sem semelhança continua intocado |
| D-15 | Sem ponto final nas legendas | Decisão do usuário em 2026-08-12 depois do primeiro export real; "?" e "!" ficam, "1.000" não é atingido (limpeza só olha o fim do texto) |
| D-16 | Texto e preço em `.srt` separados, uma faixa de legenda cada | O estilo é da faixa (D-02): faixa de texto com estilo 96, faixa de preço com estilo 150 — elimina o ajuste manual por legenda que a D-03 aceitava |

---

## 9. Aberto de propósito

Não inventar requisito definitivo para nada disto:

- limite exato de caracteres por bloco;
- tolerância exata de snap em corte;
- formato para centavos (§3.5 da spec: marcar para revisão, não inventar
  convenção).

Tudo isso vive em `preset.ts`, centralizado, para não exigir refatoração quando
o valor mudar.

O nome comercial saiu desta lista: ver D-10.
