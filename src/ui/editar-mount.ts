/*
 * Tela do Editar. So orquestra: le o estado, liga as caixas, chama o adapter.
 * Botoes ligados ANTES de qualquer await (UXP_ARMADILHAS, regra 2).
 */

import { parseConfig, relogio } from "../../ferramentas/auto-broll/src/domain.ts";
import { writeJson, readJson } from "../../ferramentas/auto-broll/src/premiere.ts";
import { EMPRESAS, type Empresa } from "../../ferramentas/pro-captions/src/preset.ts";
import { SPLIT_DA_EMPRESA } from "../autosplit.ts";
import { parsePerfil, trocarEmpresa, type ResumoVariacao, type Trecho } from "../editar.ts";
import { editar, lerEstado, type AoVivo, type Etapa, type Registrar } from "../editar-premiere.ts";
import { segmentos } from "../shell.ts";

const LOG = "editar-log.json";
const PERFIL = "perfil.json";
const CAIXA: Readonly<Record<Etapa, string>> = {
  pausas: "edPausas",
  broll: "edBroll",
  split: "edSplit",
  leak: "edLeak",
  trilha: "edTrilha",
  legendas: "edLegendas",
};
const MARCA = { rodando: "", ok: "✓ ", aviso: "! ", erro: "✗ " } as const;
const FAIXAS = ["C2", "C1", "V3", "V2", "V1", "A2"] as const;
const nLeg = (r: ResumoVariacao): number => r.legendas.filter((l) => !l.preco).length;
const nPreco = (r: ResumoVariacao): number => r.legendas.length - nLeg(r);

