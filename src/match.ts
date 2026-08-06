/*
 * Casamento entre uma frase da transcricao e os conceitos da biblioteca.
 *
 * A biblioteca tem 260 arquivos e apenas 32 conceitos distintos, com nomes
 * escritos por gente e no mesmo vocabulario da fala ("Falhou na cama",
 * "Teleconsulta", "Vasos sanguineos"). Isso torna o casamento um problema de
 * texto contra texto sobre 32 rotulos, nao de entendimento de video.
 *
 * Comeca simples e explicavel, como manda a secao 11 do CLAUDE.md: sobreposicao
 * de termos, com o motivo sempre visivel. Se a qualidade nao bastar, o proximo
 * degrau e embedding de texto — nao de imagem.
 *
 * Puro: nao conhece o Premiere, nao faz I/O.
 */

/** Palavras sem valor semantico para o casamento. */
const PARADAS = new Set([
  "que", "com", "para", "por", "uma", "uns", "umas", "dos", "das", "nos", "nas",
  "ele", "ela", "eles", "elas", "isso", "isto", "aquilo", "seu", "sua", "meu",
  "minha", "voce", "vocs", "nao", "sim", "mas", "como", "quando", "onde", "porque",
  "muito", "mais", "menos", "tudo", "todo", "toda", "todos", "todas", "ser",
  "estar", "tem", "ter", "foi", "sao", "era", "esta", "essa", "esse", "aqui",
  "ali", "lah", "ja", "ainda", "entao", "assim", "bem", "vai", "vou", "pode",
]);

/**
 * Reduz uma palavra a um radical grosseiro.
 *
 * ponytail: nao e um stemmer de verdade. Resolve plural e as terminacoes mais
 * comuns do portugues, que e o que separa "vasos" de "vaso" e "frustrado" de
 * "frustrados". Trocar por um stemmer real so quando houver caso medido que
 * este erre — stemmer agressivo cria falso positivo, que e pior.
 */
export function radical(palavra: string): string {
  let t = palavra;
  if (t.length > 4 && t.endsWith("oes")) return `${t.slice(0, -3)}ao`;
  if (t.length > 4 && (t.endsWith("aes") || t.endsWith("ais"))) return `${t.slice(0, -3)}al`;
  if (t.length > 4 && t.endsWith("ns")) return `${t.slice(0, -2)}m`;
  if (t.length > 3 && t.endsWith("s")) t = t.slice(0, -1);
  return t;
}

/** Minusculas, sem acento, sem pontuacao, sem palavras de parada. */
export function termos(texto: string): string[] {
  return texto
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9\s]/g, " ")
    .split(/\s+/)
    .filter((t) => t.length >= 3 && !PARADAS.has(t))
    .map(radical);
}

// ------------------------------------------------------------- conceitos

/**
 * Sinonimos: liga o que a pessoa FALA ao que o arquivo se CHAMA.
 *
 * Prefixo comum resolve flexao ("frustracao"/"frustrado"), mas nao resolve
 * palavra diferente para a mesma coisa. Medido na sequencia real: a fala diz
 * "telemedicina" e "disfuncao eretil", enquanto os arquivos se chamam
 * "Teleconsulta" e "Viagra" — 130 arquivos, metade da biblioteca, nunca
 * casavam.
 *
 * Chave = termo do NOME DO ARQUIVO. Valores = como aquilo aparece na fala.
 * Editavel: e o lugar certo para ajustar a pontaria sem mexer em codigo.
 */
