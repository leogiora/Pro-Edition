/*
 * Pedidos do programa ao plugin no Premiere (src/ponte-app.ts atende). O
 * plugin passa a cada meio segundo (sinal): leva os pedidos da fila e devolve
 * cada resposta pelo id. Sem sinal recente, o pedido espera um pouco pela
 * primeira passada (o programa pode ter acabado de abrir) e falha com o
 * motivo, em vez de esperar o prazo inteiro.
 */

import { SILENCIO_MS } from "./premiere-ao-vivo.ts";

export interface Pedido {
  readonly id: number;
  readonly nome: string;
  readonly args: readonly unknown[];
}

interface Espera {
  readonly nome: string;
  readonly prazoMs: number;
  readonly resolver: (valor: unknown) => void;
  readonly rejeitar: (erro: Error) => void;
  prazo: ReturnType<typeof setTimeout>;
  /** Pedido feito sem o plugin por perto: so tem a espera curta ate ele passar. */
  semSinal: boolean;
}

export const SEM_PREMIERE = "O Premiere não está conectado: abra o painel Cutline no Premiere (Window › UXP Plugins › Cutline).";

export class Ponte {
  private fila: Pedido[] = [];
  private readonly esperando = new Map<number, Espera>();
  private proximo = 1;
  private ultimoSinal = -Infinity;
  private readonly agora: () => number;
  private readonly esperaSinalMs: number;

  constructor(agora: () => number = Date.now, esperaSinalMs = 3000) {
    this.agora = agora;
    this.esperaSinalMs = esperaSinalMs;
  }

  /** O plugin passou: leva tudo o que esta na fila. */
  sinal(): Pedido[] {
    this.ultimoSinal = this.agora();
    const levados = this.fila.splice(0);
    for (const p of levados) {
      const e = this.esperando.get(p.id);
      if (e?.semSinal) {
        // Chegou: agora vale o prazo do pedido.
        clearTimeout(e.prazo);
        e.semSinal = false;
        e.prazo = this.vencer(p.id, e.prazoMs, new Error(`O Premiere não respondeu a "${e.nome}" em ${Math.round(e.prazoMs / 1000)} s.`));
      }
    }
    return levados;
  }

  vivo(): boolean {
    return this.agora() - this.ultimoSinal < SILENCIO_MS;
  }

  pedir(nome: string, args: readonly unknown[], prazoMs: number): Promise<unknown> {
    const id = this.proximo++;
    const semSinal = !this.vivo();
    return new Promise((resolver, rejeitar) => {
      const erro = semSinal
        ? new Error(SEM_PREMIERE)
        : new Error(`O Premiere não respondeu a "${nome}" em ${Math.round(prazoMs / 1000)} s.`);
      const prazo = this.vencer(id, semSinal ? this.esperaSinalMs : prazoMs, erro);
      this.esperando.set(id, { nome, prazoMs, resolver, rejeitar, prazo, semSinal });
      this.fila.push({ id, nome, args });
    });
  }

  private vencer(id: number, ms: number, erro: Error): ReturnType<typeof setTimeout> {
    return setTimeout(() => {
      const e = this.esperando.get(id);
      this.esperando.delete(id);
      this.fila = this.fila.filter((p) => p.id !== id);
      e?.rejeitar(erro);
    }, ms);
  }

  /** Resposta do plugin: { id, ok, valor } ou { id, ok: false, erro }. false = nao era de ninguem. */
  responder(raw: unknown): boolean {
    const r = raw as { id?: unknown; ok?: unknown; valor?: unknown; erro?: unknown } | null;
    if (typeof r?.id !== "number") return false;
    const espera = this.esperando.get(r.id);
    if (espera === undefined) return false;
    this.esperando.delete(r.id);
    clearTimeout(espera.prazo);
    if (r.ok === true) espera.resolver(r.valor);
    else espera.rejeitar(new Error(typeof r.erro === "string" ? r.erro : "o Premiere recusou o pedido"));
    return true;
  }
}
