# Auto Pausas Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Uma 5a ferramenta no Pro Edition que corta todas as pausas e respiros da gravacao bruta de um anuncio, no nivel do AutoCut Silences, com a mesma regra em todo video, sem cortar nenhum pedaco de palavra.

**Architecture:** A regra vive em logica pura (`src/pausas.ts`), sem DOM e sem Premiere: acha os blocos de fala pelo NIVEL DO AUDIO (a transcricao so diz onde cada palavra comeca) e decide em QUADROS quais trechos ficam e onde cada um cai na timeline. O adapter (`src/pausas-premiere.ts`) le a sequencia e a transcricao pelo adapter do Auto B-roll, exporta o audio da sequencia sozinho (WAV mono 16 kHz, preset que vem com o Premiere), aplica o plano com as primitivas do Premiere e, no fim, RELE a timeline e remonta a transcricao para provar que nenhuma palavra sumiu. A tela (`src/ui/pausas.html` + `pausas-mount.ts`) usa a folha da familia, como AutoCut e Auto Split.

**Tech Stack:** TypeScript, UXP (Adobe Premiere Pro 26+), `@adobe/premierepro` types, esbuild, `node --test`.

**Spec:** `docs/superpowers/specs/2026-09-17-auto-pausas-design.md` (revisado em 2026-09-21, commit `8ff3aa0`: audio como fonte principal)

**Estado em 2026-09-21:** Tasks 1-4 feitas (`22b8dc9`..`90dce14`). As Tasks 5-7 antigas (sonda so de mecanica, aplicar, calibrar) foram substituidas pelas Tasks 5-10 abaixo, depois que o usuario relatou que o Premiere 26 atual parou de marcar pausa na transcricao.

## Global Constraints

- **Premiere 26+ apenas.** Sem fallback de versao (decisao de 2026-08-31).
- **Repo unico:** tudo em `C:\Users\leogi\Desktop\Pro-Edition`, branch `main`. O Auto B-roll e importado de `ferramentas/auto-broll/src/...`.
- **Codigo e comentario em portugues SEM acento** (convencao do repo). **Texto de tela COM acento** (decisao de 2026-09-17).
- **UXP:** sem `display: grid`, sem `gap`, sem `var()`, sem media query. `<button>` nativo e proibido na UI (usar `sp-button`). Ver `ferramentas/auto-broll/docs/UXP_ARMADILHAS.md`.
- **Toda chamada ao Premiere** passa por `comLimite` e toda Action nasce dentro de `comTransacao` (que ja faz `lockedAccess` + `executeTransaction`).
- **Verificacao de API le o resultado da timeline, nunca a ausencia de erro** (licao do Auto Split).
- **Margem padrao:** `0.08` s de cada lado. **Corte minimo:** 2 quadros.
- **Audio:** `EncoderManager.exportSequence` IMEDIATO com `WAV_Mono_16bit_16kHz.epr` da pasta do proprio Premiere (`Settings\EncoderPresets`). Nada de export manual. O WAV da analise e temporario e e apagado depois de lido; so o do Diagnostico fica, para a calibracao.
- **Repo publico:** o WAV e a transcricao do usuario NUNCA vao para o git. Fixture de teste e sintetica.
- **Nenhum dB fixo:** piso e voz tipica saem de cada gravacao (percentis 20 e 90).
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

### Task 5: SPIKE ao vivo — Diagnóstico rodada 4 (áudio, transcrição e mecânica numa ida só)

**Histórico:** as rodadas 1–3 (commits `57b1841`, `817c5fb`, `49554c9`) provaram clone, ripple e o `in=0.00` herdado. A rodada 3 nunca foi rodada; ela entra inteira aqui como passo 3. O que já foi provado está em `DEV_NOTES.md`, seção "Auto Pausas".

**PARA O EXECUTOR: esta task termina num teste do usuário no Premiere. Não siga para a Task 7 antes dele. A Task 6 é lógica pura e pode ser feita enquanto espera.**

**Files:**
- Modify: `src/pausas.ts` (acrescenta `PRESET_WAV`, `candidatosDoPreset`, `lacunas`)
- Modify: `src/wav.ts` (acrescenta `wavCompleto`)
- Modify: `src/pausas-premiere.ts` (`lerClipeETranscricao`, `acharPreset`, `exportarAudio`, `diagnostico` novo)
- Modify: `src/ui/pausas-mount.ts` (mensagem de espera do diagnóstico)
- Test: `tests/pausas.test.ts`

**Interfaces:**
- Consumes: `lerGravacao`, `diagnostico` da rodada 3 (Task 4/5 antigas); do Auto B-roll: `comLimite`, `comTransacao`, `getSequenceInfo`, `lerClipes`, `lerTranscricoes`, `writeJson`, `type SequenceInfo` (`ferramentas/auto-broll/src/premiere.ts`), `caminhoParaUrl` (`ferramentas/auto-broll/src/domain.ts`), `parseTranscricao`, `reconstruirTranscricao` (`ferramentas/auto-broll/src/transcript.ts`); `nivelPorJanela` (`src/wav.ts`).
- Produces:
  ```ts
  // src/pausas.ts
  export const PRESET_WAV = "WAV_Mono_16bit_16kHz.epr";
  export function candidatosDoPreset(versaoHost: string, pastasAdobe: readonly string[]): string[];
  export function lacunas(
    palavras: ReadonlyArray<{ readonly start: number; readonly duration: number }>
  ): { total: number; acima02: number; acima05: number };
  // src/wav.ts
  export function wavCompleto(bytes: Uint8Array): boolean;
  // src/pausas-premiere.ts
  export async function acharPreset(): Promise<string>;
  export async function exportarAudio(nomeArquivo: string): Promise<{
    readonly caminho: string;
    readonly preset: string;
    readonly ms: number;
    readonly bytes: Uint8Array;
    readonly completoNaHora: boolean;
  }>;
  export async function apagarArquivo(caminho: string): Promise<void>;
  export async function diagnostico(): Promise<string[]>;   // tambem grava pausas-diag.json
  ```

- [ ] **Step 1: Write the failing tests**

Acrescentar em `tests/pausas.test.ts` (e `candidatosDoPreset`, `lacunas` no import de `../src/pausas.ts`; `wavCompleto` de `../src/wav.ts`):

```ts
import { wavCompleto } from "../src/wav.ts";

/** WAV PCM 16 bits mono minimo, para testar leitura sem arquivo de verdade. */
function wav16(amostras: readonly number[], taxa = 16000): Uint8Array {
  const dados = amostras.length * 2;
  const b = new Uint8Array(44 + dados);
  const v = new DataView(b.buffer);
  const marca = (o: number, s: string) => {
    for (let i = 0; i < 4; i++) v.setUint8(o + i, s.charCodeAt(i));
  };
  marca(0, "RIFF");
  v.setUint32(4, 36 + dados, true);
  marca(8, "WAVE");
  marca(12, "fmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, taxa, true);
  v.setUint32(28, taxa * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  marca(36, "data");
  v.setUint32(40, dados, true);
  amostras.forEach((a, i) => v.setInt16(44 + i * 2, Math.round(a * 32767), true));
  return b;
}

test("wavCompleto confere o tamanho que o cabecalho declara", () => {
  const w = wav16([0, 0.5, -0.5, 0]);
  assert.equal(wavCompleto(w), true);
  assert.equal(wavCompleto(w.subarray(0, w.byteLength - 2)), false, "arquivo ainda sendo escrito");
  assert.equal(wavCompleto(new Uint8Array(4)), false);
});

test("candidatosDoPreset tenta primeiro a pasta da versao que esta rodando", () => {
  const c = candidatosDoPreset("26.0.1", ["Adobe Media Encoder 2026", "Adobe Premiere Pro 2025", "Adobe Premiere Pro 2026"]);
  assert.deepEqual(c, [
    "C:\\Program Files\\Adobe\\Adobe Premiere Pro 2026\\Settings\\EncoderPresets\\WAV_Mono_16bit_16kHz.epr",
    "C:\\Program Files\\Adobe\\Adobe Premiere Pro 2025\\Settings\\EncoderPresets\\WAV_Mono_16bit_16kHz.epr",
  ]);
});

test("candidatosDoPreset sem versao conhecida tenta as pastas que existem", () => {
  assert.deepEqual(candidatosDoPreset("", ["Adobe Premiere Pro 2026"]), [
    "C:\\Program Files\\Adobe\\Adobe Premiere Pro 2026\\Settings\\EncoderPresets\\WAV_Mono_16bit_16kHz.epr",
  ]);
});

test("lacunas conta os espacos que a transcricao marca entre palavras", () => {
  const r = lacunas([
    { start: 0, duration: 1 },
    { start: 1, duration: 1 }, // encostada
    { start: 2.3, duration: 1 }, // 0,3 s
    { start: 4, duration: 1 }, // 0,7 s
  ]);
  assert.deepEqual(r, { total: 4, acima02: 2, acima05: 1 });
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — `wavCompleto`, `candidatosDoPreset` e `lacunas` nao exportados.

- [ ] **Step 3: Implementar a parte pura**

Em `src/wav.ts`, depois de `texto()`:

```ts
/**
 * O export pode devolver a promessa antes de fechar o arquivo, e o cabecalho
 * RIFF so recebe o tamanho final no fechamento. Completo = o tamanho declarado
 * bate com o que esta no disco.
 */
export function wavCompleto(bytes: Uint8Array): boolean {
  if (bytes.byteLength < 12) return false;
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return texto(v, 0) === "RIFF" && v.getUint32(4, true) + 8 === bytes.byteLength;
}
```

Em `src/pausas.ts`, no fim:

```ts
// --------------------------------------------------------- audio do Premiere

