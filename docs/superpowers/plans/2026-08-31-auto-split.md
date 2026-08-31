# Auto Split Implementation Plan

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Uma 4ª ferramenta no Pro Edition que transforma os B-rolls já inseridos no layout "meio a meio" — doutor em cima, B-roll na metade de baixo com corte de topo e feather — enquadrando cada B-roll pelo seu perfil e aprendendo com os ajustes do usuário.

**Architecture:** Lógica pura (geometria da caixa, resolução de perfil, back-solve do aprendizado) em `src/autosplit.ts`, coberta por `tests/autosplit.test.ts` no runner nativo do Node. Toda chamada ao Premiere em `src/autosplit-premiere.ts`, reusando `comTransacao`/`getSequenceInfo`/`lerBrollsAcimaDeV1`/`readJson`/`writeJson` do adapter do Auto B-roll. A tela (`src/ui/autosplit.html` + `src/ui/autosplit-mount.ts`) é registrada como 4º card no shell. Um perfil de enquadramento por arquivo (`src/autosplit-perfil.json`), montado uma vez analisando frames da biblioteca com ffmpeg.

**Tech Stack:** TypeScript 5.7 (noEmit; Node 24 roda `.ts` direto nos testes, esbuild empacota o painel), esbuild IIFE bundle, UXP + `premierepro` (injetados pelo host, `external` no build), runner nativo `node --test` + `node:assert/strict`, `ffmpeg`/`ffprobe` (já no PATH) para a análise única da biblioteca.

**Spec:** `docs/superpowers/specs/2026-08-31-auto-split-design.md`

## Global Constraints

- **Premiere Pro 26+ apenas.** Nenhum código de compatibilidade com o 25, nenhuma sondagem de versão além do que os helpers reusados já fazem.
- **Todas as chamadas ao `premierepro`/`uxp` moram em `src/autosplit-premiere.ts`.** `src/autosplit.ts` é puro: sem `premierepro`, sem `uxp`, sem DOM. É o único arquivo coberto por `tests/autosplit.test.ts`.
- **Nunca reimplementar `lockedAccess`/`executeTransaction`.** Usar `comTransacao` de `../../auto-broll-premiere/src/premiere.ts`. Reusar de lá também `getSequenceInfo`, `lerBrollsAcimaDeV1`, `readJson`, `writeJson`.
- **Contrato do `mount(root)`:** recebe `root` mas NÃO escopa busca de elemento por ele — o shell substitui `document.body` inteiro antes de cada `mount()`. Copiar o comentário que explica isso das outras telas.
- **Arquivos de estado no PluginData levam prefixo `autosplit` e não colidem:** `ultimo-log-autosplit.json`, `autosplit-aplicado.json`, `autosplit-perfil-override.json`, `diag-autosplit.json`.
- **Identificadores e comentários em português**, no estilo do código existente. Sem acento em nome de arquivo.
- **Sem dependência npm nova.**
- **`npm run verify`** (`tsc --noEmit` + `node --test` + build esbuild) tem de passar ao fim de cada task.
- **Commit ao fim de cada task**, e nos sub-passos verdes onde for natural.

## File Structure

| Arquivo | Cria/Modifica | Responsabilidade |
|---|---|---|
| `src/shell.ts` | Modifica | `Ferramenta` ganha `"autosplit"` |
| `src/ui/main.ts` | Modifica | import da tela, `NOME.autosplit`, entrada no `REGISTRO`, fio no `montarSeletor` |
| `src/ui/seletor.html` | Modifica | 4º card `#cardAutosplit`; badge e nota "4 ferramentas" |
| `src/ui/seletor.css` | Modifica | `.card-autosplit .card-nome::before` (cor da tarja) |
| `tests/shell.test.ts` | Modifica | `autosplit` no registro de teste |
| `src/autosplit.ts` | Cria | Lógica pura: tipos, `conceito`, `resolverPerfil`, `calcularEnquadramento`, `nudgeDoutorPosY`, `aprenderEnquadramento`, `fracaoDivisao`, constantes |
| `tests/autosplit.test.ts` | Cria | Testes `assert` de tudo em `autosplit.ts` |
| `src/autosplit-premiere.ts` | Cria | Cola com o Premiere: ler B-rolls, resolver perfil, aplicar Motion + efeito numa transação, diagnóstico, aprender |
| `src/ui/autosplit.html` | Cria | Markup + `<style>` embutido da tela |
| `src/ui/autosplit-mount.ts` | Cria | `export function mount(root)`, fios dos botões |
| `src/autosplit-perfil.json` | Cria | Perfil de enquadramento da biblioteca |
| `tsconfig.json` | Modifica | `resolveJsonModule: true` |
| `scripts/frames.mjs` | Cria | Extrai 1 frame + dimensões de cada arquivo da biblioteca, monta contact-sheets |
| `GUIA-DE-USO.md` / `DEV_NOTES.md` | Modifica | Documentação da ferramenta nova |

---

### Task 1: Shell — registrar Auto Split como 4º card com tela vazia

**Files:**
- Modify: `src/shell.ts`
- Modify: `src/ui/main.ts`
- Modify: `src/ui/seletor.html`
- Modify: `src/ui/seletor.css`
- Modify: `tests/shell.test.ts`
- Create: `src/ui/autosplit.html`
- Create: `src/ui/autosplit-mount.ts`

**Interfaces:**
- Consumes: `Ferramenta`, `Tela` de `src/shell.ts`; o padrão de `REGISTRO`/`NOME`/`mostrar` de `src/ui/main.ts`.
- Produces: `mount(root: HTMLElement): void` em `src/ui/autosplit-mount.ts`. `Ferramenta` passa a incluir `"autosplit"`.

- [ ] **Step 1: `Ferramenta` ganha `autosplit`**

Em `src/shell.ts`:

```ts
export type Ferramenta = "seletor" | "broll" | "captions" | "autocut" | "autosplit";
```

- [ ] **Step 2: Rodar tsc para ver o que quebra**

Run: `npm run check`
Expected: FAIL — `NOME` e `REGISTRO` em `main.ts` e o `registro` em `shell.test.ts` não têm a chave `autosplit` (Record<Ferramenta, …> fica incompleto).

- [ ] **Step 3: Criar `src/ui/autosplit.html`**

Fragmento com `<style>` embutido, mesmo esqueleto de `src/ui/autocut.html` (painel de altura fixa, só o conteúdo rola). Prefixo de classe `as-`:

```html
<!-- Fragmento: o shell injeta isto direto em document.body. O <style> vem
     junto porque esta tela so existe dentro do Pro Edition. -->
<style>
  html, body { height: 100%; }
  body {
    display: flex; flex-direction: column; margin: 0; padding: 0;
    overflow: hidden; background-color: #0f1216;
  }
  .as-conteudo {
    display: flex; flex-direction: column; flex: 1 1 auto; min-height: 0;
    overflow-y: auto; overflow-x: hidden; padding: 16px 12px 24px;
    font-family: Inter, adobe-clean, "Source Sans 3", "Segoe UI", sans-serif;
    color: #eceef2; background-color: #0f1216;
  }
  .as-conteudo > * { flex: none; }
  .as-titulo { margin: 0 0 2px; font-size: 15px; font-weight: 600; }
  .as-sub { margin: 0 0 16px; font-size: 11px; color: #5f6774; }
  .as-log {
    margin-top: 12px; padding: 10px; border-radius: 8px;
    background-color: #14171d; border: 1px solid #232830;
    font-family: "Source Code Pro", ui-monospace, Menlo, Consolas, monospace;
    font-size: 11px; line-height: 1.5; color: #cdd2da; white-space: pre-wrap;
  }
</style>

<main class="as-conteudo">
  <h1 class="as-titulo">Auto Split</h1>
  <p class="as-sub">Layout meio a meio: doutor em cima, B-roll na metade de baixo.</p>
  <pre id="asLog" class="as-log">carregando</pre>
</main>
```

- [ ] **Step 4: Criar `src/ui/autosplit-mount.ts` (no-op)**

```ts
/*
 * Painel do Auto Split. So orquestra: le a sequencia, mostra, e chama o
 * adapter. Nenhuma chamada a `premierepro` mora aqui.
 *
 * `root` chega mas nao e usado para escopar busca de elemento: o shell
 * substitui document.body inteiro antes de cada mount(), entao nunca ha duas
 * telas no mesmo documento. Se isso mudar, este arquivo muda junto.
 */

export function mount(root: HTMLElement): void {
  const log = root.querySelector<HTMLPreElement>("#asLog")!;
  log.textContent = "Auto Split — tela no ar. Adapter ainda nao ligado.";
}
```

- [ ] **Step 5: Registrar no `src/ui/main.ts`**

Adicionar os imports perto dos outros:

```ts
import htmlAutosplit from "./autosplit.html";
import { mount as mountAutosplit } from "./autosplit-mount.ts";
```

`NOME` ganha a linha:

```ts
  autosplit: "Auto Split",
```

`REGISTRO` ganha a entrada (igual ao `autocut`: HTML já traz o `<style>`, css vazio):

```ts
  autosplit: { html: htmlAutosplit, css: "", montar: mountAutosplit },
```

`montarSeletor` ganha o fio:

```ts
  ligarAcao(root.querySelector<HTMLElement>("#cardAutosplit")!, () => mostrar("autosplit"));
```

- [ ] **Step 6: 4º card no `src/ui/seletor.html`**

Depois do bloco `#cardAutocut`, dentro de `.cards`:

```html
    <div
      id="cardAutosplit"
      class="card card-autosplit"
      role="button"
      tabindex="0"
      aria-label="Abrir Auto Split"
    >
      <span class="card-topo">
        <span class="card-nome">Auto Split</span>
        <span class="card-seta">&rarr;</span>
      </span>
      <span class="card-desc">
        Monta o layout meio a meio no fim da edicao: enquadra cada B-roll na metade de baixo e aplica o corte de topo com feather.
      </span>
      <span class="card-rodape">
        <span class="card-meta">Video &middot; V2+ e V1</span>
      </span>
    </div>
```

No mesmo arquivo, trocar `<div class="badge">3 ferramentas</div>` por `4 ferramentas`, e na `.hall-nota` trocar "As tres trabalham" por "As quatro trabalham".

- [ ] **Step 7: Cor da tarja no `src/ui/seletor.css`**

Depois de `.card-autocut .card-nome::before { … }`:

```css
.card-autosplit .card-nome::before {
  background-color: #e07ba8;
}
```

- [ ] **Step 8: Atualizar `tests/shell.test.ts`**

No objeto `registro` do primeiro teste, adicionar:

```ts
    autosplit: { html: "<e>autosplit</e>", css: "e", montar: semAcao } satisfies Tela,
```

e uma asserção:

```ts
  assert.equal(escolherTela(registro, "autosplit").html, "<e>autosplit</e>");
```

- [ ] **Step 9: `npm run verify`**

Run: `npm run verify`
Expected: PASS — tsc limpo, testes verdes, build gera `dist/`.

