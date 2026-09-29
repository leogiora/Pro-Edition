/*
 * Editar — logica pura do botao que encadeia tudo. Sem DOM, sem Premiere.
 *
 * O botao transcreve a sequencia UMA vez (ElevenLabs, no audio que o proprio
 * painel exporta) e essa fala serve a todas as etapas. Depois que o Auto
 * Pausas corta, a fala precisa acompanhar os pedacos para a legenda e o B-roll
 * cairem no lugar certo — e isso que mora aqui.
 */

import type { PalavraEditada } from "../ferramentas/pro-captions/src/transcript.ts";
import type { Pedaco } from "./pausas.ts";

/** Um trecho continuo da V1: o espaco que o Leo deixa entre os videos separa as variacoes. */
export interface Variacao {
  readonly inicioQ: number;
  readonly fimQ: number;
}

/** Buraco na V1 a partir disto separa duas variacoes (os cortes do Auto Pausas sao colados). */
export const SEPARACAO_S = 1;

export function variacoes(clipes: ReadonlyArray<{ readonly inicioQ: number; readonly fimQ: number }>, fps: number): Variacao[] {
  const saida: Variacao[] = [];
  for (const c of [...clipes].sort((a, b) => a.inicioQ - b.inicioQ)) {
    const ultima = saida[saida.length - 1];
    if (ultima !== undefined && c.inicioQ - ultima.fimQ < SEPARACAO_S * fps) {
      saida[saida.length - 1] = { inicioQ: ultima.inicioQ, fimQ: Math.max(ultima.fimQ, c.fimQ) };
    } else {
      saida.push({ inicioQ: c.inicioQ, fimQ: c.fimQ });
    }
  }
  return saida;
}

/**
 * A fala depois do corte. Fica a palavra que COMECA dentro de um pedaco; ela
 * anda junto com ele, e o fim e aparado no fim do pedaco. Tempo em segundos,
 * pedacos em quadros.
 */
export function moverPalavras(palavras: readonly PalavraEditada[], pedacos: readonly Pedaco[], fps: number): PalavraEditada[] {
  const saida: PalavraEditada[] = [];
  for (const p of pedacos) {
    const de = p.origemQ / fps;
    const ate = (p.origemQ + p.midiaAteQ - p.midiaDeQ) / fps;
    const anda = p.destinoQ / fps - de;
    for (const w of palavras) {
      if (w.inicio < de || w.inicio >= ate) continue;
      saida.push({ ...w, inicio: w.inicio + anda, fim: Math.min(w.fim, ate) + anda });
    }
  }
  return saida.sort((a, b) => a.inicio - b.inicio);
}

/** Onde a imagem corta depois do Auto Pausas, em segundos: a legenda evita atravessar. */
export function cortesDosPedacos(pedacos: readonly Pedaco[], fps: number): number[] {
  return pedacos.slice(1).map((p) => p.destinoQ / fps);
}

/**
 * Light leak em cada troca doutor <-> B-roll, como o Leo monta: o leak inteiro
 * (0,84 s no Premiere Composer) comecando 0,36 s antes da borda. Medido nas 79
 * bordas das variacoes 1-6 do Andro 19.09 (29/09): 77 exatas; nenhum leak entre
 * dois B-rolls colados (28 de 28) nem no comeco ou fim da variacao (5 de 5).
 */
export const LEAK_ANTES_S = 0.36;
export const LEAK_S = 0.84;

/**
 * Onde cada leak comeca, em segundos, arredondado para o quadro e em ordem.
 * Pula a borda cujo leak cairia em cima de algo que ja esta em `ocupado` (a
 * faixa do leak): o que o Leo ja pos fica, e rodar duas vezes nao duplica. Dois
 * leaks novos que se encostam entram os dois: inseridos em ordem, o seguinte
 * come o fim do anterior, como o Leo faz (B-roll que sai e outro entrando 0,8 s
 * depois).
 */
export function inicioDosLeaks(
  brolls: ReadonlyArray<{ readonly inicio: number; readonly fim: number }>,
  vars: readonly Variacao[],
  fps: number,
  ocupado: ReadonlyArray<{ readonly inicio: number; readonly fim: number }> = []
): number[] {
  const meioQuadro = 0.5 / fps;
  const perto = (a: number, b: number): boolean => Math.abs(a - b) < meioQuadro;
  const saida: number[] = [];
  for (const x of brolls.flatMap((b) => [b.inicio, b.fim]).sort((a, b) => a - b)) {
    const colada = brolls.filter((b) => perto(b.inicio, x) || perto(b.fim, x)).length > 1;
    const ponta = vars.some((v) => perto(v.inicioQ / fps, x) || perto(v.fimQ / fps, x));
    const inicio = Math.round((x - LEAK_ANTES_S) * fps) / fps;
    const fim = inicio + LEAK_S;
    if (colada || ponta || ocupado.some((o) => inicio < o.fim - meioQuadro && o.inicio < fim - meioQuadro)) continue;
    saida.push(inicio);
  }
  return saida;
}

/** B-roll mais curto que isto, depois de aparado no fim do doutor, nem entra. */
export const BROLL_MINIMO_S = 1;

/**
 * B-roll termina junto com o doutor: o que passa do fim da variacao e
 * aparado; o que comeca fora de qualquer variacao (no espaco entre videos) ou
 * sobra curto demais sai, com motivo.
 */
export function dentroDasVariacoes<T extends { readonly inicio: number; readonly duracao: number; readonly arquivo: string }>(
  colocacoes: readonly T[],
  vars: readonly Variacao[],
  fps: number
): { ficam: T[]; aparados: number; fora: string[] } {
  const ficam: T[] = [];
  const fora: string[] = [];
  let aparados = 0;
  for (const c of colocacoes) {
    const v = vars.find((x) => c.inicio * fps >= x.inicioQ && c.inicio * fps < x.fimQ);
    if (v === undefined) {
      fora.push(`${c.arquivo}: cairia no espaço entre vídeos`);
      continue;
    }
    const fim = v.fimQ / fps;
    if (c.inicio + c.duracao <= fim) {
      ficam.push(c);
      continue;
    }
    const duracao = fim - c.inicio;
    if (duracao < BROLL_MINIMO_S) {
      fora.push(`${c.arquivo}: sobraria ${duracao.toFixed(1)} s antes do fim do vídeo`);
      continue;
    }
    aparados++;
    ficam.push({ ...c, duracao });
  }
  return { ficam, aparados, fora };
}
