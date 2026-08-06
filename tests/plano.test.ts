import { test } from "node:test";
import assert from "node:assert/strict";

import { planejar, REGRAS_PADRAO, type Biblioteca } from "../src/plano.ts";
import type { Oportunidade } from "../src/analise.ts";
import type { Conceito } from "../src/match.ts";

function conceito(rotulo: string, arquivos: string[]): Conceito {
  return { rotulo, arquivos, termos: rotulo.toLowerCase().split(" ") };
}

function oportunidade(
  inicio: number,
  duracao: number,
  sugestoes: Array<{ c: Conceito; score: number }>,
  termosNoTempo: Array<{ termo: string; inicio: number }> = []
): Oportunidade {
  return {
    frase: {
      texto: "frase",
      inicio,
      fim: inicio + duracao,
      duracao,
      palavras: 8,
      confiancaMinima: 1,
      termosNoTempo,
    },
    sugestoes: sugestoes.map((s) => ({
      conceito: s.c,
      score: s.score,
      motivo: `casou ${s.c.rotulo}`,
      termosCasados: s.c.termos,
    })),
  };
}

const FRUSTRADO = conceito("Frustrado", ["Frustrado (1).mp4", "Frustrado (2).mp4"]);
const VIAGRA = conceito("Viagra", ["Viagra (1).mp4"]);

const BIBLIOTECA: Biblioteca = {
  caminhos: new Map([
    ["Frustrado (1).mp4", "C:\\b\\Frustrado (1).mp4"],
    ["Frustrado (2).mp4", "C:\\b\\Frustrado (2).mp4"],
    ["Viagra (1).mp4", "C:\\b\\Viagra (1).mp4"],
  ]),
};

test("planejar: escolhe a melhor sugestao e resolve o caminho", () => {
  const p = planejar([oportunidade(10, 3, [{ c: FRUSTRADO, score: 1 }])], BIBLIOTECA);
  assert.equal(p.colocacoes.length, 1);
  assert.equal(p.colocacoes[0]?.arquivo, "Frustrado (1).mp4");
  assert.equal(p.colocacoes[0]?.caminho, "C:\\b\\Frustrado (1).mp4");
  assert.equal(p.colocacoes[0]?.inicio, 10);
});

test("planejar: duracao fica presa entre 1,5 e 4 segundos", () => {
  const curta = planejar([oportunidade(10, 2, [{ c: FRUSTRADO, score: 1 }])], BIBLIOTECA);
  assert.equal(curta.colocacoes[0]?.duracao, 2);

  // Frase de 30s nao vira B-roll de 30s.
  const longa = planejar([oportunidade(10, 30, [{ c: FRUSTRADO, score: 1 }])], BIBLIOTECA);
  assert.equal(longa.colocacoes[0]?.duracao, REGRAS_PADRAO.duracaoMaxima);
});

test("planejar: score baixo nao entra sozinho na timeline", () => {
  const p = planejar([oportunidade(10, 3, [{ c: FRUSTRADO, score: 0.5 }])], BIBLIOTECA);
  assert.equal(p.colocacoes.length, 0);
  assert.match(p.descartes.join(" "), /nenhuma sugestao passou.*50%/);
});

test("planejar: nao repete o mesmo arquivo", () => {
  // Duas oportunidades bem separadas, mesmo conceito: pega variacoes diferentes.
  const p = planejar(
    [
      oportunidade(10, 3, [{ c: FRUSTRADO, score: 1 }]),
      oportunidade(60, 3, [{ c: FRUSTRADO, score: 1 }]),
    ],
    BIBLIOTECA
  );
  assert.equal(p.colocacoes.length, 2);
  assert.notEqual(p.colocacoes[0]?.arquivo, p.colocacoes[1]?.arquivo);
});

test("planejar: sem variacao sobrando, descarta em vez de repetir", () => {
  const p = planejar(
    [
      oportunidade(10, 3, [{ c: VIAGRA, score: 1 }]),
      oportunidade(60, 3, [{ c: VIAGRA, score: 1 }]),
    ],
    BIBLIOTECA
  );
  assert.equal(p.colocacoes.length, 1);
});

