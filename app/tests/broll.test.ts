import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { palavrasDoElevenLabs } from "../../ferramentas/pro-captions/src/elevenlabs.ts";
import { colocarBroll, type ArquivoBroll } from "../src/broll.ts";
import { lerSequenciaXml } from "../src/xml-ler.ts";
import { sequenciaParaXml, validarSequencia, type Midia, type Sequencia } from "../src/xml.ts";

/** A fala real da variacao 1 do Andro 19.09 (ElevenLabs). */
const palavras = palavrasDoElevenLabs(
  readFileSync(new URL("../../ferramentas/pro-captions/tests/fixtures/elevenlabs-andro1909-variacao1.json", import.meta.url), "utf8")
)!;

const lib = (nome: string): ArquivoBroll => ({ nome, caminho: `C:\Brolls\${nome}`, duracaoQ: 200, largura: 720, altura: 1280, canais: 2 });
const biblioteca = ["Hormônio.mp4", "Doutor (1).mp4", "Doutor (2).mp4", "Consulta médica (1).mp4", "Teleconsulta (1).mp4", "Carro (1).mp4"].map(lib);

const bruta: Midia = { caminho: "C:\brutas\C1639.mp4", duracaoQ: 11256, largura: 3840, altura: 2160, canais: 2 };
const entrada = (v2: Sequencia["video"][number] = []): Sequencia => ({
  nome: "Variação 1",
  fps: 25,
  largura: 1080,
  altura: 1920,
  video: [[{ midia: bruta, inicioQ: 0, fimQ: 1462, entradaQ: 0, escala: 90 }], v2],
  audio: [[{ midia: bruta, inicioQ: 0, fimQ: 1462, entradaQ: 0 }]],
});

test("fala real: B-roll entra onde o assunto e dito, cobrindo a tela, sem audio", () => {
  const r = colocarBroll(entrada(), palavras, biblioteca);
  const nomes = r.colocacoes.map((c) => c.arquivo);
  assert.ok(nomes.includes("Hormônio.mp4"), nomes.join(", "));
  assert.ok(nomes.some((n) => n.startsWith("Doutor")), nomes.join(", "));
  assert.ok(!nomes.includes("Carro (1).mp4"), "conceito que ninguem falou nao entra");

  const hormonio = r.colocacoes.find((c) => c.arquivo === "Hormônio.mp4")!;
  assert.ok(hormonio.inicio > 33 && hormonio.inicio < 36, `hormônio em ${hormonio.inicio}`);

  const v2 = r.sequencia.video[1]!;
  assert.equal(v2.length, r.colocacoes.length);
  assert.ok(v2.every((c) => c.escala === 150));
  assert.deepEqual(r.sequencia.audio, entrada().audio, "B-roll entra mudo: nenhuma trilha de audio nova");
  assert.deepEqual(validarSequencia(r.sequencia), []);
  // Sai um XML que o leitor entende de volta.
  assert.equal(lerSequenciaXml(sequenciaParaXml(r.sequencia)).video[1]?.length, v2.length);
});

test("B-roll que o Leo ja colocou fica, e nada entra por cima dele", () => {
  const dele = { midia: { ...bruta, caminho: "C:\Brolls\Meu.mp4" }, inicioQ: 25 * 33, fimQ: 25 * 38, entradaQ: 0 };
  const r = colocarBroll(entrada([dele]), palavras, biblioteca);
  const v2 = r.sequencia.video[1]!;
  assert.ok(v2.includes(dele));
  assert.ok(!r.colocacoes.some((c) => c.arquivo === "Hormônio.mp4"), "hormônio caia exatamente ali");
  assert.ok(r.descartes.some((d) => /ja ha B-roll ai/.test(d)));
  for (let i = 1; i < v2.length; i++) assert.ok(v2[i]!.inicioQ >= v2[i - 1]!.fimQ, "sobreposicao na V2");
});
