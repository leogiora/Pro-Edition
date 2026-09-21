/*
 * Painel do Auto Pausas. So orquestra: le, mostra, chama o adapter.
 *
 * `root` chega mas nao e usado para escopar busca de elemento: o shell
 * substitui document.body inteiro antes de cada mount(), entao nunca ha duas
 * telas no mesmo documento. Se isso mudar, este arquivo muda junto.
 */

import { analisarGravacao, aplicarPausas, desfazerPausas, diagnostico, lerGravacao } from "../pausas-premiere.ts";
import { MARGEM_PADRAO_S, planejarCortes, primeiraPalavra, relogio, ultimaPalavra } from "../pausas.ts";

/** O campo aceita virgula (teclado pt-BR) e ponto. Valor invalido volta ao padrao. */
export function lerMargem(bruto: string): number {
  const n = Number(bruto.trim().replace(",", "."));
  return Number.isFinite(n) && n >= 0 && n <= 1 ? n : MARGEM_PADRAO_S;
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

  // O export do audio leva segundos: um segundo clique no meio exportaria o
  // mesmo arquivo duas vezes ao mesmo tempo.
  let ocupado = false;
  const umPorVez = (tarefa: () => Promise<void>) => () => {
    if (ocupado) return;
    ocupado = true;
    void tarefa()
      .catch(mostrarErro)
      .finally(() => {
        ocupado = false;
      });
  };

  // Abrir a tela so le a sequencia: o audio e exportado no clique, nao aqui.
  const abrir = async () => {
    const g = await lerGravacao();
    const nome = pega("apSeqNome");
    nome.textContent = g.nomeSequencia;
    nome.setAttribute("data-vazio", "nao");
    pega("apDica").style.display = "none";
    escrever(
      `${g.palavras.length} palavras na transcrição · ${relogio(g.duracaoQ, g.fps)} de gravação.`,
      "Clique em Analisar para ver os cortes. O áudio é lido na hora e leva alguns segundos."
    );
    estado("pronto", "ok");
  };

  const previa = async () => {
    estado("lendo áudio…", "ativo");
    escrever("Exportando o áudio da sequência e medindo a fala...");
    const a = await analisarGravacao();
    const margemS = lerMargem(pega<HTMLInputElement>("apMargem").value);
    const plano = planejarCortes(a.blocos, { fps: a.fps, duracaoQ: a.duracaoQ, margemS });
    const quando = (segundos: number) => relogio(Math.round(segundos * a.fps), a.fps);
    const avisos = a.blocos.filter((b) => b.motivo !== "fala");

    escrever(
      `${plano.cortes.length} pausas para cortar · ${relogio(plano.duracaoAntesQ, a.fps)} → ${relogio(plano.duracaoDepoisQ, a.fps)}`,
      `${a.palavras.length} palavras · ${a.blocos.length} blocos de fala · áudio lido em ${a.segundosAudio
        .toFixed(1)
        .replace(".", ",")} s · margem ${String(margemS).replace(".", ",")} s`,
      ...avisos.map((b) =>
        b.motivo === "voz-sem-palavra"
          ? `${quando(b.inicio)} · voz sem palavra na transcrição (fica)`
          : `${quando(b.inicio)} · palavra baixa protegida: "${b.texto}"`
      ),
      "",
      ...plano.cortes.map((c) => {
        const seg = ((c.fimQ - c.inicioQ) / a.fps).toFixed(1).replace(".", ",");
        // Corte maior que 1s e onde uma palavra nao transcrita poderia estar
        // escondida: e o lugar que pede conferencia humana.
        const aviso = c.fimQ - c.inicioQ > a.fps ? "  <- confira" : "";
        return `${relogio(c.inicioQ, a.fps)} · ${seg} s · "${ultimaPalavra(c.antes)}" | "${primeiraPalavra(c.depois)}"${aviso}`;
      })
    );
    estado("prévia pronta", "ok");
  };

  void abrir().catch(mostrarErro);

  pega("apAnalisar").addEventListener("click", umPorVez(previa));

  pega("apCortar").addEventListener(
    "click",
    umPorVez(async () => {
      estado("lendo áudio…", "ativo");
      escrever("Exportando o áudio e cortando. Não mexa na timeline até terminar.");
      const r = await aplicarPausas(lerMargem(pega<HTMLInputElement>("apMargem").value), (feitos, total) =>
        estado(`cortando ${feitos}/${total}`, "ativo")
      );
      escrever(...r.linhas);
      estado(r.ok ? "cortado" : "cortado com problema", r.ok ? "ok" : "erro");
    })
  );

  pega("apDesfazer").addEventListener(
    "click",
    umPorVez(async () => {
      estado("desfazendo…", "ativo");
      escrever(...(await desfazerPausas()));
      estado("desfeito", "ok");
    })
  );

  // Temporario: sai quando o corte estiver calibrado (Task 10).
  pega("apDiag").addEventListener(
    "click",
    umPorVez(async () => {
      estado("diagnóstico", "ativo");
      escrever("Rodando diagnóstico: exportando o áudio da sequência (pode levar alguns segundos)...");
      escrever(...(await diagnostico()));
      estado("diagnóstico pronto", "ok");
    })
  );
}
