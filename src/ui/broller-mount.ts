/*
 * Tela do B-Roller. So orquestra: pede ao motor (local no painel, remoto no
 * programa) e desenha a pasta, as opcoes, a faixa V2 com o que ja estava e o
 * que entrou, e a lista de cada B-roll com a fala daquele ponto.
 * Botoes ligados ANTES de qualquer await (UXP_ARMADILHAS, regra 2).
 */

import { DEFAULT_CONFIG, type Config } from "../../ferramentas/auto-broll/src/domain.ts";
import type { EstadoBroll, MotorBroll, ResultadoBroll, TomBroll, TrechoBroll } from "../../ferramentas/auto-broll/src/broller.ts";
import { icone, segmentos } from "../shell.ts";

const LISTA_MAX = 60;
const tempo = (s: number): string => {
  const t = Math.max(0, Math.round(s));
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`;
};

type Opcao = "fillScreen" | "densidadeMaxima" | "removeAudio";
const OPCOES: ReadonlyArray<{ chave: Opcao; rotulo: string }> = [
  { chave: "fillScreen", rotulo: "Preencher a tela" },
  { chave: "densidadeMaxima", rotulo: "Densidade máxima" },
  { chave: "removeAudio", rotulo: "Sem o áudio do B-roll" },
];

export function mount(root: HTMLElement, motor: MotorBroll): void {
  const pega = <T extends HTMLElement>(id: string): T => root.querySelector<T>(`#${id}`)!;
  const doc = root.ownerDocument;
  const limpar = (el: HTMLElement) => {
    while (el.firstChild) el.removeChild(el.firstChild);
  };
  const novo = (pai: HTMLElement, tag: string, classe: string, texto = ""): HTMLElement => {
    const el = doc.createElement(tag);
    el.className = classe;
    el.textContent = texto;
    pai.appendChild(el);
    return el;
  };
  /** Todo clique acende o que foi tocado por um instante. */
  const clicavel = (el: HTMLElement, fazer: () => void) => {
    const ir = () => {
      el.setAttribute("data-apertado", "sim");
      setTimeout(() => el.setAttribute("data-apertado", "nao"), 180);
      fazer();
    };
    el.addEventListener("click", ir);
    el.addEventListener("keydown", (e) => {
      if ((e as KeyboardEvent).key === "Enter" || (e as KeyboardEvent).key === " ") ir();
    });
  };

  let config: Config | null = null;
  let ocupado = false;

  // ---- registro: as ultimas linhas embaixo; o completo atras de um clique (e no arquivo, pelo motor)
  const log = pega<HTMLPreElement>("brLog");
  // Trocou de tela no meio de uma acao: a resposta tardia nao escreve na tela nova.
  const vivo = () => doc.body.contains(log);
  const linhas: string[] = [];
  const curtas: Array<{ texto: string; tom: string }> = [];
  const desenharFeed = () => {
    const feed = pega("brFeed");
    limpar(feed);
    if (curtas.length === 0) novo(feed, "span", "feed-linha", "O que acontece aparece aqui.");
    for (const l of curtas.slice(-4)) novo(feed, "span", "feed-linha", l.texto).setAttribute("data-tom", l.tom);
  };
  const registrar = (texto: string, tom: TomBroll = "passo") => {
    if (!vivo()) return;
    const marca = tom === "erro" ? "✗ " : tom === "aviso" ? "! " : tom === "ok" ? "✓ " : "";
    linhas.push(`${marca}${texto}`);
    log.textContent = linhas.join("\n");
    // As linhas recuadas sao detalhe (fala de cada B-roll, descartes): so no registro completo.
    if (!texto.startsWith("  ")) curtas.push({ texto: `${marca}${texto.trim()}`, tom: tom === "vazio" ? "passo" : tom });
    desenharFeed();
  };
  let logAberto = false;
  clicavel(pega("brVerLog"), () => {
    logAberto = !logAberto;
    log.setAttribute("style", logAberto ? "" : "display: none");
    pega("brVerLog").textContent = logAberto ? "esconder o registro completo" : "ver o registro completo";
    if (logAberto) setTimeout(() => (pega("brRolagem").scrollTop = pega("brRolagem").scrollHeight), 0);
  });

  const pill = (texto: string, tom: "ativo" | "ok" | "aviso" | "erro") => {
    pega("brPill").textContent = texto;
    pega("brPill").setAttribute("data-tom", tom);
  };
  const prog = (texto: string) => {
    pega("brProg").textContent = texto;
  };

  // ---- opcoes em botoes, a pasta num campo
  const pasta = pega<HTMLInputElement>("brPasta");
  const desenharOpcoes = () => {
    const caixa = pega("brOpcoes");
    limpar(caixa);
    for (const o of OPCOES) {
      const ligado = config?.[o.chave] ?? false;
      const chip = novo(caixa, "div", "chip", o.rotulo);
      chip.setAttribute("role", "button");
      chip.setAttribute("tabindex", "0");
      chip.setAttribute("data-on", ligado ? "sim" : "nao");
      if (ligado) chip.setAttribute("style", "border-color: #8d82f5");
      clicavel(chip, () => {
        if (ocupado || !config) return;
        config = { ...config, [o.chave]: !ligado };
        desenharOpcoes();
      });
    }
  };
  const configAtual = (): Config | null => (config ? { ...config, libraryPath: pasta.value.trim() } : null);

  // ---- a faixa V2 e a lista
  const desenhar = (dur: number, antes: readonly TrechoBroll[], novos: ResultadoBroll["inseridos"]) => {
    const faixa = pega("brFaixa");
    limpar(faixa);
    const itens = [...antes.map((t) => ({ de: t.inicio, ate: t.fim, novo: false })), ...novos.map((t) => ({ de: t.inicio, ate: t.fim, novo: true }))];
    for (const s of segmentos(itens, dur)) {
      const classe = s.item < 0 ? "" : itens[s.item]!.novo ? "tl-V2" : "br-antes";
      novo(faixa, "span", `tl-seg ${classe}`).setAttribute("style", `flex-grow: ${s.grow}`);
    }
    pega("brMetAntes").textContent = String(antes.length);

    const lista = pega("brLista");
    limpar(lista);
    for (const b of novos.slice(0, LISTA_MAX)) {
      const linha = novo(lista, "div", "br-item");
      novo(linha, "span", "br-item-tempo", tempo(b.inicio));
      novo(linha, "span", "br-item-arquivo", b.arquivo);
      novo(linha, "span", "br-item-frase", `"${b.frase}"`);
    }
    if (novos.length > LISTA_MAX) novo(lista, "div", "br-item", `e mais ${novos.length - LISTA_MAX} no registro completo`);
  };
  const mostrarSequencia = (e: EstadoBroll) => {
    pega("brSeq").textContent = `· ${e.nome}`;
    desenhar(e.duracaoS, e.naTimeline, []);
  };

  // ---- acoes
  const umPorVez = (tarefa: () => Promise<void>) => async () => {
    if (ocupado) return;
    ocupado = true;
    try {
      await tarefa();
    } catch (e) {
      // O motor ja contou o erro no registro; aqui so o estado.
      if (!vivo()) return;
      const m = (e as Error)?.message ?? String(e);
      pill("falhou", "erro");
      prog(`Parou: ${m}`);
    } finally {
      ocupado = false;
    }
  };

  const reler = umPorVez(async () => {
    pill("lendo", "ativo");
    const e = await motor.ler();
    if (!vivo()) return;
    mostrarSequencia(e);
    prog(`${e.formato} · ${String(Math.round(e.fps * 100) / 100).replace(".", ",")} fps · ${tempo(e.duracaoS)} · ${e.naTimeline.length} B-roll(s) acima da V1`);
    pill("pronto", "ok");
  });

  const analisar = umPorVez(async () => {
    const c = configAtual();
    if (!c) return;
    pill("analisando", "ativo");
    prog("Lendo a fala e escolhendo os B-rolls…");
    const r = await motor.analisar(c, registrar);
    if (!vivo()) return;
    config = c;
    pega("brSeq").textContent = `· ${r.nome}`;
    pega("brMetPasta").textContent = String(r.naPasta);
    pega("brMetNovos").textContent = String(r.inseridos.length);
    desenhar(r.duracaoS, r.naTimeline, r.inseridos);
    pill(r.inseridos.length > 0 ? `${r.inseridos.length} inseridos` : "nada a inserir", "ok");
    prog(
      r.inseridos.length > 0
        ? "Apague na timeline os que não serviram: a próxima análise (ou o Aprender) aprende com isso. Três Ctrl+Z desfazem tudo."
        : "Nada novo para inserir. O registro diz por quê."
    );
  });

  const aprender = umPorVez(async () => {
    const c = configAtual();
    if (!c) return;
    pill("aprendendo", "ativo");
    prog("Lendo o que você manteve, apagou e colocou na timeline…");
    await motor.aprender(c, registrar);
    if (!vivo()) return;
    config = c;
    pill("aprendido", "ok");
    prog("Aprendizado gravado. Nada foi inserido na timeline.");
  });

  clicavel(pega("brAnalisar"), () => void analisar());
  clicavel(pega("brAprender"), () => void aprender());
  clicavel(pega("brReler"), () => void reler());
  pega("brIcoAnalisar").innerHTML = icone("broll", "#ffffff");
  pega("brIcoAprender").innerHTML = icone("selecao", "#85b7eb");
  pega("brIcoReler").innerHTML = icone("reler", "#9098a6");

  desenharFeed();
  desenharOpcoes();
  // Configuracao, dicionario e merge do canonico primeiro (o motor conta no
  // registro); a sequencia depois.
  void (async () => {
    ocupado = true;
    try {
      config = await motor.iniciar(registrar);
      if (!vivo()) return;
      pasta.value = config.libraryPath;
      desenharOpcoes();
    } catch (e) {
      config = DEFAULT_CONFIG;
      if (vivo()) registrar(`Configuração não carregou, usando a padrão: ${(e as Error)?.message ?? String(e)}`, "aviso");
    } finally {
      ocupado = false;
    }
    await reler();
  })();
}
