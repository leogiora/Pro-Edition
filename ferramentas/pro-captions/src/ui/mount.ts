/*
 * Painel. Nao chama `premierepro` direto: fala com src/premiere.ts.
 *
 * Duas acoes, so isso: gerar e restaurar. Tudo que a analise descobre vai para
 * o log da tela E para um arquivo, porque o painel nao deixa copiar texto e o
 * log some da area visivel.
 */

import { audioMudo, duracaoDoWav } from "../audio.ts";
import { relogio } from "../domain.ts";
import { assinaturaDoAudio, palavrasDoElevenLabs, termosChave } from "../elevenlabs.ts";
import { transcreverNoElevenLabs } from "../elevenlabs-rede.ts";
import { blocosParaSrt, gerarBlocos } from "../pipeline.ts";
import {
  apagarArquivo,
  comLimite,
  escreverTranscricao,
  exportarAudioDaSequencia,
  getSequenceInfo,
  gravarLog,
  guardarTranscricao,
  legendasNaTimeline,
  lerBackup,
  lerChaveElevenLabs,
  lerClipes,
  lerCortes,
  lerTranscricaoGuardada,
  lerTranscricoes,
  salvarChaveElevenLabs,
  salvarSrt,
  type SequenceInfo,
} from "../premiere.ts";
import { PRESET_ELEVENLABS, PRESET_PADRAO, type Preset } from "../preset.ts";
import { validar } from "../segmentar.ts";
import {
  parseTranscricao,
  reconstruirTranscricao,
  type PalavraEditada,
  type TranscricaoOrigem,
} from "../transcript.ts";

const elemento = (id: string): HTMLElement => {
  const el = document.getElementById(id);
  if (!el) throw new Error(`elemento ausente no HTML: ${id}`);
  return el;
};

let linhas: string[] = [];

function registrar(texto: string): void {
  linhas.push(texto);
  const log = elemento("log");
  log.textContent = linhas.join("\n");
  // O que importa fica no fim; sem isto as ultimas linhas nascem fora da vista.
  log.scrollTop = log.scrollHeight;
}

function estado(texto: string, tom: "" | "ativo" | "ok" | "aviso" | "erro" = ""): void {
  const node = elemento("estado");
  node.textContent = texto;
  node.setAttribute("data-tom", tom);
}

function ocupado(sim: boolean): void {
  for (const id of ["gerar", "restaurar", "salvarChave"]) {
    const b = elemento(id) as HTMLElement & { disabled?: boolean };
    b.disabled = sim;
  }
}

/** Rotulos padrao dos dois botoes: para onde o texto volta quando a acao
 *  termina, de sucesso ou de erro. */
const ROTULOS: Readonly<Record<string, string>> = {
  gerar: "Gerar legendas",
  restaurar: "Restaurar original",
  salvarChave: "Salvar chave",
};

/**
 * Toda acao termina gravando o log, mesmo quando falha.
 *
 * `botao` e so cosmetico: enquanto a acao roda, o proprio botao diz que esta
 * rodando, em vez de deixar o distintivo de status carregar isso sozinho.
 */
async function comLog(
  rotulo: string,
  tarefa: () => Promise<void>,
  botao?: { readonly id: string; readonly enquanto: string }
): Promise<void> {
  linhas = [];
  ocupado(true);
  if (botao) elemento(botao.id).textContent = botao.enquanto;
  registrar(`== ${rotulo} ==`);
  try {
    await tarefa();
  } catch (e) {
    const err = e as Error;
    registrar(`ERRO: ${err?.message ?? String(e)}`);
    estado("erro", "erro");
  } finally {
    ocupado(false);
    if (botao) elemento(botao.id).textContent = ROTULOS[botao.id] ?? botao.enquanto;
    try {
      const caminho = await comLimite("log", gravarLog(linhas));
      registrar("");
      registrar(`log salvo em ${caminho}`);
    } catch {
      // Nao poder gravar o log nao pode derrubar o que ja foi feito.
    }
  }
}

/** O que o nucleo precisa para montar as legendas, venha a fala de onde vier. */
interface Entrada {
  readonly cortes: number[];
  readonly palavras: PalavraEditada[];
  readonly preset: Preset;
}

