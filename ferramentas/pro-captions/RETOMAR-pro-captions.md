# RETOMAR — Pro Captions

**Última sessão:** 2026-08-11 (continuação)
**Branch:** `fases-0-2` · último commit antes desta sessão `d8f9167` (working tree tinha mudanças não commitadas ao gravar este arquivo)
**Gate:** `npm run verify` → 82 testes passando, tipos limpos, build ok

Cole este arquivo numa conversa nova para continuar de onde paramos.

---

## O que é o produto, em uma frase

Plugin UXP para o Premiere que lê a sequência já editada, corrige a
transcrição no padrão editorial do Cristiano e devolve legendas de uma linha,
com os preços isolados — para o usuário apertar um botão em vez de ajustar
tudo na mão.

---

## O que mudou nesta sessão (2026-08-11)

O `scratchpad/preview.mjs` da sessão anterior morreu com o scratchpad (era
fora do repo). Foi **reconstruído do zero** em `scripts/preview.mjs` — dublê
de `premierepro`/`uxp` escrito como string de JS puro injetada antes do
bundle (não dá pra serializar função do Node com closures pro browser, isso
foi tentado e falhou na hora).

Rodei `npm run preview` e cliquei em "Gerar legendas" e "Restaurar original"
pelo Chrome de verdade: **nenhum dos dois travou.** Log completo, sem erro no
console, os dois ciclos terminaram em `estado = pronto` / `restaurado`.

**Conclusão da investigação:** com um dublê que se comporta direito, todo o
caminho do produto (`main.ts` → `premiere.ts` → `pipeline.ts`) roda limpo.
Isso derruba a hipótese "trava no clique do `sp-button`" e aponta com força
para a hipótese que já estava na lista: **o `preview.mjs` antigo tinha algum
`Promise` que nunca resolvia nem rejeitava** (talvez um método que faltava no
dublê, ou algo fora do `comLimite()`) — produto são, andaime quebrado. Não dá
pra confirmar a causa exata porque o arquivo antigo se perdeu; não vale
reconstruir a causa de um bug que já não existe no novo andaime.

`npm run verify` continua verde (78 testes) depois da troca.

Depois disso rodei `/code-review high` na branch inteira. Três achados foram
verificados linha a linha e são reais — **nenhum foi corrigido ainda**, ficou
para a próxima sessão por decisão do usuário. Ver seção "Review de código"
abaixo antes de mexer em `pipeline.ts` ou `premiere.ts`.

---

## Review de código (2026-08-11) — os três bloqueantes foram corrigidos

Corrigidos nesta sessão, `npm run verify` verde (79 testes, um novo teste
cobrindo o achado #1):

1. **`pipeline.ts:96` / `segmentar.ts`.** A causa raiz não estava em
   `pipeline.ts`: `blocosParaTranscricao` só jogava fora as palavras do
   segundo clipe porque `segmentar.ts` nunca forçava quebra num corte de
   vídeo quando a frase já cabia no orçamento de caracteres. Corrigido com
   `partirPorCorte()`, uma quebra dura aplicada *antes* de `fatiarPorPreco` e
   `partir` — nenhum bloco atravessa mais um corte, caiba ele no orçamento ou
   não. Teste novo: "corte de video quebra o bloco mesmo cabendo no
   orcamento" em `tests/segmentar.test.ts`.

2. **`premiere.ts:138-144`, função `lerTranscricoes`.** Ganhou um parâmetro
   `{ propagarErro: true }`: a leitura exploratória (várias mídias, antes de
   gerar) continua tolerante a falha; a leitura de segurança antes de
   escrever (`main.ts`, dentro do loop de escrita) agora propaga o erro, e
   `main.ts` trata isso como "pular esta mídia por segurança" em vez de
   "nada para guardar, escreve por cima". D-05 preservado mesmo com erro
   transiente.

3. **`main.ts:66`, chamada a `gravarLog()`.** Agora passa por `comLimite()`,
   como todas as outras chamadas ao UXP.

### Achado no teste real (2026-08-11, mesma continuação) — corrigido

Você rodou "Gerar legendas" com sequência real e o painel mostrou
**reprovado**. O `ultimo-log.json` deu a causa: `bloco 45 ("REAIS"): preco
misturado com texto normal`, reproduzível mesmo depois de "Restaurar
original" (não era reprocessamento do próprio texto — era determinístico a
partir da transcrição real).

