/*
 * Transcricao pelo ElevenLabs (Scribe): a parte pura.
 *
 * Por que existe: a transcricao do Premiere erra palavras que mudam o sentido
 * ("Voce faz" no lugar de "Voce falha", "Eu fui medico" no lugar de "Eu sou
 * medico"). As regras deste plugin corrigem a FORMA do texto, nunca a palavra
 * que o reconhecimento de fala ouviu errado. Teste de 2026-09-24, variacao 1
 * do Andro 19.09 (176 palavras, gabarito = legenda revisada a mao):
 *
 *   Premiere   7 diferencas, 5 que mudam o sentido
 *   ElevenLabs 4 diferencas, e em pelo menos 2 delas o ElevenLabs estava certo
 *              e a legenda errada ("focado", "investigar a causa")
 *
 * Este modulo monta o pedido e le a resposta. Quem faz a chamada de rede e
 * src/elevenlabs-rede.ts; quem exporta o audio e src/premiere.ts.
 *
 * Puro: nao conhece o Premiere, nao faz I/O.
 */

import { somDoWav } from "./audio.ts";
import type { Preset } from "./preset.ts";
import type { PalavraEditada } from "./transcript.ts";

export const ELEVENLABS = {
  url: "https://api.elevenlabs.io/v1/speech-to-text",
  /** Modelo de lote atual (docs ElevenLabs, 2026-09). */
  modelo: "scribe_v2",
  /** ISO-639-3. Fixar o idioma evita que um trecho curto seja lido como espanhol. */
  idioma: "por",
} as const;

/** Nome que as palavras do ElevenLabs levam em `sourceName`, para depuracao. */
export const ORIGEM_ELEVENLABS = "elevenlabs";

/* ------------------------------------------------------------ termos-chave */

/**
 * Lista de termos-chave que vai no pedido, ja dentro dos limites da API:
 * no maximo 1000 termos, 50 caracteres e 5 palavras cada. Termo fora do limite
 * e descartado em vez de derrubar o pedido inteiro.
 */
export function termosChave(preset: Preset): string[] {
  const vistos = new Set<string>();
  const saida: string[] = [];
  for (const bruto of [...preset.termosProtegidos, ...preset.termosChave]) {
    const termo = bruto.trim().replace(/\s+/g, " ");
    if (termo.length === 0 || termo.length > 50) continue;
    if (termo.split(" ").length > 5) continue;
    const chave = termo.toLowerCase();
    if (vistos.has(chave)) continue;
    vistos.add(chave);
    saida.push(termo);
    if (saida.length === 1000) break;
  }
  return saida;
}

/* --------------------------------------------------------------- pedido */

export interface Campo {
  readonly nome: string;
  readonly valor: string;
}

/**
 * Campos do formulario. `keyterms` vai repetido, um campo por termo, que e
 * como os SDKs oficiais serializam lista em multipart.
 *
 * `comTermos = false` existe para a segunda tentativa: se a API recusar os
 * termos (formato mudou, termo invalido), transcrever sem eles ainda e melhor
 * que nao transcrever.
 */
export function camposDoPedido(termos: readonly string[], comTermos = true): Campo[] {
  const campos: Campo[] = [
    { nome: "model_id", valor: ELEVENLABS.modelo },
    { nome: "language_code", valor: ELEVENLABS.idioma },
    { nome: "timestamps_granularity", valor: "word" },
    // Risada e ruido viram "(risos)" no texto; na legenda nao servem.
    { nome: "tag_audio_events", valor: "false" },
    { nome: "diarize", valor: "false" },
  ];
  if (comTermos) for (const t of termos) campos.push({ nome: "keyterms", valor: t });
  return campos;
}

/**
 * Texto -> bytes UTF-8, a mao.
 *
 * NAO usar `new TextEncoder()`: o UXP do Premiere nao tem, e como a primeira
 * versao deste arquivo criava um no topo do modulo, o bundle inteiro do Pro
 * Edition quebrava ao carregar e o painel abria em branco (2026-09-24).
 */
