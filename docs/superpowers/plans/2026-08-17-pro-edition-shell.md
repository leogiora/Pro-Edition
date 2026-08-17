# Pro Edition — shell unificado (implementação)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Um plugin UXP novo (`Pro Edition`) com um painel único que mostra uma
tela de seleção (dois cards) e, ao escolher, troca o conteúdo do painel para
o Auto B-roll ou o Pro Captions — reaproveitando o código de UI dos dois
plugins existentes sem fundir os repositórios.

**Architecture:** Auto B-roll e Pro Captions ganham cada um uma função
`mount(root)` exportada (refactor mecânico do boot já existente). O shell
importa essas funções e o HTML/CSS brutos de cada plugin por caminho
relativo entre pastas irmãs (esbuild resolve isso em tempo de build, sem
workspace/monorepo). Uma função pura (`escolherTela`) resolve qual tela
mostrar; uma função impura em `main.ts` (`mostrar`) troca
`document.body.innerHTML` inteiro a cada troca — nunca duas telas juntas no
DOM, o que evita a colisão de IDs (`estado`, `log`, `seqNome`) e de classes
CSS já documentada no spec.

**Tech Stack:** TypeScript + esbuild (iife, sem framework), `node --test`
para a suíte pura, PowerShell para instalação por symlink — mesmo padrão dos
dois plugins existentes. Nenhuma dependência nova.

**Spec:** `docs/superpowers/specs/2026-08-14-pro-edition-design.md` (já
atualizado nesta sessão com a resolução do risco `getDataFolder()`)

## Global Constraints

- `minVersion: 25.0.0` no manifest (mesmo piso dos outros dois plugins, já provado ao vivo).
- Sem CSS Grid em nenhum CSS novo — armadilha documentada, flexbox só.
- Instalação só por symlink (`scripts/install-link.ps1`) + `developer: true` já configurado globalmente — nunca pelo botão Load do UDT (não conecta neste ambiente).
- Ícones com `scale: [1, 2]` exigem `icon@1x.png` **e** `icon@2x.png` fisicamente presentes, não só `icon.png`.
- Nenhuma dependência nova além de `esbuild`, `typescript`, `@types/node` (já usadas nos dois plugins existentes).
- Nunca as duas telas de ferramenta no `document` ao mesmo tempo — toda troca substitui `document.body.innerHTML` inteiro.
- Sem migração automática de `PluginData` por código (sandbox do UXP bloqueia leitura cruzada, confirmado por spike) — passo manual documentado em vez disso.
- Auto B-roll e Pro Captions não mudam de domínio — só o boot da UI (`main.ts` → `mount.ts`) muda, mecanicamente.

---

## Task 1: Auto B-roll — extrair `mount(root)`

**Files:**
- Modify (rename via `git mv`): `C:\Users\leogi\Desktop\auto-broll-premiere\src\ui\main.ts` → `C:\Users\leogi\Desktop\auto-broll-premiere\src\ui\mount.ts`
- Create: `C:\Users\leogi\Desktop\auto-broll-premiere\src\ui\main.ts` (novo, 3 linhas)

**Interfaces:**
- Produces: `export function mount(root: HTMLElement): void` em `mount.ts` — usada pelo shell no Task 6.

- [ ] **Step 1: Renomear o arquivo**

```bash
cd "C:\Users\leogi\Desktop\auto-broll-premiere"
git mv src/ui/main.ts src/ui/mount.ts
```

- [ ] **Step 2: Corrigir o bug real do escopo de módulo**

`const log = el("log");` hoje roda no **top level do módulo** (fora de
qualquer função), então executaria no instante em que o shell importa este
arquivo — antes de o shell ter injetado o HTML do Auto B-roll em
`document.body`. Isso lançaria `elemento ausente no HTML: #log` e quebraria
o boot inteiro dentro do shell (funciona hoje standalone só porque o próprio
`index.html` já tem `#log` presente quando o script roda).

Em `src/ui/mount.ts`, troque:

```ts
interface Caixa extends HTMLElement {
  checked: boolean;
}

const log = el("log");
```

por:

```ts
interface Caixa extends HTMLElement {
  checked: boolean;
}

let log: HTMLElement;
```

- [ ] **Step 3: Renomear `iniciar()` para `mount()` e atribuir `log` primeiro**

Em `src/ui/mount.ts`, troque:

```ts
function iniciar(): void {
  // Primeira coisa visivel: se o distintivo continuar dizendo "carregando",
  // o script nao rodou, e o problema esta no carregamento — nao na logica.
  estado("ligando");
```

por:

```ts
export function mount(root: HTMLElement): void {
  log = el("log");

  // Primeira coisa visivel: se o distintivo continuar dizendo "carregando",
  // o script nao rodou, e o problema esta no carregamento — nao na logica.
  estado("ligando");
```

(`root` fica sem uso direto no corpo — `el()` continua lendo por
`document.getElementById`, IDs continuam globais por decisão do spec. O
parâmetro existe para o contrato do shell, não é dead code do ponto de vista
da interface pública.)

- [ ] **Step 4: Remover a chamada solta no fim do arquivo**

Em `src/ui/mount.ts`, no final do arquivo, remova a última linha:

```ts
iniciar();
```

(A função `mount` fecha com `}` e o arquivo termina ali — quem chama agora é
o novo `main.ts`.)

- [ ] **Step 5: Criar o novo `main.ts` (boot standalone)**

Crie `src/ui/main.ts`:

```ts
import { mount } from "./mount.ts";

mount(document.body);
```

- [ ] **Step 6: Verificar que nada quebrou**

```bash
cd "C:\Users\leogi\Desktop\auto-broll-premiere"
npm run verify
```

Expected: tipos ok, todos os testes existentes continuam verdes (nenhum
cobre `main.ts`/`mount.ts` diretamente — são cobertura de domínio, não
mudam), build gera `dist/index.html` sem erro.

- [ ] **Step 7: Commit**

```bash
cd "C:\Users\leogi\Desktop\auto-broll-premiere"
git add src/ui/main.ts src/ui/mount.ts
git commit -m "refactor: extrai mount(root) do boot da UI para reuso pelo Pro Edition"
```

---

## Task 2: Pro Captions — extrair `mount(root)`

**Files:**
- Modify (rename via `git mv`): `C:\Users\leogi\Desktop\Pro-Captions\src\ui\main.ts` → `C:\Users\leogi\Desktop\Pro-Captions\src\ui\mount.ts`
- Create: `C:\Users\leogi\Desktop\Pro-Captions\src\ui\main.ts` (novo, 3 linhas)

**Interfaces:**
- Produces: `export function mount(root: HTMLElement): void` em `mount.ts` — usada pelo shell no Task 6.

Aqui não há o bug de escopo de módulo do Task 1: `registrar()` lê
`elemento("log")` a cada chamada, não guarda referência no topo do arquivo.
Só o boot solto no final precisa virar função.

- [ ] **Step 1: Renomear o arquivo**

```bash
cd "C:\Users\leogi\Desktop\Pro-Captions"
git mv src/ui/main.ts src/ui/mount.ts
```

- [ ] **Step 2: Envolver o boot numa função exportada**

Em `src/ui/mount.ts`, troque as últimas linhas:

```ts
// Antes de qualquer await: se o I/O pendurar, os botoes ja estao ligados.
estado("pronto");
registrar("painel carregado");
elemento("gerar").addEventListener("click", () => void comLog("gerar legendas", gerar));
elemento("restaurar").addEventListener("click", () => void comLog("restaurar original", restaurar));
```

por:

```ts
export function mount(root: HTMLElement): void {
  // Antes de qualquer await: se o I/O pendurar, os botoes ja estao ligados.
  estado("pronto");
  registrar("painel carregado");
  elemento("gerar").addEventListener("click", () => void comLog("gerar legendas", gerar));
  elemento("restaurar").addEventListener("click", () => void comLog("restaurar original", restaurar));
}
```

- [ ] **Step 3: Criar o novo `main.ts` (boot standalone)**

Crie `src/ui/main.ts`:

```ts
import { mount } from "./mount.ts";

mount(document.body);
```

- [ ] **Step 4: Verificar que nada quebrou**

```bash
cd "C:\Users\leogi\Desktop\Pro-Captions"
npm run verify
```

Expected: tipos ok, todos os testes existentes continuam verdes, build gera
`dist/index.html` sem erro.

- [ ] **Step 5: Commit**

```bash
cd "C:\Users\leogi\Desktop\Pro-Captions"
git add src/ui/main.ts src/ui/mount.ts
git commit -m "refactor: extrai mount(root) do boot da UI para reuso pelo Pro Edition"
```

---

## Task 3: Scaffold do repositório Pro Edition