Causa raiz, achada com um script de repro isolado (sem precisar do
Premiere): em `preco.ts`, quando "reais"/"real" confirma um preço sozinho
(regra `MOEDA.has(seguinte)`), o `fim` do `Numeral` retornado não incluía a
própria palavra "reais" — só o numeral. `fatiarPorPreco` em `segmentar.ts`
usa esse `fim` para saber onde parar de consumir palavras, então "reais"
sobrava como bloco de texto normal solto logo depois do preço. **Não tinha
nada a ver com a correção de corte de vídeo de hoje** — reproduz igual sem
nenhum corte.

Corrigido em `preco.ts` (o `fim` agora inclui a palavra da moeda) e, por
tabela, reordenado `segmentar.ts`: a detecção de preço agora roda ANTES da
quebra forçada por corte, não depois — senão um corte caindo bem no meio de
um preço (raro, mas achei testando) quebraria o preço em texto solto sem
nem disparar a validação, o que seria pior. Preço segue sendo hard boundary:
nunca quebra, nem por orçamento nem por corte. Dois testes novos cobrindo os
dois casos (`tests/segmentar.test.ts`, `tests/preco.test.ts`). `npm run
verify` verde, 82 testes.

**Você precisa refazer o teste no Premiere** com esse código (reinicie o
Premiere, o `dist/` já está reconstruído): apague a caption track antiga,
"Restaurar original", "Gerar legendas" uma vez, e só então "Criar legendas a
partir da transcrição" para medir o E5 de verdade.

### Menor, sem urgência — não corrigido, sem bloqueio

4. **`premiere.ts:122`, `lerCortes()`** busca os clipes de novo do zero;
   `main.ts` já tinha essa lista. Dobra as chamadas ao Premiere por clique.

Achados de prioridade ainda menor (regra do "por quê" comparando com o fim do
vídeo em vez do fim da frase, uma sugestão de revisão perdida no "pra"/"pro",
`agruparEmFrases` em `transcript.ts` sem uso no caminho real) — não bloqueiam
nada, revisitar depois se sobrar tempo.

---

## PRIMEIRA COISA A FAZER

**Medir o E5b: o caminho `.srt`.** O E5 original já foi medido e FALHOU (ver
seção "A pergunta que bloqueava tudo"); o `.srt` é o caminho agora.

1. Reiniciar o Premiere (não há hot reload; o `dist/` novo já está pronto).
2. Apagar qualquer caption track antiga da timeline.
3. Painel Pro Captions → "Gerar legendas". O log termina com o caminho do
   `legendas.srt` gerado em PluginData.
4. Arquivo > Importar → escolher esse `legendas.srt` → arrastar para a
   timeline.
5. **Contar:** número de legendas na faixa == número de blocos do log? Cada
   uma em UMA linha (orçamento agora é 24 caracteres)? Pontuação viva?
   `1.000 REAIS` e `197 REAIS` isolados?
6. Aplicar o estilo Pro-Captions salvo na faixa (Essential Graphics) e
   conferir se com fonte 96 nenhuma linha dobra.
7. Registrar o resultado em `docs/API_PROOFS.md`, linha E5b.

Se travar de novo no Premiere real (diferente do preview), aí sim é bug de
produto — voltar para `superpowers:systematic-debugging` com as ferramentas
do UXP (não do Chrome): `ultimo-log.json`, e se nem esse arquivo aparecer, o
travamento é antes do primeiro `comLimite`.

---

## Estado real, sem otimismo

| Parte | Estado |
|---|---|
| Núcleo de texto (preço, coloquial, é/e, porquês, termos, blocos) | **Pronto e testado**, 78 testes |
| Conversão bloco → transcript em tempo da mídia | **Pronto e testado** |
| Leitura da sequência no Premiere | Escrito, **nunca confirmado na tela** |
| Escrita do transcript no clipe | **Funciona** — provado com evidência real, ver abaixo |
| Botão único de gerar | Escrito, **trava no preview**, não testado no Premiere |
| Um `segment` vira uma legenda? | **NÃO MEDIDO. É o portão que decide o produto.** |

---

## E5b MEDIDO E APROVADO (2026-08-11, mais tarde)

O usuário importou o `legendas.srt` e os prints provaram: cada cue virou uma
legenda com a fronteira exata do arquivo — o `.srt` é o caminho definitivo
(D-13). Da mesma rodada saíram três ajustes, todos já no código (86 testes):

