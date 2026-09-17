/*
 * Planejador de colocacao: decide QUAIS B-rolls entram, ONDE e por QUANTO tempo.
 *
 * Aplica as regras de montagem da secao 8 do CLAUDE.md. Puro e deterministico:
 * a mesma analise sempre produz o mesmo plano, o que torna a insercao automatica
 * conferivel e o teste possivel sem abrir o Premiere.
 */

import type { Oportunidade } from "./analise.ts";
import { fator, melhorArquivo, MEMORIA_VAZIA, type Memoria } from "./aprendizado.ts";
import { relogio } from "./domain.ts";
import { encaixam, percentis, ritmo } from "./intensidade.ts";
import { estaNaFrase, mesmaRaiz } from "./match.ts";

export interface Colocacao {
  /** Arquivo escolhido, com caminho completo para o import. */
  readonly arquivo: string;
  readonly caminho: string;
  readonly conceito: string;
  /** Tempo na sequencia, em segundos. */
  readonly inicio: number;
  readonly duracao: number;
  readonly score: number;
  /** Sempre visivel: nenhuma insercao automatica sem motivo escrito. */
  readonly motivo: string;
  readonly termosCasados: readonly string[];
  /**
   * O que estava sendo dito onde este B-roll entrou.
   *
   * Sem isto, um corte fora de contexto e indistinguivel de um corte fora de
   * sincronia: os dois aparecem como "imagem errada aqui". Com a frase ao lado,
   * da para dizer qual dos dois e — e foi justamente essa duvida que apareceu
   * no uso real.
   */
  readonly textoDaFrase: string;
  /** Instante da palavra que puxou o corte, antes da antecipacao. */
  readonly ancoradoEm: number;
}

export interface Plano {
  readonly colocacoes: readonly Colocacao[];
  /** Oportunidades descartadas e por que — a recusa tambem precisa de motivo. */
  readonly descartes: readonly string[];
}

export interface RegrasPlano {
  /** Secao 8: duracao padrao entre 1,5 e 4 segundos. */
  readonly duracaoMinima: number;
  readonly duracaoMaxima: number;
  /** Silencio minimo entre o fim de um B-roll e o inicio do proximo. */
  readonly intervaloMinimo: number;
  /** Score abaixo disto nao entra sozinho na timeline. */
  readonly scoreMinimo: number;
  /** Nao repetir o mesmo conceito antes de passar este tempo. */
  readonly janelaSemRepetir: number;
  /**
   * Repetir o MESMO ARQUIVO e fallback, nunca escolha (secao 8: "salvo
   * ausencia de alternativa"). So acontece quando o conceito nao tem take
   * inedito sobrando, e mesmo assim so depois deste tempo desde a ultima
   * aparicao — perto demais, o espectador reconhece o shot.
   */
  readonly janelaMesmoArquivo: number;
  /**
   * Quanto o corte entra ANTES da palavra que casou.
   *
   * Cortar exatamente na silaba chega tarde: o espectador ve a imagem depois
   * de ouvir a palavra. Um respiro curto antes faz o B-roll parecer intencional.
   */
  readonly antecipacao: number;
  /**
   * Quanto o percentil de agitacao do take pode se afastar do percentil de
   * ritmo da fala e ainda contar como encaixe.
   *
   * Botao, nao constante: nos 43 takes de "Viagra", 0,35 deixa ~15 candidatos
   * quando a fala esta num extremo de ritmo e ~30 quando esta no meio. Apertar
   * se entrar take fora de clima; afrouxar se muita colocacao cair no fallback.
   */
  readonly toleranciaIntensidade: number;
}

