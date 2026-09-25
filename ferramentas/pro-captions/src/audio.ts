/*
 * O que o export do audio da sequencia precisa saber, sem tocar no Premiere.
 *
 * Copiado de src/pausas.ts e src/wav.ts da raiz do Pro Edition, onde o export
 * ja foi provado no Premiere real (Auto Pausas, rodada 4: 865 s de audio em
 * 5,8 s). Copiado e nao importado porque o Pro Captions tambem roda como
 * plugin sozinho, e ai a raiz nao existe.
 *
 * Puro: nao conhece o Premiere, nao faz I/O.
 */

/** O preset de WAV mono 16 kHz que vem instalado com o Premiere. */
export const PRESET_WAV = "WAV_Mono_16bit_16kHz.epr";

/**
 * Onde procurar o preset, a pasta da versao que esta rodando primeiro.
 * `versaoHost` e o `uxp.host.version` ("25.6.6" -> "Adobe Premiere Pro 2025").
 *
 * So Windows, como o resto do Pro Edition.
 */
export function candidatosDoPreset(versaoHost: string, pastasAdobe: readonly string[]): string[] {
  const maior = Number.parseInt(versaoHost, 10);
  const daVersao = Number.isFinite(maior) ? `Adobe Premiere Pro ${2000 + maior}` : "";
  const outras = pastasAdobe
    .filter((n) => n.startsWith("Adobe Premiere Pro") && n !== daVersao)
    .sort()
    .reverse();
  return [daVersao, ...outras]
    .filter((n) => n !== "")
    .map((n) => `C:\\Program Files\\Adobe\\${n}\\Settings\\EncoderPresets\\${PRESET_WAV}`);
}

/**
 * O WAV ja terminou de ser escrito? O cabecalho RIFF diz o tamanho final; se
 * o arquivo ainda nao chegou nele, o Premiere continua gravando.
 */
export function wavCompleto(bytes: Uint8Array): boolean {
  if (bytes.byteLength < 12) return false;
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const riff = String.fromCharCode(v.getUint8(0), v.getUint8(1), v.getUint8(2), v.getUint8(3));
  return riff === "RIFF" && v.getUint32(4, true) + 8 === bytes.byteLength;
}

interface Pcm {
  readonly bytesPorSegundo: number;
  readonly bitsPorAmostra: number;
  /** Onde comecam as amostras e quantos bytes elas ocupam. */
  readonly inicio: number;
  readonly tamanho: number;
}

/** Le o cabecalho de um WAV PCM. `null` se nao for WAV legivel. */
function lerPcm(bytes: Uint8Array): Pcm | null {
  if (bytes.byteLength < 44) return null;
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const tag = (o: number): string =>
    String.fromCharCode(v.getUint8(o), v.getUint8(o + 1), v.getUint8(o + 2), v.getUint8(o + 3));
  if (tag(0) !== "RIFF" || tag(8) !== "WAVE") return null;

  let bytesPorSegundo = 0;
  let bitsPorAmostra = 0;
  let o = 12;
  while (o + 8 <= bytes.byteLength) {
    const id = tag(o);
    const tamanho = v.getUint32(o + 4, true);
    if (id === "fmt " && o + 24 <= bytes.byteLength) {
      bytesPorSegundo = v.getUint32(o + 16, true);
      bitsPorAmostra = v.getUint16(o + 22, true);
    }
    if (id === "data") {
      if (bytesPorSegundo === 0) return null;
      return { bytesPorSegundo, bitsPorAmostra, inicio: o + 8, tamanho: Math.min(tamanho, bytes.byteLength - o - 8) };
    }
    o += 8 + tamanho + (tamanho % 2);
  }
  return null;
}

/** So as amostras do WAV (o chunk `data`); o arquivo inteiro se nao for WAV legivel. */
export function somDoWav(bytes: Uint8Array): Uint8Array {
  const pcm = lerPcm(bytes);
  return pcm === null ? bytes : bytes.subarray(pcm.inicio, pcm.inicio + pcm.tamanho);
}

/** Duracao de um WAV PCM em segundos, lida do cabecalho. `null` se nao for WAV legivel. */
export function duracaoDoWav(bytes: Uint8Array): number | null {
  const pcm = lerPcm(bytes);
  return pcm === null ? null : pcm.tamanho / pcm.bytesPorSegundo;
}

/**
 * O audio esta mudo? Confere ANTES de mandar para o ElevenLabs, que cobra
 * pelo minuto mesmo sem fala nenhuma.
 *
 * Aconteceu de verdade em 2026-09-24: com a faixa A1 silenciada na timeline,
 * o export do Andro 19.09 saiu inteiro a -91 dB. Amostra espalhada pelo
 * arquivo (ate 200 mil pontos); o pico abaixo de -60 dBFS conta como mudo.
 * So entende 16 bits, que e o que o preset do plugin exporta.
 */
export function audioMudo(bytes: Uint8Array): boolean {
  const pcm = lerPcm(bytes);
  if (pcm === null || pcm.bitsPorAmostra !== 16) return false; // na duvida, nao bloqueia
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  const amostras = Math.floor(pcm.tamanho / 2);
  const passo = Math.max(1, Math.floor(amostras / 200000));
  let pico = 0;
  for (let i = 0; i < amostras; i += passo) {
    const a = Math.abs(v.getInt16(pcm.inicio + i * 2, true));
    if (a > pico) pico = a;
  }
  return pico < 33; // 32768 * 10^(-60/20) ~ 33
}
