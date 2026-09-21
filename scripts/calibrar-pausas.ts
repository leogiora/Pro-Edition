/*
 * Calibracao do Auto Pausas com material real, FORA do Premiere.
 *
 * Le o que o Diagnostico gravou na pasta de dados do plugin
 * (pausas-diag.wav, pausas-diag-transcricao.json, pausas-diag.json), imprime
 * os numeros para escolher FALA_PADRAO e grava previa-pausas.wav: so o audio
 * que ficaria, colado, para ouvir sem abrir o Premiere.
 *
 *   node scripts/calibrar-pausas.ts [--pasta=...] [--saida=...] [--margem=0.08] [--vozAbaixoDoTipicoDb=20] ...
 *
 * Nada disto vai para o git: e a gravacao do usuario, e o repo e publico.
 */

import { existsSync, readFileSync, statSync, writeFileSync } from "node:fs";
import { homedir } from "node:os";
import { join } from "node:path";
import { parseTranscricao, reconstruirTranscricao } from "../ferramentas/auto-broll/src/transcript.ts";
import {
  blocosDeFala,
  FALA_PADRAO,
  lacunas,
  MARGEM_PADRAO_S,
  montarPalavras,
  planejarCortes,
  type OpcoesFala,
} from "../src/pausas.ts";
import { nivelPorJanela } from "../src/wav.ts";

const args = new Map(
  process.argv.slice(2).map((a) => {
    const [k, v] = a.replace(/^--/, "").split("=");
    return [k!, v ?? ""] as const;
  })
);
// O usuario edita no 25 e no 26: vale o Diagnostico mais recente das duas pastas.
const dadosDaVersao = (v: string) =>
  join(process.env.APPDATA ?? "", "Adobe", "UXP", "PluginsStorage", "PPRO", v, "External", "com.leogi.proedition", "PluginData");
const pasta =
  args.get("pasta") ??
  ["25", "26"]
    .map(dadosDaVersao)
    .filter((p) => existsSync(join(p, "pausas-diag.json")))
    .sort((a, b) => statSync(join(b, "pausas-diag.json")).mtimeMs - statSync(join(a, "pausas-diag.json")).mtimeMs)[0] ??
  dadosDaVersao("26");
console.log(`dados: ${pasta}`);
const saida = args.get("saida") ?? join(homedir(), "Desktop", "previa-pausas.wav");
const opcoes = { ...FALA_PADRAO } as Record<keyof OpcoesFala, number>;
for (const chave of Object.keys(FALA_PADRAO) as Array<keyof OpcoesFala>) {
  const valor = args.get(chave);
  if (valor !== undefined) opcoes[chave] = Number(valor);
}
const margemS = args.has("margem") ? Number(args.get("margem")) : MARGEM_PADRAO_S;

const bytes = new Uint8Array(readFileSync(join(pasta, "pausas-diag.wav")));
const diag = JSON.parse(readFileSync(join(pasta, "pausas-diag.json"), "utf8"));
// Diagnostico novo grava "clipes" (sequencia separada); o antigo, "clipe".
const clipes = (diag.clipes ?? [diag.clipe]) as Array<{ sourceName: string; startSeconds: number; endSeconds: number }>;
const brutoTranscricao = JSON.parse(readFileSync(join(pasta, "pausas-diag-transcricao.json"), "utf8"));
const transcricoes = new Map(
  (brutoTranscricao.fontes ? Object.entries(brutoTranscricao.fontes) : [[clipes[0]!.sourceName, brutoTranscricao]]).map(
    ([nome, json]) => {
      const t = parseTranscricao(JSON.stringify(json));
      if (!t) throw new Error(`transcricao ilegivel: ${nome}`);
      return [nome as string, t] as const;
    }
  )
);

const janelas = nivelPorJanela(bytes);
const db = janelas.db[0]!;
const janelaS = janelas.janelaMs / 1000;
const palavras = montarPalavras(reconstruirTranscricao(clipes as never, transcricoes));
const fimSeq = Math.max(...clipes.map((c) => c.endSeconds));

const ordenado = [...db].sort((a, b) => a - b);
const pct = (q: number) => ordenado[Math.min(ordenado.length - 1, Math.floor(ordenado.length * q))]!;
const piso = pct(0.2);
const tipico = pct(0.9);
const limiarSom = piso + opcoes.somAcimaDoPisoDb;
const limiarVoz = Math.max(limiarSom, tipico - opcoes.vozAbaixoDoTipicoDb);
console.log(`opcoes: ${JSON.stringify(opcoes)} · margem ${margemS}`);
console.log(`audio: ${(db.length * janelaS).toFixed(1)} s · ${janelas.taxa} Hz · ${janelas.db.length} canal(is)`);
console.log(
  `piso p20 ${piso.toFixed(1)} dB · voz p90 ${tipico.toFixed(1)} dB · limiar som ${limiarSom.toFixed(1)} · limiar voz ${limiarVoz.toFixed(1)}`
);

// 1. A transcricao do 26 ainda marca pausa?
const brutas = [...transcricoes.values()].flatMap((t) => t.segments.flatMap((s) => s.words.filter((w) => w.type === "word")));
console.log("lacunas da transcricao:", lacunas(brutas), `· ${palavras.length} palavras na timeline`);

