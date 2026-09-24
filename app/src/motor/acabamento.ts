/*
 * Acabamento: a ponta que le disco. A regra mora em src/acabamento.ts.
 */

import { readFile, writeFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";

import perfilBruto from "../../../src/autosplit-perfil.json" with { type: "json" };
import type { OverridePerfil, Perfil } from "../../../src/autosplit.ts";
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
  readonly avisos: string[];
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
  readonly salvos: string[];
  readonly avisos: string[];
}

const VOLUME_PADRAO_DB = -20;

export async function abrirParaAcabamento(caminho: string, cfg: Config): Promise<EntradaAcabamento> {
  const { avisos, ...s } = lerSequenciaXml(await readFile(caminho, "utf8"));
  const pref = await cfg.preferencias();
  return {
    nome: s.nome,
    variacoes: variacoes(s.video[0] ?? [], s.fps).length,
    brolls: (s.video[1] ?? []).length,
    trilha: pref.trilha ?? null,
    volumeTrilhaDb: pref.volumeTrilhaDb ?? VOLUME_PADRAO_DB,
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
  const r = acabar(entrada, {
    ...(opcoes.split ? { split: { divisao: opcoes.divisao, perfil: perfilBruto as unknown as Perfil, override } } : {}),
    ...(trilha !== undefined ? { trilha } : {}),
  });

  const saida = join(dirname(caminho), `${entrada.nome} - final.xml`);
  await writeFile(saida, sequenciaParaXml(r.sequencia), "utf8");
  return {
    variacoes: r.variacoes,
    aparados: r.aparados,
    enquadrados: r.enquadrados,
    salvos: [saida],
    avisos: [...avisos, ...r.avisos, ...(trilha ? [`Trilha: ${basename(trilha.midia.caminho)} a ${opcoes.volumeTrilhaDb} dB`] : [])],
  };
}
