/*
 * Podcast AutoCut fora do Premiere: a sequencia sincronizada entra (V1/A1 =
 * pessoa A, V2/A2 = pessoa B), sai a mesma sequencia cortada nas quatro
 * trilhas nos mesmos quadros, com a camera e o microfone de quem NAO fala
 * desligados.
 *
 * A regra e a do painel, sem copia (src/autocut.ts da raiz): voz pelo nivel
 * de cada microfone, vazamento resolvido por dominancia, silencio e crosstalk
 * nao trocam de camera, plano curto e absorvido.
 *
 * Puro.
 */

import {
  CONFIG_NIVEL_PADRAO,
  CONFIG_PADRAO,
  cortes,
  decidir,
  falaPorNivel,
  MAPA_PADRAO,
  segmentar,
  speakerEm,
  type Config,
  type ConfigNivel,
  type Mapa,
  type Segmento,
  type Speaker,
} from "../../src/autocut.ts";
import { montarDaMidia } from "../../src/pausas.ts";
import { PISO_DB } from "../../src/wav.ts";
import type { Clipe, Sequencia } from "./xml.ts";

export { MAPA_PADRAO, type Mapa };

/** Janela do nivel, a mesma do Auto Pausas e do painel. */
export const JANELA_MS = 20;

/**
 * O nivel de uma trilha de audio no tempo da sequencia: cada clipe pega o
 * trecho do seu arquivo; espaco vazio e silencio.
 */
export function nivelDaTrilha(
  clipes: readonly Clipe[],
  fps: number,
  duracaoQ: number,
  niveisDoArquivo: (caminho: string) => readonly number[]
): number[] {
  const db = montarDaMidia(
    clipes.map((c) => [...niveisDoArquivo(c.midia.caminho)]),
    JANELA_MS / 1000,
    clipes.map((c, i) => ({ inicioQ: c.inicioQ, fimQ: c.fimQ, midiaQ: c.entradaQ, fonte: i })),
    fps,
    duracaoQ,
    PISO_DB
  );
  if (db === null) throw new Error("O áudio lido não cobre a sequência inteira. Algum arquivo está mais curto que o clipe?");
  return db;
}

/** Corta cada clipe nos quadros dados, com a entrada do arquivo acompanhando. */
export function cortarEm(clipes: readonly Clipe[], cortesQ: readonly number[]): Clipe[] {
  return clipes.flatMap((c) => {
    const dentro = cortesQ.filter((f) => f > c.inicioQ && f < c.fimQ);
    const bordas = [c.inicioQ, ...dentro, c.fimQ];
    return bordas.slice(0, -1).map((de, i) => ({ ...c, inicioQ: de, fimQ: bordas[i + 1]!, entradaQ: c.entradaQ + (de - c.inicioQ) }));
  });
}

export interface ResultadoPodcast {
  readonly sequencia: Sequencia;
  readonly segmentos: readonly Segmento[];
  /** Quantas vezes a camera troca. */
  readonly trocas: number;
  /** Tempo de tela de cada pessoa, em segundos. */
  readonly tempo: Readonly<Record<Speaker, number>>;
}

export function cortarPodcast(
  entrada: Sequencia,
  dbA: readonly number[],
  dbB: readonly number[],
  mapa: Mapa = MAPA_PADRAO,
  cfg: Config = CONFIG_PADRAO,
  cfgNivel: ConfigNivel = CONFIG_NIVEL_PADRAO
): ResultadoPodcast {
  const { a, b } = falaPorNivel(dbA, dbB, JANELA_MS, cfgNivel);
  const segmentos = segmentar(decidir(a, b, cfg), entrada.fps);
  if (segmentos.length === 0) throw new Error("Nenhuma voz reconhecida nos dois microfones.");
  const cortesQ = cortes(segmentos);

  // O estado de cada pedaco deriva de quem fala nele: o invariante do spec
  // (mesma pessoa, mesmo estado; pessoas em estados opostos) nao tem como divergir.
  const trilha = (clipes: readonly Clipe[], dono: Speaker): Clipe[] =>
    cortarEm(clipes, cortesQ).map((c) => {
      const quem = speakerEm(segmentos, c.inicioQ);
      return quem === null ? c : { ...c, ativo: quem === dono };
    });

  const video = entrada.video.map((t, i) => (i === mapa.videoA ? trilha(t, "A") : i === mapa.videoB ? trilha(t, "B") : t));
  const audio = entrada.audio.map((t, i) => (i === mapa.audioA ? trilha(t, "A") : i === mapa.audioB ? trilha(t, "B") : t));

  const tempo = { A: 0, B: 0 };
  for (const s of segmentos) tempo[s.speaker] += (s.fimF - s.inicioF) / entrada.fps;

  return {
    sequencia: { ...entrada, nome: `${entrada.nome} cortado`, video, audio },
    segmentos,
    trocas: segmentos.length - 1,
    tempo,
  };
}
