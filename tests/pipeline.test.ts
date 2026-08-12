import { test } from "node:test";
import assert from "node:assert/strict";

import { blocosParaSrt, gerarBlocos } from "../src/pipeline.ts";
import { PRESET_PADRAO } from "../src/preset.ts";
import type { PalavraEditada } from "../src/transcript.ts";

// Os testes de blocosParaTranscricao e sequenceToSource morreram com a rota
// de escrita no clipe (D-13): o .srt vive em tempo de sequencia.

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
  // "Essa consulta que era" tem 21 caracteres e o orcamento medido e 20.
  assert.deepEqual(
    blocos.map((b) => b.texto),
    ["Essa consulta", "que era", "1.000 REAIS", "hoje tá por", "197 REAIS"]
  );
  assert.deepEqual(blocos.map((b) => b.estilo), ["normal", "normal", "preco", "normal", "preco"]);
});

test("gerarBlocos corrige termo protegido e coloquial na mesma passada", () => {
  const blocos = gerarBlocos(palavras("Aqui na andro clinic eu estava falando para o paciente|"), [], PRESET_PADRAO);
  const tudo = blocos.map((b) => b.texto).join(" ");
  assert.match(tudo, /Androclinic/);
  assert.match(tudo, /tava/);
  assert.match(tudo, /pro paciente/);
});

test("blocosParaSrt gera um cue por bloco no formato srt", () => {
  const blocos = gerarBlocos(palavras("BOMBA RELOGIO.| MUITO PERIGOSA.|"), [], PRESET_PADRAO);
  const srt = blocosParaSrt(blocos);
  const cues = srt.trim().split("\n\n");
  assert.equal(cues.length, blocos.length);
  // Tempos com virgula de milissegundo: e srt, nao timecode de video.
  // Sem ponto final no texto: D-15.
  assert.match(cues[0] ?? "", /^1\n00:00:00,000 --> 00:00:02,000\nBOMBA RELOGIO$/);
  assert.match(cues[1] ?? "", /^2\n00:00:0/);
});
