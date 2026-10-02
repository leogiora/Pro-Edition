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

**30/09 (Cowork):** uma gravação do Leo montando o broll do `Meno 29.09`,
que é **orgânico do Instagram** (confirmado por ele) — o primeiro gabarito
do tipo Instagram. Detalhe em `PERFIS_DE_EDICAO.md`, "Menopausa Instagram —
ao vivo". A partir de agora, toda gravação do Leo é material de refinamento
do plugin.

**30/09 (Claude Code), estado atual:** a legenda do Instagram é a mesma dos
Ads (medido nos 252 blocos do `Meno 29.09`); o tipo Instagram do Editar feito
em 29/09 foi apagado, e o negrito fica à mão (nenhuma regra acertou mais que
"sem negrito"). Chave do ElevenLabs, L5 e híbrido provados em 29/09. Split da
Menopausa: a apresentadora desce com teto de 0,9 da altura. Cópia do
Aprender provada no original (30/09). Falta só o doutor em pé no Acabamento,
quando vier bruta em pé.

**01/10, tela do Editar mais visual (passo 1 de 3):** o Leo escolheu, entre
5 protótipos, uma tela que junta tudo. O passo 1 foi feito:
- cada etapa mostra o próprio estado e resultado ao lado da caixa ("✓ 7 cortes · 12:10 → 10:30");
- uma barra mostra o andamento;
- números grandes: duração, B-rolls com leaks, legendas com preços;
- uma grade de variações. Clicar numa variação mostra o que entrou nela, e a variação cuja fala acaba mais de 3 s antes do fim acende aviso (áudio mudo).

**Passo 2, timeline viva:** abaixo da grade, a variação escolhida aparece em
faixas (C2 preço, C1 legenda, V3 leak, V2 B-roll, V1 doutor, A2 trilha).
- As faixas se redesenham depois de cada etapa, porque o Editar manda o que já está na timeline.
- Uma tela 9:16 mostra o frame no cursor: o doutor, o B-roll com o nome do conceito, o split depois que a etapa Split rodou, borda âmbar no leak e a legenda ou o preço embaixo.
- ▶ toca em tempo real, e clicar num pedaço de qualquer faixa pula o cursor para lá.
- Tudo em flex-grow (`segmentos()` em `shell.ts`), sem largura em %.

**Passo 3, abas:** o Editar tem três abas.
- **Timeline** é a do passo 2.
- **Quadros** mostra um quadro 9:16 por pedaço da V1, com o B-roll e o split no meio do pedaço, borda âmbar quando tem leak, o tempo e a legenda.
- **Fala** mostra a fala da variação palavra por palavra:
  - barra vermelha onde a imagem corta e cinza onde começa uma legenda nova;
  - etiqueta com o conceito onde o B-roll começa e fundo roxo nas palavras debaixo dele;
  - fundo coral no preço e "áudio mudo daqui em diante" no fim.
- Clicar num quadro ou numa palavra leva a timeline para aquele ponto.
- As regras são puras, `marcarFala()` e `quadros()` em `editar.ts`.

**Layout do protótipo (01/10):** o Leo abriu os passos 1 a 3 no Premiere e a
tela ainda tinha o layout antigo (caixas de marcar, lista, seções empilhadas).
Ela foi refeita igual ao protótipo combinado:
- **topo:** "Editar · sequência" com a pílula de estado;
- **seleção:** empresas em botões e as etapas em bolinhas com símbolo que ligam e desligam e acendem quando rodam;
- **andamento:** a barra e a grade R1…R10;
- **variação escolhida:** o nome com as primeiras palavras da fala, 4 números (cortes, B-rolls, legendas, preços), o aviso de áudio mudo e as abas;
- **embaixo:** o registro curto (o completo atrás de um clique) e o rodapé "Editar todas" / "Ler de novo".

A timeline já aparece antes de editar: `lerEstado` devolve a V1, os B-rolls
e os leaks que já estão na sequência.

O "Só esta" do protótipo ficou de fora, porque o Editar trabalha na sequência
inteira. Os símbolos das etapas são caracteres (✂ ▣ ▤ ☀ ♪ ≡), porque o UXP não
tem a fonte de ícones. Conferido no navegador com o código real e um Premiere
falso. Falta abrir no Premiere.

**Teste de fogo no Premiere 2025 (01/10, Claude no PC do Leo):**

Achados e correções:
- **Ícones:** o ✂ virava emoji, então todos os ícones viraram caixas de CSS (`icone()` em `shell.ts`), no Editar e no hall.
- **Etapa desligada:** não mudava nada, porque o UXP ignora `opacity`. Agora fica cinza explícito.
- **Clique:** todo clique acende o que foi tocado (`data-apertado`).
- **Etapa da vez:** pulsa por JS (o UXP não garante animação CSS) e fica 0,3 s à vista.
- **Andamento:** o motivo da parada quebra linha, com a dica "Desligue Pausas" quando a A1 não acompanha a V1.
- **Registro completo:** rola até aparecer.
- **Cursor:** virou uma linha vermelha.
- **O que já estava na sequência:** B-rolls, leaks e música na A2 entram no desenho antes e depois do Editar (`jaNaTimeline`).
- **Mensagem de áudio mudo:** cita mídia offline.

