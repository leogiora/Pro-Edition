import { test } from "node:test";
import assert from "node:assert/strict";

import {
  aprender,
  chave,
  comPendente,
  creditarManuais,
  fator,
  melhorArquivo,
  MEMORIA_VAZIA,
  parseMemoria,
  parsePendentes,
  PENDENTES_VAZIO,
  type Memoria,
  type PlanoPendente,
} from "../src/aprendizado.ts";
import { conceitosDeArquivos, type Conceito } from "../src/match.ts";
import type { Frase } from "../src/transcript.ts";

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

test("aprender: contagem nao cresce para sempre — acima do teto, decai", () => {
  let m: Memoria = MEMORIA_VAZIA;
  for (let i = 0; i < 60; i++) m = aprender(m, PLANO, new Set(["Viagra (1).mp4"])).memoria;

  const saldo = m.pares[chave("Viagra", "viagra")];
  assert.ok(saldo !== undefined);
  assert.ok(
    saldo.acertos + saldo.erros <= 20,
    `historico fossilizado: ${saldo.acertos}/${saldo.erros}`
  );
});

test("aprender: o decaimento preserva a proporcao aprendida", () => {
  // Muitos acertos e poucos erros continuam sendo muitos acertos e poucos erros.
  let m: Memoria = MEMORIA_VAZIA;
  for (let i = 0; i < 30; i++) m = aprender(m, PLANO, new Set(["Viagra (1).mp4"])).memoria;
  const saldo = m.pares[chave("Viagra", "viagra")];
  assert.ok((saldo?.acertos ?? 0) > (saldo?.erros ?? 0));
});

test("aprender: depois do decaimento, uma exclusao volta a pesar", () => {
  let m: Memoria = MEMORIA_VAZIA;
  for (let i = 0; i < 60; i++) m = aprender(m, PLANO, new Set(["Viagra (1).mp4"])).memoria;
  const antes = m.pares[chave("Viagra", "viagra")];

  const depois = aprender(m, PLANO, new Set()).memoria.pares[chave("Viagra", "viagra")];
  const pesoAntes = (antes?.acertos ?? 0) - (antes?.erros ?? 0);
  const pesoDepois = (depois?.acertos ?? 0) - (depois?.erros ?? 0);
  assert.ok(pesoDepois < pesoAntes, "com 106 contra 19 uma exclusao nao movia nada");
});

test("aprender: faixa inteira apagada e tudo erro", () => {
  const r = aprender(MEMORIA_VAZIA, PLANO, new Set());
  assert.equal(r.acertos, 0);
  assert.equal(r.erros, 2);
});

// --------------------------------------------------------- melhorArquivo

test("melhorArquivo: sem historico, mantem a ordem original", () => {
  assert.equal(melhorArquivo(MEMORIA_VAZIA, ["a.mp4", "b.mp4"]), "a.mp4");
});

test("melhorArquivo: o take apagado cede a vez ao proximo", () => {
  const m = aprender(
    MEMORIA_VAZIA,
    pendente(["a.mp4", "Casal feliz", ["casal"]]),
    new Set()
  ).memoria;
  assert.equal(melhorArquivo(m, ["a.mp4", "b.mp4"]), "b.mp4");
});

test("melhorArquivo: take aprovado continua sendo o preferido", () => {
  const m = aprender(
    MEMORIA_VAZIA,
    pendente(["b.mp4", "Casal feliz", ["casal"]]),
    new Set(["b.mp4"])
  ).memoria;
  assert.equal(melhorArquivo(m, ["a.mp4", "b.mp4"]), "b.mp4");
});

test("melhorArquivo: com todos apanhando, escolhe o menos pior em vez de desistir", () => {
  let m = aprender(MEMORIA_VAZIA, pendente(["a.mp4", "C", ["c"]]), new Set()).memoria;
  m = aprender(m, pendente(["a.mp4", "C", ["c"]]), new Set()).memoria;
  m = aprender(m, pendente(["b.mp4", "C", ["c"]]), new Set()).memoria;
  assert.equal(melhorArquivo(m, ["a.mp4", "b.mp4"]), "b.mp4");
});

test("melhorArquivo: lista vazia devolve undefined", () => {
  assert.equal(melhorArquivo(MEMORIA_VAZIA, []), undefined);
});

test("aprender: conta o arquivo alem do par conceito-palavra", () => {
  const r = aprender(MEMORIA_VAZIA, PLANO, new Set(["Viagra (1).mp4"]));
  assert.deepEqual(r.memoria.arquivos["Viagra (1).mp4"], { acertos: 1, erros: 0 });
  assert.deepEqual(r.memoria.arquivos["Casal feliz (3).mp4"], { acertos: 0, erros: 1 });
});

// ------------------------------------------------- colocacao manual

const CONCEITOS: Conceito[] = conceitosDeArquivos([
  "Viagra (1).mp4",
  "Viagra (2).mp4",
  "Vasos sanguineos (3).mp4",
]);

function frase(texto: string, inicio: number, fim: number): Frase {
  return { texto, inicio, fim, duracao: fim - inicio, palavras: 8, confiancaMinima: 1, termosNoTempo: [] };
}

const FALA = [
  frase("o viagra nao resolve isso sozinho", 10, 15),
  // O dicionario JA liga "sanguineo" a "circulacao" e "sangue": esta casa.
  frase("depende da circulacao do sangue", 20, 25),
  // Esta nao casa com conceito nenhum — e o caso que revela sinonimo faltando.
  frase("quinta feira chegou rapido demais", 30, 35),
];