- **Orçamento 24 → 20**: 21 caracteres couberam na tela, 23 e 24 dobraram.
- **"Cristiano Valete" → "Estivalet" automático** (D-14): contexto exato +
  semelhança agora trocam direto; "Cristiano disse" continua intocado.
- Os dois preços saíram isolados ("1.000 REAIS", "197 REAIS") — a correção
  do "R$" grudado funcionou.

**2026-08-12 — o mistério da pontuação era o contrário:** ele não quer ponto
final nenhum nas legendas (D-15) — a limpeza de fronteira agora tira o "."
junto com a vírgula; "?" e "!" ficam, "1.000" não é atingido, e o `validar`
reprova bloco terminando em ponto. Da mesma conversa: **D-16** — texto e
preço saem em `.srt` separados (`legendas.srt` + `precos.srt`), um por faixa
de legenda, estilo 96 numa e 150 na outra — o preço nunca mais fica em 96
nem precisa de ajuste manual. **E7 provado** — `importFiles` leva os
dois ao painel Projeto sem diálogo (print do usuário). O "preço veio com
tudo junto" que ele reportou era o arrasto caindo na mesma faixa C1; a
segunda faixa se cria arrastando na área vazia acima da C1. **E7c FALHOU** — a inserção por código
executa sem erro e nada aparece na timeline (falha silenciosa clássica do
UXP); experimento removido, veredito no `API_PROOFS.md`. **Teto final da
automação, fechado:** importar pro painel Projeto é o máximo que a API
alcança; o piso manual por vídeo é 2 arrastos + 2 dropdowns de estilo.
Aplicar estilo por código é impossível (D-02). 87 testes verdes. **Falta o usuário criar o segundo Caption Style
(150) no Premiere** — mesmo processo do Pro-Captions, nome sugerido
"Pro-Captions Preco".

## A pergunta que bloqueava tudo — RESPONDIDA em 2026-08-11: E5 FALHOU

**O Premiere re-segmenta.** Medido com sequência real (49 segments → 47
legendas com fronteiras movidas — palavras migraram entre legendas). A prova
foi extraída de dentro do próprio `.prproj` (as legendas ficam em base64 no
XML; script de decodificação ficou na sessão). Detalhe completo e evidência
em `docs/API_PROOFS.md`, veredito do E5.

**O plano B virou o caminho principal:** o botão "Gerar legendas" agora
também grava `legendas.srt` em PluginData (um bloco = um cue) e o log
instrui a importar. O que falta provar é o **E5b**: importar o `.srt` no
Premiere e confirmar que ele preserva um cue por legenda, sem re-segmentar.
É a primeira coisa a fazer na próxima sessão de teste.

Descobertas de plataforma da mesma medição, já absorvidas no código:

- **Largura real medida:** com Bebas Neue 96 em 1080, 21 caracteres cabem,
  29 dobram a linha. `maxCaracteres` foi de 32 → **24** no `preset.ts`.
- **O ASR gruda "R$" no número** ("1.000 R$" é uma palavra só, com espaço
  invisível). O detector de preço agora entende isso — era por isso que o
  "custa 1.000" saiu cru, sem virar "1.000 REAIS" isolado.
- A telinha "Create captions" tem piso de 1,2s no Minimum duration e vem com
  "Remove Punctuation" marcado — irrelevantes agora que o caminho é `.srt`,
  mas registrados no `API_PROOFS.md`.

**Resolvido em 2026-08-12 (D-17):** a rota destrutiva foi removida com
aprovação do usuário — "Gerar legendas" não toca mais no transcript do
clipe; morreram `blocosParaTranscricao`, `salvarBackup`, `ehNosso` e
`sequenceToSource`. "Restaurar original" continua no painel para desfazer
escritas das versões antigas (os backups em PluginData permanecem).

---

## Evidência já coletada da rodada real do usuário

