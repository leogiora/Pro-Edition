/*
 * Leitura da resolucao direto do cabecalho MP4.
 *
 * Por que existe: `ProjectItem` do Premiere nao expoe largura nem altura,
 * `Media` so tem start/duration, `FootageInterpretation` so tem frame rate, e o
 * XMP nao trouxe `videoFrameSize` nos arquivos reais desta biblioteca (medido:
 * "resolucao indisponivel" nos tres B-rolls inseridos). Sem a resolucao nao da
 * para calcular a escala de preenchimento.
 *
 * O container MP4 e uma arvore de "boxes": [tamanho:4][tipo:4][conteudo].
 * A resolucao de exibicao esta no `tkhd`, dentro de moov > trak.
 *
 * Puro: recebe bytes, devolve dimensao. Testavel sem Premiere e sem disco.
 */

import type { Size } from "./domain.ts";

/** Boxes que sao apenas recipientes de outros boxes. */
const RECIPIENTES = new Set(["moov", "trak", "mdia", "edts"]);

/** Ate onde vale procurar. Evita varrer um arquivo inteiro por engano. */
const PROFUNDIDADE_MAXIMA = 4;

function texto(bytes: Uint8Array, inicio: number): string {
  return String.fromCharCode(bytes[inicio] ?? 0, bytes[inicio + 1] ?? 0, bytes[inicio + 2] ?? 0, bytes[inicio + 3] ?? 0);
}

function uint32(bytes: Uint8Array, inicio: number): number {
  return (
    ((bytes[inicio] ?? 0) << 24) |
    ((bytes[inicio + 1] ?? 0) << 16) |
    ((bytes[inicio + 2] ?? 0) << 8) |
    (bytes[inicio + 3] ?? 0)
  ) >>> 0;
}

/**
 * Largura e altura de exibicao do primeiro track de video.
 *
 * Devolve `null` quando nao encontra — nunca chuta, porque escala errada corta
 * a imagem no lugar errado, o que e pior que nao escalar.
 */
export function dimensoesDeMp4(bytes: Uint8Array): Size | null {
  return varrer(bytes, 0, bytes.length, 0);
}

function varrer(bytes: Uint8Array, inicio: number, fim: number, profundidade: number): Size | null {
  if (profundidade > PROFUNDIDADE_MAXIMA) return null;

  let posicao = inicio;
  while (posicao + 8 <= fim) {
    let tamanho = uint32(bytes, posicao);
    const tipo = texto(bytes, posicao + 4);
    let conteudo = posicao + 8;

    // tamanho 1 significa que o tamanho real vem em 64 bits logo depois.
    if (tamanho === 1) {
      // Os 32 bits altos sao ignorados: box de mais de 4 GB nao ocorre aqui.
      tamanho = uint32(bytes, posicao + 12);
      conteudo = posicao + 16;
    } else if (tamanho === 0) {
      tamanho = fim - posicao; // vai ate o fim do arquivo
    }

    if (tamanho < 8 || posicao + tamanho > fim) return null; // arquivo truncado

    if (tipo === "tkhd") {
      const tamanhoDoTrack = lerTkhd(bytes, conteudo);
      // Track de audio tem tkhd com largura e altura zeradas: pular.
      if (tamanhoDoTrack) return tamanhoDoTrack;
    } else if (RECIPIENTES.has(tipo)) {
      const achado = varrer(bytes, conteudo, posicao + tamanho, profundidade + 1);
      if (achado) return achado;
    }

    posicao += tamanho;
  }
  return null;
}

function lerTkhd(bytes: Uint8Array, inicio: number): Size | null {
  const versao = bytes[inicio] ?? 0;

  // Depois de versao(1)+flags(3) vem, conforme a versao:
  //   v0: criacao(4) modificacao(4) trackID(4) reservado(4) duracao(4)  = 20
  //   v1: criacao(8) modificacao(8) trackID(4) reservado(4) duracao(8)  = 32
  // e em seguida, iguais nas duas: reservado(8) layer(2) grupo(2)
  // volume(2) reservado(2) matriz(36) = 52, ate chegar em largura e altura.
  const camposDeTempo = versao === 1 ? 32 : 20;
  const largura = inicio + 4 + camposDeTempo + 52;

  if (largura + 8 > bytes.length) return null;

  // Ponto fixo 16.16: os 16 bits altos sao a parte inteira.
  const width = uint32(bytes, largura) >>> 16;
  const height = uint32(bytes, largura + 4) >>> 16;

  return width > 0 && height > 0 ? { width, height } : null;
}
