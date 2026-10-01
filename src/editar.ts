/*
 * Editar — logica pura do botao que encadeia tudo. Sem DOM, sem Premiere.
 *
 * O botao transcreve a sequencia UMA vez (ElevenLabs, no audio que o proprio
 * painel exporta) e essa fala serve a todas as etapas. Depois que o Auto
 * Pausas corta, a fala precisa acompanhar os pedacos para a legenda e o B-roll
 * cairem no lugar certo — e isso que mora aqui.
 */

import { empresaDe, type Empresa } from "../ferramentas/pro-captions/src/preset.ts";
import type { PalavraEditada } from "../ferramentas/pro-captions/src/transcript.ts";
import type { Pedaco } from "./pausas.ts";

/** Um trecho continuo da V1: o espaco que o Leo deixa entre os videos separa as variacoes. */
export interface Variacao {
  readonly inicioQ: number;
  readonly fimQ: number;
}

/** Buraco na V1 a partir disto separa duas variacoes (os cortes do Auto Pausas sao colados). */
export const SEPARACAO_S = 1;

export function variacoes(clipes: ReadonlyArray<{ readonly inicioQ: number; readonly fimQ: number }>, fps: number): Variacao[] {
  const saida: Variacao[] = [];
  for (const c of [...clipes].sort((a, b) => a.inicioQ - b.inicioQ)) {
    const ultima = saida[saida.length - 1];
    if (ultima !== undefined && c.inicioQ - ultima.fimQ < SEPARACAO_S * fps) {
      saida[saida.length - 1] = { inicioQ: ultima.inicioQ, fimQ: Math.max(ultima.fimQ, c.fimQ) };
    } else {
      saida.push({ inicioQ: c.inicioQ, fimQ: c.fimQ });
    }
  }
  return saida;
}

/**
 * A fala depois do corte. Fica a palavra que COMECA dentro de um pedaco; ela
 * anda junto com ele, e o fim e aparado no fim do pedaco. Tempo em segundos,
 * pedacos em quadros.
 */
export function moverPalavras(palavras: readonly PalavraEditada[], pedacos: readonly Pedaco[], fps: number): PalavraEditada[] {
  const saida: PalavraEditada[] = [];
  for (const p of pedacos) {
    const de = p.origemQ / fps;
    const ate = (p.origemQ + p.midiaAteQ - p.midiaDeQ) / fps;
    const anda = p.destinoQ / fps - de;
    for (const w of palavras) {
      if (w.inicio < de || w.inicio >= ate) continue;
      saida.push({ ...w, inicio: w.inicio + anda, fim: Math.min(w.fim, ate) + anda });
    }
  }
  return saida.sort((a, b) => a.inicio - b.inicio);
}

/** Onde a imagem corta depois do Auto Pausas, em segundos: a legenda evita atravessar. */
export function cortesDosPedacos(pedacos: readonly Pedaco[], fps: number): number[] {
  return pedacos.slice(1).map((p) => p.destinoQ / fps);
}

/**
 * Light leak em cada troca doutor <-> B-roll, como o Leo monta: o leak inteiro
 * (0,84 s no Premiere Composer) comecando 0,36 s antes da borda. Medido nas 79
 * bordas das variacoes 1-6 do Andro 19.09 (29/09): 77 exatas; nenhum leak entre
 * dois B-rolls colados (28 de 28) nem no comeco ou fim da variacao (5 de 5).
 */
export const LEAK_ANTES_S = 0.36;
export const LEAK_S = 0.84;

/**
 * Onde cada leak comeca, em segundos, arredondado para o quadro e em ordem.
 * Pula a borda cujo leak cairia em cima de algo que ja esta em `ocupado` (a
 * faixa do leak): o que o Leo ja pos fica, e rodar duas vezes nao duplica. Dois
 * leaks novos que se encostam entram os dois: inseridos em ordem, o seguinte
 * come o fim do anterior, como o Leo faz (B-roll que sai e outro entrando 0,8 s
 * depois).
 */
export function inicioDosLeaks(
  brolls: ReadonlyArray<{ readonly inicio: number; readonly fim: number }>,
  vars: readonly Variacao[],
  fps: number,
  ocupado: ReadonlyArray<{ readonly inicio: number; readonly fim: number }> = []
): number[] {
  const meioQuadro = 0.5 / fps;
  const perto = (a: number, b: number): boolean => Math.abs(a - b) < meioQuadro;
  const saida: number[] = [];
  for (const x of brolls.flatMap((b) => [b.inicio, b.fim]).sort((a, b) => a - b)) {
    const colada = brolls.filter((b) => perto(b.inicio, x) || perto(b.fim, x)).length > 1;
    const ponta = vars.some((v) => perto(v.inicioQ / fps, x) || perto(v.fimQ / fps, x));
    const inicio = Math.round((x - LEAK_ANTES_S) * fps) / fps;
    const fim = inicio + LEAK_S;
    if (colada || ponta || ocupado.some((o) => inicio < o.fim - meioQuadro && o.inicio < fim - meioQuadro)) continue;
    saida.push(inicio);
  }
  return saida;
}

/**
 * Variacoes que ganham a copia da trilha: as que nao tem musica na faixa. O
 * clone nasce com a duracao do modelo e so depois e aparado no fim da
 * variacao; se ate la cobrir musica que ja esta na faixa, a variacao pula (o
 * overwrite apagaria o que o Leo pos).
 */
