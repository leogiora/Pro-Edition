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

import { relogio } from "./domain.ts";
import { estaNaFrase, termos, type Conceito } from "./match.ts";
import type { Frase } from "./transcript.ts";

/** Quanto cada acerto ou erro move o peso do par. */
const PASSO = 0.15;
/** Limites do fator. Nem o aprendizado apaga um conceito, nem promove lixo. */
const FATOR_MINIMO = 0.5;
const FATOR_MAXIMO = 1.5;

export interface Saldo {
  readonly acertos: number;
  readonly erros: number;
}

/**
 * Duas contagens, com papeis diferentes:
 *
 * - `pares` (`conceito|termo`) responde *se* o conceito devia ter sido sugerido.
 * - `arquivos` (nome do arquivo) responde *qual take* daquele conceito serve.
 *
 * Apagar um B-roll quase nunca quer dizer "esse assunto nao cabe aqui"; quer
 * dizer "esse plano especifico nao serviu". Sem a segunda contagem, o unico
 * caminho era enfraquecer o conceito inteiro — e o mesmo arquivo voltava
 * mesmo assim, porque uma exclusao so nao derruba um casamento forte.
 */
export interface Memoria {
  readonly schema: 3;
  readonly pares: Readonly<Record<string, Saldo>>;
  readonly arquivos: Readonly<Record<string, Saldo>>;
  /**
   * Colocacoes feitas a mao que ja foram creditadas.
   *
   * Um B-roll que o usuario colocou fica na timeline para sempre: sem esta
   * marca, toda analise o creditaria de novo. Mesma disciplina do plano
   * pendente, que sai da lista na rodada em que e contado.
   *
   * ponytail: cresce sem limite. Sao dezenas de chaves curtas — podar so quando
   * houver arquivo grande de verdade.
   */
  readonly vistos: Readonly<Record<string, true>>;
}

export const MEMORIA_VAZIA: Memoria = { schema: 3, pares: {}, arquivos: {}, vistos: {} };

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
  const arquivos: Record<string, Saldo> = { ...memoria.arquivos };
  let acertos = 0;
  let erros = 0;

  for (const item of pendente.itens) {
    const sobreviveu = sobreviventes.has(item.arquivo);
    if (sobreviveu) acertos++;
    else erros++;

    somar(arquivos, item.arquivo, sobreviveu);
    for (const termo of item.termosCasados) somar(pares, chave(item.conceito, termo), sobreviveu);
  }

  return { memoria: { ...memoria, schema: 3, pares, arquivos }, acertos, erros };
}

/** Soma um acerto ou um erro numa das contagens. */
function somar(mapa: Record<string, Saldo>, k: string, sobreviveu: boolean): void {
  const atual = mapa[k] ?? { acertos: 0, erros: 0 };
  mapa[k] = {
    acertos: atual.acertos + (sobreviveu ? 1 : 0),
    erros: atual.erros + (sobreviveu ? 0 : 1),
  };
}

/** Um B-roll que estava na faixa sem ter sido posto pelo plugin. */
export interface ColocacaoManual {
  readonly arquivo: string;
  /** Onde ele comeca na sequencia, em segundos. */
  readonly inicio: number;
}

export interface CreditoManual {
  readonly memoria: Memoria;
  readonly creditados: number;
  /**
   * Escolhas que nenhum termo explica.
   *
   * Nao ha o que contar: o usuario ligou duas coisas que o dicionario nao liga.
   * Contagem ajusta peso, nao inventa ligacao (D-016) — entao isto sai como
   * sugestao para uma pessoa decidir, e e material direto para o dicionario
   * de sinonimos.
   */
  readonly semLigacao: readonly string[];
}

/**
 * Tolerancia ao procurar a frase de uma colocacao manual.
 *
 * Um corte costuma entrar um pouco ANTES da palavra — o proprio planejador usa
 * 0,3s de antecipacao. Sem folga, um B-roll bem colocado cairia no vao entre
 * duas frases e nao ensinaria nada.
 */
const FOLGA_DA_FRASE = 0.5;

/**
 * Credita o que o usuario colocou por conta propria.
 *
 * E o sinal mais forte que existe: apagar diz "isto nao serviu", colocar diz
 * "era isto que faltava", com arquivo e instante. So que ele nao vem rotulado —
 * e preciso descobrir o que estava sendo dito ali e quais termos ligam a fala ao
 * conceito escolhido. Quando nenhum liga, nao ha o que contar: vira sugestao.
 *
 * Puro, e por isso testavel sem Premiere: recebe o que ja foi lido da timeline.
 */
