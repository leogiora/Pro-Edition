/*
 * Podcast AutoCut — cola com o Premiere. Tudo que da para testar sem Premiere
 * mora em autocut.ts.
 *
 * A regra do lockedAccess/executeTransaction nao e reescrita aqui: vem de
 * `comTransacao`, do adapter do Auto B-roll, que ja pagou o preco de aprender
 * essas armadilhas. Uma fonte so para o que o Premiere cobra caro.
 *
 * Toda posicao de corte e calculada em TICKS INTEIROS, nunca em segundos. Foi
 * a primeira versao em ponto flutuante que cortou um quadro fora do lugar
 * (601/1199 em vez de 600/1200): segundo nao cai em quadro, tick cai.
 */

import { caminhoParaUrl, sourceToSequence, type TimelineClip } from "../ferramentas/auto-broll/src/domain.ts";
import { comTransacao, getSequenceInfo, lerTranscricoes } from "../ferramentas/auto-broll/src/premiere.ts";
import { parseTranscricao } from "../ferramentas/auto-broll/src/transcript.ts";
import { nivelPorJanela } from "./wav.ts";
import {
  cortes,
  decidir,
  falaPorNivel,
  fonteEsperada,
  speakerEm,
  type Config,
  type ConfigNivel,
  type Intervalo,
  type Mapa,
  type Segmento,
  type Trecho,
} from "./autocut.ts";

declare function require(id: string): unknown;
/* eslint-disable @typescript-eslint/no-explicit-any */
const ppro = require("premierepro") as any;
const uxp = require("uxp") as any;
/* eslint-enable @typescript-eslint/no-explicit-any */

const CLIP = 1; // ppro.Constants.TrackItemType.CLIP
const TICKS_POR_SEGUNDO = 254_016_000_000; // constante do Premiere, fixa desde sempre

export { getSequenceInfo };

export interface Fps {
  readonly valor: number;
  readonly origem: string;
  /** Ticks por quadro da sequencia. 0 quando o Premiere nao entregou a taxa. */
  readonly tpf: number;
}

/** O que um objeto nativo do UXP realmente expoe — proprio E prototipo. */
function chavesDe(obj: unknown): string {
  if (!obj) return String(obj);
  const proto = Object.getPrototypeOf(obj) ?? {};
  return [...new Set([...Object.keys(obj), ...Object.getOwnPropertyNames(proto)])]
    .filter((k) => k !== "constructor")
    .join(", ");
}

/**
 * Nomes plausiveis para a taxa de quadros. `getVideoFrameRate` e o que a doc
 * atual documenta, mas NAO existe nesta versao do Premiere (confirmado listando
 * as chaves de settings e de sequence) — dai a lista, e dai a falha devolver as
 * chaves REAIS dos dois objetos em vez de um zero mudo.
 */
const CANDIDATOS = ["getVideoFrameRate", "getFrameRate", "videoFrameRate", "frameRate"] as const;

async function tentarTaxa(obj: unknown): Promise<unknown> {
  for (const nome of CANDIDATOS) {
    const alvo = (obj as Record<string, unknown> | null)?.[nome];
    if (alvo === undefined || alvo === null) continue;
    // `getVideoFrameRate()` devolve FrameRate DIRETO, nao Promise. `await` num
    // objeto que nao e thenable e inofensivo, entao um caminho cobre os dois.
    const r = typeof alvo === "function" ? await (alvo as () => unknown).call(obj) : alvo;
    if (r !== undefined && r !== null) return r;
  }
  return undefined;
}

/** Numero e FrameRate chegam pelos dois caminhos; o que importa e o par (fps, ticks). */
function normalizar(r: unknown): { valor: number; tpf: number } | null {
  const numero = (v: unknown): number => {
    const n = Number(v);
    return Number.isFinite(n) && n > 0 ? n : 0;
  };
  if (typeof r === "number" || typeof r === "string") {
    const v = numero(r);
    return v > 0 ? { valor: v, tpf: 0 } : null;
  }
  const o = r as { value?: unknown; ticksPerFrame?: unknown } | null | undefined;
  const tpf = numero(o?.ticksPerFrame);
  const valor = numero(o?.value) || (tpf > 0 ? TICKS_POR_SEGUNDO / tpf : 0);
  return valor > 0 ? { valor, tpf } : null;
}

