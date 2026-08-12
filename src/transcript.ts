/*
 * Reconstrucao da transcricao do CORTE FINAL.
 *
 * O Premiere so entrega transcricao por ClipProjectItem, em tempo da midia de
 * origem (provado na Fase 0: a caption track da sequencia nao expoe texto).
 * Este modulo junta as duas coisas — o que foi dito e o que sobreviveu ao
 * corte — e devolve as palavras ja em tempo de sequencia.
 *
 * Puro: nao conhece o Premiere, nao faz I/O.
 */

import { sourceToSequence, type TimelineClip } from "./domain.ts";
import { termos } from "./match.ts";

// ---------------------------------------------------- formato do Premiere

/** Uma palavra como o `Transcript.exportToJSON` entrega. */
export interface PalavraOrigem {
  readonly text: string;
  /** Segundos desde o inicio da MIDIA DE ORIGEM. */
  readonly start: number;
  readonly duration: number;
  readonly confidence: number;
  /** end of sentence — o Premiere ja marca o fim de frase. */
  readonly eos: boolean;
  readonly type: string;
}

export interface SegmentoOrigem {
  readonly start: number;
  readonly duration: number;
  readonly speaker: string;
  readonly words: readonly PalavraOrigem[];
}

export interface TranscricaoOrigem {
  readonly language: string;
  readonly segments: readonly SegmentoOrigem[];
}

/**
 * Le o JSON do Premiere sem confiar nele. Campo faltando ou com tipo errado
 * derruba so aquela palavra, nunca a analise inteira.
 */
export function parseTranscricao(json: string): TranscricaoOrigem | null {
  let bruto: unknown;
  try {
    bruto = JSON.parse(json);
  } catch {
    return null;
  }
  if (typeof bruto !== "object" || bruto === null) return null;

  const o = bruto as Record<string, unknown>;
  if (!Array.isArray(o.segments)) return null;

  const segments: SegmentoOrigem[] = [];
  for (const s of o.segments) {
    if (typeof s !== "object" || s === null) continue;
    const seg = s as Record<string, unknown>;
    if (!Array.isArray(seg.words)) continue;

    const words: PalavraOrigem[] = [];
    for (const w of seg.words) {
      if (typeof w !== "object" || w === null) continue;
      const p = w as Record<string, unknown>;
      if (typeof p.text !== "string" || typeof p.start !== "number") continue;
      words.push({
        text: p.text,
        start: p.start,
        duration: typeof p.duration === "number" ? p.duration : 0,
        confidence: typeof p.confidence === "number" ? p.confidence : 1,
        eos: p.eos === true,
        // O campo existe e nem sempre e "word"; nao presumir.
        type: typeof p.type === "string" ? p.type : "word",
      });
    }
    segments.push({
      start: typeof seg.start === "number" ? seg.start : 0,
      duration: typeof seg.duration === "number" ? seg.duration : 0,
      speaker: typeof seg.speaker === "string" ? seg.speaker : "",
      words,
    });
  }

  return { language: typeof o.language === "string" ? o.language : "", segments };
}

// ------------------------------------------------------------ reconstrucao

/** Clipe da timeline junto com o nome da midia que o originou. */
export interface ClipeComOrigem extends TimelineClip {
  readonly sourceName: string;
}

/** Palavra que sobreviveu ao corte, ja em tempo de sequencia. */
export interface PalavraEditada {
  readonly text: string;
  readonly inicio: number;
  readonly fim: number;
  readonly confidence: number;
  readonly eos: boolean;
  /** De qual clipe da timeline ela veio — util para depurar alinhamento. */
  readonly sourceName: string;
}

/**
 * Monta a transcricao do corte final.
 *
 * Para cada clipe da timeline, pega a transcricao da midia de origem e mantem
 * so as palavras que caem entre `inPoint` e `outPoint`. A maior parte da fala
 * gravada nao sobrevive — e esse justamente e o ponto.
 */
