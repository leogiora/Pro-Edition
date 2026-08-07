import { test } from "node:test";
import assert from "node:assert/strict";

import { casar, conceitosDeArquivos, estaNaFrase, mesmaRaiz, radical, termos } from "../src/match.ts";

/** Nomes reais da biblioteca do usuario. */
const ARQUIVOS = [
  "Viagra (18).mp4",
  "Viagra (2).mp4",
  "Doutor (9).mp4",
  "Doutor (22).mp4",
  "Falhou na cama (12).mp4",
  "Teleconsulta (7).mp4",
  "Casal feliz (10).mp4",
  "Vasos sanguíneos (3).mp4",
  "Risco de infarto.mp4",
  "Academia.mp4",
];

test("conceitosDeArquivos: agrupa as variacoes num conceito so", () => {
  const conceitos = conceitosDeArquivos(ARQUIVOS);
  const viagra = conceitos.find((c) => c.rotulo === "Viagra");
  assert.equal(viagra?.arquivos.length, 2);
  const doutor = conceitos.find((c) => c.rotulo === "Doutor");
  assert.equal(doutor?.arquivos.length, 2);
  // 10 arquivos, 8 conceitos distintos.
  assert.equal(conceitos.length, 8);
});

test("conceitosDeArquivos: tira extensao e sufixo numerado", () => {
  const c = conceitosDeArquivos(["Casal feliz (10).mp4"]);
  assert.equal(c[0]?.rotulo, "Casal feliz");
});

test("conceitosDeArquivos: nome vazio nao vira conceito", () => {
  assert.deepEqual(conceitosDeArquivos([".mp4", "  "]), []);
});

test("termos: tira acento, pontuacao e palavras de parada", () => {
  assert.deepEqual(termos("Os vasos sanguíneos do coração!"), ["vaso", "sanguineo", "coracao"]);
});

test("termos: frase so de palavras de parada fica vazia", () => {
  assert.deepEqual(termos("e que com para"), []);
});

test("radical: resolve plural e terminacoes comuns", () => {
  assert.equal(radical("vasos"), "vaso");
  assert.equal(radical("coracoes"), "coracao");
  assert.equal(radical("homens"), "homem");
  // Curta demais nao mexe: evita destruir a palavra.
  assert.equal(radical("mas"), "mas");
});

test("casar: frase que contem o conceito inteiro pontua 1", () => {
  const conceitos = conceitosDeArquivos(ARQUIVOS);
  const s = casar("Eu tomei viagra e não funcionou", conceitos);
  assert.equal(s[0]?.conceito.rotulo, "Viagra");
  assert.equal(s[0]?.score, 1);
  assert.match(s[0]?.motivo ?? "", /contem "Viagra"/);
});

test("casar: conceito de varios termos exige todos para pontuar 1", () => {
  const conceitos = conceitosDeArquivos(ARQUIVOS);
  const completo = casar("ele falhou na cama de novo", conceitos);
  assert.equal(completo[0]?.conceito.rotulo, "Falhou na cama");
  assert.equal(completo[0]?.score, 1);

  // So "cama" nao basta para chegar a 1.
  const parcial = casar("comprei uma cama nova", conceitos);
  const achado = parcial.find((x) => x.conceito.rotulo === "Falhou na cama");
  assert.ok(achado !== undefined);
  assert.ok(achado.score < 1);
  assert.match(achado.motivo, /casou cama/);
});

test("casar: plural na fala casa com singular no arquivo", () => {
  const conceitos = conceitosDeArquivos(ARQUIVOS);
  const s = casar("os vasos sanguíneos ficam obstruídos", conceitos);
  assert.equal(s[0]?.conceito.rotulo, "Vasos sanguíneos");
  assert.equal(s[0]?.score, 1);
});

test("casar: frase sem relacao nao sugere nada", () => {
  const conceitos = conceitosDeArquivos(ARQUIVOS);
  assert.deepEqual(casar("bom dia pessoal tudo certo", conceitos), []);
});