Em 2026-08-10 o usuário rodou o botão de teste antigo. Os backups em
`%APPDATA%\Adobe\UXP\PluginsStorage\PPRO\26\External\com.leogi.procaptions\PluginData\`
provaram:

- **A escrita funciona.** O transcript do clipe virou exatamente os 5 segmentos
  forçados, com o texto e os tempos certos. `createImportTextSegmentsAction`
  aceita o nosso JSON.
- **O usuário clicou 8 vezes em 4 minutos**, padrão de quem clica e não vê nada
  acontecer. A causa provável era o log crescendo para fora da área visível do
  painel — corrigido no commit `99f7fd2`, ainda não confirmado.
- O transcript original (100 KB, 14 segmentos, 974 palavras) está íntegro e
  restaurável, UTF-8 válido.

---

## Três defeitos corrigidos que valem lembrar

1. **O backup se destruía.** Cada clique salvava o transcript que o próprio
   plugin acabara de escrever; dos 8 backups, 7 eram lixo. Agora grava uma vez
   só por mídia, nunca o próprio texto — reconhecido pelo campo
   `speaker: "pro-captions"`.
2. **Não havia log em arquivo.** Era a lição documentada do auto-broll que
   ficou por implementar, e por causa disso não houve como saber o que o painel
   mostrou. Agora grava `ultimo-log.json` com as 10 execuções mais recentes.
3. **O log não era visível.** Crescia para baixo, fora da área do painel.
   Agora rola por dentro, com `max-height` e `scrollTop`.

---

## Decisões fechadas — não reabrir

| # | Decisão | Por quê |
|---|---|---|
| D-01 | Sem MOGRT | O usuário quer editar a legenda na timeline |
| D-02 | Uma caption track só | A API não aplica aparência por item |
| D-03 | Preço isolado; **o usuário aumenta a fonte à mão** | 1 a 4 por vídeo, zero risco técnico |
| D-04 | Escrever transcript de volta no `ClipProjectItem` | Único caminho que a API oferece |
| D-05 | Backup antes de toda escrita | A rota é destrutiva e sobrevive ao `Ctrl+Z` |
| D-06 | Largura por orçamento de caracteres | A fonte da caption track é inacessível |
| D-07 | Segmentação por `eos`, sem NLP | O Premiere já entrega fronteira de frase |
| D-08 | Repositório novo, esqueleto do auto-broll | Armadilhas do UXP já resolvidas |
| D-09 | `StyleType` é metadado, não renderização | Decorre de D-02 e D-03 |
| D-10 | Nome: **Pro Captions** | Fecha a §42 do briefing |
| D-11 | Estilo visual fixo (ver seção abaixo) | Preset obrigatório do usuário, fechado em 2026-08-11 |

### Estilo visual obrigatório das legendas

A API não escreve aparência (D-02, D-09) — este preset é aplicado à mão pelo
usuário no style da caption track, uma vez. **Não trocar por conta própria.**
Detalhe completo em
`docs/superpowers/specs/2026-08-10-pro-captions-design.md` §1.6.

| Propriedade | Valor |
|---|---|
| Fonte | Bebas Neue, Regular |
| Tamanho | 96 (bloco normal) · 150 no bloco de preço (D-03) |
| Alinhamento / posicionamento | Centralizado |
| Posição (X, Y) | 0, -329 |
| Tracking / espaçamento vertical | 0 / 0 |
| Sombra | ativada, preta, opacidade 96, ângulo 137°, distância 11,3, blur 15,6, último parâmetro 40 |

**D-12, confirmado em 2026-08-11 na tipagem oficial (`API_PROOFS.md`,
P4.1-P4.3):** não dá pra automatizar "Criar legendas a partir da
transcrição" nem passar esse estilo por código — a API não tem esse
comando, nem controle de layout/estilo/duração mínima, nem escape hatch de
comando de menu. Não é falta de esforço, é teto da plataforma. Não tentar
de novo sem uma tipagem nova do Premiere.

**Mitigação (reduz a 2 cliques por vídeo, sem código):**
1. Uma vez: criar um Caption Style no Premiere com os valores da tabela
   acima e salvar.
2. Uma vez: na telinha "Create captions" (abre ao clicar em "Criar legendas
   a partir da transcrição"), ajustar **Layout → Single Line** (vem em
   "Double Line" por padrão — quebra a regra de uma linha) e **Minimum
   duration → o mais baixo possível** (vem em 3.0s por padrão; muitos dos
   nossos blocos duram menos que isso e o Premiere funde blocos vizinhos
   pra bater o mínimo, o que quebra a contagem do E5). Selecionar o Caption
   Style salvo no passo 1 no campo **Style**. Salvar tudo isso junto como um
   **Caption preset** novo.
3. Por vídeo, daí em diante: escolher esse preset salvo + "Create
   captions". Só isso é manual.

**Três premissas do briefing são falsas** e já estão corrigidas no desenho:
não existe transcrição no nível da sequência; `CaptionTrack` não aceita
escrita; a fonte não é mensurável. Ver a seção 1 do desenho.

---

## Como mexer

```bash
cd C:\Users\leogi\Desktop\Pro-Captions
npm run verify        # tipos + 78 testes + build. Gate de tudo.
node demo.ts          # roda o pipeline num exemplo e imprime os blocos
```

**Não há hot reload.** Toda alteração exige reiniciar o Premiere.

**Instalação já feita:** symlink em
`C:\Program Files\Common Files\Adobe\UXP\Plugins\External\com.leogi.procaptions`
apontando para o repositório. Não precisa reinstalar; o `id` do plugin não mudou
com o rename.

**Preview no navegador** (útil porque não há hot reload): `npm run preview`
sobe `scripts/preview.mjs` em `http://localhost:8778`. Ele serve
`dist/index.html` (rodar `npm run build` antes) com a API do Premiere dublada
— uma sequência, um clipe, uma transcrição fixa. Testado nesta sessão: os
dois botões rodam sem travar. Útil para pegar erro de JS antes de reiniciar o
Premiere, mas não substitui o teste real — a dublagem não sabe se o Premiere
respeita um `segment` por legenda.