export function creditarManuais(
  memoria: Memoria,
  sequencia: string,
  manuais: readonly ColocacaoManual[],
  frases: readonly Frase[],
  conceitos: readonly Conceito[]
): CreditoManual {
  const pares: Record<string, Saldo> = { ...memoria.pares };
  const arquivos: Record<string, Saldo> = { ...memoria.arquivos };
  const vistos: Record<string, true> = { ...memoria.vistos };
  const semLigacao: string[] = [];
  let creditados = 0;

  for (const manual of manuais) {
    const conceito = conceitos.find((c) => c.arquivos.includes(manual.arquivo));
    // Arquivo que nao esta na biblioteca conhecida: nao da para dizer de que
    // conceito ele e, e chutar seria pior que ignorar.
    if (conceito === undefined) continue;

    const frase = frases.find(
      (f) => manual.inicio >= f.inicio - FOLGA_DA_FRASE && manual.inicio < f.fim
    );
    // B-roll sobre silencio nao ensina nada: nao ha fala para ligar a ele.
    if (frase === undefined) continue;

    const casados = conceito.termos.filter((t) => estaNaFrase(t, termos(frase.texto)));

    if (casados.length === 0) {
      // De proposito NAO entra em `vistos`: enquanto faltar a ligacao, a
      // sugestao reaparece. No dia em que o sinonimo existir, isto vira credito.
      semLigacao.push(
        `${relogio(manual.inicio)} voce colocou "${conceito.rotulo}" onde se diz "${frase.texto.slice(0, 60)}" — nenhum termo liga os dois. Falta sinonimo?`
      );
      continue;
    }

    const marca = `${sequencia}|${manual.arquivo}|${Math.round(manual.inicio)}`;
    if (vistos[marca] === true) continue;
    vistos[marca] = true;

    creditados++;
    somar(arquivos, manual.arquivo, true);
    for (const termo of casados) somar(pares, chave(conceito.rotulo, termo), true);
  }

  return { memoria: { schema: 3, pares, arquivos, vistos }, creditados, semLigacao };
}

/**
 * Qual take do conceito usar, entre os ainda disponiveis.
 *
 * O que o usuario apagou cede a vez a outra variacao do mesmo conceito. Sem
 * historico todos empatam em zero e vence o primeiro — entao a escolha continua
 * deterministica e a ordem original e preservada no empate.
 *
 * Nunca devolve nada fora da lista: se todas as variacoes apanharam, ainda assim
 * escolhe a menos pior. Deixar o conceito de fora e trabalho do score, nao daqui.
 */
export function melhorArquivo(memoria: Memoria, arquivos: readonly string[]): string | undefined {
  let escolhido: string | undefined;
  let melhor = Number.NEGATIVE_INFINITY;
  for (const arquivo of arquivos) {
    const saldo = memoria.arquivos[arquivo];
    const valor = saldo === undefined ? 0 : saldo.acertos - saldo.erros;
    if (valor > melhor) {
      melhor = valor;
      escolhido = arquivo;
    }
  }
  return escolhido;
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
 *
 * Le o schema 1 sem caso especial: la nao havia contagem por arquivo, e a
 * ausencia ja significa "nenhum dado ainda", que e a verdade. O historico de
 * conceitos sobrevive a atualizacao.
 */
export function parseMemoria(raw: unknown): Memoria {
  const vistos: Record<string, true> = {};
  if (typeof raw === "object" && raw !== null) {
    const bruto = (raw as Record<string, unknown>).vistos;
    if (typeof bruto === "object" && bruto !== null) {
      for (const k of Object.keys(bruto)) vistos[k] = true;
    }
  }
  return { schema: 3, pares: saldos(raw, "pares"), arquivos: saldos(raw, "arquivos"), vistos };
}

function saldos(raw: unknown, campo: string): Record<string, Saldo> {
  const mapa: Record<string, Saldo> = {};
  for (const [k, v] of entradas(raw, campo)) {
    const acertos = naoNegativo(v.acertos);
    const erros = naoNegativo(v.erros);
    if (acertos !== null && erros !== null) mapa[k] = { acertos, erros };
  }
  return mapa;
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
