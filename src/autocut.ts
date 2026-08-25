/*
 * Podcast AutoCut — logica pura. Sem DOM, sem Premiere, roda no node --test.
 *
 * O invariante do spec (video e audio da mesma pessoa sempre no mesmo estado,
 * e as duas pessoas sempre em estados opostos) NAO e guardado em lugar nenhum:
 * cada segmento so carrega quem fala, e o estado das quatro tracks deriva dai.
 * Estado que nao existe nao pode divergir.
 */

export type Speaker = "A" | "B";

/** Saida do detector de fala. Por enquanto so o plano artificial da Fase 1. */
export interface Trecho {
  readonly inicioMs: number;
  readonly fimMs: number;
  readonly speaker: Speaker;
}

/** O mesmo trecho depois de encostado no quadro da sequencia. */
export interface Segmento {
  readonly inicioF: number;
  readonly fimF: number;
  readonly speaker: Speaker;
}

/** Quais tracks sao de quem. Indices base 0 (V1 = 0). */
export interface Mapa {
  readonly videoA: number;
  readonly audioA: number;
  readonly videoB: number;
  readonly audioB: number;
}

export const MAPA_PADRAO: Mapa = { videoA: 0, audioA: 0, videoB: 1, audioB: 1 };

/** Nunca cortar entre quadros: toda decisao encosta no quadro mais proximo. */
export function msParaFrame(ms: number, fps: number): number {
  if (!(fps > 0)) throw new Error(`fps invalido: ${fps}`);
  return Math.round((ms / 1000) * fps);
}

/**
 * Trechos -> segmentos em quadros, sem vizinhos do mesmo speaker e sem
 * segmento de duracao zero (que viraria um corte em cima do outro).
 */
export function segmentar(trechos: readonly Trecho[], fps: number): Segmento[] {
  const saida: Segmento[] = [];
  for (const t of trechos) {
    const inicioF = msParaFrame(t.inicioMs, fps);
    const fimF = msParaFrame(t.fimMs, fps);
    if (fimF <= inicioF) continue;

    const ultimo = saida[saida.length - 1];
    if (ultimo && ultimo.speaker === t.speaker && inicioF <= ultimo.fimF) {
      saida[saida.length - 1] = { ...ultimo, fimF: Math.max(ultimo.fimF, fimF) };
      continue;
    }
    saida.push({ inicioF, fimF, speaker: t.speaker });
  }
  return saida;
}

/**
 * Quadros onde as QUATRO tracks sao cortadas.
 *
 * O quadro 0 nao e corte, mas o FIM do plano e: sem ele, o ultimo pedaco
 * comeria todo o resto da timeline. Quando o plano cobre a sequencia inteira
 * esse corte cai em cima da borda que ja existe, e `aplicar` o ignora.
 */
export function cortes(segmentos: readonly Segmento[]): number[] {
  const bordas = segmentos.flatMap((s) => [s.inicioF, s.fimF]);
  return [...new Set(bordas)].filter((f) => f > 0).sort((a, b) => a - b);
}

/** Quem fala no quadro dado, ou null fora do plano. */
export function speakerEm(segmentos: readonly Segmento[], frame: number): Speaker | null {
  const s = segmentos.find((seg) => frame >= seg.inicioF && frame < seg.fimF);
  return s ? s.speaker : null;
}

/**
 * Onde a fonte do clipe estaria neste ponto da timeline, se nada saiu do lugar.
 * Serve para qualquer unidade — o adapter passa quadros, nao segundos.
 */
export function fonteEsperada(inicioFonte: number, inicioClipe: number, inicioPedaco: number): number {
  return inicioFonte + (inicioPedaco - inicioClipe);
}

// --------------------------------------------------------- motor de decisao

/** Um trecho em que alguem esta falando, em tempo de SEQUENCIA. */
export interface Intervalo {
  readonly inicioMs: number;
  readonly fimMs: number;
}

/**
 * Os numeros que decidem quando trocar de camera. Ficam todos aqui porque
 * serao calibrados com podcast real — nenhum deles e sagrado.
 */
