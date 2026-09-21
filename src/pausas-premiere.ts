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
 * A transcricao do clipe da V1, pelo item que esta NA TIMELINE — nunca pelo
 * nome: a sequencia criada a partir do clipe tem o MESMO nome dele, e a busca
 * por nome pegou a sequencia na rodada 4 ("Illegal Parameter type").
 */
async function transcricaoDaV1(): Promise<string> {
  const { clip } = await midiaDaV1();
  const json = (await comLimite("ler a transcrição", ppro.Transcript.exportToJSON(clip) as Promise<string | null>)) ?? "";
  if (!json) throw new Error("veio vazia");
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
  let json: string;
  try {
    json = await transcricaoDaV1();
  } catch (e) {
    throw new Error(
      `"${clipe.sourceName}" não tem transcrição (${(e as Error)?.message ?? String(e)}). No Premiere: painel Texto > Transcrever, e rode de novo.`
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
 * Rodada 4 (25.6.6) descartou a mecanica por clone: cada clone e uma copia
 * INTEIRA com in=0, `setInPoint` apara a cabeca mantendo o out (o pedaco do
 * meio virou duracao zero) e `move` e relativo. Sem slip, seriam 3 transacoes
 * por pedaco — mais de mil Ctrl+Z numa bruta de 14 min. Ver DEV_NOTES.
 *
 * O caminho e o plano C: marcar in/out NO ITEM DO PROJETO e fazer overwrite,
 * como o Auto B-roll ja faz com B-roll. Na rodada 4 isso deu "Invalid
 * parameter" sem dizer qual chamada; aqui cada passo roda sozinho e rele o
 * resultado.
 */
async function sondaOverwrite(linhas: string[]): Promise<void> {
  const VIDEO = ppro.Constants.MediaType.VIDEO;
  const erro = (e: unknown) => (e as Error)?.message ?? String(e);
  const tick = (s: number) => ppro.TickTime.createWithSeconds(s);

  const pecaEm = async (t: number, video: boolean) => {
    const { sequence } = await ativa();
    for (const i of await itensDa(sequence, video, 0)) {
      const inicio = (await i.getStartTime()).seconds;
      if (Math.abs(inicio - t) < 0.05) {
        return { inicio, fim: (await i.getEndTime()).seconds, entrada: (await i.getInPoint()).seconds };
      }
    }
    return null;
  };
  const retrato = async (rotulo: string, t: number, pedidoIn: number, pedidoDur: number) => {
    const v = await pecaEm(t, true);
    const a = await pecaEm(t, false);
    const txt = (p: { inicio: number; fim: number; entrada: number } | null) =>
      p ? `${p.inicio.toFixed(2)}-${p.fim.toFixed(2)} in=${p.entrada.toFixed(2)}` : "nada";
    const certo = (p: { inicio: number; fim: number; entrada: number } | null) =>
      p !== null && Math.abs(p.entrada - pedidoIn) < 0.05 && Math.abs(p.fim - p.inicio - pedidoDur) < 0.05;
    linhas.push(
      `${rotulo}: V1 ${txt(v)} · A1 ${txt(a)} (pedi in=${pedidoIn.toFixed(2)}, ${pedidoDur.toFixed(2)} s) → ${
        certo(v) && certo(a) ? "RESPEITOU" : "NÃO respeitou"
      }`
    );
  };
  const marcar = async (rotulo: string, deS: number, ateS: number) => {
    const { project } = await ativa();
    const { clip } = await midiaDaV1();
    const a = await tick(deS);
    const b = await tick(ateS);
    comTransacao(project as never, `Auto Pausas: ${rotulo}`, (adicionar) => {
      adicionar(clip.createSetInOutPointsAction(a, b));
    });
    const { clip: lido } = await midiaDaV1();
    linhas.push(
      `${rotulo}: pedi ${deS.toFixed(2)}–${ateS.toFixed(2)}, o item diz ${(await lido.getInPoint(VIDEO)).seconds.toFixed(2)}–${(
        await lido.getOutPoint(VIDEO)
      ).seconds.toFixed(2)}`
    );
  };

  // D1. Em que relogio o item do projeto guarda o in/out? (o da V1 diz 0,00)
  const { clip: original } = await midiaDaV1();
  const inAntes = await original.getInPoint(VIDEO);
  const outAntes = await original.getOutPoint(VIDEO);
  const base = inAntes.seconds as number;
  linhas.push(`D1) in/out do item no projeto: ${base.toFixed(2)} – ${(outAntes.seconds as number).toFixed(2)} s`);
  const { sequence: seq } = await ativa();
  const fimSeq = (await (seq as SeqFaixas).getEndTime()).seconds;

  // D2. Marcar 5-6 s, contado a partir do in que o item ja tem.
  try {
    await marcar("D2) in/out +5–6 s", base + 5, base + 6);
  } catch (e) {
    linhas.push(`D2) marcar in/out falhou: ${erro(e)}`);
  }

  // D3. Overwrite com o ProjectItem cru, como o Auto B-roll (provado la).
  try {
    const { project, sequence } = await ativa();
    const { projectItem } = await midiaDaV1();
    const editor = await ppro.SequenceEditor.getEditor(sequence);
    const em = await tick(fimSeq + 2);
    comTransacao(project as never, "Auto Pausas: sonda overwrite", (adicionar) => {
      adicionar(editor.createOverwriteItemAction(projectItem, em, 0, 0));
    });
    await retrato("D3) overwrite (ProjectItem cru)", fimSeq + 2, 5, 1);
  } catch (e) {
    linhas.push(`D3) overwrite com ProjectItem cru falhou: ${erro(e)}`);
    try {
      const { project, sequence } = await ativa();
      const { clip } = await midiaDaV1();
      const editor = await ppro.SequenceEditor.getEditor(sequence);
      const em = await tick(fimSeq + 2);
      comTransacao(project as never, "Auto Pausas: sonda overwrite (cast)", (adicionar) => {
        adicionar(editor.createOverwriteItemAction(clip, em, 0, 0));
      });
      await retrato("D3b) overwrite (ClipProjectItem)", fimSeq + 2, 5, 1);
    } catch (e2) {
      linhas.push(`D3b) overwrite com ClipProjectItem falhou: ${erro(e2)}`);
    }
  }

  // D4. Dois pares marcar+overwrite numa transacao so: o corte inteiro cabe
  // num Ctrl+Z? So se cada overwrite ler o in/out na hora de executar.
  try {
    const { project, sequence } = await ativa();
    const { projectItem, clip } = await midiaDaV1();
    const editor = await ppro.SequenceEditor.getEditor(sequence);
    const [a1, b1, em1, a2, b2, em2] = await Promise.all([
      tick(base + 10),
      tick(base + 11),
      tick(fimSeq + 5),
      tick(base + 20),
      tick(base + 22),
      tick(fimSeq + 8),
    ]);
    comTransacao(project as never, "Auto Pausas: sonda dois pares", (adicionar) => {
      adicionar(clip.createSetInOutPointsAction(a1, b1));
      adicionar(editor.createOverwriteItemAction(projectItem, em1, 0, 0));
      adicionar(clip.createSetInOutPointsAction(a2, b2));
      adicionar(editor.createOverwriteItemAction(projectItem, em2, 0, 0));
    });
    await retrato("D4) par 1 na mesma transação", fimSeq + 5, 10, 1);
    await retrato("D4) par 2 na mesma transação", fimSeq + 8, 20, 2);
  } catch (e) {
    linhas.push(`D4) dois pares numa transação falhou: ${erro(e)}`);
  }

  // D5. Devolver o in/out do item ao que era.
  try {
    await marcar("D5) in/out devolvido", base, outAntes.seconds as number);
  } catch (e) {
    linhas.push(`D5) devolver in/out falhou: ${erro(e)} — confira as marcas do clipe no painel Projeto`);
  }
}

/**
 * Rodada 5 — o que a rodada 4 deixou em aberto, numa ida so:
 *  1. o audio de novo (para o WAV bater com a transcricao desta bruta);
 *  2. a transcricao pelo item da V1, e tambem pelo nome, para confirmar por
 *     que a rodada 4 falhou;
 *  3. o plano C (in/out no item do projeto + overwrite), chamada por chamada.
 * O WAV e a transcricao ficam na pasta de dados para a calibracao; o registro
 * vai para pausas-diag.json, para ninguem precisar colar log.
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
      `export: ${(r.ms / 1000).toFixed(1)} s · ${(r.bytes.byteLength / 1e6).toFixed(1)} MB · completo: ${wavCompleto(r.bytes) ? "sim" : "NÃO"}`,
      `WAV: ${janelas.db.length} canal(is) a ${janelas.taxa} Hz · ${segundos.toFixed(1)} s de áudio (sequência: ${info.durationSeconds.toFixed(1)} s)`,
      `níveis (dB): p10 ${p(0.1)} · p20 ${p(0.2)} · p50 ${p(0.5)} · p90 ${p(0.9)} · p99 ${p(0.99)}`
    );
    dados.audio = {
      preset: r.preset,
      ms: r.ms,
      bytes: r.bytes.byteLength,
      completoNaHora: r.completoNaHora,
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
      `pelo item da V1: OK · clipe "${clipe.sourceName}" ${clipe.startSeconds.toFixed(2)}–${clipe.endSeconds.toFixed(2)} s · ${info.fps} fps`,
      `${l.total} palavras · espaços > 0,2 s: ${l.acima02} · > 0,5 s: ${l.acima05}`,
      l.acima02 === 0
        ? "LEITURA: a transcrição NÃO marca pausa."
        : `LEITURA: a transcrição marca ${l.acima02} pausas.`
    );
    dados.clipe = clipe;
    dados.fps = info.fps;
    dados.lacunas = l;

    const porNome = await lerTranscricoes([clipe.sourceName]);
    linhas.push(
      porNome.transcricoes.has(clipe.sourceName)
        ? "pelo nome: também funcionou (então a rodada 4 falhou por outro motivo)"
        : `pelo nome: falhou (${porNome.falhas.map((f) => f.motivo).join("; ")}) — confirma a troca pela sequência de mesmo nome`
    );
  } catch (e) {
    falha("2) transcrição", e);
  }

  // Mexe na timeline: por ultimo, depois que o audio ja foi exportado.
  linhas.push("== 3. Overwrite com in/out (plano C)");
  try {
    await sondaOverwrite(linhas);
  } catch (e) {
    falha("3) overwrite", e);
  }

  linhas.push('Pronto. Pode apagar a cópia da sequência (os pedaços de teste ficaram depois do fim dela).');
  dados.linhas = linhas;
  try {
    await writeJson("pausas-diag.json", dados);
  } catch (e) {
    falha("gravar pausas-diag.json", e);
  }
  return linhas;
}
