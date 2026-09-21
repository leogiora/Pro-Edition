# Auto Pausas — design

Data: 2026-09-17 · revisado em 2026-09-21 (áudio como fonte principal)
Status: revisão de 2026-09-21 aprovada em chat

## Objetivo

Uma 5ª ferramenta no Pro Edition, **Auto Pausas**, para o primeiro passo da
edição de anúncio: tirar as pausas e os respiros da gravação bruta, deixando a
fala **bem colada (estilo reels)**, sem cortar nenhum pedaço de palavra.

A régua é o **AutoCut Silences**: o usuário quer o corte de respiros
"realmente igual o AutoCut" (pedido de 2026-09-21). O problema que ela resolve
não é "cortar pausa" — o Premiere já tem "Excluir pausas" na Edição baseada em
texto. É **consistência**: o recurso nativo tira algumas pausas e deixa outras,
e o ritmo muda de um vídeo para outro. Auto Pausas aplica a mesma regra, com os
mesmos números, em todo corte de todo vídeo.

## Por que a revisão de 2026-09-21

A primeira versão deste spec tirava a pausa **só da transcrição** (o espaço
entre uma palavra e a seguinte). É o mesmo método do "Excluir pausas" nativo, e
herda o defeito dele. O usuário relatou que, **nas atualizações recentes do
Premiere 26**, o "Excluir pausas" parou de funcionar — "parece que na hora da
transcrição o Premiere não entende as pausas" — enquanto no 25 funciona.

Evidência local: a transcrição do `IMG_1190.MOV` feita no 26 em 2026-08-10
ainda tinha as pausas (162 espaços acima de 0,2 s em 974 palavras). Então a
quebra veio numa atualização posterior, e a transcrição da versão atual é
confirmada no Diagnóstico (abaixo).

Consequência: o **áudio passa a ser a fonte de onde está a pausa**, como no
AutoCut. A transcrição continua, mas só no papel em que ela é confiável mesmo
no 26: **onde cada palavra começa**.

## Não-objetivos

- **Não** corta hesitações transcritas ("ééé", "ããã", "hum"). Decisão do
  usuário: primeiro o corte de pausas funcionando bem.
- **Não** trabalha com podcast. Só anúncio (Pro Ads).
- **Não** separa os vídeos de uma bruta nem escolhe o melhor take. São
  próximos passos, depois deste (decisão de 2026-09-21).
- Roda na bruta **inteira** (um clipe) **ou já separada pelo editor** (vários
  clipes na V1, colados ou não, do mesmo arquivo ou de arquivos diferentes).
  Decisão de 2026-09-21: o fluxo real é bruta inteira → o editor pica para
  separar os vídeos → Auto Pausas. As emendas do editor continuam emendas no
  resultado. Recusa com instrução: clipe com velocidade alterada, e A1 que não
  acompanha a V1 clipe a clipe (áudio de gravador separado).
- **Não** duplica a sequência nem marca antes de cortar. Decisão do usuário:
  **corta direto na sequência**, e a rede de segurança é o Ctrl+Z mais a
  conferência automática.
- **Não** pede export manual. O áudio é extraído pelo próprio plugin dentro do
  clique (o usuário recusa qualquer passo manual recorrente).
- Roda no **Premiere 25.6+ e 26**. O usuário edita no 25 hoje (no 26 o "Excluir pausas" nativo quebrou), e a rodada 4 do Diagnóstico provou o export de áudio no 25.6.6.

## De onde vem a pausa: áudio + transcrição

### Extrair o áudio (adapter)

1. O plugin exporta a sequência ativa como WAV com
   `EncoderManager.getManager().exportSequence(sequência, IMMEDIATELY,
   caminho, preset, exportFull = true)`.
2. Preset: `WAV_Mono_16bit_16kHz.epr`, que **vem instalado com o Premiere 26**
   em `Settings/EncoderPresets/` da pasta do programa. Mono e 16 kHz bastam
   para nível de voz e deixam o arquivo leve (~1,9 MB por minuto): o UXP não
   tem leitura parcial, o WAV inteiro entra na memória.
3. O WAV vai para a pasta de dados do plugin, é lido com `nivelPorJanela`
   (`src/wav.ts`, já testado no Podcast AutoCut: dB por janela de 20 ms) e é
   apagado em seguida.

O Diagnóstico prova, antes de qualquer código definitivo: se o export imediato
funciona dentro do painel, quanto tempo leva, onde o preset está e se o
arquivo sai mono a 16 kHz.

### Os níveis de cada gravação

Nada de dB fixo: cada gravação se mede.

- **Piso**: percentil 20 dos níveis (`ruidoDeFundo`, já existe) — o ruído da
  sala.
