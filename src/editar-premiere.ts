/*
 * Editar — o botao que encadeia tudo na sequencia aberta.
 *
 *   1. exporta o audio da sequencia (o mesmo metodo provado do Auto Pausas)
 *   2. o ElevenLabs ouve UMA vez (resposta guardada pela assinatura do audio)
 *   3. Auto Pausas com essa fala + o nivel do audio; zoom e posicao do clipe
 *      original acompanham cada pedaco
 *   4. Auto B-roll pela fala, terminando junto com cada variacao
 *   5. Auto Split (opcional)
 *   6. legendas: .srt de texto e de preco, e o pedido para o ajudante CEP
 *      criar as faixas de legenda (o UXP nao cria)
 *
 * Nenhuma regra nova de edicao mora aqui: cada etapa chama o que ja existe.
 * A parte pura (fala acompanhando o corte, fim da variacao) esta em editar.ts.
 */

import { analisarPalavras } from "../ferramentas/auto-broll/src/analise.ts";
import {
  comPendente,
  ligacoesFirmes,
  parseAssociacoes,
  parseMemoria,
  parsePendentes,
} from "../ferramentas/auto-broll/src/aprendizado.ts";
import { parseConfig, relogio } from "../ferramentas/auto-broll/src/domain.ts";
import { parseCacheIntensidade, ritmo } from "../ferramentas/auto-broll/src/intensidade.ts";
import { parseSinonimos, SINONIMOS_PADRAO, usarSinonimos } from "../ferramentas/auto-broll/src/match.ts";
import { planejar, REGRAS_DENSAS, REGRAS_PADRAO, semSobrepor } from "../ferramentas/auto-broll/src/plano.ts";
import {
  comLimite,
  comTransacao,
  inserirPlano,
  lerBrollsAcimaDeV1,
  listarPastaBrolls,
  medirBiblioteca,
  readJson,
  writeJson,
} from "../ferramentas/auto-broll/src/premiere.ts";
import { audioMudo } from "../ferramentas/pro-captions/src/audio.ts";
import { assinaturaDoAudio, palavrasDoElevenLabs, termosChave } from "../ferramentas/pro-captions/src/elevenlabs.ts";
import { transcreverNoElevenLabs } from "../ferramentas/pro-captions/src/elevenlabs-rede.ts";
import { blocosParaSrt, gerarBlocos } from "../ferramentas/pro-captions/src/pipeline.ts";
import {
  guardarTranscricao,
  lerChaveElevenLabs,
  lerTranscricaoGuardada,
  salvarSrt,
} from "../ferramentas/pro-captions/src/premiere.ts";
import { PRESET_ELEVENLABS } from "../ferramentas/pro-captions/src/preset.ts";
import { validar } from "../ferramentas/pro-captions/src/segmentar.ts";
import type { PalavraEditada } from "../ferramentas/pro-captions/src/transcript.ts";
import { aplicarSplit } from "./autosplit-premiere.ts";
import { cortesDosPedacos, dentroDasVariacoes, moverPalavras, variacoes, type Variacao } from "./editar.ts";
import {
  apagarArquivo,
  aplicarPlano,
  clipesEmQuadros,
  exportarAudio,
  lerSequencia,
  linhasDoAplicado,
  type ClipeLido,
} from "./pausas-premiere.ts";
import { blocosDeFala, MARGEM_PADRAO_S, planejarCortes, type Pedaco } from "./pausas.ts";
import { nivelPorJanela } from "./wav.ts";

declare function require(id: string): unknown;
/* eslint-disable @typescript-eslint/no-explicit-any */
const ppro = require("premierepro") as any;
const uxp = require("uxp") as any;
/* eslint-enable @typescript-eslint/no-explicit-any */

const CLIP = 1;
const JANELA_S = 0.02;
const MATCH_MOTION = "AE.ADBE Motion";
const MATCH_LUMETRI = "AE.ADBE Lumetri";

export type Registrar = (texto: string, tipo?: "passo" | "ok" | "aviso" | "erro" | "vazio") => void;

// ------------------------------------------------------------------ estado

