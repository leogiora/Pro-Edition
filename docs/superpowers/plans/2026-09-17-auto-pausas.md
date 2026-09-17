# Auto Pausas Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Uma 5a ferramenta no Pro Edition que corta todas as pausas e respiros da gravacao bruta de um anuncio, com a mesma regra em todo video, sem cortar nenhum pedaco de palavra.

**Architecture:** A regra vive em logica pura (`src/pausas.ts`), sem DOM e sem Premiere, e decide em QUADROS quais trechos ficam e onde cada um cai na timeline. O adapter (`src/pausas-premiere.ts`) le a sequencia e a transcricao pelo adapter do Auto B-roll, aplica o plano com as primitivas do Premiere e, no fim, RELE a timeline e remonta a transcricao para provar que nenhuma palavra quebrou. A tela (`src/ui/pausas.html` + `pausas-mount.ts`) usa a folha da familia, como AutoCut e Auto Split.

**Tech Stack:** TypeScript, UXP (Adobe Premiere Pro 26+), `@adobe/premierepro` types, esbuild, `node --test`.

**Spec:** `docs/superpowers/specs/2026-09-17-auto-pausas-design.md`

## Global Constraints

- **Premiere 26+ apenas.** Sem fallback de versao (decisao de 2026-08-31).
- **Repo unico:** tudo em `C:\Users\leogi\Desktop\Pro-Edition`, branch `main`. O Auto B-roll e importado de `ferramentas/auto-broll/src/...`.
- **Codigo e comentario em portugues SEM acento** (convencao do repo). **Texto de tela COM acento** (decisao de 2026-09-17).
- **UXP:** sem `display: grid`, sem `gap`, sem `var()`, sem media query. `<button>` nativo e proibido na UI (usar `sp-button`). Ver `ferramentas/auto-broll/docs/UXP_ARMADILHAS.md`.
- **Toda chamada ao Premiere** passa por `comLimite` e toda Action nasce dentro de `comTransacao` (que ja faz `lockedAccess` + `executeTransaction`).
- **Verificacao de API le o resultado da timeline, nunca a ausencia de erro** (licao do Auto Split).
- **Margem padrao:** `0.08` s de cada lado. **Corte minimo:** 2 quadros.
- `npm run verify` na raiz precisa ficar verde ao fim de cada task.

---

### Task 1: Regra de corte (logica pura)

**Files:**
- Create: `src/pausas.ts`
- Test: `tests/pausas.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces:
  ```ts
  export interface Palavra { readonly texto: string; readonly inicio: number; readonly fim: number }
  export interface Corte { readonly inicioQ: number; readonly fimQ: number; readonly antes: string; readonly depois: string }
  export interface TrechoMantido { readonly inicioQ: number; readonly fimQ: number; readonly destinoQ: number }
  export interface Plano {
    readonly trechos: readonly TrechoMantido[];
    readonly cortes: readonly Corte[];
    readonly duracaoAntesQ: number;
    readonly duracaoDepoisQ: number;
  }
  export const MARGEM_PADRAO_S = 0.08;
  export const MIN_CORTE_QUADROS = 2;
  export function planejarCortes(
    palavras: readonly Palavra[],
    opcoes: { readonly fps: number; readonly duracaoQ: number; readonly margemS: number }
  ): Plano;
  ```
  `inicio`/`fim` de `Palavra` sao segundos na SEQUENCIA (nao na midia). `inicioQ`/`fimQ` sao quadros na sequencia de hoje; `destinoQ` e o quadro onde o trecho passa a comecar depois do corte.

- [ ] **Step 1: Write the failing test**

```ts
// tests/pausas.test.ts
import assert from "node:assert/strict";
import { test } from "node:test";
import { MARGEM_PADRAO_S, planejarCortes, type Palavra } from "../src/pausas.ts";

const opcoes = { fps: 30, duracaoQ: 300, margemS: MARGEM_PADRAO_S };

test("corta a pausa entre duas palavras e mantem a margem dos dois lados", () => {
  // "ola" 1.0-1.5s, "mundo" 3.0-3.5s. Pausa de 1.5s a 3.0s.
  const palavras: Palavra[] = [
    { texto: "ola", inicio: 1, fim: 1.5 },
    { texto: "mundo", inicio: 3, fim: 3.5 },
  ];
  const plano = planejarCortes(palavras, opcoes);

  // Cabeca (0 ate 1.0-0.08) + a pausa do meio = 2 cortes.
  assert.equal(plano.cortes.length, 3, "cabeca, meio e cauda");
  const meio = plano.cortes[1]!;
  // 1.5+0.08 = 1.58s -> quadro 47.4 -> arredonda PARA DENTRO da pausa = 48
  assert.equal(meio.inicioQ, 48);
  // 3.0-0.08 = 2.92s -> quadro 87.6 -> arredonda PARA DENTRO da pausa = 87
  assert.equal(meio.fimQ, 87);
  assert.equal(meio.antes, "ola");
  assert.equal(meio.depois, "mundo");
});

test("palavras encostadas nao geram corte", () => {
  const palavras: Palavra[] = [
    { texto: "e", inicio: 1, fim: 1.09 },
    { texto: "exatamente", inicio: 1.09, fim: 1.96 },
  ];
  const plano = planejarCortes(palavras, opcoes);
  const entrePalavras = plano.cortes.filter((c) => c.antes !== "" && c.depois !== "");
  assert.deepEqual(entrePalavras, []);
});

