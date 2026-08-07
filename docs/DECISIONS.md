# DECISIONS

Registro de decisoes com data, contexto e consequencia. Decisao sem prova real
fica marcada como **provisoria**.

---

## D-001 — Fase 0 sem etapa de build (2026-08-06) — firme

**Contexto.** O CLAUDE.md coloca TypeScript, lint e testes na Fase 1. A Fase 0 so
precisa carregar um plugin e medir APIs.

**Decisao.** `index.html` + `proofs.js` em JavaScript puro, carregados direto pelo
UXP Developer Tool. Sem bundler, sem transpilacao.

**Consequencia.** Zero tempo perdido em toolchain antes de saber se as APIs
funcionam. `jsconfig.json` com `checkJs` + tipagens `@adobe/premierepro` dao
autocomplete no editor sem exigir build. A migracao para TS acontece na Fase 1,
quando o codigo de produto comeca.

---

## D-002 — `manifest.json` sem permissao de rede (2026-08-06) — firme

**Contexto.** O exemplo oficial de manifest inclui `"network": { "domains": "all" }`.
O produto e explicitamente offline (CLAUDE.md secoes 1 e 3).

**Decisao.** Omitir `network` de `requiredPermissions`. Manter apenas
`"localFileSystem": "request"` (necessario para o usuario escolher a pasta de B-rolls).

**Consequencia.** O proprio manifesto vira garantia tecnica da promessa de
privacidade — o plugin fica incapaz de enviar midia ou transcricao para fora. Se
alguma dependencia futura exigir rede, a decisao precisa ser reaberta e aprovada
explicitamente, nao contornada.

---

## D-003 — Premiere 2026 (26.3.2) como unico alvo (2026-08-06) — firme

**Contexto.** A maquina tem 25.6.6 e 26.3.2 instalados. O minimo do projeto e 26.2.

**Decisao.** `minVersion: "26.2.0"` no manifest. Nao dar suporte ao 2025.

**Consequencia.** Plugins hibridos UXP so sao oficialmente suportados a partir do
26.2; suportar o 25.x exigiria um caminho CEP/ExtendScript paralelo. Custo alto,
beneficio nenhum para este usuario.

---

## D-011 — Fatia vertical em vez da ordem das fases (2026-08-06) — firme

**Contexto.** Fechada a Fase 0, o CLAUDE.md previa Fase 2 (snapshot completo),
depois 3 (transcricao com todos os casos dificeis), depois 4, 5, 6, 7.

**Decisao do usuario.** Construir uma fatia fina que atravessa tudo —
transcricao, casamento, plano, insercao — antes de completar qualquer fase.

**Por que.** O risco real do produto nao era tecnico, era **se as sugestoes
fazem sentido**. Tudo o mais estava provado ou era mecanico. Seguir a ordem
significaria descobrir isso depois de semanas de trabalho.

**Consequencia.** As fases 2 a 4 existem em versao minima e funcionando. Os
casos dificeis (nested, multicam, speed) continuam sem cobertura e estao
listados como pendencia no BUILD_STATUS.

---

## D-012 — Casamento e texto contra texto, nao visao computacional (2026-08-06) — firme

**Contexto.** O CLAUDE.md secoes 3 e 10 previam frames-chave, embeddings
visuais, ONNX e addon C++ para indexar a biblioteca.

**O que mudou.** Medicao: 260 arquivos, **32 conceitos distintos**, com nomes
escritos por gente e no mesmo vocabulario da fala ("Falhou na cama",
"Teleconsulta", "Vasos sanguineos").

**Decisao.** Os nomes dos arquivos SAO as etiquetas semanticas. O casamento e um
problema de texto contra texto sobre 32 rotulos.

**Consequencia.** Saem do MVP: extracao de frames-chave, embedding visual,
modelo ONNX de visao e o addon nativo para inferencia. Nao ha modelo nenhum
rodando — e aritmetica de texto.

O degrau seguinte, se precisar, e **embedding de TEXTO**, nao de imagem.

---

## D-013 — Como o casamento evoluiu, e o que cada degrau custou (2026-08-06) — firme

Tres mecanismos, cada um adicionado por caso medido, nao por suposicao:

**1. Raiz por prefixo comum (minimo 6 letras).** "frustracao" e "frustrado"
dividem "frustra". Nao e "uma palavra e prefixo da outra" — elas nao sao. O
minimo e 6 porque 5 juntaria "consulta" com "consumo".

