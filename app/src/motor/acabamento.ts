/*
 * Acabamento: a ponta que le disco. A regra mora em src/acabamento.ts.
 */

import { readFile, writeFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";

import { empresaDe } from "../../../ferramentas/pro-captions/src/preset.ts";
import perfilBruto from "../../../src/autosplit-perfil.json" with { type: "json" };
import { SPLIT_DA_EMPRESA, type OverridePerfil, type Perfil } from "../../../src/autosplit.ts";
import { acabar, variacoes } from "../acabamento.ts";
import { lerSequenciaXml } from "../xml-ler.ts";
import { sequenciaParaXml, type Midia } from "../xml.ts";
import { jsonDe, pastaDoPainel } from "./broll.ts";
import type { Config } from "./config.ts";
import { sondar } from "./midia.ts";

export interface EntradaAcabamento {
  readonly nome: string;
  readonly variacoes: number;
  readonly brolls: number;
  readonly trilha: string | null;
  readonly volumeTrilhaDb: number;
  /** Linha do split da empresa escolhida no Editar do painel. */
  readonly divisao: number;
  readonly avisos: string[];
}

/** Split da empresa escolhida no Editar do painel (`perfil.json`); sem painel, AndroClinic. */
async function splitDoPainel(): Promise<(typeof SPLIT_DA_EMPRESA)[keyof typeof SPLIT_DA_EMPRESA]> {
  return SPLIT_DA_EMPRESA[empresaDe(await jsonDe(await pastaDoPainel(), "perfil.json"))];
}

export interface OpcoesAcabamentoTela {
  readonly split: boolean;
  readonly divisao: number;
  /** null = sem trilha. */
  readonly trilha: string | null;
  readonly volumeTrilhaDb: number;
}

export interface ResultadoAcabamentoSalvo {
  readonly variacoes: number;
  readonly aparados: number;
  readonly enquadrados: number;
  readonly subidos: number;
  readonly salvos: string[];
  readonly avisos: string[];
}

// Ganho de clipe da trilha nas 20 variacoes do Andro 19.09 (29/09).
const VOLUME_PADRAO_DB = -18;

export async function abrirParaAcabamento(caminho: string, cfg: Config): Promise<EntradaAcabamento> {
  const { avisos, ...s } = lerSequenciaXml(await readFile(caminho, "utf8"));
  const pref = await cfg.preferencias();
  return {
    nome: s.nome,
    variacoes: variacoes(s.video[0] ?? [], s.fps).length,
    brolls: (s.video[1] ?? []).length,
    trilha: pref.trilha ?? null,
    volumeTrilhaDb: pref.volumeTrilhaDb ?? VOLUME_PADRAO_DB,
    divisao: (await splitDoPainel()).divisao,
    avisos,
  };
}

export async function rodarAcabamento(caminho: string, opcoes: OpcoesAcabamentoTela, cfg: Config): Promise<ResultadoAcabamentoSalvo> {
  const { avisos, ...entrada } = lerSequenciaXml(await readFile(caminho, "utf8"));

  let trilha: { midia: Midia; ganhoDb: number } | undefined;
  if (opcoes.trilha !== null) {
    const i = await sondar(opcoes.trilha);
    trilha = {
      midia: { caminho: opcoes.trilha, duracaoQ: Math.floor(i.duracaoS * entrada.fps), canais: i.canais },
      ganhoDb: opcoes.volumeTrilhaDb,
    };
    await cfg.salvarPreferencias({ trilha: opcoes.trilha, volumeTrilhaDb: opcoes.volumeTrilhaDb });
  }

  const override = ((await jsonDe(await pastaDoPainel(), "autosplit-perfil-override.json")) ?? {}) as OverridePerfil;
  const { lado, feather } = await splitDoPainel();
  const perfil = perfilBruto as unknown as Perfil;
  const r = acabar(entrada, {
    ...(opcoes.split ? { split: { divisao: opcoes.divisao, perfil, override, lado, feather } } : {}),
    ...(trilha !== undefined ? { trilha } : {}),
  });

  const saida = join(dirname(caminho), `${entrada.nome} - final.xml`);
  await writeFile(saida, sequenciaParaXml(r.sequencia), "utf8");
  return {
    variacoes: r.variacoes,
    aparados: r.aparados,
    enquadrados: r.enquadrados,
    subidos: r.subidos,
    salvos: [saida],
    avisos: [...avisos, ...r.avisos, ...(trilha ? [`Trilha: ${basename(trilha.midia.caminho)} a ${opcoes.volumeTrilhaDb} dB`] : [])],
  };
}
