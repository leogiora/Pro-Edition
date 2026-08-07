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
const RECIPIENTES = new Set(["moov", "trak", "mdia", "edts", "minf", "stbl"]);

/** moov > trak > mdia > minf > stbl > stsz sao seis niveis. */
const PROFUNDIDADE_MAXIMA = 6;

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

interface Box {
  readonly tipo: string;
  /** Primeiro byte do conteudo. */
  readonly conteudo: number;
  /** Primeiro byte DEPOIS do box. */
  readonly fim: number;
}

/**
 * Percorre os boxes de uma faixa de bytes.
 *
 * Devolve `null` no primeiro sinal de arquivo truncado ou tamanho impossivel —
 * seguir adiante de um box malformado e como entrar em laco.
 */
function boxesEm(bytes: Uint8Array, inicio: number, fim: number): Box[] | null {
  const achados: Box[] = [];
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

    achados.push({ tipo, conteudo, fim: posicao + tamanho });
    posicao += tamanho;
  }
  return achados;
}

/** Primeiro box do tipo pedido, descendo por recipientes. */
function procurar(
  bytes: Uint8Array,
  inicio: number,
  fim: number,
  tipo: string,
  profundidade = 0
): Box | null {
  if (profundidade > PROFUNDIDADE_MAXIMA) return null;
  const lista = boxesEm(bytes, inicio, fim);
  if (lista === null) return null;

  for (const box of lista) {
    if (box.tipo === tipo) return box;
    if (RECIPIENTES.has(box.tipo)) {
      const achado = procurar(bytes, box.conteudo, box.fim, tipo, profundidade + 1);
      if (achado) return achado;
    }
  }
  return null;
}

/**
 * O trak de video, com o que se sabe dele.
 *
 * O pareamento importa: `tkhd` e `stsz` precisam vir do MESMO trak, senao a
 * tabela de quadros lida seria a do audio — que existe em 147 dos 260 arquivos
 * desta biblioteca.
 */
interface TrakDeVideo {
  readonly tamanho: Size;
  readonly amostras: readonly number[] | null;
}

function trakDeVideo(bytes: Uint8Array): TrakDeVideo | null {
  const moov = procurar(bytes, 0, bytes.length, "moov");
  if (!moov) return null;

  const dentro = boxesEm(bytes, moov.conteudo, moov.fim);
  if (dentro === null) return null;

  for (const trak of dentro) {
    if (trak.tipo !== "trak") continue;

    const tkhd = procurar(bytes, trak.conteudo, trak.fim, "tkhd");
    if (!tkhd) continue;
    const tamanho = lerTkhd(bytes, tkhd.conteudo);
    // Track de audio tem tkhd com largura e altura zeradas: pular.
    if (!tamanho) continue;

    const stsz = procurar(bytes, trak.conteudo, trak.fim, "stsz");
    return { tamanho, amostras: stsz ? lerStsz(bytes, stsz.conteudo, stsz.fim) : null };
  }
  return null;
}

/**
 * Largura e altura de exibicao do primeiro track de video.
 *
 * Devolve `null` quando nao encontra — nunca chuta, porque escala errada corta
 * a imagem no lugar errado, o que e pior que nao escalar.
 */
export function dimensoesDeMp4(bytes: Uint8Array): Size | null {
  return trakDeVideo(bytes)?.tamanho ?? null;
}

/**
 * Quanto o clipe se mexe, em bytes por quadro por pixel.
 *
 * Movimento obriga o codificador a gastar mais bits no mesmo quadro. Dividir
 * pelos pixels normaliza a medida, o que e obrigatorio aqui: 47% da biblioteca e
 * 464x832 e 52% e 720x1280, e comparar bytes crus entre os dois nao diz nada.
 *
 * O numero nao tem unidade util sozinho — so serve comparado com os irmaos do
 * mesmo conceito. Ver `src/intensidade.ts`.
 */
export function agitacaoDeMp4(bytes: Uint8Array): number | null {
  const trak = trakDeVideo(bytes);
  if (!trak?.amostras || trak.amostras.length === 0) return null;

  const pixels = trak.tamanho.width * trak.tamanho.height;
  if (pixels <= 0) return null;

  const soma = trak.amostras.reduce((s, n) => s + n, 0);
  return soma / trak.amostras.length / pixels;
}

/**
 * Tabela de tamanhos de quadro.
 *
 * `sample_size` diferente de zero significa que todos os quadros tem o mesmo
 * tamanho — nao ha variacao para medir, entao nao ha agitacao a extrair.
 */
function lerStsz(bytes: Uint8Array, inicio: number, fimDoBox: number): number[] | null {
  if (inicio + 12 > fimDoBox) return null;

  const tamanhoUnico = uint32(bytes, inicio + 4);
  if (tamanhoUnico !== 0) return null;

  const quantidade = uint32(bytes, inicio + 8);
  if (quantidade === 0) return null;

  const amostras: number[] = [];
  let posicao = inicio + 12;
  for (let i = 0; i < quantidade; i++) {
    // Quantidade mentirosa em arquivo corrompido: parar em vez de ler lixo.
    if (posicao + 4 > fimDoBox) return null;
    amostras.push(uint32(bytes, posicao));
    posicao += 4;
  }
  return amostras;
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
