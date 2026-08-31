# Auto-update do Pro Edition + merge de aprendizado — Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Cada máquina descobre sozinha que há versão nova do Pro Edition e a pessoa atualiza com um clique; a atualização também traz o aprendizado que o dono ensina, somado (sem contar em dobro) ao que a máquina da editora já aprendeu.

**Architecture:** Quatro peças. (1) Um repo público novo `Pro-Edition-dist` recebe só o build + `VERSION` + `aprendizado-canonico.json`; o código-fonte segue privado. (2) O painel, no boot, faz `fetch` do `VERSION` e mostra uma faixa se houver versão nova. (3) `npm run release` na máquina do dono gera o snapshot canônico (só aprendizado, sem `vistos`) e publica no repo de distribuição. (4) Scripts `Atualizar` por SO baixam o build e jogam o snapshot no `PluginData`; na abertura seguinte o plugin funde o canônico com o aprendizado local por baseline-delta.

**Tech Stack:** TypeScript (Node 24 roda `.ts` nativo, sem transpile em teste), esbuild, `node --test` (sem framework), PowerShell + bash para os instaladores, `gh` CLI para criar o repo público, `curl` + `tar` nativos (Windows 10 1803+ e macOS).

**Spec:** `docs/superpowers/specs/2026-08-31-auto-update-e-merge-aprendizado-design.md`

## Global Constraints

- **Dois repositórios de código:** `C:\Users\leogi\Desktop\Pro-Edition` (shell, privado, `github.com/leogiora/Pro-Edition`) e `C:\Users\leogi\Desktop\auto-broll-premiere` (dono do schema de aprendizado, privado). O Premiere só roda o build do `Pro-Edition` — mexer em `auto-broll-premiere/src` exige `npm run build` **no Pro-Edition**.
- **Repo público novo:** `github.com/leogiora/Pro-Edition-dist` — só saída compilada, ninguém edita à mão.
- **`npm run verify`** (= `check` + `test` + `build`) tem de passar nos dois repos de código ao fim de cada fase. Sem framework de teste: `import { test } from "node:test"` + `import assert from "node:assert/strict"`.
- **Nunca tocar** em `vistos` (dentro de `aprendizado.json`), `pendentes.json`, `config.json`, `frases.json`, `intensidade.json` no merge nem no snapshot.
- **Merge é mão única:** dono → editoras. O aprendizado da editora nunca é apagado; delta negativo vira 0.
- **Regra do teto:** `TETO = 20` em `auto-broll-premiere/src/aprendizado.ts` — enquanto `acertos + erros > 20`, os dois são divididos por 2 (`Math.round`). O merge reusa exatamente essa regra.
- **`tsconfig` do Pro-Edition:** `strict`, `noUncheckedIndexedAccess`, `exactOptionalPropertyTypes`, `verbatimModuleSyntax`. Import de `.ts` com extensão explícita. `type`-only imports com a keyword `type`.
- **Branch:** criar `auto-update` nos dois repos de código a partir do estado atual antes da Task 1 (`Pro-Edition` está hoje na branch `auto-split`; ramificar a partir dela para não perder o trabalho em curso — confirmar com o usuário se a base deve ser `auto-split` ou `main`).
- **Commits:** terminar a mensagem com as duas linhas
  `Co-Authored-By: Claude Sonnet 5 <noreply@anthropic.com>` e
  `Claude-Session: https://claude.ai/code/session_01QAyaz2ybncVQgpNjVTd1mV`.

---

## Fase 1 — Merge de aprendizado (`auto-broll-premiere`)

Nada aqui depende de rede ou dos scripts. Ao fim da fase o plugin já sabe
fundir um `aprendizado-canonico.json` que aparecer no `PluginData` — mesmo que
ainda não haja como esse arquivo chegar lá.

### Task 1: Extrair `aplicarTeto` em `aprendizado.ts`

O merge precisa da mesma regra de decaimento que `somar()` usa. Hoje ela está
embutida no corpo de `somar()`. Extrair para função exportada e fazer `somar()`
chamá-la — sem mudar comportamento.

**Files:**
- Modify: `C:\Users\leogi\Desktop\auto-broll-premiere\src\aprendizado.ts:164-177`
- Test: `C:\Users\leogi\Desktop\auto-broll-premiere\tests\aprendizado.test.ts` (adicionar casos)

**Interfaces:**
- Produces: `export function aplicarTeto(s: Saldo): Saldo` — soma já feita na entrada; devolve o saldo com o teto aplicado (`acertos + erros <= 20`).

- [ ] **Step 1: Escrever o teste que falha**

Adicionar ao fim de `tests/aprendizado.test.ts`:

```ts
import { aplicarTeto } from "../src/aprendizado.ts";

test("aplicarTeto: abaixo do teto nao mexe", () => {
  assert.deepEqual(aplicarTeto({ acertos: 10, erros: 5 }), { acertos: 10, erros: 5 });
});

test("aplicarTeto: no teto exato nao mexe", () => {
  assert.deepEqual(aplicarTeto({ acertos: 18, erros: 2 }), { acertos: 18, erros: 2 });
});

test("aplicarTeto: acima do teto divide os dois lados ate caber", () => {
  // 30+4 = 34 > 20 -> 15+2 = 17 <= 20
  assert.deepEqual(aplicarTeto({ acertos: 30, erros: 4 }), { acertos: 15, erros: 2 });
});

test("aplicarTeto: divide mais de uma vez se precisar", () => {
  // 100+0 -> 50 -> 25 -> 13 (Math.round(25/2)=13); 13 <= 20
  assert.deepEqual(aplicarTeto({ acertos: 100, erros: 0 }), { acertos: 13, erros: 0 });
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `cd /c/Users/leogi/Desktop/auto-broll-premiere && npx tsc --noEmit`
Expected: FAIL — `aplicarTeto` não é exportado.

- [ ] **Step 3: Implementar**

Em `src/aprendizado.ts`, substituir o bloco `const TETO = 20;` + `function somar(...)` (linhas ~164-177) por:

```ts
const TETO = 20;

/** Aplica o decaimento do teto a um saldo ja somado. */
export function aplicarTeto(s: Saldo): Saldo {
  let acertos = s.acertos;
  let erros = s.erros;
  while (acertos + erros > TETO) {
    acertos = Math.round(acertos / 2);
    erros = Math.round(erros / 2);
  }
  return { acertos, erros };
}

/** Soma um acerto ou um erro numa das contagens, com decaimento. */
function somar(mapa: Record<string, Saldo>, k: string, sobreviveu: boolean): void {
  const atual = mapa[k] ?? { acertos: 0, erros: 0 };
  mapa[k] = aplicarTeto({
    acertos: atual.acertos + (sobreviveu ? 1 : 0),
    erros: atual.erros + (sobreviveu ? 0 : 1),
  });
}
```

- [ ] **Step 4: Rodar os testes**

Run: `cd /c/Users/leogi/Desktop/auto-broll-premiere && npm test`
Expected: PASS — os 4 novos e todos os antigos de `aprendizado.test.ts` (o comportamento de `somar` não mudou).

- [ ] **Step 5: Commit**

```bash
cd /c/Users/leogi/Desktop/auto-broll-premiere
git add src/aprendizado.ts tests/aprendizado.test.ts
git commit -m "refactor: extrair aplicarTeto de somar() para reuso no merge"
```

---

### Task 2: `mesclar-canonico.ts` — funções puras de merge

Todo o algoritmo de merge, sem I/O. Baseline-delta com delta travado em 0.

**Files:**
- Create: `C:\Users\leogi\Desktop\auto-broll-premiere\src\mesclar-canonico.ts`
- Test: `C:\Users\leogi\Desktop\auto-broll-premiere\tests\mesclar-canonico.test.ts`

**Interfaces:**
- Consumes: `Saldo`, `Memoria`, `Associacoes`, `aplicarTeto` de `./aprendizado.ts`; `parseMemoria`, `parseAssociacoes` de `./aprendizado.ts`; `parseSinonimos` de `./match.ts`.
- Produces:
  - `export interface CanonicoSnapshot { schema: 1; version: string; aprendizado: { pares: Record<string, Saldo>; arquivos: Record<string, Saldo> }; ligacoes: { pares: Record<string, number> }; sinonimos: ReadonlyMap<string, readonly string[]> }`
  - `export interface EstadoAprendido { memoria: Memoria; associacoes: Associacoes; sinonimos: ReadonlyMap<string, readonly string[]> }`
  - `export function parseCanonico(raw: unknown): CanonicoSnapshot | null`
  - `export function mesclarSaldos(canonico, local, base: Readonly<Record<string, Saldo>>): Record<string, Saldo>`
  - `export function mesclarContagens(canonico, local, base: Readonly<Record<string, number>>): Record<string, number>`
  - `export function mesclarSinonimos(canonico, local: ReadonlyMap<string, readonly string[]>): Map<string, readonly string[]>`
  - `export function aplicarMerge(atual: EstadoAprendido, canonico: CanonicoSnapshot, base: CanonicoSnapshot | null): EstadoAprendido`

- [ ] **Step 1: Escrever os testes que falham**

Criar `tests/mesclar-canonico.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  parseCanonico,
  mesclarSaldos,
  mesclarContagens,
  mesclarSinonimos,
  aplicarMerge,
  type CanonicoSnapshot,
  type EstadoAprendido,
} from "../src/mesclar-canonico.ts";
import { MEMORIA_VAZIA, ASSOCIACOES_VAZIAS } from "../src/aprendizado.ts";