export const SINONIMOS: ReadonlyMap<string, readonly string[]> = new Map([
  // As chaves sao os termos JA normalizados do nome do arquivo. Os valores sao
  // como o assunto aparece na fala — tirados da transcricao real, nao inventados.
  ["viagra", ["disfuncao", "eretil", "impotencia", "erecao", "ereto", "remedio", "comprimido", "pilula", "azul", "potencia", "desempenho", "ejaculacao", "precoce", "libido", "rigidez"]],
  ["teleconsulta", ["telemedicina", "online", "distancia", "videochamada", "atendimento", "clicando", "botao", "link", "celular", "aplicativo"]],
  ["doutor", ["medico", "urologista", "especialista", "profissional", "consultorio", "clinica", "andrologista"]],
  ["falhou", ["brochar", "brochou", "falha", "falhar", "vexame", "fracasso", "decepcionar", "perder", "ejaculacao", "precoce"]],
  ["cama", ["sexual", "sexo", "relacao", "intimidade", "transar", "desempenho", "performance", "noite"]],
  ["frustrado", ["frustracao", "vergonha", "humilhacao", "deprimido", "triste", "desanimo", "briga", "problema", "piora", "sofrimento"]],
  ["desanimado", ["desanimo", "animo", "cansado", "abatido", "energia", "apatia"]],
  ["separacao", ["divorcio", "separar", "terminar", "briga", "distanciamento", "afastamento", "traicao", "casamento"]],
  ["infarto", ["cardiaco", "coracao", "avc", "entupimento", "pressao", "risco", "derrame", "circulatorio"]],
  ["sanguineo", ["circulacao", "sangue", "arteria", "veia", "fluxo", "irrigacao", "vascular", "entupimento"]],
  ["vaso", ["arteria", "veia", "circulacao", "irrigacao"]],
  ["tratamento", ["tratar", "solucao", "cura", "protocolo", "terapia", "adequado", "resolver"]],
  ["consulta", ["consultorio", "avaliacao", "diagnostico", "atendimento", "exame"]],
  ["medica", ["medico", "saude", "clinica"]],
  ["exames", ["exame", "diagnostico", "laboratorio", "ultrassom", "doppler", "sangue"]],
  ["doppler", ["ultrassom", "exame", "circulacao", "fluxo"]],
  ["medicamento", ["remedio", "comprimido", "medicacao", "tarja", "receita", "dose"]],
  ["injetaveis", ["injecao", "injetavel", "aplicacao", "agulha", "aplicar"]],
  ["paliativa", ["paliativo", "temporario", "tapar", "disfarcar", "provisorio", "engana"]],
  ["medida", ["solucao", "saida", "alternativa"]],
  ["diabetes", ["diabetico", "glicemia", "acucar", "glicose"]],
  ["academia", ["exercicio", "treino", "musculacao", "atividade", "fisica", "esporte"]],
  ["corpo", ["fisico", "saude", "organismo"]],
  ["casal", ["casais", "relacionamento", "parceira", "esposa", "mulher", "namorada", "conjuge"]],
  ["feliz", ["felicidade", "alegria", "satisfacao", "prazer"]],
  ["milhare", ["milhoes", "milhao", "muitos", "maioria", "brasileiros"]],
  ["homem", ["homens", "masculino", "cara", "rapaz"]],
  ["alivio", ["aliviar", "melhora", "solucao", "conforto", "tranquilidade"]],
  ["emocional", ["emocao", "sentimento", "psicologico", "distanciamento", "autoestima"]],
  ["tempo", ["bomba", "relogio", "urgente", "urgencia", "prazo", "demora", "adiar", "piora"]],
  ["acabando", ["acabar", "explodir", "estourar", "limite", "fim"]],
  ["disposicao", ["energia", "animo", "vitalidade", "vigor"]],
  ["receita", ["caseiro", "cha", "simpatia", "milagroso", "internet"]],
  ["gaveta", ["escondido", "guardado", "vergonha"]],
  ["jogando", ["jogar", "largar", "parar", "abandonar", "livrar"]],
  ["comparacao", ["comparar", "antes", "depois", "diferenca"]],
  ["jovem", ["jovens", "idade"]],
]);

export interface Conceito {
  /** Nome como aparece no arquivo: "Falhou na cama". */
  readonly rotulo: string;
  /** Arquivos que representam este conceito. */
  readonly arquivos: readonly string[];
  /** Termos do rotulo, ja normalizados. */
  readonly termos: readonly string[];
}

/**
 * Agrupa arquivos por conceito, tirando a extensao e o sufixo "(n)".
 * "Casal feliz (10).mp4" e "Casal feliz (3).mp4" viram um conceito com dois
 * arquivos — que e o material da regra de diversidade da secao 8.
 */
export function conceitosDeArquivos(nomes: readonly string[]): Conceito[] {
  const porRotulo = new Map<string, string[]>();

  for (const nome of nomes) {
    const rotulo = nome
      .replace(/\.[a-z0-9]+$/i, "")
      .replace(/\s*\(\d+\)\s*$/, "")
      .trim();
    if (rotulo.length === 0) continue;
    const lista = porRotulo.get(rotulo);
    if (lista) lista.push(nome);
    else porRotulo.set(rotulo, [nome]);
  }

  const conceitos: Conceito[] = [];
  for (const [rotulo, arquivos] of porRotulo) {
    conceitos.push({ rotulo, arquivos, termos: termos(rotulo) });
  }
  conceitos.sort((a, b) => a.rotulo.localeCompare(b.rotulo, "pt-BR"));
  return conceitos;
}

// -------------------------------------------------------------- casamento

/**
 * Prefixo comum minimo para duas palavras contarem como a mesma raiz.
 *
 * 6 e o menor valor que separa os casos medidos: "frustracao"/"frustrado"
 * compartilham 7 letras e devem casar; "consulta"/"consumo" compartilham 5 e
 * nao devem. Baixar para 5 junta esses dois.
 */
const PREFIXO_MINIMO = 6;

