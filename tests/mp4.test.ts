import { test } from "node:test";
import assert from "node:assert/strict";

import { dimensoesDeMp4 } from "../src/mp4.ts";

function box(tipo: string, conteudo: number[]): number[] {
  const tamanho = 8 + conteudo.length;
  return [
    (tamanho >>> 24) & 0xff,
    (tamanho >>> 16) & 0xff,
    (tamanho >>> 8) & 0xff,
    tamanho & 0xff,
    ...[...tipo].map((c) => c.charCodeAt(0)),
    ...conteudo,
  ];
}

/** tkhd v0: versao+flags(4) + campos de tempo(20) + 52 bytes ate largura. */
function tkhd(width: number, height: number, versao = 0): number[] {
  const camposDeTempo = versao === 1 ? 32 : 20;
  const corpo = [versao, 0, 0, 0, ...new Array<number>(camposDeTempo + 52).fill(0)];
  const fixo = (n: number): number[] => [(n >>> 8) & 0xff, n & 0xff, 0, 0];
  return box("tkhd", [...corpo, ...fixo(width), ...fixo(height)]);
}

test("dimensoesDeMp4: le largura e altura de um tkhd v0", () => {
  const arquivo = new Uint8Array(box("moov", box("trak", tkhd(720, 1280))));
  assert.deepEqual(dimensoesDeMp4(arquivo), { width: 720, height: 1280 });
});

test("dimensoesDeMp4: entende tkhd versao 1, com campos de 64 bits", () => {
  const arquivo = new Uint8Array(box("moov", box("trak", tkhd(1080, 1920, 1))));
  assert.deepEqual(dimensoesDeMp4(arquivo), { width: 1080, height: 1920 });
});

test("dimensoesDeMp4: pula o track de audio, que tem dimensao zerada", () => {
  const arquivo = new Uint8Array(
    box("moov", [...box("trak", tkhd(0, 0)), ...box("trak", tkhd(464, 832))])
  );
  assert.deepEqual(dimensoesDeMp4(arquivo), { width: 464, height: 832 });
});

test("dimensoesDeMp4: ignora boxes que nao interessam antes do moov", () => {
  const arquivo = new Uint8Array([
    ...box("ftyp", [0, 0, 0, 0]),
    ...box("free", [1, 2, 3, 4]),
    ...box("moov", box("trak", tkhd(720, 1280))),
  ]);
  assert.deepEqual(dimensoesDeMp4(arquivo), { width: 720, height: 1280 });
});

test("dimensoesDeMp4: sem tkhd devolve null em vez de chutar", () => {
  assert.equal(dimensoesDeMp4(new Uint8Array(box("ftyp", [0, 0, 0, 0]))), null);
  assert.equal(dimensoesDeMp4(new Uint8Array(0)), null);
});

test("dimensoesDeMp4: arquivo truncado nao entra em laco nem lanca", () => {
  // Box declara 999 bytes mas o arquivo acaba antes.
  const truncado = new Uint8Array([0, 0, 3, 231, ...[..."moov"].map((c) => c.charCodeAt(0)), 0, 0]);
  assert.equal(dimensoesDeMp4(truncado), null);
});

test("dimensoesDeMp4: box de tamanho zero vai ate o fim sem travar", () => {
  const arquivo = new Uint8Array([0, 0, 0, 0, ...[..."free"].map((c) => c.charCodeAt(0)), 1, 2, 3]);
  assert.equal(dimensoesDeMp4(arquivo), null);
});