/** Vem instalado com o Premiere 26: mono, 16 kHz, 16 bits (~1,9 MB por minuto). */
export const PRESET_WAV = "WAV_Mono_16bit_16kHz.epr";

/**
 * Onde procurar o preset, a pasta da versao que esta rodando primeiro.
 * `versaoHost` e o `uxp.host.version` ("26.0.1" -> "Adobe Premiere Pro 2026").
 *
 * ponytail: so Windows — o Auto Pausas ainda nao roda no Mac.
 */
export function candidatosDoPreset(versaoHost: string, pastasAdobe: readonly string[]): string[] {
  const maior = Number.parseInt(versaoHost, 10);
  const daVersao = Number.isFinite(maior) ? `Adobe Premiere Pro ${2000 + maior}` : "";
  const outras = pastasAdobe
    .filter((n) => n.startsWith("Adobe Premiere Pro") && n !== daVersao)
    .sort()
    .reverse();
  return [daVersao, ...outras]
    .filter((n) => n !== "")
    .map((n) => `C:\\Program Files\\Adobe\\${n}\\Settings\\EncoderPresets\\${PRESET_WAV}`);
}

/**
 * Quantos espacos a transcricao marca entre palavras seguidas. Responde "o
 * Premiere 26 ainda marca pausa?": em 2026-08-10 eram 162 acima de 0,2 s em
 * 974 palavras; o usuario relata que atualizacoes depois disso pararam de marcar.
 */
export function lacunas(palavras: ReadonlyArray<{ readonly start: number; readonly duration: number }>): {
  total: number;
  acima02: number;
  acima05: number;
} {
  let acima02 = 0;
  let acima05 = 0;
  for (let i = 1; i < palavras.length; i++) {
    const anterior = palavras[i - 1]!;
    const espaco = palavras[i]!.start - (anterior.start + anterior.duration);
    if (espaco > 0.2) acima02++;
    if (espaco > 0.5) acima05++;
  }
  return { total: palavras.length, acima02, acima05 };
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Adapter — ler, exportar o audio e apagar**

Em `src/pausas-premiere.ts`, trocar os imports e o topo por:

```ts
import { caminhoParaUrl } from "../ferramentas/auto-broll/src/domain.ts";
import {
  comLimite,
  comTransacao,
  getSequenceInfo,
  lerClipes,
  lerTranscricoes,
  writeJson,
  type SequenceInfo,
} from "../ferramentas/auto-broll/src/premiere.ts";
import { parseTranscricao, reconstruirTranscricao } from "../ferramentas/auto-broll/src/transcript.ts";
import { candidatosDoPreset, lacunas, montarPalavras, PRESET_WAV, type Palavra } from "./pausas.ts";
import { nivelPorJanela, wavCompleto } from "./wav.ts";

declare function require(id: string): unknown;
/* eslint-disable @typescript-eslint/no-explicit-any */
const ppro = require("premierepro") as any;
const uxp = require("uxp") as any;
/* eslint-enable @typescript-eslint/no-explicit-any */
```

Separar a leitura que o Diagnostico tambem usa (o `lerGravacao` passa a chamar esta):

```ts
type Clipe = Awaited<ReturnType<typeof lerClipes>>[number];

/** A gravacao bruta: um clipe so na V1, com transcricao. Cada recusa diz o que fazer. */
async function lerClipeETranscricao(): Promise<{ info: SequenceInfo; clipe: Clipe; json: string }> {
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
  return { info, clipe, json };
}

export async function lerGravacao(): Promise<Gravacao> {
  const { info, clipe, json } = await lerClipeETranscricao();
  const transcricao = parseTranscricao(json);
  if (!transcricao) {
    throw new Error(`A transcrição de "${clipe.sourceName}" veio num formato que não consegui ler.`);
  }

  const palavras = montarPalavras(reconstruirTranscricao([clipe], new Map([[clipe.sourceName, transcricao]])));
  if (palavras.length === 0) {
    throw new Error("A transcrição não tem nenhuma palavra dentro deste trecho da timeline.");
  }

  return {
    nomeSequencia: info.name,
    fps: info.fps,
    duracaoQ: Math.round((clipe.endSeconds - clipe.startSeconds) * info.fps),
    palavras,
  };
}
```

E o acesso a arquivo + o export:

```ts
interface Entrada {
  readonly name: string;
  readonly nativePath: string;
  readonly isFolder?: boolean;
  read(opcoes?: unknown): Promise<unknown>;
  delete(): Promise<unknown>;
  getEntries?(): Promise<Entrada[]>;
}

/** Arquivo ou pasta num caminho absoluto, ou null se nao existir. */
async function entrada(caminho: string): Promise<Entrada | null> {
  try {
    return ((await uxp.storage.localFileSystem.getEntryWithUrl(caminhoParaUrl(caminho))) as Entrada | null) ?? null;
  } catch {
    return null;
  }
}

async function lerBytes(arquivo: Entrada): Promise<Uint8Array> {
  return new Uint8Array((await arquivo.read({ format: uxp.storage.formats.binary })) as ArrayBuffer);
}

export async function apagarArquivo(caminho: string): Promise<void> {
  const velho = await entrada(caminho);
  if (velho) await velho.delete();
}

/** O preset de WAV mono 16 kHz que vem com o Premiere. Lanca dizendo onde procurou. */
export async function acharPreset(): Promise<string> {
  const adobe = await entrada("C:\\Program Files\\Adobe");
  const pastas = adobe?.getEntries ? (await adobe.getEntries()).filter((e) => e.isFolder).map((e) => e.name) : [];
  const tentados = candidatosDoPreset(String(uxp.host?.version ?? ""), pastas);
  for (const caminho of tentados) {
    if (await entrada(caminho)) return caminho;
  }
  throw new Error(
    `Não achei o preset de áudio do Premiere (${PRESET_WAV}). Procurei em: ${
      tentados.join(" ; ") || "nenhuma pasta do Premiere em C:\\Program Files\\Adobe"
    }.`
  );
}

/**
 * Exporta o audio da sequencia ativa como WAV mono 16 kHz na pasta de dados do
 * plugin. E o mesmo metodo do AutoCut: o plugin extrai o audio sozinho, dentro
 * do clique — nada de export manual.
 *
 * Se a promessa voltar antes de o arquivo fechar, espera o cabecalho RIFF
 * fechar (ate 10 s). `completoNaHora` responde se essa espera e necessaria.
 */
export async function exportarAudio(nomeArquivo: string): Promise<{
  readonly caminho: string;
  readonly preset: string;
  readonly ms: number;
  readonly bytes: Uint8Array;
  readonly completoNaHora: boolean;
}> {
  const preset = await acharPreset();
  const pasta = (await uxp.storage.localFileSystem.getDataFolder()) as { nativePath: string };
  const caminho = `${pasta.nativePath.replace(/[\\/]+$/, "")}\\${nomeArquivo}`;
  await apagarArquivo(caminho);

  const { sequence } = await ativa();
  const encoder = ppro.EncoderManager.getManager();
  const tipo = ppro.Constants?.ExportType?.IMMEDIATELY ?? ppro.EncoderManager.EXPORT_IMMEDIATELY;
  const t0 = Date.now();
  const aceitou = await comLimite(
    "exportar o áudio da sequência",
    encoder.exportSequence(sequence, tipo, caminho, preset, true) as Promise<boolean>,
    10 * 60 * 1000
  );
  if (!aceitou) throw new Error("O Premiere recusou exportar o áudio da sequência.");
  const ms = Date.now() - t0;

  const arquivo = await entrada(caminho);
  if (!arquivo) throw new Error(`O export terminou, mas o arquivo não apareceu em ${caminho}.`);
  let bytes = await lerBytes(arquivo);
  const completoNaHora = wavCompleto(bytes);
  for (let tentativa = 0; !wavCompleto(bytes) && tentativa < 20; tentativa++) {
    await new Promise((r) => setTimeout(r, 500));
    bytes = await lerBytes(arquivo);
  }
  return { caminho, preset, ms, bytes, completoNaHora };
}
```

- [ ] **Step 6: O Diagnostico da rodada 4**

Renomear o `diagnostico()` atual (rodada 3) para `sondaMecanica(linhas: string[]): Promise<void>` — mesmo corpo, recebendo o array em vez de criar, e sem o `return`. Acrescentar a sonda do plano C e o diagnostico novo:

```ts
/**
 * Plano C da mecanica, testado na mesma ida: marcar in/out NO ITEM DO PROJETO
 * e fazer overwrite. Se o pedaco inserido mostrar so o trecho marcado, da para
 * remontar a gravacao inteira sem depender do setInPoint dos clones.
 * Devolve o in/out do item ao que era antes.
 */
async function sondaOverwrite(linhas: string[]): Promise<void> {
  // Handles novos antes de cada transacao, como na sonda da rodada 3.
  const clipDaV1 = async () => {
    const { sequence } = await ativa();
    const [item] = await itensDa(sequence, true, 0);
    if (!item) throw new Error("V1 vazia");
    const pi = await (item as unknown as { getProjectItem: () => Promise<unknown> }).getProjectItem();
    const clip = ppro.ClipProjectItem.cast(pi);
    if (!clip) throw new Error("o clipe da V1 nao e um ClipProjectItem");
    return clip;
  };

  const VIDEO = ppro.Constants.MediaType.VIDEO;
  const original = await clipDaV1();
  const inAntes = await original.getInPoint(VIDEO);
  const outAntes = await original.getOutPoint(VIDEO);
  const { sequence: seq } = await ativa();
  const destino = (await (seq as { getEndTime: () => Promise<{ seconds: number }> }).getEndTime()).seconds + 2;

  {
    const { project } = await ativa();
    const clip = await clipDaV1();
    const marcarIn = await ppro.TickTime.createWithSeconds(5);
    const marcarOut = await ppro.TickTime.createWithSeconds(6);
    comTransacao(project as never, "Auto Pausas: sonda in/out no item", (adicionar) => {
      adicionar(clip.createSetInOutPointsAction(marcarIn, marcarOut));
    });
  }
  {
    const { project, sequence } = await ativa();
    const clip = await clipDaV1();
    const editor = await ppro.SequenceEditor.getEditor(sequence);
    const em = await ppro.TickTime.createWithSeconds(destino);
    comTransacao(project as never, "Auto Pausas: sonda overwrite", (adicionar) => {
      adicionar(editor.createOverwriteItemAction(clip, em, 0, 0));
    });
  }

  const { sequence } = await ativa();
  const pecas = await itensDa(sequence, true, 0);
  const nova = (
    await Promise.all(
      pecas.map(async (i) => ({
        inicio: (await i.getStartTime()).seconds,
        fim: (await i.getEndTime()).seconds,
        entrada: (await i.getInPoint()).seconds,
      }))
    )
  ).find((p) => Math.abs(p.inicio - destino) < 0.05);
  linhas.push(
    nova
      ? `D) overwrite com in/out 5-6 s: pedaco em ${nova.inicio.toFixed(2)}-${nova.fim.toFixed(2)} mostrando a midia desde ${nova.entrada.toFixed(2)} s`
      : `D) overwrite com in/out: NENHUM pedaco apareceu em ${destino.toFixed(2)} s`,
    nova && Math.abs(nova.entrada - 5) < 0.05 && Math.abs(nova.fim - nova.inicio - 1) < 0.05
      ? "D) LEITURA: overwrite respeita o in/out do item — remontagem pelo plano C funciona."
      : "D) LEITURA: overwrite NAO respeitou o in/out marcado."
  );

  {
    const { project } = await ativa();
    const clip = await clipDaV1();
    comTransacao(project as never, "Auto Pausas: sonda devolve in/out", (adicionar) => {
      adicionar(clip.createSetInOutPointsAction(inAntes, outAntes));
    });
  }
}

/**
 * Rodada 4 — uma ida ao Premiere responde tudo que falta:
 *  1. o export do audio pelo proprio plugin funciona? quanto tempo, que formato?
 *  2. a transcricao do 26 atual ainda marca pausa?
 *  3. a mecanica de corte (rodada 3) e o plano C (overwrite com in/out).
 * O WAV e a transcricao ficam na pasta de dados para a calibracao (Task 7);
 * o registro tambem vai para pausas-diag.json, para ninguem precisar colar log.
 */
export async function diagnostico(): Promise<string[]> {
  const linhas: string[] = [];
  const dados: Record<string, unknown> = { quando: new Date().toISOString(), host: String(uxp.host?.version ?? "?") };
  const falha = (passo: string, e: unknown) => linhas.push(`${passo} falhou: ${(e as Error)?.message ?? String(e)}`);

  linhas.push(`== 1. Áudio (Premiere ${dados.host})`);
  try {
    const info = await getSequenceInfo();
    const r = await exportarAudio("pausas-diag.wav");
    const janelas = nivelPorJanela(r.bytes);
    const db = janelas.db[0] ?? [];
    const ordenado = [...db].sort((a, b) => a - b);
    const p = (q: number) => (ordenado[Math.floor((ordenado.length - 1) * q)] ?? NaN).toFixed(1);
    const segundos = (db.length * janelas.janelaMs) / 1000;
    linhas.push(
      `preset: ${r.preset}`,
      `export: ${(r.ms / 1000).toFixed(1)} s · ${(r.bytes.byteLength / 1e6).toFixed(1)} MB · completo na hora: ${
        r.completoNaHora ? "sim" : "NÃO"
      } · completo no fim: ${wavCompleto(r.bytes) ? "sim" : "NÃO"}`,
      `WAV: ${janelas.db.length} canal(is) a ${janelas.taxa} Hz · ${segundos.toFixed(1)} s de áudio (sequência: ${info.durationSeconds.toFixed(1)} s)`,
      `níveis (dB): p10 ${p(0.1)} · p20 ${p(0.2)} · p50 ${p(0.5)} · p90 ${p(0.9)} · p99 ${p(0.99)}`,
      `guardado: ${r.caminho}`
    );
    dados.audio = { preset: r.preset, ms: r.ms, bytes: r.bytes.byteLength, completoNaHora: r.completoNaHora, taxa: janelas.taxa, canais: janelas.db.length, segundos, sequenciaSegundos: info.durationSeconds };
  } catch (e) {
    falha("1) áudio", e);
  }

  linhas.push("== 2. Transcrição");
  try {
    const { info, clipe, json } = await lerClipeETranscricao();
    await writeJson("pausas-diag-transcricao.json", JSON.parse(json));
    const t = parseTranscricao(json);
    const palavras = t ? t.segments.flatMap((s) => s.words.filter((w) => w.type === "word")) : [];
    const l = lacunas(palavras);
    linhas.push(
      `clipe "${clipe.sourceName}": timeline ${clipe.startSeconds.toFixed(2)}–${clipe.endSeconds.toFixed(2)} s, in ${clipe.inPointSeconds.toFixed(2)} · ${info.fps} fps`,
      `${l.total} palavras · espaços > 0,2 s: ${l.acima02} · > 0,5 s: ${l.acima05}`,
      l.acima02 === 0
        ? "LEITURA: a transcrição NÃO marca pausa — confirma o problema do 26."
        : `LEITURA: a transcrição ainda marca ${l.acima02} pausas.`
    );
    dados.clipe = clipe;
    dados.fps = info.fps;
    dados.lacunas = l;
  } catch (e) {
    falha("2) transcrição", e);
  }

  // Mexe na timeline: por ultimo, depois que o audio ja foi exportado.
  linhas.push("== 3. Mecânica de corte");
  try {
    await sondaMecanica(linhas);
  } catch (e) {
    falha("3) mecânica", e);
  }
  try {
    await sondaOverwrite(linhas);
  } catch (e) {
    falha("3D) overwrite", e);
  }

  linhas.push('Pronto. Desfaça com Ctrl+Z até a timeline voltar ao "antes" (ou apague a cópia da sequência).');
  dados.linhas = linhas;
  try {
    await writeJson("pausas-diag.json", dados);
  } catch (e) {
    falha("gravar pausas-diag.json", e);
  }
  return linhas;
}
```

