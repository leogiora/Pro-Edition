/*
 * A tela. Nao toca em disco nem em rede: pede tudo ao motor por window.pro.
 */

import type { BlocoLegenda, Legendas, ProApi } from "../api.ts";

declare global {
  interface Window {
    readonly pro: ProApi;
  }
}

const pro = window.pro;
const $ = <T extends HTMLElement = HTMLElement>(id: string): T => {
  const el = document.getElementById(id);
  if (el === null) throw new Error(`#${id} sumiu do index.html`);
  return el as T;
};

/** O ipc embrulha a mensagem: "Error invoking remote method 'x': Error: <a nossa>". */
const mensagem = (erro: unknown): string =>
  (erro instanceof Error ? erro.message : String(erro)).replace(/^Error invoking remote method '[^']+': (Error: )?/, "");

const nomeDe = (caminho: string): string => caminho.split(/[\\/]/).pop() ?? caminho;

const relogio = (s: number): string => {
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, "0")}:${(s - m * 60).toFixed(2).padStart(5, "0")}`;
};

/** 27:18 — para duracao, nao para posicao de legenda. */
const duracao = (s: number): string => {
  const t = Math.round(s);
  return `${Math.floor(t / 60)}:${String(t % 60).padStart(2, "0")}`;
};

/* ---------------------------------------------------------------- telas */

type Tela = "hall" | "pausas" | "broll" | "acabamento" | "legendas";
const TITULOS: Record<Tela, string> = {
  hall: "",
  pausas: "Auto Pausas",
  broll: "Auto B-roll",
  acabamento: "Acabamento",
  legendas: "Legendas",
};
let tela: Tela = "hall";

function abrir(nova: Tela): void {
  tela = nova;
  for (const id of Object.keys(TITULOS)) $(id).hidden = id !== nova;
  $("voltar").hidden = nova === "hall";
  $("marca").hidden = nova !== "hall";
  $("titulo").textContent = TITULOS[nova];
}

for (const card of document.querySelectorAll<HTMLElement>("[data-abre]")) {
  card.addEventListener("click", () => abrir(card.dataset.abre as Tela));
}
$("voltar").addEventListener("click", () => abrir("hall"));

/** A linha de arquivo + estado da tela aberta. */
function linha(t: Tela): { arquivo: HTMLElement; estado: HTMLElement } {
  const raiz = $(t);
  return { arquivo: raiz.querySelector(".arquivo") as HTMLElement, estado: raiz.querySelector(".estado") as HTMLElement };
}

function estado(t: Tela, texto: string, tom: "" | "ativo" | "ok" | "erro" = ""): void {
  const el = linha(t).estado;
  el.textContent = texto;
  el.className = `estado ${tom}`;
}

pro.aoAvisar((texto) => estado(tela, texto, "ativo"));

function mostrarSalvos(p: HTMLElement, caminhos: readonly string[]): void {
  p.replaceChildren(`Salvo: ${caminhos.map(nomeDe).join(" · ")}`);
  const botao = document.createElement("button");
  botao.textContent = "Mostrar na pasta";
  botao.addEventListener("click", () => void pro.mostrarNaPasta(caminhos[0] ?? ""));
  p.append(botao);
  p.hidden = false;
}

/* ---------------------------------------------------------- auto pausas */

let pausas: string[] = [];

async function abrirPausas(caminhos: string[]): Promise<void> {
  abrir("pausas");
  pausas = caminhos;
  $("pausasEntrada").hidden = true;
  $("pausasResultado").hidden = true;
  linha("pausas").arquivo.textContent = caminhos.length === 1 ? nomeDe(caminhos[0]!) : `${caminhos.length} brutas`;
  $("pausas").querySelector(".soltar")?.classList.add("compacto");
  estado("pausas", "lendo", "ativo");
  try {
    const e = await pro.abrirPausas(caminhos);
    $("pausasResumo").innerHTML = "";
    $("pausasResumo").append(
      `${e.nome} · ${e.clipes} clipe(s) de ${e.arquivos.length} arquivo(s) · `,
      Object.assign(document.createElement("strong"), { textContent: duracao(e.duracaoS) })
    );
    $("pausasCusto").textContent =
      `O áudio de cada arquivo inteiro vai para o ElevenLabs uma vez (o que já foi transcrito não é cobrado de novo).`;
    $("pausasEntrada").hidden = false;
    estado("pausas", e.avisos.length > 0 ? e.avisos.join(" · ") : "pronto para cortar", e.avisos.length > 0 ? "" : "ok");
  } catch (erro) {
    estado("pausas", mensagem(erro), "erro");
  }
}

$<HTMLButtonElement>("pausasRodar").addEventListener("click", async () => {
  const botao = $<HTMLButtonElement>("pausasRodar");
  botao.disabled = true;
  $("pausasResultado").hidden = true;
  estado("pausas", "começando", "ativo");
  try {
    const r = await pro.rodarPausas(pausas, { legendas: $<HTMLInputElement>("pausasLegendas").checked });
    $("pausasFeito").replaceChildren(
      Object.assign(document.createElement("strong"), { textContent: `${duracao(r.antesS)} → ${duracao(r.depoisS)}` }),
      ` · ${r.cortes} pausas cortadas`
    );
    $("pausasLinhas").replaceChildren(
      ...r.conferencia.linhas.map((t) => Object.assign(document.createElement("li"), { textContent: t, className: r.conferencia.ok ? "ok" : "erro" })),
      ...r.avisos.map((t) => Object.assign(document.createElement("li"), { textContent: t }))
    );
    mostrarSalvos($("pausasSalvos"), r.salvos);
    $("pausasResultado").hidden = false;
    estado(
      "pausas",
      r.conferencia.ok ? "no Premiere: Arquivo > Importar o .xml (e os .srt, se gerou)" : "confira as palavras que sumiram antes de usar",
      r.conferencia.ok ? "ok" : "erro"
    );
  } catch (erro) {
    estado("pausas", mensagem(erro), "erro");
  } finally {
    botao.disabled = false;
  }
});

/* ----------------------------------------------------------- auto b-roll */

let broll = "";

async function abrirBroll(caminho: string): Promise<void> {
  abrir("broll");
  broll = caminho;
  $("brollEntrada").hidden = true;
  $("brollResultado").hidden = true;
  linha("broll").arquivo.textContent = nomeDe(caminho);
  $("broll").querySelector(".soltar")?.classList.add("compacto");
  estado("broll", "lendo", "ativo");
  try {
    const e = await pro.abrirBroll(caminho);
    $("brollResumo").replaceChildren(
      `${e.nome} · `,
      Object.assign(document.createElement("strong"), { textContent: duracao(e.duracaoS) }),
      e.jaNaV2 > 0 ? ` · ${e.jaNaV2} B-roll(s) já na V2 ficam onde estão` : ""
    );
    $("brollOrigem").textContent = `Biblioteca: ${e.pastaBroll} · ${e.origem}`;
    $("brollEntrada").hidden = false;
    estado("broll", e.avisos.length > 0 ? e.avisos.join(" · ") : "pronto", e.avisos.length > 0 ? "" : "ok");
  } catch (erro) {
    estado("broll", mensagem(erro), "erro");
  }
}

$<HTMLButtonElement>("brollRodar").addEventListener("click", async () => {
  const botao = $<HTMLButtonElement>("brollRodar");
  botao.disabled = true;
  $("brollResultado").hidden = true;
  estado("broll", "começando", "ativo");
  try {
    const r = await pro.rodarBroll(broll);
    $("brollFeito").textContent = `${r.colocados.length} B-roll(s) colocados na V2`;
    $("brollLista").replaceChildren(
      ...r.colocados.map((c) => {
        const li = document.createElement("li");
        li.append(
          Object.assign(document.createElement("time"), { textContent: `${relogio(c.inicio)}` }),
          Object.assign(document.createElement("span"), { className: "arq", textContent: `${c.arquivo} · ${c.duracao.toFixed(1)} s` }),
          Object.assign(document.createElement("span"), { className: "porque", textContent: c.motivo }),
          Object.assign(document.createElement("span"), { className: "frase", textContent: `"${c.frase}"` })
        );
        return li;
      })
    );
    const descartes = $("brollDescartes");
    (descartes.querySelector("summary") as HTMLElement).textContent = `${r.descartes.length} sugestão(ões) que ficaram de fora`;
    (descartes.querySelector("ul") as HTMLElement).replaceChildren(
      ...[...r.avisos, ...r.descartes].map((t) => Object.assign(document.createElement("li"), { textContent: t }))
    );
    mostrarSalvos($("brollSalvos"), r.salvos);
    $("brollResultado").hidden = false;
    estado("broll", "no Premiere: Arquivo > Importar o .xml", "ok");
  } catch (erro) {
    estado("broll", mensagem(erro), "erro");
  } finally {
    botao.disabled = false;
  }
});

/* ------------------------------------------------------------ acabamento */

let acabamento = "";
let musica: string | null = null;

function mostrarMusica(): void {
  $("acabTrilha").textContent = musica === null ? "nenhuma música escolhida" : nomeDe(musica);
}

async function abrirAcabamento(caminho: string): Promise<void> {
  abrir("acabamento");
  acabamento = caminho;
  $("acabEntrada").hidden = true;
  $("acabResultado").hidden = true;
  linha("acabamento").arquivo.textContent = nomeDe(caminho);
  $("acabamento").querySelector(".soltar")?.classList.add("compacto");
  estado("acabamento", "lendo", "ativo");
  try {
    const e = await pro.abrirAcabamento(caminho);
    $("acabResumo").textContent = `${e.nome} · ${e.variacoes} variação(ões) · ${e.brolls} B-roll(s) na V2`;
    musica = e.trilha;
    mostrarMusica();
    $<HTMLInputElement>("acabComTrilha").checked = musica !== null;
    $<HTMLInputElement>("acabVolume").value = String(e.volumeTrilhaDb);
    $("acabEntrada").hidden = false;
    estado("acabamento", e.avisos.length > 0 ? e.avisos.join(" · ") : "pronto", e.avisos.length > 0 ? "" : "ok");
  } catch (erro) {
    estado("acabamento", mensagem(erro), "erro");
  }
}

$("acabEscolherTrilha").addEventListener("click", async () => {
  const [escolhida] = await pro.escolher("musica");
  if (escolhida === undefined) return;
  musica = escolhida;
  $<HTMLInputElement>("acabComTrilha").checked = true;
  mostrarMusica();
});

$<HTMLButtonElement>("acabRodar").addEventListener("click", async () => {
  const botao = $<HTMLButtonElement>("acabRodar");
  const comTrilha = $<HTMLInputElement>("acabComTrilha").checked;
  if (comTrilha && musica === null) {
    estado("acabamento", "escolha a música da trilha (ou desmarque a trilha)", "erro");
    return;
  }
  botao.disabled = true;
  estado("acabamento", "montando", "ativo");
  try {
    const r = await pro.rodarAcabamento(acabamento, {
      split: $<HTMLInputElement>("acabSplit").checked,
      divisao: Number($<HTMLInputElement>("acabDivisao").value),
      trilha: comTrilha ? musica : null,
      volumeTrilhaDb: Number($<HTMLInputElement>("acabVolume").value),
    });
    $("acabFeito").textContent = `${r.variacoes} variação(ões) prontas`;
    $("acabLinhas").replaceChildren(
      ...[
        `${r.aparados} B-roll(s) aparados no fim do doutor`,
        ...(r.enquadrados > 0 ? [`${r.enquadrados} B-roll(s) no Split`] : []),
        ...r.avisos,
      ].map((t) => Object.assign(document.createElement("li"), { textContent: t }))
    );
    mostrarSalvos($("acabSalvos"), r.salvos);
    $("acabResultado").hidden = false;
    estado("acabamento", "no Premiere: Arquivo > Importar o .xml", "ok");
  } catch (erro) {
    estado("acabamento", mensagem(erro), "erro");
  } finally {
    botao.disabled = false;
  }
});

/* ------------------------------------------------------------ legendas */

const MAX_CARACTERES = 20;

let atual: { caminho: string; legendas: Legendas } | null = null;

const ORIGEM: Record<Legendas["origem"], string> = {
  "arquivo json": "transcrição lida do arquivo .json",
  guardada: "este áudio já tinha sido transcrito: nada foi cobrado de novo",
  elevenlabs: "transcrito agora no ElevenLabs",
};

async function gerar(caminho: string): Promise<void> {
  abrir("legendas");
  atual = null;
  $("resultado").hidden = true;
  linha("legendas").arquivo.textContent = nomeDe(caminho);
  $("legendas").querySelector(".soltar")?.classList.add("compacto");
  estado("legendas", "começando", "ativo");
  try {
    const legendas = await pro.gerarLegendas(caminho);
    atual = { caminho, legendas };
    mostrar(legendas);
    estado("legendas", ORIGEM[legendas.origem], "ok");
  } catch (erro) {
    estado("legendas", mensagem(erro), "erro");
  }
}

function mostrar(l: Legendas): void {
  const precos = l.blocos.filter((b) => b.estilo === "preco").length;
  const revisar = l.blocos.filter((b) => b.precisaRevisao).length;
  $("resumo").textContent =
    `${l.blocos.length} blocos · ${precos} preço(s)` + (revisar > 0 ? ` · ${revisar} para revisar` : "");
  $("salvos").hidden = true;

  $("blocos").replaceChildren(
    ...l.blocos.map((b, i) => {
      const li = document.createElement("li");
      li.className = `bloco${b.estilo === "preco" ? " preco" : ""}${b.precisaRevisao ? " revisar" : ""}`;

      const tempo = document.createElement("time");
      tempo.textContent = relogio(b.inicio);

      const texto = document.createElement("input");
      texto.value = b.texto;
      texto.setAttribute("aria-label", `Legenda ${i + 1}`);

      const conta = document.createElement("span");
      const contar = (): void => {
        conta.textContent = String(texto.value.length);
        conta.className = `conta${texto.value.length > MAX_CARACTERES ? " estourou" : ""}`;
      };
      contar();
      texto.addEventListener("input", () => {
        contar();
        if (atual !== null) atual.legendas.blocos[i] = { ...b, texto: texto.value.trim() };
      });

      li.append(tempo, texto, conta);
      if (b.motivos.length > 0) {
        li.append(Object.assign(document.createElement("span"), { className: "motivo", textContent: b.motivos.join(" · ") }));
      }
      return li;
    })
  );
  $("resultado").hidden = false;
  if (l.problemas.length > 0) estado("legendas", `corrija antes de salvar: ${l.problemas[0]}`, "erro");
}

$<HTMLButtonElement>("salvar").addEventListener("click", async () => {
  if (atual === null) return;
  const blocos: BlocoLegenda[] = atual.legendas.blocos;
  try {
    mostrarSalvos($("salvos"), await pro.salvarLegendas(atual.caminho, blocos));
    estado("legendas", "no Premiere: Arquivo > Importar os .srt e arrastar para a timeline", "ok");
  } catch (erro) {
    estado("legendas", mensagem(erro), "erro");
  }
});

/* ------------------------------------------------- arquivos que chegam */

/** .xml e brutas vao para o Auto Pausas (ou o B-roll, se aberto); audio, video solto e .json para a Legenda. */
function receber(caminhos: string[]): void {
  if (caminhos.length === 0) return;
  const xml = caminhos.find((c) => /\.xml$/i.test(c));
  if (tela === "broll" && xml !== undefined) void abrirBroll(xml);
  else if (tela === "acabamento" && xml !== undefined) void abrirAcabamento(xml);
  else if (tela === "pausas" || xml !== undefined || caminhos.length > 1) void abrirPausas(caminhos);
  else void gerar(caminhos[0]!);
}

for (const zona of document.querySelectorAll<HTMLElement>("[data-escolher]")) {
  const escolher = async (): Promise<void> => receber(await pro.escolher(zona.dataset.escolher as "midia" | "sequencia" | "xml" | "musica"));
  zona.addEventListener("click", () => void escolher());
  zona.addEventListener("keydown", (e) => {
    if (e.key === "Enter" || e.key === " ") void escolher();
  });
}

// Soltar em qualquer lugar da janela: mirar na caixa nao deveria importar.
const zonaAtiva = (): HTMLElement | null => $(tela).querySelector(".soltar");
document.addEventListener("dragover", (e) => {
  e.preventDefault();
  zonaAtiva()?.classList.add("sobre");
});
document.addEventListener("dragleave", () => zonaAtiva()?.classList.remove("sobre"));
document.addEventListener("drop", (e) => {
  e.preventDefault();
  zonaAtiva()?.classList.remove("sobre");
  receber([...(e.dataTransfer?.files ?? [])].map((f) => pro.caminhoDe(f)));
});

pro.aoAbrir((caminho) => receber([caminho]));

/* -------------------------------------------------------------- config */

const config = $<HTMLDialogElement>("config");

async function atualizarChave(): Promise<void> {
  const tem = await pro.temChave();
  const dica = $("chaveEstado");
  dica.textContent = tem ? "Chave salva neste computador (cifrada)." : "Nenhuma chave salva ainda.";
  dica.className = `dica${tem ? " ok" : ""}`;
}

async function atualizarPasta(): Promise<void> {
  $("pastaBroll").textContent = (await pro.preferencias()).pastaBroll ?? "a do painel do Premiere (ou Downloads\Brolls - 2026)";
}

$("abrirConfig").addEventListener("click", () => {
  void atualizarChave();
  void atualizarPasta();
  config.showModal();
});

$("trocarPasta").addEventListener("click", async () => {
  if ((await pro.escolherPastaBroll()) !== null) await atualizarPasta();
});

$("salvarChave").addEventListener("click", async (e) => {
  e.preventDefault();
  const campo = $<HTMLInputElement>("chave");
  try {
    await pro.salvarChave(campo.value);
    campo.value = "";
    await atualizarChave();
  } catch (erro) {
    const dica = $("chaveEstado");
    dica.textContent = mensagem(erro);
    dica.className = "dica erro";
  }
});
