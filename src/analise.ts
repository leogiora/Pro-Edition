/*
 * Junta as pecas: timeline -> transcricao do corte -> frases -> sugestoes.
 * Puro. Recebe dados ja lidos do Premiere e devolve o plano.
 */

import { casar, conceitosDeArquivos, type Conceito, type Sugestao } from "./match.ts";
import {
  agruparEmFrases,
  parseTranscricao,
  reconstruirTranscricao,
  type ClipeComOrigem,
  type Frase,
  type TranscricaoOrigem,
} from "./transcript.ts";

export interface Oportunidade {
  readonly frase: Frase;
  readonly sugestoes: readonly Sugestao[];
}

export interface Analise {
  readonly palavras: number;
  readonly frases: number;
  readonly conceitos: number;
  readonly oportunidades: readonly Oportunidade[];
  readonly avisos: readonly string[];
}

export interface EntradaAnalise {
  readonly clipes: readonly ClipeComOrigem[];
  /** Nome da midia -> JSON cru do exportToJSON. */
  readonly transcricoesJson: ReadonlyMap<string, string>;
  /** Nomes de todas as midias do projeto, para extrair os conceitos. */
  readonly biblioteca: readonly string[];
  /** Frases mais curtas que isto nao recebem B-roll (secao 8 do CLAUDE.md). */
  readonly duracaoMinima?: number;
  /** Score minimo para uma sugestao valer a pena mostrar. */
  readonly scoreMinimo?: number;
}

/** Confianca abaixo disto marca o trecho como incerto em vez de confiar nele. */
const CONFIANCA_SUSPEITA = 0.6;

export function analisar(entrada: EntradaAnalise): Analise {
  const avisos: string[] = [];
  const duracaoMinima = entrada.duracaoMinima ?? 1.2;
  const scoreMinimo = entrada.scoreMinimo ?? 0.5;

  const transcricoes = new Map<string, TranscricaoOrigem>();
  for (const [nome, json] of entrada.transcricoesJson) {
    const t = parseTranscricao(json);
    if (t) transcricoes.set(nome, t);
    else avisos.push(`Transcricao ilegivel em ${nome}.`);
  }

  if (transcricoes.size === 0) {
    avisos.push("Nenhuma midia da timeline tem transcricao. Gere a transcricao no Premiere primeiro.");
  }

  const palavras = reconstruirTranscricao(entrada.clipes, transcricoes);
  const frases = agruparEmFrases(palavras);

  const conceitos: Conceito[] = conceitosDeArquivos(entrada.biblioteca);
  if (conceitos.length === 0) avisos.push("Nenhum conceito encontrado no projeto.");

  const oportunidades: Oportunidade[] = [];
  for (const frase of frases) {
    if (frase.duracao < duracaoMinima) continue;

    const sugestoes = casar(frase.texto, conceitos).filter((s) => s.score >= scoreMinimo);
    if (sugestoes.length === 0) continue;

    if (frase.confiancaMinima < CONFIANCA_SUSPEITA) {
      avisos.push(
        `Trecho incerto em ${frase.inicio.toFixed(1)}s (confianca ${frase.confiancaMinima.toFixed(2)}): "${frase.texto}"`
      );
    }
    oportunidades.push({ frase, sugestoes });
  }

  return {
    palavras: palavras.length,
    frases: frases.length,
    conceitos: conceitos.length,
    oportunidades,
    avisos,
  };
}