Em `src/ui/pausas-mount.ts`, no listener do `apDiag`, trocar `escrever("Rodando diagnóstico...")` por:

```ts
        escrever("Rodando diagnóstico: exportando o áudio da sequência (pode levar alguns segundos)...");
```

- [ ] **Step 7: Verificar e commitar**

Run: `npm run verify`
Expected: PASS — testes verdes, tipos ok, `dist/main.js` construido.

Em `.gitignore`, uma linha de seguro (repo publico): `*.wav`.

```bash
git add .gitignore src/pausas.ts src/wav.ts src/pausas-premiere.ts src/ui/pausas-mount.ts tests/pausas.test.ts
git commit -m "chore(pausas): diagnostico rodada 4 - audio exportado pelo plugin, transcricao crua e mecanica"
```

- [ ] **Step 8: Pedir o teste ao usuario**

Mensagem, em português claro, sem jargão:
1. Fechar e abrir o Premiere de novo (o painel só atualiza assim).
2. Abrir uma bruta real **curta** (2 a 5 minutos, com respiros), com transcrição feita, sozinha numa sequência (V1 + A1). **Duplicar a sequência** (botão direito > Duplicar) e abrir a cópia — a parte 3 mexe na timeline.
3. Pro Edition → Auto Pausas → **Diagnóstico**. Esperar a mensagem "Pronto".
4. Só avisar "rodei": eu leio `pausas-diag.json`, o WAV e a transcrição direto da pasta do plugin (`%APPDATA%\Adobe\UXP\PluginsStorage\PPRO\26\External\com.leogi.proedition\PluginData\`). Depois pode apagar a cópia da sequência.

- [ ] **Step 9: Ruling**

Com `pausas-diag.json` lido, decidir e ANOTAR no `DEV_NOTES.md` (seção "Auto Pausas"):
- **Áudio:** export funcionou? tempo por minuto de áudio, `completoNaHora`, taxa/canais. Se falhou: parar e voltar ao spec com o erro.
- **Transcrição:** `acima02` — confirma (ou não) que o 26 atual parou de marcar pausa.
- **Mecânica** (decide a Task 9):
  - B) LEITURA "FICOU" → **A**: fatiar, corrigir o in, remover com ripple;
  - B) "ANDOU" e C) move trouxe de volta → **B**: o mesmo, mais um move por pedaço;
  - D) LEITURA "respeita o in/out" → **C** (remontagem por overwrite) é candidata — escolher entre A/B/C pela que precisa de menos transações;
  - nada funcionou → parar e voltar ao spec.

---

- [x] **Step 10: Rodada 5 (acrescentada depois do ruling da rodada 4)**

A rodada 4 rodou no Premiere **25.6.6** (o que o usuario usa hoje) e respondeu: audio OK (865 s em 5,8 s); mecanica por clone DESCARTADA (setInPoint apara a cabeca, move e relativo — seriam 3 transacoes por pedaco); transcricao e overwrite com in/out deram erro de parametro. Detalhe em `DEV_NOTES.md`, "Rodada 4".

A rodada 5 (commit desta etapa) troca a sonda de clone por:
- transcricao lida pelo `getProjectItem()` do item da V1 (`transcricaoDaV1`, que o `lerGravacao` passa a usar), e tambem pelo nome so para confirmar a causa;
- plano C chamada por chamada: D1 in/out atual do item do projeto (em que relogio ele conta), D2 marcar `base+5..base+6` e reler, D3 overwrite com o `ProjectItem` cru (D3b com o cast se falhar), D4 dois pares marcar+overwrite numa transacao so, D5 devolver o in/out.

Ruling da rodada 5 → decide a Task 9: D3 "RESPEITOU" = mecanica C; D4 "RESPEITOU" nos dois pares = o corte inteiro numa transacao (um Ctrl+Z).

---

### Task 6: A regra dos blocos de fala (lógica pura)

Pode ser feita enquanto o usuário não roda o Diagnóstico: os números são pontos de partida, e a Task 7 os calibra.

**Files:**
- Modify: `src/pausas.ts`
- Test: `tests/pausas.test.ts`

**Interfaces:**
- Consumes: `Palavra`, `planejarCortes` (Task 1).
- Produces:
  ```ts
  export interface OpcoesFala {
    readonly somAcimaDoPisoDb: number;
    readonly vozAbaixoDoTipicoDb: number;
    readonly buracoMaxS: number;
    readonly ataqueMaxS: number;
    readonly caudaMaxS: number;
    readonly vozSemPalavraMinS: number;
    readonly protecaoMaxS: number;
  }
  export const FALA_PADRAO: OpcoesFala;
  export type MotivoBloco = "fala" | "voz-sem-palavra" | "palavra-baixa";
  export interface Bloco extends Palavra { readonly motivo: MotivoBloco }
  export function blocosDeFala(
    db: readonly number[],
    janelaS: number,
    palavras: readonly Palavra[],
    opcoes?: OpcoesFala
  ): Bloco[];
  ```
  `Bloco` e uma `Palavra` com motivo: a lista vai direto para `planejarCortes`.

- [ ] **Step 1: Write the failing tests**

Acrescentar em `tests/pausas.test.ts` (e `blocosDeFala`, `FALA_PADRAO` no import):

```ts
const J = 0.02;

/** Nivel por janela de 20 ms: [inicioS, fimS, dB] por trecho; o resto e silencio de sala. */
function niveis(duracaoS: number, trechos: ReadonlyArray<readonly [number, number, number]>, silencio = -60): number[] {
  const db = new Array<number>(Math.round(duracaoS / J)).fill(silencio);
  for (const [de, ate, nivel] of trechos) {
    for (let i = Math.round(de / J); i < Math.round(ate / J); i++) db[i] = nivel;
  }
  return db;
}

const perto = (a: number, b: number) => Math.abs(a - b) < 1e-6;

// Cena padrao: respiro fraco antes da frase, voz forte, final fraco ("s") e silencio.
// Piso -60, voz tipica -20: som acima de -50, voz forte acima de -40.
const cena = (d = 0) =>
  niveis(
    4,
    [
      [0.5, 0.9, -45 + d], // respiro
      [1.0, 2.0, -20 + d], // voz
      [2.0, 2.1, -45 + d], // final fraco
    ],
    -60 + d
  );

test("o respiro antes da frase fica fora e o final fraco da palavra fica dentro", () => {
  // Transcricao do 26: o fim da palavra estica por cima do silencio.
  const blocos = blocosDeFala(cena(), J, [{ texto: "vamos", inicio: 1.0, fim: 3.5 }]);
  assert.equal(blocos.length, 1);
  assert.ok(perto(blocos[0]!.inicio, 1.0), `inicio ${blocos[0]!.inicio}`);
  assert.ok(perto(blocos[0]!.fim, 2.1), `fim ${blocos[0]!.fim}`);
  assert.equal(blocos[0]!.motivo, "fala");
  assert.equal(blocos[0]!.texto, "vamos");
});

test("a mesma cena 15 dB mais baixa da os mesmos blocos: cada gravacao se mede", () => {
  const a = blocosDeFala(cena(), J, [{ texto: "vamos", inicio: 1.0, fim: 3.5 }]);
  const b = blocosDeFala(cena(-15), J, [{ texto: "vamos", inicio: 1.0, fim: 3.5 }]);
  assert.deepEqual(b, a);
});

test("ataque fraco ('s' de 'saude') fica quando a transcricao diz que a palavra comeca ali", () => {
  const db = niveis(4, [
    [0.9, 1.0, -45], // "s"
    [1.0, 2.0, -20],
  ]);
  const [bloco] = blocosDeFala(db, J, [{ texto: "saude", inicio: 0.9, fim: 2.0 }]);
  assert.ok(perto(bloco!.inicio, 0.9), `inicio ${bloco!.inicio}`);
});

test("buraco curto dentro da palavra nao quebra o bloco", () => {
  const db = niveis(4, [
    [1.0, 1.4, -20],
    [1.48, 2.0, -20], // 80 ms de fechamento do "p"
  ]);
  const blocos = blocosDeFala(db, J, [{ texto: "compra", inicio: 1.0, fim: 2.0 }]);
  assert.equal(blocos.length, 1);
});

test("voz forte e longa sem palavra fica e e sinalizada; estalo curto sai", () => {
  const db = niveis(6, [
    [1.0, 2.0, -20], // fala transcrita
    [3.0, 3.4, -20], // voz sem palavra (0,4 s)
    [4.5, 4.6, -20], // estalo (0,1 s)
  ]);
  const blocos = blocosDeFala(db, J, [{ texto: "ola", inicio: 1.0, fim: 2.0 }]);
  assert.equal(blocos.length, 2, JSON.stringify(blocos));
  assert.equal(blocos[1]!.motivo, "voz-sem-palavra");
  assert.ok(perto(blocos[1]!.inicio, 3.0));
});

test("palavra que comeca no silencio ganha bloco protegido", () => {
  const db = niveis(4, [[1.0, 2.0, -20]]);
  const blocos = blocosDeFala(db, J, [
    { texto: "ola", inicio: 1.0, fim: 2.0 },
    { texto: "tchau", inicio: 3.0, fim: 3.9 },
  ]);
  const baixa = blocos.find((b) => b.motivo === "palavra-baixa");
  assert.ok(baixa, JSON.stringify(blocos));
  assert.equal(baixa!.texto, "tchau");
  assert.ok(perto(baixa!.inicio, 3.0));
  assert.ok(perto(baixa!.fim, 3.0 + FALA_PADRAO.protecaoMaxS), "no maximo 0,5 s");
});

test("blocos entram direto no corte: o respiro cai dentro do corte da cabeca", () => {
  const blocos = blocosDeFala(cena(), J, [{ texto: "vamos", inicio: 1.0, fim: 3.5 }]);
  const plano = planejarCortes(blocos, { fps: 30, duracaoQ: 120, margemS: MARGEM_PADRAO_S });
  const cabeca = plano.cortes[0]!;
  assert.equal(cabeca.inicioQ, 0);
  // respiro de 0,5 a 0,9 s = quadros 15 a 27; o corte vai ate (1,0 - 0,08) * 30 = 27,6 -> 27
  assert.equal(cabeca.fimQ, 27);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — `blocosDeFala is not exported`.

- [ ] **Step 3: Implementar**

Em `src/pausas.ts`, antes da secao "audio do Premiere":

```ts
// ------------------------------------------------------------ fala no audio

/**
 * Como a fala e achada no nivel do audio. Pontos de partida da revisao de
 * 2026-09-21; a Task 7 troca pelos numeros medidos numa bruta real.
 */
export interface OpcoesFala {
  /** Janela conta como SOM quando passa do piso (ruido da sala) por isto. */
  readonly somAcimaDoPisoDb: number;
  /** Janela conta como VOZ FORTE quando fica a menos disto do nivel tipico da fala. */
  readonly vozAbaixoDoTipicoDb: number;
  /** Buraco de voz menor que isto nao separa dois pedacos (fechamento de "p", "t", "k"). */
  readonly buracoMaxS: number;
  /** Quanto antes da voz forte um inicio de palavra ainda pertence a ela (ataque fraco: "s", "f"). */
  readonly ataqueMaxS: number;
  /** Quanto som fraco depois da voz forte fica, como final de palavra. */
  readonly caudaMaxS: number;
  /** Voz forte sem nenhuma palavra: a partir deste tamanho fica (pode ser fala nao transcrita). */
  readonly vozSemPalavraMinS: number;
  /** Tamanho maximo do bloco de uma palavra que comeca no silencio. */
  readonly protecaoMaxS: number;
}

export const FALA_PADRAO: OpcoesFala = {
  somAcimaDoPisoDb: 10,
  vozAbaixoDoTipicoDb: 20,
  buracoMaxS: 0.15,
  ataqueMaxS: 0.15,
  caudaMaxS: 0.15,
  vozSemPalavraMinS: 0.25,
  protecaoMaxS: 0.5,
};

export type MotivoBloco = "fala" | "voz-sem-palavra" | "palavra-baixa";

/** Um pedaco que fica. `texto` sao as palavras que comecam nele. */
export interface Bloco extends Palavra {
  readonly motivo: MotivoBloco;
}

const EPS = 1e-9;

/** Valor na posicao `q` (0..1) dos valores em ordem. */
function percentil(valores: readonly number[], q: number): number {
  const ordenado = [...valores].sort((a, b) => a - b);
  return ordenado[Math.min(ordenado.length - 1, Math.floor(ordenado.length * q))]!;
}

/**
 * Onde tem fala, lido do AUDIO. A transcricao entra so com o inicio de cada
 * palavra — a parte que o Premiere 26 atual ainda marca direito.
 *
 * `db` e o nivel de um canal por janela de `janelaS` segundos, com o zero no
 * mesmo relogio das palavras (tempo de sequencia). O que nao vira bloco e
 * pausa: silencio, respiro, estalo.
 *
 * Nenhum dB fixo: piso (percentil 20) e voz tipica (percentil 90) saem da
 * propria gravacao, entao uma bruta mais baixa da o mesmo resultado.
 */
export function blocosDeFala(
  db: readonly number[],
  janelaS: number,
  palavras: readonly Palavra[],
  opcoes: OpcoesFala = FALA_PADRAO
): Bloco[] {
  const limiarSom = db.length > 0 ? percentil(db, 0.2) + opcoes.somAcimaDoPisoDb : Infinity;
  const limiarVoz = db.length > 0 ? Math.max(limiarSom, percentil(db, 0.9) - opcoes.vozAbaixoDoTipicoDb) : Infinity;
  const t = (janela: number) => janela * janelaS;

  // 1. Nucleos de voz forte. Buraco curto (fechamento de consoante) nao separa.
  const nucleos: Array<{ de: number; ate: number }> = [];
  for (let i = 0; i < db.length; i++) {
    if (db[i]! <= limiarVoz) continue;
    const ultimo = nucleos[nucleos.length - 1];
    if (ultimo && (i - ultimo.ate) * janelaS < opcoes.buracoMaxS - EPS) ultimo.ate = i + 1;
    else nucleos.push({ de: i, ate: i + 1 });
  }

  // O final fraco da palavra ("s", "f") fica, ate o som acabar ou ate caudaMaxS.
  const cauda = (ate: number) => {
    let j = ate;
    while (j < db.length && (j + 1 - ate) * janelaS <= opcoes.caudaMaxS + EPS && db[j]! > limiarSom) j++;
    return t(j);
  };
  const protegida = (p: Palavra): Bloco => ({
    texto: p.texto,
    inicio: p.inicio,
    fim: p.inicio + Math.min(Math.max(p.fim - p.inicio, janelaS), opcoes.protecaoMaxS),
    motivo: "palavra-baixa",
  });

  // 2. Cada nucleo leva as palavras que comecam nele ou no ataque logo antes.
  const emOrdem = [...palavras].sort((a, b) => a.inicio - b.inicio);
  const blocos: Bloco[] = [];
  let k = 0;
  for (const n of nucleos) {
    const de = t(n.de);
    const ate = t(n.ate);
    while (k < emOrdem.length && emOrdem[k]!.inicio < de - opcoes.ataqueMaxS - EPS) blocos.push(protegida(emOrdem[k++]!));
    const primeira = k;
    while (k < emOrdem.length && emOrdem[k]!.inicio < ate - EPS) k++;
    const dele = emOrdem.slice(primeira, k);

    if (dele.length === 0) {
      // Voz sem palavra: longa fica (pode ser fala que a transcricao pulou); curta e estalo.
      if (ate - de >= opcoes.vozSemPalavraMinS - EPS) blocos.push({ texto: "", inicio: de, fim: cauda(n.ate), motivo: "voz-sem-palavra" });
      continue;
    }
    blocos.push({
      texto: dele.map((p) => p.texto).join(" "),
      inicio: Math.min(de, dele[0]!.inicio),
      fim: cauda(n.ate),
      motivo: "fala",
    });
  }
  while (k < emOrdem.length) blocos.push(protegida(emOrdem[k++]!));

  // 3. Blocos que se tocam viram um so.
  blocos.sort((a, b) => a.inicio - b.inicio);
  const juntos: Bloco[] = [];
  for (const b of blocos) {
    const ultimo = juntos[juntos.length - 1];
    if (ultimo && b.inicio <= ultimo.fim + EPS) {
      juntos[juntos.length - 1] = {
        texto: [ultimo.texto, b.texto].filter((x) => x !== "").join(" "),
        inicio: ultimo.inicio,
        fim: Math.max(ultimo.fim, b.fim),
        motivo: ultimo.motivo === "fala" || b.motivo === "fala" ? "fala" : ultimo.motivo,
      };
    } else {
      juntos.push(b);
    }
  }
  return juntos;
}
```

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS — os testes antigos continuam verdes.

- [ ] **Step 5: Commit**

```bash
git add src/pausas.ts tests/pausas.test.ts
git commit -m "feat(pausas): blocos de fala pelo nivel do audio, transcricao so marca onde a palavra comeca"
```

---

### Task 7: Calibração com a bruta real (fora do Premiere)

**Depende do Diagnóstico da Task 5 ter rodado.** Nada da gravação do usuário vai para o git (repo público).

**Files:**
- Create: `scripts/calibrar-pausas.ts`
- Modify: `src/pausas.ts` (valores de `FALA_PADRAO`, com o motivo medido no comentário)
- Modify: `tests/pausas.test.ts` (só se um número mudar o resultado esperado de um teste)
- Modify: `DEV_NOTES.md`

**Interfaces:**
- Consumes: `blocosDeFala`, `FALA_PADRAO`, `planejarCortes`, `montarPalavras`, `lacunas`, `MARGEM_PADRAO_S` (`src/pausas.ts`); `nivelPorJanela` (`src/wav.ts`); `parseTranscricao`, `reconstruirTranscricao` (`ferramentas/auto-broll/src/transcript.ts`).
- Produces: nada de código de produto — só os números de `FALA_PADRAO` e uma prévia de áudio fora do repo.

- [ ] **Step 1: Escrever o script**

```ts
/*
 * Calibracao do Auto Pausas com material real, FORA do Premiere.
 *
 * Le o que o Diagnostico (Task 5) gravou na pasta de dados do plugin, imprime
 * os numeros para escolher FALA_PADRAO e grava previa-pausas.wav: so o audio
 * que ficaria, para ouvir sem abrir o Premiere.
 *
 *   node scripts/calibrar-pausas.ts [--pasta=...] [--margem=0.08] [--vozAbaixoDoTipicoDb=20] ...
 *
 * Nada disto vai para o git: e a gravacao do usuario, e o repo e publico.
 */

import { readFileSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { parseTranscricao, reconstruirTranscricao } from "../ferramentas/auto-broll/src/transcript.ts";
import { blocosDeFala, FALA_PADRAO, lacunas, MARGEM_PADRAO_S, montarPalavras, planejarCortes, type OpcoesFala } from "../src/pausas.ts";
import { nivelPorJanela } from "../src/wav.ts";

const args = new Map(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, "").split("=");
    return [k!, v ?? ""] as const;
  })
);
const pasta =
  args.get("pasta") ??
  join(process.env.APPDATA ?? "", "Adobe", "UXP", "PluginsStorage", "PPRO", "26", "External", "com.leogi.proedition", "PluginData");
const opcoes = { ...FALA_PADRAO } as Record<keyof OpcoesFala, number>;
for (const chave of Object.keys(FALA_PADRAO) as Array<keyof OpcoesFala>) {
  const valor = args.get(chave);
  if (valor !== undefined) opcoes[chave] = Number(valor);
}
const margemS = args.has("margem") ? Number(args.get("margem")) : MARGEM_PADRAO_S;

const bytes = new Uint8Array(readFileSync(join(pasta, "pausas-diag.wav")));
const diag = JSON.parse(readFileSync(join(pasta, "pausas-diag.json"), "utf8"));
const transcricao = parseTranscricao(readFileSync(join(pasta, "pausas-diag-transcricao.json"), "utf8"));
if (!transcricao) throw new Error("transcricao ilegivel");

const janelas = nivelPorJanela(bytes);
const db = janelas.db[0]!;
const janelaS = janelas.janelaMs / 1000;
const clipe = diag.clipe;
const palavras = montarPalavras(reconstruirTranscricao([clipe], new Map([[clipe.sourceName, transcricao]])));

const ordenado = [...db].sort((a, b) => a - b);
const pct = (q: number) => ordenado[Math.min(ordenado.length - 1, Math.floor(ordenado.length * q))]!;
const piso = pct(0.2);
const tipico = pct(0.9);
const limiarSom = piso + opcoes.somAcimaDoPisoDb;
const limiarVoz = Math.max(limiarSom, tipico - opcoes.vozAbaixoDoTipicoDb);
console.log(`audio: ${(db.length * janelaS).toFixed(1)} s · ${janelas.taxa} Hz · ${janelas.db.length} canal(is)`);
console.log(`piso p20 ${piso.toFixed(1)} dB · voz p90 ${tipico.toFixed(1)} dB · limiar som ${limiarSom.toFixed(1)} · limiar voz ${limiarVoz.toFixed(1)}`);

// 1. A transcricao do 26 ainda marca pausa?
const brutas = transcricao.segments.flatMap((s) => s.words.filter((w) => w.type === "word"));
console.log("lacunas da transcricao:", lacunas(brutas));

// 2. Quanto o inicio da transcricao erra em relacao a voz forte mais proxima (ate 0,3 s).
const inicioForte = (s: number) => {
  for (let d = 0; d <= 0.3 / janelaS; d++) {
    for (const i of [Math.round(s / janelaS) + d, Math.round(s / janelaS) - d]) if (db[i] !== undefined && db[i]! > limiarVoz) return i * janelaS - s;
  }
  return null;
};
const erros = palavras.map((p) => inicioForte(p.inicio)).filter((e): e is number => e !== null).sort((a, b) => a - b);
const q = (lista: number[], x: number) => lista[Math.floor((lista.length - 1) * x)]?.toFixed(3);
console.log(`erro do inicio (voz forte - transcricao), s: p10 ${q(erros, 0.1)} · p50 ${q(erros, 0.5)} · p90 ${q(erros, 0.9)} · sem voz perto: ${palavras.length - erros.length}`);

// 3. Candidatos a respiro: trechos de som fraco (entre os dois limiares) sem inicio de palavra, >= 0,15 s.
const respiros: Array<{ de: number; ate: number; pico: number }> = [];
for (let i = 0; i < db.length; ) {
  if (db[i]! > limiarSom && db[i]! <= limiarVoz) {
    let j = i;
    let pico = -Infinity;
    while (j < db.length && db[j]! > limiarSom && db[j]! <= limiarVoz) pico = Math.max(pico, db[j++]!);
    const de = i * janelaS;
    const ate = j * janelaS;
    if (ate - de >= 0.15 && !palavras.some((p) => p.inicio >= de && p.inicio < ate)) respiros.push({ de, ate, pico });
    i = j;
  } else i++;
}
const picos = respiros.map((r) => r.pico - tipico).sort((a, b) => a - b);
console.log(`respiros candidatos: ${respiros.length} · pico relativo a voz: p50 ${q(picos, 0.5)} · p90 ${q(picos, 0.9)} · max ${q(picos, 1)}`);

// 4. Resultado com as opcoes atuais.
const blocos = blocosDeFala(db, janelaS, palavras, opcoes);
const conta = (m: string) => blocos.filter((b) => b.motivo === m).length;
console.log(`blocos: ${blocos.length} · fala ${conta("fala")} · voz sem palavra ${conta("voz-sem-palavra")} · palavra baixa ${conta("palavra-baixa")}`);
for (const b of blocos.filter((b) => b.motivo !== "fala")) console.log(`  ${b.motivo} em ${b.inicio.toFixed(2)}-${b.fim.toFixed(2)} s`);
const fps = diag.fps as number;
const plano = planejarCortes(blocos, { fps, duracaoQ: Math.round((clipe.endSeconds - clipe.startSeconds) * fps), margemS });
console.log(`cortes: ${plano.cortes.length} · ${(plano.duracaoAntesQ / fps).toFixed(1)} s -> ${(plano.duracaoDepoisQ / fps).toFixed(1)} s`);

// 5. Previa para ouvir: so o que fica, colado. Mono 16 bits, mesma taxa.
const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
let dados = -1;
for (let p = 12; p + 8 <= bytes.byteLength; ) {
  const id = String.fromCharCode(bytes[p]!, bytes[p + 1]!, bytes[p + 2]!, bytes[p + 3]!);
  const tamanho = v.getUint32(p + 4, true);
  if (id === "data") {
    dados = p + 8;
    break;
  }
  p += 8 + tamanho + (tamanho % 2);
}
const amostras = (s: number) => Math.round(s * janelas.taxa) * 2;
const pedacos = plano.trechos.map((tr) => bytes.subarray(dados + amostras(tr.inicioQ / fps), dados + amostras(tr.fimQ / fps)));
const total = pedacos.reduce((n, p) => n + p.byteLength, 0);
const saida = new Uint8Array(44 + total);
saida.set(bytes.subarray(0, 36));
new DataView(saida.buffer).setUint32(4, 36 + total, true);
saida.set([0x64, 0x61, 0x74, 0x61], 36);
new DataView(saida.buffer).setUint32(40, total, true);
let cursor = 44;
for (const p of pedacos) {
  saida.set(p, cursor);
  cursor += p.byteLength;
}
const destino = join(homedir(), "Desktop", "previa-pausas.wav");
writeFileSync(destino, saida);
console.log(`previa gravada em ${destino}`);
```

A prévia copia os 36 primeiros bytes do WAV original (RIFF + `fmt ` de 16 bytes). **Conferir no Step 2** que o `fmt ` do arquivo do Premiere tem 16 bytes (a linha `audio:` do script e um `xxd -l 64` do WAV mostram). Se o `fmt ` for maior ou vier chunk antes dele, escrever o cabeçalho de 44 bytes na mão, como a função `wav16` dos testes.

- [ ] **Step 2: Rodar e ler**

Run: `node scripts/calibrar-pausas.ts`
Ler, nesta ordem:
- `lacunas da transcricao` — registrar se o 26 atual marca pausa;
- `erro do inicio` — se o p90 passar de `ataqueMaxS` (0,15 s), subir `ataqueMaxS` para cobrir o p90;
- `respiros candidatos` — o pico relativo p90 dos respiros tem de ficar ABAIXO de `-vozAbaixoDoTipicoDb` (-20 dB); se não ficar, ajustar `vozAbaixoDoTipicoDb` para ficar entre o pico dos respiros e o nível das palavras;
- `voz sem palavra` e `palavra baixa` — conferir cada tempo: são fala de verdade?
Rodar de novo com `--chave=valor` até os números fecharem.

- [ ] **Step 3: Pedir ao usuário para ouvir a prévia**

Mensagem: "Deixei no seu Desktop o arquivo `previa-pausas.wav`: é o áudio da bruta que você usou no Diagnóstico, já sem as pausas. Ouça e me diga: (1) cortou algum pedaço de palavra? (2) sobrou respiro? (3) o ritmo está colado como você quer?" Ajustar e regravar a prévia até ele aprovar. A margem (`--margem`) entra nessa mesma conversa.

- [ ] **Step 4: Fixar os números**

Em `src/pausas.ts`, trocar os valores de `FALA_PADRAO` (e `MARGEM_PADRAO_S`, se a prévia pediu) pelos aprovados, com o motivo medido no comentário de cada campo (ex.: `// respiros da bruta de 21/09: pico p90 -27 dB abaixo da voz`). Atualizar os testes da Task 6 só se o número mudar um resultado esperado.

- [ ] **Step 5: Registrar e commitar**

Em `DEV_NOTES.md`, seção "Auto Pausas": os números medidos (níveis, lacunas, erro do início, respiros), sem nenhum texto da fala.

Run: `npm run verify`

```bash
git add scripts/calibrar-pausas.ts src/pausas.ts tests/pausas.test.ts DEV_NOTES.md
git commit -m "feat(pausas): numeros da regra calibrados com uma bruta real e script de calibracao"
```

Conferir com `git status` que nenhum `.wav` ou `pausas-diag*` entrou.

---

### Task 8: O painel lê o áudio (análise e prévia)

**Files:**
- Modify: `src/pausas-premiere.ts` (`analisarGravacao`, recusa de clipe fora do 00:00)
- Modify: `src/ui/pausas.html` (botão Analisar)
- Modify: `src/ui/pausas-mount.ts`
- Modify: `src/pausas.ts` (`ultimaPalavra`, `primeiraPalavra`)
- Test: `tests/pausas.test.ts`

**Interfaces:**
- Consumes: `exportarAudio`, `apagarArquivo`, `lerGravacao` (Task 5); `blocosDeFala`, `Bloco` (Task 6); `nivelPorJanela` (`src/wav.ts`).
- Produces:
  ```ts
  // src/pausas-premiere.ts
  export interface Analise extends Gravacao {
    readonly blocos: readonly Bloco[];
    readonly segundosAudio: number;
  }
  export async function analisarGravacao(): Promise<Analise>;
  // src/pausas.ts
  export function ultimaPalavra(texto: string): string;
  export function primeiraPalavra(texto: string): string;
  ```

- [ ] **Step 1: Write the failing test**

```ts
import { primeiraPalavra, ultimaPalavra } from "../src/pausas.ts";

test("o registro mostra so a palavra de cada lado do corte", () => {
  assert.equal(ultimaPalavra("a consulta de hoje"), "hoje");
  assert.equal(primeiraPalavra("então vamos"), "então");
  assert.equal(ultimaPalavra(""), "…");
  assert.equal(primeiraPalavra(""), "…");
});
```

- [ ] **Step 2: Run test to verify it fails**

Run: `npm test`
Expected: FAIL — `ultimaPalavra is not exported`.

- [ ] **Step 3: Implementar**

Em `src/pausas.ts`:

```ts
/** Um bloco leva a frase inteira; o registro mostra so a palavra encostada no corte. */
export function ultimaPalavra(texto: string): string {
  return texto.trim().split(/\s+/).pop() || "…";
}

export function primeiraPalavra(texto: string): string {
  return texto.trim().split(/\s+/)[0] || "…";
}
```

Em `src/pausas-premiere.ts` — a gravacao tem de comecar no zero da sequencia, porque o WAV exportado comeca no zero e o plano conta quadros a partir dele. Em `lerClipeETranscricao`, depois da checagem de `clipes.length > 1`:

```ts
  if (Math.abs(clipes[0]!.startSeconds) > 0.001) {
    throw new Error("A gravação precisa começar no início da sequência (00:00). Arraste o clipe para o começo e rode de novo.");
  }
```

E a analise (o WAV temporario nunca fica):

```ts
export interface Analise extends Gravacao {
  readonly blocos: readonly Bloco[];
  readonly segundosAudio: number;
}

/** Transcricao + audio -> blocos de fala. Nao toca na timeline. */
export async function analisarGravacao(): Promise<Analise> {
  const g = await lerGravacao();
  const audio = await exportarAudio("pausas-audio.wav");
  try {
    const janelas = nivelPorJanela(audio.bytes);
    return {
      ...g,
      blocos: blocosDeFala(janelas.db[0] ?? [], janelas.janelaMs / 1000, g.palavras),
      segundosAudio: audio.ms / 1000,
    };
  } finally {
    await apagarArquivo(audio.caminho);
  }
}
```

(com `blocosDeFala` e `type Bloco` no import de `./pausas.ts`).

Em `src/ui/pausas.html`, dentro de `.acao`, antes do `apCortar`:

```html
    <sp-button id="apAnalisar" variant="secondary">Analisar</sp-button>
```

Em `src/ui/pausas-mount.ts`: abrir a tela so le a sequencia (rapido, sem export); o botao Analisar faz a previa com o audio.

```ts
  const abrir = async () => {
    const g = await lerGravacao();
    const nome = pega("apSeqNome");
    nome.textContent = g.nomeSequencia;
    nome.setAttribute("data-vazio", "nao");
    pega("apDica").style.display = "none";
    escrever(`${g.palavras.length} palavras na transcrição. Clique em Analisar para ver os cortes.`);
    estado("pronto", "ok");
  };

  const previa = async () => {
    estado("lendo áudio…", "ativo");
    escrever("Exportando o áudio da sequência e medindo a fala...");
    const a = await analisarGravacao();
    const margemS = lerMargem(pega<HTMLInputElement>("apMargem").value);
    const plano = planejarCortes(a.blocos, { fps: a.fps, duracaoQ: a.duracaoQ, margemS });
    const avisos = a.blocos.filter((b) => b.motivo !== "fala");
    escrever(
      `${plano.cortes.length} pausas para cortar · ${relogio(plano.duracaoAntesQ, a.fps)} → ${relogio(plano.duracaoDepoisQ, a.fps)}`,
      `${a.palavras.length} palavras · ${a.blocos.length} blocos de fala · áudio lido em ${a.segundosAudio.toFixed(1).replace(".", ",")} s · margem ${String(margemS).replace(".", ",")} s`,
      ...avisos.map((b) =>
        b.motivo === "voz-sem-palavra"
          ? `${relogio(Math.round(b.inicio * a.fps), a.fps)} · voz sem palavra na transcrição (fica)`
          : `${relogio(Math.round(b.inicio * a.fps), a.fps)} · palavra baixa protegida: "${b.texto}"`
      ),
      "",
      ...plano.cortes.map((c) => {
        const seg = ((c.fimQ - c.inicioQ) / a.fps).toFixed(1).replace(".", ",");
        const aviso = c.fimQ - c.inicioQ > a.fps ? "  <- confira" : "";
        return `${relogio(c.inicioQ, a.fps)} · ${seg} s · "${ultimaPalavra(c.antes)}" | "${primeiraPalavra(c.depois)}"${aviso}`;
      })
    );
    estado("prévia pronta", "ok");
  };

  void abrir().catch(mostrarErro);
  pega("apAnalisar").addEventListener("click", () => void previa().catch(mostrarErro));
```

(o `void previa().catch(mostrarErro)` antigo, que rodava ao abrir, sai; imports passam a ser `analisarGravacao, diagnostico, lerGravacao` e `MARGEM_PADRAO_S, planejarCortes, primeiraPalavra, ultimaPalavra`).

- [ ] **Step 4: Verificar**

Run: `npm run verify`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/pausas.ts src/pausas-premiere.ts src/ui/pausas.html src/ui/pausas-mount.ts tests/pausas.test.ts
git commit -m "feat(pausas): analisar le o audio da sequencia e mostra a previa dos cortes"
```

- [ ] **Step 6: Teste do usuário (curto)**

Reiniciar o Premiere, abrir uma bruta, Auto Pausas → **Analisar**. Conferir que a prévia bate com o que a Task 7 aprovou e anotar quanto tempo a análise levou.

---

### Task 9: Aplicar o corte e conferir o resultado

**Files:**
- Modify: `src/pausas.ts` (`conferirPalavras` passa a comparar texto e ordem)
- Modify: `src/pausas-premiere.ts` (`aplicarPausas`, `executarPlano`, `conferirSincronia`)
- Modify: `src/ui/pausas-mount.ts`
- Test: `tests/pausas.test.ts`

**Interfaces:**
- Consumes: `Plano`, `deslocamentos`, `fonteDoTrecho` (Task 1), `analisarGravacao` (Task 8), o ruling da Task 5.
- Produces:
  ```ts
  // src/pausas.ts
  export function conferirPalavras(antes: readonly Palavra[], depois: readonly Palavra[]): { ok: boolean; linhas: string[] };
  // src/pausas-premiere.ts
  export async function aplicarPausas(margemS: number): Promise<{ readonly ok: boolean; readonly linhas: readonly string[] }>;
  ```

- [ ] **Step 1: Write the failing tests**

Trocar os quatro testes antigos de `conferirPalavras` (os de duração) por estes, e apagar a constante `umQuadro`, que só eles usavam:

```ts
test("conferirPalavras aprova as mesmas palavras na mesma ordem, mesmo com duracao diferente", () => {
  const antes: Palavra[] = [
    { texto: "ola", inicio: 1, fim: 3 }, // o 26 estica o fim por cima do silencio
    { texto: "mundo", inicio: 3, fim: 3.5 },
  ];
  const depois: Palavra[] = [
    { texto: "ola", inicio: 0.08, fim: 0.6 },
    { texto: "mundo", inicio: 0.7, fim: 1.2 },
  ];
  const r = conferirPalavras(antes, depois);
  assert.equal(r.ok, true);
  assert.match(r.linhas.join("\n"), /2 de 2 palavras presentes/);
});

test("conferirPalavras reprova e nomeia a palavra que sumiu", () => {
  const antes: Palavra[] = [
    { texto: "um", inicio: 1, fim: 1.5 },
    { texto: "dois", inicio: 2, fim: 2.5 },
    { texto: "tres", inicio: 3, fim: 3.5 },
  ];
  const depois: Palavra[] = [
    { texto: "um", inicio: 0, fim: 0.5 },
    { texto: "tres", inicio: 0.6, fim: 1.1 },
  ];
  const r = conferirPalavras(antes, depois);
  assert.equal(r.ok, false);
  assert.match(r.linhas.join("\n"), /"dois"/);
  assert.match(r.linhas.join("\n"), /2 de 3/);
});

test("conferirPalavras reprova palavra sobrando e ordem trocada", () => {
  const antes: Palavra[] = [
    { texto: "um", inicio: 1, fim: 1.5 },
    { texto: "dois", inicio: 2, fim: 2.5 },
  ];
  assert.equal(conferirPalavras(antes, [...antes, { texto: "dois", inicio: 3, fim: 3.5 }]).ok, false);
  assert.equal(conferirPalavras(antes, [antes[1]!, antes[0]!]).ok, false);
});
```

- [ ] **Step 2: Run tests to verify they fail**

Run: `npm test`
Expected: FAIL — a chamada sem `toleranciaS` falha na checagem de tipos e o texto "presentes" nao existe.

- [ ] **Step 3: Implementar a conferencia**

Substituir `conferirPalavras` em `src/pausas.ts`:

```ts
/**
 * Prova de que o corte nao comeu fala: as mesmas palavras, na mesma ordem.
 *
 * A duracao NAO entra: no Premiere 26 atual o fim da palavra vem esticado por
 * cima do silencio, e cortar esse silencio e exatamente o trabalho da
 * ferramenta. Palavra que sumiu e a que teve o INICIO cortado — a remontagem
 * da transcricao so traz palavra cujo inicio esta dentro de um trecho que ficou.
 *
 * Roda sobre a transcricao relida DA TIMELINE depois de aplicar, nunca sobre o plano.
 */
export function conferirPalavras(
  antes: readonly Palavra[],
  depois: readonly Palavra[]
): { ok: boolean; linhas: string[] } {
  const sumiram: string[] = [];
  let j = 0;
  for (const a of antes) {
    if (j < depois.length && depois[j]!.texto === a.texto) j++;
    else sumiram.push(`"${a.texto}" (${a.inicio.toFixed(2)} s) sumiu`);
  }
  const sobrando = depois.length - j;
  const presentes = antes.length - sumiram.length;

  if (sumiram.length === 0 && sobrando === 0) {
    return { ok: true, linhas: [`${antes.length} de ${antes.length} palavras presentes.`] };
  }
  return {
    ok: false,
    linhas: [
      `${presentes} de ${antes.length} palavras presentes:`,
      ...sumiram.slice(0, 10),
      ...(sumiram.length > 10 ? [`e mais ${sumiram.length - 10}`] : []),
      ...(sobrando > 0 ? [`${sobrando} palavra(s) a mais ou fora de ordem`] : []),
    ],
  };
}
```

Ordem trocada (`[dois, um]` contra `[um, dois]`): "um" não casa com `depois[0]` e conta como sumida, "dois" casa, sobra 1 → reprova. Coberto pelo teste.

- [ ] **Step 4: Run tests to verify they pass**

Run: `npm test`
Expected: PASS.

- [ ] **Step 5: Implementar a mecânica escolhida no ruling da Task 5**

Em `src/pausas-premiere.ts`, `executarPlano(plano, fps): Promise<number>` (devolve quantas transações = quantos Ctrl+Z). Regras que valem para qualquer mecânica:
- handles novos a cada transação (`ativa()` e `itensDa()` de novo) — `lockedAccess` invalida o que foi pego antes;
- V1 **e** A1 em toda operação: o clone e o setInPoint atingem só a faixa do item (provado);
- o instante de mídia de cada trecho vem de `fonteDoTrecho({ baseInicioQ: 0, baseFonteQ: round(clipe.inPointSeconds * fps) }, trecho.inicioQ)`.

**Mecânica A** (ruling "FICOU") — cortes do ÚLTIMO para o primeiro, para os tempos de antes não andarem. Para cada corte `[s, e]` (quadros → `TickTime.createWithSeconds(q / fps)`):
1. uma transação: `createCloneTrackItemAction(item, e - inicioDoItem, 0, 0, true, false)` no item da V1 e no da A1 que contêm `e`;
2. uma transação: o mesmo em `s`;
3. uma transação: `createSetInPointAction` nos dois pedaços que começam em `s` e em `e` (V1 e A1), com o instante de mídia de `fonteDoTrecho`;
4. uma transação: selecionar os dois pedaços que começam em `s` (`sequence.getSelection()`, `removeItem` de tudo, `addItem` dos dois) e `createRemoveItemsAction(selecao, true, ppro.Constants.MediaType.ANY)`.
Depois do primeiro corte, reler a timeline e conferir que o último pedaço termina `e - s` quadros antes; se não, parar e devolver erro com o retrato.

**Mecânica B** (ruling "ANDOU" + move ok): a A, com um `createMoveAction` depois do passo 3, levando cada pedaço de volta ao início que ele tinha antes do setInPoint (absoluto ou relativo, conforme a linha C do Diagnóstico).

**Mecânica C** (ruling D "respeita o in/out"):
1. uma transação: remover os itens da V1 e da A1 (`createRemoveItemsAction(selecao, false, ANY)`, sem ripple);
2. para cada trecho, em ordem: `createSetInOutPointsAction(fonte, fonte + duração)` no `ClipProjectItem` e `createOverwriteItemAction(clip, destino, 0, 0)` — tentar primeiro TODOS os pares numa transação só; se a releitura mostrar pedaço errado, um par por transação;
3. devolver o in/out do item ao que era (`createSetInOutPointsAction` com os valores lidos antes).

Escolher entre as candidatas pela que fecha com menos transações e anotar no `DEV_NOTES.md`.

- [ ] **Step 6: `aplicarPausas` e a conferência**

```ts
/** A1 e V1 com os mesmos pedacos nas mesmas posicoes — audio nao pode dessincronizar. */
async function conferirSincronia(): Promise<string | null> {
  const { sequence } = await ativa();
  const retrato = async (video: boolean) =>
    Promise.all(
      (await itensDa(sequence, video, 0)).map(async (i) => `${(await i.getStartTime()).seconds.toFixed(3)}-${(await i.getEndTime()).seconds.toFixed(3)}`)
    );
  const v = await retrato(true);
  const a = await retrato(false);
  return v.join("|") === a.join("|") ? null : `V1 tem ${v.length} pedaços e A1 tem ${a.length}, ou em posições diferentes.`;
}

export async function aplicarPausas(margemS: number): Promise<{ readonly ok: boolean; readonly linhas: readonly string[] }> {
  const a = await analisarGravacao();
  const plano = planejarCortes(a.blocos, { fps: a.fps, duracaoQ: a.duracaoQ, margemS });
  if (plano.cortes.length === 0) return { ok: true, linhas: ["Nenhuma pausa para cortar."] };

  const transacoes = await executarPlano(plano, a.fps);

  // Conferir LENDO A TIMELINE, nunca pelo que foi pedido.
  const clipes = await lerClipes(0);
  const { transcricoes } = await lerTranscricoes([...new Set(clipes.map((c) => c.sourceName))]);
  const mapa = new Map<string, TranscricaoOrigem>();
  for (const [nome, json] of transcricoes) {
    const t = parseTranscricao(json);
    if (t) mapa.set(nome, t);
  }
  const depois = montarPalavras(reconstruirTranscricao(clipes, mapa));
  const conferencia = conferirPalavras(a.palavras, depois);
  const sincronia = await conferirSincronia();

  return {
    ok: conferencia.ok && sincronia === null,
    linhas: [
      `${plano.cortes.length} pausas cortadas · ${relogio(plano.duracaoAntesQ, a.fps)} → ${relogio(plano.duracaoDepoisQ, a.fps)}`,
      ...conferencia.linhas,
      sincronia ?? "V1 e A1 em sincronia.",
      `Para desfazer: ${transacoes} Ctrl+Z.`,
    ],
  };
}
```

(`type TranscricaoOrigem` entra no import de `transcript.ts`. `relogio` sai de `pausas-mount.ts` e vai, igual, para `src/pausas.ts` — o adapter e o mount importam de lá.)

- [ ] **Step 7: Ligar o botão**

Em `src/ui/pausas-mount.ts`, o `apCortar` passa a chamar `aplicarPausas(lerMargem(...))`, com `estado("cortando…", "ativo")` antes, `estado(r.ok ? "cortado" : "cortado com problema", r.ok ? "ok" : "erro")` depois e `escrever(...r.linhas)`.

- [ ] **Step 8: Verificar e commitar**

Run: `npm run verify`
Expected: PASS

```bash
git add src/pausas.ts src/pausas-premiere.ts src/ui/pausas-mount.ts tests/pausas.test.ts
git commit -m "feat(pausas): aplica o corte e confere palavra a palavra relendo a timeline"
```

---

**Como a Task 9 ficou de verdade (2026-09-21, depois das rodadas 4-6):** mecanica C encadeada, so com chamadas provadas no 25.6.6 — sem selecao nem remove (nunca provados no 25). (1) uma transacao "preparar": `createSetEndAction` na V1 e na A1 da bruta ate o tamanho final + marca do trecho 0; (2) transacao k: `createOverwriteItemAction(ProjectItem cru, destino k, 0, 0)` + marca do trecho k+1 (no ultimo, devolve a marca original ou `createClearInOutPointsAction`); (3) depois do trecho 0, confere tamanho E quadro de midia do pedaco antes de seguir; erro em qualquer passo chama `desfazerPausas`. `desfazerPausas` = marcar o in/out original + overwrite da bruta inteira no zero (cobre os trechos) + devolver as marcas: 2 transacoes. Conferencia: palavras (texto/ordem), V1=A1, N pedacos = N trechos, fim = duracao do plano (+-1 quadro). Botao Desfazer no painel; o estado vai em `pausas-desfazer.json`.

---

### Task 9b: Sequência separada pelo editor (vários clipes na V1)

Pedido de 2026-09-21, depois do primeiro corte real: o editor pica a bruta para separar os vídeos e SÓ DEPOIS tira as pausas. Mesma regra de pausa; muda a leitura e a montagem.

- **Pura (`src/pausas.ts`):** `pedacosDoPlano(trechos, clipes)` divide cada trecho que fica nas emendas do editor e diz, para cada pedaço, de que item de projeto (`fonte`), de que quadro a que quadro da mídia, e onde entra. Destinos contíguos a partir de 0 — um buraco entre clipes dentro de um trecho fecha, nunca deixa aparecer conteúdo velho. Testes: um clipe; trecho atravessando emenda; duas fontes; buraco entre clipes; clipe com in ≠ 0.
- **Adapter:** lê todos os clipes da V1 (posição, in, velocidade, item do projeto) e a A1; recusa velocidade ≠ 1 e A1 que não acompanha a V1. Transcrição de cada fonte pelo próprio item (nunca por nome). O 00:00 deixa de ser exigido (buraco no começo é silêncio e sai).
- **Corte:** o mesmo encadeamento (overwrite do pedaço k com a marca feita na transação anterior + marca do k+1), agora por pedaço e por fonte; no fim, devolve as marcas de todas as fontes tocadas e remove o que sobrou depois do último pedaço com `TrackItemSelection.createEmptySelection` + `createRemoveItemsAction(sel, false, ANY, false)` — o molde do Auto B-roll, provado no 25 e no 26 ("audio removido de N B-rolls"). Sai o "preparar" com `createSetEndAction`.
- **Desfazer:** guarda a lista dos clipes originais (posição, in/out, fonte) e as marcas de cada fonte; tira tudo da V1/A1 e recoloca clipe a clipe pelo mesmo encadeamento.

---

### Task 10: Calibrar a margem no Premiere, tirar a sonda e documentar

**PARA O EXECUTOR: a calibração é um teste do usuário. Não chute o número.**

**Files:**
- Modify: `src/pausas.ts` (`MARGEM_PADRAO_S`, se o teste pedir; remover `lacunas`, que só o Diagnóstico usa)
- Modify: `src/pausas-premiere.ts` (remover `diagnostico`, `sondaMecanica`, `sondaOverwrite`)
- Modify: `src/ui/pausas.html` (remover o botão Diagnóstico), `src/ui/pausas-mount.ts`
- Modify: `tests/pausas.test.ts` (remover o teste de `lacunas`)
- Modify: `DEV_NOTES.md`, `docs/GUIA-DE-USO.md`

- [x] **Step 1: Pedir o teste ao usuário**

Aplicar ("Cortar pausas") num anúncio real e ouvir: fala colada demais (aumentar a margem) ou sobrando ar (diminuir). Pedir também o número de Ctrl+Z que desfez tudo e se a conferência disse "N de N palavras presentes".

**Feito (2026-09-21, Premiere 26.5.0, bruta de 15:32 em 10 vídeos):** ritmo aprovado com margem **0,08** ("ficou bom"), conferência "1832 de 1832 palavras presentes", corte em 4,1 s. Duas queixas viraram commits: velocidade (`37cddc5`) e fala cortada no fim da palavra (`470aad0`). **Falta ele ouvir o resultado do `470aad0`** antes do Step 3: se a última sílaba voltou em "telemedicina", "desmentir" e "explicar", e se o respiro de 5:04 ("coisa," → "Respirar") incomoda.

- [x] **Step 2: Ajustar a margem padrão**

0,08 já era o padrão e foi o valor aprovado: `MARGEM_PADRAO_S` e o `value` do `apMargem` ficam como estão.

- [ ] **Step 3: Remover a sonda**

Apagar `diagnostico`, `sondaMecanica` e `sondaOverwrite` de `src/pausas-premiere.ts`, `lacunas` de `src/pausas.ts` e o teste dela, o botão `apDiag` do HTML e o listener do mount. Os arquivos `pausas-diag*` ficam só na pasta do plugin (nunca no git).

- [ ] **Step 4: Documentar**

- `DEV_NOTES.md`, seção "Auto Pausas": a mecânica que venceu, o número de Ctrl+Z, o tempo de export por minuto de áudio, os números calibrados e os limites conhecidos (gravação precisa começar em 00:00; só Windows).
- `docs/GUIA-DE-USO.md`: seção Auto Pausas em linguagem de editor — o que precisa estar na timeline, Analisar, Cortar pausas, o que significam "voz sem palavra" e "palavra baixa protegida", como desfazer.

- [ ] **Step 5: Verify e commit**

```bash
npm run verify
git add -A
git commit -m "feat(pausas): margem calibrada, sonda removida e guia de uso"
```

Conferir antes com `git status` que nenhum `.wav` ou `pausas-diag*` está no stage.

- [ ] **Step 6: Fechar o branch**

Rodar `superpowers:finishing-a-development-branch`.
