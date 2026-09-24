/*
 * Auto B-roll: a ponta que le disco. A regra mora em src/broll.ts.
 *
 * O aprendizado nao comeca do zero: le o que o painel do Premiere ja juntou
 * (aprendizado, ligacoes, sinonimos, intensidade). Por enquanto so le — quem
 * ainda aprende com o que o Leo mantem ou apaga e o botao Aprender do painel.
 */

import { existsSync } from "node:fs";
import { readdir, readFile, stat, writeFile } from "node:fs/promises";
import { basename, dirname, join } from "node:path";

import { ligacoesFirmes, parseAssociacoes, parseMemoria, type Memoria } from "../../../ferramentas/auto-broll/src/aprendizado.ts";
import { ehVideo, parseConfig } from "../../../ferramentas/auto-broll/src/domain.ts";
import { aMedir, comMedida, parseCacheIntensidade } from "../../../ferramentas/auto-broll/src/intensidade.ts";
import { parseSinonimos, SINONIMOS_PADRAO, usarSinonimos } from "../../../ferramentas/auto-broll/src/match.ts";
import { agitacaoDeMp4 } from "../../../ferramentas/auto-broll/src/mp4.ts";
import { colocarBroll, type ArquivoBroll } from "../broll.ts";
import { palavrasNaSequencia } from "../sequencia.ts";
import { lerSequenciaXml } from "../xml-ler.ts";
import { sequenciaParaXml, type Sequencia } from "../xml.ts";
import type { Config } from "./config.ts";
import { falaDosArquivos } from "./fala.ts";
import { sondar } from "./midia.ts";

const PASTA_PADRAO = join(process.env.USERPROFILE ?? "C:\\Users\\leogi", "Downloads", "Brolls - 2026");

/** A pasta de dados do painel com o aprendizado mais recente (Premiere 25 ou 26, Pro Edition ou Auto B-roll). */
export async function pastaDoPainel(): Promise<string | null> {
  const base = join(process.env.APPDATA ?? "", "Adobe", "UXP", "PluginsStorage", "PPRO");
  let melhor: { pasta: string; quando: number } | null = null;
  for (const versao of await readdir(base).catch(() => [] as string[])) {
    for (const plugin of ["com.leogi.proedition", "com.leogi.autobroll"]) {
      const pasta = join(base, versao, "External", plugin, "PluginData");
      const quando = (await stat(join(pasta, "aprendizado.json")).catch(() => null))?.mtimeMs;
      if (quando !== undefined && (melhor === null || quando > melhor.quando)) melhor = { pasta, quando };
    }
  }
  return melhor?.pasta ?? null;
}

export async function jsonDe(pasta: string | null, nome: string): Promise<unknown> {
  if (pasta === null) return null;
  try {
    return JSON.parse(await readFile(join(pasta, nome), "utf8"));
  } catch {
    return null;
  }
}

interface Aprendido {
  readonly memoria: Memoria;
  readonly ligacoes: Map<string, string[]>;
  readonly pastaBroll: string;
  readonly origem: string;
}

async function aprendido(cfg: Config): Promise<Aprendido> {
  const painel = await pastaDoPainel();
  usarSinonimos(parseSinonimos(await jsonDe(painel, "sinonimos.json")) ?? SINONIMOS_PADRAO);
  const memoria = parseMemoria(await jsonDe(painel, "aprendizado.json"));
  const ligacoes = ligacoesFirmes(parseAssociacoes(await jsonDe(painel, "ligacoes.json")));
  const pastaBroll =
    (await cfg.preferencias()).pastaBroll ?? (parseConfig(await jsonDe(painel, "config.json")).libraryPath || PASTA_PADRAO);
  return {
    memoria,
    ligacoes,
    pastaBroll,
    origem:
      painel === null
        ? "sem aprendizado do painel"
        : `aprendizado do painel: ${Object.keys(memoria.pares).length} pares, ${ligacoes.size} ligações`,
  };
}

interface Sondado {
  readonly tamanho: number;
  readonly duracaoS: number;
  readonly largura: number;
  readonly altura: number;
  readonly canais: number;
}

/** A biblioteca inteira, sondada uma vez (o cache fica na pasta do programa). */
async function biblioteca(pasta: string, fps: number, cfg: Config, avisar: (t: string) => void): Promise<ArquivoBroll[]> {
  if (!existsSync(pasta)) throw new Error(`Pasta de B-rolls não encontrada: ${pasta}. Escolha a pasta em Configurações.`);
  const cache = ((await cfg.lerJson("biblioteca.json")) ?? {}) as Record<string, Sondado>;
  const nomes = (await readdir(pasta)).filter(ehVideo);
  let mudou = false;
  const saida: ArquivoBroll[] = [];
  for (const [i, nome] of nomes.entries()) {
    const caminho = join(pasta, nome);
    const tamanho = (await stat(caminho)).size;
    let s = cache[caminho];
    if (s === undefined || s.tamanho !== tamanho) {
      if (i % 10 === 0) avisar(`lendo a biblioteca ${i + 1}/${nomes.length}`);
      const info = await sondar(caminho);
      if (info.largura === null || info.altura === null) continue;
      s = { tamanho, duracaoS: info.duracaoS, largura: info.largura, altura: info.altura, canais: info.canais };
      cache[caminho] = s;
      mudou = true;
    }
    saida.push({ nome, caminho, duracaoQ: Math.floor(s.duracaoS * fps), largura: s.largura, altura: s.altura, canais: s.canais });
  }
  if (mudou) await cfg.gravarJson("biblioteca.json", cache);
  return saida;
}