**2. Peso por raridade.** Termo presente em muitos conceitos vale menos.
"homem" aparece em tres conceitos; casar so por ele da 0,25 e cai fora do corte.
Matou o ruido de "Corpo do homem" casar com quase toda frase, sem regra manual.

**3. Sinonimos (37 entradas).** Ligam o que a pessoa FALA ao que o arquivo se
CHAMA. A fala diz "disfuncao eretil" e "telemedicina"; os arquivos se chamam
"Viagra" e "Teleconsulta" — eram **130 arquivos, metade da biblioteca**,
inalcancaveis.

**Armadilha do dicionario, cometida e corrigida:** sinonimo tem de ser A MESMA
COISA, nao palavra que aparece junto. Colocar `homem` como sinonimo de `corpo`
fez "Corpo do homem" voltar a casar 100% com qualquer frase que dissesse
"homem". Idem para `bem`, `sem`, `novo`.

---

## D-014 — Colocacao ancorada na palavra (2026-08-06) — firme

**Contexto.** O B-roll entrava no inicio da frase. Numa frase de 8 segundos, a
imagem de "Viagra" aparecia ate seis segundos antes de "disfuncao eretil" ser
dito.

**Decisao.** A transcricao tem tempo por palavra — usar. `Frase` carrega
`termosNoTempo`, e o corte entra **0,3s antes da palavra que casou**.

Duas passadas ao procurar a ancora: primeiro a palavra literal, depois o
sinonimo. Sem isso, uma frase que comeca com "o problema e..." ancorava no
inicio, porque "problema" e sinonimo de "frustrado".

**Consequencia adicional:** cada sugestao virou um candidato proprio com sua
propria ancora, entao **uma frase longa rende varios B-rolls** em momentos
diferentes. Antes rendia um so. Densidade maior sem afrouxar limite de
qualidade.

---

## D-015 — Resolucao vem do cabecalho MP4 (2026-08-06) — firme

**Contexto.** Sem a resolucao da fonte nao da para calcular a escala de
preenchimento. `ProjectItem` nao expoe largura/altura; `Media` so tem
start/duration; `FootageInterpretation` so tem frame rate. **O XMP foi tentado
e falhou nos arquivos reais** — os tres B-rolls inseridos reportaram "resolucao
indisponivel" e entraram a 100% num quadro 1080x1920 sendo 720x1280.

**Decisao.** Ler os bytes do arquivo e extrair `width`/`height` do box `tkhd`
(`src/mp4.ts`).

**Validacao:** 260 de 260 arquivos lidos, zero falhas, resultado identico ao que
o Windows reporta (136 / 121 / 3).

**Consequencia.** Resolve tambem a pendencia D-009 e entrega pronto o leitor que
o indexador da Fase 5 vai precisar. D-009 fica **superada**.

---

## D-016 — Aprendizado por sobrevivencia, sem botao e sem modelo (2026-08-07) — provisoria

**Contexto.** O plugin acertava as sugestoes obvias e errava nas de borda, e nao
tinha como saber a diferenca. As opcoes eram: pedir nota ao usuario, treinar um
modelo, ou ler o sinal que ja existe.

**Decisao.** Ler o sinal que ja existe. O plugin grava o plano que inseriu
(`pendentes.json`); na analise seguinte le a faixa de destino e compara por nome
de arquivo. Quem sobreviveu foi acerto, quem sumiu foi erro. As contagens ficam
por par **conceito-palavra** (`aprendizado.json`), e viram um multiplicador do
score aplicado ANTES do corte de qualidade.

`fator = 1 + 0,15 x (acertos - erros)`, preso entre 0,5 e 1,5, com media entre os
pares da sugestao. Numeros escolhidos para que **tres exclusoes** derrubem um
casamento de 70% abaixo do corte de 60% — rapido o bastante para o usuario
perceber o efeito na mesma semana, lento o bastante para um Ctrl+Z distraido nao
apagar um conceito bom. Os limites impedem que o historico zere ou promova
qualquer coisa sozinho.

**Por que par conceito-palavra, e nao conceito.** "Tempo" casando com "bomba
relogio" e outra decisao que "Tempo" casando com "demora". Punir o conceito
inteiro por causa de um contexto ruim mataria o outro junto.

**Consequencias e o que fica em aberto:**

