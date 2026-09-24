/*
 * Legendas fora do Premiere: midia (ou JSON do ElevenLabs) entra, .srt sai.
 *
 * O nucleo e o do Pro Captions, sem copia: segmentacao, preco, correcao de
 * texto e o pedido ao ElevenLabs. So a ponta mudou — o audio vem do ffmpeg e
 * o .srt vai para a pasta do video, em vez do PluginData.
 */

import { writeFile } from "node:fs/promises";
import { basename, dirname, extname, join } from "node:path";
import { readFile } from "node:fs/promises";

import { audioMudo } from "../../../ferramentas/pro-captions/src/audio.ts";
import { assinaturaDoAudio, palavrasDoElevenLabs, termosChave } from "../../../ferramentas/pro-captions/src/elevenlabs.ts";
import { transcreverNoElevenLabs } from "../../../ferramentas/pro-captions/src/elevenlabs-rede.ts";
import { blocosParaSrt, gerarBlocos } from "../../../ferramentas/pro-captions/src/pipeline.ts";
import { PRESET_ELEVENLABS } from "../../../ferramentas/pro-captions/src/preset.ts";
import { validar, type BlocoLegenda } from "../../../ferramentas/pro-captions/src/segmentar.ts";
import type { Config } from "./config.ts";
import { audioParaTranscrever } from "./midia.ts";

export type { BlocoLegenda };

export interface Legendas {
  readonly blocos: BlocoLegenda[];
  /** Validacao final da spec. Vazio = pode salvar. */
  readonly problemas: string[];
  /** De onde veio a fala, para o editor saber se pagou. */
  readonly origem: "arquivo json" | "guardada" | "elevenlabs";
}

async function transcricao(
  caminho: string,
  cfg: Config,
  avisar: (texto: string) => void
): Promise<{ json: string; origem: Legendas["origem"] }> {
  if (extname(caminho).toLowerCase() === ".json") {
    return { json: await readFile(caminho, "utf8"), origem: "arquivo json" };
  }

  avisar("extraindo o áudio");
  const wav = await audioParaTranscrever(caminho);
  if (audioMudo(wav)) throw new Error("O áudio deste arquivo está mudo. Nada foi enviado ao ElevenLabs.");

  const assinatura = assinaturaDoAudio(wav);
  const guardada = await cfg.transcricao(assinatura);
  if (guardada !== null) return { json: guardada, origem: "guardada" };

  const chave = await cfg.chave();
  if (chave === null) throw new Error("Falta a chave do ElevenLabs. Cole a chave (começa com sk_) em Configurações.");

  avisar("transcrevendo no ElevenLabs");
  const json = await transcreverNoElevenLabs(wav, chave, termosChave(PRESET_ELEVENLABS), avisar);
  await cfg.guardarTranscricao(assinatura, json);
  return { json, origem: "elevenlabs" };
}

export async function gerarLegendas(caminho: string, cfg: Config, avisar: (texto: string) => void): Promise<Legendas> {
  const { json, origem } = await transcricao(caminho, cfg, avisar);
  const palavras = palavrasDoElevenLabs(json);
  if (palavras === null) throw new Error("A resposta do ElevenLabs não é um JSON válido.");
  if (palavras.length === 0) throw new Error("Nenhuma palavra reconhecida neste arquivo.");

  avisar("montando legendas");
  const blocos = gerarBlocos(palavras, [], PRESET_ELEVENLABS);
  return { blocos, problemas: validar(blocos, PRESET_ELEVENLABS), origem };
}

/**
 * Texto e preco em arquivos separados, cada um na sua faixa de legenda: o
 * estilo da faixa resolve o tamanho (96 no texto, 150 no preco) — D-16.
 */
export async function salvarSrts(caminho: string, blocos: readonly BlocoLegenda[]): Promise<string[]> {
  const problemas = validar(blocos, PRESET_ELEVENLABS);
  if (problemas.length > 0) throw new Error(`Legenda reprovada na validação: ${problemas.slice(0, 3).join("; ")}`);

  const base = join(dirname(caminho), basename(caminho, extname(caminho)));
  const saida: string[] = [];
  const normais = blocos.filter((b) => b.estilo === "normal");
  const precos = blocos.filter((b) => b.estilo === "preco");
  await writeFile(`${base} - legendas.srt`, blocosParaSrt(normais), "utf8");
  saida.push(`${base} - legendas.srt`);
  if (precos.length > 0) {
    await writeFile(`${base} - precos.srt`, blocosParaSrt(precos), "utf8");
    saida.push(`${base} - precos.srt`);
  }
  return saida;
}
