/*
 * Podcast AutoCut: a ponta que le disco. A regra mora em src/podcast.ts.
 * So precisa do nivel dos microfones: nada vai para o ElevenLabs.
 */

import { readFile, writeFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";

import { nivelPorJanela } from "../../../src/wav.ts";
import { cortarPodcast, JANELA_MS, MAPA_PADRAO, nivelDaTrilha } from "../podcast.ts";
import { lerSequenciaXml } from "../xml-ler.ts";
import { sequenciaParaXml, type Sequencia } from "../xml.ts";
import { audioParaTranscrever } from "./midia.ts";

export interface EntradaPodcast {
  readonly nome: string;
  readonly duracaoS: number;
  readonly pessoaA: string;
  readonly pessoaB: string;
  readonly avisos: string[];
}

export interface ResultadoPodcastSalvo {
  readonly trocas: number;
  readonly tempoA: number;
  readonly tempoB: number;
  readonly salvos: string[];
  readonly avisos: string[];
}

const arquivos = (t: Sequencia["audio"][number] | undefined): string[] => [...new Set((t ?? []).map((c) => basename(c.midia.caminho)))];

async function ler(caminho: string): Promise<{ s: Sequencia; avisos: string[]; duracaoQ: number }> {
  const { avisos, ...s } = lerSequenciaXml(await readFile(caminho, "utf8"));
  const m = MAPA_PADRAO;
  const faltando = [
    [s.video[m.videoA], "V1 (câmera da pessoa A)"],
    [s.audio[m.audioA], "A1 (microfone da pessoa A)"],
    [s.video[m.videoB], "V2 (câmera da pessoa B)"],
    [s.audio[m.audioB], "A2 (microfone da pessoa B)"],
  ].filter(([t]) => ((t as Sequencia["video"][number] | undefined) ?? []).length === 0);
  if (faltando.length > 0) throw new Error(`Falta ${faltando.map(([, nome]) => nome).join(", ")}. Sincronize as duas pessoas no Premiere antes de exportar.`);
  const duracaoQ = Math.max(...[...s.video, ...s.audio].flat().map((c) => c.fimQ));
  return { s, avisos, duracaoQ };
}

export async function abrirParaPodcast(caminho: string): Promise<EntradaPodcast> {
  const { s, avisos, duracaoQ } = await ler(caminho);
  return {
    nome: s.nome,
    duracaoS: duracaoQ / s.fps,
    pessoaA: arquivos(s.audio[MAPA_PADRAO.audioA]).join(", "),
    pessoaB: arquivos(s.audio[MAPA_PADRAO.audioB]).join(", "),
    avisos,
  };
}

export async function rodarPodcast(caminho: string, avisar: (t: string) => void): Promise<ResultadoPodcastSalvo> {
  const { s, avisos, duracaoQ } = await ler(caminho);
  const m = MAPA_PADRAO;

  const niveis = new Map<string, number[]>();
  const microfones = [...new Set([...(s.audio[m.audioA] ?? []), ...(s.audio[m.audioB] ?? [])].map((c) => c.midia.caminho))];
  for (const [i, arquivo] of microfones.entries()) {
    avisar(`lendo o microfone ${i + 1}/${microfones.length} ${basename(arquivo)}`);
    niveis.set(arquivo, [...(nivelPorJanela(await audioParaTranscrever(arquivo), JANELA_MS).db[0] ?? [])]);
  }

  avisar("decidindo quem fala");
  const dbDe = (c: string): number[] => niveis.get(c) ?? [];
  const r = cortarPodcast(
    s,
    nivelDaTrilha(s.audio[m.audioA] ?? [], s.fps, duracaoQ, dbDe),
    nivelDaTrilha(s.audio[m.audioB] ?? [], s.fps, duracaoQ, dbDe)
  );

  const saida = join(dirname(caminho), `${s.nome} - cortado.xml`);
  await writeFile(saida, sequenciaParaXml(r.sequencia), "utf8");
  return { trocas: r.trocas, tempoA: r.tempo.A, tempoB: r.tempo.B, salvos: [saida], avisos };
}
