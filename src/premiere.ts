/*
 * Unica porta de entrada para a API do Premiere. A UI nunca chama `ppro`
 * direto: ela fala com estas funcoes, que devolvem tipos do dominio.
 *
 * Tudo aqui vem de prova executada na Fase 0. Ver docs/API_PROOFS.md.
 */

import { caminhoParaUrl, ehVideo, fillScalePercent, trackLabel, type Size } from "./domain.ts";
import { aMedir, comMedida, type CacheIntensidade } from "./intensidade.ts";
import { agitacaoDeMp4, dimensoesDeMp4 } from "./mp4.ts";

declare function require(id: string): unknown;

// Fronteira nao tipada: o modulo do host chega sem tipos. Ele e restringido
// aqui, uma vez, e o resto do arquivo trabalha com as interfaces abaixo.
/* eslint-disable @typescript-eslint/no-explicit-any */
const ppro = require("premierepro") as any;
const uxp = require("uxp") as any;
/* eslint-enable @typescript-eslint/no-explicit-any */

// ------------------------------------------------------------------ tipos

export interface SequenceInfo {
  readonly name: string;
  readonly width: number;
  readonly height: number;
  readonly fps: number;
  readonly videoTracks: number;
  readonly audioTracks: number;
  readonly durationSeconds: number;
}

interface Handles {
  readonly project: unknown;
  readonly sequence: unknown;
  readonly rootItem: unknown;
}

// ------------------------------------------------------------- fundamentos

/**
 * Varias chamadas do UXP nunca resolvem nem rejeitam — `getFileForOpening`,
 * `importFiles` em certos estados, getters de ComponentParam. Sem isto o painel
 * fica preso em "carregando" para sempre, sem erro e sem log.
 *
 * Aprendido na Fase 0, onde a ausencia deste guarda custou varias rodadas de
 * diagnostico as cegas.
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

/**
 * `importFiles` invalida handles obtidos antes dele. Por isso nada e
 * reaproveitado entre etapas: cada uma pede referencias novas.
 */
async function handles(): Promise<Handles> {
  const project = await ppro.Project.getActiveProject();
  if (!project) throw new Error("Nenhum projeto aberto.");
  const sequence = await project.getActiveSequence();
  if (!sequence) throw new Error("Nenhuma sequencia ativa. Abra uma sequencia na timeline.");
  return { project, sequence, rootItem: await project.getRootItem() };
}

/**
 * A regra que custou tres falhas distintas na Fase 0:
 *
 * - toda Action tem de ser CRIADA dentro de `lockedAccess`, senao o Premiere
 *   responde "Requires locked access";
 * - todo objeto passado para ela tambem, senao "The script object is no longer valid";
 * - `lockedAccess` e SINCRONO — nenhum `await` cabe dentro;
 * - erro lancado la dentro NAO propaga: sem capturar, falha passa por sucesso.
 *
 * Encapsulado aqui para que nenhum chamador precise lembrar disso.
 */
