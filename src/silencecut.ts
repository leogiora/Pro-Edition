/*
 * SilenceCut — o que a tela mostra e o contrato com o motor. Logica pura:
 * a mesma tela roda no painel (motor local, src/motor-pausas-local.ts) e no
 * programa (motor remoto, pela ponte). A fala vem da transcricao do proprio
 * Premiere: nao gasta ElevenLabs.
 */

import { pedacosDoPlano, planejarCortes, primeiraPalavra, ultimaPalavra, type Bloco, type ClipeNaTimeline } from "./pausas.ts";

/** Margens que a tela oferece (segundos de silencio de cada lado da palavra). */
export const MARGENS = [0.05, 0.08, 0.12, 0.2] as const;

/** Corte maior que isto e onde uma palavra nao transcrita pode estar escondida: pede conferencia. */
export const CONFIRA_S = 1;

export interface CorteVisto {
  readonly inicioS: number;
  readonly fimS: number;
  /** A palavra antes e a depois do corte. */
  readonly antes: string;
  readonly depois: string;
  readonly confira: boolean;
}

export interface Previa {
  readonly nomeSequencia: string;
  readonly antesS: number;
  readonly depoisS: number;
  readonly cortes: readonly CorteVisto[];
  readonly palavras: number;
  readonly clipes: number;
  /** Voz sem palavra ou palavra baixa que o corte protegeu. */
  readonly protegidos: number;
}

export interface Sequencia {
  readonly nome: string;
  readonly duracaoS: number;
  readonly clipes: number;
  readonly palavras: number;
}

export interface MotorPausas {
  ler(): Promise<Sequencia>;
  previa(margemS: number): Promise<Previa>;
  cortar(margemS: number, progresso: (texto: string) => void): Promise<{ ok: boolean; linhas: readonly string[] }>;
  desfazer(): Promise<readonly string[]>;
  /** Le o audio da bruta nova enquanto o Leo separa os videos; true = leu agora. */
  preparar(): Promise<boolean>;
  guardarLog(linhas: readonly string[]): Promise<void>;
}

/** A analise do Premiere (transcricao + audio) virada no que a tela mostra. */
export function montarPrevia(
  a: {
    readonly nomeSequencia: string;
    readonly fps: number;
    readonly duracaoQ: number;
    readonly clipes: number;
    readonly clipesQ: readonly ClipeNaTimeline[];
    readonly palavras: readonly unknown[];
    readonly blocos: readonly Bloco[];
  },
  margemS: number
): Previa {
  const plano = planejarCortes(a.blocos, { fps: a.fps, duracaoQ: a.duracaoQ, margemS });
  // A duracao final conta os espacos que o editor deixou entre os videos (eles ficam).
  const { totalQ } = pedacosDoPlano(plano.trechos, a.clipesQ);
  return {
    nomeSequencia: a.nomeSequencia,
    antesS: plano.duracaoAntesQ / a.fps,
    depoisS: totalQ / a.fps,
    cortes: plano.cortes.map((c) => ({
      inicioS: c.inicioQ / a.fps,
      fimS: c.fimQ / a.fps,
      antes: ultimaPalavra(c.antes),
      depois: primeiraPalavra(c.depois),
      confira: (c.fimQ - c.inicioQ) / a.fps > CONFIRA_S,
    })),
    palavras: a.palavras.length,
    clipes: a.clipes,
    protegidos: a.blocos.filter((b) => b.motivo !== "fala").length,
  };
}
