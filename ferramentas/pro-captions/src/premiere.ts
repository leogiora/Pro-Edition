/*
 * Unica porta de entrada para a API do Premiere. A UI nunca chama `ppro`
 * direto: ela fala com estas funcoes, que devolvem tipos do dominio.
 *
 * Tudo aqui vem de prova executada no auto-broll. Ver docs/API_PROOFS.md.
 */

import { candidatosDoPreset, PRESET_WAV, wavCompleto } from "./audio.ts";
import type { ClipeComOrigem } from "./transcript.ts";

declare function require(id: string): unknown;

// Fronteira nao tipada: o modulo do host chega sem tipos. Ele e restringido
// aqui, uma vez, e o resto do arquivo trabalha com as interfaces abaixo.
/* eslint-disable @typescript-eslint/no-explicit-any */
const ppro = require("premierepro") as any;
const uxp = require("uxp") as any;
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

// getVideoFrameRate() nao existe no Premiere 25 (so aparece a partir da 26.x,
// ver [[auto-broll-premiere]]). Tenta nomes alternativos plausiveis antes de
// desistir; se nenhum bater, loga as chaves reais do objeto pra nao precisar
// adivinhar num segundo reinicio do Premiere.
async function taxaDeQuadros(settings: Record<string, unknown>): Promise<number> {
  for (const nome of ["getVideoFrameRate", "getFrameRate"]) {
    const fn = settings[nome];
    if (typeof fn === "function") {
      const r = await (fn as () => Promise<unknown>).call(settings);
      return typeof r === "number" ? r : ((r as { value?: number })?.value ?? 0);
    }
  }
  for (const nome of ["videoFrameRate", "frameRate"]) {
    const v = settings[nome];
    if (v !== undefined) return typeof v === "number" ? v : ((v as { value?: number })?.value ?? 0);
  }
  console.log(
    "[pro-captions] settings sem taxa de quadros conhecida; chaves:",
    Object.keys(settings),
    Object.getOwnPropertyNames(Object.getPrototypeOf(settings ?? {}))
  );
  return 0;
}

