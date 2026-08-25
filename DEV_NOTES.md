# Podcast AutoCut — notas de desenvolvimento

## SPLIT STRATEGY CONFIRMED = SIM (clone + overwrite, com duas correcoes)

### O que a documentacao publica diz (conferido em 2026-08-25)

`VideoClipTrackItem` e `AudioClipTrackItem` **nao tem** `split()`, `razor()` nem
clone. `SequenceEditor` tambem nao. Tudo o que existe, desde a 25.6:

| Onde | Metodo |
|---|---|
| SequenceEditor | `createCloneTrackItemAction(trackItem, timeOffset, vOffset, aOffset, alignToVideo, isInsert)` |
| SequenceEditor | `createInsertProjectItemAction`, `createOverwriteItemAction`, `createRemoveItemsAction` |
| ClipTrackItem | `createSetStartAction`, `createSetEndAction`, `createSetInPointAction`, `createSetOutPointAction`, `createSetDisabledAction`, `createMoveAction` |

Fonte: developer.adobe.com/premiere-pro/uxp/ppro-reference/classes/{videocliptrackitem,sequenceeditor}

### Estrategia escolhida (Opcao A do spec)

Clonar o clipe com deslocamento, usando **overwrite** (`isInsert = false`). A
propria edicao de overwrite apara o original no ponto do corte — e isso que faz
o papel do `Add Edit`.

O clone provavelmente herda o in-point do pai, o que quebraria o sync. Em vez
de assumir, `aplicar()` **mede** o in-point de cada pedaco depois do corte e so
corrige o que estiver fora do lugar:

```
fonte esperada = fonteDoClipeOriginal + (inicioDoPedaco - inicioDoClipeOriginal)
```

Se um dia o Premiere ja devolver o clone com a fonte certa, o codigo continua
correto sem mudar uma linha.

### Taxa de quadros (2026-08-25)

Primeiro teste no Premiere real: painel montou, leu as tracks, e parou em
"Sequencia sem taxa de quadros legivel" — `getSequenceInfo().fps` = 0.

A doc oficial explica: `SequenceSettings.getVideoFrameRate()` devolve um
`FrameRate` **direto, nao Promise**, e o fps mora em `.value`. O helper
`taxaDeQuadros()` do Auto B-roll testa `typeof fn === "function"` e desiste
antes disso — o comentario dele ("so aparece a partir da 26.x") provavelmente
esta errado.

`lerFps()` em `src/autocut-premiere.ts` tenta, nesta ordem: numero direto,
`FrameRate.value`, `FrameRate.ticksPerFrame` (fps = 254016000000 / tpf). Se
nada funcionar, devolve as chaves REAIS do objeto na propria UI — nao no
console. E o select de quadros/s deixa apontar a taxa na mao, para o gate do
split nao ficar parado por causa disso.

Depois de descobrir qual caminho vale, corrigir `taxaDeQuadros()` no
auto-broll-premiere tambem: o fps de la esta zerado desde sempre.

### Primeiro apply real (2026-08-25, Sequence 07)

```
3 cortes aplicados.
12 pedacos tiveram a fonte corrigida.
4 pedacos fora do plano ficaram como estavam.
boundaries identicos nas 4 tracks: [0,601,1199,1800]
```

**O que funcionou:** `createCloneTrackItemAction` corta de verdade, nas quatro
tracks, com boundaries identicos. `createSetDisabledAction` alternou os pares.
As 12 correcoes de fonte respondem a pergunta em aberto: **o clone HERDA o
in-point do pai**, entao `createSetInPointAction` e obrigatorio.

**Dois defeitos, os dois de conta de tempo em ponto flutuante:**

1. *A sequencia cresceu.* O clone e uma copia de DURACAO INTEIRA — clonar
   `[0, 103.3s]` com 10s de deslocamento produz `[10s, 113.3s]`, que passa do
   fim do original. Tres cortes = 30s a mais e cauda empurrada.
   Correcao: aparar o ULTIMO pedaco de cada track de volta ao fim que o clipe
   tinha antes, com `createSetEndAction`.

2. *Os cortes cairam um quadro fora* — `[0,601,1199,1800]` em vez de
   `[0,600,1200,1800]`. Posicionar o corte em segundos nao cai em quadro, e a
   sequencia era 59.94 com 60 escolhido na mao.
   Correcao: toda posicao passou a ser calculada em TICKS INTEIROS, via
   `TickTime.createWithTicks` e o `ticksPerFrame` da propria sequencia.
   `Math.round(254016000000 / fps)` so entra como rede quando o Premiere nao
   informa a taxa — e erra nas NTSC, entao a UI avisa quando cai nela.

