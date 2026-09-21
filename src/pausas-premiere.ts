/*
 * Adapter do Auto Pausas. Le a sequencia, a transcricao e o AUDIO (exportado
 * pelo proprio plugin), e devolve tudo em tempo de sequencia.
 *
 * Nenhuma regra de corte mora aqui: quem decide o que sai e src/pausas.ts.
 */

import { caminhoParaUrl } from "../ferramentas/auto-broll/src/domain.ts";
import {
  comLimite,
  comTransacao,
  getSequenceInfo,
  lerClipes,
  writeJson,
  type SequenceInfo,
} from "../ferramentas/auto-broll/src/premiere.ts";
import { parseTranscricao, reconstruirTranscricao } from "../ferramentas/auto-broll/src/transcript.ts";
import { lerFps } from "./autocut-premiere.ts";
import { candidatosDoPreset, lacunas, montarPalavras, PRESET_WAV, type Palavra } from "./pausas.ts";
import { nivelPorJanela, wavCompleto } from "./wav.ts";

declare function require(id: string): unknown;
/* eslint-disable @typescript-eslint/no-explicit-any */
const ppro = require("premierepro") as any;
const uxp = require("uxp") as any;
/* eslint-enable @typescript-eslint/no-explicit-any */

const CLIP = 1; // ppro.Constants.TrackItemType.CLIP

interface ItemLike {
  getStartTime: () => Promise<{ seconds: number }>;
  getEndTime: () => Promise<{ seconds: number }>;
  getInPoint: () => Promise<{ seconds: number }>;
  getOutPoint: () => Promise<{ seconds: number }>;
  getProjectItem: () => Promise<unknown>;
}

interface SeqFaixas {
  getVideoTrack: (i: number) => Promise<{ getTrackItems: (t: number, e: boolean) => Promise<ItemLike[]> } | null>;
  getAudioTrack: (i: number) => Promise<{ getTrackItems: (t: number, e: boolean) => Promise<ItemLike[]> } | null>;
  getEndTime: () => Promise<{ seconds: number }>;
}

async function ativa(): Promise<{ project: unknown; sequence: unknown }> {
  const project = await ppro.Project.getActiveProject();
  if (!project) throw new Error("Nenhum projeto aberto.");
  const sequence = await project.getActiveSequence();
  if (!sequence) throw new Error("Nenhuma sequência ativa. Abra a sequência da gravação.");
  return { project, sequence };
}

/** Itens de uma faixa, em ordem de tempo — `getTrackItems` nao promete ordem. */
async function itensDa(sequence: unknown, video: boolean, indice: number): Promise<ItemLike[]> {
  const seq = sequence as SeqFaixas;
  const faixa = video ? await seq.getVideoTrack(indice) : await seq.getAudioTrack(indice);
  if (!faixa) return [];
  const itens = await faixa.getTrackItems(CLIP, false);
  const medidos = await Promise.all(itens.map(async (i) => ({ i, s: (await i.getStartTime()).seconds })));
  return medidos.sort((a, b) => a.s - b.s).map((m) => m.i);
}

/** O item do projeto por tras do (primeiro) clipe da V1, cru e como ClipProjectItem. */
async function midiaDaV1(): Promise<{ projectItem: unknown; clip: any }> {
  const { sequence } = await ativa();
  const [item] = await itensDa(sequence, true, 0);
  if (!item) throw new Error("Nenhum clipe na V1.");
  const projectItem = await item.getProjectItem();
  const clip = ppro.ClipProjectItem.cast(projectItem);
  if (!clip) throw new Error("O clipe da V1 não é um arquivo de mídia.");
  return { projectItem, clip };
}

/**
 * A transcricao do clipe da V1, pelo item que esta NA TIMELINE, e nao pelo
 * nome: a sequencia criada a partir do clipe costuma ter o mesmo nome dele.
 *
 * No Premiere 25, clipe SEM transcricao nao devolve vazio: `exportToJSON` lanca
 * "Illegal Parameter type" (os B-rolls dao esse erro nos logs do Auto B-roll).
 */
