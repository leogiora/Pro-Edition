import assert from "node:assert/strict";
import { test } from "node:test";
import {
  blocosDeFala,
  candidatosDoPreset,
  conferirPalavras,
  deslocamentos,
  FALA_PADRAO,
  fonteDoTrecho,
  lacunas,
  MARGEM_PADRAO_S,
  montarPalavras,
  planejarCortes,
  primeiraPalavra,
  ultimaPalavra,
  type Palavra,
} from "../src/pausas.ts";
import { wavCompleto } from "../src/wav.ts";

const opcoes = { fps: 30, duracaoQ: 300, margemS: MARGEM_PADRAO_S };

test("corta a pausa entre duas palavras e mantem a margem dos dois lados", () => {
  // "ola" 1.0-1.5s, "mundo" 3.0-3.5s. Pausa de 1.5s a 3.0s.
  const palavras: Palavra[] = [
    { texto: "ola", inicio: 1, fim: 1.5 },
    { texto: "mundo", inicio: 3, fim: 3.5 },
  ];
  const plano = planejarCortes(palavras, opcoes);

  // Cabeca (0 ate 1.0-0.08), a pausa do meio e a cauda = 3 cortes.
  assert.equal(plano.cortes.length, 3, "cabeca, meio e cauda");
  const meio = plano.cortes[1]!;
  // 1.5+0.08 = 1.58s -> quadro 47.4 -> arredonda PARA DENTRO da pausa = 48
  assert.equal(meio.inicioQ, 48);
  // 3.0-0.08 = 2.92s -> quadro 87.6 -> arredonda PARA DENTRO da pausa = 87
  assert.equal(meio.fimQ, 87);
  assert.equal(meio.antes, "ola");
  assert.equal(meio.depois, "mundo");
});

test("palavras encostadas nao geram corte", () => {
  const palavras: Palavra[] = [
    { texto: "e", inicio: 1, fim: 1.09 },
    { texto: "exatamente", inicio: 1.09, fim: 1.96 },
  ];
  const plano = planejarCortes(palavras, opcoes);
  const entrePalavras = plano.cortes.filter((c) => c.antes !== "" && c.depois !== "");
  assert.deepEqual(entrePalavras, []);
});

test("pausa com menos de 2 quadros removiveis fica inteira", () => {
  // Pausa de 0.20s: tirando 0.08 de cada lado sobra 0.04s = 1.2 quadros.
  const palavras: Palavra[] = [
    { texto: "um", inicio: 1, fim: 1.5 },
    { texto: "dois", inicio: 1.7, fim: 2.2 },
  ];
  const plano = planejarCortes(palavras, opcoes);
  const entrePalavras = plano.cortes.filter((c) => c.antes !== "" && c.depois !== "");
  assert.deepEqual(entrePalavras, []);
});

test("corta o silencio antes da primeira e depois da ultima palavra", () => {
  const palavras: Palavra[] = [{ texto: "so", inicio: 2, fim: 2.5 }];
  const plano = planejarCortes(palavras, opcoes);

  const cabeca = plano.cortes[0]!;
  assert.equal(cabeca.inicioQ, 0);
  assert.equal(cabeca.antes, "");
  // 2.0-0.08 = 1.92s -> 57.6 -> 57
  assert.equal(cabeca.fimQ, 57);

  const cauda = plano.cortes[plano.cortes.length - 1]!;
  // 2.5+0.08 = 2.58s -> 77.4 -> 78
  assert.equal(cauda.inicioQ, 78);
  assert.equal(cauda.fimQ, 300);
  assert.equal(cauda.depois, "");
});

test("os trechos que ficam sao colados um no outro a partir do quadro 0", () => {
  const palavras: Palavra[] = [
    { texto: "ola", inicio: 1, fim: 1.5 },
    { texto: "mundo", inicio: 3, fim: 3.5 },
  ];
  const plano = planejarCortes(palavras, opcoes);

  assert.equal(plano.trechos[0]!.destinoQ, 0);
  for (let i = 1; i < plano.trechos.length; i++) {
    const anterior = plano.trechos[i - 1]!;
    const atual = plano.trechos[i]!;
    assert.equal(atual.destinoQ, anterior.destinoQ + (anterior.fimQ - anterior.inicioQ));
  }
  const somaDosTrechos = plano.trechos.reduce((t, s) => t + (s.fimQ - s.inicioQ), 0);
  assert.equal(plano.duracaoDepoisQ, somaDosTrechos);
  assert.ok(plano.duracaoDepoisQ < plano.duracaoAntesQ);
});

