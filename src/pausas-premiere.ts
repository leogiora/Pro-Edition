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
  readJson,
  writeJson,
  type SequenceInfo,
} from "../ferramentas/auto-broll/src/premiere.ts";
import { parseTranscricao, reconstruirTranscricao } from "../ferramentas/auto-broll/src/transcript.ts";
import { lerFps } from "./autocut-premiere.ts";
import {
  blocosDeFala,
  candidatosDoPreset,
  conferirPalavras,
  lacunas,
  montarPalavras,
  planejarCortes,
  PRESET_WAV,
  relogio,
  type Bloco,
  type Palavra,
  type TrechoMantido,
} from "./pausas.ts";
import { nivelPorJanela, wavCompleto } from "./wav.ts";

declare function require(id: string): unknown;
/* eslint-disable @typescript-eslint/no-explicit-any */
const ppro = require("premierepro") as any;
const uxp = require("uxp") as any;
/* eslint-enable @typescript-eslint/no-explicit-any */

const CLIP = 1; // ppro.Constants.TrackItemType.CLIP

interface Tempo {
  readonly seconds: number;
  readonly ticks: string;
}

interface ItemLike {
  getStartTime: () => Promise<Tempo>;
  getEndTime: () => Promise<Tempo>;
  getInPoint: () => Promise<Tempo>;
  getOutPoint: () => Promise<Tempo>;
  getProjectItem: () => Promise<unknown>;
  createSetEndAction: (t: unknown) => unknown;
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
  // O WAV exportado comeca no zero da sequencia e o plano conta quadros a partir dele.
  if (Math.abs(clipe.startSeconds) > 0.001) {
    throw new Error("A gravação precisa começar no início da sequência (00:00). Arraste o clipe para o começo e rode de novo.");
  }
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

/** O que o painel mostrou por ultimo, em disco: da para ler o resultado sem o usuario colar nada. */
export async function guardarRegistro(linhas: readonly string[]): Promise<void> {
  await writeJson("pausas-registro.json", { quando: new Date().toISOString(), linhas });
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
const TICKS_POR_SEGUNDO = 254_016_000_000;

/** O que o Desfazer precisa para recolocar a bruta como estava. Ticks em texto, como o Premiere da. */
interface EstadoDesfazer {
  readonly sequencia: string;
  /** In/out do clipe NA TIMELINE antes do corte. */
  readonly inTicks: string;
  readonly outTicks: string;
  /** Marcas do item no painel Projeto; null = nao havia marca. */
  readonly marcas: { readonly inTicks: string; readonly outTicks: string } | null;
  readonly quando: string;
}

/** Sem marca, o item do projeto devolve -400000 s (rodada 6). */
const semMarca = (t: Tempo) => t.seconds < -1000;
const tickDeTexto = (ticks: string) => ppro.TickTime.createWithTicks(ticks);

/** Pedacos da V1 ou da A1 em quadros, na ordem: onde estao e de que quadro da midia partem. */
async function pedacos(video: boolean, fps: number): Promise<Array<{ de: number; ate: number; midia: number }>> {
  const { sequence } = await ativa();
  return Promise.all(
    (await itensDa(sequence, video, 0)).map(async (i) => ({
      de: Math.round((await i.getStartTime()).seconds * fps),
      ate: Math.round((await i.getEndTime()).seconds * fps),
      midia: Math.round((await i.getInPoint()).seconds * fps),
    }))
  );
}

export interface ResultadoCorte {
  readonly ok: boolean;
  readonly linhas: readonly string[];
}

/**
 * Corta as pausas NA sequencia (escolha do usuario: direto, sem copia).
 *
 * So usa o que foi provado no Premiere 25.6.6: aparar o fim do clipe
 * (`createSetEndAction`, do Auto B-roll), marcar in/out no item do projeto e
 * fazer overwrite do ProjectItem CRU (rodadas 5 e 6).
 *
 * 1. Apara a bruta no tamanho final e marca o primeiro trecho.
 * 2. Um trecho por transacao (rodada 5: o overwrite so enxerga a marca feita
 *    ANTES da transacao): a transacao k coloca o trecho k e ja marca o k+1.
 *    Da esquerda para a direita, cada overwrite cobre a bruta no lugar.
 *
 * ponytail: N+1 transacoes para N trechos (~380 numa bruta de 14 min) — o
 * Ctrl+Z do Premiere desfaz um trecho por vez, por isso existe desfazerPausas.
 * Se um dia a API aceitar trecho de midia no overwrite, vira uma transacao so.
 *
 * Erro no meio: devolve a bruta inteira antes de avisar.
 */
export async function aplicarPausas(
  margemS: number,
  aoAvancar: (feitos: number, total: number) => void
): Promise<ResultadoCorte> {
  const a = await analisarGravacao();
  const plano = planejarCortes(a.blocos, { fps: a.fps, duracaoQ: a.duracaoQ, margemS });
  if (plano.cortes.length === 0) return { ok: true, linhas: ["Nenhuma pausa para cortar."] };

  const lido = await lerFps();
  const tpf = lido.tpf > 0 ? lido.tpf : Math.round(TICKS_POR_SEGUNDO / a.fps);
  const tick = (quadros: number) => ppro.TickTime.createWithTicks(String(Math.round(quadros * tpf)));

  // O que o Desfazer precisa, gravado ANTES de mexer em qualquer coisa.
  const { sequence: seq } = await ativa();
  const [brutoV] = await itensDa(seq, true, 0);
  const [brutoA] = await itensDa(seq, false, 0);
  if (!brutoV || !brutoA) throw new Error("A gravação precisa estar na V1 com o áudio na A1.");
  const inBruto = await brutoV.getInPoint();
  const outBruto = await brutoV.getOutPoint();
  const { projectItem, clip } = await midiaDaV1();
  const VIDEO = ppro.Constants.MediaType.VIDEO;
  const marcaIn = (await clip.getInPoint(VIDEO)) as Tempo;
  const marcaOut = (await clip.getOutPoint(VIDEO)) as Tempo;
  const estado: EstadoDesfazer = {
    sequencia: a.nomeSequencia,
    inTicks: inBruto.ticks,
    outTicks: outBruto.ticks,
    marcas: semMarca(marcaIn) ? null : { inTicks: marcaIn.ticks, outTicks: marcaOut.ticks },
    quando: new Date().toISOString(),
  };
  await writeJson(ESTADO_DESFAZER, estado);

  // Quadro da MIDIA onde a gravacao comeca na timeline (0 numa bruta inteira).
  const baseQ = Math.round(Number(inBruto.ticks) / tpf);
  const marcar = (tr: TrechoMantido) => clip.createSetInOutPointsAction(tick(baseQ + tr.inicioQ), tick(baseQ + tr.fimQ));
  const devolverMarcas = () =>
    estado.marcas
      ? clip.createSetInOutPointsAction(tickDeTexto(estado.marcas.inTicks), tickDeTexto(estado.marcas.outTicks))
      : clip.createClearInOutPointsAction();

  const trechos = plano.trechos;
  const t0 = Date.now();
  let passos = 0;
  try {
    {
      // A bruta ja fica do tamanho final: os overwrites cobrem tudo, e nao sobra nada para remover.
      const { project } = await ativa();
      const fim = tick(plano.duracaoDepoisQ);
      comTransacao(project as never, "Auto Pausas: preparar", (adicionar) => {
        adicionar(brutoV.createSetEndAction(fim));
        adicionar(brutoA.createSetEndAction(fim));
        adicionar(marcar(trechos[0]!));
      });
      passos++;
    }
    for (let k = 0; k < trechos.length; k++) {
      const { project, sequence } = await ativa();
      const editor = await ppro.SequenceEditor.getEditor(sequence);
      const em = tick(trechos[k]!.destinoQ);
      const proximo = trechos[k + 1];
      comTransacao(project as never, `Auto Pausas: trecho ${k + 1} de ${trechos.length}`, (adicionar) => {
        adicionar(editor.createOverwriteItemAction(projectItem, em, 0, 0));
        adicionar(proximo ? marcar(proximo) : devolverMarcas());
      });
      passos++;
      aoAvancar(k + 1, trechos.length);

      if (k === 0) {
        // O primeiro trecho prova a conta antes dos outros ~380: se o pedaco
        // sair curto, sobraria um quadro da bruta errado em cada corte; se
        // partir de outro ponto da midia (timecode de camera), mostraria a
        // fala errada.
        const esperado = trechos[0]!.fimQ - trechos[0]!.inicioQ;
        const primeiro = (await pedacos(true, a.fps))[0];
        const veio = primeiro ? primeiro.ate - primeiro.de : 0;
        if (!primeiro || primeiro.de !== 0 || veio < esperado) {
          throw new Error(`o primeiro trecho saiu com ${veio} quadros, o plano pedia ${esperado}`);
        }
        const midiaEsperada = baseQ + trechos[0]!.inicioQ;
        if (Math.abs(primeiro.midia - midiaEsperada) > 1) {
          throw new Error(`o primeiro trecho parte do quadro ${primeiro.midia} da mídia, o plano pedia ${midiaEsperada}`);
        }
      }
    }
  } catch (e) {
    const motivo = (e as Error)?.message ?? String(e);
    let volta = "A gravação foi devolvida ao original.";
    try {
      await desfazerPausas();
    } catch (e2) {
      volta = `E NÃO consegui devolver a gravação (${(e2 as Error)?.message ?? String(e2)}): use Ctrl+Z.`;
    }
    throw new Error(`O corte parou depois de ${passos} passo(s): ${motivo}. ${volta}`);
  }
  const segundos = (Date.now() - t0) / 1000;

  // Conferir LENDO A TIMELINE, nunca pelo que foi pedido.
  const clipes = await lerClipes(0);
  const transcricao = parseTranscricao(await transcricaoDaV1());
  const depois =
    transcricao && clipes[0]
      ? montarPalavras(reconstruirTranscricao(clipes, new Map([[clipes[0].sourceName, transcricao]])))
      : [];
  const conferencia = conferirPalavras(a.palavras, depois);
  const v = await pedacos(true, a.fps);
  const au = await pedacos(false, a.fps);
  const emSincronia = JSON.stringify(v.map((p) => [p.de, p.ate])) === JSON.stringify(au.map((p) => [p.de, p.ate]));
  const fimV1 = v.length > 0 ? Math.max(...v.map((p) => p.ate)) : 0;
  const duracaoOk = Math.abs(fimV1 - plano.duracaoDepoisQ) <= 1;
  const contagemOk = v.length === trechos.length;

  return {
    ok: conferencia.ok && emSincronia && duracaoOk && contagemOk,
    linhas: [
      `${plano.cortes.length} pausas cortadas · ${relogio(plano.duracaoAntesQ, a.fps)} → ${relogio(plano.duracaoDepoisQ, a.fps)} · levou ${segundos.toFixed(0)} s`,
      ...conferencia.linhas,
      emSincronia ? "V1 e A1 em sincronia." : `V1 tem ${v.length} pedaços e A1 tem ${au.length}, ou em posições diferentes.`,
      contagemOk ? `${v.length} trechos na V1, como o plano.` : `A V1 tem ${v.length} pedaços, o plano tinha ${trechos.length}.`,
      duracaoOk
        ? "Duração confere com o plano."
        : `Duração NÃO confere: a V1 termina no quadro ${fimV1}, o plano dizia ${plano.duracaoDepoisQ}.`,
      "Para desfazer tudo, use o botão Desfazer (o Ctrl+Z do Premiere desfaz um trecho por vez).",
    ],
  };
}

/**
 * Recoloca a bruta como estava antes do ultimo corte: um overwrite do clipe
 * inteiro no zero, que cobre todos os trechos, e as marcas do item de volta.
 * Duas transacoes, qualquer que seja o tamanho do corte.
 */
export async function desfazerPausas(): Promise<string[]> {
  const estado = (await readJson(ESTADO_DESFAZER)) as EstadoDesfazer | null;
  if (!estado) throw new Error("Não há corte do Auto Pausas para desfazer.");
  const { sequence } = await ativa();
  const nome = (sequence as { name: string }).name;
  if (nome !== estado.sequencia) {
    throw new Error(`O último corte foi na sequência "${estado.sequencia}". Abra ela e clique em Desfazer de novo.`);
  }

  const { projectItem, clip } = await midiaDaV1();
  {
    const { project } = await ativa();
    comTransacao(project as never, "Auto Pausas: desfazer (marcar a bruta)", (adicionar) => {
      adicionar(clip.createSetInOutPointsAction(tickDeTexto(estado.inTicks), tickDeTexto(estado.outTicks)));
    });
  }
  {
    const { project, sequence: seq } = await ativa();
    const editor = await ppro.SequenceEditor.getEditor(seq);
    const zero = tickDeTexto("0");
    comTransacao(project as never, "Auto Pausas: desfazer (recolocar a bruta)", (adicionar) => {
      adicionar(editor.createOverwriteItemAction(projectItem, zero, 0, 0));
      adicionar(
        estado.marcas
          ? clip.createSetInOutPointsAction(tickDeTexto(estado.marcas.inTicks), tickDeTexto(estado.marcas.outTicks))
          : clip.createClearInOutPointsAction()
      );
    });
  }
  await writeJson(ESTADO_DESFAZER, null);

  const pecas = await lerClipes(0);
  return pecas.length === 1
    ? [`Desfeito: a gravação voltou inteira (${pecas[0]!.endSeconds.toFixed(1).replace(".", ",")} s).`]
    : [`Desfeito, mas a V1 ficou com ${pecas.length} pedaços: confira a timeline.`];
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
