/*
 * O que o programa lembra entre uma abertura e outra: hoje, so a chave do
 * ElevenLabs e as transcricoes ja pagas.
 *
 * A chave e cifrada pelo Windows (DPAPI, via safeStorage): o arquivo copiado
 * para outra maquina ou outro usuario nao abre.
 */

import { safeStorage } from "electron";
import { mkdir, readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

export interface Preferencias {
  /** Pasta da biblioteca de B-rolls. */
  readonly pastaBroll?: string;
}

export class Config {
  constructor(readonly pasta: string) {}

  async preferencias(): Promise<Preferencias> {
    try {
      return JSON.parse(await readFile(join(this.pasta, "preferencias.json"), "utf8")) as Preferencias;
    } catch {
      return {};
    }
  }

  async salvarPreferencias(mudancas: Preferencias): Promise<void> {
    await mkdir(this.pasta, { recursive: true });
    const atual = await this.preferencias();
    await writeFile(join(this.pasta, "preferencias.json"), JSON.stringify({ ...atual, ...mudancas }, null, 2), "utf8");
  }

  /** Um JSON qualquer da pasta do programa (caches). null se nao existe ou quebrou. */
  async lerJson(nome: string): Promise<unknown> {
    try {
      return JSON.parse(await readFile(join(this.pasta, nome), "utf8"));
    } catch {
      return null;
    }
  }

  async gravarJson(nome: string, dados: unknown): Promise<void> {
    await mkdir(this.pasta, { recursive: true });
    await writeFile(join(this.pasta, nome), JSON.stringify(dados), "utf8");
  }

  private get arquivoChave(): string {
    return join(this.pasta, "elevenlabs-chave.bin");
  }

  async chave(): Promise<string | null> {
    try {
      return safeStorage.decryptString(await readFile(this.arquivoChave));
    } catch {
      return null;
    }
  }

  async salvarChave(chave: string): Promise<void> {
    await mkdir(this.pasta, { recursive: true });
    await writeFile(this.arquivoChave, safeStorage.encryptString(chave.trim()));
  }

  /** Resposta do ElevenLabs guardada pela assinatura do audio: nao paga duas vezes. */
  async transcricao(assinatura: string): Promise<string | null> {
    try {
      return await readFile(join(this.pasta, "transcricoes", `${assinatura}.json`), "utf8");
    } catch {
      return null;
    }
  }

  async guardarTranscricao(assinatura: string, json: string): Promise<void> {
    await mkdir(join(this.pasta, "transcricoes"), { recursive: true });
    await writeFile(join(this.pasta, "transcricoes", `${assinatura}.json`), json, "utf8");
  }
}
