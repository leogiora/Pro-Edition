/*
 * B-Roller — o contrato entre a tela e o motor. A mesma tela roda no painel
 * (motor local, motor-local.ts) e no programa (motor remoto, pela ponte).
 * Sem import do Premiere: o programa importa daqui so os tipos.
 */

import type { Config } from "./domain.ts";

export type TomBroll = "passo" | "ok" | "erro" | "aviso" | "vazio";
export type RegistrarBroll = (texto: string, tom?: TomBroll) => void;
/** 0 fala, 1 casar, 2 take, 3 inserir. */
export type AndamentoBroll = (etapa: number, texto: string) => void;

/** Um B-roll na timeline, em segundos da sequencia. */
export interface TrechoBroll {
  readonly inicio: number;
  readonly fim: number;
  readonly arquivo: string;
}

/** O que voce ja ensinou, somado: arquivos mantidos e apagados, ligacoes firmes. */
export interface Aprendizado {
  readonly mantidos: number;
  readonly apagados: number;
  readonly ligacoes: number;
}

export interface EstadoBroll {
  readonly nome: string;
  readonly duracaoS: number;
  readonly formato: string;
  readonly fps: number;
  /** O que ja esta acima da V1. */
  readonly naTimeline: readonly TrechoBroll[];
  /** Videos na pasta; null quando a pasta nao foi informada ou nao abriu. */
  readonly naPasta: number | null;
  readonly clipesV1: number;
  /** Midias da V1 e quantas tem transcricao do Premiere. */
  readonly midias: number;
  readonly comTranscricao: number;
  readonly aprendizado: Aprendizado;
}

export interface Inserido extends TrechoBroll {
  readonly frase: string;
  readonly conceito: string;
  /** 0 a 1. */
  readonly nota: number;
  readonly termos: readonly string[];
  readonly motivo: string;
  /** Entrou por uma ligacao que voce ensinou. */
  readonly ensinado: boolean;
  /** Quantas vezes voce ja manteve este arquivo. */
  readonly mantidoVezes: number;
}

export interface ResultadoBroll {
  readonly nome: string;
  readonly duracaoS: number;
  readonly naPasta: number;
  /** O que ja estava acima da V1 antes desta rodada. */
  readonly naTimeline: readonly TrechoBroll[];
  readonly inseridos: readonly Inserido[];
  /** Frases com oportunidade que ficaram sem B-roll bom. */
  readonly semBroll: number;
  readonly aprendizado: Aprendizado;
  /** O que esta rodada aprendeu da anterior. */
  readonly nestaRodada: { readonly mantidos: number; readonly apagados: number };
}

export interface MotorBroll {
  /** Configuracao salva + dicionario e merge do aprendizado canonico (contados no registro). */
  iniciar(registrar: RegistrarBroll): Promise<Config>;
  ler(pasta: string): Promise<EstadoBroll>;
  analisar(config: Config, registrar: RegistrarBroll, andamento: AndamentoBroll): Promise<ResultadoBroll>;
  aprender(config: Config, registrar: RegistrarBroll): Promise<void>;
  /** Leva o cursor do Premiere ate o segundo pedido. */
  irPara(segundos: number): Promise<void>;
  /** Tira o B-roll da timeline; a proxima analise conta como apagado. */
  tirar(b: Inserido, config: Config): Promise<void>;
  /** Troca pelo proximo take do mesmo conceito; o rejeitado conta como apagado. */
  trocar(b: Inserido, config: Config): Promise<Inserido>;
}