// ---------------------------------------------------------- mesclarSaldos

test("mesclarSaldos: baseline ausente soma local inteiro sobre o canonico", () => {
  const r = mesclarSaldos({ "a|a": { acertos: 12, erros: 2 } }, { "a|a": { acertos: 4, erros: 0 } }, {});
  assert.deepEqual(r["a|a"], { acertos: 16, erros: 2 });
});

test("mesclarSaldos: com baseline soma so o que a editora evoluiu", () => {
  const r = mesclarSaldos(
    { "a|a": { acertos: 15, erros: 2 } }, // canonico atual
    { "a|a": { acertos: 16, erros: 3 } }, // local
    { "a|a": { acertos: 12, erros: 2 } }  // baseline
  );
  // 15 + (16-12), 2 + (3-2) = 19, 3
  assert.deepEqual(r["a|a"], { acertos: 19, erros: 3 });
});

test("mesclarSaldos: chave so no canonico entra como esta", () => {
  const r = mesclarSaldos({ "x|x": { acertos: 5, erros: 1 } }, {}, {});
  assert.deepEqual(r["x|x"], { acertos: 5, erros: 1 });
});

test("mesclarSaldos: chave so no local e preservada", () => {
  const r = mesclarSaldos({}, { "y|y": { acertos: 3, erros: 0 } }, {});
  assert.deepEqual(r["y|y"], { acertos: 3, erros: 0 });
});

test("mesclarSaldos: delta negativo nao subtrai (trava em 0)", () => {
  const r = mesclarSaldos(
    { "a|a": { acertos: 10, erros: 0 } },
    { "a|a": { acertos: 2, erros: 0 } },  // local < baseline (decaimento do teto)
    { "a|a": { acertos: 8, erros: 0 } }
  );
  assert.deepEqual(r["a|a"], { acertos: 10, erros: 0 });
});

test("mesclarSaldos: soma que passa do teto decai", () => {
  const r = mesclarSaldos(
    { "a|a": { acertos: 18, erros: 2 } },
    { "a|a": { acertos: 18, erros: 2 } },
    {}
  );
  // 18+18, 2+2 = 36,4 -> 18,2
  assert.deepEqual(r["a|a"], { acertos: 18, erros: 2 });
});

// ------------------------------------------------------- mesclarContagens

test("mesclarContagens: soma delta positivo, ignora negativo", () => {
  const r = mesclarContagens({ "a|a": 5, "b|b": 1 }, { "a|a": 7, "b|b": 0, "c|c": 2 }, { "a|a": 4 });
  assert.equal(r["a|a"], 5 + (7 - 4)); // 8
  assert.equal(r["b|b"], 1);           // local 0 < base 0 -> delta 0
  assert.equal(r["c|c"], 2);           // so no local
});

// -------------------------------------------------------- mesclarSinonimos

test("mesclarSinonimos: uniao, canonico vence no conflito de chave", () => {
  const canonico = new Map([["jovem", ["novo", "rapaz"]]]);
  const local = new Map([["jovem", ["adolescente"]], ["idoso", ["velho"]]]);
  const r = mesclarSinonimos(canonico, local);
  assert.deepEqual(r.get("jovem"), ["novo", "rapaz"]);
  assert.deepEqual(r.get("idoso"), ["velho"]);
});

// ------------------------------------------------------------ parseCanonico

test("parseCanonico: aceita snapshot valido", () => {
  const raw = {
    schema: 1,
    version: "0.2.0",
    aprendizado: { pares: { "a|a": { acertos: 3, erros: 1 } }, arquivos: {} },
    ligacoes: { pares: { "b|b": 4 } },
    sinonimos: { jovem: ["novo"] },
  };
  const c = parseCanonico(raw);
  assert.ok(c);
  assert.equal(c.version, "0.2.0");
  assert.deepEqual(c.aprendizado.pares["a|a"], { acertos: 3, erros: 1 });
  assert.equal(c.ligacoes.pares["b|b"], 4);
  assert.deepEqual(c.sinonimos.get("jovem"), ["novo"]);
});

test("parseCanonico: sem version devolve null", () => {
  assert.equal(parseCanonico({ schema: 1, aprendizado: {}, ligacoes: {}, sinonimos: {} }), null);
});

test("parseCanonico: lixo devolve null", () => {
  assert.equal(parseCanonico("nao"), null);
  assert.equal(parseCanonico(null), null);
});

// -------------------------------------------------------------- aplicarMerge

function estado(): EstadoAprendido {
  return {
    memoria: {
      schema: 3,
      pares: { "Viagra|viagra": { acertos: 16, erros: 3 } },
      arquivos: {},
      vistos: { "assoc|Seq da editora|X.mp4|0": true },
    },
    associacoes: { schema: 1, pares: { "Doutor|causa": 2 } },
    sinonimos: new Map([["idoso", ["velho"]]]),
  };
}

function snap(version: string): CanonicoSnapshot {
  return {
    schema: 1,
    version,
    aprendizado: { pares: { "Viagra|viagra": { acertos: 15, erros: 2 } }, arquivos: {} },
    ligacoes: { pares: { "Doutor|causa": 5 } },
    sinonimos: new Map([["jovem", ["novo"]]]),
  };
}

test("aplicarMerge: vistos da editora sai intacto", () => {
  const r = aplicarMerge(estado(), snap("0.2.0"), null);
  assert.deepEqual(r.memoria.vistos, { "assoc|Seq da editora|X.mp4|0": true });
});

test("aplicarMerge: sem baseline soma local inteiro", () => {
  const r = aplicarMerge(estado(), snap("0.2.0"), null);
  // 15 + 16, 2 + 3 = 31,5 -> teto -> 16,3  (31+5=36>20 -> 16,3 ; 16+3=19 ok)
  assert.deepEqual(r.memoria.pares["Viagra|viagra"], { acertos: 16, erros: 3 });
});

test("aplicarMerge: com baseline nao conta em dobro", () => {
  const base: CanonicoSnapshot = {
    schema: 1,
    version: "0.1.0",
    aprendizado: { pares: { "Viagra|viagra": { acertos: 14, erros: 2 } }, arquivos: {} },
    ligacoes: { pares: { "Doutor|causa": 3 } },
    sinonimos: new Map(),
  };
  const r = aplicarMerge(estado(), snap("0.2.0"), base);
  // pares: 15 + max(0, 16-14), 2 + max(0, 3-2) = 17, 3
  assert.deepEqual(r.memoria.pares["Viagra|viagra"], { acertos: 17, erros: 3 });
  // ligacoes: 5 + max(0, 2-3) = 5
  assert.equal(r.associacoes.pares["Doutor|causa"], 5);
});

