/*
 * Painel. Nao chama `premierepro` direto: fala com src/premiere.ts.
 */

import { relogio } from "../domain.ts";
import { comLimite, getSequenceInfo, lerClipes, lerCortes, lerTranscricoes } from "../premiere.ts";
import {
  agruparEmFrases,
  parseTranscricao,
  reconstruirTranscricao,
  type TranscricaoOrigem,
} from "../transcript.ts";

const elemento = (id: string): HTMLElement => {
  const el = document.getElementById(id);
  if (!el) throw new Error(`elemento ausente no HTML: ${id}`);
  return el;
};

const linhas: string[] = [];

function registrar(texto: string): void {
  linhas.push(texto);
  elemento("log").textContent = linhas.join("\n");
}

function estado(texto: string): void {
  elemento("estado").textContent = texto;
}

async function analisar(): Promise<void> {
  estado("lendo sequencia");
  const info = await comLimite("sequencia", getSequenceInfo());
  const nome = elemento("seqNome");
  nome.textContent = info.name;
  nome.setAttribute("data-vazio", "nao");
  registrar(`${info.fps.toFixed(4)} fps · ${info.videoTracks} video · ${info.captionTracks} caption`);

  const clipes = await comLimite("clipes", lerClipes(0));
  registrar(`V1: ${clipes.length} clipes`);

  const cortes = await comLimite("cortes", lerCortes(0));
  registrar(`${cortes.length} cortes`);

  estado("lendo transcricao");
  const brutas = await comLimite("transcricoes", lerTranscricoes(clipes.map((c) => c.sourceName)), 60000);
  registrar(`${brutas.size} midias com transcricao`);

  const mapa = new Map<string, TranscricaoOrigem>();
  for (const [midia, json] of brutas) {
    const t = parseTranscricao(json);
    if (t) mapa.set(midia, t);
    else registrar(`transcricao ilegivel: ${midia}`);
  }

  const palavras = reconstruirTranscricao(clipes, mapa);
  const frases = agruparEmFrases(palavras);

  // Resumo por ultimo: o log rola sozinho e so o fim fica visivel.
  registrar("");
  registrar(`${palavras.length} palavras no corte final`);
  registrar(`${frases.length} frases`);
  for (const f of frases.slice(0, 5)) {
    registrar(`  ${relogio(f.inicio)}  ${f.texto.slice(0, 60)}`);
  }
  estado("pronto");
}

// Antes de qualquer await: se o I/O pendurar, isto ja aconteceu.
estado("pronto");
registrar("painel carregado");

void analisar().catch((e: unknown) => {
  const err = e as Error;
  registrar(`ERRO: ${err?.message ?? String(e)}`);
  estado("erro");
});