Tambem: `getTrackItems()` nao promete ordem, e saber qual e o ultimo pedaco
depende dela. Passou a ser ordenado por tempo de inicio.

### Taxa de quadros: resolvida por `Sequence.getTimebase()` (2026-08-25)

`SequenceSettings.getVideoFrameRate()` **nao existe** nesta versao do Premiere.
Confirmado listando as chaves reais dos dois objetos no proprio painel:

```
settings expoe: getMaximumBitDepth, ..., getVideoFrameRect, setVideoFrameRect,
                getVideoPixelAspectRatio, ..., getPreviewFrameRect
sequence expoe: ..., getVideoTrackCount, getAudioTrackCount, getVideoTrack,
                getAudioTrack, getSettings, ..., getFrameSize, getTimebase, ...
```

Nao ha frame rate em `settings`. Quem tem e a **sequencia**: `getTimebase()`,
que devolve **ticks por quadro** — o numero exato que o corte precisa, sem
passar por fps em ponto flutuante. Vem como string em algumas versoes, dai o
`Number()`.

fps, quando alguem quiser mostrar, sai de `254016000000 / timebase`.

A lista de nomes alternativos e o `FrameRate.createWithValue` continuam como
rede, e a divisao crua so entra em ultimo caso — com aviso na UI, porque erra
nas taxas NTSC.

Pendente: corrigir `taxaDeQuadros()` no auto-broll-premiere pelo mesmo caminho.

### A REPROVAR depois das correcoes (Fase 1)

Sequencia de teste: 4 clipes continuos de 30 s em V1/V2/A1/A2, ja sincronizados.
Abrir Pro Edition > Podcast AutoCut > ANALISAR > APLICAR AUTOCUT.

Esperado:

```
V2  OFF | ON  | OFF
V1  ON  | OFF | ON
A2  OFF | ON  | OFF
A1  ON  | OFF | ON
```

Checklist:

- [ ] le a sequencia ativa e lista as tracks
- [ ] qual caminho de `lerFps()` funciona (a UI mostra a origem)
- [ ] `createCloneTrackItemAction` existe em tempo de execucao
- [ ] o corte aparece nas 4 tracks nos mesmos quadros (o log confirma: `boundaries identicos`)
- [ ] o clone herda o in-point do pai? (o log diz quantos pedacos foram corrigidos)
- [ ] sync preservado — conferir a olho no meio de cada pedaco
- [ ] `createSetDisabledAction` liga/desliga video E audio
- [ ] Undo: quantos Ctrl+Z para voltar ao estado inicial

### Preencher depois do teste

```
Premiere version:
UXP version:
OS: Windows 11
Resultado:
Undo:
Performance:
Bug:
Workaround:
```

## Deteccao de fala: transcricao, nao VAD (2026-08-25)

O spec previa VAD sobre PCM, com `AudioAnalysisProvider` e a duvida de se o UXP
entrega audio bruto — o segundo maior risco do projeto.

Nao precisou. O Premiere ja transcreve cada clipe, e o Auto B-roll ja tinha o
caminho inteiro testado:

- `premiere.ts > lerTranscricoes()` — `Transcript.exportToJSON` por ClipProjectItem
- `transcript.ts > parseTranscricao()` — JSON do Premiere com tempo por palavra
- `domain.ts > sourceToSequence()` — tempo da midia para tempo de sequencia

Palavra no transcript do microfone da Pessoa A **e** a Pessoa A falando. Com dois
microfones em tracks separadas, isso da atividade de voz por pessoa de graca, com
precisao de palavra e sem tocar em PCM.

Custo: exige que os dois clipes de audio tenham sido transcritos (painel Texto >
Transcrever). E o fluxo normal de quem edita podcast, e o Auto B-roll ja depende
disso.

O motor de decisao (`autocut.ts`) continua puro e testado sem Premiere: junta
palavras em blocos por pausa curta, descarta fala curta demais, estica com
pre/post-roll, e so troca de camera quando exatamente uma pessoa fala —
silencio e crosstalk mantem quem estava. Plano curto demais e absorvido pelo
anterior em vez de virar corte.

`AudioAnalysisProvider`, `FixtureProvider` e o plano artificial: nao existem, e
nao devem ser criados. Ver os testes em `tests/autocut.test.ts`.

## Segundo caminho: nivel de audio de um WAV (2026-08-25)

A transcricao nao serve para quem grava os dois microfones num arquivo so: o
`exportToJSON` da UMA lista de palavras por midia, e separar quem fala passa a
depender da diarizacao do Premiere — que no teste real veio com um interlocutor
so.

Entao existe um segundo caminho, e ele dispensa transcricao:

