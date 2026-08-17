import assert from "node:assert/strict";
import { test } from "node:test";
import { escolherTela, extrairCorpo, type Tela } from "../src/shell.ts";

test("escolherTela devolve a tela certa do registro", () => {
  const semAcao = () => {};
  const registro = {
    seletor: { html: "<a>seletor</a>", css: "s", montar: semAcao } satisfies Tela,
    broll: { html: "<b>broll</b>", css: "b", montar: semAcao } satisfies Tela,
    captions: { html: "<c>captions</c>", css: "c", montar: semAcao } satisfies Tela,
  };

  assert.equal(escolherTela(registro, "seletor").html, "<a>seletor</a>");
  assert.equal(escolherTela(registro, "broll").html, "<b>broll</b>");
  assert.equal(escolherTela(registro, "captions").html, "<c>captions</c>");
});

test("extrairCorpo pega so o miolo entre <body> e a marca de script", () => {
  const doc =
    `<!DOCTYPE html><html><head><!--ESTILOS--></head>` +
    `<body class="x">  <div>ola</div>  <!--SCRIPT--></body></html>`;

  assert.equal(extrairCorpo(doc), "<div>ola</div>");
});

test("extrairCorpo lanca quando o HTML nao tem a marca esperada", () => {
  assert.throws(() => extrairCorpo("<html><body>sem marca</body></html>"));
});
