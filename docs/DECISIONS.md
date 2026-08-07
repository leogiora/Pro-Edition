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

## D-019 — Intensidade escolhe o take; o nome nunca poderia (2026-08-07) — provisoria

**Contexto.** O D-012 apostou que os nomes de arquivo sao os rotulos semanticos,
e a aposta se pagou — para escolher o ASSUNTO. Para escolher o TAKE ela nao tem o
que dizer, e a razao e aritmetica:

| Conceito | Takes |
|---|---|
| Viagra | 43 |
| Doutor | 38 |
| Frustrado | 37 |
| Teleconsulta | 25 |
| Falhou na cama | 24 |

**Cinco conceitos concentram 167 dos 260 arquivos.** Os 43 clipes chamados
"Viagra" nao passam a mesma sensacao, e o nome nao os distingue porque e o mesmo
nome. Doze conceitos tem arquivo unico e nunca sofreram disso.

**Por que o aprendizado sozinho nao resolvia.** `melhorArquivo` (D-017) escolhe o
maior saldo: um take em `+1` vence para sempre 42 takes em `0`. O plugin trava no
primeiro que deu certo e nunca mostra os outros. Precisava entrar informacao por
arquivo vinda de fora do historico.

**Decisao.** Duas medidas, nenhuma delas um modelo:

1. **Agitacao do clipe** — media de bytes por quadro dividida pelos pixels, lida
   da tabela `stsz` do proprio MP4. Movimento obriga o codificador a gastar mais
   bits. Nada e decodificado; e a mesma caminhada por boxes que ja lia a
   resolucao.
2. **Ritmo da fala** — palavras por segundo da frase. Ja estava calculado.

**Comparacao so por percentil, nunca por escala absoluta.** Cada take vira sua
posicao entre os irmaos do mesmo conceito; cada frase, sua posicao entre as
frases da sequencia. Isso dispensa calibracao e cancela vies de codificador e de
resolucao — comparar bytes crus entre um 464x832 e um 720x1280 nao diria nada.

**A intensidade filtra, o historico escolhe.** Nessa ordem, e nao na inversa: com
o historico mandando, os cinco conceitos grandes ja teriam favorito e a
intensidade nunca seria consultada. Destrava o D-017 de brinde — momentos de
ritmos diferentes abrem pools diferentes, e takes nunca usados voltam a aparecer.

**Consequencias e limites:**

- Nenhum encaixe cai de volta para todos os disponiveis. Intensidade nunca pode
  custar uma colocacao boa, e ha teste disso.
- Take que nao pode ser medido nunca e excluido: ausencia de informacao nao e
  informacao negativa.
- Conceito de um take so recebe percentil 0,5 e continua elegivel sempre.
- Sem medida chegando, o plano sai **identico** ao de antes — tambem testado.
- `toleranciaIntensidade` mora em `RegrasPlano`, com `antecipacao` e
  `janelaSemRepetir`. Comeca em 0,35. E botao, nao constante: apertar se entrar
  take fora de clima, afrouxar se muita colocacao cair no fallback.
- Primeira analise le 0,6 GB para medir. Depois, `intensidade.json` responde. E o
  indexador da Fase 5 chegando cedo e em miniatura.
- **Chave do cache e so o nome do arquivo.** Comparar tamanho exigiria
  `getMetadata()` em 260 entradas, e chamada UXP em volume e o que pendura o
  painel. Trocar um arquivo mantendo o nome pede apagar `intensidade.json`.

**O limite que importa: movimento nao e emocao.** Isto separa take agitado de
take parado, nao esperancoso de sombrio. Um fundo estatico mas visualmente
ocupado le como agitado; um close parado num rosto le como calmo, e esse acerta.
Clima exigiria os pixels — a opcao descartada nesta rodada, que continua sendo o
degrau seguinte se a agitacao sozinha nao bastar.

Provisoria: nunca rodou dentro do Premiere. Spec em
`docs/superpowers/specs/2026-08-07-intensidade-do-take-design.md`.

---

