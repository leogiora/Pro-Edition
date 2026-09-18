/*
 * Adapter do Auto Pausas. Le a sequencia e a transcricao pelo adapter do Auto
 * B-roll e devolve as palavras em tempo de sequencia.
 *
 * Nenhuma regra de corte mora aqui: quem decide o que sai e src/pausas.ts.
 */

import { comTransacao, getSequenceInfo, lerClipes, lerTranscricoes } from "../ferramentas/auto-broll/src/premiere.ts";
import { parseTranscricao, reconstruirTranscricao } from "../ferramentas/auto-broll/src/transcript.ts";
import { montarPalavras, type Palavra } from "./pausas.ts";

declare function require(id: string): unknown;
/* eslint-disable @typescript-eslint/no-explicit-any */
const ppro = require("premierepro") as any;
/* eslint-enable @typescript-eslint/no-explicit-any */

const CLIP = 1; // ppro.Constants.TrackItemType.CLIP

interface ItemLike {
  getStartTime: () => Promise<{ seconds: number }>;
  getEndTime: () => Promise<{ seconds: number }>;
  getInPoint: () => Promise<{ seconds: number }>;
  getOutPoint: () => Promise<{ seconds: number }>;
  createSetInPointAction: (t: unknown) => unknown;
  createSetEndAction: (t: unknown) => unknown;
}

interface SeqFaixas {
  getVideoTrack: (i: number) => Promise<{ getTrackItems: (t: number, e: boolean) => Promise<ItemLike[]> } | null>;
  getAudioTrack: (i: number) => Promise<{ getTrackItems: (t: number, e: boolean) => Promise<ItemLike[]> } | null>;
}

async function ativa(): Promise<{ project: unknown; sequence: unknown }> {
  const project = await ppro.Project.getActiveProject();
  if (!project) throw new Error("Nenhum projeto aberto.");
  const sequence = await project.getActiveSequence();
  if (!sequence) throw new Error("Nenhuma sequência ativa. Abra a sequência da gravação.");
  return { project, sequence };
}

/** Itens de uma faixa, em ordem de tempo — `getTrackItems` nao promete ordem. */
async function itensDa(sequence: unknown, video: boolean, indice: number): Promise<ItemLike[]> {
  const seq = sequence as SeqFaixas;
  const faixa = video ? await seq.getVideoTrack(indice) : await seq.getAudioTrack(indice);
  if (!faixa) return [];
  const itens = await faixa.getTrackItems(CLIP, false);
  const medidos = await Promise.all(itens.map(async (i) => ({ i, s: (await i.getStartTime()).seconds })));
  return medidos.sort((a, b) => a.s - b.s).map((m) => m.i);
}

export interface Gravacao {
  readonly nomeSequencia: string;
  readonly fps: number;
  readonly duracaoQ: number;
  readonly palavras: readonly Palavra[];
}

/**
 * A ferramenta so roda na gravacao bruta. Cada recusa diz o que fazer: "nao
 * deu" sem instrucao vira pergunta para mim depois.
 */
export async function lerGravacao(): Promise<Gravacao> {
  const info = await getSequenceInfo();
  const clipes = await lerClipes(0);

  if (clipes.length === 0) {
    throw new Error("Nenhum clipe na V1. Ponha a gravação na V1 com o áudio na A1.");
  }
  if (clipes.length > 1) {
    throw new Error(
      `A V1 tem ${clipes.length} clipes. O Auto Pausas roda na gravação bruta, antes de cortar takes, B-roll, música e legenda.`
    );
  }

  const clipe = clipes[0]!;
  const { transcricoes, falhas } = await lerTranscricoes([clipe.sourceName]);
  const json = transcricoes.get(clipe.sourceName);
  if (!json) {
    const motivo = falhas.find((f) => f.nome === clipe.sourceName)?.motivo ?? "sem transcrição";
    throw new Error(
      `"${clipe.sourceName}" não tem transcrição (${motivo}). No Premiere: painel Texto > Transcrever, e rode de novo.`
    );
  }
  const transcricao = parseTranscricao(json);
  if (!transcricao) {
    throw new Error(`A transcrição de "${clipe.sourceName}" veio num formato que não consegui ler.`);
  }

  const palavras = montarPalavras(reconstruirTranscricao([clipe], new Map([[clipe.sourceName, transcricao]])));
  if (palavras.length === 0) {
    throw new Error("A transcrição não tem nenhuma palavra dentro deste trecho da timeline.");
  }

  return {
    nomeSequencia: info.name,
    fps: info.fps,
    duracaoQ: Math.round((clipe.endSeconds - clipe.startSeconds) * info.fps),
    palavras,
  };
}

// --------------------------------------------------------------- sonda