/**
 * A taxa de quadros da sequencia.
 *
 * `ticksPerFrame` e o que interessa de verdade: e ele que torna o corte exato
 * em 29.97 e 59.94, onde dividir 254016000000 pelo fps nao da inteiro.
 */
export async function lerFps(): Promise<Fps> {
  const { sequence } = await ativa();
  let settings: unknown = null;
  try {
    // `Sequence.getTimebase()` e o caminho bom: devolve ticks por quadro, que e
    // o numero exato de que o corte precisa — sem passar por fps em ponto
    // flutuante. Vem como string em algumas versoes, dai o Number().
    const timebase = Number(await (sequence as { getTimebase?: () => unknown }).getTimebase?.());
    if (Number.isFinite(timebase) && timebase > 0) {
      return { valor: TICKS_POR_SEGUNDO / timebase, tpf: timebase, origem: "sequence.getTimebase()" };
    }

    settings = await (sequence as { getSettings: () => Promise<unknown> }).getSettings();

    for (const [onde, obj] of [
      ["settings", settings],
      ["sequence", sequence],
    ] as const) {
      const achado = normalizar(await tentarTaxa(obj));
      if (achado) return { ...achado, origem: onde };
    }
    return {
      valor: 0,
      tpf: 0,
      origem: `settings expoe: ${chavesDe(settings)} | sequence expoe: ${chavesDe(sequence)}`,
    };
  } catch (e) {
    return {
      valor: 0,
      tpf: 0,
      origem: `${(e as Error)?.message ?? String(e)} | settings expoe: ${chavesDe(settings)}`,
    };
  }
}

/**
 * O quadro da sequencia, em ticks.
 *
 * Ordem de preferencia: o `ticksPerFrame` que a sequencia informa; senao o que
 * `FrameRate.createWithValue` calcula para o fps escolhido — ele conhece as
 * taxas NTSC, onde 254016000000/59.94 erra e o corte sai do quadro. A divisao
 * crua so entra se ate isso faltar, e ai a UI avisa.
 */
async function quadroEmTicks(fpsEscolhido: number): Promise<{ tpf: number; aviso: string | null }> {
  const f = await lerFps();
  if (f.tpf > 0) return { tpf: f.tpf, aviso: null };
  if (!(fpsEscolhido > 0)) throw new Error("Sem taxa de quadros: nao da para cortar sem saber onde ficam os quadros.");

  const feito = normalizar(await ppro.FrameRate?.createWithValue?.(fpsEscolhido));
  if (feito && feito.tpf > 0) return { tpf: feito.tpf, aviso: null };

  return {
    tpf: Math.round(TICKS_POR_SEGUNDO / fpsEscolhido),
    aviso:
      `Quadro estimado por divisao (${fpsEscolhido} fps): o Premiere nao informou a taxa e ` +
      `FrameRate.createWithValue nao respondeu. Em 29.97/59.94 o corte pode sair 1 quadro. (${f.origem})`,
  };
}

interface Tempo {
  readonly seconds: number;
  readonly ticksNumber?: number;
}

interface Item {
  getStartTime: () => Promise<Tempo>;
  getEndTime: () => Promise<Tempo>;
  getInPoint: () => Promise<Tempo>;
  getOutPoint: () => Promise<Tempo>;
  getSpeed: () => Promise<number>;
  getProjectItem: () => Promise<{ name: string } | null>;
  isDisabled?: () => Promise<boolean>;
  createSetDisabledAction: (disabled: boolean) => unknown;
  createSetInPointAction: (t: unknown) => unknown;
  createSetEndAction: (t: unknown) => unknown;
}

/** Quadro de um tempo do Premiere. Usa ticks quando existem; segundos so na falta. */
function emQuadros(t: Tempo, tpf: number): number {
  const ticks = typeof t?.ticksNumber === "number" ? t.ticksNumber : (t?.seconds ?? 0) * TICKS_POR_SEGUNDO;
  return Math.round(ticks / tpf);
}

function tick(quadros: number, tpf: number): unknown {
  return ppro.TickTime.createWithTicks(String(Math.round(quadros * tpf)));
}

