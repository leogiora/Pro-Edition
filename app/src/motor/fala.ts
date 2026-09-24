/*
 * A fala de um arquivo: WAV pelo ffmpeg, palavras pelo ElevenLabs (guardadas
 * pela assinatura do audio). Pausas, B-roll e legenda leem daqui.
 */

import { basename } from "node:path";

import { palavrasDoElevenLabs } from "../../../ferramentas/pro-captions/src/elevenlabs.ts";
import type { PalavraEditada } from "../../../ferramentas/pro-captions/src/transcript.ts";
import type { Config } from "./config.ts";
import { transcreverWav } from "./legendas.ts";
import { audioParaTranscrever } from "./midia.ts";

export async function falaDoArquivo(
  caminho: string,
  quem: string,
  cfg: Config,
  avisar: (texto: string) => void
): Promise<{ wav: Uint8Array; palavras: PalavraEditada[] }> {
  avisar(`lendo o áudio ${quem}`);
  const wav = await audioParaTranscrever(caminho);
  const { json } = await transcreverWav(wav, cfg, (t) => avisar(`${t} ${quem}`));
  return { wav, palavras: palavrasDoElevenLabs(json) ?? [] };
}

/** Todos os arquivos, um por vez (o WAV de cada um e descartado logo). */
export async function falaDosArquivos(
  arquivos: readonly string[],
  cfg: Config,
  avisar: (texto: string) => void
): Promise<Map<string, PalavraEditada[]>> {
  const fala = new Map<string, PalavraEditada[]>();
  for (const [i, arquivo] of arquivos.entries()) {
    const { palavras } = await falaDoArquivo(arquivo, `${i + 1}/${arquivos.length} ${basename(arquivo)}`, cfg, avisar);
    fala.set(arquivo, palavras);
  }
  return fala;
}
