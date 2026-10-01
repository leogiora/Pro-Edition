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

/** Um item da timeline, em segundos desde o inicio da variacao. */
export interface Trecho {
  readonly de: number;
  readonly ate: number;
  /** Conceito do B-roll ou texto da legenda. */
  readonly nome?: string;
  readonly preco?: boolean;
}

/** O que o painel mostra de cada variacao: a timeline dela e os avisos. */
export interface ResumoVariacao {
  readonly duracaoS: number;
  /** Duracao antes do Auto Pausas; null quando o corte mudou o numero de variacoes. */
  readonly antesS: number | null;
  readonly clipes: readonly Trecho[];
  readonly brolls: readonly Trecho[];
  readonly leaks: readonly Trecho[];
  readonly legendas: readonly Trecho[];
  readonly trilha: boolean;
  /** A fala da variacao, palavra por palavra (nome = texto). */
  readonly palavras: readonly Trecho[];
  /** Segundos (do inicio da variacao) onde a fala acaba cedo; 0 = sem fala; null = ok ou sem transcricao. */
  readonly falaSomeEmS: number | null;
}

type Item = { readonly inicio: number; readonly fim: number };

/** Tudo em segundos da sequencia; cada item vai para a variacao onde comeca. */
export function resumoPorVariacao(
  vars: readonly Variacao[],
  antes: readonly Variacao[],
  fps: number,
  feito: {
    readonly clipes: readonly Item[];
    readonly brolls: ReadonlyArray<Item & { readonly nome: string }>;
    readonly leaks: readonly number[];
    readonly blocos: ReadonlyArray<Item & { readonly texto: string; readonly estilo: string }>;
    readonly palavras: ReadonlyArray<Item & { readonly text: string }>;
    /** Variacoes que tem musica na faixa da trilha. */
    readonly trilha: readonly Variacao[];
  }
): ResumoVariacao[] {
  return vars.map((v, i) => {
    const ini = v.inicioQ / fps;
    const fim = v.fimQ / fps;
    const dentro = (t: number): boolean => t >= ini && t < fim;
    const trecho = (de: number, ate: number): Trecho => ({ de: de - ini, ate: Math.min(ate, fim) - ini });
    const fala = feito.palavras.filter((p) => dentro(p.inicio));
    const ultima = Math.max(ini, ...fala.map((p) => p.fim));
    const a = antes.length === vars.length ? antes[i]! : null;
    return {
      duracaoS: fim - ini,
      antesS: a ? (a.fimQ - a.inicioQ) / fps : null,
      clipes: feito.clipes.filter((c) => dentro(c.inicio)).map((c) => trecho(c.inicio, c.fim)),
      brolls: feito.brolls.filter((b) => dentro(b.inicio)).map((b) => ({ ...trecho(b.inicio, b.fim), nome: b.nome })),
      leaks: feito.leaks.filter(dentro).map((t) => trecho(t, t + LEAK_S)),
      legendas: feito.blocos
        .filter((b) => dentro(b.inicio))
        .map((b) => ({ ...trecho(b.inicio, b.fim), nome: b.texto, preco: b.estilo === "preco" })),
      trilha: feito.trilha.some((t) => t.inicioQ < v.fimQ && v.inicioQ < t.fimQ),
      palavras: fala.map((p) => ({ ...trecho(p.inicio, p.fim), nome: p.text })),
      falaSomeEmS: feito.palavras.length === 0 || fim - ultima <= FALA_SOME_S ? null : ultima - ini,
    };
  });
}

/** Uma palavra da aba Fala, com o que a edicao fez em volta dela. */
export interface PalavraMarcada {
  readonly de: number;
  readonly texto: string;
  /** Conceito do B-roll que COMECA nesta palavra. */
  readonly broll?: string;
  /** Debaixo de um B-roll. */
  readonly coberta: boolean;
  /** Dentro de uma legenda de preco. */
  readonly preco: boolean;
  /** Comeca uma legenda nova (a palavra anterior ficou em outra). */
  readonly quebra: boolean;
  /** A imagem corta logo antes (pausa tirada ou corte do Leo). */
  readonly corte: boolean;
}

const dentroDe = (t: number, x: Trecho): boolean => t >= x.de && t < x.ate;

/** A fala da variacao lida como a edicao: cortes, B-roll, quebra de legenda e preco. */
export function marcarFala(r: ResumoVariacao): PalavraMarcada[] {
  const vistos = new Set<Trecho>();
  let blocoAnterior: Trecho | undefined;
  return r.palavras.map((p, i) => {
    const meio = (p.de + p.ate) / 2;
    const b = r.brolls.find((x) => dentroDe(meio, x));
    const novo = b !== undefined && !vistos.has(b);
    if (b) vistos.add(b);
    const bloco = r.legendas.find((l) => dentroDe(meio, l));
    const quebra = i > 0 && bloco !== undefined && bloco !== blocoAnterior;
    if (bloco) blocoAnterior = bloco;
    const antes = r.palavras[i - 1];
    return {
      de: p.de,
      texto: p.nome ?? "",
      ...(novo ? { broll: b!.nome ?? "B-roll" } : {}),
      coberta: b !== undefined,
      preco: bloco?.preco === true,
      quebra,
      corte: antes !== undefined && r.clipes.some((c) => c.de > antes.de && c.de <= p.de),
    };
  });
}

/** Um quadro da aba Quadros: um por pedaco da V1. */
export interface Quadro {
  readonly de: number;
  readonly broll?: string;
  readonly leak: boolean;
  readonly legenda: string;
  readonly preco: boolean;
}

/** O storyboard da variacao: o que esta na tela no meio de cada pedaco do doutor. */
export function quadros(r: ResumoVariacao): Quadro[] {
  return r.clipes.map((c) => {
    const meio = (c.de + c.ate) / 2;
    const b = r.brolls.find((x) => dentroDe(meio, x));
    const leg = r.legendas.find((l) => dentroDe(c.de + 0.05, l)) ?? r.legendas.find((l) => dentroDe(meio, l));
    return {
      de: c.de,
      ...(b ? { broll: b.nome ?? "B-roll" } : {}),
      leak: r.leaks.some((l) => l.de < c.ate && c.de < l.ate),
      legenda: leg?.nome ?? "",
      preco: leg?.preco === true,
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
