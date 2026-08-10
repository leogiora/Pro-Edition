/*
 * Painel. Nao chama `premierepro` direto: fala com src/premiere.ts.
 * Nesta tarefa ainda nao ha leitura — so a prova de que o painel carrega e o
 * script roda.
 */

// `export {}` faz deste arquivo um modulo. Sem isso ele e script global e o
// `declare` abaixo colide com o `require` do @types/node.
export {};

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