export const REGRAS_PADRAO: RegrasPlano = {
  duracaoMinima: 1.5,
  duracaoMaxima: 4,
  intervaloMinimo: 2,
  // Mais exigente que a analise: aqui entra na timeline sem ninguem revisar.
  scoreMinimo: 0.6,
  // Medido no log de 26/08 (66 colocacoes em 17 min): o mesmo conceito voltava
  // em 21s, 29s, 32s, 36s. E o que a vista le como "de novo isso". 60s corta
  // essa faixa inteira e ainda deixa o conceito voltar 2x por minuto e meio.
  janelaSemRepetir: 60,
  // Mesma medicao, para o take exato: reaparicoes a 76s, 90s, 91s, 110s, 125s.
  // 180s corta as cinco. Acima disso comeca a cortar volta legitima (274s, 335s)
  // e some B-roll sem ganhar variedade — conceito de take unico nao tem para
  // onde alternar, so pode sumir.
  janelaMesmoArquivo: 180,
  antecipacao: 0.3,
  toleranciaIntensidade: 0.35,
};

/**
 * Densidade maxima: o maximo de B-roll que ainda passa pelo corte de qualidade.
 *
 * Os numeros saem dos descartes medidos numa sequencia real de 62s, onde 6
 * B-rolls entraram e 13 candidatos cairam. Dos 13, **dez cairam por regra de
 * espacamento**, nao por qualidade:
 *
 * - 7 por "muito perto do B-roll anterior" -> `intervaloMinimo` vai a zero
 * - 3 por "conceito repetido" -> `janelaSemRepetir` cai de 20s para 8s
 * - 1 por "sobra so 1,3s" e 1 por "frase curta demais (1,4s)" -> minimo a 1,2s
 *
 * `duracaoMaxima` cai para 3s porque B-roll mais curto deixa espaco para o
 * proximo — o gargalo aqui e tempo de tela, nao falta de candidato.
 *
 * **`scoreMinimo` NAO muda.** Densidade se ganha afrouxando espacamento, nunca
 * afrouxando o casamento: encher a timeline de sugestao ruim nao e mais B-roll,
 * e mais trabalho de apagar.
 */
export const REGRAS_DENSAS: RegrasPlano = {
  ...REGRAS_PADRAO,
  duracaoMinima: 1.2,
  duracaoMaxima: 3,
  intervaloMinimo: 0,
  janelaSemRepetir: 8,
};

/**
 * Instante da primeira palavra da frase que casou com o conceito.
 *
 * Sem isso o B-roll entra no comeco da frase — numa frase de 8 segundos, ate
 * seis segundos antes do assunto ser mencionado.
 */
function ancora(frase: Oportunidade["frase"], termosCasados: readonly string[]): number {
  // Primeira passada: a palavra literal. Se a frase diz "frustrado", o corte
  // vai nela, e nao num sinonimo que aparece antes ("problema", por exemplo).
  for (const t of frase.termosNoTempo) {
    if (termosCasados.some((casado) => mesmaRaiz(casado, t.termo))) return t.inicio;
  }
  // Segunda passada: sinonimo, quando a palavra literal nao foi dita.
  for (const t of frase.termosNoTempo) {
    if (termosCasados.some((casado) => estaNaFrase(casado, [t.termo]))) return t.inicio;
  }
  return frase.inicio;
}

/**
 * Distancia maxima, em segundos, entre as palavras que fizeram o conceito casar.
 *
 * Medido numa frase real de 7,4s: "essa a sensacao que MILHOES de casais no
 * Brasil tem quando o HOMEM comeca a perder o desempenho". O conceito "Milhares
 * de homens" pontuou 100% porque as duas palavras estavam na frase — a 2,8s uma
 * da outra, falando de coisas diferentes. "milhoes" qualificava casais.
 *
 * Os casamentos legitimos do mesmo conceito ficam colados: "ajudei milhares de
 * homens" (0,35s) e "30 milhoes de homens" (0,7s). 1,5s separa os dois mundos
 * com folga, e equivale a cerca de quatro palavras de distancia.
 */
const DISPERSAO_MAXIMA = 1.5;

/**
 * Quao espalhadas no tempo estao as palavras que casaram.
 *
 * Procura o agrupamento mais apertado: cada termo pode ter sido dito varias
 * vezes, e o que importa e se existe ALGUM ponto da frase onde todos aparecem
 * juntos. Devolve `null` quando algum termo nao tem tempo conhecido — nesse caso
 * nao da para julgar, e nao julgar e melhor que descartar por engano.
 */
