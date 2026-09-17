# API_PROOFS

Registro de toda API critica do Premiere. Nada entra em codigo de produto sem uma
linha aqui com resultado **real**, obtido na versao instalada.

Premiere alvo: **26.3.2** (Windows x64)
Modulo: `const ppro = require("premierepro")`

---

## 1. Confirmado na documentacao oficial (ainda NAO executado)

Assinaturas copiadas da referencia oficial em 2026-08-06. Serviram para escrever
`proofs.js` sem inventar metodos. **Documentado nao e o mesmo que funcionando.**

| Classe | Membro | Assinatura | Fonte |
|---|---|---|---|
| Project | `getActiveProject` | `(): Promise<Project>` estatico | ppro-reference/classes/project |
| Project | `getActiveSequence` | `(): Promise<Sequence>` | idem |
| Project | `getRootItem` | `(): Promise<FolderItem>` | idem |
| Project | `importFiles` | `(filePaths: string[], suppressUI: boolean, targetBin: ProjectItem, asNumberedStills: boolean): Promise<boolean>` | idem |
| Project | `executeTransaction` | `(cb: (c: CompoundAction) => void, undoString?: string): boolean` | idem |
| Project | `lockedAccess` | `(cb: () => void): void` | idem |
| CompoundAction | `addAction` | `(action: Action): boolean` | classes/compoundaction |
| Sequence | `getVideoTrack` / `getAudioTrack` / `getCaptionTrack` | `(trackIndex: number): Promise<Track>` | classes/sequence |
| Sequence | `getVideoTrackCount` / `getAudioTrackCount` / `getCaptionTrackCount` | `(): Promise<number>` | idem |
| Sequence | `getTimebase` | `(): Promise<string>` | idem |
| Sequence | `getFrameSize` | `(): Promise<RectF>` | idem |
| Sequence | `getSettings` | `(): Promise<SequenceSettings>` | idem |
| VideoTrack | `getTrackItems` | `(trackItemType, includeEmptyTrackItems): VideoClipTrackItem[]` | classes/videotrack |
| VideoClipTrackItem | `getStartTime` / `getEndTime` / `getInPoint` / `getOutPoint` | `(): Promise<TickTime>` | classes/videocliptrackitem |
| VideoClipTrackItem | `getSpeed` | `(): Promise<number>` | idem |
| VideoClipTrackItem | `isSpeedReversed` | `(): Promise<number>` | idem |
| VideoClipTrackItem | `getProjectItem` | `(): Promise<ProjectItem>` | idem |
| SequenceEditor | `getEditor` | `(sequence: Sequence): SequenceEditor` estatico | classes/sequenceeditor |
| SequenceEditor | `createOverwriteItemAction` | `(projectItem, time, videoTrackIndex, audioTrackIndex): Action` | idem |
| SequenceEditor | `createInsertProjectItemAction` | `(projectItem, time, videoTrackIndex, audioTrackIndex, limitShift): Action` | idem |
| SequenceEditor | `createRemoveItemsAction` | `(trackItemSelection, ripple, mediaType, shiftOverLapping): Action` | idem |
| TickTime | `createWithSeconds` / `createWithTicks` / `createWithFrameAndFrameRate` | estaticos | classes/ticktime |
| Transcript | `hasTranscript` | `(clipProjectItem: ClipProjectItem): boolean` | classes/transcript |
| Transcript | `exportToJSON` | `(clipProjectItem: ClipProjectItem): Promise<string>` | idem |
| Transcript | `importFromJSON` | `(jsonString: string): TextSegments` | idem |
| FolderItem | `getItems` | `(): Promise<ProjectItem[]>` | classes/folderitem |

### Achado documental relevante

A classe `Transcript` **so opera sobre `ClipProjectItem`**. Nao ha, na referencia,
nenhum metodo que exporte a transcricao de uma `Sequence`. Isso confirma a premissa
da secao 9 do CLAUDE.md: a transcricao final provavelmente tera de ser
**reconstruida** item a item. `getCaptionTrack()` existe e e o unico caminho
alternativo plausivel — P3.1 vai medir se ele carrega conteudo util.

---

## 2. Tabela de capacidade — resultados reais

Execucao: 2026-08-06 13:28 UTC, Premiere **26.3.2**, projeto `Andro - 21.07_1.prproj`,
sequencia `Reels` (3 video / 2 audio / 1 caption, 21m14s). Log bruto: 464 KB.
**14 de 14 provas de leitura passaram, zero falhas.**

