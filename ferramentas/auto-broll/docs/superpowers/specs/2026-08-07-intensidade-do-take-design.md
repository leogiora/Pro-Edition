# Intensidade do take — desenho

Data: 2026-08-07
Estado: **aprovado, nao implementado**

---

## O problema

O casamento hoje e texto contra texto sobre 32 conceitos tirados dos nomes de
arquivo (D-012). Isso resolve **qual assunto** entra, e nao resolve **qual take**
daquele assunto.

Medido na biblioteca real (260 arquivos):

| Conceito | Takes |
|---|---|
| Viagra | 43 |
| Doutor | 38 |
| Frustrado | 37 |
| Teleconsulta | 25 |
| Falhou na cama | 24 |
| ...outros 27 conceitos | 93 |

**Cinco conceitos concentram 167 arquivos, 64% da biblioteca.** Os 43 clipes
chamados "Viagra" nao passam a mesma sensacao — um e um comprimido em close
clinico, outro e um casal sorrindo — e o nome nao os distingue porque e o mesmo
nome. O plugin trata os 43 como intercambiaveis.

Doze conceitos tem um arquivo so e nao sao afetados por nada disto.

## Por que o aprendizado atual nao resolve

`melhorArquivo` (D-017) escolhe o take de maior saldo. Um take com `+1` vence
para sempre 40 takes nunca testados, que estao em `0`. O plugin trava no primeiro
que deu certo e nunca mostra os outros. Com ~5 B-rolls por sessao e 43 takes num
conceito, cobrir a biblioteca por edicao nao acontece.

**Conclusao: precisa entrar informacao por arquivo que nao venha do historico.**

## Decisoes tomadas

| Questao | Decisao | Alternativas descartadas |
|---|---|---|
| Onde doi | Dentro do mesmo conceito (escolha do take) | Entre conceitos; ritmo do corte |
| Fonte da sensacao | O proprio arquivo, sem decodificar | Pixels via `<video>`+canvas; marcacao manual dos 167 |
| O que define o momento | Ritmo da fala (palavras por segundo) | Lexico de intensidade; so variedade |
| Historico vs intensidade | Intensidade filtra, historico escolhe | Historico manda; soma unica; intensidade sozinha |

## Arquitetura

### 1. Medida, por arquivo — `src/mp4.ts`

O MP4 e uma arvore de boxes. O leitor atual desce ate `tkhd` para largura e
altura; passa a descer tambem ate `stbl/stsz`, a tabela que diz quantos bytes
cada quadro ocupa. Movimento obriga o codificador a gastar mais bits.

**Medida: bytes por quadro por pixel** — `media(tamanhosDeQuadro) / (largura x altura)`.
Ja sai normalizada por resolucao, o que importa porque 47% da biblioteca e
464x832 e 52% e 720x1280. Nao usa duracao, entao nao precisa de `mdhd` nem `stts`.

Mudancas concretas:

- `RECIPIENTES` ganha `minf` e `stbl`; `PROFUNDIDADE_MAXIMA` sobe de 4 para 6.
- A varredura passa a andar **trak a trak**, casando o `tkhd` com o `stsz` do
  mesmo trak. Sem isso, o `stsz` do track de audio seria lido como se fosse do
  video. Hoje o pareamento nao existe porque so o `tkhd` interessava.
- Nova funcao pura `agitacaoDeMp4(bytes): number | null`.

Devolve `null` quando: nao ha `stsz`, o arquivo usa `stz2` (forma compacta, rara),
ou `sample_size != 0` (todos os quadros do mesmo tamanho — sem sinal de variacao).
`null` nunca derruba a colocacao; apenas nao filtra.

### 2. Ranking, nao escala absoluta

Nao existe "3,7 de agitacao". Cada take recebe o **percentil dentro do proprio
conceito**: entre os 43 "Viagra", quem se mexe mais que quem.

Isso dispensa calibracao, cancela vies de codificador e de resolucao, e torna a
medida comparavel so onde a comparacao faz sentido — entre irmaos. Conceito com
um take so tem percentil unico e o filtro nao tem o que fazer.

O momento recebe o mesmo tratamento: **palavras por segundo da frase, em percentil
dentro da sequencia**. `Frase.palavras` e `Frase.duracao` ja existem — custo zero.

Percentil e `posicao / (n - 1)` sobre a lista ordenada, com empates recebendo o
mesmo valor. Com `n = 1` o percentil e 0,5 por convencao — item unico nao e nem
agitado nem parado em relacao a ninguem, e 0,5 o mantem elegivel em qualquer
momento. Numa sequencia de 10 frases o percentil da fala e grosso, e esta certo
que seja: a diferenca entre a 4a e a 5a frase mais rapida nao significa nada.

### 3. Escolha — `src/plano.ts`

