import { test } from "node:test";
import assert from "node:assert/strict";

import {
  agruparEmFrases,
  parseTranscricao,
  reconstruirTranscricao,
  type ClipeComOrigem,
  type PalavraEditada,
  type TranscricaoOrigem,
} from "../src/transcript.ts";

/** Recorte real do exportToJSON de IMG_1190.MOV, lido na Fase 0. */
const JSON_REAL = JSON.stringify({
  language: "pt-pt",
  segments: [
    {
      duration: 30.1,
      language: "pt-pt",
      speaker: "0d6458bc",
      start: 0.84,
      words: [
        { confidence: 1, duration: 0.78, eos: false, start: 0.84, tags: [], text: "Bomba", type: "word" },
        { confidence: 1, duration: 0.63, eos: true, start: 1.62, tags: [], text: "relógio.", type: "word" },
        { confidence: 1, duration: 0.09, eos: false, start: 2.97, tags: [], text: "É", type: "word" },
        { confidence: 0.97, duration: 0.87, eos: false, start: 3.06, tags: [], text: "exatamente", type: "word" },
        { confidence: 1, duration: 0.57, eos: true, start: 3.93, tags: [], text: "essa.", type: "word" },
      ],
    },
  ],
});

/** Primeiro clipe real da timeline: corta exatamente na primeira palavra. */
const CLIPE_1: ClipeComOrigem = {
  sourceName: "IMG_1190.MOV",
  startSeconds: 0,
  endSeconds: 1.5003585,
  inPointSeconds: 0.8335325,
  outPointSeconds: 2.333891,
  speed: 1,
};

test("parseTranscricao: le o formato real do Premiere", () => {
  const t = parseTranscricao(JSON_REAL);
  if (t === null) assert.fail("nao deveria devolver null");
  assert.equal(t.language, "pt-pt");
  assert.equal(t.segments.length, 1);
  assert.equal(t.segments[0]?.words.length, 5);
  assert.equal(t.segments[0]?.words[0]?.text, "Bomba");
  assert.equal(t.segments[0]?.words[1]?.eos, true);
});

test("parseTranscricao: JSON invalido nao lanca", () => {
  assert.equal(parseTranscricao("{nao e json"), null);
  assert.equal(parseTranscricao("[]"), null);
  assert.equal(parseTranscricao("null"), null);
});

test("parseTranscricao: palavra malformada e descartada, o resto sobrevive", () => {
  const t = parseTranscricao(
    JSON.stringify({
      segments: [{ words: [{ text: "boa", start: 1 }, { text: "sem start" }, { start: 2 }, null] }],
    })
  );
  if (t === null) assert.fail("nao deveria devolver null");
  assert.equal(t.segments[0]?.words.length, 1);
  assert.equal(t.segments[0]?.words[0]?.text, "boa");
});

test("reconstruirTranscricao: mantem so o que sobreviveu ao corte", () => {
  const transcricao = parseTranscricao(JSON_REAL);
  if (transcricao === null) assert.fail("transcricao nula");

  const palavras = reconstruirTranscricao([CLIPE_1], new Map([["IMG_1190.MOV", transcricao]]));

  // O clipe vai de 0,8335 a 2,3339 na origem: pega "Bomba" e "relógio.",
  // deixa de fora as tres palavras que comecam em 2,97 ou depois.
  assert.deepEqual(palavras.map((p) => p.text), ["Bomba", "relógio."]);
});

test("reconstruirTranscricao: a primeira palavra cai no inicio da sequencia", () => {
  const transcricao = parseTranscricao(JSON_REAL);
  if (transcricao === null) assert.fail("transcricao nula");
  const palavras = reconstruirTranscricao([CLIPE_1], new Map([["IMG_1190.MOV", transcricao]]));

  // inPoint 0,8335 e a palavra comeca em 0,84: sobra menos de 7ms.
  assert.ok(palavras[0] !== undefined);
  assert.ok(palavras[0].inicio < 0.01, `esperado perto de 0, veio ${palavras[0].inicio}`);
});

