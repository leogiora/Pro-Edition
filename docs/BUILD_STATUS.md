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
  -> guarda o plano; na proxima analise le V2 e aprende das duas pontas:
     o que voce apagou (erro) e o que voce colocou por conta propria (acerto)
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

## Bloqueios e pendencias

1. **Undo unico nao alcancado.** Sao tres transacoes. O CLAUDE.md secao 2 item 8
   pede uma. Precisaria montar tudo numa CompoundAction, o que esbarra na
   dependencia descrita acima.
2. **`createSetEndAction` nunca foi provada isoladamente.** E o que apara a
   duracao. Se falhar, os B-rolls entram com a duracao cheia do arquivo.
3. ~~Dicionario de sinonimos vive no codigo.~~ **Resolvida** (D-028): esta em
   `sinonimos.json`, na pasta de dados do plugin, editavel sem recompilar.
4. **Aprendizado: so a sobrevivencia foi provada no Premiere.** O ciclo de
   D-016 rodou inteiro, mas o passo de 0,15 por exclusao so se valida com uso.
   A troca de take (D-017) e o credito por colocacao manual (D-018) **ainda nao
   rodaram dentro do aplicativo**.
7. **Intensidade (D-019) nunca rodou no Premiere.** Toda a logica esta coberta
   por teste puro, mas a medicao real dos 260 arquivos — quanto demora, e se a
   agitacao medida corresponde ao que se ve na tela — so o uso responde.
   Movimento tambem nao e emocao: separa agitado de parado, nao clima.
5. **Cenarios dificeis nao testados**: nested, multicam, `speed != 1`, midia
   offline. O remapeamento so esta provado para o caso simples.
6. **ESLint nao instalado** — reducao deliberada de escopo, ver D-008.

---

## Proximo passo exato

**Uma unica rodada no Premiere cobre tudo o que esta pendente de prova.**
Reiniciar o aplicativo e, numa sequencia, conferir na ordem:

**Intensidade (D-019), na primeira analise depois desta versao:**

1. O log mostra `medindo intensidade: 25 de 260`... ate o fim, e termina.
2. `intensidade.json` aparece na pasta de dados do plugin.
3. A analise seguinte **nao** mostra linha de medicao nenhuma.
4. Algum motivo traz `· take agitado, a fala corre aqui` ou
   `· take parado, momento calmo`.
5. Em duas sequencias de ritmos diferentes, os takes escolhidos para o mesmo
   conceito mudam.

**Aprendizado (D-017 e D-018), na mesma sessao:**

1. **Apagar** um B-roll que nao serviu. Na analise seguinte deve entrar **outra
   variacao do mesmo conceito**, com `· outro take, o anterior foi apagado` no
   motivo (D-017). Vale so para arquivos julgados desta versao em diante.
2. **Colocar um na mao**, em cima de uma fala que combine. A analise seguinte
   deve terminar com *"Aprendi N que voce colocou em V2 por conta propria"*
   (D-018).
3. Colocar um que **nao** combine com a fala: deve sair a sugestao
   *"...nenhum termo liga os dois. Falta sinonimo?"* — e essa lista e a
   materia-prima da pendencia 3.

Depois disso a fila e: tirar o dicionario de sinonimos do codigo (pendencia 3),
agora com as sugestoes reais em maos; provar `createSetEndAction` isolada
(pendencia 2); cenarios dificeis de remapeamento (pendencia 5). Embedding de
texto local continua sendo o degrau seguinte, so se a contagem nao bastar.
