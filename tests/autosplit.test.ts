import assert from "node:assert/strict";
import { test } from "node:test";
import {
  aprenderEnquadramento,
  calcularEnquadramento,
  conceito,
  fracaoDivisao,
  nudgeDoutorPosY,
  resolverPerfil,
  type EntradaGeom,
  type Perfil,
} from "../src/autosplit.ts";

test("conceito tira o sufixo (n) e a extensao", () => {
  assert.equal(conceito("Consulta médica (1).mp4"), "Consulta médica");
  assert.equal(conceito("Academia.mp4"), "Academia");
  assert.equal(conceito("14.000 mil homens (7).mp4"), "14.000 mil homens");
});

const PERFIL: Perfil = {
  versao: 1,
  padraoPorConceito: {
    "Consulta médica": { assunto: "dupla", ancoraY: 0.3, cropTopoExtra: 0 },
  },
  porArquivo: {
    "Consulta médica (1).mp4": { assunto: "pessoa", ancoraY: 0.28, cropTopoExtra: 0.02, w: 720, h: 1280 },
  },
};

test("resolverPerfil: override vence tudo", () => {
  const r = resolverPerfil(
    PERFIL,
    { "Consulta médica (1).mp4": { ancoraY: 0.4, cropTopoExtra: 0.1 } },
    "Consulta médica (1).mp4",
    "retrato",
  );
  assert.equal(r.origem, "override");
  assert.equal(r.ancoraY, 0.4);
  assert.equal(r.cropTopoExtra, 0.1);
  assert.equal(r.assunto, "pessoa"); // assunto continua vindo do perfil por arquivo
});

test("resolverPerfil: cai no perfil por arquivo", () => {
  const r = resolverPerfil(PERFIL, {}, "Consulta médica (1).mp4", "retrato");
  assert.equal(r.origem, "arquivo");
  assert.equal(r.ancoraY, 0.28);
});

test("resolverPerfil: cai no padrao por conceito", () => {
  const r = resolverPerfil(PERFIL, {}, "Consulta médica (5).mp4", "retrato");
  assert.equal(r.origem, "conceito");
  assert.equal(r.assunto, "dupla");
  assert.equal(r.ancoraY, 0.3);
});

test("resolverPerfil: default por orientacao quando nao ha nada", () => {
  const retrato = resolverPerfil(PERFIL, {}, "Coisa nova (2).mp4", "retrato");
  assert.equal(retrato.origem, "default");
  assert.equal(retrato.assunto, "pessoa");
  assert.equal(retrato.ancoraY, 0.35);

  const paisagem = resolverPerfil(PERFIL, {}, "Coisa nova (2).mp4", "paisagem");
  assert.equal(paisagem.ancoraY, 0.45);
});

// ----------------------------------------------------------- geometria

const BASE: EntradaGeom = {
  W: 1080, H: 1920, brollTopoFrac: 0.5,
  w: 720, h: 1280, ancoraY: 0.30, assunto: "pessoa", cropTopoExtra: 0,
};

test("fracaoDivisao parseia e clampa", () => {
  assert.equal(fracaoDivisao(50), 0.5);
  assert.equal(fracaoDivisao(30), 0.4);
  assert.equal(fracaoDivisao(70), 0.6);
});

test("geometria: retrato, ancora media — cobre a caixa e nao passa dela", () => {
  const r = calcularEnquadramento(BASE);
  // corte de topo = ancoraY - folga(pessoa .12) + 0 = 0.18
  assert.ok(Math.abs(r.cropTopoPct - 18) < 0.01);
  // escala cobre a caixa: max(1080/720, 960/(1280*0.82)) * 1.03, em %
  const esperado = Math.max(1080 / 720, 960 / (1280 * 0.82)) * 1.03 * 100;
  assert.ok(Math.abs(r.escalaPct - esperado) < 0.5);
  assert.equal(r.posX, 540);
  // o topo da parte visivel nao pode ficar abaixo de yBox (960): sem tarja
  const s = r.escalaPct / 100;
  const topoVis = r.posY + (r.cropTopoPct / 100 - 0.5) * 1280 * s;
  assert.ok(topoVis <= 960 + 0.5);
  // o fundo tem de chegar em H
  const fundo = r.posY + 0.5 * 1280 * s;
  assert.ok(fundo >= 1920 - 0.5);
});

test("geometria: ancora baixa nao corta nada do topo", () => {
  const r = calcularEnquadramento({ ...BASE, ancoraY: 0.08 });
  assert.equal(r.cropTopoPct, 0);
});

