import { test } from "node:test";
import assert from "node:assert/strict";

import { cortesDosPedacos, dentroDasVariacoes, moverPalavras, variacoes } from "../src/editar.ts";
import type { Pedaco } from "../src/pausas.ts";

const FPS = 25;
const w = (text: string, inicio: number, fim: number) => ({ text, inicio, fim, confidence: 1, eos: false, sourceName: "seq" });

test("variacoes: pedacos colados sao a mesma; o espaco de 1 s ou mais separa", () => {
  const clipes = [
    { inicioQ: 0, fimQ: 100 },
    { inicioQ: 100, fimQ: 200 },
    { inicioQ: 210, fimQ: 250 }, // 10 quadros = 0,4 s: ainda a mesma
    { inicioQ: 300, fimQ: 400 }, // 50 quadros = 2 s: outra
  ];
  assert.deepEqual(variacoes(clipes, FPS), [
    { inicioQ: 0, fimQ: 250 },
    { inicioQ: 300, fimQ: 400 },
  ]);
});

test("a fala anda junto com o pedaco; a que estava na pausa cortada some", () => {
  // Antes: fala de 1 a 2 s e de 4 a 5 s. O corte guardou [0,8-2,2] e [3,8-5,2].
  const pedacos: Pedaco[] = [
    { fonte: 0, midiaDeQ: 20, midiaAteQ: 55, destinoQ: 0, origemQ: 20 },
    { fonte: 0, midiaDeQ: 95, midiaAteQ: 130, destinoQ: 35, origemQ: 95 },
  ];
  const antes = [w("olá", 1, 1.5), w("mundo", 1.5, 2), w("hum", 3, 3.2), w("tudo", 4, 4.5), w("bem", 4.5, 5)];
  const depois = moverPalavras(antes, pedacos, FPS);
  assert.deepEqual(depois.map((p) => p.text), ["olá", "mundo", "tudo", "bem"]);
  assert.ok(Math.abs(depois[0]!.inicio - 0.2) < 1e-9, `olá em ${depois[0]!.inicio}`);
  assert.ok(Math.abs(depois[2]!.inicio - (1.4 + 0.2)) < 1e-9, `tudo em ${depois[2]!.inicio}`);
  assert.deepEqual(cortesDosPedacos(pedacos, FPS), [1.4]);
});

test("B-roll termina com o doutor; o que cai no espaco ou sobra curto sai", () => {
  const vars = [
    { inicioQ: 0, fimQ: 250 }, // 0 a 10 s
    { inicioQ: 300, fimQ: 500 }, // 12 a 20 s
  ];
  const r = dentroDasVariacoes(
    [
      { arquivo: "a.mp4", inicio: 2, duracao: 3 }, // fica igual
      { arquivo: "b.mp4", inicio: 8, duracao: 3 }, // aparado para 2 s
      { arquivo: "c.mp4", inicio: 9.5, duracao: 3 }, // sobraria 0,5 s
      { arquivo: "d.mp4", inicio: 11, duracao: 2 }, // no espaco
    ],
    vars,
    FPS
  );
  assert.deepEqual(r.ficam.map((c) => [c.arquivo, c.duracao]), [
    ["a.mp4", 3],
    ["b.mp4", 2],
  ]);
  assert.equal(r.aparados, 1);
  assert.equal(r.fora.length, 2);
});
