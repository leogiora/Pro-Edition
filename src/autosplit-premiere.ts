/*
 * Auto Split — cola com o Premiere. Tudo que da pra testar sem Premiere mora
 * em autosplit.ts.
 *
 * A regra do lockedAccess/executeTransaction nao e reescrita aqui: vem de
 * `comTransacao`, do adapter do Auto B-roll. Uma fonte so pro que o Premiere
 * cobra caro.
 */

import {
  comTransacao,
  getSequenceInfo,
  lerBrollsAcimaDeV1,
  readJson,
  writeJson,
} from "../ferramentas/auto-broll/src/premiere.ts";
import {
  calcularEnquadramento,
  fracaoDivisao,
  resolverPerfil,
  FEATHER_PCT,
  ROUNDNESS_PCT,
  type Enquadramento,
  type EntradaGeom,
  type OverridePerfil,
  type Perfil,
} from "./autosplit.ts";
import perfilBruto from "./autosplit-perfil.json";

declare function require(id: string): unknown;
/* eslint-disable @typescript-eslint/no-explicit-any */
const ppro = require("premierepro") as any;
/* eslint-enable @typescript-eslint/no-explicit-any */

const CLIP = 1; // ppro.Constants.TrackItemType.CLIP
const MATCH_MOTION = "AE.ADBE Motion";

/*
 * Tudo abaixo saiu do diag-autosplit.json rodado no Premiere 26, nao de
 * leitura de documentacao:
 *
 *  - o efeito que o usuario chama de "Cantos arredondados" e o "Rounded Crop",
 *    matchName AE.Impact_Crop_FX. createComponent + createAppendComponentAction
 *    + setar Top/Feather/Roundness: todos OK ao vivo.
 *  - Position do Motion NAO aceita array: createKeyframe([x,y]) devolve
 *    "Illegal Parameter type". Aceita PointF.
 *  - os params de um componente so existem depois de ele estar na chain, por
 *    isso aplicar sao DUAS transacoes: anexar, depois setar.
 */
const MATCH_EFEITO = "AE.Impact_Crop_FX";
const PARAM_TOPO = "Top";
const PARAM_FEATHER = "Feather";
const PARAM_ROUNDNESS = "Roundness";

const perfil = perfilBruto as unknown as Perfil;

export { getSequenceInfo };

// ------------------------------------------------------- tipos do host

interface TrackItemLike {
  name?: string;
  getProjectItem?: () => Promise<{ name: string } | null>;
  getStartTime: () => Promise<{ seconds: number }>;
  getEndTime: () => Promise<{ seconds: number }>;
  getComponentChain: () => Promise<ChainLike>;
}
interface ChainLike {
  getComponentCount: () => number;
  getComponentAtIndex: (i: number) => ComponentLike;
  createAppendComponentAction: (c: unknown) => unknown;
  createInsertComponentAction: (c: unknown, i: number) => unknown;
  createRemoveComponentAction: (c: unknown) => unknown;
}
interface ComponentLike {
  getMatchName: () => Promise<string>;
  getParamCount: () => number;
  getParam: (i: number) => ParamLike;
}
interface ParamLike {
  displayName: string;
  createKeyframe: (v: unknown) => unknown;
  createSetValueAction: (k: unknown, s: boolean) => unknown;
  getStartValue?: () => Promise<{ value?: { value?: unknown } } | unknown>;
  getValueAtTime?: (t: unknown) => Promise<unknown>;
}
interface SeqFaixas {
  getVideoTrack: (i: number) => Promise<{ getTrackItems: (t: number, e: boolean) => Promise<TrackItemLike[]> }>;
}

async function ativa(): Promise<{ project: unknown; sequence: unknown }> {
  const project = await ppro.Project.getActiveProject();
  if (!project) throw new Error("Nenhum projeto aberto.");
  const sequence = await project.getActiveSequence();
  if (!sequence) throw new Error("Nenhuma sequencia ativa. Abra a sequencia do video.");
  return { project, sequence };
}