function comoTempo(quadros: number, tpf: number): string {
  return `${((quadros * tpf) / TICKS_POR_SEGUNDO).toFixed(3)}s`;
}

/** Quadro da sequencia onde cai um instante do plano. */
function planoParaQuadro(segundos: number, tpf: number): number {
  return Math.round((segundos * TICKS_POR_SEGUNDO) / tpf);
}

/** disabled=true e OFF. A inversao mora aqui e em nenhum outro lugar. */
function ligar(item: Item, ligado: boolean): unknown {
  return item.createSetDisabledAction(!ligado);
}

interface Alvo {
  readonly video: boolean;
  readonly indice: number;
  readonly pessoa: "A" | "B";
}

/** As quatro tracks do mapa, na ordem A-video, A-audio, B-video, B-audio. */
function quatro(mapa: Mapa): Alvo[] {
  return [
    { video: true, indice: mapa.videoA, pessoa: "A" },
    { video: false, indice: mapa.audioA, pessoa: "A" },
    { video: true, indice: mapa.videoB, pessoa: "B" },
    { video: false, indice: mapa.audioB, pessoa: "B" },
  ];
}

function rotulo(alvo: Alvo): string {
  return `${alvo.video ? "V" : "A"}${alvo.indice + 1}`;
}

async function ativa(): Promise<{ project: unknown; sequence: unknown }> {
  const project = await ppro.Project.getActiveProject();
  if (!project) throw new Error("Nenhum projeto aberto.");
  const sequence = await project.getActiveSequence();
  if (!sequence) throw new Error("Nenhuma sequencia ativa. Abra a sequencia do podcast.");
  return { project, sequence };
}

async function itensDa(sequence: unknown, alvo: Alvo): Promise<Item[]> {
  const seq = sequence as {
    getVideoTrack: (i: number) => Promise<{ getTrackItems: (t: number, e: boolean) => Promise<Item[]> } | null>;
    getAudioTrack: (i: number) => Promise<{ getTrackItems: (t: number, e: boolean) => Promise<Item[]> } | null>;
  };
  const faixa = alvo.video ? await seq.getVideoTrack(alvo.indice) : await seq.getAudioTrack(alvo.indice);
  if (!faixa) throw new Error(`Track ${rotulo(alvo)} nao existe nesta sequencia.`);

  // getTrackItems nao promete ordem, e saber qual e o ULTIMO pedaco depende dela.
  const itens = await faixa.getTrackItems(CLIP, false);
  const medidos = await Promise.all(itens.map(async (i) => ({ i, s: (await i.getStartTime()).seconds })));
  return medidos.sort((a, b) => a.s - b.s).map((m) => m.i);
}

interface Pedaco {
  readonly inicioQ: number;
  readonly fimQ: number;
  readonly fonteQ: number;
}

async function medir(item: Item, tpf: number): Promise<Pedaco> {
  return {
    inicioQ: emQuadros(await item.getStartTime(), tpf),
    fimQ: emQuadros(await item.getEndTime(), tpf),
    fonteQ: emQuadros(await item.getInPoint(), tpf),
  };
}

export interface Diagnostico {
  readonly ok: boolean;
  readonly linhas: readonly string[];
}

/**
 * O MVP exige um clipe continuo por track — cortar por cima de uma timeline ja
 * editada e outro problema. Checar ANTES de mexer em qualquer coisa.
 */
