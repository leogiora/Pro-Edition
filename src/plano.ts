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
   * Quanto o corte entra ANTES da palavra que casou.
   *
   * Cortar exatamente na silaba chega tarde: o espectador ve a imagem depois
   * de ouvir a palavra. Um respiro curto antes faz o B-roll parecer intencional.
   */
  readonly antecipacao: number;
}

export const REGRAS_PADRAO: RegrasPlano = {
  duracaoMinima: 1.5,
  duracaoMaxima: 4,
  intervaloMinimo: 2,
  // Mais exigente que a analise: aqui entra na timeline sem ninguem revisar.
  scoreMinimo: 0.6,
  janelaSemRepetir: 20,
  antecipacao: 0.3,
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

/** Onde procurar o arquivo de cada conceito. */
export interface Biblioteca {
  /** Nome do arquivo -> caminho completo. */
  readonly caminhos: ReadonlyMap<string, string>;
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
  readonly ancoraEm: number;
}

export function planejar(
  oportunidades: readonly Oportunidade[],
  biblioteca: Biblioteca,
  regras: RegrasPlano = REGRAS_PADRAO,
  memoria: Memoria = MEMORIA_VAZIA
): Plano {
  const colocacoes: Colocacao[] = [];
  const descartes: string[] = [];

  const candidatos: Candidato[] = [];
  for (const o of oportunidades) {
    if (o.frase.duracao < regras.duracaoMinima) {
      descartes.push(`${relogio(o.frase.inicio)} frase curta demais (${o.frase.duracao.toFixed(1)}s)`);
      continue;
    }
    let algumPassou = false;
    for (const s of o.sugestoes) {
      // O historico entra AQUI, antes do corte: par que o usuario ja apagou
      // algumas vezes deixa de passar sozinho, sem ninguem editar dicionario.
      const ajuste = fator(memoria, s.conceito.rotulo, s.termosCasados);
      const score = s.score * ajuste;
      if (score < regras.scoreMinimo) continue;
      algumPassou = true;
      candidatos.push({
        frase: o.frase,
        conceito: s.conceito.rotulo,
        arquivos: s.conceito.arquivos,
        score,
        motivo: ajuste === 1 ? s.motivo : `${s.motivo} · aprendizado ${sinal(ajuste)}`,
        termosCasados: s.termosCasados,
        ancoraEm: Math.max(o.frase.inicio, ancora(o.frase, s.termosCasados) - regras.antecipacao),
      });
    }
    if (!algumPassou) {
      descartes.push(
        `${relogio(o.frase.inicio)} nenhuma sugestao passou (melhor: ${porcento(o.sugestoes[0]?.score)})`
      );
    }
  }

  // Ordem cronologica; empate no mesmo instante resolve pelo melhor score.
  candidatos.sort((a, b) => (a.ancoraEm !== b.ancoraEm ? a.ancoraEm - b.ancoraEm : b.score - a.score));

  /** Arquivos ja usados: a secao 8 proibe repetir o mesmo shot na sequencia. */
  const arquivosUsados = new Set<string>();
  /** Conceito -> quando apareceu pela ultima vez. */
  const ultimoUso = new Map<string, number>();
  let fimDoAnterior = Number.NEGATIVE_INFINITY;

  for (const c of candidatos) {
    const onde = `${relogio(c.ancoraEm)} ${c.conceito}`;

    if (c.ancoraEm < fimDoAnterior + regras.intervaloMinimo) {
      descartes.push(`${onde}: muito perto do B-roll anterior`);
      continue;
    }

    const anterior = ultimoUso.get(c.conceito);
    if (anterior !== undefined && c.ancoraEm - anterior < regras.janelaSemRepetir) {
      descartes.push(`${onde}: conceito repetido ha menos de ${regras.janelaSemRepetir}s`);
      continue;
    }

    // O que o usuario apagou cede a vez a outra variacao do mesmo conceito. O
    // assunto continua valendo; so muda o take.
    const disponiveis = c.arquivos.filter((a) => !arquivosUsados.has(a));
    const arquivo = melhorArquivo(memoria, disponiveis);
    if (arquivo === undefined) {
      descartes.push(`${onde}: todas as variacoes ja usadas`);
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
      motivo: trocouTake ? `${c.motivo} · outro take, o anterior foi apagado` : c.motivo,
      termosCasados: c.termosCasados,
      inicio: c.ancoraEm,
      duracao,
    });
    arquivosUsados.add(arquivo);
    ultimoUso.set(c.conceito, c.ancoraEm);
    fimDoAnterior = c.ancoraEm + duracao;
  }

  return { colocacoes, descartes };
}

/** "+15%" / "-30%": o motivo tem de dizer que o historico mexeu no score. */
function sinal(ajuste: number): string {
  const pontos = Math.round((ajuste - 1) * 100);
  return `${pontos > 0 ? "+" : ""}${pontos}%`;
}

function porcento(score: number | undefined): string {
  return score === undefined ? "nenhuma" : `${Math.round(score * 100)}%`;
}
