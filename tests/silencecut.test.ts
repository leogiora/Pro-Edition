import assert from "node:assert/strict";
import { test } from "node:test";

import { montarPrevia } from "../src/silencecut.ts";

test("montarPrevia: cortes em segundos, palavras vizinhas, confira no corte longo e duracao final", () => {
  const fps = 25;
  const fala = (texto: string, inicio: number, fim: number) => ({ texto, inicio, fim, motivo: "fala" as const });
  const previa = montarPrevia(
    {
      nomeSequencia: "Bruta",
      fps,
      duracaoQ: 250, // 10 s
      clipes: 1,
      clipesQ: [{ inicioQ: 0, fimQ: 250, midiaQ: 0, fonte: 0 }],
      palavras: [1, 2, 3],
      blocos: [fala("bom dia", 1, 2), fala("tudo bem", 2.4, 3), { texto: "", inicio: 6, fim: 6.5, motivo: "voz-sem-palavra" as const }],
    },
    0.1
  );
  assert.equal(previa.antesS, 10);
  assert.equal(previa.protegidos, 1);
  // pausas: 0-0,9 / 2,1-2,3 / 3,1-5,9 / 6,6-10
  assert.deepEqual(
    previa.cortes.map((c) => [c.antes, c.depois, c.confira]),
    [
      ["…", "bom", false],
      ["dia", "tudo", false],
      ["bem", "…", true], // 2,8 s: confira
      ["…", "…", true],
    ]
  );
  assert.ok(Math.abs(previa.depoisS - 2.7) < 0.15, `depois ${previa.depoisS}`); // fica 0,9-2,1 + 2,3-3,1 + 5,9-6,6 (o corte arredonda para dentro do quadro)
});
