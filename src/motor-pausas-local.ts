/*
 * O motor do SilenceCut dentro do Premiere: o painel usa direto, e a ponte usa
 * quando o pedido vem do programa (src/ponte-app.ts).
 */

import {
  analisarGravacao,
  aplicarPausas,
  audioPronto,
  desfazerPausas,
  guardarRegistro,
  lerAudio,
  lerGravacao,
  sondaDaV1,
} from "./pausas-premiere.ts";
import { montarPrevia, type MotorPausas } from "./silencecut.ts";

// A leitura do audio da bruta nova: so quando a V1 parou de mudar entre duas
// olhadas (o Leo terminou de separar os videos), e uma vez por bruta.
let sondaVista = "";
let sondaTratada = "";

export const motorPausasLocal: MotorPausas = {
  ler: async () => {
    const g = await lerGravacao();
    return { nome: g.nomeSequencia, duracaoS: g.duracaoQ / g.fps, clipes: g.clipes, palavras: g.palavras.length };
  },
  previa: async (margemS) => montarPrevia(await analisarGravacao(), margemS),
  cortar: (margemS, progresso) => aplicarPausas(margemS, progresso),
  desfazer: () => desfazerPausas(),
  preparar: async () => {
    const sonda = await sondaDaV1();
    const parada = sonda === sondaVista;
    sondaVista = sonda;
    if (!parada || sonda === sondaTratada) return false;
    sondaTratada = sonda;
    if (await audioPronto()) return false;
    await lerAudio();
    return true;
  },
  guardarLog: (linhas) => guardarRegistro(linhas),
};
