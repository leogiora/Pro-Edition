/*
 * Painel do Auto Pausas. So orquestra: le, mostra, chama o adapter.
 *
 * `root` chega mas nao e usado para escopar busca de elemento: o shell
 * substitui document.body inteiro antes de cada mount(), entao nunca ha duas
 * telas no mesmo documento. Se isso mudar, este arquivo muda junto.
 */

import { MARGEM_PADRAO_S } from "../pausas.ts";

/** O campo aceita virgula (teclado pt-BR) e ponto. Vazio volta ao padrao. */
export function lerMargem(bruto: string): number {
  const n = Number(bruto.trim().replace(",", "."));
  return Number.isFinite(n) && n >= 0 && n <= 1 ? n : MARGEM_PADRAO_S;
}

export function mount(root: HTMLElement): void {
  const pega = <T extends HTMLElement>(id: string): T => root.querySelector<T>(`#${id}`)!;
  const log = pega<HTMLPreElement>("apLog");
  const escrever = (...linhas: readonly string[]) => {
    log.textContent = linhas.join("\n");
    log.scrollTop = log.scrollHeight;
  };

  escrever("Abra esta tela dentro do Premiere para ler a sequência.");

  pega("apCortar").addEventListener("click", () => {
    escrever("Ainda não ligado ao Premiere (Task 4).");
  });
}