// ------------------------------------------------------- plano

export interface OpcoesSplit {
  readonly faixa: number | null;
  readonly divisao: number; // valor do campo, ex. 50
  readonly subirDoutor: boolean;
  readonly refazer: boolean;
}

export interface ItemPlano {
  readonly sourceName: string;
  readonly startSeconds: number;
  readonly endSeconds: number;
  readonly videoTrackIndex: number;
  readonly orientacao: "retrato" | "paisagem";
  readonly perfilOrigem: "override" | "arquivo" | "conceito" | "default";
  readonly enquadramento: Enquadramento;
  readonly geom: EntradaGeom;
}

export interface PlanoSplit {
  readonly W: number;
  readonly H: number;
  readonly itens: readonly ItemPlano[];
  readonly linhas: readonly string[];
}

async function lerOverride(): Promise<OverridePerfil> {
  const bruto = await readJson("autosplit-perfil-override.json");
  return (bruto && typeof bruto === "object" ? bruto : {}) as OverridePerfil;
}

/**
 * Le tudo que esta acima da V1, fica so com o que a biblioteca conhece, e
 * calcula o enquadramento de cada um. Nao toca a timeline.
 *
 * **Clipe sem perfil e PULADO, nao chutado.** `lerBrollsAcimaDeV1()` devolve
 * tudo que mora acima da V1 — e ali nao ha so B-roll: light leak, overlay e
 * material proprio do usuario tambem ficam la. Na primeira rodada real, 19 dos
 * 28 clipes eram um `Generated Light Leak` e um video do proprio usuario, e
 * estilizar os dois com dimensao chutada (1080x1920) foi o que estragou a
 * timeline. Sem `w`/`h` de verdade nao ha enquadramento possivel: o certo e
 * dizer o nome e nao encostar.
 */
export async function montarPlano(opcoes: OpcoesSplit): Promise<PlanoSplit> {
  const info = await getSequenceInfo();
  if (!(info.width > 0) || !(info.height > 0)) {
    throw new Error("Nao deu pra ler o quadro da sequencia.");
  }
  const override = await lerOverride();
  const brollTopoFrac = fracaoDivisao(opcoes.divisao);

  const todos = await lerBrollsAcimaDeV1();
  const alvo = opcoes.faixa === null ? todos : todos.filter((b) => b.videoTrackIndex === opcoes.faixa);

  const linhas: string[] = [];
  const itens: ItemPlano[] = [];
  const ignorados = new Map<string, number>();

  for (const b of alvo) {
    const doArquivo = perfil.porArquivo[b.sourceName];
    if (!doArquivo?.w || !doArquivo?.h) {
      ignorados.set(b.sourceName, (ignorados.get(b.sourceName) ?? 0) + 1);
      continue;
    }
    const orientacao: "retrato" | "paisagem" = doArquivo.h >= doArquivo.w ? "retrato" : "paisagem";
    const resolvido = resolverPerfil(perfil, override, b.sourceName, orientacao);

    const geom: EntradaGeom = {
      W: info.width,
      H: info.height,
      brollTopoFrac,
      w: doArquivo.w,
      h: doArquivo.h,
      ancoraY: resolvido.ancoraY,
      assunto: resolvido.assunto,
      cropTopoExtra: resolvido.cropTopoExtra,
    };
    itens.push({
      sourceName: b.sourceName,
      startSeconds: b.startSeconds,
      endSeconds: b.endSeconds,
      videoTrackIndex: b.videoTrackIndex,
      orientacao,
      perfilOrigem: resolvido.origem,
      enquadramento: calcularEnquadramento(geom),
      geom,
    });
  }

  linhas.push(`${info.name} — ${info.width}x${info.height}`);
  linhas.push(`${alvo.length} clipes acima da V1${opcoes.faixa === null ? "" : ` (so a V${opcoes.faixa + 1})`}`);
  linhas.push(`${itens.length} sao B-roll da biblioteca — so nesses eu mexo.`);
  if (ignorados.size > 0) {
    linhas.push(`${[...ignorados.values()].reduce((a, b) => a + b, 0)} intocados (fora da biblioteca):`);
    for (const [nome, n] of ignorados) linhas.push(`   ${nome}${n > 1 ? ` x${n}` : ""}`);
  }
  if (itens.length === 0) linhas.push("Nada a fazer.");

  return { W: info.width, H: info.height, itens, linhas };
}