Rodado na `PROVA Pro Edition` da cópia de teste (Split, Leak e Trilha, sem
ElevenLabs), fechada sem salvar. O "Projeto Base" do Leo estava com mídia
offline e A1 separada da V1: o Editar recusou com a mensagem certa, sem mexer
em nada.

**Tela inicial no mesmo estilo (01/10, pedido do Leo):**
- o Editar virou um card em destaque, com borda azul, botão "Abrir", as seis etapas em bolinhas e a timeline nas cores da tela dele;
- as ferramentas avulsas ganharam a bolinha com a cor da etapa delas no Editar;
- a miniatura pinta cada faixa com a cor da timeline do Editar (`data-faixa` em `desenharTrilhas()`).

- **Legenda (Pro Captions + ElevenLabs):** pronta no código, inclusive a
  segmentação no estilo do Leo (`segmentar.ts` + `maxPalavras: 3` no
  `PRESET_ELEVENLABS`). Sete gravações de tela dele editando o Andro 19.09
  confirmaram o estilo sem contradizer nada; achados em
  `docs/PERFIS_DE_EDICAO.md`, bloco "AndroClinic Ads — confirmado ao vivo".
  Rodou ao vivo com a chave nova em 29/09.
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
   ~~Falta rodar com a chave `sk_`.~~ **Feito (29/09, chave nova):** L5
   provado na "Reels" (+0,04 s constante), híbrido no programa com 96% dos
   cortes, e três achados corrigidos (palavra curta sozinha, legenda colada na
   seguinte, reimportação do `.srt` trazendo o texto velho). Detalhe em
   `ferramentas/pro-captions/RETOMAR-pro-captions.md`, 29/09.
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
7. ~~**Quadrado 1:1.**~~ **Feito e provado (29/09):** o Leo voltou a fazer a
   versão quadrada (sequência "Quadrado" no Andro 19.09, metade convertida à
   mão). Botão no Auto Split; regra em `PERFIS_DE_EDICAO.md`, "Quadrado".
   Clipe do Envato sem tamanho conhecido fica como está.
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
| Chave do ElevenLabs | OK em 24/09; recusada em 29/09 de manhã; **chave nova OK (29/09 14:12)**. O programa usa a do painel quando não tem a sua |
| Multipart a mão, keyterms, tempo alinhado com a sequência | L3–L4 **OK** (24/09); **L5 OK (29/09)**: 610 blocos casados com a legenda revisada, +0,04 s constante, sem deriva (`docs/API_PROOFS.md`) |
| Legenda híbrida no programa (`.srt` do Premiere + áudio) | **OK** (29/09): variação 1, 81/84 cortes, 2 de 176 palavras, tempo mediano 0 ms |
| Legenda colada, 4 palavras contra palavra solta, `.srt` reimportado | **OK** (29/09): faixa nova com os 758 blocos novos, 728 de 757 vãos zerados |
| Ajudante CEP (T1–T3) | **OK** (24/09): instalado, e criou as faixas legendas.srt e precos.srt numa chamada |
| Aprender pelo nome do arquivo + `trazidos.json` | **OK** (28/09 13:59): os 8 clipes copiados creditados pelo nome da pasta |
| Cópia do clipe baixado pelo Aprender | **OK** (30/09, no original): comprimidos renomeado "Medicamento" no Projeto → `Brolls - 2026\Medicamento (3).mp4`, mesmo tamanho, 1080×1920 no `trazidos.json`, colocação creditada. Não rodar Aprender numa cópia do projeto: a pasta de dados é uma só e as pendências vão pelo nome da sequência |
| B-roll até o próximo (densidade máxima) | **rodou** (29/09 10:14, variação 11); falta o Aprender |
| Fase 0 do XML | **7 de 8 OK** (29/09); espelho não viaja no XML do FCP, nem o Premiere exporta (`app/LEIA-ME.md`) |
| Light leak pelo Editar (`.aegraphic` no overwrite) | **OK** (29/09, cópia do Andro 19.09): 16 leaks nas 16 bordas da variação 10 |
| Trilha pelo Editar (clone do clipe da A2 + fim na variação) | **OK** (29/09): variação 12, do começo ao fim, com o ganho do clipe de origem |
| Empresa no Editar (lista `<select>`, troca a pasta do Auto B-roll) | **OK** (29/09) |
| Split da Menopausa (B-roll em cima, `Bottom` do Rounded Crop) no Auto Split | **OK** (29/09): borda de baixo em 45%, Bottom 27,5% no 720×1280 |
| Quadrado 1:1 (botão do Auto Split) | **OK** (29/09): 697 clipes da V1 a 50%, 100 B-rolls cobrindo o quadrado |
| Tela nova do Editar (estado por etapa, barra, números, grade de variações, timeline viva com a tela 9:16, abas Quadros e Fala) | falta: abrir o Editar numa edição real e conferir. O B-roll do Editar entra em `pendentes.json` pelo nome da sequência, então o teste não pode ser numa cópia |
| Ponte plugin → programa (o plugin conta sequência, cursor e seleção a cada 0,5 s por 127.0.0.1:47800; o programa mostra no topo) | **OK ao vivo** (01/10, Premiere 25, projeto Live 30.09): o programa mostrou "Premiere ao vivo · Live · 1:54:43" e acompanhou o cursor quando ele foi movido. O UXP só aceitou o `http://` local com `"domains": "all"` (`UXP_ARMADILHAS.md` 3a). Contagem de selecionados **OK** (01/10, cópia de teste): clique num clipe da V1 → "2 selecionado(s)" (vídeo + áudio ligado); clique no vazio → 0. O 0 do primeiro teste foi um clique que não selecionou nada |
| AutoEdit no programa (mesma tela do painel; o plugin atende os pedidos e manda etapa, variações e registro ao vivo) | **OK ao vivo** (01/10, cópia de teste, `PROVA Pro Edition`): o programa leu a sequência (grade, números, timeline com 2 B-rolls e trilha) e rodou Split, Leak e Trilha em 1 s, com cada etapa chegando ao vivo. **Achado, não é da ponte:** o Split reaplicado numa sequência que já tinha split deixou o B-roll "Consulta médica" quase todo fora da tela em 0:04 (faixa fina no pé). É o mesmo Split do painel. **Causa (01/10):** o B-roll tinha o Crop nativo do Premiere (`AE.ADBE AECrop`, Top 50) de um split antigo, e o Split só procurava o Rounded Crop. Reposicionado e com o Rounded Crop de 14%, os dois cortes somados deixavam só de ~1805 a 1920 px. **Corrigido:** o Split e o Quadrado tiram o Crop nativo junto (`MATCH_CROP_NATIVO` em `autosplit-premiere.ts`). **Provado ao vivo (01/10):** rodado de novo na `PROVA Pro Edition` (só Split), o log disse "1 tinham o Crop do Premiere de um split antigo: tirado" e o B-roll ficou na caixa de baixo inteira em 0:04 |
| "Só a seleção" no AutoEdit (só as variações com algum clipe selecionado: o corte de pausas protege as outras como "fala", B-roll, leak, trilha e legenda ficam dentro delas, e o Split só pega o B-roll de lá) | **OK ao vivo** (01/10, cópia de teste, Reels com 20 variações, só Split, Leak e Trilha): "só a seleção: variação 3 de 20", Split em 8 B-rolls entre 2:21 e 3:11, só a variação 3 ganhou ✓. Botões do rodapé com ícone. Pausas e Legendas na seleção ainda não testados ao vivo |
| SilenceCut pela ponte (mesma tela no painel e no programa: margem, prévia com os cortes na V1, Cortar, Desfazer) | **OK ao vivo** (02/10, cópia de teste, `PROVA Pro Edition`): painel e programa leram 3 clipes / 18 palavras, prévia de 6 pausas (0:09 → 0:06), corte em 8–9 pedaços com V1 e A1 em sincronia e duração conferida, Desfazer devolveu os 3 clipes. **Achado e corrigido:** a bruta volta com os 2 canais (A1 e A2) e o overwrite apagava a trilha que estava na A2 (sumiu no corte + desfazer). Agora o corte e o Desfazer recusam se a A2 em diante tem clipe de outro arquivo ("rode antes da trilha e do B-roll"); provado ao vivo, nada mexido. Vale também para a etapa Pausas do AutoEdit |
| B-Roller no layout novo (painel e programa; o corpo do painel antigo virou `ferramentas/auto-broll/src/motor-local.ts`, a tela é `src/ui/broller.html`) | **Abrir e ler OK ao vivo** (02/10, no Andro 19.09, Reels): painel e programa leram a pasta salva, as 3 opções, a sequência e os 412 B-rolls acima da V1 (faixa V2 em cinza); opção liga/desliga. **Falta:** Analisar e Aprender pela tela nova num projeto real — não roda na cópia (aprendizado compartilhado). O fps da sequência vem 0 nessa leitura (já vinha no painel antigo); a tela só esconde |

Testes de 29/09 feitos por Claude numa cópia: `Andro 19.09\TESTE Pro Edition
29.09.prproj` (o original não foi tocado; a cópia pode ser apagada). Falta:
cópia do Aprender (renomear clipe do Envato: o nome é gosto do Leo) e doutor
em pé no Acabamento (quando vier bruta em pé). Na "Reels" do Andro 19.09, os
clipes de áudio das variações 11–20 estão mudos: a legenda pelo ElevenLabs sai
só até 11:33 (o painel agora avisa).

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
