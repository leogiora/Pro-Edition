# Intensidade do take — plano de implementacao

> **For agentic workers:** REQUIRED SUB-SKILL: Use superpowers:subagent-driven-development (recommended) or superpowers:executing-plans to implement this plan task-by-task. Steps use checkbox (`- [ ]`) syntax for tracking.

**Goal:** Escolher qual TAKE de um conceito entra na timeline, casando a agitacao
do clipe com o ritmo da fala naquele instante, em vez de tratar os 43 "Viagra"
como intercambiaveis.

**Architecture:** A agitacao sai da tabela de tamanhos de quadro do MP4 (`stsz`),
sem decodificar video. Nada e comparado em escala absoluta: cada take vira um
percentil dentro do proprio conceito, e cada frase vira um percentil de
palavras-por-segundo dentro da sequencia. No planejador, a intensidade FILTRA os
takes elegiveis e o historico (D-017) escolhe entre os que sobraram. As medicoes
ficam num cache em disco porque exigem ler 0,6 GB.

**Tech Stack:** TypeScript estrito (`noUncheckedIndexedAccess`,
`exactOptionalPropertyTypes`), `node --test` sem framework, esbuild, UXP.

## Global Constraints

- Offline absoluto: sem rede, sem modelo, sem IA em runtime. `manifest.json` nao
  tem permissao de rede (D-002) e isso nao muda.
- Gate: `npm run verify` (tipos + testes + build) tem de passar em cada commit.
- Nenhuma falha de medicao pode impedir uma insercao. Sem medida, o
  comportamento tem de ser identico ao de hoje.
- Toda escolha automatica mostra motivo escrito (CLAUDE.md secao 8).
- Modulos puros nao importam `premierepro` nem tocam disco. Todo I/O do Premiere
  passa por `src/premiere.ts` e por `comLimite()`.
- Portugues sem acento em codigo e comentario, seguindo o resto do repositorio.

## Desvios da spec, decididos aqui

1. **Chave do cache e o nome do arquivo, nao nome + tamanho.** Obter o tamanho
   sem ler o arquivo exigiria `getMetadata()` em 260 entradas, e chamadas UXP em
   volume sao justamente o que pendura o painel (UXP_ARMADILHAS secao 3). O
   tamanho lido continua gravado, para diagnostico. Trocar um arquivo mantendo o
   nome exige apagar `intensidade.json` — anotado no proprio arquivo.
2. **`Biblioteca` nao ganha campo.** A spec falava em `Biblioteca.agitacao`; o
   plano usa um 5o parametro `intensidade` em `planejar`, e poe a tolerancia em
   `RegrasPlano`, que ja e a casa dos numeros ajustaveis (`antecipacao`,
   `janelaSemRepetir`). Mantem junto o que se ajusta junto.

## Estrutura de arquivos

| Arquivo | Responsabilidade | Tarefa |
|---|---|---|
| `src/mp4.ts` (modificar) | Ler bytes de MP4: dimensao e agitacao do track de video | 1 |
| `src/intensidade.ts` (criar) | Percentis e encaixe; forma e validacao do cache. Puro | 2, 4 |
| `src/plano.ts` (modificar) | Usar o encaixe para filtrar takes antes do historico | 3 |
| `src/premiere.ts` (modificar) | Medir a biblioteca no disco, com cache | 4 |
| `src/ui/main.ts` (modificar) | Progresso, e ligar tudo | 5 |
| `tests/mp4.test.ts` (modificar) | | 1 |
| `tests/intensidade.test.ts` (criar) | | 2, 4 |
| `tests/plano.test.ts` (modificar) | | 3 |

---

### Task 1: Agitacao lida do MP4

Hoje `varrer` devolve o primeiro `tkhd` com dimensao valida e nao guarda a qual
trak ele pertencia. Para a agitacao isso nao basta: o `stsz` precisa vir do MESMO
trak, senao le-se a tabela de quadros do audio. Esta tarefa reestrutura a
varredura por trak e adiciona a medida.

**Files:**
- Modify: `src/mp4.ts`
- Test: `tests/mp4.test.ts`

**Interfaces:**
- Consumes: `Size` de `src/domain.ts` (ja importado)
- Produces:
  - `dimensoesDeMp4(bytes: Uint8Array): Size | null` — assinatura inalterada
  - `agitacaoDeMp4(bytes: Uint8Array): number | null` — media de bytes por quadro
    dividida pelos pixels do quadro. `null` quando nao da para medir.

- [ ] **Step 1: Escrever os testes que falham**

Adicionar em `tests/mp4.test.ts`, depois dos helpers existentes (`box`, `tkhd`),
o helper de `stsz` e os testes:

```ts
/** stsz: versao+flags(4) + sample_size(4) + sample_count(4) + entradas(4 cada). */
function stsz(tamanhos: number[], tamanhoUnico = 0): number[] {
  const u32 = (n: number): number[] => [(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff];
  return box("stsz", [
    0, 0, 0, 0,
    ...u32(tamanhoUnico),
    ...u32(tamanhoUnico === 0 ? tamanhos.length : tamanhos.length),
    ...(tamanhoUnico === 0 ? tamanhos.flatMap(u32) : []),
  ]);
}

/** Um trak completo: tkhd + mdia > minf > stbl > stsz. */
function trakCompleto(width: number, height: number, quadros: number[], tamanhoUnico = 0): number[] {
  return box("trak", [
    ...tkhd(width, height),
    ...box("mdia", box("minf", box("stbl", stsz(quadros, tamanhoUnico)))),
  ]);
}

test("agitacaoDeMp4: media de bytes por quadro dividida pelos pixels", () => {
  // 4 quadros de media 1000 bytes, quadro de 100x100 = 10000 pixels.
  const arquivo = new Uint8Array(box("moov", trakCompleto(100, 100, [400, 800, 1200, 1600])));
  assert.equal(agitacaoDeMp4(arquivo), 0.1);
});

test("agitacaoDeMp4: clipe agitado mede mais que clipe parado", () => {
  const parado = new Uint8Array(box("moov", trakCompleto(100, 100, [100, 100, 120, 100])));
  const agitado = new Uint8Array(box("moov", trakCompleto(100, 100, [900, 1100, 1000, 1000])));
  assert.ok((agitacaoDeMp4(agitado) ?? 0) > (agitacaoDeMp4(parado) ?? 0));
});

test("agitacaoDeMp4: normaliza por resolucao — mesma cena em tamanhos diferentes bate", () => {
  // 464x832 com quadros proporcionalmente menores que 720x1280 tem agitacao igual.
  const pequeno = new Uint8Array(box("moov", trakCompleto(464, 832, [386048, 386048])));
  const grande = new Uint8Array(box("moov", trakCompleto(720, 1280, [921600, 921600])));
  assert.equal(agitacaoDeMp4(pequeno), agitacaoDeMp4(grande));
});

test("agitacaoDeMp4: le o stsz do track de VIDEO, nao o do audio", () => {
  // O trak de audio vem primeiro e tem dimensao zerada e quadros minusculos.
  const arquivo = new Uint8Array(
    box("moov", [
      ...trakCompleto(0, 0, [10, 10, 10, 10]),
      ...trakCompleto(100, 100, [400, 800, 1200, 1600]),
    ])
  );
  assert.equal(agitacaoDeMp4(arquivo), 0.1);
});

test("agitacaoDeMp4: quadro de tamanho fixo nao tem sinal de movimento", () => {
  // sample_size != 0 significa todos os quadros iguais: nao da para medir nada.
  const arquivo = new Uint8Array(box("moov", trakCompleto(100, 100, [1, 2, 3], 500)));
  assert.equal(agitacaoDeMp4(arquivo), null);
});

test("agitacaoDeMp4: sem stsz devolve null em vez de chutar", () => {
  const arquivo = new Uint8Array(box("moov", box("trak", tkhd(720, 1280))));
  assert.equal(agitacaoDeMp4(arquivo), null);
});

test("agitacaoDeMp4: stsz truncado nao lanca nem entra em laco", () => {
  // Declara 1000 entradas e entrega duas.
  const u32 = (n: number): number[] => [(n >>> 24) & 0xff, (n >>> 16) & 0xff, (n >>> 8) & 0xff, n & 0xff];
  const mentiroso = box("stsz", [0, 0, 0, 0, ...u32(0), ...u32(1000), ...u32(500), ...u32(500)]);
  const arquivo = new Uint8Array(
    box("moov", box("trak", [...tkhd(100, 100), ...box("mdia", box("minf", box("stbl", mentiroso)))]))
  );
  assert.equal(agitacaoDeMp4(arquivo), null);
});

test("dimensoesDeMp4: continua funcionando com trak completo", () => {
  const arquivo = new Uint8Array(box("moov", trakCompleto(720, 1280, [100, 200])));
  assert.deepEqual(dimensoesDeMp4(arquivo), { width: 720, height: 1280 });
});
```

Atualizar a linha de import do arquivo de teste:

```ts
import { agitacaoDeMp4, dimensoesDeMp4 } from "../src/mp4.ts";
```

- [ ] **Step 2: Rodar para confirmar que falha**

Run: `npm test`
Expected: FAIL — `agitacaoDeMp4 is not a function` (ou erro de tipo no `npm run check`).

- [ ] **Step 3: Reestruturar a varredura por trak**

Em `src/mp4.ts`, substituir de `const RECIPIENTES` ate o fim de `varrer` por:

```ts
/** Boxes que sao apenas recipientes de outros boxes. */
const RECIPIENTES = new Set(["moov", "trak", "mdia", "edts", "minf", "stbl"]);

/** moov > trak > mdia > minf > stbl > stsz sao seis niveis. */
const PROFUNDIDADE_MAXIMA = 6;

interface Box {
  readonly tipo: string;
  /** Primeiro byte do conteudo. */
  readonly conteudo: number;
  /** Primeiro byte DEPOIS do box. */
  readonly fim: number;
}

/**
 * Percorre os boxes de uma faixa de bytes.
 *
 * Devolve `null` no primeiro sinal de arquivo truncado ou tamanho impossivel —
 * seguir adiante de um box malformado e como entrar em laco.
 */
function boxesEm(bytes: Uint8Array, inicio: number, fim: number): Box[] | null {
  const achados: Box[] = [];
  let posicao = inicio;

  while (posicao + 8 <= fim) {
    let tamanho = uint32(bytes, posicao);
    const tipo = texto(bytes, posicao + 4);
    let conteudo = posicao + 8;

    // tamanho 1 significa que o tamanho real vem em 64 bits logo depois.
    if (tamanho === 1) {
      // Os 32 bits altos sao ignorados: box de mais de 4 GB nao ocorre aqui.
      tamanho = uint32(bytes, posicao + 12);
      conteudo = posicao + 16;
    } else if (tamanho === 0) {
      tamanho = fim - posicao; // vai ate o fim do arquivo
    }

    if (tamanho < 8 || posicao + tamanho > fim) return null; // arquivo truncado

    achados.push({ tipo, conteudo, fim: posicao + tamanho });
    posicao += tamanho;
  }
  return achados;
}

/** Primeiro box do tipo pedido, descendo por recipientes. */
function procurar(
  bytes: Uint8Array,
  inicio: number,
  fim: number,
  tipo: string,
  profundidade = 0
): Box | null {
  if (profundidade > PROFUNDIDADE_MAXIMA) return null;
  const lista = boxesEm(bytes, inicio, fim);
  if (lista === null) return null;

  for (const box of lista) {
    if (box.tipo === tipo) return box;
    if (RECIPIENTES.has(box.tipo)) {
      const achado = procurar(bytes, box.conteudo, box.fim, tipo, profundidade + 1);
      if (achado) return achado;
    }
  }
  return null;
}

/**
 * O trak de video, com o que se sabe dele.
 *
 * O pareamento importa: `tkhd` e `stsz` precisam vir do MESMO trak, senao a
 * tabela de quadros lida seria a do audio — que existe em 147 dos 260 arquivos
 * desta biblioteca.
 */
interface TrakDeVideo {
  readonly tamanho: Size;
  readonly amostras: readonly number[] | null;
}

function trakDeVideo(bytes: Uint8Array): TrakDeVideo | null {
  const moov = procurar(bytes, 0, bytes.length, "moov");
  if (!moov) return null;

  const dentro = boxesEm(bytes, moov.conteudo, moov.fim);
  if (dentro === null) return null;

  for (const trak of dentro) {
    if (trak.tipo !== "trak") continue;

    const tkhd = procurar(bytes, trak.conteudo, trak.fim, "tkhd");
    if (!tkhd) continue;
    const tamanho = lerTkhd(bytes, tkhd.conteudo);
    // Track de audio tem tkhd com largura e altura zeradas: pular.
    if (!tamanho) continue;

    const stsz = procurar(bytes, trak.conteudo, trak.fim, "stsz");
    return { tamanho, amostras: stsz ? lerStsz(bytes, stsz.conteudo, stsz.fim) : null };
  }
  return null;
}

/**
 * Largura e altura de exibicao do primeiro track de video.
 *
 * Devolve `null` quando nao encontra — nunca chuta, porque escala errada corta
 * a imagem no lugar errado, o que e pior que nao escalar.
 */
export function dimensoesDeMp4(bytes: Uint8Array): Size | null {
  return trakDeVideo(bytes)?.tamanho ?? null;
}

/**
 * Quanto o clipe se mexe, em bytes por quadro por pixel.
 *
 * Movimento obriga o codificador a gastar mais bits no mesmo quadro. Dividir
 * pelos pixels normaliza a medida, o que e obrigatorio aqui: 47% da biblioteca e
 * 464x832 e 52% e 720x1280, e comparar bytes crus entre os dois nao diz nada.
 *
 * O numero nao tem unidade util sozinho — so serve comparado com os irmaos do
 * mesmo conceito. Ver `src/intensidade.ts`.
 */
export function agitacaoDeMp4(bytes: Uint8Array): number | null {
  const trak = trakDeVideo(bytes);
  if (!trak?.amostras || trak.amostras.length === 0) return null;

  const pixels = trak.tamanho.width * trak.tamanho.height;
  if (pixels <= 0) return null;

  const soma = trak.amostras.reduce((s, n) => s + n, 0);
  return soma / trak.amostras.length / pixels;
}

/**
 * Tabela de tamanhos de quadro.
 *
 * `sample_size` diferente de zero significa que todos os quadros tem o mesmo
 * tamanho — nao ha variacao para medir, entao nao ha agitacao a extrair.
 */
function lerStsz(bytes: Uint8Array, inicio: number, fimDoBox: number): number[] | null {
  if (inicio + 12 > fimDoBox) return null;

  const tamanhoUnico = uint32(bytes, inicio + 4);
  if (tamanhoUnico !== 0) return null;

  const quantidade = uint32(bytes, inicio + 8);
  if (quantidade === 0) return null;

  const amostras: number[] = [];
  let posicao = inicio + 12;
  for (let i = 0; i < quantidade; i++) {
    // Quantidade mentirosa em arquivo corrompido: parar em vez de ler lixo.
    if (posicao + 4 > fimDoBox) return null;
    amostras.push(uint32(bytes, posicao));
    posicao += 4;
  }
  return amostras;
}
```

`lerTkhd` fica como esta, no fim do arquivo.

- [ ] **Step 4: Rodar o gate**

Run: `npm run verify`
Expected: PASS — 126 testes antigos mais os 8 novos.

- [ ] **Step 5: Commit**

```bash
git add src/mp4.ts tests/mp4.test.ts
git commit -m "Ler a agitacao do clipe da tabela de quadros do mp4"
```

---

### Task 2: Percentis e encaixe

Modulo puro novo. Transforma medidas cruas em posicao relativa e responde a
unica pergunta que o planejador faz: **este take cabe neste momento?**

**Files:**
- Create: `src/intensidade.ts`
- Test: `tests/intensidade.test.ts`

**Interfaces:**
- Consumes: nada — puro, sem dependencia de outro modulo do projeto.
- Produces:
  - `percentis(valores: readonly (number | null)[]): (number | null)[]` — mesma
    ordem da entrada; `null` entra e sai `null`.
  - `encaixam(percentisDosTakes: readonly (number | null)[], alvo: number, tolerancia: number): number[]`
    — indices dos takes que cabem; lista vazia quando nenhum cabe.
  - `ritmo(palavras: number, duracao: number): number` — palavras por segundo.

- [ ] **Step 1: Escrever os testes que falham**

Criar `tests/intensidade.test.ts`:

```ts
import { test } from "node:test";
import assert from "node:assert/strict";

import { encaixam, percentis, ritmo } from "../src/intensidade.ts";

test("percentis: menor vira 0, maior vira 1", () => {
  assert.deepEqual(percentis([10, 20, 30]), [0, 0.5, 1]);
});

test("percentis: ordem da entrada e preservada", () => {
  assert.deepEqual(percentis([30, 10, 20]), [1, 0, 0.5]);
});

test("percentis: item unico fica no meio, elegivel em qualquer momento", () => {
  assert.deepEqual(percentis([42]), [0.5]);
});

test("percentis: empate recebe o mesmo percentil", () => {
  assert.deepEqual(percentis([10, 10, 30]), [0, 0, 1]);
});

test("percentis: quem nao pode ser medido continua sem medida", () => {
  assert.deepEqual(percentis([10, null, 30]), [0, null, 1]);
});

test("percentis: lista so de nulos nao quebra", () => {
  assert.deepEqual(percentis([null, null]), [null, null]);
});

test("percentis: lista vazia devolve vazia", () => {
  assert.deepEqual(percentis([]), []);
});

test("encaixam: pega quem esta dentro da tolerancia", () => {
  // Fala rapida (0,9): so o take agitado cabe.
  assert.deepEqual(encaixam([0, 0.5, 1], 0.9, 0.35), [2]);
});

test("encaixam: fala no meio abre para os dois lados", () => {
  assert.deepEqual(encaixam([0, 0.5, 1], 0.5, 0.35), [1]);
  assert.deepEqual(encaixam([0.2, 0.5, 0.8], 0.5, 0.35), [0, 1, 2]);
});

test("encaixam: take sem medida nunca e excluido", () => {
  // Nao medir nao pode virar castigo: ele continua candidato.
  assert.deepEqual(encaixam([null, 0], 1, 0.35), [0]);
});

test("encaixam: nenhum encaixe devolve vazio, e quem chama decide", () => {
  assert.deepEqual(encaixam([0, 0.1], 1, 0.35), []);
});

test("ritmo: palavras por segundo", () => {
  assert.equal(ritmo(10, 5), 2);
});

test("ritmo: duracao zero nao vira infinito", () => {
  assert.equal(ritmo(10, 0), 0);
});
```

- [ ] **Step 2: Rodar para confirmar que falha**

Run: `npm test`
Expected: FAIL — modulo `../src/intensidade.ts` nao existe.

- [ ] **Step 3: Escrever o modulo**

Criar `src/intensidade.ts`:

```ts
/*
 * Intensidade: quanto um clipe se mexe, e quanto um momento da fala corre.
 *
 * Nada aqui trabalha em escala absoluta. "0,0031 bytes por quadro por pixel" nao
 * significa nada sozinho; significa tudo comparado com os outros 42 takes do
 * mesmo conceito. Por isso a moeda deste modulo e o PERCENTIL, que dispensa
 * calibracao e cancela vies de codificador e de resolucao.
 *
 * Puro: nao conhece o Premiere, nao faz I/O, nao le arquivo.
 */

/**
 * Posicao relativa de cada valor dentro da propria lista, de 0 a 1.
 *
 * Empates recebem o mesmo percentil. `null` (nao foi possivel medir) atravessa
 * intacto: nao medir nao pode virar castigo.
 *
 * Lista de um item so devolve 0,5 — item unico nao e nem agitado nem parado em
 * relacao a ninguem, e o meio o mantem elegivel em qualquer momento. Sao 12 dos
 * 32 conceitos desta biblioteca.
 */
export function percentis(valores: readonly (number | null)[]): (number | null)[] {
  const medidos = valores.filter((v): v is number => v !== null);
  if (medidos.length === 0) return valores.map(() => null);
  if (medidos.length === 1) return valores.map((v) => (v === null ? null : 0.5));

  const ordenados = [...medidos].sort((a, b) => a - b);
  const ultimo = ordenados.length - 1;

  return valores.map((v) => (v === null ? null : ordenados.indexOf(v) / ultimo));
}

/**
 * Indices dos takes cuja intensidade cabe no momento.
 *
 * Take sem medida entra sempre: a ausencia de informacao nao e informacao
 * negativa. Lista vazia significa "nenhum encaixa" — quem chama decide o que
 * fazer, e no planejador isso vira cair de volta para todos.
 */
export function encaixam(
  percentisDosTakes: readonly (number | null)[],
  alvo: number,
  tolerancia: number
): number[] {
  const dentro: number[] = [];
  percentisDosTakes.forEach((p, i) => {
    if (p === null || Math.abs(p - alvo) <= tolerancia) dentro.push(i);
  });
  return dentro;
}

/** Palavras por segundo: o quanto a fala corre naquele trecho. */
export function ritmo(palavras: number, duracao: number): number {
  return duracao > 0 ? palavras / duracao : 0;
}
```

- [ ] **Step 4: Rodar o gate**

Run: `npm run verify`
Expected: PASS — 13 testes novos.

- [ ] **Step 5: Commit**

```bash
git add src/intensidade.ts tests/intensidade.test.ts
git commit -m "Percentil de intensidade e teste de encaixe"
```

---

### Task 3: O planejador escolhe o take pelo momento

**Files:**
- Modify: `src/plano.ts`
- Test: `tests/plano.test.ts`

**Interfaces:**
- Consumes: `encaixam`, `percentis`, `ritmo` de `src/intensidade.ts`;
  `melhorArquivo` de `src/aprendizado.ts` (ja importado).
- Produces:
  - `RegrasPlano.toleranciaIntensidade: number` — novo campo obrigatorio,
    `0.35` em `REGRAS_PADRAO`.
  - `planejar(oportunidades, biblioteca, regras?, memoria?, intensidade?)` — 5o
    parametro opcional `IntensidadeDoPlano`.
  - `interface IntensidadeDoPlano { porArquivo: ReadonlyMap<string, number>; ritmoDasFrases: readonly number[] }`

- [ ] **Step 1: Escrever os testes que falham**

Adicionar em `tests/plano.test.ts`, antes de `function p0`:

```ts
// ------------------------ intensidade do take -------------------------------

/** Frustrado tem dois takes: (1) parado, (2) agitado. */
const AGITACAO = new Map([
  ["Frustrado (1).mp4", 0.001],
  ["Frustrado (2).mp4", 0.009],
  ["Viagra (1).mp4", 0.005],
]);

test("planejar: fala rapida puxa o take agitado", () => {
  // Duas frases: a de 10s e lenta, a de 60s e rapida. A rapida pega o agitado.
  const lenta = oportunidade(10, 4, [{ c: FRUSTRADO, score: 1 }]);
  const rapida = { ...oportunidade(60, 4, [{ c: FRUSTRADO, score: 1 }]) };
  const p = planejar([lenta, rapida], BIBLIOTECA, REGRAS_PADRAO, MEMORIA_VAZIA, {
    porArquivo: AGITACAO,
    // Percentil da frase lenta = 0; da rapida = 1.
    ritmoDasFrases: [1, 5],
  });
  assert.equal(p.colocacoes.length, 2);
  assert.equal(p0(p.colocacoes).arquivo, "Frustrado (1).mp4", "a lenta pega o parado");
  assert.equal(p.colocacoes[1]?.arquivo, "Frustrado (2).mp4", "a rapida pega o agitado");
});

test("planejar: o motivo diz que o take foi escolhido pelo momento", () => {
  const rapida = oportunidade(10, 4, [{ c: FRUSTRADO, score: 1 }]);
  const p = planejar([rapida], BIBLIOTECA, REGRAS_PADRAO, MEMORIA_VAZIA, {
    porArquivo: AGITACAO,
    ritmoDasFrases: [2],
  });
  assert.match(p0(p.colocacoes).motivo, /take (agitado|parado)/);
});

test("planejar: nenhum take encaixa, a colocacao acontece do mesmo jeito", () => {
  // So takes parados, fala muito rapida: cai de volta para todos.
  const so = new Map([["Frustrado (1).mp4", 0.001], ["Frustrado (2).mp4", 0.0011]]);
  const p = planejar(
    [oportunidade(10, 4, [{ c: FRUSTRADO, score: 1 }])],
    BIBLIOTECA,
    REGRAS_PADRAO,
    MEMORIA_VAZIA,
    { porArquivo: so, ritmoDasFrases: [2] }
  );
  assert.equal(p.colocacoes.length, 1, "intensidade nunca pode custar uma colocacao");
});

test("planejar: sem intensidade, o plano e identico ao de hoje", () => {
  const o = [oportunidade(10, 4, [{ c: FRUSTRADO, score: 1 }])];
  assert.deepEqual(planejar(o, BIBLIOTECA), planejar(o, BIBLIOTECA, REGRAS_PADRAO, MEMORIA_VAZIA));
});

test("planejar: o historico ainda escolhe DENTRO do que a intensidade permitiu", () => {
  // Os dois takes encaixam; o historico reprova o (1), entao vem o (2).
  const memoria = aprender(
    MEMORIA_VAZIA,
    { quando: "", itens: [{ arquivo: "Frustrado (1).mp4", conceito: "Frustrado", termosCasados: FRUSTRADO.termos }] },
    new Set()
  ).memoria;
  const p = planejar(
    [oportunidade(10, 4, [{ c: FRUSTRADO, score: 1 }])],
    BIBLIOTECA,
    REGRAS_PADRAO,
    memoria,
    { porArquivo: new Map([["Frustrado (1).mp4", 0.005], ["Frustrado (2).mp4", 0.005]]), ritmoDasFrases: [2] }
  );
  assert.equal(p0(p.colocacoes).arquivo, "Frustrado (2).mp4");
});
```

- [ ] **Step 2: Rodar para confirmar que falha**

Run: `npm test`
Expected: FAIL — `planejar` aceita 4 parametros; erro de tipo no 5o.

- [ ] **Step 3: Implementar**

Em `src/plano.ts`, adicionar ao import:

```ts
import { encaixam, percentis, ritmo } from "./intensidade.ts";
```

Adicionar o campo em `RegrasPlano`, depois de `antecipacao`:

```ts
  /**
   * Quanto o percentil de agitacao do take pode se afastar do percentil de
   * ritmo da fala e ainda contar como encaixe.
   *
   * Botao, nao constante: nos 43 takes de "Viagra", 0,35 deixa ~15 candidatos
   * quando a fala esta num extremo e ~30 quando esta no meio. Apertar se entrar
   * take fora de clima; afrouxar se muita colocacao cair no fallback.
   */
  readonly toleranciaIntensidade: number;
```

Em `REGRAS_PADRAO`, depois de `antecipacao: 0.3,`:

```ts
  toleranciaIntensidade: 0.35,
```

Depois da interface `Biblioteca`, adicionar:

```ts
/**
 * O que se sabe de intensidade nesta rodada.
 *
 * Ausente, o planejador se comporta exatamente como antes de existir — o que
 * mantem todo o comportamento provado ate aqui intacto.
 */
export interface IntensidadeDoPlano {
  /** Agitacao crua por arquivo, como saiu do mp4. */
  readonly porArquivo: ReadonlyMap<string, number>;
  /** Palavras por segundo de TODAS as frases da sequencia, para o percentil. */
  readonly ritmoDasFrases: readonly number[];
}
```

Trocar a assinatura de `planejar`:

```ts
export function planejar(
  oportunidades: readonly Oportunidade[],
  biblioteca: Biblioteca,
  regras: RegrasPlano = REGRAS_PADRAO,
  memoria: Memoria = MEMORIA_VAZIA,
  intensidade?: IntensidadeDoPlano
): Plano {
```

Logo depois de `const descartes: string[] = [];`, adicionar:

```ts
  // Ordenado uma vez para a sequencia toda: e a regua contra a qual o ritmo de
  // cada frase vira percentil.
  const ritmoOrdenado = intensidade ? [...intensidade.ritmoDasFrases].sort((a, b) => a - b) : [];
```

Substituir o bloco de escolha do arquivo (de `const disponiveis` ate
`const trocouTake = ...`) por:

```ts
    // O que o usuario apagou cede a vez a outra variacao do mesmo conceito. O
    // assunto continua valendo; so muda o take.
    const disponiveis = c.arquivos.filter((a) => !arquivosUsados.has(a));

    // A intensidade FILTRA, o historico ESCOLHE. Sem isso o historico trava no
    // primeiro take creditado e os outros 42 nunca aparecem.
    const cabem = filtrarPorIntensidade(disponiveis, c.frase, intensidade, regras, ritmoOrdenado);
    const arquivo = melhorArquivo(memoria, cabem.arquivos);
    if (arquivo === undefined) {
      descartes.push(`${onde}: todas as variacoes ja usadas`);
      continue;
    }
    // Sem historico o escolhido e sempre o primeiro. Se divergiu, foi a contagem
    // por arquivo que mudou a escolha — e isso tem de aparecer no motivo.
    const trocouTake = arquivo !== disponiveis[0];
```

Trocar a linha do `motivo` dentro de `colocacoes.push`:

```ts
      motivo: montarMotivo(c.motivo, trocouTake, cabem.rotulo),
```

E no fim do arquivo, antes de `function sinal`, adicionar:

```ts
/**
 * Restringe os takes aos que combinam com o ritmo da fala naquele ponto.
 *
 * Devolve tambem o rotulo para o motivo. Quando nada encaixa, devolve todos:
 * intensidade nunca pode custar uma colocacao boa.
 */
function filtrarPorIntensidade(
  disponiveis: readonly string[],
  frase: Oportunidade["frase"],
  intensidade: IntensidadeDoPlano | undefined,
  regras: RegrasPlano,
  ritmoOrdenado: readonly number[]
): { arquivos: readonly string[]; rotulo: string | null } {
  if (intensidade === undefined || disponiveis.length < 2 || ritmoOrdenado.length < 2) {
    return { arquivos: disponiveis, rotulo: null };
  }

  const daFrase = ritmo(frase.palavras, frase.duracao);
  const alvo = ritmoOrdenado.indexOf(maisProximo(ritmoOrdenado, daFrase)) / (ritmoOrdenado.length - 1);

  const dosTakes = percentis(disponiveis.map((a) => intensidade.porArquivo.get(a) ?? null));
  const indices = encaixam(dosTakes, alvo, regras.toleranciaIntensidade);

  if (indices.length === 0) return { arquivos: disponiveis, rotulo: null };

  return {
    // `filter` em vez de `?? ""`: nome vazio entrando na escolha viraria uma
    // colocacao apontando para arquivo nenhum.
    arquivos: indices.map((i) => disponiveis[i]).filter((a): a is string => a !== undefined),
    rotulo: alvo >= 0.5 ? "take agitado, a fala corre aqui" : "take parado, momento calmo",
  };
}

/** O valor da lista mais proximo do procurado. Lista nunca vazia. */
function maisProximo(ordenados: readonly number[], alvo: number): number {
  let escolhido = ordenados[0] ?? 0;
  for (const v of ordenados) {
    if (Math.abs(v - alvo) < Math.abs(escolhido - alvo)) escolhido = v;
  }
  return escolhido;
}

/** O motivo carrega tudo o que mexeu na escolha, na ordem em que mexeu. */
function montarMotivo(base: string, trocouTake: boolean, intensidade: string | null): string {
  let texto = base;
  if (intensidade !== null) texto += ` · ${intensidade}`;
  if (trocouTake) texto += " · outro take, o anterior foi apagado";
  return texto;
}
```

Remover a variavel `percentilDoRitmo` se o `tsc` acusar que nao e usada — o
percentil da frase e calculado dentro de `filtrarPorIntensidade`.

- [ ] **Step 4: Rodar o gate**

Run: `npm run verify`
Expected: PASS. Se o teste "sem intensidade, o plano e identico" falhar, o
fallback esta errado: `intensidade === undefined` tem de sair antes de qualquer
filtro.

- [ ] **Step 5: Commit**

```bash
git add src/plano.ts tests/plano.test.ts
git commit -m "O take entra pelo ritmo da fala, e o historico escolhe entre os que cabem"
```

---

### Task 4: Cache das medicoes

Medir exige ler ~0,6 GB. Uma vez, tudo bem; a cada analise, nao.

**Files:**
- Modify: `src/intensidade.ts` (forma e validacao do cache — puro)
- Modify: `src/premiere.ts` (leitura do disco)
- Test: `tests/intensidade.test.ts`

**Interfaces:**
- Consumes: `agitacaoDeMp4` de `src/mp4.ts`; `caminhoParaUrl` de `src/domain.ts`;
  `comLimite` de `src/premiere.ts`.
- Produces:
  - `interface CacheIntensidade { schema: 1; arquivos: Readonly<Record<string, number | null>> }`
  - `CACHE_VAZIO: CacheIntensidade`
  - `parseCacheIntensidade(raw: unknown): CacheIntensidade`
  - `aMedir(cache: CacheIntensidade, nomes: readonly string[]): string[]`
  - `comMedida(cache: CacheIntensidade, nome: string, agitacao: number | null): CacheIntensidade`
  - `medirBiblioteca(arquivos, cache, aoProgredir)` em `src/premiere.ts`

- [ ] **Step 1: Escrever os testes que falham**

Em `tests/intensidade.test.ts`, **acrescentar ao import que ja existe** (nao criar
um segundo import do mesmo modulo), deixando-o assim:

```ts
import {
  aMedir,
  CACHE_VAZIO,
  comMedida,
  encaixam,
  parseCacheIntensidade,
  percentis,
  ritmo,
} from "../src/intensidade.ts";
```

E adicionar os testes:

```ts
test("aMedir: so pede o que ainda nao foi medido", () => {
  const cache = comMedida(CACHE_VAZIO, "a.mp4", 0.003);
  assert.deepEqual(aMedir(cache, ["a.mp4", "b.mp4"]), ["b.mp4"]);
});

test("aMedir: arquivo que nao deu para medir nao e tentado de novo", () => {
  // Guardar o `null` e o que impede reler 2,3 MB toda analise para falhar igual.
  const cache = comMedida(CACHE_VAZIO, "quebrado.mp4", null);
  assert.deepEqual(aMedir(cache, ["quebrado.mp4"]), []);
});

test("parseCacheIntensidade: ida e volta pelo JSON", () => {
  const cache = comMedida(comMedida(CACHE_VAZIO, "a.mp4", 0.003), "b.mp4", null);
  assert.deepEqual(parseCacheIntensidade(JSON.parse(JSON.stringify(cache))), cache);
});

test("parseCacheIntensidade: arquivo corrompido volta vazio em vez de lancar", () => {
  for (const lixo of [null, 42, "texto", {}, { arquivos: "nao e objeto" }]) {
    assert.deepEqual(parseCacheIntensidade(lixo), CACHE_VAZIO);
  }
});

test("parseCacheIntensidade: entrada malformada some, o resto fica", () => {
  const c = parseCacheIntensidade({
    schema: 1,
    arquivos: { "bom.mp4": 0.004, "ruim.mp4": "texto", "nulo.mp4": null },
  });
  assert.deepEqual(c.arquivos, { "bom.mp4": 0.004, "nulo.mp4": null });
});

test("comMedida: nao altera o cache recebido", () => {
  const antes = comMedida(CACHE_VAZIO, "a.mp4", 0.003);
  const copia = JSON.stringify(antes);
  comMedida(antes, "b.mp4", 0.007);
  assert.equal(JSON.stringify(antes), copia);
});
```

- [ ] **Step 2: Rodar para confirmar que falha**

Run: `npm test`
Expected: FAIL — `aMedir`, `CACHE_VAZIO`, `comMedida`, `parseCacheIntensidade`
nao existem.

- [ ] **Step 3: Implementar a parte pura**

Adicionar ao fim de `src/intensidade.ts`:

```ts
// ------------------------------------------------------------------ cache

/**
 * Medicoes ja feitas, por nome de arquivo.
 *
 * `null` guardado quer dizer "tentei e nao deu" — vale tanto quanto um numero,
 * porque impede reler 2,3 MB a cada analise para falhar do mesmo jeito.
 *
 * A chave e so o nome. Comparar tambem o tamanho exigiria `getMetadata()` em 260
 * entradas, e chamada UXP em volume e o que pendura o painel (UXP_ARMADILHAS
 * secao 3). Trocar um arquivo mantendo o nome pede apagar este arquivo a mao.
 */
export interface CacheIntensidade {
  readonly schema: 1;
  readonly arquivos: Readonly<Record<string, number | null>>;
}

export const CACHE_VAZIO: CacheIntensidade = { schema: 1, arquivos: {} };

/** Quem ainda nao foi medido. Medido e nao deu certo tambem conta como medido. */
export function aMedir(cache: CacheIntensidade, nomes: readonly string[]): string[] {
  return nomes.filter((n) => !(n in cache.arquivos));
}

export function comMedida(
  cache: CacheIntensidade,
  nome: string,
  agitacao: number | null
): CacheIntensidade {
  return { schema: 1, arquivos: { ...cache.arquivos, [nome]: agitacao } };
}

/** Cache corrompido volta vazio: remedir custa tempo, lancar custa a analise. */
export function parseCacheIntensidade(raw: unknown): CacheIntensidade {
  if (typeof raw !== "object" || raw === null) return CACHE_VAZIO;
  const bruto = (raw as Record<string, unknown>).arquivos;
  if (typeof bruto !== "object" || bruto === null) return CACHE_VAZIO;

  const arquivos: Record<string, number | null> = {};
  for (const [nome, valor] of Object.entries(bruto)) {
    if (valor === null) arquivos[nome] = null;
    else if (typeof valor === "number" && Number.isFinite(valor) && valor >= 0) {
      arquivos[nome] = valor;
    }
  }
  return { schema: 1, arquivos };
}
```

- [ ] **Step 4: Rodar o gate**

Run: `npm run verify`
Expected: PASS.

- [ ] **Step 5: Implementar a leitura do disco**

Em `src/premiere.ts`, trocar o import do mp4:

```ts
import { agitacaoDeMp4, dimensoesDeMp4 } from "./mp4.ts";
```

E adicionar, depois de `dimensoesDoArquivo`:

```ts
/**
 * Mede a agitacao dos arquivos que ainda nao estao no cache.
 *
 * Le o arquivo inteiro porque o UXP nao oferece leitura parcial, e o `moov` pode
 * estar no fim. Sao ~2,3 MB por arquivo nesta biblioteca; a primeira passada nos
 * 260 custa dezenas de segundos, e as seguintes nao custam nada.
 *
 * Falha de leitura vira `null` gravado, nao excecao: um arquivo ilegivel nao
 * pode derrubar a analise, e gravar o `null` impede tentar de novo toda vez.
 */
export async function medirBiblioteca(
  arquivos: readonly ArquivoBroll[],
  cache: CacheIntensidade,
  aoProgredir: (feitos: number, total: number) => void
): Promise<CacheIntensidade> {
  const pendentes = aMedir(cache, arquivos.map((a) => a.name));
  if (pendentes.length === 0) return cache;

  const porNome = new Map(arquivos.map((a) => [a.name, a.nativePath]));
  let atual = cache;
  let feitos = 0;

  for (const nome of pendentes) {
    const caminho = porNome.get(nome);
    let agitacao: number | null = null;
    if (caminho !== undefined) {
      try {
        const entrada = (await uxp.storage.localFileSystem.getEntryWithUrl(
          caminhoParaUrl(caminho)
        )) as { read: (o: unknown) => Promise<ArrayBuffer> } | null;
        if (entrada) {
          const dados = await entrada.read({ format: uxp.storage.formats.binary });
          agitacao = agitacaoDeMp4(new Uint8Array(dados));
        }
      } catch {
        // Arquivo ilegivel: fica como null e nao se tenta de novo.
      }
    }
    atual = comMedida(atual, nome, agitacao);
    feitos++;
    // Cada 25 para nao inundar o log de um painel curto.
    if (feitos % 25 === 0 || feitos === pendentes.length) aoProgredir(feitos, pendentes.length);
  }
  return atual;
}
```