test("pausa com menos de 2 quadros removiveis fica inteira", () => {
  // Pausa de 0.20s: tirando 0.08 de cada lado sobra 0.04s = 1.2 quadros.
  const palavras: Palavra[] = [
    { texto: "um", inicio: 1, fim: 1.5 },
    { texto: "dois", inicio: 1.7, fim: 2.2 },
  ];
  const plano = planejarCortes(palavras, opcoes);
  const entrePalavras = plano.cortes.filter((c) => c.antes !== "" && c.depois !== "");
  assert.deepEqual(entrePalavras, []);
});

test("corta o silencio antes da primeira e depois da ultima palavra", () => {
  const palavras: Palavra[] = [{ texto: "so", inicio: 2, fim: 2.5 }];
  const plano = planejarCortes(palavras, { ...opcoes, duracaoQ: 300 });

  const cabeca = plano.cortes[0]!;
  assert.equal(cabeca.inicioQ, 0);
  assert.equal(cabeca.antes, "");
  // 2.0-0.08 = 1.92s -> 57.6 -> 57
  assert.equal(cabeca.fimQ, 57);

  const cauda = plano.cortes[plano.cortes.length - 1]!;
  // 2.5+0.08 = 2.58s -> 77.4 -> 78
  assert.equal(cauda.inicioQ, 78);
  assert.equal(cauda.fimQ, 300);
  assert.equal(cauda.depois, "");
});

test("os trechos que ficam sao colados um no outro a partir do quadro 0", () => {
  const palavras: Palavra[] = [
    { texto: "ola", inicio: 1, fim: 1.5 },
    { texto: "mundo", inicio: 3, fim: 3.5 },
  ];
  const plano = planejarCortes(palavras, opcoes);

  assert.equal(plano.trechos[0]!.destinoQ, 0);
  for (let i = 1; i < plano.trechos.length; i++) {
    const anterior = plano.trechos[i - 1]!;
    const atual = plano.trechos[i]!;
    assert.equal(atual.destinoQ, anterior.destinoQ + (anterior.fimQ - anterior.inicioQ));
  }
  const somaDosTrechos = plano.trechos.reduce((t, s) => t + (s.fimQ - s.inicioQ), 0);
  assert.equal(plano.duracaoDepoisQ, somaDosTrechos);
  assert.ok(plano.duracaoDepoisQ < plano.duracaoAntesQ);
});

test("sem palavra nenhuma nao ha plano: nada e cortado", () => {
  const plano = planejarCortes([], opcoes);
  assert.deepEqual(plano.cortes, []);
  assert.deepEqual(plano.trechos, []);
});

