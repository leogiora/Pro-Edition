/*
 * Teste de fumaca: carrega o painel construido (dist/index.html) numa VM sem
 * nenhum global de navegador alem do basico, com `premierepro`, `uxp` e
 * `document` falsos. Pega o erro que deixa o painel EM BRANCO no Premiere —
 * um global que o UXP nao tem sendo usado no topo de um modulo (ex.:
 * `new TextEncoder()`, 2026-09-24) — sem precisar reiniciar o Premiere.
 *
 *   node scripts/fumaca-uxp.cjs                      (painel do Pro Edition)
 *   node scripts/fumaca-uxp.cjs ferramentas/pro-captions/dist/index.html
 */
const vm = require("node:vm");
const fs = require("node:fs");

function fundo(nome) {
  const f = function () {};
  return new Proxy(f, {
    get: (_, k) => (k === Symbol.toPrimitive ? () => "" : k === "then" ? undefined : fundo(`${nome}.${String(k)}`)),
    apply: () => fundo(`${nome}()`),
    construct: () => fundo(`new ${nome}`),
  });
}

const faltando = new Set();
const base = {
  console, setTimeout, clearTimeout, Promise, Math, JSON, Date, Array, Object, String, Number, Boolean,
  RegExp, Error, TypeError, RangeError, Map, Set, WeakMap, Symbol, Uint8Array, DataView, ArrayBuffer,
  Int16Array, Float32Array, parseInt, parseFloat, isFinite, encodeURIComponent, decodeURIComponent,
  encodeURI, decodeURI, Proxy, Reflect,
  fetch: () => Promise.reject(new Error("sem rede no teste")),
  require: (m) => fundo(m),
  document: fundo("document"),
};
const ctx = new Proxy(base, {
  has: () => true,
  get: (t, k) => {
    if (k in t) return t[k];
    if (typeof k === "string") faltando.add(k);
    return undefined;
  },
});

const arquivo = process.argv[2] ?? "dist/index.html";
const html = fs.readFileSync(arquivo, "utf8");
const js = html.slice(html.indexOf("<script>") + 8, html.lastIndexOf("</script>"));
try {
  vm.runInContext(js, vm.createContext(ctx));
  console.log(`${arquivo}: carregou sem erro`);
} catch (e) {
  console.log(`${arquivo}: ERRO ao carregar — ${e.message}`);
  process.exitCode = 1;
}
const extras = [...faltando].filter((k) => !["window", "self", "globalThis"].includes(k));
if (extras.length) console.log(`globais que o painel leu e nao existem aqui: ${extras.join(", ")}`);
