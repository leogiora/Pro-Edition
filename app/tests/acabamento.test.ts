import { test } from "node:test";
import assert from "node:assert/strict";

import perfilBruto from "../../src/autosplit-perfil.json" with { type: "json" };
import type { Perfil } from "../../src/autosplit.ts";
import { acabar, variacoes } from "../src/acabamento.ts";
import { sequenciaParaXml, validarSequencia, type Midia, type Sequencia } from "../src/xml.ts";

const perfil = perfilBruto as unknown as Perfil;
const bruta: Midia = { caminho: "C:\\brutas\\C1639.mp4", duracaoQ: 11256, largura: 3840, altura: 2160, canais: 2 };
const broll: Midia = { caminho: "C:\\Brolls\\Consulta médica (1).mp4", duracaoQ: 200, largura: 720, altura: 1280, canais: 2 };
const musica: Midia = { caminho: "C:\\Musica\\piano.wav", duracaoQ: 100, canais: 2 };

/** Duas variacoes: 0-300 (dois pedacos colados) e, depois de 250 quadros de espaco, 550-800. */
const seq: Sequencia = {
  nome: "Reels",
  fps: 25,
  largura: 1080,
  altura: 1920,
  video: [
    [
      { midia: bruta, inicioQ: 0, fimQ: 150, entradaQ: 0 },
      { midia: bruta, inicioQ: 150, fimQ: 300, entradaQ: 200 },
      { midia: bruta, inicioQ: 550, fimQ: 800, entradaQ: 900 },
    ],
    [
      { midia: broll, inicioQ: 250, fimQ: 350, entradaQ: 0, escala: 150 },
      { midia: broll, inicioQ: 600, fimQ: 700, entradaQ: 0, escala: 150 },
    ],
  ],
  audio: [[{ midia: bruta, inicioQ: 0, fimQ: 800, entradaQ: 0 }]],
};

test("variacoes: cortes colados sao a mesma variacao; o espaco separa", () => {
  assert.deepEqual(variacoes(seq.video[0]!, 25), [
    { inicioQ: 0, fimQ: 300 },
    { inicioQ: 550, fimQ: 800 },
  ]);
});

test("B-roll que passa do fim do doutor e aparado", () => {
  const r = acabar(seq, {});
  assert.equal(r.variacoes, 2);
  assert.equal(r.aparados, 1);
  assert.deepEqual(r.sequencia.video[1]?.map((c) => [c.inicioQ, c.fimQ]), [
    [250, 300],
    [600, 700],
  ]);
});

test("Split: B-roll na caixa de baixo, com corte do topo e feather, abaixo do meio da tela", () => {
  const r = acabar(seq, { split: { divisao: 50, perfil, override: {} } });
  assert.equal(r.enquadrados, 2);
  for (const c of r.sequencia.video[1]!) {
    assert.ok((c.deslocamento?.y ?? 0) > 0, "centro do B-roll desce para a metade de baixo");
    assert.ok((c.recorte?.topo ?? 0) > 0);
    assert.equal(c.recorte?.suavizar, 5);
    assert.notEqual(c.escala, 150);
  }
});

test("Trilha: uma por variacao, repetindo a musica curta, terminando com o doutor", () => {
  const r = acabar(seq, { trilha: { midia: musica, ganhoDb: -20 } });
  const a2 = r.sequencia.audio[1]!;
  assert.deepEqual(a2.map((c) => [c.inicioQ, c.fimQ]), [
    [0, 100],
    [100, 200],
    [200, 300],
    [550, 650],
    [650, 750],
    [750, 800],
  ]);
  assert.ok(a2.every((c) => c.ganhoDb === -20 && c.entradaQ === 0));
  assert.deepEqual(validarSequencia(r.sequencia), []);
  assert.match(sequenciaParaXml(r.sequencia), /<name>Reels final<\/name>/);
});
