/*
 * B-Roller — o contrato entre a tela e o motor. A mesma tela roda no painel
 * (motor local, motor-local.ts) e no programa (motor remoto, pela ponte).
 * Sem import do Premiere: o programa importa daqui so os tipos.
 */

import type { Config } from "./domain.ts";

export type TomBroll = "passo" | "ok" | "erro" | "aviso" | "vazio";
export type RegistrarBroll = (texto: string, tom?: TomBroll) => void;

/** Um B-roll na timeline, em segundos da sequencia. */
export interface TrechoBroll {
  readonly inicio: number;
  readonly fim: number;
  readonly arquivo: string;
}

export interface EstadoBroll {
  readonly nome: string;
  readonly duracaoS: number;
  readonly formato: string;
  readonly fps: number;
  /** O que ja esta acima da V1. */
  readonly naTimeline: readonly TrechoBroll[];
}

export interface Inserido extends TrechoBroll {
  readonly frase: string;
}

export interface ResultadoBroll {
  readonly nome: string;
  readonly duracaoS: number;
  readonly naPasta: number;
  /** O que ja estava acima da V1 antes desta rodada. */
  readonly naTimeline: readonly TrechoBroll[];
  readonly inseridos: readonly Inserido[];
}

export interface MotorBroll {
  /** Configuracao salva + dicionario e merge do aprendizado canonico (contados no registro). */
  iniciar(registrar: RegistrarBroll): Promise<Config>;
  ler(): Promise<EstadoBroll>;
  analisar(config: Config, registrar: RegistrarBroll): Promise<ResultadoBroll>;
  aprender(config: Config, registrar: RegistrarBroll): Promise<void>;
}