export interface EstadoSequencia {
  readonly nome: string;
  readonly duracaoS: number;
  readonly clipesV1: number;
  readonly variacoes: number;
  readonly brollsAcimaDaV1: number;
  readonly faixasDeLegenda: number;
  readonly temChave: boolean;
}

/** O que o painel mostra ao abrir: le a sequencia, nao mexe em nada. */
export async function lerEstado(): Promise<EstadoSequencia> {
  const s = await comLimite("ler a sequência", lerSequencia(false), 20000);
  const clipes = clipesEmQuadros(s);
  const project = await ppro.Project.getActiveProject();
  const sequence = await project.getActiveSequence();
  let faixasDeLegenda = 0;
  try {
    faixasDeLegenda = await comLimite("faixas de legenda", sequence.getCaptionTrackCount() as Promise<number>, 5000);
  } catch {
    // Contar legenda e enfeite: sem isto o estado continua valendo.
  }
  return {
    nome: s.info.name,
    duracaoS: Math.max(...clipes.map((c) => c.fimQ)) / s.fps,
    clipesV1: s.v1.length,
    variacoes: variacoes(clipes, s.fps).length,
    brollsAcimaDaV1: (await comLimite("B-rolls", lerBrollsAcimaDeV1(), 10000)).length,
    faixasDeLegenda,
    temChave: (await comLimite("chave", lerChaveElevenLabs(), 5000)) !== null,
  };
}

// ------------------------------------------------------------- fala (1x)

interface Fala {
  readonly palavras: PalavraEditada[];
  /** Nivel do audio da sequencia por janela de 20 ms, no mesmo relogio das palavras. */
  readonly db: readonly number[];
}

async function ouvirSequencia(registrar: Registrar, progresso: (t: string) => void): Promise<Fala> {
  const chave = await comLimite("chave", lerChaveElevenLabs(), 5000);
  if (!chave) throw new Error("Sem chave do ElevenLabs. Salve a chave (sk_…) no Pro Captions e clique de novo.");

  progresso("exportando o áudio");
  const audio = await exportarAudio("editar-audio.wav");
  try {
    registrar(`áudio da sequência: ${(audio.bytes.byteLength / 1e6).toFixed(1)} MB em ${(audio.ms / 1000).toFixed(1)} s`, "passo");
    if (audioMudo(audio.bytes)) {
      throw new Error("O áudio da sequência está mudo (A1 silenciada ou outra faixa em solo). Nada foi enviado ao ElevenLabs.");
    }
    const db = nivelPorJanela(audio.bytes, JANELA_S * 1000).db[0] ?? [];

    const assinatura = assinaturaDoAudio(audio.bytes);
    let json = await comLimite("transcrição guardada", lerTranscricaoGuardada(assinatura), 5000);
    if (json !== null) {
      registrar("mesmo áudio de antes: transcrição reaproveitada, sem custo", "passo");
    } else {
      progresso("ElevenLabs ouvindo");
      const t0 = Date.now();
      json = await comLimite(
        "ElevenLabs",
        transcreverNoElevenLabs(audio.bytes, chave, termosChave(PRESET_ELEVENLABS), (t) => registrar(t, "aviso")),
        15 * 60 * 1000
      );
      registrar(`ElevenLabs respondeu em ${((Date.now() - t0) / 1000).toFixed(0)} s`, "passo");
      await comLimite("guardar transcrição", guardarTranscricao(assinatura, json), 10000);
    }
    const palavras = palavrasDoElevenLabs(json);
    if (palavras === null || palavras.length === 0) throw new Error("O ElevenLabs não ouviu nenhuma palavra nesta sequência.");
    registrar(`${palavras.length} palavras ouvidas`, "ok");
    return { palavras, db };
  } finally {
    await apagarArquivo(audio.caminho).catch(() => undefined);
  }
}

// ------------------------------------------------------ enquadramento (Motion)

interface Movimento {
  readonly escala: unknown;
  readonly posicao: unknown;
  /** O valor de Position como veio, para o log quando a leitura falhar. */
  readonly bruto: unknown;
  readonly temLumetri: boolean;
  readonly lumetri: unknown;
}

