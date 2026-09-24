/*
 * Processo principal do Electron: a janela e o motor. Tudo que toca disco,
 * rede ou ffmpeg roda aqui; a tela so pede pelo ipc (ver api.ts).
 */

import { app, BrowserWindow, dialog, ipcMain, shell } from "electron";
import { existsSync } from "node:fs";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";

import { Config } from "./motor/config.ts";
import { gerarLegendas, salvarSrts, type BlocoLegenda } from "./motor/legendas.ts";
import { abrirParaPausas, rodarPausas } from "./motor/pausas.ts";

const cfg = new Config(app.getPath("userData"));

const MIDIA = ["mp4", "mov", "mxf", "m4v", "wav", "mp3", "m4a", "aac", "flac", "json"];

/** Arquivo passado pelo "Abrir com" do Windows (ou arrastado no icone). */
const arquivoDaLinha = (): string | undefined =>
  process.argv.slice(1).find((a) => !a.startsWith("-") && a !== "." && existsSync(a) && /\.[a-z0-9]+$/i.test(a));

function criarJanela(): void {
  const janela = new BrowserWindow({
    width: 1120,
    height: 760,
    minWidth: 760,
    minHeight: 520,
    title: "Pro Edition",
    backgroundColor: "#0d0f13",
    icon: join(__dirname, "icon.png"),
    webPreferences: { preload: join(__dirname, "preload.cjs"), contextIsolation: true, sandbox: true },
  });
  janela.removeMenu();
  void janela.loadFile(join(__dirname, "index.html"));

  janela.webContents.once("did-finish-load", () => {
    const arquivo = arquivoDaLinha();
    if (arquivo !== undefined) janela.webContents.send("abrir", arquivo);

    // Retrato da tela para conferir o visual sem abrir a janela na mao.
    const print = process.env.PRO_EDITION_PRINT;
    if (print !== undefined) {
      setTimeout(async () => {
        await writeFile(print, (await janela.webContents.capturePage()).toPNG());
        app.quit();
      }, Number(process.env.PRO_EDITION_PRINT_ESPERA ?? 800));
    }
  });
}

const FILTROS = {
  midia: {
    title: "Vídeo ou áudio da sequência",
    properties: ["openFile"] as Array<"openFile" | "multiSelections">,
    filters: [{ name: "Vídeo, áudio ou transcrição", extensions: MIDIA }],
  },
  sequencia: {
    title: "Sequência exportada do Premiere (.xml) ou as brutas",
    properties: ["openFile", "multiSelections"] as Array<"openFile" | "multiSelections">,
    filters: [{ name: "Sequência XML ou brutas", extensions: ["xml", "mp4", "mov", "mxf", "m4v"] }],
  },
};

ipcMain.handle("escolher", async (evento, tipo: keyof typeof FILTROS) => {
  const janela = BrowserWindow.fromWebContents(evento.sender);
  const opcoes = { ...FILTROS[tipo], filters: [...FILTROS[tipo].filters, { name: "Todos", extensions: ["*"] }] };
  const r = janela === null ? await dialog.showOpenDialog(opcoes) : await dialog.showOpenDialog(janela, opcoes);
  return r.canceled ? [] : r.filePaths;
});

ipcMain.handle("chave:tem", async () => (await cfg.chave()) !== null);

ipcMain.handle("chave:salvar", async (_e, chave: string) => {
  const limpa = chave.trim();
  // Visto no primeiro teste real: colar o ID da chave no lugar da chave.
  if (!limpa.startsWith("sk_")) {
    throw new Error("Essa não é a chave secreta. No ElevenLabs, crie uma chave nova e copie o valor que começa com sk_.");
  }
  await cfg.salvarChave(limpa);
});

ipcMain.handle("legendas:gerar", (evento, caminho: string) =>
  gerarLegendas(caminho, cfg, (texto) => evento.sender.send("aviso", texto))
);

ipcMain.handle("legendas:salvar", (_e, caminho: string, blocos: BlocoLegenda[]) => salvarSrts(caminho, blocos));

ipcMain.handle("mostrar", (_e, caminho: string) => shell.showItemInFolder(caminho));

ipcMain.handle("pausas:abrir", (_e, caminhos: string[]) => abrirParaPausas(caminhos));

ipcMain.handle("pausas:rodar", (evento, caminhos: string[], opcoes: { legendas: boolean }) =>
  rodarPausas(caminhos, opcoes, cfg, (texto) => evento.sender.send("aviso", texto))
);

// Uma janela so: abrir outro arquivo pelo Windows manda para a que ja existe.
if (!app.requestSingleInstanceLock()) {
  app.quit();
} else {
  app.on("second-instance", (_e, argv) => {
    const janela = BrowserWindow.getAllWindows()[0];
    if (janela === undefined) return;
    if (janela.isMinimized()) janela.restore();
    janela.focus();
    const arquivo = argv.slice(1).find((a) => !a.startsWith("-") && existsSync(a) && /\.[a-z0-9]+$/i.test(a));
    if (arquivo !== undefined) janela.webContents.send("abrir", arquivo);
  });
  void app.whenReady().then(criarJanela);
  app.on("window-all-closed", () => app.quit());
}