function dispersao(frase: Oportunidade["frase"], termosCasados: readonly string[]): number | null {
  if (termosCasados.length < 2) return 0;

  const tempos = termosCasados.map((casado) =>
    frase.termosNoTempo
      .filter((t) => mesmaRaiz(casado, t.termo) || estaNaFrase(casado, [t.termo]))
      .map((t) => t.inicio)
  );
  if (tempos.some((lista) => lista.length === 0)) return null;

  const primeiro = tempos[0];
  if (primeiro === undefined) return null;

  let melhor = Number.POSITIVE_INFINITY;
  for (const ancoraDoTermo of primeiro) {
    let maiorDistancia = 0;
    for (const outros of tempos.slice(1)) {
      const perto = Math.min(...outros.map((t) => Math.abs(t - ancoraDoTermo)));
      maiorDistancia = Math.max(maiorDistancia, perto);
    }
    melhor = Math.min(melhor, maiorDistancia);
  }
  return melhor;
}

/** Onde procurar o arquivo de cada conceito. */
export interface Biblioteca {
  /** Nome do arquivo -> caminho completo. */
  readonly caminhos: ReadonlyMap<string, string>;
}

/**
 * O que se sabe de intensidade nesta rodada.
 *
 * Ausente, o planejador se comporta exatamente como antes de isto existir — o
 * que mantem intacto todo o comportamento provado ate aqui.
 */
export interface IntensidadeDoPlano {
  /** Agitacao crua por arquivo, como saiu do mp4. */
  readonly porArquivo: ReadonlyMap<string, number>;
  /** Palavras por segundo de TODAS as frases da sequencia, para o percentil. */
  readonly ritmoDasFrases: readonly number[];
}

/**
 * Uma sugestao ja posicionada no tempo, antes de decidir se entra.
 *
 * Cada sugestao vira um candidato proprio, ancorado na SUA palavra. Uma frase
 * longa que menciona dois assuntos rende dois B-rolls, em momentos diferentes —
 * antes, cada frase rendia no maximo um, no comeco dela.
 */
interface Candidato {
  readonly frase: Oportunidade["frase"];
  readonly conceito: string;
  readonly arquivos: readonly string[];
  readonly score: number;
  readonly motivo: string;
  readonly termosCasados: readonly string[];
  /** Onde a palavra que casou foi dita, sem a antecipacao descontada. */
  readonly palavraEm: number;
  readonly ancoraEm: number;
}

