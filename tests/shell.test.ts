import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { desenharTrilhas, escolherTela, extrairCorpo, type Tela } from "../src/shell.ts";

test("escolherTela devolve a tela certa do registro", () => {
  const semAcao = () => {};
  const registro = {
    seletor: { html: "<a>seletor</a>", css: "s", montar: semAcao } satisfies Tela,
    pausas: { html: "<f>pausas</f>", css: "f", montar: semAcao } satisfies Tela,
    broll: { html: "<b>broll</b>", css: "b", montar: semAcao } satisfies Tela,
    captions: { html: "<c>captions</c>", css: "c", montar: semAcao } satisfies Tela,
    autocut: { html: "<d>autocut</d>", css: "d", montar: semAcao } satisfies Tela,
    autosplit: { html: "<e>autosplit</e>", css: "e", montar: semAcao } satisfies Tela,
  };

  assert.equal(escolherTela(registro, "seletor").html, "<a>seletor</a>");
  assert.equal(escolherTela(registro, "pausas").html, "<f>pausas</f>");
  assert.equal(escolherTela(registro, "broll").html, "<b>broll</b>");
  assert.equal(escolherTela(registro, "captions").html, "<c>captions</c>");
  assert.equal(escolherTela(registro, "autocut").html, "<d>autocut</d>");
  assert.equal(escolherTela(registro, "autosplit").html, "<e>autosplit</e>");
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

test("desenharTrilhas junta caracteres iguais num segmento e rejeita notacao errada", () => {
  const html = desenharTrilhas("V2 --##-|V1 =====");
  assert.equal((html.match(/class="trilha"/g) ?? []).length, 2);
  assert.match(html, /trilha-rotulo">V2</);
  assert.match(html, /seg-vazio" style="flex-grow: 2"><\/span><span class="seg seg-novo" style="flex-grow: 2"><\/span><span class="seg seg-vazio" style="flex-grow: 1"/);
  assert.match(html, /seg-base" style="flex-grow: 5"/);
  assert.throws(() => desenharTrilhas("V1 ==x=="));
  assert.throws(() => desenharTrilhas("V2 --#|V1 ===="));
});

test("toda miniatura do hall tem notacao valida e trilhas do mesmo tamanho", () => {
  const html = readFileSync(new URL("../src/ui/seletor.html", import.meta.url), "utf8");
  const notacoes = [...html.matchAll(/data-trilhas="([^"]+)"/g)].map((m) => m[1]!);
  assert.equal(notacoes.length, 5);
  for (const n of notacoes) desenharTrilhas(n);
});
