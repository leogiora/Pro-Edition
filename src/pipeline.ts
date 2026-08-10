/*
 * A cadeia inteira, num lugar so: palavras do corte final entram, blocos de
 * legenda saem — e depois viram transcript pronto para escrever no clipe.
 *
 * Puro: nao conhece o Premiere, nao faz I/O. E o que permite testar o produto
 * todo sem abrir o aplicativo, que e a unica forma viavel de iterar quando
 * cada alteracao custa um reinicio.
 */

import { sequenceToSource } from "./domain.ts";
import { PRESET_PADRAO, type Preset } from "./preset.ts";
import { segmentar, type BlocoLegenda } from "./segmentar.ts";
import {
  corrigirEAcento,
  corrigirPorques,
  deTranscricao,
  normalizarColoquial,
  protegerTermos,
} from "./texto.ts";
import type { ClipeComOrigem, PalavraEditada } from "./transcript.ts";

/** Marca de autoria. E como o backup sabe distinguir o nosso texto do original. */
export const AUTOR = "pro-captions";

/**
 * A ordem importa, e e a da secao 7 da spec.
 *
 * Termos protegidos vem primeiro porque as regras seguintes olham a palavra
 * anterior — corrigir "andro clinic" depois de segmentar seria tarde demais.
 * Os porques vem antes da segmentacao porque a decisao precisa da oracao
 * inteira, que deixa de existir depois que o texto vira blocos.
 */
export function gerarBlocos(
  palavras: readonly PalavraEditada[],
  cortes: readonly number[],
  preset: Preset = PRESET_PADRAO
): BlocoLegenda[] {
  let ps = deTranscricao(palavras);
  ps = protegerTermos(ps, preset);
  ps = normalizarColoquial(ps);
  ps = corrigirEAcento(ps);
  ps = corrigirPorques(ps);
  return segmentar(ps, cortes, preset);
}

/* ------------------------------------- blocos de volta para o transcript */

interface PalavraJSON {
  readonly text: string;
  readonly start: number;
  readonly duration: number;
  readonly confidence: number;
  readonly eos: boolean;
  readonly tags: readonly string[];
  readonly type: "word";
}

interface SegmentoJSON {
  readonly start: number;
  readonly duration: number;
  readonly language: string;
  readonly speaker: string;
  readonly words: readonly PalavraJSON[];
}

export interface TranscricaoJSON {
  readonly language: string;
  readonly segments: readonly SegmentoJSON[];
}

/** Qual clipe estava no ar naquele instante da sequencia. */
function clipeEm(clipes: readonly ClipeComOrigem[], segundos: number): ClipeComOrigem | null {
  for (const c of clipes) {
    if (segundos >= c.startSeconds && segundos < c.endSeconds) return c;
  }
  return null;
}

/**
 * Converte os blocos em transcript por midia, pronto para
 * `Transcript.createImportTextSegmentsAction`.
 *
 * **Um bloco vira um `segment`.** E a aposta central do desenho: se o Premiere
 * criar uma legenda por segment, a regra de uma linha sobrevive ate a timeline.
 *
 * A duracao e distribuida igualmente entre as palavras do bloco. O que precisa
 * ser exato e o inicio e o fim do bloco — dentro dele o Premiere nao usa o
 * timing por palavra para nada que apareca na tela.
 */
export function blocosParaTranscricao(
  blocos: readonly BlocoLegenda[],
  clipes: readonly ClipeComOrigem[]
): Map<string, TranscricaoJSON> {
  const porMidia = new Map<string, SegmentoJSON[]>();

  for (const bloco of blocos) {
    const clipe = clipeEm(clipes, bloco.inicio);
    if (clipe === null) continue; // bloco fora de qualquer clipe: nao inventar midia

    const inicio = sequenceToSource(clipe, bloco.inicio);
    if (inicio === null) continue;

    // O fim pode cair no clipe seguinte; prende no fim deste para nao gravar
    // duracao negativa nem invadir a midia vizinha.
    const fimNaSequencia = Math.min(bloco.fim, clipe.endSeconds);
    const fim = sequenceToSource(clipe, fimNaSequencia) ?? clipe.outPointSeconds;
    const duracao = Math.max(0.1, fim - inicio);

    const partes = bloco.texto.split(" ").filter((p) => p.length > 0);
    const passo = duracao / Math.max(1, partes.length);

    const lista = porMidia.get(clipe.sourceName) ?? [];
    lista.push({
      start: inicio,
      duration: duracao,
      language: "pt-BR",
      speaker: AUTOR,
      words: partes.map((text, i) => ({
        text,
        start: inicio + i * passo,
        duration: passo,
        confidence: 1,
        eos: i === partes.length - 1,
        tags: [],
        type: "word" as const,
      })),
    });
    porMidia.set(clipe.sourceName, lista);
  }

  const saida = new Map<string, TranscricaoJSON>();
  for (const [midia, segments] of porMidia) {
    segments.sort((a, b) => a.start - b.start);
    saida.set(midia, { language: "pt-BR", segments });
  }
  return saida;
}

/** Este transcript foi escrito por nos? Usado para nao sobrescrever o backup bom. */
export function ehNosso(json: string): boolean {
  try {
    const bruto: unknown = JSON.parse(json);
    if (typeof bruto !== "object" || bruto === null) return false;
    const segments = (bruto as { segments?: unknown }).segments;
    if (!Array.isArray(segments) || segments.length === 0) return false;
    return segments.every((s) => (s as { speaker?: unknown })?.speaker === AUTOR);
  } catch {
    return false;
  }
}
