# Pro Captions — Plano de Implementação (Fases 0 a 2)

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Provar que o Premiere aceita nossos blocos de legenda e entregar o núcleo de texto (preços, coloquial, gramática, termos protegidos, segmentação) testado fora do Premiere.

**Architecture:** Um painel UXP fino faz o I/O com o Premiere; toda a regra vive num núcleo puro que roda em `node --test` sem abrir o aplicativo. A Fase 0 é um portão bloqueante: se o Premiere re-segmentar nossos blocos, o desenho da entrega volta à mesa antes de qualquer regra de negócio ser escrita.

**Tech Stack:** TypeScript 5.7 (sem emit, tipos apenas), Node 24 rodando `.ts` nativo, `node:test`, esbuild, UXP para Premiere Pro 26.3.2.

## Global Constraints

- **Premiere alvo: 26.3.2 (Windows x64).** `manifest.json` declara `minVersion: "26.2.0"`.
- **Idioma do produto: PT-BR.** Código, comentários, commits, UI e nomes de função em português.
- **Zero dependência nova de runtime.** Só `devDependencies`: `@adobe/premierepro`, `@types/node`, `esbuild`, `typescript`. O plugin não pede permissão de rede.
- **Não existe hot reload.** Toda alteração de código exige reiniciar o Premiere.
- **CSS Grid não funciona no UXP.** Layout inteiro em flexbox, com `flex-wrap` e `flex: 1 1 <base>`. Nada de `display: grid`, `repeat(auto-fit, minmax())` ou media query.
- **Nunca `<link rel="stylesheet">` nem `<script src>`.** O UXP resolve caminho a partir da raiz do plugin, não da pasta do HTML, e falha em silêncio. O build embute CSS e JS no HTML.
- **Toda chamada ao Premiere passa por `comLimite()`.** Há APIs que penduram para sempre sem rejeitar.
- **Toda Action nasce dentro de `project.lockedAccess()`**, que é síncrono, e erro lançado lá dentro não propaga — capturar em variável e relançar depois.
- **Tempo em segundos (float), não em milissegundos.** A §14 da spec funcional usa `startMs`/`endMs`; este plano usa segundos para não converter ida e volta contra `transcript.ts` e `domain.ts`, que já trabalham em segundos e já estão testados.
- **Gate de cada tarefa:** `npm run verify` (tipos + testes + build) tem de passar antes do commit.
- **`tsconfig.json` roda em `strict` com `noUncheckedIndexedAccess`.** Todo acesso indexado devolve `T | undefined`; usar `!` só quando o índice acabou de ser validado, e `?? padrão` no resto.

---

## Estrutura de arquivos

| Arquivo | Responsabilidade | Tarefa |
|---|---|---|
| `manifest.json`, `package.json`, `tsconfig.json` | Identidade e gate do projeto | 1 |
| `scripts/build.mjs` | Embute CSS e JS no HTML | 1 |
| `scripts/install-link.ps1` | Symlink na pasta que o Premiere varre | 1 |
| `src/ui/index.html`, `styles.css`, `main.ts` | Painel | 1, 3, 4 |
| `src/domain.ts` | `TimelineClip`, `sourceToSequence` | 2 |
| `src/transcript.ts` | Parse do JSON do Premiere e remontagem da fala | 2 |
| `src/premiere.ts` | Única porta para a API do Premiere | 3, 4 |
| `src/preco.ts` | Numeral por extenso, contexto monetário, formatação BRL | 5, 6 |
| `src/texto.ts` | Coloquial, é/e, porquês, termos protegidos | 7, 8, 9 |
| `src/segmentar.ts` | Blocos de uma linha, preço isolado, vírgula, corte | 10, 11, 12, 13 |
| `src/preset.ts` | Config central | 5 |

Regra de decomposição: `texto.ts` reúne quatro regras que a §28 da spec separa em quatro arquivos, porque todas percorrem o mesmo array de palavras corrigindo grafia — separá-las produziria quatro assinaturas idênticas e uma cadeia de imports sem ganho. Pontuação não tem módulo: vírgula pendurada é decisão de fronteira de bloco e mora em `segmentar.ts`.

---

## Task 1: Esqueleto do plugin que carrega no Premiere

**Files:**
- Create: `manifest.json`, `package.json`, `tsconfig.json`, `.gitignore`
- Create: `scripts/build.mjs`, `scripts/install-link.ps1`
- Create: `src/ui/index.html`, `src/ui/styles.css`, `src/ui/main.ts`
- Create: `icons/icon.png`, `icons/icon@2x.png`

**Interfaces:**
- Consumes: nada.
- Produces: `npm run build` gera `dist/index.html` auto-contido; `npm run verify` = `check` + `test` + `build`.

- [ ] **Step 1: Criar `package.json`**

```json
{
  "name": "pro-captions",
  "version": "0.1.0",
  "private": true,
  "type": "module",
  "description": "Plugin UXP para Adobe Premiere Pro que gera legendas em uma linha seguindo um padrao editorial fixo. 100% local.",
  "scripts": {
    "build": "node scripts/build.mjs",
    "watch": "node scripts/build.mjs --watch",
    "check": "tsc --noEmit",
    "test": "node --test \"tests/*.test.ts\"",
    "verify": "npm run check && npm test && npm run build"
  },
  "devDependencies": {
    "@adobe/premierepro": "26.3.0",
    "@types/node": "^24.13.3",
    "esbuild": "^0.25.0",
    "typescript": "^5.7.0"
  }
}
```

- [ ] **Step 2: Criar `tsconfig.json`**

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

- [ ] **Step 3: Criar `.gitignore`**

```
node_modules/
dist/
```

- [ ] **Step 4: Criar `manifest.json`**

O bloco `icons` não pode ficar vazio: com `scale: [1, 2]` o Premiere procura `icon.png` e `icon@2x.png`, e sem eles o plugin não carrega.

```json
{
  "manifestVersion": 5,
  "id": "com.leogi.procaptions",
  "name": "Pro Captions",
  "version": "0.1.0",
  "main": "dist/index.html",
  "host": {
    "app": "premierepro",
    "minVersion": "26.2.0"
  },
  "entrypoints": [
    {
      "type": "panel",
      "id": "leoCaptionsPanel",
      "label": { "default": "Pro Captions" },
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

- [ ] **Step 5: Copiar os ícones**

```bash
mkdir -p icons
cp ../auto-broll-premiere/icons/icon.png icons/icon.png
cp ../auto-broll-premiere/icons/icon@2x.png icons/icon@2x.png
ls -la icons/
```

Se os arquivos não existirem com esses nomes, listar `../auto-broll-premiere/icons/` e copiar os dois PNG que houver, renomeando para `icon.png` e `icon@2x.png`.

- [ ] **Step 6: Criar `scripts/build.mjs`**

```js
/*
 * Build do painel. esbuild empacota src/ui/main.ts em dist/main.js, e o HTML
 * final leva CSS e JS embutidos.
 *
 * `premierepro` e `uxp` ficam fora do bundle de proposito: o host injeta os
 * dois em tempo de execucao e o codigo os pega por `require()` direto, que o
 * esbuild nao toca no formato iife.
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
  sourcemap: observar ? "inline" : false,
  minify: !observar,
  logLevel: "info",
});

/*
 * CSS e JS vao EMBUTIDOS no HTML.
 *
 * O UXP resolve `href`/`src` relativos a partir da raiz do plugin, nao da pasta
 * do HTML. Como o `main` do manifest e `dist/index.html`, uma referencia a
 * "main.js" e procurada em `raiz/main.js`, que nao existe — e falha em
 * silencio, sem erro no log do Premiere.
 */
const css = await readFile(join(raiz, "src", "ui", "styles.css"), "utf8");
const js = await readFile(join(dist, "main.js"), "utf8");
const html = await readFile(join(raiz, "src", "ui", "index.html"), "utf8");

const injetar = (texto, marca, conteudo) => {
  if (!texto.includes(marca)) throw new Error(`index.html perdeu a marca ${marca}`);
  return texto.replace(marca, conteudo);
};

let saida = injetar(html, "<!--ESTILOS-->", `<style>\n${css}\n</style>`);
// Fechar a tag dentro de uma string do bundle encerraria o <script> antes da hora.
saida = injetar(saida, "<!--SCRIPT-->", `<script>\n${js.replace(/<\/script/gi, "<\\/script")}\n</script>`);

await writeFile(join(dist, "index.html"), saida, "utf8");

console.log(`painel construido em ${dist}`);
```

- [ ] **Step 7: Criar `scripts/install-link.ps1`**

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
$link = Join-Path $ext 'com.leogi.procaptions'

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

- [ ] **Step 8: Criar `src/ui/index.html`**

```html
<!DOCTYPE html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <title>Pro Captions</title>
    <!-- O build substitui esta marca pelo conteudo de styles.css.
         <link rel="stylesheet"> nao carrega no UXP. -->
    <!--ESTILOS-->
  </head>
  <body>
    <header class="topo">
      <div class="marca">
        <span class="marca-nome">Pro Captions</span>
        <span class="marca-fase">Fase 0</span>
      </div>
      <div id="estado" class="estado">carregando</div>
    </header>

    <main class="conteudo">
      <section class="faixa">
        <div class="canaleta"><span class="cod">SEQ</span></div>
        <div class="corpo">
          <div id="seqNome" class="seq-nome" data-vazio="sim">nenhuma sequencia ativa</div>
        </div>
      </section>

      <section class="faixa faixa-log">
        <div class="canaleta"><span class="cod">LOG</span></div>
        <div class="corpo">
          <div id="log" class="log"></div>
        </div>
      </section>
    </main>

    <!-- O build substitui esta marca pelo bundle inteiro.
         Caminho relativo nao resolve no UXP. -->
    <!--SCRIPT-->
  </body>
</html>
```

- [ ] **Step 9: Criar `src/ui/styles.css`**

```css
/*
 * Flexbox em tudo. `display: grid` e ignorado pelo UXP, e `gap` e `var()`
 * nao sao confiaveis — margens e valores literais.
 *
 * Num flex column os filhos NAO esticam: encolhem ate o conteudo e ficam no
 * meio. `align-items: stretch` explicito e o que resolve; `text-align: left`
 * sozinho nao basta.
 */

body {
  margin: 0;
  padding: 0;
  background: #1d1d1d;
  color: #e8e8e8;
  font-family: "Adobe Clean", "Segoe UI", sans-serif;
  font-size: 12px;
}

.topo {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  padding: 10px 12px;
  border-bottom: 1px solid #2f2f2f;
}