function itensDa(r: ResumoVariacao, faixa: (typeof FAIXAS)[number]): readonly Trecho[] {
  if (faixa === "C2") return r.legendas.filter((l) => l.preco);
  if (faixa === "C1") return r.legendas.filter((l) => !l.preco);
  if (faixa === "V3") return r.leaks;
  if (faixa === "V2") return r.brolls;
  if (faixa === "V1") return r.clipes;
  return r.trilha ? [{ de: 0, ate: r.duracaoS }] : [];
}

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
  const soma = (xs: readonly number[]) => xs.reduce((a, b) => a + b, 0);

  // ---- andamento das etapas: resultado ao lado de cada caixa e a barra
  let total = 0;
  let feitas = 0;
  const barra = () => {
    pega("edBarraFeito").setAttribute("style", `flex-grow: ${feitas}`);
    pega("edBarraResto").setAttribute("style", `flex-grow: ${Math.max(total - feitas, total === 0 ? 1 : 0)}`);
  };
  const marcarEtapa = (id: Etapa, texto: string, tom: string) => {
    const el = pega(`edRes_${id}`);
    el.textContent = texto;
    el.setAttribute("data-tom", tom);
  };

  // ---- variacoes: grade, numeros e o detalhe da escolhida
  let duracoes: readonly number[] = [];
  let resumo: readonly ResumoVariacao[] | null = null;
  let sel = -1;

  const detalhar = () => {
    const d = pega("edVarDetalhe");
    const r = resumo?.[sel];
    if (sel < 0) {
      d.textContent = "Clique numa variação para ver o que entrou nela.";
    } else if (!r) {
      d.textContent = `Variação ${sel + 1}: ${relogio(duracoes[sel] ?? 0)}, ainda não editada.`;
    } else {
      const partes = [
        `Variação ${sel + 1}: ${relogio(r.duracaoS)}${r.antesS !== null ? ` (era ${relogio(r.antesS)})` : ""}`,
        `${r.brolls.length} B-roll(s)`,
        `${r.leaks.length} leak(s)`,
        `${nLeg(r)} legenda(s)`,
      ];
      if (nPreco(r) > 0) partes.push(`${nPreco(r)} preço(s)`);
      if (r.trilha) partes.push("trilha");
      const fala =
        r.falaSomeEmS === null
          ? ""
          : r.falaSomeEmS === 0
            ? ". Sem fala nenhuma: áudio mudo?"
            : `. A fala some em ${relogio(r.falaSomeEmS)}: áudio mudo nesse trecho? Ali fica sem legenda.`;
      d.textContent = partes.join(" · ") + fala;
    }
  };

  const numeros = () => {
    const dur = soma(resumo ? resumo.map((r) => r.duracaoS) : duracoes);
    const antes = resumo?.every((r) => r.antesS !== null) ? soma(resumo.map((r) => r.antesS ?? 0)) : null;
    pega("edNumDur").textContent = antes !== null && antes - dur >= 1 ? `−${relogio(antes - dur)}` : relogio(dur);
    pega("edNumDurSub").textContent = antes !== null && antes - dur >= 1 ? `${relogio(antes)} → ${relogio(dur)}` : resumo ? "" : "antes de editar";
    pega("edNumBroll").textContent = resumo ? String(soma(resumo.map((r) => r.brolls.length))) : "–";
    pega("edNumLeak").textContent = resumo ? `${soma(resumo.map((r) => r.leaks.length))} leak(s)` : "";
    pega("edNumLeg").textContent = resumo ? String(soma(resumo.map(nLeg))) : "–";
    pega("edNumPreco").textContent = resumo ? `${soma(resumo.map(nPreco))} preço(s)` : "";
  };

  // ---- timeline viva da variacao escolhida e a tela 9:16 no cursor
  let t = 0;
  let tocando: ReturnType<typeof setInterval> | null = null;
  /** Lado e divisao do split, depois que a etapa Split rodou. */
  let split: { lado: "baixo" | "cima"; divisao: number } | null = null;
  const atual = (): ResumoVariacao | null => (resumo && sel >= 0 ? (resumo[sel] ?? null) : null);

  const parte = (id: string, tipo: string, grow: number, texto: string) => {
    const el = pega(id);
    el.setAttribute("data-tipo", tipo);
    el.setAttribute("style", `flex-grow: ${grow}`);
    el.textContent = texto;
  };

  const quadro = () => {
    const r = atual();
    if (!r) {
      pega("edTempo").textContent = "a timeline aparece quando o Editar rodar";
      return;
    }
    const dentro = (x: Trecho) => t >= x.de && t < x.ate;
    pega("edReguaAntes").setAttribute("style", `flex-grow: ${Math.round(t * 100)}`);
    pega("edReguaDepois").setAttribute("style", `flex-grow: ${Math.max(1, Math.round((r.duracaoS - t) * 100))}`);
    pega("edTempo").textContent = `${relogio(t)} / ${relogio(r.duracaoS)}`;
    const b = r.brolls.find(dentro);
    const nome = b?.nome ?? "B-roll";
    if (!b) {
      parte("edTelaA", "doutor", 1, "doutor");
      parte("edTelaB", "broll", 0, "");
    } else if (!split) {
      parte("edTelaA", "broll", 1, nome);
      parte("edTelaB", "doutor", 0, "");
    } else if (split.lado === "cima") {
      parte("edTelaA", "broll", split.divisao, nome);
      parte("edTelaB", "doutor", 100 - split.divisao, "doutor");
    } else {
      parte("edTelaA", "doutor", split.divisao, "doutor");
      parte("edTelaB", "broll", 100 - split.divisao, nome);
    }
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
      while (faixa.firstChild) faixa.removeChild(faixa.firstChild);
      if (!r) continue;
      for (const s of segmentos(itensDa(r, f), r.duracaoS)) {
        const el = document.createElement("span");
        el.className = s.item < 0 ? "tl-seg" : `tl-seg tl-${f}`;
        el.setAttribute("style", `flex-grow: ${s.grow}`);
        el.addEventListener("click", () => {
          t = s.de;
          quadro();
        });
        faixa.appendChild(el);
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
  pega("edPlay").addEventListener("click", tocar);
  pega("edPlay").addEventListener("keydown", (e) => {
    if ((e as KeyboardEvent).key === "Enter" || (e as KeyboardEvent).key === " ") tocar();
  });

  const desenharGrade = () => {
    const grade = pega("edGrade");
    while (grade.firstChild) grade.removeChild(grade.firstChild);
    const n = resumo?.length ?? duracoes.length;
    for (let i = 0; i < n; i++) {
      const r = resumo?.[i];
      const el = document.createElement("div");
      el.className = "var";
      el.setAttribute("role", "button");
      el.setAttribute("tabindex", "0");
      el.setAttribute("data-sel", i === sel ? "sim" : "nao");
      const tom = r ? (r.falaSomeEmS !== null ? "aviso" : "ok") : "";
      el.innerHTML =
        `<span class="var-nome">${i + 1}</span>` +
        `<span class="var-linha">${relogio(r?.duracaoS ?? duracoes[i] ?? 0)}</span>` +
        `<span class="var-linha">${r ? `${r.brolls.length} B-roll` : "&nbsp;"}</span>` +
        `<span class="var-cor" data-tom="${tom}"></span>`;
      const abrir = () => {
        sel = i;
        t = 0;
        parar();
        desenharGrade();
        detalhar();
        desenharTimeline();
      };
      el.addEventListener("click", abrir);
      el.addEventListener("keydown", (e) => {
        if ((e as KeyboardEvent).key === "Enter" || (e as KeyboardEvent).key === " ") abrir();
      });
      grade.appendChild(el);
    }
    const avisos = resumo?.filter((r) => r.falaSomeEmS !== null).length ?? 0;
    pega("edVarRotulo").textContent = `Variações · ${n}${avisos > 0 ? ` · ${avisos} com aviso` : ""}`;
  };

  const aoVivo: AoVivo = {
    etapa(id, tom, texto) {
      marcarEtapa(id, tom === "rodando" ? "rodando…" : `${MARCA[tom]}${texto ?? ""}`, tom);
      if (tom !== "rodando") feitas++;
      if (id === "split" && (tom === "ok" || tom === "aviso")) {
        split = SPLIT_DA_EMPRESA[pega<HTMLSelectElement>("edEmpresa").value as Empresa] ?? null;
      }
      barra();
    },
    variacoes(lista) {
      resumo = lista;
      // Sem escolha ainda, abre a primeira com aviso (o problema aparece sem
      // procurar) ou a primeira; o que o Leo clicou fica.
      if (sel < 0 || sel >= lista.length) {
        const comAviso = lista.findIndex((r) => r.falaSomeEmS !== null);
        sel = comAviso >= 0 ? comAviso : lista.length > 0 ? 0 : -1;
      }
      desenharGrade();
      numeros();
      detalhar();
      desenharTimeline();
    },
  };

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
      duracoes = e.duracoesS;
      resumo = null;
      sel = -1;
      parar();
      desenharGrade();
      numeros();
      detalhar();
      desenharTimeline();
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
    const ids = Object.keys(CAIXA) as Etapa[];
    for (const id of ids) marcarEtapa(id, marcado(CAIXA[id]) ? "na fila" : "", "");
    total = ids.filter((id) => marcado(CAIXA[id])).length;
    feitas = 0;
    barra();
    split = null;
    sel = -1;
    t = 0;
    parar();
    void editar(
      {
        pausas: marcado("edPausas"),
        broll: marcado("edBroll"),
        split: marcado("edSplit"),
        leak: marcado("edLeak"),
        trilha: marcado("edTrilha"),
        legendas: marcado("edLegendas"),
      },
      registrar,
      (t) => estado(t, "ativo"),
      aoVivo
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

  // Empresa: termos do ElevenLabs e pasta de B-roll de cada uma (perfil.json).
  const seletor = pega<HTMLSelectElement>("edEmpresa");
  for (const [id, e] of Object.entries(EMPRESAS)) {
    const opcao = document.createElement("option");
    opcao.value = id;
    opcao.textContent = e.nome;
    seletor.appendChild(opcao);
  }
  seletor.addEventListener("change", () => {
    void (async () => {
      const config = parseConfig(await readJson("config.json"));
      const r = trocarEmpresa(parsePerfil(await readJson(PERFIL)), config.libraryPath, seletor.value as Empresa);
      await writeJson(PERFIL, r.perfil);
      await writeJson("config.json", { ...config, libraryPath: r.pasta });
      const nome = EMPRESAS[r.perfil.empresa].nome;
      if (r.pasta) registrar(`${nome}: B-roll de ${r.pasta}`, "passo");
      else registrar(`${nome}: escolha a pasta de B-roll dela no Auto B-roll`, "aviso");
    })().catch((e) => registrar(`empresa: ${(e as Error)?.message ?? String(e)}`, "erro"));
  });
  void readJson(PERFIL).then((p) => {
    seletor.value = parsePerfil(p).empresa;
  });

  void ler();
}