async function mostrarSequencia(): Promise<SequenceInfo> {
  const info = await comLimite("sequencia", getSequenceInfo());
  const nome = elemento("seqNome");
  nome.textContent = info.name;
  nome.setAttribute("data-vazio", "nao");
  // A instrucao do estado vazio some assim que ha sequencia de verdade:
  // instrucao que continua na tela depois de cumprida vira ruido.
  elemento("seqDica").style.display = "none";
  registrar(`${info.fps.toFixed(2)} fps · ${info.videoTracks} video · ${info.captionTracks} caption`);
  return info;
}

/** Caminho antigo: a transcricao que o proprio Premiere fez de cada midia. */
async function lerTudo(): Promise<Entrada> {
  await mostrarSequencia();

  const clipes = await comLimite("clipes", lerClipes(0));
  const cortes = await comLimite("cortes", lerCortes(0));
  registrar(`V1: ${clipes.length} clipes · ${cortes.length} cortes`);

  const { transcricoes: brutas, falhas } = await comLimite(
    "transcricoes",
    lerTranscricoes(clipes.map((c) => c.sourceName)),
    60000
  );
  registrar(`${brutas.size} midias com transcricao`);
  for (const f of falhas) registrar(`"${f.nome}": ${f.motivo}`);

  const mapa = new Map<string, TranscricaoOrigem>();
  for (const [midia, json] of brutas) {
    const t = parseTranscricao(json);
    if (t) mapa.set(midia, t);
    else registrar(`transcricao ilegivel: ${midia}`);
  }

  const palavras = reconstruirTranscricao(clipes, mapa);
  registrar(`${palavras.length} palavras no corte final (transcricao do Premiere)`);
  return { cortes, palavras, preset: PRESET_PADRAO };
}

/**
 * Caminho novo: o ElevenLabs ouve o audio da sequencia inteira.
 *
 * O plugin exporta o audio sozinho (mesmo metodo do Auto Pausas), manda para
 * o ElevenLabs e guarda a resposta. Gerar de novo com o mesmo audio nao paga
 * de novo: a resposta guardada e reaproveitada.
 */
async function lerComElevenLabs(): Promise<Entrada> {
  const chave = await comLimite("chave", lerChaveElevenLabs());
  if (!chave) {
    throw new Error(
      "Sem chave do ElevenLabs. Cole a chave em 'Quem ouve o áudio' e clique em Salvar chave — " +
        "ou desmarque o ElevenLabs para usar a transcrição do Premiere."
    );
  }

  await mostrarSequencia();
  const cortes = await comLimite("cortes", lerCortes(0));
  registrar(`V1: ${cortes.length} cortes`);

  estado("exportando áudio", "ativo");
  const audio = await comLimite("exportar o áudio", exportarAudioDaSequencia(), 10 * 60 * 1000);
  let json: string | null;
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
      registrar("mesmo áudio de antes: transcrição reaproveitada, sem custo");
    } else {
      estado("ElevenLabs ouvindo", "ativo");
      const termos = termosChave(PRESET_ELEVENLABS);
      registrar(`enviando ao ElevenLabs (${termos.length} termos-chave)…`);
      const t0 = Date.now();
      json = await comLimite(
        "ElevenLabs",
        transcreverNoElevenLabs(audio.bytes, chave, termos, registrar),
        15 * 60 * 1000
      );
      registrar(`ElevenLabs respondeu em ${((Date.now() - t0) / 1000).toFixed(0)} s`);
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
  return { cortes, palavras, preset: PRESET_ELEVENLABS };
}

function marcado(id: string): boolean {
  return (elemento(id) as HTMLElement & { checked?: boolean }).checked === true;
}