test("casar: devolve no maximo o limite pedido", () => {
  const conceitos = conceitosDeArquivos(ARQUIVOS);
  assert.ok(casar("doutor viagra academia teleconsulta", conceitos, 2).length <= 2);
});

test("casar: empate prefere o conceito mais especifico", () => {
  const conceitos = conceitosDeArquivos(["Doutor.mp4", "Doutor de plantao.mp4"]);
  const s = casar("o doutor de plantao chegou", conceitos);
  // Ambos pontuam 1; o de dois termos e mais especifico e vem primeiro.
  assert.equal(s[0]?.conceito.rotulo, "Doutor de plantao");
});

test("casar: frase vazia nao sugere nada", () => {
  assert.deepEqual(casar("", conceitosDeArquivos(ARQUIVOS)), []);
});

// ------------------- casos reais medidos na sequencia do usuario -------------

test("mesmaRaiz: flexao da mesma palavra casa", () => {
  assert.equal(mesmaRaiz("frustracao", "frustrado"), true);
  assert.equal(mesmaRaiz("consulta", "consultorio"), true);
  assert.equal(mesmaRaiz("tratamento", "tratamento"), true);
});

test("mesmaRaiz: prefixo curto NAO casa — evita falso positivo", () => {
  // "tele" tem 4 letras: telemedicina e teleconsulta sao coisas diferentes.
  assert.equal(mesmaRaiz("tele", "teleconsulta"), false);
  assert.equal(mesmaRaiz("casa", "casal"), false);
  assert.equal(mesmaRaiz("mao", "maotam"), false);
  // O caso que obrigou o minimo a ser 6 e nao 5.
  assert.equal(mesmaRaiz("consulta", "consumo"), false);
});

test("casar: 'frustracao' na fala alcanca o conceito 'Frustrado'", () => {
  // 37 dos 260 arquivos sao "Frustrado" e antes nunca casavam.
  const conceitos = conceitosDeArquivos(["Frustrado (1).mp4", "Viagra (1).mp4"]);
  const s = casar("gerando frustração, brigas e distanciamento", conceitos);
  assert.equal(s[0]?.conceito.rotulo, "Frustrado");
});

test("casar: termo comum a varios conceitos pesa menos que termo raro", () => {
  // "homem" aparece em tres conceitos; "sanguineo" em um so.
  const conceitos = conceitosDeArquivos([
    "Corpo do homem.mp4",
    "Milhares de homens.mp4",
    "Jovem homem.mp4",
    "Vasos sanguíneos.mp4",
  ]);
  const soHomem = casar("o homem chegou", conceitos)[0];
  const raro = casar("os vasos sanguíneos entopem", conceitos)[0];
  assert.ok(soHomem !== undefined && raro !== undefined);
  assert.ok(
    raro.score > soHomem.score,
    `termo raro (${raro.score}) devia valer mais que comum (${soHomem.score})`
  );
});

test("casar: sinonimo alcanca 'Viagra' quando a fala diz 'disfuncao eretil'", () => {
  // 43 dos 260 arquivos. A fala nunca diz "viagra" nesta sequencia.
  const conceitos = conceitosDeArquivos(["Viagra (1).mp4", "Academia.mp4"]);
  const s = casar("Mais de 30 milhões de homens com disfunção erétil", conceitos);
  assert.equal(s[0]?.conceito.rotulo, "Viagra");
  assert.equal(s[0]?.score, 1);
});

test("casar: sinonimo alcanca 'Teleconsulta' quando a fala diz 'telemedicina'", () => {
  const conceitos = conceitosDeArquivos(["Teleconsulta (1).mp4", "Academia.mp4"]);
  const s = casar("você vai pagar só 197 da telemedicina da Andro Clinic", conceitos);
  assert.equal(s[0]?.conceito.rotulo, "Teleconsulta");
});