**Files:**
- Create: `C:\Users\leogi\Desktop\Pro-Edition\package.json`
- Create: `C:\Users\leogi\Desktop\Pro-Edition\tsconfig.json`
- Create: `C:\Users\leogi\Desktop\Pro-Edition\manifest.json`
- Create: `C:\Users\leogi\Desktop\Pro-Edition\scripts\build.mjs`
- Create: `C:\Users\leogi\Desktop\Pro-Edition\scripts\install-link.ps1`
- Create: `C:\Users\leogi\Desktop\Pro-Edition\src\ui\index.html`
- Create: `C:\Users\leogi\Desktop\Pro-Edition\src\ui\assets.d.ts`
- Create (copy): `C:\Users\leogi\Desktop\Pro-Edition\icons\icon.png`, `icon@1x.png`, `icon@2x.png`

**Interfaces:**
- Produces: `npm run verify` funcional (mesmo contrato de scripts dos dois plugins existentes) — usada por todas as tasks seguintes.

- [ ] **Step 1: `package.json`**

```json
{
  "name": "pro-edition",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "description": "Shell UXP que unifica Auto B-roll e Pro Captions num painel so, com tela de selecao.",
  "scripts": {
    "build": "node scripts/build.mjs",
    "watch": "node scripts/build.mjs --watch",
    "check": "tsc --noEmit",
    "test": "node --test \"tests/*.test.ts\"",
    "verify": "npm run check && npm test && npm run build"
  },
  "devDependencies": {
    "@types/node": "^24.13.3",
    "esbuild": "^0.25.0",
    "typescript": "^5.7.0"
  }
}
```

- [ ] **Step 2: `tsconfig.json`**

```json
{
  "compilerOptions": {
    "target": "ES2020",
    "lib": ["ES2020", "DOM"],
    "module": "preserve",
    "moduleResolution": "bundler",
    "allowImportingTsExtensions": true,
    "noEmit": true,

    "strict": true,
    "noUncheckedIndexedAccess": true,
    "noImplicitOverride": true,
    "noFallthroughCasesInSwitch": true,
    "exactOptionalPropertyTypes": true,
    "forceConsistentCasingInFileNames": true,

    "skipLibCheck": true,
    "isolatedModules": true,
    "verbatimModuleSyntax": true
  },
  "include": ["src/**/*.ts", "tests/**/*.ts"]
}
```

(Idêntico ao dos outros dois plugins — inclui os `.ts` dos plugins irmãos
automaticamente porque `tsc` segue o grafo de imports, não só o glob.)

- [ ] **Step 3: `manifest.json`**

```json
{
  "manifestVersion": 5,
  "id": "com.leogi.proedition",
  "name": "Pro Edition",
  "version": "0.1.0",
  "main": "dist/index.html",
  "host": {
    "app": "premierepro",
    "minVersion": "25.0.0"
  },
  "entrypoints": [
    {
      "type": "panel",
      "id": "proEditionPanel",
      "label": { "default": "Pro Edition" },
      "minimumSize": { "width": 320, "height": 400 },
      "preferredDockedSize": { "width": 420, "height": 640 }
    }
  ],
  "requiredPermissions": {
    "localFileSystem": "fullAccess"
  },
  "icons": [
    {
      "width": 23,
      "height": 23,
      "path": "icons/icon.png",
      "scale": [1, 2],
      "theme": ["darkest", "dark", "medium", "lightest", "light", "all"],
      "species": ["pluginList"]
    }
  ]
}
```

- [ ] **Step 4: `scripts/build.mjs`**

Diferente dos outros dois: não embute `<!--ESTILOS-->` (o Pro Edition não
tem CSS estático no `index.html` — cada tela injeta o próprio `<style>` em
tempo de execução via `mostrar()`, Task 6). Só embute o bundle JS, e
configura os loaders `text` para importar HTML/CSS como string em tempo de
build — é assim que `main.ts` lê o HTML/CSS dos dois plugins irmãos sem
tocar no sistema de arquivos em tempo de execução (evita o sandbox do UXP,
que já provou bloquear leitura cruzada de `PluginData` entre plugins).

