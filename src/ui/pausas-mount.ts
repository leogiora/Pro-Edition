/*
 * Painel do Auto Pausas. So orquestra: le, mostra, chama o adapter.
 *
 * `root` chega mas nao e usado para escopar busca de elemento: o shell
 * substitui document.body inteiro antes de cada mount(), entao nunca ha duas
 * telas no mesmo documento. Se isso mudar, este arquivo muda junto.
 */

import { lerGravacao } from "../pausas-premiere.ts";
import { MARGEM_PADRAO_S, planejarCortes } from "../pausas.ts";

/** O campo aceita virgula (teclado pt-BR) e ponto. Valor invalido volta ao padrao. */
export function lerMargem(bruto: string): number {
  const n = Number(bruto.trim().replace(",", "."));
  return Number.isFinite(n) && n >= 0 && n <= 1 ? n : MARGEM_PADRAO_S;
}

/** mm:ss a partir de quadros. O painel nunca mostra quadro cru. */
export function relogio(quadros: number, fps: number): string {
  const s = Math.max(0, Math.round(quadros / fps));
  return `${Math.floor(s / 60)}:${String(s % 60).padStart(2, "0")}`;
}

export function mount(root: HTMLElement): void {
  const pega = <T extends HTMLElement>(id: string): T => root.querySelector<T>(`#${id}`)!;
  const log = pega<HTMLPreElement>("apLog");

  // O que importa (o resumo) e a PRIMEIRA linha aqui: a lista de cortes vem
  // depois e pode ser longa, entao o log fica no topo, nao no fim.
  const escrever = (...linhas: readonly string[]) => {
    log.textContent = linhas.join("\n");
    log.scrollTop = 0;
  };
  const estado = (texto: string, tom: "ativo" | "ok" | "aviso" | "erro") => {
    const badge = pega("apEstado");
    badge.textContent = texto;
    badge.setAttribute("data-tom", tom);
  };
  const mostrarErro = (e: unknown) => {
    estado("falhou", "erro");
    escrever(`Erro: ${(e as Error)?.message ?? String(e)}`);
  };

  const previa = async () => {
    const g = await lerGravacao();
    const nome = pega("apSeqNome");
    nome.textContent = g.nomeSequencia;
    nome.setAttribute("data-vazio", "nao");
    pega("apDica").style.display = "none";

    const plano = planejarCortes(g.palavras, {
      fps: g.fps,
      duracaoQ: g.duracaoQ,
      margemS: lerMargem(pega<HTMLInputElement>("apMargem").value),
    });

    escrever(
      `${plano.cortes.length} pausas para cortar · ${relogio(plano.duracaoAntesQ, g.fps)} → ${relogio(plano.duracaoDepoisQ, g.fps)}`,
      `${g.palavras.length} palavras na transcrição · margem de ${lerMargem(pega<HTMLInputElement>("apMargem").value)}s`,
      "",
      ...plano.cortes.map((c) => {
        const seg = ((c.fimQ - c.inicioQ) / g.fps).toFixed(1).replace(".", ",");
        // Corte maior que 1s e onde uma palavra nao transcrita poderia estar
        // escondida: e o unico lugar que pede conferencia humana.
        const aviso = c.fimQ - c.inicioQ > g.fps ? "  <- confira" : "";
        return `${relogio(c.inicioQ, g.fps)} · ${seg} s · "${c.antes}" | "${c.depois}"${aviso}`;
      })
    );
    estado("prévia pronta", "ok");
  };

  void previa().catch(mostrarErro);

  pega("apCortar").addEventListener("click", () => {
    escrever("Ainda não corta: o teste da mecânica no Premiere vem antes (Task 5).");
  });
}
