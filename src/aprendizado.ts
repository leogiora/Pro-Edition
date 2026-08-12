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
    /** Onde entrou na sequencia, em segundos. Ausente em pendente antigo. */
    readonly inicio?: number;
  }[];
  /**
   * Tudo o que o PLUGIN ja pos nesta sequencia, mesmo depois de julgado.
   *
   * Sem esta lista, um B-roll do plugin que sobreviveu ao julgamento vira
   * "colocacao manual" na rodada seguinte — e o painel dizia "voce colocou 7 por
   * conta propria" para sete arquivos que o usuario nunca tocou.
   *
   * COM posicao (D-033): so o nome fazia o caminho inverso — colocacao manual
   * SUA com um arquivo que o plugin ja usou em qualquer rodada era engolida
   * como trabalho do plugin e nunca creditada. Entrada antiga, so-nome
   * (`inicio` ausente), continua valendo por nome.
   *
   * Estado derivado: quem monta um plano nao preenche isto. `comPendente`
   * acumula sozinho, e e ele que garante que a lista nunca se perca.
   */
  readonly postos?: readonly { readonly arquivo: string; readonly inicio?: number }[];
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
 * Comparar por nome tem um limite conhecido: o planejador pode repetir um
 * arquivo quando o conceito nao tem take inedito (secao 8), e nesse caso
 * apagar UMA das copias nao registra erro — o nome continua na faixa. Aceito:
 * quem manteve uma copia manteve o take.
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

/**
 * Acima disto, as duas contagens sao divididas pela metade.
 *
 * Sem teto o historico fossiliza: medido no uso real, um par chegou a 106
 * acertos contra 19 erros, e nesse ponto uma exclusao do usuario nao move mais
 * nada. Dividir os dois lados preserva a proporcao aprendida e devolve peso ao
 * que acabou de acontecer.
 */
const TETO = 20;

/** Soma um acerto ou um erro numa das contagens, com decaimento. */
function somar(mapa: Record<string, Saldo>, k: string, sobreviveu: boolean): void {
  const atual = mapa[k] ?? { acertos: 0, erros: 0 };
  let acertos = atual.acertos + (sobreviveu ? 1 : 0);
  let erros = atual.erros + (sobreviveu ? 0 : 1);

  while (acertos + erros > TETO) {
    acertos = Math.round(acertos / 2);
    erros = Math.round(erros / 2);
  }
  mapa[k] = { acertos, erros };
}

/** Um B-roll que estava na faixa sem ter sido posto pelo plugin. */
export interface ColocacaoManual {
  readonly arquivo: string;
  /** Onde ele comeca na sequencia, em segundos. */
  readonly inicio: number;
  /** Onde termina. E o que define quais palavras ele cobriu. */
  readonly fim: number;
}

export interface CreditoManual {
  readonly memoria: Memoria;
  /** Contagem das palavras cobertas quando o dicionario nao explicava a escolha. */
  readonly associacoes: Associacoes;
  readonly creditados: number;
  /** Ja contado numa analise anterior: nao ha nada de errado, so nada de novo. */
  readonly jaContados: number;
  /**
   * Nao esta na pasta de B-rolls configurada.
   *
   * Nao da para saber de que conceito e, e chutar seria pior que ignorar. Mas
   * precisa ser DITO: sem isso, arrastar um arquivo de outra pasta ensina nada
   * e parece que ensinou.
   */
  readonly foraDaBiblioteca: number;
  /** Colocado onde ninguem fala: nao ha texto para ligar ao conceito. */
  readonly semFala: number;
  /**
   * Escolhas que nenhum termo explica.
   *
   * O take ganha credito de arquivo mesmo assim — se o usuario colocou, faz
   * sentido, e isso ele pediu explicitamente. As palavras cobertas contam rumo
   * a uma ligacao (D-022). O que NAO acontece e credito de par
   * conceito-palavra: contagem ajusta peso, nao inventa ligacao (D-016). Sai
   * tambem como sugestao, material direto para o dicionario de sinonimos.
   */
  readonly semLigacao: readonly string[];
}