interface ComponenteLike {
  getMatchName: () => Promise<string>;
  getParamCount: () => number;
  getParam: (i: number) => { displayName: string; createKeyframe: (v: unknown) => unknown; createSetValueAction: (k: unknown, s: boolean) => unknown; getStartValue?: () => Promise<unknown> };
}

async function componentes(item: unknown): Promise<ComponenteLike[]> {
  const chain = (await (item as { getComponentChain: () => Promise<{ getComponentCount: () => number; getComponentAtIndex: (i: number) => ComponenteLike }> }).getComponentChain());
  const saida: ComponenteLike[] = [];
  for (let i = 0; i < chain.getComponentCount(); i++) saida.push(chain.getComponentAtIndex(i));
  return saida;
}

async function componente(item: unknown, match: string): Promise<ComponenteLike | null> {
  for (const c of await componentes(item)) if ((await c.getMatchName()) === match) return c;
  return null;
}

function param(c: ComponenteLike, nome: string): ReturnType<ComponenteLike["getParam"]> | null {
  for (let i = 0; i < c.getParamCount(); i++) if (c.getParam(i).displayName === nome) return c.getParam(i);
  return null;
}

/** O valor atual de um param; o objeto nativo guarda tudo no prototipo (ver autosplit-premiere). */
async function valorDe(p: ReturnType<ComponenteLike["getParam"]> | null): Promise<unknown> {
  if (p === null || !p.getStartValue) return undefined;
  const kf = (await comLimite("ler parâmetro", p.getStartValue() as Promise<{ value?: { value?: unknown } }>, 3000)) as {
    value?: { value?: unknown } | unknown;
  };
  const v = kf?.value;
  return v && typeof v === "object" && "value" in (v as object) ? (v as { value: unknown }).value : v;
}

/**
 * Position volta como PointF (x/y no prototipo) ou como lista [x, y] — o
 * autosplit ja tinha visto as duas formas (yDe). Normaliza para {x, y}.
 */
function pontoDe(v: unknown): { x: number; y: number } | undefined {
  const x = Array.isArray(v) ? Number(v[0]) : Number((v as { x?: unknown } | null)?.x);
  const y = Array.isArray(v) ? Number(v[1]) : Number((v as { y?: unknown } | null)?.y);
  return Number.isFinite(x) && Number.isFinite(y) ? { x, y } : undefined;
}

/** Zoom, posicao e a cor de cada clipe da V1 ANTES do corte — o corte recria os pedacos do arquivo. */
async function lerMovimentos(v1: readonly ClipeLido[]): Promise<Movimento[]> {
  const saida: Movimento[] = [];
  for (const c of v1) {
    const motion = await componente(c.item, MATCH_MOTION);
    const lumetri = await componente(c.item, MATCH_LUMETRI);
    saida.push({
      escala: motion ? await valorDe(param(motion, "Scale")).catch(() => undefined) : undefined,
      bruto: motion ? await valorDe(param(motion, "Position")).catch((e) => `erro: ${(e as Error).message}`) : undefined,
      posicao: motion ? pontoDe(await valorDe(param(motion, "Position")).catch(() => undefined)) : undefined,
      temLumetri: lumetri !== null,
      lumetri,
    });
  }
  return saida;
}

/** O que um valor nativo tem, para o log: tipo, lista ou as chaves do prototipo. */
function descrever(v: unknown): string {
  if (v === null || v === undefined) return String(v);
  if (Array.isArray(v)) return `lista ${JSON.stringify(v)}`;
  if (typeof v !== "object") return `${typeof v} ${String(v)}`;
  const chaves: string[] = [];
  for (let o: object | null = v as object; o && o !== Object.prototype; o = Object.getPrototypeOf(o)) chaves.push(...Object.getOwnPropertyNames(o));
  return `objeto {${[...new Set(chaves)].slice(0, 12).join(",")}}`;
}

