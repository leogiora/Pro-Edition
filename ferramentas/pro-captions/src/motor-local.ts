/*
 * Motor do Captions dentro do plugin: ouve a fala (ElevenLabs ou a
 * transcricao do Premiere), monta as legendas no padrao, grava os .srt e poe
 * na timeline pela ponte. Era o corpo do painel antigo (ui/mount.ts); a tela
 * agora so pede (motor local no painel, remoto pela ponte no programa).
 * Nada aqui toca no DOM.
 */

import { irPara } from "../../auto-broll/src/premiere.ts";
import { audioMudo, duracaoDoWav } from "./audio.ts";
import type { AndamentoCaptions, MotorCaptions, RegistrarCaptions, ResultadoCaptions, TomCaptions } from "./captions.ts";
import { relogio } from "./domain.ts";
import { assinaturaDoAudio, palavrasDoElevenLabs, termosChave } from "./elevenlabs.ts";
import { transcreverNoElevenLabs } from "./elevenlabs-rede.ts";
import { blocosParaSrt, gerarBlocos } from "./pipeline.ts";
import {
  apagarArquivo,
  comLimite,
  exportarAudioDaSequencia,
  getSequenceInfo,
  gravarLog,
  guardarTranscricao,
  legendasNaTimeline,
  lerChaveElevenLabs,
  lerClipes,
  lerCortes,
  lerEmpresa,
  lerTranscricaoGuardada,
  lerTranscricoes,
  salvarChaveElevenLabs,
  salvarSrt,
} from "./premiere.ts";
import { EMPRESAS, PRESET_PADRAO, presetDa, type Preset } from "./preset.ts";
import { validar } from "./segmentar.ts";
import { parseTranscricao, reconstruirTranscricao, type PalavraEditada, type TranscricaoOrigem } from "./transcript.ts";

/** Para onde vai cada linha da acao em curso (a tela do painel ou a ponte). */
let saida: RegistrarCaptions = () => undefined;
let andamento: AndamentoCaptions = () => undefined;
/** Espelho do registro em texto: o painel nao deixa copiar, o arquivo deixa. */
let linhas: string[] = [];

function registrar(texto: string, tom: TomCaptions = "passo"): void {
  linhas.push(texto);
  saida(texto, tom);
}

/** O que o nucleo precisa para montar as legendas, venha a fala de onde vier. */
interface Entrada {
  readonly cortes: number[];
  readonly palavras: PalavraEditada[];
  readonly preset: Preset;
  readonly reaproveitada: boolean;
  readonly avisoFala: string | null;
}

/** Caminho sem ElevenLabs: a transcricao que o proprio Premiere fez de cada midia. */
async function lerTudo(): Promise<Entrada> {
  const clipes = await comLimite("clipes", lerClipes(0));
  const cortes = await comLimite("cortes", lerCortes(0));
  registrar(`V1: ${clipes.length} clipes · ${cortes.length} cortes`);

  andamento(1, "Lendo a transcrição do Premiere");
  const { transcricoes: brutas, falhas } = await comLimite(
    "transcricoes",
    lerTranscricoes(clipes.map((c) => c.sourceName)),
    60000
  );
  registrar(`${brutas.size} midias com transcricao`);
  for (const f of falhas) registrar(`"${f.nome}": ${f.motivo}`, "aviso");

  const mapa = new Map<string, TranscricaoOrigem>();
  for (const [midia, json] of brutas) {
    const t = parseTranscricao(json);
    if (t) mapa.set(midia, t);
    else registrar(`transcricao ilegivel: ${midia}`, "aviso");
  }

  const palavras = reconstruirTranscricao(clipes, mapa);
  registrar(`${palavras.length} palavras no corte final (transcricao do Premiere)`);
  return { cortes, palavras, preset: PRESET_PADRAO, reaproveitada: false, avisoFala: null };
}

/**
 * Caminho com ElevenLabs: ele ouve o audio da sequencia inteira.
 *
 * O plugin exporta o audio sozinho (mesmo metodo do Auto Pausas), manda para
 * o ElevenLabs e guarda a resposta. Gerar de novo com o mesmo audio nao paga
 * de novo: a resposta guardada e reaproveitada.
 */