export function planejar(
  oportunidades: readonly Oportunidade[],
  biblioteca: Biblioteca,
  regras: RegrasPlano = REGRAS_PADRAO,
  memoria: Memoria = MEMORIA_VAZIA,
  intensidade?: IntensidadeDoPlano,
  jaNaTimeline: readonly Ocupado[] = []
): Plano {
  const colocacoes: Colocacao[] = [];
  const descartes: string[] = [];

  // Ordenado uma vez para a sequencia toda: e a regua contra a qual o ritmo de
  // cada frase vira percentil.
  const ritmoOrdenado = intensidade ? [...intensidade.ritmoDasFrases].sort((a, b) => a - b) : [];

  const candidatos: Candidato[] = [];
  for (const o of oportunidades) {
    if (o.frase.duracao < regras.duracaoMinima) {
      descartes.push(`${relogio(o.frase.inicio)} frase curta demais (${o.frase.duracao.toFixed(1)}s)`);
      continue;
    }
    let algumPassou = false;
    // O melhor score DEPOIS do aprendizado: e ele que briga com o corte, e e
    // ele que o descarte tem de mostrar. "melhor: 100%" com nada passando era
    // o ajuste escondido do log — parecia bug, e custou uma investigacao.
    let melhorAjustado: number | null = null;
    for (const s of o.sugestoes) {
      // O historico entra AQUI, antes do corte: par que o usuario ja apagou
      // algumas vezes deixa de passar sozinho, sem ninguem editar dicionario.
      // Duas palavras do conceito na mesma frase nao bastam: elas precisam ter
      // sido ditas JUNTAS. Espalhadas, qualificam sujeitos diferentes.
      const espalhamento = dispersao(o.frase, s.termosCasados);
      if (espalhamento !== null && espalhamento > DISPERSAO_MAXIMA) {
        descartes.push(
          `${relogio(o.frase.inicio)} ${s.conceito.rotulo}: palavras a ${espalhamento.toFixed(1)}s uma da outra, falam de coisas diferentes`
        );
        continue;
      }

      const ajuste = fator(memoria, s.conceito.rotulo, s.termosCasados);
      const score = s.score * ajuste;
      melhorAjustado = Math.max(melhorAjustado ?? 0, score);
      if (score < regras.scoreMinimo) continue;
      algumPassou = true;
      candidatos.push({
        frase: o.frase,
        conceito: s.conceito.rotulo,
        arquivos: s.conceito.arquivos,
        score,
        motivo: ajuste === 1 ? s.motivo : `${s.motivo} · aprendizado ${sinal(ajuste)}`,
        termosCasados: s.termosCasados,
        palavraEm: ancora(o.frase, s.termosCasados),
        ancoraEm: Math.max(o.frase.inicio, ancora(o.frase, s.termosCasados) - regras.antecipacao),
      });
    }
    if (!algumPassou) {
      const cru = o.sugestoes[0]?.score;
      const caiu = cru !== undefined && melhorAjustado !== null && melhorAjustado < cru - 0.005;
      descartes.push(
        caiu
          ? `${relogio(o.frase.inicio)} nenhuma sugestao passou (melhor: ${porcento(cru)}, caiu para ${porcento(melhorAjustado ?? 0)} pelo aprendizado)`
          : `${relogio(o.frase.inicio)} nenhuma sugestao passou (melhor: ${porcento(cru)})`
      );
    }
  }

  // Ordem cronologica; empate no mesmo instante resolve pelo melhor score.
  candidatos.sort((a, b) => (a.ancoraEm !== b.ancoraEm ? a.ancoraEm - b.ancoraEm : b.score - a.score));

  /** Arquivo -> quando apareceu pela ultima vez. */
  const quandoUsou = new Map<string, number>();
  /** Arquivo -> quantas vezes ja entrou. E o rodizio: menos usado primeiro. */
  const usosDoArquivo = new Map<string, number>();
  /** Conceito -> quando apareceu pela ultima vez. */
  const ultimoUso = new Map<string, number>();
  let fimDoAnterior = Number.NEGATIVE_INFINITY;

  // O que ja esta na timeline conta como uso anterior: alimenta o rodizio de
  // take e a janela de repeticao do conceito. `fimDoAnterior` fica de fora de
  // proposito — quem impede sobreposicao com o que ja existe e `semSobrepor`,
  // sem depender de ordem. Guarda a aparicao mais tardia; um trecho pode ser
  // analisado antes de um vizinho anterior, entao as janelas medem por `abs`.
  for (const j of jaNaTimeline) {
    if (j.arquivo !== undefined) {
      quandoUsou.set(j.arquivo, Math.max(j.inicio, quandoUsou.get(j.arquivo) ?? j.inicio));
      usosDoArquivo.set(j.arquivo, (usosDoArquivo.get(j.arquivo) ?? 0) + 1);
    }
    if (j.conceito !== undefined) {
      ultimoUso.set(j.conceito, Math.max(j.inicio, ultimoUso.get(j.conceito) ?? j.inicio));
    }
  }

  for (const c of candidatos) {
    const onde = `${relogio(c.ancoraEm)} ${c.conceito}`;

    if (c.ancoraEm < fimDoAnterior + regras.intervaloMinimo) {
      descartes.push(`${onde}: muito perto do B-roll anterior`);
      continue;
    }

    const anterior = ultimoUso.get(c.conceito);
    if (anterior !== undefined && Math.abs(c.ancoraEm - anterior) < regras.janelaSemRepetir) {
      descartes.push(`${onde}: conceito repetido ha menos de ${regras.janelaSemRepetir}s`);
      continue;
    }

    // Secao 8: nao repetir o mesmo shot, SALVO ausencia de alternativa. Rodizio
    // por take — todo take do conceito entra uma vez antes de qualquer um
    // repetir; esgotados, recomeca o ciclo pelo menos usado. Quando o ciclo ja
    // manda repetir (ciclo >= 1), o take exato ainda tem de ter saido da tela ha
    // `janelaMesmoArquivo` — perto demais o espectador reconhece o shot.
    const usos = (a: string): number => usosDoArquivo.get(a) ?? 0;
    const ciclo = Math.min(...c.arquivos.map(usos));
    const noCiclo = c.arquivos.filter((a) => usos(a) === ciclo);
    const disponiveis =
      ciclo === 0
        ? noCiclo
        : noCiclo.filter((a) => Math.abs(c.ancoraEm - (quandoUsou.get(a) ?? 0)) >= regras.janelaMesmoArquivo);

    // A intensidade FILTRA, o historico ESCOLHE — dentro do ciclo. Sem isso o
    // historico travaria no take de melhor score e os outros 42 nunca apareciam.
    const cabem = filtrarPorIntensidade(disponiveis, c.frase, intensidade, regras, ritmoOrdenado);
    const arquivo = melhorArquivo(memoria, cabem.arquivos);
    if (arquivo === undefined) {
      descartes.push(`${onde}: todas as variacoes apareceram ha menos de ${regras.janelaMesmoArquivo}s`);
      continue;
    }
    // Sem historico o escolhido e sempre o primeiro. Se divergiu, foi a contagem
    // por arquivo que mudou a escolha — e isso tem de aparecer no motivo.
    const trocouTake = arquivo !== disponiveis[0];
    const caminho = biblioteca.caminhos.get(arquivo);
    if (caminho === undefined) {
      descartes.push(`${onde}: ${arquivo} nao esta na pasta`);
      continue;
    }

    // O B-roll nao passa do fim da frase que o justificou.
    const espaco = Math.max(0, c.frase.fim - c.ancoraEm);
    if (espaco < regras.duracaoMinima) {
      descartes.push(`${onde}: sobra so ${espaco.toFixed(1)}s ate o fim da frase`);
      continue;
    }
    const duracao = Math.min(regras.duracaoMaxima, espaco);

    colocacoes.push({
      arquivo,
      caminho,
      conceito: c.conceito,
      score: c.score,
      motivo: montarMotivo(c.motivo, trocouTake, cabem.rotulo, ciclo),
      termosCasados: c.termosCasados,
      textoDaFrase: c.frase.texto,
      ancoradoEm: c.palavraEm,
      inicio: c.ancoraEm,
      duracao,
    });
    quandoUsou.set(arquivo, c.ancoraEm);
    usosDoArquivo.set(arquivo, usos(arquivo) + 1);
    ultimoUso.set(c.conceito, c.ancoraEm);
    fimDoAnterior = c.ancoraEm + duracao;
  }

  return { colocacoes, descartes };
}

