/*
 * Correcao de grafia sobre o array de palavras: coloquial, e/e, porques e
 * termos protegidos. Todas percorrem a mesma estrutura e por isso moram juntas.
 *
 * Puro: nao conhece o Premiere, nao faz I/O.
 *
 * Regra do modulo: quando a evidencia nao basta, o texto fica como esta e a
 * duvida vai para `sugestao` — a UI oferece a troca. Nunca inventar palavra.
 */

import type { Preset } from "./preset.ts";
import type { PalavraEditada } from "./transcript.ts";

export interface PalavraRevisada {
  readonly text: string;
  /** Segundos na sequencia. */
  readonly inicio: number;
  readonly fim: number;
  readonly confidence: number;
  readonly eos: boolean;
  /** Troca proposta que o produto nao teve evidencia para aplicar sozinho. */
  readonly sugestao: string | null;
  readonly motivo: string | null;
}

export function deTranscricao(palavras: readonly PalavraEditada[]): PalavraRevisada[] {
  return palavras.map((p) => ({
    text: p.text,
    inicio: p.inicio,
    fim: p.fim,
    confidence: p.confidence,
    eos: p.eos,
    sugestao: null,
    motivo: null,
  }));
}

/**
 * Separa a palavra da pontuacao que veio grudada.
 *
 * O Premiere entrega "relógio." como um token so. Sem separar, nenhuma regra
 * casa com a ultima palavra da frase — que e justamente onde mora o `eos`.
 *
 * NAO tira acento: em portugues "esta" e "está" sao palavras diferentes.
 */
export function nucleo(texto: string): { corpo: string; sufixo: string } {
  const casou = /^(.*?)([.,!?;:…]*)$/u.exec(texto);
  if (!casou) return { corpo: texto, sufixo: "" };
  return { corpo: casou[1] ?? texto, sufixo: casou[2] ?? "" };
}

/** Aplica a caixa da palavra original na substituta: "Para" -> "Pra". */
function comCaixaDe(modelo: string, novo: string): string {
  const primeira = modelo[0];
  if (primeira === undefined) return novo;
  if (primeira !== primeira.toUpperCase()) return novo;
  return novo.charAt(0).toUpperCase() + novo.slice(1);
}

/** Trocas de uma palavra so. Chave em minuscula, sem pontuacao. */
const SIMPLES: ReadonlyMap<string, string> = new Map([
  ["para", "pra"],
  ["estava", "tava"],
  ["estavam", "tavam"],
  ["está", "tá"],
  ["estão", "tão"],
  ["estou", "tô"],
]);

/** Trocas que consomem DUAS palavras. Chave: "primeira segunda". */
const PARES: ReadonlyMap<string, string> = new Map([
  ["para o", "pro"],
  ["para os", "pros"],
]);

/**
 * Aplica so as reducoes aprovadas na spec.
 *
 * Deliberadamente NAO faz "você"->"cê", "vamos"->"vamo", "estamos"->"tamo":
 * a spec proibe reducao agressiva sem regra explicita.
 *
 * O par "para o" funde duas palavras numa: a palavra resultante herda o inicio
 * da primeira e o fim da segunda, senao "pro" apareceria antes de ser falado.
 */
export function normalizarColoquial(palavras: readonly PalavraRevisada[]): PalavraRevisada[] {
  const saida: PalavraRevisada[] = [];
  let i = 0;

  while (i < palavras.length) {
    const atual = palavras[i];
    if (atual === undefined) {
      i++;
      continue;
    }

    const a = nucleo(atual.text);
    const seguinte = palavras[i + 1];

    if (seguinte !== undefined) {
      const b = nucleo(seguinte.text);
      const par = PARES.get(`${a.corpo.toLowerCase()} ${b.corpo.toLowerCase()}`);
      if (par !== undefined) {
        saida.push({
          ...atual,
          text: comCaixaDe(a.corpo, par) + b.sufixo,
          // Fim da SEGUNDA: a legenda nao pode terminar antes da fala.
          fim: seguinte.fim,
          confidence: Math.min(atual.confidence, seguinte.confidence),
          eos: seguinte.eos,
        });
        i += 2;
        continue;
      }
    }

    const troca = SIMPLES.get(a.corpo.toLowerCase());
    if (troca !== undefined) {
      saida.push({ ...atual, text: comCaixaDe(a.corpo, troca) + a.sufixo });
      i++;
      continue;
    }

    saida.push(atual);
    i++;
  }

  return saida;
}

