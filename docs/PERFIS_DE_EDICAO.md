# Perfis de edição — 3 empresas × 2 tipos

Cada vídeo é de uma **empresa** (AndroClinic, GrandCare, Menopausa Cancelada) e de
um **tipo** (Ads ou Instagram orgânico). São 6 perfis, e o Pro Edition tem de
saber qual é antes de editar. Regra do Leo, 2026-09-25.

Levantado em 2026-09-25 em três fontes:
- Biblioteca de Anúncios da Meta: anúncios em vídeo de cada página, os de maior alcance e os mais recentes.
- Instagram de cada empresa: reels recentes.
- Projetos do Premiere em `C:\Edição`: fontes, trilhas e gráficos usados de fato.

Os quadros foram vistos em mosaicos de 12 momentos por vídeo; o som não foi
ouvido. O que está marcado com **?** falta confirmar com o Leo.

| Empresa | Página nos anúncios | Instagram |
|---|---|---|
| AndroClinic | Androclinic Brasil (id 281650945034666), ~77 vídeos | @androclinic.saude |
| GrandCare | Grand Care Brasil (id 154969534364950), ~5 vídeos | @grandcarebr |
| Menopausa Cancelada | Menopausa Cancelada (id 106449212160487), ~7 vídeos | @menopausa.cancelada |

## Ads

| | AndroClinic | GrandCare | Menopausa Cancelada |
|---|---|---|---|
| **Legenda** | Bebas Neue, MAIÚSCULA, branca com sombra, 1 a 3 palavras, no terço de baixo | igual à AndroClinic (Bebas Neue no `Grandcare.prproj`) | dois jeitos (ver abaixo) |
| **Layout** | doutor em tela cheia; B-roll entra na metade de baixo (split) | igual; tarja com o nome do doutor no começo | apresentadora com os produtos na mesa; nos criativos de setembro, split com o **B-roll em cima** (medido, ver abaixo) |
| **Logo** | — | GrandCare branco no canto superior direito | — |
| **Transição** | light leak em alguns cortes | light leak (Premiere Composer) | — |
| **Música** | trilha baixa de fundo | `Confident.wav`, `Main Version.wav` | ? |
| **Preço** | faixa separada, tamanho 150 | — | — |
| **Duração** | 60 a 85 s | 40 a 86 s | 45 a 155 s |

**AndroClinic Ads — confirmado ao vivo (25 e 28/09, sete gravações de tela
editando o Andro 19.09, com som, ~2.300 ações: quatro revisando legenda
bloco a bloco, três montando o broll das variações 1 e 2):** bate com esta
linha da tabela, sem contradição. Bebas Neue maiúscula (a legenda em si é
minúscula/frase normal; a caixa alta é da Track Style), 1 a 3 palavras por
bloco confirma o `maxPalavras: 3` do `PRESET_ELEVENLABS` (`preset.ts`) — que
já vinha de medir 2,1 palavras/bloco na legenda revisada da variação 1, não
é coincidência. Preço isolado em fonte 150 se repete em vários pontos do
vídeo (não é só a variação 1). Ponto novo, não é sobre segmentação: o Leo
deixa concordância de gênero como a fala pede ("focada" concordando com
"consulta", "focado" com "médico" em outro ponto) — o pipeline não deve
tentar "consertar" isso pra um gênero fixo. A grafia é "estresse" ("SONO,
ESTRESSE"); "stress" é erro do Premiere que ele corrige (já está na lista do
HANDOFF), então "stress" não deveria estar no `termosChave`.

**Legenda na timeline (medida em 29/09 nos 862 blocos das variações 1–10):**
cada bloco fica até o seguinte entrar (1.685 de 1.722 sem vão), e o Pro
Captions agora faz igual quando o vão é menor que 1 s. O limite de 3 palavras
tem folga de uma quando a quebra deixaria palavra curta sozinha ou pendurada
("Mas na hora h", "Até que um dia"; 4% dos blocos dele). Os blocos dele: 26%
de 1 palavra, 46% de 2, 24% de 3; os nossos puxam mais para 3, e repetimos 70%
dos cortes. O híbrido (bloco do Premiere, palavra do ElevenLabs) repete 96%.