// 2. Quanto o inicio da transcricao erra em relacao a voz forte mais proxima (ate 0,3 s).
const inicioForte = (s: number): number | null => {
  const centro = Math.round(s / janelaS);
  for (let d = 0; d <= 0.3 / janelaS; d++) {
    for (const i of [centro + d, centro - d]) {
      if (db[i] !== undefined && db[i]! > limiarVoz) return i * janelaS - s;
    }
  }
  return null;
};
const erros = palavras
  .map((p) => inicioForte(p.inicio))
  .filter((e): e is number => e !== null)
  .sort((a, b) => a - b);
const q = (lista: readonly number[], x: number) => lista[Math.floor((lista.length - 1) * x)]?.toFixed(3) ?? "-";
console.log(
  `erro do inicio (voz forte - transcricao), s: p10 ${q(erros, 0.1)} · p50 ${q(erros, 0.5)} · p90 ${q(erros, 0.9)} · sem voz perto: ${
    palavras.length - erros.length
  }`
);

// 3. Candidatos a respiro: som fraco (entre os dois limiares) sem inicio de palavra, >= 0,15 s.
const respiros: Array<{ de: number; ate: number; pico: number }> = [];
for (let i = 0; i < db.length; ) {
  if (db[i]! > limiarSom && db[i]! <= limiarVoz) {
    let j = i;
    let pico = -Infinity;
    while (j < db.length && db[j]! > limiarSom && db[j]! <= limiarVoz) pico = Math.max(pico, db[j++]!);
    const de = i * janelaS;
    const ate = j * janelaS;
    if (ate - de >= 0.15 && !palavras.some((p) => p.inicio >= de && p.inicio < ate)) respiros.push({ de, ate, pico });
    i = j;
  } else i++;
}
const picos = respiros.map((r) => r.pico - tipico).sort((a, b) => a - b);
console.log(`respiros candidatos: ${respiros.length} · pico relativo a voz: p50 ${q(picos, 0.5)} · p90 ${q(picos, 0.9)} · max ${q(picos, 1)}`);

// 4. Resultado com as opcoes atuais.
const blocos = blocosDeFala(db, janelaS, palavras, opcoes);
const conta = (m: string) => blocos.filter((b) => b.motivo === m).length;
console.log(`blocos: ${blocos.length} · fala ${conta("fala")} · voz sem palavra ${conta("voz-sem-palavra")} · palavra baixa ${conta("palavra-baixa")}`);
for (const b of blocos.filter((b) => b.motivo !== "fala")) console.log(`  ${b.motivo} em ${b.inicio.toFixed(2)}-${b.fim.toFixed(2)} s`);
// O Diagnostico da rodada 6 gravou fps 0 (getSequenceInfo nao le fps no 25): --fps cobre.
const fps = Number(args.get("fps")) || (diag.fps as number) || 30;
console.log(`fps: ${fps}${diag.fps ? "" : " (o Diagnostico nao gravou; use --fps= se nao for 30)"}`);
const plano = planejarCortes(blocos, { fps, duracaoQ: Math.round(fimSeq * fps), margemS });
console.log(`cortes: ${plano.cortes.length} · ${(plano.duracaoAntesQ / fps).toFixed(1)} s -> ${(plano.duracaoDepoisQ / fps).toFixed(1)} s`);

// 5. Previa para ouvir: so o que fica, colado. O cabecalho e escrito do zero —
// o WAV do Premiere pode trazer chunks extras, entao so o PCM e copiado.
const v = new DataView(bytes.buffer, bytes.byteOffset, bytes.byteLength);
let canais = 0;
let bits = 0;
let dados = -1;
for (let p = 12; p + 8 <= bytes.byteLength; ) {
  const id = String.fromCharCode(bytes[p]!, bytes[p + 1]!, bytes[p + 2]!, bytes[p + 3]!);
  const tamanho = v.getUint32(p + 4, true);
  if (id === "fmt ") {
    canais = v.getUint16(p + 10, true);
    bits = v.getUint16(p + 22, true);
  } else if (id === "data") {
    dados = p + 8;
    break;
  }
  p += 8 + tamanho + (tamanho % 2);
}
if (canais !== 1 || bits !== 16 || dados < 0) throw new Error(`previa so sabe copiar PCM mono 16 bits (veio ${canais} canal(is), ${bits} bits)`);

const byteDe = (segundos: number) => Math.round(segundos * janelas.taxa) * 2;
const pedacos = plano.trechos.map((tr) => bytes.subarray(dados + byteDe(tr.inicioQ / fps), dados + byteDe(tr.fimQ / fps)));
const total = pedacos.reduce((n, p) => n + p.byteLength, 0);
const wav = new Uint8Array(44 + total);
const w = new DataView(wav.buffer);
const marca = (o: number, s: string) => {
  for (let i = 0; i < 4; i++) w.setUint8(o + i, s.charCodeAt(i));
};
marca(0, "RIFF");
w.setUint32(4, 36 + total, true);
marca(8, "WAVE");
marca(12, "fmt ");
w.setUint32(16, 16, true);
w.setUint16(20, 1, true);
w.setUint16(22, 1, true);
w.setUint32(24, janelas.taxa, true);
w.setUint32(28, janelas.taxa * 2, true);
w.setUint16(32, 2, true);
w.setUint16(34, 16, true);
marca(36, "data");
w.setUint32(40, total, true);
let cursor = 44;
for (const p of pedacos) {
  wav.set(p, cursor);
  cursor += p.byteLength;
}
writeFileSync(saida, wav);
console.log(`previa gravada em ${saida} (${(total / 2 / janelas.taxa).toFixed(1)} s)`);