- O pendente sai da lista na mesma rodada em que e contado. Sem isso, rodar a
  analise duas vezes sem editar nada contaria o mesmo acerto de novo.
- Um pendente **por sequencia**: analisar o corte B nao pode jogar fora o
  julgamento ainda nao lido do corte A.
- Falha ao ler a faixa ou ao gravar mantem o plano pendente para a proxima
  rodada. Adiar o aprendizado e sempre melhor que contar errado.
- **Nao distingue "ruim" de "nao coube".** B-roll apagado por conflito de
  montagem conta como erro semantico igual. Aceito: o volume de casos corrige o
  vies, e a alternativa exigia perguntar ao usuario.
- **Nao ve o que foi movido ou aparado.** So presenca por nome. Comparar posicao
  daria um sinal mais fino e nao vale o custo antes de haver caso medido.

**Provado no Premiere real (2026-08-07, sequencia "Reels", 62s).** Ciclo completo
numa unica rodada: inseriu 5, o usuario apagou 2 na timeline, a analise seguinte
leu V2 e contou `3 mantidos e 2 apagados`. `aprendizado.json` gravou os seis pares
com o saldo certo, e o plano novo saiu com `aprendizado +15%` nos tres mantidos e
`-15%` nos dois apagados. Nenhum ajuste foi preciso na logica.

O unico defeito apareceu na apresentacao: o resumo era registrado no comeco do
log, que rola sozinho para o fim, e sumia da tela. Corrigido — vai no `finally`,
por ultimo. Registrado na secao 8 das armadilhas.

Continua provisoria: **o mecanismo esta provado, o passo de 0,15 nao.** Uma
rodada nao diz se derrubar um casamento exige tres exclusoes ou deveria exigir
duas. So o uso continuado responde.

---

## D-017 — Apagar troca o take, nao derruba o assunto (2026-08-07) — firme

**Contexto.** Na primeira rodada real do aprendizado (D-016) os dois B-rolls
apagados **voltaram na analise seguinte**, o mesmo arquivo no mesmo lugar. Correto
pela regra — uma exclusao e evidencia fraca, 100% cai para 85% e continua acima
do corte — e ruim de usar: a impressao e que o plugin ignorou a edicao.

**A leitura errada seria acelerar o castigo.** Subir o passo de 0,15 para 0,25
faria duas exclusoes derrubarem o conceito, e junto com ele o assunto inteiro.

**O que apagar realmente significa.** Quase nunca "esse assunto nao cabe aqui" —
quase sempre "esse plano especifico nao serviu". O conceito estava certo; o take
e que nao.

**Decisao.** Uma segunda contagem, por **arquivo**. O planejador escolhe entre as
variacoes disponiveis do conceito pelo saldo: o apagado cede a vez ao proximo. O
score continua sendo trabalho dos pares conceito-palavra.

**Consequencias.**

- Apagar tem efeito **na proxima analise**, nao depois de tres — mas o efeito e
  trocar o plano, nao perder o assunto.
- Conceito com um arquivo so continua entrando com ele. Derrubar e trabalho do
  score, nao da escolha de take, e forcar aqui deixaria o conceito sem nada.
- O motivo passa a dizer `· outro take, o anterior foi apagado`. Divergir do
  primeiro disponivel so acontece por historico: sem ele todos empatam em zero.
- `Memoria` vai para schema 2. Ler o schema 1 nao precisou de caso especial: a
  ausencia de `arquivos` ja significa "nenhum dado ainda". O historico de
  conceitos ja acumulado sobreviveu a atualizacao.

---

## D-018 — O que voce coloca na mao tambem ensina (2026-08-07) — provisoria

**Contexto.** D-016 e D-017 so ouviam metade da edicao: o plugin julgava o que
ele mesmo inseriu. Um B-roll arrastado a mao ficava na faixa e era ignorado —
nem acerto, nem erro. E ele e o sinal mais forte que existe: apagar diz *isto
nao serviu*; colocar diz *era isto que faltava*, com arquivo e instante.

**Decisao.** Uma leitura so da faixa de destino alimenta as duas coisas. O que
esta na faixa e nao estava no plano foi o usuario quem pos: acha-se a frase que
estava sendo dita naquele instante e creditam-se os pares conceito-palavra que
ligam a fala ao conceito escolhido, mais o arquivo (era aquele take que ele
queria ver).