async function transcricaoDaV1(): Promise<string> {
  const { clip } = await midiaDaV1();
  let json: string | null = null;
  try {
    json = await comLimite("ler a transcrição", ppro.Transcript.exportToJSON(clip) as Promise<string | null>);
  } catch (e) {
    const msg = (e as Error)?.message ?? String(e);
    throw new Error(/illegal parameter/i.test(msg) ? "o clipe ainda não foi transcrito" : msg);
  }
  if (!json) throw new Error("o clipe ainda não foi transcrito");
  return json;
}

export interface Gravacao {
  readonly nomeSequencia: string;
  readonly fps: number;
  readonly duracaoQ: number;
  readonly palavras: readonly Palavra[];
}

type Clipe = Awaited<ReturnType<typeof lerClipes>>[number];

/**
 * A gravacao bruta: um clipe so na V1, com transcricao. Cada recusa diz o que
 * fazer — "nao deu" sem instrucao vira pergunta para mim depois.
 */
async function lerClipeETranscricao(): Promise<{ info: SequenceInfo; fps: number; clipe: Clipe; json: string }> {
  const info = await getSequenceInfo();
  // getSequenceInfo devolve fps 0 no Premiere 25 (rodada 6); lerFps vai pelo
  // sequence.getTimebase(), provado no 25 e no 26 pelo Podcast AutoCut.
  const fps = (await lerFps()).valor;
  if (!(fps > 0)) throw new Error("Não consegui ler a taxa de quadros da sequência.");
  const clipes = await lerClipes(0);

  if (clipes.length === 0) {
    throw new Error("Nenhum clipe na V1. Ponha a gravação na V1 com o áudio na A1.");
  }
  if (clipes.length > 1) {
    throw new Error(
      `A V1 tem ${clipes.length} clipes. O Auto Pausas roda na gravação bruta, antes de cortar takes, B-roll, música e legenda.`
    );
  }

  const clipe = clipes[0]!;
  let json: string;
  try {
    json = await transcricaoDaV1();
  } catch (e) {
    throw new Error(
      `"${clipe.sourceName}" não tem transcrição (${(e as Error)?.message ?? String(e)}). No Premiere: selecione o clipe, Janela > Texto > aba Transcrição > Transcrever, e rode de novo.`
    );
  }
  return { info, fps, clipe, json };
}

export async function lerGravacao(): Promise<Gravacao> {
  const { info, fps, clipe, json } = await lerClipeETranscricao();
  const transcricao = parseTranscricao(json);
  if (!transcricao) {
    throw new Error(`A transcrição de "${clipe.sourceName}" veio num formato que não consegui ler.`);
  }

  const palavras = montarPalavras(reconstruirTranscricao([clipe], new Map([[clipe.sourceName, transcricao]])));
  if (palavras.length === 0) {
    throw new Error("A transcrição não tem nenhuma palavra dentro deste trecho da timeline.");
  }

  return {
    nomeSequencia: info.name,
    fps,
    duracaoQ: Math.round((clipe.endSeconds - clipe.startSeconds) * fps),
    palavras,
  };
}

// ------------------------------------------------------------------ audio

interface Entrada {
  readonly name: string;
  readonly nativePath: string;
  readonly isFolder?: boolean;
  read(opcoes?: unknown): Promise<unknown>;
  delete(): Promise<unknown>;
  getEntries?(): Promise<Entrada[]>;
}

/** Arquivo ou pasta num caminho absoluto, ou null se nao existir. */
async function entrada(caminho: string): Promise<Entrada | null> {
  try {
    return ((await uxp.storage.localFileSystem.getEntryWithUrl(caminhoParaUrl(caminho))) as Entrada | null) ?? null;
  } catch {
    return null;
  }
}

