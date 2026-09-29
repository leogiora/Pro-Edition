/*
 * A cadeia inteira, num lugar so: palavras do corte final entram, blocos de
 * legenda saem — e depois viram transcript pronto para escrever no clipe.
 *
 * Puro: nao conhece o Premiere, nao faz I/O. E o que permite testar o produto
 * todo sem abrir o aplicativo, que e a unica forma viavel de iterar quando
 * cada alteracao custa um reinicio.
 */

import { detectarPrecos, textoDoPreco, type Preco } from "./preco.ts";
import { PRESET_PADRAO, type Preset } from "./preset.ts";
import { emFrases, montarBloco, segmentar, type BlocoLegenda } from "./segmentar.ts";
import {
  corrigirEAcento,
  corrigirPorques,
  deTranscricao,
  normalizarColoquial,
  nucleo,
  protegerTermos,
  type PalavraRevisada,
} from "./texto.ts";
import type { PalavraEditada } from "./transcript.ts";

/**
 * A ordem importa, e e a da secao 7 da spec.
 *
 * Termos protegidos vem primeiro porque as regras seguintes olham a palavra
 * anterior — corrigir "andro clinic" depois de segmentar seria tarde demais.
 * Os porques vem antes da segmentacao porque a decisao precisa da oracao
 * inteira, que deixa de existir depois que o texto vira blocos.
 */
function revisarTexto(palavras: readonly PalavraEditada[], preset: Preset): PalavraRevisada[] {
  let ps = deTranscricao(palavras);
  ps = protegerTermos(ps, preset);
  ps = normalizarColoquial(ps);
  if (!preset.confiarNoAcento) ps = corrigirEAcento(ps);
  return corrigirPorques(ps);
}

/** Vao a partir do qual a legenda sai da tela: o mesmo que separa variacoes no Editar. */
const VAO_SEM_LEGENDA_S = 1;

export function gerarBlocos(
  palavras: readonly PalavraEditada[],
  cortes: readonly number[],
  preset: Preset = PRESET_PADRAO
): BlocoLegenda[] {
  const blocos = segmentar(revisarTexto(palavras, preset), cortes, preset);
  // A legenda do Leo fica ate a seguinte entrar (1.685 de 1.722 no Andro 19.09);
  // o fim da palavra deixava a tela vazia 0,04-0,28 s e um "H," de 20 ms, menor
  // que um quadro, que o Premiere jogou no 0:00.
  return blocos.map((b, i) => {
    const prox = blocos[i + 1];
    return prox !== undefined && prox.inicio > b.fim && prox.inicio - b.fim < VAO_SEM_LEGENDA_S ? { ...b, fim: prox.inicio } : b;
  });
}

/* ------------------------------------------ blocos do Premiere (hibrido) */

/** Um bloco de legenda como veio de fora: o .srt que o Premiere exporta. */
export interface Cue {
  /** Segundos. */
  readonly inicio: number;
  readonly fim: number;
  readonly texto: string;
}

const segundosSrt = (t: string): number => {
  const [h, m, s] = t.trim().replace(",", ".").split(":");
  return Number(h) * 3600 + Number(m) * 60 + Number(s);
};

/** .srt -> cues. Bloco sem linha de tempo legivel e ignorado. */
export function lerSrt(texto: string): Cue[] {
  const cues: Cue[] = [];
  for (const bloco of texto.replace(/^﻿/, "").replace(/\r/g, "").split(/\n\s*\n/)) {
    const linhas = bloco.split("\n").filter((l) => l.trim() !== "");
    const i = linhas.findIndex((l) => l.includes("-->"));
    if (i < 0) continue;
    const [a, z] = (linhas[i] ?? "").split("-->").map((t) => t.trim().split(/\s+/)[0] ?? "");
    const inicio = segundosSrt(a ?? "");
    const fim = segundosSrt(z ?? "");
    if (!Number.isFinite(inicio) || !Number.isFinite(fim)) continue;
    cues.push({ inicio, fim, texto: linhas.slice(i + 1).join(" ").trim() });
  }
  return cues.sort((x, y) => x.inicio - y.inicio);
}

/**
 * Os blocos do Premiere com as palavras do ElevenLabs.
 *
 * O Leo revisa em cima do corte do Premiere e quase nao mexe nele (95% dos
 * cortes da variacao 1 do Andro 19.09 ficam); a segmentacao daqui repete 74%.
 * O ElevenLabs erra menos palavra (3 contra 7). Entao cada um faz o que faz
 * melhor: o bloco e o tempo sao do Premiere, o texto e o daqui (mesma cadeia
 * de `gerarBlocos`). Medido em `ferramentas/pro-captions/RETOMAR-pro-captions.md`.
 *
 * - A palavra vai para o bloco onde ela comeca; no buraco entre dois, para o
 *   seguinte (o Premiere abre o bloco um pouco depois do som).
 * - O preco e achado na frase inteira ("... 1.000 reais, mas ... 196") e sai
 *   em bloco proprio dentro do bloco do Premiere. Preco partido entre dois
 *   blocos vai inteiro para o primeiro.
 * - Bloco do Premiere onde o ElevenLabs nao ouviu nada fica com o texto do
 *   Premiere, marcado para revisao: sumir com legenda em silencio e pior.
 */
