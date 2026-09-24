/*
 * XML do Final Cut Pro 7 (o que o Premiere exporta em Arquivo > Exportar >
 * Final Cut Pro XML) -> Sequencia. O caminho de volta de xml.ts.
 *
 * E a entrada de toda ferramenta que trabalha sobre a sequencia que o Leo ja
 * montou: ele exporta, o programa le, mexe e devolve outro XML.
 *
 * Puro. O parser e minimo de proposito: o XML vem de uma maquina (Premiere ou
 * xml.ts), sem DTD, sem CDATA relevante — so elementos, atributos e texto.
 */

import { fileURLToPath } from "node:url";

import type { Clipe, Midia, Sequencia } from "./xml.ts";

export interface No {
  readonly nome: string;
  readonly atributos: Readonly<Record<string, string>>;
  readonly filhos: No[];
  texto: string;
}

const ENTIDADES: Record<string, string> = { amp: "&", lt: "<", gt: ">", quot: '"', apos: "'" };
const desescapar = (s: string): string =>
  s.replace(/&(#x[0-9a-f]+|#\d+|\w+);/gi, (m, e: string) =>
    e[0] === "#"
      ? String.fromCodePoint(e[1]?.toLowerCase() === "x" ? parseInt(e.slice(2), 16) : parseInt(e.slice(1), 10))
      : (ENTIDADES[e] ?? m)
  );

export function lerXml(texto: string): No {
  const raiz: No = { nome: "#raiz", atributos: {}, filhos: [], texto: "" };
  const pilha: No[] = [raiz];
  const tag = /<(\/?)([A-Za-z_][\w.:-]*)((?:\s+[\w.:-]+\s*=\s*(?:"[^"]*"|'[^']*'))*)\s*(\/?)>|<!--[\s\S]*?-->|<\?[\s\S]*?\?>|<![^>]*>|<!\[CDATA\[([\s\S]*?)\]\]>/g;
  let fim = 0;
  for (let m = tag.exec(texto); m !== null; m = tag.exec(texto)) {
    const topo = pilha[pilha.length - 1]!;
    topo.texto += desescapar(texto.slice(fim, m.index));
    fim = tag.lastIndex;
    if (m[5] !== undefined) {
      topo.texto += m[5];
      continue;
    }
    if (m[2] === undefined) continue; // comentario, <?xml?>, <!DOCTYPE>
    if (m[1] === "/") {
      if (topo.nome !== m[2]) throw new Error(`XML quebrado: </${m[2]}> fecha <${topo.nome}>`);
      pilha.pop();
      continue;
    }
    const atributos: Record<string, string> = {};
    for (const a of (m[3] ?? "").matchAll(/([\w.:-]+)\s*=\s*(?:"([^"]*)"|'([^']*)')/g)) {
      atributos[a[1]!] = desescapar(a[2] ?? a[3] ?? "");
    }
    const no: No = { nome: m[2], atributos, filhos: [], texto: "" };
    topo.filhos.push(no);
    if (m[4] !== "/") pilha.push(no);
  }
  if (pilha.length !== 1) throw new Error(`XML quebrado: <${pilha[pilha.length - 1]!.nome}> sem fechar`);
  return raiz;
}

const filho = (no: No | undefined, nome: string): No | undefined => no?.filhos.find((f) => f.nome === nome);
const filhos = (no: No | undefined, nome: string): No[] => no?.filhos.filter((f) => f.nome === nome) ?? [];
const caminho = (no: No | undefined, ...nomes: string[]): No | undefined => nomes.reduce(filho, no);
const texto = (no: No | undefined, ...nomes: string[]): string | undefined => caminho(no, ...nomes)?.texto.trim();
const numero = (no: No | undefined, ...nomes: string[]): number | undefined => {
  const t = texto(no, ...nomes);
  return t === undefined || t === "" ? undefined : Number(t);
};

/** "file://localhost/C:/a%20b.mp4" -> "C:\a b.mp4" */
export function caminhoDaUrl(url: string): string {
  const u = url.trim().replace(/^file:\/\/localhost\//i, "file:///");
  // O Premiere as vezes escreve "C%3a" no lugar de "C:".
  return fileURLToPath(u.replace(/^file:\/\/\/([A-Za-z])%3a/i, "file:///$1:"), { windows: /^file:\/\/\/[A-Za-z]:/i.test(u) || /%3a/i.test(u) });
}

function fpsDe(rate: No | undefined): number | undefined {
  const base = numero(rate, "timebase");
  if (base === undefined) return undefined;
  return texto(rate, "ntsc")?.toUpperCase() === "TRUE" ? (base * 1000) / 1001 : base;
}

export interface SequenciaLida extends Sequencia {
  /** O que foi ignorado e por que, para o programa avisar em vez de sumir com algo. */
  readonly avisos: string[];
}

/** Le a PRIMEIRA sequencia do arquivo (o Premiere exporta uma por vez). */
export function lerSequenciaXml(conteudo: string): SequenciaLida {
  const raiz = lerXml(conteudo);
  const xmeml = filho(raiz, "xmeml");
  const seq = filho(xmeml, "sequence") ?? filho(filho(xmeml, "project"), "children")?.filhos.find((f) => f.nome === "sequence");
  if (seq === undefined) throw new Error("Este XML não tem sequência. No Premiere: selecione a sequência e use Arquivo > Exportar > Final Cut Pro XML.");

  const avisos: string[] = [];
  const fps = fpsDe(filho(seq, "rate")) ?? 25;
  const formato = caminho(seq, "media", "video", "format", "samplecharacteristics");

  // <file> completo aparece uma vez; depois so <file id="..."/>.
  const arquivos = new Map<string, Midia>();
  const midiaDe = (item: No): Midia | undefined => {
    const f = filho(item, "file");
    if (f === undefined) return undefined;
    const id = f.atributos.id ?? "";
    const url = texto(f, "pathurl");
    if (url !== undefined && url !== "") {
      const largura = numero(f, "media", "video", "samplecharacteristics", "width");
      const altura = numero(f, "media", "video", "samplecharacteristics", "height");
      const m: Midia = {
        caminho: caminhoDaUrl(url),
        duracaoQ: numero(f, "duration") ?? 0,
        ...(largura !== undefined && altura !== undefined ? { largura, altura } : {}),
        canais: numero(f, "media", "audio", "channelcount") ?? (filho(caminho(f, "media"), "audio") ? 2 : 0),
      };
      arquivos.set(id, m);
    }
    return arquivos.get(id);
  };

  const efeitos = (item: No): No[] => filhos(item, "filter").flatMap((f) => filhos(f, "effect"));
  const parametro = (ef: No, id: string): No | undefined =>
    filhos(ef, "parameter").find((p) => texto(p, "parameterid") === id);

  const clipe = (item: No, tipo: "video" | "audio", t: number, i: number): Clipe | undefined => {
    const nome = texto(item, "name") ?? `${tipo} ${t + 1}.${i + 1}`;
    const m = midiaDe(item);
    const inicio = numero(item, "start");
    const fimQ = numero(item, "end");
    const entrada = numero(item, "in");
    if (m === undefined) {
      avisos.push(`${nome}: sem arquivo (gráfico, título ou sequência aninhada) — ignorado`);
      return undefined;
    }
    if (inicio === undefined || fimQ === undefined || entrada === undefined || inicio < 0 || fimQ < 0) {
      // start/end -1 = o clipe encosta numa transicao; o tempo real fica nela.
      avisos.push(`${nome}: tempo preso a uma transição — ignorado`);
      return undefined;
    }
    const video = tipo === "video" ? efeitos(item) : [];
    const movimento = video.find((e) => texto(e, "effectid") === "basic");
    const escala = movimento ? numero(parametro(movimento, "scale"), "value") : undefined;
    const centro = movimento ? caminho(parametro(movimento, "center"), "value") : undefined;
    const recorte = video.find((e) => texto(e, "effectid") === "crop");
    const nivel = efeitos(item).find((e) => texto(e, "effectid") === "audiolevels");
    const ganho = nivel ? numero(parametro(nivel, "level"), "value") : undefined;
    const valor = (ef: No, id: string): number => numero(parametro(ef, id), "value") ?? 0;
    const links = filhos(item, "link").map((l) => texto(l, "linkclipref")).filter((x): x is string => x !== undefined);
    return {
      midia: m,
      inicioQ: inicio,
      fimQ,
      entradaQ: entrada,
      ...(texto(item, "enabled")?.toUpperCase() === "FALSE" ? { ativo: false } : {}),
      ...(escala !== undefined ? { escala } : {}),
      ...(centro !== undefined
        ? {
            deslocamento: {
              x: (numero(centro, "horiz") ?? 0) * (m.largura ?? numero(formato, "width") ?? 1080),
              y: (numero(centro, "vert") ?? 0) * (m.altura ?? numero(formato, "height") ?? 1920),
            },
          }
        : {}),
      ...(video.some((e) => texto(e, "effectid")?.toLowerCase() === "flop") ? { flop: true } : {}),
      ...(recorte
        ? {
            recorte: {
              esquerda: valor(recorte, "left"),
              direita: valor(recorte, "right"),
              topo: valor(recorte, "top"),
              base: valor(recorte, "bottom"),
              ...(parametro(recorte, "edgefeather") ? { suavizar: valor(recorte, "edgefeather") } : {}),
            },
          }
        : {}),
      ...(ganho !== undefined && ganho > 0 ? { ganhoDb: 20 * Math.log10(ganho) } : {}),
      // O grupo e o menor id entre os vinculados: video e audio do mesmo par caem no mesmo.
      ...(links.length > 0 ? { grupo: [...links].sort()[0]! } : {}),
    };
  };

  const trilhas = (tipo: "video" | "audio"): Clipe[][] =>
    filhos(caminho(seq, "media", tipo), "track").map((tr, t) =>
      filhos(tr, "clipitem")
        .map((item, i) => clipe(item, tipo, t, i))
        .filter((c): c is Clipe => c !== undefined)
        .sort((a, b) => a.inicioQ - b.inicioQ)
    );

  return {
    nome: texto(seq, "name") ?? "Sequência",
    fps,
    largura: numero(formato, "width") ?? 1080,
    altura: numero(formato, "height") ?? 1920,
    video: trilhas("video"),
    audio: trilhas("audio"),
    avisos,
  };
}