const ehPadrao = (m: Movimento): boolean => {
  const escala = Number(m.escala);
  const p = m.posicao as { x?: number; y?: number } | undefined;
  return (!Number.isFinite(escala) || Math.abs(escala - 100) < 1e-6) && (!p || (Math.abs((p.x ?? 0.5) - 0.5) < 1e-6 && Math.abs((p.y ?? 0.5) - 0.5) < 1e-6));
};

/**
 * Devolve a cada pedaco o zoom e a posicao do clipe de onde ele saiu, e tenta
 * levar a cor (Lumetri) junto. O pedaco k da V1 de agora e o pedaco k do plano.
 */
async function reaplicarMovimentos(
  pedacos: readonly Pedaco[],
  originais: ReadonlyArray<{ readonly inicioQ: number; readonly fimQ: number }>,
  movimentos: readonly Movimento[],
  registrar: Registrar
): Promise<void> {
  if (movimentos.every(ehPadrao) && !movimentos.some((m) => m.temLumetri)) return;
  const project = await ppro.Project.getActiveProject();
  const sequence = await project.getActiveSequence();
  const faixa = await sequence.getVideoTrack(0);
  const itens = (await faixa.getTrackItems(CLIP, false)) as unknown[];
  const comInicio = await Promise.all(itens.map(async (i) => ({ i, s: ((await (i as { getStartTime: () => Promise<{ seconds: number }> }).getStartTime()).seconds) })));
  const ordenados = comInicio.sort((a, b) => a.s - b.s).map((x) => x.i);
  if (ordenados.length !== pedacos.length) {
    registrar(`zoom/posição não reaplicados: a V1 tem ${ordenados.length} pedaços e o plano ${pedacos.length}`, "aviso");
    return;
  }

  const acoes: Array<() => unknown> = [];
  const lumetri: Array<() => unknown> = [];
  let comEscala = 0;
  let comPosicao = 0;
  // O que foi lido de cada clipe original: e o que diz se a leitura funcionou.
  movimentos.forEach((m, i) => {
    const pt = m.posicao as { x?: number; y?: number } | undefined;
    registrar(
      `  clipe ${i + 1}: escala ${String(m.escala)} · posição ${pt ? `${pt.x!.toFixed(3)},${pt.y!.toFixed(3)}` : `não lida (${descrever(m.bruto)})`}${m.temLumetri ? " · Lumetri" : ""}`,
      "vazio"
    );
  });
  for (const [k, p] of pedacos.entries()) {
    const origem = originais.findIndex((o) => p.origemQ >= o.inicioQ && p.origemQ < o.fimQ);
    const m = movimentos[origem];
    if (m === undefined) continue;
    const item = ordenados[k]!;
    if (!ehPadrao(m)) {
      const motion = await componente(item, MATCH_MOTION);
      const escala = motion ? param(motion, "Scale") : null;
      const posicao = motion ? param(motion, "Position") : null;
      if (escala && Number.isFinite(Number(m.escala))) {
        comEscala++;
        acoes.push(() => escala.createSetValueAction(escala.createKeyframe(Number(m.escala)), true));
      }
      const pt = m.posicao as { x?: number; y?: number } | undefined;
      if (posicao && pt && Number.isFinite(pt.x) && Number.isFinite(pt.y)) {
        comPosicao++;
        acoes.push(() => {
          const P = (ppro as { PointF: new (x?: number, y?: number) => { x: number; y: number } }).PointF;
          const ponto = new P(pt.x, pt.y);
          ponto.x = pt.x!;
          ponto.y = pt.y!;
          return posicao.createSetValueAction(posicao.createKeyframe(ponto), true);
        });
      }
    }
    if (m.temLumetri && m.lumetri) {
      const chain = await (item as { getComponentChain: () => Promise<{ createAppendComponentAction: (c: unknown) => unknown }> }).getComponentChain();
      lumetri.push(() => chain.createAppendComponentAction(m.lumetri));
    }
  }
  if (acoes.length > 0) {
    comTransacao(project as never, "Editar: zoom e posição dos pedaços", (adicionar) => {
      for (const a of acoes) adicionar(a());
    });
    registrar(`zoom devolvido a ${comEscala} e posição a ${comPosicao} de ${pedacos.length} pedaços`, "ok");
  }
  if (lumetri.length > 0) {
    // Experimental: a API aceita anexar um componente; se ela copiar o Lumetri
    // do clipe original, a cor vem junto. Se recusar, so avisa.
    try {
      comTransacao(project as never, "Editar: cor dos pedaços", (adicionar) => {
        for (const a of lumetri) adicionar(a());
      });
      registrar(`cor (Lumetri) copiada para ${lumetri.length} pedaços — confira no Lumetri`, "ok");
    } catch (e) {
      registrar(`a cor (Lumetri) não acompanhou os pedaços (${(e as Error).message}): aplique de novo na V1`, "aviso");
    }
  }
}