test("palavras fora de ordem ou sobrepostas nao geram corte negativo", () => {
  const palavras: Palavra[] = [
    { texto: "um", inicio: 1, fim: 2 },
    { texto: "dois", inicio: 1.5, fim: 2.5 },
  ];
  const plano = planejarCortes(palavras, opcoes);
  for (const c of plano.cortes) assert.ok(c.fimQ > c.inicioQ, `corte invalido: ${JSON.stringify(c)}`);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test` (na raiz do Pro-Edition)
Expected: FAIL — `Cannot find module '../src/pausas.ts'`

- [ ] **Step 3: Write minimal implementation**

```ts
// src/pausas.ts
/*
 * Auto Pausas — logica pura. Sem DOM, sem Premiere, roda no node --test.
 *
 * A regra inteira mora aqui: onde cortar, quanto sobra de margem e onde cada
 * trecho que fica passa a comecar. O adapter so executa o que este arquivo
 * decidiu — e e por isso que da para testar o corte sem abrir o Premiere.
 */

/** Palavra da transcricao ja em tempo de SEQUENCIA (segundos). */
export interface Palavra {
  readonly texto: string;
  readonly inicio: number;
  readonly fim: number;
}

/** Um pedaco que sai. `antes`/`depois` sao as palavras vizinhas (vazio na borda). */
export interface Corte {
  readonly inicioQ: number;
  readonly fimQ: number;
  readonly antes: string;
  readonly depois: string;
}

/** Um pedaco que fica, e para onde ele vai depois que a timeline fecha. */
export interface TrechoMantido {
  readonly inicioQ: number;
  readonly fimQ: number;
  readonly destinoQ: number;
}

export interface Plano {
  readonly trechos: readonly TrechoMantido[];
  readonly cortes: readonly Corte[];
  readonly duracaoAntesQ: number;
  readonly duracaoDepoisQ: number;
}

/** Deixa ~0,16 s entre frases. Calibrado com anuncio real na Task 7. */
export const MARGEM_PADRAO_S = 0.08;

/** Abaixo disso o corte so da tranco na imagem sem ganhar tempo. */
export const MIN_CORTE_QUADROS = 2;

export interface OpcoesPlano {
  readonly fps: number;
  readonly duracaoQ: number;
  readonly margemS: number;
}

export function planejarCortes(palavras: readonly Palavra[], opcoes: OpcoesPlano): Plano {
  const { fps, duracaoQ, margemS } = opcoes;
  if (!(fps > 0)) throw new Error(`fps invalido: ${fps}`);
  if (!(duracaoQ > 0)) throw new Error(`duracao invalida: ${duracaoQ}`);

  const vazio: Plano = { trechos: [], cortes: [], duracaoAntesQ: duracaoQ, duracaoDepoisQ: duracaoQ };
  if (palavras.length === 0) return vazio;

  const emOrdem = [...palavras].sort((a, b) => a.inicio - b.inicio);
  const cortes: Corte[] = [];

  // Arredondar SEMPRE para dentro da pausa: o comeco sobe, o fim desce. E o que
  // garante que o corte nunca entra numa palavra.
  const inicioDoCorte = (segundos: number) => Math.ceil(segundos * fps);
  const fimDoCorte = (segundos: number) => Math.floor(segundos * fps);

  const juntar = (inicioQ: number, fimQ: number, antes: string, depois: string) => {
    if (fimQ - inicioQ < MIN_CORTE_QUADROS) return;
    cortes.push({ inicioQ: Math.max(0, inicioQ), fimQ: Math.min(duracaoQ, fimQ), antes, depois });
  };

  const primeira = emOrdem[0]!;
  juntar(0, fimDoCorte(primeira.inicio - margemS), "", primeira.texto);

  for (let i = 0; i + 1 < emOrdem.length; i++) {
    const p = emOrdem[i]!;
    const q = emOrdem[i + 1]!;
    juntar(inicioDoCorte(p.fim + margemS), fimDoCorte(q.inicio - margemS), p.texto, q.texto);
  }

  const ultima = emOrdem[emOrdem.length - 1]!;
  juntar(inicioDoCorte(ultima.fim + margemS), duracaoQ, ultima.texto, "");

  // O que sobra entre um corte e o outro e o que fica, colado a partir do zero.
  const trechos: TrechoMantido[] = [];
  let cursor = 0;
  let destino = 0;
  const guardar = (inicioQ: number, fimQ: number) => {
    if (fimQ <= inicioQ) return;
    trechos.push({ inicioQ, fimQ, destinoQ: destino });
    destino += fimQ - inicioQ;
  };
  for (const corte of cortes) {
    guardar(cursor, corte.inicioQ);
    cursor = corte.fimQ;
  }
  guardar(cursor, duracaoQ);

  return { trechos, cortes, duracaoAntesQ: duracaoQ, duracaoDepoisQ: destino };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS — todos os testes de `tests/pausas.test.ts` verdes, e os 47 que ja existiam continuam verdes.

- [ ] **Step 5: Commit**

```bash
git add src/pausas.ts tests/pausas.test.ts
git commit -m "feat(pausas): regra de corte pura, margem fixa e corte encostado no quadro"
```

---

### Task 2: Conferencia antes/depois (logica pura)

**Files:**
- Modify: `src/pausas.ts`
- Test: `tests/pausas.test.ts`

**Interfaces:**
- Consumes: `Palavra` da Task 1.
- Produces:
  ```ts
  export function conferirPalavras(
    antes: readonly Palavra[],
    depois: readonly Palavra[],
    toleranciaS: number
  ): { readonly ok: boolean; readonly linhas: readonly string[] };
  ```
  `toleranciaS` e a duracao de 1 quadro. A comparacao e por DURACAO, nao por posicao: depois do corte as palavras mudam de lugar na timeline, mas nao podem encurtar.

- [ ] **Step 1: Write the failing test**

```ts
// acrescentar em tests/pausas.test.ts
import { conferirPalavras } from "../src/pausas.ts";

const umQuadro = 1 / 30;

test("conferirPalavras aprova quando toda palavra continua inteira", () => {
  const antes: Palavra[] = [
    { texto: "ola", inicio: 1, fim: 1.5 },
    { texto: "mundo", inicio: 3, fim: 3.5 },
  ];
  const depois: Palavra[] = [
    { texto: "ola", inicio: 0.08, fim: 0.58 },
    { texto: "mundo", inicio: 0.74, fim: 1.24 },
  ];
  const r = conferirPalavras(antes, depois, umQuadro);
  assert.equal(r.ok, true);
  assert.match(r.linhas.join("\n"), /2 de 2 palavras inteiras/);
});

test("conferirPalavras reprova palavra que sumiu", () => {
  const antes: Palavra[] = [
    { texto: "ola", inicio: 1, fim: 1.5 },
    { texto: "mundo", inicio: 3, fim: 3.5 },
  ];
  const depois: Palavra[] = [{ texto: "ola", inicio: 0.08, fim: 0.58 }];
  const r = conferirPalavras(antes, depois, umQuadro);
  assert.equal(r.ok, false);
  assert.match(r.linhas.join("\n"), /mundo/);
});

test("conferirPalavras reprova palavra encurtada alem da tolerancia", () => {
  const antes: Palavra[] = [{ texto: "saude", inicio: 1, fim: 1.5 }];
  const depois: Palavra[] = [{ texto: "saude", inicio: 0.08, fim: 0.4 }];
  const r = conferirPalavras(antes, depois, umQuadro);
  assert.equal(r.ok, false);
  assert.match(r.linhas.join("\n"), /saude/);
});

test("conferirPalavras aceita diferenca de um quadro", () => {
  const antes: Palavra[] = [{ texto: "saude", inicio: 1, fim: 1.5 }];
  const depois: Palavra[] = [{ texto: "saude", inicio: 0.08, fim: 0.58 - umQuadro }];
  assert.equal(conferirPalavras(antes, depois, umQuadro).ok, true);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — `conferirPalavras is not exported`

- [ ] **Step 3: Write minimal implementation**

```ts
// acrescentar em src/pausas.ts
/**
 * Prova de que o corte nao comeu fala: mesma sequencia de palavras, cada uma
 * com a mesma duracao. Compara DURACAO e nao posicao — depois do corte a
 * palavra muda de lugar de proposito.
 *
 * Roda sobre a transcricao relida DA TIMELINE depois de aplicar (nunca sobre o
 * plano): o que interessa e o que o Premiere gravou, nao o que pedimos.
 */
export function conferirPalavras(
  antes: readonly Palavra[],
  depois: readonly Palavra[],
  toleranciaS: number
): { ok: boolean; linhas: string[] } {
  const problemas: string[] = [];
  const total = antes.length;

  for (let i = 0; i < total; i++) {
    const a = antes[i]!;
    const d = depois[i];
    if (!d) {
      problemas.push(`palavra ${i + 1} "${a.texto}" sumiu`);
      continue;
    }
    if (d.texto !== a.texto) {
      problemas.push(`palavra ${i + 1}: esperava "${a.texto}", veio "${d.texto}"`);
      continue;
    }
    const encolheu = a.fim - a.inicio - (d.fim - d.inicio);
    if (encolheu > toleranciaS) {
      problemas.push(`"${a.texto}" encurtou ${encolheu.toFixed(2)}s`);
    }
  }
  if (depois.length > total) problemas.push(`sobraram ${depois.length - total} palavras a mais`);

  if (problemas.length === 0) return { ok: true, linhas: [`${total} de ${total} palavras inteiras.`] };
  return { ok: false, linhas: [`${total - problemas.length} de ${total} palavras inteiras:`, ...problemas] };
}
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm test`
Expected: PASS

- [ ] **Step 5: Commit**

```bash
git add src/pausas.ts tests/pausas.test.ts
git commit -m "feat(pausas): conferencia antes/depois palavra a palavra"
```

---

### Task 3: Tela e card no hall (sem Premiere)

**Files:**
- Create: `src/ui/pausas.html`, `src/ui/pausas-mount.ts`
- Modify: `src/shell.ts` (tipo `Ferramenta`), `src/ui/main.ts` (registro + card), `src/ui/seletor.html` (card novo)
- Test: `tests/shell.test.ts:1-40` (o registro do teste passa a ter 5 telas; a contagem de miniaturas vira 5)

**Interfaces:**
- Consumes: `Plano` e `MARGEM_PADRAO_S` da Task 1.
- Produces: `export function mount(root: HTMLElement): void` em `src/ui/pausas-mount.ts`. Nesta task o botao so escreve "ligue no Premiere" no registro — o adapter entra na Task 4.

- [ ] **Step 1: Write the failing test**

```ts
// em tests/shell.test.ts, no teste "escolherTela devolve a tela certa do registro",
// acrescentar ao objeto `registro`:
    pausas: { html: "<f>pausas</f>", css: "f", montar: semAcao } satisfies Tela,
// e a asercao:
  assert.equal(escolherTela(registro, "pausas").html, "<f>pausas</f>");

// e no teste das miniaturas, trocar a contagem:
  assert.equal(notacoes.length, 5);
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — erro de tipo em `Ferramenta` (`pausas` nao existe) e `notacoes.length` 4 != 5.

- [ ] **Step 3: Write minimal implementation**

Em `src/shell.ts`, acrescentar a ferramenta ao tipo:

```ts
export type Ferramenta = "seletor" | "pausas" | "broll" | "captions" | "autocut" | "autosplit";
```

Criar `src/ui/pausas.html` (acento proprio `#67c7e2`; o resto vem da folha da familia):

```html
<!-- Fragmento: o shell injeta isto direto em document.body, depois da folha da
     familia (ferramentas/auto-broll/src/ui/styles.css). -->
<style>
  .marca-nome::before {
    background-color: #67c7e2;
  }

  .cod-pausa {
    color: #67c7e2;
  }

  .log {
    height: 200px;
    margin: 0;
  }
</style>

<header class="topo">
  <div class="marca">
    <span class="marca-nome">Auto Pausas</span>
  </div>
  <div id="apEstado" class="badge">carregando</div>
</header>

<main class="conteudo">
  <section class="secao">
    <div class="secao-cabeca">
      <span class="cod">SEQ</span>
      <span class="secao-rotulo">Sequência ativa</span>
    </div>
    <div class="secao-corpo">
      <div id="apSeqNome" class="seq-nome" data-vazio="sim">Nenhuma sequência selecionada</div>
      <div id="apDica" class="dica">Abra a gravação bruta: um clipe na V1 com o áudio na A1.</div>
    </div>
  </section>

  <section class="secao">
    <div class="secao-cabeca">
      <span class="cod cod-pausa">A1</span>
      <span class="secao-rotulo">Corte das pausas</span>
    </div>
    <div class="secao-corpo">
      <label class="campo">
        <span class="campo-rotulo">Margem de segurança (segundos)</span>
        <sp-textfield id="apMargem" value="0,08"></sp-textfield>
        <span class="campo-nota">O que fica de silêncio de cada lado da palavra. Menor = mais colado.</span>
      </label>
    </div>
  </section>

  <div class="acao">
    <sp-button id="apCortar" variant="cta">Cortar pausas</sp-button>
  </div>

  <section class="secao secao-log">
    <div class="secao-cabeca">
      <span class="cod">LOG</span>
      <span class="secao-rotulo">Registro</span>
    </div>
    <div class="secao-corpo">
      <pre id="apLog" class="log">Lendo a sequência...</pre>
    </div>
  </section>
</main>
```

Criar `src/ui/pausas-mount.ts`:

```ts
/*
 * Painel do Auto Pausas. So orquestra: le, mostra, chama o adapter.
 *
 * `root` chega mas nao e usado para escopar busca: o shell substitui
 * document.body inteiro antes de cada mount().
 */

import { MARGEM_PADRAO_S } from "../pausas.ts";

/** O campo aceita virgula (teclado pt-BR) e ponto. Vazio volta ao padrao. */
export function lerMargem(bruto: string): number {
  const n = Number(bruto.trim().replace(",", "."));
  return Number.isFinite(n) && n >= 0 && n <= 1 ? n : MARGEM_PADRAO_S;
}

export function mount(root: HTMLElement): void {
  const pega = <T extends HTMLElement>(id: string): T => root.querySelector<T>(`#${id}`)!;
  const log = pega<HTMLPreElement>("apLog");
  const escrever = (...linhas: readonly string[]) => {
    log.textContent = linhas.join("\n");
    log.scrollTop = log.scrollHeight;
  };

  escrever("Abra esta tela dentro do Premiere para ler a sequência.");

  pega("apCortar").addEventListener("click", () => {
    escrever("Ainda não ligado ao Premiere (Task 4).");
  });
}
```

Em `src/ui/seletor.html`, acrescentar o card ANTES do card do Auto B-roll, dentro do grupo Pro Ads:

```html
    <div id="cardPausas" class="card card-pausas" role="button" tabindex="0" aria-label="Abrir Auto Pausas">
      <span class="card-texto">
        <span class="card-nome">Auto Pausas</span>
        <span class="card-desc">Tira as pausas e os respiros da gravação bruta, sempre com a mesma margem.</span>
      </span>
      <span class="mapa" aria-hidden="true"
        data-trilhas="V1 ###-###-##-####-###-##|A1 ###-###-##-####-###-##"></span>
    </div>
```

Em `src/ui/seletor.css`, acrescentar o acento do card:

```css
.card-pausas .seg-novo {
  background-color: #67c7e2;
}
```

Em `src/ui/main.ts`: importar `htmlPausas from "./pausas.html"` e `{ mount as mountPausas } from "./pausas-mount.ts"`, acrescentar ao `REGISTRO` (`pausas: { html: htmlPausas, css: cssBroll, montar: mountPausas }`) e ligar o card em `montarSeletor`:

```ts
  ligarAcao(root.querySelector<HTMLElement>("#cardPausas")!, () => mostrar("pausas"));
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run verify`
Expected: PASS — 5 telas no registro, 5 miniaturas no hall, build gerado.

- [ ] **Step 5: Commit**

```bash
git add src/shell.ts src/ui/pausas.html src/ui/pausas-mount.ts src/ui/main.ts src/ui/seletor.html src/ui/seletor.css tests/shell.test.ts
git commit -m "feat(pausas): tela e card no hall, ainda sem ligacao com o Premiere"
```

---

### Task 4: Leitura da sequencia e previa do corte

**Files:**
- Create: `src/pausas-premiere.ts`
- Modify: `src/ui/pausas-mount.ts`
- Test: `tests/pausas.test.ts` (so a parte pura: `montarPalavras`)

**Interfaces:**
- Consumes: `planejarCortes`, `Palavra`, `Plano` (Task 1); do Auto B-roll: `lerClipes`, `lerTranscricoes`, `getSequenceInfo` (`ferramentas/auto-broll/src/premiere.ts`), `parseTranscricao`, `reconstruirTranscricao` (`ferramentas/auto-broll/src/transcript.ts`).
- Produces:
  ```ts
  // src/pausas-premiere.ts
  export interface Gravacao {
    readonly nomeSequencia: string;
    readonly fps: number;
    readonly duracaoQ: number;
    readonly palavras: readonly Palavra[];
  }
  export async function lerGravacao(): Promise<Gravacao>;   // lanca Error com a instrucao pronta
  // src/pausas.ts
  export function montarPalavras(
    palavrasEditadas: ReadonlyArray<{ text: string; inicio: number; fim: number }>
  ): Palavra[];
  ```

- [ ] **Step 1: Write the failing test**

```ts
// acrescentar em tests/pausas.test.ts
import { montarPalavras } from "../src/pausas.ts";

test("montarPalavras converte a transcricao do Auto B-roll e descarta palavra sem duracao", () => {
  const entrada = [
    { text: "ola", inicio: 1, fim: 1.5 },
    { text: "vazia", inicio: 2, fim: 2 },
    { text: "mundo", inicio: 3, fim: 3.5 },
  ];
  assert.deepEqual(montarPalavras(entrada), [
    { texto: "ola", inicio: 1, fim: 1.5 },
    { texto: "mundo", inicio: 3, fim: 3.5 },
  ]);
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — `montarPalavras is not exported`

- [ ] **Step 3: Write minimal implementation**

Em `src/pausas.ts`:

```ts
/**
 * Traduz `PalavraEditada` (transcricao remontada pelo Auto B-roll) para a
 * `Palavra` daqui. Palavra de duracao zero entra como pausa de graca e sairia
 * no corte: descartar e mais honesto do que cortar em cima dela.
 */
export function montarPalavras(
  palavrasEditadas: ReadonlyArray<{ text: string; inicio: number; fim: number }>
): Palavra[] {
  return palavrasEditadas
    .filter((p) => p.fim > p.inicio)
    .map((p) => ({ texto: p.text, inicio: p.inicio, fim: p.fim }));
}
```

Criar `src/pausas-premiere.ts` (le e valida; ainda nao escreve):

```ts
/*
 * Adapter do Auto Pausas. Le a sequencia e a transcricao pelo adapter do Auto
 * B-roll e devolve as palavras em tempo de sequencia. Nada de regra de corte
 * aqui: quem decide e src/pausas.ts.
 */

import { getSequenceInfo, lerClipes, lerTranscricoes } from "../ferramentas/auto-broll/src/premiere.ts";
import { parseTranscricao, reconstruirTranscricao } from "../ferramentas/auto-broll/src/transcript.ts";
import { montarPalavras, type Palavra } from "./pausas.ts";

export interface Gravacao {
  readonly nomeSequencia: string;
  readonly fps: number;
  readonly duracaoQ: number;
  readonly palavras: readonly Palavra[];
}

/**
 * A ferramenta so roda na gravacao bruta. Cada recusa diz o que fazer, porque
 * "nao deu" sem instrucao vira pergunta para mim depois.
 */
export async function lerGravacao(): Promise<Gravacao> {
  const info = await getSequenceInfo();
  const clipes = await lerClipes(0);

  if (clipes.length === 0) {
    throw new Error("Nenhum clipe na V1. Ponha a gravação na V1 com o áudio na A1.");
  }
  if (clipes.length > 1) {
    throw new Error(
      `A V1 tem ${clipes.length} clipes. O Auto Pausas roda na gravação bruta, antes de cortar takes, B-roll, música e legenda.`
    );
  }

  const clipe = clipes[0]!;
  const { transcricoes, falhas } = await lerTranscricoes([clipe.sourceName]);
  const json = transcricoes.get(clipe.sourceName);
  if (!json) {
    const motivo = falhas.find((f) => f.nome === clipe.sourceName)?.motivo ?? "sem transcrição";
    throw new Error(
      `"${clipe.sourceName}" não tem transcrição (${motivo}). No Premiere: painel Texto > Transcrever, e rode de novo.`
    );
  }
  const transcricao = parseTranscricao(json);
  if (!transcricao) throw new Error(`A transcrição de "${clipe.sourceName}" veio num formato que não consegui ler.`);

  const palavras = montarPalavras(reconstruirTranscricao([clipe], new Map([[clipe.sourceName, transcricao]])));
  if (palavras.length === 0) throw new Error("A transcrição não tem nenhuma palavra dentro deste trecho da timeline.");

  return {
    nomeSequencia: info.name,
    fps: info.fps,
    duracaoQ: Math.round((clipe.endSeconds - clipe.startSeconds) * info.fps),
    palavras,
  };
}
```

Em `src/ui/pausas-mount.ts`, trocar o corpo do `mount` pela leitura real e pela previa (o botao ainda nao aplica):

```ts
import { lerGravacao } from "../pausas-premiere.ts";
import { MARGEM_PADRAO_S, planejarCortes } from "../pausas.ts";

// dentro de mount(), depois de `escrever`:
  const estado = (texto: string, tom: "ativo" | "ok" | "aviso" | "erro") => {
    const badge = pega("apEstado");
    badge.textContent = texto;
    badge.setAttribute("data-tom", tom);
  };

  const relogio = (quadros: number, fps: number) => {
    const s = Math.round(quadros / fps);
    return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
  };

  const previa = async () => {
    const g = await lerGravacao();
    const nome = pega("apSeqNome");
    nome.textContent = g.nomeSequencia;
    nome.setAttribute("data-vazio", "nao");
    pega("apDica").style.display = "none";

    const plano = planejarCortes(g.palavras, {
      fps: g.fps,
      duracaoQ: g.duracaoQ,
      margemS: lerMargem(pega<HTMLInputElement>("apMargem").value),
    });
    escrever(
      `${plano.cortes.length} pausas para cortar · ${relogio(plano.duracaoAntesQ, g.fps)} → ${relogio(plano.duracaoDepoisQ, g.fps)}`,
      ...plano.cortes.map((c) => {
        const seg = ((c.fimQ - c.inicioQ) / g.fps).toFixed(1).replace(".", ",");
        const aviso = c.fimQ - c.inicioQ > g.fps ? "  ← confira" : "";
        return `${relogio(c.inicioQ, g.fps)} · ${seg} s · "${c.antes}" | "${c.depois}"${aviso}`;
      })
    );
    estado("previa pronta", "ok");
  };

  void previa().catch((e: unknown) => {
    estado("falhou", "erro");
    escrever(`Erro: ${(e as Error)?.message ?? String(e)}`);
  });
```

- [ ] **Step 4: Run test to verify it passes**

Run: `npm run verify`
Expected: PASS — tudo verde e `dist/main.js` construido.

- [ ] **Step 5: Commit**

```bash
git add src/pausas.ts src/pausas-premiere.ts src/ui/pausas-mount.ts tests/pausas.test.ts
git commit -m "feat(pausas): le a gravacao, recusa timeline editada e mostra a previa dos cortes"
```

---

### Task 5: SPIKE ao vivo — qual mecanica de corte funciona

**PARA O EXECUTOR: esta task termina numa pergunta ao usuario. Nao siga para a Task 6 antes da resposta dele.**

**Files:**
- Modify: `src/pausas-premiere.ts` (funcao `diagnostico`), `src/ui/pausas.html` (botao temporario), `src/ui/pausas-mount.ts`

**Interfaces:**
- Consumes: `lerGravacao` (Task 4).
- Produces: `export async function diagnostico(): Promise<string[]>` — cada linha diz o que tentou e **o que a timeline mostrou depois**, nunca "ok" por ausencia de erro.

- [ ] **Step 1: Escrever a sonda**

Acrescentar em `src/pausas-premiere.ts`:

```ts
/**
 * Sonda temporaria (sai na Task 7). Corta UM pedaco de 1 segundo no meio do
 * clipe pelas duas mecanicas possiveis e RELE a timeline em cada passo.
 *
 * A licao do Auto Split: marcar "ok" porque a chamada nao lancou deixou passar
 * o bug do 32767 duas vezes. Aqui cada linha traz o valor lido de volta.
 */
export async function diagnostico(): Promise<string[]> {
  const linhas: string[] = [];
  const retrato = async (rotulo: string) => {
    const v = await lerClipes(0);
    const a = await itensDaA1();
    linhas.push(
      `${rotulo}: V1 ${v.length} pedaco(s) [${v.map((c) => `${c.startSeconds.toFixed(2)}-${c.endSeconds.toFixed(2)} in=${c.inPointSeconds.toFixed(2)}`).join(" | ")}]`,
      `${rotulo}: A1 ${a.length} pedaco(s) [${a.map((c) => `${c.inicio.toFixed(2)}-${c.fim.toFixed(2)}`).join(" | ")}]`
    );
    return v;
  };

  const inicial = await retrato("antes");
  const base = inicial[0];
  if (!base) return [...linhas, "V1 vazia: ponha a gravacao na V1 antes de rodar a sonda."];

  const fps = (await getSequenceInfo()).fps;
  const umSegundo = await ppro.TickTime.createWithSeconds(1);

  // 1. Clone com deslocamento de 1s: ele cai onde foi pedido?
  {
    const { project, sequence } = await ativa();
    const editor = await ppro.SequenceEditor.getEditor(sequence);
    const item = await primeiroItemV1(sequence);
    comTransacao(project as never, "Auto Pausas: sonda clone", (adicionar) => {
      adicionar(editor.createCloneTrackItemAction(item, umSegundo, 0, 0, true, false));
    });
  }
  const depoisDoClone = await retrato("1) depois do clone +1s");
  linhas.push(
    depoisDoClone.length > inicial.length
      ? `1) clone criou pedaco novo comecando em ${depoisDoClone[1]?.startSeconds.toFixed(2)}s (pedi 1,00s)`
      : "1) clone NAO dividiu o clipe."
  );

  // 2. setInPoint no segundo pedaco: o ponto de entrada muda de verdade?
  {
    const { project, sequence } = await ativa();
    const item = await itemV1(sequence, 1);
    if (item) {
      const alvo = await ppro.TickTime.createWithSeconds(base.inPointSeconds + 2);
      comTransacao(project as never, "Auto Pausas: sonda in point", (adicionar) => {
        adicionar(item.createSetInPointAction(alvo));
      });
    }
  }
  const depoisDoIn = await retrato("2) depois do setInPoint +2s");
  linhas.push(`2) in point do 2o pedaco: pedi ${(base.inPointSeconds + 2).toFixed(2)}, timeline diz ${depoisDoIn[1]?.inPointSeconds.toFixed(2)}`);

  // 3. Remover o segundo pedaco com ripple: a timeline fecha o buraco?
  {
    const { project, sequence } = await ativa();
    const editor = await ppro.SequenceEditor.getEditor(sequence);
    const item = await itemV1(sequence, 1);
    if (item) {
      // `sequence.getSelection()` devolve uma TrackItemSelection viva; limpar e
      // pedir so o pedaco alvo evita depender de createEmptySelection, cuja
      // assinatura tipada e por callback e nunca foi usada neste projeto.
      const selecao = await (sequence as { getSelection: () => Promise<any> }).getSelection();
      for (const velho of await selecao.getTrackItems()) selecao.removeItem(velho);
      selecao.addItem(item, false);
      comTransacao(project as never, "Auto Pausas: sonda ripple", (adicionar) => {
        adicionar(editor.createRemoveItemsAction(selecao, true, ppro.Constants.MediaType.ANY));
      });
    }
  }
  const depoisDoRipple = await retrato("3) depois do ripple");
  linhas.push(
    `3) ripple: V1 ficou com ${depoisDoRipple.length} pedaco(s); ultimo termina em ${depoisDoRipple[depoisDoRipple.length - 1]?.endSeconds.toFixed(2)}s`,
    `fps da sequencia: ${fps}. Desfaca com Ctrl+Z ate a timeline voltar ao estado "antes".`
  );
  return linhas;
}
```

Os tres ajudantes que a sonda usa (`itensDaA1`, `primeiroItemV1`, `itemV1`) seguem o molde de `itensDa` em `src/autocut-premiere.ts:222-240`: `getAudioTrack(0)` / `getVideoTrack(0)` e `getTrackItems(1, false)`, com `getStartTime`/`getEndTime`/`getInPoint` lidos em segundos. `ativa()` e `ppro` sao os mesmos de `src/autosplit-premiere.ts:32,91` — copie o par para este arquivo se ainda nao existir aqui.

**Se a selecao ou `Constants.MediaType.ANY` nao existirem no ambiente**, registrar isso como linha da sonda (`3) ripple indisponivel: <erro>`) em vez de deixar a sonda inteira cair — a resposta do passo 1 e do passo 2 ja decide a mecanica principal. Envolver cada um dos tres passos no seu proprio `try/catch`, pelo mesmo motivo: o passo 3 falhar nao pode apagar o resultado dos passos 1 e 2.

- [ ] **Step 2: Botao temporario na tela**

Em `src/ui/pausas.html`, dentro de `.acao`:

```html
    <sp-button id="apDiag" variant="secondary" quiet>Diagnóstico</sp-button>
```

Em `src/ui/pausas-mount.ts`:

```ts
  pega("apDiag").addEventListener("click", () => {
    void (async () => {
      try {
        estado("diagnóstico", "ativo");
        escrever("Rodando diagnóstico...");
        escrever(...(await diagnostico()));
        estado("pronto", "ok");
      } catch (e) {
        estado("falhou", "erro");
        escrever(`Erro: ${(e as Error)?.message ?? String(e)}`);
      }
    })();
  });
```

- [ ] **Step 3: Rodar `npm run verify` e commitar**

```bash
git add src/pausas-premiere.ts src/ui/pausas.html src/ui/pausas-mount.ts
git commit -m "chore(pausas): sonda que le a timeline depois de cada mecanica"
```

- [ ] **Step 4: Pedir o teste ao usuario**

Mensagem, em portugues claro: reiniciar o Premiere, abrir uma sequencia com a gravacao bruta, abrir Auto Pausas, clicar em **Diagnóstico** e colar o registro. Avisar que a sonda mexe na timeline (um corte de 1 s) e que Ctrl+Z desfaz.

- [ ] **Step 5: Ruling**

Com o registro na mao, decidir e ANOTAR no plano e no `DEV_NOTES.md`:
- clone caiu na posicao pedida e `setInPoint` pegou → **remontagem** (caminho principal do spec);
- clone nao se comportou, mas o ripple fechou a timeline → **plano B** (fatiar e remover com ripple);
- nenhum dos dois → parar e voltar ao spec com o que a timeline mostrou.

---

### Task 6: Aplicar o corte e conferir o resultado

**Files:**
- Modify: `src/pausas-premiere.ts`, `src/ui/pausas-mount.ts`
- Test: `tests/pausas.test.ts` (a parte pura da montagem das acoes)

**Interfaces:**
- Consumes: `Plano` (Task 1), `conferirPalavras` (Task 2), `lerGravacao` (Task 4), o ruling da Task 5.
- Produces:
  ```ts
  export async function aplicarPausas(
    margemS: number
  ): Promise<{ readonly ok: boolean; readonly linhas: readonly string[] }>;
  ```

- [ ] **Step 1: Write the failing test**

A conta que decide QUAIS acoes aplicar e pura e testavel. Acrescentar em `src/pausas.ts` e testar:

```ts
// tests/pausas.test.ts
import { deslocamentos } from "../src/pausas.ts";

test("deslocamentos diz quanto cada trecho anda para tras", () => {
  const plano = planejarCortes(
    [
      { texto: "ola", inicio: 1, fim: 1.5 },
      { texto: "mundo", inicio: 3, fim: 3.5 },
    ],
    opcoes
  );
  const ds = deslocamentos(plano);
  assert.equal(ds.length, plano.trechos.length);
  for (const d of ds) assert.ok(d.andarQ >= 0, "nenhum trecho anda para frente");
  assert.equal(ds[0]!.andarQ, plano.trechos[0]!.inicioQ, "o primeiro anda o tamanho da cabeca cortada");
});
```

```ts
// src/pausas.ts
/** Quanto cada trecho recua na timeline. O adapter so executa isto. */
export function deslocamentos(plano: Plano): Array<{ readonly trecho: TrechoMantido; readonly andarQ: number }> {
  return plano.trechos.map((trecho) => ({ trecho, andarQ: trecho.inicioQ - trecho.destinoQ }));
}
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — `deslocamentos is not exported`

- [ ] **Step 3: Implementar `aplicarPausas`**

Seguindo o ruling da Task 5. Obrigatorio, qualquer que seja a mecanica:

1. `const g = await lerGravacao()` e `planejarCortes(...)` com a margem recebida.
2. Se `plano.cortes.length === 0`, devolver `{ ok: true, linhas: ["Nenhuma pausa para cortar."] }` sem tocar na timeline.
3. Aplicar dentro de `comTransacao`, no MENOR numero de transacoes que a mecanica permitir, contando quantas foram (e o numero de Ctrl+Z).
4. **Conferir lendo a timeline:** `lerClipes(0)` de novo, remontar a transcricao com `reconstruirTranscricao` e comparar com `g.palavras` usando `conferirPalavras(g.palavras, depois, 1 / g.fps)`.
5. Conferir que a A1 terminou com a mesma quantidade de pedacos da V1 e nas mesmas posicoes; se nao, linha de erro explicita.
6. Devolver `ok: false` quando a conferencia reprovar, com as linhas do problema — nunca `ok: true` por ausencia de excecao.

- [ ] **Step 4: Ligar o botao**

Em `src/ui/pausas-mount.ts`, o `apCortar` passa a chamar `aplicarPausas(lerMargem(...))`, com `estado("cortando", "ativo")` antes, `estado(r.ok ? "cortado" : "cortado com problema", r.ok ? "ok" : "erro")` depois, e `escrever(...r.linhas)`.

- [ ] **Step 5: Run test and verify**

Run: `npm run verify`
Expected: PASS

- [ ] **Step 6: Commit**

```bash
git add src/pausas.ts src/pausas-premiere.ts src/ui/pausas-mount.ts tests/pausas.test.ts
git commit -m "feat(pausas): aplica o corte e confere palavra a palavra relendo a timeline"
```

---

### Task 7: Calibrar a margem, tirar a sonda e documentar

**PARA O EXECUTOR: a calibracao e um teste do usuario. Nao chute o numero.**

**Files:**
- Modify: `src/pausas.ts` (valor de `MARGEM_PADRAO_S`, se o teste pedir), `src/pausas-premiere.ts` (remover `diagnostico`), `src/ui/pausas.html` (remover o botao), `src/ui/pausas-mount.ts`, `DEV_NOTES.md`, `ferramentas/auto-broll/docs/UXP_ARMADILHAS.md` (so se o spike achou armadilha nova)
- Test: `tests/pausas.test.ts` (os numeros esperados mudam junto com a margem padrao)

- [ ] **Step 1: Pedir o teste ao usuario**

Aplicar num anuncio real e ouvir: fala colada demais (aumentar a margem), ou ainda sobrando ar (diminuir). Pedir tambem o numero de Ctrl+Z que desfez tudo.

- [ ] **Step 2: Ajustar a margem padrao**

Trocar `MARGEM_PADRAO_S` pelo valor calibrado e atualizar os quadros esperados nos testes da Task 1 que dependem dele.

- [ ] **Step 3: Remover a sonda**

Apagar `diagnostico` de `src/pausas-premiere.ts`, o botao `apDiag` do HTML e o listener do mount.

- [ ] **Step 4: Documentar**

Em `DEV_NOTES.md`, secao nova "Auto Pausas": a mecanica que venceu no spike, o numero de Ctrl+Z, a margem calibrada e o limite conhecido (transcricao que estica a palavra por cima do silencio).

- [ ] **Step 5: Verify e commit**

```bash
npm run verify
git add -A
git commit -m "feat(pausas): margem calibrada, sonda removida e notas do spike"
```

- [ ] **Step 6: Fechar o branch**

Rodar `superpowers:finishing-a-development-branch`.
