# Handoff — sessões do Cowork de 23 a 28/09/2026

Contexto para continuar no Claude Code o que foi feito numa conversa do Claude
(Cowork). Escrito para o Claude Code ler antes de mexer no repositório.

## Quem é o usuário e o que ele quer

- Leo, editor de vídeo (Premiere Pro, Windows). Edita Reels de anúncio para o
  cliente AndroClinic (médico: Dr. Cristiano Estivalet), junto com o Felipe.
- Fala português; quer a recomendação, não um menu de opções.
- Objetivo final: um **sistema de edição completo** que entregue o vídeo quase
  no padrão, só para ele revisar. Começamos pela legenda, que é onde ele perde
  mais tempo corrigindo a transcrição do Premiere na mão.

## Estado em 28/09/2026 — por onde continuar

Ler isto antes do resto; as seções "Atualização" no fim são o histórico.

**29/09:** todos os passos abaixo que dão para fazer sem o Premiere estão
feitos (inclusive split, light leak e trilha no Editar). O Leo deixou os
testes ao vivo para o final (tabela "Estado dos testes") e autorizou seguir de
passo em passo, com commit e push ao fim de cada um. O seletor de perfil
(Plano, item 1, em `PERFIS_DE_EDICAO.md`) foi feito só na parte da empresa:
termos do ElevenLabs e pasta de B-roll de cada uma. Depois, medido nos
criativos da Menopausa: o split dela tem o B-roll **em cima**, e o lado do
split virou da empresa (Auto Split, Editar e Acabamento). O tipo
(Ads/Instagram) continua sem gabarito. As pastas de B-roll da Menopausa e da
GrandCare não têm nome de conceito: o Auto B-roll não serve nelas até serem
renomeadas (decisão do Leo).

- **Legenda (Pro Captions + ElevenLabs):** pronta no código, inclusive a
  segmentação no estilo do Leo (`segmentar.ts` + `maxPalavras: 3` no
  `PRESET_ELEVENLABS`). Sete gravações de tela dele editando o Andro 19.09
  confirmaram o estilo sem contradizer nada; achados em
  `docs/PERFIS_DE_EDICAO.md`, bloco "AndroClinic Ads — confirmado ao vivo".
  Falta rodar ao vivo com a chave certa do ElevenLabs (a que começa com `sk_`).
- **Auto B-roll e Acabamento:** já existem (painel e programa, ver
  `app/LEIA-ME.md`). Nas três últimas gravações o Leo monta à mão o broll
  das variações 1 e 2; o que ele faz diferente do código está no mesmo bloco
  do `PERFIS_DE_EDICAO.md`, em "Montagem do broll".

Próximos passos, em ordem (recomendação da sessão do Cowork — combinar com
o Leo antes de mexer):
1. **Legenda ao vivo.** ~~Tirar "stress" e rodar o verify~~ (feito 28/09).
   A comparação com o gabarito foi feita **sem Premiere**, com a resposta
   do ElevenLabs já salva. O texto do Pro Captions é melhor (3 erros contra
   7), mas a divisão em blocos repete só 74% dos cortes do Leo; a do
   Premiere repete 95%. **Feito (28/09):** o programa usa o bloco do Premiere
   com a palavra do ElevenLabs, a partir do `.srt` exportado (tela Legendas:
   arrastar o `.srt` e o áudio juntos). Pelo caminho real, 3 palavras
   diferentes e 95% dos cortes. Detalhe em
   `ferramentas/pro-captions/RETOMAR-pro-captions.md` e `app/LEIA-ME.md`.
   Falta rodar com uma sequência inteira: exportar o `.srt` e o áudio do
   Premiere e passar no programa com a chave `sk_`.