// ------------------------------------------------------------------ b-roll

async function colocarBroll(
  palavras: readonly PalavraEditada[],
  vars: readonly Variacao[],
  fps: number,
  nomeSequencia: string,
  registrar: Registrar,
  progresso: (t: string) => void
): Promise<number> {
  const config = parseConfig(await comLimite("ler config", readJson("config.json"), 5000));
  if (!config.libraryPath) throw new Error("Pasta de B-rolls não configurada. Abra o Auto B-roll uma vez e escolha a pasta.");
  usarSinonimos(parseSinonimos(await comLimite("ler sinônimos", readJson("sinonimos.json"), 5000)) ?? SINONIMOS_PADRAO);
  const memoria = parseMemoria(await comLimite("ler aprendizado", readJson("aprendizado.json"), 5000));
  const ligacoes = ligacoesFirmes(parseAssociacoes(await comLimite("ler ligações", readJson("ligacoes.json"), 5000)));
  const arquivos = await comLimite("listar B-rolls", listarPastaBrolls(config.libraryPath), 20000);
  registrar(`biblioteca: ${arquivos.length} B-rolls · ${Object.keys(memoria.pares).length} pares aprendidos`, "passo");

  const analise = analisarPalavras(palavras, { biblioteca: arquivos.map((a) => a.name), ligacoes });
  progresso("medindo os takes");
  const cache = parseCacheIntensidade(await comLimite("ler intensidade", readJson("intensidade.json"), 5000));
  const medido = await comLimite("medir intensidade", medirBiblioteca(arquivos, cache, () => undefined), 300000).catch(() => cache);
  if (medido !== cache) await writeJson("intensidade.json", medido);
  const porArquivo = new Map(Object.entries(medido.arquivos).filter((e): e is [string, number] => e[1] !== null));

  const plano = planejar(
    analise.oportunidades,
    { caminhos: new Map(arquivos.map((a) => [a.name, a.nativePath])) },
    config.densidadeMaxima ? REGRAS_DENSAS : REGRAS_PADRAO,
    memoria,
    { porArquivo, ritmoDasFrases: analise.frases.map((f) => ritmo(f.palavras, f.duracao)) }
  );
  const { ficam, aparados, fora } = dentroDasVariacoes(plano.colocacoes, vars, fps);
  const ocupado = (await comLimite("B-rolls na timeline", lerBrollsAcimaDeV1(), 10000)).map((b) => ({
    inicio: b.startSeconds,
    fim: b.endSeconds,
    arquivo: b.sourceName,
  }));
  const { entram, bloqueadas } = semSobrepor(ficam, ocupado);
  for (const f of [...fora, ...bloqueadas]) registrar(`  ${f}`, "vazio");
  if (aparados > 0) registrar(`${aparados} B-roll(s) aparados para terminar junto com o vídeo`, "passo");
  if (entram.length === 0) {
    registrar("nenhum B-roll bom o bastante para entrar sozinho", "aviso");
    return 0;
  }

  progresso(`colocando ${entram.length} B-rolls`);
  const feito = await comLimite(
    "inserir B-rolls",
    inserirPlano(entram, {
      videoTrackIndex: config.videoTrackIndex,
      audioTrackIndex: config.audioTrackIndex,
      removerAudio: config.removeAudio,
      preencherTela: config.fillScreen,
    }),
    120000
  );
  for (const c of entram) registrar(`  ${relogio(c.inicio)} ${c.arquivo} · ${c.motivo}`, "vazio");
  for (const a of feito.avisos) registrar(`  ${a}`, "aviso");

  // O que entrou fica guardado: o Aprender do Auto B-roll compara com o que o
  // Leo manteve ou apagou, igual quando ele usa o botao do Auto B-roll.
  const pendentes = parsePendentes(await comLimite("ler pendentes", readJson("pendentes.json"), 5000));
  await writeJson(
    "pendentes.json",
    comPendente(pendentes, nomeSequencia, {
      quando: new Date().toISOString(),
      itens: entram.map((c) => ({ arquivo: c.arquivo, conceito: c.conceito, termosCasados: c.termosCasados, inicio: c.inicio })),
    })
  );
  registrar(`${entram.length} B-rolls na V${config.videoTrackIndex + 1}`, "ok");
  return entram.length;
}

