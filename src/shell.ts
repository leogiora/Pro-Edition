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