```js
/*
 * Build do painel. esbuild empacota src/ui/main.ts em dist/main.js.
 *
 * `premierepro` e `uxp` ficam de fora do bundle de proposito: sao modulos que
 * o host injeta em tempo de execucao.
 *
 * Loader `text` para .html/.css: main.ts importa o HTML e o CSS dos dois
 * plugins irmaos como string em tempo de BUILD (esbuild le o arquivo do
 * disco ao empacotar) — nao ha leitura de arquivo em tempo de execucao
 * dentro do Premiere, entao o sandbox do UXP (que bloqueia um plugin lendo
 * a pasta de outro) nunca entra em jogo.
 */

import { build } from "esbuild";
import { mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const raiz = dirname(dirname(fileURLToPath(import.meta.url)));
const dist = join(raiz, "dist");
const observar = process.argv.includes("--watch");

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });

await build({
  entryPoints: [join(raiz, "src", "ui", "main.ts")],
  outfile: join(dist, "main.js"),
  bundle: true,
  external: ["premierepro", "uxp"],
  format: "iife",
  target: "es2020",
  platform: "browser",
  loader: { ".html": "text", ".css": "text" },
  sourcemap: observar ? "inline" : false,
  minify: !observar,
  logLevel: "info",
});

const js = await readFile(join(dist, "main.js"), "utf8");
const html = await readFile(join(raiz, "src", "ui", "index.html"), "utf8");

if (!html.includes("<!--SCRIPT-->")) throw new Error("index.html perdeu a marca <!--SCRIPT-->");
// Fechar a tag dentro de uma string do bundle encerraria o <script> antes da hora.
const saida = html.replace("<!--SCRIPT-->", `<script>\n${js.replace(/<\/script/gi, "<\\/script")}\n</script>`);

await writeFile(join(dist, "index.html"), saida, "utf8");

console.log(`painel construido em ${dist}`);
```

- [ ] **Step 5: `scripts/install-link.ps1`**

```powershell
# Instala o plugin no Premiere por symlink de diretorio.
# Rodar UMA vez, como administrador (escreve em Program Files):
#   powershell -ExecutionPolicy Bypass -File scripts\install-link.ps1
#
# Depois disso, editar o repositorio reflete direto no plugin.
# Reiniciar o Premiere recarrega. Nao ha hot reload.

$ErrorActionPreference = 'Stop'

$repo = Split-Path $PSScriptRoot -Parent
$ext  = 'C:\Program Files\Common Files\Adobe\UXP\Plugins\External'
$link = Join-Path $ext 'com.leogi.proedition'

New-Item -ItemType Directory -Force $ext | Out-Null

if (Test-Path $link) {
    # Remove SOMENTE o link. Directory.Delete sem recursao falha numa pasta real
    # com conteudo — e essa falha e a protecao: nunca apaga o repositorio.
    [System.IO.Directory]::Delete($link, $false)
    Write-Host "link anterior removido"
}

New-Item -ItemType SymbolicLink -Path $link -Target $repo | Out-Null
Write-Host "instalado: $link -> $repo"
Write-Host "reinicie o Premiere Pro para carregar."
```

- [ ] **Step 6: `src/ui/index.html`**

```html
<!DOCTYPE html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <title>Pro Edition</title>
  </head>
  <body>
    <!-- Corpo vazio de proposito: main.ts injeta a tela ativa inteira em
         document.body.innerHTML (Task 6). Nao ha CSS estatico aqui — cada
         tela (seletor, broll, captions) traz o proprio <style>. -->

    <!-- O build substitui esta marca pelo bundle inteiro.
         Caminho relativo nao resolve no UXP. -->
    <!--SCRIPT-->
  </body>
</html>
```

- [ ] **Step 7: `src/ui/assets.d.ts`**

TypeScript não sabe o que é importar um `.html`/`.css` como string — essa
declaração ambiente ensina o `tsc --noEmit` (que o esbuild ignora, mas o
`check` não):

```ts
declare module "*.html" {
  const conteudo: string;
  export default conteudo;
}

declare module "*.css" {
  const conteudo: string;
  export default conteudo;
}
```

- [ ] **Step 8: Ícones (placeholder)**

```powershell
New-Item -ItemType Directory -Force "C:\Users\leogi\Desktop\Pro-Edition\icons" | Out-Null
Copy-Item "C:\Users\leogi\Desktop\auto-broll-premiere\icons\icon.png" "C:\Users\leogi\Desktop\Pro-Edition\icons\icon.png"
Copy-Item "C:\Users\leogi\Desktop\auto-broll-premiere\icons\icon@1x.png" "C:\Users\leogi\Desktop\Pro-Edition\icons\icon@1x.png"
Copy-Item "C:\Users\leogi\Desktop\auto-broll-premiere\icons\icon@2x.png" "C:\Users\leogi\Desktop\Pro-Edition\icons\icon@2x.png"
```

Placeholder emprestado do Auto B-roll só para o manifest carregar — trocar
por arte própria do Pro Edition quando houver.

- [ ] **Step 9: Instalar dependências**

```bash
cd "C:\Users\leogi\Desktop\Pro-Edition"
npm install
```

- [ ] **Step 10: Commit**

```bash
cd "C:\Users\leogi\Desktop\Pro-Edition"
git add package.json tsconfig.json manifest.json scripts/ src/ui/index.html src/ui/assets.d.ts icons/ package-lock.json
git commit -m "chore: scaffold do repositorio Pro Edition"
```

