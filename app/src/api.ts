/*
 * O contrato entre a tela e o motor. A tela nao toca em disco nem em rede:
 * tudo passa por aqui (preload.ts implementa, window.pro expoe).
 */

import type { Legendas, BlocoLegenda } from "./motor/legendas.ts";
import type { EntradaPausas, ResultadoPausasSalvo } from "./motor/pausas.ts";

export type { Legendas, BlocoLegenda, EntradaPausas, ResultadoPausasSalvo };

export interface ProApi {
  /** Seletor de arquivo do Windows. Vazio = cancelou. */
  escolher(tipo: "midia" | "sequencia"): Promise<string[]>;
  /** Caminho de um arquivo arrastado para a janela. */
  caminhoDe(arquivo: File): string;
  temChave(): Promise<boolean>;
  salvarChave(chave: string): Promise<void>;
  gerarLegendas(caminho: string): Promise<Legendas>;
  salvarLegendas(caminho: string, blocos: readonly BlocoLegenda[]): Promise<string[]>;
  mostrarNaPasta(caminho: string): Promise<void>;
  /** Le o .xml exportado do Premiere (ou as brutas) e resume o que vai ser cortado. */
  abrirPausas(caminhos: readonly string[]): Promise<EntradaPausas>;
  rodarPausas(caminhos: readonly string[], opcoes: { legendas: boolean }): Promise<ResultadoPausasSalvo>;
  /** Progresso do motor ("extraindo o áudio", "transcrevendo..."). */
  aoAvisar(fn: (texto: string) => void): void;
  /** Arquivo aberto pelo "Abrir com" do Windows. */
  aoAbrir(fn: (caminho: string) => void): void;
}