E ao import de intensidade no topo de `src/premiere.ts`:

```ts
import { aMedir, comMedida, type CacheIntensidade } from "./intensidade.ts";
```

- [ ] **Step 6: Rodar o gate**

Run: `npm run verify`
Expected: PASS — `medirBiblioteca` nao tem teste automatico (faz I/O do UXP); a
logica testavel dela ja esta em `aMedir`/`comMedida`.

- [ ] **Step 7: Commit**

```bash
git add src/intensidade.ts src/premiere.ts tests/intensidade.test.ts
git commit -m "Cache incremental das medicoes de intensidade"
```

---

### Task 5: Ligar no painel

**Files:**
- Modify: `src/ui/main.ts`
- Modify: `docs/BUILD_STATUS.md`, `docs/DECISIONS.md`

**Interfaces:**
- Consumes: `medirBiblioteca` de `src/premiere.ts`; `parseCacheIntensidade`,
  `CACHE_VAZIO`, `ritmo` de `src/intensidade.ts`; `planejar` com 5o parametro.
- Produces: nada consumido por outra tarefa.

- [ ] **Step 1: Adicionar o arquivo de cache e os imports**

Em `src/ui/main.ts`, junto das outras constantes de arquivo:

```ts
const INTENSIDADE_FILE = "intensidade.json";
```

Nos imports:

```ts
import {
  CACHE_VAZIO,
  parseCacheIntensidade,
  ritmo,
} from "../intensidade.ts";
```

E acrescentar `medirBiblioteca` ao import que ja vem de `../premiere.ts`.

- [ ] **Step 2: Medir antes de planejar**

Em `analisarSequencia`, entre o bloco do `julgarFaixa` e o `if
(resultado.oportunidades.length === 0)`, inserir:

```ts
    // Medir a biblioteca: primeira vez custa dezenas de segundos, depois nada.
    const cache = parseCacheIntensidade(
      await comLimite("ler intensidade", readJson(INTENSIDADE_FILE), 5000)
    );
    let medido = cache;
    try {
      medido = await comLimite(
        "medir intensidade",
        medirBiblioteca(arquivos, cache, (feitos, total) =>
          registrar(`  medindo intensidade: ${feitos} de ${total}`, "passo")
        ),
        300000
      );
      if (medido !== cache) await writeJson(INTENSIDADE_FILE, medido);
    } catch (e) {
      registrar(`Intensidade nao medida, seguindo sem ela. ${mensagemDeErro(e)}`, "aviso");
      medido = CACHE_VAZIO;
    }
```

- [ ] **Step 3: Passar para o planejador**

Trocar a chamada de `planejar`:

```ts
    const porArquivo = new Map<string, number>();
    for (const [nome, valor] of Object.entries(medido.arquivos)) {
      if (valor !== null) porArquivo.set(nome, valor);
    }

    const plano = planejar(
      resultado.oportunidades,
      { caminhos: new Map(arquivos.map((a) => [a.name, a.nativePath])) },
      undefined,
      memoria,
      { porArquivo, ritmoDasFrases: resultado.frases.map((f) => ritmo(f.palavras, f.duracao)) }
    );
```

- [ ] **Step 4: Rodar o gate**

Run: `npm run verify`
Expected: PASS.

- [ ] **Step 5: Documentar**

Em `docs/DECISIONS.md`, antes de `## D-008`, adicionar D-019 registrando: o
problema (5 conceitos com 167 arquivos), a medida escolhida (bytes por quadro por
pixel do `stsz`), por que percentil e nao escala absoluta, a ordem
intensidade-filtra/historico-escolhe, o destravamento do D-017, e os limites
(movimento nao e emocao; proxy erra em fundo ocupado).

Em `docs/BUILD_STATUS.md`: acrescentar `src/intensidade.ts` a estrutura,
`intensidade.json` a lista de arquivos de estado, atualizar a contagem de testes,
e trocar o "Proximo passo exato" por: conferir no Premiere que a primeira analise
mede os 260, que a segunda nao remede, e que takes diferentes passam a aparecer
para falas de ritmos diferentes.

- [ ] **Step 6: Commit**

```bash
git add src/ui/main.ts docs/
git commit -m "Ligar a intensidade no painel, com cache e progresso"
```

---

## Ordem e dependencias

1 → 2 → 3 sao independentes entre si na leitura, mas 3 consome 1 e 2. A 4 consome
a 1. A 5 consome todas. Executar em ordem.

Depois da 3 o comportamento ja e o novo, mas sem medida nenhuma chegando — ou
seja, identico ao de hoje. So a 5 acende a funcionalidade.

## Verificacao final, dentro do Premiere

O gate automatico nao cobre nada disto. Reiniciar o Premiere e conferir:

1. Primeira analise mostra `medindo intensidade: 25 de 260`... e termina.
2. `intensidade.json` aparece na pasta de dados do plugin com 260 entradas.
3. Segunda analise **nao** mostra linha de medicao nenhuma.
4. Algum motivo no log traz `· take agitado, a fala corre aqui` ou
   `· take parado, momento calmo`.
5. Rodar em duas sequencias de ritmos diferentes e ver se os takes escolhidos
   para o mesmo conceito mudam.
