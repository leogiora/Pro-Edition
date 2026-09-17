/*
 * Logica pura de troca de tela do shell — sem DOM, sem Premiere. O que toca
 * document.body mora em src/ui/main.ts (Task 6); aqui so o que da para
 * testar sem UXP.
 */

export type Ferramenta = "seletor" | "broll" | "captions" | "autocut" | "autosplit";

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

const SEGMENTO: Readonly<Record<string, string>> = { "#": "novo", "=": "base", "-": "vazio" };

/**
 * Desenha a miniatura de timeline de um card do hall a partir de uma notacao
 * que se le como a propria timeline: `"V2 --##---#|V1 ========"`.
 *
 * `#` = clipe que a ferramenta cria ou ajusta, `=` = clipe que ja estava na
 * sequencia, `-` = vazio. Cada sequencia de caracteres iguais vira um segmento
 * com flex-grow do tamanho dela — sem largura em %, so o flex que o UXP ja
 * provou que respeita.
 */
export function desenharTrilhas(notacao: string): string {
  const linhas = notacao.split("|").map((linha) => linha.trim().split(/\s+/));
  // Trilhas de tamanhos diferentes desalinham os cortes entre V1 e V2 sem erro nenhum.
  if (new Set(linhas.map(([, faixa = ""]) => faixa.length)).size > 1) {
    throw new Error(`Trilhas "${notacao}" com tamanhos diferentes`);
  }
  return linhas
    .map(([rotulo, faixa = ""]) => {
      const segmentos = (faixa.match(/(.)\1*/g) ?? []).map((trecho) => {
        const tipo = SEGMENTO[trecho[0]!];
        if (!tipo) throw new Error(`Trilha "${rotulo}": caractere "${trecho[0]}" nao existe na notacao`);
        return `<span class="seg seg-${tipo}" style="flex-grow: ${trecho.length}"></span>`;
      });
      return (
        `<span class="trilha"><span class="trilha-rotulo">${rotulo}</span>` +
        `<span class="trilha-faixa">${segmentos.join("")}</span></span>`
      );
    })
    .join("");
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
