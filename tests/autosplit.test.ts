import assert from "node:assert/strict";
import { test } from "node:test";
import { conceito, resolverPerfil, type Perfil } from "../src/autosplit.ts";

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
