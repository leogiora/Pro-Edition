import { test } from "node:test";
import assert from "node:assert/strict";

import {
  parseCanonico,
  mesclarSaldos,
  mesclarContagens,
  mesclarSinonimos,
  aplicarMerge,
  type CanonicoSnapshot,
  type EstadoAprendido,
} from "../src/mesclar-canonico.ts";
import { MEMORIA_VAZIA, ASSOCIACOES_VAZIAS } from "../src/aprendizado.ts";

// ---------------------------------------------------------- mesclarSaldos

test("mesclarSaldos: baseline ausente soma local inteiro sobre o canonico", () => {
  const r = mesclarSaldos({ "a|a": { acertos: 12, erros: 2 } }, { "a|a": { acertos: 4, erros: 0 } }, {});
  assert.deepEqual(r["a|a"], { acertos: 16, erros: 2 });
});

test("mesclarSaldos: com baseline soma so o que a editora evoluiu", () => {
  const r = mesclarSaldos(
    { "a|a": { acertos: 15, erros: 2 } }, // canonico atual
    { "a|a": { acertos: 16, erros: 3 } }, // local
    { "a|a": { acertos: 12, erros: 2 } }  // baseline
  );
  // delta travado em 0: 15 + (16-12), 2 + (3-2) = 19, 3 -> soma 22 passa do
  // TETO 20, entao aplicarTeto divide os dois lados: round(19/2), round(3/2) = 10, 2
  assert.deepEqual(r["a|a"], { acertos: 10, erros: 2 });
});

test("mesclarSaldos: chave so no canonico entra como esta", () => {
  const r = mesclarSaldos({ "x|x": { acertos: 5, erros: 1 } }, {}, {});
  assert.deepEqual(r["x|x"], { acertos: 5, erros: 1 });
});

test("mesclarSaldos: chave so no local e preservada", () => {
  const r = mesclarSaldos({}, { "y|y": { acertos: 3, erros: 0 } }, {});
  assert.deepEqual(r["y|y"], { acertos: 3, erros: 0 });
});

test("mesclarSaldos: delta negativo nao subtrai (trava em 0)", () => {
  const r = mesclarSaldos(
    { "a|a": { acertos: 10, erros: 0 } },
    { "a|a": { acertos: 2, erros: 0 } },  // local < baseline (decaimento do teto)
    { "a|a": { acertos: 8, erros: 0 } }
  );
  assert.deepEqual(r["a|a"], { acertos: 10, erros: 0 });
});

test("mesclarSaldos: soma que passa do teto decai", () => {
  const r = mesclarSaldos(
    { "a|a": { acertos: 18, erros: 2 } },
    { "a|a": { acertos: 18, erros: 2 } },
    {}
  );
  // 18+18, 2+2 = 36,4 -> 18,2
  assert.deepEqual(r["a|a"], { acertos: 18, erros: 2 });
});

// ------------------------------------------------------- mesclarContagens

test("mesclarContagens: soma delta positivo, ignora negativo", () => {
  const r = mesclarContagens({ "a|a": 5, "b|b": 1 }, { "a|a": 7, "b|b": 0, "c|c": 2 }, { "a|a": 4 });
  assert.equal(r["a|a"], 5 + (7 - 4)); // 8
  assert.equal(r["b|b"], 1);           // local 0 < base 0 -> delta 0
  assert.equal(r["c|c"], 2);           // so no local
});

// -------------------------------------------------------- mesclarSinonimos

test("mesclarSinonimos: uniao, canonico vence no conflito de chave", () => {
  const canonico = new Map([["jovem", ["novo", "rapaz"]]]);
  const local = new Map([["jovem", ["adolescente"]], ["idoso", ["velho"]]]);
  const r = mesclarSinonimos(canonico, local);
  assert.deepEqual(r.get("jovem"), ["novo", "rapaz"]);
  assert.deepEqual(r.get("idoso"), ["velho"]);
});

// ------------------------------------------------------------ parseCanonico

test("parseCanonico: aceita snapshot valido", () => {
  const raw = {
    schema: 1,
    version: "0.2.0",
    aprendizado: { pares: { "a|a": { acertos: 3, erros: 1 } }, arquivos: {} },
    ligacoes: { pares: { "b|b": 4 } },
    sinonimos: { jovem: ["novo"] },
  };
  const c = parseCanonico(raw);
  assert.ok(c);
  assert.equal(c.version, "0.2.0");
  assert.deepEqual(c.aprendizado.pares["a|a"], { acertos: 3, erros: 1 });
  assert.equal(c.ligacoes.pares["b|b"], 4);
  assert.deepEqual(c.sinonimos.get("jovem"), ["novo"]);
});

test("parseCanonico: sem version devolve null", () => {
  assert.equal(parseCanonico({ schema: 1, aprendizado: {}, ligacoes: {}, sinonimos: {} }), null);
});

test("parseCanonico: lixo devolve null", () => {
  assert.equal(parseCanonico("nao"), null);
  assert.equal(parseCanonico(null), null);
});

// -------------------------------------------------------------- aplicarMerge

function estado(): EstadoAprendido {
  return {
    memoria: {
      schema: 3,
      pares: { "Viagra|viagra": { acertos: 16, erros: 3 } },
      arquivos: {},
      vistos: { "assoc|Seq da editora|X.mp4|0": true },
    },
    associacoes: { schema: 1, pares: { "Doutor|causa": 2 } },
    sinonimos: new Map([["idoso", ["velho"]]]),
  };
}

function snap(version: string): CanonicoSnapshot {
  return {
    schema: 1,
    version,
    aprendizado: { pares: { "Viagra|viagra": { acertos: 15, erros: 2 } }, arquivos: {} },
    ligacoes: { pares: { "Doutor|causa": 5 } },
    sinonimos: new Map([["jovem", ["novo"]]]),
  };
}

test("aplicarMerge: vistos da editora sai intacto", () => {
  const r = aplicarMerge(estado(), snap("0.2.0"), null);
  assert.deepEqual(r.memoria.vistos, { "assoc|Seq da editora|X.mp4|0": true });
});

test("aplicarMerge: sem baseline soma local inteiro", () => {
  const r = aplicarMerge(estado(), snap("0.2.0"), null);
  // 15 + 16, 2 + 3 = 31,5 -> teto -> 16,3  (31+5=36>20 -> 16,3 ; 16+3=19 ok)
  assert.deepEqual(r.memoria.pares["Viagra|viagra"], { acertos: 16, erros: 3 });
});

test("aplicarMerge: com baseline nao conta em dobro", () => {
  const base: CanonicoSnapshot = {
    schema: 1,
    version: "0.1.0",
    aprendizado: { pares: { "Viagra|viagra": { acertos: 14, erros: 2 } }, arquivos: {} },
    ligacoes: { pares: { "Doutor|causa": 3 } },
    sinonimos: new Map(),
  };
  const r = aplicarMerge(estado(), snap("0.2.0"), base);
  // pares: 15 + max(0, 16-14), 2 + max(0, 3-2) = 17, 3
  assert.deepEqual(r.memoria.pares["Viagra|viagra"], { acertos: 17, erros: 3 });
  // ligacoes: 5 + max(0, 2-3) = 5
  assert.equal(r.associacoes.pares["Doutor|causa"], 5);
});

test("aplicarMerge: sinonimos vira uniao com canonico ganhando", () => {
  const r = aplicarMerge(estado(), snap("0.2.0"), null);
  assert.deepEqual(r.sinonimos.get("jovem"), ["novo"]);
  assert.deepEqual(r.sinonimos.get("idoso"), ["velho"]);
});
