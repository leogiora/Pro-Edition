import { test } from "node:test";
import assert from "node:assert/strict";

import {
  algumNoLugar,
  aprender,
  ASSOCIACOES_VAZIAS,
  chave,
  comPendente,
  creditarManuais,
  foiOPlugin,
  ligacoesFirmes,
  parseAssociacoes,
  type Associacoes,
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
  const r = creditarManuais(MEMORIA_VAZIA, "Reels", [{ arquivo: "Viagra (1).mp4", inicio: 11, fim: 14 }], FALA, CONCEITOS);
  assert.equal(r.creditados, 1);
  assert.deepEqual(r.memoria.pares[chave("Viagra", "viagra")], { acertos: 1, erros: 0 });
  // O take escolhido tambem ganha: e ele que o usuario quis ver.
  assert.deepEqual(r.memoria.arquivos["Viagra (1).mp4"], { acertos: 1, erros: 0 });
  assert.deepEqual(r.semLigacao, []);
});

test("creditarManuais: o credito muda o plano seguinte", () => {
  const antes = fator(MEMORIA_VAZIA, "Viagra", ["viagra"]);
  const r = creditarManuais(MEMORIA_VAZIA, "Reels", [{ arquivo: "Viagra (1).mp4", inicio: 11, fim: 14 }], FALA, CONCEITOS);
  assert.ok(fator(r.memoria, "Viagra", ["viagra"]) > antes, "creditar tem de valer alguma coisa");
});

test("creditarManuais: a mesma colocacao nao e creditada duas vezes", () => {
  const manuais = [{ arquivo: "Viagra (1).mp4", inicio: 11, fim: 14 }];
  const uma = creditarManuais(MEMORIA_VAZIA, "Reels", manuais, FALA, CONCEITOS);
  // Segunda analise: o B-roll continua na timeline, mas ja foi contado.
  const outra = creditarManuais(uma.memoria, "Reels", manuais, FALA, CONCEITOS);
  assert.equal(outra.creditados, 0);
  assert.deepEqual(outra.memoria.pares[chave("Viagra", "viagra")], { acertos: 1, erros: 0 });
});

test("creditarManuais: a mesma sequencia e outra nao se confundem", () => {
  const manuais = [{ arquivo: "Viagra (1).mp4", inicio: 11, fim: 14 }];
  const uma = creditarManuais(MEMORIA_VAZIA, "Reels", manuais, FALA, CONCEITOS);
  assert.equal(creditarManuais(uma.memoria, "Outro corte", manuais, FALA, CONCEITOS).creditados, 1);
});

test("creditarManuais: sinonimo do dicionario conta como ligacao", () => {
  // A fala diz "circulacao"/"sangue", o arquivo se chama "Vasos sanguineos".
  const r = creditarManuais(
    MEMORIA_VAZIA,
    "Reels",
    [{ arquivo: "Vasos sanguineos (3).mp4", inicio: 21, fim: 24 }],
    FALA,
    CONCEITOS
  );
  assert.equal(r.creditados, 1);
  assert.deepEqual(r.semLigacao, []);
});

test("creditarManuais: escolha que nenhum termo explica credita o take, nao o par", () => {
  const r = creditarManuais(
    MEMORIA_VAZIA,
    "Reels",
    [{ arquivo: "Vasos sanguineos (3).mp4", inicio: 31, fim: 34 }],
    FALA,
    CONCEITOS
  );
  assert.equal(r.creditados, 0);
  assert.equal(r.semLigacao.length, 1);
  assert.match(r.semLigacao[0] ?? "", /Vasos sanguineos/);
  assert.deepEqual(r.memoria.pares, {}, "par sem termo seria ligacao inventada (D-016)");
  // Mas o take vale: se o usuario colocou, fez sentido.
  assert.deepEqual(r.memoria.arquivos["Vasos sanguineos (3).mp4"], { acertos: 1, erros: 0 });
});