| # | Requisito | Resultado | Risco restante |
|---|---|---|---|
| P0.1 | Modulo carrega | **OK** — 70 classes expostas | - |
| P0.3 | Enum de track item | **OK** — `{EMPTY:0, CLIP:1, TRANSITION:2, PREVIEW:3, FEEDBACK:4}` | nenhum, valor fixado |
| P1.1 | Projeto ativo | **OK** — `path` vem com prefixo `\\?\`, precisa normalizar | baixo |
| P1.2 | Sequencia ativa | **OK** | baixo |
| P1.4 | Frame rate | **OK** via `getSettings().getVideoFrameRate()` → `value: 29.992831712512263`, `ticksPerFrame: "8469223661"`; frame 1080x1920. `getFrameSize()` retorna `{}` — inutil | baixo |
| P1.5 | Contagem de faixas | **OK** — video 3, audio 2, caption 1 | - |
| P2.1 | Snapshot da timeline | **OK** — ver "Semantica de tempo" abaixo | baixo |
| P2.1b | Velocidade e reverse | **OK** — `speed: 1`, `reversed: 0` em todos os itens desta sequencia | **nao testado com speed != 1** |
| P3.1 | Transcricao no nivel da sequencia | **NAO SERVE** — caption track tem 1029 itens, mas sem texto acessivel. Ver abaixo | resolvido: fallback confirmado |
| P3.1b | Estrutura do CaptionTrackItem | **OK** — `getName()` = `"SyntheticCaption"`, `getProjectItem()` = `null`. So timing | - |
| P3.1c | Texto no ComponentChain | **OK, resultado negativo** — `getComponentCount()` = **0** | - |
| P3.3 | Transcricao por clipe | **OK** — camera principal (`IMG_1190.MOV`, `IMG_1193.MOV`) tem `true`; B-rolls tem `false` | B-roll sem transcricao e o esperado |
| P3.4 | Formato do JSON | **OK** — formato completo abaixo, 100 KB para um clipe | - |
| P4.1 | Editor da sequencia | **OK** — expoe tambem `createAddItemAction` / `createAddItemsAction`, **nao documentados** | - |
| P4.2 | Transacao | **OK** — `executeTransaction`, `lockedAccess`, `importFiles` presentes | comportamento de undo nao testado |
| P5.2 | Importar arquivo sem UI | **OK** — `importFiles([caminho], true, rootItem, false)` retorna `true`. Caminho como string comum; nao precisa do sandbox UXP | baixo |
| P5.4 | Overwrite em V2 sem tocar V1 | **OK** — `videoTrackIndex: 1`, `audioTrackIndex: 2`. V1 intacta (31 itens) | baixo |
| P6 | Destino do audio | **OK** — audio do B-roll isolado na A3; A1 (30 itens) e A2 (musica) intactas | baixo |
| P7 | Motion/Escala alcancavel | **OK** — `AE.ADBE Motion`, param `Scale` | baixo |
| P8 | Remover o audio do B-roll | **OK** — A3 zerada, A1 e A2 preservadas | baixo |
| P9 | Escalar para preencher | **OK** — Scale 100 -> 150 | dimensao da fonte ainda nao e legivel pela API |
| P5.5 | Undo unico desfaz o lote | **NAO PROVADO** — hoje sao 3 transacoes separadas | ver Fase 4 |

### Semantica de tempo — resolvida (era o maior risco)

A documentacao diz que `getInPoint()` e "relative to the start time", o que sugeria
tempo de sequencia. **E falso.** Os dados provam que `inPoint`/`outPoint` sao tempos
**na midia de origem**, e `start`/`end` sao tempos **na sequencia**:

```
item 1: start 0.000000  end 1.500359   inPoint 0.833533  outPoint 2.333891
        end - start      = 1.500359
        outPoint-inPoint = 1.500358   -> identicos
item 2: start 1.500359  end 5.768045   inPoint 2.900693  outPoint 7.168380
        salto de 2.333891 -> 2.900693 na origem = jump cut de 0.567s
```

Formula de remapeamento, valida para `speed == 1`:

```
tempoNaSequencia = start + (tempoNaOrigem - inPoint)
   para inPoint <= tempoNaOrigem < outPoint
