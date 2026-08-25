import assert from "node:assert/strict";
import { test } from "node:test";
import {
  blocosDeFala,
  CONFIG_PADRAO,
  cortes,
  decidir,
  falaPorNivel,
  fonteEsperada,
  msParaFrame,
  ruidoDeFundo,
  segmentar,
  speakerEm,
  type Trecho,
} from "../src/autocut.ts";

/** Revezamento simples: e o menor plano que exercita snap, corte e merge. */
const PLANO_TESTE: readonly Trecho[] = [
  { inicioMs: 0, fimMs: 10_000, speaker: "A" },
  { inicioMs: 10_000, fimMs: 20_000, speaker: "B" },
  { inicioMs: 20_000, fimMs: 30_000, speaker: "A" },
];

test("plano de teste vira tres segmentos e tres cortes a 30fps", () => {
  const segs = segmentar(PLANO_TESTE, 30);
  assert.deepEqual(
    segs.map((s) => [s.inicioF, s.fimF, s.speaker]),
    [
      [0, 300, "A"],
      [300, 600, "B"],
      [600, 900, "A"],
    ]
  );
  assert.deepEqual(cortes(segs), [300, 600, 900]);
});

test("29.97 encosta no quadro e nunca deixa buraco entre segmentos", () => {
  const segs = segmentar(PLANO_TESTE, 29.97);
  for (let i = 1; i < segs.length; i++) assert.equal(segs[i]!.inicioF, segs[i - 1]!.fimF);
  assert.ok(Number.isInteger(segs[0]!.fimF));
});

test("vizinhos do mesmo speaker viram um segmento so, sem corte inutil", () => {
  const segs = segmentar(
    [
      { inicioMs: 0, fimMs: 5000, speaker: "A" },
      { inicioMs: 5000, fimMs: 9000, speaker: "A" },
      { inicioMs: 9000, fimMs: 12_000, speaker: "B" },
    ],
    30
  );
  assert.equal(segs.length, 2);
  assert.deepEqual(cortes(segs), [270, 360]);
});

test("trecho curto demais para render um quadro nao vira corte", () => {
  const segs = segmentar(
    [
      { inicioMs: 0, fimMs: 5000, speaker: "A" },
      { inicioMs: 5000, fimMs: 5010, speaker: "B" },
      { inicioMs: 5010, fimMs: 9000, speaker: "A" },
    ],
    30
  );
  assert.deepEqual(cortes(segs), [270]); // so o fim do plano, nenhum corte no meio
  assert.equal(segs.length, 1);
});

test("speakerEm cobre o plano inteiro e so ele", () => {
  const segs = segmentar(PLANO_TESTE, 30);
  assert.equal(speakerEm(segs, 0), "A");
  assert.equal(speakerEm(segs, 299), "A");
  assert.equal(speakerEm(segs, 300), "B");
  assert.equal(speakerEm(segs, 899), "A");
  assert.equal(speakerEm(segs, 900), null);
});

test("fonte esperada acompanha o deslocamento do pedaco na timeline", () => {
  // clipe comeca no quadro 120 com in-point 360 na midia; pedaco no quadro 300
  assert.equal(fonteEsperada(360, 120, 300), 540);
  // pedaco na propria borda do clipe nao desloca a fonte
  assert.equal(fonteEsperada(360, 120, 120), 360);
});

test("msParaFrame recusa fps invalido em vez de gerar NaN", () => {
  assert.throws(() => msParaFrame(1000, 0));
});

// ------------------------------------------------------- motor de decisao

const CFG = { ...CONFIG_PADRAO, preRollMs: 0, postRollMs: 0 };
const fala = (inicioS: number, fimS: number) => ({ inicioMs: inicioS * 1000, fimMs: fimS * 1000 });
const quem = (t: readonly { speaker: string }[]) => t.map((x) => x.speaker).join("");

test("so A fala: um plano so, dele", () => {
  const d = decidir([fala(0, 10)], [], CFG);
  assert.equal(quem(d), "A");
});

test("so B fala: um plano so, dele", () => {
  const d = decidir([], [fala(0, 10)], CFG);
  assert.equal(quem(d), "B");
});

test("A fala, 300ms de silencio, A continua: nenhum corte", () => {
  const d = decidir([fala(0, 5), fala(5.3, 10)], [], CFG);
  assert.equal(d.length, 1);
  assert.equal(d[0]!.speaker, "A");
});

test("B diz 'aham' por 200ms enquanto A fala: continua em A", () => {
  const d = decidir([fala(0, 20)], [{ inicioMs: 8000, fimMs: 8200 }], CFG);
  assert.equal(quem(d), "A");
});

