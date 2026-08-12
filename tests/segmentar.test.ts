import { test } from "node:test";
import assert from "node:assert/strict";

import { segmentar, validar } from "../src/segmentar.ts";
import { PRESET_PADRAO } from "../src/preset.ts";
import type { PalavraRevisada } from "../src/texto.ts";

/** Uma palavra por segundo. `|` no fim marca eos. */
function palavras(frase: string): PalavraRevisada[] {
  return frase.split(" ").map((bruto, i) => {
    const eos = bruto.endsWith("|");
    return {
      text: eos ? bruto.slice(0, -1) : bruto,
      inicio: i,
      fim: i + 1,
      confidence: 1,
      eos,
      sugestao: null,
      motivo: null,
    };
  });
}

const seg = (frase: string, cortes: number[] = []): ReturnType<typeof segmentar> =>
  segmentar(palavras(frase), cortes, PRESET_PADRAO);

test("frase curta vira um bloco so", () => {
  const blocos = seg("MEU NOME É CRISTIANO|");
  assert.equal(blocos.length, 1);
  assert.equal(blocos[0]?.texto, "MEU NOME É CRISTIANO");
});

test("corte de video quebra o bloco mesmo cabendo no orcamento", () => {
  // "MEU NOME" cai no clipe 1, "E CRISTIANO" cai no clipe 2 (corte em 2s).
  // Frase inteira cabe facil no orcamento de 32 caracteres: sem a quebra
  // forcada pelo corte, vira um bloco so e blocosParaTranscricao jogaria as
  // palavras do segundo clipe fora (achado do code-review em pipeline.ts:96).
  const blocos = seg("MEU NOME É CRISTIANO|", [2]);
  assert.ok(blocos.length > 1, "corte nao quebrou o bloco");
  for (const bloco of blocos) {
    assert.ok(bloco.fim <= 2 || bloco.inicio >= 2, `bloco atravessa o corte: "${bloco.texto}"`);
  }
  assert.equal(blocos.map((b) => b.texto).join(" "), "MEU NOME É CRISTIANO");
});

test("cada eos abre um bloco novo", () => {
  const blocos = seg("PRIMEIRA FRASE| SEGUNDA FRASE|");
  assert.equal(blocos.length, 2);
  assert.equal(blocos[0]?.texto, "PRIMEIRA FRASE");
  assert.equal(blocos[1]?.texto, "SEGUNDA FRASE");
});

test("o tempo do bloco acompanha a primeira e a ultima palavra", () => {
  const blocos = seg("PRIMEIRA FRASE| SEGUNDA FRASE|");
  assert.equal(blocos[0]?.inicio, 0);
  assert.equal(blocos[0]?.fim, 2);
  assert.equal(blocos[1]?.inicio, 2);
  assert.equal(blocos[1]?.fim, 4);
});

test("caso 13 da spec: nenhum bloco tem quebra de linha", () => {
  for (const bloco of seg("UMA FRASE BEM LONGA QUE PRECISA SER PARTIDA EM VARIOS BLOCOS AQUI|")) {
    assert.ok(!bloco.texto.includes("\n"));
  }
});

test("frase longa e partida respeitando o orcamento de caracteres", () => {
  const blocos = seg("VOCE PRECISA ENTENDER O QUE ESTA ACONTECENDO COM O SEU CORPO AGORA|");
  assert.ok(blocos.length > 1);
  for (const bloco of blocos) {
    assert.ok(
      bloco.texto.length <= PRESET_PADRAO.maxCaracteres,
      `bloco estourou o orcamento: "${bloco.texto}" (${bloco.texto.length})`
    );
  }
});

test("nenhuma palavra e cortada ao meio", () => {
  const original = "VOCE PRECISA ENTENDER O QUE ESTA ACONTECENDO COM O SEU CORPO AGORA";
  const juntos = seg(`${original}|`).map((b) => b.texto).join(" ");
  assert.equal(juntos, original);
});

test("pausa longa quebra a frase mesmo sem eos", () => {
  const ps: PalavraRevisada[] = [
    { text: "ANTES", inicio: 0, fim: 1, confidence: 1, eos: false, sugestao: null, motivo: null },
    { text: "DEPOIS", inicio: 5, fim: 6, confidence: 1, eos: false, sugestao: null, motivo: null },
  ];
  const blocos = segmentar(ps, [], PRESET_PADRAO);
  assert.equal(blocos.length, 2);
});

