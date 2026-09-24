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
