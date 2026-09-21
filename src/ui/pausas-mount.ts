/*
 * Painel do Auto Pausas. So orquestra: le, mostra, chama o adapter.
 *
 * `root` chega mas nao e usado para escopar busca de elemento: o shell
 * substitui document.body inteiro antes de cada mount(), entao nunca ha duas
 * telas no mesmo documento. Se isso mudar, este arquivo muda junto.
 */

import {
  analisarGravacao,
  aplicarPausas,
  audioPronto,
  desfazerPausas,
  diagnostico,
  guardarRegistro,
  lerAudio,
  lerGravacao,
  sondaDaV1,
} from "../pausas-premiere.ts";
import { MARGEM_PADRAO_S, pedacosDoPlano, planejarCortes, primeiraPalavra, relogio, ultimaPalavra } from "../pausas.ts";

/** O campo aceita virgula (teclado pt-BR) e ponto. Valor invalido volta ao padrao. */
export function lerMargem(bruto: string): number {
  const n = Number(bruto.trim().replace(",", "."));
  return Number.isFinite(n) && n >= 0 && n <= 1 ? n : MARGEM_PADRAO_S;
}

/** Cada abertura da tela ganha um numero: a vigia de uma tela velha se reconhece e para. */
let aberturas = 0;

export function mount(root: HTMLElement): void {
  const pega = <T extends HTMLElement>(id: string): T => root.querySelector<T>(`#${id}`)!;
  const log = pega<HTMLPreElement>("apLog");

  // O que importa (o resumo) e a PRIMEIRA linha aqui: a lista de cortes vem
  // depois e pode ser longa, entao o log fica no topo, nao no fim.
  const escrever = (...linhas: readonly string[]) => {
    log.textContent = linhas.join("\n");
    log.scrollTop = 0;
    // Gravar e melhor-esforco: falha de disco nunca pode esconder o resultado da tela.
    void guardarRegistro(linhas).catch(() => undefined);
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

  const abrir = async () => {
    const g = await lerGravacao();
    const nome = pega("apSeqNome");
    nome.textContent = g.nomeSequencia;
    nome.setAttribute("data-vazio", "nao");
    pega("apDica").style.display = "none";
    escrever(
      `${g.clipes} clipe${g.clipes === 1 ? "" : "s"} na V1 · ${g.palavras.length} palavras na transcrição · ${relogio(g.duracaoQ, g.fps)} de gravação.`,
      "O áudio de cada bruta é lido sozinho, uma vez (uns segundos): depois disso, Cortar pausas vai direto."
    );
    estado("pronto", "ok");
  };

  const previa = async () => {
    estado("analisando…", "ativo");
    escrever("Medindo a fala...");
    const a = await analisarGravacao(() => estado("lendo áudio…", "ativo"));
    const margemS = lerMargem(pega<HTMLInputElement>("apMargem").value);
    const plano = planejarCortes(a.blocos, { fps: a.fps, duracaoQ: a.duracaoQ, margemS });
    // A duracao final conta os espacos que o editor deixou entre os videos (eles ficam).
    const { totalQ } = pedacosDoPlano(plano.trechos, a.clipesQ);
    const quando = (segundos: number) => relogio(Math.round(segundos * a.fps), a.fps);
    const avisos = a.blocos.filter((b) => b.motivo !== "fala");

    escrever(
      `${plano.cortes.length} pausas para cortar · ${relogio(plano.duracaoAntesQ, a.fps)} → ${relogio(totalQ, a.fps)}` +
        (a.clipes > 1 ? ` · ${a.clipes} vídeos, o espaço entre eles fica` : ""),
      `${a.palavras.length} palavras · ${a.blocos.length} blocos de fala · ${
        a.segundosAudio >= 0.5 ? `áudio lido em ${a.segundosAudio.toFixed(1).replace(".", ",")} s` : "áudio já lido"
      } · margem ${String(margemS).replace(".", ",")} s`,
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

  // O audio de cada bruta e lido SOZINHO, uma vez, quando ela aparece na V1 e
  // a timeline para por um instante: quando o editor termina de separar os
  // videos e clica Cortar, ja esta lido (antes: ~7 s parado no selo a cada
  // clique). A vigia so olha a sequencia e quantos clipes ha na V1; a timeline
  // inteira so e lida quando isso muda.
  let sondaVista = "";
  let sondaTratada = "";
  let vigiando = false;
  const vigiar = async (agora = false) => {
    if (ocupado || vigiando) return;
    vigiando = true;
    let leu = false;
    try {
      const sonda = await sondaDaV1();
      const parada = agora || sonda === sondaVista;
      sondaVista = sonda;
      if (!parada || sonda === sondaTratada) return;
      sondaTratada = sonda;
      if (await audioPronto()) return;
      leu = true;
      estado("lendo áudio…", "ativo");
      await lerAudio();
    } catch {
      // Timeline que o corte recusaria, ou que mudou no meio da leitura: o erro
      // de verdade aparece no clique, e o clique le o audio se ainda faltar.
    } finally {
      vigiando = false;
      if (leu && !ocupado) estado("pronto", "ok");
    }
  };
  // O shell troca o document.body inteiro ao mudar de ferramenta: a vigia
  // desta abertura para quando o log dela some.
  const abertura = String(++aberturas);
  log.setAttribute("data-abertura", abertura);
  const vigia = setInterval(() => {
    if (document.getElementById("apLog")?.getAttribute("data-abertura") !== abertura) clearInterval(vigia);
    else void vigiar();
  }, 2000);

  void abrir()
    .catch(mostrarErro)
    .finally(() => vigiar(true));

  pega("apAnalisar").addEventListener("click", umPorVez(previa));

  pega("apCortar").addEventListener(
    "click",
    umPorVez(async () => {
      estado("preparando…", "ativo");
      escrever("Cortando. Não mexa na timeline até terminar.");
      const r = await aplicarPausas(lerMargem(pega<HTMLInputElement>("apMargem").value), (texto) => estado(texto, "ativo"));
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