test("creditarManuais: credita o par conceito-palavra do que o usuario colocou", () => {
  const r = creditarManuais(MEMORIA_VAZIA, "Reels", [{ arquivo: "Viagra (1).mp4", inicio: 11 }], FALA, CONCEITOS);
  assert.equal(r.creditados, 1);
  assert.deepEqual(r.memoria.pares[chave("Viagra", "viagra")], { acertos: 1, erros: 0 });
  // O take escolhido tambem ganha: e ele que o usuario quis ver.
  assert.deepEqual(r.memoria.arquivos["Viagra (1).mp4"], { acertos: 1, erros: 0 });
  assert.deepEqual(r.semLigacao, []);
});

test("creditarManuais: o credito muda o plano seguinte", () => {
  const antes = fator(MEMORIA_VAZIA, "Viagra", ["viagra"]);
  const r = creditarManuais(MEMORIA_VAZIA, "Reels", [{ arquivo: "Viagra (1).mp4", inicio: 11 }], FALA, CONCEITOS);
  assert.ok(fator(r.memoria, "Viagra", ["viagra"]) > antes, "creditar tem de valer alguma coisa");
});

test("creditarManuais: a mesma colocacao nao e creditada duas vezes", () => {
  const manuais = [{ arquivo: "Viagra (1).mp4", inicio: 11 }];
  const uma = creditarManuais(MEMORIA_VAZIA, "Reels", manuais, FALA, CONCEITOS);
  // Segunda analise: o B-roll continua na timeline, mas ja foi contado.
  const outra = creditarManuais(uma.memoria, "Reels", manuais, FALA, CONCEITOS);
  assert.equal(outra.creditados, 0);
  assert.deepEqual(outra.memoria.pares[chave("Viagra", "viagra")], { acertos: 1, erros: 0 });
});

test("creditarManuais: a mesma sequencia e outra nao se confundem", () => {
  const manuais = [{ arquivo: "Viagra (1).mp4", inicio: 11 }];
  const uma = creditarManuais(MEMORIA_VAZIA, "Reels", manuais, FALA, CONCEITOS);
  assert.equal(creditarManuais(uma.memoria, "Outro corte", manuais, FALA, CONCEITOS).creditados, 1);
});

test("creditarManuais: sinonimo do dicionario conta como ligacao", () => {
  // A fala diz "circulacao"/"sangue", o arquivo se chama "Vasos sanguineos".
  const r = creditarManuais(
    MEMORIA_VAZIA,
    "Reels",
    [{ arquivo: "Vasos sanguineos (3).mp4", inicio: 21 }],
    FALA,
    CONCEITOS
  );
  assert.equal(r.creditados, 1);
  assert.deepEqual(r.semLigacao, []);
});

test("creditarManuais: escolha que nenhum termo explica vira sugestao, nao contagem", () => {
  const r = creditarManuais(
    MEMORIA_VAZIA,
    "Reels",
    [{ arquivo: "Vasos sanguineos (3).mp4", inicio: 31 }],
    FALA,
    CONCEITOS
  );
  assert.equal(r.creditados, 0);
  assert.equal(r.semLigacao.length, 1);
  assert.match(r.semLigacao[0] ?? "", /Vasos sanguineos/);
  assert.match(r.semLigacao[0] ?? "", /sinonimo/);
  assert.deepEqual(r.memoria.pares, {}, "sem ligacao nao ha o que contar");
});

test("creditarManuais: sugestao sem ligacao reaparece ate alguem resolver", () => {
  const manuais = [{ arquivo: "Vasos sanguineos (3).mp4", inicio: 31 }];
  const uma = creditarManuais(MEMORIA_VAZIA, "Reels", manuais, FALA, CONCEITOS);
  assert.equal(creditarManuais(uma.memoria, "Reels", manuais, FALA, CONCEITOS).semLigacao.length, 1);
});

test("creditarManuais: B-roll sobre silencio nao ensina nada", () => {
  const r = creditarManuais(MEMORIA_VAZIA, "Reels", [{ arquivo: "Viagra (1).mp4", inicio: 50 }], FALA, CONCEITOS);
  assert.equal(r.creditados, 0);
  assert.deepEqual(r.semLigacao, []);
});

test("creditarManuais: o corte entra um pouco antes da palavra e ainda acha a frase", () => {
  // 9,7s: o B-roll comeca antes da frase que o justifica, como o planejador faz.
  const r = creditarManuais(MEMORIA_VAZIA, "Reels", [{ arquivo: "Viagra (1).mp4", inicio: 9.7 }], FALA, CONCEITOS);
  assert.equal(r.creditados, 1);
});

test("creditarManuais: arquivo de fora da biblioteca e ignorado", () => {
  const r = creditarManuais(MEMORIA_VAZIA, "Reels", [{ arquivo: "gato.mp4", inicio: 11 }], FALA, CONCEITOS);
  assert.equal(r.creditados, 0);
  assert.deepEqual(r.semLigacao, []);
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

test("parse: aprendizado.json antigo sobrevive a atualizacao", () => {
  // Arquivo real do schema 1, gravado antes da contagem por arquivo existir.
  const antigo = { schema: 1, pares: { "Viagra|viagra": { acertos: 1, erros: 0 } } };
  const m = parseMemoria(antigo);
  assert.equal(m.schema, 3);
  assert.deepEqual(m.pares["Viagra|viagra"], { acertos: 1, erros: 0 }, "o historico nao pode sumir");
  assert.deepEqual(m.arquivos, {});
  assert.deepEqual(m.vistos, {});
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
