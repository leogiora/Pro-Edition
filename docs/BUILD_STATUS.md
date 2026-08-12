# BUILD_STATUS

Ultima atualizacao: 2026-08-07 (fim da sessao 2)
Estado: **produto util dentro do Premiere.** Insere B-roll pela transcricao,
aprende com a edicao do usuario, escolhe o take pelo ritmo da fala, e nunca
sobrescreve o que ja esta na timeline.

Fase 0 (provas de API): fechada, gate atingido.
Fase 1 (esqueleto): entregue.
Fases 2 a 4: cobertas por uma fatia vertical fina, a pedido do usuario, em vez
da ordem sequencial do CLAUDE.md. Ver D-011.

---

## Ambiente

| Item | Valor |
|---|---|
| SO | Windows 11 Home Single Language 10.0.26200, x64 |
| Premiere Pro | **26.3.2** (`C:\Program Files\Adobe\Adobe Premiere Pro 2026`) |
| CPU / RAM | Intel i5-12450HX, 8C/12T · 15,7 GB |
| GPU | NVIDIA RTX 3050 Laptop 6 GB + Intel UHD |
| Node / npm | v24.18.0 / 11.16.0 |
| Biblioteca | `C:\Users\leogi\Downloads\Brolls - 2026` — 260 `.mp4`, 0,58 GB, pasta plana |
| Resolucoes | 720x1280 (136) · 464x832 (121) · 1080x1920 (3) |
| Audio na fonte | 147 dos 260 tem faixa de audio |
| Conceitos | **32 distintos** nos 260 arquivos |
| Instalacao | symlink em `Common Files\Adobe\UXP\Plugins\External` |

---

## O que funciona hoje

**Dois botoes.** O painel nao tem mais nada — o "Reler" foi apagado porque nada
dependia dele, e o cabecalho passou a se preencher no inicio de cada acao.

### Analisar e inserir

```
le sinonimos.json (dicionario editavel) e ligacoes.json (o que voce ensinou)
  -> lista a pasta de B-rolls (disco, sem seletor)
  -> le os clipes de V1 e a transcricao de cada midia
  -> remapeia para o tempo da sequencia e descarta o que foi cortado fora
  -> agrupa em frases (eos do Premiere + pausa > 1,5s)
  -> casa com os 32 conceitos (raiz + peso por raridade + sinonimos)
     exigindo que as palavras do conceito tenham sido ditas JUNTAS (D-021)
  -> JULGA a timeline: o que voce apagou, o que voce colocou (D-016/17/18/20)
  -> mede a agitacao de cada arquivo pelo stsz do mp4, com cache (D-019)
  -> planeja: ancora na palavra, take pelo ritmo da fala, inedito primeiro
     (repete um take so sem alternativa e depois de 60s — D-029)
  -> DESCARTA o que cairia em cima do que ja existe (D-023)
  -> insere, apara, escala para preencher, remove o audio
  -> guarda o plano para a proxima rodada julgar
```

### Aprender

Mesmo caminho ate julgar a timeline, e **para**. Nao planeja, nao insere. Serve
para ensinar sem deixar o plugin mexer em nada.

### O ciclo de uso

1. **Analisar e inserir** — enche a timeline.
2. Editar: apagar o que nao serviu, mover, aparar, por os seus em qualquer faixa
   acima da V1.
3. **Aprender** — ele estuda o que voce fez.
4. **Analisar e inserir** de novo — preenche so o que ficou vazio.

Medido numa sequencia real de 62s: 260 B-rolls lidos, 31 clipes em V1,
176 palavras, 10 frases, 32 conceitos, 8 a 10 B-rolls inseridos.

**Undo: tres Ctrl+Z**, independente da quantidade de B-rolls. As etapas nao
podem virar uma so porque ha dependencia real — o item de audio e o clipe em V2
so existem depois do overwrite ser aplicado.

## As duas ferramentas, e qual usar

A licao mais util da sessao 2, aprendida errando:

