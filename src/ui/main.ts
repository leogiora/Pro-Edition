/*
 * Painel. Nao chama `premierepro` direto: fala com src/premiere.ts.
 */

import { relogio } from "../domain.ts";
import {
  comLimite,
  escreverTranscricao,
  getSequenceInfo,
  lerClipes,
  lerCortes,
  lerTranscricoes,
  salvarBackup,
} from "../premiere.ts";
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

/**
 * Prova da Fase 0: cinco blocos forcados, curtos, cada um em seu proprio
 * `segment`. Se o Premiere gerar cinco legendas de uma linha, a aposta central
 * do desenho esta certa e o produto inteiro segue por este caminho.
 */
async function provarEscrita(): Promise<void> {
  estado("provando");
  const clipes = await comLimite("clipes", lerClipes(0));
  const primeiro = clipes[0];
  if (!primeiro) throw new Error("V1 vazia: abra uma sequencia editada.");

  const brutas = await comLimite("transcricoes", lerTranscricoes([primeiro.sourceName]), 60000);
  const original = brutas.get(primeiro.sourceName);
  if (!original) throw new Error(`${primeiro.sourceName} nao tem transcricao.`);

  const caminho = await comLimite("backup", salvarBackup(primeiro.sourceName, original));
  registrar(`backup salvo em ${caminho}`);

  const blocos = ["MEU NOME E", "CRISTIANO ESTIVALET", "HOJE TA POR", "197 REAIS", "E OLHA SO"];
  const inicioBase = primeiro.inPointSeconds;

  const forcado = {
    language: "pt-BR",
    segments: blocos.map((texto, i) => {
      const inicio = inicioBase + i * 1.5;
      const partes = texto.split(" ");
      return {
        start: inicio,
        duration: 1.5,
        language: "pt-BR",
        speaker: "0",
        words: partes.map((p, j) => ({
          text: p,
          start: inicio + j * (1.5 / partes.length),
          duration: 1.5 / partes.length,
          confidence: 1,
          eos: j === partes.length - 1,
          tags: [],
          type: "word",
        })),
      };
    }),
  };

  await comLimite("escrita", escreverTranscricao(primeiro.sourceName, JSON.stringify(forcado)));

  registrar("");
  registrar(`escrito em ${primeiro.sourceName}: 5 segments`);
  registrar("agora, no Premiere:");
  registrar("  1. abrir Texto > Transcricao e conferir os 5 blocos");
  registrar("  2. Criar legendas a partir da transcricao");
  registrar("  3. contar quantas legendas sairam e se cada uma tem 1 linha");
  estado("prova escrita");
}

function falhar(e: unknown): void {
  const err = e as Error;
  registrar(`ERRO: ${err?.message ?? String(e)}`);
  estado("erro");
}

// Antes de qualquer await: se o I/O pendurar, o botao ja esta ligado.
estado("pronto");
registrar("painel carregado");
elemento("provar").addEventListener("click", () => {
  void provarEscrita().catch(falhar);
});

void analisar().catch(falhar);
