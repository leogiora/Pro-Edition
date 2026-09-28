import { test } from "node:test";
import assert from "node:assert/strict";
import { mkdtempSync, readFileSync, rmSync, writeFileSync } from "node:fs";
import { tmpdir } from "node:os";
import { join } from "node:path";
import { fileURLToPath } from "node:url";

import { gerarLegendas, salvarSrts } from "../src/motor/legendas.ts";
import type { Config } from "../src/motor/config.ts";

const fixture = (nome: string): string =>
  fileURLToPath(new URL(`../../ferramentas/pro-captions/tests/fixtures/${nome}`, import.meta.url));

// Com a resposta do ElevenLabs em .json nada vai para a rede nem para a configuracao.
const semConfig = {} as Config;

test("Legenda nos blocos do Premiere: .srt do Premiere + resposta do ElevenLabs -> .srt no corte dele", async () => {
  const json = fixture("elevenlabs-andro1909-variacao1.json");
  const r = await gerarLegendas(json, semConfig, () => undefined, fixture("premiere-andro1909-variacao1.srt"));
  assert.equal(r.cortes, "premiere");
  assert.equal(r.origem, "arquivo json");
  // "aqui no meu consultório" tem 23 caracteres: e o bloco do Premiere, nao reprova.
  assert.deepEqual(r.problemas, []);
  assert.ok(r.blocos.some((b) => b.texto === "aqui no meu consultório"));

  const pasta = mkdtempSync(join(tmpdir(), "legendas-"));
  try {
    const salvos = await salvarSrts(join(pasta, "variacao1.wav"), r.blocos, r.cortes);
    assert.deepEqual(salvos.map((s) => s.slice(pasta.length + 1)), ["variacao1 - legendas.srt", "variacao1 - precos.srt"]);
    assert.match(readFileSync(salvos[1] ?? "", "utf8"), /1\.000 REAIS[\s\S]*196 REAIS/);
    // Sem o .srt do Premiere, o orcamento de 20 caracteres continua valendo.
    await assert.rejects(salvarSrts(join(pasta, "x.wav"), r.blocos), /20/);
  } finally {
    rmSync(pasta, { recursive: true, force: true });
  }
});

test("Legenda: .srt sem legenda legivel falha antes de transcrever", async () => {
  const pasta = mkdtempSync(join(tmpdir(), "legendas-"));
  try {
    const vazio = join(pasta, "vazio.srt");
    writeFileSync(vazio, "nada aqui\n", "utf8");
    await assert.rejects(gerarLegendas(fixture("elevenlabs-andro1909-variacao1.json"), semConfig, () => undefined, vazio), /não tem legenda legível/);
  } finally {
    rmSync(pasta, { recursive: true, force: true });
  }
});
