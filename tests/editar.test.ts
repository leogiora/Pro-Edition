import { test } from "node:test";
import assert from "node:assert/strict";

import {
  cortesDosPedacos,
  dentroDasVariacoes,
  inicioDosLeaks,
  moverPalavras,
  marcarFala,
  parsePerfil,
  protegerFora,
  quadros,
  resumoPorVariacao,
  trilhaFaltando,
  trocarEmpresa,
  variacoes,
  variacoesDaSelecao,
} from "../src/editar.ts";
import { presetDa } from "../ferramentas/pro-captions/src/preset.ts";
import type { Pedaco } from "../src/pausas.ts";

const FPS = 25;
const w = (text: string, inicio: number, fim: number) => ({ text, inicio, fim, confidence: 1, eos: false, sourceName: "seq" });

test("variacoes: pedacos colados sao a mesma; o espaco de 1 s ou mais separa", () => {
  const clipes = [
    { inicioQ: 0, fimQ: 100 },
    { inicioQ: 100, fimQ: 200 },
    { inicioQ: 210, fimQ: 250 }, // 10 quadros = 0,4 s: ainda a mesma
    { inicioQ: 300, fimQ: 400 }, // 50 quadros = 2 s: outra
  ];
  assert.deepEqual(variacoes(clipes, FPS), [
    { inicioQ: 0, fimQ: 250 },
    { inicioQ: 300, fimQ: 400 },
  ]);
});

test("a fala anda junto com o pedaco; a que estava na pausa cortada some", () => {
  // Antes: fala de 1 a 2 s e de 4 a 5 s. O corte guardou [0,8-2,2] e [3,8-5,2].
  const pedacos: Pedaco[] = [
    { fonte: 0, midiaDeQ: 20, midiaAteQ: 55, destinoQ: 0, origemQ: 20 },
    { fonte: 0, midiaDeQ: 95, midiaAteQ: 130, destinoQ: 35, origemQ: 95 },
  ];
  const antes = [w("olá", 1, 1.5), w("mundo", 1.5, 2), w("hum", 3, 3.2), w("tudo", 4, 4.5), w("bem", 4.5, 5)];
  const depois = moverPalavras(antes, pedacos, FPS);
  assert.deepEqual(depois.map((p) => p.text), ["olá", "mundo", "tudo", "bem"]);
  assert.ok(Math.abs(depois[0]!.inicio - 0.2) < 1e-9, `olá em ${depois[0]!.inicio}`);
  assert.ok(Math.abs(depois[2]!.inicio - (1.4 + 0.2)) < 1e-9, `tudo em ${depois[2]!.inicio}`);
  assert.deepEqual(cortesDosPedacos(pedacos, FPS), [1.4]);
});

test("B-roll termina com o doutor; o que cai no espaco ou sobra curto sai", () => {
  const vars = [
    { inicioQ: 0, fimQ: 250 }, // 0 a 10 s
    { inicioQ: 300, fimQ: 500 }, // 12 a 20 s
  ];
  const r = dentroDasVariacoes(
    [
      { arquivo: "a.mp4", inicio: 2, duracao: 3 }, // fica igual
      { arquivo: "b.mp4", inicio: 8, duracao: 3 }, // aparado para 2 s
      { arquivo: "c.mp4", inicio: 9.5, duracao: 3 }, // sobraria 0,5 s
      { arquivo: "d.mp4", inicio: 11, duracao: 2 }, // no espaco
    ],
    vars,
    FPS
  );
  assert.deepEqual(r.ficam.map((c) => [c.arquivo, c.duracao]), [
    ["a.mp4", 3],
    ["b.mp4", 2],
  ]);
  assert.equal(r.aparados, 1);
  assert.equal(r.fora.length, 2);
});

test("inicioDosLeaks: 0,36 s antes de cada troca doutor/B-roll; nada entre B-rolls colados, na ponta da variacao ou onde ja tem", () => {
  const vars = [{ inicioQ: 0, fimQ: 1500 }]; // 0 a 60 s
  const brolls = [
    { inicio: 0, fim: 3 }, // entra no comeco da variacao: so a saida ganha leak
    { inicio: 7.6, fim: 9.16 },
    { inicio: 9.16, fim: 12 }, // colado no anterior: a troca em 9,16 e broll/broll
    { inicio: 57, fim: 60 }, // sai no fim da variacao
  ];
  const jaNaFaixa = [{ inicio: 11.64, fim: 12.48 }]; // o Leo ja pos o da saida em 12
  assert.deepEqual(inicioDosLeaks(brolls, vars, FPS, jaNaFaixa), [2.64, 7.24, 56.64]);
  // Sai em 25,24 e o proximo entra 0,8 s depois: os dois leaks entram, o segundo come o fim do primeiro.
  assert.deepEqual(inicioDosLeaks([{ inicio: 20, fim: 25.24 }, { inicio: 26.04, fim: 30 }], vars, FPS), [19.64, 24.88, 25.68, 29.64]);
});