export async function validar(mapa: Mapa, segmentos: readonly Segmento[], fps: number): Promise<Diagnostico> {
  const linhas: string[] = [];
  let ok = true;
  const { tpf, aviso } = await quadroEmTicks(fps);
  if (aviso) linhas.push(aviso);

  // O clipe nao precisa comecar em zero: precisa COBRIR o trecho planejado.
  const inicioPlano = planoParaQuadro((segmentos[0]?.inicioF ?? 0) / fps, tpf);
  const fimPlano = planoParaQuadro((segmentos[segmentos.length - 1]?.fimF ?? 0) / fps, tpf);
  const { sequence } = await ativa();

  if (mapa.videoA === mapa.videoB || mapa.audioA === mapa.audioB) {
    linhas.push("As duas pessoas nao podem dividir a mesma track.");
    ok = false;
  }

  for (const alvo of quatro(mapa)) {
    const itens = await itensDa(sequence, alvo);
    if (itens.length !== 1) {
      linhas.push(`${rotulo(alvo)}: ${itens.length} clipes — o MVP precisa de exatamente 1 clipe continuo.`);
      ok = false;
      continue;
    }
    const item = itens[0]!;
    for (const metodo of ["createSetDisabledAction", "createSetInPointAction", "createSetEndAction"] as const) {
      if (typeof item[metodo] !== "function") {
        linhas.push(`${rotulo(alvo)}: este Premiere nao tem ${metodo} (precisa de 25.6+).`);
        ok = false;
      }
    }
    const p = await medir(item, tpf);
    if (p.inicioQ > inicioPlano || p.fimQ < fimPlano) {
      linhas.push(
        `${rotulo(alvo)}: clipe cobre ${comoTempo(p.inicioQ, tpf)}-${comoTempo(p.fimQ, tpf)}, ` +
          `o plano precisa de ${comoTempo(inicioPlano, tpf)}-${comoTempo(fimPlano, tpf)}.`
      );
      ok = false;
    } else {
      linhas.push(
        `${rotulo(alvo)}: ok — ${comoTempo(p.inicioQ, tpf)}-${comoTempo(p.fimQ, tpf)}, ` +
          `fonte em ${comoTempo(p.fonteQ, tpf)}`
      );
    }
  }
  return { ok, linhas };
}

/**
 * Corta as quatro tracks nos mesmos quadros e liga/desliga os pares.
 *
 * Nao existe split/razor na API publica do UXP (conferido na referencia de
 * VideoClipTrackItem e SequenceEditor). O corte e feito clonando o clipe com
 * deslocamento — uma edicao de overwrite, que apara o original no ponto do
 * corte.
 *
 * O clone e uma copia de DURACAO INTEIRA: clonar [0, 103s] com 10s de
 * deslocamento produz [10s, 113s], que passa do fim do original e empurra a
 * cauda da sequencia. Por isso o ultimo pedaco de cada track e aparado de volta
 * ao fim que o clipe tinha antes — sem isso a sequencia cresce a cada corte.
 *
 * A fonte de cada pedaco tambem e CONFERIDA e so corrigida quando esta fora do
 * lugar: se um dia o clone ja vier com a fonte certa, isto continua correto.
 *
 * ponytail: uma transacao (um Undo) por corte. Num podcast de 1h isso vira
 * centenas de Undos; juntar tudo numa transacao so depende de saber em que
 * ordem os clones se sobrescrevem, e isso so o Premiere real responde.
 */
