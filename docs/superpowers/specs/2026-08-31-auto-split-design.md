# Auto Split — design

Data: 2026-08-31
Status: aprovado em chat, aguardando revisão do spec escrito

## Objetivo

Uma 4ª ferramenta no Pro Edition, **Auto Split**, para o passo final da
edição de anúncio: transformar os B-rolls já inseridos e revisados no layout
"meio a meio" — doutor na metade de cima, B-roll na metade de baixo mostrando
o assunto, com corte de topo, cantos e um leve feather separando as duas
partes.

O trabalho que ela tira das mãos, hoje feito clipe a clipe: para cada B-roll,
aplicar o efeito de corte, reposicionar e reescalar para a caixa de baixo, e
subir o clipe do doutor quando dá. Dez a vinte B-rolls por vídeo.

O enquadramento de cada B-roll não é fixo — depende de onde o assunto está no
quadro de origem. Auto Split resolve isso com um **perfil de enquadramento por
arquivo da biblioteca**, montado uma vez analisando cada vídeo, e refinado
pelo uso real através de um botão "Aprender" no mesmo molde do Auto B-roll.

## Não-objetivos

- **Não** detecta assunto por análise de imagem em tempo de execução. A
  suite é offline por decisão e o UXP não dá frame nem visão computacional. O
  "olhar cada B-roll" acontece uma vez, fora do plugin, e vira dado
  empacotado.
- **Não** tenta cravar o enquadramento final. Entrega um ponto de partida
  bom; o ajuste fino continua no Premiere, e é dele que o "Aprender" aprende.
- **Não** suporta Premiere 25. O usuário passou a usar só a versão mais
  recente. Sem código de compatibilidade, sem fallback de versão.
- **Não** faz o agrupamento "Pro Ads / Podcast" do seletor. É uma mudança de
  navegação independente, tarefa à parte.
- **Não** mexe em áudio.
- **Não** vira repositório separado. Vive dentro do Pro Edition, como o
  Podcast AutoCut.

## Provas e o que falta provar

**Provado nesta sessão:**
- `ffmpeg`/`ffprobe` estão na máquina. Extração de 1 frame + leitura de
  `width`/`height`/`duration` funciona. Um frame de 480px de largura é
  suficiente para julgar a posição do assunto a olho.
- A biblioteca `C:\Users\leogi\Downloads\Brolls - 2026` tem 251 `.mp4`, pasta
  plana, nomeados por conceito com `(n)` — `"Consulta médica (1).mp4"`. Todos
  os amostrados são verticais e curtos (5–8s), marca "Veo" no canto (gerados
  por IA).

**Provado antes (Auto B-roll, ao vivo):**
- Ler a `getComponentChain()` de um clipe, achar `AE.ADBE Motion`, pegar o
  param `Scale` e setar keyframe via `createSetValueAction` dentro de
  `comTransacao`. O param `Position` do mesmo componente é análogo.

**Tipado no `@adobe/premierepro` 26.x, NÃO provado ao vivo:**
- `VideoFilterFactory.createComponent(matchName)` → `VideoFilterComponent`.
- `VideoComponentChain.createAppendComponentAction(component)`.
- Setar params de um componente de filtro (Top, Feather, Roundness) —
  possivelmente igual ao Motion, possivelmente não.

**Desconhecido:**
- O `matchName` (e o `displayName` exato) do efeito "Cantos arredondados" que
  o usuário usa. Ele não lembra se é nativo ou de um pack instalado. Os
  params vistos no print: Left, Right, Top, Bottom, Symmetrical, Feather,
  Roundness, Custom Roundness, Offset, Angle, Scale, Zoom To Crop, Invert.

O passo de diagnóstico (seção 7) fecha os três últimos pontos antes de travar
o código do efeito.

## Decisões do brainstorm