export function trilhaFaltando(
  vars: readonly Variacao[],
  fps: number,
  naFaixa: ReadonlyArray<{ readonly inicio: number; readonly fim: number }>,
  duracaoModelo: number
): { entram: Variacao[]; pulam: Variacao[] } {
  const meioQuadro = 0.5 / fps;
  const cruza = (ini: number, fim: number): boolean => naFaixa.some((c) => ini < c.fim - meioQuadro && c.inicio < fim - meioQuadro);
  const entram: Variacao[] = [];
  const pulam: Variacao[] = [];
  for (const v of vars) {
    const ini = v.inicioQ / fps;
    if (cruza(ini, v.fimQ / fps)) continue;
    (cruza(ini, ini + duracaoModelo) ? pulam : entram).push(v);
  }
  return { entram, pulam };
}

/** Fala que acaba isto antes do fim da variacao vira aviso (audio mudo no Andro 19.09, variacoes 11-20). */
export const FALA_SOME_S = 3;

/** O que o painel mostra de cada variacao depois do Editar. */
export interface ResumoVariacao {
  readonly duracaoS: number;
  /** Duracao antes do Auto Pausas; null quando o corte mudou o numero de variacoes. */
  readonly antesS: number | null;
  readonly brolls: number;
  readonly leaks: number;
  readonly legendas: number;
  readonly precos: number;
  /** Segundos (do inicio da variacao) onde a fala acaba cedo; 0 = sem fala; null = ok ou sem transcricao. */
  readonly falaSomeEmS: number | null;
}

export function resumoPorVariacao(
  vars: readonly Variacao[],
  antes: readonly Variacao[],
  fps: number,
  feito: {
    readonly brolls: readonly number[];
    readonly leaks: readonly number[];
    readonly blocos: ReadonlyArray<{ readonly inicio: number; readonly estilo: string }>;
    readonly palavras: ReadonlyArray<{ readonly inicio: number; readonly fim: number }>;
  }
): ResumoVariacao[] {
  return vars.map((v, i) => {
    const ini = v.inicioQ / fps;
    const fim = v.fimQ / fps;
    const dentro = (t: number): boolean => t >= ini && t < fim;
    const fala = feito.palavras.filter((p) => dentro(p.inicio));
    const ultima = Math.max(ini, ...fala.map((p) => p.fim));
    const a = antes.length === vars.length ? antes[i]! : null;
    return {
      duracaoS: fim - ini,
      antesS: a ? (a.fimQ - a.inicioQ) / fps : null,
      brolls: feito.brolls.filter(dentro).length,
      leaks: feito.leaks.filter(dentro).length,
      legendas: feito.blocos.filter((b) => b.estilo !== "preco" && dentro(b.inicio)).length,
      precos: feito.blocos.filter((b) => b.estilo === "preco" && dentro(b.inicio)).length,
      falaSomeEmS: feito.palavras.length === 0 || fim - ultima <= FALA_SOME_S ? null : ultima - ini,
    };
  });
}

/**
 * Perfil de edicao (docs/PERFIS_DE_EDICAO.md): a empresa escolhida no Editar e
 * a pasta de B-roll de cada uma. Fica em `perfil.json`, fora do `config.json`
 * do Auto B-roll, que regrava o dele so com os campos dele.
 */
export interface PerfilEdicao {
  readonly empresa: Empresa;
  readonly bibliotecas: Readonly<Partial<Record<Empresa, string>>>;
}

export function parsePerfil(raw: unknown): PerfilEdicao {
  const b = (raw as { bibliotecas?: unknown } | null)?.bibliotecas;
  const bibliotecas: Partial<Record<Empresa, string>> = {};
  if (typeof b === "object" && b !== null) {
    for (const [k, v] of Object.entries(b)) {
      if (typeof v === "string" && empresaDe({ empresa: k }) === k) bibliotecas[k as Empresa] = v;
    }
  }
  return { empresa: empresaDe(raw), bibliotecas };
}

/** A pasta em uso fica com a empresa que sai; a da que entra volta (vazia se nunca foi escolhida). */
export function trocarEmpresa(p: PerfilEdicao, pastaEmUso: string, nova: Empresa): { perfil: PerfilEdicao; pasta: string } {
  const bibliotecas = pastaEmUso ? { ...p.bibliotecas, [p.empresa]: pastaEmUso } : p.bibliotecas;
  return { perfil: { empresa: nova, bibliotecas }, pasta: bibliotecas[nova] ?? "" };
}

/** B-roll mais curto que isto, depois de aparado no fim do doutor, nem entra. */
export const BROLL_MINIMO_S = 1;

/**
 * B-roll termina junto com o doutor: o que passa do fim da variacao e
 * aparado; o que comeca fora de qualquer variacao (no espaco entre videos) ou
 * sobra curto demais sai, com motivo.
 */
export function dentroDasVariacoes<T extends { readonly inicio: number; readonly duracao: number; readonly arquivo: string }>(
  colocacoes: readonly T[],
  vars: readonly Variacao[],
  fps: number
): { ficam: T[]; aparados: number; fora: string[] } {
  const ficam: T[] = [];
  const fora: string[] = [];
  let aparados = 0;
  for (const c of colocacoes) {
    const v = vars.find((x) => c.inicio * fps >= x.inicioQ && c.inicio * fps < x.fimQ);
    if (v === undefined) {
      fora.push(`${c.arquivo}: cairia no espaço entre vídeos`);
      continue;
    }
    const fim = v.fimQ / fps;
    if (c.inicio + c.duracao <= fim) {
      ficam.push(c);
      continue;
    }
    const duracao = fim - c.inicio;
    if (duracao < BROLL_MINIMO_S) {
      fora.push(`${c.arquivo}: sobraria ${duracao.toFixed(1)} s antes do fim do vídeo`);
      continue;
    }
    aparados++;
    ficam.push({ ...c, duracao });
  }
  return { ficam, aparados, fora };
}
