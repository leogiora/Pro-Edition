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
} from "../../auto-broll-premiere/src/premiere.ts";
import {
  calcularEnquadramento,
  fracaoDivisao,
  resolverPerfil,
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
 * Le os B-rolls acima da V1, resolve o perfil de cada um e calcula o
 * enquadramento. Nao toca a timeline. `w`/`h` vem do perfil; sem perfil,
 * assume retrato e loga (a biblioteca inteira tem perfil; isso e so o B-roll
 * de fora dela).
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
  let semPerfil = 0;

  for (const b of alvo) {
    const doArquivo = perfil.porArquivo[b.sourceName];
    const w = doArquivo?.w;
    const h = doArquivo?.h;
    const orientacao: "retrato" | "paisagem" = w && h ? (h >= w ? "retrato" : "paisagem") : "retrato";

    const resolvido = resolverPerfil(perfil, override, b.sourceName, orientacao);
    if (resolvido.origem === "default") semPerfil++;

    const geom: EntradaGeom = {
      W: info.width,
      H: info.height,
      brollTopoFrac,
      w: w ?? 1080,
      h: h ?? 1920,
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
  linhas.push(`${itens.length} B-rolls ${opcoes.faixa === null ? "acima da V1" : `na V${opcoes.faixa + 1}`}`);
  if (semPerfil > 0) linhas.push(`${semPerfil} sem perfil (padrao por orientacao)`);
  if (itens.length === 0) linhas.push("Nada a fazer.");

  return { W: info.width, H: info.height, itens, linhas };
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
