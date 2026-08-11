# RETOMAR — Pro Captions

**Última sessão:** 2026-08-11
**Branch:** `fases-0-2` · último commit `d210c62` (mais o `scripts/preview.mjs`
novo, ainda não commitado — ver "O que mudou nesta sessão")
**Gate:** `npm run verify` → 78 testes passando, tipos limpos, build ok

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

---

## PRIMEIRA COISA A FAZER

**Testar no Premiere real.** O preview no navegador não é mais suspeito — a
próxima dúvida real só o Premiere de verdade responde:

1. Abrir o Premiere com uma sequência real editada.
2. Painel Pro Captions → "Gerar legendas". Confirmar que não trava e que o
   `estado` no canto muda para "pronto" (ou "N para revisar").
3. Ler `ultimo-log.json` em
   `%APPDATA%\Adobe\UXP\PluginsStorage\PPRO\26\External\com.leogi.procaptions\PluginData\`
   e conferir que os blocos batem com o que a fala real dizia.
4. **Medir o portão E5** (ver seção abaixo) — é o que decide se o produto
   funciona ou vira plano B (`.srt`).

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

## A pergunta que bloqueia tudo

O Premiere não tem API para escrever legenda direto na caption track. Isso foi
confirmado na tipagem oficial: `CaptionTrack` só expõe nome, mute, índice e
`getTrackItems`. O único caminho é escrever o transcript de volta no
`ClipProjectItem` e o usuário mandar "Criar legendas a partir da transcrição".

**Ninguém sabe se o Premiere respeita um `segment` por legenda ou se ele
re-segmenta com as regras dele.** Se re-segmentar, a regra de uma linha morre
na última etapa — que é onde está todo o valor do produto.

Plano B, se falhar: gerar um arquivo `.srt` e o usuário arrasta para a C1.
Sem re-segmentação, custo de um arrasto manual.

**Como medir:** clicar em "Gerar legendas" com uma sequência real, depois
`Texto > Legendas > Criar legendas a partir da transcrição`, e contar quantas
legendas saíram contra quantos blocos o log reportou. Registrar em
`docs/API_PROOFS.md`, tabela E5.

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