export function blocosNosCortes(
  palavras: readonly PalavraEditada[],
  cues: readonly Cue[],
  preset: Preset = PRESET_PADRAO
): BlocoLegenda[] {
  if (cues.length === 0) return [];
  const ps = revisarTexto(palavras, preset);

  // Onde cada palavra cai.
  const cueDe = ps.map((p) => {
    const dentro = cues.findIndex((c) => p.inicio >= c.inicio && p.inicio < c.fim);
    if (dentro >= 0) return dentro;
    const seguinte = cues.findIndex((c) => c.inicio > p.inicio);
    return seguinte >= 0 ? seguinte : cues.length - 1;
  });

  // Blocos que tinham palavra antes de o preco puxar as dele para tras.
  const tinhaPalavra = new Set(cueDe);

  // Preco por frase, com o indice global da palavra.
  const precoDe = new Map<number, Preco>();
  let base = 0;
  for (const frase of emFrases(ps, preset)) {
    for (const preco of detectarPrecos(frase.map((p) => nucleo(p.text).corpo))) {
      for (let k = preco.inicio; k <= preco.fim; k++) {
        precoDe.set(base + k, preco);
        cueDe[base + k] = cueDe[base + preco.inicio] ?? 0;
      }
    }
    base += frase.length;
  }

  // Bloco vazio por causa do vizinho: o preco puxou as palavras dele, ou uma
  // palavra que comecou antes passa por cima dele (o Premiere partiu "um super"
  // / "homem", o ElevenLabs escreveu "super-homem"). O anterior vai ate o fim
  // dele, sem buraco na tela e sem repetir o texto do Premiere.
  const esvaziado = (c: number): boolean => {
    if (cueDe.includes(c)) return false;
    const cue = cues[c];
    return tinhaPalavra.has(c) || (cue !== undefined && ps.some((p) => p.inicio < cue.inicio && p.fim > cue.inicio));
  };
  const fimDe = (c: number): number => {
    let fim = cues[c]?.fim ?? 0;
    for (let d = c + 1; d < cues.length && esvaziado(d); d++) fim = cues[d]?.fim ?? fim;
    return fim;
  };

  const blocos: BlocoLegenda[] = [];
  cues.forEach((cue, c) => {
    const indices = ps.flatMap((_, k) => (cueDe[k] === c ? [k] : []));
    if (indices.length === 0) {
      if (!esvaziado(c) && cue.texto !== "") {
        blocos.push({ texto: cue.texto, inicio: cue.inicio, fim: cue.fim, estilo: "normal", precisaRevisao: true, motivos: ["o ElevenLabs nao ouviu nada aqui: texto do Premiere"] });
      }
      return;
    }

    // Fatias: texto normal corrido, ou um preco inteiro.
    const fatias: Array<{ palavras: PalavraRevisada[]; preco: Preco | undefined }> = [];
    for (const k of indices) {
      const preco = precoDe.get(k);
      const ultima = fatias[fatias.length - 1];
      const palavra = ps[k];
      if (palavra === undefined) continue;
      if (ultima !== undefined && ultima.preco === preco) ultima.palavras.push(palavra);
      else fatias.push({ palavras: [palavra], preco });
    }

    fatias.forEach((f, i) => {
      const bloco = montarBloco(f.palavras, f.preco === undefined ? "normal" : "preco");
      // O tempo de fora e o do Premiere; por dentro, a fatia seguinte comeca na palavra dela.
      const inicio = i === 0 ? cue.inicio : bloco.inicio;
      const proxima = fatias[i + 1]?.palavras[0];
      const fim = proxima === undefined ? fimDe(c) : proxima.inicio;
      if (f.preco === undefined) {
        // O corte do Premiere nao cai no ponto: no meio do bloco o Leo escreve
        // virgula ("hora H, E ela?"). Abreviacao fica ("Dr. Cristiano").
        const texto = bloco.texto.replace(/(?<!\b(?:Dr|Dra|Sr|Sra|Prof))\.(\s+)(?=\S)/g, ",$1");
        blocos.push({ ...bloco, texto, inicio, fim });
        return;
      }
      blocos.push({
        ...bloco,
        texto: textoDoPreco(f.preco.valor),
        inicio,
        fim,
        precisaRevisao: bloco.precisaRevisao || f.preco.certeza === "media",
        motivos: f.preco.certeza === "media" ? [...bloco.motivos, "contexto monetario incerto"] : bloco.motivos,
      });
    });
  });
  return blocos;
}

// A conversao blocos -> transcript (blocosParaTranscricao) morreu junto com
// a rota destrutiva de escrita no clipe (D-04 -> D-13): o E5 provou que o
// Premiere re-segmenta os segments, entao escrever la nao serve para nada.

/* ----------------------------------------------------- blocos para .srt */

function tempoSrt(segundos: number): string {
  const ms = Math.max(0, Math.round(segundos * 1000));
  const h = Math.floor(ms / 3600000);
  const m = Math.floor((ms % 3600000) / 60000);
  const s = Math.floor((ms % 60000) / 1000);
  const mil = ms % 1000;
  const p = (n: number, d: number): string => String(n).padStart(d, "0");
  return `${p(h, 2)}:${p(m, 2)}:${p(s, 2)},${p(mil, 3)}`;
}

/**
 * Um bloco = um cue. E o plano B que virou plano A: o E5 provou que o
 * "Criar legendas a partir da transcricao" do Premiere re-segmenta os nossos
 * segments (fronteiras migram entre blocos), enquanto a importacao de .srt
 * preserva os cues como estao. Evidencia em docs/API_PROOFS.md, E5.
 */
export function blocosParaSrt(blocos: readonly BlocoLegenda[]): string {
  return blocos
    .map((b, i) => `${i + 1}\n${tempoSrt(b.inicio)} --> ${tempoSrt(b.fim)}\n${b.texto}\n`)
    .join("\n");
}

