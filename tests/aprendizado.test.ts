import { test } from "node:test";
import assert from "node:assert/strict";

import {
  aprender,
  chave,
  comPendente,
  fator,
  MEMORIA_VAZIA,
  parseMemoria,
  parsePendentes,
  PENDENTES_VAZIO,
  type Memoria,
  type PlanoPendente,
} from "../src/aprendizado.ts";

function pendente(...itens: Array<[string, string, string[]]>): PlanoPendente {
  return {
    quando: "2026-08-07T00:00:00.000Z",
    itens: itens.map(([arquivo, conceito, termosCasados]) => ({ arquivo, conceito, termosCasados })),
  };
}

const PLANO = pendente(
  ["Viagra (1).mp4", "Viagra", ["viagra"]],
  ["Casal feliz (3).mp4", "Casal feliz", ["casal", "feliz"]]
);

// ------------------------------------------------------------------ fator

test("fator: sem historico, nao mexe no score", () => {
  assert.equal(fator(MEMORIA_VAZIA, "Viagra", ["viagra"]), 1);
});

test("fator: par apagado vale menos, par mantido vale mais", () => {
  const um = aprender(MEMORIA_VAZIA, PLANO, new Set(["Casal feliz (3).mp4"])).memoria;
  assert.ok(fator(um, "Viagra", ["viagra"]) < 1, "apagado deveria cair");
  assert.ok(fator(um, "Casal feliz", ["casal", "feliz"]) > 1, "mantido deveria subir");
});

test("fator: nunca zera nem dobra, por mais repeticoes que haja", () => {
  let m: Memoria = MEMORIA_VAZIA;
  for (let i = 0; i < 50; i++) m = aprender(m, PLANO, new Set()).memoria;
  const f = fator(m, "Viagra", ["viagra"]);
  assert.ok(f >= 0.5 && f < 1, `fator fora do limite: ${f}`);
});

test("fator: par desconhecido dilui em vez de arrastar o conceito inteiro", () => {
  const m = aprender(MEMORIA_VAZIA, pendente(["a.mp4", "Casal feliz", ["casal"]]), new Set()).memoria;
  // "casal" apanhou, "feliz" nunca foi visto: a media fica entre os dois.
  const so = fator(m, "Casal feliz", ["casal"]);
  const media = fator(m, "Casal feliz", ["casal", "feliz"]);
  assert.ok(so < media && media < 1, `${so} < ${media} < 1`);
});

test("fator: sugestao sem termo casado nao quebra", () => {
  assert.equal(fator(MEMORIA_VAZIA, "Viagra", []), 1);
});

// --------------------------------------------------------------- aprender

test("aprender: conta sobrevivente como acerto e ausente como erro", () => {
  const r = aprender(MEMORIA_VAZIA, PLANO, new Set(["Viagra (1).mp4"]));
  assert.equal(r.acertos, 1);
  assert.equal(r.erros, 1);
  assert.deepEqual(r.memoria.pares[chave("Viagra", "viagra")], { acertos: 1, erros: 0 });
  assert.deepEqual(r.memoria.pares[chave("Casal feliz", "casal")], { acertos: 0, erros: 1 });
});

test("aprender: soma sobre o historico, nao substitui", () => {
  const um = aprender(MEMORIA_VAZIA, PLANO, new Set()).memoria;
  const dois = aprender(um, PLANO, new Set()).memoria;
  assert.equal(dois.pares[chave("Viagra", "viagra")]?.erros, 2);
});

test("aprender: nao muda a memoria recebida", () => {
  const antes = aprender(MEMORIA_VAZIA, PLANO, new Set()).memoria;
  const copia = JSON.stringify(antes);
  aprender(antes, PLANO, new Set(["Viagra (1).mp4"]));
  assert.equal(JSON.stringify(antes), copia);
});

test("aprender: faixa inteira apagada e tudo erro", () => {
  const r = aprender(MEMORIA_VAZIA, PLANO, new Set());
  assert.equal(r.acertos, 0);
  assert.equal(r.erros, 2);
});

// -------------------------------------------------------------- pendentes

test("comPendente: uma sequencia nao apaga o julgamento da outra", () => {
  const a = comPendente(PENDENTES_VAZIO, "Corte A", PLANO);
  const b = comPendente(a, "Corte B", PLANO);
  assert.ok(b.porSequencia["Corte A"]);
  const so = comPendente(b, "Corte A", null);
  assert.equal(so.porSequencia["Corte A"], undefined);
  assert.ok(so.porSequencia["Corte B"]);
});

// ------------------------------------------------------------ persistencia

test("parse: ida e volta pelo JSON preserva tudo", () => {
  const m = aprender(MEMORIA_VAZIA, PLANO, new Set(["Viagra (1).mp4"])).memoria;
  assert.deepEqual(parseMemoria(JSON.parse(JSON.stringify(m))), m);

  const p = comPendente(PENDENTES_VAZIO, "Corte A", PLANO);
  assert.deepEqual(parsePendentes(JSON.parse(JSON.stringify(p))), p);
});

test("parse: arquivo corrompido volta vazio em vez de lancar", () => {
  for (const lixo of [null, 42, "texto", {}, { pares: "nao e objeto" }]) {
    assert.deepEqual(parseMemoria(lixo), MEMORIA_VAZIA);
    assert.deepEqual(parsePendentes(lixo), PENDENTES_VAZIO);
  }
});

test("parse: descarta entrada malformada e mantem o resto", () => {
  const m = parseMemoria({
    pares: { bom: { acertos: 2, erros: 1 }, ruim: { acertos: -1, erros: 0 }, pior: { acertos: "x" } },
  });
  assert.deepEqual(m.pares, { bom: { acertos: 2, erros: 1 } });

  const p = parsePendentes({
    porSequencia: {
      boa: { quando: "hoje", itens: [{ arquivo: "a.mp4", conceito: "A", termosCasados: ["a", 7] }] },
      ruim: { itens: "nao e lista" },
    },
  });
  assert.deepEqual(p.porSequencia["boa"]?.itens, [
    { arquivo: "a.mp4", conceito: "A", termosCasados: ["a"] },
  ]);
  assert.equal(p.porSequencia["ruim"], undefined);
});
