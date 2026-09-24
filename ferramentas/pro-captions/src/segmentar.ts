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

const cabe = (palavras: readonly PalavraRevisada[], preset: Preset): boolean =>
  larguraDe(palavras) <= preset.maxCaracteres && palavras.length <= preset.maxPalavras;

/**
 * Artigo, preposicao, conjuncao e pronome atono puxam a palavra seguinte:
 * "tratar o" / "que precisa" deixa o leitor esperando o resto no bloco de baixo.
 */
const PENDURADAS: ReadonlySet<string> = new Set([
  "o", "a", "os", "as", "um", "uma", "uns", "umas",
  "de", "do", "da", "dos", "das", "em", "no", "na", "nos", "nas",
  "ao", "à", "por", "pelo", "pela", "pra", "pro", "com", "sem",
  "me", "te", "se", "lhe", "meu", "minha", "seu", "sua",
  "e", "ou", "mas", "que", "porque",
]);

/**
 * Quanto custa por um bloco na tela. Menor e melhor.
 *
 * Cada bloco custa 1, entao o custo total empurra para menos blocos, mais
 * cheios; o resto sao os descontos e as multas de cada ponto de quebra.
 */
function custoDoBloco(
  bloco: readonly PalavraRevisada[],
  fechaAFrase: boolean,
  preset: Preset,
  cortes: readonly number[]
): number {
  const ultima = bloco[bloco.length - 1];
  if (ultima === undefined) return Infinity;
  let custo = 1;

  // Palavra curta sozinha pisca na tela ("H", "no"). Palavra longa sozinha
  // ("circulação", "telemedicina") e comum na legenda revisada do editor.
  if (bloco.length === 1 && nucleo(ultima.text).corpo.length < 4) custo += 2;

  if (fechaAFrase) return custo;

  if (PENDURADAS.has(nucleo(ultima.text).corpo.toLowerCase())) custo += 3;

  // Pontuacao ja e uma pausa: quebrar ali soa natural.
  if (/[.,;:!?]$/.test(ultima.text)) custo -= 1.5;

  // Corte de video dentro da tolerancia: o diferencial do produto.
  if (cortes.some((c) => Math.abs(c - ultima.fim) <= preset.toleranciaCorteSegundos)) custo -= 2;

  return custo;
}

/**
 * Parte uma frase que nao cabe em um bloco.
 *
 * Programacao dinamica: de todas as formas de partir, fica a de menor custo
 * somado. Olhar a frase inteira importa — o guloso da esquerda que existia
 * aqui enchia o primeiro bloco e deixava a sobra onde caisse ("evita a hora" /
 * "H", "sexual masculina há" / "mais de 10" / "anos").
 *
 * O corte de video entra como preferencia, nunca como obrigacao: a ordem de
 * prioridade da secao 26 da spec poe timing da fala acima da harmonizacao com
 * cortes, e o orcamento do bloco e hard constraint.
 */