async function lerComElevenLabs(): Promise<Entrada> {
  const chave = await comLimite("chave", lerChaveElevenLabs());
  if (!chave) {
    throw new Error("Sem chave do ElevenLabs. Cole a chave e salve, ou use a transcrição do Premiere.");
  }

  const cortes = await comLimite("cortes", lerCortes(0));
  registrar(`V1: ${cortes.length} cortes`);
  const empresa = await comLimite("empresa", lerEmpresa());
  const preset = presetDa(empresa);
  registrar(`termos de ${EMPRESAS[empresa].nome} (troca no AutoEdit)`);

  andamento(0, "Exportando o áudio da sequência");
  const audio = await comLimite("exportar o áudio", exportarAudioDaSequencia(), 10 * 60 * 1000);
  let json: string | null;
  let reaproveitada = false;
  try {
    const duracao = duracaoDoWav(audio.bytes);
    registrar(
      `áudio: ${duracao === null ? "?" : relogio(duracao)} · ` +
        `${(audio.bytes.byteLength / 1e6).toFixed(1)} MB · exportado em ${(audio.ms / 1000).toFixed(1)} s`
    );

    if (audioMudo(audio.bytes)) {
      throw new Error(
        "O áudio exportado da sequência está mudo — nada foi enviado ao ElevenLabs. " +
          "Confira se a faixa de áudio da fala (A1) não está silenciada (M) ou com outra faixa em solo (S)."
      );
    }

    const assinatura = assinaturaDoAudio(audio.bytes);
    json = await comLimite("transcrição guardada", lerTranscricaoGuardada(assinatura));
    if (json !== null) {
      reaproveitada = true;
      registrar("mesmo áudio de antes: transcrição reaproveitada, sem custo", "ok");
    } else {
      andamento(1, "O ElevenLabs está ouvindo");
      const termos = termosChave(preset);
      registrar(`enviando ao ElevenLabs (${termos.length} termos-chave)…`);
      const t0 = Date.now();
      json = await comLimite("ElevenLabs", transcreverNoElevenLabs(audio.bytes, chave, termos, (t) => registrar(t)), 15 * 60 * 1000);
      registrar(`ElevenLabs respondeu em ${((Date.now() - t0) / 1000).toFixed(0)} s`, "ok");
      const guardado = await comLimite("guardar transcrição", guardarTranscricao(assinatura, json));
      registrar(`resposta guardada em ${guardado}`);
    }
  } finally {
    // O WAV so serviu para o envio; nao deixar 50 MB sobrando por video.
    await apagarArquivo(audio.caminho).catch(() => undefined);
  }

  const palavras = palavrasDoElevenLabs(json);
  if (palavras === null) throw new Error("A resposta do ElevenLabs não é JSON legível.");
  registrar(`${palavras.length} palavras ouvidas pelo ElevenLabs`);
  // Clipe de audio mudo so silencia o trecho dele (Andro 19.09, 29/09: variacoes
  // 11-20 mudas, a fala parou em 11:33 de 23:22), e o audioMudo nao pega.
  const ultimaFala = palavras[palavras.length - 1]?.fim ?? 0;
  const ultimoClipe = Math.max(0, ...cortes);
  const avisoFala =
    ultimoClipe - ultimaFala > 60
      ? `A fala acaba em ${relogio(ultimaFala)} e a V1 vai até ${relogio(ultimoClipe)}: clipe de áudio mudo nesse trecho? Ali fica sem legenda.`
      : null;
  if (avisoFala) registrar(avisoFala, "aviso");
  return { cortes, palavras, preset, reaproveitada, avisoFala };
}