test("aplicarMerge: sinonimos vira uniao com canonico ganhando", () => {
  const r = aplicarMerge(estado(), snap("0.2.0"), null);
  assert.deepEqual(r.sinonimos.get("jovem"), ["novo"]);
  assert.deepEqual(r.sinonimos.get("idoso"), ["velho"]);
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `cd /c/Users/leogi/Desktop/auto-broll-premiere && npm test`
Expected: FAIL — `../src/mesclar-canonico.ts` não existe.

- [ ] **Step 3: Implementar**

Criar `src/mesclar-canonico.ts`:

```ts
/*
 * Merge do aprendizado canonico (do dono) com o local (da editora).
 *
 * Baseline-delta: novo = canonico_atual + max(0, local - baseline). O
 * "max(0, ...)" e de proposito — a editora so SOMA sinal, nunca subtrai o do
 * dono, e o decaimento do teto pode deixar `local` numericamente abaixo do
 * `baseline` sem que nada tenha sido desaprendido.
 *
 * Puro: nao le disco, nao conhece o Premiere. A cola de I/O mora em
 * ui/mount.ts.
 */

import {
  aplicarTeto,
  parseAssociacoes,
  parseMemoria,
  type Associacoes,
  type Memoria,
  type Saldo,
} from "./aprendizado.ts";
import { parseSinonimos } from "./match.ts";

export interface CanonicoSnapshot {
  readonly schema: 1;
  readonly version: string;
  readonly aprendizado: {
    readonly pares: Readonly<Record<string, Saldo>>;
    readonly arquivos: Readonly<Record<string, Saldo>>;
  };
  readonly ligacoes: { readonly pares: Readonly<Record<string, number>> };
  readonly sinonimos: ReadonlyMap<string, readonly string[]>;
}

export interface EstadoAprendido {
  readonly memoria: Memoria;
  readonly associacoes: Associacoes;
  readonly sinonimos: ReadonlyMap<string, readonly string[]>;
}

/**
 * Le o snapshot vindo do disco. `null` quando falta `version` ou o formato
 * nao serve — quem chama entao pula o merge e deixa o aprendizado local como
 * esta.
 */
export function parseCanonico(raw: unknown): CanonicoSnapshot | null {
  if (typeof raw !== "object" || raw === null) return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.version !== "string" || o.version.length === 0) return null;

  const memoria = parseMemoria(o.aprendizado); // le .pares e .arquivos; ignora vistos
  const assoc = parseAssociacoes(o.ligacoes); // le .pares
  const sin = parseSinonimos(raw); // le raw.sinonimos

  return {
    schema: 1,
    version: o.version,
    aprendizado: { pares: memoria.pares, arquivos: memoria.arquivos },
    ligacoes: { pares: assoc.pares },
    sinonimos: sin ?? new Map<string, readonly string[]>(),
  };
}

const ZERO: Saldo = { acertos: 0, erros: 0 };

export function mesclarSaldos(
  canonico: Readonly<Record<string, Saldo>>,
  local: Readonly<Record<string, Saldo>>,
  base: Readonly<Record<string, Saldo>>
): Record<string, Saldo> {
  const saida: Record<string, Saldo> = {};
  for (const k of new Set([...Object.keys(canonico), ...Object.keys(local)])) {
    const c = canonico[k] ?? ZERO;
    const l = local[k] ?? ZERO;
    const b = base[k] ?? ZERO;
    saida[k] = aplicarTeto({
      acertos: c.acertos + Math.max(0, l.acertos - b.acertos),
      erros: c.erros + Math.max(0, l.erros - b.erros),
    });
  }
  return saida;
}

export function mesclarContagens(
  canonico: Readonly<Record<string, number>>,
  local: Readonly<Record<string, number>>,
  base: Readonly<Record<string, number>>
): Record<string, number> {
  const saida: Record<string, number> = {};
  for (const k of new Set([...Object.keys(canonico), ...Object.keys(local)])) {
    saida[k] = (canonico[k] ?? 0) + Math.max(0, (local[k] ?? 0) - (base[k] ?? 0));
  }
  return saida;
}

export function mesclarSinonimos(
  canonico: ReadonlyMap<string, readonly string[]>,
  local: ReadonlyMap<string, readonly string[]>
): Map<string, readonly string[]> {
  const saida = new Map<string, readonly string[]>(local);
  for (const [k, v] of canonico) saida.set(k, v);
  return saida;
}

export function aplicarMerge(
  atual: EstadoAprendido,
  canonico: CanonicoSnapshot,
  base: CanonicoSnapshot | null
): EstadoAprendido {
  return {
    memoria: {
      schema: 3,
      pares: mesclarSaldos(
        canonico.aprendizado.pares,
        atual.memoria.pares,
        base?.aprendizado.pares ?? {}
      ),
      arquivos: mesclarSaldos(
        canonico.aprendizado.arquivos,
        atual.memoria.arquivos,
        base?.aprendizado.arquivos ?? {}
      ),
      vistos: atual.memoria.vistos, // NUNCA tocado
    },
    associacoes: {
      schema: 1,
      pares: mesclarContagens(
        canonico.ligacoes.pares,
        atual.associacoes.pares,
        base?.ligacoes.pares ?? {}
      ),
    },
    sinonimos: mesclarSinonimos(canonico.sinonimos, atual.sinonimos),
  };
}
```

- [ ] **Step 4: Rodar os testes**

Run: `cd /c/Users/leogi/Desktop/auto-broll-premiere && npm test`
Expected: PASS — todos os testes de `mesclar-canonico.test.ts`.

- [ ] **Step 5: Rodar o check de tipos**

Run: `cd /c/Users/leogi/Desktop/auto-broll-premiere && npm run check`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
cd /c/Users/leogi/Desktop/auto-broll-premiere
git add src/mesclar-canonico.ts tests/mesclar-canonico.test.ts
git commit -m "feat: merge baseline-delta do aprendizado canonico (funcoes puras)"
```

---

### Task 3: Cola de I/O do merge no `mount.ts`

Ler os arquivos, chamar `aplicarMerge`, gravar de volta com backup. Roda uma
vez por versão de snapshot (gate por `version` do baseline).

**Files:**
- Modify: `C:\Users\leogi\Desktop\auto-broll-premiere\src\ui\mount.ts` (imports no topo; nova função antes de `carregarSinonimos`; chamada no IIFE de boot em `mount()`)

**Interfaces:**
- Consumes: `aplicarMerge`, `parseCanonico` de `../mesclar-canonico.ts`; `readJson`, `writeJson`, `comLimite` de `../premiere.ts` (já importados); `parseMemoria`, `parseAssociacoes` (já importados); `parseSinonimos`, `sinonimosParaJson`, `SINONIMOS_PADRAO` (já importados); `registrar`, `mensagemDeErro` (já no arquivo).
- Produces: `async function mesclarCanonicoNoDisco(aindaValido: () => boolean): Promise<void>` — chamada só de dentro de `mount()`.

- [ ] **Step 1: Adicionar o import**

Em `src/ui/mount.ts`, logo após o bloco de import de `../aprendizado.ts` (linha ~29), adicionar:

```ts
import { aplicarMerge, parseCanonico } from "../mesclar-canonico.ts";
```

- [ ] **Step 2: Adicionar as constantes**

Junto das outras constantes de arquivo (linhas 57-64), adicionar:

```ts
const CANONICO_FILE = "aprendizado-canonico.json";
const CANONICO_BASE_FILE = "aprendizado-canonico.base.json";
```

- [ ] **Step 3: Escrever a função**

Inserir imediatamente antes de `async function carregarSinonimos` (linha ~781):

```ts
/**
 * Funde o aprendizado canonico do dono (entregue no PluginData pelo script
 * Atualizar) com o aprendizado local. Roda uma vez por versao de snapshot —
 * o gate e o `version` gravado em aprendizado-canonico.base.json.
 *
 * Nunca lanca e nunca toca `vistos`: se algo der errado, o aprendizado da
 * editora fica exatamente como estava.
 */
async function mesclarCanonicoNoDisco(aindaValido: () => boolean): Promise<void> {
  try {
    const bruto = await comLimite("ler canonico", readJson(CANONICO_FILE), 5000);
    if (!aindaValido()) return;
    if (bruto === null) return; // nenhum snapshot para fundir

    const canonico = parseCanonico(bruto);
    if (canonico === null) {
      registrar(`${CANONICO_FILE} ilegivel: merge ignorado, aprendizado local intacto.`, "aviso");
      return;
    }

    const base = parseCanonico(
      await comLimite("ler base do canonico", readJson(CANONICO_BASE_FILE), 5000)
    );
    if (!aindaValido()) return;
    if (base !== null && base.version === canonico.version) return; // ja fundido

    const memoria = parseMemoria(
      await comLimite("ler aprendizado", readJson(MEMORIA_FILE), 5000)
    );
    const associacoes = parseAssociacoes(
      await comLimite("ler ligacoes", readJson(ASSOCIACOES_FILE), 5000)
    );
    const sinDisco = parseSinonimos(
      await comLimite("ler sinonimos", readJson(SINONIMOS_FILE), 5000)
    );
    if (!aindaValido()) return;

    const fundido = aplicarMerge(
      { memoria, associacoes, sinonimos: sinDisco ?? SINONIMOS_PADRAO },
      canonico,
      base
    );

    const carimbo = new Date().toISOString().slice(0, 10);
    await writeJson(`${MEMORIA_FILE}.bak-antes-merge-${carimbo}`, memoria);
    await writeJson(`${ASSOCIACOES_FILE}.bak-antes-merge-${carimbo}`, associacoes);
    await writeJson(MEMORIA_FILE, fundido.memoria);
    await writeJson(ASSOCIACOES_FILE, fundido.associacoes);
    await writeJson(SINONIMOS_FILE, sinonimosParaJson(fundido.sinonimos));
    await writeJson(CANONICO_BASE_FILE, canonico);

    const nP = Object.keys(fundido.memoria.pares).length;
    const nA = Object.keys(fundido.memoria.arquivos).length;
    const nL = Object.keys(fundido.associacoes.pares).length;
    registrar(
      `Merge do aprendizado canonico v${canonico.version}: ${nP} pares, ${nA} arquivos, ${nL} ligacoes.`,
      "ok"
    );
  } catch (e) {
    if (!aindaValido()) return;
    registrar(`Merge do canonico falhou (aprendizado local intacto). ${mensagemDeErro(e)}`, "aviso");
  }
}
```

- [ ] **Step 4: Ligar no boot**

No IIFE assíncrono de `mount()` (linhas ~883-898), inserir a chamada **antes** de `carregarSinonimos` — a ordem importa: o merge grava `sinonimos.json` e o `carregarSinonimos` logo depois relê e aplica:

```ts
    if (!aindaValido()) return;
    await mesclarCanonicoNoDisco(aindaValido);
    if (!aindaValido()) return;
    await carregarSinonimos(aindaValido);
```

- [ ] **Step 5: Check de tipos nos dois repos**

Run: `cd /c/Users/leogi/Desktop/auto-broll-premiere && npm run check`
Run: `cd /c/Users/leogi/Desktop/Pro-Edition && npm run check`
Expected: PASS nos dois (o Pro-Edition importa `mount.ts` e checa junto).

- [ ] **Step 6: Build do Pro-Edition**

Run: `cd /c/Users/leogi/Desktop/Pro-Edition && npm run build`
Expected: `painel construido em .../dist` sem erro.

- [ ] **Step 7: Commit (auto-broll)**

```bash
cd /c/Users/leogi/Desktop/auto-broll-premiere
git add src/ui/mount.ts
git commit -m "feat: fundir aprendizado-canonico.json no boot do painel"
```

---

### Task 4: Fechar a Fase 1

- [ ] **Step 1: `verify` nos dois repos**

Run: `cd /c/Users/leogi/Desktop/auto-broll-premiere && npm run verify`
Run: `cd /c/Users/leogi/Desktop/Pro-Edition && npm run verify`
Expected: PASS nos dois.

- [ ] **Step 2: Commit do build do Pro-Edition (se `dist/` for versionado)**

```bash
cd /c/Users/leogi/Desktop/Pro-Edition
git add dist
git commit -m "build: painel com merge de aprendizado canonico" || echo "nada a commitar"
```

---

## Fase 2 — Selo de versão (`Pro-Edition`)

### Task 5: SPIKE — permissão de rede e `fetch` do painel

Antes de mexer no `manifest.json` de produção. Deliverable: **um achado
escrito**, não código que fica. Se falhar, as Fases 2 e 3 mudam para a
abordagem "C2" (tarefa agendada escreve arquivo local) — ver spec.

**Files:**
- Modify (descartável): `C:\Program Files\Common Files\Adobe\UXP\Plugins\External\com.leogi.testedoispaineis\` (plugin de teste já symlinkado, ver `pro-edition-project` na memória)

- [ ] **Step 1: Adicionar permissão de rede ao manifest do plugin de teste**

No `manifest.json` do `com.leogi.testedoispaineis`, adicionar dentro de `requiredPermissions`:

```json
"network": { "domains": ["https://raw.githubusercontent.com"] }
```

- [ ] **Step 2: Adicionar um `fetch` visível ao `index.html` do plugin de teste**

No script do painel de teste:

```js
(async () => {
  const alvo = document.body.appendChild(document.createElement("pre"));
  try {
    const r = await fetch("https://raw.githubusercontent.com/leogiora/auto-broll-premiere/main/package.json");
    alvo.textContent = "fetch ok: HTTP " + r.status + " / " + (await r.text()).slice(0, 40);
  } catch (e) {
    alvo.textContent = "fetch FALHOU: " + e;
  }
})();
```

(URL só para o teste — qualquer arquivo público serve; o repo `Pro-Edition-dist` ainda não existe.)

- [ ] **Step 3: Pedir ao usuário para carregar no Premiere e reportar**

O usuário: fecha o Premiere, reabre, abre o painel de teste em `Window > Extensions`. Reportar:
1. O plugin **carrega** com a permissão de rede no manifest? (ou some do menu / dá erro)
2. O Premiere pediu para **aprovar** a permissão na primeira carga?
3. O `fetch` resolve? Qual HTTP status aparece no `<pre>`?
4. Desligar a internet, reabrir o painel: o `fetch` **rejeita rápido** ou o painel **pendura**?

- [ ] **Step 4: Registrar o achado**

Anotar o resultado em `docs/superpowers/specs/2026-08-31-auto-update-e-merge-aprendizado-design.md`, na seção "Riscos e spikes" (substituir o item 1 e 2 pelo que foi medido).

- [ ] **Step 5: Reverter o plugin de teste**

Desfazer as mudanças no `manifest.json` e `index.html` do `com.leogi.testedoispaineis` (`git checkout` no repo dele, ou remover as linhas à mão). Nada desse spike entra em produção.

- [ ] **Step 6: Decisão**

- `fetch` ok + plugin carrega → seguir para a Task 6.
- `fetch` falha ou plugin não carrega → **parar** e avisar o usuário: as Tasks 6-11 mudam para C2 (a Task 8 vira "tarefa agendada + leitura de arquivo local", sem rede no manifest). Reabrir o plano nesse ponto.

---

### Task 6: `versao.ts` — comparação de versão pura

**Files:**
- Create: `C:\Users\leogi\Desktop\Pro-Edition\src\versao.ts`
- Test: `C:\Users\leogi\Desktop\Pro-Edition\tests\versao.test.ts`

**Interfaces:**
- Produces: `export function versaoMaior(remota: string, local: string): boolean` — `true` só se `remota` for estritamente maior por segmento numérico. Qualquer string mal-formada → `false`.

- [ ] **Step 1: Escrever o teste que falha**

Criar `tests/versao.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { versaoMaior } from "../src/versao.ts";

test("versaoMaior: patch maior", () => {
  assert.equal(versaoMaior("0.1.1", "0.1.0"), true);
});
test("versaoMaior: minor maior", () => {
  assert.equal(versaoMaior("0.2.0", "0.1.9"), true);
});
test("versaoMaior: iguais -> false", () => {
  assert.equal(versaoMaior("0.1.0", "0.1.0"), false);
});
test("versaoMaior: remota menor -> false", () => {
  assert.equal(versaoMaior("0.1.0", "0.2.0"), false);
});
test("versaoMaior: tolera espaco e quebra de linha", () => {
  assert.equal(versaoMaior(" 0.2.0\n", "0.1.0"), true);
});
test("versaoMaior: numero de segmentos diferente", () => {
  assert.equal(versaoMaior("1.0", "0.9.9"), true);
  assert.equal(versaoMaior("0.1", "0.1.0"), false);
});
test("versaoMaior: string invalida -> false", () => {
  assert.equal(versaoMaior("abc", "0.1.0"), false);
  assert.equal(versaoMaior("", "0.1.0"), false);
  assert.equal(versaoMaior("0.1.0", "xyz"), false);
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `cd /c/Users/leogi/Desktop/Pro-Edition && npm test`
Expected: FAIL — `../src/versao.ts` não existe.

- [ ] **Step 3: Implementar**

Criar `src/versao.ts`:

```ts
/** Compara "0.2.0" > "0.1.0" por segmento numerico. Mal-formado => false. */
export function versaoMaior(remota: string, local: string): boolean {
  const r = segmentos(remota);
  const l = segmentos(local);
  if (r === null || l === null) return false;
  const n = Math.max(r.length, l.length);
  for (let i = 0; i < n; i++) {
    const a = r[i] ?? 0;
    const b = l[i] ?? 0;
    if (a !== b) return a > b;
  }
  return false;
}

function segmentos(v: string): number[] | null {
  const partes = v.trim().split(".");
  if (partes.length === 0 || partes.some((p) => p.length === 0)) return null;
  const nums = partes.map(Number);
  return nums.every((x) => Number.isInteger(x) && x >= 0) ? nums : null;
}
```

- [ ] **Step 4: Rodar os testes**

Run: `cd /c/Users/leogi/Desktop/Pro-Edition && npm test`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
cd /c/Users/leogi/Desktop/Pro-Edition
git add src/versao.ts tests/versao.test.ts
git commit -m "feat: versaoMaior — comparacao de versao por segmento"
```

---

### Task 7: `__VERSION__` embutido no build

**Files:**
- Modify: `C:\Users\leogi\Desktop\Pro-Edition\scripts\build.mjs`
- Create: `C:\Users\leogi\Desktop\Pro-Edition\src\globals.d.ts`

**Interfaces:**
- Produces: constante global `__VERSION__: string` disponível em qualquer `.ts` do bundle, valor = `manifest.json`.`version`.

- [ ] **Step 1: Declarar o global para o `tsc`**

Criar `src/globals.d.ts`:

```ts
/** Injetado pelo esbuild em build time (scripts/build.mjs), = manifest.version. */
declare const __VERSION__: string;
```

- [ ] **Step 2: Injetar no esbuild**

Em `scripts/build.mjs`:

Após a linha `const observar = process.argv.includes("--watch");` adicionar:

```js
const manifest = JSON.parse(await readFile(join(raiz, "manifest.json"), "utf8"));
```

Dentro do objeto passado a `build({ ... })`, adicionar a chave:

```js
  define: { __VERSION__: JSON.stringify(manifest.version) },
```

Após `const js = await readFile(join(dist, "main.js"), "utf8");` adicionar o canário:

```js
if (js.includes("__VERSION__")) throw new Error("define do __VERSION__ nao foi aplicado pelo esbuild");
```

- [ ] **Step 3: Usar `__VERSION__` num ponto qualquer para o `tsc` exercitar**

Ainda nesta task não há consumidor — a Task 8 adiciona. Para o `check` não reclamar de `globals.d.ts` sozinho, tudo bem: `declare const` não exige uso. Seguir.

- [ ] **Step 4: Build e check**

Run: `cd /c/Users/leogi/Desktop/Pro-Edition && npm run check && npm run build`
Expected: PASS; sem o erro do canário.

- [ ] **Step 5: Confirmar que a versão entrou no bundle**

Run: `cd /c/Users/leogi/Desktop/Pro-Edition && node -e "const s=require('fs').readFileSync('dist/main.js','utf8'); if(!s.includes('\"0.1.0\"')) throw new Error('versao nao encontrada no bundle'); console.log('ok')"`
Expected: `ok` (assumindo `manifest.version` ainda `0.1.0`).

- [ ] **Step 6: Commit**

```bash
cd /c/Users/leogi/Desktop/Pro-Edition
git add scripts/build.mjs src/globals.d.ts dist
git commit -m "build: injetar __VERSION__ (= manifest.version) no bundle"
```

---

### Task 8: Permissão de rede no manifest + faixa de atualização

Depende do resultado da Task 5. Se o spike apontou C2, **não fazer esta task** —
reabrir o plano.

**Files:**
- Modify: `C:\Users\leogi\Desktop\Pro-Edition\manifest.json`
- Modify: `C:\Users\leogi\Desktop\Pro-Edition\src\ui\main.ts`

**Interfaces:**
- Consumes: `versaoMaior` de `../versao.ts`; `__VERSION__`.

- [ ] **Step 1: Adicionar a permissão de rede**

Em `manifest.json`, trocar

```json
  "requiredPermissions": {
    "localFileSystem": "fullAccess"
  },
```

por (com a sintaxe confirmada no spike da Task 5):

```json
  "requiredPermissions": {
    "localFileSystem": "fullAccess",
    "network": { "domains": ["https://raw.githubusercontent.com"] }
  },
```

- [ ] **Step 2: Adicionar CSS da faixa**

Em `src/ui/main.ts`, ao fim da string `CSS_NAV` (antes da crase de fechamento, linha ~114):

```css
.pe-atualizar {
  align-self: stretch;
  margin: 0;
  padding: 8px 12px;
  background-color: #1f2a1f;
  border-bottom: 1px solid #2f3f2f;
  color: #cfe6cf;
  font-family: Inter, adobe-clean, "Source Sans 3", "Segoe UI", sans-serif;
  font-size: 11px;
  text-align: left;
}
```

- [ ] **Step 3: Adicionar a lógica de checagem**

Em `src/ui/main.ts`, adicionar o import no topo (após os outros imports de `../`):

```ts
import { versaoMaior } from "../versao.ts";
```

Antes de `function montarSeletor` (linha ~136), adicionar:

```ts
const URL_VERSAO = "https://raw.githubusercontent.com/leogiora/Pro-Edition-dist/main/VERSION";

/** Guardada entre navegacoes: a faixa some quando o document.body e trocado. */
let versaoNova: string | null = null;

async function verificarAtualizacao(): Promise<void> {
  try {
    const ctrl = new AbortController();
    const t = setTimeout(() => ctrl.abort(), 3000);
    const resp = await fetch(URL_VERSAO, { signal: ctrl.signal });
    clearTimeout(t);
    if (!resp.ok) return;
    const remota = (await resp.text()).trim();
    if (!versaoMaior(remota, __VERSION__)) return;
    versaoNova = remota;
    inserirFaixa();
  } catch {
    // offline, host fora, texto estranho: sem faixa, painel normal.
  }
}

function inserirFaixa(): void {
  if (versaoNova === null) return;
  if (document.getElementById("peAtualizar")) return;
  if (!document.getElementById("cardBroll")) return; // so no seletor
  const faixa = document.createElement("div");
  faixa.id = "peAtualizar";
  faixa.className = "pe-atualizar";
  faixa.textContent = `Atualizacao disponivel (${versaoNova}). Rode o Atualizar e reinicie o Premiere.`;
  document.body.insertBefore(faixa, document.body.firstChild);
}
```

- [ ] **Step 4: Chamar nos dois pontos**

No fim de `mostrar()` (após `tela.montar(document.body);`, linha ~173):

```ts
  if (ferramenta === "seletor") inserirFaixa();
```

E na última linha do arquivo, após `mostrar("seletor");`:

```ts
void verificarAtualizacao();
```

- [ ] **Step 5: Check e build**

Run: `cd /c/Users/leogi/Desktop/Pro-Edition && npm run check && npm run build`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
cd /c/Users/leogi/Desktop/Pro-Edition
git add manifest.json src/ui/main.ts dist
git commit -m "feat: faixa de atualizacao no seletor (fetch do VERSION no Pro-Edition-dist)"
```

---

## Fase 3 — Distribuição

### Task 9: Repo público `Pro-Edition-dist` + tirar `PluginData` do repo de código

**Files:**
- Create (repo novo): `Pro-Edition-dist` no GitHub + clone local
- Modify: `C:\Users\leogi\Desktop\Pro-Edition\.gitignore`
- Delete (do versionamento): `C:\Users\leogi\Desktop\Pro-Edition\instalar\PluginData\*`

- [ ] **Step 1: Criar o repo público**

Run:
```bash
gh repo create leogiora/Pro-Edition-dist --public --description "Saida compilada do Pro Edition (repo de codigo e privado)"
cd /c/Users/leogi/Desktop
gh repo clone leogiora/Pro-Edition-dist
```

- [ ] **Step 2: Semear o repo de distribuição**

```bash
cd /c/Users/leogi/Desktop/Pro-Edition-dist
printf '0.1.0\n' > VERSION
printf '# Pro-Edition-dist\n\nSaida compilada do Pro Edition. Nao edite a mao — `npm run release` no repo de codigo publica aqui.\n' > README.md
git add -A && git commit -m "seed"
git push -u origin main
```

- [ ] **Step 3: Tirar `instalar/PluginData` do repo de código**

```bash
cd /c/Users/leogi/Desktop/Pro-Edition
git rm -r --cached instalar/PluginData
printf 'instalar/PluginData/\n' >> .gitignore
git add .gitignore
git commit -m "chore: parar de versionar instalar/PluginData (arquivos de sessao)"
```

- [ ] **Step 4: Anotar o caminho do clone para o release**

Criar `C:\Users\leogi\Desktop\Pro-Edition\.release.json`:

```json
{ "distRepo": "C:/Users/leogi/Desktop/Pro-Edition-dist" }
```

E adicioná-lo ao `.gitignore`:

```bash
cd /c/Users/leogi/Desktop/Pro-Edition
printf '.release.json\n' >> .gitignore
git add .gitignore
git commit -m "chore: ignorar .release.json (caminho local do repo de distribuicao)"
```

---

### Task 10: `npm run release` (máquina do dono)

**Files:**
- Create: `C:\Users\leogi\Desktop\Pro-Edition\src\release-canonico.ts`
- Test: `C:\Users\leogi\Desktop\Pro-Edition\tests\release-canonico.test.ts`
- Create: `C:\Users\leogi\Desktop\Pro-Edition\scripts\release.mjs`
- Modify: `C:\Users\leogi\Desktop\Pro-Edition\package.json`

**Interfaces:**
- Produces: `export function montarCanonico(version: string, aprendizadoRaw: unknown, ligacoesRaw: unknown, sinonimosRaw: unknown): CanonicoJson` — objeto pronto para `JSON.stringify`, contendo só aprendizado; `export function proximaVersao(atual: string, bump: "patch" | "minor" | "major"): string`.

- [ ] **Step 1: Escrever os testes que falham**

Criar `tests/release-canonico.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";
import { montarCanonico, proximaVersao } from "../src/release-canonico.ts";

test("montarCanonico: nunca inclui vistos", () => {
  const aprendizado = {
    schema: 3,
    pares: { "a|a": { acertos: 3, erros: 1 } },
    arquivos: { "X.mp4": { acertos: 2, erros: 0 } },
    vistos: { "assoc|Seq|X.mp4|0": true },
  };
  const c = montarCanonico("0.2.0", aprendizado, { schema: 1, pares: { "b|b": 4 } }, { schema: 1, sinonimos: { jovem: ["novo"] } });
  const texto = JSON.stringify(c);
  assert.equal(texto.includes("vistos"), false);
  assert.equal(texto.includes("assoc|Seq"), false);
});

test("montarCanonico: leva pares, arquivos, ligacoes, sinonimos e version", () => {
  const c = montarCanonico(
    "0.2.0",
    { schema: 3, pares: { "a|a": { acertos: 3, erros: 1 } }, arquivos: {}, vistos: {} },
    { schema: 1, pares: { "b|b": 4 } },
    { schema: 1, sinonimos: { jovem: ["novo"] } }
  );
  assert.equal(c.version, "0.2.0");
  assert.deepEqual(c.aprendizado.pares["a|a"], { acertos: 3, erros: 1 });
  assert.equal(c.ligacoes.pares["b|b"], 4);
  assert.deepEqual(c.sinonimos["jovem"], ["novo"]);
});

test("montarCanonico: tolera arquivos crus nulos", () => {
  const c = montarCanonico("0.2.0", null, null, null);
  assert.deepEqual(c.aprendizado, { pares: {}, arquivos: {} });
  assert.deepEqual(c.ligacoes, { pares: {} });
  assert.deepEqual(c.sinonimos, {});
});

test("proximaVersao", () => {
  assert.equal(proximaVersao("0.1.0", "patch"), "0.1.1");
  assert.equal(proximaVersao("0.1.9", "minor"), "0.2.0");
  assert.equal(proximaVersao("0.9.9", "major"), "1.0.0");
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

Run: `cd /c/Users/leogi/Desktop/Pro-Edition && npm test`
Expected: FAIL — `../src/release-canonico.ts` não existe.

- [ ] **Step 3: Implementar o módulo puro**

Criar `src/release-canonico.ts`:

```ts
/*
 * Monta o snapshot canonico do aprendizado para publicar no Pro-Edition-dist.
 * SO aprendizado: pares, arquivos, ligacoes, sinonimos. Nunca vistos,
 * pendentes, config, frases, intensidade.
 *
 * Puro: recebe o conteudo ja lido dos arquivos, devolve o objeto.
 */

type Saldo = { acertos: number; erros: number };

export interface CanonicoJson {
  schema: 1;
  version: string;
  aprendizado: { pares: Record<string, Saldo>; arquivos: Record<string, Saldo> };
  ligacoes: { pares: Record<string, number> };
  sinonimos: Record<string, string[]>;
}

export function montarCanonico(
  version: string,
  aprendizadoRaw: unknown,
  ligacoesRaw: unknown,
  sinonimosRaw: unknown
): CanonicoJson {
  const ap = obj(aprendizadoRaw);
  const li = obj(ligacoesRaw);
  const si = obj(sinonimosRaw);
  return {
    schema: 1,
    version,
    aprendizado: {
      pares: soSaldos(ap["pares"]),
      arquivos: soSaldos(ap["arquivos"]),
    },
    ligacoes: { pares: soNumeros(li["pares"]) },
    sinonimos: soListas(si["sinonimos"]),
  };
}

export function proximaVersao(atual: string, bump: "patch" | "minor" | "major"): string {
  const [maj = 0, min = 0, pat = 0] = atual.trim().split(".").map(Number);
  if (bump === "major") return `${maj + 1}.0.0`;
  if (bump === "minor") return `${maj}.${min + 1}.0`;
  return `${maj}.${min}.${pat + 1}`;
}

function obj(raw: unknown): Record<string, unknown> {
  return typeof raw === "object" && raw !== null ? (raw as Record<string, unknown>) : {};
}

function soSaldos(raw: unknown): Record<string, Saldo> {
  const saida: Record<string, Saldo> = {};
  for (const [k, v] of Object.entries(obj(raw))) {
    const o = obj(v);
    const acertos = o["acertos"];
    const erros = o["erros"];
    if (typeof acertos === "number" && typeof erros === "number" && acertos >= 0 && erros >= 0) {
      saida[k] = { acertos: Math.floor(acertos), erros: Math.floor(erros) };
    }
  }
  return saida;
}

function soNumeros(raw: unknown): Record<string, number> {
  const saida: Record<string, number> = {};
  for (const [k, v] of Object.entries(obj(raw))) {
    if (typeof v === "number" && Number.isFinite(v) && v > 0) saida[k] = Math.floor(v);
  }
  return saida;
}

function soListas(raw: unknown): Record<string, string[]> {
  const saida: Record<string, string[]> = {};
  for (const [k, v] of Object.entries(obj(raw))) {
    if (Array.isArray(v)) {
      const termos = v.filter((t): t is string => typeof t === "string" && t.length > 0);
      if (termos.length > 0) saida[k] = termos;
    }
  }
  return saida;
}
```

- [ ] **Step 4: Rodar os testes**

Run: `cd /c/Users/leogi/Desktop/Pro-Edition && npm test`
Expected: PASS.

- [ ] **Step 5: Escrever o script de release**

Criar `scripts/release.mjs`:

```js
/*
 * Publica uma versao nova no Pro-Edition-dist (repo publico).
 *
 * Uso: npm run release [patch|minor|major]   (default: patch)
 * Roda na maquina do dono, no Windows. Precisa de .release.json com o
 * caminho do clone local do Pro-Edition-dist.
 */

import { execSync } from "node:child_process";
import { cp, readFile, readdir, writeFile } from "node:fs/promises";
import { existsSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";
import { montarCanonico, proximaVersao } from "../src/release-canonico.ts";

const raiz = dirname(dirname(fileURLToPath(import.meta.url)));
const rodar = (cmd, cwd) => execSync(cmd, { cwd, stdio: "inherit" });

// 0. config
const cfg = join(raiz, ".release.json");
if (!existsSync(cfg)) {
  console.error('crie .release.json: { "distRepo": "C:/Users/leogi/Desktop/Pro-Edition-dist" }');
  process.exit(1);
}
const { distRepo } = JSON.parse(await readFile(cfg, "utf8"));
const bump = process.argv[2] ?? "patch";

// 1. verify
rodar("npm run verify", raiz);

// 2. bump do manifest
const manifestPath = join(raiz, "manifest.json");
const manifest = JSON.parse(await readFile(manifestPath, "utf8"));
manifest.version = proximaVersao(manifest.version, bump);
await writeFile(manifestPath, JSON.stringify(manifest, null, 2) + "\n");
console.log("versao nova:", manifest.version);

// 3. rebuild com a versao nova embutida
rodar("npm run build", raiz);

// 4. montar o canonico a partir do PluginData mais recente
const pd = await pluginDataMaisRecente();
const ler = async (nome) => {
  try {
    return JSON.parse(await readFile(join(pd, nome), "utf8"));
  } catch {
    return null;
  }
};
const canonico = montarCanonico(
  manifest.version,
  await ler("aprendizado.json"),
  await ler("ligacoes.json"),
  await ler("sinonimos.json")
);

// 5. copiar para o repo de distribuicao
await cp(join(raiz, "dist"), join(distRepo, "dist"), { recursive: true, force: true });
await cp(manifestPath, join(distRepo, "manifest.json"), { force: true });
await cp(join(raiz, "icons"), join(distRepo, "icons"), { recursive: true, force: true });
await writeFile(join(distRepo, "VERSION"), manifest.version + "\n");
await writeFile(join(distRepo, "aprendizado-canonico.json"), JSON.stringify(canonico, null, 2) + "\n");

// 6. commit + push nos dois repos
rodar(`git add -A && git commit -m "release ${manifest.version}" && git push`, distRepo);
rodar(`git add manifest.json dist && git commit -m "release ${manifest.version}"`, raiz);
console.log(`\nrelease ${manifest.version} publicado em ${distRepo}`);

async function pluginDataMaisRecente() {
  const base = join(process.env.APPDATA, "Adobe", "UXP", "PluginsStorage", "PPRO");
  const versoes = (await readdir(base, { withFileTypes: true }))
    .filter((d) => d.isDirectory() && /^\d+$/.test(d.name))
    .map((d) => Number(d.name))
    .sort((a, b) => b - a);
  if (versoes.length === 0) throw new Error(`nenhuma versao do Premiere em ${base}`);
  return join(base, String(versoes[0]), "External", "com.leogi.proedition", "PluginData");
}
```

- [ ] **Step 6: Adicionar o script ao `package.json`**

Em `package.json`, na seção `scripts`, adicionar:

```json
    "release": "node scripts/release.mjs",
```

- [ ] **Step 7: Check e verify**

Run: `cd /c/Users/leogi/Desktop/Pro-Edition && npm run check && npm test`
Expected: PASS. (Não rodar `npm run release` ainda — a Task 12 faz isso ao vivo.)

- [ ] **Step 8: Commit**

```bash
cd /c/Users/leogi/Desktop/Pro-Edition
git add src/release-canonico.ts tests/release-canonico.test.ts scripts/release.mjs package.json
git commit -m "feat: npm run release — publica build + aprendizado canonico no Pro-Edition-dist"
```

---

### Task 11: Scripts `Atualizar` por SO

**Files:**
- Create: `C:\Users\leogi\Desktop\Pro-Edition\instalar\Atualizar.ps1`
- Create: `C:\Users\leogi\Desktop\Pro-Edition\instalar\Atualizar-mac.command`
- Modify: `C:\Users\leogi\Desktop\Pro-Edition\.gitattributes`
- Modify: `C:\Users\leogi\Desktop\Pro-Edition\instalar\LEIA-ME.txt`

- [ ] **Step 1: `Atualizar.ps1`**

Criar `instalar/Atualizar.ps1`:

```powershell
# Atualiza o Pro Edition nesta maquina a partir do repo publico de distribuicao.
# Clique direito neste arquivo > "Executar com o PowerShell".
# Feche o Premiere Pro antes.

$ErrorActionPreference = 'Stop'

# Auto-elevacao: o plugin vive em Program Files.
$souAdmin = ([Security.Principal.WindowsPrincipal] `
  [Security.Principal.WindowsIdentity]::GetCurrent() `
  ).IsInRole([Security.Principal.WindowsBuiltInRole]::Administrator)
if (-not $souAdmin) {
    Start-Process powershell "-ExecutionPolicy Bypass -File `"$PSCommandPath`"" -Verb RunAs
    exit
}

$dist = "https://github.com/leogiora/Pro-Edition-dist/archive/refs/heads/main.tar.gz"
$tmp  = Join-Path $env:TEMP "pro-edition-dist"
$tar  = Join-Path $env:TEMP "pro-edition-dist.tar.gz"

Remove-Item -Recurse -Force $tmp -ErrorAction SilentlyContinue
New-Item -ItemType Directory -Force $tmp | Out-Null

Write-Host "Baixando..."
curl.exe -sL -o $tar $dist
tar.exe -xzf $tar -C $tmp --strip-components=1

# 1. plugin
$ext = "C:\Program Files\Common Files\Adobe\UXP\Plugins\External\com.leogi.proedition"
New-Item -ItemType Directory -Force $ext | Out-Null
Remove-Item -Recurse -Force (Join-Path $ext "dist"), (Join-Path $ext "icons") -ErrorAction SilentlyContinue
Copy-Item (Join-Path $tmp "dist")  $ext -Recurse -Force
Copy-Item (Join-Path $tmp "icons") $ext -Recurse -Force
Copy-Item (Join-Path $tmp "manifest.json") $ext -Force
Write-Host "plugin atualizado."

# 2. aprendizado canonico -> cada versao do Premiere presente
$raiz = Join-Path $env:APPDATA "Adobe\UXP\PluginsStorage\PPRO"
if (Test-Path $raiz) {
    Get-ChildItem $raiz -Directory | ForEach-Object {
        $alvo = Join-Path $_.FullName "External\com.leogi.proedition\PluginData"
        New-Item -ItemType Directory -Force $alvo | Out-Null
        Copy-Item (Join-Path $tmp "aprendizado-canonico.json") $alvo -Force
        Write-Host "aprendizado canonico -> PPRO\$($_.Name)"
    }
} else {
    Write-Host "AVISO: o Premiere ainda nao criou a pasta de dados. Abra e feche o"
    Write-Host "Premiere uma vez e rode este script de novo para levar o aprendizado."
}

Write-Host ""
Write-Host "Pronto. Reinicie o Premiere Pro."
Read-Host "Enter para fechar"
```

- [ ] **Step 2: `Atualizar-mac.command`**

Criar `instalar/Atualizar-mac.command`:

```bash
#!/bin/bash
# Atualiza o Pro Edition neste Mac a partir do repo publico de distribuicao.
# Clique duas vezes. Se o macOS barrar: botao direito > Abrir > Abrir.
# Feche o Premiere Pro antes.

set -e

DIST="https://github.com/leogiora/Pro-Edition-dist/archive/refs/heads/main.tar.gz"
TMP="$(mktemp -d)"

echo "Baixando..."
curl -sL -o "$TMP/dist.tar.gz" "$DIST"
tar -xzf "$TMP/dist.tar.gz" -C "$TMP" --strip-components=1

# 1. plugin
EXT="$HOME/Library/Application Support/Adobe/UXP/Plugins/External/com.leogi.proedition"
mkdir -p "$EXT"
rm -rf "$EXT/dist" "$EXT/icons"
cp -R "$TMP/dist"  "$EXT/dist"
cp -R "$TMP/icons" "$EXT/icons"
cp "$TMP/manifest.json" "$EXT/manifest.json"
echo "plugin atualizado."

# 2. aprendizado canonico -> cada versao do Premiere presente
RAIZ="$HOME/Library/Application Support/Adobe/UXP/PluginsStorage/PPRO"
if [ -d "$RAIZ" ]; then
  for V in "$RAIZ"/*/; do
    ALVO="${V}External/com.leogi.proedition/PluginData"
    mkdir -p "$ALVO"
    cp "$TMP/aprendizado-canonico.json" "$ALVO/"
    echo "aprendizado canonico -> PPRO/$(basename "$V")"
  done
else
  echo "AVISO: o Premiere ainda nao criou a pasta de dados. Abra e feche o"
  echo "Premiere uma vez e rode este script de novo para levar o aprendizado."
fi

rm -rf "$TMP"
echo ""
echo "Pronto. Reinicie o Premiere Pro."
read -p "Enter para fechar."
```

- [ ] **Step 3: `.gitattributes`**

Adicionar a `C:\Users\leogi\Desktop\Pro-Edition\.gitattributes`:

```
instalar/Atualizar-mac.command text eol=lf
```

- [ ] **Step 4: Atualizar o `LEIA-ME.txt`**

Em `instalar/LEIA-ME.txt`, na seção "PARA ATUALIZAR NO FUTURO", substituir o parágrafo atual por:

```
PARA ATUALIZAR NO FUTURO
------------------------
Windows: botao direito em Atualizar.ps1 > "Executar com o PowerShell".
macOS:   clique duas vezes em Atualizar-mac.command.

O script baixa a versao nova, troca o plugin e traz o aprendizado que o dono
publicou. Depois, reinicie o Premiere. Nao precisa de Node nem de git.
```

- [ ] **Step 5: Verificar sintaxe do PowerShell sem executar**

Run:
```bash
powershell -NoProfile -Command "[void][System.Management.Automation.Language.Parser]::ParseFile('C:/Users/leogi/Desktop/Pro-Edition/instalar/Atualizar.ps1',[ref]$null,[ref]$e); if($e){$e; exit 1} else {'ps ok'}"
```
Expected: `ps ok`.

- [ ] **Step 6: Verificar sintaxe do bash sem executar**

Run: `bash -n /c/Users/leogi/Desktop/Pro-Edition/instalar/Atualizar-mac.command && echo "bash ok"`
Expected: `bash ok`.

- [ ] **Step 7: Commit**

```bash
cd /c/Users/leogi/Desktop/Pro-Edition
git add instalar/Atualizar.ps1 instalar/Atualizar-mac.command .gitattributes instalar/LEIA-ME.txt
git commit -m "feat: scripts Atualizar por SO (baixam do Pro-Edition-dist, sem git/Node)"
```

---

### Task 12: Verificação manual ponta a ponta

Sem `node --test` — é o roteiro do spec, rodado ao vivo. Precisa de uma segunda
máquina (ou VM) de cada SO que o usuário tenha.

- [ ] **Step 1: `verify` final nos dois repos**

Run: `cd /c/Users/leogi/Desktop/auto-broll-premiere && npm run verify`
Run: `cd /c/Users/leogi/Desktop/Pro-Edition && npm run verify`
Expected: PASS.

- [ ] **Step 2: Primeiro release ao vivo**

Na máquina do dono: `cd /c/Users/leogi/Desktop/Pro-Edition && npm run release patch`
Confirmar: `Pro-Edition-dist` recebeu `dist/`, `manifest.json`, `icons/`, `VERSION` (`0.1.1`) e `aprendizado-canonico.json`; e que o `aprendizado-canonico.json` **não** contém a string `vistos`.

- [ ] **Step 3: Instalar do zero na segunda máquina**

Máquina limpa, Premiere fechado. Rodar o `Atualizar` do SO. Reiniciar o Premiere. Confirmar: `Window > Extensions > Pro Edition` aparece; o painel abre; o log mostra a linha `Merge do aprendizado canonico v0.1.1: ...` e um `aprendizado.json.bak-antes-merge-<data>` foi criado no `PluginData`.

- [ ] **Step 4: Offline**

Desligar a internet, reabrir o painel. Nenhuma faixa, tudo funciona.

- [ ] **Step 5: Ensinar algo e publicar de novo**

Na máquina do dono: ensinar 1 par novo no Auto B-roll, depois `npm run release patch` (`0.1.2`).

- [ ] **Step 6: Faixa aparece**

Na segunda máquina, com internet, abrir o painel: faixa "Atualizacao disponivel (0.1.2)".

- [ ] **Step 7: Atualizar e conferir o merge**

Rodar o `Atualizar`, reiniciar. No log: `Merge do aprendizado canonico v0.1.2`. Conferir no `aprendizado.json`: (a) um par que só a segunda máquina tinha continua lá; (b) o par novo do dono entrou; (c) um par que as duas tinham não dobrou de contagem (soma via baseline).

- [ ] **Step 8: Idempotência**

`npm run release patch` sem ensinar nada (`0.1.3`); `Atualizar` na segunda máquina; reiniciar. O merge roda uma vez. Fechar e reabrir o painel **sem** reiniciar: o merge **não** roda de novo (baseline == canônico) — nenhuma linha nova de merge no log, nenhum `.bak` novo.

- [ ] **Step 9: Registrar o resultado**

Anotar no spec (seção "Riscos e spikes" / novo "Verificado em") o que passou e o que precisou de ajuste.

---

## Self-Review

**1. Spec coverage:**

| Seção do spec | Task |
|---|---|
| Peça 1 — selo de versão no painel | Tasks 6, 7, 8 |
| Peça 2 — `npm run release` | Task 10 |
| Peça 3 — scripts `Atualizar` | Task 11 |
| Peça 4 — merge no plugin (`mesclarCanonico`) | Tasks 1, 2, 3 |
| Repo novo `Pro-Edition-dist` | Task 9 |
| `instalar/PluginData` sai do repo | Task 9, Step 3 |
| Fluxo de dados (baseline-delta) | Task 2 (testes), Task 12 Step 7 |
| Erros e casos de borda | Task 2 (delta negativo, chave só de um lado, `parseCanonico` null), Task 3 (canônico corrompido, timeout), Task 8 (fetch falha) |
| Riscos e spikes | Task 5 (rede + fetch), Task 11 Step 5-6 (`curl`/`tar` — na verdade verificado ao vivo na Task 12 Step 3) |
| Testes | cada task de código puro traz os seus; Task 12 = manual |
| Escopo cortado | respeitado: sem sync reverso, sem tarefa agendada (a menos que o spike force C2), sem `.ccx`, sem UI de merge |

Lacuna assumida: o spike do `curl`/`tar` em Windows antigo (spec item 3) não tem task dedicada — coberto quando o `Atualizar.ps1` roda ao vivo na Task 12. Aceitável: as máquinas das editoras são conhecidas e atuais.

**2. Placeholder scan:** sem "TBD"/"TODO"/"handle errors" — todo passo de código tem bloco real. A Task 5 é um spike (deliverable = achado), explicitado como tal.

**3. Type consistency:**
- `Saldo` = `{ acertos: number; erros: number }` em `aprendizado.ts`; `release-canonico.ts` redefine o mesmo shape localmente de propósito (evita import cross-repo para 2 campos).
- `aplicarTeto(s: Saldo): Saldo` — mesma assinatura na Task 1 (define), Task 2 (usa).
- `CanonicoSnapshot` (com `sinonimos` como `ReadonlyMap`) é o tipo interno do plugin em `mesclar-canonico.ts`; `CanonicoJson` (com `sinonimos` como `Record`) é o tipo do arquivo em `release-canonico.ts`. Nomes diferentes de propósito — um é o objeto em memória, o outro o formato em disco.
- `versaoMaior(remota, local)` — ordem dos args igual na Task 6 (define) e Task 8 (usa: `versaoMaior(remota, __VERSION__)`).
- `parseCanonico` devolve `CanonicoSnapshot | null` — consumido assim na Task 3 (`base.version === canonico.version` só depois do null-check).

## Execution Handoff

**Plan complete and saved to `docs/superpowers/plans/2026-08-31-auto-update-e-merge-aprendizado.md`. Two execution options:**

**1. Subagent-Driven (recommended)** - I dispatch a fresh subagent per task, review between tasks, fast iteration

**2. Inline Execution** - Execute tasks in this session using executing-plans, batch execution with checkpoints

**Which approach?**

Nota: a Task 5 (spike) e a Task 12 (verificação manual) precisam de você no Premiere / numa segunda máquina — nenhum executor automático fecha essas sozinho.
