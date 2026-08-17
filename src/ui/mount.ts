/*
 * Painel. Nao chama `premierepro` direto: fala com src/premiere.ts.
 *
 * Duas acoes, so isso: gerar e restaurar. Tudo que a analise descobre vai para
 * o log da tela E para um arquivo, porque o painel nao deixa copiar texto e o
 * log some da area visivel.
 */

import { relogio } from "../domain.ts";
import { blocosParaSrt, gerarBlocos } from "../pipeline.ts";
import {
  comLimite,
  escreverTranscricao,
  getSequenceInfo,
  gravarLog,
  importarArquivos,
  lerBackup,
  lerClipes,
  lerCortes,
  lerTranscricoes,
  salvarSrt,
} from "../premiere.ts";
import { validar } from "../segmentar.ts";
import { parseTranscricao, reconstruirTranscricao, type TranscricaoOrigem } from "../transcript.ts";

const elemento = (id: string): HTMLElement => {
  const el = document.getElementById(id);
  if (!el) throw new Error(`elemento ausente no HTML: ${id}`);
  return el;
};

let linhas: string[] = [];

function registrar(texto: string): void {
  linhas.push(texto);
  const log = elemento("log");
  log.textContent = linhas.join("\n");
  // O que importa fica no fim; sem isto as ultimas linhas nascem fora da vista.
  log.scrollTop = log.scrollHeight;
}

function estado(texto: string): void {
  elemento("estado").textContent = texto;
}

function ocupado(sim: boolean): void {
  for (const id of ["gerar", "restaurar"]) {
    const b = elemento(id) as HTMLElement & { disabled?: boolean };
    b.disabled = sim;
  }
}

/** Toda acao termina gravando o log, mesmo quando falha. */
async function comLog(rotulo: string, tarefa: () => Promise<void>): Promise<void> {
  linhas = [];
  ocupado(true);
  registrar(`== ${rotulo} ==`);
  try {
    await tarefa();
  } catch (e) {
    const err = e as Error;
    registrar(`ERRO: ${err?.message ?? String(e)}`);
    estado("erro");
  } finally {
    ocupado(false);
    try {
      const caminho = await comLimite("log", gravarLog(linhas));
      registrar("");
      registrar(`log salvo em ${caminho}`);
    } catch {
      // Nao poder gravar o log nao pode derrubar o que ja foi feito.
    }
  }
}

/** Le a sequencia e devolve tudo que o nucleo precisa. */
async function lerTudo(): Promise<{
  clipes: Awaited<ReturnType<typeof lerClipes>>;
  cortes: number[];
  palavras: ReturnType<typeof reconstruirTranscricao>;
}> {
  const info = await comLimite("sequencia", getSequenceInfo());
  const nome = elemento("seqNome");
  nome.textContent = info.name;
  nome.setAttribute("data-vazio", "nao");
  registrar(`${info.fps.toFixed(2)} fps · ${info.videoTracks} video · ${info.captionTracks} caption`);

  const clipes = await comLimite("clipes", lerClipes(0));
  const cortes = await comLimite("cortes", lerCortes(0));
  registrar(`V1: ${clipes.length} clipes · ${cortes.length} cortes`);

  const { transcricoes: brutas, falhas } = await comLimite(
    "transcricoes",
    lerTranscricoes(clipes.map((c) => c.sourceName)),
    60000
  );
  registrar(`${brutas.size} midias com transcricao`);
  for (const f of falhas) registrar(`"${f.nome}": ${f.motivo}`);

  const mapa = new Map<string, TranscricaoOrigem>();
  for (const [midia, json] of brutas) {
    const t = parseTranscricao(json);
    if (t) mapa.set(midia, t);
    else registrar(`transcricao ilegivel: ${midia}`);
  }

  const palavras = reconstruirTranscricao(clipes, mapa);
  registrar(`${palavras.length} palavras no corte final`);
  return { clipes, cortes, palavras };
}

