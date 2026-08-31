/*
 * Monta src/autosplit-perfil.json a partir de:
 *  - scratch/_dims.json (w/h de cada arquivo, do frames.mjs)
 *  - o mapa CONCEITO abaixo, preenchido revisando os contact-sheets a olho
 *
 * Cada arquivo da biblioteca recebe uma entrada em porArquivo com o perfil do
 * seu conceito + as dimensoes reais. padraoPorConceito recebe o mesmo perfil,
 * pra cobrir take novo. O ajuste fino por arquivo e trabalho do "Aprender".
 *
 * Uso: node scripts/perfil.mjs
 */
import { readFile, writeFile } from "node:fs/promises";
import { join } from "node:path";

const raiz = process.cwd();
const dims = JSON.parse(await readFile(join(raiz, "scratch", "_dims.json"), "utf8"));

/** conceito -> { assunto, ancoraY, cropTopoExtra, nota } */
const CONCEITO = {
  "14.000 mil homens": { assunto: "aberto", ancoraY: 0.45, cropTopoExtra: 0, nota: "multidao/fila/mapa/colagem" },
  "Academia": { assunto: "pessoa", ancoraY: 0.40, cropTopoExtra: 0, nota: "homem na maquina de musculacao, corpo inteiro" },
  "Alívio Emocional": { assunto: "pessoa", ancoraY: 0.26, cropTopoExtra: 0, nota: "homem em pe na sala, rosto no terco de cima" },
  "Casal feliz": { assunto: "dupla", ancoraY: 0.33, cropTopoExtra: 0, nota: "casal, cabecas no meio-alto" },
  "Consulta médica": { assunto: "dupla", ancoraY: 0.24, cropTopoExtra: 0, nota: "paciente + medico sentados, rostos altos" },
  "Corpo do homem": { assunto: "aberto", ancoraY: 0.50, cropTopoExtra: 0, nota: "render anatomico do corpo/trato urinario" },
  "Cristiano": { assunto: "pessoa", ancoraY: 0.27, cropTopoExtra: 0, nota: "homem conversando, sentado" },
  "Desanimado": { assunto: "pessoa", ancoraY: 0.28, cropTopoExtra: 0, nota: "homem cabisbaixo, cama/janela/carro" },
  "Diabetes": { assunto: "pessoa", ancoraY: 0.22, cropTopoExtra: 0, nota: "homem medindo glicemia a mesa" },
  "Disposição": { assunto: "pessoa", ancoraY: 0.25, cropTopoExtra: 0, nota: "homem se espreguicando na cama" },
  "Doppler": { assunto: "aberto", ancoraY: 0.38, cropTopoExtra: 0, nota: "aparelho de ultrassom + diagrama" },
  "Doutor": { assunto: "pessoa", ancoraY: 0.22, cropTopoExtra: 0, nota: "medico a mesa, muitas vezes olhando papeis" },
  "Exames": { assunto: "aberto", ancoraY: 0.48, cropTopoExtra: 0, nota: "monitor de pressao + medidor + papeis na mesa" },
  "Falhou na cama": { assunto: "pessoa", ancoraY: 0.30, cropTopoExtra: 0, nota: "homem na beira da cama, noite, parceira atras" },
  "Frustrado": { assunto: "pessoa", ancoraY: 0.30, cropTopoExtra: 0, nota: "homem sentado, cabeca na mao" },
  "Hormônio": { assunto: "aberto", ancoraY: 0.45, cropTopoExtra: 0, nota: "coleta de sangue, maos com luva" },
  "Injetáveis": { assunto: "aberto", ancoraY: 0.45, cropTopoExtra: 0, nota: "seringas/frascos na mesa + academia" },
  "Jogando fora o viagra": { assunto: "aberto", ancoraY: 0.42, cropTopoExtra: 0.04, nota: "comprimidos no lixo, banheiro (teto claro)" },
  "Medicamento": { assunto: "aberto", ancoraY: 0.50, cropTopoExtra: 0, nota: "frascos de remedio + copo d'agua na mesa" },
  "Medida paliativa": { assunto: "aberto", ancoraY: 0.50, cropTopoExtra: 0, nota: "maos passando cartela de comprimidos azuis" },
  "Milhares de homens": { assunto: "aberto", ancoraY: 0.48, cropTopoExtra: 0, nota: "multidao na rua" },
  "Risco de infarto": { assunto: "pessoa", ancoraY: 0.30, cropTopoExtra: 0, nota: "pessoa levando a mao ao peito" },
  "Sala reservada": { assunto: "dupla", ancoraY: 0.32, cropTopoExtra: 0, nota: "cena de sofa/consulta" },
  "Separação": { assunto: "pessoa", ancoraY: 0.30, cropTopoExtra: 0, nota: "cena de separacao, homem com mala" },
  "Teleconsulta": { assunto: "pessoa", ancoraY: 0.25, cropTopoExtra: 0, nota: "homem em telechamada no celular/notebook" },
  "Vasos sanguíneos": { assunto: "aberto", ancoraY: 0.50, cropTopoExtra: 0, nota: "render de vaso sanguineo/placa" },
  "Viagra": { assunto: "pessoa", ancoraY: 0.26, cropTopoExtra: 0, nota: "homem com cartela/frasco, preocupado (as vezes so o objeto)" },
  "lifestyle": { assunto: "pessoa", ancoraY: 0.32, cropTopoExtra: 0, nota: "correndo/comendo saudavel/notebook no jardim" },
};

/** "Consulta médica (1).mp4" -> "Consulta médica" */
const conceito = (nome) => nome.replace(/\.[^.]+$/, "").replace(/\s*\(\d+\)\s*$/, "").trim();

const porArquivo = {};
const faltando = new Set();
for (const [nome, d] of Object.entries(dims)) {
  const c = conceito(nome);
  const base = CONCEITO[c];
  if (!base) {
    faltando.add(c);
    continue;
  }
  // `nota` NAO vai pro JSON: e identica por conceito, 251x redundante. Mora no
  // mapa CONCEITO acima (versionado), que e onde o conhecimento da analise vive.
  porArquivo[nome] = {
    assunto: base.assunto,
    ancoraY: base.ancoraY,
    cropTopoExtra: base.cropTopoExtra,
    w: d.w,
    h: d.h,
  };
}

if (faltando.size > 0) {
  console.error("conceitos sem mapa:", [...faltando]);
  process.exit(1);
}

const padraoPorConceito = {};
for (const [c, base] of Object.entries(CONCEITO)) {
  padraoPorConceito[c] = { assunto: base.assunto, ancoraY: base.ancoraY, cropTopoExtra: base.cropTopoExtra };
}

const perfil = { versao: 1, padraoPorConceito, porArquivo };
await writeFile(join(raiz, "src", "autosplit-perfil.json"), JSON.stringify(perfil, null, 2) + "\n");
console.log(`${Object.keys(porArquivo).length} arquivos, ${Object.keys(padraoPorConceito).length} conceitos`);