// ------------------------------------------------------- achar coisas na timeline

async function itensDaFaixa(sequence: unknown, videoTrackIndex: number): Promise<TrackItemLike[]> {
  const faixa = await (sequence as SeqFaixas).getVideoTrack(videoTrackIndex);
  if (!faixa) throw new Error(`V${videoTrackIndex + 1} nao existe nesta sequencia.`);
  return faixa.getTrackItems(CLIP, false);
}

async function nomeDe(it: TrackItemLike): Promise<string | undefined> {
  return it.name ?? (await it.getProjectItem?.())?.name;
}

/** O clipe certo: mesmo nome de origem E comecando no tempo planejado. */
async function acharItem(
  itens: readonly TrackItemLike[],
  sourceName: string,
  startSeconds: number,
): Promise<TrackItemLike | null> {
  for (const it of itens) {
    if ((await nomeDe(it)) !== sourceName) continue;
    if (Math.abs((await it.getStartTime()).seconds - startSeconds) < 0.5) return it;
  }
  return null;
}

async function acharComponente(chain: ChainLike, match: string): Promise<ComponentLike | null> {
  for (let i = 0; i < chain.getComponentCount(); i++) {
    const c = chain.getComponentAtIndex(i);
    if ((await c.getMatchName()) === match) return c;
  }
  return null;
}

async function acharParam(comp: ComponentLike, nome: string): Promise<ParamLike | null> {
  for (let p = 0; p < comp.getParamCount(); p++) {
    const par = comp.getParam(p);
    if (par.displayName === nome) return par;
  }
  return null;
}

/**
 * Position do Motion, em PointF NORMALIZADO (0..1), nao em pixels.
 *
 * Duas armadilhas, as duas pagas com uma rodada errada cada:
 *
 * 1. Array nao serve: `createKeyframe([x,y])` devolve "Illegal Parameter type".
 *    Tem de ser PointF.
 * 2. **O valor e fracao do quadro, nao pixel.** Mandando 540 e 1494 o Premiere
 *    gravou `32767,32767` — 0x7FFF, teto de inteiro de 16 bits com sinal. As
 *    DUAS coordenadas grampearam no mesmo maximo, que e a assinatura de valor
 *    fora de faixa, nao de objeto mal construido. O painel mostra pixel, a API
 *    quer fracao. `Scale` nao sofre disso: e porcentagem 1:1.
 *
 * A geometria em `autosplit.ts` continua em pixels (que e o que da pra testar e
 * o que o usuario ve na tela); a conversao mora aqui, junto da armadilha.
 */
function posicaoNormalizada(posX: number, posY: number, W: number, H: number): { ponto: unknown; leu: string } {
  const P = (ppro as { PointF: new (x?: number, y?: number) => { x: number; y: number } }).PointF;
  const x = posX / W;
  const y = posY / H;
  const p = new P(x, y);
  p.x = x;
  p.y = y;
  return { ponto: p, leu: `${p.x.toFixed(4)},${p.y.toFixed(4)}` };
}

/**
 * Valor atual de um param.
 *
 * O objeto que `getStartValue()` devolve e nativo do UXP: `Object.keys` vem
 * VAZIO e `JSON.stringify` da "{}" (conferido no diagnostico). As propriedades
 * vivem no prototipo, entao o acesso tem de ser direto pelo caminho tipado
 * (`Keyframe.value.value`), nunca por enumeracao. `getValueAtTime` e a rede.
 */
