import assert from "node:assert/strict";
import { readFileSync } from "node:fs";
import { test } from "node:test";
import { desenharTrilhas, escolherTela, extrairCorpo, icone, marca, segmentos, type Icone, type Tela } from "../src/shell.ts";

test("marca: o simbolo do Cutline so com caixas, no tamanho pedido", () => {
  const html = marca(256);
  assert.equal(html.replace(/<[^>]*>/g, ""), "");
  assert.match(html, /width: 256\.00px; height: 256\.00px/);
  assert.equal((html.match(/#ff7d71/g) ?? []).length, 4); // cursor em 4 fatias
  assert.equal((html.match(/#eceef2/g) ?? []).length, 6); // 3 faixas cortadas
});

test("icone: todo icone e caixa na cor pedida, sem caractere (nada de emoji no UXP)", () => {
  for (const t of ["pausas", "broll", "split", "leak", "trilha", "legendas", "podcast"] as Icone[]) {
    const html = icone(t, "#123456");
    assert.match(html, /#123456/);
    assert.equal(html.replace(/<[^>]*>/g, ""), ""); // so tags, nenhum texto
  }
});

test("segmentos: vazio e item alternam; sobreposto comeca onde o anterior acaba; passa do fim e aparado", () => {
  assert.deepEqual(segmentos([{ de: 2, ate: 4 }, { de: 1, ate: 1.5 }, { de: 3.5, ate: 12 }], 10), [
    { grow: 100, de: 0, item: -1 },
    { grow: 50, de: 1, item: 1 },
    { grow: 50, de: 1.5, item: -1 },
    { grow: 200, de: 2, item: 0 },
    { grow: 600, de: 4, item: 2 },
  ]);
  assert.deepEqual(segmentos([], 3), [{ grow: 300, de: 0, item: -1 }]);
});

test("escolherTela devolve a tela certa do registro", () => {
  const semAcao = () => {};
  const registro = {
    seletor: { html: "<a>seletor</a>", css: "s", montar: semAcao } satisfies Tela,
    editar: { html: "<g>editar</g>", css: "g", montar: semAcao } satisfies Tela,
    pausas: { html: "<f>pausas</f>", css: "f", montar: semAcao } satisfies Tela,
    broll: { html: "<b>broll</b>", css: "b", montar: semAcao } satisfies Tela,
    captions: { html: "<c>captions</c>", css: "c", montar: semAcao } satisfies Tela,
    autocut: { html: "<d>autocut</d>", css: "d", montar: semAcao } satisfies Tela,
    autosplit: { html: "<e>autosplit</e>", css: "e", montar: semAcao } satisfies Tela,
  };

  assert.equal(escolherTela(registro, "seletor").html, "<a>seletor</a>");
  assert.equal(escolherTela(registro, "editar").html, "<g>editar</g>");
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
  assert.equal(notacoes.length, 6);
  for (const n of notacoes) desenharTrilhas(n);
});
