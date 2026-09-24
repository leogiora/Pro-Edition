// Sequencia de teste do botao Editar: as variacoes 1 e 2 do Andro 19.09 ainda
// brutas (com pausas), separadas como o Leo deixa antes do Auto Pausas, com
// zoom 90 (e a 2a deslocada) para conferir que o enquadramento acompanha.
//   node scripts/teste-editar.ts <saida.xml>
import { writeFile } from "node:fs/promises";

import { sondar } from "../src/motor/midia.ts";
import { sequenciaParaXml, type Clipe } from "../src/xml.ts";

const FPS = 25;
const BRUTA = "C:/Edição/2. Androclinic/1. AndroClinic/Andro 19.09/Brutas/C1639.mp4";
const i = await sondar(BRUTA);
const midia = { caminho: BRUTA, duracaoQ: Math.floor(i.duracaoS * FPS), largura: i.largura!, altura: i.altura!, canais: i.canais };
const q = (s: number): number => Math.round(s * FPS);

const trechos = [
  { inicioQ: 0, fimQ: q(77), entradaQ: q(3) },
  { inicioQ: q(80), fimQ: q(180), entradaQ: q(82.5) },
];
const video: Clipe[] = trechos.map((t, k) => ({
  midia,
  ...t,
  escala: 90,
  ...(k === 1 ? { deslocamento: { x: 128, y: 0 } } : {}),
  grupo: `g${k}`,
}));
const audio: Clipe[] = trechos.map((t, k) => ({ midia, ...t, grupo: `g${k}` }));

const saida = process.argv[2] ?? "teste-editar.xml";
await writeFile(saida, sequenciaParaXml({ nome: "TESTE Editar", fps: FPS, largura: 1080, altura: 1920, video: [video], audio: [audio] }), "utf8");
console.log(saida);
