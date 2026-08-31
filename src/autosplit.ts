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