- [ ] **Step 10: Commit**

```bash
git add src/shell.ts src/ui/main.ts src/ui/seletor.html src/ui/seletor.css tests/shell.test.ts src/ui/autosplit.html src/ui/autosplit-mount.ts
git commit -m "feat(auto-split): 4o card no shell com tela vazia"
```

---

### Task 2: Pure — tipos do perfil, `conceito`, `resolverPerfil`

**Files:**
- Create: `src/autosplit.ts`
- Create: `tests/autosplit.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces:
  ```ts
  export type Assunto = "rosto" | "pessoa" | "dupla" | "aberto";
  export type Orientacao = "retrato" | "paisagem";
  export interface PerfilEntrada {
    readonly assunto: Assunto;
    readonly ancoraY: number;        // 0..1
    readonly cropTopoExtra: number;  // 0..1
    readonly w?: number;
    readonly h?: number;
    readonly nota?: string;
  }
  export interface Perfil {
    readonly versao: number;
    readonly padraoPorConceito: Readonly<Record<string, PerfilEntrada>>;
    readonly porArquivo: Readonly<Record<string, PerfilEntrada>>;
  }
  export type OverridePerfil = Readonly<Record<string, { ancoraY: number; cropTopoExtra: number }>>;
  export interface PerfilResolvido {
    readonly assunto: Assunto;
    readonly ancoraY: number;
    readonly cropTopoExtra: number;
    readonly origem: "override" | "arquivo" | "conceito" | "default";
  }
  export function conceito(nomeArquivo: string): string;
  export function resolverPerfil(perfil: Perfil, override: OverridePerfil, nomeArquivo: string, orientacao: Orientacao): PerfilResolvido;
  ```

- [ ] **Step 1: Escrever os testes que falham**

`tests/autosplit.test.ts`:

```ts
import assert from "node:assert/strict";
import { test } from "node:test";
import { conceito, resolverPerfil, type Perfil } from "../src/autosplit.ts";

test("conceito tira o sufixo (n) e a extensao", () => {
  assert.equal(conceito("Consulta médica (1).mp4"), "Consulta médica");
  assert.equal(conceito("Academia.mp4"), "Academia");
  assert.equal(conceito("14.000 mil homens (7).mp4"), "14.000 mil homens");
});

const PERFIL: Perfil = {
  versao: 1,
  padraoPorConceito: {
    "Consulta médica": { assunto: "dupla", ancoraY: 0.3, cropTopoExtra: 0 },
  },
  porArquivo: {
    "Consulta médica (1).mp4": { assunto: "pessoa", ancoraY: 0.28, cropTopoExtra: 0.02, w: 720, h: 1280 },
  },
};

test("resolverPerfil: override vence tudo", () => {
  const r = resolverPerfil(
    PERFIL,
    { "Consulta médica (1).mp4": { ancoraY: 0.4, cropTopoExtra: 0.1 } },
    "Consulta médica (1).mp4",
    "retrato",
  );
  assert.equal(r.origem, "override");
  assert.equal(r.ancoraY, 0.4);
  assert.equal(r.cropTopoExtra, 0.1);
  assert.equal(r.assunto, "pessoa"); // assunto continua vindo do perfil por arquivo
});

test("resolverPerfil: cai no perfil por arquivo", () => {
  const r = resolverPerfil(PERFIL, {}, "Consulta médica (1).mp4", "retrato");
  assert.equal(r.origem, "arquivo");
  assert.equal(r.ancoraY, 0.28);
});

test("resolverPerfil: cai no padrao por conceito", () => {
  const r = resolverPerfil(PERFIL, {}, "Consulta médica (5).mp4", "retrato");
  assert.equal(r.origem, "conceito");
  assert.equal(r.assunto, "dupla");
  assert.equal(r.ancoraY, 0.3);
});