test("confianca baixa marca o bloco para revisao", () => {
  const ps: PalavraRevisada[] = [
    { text: "TALVEZ", inicio: 0, fim: 1, confidence: 0.3, eos: true, sugestao: null, motivo: null },
  ];
  const blocos = segmentar(ps, [], PRESET_PADRAO);
  assert.equal(blocos[0]?.precisaRevisao, true);
  assert.ok(blocos[0]?.motivos.length);
});

test("sugestao pendente marca o bloco para revisao", () => {
  const ps: PalavraRevisada[] = [
    { text: "EQUIVALENTE", inicio: 0, fim: 1, confidence: 1, eos: true, sugestao: "Estivalet", motivo: "contexto" },
  ];
  const blocos = segmentar(ps, [], PRESET_PADRAO);
  assert.equal(blocos[0]?.precisaRevisao, true);
});

test("caso 4 da spec: preco sai isolado, com REAIS", () => {
  const blocos = seg("HOJE TÁ POR CENTO E NOVENTA E SETE|");
  assert.deepEqual(blocos.map((b) => b.texto), ["HOJE TÁ POR", "197 REAIS"]);
  assert.deepEqual(blocos.map((b) => b.estilo), ["normal", "preco"]);
});

test("caso 5 da spec: dois precos, cada um no seu bloco", () => {
  const blocos = seg("DE MIL POR CENTO E NOVENTA E SETE|");
  assert.deepEqual(blocos.map((b) => b.texto), ["DE", "1.000 REAIS", "POR", "197 REAIS"]);
  assert.deepEqual(blocos.map((b) => b.estilo), ["normal", "preco", "normal", "preco"]);
});

test("caso 7 da spec: numero que nao e preco fica no texto normal", () => {
  const blocos = seg("MAIS DE MIL HOMENS|");
  assert.equal(blocos.length, 1);
  assert.equal(blocos[0]?.texto, "MAIS DE MIL HOMENS");
  assert.equal(blocos[0]?.estilo, "normal");
});

test("o preco ocupa o tempo em que o valor e falado", () => {
  // "HOJE TÁ POR CENTO E NOVENTA E SETE": o valor comeca na palavra 3.
  const blocos = seg("HOJE TÁ POR CENTO E NOVENTA E SETE|");
  const preco = blocos[1];
  assert.equal(preco?.inicio, 3);
  assert.equal(preco?.fim, 8);
});

test("nenhum bloco mistura preco com texto normal", () => {
  for (const bloco of seg("A CONSULTA CUSTA MIL NOVECENTOS E NOVENTA E SETE|")) {
    const temReais = bloco.texto.includes("REAIS");
    assert.equal(temReais, bloco.estilo === "preco");
  }
});

test("preco confirmado por reais nao deixa a palavra sobrando", () => {
  // Achado real: "reais" confirmava o preco mas ficava de fora do fim do
  // Numeral, sobrando como bloco normal solto (preco.ts, MOEDA.has).
  const blocos = seg("SÃO CENTO E NOVENTA E SETE REAIS POR MES|");
  const soltos = blocos.filter((b) => b.estilo === "normal" && /\bREAIS\b/.test(b.texto));
  assert.equal(soltos.length, 0, `"reais" vazou para fora do bloco de preco: ${JSON.stringify(blocos)}`);
});

test("corte no meio de um preco nao o quebra", () => {
  // Preco e hard boundary: nem orcamento nem corte de video pode partir.
  const blocos = seg("SÃO CENTO E NOVENTA E SETE REAIS|", [6]);
  const precos = blocos.filter((b) => b.estilo === "preco");
  assert.equal(precos.length, 1);
  assert.equal(precos[0]?.texto, "197 REAIS");
});

test("preco de certeza media marca revisao", () => {
  const blocos = seg("POR CENTO E NOVENTA E SETE|");
  const preco = blocos.find((b) => b.estilo === "preco");
  assert.ok(preco);
  assert.equal(preco.precisaRevisao, true);
});

test("D-15: ponto final some, interrogacao fica, 1.000 nao e tocado", () => {
  assert.equal(seg("BOMBA RELOGIO.|")[0]?.texto, "BOMBA RELOGIO");
  assert.equal(seg("VAI ENFRENTAR ISSO?|")[0]?.texto, "VAI ENFRENTAR ISSO?");
  // Digito com ponto de milhar termina em digito; a limpeza nao alcanca.
  assert.equal(seg("PAGUE 1.000|")[0]?.texto.endsWith("1.000"), true);
});