Onde hoje esta `melhorArquivo(memoria, disponiveis)`:

```
disponiveis
  -> filtra: |percentil do take - percentil da fala| <= TOLERANCIA
  -> entre os que sobraram, melhorArquivo (historico) escolhe
  -> se nenhum couber, cai para `disponiveis` inteiro
```

O fallback e obrigatorio: intensidade nunca pode custar uma colocacao boa.

`Biblioteca` ganha `agitacao?: ReadonlyMap<string, number>`. Ausente, o
comportamento e identico ao de hoje — o que mantem todos os testes atuais validos
sem alteracao.

O motivo passa a dizer quando o filtro agiu: `· take agitado, a fala corre aqui`
ou `· take parado, momento calmo`. Nenhuma escolha automatica sem motivo escrito
(CLAUDE.md secao 8).

### 4. Cache — `intensidade.json`

Medir exige ler os bytes dos 260 arquivos: ~0,6 GB, na casa de dezenas de
segundos. Inaceitavel a cada analise, aceitavel uma vez.

- Chave: nome do arquivo. Valor: `{ tamanho, agitacao }`.
- Incremental: arquivo cujo `tamanho` bate com o cache nao e relido.
- Schema versionado, e parse tolerante que devolve vazio em vez de lancar — mesma
  disciplina de `config.json` e `aprendizado.json`.
- Linha de progresso no painel durante a primeira passada.

E o indexador da Fase 5 chegando cedo e em miniatura.

## Fluxo

```
analise (ja existe)
  -> mede/le do cache a agitacao de cada arquivo da biblioteca
  -> percentil por conceito
  -> percentil de palavras/segundo por frase
planejar
  -> para cada colocacao: filtra takes pelo encaixe, historico escolhe entre eles
```

A medicao entra **antes** de `planejar` e depois de `analisar` — precisa dos
conceitos, que a analise ja devolve como lista (D-018).

## Erros

| Situacao | Comportamento |
|---|---|
| `stsz` ausente, `stz2`, ou tamanho fixo | `agitacao = null`; take nao participa do filtro, continua elegivel |
| Arquivo ilegivel no disco | Mesmo acima, com aviso no log |
| Cache corrompido | Volta vazio, remede tudo |
| Nenhum take dentro da tolerancia | Cai para todos os disponiveis |
| Conceito com 1 take | Filtro nao atua |

Nenhum destes pode impedir a insercao.

## Testes

Puros, sem Premiere, no padrao atual (`node --test`, sem framework):

- `agitacaoDeMp4`: mp4 sintetico com `stsz` conhecido; trak de audio nao
  contamina o do video; `stz2` devolve `null`; tamanho fixo devolve `null`;
  arquivo truncado nao lanca nem entra em laco.
- Percentil: distribuicao conhecida; conceito de um take; empates.
- `planejar`: fala rapida escolhe take agitado entre irmaos; fala lenta escolhe
  parado; nenhum encaixe cai para todos; sem `agitacao` na `Biblioteca` o plano
  sai **identico** ao de hoje; o motivo diz quando o filtro agiu.
- Cache: ida e volta pelo JSON; arquivo com tamanho diferente e remedido.

## Riscos, ditos com todas as letras

**Bytes por pixel e proxy de movimento, nao de sensacao.** Um fundo estatico mas
visualmente ocupado le como agitado; um close parado num rosto le como calmo
(esse acerta). Vai errar em alguns casos e nao ha como saber quais sem olhar o
resultado real.

**Movimento nao e emocao.** Separa "agitado" de "parado", nao "esperancoso" de
"sombrio". Clima exigiria os pixels — a opcao descartada nesta rodada, que
continua disponivel se a agitacao sozinha nao bastar.

**`TOLERANCIA` e botao, nao constante enterrada.** E o numero que so o uso real
calibra. Comeca em **0,35**: uma janela de 0,35 para cada lado do percentil da
fala. Nos 43 takes de "Viagra" isso deixa ~15 candidatos quando a fala esta num
extremo de ritmo e ~30 quando esta no meio — pool sempre grande o bastante para o
historico ter o que escolher, e sempre menor que os 43 de hoje.

Se depois do uso ficar claro que 0,35 e frouxo demais, o caminho e apertar; se
sobrar colocacao caindo no fallback, e afrouxar. Nao ha como acertar isso de
antemao.

## Fora de escopo

Analise de pixels; lexico de intensidade; intensidade influenciando a escolha do
**conceito**; ritmo de corte (quantidade e duracao dos B-rolls); qualquer modelo,
embedding ou rede. O produto continua offline e sem IA em runtime.

## Ganho colateral

Destrava o travamento do D-017. Momentos diferentes abrem pools diferentes, entao
o plugin volta a mostrar takes nunca usados — mas so os que cabem ali, e o
historico continua mandando dentro do pool.
