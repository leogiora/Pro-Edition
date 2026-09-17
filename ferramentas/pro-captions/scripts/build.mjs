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