export async function aplicar(mapa: Mapa, segmentos: readonly Segmento[], fps: number): Promise<Diagnostico> {
  const linhas: string[] = [];
  const tracks = quatro(mapa);
  const { tpf, aviso } = await quadroEmTicks(fps);
  if (aviso) linhas.push(aviso);

  const pontos = cortes(segmentos).map((f) => planoParaQuadro(f / fps, tpf));

  // 1. Como cada track estava ANTES de qualquer corte: e dai que saem a fonte
  //    esperada de cada pedaco e o fim ao qual a track tem de voltar.
  const origem = new Map<string, Pedaco>();
  {
    const { sequence } = await ativa();
    for (const alvo of tracks) {
      const itens = await itensDa(sequence, alvo);
      if (itens.length !== 1) throw new Error(`${rotulo(alvo)} nao tem 1 clipe continuo. Rode ANALISAR antes.`);
      origem.set(rotulo(alvo), await medir(itens[0]!, tpf));
    }
  }

  // 2. Um corte por vez, nas quatro tracks juntas. Precisa reler entre cortes:
  //    a Action de clone nao devolve o clipe novo.
  let aplicados = 0;
  for (const quadro of pontos) {
    const { project, sequence } = await ativa();
    const editor = await ppro.SequenceEditor.getEditor(sequence);
    const alvos: Array<{ item: Item; deslocamento: unknown }> = [];

    for (const alvo of tracks) {
      for (const item of await itensDa(sequence, alvo)) {
        const p = await medir(item, tpf);
        // So o pedaco que CONTEM o corte, e nunca em cima de uma borda que ja existe.
        if (quadro <= p.inicioQ || quadro >= p.fimQ) continue;
        alvos.push({ item, deslocamento: tick(quadro - p.inicioQ, tpf) });
      }
    }

    // Corte que cai numa borda que ja existe nao atinge ninguem, e isso e
    // normal: o fim do plano costuma ser o fim do clipe.
    if (alvos.length === 0) continue;
    if (alvos.length !== 4) {
      linhas.push(`corte em ${comoTempo(quadro, tpf)}: ${alvos.length} tracks atingidas, esperado 4.`);
    }

    comTransacao(project as never, `Podcast AutoCut: corte em ${comoTempo(quadro, tpf)}`, (adicionar) => {
      for (const a of alvos) {
        adicionar(editor.createCloneTrackItemAction(a.item, a.deslocamento, 0, 0, true, false));
      }
    });
    aplicados++;
  }
  linhas.push(`${aplicados} cortes aplicados.`);

  // 3. Devolver a duracao original, corrigir a fonte de cada pedaco e
  //    ligar/desligar os pares — uma transacao so para a timeline inteira.
  const { project, sequence } = await ativa();
  const acoes: Array<() => unknown> = [];
  const bordas = new Map<string, string>();
  let corrigidos = 0;
  let aparados = 0;
  let foraDoPlano = 0;

  for (const alvo of tracks) {
    const base = origem.get(rotulo(alvo))!;
    const itens = await itensDa(sequence, alvo);
    const inicios: number[] = [];

    for (const [indice, item] of itens.entries()) {
      const p = await medir(item, tpf);
      inicios.push(p.inicioQ);

      // O clone passou do fim do original — so o ultimo pedaco pode ter sobrado.
      if (indice === itens.length - 1 && p.fimQ > base.fimQ) {
        const fim = tick(base.fimQ, tpf);
        acoes.push(() => item.createSetEndAction(fim));
        aparados++;
      }

      const fonteEsperadaQ = fonteEsperada(base.fonteQ, base.inicioQ, p.inicioQ);
      if (p.fonteQ !== fonteEsperadaQ) {
        const emTicks = tick(fonteEsperadaQ, tpf);
        acoes.push(() => item.createSetInPointAction(emTicks));
        corrigidos++;
      }

      const quem = speakerEm(segmentos, Math.round(((p.inicioQ * tpf) / TICKS_POR_SEGUNDO) * fps));
      if (quem === null) {
        foraDoPlano++;
        continue;
      }
      acoes.push(() => ligar(item, quem === alvo.pessoa));
    }
    bordas.set(rotulo(alvo), inicios.join(","));
  }

  comTransacao(project as never, "Podcast AutoCut: sincronizar e alternar", (adicionar) => {
    for (const acao of acoes) adicionar(acao());
  });

  linhas.push(`${aparados} pedacos aparados de volta ao fim original.`);
  linhas.push(`${corrigidos} pedacos tiveram a fonte corrigida.`);
  if (foraDoPlano > 0) linhas.push(`${foraDoPlano} pedacos fora do plano ficaram como estavam.`);

  // 4. Verificar os invariantes do spec, relendo a timeline depois de aplicar.
  //    Confiar no que se mandou fazer nao e verificar: o que vale e o que ficou.
  let ok = true;

  const unicas = new Set(bordas.values());
  if (unicas.size === 1) {
    linhas.push(`boundaries identicos nas 4 tracks: [${[...unicas][0]}]`);
  } else {
    for (const [nome, b] of bordas) linhas.push(`${nome}: [${b}]`);
    linhas.push("BOUNDARIES DIFERENTES — o corte nao ficou alinhado.");
    ok = false;
  }

  const erradas: string[] = [];
  let conferidos = 0;
  for (const alvo of tracks) {
    for (const item of await itensDa(await (await ativa()).sequence, alvo)) {
      if (typeof item.isDisabled !== "function") continue;
      const p = await medir(item, tpf);
      const quem = speakerEm(segmentos, Math.round(((p.inicioQ * tpf) / TICKS_POR_SEGUNDO) * fps));
      if (quem === null) continue;
      conferidos++;
      const deveriaLigado = quem === alvo.pessoa;
      if ((await item.isDisabled()) === deveriaLigado) {
        erradas.push(`${rotulo(alvo)}@${comoTempo(p.inicioQ, tpf)} deveria estar ${deveriaLigado ? "ON" : "OFF"}`);
      }
    }
  }
  if (erradas.length > 0) {
    linhas.push(`ON/OFF errado em ${erradas.length} de ${conferidos} pedacos:`, ...erradas.slice(0, 8));
    ok = false;
  } else if (conferidos > 0) {
    linhas.push(`ON/OFF conferido e correto nos ${conferidos} pedacos do plano.`);
  } else {
    linhas.push("Este Premiere nao tem isDisabled(): nao deu para conferir o ON/OFF.");
  }

  return { ok, linhas };
}