| # | Decisão | Por quê |
|---|---------|---------|
| D1 | Perfil **semântico** (âncora + tipo de assunto), cálculo da geometria na hora de aplicar | Números crus por arquivo congelariam o alvo 50/50 e não generalizariam no aprendizado |
| D2 | Perfil montado por análise manual (Claude) dos 251 arquivos, empacotado no build | O usuário não quer setup; per-conceito (28) foi rejeitado por ele; visão em runtime é inviável offline |
| D3 | Casamento clipe↔perfil por **nome do arquivo de origem** com extensão | É o nome do ProjectItem; nenhum acesso a disco na hora de aplicar |
| D4 | Estiliza **todo B-roll acima da V1**, com campo opcional pra restringir a uma faixa | `lerBrollsAcimaDeV1()` já existe; cobre inseridos + arrastados na mão |
| D5 | 4º card no shell, reusa o adapter do Auto B-roll | Fluxo separado de fim de edição; mesmo padrão do Podcast AutoCut |
| D6 | Doutor: sobe só com checkbox ligado + origem vertical + clipe 100% dentro de um B-roll estilizado | Nudge do doutor é "quando dá", não sempre; mexer na V1 inteira quebraria trechos sem B-roll |
| D7 | Alvo 50/50 como base, campo pra deslocar por vídeo | O usuário tenta 50/50 mas ajusta |
| D8 | "Aprender" explícito, escreve em cópia do perfil no PluginData | Mesmo padrão do Auto B-roll; sem drift silencioso |
| D9 | Premiere 26+ apenas | Decisão do usuário nesta sessão |
| D10 | Nome: **Auto Split** | Combina com "Auto B-roll"; "auto" carrega o enquadramento, "split" o layout |

## 1. Arquitetura

| Arquivo | Papel |
|---|---|
| `src/autosplit.ts` | Lógica pura: geometria da caixa, casar clipe↔perfil, decidir escala/posição/crop, back-solve do "Aprender". Sem DOM, sem Premiere. |
| `src/autosplit-premiere.ts` | O que toca o Premiere. Reusa `comTransacao`, `getSequenceInfo`, `lerBrollsAcimaDeV1`, `readJson`/`writeJson` de `../../auto-broll-premiere/src/premiere.ts` (já exportados, mesmos imports do `autocut-premiere.ts`). |
| `src/ui/autosplit.html` | Markup + `<style>` da tela (efeito embutido no HTML, como o `autocut.html`). |
| `src/ui/autosplit-mount.ts` | `export function mount(root)`. Liga os botões. |
| `src/autosplit-perfil.json` | Perfil da biblioteca. Empacotado no build. |
| `tests/autosplit.test.ts` | Checagens `assert` da lógica pura. |

Registro no `src/ui/main.ts`: novo membro `autosplit` no tipo `Ferramenta`
(em `src/shell.ts`), entrada no `REGISTRO`, `NOME.autosplit = "Auto Split"`,
4º card no `seletor.html` (`#cardAutosplit`) ligado em `montarSeletor`.

Navegação continua plana.

## 2. Formato do perfil

```json
{
  "versao": 1,
  "padraoPorConceito": {
    "Consulta médica": { "assunto": "dupla", "ancoraY": 0.30, "cropTopoExtra": 0 }
  },
  "porArquivo": {
    "Consulta médica (1).mp4": {
      "assunto": "pessoa",
      "ancoraY": 0.28,
      "cropTopoExtra": 0.02,
      "w": 720,
      "h": 1280,
      "nota": "paciente à esquerda, médico de costas à direita"
    }
  }
}
```

Campos de uma entrada `porArquivo`:

- **`ancoraY`** (0–1): centro do que precisa ficar visível, como fração da
  altura do quadro **de origem**. É o número principal. O "Aprender" mexe
  aqui.
- **`cropTopoExtra`** (0–1): corte de topo além do que a geometria calcula,
  para clipes com lixo em cima (teto, céu, marca "Veo"). Default 0. O
  "Aprender" também mexe aqui.
- **`assunto`**: `rosto` | `pessoa` | `dupla` | `aberto`. Informa a folga de
  cabeça no cálculo do crop.
- **`w`, `h`**: resolução da origem, do `ffprobe` na análise. Evita o plugin
  ler disco.
