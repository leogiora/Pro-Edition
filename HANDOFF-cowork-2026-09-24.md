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
1. **Legenda ao vivo.** Tirar "stress" do `termosChave` em `preset.ts` (entrou
   por uma leitura errada de gravação; a grafia dele é "estresse") e rodar
   `npm run verify`. Depois, "Gerar legendas" com a chave `sk_` na variação 1
   e comparar com o gabarito usando `comparar.py`.
2. ~~**Gabarito de broll.**~~ Feito no Claude Code (28/09): lido do
   `.prproj` (variações 1–3, save das 11:05). Resultado em
   `docs/PERFIS_DE_EDICAO.md`, "Montagem do broll". Resumo: o painel acerta
   onde põe (10 de 14 colocações mantidas), mas põe de menos (6–8 contra
   8–15 do Leo), e as regras de duração do `plano.ts` cortam listas
   faladas e clipes longos. Extrator e JSON em
   `C:\Edição\...\Andro 19.09\teste-broll\` (`gabarito_broll.py`). Rodar de
   novo quando o Leo acabar mais variações; as que têm light leak são as
   acabadas.
3. **Split do Andro no Acabamento.** O broll é constante e dá pra
   automatizar: preenche a largura, borda de cima em ~1120 px, Feather 7%.
   O doutor não tem número fixo. O 540/580 com Escala 57 do Andro 19.09 é
   de bruta deitada, que muda por trecho; a do Andro costuma vir em pé
   (Leo, 28/09). Em pé: feito no `app/` em 28/09 (`acabamento.ts`: sobe
   15% só por baixo do broll, cortando V1 e áudio vinculado nas bordas).
   Falta provar no Premiere. Deitada: fica manual, é decisão de olho como o
   crop/flop. Na próxima bruta em pé, medir o split que o Leo fizer à mão
   (`gabarito_broll.py`) e afinar o `DOCTOR_UP` (0,85) de
   `src/autosplit.ts`.
4. **Biblioteca:** levar pra `Brolls - 2026`, com nome de conceito, o que ele
   foi buscar no Envato (mulher triste, homem dormindo), e conferir como o
   aprendizado do Auto B-roll lida com arquivo renomeado.
5. Continuam de pé: ajudante CEP (T1–T3), provas L3–L5 e a Fase 0 do XML
   (`app/LEIA-ME.md`) se ainda não foi importada. Light leak fica pra fase de
   animação (item 3 do Plano no `PERFIS_DE_EDICAO.md`).

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
| Chave do ElevenLabs | **FALHOU por uso errado:** o Leo colou o ID da chave; a chave secreta começa com `sk_`. O painel agora avisa. Refazer com a chave certa |
| Multipart a mão, keyterms, tempo alinhado com a sequência | a medir (L3–L5 em `docs/API_PROOFS.md`) |
| Ajudante CEP (T1–T3) | a instalar e medir (`INSTALAR.ps1`) |

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
