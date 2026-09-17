import { test } from "node:test";
import assert from "node:assert/strict";

import { analisar, type EntradaAnalise } from "../src/analise.ts";
import type { ClipeComOrigem } from "../src/transcript.ts";

const BIBLIOTECA = [
  "Viagra (1).mp4",
  "Viagra (2).mp4",
  "Falhou na cama (12).mp4",
  "Teleconsulta (7).mp4",
  "Vasos sanguíneos (3).mp4",
  "IMG_1190.MOV",
];

function transcricao(palavras: Array<[string, number, boolean?]>): string {
  return JSON.stringify({
    language: "pt-br",
    segments: [
      {
        start: 0,
        duration: 60,
        speaker: "a",
        words: palavras.map(([text, start, eos]) => ({
          text,
          start,
          duration: 0.4,
          confidence: 1,
          eos: eos === true,
          type: "word",
        })),
      },
    ],
  });
}

const CLIPE_INTEIRO: ClipeComOrigem = {
  sourceName: "IMG_1190.MOV",
  startSeconds: 0,
  endSeconds: 60,
  inPointSeconds: 0,
  outPointSeconds: 60,
  speed: 1,
};

function entrada(json: string, extra: Partial<EntradaAnalise> = {}): EntradaAnalise {
  return {
    clipes: [CLIPE_INTEIRO],
    transcricoesJson: new Map([["IMG_1190.MOV", json]]),
    biblioteca: BIBLIOTECA,
    ...extra,
  };
}

test("analisar: encontra a oportunidade e explica o motivo", () => {
  const a = analisar(
    entrada(transcricao([["Muitos", 0], ["homens", 0.5], ["falharam", 1], ["na", 1.5], ["cama", 2, true]]))
  );
  assert.equal(a.oportunidades.length, 1);
  const primeira = a.oportunidades[0];
  assert.equal(primeira?.sugestoes[0]?.conceito.rotulo, "Falhou na cama");
  assert.match(primeira?.sugestoes[0]?.motivo ?? "", /Falhou na cama/);
});

test("analisar: conta conceitos distintos, nao arquivos", () => {
  // 6 arquivos, 5 conceitos: as duas variacoes de Viagra contam uma vez.
  const a = analisar(entrada(transcricao([["oi", 0, true]])));
  assert.equal(a.conceitos.length, 5);
});

test("analisar: frase curta demais nao vira oportunidade", () => {
  const a = analisar(entrada(transcricao([["viagra", 0, true]]), { duracaoMinima: 5 }));
  assert.equal(a.oportunidades.length, 0);
});

test("analisar: frase sem conceito relacionado nao vira oportunidade", () => {
  const a = analisar(transcricaoLonga("bom dia pessoal tudo certo por aqui hoje"));
  assert.equal(a.oportunidades.length, 0);
});

test("analisar: sem transcricao nenhuma, avisa em vez de devolver vazio silencioso", () => {
  const a = analisar({ clipes: [CLIPE_INTEIRO], transcricoesJson: new Map(), biblioteca: BIBLIOTECA });
  assert.equal(a.oportunidades.length, 0);
  assert.match(a.avisos.join(" "), /Nenhuma midia da timeline tem transcricao/);
});

test("analisar: transcricao ilegivel vira aviso, nao excecao", () => {
  const a = analisar(entrada("{quebrado"));
  assert.match(a.avisos.join(" "), /ilegivel/);
});

test("analisar: confianca baixa marca o trecho como incerto", () => {
  const json = JSON.stringify({
    segments: [
      {
        words: [
          { text: "vasos", start: 0, duration: 0.4, confidence: 0.3, eos: false, type: "word" },
          { text: "sanguineos", start: 0.5, duration: 0.4, confidence: 0.9, eos: true, type: "word" },
        ],
      },
    ],
  });
  const a = analisar(entrada(json, { duracaoMinima: 0 }));
  assert.equal(a.oportunidades.length, 1);
  assert.match(a.avisos.join(" "), /Trecho incerto/);
});

test("analisar: score abaixo do minimo e descartado", () => {
  // "cama" sozinha casa parcialmente com "Falhou na cama" (score 0,5).
  const json = transcricao([["comprei", 0], ["uma", 0.5], ["cama", 1], ["nova", 1.5, true]]);
  assert.equal(analisar(entrada(json, { scoreMinimo: 0.9 })).oportunidades.length, 0);
  assert.equal(analisar(entrada(json, { scoreMinimo: 0.4 })).oportunidades.length, 1);
});

test("analisar: so conta as palavras que sobreviveram ao corte", () => {
  const json = transcricao([["antes", 0], ["dentro", 30], ["depois", 55, true]]);
  const a = analisar({
    clipes: [
      { sourceName: "IMG_1190.MOV", startSeconds: 0, endSeconds: 10, inPointSeconds: 29, outPointSeconds: 39, speed: 1 },
    ],
    transcricoesJson: new Map([["IMG_1190.MOV", json]]),
    biblioteca: BIBLIOTECA,
  });
  assert.equal(a.palavras, 1);
});

test("analisar: ligacao ensinada alcanca o que o dicionario nao alcanca", () => {
  const json = transcricao([["mangueira", 0], ["do", 0.5], ["jardim", 1], ["dobrada", 1.5, true]]);

  // Sem a ligacao, nada casa: nenhum conceito fala de mangueira.
  assert.equal(analisar(entrada(json)).oportunidades.length, 0);

  const a = analisar(
    entrada(json, { ligacoes: new Map([["Vasos sanguíneos", ["mangueira"]]]) })
  );
  assert.equal(a.oportunidades.length, 1);
  const sugestao = a.oportunidades[0]?.sugestoes[0];
  assert.equal(sugestao?.conceito.rotulo, "Vasos sanguíneos");
  assert.match(sugestao?.motivo ?? "", /voce ensinou/);
  // Ancora no proprio termo aprendido, para o corte cair na palavra certa.
  assert.deepEqual(sugestao?.termosCasados, ["mangueira"]);
});

test("analisar: casamento por texto tem precedencia sobre o aprendido", () => {
  const json = transcricao([["viagra", 0], ["resolve", 0.5], ["tudo", 1, true]]);
  const a = analisar(entrada(json, { ligacoes: new Map([["Viagra", ["resolve"]]]) }));
  // Nao pode virar duas sugestoes do mesmo conceito.
  const viagra = a.oportunidades[0]?.sugestoes.filter((s) => s.conceito.rotulo === "Viagra");
  assert.equal(viagra?.length, 1);
  assert.equal(viagra?.[0]?.score, 1, "o texto literal continua valendo mais");
});

function transcricaoLonga(texto: string): EntradaAnalise {
  const palavras: Array<[string, number, boolean?]> = texto
    .split(" ")
    .map((p, i) => [p, i * 0.4, i === texto.split(" ").length - 1]);
  return entrada(transcricao(palavras));
}