// ------------------------------------------------------- deteccao de fala

/**
 * Palavras da transcricao em tempo de SEQUENCIA.
 *
 * `sourceToSequence` devolve null para o que ficou fora do corte — palavra que
 * nao esta na timeline nao pode decidir camera nenhuma.
 */
function palavrasDe(json: string, clip: TimelineClip): Intervalo[] {
  const saida: Intervalo[] = [];
  for (const [, palavras] of palavrasPorSpeaker(json, clip)) saida.push(...palavras);
  return saida.sort((x, y) => x.inicioMs - y.inicioMs);
}

/**
 * Nomes que o rotulo de interlocutor pode ter no JSON do Premiere. O parser do
 * Auto B-roll le so `speaker`; se a versao usar outro nome, tudo cairia num
 * balde so e o AutoCut acharia que o podcast tem uma pessoa.
 */
const CAMPOS_SPEAKER = [
  "speaker",
  "speakerId",
  "speakerLabel",
  "speakerName",
  "speaker_id",
  "speaker_label",
  "talker",
] as const;

/** Rotulo de cada segmento, indexado pelo instante em que ele comeca. */
function rotulosPorInicio(json: string): Map<number, string> {
  const mapa = new Map<number, string>();
  try {
    const o = JSON.parse(json) as { segments?: unknown[] };
    for (const s of Array.isArray(o.segments) ? o.segments : []) {
      if (typeof s !== "object" || s === null) continue;
      const seg = s as Record<string, unknown>;
      if (typeof seg.start !== "number") continue;
      for (const campo of CAMPOS_SPEAKER) {
        const v = seg[campo];
        if (v !== undefined && v !== null && v !== "") {
          mapa.set(seg.start, String(v));
          break;
        }
      }
    }
  } catch {
    // JSON ilegivel: `diagnosticoDaTranscricao` conta o que houve.
  }
  return mapa;
}

/**
 * O que o JSON realmente traz — para nao ficar adivinhando o nome do campo,
 * do mesmo jeito que a taxa de quadros so apareceu quando listamos as chaves.
 */
function diagnosticoDaTranscricao(json: string): string {
  try {
    const o = JSON.parse(json) as { segments?: unknown[] };
    const segs = Array.isArray(o.segments) ? o.segments : [];
    const chaves = new Set<string>();
    for (const s of segs.slice(0, 50)) {
      if (typeof s === "object" && s !== null) for (const k of Object.keys(s)) chaves.add(k);
    }
    return `${segs.length} segmentos, campos: ${[...chaves].join(", ") || "nenhum"}`;
  } catch {
    return "JSON da transcricao ilegivel";
  }
}

/** Palavras separadas por interlocutor, na ordem em que cada um falou pela primeira vez. */
function palavrasPorSpeaker(json: string, clip: TimelineClip): Map<string, Intervalo[]> {
  const rotulos = rotulosPorInicio(json);
  const porPessoa = new Map<string, Intervalo[]>();
  for (const seg of parseTranscricao(json)?.segments ?? []) {
    const quem = rotulos.get(seg.start) ?? seg.speaker;
    for (const w of seg.words) {
      const inicio = sourceToSequence(clip, w.start);
      if (inicio === null) continue;
      const lista = porPessoa.get(quem) ?? [];
      if (lista.length === 0) porPessoa.set(quem, lista);
      lista.push({ inicioMs: inicio * 1000, fimMs: (inicio + w.duration / clip.speed) * 1000 });
    }
  }
  return porPessoa;
}

