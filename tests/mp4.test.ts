import { test } from "node:test";
import assert from "node:assert/strict";

import { agitacaoDeMp4, dimensoesDeMp4 } from "../src/mp4.ts";

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

const u32 = (n: number): number[] => [(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff];

/** stsz: versao+flags(4) + sample_size(4) + sample_count(4) + entradas(4 cada). */
function stsz(tamanhos: number[], tamanhoUnico = 0): number[] {
  return box("stsz", [
    0, 0, 0, 0,
    ...u32(tamanhoUnico),
    ...u32(tamanhos.length),
    ...(tamanhoUnico === 0 ? tamanhos.flatMap(u32) : []),
  ]);
}

/** Um trak completo: tkhd + mdia > minf > stbl > stsz. */
function trakCompleto(width: number, height: number, quadros: number[], tamanhoUnico = 0): number[] {
  return box("trak", [
    ...tkhd(width, height),
    ...box("mdia", box("minf", box("stbl", stsz(quadros, tamanhoUnico)))),
  ]);
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

test("dimensoesDeMp4: continua funcionando com trak completo", () => {
  const arquivo = new Uint8Array(box("moov", trakCompleto(720, 1280, [100, 200])));
  assert.deepEqual(dimensoesDeMp4(arquivo), { width: 720, height: 1280 });
});

// ------------------------------- agitacao -----------------------------------

test("agitacaoDeMp4: media de bytes por quadro dividida pelos pixels", () => {
  // 4 quadros de media 1000 bytes, quadro de 100x100 = 10000 pixels.
  const arquivo = new Uint8Array(box("moov", trakCompleto(100, 100, [400, 800, 1200, 1600])));
  assert.equal(agitacaoDeMp4(arquivo), 0.1);
});

test("agitacaoDeMp4: clipe agitado mede mais que clipe parado", () => {
  const parado = new Uint8Array(box("moov", trakCompleto(100, 100, [100, 100, 120, 100])));
  const agitado = new Uint8Array(box("moov", trakCompleto(100, 100, [900, 1100, 1000, 1000])));
  assert.ok((agitacaoDeMp4(agitado) ?? 0) > (agitacaoDeMp4(parado) ?? 0));
});

test("agitacaoDeMp4: normaliza por resolucao — mesma cena em tamanhos diferentes bate", () => {
  const pequeno = new Uint8Array(box("moov", trakCompleto(464, 832, [386048, 386048])));
  const grande = new Uint8Array(box("moov", trakCompleto(720, 1280, [921600, 921600])));
  assert.equal(agitacaoDeMp4(pequeno), agitacaoDeMp4(grande));
});

test("agitacaoDeMp4: le o stsz do track de VIDEO, nao o do audio", () => {
  // O trak de audio vem primeiro, com dimensao zerada e quadros minusculos.
  const arquivo = new Uint8Array(
    box("moov", [
      ...trakCompleto(0, 0, [10, 10, 10, 10]),
      ...trakCompleto(100, 100, [400, 800, 1200, 1600]),
    ])
  );
  assert.equal(agitacaoDeMp4(arquivo), 0.1);
});

test("agitacaoDeMp4: quadro de tamanho fixo nao tem sinal de movimento", () => {
  const arquivo = new Uint8Array(box("moov", trakCompleto(100, 100, [1, 2, 3], 500)));
  assert.equal(agitacaoDeMp4(arquivo), null);
});

test("agitacaoDeMp4: sem stsz devolve null em vez de chutar", () => {
  const arquivo = new Uint8Array(box("moov", box("trak", tkhd(720, 1280))));
  assert.equal(agitacaoDeMp4(arquivo), null);
});

test("agitacaoDeMp4: stsz truncado nao lanca nem entra em laco", () => {
  // Declara 1000 entradas e entrega duas.
  const mentiroso = box("stsz", [0, 0, 0, 0, ...u32(0), ...u32(1000), ...u32(500), ...u32(500)]);
  const arquivo = new Uint8Array(
    box("moov", box("trak", [...tkhd(100, 100), ...box("mdia", box("minf", box("stbl", mentiroso)))]))
  );
  assert.equal(agitacaoDeMp4(arquivo), null);
});