/*
 * O que as duas primeiras rodadas provaram, no Premiere 26 (fps 23,976):
 *
 *  1. `createCloneTrackItemAction(item, offset, 0, 0, true, false)` CORTA o
 *     clipe no offset pedido. Atinge SO a faixa do item: V1 e A1 precisam cada
 *     uma da sua acao (a A1 ficou inteira quando so a V1 foi clonada).
 *  2. `createRemoveItemsAction(selecao, true, ANY)` FECHA o buraco: removendo o
 *     pedaco do meio ([2-4] de tres pedacos), o terceiro andou de 4,00 para
 *     2,00 nas DUAS faixas e o fim caiu exatamente 2 s. Sincronia mantida.
 *  3. Todo pedaco nasce com `in=0.00`, herdado do pai. Um clipe mostra
 *     `in + (t - inicio)` da midia, entao um pedaco com in errado mostra o
 *     video desde o comeco de novo. Isso PRECISA ser corrigido.
 *  4. `createSetInPointAction` grava o valor exato pedido, mas na rodada 1 ele
 *     APAROU A CABECA: o pedaco andou de 1,00 para 3,00 ao receber in=2,00.
 *     So que aquele pedaco era o ultimo e passava do fim da midia (101,64 num
 *     arquivo de 100,64), o que pode explicar o comportamento.
 *
 * Esta rodada decide o ponto 4 num pedaco do MEIO, que e o caso real, e testa
 * o `createMoveAction` como plano de recuperacao caso o pedaco ande.
 */
export async function diagnostico(): Promise<string[]> {
  const linhas: string[] = [];

  const medir = async (video: boolean) => {
    const { sequence } = await ativa();
    const itens = await itensDa(sequence, video, 0);
    return Promise.all(
      itens.map(async (i) => ({
        item: i,
        inicio: (await i.getStartTime()).seconds,
        fim: (await i.getEndTime()).seconds,
        entrada: (await i.getInPoint()).seconds,
        saida: (await i.getOutPoint()).seconds,
      }))
    );
  };

  const retrato = async (rotulo: string) => {
    for (const [nome, video] of [
      ["V1", true],
      ["A1", false],
    ] as const) {
      const pecas = await medir(video);
      linhas.push(
        `${rotulo}: ${nome} ${pecas.length}x [${pecas
          .map((p) => `${p.inicio.toFixed(2)}-${p.fim.toFixed(2)} in=${p.entrada.toFixed(2)} out=${p.saida.toFixed(2)}`)
          .join(" | ")}]`
      );
    }
  };

  const cortarEm = async (segundos: number) => {
    const { project, sequence } = await ativa();
    const editor = await ppro.SequenceEditor.getEditor(sequence);
    const alvos: Array<{ item: ItemLike; offset: unknown }> = [];
    for (const video of [true, false]) {
      for (const p of await medir(video)) {
        if (segundos <= p.inicio || segundos >= p.fim) continue;
        alvos.push({ item: p.item, offset: await ppro.TickTime.createWithSeconds(segundos - p.inicio) });
      }
    }
    comTransacao(project as never, `Auto Pausas: sonda corte em ${segundos}s`, (adicionar) => {
      for (const a of alvos) adicionar(editor.createCloneTrackItemAction(a.item, a.offset, 0, 0, true, false));
    });
  };

  await retrato("antes");
  try {
    await cortarEm(2);
    await cortarEm(4);
  } catch (e) {
    linhas.push(`corte lancou: ${(e as Error)?.message ?? String(e)}`);
  }
  await retrato("A) 3 pedacos");

  // A pergunta da rodada: num pedaco do MEIO, setInPoint alinha o conteudo sem
  // mover, ou apara a cabeca e empurra o pedaco para a direita?
  try {
    const { project } = await ativa();
    const meio = (await medir(true)).find((p) => Math.abs(p.inicio - 2) < 0.01);
    if (!meio) throw new Error("nao achei o pedaco que comeca em 2s");
    const alvo = await ppro.TickTime.createWithSeconds(2);
    comTransacao(project as never, "Auto Pausas: sonda in point no meio", (adicionar) => {
      adicionar(meio.item.createSetInPointAction(alvo));
    });
  } catch (e) {
    linhas.push(`setInPoint lancou: ${(e as Error)?.message ?? String(e)}`);
  }
  const depoisDoIn = await medir(true);
  await retrato("B) depois do setInPoint(2s) no pedaco do meio");
  const doMeio = depoisDoIn.find((p) => Math.abs(p.entrada - 2) < 0.01);
  linhas.push(
    doMeio && Math.abs(doMeio.inicio - 2) < 0.01
      ? "B) LEITURA: o pedaco FICOU em 2,00s com in=2,00 — alinha sem mover. Otimo."
      : `B) LEITURA: o pedaco ANDOU para ${doMeio?.inicio.toFixed(2)}s — setInPoint apara a cabeca.`
  );

  // Plano de recuperacao: createMoveAction existe na tipagem mas nunca foi
  // usado neste projeto. Tento levar o pedaco de volta para 2,00s.
  if (doMeio && Math.abs(doMeio.inicio - 2) >= 0.01) {
    try {
      const { project } = await ativa();
      const atual = doMeio.inicio;
      const destino = await ppro.TickTime.createWithSeconds(2);
      comTransacao(project as never, "Auto Pausas: sonda move", (adicionar) => {
        adicionar((doMeio.item as unknown as { createMoveAction: (t: unknown) => unknown }).createMoveAction(destino));
      });
      const agora = (await medir(true)).find((p) => Math.abs(p.entrada - 2) < 0.01);
      linhas.push(
        `C) move(2,00s): pedaco saiu de ${atual.toFixed(2)} e foi para ${agora?.inicio.toFixed(2)} ` +
          "(se foi para 4,00 o valor e relativo, se foi para 2,00 e absoluto)"
      );
    } catch (e) {
      linhas.push(`C) move lancou: ${(e as Error)?.message ?? String(e)}`);
    }
    await retrato("C) depois do move");
  }

  linhas.push('Desfaça com Ctrl+Z até a timeline voltar ao estado "antes".');
  return linhas;
}