test("reconstruirTranscricao: midia sem transcricao e ignorada, nao quebra", () => {
  const broll: ClipeComOrigem = {
    sourceName: "Casal feliz (3).mp4",
    startSeconds: 5,
    endSeconds: 8,
    inPointSeconds: 0,
    outPointSeconds: 3,
    speed: 1,
  };
  assert.deepEqual(reconstruirTranscricao([broll], new Map()), []);
});

test("reconstruirTranscricao: dois clipes saem em ordem de sequencia", () => {
  const t: TranscricaoOrigem = {
    language: "pt",
    segments: [
      {
        start: 0,
        duration: 100,
        speaker: "a",
        words: [
          { text: "primeira", start: 1, duration: 0.5, confidence: 1, eos: false, type: "word" },
          { text: "segunda", start: 50, duration: 0.5, confidence: 1, eos: false, type: "word" },
        ],
      },
    ],
  };
  // O editor inverteu a ordem: o trecho de 50s aparece ANTES do de 1s.
  const clipes: ClipeComOrigem[] = [
    { sourceName: "x", startSeconds: 0, endSeconds: 2, inPointSeconds: 49, outPointSeconds: 51, speed: 1 },
    { sourceName: "x", startSeconds: 2, endSeconds: 4, inPointSeconds: 0, outPointSeconds: 2, speed: 1 },
  ];
  const palavras = reconstruirTranscricao(clipes, new Map([["x", t]]));
  assert.deepEqual(palavras.map((p) => p.text), ["segunda", "primeira"]);
});

test("reconstruirTranscricao: item que nao e palavra e descartado", () => {
  const t: TranscricaoOrigem = {
    language: "pt",
    segments: [
      {
        start: 0,
        duration: 10,
        speaker: "a",
        words: [
          { text: "ok", start: 1, duration: 0.3, confidence: 1, eos: false, type: "word" },
          { text: "...", start: 1.5, duration: 0.1, confidence: 1, eos: false, type: "punctuation" },
        ],
      },
    ],
  };
  const clipes: ClipeComOrigem[] = [
    { sourceName: "x", startSeconds: 0, endSeconds: 5, inPointSeconds: 0, outPointSeconds: 5, speed: 1 },
  ];
  assert.deepEqual(reconstruirTranscricao(clipes, new Map([["x", t]])).map((p) => p.text), ["ok"]);
});

// ------------------------------------------------------------------ frases

function palavra(text: string, inicio: number, eos = false): PalavraEditada {
  return { text, inicio, fim: inicio + 0.3, confidence: 1, eos, sourceName: "x" };
}

test("agruparEmFrases: quebra no eos que o proprio Premiere marca", () => {
  const frases = agruparEmFrases([
    palavra("Bomba", 0),
    palavra("relogio", 0.8, true),
    palavra("Isso", 1.5),
    palavra("muda", 2, true),
  ]);
  assert.equal(frases.length, 2);
  assert.equal(frases[0]?.texto, "Bomba relogio");
  assert.equal(frases[1]?.texto, "Isso muda");
});

test("agruparEmFrases: pausa longa quebra mesmo sem eos", () => {
  // O editor cortou no meio da frase: o eos nunca chega.
  const frases = agruparEmFrases([palavra("antes", 0), palavra("depois", 10)]);
  assert.equal(frases.length, 2);
});

test("agruparEmFrases: guarda a menor confianca para marcar trecho incerto", () => {
  const frases = agruparEmFrases([
    { text: "talvez", inicio: 0, fim: 0.4, confidence: 0.42, eos: false, sourceName: "x" },
    { text: "assim", inicio: 0.5, fim: 0.9, confidence: 0.99, eos: true, sourceName: "x" },
  ]);
  assert.equal(frases[0]?.confiancaMinima, 0.42);
});

test("agruparEmFrases: sem palavras devolve lista vazia", () => {
  assert.deepEqual(agruparEmFrases([]), []);
});

test("agruparEmFrases: ultima frase sem eos ainda e fechada", () => {
  const frases = agruparEmFrases([palavra("frase", 0), palavra("truncada", 0.5)]);
  assert.equal(frases.length, 1);
  assert.equal(frases[0]?.palavras, 2);
});
