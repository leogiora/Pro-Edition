/*
 * Auto B-roll fora do Premiere: a sequencia do Leo entra, a mesma sequencia
 * com os B-rolls na V2 sai — como XML.
 *
 * A regra e a do painel, sem copia (ferramentas/auto-broll): casamento pelo
 * nome do arquivo, sinonimos, o que o Leo ensinou, intensidade do take,
 * espacamento e nada por cima do que ja esta na V2. So a fala muda de origem:
 * ElevenLabs no lugar da transcricao do Premiere.
 *
 * Puro.
 */

import { analisarPalavras } from "../../ferramentas/auto-broll/src/analise.ts";
import { MEMORIA_VAZIA, type Memoria } from "../../ferramentas/auto-broll/src/aprendizado.ts";
import { fillScalePercent, relogio } from "../../ferramentas/auto-broll/src/domain.ts";
import { ritmo } from "../../ferramentas/auto-broll/src/intensidade.ts";
import { planejar, REGRAS_DENSAS, REGRAS_PADRAO, semSobrepor, type Colocacao, type Ocupado } from "../../ferramentas/auto-broll/src/plano.ts";
import type { PalavraEditada } from "../../ferramentas/pro-captions/src/transcript.ts";
import type { Clipe, Sequencia } from "./xml.ts";

export interface ArquivoBroll {
  readonly nome: string;
  readonly caminho: string;
  /** Em quadros da sequencia. */
  readonly duracaoQ: number;
  readonly largura: number;
  readonly altura: number;
  readonly canais: number;
}

export interface DadosBroll {
  /** O que o Leo aprovou e apagou (aprendizado.json do painel). */
  readonly memoria?: Memoria;
  /** Conceito -> termos que o Leo ensinou colocando B-roll na mao. */
  readonly ligacoes?: ReadonlyMap<string, readonly string[]>;
  /** Agitacao de cada arquivo (intensidade.json): take calmo x agitado pelo ritmo da fala. */
  readonly agitacao?: ReadonlyMap<string, number>;
  /** Afrouxar o espacamento para caber o maximo (o padrao do painel). */
  readonly densa?: boolean;
}

export interface ResultadoBroll {
  readonly sequencia: Sequencia;
  readonly colocacoes: readonly Colocacao[];
  /** Tudo que ficou de fora, com motivo: a recusa tambem se explica. */
  readonly descartes: readonly string[];
  readonly avisos: readonly string[];
}

export function colocarBroll(
  entrada: Sequencia,
  palavras: readonly PalavraEditada[],
  biblioteca: readonly ArquivoBroll[],
  dados: DadosBroll = {}
): ResultadoBroll {
  const { fps } = entrada;
  const analise = analisarPalavras(palavras, {
    biblioteca: biblioteca.map((b) => b.nome),
    ...(dados.ligacoes !== undefined ? { ligacoes: dados.ligacoes } : {}),
  });

  // O que ja esta na V2 manda: nada entra por cima, e o planejador sabe o que
  // ja foi usado para nao repetir take nem conceito.
  const v2 = entrada.video[1] ?? [];
  const ocupado: Ocupado[] = v2.map((c) => ({
    inicio: c.inicioQ / fps,
    fim: c.fimQ / fps,
    arquivo: c.midia.caminho.split(/[\\/]/).pop() ?? c.midia.caminho,
  }));

  const plano = planejar(
    analise.oportunidades,
    { caminhos: new Map(biblioteca.map((b) => [b.nome, b.caminho])) },
    dados.densa === false ? REGRAS_PADRAO : REGRAS_DENSAS,
    dados.memoria ?? MEMORIA_VAZIA,
    dados.agitacao !== undefined
      ? { porArquivo: dados.agitacao, ritmoDasFrases: analise.frases.map((f) => ritmo(f.palavras, f.duracao)) }
      : undefined,
    ocupado
  );
  const { entram, bloqueadas } = semSobrepor(plano.colocacoes, ocupado);

  const porNome = new Map(biblioteca.map((b) => [b.nome, b]));
  const descartes = [...plano.descartes, ...bloqueadas];
  const novos: Array<{ readonly colocacao: Colocacao; readonly clipe: Clipe }> = [];
  for (const c of entram) {
    const b = porNome.get(c.arquivo);
    if (b === undefined) continue;
    const inicioQ = Math.round(c.inicio * fps);
    const fimQ = Math.min(inicioQ + Math.round(c.duracao * fps), inicioQ + b.duracaoQ);
    if (fimQ <= inicioQ) {
      descartes.push(`${relogio(c.inicio)} ${c.conceito}: ${b.nome} curto demais`);
      continue;
    }
    novos.push({
      colocacao: c,
      clipe: {
        midia: { caminho: b.caminho, duracaoQ: b.duracaoQ, largura: b.largura, altura: b.altura, canais: b.canais },
        inicioQ,
        fimQ,
        entradaQ: 0,
        // Cobrir a tela (o painel faz o mesmo). Sem clipe de audio: o B-roll entra mudo.
        escala: Math.round(fillScalePercent({ width: b.largura, height: b.altura }, { width: entrada.largura, height: entrada.altura }) * 100) / 100,
      },
    });
  }
  const ehNovo = new Set(novos.map((n) => n.clipe));

  // Arredondar para quadro pode encostar dois B-rolls vizinhos por cima um do outro.
  const v2Nova: Clipe[] = [];
  for (const c of [...v2, ...novos.map((n) => n.clipe)].sort((a, b) => a.inicioQ - b.inicioQ)) {
    const anterior = v2Nova[v2Nova.length - 1];
    if (anterior !== undefined && c.inicioQ < anterior.fimQ) {
      if (ehNovo.has(c)) {
        descartes.push(`${relogio(c.inicioQ / fps)} ${c.midia.caminho.split(/[\\/]/).pop()}: encostaria no anterior`);
        continue;
      }
      // Um novo tinha entrado antes de um que o Leo ja tinha: o dele fica.
      v2Nova.pop();
    }
    v2Nova.push(c);
  }

  return {
    sequencia: {
      ...entrada,
      nome: `${entrada.nome} com B-roll`,
      video: [entrada.video[0] ?? [], v2Nova, ...entrada.video.slice(2)],
    },
    colocacoes: novos.filter((n) => v2Nova.includes(n.clipe)).map((n) => n.colocacao),
    descartes,
    avisos: analise.avisos,
  };
}