(Ainda não roda `npm run verify` — falta `src/ui/main.ts`, que só existe a
partir do Task 6. `npm run check`/`build` vão falhar até lá; isso é
esperado, não é regressão.)

---

## Task 4: `shell.ts` — lógica pura de troca de tela (TDD)

**Files:**
- Create: `C:\Users\leogi\Desktop\Pro-Edition\src\shell.ts`
- Test: `C:\Users\leogi\Desktop\Pro-Edition\tests\shell.test.ts`

**Interfaces:**
- Produces: `type Ferramenta = "seletor" | "broll" | "captions"`, `interface Tela { html: string; css: string; montar: (root: HTMLElement) => void }`, `escolherTela(registro, ferramenta): Tela`, `extrairCorpo(htmlCompleto): string` — todos consumidos por `main.ts` no Task 6.

- [ ] **Step 1: Escrever o teste que falha**

Crie `tests/shell.test.ts`:

```ts
import assert from "node:assert/strict";
import { test } from "node:test";
import { escolherTela, extrairCorpo, type Tela } from "../src/shell.ts";

test("escolherTela devolve a tela certa do registro", () => {
  const semAcao = () => {};
  const registro = {
    seletor: { html: "<a>seletor</a>", css: "s", montar: semAcao } satisfies Tela,
    broll: { html: "<b>broll</b>", css: "b", montar: semAcao } satisfies Tela,
    captions: { html: "<c>captions</c>", css: "c", montar: semAcao } satisfies Tela,
  };

  assert.equal(escolherTela(registro, "seletor").html, "<a>seletor</a>");
  assert.equal(escolherTela(registro, "broll").html, "<b>broll</b>");
  assert.equal(escolherTela(registro, "captions").html, "<c>captions</c>");
});

test("extrairCorpo pega so o miolo entre <body> e a marca de script", () => {
  const doc =
    `<!DOCTYPE html><html><head><!--ESTILOS--></head>` +
    `<body class="x">  <div>ola</div>  <!--SCRIPT--></body></html>`;

  assert.equal(extrairCorpo(doc), "<div>ola</div>");
});

test("extrairCorpo lanca quando o HTML nao tem a marca esperada", () => {
  assert.throws(() => extrairCorpo("<html><body>sem marca</body></html>"));
});
```

- [ ] **Step 2: Rodar e confirmar que falha**

```bash
cd "C:\Users\leogi\Desktop\Pro-Edition"
npm test
```

Expected: FAIL — `src/shell.ts` não existe ainda (`Cannot find module`).

- [ ] **Step 3: Implementar `shell.ts`**

Crie `src/shell.ts`:

```ts
/*
 * Logica pura de troca de tela do shell — sem DOM, sem Premiere. O que toca
 * document.body mora em src/ui/main.ts (Task 6); aqui so o que da para
 * testar sem UXP.
 */

export type Ferramenta = "seletor" | "broll" | "captions";

export interface Tela {
  readonly html: string;
  readonly css: string;
  readonly montar: (root: HTMLElement) => void;
}

/** Dado o registro de telas e a ferramenta escolhida, qual tela mostrar. */
export function escolherTela(
  registro: Readonly<Record<Ferramenta, Tela>>,
  ferramenta: Ferramenta
): Tela {
  return registro[ferramenta];
}

/**
 * Extrai o miolo do <body> de um painel standalone (auto-broll-premiere ou
 * Pro-Captions) para injetar em document.body do shell — nunca o documento
 * inteiro, que tem DOCTYPE/head/tag <body> proprios.
 *
 * Corta ate a marca <!--SCRIPT-->: o que vem depois (o bundle JS do plugin
 * standalone) nao interessa aqui, quem roda a logica e o mount() importado
 * direto, nao o script embutido no HTML original.
 */
export function extrairCorpo(htmlCompleto: string): string {
  const m = /<body[^>]*>([\s\S]*?)<!--SCRIPT-->/.exec(htmlCompleto);
  if (!m) throw new Error("HTML sem <body>...<!--SCRIPT--> no formato esperado");
  return m[1]!.trim();
}
```

- [ ] **Step 4: Rodar e confirmar que passa**

```bash
cd "C:\Users\leogi\Desktop\Pro-Edition"
npm test
```

Expected: PASS — 3 testes verdes.

- [ ] **Step 5: Checar tipos**

```bash
cd "C:\Users\leogi\Desktop\Pro-Edition"
npm run check
```

Expected: sem erros.

- [ ] **Step 6: Commit**

