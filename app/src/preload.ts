import { contextBridge, ipcRenderer, webUtils } from "electron";

import type { ProApi } from "./api.ts";

const api: ProApi = {
  escolher: (tipo) => ipcRenderer.invoke("escolher", tipo),
  caminhoDe: (arquivo) => webUtils.getPathForFile(arquivo),
  temChave: () => ipcRenderer.invoke("chave:tem"),
  salvarChave: (chave) => ipcRenderer.invoke("chave:salvar", chave),
  gerarLegendas: (caminho) => ipcRenderer.invoke("legendas:gerar", caminho),
  salvarLegendas: (caminho, blocos) => ipcRenderer.invoke("legendas:salvar", caminho, blocos),
  mostrarNaPasta: (caminho) => ipcRenderer.invoke("mostrar", caminho),
  abrirPausas: (caminhos) => ipcRenderer.invoke("pausas:abrir", caminhos),
  rodarPausas: (caminhos, opcoes) => ipcRenderer.invoke("pausas:rodar", caminhos, opcoes),
  abrirBroll: (caminho) => ipcRenderer.invoke("broll:abrir", caminho),
  rodarBroll: (caminho) => ipcRenderer.invoke("broll:rodar", caminho),
  preferencias: () => ipcRenderer.invoke("preferencias"),
  escolherPastaBroll: () => ipcRenderer.invoke("broll:pasta"),
  aoAvisar: (fn) => void ipcRenderer.on("aviso", (_e, texto: string) => fn(texto)),
  aoAbrir: (fn) => void ipcRenderer.on("abrir", (_e, caminho: string) => fn(caminho)),
};

contextBridge.exposeInMainWorld("pro", api);
