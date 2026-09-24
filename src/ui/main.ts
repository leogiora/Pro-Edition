/*
 * Boot do shell. Monta o registro das tres telas e troca document.body
 * inteiro a cada selecao — nunca duas telas juntas no DOM (colisao real de
 * IDs e classes entre os dois plugins, documentada no spec).
 */

import { desenharTrilhas, escolherTela, extrairCorpo, type Ferramenta, type Tela } from "../shell.ts";

import htmlBrollBruto from "../../ferramentas/auto-broll/src/ui/index.html";
import cssBroll from "../../ferramentas/auto-broll/src/ui/styles.css";
import { mount as mountBroll } from "../../ferramentas/auto-broll/src/ui/mount.ts";

import htmlCaptionsBruto from "../../ferramentas/pro-captions/src/ui/index.html";
import cssCaptions from "../../ferramentas/pro-captions/src/ui/styles.css";
import { mount as mountCaptions } from "../../ferramentas/pro-captions/src/ui/mount.ts";

import htmlEditar from "./editar.html";
import { mount as mountEditar } from "./editar-mount.ts";

import htmlPausas from "./pausas.html";
import { mount as mountPausas } from "./pausas-mount.ts";

import htmlAutocut from "./autocut.html";
import { mount as mountAutocut } from "./autocut-mount.ts";

import htmlAutosplit from "./autosplit.html";
import { mount as mountAutosplit } from "./autosplit-mount.ts";

import htmlSeletor from "./seletor.html";
import cssSeletor from "./seletor.css";

/*
 * Barra de voltar do shell — mesmos tokens das folhas da familia (ver
 * ferramentas/auto-broll/src/ui/styles.css para a tabela completa).
 *
 * So "<- Pro Edition", sem o nome da ferramenta: toda tela ja abre com o
 * proprio cabecalho (nome + status) logo abaixo, e repetir o nome aqui dava
 * dois titulos empilhados.
 */
const CSS_NAV = `
.pe-nav {
  display: flex;
  flex-direction: row;
  align-items: center;
  flex: none;
  /* align-self:stretch e nao width:100%: com width, os 24px de padding
     somam POR FORA da largura do painel (sem box-sizing garantido no UXP) e
     abrem uma barra de rolagem horizontal. Esticar resolve sem depender de
     box-sizing, e e o mesmo remedio que o resto da familia usa para os filhos
     de flex column no UXP. */
  align-self: stretch;
  margin: 0;
  padding: 7px 12px;
  background-color: #14171d;
  border: none;
  border-bottom: 1px solid #232830;
  font-family: Inter, adobe-clean, "Source Sans 3", "Segoe UI", sans-serif;
  font-size: 11px;
  text-align: left;
  cursor: pointer;
  transition: background-color 150ms;
}

.pe-nav:hover {
  background-color: #1a1e26;
}

.pe-nav:focus {
  background-color: #1a1e26;
  outline: none;
}

.pe-nav-seta {
  flex: none;
  margin-right: 8px;
  font-size: 12px;
  color: #5f6774;
  transition: color 150ms;
}

.pe-nav:hover .pe-nav-seta {
  color: #eceef2;
}

.pe-nav-raiz {
  flex: none;
  color: #9098a6;
  white-space: nowrap;
  transition: color 150ms;
}

.pe-nav:hover .pe-nav-raiz {
  color: #eceef2;
}
`;

/**
 * Liga um `div[role="button"]` — clique E teclado.
 *
 * Card e barra de navegacao sao div e nao `<button>` porque o UXP renderiza
 * `<button>` como controle nativo do host: ele ignora o CSS do proprio
 * elemento e achata os filhos numa linha so (foi assim que os cards viraram
 * pilulas cinzas de texto centralizado). Com div o visual e nosso — e o
 * Enter/Espaco, que o botao nativo daria de graca, volta a ser
 * responsabilidade nossa.
 */
function ligarAcao(node: HTMLElement, acao: () => void): void {
  node.addEventListener("click", acao);
  node.addEventListener("keydown", (evento) => {
    const tecla = (evento as KeyboardEvent).key;
    if (tecla !== "Enter" && tecla !== " ") return;
    evento.preventDefault();
    acao();
  });
}

function montarSeletor(root: HTMLElement): void {
  ligarAcao(root.querySelector<HTMLElement>("#cardEditar")!, () => mostrar("editar"));
  ligarAcao(root.querySelector<HTMLElement>("#cardPausas")!, () => mostrar("pausas"));
  ligarAcao(root.querySelector<HTMLElement>("#cardBroll")!, () => mostrar("broll"));
  ligarAcao(root.querySelector<HTMLElement>("#cardCaptions")!, () => mostrar("captions"));
  ligarAcao(root.querySelector<HTMLElement>("#cardAutocut")!, () => mostrar("autocut"));
  ligarAcao(root.querySelector<HTMLElement>("#cardAutosplit")!, () => mostrar("autosplit"));
  // Depois dos cliques: miniatura e enfeite, nunca pode deixar o hall morto.
  root.querySelectorAll<HTMLElement>("[data-trilhas]").forEach((mapa) => {
    mapa.innerHTML = desenharTrilhas(mapa.dataset.trilhas ?? "");
  });
}

const REGISTRO: Readonly<Record<Ferramenta, Tela>> = {
  seletor: { html: htmlSeletor, css: cssSeletor, montar: montarSeletor },
  editar: { html: htmlEditar, css: cssBroll, montar: mountEditar },
  pausas: { html: htmlPausas, css: cssBroll, montar: mountPausas },
  broll: { html: extrairCorpo(htmlBrollBruto), css: cssBroll, montar: mountBroll },
  captions: { html: extrairCorpo(htmlCaptionsBruto), css: cssCaptions, montar: mountCaptions },
  // Telas nossas usam a folha da familia do Auto B-roll (topo, secao, badge,
  // log) e so trazem no proprio <style> o acento e o que for so delas.
  autocut: { html: htmlAutocut, css: cssBroll, montar: mountAutocut },
  autosplit: { html: htmlAutosplit, css: cssBroll, montar: mountAutosplit },
};

function mostrar(ferramenta: Ferramenta): void {
  const tela = escolherTela(REGISTRO, ferramenta);
  const nav =
    ferramenta === "seletor"
      ? ""
      : `<div id="peVoltar" class="pe-nav" role="button" tabindex="0" aria-label="Voltar para o Pro Edition">` +
        `<span class="pe-nav-seta">&larr;</span>` +
        `<span class="pe-nav-raiz">Pro Edition</span>` +
        `</div>`;

  // Substitui o document.body inteiro: elimina o <style> anterior junto com
  // o HTML anterior, nunca acumula duas telas no mesmo documento.
  document.body.innerHTML = `${nav}<style>\n${CSS_NAV}\n${tela.css}\n</style>\n${tela.html}`;

  if (ferramenta !== "seletor") {
    ligarAcao(document.getElementById("peVoltar")!, () => mostrar("seletor"));
  }

  tela.montar(document.body);
}

mostrar("seletor");