/**
 * Corta a frase para o log SEM partir palavra no meio, e avisa que cortou.
 *
 * O `slice(0, 60)` cru produzia "e quando voce per" — parecia log quebrado,
 * nao frase longa.
 */
function resumoDaFrase(texto: string): string {
  if (texto.length <= 60) return texto;
  const corte = texto.lastIndexOf(" ", 60);
  return `${texto.slice(0, corte > 20 ? corte : 60)}…`;
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
 * e preciso descobrir o que estava sendo dito ali e quais termos ligam a fala
 * ao conceito escolhido. Quando nenhum liga, o take ainda ganha credito e as
 * palavras cobertas viram contagem de ligacao; so o par fica de fora.
 *
 * Puro, e por isso testavel sem Premiere: recebe o que ja foi lido da timeline.
 */
export function creditarManuais(
  memoria: Memoria,
  sequencia: string,
  manuais: readonly ColocacaoManual[],
  frases: readonly Frase[],
  conceitos: readonly Conceito[],
  associacoes: Associacoes = ASSOCIACOES_VAZIAS
): CreditoManual {
  let assoc = associacoes;
  const pares: Record<string, Saldo> = { ...memoria.pares };
  const arquivos: Record<string, Saldo> = { ...memoria.arquivos };
  const vistos: Record<string, true> = { ...memoria.vistos };
  const semLigacao: string[] = [];
  let creditados = 0;
  let jaContados = 0;
  let foraDaBiblioteca = 0;
  let semFala = 0;

  for (const manual of manuais) {
    const conceito = conceitos.find((c) => c.arquivos.includes(manual.arquivo));
    if (conceito === undefined) {
      foraDaBiblioteca++;
      continue;
    }

    const frase = frases.find(
      (f) => manual.inicio >= f.inicio - FOLGA_DA_FRASE && manual.inicio < f.fim
    );
    if (frase === undefined) {
      semFala++;
      continue;
    }

    const casados = conceito.termos.filter((t) => estaNaFrase(t, termos(frase.texto)));

    if (casados.length === 0) {
      // O dicionario nao explica a escolha — mas VOCE explicou, colocando, e
      // isso vale por si: o take ganha credito de arquivo desde ja. Alem disso
      // conta as palavras que este B-roll cobriu; a que se repetir em
      // colocacoes diferentes deste mesmo conceito e a ligacao de verdade.
      //
      // A marca propria garante "colocacoes DIFERENTES" de verdade: sem ela,
      // tres cliques em Aprender com a MESMA colocacao parada na timeline
      // firmavam a ligacao sozinhos, contra a intencao do D-022.
      const marcaAssoc = `assoc|${sequencia}|${manual.arquivo}|${Math.round(manual.inicio)}`;
      if (vistos[marcaAssoc] !== true) {
        vistos[marcaAssoc] = true;
        somar(arquivos, manual.arquivo, true);

        // So o que ele cobriu, nao a frase inteira: a imagem entrou em cima
        // daquelas palavras, e nao das quinze da frase toda.
        const cobertas = new Set(
          frase.termosNoTempo
            .filter((t) => t.inicio >= manual.inicio - FOLGA_DA_FRASE && t.inicio <= manual.fim)
            .map((t) => t.termo)
        );
        for (const termo of cobertas) assoc = comAssociacao(assoc, conceito.rotulo, termo);
      }

      // A marca SEM prefixo fica de fora de proposito: no dia em que a ligacao
      // firmar, `casados` deixa de ser vazio e isto vira credito de par tambem.
      semLigacao.push(
        `${relogio(manual.inicio)} voce colocou "${conceito.rotulo}" onde se diz "${resumoDaFrase(frase.texto)}" — o dicionario nao explica, mas vale: o take ganhou credito e contei as palavras cobertas.`
      );
      continue;
    }

    const marca = `${sequencia}|${manual.arquivo}|${Math.round(manual.inicio)}`;
    if (vistos[marca] === true) {
      jaContados++;
      continue;
    }
    vistos[marca] = true;

    creditados++;
    somar(arquivos, manual.arquivo, true);
    for (const termo of casados) somar(pares, chave(conceito.rotulo, termo), true);
  }

  return {
    memoria: { schema: 3, pares, arquivos, vistos },
    associacoes: assoc,
    creditados,
    jaContados,
    foraDaBiblioteca,
    semFala,
    semLigacao,
  };
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

/**
 * Tolerancia entre onde o plugin pos e onde o clipe esta agora.
 *
 * Aparar o comeco ou empurrar para sincronizar move o inicio em ate um segundo
 * e pouco; mover para OUTRO ponto da fala move muito mais. 2s separa "ajustou"
 * de "nao e mais aquela colocacao".
 */
const TOLERANCIA_DO_LUGAR = 2;

/**
 * Algum item do plano ainda esta ONDE o plugin o pos?
 *
 * A trava anti-Ctrl+Z conferia so o nome, e nome se repete: B-roll manual e
 * sobra de rodada antiga com o mesmo arquivo "sobreviviam" por um item que o
 * undo ja tinha desfeito. No uso real, 21 falsos sobreviventes furaram a trava
 * e 67 pares apanharam por uma rejeicao que nunca houve (D-032). Posicao nao
 * colide: undo em lote nao deixa ninguem no lugar. Item sem `inicio` (pendente
 * gravado antes disto existir) cai no criterio por nome, o comportamento
 * anterior.
 */
export function algumNoLugar(
  itens: PlanoPendente["itens"],
  clipes: ReadonlyArray<{ arquivo: string; inicio: number }>,
  presentes: ReadonlySet<string>
): boolean {
  return itens.some((i) => {
    const planejado = i.inicio;
    if (planejado === undefined) return presentes.has(i.arquivo);
    return clipes.some(
      (c) => c.arquivo === i.arquivo && Math.abs(c.inicio - planejado) <= TOLERANCIA_DO_LUGAR
    );
  });
}

/**
 * Grava o pendente de uma sequencia, ou o esvazia com `null`.
 *
 * Esvaziar apaga os itens a julgar, **nunca a lista de `postos`**: o plugin
 * precisa continuar sabendo o que foi ele quem inseriu, senao passa a chamar o
 * proprio trabalho de colocacao do usuario.
 */
export function comPendente(
  pendentes: Pendentes,
  sequencia: string,
  plano: PlanoPendente | null
): Pendentes {
  const antes = pendentes.porSequencia[sequencia];
  // Dedupe por arquivo+lugar: o mesmo take pode legitimamente ter sido posto
  // em dois pontos (repeticao do D-029, ou re-insercao depois de exclusao).
  const postos = new Map<string, { arquivo: string; inicio?: number }>();
  for (const p of antes?.postos ?? []) postos.set(chaveDoPosto(p), p);
  for (const item of plano?.itens ?? []) {
    const p = { arquivo: item.arquivo, ...(item.inicio !== undefined ? { inicio: item.inicio } : {}) };
    postos.set(chaveDoPosto(p), p);
  }

  const porSequencia = { ...pendentes.porSequencia };
  porSequencia[sequencia] = {
    quando: plano?.quando ?? antes?.quando ?? "",
    itens: plano?.itens ?? [],
    postos: [...postos.values()],
  };
  return { schema: 1, porSequencia };
}

function chaveDoPosto(p: { arquivo: string; inicio?: number }): string {
  return p.inicio === undefined ? p.arquivo : `${p.arquivo}|${Math.round(p.inicio)}`;
}

/**
 * Este clipe da timeline foi o PLUGIN quem pos?
 *
 * Nome sozinho nao basta (D-033): colocacao manual do usuario com um arquivo
 * que o plugin ja usou era classificada como trabalho do plugin e sumia do
 * credito — 7 das 14 colocacoes manuais do uso real sumiram assim. Com
 * posicao, so conta como "do plano" o clipe que esta onde o plugin inseriu.
 * Entrada antiga sem `inicio` continua valendo por nome, o comportamento
 * anterior.
 */
export function foiOPlugin(
  clipe: { arquivo: string; inicio: number },
  pendente: PlanoPendente | undefined
): boolean {
  if (pendente === undefined) return false;
  const bate = (arquivo: string, inicio?: number): boolean =>
    arquivo === clipe.arquivo &&
    (inicio === undefined || Math.abs(inicio - clipe.inicio) <= TOLERANCIA_DO_LUGAR);
  return (
    pendente.itens.some((i) => bate(i.arquivo, i.inicio)) ||
    (pendente.postos ?? []).some((p) => bate(p.arquivo, p.inicio))
  );
}

// -------------------------------------------------- ligacoes aprendidas

/**
 * Quantas vezes o usuario ligou um conceito a uma palavra que o dicionario NAO
 * liga. Chave: `conceito|termo`.
 *
 * Isto reverte, de proposito, a regra do D-016 ("contagem ajusta peso, nao
 * inventa ligacao"). O que mudou: o usuario pediu que o plugin aprenda o padrao
 * mesmo quando a transcricao nao bate com o nome do arquivo. Sem isto, colocar
 * "Vasos sanguineos" dez vezes onde se fala em "circulacao" nao ensinava nada —
 * so gerava a mesma sugestao de sinonimo, dez vezes.
 */
export interface Associacoes {
  readonly schema: 1;
  readonly pares: Readonly<Record<string, number>>;
}

export const ASSOCIACOES_VAZIAS: Associacoes = { schema: 1, pares: {} };

/**
 * Quantas vezes a mesma dupla precisa aparecer para virar ligacao de verdade.
 *
 * Uma vez nao prova nada: um B-roll cobre varias palavras, e quase todas sao
 * irrelevantes. Tres vezes em colocacoes DIFERENTES e outra coisa — palavra a
 * toa nao se repete junto do mesmo conceito por acaso.
 */
export const LIGACAO_MINIMA = 3;

export function comAssociacao(atual: Associacoes, conceito: string, termo: string): Associacoes {
  const k = chave(conceito, termo);
  return { schema: 1, pares: { ...atual.pares, [k]: (atual.pares[k] ?? 0) + 1 } };
}

/** So as duplas que passaram do minimo: conceito -> termos da fala. */
export function ligacoesFirmes(assoc: Associacoes): Map<string, string[]> {
  const firmes = new Map<string, string[]>();
  for (const [k, vezes] of Object.entries(assoc.pares)) {
    if (vezes < LIGACAO_MINIMA) continue;
    const corte = k.indexOf("|");
    if (corte < 0) continue;
    const conceito = k.slice(0, corte);
    const termo = k.slice(corte + 1);
    firmes.set(conceito, [...(firmes.get(conceito) ?? []), termo]);
  }
  return firmes;
}

export function parseAssociacoes(raw: unknown): Associacoes {
  if (typeof raw !== "object" || raw === null) return ASSOCIACOES_VAZIAS;
  const bruto = (raw as Record<string, unknown>).pares;
  if (typeof bruto !== "object" || bruto === null) return ASSOCIACOES_VAZIAS;

  const pares: Record<string, number> = {};
  for (const [k, v] of Object.entries(bruto)) {
    if (typeof v === "number" && Number.isFinite(v) && v > 0) pares[k] = Math.floor(v);
  }
  return { schema: 1, pares };
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
        ...(typeof i.inicio === "number" && Number.isFinite(i.inicio) ? { inicio: i.inicio } : {}),
      });
    }
    const postos: { arquivo: string; inicio?: number }[] = [];
    for (const p of Array.isArray(o.postos) ? (o.postos as unknown[]) : []) {
      // Formato antigo: so o nome. Formato novo: { arquivo, inicio }.
      if (typeof p === "string") postos.push({ arquivo: p });
      else if (typeof p === "object" && p !== null) {
        const cru = p as Record<string, unknown>;
        if (typeof cru.arquivo !== "string") continue;
        postos.push({
          arquivo: cru.arquivo,
          ...(typeof cru.inicio === "number" && Number.isFinite(cru.inicio) ? { inicio: cru.inicio } : {}),
        });
      }
    }
    porSequencia[k] = {
      quando: typeof o.quando === "string" ? o.quando : "",
      itens,
      postos,
    };
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