- **`nota`**: texto livre, para depuração e para a próxima rodada de análise.

`padraoPorConceito` tem os mesmos campos menos `w`/`h`/`nota`.

**Como o perfil é montado (uma vez, fora do plugin):**

1. `ffprobe` em cada arquivo → `w`, `h`.
2. `ffmpeg` extrai 1 frame (2–3 para clipes com movimento grande) num
   timestamp representativo, escala pra ~480px, salva PNG.
3. Montagem em contact-sheets (`ffmpeg` tile, ~25 por folha) pra revisão em
   lote.
4. Claude olha cada frame e preenche `assunto`, `ancoraY`, `cropTopoExtra`,
   `nota`.
5. Resultado é o `porArquivo`. `padraoPorConceito` sai da mediana de cada
   grupo de conceito, pra cobrir take novo sem perfil.

**Busca em runtime:** `autosplit-perfil-override.json[nome]` (PluginData, do
"Aprender") → `perfil.porArquivo[nome]` → `perfil.padraoPorConceito[conceito(nome)]`
→ default por orientação.
`conceito("Consulta médica (1).mp4")` = tira ` (n)` e a extensão →
`"Consulta médica"`.

Default por orientação (nenhum perfil): `assunto` = `pessoa`, `ancoraY` =
0.35 se retrato (`h > w`), 0.45 se paisagem, `cropTopoExtra` = 0. Entra no
log como "sem perfil".

## 3. Fluxo do "Aplicar Auto Split"

1. `getSequenceInfo()` → `W`, `H`.
2. `lerBrollsAcimaDeV1()` → `{ sourceName, startSeconds, endSeconds,
   videoTrackIndex }[]`. Se o campo "faixa" da UI estiver preenchido, filtra
   por `videoTrackIndex`.
3. Para cada B-roll: resolve o perfil (seção 2). `w`/`h` vêm do perfil; se
   for um clipe sem perfil, tenta resolver o caminho pela `libraryPath` do
   `config.json` do Auto B-roll (`readJson`) + `listarPastaBrolls` +
   `dimensoesDoArquivo`; se ainda falhar, pula com aviso.
4. Calcula `cropTopo`, `escala`, `posX`, `posY` (seção 4).
5. **Uma transação** (`comTransacao(project, "Auto Split: aplicar N B-rolls",
   …)`):
   - Por B-roll:
     - Acha `AE.ADBE Motion` na chain. Seta keyframe de `Scale` (`escala`) e
       de `Position` (`[posX, posY]`).
     - **Idempotência**: se o efeito de corte já está na chain (pelo
       matchName), pula a adição — a menos que o checkbox "refazer do zero"
       esteja ligado, aí `createRemoveComponentAction` primeiro.
     - `VideoFilterFactory.createComponent(matchName)` →
       `chain.createAppendComponentAction(comp)`. Seta `Top` (`cropTopo·100`),
       `Feather` (`FEATHER_PCT`), `Roundness` (`ROUNDNESS_PCT`).
   - Por clipe do doutor (V1), só se o checkbox "subir doutor" estiver ligado:
     - Pula se a origem for paisagem (`w ≥ h`).
     - Pula se o clipe não estiver 100% dentro de `[startSeconds, endSeconds]`
       de algum B-roll estilizado.
     - Seta keyframe de `Position` (`[larguraCentro, posYDoutor]`), sem
       escala, sem crop.
6. Grava `ultimo-log-autosplit.json` no PluginData (nome próprio, não colide
   com `ultimo-log.json` do Auto B-roll nem `ultimo-log-captions.json`):
   estilizados, caíram no default, sem perfil, doutor ajustado, pulados.
7. Também grava `autosplit-aplicado.json`: por arquivo, os valores que o
   plugin usou (`ancoraYUsada`, `cropTopoExtraUsado`, `escala`, `posX`,
   `posY`, `cropTopo`) — insumo do "Aprender".
8. A UI mostra o resumo do log.

