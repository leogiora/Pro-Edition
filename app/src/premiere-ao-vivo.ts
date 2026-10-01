/*
 * O que o plugin conta do Premiere, a cada meio segundo, para o programa.
 * O plugin e a "extensao": so ele le a timeline; o programa so escuta.
 * Logica pura: validar o que chega (vem de fora do programa).
 */

/** Porta local onde o programa escuta o plugin. So 127.0.0.1. */
export const PORTA_PREMIERE = 47800;

/** Sem noticia do plugin ha mais que isto, o programa mostra "desconectado". */
export const SILENCIO_MS = 2000;

export interface EstadoPremiere {
  readonly projeto: string | null;
  readonly sequencia: string | null;
  /** Posicao do cursor da timeline, em segundos. */
  readonly cursorS: number | null;
  readonly selecionados: number;
  /** Quando o plugin leu (ms desde 1970, relogio do PC). */
  readonly quando: number;
}

const texto = (v: unknown): string | null => (typeof v === "string" && v.length <= 500 ? v : null);
const numero = (v: unknown): number | null => (typeof v === "number" && Number.isFinite(v) ? v : null);

/** O corpo do POST do plugin, ou null se nao for um estado valido. */
export function lerEstadoPremiere(raw: unknown): EstadoPremiere | null {
  if (typeof raw !== "object" || raw === null) return null;
  const o = raw as Record<string, unknown>;
  const quando = numero(o.quando);
  if (quando === null) return null;
  const cursor = numero(o.cursorS);
  return {
    projeto: texto(o.projeto),
    sequencia: texto(o.sequencia),
    cursorS: cursor !== null && cursor >= 0 ? cursor : null,
    selecionados: Math.max(0, Math.floor(numero(o.selecionados) ?? 0)),
    quando,
  };
}

/** "00:14.2": o tempo do cursor como o Premiere mostra, com decimo. */
export function tempoDoCursor(s: number): string {
  const d = Math.floor(s * 10) / 10;
  const m = Math.floor(d / 60);
  const resto = (d - m * 60).toFixed(1).padStart(4, "0");
  return `${String(m).padStart(2, "0")}:${resto}`;
}