function partir(
  frase: readonly PalavraRevisada[],
  preset: Preset,
  cortes: readonly number[] = []
): PalavraRevisada[][] {
  if (cabe(frase, preset)) return [[...frase]];

  const n = frase.length;
  // melhor[j]: menor custo para as j primeiras palavras; inicio[j]: onde
  // comeca o ultimo bloco dessa solucao.
  const melhor: number[] = [0];
  const inicio: number[] = [0];
  for (let j = 1; j <= n; j++) {
    melhor[j] = Infinity;
    inicio[j] = j - 1;
    for (let i = j - 1; i >= 0; i--) {
      const bloco = frase.slice(i, j);
      // Uma palavra sozinha maior que o orcamento e melhor que nada.
      if (bloco.length > 1 && !cabe(bloco, preset)) break;
      const custo = (melhor[i] ?? Infinity) + custoDoBloco(bloco, j === n, preset, cortes);
      if (custo < (melhor[j] ?? Infinity)) {
        melhor[j] = custo;
        inicio[j] = i;
      }
    }
  }

  const partes: PalavraRevisada[][] = [];
  for (let j = n; j > 0; j = inicio[j] ?? 0) partes.unshift(frase.slice(inicio[j] ?? 0, j));
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
    //
    // A virgula pendurada na fronteira tambem cai: o bloco seguinte ja e a
    // pausa visual, e a virgula fica orfa no fim da linha. A spec proibe na
    // secao 11.1. O ponto final cai junto — decisao do usuario em 2026-08-12,
    // legendas dele nao usam ponto (D-15); "1.000" nao e atingido porque a
    // limpeza so olha o fim do texto, e "?" e "!" ficam. Virgula ou ponto no
    // meio do bloco nunca sao tocados.
    texto: palavras
      .map((p) => p.text)
      .join(" ")
      .replace(/\s*\n\s*/g, " ")
      // Aspas: o ElevenLabs marca fala citada ("Se ele nao se cuida...");
      // na legenda elas so ocupam caractere.
      .replace(/["“”]/g, "")
      .replace(/[,;:.]+$/, "")
      .replace(/^[,;:.]+\s*/, "")
      .trim(),
    inicio: primeira.inicio,
    fim: ultima.fim,
    estilo,
    precisaRevisao: motivos.length > 0,
    motivos,
  };
}

/**
 * Forca quebra nos cortes de video, antes de qualquer outra regra.
 *
 * `blocosParaTranscricao` joga o bloco inteiro no clipe onde ele comeca; um
 * bloco que atravessa um corte perde, em silencio, as palavras do clipe
 * seguinte. Isso independe do orcamento de caracteres caber ou nao — por
 * isso vem antes de `fatiarPorPreco` e de `partir`, nao dentro deles.
 */
function partirPorCorte(
  frase: readonly PalavraRevisada[],
  cortes: readonly number[]
): PalavraRevisada[][] {
  if (cortes.length === 0) return [[...frase]];

  const partes: PalavraRevisada[][] = [];
  let atual: PalavraRevisada[] = [];

  for (const palavra of frase) {
    const anterior = atual[atual.length - 1];
    if (
      anterior !== undefined &&
      cortes.some((c) => c >= anterior.fim && c <= palavra.inicio)
    ) {
      partes.push(atual);
      atual = [];
    }
    atual.push(palavra);
  }
  if (atual.length > 0) partes.push(atual);
  return partes;
}

/**
 * Parte nas pausas que a pontuacao marca: virgula, ponto e virgula, dois-pontos.
 *
 * Roda DEPOIS da deteccao de preco — "tá saindo 1.000 reais, mas ... 196" so
 * e reconhecido como comparacao de preco com a frase inteira a vista.
 */
function partirPorPontuacao(frase: readonly PalavraRevisada[]): PalavraRevisada[][] {
  const partes: PalavraRevisada[][] = [];
  let atual: PalavraRevisada[] = [];
  for (const palavra of frase) {
    atual.push(palavra);
    if (/[,;:]["'”’]*$/.test(palavra.text)) {
      partes.push(atual);
      atual = [];
    }
  }
  if (atual.length > 0) partes.push(atual);
  return partes;
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
  const blocos: BlocoLegenda[] = [];

  for (const frase of emFrases(palavras, preset)) {
    // Preco primeiro, na frase inteira: e um hard boundary que nao pode ser
    // partido nem pelo orcamento nem por um corte de video no meio dele.
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
      const oracoes = preset.quebrarEmPontuacao ? partirPorPontuacao(fatia.palavras) : [fatia.palavras];
      for (const oracao of oracoes) {
        for (const pedaco of partirPorCorte(oracao, cortes)) {
          for (const parte of partir(pedaco, preset, cortes)) {
            if (parte.length > 0) blocos.push(montarBloco(parte, "normal"));
          }
        }
      }
    }
  }

  return blocos;
}

/**
 * Ultima barreira antes de escrever no Premiere.
 *
 * A spec e explicita na secao 7: nunca renderizar antes da validacao final.
 * Devolve a lista de violacoes; vazia significa liberado.
 */
export function validar(
  blocos: readonly BlocoLegenda[],
  preset: Preset = PRESET_PADRAO
): string[] {
  const violacoes: string[] = [];

  blocos.forEach((bloco, i) => {
    const onde = `bloco ${i + 1} ("${bloco.texto}")`;

    if (bloco.texto.includes("\n")) violacoes.push(`${onde}: tem quebra de linha`);
    if (bloco.texto.trim().length === 0) violacoes.push(`${onde}: vazio`);
    if (bloco.texto.length > preset.maxCaracteres) {
      violacoes.push(`${onde}: ${bloco.texto.length} caracteres, orcamento e ${preset.maxCaracteres}`);
    }
    if (bloco.texto.endsWith(",")) violacoes.push(`${onde}: termina em virgula`);
    if (bloco.texto.endsWith(".")) violacoes.push(`${onde}: termina em ponto (D-15)`);
    if (bloco.estilo === "normal" && /\bREAIS\b/.test(bloco.texto)) {
      violacoes.push(`${onde}: preco misturado com texto normal`);
    }
    if (bloco.fim < bloco.inicio) violacoes.push(`${onde}: termina antes de comecar`);
  });

  return violacoes;
}
