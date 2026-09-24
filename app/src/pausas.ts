/*
 * Auto Pausas fora do Premiere: a sequencia que o Leo separou entra, a mesma
 * sequencia sem pausas sai — como XML, com crossfade nos cortes.
 *
 * A regra e a do painel, sem copia (src/pausas.ts da raiz): a fala vem do
 * nivel do audio, o inicio das palavras vem da transcricao, e o espaco que o
 * editor deixou entre os videos fica do mesmo tamanho. So a ponta muda: o
 * audio e a transcricao sao lidos do ARQUIVO de cada clipe (tempo de midia),
 * nao de um export da timeline.
 *
 * Puro: recebe o que ja foi lido de cada arquivo.
 */

import {
  blocosDeFala,
  conferirPalavras,
  MARGEM_PADRAO_S,
  montarDaMidia,
  pedacosDoPlano,
  planejarCortes,
  type ClipeNaTimeline,
  type Palavra,
} from "../../src/pausas.ts";
import { PISO_DB } from "../../src/wav.ts";
import type { PalavraEditada } from "../../ferramentas/pro-captions/src/transcript.ts";
import { palavrasNaSequencia } from "./sequencia.ts";
import type { Clipe, Sequencia } from "./xml.ts";

export { MARGEM_PADRAO_S };

/** Janela da medida de nivel: a mesma do painel, calibrada com anuncio real. */
export const JANELA_S = 0.02;

/** Crossfade nos cortes: o Leo usa Constant Power de 2 quadros (701 no Andro 19.09). */
export const CRUZAMENTO_Q = 2;

/** O que foi lido de UM arquivo, em tempo de midia. */
export interface FonteAnalisada {
  /** dB por janela de JANELA_S, do comeco do arquivo. */
  readonly niveis: readonly number[];
  readonly palavras: readonly PalavraEditada[];
}

export interface ResultadoPausas {
  readonly sequencia: Sequencia;
  readonly antesQ: number;
  readonly depoisQ: number;
  readonly cortes: number;
  /** As mesmas palavras, na mesma ordem, depois do corte? */
  readonly conferencia: { readonly ok: boolean; readonly linhas: string[] };
  /** A fala ja no tempo da sequencia nova: a legenda sai daqui sem transcrever de novo. */
  readonly palavras: PalavraEditada[];
  /** Onde a imagem corta, em segundos (a legenda evita atravessar). */
  readonly cortesDeVideo: number[];
  readonly avisos: string[];
}

/** O que precisa ser lido de cada arquivo antes de tirar as pausas. */
export function arquivosDaV1(entrada: Sequencia): string[] {
  return [...new Set((entrada.video[0] ?? []).map((c) => c.midia.caminho))];
}

