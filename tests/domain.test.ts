import { test } from "node:test";
import assert from "node:assert/strict";

import {
  DEFAULT_CONFIG,
  caminhoParaUrl,
  ehVideo,
  fillScalePercent,
  formatTimecode,
  parseConfig,
  recorte,
  sourceToSequence,
  trackLabel,
  type TimelineClip,
} from "../src/domain.ts";

/**
 * Numeros reais lidos da sequencia "Reels" na Fase 0, nao inventados.
 * Primeiro clipe de IMG_1190.MOV: o editor cortou exatamente na primeira
 * palavra da transcricao, que comeca em 0,84s da origem.
 */
const clipeReal: TimelineClip = {
  startSeconds: 0,
  endSeconds: 1.500358500035431,
  inPointSeconds: 0.8335325000196838,
  outPointSeconds: 2.3338910000551145,
  speed: 1,
};

test("sourceToSequence: o inicio da origem cai no inicio do clipe", () => {
  assert.equal(sourceToSequence(clipeReal, clipeReal.inPointSeconds), 0);
});

test("sourceToSequence: duracao na origem e na sequencia batem", () => {
  const naSequencia = sourceToSequence(clipeReal, clipeReal.outPointSeconds - 0.000001);
  if (naSequencia === null) assert.fail("esperava um tempo de sequencia, veio null");
  assert.ok(Math.abs(naSequencia - clipeReal.endSeconds) < 0.001);
});

test("sourceToSequence: fala cortada fora devolve null", () => {
  // Antes do inPoint: o editor removeu o comeco da gravacao.
  assert.equal(sourceToSequence(clipeReal, 0.5), null);
  // Depois do outPoint: caiu no jump cut.
  assert.equal(sourceToSequence(clipeReal, 2.5), null);
});

test("sourceToSequence: outPoint e exclusivo", () => {
  assert.equal(sourceToSequence(clipeReal, clipeReal.outPointSeconds), null);
});

test("sourceToSequence: velocidade dobrada comprime o tempo pela metade", () => {
  const rapido: TimelineClip = {
    startSeconds: 10,
    endSeconds: 15,
    inPointSeconds: 0,
    outPointSeconds: 10,
    speed: 2,
  };
  // 4s na origem viram 2s de sequencia a partir de 10s.
  assert.equal(sourceToSequence(rapido, 4), 12);
});

test("fillScalePercent: 720x1280 numa sequencia 1080x1920 pede 150%", () => {
  // Valor confirmado no Premiere pela prova P9: Scale foi de 100 para 150.
  assert.equal(fillScalePercent({ width: 720, height: 1280 }, { width: 1080, height: 1920 }), 150);
});

test("fillScalePercent: 464x832 e a pior resolucao da biblioteca", () => {
  const escala = fillScalePercent({ width: 464, height: 832 }, { width: 1080, height: 1920 });
  assert.ok(escala > 230 && escala < 234, `esperado ~233%, veio ${escala}`);
});

test("fillScalePercent: clipe do mesmo tamanho nao escala", () => {
  assert.equal(fillScalePercent({ width: 1080, height: 1920 }, { width: 1080, height: 1920 }), 100);
});

test("fillScalePercent: cobre, nao encaixa — clipe mais largo estoura a largura", () => {
  // 16:9 numa sequencia vertical: precisa crescer ate a ALTURA, cortando as laterais.
  const escala = fillScalePercent({ width: 1920, height: 1080 }, { width: 1080, height: 1920 });
  assert.equal(escala, (1920 / 1080) * 100);
});

test("fillScalePercent: dimensao zero e erro, nao Infinity", () => {
  assert.throws(() => fillScalePercent({ width: 0, height: 100 }, { width: 1080, height: 1920 }), RangeError);
});

test("formatTimecode: zero", () => {
  assert.equal(formatTimecode(0, 30), "00:00:00:00");
});

test("formatTimecode: horas, minutos, segundos e frames", () => {
  assert.equal(formatTimecode(3661.5, 30), "01:01:01:15");
});

test("formatTimecode: entrada invalida nao quebra a interface", () => {
  assert.equal(formatTimecode(Number.NaN, 30), "--:--:--:--");
  assert.equal(formatTimecode(10, 0), "--:--:--:--");
});

test("parseConfig: lixo do disco vira o padrao", () => {
  assert.deepEqual(parseConfig(null), DEFAULT_CONFIG);
  assert.deepEqual(parseConfig("nao sou objeto"), DEFAULT_CONFIG);
  assert.deepEqual(parseConfig({ videoTrackIndex: "dois" }), DEFAULT_CONFIG);
});

