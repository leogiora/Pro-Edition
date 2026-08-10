import { test } from "node:test";
import assert from "node:assert/strict";

import { detectarPrecos, formatarBRL, porExtenso, textoDoPreco } from "../src/preco.ts";

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

const p = (frase: string): ReturnType<typeof detectarPrecos> => detectarPrecos(frase.split(" "));

test("caso 4 da spec: preco sem a palavra reais", () => {
  const achados = p("hoje tá por cento e noventa e sete");
  assert.equal(achados.length, 1);
  assert.equal(achados[0]?.valor, 197);
  assert.equal(achados[0]?.certeza, "alta");
});

test("caso 5 da spec: dois precos no padrao de X por Y", () => {
  const achados = p("de mil por cento e noventa e sete");
  assert.equal(achados.length, 2);
  assert.equal(achados[0]?.valor, 1000);
  assert.equal(achados[1]?.valor, 197);
  assert.equal(achados[0]?.certeza, "alta");
  assert.equal(achados[1]?.certeza, "alta");
});

test("caso 6 da spec: milhar com gatilho explicito", () => {
  const achados = p("a consulta custa mil novecentos e noventa e sete");
  assert.equal(achados.length, 1);
  assert.equal(achados[0]?.valor, 1997);
});

test("caso 7 da spec: numero que NAO e preco", () => {
  assert.deepEqual(p("mais de mil homens"), []);
});

test("a palavra reais confirma o preco sozinha", () => {
  const achados = p("são cento e noventa e sete reais");
  assert.equal(achados[0]?.valor, 197);
  assert.equal(achados[0]?.certeza, "alta");
});

test("porcentagem nao vira preco", () => {
  assert.deepEqual(p("noventa por cento dos homens"), []);
});

test("textoDoPreco monta o bloco no padrao fechado", () => {
  assert.equal(textoDoPreco(197), "197 REAIS");
  assert.equal(textoDoPreco(1000), "1.000 REAIS");
});