export function tirarPausas(
  entrada: Sequencia,
  fontes: ReadonlyMap<string, FonteAnalisada>,
  margemS: number = MARGEM_PADRAO_S
): ResultadoPausas {
  const v1 = [...(entrada.video[0] ?? [])].sort((a, b) => a.inicioQ - b.inicioQ);
  if (v1.length === 0) throw new Error("A V1 está vazia. Exporte a sequência com a gravação na V1.");
  const semAudio = v1.find((c) => c.midia.canais === 0);
  if (semAudio !== undefined) {
    throw new Error(`"${semAudio.midia.caminho}" não tem áudio. Áudio de gravador separado ainda não é suportado.`);
  }

  const { fps } = entrada;
  const avisos: string[] = [];
  if (entrada.video.slice(1).some((t) => t.length > 0) || entrada.audio.slice(1).some((t) => t.length > 0)) {
    avisos.push("Só a V1/A1 passa pelo corte: as outras trilhas ficaram de fora (o tempo delas não bateria mais).");
  }

  const fonteDe = (c: Clipe): FonteAnalisada => {
    const f = fontes.get(c.midia.caminho);
    if (f === undefined) throw new Error(`faltou analisar ${c.midia.caminho}`);
    return f;
  };
  // Palavra de duracao zero entraria como pausa de graca (montarPalavras do
  // painel descarta igual). O mesmo filtro vale antes e depois do corte, senao
  // a conferencia acusa palavra "a mais".
  const falaDe = (c: Clipe): PalavraEditada[] => fonteDe(c).palavras.filter((p) => p.fim > p.inicio);

  // `fonte` e o indice do CLIPE, nao do arquivo: o pedaco precisa voltar ao
  // clipe para herdar escala, posicao e espelho que o editor deu.
  const clipesQ: ClipeNaTimeline[] = v1.map((c, i) => ({ inicioQ: c.inicioQ, fimQ: c.fimQ, midiaQ: c.entradaQ, fonte: i }));
  const duracaoQ = Math.max(...v1.map((c) => c.fimQ));

  const naTimeline: Palavra[] = palavrasNaSequencia(v1, fps, (c) => fontes.get(c)?.palavras ?? []).map((p) => ({
    texto: p.text,
    inicio: p.inicio,
    fim: p.fim,
  }));

  const db = montarDaMidia(v1.map((c) => [...fonteDe(c).niveis]), JANELA_S, clipesQ, fps, duracaoQ, PISO_DB);
  if (db === null) throw new Error("O áudio lido não cobre a sequência inteira. Algum arquivo está mais curto que o clipe?");

  const blocos = blocosDeFala(db, JANELA_S, naTimeline);
  const plano = planejarCortes(blocos, { fps, duracaoQ, margemS });
  const { pedacos, totalQ } = pedacosDoPlano(plano.trechos, clipesQ);

  const video: Clipe[] = [];
  const audio: Clipe[] = [];
  const palavras: PalavraEditada[] = [];
  pedacos.forEach((p, k) => {
    const c = v1[p.fonte]!;
    const base = { midia: c.midia, inicioQ: p.destinoQ, fimQ: p.destinoQ + (p.midiaAteQ - p.midiaDeQ), entradaQ: p.midiaDeQ, grupo: `p${k}` };
    video.push({
      ...base,
      ...(c.escala !== undefined ? { escala: c.escala } : {}),
      ...(c.deslocamento !== undefined ? { deslocamento: c.deslocamento } : {}),
      ...(c.flop !== undefined ? { flop: c.flop } : {}),
      ...(c.recorte !== undefined ? { recorte: c.recorte } : {}),
    });
    audio.push(base);
    const de = p.midiaDeQ / fps;
    const ate = p.midiaAteQ / fps;
    for (const w of falaDe(c)) {
      if (w.inicio < de || w.inicio >= ate) continue;
      const desloca = p.destinoQ / fps - de;
      palavras.push({ ...w, inicio: w.inicio + desloca, fim: Math.min(w.fim, ate) + desloca });
    }
  });

  // Crossfade so onde dois pedacos se encostam: no espaco entre videos nao ha corte.
  const cruzamentos = audio
    .slice(1)
    .filter((c, i) => audio[i]!.fimQ === c.inicioQ)
    .map((c) => ({ trilha: 0, emQ: c.inicioQ, duracaoQ: CRUZAMENTO_Q }));

  const conferencia = conferirPalavras(
    [...naTimeline].sort((a, b) => a.inicio - b.inicio),
    palavras.map((p) => ({ texto: p.text, inicio: p.inicio, fim: p.fim }))
  );

  return {
    sequencia: {
      nome: `${entrada.nome} sem pausas`,
      fps,
      largura: entrada.largura,
      altura: entrada.altura,
      video: [video],
      audio: [audio],
      cruzamentos,
    },
    antesQ: duracaoQ,
    depoisQ: totalQ,
    cortes: plano.cortes.length,
    conferencia,
    palavras,
    cortesDeVideo: video.slice(1).map((c) => c.inicioQ / fps),
    avisos,
  };
}

/**
 * Brutas soltas (sem sequencia montada no Premiere): cada arquivo vira um
 * clipe inteiro na V1, com um respiro entre eles — o respiro e a separacao que
 * o corte preserva.
 */
export function sequenciaDasBrutas(
  brutas: ReadonlyArray<{ caminho: string; duracaoQ: number; largura: number; altura: number; canais: number }>,
  opcoes: { fps: number; largura: number; altura: number; respiroQ: number }
): Sequencia {
  let t = 0;
  const clipes: Clipe[] = brutas.map((b) => {
    // Preencher o quadro, arredondado para cima em passos de 5 (a bruta 4K
    // deitada numa sequencia 1080x1920 pede 88,9%; o Leo usa 90).
    const preencher = Math.max(opcoes.largura / b.largura, opcoes.altura / b.altura) * 100;
    const c: Clipe = {
      midia: { caminho: b.caminho, duracaoQ: b.duracaoQ, largura: b.largura, altura: b.altura, canais: b.canais },
      inicioQ: t,
      fimQ: t + b.duracaoQ,
      entradaQ: 0,
      escala: Math.ceil(preencher / 5) * 5,
    };
    t += b.duracaoQ + opcoes.respiroQ;
    return c;
  });
  return { nome: "Brutas", fps: opcoes.fps, largura: opcoes.largura, altura: opcoes.altura, video: [clipes], audio: [[]] };
}