/**
 * Restringe os takes aos que combinam com o ritmo da fala naquele ponto.
 *
 * Devolve tambem o rotulo para o motivo. Quando nada encaixa, devolve todos:
 * intensidade nunca pode custar uma colocacao boa.
 */
function filtrarPorIntensidade(
  disponiveis: readonly string[],
  frase: Oportunidade["frase"],
  intensidade: IntensidadeDoPlano | undefined,
  regras: RegrasPlano,
  ritmoOrdenado: readonly number[]
): { arquivos: readonly string[]; rotulo: string | null } {
  if (intensidade === undefined || disponiveis.length < 2 || ritmoOrdenado.length < 2) {
    return { arquivos: disponiveis, rotulo: null };
  }

  const daFrase = ritmo(frase.palavras, frase.duracao);
  const alvo = ritmoOrdenado.indexOf(maisProximo(ritmoOrdenado, daFrase)) / (ritmoOrdenado.length - 1);

  const dosTakes = percentis(disponiveis.map((a) => intensidade.porArquivo.get(a) ?? null));
  const indices = encaixam(dosTakes, alvo, regras.toleranciaIntensidade);
  if (indices.length === 0) return { arquivos: disponiveis, rotulo: null };

  return {
    // `filter` em vez de `?? ""`: nome vazio entrando na escolha viraria uma
    // colocacao apontando para arquivo nenhum.
    arquivos: indices.map((i) => disponiveis[i]).filter((a): a is string => a !== undefined),
    rotulo: alvo >= 0.5 ? "take agitado, a fala corre aqui" : "take parado, momento calmo",
  };
}

