import assert from "node:assert/strict";
import { test } from "node:test";
import {
  conferirPalavras,
  deslocamentos,
  fonteDoTrecho,
  MARGEM_PADRAO_S,
  montarPalavras,
  planejarCortes,
  type Palavra,
} from "../src/pausas.ts";

const opcoes = { fps: 30, duracaoQ: 300, margemS: MARGEM_PADRAO_S };

test("corta a pausa entre duas palavras e mantem a margem dos dois lados", () => {
  // "ola" 1.0-1.5s, "mundo" 3.0-3.5s. Pausa de 1.5s a 3.0s.
  const palavras: Palavra[] = [
    { texto: "ola", inicio: 1, fim: 1.5 },
    { texto: "mundo", inicio: 3, fim: 3.5 },
  ];
  const plano = planejarCortes(palavras, opcoes);

  // Cabeca (0 ate 1.0-0.08), a pausa do meio e a cauda = 3 cortes.
  assert.equal(plano.cortes.length, 3, "cabeca, meio e cauda");
  const meio = plano.cortes[1]!;
  // 1.5+0.08 = 1.58s -> quadro 47.4 -> arredonda PARA DENTRO da pausa = 48
  assert.equal(meio.inicioQ, 48);
  // 3.0-0.08 = 2.92s -> quadro 87.6 -> arredonda PARA DENTRO da pausa = 87
  assert.equal(meio.fimQ, 87);
  assert.equal(meio.antes, "ola");
  assert.equal(meio.depois, "mundo");
});

test("palavras encostadas nao geram corte", () => {
  const palavras: Palavra[] = [
    { texto: "e", inicio: 1, fim: 1.09 },
    { texto: "exatamente", inicio: 1.09, fim: 1.96 },
  ];
  const plano = planejarCortes(palavras, opcoes);
  const entrePalavras = plano.cortes.filter((c) => c.antes !== "" && c.depois !== "");
  assert.deepEqual(entrePalavras, []);
});

test("pausa com menos de 2 quadros removiveis fica inteira", () => {
  // Pausa de 0.20s: tirando 0.08 de cada lado sobra 0.04s = 1.2 quadros.
  const palavras: Palavra[] = [
    { texto: "um", inicio: 1, fim: 1.5 },
    { texto: "dois", inicio: 1.7, fim: 2.2 },
  ];
  const plano = planejarCortes(palavras, opcoes);
  const entrePalavras = plano.cortes.filter((c) => c.antes !== "" && c.depois !== "");
  assert.deepEqual(entrePalavras, []);
});

test("corta o silencio antes da primeira e depois da ultima palavra", () => {
  const palavras: Palavra[] = [{ texto: "so", inicio: 2, fim: 2.5 }];
  const plano = planejarCortes(palavras, opcoes);

  const cabeca = plano.cortes[0]!;
  assert.equal(cabeca.inicioQ, 0);
  assert.equal(cabeca.antes, "");
  // 2.0-0.08 = 1.92s -> 57.6 -> 57
  assert.equal(cabeca.fimQ, 57);

  const cauda = plano.cortes[plano.cortes.length - 1]!;
  // 2.5+0.08 = 2.58s -> 77.4 -> 78
  assert.equal(cauda.inicioQ, 78);
  assert.equal(cauda.fimQ, 300);
  assert.equal(cauda.depois, "");
});

test("os trechos que ficam sao colados um no outro a partir do quadro 0", () => {
  const palavras: Palavra[] = [
    { texto: "ola", inicio: 1, fim: 1.5 },
    { texto: "mundo", inicio: 3, fim: 3.5 },
  ];
  const plano = planejarCortes(palavras, opcoes);

  assert.equal(plano.trechos[0]!.destinoQ, 0);
  for (let i = 1; i < plano.trechos.length; i++) {
    const anterior = plano.trechos[i - 1]!;
    const atual = plano.trechos[i]!;
    assert.equal(atual.destinoQ, anterior.destinoQ + (anterior.fimQ - anterior.inicioQ));
  }
  const somaDosTrechos = plano.trechos.reduce((t, s) => t + (s.fimQ - s.inicioQ), 0);
  assert.equal(plano.duracaoDepoisQ, somaDosTrechos);
  assert.ok(plano.duracaoDepoisQ < plano.duracaoAntesQ);
});