| Sintoma | Ferramenta |
|---|---|
| O take nao serve, ou o conceito nao cabe ali | **Apagar.** A contagem aprende. |
| O mesmo conceito as vezes acerta e as vezes erra **pela mesma palavra** | **Editar `sinonimos.json`.** |

A contagem nunca conserta o segundo caso: o par que erra em "consulta online"
(`Doutor|doutor`) e o mesmo que acerta em "eu sou medico". Punir um puniria o
outro. Ver D-027.

## Estrutura

```
src/domain.ts       tempo, escala, timecode, caminho, config — puro
src/mp4.ts          resolucao lida do cabecalho do arquivo — puro
src/transcript.ts   reconstrucao do corte final + frases — puro
src/match.ts        conceitos, sinonimos, casamento — puro
src/aprendizado.ts  contagem por par conceito-palavra e por arquivo — puro
src/intensidade.ts  percentil de agitacao e de ritmo, e o cache — puro
src/plano.ts        regras de colocacao — puro
src/analise.ts      pipeline que junta tudo — puro
src/premiere.ts     unico ponto que fala com a API do Premiere
src/ui/             painel
tests/              193 testes, sem framework
proofs/             painel de provas da Fase 0 (trocar `main` no manifest para usar)
```

`npm run verify` = tipos + 193 testes + build. **E o gate.**

Arquivos de estado, na pasta de dados do plugin (ver secao 8 das armadilhas):
`config.json`, `ultimo-log.json`, `aprendizado.json` (contagens),
`pendentes.json` (plano inserido e ainda nao julgado, um por sequencia),
`intensidade.json` (agitacao medida de cada arquivo, incremental),
`ligacoes.json` (associacoes que o usuario ensinou colocando B-roll),
`sinonimos.json` (**o dicionario, editavel a mao**),
`frases.json` (transcricao reconstruida da ultima analise, para diagnostico).

---

## Provado dentro do Premiere

- **Insercao completa**: importar, overwrite, aparar, escalar, remover audio.
- **Aprendizado por sobrevivencia** (D-016): ciclo inteiro, com numeros conferidos
  no `aprendizado.json`. Uma exclusao repetida derrubou o casamento errado de
  "Milhares de homens", que sumiu do plano sozinho.
- **Decaimento** (D-020): `Falhou na cama|cama` desabou de 106/19 para 10/4 e o
  historico fossilizado voltou a reagir.
- **Intensidade** (D-019): `intensidade.json` gravado, e os motivos do log trazem
  `take agitado` / `take parado`.
- **Dispersao** (D-021): o descarte "palavras a 8,8s uma da outra" apareceu no
  log real.
- **Densidade maxima**: 6 -> 10 B-rolls na mesma sequencia de 62s.

## Nao provado ainda — o que conferir na proxima sessao

0. **In/out como recorte (D-031).** O caso (a) ja foi provado ao vivo no 25
   (16:57 de 2026-08-12: "inserindo so de 06:20 a 08:20", 9 inseridos, todos
   dentro). Falta o caso (b): SEM in/out marcado, nada muda — se aparecer
   "In/out marcados" sem o usuario ter marcado, e o out fossilizado descrito
   no D-031, e o `recorte()` precisa de ajuste.
0b. **Trava anti-Ctrl+Z por posicao (D-032).** Codigo novo, nunca rodou ao
   vivo. O proximo pendente ja tera `inicio`; provar: inserir, Ctrl+Z, analisar
   — deve dizer "parece Ctrl+Z, nao contei como erro" mesmo com B-rolls
   manuais dos mesmos arquivos na timeline.

1. **Nao sobrescrever** (D-023). Clicar em *Analisar* duas vezes sem editar nada
   deve dizer *"Tudo o que eu sugeriria ja esta na timeline"* e nao mexer em
   nada. **E o mais importante da lista: e a trava que protege a edicao.**
2. **Ligacoes aprendidas** (D-022). Nunca dispararam — `ligacoes.json` ainda nem
   existe. Exige colocar B-roll do mesmo conceito **tres vezes** em trechos que o
   dicionario nao explica.
3. **Dicionario editavel** (D-028). Conferir que `sinonimos.json` nasce sozinho
   e que editar muda o casamento sem recompilar.
