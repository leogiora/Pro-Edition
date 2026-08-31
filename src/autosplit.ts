/*
 * Auto Split — logica pura. Sem DOM, sem Premiere, roda no node --test.
 *
 * A geometria da caixa meio a meio, a resolucao do perfil de enquadramento e
 * o back-solve do "Aprender" moram aqui. O que toca o Premiere esta em
 * autosplit-premiere.ts.
 */

export type Assunto = "rosto" | "pessoa" | "dupla" | "aberto";
export type Orientacao = "retrato" | "paisagem";

export interface PerfilEntrada {
  readonly assunto: Assunto;
  readonly ancoraY: number;
  readonly cropTopoExtra: number;
  readonly w?: number;
  readonly h?: number;
  readonly nota?: string;
}

export interface Perfil {
  readonly versao: number;
  readonly padraoPorConceito: Readonly<Record<string, PerfilEntrada>>;
  readonly porArquivo: Readonly<Record<string, PerfilEntrada>>;
}

export type OverridePerfil = Readonly<Record<string, { ancoraY: number; cropTopoExtra: number }>>;

export interface PerfilResolvido {
  readonly assunto: Assunto;
  readonly ancoraY: number;
  readonly cropTopoExtra: number;
  readonly origem: "override" | "arquivo" | "conceito" | "default";
}

/** "Consulta médica (1).mp4" -> "Consulta médica". Sem sufixo -> tira so a extensao. */
export function conceito(nomeArquivo: string): string {
  return nomeArquivo.replace(/\.[^.]+$/, "").replace(/\s*\(\d+\)\s*$/, "").trim();
}

const DEFAULT_RETRATO: PerfilEntrada = { assunto: "pessoa", ancoraY: 0.35, cropTopoExtra: 0 };
const DEFAULT_PAISAGEM: PerfilEntrada = { assunto: "pessoa", ancoraY: 0.45, cropTopoExtra: 0 };

export function resolverPerfil(
  perfil: Perfil,
  override: OverridePerfil,
  nomeArquivo: string,
  orientacao: Orientacao,
): PerfilResolvido {
  const doArquivo = perfil.porArquivo[nomeArquivo];
  const doConceito = perfil.padraoPorConceito[conceito(nomeArquivo)];
  const base = doArquivo ?? doConceito ?? (orientacao === "retrato" ? DEFAULT_RETRATO : DEFAULT_PAISAGEM);
  const origem: PerfilResolvido["origem"] = doArquivo ? "arquivo" : doConceito ? "conceito" : "default";

  const ov = override[nomeArquivo];
  if (ov) {
    return { assunto: base.assunto, ancoraY: ov.ancoraY, cropTopoExtra: ov.cropTopoExtra, origem: "override" };
  }
  return { assunto: base.assunto, ancoraY: base.ancoraY, cropTopoExtra: base.cropTopoExtra, origem };
}

// ----------------------------------------------------------- geometria

/*
 * Constantes de calibracao. O modelo minimo nao ve o que so o olho ve (quanta
 * folga de cabeca um close pede, quanto de overscan o feather come), entao
 * estes numeros sao botoes de ajuste — mexer aqui, nao espalhar magic numbers
 * pela conta.
 * ponytail: ajuste fino do mundo real; medir num video de verdade e afinar.
 */
export const FOLGA: Readonly<Record<Assunto, number>> = {
  rosto: 0.18, pessoa: 0.12, dupla: 0.10, aberto: 0.05,
};
export const CROP_TOPO_MAX = 0.60;
export const OVERSCAN = 1.03;
export const SUBJ_IN_BOX = 0.40;
export const FEATHER_PCT = 5;
export const ROUNDNESS_PCT = 0;

const clamp = (v: number, lo: number, hi: number): number => Math.min(Math.max(v, lo), hi);

export interface EntradaGeom {
  readonly W: number;
  readonly H: number;
  readonly brollTopoFrac: number;
  readonly w: number;
  readonly h: number;
  readonly ancoraY: number;
  readonly assunto: Assunto;
  readonly cropTopoExtra: number;
}

export interface Enquadramento {
  readonly escalaPct: number;
  readonly posX: number;
  readonly posY: number;
  readonly cropTopoPct: number;
}

/** "50" no campo -> 0.5; fora de 40..60 e clampado (o usuario tenta 50/50). */
export function fracaoDivisao(valorCampo: number): number {
  const f = Number.isFinite(valorCampo) ? valorCampo / 100 : 0.5;
  return clamp(f, 0.40, 0.60);
}

/**
 * Onde e quanto cada B-roll fica na caixa de baixo.
 *
 * O efeito de corte renderiza ANTES do Motion: `Top` deixa a faixa de cima
 * transparente sem mudar o raster w x h. Por isso a escala e a posicao contam
 * com o raster inteiro, e a parte visivel e h*(1-cropTopo).
 */
export function calcularEnquadramento(e: EntradaGeom): Enquadramento {
  const yBox = e.H * e.brollTopoFrac;
  const Wbox = e.W;
  const Hbox = e.H - yBox;

  const cropTopo = clamp(e.ancoraY - FOLGA[e.assunto] + e.cropTopoExtra, 0, CROP_TOPO_MAX);
  const hVis = e.h * (1 - cropTopo);
  const aVis = cropTopo < 1 ? (e.ancoraY - cropTopo) / (1 - cropTopo) : 0;

  const escala = Math.max(Wbox / e.w, Hbox / hVis) * OVERSCAN;
  const s = escala;

  const posX = e.W / 2;
  let posY =
    yBox + SUBJ_IN_BOX * Hbox
    - (cropTopo - 0.5) * e.h * s
    - aVis * hVis * s;

  const posYMin = e.H - 0.5 * e.h * s;                 // fundo coberto
  const posYMax = yBox - (cropTopo - 0.5) * e.h * s;   // topo visivel nao passa de yBox
  posY = posYMin <= posYMax ? clamp(posY, posYMin, posYMax) : posYMin;

  return { escalaPct: escala * 100, posX, posY, cropTopoPct: cropTopo * 100 };
}