async function lerParam(par: ParamLike): Promise<unknown> {
  try {
    const kf = (await par.getStartValue?.()) as { value?: { value?: unknown } } | undefined;
    const v = kf?.value;
    if (v && typeof v === "object" && "value" in v) return (v as { value: unknown }).value;
    if (v !== undefined) return v;
  } catch {
    // cai pro getValueAtTime
  }
  try {
    return await par.getValueAtTime?.(await ppro.TickTime.createWithSeconds(0));
  } catch {
    return undefined;
  }
}

function numeroDe(v: unknown): number {
  const n = Number(typeof v === "object" && v !== null ? (v as { value?: unknown }).value : v);
  return Number.isFinite(n) ? n : NaN;
}

/** y de um Position, que volta como PointF (x/y no prototipo). */
function yDe(v: unknown): number {
  if (Array.isArray(v)) return Number(v[1]);
  const n = Number((v as { y?: unknown } | null)?.y);
  return Number.isFinite(n) ? n : NaN;
}

// ------------------------------------------------------- aplicar

export interface ResultadoSplit {
  readonly ok: boolean;
  readonly linhas: readonly string[];
}

/**
 * Poe cada B-roll na caixa de baixo (escala + posicao do Motion) e aplica o
 * Rounded Crop com o Top calculado pelo perfil.
 *
 * Duas transacoes de proposito: os params de um componente so existem depois de
 * ele estar na chain. Um Ctrl+Z desfaz cada uma.
 */
