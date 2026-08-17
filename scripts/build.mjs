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
