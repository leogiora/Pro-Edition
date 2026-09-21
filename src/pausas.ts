/*
 * Auto Pausas — logica pura. Sem DOM, sem Premiere, roda no node --test.
 *
 * A regra inteira mora aqui: onde cortar, quanto sobra de margem e onde cada
 * trecho que fica passa a comecar. O adapter so executa o que este arquivo
 * decidiu — e e por isso que da para testar o corte sem abrir o Premiere.
 */

/** Palavra da transcricao ja em tempo de SEQUENCIA (segundos). */
export interface Palavra {
  readonly texto: string;
  readonly inicio: number;
  readonly fim: number;
}

/** Um pedaco que sai. `antes`/`depois` sao as palavras vizinhas (vazio na borda). */
export interface Corte {
  readonly inicioQ: number;
  readonly fimQ: number;
  readonly antes: string;
  readonly depois: string;
}

/** Um pedaco que fica, e para onde ele vai depois que a timeline fecha. */
export interface TrechoMantido {
  readonly inicioQ: number;
  readonly fimQ: number;
  readonly destinoQ: number;
}

export interface Plano {
  readonly trechos: readonly TrechoMantido[];
  readonly cortes: readonly Corte[];
  readonly duracaoAntesQ: number;
  readonly duracaoDepoisQ: number;
}

/** Deixa ~0,16 s entre frases. Calibrado com anuncio real na Task 7. */
export const MARGEM_PADRAO_S = 0.08;

/** Abaixo disso o corte so da tranco na imagem sem ganhar tempo. */
export const MIN_CORTE_QUADROS = 2;

export interface OpcoesPlano {
  readonly fps: number;
  readonly duracaoQ: number;
  readonly margemS: number;
}

/** Quanto cada trecho recua na timeline depois que os buracos fecham. */
export function deslocamentos(plano: Plano): Array<{ trecho: TrechoMantido; andarQ: number }> {
  return plano.trechos.map((trecho) => ({ trecho, andarQ: trecho.inicioQ - trecho.destinoQ }));
}

/**
 * Qual instante da MIDIA um trecho tem de mostrar.
 *
 * A copia que o Premiere cria ao cortar nasce com o ponto de entrada do pai
 * (provado ao vivo: os tres pedacos vieram com `in=0.00`). Sem corrigir, cada
 * pedaco voltaria a tocar o video desde o comeco. `base` e o clipe inteiro
 * antes de qualquer corte.
 */
export function fonteDoTrecho(
  base: { readonly baseInicioQ: number; readonly baseFonteQ: number },
  inicioQ: number
): number {
  return base.baseFonteQ + (inicioQ - base.baseInicioQ);
}

/**
 * Traduz `PalavraEditada` (a transcricao remontada pelo Auto B-roll) para a
 * `Palavra` daqui. Palavra de duracao zero entraria como pausa de graca e
 * sairia no corte: descartar e mais honesto do que cortar em cima dela.
 */
export function montarPalavras(
  palavrasEditadas: ReadonlyArray<{ text: string; inicio: number; fim: number }>
): Palavra[] {
  return palavrasEditadas
    .filter((p) => p.fim > p.inicio)
    .map((p) => ({ texto: p.text, inicio: p.inicio, fim: p.fim }));
}

/**
 * Prova de que o corte nao comeu fala: as mesmas palavras, na mesma ordem.
 *
 * A duracao NAO entra: a transcricao estica o fim da palavra por cima do
 * silencio (no 26 atual sempre), e cortar esse silencio e exatamente o trabalho
 * da ferramenta. Palavra que sumiu e a que teve o INICIO cortado — a remontagem
 * da transcricao so traz palavra cujo inicio esta dentro de um trecho que ficou.
 *
 * Roda sobre a transcricao relida DA TIMELINE depois de aplicar, nunca sobre o plano.
 */
export function conferirPalavras(
  antes: readonly Palavra[],
  depois: readonly Palavra[]
): { ok: boolean; linhas: string[] } {
  const sumiram: string[] = [];
  let j = 0;
  for (const a of antes) {
    if (j < depois.length && depois[j]!.texto === a.texto) j++;
    else sumiram.push(`"${a.texto}" (${a.inicio.toFixed(2)} s) sumiu`);
  }
  const sobrando = depois.length - j;
  const presentes = antes.length - sumiram.length;

  if (sumiram.length === 0 && sobrando === 0) {
    return { ok: true, linhas: [`${antes.length} de ${antes.length} palavras presentes.`] };
  }
  return {
    ok: false,
    linhas: [
      `${presentes} de ${antes.length} palavras presentes:`,
      ...sumiram.slice(0, 10),
      ...(sumiram.length > 10 ? [`e mais ${sumiram.length - 10}`] : []),
      ...(sobrando > 0 ? [`${sobrando} palavra(s) a mais ou fora de ordem`] : []),
    ],
  };
}

