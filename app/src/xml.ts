/*
 * Sequencia -> XML do Final Cut Pro 7 (xmeml v4), o formato que o Premiere
 * abre em Arquivo > Importar e transforma numa sequencia pronta.
 *
 * E a unica ponte do programa com a timeline: fora do Premiere nao ha API,
 * entao cada ferramenta monta uma `Sequencia` e este arquivo escreve.
 *
 * Puro: nao le disco, nao conhece o Electron. Tempo sempre em QUADROS da
 * sequencia (sufixo Q, como no Auto Pausas).
 */

import { pathToFileURL } from "node:url";

export interface Midia {
  readonly caminho: string;
  /** Duracao do arquivo, em quadros da sequencia. */
  readonly duracaoQ: number;
  /** Presentes quando o arquivo tem video. */
  readonly largura?: number;
  readonly altura?: number;
  /** 0 = sem audio. */
  readonly canais: number;
}

export interface Clipe {
  readonly midia: Midia;
  readonly inicioQ: number;
  readonly fimQ: number;
  /** Quadro do ARQUIVO que aparece em `inicioQ`. */
  readonly entradaQ: number;
  /** false = clipe desligado (Podcast AutoCut alterna cameras assim). */
  readonly ativo?: boolean;
  /** Escala em %, como no painel Controles de efeito. */
  readonly escala?: number;
  /** Deslocamento do centro, em pixels da sequencia (+x direita, +y baixo). */
  readonly deslocamento?: { readonly x: number; readonly y: number };
  /** Espelha na horizontal. */
  readonly flop?: boolean;
  /** Corte das bordas, em % de cada lado. */
  readonly recorte?: {
    readonly esquerda: number;
    readonly direita: number;
    readonly topo: number;
    readonly base: number;
  };
  readonly ganhoDb?: number;
  /** Clipes com o mesmo grupo ficam vinculados (video e audio andam juntos). */
  readonly grupo?: string;
}

export interface Cruzamento {
  /** Indice da trilha de audio (0 = A1). */
  readonly trilha: number;
  /** Quadro do corte; o crossfade fica centrado nele. */
  readonly emQ: number;
  readonly duracaoQ: number;
}

export interface Sequencia {
  readonly nome: string;
  readonly fps: number;
  readonly largura: number;
  readonly altura: number;
  /** V1, V2... */
  readonly video: readonly (readonly Clipe[])[];
  /** A1, A2... */
  readonly audio: readonly (readonly Clipe[])[];
  readonly cruzamentos?: readonly Cruzamento[];
}