4. **Troca de take** (D-017) e **credito manual** (D-018): a mecanica rodou, mas
   nunca foram vistos acontecendo com log proprio na tela.
5. **Log com historico** (D-026) e a lista `postos` (D-025).

## Bloqueios e pendencias

1. **Undo unico nao alcancado.** Sao tres transacoes. O CLAUDE.md secao 2 item 8
   pede uma. Precisaria montar tudo numa CompoundAction, o que esbarra na
   dependencia descrita acima.
2. **`createSetEndAction` nunca foi provada isoladamente.** E o que apara a
   duracao. Na pratica funciona — os B-rolls entram com a duracao planejada —
   mas nao ha prova isolada.
3. ~~Dicionario de sinonimos no codigo.~~ **Resolvida** (D-028).
4. **Os numeros do aprendizado so se validam com uso.** Passo de 0,15 por
   exclusao, teto de 20 eventos, tolerancia de intensidade 0,35, tres
   ocorrencias para firmar uma ligacao. Todos plausiveis, nenhum calibrado.
5. **Cenarios dificeis nao testados**: nested, multicam, `speed != 1`, midia
   offline. O remapeamento so esta provado para o caso simples.
6. **ESLint nao instalado** — reducao deliberada de escopo, ver D-008.
7. **Movimento nao e emocao.** A intensidade separa agitado de parado, nao
   esperancoso de sombrio. Clima exigiria os pixels — opcao descartada no D-019,
   e o degrau seguinte se a agitacao nao bastar.

---

## Proximo passo exato

**Uma rodada no Premiere cobre a lista "nao provado" inteira.** Reiniciar o
aplicativo e, na mesma sessao:

1. **Analisar e inserir.** Conferir que o `sinonimos.json` nasceu.
2. **Analisar de novo, sem editar nada.** Deve recusar tudo com
   *"ja ha B-roll ai, deixei como esta"*. Se inserir ou duplicar qualquer coisa,
   **parar e consertar antes de qualquer outra coisa** — e a trava que protege o
   trabalho do usuario.
3. **Apagar** dois ou tres, e **colocar** um na mao numa fala que combine.
4. **Aprender.** Ler o log dele, que agora e proprio (`ultimo-aprendizado.json`)
   e guarda as dez ultimas execucoes.
5. **Analisar** de novo e ver se os apagados voltaram com outro take.

Depois disso, em ordem de valor: calibrar os numeros do aprendizado com o uso
(pendencia 4); cenarios dificeis de remapeamento (pendencia 5); `.ccx` e Fase 8.
Embedding de texto local e analise de pixels continuam sendo os degraus
seguintes, **so se** a contagem e a agitacao nao bastarem.

---

## Sessao 2 (2026-08-07) — o que foi decidido

| | |
|---|---|
| D-016 | Aprender por sobrevivencia: o que voce apaga vira erro |
| D-017 | Apagar troca o take, nao derruba o assunto |
| D-018 | O que voce coloca na mao tambem ensina |
| D-019 | Intensidade do take: agitacao do `stsz` x ritmo da fala |
| D-020 | Quatro consertos do uso real: todas as faixas, falar zero, esteira, decaimento |
| D-021 | As palavras do conceito precisam ter sido ditas juntas |
| D-022 | Botao Aprender, e ligacoes que o dicionario nao tem |
| D-023 | A timeline manda: nada entra por cima |
| D-024 | Um arquivo de log por acao |
| D-025 | O plugin lembra que o trabalho foi dele |
| D-026 | Log guarda as ultimas dez execucoes |
| D-027 | Dois acertos de dicionario que o aprendizado nao alcancaria |
| D-028 | O dicionario saiu do codigo |

**O erro que mais custou nesta sessao, quatro vezes:** confundir silencio com
falha. Uma linha que rolava para fora da tela, uma etapa que so falava quando
tinha numero maior que zero, um log que o clique seguinte apagava, e um resumo
vazio quando nao havia o que aprender. Nas quatro, o plugin tinha funcionado.
Esta na secao 8 das armadilhas, com os tres corolarios.