### Armadilhas do UXP

Ler `../auto-broll-premiere/docs/UXP_ARMADILHAS.md`. Cada linha de lá custou um
reinício do Premiere. As que já morderam neste projeto:

- CSS Grid não funciona; tudo em flexbox;
- `<script src>` e `<link>` não resolvem caminho relativo e falham em silêncio —
  por isso o build embute CSS e JS no HTML;
- toda Action nasce dentro de `project.lockedAccess()`, que é síncrono, e erro
  lançado lá dentro **não propaga**;
- há chamadas que penduram para sempre sem rejeitar — por isso `comLimite()`;
- `require("premierepro")` acontece no topo do módulo: se ele falhar, o painel
  fica **completamente mudo**, nem o "painel carregado" aparece.

---

## Mapa dos arquivos

```
src/
  domain.ts       TimelineClip, sourceToSequence e sequenceToSource
  transcript.ts   parse do JSON do Premiere + remontagem da fala do corte final
  pipeline.ts     encadeia as regras; converte blocos -> transcript por mídia
  texto.ts        termos protegidos, coloquial, é/e, porquês
  preco.ts        numeral por extenso, contexto monetário, formatação BRL
  segmentar.ts    blocos de uma linha, preço isolado, vírgula, cortes
  preset.ts       toda config: orçamento, tolerâncias, termos
  premiere.ts     única porta para a API do Premiere
  ui/             painel
scripts/
  build.mjs       empacota o painel em dist/
  preview.mjs     dublê de premierepro/uxp no navegador, npm run preview
docs/
  API_PROOFS.md                    tabela E1..E6 — E5 é o portão, ainda vazia
  superpowers/specs/...design.md   o desenho, com D-01 a D-10
  superpowers/plans/...fases-0-2.md o plano das 13 tarefas
CLAUDE_START_HERE_LEO_CAPTIONS.md  briefing original do usuário (nome antigo
                                   de propósito: é documento recebido)
```

---

## Ordem sugerida ao retomar

1. ~~Achar o travamento do preview~~ — feito em 2026-08-11: reconstruído em
   `scripts/preview.mjs`, roda limpo, produto está são.
2. **Confirmar no Premiere real:** abrir o painel, ver a sequência aparecer,
   clicar em "Gerar legendas", ler `ultimo-log.json`.
3. **Medir o portão E5** e registrar em `docs/API_PROOFS.md`. Se falhar, propor
   o `.srt` ao usuário com o resultado medido na mão.
4. Só depois: prévia dos blocos antes de escrever, tela de revisão, e o resto
   da Fase 3.

---

## Como o usuário trabalha

Ele pede a recomendação em vez de escolher entre opções — liderar com a decisão
técnica e o motivo em uma linha. Ele autorizou seguir sem confirmar a cada
passo ("pode sempre seguir com o que for o melhor"), mas decisões que mudam o
produto — o que ele edita à mão, o que é destrutivo — continuam sendo dele.

Não presumir que ele lembra do jargão dos próprios documentos: escrever
"fonte 150", não "150".
