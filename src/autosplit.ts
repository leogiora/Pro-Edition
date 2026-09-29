/*
 * Auto Split — logica pura. Sem DOM, sem Premiere, roda no node --test.
 *
 * A geometria da caixa meio a meio, a resolucao do perfil de enquadramento e
 * o back-solve do "Aprender" moram aqui. O que toca o Premiere esta em
 * autosplit-premiere.ts.
 */

import type { Empresa } from "../ferramentas/pro-captions/src/preset.ts";

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
 * folga de cabeca um close pede), entao
 * estes numeros sao botoes de ajuste — mexer aqui, nao espalhar magic numbers
 * pela conta.
 * ponytail: ajuste fino do mundo real; medir num video de verdade e afinar.
 */
export const FOLGA: Readonly<Record<Assunto, number>> = {
  rosto: 0.18, pessoa: 0.12, dupla: 0.10, aberto: 0.05,
};
export const CROP_TOPO_MAX = 0.60;
export const SUBJ_IN_BOX = 0.40;
/*
 * Medido nos 70 B-rolls das variacoes 1-6 do Andro 19.09 (perfil AndroClinic
 * Ads, 29/09): Feather 7 e Roundness 0 em todos; escala = preencher a largura,
 * sem sobra (67 de 70); borda de cima do B-roll na mediana de 1119 px = 58%.
 * Com a caixa em 58%, a borda do codigo fica a 21 px da dele (mediana); em 50%,
 * a 159 px.
 */
export const FEATHER_PCT = 7;
export const ROUNDNESS_PCT = 0;
export const DIVISAO_PADRAO = 58;

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
  /** So no broll de cima: o corte e embaixo (Bottom do Rounded Crop). */
  readonly cropBasePct?: number;
}

/** "58" no campo -> 0.58; fora de 40..60 e clampado. */
export function fracaoDivisao(valorCampo: number): number {
  const f = (Number.isFinite(valorCampo) ? valorCampo : DIVISAO_PADRAO) / 100;
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

  const s = Math.max(Wbox / e.w, Hbox / hVis);

  const posX = e.W / 2;
  let posY =
    yBox + SUBJ_IN_BOX * Hbox
    - (cropTopo - 0.5) * e.h * s
    - aVis * hVis * s;

  const posYMin = e.H - 0.5 * e.h * s;                 // fundo coberto
  const posYMax = yBox - (cropTopo - 0.5) * e.h * s;   // topo visivel nao passa de yBox
  posY = posYMin <= posYMax ? clamp(posY, posYMin, posYMax) : posYMin;

  return { escalaPct: s * 100, posX, posY, cropTopoPct: cropTopo * 100 };
}

// ------------------------------------------------------- lado do split

export type LadoSplit = "baixo" | "cima";

/**
 * O Pexels grava o tamanho no nome ("10222557-uhd_2160_4096_25fps.mp4"), e a
 * pasta de B-roll da Menopausa e quase toda assim. Sem isso o Auto Split pula
 * o clipe, porque o UXP nao da o tamanho do quadro.
 */
export function tamanhoNoNome(nome: string): { w: number; h: number } | undefined {
  const m = /(\d{3,4})_(\d{3,4})_\d+fps/.exec(nome);
  return m ? { w: Number(m[1]), h: Number(m[2]) } : undefined;
}

/**
 * Split de cada empresa, medido nos projetos dela (29/09). AndroClinic: os 70
 * B-rolls das variacoes 1-6 do Andro 19.09. Menopausa: criativos 07.09, 17.09,
 * 18.09 e 28.09, B-roll EM CIMA com a borda de baixo em 37-52% da altura
 * (mediana 45%) e Feather de 3 a 11 (mediana 5). GrandCare nao medida: o
 * PERFIS diz que e igual a AndroClinic.
 */
export const SPLIT_DA_EMPRESA: Readonly<Record<Empresa, { lado: LadoSplit; divisao: number; feather: number }>> = {
  androclinic: { lado: "baixo", divisao: DIVISAO_PADRAO, feather: FEATHER_PCT },
  grandcare: { lado: "baixo", divisao: DIVISAO_PADRAO, feather: FEATHER_PCT },
  menopausa: { lado: "cima", divisao: 45, feather: 5 },
};

/**
 * Quanto o B-roll de cima passa da altura da caixa. Na Menopausa o 1920x1080
 * entra a 64% numa caixa de 576 px (1,2x); os outros criativos dao 1,1 a 1,4.
 * ponytail: media de 4 criativos, afinar se o Leo mexer muito na escala.
 */
export const SOBRA_EM_CIMA = 1.2;

/**
 * B-roll na caixa de cima (Menopausa). Nao e a conta de baixo de ponta-cabeca:
 * la o Leo enquadra pelo assunto; aqui ele cobre a caixa com o clipe inteiro,
 * um pouco maior que ela, centrado, e corta embaixo o que passa da borda.
 * `fimFrac` e onde a caixa termina (a borda de baixo do B-roll).
 */
export function enquadrarEmCima(W: number, H: number, w: number, h: number, fimFrac: number): Enquadramento {
  const caixa = H * fimFrac;
  const s = Math.max(W / w, (SOBRA_EM_CIMA * caixa) / h);
  const posY = caixa / 2;
  const sobraEmbaixo = Math.max(0, posY + (h * s) / 2 - caixa);
  return { escalaPct: s * 100, posX: W / 2, posY, cropTopoPct: 0, cropBasePct: (sobraEmbaixo / (h * s)) * 100 };
}