/* --------------------------------------------------------------- é / e */

/**
 * Palavras que, imediatamente antes de "e", indicam verbo de ligacao.
 *
 * Sujeito seguido de "e" quase sempre pede o verbo: "isso e", "ele e",
 * "nome e". A conjuncao aparece depois de verbo ("chegou e") ou de
 * substantivo em enumeracao ("saúde e"), que ficam de fora desta lista.
 */
const SUJEITOS: ReadonlySet<string> = new Set([
  "isso", "isto", "aquilo", "ele", "ela", "eles", "elas",
  "nome", "problema", "questao", "questão", "objetivo", "resultado", "segredo",
  "verdade", "diferenca", "diferença", "motivo", "causa", "tudo", "nada",
]);
// "você" fica de fora de proposito: a propria spec usa "Você e sua esposa"
// como exemplo de conjuncao. Perde-se "você é importante"; o inverso erraria
// numa construcao mais comum.

/**
 * Corrige "e" para "é" quando o contexto indica verbo.
 *
 * Nao confia so na saida acustica: o ASR troca os dois o tempo todo. Na duvida
 * mantem o que veio — errar para "é" numa enumeracao e mais visivel na tela do
 * que o contrario.
 */
export function corrigirEAcento(palavras: readonly PalavraRevisada[]): PalavraRevisada[] {
  return palavras.map((palavra, i) => {
    const atual = nucleo(palavra.text);
    if (atual.corpo.toLowerCase() !== "e") return palavra;

    const anterior = palavras[i - 1];
    const seguinte = palavras[i + 1];
    const antes = anterior === undefined ? "" : nucleo(anterior.text).corpo.toLowerCase();
    const depois = seguinte === undefined ? "" : nucleo(seguinte.text).corpo.toLowerCase();

    // "é por isso que..."
    const abreExplicacao =
      depois === "por" && nucleo(palavras[i + 2]?.text ?? "").corpo.toLowerCase() === "isso";

    if (SUJEITOS.has(antes) || abreExplicacao) {
      return { ...palavra, text: comCaixaDe(atual.corpo, "é") + atual.sufixo };
    }
    return palavra;
  });
}

/* ------------------------------------------------------------- porquês */

/** Abre pergunta indireta ou direta: pede "por que" separado. */
const INTERROGATIVOS: ReadonlySet<string> = new Set([
  "sabe", "sabia", "sabem", "entende", "entendeu", "imagina", "adivinha", "explica",
]);

const ARTIGOS: ReadonlySet<string> = new Set(["o", "um", "esse", "este", "aquele", "meu", "seu"]);

/**
 * Escolhe entre as quatro formas.
 *
 * A decisao olha a oracao inteira, por isso roda ANTES da segmentacao: depois
 * de partir em blocos, o fim da oracao ja nao e visivel.
 */