/** Agitacao de cada take: a do painel, e o que faltar medido aqui e guardado. */
async function agitacao(arquivos: readonly ArquivoBroll[], cfg: Config, avisar: (t: string) => void): Promise<Map<string, number>> {
  const painel = parseCacheIntensidade(await jsonDe(await pastaDoPainel(), "intensidade.json"));
  const meu = parseCacheIntensidade(await cfg.lerJson("intensidade.json"));
  let cache = { ...meu, arquivos: { ...painel.arquivos, ...meu.arquivos } };
  const pendentes = aMedir(cache, arquivos.map((a) => a.nome));
  const porNome = new Map(arquivos.map((a) => [a.nome, a.caminho]));
  for (const [i, nome] of pendentes.entries()) {
    avisar(`medindo a agitação dos takes ${i + 1}/${pendentes.length}`);
    let valor: number | null = null;
    try {
      valor = agitacaoDeMp4(new Uint8Array(await readFile(porNome.get(nome) ?? "")));
    } catch {
      // Arquivo ilegivel: fica null e nao se tenta de novo.
    }
    cache = comMedida(cache, nome, valor);
  }
  if (pendentes.length > 0) await cfg.gravarJson("intensidade.json", cache);
  return new Map(Object.entries(cache.arquivos).filter((e): e is [string, number] => e[1] !== null));
}

export interface EntradaBroll {
  readonly nome: string;
  readonly duracaoS: number;
  readonly arquivos: number;
  readonly jaNaV2: number;
  readonly pastaBroll: string;
  readonly origem: string;
  readonly avisos: string[];
}

export interface ColocadoBroll {
  readonly inicio: number;
  readonly duracao: number;
  readonly arquivo: string;
  readonly motivo: string;
  readonly frase: string;
}

export interface ResultadoBrollSalvo {
  readonly colocados: ColocadoBroll[];
  readonly descartes: string[];
  readonly salvos: string[];
  readonly avisos: string[];
}

async function sequenciaDoXml(caminho: string): Promise<{ sequencia: Sequencia; avisos: string[] }> {
  const { avisos, ...sequencia } = lerSequenciaXml(await readFile(caminho, "utf8"));
  if ((sequencia.video[0] ?? []).length === 0) throw new Error("A V1 está vazia. Exporte a sequência com o doutor na V1.");
  return { sequencia, avisos };
}

export async function abrirParaBroll(caminho: string, cfg: Config): Promise<EntradaBroll> {
  const { sequencia, avisos } = await sequenciaDoXml(caminho);
  const a = await aprendido(cfg);
  const v1 = sequencia.video[0] ?? [];
  return {
    nome: sequencia.nome,
    duracaoS: Math.max(...v1.map((c) => c.fimQ)) / sequencia.fps,
    arquivos: new Set(v1.map((c) => c.midia.caminho)).size,
    jaNaV2: (sequencia.video[1] ?? []).length,
    pastaBroll: a.pastaBroll,
    origem: a.origem,
    avisos,
  };
}

export async function rodarBroll(caminho: string, cfg: Config, avisar: (t: string) => void): Promise<ResultadoBrollSalvo> {
  const { sequencia, avisos } = await sequenciaDoXml(caminho);
  const a = await aprendido(cfg);
  const v1 = sequencia.video[0] ?? [];

  const fala = await falaDosArquivos([...new Set(v1.map((c) => c.midia.caminho))], cfg, avisar);
  const palavras = palavrasNaSequencia(v1, sequencia.fps, (c) => fala.get(c) ?? []);
  if (palavras.length === 0) throw new Error("Nenhuma fala encontrada na V1.");

  const lib = await biblioteca(a.pastaBroll, sequencia.fps, cfg, avisar);
  const agit = await agitacao(lib, cfg, avisar);

  avisar("escolhendo os B-rolls");
  const r = colocarBroll(sequencia, palavras, lib, { memoria: a.memoria, ligacoes: a.ligacoes, agitacao: agit });
  const saida = join(dirname(caminho), `${sequencia.nome} - com B-roll.xml`);
  await writeFile(saida, sequenciaParaXml(r.sequencia), "utf8");

  return {
    colocados: r.colocacoes.map((c) => ({
      inicio: c.inicio,
      duracao: c.duracao,
      arquivo: basename(c.caminho),
      motivo: c.motivo,
      frase: c.textoDaFrase,
    })),
    descartes: [...r.descartes],
    salvos: [saida],
    avisos: [...avisos, ...r.avisos],
  };
}