test("sem palavra nenhuma nao ha plano: nada e cortado", () => {
  const plano = planejarCortes([], opcoes);
  assert.deepEqual(plano.cortes, []);
  assert.deepEqual(plano.trechos, []);
});

test("palavras fora de ordem ou sobrepostas nao geram corte negativo", () => {
  const palavras: Palavra[] = [
    { texto: "um", inicio: 1, fim: 2 },
    { texto: "dois", inicio: 1.5, fim: 2.5 },
  ];
  const plano = planejarCortes(palavras, opcoes);
  for (const c of plano.cortes) assert.ok(c.fimQ > c.inicioQ, `corte invalido: ${JSON.stringify(c)}`);
});

test("conferirPalavras aprova as mesmas palavras na mesma ordem, mesmo com duracao diferente", () => {
  const antes: Palavra[] = [
    { texto: "ola", inicio: 1, fim: 3 }, // a transcricao estica o fim por cima do silencio
    { texto: "mundo", inicio: 3, fim: 3.5 },
  ];
  const depois: Palavra[] = [
    { texto: "ola", inicio: 0.08, fim: 0.6 },
    { texto: "mundo", inicio: 0.7, fim: 1.2 },
  ];
  const r = conferirPalavras(antes, depois);
  assert.equal(r.ok, true);
  assert.match(r.linhas.join(" "), /2 de 2 palavras presentes/);
});

test("conferirPalavras reprova e nomeia a palavra que sumiu", () => {
  const antes: Palavra[] = [
    { texto: "um", inicio: 1, fim: 1.5 },
    { texto: "dois", inicio: 2, fim: 2.5 },
    { texto: "tres", inicio: 3, fim: 3.5 },
  ];
  const depois: Palavra[] = [
    { texto: "um", inicio: 0, fim: 0.5 },
    { texto: "tres", inicio: 0.6, fim: 1.1 },
  ];
  const r = conferirPalavras(antes, depois);
  assert.equal(r.ok, false);
  assert.match(r.linhas.join(" "), /"dois"/);
  assert.match(r.linhas.join(" "), /2 de 3/);
});

test("conferirPalavras reprova palavra sobrando e ordem trocada", () => {
  const antes: Palavra[] = [
    { texto: "um", inicio: 1, fim: 1.5 },
    { texto: "dois", inicio: 2, fim: 2.5 },
  ];
  assert.equal(conferirPalavras(antes, [...antes, { texto: "dois", inicio: 3, fim: 3.5 }]).ok, false);
  assert.equal(conferirPalavras(antes, [antes[1]!, antes[0]!]).ok, false);
});

test("montarPalavras converte a transcricao do Auto B-roll e descarta palavra sem duracao", () => {
  const entrada = [
    { text: "ola", inicio: 1, fim: 1.5 },
    { text: "vazia", inicio: 2, fim: 2 },
    { text: "mundo", inicio: 3, fim: 3.5 },
  ];
  assert.deepEqual(montarPalavras(entrada), [
    { texto: "ola", inicio: 1, fim: 1.5 },
    { texto: "mundo", inicio: 3, fim: 3.5 },
  ]);
});

test("deslocamentos diz quanto cada trecho anda para tras", () => {
  const plano = planejarCortes(
    [
      { texto: "ola", inicio: 1, fim: 1.5 },
      { texto: "mundo", inicio: 3, fim: 3.5 },
    ],
    opcoes
  );
  const ds = deslocamentos(plano);
  assert.equal(ds.length, plano.trechos.length);
  for (const d of ds) assert.ok(d.andarQ >= 0, "nenhum trecho anda para frente");
  assert.equal(ds[0]!.andarQ, plano.trechos[0]!.inicioQ, "o primeiro anda o tamanho da cabeca cortada");
});

