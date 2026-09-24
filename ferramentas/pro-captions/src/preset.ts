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
  /**
   * Palavras que o ElevenLabs deve esperar ouvir (keyterms). Nao corrigem o
   * texto depois: so aumentam a chance de o reconhecimento acertar de
   * primeira. Nome de marca, de medico e termo tecnico entram aqui.
   */
  readonly termosChave: readonly string[];
  /** Faixa de video lida para cortes e transcricao. 0 = V1. */
  readonly trackDeCortes: number;
  readonly maiusculas: boolean;
  /**
   * A transcricao ja acerta "e"/"é" e nao precisa da correcao por contexto.
   *
   * A correcao existe porque o ASR do Premiere troca os dois o tempo todo. O
   * ElevenLabs acerta — e ai a regra passa a estragar: "assume o problema e
   * busca a solucao" virava "problema é busca" (teste de 2026-09-24).
   */
  readonly confiarNoAcento: boolean;
  /**
   * Virgula, ponto e virgula e dois-pontos fecham bloco.
   *
   * O Premiere quase nao pontua, entao isto nao muda nada nele. O ElevenLabs
   * pontua como quem fala — e a legenda revisada do editor quebra exatamente
   * ali ("Ela espera" / "tenta entender" / "finge que tá tudo bem").
   */
  readonly quebrarEmPontuacao: boolean;
}

export const PRESET_PADRAO: Preset = {
  maxCaracteres: 20,
  pausaQuebraSegundos: 1.5,
  toleranciaCorteSegundos: 0.25,
  termosProtegidos: ["Androclinic", "Cristiano Estivalet"],
  termosChave: [
    "AndroClinic",
    "Estivalet",
    "anamnese",
    "testosterona",
    "telemedicina",
    "teleconsulta",
    "disfunção erétil",
    "azulzinho",
    "hora H",
    "sigilo total",
    "libido",
    "ereção",
    "urologista",
    "hormônio",
    "estresse",
  ],
  trackDeCortes: 0,
  maiusculas: true,
  confiarNoAcento: false,
  quebrarEmPontuacao: false,
};

/** O mesmo padrao, ajustado para a transcricao do ElevenLabs. */
export const PRESET_ELEVENLABS: Preset = {
  ...PRESET_PADRAO,
  confiarNoAcento: true,
  quebrarEmPontuacao: true,
};
