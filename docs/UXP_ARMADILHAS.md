# Armadilhas do UXP no Premiere 26.3.2

Tudo aqui foi descoberto errando, dentro do Premiere real. Cada linha custou pelo
menos um ciclo de reiniciar o aplicativo. **Ler antes de mexer no painel.**

---

## 1. Carregamento de recursos

| Sintoma | Causa real |
|---|---|
| CSS nao aplica, painel sai sem estilo | `<link rel="stylesheet">` com caminho relativo **nao resolve** |
| Painel abre mas nada responde ao clique | `<script src="...">` idem: o JS nunca executa |

**O UXP resolve `href`/`src` a partir da RAIZ DO PLUGIN, nao da pasta do HTML.**
Como o `main` do manifest e `dist/index.html`, uma referencia a `"main.js"` e
procurada em `raiz/main.js` — que nao existe. E falha **em silencio**: nenhum
erro no log do Premiere.

**Solucao adotada:** `scripts/build.mjs` embute CSS e JS dentro do HTML. Sem
referencia externa, sem caminho para errar.

Diagnostico rapido: se o distintivo do painel continuar mostrando o texto que
esta escrito no HTML, o script nao rodou.

---

## 2. CSS

- **CSS Grid nao funciona.** `display: grid` e ignorado. Layout inteiro em flexbox.
- **Responsividade** sai de `flex-wrap` com `flex: 1 1 <base>`, nao de
  `repeat(auto-fit, minmax())` nem de media query.
- **`gap` e `var()` nao sao confiaveis.** Margens e valores literais.
- **Texto vem centralizado.** `text-align: left` nao basta: num flex column os
  filhos **nao esticam**, encolhem ate o tamanho do conteudo e ficam no meio.
  Quem resolve e `align-items: stretch` explicito.
- **Nao mexer no `display` de `sp-checkbox`.** Ele e inline-flex por dentro;
  forcar `block` joga o rotulo para baixo da caixa.
- **`sp-textfield type="number"` exibe `nan`.** Foi removido do painel: as faixas
  V2 e A3 sao requisito fixo e nao precisavam de campo.

---

## 3. Chamadas que penduram para sempre

Nao rejeitam, nao lancam, nao voltam. Matam a execucao inteira sem deixar rastro:

- `uxp.storage.localFileSystem.getFileForOpening()` — **nunca usar neste painel**.
  Nao e necessario: `importFiles` aceita caminho como string, e
  `getEntryWithUrl` le pasta sem dialogo.
- `ComponentParam.getStartValue()` e `getKeyframePtr()` — nunca varrer getters de
  `ComponentParam` as cegas. `displayName` e propriedade, use ela.
- `importFiles` em certos estados.

**Regra:** toda chamada ao Premiere passa por `comLimite()`. Sem isso o painel
fica preso em "carregando" para sempre, sem erro e sem log — e o diagnostico
vira adivinhacao.

**Regra 2:** ligar os `addEventListener` ANTES de qualquer `await`. Se o I/O
pendurar antes disso, os botoes nunca chegam a ser ligados e o painel abre
bonito e completamente morto.

---

## 4. Escrita na timeline

**Toda Action nasce dentro de `project.lockedAccess()`**, e a transacao vai no
mesmo lock:

```js
const editor = await ppro.SequenceEditor.getEditor(sequence);  // pode ficar fora
const at = await ppro.TickTime.createWithSeconds(0);           // pode ficar fora
const item = (await rootItem.getItems()).find(...);            // pode ficar fora

let erro = null;
project.lockedAccess(() => {          // SINCRONO: nenhum await aqui dentro
  try {
    const acao = editor.createOverwriteItemAction(item, at, 1, 2);
    project.executeTransaction((c) => c.addAction(acao), "texto do undo");
  } catch (e) { erro = `${e.name}: ${e.message}`; }
});
if (erro) throw new Error(erro);
```

| Mensagem do Premiere | O que estava errado |
|---|---|
| `Requires locked access` | Action criada fora do `lockedAccess` |
| `The script object is no longer valid` | objeto montado fora do lock (caso da `TrackItemSelection`) |
| `Invalid parameter` | `ClipProjectItem.cast()` desnecessario — passar o `ProjectItem` cru |

