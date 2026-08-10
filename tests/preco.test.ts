import { test } from "node:test";
import assert from "node:assert/strict";

import { formatarBRL, porExtenso } from "../src/preco.ts";

test("porExtenso resolve valores abaixo de mil", () => {
  assert.equal(porExtenso(["cento", "e", "noventa", "e", "sete"]), 197);
  assert.equal(porExtenso(["quinhentos"]), 500);
  assert.equal(porExtenso(["novecentos", "e", "noventa", "e", "sete"]), 997);
  assert.equal(porExtenso(["cem"]), 100);
});

test("porExtenso resolve milhares", () => {
  assert.equal(porExtenso(["mil"]), 1000);
  assert.equal(porExtenso(["mil", "novecentos", "e", "noventa", "e", "sete"]), 1997);
  assert.equal(porExtenso(["dois", "mil", "e", "quinhentos"]), 2500);
  assert.equal(porExtenso(["vinte", "e", "cinco", "mil"]), 25000);
});

test("porExtenso aceita digito ja transcrito", () => {
  assert.equal(porExtenso(["197"]), 197);
});

test("porExtenso ignora acento e pontuacao", () => {
  assert.equal(porExtenso(["três"]), 3);
  assert.equal(porExtenso(["sete."]), 7);
});

test("porExtenso devolve null quando nao e numeral", () => {
  assert.equal(porExtenso(["homens"]), null);
  assert.equal(porExtenso([]), null);
});

test("formatarBRL usa ponto como separador de milhar", () => {
  assert.equal(formatarBRL(197), "197");
  assert.equal(formatarBRL(1000), "1.000");
  assert.equal(formatarBRL(1997), "1.997");
  assert.equal(formatarBRL(10000), "10.000");
  assert.equal(formatarBRL(100000), "100.000");
  assert.equal(formatarBRL(500), "500");
});