async function gerar(usarEleven: boolean, para: RegistrarCaptions, etapas: AndamentoCaptions): Promise<ResultadoCaptions> {
  linhas = [];
  saida = para;
  andamento = etapas;
  try {
    const info = await comLimite("sequencia", getSequenceInfo());
    registrar(`${info.name} · ${usarEleven ? "ElevenLabs" : "transcrição do Premiere"}`);
    const ent = usarEleven ? await lerComElevenLabs() : await lerTudo();
    if (ent.palavras.length === 0) {
      throw new Error(
        usarEleven
          ? "O ElevenLabs não ouviu nenhuma palavra. O áudio da sequência está mudo (faixa silenciada)?"
          : "Nenhuma palavra encontrada. A câmera principal da V1 tem transcrição?"
      );
    }

    andamento(2, "Montando as legendas no padrão");
    const blocos = gerarBlocos(ent.palavras, ent.cortes, ent.preset);
    const problemas = validar(blocos, ent.preset);
    const precos = blocos.filter((b) => b.estilo === "preco");
    const revisar = blocos.filter((b) => b.precisaRevisao);
    const resultado = (timeline: ResultadoCaptions["timeline"], reprovados: readonly string[]): ResultadoCaptions => ({
      nome: info.name,
      duracaoS: Math.max(0, ...ent.cortes),
      fonte: usarEleven ? "elevenlabs" : "premiere",
      reaproveitada: ent.reaproveitada,
      palavras: ent.palavras.length,
      blocos: blocos.map((b) => ({ inicio: b.inicio, fim: b.fim, texto: b.texto, preco: b.estilo === "preco", revisar: b.motivos })),
      reprovados,
      timeline,
      avisoFala: ent.avisoFala,
    });

    // Nunca renderizar antes da validacao final.
    if (problemas.length > 0) {
      registrar(`${problemas.length} bloco(s) reprovado(s) na validação, nada foi escrito`, "aviso");
      for (const p of problemas.slice(0, 10)) registrar(`  ${p}`, "aviso");
      return resultado([], problemas);
    }
    registrar(`${blocos.length} blocos · ${precos.length} preço(s) · ${revisar.length} para revisar`, "ok");

    // O E5 provou que "Criar legendas a partir da transcricao" re-segmenta os
    // nossos blocos; o caminho que preserva um bloco por legenda e o .srt.
    // Texto e preco saem em arquivos separados: cada um vai na sua faixa de
    // legenda e o estilo da faixa resolve o tamanho (96 no texto, 150 no preco)
    // sem mexer em legenda individual (D-16).
    const normais = blocos.filter((b) => b.estilo === "normal");
    const caminhos = [await comLimite("srt", salvarSrt("legendas.srt", blocosParaSrt(normais)))];
    if (precos.length > 0) caminhos.push(await comLimite("srt precos", salvarSrt("precos.srt", blocosParaSrt(precos))));
    for (const c of caminhos) registrar(`gerado: ${c}`);

    // O UXP nao cria faixa de legenda (E7c); a ponte CEP cria, e sem ela os
    // .srt vao para o painel Projeto para o arrasto manual.
    andamento(3, "Pondo na timeline");
    const timeline = await legendasNaTimeline(caminhos[0]!, caminhos[1] ?? null);
    for (const l of timeline) registrar(l.texto, l.tipo);
    return resultado(timeline, []);
  } catch (e) {
    registrar((e as Error)?.message ?? String(e), "erro");
    throw e;
  } finally {
    await comLimite("log", gravarLog(linhas)).catch(() => undefined);
  }
}

export const motorCaptionsLocal: MotorCaptions = {
  ler: async () => {
    const info = await comLimite("sequencia", getSequenceInfo());
    // O resto e o que a tela confere antes de gerar: sem cada leitura, so mostra menos.
    const clipes = await comLimite("clipes", lerClipes(0)).catch(() => []);
    const cortes = await comLimite("cortes", lerCortes(0)).catch(() => [] as number[]);
    const nomes = [...new Set(clipes.map((c) => c.sourceName))];
    const comTranscricao =
      nomes.length === 0 ? 0 : await comLimite("transcricoes", lerTranscricoes(nomes), 60000).then((t) => t.transcricoes.size, () => 0);
    const chave = await comLimite("chave", lerChaveElevenLabs()).catch(() => null);
    const empresa = await comLimite("empresa", lerEmpresa()).catch(() => "androclinic" as const);
    return {
      nome: info.name,
      duracaoS: Math.max(0, ...cortes),
      clipesV1: clipes.length,
      chave: chave ? chave.slice(-4) : null,
      empresa: EMPRESAS[empresa].nome,
      midias: nomes.length,
      comTranscricao,
    };
  },
  gerar,
  salvarChave: async (chave) => {
    const limpa = chave.trim();
    if (limpa.length < 10) throw new Error("Cole a chave inteira antes de salvar.");
    // A API so aceita a chave secreta, que comeca com sk_; o ID da chave (o que
    // o site mostra depois) foi colado no primeiro teste e deu erro 400.
    if (!limpa.startsWith("sk_")) throw new Error("Chaves do ElevenLabs começam com sk_. Essa parece o ID da chave, não a chave.");
    await comLimite("salvar chave", salvarChaveElevenLabs(limpa));
    return limpa.slice(-4);
  },
  irPara: (segundos) => comLimite("ir para", irPara(segundos), 5000),
};