/** O valor da lista mais proximo do procurado. Lista nunca vazia aqui. */
function maisProximo(ordenados: readonly number[], alvo: number): number {
  let escolhido = ordenados[0] ?? 0;
  for (const v of ordenados) {
    if (Math.abs(v - alvo) < Math.abs(escolhido - alvo)) escolhido = v;
  }
  return escolhido;
}

/** O motivo carrega tudo o que mexeu na escolha, na ordem em que mexeu. */
function montarMotivo(base: string, trocouTake: boolean, intensidade: string | null, ciclo = 0): string {
  let texto = base;
  if (intensidade !== null) texto += ` · ${intensidade}`;
  if (trocouTake) texto += " · outro take, o anterior foi apagado";
  if (ciclo >= 1) texto += ` · take repetido, ciclo ${ciclo + 1}`;
  return texto;
}

/** Um pedaco de timeline que ja tem alguma coisa. */
export interface Ocupado {
  readonly inicio: number;
  readonly fim: number;
  /**
   * Arquivo e conceito do B-roll que ja esta ai, quando conhecidos.
   *
   * `semSobrepor` ignora — so olha tempo. `planejar` usa para nao repetir um
   * take ou conceito que ja entrou numa analise anterior: sem isto, analisar a
   * sequencia trecho por trecho (in/out) replaneja cada pedaco cego ao que os
   * outros ja colocaram, e o mesmo take reaparece na fronteira.
   */
  readonly arquivo?: string;
  readonly conceito?: string;
}

/**
 * Encostar nao e sobrepor.
 *
 * Um B-roll que comeca exatamente onde o outro termina e montagem normal, e
 * arredondamento de frame nao pode transformar isso em conflito.
 */
const FOLGA_DE_ENCOSTE = 0.05;

/**
 * Tira do plano tudo que cairia em cima de coisa que ja esta na timeline.
 *
 * O planejador e cego para o que ja foi feito: ele monta o plano ideal do zero,
 * toda vez. Aplicar isso com overwrite passa por cima do que o usuario moveu,
 * aparou ou decidiu manter — trabalho dele, apagado por um clique.
 *
 * A regra e simples e nao tem excecao: onde ja existe B-roll, nao entra outro.
 */
export function semSobrepor(
  colocacoes: readonly Colocacao[],
  ocupado: readonly Ocupado[]
): { entram: Colocacao[]; bloqueadas: string[] } {
  const entram: Colocacao[] = [];
  const bloqueadas: string[] = [];

  for (const c of colocacoes) {
    const fim = c.inicio + c.duracao;
    const colide = ocupado.some(
      (o) => c.inicio < o.fim - FOLGA_DE_ENCOSTE && o.inicio < fim - FOLGA_DE_ENCOSTE
    );
    if (colide) {
      bloqueadas.push(`${relogio(c.inicio)} ${c.conceito}: ja ha B-roll ai, deixei como esta`);
      continue;
    }
    entram.push(c);
  }
  return { entram, bloqueadas };
}

/** "+15%" / "-30%": o motivo tem de dizer que o historico mexeu no score. */
function sinal(ajuste: number): string {
  const pontos = Math.round((ajuste - 1) * 100);
  return `${pontos > 0 ? "+" : ""}${pontos}%`;
}

function porcento(score: number | undefined): string {
  return score === undefined ? "nenhuma" : `${Math.round(score * 100)}%`;
}
