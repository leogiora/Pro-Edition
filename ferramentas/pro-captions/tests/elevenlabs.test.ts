import { test } from "node:test";
import assert from "node:assert/strict";
import { readFileSync } from "node:fs";

import { audioMudo, duracaoDoWav, wavCompleto } from "../src/audio.ts";
import {
  assinaturaDoAudio,
  camposDoPedido,
  explicarErro,
  montarMultipart,
  palavrasDoElevenLabs,
  recusouTermos,
  termosChave,
  utf8,
} from "../src/elevenlabs.ts";
import { gerarBlocos } from "../src/pipeline.ts";
import { PRESET_ELEVENLABS, PRESET_PADRAO } from "../src/preset.ts";
import { validar } from "../src/segmentar.ts";

/**
 * Resposta REAL do ElevenLabs (exportacao JSON do site, Scribe) para a
 * variacao 1 do Andro 19.09 — 0:00 a 0:58, audio tratado (esv2).
 * Gabarito: a legenda que o editor revisou a mao no projeto.
 */
const REAL = readFileSync(new URL("./fixtures/elevenlabs-andro1909-variacao1.json", import.meta.url), "utf8");

/* ------------------------------------------------------------- leitura */

test("le a exportacao do site: palavras com start_time, sem os espacos", () => {
  const ps = palavrasDoElevenLabs(REAL);
  assert.ok(ps);
  assert.equal(ps.length, 175);
  assert.equal(ps[0]?.text, "Você");
  assert.equal(ps[0]?.inicio, 0.06);
  assert.ok(ps.every((p) => p.text.trim() === p.text && p.text.length > 0));
  assert.ok(ps.every((p, i) => i === 0 || p.inicio >= (ps[i - 1]?.inicio ?? 0)));
});

test("le o formato da API: words no topo, start/end, logprob vira confianca", () => {
  const api = JSON.stringify({
    language_code: "por",
    text: "Você falha. Inventa",
    words: [
      { text: "Você", start: 0.1, end: 0.3, type: "word", logprob: 0 },
      { text: " ", start: 0.3, end: 0.4, type: "spacing" },
      { text: "falha.", start: 0.4, end: 0.8, type: "word", logprob: Math.log(0.3) },
      { text: "(risos)", start: 0.8, end: 1, type: "audio_event" },
      { text: "Inventa", start: 1.1, end: 1.5, type: "word" },
    ],
  });
  const ps = palavrasDoElevenLabs(api);
  assert.deepEqual(ps?.map((p) => p.text), ["Você", "falha.", "Inventa"]);
  assert.deepEqual(ps?.map((p) => p.eos), [false, true, false]);
  assert.equal(ps?.[0]?.confidence, 1);
  assert.ok(Math.abs((ps?.[1]?.confidence ?? 0) - 0.3) < 1e-9);
});

test("deslocamento soma no tempo (audio que nao comeca no zero da sequencia)", () => {
  const ps = palavrasDoElevenLabs(JSON.stringify({ words: [{ text: "oi", start: 1, end: 2 }] }), 10);
  assert.equal(ps?.[0]?.inicio, 11);
  assert.equal(ps?.[0]?.fim, 12);
});

test("JSON quebrado devolve null; palavra sem tempo e descartada sozinha", () => {
  assert.equal(palavrasDoElevenLabs("{nao e json"), null);
  const ps = palavrasDoElevenLabs(JSON.stringify({ words: [{ text: "sem tempo" }, { text: "ok", start: 1 }] }));
  assert.deepEqual(ps?.map((p) => p.text), ["ok"]);
});

/* --------------------------------------------------- legenda de verdade */

