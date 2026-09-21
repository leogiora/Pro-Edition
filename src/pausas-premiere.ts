/*
 * Adapter do Auto Pausas. Le a sequencia (a bruta inteira ou ja separada pelo
 * editor), a transcricao de cada arquivo e o AUDIO (exportado pelo proprio
 * plugin), e devolve tudo em tempo de sequencia.
 *
 * Nenhuma regra de corte mora aqui: quem decide o que sai e src/pausas.ts.
 */

import { caminhoParaUrl } from "../ferramentas/auto-broll/src/domain.ts";
import {
  comLimite,
  comTransacao,
  getSequenceInfo,
  readJson,
  writeJson,
  type SequenceInfo,
} from "../ferramentas/auto-broll/src/premiere.ts";
import {
  parseTranscricao,
  reconstruirTranscricao,
  type ClipeComOrigem,
  type TranscricaoOrigem,
} from "../ferramentas/auto-broll/src/transcript.ts";
import { lerFps } from "./autocut-premiere.ts";
import {
  blocosDeFala,
  candidatosDoPreset,
  conferirPalavras,
  lacunas,
  montarPalavras,
  pedacosDoPlano,
  planejarCortes,
  type ClipeNaTimeline,
  PRESET_WAV,
  relogio,
  type Bloco,
  type Palavra,
  type Pedaco,
} from "./pausas.ts";
import { nivelPorJanela, wavCompleto } from "./wav.ts";

declare function require(id: string): unknown;
/* eslint-disable @typescript-eslint/no-explicit-any */
const ppro = require("premierepro") as any;
const uxp = require("uxp") as any;
/* eslint-enable @typescript-eslint/no-explicit-any */

const CLIP = 1; // ppro.Constants.TrackItemType.CLIP
const TICKS_POR_SEGUNDO = 254_016_000_000;

interface Tempo {
  readonly seconds: number;
  readonly ticks: string;
}