2. ~~**Gabarito de broll.**~~ Feito no Claude Code (28/09): lido do
   `.prproj` (variações 1–3, save das 11:05). Resultado em
   `docs/PERFIS_DE_EDICAO.md`, "Montagem do broll". Resumo: o painel acerta
   onde põe (10 de 14 colocações mantidas), mas põe de menos (6–8 contra
   8–15 do Leo), e as regras de duração do `plano.ts` cortam listas
   faladas e clipes longos. Extrator e JSON em
   `C:\Edição\...\Andro 19.09\teste-broll\` (`gabarito_broll.py`). Rodar de
   novo quando o Leo acabar mais variações; as que têm light leak são as
   acabadas. **Rodado de novo às 15:15 (variações 1–6):** a densidade máxima
   agora deixa o broll ir até o próximo, atravessando a frase (49 → 61
   brolls contra 70 do Leo; `simular.ts` na mesma pasta mede). **Rodou ao
   vivo em 29/09 10:14** (variação 11, 11 brolls, o seguinte cortando o
   anterior). Falta o Aprender dizer o que ele manteve. O conceito (26 de 58
   iguais ao dele) é gosto e se ensina pelo Aprender; detalhe em
   `PERFIS_DE_EDICAO.md`, "Conceito".
3. **Split do Andro no Acabamento.** O broll é constante e dá pra
   automatizar: preenche a largura, borda de cima em ~1120 px, Feather 7%.
   **Feito (29/09)** no painel e no `app/` (`src/autosplit.ts`: sem overscan,
   Feather 7, caixa em 58%), medido nos 70 brolls das variações 1–6.
   O doutor não tem número fixo. O 540/580 com Escala 57 do Andro 19.09 é
   de bruta deitada, que muda por trecho; a do Andro costuma vir em pé
   (Leo, 28/09). Em pé: feito no `app/` em 28/09 (`acabamento.ts`: sobe
   15% só por baixo do broll, cortando V1 e áudio vinculado nas bordas).
   Falta provar no Premiere. Deitada: fica manual, é decisão de olho como o
   crop/flop. Na próxima bruta em pé, medir o split que o Leo fizer à mão
   (`gabarito_broll.py`) e afinar o `DOCTOR_UP` (0,85) de
   `src/autosplit.ts`.
4. ~~**Biblioteca.**~~ Feito em 28/09:
   - Os 8 clipes do Envato foram copiados pra `Brolls - 2026` com nome de
     conceito (259 arquivos agora; nomes em `docs/PERFIS_DE_EDICAO.md`,
     "Buraco na biblioteca") e entraram no `src/autosplit-perfil.json`. O
     Auto Split do painel pula arquivo que não está lá.
   - Renome: o Leo renomeia no painel Projeto, não no disco, e o Aprender
     perdia o crédito desses clipes (`foraDaBiblioteca`). Agora as faixas
     de broll são lidas pelo nome do arquivo (`nomeDoArquivo`).
   - Depois, a pedido do Leo: no Aprender, clipe baixado e renomeado no
     painel Projeto é **copiado** pra pasta com esse nome. Detalhe em
     `ferramentas/auto-broll/docs/BUILD_STATUS.md`.
   - Falta provar no Premiere: clicar em Aprender no Andro 19.09. O
     "homens tratados (1)" deve contar como "14.000 mil homens (1)", e a
     cópia (API nova) precisa funcionar.
   - O "stressed-middle-aged-man" da variação 4, ainda em montagem, fica
     pra próxima leitura do gabarito.
5. **Provas (conferidas nos logs do painel em 28/09).** Já tinham rodado ao
   vivo em 24/09, pelo botão Editar, e os docs não registravam: L1–L4 e o
   ajudante CEP T1–T3 **OK** (evidência em
   `ferramentas/pro-captions/docs/API_PROOFS.md`). A chave `sk_` certa
   funcionou naquele dia. O Aprender de hoje (13:59) provou ao vivo a leitura
   do arquivo por trás do clipe e o `trazidos.json`. Continuam de pé:
   - **L5:** conferir no olho se a legenda cai em cima da fala.
   - **Fase 0 do XML:** nunca foi importada. A prova foi regerada com uma
     trilha que existe (`Confident.wav`; a antiga saiu do Downloads):
     importar `app/prova/PROVA-Pro-Edition.xml` e conferir os 8 itens de
     `app/LEIA-ME.md`.
   - **Cópia do Aprender:** renomear um clipe do Envato no Projeto e clicar
     em Aprender.
   - ~~Light leak fica pra fase de animação.~~ **Feito (29/09):** a
     colocação é regra fixa (79 de 79 bordas nas variações 1–6), e o Editar
     copia o leak do Premiere Composer que já está no projeto para cada
     troca doutor ↔ broll. Falta provar no Premiere que o `.aegraphic` entra
     pelo overwrite. A animação em si (.mogrt, pop) continua no item 3 do
     Plano.
6. ~~**Trilha no Editar.**~~ **Feito (29/09):** o README dizia que a trilha
   só existia no `app/`. Medida nas 20 variações do Andro 19.09 (stillness.WAV
   do 0, −18 dB, começa e termina com a variação), agora o Editar clona a
   música que o Leo pôs numa variação para as outras. Falta provar o clone
   no Premiere.

## O padrão de legenda que ele segue (visto em duas gravações de tela)

- O texto é o que o doutor fala de verdade. A transcrição do Premiere erra
  palavras que mudam o sentido: "Você **faz**"/"falha", "Eu **fui**"/"sou médico",
  "ele não **o**"/"me valoriza", "stress"/"estresse".
- Preço sozinho no bloco, em fonte 150: "tá saindo por" + "1.000 reais".
- "androclinic" escrito certo; acentos; "?" nas perguntas; sem ponto final; 15.000 com ponto.
- Nada de palavra solta: junta no bloco vizinho.
- Fim de cada variação: trilha e B-roll terminam junto com o vídeo do doutor.
- Anota crop (do cotovelo para cima) e flop quando o doutor aparece largado na cadeira.

## O que foi feito (tudo em `ferramentas/pro-captions/` salvo indicação)

1. **Transcrição pelo ElevenLabs (Scribe v2)** no lugar da do Premiere.
   Teste real na variação 1 do Andro 19.09 (176 palavras, gabarito = legenda
   revisada pelo Leo): Premiere 7 diferenças; Pro Captions + ElevenLabs 3,
   duas delas com o ElevenLabs certo e a legenda errada. Detalhes e lista de
   arquivos em `RETOMAR-pro-captions.md` (seção de 2026-09-24).
2. **Painel:** seção "Quem ouve o áudio" (checkbox ElevenLabs + chave de API
   em PluginData). O plugin exporta sozinho o áudio da sequência (WAV mono
   16 kHz), bloqueia envio de áudio mudo, reaproveita a resposta se o áudio
   for o mesmo.
3. **Manifests** (raiz e pro-captions): `network.domains` com
   `https://api.elevenlabs.io`.