/** mm:ss a partir de quadros. O painel nunca mostra quadro cru. */
export function relogio(quadros: number, fps: number): string {
  const s = Math.max(0, Math.round(quadros / fps));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function planejarCortes(palavras: readonly Palavra[], opcoes: OpcoesPlano): Plano {
  const { fps, duracaoQ, margemS } = opcoes;
  if (!(fps > 0)) throw new Error(`fps invalido: ${fps}`);
  if (!(duracaoQ > 0)) throw new Error(`duracao invalida: ${duracaoQ}`);

  if (palavras.length === 0) {
    return { trechos: [], cortes: [], duracaoAntesQ: duracaoQ, duracaoDepoisQ: duracaoQ };
  }

  const emOrdem = [...palavras].sort((a, b) => a.inicio - b.inicio);
  const cortes: Corte[] = [];

  // Arredondar SEMPRE para dentro da pausa: o comeco sobe, o fim desce. E o que
  // garante que o corte nunca entra numa palavra.
  const inicioDoCorte = (segundos: number) => Math.ceil(segundos * fps);
  const fimDoCorte = (segundos: number) => Math.floor(segundos * fps);

  const juntar = (inicioQ: number, fimQ: number, antes: string, depois: string) => {
    const dentro = { inicio: Math.max(0, inicioQ), fim: Math.min(duracaoQ, fimQ) };
    if (dentro.fim - dentro.inicio < MIN_CORTE_QUADROS) return;
    cortes.push({ inicioQ: dentro.inicio, fimQ: dentro.fim, antes, depois });
  };

  const primeira = emOrdem[0]!;
  juntar(0, fimDoCorte(primeira.inicio - margemS), "", primeira.texto);

  // `fimMaximo` e nao `p.fim`: com palavras sobrepostas, o fim da anterior pode
  // cair depois do fim da seguinte, e a conta viraria um corte ao contrario.
  let fimMaximo = primeira.fim;
  for (let i = 0; i + 1 < emOrdem.length; i++) {
    const p = emOrdem[i]!;
    const q = emOrdem[i + 1]!;
    fimMaximo = Math.max(fimMaximo, p.fim);
    juntar(inicioDoCorte(fimMaximo + margemS), fimDoCorte(q.inicio - margemS), p.texto, q.texto);
  }

  const ultima = emOrdem[emOrdem.length - 1]!;
  juntar(inicioDoCorte(Math.max(fimMaximo, ultima.fim) + margemS), duracaoQ, ultima.texto, "");

  // O que sobra entre um corte e o outro e o que fica, colado a partir do zero.
  const trechos: TrechoMantido[] = [];
  let cursor = 0;
  let destino = 0;
  const guardar = (inicioQ: number, fimQ: number) => {
    if (fimQ <= inicioQ) return;
    trechos.push({ inicioQ, fimQ, destinoQ: destino });
    destino += fimQ - inicioQ;
  };
  for (const corte of cortes) {
    guardar(cursor, corte.inicioQ);
    cursor = corte.fimQ;
  }
  guardar(cursor, duracaoQ);

  return { trechos, cortes, duracaoAntesQ: duracaoQ, duracaoDepoisQ: destino };
}

// ------------------------------------------------------------ fala no audio

/**
 * Como a fala e achada no nivel do audio. Pontos de partida da revisao de
 * 2026-09-21; a calibracao com uma bruta real troca pelos numeros medidos.
 */
export interface OpcoesFala {
  /** Janela conta como SOM quando passa do piso (ruido da sala) por isto. */
  readonly somAcimaDoPisoDb: number;
  /** Janela conta como VOZ FORTE quando fica a menos disto do nivel tipico da fala. */
  readonly vozAbaixoDoTipicoDb: number;
  /** Buraco de voz menor que isto nao separa dois pedacos (fechamento de "p", "t", "k"). */
  readonly buracoMaxS: number;
  /** Quanto antes da voz forte um inicio de palavra ainda pertence a ela (ataque fraco: "s", "f"). */
  readonly ataqueMaxS: number;
  /** Quanto som fraco depois da voz forte fica, como final de palavra. */
  readonly caudaMaxS: number;
  /** Voz forte sem nenhuma palavra: a partir deste tamanho fica (pode ser fala nao transcrita). */
  readonly vozSemPalavraMinS: number;
  /** Tamanho maximo do bloco de uma palavra que comeca no silencio. */
  readonly protecaoMaxS: number;
}

export const FALA_PADRAO: OpcoesFala = {
  somAcimaDoPisoDb: 10,
  vozAbaixoDoTipicoDb: 20,
  buracoMaxS: 0.15,
  ataqueMaxS: 0.15,
  caudaMaxS: 0.15,
  vozSemPalavraMinS: 0.25,
  protecaoMaxS: 0.5,
};

export type MotivoBloco = "fala" | "voz-sem-palavra" | "palavra-baixa";

/** Um pedaco que fica. `texto` sao as palavras que comecam nele. */
export interface Bloco extends Palavra {
  readonly motivo: MotivoBloco;
}

const EPS = 1e-9;

/** Valor na posicao `q` (0..1) dos valores em ordem. */
function percentil(valores: readonly number[], q: number): number {
  const ordenado = [...valores].sort((a, b) => a - b);
  return ordenado[Math.min(ordenado.length - 1, Math.floor(ordenado.length * q))]!;
}

/**
 * Onde tem fala, lido do AUDIO. A transcricao entra so com o inicio de cada
 * palavra — a parte que o Premiere 26 atual ainda marca direito.
 *
 * `db` e o nivel de um canal por janela de `janelaS` segundos, com o zero no
 * mesmo relogio das palavras (tempo de sequencia). O que nao vira bloco e
 * pausa: silencio, respiro, estalo.
 *
 * Nenhum dB fixo: piso (percentil 20) e voz tipica (percentil 90) saem da
 * propria gravacao, entao uma bruta mais baixa da o mesmo resultado.
 */
export function blocosDeFala(
  db: readonly number[],
  janelaS: number,
  palavras: readonly Palavra[],
  opcoes: OpcoesFala = FALA_PADRAO
): Bloco[] {
  const limiarSom = db.length > 0 ? percentil(db, 0.2) + opcoes.somAcimaDoPisoDb : Infinity;
  const limiarVoz = db.length > 0 ? Math.max(limiarSom, percentil(db, 0.9) - opcoes.vozAbaixoDoTipicoDb) : Infinity;
  const t = (janela: number) => janela * janelaS;

  // 1. Nucleos de voz forte. Buraco curto (fechamento de consoante) nao separa.
  const nucleos: Array<{ de: number; ate: number }> = [];
  for (let i = 0; i < db.length; i++) {
    if (db[i]! <= limiarVoz) continue;
    const ultimo = nucleos[nucleos.length - 1];
    if (ultimo && (i - ultimo.ate) * janelaS < opcoes.buracoMaxS - EPS) ultimo.ate = i + 1;
    else nucleos.push({ de: i, ate: i + 1 });
  }

  // O final fraco da palavra ("s", "f") fica, ate o som acabar ou ate caudaMaxS.
  const cauda = (ate: number) => {
    let j = ate;
    while (j < db.length && (j + 1 - ate) * janelaS <= opcoes.caudaMaxS + EPS && db[j]! > limiarSom) j++;
    return t(j);
  };
  const protegida = (p: Palavra): Bloco => ({
    texto: p.texto,
    inicio: p.inicio,
    fim: p.inicio + Math.min(Math.max(p.fim - p.inicio, janelaS), opcoes.protecaoMaxS),
    motivo: "palavra-baixa",
  });

  // 2. Cada nucleo leva as palavras que comecam nele ou no ataque logo antes.
  const emOrdem = [...palavras].sort((a, b) => a.inicio - b.inicio);
  const blocos: Bloco[] = [];
  let k = 0;
  for (const n of nucleos) {
    const de = t(n.de);
    const ate = t(n.ate);
    while (k < emOrdem.length && emOrdem[k]!.inicio < de - opcoes.ataqueMaxS - EPS) blocos.push(protegida(emOrdem[k++]!));
    const primeira = k;
    while (k < emOrdem.length && emOrdem[k]!.inicio < ate - EPS) k++;
    const dele = emOrdem.slice(primeira, k);

    if (dele.length === 0) {
      // Voz sem palavra: longa fica (pode ser fala que a transcricao pulou); curta e estalo.
      if (ate - de >= opcoes.vozSemPalavraMinS - EPS) {
        blocos.push({ texto: "", inicio: de, fim: cauda(n.ate), motivo: "voz-sem-palavra" });
      }
      continue;
    }
    blocos.push({
      texto: dele.map((p) => p.texto).join(" "),
      inicio: Math.min(de, dele[0]!.inicio),
      fim: cauda(n.ate),
      motivo: "fala",
    });
  }
  while (k < emOrdem.length) blocos.push(protegida(emOrdem[k++]!));

  // 3. Blocos que se tocam viram um so.
  blocos.sort((a, b) => a.inicio - b.inicio);
  const juntos: Bloco[] = [];
  for (const b of blocos) {
    const ultimo = juntos[juntos.length - 1];
    if (ultimo && b.inicio <= ultimo.fim + EPS) {
      juntos[juntos.length - 1] = {
        texto: [ultimo.texto, b.texto].filter((x) => x !== "").join(" "),
        inicio: ultimo.inicio,
        fim: Math.max(ultimo.fim, b.fim),
        motivo: ultimo.motivo === "fala" || b.motivo === "fala" ? "fala" : ultimo.motivo,
      };
    } else {
      juntos.push(b);
    }
  }
  return juntos;
}

// ------------------------------------------------------ sequencia separada

/** Um clipe da V1 como o editor deixou, em quadros. */
export interface ClipeNaTimeline {
  /** Onde o clipe esta na sequencia. */
  readonly inicioQ: number;
  readonly fimQ: number;
  /** Quadro da midia que aparece no inicio do clipe (o in point). */
  readonly midiaQ: number;
  /** Qual item do projeto (indice numa lista do adapter). */
  readonly fonte: number;
}

/** Um overwrite: de que item, de que quadro a que quadro da midia, e onde entra. */
export interface Pedaco {
  readonly fonte: number;
  readonly midiaDeQ: number;
  readonly midiaAteQ: number;
  readonly destinoQ: number;
}

/**
 * Divide cada trecho que fica nas emendas que o editor fez ao separar a bruta.
 * Cada pedaco sai do ARQUIVO original (fonte + quadros da midia), nao da
 * timeline.
 *
 * O espaco que o editor deixa entre dois clipes E a separacao dos videos
 * (2026-09-21: ~2-3 s entre cada um dos 10 anuncios de uma bruta): ele fica do
 * mesmo tamanho. Cada video encolhe sozinho e o seguinte comeca depois do mesmo
 * espaco.
 */
export function pedacosDoPlano(
  trechos: readonly TrechoMantido[],
  clipes: readonly ClipeNaTimeline[]
): { pedacos: Pedaco[]; totalQ: number } {
  const emOrdem = [...clipes].sort((a, b) => a.inicioQ - b.inicioQ);
  const pedacos: Pedaco[] = [];
  let destino = 0;
  let fimAnterior = 0;
  // ponytail: clipes x trechos (~200 x 600 numa bruta longa); dois ponteiros se um dia pesar.
  for (const c of emOrdem) {
    destino += Math.max(0, c.inicioQ - fimAnterior);
    fimAnterior = c.fimQ;
    for (const tr of trechos) {
      const de = Math.max(tr.inicioQ, c.inicioQ);
      const ate = Math.min(tr.fimQ, c.fimQ);
      if (ate <= de) continue;
      pedacos.push({
        fonte: c.fonte,
        midiaDeQ: c.midiaQ + (de - c.inicioQ),
        midiaAteQ: c.midiaQ + (ate - c.inicioQ),
        destinoQ: destino,
      });
      destino += ate - de;
    }
  }
  return { pedacos, totalQ: destino };
}

// ------------------------------------------------- audio em tempo de midia

/**
 * O nivel do audio de UM arquivo em tempo de midia: uma posicao por janela,
 * buraco = trecho ainda nao lido. Separar os videos, cortar e desfazer mexem
 * na timeline, nao no arquivo: lido uma vez, serve para qualquer arrumacao.
 */
export type NiveisDaMidia = number[];

/** Janelas da timeline que comecam dentro do clipe. */
function janelasDo(c: ClipeNaTimeline, fps: number, janelaS: number): [number, number] {
  const janela = (q: number) => Math.ceil(q / fps / janelaS - 1e-6);
  return [janela(c.inicioQ), janela(c.fimQ)];
}

/** Que janela da midia toca na janela `w` da timeline. */
function naMidia(c: ClipeNaTimeline, fps: number, janelaS: number, w: number): number {
  return Math.round((c.midiaQ / fps + w * janelaS - c.inicioQ / fps) / janelaS);
}

/** Guarda o que o export da timeline mostrou, em tempo de midia de cada arquivo (`midia[fonte]`). */
export function guardarNaMidia(
  db: readonly number[],
  janelaS: number,
  clipes: readonly ClipeNaTimeline[],
  fps: number,
  midia: NiveisDaMidia[]
): void {
  for (const c of clipes) {
    const alvo = midia[c.fonte]!;
    const [de, ate] = janelasDo(c, fps, janelaS);
    for (let w = de; w < Math.min(ate, db.length); w++) alvo[naMidia(c, fps, janelaS, w)] = db[w]!;
  }
}

/**
 * O nivel da timeline montado do que ja foi lido de cada arquivo, igual ao
 * export da sequencia: o espaco entre os videos e silencio. null = algum
 * trecho da timeline nunca foi lido.
 */
export function montarDaMidia(
  midia: ReadonlyArray<NiveisDaMidia | undefined>,
  janelaS: number,
  clipes: readonly ClipeNaTimeline[],
  fps: number,
  duracaoQ: number,
  silencioDb: number
): number[] | null {
  const db = new Array<number>(Math.ceil(duracaoQ / fps / janelaS - 1e-6)).fill(silencioDb);
  for (const c of clipes) {
    const fonte = midia[c.fonte];
    if (!fonte) return null;
    const [de, ate] = janelasDo(c, fps, janelaS);
    for (let w = de; w < Math.min(ate, db.length); w++) {
      const i = naMidia(c, fps, janelaS, w);
      // Quem guardou pode ter arredondado a borda para a janela vizinha.
      const v = fonte[i] ?? fonte[i - 1] ?? fonte[i + 1];
      if (v === undefined) return null;
      db[w] = v;
    }
  }
  return db;
}

/**
 * O que o audio da timeline toca e onde, com os cortes de lamina desfeitos
 * (lamina nao muda o som). Se isto mudar durante o export, o audio lido pode
 * nao ser o da timeline.
 */
export function desenhoDoAudio(
  clipes: ReadonlyArray<{ readonly inicioQ: number; readonly fimQ: number; readonly midiaQ: number; readonly fonte: string }>
): string {
  const juntos: Array<[number, number, number, string]> = [];
  for (const c of [...clipes].sort((a, b) => a.inicioQ - b.inicioQ)) {
    const u = juntos[juntos.length - 1];
    if (u && u[1] === c.inicioQ && u[3] === c.fonte && u[2] + (u[1] - u[0]) === c.midiaQ) u[1] = c.fimQ;
    else juntos.push([c.inicioQ, c.fimQ, c.midiaQ, c.fonte]);
  }
  return JSON.stringify(juntos);
}

/** Um bloco leva a frase inteira; o registro mostra so a palavra encostada no corte. */
export function ultimaPalavra(texto: string): string {
  return texto.trim().split(/\s+/).pop() || "…";
}

export function primeiraPalavra(texto: string): string {
  return texto.trim().split(/\s+/)[0] || "…";
}

// --------------------------------------------------------- audio do Premiere

/** Vem instalado com o Premiere 26: mono, 16 kHz, 16 bits (~1,9 MB por minuto). */
export const PRESET_WAV = "WAV_Mono_16bit_16kHz.epr";

/**
 * Onde procurar o preset, a pasta da versao que esta rodando primeiro.
 * `versaoHost` e o `uxp.host.version` ("26.0.1" -> "Adobe Premiere Pro 2026").
 *
 * ponytail: so Windows — o Auto Pausas ainda nao roda no Mac.
 */
export function candidatosDoPreset(versaoHost: string, pastasAdobe: readonly string[]): string[] {
  const maior = Number.parseInt(versaoHost, 10);
  const daVersao = Number.isFinite(maior) ? `Adobe Premiere Pro ${2000 + maior}` : "";
  const outras = pastasAdobe
    .filter((n) => n.startsWith("Adobe Premiere Pro") && n !== daVersao)
    .sort()
    .reverse();
  return [daVersao, ...outras]
    .filter((n) => n !== "")
    .map((n) => `C:\\Program Files\\Adobe\\${n}\\Settings\\EncoderPresets\\${PRESET_WAV}`);
}

/**
 * Quantos espacos a transcricao marca entre palavras seguidas. Responde "o
 * Premiere 26 ainda marca pausa?": em 2026-08-10 eram 162 acima de 0,2 s em
 * 974 palavras; o usuario relata que atualizacoes depois disso pararam de marcar.
 */
export function lacunas(palavras: ReadonlyArray<{ readonly start: number; readonly duration: number }>): {
  total: number;
  acima02: number;
  acima05: number;
} {
  let acima02 = 0;
  let acima05 = 0;
  for (let i = 1; i < palavras.length; i++) {
    const anterior = palavras[i - 1]!;
    const espaco = palavras[i]!.start - (anterior.start + anterior.duration);
    if (espaco > 0.2) acima02++;
    if (espaco > 0.5) acima05++;
  }
  return { total: palavras.length, acima02, acima05 };
}
