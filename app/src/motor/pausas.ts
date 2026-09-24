/*
 * Auto Pausas: a ponta que le arquivo. A regra mora em src/pausas.ts.
 */

import { existsSync } from "node:fs";
import { readFile, writeFile } from "node:fs/promises";
import { basename, dirname, extname, join } from "node:path";

import { palavrasDoElevenLabs } from "../../../ferramentas/pro-captions/src/elevenlabs.ts";
import { nivelPorJanela } from "../../../src/wav.ts";
import { arquivosDaV1, JANELA_S, sequenciaDasBrutas, tirarPausas, type FonteAnalisada } from "../pausas.ts";
import { lerSequenciaXml } from "../xml-ler.ts";
import { sequenciaParaXml, type Sequencia } from "../xml.ts";
import type { Config } from "./config.ts";
import { legendasDasPalavras, salvarSrts, transcreverWav } from "./legendas.ts";
import { audioParaTranscrever, sondar } from "./midia.ts";

export interface EntradaPausas {
  readonly nome: string;
  readonly clipes: number;
  readonly arquivos: string[];
  readonly duracaoS: number;
  readonly avisos: string[];
}

export interface ResultadoPausasSalvo {
  readonly antesS: number;
  readonly depoisS: number;
  readonly cortes: number;
  readonly conferencia: { readonly ok: boolean; readonly linhas: string[] };
  readonly salvos: string[];
  readonly avisos: string[];
}

const nomeSemExtensao = (c: string): string => basename(c, extname(c));

/** Um .xml exportado do Premiere, ou brutas soltas (video). */
async function lerEntrada(caminhos: readonly string[]): Promise<{ sequencia: Sequencia; avisos: string[]; pasta: string }> {
  const xml = caminhos.find((c) => extname(c).toLowerCase() === ".xml");
  if (xml !== undefined) {
    const { avisos, ...sequencia } = lerSequenciaXml(await readFile(xml, "utf8"));
    return { sequencia, avisos, pasta: dirname(xml) };
  }
  const brutas = await Promise.all(
    caminhos.map(async (caminho) => {
      const i = await sondar(caminho);
      if (i.fps === null || i.largura === null || i.altura === null) throw new Error(`${basename(caminho)} não tem vídeo.`);
      return { caminho, i };
    })
  );
  const fps = Math.round(brutas[0]?.i.fps ?? 25);
  const sequencia = sequenciaDasBrutas(
    brutas.map(({ caminho, i }) => ({ caminho, duracaoQ: Math.floor(i.duracaoS * fps), largura: i.largura!, altura: i.altura!, canais: i.canais })),
    { fps, largura: 1080, altura: 1920, respiroQ: 3 * fps }
  );
  return { sequencia: { ...sequencia, nome: nomeSemExtensao(caminhos[0] ?? "Brutas") }, avisos: [], pasta: dirname(caminhos[0] ?? ".") };
}

export async function abrirParaPausas(caminhos: readonly string[]): Promise<EntradaPausas> {
  const { sequencia, avisos } = await lerEntrada(caminhos);
  const arquivos = arquivosDaV1(sequencia);
  const faltando = arquivos.filter((a) => !existsSync(a));
  if (faltando.length > 0) throw new Error(`Arquivo não encontrado: ${faltando.slice(0, 3).join(", ")}`);
  const v1 = sequencia.video[0] ?? [];
  return {
    nome: sequencia.nome,
    clipes: v1.length,
    arquivos,
    duracaoS: Math.max(0, ...v1.map((c) => c.fimQ)) / sequencia.fps,
    avisos,
  };
}

export async function rodarPausas(
  caminhos: readonly string[],
  opcoes: { readonly legendas: boolean },
  cfg: Config,
  avisar: (texto: string) => void
): Promise<ResultadoPausasSalvo> {
  const { sequencia, avisos, pasta } = await lerEntrada(caminhos);
  const arquivos = arquivosDaV1(sequencia);

  // Um arquivo por vez: o WAV de uma bruta de 8 min tem ~15 MB, e so o nivel
  // (numeros por janela) e as palavras ficam na memoria.
  const fontes = new Map<string, FonteAnalisada>();
  for (const [i, arquivo] of arquivos.entries()) {
    const quem = `${i + 1}/${arquivos.length} ${basename(arquivo)}`;
    avisar(`lendo o áudio ${quem}`);
    const wav = await audioParaTranscrever(arquivo);
    const niveis = nivelPorJanela(wav, JANELA_S * 1000).db[0] ?? [];
    const { json } = await transcreverWav(wav, cfg, (t) => avisar(`${t} ${quem}`));
    fontes.set(arquivo, { niveis, palavras: palavrasDoElevenLabs(json) ?? [] });
  }

  avisar("cortando as pausas");
  const r = tirarPausas(sequencia, fontes);
  const base = join(pasta, `${sequencia.nome} - sem pausas`);
  await writeFile(`${base}.xml`, sequenciaParaXml(r.sequencia), "utf8");
  const salvos = [`${base}.xml`];

  if (opcoes.legendas) {
    avisar("montando a legenda");
    const { blocos, problemas } = legendasDasPalavras(r.palavras, r.cortesDeVideo);
    if (problemas.length > 0) avisos.push(`Legenda não salva, reprovada na validação: ${problemas[0]}`);
    else salvos.push(...(await salvarSrts(`${base}.xml`, blocos)));
  }

  return {
    antesS: r.antesQ / sequencia.fps,
    depoisS: r.depoisQ / sequencia.fps,
    cortes: r.cortes,
    conferencia: r.conferencia,
    salvos,
    avisos: [...avisos, ...r.avisos],
  };
}
