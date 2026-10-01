/*
 * Acabamento: a sequencia com B-roll entra, a versao de entrega sai.
 *
 *   - fim de cada variacao: B-roll que passa do fim do doutor e aparado;
 *   - Auto Split (opcional): cada B-roll na caixa de baixo, com o enquadramento
 *     do perfil de cada arquivo (regra de src/autosplit.ts da raiz), e o
 *     doutor em pe subindo enquanto o B-roll esta na tela;
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
  descerPessoaPosY,
  enquadrarEmCima,
  FEATHER_PCT,
  fracaoDivisao,
  nudgeDoutorPosY,
  resolverPerfil,
  type LadoSplit,
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
  /**
   * Doutor e B-roll dividindo a tela. `divisao` e a linha (40..60, em %): onde a
   * caixa de baixo comeca, ou onde a de cima termina com `lado: "cima"`
   * (Menopausa). Lado e feather vem da empresa (SPLIT_DA_EMPRESA).
   */
  readonly split?: {
    readonly divisao: number;
    readonly perfil: Perfil;
    readonly override: OverridePerfil;
    readonly lado?: LadoSplit;
    readonly feather?: number;
  };
  readonly trilha?: { readonly midia: Midia; readonly ganhoDb: number };
}

export interface ResultadoAcabamento {
  readonly sequencia: Sequencia;
  readonly variacoes: number;
  readonly aparados: number;
  readonly enquadrados: number;
  /** Trechos do doutor em pe que subiram por baixo do B-roll. */
  readonly subidos: number;
  readonly avisos: string[];
}

const nomeDe = (c: string): string => c.split(/[\\/]/).pop() ?? c;

/** Trechos de [ini, fim) com B-roll na tela; B-rolls colados viram um trecho so. */
function cobertura(brolls: readonly Clipe[], ini: number, fim: number): Array<[number, number]> {
  const saida: Array<[number, number]> = [];
  for (const b of [...brolls].sort((x, y) => x.inicioQ - y.inicioQ)) {
    const a = Math.max(b.inicioQ, ini);
    const z = Math.min(b.fimQ, fim);
    if (a >= z) continue;
    const ultimo = saida[saida.length - 1];
    if (ultimo !== undefined && a <= ultimo[1]) ultimo[1] = Math.max(ultimo[1], z);
    else saida.push([a, z]);
  }
  return saida;
}

/**
 * Corta o clipe nos quadros de `cortes` que caem dentro dele. Cada pedaco ganha
 * grupo proprio, numerado pelos cortes da lista inteira: o video e o audio do
 * mesmo par caem no mesmo numero e continuam vinculados.
 */
function picotar(c: Clipe, cortes: readonly number[]): Clipe[] {
  const bordas = [c.inicioQ, ...cortes.filter((q) => q > c.inicioQ && q < c.fimQ), c.fimQ];
  return bordas.slice(1).map((fimQ, i) => {
    const inicioQ = bordas[i]!;
    return {
      ...c,
      inicioQ,
      fimQ,
      entradaQ: c.entradaQ + (inicioQ - c.inicioQ),
      ...(c.grupo !== undefined ? { grupo: `${c.grupo}.${cortes.filter((q) => q <= inicioQ).length}` } : {}),
    };
  });
}

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
        const e =
          s.lado === "cima"
            ? enquadrarEmCima(entrada.largura, entrada.altura, w, h, fracaoDivisao(s.divisao))
            : calcularEnquadramento({
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
        const pct = (v: number): number => Math.round(v * 100) / 100;
        return {
          ...c,
          escala: pct(e.escalaPct),
          deslocamento: { x: Math.round(e.posX - entrada.largura / 2), y: Math.round(e.posY - entrada.altura / 2) },
          recorte: { esquerda: 0, direita: 0, topo: pct(e.cropTopoPct), base: pct(e.cropBasePct ?? 0), suavizar: s.feather ?? FEATHER_PCT },
        };
      });

  // 3. Doutor em pe sobe enquanto o B-roll esta na tela (nudgeDoutorPosY).
  // So o trecho coberto: a tela cheia subida abre tarja preta embaixo, e so o
  // B-roll esconde. Por isso a V1 e cortada nas bordas do B-roll, com o audio
  // vinculado junto. Deitada fica como esta: la a posicao muda com o trecho e
  // continua na mao do Leo (docs/PERFIS_DE_EDICAO.md).
  let subidos = 0;
  let v1Final: readonly Clipe[] = v1;
  let audio = entrada.audio;
  if (opcoes.split) {
    const cortesDoGrupo = new Map<string, number[]>();
    v1Final = v1.flatMap((c) => {
      const { largura: w, altura: h } = c.midia;
      if (w === undefined || h === undefined || h < w) return [c];
      const cobertos = cobertura(v2, c.inicioQ, c.fimQ);
      if (cobertos.length === 0) return [c];
      const cortes = [...new Set(cobertos.flat())].filter((q) => q > c.inicioQ && q < c.fimQ).sort((a, b) => a - b);
      if (c.grupo !== undefined) cortesDoGrupo.set(c.grupo, cortes);
      const doutor = { H: entrada.altura, hDoc: h, escalaDocPct: c.escala ?? 100 };
      const s = opcoes.split!;
      // B-roll em cima (Menopausa): a pessoa desce ate a borda dele; embaixo (Andro): o doutor sobe.
      const novoY = s.lado === "cima" ? descerPessoaPosY({ ...doutor, fimFrac: fracaoDivisao(s.divisao) }) : nudgeDoutorPosY(doutor);
      const y = Math.round(novoY - entrada.altura / 2);
      return picotar(c, cortes).map((p) => {
        if (!cobertos.some(([a, z]) => p.inicioQ >= a && p.fimQ <= z)) return p;
        subidos++;
        return { ...p, deslocamento: { x: c.deslocamento?.x ?? 0, y } };
      });
    });
    audio = entrada.audio.map((t) =>
      t.flatMap((c) => {
        const cortes = c.grupo === undefined ? undefined : cortesDoGrupo.get(c.grupo);
        return cortes === undefined ? [c] : picotar(c, cortes);
      })
    );
  }

  // 4. Trilha: uma por variacao, do comeco do arquivo, repetindo se a musica
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
      video: [v1Final, v2, ...entrada.video.slice(2)],
      audio: opcoes.trilha ? [...audio, trilha] : audio,
    },
    variacoes: vars.length,
    aparados,
    enquadrados,
    subidos,
    avisos,
  };
}