export interface Config {
  /** Plano mais curto que isto e absorvido pelo anterior. Mata o flicker. */
  readonly duracaoMinimaPlanoMs: number;
  /** Fala mais curta que isto nao conta: "aham", risada, respiracao. */
  readonly falaMinimaMs: number;
  /** Pausa menor que isto nao separa duas falas da mesma pessoa. */
  readonly silencioParaJuntarMs: number;
  /** Entra na pessoa um pouco antes de ela comecar a falar. */
  readonly preRollMs: number;
  /** E sai um pouco depois de ela terminar. */
  readonly postRollMs: number;
}

export const CONFIG_PADRAO: Config = {
  duracaoMinimaPlanoMs: 1200,
  falaMinimaMs: 250,
  silencioParaJuntarMs: 500,
  preRollMs: 80,
  postRollMs: 120,
};

function juntar(intervalos: readonly Intervalo[], folgaMs: number): Intervalo[] {
  const ordenados = [...intervalos].sort((a, b) => a.inicioMs - b.inicioMs);
  const saida: Intervalo[] = [];
  for (const i of ordenados) {
    const ultimo = saida[saida.length - 1];
    if (ultimo && i.inicioMs - ultimo.fimMs <= folgaMs) {
      saida[saida.length - 1] = { inicioMs: ultimo.inicioMs, fimMs: Math.max(ultimo.fimMs, i.fimMs) };
      continue;
    }
    saida.push(i);
  }
  return saida;
}

/**
 * Palavras soltas viram blocos de fala.
 *
 * A ordem importa: juntar por pausa curta ANTES de descartar o que e curto
 * demais, senao uma frase picada em palavras morreria palavra por palavra. E o
 * pre/post-roll so no fim, senao um "aham" de 200 ms passaria no corte de
 * duracao minima so por ter sido esticado.
 */
export function blocosDeFala(palavras: readonly Intervalo[], cfg: Config): Intervalo[] {
  const juntos = juntar(palavras, cfg.silencioParaJuntarMs);
  const reais = juntos.filter((i) => i.fimMs - i.inicioMs >= cfg.falaMinimaMs);
  const esticados = reais.map((i) => ({
    inicioMs: Math.max(0, i.inicioMs - cfg.preRollMs),
    fimMs: i.fimMs + cfg.postRollMs,
  }));
  return juntar(esticados, 0);
}

function falandoEm(intervalos: readonly Intervalo[], ms: number): boolean {
  return intervalos.some((i) => ms >= i.inicioMs && ms < i.fimMs);
}

/**
 * Quem fica na tela, instante a instante.
 *
 * Silencio e crosstalk NAO trocam de camera: mantem quem ja estava. Trocar no
 * silencio pica o corte a cada respiracao, e trocar no crosstalk faz a camera
 * pular junto com a discussao.
 */
export function decidir(falaA: readonly Intervalo[], falaB: readonly Intervalo[], cfg: Config): Trecho[] {
  const a = blocosDeFala(falaA, cfg);
  const b = blocosDeFala(falaB, cfg);
  if (a.length === 0 && b.length === 0) return [];

  // ponytail: varredura O(n*m) sobre as bordas. Um podcast de 2h da alguns
  // milhares de blocos e isso roda instantaneo; se um dia pesar, os dois lados
  // ja estao ordenados e viram dois ponteiros.
  const bordas = [...new Set([0, ...a.flatMap((i) => [i.inicioMs, i.fimMs]), ...b.flatMap((i) => [i.inicioMs, i.fimMs])])].sort(
    (x, y) => x - y
  );

  const primeiro = (a[0]?.inicioMs ?? Infinity) <= (b[0]?.inicioMs ?? Infinity) ? "A" : "B";
  let atual: Speaker = primeiro;
  const bruto: Trecho[] = [];

  for (let i = 0; i < bordas.length - 1; i++) {
    const inicioMs = bordas[i]!;
    const fimMs = bordas[i + 1]!;
    const naA = falandoEm(a, inicioMs);
    const naB = falandoEm(b, inicioMs);

    // So troca quando exatamente uma das duas esta falando.
    if (naA && !naB) atual = "A";
    else if (naB && !naA) atual = "B";

    bruto.push({ inicioMs, fimMs, speaker: atual });
  }

  return planoMinimo(bruto, cfg.duracaoMinimaPlanoMs);
}

