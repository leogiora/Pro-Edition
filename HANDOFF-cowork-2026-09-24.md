# Handoff — sessão do Cowork de 23 e 24/09/2026

Contexto para continuar no Claude Code o que foi feito numa conversa do Claude
(Cowork). Escrito para o Claude Code ler antes de mexer no repositório.

## Quem é o usuário e o que ele quer

- Leo, editor de vídeo (Premiere Pro, Windows). Edita Reels de anúncio para o
  cliente AndroClinic (médico: Dr. Cristiano Estivalet), junto com o Felipe.
- Fala português; quer a recomendação, não um menu de opções.
- Objetivo final: um **sistema de edição completo** que entregue o vídeo quase
  no padrão, só para ele revisar. Começamos pela legenda, que é onde ele perde
  mais tempo corrigindo a transcrição do Premiere na mão.

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
3. Ajustar a segmentação para ficar mais perto do estilo dele (blocos de 1 a 3
   palavras, quebrando nas pausas da fala: o ElevenLabs dá o tempo de cada palavra).
4. Depois: Auto B-roll escolhendo o clipe pelo que o doutor fala (os nomes
   da pasta `Downloads\Brolls - 2026` já batem com os temas: Consulta médica,
   Teleconsulta, Viagra, Vasos sanguíneos, Frustrado, Doutor, Corpo do homem),
   crop/flop, trilha e fim de cada variação — rumo ao sistema completo.