async function gerar(): Promise<void> {
  estado("lendo sequencia");
  const { clipes, cortes, palavras } = await lerTudo();
  if (palavras.length === 0) {
    throw new Error("Nenhuma palavra encontrada. A camera principal da V1 tem transcricao?");
  }

  estado("montando legendas");
  const blocos = gerarBlocos(palavras, cortes);
  const problemas = validar(blocos);
  const precos = blocos.filter((b) => b.estilo === "preco");
  const revisar = blocos.filter((b) => b.precisaRevisao);

  // Nunca renderizar antes da validacao final.
  if (problemas.length > 0) {
    registrar("");
    registrar(`${problemas.length} bloco(s) reprovado(s) na validacao, nada foi escrito:`);
    for (const p of problemas.slice(0, 10)) registrar(`  ${p}`);
    estado("reprovado");
    return;
  }

  // A escrita do transcript no clipe (rota destrutiva, D-04) foi removida em
  // 2026-08-12: o .srt e o caminho (D-13) e nao ha motivo para tocar na
  // midia do projeto. "Restaurar original" fica para desfazer escritas de
  // versoes antigas.

  // Resumo no fim: o log rola sozinho e so as ultimas linhas ficam a vista.
  registrar("");
  registrar(`${blocos.length} blocos · ${precos.length} preco(s) · ${revisar.length} para revisar`);
  registrar("");
  for (const b of blocos.slice(0, 12)) {
    const marca = b.estilo === "preco" ? "R$" : "  ";
    registrar(`${marca} ${relogio(b.inicio)} ${b.texto}`);
  }
  if (blocos.length > 12) registrar(`   ... mais ${blocos.length - 12}`);

  if (revisar.length > 0) {
    registrar("");
    registrar("precisam de revisao:");
    for (const b of revisar.slice(0, 8)) registrar(`  ${relogio(b.inicio)} ${b.motivos.join("; ")}`);
  }

  // O E5 provou que "Criar legendas a partir da transcricao" re-segmenta os
  // nossos blocos; o caminho que preserva um bloco por legenda e o .srt.
  //
  // Texto e preco saem em arquivos separados: cada um vai na sua faixa de
  // legenda e o estilo da faixa resolve o tamanho (96 no texto, 150 no
  // preco) sem mexer em legenda individual (D-16).
  const normais = blocos.filter((b) => b.estilo === "normal");
  const caminhos = [await comLimite("srt", salvarSrt("legendas.srt", blocosParaSrt(normais)))];
  if (precos.length > 0) {
    caminhos.push(await comLimite("srt precos", salvarSrt("precos.srt", blocosParaSrt(precos))));
  }
  registrar("");
  for (const c of caminhos) registrar(`gerado: ${c}`);

  try {
    await comLimite("importar", importarArquivos(caminhos));
    registrar("");
    registrar("importados no painel Projeto");
  } catch (erro) {
    const msg = erro instanceof Error ? erro.message : String(erro);
    registrar(`importacao automatica falhou (${msg})`);
    registrar("Importar na mao: Arquivo > Importar, escolher os arquivos acima");
  }

  // Levar o .srt a timeline por codigo nao existe (E7c falhou; API_PROOFS).
  registrar("");
  registrar("AGORA, NO PREMIERE (2 arrastos + 2 estilos, e o minimo que a API permite):");
  registrar("  1. Arrastar legendas.srt do painel Projeto para a timeline");
  registrar("  2. Arrastar precos.srt na area vazia ACIMA da faixa criada");
  registrar("  3. Estilo Pro-Captions (96) na faixa de texto");
  registrar("  4. Estilo Pro-Captions Preco (150) na faixa de preco");
  estado(revisar.length > 0 ? `${revisar.length} para revisar` : "pronto");
}

async function restaurar(): Promise<void> {
  const clipes = await comLimite("clipes", lerClipes(0));
  const midias = [...new Set(clipes.map((c) => c.sourceName))];
  let feitas = 0;

  for (const midia of midias) {
    const original = await comLimite("backup", lerBackup(midia));
    if (original === null) {
      registrar(`${midia}: sem backup guardado`);
      continue;
    }
    await comLimite("escrita", escreverTranscricao(midia, original));
    registrar(`${midia}: transcricao original restaurada`);
    feitas++;
  }

  registrar("");
  // Numero zero tambem se escreve: silencio e indistinguivel de coisa quebrada.
  registrar(`${feitas} de ${midias.length} midia(s) restaurada(s)`);
  estado(feitas > 0 ? "restaurado" : "nada a restaurar");
}

export function mount(root: HTMLElement): void {
  linhas = [];

  // Antes de qualquer await: se o I/O pendurar, os botoes ja estao ligados.
  estado("pronto");
  registrar("painel carregado");
  elemento("gerar").addEventListener("click", () => void comLog("gerar legendas", gerar));
  elemento("restaurar").addEventListener("click", () => void comLog("restaurar original", restaurar));
}