export async function aplicarSplit(opcoes: OpcoesSplit): Promise<ResultadoSplit> {
  const plano = await montarPlano(opcoes);
  const linhas = [...plano.linhas];
  if (plano.itens.length === 0) {
    await writeJson("ultimo-log-autosplit.json", { quando: Date.now(), linhas });
    return { ok: true, linhas };
  }

  const { project, sequence } = await ativa();
  const aplicado: Record<string, unknown> = {};
  let ok = true;

  // --- transacao 1: Motion (escala + posicao) e anexar o efeito
  const acoes1: Array<() => unknown> = [];
  const paraSetar: Array<{ sourceName: string; videoTrackIndex: number; startSeconds: number; topoPct: number }> = [];
  const conferidos: string[] = [];
  let jaTinham = 0;
  let posicionados = 0;

  for (const it of plano.itens) {
    const item = await acharItem(await itensDaFaixa(sequence, it.videoTrackIndex), it.sourceName, it.startSeconds);
    if (!item) {
      linhas.push(`${it.sourceName}: nao achei na timeline, pulado`);
      ok = false;
      continue;
    }
    const chain = await item.getComponentChain();
    const motion = await acharComponente(chain, MATCH_MOTION);
    const escala = motion ? await acharParam(motion, "Scale") : null;
    const pos = motion ? await acharParam(motion, "Position") : null;
    if (!escala || !pos) {
      linhas.push(`${it.sourceName}: sem Scale/Position no Motion, pulado`);
      ok = false;
      continue;
    }

    const e = it.enquadramento;
    acoes1.push(() => escala.createSetValueAction(escala.createKeyframe(e.escalaPct), true));
    acoes1.push(() => {
      const { ponto, leu } = posicaoNormalizada(e.posX, e.posY, plano.W, plano.H);
      if (conferidos.length < 2) {
        conferidos.push(`${it.sourceName}: pedi ${e.posX},${Math.round(e.posY)} px = ${leu} normalizado`);
      }
      return pos.createSetValueAction(pos.createKeyframe(ponto), true);
    });

    const existente = await acharComponente(chain, MATCH_EFEITO);
    if (existente && !opcoes.refazer) {
      jaTinham++;
    } else {
      if (existente) acoes1.push(() => chain.createRemoveComponentAction(existente));
      const comp = await ppro.VideoFilterFactory.createComponent(MATCH_EFEITO);
      acoes1.push(() => chain.createAppendComponentAction(comp));
      paraSetar.push({
        sourceName: it.sourceName,
        videoTrackIndex: it.videoTrackIndex,
        startSeconds: it.startSeconds,
        topoPct: e.cropTopoPct,
      });
    }

    // Chave com o tempo: o mesmo arquivo aparece varias vezes na timeline, e
    // so o nome faria as ocorrencias se sobrescreverem (na primeira rodada, 28
    // clipes viraram 11 registros). O "Aprender" le isto clipe a clipe.
    aplicado[`${it.sourceName}@${it.startSeconds.toFixed(3)}`] = {
      sourceName: it.sourceName,
      startSeconds: it.startSeconds,
      videoTrackIndex: it.videoTrackIndex,
      geom: it.geom,
      usado: e,
    };
    posicionados++;
  }

  if (acoes1.length === 0) {
    linhas.push("Nada aplicavel.");
    await writeJson("ultimo-log-autosplit.json", { quando: Date.now(), linhas });
    return { ok: false, linhas };
  }

  comTransacao(project as never, `Auto Split: ${posicionados} B-rolls`, (add) => {
    for (const a of acoes1) add(a());
  });
  linhas.push(`${posicionados} B-rolls posicionados na caixa de baixo.`);
  for (const c of conferidos) linhas.push(`   ${c}`);
  if (jaTinham > 0) linhas.push(`${jaTinham} ja tinham o Rounded Crop (pulados; marque "Refazer do zero" pra refazer).`);

  // --- transacao 2: setar Top/Feather/Roundness dos efeitos recem-anexados
  if (paraSetar.length > 0) {
    const h2 = await ativa();
    const acoes2: Array<() => unknown> = [];
    for (const alvo of paraSetar) {
      const item = await acharItem(
        await itensDaFaixa(h2.sequence, alvo.videoTrackIndex),
        alvo.sourceName,
        alvo.startSeconds,
      );
      const comp = item ? await acharComponente(await item.getComponentChain(), MATCH_EFEITO) : null;
      if (!comp) {
        linhas.push(`${alvo.sourceName}: efeito sumiu antes de setar`);
        ok = false;
        continue;
      }
      for (const [nome, valor] of [
        [PARAM_TOPO, alvo.topoPct],
        [PARAM_FEATHER, FEATHER_PCT],
        [PARAM_ROUNDNESS, ROUNDNESS_PCT],
      ] as const) {
        const par = await acharParam(comp, nome);
        if (par) acoes2.push(() => par.createSetValueAction(par.createKeyframe(valor), true));
        else linhas.push(`${alvo.sourceName}: param "${nome}" nao encontrado no efeito`);
      }
    }
    if (acoes2.length > 0) {
      comTransacao(h2.project as never, "Auto Split: corte de topo e feather", (add) => {
        for (const a of acoes2) add(a());
      });
      linhas.push(`${paraSetar.length} Rounded Crop aplicados (Top por clipe, feather ${FEATHER_PCT}%).`);
    }

    // Conferir o que REALMENTE ficou na timeline, nao o que eu mandei fazer.
    // O PointF ensinou caro: "nao lancou excecao" nao e prova de nada. Uma
    // amostra basta pra ver escala de valor errada (23 vs 0.23) ou set que nao
    // pegou.
    const amostra = paraSetar[0];
    if (amostra) {
      const h3 = await ativa();
      const item = await acharItem(
        await itensDaFaixa(h3.sequence, amostra.videoTrackIndex),
        amostra.sourceName,
        amostra.startSeconds,
      );
      if (item) {
        const chain = await item.getComponentChain();
        const motion = await acharComponente(chain, MATCH_MOTION);
        const efeito = await acharComponente(chain, MATCH_EFEITO);
        const conf: string[] = [];
        if (motion) {
          const sc = await acharParam(motion, "Scale");
          const po = await acharParam(motion, "Position");
          if (sc) conf.push(`Scale=${JSON.stringify(await lerParam(sc))}`);
          if (po) {
            const v = await lerParam(po);
            const yn = yDe(v);
            // Normalizado na API; em pixel e o que o painel do Premiere mostra.
            conf.push(`Position y=${yn} normalizado = ${Math.round(yn * plano.H)} px`);
          }
        }
        if (efeito) {
          for (const nome of [PARAM_TOPO, PARAM_FEATHER, PARAM_ROUNDNESS]) {
            const par = await acharParam(efeito, nome);
            conf.push(`${nome}=${par ? JSON.stringify(await lerParam(par)) : "(param sumiu)"}`);
          }
        } else {
          conf.push("Rounded Crop NAO esta na chain");
        }
        linhas.push(`conferindo ${amostra.sourceName} (pedi Top=${amostra.topoPct.toFixed(1)}):`);
        for (const c of conf) linhas.push(`   ${c}`);
      }
    }
  }

  await writeJson("autosplit-aplicado.json", { quando: Date.now(), divisao: opcoes.divisao, itens: aplicado });
  await writeJson("ultimo-log-autosplit.json", { quando: Date.now(), linhas });
  return { ok, linhas };
}

