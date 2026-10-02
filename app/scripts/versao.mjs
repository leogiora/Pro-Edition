/*
 * A versao do Cutline: "0.2" do package.json + o numero de commits do repo.
 * Cada atualizacao que sobe para o git aumenta o ultimo numero sozinha.
 */

import { execSync } from "node:child_process";
import { readFileSync } from "node:fs";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const raiz = dirname(dirname(fileURLToPath(import.meta.url)));

export function versao() {
  const [maior, menor] = JSON.parse(readFileSync(join(raiz, "package.json"), "utf8")).version.split(".");
  let commits = "0";
  try {
    commits = execSync("git rev-list --count HEAD", { cwd: raiz, encoding: "utf8" }).trim();
  } catch {
    // copia sem git: fica 0
  }
  return `${maior}.${menor}.${commits}`;
}
