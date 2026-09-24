import { test } from "node:test";
import assert from "node:assert/strict";

import { ganhoLinear, sequenciaParaXml, urlDoArquivo, validarSequencia, type Midia, type Sequencia } from "../src/xml.ts";

const bruta: Midia = { caminho: "C:\\Edição\\Andro 19.09\\C1639.mp4", duracaoQ: 11256, largura: 3840, altura: 2160, canais: 2 };
const trilha: Midia = { caminho: "C:\\Música\\piano.wav", duracaoQ: 5000, canais: 2 };

const seq = (extra: Partial<Sequencia> = {}): Sequencia => ({
  nome: "Variação 1",
  fps: 25,
  largura: 1080,
  altura: 1920,
  video: [
    [
      { midia: bruta, inicioQ: 0, fimQ: 24, entradaQ: 86, escala: 90, grupo: "a" },
      { midia: bruta, inicioQ: 24, fimQ: 60, entradaQ: 120, escala: 90, deslocamento: { x: 270, y: 0 }, flop: true, grupo: "b" },
    ],
  ],
  audio: [
    [
      { midia: bruta, inicioQ: 0, fimQ: 24, entradaQ: 86, grupo: "a" },
      { midia: bruta, inicioQ: 24, fimQ: 60, entradaQ: 120, grupo: "b" },
    ],
    [{ midia: trilha, inicioQ: 0, fimQ: 60, entradaQ: 0, ganhoDb: -12 }],
  ],
  cruzamentos: [{ trilha: 0, emQ: 24, duracaoQ: 2 }],
  ...extra,
});

test("caminho do Windows vira URL que o Premiere le, com acento e espaco codificados", () => {
  assert.equal(urlDoArquivo("C:\\Edição\\a b.mp4"), "file://localhost/C:/Edi%C3%A7%C3%A3o/a%20b.mp4");
});

test("xml: cabecalho, sequencia, um <file> completo por arquivo e referencias depois", () => {
  const xml = sequenciaParaXml(seq());
  assert.ok(xml.startsWith('<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE xmeml>\n<xmeml version="4">'));
  assert.match(xml, /<name>Variação 1<\/name><duration>60<\/duration>/);
  assert.match(xml, /<width>1080<\/width><height>1920<\/height>/);
  assert.equal(xml.match(/<file id="file-1">/g)?.length, 1);
  assert.equal(xml.match(/<file id="file-1"\/>/g)?.length, 3);
  assert.equal(xml.match(/<file id="file-2">/g)?.length, 1);
  // in/out do arquivo acompanham a duracao do clipe na timeline.
  assert.match(xml, /<start>24<\/start><end>60<\/end><in>120<\/in><out>156<\/out>/);
});

test("xml: escala, deslocamento, flop, ganho, vinculo e crossfade", () => {
  const xml = sequenciaParaXml(seq());
  assert.match(xml, /<parameterid>scale<\/parameterid><name>Scale<\/name><valuemin>0<\/valuemin><valuemax>1000<\/valuemax><value>90<\/value>/);
  assert.match(xml, /<horiz>0\.25<\/horiz><vert>0<\/vert>/);
  assert.equal(xml.match(/<effectid>Flop<\/effectid>/g)?.length, 1);
  assert.match(xml, new RegExp(`<value>${ganhoLinear(-12).toFixed(6)}</value>`));
  // Video 1 (clipitem-1) e audio 1 (clipitem-3) se apontam.
  assert.match(xml, /<clipitem id="clipitem-1">.*<linkclipref>clipitem-3<\/linkclipref><mediatype>audio<\/mediatype>.*<\/clipitem>/s);
  assert.match(xml, /<transitionitem>.*<start>23<\/start><end>25<\/end>.*KGAudioTransCrossFade3dB/);
});

test("clipe desligado sai como enabled FALSE", () => {
  const s = seq();
  const [v1] = s.video;
  const xml = sequenciaParaXml({ ...s, video: [[{ ...v1![0]!, ativo: false }, v1![1]!]] });
  assert.equal(xml.match(/<enabled>FALSE<\/enabled>/g)?.length, 1);
});

test("validacao pega sobreposicao, quadro quebrado e trecho fora do arquivo", () => {
  assert.deepEqual(validarSequencia(seq()), []);
  const ruim = seq({
    video: [
      [
        { midia: bruta, inicioQ: 0, fimQ: 30, entradaQ: 0 },
        { midia: bruta, inicioQ: 20, fimQ: 40.5, entradaQ: 0 },
        { midia: bruta, inicioQ: 50, fimQ: 60, entradaQ: 11250 },
      ],
    ],
  });
  const erros = validarSequencia(ruim);
  assert.equal(erros.length, 3, erros.join("\n"));
  assert.throws(() => sequenciaParaXml(ruim), /sequencia invalida/);
});

test("nome com & e < nao quebra o XML", () => {
  const xml = sequenciaParaXml(seq({ nome: "A & B <teste>" }));
  assert.match(xml, /<name>A &amp; B &lt;teste&gt;<\/name>/);
});