```bash
cd "C:\Users\leogi\Desktop\Pro-Edition"
git add src/shell.ts tests/shell.test.ts
git commit -m "feat: logica pura de selecao de tela (escolherTela, extrairCorpo)"
```

---

## Task 5: Tela de seleção (dois cards)

**Files:**
- Create: `C:\Users\leogi\Desktop\Pro-Edition\src\ui\seletor.html`
- Create: `C:\Users\leogi\Desktop\Pro-Edition\src\ui\seletor.css`

**Interfaces:**
- Consumes: nenhuma (fragmento estático).
- Produces: markup com `#cardBroll` e `#cardCaptions` (botões) — o Task 6 liga os cliques a esses IDs.

- [ ] **Step 1: `src/ui/seletor.html`**

Fragmento puro — sem `<html>`/`<body>`, é injetado direto em
`document.body.innerHTML` pelo `main.ts` (Task 6). Reaproveita as classes
`.topo`/`.marca`/`.marca-nome`/`.acao` já usadas nos dois plugins (mesmo
esqueleto visual, decisão do spec):

```html
<header class="topo">
  <div class="marca">
    <span class="marca-nome">Pro Edition</span>
  </div>
</header>

<main class="conteudo">
  <div class="cards">
    <button id="cardBroll" class="card">
      <span class="card-nome">Auto B-roll</span>
      <span class="card-desc">Insere B-rolls automaticamente a partir da transcricao da sequencia.</span>
    </button>
    <button id="cardCaptions" class="card">
      <span class="card-nome">Pro Captions</span>
      <span class="card-desc">Gera legendas em .srt a partir da transcricao, com preco isolado.</span>
    </button>
  </div>
</main>
```

- [ ] **Step 2: `src/ui/seletor.css`**

Flexbox só (sem CSS Grid — armadilha documentada). Paleta emprestada do Auto
B-roll (`#101216`/`#1a1e25`), já que é o esqueleto visual de referência dos
dois plugins:

```css
html,
body {
  height: 100%;
}

body {
  display: flex;
  flex-direction: column;
  margin: 0;
  background-color: #101216;
  color: #e6e9ee;
  font-family: adobe-clean, "Source Sans 3", "Segoe UI", sans-serif;
  font-size: 13px;
  line-height: 1.45;
  text-align: left;
}

.topo {
  flex: none;
  padding: 9px 12px;
  background-color: #1a1e25;
  border-bottom: 1px solid #2e343d;
}

.marca-nome {
  font-size: 14px;
  font-weight: 700;
  color: #ffffff;
}

.conteudo {
  flex: 1 1 auto;
  padding: 16px 12px;
  overflow: auto;
}

.cards {
  display: flex;
  flex-direction: column;
}

.card {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  text-align: left;
  margin-bottom: 10px;
  padding: 12px;
  background-color: #171b21;
  border: 1px solid #2e343d;
  border-radius: 4px;
  color: inherit;
  cursor: pointer;
}

.card:hover {
  border-color: #4a5568;
}

.card-nome {
  font-size: 13px;
  font-weight: 700;
  color: #ffffff;
  margin-bottom: 4px;
}

.card-desc {
  font-size: 12px;
  color: #9aa4b2;
}

.pe-voltar {
  margin: 8px 12px 0;
  align-self: flex-start;
  background: none;
  border: none;
  color: #9aa4b2;
  font-size: 12px;
  cursor: pointer;
  padding: 4px 0;
}

.pe-voltar:hover {
  color: #ffffff;
}
```

(`.pe-voltar` estiliza o botão "← Voltar" que o `main.ts` injeta na frente
de cada tela de ferramenta — Task 6.)

- [ ] **Step 2: Commit**

```bash
cd "C:\Users\leogi\Desktop\Pro-Edition"
git add src/ui/seletor.html src/ui/seletor.css
git commit -m "feat: markup e estilo da tela de selecao"
```

---

## Task 6: `main.ts` — monta o registro e liga a troca de tela

**Files:**
- Create: `C:\Users\leogi\Desktop\Pro-Edition\src\ui\main.ts`

**Interfaces:**
- Consumes: `mount` de `auto-broll-premiere/src/ui/mount.ts` e `Pro-Captions/src/ui/mount.ts` (Tasks 1–2); `escolherTela`, `extrairCorpo`, `Ferramenta`, `Tela` de `../shell.ts` (Task 4); `seletor.html`/`seletor.css` (Task 5).
- Produces: painel funcional, ponto de entrada do bundle (`entryPoints` do build.mjs já aponta pra cá).

- [ ] **Step 1: Escrever `src/ui/main.ts`**