**A ordem do painel teve de inverter.** Analisar primeiro, julgar depois: para
saber o que estava sendo dito no instante da colocacao e preciso ter as frases,
e elas so existem depois da analise. O planejamento continua por ultimo, porque
so ele depende da memoria. `Analise` passou a devolver `frases` e `conceitos`
como listas em vez de contagens — quem conta, conta com `.length`.

**O caso interessante e quando nada liga.** O usuario escolheu um conceito que o
dicionario nao conecta com a fala. Contagem nao resolve isso: ela ajusta peso,
nao inventa ligacao (D-016). Entao vira **sugestao escrita** — *"voce colocou
'Vasos sanguineos' onde se diz X — falta sinonimo?"* — e essa e a materia-prima
da pendencia 3, tirar o dicionario do codigo. De proposito essas sugestoes **nao**
entram em `vistos`: reaparecem a cada analise ate alguem resolver, e no dia em
que o sinonimo existir a mesma colocacao vira credito.

**Consequencias e limites:**

- `Memoria` vai a schema 3, com `vistos`. Um B-roll colocado a mao fica na
  timeline para sempre; sem a marca, toda analise o creditaria de novo. Mesma
  disciplina do plano pendente.
- A marca e `sequencia|arquivo|segundo`. Mover o clipe de lugar cria chave nova e
  credita outra vez — aceito: mover e reafirmar a escolha.
- **Aproximacao conhecida:** um B-roll que o plugin inseriu, o usuario manteve, e
  que a rodada seguinte nao replanejou aparece como manual e ganha um credito
  extra. `vistos` limita a uma vez, e sobreviver a varias rodadas e de fato
  endosso — nao vale mais contabilidade que isso.
- B-roll sobre silencio e arquivo fora da biblioteca sao ignorados: nao ha fala
  para ligar, e chutar o conceito seria pior que nao contar.

Provisoria pelo mesmo motivo do D-016: nunca rodou dentro do Premiere.

---

## D-008 — Ferramental da Fase 1: esbuild e `node --test`, nada alem (2026-08-06) — firme

**Contexto.** A Fase 1 pede TypeScript, lint e testes. O caminho habitual seria
webpack + jest + ts-jest + ts-node + eslint, com dezenas de dependencias.

**Decisao.**

| Necessidade | Escolha | Por que nao o obvio |
|---|---|---|
| Empacotar o painel | **esbuild** (1 dep) | webpack/rollup pedem config e plugins para o mesmo resultado |
| Rodar testes | **`node --test`** nativo | o Node 24 executa `.ts` direto; jest exigiria ts-jest + babel |
| Checar tipos | **`tsc --noEmit`** | - |
| Lint | **adiado** | ver abaixo |

`npm run verify` roda os tres em sequencia. Total de dependencias de
desenvolvimento: quatro.

**Sobre o lint.** O CLAUDE.md secao 5 lista ESLint como entrega da Fase 1, com a
ressalva "quando compativeis". Nao foi instalado: em TypeScript estrito com
`noUncheckedIndexedAccess` e `exactOptionalPropertyTypes`, o `tsc` ja pega a
maior parte do que o ESLint pegaria, e o resto e estilo — que nao tem quem
divergir num projeto de um desenvolvedor. **Isso e uma entrega reduzida de
proposito, nao um esquecimento.** Adicionar quando houver segunda pessoa no
codigo ou a primeira discussao de estilo.

---

## D-009 — Resolucao da fonte vem do XMP (2026-08-06) — **SUPERADA por D-015**

Falhou nos arquivos reais: o XMP nao traz `videoFrameSize` nesta biblioteca.
Mantida aqui como registro de tentativa, para ninguem repetir.

**Codigo removido em 2026-08-07.** `parseFrameSizeFromXmp` e seus quatro testes
sairam de `src/domain.ts` e `tests/domain.test.ts`. Ficavam verdes no `npm test`,
o que dava a impressao de codigo em uso — quando o que exercitavam era um caminho
provado impossivel. O registro de que foi tentado mora aqui, que e o lugar dele.

---

## D-009 (original) — Resolucao da fonte vem do XMP — provisoria

**Contexto.** Escalar para preencher exige saber a resolucao do arquivo, e
`ProjectItem` nao expoe largura nem altura. `Media` so tem start/duration;
`FootageInterpretation` so tem frame rate, pixel aspect e field type.