/**
 * Quanto a pessoa entra por baixo da borda do B-roll: 4% na bruta deitada do
 * Andro 19.09, 4 a 10% nos criativos da Menopausa.
 */
export const SOBREPOSICAO_PESSOA = 0.06;

/**
 * Pessoa por baixo do B-roll de cima: desce ate a borda de cima dela ficar
 * SOBREPOSICAO_PESSOA acima da borda do B-roll. Descer so corta o tronco (a
 * cabeca fica no alto do quadro dela); nunca sobe. Menopausa 28.09: 1139 contra
 * 1159 do Leo; 17.09: 1722 contra 1691.
 */
export function descerPessoaPosY(e: EntradaDoutor & { readonly fimFrac: number }): number {
  return Math.max(e.H / 2, e.H * (e.fimFrac - SOBREPOSICAO_PESSOA) + (e.hDoc * e.escalaDocPct) / 200);
}

// -------------------------------------------- doutor e back-solve do aprender

export const DOCTOR_UP = 0.85;
export const PASSO_APRENDER = 0.30;

export interface EntradaDoutor {
  readonly H: number;
  readonly hDoc: number;
  readonly escalaDocPct: number;
}

/**
 * Novo Position.y do doutor. Sobe (y menor) por DOCTOR_UP, mas nunca alem de
 * meia altura da midia ja escalada — passar disso abre tarja preta no topo.
 * O chamador ja garantiu: checkbox ligado, origem retrato, clipe coberto.
 */
export function nudgeDoutorPosY(e: EntradaDoutor): number {
  const meiaAltura = 0.5 * e.hDoc * (e.escalaDocPct / 100);
  return Math.min((e.H / 2) * DOCTOR_UP, meiaAltura);
}

export interface EntradaAprender {
  readonly guardado: Pick<PerfilEntrada, "assunto" | "ancoraY" | "cropTopoExtra">;
  readonly geomUsada: EntradaGeom;
  readonly usado: Enquadramento;
  readonly finalPosY: number;
  readonly finalEscalaPct: number;
  readonly finalCropTopoPct: number;
  readonly passo?: number;
}

export interface Aprendido {
  readonly ancoraY: number;
  readonly cropTopoExtra: number;
  readonly mudou: boolean;
}

/**
 * Inverte a geometria a partir do que o usuario deixou na timeline (Position.y,
 * Scale, Top do efeito) e move o valor guardado nessa direcao por, no maximo,
 * um passo. Duas observacoes (posY, Top), duas incognitas (ancoraY,
 * cropTopoExtra).
 *
 * ponytail: quando `usado.posY` saiu clampado (o pedido de enquadramento nao
 * cabia sem abrir tarja), a inversao trabalha a partir do valor clampado; o
 * primeiro "Aprender" desse clipe pode dar um pulo ate o teto do passo. Se
 * incomodar, aprender pelo delta em vez do absoluto.
 */
export function aprenderEnquadramento(e: EntradaAprender): Aprendido {
  const passo = e.passo ?? PASSO_APRENDER;
  const eps = 0.5; // px / pontos percentuais: abaixo disso e "nao mexeu"

  const mexeu =
    Math.abs(e.finalPosY - e.usado.posY) > eps ||
    Math.abs(e.finalCropTopoPct - e.usado.cropTopoPct) > eps ||
    Math.abs(e.finalEscalaPct - e.usado.escalaPct) > eps;

  if (!mexeu) {
    return { ancoraY: e.guardado.ancoraY, cropTopoExtra: e.guardado.cropTopoExtra, mudou: false };
  }

  const g = e.geomUsada;
  const yBox = g.H * g.brollTopoFrac;
  const Hbox = g.H - yBox;
  const folga = FOLGA[e.guardado.assunto];

  const cropTopoF = clamp(e.finalCropTopoPct / 100, 0, CROP_TOPO_MAX);
  const hVisF = g.h * (1 - cropTopoF);
  const sF = e.finalEscalaPct / 100;

  // inverte posY = yBox + SUBJ_IN_BOX*Hbox - (cropTopoF-0.5)*h*sF - aVisF*hVisF*sF
  const aVisF =
    (yBox + SUBJ_IN_BOX * Hbox - (cropTopoF - 0.5) * g.h * sF - e.finalPosY) / (hVisF * sF);
  const ancoraYF = clamp(cropTopoF + aVisF * (1 - cropTopoF), 0, 1);
  const cropTopoExtraF = clamp(cropTopoF - ancoraYF + folga, 0, CROP_TOPO_MAX);

  const passoLimitado = (alvo: number, base: number): number =>
    base + clamp(alvo - base, -passo, passo);

  const ancoraY = clamp(passoLimitado(ancoraYF, e.guardado.ancoraY), 0, 1);
  const cropTopoExtra = clamp(passoLimitado(cropTopoExtraF, e.guardado.cropTopoExtra), 0, CROP_TOPO_MAX);

  const mudou =
    Math.abs(ancoraY - e.guardado.ancoraY) > 1e-6 ||
    Math.abs(cropTopoExtra - e.guardado.cropTopoExtra) > 1e-6;

  return { ancoraY, cropTopoExtra, mudou };
}