## D-020 — Quatro consertos vindos do uso real (2026-08-07) — firme

O usuario relatou que colocou B-rolls, apagou outros, e "nada foi aprendido". O
`aprendizado.json` mostrou que tres coisas diferentes estavam erradas e uma
quarta so parecia.

**1. So a V2 era lida.** `lerClipes(1)` ignorava V3 em diante. Empilhar na V3 e o
que qualquer editor faz quando nao quer sobrescrever, e tudo que o usuario punha
la era invisivel: nem acerto, nem erro, nem aviso. Agora `lerBrollsAcimaDeV1()`
varre todas as faixas acima da V1 — a V1 fica de fora porque e a camera principal
e a fonte da transcricao. Ganho colateral: clipe MOVIDO de faixa deixa de contar
como apagado.

**2. Silencio se parecia com falha.** O credito manual so escrevia no log quando
`creditados > 0`. Como `vistos` impede recontar, a segunda analise ficava muda — e
mudez, para quem esta olhando, e identica a nao ter funcionado. **Segunda vez que
este projeto tropeca nisto** (a primeira foi o resumo que rolava para fora da
tela). Agora sempre sai uma linha, inclusive `0 aprendidos, 5 ja contados antes`.

**3. A esteira de auto-confirmacao.** Cada clique em *Analisar e inserir* gravava
um pendente; o clique seguinte encontrava tudo la — porque o clique anterior
acabara de inserir — e contava uma rodada inteira de sobrevivencias. Sem ninguem
editar nada. Medido no arquivo real: `Falhou na cama|cama` chegou a **106 acertos
contra 19 erros**, e `Viagra|viagra` a 66 contra 10.

O guarda do D-016 impedia julgar o mesmo pendente duas vezes; nao impedia o ciclo
inserir → julgar → inserir. Agora, se nada foi apagado e nada foi colocado desde o
plano anterior, a rodada nao conta e o painel diz por que.

Custo aceito: quem revisa e aprova os seis sem mexer em nada perde esse elogio
fraco. Nao ha como distinguir isso de um segundo clique, e inventar sinal e pior
que perder um.

**4. Historico fossilizado.** Com 106 contra 19, uma exclusao do usuario nao movia
mais nada — o fator ja estava no teto de +50%. Agora, passando de **20 eventos**,
as duas contagens sao divididas pela metade: preserva a proporcao aprendida e
devolve peso ao que acabou de acontecer. O `aprendizado.json` contaminado se
normaliza sozinho no primeiro evento novo de cada par.

**O que NAO estava errado:** `manteve 0 e apagou 6` estava correto — o usuario
apagou os seis mesmo. Parecia bug e nao era.

---

## D-021 — As palavras do conceito precisam ter sido ditas juntas (2026-08-07) — firme

**Contexto.** O usuario relatou que o primeiro B-roll "nao batia com o contexto,
parece fora do sync da transcricao". O `frases.json` mostrou que a transcricao
estava perfeita — 10 frases cobrindo 0,01s a 62,22s, texto continuo e coerente.
**Nao havia problema de sincronia nenhum.** A ancora tambem estava certa: caiu em
cima da palavra que casou.

**O erro estava no casamento**, e a frase real deixa claro:

```
1,57–8,95s: "E exatamente essa a sensacao que MILHOES de casais no Brasil
             tem quando o HOMEM comeca a perder o desempenho sexual."
                          ^ ~3,7s                  ^ ~6,5s
```

"Milhares de homens" pontuou 100% porque os dois termos estavam na frase —
"milhare" via sinonimo *milhoes*, e "homem". So que "milhoes" qualificava
**casais**, e "homem" apareceu 2,8s depois falando de outra coisa.

**Causa raiz: o casamento tratava a frase como saco de palavras.** Numa frase de
7 segundos, duas palavras a 2,8s de distancia modificam sujeitos diferentes.