export function utf8(texto: string): Uint8Array {
  const saida: number[] = [];
  for (const caractere of texto) {
    const c = caractere.codePointAt(0) ?? 0;
    if (c < 0x80) saida.push(c);
    else if (c < 0x800) saida.push(0xc0 | (c >> 6), 0x80 | (c & 0x3f));
    else if (c < 0x10000) saida.push(0xe0 | (c >> 12), 0x80 | ((c >> 6) & 0x3f), 0x80 | (c & 0x3f));
    else
      saida.push(
        0xf0 | (c >> 18),
        0x80 | ((c >> 12) & 0x3f),
        0x80 | ((c >> 6) & 0x3f),
        0x80 | (c & 0x3f)
      );
  }
  return new Uint8Array(saida);
}

/**
 * Monta um corpo multipart/form-data a mao.
 *
 * Nao usa FormData/Blob: o suporte do UXP a eles nao foi provado neste
 * projeto, e um corpo em bytes funciona em qualquer `fetch`. De quebra, o
 * formato fica testavel no Node.
 */
export function montarMultipart(
  campos: readonly Campo[],
  arquivo: { readonly nome: string; readonly tipo: string; readonly bytes: Uint8Array },
  fronteira: string
): { corpo: Uint8Array; contentType: string } {
  const partes: Uint8Array[] = [];
  for (const c of campos) {
    partes.push(
      utf8(`--${fronteira}\r\nContent-Disposition: form-data; name="${c.nome}"\r\n\r\n${c.valor}\r\n`)
    );
  }
  partes.push(
    utf8(
      `--${fronteira}\r\nContent-Disposition: form-data; name="file"; filename="${arquivo.nome}"\r\n` +
        `Content-Type: ${arquivo.tipo}\r\n\r\n`
    )
  );
  partes.push(arquivo.bytes);
  partes.push(utf8(`\r\n--${fronteira}--\r\n`));

  const total = partes.reduce((n, p) => n + p.byteLength, 0);
  const corpo = new Uint8Array(total);
  let pos = 0;
  for (const p of partes) {
    corpo.set(p, pos);
    pos += p.byteLength;
  }
  return { corpo, contentType: `multipart/form-data; boundary=${fronteira}` };
}

/* ------------------------------------------------------------- resposta */

function numero(v: unknown): number | null {
  return typeof v === "number" && Number.isFinite(v) ? v : null;
}

/** As palavras cruas, em qualquer um dos formatos que o ElevenLabs entrega. */
function palavrasCruas(o: Record<string, unknown>): unknown[] {
  // API: { words: [...] }
  if (Array.isArray(o.words)) return o.words;
  // Exportacao JSON do site: { segments: [{ words: [...] }] }
  if (Array.isArray(o.segments)) {
    return o.segments.flatMap((s) =>
      typeof s === "object" && s !== null && Array.isArray((s as { words?: unknown }).words)
        ? ((s as { words: unknown[] }).words)
        : []
    );
  }
  // Multicanal: { transcripts: [{ words: [...] }] } — o canal 0 e a voz.
  if (Array.isArray(o.transcripts) && o.transcripts[0] && typeof o.transcripts[0] === "object") {
    const w = (o.transcripts[0] as { words?: unknown }).words;
    if (Array.isArray(w)) return w;
  }
  return [];
}