test("casar: sinonimo alcanca 'Doutor' quando a fala diz 'medico'", () => {
  const conceitos = conceitosDeArquivos(["Doutor (1).mp4", "Academia.mp4"]);
  assert.equal(casar("procure um médico de confiança", conceitos)[0]?.conceito.rotulo, "Doutor");
});

test("casar: o sintoma alcanca 'Desanimado', nao so 'Viagra'", () => {
  // Frase real da sequencia "Reels", em 10,76s. Antes so casava com Viagra.
  const conceitos = conceitosDeArquivos(["Viagra (1).mp4", "Desanimado (1).mp4"]);
  const rotulos = casar(
    "Mais de 30 milhões de homens com disfunção erétil ou ejaculação precoce",
    conceitos
  ).map((s) => s.conceito.rotulo);

  assert.ok(rotulos.includes("Desanimado"), `casou so com ${rotulos.join(", ")}`);
  assert.ok(rotulos.includes("Viagra"), "e Viagra continua casando");
});

test("casar: 'consulta online' e Teleconsulta, nunca Doutor", () => {
  // Frase real da sequencia "Reels". "consultorio" era sinonimo de Doutor, e a
  // raiz por prefixo comum o casava com "consulta" — 7 letras iguais.
  const conceitos = conceitosDeArquivos([
    "Doutor (1).mp4",
    "Teleconsulta (1).mp4",
    "Consulta médica (1).mp4",
  ]);
  const rotulos = casar(
    "e o proximo e voce atraves de uma consulta online e nos vamos descobrir as causas",
    conceitos
  ).map((s) => s.conceito.rotulo);

  assert.ok(!rotulos.includes("Doutor"), `Doutor nao devia estar em ${rotulos.join(", ")}`);
  assert.ok(rotulos.includes("Teleconsulta"), `Teleconsulta faltou em ${rotulos.join(", ")}`);
});

test("casar: quem fala 'consultorio' ainda chega em 'Consulta medica'", () => {
  const conceitos = conceitosDeArquivos(["Consulta médica (1).mp4", "Doutor (1).mp4"]);
  const rotulos = casar("marquei no consultorio medico ontem", conceitos).map(
    (s) => s.conceito.rotulo
  );
  assert.ok(rotulos.includes("Consulta médica"), "a ligacao boa nao pode ter se perdido");
});

test("casar: 'Desanimado' nao passou a casar com qualquer frase", () => {
  const conceitos = conceitosDeArquivos(["Desanimado (1).mp4"]);
  assert.deepEqual(casar("bom dia pessoal tudo certo por aqui hoje", conceitos), []);
  assert.deepEqual(casar("essa consulta custa mil reais", conceitos), []);
});

test("estaNaFrase: sinonimo tambem flexiona", () => {
  // "disfuncao" esta no dicionario; "disfuncoes" na fala deve alcancar.
  assert.equal(estaNaFrase("viagra", ["disfuncoes", "eretil"]), true);
});

test("estaNaFrase: termo sem sinonimo e sem raiz comum nao casa", () => {
  assert.equal(estaNaFrase("academia", ["cachorro", "janela"]), false);
});

test("casar: casar so pelo termo comum fica abaixo do corte de 50%", () => {
  const conceitos = conceitosDeArquivos([
    "Corpo do homem.mp4",
    "Milhares de homens.mp4",
    "Jovem homem.mp4",
  ]);
  // "Corpo do homem": "corpo" e raro (peso 1), "homem" e comum (peso 1/3).
  // Casar so "homem" da 0,25 — ruido que o corte padrao descarta.
  const s = casar("esse homem aqui", conceitos).find((x) => x.conceito.rotulo === "Corpo do homem");
  assert.ok(s !== undefined);
  assert.ok(s.score < 0.5, `esperado abaixo de 0,5, veio ${s.score}`);
});
