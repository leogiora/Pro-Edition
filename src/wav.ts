/*
 * Leitura de WAV multicanal — o suficiente para saber QUANDO cada canal tem
 * voz, nao para reproduzir audio.
 *
 * Existe porque o UXP nao entrega PCM da timeline e o `.mkv` do gravador tem
 * audio comprimido. Um WAV exportado do Premiere resolve os dois: e PCM cru,
 * e mantem cada microfone no seu canal.
 *
 * Puro: recebe bytes, devolve numeros. Nao conhece Premiere nem disco.
 */

/** Nivel de cada canal ao longo do tempo, em dB, por janela de tempo fixa. */
export interface Janelas {
  readonly taxa: number;
  readonly janelaMs: number;
  /** `db[canal][janela]`. -Infinity nunca aparece: silencio absoluto vira PISO_DB. */
  readonly db: readonly (readonly number[])[];
}

/** Abaixo disto e silencio digital, e log10(0) seria -Infinity. */
export const PISO_DB = -120;

const PCM = 1;
const FLOAT = 3;
const EXTENSIVEL = 0xfffe;

function texto(v: DataView, offset: number): string {
  return String.fromCharCode(v.getUint8(offset), v.getUint8(offset + 1), v.getUint8(offset + 2), v.getUint8(offset + 3));
}

/**
 * O export pode devolver a promessa antes de fechar o arquivo, e o cabecalho
 * RIFF so recebe o tamanho final no fechamento. Completo = o tamanho declarado
 * bate com o que esta no disco.
 */
export function wavCompleto(bytes: Uint8Array): boolean {
  if (bytes.byteLength < 12) return false;
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  return texto(v, 0) === "RIFF" && v.getUint32(4, true) + 8 === bytes.byteLength;
}

/**
 * Uma amostra normalizada em -1..1.
 *
 * O Premiere exporta WAV em 16, 24 ou 32 bits, e em 32 tanto inteiro quanto
 * float — dai os quatro casos. Formato fora disso vira erro com nome, nao um
 * numero errado silencioso.
 */
function amostra(v: DataView, offset: number, bits: number, float: boolean): number {
  if (float && bits === 32) return v.getFloat32(offset, true);
  if (bits === 16) return v.getInt16(offset, true) / 32768;
  if (bits === 32) return v.getInt32(offset, true) / 2147483648;
  if (bits === 24) {
    const b = v.getUint8(offset) | (v.getUint8(offset + 1) << 8) | (v.getUint8(offset + 2) << 16);
    // Bit 23 e o sinal: sem isto todo valor negativo viraria um positivo enorme.
    return (b & 0x800000 ? b - 0x1000000 : b) / 8388608;
  }
  throw new Error(`WAV de ${bits} bits${float ? " float" : ""} nao suportado. Exporte em 16 ou 24 bits.`);
}

/**
 * Energia de cada canal, janela a janela.
 *
 * ponytail: percorre o arquivo inteiro uma vez e guarda so um acumulador por
 * canal — nunca materializa as amostras. E o que torna um WAV de centenas de MB
 * legivel; o teto real e o `read()` do UXP, que carrega o arquivo todo na
 * memoria porque nao existe leitura parcial.
 */
export function nivelPorJanela(bytes: Uint8Array, janelaMs = 20): Janelas {
  const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
  if (bytes.byteLength < 44 || texto(v, 0) !== "RIFF" || texto(v, 8) !== "WAVE") {
    throw new Error("Isto nao e um arquivo WAV.");
  }

  let formato = 0;
  let canais = 0;
  let taxa = 0;
  let bits = 0;
  let dados = -1;
  let tamanhoDados = 0;

  // Os chunks nao vem em ordem garantida, e alguns exportadores metem LIST/fact
  // no meio. Varrer e a unica forma segura de achar `fmt ` e `data`.
  for (let p = 12; p + 8 <= bytes.byteLength; ) {
    const id = texto(v, p);
    const tamanho = v.getUint32(p + 4, true);
    const corpo = p + 8;

    if (id === "fmt " && tamanho >= 16) {
      formato = v.getUint16(corpo, true);
      canais = v.getUint16(corpo + 2, true);
      taxa = v.getUint32(corpo + 4, true);
      bits = v.getUint16(corpo + 14, true);
      // Em WAVE_FORMAT_EXTENSIBLE o formato real mora nos 2 primeiros bytes do GUID.
      if (formato === EXTENSIVEL && tamanho >= 26) formato = v.getUint16(corpo + 24, true);
    } else if (id === "data") {
      dados = corpo;
      tamanhoDados = Math.min(tamanho, bytes.byteLength - corpo);
    }
    // Chunk de tamanho impar leva um byte de padding que nao entra no tamanho.
    p = corpo + tamanho + (tamanho % 2);
  }

  if (canais < 1 || taxa < 1 || dados < 0) throw new Error("WAV sem cabecalho fmt/data legivel.");
  if (formato !== PCM && formato !== FLOAT) throw new Error(`WAV comprimido (formato ${formato}). Exporte em PCM.`);

  const bytesPorAmostra = bits / 8;
  const quadro = bytesPorAmostra * canais;
  const totalQuadros = Math.floor(tamanhoDados / quadro);
  const porJanela = Math.max(1, Math.round((taxa * janelaMs) / 1000));

  const db: number[][] = Array.from({ length: canais }, () => []);
  const soma = new Float64Array(canais);
  let naJanela = 0;

  const fechar = () => {
    for (let c = 0; c < canais; c++) {
      const rms = Math.sqrt(soma[c]! / naJanela);
      db[c]!.push(rms > 0 ? 20 * Math.log10(rms) : PISO_DB);
      soma[c] = 0;
    }
    naJanela = 0;
  };

  for (let q = 0; q < totalQuadros; q++) {
    const base = dados + q * quadro;
    for (let c = 0; c < canais; c++) {
      const s = amostra(v, base + c * bytesPorAmostra, bits, formato === FLOAT);
      soma[c] = soma[c]! + s * s;
    }
    if (++naJanela === porJanela) fechar();
  }
  if (naJanela > 0) fechar();

  return { taxa, janelaMs, db };
}
