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
  lerTranscricoes,
  writeJson,
  type SequenceInfo,
} from "../ferramentas/auto-broll/src/premiere.ts";
import { parseTranscricao, reconstruirTranscricao } from "../ferramentas/auto-broll/src/transcript.ts";
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
  createSetInPointAction: (t: unknown) => unknown;
  createSetEndAction: (t: unknown) => unknown;
}

interface SeqFaixas {
  getVideoTrack: (i: number) => Promise<{ getTrackItems: (t: number, e: boolean) => Promise<ItemLike[]> } | null>;
  getAudioTrack: (i: number) => Promise<{ getTrackItems: (t: number, e: boolean) => Promise<ItemLike[]> } | null>;
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
async function lerClipeETranscricao(): Promise<{ info: SequenceInfo; clipe: Clipe; json: string }> {
  const info = await getSequenceInfo();
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
  const { transcricoes, falhas } = await lerTranscricoes([clipe.sourceName]);
  const json = transcricoes.get(clipe.sourceName);
  if (!json) {
    const motivo = falhas.find((f) => f.nome === clipe.sourceName)?.motivo ?? "sem transcrição";
    throw new Error(
      `"${clipe.sourceName}" não tem transcrição (${motivo}). No Premiere: painel Texto > Transcrever, e rode de novo.`
    );
  }
  return { info, clipe, json };
}

export async function lerGravacao(): Promise<Gravacao> {
  const { info, clipe, json } = await lerClipeETranscricao();
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
    fps: info.fps,
    duracaoQ: Math.round((clipe.endSeconds - clipe.startSeconds) * info.fps),
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
 * fechar (ate 10 s). `completoNaHora` responde se essa espera e necessaria.
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
 * O que as duas primeiras rodadas provaram, no Premiere 26 (fps 23,976):
 *
 *  1. `createCloneTrackItemAction(item, offset, 0, 0, true, false)` CORTA o
 *     clipe no offset pedido. Atinge SO a faixa do item: V1 e A1 precisam cada
 *     uma da sua acao (a A1 ficou inteira quando so a V1 foi clonada).
 *  2. `createRemoveItemsAction(selecao, true, ANY)` FECHA o buraco: removendo o
 *     pedaco do meio ([2-4] de tres pedacos), o terceiro andou de 4,00 para
 *     2,00 nas DUAS faixas e o fim caiu exatamente 2 s. Sincronia mantida.
 *  3. Todo pedaco nasce com `in=0.00`, herdado do pai. Um clipe mostra
 *     `in + (t - inicio)` da midia, entao um pedaco com in errado mostra o
 *     video desde o comeco de novo. Isso PRECISA ser corrigido.
 *  4. `createSetInPointAction` grava o valor exato pedido, mas na rodada 1 ele
 *     APAROU A CABECA: o pedaco andou de 1,00 para 3,00 ao receber in=2,00.
 *     So que aquele pedaco era o ultimo e passava do fim da midia (101,64 num
 *     arquivo de 100,64), o que pode explicar o comportamento.
 *
 * A rodada 3 (esta funcao) decide o ponto 4 num pedaco do MEIO, que e o caso
 * real, e testa o `createMoveAction` como plano de recuperacao caso o pedaco ande.
 */
async function sondaMecanica(linhas: string[]): Promise<void> {
  const medir = async (video: boolean) => {
    const { sequence } = await ativa();
    const itens = await itensDa(sequence, video, 0);
    return Promise.all(
      itens.map(async (i) => ({
        item: i,
        inicio: (await i.getStartTime()).seconds,
        fim: (await i.getEndTime()).seconds,
        entrada: (await i.getInPoint()).seconds,
        saida: (await i.getOutPoint()).seconds,
      }))
    );
  };

  const retrato = async (rotulo: string) => {
    for (const [nome, video] of [
      ["V1", true],
      ["A1", false],
    ] as const) {
      const pecas = await medir(video);
      linhas.push(
        `${rotulo}: ${nome} ${pecas.length}x [${pecas
          .map((p) => `${p.inicio.toFixed(2)}-${p.fim.toFixed(2)} in=${p.entrada.toFixed(2)} out=${p.saida.toFixed(2)}`)
          .join(" | ")}]`
      );
    }
  };

  const cortarEm = async (segundos: number) => {
    const { project, sequence } = await ativa();
    const editor = await ppro.SequenceEditor.getEditor(sequence);
    const alvos: Array<{ item: ItemLike; offset: unknown }> = [];
    for (const video of [true, false]) {
      for (const p of await medir(video)) {
        if (segundos <= p.inicio || segundos >= p.fim) continue;
        alvos.push({ item: p.item, offset: await ppro.TickTime.createWithSeconds(segundos - p.inicio) });
      }
    }
    comTransacao(project as never, `Auto Pausas: sonda corte em ${segundos}s`, (adicionar) => {
      for (const a of alvos) adicionar(editor.createCloneTrackItemAction(a.item, a.offset, 0, 0, true, false));
    });
  };

  await retrato("antes");
  try {
    await cortarEm(2);
    await cortarEm(4);
  } catch (e) {
    linhas.push(`corte lancou: ${(e as Error)?.message ?? String(e)}`);
  }
  await retrato("A) 3 pedacos");

  // A pergunta da rodada: num pedaco do MEIO, setInPoint alinha o conteudo sem
  // mover, ou apara a cabeca e empurra o pedaco para a direita?
  try {
    const { project } = await ativa();
    const meio = (await medir(true)).find((p) => Math.abs(p.inicio - 2) < 0.01);
    if (!meio) throw new Error("nao achei o pedaco que comeca em 2s");
    const alvo = await ppro.TickTime.createWithSeconds(2);
    comTransacao(project as never, "Auto Pausas: sonda in point no meio", (adicionar) => {
      adicionar(meio.item.createSetInPointAction(alvo));
    });
  } catch (e) {
    linhas.push(`setInPoint lancou: ${(e as Error)?.message ?? String(e)}`);
  }
  const depoisDoIn = await medir(true);
  await retrato("B) depois do setInPoint(2s) no pedaco do meio");
  const doMeio = depoisDoIn.find((p) => Math.abs(p.entrada - 2) < 0.01);
  linhas.push(
    doMeio && Math.abs(doMeio.inicio - 2) < 0.01
      ? "B) LEITURA: o pedaco FICOU em 2,00s com in=2,00 — alinha sem mover. Otimo."
      : `B) LEITURA: o pedaco ANDOU para ${doMeio?.inicio.toFixed(2)}s — setInPoint apara a cabeca.`
  );

  // Plano de recuperacao: createMoveAction existe na tipagem mas nunca foi
  // usado neste projeto. Tento levar o pedaco de volta para 2,00s.
  if (doMeio && Math.abs(doMeio.inicio - 2) >= 0.01) {
    try {
      const { project } = await ativa();
      const atual = doMeio.inicio;
      const destino = await ppro.TickTime.createWithSeconds(2);
      comTransacao(project as never, "Auto Pausas: sonda move", (adicionar) => {
        adicionar((doMeio.item as unknown as { createMoveAction: (t: unknown) => unknown }).createMoveAction(destino));
      });
      const agora = (await medir(true)).find((p) => Math.abs(p.entrada - 2) < 0.01);
      linhas.push(
        `C) move(2,00s): pedaco saiu de ${atual.toFixed(2)} e foi para ${agora?.inicio.toFixed(2)} ` +
          "(se foi para 4,00 o valor e relativo, se foi para 2,00 e absoluto)"
      );
    } catch (e) {
      linhas.push(`C) move lancou: ${(e as Error)?.message ?? String(e)}`);
    }
    await retrato("C) depois do move");
  }
}

/**
 * Plano C da mecanica, testado na mesma ida: marcar in/out NO ITEM DO PROJETO
 * e fazer overwrite. Se o pedaco inserido mostrar so o trecho marcado, da para
 * remontar a gravacao inteira sem depender do setInPoint dos clones.
 * Devolve o in/out do item ao que era antes.
 */
async function sondaOverwrite(linhas: string[]): Promise<void> {
  // Handles novos antes de cada transacao, como na sonda da rodada 3.
  const clipDaV1 = async () => {
    const { sequence } = await ativa();
    const [item] = await itensDa(sequence, true, 0);
    if (!item) throw new Error("V1 vazia");
    const pi = await (item as unknown as { getProjectItem: () => Promise<unknown> }).getProjectItem();
    const clip = ppro.ClipProjectItem.cast(pi);
    if (!clip) throw new Error("o clipe da V1 nao e um ClipProjectItem");
    return clip;
  };

  const VIDEO = ppro.Constants.MediaType.VIDEO;
  const original = await clipDaV1();
  const inAntes = await original.getInPoint(VIDEO);
  const outAntes = await original.getOutPoint(VIDEO);
  const { sequence: seq } = await ativa();
  const destino = (await (seq as { getEndTime: () => Promise<{ seconds: number }> }).getEndTime()).seconds + 2;

  {
    const { project } = await ativa();
    const clip = await clipDaV1();
    const marcarIn = await ppro.TickTime.createWithSeconds(5);
    const marcarOut = await ppro.TickTime.createWithSeconds(6);
    comTransacao(project as never, "Auto Pausas: sonda in/out no item", (adicionar) => {
      adicionar(clip.createSetInOutPointsAction(marcarIn, marcarOut));
    });
  }
  {
    const { project, sequence } = await ativa();
    const clip = await clipDaV1();
    const editor = await ppro.SequenceEditor.getEditor(sequence);
    const em = await ppro.TickTime.createWithSeconds(destino);
    comTransacao(project as never, "Auto Pausas: sonda overwrite", (adicionar) => {
      adicionar(editor.createOverwriteItemAction(clip, em, 0, 0));
    });
  }

  const { sequence } = await ativa();
  const pecas = await itensDa(sequence, true, 0);
  const nova = (
    await Promise.all(
      pecas.map(async (i) => ({
        inicio: (await i.getStartTime()).seconds,
        fim: (await i.getEndTime()).seconds,
        entrada: (await i.getInPoint()).seconds,
      }))
    )
  ).find((p) => Math.abs(p.inicio - destino) < 0.05);
  linhas.push(
    nova
      ? `D) overwrite com in/out 5-6 s: pedaco em ${nova.inicio.toFixed(2)}-${nova.fim.toFixed(2)} mostrando a midia desde ${nova.entrada.toFixed(2)} s`
      : `D) overwrite com in/out: NENHUM pedaco apareceu em ${destino.toFixed(2)} s`,
    nova && Math.abs(nova.entrada - 5) < 0.05 && Math.abs(nova.fim - nova.inicio - 1) < 0.05
      ? "D) LEITURA: overwrite respeita o in/out do item — remontagem pelo plano C funciona."
      : "D) LEITURA: overwrite NAO respeitou o in/out marcado."
  );

  {
    const { project } = await ativa();
    const clip = await clipDaV1();
    comTransacao(project as never, "Auto Pausas: sonda devolve in/out", (adicionar) => {
      adicionar(clip.createSetInOutPointsAction(inAntes, outAntes));
    });
  }
}

/**
 * Rodada 4 — uma ida ao Premiere responde tudo que falta:
 *  1. o export do audio pelo proprio plugin funciona? quanto tempo, que formato?
 *  2. a transcricao do 26 atual ainda marca pausa?
 *  3. a mecanica de corte (rodada 3) e o plano C (overwrite com in/out).
 * O WAV e a transcricao ficam na pasta de dados para a calibracao (Task 7);
 * o registro tambem vai para pausas-diag.json, para ninguem precisar colar log.
 */
export async function diagnostico(): Promise<string[]> {
  const linhas: string[] = [];
  const dados: Record<string, unknown> = { quando: new Date().toISOString(), host: String(uxp.host?.version ?? "?") };
  const falha = (passo: string, e: unknown) => linhas.push(`${passo} falhou: ${(e as Error)?.message ?? String(e)}`);

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
      `preset: ${r.preset}`,
      `export: ${(r.ms / 1000).toFixed(1)} s · ${(r.bytes.byteLength / 1e6).toFixed(1)} MB · completo na hora: ${
        r.completoNaHora ? "sim" : "NÃO"
      } · completo no fim: ${wavCompleto(r.bytes) ? "sim" : "NÃO"}`,
      `WAV: ${janelas.db.length} canal(is) a ${janelas.taxa} Hz · ${segundos.toFixed(1)} s de áudio (sequência: ${info.durationSeconds.toFixed(1)} s)`,
      `níveis (dB): p10 ${p(0.1)} · p20 ${p(0.2)} · p50 ${p(0.5)} · p90 ${p(0.9)} · p99 ${p(0.99)}`,
      `guardado: ${r.caminho}`
    );
    dados.audio = {
      preset: r.preset,
      ms: r.ms,
      bytes: r.bytes.byteLength,
      completoNaHora: r.completoNaHora,
      completoNoFim: wavCompleto(r.bytes),
      taxa: janelas.taxa,
      canais: janelas.db.length,
      segundos,
      sequenciaSegundos: info.durationSeconds,
    };
  } catch (e) {
    falha("1) áudio", e);
  }