**Montagem do broll (três gravações de 28/09, variações 1 e 2), comparada
com o código** (Auto B-roll e Acabamento em `app/LEIA-ME.md`):
- **Split (medido no `.prproj`, save de 28/09 11:05, variações 1, 2 e 3).**
  O doutor sobe só enquanto o broll está na tela. No Andro 19.09 ficou em
  Posição 540/580, Escala 57 (a bruta 3840×2160 ocupa de 0 a 1196 px); sem
  broll, volta a 540/960, Escala 90. **Não é padrão:** vale pra essa bruta,
  que veio deitada — a do Andro costuma vir em pé (Leo, 28/09). Na bruta
  deitada a posição muda com o trecho: no "Gravação Cristiano 31.07", também
  deitado, o doutor por baixo do broll vai de Y 715 a 835 com Escala 78 a
  100. Em pé, não há gabarito no disco. Desde 28/09 o Acabamento do `app/`
  sobe o doutor 15% (Y 960 → 816) sem mudar a escala, só por baixo do broll
  (`nudgeDoutorPosY`, calibrado no desenho, não medido; o painel tinha a
  regra mas nunca aplicou). O broll
  preenche a largura sem sobra (escala = 1080 ÷ largura: 232,8 no
  464×832, 150 no 720×1280) e a borda de cima visível fica em 1000–1145 px
  (mediana ~1120; na variação 3, 1123–1128), por baixo da borda do doutor.
  A sobreposição some no Feather 7% do "FI: Rounded Crop FX" do Film
  Impact (Top 8–45% conforme o clipe; sem arredondar). **Desde 29/09 o
  código faz igual** (medido nos 70 brolls das variações 1–6): Feather 7,
  sem overscan, caixa de baixo em 58% por padrão (borda do código a 21 px
  da dele, mediana; em 50% ficava a 159 px). O Top de cada clipe continua
  vindo do perfil: o dele sai de colar atributos (na variação 1 todo
  464×832 tem Top 30 e Y 1506, todo 720×1280 Top 23 e Y 1568), então segue
  o tamanho do arquivo, não o que está no quadro. Doutor deitado continua
  manual (`app/LEIA-ME.md`).