test("creditarManuais: o credito do take sem ligacao nao se repete a cada Aprender", () => {
  const manuais = [{ arquivo: "Vasos sanguineos (3).mp4", inicio: 31, fim: 34 }];
  const uma = creditarManuais(MEMORIA_VAZIA, "Reels", manuais, FALA, CONCEITOS);
  const outra = creditarManuais(uma.memoria, "Reels", manuais, FALA, CONCEITOS);
  assert.deepEqual(outra.memoria.arquivos["Vasos sanguineos (3).mp4"], { acertos: 1, erros: 0 });
});

// -------------------------- ligacoes aprendidas ------------------------------

/**
 * Uma metafora: o dicionario nao liga "mangueira dobrada" a "Vasos sanguineos",
 * e nenhum dicionario ligaria. So o usuario sabe, e so colocando ele ensina.
 */
const FALA_COM_TEMPO: Frase[] = [
  {
    texto: "a mangueira do jardim estava dobrada ontem",
    inicio: 10,
    fim: 17,
    duracao: 7,
    palavras: 7,
    confiancaMinima: 1,
    termosNoTempo: [
      { termo: "mangueira", inicio: 10.4 },
      { termo: "jardim", inicio: 11.2 },
      { termo: "dobrada", inicio: 15.8 },
      { termo: "ontem", inicio: 16.5 },
    ],
  },
];

/** O usuario poe "Vasos sanguineos" cobrindo "mangueira ... jardim". */
function colocouVasos(assoc = ASSOCIACOES_VAZIAS): Associacoes {
  return creditarManuais(
    MEMORIA_VAZIA,
    "Reels",
    [{ arquivo: "Vasos sanguineos (3).mp4", inicio: 10.2, fim: 13 }],
    FALA_COM_TEMPO,
    CONCEITOS,
    assoc
  ).associacoes;
}

test("associacoes: conta so as palavras que o B-roll cobriu, nao a frase toda", () => {
  const a = colocouVasos();
  assert.equal(a.pares[chave("Vasos sanguineos", "mangueira")], 1);
  assert.equal(a.pares[chave("Vasos sanguineos", "jardim")], 1);
  // "dobrada" e "ontem" sao ditas depois que a imagem ja saiu.
  assert.equal(a.pares[chave("Vasos sanguineos", "dobrada")], undefined);
  assert.equal(a.pares[chave("Vasos sanguineos", "ontem")], undefined);
});

test("ligacoesFirmes: uma vez nao vira ligacao — tres viram", () => {
  let a = colocouVasos();
  assert.equal(ligacoesFirmes(a).size, 0, "uma colocacao nao prova nada");
  a = colocouVasos(a);
  assert.equal(ligacoesFirmes(a).size, 0);
  a = colocouVasos(a);

  const firmes = ligacoesFirmes(a);
  assert.deepEqual(firmes.get("Vasos sanguineos")?.sort(), ["jardim", "mangueira"]);
});

test("associacoes: a MESMA colocacao vista tres vezes nao firma ligacao", () => {
  // D-022 pede colocacoes DIFERENTES. Tres cliques em Aprender com o mesmo
  // B-roll parado na timeline nao podem valer por tres colocacoes.
  const manuais = [{ arquivo: "Vasos sanguineos (3).mp4", inicio: 10.2, fim: 13 }];
  let memoria = MEMORIA_VAZIA;
  let a = ASSOCIACOES_VAZIAS;
  for (let i = 0; i < 3; i++) {
    const r = creditarManuais(memoria, "Reels", manuais, FALA_COM_TEMPO, CONCEITOS, a);
    memoria = r.memoria;
    a = r.associacoes;
  }
  assert.equal(a.pares[chave("Vasos sanguineos", "mangueira")], 1);
  assert.equal(ligacoesFirmes(a).size, 0);
});

test("parseAssociacoes: ida e volta, e lixo volta vazio", () => {
  const a = colocouVasos();
  assert.deepEqual(parseAssociacoes(JSON.parse(JSON.stringify(a))), a);
  for (const lixo of [null, 7, "x", {}, { pares: 1 }]) {
    assert.deepEqual(parseAssociacoes(lixo), ASSOCIACOES_VAZIAS);
  }
});