/** Cola vizinhos iguais e absorve todo plano curto demais no anterior. */
export function planoMinimo(trechos: readonly Trecho[], minimoMs: number): Trecho[] {
  const colado: Trecho[] = [];
  const empurrar = (t: Trecho) => {
    const ultimo = colado[colado.length - 1];
    if (ultimo && ultimo.speaker === t.speaker) {
      colado[colado.length - 1] = { ...ultimo, fimMs: t.fimMs };
      return;
    }
    colado.push(t);
  };

  for (const t of trechos) empurrar(t);

  // Um plano curto demais nao vira corte: some dentro do vizinho de tras. O
  // primeiro nao tem de tras, entao ele cede o lugar para quem vem depois.
  const saida: Trecho[] = [];
  for (const t of colado) {
    const curto = t.fimMs - t.inicioMs < minimoMs;
    const anterior = saida[saida.length - 1];
    if (curto && anterior) {
      saida[saida.length - 1] = { ...anterior, fimMs: t.fimMs };
      continue;
    }
    if (curto && !anterior && colado.length > 1) {
      saida.push({ ...t, speaker: colado[1]!.speaker });
      continue;
    }
    saida.push(t);
  }

  // Absorver planos curtos pode ter deixado dois vizinhos iguais lado a lado.
  const final: Trecho[] = [];
  for (const t of saida) {
    const ultimo = final[final.length - 1];
    if (ultimo && ultimo.speaker === t.speaker) {
      final[final.length - 1] = { ...ultimo, fimMs: t.fimMs };
      continue;
    }
    final.push(t);
  }
  return final;
}

// ------------------------------------------------------- fala por nivel

/** Os numeros que separam voz de vazamento. Tambem serao calibrados. */
export interface ConfigNivel {
  /** Quanto acima do ruido de fundo do proprio canal ja conta como voz. */
  readonly limiarDb: number;
  /**
   * Vantagem que um canal precisa ter sobre o outro para ser considerado o dono
   * da voz. E isto que resolve vazamento: com os dois microfones na mesma sala,
   * quem fala aparece nos dois — mas nao com a mesma forca.
   */
  readonly dominanciaDb: number;
}

export const CONFIG_NIVEL_PADRAO: ConfigNivel = { limiarDb: 12, dominanciaDb: 6 };

/**
 * Ruido de fundo do canal.
 *
 * Percentil 20 e nao o minimo: um unico quadro mudo puxaria o piso para o
 * silencio digital e todo o resto viraria "voz".
 */
export function ruidoDeFundo(db: readonly number[]): number {
  if (db.length === 0) return 0;
  const ordenado = [...db].sort((a, b) => a - b);
  return ordenado[Math.floor(ordenado.length * 0.2)]!;
}

/**
 * Quem fala em cada janela, a partir do nivel dos dois canais.
 *
 * Janela em que os dois estao altos e ninguem domina nao vira fala de ninguem:
 * fica de fora e `decidir` mantem quem estava. E o mesmo tratamento do
 * crosstalk, so que vindo do nivel em vez da transcricao.
 */
export function falaPorNivel(
  dbA: readonly number[],
  dbB: readonly number[],
  janelaMs: number,
  cfg: ConfigNivel
): { a: Intervalo[]; b: Intervalo[] } {
  const pisoA = ruidoDeFundo(dbA) + cfg.limiarDb;
  const pisoB = ruidoDeFundo(dbB) + cfg.limiarDb;
  const total = Math.min(dbA.length, dbB.length);

  const a: Intervalo[] = [];
  const b: Intervalo[] = [];
  const empurrar = (lista: Intervalo[], janela: number) => {
    const ultimo = lista[lista.length - 1];
    const inicioMs = janela * janelaMs;
    if (ultimo && ultimo.fimMs === inicioMs) {
      lista[lista.length - 1] = { inicioMs: ultimo.inicioMs, fimMs: inicioMs + janelaMs };
      return;
    }
    lista.push({ inicioMs, fimMs: inicioMs + janelaMs });
  };

  for (let i = 0; i < total; i++) {
    const nivelA = dbA[i]!;
    const nivelB = dbB[i]!;
    const vozA = nivelA > pisoA;
    const vozB = nivelB > pisoB;

    if (vozA && nivelA - nivelB >= cfg.dominanciaDb) empurrar(a, i);
    else if (vozB && nivelB - nivelA >= cfg.dominanciaDb) empurrar(b, i);
    else if (vozA && !vozB) empurrar(a, i);
    else if (vozB && !vozA) empurrar(b, i);
  }
  return { a, b };
}
