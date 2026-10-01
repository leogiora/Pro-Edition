/*
 * Processo principal do Electron: a janela e o motor. Tudo que toca disco,
 * rede ou ffmpeg roda aqui; a tela so pede pelo ipc (ver api.ts).
 */

import { app, BrowserWindow, dialog, ipcMain, shell } from "electron";
import { existsSync } from "node:fs";
import { createServer } from "node:http";
import { writeFile } from "node:fs/promises";
import { join } from "node:path";

import { Config } from "./motor/config.ts";
import { gerarLegendas, salvarSrts, type BlocoLegenda, type Legendas } from "./motor/legendas.ts";
import { abrirParaAcabamento, rodarAcabamento, type OpcoesAcabamentoTela } from "./motor/acabamento.ts";
import { abrirParaBroll, rodarBroll } from "./motor/broll.ts";
import { abrirParaPausas, rodarPausas } from "./motor/pausas.ts";
import { abrirParaPodcast, rodarPodcast } from "./motor/podcast.ts";
import { lerEstadoPremiere, PORTA_PREMIERE } from "./premiere-ao-vivo.ts";

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
    title: "Cutline",
    backgroundColor: "#0d0f13",
    icon: join(__dirname, "icon.png"),
    webPreferences: { preload: join(__dirname, "preload.cjs"), contextIsolation: true, sandbox: true },
  });
  janela.removeMenu();
  void janela.loadFile(join(__dirname, "index.html"));

  janela.webContents.once("did-finish-load", async () => {
    // So para conferir a tela sem clicar (ex.: abrir um card antes do arquivo chegar).
    if (process.env.PRO_EDITION_JS !== undefined) await janela.webContents.executeJavaScript(process.env.PRO_EDITION_JS);
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

/**
 * O plugin no Premiere (a "extensao") conta o que esta aberto a cada meio
 * segundo; o programa repassa para a tela. So 127.0.0.1: nada de fora do PC.
 * Porta ocupada nao derruba o programa, so tira o "ao vivo".
 */
function escutarPremiere(): void {
  const servidor = createServer((req, res) => {
    if (req.method !== "POST" || req.url !== "/premiere") {
      res.writeHead(404).end();
      return;
    }
    let corpo = "";
    req.on("data", (pedaco: Buffer) => {
      corpo += pedaco.toString("utf8");
      if (corpo.length > 10_000) req.destroy();
    });
    req.on("end", () => {
      let estado = null;
      try {
        estado = lerEstadoPremiere(JSON.parse(corpo));
      } catch {
        // corpo que nao e JSON: recusado abaixo
      }
      if (estado) for (const janela of BrowserWindow.getAllWindows()) janela.webContents.send("premiere", estado);
      res.writeHead(estado ? 200 : 400, { "Content-Type": "application/json" }).end("{}");
    });
  });
  servidor.on("error", (e) => console.error(`ponte do Premiere: ${e.message}`));
  servidor.listen(PORTA_PREMIERE, "127.0.0.1");
}

const FILTROS = {
  midia: {
    title: "Vídeo ou áudio da sequência (e a legenda do Premiere em .srt, se quiser os cortes dela)",
    properties: ["openFile", "multiSelections"] as Array<"openFile" | "multiSelections">,
    filters: [{ name: "Vídeo, áudio, transcrição ou legenda", extensions: [...MIDIA, "srt"] }],
  },
  xml: {
    title: "Sequência exportada do Premiere (.xml)",
    properties: ["openFile"] as Array<"openFile" | "multiSelections">,
    filters: [{ name: "Sequência XML", extensions: ["xml"] }],
  },
  musica: {
    title: "Música da trilha",
    properties: ["openFile"] as Array<"openFile" | "multiSelections">,
    filters: [{ name: "Áudio", extensions: ["wav", "mp3", "m4a", "aac", "flac", "aif", "aiff"] }],
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

ipcMain.handle("legendas:gerar", (evento, caminho: string, srtPremiere: string | null) =>
  gerarLegendas(caminho, cfg, (texto) => evento.sender.send("aviso", texto), srtPremiere)
);

ipcMain.handle("legendas:salvar", (_e, caminho: string, blocos: BlocoLegenda[], cortes: Legendas["cortes"]) =>
  salvarSrts(caminho, blocos, cortes)
);

ipcMain.handle("mostrar", (_e, caminho: string) => shell.showItemInFolder(caminho));

ipcMain.handle("pausas:abrir", (_e, caminhos: string[]) => abrirParaPausas(caminhos));

ipcMain.handle("pausas:rodar", (evento, caminhos: string[], opcoes: { legendas: boolean }) =>
  rodarPausas(caminhos, opcoes, cfg, (texto) => evento.sender.send("aviso", texto))
);

ipcMain.handle("broll:abrir", (_e, caminho: string) => abrirParaBroll(caminho, cfg));

ipcMain.handle("broll:rodar", (evento, caminho: string) =>
  rodarBroll(caminho, cfg, (texto) => evento.sender.send("aviso", texto))
);

ipcMain.handle("preferencias", () => cfg.preferencias());

ipcMain.handle("acabamento:abrir", (_e, caminho: string) => abrirParaAcabamento(caminho, cfg));

ipcMain.handle("acabamento:rodar", (_e, caminho: string, opcoes: OpcoesAcabamentoTela) => rodarAcabamento(caminho, opcoes, cfg));

ipcMain.handle("podcast:abrir", (_e, caminho: string) => abrirParaPodcast(caminho));

ipcMain.handle("podcast:rodar", (evento, caminho: string) =>
  rodarPodcast(caminho, (texto) => evento.sender.send("aviso", texto))
);

ipcMain.handle("broll:pasta", async (evento) => {
  const janela = BrowserWindow.fromWebContents(evento.sender);
  const opcoes = { title: "Pasta dos B-rolls", properties: ["openDirectory" as const] };
  const r = janela === null ? await dialog.showOpenDialog(opcoes) : await dialog.showOpenDialog(janela, opcoes);
  const pasta = r.canceled ? undefined : r.filePaths[0];
  if (pasta === undefined) return null;
  await cfg.salvarPreferencias({ pastaBroll: pasta });
  return pasta;
});

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
  void app.whenReady().then(() => {
    criarJanela();
    escutarPremiere();
  });
  app.on("window-all-closed", () => app.quit());
}