test("os dois falam juntos: mantem quem ja estava", () => {
  const d = decidir([fala(0, 10)], [fala(6, 10.4)], CFG);
  assert.equal(quem(d), "A");
});

test("B assume quando fala sozinho por tempo suficiente", () => {
  const d = decidir([fala(0, 10)], [fala(10, 25)], CFG);
  assert.equal(quem(d), "AB");
  assert.equal(d[1]!.inicioMs, 10_000);
});

test("revezamento normal vira um plano por pessoa", () => {
  const d = decidir([fala(0, 10), fala(20, 30)], [fala(10, 20)], CFG);
  assert.equal(quem(d), "ABA");
  assert.deepEqual(d.map((t) => t.inicioMs), [0, 10_000, 20_000]);
});

test("plano curto demais e absorvido em vez de virar corte", () => {
  // B fala 800ms no meio de A: passa da fala minima, mas nao do plano minimo
  const d = decidir([fala(0, 10), fala(10.8, 20)], [{ inicioMs: 10_000, fimMs: 10_800 }], CFG);
  assert.equal(quem(d), "A");
});

test("silencio no fim nao troca de camera", () => {
  const d = decidir([fala(0, 10)], [fala(10, 20)], CFG);
  assert.equal(d[d.length - 1]!.speaker, "B");
});

test("pre-roll e post-roll esticam o bloco de fala, nao a fala minima", () => {
  const cfg = { ...CONFIG_PADRAO, preRollMs: 500, postRollMs: 500 };
  // 200ms de fala: curta demais, e esticar nao pode salva-la
  assert.deepEqual(blocosDeFala([{ inicioMs: 5000, fimMs: 5200 }], cfg), []);
  // 1s de fala vira 2s com as folgas
  assert.deepEqual(blocosDeFala([{ inicioMs: 5000, fimMs: 6000 }], cfg), [{ inicioMs: 4500, fimMs: 6500 }]);
});

test("pre-roll nunca empurra o bloco para antes do zero", () => {
  const cfg = { ...CONFIG_PADRAO, preRollMs: 500, postRollMs: 0 };
  assert.equal(blocosDeFala([{ inicioMs: 100, fimMs: 3000 }], cfg)[0]!.inicioMs, 0);
});

test("ninguem fala: plano vazio em vez de plano inventado", () => {
  assert.deepEqual(decidir([], [], CFG), []);
});

// ------------------------------------------------------- fala por nivel

const NIVEL = { limiarDb: 12, dominanciaDb: 6 };

test("ruido de fundo ignora um mudo isolado em vez de zerar o piso", () => {
  const db = [-120, -50, -49, -51, -50, -48, -50, -49, -50, -51];
  assert.ok(ruidoDeFundo(db) > -60, `piso ficou em ${ruidoDeFundo(db)}`);
});

test("canal alto e outro no ruido: fala de quem esta alto", () => {
  const a = [-50, -20, -20, -50];
  const b = [-50, -50, -50, -50];
  const { a: fa, b: fb } = falaPorNivel(a, b, 20, NIVEL);
  assert.deepEqual(fa, [{ inicioMs: 20, fimMs: 60 }]);
  assert.deepEqual(fb, []);
});

test("vazamento nao rouba a fala: quem domina leva", () => {
  // A fala a -20; o mesmo som vaza no mic B a -35. Os dois passam do ruido.
  const a = [-60, -20, -20, -60];
  const b = [-60, -35, -35, -60];
  const { a: fa, b: fb } = falaPorNivel(a, b, 20, NIVEL);
  assert.equal(fa.length, 1);
  assert.deepEqual(fb, []);
});

test("os dois altos e empatados: janela nao vira fala de ninguem", () => {
  const a = [-60, -20, -60];
  const b = [-60, -21, -60];
  const { a: fa, b: fb } = falaPorNivel(a, b, 20, NIVEL);
  assert.deepEqual(fa, []);
  assert.deepEqual(fb, []);
});

test("janelas vizinhas do mesmo canal viram um intervalo so", () => {
  const a = [-60, -60, -20, -20, -20, -60, -60, -60, -60, -60];
  const b = Array(10).fill(-60);
  assert.deepEqual(falaPorNivel(a, b, 20, NIVEL).a, [{ inicioMs: 40, fimMs: 100 }]);
});

test("canal sem nenhum silencio nao tem ruido de fundo para comparar", () => {
  // Nao ha contraste: melhor nao detectar nada do que detectar tudo.
  const constante = Array(10).fill(-20);
  const { a, b } = falaPorNivel(constante, constante, 20, NIVEL);
  assert.deepEqual([a, b], [[], []]);
});