**Estrago em cadeia:** as 00:12 a frase e "Mais de 30 milhoes de homens" —
casamento perfeito — e foi descartada por "conceito repetido", porque o
casamento errado as 00:06 ja tinha gasto a vaga. E o usuario apagou o errado, o
que ensinou o plugin a desconfiar de um conceito que estava certo.

**Decisao.** Conceito de dois ou mais termos so casa se as palavras tiverem sido
ditas a menos de **1,5s** uma da outra. O dado ja existia: `termosNoTempo` guarda
o instante de cada palavra desde o D-014, e so era usado para ancorar.

Separa os mundos com folga, medido nos casos reais:

| Frase | Distancia | Resultado |
|---|---|---|
| "ajudei milhares de homens" | 0,35s | casa |
| "30 milhoes de homens" | 0,70s | casa |
| "milhoes de casais ... o homem" | 2,80s | **nao casa** |

Procura o agrupamento mais apertado, nao a primeira ocorrencia: a mesma palavra
pode ter sido dita varias vezes, e basta existir um ponto da frase onde todas
aparecem juntas.

**Quando nao da para julgar, nao julga.** Termo sem tempo conhecido devolve
`null` e o casamento segue — descartar por engano e pior que deixar passar.
Conceito de um termo so nao tem dispersao e nao e afetado.

---

## D-022 — Botao Aprender, e ligacoes que o dicionario nao tem (2026-08-07) — provisoria

**Contexto.** Duas queixas do usuario na mesma frase: (a) para ensinar o plugin
era preciso deixar ele inserir, toda vez; (b) ele queria que o plugin entendesse
o padrao **mesmo quando a transcricao nao bate com o nome do arquivo**.

### O botao

`Aprender` roda o mesmo caminho ate `julgarFaixa` e para: le a biblioteca, o
corte de V1, a transcricao, e julga a timeline. Nao planeja e nao insere. Edite
como quiser, clique, e ele estuda o que voce fez.

Custou uma extracao — `lerContexto()` — que os dois botoes compartilham.

### As ligacoes

**Isto reverte a regra do D-016**, que dizia "contagem ajusta peso, nao inventa
ligacao". O usuario pediu explicitamente o contrario, e a limitacao era real:
colocar "Vasos sanguineos" dez vezes onde se fala em "mangueira dobrada" nao
ensinava nada — so repetia a mesma sugestao de sinonimo faltando, dez vezes.

Quando o dicionario nao explica uma colocacao manual, o plugin conta **as
palavras que aquele B-roll cobriu** — de `inicio` a `fim` do clipe, nao a frase
inteira. A imagem entrou em cima daquelas palavras, nao das quinze da frase.

Tres travas contra aprender lixo:

1. **So o trecho coberto.** Corta o ruido de ~15 termos para ~4.
2. **Tres ocorrencias** (`LIGACAO_MINIMA`) em colocacoes diferentes. Palavra a
   toa nao se repete junto do mesmo conceito por acaso; a palavra do assunto sim.
3. **Entra como sugestao extra, com score proprio (0,75)**, sem tocar na
   pontuacao do casamento por texto. Abaixo de um casamento literal (1,0) e acima
   do corte do planejador (0,6): o padrao observado vale, mas nunca mais que a
   palavra escrita no arquivo. Conceito que ja veio pelo texto nao e duplicado.

**Sempre visivel.** Quando uma ligacao passa do minimo, o painel escreve
*"Aprendi que 'mangueira' pede 'Vasos sanguineos' — voce ligou os dois 3 vezes"*.
O plugin inventando dicionario nao pode acontecer em silencio. Fica em
`ligacoes.json`, separado do resto, entao apagar o arquivo desfaz tudo sem tocar
no aprendizado de peso.

**Risco assumido:** tres coincidencias criam uma ligacao errada. O custo e uma
sugestao ruim a 0,75, que o proprio aprendizado de peso derruba se o usuario
apagar. Provisoria ate rodar no uso real.

---

## D-023 — A timeline manda: nada entra por cima (2026-08-07) — firme

