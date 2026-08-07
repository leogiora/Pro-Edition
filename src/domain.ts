/*
 * Regras puras. Nao conhecem o Premiere, nao fazem I/O, nao tocam no DOM.
 * Tudo aqui e testavel com `npm test` sem abrir o Premiere.
 */

/** Um clipe como ele existe na timeline, ja recortado pelo editor. */
export interface TimelineClip {
  /** Onde o clipe comeca na sequencia, em segundos. */
  readonly startSeconds: number;
  /** Onde o clipe termina na sequencia, em segundos. */
  readonly endSeconds: number;
  /** Instante da MIDIA DE ORIGEM que aparece em startSeconds. */
  readonly inPointSeconds: number;
  /** Instante da MIDIA DE ORIGEM que aparece em endSeconds. */
  readonly outPointSeconds: number;
  /** 1 = velocidade normal. */
  readonly speed: number;
}

export interface Size {
  readonly width: number;
  readonly height: number;
}

/**
 * Converte um instante da midia de origem para o tempo da sequencia.
 *
 * Provado na Fase 0 (P2.1): `inPoint`/`outPoint` sao tempos da ORIGEM e
 * `start`/`end` sao tempos da SEQUENCIA — a documentacao da Adobe descreve
 * `getInPoint()` como "relative to the start time", o que e falso.
 *
 * Retorna `null` quando o instante ficou fora do corte, que e o caso comum:
 * a maior parte da fala gravada nao sobrevive a edicao.
 */
export function sourceToSequence(clip: TimelineClip, sourceSeconds: number): number | null {
  if (sourceSeconds < clip.inPointSeconds) return null;
  if (sourceSeconds >= clip.outPointSeconds) return null;
  return clip.startSeconds + (sourceSeconds - clip.inPointSeconds) / clip.speed;
}

/**
 * Escala percentual para o clipe COBRIR a sequencia inteira, cortando o excesso.
 * Usa o maior fator: encaixar inteiro deixaria tarjas.
 */
export function fillScalePercent(clip: Size, sequence: Size): number {
  if (clip.width <= 0 || clip.height <= 0) {
    throw new RangeError(`dimensao invalida do clipe: ${clip.width}x${clip.height}`);
  }
  return Math.max(sequence.width / clip.width, sequence.height / clip.height) * 100;
}

/**
 * Timecode HH:MM:SS:FF para exibicao.
 *
 * ponytail: usa fps arredondado. Numa sequencia de 29,9928 fps isso acumula
 * menos de 1s em 20 minutos — irrelevante para um rotulo de duracao, e
 * inaceitavel para remapeamento. Nada de calculo de tempo real passa por aqui;
 * para isso existe sourceToSequence, que trabalha em segundos.
 */
export function formatTimecode(seconds: number, fps: number): string {
  if (!Number.isFinite(seconds) || !Number.isFinite(fps) || fps <= 0) return "--:--:--:--";
  const fpsInt = Math.max(1, Math.round(fps));
  const totalFrames = Math.max(0, Math.round(seconds * fpsInt));
  const frames = totalFrames % fpsInt;
  const total = Math.floor(totalFrames / fpsInt);
  const pad = (n: number): string => String(n).padStart(2, "0");
  return `${pad(Math.floor(total / 3600))}:${pad(Math.floor(total / 60) % 60)}:${pad(total % 60)}:${pad(frames)}`;
}

/**
 * mm:ss — para apontar um instante numa lista, nao para calcular com ele.
 *
 * Mais legivel que timecode cheio quando o que importa e "onde na fala", e nao
 * o frame exato. Estava duplicado em `plano.ts` e no painel.
 */
export function relogio(segundos: number): string {
  const total = Math.max(0, Math.round(segundos));
  const pad = (n: number): string => String(n).padStart(2, "0");
  return `${pad(Math.floor(total / 60))}:${pad(total % 60)}`;
}

/*
 * A resolucao da fonte ja foi lida do XMP aqui. Nao e mais: o XMP nao traz
 * `videoFrameSize` nesta biblioteca e a leitura falhou nos arquivos reais.
 * Quem faz isso hoje e `src/mp4.ts`, direto do cabecalho. Ver D-009 e D-015.
 */