interface ItemLike {
  getStartTime: () => Promise<Tempo>;
  getEndTime: () => Promise<Tempo>;
  getInPoint: () => Promise<Tempo>;
  getOutPoint: () => Promise<Tempo>;
  getSpeed: () => Promise<number>;
  getProjectItem: () => Promise<unknown>;
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

// ---------------------------------------------------------------- leitura

/** Um clipe da V1 ou da A1 como o Premiere entrega, com o item do projeto por tras. */
interface ClipeLido {
  readonly item: ItemLike;
  readonly nome: string;
  readonly inicio: Tempo;
  readonly fim: Tempo;
  readonly entrada: Tempo;
  readonly saida: Tempo;
  readonly velocidade: number;
  readonly projectItem: unknown;
  readonly clip: any;
}

/** Um arquivo usado na V1: overwrite quer o ProjectItem CRU; marca e transcricao, o cast. */
interface Fonte {
  readonly nome: string;
  readonly projectItem: unknown;
  readonly clip: any;
}

async function lerFaixa(video: boolean): Promise<ClipeLido[]> {
  const { sequence } = await ativa();
  return Promise.all(
    (await itensDa(sequence, video, 0)).map(async (item) => {
      const projectItem = await item.getProjectItem();
      return {
        item,
        nome: (projectItem as { name?: string } | null)?.name ?? "?",
        inicio: await item.getStartTime(),
        fim: await item.getEndTime(),
        entrada: await item.getInPoint(),
        saida: await item.getOutPoint(),
        velocidade: await item.getSpeed(),
        projectItem,
        clip: ppro.ClipProjectItem.cast(projectItem),
      };
    })
  );
}

/**
 * A sequencia como o editor deixou: a bruta inteira ou ja separada (varios
 * clipes na V1). Cada recusa diz o que fazer — "nao deu" sem instrucao vira
 * pergunta para mim depois.
 */
async function lerSequencia(): Promise<{ info: SequenceInfo; fps: number; v1: ClipeLido[]; fontes: Fonte[] }> {
  const info = await getSequenceInfo();
  // getSequenceInfo devolve fps 0 no Premiere 25 (rodada 6); lerFps vai pelo
  // sequence.getTimebase(), provado no 25 e no 26 pelo Podcast AutoCut.
  const fps = (await lerFps()).valor;
  if (!(fps > 0)) throw new Error("Não consegui ler a taxa de quadros da sequência.");

  const v1 = await lerFaixa(true);
  if (v1.length === 0) throw new Error("Nenhum clipe na V1. Ponha a gravação na V1 com o áudio na A1.");
  for (const c of v1) {
    const onde = relogio(Math.round(c.inicio.seconds * fps), fps);
    if (!c.clip) throw new Error(`O clipe da V1 em ${onde} não é um arquivo de mídia (sequência aninhada?).`);
    if (Math.abs(c.velocidade - 1) > 1e-6) {
      throw new Error(`O clipe da V1 em ${onde} está com a velocidade alterada. Volte para 100% e rode de novo.`);
    }
  }

  // O corte recoloca cada pedaco a partir do arquivo, com video E audio juntos:
  // a A1 tem de ser o audio do proprio clipe da V1, na mesma posicao.
  const a1 = await lerFaixa(false);
  const chave = (c: ClipeLido) =>
    [c.nome, c.inicio.seconds, c.fim.seconds, c.entrada.seconds].map((x) => (typeof x === "number" ? Math.round(x * fps) : x)).join("|");
  if (a1.length !== v1.length || v1.some((c, i) => chave(c) !== chave(a1[i]!))) {
    throw new Error(
      "O áudio da A1 não acompanha a V1 clipe a clipe (áudio de gravador separado?). Cada clipe precisa estar com o próprio áudio."
    );
  }

  const fontes = new Map<string, Fonte>();
  for (const c of v1) if (!fontes.has(c.nome)) fontes.set(c.nome, { nome: c.nome, projectItem: c.projectItem, clip: c.clip });
  return { info, fps, v1, fontes: [...fontes.values()] };
}

/**
 * A transcricao de cada arquivo, pelo proprio item — nunca pelo nome: a
 * sequencia criada a partir do clipe costuma ter o mesmo nome dele.
 *
 * No Premiere 25, clipe SEM transcricao nao devolve vazio: `exportToJSON` lanca
 * "Illegal Parameter type" (os B-rolls dao esse erro nos logs do Auto B-roll).
 */
async function lerTranscricoes(fontes: readonly Fonte[]): Promise<Map<string, { json: string; t: TranscricaoOrigem }>> {
  const saida = new Map<string, { json: string; t: TranscricaoOrigem }>();
  for (const f of fontes) {
    let json: string | null = null;
    try {
      json = await comLimite("ler a transcrição", ppro.Transcript.exportToJSON(f.clip) as Promise<string | null>);
    } catch (e) {
      const msg = (e as Error)?.message ?? String(e);
      if (!/illegal parameter/i.test(msg)) throw new Error(`Não consegui ler a transcrição de "${f.nome}": ${msg}`);
    }
    if (!json) {
      throw new Error(
        `"${f.nome}" não tem transcrição. No Premiere: selecione o clipe, Janela > Texto > aba Transcrição > Transcrever, e rode de novo.`
      );
    }
    const t = parseTranscricao(json);
    if (!t) throw new Error(`A transcrição de "${f.nome}" veio num formato que não consegui ler.`);
    saida.set(f.nome, { json, t });
  }
  return saida;
}

/** Nome da sequencia + cada clipe da V1 em quadros: muda se o editor mexer em qualquer coisa na V1. */
function assinaturaDe(s: { info: SequenceInfo; fps: number; v1: readonly ClipeLido[] }): string {
  const q = (t: Tempo) => Math.round(t.seconds * s.fps);
  return JSON.stringify([s.info.name, s.v1.map((c) => [c.nome, q(c.inicio), q(c.fim), q(c.entrada)])]);
}

/** O formato que `reconstruirTranscricao` do Auto B-roll espera. */
function comOrigem(clipes: readonly ClipeLido[]): ClipeComOrigem[] {
  return clipes.map((c) => ({
    sourceName: c.nome,
    startSeconds: c.inicio.seconds,
    endSeconds: c.fim.seconds,
    inPointSeconds: c.entrada.seconds,
    outPointSeconds: c.saida.seconds,
    speed: 1,
  }));
}

function palavrasDa(clipes: readonly ClipeLido[], transcricoes: Map<string, { t: TranscricaoOrigem }>): Palavra[] {
  const mapa = new Map([...transcricoes].map(([nome, x]) => [nome, x.t]));
  return montarPalavras(reconstruirTranscricao(comOrigem(clipes), mapa));
}

export interface Gravacao {
  readonly nomeSequencia: string;
  readonly fps: number;
  readonly duracaoQ: number;
  readonly clipes: number;
  /** Os clipes da V1 em quadros, para a previa contar os espacos entre os videos. */
  readonly clipesQ: readonly ClipeNaTimeline[];
  /** A timeline como estava na leitura: se continuar igual, o corte reaproveita a analise. */
  readonly assinatura: string;
  readonly palavras: readonly Palavra[];
}

export async function lerGravacao(): Promise<Gravacao> {
  const s = await lerSequencia();
  const palavras = palavrasDa(s.v1, await lerTranscricoes(s.fontes));
  if (palavras.length === 0) throw new Error("A transcrição não tem nenhuma palavra dentro da timeline.");
  const q = (t: Tempo) => Math.round(t.seconds * s.fps);
  const indice = new Map(s.fontes.map((f, i) => [f.nome, i]));
  return {
    nomeSequencia: s.info.name,
    fps: s.fps,
    duracaoQ: Math.round(Math.max(...s.v1.map((c) => c.fim.seconds)) * s.fps),
    clipes: s.v1.length,
    clipesQ: s.v1.map((c) => ({ inicioQ: q(c.inicio), fimQ: q(c.fim), midiaQ: q(c.entrada), fonte: indice.get(c.nome)! })),
    assinatura: assinaturaDe(s),
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

/**
 * O que o painel mostrou, em disco: da para ler o resultado sem o usuario
 * colar nada. Guarda as ultimas 20 escritas — um clique depois do corte
 * (Diagnostico, Analisar) nao pode apagar o registro do corte.
 */
export async function guardarRegistro(linhas: readonly string[]): Promise<void> {
  const antes = (await readJson("pausas-registro.json")) as { historico?: unknown[] } | null;
  const historico = Array.isArray(antes?.historico) ? antes.historico : [];
  await writeJson("pausas-registro.json", {
    historico: [...historico, { quando: new Date().toISOString(), linhas }].slice(-20),
  });
}

// ---------------------------------------------------------------- analise

export interface Analise extends Gravacao {
  readonly blocos: readonly Bloco[];
  readonly segundosAudio: number;
}

/** Transcricao + audio -> blocos de fala. Nao toca na timeline; o WAV temporario nunca fica. */
export async function analisarGravacao(): Promise<Analise> {
  const g = await lerGravacao();
  const audio = await exportarAudio("pausas-audio.wav");
  try {
    const janelas = nivelPorJanela(audio.bytes);
    return {
      ...g,
      blocos: blocosDeFala(janelas.db[0] ?? [], janelas.janelaMs / 1000, g.palavras),
      segundosAudio: audio.ms / 1000,
    };
  } finally {
    await apagarArquivo(audio.caminho);
  }
}

// ------------------------------------------------------------------ corte

const ESTADO_DESFAZER = "pausas-desfazer.json";

/** O que o Desfazer precisa para recolocar a sequencia como estava. Ticks em texto, como o Premiere da. */
interface EstadoDesfazer {
  readonly sequencia: string;
  /** Cada arquivo usado e as marcas que ele tinha no painel Projeto (null = sem marca). */
  readonly fontes: ReadonlyArray<{ readonly nome: string; readonly marcas: { readonly inTicks: string; readonly outTicks: string } | null }>;
  /** Os clipes da V1 como o editor deixou. */
  readonly clipes: ReadonlyArray<{ readonly fonte: number; readonly inicioTicks: string; readonly inTicks: string; readonly outTicks: string }>;
  readonly quando: string;
}

/** Sem marca, o item do projeto devolve -400000 s (rodada 6). */
const semMarca = (t: Tempo) => t.seconds < -1000;
const tickDeTexto = (ticks: string) => ppro.TickTime.createWithTicks(ticks);

/**
 * Acao que tira itens sem ripple, no molde do Auto B-roll (que tira o audio dos
 * B-rolls assim no 25 e no 26: "audio removido de N B-rolls" nos logs). Tem de
 * ser montada DENTRO da transacao: a selecao nasce ali.
 */
function acaoRemover(editor: any, itens: readonly unknown[]): unknown {
  let selecao: { addItem: (i: unknown, d: boolean) => boolean } | null = null;
  ppro.TrackItemSelection.createEmptySelection((s: typeof selecao) => {
    selecao = s;
  });
  if (!selecao) throw new Error("createEmptySelection nao devolveu selecao");
  const sel = selecao as { addItem: (i: unknown, d: boolean) => boolean };
  for (const i of itens) sel.addItem(i, false);
  return editor.createRemoveItemsAction(sel, false, ppro.Constants.MediaType.ANY, false);
}

/** Tudo que esta na V1 e na A1 agora — o corte e o Desfazer esvaziam antes de recolocar. */
async function tudoNaV1eA1(): Promise<unknown[]> {
  const { sequence } = await ativa();
  return [...(await itensDa(sequence, true, 0)), ...(await itensDa(sequence, false, 0))];
}

/**
 * Esvazia a V1 e a A1 e coloca uma lista de pedacos, um por transacao, da
 * esquerda para a direita. Esvaziar antes e o que deixa os espacos entre os
 * videos vazios de verdade — sem sobra da sequencia antiga dentro deles.
 *
 * O overwrite so enxerga o in/out marcado no item do projeto ANTES da
 * transacao (rodada 5), entao a transacao k coloca o pedaco k e ja marca o
 * k+1; a ultima devolve as marcas. `depoisDoPrimeiro` roda entre o pedaco 0 e
 * o 1 — e onde o corte confere a conta antes de fazer as outras centenas.
 */
async function colocarEmSequencia<T>(
  pedacos: readonly T[],
  rotulo: string,
  marcar: (p: T) => unknown,
  colocar: (editor: any, p: T) => unknown,
  devolverMarcas: () => unknown[],
  aoAvancar: (feitos: number, total: number) => void,
  depoisDoPrimeiro: () => Promise<void> = async () => undefined
): Promise<number> {
  let passos = 0;
  {
    const velhos = await tudoNaV1eA1();
    const { project, sequence } = await ativa();
    const editor = await ppro.SequenceEditor.getEditor(sequence);
    comTransacao(project as never, `${rotulo}: preparar`, (adicionar) => {
      if (velhos.length > 0) adicionar(acaoRemover(editor, velhos));
      adicionar(marcar(pedacos[0]!));
    });
    passos++;
  }
  for (let k = 0; k < pedacos.length; k++) {
    const { project, sequence } = await ativa();
    const editor = await ppro.SequenceEditor.getEditor(sequence);
    const proximo = pedacos[k + 1];
    comTransacao(project as never, `${rotulo}: ${k + 1} de ${pedacos.length}`, (adicionar) => {
      adicionar(colocar(editor, pedacos[k]!));
      for (const acao of proximo ? [marcar(proximo)] : devolverMarcas()) adicionar(acao);
    });
    passos++;
    aoAvancar(k + 1, pedacos.length);
    if (k === 0) await depoisDoPrimeiro();
  }
  return passos;
}

/** Pedacos da V1 ou da A1 em quadros, na ordem: onde estao e de que quadro da midia partem. */
async function pecas(video: boolean, fps: number): Promise<Array<{ de: number; ate: number; midia: number }>> {
  return (await lerFaixa(video)).map((c) => ({
    de: Math.round(c.inicio.seconds * fps),
    ate: Math.round(c.fim.seconds * fps),
    midia: Math.round(c.entrada.seconds * fps),
  }));
}

export interface ResultadoCorte {
  readonly ok: boolean;
  readonly linhas: readonly string[];
}

/**
 * Corta as pausas NA sequencia (escolha do usuario: direto, sem copia), seja a
 * bruta inteira ou ja separada pelo editor.
 *
 * So usa o que foi provado no Premiere 25.6.6: marcar in/out no item do projeto,
 * overwrite do ProjectItem CRU (rodadas 5 e 6) e remover sem ripple (Auto B-roll).
 * Cada pedaco sai do ARQUIVO, nao da timeline: a V1/A1 e esvaziada e os pedacos
 * voltam da esquerda para a direita, com os espacos entre os videos mantidos.
 *
 * ponytail: uma transacao por pedaco (~380 numa bruta de 14 min) — o Ctrl+Z do
 * Premiere desfaz um pedaco por vez, por isso existe desfazerPausas. Se um dia
 * a API aceitar trecho de midia no overwrite, vira uma transacao so.
 *
 * Erro no meio: devolve a sequencia antes de avisar.
 */
export async function aplicarPausas(
  margemS: number,
  progresso: (texto: string) => void,
  jaAnalisada?: Analise
): Promise<ResultadoCorte> {
  // Ler o audio e o que mais demora (~7 s numa bruta de 14 min, painel parado):
  // se o editor acabou de clicar Analisar e a V1 nao mudou, nao le de novo.
  const t0 = Date.now();
  const s = await lerSequencia();
  const reaproveitou = jaAnalisada !== undefined && jaAnalisada.assinatura === assinaturaDe(s);
  if (!reaproveitou) progresso("1/3 lendo áudio…");
  const a = reaproveitou ? jaAnalisada : await analisarGravacao();
  const tAudio = Date.now();
  const plano = planejarCortes(a.blocos, { fps: a.fps, duracaoQ: a.duracaoQ, margemS });
  if (plano.cortes.length === 0) return { ok: true, linhas: ["Nenhuma pausa para cortar."] };

  const lido = await lerFps();
  const tpf = lido.tpf > 0 ? lido.tpf : Math.round(TICKS_POR_SEGUNDO / a.fps);
  const tick = (quadros: number) => ppro.TickTime.createWithTicks(String(Math.round(quadros * tpf)));
  const quadro = (t: Tempo) => Math.round(Number(t.ticks) / tpf);

  const indice = new Map(s.fontes.map((f, i) => [f.nome, i]));
  const clipesQ = s.v1.map((c) => ({ inicioQ: quadro(c.inicio), fimQ: quadro(c.fim), midiaQ: quadro(c.entrada), fonte: indice.get(c.nome)! }));
  const { pedacos, totalQ } = pedacosDoPlano(plano.trechos, clipesQ);
  if (pedacos.length === 0) throw new Error("O plano não deixou nenhum trecho de fala. Nada foi mexido.");

  // O que o Desfazer precisa, gravado ANTES de mexer em qualquer coisa.
  const VIDEO = ppro.Constants.MediaType.VIDEO;
  const marcas = await Promise.all(
    s.fontes.map(async (f) => {
      const i = (await f.clip.getInPoint(VIDEO)) as Tempo;
      const o = (await f.clip.getOutPoint(VIDEO)) as Tempo;
      return semMarca(i) ? null : { inTicks: i.ticks, outTicks: o.ticks };
    })
  );
  const estado: EstadoDesfazer = {
    sequencia: a.nomeSequencia,
    fontes: s.fontes.map((f, i) => ({ nome: f.nome, marcas: marcas[i] ?? null })),
    clipes: s.v1.map((c) => ({ fonte: indice.get(c.nome)!, inicioTicks: c.inicio.ticks, inTicks: c.entrada.ticks, outTicks: c.saida.ticks })),
    quando: new Date().toISOString(),
  };
  await writeJson(ESTADO_DESFAZER, estado);

  const fonteDe = (p: Pedaco) => s.fontes[p.fonte]!;
  const devolverMarcas = () =>
    s.fontes.map((f, i) => {
      const m = marcas[i];
      return m ? f.clip.createSetInOutPointsAction(tickDeTexto(m.inTicks), tickDeTexto(m.outTicks)) : f.clip.createClearInOutPointsAction();
    });

  // O primeiro pedaco prova a conta antes dos outros: se sair curto, sobraria
  // um quadro velho em cada emenda; se partir de outro ponto da midia
  // (timecode de camera), mostraria a fala errada.
  const conferirPrimeiro = async () => {
    const p = pedacos[0]!;
    const primeiro = (await pecas(true, a.fps))[0];
    const esperado = p.midiaAteQ - p.midiaDeQ;
    const veio = primeiro ? primeiro.ate - primeiro.de : 0;
    if (!primeiro || primeiro.de !== p.destinoQ || veio < esperado) {
      throw new Error(`o primeiro pedaço saiu com ${veio} quadros, o plano pedia ${esperado}`);
    }
    if (Math.abs(primeiro.midia - p.midiaDeQ) > 1) {
      throw new Error(`o primeiro pedaço parte do quadro ${primeiro.midia} da mídia, o plano pedia ${p.midiaDeQ}`);
    }
  };

  let passos = 0;
  try {
    passos += await colocarEmSequencia(
      pedacos,
      "Auto Pausas",
      (p) => fonteDe(p).clip.createSetInOutPointsAction(tick(p.midiaDeQ), tick(p.midiaAteQ)),
      (editor, p) => editor.createOverwriteItemAction(fonteDe(p).projectItem, tick(p.destinoQ), 0, 0),
      devolverMarcas,
      (feitos, total) => progresso(`2/3 cortando ${feitos}/${total}`),
      conferirPrimeiro
    );

  } catch (e) {
    const motivo = (e as Error)?.message ?? String(e);
    let volta = "A sequência foi devolvida como estava.";
    try {
      // As fontes vao em maos: se o erro veio logo depois de esvaziar, a timeline nao tem de onde tira-las.
      await desfazerPausas(s.fontes);
    } catch (e2) {
      volta = `E NÃO consegui devolver a sequência (${(e2 as Error)?.message ?? String(e2)}): use Ctrl+Z.`;
    }
    throw new Error(`O corte parou depois de ${passos} passo(s): ${motivo}. ${volta}`);
  }
  const tCorte = Date.now();

  // Conferir LENDO A TIMELINE, nunca pelo que foi pedido.
  progresso("3/3 conferindo…");
  const depoisV1 = await lerFaixa(true);
  const conferencia = conferirPalavras(a.palavras, palavrasDa(depoisV1, await lerTranscricoes(s.fontes)));
  const v = await pecas(true, a.fps);
  const au = await pecas(false, a.fps);
  const emSincronia = JSON.stringify(v.map((p) => [p.de, p.ate])) === JSON.stringify(au.map((p) => [p.de, p.ate]));
  const fimV1 = v.length > 0 ? Math.max(...v.map((p) => p.ate)) : 0;
  const duracaoOk = Math.abs(fimV1 - totalQ) <= 1;
  const contagemOk = v.length === pedacos.length;
  const seg = (de: number, ate: number) => ((ate - de) / 1000).toFixed(1).replace(".", ",");
  const tFim = Date.now();

  return {
    ok: conferencia.ok && emSincronia && duracaoOk && contagemOk,
    linhas: [
      `${plano.cortes.length} pausas cortadas · ${relogio(plano.duracaoAntesQ, a.fps)} → ${relogio(totalQ, a.fps)} · levou ${seg(t0, tFim)} s`,
      `tempos: áudio ${reaproveitou ? "aproveitou o Analisar" : `${seg(t0, tAudio)} s`} · corte ${seg(tAudio, tCorte)} s · conferência ${seg(tCorte, tFim)} s`,
      ...conferencia.linhas,
      emSincronia ? "V1 e A1 em sincronia." : `V1 tem ${v.length} pedaços e A1 tem ${au.length}, ou em posições diferentes.`,
      contagemOk ? `${v.length} pedaços na V1, como o plano.` : `A V1 tem ${v.length} pedaços, o plano tinha ${pedacos.length}.`,
      duracaoOk ? "Duração confere com o plano." : `Duração NÃO confere: a V1 termina no quadro ${fimV1}, o plano dizia ${totalQ}.`,
      "Para desfazer tudo, use o botão Desfazer (o Ctrl+Z do Premiere desfaz um pedaço por vez).",
    ],
  };
}

/**
 * Recoloca a sequencia como estava antes do ultimo corte: tira tudo da V1 e da
 * A1 e recoloca cada clipe original pelo mesmo encadeamento do corte (a bruta
 * inteira volta em 3 transacoes; uma separada, em uma por clipe).
 */
export async function desfazerPausas(emMaos?: readonly Fonte[]): Promise<string[]> {
  const estado = (await readJson(ESTADO_DESFAZER)) as EstadoDesfazer | null;
  if (!estado) throw new Error("Não há corte do Auto Pausas para desfazer.");
  const { sequence } = await ativa();
  const nome = (sequence as { name: string }).name;
  if (nome !== estado.sequencia) {
    throw new Error(`O último corte foi na sequência "${estado.sequencia}". Abra ela e clique em Desfazer de novo.`);
  }

  // Os itens do projeto saem da timeline ANTES de esvazia-la: depois nao ha de onde pegar.
  const atuais: ReadonlyArray<{ nome: string; projectItem: unknown; clip: any }> = emMaos ?? (await lerFaixa(true));
  const fontes = estado.fontes.map((f) => {
    const achado = atuais.find((c) => c.nome === f.nome && c.clip);
    // ponytail: arquivo que o corte tirou inteiro nao volta; guardar o caminho da midia se isso acontecer.
    if (!achado) throw new Error(`Não achei "${f.nome}" na timeline para recolocar. Use Ctrl+Z.`);
    return { projectItem: achado.projectItem, clip: achado.clip };
  });

  await colocarEmSequencia(
    estado.clipes,
    "Auto Pausas: desfazer",
    (c) => fontes[c.fonte]!.clip.createSetInOutPointsAction(tickDeTexto(c.inTicks), tickDeTexto(c.outTicks)),
    (editor, c) => editor.createOverwriteItemAction(fontes[c.fonte]!.projectItem, tickDeTexto(c.inicioTicks), 0, 0),
    () =>
      estado.fontes.map((f, i) =>
        f.marcas
          ? fontes[i]!.clip.createSetInOutPointsAction(tickDeTexto(f.marcas.inTicks), tickDeTexto(f.marcas.outTicks))
          : fontes[i]!.clip.createClearInOutPointsAction()
      ),
    () => undefined
  );
  await writeJson(ESTADO_DESFAZER, null);

  const depois = await lerFaixa(true);
  return depois.length === estado.clipes.length
    ? [`Desfeito: a sequência voltou como estava (${depois.length} clipe${depois.length === 1 ? "" : "s"}).`]
    : [`Desfeito, mas a V1 ficou com ${depois.length} clipes e antes tinha ${estado.clipes.length}: confira a timeline.`];
}

// --------------------------------------------------------------- sonda

/*
 * As rodadas 4 a 6 (Premiere 25.6.6) fecharam a mecanica — ver DEV_NOTES. O
 * Diagnostico so junta, da mesma sequencia, o audio e a transcricao para a
 * calibracao (scripts/calibrar-pausas.ts). Nao mexe na timeline.
 */

/** Limpa as marcas do arquivo da V1 (a rodada 4 esqueceu in/out 5-6 s na IMG_1902). */
async function limparMarcasDaV1(): Promise<string> {
  const [primeiro] = await lerFaixa(true);
  if (!primeiro?.clip) return "sem clipe na V1 para limpar marcas";
  const { project } = await ativa();
  comTransacao(project as never, "Auto Pausas: limpar marcas do clipe", (adicionar) => {
    adicionar(primeiro.clip.createClearInOutPointsAction());
  });
  return `marcas de "${primeiro.nome}" limpas`;
}

/**
 * So leitura: exporta o audio e guarda a transcricao de cada arquivo da mesma
 * sequencia. O WAV, a transcricao e os clipes ficam na pasta de dados para a
 * calibracao; o registro vai para pausas-diag.json.
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
    const s = await lerSequencia();
    const transcricoes = await lerTranscricoes(s.fontes);
    // Um arquivo so: o JSON cru, como antes. Varios: { fontes: { nome: JSON } }.
    const [unica] = [...transcricoes.values()];
    await writeJson(
      "pausas-diag-transcricao.json",
      transcricoes.size === 1 && unica
        ? JSON.parse(unica.json)
        : { fontes: Object.fromEntries([...transcricoes].map(([n, x]) => [n, JSON.parse(x.json)])) }
    );
    for (const [n, x] of transcricoes) {
      const l = lacunas(x.t.segments.flatMap((seg) => seg.words.filter((w) => w.type === "word")));
      linhas.push(`"${n}": ${l.total} palavras · espaços > 0,2 s: ${l.acima02} · > 0,5 s: ${l.acima05}`);
    }
    linhas.push(`${s.v1.length} clipe(s) na V1 · ${s.fps} fps`);
    dados.clipes = comOrigem(s.v1);
    dados.fps = s.fps;
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
