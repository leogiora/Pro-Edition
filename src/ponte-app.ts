/*
 * A "extensao": o plugin conta ao programa Cutline o que esta aberto no
 * Premiere, a cada meio segundo (app/src/premiere-ao-vivo.ts recebe). So o
 * plugin le a timeline; o programa so escuta. Programa fechado: o plugin
 * espera mais entre as tentativas (ate 5 s) e nao avisa nada.
 */

import { comLimite } from "../ferramentas/auto-broll/src/premiere.ts";

declare function require(id: string): unknown;

const ENDERECO = "http://127.0.0.1:47800/premiere";
const PASSO_MS = 500;

export function ligarPonteApp(): void {
  // Global do UXP so dentro da funcao (UXP_ARMADILHAS 3b).
  /* eslint-disable @typescript-eslint/no-explicit-any */
  const ppro = require("premierepro") as any;
  const ate = (rotulo: string, p: Promise<unknown>): Promise<any> => comLimite(rotulo, p, 2000);
  /* eslint-enable @typescript-eslint/no-explicit-any */
  let falhas = 0;

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
      // text/plain: pedido simples, sem pre-voo de CORS.
      await fetch(ENDERECO, { method: "POST", headers: { "Content-Type": "text/plain" }, body: JSON.stringify(await ler()) });
      falhas = 0;
    } catch {
      falhas++;
    }
    setTimeout(() => void passo(), falhas === 0 ? PASSO_MS : Math.min(5000, PASSO_MS * 2 ** falhas));
  };
  setTimeout(() => void passo(), 1000);
}
