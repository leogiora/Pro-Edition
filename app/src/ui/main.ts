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

const MAX_CARACTERES = 20;

const relogio = (s: number): string => {
  const m = Math.floor(s / 60);
  return `${String(m).padStart(2, "0")}:${(s - m * 60).toFixed(2).padStart(5, "0")}`;
};

/* ---------------------------------------------------------------- telas */

const TITULOS: Record<string, string> = { legendas: "Legendas" };

function abrir(tela: "hall" | "legendas"): void {
  for (const id of ["hall", "legendas"]) $(id).hidden = id !== tela;
  $("voltar").hidden = tela === "hall";
  $("marca").hidden = tela !== "hall";
  $("titulo").textContent = TITULOS[tela] ?? "";
}

for (const card of document.querySelectorAll<HTMLElement>("[data-abre]")) {
  card.addEventListener("click", () => abrir(card.dataset.abre as "legendas"));
}
$("voltar").addEventListener("click", () => abrir("hall"));

/* ------------------------------------------------------------ legendas */

let atual: { caminho: string; legendas: Legendas } | null = null;

const ORIGEM: Record<Legendas["origem"], string> = {
  "arquivo json": "transcrição lida do arquivo .json",
  guardada: "este áudio já tinha sido transcrito: nada foi cobrado de novo",
  elevenlabs: "transcrito agora no ElevenLabs",
};

function estado(texto: string, tom: "" | "ativo" | "ok" | "erro" = ""): void {
  const el = $("estado");
  el.textContent = texto;
  el.className = `estado ${tom}`;
}

pro.aoAvisar((texto) => estado(texto, "ativo"));

async function gerar(caminho: string): Promise<void> {
  abrir("legendas");
  atual = null;
  $("resultado").hidden = true;
  $("arquivo").textContent = caminho.split(/[\\/]/).pop() ?? caminho;
  $("soltar").classList.add("compacto");
  estado("começando", "ativo");
  try {
    const legendas = await pro.gerarLegendas(caminho);
    atual = { caminho, legendas };
    mostrar(legendas);
    estado(ORIGEM[legendas.origem], "ok");
  } catch (erro) {
    estado(mensagem(erro), "erro");
  }
}

function mostrar(l: Legendas): void {
  const precos = l.blocos.filter((b) => b.estilo === "preco").length;
  const revisar = l.blocos.filter((b) => b.precisaRevisao).length;
  $("resumo").textContent =
    `${l.blocos.length} blocos · ${precos} preço(s)` + (revisar > 0 ? ` · ${revisar} para revisar` : "");
  $("salvos").hidden = true;

  const lista = $("blocos");
  lista.replaceChildren(
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
        const motivo = document.createElement("span");
        motivo.className = "motivo";
        motivo.textContent = b.motivos.join(" · ");
        li.append(motivo);
      }
      return li;
    })
  );
  $("resultado").hidden = false;
  if (l.problemas.length > 0) estado(`corrija antes de salvar: ${l.problemas[0]}`, "erro");
}

$<HTMLButtonElement>("salvar").addEventListener("click", async () => {
  if (atual === null) return;
  const blocos: BlocoLegenda[] = atual.legendas.blocos;
  try {
    const caminhos = await pro.salvarLegendas(atual.caminho, blocos);
    const p = $("salvos");
    p.replaceChildren(`Salvo: ${caminhos.map((c) => c.split(/[\\/]/).pop()).join(" e ")}`);
    const botao = document.createElement("button");
    botao.textContent = "Mostrar na pasta";
    botao.addEventListener("click", () => void pro.mostrarNaPasta(caminhos[0] ?? atual?.caminho ?? ""));
    p.append(botao);
    p.hidden = false;
    estado("no Premiere: Arquivo > Importar os .srt e arrastar para a timeline", "ok");
  } catch (erro) {
    estado(mensagem(erro), "erro");
  }
});

const soltar = $("soltar");
const escolher = async (): Promise<void> => {
  const caminho = await pro.escolherMidia();
  if (caminho !== null) void gerar(caminho);
};
soltar.addEventListener("click", () => void escolher());
soltar.addEventListener("keydown", (e) => {
  if (e.key === "Enter" || e.key === " ") void escolher();
});
// Soltar em qualquer lugar da janela: mirar na caixa nao deveria importar.
document.addEventListener("dragover", (e) => {
  e.preventDefault();
  soltar.classList.add("sobre");
});
document.addEventListener("dragleave", () => soltar.classList.remove("sobre"));
document.addEventListener("drop", (e) => {
  e.preventDefault();
  soltar.classList.remove("sobre");
  const arquivo = e.dataTransfer?.files[0];
  if (arquivo !== undefined) void gerar(pro.caminhoDe(arquivo));
});

pro.aoAbrir((caminho) => void gerar(caminho));

/* -------------------------------------------------------------- config */

const config = $<HTMLDialogElement>("config");

async function atualizarChave(): Promise<void> {
  const tem = await pro.temChave();
  const dica = $("chaveEstado");
  dica.textContent = tem ? "Chave salva neste computador (cifrada)." : "Nenhuma chave salva ainda.";
  dica.className = `dica${tem ? " ok" : ""}`;
}

$("abrirConfig").addEventListener("click", () => {
  void atualizarChave();
  config.showModal();
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
