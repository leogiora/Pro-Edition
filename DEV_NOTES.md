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

## Auto Pausas (2026-09-17/18)

Corte de pausas na gravacao bruta de anuncio. Spec:
`docs/superpowers/specs/2026-09-17-auto-pausas-design.md`. Plano:
`docs/superpowers/plans/2026-09-17-auto-pausas.md`. Branch `auto-pausas`.

### API do Premiere 26 — o que a sonda provou ao vivo (fps 23,976)

| Chamada | O que a timeline mostrou DEPOIS |
|---|---|
| `createCloneTrackItemAction(item, offset, 0, 0, true, false)` | **Corta** o clipe no offset pedido. O clone tem o tamanho do original, entao o ultimo pedaco passa do fim da midia (101,64 num arquivo de 100,64) e pede `createSetEndAction` |
| idem | Atinge **so a faixa do item**: clonando so a V1, a A1 continuou inteira. Cada faixa precisa da propria acao |
| `createRemoveItemsAction(selecao, true, ANY)` | **Fecha o buraco**: removido o pedaco do meio de tres, o terceiro andou de 4,00 para 2,00 nas DUAS faixas e o fim caiu exatamente 2 s. Sincronia mantida |
| `sequence.getSelection()` + `removeItem`/`addItem` | Funciona para montar a selecao do remove |
| `createSetInPointAction` | Grava o valor exato (pedi 2,00, timeline devolveu 2,00). Na rodada 1 **aparou a cabeca**: o pedaco andou de 1,00 para 3,00 — mas era o ultimo e passava do fim da midia |

**Todo pedaco nasce com `in=0.00`, herdado do pai.** Um clipe mostra
`in + (t - inicio)` da midia: sem corrigir o in, cada pedaco repete o inicio do
video. Corrigir e obrigatorio, e COMO corrigir e a pergunta aberta.

### Rodada 4 (2026-09-21) — rodou no Premiere **25.6.6**, bruta de 14 min

O usuario rodou no 25 (e o que ele usa hoje: no 26 o "Excluir pausas" nativo
parou de funcionar). Resultado lido de `pausas-diag.json` na PluginData do 25.

| O que | Resultado |
|---|---|
| `EncoderManager.exportSequence` IMEDIATO + `WAV_Mono_16bit_16kHz.epr` (pasta `Adobe Premiere Pro 2025\Settings\EncoderPresets`) | **Funciona.** 865 s de audio em 5,8 s, 27,7 MB, mono 16 kHz, arquivo completo quando a promessa volta |
| Niveis da bruta (dB, janela 20 ms) | p10 -60,3 · p20 -56,4 · p50 -33,6 · p90 -16,5 · p99 -10,8. Sala e fala bem separadas |
| `Transcript.exportToJSON` via `lerTranscricoes` (busca por NOME) | **Illegal Parameter type.** Hipotese: a sequencia criada do clipe tem o MESMO nome (`IMG_1902.MOV`) e a busca por nome pegou a sequencia. Rodada 5 le pelo `getProjectItem()` do item da V1 |
| Clone em 2 s e 4 s | Igual ao 26: cada pedaco e uma COPIA INTEIRA do clipe com `in=0`, sobrescrevendo o que vem depois; o ultimo passa do fim da midia |
| `createSetInPointAction(2s)` no pedaco do meio `[2-4] in 0 out 2` | **Apara a cabeca mantendo o out**: virou `[4,00-4,00] in 2 out 2` (duracao zero). Nao e slip |
| `createMoveAction(2s)` | **Relativo**: o pedaco foi de 4,00 para 6,00 |
| Overwrite com in/out marcado no item do projeto | **Invalid parameter** — nao se sabe qual das chamadas. Duas suspeitas: passei o `ClipProjectItem` (cast) onde o Auto B-roll passa o `ProjectItem` cru; e o in/out do item do projeto pode estar em tempo ABSOLUTO da midia (timecode do iPhone), entao 5-6 s cairia antes do inicio |

**Ruling:** mecanica por clone esta descartada — sem slip, cada pedaco precisaria
de 3 transacoes proprias, e uma bruta de 14 min tem ~379 pausas (mais de mil
Ctrl+Z). O caminho e o plano C (in/out no item do projeto + overwrite), que a
rodada 5 testa chamada por chamada, com o in/out relativo ao que o item ja tem.

