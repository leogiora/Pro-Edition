import { test } from "node:test";
import assert from "node:assert/strict";

import { readFileSync } from "node:fs";

import { palavrasDoElevenLabs } from "../src/elevenlabs.ts";
import { blocosNosCortes, blocosParaSrt, gerarBlocos, lerSrt } from "../src/pipeline.ts";
import { PRESET_ELEVENLABS, PRESET_PADRAO } from "../src/preset.ts";
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

test("gerarBlocos: 'H' nao fica sozinho e a legenda vai ate a seguinte (Reels do Andro 19.09, 8:23)", () => {
  const p = (text: string, inicio: number, fim: number, eos = false): PalavraEditada => ({ text, inicio, fim, confidence: 1, eos, sourceName: "x" });
  const blocos = gerarBlocos(
    [p("mas", 503.048, 503.168), p("na", 503.208, 503.288), p("hora", 503.328, 503.528), p("H,", 503.568, 503.588), p("nada.", 503.948, 504.228, true), p("Aí", 505.8, 506)],
    [],
    PRESET_ELEVENLABS
  );
  assert.deepEqual(blocos.map((b) => b.texto), ["mas na hora H", "nada", "Aí"]);
  assert.equal(blocos[0]?.fim, 503.948); // colada na seguinte
  assert.equal(blocos[1]?.fim, 504.228); // vao de 1 s ou mais: sai da tela
});

/* ------------------------------------------ blocos do Premiere (hibrido) */

test("lerSrt: tempo, texto em duas linhas, BOM e CRLF", () => {
  const srt = "﻿1\r\n00:00:01,000 --> 00:00:02,500\r\nVocê\r\nfalha\r\n\r\n2\r\n00:01:00,040 --> 00:01:01,000\r\ninventa\r\n";
  assert.deepEqual(lerSrt(srt), [
    { inicio: 1, fim: 2.5, texto: "Você falha" },
    { inicio: 60.04, fim: 61, texto: "inventa" },
  ]);
});

test("hibrido: o bloco e o tempo sao do Premiere, a palavra e a do ElevenLabs", () => {
  // Palavras de 1 s cada: "Você" 0-1, "falha," 1-2, "inventa" 2-3, "desculpa" 3-4.
  const r = blocosNosCortes(palavras("Você falha, inventa desculpa|"), [
    { inicio: 0, fim: 1.5, texto: "Você faz" },
    { inicio: 1.5, fim: 4, texto: "inventa desculpa" },
  ]);
  // "falha," comeca em 1 s, antes do corte do Premiere em 1,5: fica no primeiro bloco.
  assert.deepEqual(r.map((b) => b.texto), ["Você falha", "inventa desculpa"]);
  assert.deepEqual(r.map((b) => [b.inicio, b.fim]), [[0, 1.5], [1.5, 4]]);
});

test("hibrido: palavra no buraco vai para o bloco seguinte; bloco sem palavra fica, para revisar", () => {
  const r = blocosNosCortes(palavras("um dois tres|"), [
    { inicio: 0, fim: 0.5, texto: "um" },
    { inicio: 1.2, fim: 3, texto: "dois tres" },
    { inicio: 5, fim: 6, texto: "silencio" },
  ]);
  // "dois" comeca em 1 s: buraco entre 0,5 e 1,2 -> segundo bloco.
  assert.deepEqual(r.map((b) => b.texto), ["um", "dois tres", "silencio"]);
  assert.equal(r[2]?.precisaRevisao, true);
});

test("hibrido: preco sai em bloco proprio, mesmo partido entre dois blocos do Premiere", () => {
  // "tá saindo por mil reais" com o Premiere cortando entre "mil" e "reais".
  const r = blocosNosCortes(palavras("tá saindo por mil reais|"), [
    { inicio: 0, fim: 3.5, texto: "tá saindo por mil" },
    { inicio: 3.5, fim: 5, texto: "reais" },
  ], PRESET_ELEVENLABS);
  assert.deepEqual(r.map((b) => [b.texto, b.estilo]), [
    ["tá saindo por", "normal"],
    ["1.000 REAIS", "preco"],
  ]);
  assert.equal(r[1]?.inicio, 3); // comeca na palavra "mil"
  assert.equal(r[1]?.fim, 5); // e vai ate o fim do bloco que ele esvaziou
});

test("hibrido com dado real: variacao 1 do Andro 19.09", () => {
  const eleven = readFileSync(new URL("./fixtures/elevenlabs-andro1909-variacao1.json", import.meta.url), "utf8");
  const premiere = lerSrt(readFileSync(new URL("./fixtures/premiere-andro1909-variacao1.srt", import.meta.url), "utf8"));
  const r = blocosNosCortes(palavrasDoElevenLabs(eleven) ?? [], premiere, PRESET_ELEVENLABS);
  const texto = r.map((b) => b.texto).join(" | ");
  // Os erros do Premiere que o Leo corrigia a mao saem certos, no corte do Premiere.
  assert.match(texto, /Você falha \|/);
  // Ponto no meio do bloco vira virgula, como na legenda revisada.
  assert.match(texto, /hora H, E ela\?/);
  // "super-homem" numa palavra so, no Premiere em dois blocos: nao repete "homem".
  assert.doesNotMatch(texto, /\| homem \|/);
  assert.match(texto, /sou médico/);
  assert.match(texto, /me valoriza/);
  assert.match(texto, /estresse/);
  assert.doesNotMatch(texto, /Você faz|fui médico|stress\b/);
  assert.deepEqual(r.filter((b) => b.estilo === "preco").map((b) => b.texto), ["1.000 REAIS", "196 REAIS"]);
  // Nenhum bloco do Premiere some e nenhum fica sem palavra.
  assert.ok(r.length >= premiere.length - 1, `${r.length} blocos para ${premiere.length} do Premiere`);
  assert.ok(r.every((b) => !b.motivos.includes("o ElevenLabs nao ouviu nada aqui: texto do Premiere")));
  assert.equal(r[0]?.inicio, premiere[0]?.inicio);
});