// ---------------------------------------------------------------- legendas

const PEDIDO = "timeline-pedido.txt";
const RESPOSTA = "timeline-resposta.txt";

async function arquivoDeDados(nome: string): Promise<{ read: () => Promise<string>; delete: () => Promise<unknown> } | null> {
  const pasta = (await uxp.storage.localFileSystem.getDataFolder()) as { getEntry: (n: string) => Promise<unknown> };
  try {
    return (await pasta.getEntry(nome)) as { read: () => Promise<string>; delete: () => Promise<unknown> };
  } catch {
    return null;
  }
}

/**
 * Pede ao ajudante CEP (que abre escondido junto com o Premiere) para criar as
 * faixas de legenda. O pedido e um arquivo na pasta de dados; a resposta
 * volta outro. Sem resposta em 20 s, o ajudante nao esta rodando.
 */
async function pedirLegendasNaTimeline(legendas: string, precos: string | null): Promise<string | null> {
  const velha = await arquivoDeDados(RESPOSTA);
  if (velha) await velha.delete();
  const id = String(Date.now());
  await salvarSrt(PEDIDO, [id, legendas, precos ?? ""].join("\n"));
  for (let t = 0; t < 40; t++) {
    await new Promise((r) => setTimeout(r, 500));
    const resposta = await arquivoDeDados(RESPOSTA);
    if (!resposta) continue;
    const [quem, ...resto] = (await resposta.read()).split("\n");
    if (quem?.trim() !== id) continue;
    await resposta.delete();
    return resto.join("\n");
  }
  const pedido = await arquivoDeDados(PEDIDO);
  if (pedido) await pedido.delete();
  return null;
}

async function colocarLegendas(palavras: readonly PalavraEditada[], cortes: readonly number[], registrar: Registrar): Promise<void> {
  const blocos = gerarBlocos(palavras, cortes, PRESET_ELEVENLABS);
  const problemas = validar(blocos, PRESET_ELEVENLABS);
  if (problemas.length > 0) {
    registrar(`legenda reprovada na validação: ${problemas.slice(0, 3).join("; ")}`, "erro");
    return;
  }
  const normais = blocos.filter((b) => b.estilo === "normal");
  const precos = blocos.filter((b) => b.estilo === "preco");
  const revisar = blocos.filter((b) => b.precisaRevisao);
  const caminhoLegendas = await salvarSrt("legendas.srt", blocosParaSrt(normais));
  const caminhoPrecos = precos.length > 0 ? await salvarSrt("precos.srt", blocosParaSrt(precos)) : null;
  registrar(`${blocos.length} legendas · ${precos.length} preço(s) · ${revisar.length} para revisar`, "passo");
  for (const b of revisar.slice(0, 6)) registrar(`  revisar ${relogio(b.inicio)}: ${b.motivos.join("; ")}`, "aviso");

  const resposta = await pedirLegendasNaTimeline(caminhoLegendas, caminhoPrecos);
  if (resposta === null) {
    registrar(
      "o ajudante da timeline não respondeu. Abra Window > Extensions > Pro Captions: Timeline e clique em Colocar legendas.",
      "aviso"
    );
  } else if (resposta.startsWith("OK|")) {
    registrar(resposta.slice(3).split("\n")[0] ?? "legendas na timeline", "ok");
  } else {
    registrar(`o ajudante recusou: ${resposta.replace(/^ERRO\|/, "")}`, "erro");
  }
}

