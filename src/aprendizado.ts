/*
 * Aprendizado por sobrevivencia: o usuario "treina" o plugin editando normalmente.
 *
 * O plugin guarda o plano que inseriu. Na analise seguinte le a faixa de destino
 * e compara: B-roll que continua la foi acerto, o que sumiu foi erro. Com isso
 * ajusta o peso de cada par conceito-palavra.
 *
 * Sem modelo, sem nuvem, sem nota do usuario — so contagem. O sinal ja existe na
 * timeline; bastava olhar.
 *
 * Puro: nao conhece o Premiere, nao faz I/O.
 */

/** Quanto cada acerto ou erro move o peso do par. */
const PASSO = 0.15;
/** Limites do fator. Nem o aprendizado apaga um conceito, nem promove lixo. */
const FATOR_MINIMO = 0.5;
const FATOR_MAXIMO = 1.5;

export interface Saldo {
  readonly acertos: number;
  readonly erros: number;
}

/** Contagem por par conceito-palavra. Chave: `conceito|termo`. */
export interface Memoria {
  readonly schema: 1;
  readonly pares: Readonly<Record<string, Saldo>>;
}

export const MEMORIA_VAZIA: Memoria = { schema: 1, pares: {} };

/** O que foi inserido e ainda nao foi julgado pelo usuario. */
export interface PlanoPendente {
  readonly quando: string;
  readonly itens: readonly {
    readonly arquivo: string;
    readonly conceito: string;
    readonly termosCasados: readonly string[];
  }[];
}

/**
 * Um pendente por sequencia. Analisar a sequencia B nao pode jogar fora o
 * julgamento ainda nao lido da sequencia A.
 */
export interface Pendentes {
  readonly schema: 1;
  readonly porSequencia: Readonly<Record<string, PlanoPendente>>;
}

export const PENDENTES_VAZIO: Pendentes = { schema: 1, porSequencia: {} };

export function chave(conceito: string, termo: string): string {
  return `${conceito}|${termo}`;
}

/**
 * Multiplicador do score de uma sugestao, vindo do historico.
 *
 * Media dos pares: um par ainda desconhecido vale 1 e apenas dilui, entao o
 * ajuste cresce com a evidencia em vez de saltar no primeiro caso.
 */
export function fator(memoria: Memoria, conceito: string, termos: readonly string[]): number {
  if (termos.length === 0) return 1;
  let soma = 0;
  for (const termo of termos) {
    const saldo = memoria.pares[chave(conceito, termo)];
    const bruto = saldo === undefined ? 1 : 1 + PASSO * (saldo.acertos - saldo.erros);
    soma += Math.min(FATOR_MAXIMO, Math.max(FATOR_MINIMO, bruto));
  }
  return soma / termos.length;
}

export interface Aprendizado {
  readonly memoria: Memoria;
  readonly acertos: number;
  readonly erros: number;
}

/**
 * Compara o plano inserido com o que sobrou na faixa e devolve a memoria nova.
 *
 * `sobreviventes` sao os nomes de arquivo ainda presentes na faixa de destino.
 * Comparar por nome basta: o planejador nunca repete um arquivo na mesma
 * sequencia.
 */
export function aprender(
  memoria: Memoria,
  pendente: PlanoPendente,
  sobreviventes: ReadonlySet<string>
): Aprendizado {
  const pares: Record<string, Saldo> = { ...memoria.pares };
  let acertos = 0;
  let erros = 0;

  for (const item of pendente.itens) {
    const sobreviveu = sobreviventes.has(item.arquivo);
    if (sobreviveu) acertos++;
    else erros++;

    for (const termo of item.termosCasados) {
      const k = chave(item.conceito, termo);
      const atual = pares[k] ?? { acertos: 0, erros: 0 };
      pares[k] = {
        acertos: atual.acertos + (sobreviveu ? 1 : 0),
        erros: atual.erros + (sobreviveu ? 0 : 1),
      };
    }
  }

  return { memoria: { schema: 1, pares }, acertos, erros };
}

/** Grava (ou remove, com `null`) o pendente de uma sequencia. */
export function comPendente(
  pendentes: Pendentes,
  sequencia: string,
  plano: PlanoPendente | null
): Pendentes {
  const porSequencia = { ...pendentes.porSequencia };
  if (plano === null) delete porSequencia[sequencia];
  else porSequencia[sequencia] = plano;
  return { schema: 1, porSequencia };
}

// ------------------------------------------------------------- persistencia

/**
 * Valida o que veio do disco. Arquivo corrompido volta vazio em vez de lancar:
 * perder o historico e ruim, derrubar a analise por causa dele e pior.
 */
export function parseMemoria(raw: unknown): Memoria {
  const pares: Record<string, Saldo> = {};
  for (const [k, v] of entradas(raw, "pares")) {
    const o = v as Record<string, unknown>;
    const acertos = naoNegativo(o.acertos);
    const erros = naoNegativo(o.erros);
    if (acertos !== null && erros !== null) pares[k] = { acertos, erros };
  }
  return { schema: 1, pares };
}

export function parsePendentes(raw: unknown): Pendentes {
  const porSequencia: Record<string, PlanoPendente> = {};
  for (const [k, v] of entradas(raw, "porSequencia")) {
    const o = v as Record<string, unknown>;
    if (!Array.isArray(o.itens)) continue;
    const itens: PlanoPendente["itens"][number][] = [];
    for (const cru of o.itens as unknown[]) {
      if (typeof cru !== "object" || cru === null) continue;
      const i = cru as Record<string, unknown>;
      if (typeof i.arquivo !== "string" || typeof i.conceito !== "string") continue;
      itens.push({
        arquivo: i.arquivo,
        conceito: i.conceito,
        termosCasados: Array.isArray(i.termosCasados)
          ? (i.termosCasados as unknown[]).filter((t): t is string => typeof t === "string")
          : [],
      });
    }
    porSequencia[k] = { quando: typeof o.quando === "string" ? o.quando : "", itens };
  }
  return { schema: 1, porSequencia };
}

function entradas(raw: unknown, campo: string): Array<[string, Record<string, unknown>]> {
  if (typeof raw !== "object" || raw === null) return [];
  const mapa = (raw as Record<string, unknown>)[campo];
  if (typeof mapa !== "object" || mapa === null) return [];
  return Object.entries(mapa).filter(
    (par): par is [string, Record<string, unknown>] =>
      typeof par[1] === "object" && par[1] !== null
  );
}

function naoNegativo(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) && v >= 0 ? Math.floor(v) : null;
}