test("parseConfig: campo valido sobrevive, campo invalido cai no padrao", () => {
  const c = parseConfig({ videoTrackIndex: 2, audioTrackIndex: -5, removeAudio: false });
  assert.equal(c.videoTrackIndex, 2);
  assert.equal(c.audioTrackIndex, DEFAULT_CONFIG.audioTrackIndex);
  assert.equal(c.removeAudio, false);
});

test("caminhoParaUrl: caminho do Windows vira file:/C:/...", () => {
  assert.equal(
    caminhoParaUrl("C:\\Users\\leogi\\Downloads"),
    "file:/C:/Users/leogi/Downloads"
  );
});

test("caminhoParaUrl: espaco vai LITERAL — quem escapa e o UXP", () => {
  // Medido no Premiere: mandar "%20" fez o UXP procurar "%2520" e falhar.
  assert.equal(
    caminhoParaUrl("C:\\Users\\leogi\\Downloads\\Brolls - 2026"),
    "file:/C:/Users/leogi/Downloads/Brolls - 2026"
  );
});

test("caminhoParaUrl: barra final e espacos nas pontas somem", () => {
  assert.equal(caminhoParaUrl("  C:\\midia\\  "), "file:/C:/midia");
  assert.equal(caminhoParaUrl("C:\\midia\\\\"), "file:/C:/midia");
});

test("caminhoParaUrl: caminho vazio e erro, nao URL invalida", () => {
  assert.throws(() => caminhoParaUrl("   "), RangeError);
});

test("caminhoParaUrl: e idempotente — colar a URL de volta nao codifica duas vezes", () => {
  const url = caminhoParaUrl("C:\\Users\\leogi\\Downloads\\Brolls - 2026");
  assert.equal(caminhoParaUrl(url), url);
  assert.equal(caminhoParaUrl(caminhoParaUrl(url)), url);
});

test("caminhoParaUrl: desfaz codificacao acumulada e devolve o caminho limpo", () => {
  // Caso real que falhou no painel: %20 virou %2520 e depois %252520.
  const limpo = "file:/C:/Users/leogi/Downloads/Brolls - 2026";
  assert.equal(caminhoParaUrl("file:/C:/Users/leogi/Downloads/Brolls%252520-%2525202026"), limpo);
  assert.equal(caminhoParaUrl("file:/C:/Users/leogi/Downloads/Brolls%20-%202026"), limpo);
});

test("caminhoParaUrl: aspas do Explorer do Windows sao removidas", () => {
  assert.equal(caminhoParaUrl('"C:\\midia\\brolls"'), "file:/C:/midia/brolls");
});

test("ehVideo: aceita os formatos de video e recusa o resto", () => {
  assert.equal(ehVideo("Casal feliz (10).mp4"), true);
  assert.equal(ehVideo("IMG_1190.MOV"), true);
  assert.equal(ehVideo("Image 170.png"), false);
  assert.equal(ehVideo("stillness.WAV"), false);
  assert.equal(ehVideo("sem_extensao"), false);
});

test("trackLabel: indice 0 e a primeira faixa", () => {
  assert.equal(trackLabel("V", 1), "V2");
  assert.equal(trackLabel("A", 2), "A3");
  assert.equal(trackLabel("V", 0), "V1");
});

// ------------------------------- recorte por in/out --------------------------

test("recorte: um pedaco proprio da sequencia vale", () => {
  assert.deepEqual(recorte(30, 60, 300), { inicio: 30, fim: 60 });
});

test("recorte: comecando no zero ainda e recorte, desde que nao va ate o fim", () => {
  assert.deepEqual(recorte(0, 30, 300), { inicio: 0, fim: 30 });
});

test("recorte: a sequencia inteira nao e recorte — e o padrao sem in/out", () => {
  assert.equal(recorte(0, 300, 300), null);
});

test("recorte: vazio, invertido ou fora da sequencia devolve null", () => {
  assert.equal(recorte(60, 60, 300), null);
  assert.equal(recorte(60, 30, 300), null);
  assert.equal(recorte(400, 500, 300), null, "in depois do fim: nada sobra ao aparar");
});

test("recorte: valores que nao sao numero de verdade devolvem null", () => {
  assert.equal(recorte(Number.NaN, 60, 300), null);
  assert.equal(recorte(0, Number.POSITIVE_INFINITY, 300), null);
});

test("recorte: out alem do fim e aparado, nao rejeitado", () => {
  assert.deepEqual(recorte(250, 400, 300), { inicio: 250, fim: 300 });
});

test("recorte: duracao desconhecida (zero) nunca vira recorte", () => {
  // getEndTime pode falhar e devolver 0 — nesse caso, analisar tudo.
  assert.equal(recorte(10, 60, 0), null);
});