4. **Ajudante CEP** `ferramentas/pro-captions-timeline/`: botão que põe
   `legendas.srt` e `precos.srt` na timeline via ExtendScript
   `Sequence.createCaptionTrack()` (o UXP não tem isso nem na 27.0.0-beta.57).
5. `scripts/fumaca-uxp.cjs` (raiz): carrega o `dist/` sem globais de
   navegador. **Rodar depois de todo build.** Um `new TextEncoder()` no topo de
   módulo deixou o painel inteiro em branco — está em
   `ferramentas/auto-broll/docs/UXP_ARMADILHAS.md`, seção 3b.
6. `npm run verify` verde: pro-captions 99 testes, raiz 84.

## Estado dos testes no Premiere real

| O quê | Estado |
|---|---|
| Painel Pro Edition carrega depois da correção do TextEncoder | OK (24/09) |
| Export do áudio da sequência pelo Pro Captions | OK — 27:18 em 6,4 s, 52 MB |
| `fetch` sai do UXP e chega no ElevenLabs | OK — a API respondeu |
| Chave do ElevenLabs | OK em 24/09; **recusada em 29/09** (401 "Invalid API key"): o Leo precisa colar uma chave nova no Pro Captions |
| Multipart a mão, keyterms, tempo alinhado com a sequência | L3–L4 **OK** (24/09); L5 indireto, falta o olho (`docs/API_PROOFS.md`) |
| Ajudante CEP (T1–T3) | **OK** (24/09): instalado, e criou as faixas legendas.srt e precos.srt numa chamada |
| Aprender pelo nome do arquivo + `trazidos.json` | **OK** (28/09 13:59): os 8 clipes copiados creditados pelo nome da pasta |
| Cópia do clipe baixado pelo Aprender | a medir |
| B-roll até o próximo (densidade máxima) | **rodou** (29/09 10:14, variação 11); falta o Aprender |
| Fase 0 do XML | **7 de 8 OK** (29/09); espelho não viaja no XML do FCP, nem o Premiere exporta (`app/LEIA-ME.md`) |
| Light leak pelo Editar (`.aegraphic` no overwrite) | **OK** (29/09, cópia do Andro 19.09): 16 leaks nas 16 bordas da variação 10 |
| Trilha pelo Editar (clone do clipe da A2 + fim na variação) | **OK** (29/09): variação 12, do começo ao fim, com o ganho do clipe de origem |
| Empresa no Editar (lista `<select>`, troca a pasta do Auto B-roll) | **OK** (29/09) |
| Split da Menopausa (B-roll em cima, `Bottom` do Rounded Crop) no Auto Split | **OK** (29/09): borda de baixo em 45%, Bottom 27,5% no 720×1280 |

