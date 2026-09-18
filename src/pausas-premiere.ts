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
 * O que a primeira rodada da sonda provou, no Premiere 26 (fps 23,976):
 *
 *  - `createCloneTrackItemAction(item, offset, 0, 0, true, false)` CORTA o
 *    clipe no offset pedido: 1 pedaco virou [0-1.00] + [1.00-101.64]. O clone
 *    e do tamanho do original, entao o ultimo pedaco passa do fim (101.64 >
 *    100.64) e pede `createSetEndAction`.
 *  - O clone atinge SO a faixa do item. A A1 continuou inteira: cada faixa
 *    precisa da propria acao, como o Podcast AutoCut ja faz com as quatro.
 *  - `createSetInPointAction` grava exatamente o que se pede (pedi 2.00, a
 *    timeline devolveu 2.00) e apara a CABECA no lugar: o inicio andou de 1.00
 *    para 3.00 e deixou buraco. Nao puxa o que vem depois.
 *  - `createRemoveItemsAction(selecao, true, ANY)` nao lancou e o pedaco sumiu,
 *    mas ele era o ULTIMO da timeline — nao provou que o ripple fecha o buraco.
 *
 * Esta segunda rodada existe so para essa ultima pergunta, e ja no formato do
 * corte de verdade: corta V1 e A1 nos mesmos dois pontos e remove o pedaco DO
 * MEIO. Se o terceiro pedaco andar para tras e as duas faixas continuarem
 * iguais, a mecanica da ferramenta e fatiar + ripple.
 */
export async function diagnostico(): Promise<string[]> {
  const linhas: string[] = [];

  const posicoes = async (video: boolean): Promise<string> => {
    const { sequence } = await ativa();
    const itens = await itensDa(sequence, video, 0);
    const lidos = await Promise.all(
      itens.map(async (i) => {
        const inicio = (await i.getStartTime()).seconds;
        const fim = (await i.getEndTime()).seconds;
        const entrada = (await i.getInPoint()).seconds;
        return `${inicio.toFixed(2)}-${fim.toFixed(2)} in=${entrada.toFixed(2)}`;
      })
    );
    return `${itens.length} pedaco(s) [${lidos.join(" | ")}]`;
  };

  const retrato = async (rotulo: string) => {
    linhas.push(`${rotulo}: V1 ${await posicoes(true)}`, `${rotulo}: A1 ${await posicoes(false)}`);
  };

  /** Corta as DUAS faixas no mesmo instante, numa transacao so. */
  const cortarEm = async (segundos: number) => {
    const { project, sequence } = await ativa();
    const editor = await ppro.SequenceEditor.getEditor(sequence);
    const alvos: Array<{ item: ItemLike; offset: unknown }> = [];

    for (const video of [true, false]) {
      for (const item of await itensDa(sequence, video, 0)) {
        const inicio = (await item.getStartTime()).seconds;
        const fim = (await item.getEndTime()).seconds;
        // So o pedaco que CONTEM o instante, e nunca em cima de uma borda.
        if (segundos <= inicio || segundos >= fim) continue;
        alvos.push({ item, offset: await ppro.TickTime.createWithSeconds(segundos - inicio) });
      }
    }
    comTransacao(project as never, `Auto Pausas: sonda corte em ${segundos}s`, (adicionar) => {
      for (const a of alvos) adicionar(editor.createCloneTrackItemAction(a.item, a.offset, 0, 0, true, false));
    });
    linhas.push(`corte em ${segundos.toFixed(2)}s: ${alvos.length} faixa(s) atingida(s), esperado 2`);
  };

  await retrato("antes");

  try {
    await cortarEm(2);
    await cortarEm(4);
  } catch (e) {
    linhas.push(`corte lancou: ${(e as Error)?.message ?? String(e)}`);
  }
  await retrato("depois dos 2 cortes");

  // Remover o pedaco DO MEIO (o que comeca em 2s) nas duas faixas de uma vez.
  try {
    const { project, sequence } = await ativa();
    const editor = await ppro.SequenceEditor.getEditor(sequence);
    const selecao = await (sequence as { getSelection: () => Promise<any> }).getSelection();
    for (const velho of await selecao.getTrackItems()) selecao.removeItem(velho);

    let escolhidos = 0;
    for (const video of [true, false]) {
      for (const item of await itensDa(sequence, video, 0)) {
        const inicio = (await item.getStartTime()).seconds;
        if (inicio < 1.99 || inicio > 2.01) continue;
        selecao.addItem(item, false);
        escolhidos++;
      }
    }
    linhas.push(`selecionados para remover: ${escolhidos} (esperado 2, um por faixa)`);

    comTransacao(project as never, "Auto Pausas: sonda ripple do meio", (adicionar) => {
      adicionar(editor.createRemoveItemsAction(selecao, true, ppro.Constants.MediaType.ANY));
    });
  } catch (e) {
    linhas.push(`ripple lancou: ${(e as Error)?.message ?? String(e)}`);
  }
  await retrato("depois do ripple do meio");

  linhas.push(
    "LEITURA: se o 3o pedaco passou a comecar em 2,00s nas DUAS faixas, o ripple fecha o buraco",
    "e a mecanica e fatiar + remover. Se ele continuou em 4,00s, o ripple so apaga.",
    'Desfaça com Ctrl+Z até a timeline voltar ao estado "antes".'
  );
  return linhas;
}