/** WAV PCM 16 bits mono minimo, para testar leitura sem arquivo de verdade. */
function wav16(amostras: readonly number[], taxa = 16000): Uint8Array {
  const dados = amostras.length * 2;
  const b = new Uint8Array(44 + dados);
  const v = new DataView(b.buffer);
  const marca = (o: number, s: string) => {
    for (let i = 0; i < 4; i++) v.setUint8(o + i, s.charCodeAt(i));
  };
  marca(0, "RIFF");
  v.setUint32(4, 36 + dados, true);
  marca(8, "WAVE");
  marca(12, "fmt ");
  v.setUint32(16, 16, true);
  v.setUint16(20, 1, true);
  v.setUint16(22, 1, true);
  v.setUint32(24, taxa, true);
  v.setUint32(28, taxa * 2, true);
  v.setUint16(32, 2, true);
  v.setUint16(34, 16, true);
  marca(36, "data");
  v.setUint32(40, dados, true);
  amostras.forEach((a, i) => v.setInt16(44 + i * 2, Math.round(a * 32767), true));
  return b;
}

test("wavCompleto confere o tamanho que o cabecalho declara", () => {
  const w = wav16([0, 0.5, -0.5, 0]);
  assert.equal(wavCompleto(w), true);
  assert.equal(wavCompleto(w.subarray(0, w.byteLength - 2)), false, "arquivo ainda sendo escrito");
  assert.equal(wavCompleto(new Uint8Array(4)), false);
});

test("candidatosDoPreset tenta primeiro a pasta da versao que esta rodando", () => {
  const c = candidatosDoPreset("26.0.1", ["Adobe Media Encoder 2026", "Adobe Premiere Pro 2025", "Adobe Premiere Pro 2026"]);
  assert.deepEqual(c, [
    "C:\\Program Files\\Adobe\\Adobe Premiere Pro 2026\\Settings\\EncoderPresets\\WAV_Mono_16bit_16kHz.epr",
    "C:\\Program Files\\Adobe\\Adobe Premiere Pro 2025\\Settings\\EncoderPresets\\WAV_Mono_16bit_16kHz.epr",
  ]);
});

test("candidatosDoPreset sem versao conhecida tenta as pastas que existem", () => {
  assert.deepEqual(candidatosDoPreset("", ["Adobe Premiere Pro 2026"]), [
    "C:\\Program Files\\Adobe\\Adobe Premiere Pro 2026\\Settings\\EncoderPresets\\WAV_Mono_16bit_16kHz.epr",
  ]);
});

test("lacunas conta os espacos que a transcricao marca entre palavras", () => {
  const r = lacunas([
    { start: 0, duration: 1 },
    { start: 1, duration: 1 }, // encostada
    { start: 2.3, duration: 1 }, // 0,3 s
    { start: 4, duration: 1 }, // 0,7 s
  ]);
  assert.deepEqual(r, { total: 4, acima02: 2, acima05: 1 });
});

test("fonteDoTrecho devolve o instante da midia que cada trecho tem de mostrar", () => {
  // Clipe comeca na timeline em 0s, mostrando a midia a partir de 10s.
  assert.equal(fonteDoTrecho({ baseInicioQ: 0, baseFonteQ: 300 }, 90), 390);
  // Clipe que comeca em 1s na timeline: o trecho em 91 esta 90 quadros adiante.
  assert.equal(fonteDoTrecho({ baseInicioQ: 30, baseFonteQ: 300 }, 120), 390);
});

const J = 0.02;

/** Nivel por janela de 20 ms: [inicioS, fimS, dB] por trecho; o resto e silencio de sala. */
function niveis(duracaoS: number, trechos: ReadonlyArray<readonly [number, number, number]>, silencio = -60): number[] {
  const db = new Array<number>(Math.round(duracaoS / J)).fill(silencio);
  for (const [de, ate, nivel] of trechos) {
    for (let i = Math.round(de / J); i < Math.round(ate / J); i++) db[i] = nivel;
  }
  return db;
}

const perto = (a: number, b: number) => Math.abs(a - b) < 1e-6;

// Cena padrao: respiro fraco antes da frase, voz forte, final fraco ("s") e silencio.
// Piso -60, voz tipica -20: som acima de -50, voz forte acima de -40.
const cena = (d = 0) =>
  niveis(
    4,
    [
      [0.5, 0.9, -45 + d], // respiro
      [1.0, 2.0, -20 + d], // voz
      [2.0, 2.1, -45 + d], // final fraco
    ],
    -60 + d
  );

