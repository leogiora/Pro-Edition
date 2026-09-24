import { test } from "node:test";
import assert from "node:assert/strict";

import { cortarEm, cortarPodcast, JANELA_MS, nivelDaTrilha } from "../src/podcast.ts";
import { validarSequencia, type Midia, type Sequencia } from "../src/xml.ts";

const FPS = 25;
const camA: Midia = { caminho: "C:\\pod\\camA.mp4", duracaoQ: 750, largura: 1920, altura: 1080, canais: 2 };
const camB: Midia = { caminho: "C:\\pod\\camB.mp4", duracaoQ: 750, largura: 1920, altura: 1080, canais: 2 };
const micA: Midia = { caminho: "C:\\pod\\micA.wav", duracaoQ: 750, canais: 1 };
const micB: Midia = { caminho: "C:\\pod\\micB.wav", duracaoQ: 750, canais: 1 };

/** 30 s: A fala de 0 a 10 s, B de 10 a 20 s, A de 20 a 30 s. B vaza baixo no microfone de A. */
function niveis(quem: "A" | "B"): number[] {
  return Array.from({ length: 30000 / JANELA_MS }, (_, i) => {
    const t = (i * JANELA_MS) / 1000;
    const falaA = t < 10 || t >= 20;
    const dono = quem === "A" ? falaA : !falaA;
    return dono ? -20 : -45;
  });
}

const podcast: Sequencia = {
  nome: "Episódio 12",
  fps: FPS,
  largura: 1920,
  altura: 1080,
  video: [[{ midia: camA, inicioQ: 0, fimQ: 750, entradaQ: 0 }], [{ midia: camB, inicioQ: 0, fimQ: 750, entradaQ: 0 }]],
  audio: [[{ midia: micA, inicioQ: 0, fimQ: 750, entradaQ: 0 }], [{ midia: micB, inicioQ: 0, fimQ: 750, entradaQ: 0 }]],
};

test("cortar em quadros mantem a entrada do arquivo acompanhando", () => {
  const pedacos = cortarEm([{ midia: camA, inicioQ: 100, fimQ: 400, entradaQ: 50 }], [0, 200, 400, 900]);
  assert.deepEqual(pedacos.map((c) => [c.inicioQ, c.fimQ, c.entradaQ]), [
    [100, 200, 50],
    [200, 400, 150],
  ]);
});

test("nivel da trilha: o trecho de cada clipe, no tempo da sequencia", () => {
  const db = nivelDaTrilha([{ midia: micA, inicioQ: 250, fimQ: 500, entradaQ: 0 }], FPS, 750, () => niveis("A"));
  assert.equal(db.length, 30000 / JANELA_MS);
  assert.equal(db[0], -120, "antes do clipe e silencio");
  assert.equal(db[Math.round(12 / 0.02)], -20, "12 s da sequencia = 2 s do arquivo, A falando");
});

test("quem fala fica ligado nas duas trilhas dele; o outro, desligado — mesmos cortes nas quatro", () => {
  const r = cortarPodcast(podcast, niveis("A"), niveis("B"));
  assert.equal(r.trocas, 2);
  const estado = (t: readonly { inicioQ: number; ativo?: boolean }[]) => t.map((c) => [c.inicioQ, c.ativo]);
  const esperadoA = [
    [0, true],
    [estado(r.sequencia.video[0]!)[1]![0], false],
    [estado(r.sequencia.video[0]!)[2]![0], true],
  ];
  assert.deepEqual(estado(r.sequencia.video[0]!), esperadoA);
  assert.deepEqual(estado(r.sequencia.audio[0]!), esperadoA);
  assert.deepEqual(estado(r.sequencia.video[1]!), esperadoA.map(([q, a]) => [q, !a]));
  assert.deepEqual(estado(r.sequencia.audio[1]!), esperadoA.map(([q, a]) => [q, !a]));
  // A troca cai perto de 10 s e de 20 s (com o pre-roll de quem entra).
  const troca1 = r.sequencia.video[0]![1]!.inicioQ / FPS;
  assert.ok(Math.abs(troca1 - 10) < 0.3, `troca em ${troca1}`);
  assert.ok(Math.abs(r.tempo.A - 20) < 0.5 && Math.abs(r.tempo.B - 10) < 0.5);
  assert.deepEqual(validarSequencia(r.sequencia), []);
});
