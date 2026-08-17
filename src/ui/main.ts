/*
 * Boot do shell. Monta o registro das tres telas e troca document.body
 * inteiro a cada selecao — nunca duas telas juntas no DOM (colisao real de
 * IDs e classes entre os dois plugins, documentada no spec).
 */

import { escolherTela, extrairCorpo, type Ferramenta, type Tela } from "../shell.ts";

import htmlBrollBruto from "../../../auto-broll-premiere/src/ui/index.html";
import cssBroll from "../../../auto-broll-premiere/src/ui/styles.css";
import { mount as mountBroll } from "../../../auto-broll-premiere/src/ui/mount.ts";

import htmlCaptionsBruto from "../../../Pro-Captions/src/ui/index.html";
import cssCaptions from "../../../Pro-Captions/src/ui/styles.css";
import { mount as mountCaptions } from "../../../Pro-Captions/src/ui/mount.ts";

import htmlSeletor from "./seletor.html";
import cssSeletor from "./seletor.css";

const CSS_VOLTAR = `
.pe-voltar {
  margin: 8px 12px 0;
  align-self: flex-start;
  background: none;
  border: none;
  color: #9aa4b2;
  font-size: 12px;
  cursor: pointer;
  padding: 4px 0;
}

.pe-voltar:hover {
  color: #ffffff;
}
`;

function montarSeletor(root: HTMLElement): void {
  root.querySelector<HTMLButtonElement>("#cardBroll")!.addEventListener("click", () => mostrar("broll"));
  root.querySelector<HTMLButtonElement>("#cardCaptions")!.addEventListener("click", () => mostrar("captions"));
}

const REGISTRO: Readonly<Record<Ferramenta, Tela>> = {
  seletor: { html: htmlSeletor, css: cssSeletor, montar: montarSeletor },
  broll: { html: extrairCorpo(htmlBrollBruto), css: cssBroll, montar: mountBroll },
  captions: { html: extrairCorpo(htmlCaptionsBruto), css: cssCaptions, montar: mountCaptions },
};

function mostrar(ferramenta: Ferramenta): void {
  const tela = escolherTela(REGISTRO, ferramenta);
  const botaoVoltar =
    ferramenta === "seletor" ? "" : `<button id="peVoltar" class="pe-voltar">&larr; Voltar</button>`;

  // Substitui o document.body inteiro: elimina o <style> anterior junto com
  // o HTML anterior, nunca acumula duas telas no mesmo documento.
  document.body.innerHTML = `${botaoVoltar}<style>\n${CSS_VOLTAR}\n${tela.css}\n</style>\n${tela.html}`;

  if (ferramenta !== "seletor") {
    document.getElementById("peVoltar")!.addEventListener("click", () => mostrar("seletor"));
  }

  tela.montar(document.body);
}

mostrar("seletor");