```

**Confirmacao cruzada decisiva:** a primeira palavra da transcricao de `IMG_1190.MOV`
comeca em `0.84s` e o `inPoint` do primeiro clipe e `0.8335s`. O editor cortou
exatamente na primeira palavra. Isso prova que **os tempos da transcricao e os
`inPoint` compartilham a mesma origem** — segundos desde o inicio da midia. Nao ha
offset escondido a descobrir.

Ticks: `254016000000` ticks por segundo (verificado por divisao em varios itens).
`timebase` e ticks **por frame**: `381115064745 / 8469223661 = 45` frames exatos.
Logo esta sequencia roda a `254016000000 / 8469223661` = **29,9928 fps** — taxa nao
padrao, provavelmente herdada de material de iPhone. Preferir aritmetica em ticks
inteiros e nunca arredondar por fps.

### Regra de ouro da escrita: tudo nasce dentro de `lockedAccess`

Custou tres falhas distintas ate virar regra. No Premiere 26.3, **todo objeto usado
para criar uma Action precisa ser criado dentro do `project.lockedAccess()`**, e o
`executeTransaction` vai dentro do mesmo lock.

```js
const editor = await ppro.SequenceEditor.getEditor(sequence);  // pode ficar fora
const at = await ppro.TickTime.createWithSeconds(0);           // pode ficar fora
const item = (await rootItem.getItems()).find(...);            // pode ficar fora

