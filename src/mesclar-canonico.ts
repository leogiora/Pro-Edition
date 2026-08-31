/*
 * Merge do aprendizado canonico (do dono) com o local (da editora).
 *
 * Baseline-delta: novo = canonico_atual + max(0, local - baseline). O
 * "max(0, ...)" e de proposito — a editora so SOMA sinal, nunca subtrai o do
 * dono, e o decaimento do teto pode deixar `local` numericamente abaixo do
 * `baseline` sem que nada tenha sido desaprendido.
 *
 * Puro: nao le disco, nao conhece o Premiere. A cola de I/O mora em
 * ui/mount.ts.
 */

import {
  aplicarTeto,
  parseAssociacoes,
  parseMemoria,
  type Associacoes,
  type Memoria,
  type Saldo,
} from "./aprendizado.ts";
import { parseSinonimos } from "./match.ts";

export interface CanonicoSnapshot {
  readonly schema: 1;
  readonly version: string;
  readonly aprendizado: {
    readonly pares: Readonly<Record<string, Saldo>>;
    readonly arquivos: Readonly<Record<string, Saldo>>;
  };
  readonly ligacoes: { readonly pares: Readonly<Record<string, number>> };
  readonly sinonimos: ReadonlyMap<string, readonly string[]>;
}

export interface EstadoAprendido {
  readonly memoria: Memoria;
  readonly associacoes: Associacoes;
  readonly sinonimos: ReadonlyMap<string, readonly string[]>;
}

/**
 * Le o snapshot vindo do disco. `null` quando falta `version` ou o formato
 * nao serve — quem chama entao pula o merge e deixa o aprendizado local como
 * esta.
 */
export function parseCanonico(raw: unknown): CanonicoSnapshot | null {
  if (typeof raw !== "object" || raw === null) return null;
  const o = raw as Record<string, unknown>;
  if (typeof o.version !== "string" || o.version.length === 0) return null;

  const memoria = parseMemoria(o.aprendizado); // le .pares e .arquivos; ignora vistos
  const assoc = parseAssociacoes(o.ligacoes); // le .pares
  const sin = parseSinonimos(raw); // le raw.sinonimos

  return {
    schema: 1,
    version: o.version,
    aprendizado: { pares: memoria.pares, arquivos: memoria.arquivos },
    ligacoes: { pares: assoc.pares },
    sinonimos: sin ?? new Map<string, readonly string[]>(),
  };
}

const ZERO: Saldo = { acertos: 0, erros: 0 };

export function mesclarSaldos(
  canonico: Readonly<Record<string, Saldo>>,
  local: Readonly<Record<string, Saldo>>,
  base: Readonly<Record<string, Saldo>>
): Record<string, Saldo> {
  const saida: Record<string, Saldo> = {};
  for (const k of new Set([...Object.keys(canonico), ...Object.keys(local)])) {
    const c = canonico[k] ?? ZERO;
    const l = local[k] ?? ZERO;
    const b = base[k] ?? ZERO;
    // delta travado em 0: a editora so soma sinal, nunca subtrai o do dono.
    const somado = aplicarTeto({
      acertos: c.acertos + Math.max(0, l.acertos - b.acertos),
      erros: c.erros + Math.max(0, l.erros - b.erros),
    });
    // chao no canonico: o merge e mao unica e "melhora" — nunca entrega um par
    // mais fraco do que o dono curou (aplicarTeto pode empurrar a soma para
    // baixo do canonico quando ela passa de 20).
    saida[k] = {
      acertos: Math.max(c.acertos, somado.acertos),
      erros: Math.max(c.erros, somado.erros),
    };
  }
  return saida;
}

export function mesclarContagens(
  canonico: Readonly<Record<string, number>>,
  local: Readonly<Record<string, number>>,
  base: Readonly<Record<string, number>>
): Record<string, number> {
  const saida: Record<string, number> = {};
  for (const k of new Set([...Object.keys(canonico), ...Object.keys(local)])) {
    saida[k] = (canonico[k] ?? 0) + Math.max(0, (local[k] ?? 0) - (base[k] ?? 0));
  }
  return saida;
}

export function mesclarSinonimos(
  canonico: ReadonlyMap<string, readonly string[]>,
  local: ReadonlyMap<string, readonly string[]>
): Map<string, readonly string[]> {
  const saida = new Map<string, readonly string[]>(local);
  for (const [k, v] of canonico) saida.set(k, v);
  return saida;
}

export function aplicarMerge(
  atual: EstadoAprendido,
  canonico: CanonicoSnapshot,
  base: CanonicoSnapshot | null
): EstadoAprendido {
  return {
    memoria: {
      schema: 3,
      pares: mesclarSaldos(
        canonico.aprendizado.pares,
        atual.memoria.pares,
        base?.aprendizado.pares ?? {}
      ),
      arquivos: mesclarSaldos(
        canonico.aprendizado.arquivos,
        atual.memoria.arquivos,
        base?.aprendizado.arquivos ?? {}
      ),
      vistos: atual.memoria.vistos, // NUNCA tocado
    },
    associacoes: {
      schema: 1,
      pares: mesclarContagens(
        canonico.ligacoes.pares,
        atual.associacoes.pares,
        base?.ligacoes.pares ?? {}
      ),
    },
    sinonimos: mesclarSinonimos(canonico.sinonimos, atual.sinonimos),
  };
}
