/*
 * ffprobe e ffmpeg: o que o Premiere fazia por dentro (ler a midia, exportar
 * o audio) e que fora dele vira um processo externo.
 *
 * O ffmpeg vem do PATH (winget, na maquina do Leo). `PRO_EDITION_FFMPEG`
 * aponta para outro, quando o programa for instalado em maquina sem ele.
 */

import { execFile } from "node:child_process";
import { readFile, rm } from "node:fs/promises";
import { tmpdir } from "node:os";
import { dirname, join } from "node:path";

const ffmpeg = process.env.PRO_EDITION_FFMPEG ?? "ffmpeg";
const ffprobe = process.env.PRO_EDITION_FFMPEG
  ? join(dirname(process.env.PRO_EDITION_FFMPEG), "ffprobe")
  : "ffprobe";

function rodar(exe: string, args: readonly string[]): Promise<Buffer> {
  return new Promise((ok, falha) => {
    execFile(exe, args, { encoding: "buffer", maxBuffer: 1024 * 1024 * 1024, windowsHide: true }, (erro, saida, stderr) => {
      if (erro === null) return ok(saida);
      if ((erro as NodeJS.ErrnoException).code === "ENOENT") {
        return falha(new Error(`${exe} nao encontrado. Instale o ffmpeg (winget install ffmpeg) e abra o programa de novo.`));
      }
      falha(new Error(`${exe} falhou: ${stderr.toString("utf8").trim().split("\n").slice(-3).join(" | ")}`));
    });
  });
}

export interface InfoMidia {
  readonly duracaoS: number;
  /** null quando o arquivo nao tem video. */
  readonly fps: number | null;
  readonly largura: number | null;
  readonly altura: number | null;
  readonly canais: number;
}

/** "30000/1001" -> 29.97 */
const fracao = (s: string | undefined): number | null => {
  const [a, b] = (s ?? "").split("/").map(Number);
  return a && b ? a / b : null;
};

export async function sondar(caminho: string): Promise<InfoMidia> {
  const saida = await rodar(ffprobe, ["-v", "error", "-show_streams", "-show_format", "-of", "json", caminho]);
  const j = JSON.parse(saida.toString("utf8")) as {
    streams?: Array<{ codec_type?: string; width?: number; height?: number; avg_frame_rate?: string; channels?: number; side_data_list?: Array<{ rotation?: number }> }>;
    format?: { duration?: string };
  };
  const video = j.streams?.find((s) => s.codec_type === "video");
  const audio = j.streams?.find((s) => s.codec_type === "audio");
  // Celular grava deitado e marca a rotacao: o Premiere mostra em pe.
  const girado = Math.abs(video?.side_data_list?.find((d) => d.rotation !== undefined)?.rotation ?? 0) === 90;
  return {
    duracaoS: Number(j.format?.duration ?? 0),
    fps: fracao(video?.avg_frame_rate),
    largura: (girado ? video?.height : video?.width) ?? null,
    altura: (girado ? video?.width : video?.height) ?? null,
    canais: audio?.channels ?? 0,
  };
}

/**
 * Audio de qualquer midia -> WAV mono 16 kHz, o formato que ja foi provado
 * com o ElevenLabs. Passa por arquivo temporario e nao por pipe: no pipe o
 * ffmpeg nao sabe o tamanho final e o cabecalho do WAV sai sem ele.
 */
export async function audioParaTranscrever(caminho: string): Promise<Uint8Array> {
  const temp = join(tmpdir(), `pro-edition-${process.pid}-${Date.now()}.wav`);
  try {
    await rodar(ffmpeg, ["-v", "error", "-y", "-i", caminho, "-vn", "-ac", "1", "-ar", "16000", "-c:a", "pcm_s16le", temp]);
    return new Uint8Array(await readFile(temp));
  } finally {
    await rm(temp, { force: true });
  }
}
