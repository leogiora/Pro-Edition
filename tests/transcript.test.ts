import { test } from "node:test";
import assert from "node:assert/strict";

import {
  agruparEmFrases,
  parseTranscricao,
  reconstruirTranscricao,
  type ClipeComOrigem,
  type TranscricaoOrigem,
} from "../src/transcript.ts";

/** Recorte real do exportToJSON, formato lido no Premiere 26.3.2. */
const JSON_REAL = JSON.stringify({
  language: "pt-pt",
  segments: [
    {
      duration: 30.1,
      language: "pt-pt",
      speaker: "0d6458bc",
      start: 0.84,
      words: [
        { confidence: 1, duration: 0.78, eos: false, start: 0.84, tags: [], text: "Meu", type: "word" },
        { confidence: 1, duration: 0.4, eos: false, start: 1.62, tags: [], text: "nome", type: "word" },
        { confidence: 0.6, duration: 0.2, eos: false, start: 2.02, tags: [], text: "e", type: "word" },
        { confidence: 0.4, duration: 0.9, eos: true, start: 2.22, tags: [], text: "Cristiano.", type: "word" },
        { confidence: 1, duration: 0.5, eos: true, start: 9.0, tags: [], text: "Depois.", type: "word" },
      ],
    },
  ],
});

const CLIPE: ClipeComOrigem = {
  sourceName: "IMG_1190.MOV",
  startSeconds: 0,
  endSeconds: 3.5,
  inPointSeconds: 0.84,
  outPointSeconds: 4.34,
  speed: 1,
};

test("parseTranscricao le o formato real do Premiere", () => {
  const t = parseTranscricao(JSON_REAL);
  assert.ok(t);
  assert.equal(t.segments.length, 1);
  assert.equal(t.segments[0]?.words.length, 5);
  assert.equal(t.segments[0]?.words[0]?.text, "Meu");
  assert.equal(t.segments[0]?.words[3]?.eos, true);
});

test("parseTranscricao devolve null em JSON invalido", () => {
  assert.equal(parseTranscricao("{nao e json"), null);
  assert.equal(parseTranscricao("[]"), null);
});

test("parseTranscricao descarta palavra sem campo obrigatorio sem derrubar o resto", () => {
  const sujo = JSON.stringify({
    language: "pt-pt",
    segments: [{ start: 0, duration: 1, speaker: "x", words: [{ text: "ok", start: 0 }, { start: 1 }] }],
  });
  const t = parseTranscricao(sujo);
  assert.equal(t?.segments[0]?.words.length, 1);
});

test("reconstruirTranscricao mantem so o que sobreviveu ao corte", () => {
  const t = parseTranscricao(JSON_REAL);
  assert.ok(t);
  const mapa = new Map<string, TranscricaoOrigem>([["IMG_1190.MOV", t]]);
  const palavras = reconstruirTranscricao([CLIPE], mapa);

  // "Depois." comeca em 9.0s na origem, fora do outPoint de 4.34s.
  assert.deepEqual(palavras.map((p) => p.text), ["Meu", "nome", "e", "Cristiano."]);
  // A primeira palavra cai exatamente no inicio do clipe na sequencia.
  assert.equal(palavras[0]?.inicio, 0);
});

test("agruparEmFrases usa o eos que o Premiere ja entrega", () => {
  const t = parseTranscricao(JSON_REAL);
  assert.ok(t);
  const mapa = new Map<string, TranscricaoOrigem>([["IMG_1190.MOV", t]]);
  const frases = agruparEmFrases(reconstruirTranscricao([CLIPE], mapa));

  assert.equal(frases.length, 1);
  assert.equal(frases[0]?.texto, "Meu nome e Cristiano.");
  assert.equal(frases[0]?.confiancaMinima, 0.4);
});