test("trilhaFaltando: copia onde nao tem musica; pula se a copia, antes de aparada, cairia na musica da vizinha", () => {
  const vars = [
    { inicioQ: 0, fimQ: 1500 }, // 0-60 s: o modelo esta aqui
    { inicioQ: 1750, fimQ: 3250 }, // 70-130 s: livre ate 140
    { inicioQ: 3300, fimQ: 3500 }, // 132-140 s: a copia de 60 s passaria de 140
    { inicioQ: 3500 + 25, fimQ: 5000 }, // 141-200 s: o Leo ja pos
  ];
  const naFaixa = [{ inicio: 0, fim: 60 }, { inicio: 141, fim: 200 }];
  const r = trilhaFaltando(vars, FPS, naFaixa, 60);
  assert.deepEqual(r.entram, [vars[1]]);
  assert.deepEqual(r.pulam, [vars[2]]);
});

test("perfil: troca de empresa guarda a pasta de quem sai e devolve a de quem entra; termos vem da empresa", () => {
  const vazio = parsePerfil(null); // sem perfil.json: AndroClinic, como sempre foi
  assert.equal(vazio.empresa, "androclinic");
  const g = trocarEmpresa(vazio, "C:\\Brolls - 2026", "grandcare");
  assert.equal(g.pasta, ""); // GrandCare nunca teve pasta escolhida
  const volta = trocarEmpresa(parsePerfil(JSON.parse(JSON.stringify(g.perfil))), "C:\\Brolls - Grandcare", "androclinic");
  assert.equal(volta.pasta, "C:\\Brolls - 2026");
  assert.deepEqual(volta.perfil.bibliotecas, { androclinic: "C:\\Brolls - 2026", grandcare: "C:\\Brolls - Grandcare" });
  assert.equal(parsePerfil({ empresa: "toString", bibliotecas: { toString: "x" } }).empresa, "androclinic"); // lixo nao vira empresa
  assert.ok(presetDa("grandcare").termosChave.includes("GrandCare"));
  assert.equal(presetDa("grandcare").maxPalavras, 3); // o resto e o preset dos Ads
});

test("resumoPorVariacao: conta o que caiu em cada uma e avisa a fala que acaba cedo (audio mudo)", () => {
  const vars = [{ inicioQ: 0, fimQ: 250 }, { inicioQ: 300, fimQ: 550 }]; // 0-10 s e 12-22 s
  const antes = [{ inicioQ: 0, fimQ: 300 }, { inicioQ: 350, fimQ: 650 }];
  const r = resumoPorVariacao(vars, antes, FPS, {
    clipes: [{ inicio: 0, fim: 6 }, { inicio: 6, fim: 10 }, { inicio: 12, fim: 22 }],
    brolls: [{ inicio: 2, fim: 4, nome: "Academia" }, { inicio: 9, fim: 11, nome: "Casal" }, { inicio: 13, fim: 15, nome: "Exame" }],
    leaks: [1.6, 12.6],
    blocos: [
      { inicio: 0, fim: 2, texto: "você sabia", estilo: "normal" },
      { inicio: 8, fim: 10, texto: "R$ 197", estilo: "preco" },
      { inicio: 12, fim: 14, texto: "agende", estilo: "normal" },
    ],
    palavras: [w("a", 0, 9.5), w("b", 12, 15)], // a 2a fala acaba em 15 s: 7 s mudos antes do fim (22 s)
    trilha: [vars[0]!],
  });
  assert.equal(r[0]!.duracaoS, 10);
  assert.equal(r[0]!.antesS, 12);
  assert.deepEqual(r[0]!.clipes, [{ de: 0, ate: 6 }, { de: 6, ate: 10 }]);
  assert.deepEqual(r[0]!.brolls[1], { de: 9, ate: 10, nome: "Casal" }); // aparado no fim da variacao
  assert.equal(r[0]!.leaks.length, 1);
  assert.deepEqual(r[0]!.legendas[1], { de: 8, ate: 10, nome: "R$ 197", preco: true });
  assert.equal(r[0]!.trilha, true);
  assert.equal(r[0]!.falaSomeEmS, null);
  assert.deepEqual(r[1]!.brolls, [{ de: 1, ate: 3, nome: "Exame" }]); // tempo desde o inicio da variacao
  assert.equal(r[1]!.trilha, false);
  assert.equal(r[1]!.falaSomeEmS, 3);
  // Sem transcricao (so split/leak/trilha) nao ha aviso de fala; numero de variacoes mudou: sem "antes".
  const s = resumoPorVariacao(vars, antes.slice(0, 1), FPS, { clipes: [], brolls: [], leaks: [], blocos: [], palavras: [], trilha: [] });
  assert.equal(s[1]!.falaSomeEmS, null);
  assert.equal(s[0]!.antesS, null);
  assert.deepEqual(r[0]!.palavras[0], { de: 0, ate: 9.5, nome: "a" });
});

