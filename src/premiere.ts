/*
 * Unica porta de entrada para a API do Premiere. A UI nunca chama `ppro`
 * direto: ela fala com estas funcoes, que devolvem tipos do dominio.
 *
 * Tudo aqui vem de prova executada no auto-broll. Ver docs/API_PROOFS.md.
 */

import type { ClipeComOrigem } from "./transcript.ts";

declare function require(id: string): unknown;

// Fronteira nao tipada: o modulo do host chega sem tipos. Ele e restringido
// aqui, uma vez, e o resto do arquivo trabalha com as interfaces abaixo.
/* eslint-disable @typescript-eslint/no-explicit-any */
const ppro = require("premierepro") as any;
/* eslint-enable @typescript-eslint/no-explicit-any */

export interface SequenceInfo {
  readonly name: string;
  readonly fps: number;
  readonly videoTracks: number;
  readonly captionTracks: number;
}

interface Handles {
  readonly project: unknown;
  readonly sequence: unknown;
  readonly rootItem: unknown;
}

/**
 * Varias chamadas do UXP nunca resolvem nem rejeitam. Sem isto o painel fica
 * preso em "carregando" para sempre, sem erro e sem log, e o diagnostico vira
 * adivinhacao.
 */
export async function comLimite<T>(rotulo: string, tarefa: Promise<T>, ms = 15000): Promise<T> {
  let timer: ReturnType<typeof setTimeout> | undefined;
  try {
    return await Promise.race([
      tarefa,
      new Promise<never>((_, rejeitar) => {
        timer = setTimeout(() => rejeitar(new Error(`${rotulo}: sem resposta em ${ms / 1000}s`)), ms);
      }),
    ]);
  } finally {
    if (timer !== undefined) clearTimeout(timer);
  }
}

/** Nada e reaproveitado entre etapas: uma escrita invalida handles anteriores. */
async function handles(): Promise<Handles> {
  const project = await ppro.Project.getActiveProject();
  if (!project) throw new Error("Nenhum projeto aberto.");
  const sequence = await project.getActiveSequence();
  if (!sequence) throw new Error("Nenhuma sequencia ativa. Abra uma sequencia na timeline.");
  return { project, sequence, rootItem: await project.getRootItem() };
}

const CLIP = 1; // ppro.Constants.TrackItemType.CLIP, fixado na prova P0.3

export async function getSequenceInfo(): Promise<SequenceInfo> {
  const { sequence } = await handles();
  const seq = sequence as {
    name: string;
    getSettings: () => Promise<{ getVideoFrameRate: () => Promise<{ value: number }> }>;
    getVideoTrackCount: () => Promise<number>;
    getCaptionTrackCount: () => Promise<number>;
  };
  // getFrameSize() devolve {} e e inutil (P1.4); o frame rate vem de getSettings.
  const taxa = await (await seq.getSettings()).getVideoFrameRate();
  return {
    name: seq.name,
    fps: taxa.value,
    videoTracks: await seq.getVideoTrackCount(),
    captionTracks: await seq.getCaptionTrackCount(),
  };
}

/**
 * Clipes de uma faixa de video, com o nome da midia de origem.
 * V1 (indice 0) e a camera principal: e dela que sai a transcricao.
 */
export async function lerClipes(videoTrackIndex = 0): Promise<ClipeComOrigem[]> {
  const { sequence } = await handles();
  const seq = sequence as {
    getVideoTrack: (i: number) => Promise<{
      getTrackItems: (t: number, empty: boolean) => Promise<
        Array<{
          getStartTime: () => Promise<{ seconds: number }>;
          getEndTime: () => Promise<{ seconds: number }>;
          getInPoint: () => Promise<{ seconds: number }>;
          getOutPoint: () => Promise<{ seconds: number }>;
          getSpeed: () => Promise<number>;
          getProjectItem: () => Promise<{ name: string } | null>;
        }>
      >;
    }>;
  };

  const faixa = await seq.getVideoTrack(videoTrackIndex);
  const saida: ClipeComOrigem[] = [];
  for (const it of await faixa.getTrackItems(CLIP, false)) {
    const origem = await it.getProjectItem();
    if (!origem?.name) continue;
    const velocidade = await it.getSpeed();
    saida.push({
      sourceName: origem.name,
      startSeconds: (await it.getStartTime()).seconds,
      endSeconds: (await it.getEndTime()).seconds,
      inPointSeconds: (await it.getInPoint()).seconds,
      outPointSeconds: (await it.getOutPoint()).seconds,
      // Velocidade 0 tornaria o remapeamento uma divisao por zero.
      speed: velocidade > 0 ? velocidade : 1,
    });
  }
  return saida;
}

/** Instantes de corte da faixa, em segundos de sequencia. */
export async function lerCortes(videoTrackIndex = 0): Promise<number[]> {
  const clipes = await lerClipes(videoTrackIndex);
  // O inicio do primeiro clipe nao e corte: nao ha troca de imagem ali.
  return clipes.slice(1).map((c) => c.startSeconds);
}

/** Transcricao bruta de cada midia que tiver uma. Chave: nome do ProjectItem. */
export async function lerTranscricoes(nomes: readonly string[]): Promise<Map<string, string>> {
  const { rootItem } = await handles();
  const raiz = rootItem as { getItems: () => Promise<Array<{ name: string }>> };
  const itens = await raiz.getItems();
  const saida = new Map<string, string>();

  for (const nome of new Set(nomes)) {
    const item = itens.find((i) => i.name === nome);
    if (!item) continue;
    try {
      const clip = ppro.ClipProjectItem.cast(item) ?? item;
      if (!(await ppro.Transcript.hasTranscript(clip))) continue;
      saida.set(nome, (await ppro.Transcript.exportToJSON(clip)) as string);
    } catch {
      // Midia sem transcricao ou offline: seguir sem ela.
    }
  }
  return saida;
}
