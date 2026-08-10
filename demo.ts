/*
 * Passa uma fala de exemplo pelo pipeline inteiro e imprime os blocos.
 * Descartavel: serve para olhar a saida real, nao substitui os testes.
 */

import { segmentar } from "./src/segmentar.ts";
import {
  corrigirEAcento,
  corrigirPorques,
  normalizarColoquial,
  protegerTermos,
  type PalavraRevisada,
} from "./src/texto.ts";
import { PRESET_PADRAO } from "./src/preset.ts";

function palavras(frase: string): PalavraRevisada[] {
  return frase.split(" ").map((bruto, i) => {
    const eos = bruto.endsWith("|");
    return {
      text: eos ? bruto.slice(0, -1) : bruto,
      inicio: i,
      fim: i + 1,
      confidence: 1,
      eos,
      sugestao: null,
      motivo: null,
    };
  });
}

const bruto =
  "Meu nome e Cristiano Equivalente| " +
  "Para você entender, eu estava falando para o paciente| " +
  "Essa consulta que era mil hoje está por cento e noventa e sete|";

let ps = palavras(bruto);
ps = protegerTermos(ps, PRESET_PADRAO);
ps = normalizarColoquial(ps);
ps = corrigirEAcento(ps);
ps = corrigirPorques(ps);

for (const b of segmentar(ps, [], PRESET_PADRAO)) {
  const marca = b.estilo === "preco" ? "PRECO" : "     ";
  const rev = b.precisaRevisao ? `  <- ${b.motivos.join("; ")}` : "";
  console.log(`${marca} [${String(b.texto.length).padStart(2)}] ${b.texto}${rev}`);
}
