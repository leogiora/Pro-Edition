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

export class Config {
  constructor(private readonly pasta: string) {}

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