**Sem B-roll acima da V1** → não abre transação, log diz "nada a fazer".

## 4. Geometria

Espaço da sequência: `W × H`, origem no topo-esquerda, `y` pra baixo. Motion
`Position` mapeia o Anchor Point (mantido no centro da origem,
`[w/2, h/2]`) para um ponto da sequência. Motion `Scale` em % (100 = tamanho
nativo). O efeito de corte renderiza **antes** do Motion: `Top` deixa a faixa
de cima transparente, não muda o raster `w × h`.

**Entradas:** `W, H`; `brollTopoFrac` (default 0.5); origem `w × h`;
`ancoraY`; `assunto` → `folga`; `cropTopoExtra`.

**Caixa alvo:** topo em `yBox = H · brollTopoFrac`, tamanho `Wbox = W`,
`Hbox = H · (1 − brollTopoFrac)`.

```
origem w×h                sequência W×H
┌──────────┐              ┌───────────────┐ y=0
│   céu    │─ cropTopo    │    DOUTOR     │  V1 (sobe se vertical + checkbox)
│··········│  (efeito)    │               │
│  ROSTO   │ ancoraY      ├───────────────┤ y=yBox   (brollTopoFrac·H)
│  tronco  │              │▓▓▓▓▓▓▓▓▓▓▓▓▓▓▓│ ← feather no topo do B-roll
│  tronco  │              │▓▓▓  B-ROLL  ▓▓│   cobre a caixa inteira, sem tarja
└──────────┘              │▓▓▓ (V2+)    ▓▓│
                          └───────────────┘ y=H
```

**Passo 1 — corte de topo:**
```
cropTopo = clamp(ancoraY − folga + cropTopoExtra, 0, CROP_TOPO_MAX)
Top do efeito = cropTopo · 100
```
Altura visível da origem: `hVis = h · (1 − cropTopo)`.
Âncora dentro da parte visível: `aVis = (ancoraY − cropTopo) / (1 − cropTopo)`.

**Passo 2 — escala (cobrir a caixa):**
```
escala = max(Wbox / w, Hbox / hVis) · OVERSCAN · 100
```
`s = escala / 100` para as contas de posição.

**Passo 3 — posição:**
```
posX = W / 2
posY  tal que a âncora visível caia a SUBJ_IN_BOX da altura da caixa:
  topoVisSeq(posY) = posY + (cropTopo − 0.5) · h · s
  posY = yBox + SUBJ_IN_BOX · Hbox − (cropTopo − 0.5) · h · s − aVis · hVis · s
```
Clamp de `posY` para não abrir tarja:
```
posY = clamp(posY,
             H − 0.5 · h · s,                         // fundo coberto
             yBox − (cropTopo − 0.5) · h · s)          // topo visível não passa de yBox
```
Se o intervalo for vazio (não deve, com `OVERSCAN` e o `max`), vence o limite
de fundo coberto.

**Passo 4 — doutor (V1), quando habilitado + origem retrato:**
Sem escala, sem crop. `Position = [W/2, posYDoutor]` com
```
posYDoutor = min(H/2 · DOCTOR_UP, 0.5 · hDoc · sDoc)
```
`DOCTOR_UP < 1` sobe o clipe (y menor). O `min` com `0.5 · hDoc · sDoc`
(meia altura da mídia do doutor já escalada, lida da timeline) mantém o topo
da mídia em `y ≤ 0` — sem tarja no topo. Para doutor vertical preenchendo a
tela o `min` nunca morde; ele só protege origem menor.

**Constantes de calibração** (topo de `src/autosplit.ts`, comentário
`ponytail:` marcando que são ajuste fino do mundo físico):
```
FOLGA         = { rosto: 0.18, pessoa: 0.12, dupla: 0.10, aberto: 0.05 }
CROP_TOPO_MAX = 0.60
OVERSCAN      = 1.03
SUBJ_IN_BOX   = 0.40
DOCTOR_UP     = 0.85
FEATHER_PCT   = 5
ROUNDNESS_PCT = 0
```

