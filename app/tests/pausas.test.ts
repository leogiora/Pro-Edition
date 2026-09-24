import { test } from "node:test";
import assert from "node:assert/strict";

import { CRUZAMENTO_Q, JANELA_S, sequenciaDasBrutas, tirarPausas, type FonteAnalisada } from "../src/pausas.ts";
import { sequenciaParaXml, type Midia, type Sequencia } from "../src/xml.ts";

const FPS = 25;
const bruta: Midia = { caminho: "C:\\brutas\\C1639.mp4", duracaoQ: 250, largura: 3840, altura: 2160, canais: 2 };

/** 10 s de arquivo: fala de 1 a 2 s e de 4 a 5 s, silencio no resto. */
function fonte(): FonteAnalisada {
  const niveis = Array.from({ length: 10 / JANELA_S }, (_, i) => {
    const t = i * JANELA_S;
    return (t >= 1 && t < 2) || (t >= 4 && t < 5) ? -20 : -60;
  });
  const palavra = (text: string, inicio: number, fim: number) => ({ text, inicio, fim, confidence: 1, eos: false, sourceName: "x" });
  return {
    niveis,
    palavras: [palavra("olá", 1, 1.5), palavra("mundo", 1.5, 2), palavra("tudo", 4, 4.5), palavra("bem", 4.5, 5)],
  };
}

const umClipe = (extra: Partial<Sequencia> = {}): Sequencia => ({
  nome: "Reels",
  fps: FPS,
  largura: 1080,
  altura: 1920,
  video: [[{ midia: bruta, inicioQ: 0, fimQ: 250, entradaQ: 0, escala: 90, deslocamento: { x: 128, y: 0 } }]],
  audio: [[{ midia: bruta, inicioQ: 0, fimQ: 250, entradaQ: 0 }]],
  ...extra,
});

test("tira o silencio, cola a fala e mantem o enquadramento do clipe", () => {
  const r = tirarPausas(umClipe(), new Map([[bruta.caminho, fonte()]]));
  const [v1] = r.sequencia.video;
  assert.equal(v1?.length, 2, "dois trechos de fala");
  assert.ok(r.depoisQ < r.antesQ);
  // Cerca de 1 s de fala + margem de cada lado, duas vezes.
  assert.ok(r.depoisQ >= 50 && r.depoisQ <= 62, `duracao ${r.depoisQ}`);
  assert.ok(v1?.every((c) => c.escala === 90 && c.deslocamento?.x === 128));
  // Colados, com crossfade no ponto em que se encostam.
  assert.equal(v1?.[1]?.inicioQ, v1?.[0]?.fimQ);
  assert.deepEqual(r.sequencia.cruzamentos, [{ trilha: 0, emQ: v1?.[1]?.inicioQ, duracaoQ: CRUZAMENTO_Q }]);
  // O primeiro trecho comeca pouco antes de "olá" no arquivo.
  assert.ok(v1![0]!.entradaQ >= 22 && v1![0]!.entradaQ <= 25, `entrada ${v1![0]!.entradaQ}`);
  assert.equal(r.conferencia.ok, true, r.conferencia.linhas.join("\n"));
  assert.deepEqual(r.palavras.map((p) => p.text), ["olá", "mundo", "tudo", "bem"]);
  assert.ok(r.palavras[0]!.inicio > 0 && r.palavras[0]!.inicio < 0.2);
  // Sai um XML valido.
  assert.match(sequenciaParaXml(r.sequencia), /<name>Reels sem pausas<\/name>/);
});

test("o espaco que o editor deixou entre dois videos fica do mesmo tamanho, sem crossfade", () => {
  const entrada = umClipe({
    video: [
      [
        { midia: bruta, inicioQ: 0, fimQ: 250, entradaQ: 0 },
        { midia: bruta, inicioQ: 300, fimQ: 550, entradaQ: 0 },
      ],
    ],
  });
  const r = tirarPausas(entrada, new Map([[bruta.caminho, fonte()]]));
  const v1 = r.sequencia.video[0]!;
  assert.equal(v1.length, 4);
  // Entre o video 1 (2 trechos) e o video 2: o mesmo buraco de 50 quadros.
  assert.equal(v1[2]!.inicioQ - v1[1]!.fimQ, 50);
  assert.equal(r.sequencia.cruzamentos?.length, 2);
  assert.ok(r.sequencia.cruzamentos?.every((x) => x.emQ !== v1[2]!.inicioQ));
  assert.equal(r.conferencia.ok, true);
});

test("arquivo sem audio e recusado com explicacao", () => {
  const mudo = { ...bruta, canais: 0 };
  assert.throws(
    () => tirarPausas(umClipe({ video: [[{ midia: mudo, inicioQ: 0, fimQ: 250, entradaQ: 0 }]] }), new Map([[bruta.caminho, fonte()]])),
    /não tem áudio/
  );
});

test("brutas soltas: um clipe por arquivo, com respiro, escala que preenche o quadro", () => {
  const s = sequenciaDasBrutas(
    [
      { caminho: "a.mp4", duracaoQ: 100, largura: 3840, altura: 2160, canais: 2 },
      { caminho: "b.mp4", duracaoQ: 80, largura: 1080, altura: 1920, canais: 2 },
    ],
    { fps: FPS, largura: 1080, altura: 1920, respiroQ: 75 }
  );
  assert.deepEqual(s.video[0]?.map((c) => [c.inicioQ, c.fimQ, c.escala]), [
    [0, 100, 90],
    [175, 255, 100],
  ]);
});