/** Configuracao do usuario. Persistida como JSON com versao de schema. */
export interface Config {
  readonly schema: 1;
  /** Indice da faixa de video de destino. 1 = V2. */
  readonly videoTrackIndex: number;
  /** Indice da faixa de audio de destino. 2 = A3. */
  readonly audioTrackIndex: number;
  /** Remover o item de audio do B-roll depois de inserir. */
  readonly removeAudio: boolean;
  /** Escalar o clipe para cobrir a tela. */
  readonly fillScreen: boolean;
  /** Afrouxar so o espacamento, para caber o maximo de B-roll. */
  readonly densidadeMaxima: boolean;
  /** Pasta da biblioteca de B-rolls. */
  readonly libraryPath: string;
}

export const DEFAULT_CONFIG: Config = {
  schema: 1,
  videoTrackIndex: 1,
  audioTrackIndex: 2,
  removeAudio: true,
  fillScreen: true,
  densidadeMaxima: true,
  libraryPath: "",
};

/**
 * Valida o que veio do disco. Config corrompida nunca deve derrubar o painel,
 * entao campo invalido cai no padrao em vez de lancar.
 */
export function parseConfig(raw: unknown): Config {
  if (typeof raw !== "object" || raw === null) return DEFAULT_CONFIG;
  const o = raw as Record<string, unknown>;
  const inteiro = (v: unknown, padrao: number): number =>
    typeof v === "number" && Number.isInteger(v) && v >= 0 ? v : padrao;
  const booleano = (v: unknown, padrao: boolean): boolean => (typeof v === "boolean" ? v : padrao);
  return {
    schema: 1,
    videoTrackIndex: inteiro(o.videoTrackIndex, DEFAULT_CONFIG.videoTrackIndex),
    audioTrackIndex: inteiro(o.audioTrackIndex, DEFAULT_CONFIG.audioTrackIndex),
    removeAudio: booleano(o.removeAudio, DEFAULT_CONFIG.removeAudio),
    fillScreen: booleano(o.fillScreen, DEFAULT_CONFIG.fillScreen),
    densidadeMaxima: booleano(o.densidadeMaxima, DEFAULT_CONFIG.densidadeMaxima),
    libraryPath: typeof o.libraryPath === "string" ? o.libraryPath : DEFAULT_CONFIG.libraryPath,
  };
}

/** Extensoes que o Premiere aceita como B-roll de video. */
const EXTENSOES_VIDEO = new Set(["mp4", "mov", "m4v", "mxf", "avi", "mkv", "webm"]);

export function ehVideo(nomeArquivo: string): boolean {
  const ponto = nomeArquivo.lastIndexOf(".");
  if (ponto < 0) return false;
  return EXTENSOES_VIDEO.has(nomeArquivo.slice(ponto + 1).toLowerCase());
}

/**
 * Caminho do Windows para a URL que o `getEntryWithUrl` do UXP entende.
 *
 * A Adobe documenta `file:/C:/...` — uma barra so depois de `file:`, nao as
 * duas de uma URL comum.
 *
 * **Nao escapar nada.** O UXP codifica a URL por conta propria; escapar aqui
 * gera escape duplo e ele nao acha a pasta. Medido: enviando
 * `Brolls%20-%202026` o erro do proprio UXP reclamava de
 * `Brolls%2520-%25202026`. Espaco vai literal.
 *
 * A decodificacao continua, para o caso de chegar um caminho ja escapado —
 * colado de uma URL, por exemplo.
 */
export function caminhoParaUrl(entrada: string): string {
  // Aspas sobram quando se copia o caminho do Explorer do Windows.
  let bruto = entrada.trim().replace(/^["']+|["']+$/g, "");

  // Aceita tanto caminho cru quanto URL ja montada: colar de volta o que o
  // painel mostrou nao pode virar %2520.
  bruto = bruto.replace(/^file:\/*/i, "");

  // Desfaz codificacao previa ate estabilizar, senao cada passagem soma um
  // nivel de escape.
  for (let i = 0; i < 3; i++) {
    let decodificado: string;
    try {
      decodificado = decodeURI(bruto);
    } catch {
      break; // sequencia invalida: usar como esta
    }
    if (decodificado === bruto) break;
    bruto = decodificado;
  }

  const normalizado = bruto.replace(/\\/g, "/").replace(/\/+$/, "");
  if (normalizado.length === 0) throw new RangeError("caminho vazio");
  return `file:/${normalizado}`;
}

/** Rotulo de faixa como o Premiere mostra: indice 1 -> "V2". */
export function trackLabel(kind: "V" | "A", index: number): string {
  return `${kind}${index + 1}`;
}
