/*
 * Tela do Editar, no layout do prototipo que o Leo escolheu (01/10): empresa,
 * etapas em bolinhas, grade de variacoes, detalhe da escolhida com Timeline,
 * Quadros e Fala, e o registro curto. So orquestra: le o estado, chama o
 * adapter e desenha o que ele manda (AoVivo).
 * Botoes ligados ANTES de qualquer await (UXP_ARMADILHAS, regra 2).
 */

import { parseConfig, relogio } from "../../ferramentas/auto-broll/src/domain.ts";
import { writeJson, readJson } from "../../ferramentas/auto-broll/src/premiere.ts";
import { EMPRESAS, type Empresa } from "../../ferramentas/pro-captions/src/preset.ts";
import { SPLIT_DA_EMPRESA } from "../autosplit.ts";
import { marcarFala, parsePerfil, quadros, trocarEmpresa, type ResumoVariacao, type Trecho } from "../editar.ts";
import { editar, lerEstado, type AoVivo, type Etapa, type Registrar } from "../editar-premiere.ts";
import { icone, segmentos, type Icone } from "../shell.ts";

const LOG = "editar-log.json";
const PERFIL = "perfil.json";

const ETAPAS: ReadonlyArray<{ readonly id: Etapa & Icone; readonly nome: string; readonly cor: string }> = [
  { id: "pausas", nome: "Pausas", cor: "#4ecb8d" },
  { id: "broll", nome: "B-roll", cor: "#8d82f5" },
  { id: "split", nome: "Split", cor: "#67c7e2" },
  { id: "leak", nome: "Leak", cor: "#eeab4c" },
  { id: "trilha", nome: "Trilha", cor: "#4fc3a1" },
  { id: "legendas", nome: "Legendas", cor: "#eceef2" },
];
const COR_EMPRESA: Readonly<Record<Empresa, string>> = { androclinic: "#3b82f6", grandcare: "#4fc3a1", menopausa: "#e07ba8" };
const FAIXAS = ["C2", "C1", "V3", "V2", "V1", "A2"] as const;
const nLeg = (r: ResumoVariacao): number => r.legendas.filter((l) => !l.preco).length;
const nPreco = (r: ResumoVariacao): number => r.legendas.length - nLeg(r);
const ouTraco = (n: number): string => (n > 0 ? String(n) : "–");

function itensDa(r: ResumoVariacao, faixa: (typeof FAIXAS)[number]): readonly Trecho[] {
  if (faixa === "C2") return r.legendas.filter((l) => l.preco);
  if (faixa === "C1") return r.legendas.filter((l) => !l.preco);
  if (faixa === "V3") return r.leaks;
  if (faixa === "V2") return r.brolls;
  if (faixa === "V1") return r.clipes;
  return r.trilha ? [{ de: 0, ate: r.duracaoS }] : [];
}

type Tom = "rodando" | "ok" | "aviso" | "erro";