test("geometria: cropTopoExtra soma no Top", () => {
  const r = calcularEnquadramento({ ...BASE, cropTopoExtra: 0.05 });
  assert.ok(Math.abs(r.cropTopoPct - 23) < 0.01);
});

test("geometria: crop de topo nunca passa de CROP_TOPO_MAX", () => {
  const r = calcularEnquadramento({ ...BASE, ancoraY: 0.9, assunto: "aberto", cropTopoExtra: 0.3 });
  assert.ok(r.cropTopoPct <= 60.0001);
});

test("geometria: paisagem (16:9) tambem cobre a caixa", () => {
  const r = calcularEnquadramento({ ...BASE, w: 1920, h: 1080, ancoraY: 0.45, assunto: "aberto" });
  const s = r.escalaPct / 100;
  assert.ok(1920 * s >= 1080 - 0.5);              // largura da fonte escalada cobre W
  const ct = r.cropTopoPct / 100;
  assert.ok(1080 * (1 - ct) * s >= 960 - 0.5);    // altura visivel escalada cobre a caixa
});

// -------------------------------------------- doutor e back-solve do aprender

test("nudgeDoutorPosY sobe o clipe mas mantem o topo coberto", () => {
  // doutor vertical preenchendo a tela: hDoc*sDoc = 1920, meia altura 960
  const y = nudgeDoutorPosY({ H: 1920, hDoc: 1280, escalaDocPct: 150 });
  assert.ok(y < 960);            // subiu
  assert.ok(y <= 960 + 0.001);   // nao passou de meia-altura-da-midia (sem tarja no topo)
});

test("nudgeDoutorPosY: origem pequena limita a subida", () => {
  // hDoc*sDoc = 1000, meia altura 500 -> nao pode subir alem de 500
  const y = nudgeDoutorPosY({ H: 1920, hDoc: 1000, escalaDocPct: 100 });
  assert.ok(y <= 500 + 0.001);
});

test("aprender: usuario nao mexeu -> mudou:false", () => {
  const usado = calcularEnquadramento(BASE);
  const r = aprenderEnquadramento({
    guardado: { assunto: "pessoa", ancoraY: 0.30, cropTopoExtra: 0 },
    geomUsada: BASE, usado,
    finalPosY: usado.posY, finalEscalaPct: usado.escalaPct, finalCropTopoPct: usado.cropTopoPct,
  });
  assert.equal(r.mudou, false);
  assert.equal(r.ancoraY, 0.30);
});

test("aprender: usuario aumentou o Top -> cropTopoExtra sobe (limitado ao passo)", () => {
  const usado = calcularEnquadramento(BASE);
  const r = aprenderEnquadramento({
    guardado: { assunto: "pessoa", ancoraY: 0.30, cropTopoExtra: 0 },
    geomUsada: BASE, usado,
    finalPosY: usado.posY, finalEscalaPct: usado.escalaPct,
    finalCropTopoPct: usado.cropTopoPct + 40, // empurrao grande
  });
  assert.equal(r.mudou, true);
  assert.ok(r.cropTopoExtra > 0);
  assert.ok(r.cropTopoExtra <= 0.30 + 1e-9); // nunca mais que um passo
});

test("aprender: usuario arrastou o clipe pra baixo -> ancora do arquivo estava mais alta", () => {
  // posY maior = clipe mais baixo. Se o usuario precisou baixar, o assunto real
  // estava mais ALTO no quadro de origem do que o perfil supunha (ancoraY menor).
  const usado = calcularEnquadramento(BASE);
  const r = aprenderEnquadramento({
    guardado: { assunto: "pessoa", ancoraY: 0.30, cropTopoExtra: 0 },
    geomUsada: BASE, usado,
    finalPosY: usado.posY + 200,
    finalEscalaPct: usado.escalaPct, finalCropTopoPct: usado.cropTopoPct,
  });
  assert.equal(r.mudou, true);
  assert.ok(r.ancoraY < 0.30);
});

test("aprender: usuario arrastou o clipe pra cima -> ancora do arquivo estava mais baixa", () => {
  const usado = calcularEnquadramento(BASE);
  const r = aprenderEnquadramento({
    guardado: { assunto: "pessoa", ancoraY: 0.30, cropTopoExtra: 0 },
    geomUsada: BASE, usado,
    finalPosY: usado.posY - 200,
    finalEscalaPct: usado.escalaPct, finalCropTopoPct: usado.cropTopoPct,
  });
  assert.equal(r.mudou, true);
  assert.ok(r.ancoraY > 0.30);
});
