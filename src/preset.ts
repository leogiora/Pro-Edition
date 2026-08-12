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
   * Medido na tela em 2026-08-11 com o estilo obrigatorio (Bebas Neue 96,
   * 1080x1920), duas rodadas: 21 caracteres couberam ("QUANDO O HOMEM
   * COMEÇA", "A PERDER O DESEMPENHO"); 23 e 24 dobraram a linha. A fronteira
   * fica entre 21 e 23 e varia com a largura dos glifos, entao 20 da folga.
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
  maxCaracteres: 20,
  pausaQuebraSegundos: 1.5,
  toleranciaCorteSegundos: 0.25,
  termosProtegidos: ["Androclinic", "Cristiano Estivalet"],
  trackDeCortes: 0,
  maiusculas: true,
};
