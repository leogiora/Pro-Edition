/*
 * Auto Pausas — logica pura. Sem DOM, sem Premiere, roda no node --test.
 *
 * A regra inteira mora aqui: onde cortar, quanto sobra de margem e onde cada
 * trecho que fica passa a comecar. O adapter so executa o que este arquivo
 * decidiu — e e por isso que da para testar o corte sem abrir o Premiere.
 */

/** Palavra da transcricao ja em tempo de SEQUENCIA (segundos). */
export interface Palavra {
  readonly texto: string;
  readonly inicio: number;
  readonly fim: number;
}

/** Um pedaco que sai. `antes`/`depois` sao as palavras vizinhas (vazio na borda). */
export interface Corte {
  readonly inicioQ: number;
  readonly fimQ: number;
  readonly antes: string;
  readonly depois: string;
}

/** Um pedaco que fica, e para onde ele vai depois que a timeline fecha. */
export interface TrechoMantido {
  readonly inicioQ: number;
  readonly fimQ: number;
  readonly destinoQ: number;
}

export interface Plano {
  readonly trechos: readonly TrechoMantido[];
  readonly cortes: readonly Corte[];
  readonly duracaoAntesQ: number;
  readonly duracaoDepoisQ: number;
}

/** Deixa ~0,16 s entre frases. Calibrado com anuncio real na Task 7. */
export const MARGEM_PADRAO_S = 0.08;

/** Abaixo disso o corte so da tranco na imagem sem ganhar tempo. */
export const MIN_CORTE_QUADROS = 2;

export interface OpcoesPlano {
  readonly fps: number;
  readonly duracaoQ: number;
  readonly margemS: number;
}

export function planejarCortes(palavras: readonly Palavra[], opcoes: OpcoesPlano): Plano {
  const { fps, duracaoQ, margemS } = opcoes;
  if (!(fps > 0)) throw new Error(`fps invalido: ${fps}`);
  if (!(duracaoQ > 0)) throw new Error(`duracao invalida: ${duracaoQ}`);

  if (palavras.length === 0) {
    return { trechos: [], cortes: [], duracaoAntesQ: duracaoQ, duracaoDepoisQ: duracaoQ };
  }

  const emOrdem = [...palavras].sort((a, b) => a.inicio - b.inicio);
  const cortes: Corte[] = [];

  // Arredondar SEMPRE para dentro da pausa: o comeco sobe, o fim desce. E o que
  // garante que o corte nunca entra numa palavra.
  const inicioDoCorte = (segundos: number) => Math.ceil(segundos * fps);
  const fimDoCorte = (segundos: number) => Math.floor(segundos * fps);

  const juntar = (inicioQ: number, fimQ: number, antes: string, depois: string) => {
    const dentro = { inicio: Math.max(0, inicioQ), fim: Math.min(duracaoQ, fimQ) };
    if (dentro.fim - dentro.inicio < MIN_CORTE_QUADROS) return;
    cortes.push({ inicioQ: dentro.inicio, fimQ: dentro.fim, antes, depois });
  };

  const primeira = emOrdem[0]!;
  juntar(0, fimDoCorte(primeira.inicio - margemS), "", primeira.texto);

  // `fimMaximo` e nao `p.fim`: com palavras sobrepostas, o fim da anterior pode
  // cair depois do fim da seguinte, e a conta viraria um corte ao contrario.
  let fimMaximo = primeira.fim;
  for (let i = 0; i + 1 < emOrdem.length; i++) {
    const p = emOrdem[i]!;
    const q = emOrdem[i + 1]!;
    fimMaximo = Math.max(fimMaximo, p.fim);
    juntar(inicioDoCorte(fimMaximo + margemS), fimDoCorte(q.inicio - margemS), p.texto, q.texto);
  }

  const ultima = emOrdem[emOrdem.length - 1]!;
  juntar(inicioDoCorte(Math.max(fimMaximo, ultima.fim) + margemS), duracaoQ, ultima.texto, "");

  // O que sobra entre um corte e o outro e o que fica, colado a partir do zero.
  const trechos: TrechoMantido[] = [];
  let cursor = 0;
  let destino = 0;
  const guardar = (inicioQ: number, fimQ: number) => {
    if (fimQ <= inicioQ) return;
    trechos.push({ inicioQ, fimQ, destinoQ: destino });
    destino += fimQ - inicioQ;
  };
  for (const corte of cortes) {
    guardar(cursor, corte.inicioQ);
    cursor = corte.fimQ;
  }
  guardar(cursor, duracaoQ);

  return { trechos, cortes, duracaoAntesQ: duracaoQ, duracaoDepoisQ: destino };
}
