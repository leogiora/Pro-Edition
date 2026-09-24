/*
 * Junta as pecas: timeline -> transcricao do corte -> frases -> sugestoes.
 * Puro. Recebe dados ja lidos do Premiere e devolve o plano.
 */

import { casar, conceitosDeArquivos, type Conceito, type Sugestao } from "./match.ts";
import {
  agruparEmFrases,
  parseTranscricao,
  reconstruirTranscricao,
  type ClipeComOrigem,
  type Frase,
  type PalavraEditada,
  type TranscricaoOrigem,
} from "./transcript.ts";

export interface Oportunidade {
  readonly frase: Frase;
  readonly sugestoes: readonly Sugestao[];
}

export interface Analise {
  readonly palavras: number;
  /**
   * TODAS as frases do corte, nao so as que viraram oportunidade.
   *
   * Quem conta, conta com `.length`. A lista inteira e necessaria para saber o
   * que estava sendo dito no instante em que o usuario colocou um B-roll na mao
   * — inclusive nas frases que o casamento nao alcancou, que sao justamente as
   * que revelam sinonimo faltando.
   */
  readonly frases: readonly Frase[];
  readonly conceitos: readonly Conceito[];
  readonly oportunidades: readonly Oportunidade[];
  readonly avisos: readonly string[];
}

export interface EntradaAnalise {
  readonly clipes: readonly ClipeComOrigem[];
  /** Nome da midia -> JSON cru do exportToJSON. */
  readonly transcricoesJson: ReadonlyMap<string, string>;
  /** Nomes de todas as midias do projeto, para extrair os conceitos. */
  readonly biblioteca: readonly string[];
  /**
   * Ligacoes que o usuario ensinou colocando B-roll, e que o dicionario nao tem.
   * Conceito -> termos da fala. Ver `ligacoesFirmes` em `aprendizado.ts`.
   */
  readonly ligacoes?: ReadonlyMap<string, readonly string[]>;
  /**
   * Costura de teste, nao configuracao: o painel nunca passa estes dois. Existem
   * para os testes provarem o comportamento de fronteira sem ter de fabricar uma
   * transcricao com a duracao exata do limiar.
   */
  readonly duracaoMinima?: number;
  readonly scoreMinimo?: number;
}

/** Confianca abaixo disto marca o trecho como incerto em vez de confiar nele. */
const CONFIANCA_SUSPEITA = 0.6;

/*
 * Corte grosso, deliberadamente mais FROUXO que o do planejador (1,5s e 0,6).
 *
 * Nao e o mesmo limiar duplicado: aqui decide-se o que vale a pena *mostrar* ao
 * usuario como oportunidade; la decide-se o que entra sozinho na timeline. Quem
 * recusa a colocacao e o `plano.ts`, e com motivo escrito. Estes dois numeros so
 * evitam encher a lista de frases sem chance nenhuma.
 *
 * Consequencia de serem mais frouxos: tudo o que passa por aqui e reavaliado
 * depois. Se um dia ficarem mais rigidos que os do planejador, passam a decidir
 * no lugar dele — em silencio, sem linha de descarte. Nao inverter.
 */
const DURACAO_MINIMA = 1.2;
const SCORE_MINIMO = 0.5;

/**
 * Score de uma sugestao que vem do que o usuario ensinou, nao do texto.
 *
 * Abaixo de um casamento literal (1,0) e acima do corte do planejador (0,6):
 * o padrao observado vale, mas nunca mais que a palavra escrita no arquivo.
 */
const SCORE_APRENDIDO = 0.75;

/**
 * Sugestoes que so existem porque o usuario ensinou, colocando B-roll.
 *
 * Entram como acrescimo, nunca alterando a pontuacao do casamento por texto —
 * o que ja funciona continua funcionando exatamente igual. Conceito que ja veio
 * pelo texto nao e duplicado aqui.
 */
function porLigacaoAprendida(
  frase: Frase,
  conceitos: readonly Conceito[],
  ligacoes: ReadonlyMap<string, readonly string[]> | undefined,
  jaSugeridos: readonly Sugestao[]
): Sugestao[] {
  if (ligacoes === undefined || ligacoes.size === 0) return [];

  const naFrase = new Set(frase.termosNoTempo.map((t) => t.termo));
  const vistos = new Set(jaSugeridos.map((s) => s.conceito.rotulo));
  const extras: Sugestao[] = [];

  for (const conceito of conceitos) {
    if (vistos.has(conceito.rotulo)) continue;
    const aprendidos = ligacoes.get(conceito.rotulo);
    if (aprendidos === undefined) continue;

    const presentes = aprendidos.filter((t) => naFrase.has(t));
    if (presentes.length === 0) continue;

    extras.push({
      conceito,
      score: SCORE_APRENDIDO,
      motivo: `voce ensinou: "${presentes.join(", ")}" pede "${conceito.rotulo}"`,
      // Os proprios termos aprendidos ancoram o corte, entao ele cai em cima da
      // palavra que motivou a escolha — igual ao casamento por texto.
      termosCasados: presentes,
    });
  }
  return extras;
}

export function analisar(entrada: EntradaAnalise): Analise {
  const avisos: string[] = [];

  const transcricoes = new Map<string, TranscricaoOrigem>();
  for (const [nome, json] of entrada.transcricoesJson) {
    const t = parseTranscricao(json);
    if (t) transcricoes.set(nome, t);
    else avisos.push(`Transcricao ilegivel em ${nome}.`);
  }

  if (transcricoes.size === 0) {
    avisos.push("Nenhuma midia da timeline tem transcricao. Gere a transcricao no Premiere primeiro.");
  }

  const palavras = reconstruirTranscricao(entrada.clipes, transcricoes);
  const r = analisarPalavras(palavras, entrada);
  return { ...r, avisos: [...avisos, ...r.avisos] };
}

/**
 * A mesma analise a partir de palavras ja no tempo da sequencia — o caminho
 * do programa Pro Edition, onde a fala vem do ElevenLabs e nao da transcricao
 * do Premiere.
 */
export function analisarPalavras(
  palavras: readonly PalavraEditada[],
  entrada: Omit<EntradaAnalise, "clipes" | "transcricoesJson">
): Analise {
  const avisos: string[] = [];
  const duracaoMinima = entrada.duracaoMinima ?? DURACAO_MINIMA;
  const scoreMinimo = entrada.scoreMinimo ?? SCORE_MINIMO;
  const frases = agruparEmFrases(palavras);

  const conceitos: Conceito[] = conceitosDeArquivos(entrada.biblioteca);
  if (conceitos.length === 0) avisos.push("Nenhum conceito encontrado no projeto.");

  const oportunidades: Oportunidade[] = [];
  for (const frase of frases) {
    if (frase.duracao < duracaoMinima) continue;

    const doTexto = casar(frase.texto, conceitos).filter((s) => s.score >= scoreMinimo);
    const sugestoes = [...doTexto, ...porLigacaoAprendida(frase, conceitos, entrada.ligacoes, doTexto)]
      .sort((a, b) => b.score - a.score)
      .slice(0, 3);
    if (sugestoes.length === 0) continue;

    if (frase.confiancaMinima < CONFIANCA_SUSPEITA) {
      avisos.push(
        `Trecho incerto em ${frase.inicio.toFixed(1)}s (confianca ${frase.confiancaMinima.toFixed(2)}): "${frase.texto}"`
      );
    }
    oportunidades.push({ frase, sugestoes });
  }

  return { palavras: palavras.length, frases, conceitos, oportunidades, avisos };
}
