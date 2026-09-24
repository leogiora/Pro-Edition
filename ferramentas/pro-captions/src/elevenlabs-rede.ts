/*
 * A chamada de rede ao ElevenLabs. Unico arquivo que fala com a internet.
 *
 * Exige no manifest:
 *   "requiredPermissions": { "network": { "domains": ["https://api.elevenlabs.io"] } }
 * Sem isso o UXP bloqueia o `fetch` antes de sair do computador.
 */

import {
  camposDoPedido,
  ELEVENLABS,
  explicarErro,
  montarMultipart,
  recusouTermos,
} from "./elevenlabs.ts";

async function enviar(
  bytes: Uint8Array,
  chave: string,
  termos: readonly string[],
  comTermos: boolean
): Promise<{ status: number; texto: string }> {
  const fronteira = `----procaptions${Date.now().toString(16)}${Math.random().toString(16).slice(2)}`;
  const { corpo, contentType } = montarMultipart(
    camposDoPedido(termos, comTermos),
    { nome: "sequencia.wav", tipo: "audio/wav", bytes },
    fronteira
  );
  const resposta = await fetch(ELEVENLABS.url, {
    method: "POST",
    headers: { "xi-api-key": chave, "Content-Type": contentType, Accept: "application/json" },
    // `corpo` e um Uint8Array novo: o buffer inteiro e so dele.
    body: corpo.buffer as ArrayBuffer,
  });
  return { status: resposta.status, texto: await resposta.text() };
}

/**
 * Manda o WAV e devolve o JSON cru da resposta.
 *
 * Se a API recusar os termos-chave, tenta de novo sem eles e avisa no log:
 * transcrever sem termos ainda e muito melhor que a transcricao do Premiere.
 */
export async function transcreverNoElevenLabs(
  bytes: Uint8Array,
  chave: string,
  termos: readonly string[],
  registrar: (linha: string) => void
): Promise<string> {
  let r = await enviar(bytes, chave, termos, termos.length > 0);
  if (r.status >= 200 && r.status < 300) return r.texto;

  if (termos.length > 0 && recusouTermos(r.status, r.texto)) {
    registrar(`ElevenLabs recusou os termos-chave (${r.status}); tentando sem eles`);
    r = await enviar(bytes, chave, termos, false);
    if (r.status >= 200 && r.status < 300) return r.texto;
  }
  throw new Error(explicarErro(r.status, r.texto));
}
