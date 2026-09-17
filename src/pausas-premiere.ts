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

/**
 * Sonda temporaria (sai na Task 7 do plano). Corta UM pedaco no meio do clipe
 * pelas duas mecanicas possiveis e RELE a timeline em cada passo.
 *
 * A licao do Auto Split: marcar "ok" porque a chamada nao lancou deixou passar
 * o bug do 32767 duas vezes. Aqui cada linha traz o valor lido de volta, e cada
 * passo tem o proprio try/catch — o passo 3 falhar nao pode apagar a resposta
 * dos passos 1 e 2.
 */
export async function diagnostico(): Promise<string[]> {
  const linhas: string[] = [];

  const retrato = async (rotulo: string) => {
    const v = await lerClipes(0);
    const { sequence } = await ativa();
    const a = await itensDa(sequence, false, 0);
    const audio = await Promise.all(
      a.map(async (i) => `${(await i.getStartTime()).seconds.toFixed(2)}-${(await i.getEndTime()).seconds.toFixed(2)}`)
    );
    linhas.push(
      `${rotulo}: V1 ${v.length} pedaco(s) [${v
        .map((c) => `${c.startSeconds.toFixed(2)}-${c.endSeconds.toFixed(2)} in=${c.inPointSeconds.toFixed(2)}`)
        .join(" | ")}]`,
      `${rotulo}: A1 ${a.length} pedaco(s) [${audio.join(" | ")}]`
    );
    return v;
  };

  const inicial = await retrato("antes");
  const base = inicial[0];
  if (!base) return [...linhas, "V1 vazia: ponha a gravação na V1 antes de rodar a sonda."];

  const info = await getSequenceInfo();

  // 1. Clone com deslocamento de 1s: ele cai onde foi pedido?
  try {
    const { project, sequence } = await ativa();
    const editor = await ppro.SequenceEditor.getEditor(sequence);
    const item = (await itensDa(sequence, true, 0))[0];
    const umSegundo = await ppro.TickTime.createWithSeconds(1);
    comTransacao(project as never, "Auto Pausas: sonda clone", (adicionar) => {
      adicionar(editor.createCloneTrackItemAction(item, umSegundo, 0, 0, true, false));
    });
  } catch (e) {
    linhas.push(`1) clone lancou: ${(e as Error)?.message ?? String(e)}`);
  }
  const depoisDoClone = await retrato("1) depois do clone +1s");
  linhas.push(
    depoisDoClone.length > inicial.length
      ? `1) clone criou pedaco novo comecando em ${depoisDoClone[1]?.startSeconds.toFixed(2)}s (pedi 1,00s)`
      : "1) clone NAO dividiu o clipe."
  );

  // 2. setInPoint no segundo pedaco: o ponto de entrada muda de verdade?
  const alvoIn = base.inPointSeconds + 2;
  try {
    const { project, sequence } = await ativa();
    const item = (await itensDa(sequence, true, 0))[1];
    if (!item) throw new Error("nao ha segundo pedaco para testar");
    const alvo = await ppro.TickTime.createWithSeconds(alvoIn);
    comTransacao(project as never, "Auto Pausas: sonda in point", (adicionar) => {
      adicionar(item.createSetInPointAction(alvo));
    });
  } catch (e) {
    linhas.push(`2) setInPoint lancou: ${(e as Error)?.message ?? String(e)}`);
  }
  const depoisDoIn = await retrato("2) depois do setInPoint +2s");
  linhas.push(`2) in point do 2o pedaco: pedi ${alvoIn.toFixed(2)}, timeline diz ${depoisDoIn[1]?.inPointSeconds.toFixed(2)}`);

  // 3. Remover o segundo pedaco com ripple: a timeline fecha o buraco?
  try {
    const { project, sequence } = await ativa();
    const editor = await ppro.SequenceEditor.getEditor(sequence);
    const item = (await itensDa(sequence, true, 0))[1];
    if (!item) throw new Error("nao ha segundo pedaco para remover");
    // getSelection devolve uma TrackItemSelection viva: limpar e pedir so o
    // alvo evita depender de createEmptySelection, cuja assinatura tipada e por
    // callback e nunca foi usada neste projeto.
    const selecao = await (sequence as { getSelection: () => Promise<any> }).getSelection();
    for (const velho of await selecao.getTrackItems()) selecao.removeItem(velho);
    selecao.addItem(item, false);
    comTransacao(project as never, "Auto Pausas: sonda ripple", (adicionar) => {
      adicionar(editor.createRemoveItemsAction(selecao, true, ppro.Constants.MediaType.ANY));
    });
  } catch (e) {
    linhas.push(`3) ripple indisponivel: ${(e as Error)?.message ?? String(e)}`);
  }
  const depoisDoRipple = await retrato("3) depois do ripple");
  linhas.push(
    `3) ripple: V1 ficou com ${depoisDoRipple.length} pedaco(s); ultimo termina em ${depoisDoRipple[
      depoisDoRipple.length - 1
    ]?.endSeconds.toFixed(2)}s`,
    `fps da sequencia: ${info.fps}. Desfaça com Ctrl+Z até a timeline voltar ao estado "antes".`
  );
  return linhas;
}
