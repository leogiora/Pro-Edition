/* O instalador sai com a mesma versao que a tela mostra (scripts/versao.mjs). */

import { execSync } from "node:child_process";
import { dirname } from "node:path";
import { fileURLToPath } from "node:url";
import { versao } from "./versao.mjs";

const v = versao();
execSync(`npx electron-builder --win nsis -c.extraMetadata.version=${v}`, {
  cwd: dirname(dirname(fileURLToPath(import.meta.url))),
  stdio: "inherit",
});
console.log(`instalador do Cutline ${v} em release/`);