- **Voz**: percentil 90 dos níveis — o volume típico da fala.
- **Som**: janela acima de `piso + A` dB. **Voz forte**: janela acima de
  `voz − B` dB. Pontos de partida `A = 10`, `B = 20`; os números finais saem
  da calibração.

### A regra (lógica pura, `src/pausas.ts`)

Entrada: níveis por janela, o início de cada palavra da transcrição (em tempo
de sequência) e as opções. Saída: **blocos de fala** — cada um com início, fim
e as palavras que começam nele.

1. **Um bloco nasce de cada início de palavra.** Buracos de som menores que
   150 ms não quebram o bloco (é o fechamento de "p", "t", "k" dentro da
   palavra, não pausa). Blocos que se tocam ou se sobrepõem viram um só.
2. **Bordas assimétricas.** O começo do bloco vai até onde a **voz forte**
   começa — o respiro de antes da frase é mais fraco que a voz e fica de fora.
   O fim do bloco vai até onde o **som** acaba — o final fraco da palavra ("s",
   "f") fica dentro.
3. **Som sem nenhuma palavra começando nele:**
   - forte (pico em voz forte) e com 250 ms ou mais → **fica** e aparece no
     registro como "voz sem palavra na transcrição" (pode ser fala que a
     transcrição pulou — nunca cortar fala por dúvida);
   - o resto (respiro, estalo, ruído) → **sai**, tratado como pausa.
4. **Palavra que começa no silêncio** (fala baixinha demais para o limiar):
   ganha um bloco mínimo em volta do início dela e aparece no registro. É a
   proteção que o AutoCut não tem — lá, voz baixa abaixo do limiar é cortada.
5. Tolerância entre o início que a transcrição diz e o som real: um início de
   palavra conta para um som se cair dentro dele ou até 150 ms antes de ele
   começar. Ponto de partida; calibrada.

Os blocos entram na regra de corte que já existia, no lugar das palavras.

### A regra de corte (sem mudança de comportamento)

Entrada: os blocos de fala, o fps da sequência, a duração do clipe e a margem.
Saída: os **trechos que ficam**, em quadros, e para cada corte as palavras dos
dois lados (para o registro).

1. Para cada pausa entre um bloco `p` e o seguinte `q`, a parte removível é
   `[fim(p) + margem, início(q) − margem]`.
2. Antes do primeiro bloco: `[0, início(primeiro) − margem]`. Depois do
   último: `[fim(último) + margem, fim do clipe]`.
3. Encostar em quadro **sempre para dentro da pausa**: o começo do corte
   arredonda para cima, o fim arredonda para baixo.
4. Se a parte removível tiver menos de **2 quadros**, a pausa fica inteira.
5. Blocos sobrepostos ou encostados não geram corte.
6. A mesma margem vale para todos os cortes. **Padrão inicial: 0,08 s de cada
   lado**, calibrado num anúncio real; o painel mostra o campo já preenchido.
7. Os trechos que ficam recebem a posição final na timeline: cada um começa
   onde o anterior termina, a partir do quadro 0.

## Calibração com material real

Os números da regra (`A`, `B`, 150 ms, 250 ms, tolerância) **não são fixados
no chute**. O Diagnóstico grava na pasta de dados do plugin o WAV e a
transcrição crua de uma bruta real do usuário (2 a 5 minutos, com respiros). A
análise é feita fora do Premiere, com um script em `scripts/`, e mede:

- piso, voz e o nível dos respiros dessa gravação;
- como a transcrição do 26 atual marca as palavras (se ainda há espaço entre
  elas, se o fim estica por cima do silêncio, quanto o início erra em relação
  ao som);
- quanto cada escolha de número corta de respiro e quanto chega perto de fala.

Os números escolhidos entram no código como constantes, com o motivo medido no
comentário. **O repositório é público**: o WAV e a transcrição do usuário nunca
são commitados. Os testes usam níveis sintéticos, e qualquer fixture derivada do
material real vai sem texto de fala.

## Como aplica no Premiere (`src/pausas-premiere.ts`)

**Remontagem, não fatia-e-fecha.** Com os trechos e posições já calculados na
lógica pura, o adapter remonta a gravação: o clipe original vira o primeiro
trecho (ponto de entrada e fim ajustados) e cada trecho seguinte é um clone do
clipe, com ponto de entrada e fim ajustados e movido para a posição calculada.
Vídeo (V1) e áudio (A1) juntos.

