// Gera o XML de prova para importar no Premiere (Fase 0). Uso:
//   node scripts/prova-xml.ts
// Cada item da lista CONFERIR e uma coisa que o gerador precisa acertar.
import { writeFile, mkdir } from "node:fs/promises";
import { join } from "node:path";

import { sondar } from "../src/motor/midia.ts";
import { sequenciaParaXml, type Midia } from "../src/xml.ts";

const FPS = 25;
const BRUTA = "C:\\Edição\\2. Androclinic\\1. AndroClinic\\Andro 19.09\\Brutas\\C1639.mp4";
const BROLL = "C:\\Users\\leogi\\Downloads\\Brolls - 2026\\Consulta médica (1).mp4";
const TRILHA = "C:\\Users\\leogi\\Downloads\\The Horror Piano (wav).wav";

async function midia(caminho: string): Promise<Midia> {
  const i = await sondar(caminho);
  return {
    caminho,
    duracaoQ: Math.floor(i.duracaoS * FPS),
    ...(i.largura !== null && i.altura !== null ? { largura: i.largura, altura: i.altura } : {}),
    canais: i.canais,
  };
}

const [bruta, broll, trilha] = await Promise.all([midia(BRUTA), midia(BROLL), midia(TRILHA)]);
const q = (s: number): number => Math.round(s * FPS);

// Tres trechos da variacao 1 (mesmos pontos do projeto Andro 19.09).
const trechos = [
  { entrada: q(3.44), dur: q(2.52) },
  { entrada: q(6.32), dur: q(3.04) },
  { entrada: q(9.88), dur: q(3.12) },
];
let t = 0;
const v1 = trechos.map((tr, i) => {
  const c = { midia: bruta, inicioQ: t, fimQ: t + tr.dur, entradaQ: tr.entrada, escala: 90, grupo: `v${i}` };
  t += tr.dur;
  return c;
});
const fim = t;

const xml = sequenciaParaXml({
  nome: "PROVA Pro Edition",
  fps: FPS,
  largura: 1080,
  altura: 1920,
  video: [
    [v1[0]!, { ...v1[1]!, deslocamento: { x: 270, y: 0 } }, { ...v1[2]!, flop: true }],
    [{ midia: broll, inicioQ: v1[1]!.inicioQ, fimQ: v1[1]!.fimQ, entradaQ: 0, escala: 150, recorte: { esquerda: 0, direita: 0, topo: 50, base: 0 } }],
    [{ ...v1[0]!, ativo: false, grupo: "desligado" }],
  ],
  audio: [
    v1.map((c) => ({ midia: bruta, inicioQ: c.inicioQ, fimQ: c.fimQ, entradaQ: c.entradaQ, grupo: c.grupo })),
    [{ midia: trilha, inicioQ: 0, fimQ: fim, entradaQ: 0, ganhoDb: -12 }],
  ],
  cruzamentos: [
    { trilha: 0, emQ: v1[1]!.inicioQ, duracaoQ: 2 },
    { trilha: 0, emQ: v1[2]!.inicioQ, duracaoQ: 2 },
  ],
});

const pasta = join(import.meta.dirname, "..", "prova");
await mkdir(pasta, { recursive: true });
const saida = join(pasta, "PROVA-Pro-Edition.xml");
await writeFile(saida, xml, "utf8");
console.log(saida);