### Rodada 5 (2026-09-21) — Premiere 25.6.6, mesma bruta

| O que | Resultado |
|---|---|
| `ClipProjectItem.createSetInOutPointsAction(in, out)` | **Funciona.** Pedi 10,00-11,00, o item releu 10,00-11,00. Conta em segundos da midia a partir de 0 (arquivo do iPhone), nao em timecode |
| `createOverwriteItemAction(ProjectItem CRU, t, 0, 0)` | **Respeita o in/out marcado**: pedaco de 1,00 s nas DUAS faixas mostrando a midia desde 9,97 (10,00 encostado no quadro de baixo, 23,976 fps). O "NAO respeitou" do log foi erro da sonda: ela esperava o in relativo ao marcado ANTES, que era o 5-6 esquecido pela rodada 4 |
| overwrite com o `ClipProjectItem` (cast) | **Invalid parameter** (e o erro da rodada 4). Overwrite quer o ProjectItem cru, como o Auto B-roll |
| Dois pares marcar+overwrite na MESMA transacao | **Nao funciona**: os dois overwrites usaram o in/out que valia ANTES da transacao (10-11). A acao guarda o in/out de quando e criada |
| `Transcript.exportToJSON` pelo item da V1 | **Illegal Parameter type** de novo. No 25 esse erro = clipe SEM transcricao: os logs do Auto B-roll no 25 (18/08 e 17/09) mostram o mesmo erro nos B-rolls, que nunca sao transcritos, e sucesso no clipe transcrito. A hipotese do nome repetido estava errada |
| Efeito colateral | A rodada 4 deixou o `IMG_1902.MOV` com in/out 5-6 s no painel Projeto (a sonda caiu antes de devolver). Usuario precisa limpar as marcas (`createClearInOutPointsAction` existe para o plugin fazer isso) |

**Ruling da mecanica:** plano C, mas **um trecho por transacao**, encadeado:
a transacao k faz o overwrite do trecho k-1 (in/out ja marcado) e marca o in/out
do trecho k. Sao N+1 transacoes para N cortes — ~380 numa bruta de 14 min. Por
isso o resultado nao pode depender do Ctrl+Z: ou vai para uma sequencia nova
(bruta intacta), ou o painel ganha um "Desfazer" proprio (tirar tudo e recolocar
o clipe inteiro: 2 transacoes). No fim, sempre devolver o in/out original do item
(`createClearInOutPointsAction` quando nao havia marca).

### Rodada 6 (2026-09-21) — Premiere 25.6.6, bruta nova de 12,7 s (IMG_3341.MOV), transcrita

| O que | Resultado |
|---|---|
| `createClearInOutPointsAction()` | Funciona. Sem marca, `getInPoint/getOutPoint` do item devolvem **-400000 s** (sentinela de "sem marca") |
| `getSequenceInfo().fps` | **0 no 25** (o `taxaDeQuadros` do Auto B-roll nao acha nada). O Auto Pausas passou a usar `lerFps()` do Podcast AutoCut (`sequence.getTimebase()`) |
| Transcricao do 25 | 42 palavras, 2 espacos > 0,2 s. O INICIO da palavra bate com o som: erro p10 -0,01 · p50 0,00 · p90 +0,03 s |
| Niveis | piso p20 -49,8 (sala mais ruidosa), voz p90 -20,5. Os dois limiares coincidem (-39,8): nessa bruta nao ha faixa "fraca" |
| Calibracao (`scripts/calibrar-pausas.ts`) | 3 cortes (cabeca 0,33 s, pausa de 0,3 s entre frases vira 0,16 s, cauda ~1 s), 12,7 -> 11,3 s, nenhuma palavra tocada. Bruta curta demais para medir respiro |

### Onde parou

Tasks 8 e 9 prontas (Analisar, Cortar pausas, Desfazer), nunca rodadas no
Premiere. Falta: o usuario ouvir `previa-pausas.wav` e testar Analisar ->
Cortar -> Desfazer numa bruta real; depois a Task 10 (margem, tirar o
Diagnostico, guia de uso). Calibracao de respiro pede uma bruta longa
transcrita (a IMG_1902.MOV de 14 min ainda tem in/out 5-6 s da rodada 4).
