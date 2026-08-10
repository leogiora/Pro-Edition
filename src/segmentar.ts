/*
 * Transforma palavras com tempo em blocos de legenda de UMA linha.
 *
 * Puro: nao conhece o Premiere, nao faz I/O.
 *
 * Ordem das decisoes, do mais rigido para o mais flexivel:
 *   1. fronteira de frase (`eos` ou pausa longa) — o Premiere ja entrega
 *   2. orcamento de caracteres — hard constraint da regra de uma linha
 *   3. escolha do ponto de quebra — heuristica, e o unico lugar com juizo
 */

import { detectarPrecos, textoDoPreco, type Preco } from "./preco.ts";
import { PRESET_PADRAO, type Preset } from "./preset.ts";
import { nucleo, type PalavraRevisada } from "./texto.ts";

export interface BlocoLegenda {
  readonly texto: string;
  /** Segundos na sequencia. */
  readonly inicio: number;
  readonly fim: number;
  readonly estilo: "normal" | "preco";
  readonly precisaRevisao: boolean;
  readonly motivos: readonly string[];
}

/** Abaixo disto o trecho vai para a fila de revisao. */
const CONFIANCA_MINIMA = 0.5;

/** Corta o array de palavras em frases, por `eos` ou por pausa. */
function emFrases(palavras: readonly PalavraRevisada[], preset: Preset): PalavraRevisada[][] {
  const frases: PalavraRevisada[][] = [];
  let atual: PalavraRevisada[] = [];

  for (const palavra of palavras) {
    const anterior = atual[atual.length - 1];
    if (anterior !== undefined && palavra.inicio - anterior.fim > preset.pausaQuebraSegundos) {
      frases.push(atual);
      atual = [];
    }
    atual.push(palavra);
    if (palavra.eos) {
      frases.push(atual);
      atual = [];
    }
  }
  if (atual.length > 0) frases.push(atual);
  return frases;
}

const larguraDe = (palavras: readonly PalavraRevisada[]): number =>
  palavras.reduce((soma, p, i) => soma + p.text.length + (i > 0 ? 1 : 0), 0);

/**
 * Parte uma frase que nao cabe em uma linha.
 *
 * Guloso da esquerda: pega o maior prefixo que cabe. A escolha do ponto de
 * quebra dentro do que cabe entra na Task 13, junto com os cortes.
 */
function partir(frase: readonly PalavraRevisada[], preset: Preset): PalavraRevisada[][] {
  if (larguraDe(frase) <= preset.maxCaracteres) return [[...frase]];

  const partes: PalavraRevisada[][] = [];
  let resto = [...frase];

  while (resto.length > 0) {
    if (larguraDe(resto) <= preset.maxCaracteres) {
      partes.push(resto);
      break;
    }

    // Maior prefixo que cabe. Pelo menos uma palavra, sempre: uma palavra
    // sozinha maior que o orcamento e melhor que um bloco vazio.
    let corte = 1;
    for (let n = 1; n <= resto.length; n++) {
      if (larguraDe(resto.slice(0, n)) > preset.maxCaracteres) break;
      corte = n;
    }

    partes.push(resto.slice(0, corte));
    resto = resto.slice(corte);
  }

  return partes;
}

function montarBloco(palavras: readonly PalavraRevisada[], estilo: "normal" | "preco"): BlocoLegenda {
  const primeira = palavras[0];
  const ultima = palavras[palavras.length - 1];
  if (primeira === undefined || ultima === undefined) {
    throw new RangeError("bloco sem palavras");
  }

  const motivos: string[] = [];
  const confianca = Math.min(...palavras.map((p) => p.confidence));
  if (confianca < CONFIANCA_MINIMA) motivos.push(`confianca ${confianca.toFixed(2)}`);
  for (const p of palavras) {
    if (p.sugestao !== null) motivos.push(`"${nucleo(p.text).corpo}" pode ser "${p.sugestao}"`);
  }

  return {
    // A regra de uma linha e absoluta: nenhuma quebra sobrevive daqui.
    texto: palavras.map((p) => p.text).join(" ").replace(/\s*\n\s*/g, " "),
    inicio: primeira.inicio,
    fim: ultima.fim,
    estilo,
    precisaRevisao: motivos.length > 0,
    motivos,
  };
}

/** Uma fatia de frase: texto normal, ou um preco que vira bloco sozinho. */
interface Fatia {
  readonly palavras: readonly PalavraRevisada[];
  readonly estilo: "normal" | "preco";
  /** Preenchido so quando `estilo` e "preco". */
  readonly preco: Preco | null;
}

/**
 * Parte a frase nos precos.
 *
 * Preco e hard boundary: mesmo que sobre um bloco de uma palavra so — "DE",
 * "POR" — o valor continua isolado. A spec fecha essa regra na secao 2.3.
 */
function fatiarPorPreco(frase: readonly PalavraRevisada[]): Fatia[] {
  const precos = detectarPrecos(frase.map((p) => nucleo(p.text).corpo));
  if (precos.length === 0) return [{ palavras: frase, estilo: "normal", preco: null }];

  const fatias: Fatia[] = [];
  let cursor = 0;

  for (const preco of precos) {
    if (preco.inicio > cursor) {
      fatias.push({ palavras: frase.slice(cursor, preco.inicio), estilo: "normal", preco: null });
    }
    fatias.push({ palavras: frase.slice(preco.inicio, preco.fim + 1), estilo: "preco", preco });
    cursor = preco.fim + 1;
  }

  if (cursor < frase.length) {
    fatias.push({ palavras: frase.slice(cursor), estilo: "normal", preco: null });
  }
  return fatias.filter((f) => f.palavras.length > 0);
}

export function segmentar(
  palavras: readonly PalavraRevisada[],
  cortes: readonly number[],
  preset: Preset = PRESET_PADRAO
): BlocoLegenda[] {
  void cortes; // usado a partir da Task 13
  const blocos: BlocoLegenda[] = [];

  for (const frase of emFrases(palavras, preset)) {
    for (const fatia of fatiarPorPreco(frase)) {
      if (fatia.estilo === "preco" && fatia.preco !== null) {
        // O preco nunca e partido: o texto vem da formatacao, nao das palavras.
        const bloco = montarBloco(fatia.palavras, "preco");
        blocos.push({
          ...bloco,
          texto: textoDoPreco(fatia.preco.valor),
          precisaRevisao: bloco.precisaRevisao || fatia.preco.certeza === "media",
          motivos:
            fatia.preco.certeza === "media"
              ? [...bloco.motivos, "contexto monetario incerto"]
              : bloco.motivos,
        });
        continue;
      }
      for (const parte of partir(fatia.palavras, preset)) {
        if (parte.length > 0) blocos.push(montarBloco(parte, "normal"));
      }
    }
  }

  return blocos;
}
