/*
 * Intensidade: quanto um clipe se mexe, e quanto um momento da fala corre.
 *
 * Nada aqui trabalha em escala absoluta. "0,0031 bytes por quadro por pixel" nao
 * significa nada sozinho; significa tudo comparado com os outros 42 takes do
 * mesmo conceito. Por isso a moeda deste modulo e o PERCENTIL, que dispensa
 * calibracao e cancela vies de codificador e de resolucao.
 *
 * Puro: nao conhece o Premiere, nao faz I/O, nao le arquivo.
 */

/**
 * Posicao relativa de cada valor dentro da propria lista, de 0 a 1.
 *
 * Empates recebem o mesmo percentil. `null` (nao foi possivel medir) atravessa
 * intacto: nao medir nao pode virar castigo.
 *
 * Lista de um item so devolve 0,5 — item unico nao e nem agitado nem parado em
 * relacao a ninguem, e o meio o mantem elegivel em qualquer momento. Sao 12 dos
 * 32 conceitos desta biblioteca.
 */
export function percentis(valores: readonly (number | null)[]): (number | null)[] {
  const medidos = valores.filter((v): v is number => v !== null);
  if (medidos.length === 0) return valores.map(() => null);
  if (medidos.length === 1) return valores.map((v) => (v === null ? null : 0.5));

  const ordenados = [...medidos].sort((a, b) => a - b);
  const ultimo = ordenados.length - 1;

  return valores.map((v) => (v === null ? null : ordenados.indexOf(v) / ultimo));
}

/**
 * Indices dos takes cuja intensidade cabe no momento.
 *
 * Take sem medida entra sempre: a ausencia de informacao nao e informacao
 * negativa. Lista vazia significa "nenhum encaixa" — quem chama decide o que
 * fazer, e no planejador isso vira cair de volta para todos.
 */
export function encaixam(
  percentisDosTakes: readonly (number | null)[],
  alvo: number,
  tolerancia: number
): number[] {
  const dentro: number[] = [];
  percentisDosTakes.forEach((p, i) => {
    if (p === null || Math.abs(p - alvo) <= tolerancia) dentro.push(i);
  });
  return dentro;
}

/** Palavras por segundo: o quanto a fala corre naquele trecho. */
export function ritmo(palavras: number, duracao: number): number {
  return duracao > 0 ? palavras / duracao : 0;
}