- **Áudio do broll.** Ele desvincula e apaga — igual ao código.
- **Quantidade e duração (gabarito, variações 1–3).** 14, 15 e 8 brolls;
  cobrem 54%, 61% e 46% da variação. Duração de 0,6 a 4,9 s (mediana
  2,1 a 3,4 s). Numa lista falada ("hormônio / circulação / sono /
  estresse / medicamentos") é um clipe por item, de 0,6 a 1 s. Muitos vão
  colados, sem respiro (6 na variação 1, 8 na 2). Um clipe atravessa
  frase e cobre até 5 s de fala. Abre com broll no 0 s quando a variação
  começa com gancho (1 e 3); na 2 o último vai até o fim, no "Clica no
  link". Contra o planejador (`ferramentas/auto-broll/src/plano.ts`): o
  programa deu 6 na variação 1, e mesmo o `REGRAS_DENSAS` (1,2 a 3 s, sem
  passar do fim da frase) deixaria de fora 16 dos 37 clipes só pela
  duração. **Variações 4–6 (save das 15:15):** 9, 12 e 12 brolls, cobrindo
  45%, 71% e 52%; o padrão se repete. **Desde 28/09 a densidade máxima monta
  como ele:** o broll vai até o próximo (ou até o fim da fala), atravessando
  a frase. Nas 6 variações, 61 brolls contra 70 dele (antes 49), 55 no mesmo
  ponto e 61% do tempo de broll dele coberto (antes 51%). Item de lista
  abaixo de 1,2 s continua de fora: com piso menor, o planejador picotava
  frase normal (`plano.ts`, `ateOProximo`).
- **Conceito (29/09, variações 1–6).** O planejador acerta o ponto (53 de
  58), mas o conceito bate com o do Leo em 26. As trocas são gosto dele:
  "a ereção falhou" e "a coragem vai só até a metade" → Desanimado (não
  Viagra ou Frustrado); "a consulta é por telemedicina" → Teleconsulta;
  "Eu sou médico focado…" empata Doutor e Corpo do homem em 100% e ele usa
  Doutor em 4 de 5. Há também nome repetido na biblioteca ("14.000 mil
  homens" e "Milhares de homens" são a mesma imagem). Deixar vencer o
  candidato colado de score maior não mudou nada (26 → 25). Quem ensina é o
  **Aprender**, clicado depois de cada variação acabada.
- **O que ele fez com a sugestão do painel.** Nas variações 2 e 3 o que
  estava na V2 antes dele (tela cheia, sem crop — o jeito do painel) dá
  o antes e depois. Das 14 colocações, 10 ficaram no mesmo ponto com o
  mesmo conceito (2 com outro take e a duração quase sempre ajustada), 3
  mudaram de conceito (Viagra em "a ereção falhou" → Desanimado; Frustrado
  em "a coragem vai só até a metade" → Desanimado; Consulta médica em "a
  consulta é por telemedicina" → Teleconsulta) e 1 saiu (Viagra em "Dessa
  vez não apaga"). Ele acrescentou 7 na variação 2 e 3 na 3: o sentimento
  da parceira ("ela sentiu", "ele não me valoriza"), cada item de lista,
  "todos os meus pacientes"/"o que eu vejo no consultório" → Doutor,
  "15.000 homens" → Milhares de homens, gancho e fim. Ou seja: o painel
  acerta onde põe, mas põe de menos.
- **Escolha do clipe.** Ele percorre `Brolls - 2026` no Explorer pelas
  miniaturas, pulando pela inicial do conceito. Quando o clipe serve mas o
  nome não diz isso, renomeia com o que a legenda fala: "14.000 mil homens
  (1)" virou "homens tratados (1)" pra cobrir "...15.000 homens tratados".
  O renome foi **no painel Projeto**, não no disco: o arquivo continua
  "14.000 mil homens (1).mp4" (conferido em 28/09). O Aprender lia o nome
  do projeto, não achava o take na pasta e jogava o crédito fora; desde
  28/09 lê o nome do arquivo (`nomeDoArquivo` em
  `ferramentas/auto-broll/src/premiere.ts`).
- **Buraco na biblioteca.** Sem o conceito na pasta, ele busca no Envato
  Elements em português, com o filtro Vertical, e arrasta do navegador pra
  timeline. A maior parte das buscas é pela parceira: "mulher triste"
  (legenda "ele não me valoriza"), "mulher triste com o marido", "mulher
  pedindo atenção" e "mulher implorando" (essas duas sem achar nada que
  servisse; ele voltou pra pasta local). Também "homem dormindo" ("sono,
  estresse"); pra "separação" a pasta tem 4 clipes, mas ele buscou outro.
  O arquivo do Envato vem com nome em inglês
  ("man-sleeping-peacefully-in-bed-at-night-…"): o Auto B-roll só acha de
  novo se for pra `Brolls - 2026` com nome de conceito. No gabarito, 8
  dos 37 vieram de fora da pasta, todos em `Downloads`. Em 28/09 foram
  **copiados** (o projeto continua apontando pro `Downloads`) com estes
  nomes: casal afastado na cama → `Separação (5)`; as duas mulheres tristes
  → `Mulher triste (1)` e `(2)`; os dois homens dormindo → `Sono (1)` e
  `(2)` (é a palavra da legenda); comprimidos → `Medicamento (2)`; homem
  com a mão na cabeça → `Desanimado (9)`; homem no celular → `Celular (1)`.
  O Leo renomeia se quiser outro nome. Ficaram registrados no
  `trazidos.json` do painel, então o Aprender do Andro 19.09 credita essas
  colocações pelo nome da pasta, mesmo com a timeline usando os originais.
  Daqui pra frente o Aprender faz isso sozinho: clipe baixado e renomeado
  no painel Projeto é copiado pra pasta com esse nome
  (`ferramentas/auto-broll/docs/GUIA-DE-USO.md`). Download não gasta
  crédito: os "5 créditos" que aparecem no Envato são de IA, e a licença
  sai sozinha quando ele arrasta o clipe.
- **Light leak.** Clipe "Generated Light Leak" do Premiere Composer (plugin
  UXP instalado) na V3, por cima do broll. Ele gera um e copia/cola nos
  outros. **Regra medida (29/09, variações 1–6, 158 pedaços):** o leak inteiro
  (0,84 s, sem áudio) começa 0,36 s antes de cada troca doutor ↔ broll, na
  entrada e na saída; fica cortado em dois só porque ele corta todas as
  faixas na borda. Não entra entre dois brolls colados (28 de 28) nem no
  começo ou fim da variação. **Desde 29/09 o Editar faz isso** (`src/editar.ts`,
  `inicioDosLeaks`): 79 de 79 bordas iguais às dele.
- **Quadrado (1080×1080, medido em 29/09 no save das 11:55).** O Leo duplica
  a Reels e muda para 1080×1080. O doutor vai para a escala que cobre o
  quadrado (50% na bruta 4K), centrado; o subido do split (57%) volta para o
  centro. O B-roll fica em tela cheia, centrado e sem o Rounded Crop, a 180%
  (no 720×1280, 1,2x o que cobre; o mesmo 180 colado no 464×832 deixa faixa
  preta dos lados). Legenda, light leak e trilha iguais aos da Reels. O botão
  "Quadrado 1:1" do Auto Split faz isso (README, "Editar").
- **Trilha (medida em 29/09, 20 variações).** "stillness.WAV" na A2, uma por
  variação, sempre do 0 da música, começando e terminando exatamente com a
  variação, só ganho de clipe (sem efeito de volume): **−10 dB nas variações
  acabadas** (1–10 no save das 11:55) e −18 nas que ele ainda não mexeu. O
  Editar clona a da primeira variação para as que não têm (provado ao vivo em
  29/09, com o ganho junto); o `app/` usa −10 dB como padrão.

Os dois jeitos de legenda da Menopausa Cancelada:
1. Com os produtos na mesa: maiúscula condensada sobre uma faixa roxa.
2. Recente, estilo gravação pessoal (UGC):
   - minúscula, sem serifa;
   - palavra-chave maior e em negrito;
   - emoji (💧).

**Menopausa Cancelada Ads — medido no `.prproj` (29/09, criativos 07.09,
17.09, 18.09 e 28.09):** split com o **B-roll em cima** e a apresentadora
embaixo. O B-roll cobre a caixa de cima um pouco maior que ela (1,1 a 1,4x a
altura; 64% num 1920×1080 em sequência 720×1280) e o Rounded Crop corta
**embaixo** (Bottom) o que passa da borda, que fica em 37–52% da altura
(mediana 45%). Feather de 3 a 11, muda de projeto para projeto. A
apresentadora desce só enquanto o B-roll está na tela (Y de 0,50 para
0,77–0,91), até a borda de cima dela ficar 4–10% por baixo da borda do
B-roll, a mesma sobreposição do doutor deitado do Andro 19.09 (4%). A
legenda **não é faixa de legenda**: são gráficos de texto (90 no 28.09),
fora do alcance do Editar. O 07.09 é quadrado (1080×1080). Desde 29/09 o
split segue a empresa (`SPLIT_DA_EMPRESA` em `src/autosplit.ts`): Auto Split
do painel, Editar e Acabamento do `app/`. A pasta "Brolls - Menopausa"
(61 arquivos) e a "Brolls - Grandcare" (55) têm nome do Pexels ou número,
não de conceito: o Auto B-roll não acha nada nelas até serem renomeadas.

## Instagram (orgânico)

| | AndroClinic | GrandCare | Menopausa Cancelada |
|---|---|---|---|
| **Gancho** | capa com caixa azul da marca | caixa preta arredondada no topo: texto branco MAIÚSCULO + emoji, nos primeiros segundos | caixa branca com pergunta em preto, no topo, nos primeiros segundos |
| **Legenda** | palavras comuns pequenas e minúsculas; palavra-chave em MAIÚSCULA grande e negrito; às vezes destaque verde-amarelo em itálico | minúscula, branca, negrito e regular misturados; palavra-chave em amarelo e negrito; mantém a pontuação | minúscula em Helvetica Light; palavra-chave em MAIÚSCULA grande, Helvetica Bold; emoji no meio da frase (❤️) |
| **Posição** | na linha do split (meio da tela) | meio da tela | meio da tela, na linha do split |
| **Layout** | B-roll em cima, doutor embaixo | podcast: dois enquadramentos | B-roll 3D médico em cima e apresentadora embaixo; figurinha de produto |
| **Som** | ? | ? | lo-fi e hip-hop (Pixabay e `01. Assets`) + efeitos: câmera, porta, caixa registradora, fanfarra |
| **Animação** | ? | ? | Premiere Composer (light leak); 90 a 110 gráficos de texto por projeto |

**Menopausa Instagram — medido em 29/09 no reel "Queda de cabelo, pele seca e
dor?" (instagram.com/menopausa.cancelada/reel/DdyxdrfhCz9, 29,4 s, 1080×1920;
o mesmo roteiro do teste do Editar no "Projeto Base", 37 s → 30 s):**
- **Legenda:** minúscula, branca, sem caixa, 1 a 4 palavras ("você passa na
  pele", "de dentro pra fora"); a palavra que importa em **negrito**, as
  pequenas ("de", "nas", "que", "pra") mais finas e menores. Fica na linha do
  split quando tem B-roll, e mais baixa (altura do peito) sem B-roll.
- **Split com B-roll em cima** só no sintoma falado: "queda de cabelo",
  "cabelo que não cresce", "pele seca", "dor nas articulações", "ansiedade".
  O resto é a apresentadora em tela cheia.
- **Figurinha de produto:** foto recortada do produto com o nome embaixo, nos
  cantos de cima, entrando quando ela fala do produto e se acumulando (Óleo de
  alecrim / Óleo de rícino, Colágeno, Creme hidratante, Femme Healthy,
  Ômega 3, Gelol).
- **CTA no fim:** faixa roxa com "EU QUERO" em maiúscula e "COMENTA AGORA
  MESMO" embaixo, enquanto ela pede o comentário.
- O Editar, no teste de 29/09, fez só a parte de Ads: pausas e legenda de 1 a
  3 palavras, sem minúscula/negrito, sem split (a pasta "Brolls - Menopausa"
  não tem nome de conceito), sem figurinha e sem CTA.
- **Feito (29/09): tipo Instagram no Editar** (`perfil.json`, `tipo`). A
  legenda sai em minúscula, sem "?" no fim, com uma palavra em `<b>` (a mais
  longa que não é pequena: acerta "passa", "dentro", "toma", "cresce",
  "direct"; no título do sintoma o reel põe tudo em negrito) e até 24
  caracteres. Provado no Premiere: o `.srt` guarda `<b>`, `<i>` e cor;
  `<font face>` e `size` são ignorados; **o estilo de faixa apaga** o negrito e
  a cor, trocar a fonte pelo Properties não. Então no Instagram a fonte
  (Helvetica Light), o tamanho e a posição vão pelo Properties, com as
  legendas selecionadas. As figurinhas estão em
  `C:\Edição\1. Menopausa Cancelada\Criativos\04.09\O que passar X O que tomar - Imagens`.

Fontes lidas dos projetos:
- AndroClinic: Bebas Neue (1.299 legendas no `Andro 19.09`).
- Menopausa Cancelada: Helvetica Bold e Light, Arial Black.
- GrandCare: Bebas Neue nos Ads. O estilo do Instagram dela (amarelo, minúsculas) não aparece em nenhum projeto do Premiere — **feito no CapCut?**

## O que o Premiere deixa automatizar

- **Faixa de legenda.** Texto, tempo e faixa separada, como o preço de hoje, dá por código. O estilo da faixa continua manual (D-02) e a faixa não anima.
- **Palavra-chave em destaque (Instagram).** Mesma técnica do preço: as palavras-chave vão para uma segunda faixa com um estilo maior. Cor e negrito numa palavra *dentro* da legenda dependem de o Premiere aceitar `<b>` e `<font color>` no .srt — **a provar**.
- **Gancho.** Uma terceira faixa, com um estilo que tenha caixa de fundo, posicionada no topo.
- **Fora do alcance da faixa de legenda.** Animação (pop, light leak), emoji grande e figurinha de produto só entram por gráfico, .mogrt ou Premiere Composer.

## Plano

1. **Seletor de perfil no Editar**: empresa + tipo, lembrando a última escolha. Cada perfil guarda:
   - biblioteca de B-roll;
   - lado do B-roll no split (embaixo nos Ads, em cima no Instagram);
   - segmentação da legenda (Ads: maiúscula, 1 a 3 palavras, sem pontuação; Instagram: minúscula, com pontuação);
   - faixas e nomes dos estilos;
   - trilha e logo;
   - termos do ElevenLabs.

   **Feito em 29/09, só a empresa:** o Editar tem a lista AndroClinic /
   GrandCare / Menopausa Cancelada (`perfil.json`). Cada uma tem a sua pasta
   de B-roll ("Brolls - 2026", "Brolls - Grandcare", "Brolls - Menopausa",
   no Downloads) e os seus termos do ElevenLabs, também usados pelo cartão
   Pro Captions e pela tela Legendas do programa (`EMPRESAS` em
   `ferramentas/pro-captions/src/preset.ts`). Os da GrandCare e da Menopausa
   saíram das legendas revisadas dos projetos delas: marca, Edemilson Banach,
   Reset 90, Femme Healthy, termos de saúde. Trilha e light leak não precisam
   de perfil: o Editar copia o que já está no projeto. O **lado do split**
   também é da empresa (a Menopausa põe o B-roll em cima), não do tipo. O
   **tipo** (Ads/Instagram) continua sem gabarito: o único orgânico no disco
   ("Orgânico", Menopausa) não tem split nem faixa de legenda, só a
   apresentadora com zoom 100/150, gráficos de texto e light leak.
2. **Instagram**: faixa de destaque para as palavras-chave e faixa de gancho.
3. **Animações**: depois, por .mogrt; decisão do Leo.
