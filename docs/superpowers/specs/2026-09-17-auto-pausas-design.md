# Auto Pausas — design

Data: 2026-09-17
Status: aprovado em chat (3 partes), aguardando revisão do spec escrito

## Objetivo

Uma 5ª ferramenta no Pro Edition, **Auto Pausas**, para o primeiro passo da
edição de anúncio: tirar as pausas e os respiros da gravação bruta, deixando a
fala **bem colada (estilo reels)**, sem cortar nenhum pedaço de palavra.

O problema que ela resolve não é "cortar pausa" — o Premiere já tem "Excluir
pausas" na Edição baseada em texto. É **consistência**: o usuário testou o
recurso nativo e ele tira algumas pausas e deixa outras, e o ritmo muda de um
vídeo para outro. Auto Pausas aplica a mesma regra, com os mesmos números, em
todo corte de todo vídeo.

## Não-objetivos

- **Não** corta hesitações ("ééé", "ããã", "hum"). Decisão do usuário: primeiro
  ver o corte de pausas funcionando bem; hesitação é um segundo passo.
- **Não** trabalha com podcast. Só anúncio (Pro Ads).
- **Não** mexe em sequência já editada. Só roda com a gravação bruta: um clipe
  na V1 com o áudio dele na A1, e nenhum outro clipe na sequência (faixas vazias
  podem existir). Qualquer outra coisa é recusada com mensagem dizendo o que
  fazer.
- **Não** duplica a sequência nem marca antes de cortar. Decisão do usuário
  (entre cópia, marcar-e-cortar e direto): **corta direto na sequência**, e a
  rede de segurança é o Ctrl+Z mais a conferência automática descrita abaixo.
- **Não** lê o áudio. Ler amostra de áudio no UXP não é viável (ver
  `DEV_NOTES.md`, caminhos investigados no Podcast AutoCut) e o usuário não
  aceita exportar WAV a cada vídeo. A única fonte é a transcrição do Premiere.
- **Não** suporta Premiere 25. Só 26+, como o Auto Split.

## De onde vem a pausa

A transcrição do Premiere (a mesma que o Auto B-roll já lê com
`lerTranscricoes` + `reconstruirTranscricao`) entrega cada palavra com início e
duração, em resolução de 0,01 s. Um recorte real (`IMG_1190.MOV`, fixture de
`ferramentas/auto-broll/tests/transcript.test.ts`) mostra o formato:

- dentro de uma frase as palavras encostam (`"É"` termina em 3,06, onde
  `"exatamente"` começa) — não há pausa para cortar;
- entre frases aparece o espaço (`"relógio."` termina em 2,25, `"É"` começa em
  2,97 — 0,72 s de pausa);
- antes da primeira palavra há silêncio (`"Bomba"` começa em 0,84).

**Pausa** = o espaço entre o fim de uma palavra e o início da seguinte, mais o
silêncio antes da primeira palavra e depois da última.

## A regra de corte (lógica pura, `src/pausas.ts`)

Entrada: as palavras em tempo de sequência, o fps da sequência, a duração do
clipe e a margem. Saída: os **trechos que ficam**, em quadros, e para cada
corte as palavras dos dois lados (para o registro).

1. Para cada pausa entre a palavra `p` e a seguinte `q`, a parte removível é
   `[fim(p) + margem, início(q) − margem]`.
2. Antes da primeira palavra: `[0, início(primeira) − margem]`. Depois da
   última: `[fim(última) + margem, fim do clipe]`.
3. Encostar em quadro **sempre para dentro da pausa**: o começo do corte
   arredonda para cima, o fim arredonda para baixo. Nunca entra numa palavra.
4. Se a parte removível tiver menos de **2 quadros**, a pausa fica inteira (um
   corte desse tamanho só dá tranco na imagem).
5. Palavras sobrepostas ou encostadas não geram corte.
6. A mesma margem vale para todos os cortes. **Padrão inicial: 0,08 s de cada
   lado** (≈ 0,16 s entre frases). O número é calibrado num anúncio real do
   usuário antes de ser fixado; o painel mostra o campo com o padrão já
   preenchido.
7. Os trechos que ficam recebem a posição final na timeline: cada um começa
   onde o anterior termina, a partir do quadro 0.

**Limite conhecido:** quando a transcrição estica a duração de uma palavra por
cima do silêncio que vem depois, essa pausa não aparece e fica. O erro é sempre
para o lado seguro (nunca corta fala), só menos colado naquele ponto.

## Como aplica no Premiere (`src/pausas-premiere.ts`)

