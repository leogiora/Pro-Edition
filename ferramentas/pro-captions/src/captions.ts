/*
 * Captions — o contrato entre a tela e o motor. A mesma tela roda no painel
 * (motor local, motor-local.ts) e no programa (motor remoto, pela ponte).
 * Sem import do Premiere: o programa importa daqui so os tipos.
 */

export type TomCaptions = "passo" | "ok" | "aviso" | "erro";
export type RegistrarCaptions = (texto: string, tom?: TomCaptions) => void;
/** 0 audio, 1 ouvir, 2 montar, 3 timeline. */
export type AndamentoCaptions = (etapa: number, texto: string) => void;

export interface EstadoCaptions {
  readonly nome: string;
  /** Fim da V1, em segundos. */
  readonly duracaoS: number;
  readonly clipesV1: number;
  /** Os 4 ultimos caracteres da chave salva; null sem chave. */
  readonly chave: string | null;
  /** A empresa cujos termos o ElevenLabs recebe (troca no AutoEdit). */
  readonly empresa: string;
  /** Midias da V1 e quantas tem transcricao do Premiere (o caminho sem ElevenLabs). */
  readonly midias: number;
  readonly comTranscricao: number;
}

export interface BlocoVisto {
  readonly inicio: number;
  readonly fim: number;
  readonly texto: string;
  readonly preco: boolean;
  /** Por que pede revisao; vazio quando nao pede. */
  readonly revisar: readonly string[];
}

export interface ResultadoCaptions {
  readonly nome: string;
  readonly duracaoS: number;
  readonly fonte: "elevenlabs" | "premiere";
  /** Mesmo audio de antes: a transcricao guardada foi usada, sem pagar de novo. */
  readonly reaproveitada: boolean;
  readonly palavras: number;
  readonly blocos: readonly BlocoVisto[];
  /** Blocos reprovados na validacao: com algum, nada foi escrito. */
  readonly reprovados: readonly string[];
  /** O que aconteceu na timeline (ponte das legendas ou o arrasto manual). */
  readonly timeline: ReadonlyArray<{ readonly texto: string; readonly tipo: "ok" | "aviso" | "erro" }>;
  /** A fala acaba bem antes da V1 (clipe de audio mudo?). */
  readonly avisoFala: string | null;
}

export interface MotorCaptions {
  ler(): Promise<EstadoCaptions>;
  gerar(usarEleven: boolean, registrar: RegistrarCaptions, andamento: AndamentoCaptions): Promise<ResultadoCaptions>;
  /** Devolve os 4 ultimos caracteres da chave salva. */
  salvarChave(chave: string): Promise<string>;
  irPara(segundos: number): Promise<void>;
}
