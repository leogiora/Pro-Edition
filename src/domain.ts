/*
 * Regras puras. Nao conhecem o Premiere, nao fazem I/O, nao tocam no DOM.
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

/**
 * Converte um instante da midia de origem para o tempo da sequencia.
 *
 * Provado no auto-broll (API_PROOFS P2.1): `inPoint`/`outPoint` sao tempos da
 * ORIGEM e `start`/`end` sao tempos da SEQUENCIA — a documentacao da Adobe
 * descreve `getInPoint()` como "relative to the start time", o que e falso.
 *
 * Retorna `null` quando o instante ficou fora do corte, que e o caso comum: a
 * maior parte da fala gravada nao sobrevive a edicao.
 */
export function sourceToSequence(clip: TimelineClip, sourceSeconds: number): number | null {
  if (sourceSeconds < clip.inPointSeconds) return null;
  if (sourceSeconds >= clip.outPointSeconds) return null;
  return clip.startSeconds + (sourceSeconds - clip.inPointSeconds) / clip.speed;
}

/** mm:ss — para apontar um instante numa lista, nao para calcular com ele. */
export function relogio(segundos: number): string {
  const total = Math.max(0, Math.round(segundos));
  const pad = (n: number): string => String(n).padStart(2, "0");
  return `${pad(Math.floor(total / 60))}:${pad(total % 60)}`;
}
