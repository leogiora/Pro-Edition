# BUILD_STATUS

Ultima atualizacao: 2026-08-06
Estado: **fatia vertical funcionando ponta a ponta dentro do Premiere**

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
src/plano.ts        regras de colocacao — puro
src/analise.ts      pipeline que junta tudo — puro
src/premiere.ts     unico ponto que fala com a API do Premiere
src/ui/             painel
tests/              96 testes, sem framework
proofs/             painel de provas da Fase 0 (trocar `main` no manifest para usar)
```

`npm run verify` = tipos + 96 testes + build. **E o gate.**

---

## Bloqueios e pendencias

1. **Undo unico nao alcancado.** Sao tres transacoes. O CLAUDE.md secao 2 item 8
   pede uma. Precisaria montar tudo numa CompoundAction, o que esbarra na
   dependencia descrita acima.
2. **`createSetEndAction` nunca foi provada isoladamente.** E o que apara a
   duracao. Se falhar, os B-rolls entram com a duracao cheia do arquivo.
3. **Dicionario de sinonimos vive no codigo** (`src/match.ts`, 37 entradas).
   Deveria ser arquivo editavel fora do codigo.
4. **Sem aprendizado.** O plugin nao sabe quais B-rolls o usuario manteve ou
   apagou. Ver "proximo passo".
5. **Cenarios dificeis nao testados**: nested, multicam, `speed != 1`, midia
   offline. O remapeamento so esta provado para o caso simples.
6. **ESLint nao instalado** — reducao deliberada de escopo, ver D-008.

---

## Proximo passo exato

**Aprender com o que o usuario apaga.** O plugin guarda o plano que inseriu; na
analise seguinte le V2 e compara. B-roll que sobreviveu foi acerto, o que sumiu
foi erro. Com isso ajusta o peso de cada par conceito-palavra — sem modelo, sem
nuvem, so contagem. O usuario "treina" editando normalmente.

Foi acordado com o usuario como o caminho preferido, antes de considerar
embedding de texto local (que continua sendo o degrau seguinte se isso nao
bastar).