/** Fracao minima da palavra mais curta que o prefixo comum precisa cobrir. */
const COBERTURA_MINIMA = 0.6;

/**
 * Duas palavras tem a mesma raiz?
 *
 * Compara pelo PREFIXO COMUM, nao por "uma comeca com a outra": "frustracao" e
 * "frustrado" nao sao prefixo um do outro, mas dividem "frustra".
 *
 * Cortar sufixos com um stemmer de verdade produziria mais falso positivo, e
 * num modo de insercao automatica sugerir errado e pior que nao sugerir.
 */
export function mesmaRaiz(a: string, b: string): boolean {
  if (a === b) return true;
  const menor = Math.min(a.length, b.length);
  let comum = 0;
  while (comum < menor && a[comum] === b[comum]) comum++;
  return comum >= PREFIXO_MINIMO && comum / menor >= COBERTURA_MINIMA;
}

/**
 * Peso de um termo: quanto mais conceitos o usam, menos ele distingue.
 *
 * "homem" aparece em "Corpo do homem", "Milhares de homens" e "Jovem
 * frustrado"... entao casar so por "homem" quase nao diz nada. "sanguineo"
 * aparece num conceito so e vale muito.
 */
function pesos(conceitos: readonly Conceito[]): Map<string, number> {
  const emQuantos = new Map<string, number>();
  for (const c of conceitos) {
    for (const t of new Set(c.termos)) emQuantos.set(t, (emQuantos.get(t) ?? 0) + 1);
  }
  const peso = new Map<string, number>();
  for (const [termo, n] of emQuantos) peso.set(termo, 1 / n);
  return peso;
}

/**
 * O termo do conceito aparece na frase, direto ou por sinonimo?
 *
 * O sinonimo tambem passa por `mesmaRaiz`, entao "disfuncao" no dicionario
 * alcanca "disfuncoes" na fala sem precisar listar as flexoes.
 */
export function estaNaFrase(termoDoConceito: string, termosDaFrase: readonly string[]): boolean {
  if (termosDaFrase.some((f) => mesmaRaiz(termoDoConceito, f))) return true;
  const sinonimos = SINONIMOS.get(termoDoConceito);
  if (!sinonimos) return false;
  return sinonimos.some((s) => termosDaFrase.some((f) => mesmaRaiz(radical(s), f)));
}

export interface Sugestao {
  readonly conceito: Conceito;
  /** 0 a 1. Fracao do PESO dos termos do conceito presentes na frase. */
  readonly score: number;
  /** Sempre visivel: toda decisao automatica mostra o motivo. */
  readonly motivo: string;
  /** Termos do conceito que a frase realmente contem — usados para ancorar o corte. */
  readonly termosCasados: readonly string[];
}

/**
 * Pontua cada conceito contra uma frase e devolve os melhores.
 *
 * `score` e a fracao dos termos do conceito que aparecem na frase. Um conceito
 * de um termo so ("Viagra") pontua 1 quando a palavra aparece; um de tres
 * ("Falhou na cama" -> falhou/cama, "na" e parada) exige os dois.
 *
 * Exigir o conceito INTEIRO, e nao qualquer termo, e o que impede "Doutor" de
 * casar com toda frase que mencione consulta.
 */
export function casar(frase: string, conceitos: readonly Conceito[], limite = 3): Sugestao[] {
  const naFrase = termos(frase);
  if (naFrase.length === 0) return [];
  const peso = pesos(conceitos);

  const sugestoes: Sugestao[] = [];
  for (const conceito of conceitos) {
    if (conceito.termos.length === 0) continue;

    const encontrados = conceito.termos.filter((t) => estaNaFrase(t, naFrase));
    if (encontrados.length === 0) continue;

    const total = conceito.termos.reduce((s, t) => s + (peso.get(t) ?? 1), 0);
    const obtido = encontrados.reduce((s, t) => s + (peso.get(t) ?? 1), 0);
    const score = total > 0 ? obtido / total : 0;

    sugestoes.push({
      conceito,
      score,
      motivo:
        encontrados.length === conceito.termos.length
          ? `frase contem "${conceito.rotulo}"`
          : `casou ${encontrados.join(", ")} de "${conceito.rotulo}"`,
      termosCasados: encontrados,
    });
  }

  sugestoes.sort((a, b) => {
    if (b.score !== a.score) return b.score - a.score;
    // Empate: prefere o conceito mais especifico (mais termos no rotulo).
    if (b.conceito.termos.length !== a.conceito.termos.length) {
      return b.conceito.termos.length - a.conceito.termos.length;
    }
    return a.conceito.rotulo.localeCompare(b.conceito.rotulo, "pt-BR");
  });

  return sugestoes.slice(0, limite);
}