**Erro dentro da callback do `lockedAccess` NAO propaga.** Sem capturar numa
variavel e relancar depois, a falha passa por sucesso.

**`importFiles` invalida todos os handles obtidos antes dele.** Cada etapa pede
`project`/`sequence`/`rootItem` de novo.

---

## 5. Faixas

**`audioTrackIndex: -1` nao suprime audio** — cai no padrao e joga na A1, por
cima do audio principal. A unica forma correta e indice explicito. A d.ts
garante que indice maior que o numero de faixas cria faixa nova, entao `2`
sempre resulta em A3.

Para ficar sem audio, remover depois com `createRemoveItemsAction` e
`MediaType.AUDIO`.

---

## 6. Caminhos de arquivo

`getEntryWithUrl` quer `file:/C:/...` — **uma barra so** depois de `file:`.

**Nao escapar nada.** O UXP codifica por conta propria; escapar aqui gera escape
duplo. Medido: enviando `Brolls%20-%202026` o erro do proprio UXP reclamava de
`Brolls%2520-%25202026`. Espaco vai literal.

`caminhoParaUrl()` e idempotente de proposito: aceita caminho cru, URL ja
montada, com ou sem aspas, e desfaz codificacao acumulada.

Exige `"localFileSystem": "fullAccess"` no manifest.

---

## 7. Instalacao e ciclo de desenvolvimento

O Premiere **nunca conectou** ao servico de desenvolvimento UXP (porta 14001),
nem pela CLI nem pelo app grafico, com a flag `developer: true` ativa. Causa
desconhecida, contornada.

O que funciona: **symlink na pasta que o Premiere varre no boot**:

```
C:\Program Files\Common Files\Adobe\UXP\Plugins\External\com.leogi.autobroll
  -> C:\Users\leogi\Desktop\auto-broll-premiere
```

Criado por `scripts/install-link.ps1`, uma vez, como administrador.

Pre-requisitos:

1. `C:\Program Files\Common Files\Adobe\UXP\Developer\settings.json` com
   `{"developer": true}` — e o que `uxp devtools enable` grava.
2. O manifest **nao pode ter `"icons": []`** vazio. Com `scale: [1, 2]` ele
   procura `icon@1x.png` e `icon@2x.png`.

**Nao ha hot reload.** Qualquer alteracao exige reiniciar o Premiere.

---

## 8. Como depurar sem enxergar o painel

O painel e curto e o log fica abaixo da area visivel. Toda analise grava
`ultimo-log.json` em:

```
%APPDATA%\Adobe\UXP\PluginsStorage\PPRO\26\External\com.leogi.autobroll\PluginData\
```

Ler o arquivo e mais rapido e mais confiavel que captura de tela — e foi assim
que a maior parte dos problemas desta lista acabou sendo diagnosticada.

**Corolario 3: o log guarda as ultimas execucoes, nao a ultima.** Duas acoes
seguidas, e a segunda apagava a prova da primeira — inclusive quando era a
primeira que tinha feito o trabalho. Os arquivos de log guardam
`{ execucoes: [...] }` com as dez mais recentes.

**Corolario 2: numero zero tambem se escreve.** Uma etapa que so registra quando
tem algo a dizer produz silencio — e silencio, para quem esta olhando o painel, e
indistinguivel de funcionalidade quebrada. Aconteceu duas vezes neste projeto,
com o mesmo custo de diagnostico. Se a etapa rodou, ela fala, mesmo que seja
`0 aprendidos, 5 ja contados antes`.

**Corolario: o que importa vai no FIM do log.** O log rola sozinho para baixo,
entao so as ultimas linhas ficam a vista. Uma linha escrita no comeco da analise
existe no arquivo e some da tela — aconteceu com o resumo do aprendizado, e o
usuario concluiu, com razao, que a contagem nao tinha acontecido. Resumo se
guarda numa variavel e se registra no `finally`.