```ts
/*
 * Boot do shell. Monta o registro das tres telas e troca document.body
 * inteiro a cada selecao — nunca duas telas juntas no DOM (colisao real de
 * IDs e classes entre os dois plugins, documentada no spec).
 */

import { escolherTela, extrairCorpo, type Ferramenta, type Tela } from "../shell.ts";

import htmlBrollBruto from "../../../auto-broll-premiere/src/ui/index.html";
import cssBroll from "../../../auto-broll-premiere/src/ui/styles.css";
import { mount as mountBroll } from "../../../auto-broll-premiere/src/ui/mount.ts";

import htmlCaptionsBruto from "../../../Pro-Captions/src/ui/index.html";
import cssCaptions from "../../../Pro-Captions/src/ui/styles.css";
import { mount as mountCaptions } from "../../../Pro-Captions/src/ui/mount.ts";

import htmlSeletor from "./seletor.html";
import cssSeletor from "./seletor.css";

function montarSeletor(root: HTMLElement): void {
  root.querySelector<HTMLButtonElement>("#cardBroll")!.addEventListener("click", () => mostrar("broll"));
  root.querySelector<HTMLButtonElement>("#cardCaptions")!.addEventListener("click", () => mostrar("captions"));
}

const REGISTRO: Readonly<Record<Ferramenta, Tela>> = {
  seletor: { html: htmlSeletor, css: cssSeletor, montar: montarSeletor },
  broll: { html: extrairCorpo(htmlBrollBruto), css: cssBroll, montar: mountBroll },
  captions: { html: extrairCorpo(htmlCaptionsBruto), css: cssCaptions, montar: mountCaptions },
};

function mostrar(ferramenta: Ferramenta): void {
  const tela = escolherTela(REGISTRO, ferramenta);
  const botaoVoltar =
    ferramenta === "seletor" ? "" : `<button id="peVoltar" class="pe-voltar">&larr; Voltar</button>`;

  // Substitui o document.body inteiro: elimina o <style> anterior junto com
  // o HTML anterior, nunca acumula duas telas no mesmo documento.
  document.body.innerHTML = `${botaoVoltar}<style>\n${tela.css}\n</style>\n${tela.html}`;

  if (ferramenta !== "seletor") {
    document.getElementById("peVoltar")!.addEventListener("click", () => mostrar("seletor"));
  }

  tela.montar(document.body);
}

mostrar("seletor");
```

- [ ] **Step 2: Rodar a suíte completa**

```bash
cd "C:\Users\leogi\Desktop\Pro-Edition"
npm run verify
```

Expected: `check` sem erros (inclusive tipando os arquivos `mount.ts` dos
dois plugins irmãos, alcançados pelo grafo de imports), `test` com os 3
testes de `shell.test.ts` verdes, `build` gera `dist/index.html` com o
bundle inteiro embutido.

- [ ] **Step 3: Inspecionar o `dist/index.html` gerado**

Confira visualmente que o arquivo contém, dentro do `<script>`, os textos
`"Auto B-roll"` e `"Pro Captions"` (prova rápida de que os HTMLs dos dois
plugins foram embutidos):

```bash
cd "C:\Users\leogi\Desktop\Pro-Edition"
grep -o "Auto B-roll" dist/index.html | head -1
grep -o "Pro Captions" dist/index.html | head -1
```

Expected: os dois comandos imprimem uma ocorrência cada.

- [ ] **Step 4: Commit**

```bash
cd "C:\Users\leogi\Desktop\Pro-Edition"
git add src/ui/main.ts
git commit -m "feat: monta o painel unico do Pro Edition com troca de tela"
```

---

## Task 7: Guia de uso — passo manual de `PluginData`

**Files:**
- Create: `C:\Users\leogi\Desktop\Pro-Edition\docs\GUIA-DE-USO.md`

**Interfaces:** nenhuma — documentação pura.

- [ ] **Step 1: Escrever o guia**

Crie `docs/GUIA-DE-USO.md`:

