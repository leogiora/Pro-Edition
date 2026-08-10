/*
 * Correcao de grafia sobre o array de palavras: coloquial, e/e, porques e
 * termos protegidos. Todas percorrem a mesma estrutura e por isso moram juntas.
 *
 * Puro: nao conhece o Premiere, nao faz I/O.
 *
 * Regra do modulo: quando a evidencia nao basta, o texto fica como esta e a
 * duvida vai para `sugestao` — a UI oferece a troca. Nunca inventar palavra.
 */

import type { PalavraEditada } from "./transcript.ts";

export interface PalavraRevisada {
  readonly text: string;
  /** Segundos na sequencia. */
  readonly inicio: number;
  readonly fim: number;
  readonly confidence: number;
  readonly eos: boolean;
  /** Troca proposta que o produto nao teve evidencia para aplicar sozinho. */
  readonly sugestao: string | null;
  readonly motivo: string | null;
}

export function deTranscricao(palavras: readonly PalavraEditada[]): PalavraRevisada[] {
  return palavras.map((p) => ({
    text: p.text,
    inicio: p.inicio,
    fim: p.fim,
    confidence: p.confidence,
    eos: p.eos,
    sugestao: null,
    motivo: null,
  }));
}

/**
 * Separa a palavra da pontuacao que veio grudada.
 *
 * O Premiere entrega "relógio." como um token so. Sem separar, nenhuma regra
 * casa com a ultima palavra da frase — que e justamente onde mora o `eos`.
 *
 * NAO tira acento: em portugues "esta" e "está" sao palavras diferentes.
 */
export function nucleo(texto: string): { corpo: string; sufixo: string } {
  const casou = /^(.*?)([.,!?;:…]*)$/u.exec(texto);
  if (!casou) return { corpo: texto, sufixo: "" };
  return { corpo: casou[1] ?? texto, sufixo: casou[2] ?? "" };
}

/** Aplica a caixa da palavra original na substituta: "Para" -> "Pra". */
function comCaixaDe(modelo: string, novo: string): string {
  const primeira = modelo[0];
  if (primeira === undefined) return novo;
  if (primeira !== primeira.toUpperCase()) return novo;
  return novo.charAt(0).toUpperCase() + novo.slice(1);
}

/** Trocas de uma palavra so. Chave em minuscula, sem pontuacao. */
const SIMPLES: ReadonlyMap<string, string> = new Map([
  ["para", "pra"],
  ["estava", "tava"],
  ["estavam", "tavam"],
  ["está", "tá"],
  ["estão", "tão"],
  ["estou", "tô"],
]);

/** Trocas que consomem DUAS palavras. Chave: "primeira segunda". */
const PARES: ReadonlyMap<string, string> = new Map([
  ["para o", "pro"],
  ["para os", "pros"],
]);

/**
 * Aplica so as reducoes aprovadas na spec.
 *
 * Deliberadamente NAO faz "você"->"cê", "vamos"->"vamo", "estamos"->"tamo":
 * a spec proibe reducao agressiva sem regra explicita.
 *
 * O par "para o" funde duas palavras numa: a palavra resultante herda o inicio
 * da primeira e o fim da segunda, senao "pro" apareceria antes de ser falado.
 */
export function normalizarColoquial(palavras: readonly PalavraRevisada[]): PalavraRevisada[] {
  const saida: PalavraRevisada[] = [];
  let i = 0;

  while (i < palavras.length) {
    const atual = palavras[i];
    if (atual === undefined) {
      i++;
      continue;
    }

    const a = nucleo(atual.text);
    const seguinte = palavras[i + 1];

    if (seguinte !== undefined) {
      const b = nucleo(seguinte.text);
      const par = PARES.get(`${a.corpo.toLowerCase()} ${b.corpo.toLowerCase()}`);
      if (par !== undefined) {
        saida.push({
          ...atual,
          text: comCaixaDe(a.corpo, par) + b.sufixo,
          // Fim da SEGUNDA: a legenda nao pode terminar antes da fala.
          fim: seguinte.fim,
          confidence: Math.min(atual.confidence, seguinte.confidence),
          eos: seguinte.eos,
        });
        i += 2;
        continue;
      }
    }

    const troca = SIMPLES.get(a.corpo.toLowerCase());
    if (troca !== undefined) {
      saida.push({ ...atual, text: comCaixaDe(a.corpo, troca) + a.sufixo });
      i++;
      continue;
    }

    saida.push(atual);
    i++;
  }

  return saida;
}
