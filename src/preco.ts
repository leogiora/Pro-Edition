/*
 * Numeral falado, contexto monetario e formatacao BRL.
 *
 * Puro: nao conhece o Premiere, nao faz I/O.
 */

const UNIDADES: ReadonlyMap<string, number> = new Map([
  ["zero", 0], ["um", 1], ["uma", 1], ["dois", 2], ["duas", 2], ["tres", 3],
  ["quatro", 4], ["cinco", 5], ["seis", 6], ["sete", 7], ["oito", 8], ["nove", 9],
  ["dez", 10], ["onze", 11], ["doze", 12], ["treze", 13], ["quatorze", 14],
  ["catorze", 14], ["quinze", 15], ["dezesseis", 16], ["dezessete", 17],
  ["dezoito", 18], ["dezenove", 19], ["vinte", 20], ["trinta", 30],
  ["quarenta", 40], ["cinquenta", 50], ["sessenta", 60], ["setenta", 70],
  ["oitenta", 80], ["noventa", 90], ["cem", 100], ["cento", 100],
  ["duzentos", 200], ["trezentos", 300], ["quatrocentos", 400],
  ["quinhentos", 500], ["seiscentos", 600], ["setecentos", 700],
  ["oitocentos", 800], ["novecentos", 900],
]);

const MULTIPLICADORES: ReadonlyMap<string, number> = new Map([
  ["mil", 1000], ["milhao", 1000000], ["milhoes", 1000000],
]);

/**
 * Forma comparavel de um token numeral: minuscula, sem acento, sem pontuacao.
 *
 * Tirar acento e seguro AQUI porque o vocabulario numeral nao tem par que so
 * se distinga pelo acento. Nao reaproveitar para texto comum, onde "esta" e
 * "está" sao palavras diferentes.
 */
export function chaveNumeral(texto: string): string {
  return texto
    .normalize("NFD")
    .replace(/\p{Diacritic}/gu, "")
    .toLowerCase()
    .replace(/[^a-z0-9]/g, "");
}

function ehTokenNumeral(texto: string): boolean {
  const k = chaveNumeral(texto);
  return /^\d+$/.test(k) || UNIDADES.has(k) || MULTIPLICADORES.has(k);
}

/**
 * Converte numeral falado em inteiro. `null` quando nao for numeral.
 *
 * Acumula unidades e fecha um bloco a cada multiplicador, que e o que faz
 * "mil novecentos e noventa e sete" virar 1997 e nao 1000997.
 */
export function porExtenso(tokens: readonly string[]): number | null {
  let total = 0;
  let atual = 0;
  let viu = false;

  for (const token of tokens) {
    const k = chaveNumeral(token);
    if (k === "" || k === "e") continue;

    if (/^\d+$/.test(k)) {
      atual += Number(k);
      viu = true;
      continue;
    }

    const mult = MULTIPLICADORES.get(k);
    if (mult !== undefined) {
      // "mil" sozinho vale 1000, nao 0.
      atual = (atual === 0 ? 1 : atual) * mult;
      total += atual;
      atual = 0;
      viu = true;
      continue;
    }

    const unidade = UNIDADES.get(k);
    if (unidade === undefined) return null;
    atual += unidade;
    viu = true;
  }

  return viu ? total + atual : null;
}

/** Inteiro com ponto de milhar brasileiro. Sem "R$", sem centavos. */
export function formatarBRL(valor: number): string {
  const digitos = String(Math.trunc(Math.abs(valor)));
  let saida = "";
  for (let i = 0; i < digitos.length; i++) {
    if (i > 0 && (digitos.length - i) % 3 === 0) saida += ".";
    saida += digitos[i];
  }
  return saida;
}

/** Um trecho de palavras que forma um numero. Indices no array de palavras. */
export interface Numeral {
  readonly inicio: number;
  /** Inclusivo. */
  readonly fim: number;
  readonly valor: number;
}

/**
 * Acha todos os numerais do array. O "e" so junta dois trechos quando ha
 * numeral dos dois lados — senao "sete e homens" viraria um numero so.
 */
export function acharNumerais(palavras: readonly string[]): Numeral[] {
  const saida: Numeral[] = [];
  let i = 0;

  while (i < palavras.length) {
    const atual = palavras[i];
    if (atual === undefined || !ehTokenNumeral(atual)) {
      i++;
      continue;
    }

    let fim = i;
    let j = i + 1;
    while (j < palavras.length) {
      const t = palavras[j];
      if (t !== undefined && ehTokenNumeral(t)) {
        fim = j;
        j++;
        continue;
      }
      const proximo = palavras[j + 1];
      if (t !== undefined && chaveNumeral(t) === "e" && proximo !== undefined && ehTokenNumeral(proximo)) {
        j += 2;
        fim = j - 1;
        continue;
      }
      break;
    }

    const valor = porExtenso(palavras.slice(i, fim + 1));
    if (valor !== null) saida.push({ inicio: i, fim, valor });
    i = fim + 1;
  }

  return saida;
}