**Decisao.** Ler `Metadata.getXMPMetadata(projectItem)` e extrair
`xmpDM:videoFrameSize` com `parseFrameSizeFromXmp()`. Aceita forma de atributo
(`stDim:w="720"`) e de elemento (`<stDim:w>720</stDim:w>`), porque varia por codec.

**Consequencia.** Quando o XMP nao traz a dimensao, a insercao **nao escala e
avisa**, em vez de chutar — escala errada corta a imagem no lugar errado, o que e
pior que nao escalar.

Provisoria: a funcao esta testada com XMP sintetico, mas nao com um arquivo real
passando pelo Premiere. A Fase 5 pode tornar isso irrelevante: o indexador vai
varrer a biblioteca com o addon nativo e guardar a resolucao no indice, sem
depender do XMP.

---

## D-010 — Painel usa a gramatica da timeline (2026-08-06) — firme

**Contexto.** O usuario pediu um painel "mais simetrico e organizado, responsivo".

**Decisao.** Cada bloco e uma **faixa** com canaleta fixa de 46px a esquerda
carregando o codigo da faixa em monoespacada (`SEQ`, `V2`, `A3`, `SRC`, `LOG`) —
a mesma leitura do cabecalho de faixa da timeline. As canaletas usam as cores que
o Premiere da aos clipes: violeta para video, verde para audio.

**Consequencia.** A canaleta nao e enfeite: `V2` e `A3` mostram a faixa de destino
configurada e mudam junto com os campos, entao a configuracao fica legivel de
relance. A responsividade sai de `repeat(auto-fit, minmax(...))` nos dois blocos
de faixa e na grade de fatos — as faixas ficam lado a lado quando ha largura e
empilham quando nao ha, sem media query nem largura magica.

---

## D-005 — UXP DevTools por CLI, nao pelo app grafico (2026-08-06) — firme

**Contexto.** O app **Adobe UXP Developer Tool** so se instala pelo Creative Cloud
Desktop, com cliques. Existe a CLI oficial `@adobe/uxp-devtools-cli` (1.2.0,
atualizada em 2026-07), que cobre `plugin load/reload/watch/debug/validate/package`.

**Decisao.** Usar a CLI. O app grafico nao sera instalado.

**Consequencia.** Ciclo de desenvolvimento scriptavel: `uxp plugin reload` em vez de
clicar. `uxp plugin package` cobre a geracao do `.ccx` na Fase 8. Nenhuma etapa
manual de GUI no fluxo de build.

**Armadilha registrada — a instalacao quebra em Node 24.** O `postinstall` do
`@adobe/uxp-devtools-helper` falha (`Cannot find module 'tar'`), e sem ele a CLI
morre com `No native build was found ... abi=137`. Sequencia que funciona:

```powershell
npm install -g @adobe/uxp-devtools-cli --ignore-scripts
$h = "$env:APPDATA\npm\node_modules\@adobe\uxp-devtools-cli\node_modules\@adobe\uxp-devtools-helper"
New-Item -ItemType Directory -Force "$h\build"
tar -xzf "$h\scripts\native-libs\DevtoolsHelper-v1.0.0-node-win32.tar.gz" -C "$h\build"
uxp service start
```

O binario nativo e N-API (`node-napi.node`), portanto estavel entre versoes de
Node — o unico problema era o script de setup, nao o binario. Se um dia migrarmos
para uma maquina nova, repetir esses quatro comandos.

---

## D-007 — Instalacao por pasta `External`, nao pelo servico de desenvolvimento (2026-08-06) — firme

**Contexto.** Nem a CLI nem o app UXP Developer Tools conseguiram fazer o Premiere
26.3.2 conectar ao servico da porta 14001. Cinco reinicios, servico no ar, flag
habilitada, host nunca apareceu em `uxp apps list`.

**O que destravou.** O log do proprio Premiere
(`%APPDATA%\Adobe\Premiere Pro\Logs\UXPLogs_*.log`) mostra que ele varre uma pasta
local no boot, sem depender de servico nenhum:

```
upic::Loading plugins from system fallback plugins folder:
      C:\Program Files\Common Files\Adobe\UXP\Plugins\External
upic::Number of plugins added from system's fallback: 1
```

**Decisao.** Instalar por symlink de diretorio:

```
C:\Program Files\Common Files\Adobe\UXP\Plugins\External\com.leogi.autobroll
  -> C:\Users\leogi\Desktop\auto-broll-premiere
```

Criado uma vez, com administrador (`scripts/install-link.ps1`). Editar o repositorio
passa a refletir direto no plugin; so e preciso reiniciar o Premiere para recarregar.