/** Fim de frase: o ElevenLabs pontua, e o `eos` do Premiere sai daqui. */
const FIM_DE_FRASE = /[.!?…]["'”’)]*$/u;

/**
 * Converte a resposta do ElevenLabs nas palavras que o pipeline ja entende.
 *
 * O audio e o da sequencia inteira, exportado do comeco, entao o tempo da
 * resposta JA E tempo de sequencia — nao ha remapeamento de clipe como na
 * transcricao do Premiere, que vem por midia de origem.
 *
 * Nao confia no JSON: palavra sem texto ou sem tempo e descartada sozinha.
 * Devolve `null` so quando o arquivo nem e JSON.
 */
export function palavrasDoElevenLabs(json: string, deslocamento = 0): PalavraEditada[] | null {
  let bruto: unknown;
  try {
    bruto = JSON.parse(json);
  } catch {
    return null;
  }
  if (typeof bruto !== "object" || bruto === null) return null;

  const saida: PalavraEditada[] = [];
  for (const w of palavrasCruas(bruto as Record<string, unknown>)) {
    if (typeof w !== "object" || w === null) continue;
    const p = w as Record<string, unknown>;
    const tipo = typeof p.type === "string" ? p.type : "word";
    if (tipo !== "word") continue; // "spacing" e "audio_event"
    const texto = typeof p.text === "string" ? p.text.trim() : "";
    if (texto.length === 0) continue;
    const inicio = numero(p.start) ?? numero(p.start_time);
    if (inicio === null) continue;
    const fim = numero(p.end) ?? numero(p.end_time) ?? inicio;
    const logprob = numero(p.logprob);
    saida.push({
      text: texto,
      inicio: inicio + deslocamento,
      fim: Math.max(inicio, fim) + deslocamento,
      confidence: logprob === null ? 1 : Math.min(1, Math.exp(logprob)),
      eos: FIM_DE_FRASE.test(texto),
      sourceName: ORIGEM_ELEVENLABS,
    });
  }
  saida.sort((a, b) => a.inicio - b.inicio);
  return saida;
}

/* ---------------------------------------------------------------- erros */

/**
 * Mensagem para o painel. O editor nao le JSON de erro: ele precisa saber se
 * o problema e a chave, o credito ou o arquivo.
 */
export function explicarErro(status: number, corpo: string): string {
  const detalhe = corpo.replace(/\s+/g, " ").slice(0, 300);
  // Visto no primeiro teste real (2026-09-24): colar o ID da chave, que o
  // site mostra sempre, no lugar da chave secreta, que so aparece ao criar.
  if (/api_key_id_used_as_api_key/.test(corpo)) {
    return (
      "A chave colada é o ID da chave, não a chave secreta. No ElevenLabs, crie uma chave nova " +
      "e copie o valor que começa com sk_ (ele só aparece na hora de criar). Nada foi cobrado."
    );
  }
  if (status === 401 || status === 403 || /invalid_api_key|authentication_error/.test(corpo)) {
    return `ElevenLabs recusou a chave (${status}). Confira a chave de API salva no painel. Detalhe: ${detalhe}`;
  }
  if (status === 402 || /quota|credit|insufficient/i.test(corpo)) {
    return `ElevenLabs sem credito para transcrever (${status}). Detalhe: ${detalhe}`;
  }
  if (status === 413) return `Audio grande demais para o ElevenLabs (${status}).`;
  if (status === 429) return `ElevenLabs ocupado ou limite de uso atingido (${status}). Tente de novo em alguns minutos.`;
  if (status >= 500) return `ElevenLabs fora do ar (${status}). Tente de novo em alguns minutos.`;
  return `ElevenLabs respondeu ${status}. Detalhe: ${detalhe}`;
}

/** A API reclamou dos termos-chave? Entao vale tentar de novo sem eles. */
export function recusouTermos(status: number, corpo: string): boolean {
  return (status === 400 || status === 422) && /keyterm/i.test(corpo);
}

/* ----------------------------------------------------------- reaproveitar */

/**
 * Impressao digital do audio, para nao pagar duas vezes pela mesma
 * transcricao. Gerar de novo depois de mexer so no estilo, ou depois de um
 * erro na importacao, reaproveita a resposta salva.
 *
 * FNV-1a de 32 bits sobre o tamanho e uma amostra espalhada pelo arquivo:
 * ler 50 MB byte a byte no painel custaria segundos, e qualquer mudanca de
 * corte ou de volume muda muitas amostras.
 *
 * So o som entra na conta: o Premiere grava a data do export e um ID novo
 * (chunks LIST, bext e _PMX) em todo WAV, e com eles a mesma fala pagava de
 * novo a cada clique (3 transcricoes do mesmo audio em 2026-09-24).
 */
export function assinaturaDoAudio(arquivo: Uint8Array): string {
  const bytes = somDoWav(arquivo);
  let h = 0x811c9dc5;
  const misturar = (b: number): void => {
    h ^= b & 0xff;
    h = Math.imul(h, 0x01000193) >>> 0;
  };
  const n = bytes.byteLength;
  for (let k = 0; k < 4; k++) misturar(n >>> (8 * k));
  const passo = Math.max(1, Math.floor(n / 200000));
  for (let i = 0; i < n; i += passo) misturar(bytes[i] ?? 0);
  return `${n.toString(16)}-${h.toString(16).padStart(8, "0")}`;
}