const esc = (s: string): string =>
  s.replace(/&/g, "&amp;").replace(/</g, "&lt;").replace(/>/g, "&gt;").replace(/"/g, "&quot;");

const nomeDe = (caminho: string): string => caminho.split(/[\\/]/).pop() ?? caminho;

/** "C:\Edição\a b.mp4" -> "file://localhost/C:/Edi%C3%A7%C3%A3o/a%20b.mp4" */
export function urlDoArquivo(caminho: string): string {
  const href = /^[A-Za-z]:[\\/]/.test(caminho)
    ? pathToFileURL(caminho, { windows: true }).href
    : pathToFileURL(caminho).href;
  return href.replace(/^file:\/\/\//, "file://localhost/");
}

/** dB -> ganho linear do filtro Audio Levels (1 = 0 dB). */
export const ganhoLinear = (db: number): number => Math.pow(10, db / 20);

function taxa(fps: number): string {
  return `<rate><timebase>${Math.round(fps)}</timebase><ntsc>${Number.isInteger(fps) ? "FALSE" : "TRUE"}</ntsc></rate>`;
}

function parametro(id: string, nome: string, valor: string, min?: number, max?: number): string {
  const limites = min === undefined || max === undefined ? "" : `<valuemin>${min}</valuemin><valuemax>${max}</valuemax>`;
  return `<parameter><parameterid>${id}</parameterid><name>${nome}</name>${limites}<value>${valor}</value></parameter>`;
}

function efeito(nome: string, id: string, categoria: string, tipo: string, midia: string, params: string): string {
  return (
    `<effect><name>${nome}</name><effectid>${id}</effectid><effectcategory>${categoria}</effectcategory>` +
    `<effecttype>${tipo}</effecttype><mediatype>${midia}</mediatype>${params}</effect>`
  );
}

function filtrosDeVideo(c: Clipe, s: Sequencia): string {
  const filtros: string[] = [];
  if (c.escala !== undefined || c.deslocamento !== undefined) {
    const d = c.deslocamento ?? { x: 0, y: 0 };
    // ponytail: centro normalizado pela largura/altura inteira da sequencia;
    // conferir na prova (Posicao no painel) e trocar para meia largura se errar.
    const centro = `<horiz>${d.x / s.largura}</horiz><vert>${d.y / s.altura}</vert>`;
    filtros.push(
      efeito(
        "Basic Motion",
        "basic",
        "motion",
        "motion",
        "video",
        parametro("scale", "Scale", String(c.escala ?? 100), 0, 1000) + parametro("center", "Center", centro)
      )
    );
  }
  if (c.recorte !== undefined) {
    const r = c.recorte;
    filtros.push(
      efeito(
        "Crop",
        "crop",
        "motion",
        "motion",
        "video",
        parametro("left", "left", String(r.esquerda), 0, 100) +
          parametro("right", "right", String(r.direita), 0, 100) +
          parametro("top", "top", String(r.topo), 0, 100) +
          parametro("bottom", "bottom", String(r.base), 0, 100)
      )
    );
  }
  if (c.flop === true) filtros.push(efeito("Flop", "Flop", "Perspective", "filter", "video", ""));
  return filtros.map((f) => `<filter>${f}</filter>`).join("");
}

function filtrosDeAudio(c: Clipe): string {
  if (c.ganhoDb === undefined) return "";
  const nivel = parametro("level", "Level", ganhoLinear(c.ganhoDb).toFixed(6), 0.00003, 31.6228);
  return `<filter>${efeito("Audio Levels", "audiolevels", "audiolevels", "audiolevels", "audio", nivel)}</filter>`;
}

interface Posicao {
  readonly id: string;
  readonly tipo: "video" | "audio";
  readonly trilha: number;
  readonly indice: number;
}

export function sequenciaParaXml(s: Sequencia): string {
  const erros = validarSequencia(s);
  if (erros.length > 0) throw new RangeError(`sequencia invalida: ${erros.join("; ")}`);

  // Ids e posicoes de todos os clipes antes de escrever: o <link> de um
  // clipe de video aponta para o audio que ainda vem la embaixo.
  let n = 0;
  const posicoes = new Map<Clipe, Posicao>();
  const grupos = new Map<string, Posicao[]>();
  const registrar = (tipo: "video" | "audio", trilhas: Sequencia["video"]): void =>
    trilhas.forEach((trilha, t) =>
      trilha.forEach((c, i) => {
        const p: Posicao = { id: `clipitem-${++n}`, tipo, trilha: t + 1, indice: i + 1 };
        posicoes.set(c, p);
        if (c.grupo !== undefined) grupos.set(c.grupo, [...(grupos.get(c.grupo) ?? []), p]);
      })
    );
  registrar("video", s.video);
  registrar("audio", s.audio);

  const arquivos = new Map<string, string>();
  const arquivo = (m: Midia): string => {
    const id = arquivos.get(m.caminho);
    if (id !== undefined) return `<file id="${id}"/>`;
    const novo = `file-${arquivos.size + 1}`;
    arquivos.set(m.caminho, novo);
    const video =
      m.largura !== undefined && m.altura !== undefined
        ? `<video><samplecharacteristics>${taxa(s.fps)}<width>${m.largura}</width><height>${m.altura}</height>` +
          `<anamorphic>FALSE</anamorphic><pixelaspectratio>square</pixelaspectratio><fielddominance>none</fielddominance></samplecharacteristics></video>`
        : "";
    const audio =
      m.canais > 0
        ? `<audio><samplecharacteristics><depth>16</depth><samplerate>48000</samplerate></samplecharacteristics><channelcount>${m.canais}</channelcount></audio>`
        : "";
    return (
      `<file id="${novo}"><name>${esc(nomeDe(m.caminho))}</name><pathurl>${esc(urlDoArquivo(m.caminho))}</pathurl>` +
      `${taxa(s.fps)}<duration>${m.duracaoQ}</duration><media>${video}${audio}</media></file>`
    );
  };

  const clipe = (c: Clipe): string => {
    const p = posicoes.get(c);
    if (p === undefined) throw new Error("clipe sem posicao");
    const links =
      c.grupo === undefined
        ? ""
        : (grupos.get(c.grupo) ?? [])
            .map(
              (l) =>
                `<link><linkclipref>${l.id}</linkclipref><mediatype>${l.tipo}</mediatype>` +
                `<trackindex>${l.trilha}</trackindex><clipindex>${l.indice}</clipindex></link>`
            )
            .join("");
    const fonte = p.tipo === "audio" ? `<sourcetrack><mediatype>audio</mediatype><trackindex>1</trackindex></sourcetrack>` : "";
    return (
      `<clipitem id="${p.id}"><name>${esc(nomeDe(c.midia.caminho))}</name>` +
      `<enabled>${c.ativo === false ? "FALSE" : "TRUE"}</enabled><duration>${c.midia.duracaoQ}</duration>${taxa(s.fps)}` +
      `<start>${c.inicioQ}</start><end>${c.fimQ}</end><in>${c.entradaQ}</in><out>${c.entradaQ + (c.fimQ - c.inicioQ)}</out>` +
      arquivo(c.midia) +
      fonte +
      (p.tipo === "video" ? filtrosDeVideo(c, s) : filtrosDeAudio(c)) +
      links +
      `</clipitem>`
    );
  };

  const cruzamento = (x: Cruzamento): string => {
    const inicio = x.emQ - Math.floor(x.duracaoQ / 2);
    return (
      `<transitionitem>${taxa(s.fps)}<start>${inicio}</start><end>${inicio + x.duracaoQ}</end>` +
      `<alignment>center</alignment>` +
      efeito("Cross Fade (+3dB)", "KGAudioTransCrossFade3dB", "", "transition", "audio", "") +
      `</transitionitem>`
    );
  };

  const duracao = Math.max(0, ...[...s.video, ...s.audio].flat().map((c) => c.fimQ));
  const trilhasVideo = s.video.map((t) => `<track>${t.map(clipe).join("")}</track>`).join("");
  const trilhasAudio = s.audio
    .map((t, i) => {
      const xs = (s.cruzamentos ?? []).filter((x) => x.trilha === i).map(cruzamento).join("");
      return `<track>${t.map(clipe).join("")}${xs}</track>`;
    })
    .join("");

  return (
    `<?xml version="1.0" encoding="UTF-8"?>\n<!DOCTYPE xmeml>\n<xmeml version="4">` +
    `<sequence id="sequence-1"><name>${esc(s.nome)}</name><duration>${duracao}</duration>${taxa(s.fps)}` +
    `<media><video><format><samplecharacteristics>${taxa(s.fps)}<width>${s.largura}</width><height>${s.altura}</height>` +
    `<anamorphic>FALSE</anamorphic><pixelaspectratio>square</pixelaspectratio><fielddominance>none</fielddominance>` +
    `</samplecharacteristics></format>${trilhasVideo}</video>` +
    `<audio><numOutputChannels>2</numOutputChannels><format><samplecharacteristics><depth>16</depth>` +
    `<samplerate>48000</samplerate></samplecharacteristics></format>${trilhasAudio}</audio></media>` +
    `</sequence></xmeml>\n`
  );
}

/** O que o Premiere recusaria ou abriria torto. Vazio = pode escrever. */
export function validarSequencia(s: Sequencia): string[] {
  const erros: string[] = [];
  const trilhas: Array<[string, readonly Clipe[]]> = [
    ...s.video.map((t, i): [string, readonly Clipe[]] => [`V${i + 1}`, t]),
    ...s.audio.map((t, i): [string, readonly Clipe[]] => [`A${i + 1}`, t]),
  ];
  for (const [nome, trilha] of trilhas) {
    let fimAnterior = 0;
    trilha.forEach((c, i) => {
      const onde = `${nome} clipe ${i + 1}`;
      if (!Number.isInteger(c.inicioQ) || !Number.isInteger(c.fimQ) || !Number.isInteger(c.entradaQ)) {
        erros.push(`${onde}: tempo fora de quadro inteiro`);
      }
      if (c.fimQ <= c.inicioQ) erros.push(`${onde}: termina antes de comecar`);
      if (c.inicioQ < fimAnterior) erros.push(`${onde}: sobrepoe o clipe anterior`);
      if (c.entradaQ < 0 || c.entradaQ + (c.fimQ - c.inicioQ) > c.midia.duracaoQ) {
        erros.push(`${onde}: pede trecho fora do arquivo`);
      }
      fimAnterior = c.fimQ;
    });
  }
  return erros;
}