test("creditarManuais: sugestao sem ligacao reaparece ate alguem resolver", () => {
  const manuais = [{ arquivo: "Vasos sanguineos (3).mp4", inicio: 31, fim: 34 }];
  const uma = creditarManuais(MEMORIA_VAZIA, "Reels", manuais, FALA, CONCEITOS);
  assert.equal(creditarManuais(uma.memoria, "Reels", manuais, FALA, CONCEITOS).semLigacao.length, 1);
});

test("creditarManuais: B-roll sobre silencio nao ensina nada", () => {
  const r = creditarManuais(
    MEMORIA_VAZIA,
    "Reels",
    [{ arquivo: "Viagra (1).mp4", inicio: 50, fim: 53 }],
    FALA,
    CONCEITOS
  );
  assert.equal(r.creditados, 0);
  assert.deepEqual(r.semLigacao, []);
});

test("creditarManuais: o corte entra um pouco antes da palavra e ainda acha a frase", () => {
  // 9,7s: o B-roll comeca antes da frase que o justifica, como o planejador faz.
  const r = creditarManuais(MEMORIA_VAZIA, "Reels", [{ arquivo: "Viagra (1).mp4", inicio: 9.7, fim: 12.7 }], FALA, CONCEITOS);
  assert.equal(r.creditados, 1);
});

test("creditarManuais: arquivo de fora da biblioteca e contado a parte, nao escondido", () => {
  const r = creditarManuais(MEMORIA_VAZIA, "Reels", [{ arquivo: "gato.mp4", inicio: 11, fim: 14 }], FALA, CONCEITOS);
  assert.equal(r.creditados, 0);
  assert.equal(r.foraDaBiblioteca, 1, "tem de sair com o proprio nome, nao como 'ja contado'");
  assert.equal(r.jaContados, 0);
  assert.deepEqual(r.semLigacao, []);
});

test("creditarManuais: cada motivo de nao aprender tem seu proprio numero", () => {
  const r = creditarManuais(
    MEMORIA_VAZIA,
    "Reels",
    [
      { arquivo: "Viagra (1).mp4", inicio: 11, fim: 14 }, // aprende
      { arquivo: "gato.mp4", inicio: 11, fim: 14 }, // fora da pasta
      { arquivo: "Viagra (2).mp4", inicio: 50, fim: 53 }, // sobre silencio
      { arquivo: "Vasos sanguineos (3).mp4", inicio: 31, fim: 34 }, // sem ligacao
    ],
    FALA,
    CONCEITOS
  );
  assert.equal(r.creditados, 1);
  assert.equal(r.foraDaBiblioteca, 1);
  assert.equal(r.semFala, 1);
  assert.equal(r.semLigacao.length, 1);
  assert.equal(r.jaContados, 0);
});

test("creditarManuais: ja contado antes aparece como tal", () => {
  const manuais = [{ arquivo: "Viagra (1).mp4", inicio: 11, fim: 14 }];
  const uma = creditarManuais(MEMORIA_VAZIA, "Reels", manuais, FALA, CONCEITOS);
  const outra = creditarManuais(uma.memoria, "Reels", manuais, FALA, CONCEITOS);
  assert.equal(outra.jaContados, 1);
  assert.equal(outra.foraDaBiblioteca, 0);
  assert.equal(outra.semFala, 0);
});

// -------------------------------------------------------------- pendentes

test("comPendente: uma sequencia nao apaga o julgamento da outra", () => {
  const a = comPendente(PENDENTES_VAZIO, "Corte A", PLANO);
  const b = comPendente(a, "Corte B", PLANO);
  assert.equal(b.porSequencia["Corte A"]?.itens.length, 2);
  const so = comPendente(b, "Corte A", null);
  assert.deepEqual(so.porSequencia["Corte A"]?.itens, [], "julgado, nao ha mais o que julgar");
  assert.equal(so.porSequencia["Corte B"]?.itens.length, 2, "a outra sequencia nao foi tocada");
});

test("comPendente: julgar esvazia os itens mas nunca esquece o que o plugin pos", () => {
  const posto = comPendente(PENDENTES_VAZIO, "Reels", PLANO);
  const julgado = comPendente(posto, "Reels", null);
  // Sem isto, o proprio trabalho do plugin virava "colocacao do usuario".
  assert.deepEqual(
    (julgado.porSequencia["Reels"]?.postos ?? []).map((p) => p.arquivo).sort(),
    ["Casal feliz (3).mp4", "Viagra (1).mp4"]
  );
});

