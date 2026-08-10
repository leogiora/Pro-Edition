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

/* --------------------------------------------------- contexto monetario */

/** Sinal forte: quando uma destas aparece perto, o numero e valor. */
const GATILHOS: ReadonlySet<string> = new Set([
  "custa", "custava", "custam", "custou", "custar", "valor", "preco",
  "investimento", "pagar", "paga", "pagava", "pagamento", "apenas",
  "sai", "sair", "fica", "ficar",
]);

/** Sinal fraco: sozinha nao decide, mas promove um "por" solto. */
const CONTEXTO_FRACO: ReadonlySet<string> = new Set([
  "ta", "esta", "e", "era", "eram", "hoje", "agora", "so", "somente", "apenas", "sai", "fica",
]);

const MOEDA: ReadonlySet<string> = new Set(["reais", "real"]);

/**
 * Abre o lado "antigo" de uma comparacao de preco: "de X por Y",
 * "era X ... por Y", "custava X ... hoje sai por Y".
 *
 * So vale quando outro preco ja foi confirmado na frase. Ver a segunda passada
 * em `detectarPrecos`.
 */
const ANCORA_DE_COMPARACAO: ReadonlySet<string> = new Set([
  "de", "era", "eram", "custava", "custavam", "valia", "valiam",
]);

/** Quantas palavras antes do numero ainda contam como contexto. */
const JANELA = 4;

export interface Preco extends Numeral {
  /** `media` entra na fila de revisao; `alta` passa direto. */
  readonly certeza: "alta" | "media";
}

/** O bloco final do preco, ja no padrao fechado da spec. Nunca usa "R$". */
export function textoDoPreco(valor: number): string {
  return `${formatarBRL(valor)} REAIS`;
}

/**
 * Decide quais numeros da frase sao dinheiro.
 *
 * A classificacao acontece ANTES da formatacao, senao "mais de mil homens"
 * viraria "1.000 REAIS". Quando nao ha sinal nenhum, o numero fica como texto
 * normal — o produto prefere revisao manual a inventar preco.
 *
 * Limitacao conhecida: "de X por cento" e lido como preco, nao como
 * porcentagem. A desambiguacao usa o "de" que abre o padrao, entao
 * "noventa por cento" (sem "de") continua sendo porcentagem.
 */
export function detectarPrecos(palavras: readonly string[]): Preco[] {
  const numerais = acharNumerais(palavras);
  const chave = (i: number): string => {
    const t = palavras[i];
    return t === undefined ? "" : chaveNumeral(t);
  };

  const saida: Preco[] = [];

  for (let n = 0; n < numerais.length; n++) {
    const num = numerais[n];
    if (num === undefined) continue;

    const anterior = chave(num.inicio - 1);
    const seguinte = chave(num.fim + 1);
    const depois = chave(num.fim + 2);
    const proximo = numerais[n + 1];

    // Padrao "de X por Y": os dois numeros sao preco. Verificado antes da
    // porcentagem, senao "de mil por cento e noventa e sete" seria descartado.
    if (anterior === "de" && seguinte === "por" && proximo !== undefined && proximo.inicio === num.fim + 2) {
      saida.push({ ...num, certeza: "alta" });
      saida.push({ ...proximo, certeza: "alta" });
      n++; // o proximo ja foi consumido
      continue;
    }

    // Porcentagem: "noventa por cento". Nao e dinheiro — e o "cento" que vem
    // logo depois tambem nao. Sem consumir os dois, "cento" seria lido sozinho
    // como um preco de 100.
    if (seguinte === "por" && depois === "cento") {
      if (proximo !== undefined && proximo.inicio === num.fim + 2) n++;
      continue;
    }

    // A moeda dita confirma sozinha.
    if (MOEDA.has(seguinte)) {
      saida.push({ ...num, certeza: "alta" });
      continue;
    }

    const janela: string[] = [];
    for (let i = Math.max(0, num.inicio - JANELA); i < num.inicio; i++) janela.push(chave(i));

    if (janela.some((w) => GATILHOS.has(w))) {
      saida.push({ ...num, certeza: "alta" });
      continue;
    }

    // "por" colado no numero e indicativo, mas fraco demais sozinho:
    // "por tres motivos" nao e preco. Promove so com apoio na janela.
    if (anterior === "por") {
      const apoiado = janela.some((w) => CONTEXTO_FRACO.has(w));
      saida.push({ ...num, certeza: apoiado ? "alta" : "media" });
    }
  }

  // Segunda passada: o preco antigo da comparacao.
  //
  // "essa consulta que ERA MIL hoje ta POR 197" tem a mesma estrutura do
  // "de X por Y" da secao 2.3, so que com outro verbo — e o primeiro numero
  // nao tem nenhum gatilho colado nele. So da para saber que ele e preco
  // porque o segundo e. Sem esta passada, a secao 16 da spec nao sai certa.
  //
  // Exige um preco ja confirmado na frase, entao "eram mil homens" continua
  // sendo contagem: sem outro preco, nada e promovido.
  const temPrecoConfirmado = saida.some((pr) => pr.certeza === "alta");
  if (temPrecoConfirmado) {
    const jaEhPreco = new Set(saida.map((pr) => pr.inicio));
    for (const num of numerais) {
      if (jaEhPreco.has(num.inicio)) continue;
      if (!ANCORA_DE_COMPARACAO.has(chave(num.inicio - 1))) continue;
      saida.push({ ...num, certeza: "alta" });
    }
    saida.sort((a, b) => a.inicio - b.inicio);
  }

  return saida;
}