test("caso 12 da spec: virgula na fronteira do bloco some", () => {
  const blocos = seg("SE VOCE CONTINUAR ASSIM, O PROBLEMA PODE PIORAR MUITO MESMO|");
  assert.ok(blocos.length > 1);
  for (const bloco of blocos) {
    assert.ok(!bloco.texto.endsWith(","), `bloco terminou em virgula: "${bloco.texto}"`);
  }
});

test("nenhum bloco comeca com virgula", () => {
  for (const bloco of seg("SE VOCE CONTINUAR ASSIM, O PROBLEMA PODE PIORAR MUITO MESMO|")) {
    assert.ok(!bloco.texto.startsWith(","));
  }
});

test("virgula no meio do bloco sobrevive", () => {
  const blocos = seg("ASSIM, PIORA|");
  assert.equal(blocos.length, 1);
  assert.equal(blocos[0]?.texto, "ASSIM, PIORA");
});

test("validar aprova uma saida correta", () => {
  assert.deepEqual(validar(seg("HOJE TÁ POR CENTO E NOVENTA E SETE|")), []);
});

test("validar reprova bloco com quebra de linha", () => {
  const violacoes = validar([
    { texto: "DUAS\nLINHAS", inicio: 0, fim: 1, estilo: "normal", precisaRevisao: false, motivos: [] },
  ]);
  assert.equal(violacoes.length, 1);
  assert.ok(violacoes[0]?.includes("linha"));
});

test("validar reprova preco misturado com texto normal", () => {
  const violacoes = validar([
    { texto: "CUSTA 197 REAIS", inicio: 0, fim: 1, estilo: "normal", precisaRevisao: false, motivos: [] },
  ]);
  assert.equal(violacoes.length, 1);
});

test("validar reprova bloco que estourou o orcamento", () => {
  const violacoes = validar([
    {
      texto: "UM BLOCO ABSURDAMENTE LONGO QUE JAMAIS CABERIA EM UMA LINHA SO",
      inicio: 0,
      fim: 1,
      estilo: "normal",
      precisaRevisao: false,
      motivos: [],
    },
  ]);
  assert.equal(violacoes.length, 1);
});

test("com corte perto de uma quebra possivel, a quebra vai para o corte", () => {
  // Uma palavra por segundo. Sem corte, o orcamento parte em outro ponto.
  const frase = "VOCE PRECISA ENTENDER O QUE ESTA ACONTECENDO AGORA|";
  const semCorte = seg(frase);
  const comCorte = seg(frase, [3]);

  // Com o corte em 3s, existe um bloco que termina exatamente ali.
  assert.ok(comCorte.some((b) => b.fim === 3), "nenhum bloco terminou no corte");
  assert.notDeepEqual(comCorte.map((b) => b.texto), semCorte.map((b) => b.texto));
});

test("corte fora da tolerancia nao move a quebra", () => {
  const frase = "VOCE PRECISA ENTENDER O QUE ESTA ACONTECENDO AGORA|";
  assert.deepEqual(
    seg(frase, [100]).map((b) => b.texto),
    seg(frase).map((b) => b.texto)
  );
});

test("o corte nunca faz a legenda aparecer antes da fala", () => {
  const frase = "VOCE PRECISA ENTENDER O QUE ESTA ACONTECENDO AGORA|";
  for (const bloco of seg(frase, [3])) {
    assert.ok(bloco.inicio >= 0);
    assert.ok(bloco.fim > bloco.inicio);
  }
});

test("o corte nao pode estourar o orcamento de caracteres", () => {
  const frase = "VOCE PRECISA ENTENDER O QUE ESTA ACONTECENDO AGORA COM O SEU CORPO|";
  for (const bloco of seg(frase, [2, 5, 9])) {
    assert.ok(bloco.texto.length <= PRESET_PADRAO.maxCaracteres, `estourou: "${bloco.texto}"`);
  }
});

test("o corte nao perde nem duplica palavra", () => {
  const original = "VOCE PRECISA ENTENDER O QUE ESTA ACONTECENDO AGORA COM O SEU CORPO";
  assert.equal(seg(`${original}|`, [2, 5, 9]).map((b) => b.texto).join(" "), original);
});