- `wav.ts` — le WAV PCM (16/24/32 int e 32 float, inclusive WAVE_FORMAT_EXTENSIBLE)
  e devolve dB por janela de 20 ms, por canal. Uma passada, um acumulador por
  canal, sem materializar amostras.
- `autocut.ts > falaPorNivel()` — voz = acima do ruido de fundo do proprio canal
  (percentil 20 + 12 dB) E dominando o outro canal por 6 dB. A dominancia e o que
  resolve vazamento: quem fala aparece nos dois microfones, mas nao igual.
- Empate com os dois altos nao vira fala de ninguem, e `decidir` mantem quem
  estava — mesmo tratamento do crosstalk.

Exige WAV porque `.mkv`/`.mp4` tem audio comprimido. Exportar do Premiere em
16 kHz basta: nivel de voz nao precisa de banda, e o UXP nao tem leitura parcial
de arquivo — o WAV inteiro entra na memoria de uma vez.

Campo vazio na UI = analise por transcricao. Campo preenchido = analise por
nivel. Os dois desembocam no mesmo `decidir()`.

## ONDE PARAMOS (2026-08-25, fim do dia)

Mecanica de corte: **provada e funcionando**. Deteccao de quem fala: **em aberto**.

O material de teste e `Podcast Grandcare - EP01`, Sequence 07:

- V1 = `2026-08-19 18-03-18.mkv` (OBS), V2 = `MVI_6358.MP4` (Canon)
- A1 e A2 = o MESMO mkv, faixas de audio diferentes
- o mkv tem 2 faixas AAC estereo + 1 faixa AVC, 2.6 GB
- sequencia a 59.94 fps

Caminhos investigados para o audio, e por que cada um caiu:

| Caminho | Situacao |
|---|---|
| Ler o mkv direto | AAC em 2.6 GB — decodificar em JS e inviavel, e nao cabe na memoria do UXP |
| Cache do Premiere (`.cfa`/`.pek`) | Nao existe para este arquivo; so `.ims` de 3.7 KB, que e indice |
| `EncoderManager.encodeFile` | Existe, mas o unico preset de WAV que vem com o Premiere e estereo e misturaria as duas faixas |
| WAV exportado na mao | Funciona (implementado), mas o usuario nao quer render a cada episodio |
| Transcricao por clipe | Implementado. Bloqueado pela diarizacao |

O dialogo `Create transcription for source media` tem tres campos: Language,
**Speaker labeling** (ja estava em "Yes, separate speakers") e **Channel
selection**, com as opcoes **Mixdown / Channel 1 / Channel 2**.

A causa do "um interlocutor so" era Channel selection = **Channel 1**: um canal
tem uma pessoa, entao nao havia quem separar. Channel 1 e Channel 2 sao os
microfones isolados; Mixdown mistura os dois.

Ultimo teste do dia: transcrever com **Mixdown** + speaker labeling. **Ainda nao
deu certo** — falta diagnosticar o que veio.

### Proximo passo quando voltar

1. Rodar ANALISAR com o campo de WAV vazio e ler o log: quantos rotulos vieram,
   quantas palavras por pessoa, e se a previa de alternancia bate com o episodio.
2. Se a diarizacao do Mixdown embaralhar (o erro tipico e nos trechos de fala
   sobreposta), ir para o **plano B**, que e o mais promissor e ainda nao foi
   construido:

   **Plano B — uma transcricao por canal.** Transcrever o clipe com Channel 1,
   o plugin guarda as palavras da Pessoa A; transcrever de novo com Channel 2,
   guarda as da Pessoa B. Separacao perfeita, sem a IA adivinhar quem fala, e
   sem renderizar nada. Custa: o Premiere guarda UMA transcricao por
   ClipProjectItem, entao a segunda sobrescreve a primeira — o plugin precisa
   capturar e cachear cada uma (usar `readJson`/`writeJson` do adapter do
   Auto B-roll), com um botao por pessoa na UI.

## Limitacoes conhecidas do MVP

- Exige **1 clipe continuo por track**. Timeline ja editada e recusada na validacao.
- `createSetDisabledAction` so existe na 25.6+. O manifest continua em `25.0.0`
  para nao quebrar a instalacao do B-roll e do Captions; a checagem e feita em
  tempo de execucao, na validacao, com mensagem explicita.
- Uma transacao (um Undo) por corte. Ver o comentario `ponytail:` em
  `src/autocut-premiere.ts` — juntar tudo numa transacao so depende de saber em
  que ordem os clones se sobrescrevem, e isso so o Premiere real responde.
- Config de anti-flicker (`CONFIG_PADRAO`) ainda nao aparece na UI. Os numeros
  vieram do spec e nao foram calibrados com podcast real — e o proximo passo.
