/*
 * O motor do AutoEdit visto do programa: cada chamada vira um pedido ao
 * plugin no Premiere (app/src/ponte.ts -> src/ponte-app.ts), e o que o
 * AutoEdit conta enquanto roda volta como evento. A tela (src/ui/editar-mount.ts)
 * e a mesma do painel; so o motor e outro.
 */

import type { Empresa } from "../../../ferramentas/pro-captions/src/preset.ts";
import type { AoVivo, Etapa, EstadoSequencia, MotorEditar, Registrar, ResumoVariacao } from "../../../src/editar.ts";
import type { ProApi } from "../api.ts";

type Evento =
  | { tipo: "registro"; texto: string; tom: Parameters<Registrar>[1] }
  | { tipo: "progresso"; texto: string }
  | { tipo: "etapa"; id: Etapa; estado: Parameters<AoVivo["etapa"]>[1]; resumo?: string }
  | { tipo: "variacoes"; lista: ResumoVariacao[] }
  | { tipo: "alvo"; indices: number[] };

/** O ipc embrulha a mensagem: "Error invoking remote method 'x': Error: <a nossa>". */
const limpa = (e: unknown): Error =>
  new Error((e instanceof Error ? e.message : String(e)).replace(/^Error invoking remote method '[^']+': (Error: )?/, ""));

export function motorRemoto(pro: ProApi): MotorEditar {
  const pedir = (nome: string, args: readonly unknown[]): Promise<unknown> =>
    pro.pedirPremiere(nome, args).catch((e) => {
      throw limpa(e);
    });
  // Um AutoEdit por vez: os eventos vao para quem esta editando agora.
  let ouvinte: ((e: Evento) => void) | null = null;
  pro.aoEventoPremiere((e) => {
    const tipo = (e as { tipo?: unknown } | null)?.tipo;
    if (typeof tipo === "string") ouvinte?.(e as Evento);
  });

  return {
    lerEstado: () => pedir("lerEstado", []) as Promise<EstadoSequencia>,
    lerEmpresa: () => pedir("lerEmpresa", []) as Promise<Empresa>,
    trocarEmpresa: (nova) => pedir("trocarEmpresa", [nova]) as Promise<{ nome: string; pasta: string }>,
    guardarLog: async (linhas) => {
      await pedir("guardarLog", [linhas]);
    },
    editar: async (opcoes, registrar, progresso, aoVivo) => {
      ouvinte = (e) => {
        if (e.tipo === "registro") registrar(e.texto, e.tom);
        else if (e.tipo === "progresso") progresso(e.texto);
        else if (e.tipo === "etapa") aoVivo.etapa(e.id, e.estado, e.resumo);
        else if (e.tipo === "variacoes") aoVivo.variacoes(e.lista);
        else if (e.tipo === "alvo") aoVivo.alvo(e.indices);
      };
      try {
        return (await pedir("editar", [opcoes])) as boolean;
      } finally {
        ouvinte = null;
      }
    },
  };
}
