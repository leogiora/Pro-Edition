/*
 * Tela do SilenceCut. So orquestra: pede ao motor (local no painel, remoto no
 * programa) e desenha a previa — quantas pausas, quanto encurta, onde estao os
 * cortes na timeline e quais pedem conferencia. Nada aqui toca no Premiere.
 * Botoes ligados ANTES de qualquer await (UXP_ARMADILHAS, regra 2).
 */

import { MARGENS, type MotorPausas, type Previa } from "../silencecut.ts";
import { icone, segmentos } from "../shell.ts";

const MARGEM_PADRAO = 0.08;
const LISTA_MAX = 60;
const virgula = (n: number, casas = 1): string => n.toFixed(casas).replace(".", ",");
const tempo = (s: number): string => {
  const t = Math.max(0, Math.round(s));
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`;
};

/** Cada abertura da tela ganha um numero: a vigia de uma tela velha se reconhece e para. */
let aberturas = 0;

export function mount(root: HTMLElement, motor: MotorPausas): void {
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

  let margem = MARGEM_PADRAO;
  let previa: Previa | null = null;
  let ocupado = false;

  // ---- registro: as ultimas linhas embaixo; o completo atras de um clique e no arquivo
  const log = pega<HTMLPreElement>("scLog");
  const linhas: string[] = [];
  const curtas: Array<{ texto: string; tom: string }> = [];
  const desenharFeed = () => {
    const feed = pega("scFeed");
    limpar(feed);
    if (curtas.length === 0) novo(feed, "span", "feed-linha", "O que acontece aparece aqui.");
    for (const l of curtas.slice(-4)) novo(feed, "span", "feed-linha", l.texto).setAttribute("data-tom", l.tom);
  };
  const registrar = (texto: string, tom: "passo" | "ok" | "aviso" | "erro" = "passo") => {
    const marca = tom === "erro" ? "✗ " : tom === "aviso" ? "! " : tom === "ok" ? "✓ " : "";
    linhas.push(`${marca}${texto}`);
    log.textContent = linhas.join("\n");
    curtas.push({ texto: `${marca}${texto}`, tom });
    desenharFeed();
  };
  let logAberto = false;
  clicavel(pega("scVerLog"), () => {
    logAberto = !logAberto;
    log.setAttribute("style", logAberto ? "" : "display: none");
    pega("scVerLog").textContent = logAberto ? "esconder o registro completo" : "ver o registro completo";
    if (logAberto) setTimeout(() => (pega("scRolagem").scrollTop = pega("scRolagem").scrollHeight), 0);
  });

  const pill = (texto: string, tom: "ativo" | "ok" | "aviso" | "erro") => {
    pega("scPill").textContent = texto;
    pega("scPill").setAttribute("data-tom", tom);
  };
  const prog = (texto: string) => {
    pega("scProg").textContent = texto;
  };
  const erro = (e: unknown) => {
    const m = (e as Error)?.message ?? String(e);
    registrar(m, "erro");
    pill("falhou", "erro");
    prog(`Parou: ${m}`);
  };

  // ---- margem em botoes
  const desenharMargens = () => {
    const caixa = pega("scMargens");
    limpar(caixa);
    for (const m of MARGENS) {
      const chip = novo(caixa, "div", "chip", `${virgula(m, 2)} s${m === MARGEM_PADRAO ? " · padrão" : ""}`);
      chip.setAttribute("role", "button");
      chip.setAttribute("tabindex", "0");
      chip.setAttribute("data-on", m === margem ? "sim" : "nao");
      if (m === margem) chip.setAttribute("style", "border-color: #4ecb8d");
      clicavel(chip, () => {
        if (ocupado || m === margem) return;
        margem = m;
        desenharMargens();
        // Com a previa na tela, ela acompanha a margem (o audio ja esta lido: e rapido).
        if (previa) void verPrevia();
      });
    }
  };

  // ---- a previa desenhada: numeros, antes/depois, faixa e lista
  const desenharPrevia = () => {
    const p = previa;
    pega("scMetPausas").textContent = p ? String(p.cortes.length) : "–";
    pega("scMetMenos").textContent = p ? `−${tempo(p.antesS - p.depoisS)}` : "–";
    const confira = p ? p.cortes.filter((c) => c.confira).length : 0;
    pega("scMetConfira").textContent = p ? String(confira) : "–";
    pega("scAntes").textContent = p ? tempo(p.antesS) : "–";
    pega("scDepois").textContent = p ? tempo(p.depoisS) : "–";
    const fica = p && p.antesS > 0 ? Math.round((p.depoisS / p.antesS) * 1000) : 1000;
    pega("scDepoisCheio").setAttribute("style", `flex-grow: ${fica}`);
    pega("scDepoisResto").setAttribute("style", `flex-grow: ${1000 - fica}`);

    const faixa = pega("scFaixa");
    limpar(faixa);
    if (p) {
      const cortes = p.cortes.map((c) => ({ de: c.inicioS, ate: c.fimS }));
      for (const s of segmentos(cortes, p.antesS)) {
        novo(faixa, "span", `tl-seg ${s.item < 0 ? "sc-fica" : "sc-corta"}`).setAttribute("style", `flex-grow: ${s.grow}`);
      }
    }

    const lista = pega("scLista");
    limpar(lista);
    if (!p) return;
    for (const c of p.cortes.slice(0, LISTA_MAX)) {
      const linha = novo(lista, "div", "sc-corte");
      novo(linha, "span", "sc-corte-tempo", tempo(c.inicioS));
      novo(linha, "span", "sc-corte-dur", `${virgula(c.fimS - c.inicioS)} s`);
      novo(linha, "span", "sc-corte-palavras", `"${c.antes}" | "${c.depois}"`);
      if (c.confira) novo(linha, "span", "sc-confira", "confira");
    }
    if (p.cortes.length > LISTA_MAX) novo(lista, "div", "sc-mais", `e mais ${p.cortes.length - LISTA_MAX} cortes no registro completo`);
  };

  // ---- acoes
  const umPorVez = (tarefa: () => Promise<void>) => async () => {
    if (ocupado) return;
    ocupado = true;
    try {
      await tarefa();
    } catch (e) {
      erro(e);
    } finally {
      ocupado = false;
      void motor.guardarLog(linhas).catch(() => undefined);
    }
  };

  const ler = umPorVez(async () => {
    pill("lendo", "ativo");
    const s = await motor.ler();
    pega("scSeq").textContent = `· ${s.nome}`;
    prog(`${s.clipes} clipe(s) na V1 · ${s.palavras} palavras na transcrição · ${tempo(s.duracaoS)} de gravação`);
    pill("pronto", "ok");
  });

  const verPrevia = umPorVez(async () => {
    pill("analisando", "ativo");
    prog("Medindo a fala… a primeira vez lê o áudio da bruta (uns segundos).");
    previa = await motor.previa(margem);
    desenharPrevia();
    const p = previa;
    prog(
      `${p.cortes.length} pausas · ${tempo(p.antesS)} → ${tempo(p.depoisS)} · margem ${virgula(margem, 2)} s` +
        (p.protegidos > 0 ? ` · ${p.protegidos} trecho(s) de voz protegido(s)` : "")
    );
    linhas.push(...p.cortes.map((c) => `${tempo(c.inicioS)} · ${virgula(c.fimS - c.inicioS)} s · "${c.antes}" | "${c.depois}"${c.confira ? "  <- confira" : ""}`));
    log.textContent = linhas.join("\n");
    pill("prévia pronta", "ok");
  });

  const cortar = umPorVez(async () => {
    pill("cortando", "ativo");
    prog("Cortando. Não mexa na timeline até terminar.");
    const r = await motor.cortar(margem, (texto) => prog(`Cortando · ${texto}`));
    for (const l of r.linhas) registrar(l, r.ok ? "passo" : "aviso");
    pill(r.ok ? "cortado" : "cortado com problema", r.ok ? "ok" : "erro");
    prog(r.ok ? "Pausas cortadas. O botão redondo desfaz." : "Cortado com problema: veja o registro.");
    previa = null;
    desenharPrevia();
  });

  const desfazer = umPorVez(async () => {
    pill("desfazendo", "ativo");
    for (const l of await motor.desfazer()) registrar(l, "passo");
    pill("desfeito", "ok");
    prog("Corte desfeito.");
  });

  clicavel(pega("scPrevia"), () => void verPrevia());
  clicavel(pega("scCortar"), () => void cortar());
  clicavel(pega("scDesfazer"), () => void desfazer());
  pega("scIcoCortar").innerHTML = icone("pausas", "#ffffff");
  pega("scIcoPrevia").innerHTML = icone("selecao", "#85b7eb");
  pega("scIcoDesfazer").innerHTML = icone("reler", "#9098a6");

  // O audio de cada bruta e lido SOZINHO, uma vez, quando ela para de mudar na
  // V1: quando o Leo clica, ja esta lido. A vigia de uma tela velha para sozinha.
  const abertura = String(++aberturas);
  log.setAttribute("data-abertura", abertura);
  const vigia = setInterval(() => {
    if (doc.getElementById("scLog")?.getAttribute("data-abertura") !== abertura) {
      clearInterval(vigia);
      return;
    }
    if (ocupado) return;
    motor
      .preparar()
      .then((leu) => {
        if (leu) registrar("áudio da bruta nova lido: a prévia e o corte já vão direto", "ok");
      })
      .catch(() => undefined); // timeline que o corte recusaria: o erro de verdade aparece no clique
  }, 2000);

  desenharMargens();
  desenharFeed();
  desenharPrevia();
  void ler();
}