test("o respiro antes da frase fica fora e o final fraco da palavra fica dentro", () => {
  // Transcricao do 26: o fim da palavra estica por cima do silencio.
  const blocos = blocosDeFala(cena(), J, [{ texto: "vamos", inicio: 1.0, fim: 3.5 }]);
  assert.equal(blocos.length, 1);
  assert.ok(perto(blocos[0]!.inicio, 1.0), `inicio ${blocos[0]!.inicio}`);
  assert.ok(perto(blocos[0]!.fim, 2.1), `fim ${blocos[0]!.fim}`);
  assert.equal(blocos[0]!.motivo, "fala");
  assert.equal(blocos[0]!.texto, "vamos");
});

test("a mesma cena 15 dB mais baixa da os mesmos blocos: cada gravacao se mede", () => {
  const a = blocosDeFala(cena(), J, [{ texto: "vamos", inicio: 1.0, fim: 3.5 }]);
  const b = blocosDeFala(cena(-15), J, [{ texto: "vamos", inicio: 1.0, fim: 3.5 }]);
  assert.deepEqual(b, a);
});

test("ataque fraco ('s' de 'saude') fica quando a transcricao diz que a palavra comeca ali", () => {
  const db = niveis(4, [
    [0.9, 1.0, -45], // "s"
    [1.0, 2.0, -20],
  ]);
  const [bloco] = blocosDeFala(db, J, [{ texto: "saude", inicio: 0.9, fim: 2.0 }]);
  assert.ok(perto(bloco!.inicio, 0.9), `inicio ${bloco!.inicio}`);
});

test("buraco curto dentro da palavra nao quebra o bloco", () => {
  const db = niveis(4, [
    [1.0, 1.4, -20],
    [1.48, 2.0, -20], // 80 ms de fechamento do "p"
  ]);
  const blocos = blocosDeFala(db, J, [{ texto: "compra", inicio: 1.0, fim: 2.0 }]);
  assert.equal(blocos.length, 1);
});

test("voz forte e longa sem palavra fica e e sinalizada; estalo curto sai", () => {
  const db = niveis(6, [
    [1.0, 2.0, -20], // fala transcrita
    [3.0, 3.4, -20], // voz sem palavra (0,4 s)
    [4.5, 4.6, -20], // estalo (0,1 s)
  ]);
  const blocos = blocosDeFala(db, J, [{ texto: "ola", inicio: 1.0, fim: 2.0 }]);
  assert.equal(blocos.length, 2, JSON.stringify(blocos));
  assert.equal(blocos[1]!.motivo, "voz-sem-palavra");
  assert.ok(perto(blocos[1]!.inicio, 3.0));
});

test("palavra que comeca no silencio ganha bloco protegido", () => {
  const db = niveis(4, [[1.0, 2.0, -20]]);
  const blocos = blocosDeFala(db, J, [
    { texto: "ola", inicio: 1.0, fim: 2.0 },
    { texto: "tchau", inicio: 3.0, fim: 3.9 },
  ]);
  const baixa = blocos.find((b) => b.motivo === "palavra-baixa");
  assert.ok(baixa, JSON.stringify(blocos));
  assert.equal(baixa!.texto, "tchau");
  assert.ok(perto(baixa!.inicio, 3.0));
  assert.ok(perto(baixa!.fim, 3.0 + FALA_PADRAO.protecaoMaxS), "no maximo 0,5 s");
});

test("blocos entram direto no corte: o respiro cai dentro do corte da cabeca", () => {
  const blocos = blocosDeFala(cena(), J, [{ texto: "vamos", inicio: 1.0, fim: 3.5 }]);
  const plano = planejarCortes(blocos, { fps: 30, duracaoQ: 120, margemS: MARGEM_PADRAO_S });
  const cabeca = plano.cortes[0]!;
  assert.equal(cabeca.inicioQ, 0);
  // respiro de 0,5 a 0,9 s = quadros 15 a 27; o corte vai ate (1,0 - 0,08) * 30 = 27,6 -> 27
  assert.equal(cabeca.fimQ, 27);
});

test("o registro mostra so a palavra de cada lado do corte", () => {
  assert.equal(ultimaPalavra("a consulta de hoje"), "hoje");
  assert.equal(primeiraPalavra("então vamos"), "então");
  assert.equal(ultimaPalavra(""), "…");
  assert.equal(primeiraPalavra(""), "…");
});