test("variacao 1 real: passa na validacao e acerta o que o Premiere errou", () => {
  const blocos = gerarBlocos(palavrasDoElevenLabs(REAL) ?? [], [], PRESET_ELEVENLABS);
  assert.deepEqual(validar(blocos, PRESET_ELEVENLABS), []);
  const texto = blocos.map((b) => b.texto).join(" | ");
  // Os erros do Premiere que o editor corrigia a mao:
  assert.match(texto, /Você falha/);
  assert.match(texto, /Eu sou médico/);
  assert.match(texto, /me valoriza/);
  assert.match(texto, /estresse/);
  assert.doesNotMatch(texto, /stress\b/);
  // Aspas e dois-pontos nao chegam na tela.
  assert.doesNotMatch(texto, /["“”]/);
  assert.doesNotMatch(texto, /:( |\||$)/);
});

test("variacao 1 real: 'problema e busca' continua 'e' (o ElevenLabs ja acentua certo)", () => {
  const blocos = gerarBlocos(palavrasDoElevenLabs(REAL) ?? [], [], PRESET_ELEVENLABS);
  const texto = blocos.map((b) => b.texto).join(" ");
  assert.match(texto, /problema e busca/);
  assert.doesNotMatch(texto, /problema é/);
});

test("variacao 1 real: os dois precos saem isolados, o sem 'reais' falado vai para revisao", () => {
  const blocos = gerarBlocos(palavrasDoElevenLabs(REAL) ?? [], [], PRESET_ELEVENLABS);
  const precos = blocos.filter((b) => b.estilo === "preco");
  assert.deepEqual(precos.map((b) => b.texto), ["1.000 REAIS", "196 REAIS"]);
  assert.equal(precos[0]?.precisaRevisao, false);
  assert.equal(precos[1]?.precisaRevisao, true);
  // "15.000 homens" nao e preco.
  assert.ok(blocos.some((b) => b.estilo === "normal" && b.texto.includes("15.000")));
});

test("variacao 1 real: quebra nas virgulas, como a legenda revisada", () => {
  const blocos = gerarBlocos(palavrasDoElevenLabs(REAL) ?? [], [], PRESET_ELEVENLABS).map((b) => b.texto);
  for (const esperado of ["Ela espera", "tenta entender", "A falha", "ela perdoa", "O descaso", "não"]) {
    assert.ok(blocos.includes(esperado), `faltou o bloco "${esperado}"`);
  }
});

test("variacao 1 real: blocos curtos, sem artigo pendurado, como a legenda revisada", () => {
  const blocos = gerarBlocos(palavrasDoElevenLabs(REAL) ?? [], [], PRESET_ELEVENLABS)
    .filter((b) => b.estilo === "normal")
    .map((b) => b.texto);
  for (const b of blocos) {
    assert.ok(b.split(" ").length <= 3, `mais de 3 palavras: "${b}"`);
    assert.doesNotMatch(b, / (o|a|um|de|do|no|na|em|e|que)$/i, `terminou pendurado: "${b}"`);
  }
  // Antes: "evita a hora" / "H", "estresse e tratar o" / "que precisa".
  assert.ok(!blocos.includes("H"));
  for (const esperado of ["o problema", "a solução", "o que precisa", "um problema"]) {
    assert.ok(blocos.includes(esperado), `faltou o bloco "${esperado}"`);
  }
});

test("o preset padrao (Premiere) nao muda: virgula nao fecha bloco, e/é continua corrigido", () => {
  const palavras = "Ele e bom, ela sabe|".split(" ").map((bruto, i) => ({
    text: bruto.replace("|", ""),
    inicio: i,
    fim: i + 1,
    confidence: 1,
    eos: bruto.endsWith("|"),
    sourceName: "x",
  }));
  // Cabe em 20 caracteres: no padrao, fica um bloco so, como sempre foi.
  assert.deepEqual(gerarBlocos(palavras, [], PRESET_PADRAO).map((b) => b.texto), ["Ele é bom, ela sabe"]);
  // No preset do ElevenLabs a virgula fecha o bloco e o "e" nao e mexido.
  assert.deepEqual(gerarBlocos(palavras, [], PRESET_ELEVENLABS).map((b) => b.texto), ["Ele e bom", "ela sabe"]);
});

/* -------------------------------------------------------------- pedido */

test("termos-chave: sem repetidos, sem termo longo demais, protegidos primeiro", () => {
  const termos = termosChave({
    ...PRESET_ELEVENLABS,
    termosProtegidos: ["Androclinic"],
    termosChave: ["androclinic", "anamnese", "um termo que tem palavras demais aqui", "x".repeat(51), "  "],
  });
  assert.deepEqual(termos, ["Androclinic", "anamnese"]);
});

test("campos do pedido: modelo, portugues, tempo por palavra, termos repetidos", () => {
  const campos = camposDoPedido(["AndroClinic", "anamnese"]);
  const valor = (nome: string): string[] => campos.filter((c) => c.nome === nome).map((c) => c.valor);
  assert.deepEqual(valor("model_id"), ["scribe_v2"]);
  assert.deepEqual(valor("language_code"), ["por"]);
  assert.deepEqual(valor("timestamps_granularity"), ["word"]);
  assert.deepEqual(valor("keyterms"), ["AndroClinic", "anamnese"]);
  assert.deepEqual(camposDoPedido(["AndroClinic"], false).filter((c) => c.nome === "keyterms"), []);
});

test("multipart: campos, arquivo intacto e fechamento", () => {
  const bytes = new Uint8Array([0, 1, 2, 255, 13, 10]);
  const { corpo, contentType } = montarMultipart(
    [{ nome: "model_id", valor: "scribe_v2" }],
    { nome: "a.wav", tipo: "audio/wav", bytes },
    "XYZ"
  );
  assert.equal(contentType, "multipart/form-data; boundary=XYZ");
  const texto = Buffer.from(corpo).toString("latin1");
  assert.match(texto, /^--XYZ\r\nContent-Disposition: form-data; name="model_id"\r\n\r\nscribe_v2\r\n/);
  assert.match(texto, /name="file"; filename="a\.wav"\r\nContent-Type: audio\/wav\r\n\r\n/);
  assert.ok(texto.endsWith("\r\n--XYZ--\r\n"));
  const inicioArquivo = texto.indexOf("audio/wav\r\n\r\n") + "audio/wav\r\n\r\n".length;
  assert.deepEqual([...corpo.slice(inicioArquivo, inicioArquivo + bytes.length)], [...bytes]);
});

/* --------------------------------------------------------------- erros */

test("erros viram frase que o editor entende", () => {
  assert.match(explicarErro(401, '{"detail":"invalid api key"}'), /chave/);
  // Resposta real do primeiro teste no Premiere (2026-09-24).
  const real =
    '{"detail":{"type":"authentication_error","code":"invalid_api_key","message":"API key ID used as API key",' +
    '"status":"api_key_id_used_as_api_key"}}';
  assert.match(explicarErro(400, real), /ID da chave/);
  assert.match(explicarErro(400, '{"detail":{"code":"invalid_api_key"}}'), /recusou a chave/);
  assert.match(explicarErro(402, "{}"), /credito/);
  assert.match(explicarErro(400, '{"detail":"quota_exceeded"}'), /credito/);
  assert.match(explicarErro(503, ""), /fora do ar/);
  assert.equal(recusouTermos(422, '{"detail":[{"loc":["body","keyterms"]}]}'), true);
  assert.equal(recusouTermos(401, "keyterms"), false);
});

/* --------------------------------------------------------------- audio */

function wav(segundos: number, taxa = 16000): Uint8Array {
  const dados = segundos * taxa * 2;
  const b = new Uint8Array(44 + dados);
  const v = new DataView(b.buffer);
  const escrever = (o: number, s: string): void => [...s].forEach((c, i) => v.setUint8(o + i, c.charCodeAt(0)));
  escrever(0, "RIFF");
  v.setUint32(4, 36 + dados, true);
  escrever(8, "WAVE");
  escrever(12, "fmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, taxa, true);
  v.setUint32(28, taxa * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  escrever(36, "data");
  v.setUint32(40, dados, true);
  return b;
}

test("WAV: completo, duracao pelo cabecalho, incompleto enquanto grava", () => {
  const w = wav(2);
  assert.equal(wavCompleto(w), true);
  assert.equal(duracaoDoWav(w), 2);
  assert.equal(wavCompleto(w.slice(0, w.length - 10)), false);
  assert.equal(duracaoDoWav(new Uint8Array(10)), null);
});

test("assinatura: igual para o mesmo audio, muda quando o audio muda", () => {
  const a = wav(1);
  const b = wav(1);
  b[1000] = 7;
  assert.equal(assinaturaDoAudio(a), assinaturaDoAudio(wav(1)));
  assert.notEqual(assinaturaDoAudio(a), assinaturaDoAudio(b));
  assert.notEqual(assinaturaDoAudio(a), assinaturaDoAudio(wav(2)));

  // O Premiere poe data e ID do export depois do `data`: nao pode mudar a assinatura.
  const comMeta = (id: string): Uint8Array => {
    const m = new Uint8Array(a.length + 16);
    m.set(a);
    m.set([..."LIST"].map((c) => c.charCodeAt(0)), a.length);
    new DataView(m.buffer).setUint32(a.length + 4, 8, true);
    m.set([...id].map((c) => c.charCodeAt(0)), a.length + 8);
    return m;
  };
  assert.equal(assinaturaDoAudio(comMeta("21:02:20")), assinaturaDoAudio(comMeta("21:03:39")));
  assert.equal(assinaturaDoAudio(comMeta("21:02:20")), assinaturaDoAudio(a));
});

test("audio mudo e detectado antes de pagar o envio", () => {
  const mudo = wav(2);
  assert.equal(audioMudo(mudo), true);
  const denso = wav(2);
  for (let i = 0; i < 32000; i++) new DataView(denso.buffer).setInt16(44 + i * 2, i % 2 ? 3000 : -3000, true);
  assert.equal(audioMudo(denso), false);
  assert.equal(audioMudo(new Uint8Array(10)), false);
});

test("utf8 a mao bate com o do Node (acentos, cedilha, emoji)", () => {
  for (const t of ["", "abc", "disfunção erétil", "ç ã é ô ü", "R$ 1.000", "🙂 ok"]) {
    assert.deepEqual([...utf8(t)], [...Buffer.from(t, "utf8")]);
  }
});

test("o modulo nao usa TextEncoder (nao existe no UXP)", () => {
  const fonte = readFileSync(new URL("../src/elevenlabs.ts", import.meta.url), "utf8");
  assert.doesNotMatch(fonte.replace(/\/\*[\s\S]*?\*\//g, ""), /new TextEncoder/);
});