test("comPendente: a lista do que o plugin pos acumula entre rodadas", () => {
  let p = comPendente(PENDENTES_VAZIO, "Reels", PLANO);
  p = comPendente(p, "Reels", null);
  p = comPendente(p, "Reels", pendente(["Doutor (2).mp4", "Doutor", ["doutor"]]));
  assert.equal(p.porSequencia["Reels"]?.postos?.length, 3);
});

test("parsePendentes: pendente antigo, sem `postos`, nao quebra", () => {
  const antigo = {
    schema: 1,
    porSequencia: { Reels: { quando: "x", itens: [{ arquivo: "a.mp4", conceito: "A", termosCasados: [] }] } },
  };
  assert.deepEqual(parsePendentes(antigo).porSequencia["Reels"]?.postos, []);
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

// ------------------- trava anti-Ctrl+Z por posicao (D-032) -------------------

const ITENS_COM_LUGAR = [
  { arquivo: "Viagra (1).mp4", conceito: "Viagra", termosCasados: ["viagra"], inicio: 380 },
  { arquivo: "Doutor (5).mp4", conceito: "Doutor", termosCasados: ["doutor"], inicio: 402 },
];

test("algumNoLugar: undo em lote nao deixa ninguem no lugar — nome igual longe nao conta", () => {
  // O caso real: os itens sumiram, mas os MESMOS arquivos existem em outros
  // pontos (B-roll manual, sobra de rodada antiga). Nome colide; posicao nao.
  const clipes = [
    { arquivo: "Viagra (1).mp4", inicio: 25 },
    { arquivo: "Doutor (5).mp4", inicio: 60 },
  ];
  const presentes = new Set(clipes.map((c) => c.arquivo));
  assert.equal(algumNoLugar(ITENS_COM_LUGAR, clipes, presentes), false);
});

test("algumNoLugar: mantido no lugar (ou so empurrado de leve) conta como sobrevivente", () => {
  const clipes = [{ arquivo: "Viagra (1).mp4", inicio: 381.4 }];
  assert.equal(algumNoLugar(ITENS_COM_LUGAR, clipes, new Set(["Viagra (1).mp4"])), true);
});

test("algumNoLugar: pendente antigo sem inicio cai no criterio por nome", () => {
  const semLugar = [{ arquivo: "Viagra (1).mp4", conceito: "Viagra", termosCasados: ["viagra"] }];
  assert.equal(algumNoLugar(semLugar, [], new Set(["Viagra (1).mp4"])), true);
  assert.equal(algumNoLugar(semLugar, [], new Set()), false);
});

test("parsePendentes: o inicio de cada item sobrevive a ida e volta do disco", () => {
  const p = comPendente({ schema: 1, porSequencia: {} }, "Reels", {
    quando: "2026-08-12",
    itens: ITENS_COM_LUGAR,
  });
  const relido = parsePendentes(JSON.parse(JSON.stringify(p)));
  assert.equal(relido.porSequencia["Reels"]?.itens[0]?.inicio, 380);
});

// ------------- o que e do plugin, por posicao e nao so por nome (D-033) ------

test("foiOPlugin: colocacao manual com arquivo que o plugin ja usou NAO e do plugin", () => {
  // O caso real: 7 de 14 colocacoes manuais sumiam do credito por homonimo.
  const p = comPendente(PENDENTES_VAZIO, "Reels", {
    quando: "",
    itens: [{ arquivo: "Viagra (1).mp4", conceito: "Viagra", termosCasados: ["viagra"], inicio: 380 }],
  }).porSequencia["Reels"];
  assert.equal(foiOPlugin({ arquivo: "Viagra (1).mp4", inicio: 25 }, p), false, "longe do lugar: e manual");
  assert.equal(foiOPlugin({ arquivo: "Viagra (1).mp4", inicio: 380.8 }, p), true, "no lugar: e do plugin");
});

test("foiOPlugin: posto de rodada julgada continua reconhecido no lugar dele", () => {
  let pendentes = comPendente(PENDENTES_VAZIO, "Reels", {
    quando: "",
    itens: [{ arquivo: "Doutor (5).mp4", conceito: "Doutor", termosCasados: ["doutor"], inicio: 100 }],
  });
  pendentes = comPendente(pendentes, "Reels", null); // julgado: vira so `postos`
  const p = pendentes.porSequencia["Reels"];
  assert.equal(foiOPlugin({ arquivo: "Doutor (5).mp4", inicio: 100.5 }, p), true);
  assert.equal(foiOPlugin({ arquivo: "Doutor (5).mp4", inicio: 200 }, p), false);
});

test("foiOPlugin: posto antigo sem posicao cai no criterio por nome", () => {
  const p = parsePendentes({
    schema: 1,
    porSequencia: { Reels: { quando: "", itens: [], postos: ["Viagra (1).mp4"] } },
  }).porSequencia["Reels"];
  assert.equal(foiOPlugin({ arquivo: "Viagra (1).mp4", inicio: 999 }, p), true);
  assert.equal(foiOPlugin({ arquivo: "Outro.mp4", inicio: 999 }, p), false);
});

test("parsePendentes: postos novos guardam a posicao na ida e volta", () => {
  const p = comPendente(PENDENTES_VAZIO, "Reels", {
    quando: "",
    itens: [{ arquivo: "Viagra (1).mp4", conceito: "Viagra", termosCasados: ["viagra"], inicio: 42 }],
  });
  const relido = parsePendentes(JSON.parse(JSON.stringify(p)));
  assert.deepEqual(relido.porSequencia["Reels"]?.postos, [{ arquivo: "Viagra (1).mp4", inicio: 42 }]);
});

test("creditarManuais: frase longa e cortada em palavra inteira, com aviso", () => {
  const longa = [
    frase("depois veio o mito, em seguida a ansiedade e quando voce percebeu ja era tarde demais", 30, 40),
  ];
  const r = creditarManuais(
    MEMORIA_VAZIA,
    "Reels",
    [{ arquivo: "Viagra (2).mp4", inicio: 31, fim: 34 }],
    longa,
    CONCEITOS
  );
  const msg = r.semLigacao[0] ?? "";
  assert.match(msg, /…/, "corte tem de avisar que cortou");
  assert.doesNotMatch(msg, /\bper…/, "nao pode partir palavra no meio");
});

// --------------- a frase certa e a que o B-roll cobre (D-034) ----------------

test("creditarManuais: B-roll adiantado credita a frase que ele COBRE, nao a anterior", () => {
  // O respiro antes da fala: comeca 0,2s antes do fim da frase A, mas cobre
  // 2,6s da frase B. Pelo criterio antigo (onde comeca), creditava A.
  const coladas = [
    frase("primeiro voce perdeu foi a confianca", 10, 15),
    frase("o viagra nao resolve isso sozinho", 15.2, 20),
  ];
  const r = creditarManuais(
    MEMORIA_VAZIA,
    "Reels",
    [{ arquivo: "Viagra (1).mp4", inicio: 14.8, fim: 17.8 }],
    coladas,
    CONCEITOS
  );
  assert.equal(r.creditados, 1, "a frase coberta fala de viagra: credita o par");
  assert.deepEqual(r.memoria.pares[chave("Viagra", "viagra")], { acertos: 1, erros: 0 });
});

test("creditarManuais: B-roll inteiro dentro de uma frase segue creditando ela", () => {
  const r = creditarManuais(MEMORIA_VAZIA, "Reels", [{ arquivo: "Viagra (1).mp4", inicio: 11, fim: 14 }], FALA, CONCEITOS);
  assert.equal(r.creditados, 1);
});

test("creditarManuais: encostado na frase sem cobrir nada ainda acha ela pela folga", () => {
  // Termina exatamente onde a fala comeca: sobreposicao zero, folga resolve.
  const r = creditarManuais(
    MEMORIA_VAZIA,
    "Reels",
    [{ arquivo: "Viagra (1).mp4", inicio: 9.7, fim: 10 }],
    FALA,
    CONCEITOS
  );
  assert.equal(r.creditados, 1);
});
