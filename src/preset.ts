/*
 * Config central. Nada de "magic number" espalhado pelo dominio.
 *
 * Os valores abaixo sao pontos de partida deliberados, nao verdades medidas.
 * Ajustar depois de ver saida real na tela.
 */

export interface Preset {
  /**
   * Orcamento de caracteres por bloco.
   *
   * A fonte da caption track e inacessivel pela API, entao largura real nao e
   * mensuravel. 32 e o ponto de partida para 1080x1920.
   */
  readonly maxCaracteres: number;
  /** Silencio maior que isto quebra a frase mesmo sem `eos`. */
  readonly pausaQuebraSegundos: number;
  /** Distancia maxima para encostar uma quebra de bloco num corte. */
  readonly toleranciaCorteSegundos: number;
  /** Termos que nao podem depender so da transcricao automatica. */
  readonly termosProtegidos: readonly string[];
  /** Faixa de video lida para cortes e transcricao. 0 = V1. */
  readonly trackDeCortes: number;
  readonly maiusculas: boolean;
}

export const PRESET_PADRAO: Preset = {
  maxCaracteres: 32,
  pausaQuebraSegundos: 1.5,
  toleranciaCorteSegundos: 0.25,
  termosProtegidos: ["Androclinic", "Cristiano Estivalet"],
  trackDeCortes: 0,
  maiusculas: true,
};