test("planejar: nao repete o mesmo conceito dentro da janela", () => {
  // 5s de distancia, janela e 20s: a segunda cai fora.
  const p = planejar(
    [
      oportunidade(10, 2, [{ c: FRUSTRADO, score: 1 }]),
      oportunidade(15, 2, [{ c: FRUSTRADO, score: 1 }]),
    ],
    BIBLIOTECA
  );
  assert.equal(p.colocacoes.length, 1);
});

test("planejar: respeita o intervalo minimo entre B-rolls", () => {
  const p = planejar(
    [
      oportunidade(10, 4, [{ c: FRUSTRADO, score: 1 }]),
      // Comeca em 14, mas o anterior termina em 14 e o intervalo e 2s.
      oportunidade(14, 3, [{ c: VIAGRA, score: 1 }]),
    ],
    BIBLIOTECA
  );
  assert.equal(p.colocacoes.length, 1);
  assert.match(p.descartes.join(" "), /muito perto/);
});

test("planejar: frase curta demais nao recebe B-roll", () => {
  const p = planejar([oportunidade(10, 0.8, [{ c: FRUSTRADO, score: 1 }])], BIBLIOTECA);
  assert.equal(p.colocacoes.length, 0);
  assert.match(p.descartes.join(" "), /curta demais/);
});

test("planejar: arquivo fora da biblioteca e ignorado", () => {
  const fantasma = conceito("Fantasma", ["nao existe.mp4"]);
  const p = planejar([oportunidade(10, 3, [{ c: fantasma, score: 1 }])], BIBLIOTECA);
  assert.equal(p.colocacoes.length, 0);
});

test("planejar: cai para a segunda sugestao quando a primeira nao serve", () => {
  const p = planejar(
    [oportunidade(10, 3, [{ c: VIAGRA, score: 0.4 }, { c: FRUSTRADO, score: 0.9 }])],
    BIBLIOTECA
  );
  assert.equal(p.colocacoes[0]?.conceito, "Frustrado");
});

test("planejar: toda colocacao carrega o motivo", () => {
  const p = planejar([oportunidade(10, 3, [{ c: FRUSTRADO, score: 1 }])], BIBLIOTECA);
  assert.match(p.colocacoes[0]?.motivo ?? "", /Frustrado/);
});

test("planejar: sem oportunidades, plano vazio e nao erro", () => {
  assert.deepEqual(planejar([], BIBLIOTECA).colocacoes, []);
});

// --------------------- ancoragem na palavra que casou -----------------------

test("planejar: ancora o corte na palavra que casou, nao no inicio da frase", () => {
  // Frase comeca em 10s, mas "frustrado" so e dito em 16s.
  const o = oportunidade(10, 8, [{ c: FRUSTRADO, score: 1 }], [
    { termo: "problema", inicio: 10 },
    { termo: "frustrado", inicio: 16 },
  ]);
  const p = planejar([o], BIBLIOTECA);
  // 16 menos a antecipacao de 0,3s.
  assert.ok(Math.abs((p.colocacoes[0]?.inicio ?? 0) - 15.7) < 0.01);
});

test("planejar: a antecipacao nunca joga o corte antes da frase", () => {
  const o = oportunidade(10, 5, [{ c: FRUSTRADO, score: 1 }], [{ termo: "frustrado", inicio: 10 }]);
  assert.equal(planejar([o], BIBLIOTECA).colocacoes[0]?.inicio, 10);
});

test("planejar: sem termo no tempo, cai no inicio da frase", () => {
  const p = planejar([oportunidade(10, 5, [{ c: FRUSTRADO, score: 1 }])], BIBLIOTECA);
  assert.equal(p.colocacoes[0]?.inicio, 10);
});

test("planejar: B-roll nao passa do fim da frase", () => {
  // A palavra casa perto do fim: sobra menos que a duracao maxima.
  const o = oportunidade(10, 6, [{ c: FRUSTRADO, score: 1 }], [{ termo: "frustrado", inicio: 14 }]);
  const c = p0(planejar([o], BIBLIOTECA).colocacoes);
  assert.ok(c.inicio + c.duracao <= 16.01, `${c.inicio}+${c.duracao} passou de 16`);
});

function p0<T>(lista: readonly T[]): T {
  const primeiro = lista[0];
  if (primeiro === undefined) throw new Error("plano vazio");
  return primeiro;
}
