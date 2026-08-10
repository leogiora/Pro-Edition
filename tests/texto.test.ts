import { test } from "node:test";
import assert from "node:assert/strict";

import {
  corrigirEAcento,
  corrigirPorques,
  distancia,
  normalizarColoquial,
  nucleo,
  protegerTermos,
  type PalavraRevisada,
} from "../src/texto.ts";
import { PRESET_PADRAO } from "../src/preset.ts";

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

test("caso 9 da spec: nome e Cristiano vira nome é Cristiano", () => {
  assert.equal(texto(corrigirEAcento(palavras("Meu nome e Cristiano"))), "Meu nome é Cristiano");
});

test("e como verbo depois de pronome ou demonstrativo", () => {
  assert.equal(texto(corrigirEAcento(palavras("isso e importante"))), "isso é importante");
  assert.equal(texto(corrigirEAcento(palavras("ele e médico"))), "ele é médico");
  assert.equal(texto(corrigirEAcento(palavras("o problema e outro"))), "o problema é outro");
});

test("e por isso ganha acento", () => {
  assert.equal(texto(corrigirEAcento(palavras("e por isso que acontece"))), "é por isso que acontece");
});

test("e como conjuncao NAO ganha acento", () => {
  assert.equal(texto(corrigirEAcento(palavras("saúde e qualidade de vida"))), "saúde e qualidade de vida");
  assert.equal(texto(corrigirEAcento(palavras("você e sua esposa"))), "você e sua esposa");
  assert.equal(texto(corrigirEAcento(palavras("ele chegou e conversou comigo"))), "ele chegou e conversou comigo");
});

test("caso 10 da spec: pergunta usa por que separado", () => {
  assert.equal(texto(corrigirPorques(palavras("Você sabe porque isso acontece"))), "Você sabe por que isso acontece");
});

test("caso 11 da spec: explicacao usa porque junto", () => {
  assert.equal(
    texto(corrigirPorques(palavras("Isso acontece por que o hormônio caiu"))),
    "Isso acontece porque o hormônio caiu"
  );
});

test("porque no fim da oracao vira por quê", () => {
  assert.equal(texto(corrigirPorques(palavras("Isso acontece porque?"))), "Isso acontece por quê?");
});

test("porque precedido de artigo e substantivo", () => {
  assert.equal(texto(corrigirPorques(palavras("vou te explicar o porque"))), "vou te explicar o porquê");
});

const proteger = (frase: string): PalavraRevisada[] => protegerTermos(palavras(frase), PRESET_PADRAO);

test("distancia de edicao", () => {
  assert.equal(distancia("androclinic", "androclinic"), 0);
  assert.equal(distancia("andro clinic", "androclinic"), 1);
  assert.ok(distancia("estivalet", "equivalente") > 3);
});

test("caso 3 da spec: erro proximo e corrigido sozinho", () => {
  assert.equal(texto(proteger("aqui na androclinica")), "aqui na Androclinic");
});

test("erro de duas palavras vira o termo canonico", () => {
  assert.equal(texto(proteger("aqui na andro clinic hoje")), "aqui na Androclinic hoje");
});

test("caso 2 da spec: erro distante NAO e trocado sozinho, vira sugestao", () => {
  const saida = proteger("Meu nome é Cristiano Equivalente");
  // O texto continua o que o Premiere ouviu: nao inventar palavra.
  assert.equal(texto(saida), "Meu nome é Cristiano Equivalente");
  const suspeita = saida[saida.length - 1];
  assert.equal(suspeita?.sugestao, "Estivalet");
  assert.ok(suspeita?.motivo);
});

test("o termo ja correto nao vira sugestao", () => {
  const saida = proteger("Meu nome é Cristiano Estivalet");
  assert.equal(texto(saida), "Meu nome é Cristiano Estivalet");
  assert.equal(saida[saida.length - 1]?.sugestao, null);
});

test("palavra comum longe de qualquer termo fica intacta", () => {
  const saida = proteger("o paciente chegou cedo");
  assert.equal(texto(saida), "o paciente chegou cedo");
  assert.ok(saida.every((p) => p.sugestao === null));
});
