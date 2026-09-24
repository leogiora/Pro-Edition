/*
 * Build do programa: tres pacotes do esbuild em dist/.
 *   main.cjs     processo principal (Node + Electron)
 *   preload.cjs  ponte entre a tela e o motor
 *   index.html   a tela, com CSS e JS embutidos (um arquivo so, como o painel)
 */

import { build } from "esbuild";
import { copyFile, mkdir, readFile, rm, writeFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const raiz = dirname(dirname(fileURLToPath(import.meta.url)));
const dist = join(raiz, "dist");

await rm(dist, { recursive: true, force: true });
await mkdir(dist, { recursive: true });

const node = { bundle: true, platform: "node", format: "cjs", target: "node22", external: ["electron"], logLevel: "warning" };
await build({ ...node, entryPoints: [join(raiz, "src", "main.ts")], outfile: join(dist, "main.cjs") });
await build({ ...node, entryPoints: [join(raiz, "src", "preload.ts")], outfile: join(dist, "preload.cjs") });

const tela = await build({
  entryPoints: [join(raiz, "src", "ui", "main.ts")],
  bundle: true,
  format: "iife",
  platform: "browser",
  target: "chrome130",
  write: false,
  logLevel: "warning",
});
const js = tela.outputFiles[0].text;
const css = await readFile(join(raiz, "src", "ui", "styles.css"), "utf8");
const html = await readFile(join(raiz, "src", "ui", "index.html"), "utf8");
for (const marca of ["<!--STYLE-->", "<!--SCRIPT-->"]) {
  if (!html.includes(marca)) throw new Error(`index.html perdeu a marca ${marca}`);
}
await writeFile(
  join(dist, "index.html"),
  html
    .replace("<!--STYLE-->", () => `<style>\n${css}</style>`)
    .replace("<!--SCRIPT-->", () => `<script>\n${js.replace(/<\/script/gi, "<\\/script")}</script>`),
  "utf8"
);
await copyFile(join(raiz, "..", "icons", "icon.png"), join(dist, "icon.png"));

console.log(`programa construido em ${dist}`);