  linhas.push("== 2. Transcrição");
  try {
    const { info, clipe, json } = await lerClipeETranscricao();
    await writeJson("pausas-diag-transcricao.json", JSON.parse(json));
    const t = parseTranscricao(json);
    const palavras = t ? t.segments.flatMap((s) => s.words.filter((w) => w.type === "word")) : [];
    const l = lacunas(palavras);
    linhas.push(
      `clipe "${clipe.sourceName}": timeline ${clipe.startSeconds.toFixed(2)}–${clipe.endSeconds.toFixed(2)} s, in ${clipe.inPointSeconds.toFixed(2)} · ${info.fps} fps`,
      `${l.total} palavras · espaços > 0,2 s: ${l.acima02} · > 0,5 s: ${l.acima05}`,
      l.acima02 === 0
        ? "LEITURA: a transcrição NÃO marca pausa — confirma o problema do 26."
        : `LEITURA: a transcrição ainda marca ${l.acima02} pausas.`
    );
    dados.clipe = clipe;
    dados.fps = info.fps;
    dados.lacunas = l;
  } catch (e) {
    falha("2) transcrição", e);
  }

  // Mexe na timeline: por ultimo, depois que o audio ja foi exportado.
  linhas.push("== 3. Mecânica de corte");
  try {
    await sondaMecanica(linhas);
  } catch (e) {
    falha("3) mecânica", e);
  }
  try {
    await sondaOverwrite(linhas);
  } catch (e) {
    falha("3D) overwrite", e);
  }

  linhas.push('Pronto. Desfaça com Ctrl+Z até a timeline voltar ao "antes" (ou apague a cópia da sequência).');
  dados.linhas = linhas;
  try {
    await writeJson("pausas-diag.json", dados);
  } catch (e) {
    falha("gravar pausas-diag.json", e);
  }
  return linhas;
}