**Contexto.** O planejador monta o plano ideal do zero, toda vez, cego para o que
ja existe. A insercao usa `createOverwriteItemAction`. Somados, isso significava
que **cada clique em Analisar passava por cima do que o usuario tinha feito** —
B-roll movido, aparado ou deliberadamente mantido, apagado por um clique. O
usuario pediu: "analisou e aplicou so uma vez".

**Decisao.** Entre planejar e inserir entra `semSobrepor()`: onde ja ha B-roll em
qualquer faixa acima da V1, a colocacao e descartada com motivo escrito. Regra
sem excecao — o que ja esta na timeline sempre ganha do que o plugin sugeriria.

Encostar nao e sobrepor: um B-roll que comeca onde o outro termina e montagem
normal, e 0,05s de folga impede que arredondamento de frame vire conflito.

**Consequencia deliberada em `julgarFaixa`: ele agora LANCA** se nao conseguir
ler a timeline. Antes falhar ali so adiava o aprendizado; agora a mesma leitura
diz o que esta ocupado, e seguir sem ela significaria inserir as cegas por cima
do trabalho do usuario. Perder uma rodada de aprendizado custa pouco; apagar uma
edicao dele custa caro.

Isso tambem torna Analisar **idempotente na pratica**: clicar duas vezes nao
duplica nem sobrescreve nada, so informa que ja esta tudo la. E cobre o teste de
idempotencia que o CLAUDE.md secao 13 pedia.

---

## D-024 — Um arquivo de log por acao (2026-08-07) — firme

Havia um `ultimo-log.json` so. Clicar em Analisar logo depois de Aprender apagava
a unica prova do que o Aprender tinha feito — e foi exatamente assim que um
aprendizado inteiro, que funcionou, passou por "nao aconteceu nada".

Agora: `ultimo-log.json` para a analise, `ultimo-aprendizado.json` para o botao
Aprender. Sugestao do proprio usuario, e obviamente certa.

---

## D-025 — O plugin lembra que o trabalho foi dele (2026-08-07) — firme

**Contexto.** O usuario tirou um B-roll, clicou em Aprender, e o painel respondeu
*"Voce colocou 7 por conta propria: 0 aprendidos, 7 ja contados antes"*. Ele nao
tinha colocado nenhum: eram sete B-rolls que o **plugin** inseriu e que
sobreviveram.

**Causa.** Julgar o pendente apagava a entrada inteira. Na rodada seguinte, os
sobreviventes estavam na timeline sem constar de plano nenhum — e a unica coisa
que o codigo sabe fazer com isso e chamar de colocacao manual.

**Decisao.** A entrada nao e mais apagada: os `itens` esvaziam, e uma lista
`postos` acumula tudo o que o plugin ja inseriu naquela sequencia. O caminho
manual passa a ignorar esses arquivos.

Cuidado que quase virou bug: `apagou` continua olhando **so os itens a julgar**.
Se olhasse `postos`, todo arquivo de rodadas antigas contaria como apagado e a
trava do D-020 (nao contar rodada sem edicao) nunca mais dispararia.

**Verificado no arquivo real:** o aprendizado tinha funcionado. `Doutor|doutor`
foi de 14/6 para 9/4 — o erro da exclusao entrou — e os sete sobreviventes
somaram um acerto cada. So a mensagem estava errada.

---

## D-026 — Log guarda as ultimas dez execucoes (2026-08-07) — firme

O usuario clicou em Aprender duas vezes. O primeiro clique julgou o pendente e
aprendeu; o segundo, sem nada pendente, nao tinha o que fazer — e sobrescreveu o
log do primeiro. Sobrou a prova do clique inutil.

**Um log que se apaga nao e log.** `ultimo-log.json` e `ultimo-aprendizado.json`
passam a guardar `{ execucoes: [...] }` com as dez ultimas, mais recente
primeiro.

E a **quarta** vez que este projeto perde evidencia de algo que funcionou. As
tres anteriores foram por silencio (D-020, D-024 e a linha que rolava para fora
da tela); esta foi por sobrescrita. Registrado na secao 8 das armadilhas.

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