test("marcarFala e quadros: corte, B-roll, quebra de legenda e preco em cada palavra e quadro", () => {
  const p = (nome: string, de: number) => ({ de, ate: de + 0.4, nome });
  const r = {
    duracaoS: 6,
    antesS: null,
    clipes: [{ de: 0, ate: 3 }, { de: 3, ate: 6 }],
    brolls: [{ de: 1, ate: 2.5, nome: "Academia" }],
    leaks: [{ de: 0.64, ate: 1.48 }],
    legendas: [{ de: 0, ate: 2 }, { de: 2, ate: 4 }, { de: 4, ate: 6, preco: true }],
    trilha: false,
    palavras: [p("você", 0), p("sabia", 1), p("que", 1.5), p("a", 2.2), p("queda", 3.2), p("R$", 4.2)],
    falaSomeEmS: null,
  };
  const f = marcarFala(r);
  assert.deepEqual(f.map((x) => x.broll), [undefined, "Academia", undefined, undefined, undefined, undefined]); // tag so na primeira
  assert.deepEqual(f.map((x) => x.coberta), [false, true, true, true, false, false]);
  assert.deepEqual(f.map((x) => x.quebra), [false, false, false, true, false, true]);
  assert.deepEqual(f.map((x) => x.corte), [false, false, false, false, true, false]); // pedaco novo em 3 s
  assert.deepEqual(f.map((x) => x.preco), [false, false, false, false, false, true]);
  const q = quadros(r);
  assert.equal(q.length, 2);
  assert.deepEqual(q[0], { de: 0, broll: "Academia", leak: true, legenda: "", preco: false }); // meio em 1,5 s: B-roll
  assert.equal(q[1]!.broll, undefined);
  assert.equal(q[1]!.leak, false);
});

test("so a selecao: acha a variacao do clipe selecionado e protege as outras do corte de pausas", async () => {
  const { planejarCortes } = await import("../src/pausas.ts");
  const vars = [{ inicioQ: 0, fimQ: 250 }, { inicioQ: 300, fimQ: 550 }, { inicioQ: 600, fimQ: 850 }]; // 0-10, 12-22, 24-34 s
  assert.deepEqual(variacoesDaSelecao(vars, FPS, [{ inicio: 13, fim: 15 }]), [1]);
  assert.deepEqual(variacoesDaSelecao(vars, FPS, [{ inicio: 9, fim: 12.5 }]), [0, 1]); // clipe na divisa
  assert.deepEqual(variacoesDaSelecao(vars, FPS, []), []);

  // Fala com pausas nas tres; so a do meio esta escolhida: so ela perde pausas.
  const fala = [w("a", 1, 2), w("b", 6, 7), w("c", 13, 14), w("d", 18, 19), w("e", 25, 26), w("f", 30, 31)].map((p) => ({ texto: p.text, inicio: p.inicio, fim: p.fim }));
  const plano = planejarCortes([...fala, ...protegerFora(vars, FPS, [1])], { fps: FPS, duracaoQ: 850, margemS: 0.2 });
  const dentro = (c: { inicioQ: number; fimQ: number }, v: { inicioQ: number; fimQ: number }) => c.inicioQ >= v.inicioQ && c.fimQ <= v.fimQ;
  assert.ok(plano.cortes.some((c) => dentro(c, vars[1]!)), "a escolhida perde a pausa do meio");
  assert.ok(!plano.cortes.some((c) => dentro(c, vars[0]!) || dentro(c, vars[2]!)), "as outras ficam inteiras");
});
