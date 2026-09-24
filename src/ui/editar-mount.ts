/*
 * Tela do Editar. So orquestra: le o estado, liga as caixas, chama o adapter.
 * Botoes ligados ANTES de qualquer await (UXP_ARMADILHAS, regra 2).
 */

import { relogio } from "../../ferramentas/auto-broll/src/domain.ts";
import { writeJson, readJson } from "../../ferramentas/auto-broll/src/premiere.ts";
import { editar, lerEstado, type Registrar } from "../editar-premiere.ts";

const LOG = "editar-log.json";

export function mount(root: HTMLElement): void {
  const pega = <T extends HTMLElement>(id: string): T => root.querySelector<T>(`#${id}`)!;
  const log = pega<HTMLPreElement>("edLog");
  const linhas: string[] = [];

  const registrar: Registrar = (texto, tipo = "passo") => {
    const marca = tipo === "erro" ? "✗ " : tipo === "aviso" ? "! " : tipo === "ok" ? "✓ " : "";
    linhas.push(`${marca}${texto}`);
    log.textContent = linhas.join("\n");
    log.scrollTop = log.scrollHeight;
  };
  const estado = (texto: string, tom: "ativo" | "ok" | "aviso" | "erro") => {
    const badge = pega("edEstado");
    badge.textContent = texto;
    badge.setAttribute("data-tom", tom);
  };
  const marcado = (id: string) => (pega(id) as HTMLElement & { checked?: boolean }).checked === true;

  // Guarda as 10 ultimas execucoes: o log da tela e o que se ve; o arquivo e o que se le depois.
  const guardarLog = async () => {
    const antes = (await readJson(LOG).catch(() => null)) as { execucoes?: unknown[] } | null;
    const execucoes = Array.isArray(antes?.execucoes) ? antes.execucoes : [];
    await writeJson(LOG, { execucoes: [...execucoes, { quando: new Date().toISOString(), linhas: [...linhas] }].slice(-10) });
  };

  const ler = async () => {
    estado("lendo", "ativo");
    try {
      const e = await lerEstado();
      const nome = pega("edSeqNome");
      nome.textContent = e.nome;
      nome.setAttribute("data-vazio", "nao");
      pega("edSeqInfo").textContent =
        `${relogio(e.duracaoS)} · ${e.clipesV1} clipe(s) na V1 · ${e.variacoes} variação(ões) · ` +
        `${e.brollsAcimaDaV1} B-roll(s) acima da V1 · ${e.faixasDeLegenda} faixa(s) de legenda`;
      // Reconhecer o que ja foi feito: B-roll e legenda que ja estao la nao entram de novo por padrao.
      (pega("edBroll") as HTMLElement & { checked?: boolean }).checked = e.brollsAcimaDaV1 === 0;
      (pega("edLegendas") as HTMLElement & { checked?: boolean }).checked = e.faixasDeLegenda === 0;
      if (!e.temChave) registrar("Sem chave do ElevenLabs: salve a chave no Pro Captions antes de editar.", "aviso");
      estado("pronto", "ok");
    } catch (erro) {
      pega("edSeqNome").textContent = "Não consegui ler a sequência";
      pega("edSeqInfo").textContent = (erro as Error)?.message ?? String(erro);
      estado("sem sequência", "aviso");
    }
  };

  let ocupado = false;
  pega("edEditar").addEventListener("click", () => {
    if (ocupado) return;
    ocupado = true;
    linhas.length = 0;
    estado("editando", "ativo");
    void editar(
      { pausas: marcado("edPausas"), broll: marcado("edBroll"), split: marcado("edSplit"), legendas: marcado("edLegendas") },
      registrar,
      (t) => estado(t, "ativo")
    )
      .then(() => estado("pronto", "ok"))
      .catch((erro) => {
        registrar((erro as Error)?.message ?? String(erro), "erro");
        estado("falhou", "erro");
      })
      .finally(() => {
        ocupado = false;
        void guardarLog().catch(() => undefined);
      });
  });
  pega("edRelir").addEventListener("click", () => void ler());

  void ler();
}
