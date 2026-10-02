/*
 * Tela do Captions. So orquestra: pede ao motor (local no painel, remoto no
 * programa) e desenha. Quatro estados no corpo, como o B-Roller: pronto (o que
 * ele vai fazer e o que confere antes), gerando (etapas), resultado (numeros,
 * faixas C1 e C2, filtros e cada legenda; um clique leva o cursor ate ela) e
 * erro (causa e como resolver). Botoes ligados ANTES de qualquer await.
 */

import type { BlocoVisto, EstadoCaptions, MotorCaptions, ResultadoCaptions, TomCaptions } from "../../ferramentas/pro-captions/src/captions.ts";
import { icone, segmentos } from "../shell.ts";

const LISTA_MAX = 80;
const ETAPAS = ["Áudio", "Ouvir", "Montar", "Timeline"];
const tempo = (s: number): string => {
  const t = Math.max(0, Math.round(s));
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`;
};
type Filtro = "todas" | "precos" | "revisar";

/** O erro do motor e como resolver; o que nao esta aqui manda ao registro. */
const COMO_RESOLVER: ReadonlyArray<[RegExp, string, string]> = [
  [/Sem chave/, "Falta a chave do ElevenLabs", "Cole a chave (começa com sk_) no campo de cima e salve, ou escolha a transcrição do Premiere."],
  [/mudo/, "O áudio está mudo", "Confira se a faixa da fala (A1) não está silenciada (M) e se nenhuma outra está em solo (S)."],
  [/Nenhuma palavra|tem transcri/, "Falta a transcrição", "No Premiere: Janela › Texto › Transcrição › Transcrever, ou use o ElevenLabs."],
  [/ElevenLabs/, "O ElevenLabs não respondeu direito", "Confira a internet e o saldo do plano; tente de novo. O mesmo áudio não paga duas vezes."],
];

export function mount(root: HTMLElement, motor: MotorCaptions): void {
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
  const mostrar = (el: HTMLElement, sim: boolean, estilo = "") => el.setAttribute("style", sim ? estilo : "display: none");

  let ocupado = false;
  let estado: EstadoCaptions | null = null;
  let resultado: ResultadoCaptions | null = null;
  /** ElevenLabs quando ha chave; a escolha vale ate fechar a tela. */
  let usarEleven: boolean | null = null;
  let trocandoChave = false;
  let filtro: Filtro = "todas";

  // ---- registro
  const log = pega<HTMLPreElement>("cpLog");
  const vivo = () => doc.body.contains(log);
  const linhas: string[] = [];
  const curtas: Array<{ texto: string; tom: string }> = [];
  const desenharFeed = () => {
    const feed = pega("cpFeed");
    limpar(feed);
    for (const l of curtas.slice(-3)) novo(feed, "span", "feed-linha", l.texto).setAttribute("data-tom", l.tom);
  };
  const registrar = (texto: string, tom: TomCaptions = "passo") => {
    if (!vivo()) return;
    const marca = tom === "erro" ? "✗ " : tom === "aviso" ? "! " : tom === "ok" ? "✓ " : "";
    linhas.push(`${marca}${texto}`);
    log.textContent = linhas.join("\n");
    if (!texto.startsWith("  ")) curtas.push({ texto: `${marca}${texto.trim()}`, tom });
    desenharFeed();
  };
  let logAberto = false;
  const alternarLog = () => {
    logAberto = !logAberto;
    log.setAttribute("style", logAberto ? "" : "display: none");
    pega("cpVerLog").textContent = logAberto ? "esconder o registro completo" : "ver o registro completo";
    if (logAberto) setTimeout(() => (pega("cpRolagem").scrollTop = pega("cpRolagem").scrollHeight), 0);
  };
  clicavel(pega("cpVerLog"), alternarLog);
  clicavel(pega("cpErroLog"), () => {
    if (!logAberto) alternarLog();
  });

  const pill = (texto: string, tom: "ativo" | "ok" | "aviso" | "erro") => {
    pega("cpPill").textContent = texto;
    pega("cpPill").setAttribute("data-tom", tom);
  };
  const corpo = (qual: "vazio" | "andamento" | "resultado" | "erro") => {
    mostrar(pega("cpVazio"), qual === "vazio");
    mostrar(pega("cpAndamento"), qual === "andamento");
    mostrar(pega("cpResultado"), qual === "resultado");
    mostrar(pega("cpErro"), qual === "erro");
  };

  // ---- de onde vem a fala, e a chave
  const desenharFontes = () => {
    const caixa = pega("cpFontes");
    limpar(caixa);
    const opcoes: Array<[boolean, string]> = [
      [true, "ElevenLabs (mais fiel)"],
      [false, "Transcrição do Premiere"],
    ];
    for (const [eleven, rot] of opcoes) {
      const tg = novo(caixa, "div", "br-tg");
      tg.setAttribute("role", "button");
      tg.setAttribute("tabindex", "0");
      tg.setAttribute("aria-pressed", usarEleven === eleven ? "true" : "false");
      tg.setAttribute("data-on", usarEleven === eleven ? "sim" : "nao");
      novo(tg, "span", "br-ck");
      novo(tg, "span", "", rot);
      clicavel(tg, () => {
        if (ocupado) return;
        usarEleven = eleven;
        desenharFontes();
        if (estado) desenharConfere(estado);
      });
    }
    const chave = estado?.chave ?? null;
    const precisaCampo = usarEleven === true && (chave === null || trocandoChave);
    mostrar(pega("cpChaveSalva"), usarEleven === true && chave !== null && !trocandoChave, "margin-top: 2px");
    mostrar(pega("cpChaveNova"), precisaCampo, "margin-top: 4px");
    pega("cpChaveTxt").textContent = chave ? `Chave do ElevenLabs salva (termina em ${chave})` : "";
  };
  clicavel(pega("cpChaveTrocar"), () => {
    trocandoChave = true;
    desenharFontes();
  });
  const salvarChave = async () => {
    if (ocupado || !estado) return;
    ocupado = true;
    try {
      const fim = await motor.salvarChave(pega<HTMLInputElement>("cpChave").value);
      // O campo esvazia: a chave nao fica exposta na tela depois de salva.
      pega<HTMLInputElement>("cpChave").value = "";
      estado = { ...estado, chave: fim };
      trocandoChave = false;
      registrar("chave do ElevenLabs salva neste computador", "ok");
      desenharFontes();
      desenharConfere(estado);
    } catch (e) {
      registrar((e as Error)?.message ?? String(e), "erro");
    } finally {
      ocupado = false;
    }
  };
  clicavel(pega("cpSalvarChave"), () => void salvarChave());

  // ---- pronto
  const desenharConfere = (e: EstadoCaptions) => {
    const caixa = pega("cpConfere");
    limpar(caixa);
    const item = (ok: boolean | null, texto: string) => {
      const l = novo(caixa, "div", "br-confere-linha");
      const m = novo(l, "span", "br-marca", ok === null ? "!" : ok ? "✓" : "✗");
      m.setAttribute("style", `color: ${ok === null ? "#eeab4c" : ok ? "#4ecb8d" : "#ff7d71"}`);
      novo(l, "span", "", texto);
    };
    item(e.clipesV1 > 0, e.clipesV1 > 0 ? `${e.clipesV1} clipes na V1 de ${e.nome}` : "A V1 está vazia");
    if (usarEleven) {
      item(e.chave !== null, e.chave !== null ? "Chave do ElevenLabs salva" : "Falta a chave do ElevenLabs");
      item(true, `Termos de ${e.empresa} (troca no AutoEdit)`);
      item(true, "O mesmo áudio de antes não paga de novo");
    } else {
      const todas = e.midias > 0 && e.comTranscricao === e.midias;
      item(
        e.comTranscricao === 0 ? false : todas ? true : null,
        e.midias === 0 ? "Sem mídia na V1" : `Transcrição do Premiere em ${e.comTranscricao} de ${e.midias} mídia(s)`
      );
    }
  };

  // ---- gerando
  const desenharEtapas = (agora: number) => {
    const caixa = pega("cpEtapas");
    limpar(caixa);
    ETAPAS.forEach((rot, i) => {
      const e = novo(caixa, "div", "br-etapa");
      e.setAttribute("data-estado", i < agora ? "feito" : i === agora ? "agora" : "falta");
      novo(e, "span", "br-bola");
      novo(e, "span", "br-etapa-rot", rot);
    });
  };

  // ---- resultado
  const desenharFaixa = (id: string, itens: readonly BlocoVisto[], classe: string, dur: number) => {
    const faixa = pega(id);
    limpar(faixa);
    for (const s of segmentos(itens.map((b) => ({ de: b.inicio, ate: b.fim })), dur)) {
      novo(faixa, "span", `tl-seg${s.item < 0 ? "" : ` ${classe}`}`).setAttribute("style", `flex-grow: ${s.grow}`);
    }
  };
  const passa = (b: BlocoVisto): boolean => filtro === "todas" || (filtro === "precos" && b.preco) || (filtro === "revisar" && b.revisar.length > 0);
  const desenharFiltros = (r: ResultadoCaptions) => {
    const caixa = pega("cpFiltros");
    limpar(caixa);
    const opcoes: Array<[Filtro, string]> = [
      ["todas", `Todas ${r.blocos.length}`],
      ["precos", `Preços ${r.blocos.filter((b) => b.preco).length}`],
      ["revisar", `Revisar ${r.blocos.filter((b) => b.revisar.length > 0).length}`],
    ];
    for (const [id, rot] of opcoes) {
      const f = novo(caixa, "div", "br-filtro", rot);
      f.setAttribute("role", "button");
      f.setAttribute("tabindex", "0");
      f.setAttribute("data-on", filtro === id ? "sim" : "nao");
      clicavel(f, () => {
        filtro = id;
        desenharFiltros(r);
        desenharLista(r);
      });
    }
  };
  const desenharLista = (r: ResultadoCaptions) => {
    const lista = pega("cpLista");
    limpar(lista);
    const visiveis = r.blocos.filter(passa);
    for (const b of visiveis.slice(0, LISTA_MAX)) {
      const l = novo(lista, "div", "cp-linha");
      l.setAttribute("role", "button");
      l.setAttribute("tabindex", "0");
      l.setAttribute("title", "Levar o cursor até esta legenda");
      novo(l, "span", "cp-tempo", tempo(b.inicio));
      const txt = novo(l, "div", "cp-texto");
      const linha = novo(txt, "div", "", b.texto);
      if (b.preco) linha.setAttribute("style", "color: #ff9a90; font-weight: 600");
      if (b.revisar.length > 0) novo(txt, "div", "cp-motivo", b.revisar.join("; "));
      novo(l, "span", "cp-ir", "ir ›");
      clicavel(l, () => {
        if (ocupado) return;
        void motor.irPara(b.inicio).catch((e) => registrar((e as Error)?.message ?? String(e), "erro"));
      });
    }
    const resto = visiveis.length - Math.min(visiveis.length, LISTA_MAX);
    pega("cpRodapeLista").textContent = resto > 0 ? `+ ${resto} no registro completo` : visiveis.length === 0 ? "Nada neste filtro." : "";
  };
  const desenharResultado = (r: ResultadoCaptions) => {
    const precos = r.blocos.filter((b) => b.preco);
    pega("cpMetLeg").textContent = String(r.blocos.length - precos.length);
    pega("cpMetPreco").textContent = String(precos.length);
    pega("cpMetRev").textContent = String(r.blocos.filter((b) => b.revisar.length > 0).length);
    desenharFaixa("cpFaixaC1", r.blocos.filter((b) => !b.preco), "cp-normal", r.duracaoS);
    desenharFaixa("cpFaixaC2", precos, "cp-preco", r.duracaoS);
    pega("cpFonteTxt").textContent =
      `${r.palavras} palavras · ` +
      (r.fonte === "elevenlabs" ? (r.reaproveitada ? "ElevenLabs (mesmo áudio de antes, sem custo)" : "ouvidas agora pelo ElevenLabs") : "transcrição do Premiere");
    const avisos = pega("cpAvisos");
    limpar(avisos);
    if (r.reprovados.length > 0) {
      novo(avisos, "div", "cp-aviso", `${r.reprovados.length} legenda(s) reprovada(s) na conferência: nada foi escrito. ${r.reprovados.slice(0, 3).join(" · ")}`);
    }
    if (r.avisoFala) novo(avisos, "div", "cp-aviso", r.avisoFala);
    for (const t of r.timeline.filter((x) => x.tipo !== "ok")) novo(avisos, "div", "cp-aviso", t.texto);
    filtro = "todas";
    desenharFiltros(r);
    desenharLista(r);
  };

  // ---- acoes
  const umPorVez = (tarefa: () => Promise<void>) => async () => {
    if (ocupado) return;
    ocupado = true;
    try {
      await tarefa();
    } catch (e) {
      // O motor ja contou o erro no registro; aqui o estado, a causa e como resolver.
      if (!vivo()) return;
      const m = (e as Error)?.message ?? String(e);
      const achado = COMO_RESOLVER.find(([re]) => re.test(m));
      pega("cpErroTitulo").textContent = achado?.[1] ?? "Parou";
      pega("cpErroTexto").textContent = m;
      pega("cpErroComo").textContent = achado?.[2] ?? "O registro completo diz onde parou.";
      pill("falhou", "erro");
      corpo("erro");
    } finally {
      ocupado = false;
    }
  };

  const reler = umPorVez(async () => {
    pill("lendo", "ativo");
    const e = await motor.ler();
    if (!vivo()) return;
    estado = e;
    if (usarEleven === null) usarEleven = e.chave !== null;
    pega("cpSeq").textContent = `· ${e.nome}`;
    pega("cpSub").textContent = `${tempo(e.duracaoS)} · ${e.clipesV1} clipes na V1 · termos de ${e.empresa}`;
    desenharFontes();
    desenharConfere(e);
    if (!resultado) corpo("vazio");
    pill(resultado ? "legendas geradas" : "pronto", "ok");
  });

  const gerar = umPorVez(async () => {
    const eleven = usarEleven === true;
    pill("gerando", "ativo");
    desenharEtapas(eleven ? 0 : 1);
    pega("cpAndamentoTxt").textContent = "Lendo a sequência…";
    corpo("andamento");
    pega("cpGerarTxt").textContent = "Gerando…";
    try {
      const r = await motor.gerar(eleven, registrar, (etapa, texto) => {
        if (!vivo()) return;
        desenharEtapas(etapa);
        pega("cpAndamentoTxt").textContent = `${texto}…`;
      });
      if (!vivo()) return;
      resultado = r;
      pega("cpSeq").textContent = `· ${r.nome}`;
      desenharResultado(r);
      corpo("resultado");
      const revisar = r.blocos.filter((b) => b.revisar.length > 0).length;
      if (r.reprovados.length > 0) pill("reprovado", "aviso");
      else pill(revisar > 0 ? `${revisar} para revisar` : "legendas geradas", revisar > 0 ? "aviso" : "ok");
    } finally {
      if (vivo()) pega("cpGerarTxt").textContent = resultado ? "Gerar de novo" : "Gerar legendas";
    }
  });

  clicavel(pega("cpGerar"), () => void gerar());
  clicavel(pega("cpReler"), () => void reler());
  clicavel(pega("cpErroDeNovo"), () => {
    corpo(resultado ? "resultado" : "vazio");
    void gerar();
  });
  pega("cpIcoGerar").innerHTML = icone("legendas", "#ffffff");
  pega("cpIcoReler").innerHTML = icone("reler", "#9098a6");

  corpo("vazio");
  void reler();
}