export function reconstruirTranscricao(
  clipes: readonly ClipeComOrigem[],
  transcricoes: ReadonlyMap<string, TranscricaoOrigem>
): PalavraEditada[] {
  const saida: PalavraEditada[] = [];

  for (const clipe of clipes) {
    const transcricao = transcricoes.get(clipe.sourceName);
    if (!transcricao) continue; // midia sem transcricao: B-roll, trilha, imagem

    for (const segmento of transcricao.segments) {
      for (const palavra of segmento.words) {
        if (palavra.type !== "word") continue;

        const inicio = sourceToSequence(clipe, palavra.start);
        if (inicio === null) continue; // ficou fora do corte

        // O fim tambem e remapeado, mas preso ao fim do clipe: uma palavra
        // pode ser cortada no meio, e ai ela termina onde o corte termina.
        const fimNaOrigem = palavra.start + palavra.duration;
        const fim = sourceToSequence(clipe, fimNaOrigem) ?? clipe.endSeconds;

        saida.push({
          text: palavra.text,
          inicio,
          fim: Math.max(inicio, fim),
          confidence: palavra.confidence,
          eos: palavra.eos,
          sourceName: clipe.sourceName,
        });
      }
    }
  }

  saida.sort((a, b) => a.inicio - b.inicio);
  return saida;
}

// --------------------------------------------------------------- frases

export interface TermoNoTempo {
  /** Termo ja normalizado, pronto para comparar com o rotulo do conceito. */
  readonly termo: string;
  readonly inicio: number;
}

export interface Frase {
  readonly texto: string;
  readonly inicio: number;
  readonly fim: number;
  readonly duracao: number;
  readonly palavras: number;
  /** A menor confianca entre as palavras: marca trecho incerto. */
  readonly confiancaMinima: number;
  /**
   * Cada termo util da frase com o instante em que foi dito.
   *
   * E o que permite colocar o B-roll EM CIMA da palavra que casou, em vez de
   * no comeco da frase. Numa frase de 8 segundos isso e a diferenca entre o
   * corte cair junto com "disfuncao eretil" ou seis segundos antes dela.
   */
  readonly termosNoTempo: readonly TermoNoTempo[];
}

/** Silencio maior que isto quebra a frase mesmo sem `eos`. */
const PAUSA_QUE_QUEBRA = 1.5;

/**
 * Silencio minimo depois de uma palavra `eos` para confiar que e fim de frase.
 *
 * Medido numa transcricao real sem pontuacao: o Premiere marcou `eos` em quase
 * toda palavra. Nas fronteiras verdadeiras sempre havia ~0,15s de respiro; nas
 * espurias o fim de uma palavra era EXATAMENTE o inicio da proxima (0,00s) —
 * ruido do reconhecedor, nao fala. 0,05s fica em folga dos dois lados.
 */
const PAUSA_MINIMA_PARA_EOS = 0.05;

/**
 * Agrupa palavras em frases.
 *
 * O Premiere ja marca fim de frase em `eos`, entao nao ha NLP aqui — mas `eos`
 * sozinho nao basta (ver `PAUSA_MINIMA_PARA_EOS`). A pausa longa e a segunda
 * regra: quando o editor corta no meio de uma frase, o `eos` nunca chega e o
 * texto grudaria em trechos que na tela estao separados.
 */
export function agruparEmFrases(palavras: readonly PalavraEditada[]): Frase[] {
  const frases: Frase[] = [];
  let atual: PalavraEditada[] = [];

  const fechar = (): void => {
    if (atual.length === 0) return;
    const primeira = atual[0];
    const ultima = atual[atual.length - 1];
    if (!primeira || !ultima) return;
    const termosNoTempo: TermoNoTempo[] = [];
    for (const p of atual) {
      for (const termo of termos(p.text)) termosNoTempo.push({ termo, inicio: p.inicio });
    }

    frases.push({
      texto: atual.map((p) => p.text).join(" "),
      inicio: primeira.inicio,
      fim: ultima.fim,
      duracao: ultima.fim - primeira.inicio,
      palavras: atual.length,
      confiancaMinima: Math.min(...atual.map((p) => p.confidence)),
      termosNoTempo,
    });
    atual = [];
  };

  for (let i = 0; i < palavras.length; i++) {
    const palavra = palavras[i];
    if (!palavra) continue;
    const anterior = atual[atual.length - 1];
    if (anterior && palavra.inicio - anterior.fim > PAUSA_QUE_QUEBRA) fechar();
    atual.push(palavra);

    const proxima = palavras[i + 1];
    const silencioDepois = proxima ? proxima.inicio - palavra.fim : Number.POSITIVE_INFINITY;
    if (palavra.eos && silencioDepois >= PAUSA_MINIMA_PARA_EOS) fechar();
  }
  fechar();

  return frases;
}