export function mount(root: HTMLElement): void {
  const pega = <T extends HTMLElement>(id: string): T => root.querySelector<T>(`#${id}`)!;
  const limpar = (el: HTMLElement) => {
    while (el.firstChild) el.removeChild(el.firstChild);
  };
  const novo = (pai: HTMLElement, tag: string, classe: string, texto = ""): HTMLElement => {
    const el = document.createElement(tag);
    el.className = classe;
    el.textContent = texto;
    pai.appendChild(el);
    return el;
  };
  /** Todo clique acende o que foi tocado por um instante: o Leo ve que pegou. */
  const apertar = (el: HTMLElement) => {
    el.setAttribute("data-apertado", "sim");
    setTimeout(() => el.setAttribute("data-apertado", "nao"), 180);
  };
  const clicavel = (el: HTMLElement, fazer: () => void) => {
    el.setAttribute("role", "button");
    el.setAttribute("tabindex", "0");
    const ir = () => {
      apertar(el);
      fazer();
    };
    el.addEventListener("click", ir);
    el.addEventListener("keydown", (e) => {
      if ((e as KeyboardEvent).key === "Enter" || (e as KeyboardEvent).key === " ") ir();
    });
  };

  // ---- estado da tela
  let seqNome = "";
  let empresa: Empresa = "androclinic";
  const ativo: Record<Etapa, boolean> = { pausas: true, broll: true, split: false, leak: true, trilha: true, legendas: true };
  const tomDa: Partial<Record<Etapa, Tom>> = {};
  let resumo: readonly ResumoVariacao[] = [];
  let editado = false;
  let ocupado = false;
  /** O Leo clicou numa variacao durante o Editar: a tela fica nela. */
  let escolhida = false;
  let sel = 0;
  let total = 0;
  let feitas = 0;
  /** Lado e divisao do split, depois que a etapa Split rodou. */
  let split: { lado: "baixo" | "cima"; divisao: number } | null = null;

  // ---- registro: as ultimas linhas embaixo; o completo atras de um clique e no arquivo
  const log = pega<HTMLPreElement>("edLog");
  const linhas: string[] = [];
  const curtas: Array<{ texto: string; tom: string }> = [];
  const desenharFeed = () => {
    const feed = pega("edFeed");
    limpar(feed);
    if (curtas.length === 0) novo(feed, "span", "feed-linha", "O que acontece aparece aqui.");
    for (const l of curtas.slice(-4)) novo(feed, "span", "feed-linha", l.texto).setAttribute("data-tom", l.tom);
  };
  const registrar: Registrar = (texto, tipo = "passo") => {
    const marca = tipo === "erro" ? "✗ " : tipo === "aviso" ? "! " : tipo === "ok" ? "✓ " : "";
    linhas.push(`${marca}${texto}`);
    log.textContent = linhas.join("\n");
    log.scrollTop = log.scrollHeight;
    if (tipo !== "vazio") {
      curtas.push({ texto: `${marca}${texto}`, tom: tipo });
      desenharFeed();
    }
  };
  let logAberto = false;
  clicavel(pega("edVerLog"), () => {
    logAberto = !logAberto;
    log.setAttribute("style", logAberto ? "" : "display: none");
    pega("edVerLog").textContent = logAberto ? "esconder o registro completo" : "ver o registro completo";
    // Abre embaixo da dobra: rola ate ele, senao parece que o clique nao fez nada.
    if (logAberto) setTimeout(() => (pega("edRolagem").scrollTop = pega("edRolagem").scrollHeight), 0);
  });

  const pill = (texto: string, tom: "ativo" | "ok" | "aviso" | "erro") => {
    const p = pega("edPill");
    p.textContent = texto;
    p.setAttribute("data-tom", tom);
  };

  // ---- empresas
  const desenharEmpresas = () => {
    const caixa = pega("edEmpresas");
    limpar(caixa);
    for (const [id, e] of Object.entries(EMPRESAS) as Array<[Empresa, { nome: string }]>) {
      const chip = novo(caixa, "div", "chip", e.nome);
      chip.setAttribute("data-on", id === empresa ? "sim" : "nao");
      if (id === empresa) chip.setAttribute("style", `border-color: ${COR_EMPRESA[id]}`);
      clicavel(chip, () => trocar(id));
    }
  };
  const trocar = (nova: Empresa) => {
    if (ocupado || nova === empresa) return;
    empresa = nova;
    desenharEmpresas();
    void (async () => {
      const config = parseConfig(await readJson("config.json"));
      const r = trocarEmpresa(parsePerfil(await readJson(PERFIL)), config.libraryPath, nova);
      await writeJson(PERFIL, r.perfil);
      await writeJson("config.json", { ...config, libraryPath: r.pasta });
      const nome = EMPRESAS[r.perfil.empresa].nome;
      if (r.pasta) registrar(`${nome}: B-roll de ${r.pasta}`, "passo");
      else registrar(`${nome}: escolha a pasta de B-roll dela no Auto B-roll`, "aviso");
    })().catch((e) => registrar(`empresa: ${(e as Error)?.message ?? String(e)}`, "erro"));
  };

  // ---- etapas: bolinhas que ligam e desligam, e acendem quando rodam
  /**
   * Cada estado com cor explicita (o UXP ignora opacity): desligada cinza,
   * ligada com a cor da etapa, rodando pulsando, feita cheia.
   */
  let pulso = false;
  const desenharEtapas = () => {
    const caixa = pega("edEtapas");
    limpar(caixa);
    for (const e of ETAPAS) {
      const tom = tomDa[e.id];
      const el = novo(caixa, "div", "etapa");
      const bola = novo(el, "span", "bola");
      const nome = novo(el, "span", "etapa-nome", e.nome);
      const cheia = tom === "ok" ? e.cor : tom === "aviso" ? "#eeab4c" : tom === "erro" ? "#ff7d71" : null;
      let traco = e.cor;
      if (cheia) {
        traco = "#0d0f13";
        bola.setAttribute("style", `background-color: ${cheia}; border-color: ${cheia}`);
        nome.setAttribute("style", `color: ${cheia}`);
      } else if (tom === "rodando") {
        bola.setAttribute("style", `background-color: ${pulso ? "#2a3550" : "#141a2a"}; border-color: ${e.cor}; border-width: 2px`);
        nome.setAttribute("style", `color: ${e.cor}`);
      } else if (ativo[e.id]) {
        bola.setAttribute("style", `border-color: ${e.cor}`);
        nome.setAttribute("style", "color: #eceef2");
      } else {
        traco = "#4a515c";
        bola.setAttribute("style", "border-color: #2a2f38; background-color: #101318");
        nome.setAttribute("style", "color: #4a515c");
      }
      bola.innerHTML = icone(e.id, traco);
      clicavel(el, () => {
        if (ocupado) return;
        ativo[e.id] = !ativo[e.id];
        pega("edProg").textContent = `${e.nome} ${ativo[e.id] ? "ligado" : "desligado"} para o próximo Editar`;
        desenharEtapas();
      });
    }
  };
  // Enquanto o Editar roda, a etapa da vez pulsa (o UXP nao garante animacao em CSS).
  let animacao: ReturnType<typeof setInterval> | null = null;
  const animar = (ligar: boolean) => {
    if (animacao !== null) clearInterval(animacao);
    animacao = ligar
      ? setInterval(() => {
          pulso = !pulso;
          desenharEtapas();
        }, 450)
      : null;
  };

  // ---- andamento e grade de variacoes
  const avisos = () => resumo.filter((r) => r.falaSomeEmS !== null).length;
  const desenharAndamento = () => {
    pega("edBarraFeito").setAttribute("style", `flex-grow: ${editado && !ocupado ? 1 : feitas}`);
    pega("edBarraResto").setAttribute("style", `flex-grow: ${editado && !ocupado ? 0 : Math.max(total - feitas, total === 0 ? 1 : 0)}`);
    const cont = pega("edCont");
    cont.textContent = editado && !ocupado ? `${resumo.length - avisos()} ok${avisos() > 0 ? ` · ${avisos()} com aviso` : ""}` : "";
  };

  const desenharGrade = () => {
    const grade = pega("edGrade");
    limpar(grade);
    resumo.forEach((r, i) => {
      const el = novo(grade, "div", "var");
      el.setAttribute("data-sel", i === sel ? "sim" : "nao");
      const cima = novo(el, "div", "var-cima");
      novo(cima, "span", "var-nome", String(i + 1));
      const tom = ocupado ? "ativo" : !editado ? "" : r.falaSomeEmS !== null ? "aviso" : "ok";
      novo(cima, "span", "var-st", tom === "ativo" ? "…" : tom === "ok" ? "✓" : tom === "aviso" ? "!" : "○").setAttribute("data-tom", tom);
      const barra = novo(el, "div", "var-barra");
      const feito = novo(barra, "span", "var-feito");
      feito.setAttribute("data-tom", tom);
      const g = ocupado ? feitas : editado ? 1 : 0;
      feito.setAttribute("style", `flex-grow: ${g}`);
      novo(barra, "span", "").setAttribute("style", `flex-grow: ${ocupado ? Math.max(total - feitas, 0) : editado ? 0 : 1}`);
      clicavel(el, () => {
        sel = i;
        t = 0;
        parar();
        desenharGrade();
        desenharDetalhe();
      });
    });
  };

  // ---- detalhe: nome, numeros, aviso e a vista escolhida
  const desenharDetalhe = () => {
    const r = resumo[sel];
    const gancho = r ? r.palavras.slice(0, 4).map((p) => p.nome ?? "").join(" ") : "";
    pega("edVarNome").textContent = r ? `${seqNome} ${sel + 1}${gancho ? ` · ${gancho}` : ""}` : "Nenhuma variação";
    pega("edVarDur").textContent = !r
      ? ""
      : r.antesS !== null && r.antesS - r.duracaoS >= 0.5
        ? `${relogio(r.antesS)} → ${relogio(r.duracaoS)}`
        : relogio(r.duracaoS);
    const pausasFeitas = tomDa.pausas === "ok" || tomDa.pausas === "aviso";
    pega("edMetCortes").textContent = r && pausasFeitas ? String(Math.max(0, r.clipes.length - 1)) : "–";
    pega("edMetBroll").textContent = r ? ouTraco(r.brolls.length) : "–";
    pega("edMetLeg").textContent = r ? ouTraco(nLeg(r)) : "–";
    pega("edMetPreco").textContent = r ? ouTraco(nPreco(r)) : "–";
    const aviso = pega("edAvisoVar");
    if (r && r.falaSomeEmS !== null) {
      aviso.textContent =
        r.falaSomeEmS === 0
          ? "! Sem fala nenhuma nesta variação: áudio mudo?"
          : `! A fala some em ${relogio(r.falaSomeEmS)}: áudio mudo nesse trecho? Ali fica sem legenda.`;
      aviso.setAttribute("style", "");
    } else {
      aviso.setAttribute("style", "display: none");
    }
    desenharVista();
  };

  // ---- timeline viva e a tela 9:16 no cursor
  let t = 0;
  let tocando: ReturnType<typeof setInterval> | null = null;
  const atual = (): ResumoVariacao | null => resumo[sel] ?? null;

  const parte = (el: HTMLElement, tipo: string, grow: number, texto: string) => {
    el.setAttribute("data-tipo", tipo);
    el.setAttribute("style", `flex-grow: ${grow}`);
    el.textContent = texto;
  };
  /** A tela 9:16 em duas partes (a de cima e a de baixo), com o split que rodou. */
  const encher = (a: HTMLElement, b: HTMLElement, broll: string | undefined) => {
    if (broll === undefined) {
      parte(a, "doutor", 1, "doutor");
      parte(b, "broll", 0, "");
    } else if (!split) {
      parte(a, "broll", 1, broll);
      parte(b, "doutor", 0, "");
    } else if (split.lado === "cima") {
      parte(a, "broll", split.divisao, broll);
      parte(b, "doutor", 100 - split.divisao, "doutor");
    } else {
      parte(a, "doutor", split.divisao, "doutor");
      parte(b, "broll", 100 - split.divisao, broll);
    }
  };

  const quadro = () => {
    const r = atual();
    if (!r) return;
    const dentro = (x: Trecho) => t >= x.de && t < x.ate;
    pega("edReguaAntes").setAttribute("style", `flex-grow: ${Math.round(t * 100)}`);
    pega("edReguaDepois").setAttribute("style", `flex-grow: ${Math.max(1, Math.round((r.duracaoS - t) * 100))}`);
    pega("edTempo").textContent = `${relogio(t)} / ${relogio(r.duracaoS)}`;
    const b = r.brolls.find(dentro);
    encher(pega("edTelaA"), pega("edTelaB"), b ? (b.nome ?? "B-roll") : undefined);
    pega("edTela").setAttribute("data-leak", r.leaks.some(dentro) ? "sim" : "nao");
    const preco = r.legendas.find((l) => l.preco && dentro(l));
    const leg = r.legendas.find((l) => !l.preco && dentro(l));
    const el = pega("edTelaLeg");
    el.textContent = preco?.nome ?? leg?.nome ?? "";
    el.setAttribute("data-preco", preco ? "sim" : "nao");
  };

  const desenharTimeline = () => {
    const r = atual();
    for (const f of FAIXAS) {
      const faixa = pega(`edTl_${f}`);
      limpar(faixa);
      if (!r) continue;
      for (const s of segmentos(itensDa(r, f), r.duracaoS)) {
        const el = novo(faixa, "span", s.item < 0 ? "tl-seg" : `tl-seg tl-${f}`);
        el.setAttribute("style", `flex-grow: ${s.grow}`);
        el.addEventListener("click", () => {
          t = s.de;
          quadro();
        });
      }
    }
    if (r && t > r.duracaoS) t = 0;
    quadro();
  };

  const parar = () => {
    if (tocando !== null) clearInterval(tocando);
    tocando = null;
    pega("edPlay").textContent = "▶";
  };
  const tocar = () => {
    const r = atual();
    if (!r) return;
    if (tocando !== null) return parar();
    if (t >= r.duracaoS - 0.1) t = 0;
    pega("edPlay").textContent = "||";
    tocando = setInterval(() => {
      const a = atual();
      if (!a) return parar();
      t = Math.min(t + 0.1, a.duracaoS);
      if (t >= a.duracaoS) parar();
      quadro();
    }, 100);
  };
  clicavel(pega("edPlay"), tocar);

  // ---- abas: Timeline, Quadros (um por pedaco da V1) e Fala (a fala marcada)
  type Vista = "tl" | "qd" | "fl";
  let vista: Vista = "tl";
  /** Clicar num quadro ou numa palavra leva a timeline para aquele ponto. */
  const irPara = (de: number) => {
    t = de;
    vista = "tl";
    desenharVista();
  };

  const desenharQuadros = () => {
    const caixa = pega("edVista_qd");
    limpar(caixa);
    const r = atual();
    if (!r) return;
    for (const q of quadros(r)) {
      const el = novo(caixa, "div", "qd");
      const tela = novo(el, "div", "qd-tela");
      tela.setAttribute("data-leak", q.leak ? "sim" : "nao");
      encher(novo(tela, "div", "tela-parte"), novo(tela, "div", "tela-parte"), q.broll);
      novo(el, "span", "qd-tempo", relogio(q.de));
      novo(el, "span", "qd-leg", q.legenda).setAttribute("data-preco", q.preco ? "sim" : "nao");
      clicavel(el, () => irPara(q.de));
    }
  };

  const desenharFala = () => {
    const caixa = pega("edFala");
    limpar(caixa);
    const r = atual();
    if (!r) return;
    if (r.palavras.length === 0) novo(caixa, "span", "pl-mudo", "A fala aparece aqui depois que o Editar ouvir a sequência.");
    for (const p of marcarFala(r)) {
      if (p.corte) novo(caixa, "span", "pl-corte");
      else if (p.quebra) novo(caixa, "span", "pl-quebra");
      if (p.broll) novo(caixa, "span", "pl-tag", p.broll);
      const el = novo(caixa, "span", "pl", p.texto);
      el.setAttribute("data-coberta", p.coberta ? "sim" : "nao");
      el.setAttribute("data-preco", p.preco ? "sim" : "nao");
      el.addEventListener("click", () => irPara(p.de));
    }
    if (r.falaSomeEmS !== null && r.palavras.length > 0) novo(caixa, "span", "pl-mudo", "· áudio mudo daqui em diante");
  };

  const desenharVista = () => {
    for (const v of ["tl", "qd", "fl"] as const) {
      pega(`edAba_${v}`).setAttribute("data-on", v === vista ? "sim" : "nao");
      pega(`edVista_${v}`).setAttribute("style", v === vista ? "" : "display: none");
    }
    if (vista !== "tl") parar();
    if (vista === "tl") desenharTimeline();
    else if (vista === "qd") desenharQuadros();
    else desenharFala();
  };
  for (const v of ["tl", "qd", "fl"] as const) {
    clicavel(pega(`edAba_${v}`), () => {
      vista = v;
      desenharVista();
    });
  }

  const desenharTudo = () => {
    desenharEtapas();
    desenharAndamento();
    desenharGrade();
    desenharDetalhe();
  };

  // ---- o que o Editar manda enquanto roda
  const aoVivo: AoVivo = {
    // O resumo da etapa nao vai ao registro: as linhas do proprio Editar ja dizem o mesmo.
    etapa(id, tom) {
      tomDa[id] = tom;
      if (tom !== "rodando") feitas++;
      if (id === "split" && (tom === "ok" || tom === "aviso")) split = SPLIT_DA_EMPRESA[empresa] ?? null;
      desenharEtapas();
      desenharAndamento();
      desenharGrade();
    },
    variacoes(lista) {
      resumo = lista;
      // Abre a primeira com aviso (o problema aparece sem procurar); o que o Leo clicou fica.
      if (sel >= lista.length) sel = 0;
      const comAviso = lista.findIndex((r) => r.falaSomeEmS !== null);
      if (comAviso >= 0 && !escolhida) sel = comAviso;
      desenharGrade();
      desenharDetalhe();
    },
  };
  pega("edGrade").addEventListener("click", () => {
    if (ocupado) escolhida = true;
  });

  // Guarda as 10 ultimas execucoes: o registro da tela e o que se ve; o arquivo e o que se le depois.
  const guardarLog = async () => {
    const antes = (await readJson(LOG).catch(() => null)) as { execucoes?: unknown[] } | null;
    const execucoes = Array.isArray(antes?.execucoes) ? antes.execucoes : [];
    await writeJson(LOG, { execucoes: [...execucoes, { quando: new Date().toISOString(), linhas: [...linhas] }].slice(-10) });
  };

  const ler = async () => {
    pill("lendo", "ativo");
    try {
      const e = await lerEstado();
      seqNome = e.nome;
      pega("edSeq").textContent = `· ${e.nome}`;
      // Reconhecer o que ja foi feito: B-roll e legenda que ja estao la nao entram de novo por padrao.
      ativo.broll = e.brollsAcimaDaV1 === 0;
      ativo.legendas = e.faixasDeLegenda === 0;
      resumo = e.resumo;
      editado = false;
      sel = 0;
      t = 0;
      split = null;
      for (const id of Object.keys(tomDa) as Etapa[]) delete tomDa[id];
      parar();
      pega("edProg").textContent = `${e.variacoes} variação(ões) na sequência · ${relogio(e.duracaoS)}`;
      desenharTudo();
      if (!e.temChave) registrar("Sem chave do ElevenLabs: salve a chave no Pro Captions antes de editar.", "aviso");
      pill("pronto", "ok");
    } catch (erro) {
      pega("edSeq").textContent = "· sem sequência";
      pega("edProg").textContent = (erro as Error)?.message ?? String(erro);
      resumo = [];
      desenharTudo();
      pill("sem sequência", "aviso");
    }
  };

  const rodar = () => {
    if (ocupado) return;
    ocupado = true;
    escolhida = false;
    linhas.length = 0;
    curtas.length = 0;
    desenharFeed();
    pill("editando", "ativo");
    for (const id of Object.keys(tomDa) as Etapa[]) delete tomDa[id];
    total = ETAPAS.filter((e) => ativo[e.id]).length;
    feitas = 0;
    split = null;
    t = 0;
    parar();
    animar(true);
    desenharTudo();
    void editar(
      { ...ativo },
      registrar,
      (texto) => {
        pega("edProg").textContent = `Editando · ${texto}`;
      },
      aoVivo
    )
      .then(() => {
        pill("pronto", "ok");
        editado = true;
        pega("edProg").textContent = `${resumo.length} variação(ões) editada(s)`;
      })
      .catch((erro) => {
        const m = (erro as Error)?.message ?? String(erro);
        registrar(m, "erro");
        pill("falhou", "erro");
        pega("edProg").textContent = `Parou: ${m}`;
      })
      .finally(() => {
        ocupado = false;
        animar(false);
        desenharTudo();
        void guardarLog().catch(() => undefined);
      });
  };
  clicavel(pega("edEditar"), rodar);
  clicavel(pega("edRelir"), () => {
    if (!ocupado) void ler();
  });

  desenharEmpresas();
  desenharFeed();
  void readJson(PERFIL).then((p) => {
    empresa = parsePerfil(p).empresa;
    desenharEmpresas();
  });
  void ler();
}