let erro = null;
project.lockedAccess(() => {          // SINCRONO: nenhum await aqui dentro
  try {
    const acao = editor.createOverwriteItemAction(item, at, 1, 2);
    project.executeTransaction((c) => c.addAction(acao), "texto do undo");
  } catch (e) { erro = `${e.name}: ${e.message}`; }
});
if (erro) throw new Error(erro);
```

Erros e o que cada um significava:

| Mensagem | Causa real |
|---|---|
| `Requires locked access` | Action criada fora do `lockedAccess` |
| `The script object is no longer valid` | objeto montado fora do lock (foi o caso da `TrackItemSelection`) |
| `Invalid parameter` | `ClipProjectItem.cast()` desnecessario — passar o `ProjectItem` cru |

O erro dentro da callback **nao propaga**: `lockedAccess` engole. Capturar numa
variavel e relancar depois, senao a falha passa por sucesso.

### Faixas: `audioTrackIndex` nao tem valor para "sem audio"

`-1` **nao suprime audio** — cai no padrao e joga na A1, por cima do audio
principal. Foi o bug que o usuario reportou. A unica forma correta e indice
explicito; a d.ts garante que indice maior que o numero de faixas cria faixa nova,
entao `2` sempre resulta em A3.

Para realmente ficar sem audio, remover depois:

```js
// dentro do lockedAccess:
let sel = null;
ppro.TrackItemSelection.createEmptySelection((s) => { sel = s; });
sel.addItem(itemDeAudioDaA3, false);
editor.createRemoveItemsAction(sel, false, ppro.Constants.MediaType.AUDIO, false);
```

Necessario para **147 dos 260 B-rolls**, que tem faixa de audio.

### Escala: `AE.ADBE Motion` -> param `Scale`

`trackItem.getComponentChain()` do clipe em V2 devolve 2 componentes:
`AE.ADBE Opacity` (3 params) e `AE.ADBE Motion` (11 params: Position, **Scale**,
Scale Width, Rotation, Anchor Point, Anti-flicker, Crop L/T/R/B).

Localizar o param por `displayName`, nao por indice. Aplicar com
`param.createKeyframe(valor)` + `param.createSetValueAction(kf, true)` dentro do
lock. Provado: 100 -> 150.

`escala = max(larguraSeq/larguraClip, alturaSeq/alturaClip) * 100`

**Pendencia:** `ProjectItem` nao expoe largura/altura. Sem isso a escala nao pode
ser calculada por arquivo. Investigar `ppro.Media` e `FootageInterpretation` na
Fase 4.

### Chamadas que penduram para sempre

Tres APIs travaram sem nunca rejeitar, matando a execucao inteira e sem deixar log:

- `uxp.storage.localFileSystem.getFileForOpening()` — trava neste painel. **Nao e
  necessario**: `importFiles` aceita caminho como string e quem le a midia e o
  Premiere, nao o sandbox UXP.
- `ComponentParam.getStartValue()` e `getKeyframePtr()` — penduram. Nunca varrer
  getters de `ComponentParam` as cegas; `displayName` e propriedade, use ela.

Por isso `probe()` tem timeout de 20s. Sem ele, uma promise pendurada nao produz
nem erro nem log, e o diagnostico vira adivinhacao.

### Caption track: timing sim, texto nao — a Fase 3 e reconstrucao

A sequencia tem 1 caption track com **1029 itens**, ja recortados conforme a edicao
final. Parecia o atalho ideal para a Fase 3. **Nao e.**

```
getName()           -> "SyntheticCaption"   (nome da classe, nao a legenda)
getMatchName()      -> "SyntheticCaption"
getProjectItem()    -> null
getComponentChain() -> objeto valido, getComponentCount() = 0
getStartTime()      -> 0 / 2.5006 / ...     (tempo na sequencia: existe)
getInPoint()        -> 3599.96              (base de timecode 01:00:00:00)
```

Nenhum getter expoe o texto, e o ComponentChain — ultima rota plausivel — esta
vazio. **Confirmado: a secao 9 do CLAUDE.md estava certa. A transcricao final tem
de ser reconstruida item a item.**

O que a caption track ainda vale: ela e um **oraculo de timing**. Os 1029 blocos
dizem onde o Premiere considera que ha fala no corte final. Isso da um teste de
alinhamento gratuito para a Fase 3 — se a reconstrucao produzir fala onde a caption
track diz que ha silencio, ha bug. Usar como fixture de validacao, nao como fonte.

### Formato do JSON de transcricao — define o modelo de dados

```json
{
  "language": "pt-pt",
  "segments": [
    {
      "start": 0.84,
      "duration": 30.100000001791226,
      "language": "pt-pt",
      "speaker": "0d6458bc-f8c6-4d33-bce0-c627652d38dd",
      "words": [
        { "text": "Bomba",    "start": 0.84, "duration": 0.78,
          "confidence": 1, "eos": false, "tags": [], "type": "word" },
        { "text": "relógio.", "start": 1.62, "duration": 0.63,
          "confidence": 1, "eos": true,  "tags": [], "type": "word" }
      ]
    }
  ]
}
```

Consequencias diretas:

- Tempos em **segundos float, relativos a midia de origem** — mesma base do `inPoint`.
- Granularidade de **palavra**, com `confidence` por palavra. O campo `confidence`
  alimenta direto a marcacao de "trecho incerto" exigida pelo CLAUDE.md secao 9.5.
- **`eos` (end of sentence) da as fronteiras de frase de graca.** A segmentacao da
  Fase 6 nao precisa de NLP: basta agrupar palavras ate `eos: true`.
- `speaker` por segmento permite ignorar falas de outra pessoa depois.
- O campo `type` sugere que existem itens que nao sao `word` (pontuacao? ruido?).
  Nao assumir que todo item de `words` e palavra falada.

---

---

## 2b. Pendencias antes de fechar o gate da Fase 0

Resolvidas: conteudo da caption track (P3.1b/P3.1c, negativo) e frame rate (P1.4).

Abertas:

1. **Escrita e undo (P5).** Nada testado. E o unico item que falta para fechar o
   gate da Fase 0.
2. **Cenarios dificeis.** Esta sequencia so tem `speed: 1`, sem reverse, nested ou
   multicam. O remapeamento so esta provado para o caso simples. Os demais entram
   na Fase 3 com fixtures proprias.
3. **`type` no JSON de transcricao.** Todas as amostras vistas sao `"word"`. Nao
   assumir que e o unico valor possivel.

## 3. Como reproduzir

1. Uma vez, como administrador: `powershell -ExecutionPolicy Bypass -File scripts\install-link.ps1`
   (ver DECISIONS.md D-007 para os pre-requisitos).
2. Abrir o Premiere Pro **26.3.2** com um projeto e uma sequencia editada ativa.
3. No Premiere: `Janela > UXP Plugins > Auto B-roll (Provas)`.
4. Clicar em **Rodar provas de leitura**.
5. O log e gravado em
   `%APPDATA%\Adobe\UXP\PluginsStorage\PPRO\26\External\com.leogi.autobroll\PluginData\proofs-log.txt`
   — o painel UXP nao permite selecionar nem copiar texto, entao o arquivo e a
   unica forma pratica de extrair o resultado.
6. Para a prova de escrita: abrir um **projeto de teste descartavel** com pelo menos
   V2, clicar em **Rodar prova de escrita (V2)**, escolher um video, depois dar
   **um unico Ctrl+Z** e anotar o que foi desfeito.

Alterou codigo? **Reinicie o Premiere.** Nao ha hot reload (BUILD_STATUS).