// ------------------------------------------------------------------- tudo

export interface OpcoesEditar {
  readonly pausas: boolean;
  readonly broll: boolean;
  readonly split: boolean;
  readonly legendas: boolean;
}

export async function editar(opcoes: OpcoesEditar, registrar: Registrar, progresso: (t: string) => void): Promise<boolean> {
  const t0 = Date.now();
  const s = await comLimite("ler a sequência", lerSequencia(opcoes.pausas), 20000);
  const fps = s.fps;
  const originais = clipesEmQuadros(s);
  registrar(`${s.info.name}: ${s.v1.length} clipe(s) na V1, ${variacoes(originais, fps).length} variação(ões)`, "passo");

  // 1-2. A fala, uma vez so.
  const fala = await ouvirSequencia(registrar, progresso);
  let palavras = fala.palavras;
  let cortes = originais.slice(1).map((c) => c.inicioQ / fps);
  let clipesDepois: ReadonlyArray<{ inicioQ: number; fimQ: number }> = originais;

  // 3. Auto Pausas.
  if (opcoes.pausas) {
    progresso("decidindo as pausas");
    const falaP = palavras.filter((p) => p.fim > p.inicio).map((p) => ({ texto: p.text, inicio: p.inicio, fim: p.fim }));
    const blocos = blocosDeFala(fala.db, JANELA_S, falaP);
    const duracaoQ = Math.max(...originais.map((c) => c.fimQ));
    const plano = planejarCortes(blocos, { fps, duracaoQ, margemS: MARGEM_PADRAO_S });
    if (plano.cortes.length === 0) {
      registrar("nenhuma pausa para cortar", "passo");
    } else {
      const movimentos = await lerMovimentos(s.v1);
      const r = await aplicarPlano(s, plano.trechos, progresso);
      for (const l of linhasDoAplicado(r, r.pedacos.length)) registrar(l, r.emSincronia && r.contagemOk && r.duracaoOk ? "passo" : "aviso");
      registrar(`${plano.cortes.length} pausas cortadas · ${relogio(duracaoQ / fps)} → ${relogio(r.totalQ / fps)}`, "ok");
      await reaplicarMovimentos(r.pedacos, originais, movimentos, registrar).catch((e) =>
        registrar(`zoom/posição não reaplicados: ${(e as Error).message}`, "aviso")
      );
      palavras = moverPalavras(palavras, r.pedacos, fps);
      cortes = cortesDosPedacos(r.pedacos, fps);
      clipesDepois = r.pedacos.map((p) => ({ inicioQ: p.destinoQ, fimQ: p.destinoQ + p.midiaAteQ - p.midiaDeQ }));
    }
  }
  const vars = variacoes(clipesDepois, fps);

  // 4. Auto B-roll.
  if (opcoes.broll) {
    progresso("escolhendo B-rolls");
    await colocarBroll(palavras, vars, fps, s.info.name, registrar, progresso).catch((e) =>
      registrar(`B-roll: ${(e as Error).message}`, "erro")
    );
  }

  // 5. Auto Split.
  if (opcoes.split) {
    progresso("split");
    try {
      const r = await aplicarSplit({ faixa: null, divisao: 50, subirDoutor: false, refazer: false });
      for (const l of r.linhas.slice(-4)) registrar(`  ${l}`, "vazio");
      registrar(r.ok ? "split aplicado" : "split com avisos", r.ok ? "ok" : "aviso");
    } catch (e) {
      registrar(`Split: ${(e as Error).message}`, "erro");
    }
  }

  // 6. Legendas por ultimo: a timeline ja esta no formato final.
  if (opcoes.legendas) {
    progresso("legendas");
    await colocarLegendas(palavras, cortes, registrar).catch((e) => registrar(`Legendas: ${(e as Error).message}`, "erro"));
  }

  registrar(`pronto em ${((Date.now() - t0) / 1000).toFixed(0)} s`, "ok");
  return true;
}