/**
 * Quem fala, e quando — sem VAD e sem PCM.
 *
 * O spec previa analisar o audio bruto, mas o Premiere ja transcreveu cada
 * microfone: palavra no transcript do mic da Pessoa A E a Pessoa A falando,
 * com tempo por palavra. Isso dispensa o acesso a PCM, que era o segundo maior
 * risco do projeto, e reaproveita o parser que o Auto B-roll ja tem testado.
 *
 * Quando as duas tracks de audio apontam para a MESMA midia (recorder
 * multicanal, um arquivo com um microfone por canal), nao ha duas transcricoes
 * para comparar — ai quem separa e o rotulo de interlocutor que o Premiere
 * atribuiu dentro da unica transcricao.
 *
 * Exige que o audio tenha sido transcrito no Premiere (painel Texto >
 * Transcrever). Sem isso nao ha o que analisar, e a mensagem diz exatamente
 * isso em vez de devolver um plano vazio.
 */
export async function analisarFala(mapa: Mapa, cfg: Config): Promise<{ trechos: Trecho[]; linhas: string[] }> {
  const linhas: string[] = [];
  const { sequence } = await ativa();

  const micos = [
    { pessoa: "A" as const, alvo: { video: false, indice: mapa.audioA, pessoa: "A" as const } },
    { pessoa: "B" as const, alvo: { video: false, indice: mapa.audioB, pessoa: "B" as const } },
  ];

  const clipes = new Map<"A" | "B", { nome: string; clip: TimelineClip }>();
  for (const m of micos) {
    const itens = await itensDa(sequence, m.alvo);
    if (itens.length !== 1) {
      throw new Error(`${rotulo(m.alvo)}: ${itens.length} clipes — o MVP precisa de 1 clipe continuo por microfone.`);
    }
    const it = itens[0]!;
    const nome = (await it.getProjectItem())?.name;
    if (!nome) throw new Error(`${rotulo(m.alvo)}: nao deu para identificar a midia deste clipe.`);

    const velocidade = await it.getSpeed();
    clipes.set(m.pessoa, {
      nome,
      clip: {
        startSeconds: (await it.getStartTime()).seconds,
        endSeconds: (await it.getEndTime()).seconds,
        inPointSeconds: (await it.getInPoint()).seconds,
        outPointSeconds: (await it.getOutPoint()).seconds,
        speed: velocidade > 0 ? velocidade : 1,
      },
    });
  }

  const a = clipes.get("A")!;
  const b = clipes.get("B")!;
  const mesmaMidia = a.nome === b.nome;

  const { transcricoes, falhas } = await lerTranscricoes(mesmaMidia ? [a.nome] : [a.nome, b.nome]);
  for (const f of falhas) linhas.push(`${f.nome}: ${f.motivo}`);

  const semTranscricao = (mesmaMidia ? [a] : [a, b]).filter((c) => !transcricoes.get(c.nome));
  if (semTranscricao.length > 0) {
    throw new Error(
      `Sem transcricao para ${semTranscricao.map((c) => c.nome).join(" e ")}. ` +
        "No Premiere: painel Texto > Transcrever, em cada clipe de audio."
    );
  }

  let falaA: Intervalo[];
  let falaB: Intervalo[];

  if (mesmaMidia) {
    // Os dois microfones vieram no mesmo arquivo, em canais diferentes — e o
    // caso de quem grava num recorder multicanal. `exportToJSON` da UMA
    // transcricao por midia, entao separar por arquivo nao serve; quem separa
    // e o rotulo de interlocutor que o proprio Premiere atribuiu.
    const porPessoa = palavrasPorSpeaker(transcricoes.get(a.nome)!, a.clip);
    const rotulos = [...porPessoa.keys()];
    if (rotulos.length < 2) {
      throw new Error(
        `${a.nome} esta nas duas tracks de audio e sua transcricao tem um interlocutor so ` +
          `(${diagnosticoDaTranscricao(transcricoes.get(a.nome)!)}), entao nao da para saber quem fala por ela. ` +
          "Saida melhor: preencha o campo de WAV la em cima e analise pelo nivel de cada canal, " +
          "que nao usa transcricao nenhuma. Alternativa: retranscrever no Premiere com a " +
          "deteccao de interlocutores ligada."
      );
    }
    falaA = porPessoa.get(rotulos[0]!)!;
    falaB = porPessoa.get(rotulos[1]!)!;
    linhas.push(`${a.nome}: um arquivo para os dois microfones.`);
    linhas.push(
      `Pessoa A = "${rotulos[0]}", Pessoa B = "${rotulos[1]}" — pela ordem de quem falou primeiro.`,
      "Se estiver trocado, inverta os seletores: Pessoa A = V2/A2 e Pessoa B = V1/A1."
    );
    if (rotulos.length > 2) linhas.push(`Ignorados: ${rotulos.slice(2).join(", ")}.`);
  } else {
    falaA = palavrasDe(transcricoes.get(a.nome)!, a.clip);
    falaB = palavrasDe(transcricoes.get(b.nome)!, b.clip);
  }

  linhas.push(`Pessoa A: ${falaA.length} palavras`, `Pessoa B: ${falaB.length} palavras`);

  const trechos = decidir(falaA, falaB, cfg);
  if (trechos.length === 0) throw new Error("Nenhuma fala reconhecida nos dois microfones.");

  linhas.push(`${trechos.length} planos, ${trechos.length - 1} trocas de camera.`);
  return { trechos, linhas };
}

