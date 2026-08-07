# BUILD_STATUS

Ultima atualizacao: 2026-08-07
Estado: **fatia vertical funcionando ponta a ponta dentro do Premiere, agora com
aprendizado por sobrevivencia (escrito e testado, ainda nao rodado no Premiere)**

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

Um clique em **Analisar e inserir** executa:

```
lista a pasta de B-rolls (disco, sem seletor)
  -> le os clipes de V1 e a transcricao de cada midia
  -> remapeia para o tempo da sequencia e descarta o que foi cortado fora
  -> agrupa em frases (eos do Premiere + pausa > 1,5s)
  -> casa com os 32 conceitos (raiz + peso por raridade + sinonimos)
  -> planeja: ancora na palavra, duracao, diversidade, sem repetir
  -> insere em V2, apara, escala para preencher, remove o audio
  -> guarda o plano; na proxima analise compara com V2 e aprende com o que sumiu
```

Medido numa sequencia real de 62s: 260 B-rolls lidos, 31 clipes em V1,
176 palavras, 10 frases, 32 conceitos.

**Undo: tres Ctrl+Z**, independente da quantidade de B-rolls. As etapas nao
podem virar uma so porque ha dependencia real — o item de audio e o clipe em V2
so existem depois do overwrite ser aplicado.

## Estrutura

```
src/domain.ts       tempo, escala, timecode, caminho, config — puro
src/mp4.ts          resolucao lida do cabecalho do arquivo — puro
src/transcript.ts   reconstrucao do corte final + frases — puro
src/match.ts        conceitos, sinonimos, casamento — puro
src/aprendizado.ts  contagem acerto/erro por par conceito-palavra — puro
src/plano.ts        regras de colocacao — puro
src/analise.ts      pipeline que junta tudo — puro
src/premiere.ts     unico ponto que fala com a API do Premiere
src/ui/             painel
tests/              111 testes, sem framework
proofs/             painel de provas da Fase 0 (trocar `main` no manifest para usar)
```

`npm run verify` = tipos + 111 testes + build. **E o gate.**

Arquivos de estado, na pasta de dados do plugin (ver secao 8 das armadilhas):
`config.json`, `ultimo-log.json`, `aprendizado.json` (contagens),
`pendentes.json` (plano inserido e ainda nao julgado, um por sequencia).

---

## Bloqueios e pendencias

1. **Undo unico nao alcancado.** Sao tres transacoes. O CLAUDE.md secao 2 item 8
   pede uma. Precisaria montar tudo numa CompoundAction, o que esbarra na
   dependencia descrita acima.
2. **`createSetEndAction` nunca foi provada isoladamente.** E o que apara a
   duracao. Se falhar, os B-rolls entram com a duracao cheia do arquivo.
3. **Dicionario de sinonimos vive no codigo** (`src/match.ts`, 37 entradas).
   Deveria ser arquivo editavel fora do codigo.
4. **Aprendizado nunca rodou no Premiere.** A logica esta escrita e coberta por
   15 testes, mas o caminho que le V2 e compara com o plano guardado (`lerClipes(1)`)
   nunca foi executado dentro do aplicativo. Ver D-016 e "proximo passo".
5. **Cenarios dificeis nao testados**: nested, multicam, `speed != 1`, midia
   offline. O remapeamento so esta provado para o caso simples.
6. **ESLint nao instalado** — reducao deliberada de escopo, ver D-008.

---

## Proximo passo exato

**Rodar o ciclo de aprendizado no Premiere, duas vezes.** Reiniciar o aplicativo
(nao ha hot reload), e entao:

1. Analisar e inserir numa sequencia. O log deve terminar com
   *"Apague os que nao serviram: a proxima analise aprende com isso."*
   Conferir que `pendentes.json` apareceu na pasta de dados do plugin.
2. Apagar na timeline os B-rolls que nao serviram. Nao desfazer com Ctrl+Z:
   desfazer devolve a sequencia ao estado anterior e nao ensina nada.
3. Analisar de novo. O log deve abrir com
   *"aprendizado: N mantidos e M apagados em V2 desde a ultima analise"*,
   e as sugestoes reprovadas devem trazer `· aprendizado -X%` no motivo.

O que pode falhar e ainda nao foi provado dentro do aplicativo: `lerClipes(1)`
numa sequencia sem V2 (deve virar aviso, nao erro) e a gravacao dos dois JSON.

Depois disso, os candidatos na fila (em ordem de valor, nao de esforco):
tirar o dicionario de sinonimos do codigo (pendencia 3), provar
`createSetEndAction` isolada (pendencia 2) e os cenarios dificeis de
remapeamento (pendencia 5). Embedding de texto local continua sendo o degrau
seguinte, so se a contagem nao bastar.
