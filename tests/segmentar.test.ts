import { test } from "node:test";
import assert from "node:assert/strict";

import { segmentar } from "../src/segmentar.ts";
import { PRESET_PADRAO } from "../src/preset.ts";
import type { PalavraRevisada } from "../src/texto.ts";

/** Uma palavra por segundo. `|` no fim marca eos. */
function palavras(frase: string): PalavraRevisada[] {
  return frase.split(" ").map((bruto, i) => {
    const eos = bruto.endsWith("|");
    return {
      text: eos ? bruto.slice(0, -1) : bruto,
      inicio: i,
      fim: i + 1,
      confidence: 1,
      eos,
      sugestao: null,
      motivo: null,
    };
  });
}

const seg = (frase: string, cortes: number[] = []): ReturnType<typeof segmentar> =>
  segmentar(palavras(frase), cortes, PRESET_PADRAO);

test("frase curta vira um bloco so", () => {
  const blocos = seg("MEU NOME É CRISTIANO|");
  assert.equal(blocos.length, 1);
  assert.equal(blocos[0]?.texto, "MEU NOME É CRISTIANO");
});

test("cada eos abre um bloco novo", () => {
  const blocos = seg("PRIMEIRA FRASE| SEGUNDA FRASE|");
  assert.equal(blocos.length, 2);
  assert.equal(blocos[0]?.texto, "PRIMEIRA FRASE");
  assert.equal(blocos[1]?.texto, "SEGUNDA FRASE");
});

test("o tempo do bloco acompanha a primeira e a ultima palavra", () => {
  const blocos = seg("PRIMEIRA FRASE| SEGUNDA FRASE|");
  assert.equal(blocos[0]?.inicio, 0);
  assert.equal(blocos[0]?.fim, 2);
  assert.equal(blocos[1]?.inicio, 2);
  assert.equal(blocos[1]?.fim, 4);
});

test("caso 13 da spec: nenhum bloco tem quebra de linha", () => {
  for (const bloco of seg("UMA FRASE BEM LONGA QUE PRECISA SER PARTIDA EM VARIOS BLOCOS AQUI|")) {
    assert.ok(!bloco.texto.includes("\n"));
  }
});

test("frase longa e partida respeitando o orcamento de caracteres", () => {
  const blocos = seg("VOCE PRECISA ENTENDER O QUE ESTA ACONTECENDO COM O SEU CORPO AGORA|");
  assert.ok(blocos.length > 1);
  for (const bloco of blocos) {
    assert.ok(
      bloco.texto.length <= PRESET_PADRAO.maxCaracteres,
      `bloco estourou o orcamento: "${bloco.texto}" (${bloco.texto.length})`
    );
  }
});

test("nenhuma palavra e cortada ao meio", () => {
  const original = "VOCE PRECISA ENTENDER O QUE ESTA ACONTECENDO COM O SEU CORPO AGORA";
  const juntos = seg(`${original}|`).map((b) => b.texto).join(" ");
  assert.equal(juntos, original);
});

test("pausa longa quebra a frase mesmo sem eos", () => {
  const ps: PalavraRevisada[] = [
    { text: "ANTES", inicio: 0, fim: 1, confidence: 1, eos: false, sugestao: null, motivo: null },
    { text: "DEPOIS", inicio: 5, fim: 6, confidence: 1, eos: false, sugestao: null, motivo: null },
  ];
  const blocos = segmentar(ps, [], PRESET_PADRAO);
  assert.equal(blocos.length, 2);
});

test("confianca baixa marca o bloco para revisao", () => {
  const ps: PalavraRevisada[] = [
    { text: "TALVEZ", inicio: 0, fim: 1, confidence: 0.3, eos: true, sugestao: null, motivo: null },
  ];
  const blocos = segmentar(ps, [], PRESET_PADRAO);
  assert.equal(blocos[0]?.precisaRevisao, true);
  assert.ok(blocos[0]?.motivos.length);
});

test("sugestao pendente marca o bloco para revisao", () => {
  const ps: PalavraRevisada[] = [
    { text: "EQUIVALENTE", inicio: 0, fim: 1, confidence: 1, eos: true, sugestao: "Estivalet", motivo: "contexto" },
  ];
  const blocos = segmentar(ps, [], PRESET_PADRAO);
  assert.equal(blocos[0]?.precisaRevisao, true);
});

test("caso 4 da spec: preco sai isolado, com REAIS", () => {
  const blocos = seg("HOJE TÁ POR CENTO E NOVENTA E SETE|");
  assert.deepEqual(blocos.map((b) => b.texto), ["HOJE TÁ POR", "197 REAIS"]);
  assert.deepEqual(blocos.map((b) => b.estilo), ["normal", "preco"]);
});

test("caso 5 da spec: dois precos, cada um no seu bloco", () => {
  const blocos = seg("DE MIL POR CENTO E NOVENTA E SETE|");
  assert.deepEqual(blocos.map((b) => b.texto), ["DE", "1.000 REAIS", "POR", "197 REAIS"]);
  assert.deepEqual(blocos.map((b) => b.estilo), ["normal", "preco", "normal", "preco"]);
});

test("caso 7 da spec: numero que nao e preco fica no texto normal", () => {
  const blocos = seg("MAIS DE MIL HOMENS|");
  assert.equal(blocos.length, 1);
  assert.equal(blocos[0]?.texto, "MAIS DE MIL HOMENS");
  assert.equal(blocos[0]?.estilo, "normal");
});

test("o preco ocupa o tempo em que o valor e falado", () => {
  // "HOJE TÁ POR CENTO E NOVENTA E SETE": o valor comeca na palavra 3.
  const blocos = seg("HOJE TÁ POR CENTO E NOVENTA E SETE|");
  const preco = blocos[1];
  assert.equal(preco?.inicio, 3);
  assert.equal(preco?.fim, 8);
});

test("nenhum bloco mistura preco com texto normal", () => {
  for (const bloco of seg("A CONSULTA CUSTA MIL NOVECENTOS E NOVENTA E SETE|")) {
    const temReais = bloco.texto.includes("REAIS");
    assert.equal(temReais, bloco.estilo === "preco");
  }
});

test("preco de certeza media marca revisao", () => {
  const blocos = seg("POR CENTO E NOVENTA E SETE|");
  const preco = blocos.find((b) => b.estilo === "preco");
  assert.ok(preco);
  assert.equal(preco.precisaRevisao, true);
});