**Consequencia.** Fluxo de desenvolvimento sem servico, sem app grafico e sem
empacotamento. A CLI `@adobe/uxp-devtools-cli` continua util so para
`uxp plugin package` na Fase 8 — nao para carregar em desenvolvimento.

**Pre-requisitos reais, descobertos na marra:**

1. `C:\Program Files\Common Files\Adobe\UXP\Developer\settings.json` precisa conter
   `{"developer": true}`. E o que `uxp devtools enable` grava, e por isso pede
   administrador. Sem isso o plugin nao assinado e recusado.
2. O manifest **nao pode ter `"icons": []`**. Premiere rejeita com
   `Expected atleast a single entry in the icons list` e o plugin nao carrega.
   Com `scale: [1, 2]` ele procura `icon@1x.png` e `icon@2x.png` — o nome sem
   sufixo nao serve para a escala 1.
3. O Premiere so le essa pasta na inicializacao. Plugin novo ou manifest alterado
   exigem reiniciar o Premiere; alterar apenas HTML/JS tambem, ja que nao ha
   servico de reload ativo.

---

## D-006 — Biblioteca de B-rolls e pequena (2026-08-06) — provisoria

**Contexto.** `C:\Users\leogi\Downloads\Brolls - 2026`: 260 arquivos `.mp4`,
0,58 GB no total, pasta plana sem subpastas, media de ~2,3 MB por arquivo.

Resolucoes medidas nos 260 arquivos (2026-08-06):

| Resolucao | Arquivos | Escala para preencher 1080x1920 |
|---|---|---|
| 720x1280 | 136 (52%) | 150% |
| 464x832 | 121 (47%) | 233% |
| 1080x1920 | 3 (1%) | 100% |

Todos verticais. **99% sao menores que a sequencia**, entao "preencher a tela"
significa **ampliar**, nao enquadrar. Os 464x832 sobem 2,33x e vao ficar visivelmente
moles ao lado do material de camera (que e iPhone em 1080x1920).

Consequencia de produto: **resolucao vira criterio de ranking**, nao detalhe de
render. O componente `qualidadeTecnica` da formula da secao 11 do CLAUDE.md deve
penalizar 464x832 sempre que houver alternativa em 720x1280 com score semantico
proximo. Isso nao e otimizacao prematura — e quase metade da biblioteca.

Aspecto: 720/1280 = 0,5625 = 9:16 exato. 464/832 = 0,5577, levemente mais estreito.
A escala de preenchimento e `max(1080/w, 1920/h)`, com corte vertical desprezivel.

**Decisao.** Dimensionar a Fase 5 para essa ordem de grandeza: dezenas a poucas
centenas de clipes curtos, nao uma biblioteca de terabytes.

**Consequencia.** Reindexacao completa provavelmente custa segundos, nao horas.
Isso **nao** dispensa o scan incremental — ele continua sendo o gate da Fase 5 e
protege quem tiver biblioteca maior — mas dispensa qualquer otimizacao agressiva,
banco vetorial externo ou paralelismo complexo no MVP. Um indice simples em
arquivo, carregado inteiro na memoria, cabe com folga.

Marcada como provisoria: o tamanho medio sugere clipes curtos, mas a duracao real
nao foi medida. Se forem clipes longos comprimidos, a segmentacao em multiplos
shots por arquivo (CLAUDE.md secao 10) pesa mais do que o numero de arquivos indica.

---

## D-004 — Arquitetura do addon nativo e do motor de IA: adiada (2026-08-06) — provisoria

**Contexto.** CLAUDE.md secao 15 item 6 manda esperar resultados reais antes de
decidir addon e transcricao. O hardware disponivel (RTX 3050 6 GB, 16 GB RAM) cabe
em modelos de embedding pequenos, mas nada disso importa antes de saber se a
transcricao e sequer acessivel.

**Decisao.** Nenhuma escolha de ONNX Runtime, modelo de embedding, banco vetorial
ou formato do `.uxpaddon` antes do relatorio da Fase 0. As pastas `native/` e
`src/` nem sao criadas ainda — pasta vazia e promessa, nao arquitetura.

**Consequencia.** O resultado de P3.1/P3.3/P3.4 muda o produto inteiro: se nao
houver transcricao acessivel, o escopo do MVP precisa ser renegociado antes de
qualquer linha de C++.
