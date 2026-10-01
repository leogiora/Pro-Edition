/*
 * Logica pura de troca de tela do shell — sem DOM, sem Premiere. O que toca
 * document.body mora em src/ui/main.ts (Task 6); aqui so o que da para
 * testar sem UXP.
 */

export type Ferramenta = "seletor" | "editar" | "pausas" | "broll" | "captions" | "autocut" | "autosplit";

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
        `<span class="trilha" data-faixa="${rotulo}"><span class="trilha-rotulo">${rotulo}</span>` +
        `<span class="trilha-faixa">${segmentos.join("")}</span></span>`
      );
    })
    .join("");
}

export type Icone = "pausas" | "broll" | "split" | "leak" | "trilha" | "legendas" | "podcast";

/**
 * Icones desenhados com caixas, sem fonte nem emoji: o UXP trocava o ✂ por um
 * emoji colorido e cada caractere vinha de uma fonte diferente. Caixa com
 * borda e fundo o UXP desenha sempre igual. 14x14 px, na cor pedida.
 */
export function icone(tipo: Icone, cor: string): string {
  const c = (estilo: string): string => `<span style="display: flex; flex: none; ${estilo}"></span>`;
  const linha = (dentro: string, alinha = "center"): string =>
    `<span style="display: flex; flex-direction: row; align-items: ${alinha}; justify-content: center; width: 14px; height: 14px">${dentro}</span>`;
  const coluna = (dentro: string): string =>
    `<span style="display: flex; flex-direction: column; align-items: center; justify-content: center; width: 14px; height: 14px">${dentro}</span>`;
  const barra = (l: number, a: number, m = "0 1px"): string => c(`width: ${l}px; height: ${a}px; margin: ${m}; background-color: ${cor}; border-radius: 1px`);
  const caixa = (l: number, a: number, m = "0"): string => c(`width: ${l}px; height: ${a}px; margin: ${m}; border: 2px solid ${cor}; border-radius: 2px`);
  switch (tipo) {
    case "pausas": // pausa: duas barras
      return linha(barra(3, 11, "0 1.5px") + barra(3, 11, "0 1.5px"));
    case "broll": // um quadro
      return linha(caixa(10, 8));
    case "split": // tela dividida: quadro em cima, cheio embaixo
      return coluna(caixa(10, 3, "0 0 2px 0") + barra(14, 5, "0"));
    case "leak": // brilho: anel com ponto
      return linha(c(`width: 8px; height: 8px; border: 2px solid ${cor}; border-radius: 6px; background-color: ${cor}`));
    case "trilha": // equalizador
      return linha(barra(2, 6) + barra(2, 12) + barra(2, 8) + barra(2, 10), "flex-end");
    case "legendas": // duas linhas de texto
      return coluna(barra(13, 2, "0 0 3px 0") + barra(9, 2, "0"));
    case "podcast": // duas cameras
      return linha(caixa(4, 8, "0 1px") + caixa(4, 8, "0 1px"));
  }
}

/**
 * O simbolo do Cutline (marca/cutline-simbolo-pequeno-*.svg) feito de caixas,
 * para o topo do painel: o UXP nao garante SVG. Tres faixas cortadas no meio e
 * o cursor coral em cima (triangulo em fatias, sem truque de borda).
 */
export function marca(altura: number, faixa = "#eceef2", cursor = "#ff7d71"): string {
  const s = altura / 256;
  const px = (v: number): string => `${(v * s).toFixed(2)}px`;
  const caixa = (l: number, a: number, estilo = ""): string =>
    `<span style="display: flex; flex: none; width: ${px(l)}; height: ${px(a)}; ${estilo}"></span>`;
  const linha = (dentro: string, topo: number): string =>
    `<span style="display: flex; flex-direction: row; flex: none; margin-top: ${px(topo)}">${dentro}</span>`;
  const r = px(22);
  const barra = (l: number, lado: "esq" | "dir"): string =>
    caixa(l, 44, `background-color: ${faixa}; ${lado === "esq" ? `border-top-left-radius: ${r}; border-bottom-left-radius: ${r}` : `border-top-right-radius: ${r}; border-bottom-right-radius: ${r}`}`);
  // cursor: 4 fatias de 9 unidades, de 56 a 14 de largura, centradas em 128
  const fatias = [56, 42, 28, 14]
    .map((l, i) => linha(caixa(128 - l / 2, 9) + caixa(l, 9, `background-color: ${cursor}`), i === 0 ? 18 : 0))
    .join("");
  const faixas = (
    [
      [28, 196, 12],
      [64, 228, 16],
      [44, 212, 16],
    ] as const
  )
    .map(([a, b, topo]) => linha(caixa(a, 44) + barra(116 - a, "esq") + caixa(24, 44) + barra(b - 140, "dir"), topo))
    .join("");
  return `<span style="display: flex; flex-direction: column; flex: none; width: ${px(256)}; height: ${px(256)}">${fatias}${faixas}</span>`;
}

/** Pedaco de uma faixa da timeline viva: `item` -1 e vazio. */
export interface Segmento {
  readonly grow: number;
  readonly de: number;
  readonly item: number;
}

/**
 * A faixa da timeline viva como a miniatura do hall: pedacos com flex-grow,
 * sem largura em %. `grow` em centesimos de segundo, inteiro como no hall. O
 * que encosta no anterior comeca onde ele acaba; o que passa de `dur` e aparado.
 */
export function segmentos(itens: ReadonlyArray<{ readonly de: number; readonly ate: number }>, dur: number): Segmento[] {
  const saida: Segmento[] = [];
  const cs = (s: number): number => Math.round(s * 100);
  let t = 0;
  const ordem = itens.map((x, item) => ({ ...x, item })).sort((a, b) => a.de - b.de);
  for (const x of ordem) {
    const de = Math.max(x.de, t);
    const ate = Math.min(x.ate, dur);
    if (cs(ate) <= cs(de)) continue;
    if (cs(de) > cs(t)) saida.push({ grow: cs(de) - cs(t), de: t, item: -1 });
    saida.push({ grow: cs(ate) - cs(de), de, item: x.item });
    t = ate;
  }
  if (cs(dur) > cs(t)) saida.push({ grow: cs(dur) - cs(t), de: t, item: -1 });
  return saida;
}

/**
 * Extrai o miolo do <body> de um painel standalone (ferramentas/auto-broll ou
 * ferramentas/pro-captions) para injetar em document.body do shell — nunca o documento
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