function comTransacao(
  project: { lockedAccess: (cb: () => void) => void; executeTransaction: (cb: (c: { addAction: (a: unknown) => void }) => void, undo: string) => boolean },
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

const CLIP = 1; // ppro.Constants.TrackItemType.CLIP, fixado na prova P0.3

// ------------------------------------------------------------------ leitura

export async function getSequenceInfo(): Promise<SequenceInfo> {
  const { sequence } = await handles();
  const seq = sequence as {
    name: string;
    getSettings: () => Promise<SequenceSettings>;
    getEndTime: () => Promise<{ seconds: number }>;
    getVideoTrackCount: () => Promise<number>;
    getAudioTrackCount: () => Promise<number>;
  };

  const settings = await seq.getSettings();
  // getFrameSize() devolve {} nesta versao; getVideoFrameRect() e o que funciona.
  const rect = await settings.getVideoFrameRect();
  const frameRate = await settings.getVideoFrameRate();

  return {
    name: seq.name,
    width: rect?.width ?? 0,
    height: rect?.height ?? 0,
    fps: frameRate?.value ?? 0,
    videoTracks: await seq.getVideoTrackCount(),
    audioTracks: await seq.getAudioTrackCount(),
    durationSeconds: (await seq.getEndTime())?.seconds ?? 0,
  };
}

export interface ArquivoBroll {
  readonly name: string;
  readonly nativePath: string;
}

/**
 * Lista os videos da pasta de B-rolls, direto do disco.
 *
 * O projeto comeca vazio, entao nao da para ler a biblioteca da bin do
 * Premiere. E o seletor de arquivos do UXP trava neste painel, entao tambem
 * nao da para pedir a pasta ao usuario pela UI.
 *
 * `getEntryWithUrl` resolve as duas coisas: le um caminho absoluto sem abrir
 * dialogo. Exige `"localFileSystem": "fullAccess"` no manifest.
 */
export async function listarPastaBrolls(caminho: string): Promise<ArquivoBroll[]> {
  const pasta = (await uxp.storage.localFileSystem.getEntryWithUrl(caminhoParaUrl(caminho))) as {
    isFolder?: boolean;
    getEntries?: () => Promise<Array<{ name: string; nativePath: string; isFolder: boolean }>>;
  } | null;

  if (!pasta) throw new Error(`Pasta nao encontrada: ${caminho}`);
  if (pasta.isFolder === false) throw new Error(`Isto e um arquivo, nao uma pasta: ${caminho}`);
  if (typeof pasta.getEntries !== "function") {
    throw new Error("Sem permissao para ler a pasta. Confira localFileSystem no manifest.");
  }

  const encontrados: ArquivoBroll[] = [];
  const vistos = new Set<string>();

  const descer = async (
    dir: { getEntries: () => Promise<Array<{ name: string; nativePath: string; isFolder: boolean }>> },
    profundidade: number
  ): Promise<void> => {
    for (const entrada of await dir.getEntries()) {
      if (entrada.isFolder) {
        // Um nivel de subpasta basta; biblioteca em arvore profunda e
        // problema do indexador da Fase 5, nao deste caminho.
        if (profundidade < 1) {
          await descer(
            entrada as unknown as { getEntries: () => Promise<Array<{ name: string; nativePath: string; isFolder: boolean }>> },
            profundidade + 1
          );
        }
        continue;
      }
      if (!ehVideo(entrada.name) || vistos.has(entrada.name)) continue;
      vistos.add(entrada.name);
      encontrados.push({ name: entrada.name, nativePath: entrada.nativePath });
    }
  };

  await descer(pasta as never, 0);
  encontrados.sort((a, b) => a.name.localeCompare(b.name, "pt-BR"));
  return encontrados;
}

/**
 * Clipes de uma faixa de video, com o nome da midia de origem.
 * V1 (indice 0) e a camera principal: e dela que sai a transcricao.
 */
export async function lerClipes(videoTrackIndex = 0): Promise<
  Array<{
    sourceName: string;
    startSeconds: number;
    endSeconds: number;
    inPointSeconds: number;
    outPointSeconds: number;
    speed: number;
  }>
> {
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
  const saida = [];
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

/**
 * Todo B-roll da timeline, em QUALQUER faixa acima de V1.
 *
 * V1 e a camera principal e a fonte da transcricao; da V2 para cima e territorio
 * de B-roll. Ler so a V2 era erro: empilhar na V3 e o que qualquer editor faz
 * quando nao quer sobrescrever, e tudo que o usuario punha la ficava invisivel
 * para o aprendizado — nem acerto, nem erro, nem aviso.
 *
 * Serve tambem para nao contar como apagado o clipe que so foi MOVIDO de faixa.
 */
export async function lerBrollsAcimaDeV1(): Promise<
  Array<{ sourceName: string; startSeconds: number; endSeconds: number; videoTrackIndex: number }>
> {
  const { sequence } = await handles();
  const total = await (sequence as { getVideoTrackCount: () => Promise<number> }).getVideoTrackCount();

  const saida: Array<{
    sourceName: string;
    startSeconds: number;
    endSeconds: number;
    videoTrackIndex: number;
  }> = [];
  for (let i = 1; i < total; i++) {
    try {
      for (const clipe of await lerClipes(i)) {
        saida.push({
          sourceName: clipe.sourceName,
          startSeconds: clipe.startSeconds,
          // O fim define quais palavras este B-roll cobriu — e o que permite
          // aprender a ligacao quando o dicionario nao explica a escolha.
          endSeconds: clipe.endSeconds,
          videoTrackIndex: i,
        });
      }
    } catch {
      // Faixa que nao responde nao pode derrubar a leitura das outras.
    }
  }
  return saida;
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

/**
 * Resolucao da midia, lida do cabecalho do proprio arquivo.
 *
 * O XMP foi tentado primeiro e falhou nos arquivos reais desta biblioteca —
 * `videoFrameSize` nao vem. Ler os bytes funciona nos 260, verificado contra a
 * metadata do Windows.
 */
async function dimensoesDoArquivo(caminho: string): Promise<Size | null> {
  try {
    const entrada = (await uxp.storage.localFileSystem.getEntryWithUrl(
      caminhoParaUrl(caminho)
    )) as { read: (o: unknown) => Promise<ArrayBuffer> } | null;
    if (!entrada) return null;
    const dados = await entrada.read({ format: uxp.storage.formats.binary });
    return dimensoesDeMp4(new Uint8Array(dados));
  } catch {
    return null;
  }
}


/**
 * Mede a agitacao dos arquivos que ainda nao estao no cache.
 *
 * Le o arquivo inteiro porque o UXP nao oferece leitura parcial, e o `moov` pode
 * estar no fim. Sao ~2,3 MB por arquivo nesta biblioteca; a primeira passada nos
 * 260 custa dezenas de segundos, e as seguintes nao custam nada.
 *
 * Falha de leitura vira `null` gravado, nao excecao: um arquivo ilegivel nao
 * pode derrubar a analise, e gravar o `null` impede tentar de novo toda vez.
 */
export async function medirBiblioteca(
  arquivos: readonly ArquivoBroll[],
  cache: CacheIntensidade,
  aoProgredir: (feitos: number, total: number) => void
): Promise<CacheIntensidade> {
  const pendentes = aMedir(cache, arquivos.map((a) => a.name));
  if (pendentes.length === 0) return cache;

  const porNome = new Map(arquivos.map((a) => [a.name, a.nativePath]));
  let atual = cache;
  let feitos = 0;

  for (const nome of pendentes) {
    const caminho = porNome.get(nome);
    let agitacao: number | null = null;

    if (caminho !== undefined) {
      try {
        const entrada = (await uxp.storage.localFileSystem.getEntryWithUrl(
          caminhoParaUrl(caminho)
        )) as { read: (o: unknown) => Promise<ArrayBuffer> } | null;
        if (entrada) {
          const dados = await entrada.read({ format: uxp.storage.formats.binary });
          agitacao = agitacaoDeMp4(new Uint8Array(dados));
        }
      } catch {
        // Arquivo ilegivel: fica como null e nao se tenta de novo.
      }
    }

    atual = comMedida(atual, nome, agitacao);
    feitos++;
    // De 25 em 25 para nao inundar o log de um painel curto.
    if (feitos % 25 === 0 || feitos === pendentes.length) aoProgredir(feitos, pendentes.length);
  }
  return atual;
}

export interface ColocacaoParaInserir {
  readonly arquivo: string;
  readonly caminho: string;
  readonly inicio: number;
  readonly duracao: number;
}

export interface ResultadoPlano {
  readonly inseridos: number;
  readonly passos: readonly string[];
  readonly avisos: readonly string[];
}

/**
 * Insere um plano inteiro em TRES transacoes, nao tres por B-roll.
 *
 * Dez B-rolls custariam trinta Ctrl+Z se cada um fosse tratado sozinho. Como
 * uma CompoundAction aceita varias Actions, o lote todo cabe em uma transacao
 * por etapa — e o numero de desfazeres deixa de crescer com o tamanho do plano.
 *
 * As etapas continuam separadas porque ha dependencia real: o item de audio e o
 * clipe em V2 so existem depois do overwrite ser aplicado.
 */
export async function inserirPlano(
  colocacoes: readonly ColocacaoParaInserir[],
  opcoes: { videoTrackIndex: number; audioTrackIndex: number; removerAudio: boolean; preencherTela: boolean }
): Promise<ResultadoPlano> {
  const passos: string[] = [];
  const avisos: string[] = [];
  if (colocacoes.length === 0) return { inseridos: 0, passos, avisos };

  // 1. Importar tudo de uma vez: importFiles aceita lista.
  {
    const { project, rootItem } = await handles();
    const raiz = rootItem as { getItems: () => Promise<Array<{ name: string }>> };
    const jaNoProjeto = new Set((await raiz.getItems()).map((i) => i.name));
    const faltando = colocacoes.filter((c) => !jaNoProjeto.has(c.arquivo));

    if (faltando.length > 0) {
      const p = project as {
        importFiles: (f: string[], s: boolean, bin: unknown, n: boolean) => Promise<boolean>;
      };
      const ok = await p.importFiles(faltando.map((c) => c.caminho), true, rootItem, false);
      if (!ok) throw new Error("Premiere recusou importar os B-rolls.");
    }
    passos.push(`${faltando.length} importados, ${colocacoes.length - faltando.length} ja no projeto`);
  }

  // 2. Um overwrite por colocacao, todos na mesma transacao.
  {
    const { project, sequence, rootItem } = await handles();
    const raiz = rootItem as { getItems: () => Promise<Array<{ name: string }>> };
    const itens = await raiz.getItems();
    const editor = await ppro.SequenceEditor.getEditor(sequence);

    const prontos: Array<{ item: unknown; at: unknown }> = [];
    for (const c of colocacoes) {
      const item = itens.find((i) => i.name === c.arquivo);
      if (!item) {
        avisos.push(`${c.arquivo} nao apareceu no projeto apos importar.`);
        continue;
      }
      prontos.push({ item, at: await ppro.TickTime.createWithSeconds(c.inicio) });
    }
    if (prontos.length === 0) throw new Error("Nenhum B-roll pronto para inserir.");

    comTransacao(project as never, `Auto B-roll: inserir ${prontos.length} B-rolls`, (adicionar) => {
      for (const p of prontos) {
        adicionar(
          editor.createOverwriteItemAction(p.item, p.at, opcoes.videoTrackIndex, opcoes.audioTrackIndex)
        );
      }
    });
    passos.push(`${prontos.length} inseridos em ${trackLabel("V", opcoes.videoTrackIndex)}`);
  }

  // 3. Aparar a duracao e escalar — o clipe so existe agora.
  {
    const { project, sequence } = await handles();
    const seq = sequence as SequenceParaAjuste;
    const faixa = await seq.getVideoTrack(opcoes.videoTrackIndex);
    const naFaixa = (await faixa.getTrackItems(CLIP, false)) as ItemNaFaixa[];

    // O quadro da sequencia nao muda no meio do lote: uma leitura serve para
    // todos. Estava dentro do laco, custando duas chamadas por B-roll.
    const quadro = opcoes.preencherTela ? await (await seq.getSettings()).getVideoFrameRect() : null;

    // A Action so pode NASCER dentro do lockedAccess: aqui se monta a receita,
    // la ela e executada. Lista unica de thunks — agrupar por clipe nao servia a
    // nada, a transacao consome tudo em ordem do mesmo jeito.
    const acoes: Array<() => unknown> = [];
    let ajustados = 0;

    for (const c of colocacoes) {
      const clipe = await acharClipe(naFaixa, c);
      if (!clipe) continue;
      ajustados++;

      const fim = await ppro.TickTime.createWithSeconds(c.inicio + c.duracao);
      acoes.push(() => clipe.createSetEndAction(fim));

      if (quadro !== null) {
        const param = await acharScale(clipe);
        const tamanho = param ? await dimensoesDoArquivo(c.caminho) : null;
        if (param && tamanho) {
          const escala = fillScalePercent(tamanho, quadro);
          acoes.push(() => param.createSetValueAction(param.createKeyframe(escala), true));
        } else if (!tamanho) {
          avisos.push(`${c.arquivo}: resolucao indisponivel, sem escala.`);
        }
      }
    }

    if (acoes.length > 0) {
      comTransacao(project as never, "Auto B-roll: ajustar duracao e escala", (adicionar) => {
        for (const acao of acoes) adicionar(acao());
      });
      passos.push(`${ajustados} ajustados (duracao${opcoes.preencherTela ? " e escala" : ""})`);
    }
  }

  // 4. Remover todo o audio dos B-rolls numa transacao so.
  if (opcoes.removerAudio) {
    const { project, sequence } = await handles();
    const faixa = await (sequence as {
      getAudioTrack: (i: number) => Promise<{ getTrackItems: (t: number, e: boolean) => Promise<unknown[]> }>;
    }).getAudioTrack(opcoes.audioTrackIndex);
    const itens = (await faixa.getTrackItems(CLIP, false)) as Array<{ getName: () => Promise<string> }>;

    const nomes = new Set(colocacoes.map((c) => c.arquivo));
    const alvos: unknown[] = [];
    for (const it of itens) if (nomes.has(await it.getName())) alvos.push(it);

    if (alvos.length > 0) {
      const editor = await ppro.SequenceEditor.getEditor(sequence);
      comTransacao(project as never, "Auto B-roll: remover audio", (adicionar) => {
        let selecao: { addItem: (i: unknown, d: boolean) => boolean } | null = null;
        ppro.TrackItemSelection.createEmptySelection((s: typeof selecao) => {
          selecao = s;
        });
        if (!selecao) throw new Error("createEmptySelection nao devolveu selecao");
        const sel = selecao as { addItem: (i: unknown, d: boolean) => boolean };
        for (const alvo of alvos) sel.addItem(alvo, false);
        adicionar(editor.createRemoveItemsAction(sel, false, ppro.Constants.MediaType.AUDIO, false));
      });
      passos.push(`audio removido de ${alvos.length} B-rolls`);
    }
  }

  return { inseridos: colocacoes.length, passos, avisos };
}

/** Um clipe ja na faixa de destino, com o que a etapa de ajuste precisa dele. */
interface ItemNaFaixa {
  getName: () => Promise<string>;
  getStartTime: () => Promise<{ seconds: number }>;
  getComponentChain: () => Promise<ChainMotion>;
  createSetEndAction: (t: unknown) => unknown;
}

interface SequenceParaAjuste {
  getVideoTrack: (i: number) => Promise<{ getTrackItems: (t: number, e: boolean) => Promise<unknown[]> }>;
  getSettings: () => Promise<SequenceSettings>;
}

interface SequenceSettings {
  getVideoFrameRate: () => Promise<{ value: number }>;
  getVideoFrameRect: () => Promise<{ width: number; height: number }>;
}

interface ChainMotion {
  getComponentCount: () => number;
  getComponentAtIndex: (i: number) => {
    getMatchName: () => Promise<string>;
    getParamCount: () => number;
    getParam: (i: number) => ParamScale;
  };
}
interface ParamScale {
  displayName: string;
  createKeyframe: (v: number) => unknown;
  createSetValueAction: (k: unknown, s: boolean) => unknown;
}

/** O clipe certo e o que tem o nome e comeca no tempo planejado. */
async function acharClipe<
  T extends { getName: () => Promise<string>; getStartTime: () => Promise<{ seconds: number }> },
>(itens: readonly T[], c: { arquivo: string; inicio: number }): Promise<T | null> {
  for (const it of itens) {
    if ((await it.getName()) !== c.arquivo) continue;
    if (Math.abs((await it.getStartTime()).seconds - c.inicio) < 0.5) return it;
  }
  return null;
}

async function acharScale(clipe: { getComponentChain: () => Promise<ChainMotion> }): Promise<ParamScale | null> {
  const chain = await clipe.getComponentChain();
  for (let i = 0; i < chain.getComponentCount(); i++) {
    const comp = chain.getComponentAtIndex(i);
    if ((await comp.getMatchName()) !== "AE.ADBE Motion") continue;
    for (let p = 0; p < comp.getParamCount(); p++) {
      const par = comp.getParam(p);
      if (par.displayName === "Scale") return par;
    }
  }
  return null;
}


// ---------------------------------------------------------- persistencia

/** Le um JSON da pasta de dados do plugin. `null` se nao existir. */
export async function readJson(fileName: string): Promise<unknown> {
  try {
    const folder = await uxp.storage.localFileSystem.getDataFolder();
    const file = await folder.getEntry(fileName);
    return JSON.parse(await file.read());
  } catch {
    return null;
  }
}

export async function writeJson(fileName: string, value: unknown): Promise<void> {
  const folder = await uxp.storage.localFileSystem.getDataFolder();
  const file = await folder.createFile(fileName, { overwrite: true });
  await file.write(JSON.stringify(value, null, 2));
}
