import { test } from "node:test";
import assert from "node:assert/strict";

import { normalizarColoquial, nucleo, type PalavraRevisada } from "../src/texto.ts";

/** Monta palavras com tempo previsivel: cada uma dura 1s. */
function palavras(frase: string): PalavraRevisada[] {
  return frase.split(" ").map((text, i) => ({
    text,
    inicio: i,
    fim: i + 1,
    confidence: 1,
    eos: false,
    sugestao: null,
    motivo: null,
  }));
}

const texto = (ps: readonly PalavraRevisada[]): string => ps.map((p) => p.text).join(" ");

test("nucleo separa a pontuacao final", () => {
  assert.deepEqual(nucleo("relógio."), { corpo: "relógio", sufixo: "." });
  assert.deepEqual(nucleo("para"), { corpo: "para", sufixo: "" });
  assert.deepEqual(nucleo("assim,"), { corpo: "assim", sufixo: "," });
});

test("para o vira pro, fundindo duas palavras em uma", () => {
  const saida = normalizarColoquial(palavras("falando para o paciente"));
  assert.equal(texto(saida), "falando pro paciente");
  assert.equal(saida.length, 3);
});

test("a palavra fundida cobre o tempo das duas originais", () => {
  const saida = normalizarColoquial(palavras("falando para o paciente"));
  const pro = saida[1];
  assert.equal(pro?.inicio, 1);
  assert.equal(pro?.fim, 3);
});

test("para os vira pros", () => {
  assert.equal(texto(normalizarColoquial(palavras("bom para os homens"))), "bom pros homens");
});

test("para sozinho vira pra", () => {
  assert.equal(texto(normalizarColoquial(palavras("para você entender"))), "pra você entender");
});

test("formas de estar viram a forma falada", () => {
  assert.equal(texto(normalizarColoquial(palavras("eu estava conversando"))), "eu tava conversando");
  assert.equal(texto(normalizarColoquial(palavras("eles estavam aqui"))), "eles tavam aqui");
  assert.equal(texto(normalizarColoquial(palavras("você está vendo"))), "você tá vendo");
  assert.equal(texto(normalizarColoquial(palavras("eles estão aqui"))), "eles tão aqui");
  assert.equal(texto(normalizarColoquial(palavras("eu estou falando"))), "eu tô falando");
});

test("caso 8 da spec", () => {
  const saida = normalizarColoquial(palavras("Para você entender, eu estava falando para o paciente."));
  assert.equal(texto(saida), "Pra você entender, eu tava falando pro paciente.");
});

test("a pontuacao sobrevive a troca", () => {
  assert.equal(texto(normalizarColoquial(palavras("é para."))), "é pra.");
});

test("reducoes agressivas NAO sao aplicadas", () => {
  assert.equal(texto(normalizarColoquial(palavras("você vamos estamos"))), "você vamos estamos");
});