async function gerar(): Promise<void> {
  estado("lendo sequência", "ativo");
  const usarEleven = marcado("usarEleven");
  const { cortes, palavras, preset } = usarEleven ? await lerComElevenLabs() : await lerTudo();
  if (palavras.length === 0) {
    throw new Error(
      usarEleven
        ? "O ElevenLabs não ouviu nenhuma palavra. O áudio da sequência está mudo (faixa silenciada)?"
        : "Nenhuma palavra encontrada. A camera principal da V1 tem transcricao?"
    );
  }

  estado("montando legendas", "ativo");
  const blocos = gerarBlocos(palavras, cortes, preset);
  const problemas = validar(blocos, preset);
  const precos = blocos.filter((b) => b.estilo === "preco");
  const revisar = blocos.filter((b) => b.precisaRevisao);

  // Nunca renderizar antes da validacao final.
  if (problemas.length > 0) {
    registrar("");
    registrar(`${problemas.length} bloco(s) reprovado(s) na validacao, nada foi escrito:`);
    for (const p of problemas.slice(0, 10)) registrar(`  ${p}`);
    estado("reprovado", "aviso");
    return;
  }

  // A escrita do transcript no clipe (rota destrutiva, D-04) foi removida em
  // 2026-08-12: o .srt e o caminho (D-13) e nao ha motivo para tocar na
  // midia do projeto. "Restaurar original" fica para desfazer escritas de
  // versoes antigas.

  // Resumo no fim: o log rola sozinho e so as ultimas linhas ficam a vista.
  registrar("");
  registrar(`${blocos.length} blocos · ${precos.length} preco(s) · ${revisar.length} para revisar`);
  registrar("");
  for (const b of blocos.slice(0, 12)) {
    const marca = b.estilo === "preco" ? "R$" : "  ";
    registrar(`${marca} ${relogio(b.inicio)} ${b.texto}`);
  }
  if (blocos.length > 12) registrar(`   ... mais ${blocos.length - 12}`);

  if (revisar.length > 0) {
    registrar("");
    registrar("precisam de revisao:");
    for (const b of revisar.slice(0, 8)) registrar(`  ${relogio(b.inicio)} ${b.motivos.join("; ")}`);
  }

  // O E5 provou que "Criar legendas a partir da transcricao" re-segmenta os
  // nossos blocos; o caminho que preserva um bloco por legenda e o .srt.
  //
  // Texto e preco saem em arquivos separados: cada um vai na sua faixa de
  // legenda e o estilo da faixa resolve o tamanho (96 no texto, 150 no
  // preco) sem mexer em legenda individual (D-16).
  const normais = blocos.filter((b) => b.estilo === "normal");
  const caminhos = [await comLimite("srt", salvarSrt("legendas.srt", blocosParaSrt(normais)))];
  if (precos.length > 0) {
    caminhos.push(await comLimite("srt precos", salvarSrt("precos.srt", blocosParaSrt(precos))));
  }
  registrar("");
  for (const c of caminhos) registrar(`gerado: ${c}`);

  // O UXP nao cria faixa de legenda (E7c); a ponte CEP cria, e sem ela os
  // .srt vao para o painel Projeto para o arrasto manual.
  registrar("");
  for (const l of await legendasNaTimeline(caminhos[0]!, caminhos[1] ?? null)) registrar(l.texto);
  estado(
    revisar.length > 0 ? `${revisar.length} para revisar` : "legendas geradas",
    revisar.length > 0 ? "aviso" : "ok"
  );
}

async function restaurar(): Promise<void> {
  const clipes = await comLimite("clipes", lerClipes(0));
  const midias = [...new Set(clipes.map((c) => c.sourceName))];
  let feitas = 0;

  for (const midia of midias) {
    const original = await comLimite("backup", lerBackup(midia));
    if (original === null) {
      registrar(`${midia}: sem backup guardado`);
      continue;
    }
    await comLimite("escrita", escreverTranscricao(midia, original));
    registrar(`${midia}: transcricao original restaurada`);
    feitas++;
  }

  registrar("");
  // Numero zero tambem se escreve: silencio e indistinguivel de coisa quebrada.
  registrar(`${feitas} de ${midias.length} midia(s) restaurada(s)`);
  estado(feitas > 0 ? "restaurado" : "nada a restaurar", feitas > 0 ? "ok" : "aviso");
}

/** Mostra se ha chave salva, sem nunca mostrar a chave. */
async function atualizarChave(): Promise<void> {
  const chave = await comLimite("chave", lerChaveElevenLabs());
  elemento("chaveEstado").textContent =
    chave === null
      ? "Sem chave salva. Crie uma em elevenlabs.io > Developers > API Keys e cole abaixo."
      : `Chave salva (termina em ${chave.slice(-4)}).`;
  if (chave === null) (elemento("usarEleven") as HTMLElement & { checked?: boolean }).checked = false;
}