```markdown
# Pro Edition — guia de uso

## Antes do primeiro uso: copiar o aprendizado existente

O Pro Edition roda o código do Auto B-roll e do Pro Captions dentro do seu
próprio plugin (`com.leogi.proedition`). Por uma limitação do UXP, o
aprendizado e os dados salvos por cada plugin ficam numa pasta ligada à
identidade do plugin em execução — então, sem este passo, o Auto B-roll
dentro do Pro Edition começaria com aprendizado zerado, mesmo que o plugin
standalone já tenha semanas de uso.

Faça isto **uma vez**, antes de usar o Pro Edition pela primeira vez:

1. Feche o Premiere.
2. Abra o Explorer em:
   `%APPDATA%\Adobe\UXP\PluginsStorage\PPRO\<versão>\External\`
   (troque `<versão>` por `25` ou `26`, conforme a versão do Premiere que
   você usa — se usa as duas, repita o passo nas duas pastas de versão).
3. Copie o **conteúdo** da pasta `com.leogi.autobroll\PluginData\` para
   dentro de `com.leogi.proedition\PluginData\` (crie a pasta se não
   existir).
4. Se você também usa o Pro Captions e quer o mesmo aprendizado/backups
   dentro do Pro Edition, repita o passo 3 com
   `com.leogi.procaptions\PluginData\`.

Depois desta cópia, os dois pares (plugin standalone / Pro Edition) passam a
acumular aprendizado **separado** a partir daí — abrir pelo plugin original
ou pelo shell não mantém os dois sincronizados automaticamente depois do
passo inicial. Isso é esperado.

## Uso

Abra `Window > Extensions > Pro Edition` no Premiere. A tela inicial mostra
dois cards — escolha a ferramenta. Um botão "← Voltar" no topo volta para a
tela de seleção a qualquer momento, sem perder nada (nenhuma das duas
ferramentas guarda estado não salvo em memória entre uma ação e outra).

Cada ferramenta funciona exatamente como no plugin standalone — mesmos
botões, mesmo comportamento. Consulte o guia de cada uma para o dia a dia:

- Auto B-roll: `auto-broll-premiere/docs/GUIA-DE-USO.md`
- Pro Captions: `Pro-Captions/RETOMAR-pro-captions.md`
```

- [ ] **Step 2: Commit**

```bash
cd "C:\Users\leogi\Desktop\Pro-Edition"
git add docs/GUIA-DE-USO.md
git commit -m "docs: guia de uso e passo manual de copia de PluginData"
```

---

## Task 8: Instalação e teste ao vivo no Premiere (obrigatório)

Sem hot reload — cada mudança de código já foi testada por `npm run verify`
nas tasks anteriores. Esta task é a validação final, que só o usuário pode
rodar (exige o Premiere real aberto).

**Files:** nenhum arquivo novo — só instalação e verificação manual.

- [ ] **Step 1: Instalar por symlink (como administrador)**

```powershell
powershell -ExecutionPolicy Bypass -File "C:\Users\leogi\Desktop\Pro-Edition\scripts\install-link.ps1"
```

Expected: `instalado: ...\com.leogi.proedition -> C:\Users\leogi\Desktop\Pro-Edition`.

- [ ] **Step 2: Copiar o `PluginData`, se ainda não fez**

Siga `docs/GUIA-DE-USO.md` (Task 7) antes de continuar, se quiser que o
Auto B-roll dentro do Pro Edition já comece com o aprendizado atual.

- [ ] **Step 3: Abrir o Premiere e o painel**

Reinicie o Premiere. Abra `Window > Extensions > Pro Edition`.

Checklist:
- [ ] A tela inicial mostra os dois cards ("Auto B-roll" e "Pro Captions"), sem sobra visual de nenhuma das duas folhas de estilo dos plugins (só o CSS do seletor).
- [ ] Clicar em "Auto B-roll" troca a tela inteira para o painel do Auto B-roll — mesmos campos, mesmo layout do plugin standalone.
- [ ] No Auto B-roll montado pelo shell: rodar "Analisar e inserir" (ou "Aprender") funciona igual ao plugin standalone — sequência é lida, log aparece, botão de "← Voltar" continua visível no topo.
- [ ] "← Voltar" retorna à tela de seleção sem erro no console.
- [ ] Clicar em "Pro Captions" troca a tela inteira para o painel do Pro Captions — mesmos campos do plugin standalone, nenhum resíduo de IDs/CSS do Auto B-roll.
- [ ] No Pro Captions montado pelo shell: rodar "Gerar legendas" funciona igual ao plugin standalone.
- [ ] "← Voltar" a partir do Pro Captions também retorna à seleção.
- [ ] Alternar Auto B-roll → seletor → Pro Captions → seletor → Auto B-roll algumas vezes seguidas não deixa o painel num estado quebrado (sem log duplicado, sem botão morto).

Se algum item falhar, o log de cada ferramenta continua sendo gravado em
arquivo (mesmo caminho de sempre, dentro da `PluginData` do
`com.leogi.proedition` agora) — ler esse log é mais confiável que print de
tela.

- [ ] **Step 4: Nada para commitar nesta task** — é validação, não código. Se o checklist revelar um bug, ele vira uma correção pontual nos arquivos das tasks anteriores, com seu próprio commit.