async function lerBytes(arquivo: Entrada): Promise<Uint8Array> {
  return new Uint8Array((await arquivo.read({ format: uxp.storage.formats.binary })) as ArrayBuffer);
}

export async function apagarArquivo(caminho: string): Promise<void> {
  const velho = await entrada(caminho);
  if (velho) await velho.delete();
}

/** O preset de WAV mono 16 kHz que vem com o Premiere. Lanca dizendo onde procurou. */
export async function acharPreset(): Promise<string> {
  const adobe = await entrada("C:\\Program Files\\Adobe");
  const pastas = adobe?.getEntries ? (await adobe.getEntries()).filter((e) => e.isFolder).map((e) => e.name) : [];
  const tentados = candidatosDoPreset(String(uxp.host?.version ?? ""), pastas);
  for (const caminho of tentados) {
    if (await entrada(caminho)) return caminho;
  }
  throw new Error(
    `Não achei o preset de áudio do Premiere (${PRESET_WAV}). Procurei em: ${
      tentados.join(" ; ") || "nenhuma pasta do Premiere em C:\\Program Files\\Adobe"
    }.`
  );
}

/**
 * Exporta o audio da sequencia ativa como WAV mono 16 kHz na pasta de dados do
 * plugin. E o mesmo metodo do AutoCut: o plugin extrai o audio sozinho, dentro
 * do clique — nada de export manual.
 *
 * Se a promessa voltar antes de o arquivo fechar, espera o cabecalho RIFF
 * fechar (ate 10 s). Na rodada 4 (25.6.6) ele ja veio completo: 865 s em 5,8 s.
 */
export async function exportarAudio(nomeArquivo: string): Promise<{
  readonly caminho: string;
  readonly preset: string;
  readonly ms: number;
  readonly bytes: Uint8Array;
  readonly completoNaHora: boolean;
}> {
  const preset = await acharPreset();
  const pasta = (await uxp.storage.localFileSystem.getDataFolder()) as { nativePath: string };
  const caminho = `${pasta.nativePath.replace(/[\\/]+$/, "")}\\${nomeArquivo}`;
  await apagarArquivo(caminho);

  const { sequence } = await ativa();
  const encoder = ppro.EncoderManager.getManager();
  const tipo = ppro.Constants?.ExportType?.IMMEDIATELY ?? ppro.EncoderManager.EXPORT_IMMEDIATELY;
  const t0 = Date.now();
  const aceitou = await comLimite(
    "exportar o áudio da sequência",
    encoder.exportSequence(sequence, tipo, caminho, preset, true) as Promise<boolean>,
    10 * 60 * 1000
  );
  if (!aceitou) throw new Error("O Premiere recusou exportar o áudio da sequência.");
  const ms = Date.now() - t0;

  const arquivo = await entrada(caminho);
  if (!arquivo) throw new Error(`O export terminou, mas o arquivo não apareceu em ${caminho}.`);
  let bytes = await lerBytes(arquivo);
  const completoNaHora = wavCompleto(bytes);
  for (let tentativa = 0; !wavCompleto(bytes) && tentativa < 20; tentativa++) {
    await new Promise((r) => setTimeout(r, 500));
    bytes = await lerBytes(arquivo);
  }
  return { caminho, preset, ms, bytes, completoNaHora };
}

// --------------------------------------------------------------- sonda

/*
 * As rodadas 4 e 5 (Premiere 25.6.6) fecharam a mecanica — ver DEV_NOTES:
 * overwrite do ProjectItem CRU respeita o in/out marcado no item do projeto,
 * mas so o marcado ANTES da transacao; entao e um trecho por transacao.
 *
 * O que sobra para o Diagnostico e juntar, da MESMA bruta, o audio e a
 * transcricao para a calibracao. Nao mexe mais na timeline.
 */