async function salvarChave(): Promise<void> {
  const campo = elemento("chave") as HTMLElement & { value?: string };
  const chave = (campo.value ?? "").trim();
  if (chave.length < 10) {
    registrar("Cole a chave inteira no campo antes de salvar.");
    estado("sem chave", "aviso");
    return;
  }
  if (!chave.startsWith("sk_")) {
    // A API so aceita chave secreta, que comeca com sk_. O ID da chave (o que
    // o site mostra depois) foi colado no primeiro teste e deu erro 400.
    registrar("Atenção: chaves do ElevenLabs começam com sk_. Essa não começa — confira se não é o ID da chave.");
  }
  await comLimite("salvar chave", salvarChaveElevenLabs(chave));
  // O campo esvazia: a chave nao fica exposta na tela depois de salva.
  campo.value = "";
  (elemento("usarEleven") as HTMLElement & { checked?: boolean }).checked = true;
  await atualizarChave();
  registrar("chave do ElevenLabs salva neste computador");
  estado("chave salva", "ok");
}

/**
 * Liga um `div[role="button"]` — clique E teclado.
 *
 * Um `<button>` nativo daria o teclado de graca, mas o UXP o renderiza como
 * controle do host: ignora o CSS do proprio elemento e achata os filhos numa
 * linha so. Com div o visual e nosso, e o Enter/Espaco volta a ser
 * responsabilidade nossa.
 */
function ligarAcao(node: HTMLElement, acao: () => void): void {
  node.addEventListener("click", acao);
  node.addEventListener("keydown", (evento) => {
    const tecla = (evento as KeyboardEvent).key;
    if (tecla !== "Enter" && tecla !== " ") return;
    evento.preventDefault();
    acao();
  });
}

/**
 * Recolhe/mostra o registro.
 *
 * Nasce SEMPRE aberto: o log e o unico canal de resposta do painel, e um log
 * escondido por padrao repete o erro que ja fez este plugin parecer morto.
 * Recolher e escolha de quem ja sabe o que esta acontecendo.
 */
function alternarLog(): void {
  const secao = elemento("secaoLog");
  const alternador = elemento("logToggle");
  const aberto = secao.getAttribute("data-aberto") !== "nao";
  secao.setAttribute("data-aberto", aberto ? "nao" : "sim");
  alternador.textContent = aberto ? "Mostrar" : "Recolher";
  alternador.setAttribute("aria-expanded", aberto ? "false" : "true");
  alternador.setAttribute("aria-label", aberto ? "Mostrar o registro" : "Recolher o registro");
}

/**
 * `root` nao e usado no corpo: elemento() busca por id em `document` inteiro,
 * nao escopado a `root`. So e seguro porque o shell (Pro Edition) nunca
 * monta duas ferramentas ao mesmo tempo — troca document.body.innerHTML
 * inteiro antes de cada mount() (contrato documentado no spec do Pro
 * Edition), o que tambem reseta `linhas` e os listeners junto (elementos
 * novos a cada chamada, nunca reaproveitados). Se isso mudar (montagem
 * parcial, mount() chamado 2x sem substituir o DOM), elemento() precisa
 * passar a escopar a busca a partir de `root`.
 */
export function mount(root: HTMLElement): void {
  linhas = [];

  // Antes de qualquer await: se o I/O pendurar, os botoes ja estao ligados.
  estado("pronto", "ok");
  registrar("painel carregado");
  elemento("gerar").addEventListener("click", () => {
    void comLog("gerar legendas", gerar, { id: "gerar", enquanto: "Gerando..." });
  });
  elemento("restaurar").addEventListener("click", () => {
    void comLog("restaurar original", restaurar, { id: "restaurar", enquanto: "Restaurando..." });
  });
  elemento("salvarChave").addEventListener("click", () => {
    void comLog("salvar chave", salvarChave, { id: "salvarChave", enquanto: "Salvando..." });
  });
  ligarAcao(elemento("logToggle"), alternarLog);

  // Depois de ligar os botoes: se a leitura pendurar, o painel continua vivo.
  void atualizarChave().catch(() => {
    elemento("chaveEstado").textContent = "Não consegui ler a chave salva.";
  });
}