export function corrigirPorques(palavras: readonly PalavraRevisada[]): PalavraRevisada[] {
  // Junta "por"+"que" num indice so para tratar as duas grafias igual.
  const alvos: Array<{ i: number; consome: number; sufixo: string; caixa: string }> = [];
  for (let i = 0; i < palavras.length; i++) {
    const atual = palavras[i];
    if (atual === undefined) continue;
    const a = nucleo(atual.text);
    const corpo = a.corpo.toLowerCase();

    if (corpo === "porque" || corpo === "porquê") {
      alvos.push({ i, consome: 1, sufixo: a.sufixo, caixa: a.corpo });
      continue;
    }
    if (corpo === "por") {
      const seguinte = palavras[i + 1];
      if (seguinte === undefined) continue;
      const b = nucleo(seguinte.text);
      const corpoB = b.corpo.toLowerCase();
      if (corpoB === "que" || corpoB === "quê") {
        alvos.push({ i, consome: 2, sufixo: b.sufixo, caixa: a.corpo });
      }
    }
  }

  if (alvos.length === 0) return [...palavras];

  const saida: PalavraRevisada[] = [];
  let i = 0;
  let a = 0;

  while (i < palavras.length) {
    const alvo = alvos[a];
    const atual = palavras[i];
    if (atual === undefined) {
      i++;
      continue;
    }
    if (alvo === undefined || alvo.i !== i) {
      saida.push(atual);
      i++;
      continue;
    }
    a++;

    const ultimo = palavras[i + alvo.consome - 1] ?? atual;
    const anterior = palavras[i - 1];
    const antes = anterior === undefined ? "" : nucleo(anterior.text).corpo.toLowerCase();

    // Onde termina a oracao: usado para achar a interrogacao.
    let fimDaOracao = i + alvo.consome;
    while (fimDaOracao < palavras.length) {
      const p = palavras[fimDaOracao];
      fimDaOracao++;
      if (p === undefined || p.eos) break;
    }
    const nadaDepois = i + alvo.consome >= palavras.length;

    // Onde comeca a oracao: para procurar o gatilho de pergunta so nela.
    let inicioDaOracao = i;
    while (inicioDaOracao > 0) {
      const p = palavras[inicioDaOracao - 1];
      if (p === undefined || p.eos) break;
      inicioDaOracao--;
    }

    let interrogativa = false;
    for (let j = inicioDaOracao; j < i; j++) {
      const p = palavras[j];
      if (p !== undefined && INTERROGATIVOS.has(nucleo(p.text).corpo.toLowerCase())) interrogativa = true;
    }
    for (let j = i; j < fimDaOracao; j++) {
      if ((palavras[j]?.text ?? "").includes("?")) interrogativa = true;
    }

    let forma: string;
    if (ARTIGOS.has(antes)) forma = "porquê";
    else if (nadaDepois) forma = "por quê";
    else if (interrogativa) forma = "por que";
    else forma = "porque";

    saida.push({
      ...atual,
      text: comCaixaDe(alvo.caixa, forma) + alvo.sufixo,
      fim: ultimo.fim,
      eos: ultimo.eos,
      confidence: Math.min(atual.confidence, ultimo.confidence),
    });
    i += alvo.consome;
  }

  return saida;
}

/* ----------------------------------------------------- termos protegidos */

/** Distancia de edicao de Levenshtein. Duas linhas de matriz bastam. */
export function distancia(a: string, b: string): number {
  if (a === b) return 0;
  if (a.length === 0) return b.length;
  if (b.length === 0) return a.length;

  let anterior = Array.from({ length: b.length + 1 }, (_, i) => i);
  let atual = new Array<number>(b.length + 1).fill(0);

  for (let i = 1; i <= a.length; i++) {
    atual[0] = i;
    for (let j = 1; j <= b.length; j++) {
      const custo = a[i - 1] === b[j - 1] ? 0 : 1;
      atual[j] = Math.min(
        (atual[j - 1] ?? 0) + 1,
        (anterior[j] ?? 0) + 1,
        (anterior[j - 1] ?? 0) + custo
      );
    }
    const troca = anterior;
    anterior = atual;
    atual = troca;
  }
  return anterior[b.length] ?? 0;
}