Testes de 29/09 feitos por Claude numa cópia: `Andro 19.09\TESTE Pro Edition
29.09.prproj` (o original não foi tocado; a cópia pode ser apagada). Falta: L5
(olho), cópia do Aprender (renomear clipe do Envato), híbrido com `.srt` e chave
nova, doutor em pé no Acabamento.

## Arquivos de teste fora do repositório

`C:\Edição\2. Androclinic\1. AndroClinic\Andro 19.09\teste-legendas\`:
áudio da variação 1, `referencia_variacao1.srt` (gabarito tirado do .prproj),
`premiere_antes_da_revisao.srt`, `elevenlabs.json.json` e `comparar.py` (conta
palavras erradas e erro de tempo contra o gabarito).

O `.prproj` é XML em gzip; as legendas ficam em base64 nos blocos
`CaptionDataClipTrackItem` (texto com tamanho de fonte: 96 normal, 150 preço).
Dá para auditar o projeto inteiro lendo isso.

Achados no Andro 19.09: em 21:11.96, "por 196 reais" ficou em fonte 96 (o único
dos 39 preços fora do padrão); "focada" aparece em 6 legendas e "focado" em 13.

## Próximos passos combinados

1. Leo testa com a chave `sk_` certa e instala o ajudante CEP.
2. Medir L3–L5 e T1–T3 e registrar em `docs/API_PROOFS.md`.
3. ~~Ajustar a segmentação ao estilo dele~~ — já estava no código
   (`segmentar.ts`, `maxPalavras: 3`); falta só rodar ao vivo.
4. ~~Auto B-roll pelo que o doutor fala, trilha e fim de cada variação~~ — já
   existem (painel e `app/`); crop/flop do doutor continua manual. Ver
   "Estado em 28/09/2026" no topo.

## Atualização — 25/09/2026 (sessão do Cowork)

Sessão do Cowork retomada depois deste handoff. O Leo gravou **uma nova
demonstração de tela** (4m30, Premiere em tela cheia) revisando a legenda de
um trecho mais à frente do Andro 19.09 (por volta de 00:12:47–00:14:10 da
sequência, blocos de legenda ~950–1048) — provavelmente outra variação, não
a variação 1 já usada nos testes.

O que dá pra confirmar olhando os blocos antes/depois na gravação:
- Segmentação real dele: quase todo bloco tem 1 a 4 palavras, cortando nas
  pausas da fala ("Você" / "tá com medo" / "do quarto" / "do hotel?" —
  "Porque viagem" / "romântica"). Bate com o pendente #3 abaixo — é ground
  truth a mais pra calibrar a segmentação por pausa do ElevenLabs.
- Ele ajusta o limite do bloco arrastando a ponta na faixa de legenda (afinar
  o tempo) E edita o texto direto em cima do vídeo no Program Monitor, além
  do painel Captions — os dois editam o mesmo dado, não é um jeito "certo".
- Uma correção visível: juntou uma palavra do bloco seguinte no anterior
  ("E se falhar" + "lá" → "E se falhar lá"), com Ctrl+Z no meio — ajuste de
  julgamento de onde cortar, não erro de transcrição.
- Tema do trecho (pelo texto legível nos blocos, não é transcrição literal):
  medo de falhar numa viagem romântica/pousada, ligando com "cuida do plano
  de saúde, do carro, mas e a sua última consulta?" — candidatas novas pro
  mapa do Auto B-roll: viagem/pousada/quarto de hotel, plano de saúde, carro.

Limite desta gravação: ela não guarda as teclas digitadas (aparecem como
"[secure input]" no log), só o estado do bloco antes/depois — dá pra
confirmar OS PADRÕES (tamanho de bloco, onde corta, fusão de bloco), mas não
dá pra montar um diff palavra-por-palavra tipo o WER da variação 1. Pra isso,
precisa exportar áudio + legenda revisada desse trecho como da vez passada.

Os pendentes de "Estado dos testes no Premiere real" continuam de pé (chave
`sk_` certa no ElevenLabs, instalar e testar o ajudante CEP em
`ferramentas/pro-captions-timeline/`).

Não existe elo automático entre uma conversa do Cowork e uma sessão do Claude
Code — cada uma começa sem saber da outra. Este arquivo (lido pelo
`CLAUDE.md` na raiz) é o elo: qualquer sessão nova que for continuar este
projeto — Cowork ou Claude Code — deve ler este arquivo primeiro para pegar
o contexto todo.

## Atualização — 28/09/2026 (mais uma gravação)

Gravação nova (28/09), seguindo direto de onde a de 25/09 parou — mesma
variação, agora 00:14:37 a 00:18:19 da sequência. Nada novo no padrão de
segmentação/estilo (mesma coisa: bloco de 1 a 4 palavras, arrasta a borda
pra ajustar tempo, edita pelo painel Captions ou direto em cima do vídeo).
O que rendeu de novo:

- O roteiro tem uma estrutura de **5 etapas numeradas** ("Etapa um" a
  "Etapa cinco"): Consulta (investigação de verdade) → [etapa dois não
  capturada na gravação] → Diagnóstico (eu leio tudo com você) → Protocolo
  (do zero, pro seu corpo) → Acompanhamento (equipe médica e de
  enfermagem do início ao fim). Se um dia o Auto B-roll escolher clipe
  pelo trecho do roteiro, cada etapa provavelmente pede um broll diferente
  (consultório, exame, entrega de diagnóstico, remédio/protocolo, ligação
  de acompanhamento).
- "Disfunção erétil" aparece escrita por extenso como legenda própria, não
  só sugerida.
- "196 reais" / "1.000 reais" / "de 15.000" continuam voltando como âncora
  de preço em vários pontos do vídeo — não é preço único da variação 1,
  é recorrente ao longo do roteiro todo.
- "focada" (não "focado") nesse trecho concorda com "consulta", não com
  "médico" — não é inconsistência pra corrigir; os dois já apareceram
  certos dependendo do substantivo que seguem.
