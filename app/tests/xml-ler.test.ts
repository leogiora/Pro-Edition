import { test } from "node:test";
import assert from "node:assert/strict";

import { caminhoDaUrl, lerSequenciaXml, lerXml } from "../src/xml-ler.ts";
import { sequenciaParaXml, type Midia, type Sequencia } from "../src/xml.ts";

const bruta: Midia = { caminho: "C:\\Edição\\Andro 19.09\\C1639.mp4", duracaoQ: 11256, largura: 3840, altura: 2160, canais: 2 };
const trilha: Midia = { caminho: "C:\\Música\\piano.wav", duracaoQ: 5000, canais: 2 };

const seq: Sequencia = {
  nome: "Reels",
  fps: 25,
  largura: 1080,
  altura: 1920,
  video: [
    [
      { midia: bruta, inicioQ: 0, fimQ: 24, entradaQ: 86, escala: 90, grupo: "a" },
      { midia: bruta, inicioQ: 24, fimQ: 60, entradaQ: 120, escala: 90, deslocamento: { x: 270, y: 0 }, flop: true, grupo: "b" },
    ],
    [{ midia: bruta, inicioQ: 10, fimQ: 20, entradaQ: 0, ativo: false, recorte: { esquerda: 0, direita: 0, topo: 50, base: 0 } }],
  ],
  audio: [
    [
      { midia: bruta, inicioQ: 0, fimQ: 24, entradaQ: 86, grupo: "a" },
      { midia: bruta, inicioQ: 24, fimQ: 60, entradaQ: 120, grupo: "b" },
    ],
    [{ midia: trilha, inicioQ: 0, fimQ: 60, entradaQ: 0, ganhoDb: -12 }],
  ],
};

test("parser: elementos, atributos, texto com entidade, auto-fechado, comentario e doctype", () => {
  const r = lerXml('<?xml version="1.0"?><!DOCTYPE xmeml><!-- oi --><a x="1 &amp; 2"><b>A &lt; B</b><c/></a>');
  const a = r.filhos[0]!;
  assert.equal(a.nome, "a");
  assert.equal(a.atributos.x, "1 & 2");
  assert.equal(a.filhos[0]!.texto, "A < B");
  assert.equal(a.filhos[1]!.nome, "c");
  assert.throws(() => lerXml("<a><b></a>"), /XML quebrado/);
});

test("url do Premiere volta a caminho do Windows, com acento e com C%3a", () => {
  assert.equal(caminhoDaUrl("file://localhost/C:/Edi%C3%A7%C3%A3o/a%20b.mp4"), "C:\\Edição\\a b.mp4");
  assert.equal(caminhoDaUrl("file://localhost/C%3a/Edi%C3%A7%C3%A3o/a%20b.mp4"), "C:\\Edição\\a b.mp4");
});

test("ida e volta: o que xml.ts escreve, xml-ler.ts le igual", () => {
  const lida = lerSequenciaXml(sequenciaParaXml(seq));
  assert.deepEqual(lida.avisos, []);
  assert.equal(lida.nome, "Reels");
  assert.equal(lida.fps, 25);
  assert.equal(lida.largura, 1080);

  const [v1, v2] = lida.video;
  assert.equal(v1?.length, 2);
  assert.deepEqual(
    v1?.map((c) => [c.inicioQ, c.fimQ, c.entradaQ, c.escala, c.midia.caminho]),
    [
      [0, 24, 86, 90, bruta.caminho],
      [24, 60, 120, 90, bruta.caminho],
    ]
  );
  assert.deepEqual(v1?.[1]?.deslocamento, { x: 270, y: 0 });
  assert.equal(v1?.[1]?.flop, true);
  assert.equal(v2?.[0]?.ativo, false);
  assert.deepEqual(v2?.[0]?.recorte, { esquerda: 0, direita: 0, topo: 50, base: 0 });
  assert.equal(v1?.[0]?.midia.largura, 3840);

  // O par video/audio cai no mesmo grupo.
  assert.equal(v1?.[0]?.grupo, lida.audio[0]?.[0]?.grupo);
  assert.notEqual(v1?.[0]?.grupo, v1?.[1]?.grupo);
  assert.ok(Math.abs((lida.audio[1]?.[0]?.ganhoDb ?? 0) + 12) < 1e-4);
});

test("clipe sem arquivo (titulo) vira aviso, nao erro", () => {
  const xml = sequenciaParaXml(seq).replace(
    "<track>",
    "<track><clipitem id=\"t1\"><name>Título</name><start>0</start><end>10</end><in>0</in><out>10</out></clipitem>"
  );
  const lida = lerSequenciaXml(xml);
  assert.equal(lida.avisos.length, 1);
  assert.match(lida.avisos[0]!, /Título: sem arquivo/);
  assert.equal(lida.video[0]?.length, 2);
});

test("XML sem sequencia explica o que fazer no Premiere", () => {
  assert.throws(() => lerSequenciaXml('<?xml version="1.0"?><xmeml version="4"></xmeml>'), /Exportar > Final Cut Pro XML/);
});
