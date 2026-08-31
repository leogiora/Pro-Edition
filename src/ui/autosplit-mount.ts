/*
 * Painel do Auto Split. So orquestra: le a sequencia, mostra, e chama o
 * adapter. Nenhuma chamada a `premierepro` mora aqui.
 *
 * `root` chega mas nao e usado para escopar busca de elemento: o shell
 * substitui document.body inteiro antes de cada mount(), entao nunca ha duas
 * telas no mesmo documento. Se isso mudar, este arquivo muda junto.
 */

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
