/*
 * O contrato entre a tela e o motor. A tela nao toca em disco nem em rede:
 * tudo passa por aqui (preload.ts implementa, window.pro expoe).
 */

import type { Legendas, BlocoLegenda } from "./motor/legendas.ts";

export type { Legendas, BlocoLegenda };

export interface ProApi {
  /** Seletor de arquivo do Windows. null = cancelou. */
  escolherMidia(): Promise<string | null>;
  /** Caminho de um arquivo arrastado para a janela. */
  caminhoDe(arquivo: File): string;
  temChave(): Promise<boolean>;
  salvarChave(chave: string): Promise<void>;
  gerarLegendas(caminho: string): Promise<Legendas>;
  salvarLegendas(caminho: string, blocos: readonly BlocoLegenda[]): Promise<string[]>;
  mostrarNaPasta(caminho: string): Promise<void>;
  /** Progresso do motor ("extraindo o áudio", "transcrevendo..."). */
  aoAvisar(fn: (texto: string) => void): void;
  /** Arquivo aberto pelo "Abrir com" do Windows. */
  aoAbrir(fn: (caminho: string) => void): void;
}
