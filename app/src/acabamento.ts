/*
 * Acabamento: a sequencia com B-roll entra, a versao de entrega sai.
 *
 *   - fim de cada variacao: B-roll que passa do fim do doutor e aparado;
 *   - Auto Split (opcional): cada B-roll na caixa de baixo, com o enquadramento
 *     do perfil de cada arquivo (regra de src/autosplit.ts da raiz);
 *   - trilha (opcional): a musica embaixo de cada variacao, terminando junto
 *     com o doutor.
 *
 * Uma variacao e um trecho continuo da V1: o espaco que o Leo deixa entre os
 * videos (e que o Auto Pausas preserva) e a separacao.
 *
 * Puro.
 */

import {
  calcularEnquadramento,
  FEATHER_PCT,
  fracaoDivisao,
  resolverPerfil,
  type OverridePerfil,
  type Perfil,
} from "../../src/autosplit.ts";
import type { Clipe, Midia, Sequencia } from "./xml.ts";

export interface Variacao {
  readonly inicioQ: number;
  readonly fimQ: number;
}

/** Buraco na V1 a partir disto separa duas variacoes. */
export const SEPARACAO_S = 1;

export function variacoes(v1: readonly Clipe[], fps: number): Variacao[] {
  const saida: Variacao[] = [];
  for (const c of [...v1].sort((a, b) => a.inicioQ - b.inicioQ)) {
    const ultima = saida[saida.length - 1];
    if (ultima !== undefined && c.inicioQ - ultima.fimQ < SEPARACAO_S * fps) {
      saida[saida.length - 1] = { inicioQ: ultima.inicioQ, fimQ: Math.max(ultima.fimQ, c.fimQ) };
    } else {
      saida.push({ inicioQ: c.inicioQ, fimQ: c.fimQ });
    }
  }
  return saida;
}

export interface OpcoesAcabamento {
  /** Doutor em cima, B-roll embaixo. `divisao` e onde a caixa de baixo comeca (40..60, em %). */
  readonly split?: { readonly divisao: number; readonly perfil: Perfil; readonly override: OverridePerfil };
  readonly trilha?: { readonly midia: Midia; readonly ganhoDb: number };
}

export interface ResultadoAcabamento {
  readonly sequencia: Sequencia;
  readonly variacoes: number;
  readonly aparados: number;
  readonly enquadrados: number;
  readonly avisos: string[];
}

const nomeDe = (c: string): string => c.split(/[\\/]/).pop() ?? c;

export function acabar(entrada: Sequencia, opcoes: OpcoesAcabamento): ResultadoAcabamento {
  const { fps } = entrada;
  const v1 = entrada.video[0] ?? [];
  const vars = variacoes(v1, fps);
  const avisos: string[] = [];
  if (vars.length === 0) throw new Error("A V1 está vazia: não há variação para acabar.");
  const daVariacao = (q: number): Variacao | undefined => vars.find((v) => q >= v.inicioQ && q < v.fimQ);

  // 1. B-roll termina junto com o doutor.
  let aparados = 0;
  const brolls: Clipe[] = [];
  for (const c of entrada.video[1] ?? []) {
    const v = daVariacao(c.inicioQ);
    if (v === undefined) {
      avisos.push(`${nomeDe(c.midia.caminho)} começa fora de qualquer variação — saiu`);
      continue;
    }
    if (c.fimQ > v.fimQ) {
      aparados++;
      brolls.push({ ...c, fimQ: v.fimQ });
    } else {
      brolls.push(c);
    }
  }

  // 2. Auto Split.
  let enquadrados = 0;
  const v2 = !opcoes.split
    ? brolls
    : brolls.map((c) => {
        const { largura: w, altura: h } = c.midia;
        if (w === undefined || h === undefined) return c;
        const s = opcoes.split!;
        const nome = nomeDe(c.midia.caminho);
        const p = resolverPerfil(s.perfil, s.override, nome, h >= w ? "retrato" : "paisagem");
        const e = calcularEnquadramento({
          W: entrada.largura,
          H: entrada.altura,
          brollTopoFrac: fracaoDivisao(s.divisao),
          w,
          h,
          ancoraY: p.ancoraY,
          assunto: p.assunto,
          cropTopoExtra: p.cropTopoExtra,
        });
        enquadrados++;
        return {
          ...c,
          escala: Math.round(e.escalaPct * 100) / 100,
          deslocamento: { x: Math.round(e.posX - entrada.largura / 2), y: Math.round(e.posY - entrada.altura / 2) },
          recorte: { esquerda: 0, direita: 0, topo: Math.round(e.cropTopoPct * 100) / 100, base: 0, suavizar: FEATHER_PCT },
        };
      });

  // 3. Trilha: uma por variacao, do comeco do arquivo, repetindo se a musica
  // for mais curta que o video, cortada no fim do doutor.
  const trilha: Clipe[] = [];
  if (opcoes.trilha) {
    const { midia, ganhoDb } = opcoes.trilha;
    if (midia.duracaoQ <= 0) throw new Error(`${nomeDe(midia.caminho)} não tem duração legível.`);
    for (const v of vars) {
      for (let t = v.inicioQ; t < v.fimQ; t += midia.duracaoQ) {
        trilha.push({ midia, inicioQ: t, fimQ: Math.min(t + midia.duracaoQ, v.fimQ), entradaQ: 0, ganhoDb });
      }
    }
  }

  return {
    sequencia: {
      ...entrada,
      nome: `${entrada.nome} final`,
      video: [v1, v2, ...entrada.video.slice(2)],
      audio: opcoes.trilha ? [...entrada.audio, trilha] : entrada.audio,
    },
    variacoes: vars.length,
    aparados,
    enquadrados,
    avisos,
  };
}
