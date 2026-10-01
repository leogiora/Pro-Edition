/*
 * O motor do AutoEdit dentro do Premiere: o painel usa direto, e a ponte usa
 * quando o pedido vem do programa (src/ponte-app.ts). Os arquivos de dados
 * (perfil.json, config.json, editar-log.json) ficam na pasta do plugin.
 */

import { parseConfig } from "../ferramentas/auto-broll/src/domain.ts";
import { readJson, writeJson } from "../ferramentas/auto-broll/src/premiere.ts";
import { EMPRESAS } from "../ferramentas/pro-captions/src/preset.ts";
import { parsePerfil, trocarEmpresa, type MotorEditar } from "./editar.ts";
import { editar, lerEstado } from "./editar-premiere.ts";

const LOG = "editar-log.json";
const PERFIL = "perfil.json";

export const motorLocal: MotorEditar = {
  lerEstado,
  editar,
  lerEmpresa: async () => parsePerfil(await readJson(PERFIL)).empresa,
  // Empresa: termos do ElevenLabs e pasta de B-roll de cada uma (perfil.json).
  trocarEmpresa: async (nova) => {
    const config = parseConfig(await readJson("config.json"));
    const r = trocarEmpresa(parsePerfil(await readJson(PERFIL)), config.libraryPath, nova);
    await writeJson(PERFIL, r.perfil);
    await writeJson("config.json", { ...config, libraryPath: r.pasta });
    return { nome: EMPRESAS[r.perfil.empresa].nome, pasta: r.pasta };
  },
  // Guarda as 10 ultimas execucoes: o registro da tela e o que se ve; o arquivo e o que se le depois.
  guardarLog: async (linhas) => {
    const antes = (await readJson(LOG).catch(() => null)) as { execucoes?: unknown[] } | null;
    const execucoes = Array.isArray(antes?.execucoes) ? antes.execucoes : [];
    await writeJson(LOG, { execucoes: [...execucoes, { quando: new Date().toISOString(), linhas: [...linhas] }].slice(-10) });
  },
};