/**
 * Quem fala, lido do nivel de audio de um WAV multicanal.
 *
 * E o caminho para quem grava os dois microfones num arquivo so: a transcricao
 * do Premiere da UMA lista de palavras para a midia inteira e depende de o
 * Premiere adivinhar quem e quem, enquanto o canal ja separa as pessoas por
 * construcao.
 *
 * Exige WAV porque `.mkv` e `.mp4` trazem audio comprimido, e decodificar isso
 * aqui seria um projeto inteiro. No Premiere: Arquivo > Exportar > Midia, so
 * audio, formato WAV (PCM 16 ou 24 bits), preservando os canais.
 *
 * ponytail: o UXP nao tem leitura parcial de arquivo — o WAV inteiro entra na
 * memoria de uma vez. Uma hora de podcast em 48 kHz/16 bits/4 canais passa de
 * 1 GB; exportar em 16 kHz resolve, porque nivel de voz nao precisa de banda.
 */
export async function analisarNivel(
  caminho: string,
  canalA: number,
  canalB: number,
  cfg: Config,
  cfgNivel: ConfigNivel
): Promise<{ trechos: Trecho[]; linhas: string[] }> {
  const linhas: string[] = [];
  if (canalA === canalB) throw new Error("Pessoa A e Pessoa B nao podem usar o mesmo canal.");

  const entrada = (await uxp.storage.localFileSystem.getEntryWithUrl(caminhoParaUrl(caminho))) as {
    read: (o: unknown) => Promise<ArrayBuffer>;
  } | null;
  if (!entrada) throw new Error(`Arquivo nao encontrado: ${caminho}`);
  if (typeof entrada.read !== "function") throw new Error(`Isto e uma pasta, nao um arquivo: ${caminho}`);

  const bytes = new Uint8Array(await entrada.read({ format: uxp.storage.formats.binary }));
  const janelas = nivelPorJanela(bytes);
  const canais = janelas.db.length;
  linhas.push(`WAV: ${canais} canais a ${janelas.taxa} Hz, ${(bytes.byteLength / 1e6).toFixed(0)} MB.`);

  if (canalA >= canais || canalB >= canais) {
    throw new Error(`O arquivo tem ${canais} canais; foram pedidos os canais ${canalA + 1} e ${canalB + 1}.`);
  }

  const { a, b } = falaPorNivel(janelas.db[canalA]!, janelas.db[canalB]!, janelas.janelaMs, cfgNivel);
  linhas.push(`Canal ${canalA + 1}: ${a.length} blocos de voz`, `Canal ${canalB + 1}: ${b.length} blocos de voz`);

  const trechos = decidir(a, b, cfg);
  if (trechos.length === 0) throw new Error("Nenhuma voz reconhecida nos dois canais.");

  linhas.push(`${trechos.length} planos, ${trechos.length - 1} trocas de camera.`);
  return { trechos, linhas };
}