test("resolverPerfil: default por orientacao quando nao ha nada", () => {
  const retrato = resolverPerfil(PERFIL, {}, "Coisa nova (2).mp4", "retrato");
  assert.equal(retrato.origem, "default");
  assert.equal(retrato.assunto, "pessoa");
  assert.equal(retrato.ancoraY, 0.35);

  const paisagem = resolverPerfil(PERFIL, {}, "Coisa nova (2).mp4", "paisagem");
  assert.equal(paisagem.ancoraY, 0.45);
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `node --test "tests/autosplit.test.ts"`
Expected: FAIL — `Cannot find module '../src/autosplit.ts'`.

- [ ] **Step 3: Implementar em `src/autosplit.ts`**

```ts
/*
 * Auto Split — logica pura. Sem DOM, sem Premiere, roda no node --test.
 *
 * A geometria da caixa meio a meio, a resolucao do perfil de enquadramento e
 * o back-solve do "Aprender" moram aqui. O que toca o Premiere esta em
 * autosplit-premiere.ts.
 */

export type Assunto = "rosto" | "pessoa" | "dupla" | "aberto";
export type Orientacao = "retrato" | "paisagem";

export interface PerfilEntrada {
  readonly assunto: Assunto;
  readonly ancoraY: number;
  readonly cropTopoExtra: number;
  readonly w?: number;
  readonly h?: number;
  readonly nota?: string;
}

export interface Perfil {
  readonly versao: number;
  readonly padraoPorConceito: Readonly<Record<string, PerfilEntrada>>;
  readonly porArquivo: Readonly<Record<string, PerfilEntrada>>;
}

export type OverridePerfil = Readonly<Record<string, { ancoraY: number; cropTopoExtra: number }>>;

export interface PerfilResolvido {
  readonly assunto: Assunto;
  readonly ancoraY: number;
  readonly cropTopoExtra: number;
  readonly origem: "override" | "arquivo" | "conceito" | "default";
}

/** "Consulta médica (1).mp4" -> "Consulta médica". Sem sufixo -> tira so a extensao. */
export function conceito(nomeArquivo: string): string {
  return nomeArquivo.replace(/\.[^.]+$/, "").replace(/\s*\(\d+\)\s*$/, "").trim();
}

const DEFAULT_RETRATO: PerfilEntrada = { assunto: "pessoa", ancoraY: 0.35, cropTopoExtra: 0 };
const DEFAULT_PAISAGEM: PerfilEntrada = { assunto: "pessoa", ancoraY: 0.45, cropTopoExtra: 0 };

export function resolverPerfil(
  perfil: Perfil,
  override: OverridePerfil,
  nomeArquivo: string,
  orientacao: Orientacao,
): PerfilResolvido {
  const doArquivo = perfil.porArquivo[nomeArquivo];
  const doConceito = perfil.padraoPorConceito[conceito(nomeArquivo)];
  const base = doArquivo ?? doConceito ?? (orientacao === "retrato" ? DEFAULT_RETRATO : DEFAULT_PAISAGEM);
  const origem: PerfilResolvido["origem"] = doArquivo ? "arquivo" : doConceito ? "conceito" : "default";

  const ov = override[nomeArquivo];
  if (ov) {
    return { assunto: base.assunto, ancoraY: ov.ancoraY, cropTopoExtra: ov.cropTopoExtra, origem: "override" };
  }
  return { assunto: base.assunto, ancoraY: base.ancoraY, cropTopoExtra: base.cropTopoExtra, origem };
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `node --test "tests/autosplit.test.ts"`
Expected: PASS — 6 testes.

- [ ] **Step 5: Commit**

```bash
git add src/autosplit.ts tests/autosplit.test.ts
git commit -m "feat(auto-split): resolucao do perfil de enquadramento"
```

---

### Task 3: Pure — geometria da caixa (`calcularEnquadramento`)

**Files:**
- Modify: `src/autosplit.ts`
- Modify: `tests/autosplit.test.ts`

**Interfaces:**
- Consumes: `Assunto` da Task 2.
- Produces:
  ```ts
  export const FOLGA: Readonly<Record<Assunto, number>>;   // rosto .18 pessoa .12 dupla .10 aberto .05
  export const CROP_TOPO_MAX: number;   // 0.60
  export const OVERSCAN: number;        // 1.03
  export const SUBJ_IN_BOX: number;     // 0.40
  export const FEATHER_PCT: number;     // 5
  export const ROUNDNESS_PCT: number;   // 0
  export interface EntradaGeom {
    readonly W: number; readonly H: number;
    readonly brollTopoFrac: number;
    readonly w: number; readonly h: number;
    readonly ancoraY: number;
    readonly assunto: Assunto;
    readonly cropTopoExtra: number;
  }
  export interface Enquadramento {
    readonly escalaPct: number;
    readonly posX: number;
    readonly posY: number;
    readonly cropTopoPct: number;
  }
  export function calcularEnquadramento(e: EntradaGeom): Enquadramento;
  export function fracaoDivisao(valorCampo: number): number;   // "50" -> 0.5, clamp 0.40..0.60
  ```

- [ ] **Step 1: Escrever os testes que falham**

Adicionar a `tests/autosplit.test.ts`:

```ts
import { calcularEnquadramento, fracaoDivisao, type EntradaGeom } from "../src/autosplit.ts";

const BASE: EntradaGeom = {
  W: 1080, H: 1920, brollTopoFrac: 0.5,
  w: 720, h: 1280, ancoraY: 0.30, assunto: "pessoa", cropTopoExtra: 0,
};

test("fracaoDivisao parseia e clampa", () => {
  assert.equal(fracaoDivisao(50), 0.5);
  assert.equal(fracaoDivisao(30), 0.4);
  assert.equal(fracaoDivisao(70), 0.6);
});

test("geometria: retrato, ancora media — cobre a caixa e nao passa dela", () => {
  const r = calcularEnquadramento(BASE);
  // corte de topo = ancoraY - folga(pessoa .12) + 0 = 0.18
  assert.ok(Math.abs(r.cropTopoPct - 18) < 0.01);
  // escala cobre a caixa: max(1080/720, 960/(1280*0.82)) * 1.03, em %
  const esperado = Math.max(1080 / 720, 960 / (1280 * 0.82)) * 1.03 * 100;
  assert.ok(Math.abs(r.escalaPct - esperado) < 0.5);
  assert.equal(r.posX, 540);
  // o topo da parte visivel nao pode ficar abaixo de yBox (960): sem tarja
  const s = r.escalaPct / 100;
  const topoVis = r.posY + (r.cropTopoPct / 100 - 0.5) * 1280 * s;
  assert.ok(topoVis <= 960 + 0.5);
  // o fundo tem de chegar em H
  const fundo = r.posY + 0.5 * 1280 * s;
  assert.ok(fundo >= 1920 - 0.5);
});

test("geometria: ancora baixa nao corta nada do topo", () => {
  const r = calcularEnquadramento({ ...BASE, ancoraY: 0.08 });
  assert.equal(r.cropTopoPct, 0);
});

test("geometria: cropTopoExtra soma no Top", () => {
  const r = calcularEnquadramento({ ...BASE, cropTopoExtra: 0.05 });
  assert.ok(Math.abs(r.cropTopoPct - 23) < 0.01);
});

test("geometria: crop de topo nunca passa de CROP_TOPO_MAX", () => {
  const r = calcularEnquadramento({ ...BASE, ancoraY: 0.9, assunto: "aberto", cropTopoExtra: 0.3 });
  assert.ok(r.cropTopoPct <= 60.0001);
});

test("geometria: paisagem (16:9) tambem cobre a caixa", () => {
  const r = calcularEnquadramento({ ...BASE, w: 1920, h: 1080, ancoraY: 0.45, assunto: "aberto" });
  const s = r.escalaPct / 100;
  assert.ok(1080 * s >= 1080 - 0.5);              // largura cobre W
  const ct = r.cropTopoPct / 100;
  assert.ok(1080 * (1 - ct) * s >= 960 - 0.5);    // altura visivel cobre a caixa
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `node --test "tests/autosplit.test.ts"`
Expected: FAIL — `calcularEnquadramento`/`fracaoDivisao` não existem.

- [ ] **Step 3: Implementar em `src/autosplit.ts`**

```ts
export const FOLGA: Readonly<Record<Assunto, number>> = {
  rosto: 0.18, pessoa: 0.12, dupla: 0.10, aberto: 0.05,
};
export const CROP_TOPO_MAX = 0.60;
export const OVERSCAN = 1.03;
export const SUBJ_IN_BOX = 0.40;
export const FEATHER_PCT = 5;
export const ROUNDNESS_PCT = 0;

const clamp = (v: number, lo: number, hi: number): number => Math.min(Math.max(v, lo), hi);

export interface EntradaGeom {
  readonly W: number; readonly H: number;
  readonly brollTopoFrac: number;
  readonly w: number; readonly h: number;
  readonly ancoraY: number;
  readonly assunto: Assunto;
  readonly cropTopoExtra: number;
}

export interface Enquadramento {
  readonly escalaPct: number;
  readonly posX: number;
  readonly posY: number;
  readonly cropTopoPct: number;
}

/** "50" no campo -> 0.5; fora de 40..60 e clampado (o usuario tenta 50/50). */
export function fracaoDivisao(valorCampo: number): number {
  const f = Number.isFinite(valorCampo) ? valorCampo / 100 : 0.5;
  return clamp(f, 0.40, 0.60);
}

/**
 * Onde e quanto cada B-roll fica na caixa de baixo.
 *
 * O efeito de corte renderiza ANTES do Motion: `Top` deixa a faixa de cima
 * transparente sem mudar o raster w x h. Por isso a escala e a posicao contam
 * com o raster inteiro, e a parte visivel e h*(1-cropTopo).
 */
export function calcularEnquadramento(e: EntradaGeom): Enquadramento {
  const yBox = e.H * e.brollTopoFrac;
  const Wbox = e.W;
  const Hbox = e.H - yBox;

  const cropTopo = clamp(e.ancoraY - FOLGA[e.assunto] + e.cropTopoExtra, 0, CROP_TOPO_MAX);
  const hVis = e.h * (1 - cropTopo);
  const aVis = cropTopo < 1 ? (e.ancoraY - cropTopo) / (1 - cropTopo) : 0;

  const escala = Math.max(Wbox / e.w, Hbox / hVis) * OVERSCAN;
  const s = escala;

  const posX = e.W / 2;
  let posY =
    yBox + SUBJ_IN_BOX * Hbox
    - (cropTopo - 0.5) * e.h * s
    - aVis * hVis * s;

  const posYMin = e.H - 0.5 * e.h * s;                 // fundo coberto
  const posYMax = yBox - (cropTopo - 0.5) * e.h * s;   // topo visivel nao passa de yBox
  posY = posYMin <= posYMax ? clamp(posY, posYMin, posYMax) : posYMin;

  return { escalaPct: escala * 100, posX, posY, cropTopoPct: cropTopo * 100 };
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `node --test "tests/autosplit.test.ts"`
Expected: PASS.

- [ ] **Step 5: `npm run check`**

Run: `npm run check`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/autosplit.ts tests/autosplit.test.ts
git commit -m "feat(auto-split): geometria da caixa meio a meio"
```

---

### Task 4: Pure — nudge do doutor e back-solve do "Aprender"

**Files:**
- Modify: `src/autosplit.ts`
- Modify: `tests/autosplit.test.ts`

**Interfaces:**
- Consumes: `EntradaGeom`, `FOLGA`, `CROP_TOPO_MAX`, `OVERSCAN`, `SUBJ_IN_BOX` da Task 3; `PerfilEntrada` da Task 2.
- Produces:
  ```ts
  export const DOCTOR_UP: number;   // 0.85
  export const PASSO_APRENDER: number;   // 0.30
  export interface EntradaDoutor { readonly H: number; readonly hDoc: number; readonly escalaDocPct: number; }
  export function nudgeDoutorPosY(e: EntradaDoutor): number;
  export interface EntradaAprender {
    readonly guardado: Pick<PerfilEntrada, "assunto" | "ancoraY" | "cropTopoExtra">;
    readonly geomUsada: EntradaGeom;
    readonly usado: Enquadramento;
    readonly finalPosY: number;
    readonly finalEscalaPct: number;
    readonly finalCropTopoPct: number;
    readonly passo?: number;
  }
  export interface Aprendido { readonly ancoraY: number; readonly cropTopoExtra: number; readonly mudou: boolean; }
  export function aprenderEnquadramento(e: EntradaAprender): Aprendido;
  ```

- [ ] **Step 1: Escrever os testes que falham**

Adicionar a `tests/autosplit.test.ts`:

```ts
import {
  nudgeDoutorPosY, aprenderEnquadramento, calcularEnquadramento as calc,
  type EntradaAprender,
} from "../src/autosplit.ts";

test("nudgeDoutorPosY sobe o clipe mas mantem o topo coberto", () => {
  // doutor vertical preenchendo a tela: hDoc*sDoc = 1920, meia altura 960
  const y = nudgeDoutorPosY({ H: 1920, hDoc: 1280, escalaDocPct: 150 });
  assert.ok(y < 960);            // subiu
  assert.ok(y <= 960 + 0.001);   // nao passou de meia-altura-da-midia (sem tarja no topo)
});

test("nudgeDoutorPosY: origem pequena limita a subida", () => {
  // hDoc*sDoc = 1000, meia altura 500 -> nao pode subir alem de 500
  const y = nudgeDoutorPosY({ H: 1920, hDoc: 1000, escalaDocPct: 100 });
  assert.ok(y <= 500 + 0.001);
});

const GEOM: EntradaGeom = {
  W: 1080, H: 1920, brollTopoFrac: 0.5,
  w: 720, h: 1280, ancoraY: 0.30, assunto: "pessoa", cropTopoExtra: 0,
};

test("aprender: usuario nao mexeu -> mudou:false", () => {
  const usado = calc(GEOM);
  const r = aprenderEnquadramento({
    guardado: { assunto: "pessoa", ancoraY: 0.30, cropTopoExtra: 0 },
    geomUsada: GEOM, usado,
    finalPosY: usado.posY, finalEscalaPct: usado.escalaPct, finalCropTopoPct: usado.cropTopoPct,
  });
  assert.equal(r.mudou, false);
  assert.equal(r.ancoraY, 0.30);
});

test("aprender: usuario aumentou o Top -> cropTopoExtra sobe (limitado ao passo)", () => {
  const usado = calc(GEOM);
  const r = aprenderEnquadramento({
    guardado: { assunto: "pessoa", ancoraY: 0.30, cropTopoExtra: 0 },
    geomUsada: GEOM, usado,
    finalPosY: usado.posY, finalEscalaPct: usado.escalaPct,
    finalCropTopoPct: usado.cropTopoPct + 40, // empurrao grande
  });
  assert.equal(r.mudou, true);
  assert.ok(r.cropTopoExtra > 0);
  assert.ok(r.cropTopoExtra <= 0.30 + 1e-9); // nunca mais que um passo
});

test("aprender: usuario desceu o assunto -> ancoraY sobe", () => {
  const usado = calc(GEOM);
  const r = aprenderEnquadramento({
    guardado: { assunto: "pessoa", ancoraY: 0.30, cropTopoExtra: 0 },
    geomUsada: GEOM, usado,
    finalPosY: usado.posY + 200, // moveu o clipe pra baixo => assunto aparece mais embaixo
    finalEscalaPct: usado.escalaPct, finalCropTopoPct: usado.cropTopoPct,
  });
  assert.equal(r.mudou, true);
  assert.ok(r.ancoraY > 0.30);
});
```

- [ ] **Step 2: Rodar e ver falhar**

Run: `node --test "tests/autosplit.test.ts"`
Expected: FAIL — funções não existem.

- [ ] **Step 3: Implementar em `src/autosplit.ts`**

```ts
export const DOCTOR_UP = 0.85;
export const PASSO_APRENDER = 0.30;

export interface EntradaDoutor {
  readonly H: number;
  readonly hDoc: number;
  readonly escalaDocPct: number;
}

/**
 * Novo Position.y do doutor. Sobe (y menor) por DOCTOR_UP, mas nunca alem de
 * meia altura da midia ja escalada — passar disso abre tarja preta no topo.
 * O chamador ja garantiu: checkbox ligado, origem retrato, clipe coberto.
 */
export function nudgeDoutorPosY(e: EntradaDoutor): number {
  const meiaAltura = 0.5 * e.hDoc * (e.escalaDocPct / 100);
  return Math.min((e.H / 2) * DOCTOR_UP, meiaAltura);
}

export interface EntradaAprender {
  readonly guardado: Pick<PerfilEntrada, "assunto" | "ancoraY" | "cropTopoExtra">;
  readonly geomUsada: EntradaGeom;
  readonly usado: Enquadramento;
  readonly finalPosY: number;
  readonly finalEscalaPct: number;
  readonly finalCropTopoPct: number;
  readonly passo?: number;
}

export interface Aprendido {
  readonly ancoraY: number;
  readonly cropTopoExtra: number;
  readonly mudou: boolean;
}

/**
 * Inverte a geometria a partir do que o usuario deixou na timeline (Position.y,
 * Scale, Top do efeito) e move o valor guardado nessa direcao por, no maximo,
 * um passo. Duas observacoes (posY, Top), duas incognitas (ancoraY,
 * cropTopoExtra).
 */
export function aprenderEnquadramento(e: EntradaAprender): Aprendido {
  const passo = e.passo ?? PASSO_APRENDER;
  const eps = 0.5; // px / pontos percentuais: abaixo disso e "nao mexeu"

  const mexeu =
    Math.abs(e.finalPosY - e.usado.posY) > eps ||
    Math.abs(e.finalCropTopoPct - e.usado.cropTopoPct) > eps ||
    Math.abs(e.finalEscalaPct - e.usado.escalaPct) > eps;

  if (!mexeu) {
    return { ancoraY: e.guardado.ancoraY, cropTopoExtra: e.guardado.cropTopoExtra, mudou: false };
  }

  const g = e.geomUsada;
  const yBox = g.H * g.brollTopoFrac;
  const Hbox = g.H - yBox;
  const folga = FOLGA[e.guardado.assunto];

  const cropTopoF = clamp(e.finalCropTopoPct / 100, 0, CROP_TOPO_MAX);
  const hVisF = g.h * (1 - cropTopoF);
  const sF = e.finalEscalaPct / 100;

  // inverte posY = yBox + SUBJ_IN_BOX*Hbox - (cropTopoF-0.5)*h*sF - aVisF*hVisF*sF
  const aVisF =
    (yBox + SUBJ_IN_BOX * Hbox - (cropTopoF - 0.5) * g.h * sF - e.finalPosY) / (hVisF * sF);
  const ancoraYF = clamp(cropTopoF + aVisF * (1 - cropTopoF), 0, 1);
  const cropTopoExtraF = clamp(cropTopoF - ancoraYF + folga, 0, CROP_TOPO_MAX);

  const passoLimitado = (alvo: number, base: number): number =>
    base + clamp(alvo - base, -passo, passo);

  const ancoraY = clamp(passoLimitado(ancoraYF, e.guardado.ancoraY), 0, 1);
  const cropTopoExtra = clamp(passoLimitado(cropTopoExtraF, e.guardado.cropTopoExtra), 0, CROP_TOPO_MAX);

  const mudou =
    Math.abs(ancoraY - e.guardado.ancoraY) > 1e-6 ||
    Math.abs(cropTopoExtra - e.guardado.cropTopoExtra) > 1e-6;

  return { ancoraY, cropTopoExtra, mudou };
}
```

- [ ] **Step 4: Rodar e ver passar**

Run: `node --test "tests/autosplit.test.ts"`
Expected: PASS — todos os testes de `autosplit.test.ts`.

- [ ] **Step 5: `npm run verify`**

Run: `npm run verify`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/autosplit.ts tests/autosplit.test.ts
git commit -m "feat(auto-split): nudge do doutor e back-solve do aprender"
```

---

### Task 5: Perfil da biblioteca — extrair frames e preencher `autosplit-perfil.json`

Esta task produz dado, não código de produto. Os "passos" 4–5 são um laço de julgamento visual, não ações de 2 minutos. Pode rodar em paralelo com as Tasks 2–4 e 6.

**Files:**
- Create: `scripts/frames.mjs`
- Create: `src/autosplit-perfil.json`
- Modify: `tsconfig.json`

**Interfaces:**
- Consumes: o schema `Perfil` da Task 2.
- Produces: `src/autosplit-perfil.json` com uma entrada `porArquivo` para cada `.mp4` da biblioteca e uma `padraoPorConceito` para cada conceito.

- [ ] **Step 1: `resolveJsonModule` no `tsconfig.json`**

Em `compilerOptions`, adicionar:

```json
    "resolveJsonModule": true,
```

- [ ] **Step 2: Escrever `scripts/frames.mjs`**

```js
/*
 * Extrai 1 frame (a ~40% da duracao, 480px de largura) e as dimensoes de cada
 * .mp4 da biblioteca de B-rolls, e monta contact-sheets de 25 pra revisao.
 *
 * Saida em scratch/: frames PNG, _dims.json (nome -> {w,h}), sheet-NN.png.
 * Uso: node scripts/frames.mjs "C:\\Users\\leogi\\Downloads\\Brolls - 2026"
 */
import { execFile } from "node:child_process";
import { promisify } from "node:util";
import { mkdir, readdir, writeFile, rm } from "node:fs/promises";
import { join, basename } from "node:path";

const run = promisify(execFile);
const lib = process.argv[2] ?? "C:\\Users\\leogi\\Downloads\\Brolls - 2026";
const out = join(process.cwd(), "scratch");
await rm(out, { recursive: true, force: true });
await mkdir(join(out, "frames"), { recursive: true });

const arquivos = (await readdir(lib)).filter((f) => f.toLowerCase().endsWith(".mp4")).sort();
const dims = {};

for (const f of arquivos) {
  const src = join(lib, f);
  const { stdout } = await run("ffprobe", [
    "-v", "error", "-select_streams", "v:0",
    "-show_entries", "stream=width,height,duration",
    "-of", "json", src,
  ]);
  const s = JSON.parse(stdout).streams[0];
  dims[f] = { w: Number(s.width), h: Number(s.height) };
  const ss = Math.max(0.1, (Number(s.duration) || 5) * 0.4).toFixed(2);
  await run("ffmpeg", [
    "-v", "error", "-ss", ss, "-i", src, "-frames:v", "1",
    "-vf", "scale=480:-1", "-y",
    join(out, "frames", basename(f, ".mp4") + ".png"),
  ]);
  process.stdout.write(".");
}
await writeFile(join(out, "_dims.json"), JSON.stringify(dims, null, 2));

// contact-sheets de 25 (5x5)
const pngs = arquivos.map((f) => basename(f, ".mp4") + ".png");
for (let i = 0; i < pngs.length; i += 25) {
  const lote = pngs.slice(i, i + 25);
  const listaTxt = join(out, `lote-${i}.txt`);
  await writeFile(listaTxt, lote.map((p) => `file '${join(out, "frames", p)}'`).join("\n"));
  await run("ffmpeg", [
    "-v", "error", "-f", "concat", "-safe", "0", "-i", listaTxt,
    "-vf", "scale=240:-1,tile=5x5:padding=4:margin=4", "-y",
    join(out, `sheet-${String(i / 25).padStart(2, "0")}.png`),
  ]);
}
console.log(`\n${arquivos.length} arquivos, ${Math.ceil(pngs.length / 25)} sheets em ${out}`);
```

- [ ] **Step 3: Rodar**

Run: `node scripts/frames.mjs`
Expected: `scratch/frames/*.png`, `scratch/_dims.json`, `scratch/sheet-*.png`. Contagem bate com 251 (ou o que a pasta tiver hoje).

- [ ] **Step 4: Semear `src/autosplit-perfil.json`**

```json
{
  "versao": 1,
  "padraoPorConceito": {},
  "porArquivo": {}
}
```

- [ ] **Step 5: Preencher `porArquivo`, um contact-sheet por vez**

Para cada `scratch/sheet-NN.png`: abrir a imagem, e para cada frame preencher uma entrada em `porArquivo` com a chave = nome do arquivo **com** `.mp4`:

- `assunto`: `rosto` (close de rosto), `pessoa` (uma pessoa corpo/meio-corpo), `dupla` (duas pessoas), `aberto` (plano largo, ambiente, objeto).
- `ancoraY`: fração da altura onde está o centro do que precisa ficar visível (rosto/olhos numa pessoa; centro do grupo numa dupla; centro do interesse num plano aberto). Ex.: rosto no terço de cima ≈ `0.25`.
- `cropTopoExtra`: `0` por padrão; `0.03`–`0.08` só quando há lixo evidente no topo (teto liso, céu, marca "Veo" no canto superior).
- `w`, `h`: de `scratch/_dims.json`.
- `nota`: 3–6 palavras pra próxima rodada ("rosto alto à esquerda", "plano largo cozinha").

Commit a cada sheet:

```bash
git add src/autosplit-perfil.json
git commit -m "data(auto-split): perfil dos B-rolls, sheet NN"
```

- [ ] **Step 6: Preencher `padraoPorConceito`**

Para cada conceito (nome sem `(n)`), calcular a mediana de `ancoraY` e de `cropTopoExtra` das suas entradas e o `assunto` mais comum. Entrada por conceito = `{ assunto, ancoraY, cropTopoExtra }` (sem `w`/`h`/`nota`). Serve de rede pra take novo sem perfil.

- [ ] **Step 7: Verificar cobertura e validade**

Run: `node -e "const p=require('./src/autosplit-perfil.json');const fs=require('fs');const libs=fs.readdirSync(process.argv[1]).filter(f=>f.endsWith('.mp4'));const falta=libs.filter(f=>!p.porArquivo[f]);console.log('sem perfil:',falta.length, falta.slice(0,5));console.log('conceitos:',Object.keys(p.padraoPorConceito).length)" "C:\\Users\\leogi\\Downloads\\Brolls - 2026"`
Expected: `sem perfil: 0`.

- [ ] **Step 8: `npm run check` e commit final**

Run: `npm run check`
Expected: PASS (JSON válido, `resolveJsonModule` ativo).

```bash
git add tsconfig.json scripts/frames.mjs src/autosplit-perfil.json
git commit -m "data(auto-split): perfil completo da biblioteca + padroes por conceito"
```

---

### Task 6: Adapter — ler B-rolls, resolver perfil, montar o plano (sem aplicar)

**Files:**
- Create: `src/autosplit-premiere.ts`

**Interfaces:**
- Consumes: `getSequenceInfo`, `lerBrollsAcimaDeV1`, `readJson` de `../../auto-broll-premiere/src/premiere.ts`; `resolverPerfil`, `calcularEnquadramento`, `conceito`, `fracaoDivisao`, tipos `Perfil`/`OverridePerfil`/`Enquadramento` de `./autosplit.ts`; `src/autosplit-perfil.json`.
- Produces:
  ```ts
  export { getSequenceInfo };
  export interface OpcoesSplit { readonly faixa: number | null; readonly divisao: number; readonly subirDoutor: boolean; readonly refazer: boolean; }
  export interface ItemPlano {
    readonly sourceName: string;
    readonly startSeconds: number; readonly endSeconds: number;
    readonly videoTrackIndex: number;
    readonly orientacao: "retrato" | "paisagem";
    readonly perfilOrigem: "override" | "arquivo" | "conceito" | "default";
    readonly enquadramento: Enquadramento;
    readonly geom: EntradaGeom;
  }
  export interface PlanoSplit { readonly W: number; readonly H: number; readonly itens: readonly ItemPlano[]; readonly linhas: readonly string[]; }
  export function montarPlano(opcoes: OpcoesSplit): Promise<PlanoSplit>;
  ```

- [ ] **Step 1: Cabeçalho e imports**

```ts
/*
 * Auto Split — cola com o Premiere. Tudo que da pra testar sem Premiere mora
 * em autosplit.ts.
 *
 * A regra do lockedAccess/executeTransaction nao e reescrita aqui: vem de
 * `comTransacao`, do adapter do Auto B-roll.
 */

import {
  comTransacao, getSequenceInfo, lerBrollsAcimaDeV1, readJson, writeJson,
} from "../../auto-broll-premiere/src/premiere.ts";
import {
  calcularEnquadramento, conceito, fracaoDivisao, resolverPerfil,
  FEATHER_PCT, ROUNDNESS_PCT,
  type Enquadramento, type EntradaGeom, type OverridePerfil, type Perfil,
} from "./autosplit.ts";
import perfilBruto from "./autosplit-perfil.json";

declare function require(id: string): unknown;
/* eslint-disable @typescript-eslint/no-explicit-any */
const ppro = require("premierepro") as any;
/* eslint-enable @typescript-eslint/no-explicit-any */

const CLIP = 1; // ppro.Constants.TrackItemType.CLIP
const MATCH_MOTION = "AE.ADBE Motion";

const perfil = perfilBruto as Perfil;

export { getSequenceInfo };
```

- [ ] **Step 2: Helpers de leitura**

```ts
export interface OpcoesSplit {
  readonly faixa: number | null;
  readonly divisao: number;      // valor do campo, ex. 50
  readonly subirDoutor: boolean;
  readonly refazer: boolean;
}

export interface ItemPlano {
  readonly sourceName: string;
  readonly startSeconds: number;
  readonly endSeconds: number;
  readonly videoTrackIndex: number;
  readonly orientacao: "retrato" | "paisagem";
  readonly perfilOrigem: "override" | "arquivo" | "conceito" | "default";
  readonly enquadramento: Enquadramento;
  readonly geom: EntradaGeom;
}

export interface PlanoSplit {
  readonly W: number;
  readonly H: number;
  readonly itens: readonly ItemPlano[];
  readonly linhas: readonly string[];
}

async function lerOverride(): Promise<OverridePerfil> {
  const bruto = await readJson("autosplit-perfil-override.json");
  return (bruto && typeof bruto === "object" ? bruto : {}) as OverridePerfil;
}
```

- [ ] **Step 3: `montarPlano`**

```ts
/**
 * Le os B-rolls acima da V1, resolve o perfil de cada um e calcula o
 * enquadramento. Nao toca a timeline. `w`/`h` vem do perfil; sem perfil,
 * assume retrato e loga (a biblioteca inteira tem perfil; isso e so o B-roll
 * de fora dela).
 */
export async function montarPlano(opcoes: OpcoesSplit): Promise<PlanoSplit> {
  const info = await getSequenceInfo();
  if (!(info.width > 0) || !(info.height > 0)) {
    throw new Error("Nao deu pra ler o quadro da sequencia.");
  }
  const override = await lerOverride();
  const brollTopoFrac = fracaoDivisao(opcoes.divisao);

  const todos = await lerBrollsAcimaDeV1();
  const alvo = opcoes.faixa === null ? todos : todos.filter((b) => b.videoTrackIndex === opcoes.faixa);

  const linhas: string[] = [];
  const itens: ItemPlano[] = [];
  let semPerfil = 0;

  for (const b of alvo) {
    const doArquivo = perfil.porArquivo[b.sourceName];
    const w = doArquivo?.w;
    const h = doArquivo?.h;
    const orientacao: "retrato" | "paisagem" =
      w && h ? (h >= w ? "retrato" : "paisagem") : "retrato";
    if (!w || !h) semPerfil++;

    const resolvido = resolverPerfil(perfil, override, b.sourceName, orientacao);
    if (resolvido.origem === "default") semPerfil++;

    const geom: EntradaGeom = {
      W: info.width, H: info.height, brollTopoFrac,
      w: w ?? 1080, h: h ?? 1920,
      ancoraY: resolvido.ancoraY, assunto: resolvido.assunto, cropTopoExtra: resolvido.cropTopoExtra,
    };
    itens.push({
      sourceName: b.sourceName,
      startSeconds: b.startSeconds,
      endSeconds: b.endSeconds,
      videoTrackIndex: b.videoTrackIndex,
      orientacao,
      perfilOrigem: resolvido.origem,
      enquadramento: calcularEnquadramento(geom),
      geom,
    });
  }

  linhas.push(`${info.name} — ${info.width}x${info.height}`);
  linhas.push(`${itens.length} B-rolls ${opcoes.faixa === null ? "acima da V1" : `na V${opcoes.faixa + 1}`}`);
  if (semPerfil > 0) linhas.push(`${semPerfil} sem perfil (padrao por orientacao)`);
  if (itens.length === 0) linhas.push("Nada a fazer.");

  return { W: info.width, H: info.height, itens, linhas };
}
```

- [ ] **Step 4: `npm run check`**

Run: `npm run check`
Expected: PASS. (Sem teste unitário — arquivo toca `premierepro`. A verificação real é ao vivo.)

- [ ] **Step 5: Commit**

```bash
git add src/autosplit-premiere.ts tsconfig.json
git commit -m "feat(auto-split): monta o plano de enquadramento a partir da timeline"
```

---

### Task 7: Diagnóstico do efeito — botão temporário + rodar no Premiere 26

**Files:**
- Modify: `src/autosplit-premiere.ts`
- Modify: `src/ui/autosplit.html`
- Modify: `src/ui/autosplit-mount.ts`

**Interfaces:**
- Consumes: `montarPlano` da Task 6; `comTransacao`.
- Produces: `export function diagnostico(): Promise<string[]>` em `src/autosplit-premiere.ts`, e escreve `diag-autosplit.json` no PluginData.

- [ ] **Step 1: `diagnostico()` no adapter**

```ts
/**
 * Sonda unica: descobre o matchName do efeito de canto arredondado, se da pra
 * criar/anexar por codigo, se os params (Top/Feather/Roundness) sao setaveis, e
 * se o Position 2D do Motion aceita createKeyframe([x, y]). Grava tudo em
 * diag-autosplit.json e DESFAZ o que mexeu.
 */
export async function diagnostico(): Promise<string[]> {
  const linhas: string[] = [];
  const saida: Record<string, unknown> = {};

  const nomes: string[] = await ppro.VideoFilterFactory.getDisplayNames();
  const matchNames: string[] = await ppro.VideoFilterFactory.getMatchNames();
  saida.displayNames = nomes;
  saida.matchNames = matchNames;
  linhas.push(`${nomes.length} efeitos de video disponiveis`);

  const idx = nomes.findIndex((n) => /cantos?\s+arredondad|rounded/i.test(n));
  const candidato = idx >= 0 ? { display: nomes[idx], match: matchNames[idx] } : null;
  saida.candidato = candidato;
  linhas.push(candidato ? `candidato: "${candidato.display}" (${candidato.match})` : "nenhum candidato obvio — ver a lista no JSON");

  const plano = await montarPlano({ faixa: null, divisao: 50, subirDoutor: false, refazer: false });
  if (plano.itens.length === 0) {
    linhas.push("sem B-roll acima da V1 — nao deu pra testar Motion/efeito no clipe");
    await writeJson("diag-autosplit.json", saida);
    return linhas;
  }

  const alvo = plano.itens[0]!;
  const { project, sequence } = await ativa();
  const faixa = await (sequence as SeqFaixas).getVideoTrack(alvo.videoTrackIndex);
  const item = (await faixa.getTrackItems(CLIP, false)).find(
    (i: TrackItemLike) => i.name === alvo.sourceName || i.getProjectItem,
  ) as TrackItemLike | undefined;

  // ... tenta setar Position 2D e criar/anexar/setar o efeito, capturando cada erro
  // (código completo no Step 2)
  await writeJson("diag-autosplit.json", saida);
  return linhas;
}
```

- [ ] **Step 2: Corpo completo da sonda de Motion + efeito**

Substituir o comentário `// ...` por:

```ts
  const chain = await item!.getComponentChain();
  const acharComp = async (match: string) => {
    for (let i = 0; i < chain.getComponentCount(); i++) {
      const c = chain.getComponentAtIndex(i);
      if ((await c.getMatchName()) === match) return c;
    }
    return null;
  };
  const acharParam = async (comp: ComponentLike, nome: string) => {
    for (let p = 0; p < comp.getParamCount(); p++) {
      const par = comp.getParam(p);
      if (par.displayName === nome) return par;
    }
    return null;
  };

  const motion = await acharComp(MATCH_MOTION);
  const pos = motion ? await acharParam(motion, "Position") : null;
  try {
    if (pos) {
      comTransacao(project as never, "diag: Position 2D", (add) => {
        add(pos.createSetValueAction(pos.createKeyframe([alvo.enquadramento.posX, alvo.enquadramento.posY]), true));
      });
      saida.position2d = "ok: createKeyframe([x,y]) aceito";
      linhas.push("Position 2D: ok");
    } else {
      saida.position2d = "param Position nao encontrado no Motion";
    }
  } catch (e) {
    saida.position2d = `erro: ${(e as Error).message}`;
    linhas.push(`Position 2D: FALHOU — ${(e as Error).message}`);
  }

  if (candidato) {
    try {
      const comp = await ppro.VideoFilterFactory.createComponent(candidato.match);
      saida.createComponent = "ok";
      comTransacao(project as never, "diag: anexar efeito", (add) => {
        add(chain.createAppendComponentAction(comp));
      });
      saida.append = "ok";
      const recarregado = await acharComp(candidato.match);
      const params: string[] = [];
      if (recarregado) {
        for (let p = 0; p < recarregado.getParamCount(); p++) params.push(recarregado.getParam(p).displayName);
      }
      saida.paramsDoEfeito = params;
      linhas.push(`efeito anexado — params: ${params.join(", ")}`);
      for (const nome of ["Top", "Feather", "Roundness"]) {
        const par = recarregado ? await acharParam(recarregado, nome) : null;
        try {
          if (par) {
            comTransacao(project as never, `diag: set ${nome}`, (add) => {
              add(par.createSetValueAction(par.createKeyframe(nome === "Top" ? 20 : nome === "Feather" ? 5 : 0), true));
            });
            saida[`set${nome}`] = "ok";
          } else {
            saida[`set${nome}`] = "param nao encontrado";
          }
        } catch (e) {
          saida[`set${nome}`] = `erro: ${(e as Error).message}`;
        }
      }
    } catch (e) {
      saida.efeitoErro = `${(e as Error).message}`;
      linhas.push(`efeito: FALHOU — ${(e as Error).message}`);
    }
  }

  linhas.push("Desfaça no Premiere (Ctrl+Z) até a timeline voltar ao que era. Me mande diag-autosplit.json.");
```

Adicionar os tipos auxiliares e `ativa()` no topo do arquivo:

```ts
interface TrackItemLike { name?: string; getProjectItem?: () => Promise<{ name: string } | null>; getComponentChain: () => Promise<ChainLike>; }
interface ChainLike { getComponentCount: () => number; getComponentAtIndex: (i: number) => ComponentLike; createAppendComponentAction: (c: unknown) => unknown; createInsertComponentAction: (c: unknown, i: number) => unknown; createRemoveComponentAction: (c: unknown) => unknown; }
interface ComponentLike { getMatchName: () => Promise<string>; getParamCount: () => number; getParam: (i: number) => ParamLike; }
interface ParamLike { displayName: string; createKeyframe: (v: number | number[]) => unknown; createSetValueAction: (k: unknown, s: boolean) => unknown; }
interface SeqFaixas { getVideoTrack: (i: number) => Promise<{ getTrackItems: (t: number, e: boolean) => Promise<TrackItemLike[]> }>; }

async function ativa(): Promise<{ project: unknown; sequence: unknown }> {
  const project = await ppro.Project.getActiveProject();
  if (!project) throw new Error("Nenhum projeto aberto.");
  const sequence = await project.getActiveSequence();
  if (!sequence) throw new Error("Nenhuma sequencia ativa.");
  return { project, sequence };
}
```

- [ ] **Step 3: Botão no HTML**

Em `src/ui/autosplit.html`, antes do `<pre id="asLog">`:

```html
  <button id="asDiag" class="as-botao" type="button">Diagnóstico</button>
```

E no `<style>`:

```css
  .as-botao {
    align-self: flex-start; margin-top: 8px; padding: 7px 14px;
    border-radius: 7px; border: 1px solid #333b47; background-color: #1a1e26;
    color: #eceef2; font-size: 12px; cursor: pointer;
  }
  .as-botao:hover { background-color: #21262f; }
```

- [ ] **Step 4: Fio no mount**

Substituir o corpo de `mount` em `src/ui/autosplit-mount.ts`:

```ts
import { diagnostico } from "../autosplit-premiere.ts";

export function mount(root: HTMLElement): void {
  const log = root.querySelector<HTMLPreElement>("#asLog")!;
  const diag = root.querySelector<HTMLButtonElement>("#asDiag")!;
  log.textContent = "Auto Split — deixe um B-roll na V2 e rode o Diagnóstico.";

  diag.addEventListener("click", () => {
    void (async () => {
      try {
        log.textContent = "Rodando diagnóstico...";
        const linhas = await diagnostico();
        log.textContent = linhas.join("\n");
      } catch (e) {
        log.textContent = `Erro: ${(e as Error)?.message ?? String(e)}`;
      }
    })();
  });
}
```

- [ ] **Step 5: `npm run verify`**

Run: `npm run verify`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/autosplit-premiere.ts src/ui/autosplit.html src/ui/autosplit-mount.ts
git commit -m "feat(auto-split): botao de diagnostico do efeito e do Position 2D"
```

- [ ] **Step 7: CHECKPOINT — rodar no Premiere 26**

Instalar/atualizar o Pro Edition (rebuild + reiniciar o Premiere). Abrir uma sequência com pelo menos um B-roll na V2. Abrir Auto Split → **Diagnóstico**. Desfazer no Premiere.

Ler `%APPDATA%\Adobe\UXP\PluginsStorage\PPRO\26\External\com.leogi.proedition\PluginData\diag-autosplit.json`.

Anotar para as Tasks 8–9:
- `candidato.match` — o matchName real do efeito ("Cantos arredondados").
- `paramsDoEfeito` — os displayNames reais dos params de corte de topo, feather e canto.
- `position2d` — `ok` ou o erro (define como setar Position na Task 8).
- `setTop`/`setFeather`/`setRoundness` — `ok` ou erro.

**Não seguir para a Task 8 sem esse JSON.** Se `position2d` falhou ou o efeito não pôde ser criado/setado, ajustar as Tasks 8–9 conforme o resultado (a Task 9 já tem o caminho degradado).

---

### Task 8: Adapter — aplicar o layout Motion numa transação

**Files:**
- Modify: `src/autosplit-premiere.ts`
- Modify: `src/ui/autosplit.html`
- Modify: `src/ui/autosplit-mount.ts`

**Interfaces:**
- Consumes: `montarPlano`, `ItemPlano`, `PlanoSplit` da Task 6; achados do `diag-autosplit.json` da Task 7 (como setar `Position`).
- Produces:
  ```ts
  export interface ResultadoSplit { readonly ok: boolean; readonly linhas: readonly string[]; }
  export function aplicarSplit(opcoes: OpcoesSplit): Promise<ResultadoSplit>;
  ```

- [ ] **Step 1: Helpers de clipe e param**

Em `src/autosplit-premiere.ts` (reusando os tipos auxiliares da Task 7):

```ts
async function itensDaFaixa(sequence: unknown, videoTrackIndex: number): Promise<TrackItemLike[]> {
  const faixa = await (sequence as SeqFaixas).getVideoTrack(videoTrackIndex);
  if (!faixa) throw new Error(`V${videoTrackIndex + 1} nao existe nesta sequencia.`);
  return faixa.getTrackItems(CLIP, false);
}

/** O clipe certo: mesmo nome de origem e comeca no tempo planejado. */
async function acharItem(itens: readonly TrackItemLike[], sourceName: string, startSeconds: number): Promise<TrackItemLike | null> {
  for (const it of itens) {
    const nome = it.name ?? (await it.getProjectItem?.())?.name;
    if (nome !== sourceName) continue;
    const inicio = (await (it as unknown as { getStartTime: () => Promise<{ seconds: number }> }).getStartTime()).seconds;
    if (Math.abs(inicio - startSeconds) < 0.5) return it;
  }
  return null;
}

async function acharComponente(chain: ChainLike, match: string): Promise<ComponentLike | null> {
  for (let i = 0; i < chain.getComponentCount(); i++) {
    const c = chain.getComponentAtIndex(i);
    if ((await c.getMatchName()) === match) return c;
  }
  return null;
}

async function acharParam(comp: ComponentLike, nome: string): Promise<ParamLike | null> {
  for (let p = 0; p < comp.getParamCount(); p++) {
    const par = comp.getParam(p);
    if (par.displayName === nome) return par;
  }
  return null;
}
```

- [ ] **Step 2: `aplicarSplit` — só Motion**

```ts
export interface ResultadoSplit {
  readonly ok: boolean;
  readonly linhas: readonly string[];
}

/**
 * Aplica escala + posicao da caixa em cada B-roll, numa transacao so. O efeito
 * de corte entra na Task 9. Grava autosplit-aplicado.json (insumo do Aprender)
 * e ultimo-log-autosplit.json.
 */
export async function aplicarSplit(opcoes: OpcoesSplit): Promise<ResultadoSplit> {
  const plano = await montarPlano(opcoes);
  const linhas = [...plano.linhas];
  if (plano.itens.length === 0) {
    await writeJson("ultimo-log-autosplit.json", { quando: Date.now(), linhas });
    return { ok: true, linhas };
  }

  const { project, sequence } = await ativa();
  const aplicado: Record<string, unknown> = {};
  const acoes: Array<() => unknown> = [];
  let ok = true;

  for (const it of plano.itens) {
    const item = await acharItem(await itensDaFaixa(sequence, it.videoTrackIndex), it.sourceName, it.startSeconds);
    if (!item) { linhas.push(`${it.sourceName}: nao achei na timeline`); ok = false; continue; }

    const chain = await item.getComponentChain();
    const motion = await acharComponente(chain, MATCH_MOTION);
    if (!motion) { linhas.push(`${it.sourceName}: sem Motion`); ok = false; continue; }

    const escala = await acharParam(motion, "Scale");
    const pos = await acharParam(motion, "Position");
    if (!escala || !pos) { linhas.push(`${it.sourceName}: sem Scale/Position`); ok = false; continue; }

    const e = it.enquadramento;
    acoes.push(() => escala.createSetValueAction(escala.createKeyframe(e.escalaPct), true));
    acoes.push(() => pos.createSetValueAction(pos.createKeyframe([e.posX, e.posY]), true));

    aplicado[it.sourceName] = {
      startSeconds: it.startSeconds, videoTrackIndex: it.videoTrackIndex,
      geom: it.geom, usado: e,
    };
  }

  comTransacao(project as never, `Auto Split: ${plano.itens.length} B-rolls`, (add) => {
    for (const a of acoes) add(a());
  });

  linhas.push(`${Object.keys(aplicado).length} B-rolls posicionados (escala + posicao).`);
  await writeJson("autosplit-aplicado.json", { quando: Date.now(), divisao: opcoes.divisao, itens: aplicado });
  await writeJson("ultimo-log-autosplit.json", { quando: Date.now(), linhas });
  return { ok, linhas };
}
```

> **Se o diagnóstico disse que `createKeyframe([x,y])` NÃO funciona:** trocar as duas linhas de `pos` por setar os sub-params que o JSON revelou (ex.: `acharParam(motion, "Position")` seguido de `.getParam` dos filhos X/Y, ou o caminho que `diag-autosplit.json` mostrou funcionar). Manter a assinatura de `aplicarSplit` igual.

- [ ] **Step 3: UI — campos e botão Aplicar**

Em `src/ui/autosplit.html`, trocar o miolo de `.as-conteudo` por (mantendo título/sub e o `#asLog`):

```html
  <label class="as-campo">Faixa de B-roll <input id="asFaixa" type="text" placeholder="todas acima da V1"></label>
  <label class="as-campo">Divisão <input id="asDivisao" type="number" value="50" min="40" max="60"> %</label>
  <label class="as-check"><input id="asDoutor" type="checkbox"> Subir o doutor quando vertical</label>
  <label class="as-check"><input id="asRefazer" type="checkbox"> Refazer do zero</label>
  <button id="asAplicar" class="as-botao as-cta" type="button">Aplicar Auto Split</button>
  <button id="asDiag" class="as-botao" type="button">Diagnóstico</button>
```

Estilos `.as-campo`/`.as-check`/`.as-cta` no `<style>` (input escuro, CTA em `#3b82f6`), seguindo o padrão visual de `autocut.html`.

- [ ] **Step 4: Fio do Aplicar no mount**

```ts
import { aplicarSplit, diagnostico } from "../autosplit-premiere.ts";

// dentro de mount, depois do fio do diag:
const lerOpcoes = () => ({
  faixa: root.querySelector<HTMLInputElement>("#asFaixa")!.value.trim() === ""
    ? null
    : Number(root.querySelector<HTMLInputElement>("#asFaixa")!.value.trim()) - 1,
  divisao: Number(root.querySelector<HTMLInputElement>("#asDivisao")!.value) || 50,
  subirDoutor: root.querySelector<HTMLInputElement>("#asDoutor")!.checked,
  refazer: root.querySelector<HTMLInputElement>("#asRefazer")!.checked,
});

root.querySelector<HTMLButtonElement>("#asAplicar")!.addEventListener("click", () => {
  void (async () => {
    try {
      log.textContent = "Aplicando...";
      const r = await aplicarSplit(lerOpcoes());
      log.textContent = [...r.linhas, "", r.ok ? "Pronto. Ajuste o que precisar no Premiere." : "Aplicado COM PROBLEMA — veja acima."].join("\n");
    } catch (e) {
      log.textContent = `Erro: ${(e as Error)?.message ?? String(e)}`;
    }
  })();
});
```

> O campo "Faixa" recebe o número humano (V2 = 2) e converte pra índice base 0. Vazio = todas acima da V1.

- [ ] **Step 5: `npm run verify`**

Run: `npm run verify`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/autosplit-premiere.ts src/ui/autosplit.html src/ui/autosplit-mount.ts
git commit -m "feat(auto-split): aplica escala e posicao da caixa em lote"
```

- [ ] **Step 7: CHECKPOINT — testar no Premiere 26**

Rebuild + reiniciar. Sequência com B-rolls na V2 → Aplicar Auto Split. Confirmar: cada B-roll foi pra metade de baixo, largura cheia, sem tarja preta. Um `Ctrl+Z` desfaz o lote inteiro. Se a posição sair errada, ajustar as constantes em `src/autosplit.ts` (`SUBJ_IN_BOX`, `OVERSCAN`) e os testes correspondentes.

---

### Task 9: Adapter — adicionar o efeito de corte ao `aplicarSplit`

**Files:**
- Modify: `src/autosplit-premiere.ts`

**Interfaces:**
- Consumes: `candidato.match` e os nomes de param reais do `diag-autosplit.json` (Task 7); `FEATHER_PCT`, `ROUNDNESS_PCT` de `./autosplit.ts`.
- Produces: `aplicarSplit` passa a adicionar e configurar o efeito. Constantes novas no topo do arquivo: `MATCH_EFEITO`, `PARAM_TOPO`, `PARAM_FEATHER`, `PARAM_ROUNDNESS`.

- [ ] **Step 1: Fixar o matchName e os nomes de param**

No topo de `src/autosplit-premiere.ts`, com os valores reais lidos do diagnóstico:

```ts
// Do diag-autosplit.json rodado no Premiere 26 (Task 7). Trocar pelos valores reais.
const MATCH_EFEITO = "AE.ADBE ..."; // candidato.match
const PARAM_TOPO = "Top";
const PARAM_FEATHER = "Feather";
const PARAM_ROUNDNESS = "Roundness";
const EFEITO_OK = MATCH_EFEITO.startsWith("AE.") || MATCH_EFEITO.startsWith("PR.");
```

- [ ] **Step 2: Função que monta as ações do efeito para um clipe**

```ts
/**
 * Acoes pra pôr o efeito de corte num clipe e setar Top/Feather/Roundness.
 * Idempotente: se o efeito ja esta na chain e `refazer` e false, nao faz nada.
 * Se `refazer` e true, remove o que tinha antes.
 */
async function acoesDoEfeito(
  chain: ChainLike, cropTopoPct: number, refazer: boolean,
): Promise<{ acoes: Array<() => unknown>; nota: string }> {
  const existente = await acharComponente(chain, MATCH_EFEITO);
  if (existente && !refazer) return { acoes: [], nota: "efeito ja aplicado, pulado" };

  const acoes: Array<() => unknown> = [];
  if (existente && refazer) acoes.push(() => chain.createRemoveComponentAction(existente));

  const comp = await ppro.VideoFilterFactory.createComponent(MATCH_EFEITO);
  acoes.push(() => chain.createAppendComponentAction(comp));

  // os params so existem depois de anexar: a Task usa uma 2a transacao pra setar
  return { acoes, nota: "efeito anexado" };
}
```

> **Restrição real da API:** os params de um componente só existem depois de ele estar na chain. Portanto `aplicarSplit` faz **duas** transações: (1) Motion + anexar efeitos; (2) reler cada chain e setar Top/Feather/Roundness. Isso segue o padrão do Auto B-roll (`inserirPlano` faz overwrite numa transação e ajuste em outra "porque o clipe só existe agora").

- [ ] **Step 3: Reescrever `aplicarSplit` com as duas transações**

```ts
export async function aplicarSplit(opcoes: OpcoesSplit): Promise<ResultadoSplit> {
  const plano = await montarPlano(opcoes);
  const linhas = [...plano.linhas];
  if (plano.itens.length === 0) {
    await writeJson("ultimo-log-autosplit.json", { quando: Date.now(), linhas });
    return { ok: true, linhas };
  }
  if (!EFEITO_OK) linhas.push("AVISO: efeito de corte nao disponivel por codigo — so o layout Motion. Solte o preset na mao.");

  const { project, sequence } = await ativa();
  const aplicado: Record<string, unknown> = {};
  let ok = true;

  // Transacao 1: Motion + anexar efeitos.
  const acoes1: Array<() => unknown> = [];
  const paraSetar: Array<{ sourceName: string; videoTrackIndex: number; startSeconds: number; cropTopoPct: number }> = [];

  for (const it of plano.itens) {
    const item = await acharItem(await itensDaFaixa(sequence, it.videoTrackIndex), it.sourceName, it.startSeconds);
    if (!item) { linhas.push(`${it.sourceName}: nao achei na timeline`); ok = false; continue; }
    const chain = await item.getComponentChain();
    const motion = await acharComponente(chain, MATCH_MOTION);
    const escala = motion && (await acharParam(motion, "Scale"));
    const pos = motion && (await acharParam(motion, "Position"));
    if (!escala || !pos) { linhas.push(`${it.sourceName}: sem Scale/Position`); ok = false; continue; }

    const e = it.enquadramento;
    acoes1.push(() => escala.createSetValueAction(escala.createKeyframe(e.escalaPct), true));
    acoes1.push(() => pos.createSetValueAction(pos.createKeyframe([e.posX, e.posY]), true));

    if (EFEITO_OK) {
      const { acoes, nota } = await acoesDoEfeito(chain, e.cropTopoPct, opcoes.refazer);
      acoes1.push(...acoes);
      if (nota !== "efeito ja aplicado, pulado") {
        paraSetar.push({ sourceName: it.sourceName, videoTrackIndex: it.videoTrackIndex, startSeconds: it.startSeconds, cropTopoPct: e.cropTopoPct });
      } else {
        linhas.push(`${it.sourceName}: ${nota}`);
      }
    }
    aplicado[it.sourceName] = { startSeconds: it.startSeconds, videoTrackIndex: it.videoTrackIndex, geom: it.geom, usado: e };
  }

  comTransacao(project as never, `Auto Split: ${plano.itens.length} B-rolls`, (add) => { for (const a of acoes1) add(a()); });

  // Transacao 2: setar os params dos efeitos recem-anexados.
  if (paraSetar.length > 0) {
    const h2 = await ativa();
    const acoes2: Array<() => unknown> = [];
    for (const alvo of paraSetar) {
      const item = await acharItem(await itensDaFaixa(h2.sequence, alvo.videoTrackIndex), alvo.sourceName, alvo.startSeconds);
      const comp = item && (await acharComponente(await item.getComponentChain(), MATCH_EFEITO));
      if (!comp) { linhas.push(`${alvo.sourceName}: efeito sumiu antes de setar`); ok = false; continue; }
      for (const [nome, valor] of [[PARAM_TOPO, alvo.cropTopoPct], [PARAM_FEATHER, FEATHER_PCT], [PARAM_ROUNDNESS, ROUNDNESS_PCT]] as const) {
        const par = await acharParam(comp, nome);
        if (par) acoes2.push(() => par.createSetValueAction(par.createKeyframe(valor), true));
        else linhas.push(`${alvo.sourceName}: param "${nome}" nao encontrado`);
      }
    }
    comTransacao(h2.project as never, "Auto Split: ajustar corte de topo", (add) => { for (const a of acoes2) add(a()); });
    linhas.push(`${paraSetar.length} efeitos de corte aplicados (Top/Feather/Roundness).`);
  }

  linhas.push(`${Object.keys(aplicado).length} B-rolls estilizados.`);
  await writeJson("autosplit-aplicado.json", { quando: Date.now(), divisao: opcoes.divisao, itens: aplicado });
  await writeJson("ultimo-log-autosplit.json", { quando: Date.now(), linhas });
  return { ok, linhas };
}
```

- [ ] **Step 4: `npm run verify`**

Run: `npm run verify`
Expected: PASS.

- [ ] **Step 5: Commit**

```bash
git add src/autosplit-premiere.ts
git commit -m "feat(auto-split): adiciona e configura o efeito de corte de topo"
```

- [ ] **Step 6: CHECKPOINT — testar no Premiere 26**

Rebuild + reiniciar. Aplicar num vídeo real. Confirmar: cada B-roll com o efeito de canto arredondado, Top ≈ o `cropTopoPct` do log, feather 5%. Re-rodar: os já feitos são pulados. Marcar "Refazer do zero" + aplicar: refaz. `Ctrl+Z` desfaz cada transação (são 2–3 Undos agora, não 1 — anotar no GUIA).

---

### Task 10: Adapter + UI — botão "Aprender"

**Files:**
- Modify: `src/autosplit-premiere.ts`
- Modify: `src/ui/autosplit.html`
- Modify: `src/ui/autosplit-mount.ts`

**Interfaces:**
- Consumes: `aprenderEnquadramento`, `conceito` de `./autosplit.ts`; `autosplit-aplicado.json`; `MATCH_EFEITO`, `PARAM_TOPO`.
- Produces: `export function aprender(): Promise<ResultadoSplit>`; escreve `autosplit-perfil-override.json`.

- [ ] **Step 1: `aprender()` no adapter**

```ts
/**
 * Le o que o plugin aplicou da ultima vez (autosplit-aplicado.json), compara
 * com o que o usuario deixou na timeline (Position.y, Scale, Top do efeito), e
 * move a ancora/cropTopoExtra guardados nessa direcao por um passo. Nao toca a
 * timeline. Escreve em autosplit-perfil-override.json.
 */
export async function aprender(): Promise<ResultadoSplit> {
  const bruto = await readJson("autosplit-aplicado.json");
  const dados = bruto as { itens?: Record<string, { startSeconds: number; videoTrackIndex: number; geom: EntradaGeom; usado: Enquadramento }> } | null;
  if (!dados?.itens || Object.keys(dados.itens).length === 0) {
    return { ok: false, linhas: ["Nada aplicado ainda — rode 'Aplicar Auto Split' primeiro."] };
  }

  const override = { ...(await lerOverride()) } as Record<string, { ancoraY: number; cropTopoExtra: number }>;
  const { sequence } = await ativa();
  const linhas: string[] = [];
  let moveram = 0;

  for (const [sourceName, reg] of Object.entries(dados.itens)) {
    const item = await acharItem(await itensDaFaixa(sequence, reg.videoTrackIndex), sourceName, reg.startSeconds);
    if (!item) { linhas.push(`${sourceName}: nao achei na timeline, pulado`); continue; }
    const chain = await item.getComponentChain();
    const efeito = await acharComponente(chain, MATCH_EFEITO);
    if (!efeito) { linhas.push(`${sourceName}: sem efeito de corte (usuario tirou o split), pulado`); continue; }

    const motion = await acharComponente(chain, MATCH_MOTION);
    const pos = motion && (await acharParam(motion, "Position"));
    const escala = motion && (await acharParam(motion, "Scale"));
    const topo = await acharParam(efeito, PARAM_TOPO);
    if (!pos || !escala || !topo) { linhas.push(`${sourceName}: params ilegiveis, pulado`); continue; }

    const finalPos = await lerValor(pos);       // [x, y] ou {x,y} -> y
    const finalEscala = await lerValor(escala); // number
    const finalTopo = await lerValor(topo);     // number

    const conc = conceito(sourceName);
    const guardadoEntrada = perfil.porArquivo[sourceName] ?? perfil.padraoPorConceito[conc];
    const guardado = {
      assunto: reg.geom.assunto,
      ancoraY: override[sourceName]?.ancoraY ?? guardadoEntrada?.ancoraY ?? reg.geom.ancoraY,
      cropTopoExtra: override[sourceName]?.cropTopoExtra ?? guardadoEntrada?.cropTopoExtra ?? reg.geom.cropTopoExtra,
    };

    const r = aprenderEnquadramento({
      guardado, geomUsada: reg.geom, usado: reg.usado,
      finalPosY: yDe(finalPos), finalEscalaPct: Number(finalEscala), finalCropTopoPct: Number(finalTopo),
    });
    if (r.mudou) {
      override[sourceName] = { ancoraY: r.ancoraY, cropTopoExtra: r.cropTopoExtra };
      moveram++;
      linhas.push(`${sourceName}: ancoraY ${guardado.ancoraY.toFixed(2)}→${r.ancoraY.toFixed(2)}, extra ${guardado.cropTopoExtra.toFixed(2)}→${r.cropTopoExtra.toFixed(2)}`);
    }
  }

  await writeJson("autosplit-perfil-override.json", override);
  linhas.push(`${moveram} B-rolls ajustaram o perfil.`);
  return { ok: true, linhas };
}
```

- [ ] **Step 2: Helpers `lerValor` / `yDe`**

```ts
/** Le o valor atual de um param: keyframe unico ou valor direto. Formato varia. */
async function lerValor(par: ParamLike & { getValue?: () => Promise<unknown>; getKeyframeListAsTimes?: () => Promise<unknown> }): Promise<unknown> {
  if (typeof par.getValue === "function") {
    const v = await par.getValue();
    return (v as { value?: unknown })?.value ?? v;
  }
  return 0; // diag-autosplit.json dira o caminho real; ajustar aqui se preciso
}

/** y de um Position que vem como [x,y] ou {x,y} ou {value:[x,y]}. */
function yDe(v: unknown): number {
  if (Array.isArray(v)) return Number(v[1]);
  const o = v as { y?: unknown; value?: unknown };
  if (o?.y !== undefined) return Number(o.y);
  if (Array.isArray(o?.value)) return Number((o.value as unknown[])[1]);
  return NaN;
}
```

> **A leitura de valor de param não foi provada.** A Task 7 (diagnóstico) deve ser estendida com um passo que lê de volta o `Scale` que já existe (via `getValue`/o que houver) e grava o formato em `diag-autosplit.json`. Ajustar `lerValor`/`yDe` com o formato real antes do checkpoint da Step 5.

- [ ] **Step 3: Botão + fio**

`src/ui/autosplit.html`, depois do `#asAplicar`:

```html
  <button id="asAprender" class="as-botao" type="button">Aprender</button>
```

`src/ui/autosplit-mount.ts`:

```ts
import { aplicarSplit, aprender, diagnostico } from "../autosplit-premiere.ts";

root.querySelector<HTMLButtonElement>("#asAprender")!.addEventListener("click", () => {
  void (async () => {
    try {
      log.textContent = "Aprendendo...";
      const r = await aprender();
      log.textContent = r.linhas.join("\n");
    } catch (e) {
      log.textContent = `Erro: ${(e as Error)?.message ?? String(e)}`;
    }
  })();
});
```

- [ ] **Step 4: `npm run verify`**

Run: `npm run verify`
Expected: PASS.

- [ ] **Step 5: Commit + CHECKPOINT**

```bash
git add src/autosplit-premiere.ts src/ui/autosplit.html src/ui/autosplit-mount.ts
git commit -m "feat(auto-split): botao Aprender folda os ajustes no perfil"
```

No Premiere 26: aplicar, ajustar 2–3 B-rolls na mão (subir/descer, mudar Top), clicar Aprender. Conferir `autosplit-perfil-override.json`: as entradas dos clipes ajustados moveram na direção certa, no máximo um passo. Aplicar de novo num vídeo com os mesmos B-rolls → o enquadramento inicial já vem mais perto.

---

### Task 11: UI final, nudge do doutor, docs, limpeza

**Files:**
- Modify: `src/autosplit-premiere.ts`
- Modify: `src/ui/autosplit.html`
- Modify: `src/ui/autosplit-mount.ts`
- Modify: `GUIA-DE-USO.md`
- Modify: `DEV_NOTES.md`

**Interfaces:**
- Consumes: `nudgeDoutorPosY` de `./autosplit.ts`; `lerBrollsAcimaDeV1`.
- Produces: `aplicarSplit` passa a subir o doutor quando `opcoes.subirDoutor`. Botão "Diagnóstico" removido.

- [ ] **Step 1: Nudge do doutor no `aplicarSplit`**

Depois da Transação 2, se `opcoes.subirDoutor`:

```ts
if (opcoes.subirDoutor) {
  const h3 = await ativa();
  const v1 = await itensDaFaixa(h3.sequence, 0);
  const cobertos = plano.itens; // janelas [startSeconds, endSeconds] dos B-rolls estilizados
  const acoes3: Array<() => unknown> = [];
  let subiram = 0;
  for (const doc of v1) {
    const st = (await (doc as unknown as { getStartTime: () => Promise<{ seconds: number }> }).getStartTime()).seconds;
    const en = (await (doc as unknown as { getEndTime: () => Promise<{ seconds: number }> }).getEndTime()).seconds;
    const dentro = cobertos.some((b) => st >= b.startSeconds - 0.05 && en <= b.endSeconds + 0.05);
    if (!dentro) continue;

    const proj = await doc.getProjectItem?.();
    const dims = proj && perfil.porArquivo[(proj as { name: string }).name];
    const retrato = dims?.w && dims?.h ? dims.h >= dims.w : true; // sem perfil do doutor: assume retrato
    if (!retrato) continue;

    const chain = await doc.getComponentChain();
    const motion = await acharComponente(chain, MATCH_MOTION);
    const pos = motion && (await acharParam(motion, "Position"));
    const escala = motion && (await acharParam(motion, "Scale"));
    if (!pos || !escala) continue;
    const hDoc = dims?.h ?? plano.H;
    const escalaDocPct = Number(await lerValor(escala)) || 100;
    const novoY = nudgeDoutorPosY({ H: plano.H, hDoc, escalaDocPct });
    acoes3.push(() => pos.createSetValueAction(pos.createKeyframe([plano.W / 2, novoY]), true));
    subiram++;
  }
  if (acoes3.length > 0) {
    comTransacao(h3.project as never, "Auto Split: subir o doutor", (add) => { for (const a of acoes3) add(a()); });
    linhas.push(`${subiram} clipes do doutor subiram.`);
  }
}
```

- [ ] **Step 2: Tirar o botão Diagnóstico**

Remover `#asDiag` do HTML, o import e o fio de `diagnostico` no mount. **Manter `diagnostico()` no adapter** (não exportado da UI, mas útil pra depurar) — ou movê-lo pra um comentário no `DEV_NOTES`. Decisão: manter a função, tirar só o botão.

- [ ] **Step 3: `GUIA-DE-USO.md`**

Seção nova "Auto Split", sem jargão: quando usar (depois de revisar os B-rolls), o que cada campo faz, que ele deixa um ponto de partida e você ajusta no Premiere, que desfazer são 2–3 Ctrl+Z, e que o "Aprender" melhora os próximos vídeos se você clicar depois de ajustar.

- [ ] **Step 4: `DEV_NOTES.md`**

Seção "Auto Split": os achados do `diag-autosplit.json` (matchName real, formato do Position, formato de leitura de param), as constantes de calibração e onde mexer, o fato de serem 2 transações (params só existem depois de anexar), e o modo degradado.

- [ ] **Step 5: `npm run verify`**

Run: `npm run verify`
Expected: PASS.

- [ ] **Step 6: Commit**

```bash
git add src/autosplit-premiere.ts src/ui/autosplit.html src/ui/autosplit-mount.ts GUIA-DE-USO.md DEV_NOTES.md
git commit -m "feat(auto-split): nudge do doutor, docs e limpeza do diagnostico"
```

- [ ] **Step 7: CHECKPOINT final + revisão do branch**

No Premiere 26: fluxo completo num vídeo real — Auto B-roll insere, você revisa, Auto Split aplica, você ajusta, Aprender. Rodar `superpowers:requesting-code-review` no branch `auto-split` inteiro (os 3 repos se o adapter do Auto B-roll tiver mudado — não deve ter). Merge conforme `superpowers:finishing-a-development-branch`.

---

## Self-Review

**1. Spec coverage:**

| Seção do spec | Task |
|---|---|
| 1. Arquitetura (5 arquivos + registro) | Task 1, 2, 6, 7 |
| 2. Formato do perfil + como é montado + busca em runtime | Task 2 (busca), Task 5 (montagem) |
| 3. Fluxo do "Aplicar" (passos 1–8) | Task 6 (1–3), Task 8 (4–7), Task 9 (efeito), Task 11 (doutor) |
| 4. Geometria (constantes, fórmulas, clamps) | Task 3 |
| 5. UI (campos, checkboxes, botões) | Task 8 (campos), Task 10 (Aprender), Task 11 (final) |
| 6. Aprendizado (back-solve, override, sem tocar timeline) | Task 4 (puro), Task 10 (adapter) |
| 7. Diagnóstico do efeito + modo degradado | Task 7, Task 9 (degradado) |
| 8. Bordas e erros | Task 6 (sem B-roll, sem perfil), Task 8 (não achou clipe), Task 9 (idempotência, refazer) |
| 9. Testes | Tasks 2–4 (`tests/autosplit.test.ts`) |
| 10. Sequência de trabalho | Este plano |
| Riscos (efeito, Position 2D, âncora a olho, 251 arquivos) | Task 7 (efeito + Position), Task 4/10 (âncora → Aprender), Task 5 (biblioteca) |

Sem lacuna.

**2. Placeholder scan:** As Tasks 8–10 têm blocos marcados "ajustar conforme o `diag-autosplit.json`" — isso é sequência real (o diagnóstico da Task 7 é pré-requisito explícito, com checkpoint que bloqueia), não placeholder: o código dado funciona para o caminho tipado no `@adobe/premierepro` 26 e os pontos de ajuste estão nomeados. `MATCH_EFEITO = "AE.ADBE ..."` na Task 9 Step 1 é preenchido no mesmo passo com o valor do diagnóstico.

**3. Type consistency:** `OpcoesSplit`, `ItemPlano`, `PlanoSplit`, `ResultadoSplit`, `Enquadramento`, `EntradaGeom`, `PerfilResolvido` usados igual entre Task 6→11. `acharItem`/`acharComponente`/`acharParam`/`ativa`/`lerValor`/`yDe` definidos na Task 7–8 e reusados depois. `resolverPerfil` assinatura estável Task 2→6. `aprenderEnquadramento` entrada/saída estável Task 4→10.

## Execution Handoff

Ao terminar de salvar este plano, escolher o modo de execução.