// ------------------------------------------------------- diagnostico do efeito

/**
 * Sonda unica: descobre o matchName do efeito de canto arredondado, se da pra
 * criar/anexar por codigo, se os params (Top/Feather/Roundness) sao setaveis, e
 * se o Position 2D do Motion aceita createKeyframe([x, y]). Le tambem de volta
 * o Scale que ja existe, pra saber o formato de leitura de valor. Grava tudo
 * em diag-autosplit.json e pede pra desfazer no Premiere.
 */
export async function diagnostico(): Promise<string[]> {
  const linhas: string[] = [];
  const saida: Record<string, unknown> = {};

  const nomes: string[] = await ppro.VideoFilterFactory.getDisplayNames();
  const matchNames: string[] = await ppro.VideoFilterFactory.getMatchNames();
  saida.displayNames = nomes;
  saida.matchNames = matchNames;
  linhas.push(`${nomes.length} efeitos de video disponiveis`);

  const idx = nomes.findIndex((n) => /cantos?\s+arredondad|rounded/i.test(n));
  const candidato = idx >= 0 ? { display: nomes[idx], match: matchNames[idx] } : null;
  saida.candidato = candidato;
  linhas.push(
    candidato ? `candidato: "${candidato.display}" (${candidato.match})` : "nenhum candidato obvio — ver a lista no JSON",
  );

  const plano = await montarPlano({ faixa: null, divisao: 50, subirDoutor: false, refazer: false });
  if (plano.itens.length === 0) {
    linhas.push("sem B-roll acima da V1 — nao deu pra testar Motion/efeito no clipe");
    await writeJson("diag-autosplit.json", saida);
    return linhas;
  }

  const alvo = plano.itens[0]!;
  const { project, sequence } = await ativa();
  const faixa = await (sequence as SeqFaixas).getVideoTrack(alvo.videoTrackIndex);
  const itens = await faixa.getTrackItems(CLIP, false);
  let item: TrackItemLike | undefined;
  for (const it of itens) {
    const nome = it.name ?? (await it.getProjectItem?.())?.name;
    if (nome === alvo.sourceName) {
      item = it;
      break;
    }
  }
  if (!item) {
    linhas.push(`nao achei "${alvo.sourceName}" na V${alvo.videoTrackIndex + 1}`);
    await writeJson("diag-autosplit.json", saida);
    return linhas;
  }

  const chain = await item.getComponentChain();
  const acharComp = async (match: string): Promise<ComponentLike | null> => {
    for (let i = 0; i < chain.getComponentCount(); i++) {
      const c = chain.getComponentAtIndex(i);
      if ((await c.getMatchName()) === match) return c;
    }
    return null;
  };
  const acharParam = async (comp: ComponentLike, nome: string): Promise<ParamLike | null> => {
    for (let p = 0; p < comp.getParamCount(); p++) {
      const par = comp.getParam(p);
      if (par.displayName === nome) return par;
    }
    return null;
  };

  const motion = await acharComp(MATCH_MOTION);
  saida.motionParams = motion
    ? Array.from({ length: motion.getParamCount() }, (_, i) => motion.getParam(i).displayName)
    : "Motion nao encontrado";

  const escala = motion ? await acharParam(motion, "Scale") : null;
  const pos = motion ? await acharParam(motion, "Position") : null;

  // --- leitura de valor: getStartValue() e o caminho tipado
  for (const [rot, par] of [["Scale", escala], ["Position", pos]] as const) {
    try {
      if (!par?.getStartValue) { saida[`ler${rot}`] = "getStartValue ausente"; continue; }
      const kf = await par.getStartValue();
      saida[`ler${rot}`] = { tipo: typeof kf, json: JSON.stringify(kf), chaves: kf ? Object.keys(kf as object) : null };
    } catch (e) {
      saida[`ler${rot}`] = `erro: ${(e as Error).message}`;
    }
  }

  // --- setar Position: array falha; testar PointF (new e chamada direta)
  const P = (ppro as { PointF?: (new (x: number, y: number) => unknown) & ((x: number, y: number) => unknown) }).PointF;
  const px = alvo.enquadramento.posX;
  const py = alvo.enquadramento.posY;
  const tentativasPos: Array<[string, () => unknown]> = [
    ["array", () => [px, py]],
    ["new PointF", () => (P ? new P(px, py) : null)],
    ["PointF()", () => (P ? P(px, py) : null)],
  ];
  if (pos) {
    for (const [rot, fazValor] of tentativasPos) {
      try {
        const valor = fazValor();
        if (valor === null) { saida[`pos_${rot}`] = "ppro.PointF ausente"; continue; }
        comTransacao(project as never, `diag: Position ${rot}`, (add) => {
          add(pos.createSetValueAction(pos.createKeyframe(valor), true));
        });
        saida[`pos_${rot}`] = "ok";
        linhas.push(`Position via ${rot}: ok`);
      } catch (e) {
        saida[`pos_${rot}`] = `erro: ${(e as Error).message}`;
      }
    }
  } else {
    saida.pos_geral = "param Position nao encontrado no Motion";
  }

  if (candidato) {
    try {
      const comp = await ppro.VideoFilterFactory.createComponent(candidato.match);
      saida.createComponent = "ok";
      comTransacao(project as never, "diag: anexar efeito", (add) => {
        add(chain.createAppendComponentAction(comp));
      });
      saida.append = "ok";
      const recarregado = await acharComp(candidato.match!);
      const params: string[] = [];
      if (recarregado) {
        for (let p = 0; p < recarregado.getParamCount(); p++) params.push(recarregado.getParam(p).displayName);
      }
      saida.paramsDoEfeito = params;
      linhas.push(`efeito anexado — params: ${params.join(", ")}`);
      for (const nome of ["Top", "Feather", "Roundness"]) {
        const par = recarregado ? await acharParam(recarregado, nome) : null;
        try {
          if (par) {
            comTransacao(project as never, `diag: set ${nome}`, (add) => {
              add(par.createSetValueAction(par.createKeyframe(nome === "Top" ? 20 : nome === "Feather" ? 5 : 0), true));
            });
            saida[`set${nome}`] = "ok";
          } else {
            saida[`set${nome}`] = "param nao encontrado";
          }
        } catch (e) {
          saida[`set${nome}`] = `erro: ${(e as Error).message}`;
        }
      }
    } catch (e) {
      saida.efeitoErro = `${(e as Error).message}`;
      linhas.push(`efeito: FALHOU — ${(e as Error).message}`);
    }
  }

  await writeJson("diag-autosplit.json", saida);
  linhas.push("");
  linhas.push("Desfaca no Premiere (Ctrl+Z) ate a timeline voltar ao que era.");
  linhas.push("Me mande o diag-autosplit.json (PluginData do Pro Edition).");
  return linhas;
}
