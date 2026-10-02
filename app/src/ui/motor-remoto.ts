/*
 * O motor do AutoEdit visto do programa: cada chamada vira um pedido ao
 * plugin no Premiere (app/src/ponte.ts -> src/ponte-app.ts), e o que o
 * AutoEdit conta enquanto roda volta como evento. A tela (src/ui/editar-mount.ts)
 * e a mesma do painel; so o motor e outro.
 */

import type { Empresa } from "../../../ferramentas/pro-captions/src/preset.ts";
import type { AoVivo, Etapa, EstadoSequencia, MotorEditar, Registrar, ResumoVariacao } from "../../../src/editar.ts";
import type { MotorPausas, Previa, Sequencia } from "../../../src/silencecut.ts";
import type { Config } from "../../../ferramentas/auto-broll/src/domain.ts";
import type { AndamentoBroll, EstadoBroll, Inserido, MotorBroll, RegistrarBroll, ResultadoBroll, TomBroll } from "../../../ferramentas/auto-broll/src/broller.ts";
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

/** O SilenceCut visto do programa: o corte e a leitura sao do plugin, a tela e daqui. */
export function motorPausasRemoto(pro: ProApi): MotorPausas {
  let ouvinte: ((texto: string) => void) | null = null;
  pro.aoEventoPremiere((e) => {
    const ev = e as { tipo?: unknown; texto?: unknown } | null;
    if (ev?.tipo === "progresso" && typeof ev.texto === "string") ouvinte?.(ev.texto);
  });
  const pedir = (nome: string, args: readonly unknown[]): Promise<unknown> =>
    pro.pedirPremiere(nome, args).catch((e) => {
      throw limpa(e);
    });
  return {
    ler: () => pedir("pausas:ler", []) as Promise<Sequencia>,
    previa: (margemS) => pedir("pausas:previa", [margemS]) as Promise<Previa>,
    cortar: async (margemS, progresso) => {
      ouvinte = progresso;
      try {
        return (await pedir("pausas:cortar", [margemS])) as { ok: boolean; linhas: readonly string[] };
      } finally {
        ouvinte = null;
      }
    },
    desfazer: () => pedir("pausas:desfazer", []) as Promise<readonly string[]>,
    preparar: () => pedir("pausas:preparar", []) as Promise<boolean>,
    guardarLog: async (linhas) => {
      await pedir("pausas:guardarLog", [linhas]);
    },
  };
}

/** O B-Roller visto do programa: a leitura, a insercao e o aprendizado sao do plugin; o registro volta como evento. */
export function motorBrollRemoto(pro: ProApi): MotorBroll {
  let ouvinte: RegistrarBroll | null = null;
  let etapas: AndamentoBroll | null = null;
  pro.aoEventoPremiere((e) => {
    const ev = e as { tipo?: unknown; texto?: unknown; tom?: unknown; etapa?: unknown } | null;
    if (ev?.tipo === "registro" && typeof ev.texto === "string") ouvinte?.(ev.texto, ev.tom as TomBroll);
    if (ev?.tipo === "broll:andamento" && typeof ev.etapa === "number") etapas?.(ev.etapa, String(ev.texto ?? ""));
  });
  const pedir = (nome: string, args: readonly unknown[]): Promise<unknown> =>
    pro.pedirPremiere(nome, args).catch((e) => {
      throw limpa(e);
    });
  const comRegistro = async <T>(registrar: RegistrarBroll, nome: string, args: readonly unknown[]): Promise<T> => {
    ouvinte = registrar;
    try {
      return (await pedir(nome, args)) as T;
    } finally {
      ouvinte = null;
    }
  };
  return {
    iniciar: (registrar) => comRegistro<Config>(registrar, "broll:iniciar", []),
    ler: (pasta) => pedir("broll:ler", [pasta]) as Promise<EstadoBroll>,
    analisar: async (config, registrar, andamento) => {
      etapas = andamento;
      try {
        return await comRegistro<ResultadoBroll>(registrar, "broll:analisar", [config]);
      } finally {
        etapas = null;
      }
    },
    aprender: (config, registrar) => comRegistro<void>(registrar, "broll:aprender", [config]),
    irPara: async (segundos) => {
      await pedir("broll:irPara", [segundos]);
    },
    tirar: async (b, config) => {
      await pedir("broll:tirar", [b, config]);
    },
    trocar: (b, config) => pedir("broll:trocar", [b, config]) as Promise<Inserido>,
  };
}
