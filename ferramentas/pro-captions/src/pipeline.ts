/*
 * A cadeia inteira, num lugar so: palavras do corte final entram, blocos de
 * legenda saem — e depois viram transcript pronto para escrever no clipe.
 *
 * Puro: nao conhece o Premiere, nao faz I/O. E o que permite testar o produto
 * todo sem abrir o aplicativo, que e a unica forma viavel de iterar quando
 * cada alteracao custa um reinicio.
 */

import { PRESET_PADRAO, type Preset } from "./preset.ts";
import { segmentar, type BlocoLegenda } from "./segmentar.ts";
import {
  corrigirEAcento,
  corrigirPorques,
  deTranscricao,
  normalizarColoquial,
  protegerTermos,
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
export function gerarBlocos(
  palavras: readonly PalavraEditada[],
  cortes: readonly number[],
  preset: Preset = PRESET_PADRAO
): BlocoLegenda[] {
  let ps = deTranscricao(palavras);
  ps = protegerTermos(ps, preset);
  ps = normalizarColoquial(ps);
  if (!preset.confiarNoAcento) ps = corrigirEAcento(ps);
  ps = corrigirPorques(ps);
  return segmentar(ps, cortes, preset);
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

