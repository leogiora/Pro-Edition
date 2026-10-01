import assert from "node:assert/strict";
import { test } from "node:test";

import { lerEstadoPremiere, tempoDoCursor } from "../src/premiere-ao-vivo.ts";

test("lerEstadoPremiere: aceita o que o plugin manda e recusa lixo", () => {
  assert.deepEqual(lerEstadoPremiere({ projeto: "Andro", sequencia: "Reels", cursorS: 14.25, selecionados: 2, quando: 1 }), {
    projeto: "Andro",
    sequencia: "Reels",
    cursorS: 14.25,
    selecionados: 2,
    quando: 1,
  });
  // Sem sequencia aberta: so o projeto.
  assert.equal(lerEstadoPremiere({ projeto: "Andro", sequencia: null, cursorS: null, selecionados: 0, quando: 5 })?.sequencia, null);
  assert.equal(lerEstadoPremiere(null), null);
  assert.equal(lerEstadoPremiere({ sequencia: "Reels" }), null); // sem "quando"
  const sujo = lerEstadoPremiere({ sequencia: 3, cursorS: -1, selecionados: "x", quando: 9 });
  assert.deepEqual(sujo, { projeto: null, sequencia: null, cursorS: null, selecionados: 0, quando: 9 });
});

test("tempoDoCursor: minutos e segundos com decimo", () => {
  assert.equal(tempoDoCursor(14.25), "00:14.2");
  assert.equal(tempoDoCursor(75), "01:15.0");
  assert.equal(tempoDoCursor(0), "00:00.0");
  assert.equal(tempoDoCursor(6866.95), "1:54:26.9"); // a Live 30.09 tem quase 2 h
});