O comportamento exato dos clamps nas bordas é fixado no código + testes, não
aqui.

## 5. UI

Uma tela, no molde das outras:

- Cabeçalho: nome da sequência ativa, contagem de B-rolls acima da V1.
- Campo "Faixa de B-roll" (vazio = todas acima da V1).
- Campo "Divisão" (default 50) — `brollTopoFrac = valor / 100`, aceita 40–60.
- Checkbox "Subir o doutor quando vertical" (default desligado).
- Checkbox "Refazer do zero" (default desligado).
- Botão CTA **"Aplicar Auto Split"**.
- Botão secundário **"Aprender"**.
- Botão secundário **"Diagnóstico"** (temporário, removido depois da seção 7).
- Log embaixo, mesmo componente visual das outras telas.

## 6. Aprendizado

Botão **"Aprender"**, sem tocar a timeline (só lê a sequência, só escreve no
PluginData):

1. Lê `autosplit-aplicado.json` (o que o plugin usou da última aplicação).
2. Para cada arquivo lá, acha o clipe na timeline pelo nome + tempo de início
   (`acharClipe`, mesmo utilitário do Auto B-roll).
3. Se o clipe não tem o efeito de corte na chain → o usuário tirou o split
   dali → pula, não aprende.
4. Lê `Position` atual do Motion e `Top` atual do efeito.
5. Se `Position` está igual ao que o plugin pôs (dentro de `eps`) e `Top`
   também → nada mudou → pula.
6. Back-solve:
   ```
   cropTopoFinal      = TopAtual / 100
   cropTopoExtraFinal = clamp(cropTopoFinal − (ancoraYUsada − folga), 0, CROP_TOPO_MAX)
   aVisFinal          = inverte o Passo 3 da geometria com posYAtual, escalaAtual, cropTopoFinal
   ancoraYFinal       = cropTopoFinal + aVisFinal · (1 − cropTopoFinal)
   ```
7. Move o valor guardado na direção do final por um passo:
   ```
   novoAncoraY       = guardado + clamp(ancoraYFinal − guardado, −PASSO, +PASSO)
   novoCropTopoExtra = guardado + clamp(cropTopoExtraFinal − guardado, −PASSO, +PASSO)
   ```
   `PASSO = 0.30`. Ambos clampados a [0, 1] / [0, CROP_TOPO_MAX].
8. Escreve em `autosplit-perfil-override.json` no PluginData:
   `porArquivo[nome] = { ancoraY, cropTopoExtra }`. A busca em runtime já
   consulta esse override antes do perfil empacotado.
9. Log: quais arquivos moveram e de quanto.

Ajustar `padraoPorConceito` quando 3+ arquivos do mesmo conceito andam na
mesma direção fica para v2.

## 7. Diagnóstico do efeito (antes de travar o código)

Botão temporário "Diagnóstico" que, num clique, no **primeiro B-roll acima da
V1** (`lerBrollsAcimaDeV1()` + acha o clipe na faixa — sem depender de API de
seleção):

1. `VideoFilterFactory.getDisplayNames()` + `getMatchNames()` → grava os dois
   arrays em `diag-autosplit.json` no PluginData.
2. Acha `AE.ADBE Motion` na chain e tenta setar `Position` com
   `createKeyframe([x, y])` — o param é 2D (`[540, 1552]` no print), e o
   código do Auto B-roll só provou setar o `Scale` escalar. Grava se
   `createKeyframe` aceita array, ou se precisa de outro caminho.
3. `createComponent(matchName)` para o candidato a "Cantos arredondados"
   (casado pelo `displayName`), `createAppendComponentAction`, e tenta setar
   `Top`, `Feather`, `Roundness`. Grava o resultado de cada passo (ok / erro
   + mensagem).
4. Desfaz tudo (`Ctrl+Z` / transação revertida) — é sonda, não deixa rastro.

O usuário roda uma vez no Premiere 26. Claude lê o `diag-autosplit.json`,
descobre o `matchName` real, se `Position` 2D é setável e se os params do
efeito são setáveis, trava o código em `autosplit-premiere.ts`, e remove o
botão.

