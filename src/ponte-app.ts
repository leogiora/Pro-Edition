/*
 * A "extensao": o plugin conta ao programa Cutline o que esta aberto no
 * Premiere, a cada meio segundo (app/src/premiere-ao-vivo.ts recebe), e faz o
 * que o programa pede. So o plugin le e edita a timeline; o programa e a tela.
 *
 *   POST /premiere  estado do Premiere; a resposta traz os pedidos do programa
 *   POST /resposta  { id, ok, valor | erro } de cada pedido
 *   POST /evento    o que o AutoEdit conta enquanto roda (etapa, variacoes...)
 *
 * Programa fechado: o plugin espera mais entre as tentativas (ate 5 s) e nao
 * avisa nada. Precisa de "network.domains": "all" (UXP_ARMADILHAS 3a).
 */

import { comLimite, writeJson } from "../ferramentas/auto-broll/src/premiere.ts";
import type { Empresa } from "../ferramentas/pro-captions/src/preset.ts";
import type { OpcoesEditar } from "./editar.ts";
import { motorLocal } from "./motor-local.ts";

declare function require(id: string): unknown;

const BASE = "http://127.0.0.1:47800";
const PASSO_MS = 500;

/** Pedido do programa (app/src/ponte.ts). */
interface Pedido {
  readonly id: number;
  readonly nome: string;
  readonly args: readonly unknown[];
}

// text/plain: pedido simples, sem pre-voo de CORS.
const enviar = (caminho: string, corpo: unknown): Promise<Response> =>
  fetch(`${BASE}${caminho}`, { method: "POST", headers: { "Content-Type": "text/plain" }, body: JSON.stringify(corpo) });

/** Eventos em fila: a tela recebe na ordem em que o AutoEdit conta. */
let filaEventos: Promise<unknown> = Promise.resolve();
const evento = (dados: unknown): void => {
  filaEventos = filaEventos.then(() => enviar("/evento", dados)).catch(() => undefined);
};

/** Faz o pedido com o motor local, o mesmo do painel. */
async function atender(p: Pedido): Promise<unknown> {
  switch (p.nome) {
    case "lerEstado":
      return motorLocal.lerEstado();
    case "lerEmpresa":
      return motorLocal.lerEmpresa();
    case "trocarEmpresa":
      return motorLocal.trocarEmpresa(p.args[0] as Empresa);
    case "guardarLog":
      return motorLocal.guardarLog(p.args[0] as string[]);
    case "editar":
      return motorLocal.editar(
        p.args[0] as OpcoesEditar,
        (texto, tom) => evento({ tipo: "registro", texto, tom: tom ?? "passo" }),
        (texto) => evento({ tipo: "progresso", texto }),
        {
          etapa: (id, estado, resumo) => evento({ tipo: "etapa", id, estado, resumo }),
          variacoes: (lista) => evento({ tipo: "variacoes", lista }),
          alvo: (indices) => evento({ tipo: "alvo", indices }),
        }
      );
    default:
      throw new Error(`pedido desconhecido: ${p.nome}`);
  }
}

function responder(p: Pedido): void {
  void atender(p)
    .then((valor) => ({ id: p.id, ok: true, valor: valor ?? null }))
    .catch((e) => ({ id: p.id, ok: false, erro: (e as Error)?.message ?? String(e) }))
    // A resposta vai depois dos eventos que o pedido gerou.
    .then((r) => (filaEventos = filaEventos.then(() => enviar("/resposta", r)).catch(() => undefined)));
}

export function ligarPonteApp(): void {
  // Global do UXP so dentro da funcao (UXP_ARMADILHAS 3b).
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const ppro = require("premierepro") as any;
  const ate = (rotulo: string, p: Promise<unknown>): Promise<any> => comLimite(rotulo, p, 2000);
  /* eslint-enable @typescript-eslint/no-explicit-any */
  let falhas = 0;
  let ultimoErro = "";

  const ler = async () => {
    const projeto = await ate("projeto", ppro.Project.getActiveProject());
    const seq = projeto ? await ate("sequência", projeto.getActiveSequence()) : null;
    const cursor = seq ? await ate("cursor", seq.getPlayerPosition()) : null;
    const selecao = seq ? await ate("seleção", seq.getSelection()) : null;
    const itens = selecao ? await ate("itens", selecao.getTrackItems()) : [];
    return {
      projeto: projeto?.name ?? null,
      sequencia: seq?.name ?? null,
      cursorS: cursor?.seconds ?? null,
      selecionados: (itens as unknown[]).length,
      quando: Date.now(),
    };
  };

  const passo = async () => {
    try {
      const r = await enviar("/premiere", await ler());
      const corpo = (await r.json().catch(() => ({}))) as { pedidos?: Pedido[] };
      for (const p of corpo.pedidos ?? []) responder(p);
      falhas = 0;
    } catch (e) {
      falhas++;
      // O UXP nao grava log em disco: o ultimo erro diferente fica em ponte-log.json (PluginData).
      const m = `${(e as Error)?.name ?? "Erro"}: ${(e as Error)?.message ?? String(e)}`;
      if (m !== ultimoErro) {
        ultimoErro = m;
        void writeJson("ponte-log.json", { quando: new Date().toISOString(), erro: m }).catch(() => undefined);
      }
    }
    setTimeout(() => void passo(), falhas === 0 ? PASSO_MS : Math.min(5000, PASSO_MS * 2 ** falhas));
  };
  setTimeout(() => void passo(), 1000);
}