test("sem palavra nenhuma nao ha plano: nada e cortado", () => {
  const plano = planejarCortes([], opcoes);
  assert.deepEqual(plano.cortes, []);
  assert.deepEqual(plano.trechos, []);
});

test("palavras fora de ordem ou sobrepostas nao geram corte negativo", () => {
  const palavras: Palavra[] = [
    { texto: "um", inicio: 1, fim: 2 },
    { texto: "dois", inicio: 1.5, fim: 2.5 },
  ];
  const plano = planejarCortes(palavras, opcoes);
  for (const c of plano.cortes) assert.ok(c.fimQ > c.inicioQ, `corte invalido: ${JSON.stringify(c)}`);
});

const umQuadro = 1 / 30;

test("conferirPalavras aprova quando toda palavra continua inteira", () => {
  const antes: Palavra[] = [
    { texto: "ola", inicio: 1, fim: 1.5 },
    { texto: "mundo", inicio: 3, fim: 3.5 },
  ];
  const depois: Palavra[] = [
    { texto: "ola", inicio: 0.08, fim: 0.58 },
    { texto: "mundo", inicio: 0.74, fim: 1.24 },
  ];
  const r = conferirPalavras(antes, depois, umQuadro);
  assert.equal(r.ok, true);
  assert.match(r.linhas.join("\n"), /2 de 2 palavras inteiras/);
});

test("conferirPalavras reprova palavra que sumiu", () => {
  const antes: Palavra[] = [
    { texto: "ola", inicio: 1, fim: 1.5 },
    { texto: "mundo", inicio: 3, fim: 3.5 },
  ];
  const depois: Palavra[] = [{ texto: "ola", inicio: 0.08, fim: 0.58 }];
  const r = conferirPalavras(antes, depois, umQuadro);
  assert.equal(r.ok, false);
  assert.match(r.linhas.join("\n"), /mundo/);
});

test("conferirPalavras reprova palavra encurtada alem da tolerancia", () => {
  const antes: Palavra[] = [{ texto: "saude", inicio: 1, fim: 1.5 }];
  const depois: Palavra[] = [{ texto: "saude", inicio: 0.08, fim: 0.4 }];
  const r = conferirPalavras(antes, depois, umQuadro);
  assert.equal(r.ok, false);
  assert.match(r.linhas.join("\n"), /saude/);
});

test("conferirPalavras aceita diferenca de um quadro", () => {
  const antes: Palavra[] = [{ texto: "saude", inicio: 1, fim: 1.5 }];
  const depois: Palavra[] = [{ texto: "saude", inicio: 0.08, fim: 0.58 - umQuadro }];
  assert.equal(conferirPalavras(antes, depois, umQuadro).ok, true);
});

test("montarPalavras converte a transcricao do Auto B-roll e descarta palavra sem duracao", () => {
  const entrada = [
    { text: "ola", inicio: 1, fim: 1.5 },
    { text: "vazia", inicio: 2, fim: 2 },
    { text: "mundo", inicio: 3, fim: 3.5 },
  ];
  assert.deepEqual(montarPalavras(entrada), [
    { texto: "ola", inicio: 1, fim: 1.5 },
    { texto: "mundo", inicio: 3, fim: 3.5 },
  ]);
});

test("deslocamentos diz quanto cada trecho anda para tras", () => {
  const plano = planejarCortes(
    [
      { texto: "ola", inicio: 1, fim: 1.5 },
      { texto: "mundo", inicio: 3, fim: 3.5 },
    ],
    opcoes
  );
  const ds = deslocamentos(plano);
  assert.equal(ds.length, plano.trechos.length);
  for (const d of ds) assert.ok(d.andarQ >= 0, "nenhum trecho anda para frente");
  assert.equal(ds[0]!.andarQ, plano.trechos[0]!.inicioQ, "o primeiro anda o tamanho da cabeca cortada");
});

test("fonteDoTrecho devolve o instante da midia que cada trecho tem de mostrar", () => {
  // Clipe comeca na timeline em 0s, mostrando a midia a partir de 10s.
  assert.equal(fonteDoTrecho({ baseInicioQ: 0, baseFonteQ: 300 }, 90), 390);
  // Clipe que comeca em 1s na timeline: o trecho em 91 esta 90 quadros adiante.
  assert.equal(fonteDoTrecho({ baseInicioQ: 30, baseFonteQ: 300 }, 120), 390);
});