export async function getSequenceInfo(): Promise<SequenceInfo> {
  const { sequence } = await handles();
  const seq = sequence as {
    name: string;
    getSettings: () => Promise<Record<string, unknown>>;
    getVideoTrackCount: () => Promise<number>;
    getCaptionTrackCount: () => Promise<number>;
  };
  // getFrameSize() devolve {} e e inutil (P1.4); o frame rate vem de getSettings.
  const fps = await taxaDeQuadros(await seq.getSettings());
  return {
    name: seq.name,
    fps,
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

/**
 * `FolderItem.getItems()` so devolve os filhos diretos — midia dentro de um
 * bin (pasta do painel de Projeto) fica de fora. Desce recursivamente pra
 * achar tudo, nao so o que esta solto na raiz.
 */
async function todosOsItens(pasta: { getItems: () => Promise<unknown[]> }): Promise<Array<{ name: string }>> {
  const filhos = (await pasta.getItems()) as Array<{ name: string }>;
  const saida: Array<{ name: string }> = [];
  for (const filho of filhos) {
    const bin = ppro.FolderItem.cast(filho);
    if (bin) saida.push(...(await todosOsItens(bin)));
    else saida.push(filho);
  }
  return saida;
}

/** Transcricao bruta de cada midia que tiver uma. Chave: nome do ProjectItem. */
export async function lerTranscricoes(
  nomes: readonly string[]
): Promise<{ transcricoes: Map<string, string>; falhas: Array<{ nome: string; motivo: string }> }> {
  const { rootItem } = await handles();
  const raiz = rootItem as { getItems: () => Promise<unknown[]> };
  const itens = await todosOsItens(raiz);
  const transcricoes = new Map<string, string>();
  const falhas: Array<{ nome: string; motivo: string }> = [];

  for (const nome of new Set(nomes)) {
    const item = itens.find((i) => i.name === nome);
    if (!item) {
      falhas.push({ nome, motivo: "nao encontrado no painel de Projeto (nome nao bate?)" });
      continue;
    }
    try {
      // Cair no item cru quando cast() falha manda tipo errado pro nativo
      // ("Illegal Parameter type") — item que nao e clipe de midia (bin,
      // sequencia aninhada) so pode ser pulado, nao forcado.
      const clip = ppro.ClipProjectItem.cast(item);
      if (!clip) {
        falhas.push({ nome, motivo: "nao e um ClipProjectItem (bin ou sequencia?)" });
        continue;
      }
      // hasTranscript() nao existe no Premiere 25 (mesmo achado do
      // auto-broll-premiere em 2026-08-12 — ppro.Transcript so tem
      // importFromJSON, createImportTextSegmentsAction, exportToJSON).
      // Tenta exportar direto; midia sem transcricao rejeita ou devolve
      // vazio, os dois tratados como "sem transcricao" abaixo.
      const json = (await ppro.Transcript.exportToJSON(clip)) as string | null | undefined;
      if (json) transcricoes.set(nome, json);
    } catch (e) {
      falhas.push({ nome, motivo: (e as Error)?.message ?? String(e) });
    }
  }
  return { transcricoes, falhas };
}

/* ------------------------------------------------------------- escrita */

/**
 * A regra que custou tres falhas distintas no auto-broll:
 *
 * - toda Action tem de ser CRIADA dentro de `lockedAccess`, senao o Premiere
 *   responde "Requires locked access";
 * - todo objeto passado para ela tambem, senao "The script object is no longer valid";
 * - `lockedAccess` e SINCRONO — nenhum `await` cabe dentro;
 * - erro lancado la dentro NAO propaga: sem capturar, falha passa por sucesso.
 */
function comTransacao(
  project: {
    lockedAccess: (cb: () => void) => void;
    executeTransaction: (cb: (c: { addAction: (a: unknown) => void }) => void, undo: string) => boolean;
  },
  rotuloUndo: string,
  montarAcoes: (adicionar: (acao: unknown) => void) => void
): void {
  let erro: string | null = null;
  project.lockedAccess(() => {
    try {
      project.executeTransaction((compound) => {
        montarAcoes((acao) => compound.addAction(acao));
      }, rotuloUndo);
    } catch (e) {
      const err = e as Error;
      erro = `${err?.name ?? "Erro"}: ${err?.message ?? String(e)}`;
    }
  });
  if (erro !== null) throw new Error(erro);
}

const seguro = (nome: string): string => nome.replace(/[^a-zA-Z0-9._-]/g, "_");

// salvarBackup morreu com a rota de escrita (D-13): gerar legendas nao toca
// mais no transcript do clipe, entao nao ha o que proteger. lerBackup fica
// porque "Restaurar original" ainda desfaz escritas de versoes antigas.

/** Devolve o transcript original guardado, ou `null` se nao houver. */
export async function lerBackup(nome: string): Promise<string | null> {
  const pasta = await uxp.storage.localFileSystem.getDataFolder();
  try {
    const arquivo = await pasta.getEntry(`original-${seguro(nome)}.json`);
    return (await arquivo.read()) as string;
  } catch {
    return null;
  }
}

/**
 * Grava o que aconteceu, com as dez execucoes mais recentes.
 *
 * O painel UXP nao deixa selecionar nem copiar texto, e o log rola para fora
 * da area visivel. Ler este arquivo e a unica forma pratica de saber o que o
 * plugin fez — sem ele, o diagnostico vira adivinhacao.
 */
export async function gravarLog(linhas: readonly string[]): Promise<string> {
  const pasta = await uxp.storage.localFileSystem.getDataFolder();

  let anteriores: unknown[] = [];
  try {
    const antigo = await pasta.getEntry("ultimo-log-captions.json");
    const bruto: unknown = JSON.parse((await antigo.read()) as string);
    const lista = (bruto as { execucoes?: unknown })?.execucoes;
    if (Array.isArray(lista)) anteriores = lista;
  } catch {
    // Primeiro log, ou arquivo ilegivel: comecar do zero e nao derrubar nada.
  }

  const execucoes = [{ quando: new Date().toISOString(), linhas: [...linhas] }, ...anteriores].slice(0, 10);
  const arquivo = await pasta.createFile("ultimo-log-captions.json", { overwrite: true });
  await arquivo.write(JSON.stringify({ execucoes }, null, 2));
  return arquivo.nativePath as string;
}

/** Grava um .srt em PluginData e devolve o caminho para o log. */
export async function salvarSrt(nome: string, conteudo: string): Promise<string> {
  const pasta = await uxp.storage.localFileSystem.getDataFolder();
  const arquivo = await pasta.createFile(nome, { overwrite: true });
  await arquivo.write(conteudo);
  return arquivo.nativePath as string;
}

/**
 * Importa arquivos direto para o painel Projeto, sem dialogo.
 *
 * `Project.importFiles` existe na tipagem 26.3; se o Premiere reimportar o
 * mesmo caminho como item duplicado, o usuario apaga o antigo — melhor que
 * abrir o dialogo de importacao a cada video.
 */
export async function importarArquivos(caminhos: readonly string[]): Promise<boolean> {
  const { project } = await handles();
  const p = project as { importFiles: (fs: string[], suppressUI?: boolean) => Promise<boolean> };
  return p.importFiles([...caminhos], true);
}

// E7c (inserir o .srt na timeline por codigo) foi tentado e FALHOU em
// silencio: createInsertProjectItemAction executa sem erro e nada aparece —
// a acao nao roteia item de legenda para caption track. Veredito em
// docs/API_PROOFS.md; nao reimplementar sem API nova de caption track.

/** Escreve o transcript de volta no ClipProjectItem da midia. */
export async function escreverTranscricao(nomeDaMidia: string, json: string): Promise<void> {
  const { project, rootItem } = await handles();
  const raiz = rootItem as { getItems: () => Promise<Array<{ name: string }>> };
  const item = (await raiz.getItems()).find((i) => i.name === nomeDaMidia);
  if (!item) throw new Error(`midia nao encontrada no projeto: ${nomeDaMidia}`);

  const clip = ppro.ClipProjectItem.cast(item) ?? item;

  comTransacao(
    project as Parameters<typeof comTransacao>[0],
    "Pro Captions: escrever transcricao",
    (adicionar) => {
      // Tudo nasce dentro do lock, inclusive o TextSegments.
      const segmentos = ppro.Transcript.importFromJSON(json);
      adicionar(ppro.Transcript.createImportTextSegmentsAction(segmentos, clip));
    }
  );
}

/* ---------------------------------------------- audio para o ElevenLabs */

interface Entrada {
  readonly name: string;
  readonly nativePath: string;
  readonly isFolder?: boolean;
  read(opcoes?: unknown): Promise<unknown>;
  delete(): Promise<unknown>;
  getEntries?(): Promise<Entrada[]>;
}

/**
 * `getEntryWithUrl` quer `file:/C:/...` com UMA barra e sem escapar nada — o
 * UXP codifica sozinho (UXP_ARMADILHAS.md, secao 6).
 */
function paraUrl(caminho: string): string {
  return `file:/${caminho.trim().replace(/\\/g, "/").replace(/^\/+/, "")}`;
}

/** Arquivo ou pasta num caminho absoluto, ou null se nao existir. */
async function entrada(caminho: string): Promise<Entrada | null> {
  try {
    return ((await uxp.storage.localFileSystem.getEntryWithUrl(paraUrl(caminho))) as Entrada | null) ?? null;
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
async function acharPreset(): Promise<string> {
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
 * Exporta o audio da sequencia ativa inteira como WAV mono 16 kHz na pasta de
 * dados do plugin. Mesmo metodo do Auto Pausas (provado no Premiere real):
 * `exportSequence` com o preset que vem instalado, `exportFull = true`.
 *
 * O WAV comeca no zero da sequencia, entao o tempo que o ElevenLabs devolver
 * ja e tempo de sequencia. 16 kHz mono basta para fala e deixa o arquivo
 * pequeno: 23 min viram uns 45 MB.
 */
export async function exportarAudioDaSequencia(): Promise<{
  readonly caminho: string;
  readonly bytes: Uint8Array;
  readonly ms: number;
}> {
  const preset = await acharPreset();
  const pasta = (await uxp.storage.localFileSystem.getDataFolder()) as { nativePath: string };
  const caminho = `${pasta.nativePath.replace(/[\\/]+$/, "")}\\captions-audio.wav`;
  await apagarArquivo(caminho);

  const { sequence } = await handles();
  const encoder = ppro.EncoderManager.getManager();
  const tipo = ppro.Constants?.ExportType?.IMMEDIATELY ?? ppro.EncoderManager.EXPORT_IMMEDIATELY;
  const t0 = Date.now();
  const aceitou = (await encoder.exportSequence(sequence, tipo, caminho, preset, true)) as boolean;
  if (!aceitou) throw new Error("O Premiere recusou exportar o áudio da sequência.");
  const ms = Date.now() - t0;

  const arquivo = await entrada(caminho);
  if (!arquivo) throw new Error(`O export terminou, mas o arquivo não apareceu em ${caminho}.`);
  let bytes = await lerBytes(arquivo);
  // Se a promessa voltar antes de o arquivo fechar, espera o RIFF fechar.
  for (let tentativa = 0; !wavCompleto(bytes) && tentativa < 20; tentativa++) {
    await new Promise((r) => setTimeout(r, 500));
    bytes = await lerBytes(arquivo);
  }
  if (!wavCompleto(bytes)) throw new Error("O WAV exportado ficou incompleto. Clique de novo.");
  return { caminho, bytes, ms };
}

/* ------------------------------------------------ chave e transcricoes */

const ARQUIVO_CHAVE = "elevenlabs-chave.json";
const PREFIXO_TRANSCRICAO = "elevenlabs-transcricao-";
/** Quantas respostas do ElevenLabs ficam guardadas para reaproveitar. */
const TRANSCRICOES_GUARDADAS = 10;

async function lerDados(nome: string): Promise<string | null> {
  const pasta = await uxp.storage.localFileSystem.getDataFolder();
  try {
    const arquivo = await pasta.getEntry(nome);
    return (await arquivo.read()) as string;
  } catch {
    return null;
  }
}

async function gravarDados(nome: string, conteudo: string): Promise<string> {
  const pasta = await uxp.storage.localFileSystem.getDataFolder();
  const arquivo = await pasta.createFile(nome, { overwrite: true });
  await arquivo.write(conteudo);
  return arquivo.nativePath as string;
}

/**
 * A chave fica na pasta de dados do plugin, no computador do editor — nunca
 * no codigo nem no repositorio.
 */
export async function lerChaveElevenLabs(): Promise<string | null> {
  const bruto = await lerDados(ARQUIVO_CHAVE);
  if (bruto === null) return null;
  try {
    const chave = (JSON.parse(bruto) as { chave?: unknown }).chave;
    return typeof chave === "string" && chave.trim().length > 0 ? chave.trim() : null;
  } catch {
    return null;
  }
}

export async function salvarChaveElevenLabs(chave: string): Promise<void> {
  await gravarDados(ARQUIVO_CHAVE, JSON.stringify({ chave: chave.trim() }));
}

/** A resposta ja paga para este mesmo audio, ou null. */
export async function lerTranscricaoGuardada(assinatura: string): Promise<string | null> {
  return lerDados(`${PREFIXO_TRANSCRICAO}${assinatura}.json`);
}

/**
 * Guarda a resposta crua do ElevenLabs. Serve para reaproveitar (gerar de
 * novo sem pagar de novo) e para depurar: da para abrir o arquivo e ver
 * exatamente o que foi ouvido. Mantem so as mais recentes.
 */
export async function guardarTranscricao(assinatura: string, json: string): Promise<string> {
  const nomeAtual = `${PREFIXO_TRANSCRICAO}${assinatura}.json`;
  const caminho = await gravarDados(nomeAtual, json);
  try {
    // O UXP nao da data confiavel dos arquivos, entao a ordem mora num indice:
    // a mais recente na frente, e o que cair fora das N primeiras e apagado.
    const indice = JSON.parse((await lerDados("elevenlabs-indice.json")) ?? "[]") as string[];
    const novoIndice = [nomeAtual, ...indice.filter((n) => n !== nomeAtual)].slice(0, TRANSCRICOES_GUARDADAS);
    const manter = new Set(novoIndice);
    const pasta = (await uxp.storage.localFileSystem.getDataFolder()) as {
      getEntries: () => Promise<Array<{ name: string; delete: () => Promise<unknown> }>>;
    };
    for (const e of await pasta.getEntries()) {
      if (e.name.startsWith(PREFIXO_TRANSCRICAO) && !manter.has(e.name)) await e.delete();
    }
    await gravarDados("elevenlabs-indice.json", JSON.stringify(novoIndice));
  } catch {
    // Limpar e conveniencia: nunca pode derrubar a transcricao que ja chegou.
  }
  return caminho;
}
