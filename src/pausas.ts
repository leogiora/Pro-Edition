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
 * Prova de que o corte nao comeu fala: mesma sequencia de palavras, cada uma
 * com a mesma duracao. Compara DURACAO e nao posicao — depois do corte a
 * palavra muda de lugar de proposito.
 *
 * Roda sobre a transcricao relida DA TIMELINE depois de aplicar (nunca sobre o
 * plano): o que interessa e o que o Premiere gravou, nao o que pedimos.
 */
export function conferirPalavras(
  antes: readonly Palavra[],
  depois: readonly Palavra[],
  toleranciaS: number
): { ok: boolean; linhas: string[] } {
  const problemas: string[] = [];
  const total = antes.length;

  for (let i = 0; i < total; i++) {
    const a = antes[i]!;
    const d = depois[i];
    if (!d) {
      problemas.push(`palavra ${i + 1} "${a.texto}" sumiu`);
      continue;
    }
    if (d.texto !== a.texto) {
      problemas.push(`palavra ${i + 1}: esperava "${a.texto}", veio "${d.texto}"`);
      continue;
    }
    const encolheu = a.fim - a.inicio - (d.fim - d.inicio);
    // Folga de 1e-6: sem ela, uma diferenca de exatamente um quadro reprova por
    // erro de ponto flutuante (0,0333... sai maior que 1/30 na conta binaria).
    if (encolheu > toleranciaS + 1e-6) {
      problemas.push(`"${a.texto}" encurtou ${encolheu.toFixed(2)}s`);
    }
  }
  if (depois.length > total) problemas.push(`sobraram ${depois.length - total} palavras a mais`);

  if (problemas.length === 0) return { ok: true, linhas: [`${total} de ${total} palavras inteiras.`] };
  return { ok: false, linhas: [`${total - problemas.length} de ${total} palavras inteiras:`, ...problemas] };
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