O que as sondas já provaram ao vivo (tabela em `DEV_NOTES.md`, seção "Auto
Pausas"): o clone corta no offset pedido e só na faixa do item; o remove com
ripple fecha o buraco com V1/A1 em sincronia; todo pedaço nasce com `in=0.00`
e precisa de correção. A pergunta aberta — `setInPoint` num pedaço do meio
alinha no lugar ou empurra o pedaço — é respondida no Diagnóstico e decide a
mecânica:

- pedaço fica no lugar → fatiar, corrigir o in, remover com ripple;
- pedaço anda e o move funciona → o mesmo, mais um move por pedaço;
- pedaço anda e o move falha → remontar com `createOverwriteItemAction` (molde
  do `inserirPlano` do Auto B-roll).

Toda ação nasce dentro de `project.lockedAccess` e toda chamada ao Premiere
passa por `comLimite`, reaproveitando `comTransacao` do adapter do Auto B-roll.

**Desfazer:** o mínimo de transações possível. O número exato de Ctrl+Z é
medido no Premiere real e escrito no registro.

## Conferência depois de aplicar

A prova de que nada de fala saiu **lê o resultado**, não a ausência de erro
(lição do Auto Split):

1. Reler os clipes da V1 e da A1 da timeline.
2. Remontar a transcrição a partir deles com `reconstruirTranscricao`.
3. Comparar com a de antes: **mesmas palavras, na mesma ordem**. A duração de
   cada palavra não entra mais na comparação — no 26 atual ela não é
   confiável, e cortar o silêncio que a transcrição esticou por cima de uma
   palavra é exatamente o que a ferramenta deve fazer.
4. Registrar "N de N palavras presentes", ou listar exatamente quais sumiram.

Também confere que V1 e A1 terminaram com a mesma quantidade de trechos nas
mesmas posições (áudio não pode dessincronizar).

## Tela (`src/ui/pausas.html` + `pausas-mount.ts`)

Mesma folha da família (`css: cssBroll`, como AutoCut e Auto Split).

- **Cabeçalho:** "Auto Pausas" + badge de status ("lendo áudio…" enquanto o
  export roda).
- **SEQ — Sequência ativa:** nome, e a confirmação do que achou: gravação na
  V1/A1 e transcrição presente.
- **Margem de segurança:** um campo com o padrão calibrado.
- **Botões:** "Analisar" (exporta o áudio e mostra a prévia, sem mexer na
  timeline) e "Cortar pausas" (`sp-button` cta). Abrir a tela só lê a
  sequência — o export do áudio acontece no clique, não ao abrir.
- **LOG — Registro**, resumo no topo:
  - "38 pausas cortadas · 0:41 → 0:29";
  - cada corte com as palavras de cada lado: `0:12 · 0,8 s · "saúde" | "então"`;
  - cortes **maiores que 1 s em destaque** para conferir;
  - "voz sem palavra na transcrição" e "palavra baixa protegida", com o tempo;
  - a conferência: "412 de 412 palavras presentes";
  - quantos Ctrl+Z desfazem.

**Recusa com instrução** (nada é alterado):
- sem sequência ativa;
- sem transcrição no clipe → dizer como criar (painel Texto → Transcrever);
- timeline diferente de um clipe na V1 + áudio na A1;
- preset de WAV não encontrado ou export falhou → dizer qual caminho foi
  tentado.

## Diagnóstico — rodada 4 (uma ida ao Premiere)

Botão temporário "Diagnóstico", rodado **uma vez** pelo usuário numa bruta
real curta. Em ordem, e cada passo registra o que a timeline/disco mostrou
depois, não só se lançou erro:

1. **Áudio:** acha o preset, exporta o WAV da sequência, mede o tempo e o
   tamanho, lê o cabeçalho (taxa, canais, bits) e guarda o arquivo como
   `pausas-diag.wav` na pasta de dados.
2. **Transcrição:** guarda o JSON cru do `exportToJSON` do clipe como
   `pausas-diag-transcricao.json`, e registra quantos espaços entre palavras
   existem (a pergunta "o 26 ainda marca pausa?").
3. **Mecânica de corte:** a sonda da rodada 3, sem mudança (corta em 2 s e 4 s,
   `setInPoint` no pedaço do meio, `createMoveAction` se o pedaço andar). Roda
   por último porque mexe na timeline; o usuário desfaz com Ctrl+Z.

## Hall

Card no topo do grupo Pro Ads (já feito na Task 3).

## Testes

Automáticos (`tests/pausas.test.ts`, `node --test`), com níveis sintéticos:
- respiro antes da frase sai; final fraco da palavra fica;
- buraco curto dentro da palavra não quebra o bloco;
- som forte e longo sem palavra fica e é sinalizado; som fraco sem palavra sai;
- palavra que começa no silêncio ganha bloco protegido;
- tudo que já era testado na regra de corte continua (margem, quadro, mínimo
  de 2 quadros, posições finais);
- a conferência detecta palavra faltando, sobrando e fora de ordem.

Ao vivo (usuário, Premiere 26, um anúncio real):
1. o Diagnóstico (rodada 4) — uma vez;
2. aplicar numa bruta e ouvir: calibrar a margem de 0,08 s;
3. anotar quantos Ctrl+Z desfazem.