/** A rodada 4 deixou o clipe com in/out 5-6 s no painel Projeto: limpar. */
async function limparMarcasDaV1(): Promise<string> {
  const { project } = await ativa();
  const { clip } = await midiaDaV1();
  comTransacao(project as never, "Auto Pausas: limpar marcas do clipe", (adicionar) => {
    adicionar(clip.createClearInOutPointsAction());
  });
  const { clip: lido } = await midiaDaV1();
  const VIDEO = ppro.Constants.MediaType.VIDEO;
  return `marcas do clipe limpas: in/out agora ${(await lido.getInPoint(VIDEO)).seconds.toFixed(2)}–${(
    await lido.getOutPoint(VIDEO)
  ).seconds.toFixed(2)} s`;
}

/**
 * Rodada 6 — so leitura: limpa as marcas que a rodada 4 esqueceu, exporta o
 * audio e guarda a transcricao da mesma bruta. O WAV e a transcricao ficam na
 * pasta de dados para a calibracao; o registro vai para pausas-diag.json.
 */
export async function diagnostico(): Promise<string[]> {
  const linhas: string[] = [];
  const dados: Record<string, unknown> = { quando: new Date().toISOString(), host: String(uxp.host?.version ?? "?") };
  const falha = (passo: string, e: unknown) => linhas.push(`${passo} falhou: ${(e as Error)?.message ?? String(e)}`);

  try {
    linhas.push(await limparMarcasDaV1());
  } catch (e) {
    falha("limpar marcas", e);
  }

  linhas.push(`== 1. Áudio (Premiere ${dados.host})`);
  try {
    const info = await getSequenceInfo();
    const r = await exportarAudio("pausas-diag.wav");
    const janelas = nivelPorJanela(r.bytes);
    const db = janelas.db[0] ?? [];
    const ordenado = [...db].sort((a, b) => a - b);
    const p = (q: number) => (ordenado[Math.floor((ordenado.length - 1) * q)] ?? NaN).toFixed(1);
    const segundos = (db.length * janelas.janelaMs) / 1000;
    linhas.push(
      `export: ${(r.ms / 1000).toFixed(1)} s · ${(r.bytes.byteLength / 1e6).toFixed(1)} MB · completo: ${wavCompleto(r.bytes) ? "sim" : "NÃO"}`,
      `WAV: ${janelas.db.length} canal(is) a ${janelas.taxa} Hz · ${segundos.toFixed(1)} s de áudio (sequência: ${info.durationSeconds.toFixed(1)} s)`,
      `níveis (dB): p10 ${p(0.1)} · p20 ${p(0.2)} · p50 ${p(0.5)} · p90 ${p(0.9)} · p99 ${p(0.99)}`
    );
    dados.audio = { ms: r.ms, bytes: r.bytes.byteLength, taxa: janelas.taxa, canais: janelas.db.length, segundos };
  } catch (e) {
    falha("1) áudio", e);
  }

  linhas.push("== 2. Transcrição");
  try {
    const { fps, clipe, json } = await lerClipeETranscricao();
    await writeJson("pausas-diag-transcricao.json", JSON.parse(json));
    const t = parseTranscricao(json);
    const palavras = t ? t.segments.flatMap((s) => s.words.filter((w) => w.type === "word")) : [];
    const l = lacunas(palavras);
    linhas.push(
      `clipe "${clipe.sourceName}" ${clipe.startSeconds.toFixed(2)}–${clipe.endSeconds.toFixed(2)} s · ${fps} fps`,
      `${l.total} palavras · espaços > 0,2 s: ${l.acima02} · > 0,5 s: ${l.acima05}`
    );
    dados.clipe = clipe;
    dados.fps = fps;
    dados.lacunas = l;
  } catch (e) {
    falha("2) transcrição", e);
  }

  linhas.push("Pronto. Nada foi mexido na timeline.");
  dados.linhas = linhas;
  try {
    await writeJson("pausas-diag.json", dados);
  } catch (e) {
    falha("gravar pausas-diag.json", e);
  }
  return linhas;
}
