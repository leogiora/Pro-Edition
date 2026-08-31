/*
 * Painel do Auto Split. So orquestra: le a sequencia, mostra, e chama o
 * adapter. Nenhuma chamada a `premierepro` mora aqui.
 *
 * `root` chega mas nao e usado para escopar busca de elemento: o shell
 * substitui document.body inteiro antes de cada mount(), entao nunca ha duas
 * telas no mesmo documento. Se isso mudar, este arquivo muda junto.
 */

import { aplicarSplit, diagnostico, getSequenceInfo, type OpcoesSplit } from "../autosplit-premiere.ts";

export function mount(root: HTMLElement): void {
  const pega = <T extends HTMLElement>(id: string): T => root.querySelector<T>(`#${id}`)!;
  const log = pega<HTMLPreElement>("asLog");
  const faixa = pega<HTMLInputElement>("asFaixa");
  const divisao = pega<HTMLInputElement>("asDivisao");
  const refazer = pega<HTMLInputElement>("asRefazer");

  const escrever = (...linhas: readonly string[]) => {
    log.textContent = linhas.join("\n");
  };
  const mostrarErro = (e: unknown) => escrever(`Erro: ${(e as Error)?.message ?? String(e)}`);

  /** O campo recebe o numero humano (V2 = 2); o adapter quer indice base 0. */
  const lerOpcoes = (): OpcoesSplit => {
    const bruto = faixa.value.trim();
    const n = Number(bruto);
    return {
      faixa: bruto === "" || !Number.isFinite(n) || n < 1 ? null : n - 1,
      divisao: Number(divisao.value) || 50,
      subirDoutor: false, // entra junto com o nudge do doutor, ainda nao feito
      refazer: refazer.checked,
    };
  };

  void (async () => {
    try {
      const info = await getSequenceInfo();
      escrever(
        `${info.name} — ${info.width}x${info.height}`,
        "",
        "Revise os B-rolls antes de aplicar. Um Ctrl+Z desfaz cada etapa.",
      );
    } catch (e) {
      mostrarErro(e);
    }
  })();

  pega<HTMLButtonElement>("asAplicar").addEventListener("click", () => {
    void (async () => {
      try {
        escrever("Aplicando...");
        const r = await aplicarSplit(lerOpcoes());
        escrever(
          ...r.linhas,
          "",
          r.ok ? "Pronto. Ajuste o que precisar no Premiere." : "Aplicado COM PROBLEMA — veja as linhas acima.",
        );
      } catch (e) {
        mostrarErro(e);
      }
    })();
  });

  pega<HTMLButtonElement>("asDiag").addEventListener("click", () => {
    void (async () => {
      try {
        escrever("Rodando diagnostico...");
        escrever(...(await diagnostico()));
      } catch (e) {
        mostrarErro(e);
      }
    })();
  });
}
