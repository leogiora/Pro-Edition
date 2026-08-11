/*
 * Andaime de preview no navegador para o painel Pro Captions. NAO faz parte
 * do produto: dubla `premierepro`/`uxp` com uma sequencia e midia fixas so
 * para o painel rodar fora do Premiere, sem reiniciar o app a cada troca.
 *
 * `npm run build` antes de usar — este servidor le dist/index.html, nao
 * observa mudancas.
 *
 * O stub e escrito como STRING de JS puro (nao objetos do Node serializados):
 * funcoes que fecham sobre variaveis do Node nao existiriam no browser.
 */
import { createServer } from "node:http";
import { readFile } from "node:fs/promises";
import { dirname, join } from "node:path";
import { fileURLToPath } from "node:url";

const RAIZ = dirname(dirname(fileURLToPath(import.meta.url)));
const PORTA = 8778;

const STUB_JS = `
<script>
console.log("[preview] montando stub premierepro/uxp");

const NOME_MIDIA = "Camera1.mp4";
const TRANSCRICAO_ORIGEM = JSON.stringify({
  language: "pt-BR",
  segments: [{
    start: 0, duration: 2.1, speaker: "SPEAKER_0",
    words: [
      { text: "Isso",    start: 0.0, duration: 0.4, confidence: 1, eos: false, type: "word" },
      { text: "e",       start: 0.4, duration: 0.3, confidence: 1, eos: false, type: "word" },
      { text: "um",      start: 0.7, duration: 0.3, confidence: 1, eos: false, type: "word" },
      { text: "teste",   start: 1.0, duration: 0.5, confidence: 1, eos: false, type: "word" },
      { text: "simples", start: 1.5, duration: 0.6, confidence: 1, eos: true,  type: "word" },
    ],
  }],
});

const projectItem = { name: NOME_MIDIA };
const acoesEscritas = [];

function trackItem() {
  return {
    getStartTime: async () => ({ seconds: 0 }),
    getEndTime: async () => ({ seconds: 6 }),
    getInPoint: async () => ({ seconds: 0 }),
    getOutPoint: async () => ({ seconds: 6 }),
    getSpeed: async () => 1,
    getProjectItem: async () => ({ name: NOME_MIDIA }),
  };
}

function sequenceObj() {
  return {
    name: "Sequencia de teste (preview)",
    getSettings: async () => ({ getVideoFrameRate: async () => ({ value: 29.97 }) }),
    getVideoTrackCount: async () => 1,
    getCaptionTrackCount: async () => 1,
    getVideoTrack: async (_i) => ({
      getTrackItems: async (_type, _empty) => [trackItem()],
    }),
  };
}

function projectObj() {
  return {
    getActiveSequence: async () => sequenceObj(),
    getRootItem: async () => ({ getItems: async () => [projectItem] }),
    // SINCRONO de proposito, igual ao Premiere real (ver src/premiere.ts).
    lockedAccess(cb) { cb(); },
    executeTransaction(cb, undoLabel) {
      const compound = { addAction: (a) => acoesEscritas.push({ undoLabel, a }) };
      cb(compound);
      console.log("[preview] transacao aplicada:", undoLabel, "acoes:", acoesEscritas.length);
      return true;
    },
  };
}

window.__PPRO__ = {
  Project: { getActiveProject: async () => projectObj() },
  ClipProjectItem: { cast: (item) => item },
  Transcript: {
    hasTranscript: async (clip) => clip && clip.name === NOME_MIDIA,
    exportToJSON: async (_clip) => TRANSCRICAO_ORIGEM,
    importFromJSON: (json) => JSON.parse(json),
    createImportTextSegmentsAction: (segments, clip) => ({ segments, clip }),
  },
};

// uxp.storage.localFileSystem: pasta de dados em memoria, sem tocar disco.
const arquivos = new Map();
const pasta = {
  getEntries: async () => [...arquivos.keys()].map((name) => ({ name })),
  createFile: async (name, _opts) => ({
    write: async (conteudo) => { arquivos.set(name, conteudo); },
    nativePath: "(preview)/" + name,
  }),
  getEntry: async (name) => {
    if (!arquivos.has(name)) throw new Error("nao existe: " + name);
    return { read: async () => arquivos.get(name) };
  },
};
window.__UXP__ = { storage: { localFileSystem: { getDataFolder: async () => pasta } } };

window.require = function (id) {
  if (id === "premierepro") return window.__PPRO__;
  if (id === "uxp") return window.__UXP__;
  throw new Error("preview: modulo desconhecido " + id);
};
console.log("[preview] require() stub pronto");
</script>`;

async function montarHtml() {
  const distHtml = await readFile(join(RAIZ, "dist", "index.html"), "utf8");
  // O build ja substituiu <!--SCRIPT--> pelo <script> do bundle. Insere o
  // stub logo ANTES da ultima tag <script> (o bundle), respeitando "ligar
  // require antes do require rodar" (regra 2 do UXP_ARMADILHAS.md).
  const idx = distHtml.lastIndexOf("<script>");
  if (idx === -1) throw new Error("dist/index.html sem <script> do bundle — rode npm run build antes");
  return distHtml.slice(0, idx) + STUB_JS + distHtml.slice(idx);
}

const servidor = createServer(async (req, res) => {
  try {
    if (req.url === "/" || req.url === "/index.html") {
      const html = await montarHtml();
      res.writeHead(200, { "content-type": "text/html; charset=utf-8" });
      res.end(html);
      return;
    }
    res.writeHead(404);
    res.end("nao encontrado");
  } catch (e) {
    res.writeHead(500, { "content-type": "text/plain" });
    res.end(String(e?.stack ?? e));
  }
});

servidor.listen(PORTA, () => {
  console.log(`preview em http://localhost:${PORTA}`);
});
