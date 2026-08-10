import { test } from "node:test";
import assert from "node:assert/strict";

import { sequenceToSource } from "../src/domain.ts";
import { blocosParaTranscricao, gerarBlocos } from "../src/pipeline.ts";
import { PRESET_PADRAO } from "../src/preset.ts";
import type { PalavraEditada } from "../src/transcript.ts";
import type { ClipeComOrigem } from "../src/transcript.ts";

const CLIPE: ClipeComOrigem = {
  sourceName: "IMG_1190.MOV",
  startSeconds: 0,
  endSeconds: 5,
  inPointSeconds: 10,
  outPointSeconds: 15,
  speed: 1,
};

test("sequenceToSource desfaz exatamente o sourceToSequence", () => {
  assert.equal(sequenceToSource(CLIPE, 0), 10);
  assert.equal(sequenceToSource(CLIPE, 2.5), 12.5);
  // Fora do clipe nao ha resposta: o instante nao pertence a esta midia.
  assert.equal(sequenceToSource(CLIPE, -1), null);
  assert.equal(sequenceToSource(CLIPE, 5), null);
});

/** Palavras em tempo de SEQUENCIA, uma por segundo. */
function palavras(frase: string): PalavraEditada[] {
  return frase.split(" ").map((bruto, i) => {
    const eos = bruto.endsWith("|");
    return {
      text: eos ? bruto.slice(0, -1) : bruto,
      inicio: i,
      fim: i + 1,
      confidence: 1,
      eos,
      sourceName: "IMG_1190.MOV",
    };
  });
}

test("gerarBlocos aplica a cadeia inteira de regras", () => {
  const blocos = gerarBlocos(palavras("Essa consulta que era mil hoje está por cento e noventa e sete|"), [], PRESET_PADRAO);
  assert.deepEqual(
    blocos.map((b) => b.texto),
    ["Essa consulta que era", "1.000 REAIS", "hoje tá por", "197 REAIS"]
  );
  assert.deepEqual(blocos.map((b) => b.estilo), ["normal", "preco", "normal", "preco"]);
});

test("gerarBlocos corrige termo protegido e coloquial na mesma passada", () => {
  const blocos = gerarBlocos(palavras("Aqui na andro clinic eu estava falando para o paciente|"), [], PRESET_PADRAO);
  const tudo = blocos.map((b) => b.texto).join(" ");
  assert.match(tudo, /Androclinic/);
  assert.match(tudo, /tava/);
  assert.match(tudo, /pro paciente/);
});

test("blocosParaTranscricao devolve um segment por bloco, em tempo de origem", () => {
  const blocos = gerarBlocos(palavras("PRIMEIRA FRASE| SEGUNDA FRASE|"), [], PRESET_PADRAO);
  const porMidia = blocosParaTranscricao(blocos, [CLIPE]);

  const t = porMidia.get("IMG_1190.MOV");
  assert.ok(t);
  assert.equal(t.segments.length, 2);
  // Bloco 1 comeca em 0s de sequencia -> 10s na midia de origem.
  assert.equal(t.segments[0]?.start, 10);
  assert.equal(t.segments[1]?.start, 12);
});

test("blocosParaTranscricao marca a autoria para o backup saber se e nosso", () => {
  const blocos = gerarBlocos(palavras("UMA FRASE|"), [], PRESET_PADRAO);
  const t = blocosParaTranscricao(blocos, [CLIPE]).get("IMG_1190.MOV");
  assert.equal(t?.segments[0]?.speaker, "pro-captions");
});

test("blocosParaTranscricao mantem o texto do bloco palavra a palavra", () => {
  const blocos = gerarBlocos(palavras("MEU NOME|"), [], PRESET_PADRAO);
  const t = blocosParaTranscricao(blocos, [CLIPE]).get("IMG_1190.MOV");
  assert.deepEqual(t?.segments[0]?.words.map((w) => w.text), ["MEU", "NOME"]);
  // A ultima palavra do bloco fecha a frase: e o que o Premiere usa de fronteira.
  assert.equal(t?.segments[0]?.words[1]?.eos, true);
});

test("bloco fora de qualquer clipe nao inventa midia", () => {
  const blocos = gerarBlocos(palavras("FORA|"), [], PRESET_PADRAO);
  const distante = blocos.map((b) => ({ ...b, inicio: 999, fim: 1000 }));
  assert.equal(blocosParaTranscricao(distante, [CLIPE]).size, 0);
});

test("blocos de clipes diferentes vao para midias diferentes", () => {
  const outro: ClipeComOrigem = {
    sourceName: "IMG_1193.MOV",
    startSeconds: 5,
    endSeconds: 9,
    inPointSeconds: 100,
    outPointSeconds: 104,
    speed: 1,
  };
  const blocos = gerarBlocos(palavras("UM DOIS TRES QUATRO CINCO SEIS SETE OITO|"), [], PRESET_PADRAO);
  const porMidia = blocosParaTranscricao(blocos, [CLIPE, outro]);
  assert.ok(porMidia.has("IMG_1190.MOV"));
  assert.ok(porMidia.has("IMG_1193.MOV"));
});