/** Forma comparavel: minuscula, sem acento, so letras e digitos. */
function comparavel(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

/**
 * Aplica o vocabulario protegido.
 *
 * Duas rotas, deliberadamente diferentes:
 *
 * - **Erro proximo** (`andro clinica` -> `Androclinic`): a distancia de edicao
 *   sozinha ja e evidencia, e a troca acontece.
 * - **Erro distante** (`Equivalente` no lugar de `Estivalet`): a distancia nao
 *   ajuda, so o contexto — a palavra vem logo depois de "Cristiano". Contexto
 *   sozinho NAO autoriza reescrever a fala, entao o texto fica como esta e a
 *   duvida vai para `sugestao`, que a fila de revisao mostra ao usuario.
 *
 * E o que a spec pede na secao 5: preferir revisao manual rapida a inventar
 * uma palavra.
 */
export function protegerTermos(
  palavras: readonly PalavraRevisada[],
  preset: Preset
): PalavraRevisada[] {
  /** Cada termo dividido em palavras, com a forma comparavel de cada uma. */
  const termos = preset.termosProtegidos.map((t) => {
    const partes = t.split(" ");
    return { canonico: t, partes, chaves: partes.map(comparavel) };
  });

  const saida: PalavraRevisada[] = [];
  let i = 0;

  while (i < palavras.length) {
    const atual = palavras[i];
    if (atual === undefined) {
      i++;
      continue;
    }

    let aplicou = false;

    for (const termo of termos) {
      // A janela vai UMA palavra alem do termo porque o erro tipico do ASR e
      // partir a palavra: "Androclinic" tem uma parte so, mas chega como
      // "andro clinic". Ir muito alem disso so aumentaria fusao indevida.
      const maxJanela = termo.partes.length + 1;
      for (let n = 1; n <= maxJanela && i + n <= palavras.length; n++) {
        const janela = palavras.slice(i, i + n);
        const juntas = comparavel(janela.map((p) => nucleo(p.text).corpo).join(""));
        const alvo = termo.chaves.join("");

        // Tolerancia proporcional: 1 erro a cada 5 caracteres, minimo 1.
        const limite = Math.max(1, Math.floor(alvo.length / 5));
        if (juntas.length === 0 || distancia(juntas, alvo) > limite) continue;

        // A janela tem de COMECAR onde o termo comeca.
        //
        // Sem isto, uma palavra curta antes do termo entra de graca: a janela
        // "é Cristiano Estivalet" vira "ecristianoestivalet", que fica a 1 de
        // distancia do alvo e passa na tolerancia — engolindo o "é". Erro de
        // ASR na primeira letra cai na fila de revisao, que e o lado seguro.
        if (juntas[0] !== alvo[0]) continue;

        const ultima = janela[janela.length - 1] ?? atual;
        saida.push({
          ...atual,
          text: termo.canonico + nucleo(ultima.text).sufixo,
          fim: ultima.fim,
          eos: ultima.eos,
          confidence: Math.min(...janela.map((p) => p.confidence)),
          sugestao: null,
          motivo: null,
        });
        i += n;
        aplicou = true;
        break;
      }
      if (aplicou) break;
    }
    if (aplicou) continue;

    // Contexto: palavra logo depois de uma parte inicial de termo composto.
    const anterior = palavras[i - 1];
    let sugestao: string | null = null;
    if (anterior !== undefined) {
      const chaveAnterior = comparavel(nucleo(anterior.text).corpo);
      for (const termo of termos) {
        if (termo.partes.length < 2) continue;
        if (termo.chaves[0] !== chaveAnterior) continue;
        const esperada = termo.partes[1];
        if (esperada === undefined) continue;
        if (comparavel(nucleo(atual.text).corpo) === comparavel(esperada)) break;
        sugestao = esperada;
        break;
      }
    }

    saida.push(
      sugestao === null
        ? atual
        : { ...atual, sugestao, motivo: `esperado depois de "${nucleo(anterior?.text ?? "").corpo}"` }
    );
    i++;
  }

  return saida;
}
