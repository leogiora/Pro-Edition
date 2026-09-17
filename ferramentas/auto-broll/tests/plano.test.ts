import { test } from "node:test";
import assert from "node:assert/strict";

import { aprender, MEMORIA_VAZIA } from "../src/aprendizado.ts";
import {
  planejar,
  REGRAS_DENSAS,
  REGRAS_PADRAO,
  semSobrepor,
  type Biblioteca,
  type Colocacao,
} from "../src/plano.ts";
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
const TRIO = conceito("Trio", ["Trio (1).mp4", "Trio (2).mp4", "Trio (3).mp4"]);

const BIBLIOTECA: Biblioteca = {
  caminhos: new Map([
    ["Frustrado (1).mp4", "C:\\b\\Frustrado (1).mp4"],
    ["Frustrado (2).mp4", "C:\\b\\Frustrado (2).mp4"],
    ["Viagra (1).mp4", "C:\\b\\Viagra (1).mp4"],
    ["Trio (1).mp4", "C:\\b\\Trio (1).mp4"],
    ["Trio (2).mp4", "C:\\b\\Trio (2).mp4"],
    ["Trio (3).mp4", "C:\\b\\Trio (3).mp4"],
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
  // Duas oportunidades alem da janela de conceito (60s): pega variacoes diferentes.
  const p = planejar(
    [
      oportunidade(10, 3, [{ c: FRUSTRADO, score: 1 }]),
      oportunidade(90, 3, [{ c: FRUSTRADO, score: 1 }]),
    ],
    BIBLIOTECA
  );
  assert.equal(p.colocacoes.length, 2);
  assert.notEqual(p.colocacoes[0]?.arquivo, p.colocacoes[1]?.arquivo);
});

test("planejar: repetir perto demais nao entra — o espectador reconhece o shot", () => {
  // 90s de distancia: passa da janela de conceito (60s) mas nao da janela do
  // mesmo arquivo (180s). Viagra tem take unico, entao a segunda cai fora.
  const p = planejar(
    [
      oportunidade(10, 3, [{ c: VIAGRA, score: 1 }]),
      oportunidade(100, 3, [{ c: VIAGRA, score: 1 }]),
    ],
    BIBLIOTECA
  );
  assert.equal(p.colocacoes.length, 1);
  assert.match(p.descartes.join(" "), /apareceram ha menos de 180s/);
});

test("planejar: sem take inedito, repete o que ja saiu da tela ha tempo", () => {
  // Secao 8: "salvo ausencia de alternativa". 190s passa da janela de 180s.
  const p = planejar(
    [
      oportunidade(10, 3, [{ c: VIAGRA, score: 1 }]),
      oportunidade(200, 3, [{ c: VIAGRA, score: 1 }]),
    ],
    BIBLIOTECA
  );
  assert.equal(p.colocacoes.length, 2);
  assert.equal(p.colocacoes[1]?.arquivo, "Viagra (1).mp4");
  assert.match(p.colocacoes[1]?.motivo ?? "", /take repetido/);
});

test("planejar: inedito continua tendo prioridade sobre repetir", () => {
  // Frustrado tem dois takes: mesmo com o (1) elegivel de novo, vem o (2).
  const p = planejar(
    [
      oportunidade(10, 3, [{ c: FRUSTRADO, score: 1 }]),
      oportunidade(90, 3, [{ c: FRUSTRADO, score: 1 }]),
    ],
    BIBLIOTECA
  );
  assert.notEqual(p.colocacoes[0]?.arquivo, p.colocacoes[1]?.arquivo);
  assert.doesNotMatch(p.colocacoes[1]?.motivo ?? "", /take repetido/);
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

test("planejar: nao repete take que ja esta na timeline de outra analise", () => {
  // Frustrado (1) entrou em 20s no reel anterior. Este trecho ve a oportunidade
  // 300s depois — alem das duas janelas de repeticao, mas ainda o mesmo take.
  const p = planejar(
    [oportunidade(320, 3, [{ c: FRUSTRADO, score: 1 }])],
    BIBLIOTECA,
    REGRAS_PADRAO,
    MEMORIA_VAZIA,
    undefined,
    [{ inicio: 20, fim: 23, arquivo: "Frustrado (1).mp4", conceito: "Frustrado" }]
  );
  assert.equal(p.colocacoes.length, 1);
  assert.equal(p.colocacoes[0]?.arquivo, "Frustrado (2).mp4");
});

test("planejar: conceito ja na timeline barra a repeticao no reel vizinho", () => {
  // Frustrado inserido em 417s no reel anterior; este reel acha Frustrado 26s
  // depois. Perto demais — nao entra, igual a repeticao dentro de uma so rodada.
  const p = planejar(
    [oportunidade(443, 4, [{ c: FRUSTRADO, score: 1 }])],
    BIBLIOTECA,
    REGRAS_PADRAO,
    MEMORIA_VAZIA,
    undefined,
    [{ inicio: 417, fim: 420, arquivo: "Frustrado (1).mp4", conceito: "Frustrado" }]
  );
  assert.equal(p.colocacoes.length, 0);
  assert.match(p.descartes.join(" "), /conceito repetido/);
});

test("planejar: conceito na timeline conta mesmo estando depois do trecho", () => {
  // Reel posterior analisado primeiro (Viagra em 300s); agora o reel anterior
  // acha Viagra 40s antes. A janela mede por distancia, nao por ordem.
  const p = planejar(
    [oportunidade(260, 4, [{ c: VIAGRA, score: 1 }])],
    BIBLIOTECA,
    REGRAS_PADRAO,
    MEMORIA_VAZIA,
    undefined,
    [{ inicio: 300, fim: 303, arquivo: "Viagra (1).mp4", conceito: "Viagra" }]
  );
  assert.equal(p.colocacoes.length, 0);
});

test("planejar: B-roll na timeline longe do trecho nao atrapalha", () => {
  const p = planejar(
    [oportunidade(500, 4, [{ c: VIAGRA, score: 1 }])],
    BIBLIOTECA,
    REGRAS_PADRAO,
    MEMORIA_VAZIA,
    undefined,
    [{ inicio: 20, fim: 23, arquivo: "Viagra (1).mp4", conceito: "Viagra" }]
  );
  assert.equal(p.colocacoes.length, 1);
  assert.match(p.colocacoes[0]?.motivo ?? "", /take repetido/);
});

test("planejar: rodizio por take — todos rodam antes de qualquer um repetir", () => {
  // 4 oportunidades bem separadas (alem da janela de conceito de 60s; a ultima
  // 250s depois da primeira, alem do piso de 180s do take).
  const p = planejar(
    [
      oportunidade(10, 3, [{ c: TRIO, score: 1 }]),
      oportunidade(90, 3, [{ c: TRIO, score: 1 }]),
      oportunidade(170, 3, [{ c: TRIO, score: 1 }]),
      oportunidade(260, 3, [{ c: TRIO, score: 1 }]),
    ],
    BIBLIOTECA
  );
  assert.deepEqual(
    p.colocacoes.map((c) => c.arquivo),
    ["Trio (1).mp4", "Trio (2).mp4", "Trio (3).mp4", "Trio (1).mp4"]
  );
  assert.match(p.colocacoes[3]?.motivo ?? "", /ciclo 2/);
});

test("planejar: passado o primeiro ciclo, o rodizio nao trava no take de melhor score", () => {
  // Trio (2) tem o melhor saldo no aprendizado. Sem rodizio, assim que os tres
  // takes rodam uma vez o (2) passaria a ser escolhido sempre.
  let memoria = MEMORIA_VAZIA;
  for (let i = 0; i < 3; i++) {
    memoria = aprender(
      memoria,
      { quando: "", itens: [{ arquivo: "Trio (2).mp4", conceito: "Trio", termosCasados: TRIO.termos }] },
      new Set(["Trio (2).mp4"])
    ).memoria;
  }
  const opps = [10, 200, 400, 600, 800, 1000].map((t) => oportunidade(t, 3, [{ c: TRIO, score: 1 }]));
  const p = planejar(opps, BIBLIOTECA, REGRAS_PADRAO, memoria);
  const contagem = new Map<string, number>();
  for (const c of p.colocacoes) contagem.set(c.arquivo, (contagem.get(c.arquivo) ?? 0) + 1);
  assert.equal(p.colocacoes.length, 6);
  assert.deepEqual([...contagem.values()].sort(), [2, 2, 2], "cada take entrou exatamente 2x");
});

test("planejar: o ciclo conta o que ja esta na timeline", () => {
  // Trio (1) usado 2x e Trio (2) 1x em analises anteriores; Trio (3) nunca —
  // a proxima colocacao tem de ser o (3).
  const p = planejar(
    [oportunidade(300, 3, [{ c: TRIO, score: 1 }])],
    BIBLIOTECA,
    REGRAS_PADRAO,
    MEMORIA_VAZIA,
    undefined,
    [
      { inicio: 10, fim: 13, arquivo: "Trio (1).mp4", conceito: "Trio" },
      { inicio: 50, fim: 53, arquivo: "Trio (1).mp4", conceito: "Trio" },
      { inicio: 30, fim: 33, arquivo: "Trio (2).mp4", conceito: "Trio" },
    ]
  );
  assert.equal(p.colocacoes[0]?.arquivo, "Trio (3).mp4");
});

test("planejar: no ciclo 2, o piso de 180s ainda segura o mesmo take", () => {
  // Viagra tem take unico, ja na timeline ha 80s. O ciclo mandaria repetir,
  // mas 80s < 180s — nao entra.
  const p = planejar(
    [oportunidade(280, 4, [{ c: VIAGRA, score: 1 }])],
    BIBLIOTECA,
    REGRAS_PADRAO,
    MEMORIA_VAZIA,
    undefined,
    [{ inicio: 200, fim: 203, arquivo: "Viagra (1).mp4", conceito: "Viagra" }]
  );
  assert.equal(p.colocacoes.length, 0);
  assert.match(p.descartes.join(" "), /apareceram ha menos de 180s/);
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

// ------------------------- aprendizado por sobrevivencia --------------------

test("planejar: par apagado varias vezes deixa de entrar sozinho", () => {
  const o = oportunidade(10, 3, [{ c: FRUSTRADO, score: 0.7 }]);
  assert.equal(planejar([o], BIBLIOTECA).colocacoes.length, 1);

  // Tres rodadas em que o usuario apagou este B-roll da timeline.
  let memoria = MEMORIA_VAZIA;
  const pendente = {
    quando: "",
    itens: [{ arquivo: "Frustrado (1).mp4", conceito: "Frustrado", termosCasados: FRUSTRADO.termos }],
  };
  for (let i = 0; i < 3; i++) memoria = aprender(memoria, pendente, new Set()).memoria;

  const depois = planejar([o], BIBLIOTECA, REGRAS_PADRAO, memoria);
  assert.equal(depois.colocacoes.length, 0, "0,7 x 0,55 fica abaixo do corte de 0,6");
});

test("planejar: o take apagado nao volta — entra outra variacao do conceito", () => {
  const memoria = aprender(
    MEMORIA_VAZIA,
    {
      quando: "",
      itens: [{ arquivo: "Frustrado (1).mp4", conceito: "Frustrado", termosCasados: FRUSTRADO.termos }],
    },
    new Set()
  ).memoria;

  const p = planejar(
    [oportunidade(10, 3, [{ c: FRUSTRADO, score: 1 }])],
    BIBLIOTECA,
    REGRAS_PADRAO,
    memoria
  );
  const c = p0(p.colocacoes);
  assert.equal(c.arquivo, "Frustrado (2).mp4", "devia ter trocado de take");
  assert.match(c.motivo, /outro take/);
});

test("planejar: sem alternativa, o conceito ainda entra com o take conhecido", () => {
  // "Viagra" so tem um arquivo: trocar nao e opcao, e derrubar e trabalho do score.
  const memoria = aprender(
    MEMORIA_VAZIA,
    { quando: "", itens: [{ arquivo: "Viagra (1).mp4", conceito: "Viagra", termosCasados: VIAGRA.termos }] },
    new Set()
  ).memoria;

  const p = planejar(
    [oportunidade(10, 3, [{ c: VIAGRA, score: 1 }])],
    BIBLIOTECA,
    REGRAS_PADRAO,
    memoria
  );
  assert.equal(p0(p.colocacoes).arquivo, "Viagra (1).mp4");
  assert.doesNotMatch(p0(p.colocacoes).motivo, /outro take/);
});

test("planejar: o motivo diz quando o historico mexeu no score", () => {
  const memoria = aprender(
    MEMORIA_VAZIA,
    {
      quando: "",
      itens: [{ arquivo: "Viagra (1).mp4", conceito: "Viagra", termosCasados: VIAGRA.termos }],
    },
    new Set(["Viagra (1).mp4"])
  ).memoria;

  const p = planejar([oportunidade(10, 3, [{ c: VIAGRA, score: 0.8 }])], BIBLIOTECA, REGRAS_PADRAO, memoria);
  assert.match(p0(p.colocacoes).motivo, /aprendizado \+25%/);
});

// ------------------- palavras espalhadas na frase ---------------------------

/** Como `conceitosDeArquivos` produz de verdade: "de" cai, e o resto vira radical. */
const MILHARES: Conceito = {
  rotulo: "Milhares de homens",
  arquivos: ["Milhares de homens (1).mp4"],
  termos: ["milhare", "homem"],
};
const BIBLIOTECA_MILHARES: Biblioteca = {
  caminhos: new Map([["Milhares de homens (1).mp4", "C:\\b\\Milhares de homens (1).mp4"]]),
};

test("planejar: duas palavras longe uma da outra nao formam um casamento", () => {
  // Frase real que causou o erro: "...que MILHOES de casais no Brasil tem
  // quando o HOMEM comeca a perder o desempenho sexual." As duas palavras
  // existem, mas a 2,8s de distancia e falando de coisas diferentes.
  const o = oportunidade(1.6, 7.4, [{ c: MILHARES, score: 1 }], [
    { termo: "milhare", inicio: 3.7 },
    { termo: "casais", inicio: 4.2 },
    { termo: "homem", inicio: 6.5 },
  ]);
  const p = planejar([o], BIBLIOTECA_MILHARES);
  assert.equal(p.colocacoes.length, 0);
  assert.match(p.descartes.join(" "), /falam de coisas diferentes/);
});

test("planejar: as mesmas palavras coladas casam normalmente", () => {
  // "ajudei milhares de homens a recuperarem..." — 0,35s de distancia.
  const o = oportunidade(38.8, 10, [{ c: MILHARES, score: 1 }], [
    { termo: "milhare", inicio: 39.2 },
    { termo: "homem", inicio: 39.55 },
  ]);
  assert.equal(planejar([o], BIBLIOTECA_MILHARES).colocacoes.length, 1);
});

test("planejar: conceito de uma palavra so nao tem dispersao para medir", () => {
  const o = oportunidade(10, 4, [{ c: VIAGRA, score: 1 }], [{ termo: "viagra", inicio: 11 }]);
  assert.equal(planejar([o], BIBLIOTECA).colocacoes.length, 1);
});

test("planejar: sem tempo das palavras, nao descarta por engano", () => {
  // termosNoTempo vazio: nao da para julgar distancia, entao nao se julga.
  const o = oportunidade(10, 4, [{ c: MILHARES, score: 1 }]);
  assert.equal(planejar([o], BIBLIOTECA_MILHARES).colocacoes.length, 1);
});

test("planejar: escolhe a ocorrencia mais proxima quando a palavra se repete", () => {
  // "milhares" aparece longe E perto de "homens": vale o par mais apertado.
  const o = oportunidade(1.6, 10, [{ c: MILHARES, score: 1 }], [
    { termo: "milhare", inicio: 2 },
    { termo: "homem", inicio: 9 },
    { termo: "milhare", inicio: 8.7 },
  ]);
  assert.equal(planejar([o], BIBLIOTECA_MILHARES).colocacoes.length, 1);
});

// --------------------------- densidade --------------------------------------

test("REGRAS_DENSAS: recupera o que caiu por espacamento, nao por qualidade", () => {
  // Tres frases seguidas, coladas: com o padrao so a primeira entra.
  const seguidas = [
    oportunidade(10, 3, [{ c: FRUSTRADO, score: 1 }]),
    oportunidade(14, 3, [{ c: VIAGRA, score: 1 }]),
  ];
  assert.equal(planejar(seguidas, BIBLIOTECA, REGRAS_PADRAO).colocacoes.length, 1);
  assert.equal(planejar(seguidas, BIBLIOTECA, REGRAS_DENSAS).colocacoes.length, 2);
});

test("REGRAS_DENSAS: o mesmo conceito volta mais cedo, mas com outro take", () => {
  const p = planejar(
    [
      oportunidade(10, 3, [{ c: FRUSTRADO, score: 1 }]),
      oportunidade(22, 3, [{ c: FRUSTRADO, score: 1 }]),
    ],
    BIBLIOTECA,
    REGRAS_DENSAS
  );
  assert.equal(p.colocacoes.length, 2, "12s de distancia cabe na janela de 8s");
  assert.notEqual(p.colocacoes[0]?.arquivo, p.colocacoes[1]?.arquivo);
});

test("REGRAS_DENSAS: densidade NAO afrouxa o corte de qualidade", () => {
  // Score 0,5 continua fora: mais B-roll nao pode significar B-roll pior.
  const fraca = [oportunidade(10, 3, [{ c: FRUSTRADO, score: 0.5 }])];
  assert.equal(planejar(fraca, BIBLIOTECA, REGRAS_DENSAS).colocacoes.length, 0);
  assert.equal(REGRAS_DENSAS.scoreMinimo, REGRAS_PADRAO.scoreMinimo);
});

// ------------------------ intensidade do take -------------------------------

/** Frustrado tem dois takes: (1) parado, (2) agitado. */
const AGITACAO = new Map([
  ["Frustrado (1).mp4", 0.001],
  ["Frustrado (2).mp4", 0.009],
  ["Viagra (1).mp4", 0.005],
]);

test("planejar: fala rapida puxa o take agitado, fala lenta puxa o parado", () => {
  const lenta = oportunidade(10, 4, [{ c: FRUSTRADO, score: 1 }]);
  const rapida = oportunidade(90, 4, [{ c: FRUSTRADO, score: 1 }]);
  const p = planejar([lenta, rapida], BIBLIOTECA, REGRAS_PADRAO, MEMORIA_VAZIA, {
    porArquivo: AGITACAO,
    // A frase de 10s tem ritmo 2 (percentil 0); a de 90s tem 8 (percentil 1).
    ritmoDasFrases: [2, 8],
  });
  assert.equal(p.colocacoes.length, 2);
  assert.equal(p0(p.colocacoes).arquivo, "Frustrado (1).mp4", "a lenta pega o parado");
  assert.equal(p.colocacoes[1]?.arquivo, "Frustrado (2).mp4", "a rapida pega o agitado");
});

test("planejar: o motivo diz que o take foi escolhido pelo momento", () => {
  const p = planejar(
    [oportunidade(10, 4, [{ c: FRUSTRADO, score: 1 }])],
    BIBLIOTECA,
    REGRAS_PADRAO,
    MEMORIA_VAZIA,
    { porArquivo: AGITACAO, ritmoDasFrases: [2, 8] }
  );
  assert.match(p0(p.colocacoes).motivo, /take (agitado|parado)/);
});

test("planejar: nenhum take encaixa, a colocacao acontece do mesmo jeito", () => {
  // Os dois takes tem a mesma agitacao, entao percentis 0 e 0; a fala e rapida.
  const so = new Map([["Frustrado (1).mp4", 0.001], ["Frustrado (2).mp4", 0.0011]]);
  const p = planejar(
    [oportunidade(10, 4, [{ c: FRUSTRADO, score: 1 }])],
    BIBLIOTECA,
    REGRAS_PADRAO,
    MEMORIA_VAZIA,
    { porArquivo: so, ritmoDasFrases: [2, 8] }
  );
  assert.equal(p.colocacoes.length, 1, "intensidade nunca pode custar uma colocacao");
});

test("planejar: sem intensidade, o plano e identico ao de hoje", () => {
  const o = [oportunidade(10, 4, [{ c: FRUSTRADO, score: 1 }])];
  assert.deepEqual(planejar(o, BIBLIOTECA), planejar(o, BIBLIOTECA, REGRAS_PADRAO, MEMORIA_VAZIA));
});

test("planejar: o historico ainda escolhe DENTRO do que a intensidade permitiu", () => {
  // Os dois takes encaixam igualmente; o historico reprova o (1), entao vem o (2).
  const memoria = aprender(
    MEMORIA_VAZIA,
    {
      quando: "",
      itens: [{ arquivo: "Frustrado (1).mp4", conceito: "Frustrado", termosCasados: FRUSTRADO.termos }],
    },
    new Set()
  ).memoria;
  const p = planejar(
    [oportunidade(10, 4, [{ c: FRUSTRADO, score: 1 }])],
    BIBLIOTECA,
    REGRAS_PADRAO,
    memoria,
    {
      porArquivo: new Map([["Frustrado (1).mp4", 0.005], ["Frustrado (2).mp4", 0.005]]),
      ritmoDasFrases: [2, 8],
    }
  );
  assert.equal(p0(p.colocacoes).arquivo, "Frustrado (2).mp4");
});

// ------------------- nao passar por cima do que ja existe --------------------

function colocada(inicio: number, duracao: number): Colocacao {
  return {
    arquivo: "x.mp4",
    caminho: "C:\\b\\x.mp4",
    conceito: "X",
    inicio,
    duracao,
    score: 1,
    motivo: "",
    termosCasados: [],
    textoDaFrase: "",
    ancoradoEm: inicio,
  };
}

test("semSobrepor: onde ja ha B-roll, nao entra outro", () => {
  const r = semSobrepor([colocada(10, 3)], [{ inicio: 11, fim: 14 }]);
  assert.equal(r.entram.length, 0);
  assert.match(r.bloqueadas.join(" "), /ja ha B-roll ai/);
});

test("semSobrepor: espaco livre continua entrando", () => {
  const r = semSobrepor([colocada(10, 3)], [{ inicio: 30, fim: 33 }]);
  assert.equal(r.entram.length, 1);
  assert.deepEqual(r.bloqueadas, []);
});

test("semSobrepor: encostar nao e sobrepor", () => {
  // Termina em 13, o proximo comeca em 13: montagem normal.
  assert.equal(semSobrepor([colocada(13, 3)], [{ inicio: 10, fim: 13 }]).entram.length, 1);
  assert.equal(semSobrepor([colocada(10, 3)], [{ inicio: 13, fim: 16 }]).entram.length, 1);
});

test("semSobrepor: sobreposicao parcial tambem bloqueia", () => {
  // O que ja esta la manda, mesmo que o novo cubra so o comeco dele.
  assert.equal(semSobrepor([colocada(10, 3)], [{ inicio: 12, fim: 20 }]).entram.length, 0);
  assert.equal(semSobrepor([colocada(10, 3)], [{ inicio: 5, fim: 11 }]).entram.length, 0);
});

test("semSobrepor: timeline vazia deixa tudo passar", () => {
  assert.equal(semSobrepor([colocada(10, 3), colocada(20, 3)], []).entram.length, 2);
});

function p0<T>(lista: readonly T[]): T {
  const primeiro = lista[0];
  if (primeiro === undefined) throw new Error("plano vazio");
  return primeiro;
}

test("planejar: o descarte diz quando foi o aprendizado que derrubou o score", () => {
  // Raw 100%, mas o par apanhou tres vezes: ajuste bate no piso 0,5 e fica abaixo do corte.
  let memoria = MEMORIA_VAZIA;
  const pendente = {
    quando: "",
    itens: [{ arquivo: "Viagra (1).mp4", conceito: "Viagra", termosCasados: VIAGRA.termos }],
  };
  for (let i = 0; i < 3; i++) memoria = aprender(memoria, pendente, new Set()).memoria;

  const p = planejar([oportunidade(10, 3, [{ c: VIAGRA, score: 1 }])], BIBLIOTECA, REGRAS_PADRAO, memoria);
  assert.equal(p.colocacoes.length, 0);
  assert.match(p.descartes.join(" "), /melhor: 100%, caiu para 50% pelo aprendizado/);
});
