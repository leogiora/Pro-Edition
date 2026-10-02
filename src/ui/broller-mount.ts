/*
 * Tela do B-Roller. So orquestra: pede ao motor (local no painel, remoto no
 * programa) e desenha. Quatro estados no corpo: pronto (o que ele vai fazer e o
 * que confere antes), analisando (etapas), resultado (aprendizado, faixa V2,
 * filtros e um cartao por B-roll com Ir para, Trocar take e Tirar) e erro
 * (causa e como resolver). Botoes ligados ANTES de qualquer await (UXP_ARMADILHAS, regra 2).
 */

import { DEFAULT_CONFIG, type Config } from "../../ferramentas/auto-broll/src/domain.ts";
import type { EstadoBroll, Inserido, MotorBroll, ResultadoBroll, TomBroll, TrechoBroll } from "../../ferramentas/auto-broll/src/broller.ts";
import { icone, segmentos } from "../shell.ts";

const LISTA_MAX = 60;
const NOTA_BAIXA = 0.5;
const ETAPAS = ["Fala", "Casar", "Take", "Inserir"];
const virgula = (n: number, casas = 1): string => n.toFixed(casas).replace(".", ",");
const tempo = (s: number): string => {
  const t = Math.max(0, Math.round(s));
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`;
};
/** Sem acento e minusculo: o termo casado vem normalizado, a frase nao. */
const normal = (t: string): string =>
  (typeof t.normalize === "function" ? t.normalize("NFD") : t).replace(/[\u0300-\u036f]/g, "").toLowerCase();

type Opcao = "fillScreen" | "densidadeMaxima" | "removeAudio";
const OPCOES: ReadonlyArray<{ chave: Opcao; rotulo: string }> = [
  { chave: "fillScreen", rotulo: "Preencher a tela" },
  { chave: "densidadeMaxima", rotulo: "Densidade máxima" },
  { chave: "removeAudio", rotulo: "Sem áudio do B-roll" },
];
type Filtro = "todos" | "ensinou" | "baixa";
type Cartao = { b: Inserido; situacao: "ok" | "tirado" | "trocado" | "andando"; aberto: boolean };

/** O erro do motor e como resolver; o que nao esta aqui manda ao registro. */
const COMO_RESOLVER: ReadonlyArray<[RegExp, string, string]> = [
  [/Informe a pasta/, "Falta a pasta de B-rolls", "Cole o caminho da pasta no campo de cima e analise de novo."],
  [/Nenhum video em/, "A pasta não tem vídeos", "Confira o caminho: precisa ter .mp4 ou .mov dentro."],
  [/V1 esta vazia/, "A V1 está vazia", "Coloque a gravação do doutor na V1 e analise de novo."],
  [/transcri/i, "Falta a transcrição", "No Premiere: Janela › Texto › Transcrição › Transcrever, e analise de novo."],
  [/Nao consegui ler a timeline/, "Não deu para ler a timeline", "Feche e abra a sequência no Premiere e tente de novo. Nada foi inserido."],
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
  /** Todo clique acende o que foi tocado por um instante; o clique nao sobe para o cartao. */
  const clicavel = (el: HTMLElement, fazer: () => void) => {
    const ir = () => {
      el.setAttribute("data-apertado", "sim");
      setTimeout(() => el.setAttribute("data-apertado", "nao"), 180);
      fazer();
    };
    el.addEventListener("click", (e) => {
      e.stopPropagation();
      ir();
    });
    el.addEventListener("keydown", (e) => {
      if ((e as KeyboardEvent).key !== "Enter" && (e as KeyboardEvent).key !== " ") return;
      e.stopPropagation();
      ir();
    });
  };
  const mostrar = (el: HTMLElement, sim: boolean) => el.setAttribute("style", sim ? "" : "display: none");

  let config: Config | null = null;
  let ocupado = false;
  let resultado: ResultadoBroll | null = null;
  /** Os cartoes desta rodada, com o que voce fez em cada um. */
  let cartoes: Cartao[] = [];
  let filtro: Filtro = "todos";

  // ---- registro: as ultimas linhas embaixo; o completo atras de um clique (e no arquivo, pelo motor)
  const log = pega<HTMLPreElement>("brLog");
  // Trocou de tela no meio de uma acao: a resposta tardia nao escreve na tela nova.
  const vivo = () => doc.body.contains(log);
  const linhas: string[] = [];
  const curtas: Array<{ texto: string; tom: string }> = [];
  const desenharFeed = () => {
    const feed = pega("brFeed");
    limpar(feed);
    for (const l of curtas.slice(-3)) novo(feed, "span", "feed-linha", l.texto).setAttribute("data-tom", l.tom);
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
  const alternarLog = () => {
    logAberto = !logAberto;
    log.setAttribute("style", logAberto ? "" : "display: none");
    pega("brVerLog").textContent = logAberto ? "esconder o registro completo" : "ver o registro completo";
    if (logAberto) setTimeout(() => (pega("brRolagem").scrollTop = pega("brRolagem").scrollHeight), 0);
  };
  clicavel(pega("brVerLog"), alternarLog);
  clicavel(pega("brErroLog"), () => {
    if (!logAberto) alternarLog();
  });

  const pill = (texto: string, tom: "ativo" | "ok" | "aviso" | "erro") => {
    pega("brPill").textContent = texto;
    pega("brPill").setAttribute("data-tom", tom);
  };
  const corpo = (qual: "vazio" | "andamento" | "resultado" | "erro") => {
    mostrar(pega("brVazio"), qual === "vazio");
    mostrar(pega("brAndamento"), qual === "andamento");
    mostrar(pega("brResultado"), qual === "resultado");
    mostrar(pega("brErro"), qual === "erro");
  };

  // ---- opcoes e pasta
  const pasta = pega<HTMLInputElement>("brPasta");
  const desenharOpcoes = () => {
    const caixa = pega("brOpcoes");
    limpar(caixa);
    for (const o of OPCOES) {
      const ligado = config?.[o.chave] ?? false;
      const tg = novo(caixa, "div", "br-tg");
      tg.setAttribute("role", "button");
      tg.setAttribute("tabindex", "0");
      tg.setAttribute("aria-pressed", ligado ? "true" : "false");
      tg.setAttribute("data-on", ligado ? "sim" : "nao");
      novo(tg, "span", "br-ck");
      novo(tg, "span", "", o.rotulo);
      clicavel(tg, () => {
        if (ocupado || !config) return;
        config = { ...config, [o.chave]: !ligado };
        desenharOpcoes();
      });
    }
  };
  const configAtual = (): Config | null => (config ? { ...config, libraryPath: pasta.value.trim() } : null);

  // ---- pronto: a conferencia antes da analise
  const desenharConfere = (e: EstadoBroll) => {
    const caixa = pega("brConfere");
    limpar(caixa);
    const item = (ok: boolean | null, texto: string) => {
      const l = novo(caixa, "div", "br-confere-linha");
      const m = novo(l, "span", "br-marca", ok === null ? "!" : ok ? "✓" : "✗");
      m.setAttribute("style", `color: ${ok === null ? "#eeab4c" : ok ? "#4ecb8d" : "#ff7d71"}`);
      novo(l, "span", "", texto);
    };
    item(e.clipesV1 > 0, e.clipesV1 > 0 ? `${e.clipesV1} clipes na V1 de ${e.nome}` : "A V1 está vazia");
    item(e.naPasta !== null && e.naPasta > 0, e.naPasta === null ? "Cole o caminho da pasta de B-rolls" : `Pasta com ${e.naPasta} vídeos`);
    const todas = e.midias > 0 && e.comTranscricao === e.midias;
    item(
      e.comTranscricao === 0 ? false : todas ? true : null,
      e.midias === 0 ? "Sem mídia na V1 para transcrever" : `Transcrição do Premiere em ${e.comTranscricao} de ${e.midias} mídia(s)`
    );
    if (e.inOut) item(null, `IN/OUT de ${tempo(e.inOut.inicio)} a ${tempo(e.inOut.fim)}: a análise e o Aprender ficam só nesse trecho`);
    item(true, `Já aprendeu: ${e.aprendizado.mantidos} mantidos, ${e.aprendizado.apagados} apagados, ${e.aprendizado.ligacoes} ligações`);
  };

  // ---- analisando
  const desenharEtapas = (agora: number) => {
    const caixa = pega("brEtapas");
    limpar(caixa);
    ETAPAS.forEach((rot, i) => {
      const e = novo(caixa, "div", "br-etapa");
      e.setAttribute("data-estado", i < agora ? "feito" : i === agora ? "agora" : "falta");
      novo(e, "span", "br-bola");
      novo(e, "span", "br-etapa-rot", rot);
    });
  };

  // ---- resultado
  const desenharAprendizado = (r: ResultadoBroll) => {
    const a = r.aprendizado;
    pega("brBarraVerde").setAttribute("style", `flex-grow: ${a.mantidos + a.apagados === 0 ? 1 : a.mantidos}`);
    pega("brBarraCoral").setAttribute("style", `flex-grow: ${a.apagados}`);
    pega("brMantidos").textContent = `● ${a.mantidos} mantidos`;
    pega("brApagados").textContent = `● ${a.apagados} apagados`;
    pega("brLigacoes").textContent = `${a.ligacoes} ligações`;
    const n = r.nestaRodada;
    pega("brRodada").textContent = n.mantidos + n.apagados > 0 ? `nesta rodada: +${n.mantidos} / +${n.apagados}` : "";
  };
  const desenharFaixa = () => {
    if (!resultado) return;
    const faixa = pega("brFaixa");
    limpar(faixa);
    const vivos = cartoes.filter((c) => c.situacao !== "tirado");
    const itens = [
      ...resultado.naTimeline.map((t: TrechoBroll) => ({ de: t.inicio, ate: t.fim, novo: false })),
      ...vivos.map((c) => ({ de: c.b.inicio, ate: c.b.fim, novo: true })),
    ];
    for (const s of segmentos(itens, resultado.duracaoS)) {
      const ja = s.item >= 0 && !itens[s.item]!.novo;
      const seg = novo(faixa, "span", `tl-seg${s.item >= 0 && !ja ? " tl-V2" : ""}`);
      seg.setAttribute("style", `flex-grow: ${s.grow}${ja ? "; background-color: #3a3f4a" : ""}`);
    }
    const legenda = pega("brLegenda");
    limpar(legenda);
    novo(legenda, "span", "", tempo(0));
    novo(legenda, "span", "br-esp");
    novo(legenda, "span", "", `■ ${vivos.length} novos`).setAttribute("style", "color: #8d82f5; margin-right: 8px");
    novo(legenda, "span", "", `■ ${resultado.naTimeline.length} já estavam`).setAttribute("style", "color: #5f6774");
    novo(legenda, "span", "br-esp");
    novo(legenda, "span", "", tempo(resultado.duracaoS));
  };
  const passaFiltro = (b: Inserido): boolean =>
    filtro === "todos" || (filtro === "ensinou" && b.ensinado) || (filtro === "baixa" && b.nota < NOTA_BAIXA);
  const desenharFiltros = () => {
    const caixa = pega("brFiltros");
    limpar(caixa);
    const opcoes: Array<[Filtro, string]> = [
      ["todos", `Todos ${cartoes.length}`],
      ["ensinou", `Você ensinou ${cartoes.filter((c) => c.b.ensinado).length}`],
      ["baixa", `Nota baixa ${cartoes.filter((c) => c.b.nota < NOTA_BAIXA).length}`],
    ];
    for (const [id, rot] of opcoes) {
      const f = novo(caixa, "div", "br-filtro", rot);
      f.setAttribute("role", "button");
      f.setAttribute("tabindex", "0");
      f.setAttribute("data-on", filtro === id ? "sim" : "nao");
      clicavel(f, () => {
        filtro = id;
        desenharFiltros();
        desenharCartoes();
      });
    }
  };
  /** A frase com a palavra que puxou o B-roll sublinhada. */
  const frase = (pai: HTMLElement, b: Inserido) => {
    const caixa = novo(pai, "div", "bc-frase");
    const termos = b.termos.map(normal).filter((t) => t.length > 2);
    novo(caixa, "span", "", "“");
    for (const parte of b.frase.split(/(\s+)/)) {
      const limpo = normal(parte).replace(/[^a-z0-9]/g, "");
      const casou = limpo.length > 2 && termos.some((t) => limpo.startsWith(t) || t.startsWith(limpo));
      novo(caixa, "span", casou ? "bc-termo" : "", parte);
    }
    novo(caixa, "span", "", "”");
  };
  const desenharCartoes = () => {
    const lista = pega("brLista");
    limpar(lista);
    const visiveis = cartoes.filter((c) => passaFiltro(c.b));
    for (const c of visiveis.slice(0, LISTA_MAX)) {
      const b = c.b;
      const el = novo(lista, "div", "bc");
      el.setAttribute("role", "button");
      el.setAttribute("tabindex", "0");
      el.setAttribute("aria-expanded", c.aberto ? "true" : "false");
      el.setAttribute("data-aberto", c.aberto ? "sim" : "nao");
      el.setAttribute("data-situacao", c.situacao);

      const topo = novo(el, "div", "bc-topo");
      novo(topo, "span", "bc-tempo", tempo(b.inicio));
      novo(topo, "span", "br-esp");
      const tag = (texto: string, cor: string) => novo(topo, "span", `bc-tag bc-tag-${cor}`, texto);
      if (c.situacao === "tirado") tag("tirado", "coral");
      else if (c.situacao === "trocado") tag("trocado", "roxo");
      else if (c.situacao === "andando") tag("mexendo…", "roxo");
      if (b.ensinado) tag("você ensinou", "ambar");
      else if (b.mantidoVezes > 0) tag(`você manteve ${b.mantidoVezes}×`, "verde");
      if (b.nota < NOTA_BAIXA) tag("nota baixa", "ambar");

      frase(el, b);

      const arq = novo(el, "div", "bc-arq");
      novo(arq, "span", "bc-dur", `${virgula(b.fim - b.inicio)}s`);
      const txt = novo(arq, "div", "bc-arq-txt");
      novo(txt, "div", "bc-nome", b.arquivo);
      novo(txt, "div", "bc-conc", `conceito: ${b.conceito}`);
      const nota = novo(arq, "div", "bc-nota");
      const pct = Math.max(0, Math.min(100, Math.round(b.nota * 100)));
      novo(nota, "div", "", `${pct}%`).setAttribute("style", "font-weight: 600");
      const barra = novo(nota, "div", "bc-nota-barra");
      novo(barra, "span", "bc-nota-cheia").setAttribute("style", `flex-grow: ${pct}`);
      novo(barra, "span", "").setAttribute("style", `flex-grow: ${100 - pct}`);

      if (c.aberto && c.situacao !== "tirado") {
        const acoes = novo(el, "div", "bc-acoes");
        const acao = (rot: string, classe: string, fazer: () => void) => {
          const a = novo(acoes, "div", `bc-acao ${classe}`, rot);
          a.setAttribute("role", "button");
          a.setAttribute("tabindex", "0");
          clicavel(a, fazer);
        };
        acao("Ir para", "", () => void irPara(c));
        acao("Trocar take", "", () => void trocar(c));
        acao("Tirar", "bc-acao-tirar", () => void tirar(c));
      }
      clicavel(el, () => {
        c.aberto = !c.aberto;
        desenharCartoes();
      });
    }
    const resto = visiveis.length - Math.min(visiveis.length, LISTA_MAX);
    pega("brRodapeLista").textContent = [
      resto > 0 ? `+ ${resto} no registro completo` : "",
      resultado && resultado.semBroll > 0 ? `${resultado.semBroll} frase(s) ficaram sem B-roll bom` : "",
      cartoes.length === 0 ? "Nada novo entrou nesta rodada: o registro diz por quê." : "",
    ]
      .filter(Boolean)
      .join(" · ");
  };
  const desenharResultado = () => {
    if (!resultado) return;
    desenharAprendizado(resultado);
    desenharFaixa();
    desenharFiltros();
    desenharCartoes();
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
      pega("brErroTitulo").textContent = achado?.[1] ?? "Parou";
      pega("brErroTexto").textContent = m;
      pega("brErroComo").textContent = achado?.[2] ?? "O registro completo diz onde parou.";
      pill("falhou", "erro");
      corpo("erro");
    } finally {
      ocupado = false;
    }
  };
  /** Acao de um cartao: nao troca o corpo, so o cartao, a faixa e o registro. */
  const noCartao = async (c: Cartao, fazer: () => Promise<void>) => {
    if (ocupado) return;
    ocupado = true;
    const antes = c.situacao;
    c.situacao = "andando";
    desenharCartoes();
    try {
      await fazer();
      if (c.situacao === "andando") c.situacao = antes;
    } catch (e) {
      c.situacao = antes;
      registrar((e as Error)?.message ?? String(e), "erro");
    } finally {
      ocupado = false;
      if (vivo()) {
        desenharFaixa();
        desenharFiltros();
        desenharCartoes();
      }
    }
  };
  const irPara = (c: Cartao) => noCartao(c, () => motor.irPara(c.b.inicio));
  const tirar = (c: Cartao) =>
    noCartao(c, async () => {
      const cfg = configAtual();
      if (!cfg) return;
      await motor.tirar(c.b, cfg);
      c.situacao = "tirado";
      c.aberto = false;
      registrar(`Tirei ${c.b.arquivo} (${tempo(c.b.inicio)}): a próxima análise conta como apagado.`, "ok");
    });
  const trocar = (c: Cartao) =>
    noCartao(c, async () => {
      const cfg = configAtual();
      if (!cfg) return;
      const velho = c.b.arquivo;
      c.b = await motor.trocar(c.b, cfg);
      c.situacao = "trocado";
      registrar(`Troquei ${velho} por ${c.b.arquivo} (${tempo(c.b.inicio)}).`, "ok");
    });

  const reler = umPorVez(async () => {
    pill("lendo", "ativo");
    const e = await motor.ler(pasta.value.trim());
    if (!vivo()) return;
    pega("brSeq").textContent = `· ${e.nome}`;
    // O fps vem 0 quando o Premiere nao conta a taxa por onde o B-roll le (so informacao).
    const fps = e.fps > 0 ? ` · ${virgula(e.fps, 2)} fps` : "";
    pega("brSub").textContent = `${tempo(e.duracaoS)} · ${e.formato}${fps} · ${e.naTimeline.length} B-roll(s) acima da V1`;
    desenharConfere(e);
    if (!resultado) corpo("vazio");
    pill(resultado ? `${cartoes.length} inseridos` : "pronto", "ok");
  });

  const analisar = umPorVez(async () => {
    const c = configAtual();
    if (!c) return;
    pill("analisando", "ativo");
    desenharEtapas(0);
    pega("brAndamentoTxt").textContent = "Lendo a fala da V1…";
    corpo("andamento");
    pega("brAnalisarTxt").textContent = "Analisando…";
    try {
      const r = await motor.analisar(c, registrar, (etapa, texto) => {
        if (!vivo()) return;
        desenharEtapas(etapa);
        pega("brAndamentoTxt").textContent = `${texto}…`;
      });
      if (!vivo()) return;
      config = c;
      resultado = r;
      cartoes = r.inseridos.map((b) => ({ b, situacao: "ok", aberto: false }));
      filtro = "todos";
      pega("brSeq").textContent = `· ${r.nome}`;
      desenharResultado();
      corpo("resultado");
      pill(r.inseridos.length > 0 ? `${r.inseridos.length} inseridos` : "nada a inserir", "ok");
    } finally {
      if (vivo()) pega("brAnalisarTxt").textContent = resultado ? "Analisar de novo" : "Analisar e inserir";
    }
  });

  const aprender = umPorVez(async () => {
    const c = configAtual();
    if (!c) return;
    pill("aprendendo", "ativo");
    await motor.aprender(c, registrar);
    if (!vivo()) return;
    config = c;
    pill("aprendido", "ok");
  });

  clicavel(pega("brAnalisar"), () => void analisar());
  // Depois do Aprender, a conferencia mostra o aprendizado novo.
  clicavel(pega("brAprender"), () => void aprender().then(() => reler()));
  clicavel(pega("brReler"), () => void reler());
  clicavel(pega("brErroDeNovo"), () => {
    corpo(resultado ? "resultado" : "vazio");
    void analisar();
  });
  pega("brIcoAnalisar").innerHTML = icone("broll", "#ffffff");
  pega("brIcoAprender").innerHTML = icone("selecao", "#85b7eb");
  pega("brIcoReler").innerHTML = icone("reler", "#9098a6");

  desenharOpcoes();
  corpo("vazio");
  // Configuracao, dicionario e merge do canonico primeiro (o motor conta no
  // registro); a sequencia e a conferencia depois.
  void (async () => {
    ocupado = true;
    try {
      config = await motor.iniciar(registrar);
    } catch (e) {
      config = DEFAULT_CONFIG;
      registrar(`Configuração não carregou, usando a padrão: ${(e as Error)?.message ?? String(e)}`, "aviso");
    } finally {
      ocupado = false;
    }
    if (!vivo()) return;
    pasta.value = config.libraryPath;
    desenharOpcoes();
    await reler();
  })();
}