.marca { display: flex; flex-direction: row; align-items: baseline; }
.marca-nome { font-size: 13px; font-weight: 700; letter-spacing: 0.02em; }
.marca-fase { margin-left: 8px; font-size: 10px; color: #8a8a8a; }

.estado {
  font-size: 10px;
  color: #9a9a9a;
  padding: 2px 8px;
  border: 1px solid #3a3a3a;
  border-radius: 9px;
}

.conteudo {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  padding: 10px;
}

.faixa {
  display: flex;
  flex-direction: row;
  align-items: stretch;
  margin-bottom: 8px;
  background: #242424;
  border: 1px solid #303030;
  border-radius: 4px;
}

.canaleta {
  display: flex;
  align-items: center;
  justify-content: center;
  width: 40px;
  min-width: 40px;
  background: #1f1f1f;
  border-right: 1px solid #303030;
}

.cod { font-size: 10px; font-weight: 700; color: #7a7a7a; letter-spacing: 0.06em; }

.corpo {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  flex: 1 1 auto;
  padding: 8px 10px;
  min-width: 0;
}

.seq-nome { font-size: 12px; font-weight: 600; overflow: hidden; text-overflow: ellipsis; }
.seq-nome[data-vazio="sim"] { color: #6f6f6f; font-weight: 400; font-style: italic; }

.log {
  font-family: "Source Code Pro", Consolas, monospace;
  font-size: 10px;
  line-height: 1.5;
  color: #b4b4b4;
  white-space: pre-wrap;
  word-break: break-word;
}
```

- [ ] **Step 10: Criar `src/ui/main.ts`**

Os `addEventListener` (aqui ainda não há nenhum) e a escrita do estado inicial vêm ANTES de qualquer `await`. Se o I/O pendurar antes disso, o painel abre bonito e completamente morto.

```ts
/*
 * Painel. Nao chama `premierepro` direto: fala com src/premiere.ts.
 * Nesta tarefa ainda nao ha leitura — so a prova de que o painel carrega e o
 * script roda.
 */

declare function require(id: string): unknown;

const elemento = (id: string): HTMLElement => {
  const el = document.getElementById(id);
  if (!el) throw new Error(`elemento ausente no HTML: ${id}`);
  return el;
};

const linhas: string[] = [];

function registrar(texto: string): void {
  linhas.push(texto);
  elemento("log").textContent = linhas.join("\n");
}

function estado(texto: string): void {
  elemento("estado").textContent = texto;
}

// Antes de qualquer await: se o painel travar depois, isto ja apareceu.
estado("pronto");
registrar("painel carregado");

try {
  const ppro = require("premierepro") as Record<string, unknown>;
  registrar(`modulo premierepro: ${Object.keys(ppro).length} classes expostas`);
} catch (e) {
  registrar(`falha ao carregar premierepro: ${(e as Error).message}`);
  estado("erro");
}
```

- [ ] **Step 11: Instalar dependências e rodar o gate**

```bash
npm install
npm run verify
```

Esperado: `tsc` sem erro; `node --test` reporta 0 testes (ainda não há `tests/`) e sai com sucesso; build imprime `painel construido em .../dist`.

Se `node --test "tests/*.test.ts"` falhar por não encontrar a pasta, criar `tests/.gitkeep` e rodar de novo.

- [ ] **Step 12: Verificar que `dist/index.html` é auto-contido**

```bash
grep -c "<script src" dist/index.html
grep -c "rel=\"stylesheet\"" dist/index.html
```

Esperado: `0` nas duas. Qualquer valor diferente de zero significa painel morto no Premiere.

- [ ] **Step 13: Instalar no Premiere e conferir na tela**

```bash
powershell -ExecutionPolicy Bypass -File scripts/install-link.ps1
```

Rodar como administrador. Depois: reiniciar o Premiere, abrir `Janela > UXP Plugins > Pro Captions`.

Esperado no painel: distintivo `pronto`, e no log `painel carregado` seguido de `modulo premierepro: N classes expostas`.

**Diagnóstico:** se o log continuar mostrando o texto que está escrito no HTML, o script não rodou — conferir o Step 12.

- [ ] **Step 14: Commit**

```bash
git add -A
git commit -m "feat: esqueleto do plugin UXP que carrega no Premiere"
```

---

## Task 2: Núcleo de leitura da transcrição

Copia de `auto-broll-premiere` os dois módulos já provados contra a API real, com os testes junto. Não reescrever: este código já passou pela Fase 0 de outro projeto.

**Files:**
- Create: `src/domain.ts`
- Create: `src/transcript.ts`
- Create: `tests/transcript.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces:
  - `TimelineClip { startSeconds, endSeconds, inPointSeconds, outPointSeconds, speed }`
  - `sourceToSequence(clip: TimelineClip, sourceSeconds: number): number | null`
  - `parseTranscricao(json: string): TranscricaoOrigem | null`
  - `ClipeComOrigem extends TimelineClip { sourceName: string }`
  - `PalavraEditada { text: string; inicio: number; fim: number; confidence: number; eos: boolean; sourceName: string }`
  - `reconstruirTranscricao(clipes: readonly ClipeComOrigem[], transcricoes: ReadonlyMap<string, TranscricaoOrigem>): PalavraEditada[]`

- [ ] **Step 1: Criar `src/domain.ts`**

Só o que este produto usa. `fillScalePercent`, `ehVideo` e `parseConfig` do auto-broll ficam de fora — são de B-roll.

```ts
/*
 * Regras puras. Nao conhecem o Premiere, nao fazem I/O, nao tocam no DOM.
 */

/** Um clipe como ele existe na timeline, ja recortado pelo editor. */
export interface TimelineClip {
  /** Onde o clipe comeca na sequencia, em segundos. */
  readonly startSeconds: number;
  /** Onde o clipe termina na sequencia, em segundos. */
  readonly endSeconds: number;
  /** Instante da MIDIA DE ORIGEM que aparece em startSeconds. */
  readonly inPointSeconds: number;
  /** Instante da MIDIA DE ORIGEM que aparece em endSeconds. */
  readonly outPointSeconds: number;
  /** 1 = velocidade normal. */
  readonly speed: number;
}

/**
 * Converte um instante da midia de origem para o tempo da sequencia.
 *
 * Provado no auto-broll (API_PROOFS P2.1): `inPoint`/`outPoint` sao tempos da
 * ORIGEM e `start`/`end` sao tempos da SEQUENCIA — a documentacao da Adobe
 * descreve `getInPoint()` como "relative to the start time", o que e falso.
 *
 * Retorna `null` quando o instante ficou fora do corte, que e o caso comum: a
 * maior parte da fala gravada nao sobrevive a edicao.
 */
export function sourceToSequence(clip: TimelineClip, sourceSeconds: number): number | null {
  if (sourceSeconds < clip.inPointSeconds) return null;
  if (sourceSeconds >= clip.outPointSeconds) return null;
  return clip.startSeconds + (sourceSeconds - clip.inPointSeconds) / clip.speed;
}

/** mm:ss — para apontar um instante numa lista, nao para calcular com ele. */
export function relogio(segundos: number): string {
  const total = Math.max(0, Math.round(segundos));
  const pad = (n: number): string => String(n).padStart(2, "0");
  return `${pad(Math.floor(total / 60))}:${pad(total % 60)}`;
}
```

- [ ] **Step 2: Copiar `src/transcript.ts`**

```bash
cp ../auto-broll-premiere/src/transcript.ts src/transcript.ts
```

- [ ] **Step 3: Remover do arquivo copiado o que é de B-roll**

`transcript.ts` importa `termos` de `./match.ts`, que não existe neste projeto. Editar o arquivo copiado:

1. apagar a linha `import { termos } from "./match.ts";`
2. apagar a interface `TermoNoTempo` inteira
3. na interface `Frase`, apagar o campo `termosNoTempo` e o bloco de comentário acima dele
4. dentro de `agruparEmFrases`, apagar estas quatro linhas:

```ts
    const termosNoTempo: TermoNoTempo[] = [];
    for (const p of atual) {
      for (const termo of termos(p.text)) termosNoTempo.push({ termo, inicio: p.inicio });
    }
```

5. no objeto passado a `frases.push({...})`, apagar a linha `termosNoTempo,`

O import de `./domain.ts` (`sourceToSequence`, `TimelineClip`) continua válido.

- [ ] **Step 4: Escrever o teste**

Crie `tests/transcript.test.ts`. A fixture é recorte real do `exportToJSON` lido no auto-broll.

```ts
import { test } from "node:test";
import assert from "node:assert/strict";

import {
  agruparEmFrases,
  parseTranscricao,
  reconstruirTranscricao,
  type ClipeComOrigem,
  type TranscricaoOrigem,
} from "../src/transcript.ts";

/** Recorte real do exportToJSON, formato lido no Premiere 26.3.2. */
const JSON_REAL = JSON.stringify({
  language: "pt-pt",
  segments: [
    {
      duration: 30.1,
      language: "pt-pt",
      speaker: "0d6458bc",
      start: 0.84,
      words: [
        { confidence: 1, duration: 0.78, eos: false, start: 0.84, tags: [], text: "Meu", type: "word" },
        { confidence: 1, duration: 0.4, eos: false, start: 1.62, tags: [], text: "nome", type: "word" },
        { confidence: 0.6, duration: 0.2, eos: false, start: 2.02, tags: [], text: "e", type: "word" },
        { confidence: 0.4, duration: 0.9, eos: true, start: 2.22, tags: [], text: "Cristiano.", type: "word" },
        { confidence: 1, duration: 0.5, eos: true, start: 9.0, tags: [], text: "Depois.", type: "word" },
      ],
    },
  ],
});

const CLIPE: ClipeComOrigem = {
  sourceName: "IMG_1190.MOV",
  startSeconds: 0,
  endSeconds: 3.5,
  inPointSeconds: 0.84,
  outPointSeconds: 4.34,
  speed: 1,
};

test("parseTranscricao le o formato real do Premiere", () => {
  const t = parseTranscricao(JSON_REAL);
  assert.ok(t);
  assert.equal(t.segments.length, 1);
  assert.equal(t.segments[0]?.words.length, 5);
  assert.equal(t.segments[0]?.words[0]?.text, "Meu");
  assert.equal(t.segments[0]?.words[3]?.eos, true);
});

test("parseTranscricao devolve null em JSON invalido", () => {
  assert.equal(parseTranscricao("{nao e json"), null);
  assert.equal(parseTranscricao("[]"), null);
});

test("parseTranscricao descarta palavra sem campo obrigatorio sem derrubar o resto", () => {
  const sujo = JSON.stringify({
    language: "pt-pt",
    segments: [{ start: 0, duration: 1, speaker: "x", words: [{ text: "ok", start: 0 }, { start: 1 }] }],
  });
  const t = parseTranscricao(sujo);
  assert.equal(t?.segments[0]?.words.length, 1);
});

test("reconstruirTranscricao mantem so o que sobreviveu ao corte", () => {
  const t = parseTranscricao(JSON_REAL);
  assert.ok(t);
  const mapa = new Map<string, TranscricaoOrigem>([["IMG_1190.MOV", t]]);
  const palavras = reconstruirTranscricao([CLIPE], mapa);

  // "Depois." comeca em 9.0s na origem, fora do outPoint de 4.34s.
  assert.deepEqual(palavras.map((p) => p.text), ["Meu", "nome", "e", "Cristiano."]);
  // A primeira palavra cai exatamente no inicio do clipe na sequencia.
  assert.equal(palavras[0]?.inicio, 0);
});

test("agruparEmFrases usa o eos que o Premiere ja entrega", () => {
  const t = parseTranscricao(JSON_REAL);
  assert.ok(t);
  const mapa = new Map<string, TranscricaoOrigem>([["IMG_1190.MOV", t]]);
  const frases = agruparEmFrases(reconstruirTranscricao([CLIPE], mapa));

  assert.equal(frases.length, 1);
  assert.equal(frases[0]?.texto, "Meu nome e Cristiano.");
  assert.equal(frases[0]?.confiancaMinima, 0.4);
});
```

- [ ] **Step 5: Rodar o teste**

```bash
npm test
```

Esperado: 5 testes passando. Se `agruparEmFrases` reclamar de `termosNoTempo`, o Step 3 ficou incompleto.

- [ ] **Step 6: Rodar o gate**

```bash
npm run verify
```

Esperado: tipos limpos, 5 testes passando, build ok.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: leitura e remontagem da transcricao do corte final"
```

---

## Task 3: Ler a sequência real e remontar a fala

**Files:**
- Create: `src/premiere.ts`
- Modify: `src/ui/main.ts` (substituir o conteúdo inteiro)

**Interfaces:**
- Consumes: `TimelineClip`, `sourceToSequence` (Task 2); `parseTranscricao`, `reconstruirTranscricao`, `ClipeComOrigem`, `PalavraEditada`, `TranscricaoOrigem` (Task 2).
- Produces:
  - `comLimite<T>(rotulo: string, tarefa: Promise<T>, ms?: number): Promise<T>`
  - `getSequenceInfo(): Promise<SequenceInfo>` com `SequenceInfo { name, fps, videoTracks, captionTracks }`
  - `lerClipes(videoTrackIndex?: number): Promise<ClipeComOrigem[]>`
  - `lerTranscricoes(nomes: readonly string[]): Promise<Map<string, string>>`
  - `lerCortes(videoTrackIndex?: number): Promise<number[]>`

- [ ] **Step 1: Criar `src/premiere.ts`**

```ts
/*
 * Unica porta de entrada para a API do Premiere. A UI nunca chama `ppro`
 * direto: ela fala com estas funcoes, que devolvem tipos do dominio.
 *
 * Tudo aqui vem de prova executada no auto-broll. Ver docs/API_PROOFS.md.
 */

import type { ClipeComOrigem } from "./transcript.ts";

declare function require(id: string): unknown;

// Fronteira nao tipada: o modulo do host chega sem tipos. Ele e restringido
// aqui, uma vez, e o resto do arquivo trabalha com as interfaces abaixo.
/* eslint-disable @typescript-eslint/no-explicit-any */
const ppro = require("premierepro") as any;
/* eslint-enable @typescript-eslint/no-explicit-any */

export interface SequenceInfo {
  readonly name: string;
  readonly fps: number;
  readonly videoTracks: number;
  readonly captionTracks: number;
}

interface Handles {
  readonly project: unknown;
  readonly sequence: unknown;
  readonly rootItem: unknown;
}

/**
 * Varias chamadas do UXP nunca resolvem nem rejeitam. Sem isto o painel fica
 * preso em "carregando" para sempre, sem erro e sem log, e o diagnostico vira
 * adivinhacao.
 */
export async function comLimite<T>(rotulo: string, tarefa: Promise<T>, ms = 15000): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      tarefa,
      new Promise<never>((_, rejeitar) => {
        timer = setTimeout(() => rejeitar(new Error(`${rotulo}: sem resposta em ${ms / 1000}s`)), ms);
      }),
    ]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

/** Nada e reaproveitado entre etapas: uma escrita invalida handles anteriores. */
async function handles(): Promise<Handles> {
  const project = await ppro.Project.getActiveProject();
  if (!project) throw new Error("Nenhum projeto aberto.");
  const sequence = await project.getActiveSequence();
  if (!sequence) throw new Error("Nenhuma sequencia ativa. Abra uma sequencia na timeline.");
  return { project, sequence, rootItem: await project.getRootItem() };
}

const CLIP = 1; // ppro.Constants.TrackItemType.CLIP, fixado na prova P0.3

export async function getSequenceInfo(): Promise<SequenceInfo> {
  const { sequence } = await handles();
  const seq = sequence as {
    name: string;
    getSettings: () => Promise<{ getVideoFrameRate: () => Promise<{ value: number }> }>;
    getVideoTrackCount: () => Promise<number>;
    getCaptionTrackCount: () => Promise<number>;
  };
  // getFrameSize() devolve {} e e inutil (P1.4); o frame rate vem de getSettings.
  const taxa = await (await seq.getSettings()).getVideoFrameRate();
  return {
    name: seq.name,
    fps: taxa.value,
    videoTracks: await seq.getVideoTrackCount(),
    captionTracks: await seq.getCaptionTrackCount(),
  };
}

/**
 * Clipes de uma faixa de video, com o nome da midia de origem.
 * V1 (indice 0) e a camera principal: e dela que sai a transcricao.
 */
export async function lerClipes(videoTrackIndex = 0): Promise<ClipeComOrigem[]> {
  const { sequence } = await handles();
  const seq = sequence as {
    getVideoTrack: (i: number) => Promise<{
      getTrackItems: (t: number, empty: boolean) => Promise<
        Array<{
          getStartTime: () => Promise<{ seconds: number }>;
          getEndTime: () => Promise<{ seconds: number }>;
          getInPoint: () => Promise<{ seconds: number }>;
          getOutPoint: () => Promise<{ seconds: number }>;
          getSpeed: () => Promise<number>;
          getProjectItem: () => Promise<{ name: string } | null>;
        }>
      >;
    }>;
  };

  const faixa = await seq.getVideoTrack(videoTrackIndex);
  const saida: ClipeComOrigem[] = [];
  for (const it of await faixa.getTrackItems(CLIP, false)) {
    const origem = await it.getProjectItem();
    if (!origem?.name) continue;
    const velocidade = await it.getSpeed();
    saida.push({
      sourceName: origem.name,
      startSeconds: (await it.getStartTime()).seconds,
      endSeconds: (await it.getEndTime()).seconds,
      inPointSeconds: (await it.getInPoint()).seconds,
      outPointSeconds: (await it.getOutPoint()).seconds,
      // Velocidade 0 tornaria o remapeamento uma divisao por zero.
      speed: velocidade > 0 ? velocidade : 1,
    });
  }
  return saida;
}

/** Instantes de corte da faixa, em segundos de sequencia. */
export async function lerCortes(videoTrackIndex = 0): Promise<number[]> {
  const clipes = await lerClipes(videoTrackIndex);
  // O inicio do primeiro clipe nao e corte: nao ha troca de imagem ali.
  return clipes.slice(1).map((c) => c.startSeconds);
}

/** Transcricao bruta de cada midia que tiver uma. Chave: nome do ProjectItem. */
export async function lerTranscricoes(nomes: readonly string[]): Promise<Map<string, string>> {
  const { rootItem } = await handles();
  const raiz = rootItem as { getItems: () => Promise<Array<{ name: string }>> };
  const itens = await raiz.getItems();
  const saida = new Map<string, string>();

  for (const nome of new Set(nomes)) {
    const item = itens.find((i) => i.name === nome);
    if (!item) continue;
    try {
      const clip = ppro.ClipProjectItem.cast(item) ?? item;
      if (!(await ppro.Transcript.hasTranscript(clip))) continue;
      saida.set(nome, (await ppro.Transcript.exportToJSON(clip)) as string);
    } catch {
      // Midia sem transcricao ou offline: seguir sem ela.
    }
  }
  return saida;
}
```

- [ ] **Step 2: Substituir `src/ui/main.ts` inteiro**

```ts
/*
 * Painel. Nao chama `premierepro` direto: fala com src/premiere.ts.
 */

import { relogio } from "../domain.ts";
import { comLimite, getSequenceInfo, lerClipes, lerCortes, lerTranscricoes } from "../premiere.ts";
import { parseTranscricao, reconstruirTranscricao, agruparEmFrases, type TranscricaoOrigem } from "../transcript.ts";

const elemento = (id: string): HTMLElement => {
  const el = document.getElementById(id);
  if (!el) throw new Error(`elemento ausente no HTML: ${id}`);
  return el;
};

const linhas: string[] = [];

function registrar(texto: string): void {
  linhas.push(texto);
  elemento("log").textContent = linhas.join("\n");
}

function estado(texto: string): void {
  elemento("estado").textContent = texto;
}

async function analisar(): Promise<void> {
  estado("lendo sequencia");
  const info = await comLimite("sequencia", getSequenceInfo());
  const nome = elemento("seqNome");
  nome.textContent = info.name;
  nome.setAttribute("data-vazio", "nao");
  registrar(`${info.fps.toFixed(4)} fps · ${info.videoTracks} video · ${info.captionTracks} caption`);

  const clipes = await comLimite("clipes", lerClipes(0));
  registrar(`V1: ${clipes.length} clipes`);

  const cortes = await comLimite("cortes", lerCortes(0));
  registrar(`${cortes.length} cortes`);

  estado("lendo transcricao");
  const brutas = await comLimite("transcricoes", lerTranscricoes(clipes.map((c) => c.sourceName)), 60000);
  registrar(`${brutas.size} midias com transcricao`);

  const mapa = new Map<string, TranscricaoOrigem>();
  for (const [nome2, json] of brutas) {
    const t = parseTranscricao(json);
    if (t) mapa.set(nome2, t);
    else registrar(`transcricao ilegivel: ${nome2}`);
  }

  const palavras = reconstruirTranscricao(clipes, mapa);
  const frases = agruparEmFrases(palavras);

  // Resumo por ultimo: o log rola sozinho e so o fim fica visivel.
  registrar("");
  registrar(`${palavras.length} palavras no corte final`);
  registrar(`${frases.length} frases`);
  for (const f of frases.slice(0, 5)) {
    registrar(`  ${relogio(f.inicio)}  ${f.texto.slice(0, 60)}`);
  }
  estado("pronto");
}

// Antes de qualquer await: se o I/O pendurar, isto ja aconteceu.
estado("pronto");
registrar("painel carregado");

void analisar().catch((e: unknown) => {
  const err = e as Error;
  registrar(`ERRO: ${err?.message ?? String(e)}`);
  estado("erro");
});
```

- [ ] **Step 3: Rodar o gate**

```bash
npm run verify
```

Esperado: tipos limpos, os 5 testes da Task 2 ainda passando, build ok.

- [ ] **Step 4: Conferir no Premiere real**

Reiniciar o Premiere com um projeto que tenha sequência editada e transcrição na câmera principal. Abrir o painel.

Esperado no log, nesta ordem: taxa de quadros e contagem de faixas, número de clipes na V1, número de cortes, número de mídias com transcrição, e no fim o total de palavras, o total de frases e as cinco primeiras frases com o instante.

**Critério de aceite:** as cinco frases mostradas correspondem ao que é falado no começo do vídeo, e o instante bate com a timeline.

**Diagnóstico:** se aparecer `0 midias com transcricao`, a câmera principal não tem transcrição — gerar em `Texto > Transcrever sequência` antes de seguir.

- [ ] **Step 5: Commit**

```bash
git add -A
git commit -m "feat: le a sequencia real e remonta a fala do corte final"
```

---

## Task 4: PORTÃO DA FASE 0 — provar a escrita do transcript

**Esta tarefa decide o desenho do produto.** Se falhar, parar e reavaliar a entrega por `.srt` antes de escrever qualquer regra de negócio. As tarefas 5 a 13 não dependem do resultado — são núcleo puro — mas a Fase 3 depende inteiramente dele.

**Files:**
- Modify: `src/premiere.ts` (acrescentar ao fim)
- Modify: `src/ui/main.ts` (acrescentar botão e handler)
- Modify: `src/ui/index.html` (acrescentar o botão)
- Create: `docs/API_PROOFS.md`

**Interfaces:**
- Consumes: `comLimite`, `lerClipes` (Task 3).
- Produces:
  - `salvarBackup(nome: string, json: string): Promise<string>` — devolve o caminho gravado
  - `escreverTranscricao(nomeDaMidia: string, json: string): Promise<void>`

- [ ] **Step 1: Acrescentar backup e escrita ao fim de `src/premiere.ts`**

```ts
/* ------------------------------------------------------------- escrita */

/**
 * A regra que custou tres falhas distintas no auto-broll:
 *
 * - toda Action tem de ser CRIADA dentro de `lockedAccess`, senao o Premiere
 *   responde "Requires locked access";
 * - todo objeto passado para ela tambem, senao "The script object is no longer valid";
 * - `lockedAccess` e SINCRONO — nenhum `await` cabe dentro;
 * - erro lancado la dentro NAO propaga: sem capturar, falha passa por sucesso.
 */
function comTransacao(
  project: {
    lockedAccess: (cb: () => void) => void;
    executeTransaction: (cb: (c: { addAction: (a: unknown) => void }) => void, undo: string) => boolean;
  },
  rotuloUndo: string,
  montarAcoes: (adicionar: (acao: unknown) => void) => void
): void {
  let erro: string | null = null;
  project.lockedAccess(() => {
    try {
      project.executeTransaction((compound) => {
        montarAcoes((acao) => compound.addAction(acao));
      }, rotuloUndo);
    } catch (e) {
      const err = e as Error;
      erro = `${err?.name ?? "Erro"}: ${err?.message ?? String(e)}`;
    }
  });
  if (erro !== null) throw new Error(erro);
}

/* eslint-disable @typescript-eslint/no-explicit-any */
const uxp = require("uxp") as any;
/* eslint-enable @typescript-eslint/no-explicit-any */

/**
 * Guarda o transcript original antes de sobrescrever.
 *
 * A rota de escrita e destrutiva e sobrevive ao Ctrl+Z: fechado o Premiere,
 * o desfazer nao existe mais. Sem este arquivo nao ha volta.
 */
export async function salvarBackup(nome: string, json: string): Promise<string> {
  const pasta = await uxp.storage.localFileSystem.getDataFolder();
  const carimbo = new Date().toISOString().replace(/[:.]/g, "-");
  const seguro = nome.replace(/[^a-zA-Z0-9._-]/g, "_");
  const arquivo = await pasta.createFile(`backup-${seguro}-${carimbo}.json`, { overwrite: true });
  await arquivo.write(json);
  return arquivo.nativePath as string;
}

/** Escreve o transcript de volta no ClipProjectItem da midia. */
export async function escreverTranscricao(nomeDaMidia: string, json: string): Promise<void> {
  const { project, rootItem } = await handles();
  const raiz = rootItem as { getItems: () => Promise<Array<{ name: string }>> };
  const item = (await raiz.getItems()).find((i) => i.name === nomeDaMidia);
  if (!item) throw new Error(`midia nao encontrada no projeto: ${nomeDaMidia}`);

  const clip = ppro.ClipProjectItem.cast(item) ?? item;

  comTransacao(
    project as Parameters<typeof comTransacao>[0],
    "Pro Captions: escrever transcricao",
    (adicionar) => {
      // Tudo nasce dentro do lock, inclusive o TextSegments.
      const segmentos = ppro.Transcript.importFromJSON(json);
      adicionar(ppro.Transcript.createImportTextSegmentsAction(segmentos, clip));
    }
  );
}
```

- [ ] **Step 2: Acrescentar o botão em `src/ui/index.html`**

Inserir imediatamente antes de `<section class="faixa faixa-log">`:

```html
      <div class="acao">
        <sp-button id="provar" variant="cta">Prova da Fase 0</sp-button>
      </div>
```

E acrescentar ao fim de `src/ui/styles.css`:

```css
.acao {
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  align-items: center;
  margin-bottom: 8px;
}
.acao sp-button { flex: 1 1 140px; margin-right: 6px; }
```

- [ ] **Step 3: Acrescentar o handler em `src/ui/main.ts`**

Trocar o import de `premiere.ts` por:

```ts
import {
  comLimite,
  escreverTranscricao,
  getSequenceInfo,
  lerClipes,
  lerCortes,
  lerTranscricoes,
  salvarBackup,
} from "../premiere.ts";
```

Acrescentar a função antes do bloco final:

```ts
/**
 * Prova da Fase 0: cinco blocos forcados, curtos, cada um em seu proprio
 * `segment`. Se o Premiere gerar cinco legendas de uma linha, a aposta central
 * do desenho esta certa e o produto inteiro segue por este caminho.
 */
async function provarEscrita(): Promise<void> {
  estado("provando");
  const clipes = await comLimite("clipes", lerClipes(0));
  const primeiro = clipes[0];
  if (!primeiro) throw new Error("V1 vazia: abra uma sequencia editada.");

  const brutas = await comLimite("transcricoes", lerTranscricoes([primeiro.sourceName]), 60000);
  const original = brutas.get(primeiro.sourceName);
  if (!original) throw new Error(`${primeiro.sourceName} nao tem transcricao.`);

  const caminho = await comLimite("backup", salvarBackup(primeiro.sourceName, original));
  registrar(`backup salvo em ${caminho}`);

  const blocos = ["MEU NOME E", "CRISTIANO ESTIVALET", "HOJE TA POR", "197 REAIS", "E OLHA SO"];
  const inicioBase = primeiro.inPointSeconds;

  const forcado = {
    language: "pt-BR",
    segments: blocos.map((texto, i) => {
      const inicio = inicioBase + i * 1.5;
      const palavras = texto.split(" ");
      return {
        start: inicio,
        duration: 1.5,
        language: "pt-BR",
        speaker: "0",
        words: palavras.map((p, j) => ({
          text: p,
          start: inicio + j * (1.5 / palavras.length),
          duration: 1.5 / palavras.length,
          confidence: 1,
          eos: j === palavras.length - 1,
          tags: [],
          type: "word",
        })),
      };
    }),
  };

  await comLimite("escrita", escreverTranscricao(primeiro.sourceName, JSON.stringify(forcado)));

  registrar("");
  registrar(`escrito em ${primeiro.sourceName}: 5 segments`);
  registrar("agora, no Premiere:");
  registrar("  1. abrir Texto > Transcricao e conferir os 5 blocos");
  registrar("  2. Criar legendas a partir da transcricao");
  registrar("  3. contar quantas legendas sairam e se cada uma tem 1 linha");
  estado("prova escrita");
}
```

Trocar o bloco final do arquivo por:

```ts
// Antes de qualquer await: se o I/O pendurar, o botao ja esta ligado.
estado("pronto");
registrar("painel carregado");
elemento("provar").addEventListener("click", () => {
  void provarEscrita().catch((e: unknown) => {
    const err = e as Error;
    registrar(`ERRO: ${err?.message ?? String(e)}`);
    estado("erro");
  });
});

void analisar().catch((e: unknown) => {
  const err = e as Error;
  registrar(`ERRO: ${err?.message ?? String(e)}`);
  estado("erro");
});
```

- [ ] **Step 4: Rodar o gate**

```bash
npm run verify
```

Esperado: tipos limpos, testes da Task 2 passando, build ok.

- [ ] **Step 5: Executar a prova no Premiere**

**Usar um projeto de teste descartável, com cópia da mídia.** A escrita sobrescreve a transcrição do clipe.

1. reiniciar o Premiere e abrir o projeto de teste;
2. abrir o painel e clicar em **Prova da Fase 0**;
3. conferir que o log mostra o caminho do backup;
4. no Premiere: `Texto > Transcrição` — os cinco blocos têm de estar lá;
5. `Criar legendas a partir da transcrição`, com o preset padrão;
6. **contar as legendas geradas na caption track.**

- [ ] **Step 6: Registrar o resultado em `docs/API_PROOFS.md`**

Criar o arquivo com o resultado **medido**, não o esperado:

```markdown
# API_PROOFS — Pro Captions

Premiere alvo: 26.3.2 (Windows x64). Nada entra em codigo de produto sem uma
linha aqui com resultado real.

## Fase 0 — escrita do transcript

| # | Requisito | Resultado | Risco restante |
|---|---|---|---|
| E1 | `Transcript.exportToJSON` no clipe da V1 | | |
| E2 | Backup gravado em PluginData | | |
| E3 | `createImportTextSegmentsAction` aceita nosso JSON | | |
| E4 | Os 5 blocos aparecem no painel Transcricao | | |
| E5 | **1 `segment` produz 1 legenda de 1 linha** | | |
| E6 | Um unico Ctrl+Z desfaz a escrita | | |

### Veredito

(1 segment = 1 legenda? Se nao, quantas legendas sairam e como o Premiere
quebrou. Colar o texto exato das legendas geradas.)
```

Preencher as seis linhas com o que aconteceu de verdade.

- [ ] **Step 7: Decidir o caminho**

- **Se E5 passou** (cinco legendas, uma linha cada): o desenho está confirmado. Seguir para a Task 5.
- **Se E5 falhou:** anotar em `docs/API_PROOFS.md` exatamente como o Premiere quebrou os blocos, restaurar o transcript pelo backup, e **parar**. A entrega por `.srt` volta à mesa e precisa de nova decisão do usuário antes da Fase 3. As tarefas 5 a 13 continuam válidas e podem seguir em paralelo — são núcleo puro e não dependem da rota de entrega.

- [ ] **Step 8: Commit**

```bash
git add -A
git commit -m "feat: prova da Fase 0 — escrita do transcript com backup"
```

---

## Task 5: Numeral por extenso e preset

**Files:**
- Create: `src/preset.ts`
- Create: `src/preco.ts`
- Create: `tests/preco.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces:
  - `Preset { maxCaracteres, pausaQuebraSegundos, toleranciaCorteSegundos, termosProtegidos, trackDeCortes, maiusculas }`
  - `PRESET_PADRAO: Preset`
  - `chaveNumeral(texto: string): string`
  - `porExtenso(tokens: readonly string[]): number | null`
  - `formatarBRL(valor: number): string`

- [ ] **Step 1: Criar `src/preset.ts`**

Todo número que ainda vai ser ajustado na prática mora aqui, para não exigir refatoração quando mudar.

```ts
/*
 * Config central. Nada de "magic number" espalhado pelo dominio.
 *
 * Os valores abaixo sao pontos de partida deliberados, nao verdades medidas.
 * Ajustar depois de ver saida real na tela.
 */

export interface Preset {
  /**
   * Orcamento de caracteres por bloco.
   *
   * A fonte da caption track e inacessivel pela API, entao largura real nao e
   * mensuravel. 32 e o ponto de partida para 1080x1920.
   */
  readonly maxCaracteres: number;
  /** Silencio maior que isto quebra a frase mesmo sem `eos`. */
  readonly pausaQuebraSegundos: number;
  /** Distancia maxima para encostar uma quebra de bloco num corte. */
  readonly toleranciaCorteSegundos: number;
  /** Termos que nao podem depender so da transcricao automatica. */
  readonly termosProtegidos: readonly string[];
  /** Faixa de video lida para cortes e transcricao. 0 = V1. */
  readonly trackDeCortes: number;
  readonly maiusculas: boolean;
}

export const PRESET_PADRAO: Preset = {
  maxCaracteres: 32,
  pausaQuebraSegundos: 1.5,
  toleranciaCorteSegundos: 0.25,
  termosProtegidos: ["Androclinic", "Cristiano Estivalet"],
  trackDeCortes: 0,
  maiusculas: true,
};
```

- [ ] **Step 2: Escrever o teste**

Crie `tests/preco.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";

import { formatarBRL, porExtenso } from "../src/preco.ts";

test("porExtenso resolve valores abaixo de mil", () => {
  assert.equal(porExtenso(["cento", "e", "noventa", "e", "sete"]), 197);
  assert.equal(porExtenso(["quinhentos"]), 500);
  assert.equal(porExtenso(["novecentos", "e", "noventa", "e", "sete"]), 997);
  assert.equal(porExtenso(["cem"]), 100);
});

test("porExtenso resolve milhares", () => {
  assert.equal(porExtenso(["mil"]), 1000);
  assert.equal(porExtenso(["mil", "novecentos", "e", "noventa", "e", "sete"]), 1997);
  assert.equal(porExtenso(["dois", "mil", "e", "quinhentos"]), 2500);
  assert.equal(porExtenso(["vinte", "e", "cinco", "mil"]), 25000);
});

test("porExtenso aceita digito ja transcrito", () => {
  assert.equal(porExtenso(["197"]), 197);
});

test("porExtenso ignora acento e pontuacao", () => {
  assert.equal(porExtenso(["três"]), 3);
  assert.equal(porExtenso(["sete."]), 7);
});

test("porExtenso devolve null quando nao e numeral", () => {
  assert.equal(porExtenso(["homens"]), null);
  assert.equal(porExtenso([]), null);
});

test("formatarBRL usa ponto como separador de milhar", () => {
  assert.equal(formatarBRL(197), "197");
  assert.equal(formatarBRL(1000), "1.000");
  assert.equal(formatarBRL(1997), "1.997");
  assert.equal(formatarBRL(10000), "10.000");
  assert.equal(formatarBRL(100000), "100.000");
  assert.equal(formatarBRL(500), "500");
});
```

- [ ] **Step 3: Rodar o teste para ver falhar**

```bash
npm test
```

Esperado: FALHA — `Cannot find module '../src/preco.ts'`.

- [ ] **Step 4: Criar `src/preco.ts`**

```ts
/*
 * Numeral falado, contexto monetario e formatacao BRL.
 *
 * Puro: nao conhece o Premiere, nao faz I/O.
 */

const UNIDADES: ReadonlyMap<string, number> = new Map([
  ["zero", 0], ["um", 1], ["uma", 1], ["dois", 2], ["duas", 2], ["tres", 3],
  ["quatro", 4], ["cinco", 5], ["seis", 6], ["sete", 7], ["oito", 8], ["nove", 9],
  ["dez", 10], ["onze", 11], ["doze", 12], ["treze", 13], ["quatorze", 14],
  ["catorze", 14], ["quinze", 15], ["dezesseis", 16], ["dezessete", 17],
  ["dezoito", 18], ["dezenove", 19], ["vinte", 20], ["trinta", 30],
  ["quarenta", 40], ["cinquenta", 50], ["sessenta", 60], ["setenta", 70],
  ["oitenta", 80], ["noventa", 90], ["cem", 100], ["cento", 100],
  ["duzentos", 200], ["trezentos", 300], ["quatrocentos", 400],
  ["quinhentos", 500], ["seiscentos", 600], ["setecentos", 700],
  ["oitocentos", 800], ["novecentos", 900],
]);

const MULTIPLICADORES: ReadonlyMap<string, number> = new Map([
  ["mil", 1000], ["milhao", 1000000], ["milhoes", 1000000],
]);

/**
 * Forma comparavel de um token numeral: minuscula, sem acento, sem pontuacao.
 *
 * Tirar acento e seguro AQUI porque o vocabulario numeral nao tem par que so
 * se distinga pelo acento. Nao reaproveitar para texto comum, onde "esta" e
 * "esta" sao palavras diferentes.
 */
export function chaveNumeral(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function ehTokenNumeral(texto: string): boolean {
  const k = chaveNumeral(texto);
  return /^\d+$/.test(k) || UNIDADES.has(k) || MULTIPLICADORES.has(k);
}

/**
 * Converte numeral falado em inteiro. `null` quando nao for numeral.
 *
 * Acumula unidades e fecha um bloco a cada multiplicador, que e o que faz
 * "mil novecentos e noventa e sete" virar 1997 e nao 1000997.
 */
export function porExtenso(tokens: readonly string[]): number | null {
  let total = 0;
  let atual = 0;
  let viu = false;

  for (const token of tokens) {
    const k = chaveNumeral(token);
    if (k === "" || k === "e") continue;

    if (/^\d+$/.test(k)) {
      atual += Number(k);
      viu = true;
      continue;
    }

    const mult = MULTIPLICADORES.get(k);
    if (mult !== undefined) {
      // "mil" sozinho vale 1000, nao 0.
      atual = (atual === 0 ? 1 : atual) * mult;
      total += atual;
      atual = 0;
      viu = true;
      continue;
    }

    const unidade = UNIDADES.get(k);
    if (unidade === undefined) return null;
    atual += unidade;
    viu = true;
  }

  return viu ? total + atual : null;
}

/** Inteiro com ponto de milhar brasileiro. Sem "R$", sem centavos. */
export function formatarBRL(valor: number): string {
  const digitos = String(Math.trunc(Math.abs(valor)));
  let saida = "";
  for (let i = 0; i < digitos.length; i++) {
    if (i > 0 && (digitos.length - i) % 3 === 0) saida += ".";
    saida += digitos[i];
  }
  return saida;
}

/** Um trecho de palavras que forma um numero. Indices no array de palavras. */
export interface Numeral {
  readonly inicio: number;
  /** Inclusivo. */
  readonly fim: number;
  readonly valor: number;
}

/**
 * Acha todos os numerais do array. O "e" so junta dois trechos quando ha
 * numeral dos dois lados — senao "sete e homens" viraria um numero so.
 */
export function acharNumerais(palavras: readonly string[]): Numeral[] {
  const saida: Numeral[] = [];
  let i = 0;

  while (i < palavras.length) {
    const atual = palavras[i];
    if (atual === undefined || !ehTokenNumeral(atual)) {
      i++;
      continue;
    }

    let fim = i;
    let j = i + 1;
    while (j < palavras.length) {
      const t = palavras[j];
      if (t !== undefined && ehTokenNumeral(t)) {
        fim = j;
        j++;
        continue;
      }
      const proximo = palavras[j + 1];
      if (t !== undefined && chaveNumeral(t) === "e" && proximo !== undefined && ehTokenNumeral(proximo)) {
        j += 2;
        fim = j - 1;
        continue;
      }
      break;
    }

    const valor = porExtenso(palavras.slice(i, fim + 1));
    if (valor !== null) saida.push({ inicio: i, fim, valor });
    i = fim + 1;
  }

  return saida;
}
```

- [ ] **Step 5: Rodar o teste para ver passar**

```bash
npm test
```

Esperado: os 6 testes de `preco.test.ts` passando, mais os 5 da Task 2.

- [ ] **Step 6: Rodar o gate e commitar**

```bash
npm run verify
git add -A
git commit -m "feat: numeral por extenso, formatacao BRL e preset central"
```

---

## Task 6: Detecção de contexto monetário

**Files:**
- Modify: `src/preco.ts` (acrescentar ao fim)
- Modify: `tests/preco.test.ts` (acrescentar ao fim)

**Interfaces:**
- Consumes: `Numeral`, `acharNumerais`, `chaveNumeral` (Task 5).
- Produces:
  - `Preco extends Numeral { certeza: "alta" | "media" }`
  - `detectarPrecos(palavras: readonly string[]): Preco[]`
  - `textoDoPreco(valor: number): string`

- [ ] **Step 1: Escrever o teste**

Acrescentar ao fim de `tests/preco.test.ts`:

```ts
import { detectarPrecos, textoDoPreco } from "../src/preco.ts";

const p = (frase: string): ReturnType<typeof detectarPrecos> => detectarPrecos(frase.split(" "));

test("caso 4 da spec: preco sem a palavra reais", () => {
  const achados = p("hoje tá por cento e noventa e sete");
  assert.equal(achados.length, 1);
  assert.equal(achados[0]?.valor, 197);
  assert.equal(achados[0]?.certeza, "alta");
});

test("caso 5 da spec: dois precos no padrao de X por Y", () => {
  const achados = p("de mil por cento e noventa e sete");
  assert.equal(achados.length, 2);
  assert.equal(achados[0]?.valor, 1000);
  assert.equal(achados[1]?.valor, 197);
  assert.equal(achados[0]?.certeza, "alta");
  assert.equal(achados[1]?.certeza, "alta");
});

test("caso 6 da spec: milhar com gatilho explicito", () => {
  const achados = p("a consulta custa mil novecentos e noventa e sete");
  assert.equal(achados.length, 1);
  assert.equal(achados[0]?.valor, 1997);
});

test("caso 7 da spec: numero que NAO e preco", () => {
  assert.deepEqual(p("mais de mil homens"), []);
});

test("a palavra reais confirma o preco sozinha", () => {
  const achados = p("são cento e noventa e sete reais");
  assert.equal(achados[0]?.valor, 197);
  assert.equal(achados[0]?.certeza, "alta");
});

test("porcentagem nao vira preco", () => {
  assert.deepEqual(p("noventa por cento dos homens"), []);
});

test("textoDoPreco monta o bloco no padrao fechado", () => {
  assert.equal(textoDoPreco(197), "197 REAIS");
  assert.equal(textoDoPreco(1000), "1.000 REAIS");
});
```

- [ ] **Step 2: Rodar o teste para ver falhar**

```bash
npm test
```

Esperado: FALHA — `detectarPrecos` e `textoDoPreco` não existem.

- [ ] **Step 3: Acrescentar a implementação ao fim de `src/preco.ts`**

```ts
/* --------------------------------------------------- contexto monetario */

/** Sinal forte: quando uma destas aparece perto, o numero e valor. */
const GATILHOS: ReadonlySet<string> = new Set([
  "custa", "custava", "custam", "custou", "custar", "valor", "preco",
  "investimento", "pagar", "paga", "pagava", "pagamento", "apenas",
  "sai", "sair", "fica", "ficar",
]);

/** Sinal fraco: sozinha nao decide, mas promove um "por" solto. */
const CONTEXTO_FRACO: ReadonlySet<string> = new Set([
  "ta", "esta", "e", "era", "eram", "hoje", "agora", "so", "somente", "apenas", "sai", "fica",
]);

const MOEDA: ReadonlySet<string> = new Set(["reais", "real"]);

/** Quantas palavras antes do numero ainda contam como contexto. */
const JANELA = 4;

export interface Preco extends Numeral {
  /** `media` entra na fila de revisao; `alta` passa direto. */
  readonly certeza: "alta" | "media";
}

/** O bloco final do preco, ja no padrao fechado da spec. Nunca usa "R$". */
export function textoDoPreco(valor: number): string {
  return `${formatarBRL(valor)} REAIS`;
}

/**
 * Decide quais numeros da frase sao dinheiro.
 *
 * A classificacao acontece ANTES da formatacao, senao "mais de mil homens"
 * viraria "1.000 REAIS". Quando nao ha sinal nenhum, o numero fica como texto
 * normal — o produto prefere revisao manual a inventar preco.
 *
 * Limitacao conhecida: "de X por cento" e lido como preco, nao como
 * porcentagem. A desambiguacao usa o "de" que abre o padrao, entao
 * "noventa por cento" (sem "de") continua sendo porcentagem.
 */
export function detectarPrecos(palavras: readonly string[]): Preco[] {
  const numerais = acharNumerais(palavras);
  const chave = (i: number): string => {
    const t = palavras[i];
    return t === undefined ? "" : chaveNumeral(t);
  };

  const saida: Preco[] = [];

  for (let n = 0; n < numerais.length; n++) {
    const num = numerais[n];
    if (num === undefined) continue;

    const anterior = chave(num.inicio - 1);
    const seguinte = chave(num.fim + 1);
    const depois = chave(num.fim + 2);

    // Padrao "de X por Y": os dois numeros sao preco. Verificado antes da
    // porcentagem, senao "de mil por cento e noventa e sete" seria descartado.
    const proximo = numerais[n + 1];
    if (anterior === "de" && seguinte === "por" && proximo !== undefined && proximo.inicio === num.fim + 2) {
      saida.push({ ...num, certeza: "alta" });
      saida.push({ ...proximo, certeza: "alta" });
      n++; // o proximo ja foi consumido
      continue;
    }

    // Porcentagem: "noventa por cento". Nao e dinheiro — e o "cento" que vem
    // logo depois tambem nao. Sem consumir os dois, "cento" seria lido sozinho
    // como um preco de 100.
    if (seguinte === "por" && depois === "cento") {
      if (proximo !== undefined && proximo.inicio === num.fim + 2) n++;
      continue;
    }

    // A moeda dita confirma sozinha.
    if (MOEDA.has(seguinte)) {
      saida.push({ ...num, certeza: "alta" });
      continue;
    }

    const janela: string[] = [];
    for (let i = Math.max(0, num.inicio - JANELA); i < num.inicio; i++) janela.push(chave(i));

    if (janela.some((w) => GATILHOS.has(w))) {
      saida.push({ ...num, certeza: "alta" });
      continue;
    }

    // "por" colado no numero e indicativo, mas fraco demais sozinho:
    // "por tres motivos" nao e preco. Promove so com apoio na janela.
    if (anterior === "por") {
      const apoiado = janela.some((w) => CONTEXTO_FRACO.has(w));
      saida.push({ ...num, certeza: apoiado ? "alta" : "media" });
    }
  }

  return saida;
}
```

- [ ] **Step 4: Rodar o teste para ver passar**

```bash
npm test
```

Esperado: todos os testes de `preco.test.ts` passando.

**Diagnóstico:** se `caso 7` falhar produzindo um preço, conferir que `de` não está em `GATILHOS`. Se `caso 5` produzir só um preço, o `n++` do padrão `de X por Y` está consumindo errado.

- [ ] **Step 5: Rodar o gate e commitar**

```bash
npm run verify
git add -A
git commit -m "feat: deteccao de contexto monetario antes da formatacao"
```

---

## Task 7: Linguagem coloquial

**Files:**
- Create: `src/texto.ts`
- Create: `tests/texto.test.ts`

**Interfaces:**
- Consumes: nada.
- Produces:
  - `PalavraRevisada { text, inicio, fim, confidence, eos, sugestao: string | null, motivo: string | null }`
  - `deTranscricao(palavras: readonly PalavraEditada[]): PalavraRevisada[]`
  - `nucleo(texto: string): { corpo: string; sufixo: string }`
  - `normalizarColoquial(palavras: readonly PalavraRevisada[]): PalavraRevisada[]`

- [ ] **Step 1: Escrever o teste**

Crie `tests/texto.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";

import { normalizarColoquial, nucleo, type PalavraRevisada } from "../src/texto.ts";

/** Monta palavras com tempo previsivel: cada uma dura 1s. */
function palavras(frase: string): PalavraRevisada[] {
  return frase.split(" ").map((text, i) => ({
    text,
    inicio: i,
    fim: i + 1,
    confidence: 1,
    eos: false,
    sugestao: null,
    motivo: null,
  }));
}

const texto = (ps: readonly PalavraRevisada[]): string => ps.map((p) => p.text).join(" ");

test("nucleo separa a pontuacao final", () => {
  assert.deepEqual(nucleo("relógio."), { corpo: "relógio", sufixo: "." });
  assert.deepEqual(nucleo("para"), { corpo: "para", sufixo: "" });
  assert.deepEqual(nucleo("assim,"), { corpo: "assim", sufixo: "," });
});

test("para o vira pro, fundindo duas palavras em uma", () => {
  const saida = normalizarColoquial(palavras("falando para o paciente"));
  assert.equal(texto(saida), "falando pro paciente");
  assert.equal(saida.length, 3);
});

test("a palavra fundida cobre o tempo das duas originais", () => {
  const saida = normalizarColoquial(palavras("falando para o paciente"));
  const pro = saida[1];
  assert.equal(pro?.inicio, 1);
  assert.equal(pro?.fim, 3);
});

test("para os vira pros", () => {
  assert.equal(texto(normalizarColoquial(palavras("bom para os homens"))), "bom pros homens");
});

test("para sozinho vira pra", () => {
  assert.equal(texto(normalizarColoquial(palavras("para você entender"))), "pra você entender");
});

test("formas de estar viram a forma falada", () => {
  assert.equal(texto(normalizarColoquial(palavras("eu estava conversando"))), "eu tava conversando");
  assert.equal(texto(normalizarColoquial(palavras("eles estavam aqui"))), "eles tavam aqui");
  assert.equal(texto(normalizarColoquial(palavras("você está vendo"))), "você tá vendo");
  assert.equal(texto(normalizarColoquial(palavras("eles estão aqui"))), "eles tão aqui");
  assert.equal(texto(normalizarColoquial(palavras("eu estou falando"))), "eu tô falando");
});

test("caso 8 da spec", () => {
  const saida = normalizarColoquial(palavras("Para você entender, eu estava falando para o paciente."));
  assert.equal(texto(saida), "Pra você entender, eu tava falando pro paciente.");
});

test("a pontuacao sobrevive a troca", () => {
  assert.equal(texto(normalizarColoquial(palavras("é para."))), "é pra.");
});

test("reducoes agressivas NAO sao aplicadas", () => {
  assert.equal(texto(normalizarColoquial(palavras("você vamos estamos"))), "você vamos estamos");
});
```

- [ ] **Step 2: Rodar o teste para ver falhar**

```bash
npm test
```

Esperado: FALHA — `Cannot find module '../src/texto.ts'`.

- [ ] **Step 3: Criar `src/texto.ts`**

```ts
/*
 * Correcao de grafia sobre o array de palavras: coloquial, e/e, porques e
 * termos protegidos. Todas percorrem a mesma estrutura e por isso moram juntas.
 *
 * Puro: nao conhece o Premiere, nao faz I/O.
 *
 * Regra do modulo: quando a evidencia nao basta, o texto fica como esta e a
 * duvida vai para `sugestao` — a UI oferece a troca. Nunca inventar palavra.
 */

import type { PalavraEditada } from "./transcript.ts";

export interface PalavraRevisada {
  readonly text: string;
  /** Segundos na sequencia. */
  readonly inicio: number;
  readonly fim: number;
  readonly confidence: number;
  readonly eos: boolean;
  /** Troca proposta que o produto nao teve evidencia para aplicar sozinho. */
  readonly sugestao: string | null;
  readonly motivo: string | null;
}

export function deTranscricao(palavras: readonly PalavraEditada[]): PalavraRevisada[] {
  return palavras.map((p) => ({
    text: p.text,
    inicio: p.inicio,
    fim: p.fim,
    confidence: p.confidence,
    eos: p.eos,
    sugestao: null,
    motivo: null,
  }));
}

/**
 * Separa a palavra da pontuacao que veio grudada.
 *
 * O Premiere entrega "relógio." como um token so. Sem separar, nenhuma regra
 * casa com a ultima palavra da frase — que e justamente onde mora o `eos`.
 *
 * NAO tira acento: em portugues "esta" e "está" sao palavras diferentes.
 */
export function nucleo(texto: string): { corpo: string; sufixo: string } {
  const casou = /^(.*?)([.,!?;:…]*)$/u.exec(texto);
  if (!casou) return { corpo: texto, sufixo: "" };
  return { corpo: casou[1] ?? texto, sufixo: casou[2] ?? "" };
}

/** Aplica a caixa da palavra original na substituta: "Para" -> "Pra". */
function comCaixaDe(modelo: string, novo: string): string {
  const primeira = modelo[0];
  if (primeira === undefined) return novo;
  if (primeira !== primeira.toUpperCase()) return novo;
  return novo.charAt(0).toUpperCase() + novo.slice(1);
}

/** Trocas de uma palavra so. Chave em minuscula, sem pontuacao. */
const SIMPLES: ReadonlyMap<string, string> = new Map([
  ["para", "pra"],
  ["estava", "tava"],
  ["estavam", "tavam"],
  ["está", "tá"],
  ["estão", "tão"],
  ["estou", "tô"],
]);

/** Trocas que consomem DUAS palavras. Chave: "primeira segunda". */
const PARES: ReadonlyMap<string, string> = new Map([
  ["para o", "pro"],
  ["para os", "pros"],
]);

/**
 * Aplica so as reducoes aprovadas na spec.
 *
 * Deliberadamente NAO faz "você"->"cê", "vamos"->"vamo", "estamos"->"tamo":
 * a spec proibe reducao agressiva sem regra explicita.
 *
 * O par "para o" funde duas palavras numa: a palavra resultante herda o inicio
 * da primeira e o fim da segunda, senao "pro" apareceria antes de ser falado.
 */
export function normalizarColoquial(palavras: readonly PalavraRevisada[]): PalavraRevisada[] {
  const saida: PalavraRevisada[] = [];
  let i = 0;

  while (i < palavras.length) {
    const atual = palavras[i];
    if (atual === undefined) {
      i++;
      continue;
    }

    const a = nucleo(atual.text);
    const seguinte = palavras[i + 1];

    if (seguinte !== undefined) {
      const b = nucleo(seguinte.text);
      const par = PARES.get(`${a.corpo.toLowerCase()} ${b.corpo.toLowerCase()}`);
      if (par !== undefined) {
        saida.push({
          ...atual,
          text: comCaixaDe(a.corpo, par) + b.sufixo,
          // Fim da SEGUNDA: a legenda nao pode terminar antes da fala.
          fim: seguinte.fim,
          confidence: Math.min(atual.confidence, seguinte.confidence),
          eos: seguinte.eos,
        });
        i += 2;
        continue;
      }
    }

    const troca = SIMPLES.get(a.corpo.toLowerCase());
    if (troca !== undefined) {
      saida.push({ ...atual, text: comCaixaDe(a.corpo, troca) + a.sufixo });
      i++;
      continue;
    }

    saida.push(atual);
    i++;
  }

  return saida;
}
```

- [ ] **Step 4: Rodar o teste para ver passar**

```bash
npm test
```

Esperado: os 9 testes de `texto.test.ts` passando.

- [ ] **Step 5: Rodar o gate e commitar**

```bash
npm run verify
git add -A
git commit -m "feat: linguagem coloquial com fusao de para o em pro"
```

---

## Task 8: É/E e os porquês

**Files:**
- Modify: `src/texto.ts` (acrescentar ao fim)
- Modify: `tests/texto.test.ts` (acrescentar ao fim)

**Interfaces:**
- Consumes: `PalavraRevisada`, `nucleo`, `comCaixaDe` (Task 7 — `comCaixaDe` é privada, reutilizar no mesmo arquivo).
- Produces:
  - `corrigirEAcento(palavras: readonly PalavraRevisada[]): PalavraRevisada[]`
  - `corrigirPorques(palavras: readonly PalavraRevisada[]): PalavraRevisada[]`

- [ ] **Step 1: Escrever o teste**

Acrescentar ao fim de `tests/texto.test.ts`:

```ts
import { corrigirEAcento, corrigirPorques } from "../src/texto.ts";

test("caso 9 da spec: nome e Cristiano vira nome é Cristiano", () => {
  assert.equal(texto(corrigirEAcento(palavras("Meu nome e Cristiano"))), "Meu nome é Cristiano");
});

test("e como verbo depois de pronome ou demonstrativo", () => {
  assert.equal(texto(corrigirEAcento(palavras("isso e importante"))), "isso é importante");
  assert.equal(texto(corrigirEAcento(palavras("ele e médico"))), "ele é médico");
  assert.equal(texto(corrigirEAcento(palavras("o problema e outro"))), "o problema é outro");
});

test("e por isso ganha acento", () => {
  assert.equal(texto(corrigirEAcento(palavras("e por isso que acontece"))), "é por isso que acontece");
});

test("e como conjuncao NAO ganha acento", () => {
  assert.equal(texto(corrigirEAcento(palavras("saúde e qualidade de vida"))), "saúde e qualidade de vida");
  assert.equal(texto(corrigirEAcento(palavras("você e sua esposa"))), "você e sua esposa");
  assert.equal(texto(corrigirEAcento(palavras("ele chegou e conversou comigo"))), "ele chegou e conversou comigo");
});

test("caso 10 da spec: pergunta usa por que separado", () => {
  assert.equal(texto(corrigirPorques(palavras("Você sabe porque isso acontece"))), "Você sabe por que isso acontece");
});

test("caso 11 da spec: explicacao usa porque junto", () => {
  assert.equal(
    texto(corrigirPorques(palavras("Isso acontece por que o hormônio caiu"))),
    "Isso acontece porque o hormônio caiu"
  );
});

test("porque no fim da oracao vira por quê", () => {
  assert.equal(texto(corrigirPorques(palavras("Isso acontece porque?"))), "Isso acontece por quê?");
});

test("porque precedido de artigo e substantivo", () => {
  assert.equal(texto(corrigirPorques(palavras("vou te explicar o porque"))), "vou te explicar o porquê");
});
```

- [ ] **Step 2: Rodar o teste para ver falhar**

```bash
npm test
```

Esperado: FALHA — `corrigirEAcento` e `corrigirPorques` não existem.

- [ ] **Step 3: Acrescentar a implementação ao fim de `src/texto.ts`**

```ts
/* --------------------------------------------------------------- é / e */

/**
 * Palavras que, imediatamente antes de "e", indicam verbo de ligacao.
 *
 * Sujeito seguido de "e" quase sempre pede o verbo: "isso e", "ele e",
 * "nome e". A conjuncao aparece depois de verbo ("chegou e") ou de
 * substantivo em enumeracao ("saúde e"), que ficam de fora desta lista.
 */
const SUJEITOS: ReadonlySet<string> = new Set([
  "isso", "isto", "aquilo", "ele", "ela", "eles", "elas",
  "nome", "problema", "questao", "questão", "objetivo", "resultado", "segredo",
  "verdade", "diferenca", "diferença", "motivo", "causa", "tudo", "nada",
]);
// "você" fica de fora de proposito: a propria spec usa "Você e sua esposa"
// como exemplo de conjuncao. Perde-se "você é importante"; o inverso erraria
// numa construcao mais comum.

/**
 * Corrige "e" para "é" quando o contexto indica verbo.
 *
 * Nao confia so na saida acustica: o ASR troca os dois o tempo todo. Na duvida
 * mantem o que veio — errar para "é" numa enumeracao e mais visivel na tela do
 * que o contrario.
 */
export function corrigirEAcento(palavras: readonly PalavraRevisada[]): PalavraRevisada[] {
  return palavras.map((palavra, i) => {
    const atual = nucleo(palavra.text);
    if (atual.corpo.toLowerCase() !== "e") return palavra;

    const anterior = palavras[i - 1];
    const seguinte = palavras[i + 1];
    const antes = anterior === undefined ? "" : nucleo(anterior.text).corpo.toLowerCase();
    const depois = seguinte === undefined ? "" : nucleo(seguinte.text).corpo.toLowerCase();

    // "é por isso que..."
    const abreExplicacao = depois === "por" && nucleo(palavras[i + 2]?.text ?? "").corpo.toLowerCase() === "isso";

    if (SUJEITOS.has(antes) || abreExplicacao) {
      return { ...palavra, text: comCaixaDe(atual.corpo, "é") + atual.sufixo };
    }
    return palavra;
  });
}

/* ------------------------------------------------------------- porquês */

/** Abre pergunta indireta ou direta: pede "por que" separado. */
const INTERROGATIVOS: ReadonlySet<string> = new Set([
  "sabe", "sabia", "sabem", "entende", "entendeu", "imagina", "adivinha", "explica",
]);

const ARTIGOS: ReadonlySet<string> = new Set(["o", "um", "esse", "este", "aquele", "meu", "seu"]);

/**
 * Escolhe entre as quatro formas.
 *
 * A decisao olha a oracao inteira, por isso roda ANTES da segmentacao: depois
 * de partir em blocos, o fim da oracao ja nao e visivel.
 */
export function corrigirPorques(palavras: readonly PalavraRevisada[]): PalavraRevisada[] {
  // Junta "por"+"que" num indice so para tratar as duas grafias igual.
  const alvos: Array<{ i: number; consome: number; sufixo: string; caixa: string }> = [];
  for (let i = 0; i < palavras.length; i++) {
    const atual = palavras[i];
    if (atual === undefined) continue;
    const a = nucleo(atual.text);
    const corpo = a.corpo.toLowerCase();

    if (corpo === "porque" || corpo === "porquê") {
      alvos.push({ i, consome: 1, sufixo: a.sufixo, caixa: a.corpo });
      continue;
    }
    if (corpo === "por") {
      const seguinte = palavras[i + 1];
      if (seguinte === undefined) continue;
      const b = nucleo(seguinte.text);
      const corpoB = b.corpo.toLowerCase();
      if (corpoB === "que" || corpoB === "quê") {
        alvos.push({ i, consome: 2, sufixo: b.sufixo, caixa: a.corpo });
      }
    }
  }

  if (alvos.length === 0) return [...palavras];

  const saida: PalavraRevisada[] = [];
  let i = 0;
  let a = 0;

  while (i < palavras.length) {
    const alvo = alvos[a];
    const atual = palavras[i];
    if (atual === undefined) {
      i++;
      continue;
    }
    if (alvo === undefined || alvo.i !== i) {
      saida.push(atual);
      i++;
      continue;
    }
    a++;

    const ultimo = palavras[i + alvo.consome - 1] ?? atual;
    const anterior = palavras[i - 1];
    const antes = anterior === undefined ? "" : nucleo(anterior.text).corpo.toLowerCase();

    // Onde termina a oracao: usado para saber se o porque esta no fim.
    let fimDaOracao = i + alvo.consome;
    while (fimDaOracao < palavras.length) {
      const p = palavras[fimDaOracao];
      if (p === undefined) break;
      if (p.eos) {
        fimDaOracao++;
        break;
      }
      fimDaOracao++;
    }
    const nadaDepois = i + alvo.consome >= palavras.length || (ultimo.eos && i + alvo.consome === palavras.length);

    // Pergunta: alguem "sabe/entende" antes, ou a oracao termina em "?".
    const inicioDaOracao = (() => {
      let j = i - 1;
      while (j > 0) {
        const p = palavras[j - 1];
        if (p === undefined || p.eos) break;
        j--;
      }
      return Math.max(0, j);
    })();
    let interrogativa = false;
    for (let j = inicioDaOracao; j < i; j++) {
      const p = palavras[j];
      if (p !== undefined && INTERROGATIVOS.has(nucleo(p.text).corpo.toLowerCase())) interrogativa = true;
    }
    for (let j = i; j < fimDaOracao; j++) {
      if ((palavras[j]?.text ?? "").includes("?")) interrogativa = true;
    }

    let forma: string;
    if (ARTIGOS.has(antes)) forma = "porquê";
    else if (nadaDepois) forma = "por quê";
    else if (interrogativa) forma = "por que";
    else forma = "porque";

    saida.push({
      ...atual,
      text: comCaixaDe(alvo.caixa, forma) + alvo.sufixo,
      fim: ultimo.fim,
      eos: ultimo.eos,
      confidence: Math.min(atual.confidence, ultimo.confidence),
    });
    i += alvo.consome;
  }

  return saida;
}
```

- [ ] **Step 4: Rodar o teste para ver passar**

```bash
npm test
```

Esperado: os 8 testes novos passando.

**Diagnóstico:** se `porque no fim da oracao` falhar, o teste monta as palavras com `eos: false` — o `nadaDepois` está caindo no ramo do fim do array, que é o esperado. Se `caso 10` devolver `porque`, conferir que `sabe` está em `INTERROGATIVOS` e que a busca do início da oração não está pulando a palavra.

- [ ] **Step 5: Rodar o gate e commitar**

```bash
npm run verify
git add -A
git commit -m "feat: correcao de é/e e das quatro formas do porque"
```

---

## Task 9: Termos protegidos

**Files:**
- Modify: `src/texto.ts` (acrescentar ao fim)
- Modify: `tests/texto.test.ts` (acrescentar ao fim)

**Interfaces:**
- Consumes: `PalavraRevisada`, `nucleo` (Task 7); `Preset`, `PRESET_PADRAO` (Task 5).
- Produces:
  - `distancia(a: string, b: string): number`
  - `protegerTermos(palavras: readonly PalavraRevisada[], preset: Preset): PalavraRevisada[]`

- [ ] **Step 1: Escrever o teste**

Acrescentar ao fim de `tests/texto.test.ts`:

```ts
import { distancia, protegerTermos } from "../src/texto.ts";
import { PRESET_PADRAO } from "../src/preset.ts";

const proteger = (frase: string): PalavraRevisada[] => protegerTermos(palavras(frase), PRESET_PADRAO);

test("distancia de edicao", () => {
  assert.equal(distancia("androclinic", "androclinic"), 0);
  assert.equal(distancia("andro clinic", "androclinic"), 1);
  assert.ok(distancia("estivalet", "equivalente") > 3);
});

test("caso 3 da spec: erro proximo e corrigido sozinho", () => {
  assert.equal(texto(proteger("aqui na androclinica")), "aqui na Androclinic");
});

test("erro de duas palavras vira o termo canonico", () => {
  assert.equal(texto(proteger("aqui na andro clinic hoje")), "aqui na Androclinic hoje");
});

test("caso 2 da spec: erro distante NAO e trocado sozinho, vira sugestao", () => {
  const saida = proteger("Meu nome é Cristiano Equivalente");
  // O texto continua o que o Premiere ouviu: nao inventar palavra.
  assert.equal(texto(saida), "Meu nome é Cristiano Equivalente");
  const suspeita = saida[saida.length - 1];
  assert.equal(suspeita?.sugestao, "Estivalet");
  assert.ok(suspeita?.motivo);
});

test("o termo ja correto nao vira sugestao", () => {
  const saida = proteger("Meu nome é Cristiano Estivalet");
  assert.equal(texto(saida), "Meu nome é Cristiano Estivalet");
  assert.equal(saida[saida.length - 1]?.sugestao, null);
});

test("palavra comum longe de qualquer termo fica intacta", () => {
  const saida = proteger("o paciente chegou cedo");
  assert.equal(texto(saida), "o paciente chegou cedo");
  assert.ok(saida.every((p) => p.sugestao === null));
});
```

- [ ] **Step 2: Rodar o teste para ver falhar**

```bash
npm test
```

Esperado: FALHA — `distancia` e `protegerTermos` não existem.

- [ ] **Step 3: Acrescentar a implementação ao fim de `src/texto.ts`**

```ts
/* ----------------------------------------------------- termos protegidos */

import type { Preset } from "./preset.ts";

/** Distancia de edicao de Levenshtein. Duas linhas de matriz bastam. */
export function distancia(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  let anterior = Array.from({ length: b.length + 1 }, (_, i) => i);
  let atual = new Array<number>(b.length + 1).fill(0);

  for (let i = 1; i <= a.length; i++) {
    atual[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const custo = a[i - 1] === b[j - 1] ? 0 : 1;
      atual[j] = Math.min(
        (atual[j - 1] ?? 0) + 1,
        (anterior[j] ?? 0) + 1,
        (anterior[j - 1] ?? 0) + custo
      );
    }
    const troca = anterior;
    anterior = atual;
    atual = troca;
  }
  return anterior[b.length] ?? 0;
}

/** Forma comparavel: minuscula, sem acento, so letras. */
function comparavel(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

/**
 * Aplica o vocabulario protegido.
 *
 * Duas rotas, deliberadamente diferentes:
 *
 * - **Erro proximo** (`andro clinica` -> `Androclinic`): a distancia de edicao
 *   sozinha ja e evidencia, e a troca acontece.
 * - **Erro distante** (`Equivalente` no lugar de `Estivalet`): a distancia nao
 *   ajuda, so o contexto — a palavra vem logo depois de "Cristiano". Contexto
 *   sozinho NAO autoriza reescrever a fala, entao o texto fica como esta e a
 *   duvida vai para `sugestao`, que a fila de revisao mostra ao usuario.
 *
 * E o que a spec pede na secao 5: preferir revisao manual rapida a inventar
 * uma palavra.
 */
export function protegerTermos(
  palavras: readonly PalavraRevisada[],
  preset: Preset
): PalavraRevisada[] {
  /** Cada termo dividido em palavras, com a forma comparavel de cada uma. */
  const termos = preset.termosProtegidos.map((t) => {
    const partes = t.split(" ");
    return { canonico: t, partes, chaves: partes.map(comparavel) };
  });

  const saida: PalavraRevisada[] = [];
  let i = 0;

  while (i < palavras.length) {
    const atual = palavras[i];
    if (atual === undefined) {
      i++;
      continue;
    }

    let aplicou = false;

    for (const termo of termos) {
      for (let n = 1; n <= termo.partes.length && i + n <= palavras.length; n++) {
        const janela = palavras.slice(i, i + n);
        const juntas = comparavel(janela.map((p) => nucleo(p.text).corpo).join(""));
        const alvo = termo.chaves.join("");

        // Tolerancia proporcional: 1 erro a cada 5 caracteres, minimo 1.
        const limite = Math.max(1, Math.floor(alvo.length / 5));
        if (juntas.length === 0 || distancia(juntas, alvo) > limite) continue;

        const ultima = janela[janela.length - 1] ?? atual;
        saida.push({
          ...atual,
          text: termo.canonico + nucleo(ultima.text).sufixo,
          fim: ultima.fim,
          eos: ultima.eos,
          confidence: Math.min(...janela.map((p) => p.confidence)),
          sugestao: null,
          motivo: null,
        });
        i += n;
        aplicou = true;
        break;
      }
      if (aplicou) break;
    }
    if (aplicou) continue;

    // Contexto: palavra logo depois de uma parte inicial de termo composto.
    const anterior = palavras[i - 1];
    let sugestao: string | null = null;
    if (anterior !== undefined) {
      const chaveAnterior = comparavel(nucleo(anterior.text).corpo);
      for (const termo of termos) {
        if (termo.partes.length < 2) continue;
        if (termo.chaves[0] !== chaveAnterior) continue;
        const esperada = termo.partes[1];
        if (esperada === undefined) continue;
        if (comparavel(nucleo(atual.text).corpo) === comparavel(esperada)) break;
        sugestao = esperada;
        break;
      }
    }

    saida.push(
      sugestao === null
        ? atual
        : { ...atual, sugestao, motivo: `esperado depois de "${nucleo(anterior?.text ?? "").corpo}"` }
    );
    i++;
  }

  return saida;
}
```

- [ ] **Step 4: Mover o import para o topo do arquivo**

`verbatimModuleSyntax` e `isolatedModules` aceitam import no meio do arquivo, mas isso confunde a leitura. Mover `import type { Preset } from "./preset.ts";` para junto do `import type { PalavraEditada }` no topo de `src/texto.ts` e apagar a linha do meio.

- [ ] **Step 5: Rodar o teste para ver passar**

```bash
npm test
```

Esperado: os 6 testes novos passando.

**Diagnóstico:** se `palavra comum longe de qualquer termo` falhar com uma troca indevida, o `limite` está frouxo — conferir que ele é `Math.max(1, Math.floor(alvo.length / 5))` e não uma fração maior.

- [ ] **Step 6: Rodar o gate e commitar**

```bash
npm run verify
git add -A
git commit -m "feat: vocabulario protegido — troca quando ha evidencia, sugere quando nao ha"
```

---

## Task 10: Segmentar por frase e orçamento de caracteres

**Files:**
- Create: `src/segmentar.ts`
- Create: `tests/segmentar.test.ts`

**Interfaces:**
- Consumes: `PalavraRevisada`, `nucleo` (Task 7); `Preset`, `PRESET_PADRAO` (Task 5).
- Produces:
  - `BlocoLegenda { texto, inicio, fim, estilo: "normal" | "preco", precisaRevisao, motivos }`
  - `segmentar(palavras: readonly PalavraRevisada[], cortes: readonly number[], preset: Preset): BlocoLegenda[]`

- [ ] **Step 1: Escrever o teste**

Crie `tests/segmentar.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";

import { segmentar } from "../src/segmentar.ts";
import { PRESET_PADRAO } from "../src/preset.ts";
import type { PalavraRevisada } from "../src/texto.ts";

/** Uma palavra por segundo. `|` no fim marca eos. */
function palavras(frase: string): PalavraRevisada[] {
  return frase.split(" ").map((bruto, i) => {
    const eos = bruto.endsWith("|");
    return {
      text: eos ? bruto.slice(0, -1) : bruto,
      inicio: i,
      fim: i + 1,
      confidence: 1,
      eos,
      sugestao: null,
      motivo: null,
    };
  });
}

const seg = (frase: string, cortes: number[] = []): ReturnType<typeof segmentar> =>
  segmentar(palavras(frase), cortes, PRESET_PADRAO);

test("frase curta vira um bloco so", () => {
  const blocos = seg("MEU NOME É CRISTIANO|");
  assert.equal(blocos.length, 1);
  assert.equal(blocos[0]?.texto, "MEU NOME É CRISTIANO");
});

test("cada eos abre um bloco novo", () => {
  const blocos = seg("PRIMEIRA FRASE| SEGUNDA FRASE|");
  assert.equal(blocos.length, 2);
  assert.equal(blocos[0]?.texto, "PRIMEIRA FRASE");
  assert.equal(blocos[1]?.texto, "SEGUNDA FRASE");
});

test("o tempo do bloco acompanha a primeira e a ultima palavra", () => {
  const blocos = seg("PRIMEIRA FRASE| SEGUNDA FRASE|");
  assert.equal(blocos[0]?.inicio, 0);
  assert.equal(blocos[0]?.fim, 2);
  assert.equal(blocos[1]?.inicio, 2);
  assert.equal(blocos[1]?.fim, 4);
});

test("caso 13 da spec: nenhum bloco tem quebra de linha", () => {
  for (const bloco of seg("UMA FRASE BEM LONGA QUE PRECISA SER PARTIDA EM VARIOS BLOCOS AQUI|")) {
    assert.ok(!bloco.texto.includes("\n"));
  }
});

test("frase longa e partida respeitando o orcamento de caracteres", () => {
  const blocos = seg("VOCE PRECISA ENTENDER O QUE ESTA ACONTECENDO COM O SEU CORPO AGORA|");
  assert.ok(blocos.length > 1);
  for (const bloco of blocos) {
    assert.ok(
      bloco.texto.length <= PRESET_PADRAO.maxCaracteres,
      `bloco estourou o orcamento: "${bloco.texto}" (${bloco.texto.length})`
    );
  }
});

test("nenhuma palavra e cortada ao meio", () => {
  const original = "VOCE PRECISA ENTENDER O QUE ESTA ACONTECENDO COM O SEU CORPO AGORA";
  const juntos = seg(`${original}|`).map((b) => b.texto).join(" ");
  assert.equal(juntos, original);
});

test("pausa longa quebra a frase mesmo sem eos", () => {
  const ps: PalavraRevisada[] = [
    { text: "ANTES", inicio: 0, fim: 1, confidence: 1, eos: false, sugestao: null, motivo: null },
    { text: "DEPOIS", inicio: 5, fim: 6, confidence: 1, eos: false, sugestao: null, motivo: null },
  ];
  const blocos = segmentar(ps, [], PRESET_PADRAO);
  assert.equal(blocos.length, 2);
});

test("confianca baixa marca o bloco para revisao", () => {
  const ps: PalavraRevisada[] = [
    { text: "TALVEZ", inicio: 0, fim: 1, confidence: 0.3, eos: true, sugestao: null, motivo: null },
  ];
  const blocos = segmentar(ps, [], PRESET_PADRAO);
  assert.equal(blocos[0]?.precisaRevisao, true);
  assert.ok(blocos[0]?.motivos.length);
});

test("sugestao pendente marca o bloco para revisao", () => {
  const ps: PalavraRevisada[] = [
    { text: "EQUIVALENTE", inicio: 0, fim: 1, confidence: 1, eos: true, sugestao: "Estivalet", motivo: "contexto" },
  ];
  const blocos = segmentar(ps, [], PRESET_PADRAO);
  assert.equal(blocos[0]?.precisaRevisao, true);
});
```

- [ ] **Step 2: Rodar o teste para ver falhar**

```bash
npm test
```

Esperado: FALHA — `Cannot find module '../src/segmentar.ts'`.

- [ ] **Step 3: Criar `src/segmentar.ts`**

```ts
/*
 * Transforma palavras com tempo em blocos de legenda de UMA linha.
 *
 * Puro: nao conhece o Premiere, nao faz I/O.
 *
 * Ordem das decisoes, do mais rigido para o mais flexivel:
 *   1. fronteira de frase (`eos` ou pausa longa) — o Premiere ja entrega
 *   2. orcamento de caracteres — hard constraint da regra de uma linha
 *   3. escolha do ponto de quebra — heuristica, e o unico lugar com juizo
 */

import { PRESET_PADRAO, type Preset } from "./preset.ts";
import { nucleo, type PalavraRevisada } from "./texto.ts";

export interface BlocoLegenda {
  readonly texto: string;
  /** Segundos na sequencia. */
  readonly inicio: number;
  readonly fim: number;
  readonly estilo: "normal" | "preco";
  readonly precisaRevisao: boolean;
  readonly motivos: readonly string[];
}

/** Abaixo disto o trecho vai para a fila de revisao. */
const CONFIANCA_MINIMA = 0.5;

/** Corta o array de palavras em frases, por `eos` ou por pausa. */
function emFrases(
  palavras: readonly PalavraRevisada[],
  preset: Preset
): PalavraRevisada[][] {
  const frases: PalavraRevisada[][] = [];
  let atual: PalavraRevisada[] = [];

  for (const palavra of palavras) {
    const anterior = atual[atual.length - 1];
    if (anterior !== undefined && palavra.inicio - anterior.fim > preset.pausaQuebraSegundos) {
      frases.push(atual);
      atual = [];
    }
    atual.push(palavra);
    if (palavra.eos) {
      frases.push(atual);
      atual = [];
    }
  }
  if (atual.length > 0) frases.push(atual);
  return frases;
}

const larguraDe = (palavras: readonly PalavraRevisada[]): number =>
  palavras.reduce((soma, p, i) => soma + p.text.length + (i > 0 ? 1 : 0), 0);

/**
 * Parte uma frase que nao cabe em uma linha.
 *
 * Guloso da esquerda: pega o maior prefixo que cabe e recua ate um ponto de
 * quebra decente. Recuar importa — quebrar no limite exato do orcamento separa
 * artigo de substantivo e deixa bloco de uma palavra so.
 */
function partir(frase: readonly PalavraRevisada[], preset: Preset): PalavraRevisada[][] {
  if (larguraDe(frase) <= preset.maxCaracteres) return [[...frase]];

  const partes: PalavraRevisada[][] = [];
  let resto = [...frase];

  while (resto.length > 0) {
    if (larguraDe(resto) <= preset.maxCaracteres) {
      partes.push(resto);
      break;
    }

    // Maior prefixo que cabe. Pelo menos uma palavra, sempre: uma palavra
    // sozinha maior que o orcamento e melhor que um bloco vazio.
    let corte = 1;
    for (let n = 1; n <= resto.length; n++) {
      if (larguraDe(resto.slice(0, n)) > preset.maxCaracteres) break;
      corte = n;
    }

    partes.push(resto.slice(0, corte));
    resto = resto.slice(corte);
  }

  return partes;
}

function montarBloco(
  palavras: readonly PalavraRevisada[],
  estilo: "normal" | "preco"
): BlocoLegenda {
  const primeira = palavras[0];
  const ultima = palavras[palavras.length - 1];
  if (primeira === undefined || ultima === undefined) {
    throw new RangeError("bloco sem palavras");
  }

  const motivos: string[] = [];
  const confianca = Math.min(...palavras.map((p) => p.confidence));
  if (confianca < CONFIANCA_MINIMA) motivos.push(`confianca ${confianca.toFixed(2)}`);
  for (const p of palavras) {
    if (p.sugestao !== null) motivos.push(`"${nucleo(p.text).corpo}" pode ser "${p.sugestao}"`);
  }

  return {
    // A regra de uma linha e absoluta: nenhuma quebra sobrevive daqui.
    texto: palavras.map((p) => p.text).join(" ").replace(/\s*\n\s*/g, " "),
    inicio: primeira.inicio,
    fim: ultima.fim,
    estilo,
    precisaRevisao: motivos.length > 0,
    motivos,
  };
}

export function segmentar(
  palavras: readonly PalavraRevisada[],
  cortes: readonly number[],
  preset: Preset = PRESET_PADRAO
): BlocoLegenda[] {
  void cortes; // usado a partir da Task 13
  const blocos: BlocoLegenda[] = [];
  for (const frase of emFrases(palavras, preset)) {
    for (const parte of partir(frase, preset)) {
      if (parte.length > 0) blocos.push(montarBloco(parte, "normal"));
    }
  }
  return blocos;
}
```

- [ ] **Step 4: Rodar o teste para ver passar**

```bash
npm test
```

Esperado: os 10 testes de `segmentar.test.ts` passando.

- [ ] **Step 5: Rodar o gate e commitar**

```bash
npm run verify
git add -A
git commit -m "feat: segmentacao por frase e orcamento de caracteres"
```

---

## Task 11: Preço isolado no bloco próprio

**Files:**
- Modify: `src/segmentar.ts`
- Modify: `tests/segmentar.test.ts` (acrescentar ao fim)

**Interfaces:**
- Consumes: `detectarPrecos`, `textoDoPreco`, `Preco` (Task 6); `BlocoLegenda`, `segmentar` (Task 10).
- Produces: `segmentar` passa a devolver blocos com `estilo: "preco"`.

- [ ] **Step 1: Escrever o teste**

Acrescentar ao fim de `tests/segmentar.test.ts`:

```ts
test("caso 4 da spec: preco sai isolado, com REAIS", () => {
  const blocos = seg("HOJE TÁ POR CENTO E NOVENTA E SETE|");
  assert.deepEqual(blocos.map((b) => b.texto), ["HOJE TÁ POR", "197 REAIS"]);
  assert.deepEqual(blocos.map((b) => b.estilo), ["normal", "preco"]);
});

test("caso 5 da spec: dois precos, cada um no seu bloco", () => {
  const blocos = seg("DE MIL POR CENTO E NOVENTA E SETE|");
  assert.deepEqual(blocos.map((b) => b.texto), ["DE", "1.000 REAIS", "POR", "197 REAIS"]);
  assert.deepEqual(blocos.map((b) => b.estilo), ["normal", "preco", "normal", "preco"]);
});

test("caso 7 da spec: numero que nao e preco fica no texto normal", () => {
  const blocos = seg("MAIS DE MIL HOMENS|");
  assert.equal(blocos.length, 1);
  assert.equal(blocos[0]?.texto, "MAIS DE MIL HOMENS");
  assert.equal(blocos[0]?.estilo, "normal");
});

test("o preco ocupa o tempo em que o valor e falado", () => {
  // "HOJE TÁ POR CENTO E NOVENTA E SETE": o valor comeca na palavra 3.
  const blocos = seg("HOJE TÁ POR CENTO E NOVENTA E SETE|");
  const preco = blocos[1];
  assert.equal(preco?.inicio, 3);
  assert.equal(preco?.fim, 8);
});

test("nenhum bloco mistura preco com texto normal", () => {
  for (const bloco of seg("A CONSULTA CUSTA MIL NOVECENTOS E NOVENTA E SETE|")) {
    const temReais = bloco.texto.includes("REAIS");
    assert.equal(temReais, bloco.estilo === "preco");
  }
});

test("preco de certeza media marca revisao", () => {
  const blocos = seg("POR CENTO E NOVENTA E SETE|");
  const preco = blocos.find((b) => b.estilo === "preco");
  assert.ok(preco);
  assert.equal(preco.precisaRevisao, true);
});
```

- [ ] **Step 2: Rodar o teste para ver falhar**

```bash
npm test
```

Esperado: FALHA — os blocos saem todos como `normal` e o preço não é isolado.

- [ ] **Step 3: Modificar `src/segmentar.ts`**

Acrescentar aos imports do topo:

```ts
import { detectarPrecos, textoDoPreco, type Preco } from "./preco.ts";
```

Acrescentar antes de `export function segmentar`:

```ts
/** Uma fatia de frase: texto normal, ou um preco que vira bloco sozinho. */
interface Fatia {
  readonly palavras: readonly PalavraRevisada[];
  readonly estilo: "normal" | "preco";
  /** Preenchido so quando `estilo` e "preco". */
  readonly preco: Preco | null;
}

/**
 * Parte a frase nos precos.
 *
 * Preco e hard boundary: mesmo que sobre um bloco de uma palavra so — "DE",
 * "POR" — o valor continua isolado. A spec fecha essa regra na secao 2.3.
 */
function fatiarPorPreco(frase: readonly PalavraRevisada[]): Fatia[] {
  const precos = detectarPrecos(frase.map((p) => nucleo(p.text).corpo));
  if (precos.length === 0) return [{ palavras: frase, estilo: "normal", preco: null }];

  const fatias: Fatia[] = [];
  let cursor = 0;

  for (const preco of precos) {
    if (preco.inicio > cursor) {
      fatias.push({ palavras: frase.slice(cursor, preco.inicio), estilo: "normal", preco: null });
    }
    fatias.push({ palavras: frase.slice(preco.inicio, preco.fim + 1), estilo: "preco", preco });
    cursor = preco.fim + 1;
  }

  if (cursor < frase.length) {
    fatias.push({ palavras: frase.slice(cursor), estilo: "normal", preco: null });
  }
  return fatias.filter((f) => f.palavras.length > 0);
}
```

Substituir o corpo de `segmentar` inteiro por:

```ts
export function segmentar(
  palavras: readonly PalavraRevisada[],
  cortes: readonly number[],
  preset: Preset = PRESET_PADRAO
): BlocoLegenda[] {
  void cortes; // usado a partir da Task 13
  const blocos: BlocoLegenda[] = [];

  for (const frase of emFrases(palavras, preset)) {
    for (const fatia of fatiarPorPreco(frase)) {
      if (fatia.estilo === "preco" && fatia.preco !== null) {
        // O preco nunca e partido: o texto vem da formatacao, nao das palavras.
        const bloco = montarBloco(fatia.palavras, "preco");
        blocos.push({
          ...bloco,
          texto: textoDoPreco(fatia.preco.valor),
          precisaRevisao: bloco.precisaRevisao || fatia.preco.certeza === "media",
          motivos:
            fatia.preco.certeza === "media"
              ? [...bloco.motivos, "contexto monetario incerto"]
              : bloco.motivos,
        });
        continue;
      }
      for (const parte of partir(fatia.palavras, preset)) {
        if (parte.length > 0) blocos.push(montarBloco(parte, "normal"));
      }
    }
  }

  return blocos;
}
```

- [ ] **Step 4: Rodar o teste para ver passar**

```bash
npm test
```

Esperado: os 6 testes novos passando, e os 10 da Task 10 continuando a passar.

**Diagnóstico:** se `caso 5` sair com três blocos em vez de quatro, `fatiarPorPreco` está perdendo a fatia entre os dois preços — conferir o `cursor`.

- [ ] **Step 5: Rodar o gate e commitar**

```bash
npm run verify
git add -A
git commit -m "feat: preco isolado em bloco proprio, com REAIS e ponto de milhar"
```

---

## Task 12: Vírgula pendurada e validação final

**Files:**
- Modify: `src/segmentar.ts`
- Modify: `tests/segmentar.test.ts` (acrescentar ao fim)

**Interfaces:**
- Consumes: `BlocoLegenda`, `segmentar` (Tasks 10, 11).
- Produces: `validar(blocos: readonly BlocoLegenda[]): string[]` — lista de violações, vazia quando está tudo certo.

- [ ] **Step 1: Escrever o teste**

Acrescentar ao fim de `tests/segmentar.test.ts`:

```ts
import { validar } from "../src/segmentar.ts";

test("caso 12 da spec: virgula na fronteira do bloco some", () => {
  const blocos = seg("SE VOCE CONTINUAR ASSIM, O PROBLEMA PODE PIORAR MUITO MESMO|");
  assert.ok(blocos.length > 1);
  for (const bloco of blocos) {
    assert.ok(!bloco.texto.endsWith(","), `bloco terminou em virgula: "${bloco.texto}"`);
  }
});

test("nenhum bloco comeca com virgula", () => {
  for (const bloco of seg("SE VOCE CONTINUAR ASSIM, O PROBLEMA PODE PIORAR MUITO MESMO|")) {
    assert.ok(!bloco.texto.startsWith(","));
  }
});

test("virgula no meio do bloco sobrevive", () => {
  const blocos = seg("ASSIM, PIORA|");
  assert.equal(blocos.length, 1);
  assert.equal(blocos[0]?.texto, "ASSIM, PIORA");
});

test("validar aprova uma saida correta", () => {
  assert.deepEqual(validar(seg("HOJE TÁ POR CENTO E NOVENTA E SETE|")), []);
});

test("validar reprova bloco com quebra de linha", () => {
  const violacoes = validar([
    { texto: "DUAS\nLINHAS", inicio: 0, fim: 1, estilo: "normal", precisaRevisao: false, motivos: [] },
  ]);
  assert.equal(violacoes.length, 1);
  assert.ok(violacoes[0]?.includes("linha"));
});

test("validar reprova preco misturado com texto normal", () => {
  const violacoes = validar([
    { texto: "CUSTA 197 REAIS", inicio: 0, fim: 1, estilo: "normal", precisaRevisao: false, motivos: [] },
  ]);
  assert.equal(violacoes.length, 1);
});

test("validar reprova bloco que estourou o orcamento", () => {
  const violacoes = validar([
    {
      texto: "UM BLOCO ABSURDAMENTE LONGO QUE JAMAIS CABERIA EM UMA LINHA SO",
      inicio: 0,
      fim: 1,
      estilo: "normal",
      precisaRevisao: false,
      motivos: [],
    },
  ]);
  assert.equal(violacoes.length, 1);
});
```

- [ ] **Step 2: Rodar o teste para ver falhar**

```bash
npm test
```

Esperado: FALHA — `validar` não existe, e a vírgula pendurada ainda aparece.

- [ ] **Step 3: Acrescentar a limpeza da vírgula em `src/segmentar.ts`**

Dentro de `montarBloco`, trocar a linha do `texto:` por:

```ts
    // Virgula pendurada na fronteira: o bloco seguinte ja e a pausa visual, e
    // a virgula fica orfa no fim da linha. A spec proibe na secao 11.1.
    texto: palavras
      .map((p) => p.text)
      .join(" ")
      .replace(/\s*\n\s*/g, " ")
      .replace(/[,;]+$/, "")
      .replace(/^[,;]+\s*/, "")
      .trim(),
```

Isso remove a vírgula do fim de TODO bloco. Quando a frase inteira couber num bloco só, não há fronteira e não há o que remover — a vírgula do meio nunca é tocada, porque a limpeza só olha as pontas.

- [ ] **Step 4: Acrescentar `validar` ao fim de `src/segmentar.ts`**

```ts
/**
 * Ultima barreira antes de escrever no Premiere.
 *
 * A spec e explicita na secao 7: nunca renderizar antes da validacao final.
 * Devolve a lista de violacoes; vazia significa liberado.
 */
export function validar(
  blocos: readonly BlocoLegenda[],
  preset: Preset = PRESET_PADRAO
): string[] {
  const violacoes: string[] = [];

  blocos.forEach((bloco, i) => {
    const onde = `bloco ${i + 1} ("${bloco.texto}")`;

    if (bloco.texto.includes("\n")) violacoes.push(`${onde}: tem quebra de linha`);
    if (bloco.texto.trim().length === 0) violacoes.push(`${onde}: vazio`);
    if (bloco.texto.length > preset.maxCaracteres) {
      violacoes.push(`${onde}: ${bloco.texto.length} caracteres, orcamento e ${preset.maxCaracteres}`);
    }
    if (bloco.texto.endsWith(",")) violacoes.push(`${onde}: termina em virgula`);
    if (bloco.estilo === "normal" && /\bREAIS\b/.test(bloco.texto)) {
      violacoes.push(`${onde}: preco misturado com texto normal`);
    }
    if (bloco.fim < bloco.inicio) violacoes.push(`${onde}: termina antes de comecar`);
  });

  return violacoes;
}
```

- [ ] **Step 5: Rodar o teste para ver passar**

```bash
npm test
```

Esperado: os 7 testes novos passando, e os 16 anteriores continuando a passar.

**Diagnóstico:** se `virgula no meio do bloco sobrevive` falhar, a expressão está removendo vírgula que não está na ponta — conferir a âncora `$` e `^`.

- [ ] **Step 6: Rodar o gate e commitar**

```bash
npm run verify
git add -A
git commit -m "feat: virgula de fronteira removida e validacao final dos blocos"
```

---

## Task 13: Harmonização com os cortes

**Files:**
- Modify: `src/segmentar.ts`
- Modify: `tests/segmentar.test.ts` (acrescentar ao fim)

**Interfaces:**
- Consumes: `BlocoLegenda`, `partir`, `segmentar` (Tasks 10 a 12).
- Produces: `segmentar` passa a usar o parâmetro `cortes`; remove o `void cortes`.

- [ ] **Step 1: Escrever o teste**

Acrescentar ao fim de `tests/segmentar.test.ts`:

```ts
test("com corte perto de uma quebra possivel, a quebra vai para o corte", () => {
  // Uma palavra por segundo. Sem corte, o orcamento parte em outro ponto.
  const frase = "VOCE PRECISA ENTENDER O QUE ESTA ACONTECENDO AGORA|";
  const semCorte = seg(frase);
  const comCorte = seg(frase, [3]);

  // Com o corte em 3s, existe um bloco que termina exatamente ali.
  assert.ok(comCorte.some((b) => b.fim === 3), "nenhum bloco terminou no corte");
  assert.notDeepEqual(comCorte.map((b) => b.texto), semCorte.map((b) => b.texto));
});

test("corte fora da tolerancia nao move a quebra", () => {
  const frase = "VOCE PRECISA ENTENDER O QUE ESTA ACONTECENDO AGORA|";
  assert.deepEqual(
    seg(frase, [100]).map((b) => b.texto),
    seg(frase).map((b) => b.texto)
  );
});

test("o corte nunca faz a legenda aparecer antes da fala", () => {
  const frase = "VOCE PRECISA ENTENDER O QUE ESTA ACONTECENDO AGORA|";
  for (const bloco of seg(frase, [3])) {
    assert.ok(bloco.inicio >= 0);
    assert.ok(bloco.fim > bloco.inicio);
  }
});

test("o corte nao pode estourar o orcamento de caracteres", () => {
  const frase = "VOCE PRECISA ENTENDER O QUE ESTA ACONTECENDO AGORA COM O SEU CORPO|";
  for (const bloco of seg(frase, [2, 5, 9])) {
    assert.ok(bloco.texto.length <= PRESET_PADRAO.maxCaracteres, `estourou: "${bloco.texto}"`);
  }
});

test("o corte nao perde nem duplica palavra", () => {
  const original = "VOCE PRECISA ENTENDER O QUE ESTA ACONTECENDO AGORA COM O SEU CORPO";
  assert.equal(seg(`${original}|`, [2, 5, 9]).map((b) => b.texto).join(" "), original);
});
```

- [ ] **Step 2: Rodar o teste para ver falhar**

```bash
npm test
```

Esperado: FALHA em `com corte perto de uma quebra possivel` — hoje `cortes` é ignorado.

- [ ] **Step 3: Modificar `partir` em `src/segmentar.ts`**

Substituir a função `partir` inteira por:

```ts
/**
 * Parte uma frase que nao cabe em uma linha.
 *
 * Guloso da esquerda: pega o maior prefixo que cabe, depois recua ate o melhor
 * ponto de quebra dentro do que cabe. Recuar importa — quebrar no limite exato
 * do orcamento separa artigo de substantivo e deixa bloco de uma palavra so.
 *
 * O corte de video entra aqui como preferencia, nunca como obrigacao: a ordem
 * de prioridade da secao 26 da spec poe timing da fala acima da harmonizacao
 * com cortes, e o orcamento de caracteres e hard constraint. Um corte fora do
 * que cabe simplesmente nao e considerado.
 */
function partir(
  frase: readonly PalavraRevisada[],
  preset: Preset,
  cortes: readonly number[] = []
): PalavraRevisada[][] {
  if (larguraDe(frase) <= preset.maxCaracteres) return [[...frase]];

  const partes: PalavraRevisada[][] = [];
  let resto = [...frase];

  while (resto.length > 0) {
    if (larguraDe(resto) <= preset.maxCaracteres) {
      partes.push(resto);
      break;
    }

    // Maior prefixo que cabe. Pelo menos uma palavra, sempre.
    let maximo = 1;
    for (let n = 1; n <= resto.length; n++) {
      if (larguraDe(resto.slice(0, n)) > preset.maxCaracteres) break;
      maximo = n;
    }

    let corte = maximo;
    let melhor = -Infinity;

    // Considera recuar ate a metade do prefixo. Menos que isso desperdicaria
    // linha; mais apertado que isso deixa cortes de video fora de alcance e a
    // harmonizacao nunca chega a acontecer.
    const minimo = Math.max(1, Math.ceil(maximo * 0.5));
    for (let n = minimo; n <= maximo; n++) {
      const ultima = resto[n - 1];
      const proxima = resto[n];
      if (ultima === undefined) continue;

      let nota = 0;

      // Quanto mais perto do limite, menos linha desperdicada.
      nota += (n / maximo) * 2;

      // Pontuacao ja e uma pausa: quebrar ali soa natural.
      if (/[.,;:!?]$/.test(ultima.text)) nota += 3;

      // Corte de video dentro da tolerancia: o diferencial do produto.
      const distanciaCorte = Math.min(
        ...cortes.map((c) => Math.abs(c - ultima.fim)),
        Infinity
      );
      if (distanciaCorte <= preset.toleranciaCorteSegundos) nota += 4;

      // Deixar uma palavra orfa no proximo bloco e feio.
      if (proxima !== undefined && resto.length - n === 1) nota -= 2;

      if (nota > melhor) {
        melhor = nota;
        corte = n;
      }
    }

    partes.push(resto.slice(0, corte));
    resto = resto.slice(corte);
  }

  return partes;
}
```

- [ ] **Step 4: Passar os cortes adiante em `segmentar`**

Em `src/segmentar.ts`, apagar a linha `void cortes;` e trocar a única chamada de `partir(...)`, que está dentro do ramo `normal` de `segmentar`:

```ts
      for (const parte of partir(fatia.palavras, preset, cortes)) {
```

- [ ] **Step 5: Rodar o teste para ver passar**

```bash
npm test
```

Esperado: os 5 testes novos passando, e os 23 anteriores continuando a passar.

**Diagnóstico:** se `o corte nao pode estourar o orcamento` falhar, o laço de recuo está indo além de `maximo`. Se `corte fora da tolerancia nao move a quebra` falhar, `Math.min(...[], Infinity)` com array vazio está retornando `NaN` — conferir que o `Infinity` extra está no `Math.min`.

- [ ] **Step 6: Rodar o gate completo**

```bash
npm run verify
```

Esperado: tipos limpos, 28 testes passando, build ok.

- [ ] **Step 7: Commit**

```bash
git add -A
git commit -m "feat: quebra de bloco harmonizada com os cortes da timeline"
```

---

## Cobertura da spec funcional

| Seção da spec | Onde é atendida |
|---|---|
| §2.1 uma linha | Task 10 (orçamento), Task 12 (`validar`) |
| §2.2 dois estilos | Task 11 (`estilo` como metadado; fonte é aplicada pelo usuário — D-02/D-03) |
| §2.3 preço sozinho | Task 11 |
| §3.1–3.3 formatação BRL | Tasks 5, 6 |
| §3.4 nem todo número é preço | Task 6 |
| §3.5 centavos | Fora do escopo: `porExtenso` só trata inteiro; valor com centavo não casa e fica texto normal |
| §4, §5 vocabulário protegido | Task 9 |
| §6 arquitetura de transcrição | Tasks 2, 3 |
| §7 ordem do pipeline | Tasks 7 a 13, nesta ordem |
| §8 coloquial | Task 7 |
| §9 porquês | Task 8 |
| §10 é/e | Task 8 |
| §11 pontuação | Task 12 |
| §12 segmentação | Tasks 10, 11, 13 |
| §13 largura | Task 5 (`maxCaracteres`) — decisão D-06 |
| §14 sincronização | Tasks 10, 11 (tempo em segundos, não ms) |
| §15, §16 cortes | Task 13 |
| §17 renderização | Task 4 (portão), e Fase 3 em plano separado |
| §19 preset | Task 5 |
| §20–§23 interface | Fase 3, plano separado. Tasks 1, 3, 4 entregam só o painel de diagnóstico |
| §24 fila de revisão | Tasks 9, 10, 11 alimentam `precisaRevisao`/`motivos`; a tela é da Fase 3 |
| §29 spikes A/B/C/E | Já provados no auto-broll; não refeitos |
| §29 spike D (MOGRT) | Cancelado com o MOGRT (D-01) |
| §35 casos 1 a 13 | Tasks 6 a 12, um teste por caso |
| §36 casos de timeline | Manuais: Task 4 Step 5, e Fase 3 |

**Fora deste plano, de propósito:** Fase 3 (painel de produção, prévia dos blocos, escrita com confirmação) e Fase 4 (fila de revisão na tela, ASR secundário). Cada uma ganha plano próprio depois que o portão da Task 4 tiver resultado.
