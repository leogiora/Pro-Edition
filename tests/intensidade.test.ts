import { test } from "node:test";
import assert from "node:assert/strict";

import { encaixam, percentis, ritmo } from "../src/intensidade.ts";

test("percentis: menor vira 0, maior vira 1", () => {
  assert.deepEqual(percentis([10, 20, 30]), [0, 0.5, 1]);
});

test("percentis: ordem da entrada e preservada", () => {
  assert.deepEqual(percentis([30, 10, 20]), [1, 0, 0.5]);
});

test("percentis: item unico fica no meio, elegivel em qualquer momento", () => {
  assert.deepEqual(percentis([42]), [0.5]);
});

test("percentis: empate recebe o mesmo percentil", () => {
  assert.deepEqual(percentis([10, 10, 30]), [0, 0, 1]);
});

test("percentis: quem nao pode ser medido continua sem medida", () => {
  assert.deepEqual(percentis([10, null, 30]), [0, null, 1]);
});

test("percentis: lista so de nulos nao quebra", () => {
  assert.deepEqual(percentis([null, null]), [null, null]);
});

test("percentis: lista vazia devolve vazia", () => {
  assert.deepEqual(percentis([]), []);
});

test("encaixam: pega quem esta dentro da tolerancia", () => {
  // Fala rapida (0,9): so o take agitado cabe.
  assert.deepEqual(encaixam([0, 0.5, 1], 0.9, 0.35), [2]);
});

test("encaixam: fala no meio abre para os dois lados", () => {
  assert.deepEqual(encaixam([0, 0.5, 1], 0.5, 0.35), [1]);
  assert.deepEqual(encaixam([0.2, 0.5, 0.8], 0.5, 0.35), [0, 1, 2]);
});

test("encaixam: take sem medida nunca e excluido", () => {
  // Nao medir nao pode virar castigo: ele continua candidato.
  assert.deepEqual(encaixam([null, 0], 1, 0.35), [0]);
});

test("encaixam: nenhum encaixe devolve vazio, e quem chama decide", () => {
  assert.deepEqual(encaixam([0, 0.1], 1, 0.35), []);
});

test("ritmo: palavras por segundo", () => {
  assert.equal(ritmo(10, 5), 2);
});

test("ritmo: duracao zero nao vira infinito", () => {
  assert.equal(ritmo(10, 0), 0);
});
