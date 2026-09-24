/*
 * A fala de uma sequencia montada: as palavras de cada arquivo (tempo de
 * midia) levadas para o tempo da sequencia pelos clipes da V1.
 *
 * Toda ferramenta que trabalha sobre a sequencia do Leo precisa disto — e a
 * transcricao de cada arquivo e paga uma vez so, nao importa quantas vezes
 * ele recorte a timeline.
 *
 * Puro.
 */

import type { PalavraEditada } from "../../ferramentas/pro-captions/src/transcript.ts";
import type { Clipe } from "./xml.ts";

/**
 * Fica a palavra que COMECA dentro do trecho do clipe; o fim e aparado no fim
 * do clipe. Palavra de duracao zero sai (entraria como pausa de graca).
 */
export function palavrasNaSequencia(
  v1: readonly Clipe[],
  fps: number,
  falaDoArquivo: (caminho: string) => readonly PalavraEditada[]
): PalavraEditada[] {
  return [...v1]
    .sort((a, b) => a.inicioQ - b.inicioQ)
    .flatMap((c) => {
      const de = c.entradaQ / fps;
      const ate = (c.entradaQ + c.fimQ - c.inicioQ) / fps;
      const desloca = c.inicioQ / fps - de;
      return falaDoArquivo(c.midia.caminho)
        .filter((p) => p.fim > p.inicio && p.inicio >= de && p.inicio < ate)
        .map((p) => ({ ...p, inicio: p.inicio + desloca, fim: Math.min(p.fim, ate) + desloca }));
    });
}