**Se `createComponent`/append/set falhar:** Auto Split degrada pra **só o
layout Motion** (escala + posição da caixa), e o log diz "efeito não aplicado
por código — solte o preset na mão". O passo 5 do fluxo vira condicional a uma
capability flag detectada no primeiro uso.

## 8. Bordas e erros

| Situação | Comportamento |
|---|---|
| Sem B-roll acima da V1 | Log "nada a fazer", sem transação |
| Clipe sem perfil | Default por orientação, log "sem perfil" |
| `autosplit-perfil.json` não carregou | Tudo no default, log em vermelho |
| Escala/posição que o Auto B-roll já pôs | Sobrescrita pela conta da caixa (keyframe novo) |
| Doutor coberto por 2 B-rolls seguidos | Não sobe (regra "100% dentro de um"), usuário ajusta |
| Efeito já na chain (re-rodar) | Pula, a menos de "refazer do zero" |
| `createComponent` falha | Degrada pra layout Motion só (seção 7) |
| Param de filtro não setável | Aplica o efeito com os defaults dele, log avisa |
| Transação | Tudo ou nada; um `Ctrl+Z` desfaz o lote |

## 9. Testes

`tests/autosplit.test.ts`, `assert` puro, entra no `npm run verify` do repo
(sem framework, Node roda `.ts`):

- **Geometria**: retrato / paisagem / âncora alta / âncora baixa / com
  `cropTopoExtra` → `escala`, `posX`, `posY`, `cropTopo` esperados. Inclui um
  caso onde o clamp de fundo vence.
- **Perfil**: acerto em `porArquivo`; cai em `padraoPorConceito`; cai em
  default; `conceito("Consulta médica (1).mp4") === "Consulta médica"`;
  override do PluginData vence o empacotado.
- **Back-solve do "Aprender"**: dado `Position` + `Top` finais, `ancoraY` e
  `cropTopoExtra` esperados depois de um passo; caso "nada mudou" → sem
  escrita; caso "sem efeito na chain" → pulado.

`autosplit-premiere.ts` não tem teste unitário (sem Premiere) — verificação é
ao vivo + o `diag-autosplit.json`.

## 10. Sequência de trabalho (o plano detalha)

1. Esqueleto: `Ferramenta` ganha `autosplit`, card no seletor, tela vazia
   montando, `mount(root)` no ar.
2. `autosplit.ts` puro + testes: geometria, busca de perfil, back-solve.
3. Análise da biblioteca → `autosplit-perfil.json` (os 251).
4. `autosplit-premiere.ts`: ler B-rolls, casar perfil, aplicar Motion numa
   transação (sem efeito ainda). Botão "Diagnóstico".
5. Rodar diagnóstico no Premiere 26, travar o código do efeito, ligar o passo
   do efeito no fluxo.
6. "Aprender": ler timeline, back-solve, escrever override.
7. Doutor: nudge condicional.
8. `GUIA-DE-USO`/`DEV_NOTES` do Pro Edition atualizados; revisão do branch
   inteiro.

## Riscos

- **Efeito por código** (seção 7) — mitigado pelo diagnóstico antes de travar
  e pelo modo degradado.
- **`Position` do Motion é 2D** e o código provado só setou o `Scale` escalar
  — o diagnóstico testa `createKeyframe([x, y])` antes; se não aceitar array,
  o passo 5 do fluxo precisa de outro caminho (achar sub-params X/Y
  separados, ou `createSetValueAction` com outro tipo).
- **Params de filtro podem não ser keyframáveis como o Motion** — o
  diagnóstico cobre; pior caso, aplica o efeito com defaults e o usuário mexe.
- **`ancoraY` a olho pode errar** — é o que o "Aprender" corrige; o custo de
  errar é um microajuste, não retrabalho.
- **251 arquivos é análise longa** — one-time, em lote por contact-sheet;
  take novo cai no default de conceito e é anotado pra completar depois.