**Remontagem, não fatia-e-fecha.** Com os trechos e posições já calculados na
lógica pura, o adapter remonta a gravação: o clipe original vira o primeiro
trecho (ponto de entrada e fim ajustados) e cada trecho seguinte é um clone do
clipe, com ponto de entrada e fim ajustados e movido para a posição calculada.
Vídeo (V1) e áudio (A1) juntos.

Usa as primitivas que o Podcast AutoCut já provou ao vivo
(`createCloneTrackItemAction`, que já recebe o deslocamento de tempo,
`createSetInPointAction`, `createSetEndAction`). `createMoveAction` só entra se
o clone não cair na posição certa — ela ainda não foi provada ao vivo. A ordem
em que clones em modo overwrite se sobrescrevem na mesma faixa também não foi
provada: é a primeira coisa que o teste ao vivo confere. Toda ação nasce dentro de `project.lockedAccess` e toda
chamada ao Premiere passa por `comLimite`, reaproveitando `comTransacao` do
adapter do Auto B-roll.

**Plano B**, se a remontagem não se comportar ao vivo: fatiar nas bordas de
cada pausa (mesma técnica do AutoCut) e remover o pedaço do meio com
`createRemoveItemsAction(seleção, ripple = true, …)`, do último corte para o
primeiro para os tempos anteriores não andarem.

**Desfazer:** o mínimo de transações possível. O número exato de Ctrl+Z é
medido no Premiere real e escrito no registro.

## Conferência depois de aplicar

A prova de que nada de fala saiu **lê o resultado**, não a ausência de erro
(lição do Auto Split, onde a sonda marcava "ok" sem conferir e deixou passar o
bug do `32767` duas vezes):

1. Reler os clipes da V1 e da A1 da timeline.
2. Remontar a transcrição a partir deles com `reconstruirTranscricao`.
3. Comparar com a transcrição de antes: mesma quantidade de palavras, na mesma
   ordem, cada uma com a mesma duração (tolerância de 1 quadro).
4. Registrar "N de N palavras inteiras", ou listar exatamente quais quebraram.

Também confere que V1 e A1 terminaram com a mesma quantidade de trechos nas
mesmas posições (áudio não pode dessincronizar).

## Tela (`src/ui/pausas.html` + `pausas-mount.ts`)

Mesma folha da família (`css: cssBroll`, como AutoCut e Auto Split), acento de
cor próprio.

- **Cabeçalho:** "Auto Pausas" + badge de status.
- **SEQ — Sequência ativa:** nome, e a confirmação do que achou: gravação na
  V1/A1 e transcrição presente.
- **Margem de segurança:** um campo com o padrão calibrado.
- **Botão:** "Cortar pausas" (`sp-button` cta).
- **LOG — Registro**, que desce até a última linha:
  - resumo: "38 pausas cortadas · 0:41 → 0:29";
  - cada corte com as palavras de cada lado: `0:12 · 0,8 s · "saúde" | "então"`;
  - cortes **maiores que 1 s em destaque** para conferir (é onde uma palavra não
    transcrita poderia estar escondida);
  - a conferência: "412 de 412 palavras inteiras";
  - quantos Ctrl+Z desfazem.

**Recusa com instrução** (nada é alterado):
- sem sequência ativa;
- sem transcrição no clipe → dizer como criar (painel Texto → Transcrever);
- timeline diferente de um clipe na V1 + áudio na A1 → dizer que a ferramenta
  roda só na gravação bruta, antes de B-roll, música e legenda.

## Hall

Card novo **no topo do grupo Pro Ads** (é o primeiro passo da edição), antes do
Auto B-roll, com a miniatura de timeline mostrando V1 e A1 com os buracos
fechados. `Ferramenta` ganha `"pausas"` em `src/shell.ts`, registro em
`src/ui/main.ts`, teste das notações do hall passa a esperar 5 miniaturas.

## Testes

Automáticos (`tests/pausas.test.ts`, `node --test`):
- a margem nunca entra na palavra;
- o arredondamento para quadro vai para dentro da pausa;
- pausa com menos de 2 quadros removíveis fica;
- silêncio antes da primeira e depois da última palavra sai;
- palavras encostadas ou sobrepostas não geram corte;
- posições finais: cada trecho começa onde o anterior termina e a soma bate com
  a duração nova;
- a comparação de antes/depois detecta palavra faltando e palavra encurtada.

Ao vivo (usuário, Premiere 26, um anúncio real):
1. confirmar que a remontagem deixa V1/A1 no lugar certo (senão, plano B);
2. calibrar a margem de 0,08 s ouvindo os cortes;
3. anotar quantos Ctrl+Z desfazem.
