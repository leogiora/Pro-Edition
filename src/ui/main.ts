/*
 * Painel. So orquestra: le a configuracao, desenha, e chama o adapter.
 * Nenhuma chamada a `premierepro` mora aqui.
 */

import { DEFAULT_CONFIG, formatTimecode, parseConfig, type Config } from "../domain.ts";
import { analisar } from "../analise.ts";
import {
  aprender,
  comPendente,
  parseMemoria,
  parsePendentes,
  type Memoria,
  type Pendentes,
} from "../aprendizado.ts";
import { planejar } from "../plano.ts";
import {
  comLimite,
  getSequenceInfo,
  inserirPlano,
  lerClipes,
  lerTranscricoes,
  listarPastaBrolls,
  readJson,
  writeJson,
} from "../premiere.ts";

const CONFIG_FILE = "config.json";
const MEMORIA_FILE = "aprendizado.json";
const PENDENTES_FILE = "pendentes.json";

// ------------------------------------------------------------------ util

function el<T extends HTMLElement>(id: string): T {
  const node = document.getElementById(id);
  if (!node) throw new Error(`elemento ausente no HTML: #${id}`);
  return node as T;
}

/** sp-textfield e sp-checkbox expoem value/checked como propriedade. */
interface Campo extends HTMLElement {
  value: string;
}
interface Caixa extends HTMLElement {
  checked: boolean;
}

const log = el("log");

/** Espelho do log em texto. O painel e curto e nem sempre da para rolar ate
 *  o fim, entao tudo tambem vai para arquivo. */
let linhas: string[] = [];

function registrar(texto: string, tipo: "passo" | "ok" | "erro" | "aviso" | "vazio" = "passo"): void {
  linhas.push(texto);
  const linha = document.createElement("div");
  linha.className = `l-${tipo}`;
  linha.textContent = texto;
  log.appendChild(linha);
  log.scrollTop = log.scrollHeight;
}

function limparLog(): void {
  linhas = [];
  log.textContent = "";
}

/** Grava o log onde da para ler de fora do Premiere. Nunca lanca. */
async function salvarLog(): Promise<void> {
  try {
    await writeJson("ultimo-log.json", { quando: new Date().toISOString(), linhas });
  } catch {
    // Sem log em arquivo o painel ainda funciona; nao vale derrubar nada.
  }
}

function estado(texto: string, tom: "" | "ok" | "erro" = ""): void {
  const node = el("estado");
  node.textContent = texto;
  node.setAttribute("data-tom", tom);
}

function mensagemDeErro(e: unknown): string {
  const err = e as Error;
  return err?.message ?? String(e);
}

// --------------------------------------------------------------- config

/**
 * V2 e A3 sao requisito fixo, nao preferencia: o B-roll sempre entra em V2 e o
 * audio dele nunca pode encostar em A1. Campos editaveis so davam a chance de
 * apontar para a faixa errada — e o `sp-textfield type="number"` ainda exibia
 * "nan". Sem campo, sem erro.
 */
function lerFormulario(): Config {
  return {
    schema: 1,
    videoTrackIndex: DEFAULT_CONFIG.videoTrackIndex,
    audioTrackIndex: DEFAULT_CONFIG.audioTrackIndex,
    removeAudio: el<Caixa>("removeAudio").checked,
    fillScreen: el<Caixa>("fillScreen").checked,
    libraryPath: el<Campo>("libraryPath").value.trim(),
  };
}

function preencherFormulario(c: Config): void {
  el<Caixa>("removeAudio").checked = c.removeAudio;
  el<Caixa>("fillScreen").checked = c.fillScreen;
  el<Campo>("libraryPath").value = c.libraryPath;
}

// ------------------------------------------------------------- sequencia

async function relerSequencia(): Promise<void> {
  estado("lendo");
  try {
    const info = await comLimite("ler sequencia", getSequenceInfo());
    const nome = el("seqNome");
    nome.textContent = info.name;
    nome.setAttribute("data-vazio", "nao");
    el("seqFormato").textContent = `${info.width}x${info.height}`;
    el("seqFps").textContent = info.fps.toFixed(3).replace(".", ",");
    el("seqDuracao").textContent = formatTimecode(info.durationSeconds, info.fps);
    el("seqFaixas").textContent = `${info.videoTracks}V · ${info.audioTracks}A`;
    estado("pronto", "ok");
  } catch (e) {
    const nome = el("seqNome");
    nome.textContent = "nenhuma sequencia ativa";
    nome.setAttribute("data-vazio", "sim");
    for (const id of ["seqFormato", "seqFps", "seqDuracao", "seqFaixas"]) {
      el(id).textContent = "—";
    }
    estado("sem sequencia", "erro");
    registrar(mensagemDeErro(e), "erro");
  }
}

// -------------------------------------------------------------- analisar

/** mm:ss — mais legivel que timecode cheio numa lista de oportunidades. */
function relogio(segundos: number): string {
  const total = Math.max(0, Math.round(segundos));
  return `${String(Math.floor(total / 60)).padStart(2, "0")}:${String(total % 60).padStart(2, "0")}`;
}

/**
 * Julga o plano da rodada anterior antes de planejar a proxima.
 *
 * O sinal ja esta na timeline: B-roll que continua na faixa foi acerto, o que
 * sumiu foi erro. O usuario "treina" o plugin editando normalmente — nao ha
 * botao de nota, nao ha modelo, so contagem.
 *
 * Nunca lanca: falhar em aprender nao pode impedir a analise. Quando a leitura
 * da faixa ou a gravacao falham, o plano continua pendente e sera julgado na
 * proxima rodada — melhor adiar que contar errado.
 */
async function julgarPlanoAnterior(
  sequencia: string,
  videoTrackIndex: number
): Promise<{ memoria: Memoria; pendentes: Pendentes }> {
  const memoria = parseMemoria(await comLimite("ler aprendizado", readJson(MEMORIA_FILE), 5000));
  const pendentes = parsePendentes(await comLimite("ler pendentes", readJson(PENDENTES_FILE), 5000));

  const pendente = pendentes.porSequencia[sequencia];
  if (pendente === undefined || pendente.itens.length === 0) return { memoria, pendentes };

  try {
    const faixa = `V${videoTrackIndex + 1}`;
    const naFaixa = await comLimite(`ler ${faixa}`, lerClipes(videoTrackIndex), 30000);
    const resultado = aprender(memoria, pendente, new Set(naFaixa.map((c) => c.sourceName)));
    const julgado = comPendente(pendentes, sequencia, null);

    // O pendente sai da lista na mesma rodada em que e contado. Sem isso, rodar
    // a analise duas vezes contaria o mesmo acerto de novo.
    await writeJson(MEMORIA_FILE, resultado.memoria);
    await writeJson(PENDENTES_FILE, julgado);

    registrar(
      `aprendizado: ${resultado.acertos} mantidos e ${resultado.erros} apagados em ${faixa} desde a ultima analise`,
      "ok"
    );
    return { memoria: resultado.memoria, pendentes: julgado };
  } catch (e) {
    registrar(`Aprendizado adiado: ${mensagemDeErro(e)}`, "aviso");
    return { memoria, pendentes };
  }
}

async function analisarSequencia(): Promise<void> {
  const botao = el<HTMLButtonElement & { disabled: boolean }>("analisar");
  botao.disabled = true;
  estado("analisando");
  limparLog();

  try {
    const pasta = el<Campo>("libraryPath").value.trim();
    if (!pasta) throw new Error("Informe a pasta de B-rolls.");

    const arquivos = await comLimite("listar pasta de B-rolls", listarPastaBrolls(pasta), 30000);
    if (arquivos.length === 0) throw new Error(`Nenhum video em ${pasta}.`);
    registrar(`${arquivos.length} B-rolls na pasta`, "passo");

    // Pasta que funcionou fica gravada: digitar uma vez basta.
    void writeJson(CONFIG_FILE, lerFormulario()).catch(() => undefined);

    const clipes = await comLimite("ler clipes de V1", lerClipes(0), 30000);
    if (clipes.length === 0) throw new Error("V1 esta vazia. Nao ha o que analisar.");
    registrar(`${clipes.length} clipes em V1`, "passo");

    const nomes = [...new Set(clipes.map((c) => c.sourceName))];
    const transcricoesJson = await comLimite("ler transcricoes", lerTranscricoes(nomes), 60000);
    registrar(`${transcricoesJson.size} de ${nomes.length} midias com transcricao`, "passo");

    const config = lerFormulario();
    const { name: nomeSequencia } = await comLimite("ler sequencia", getSequenceInfo());
    const { memoria, pendentes } = await julgarPlanoAnterior(nomeSequencia, config.videoTrackIndex);

    const resultado = analisar({
      clipes,
      transcricoesJson,
      biblioteca: arquivos.map((a) => a.name),
    });

    registrar(
      `${resultado.palavras} palavras · ${resultado.frases} frases · ${resultado.conceitos} conceitos`,
      "passo"
    );
    for (const aviso of resultado.avisos.slice(0, 6)) registrar(aviso, "aviso");

    if (resultado.oportunidades.length === 0) {
      registrar("Nenhuma oportunidade de B-roll encontrada.", "vazio");
      estado("nada a inserir", "ok");
      return;
    }

    const plano = planejar(
      resultado.oportunidades,
      { caminhos: new Map(arquivos.map((a) => [a.name, a.nativePath])) },
      undefined,
      memoria
    );

    for (const descarte of plano.descartes) registrar(`  ${descarte}`, "vazio");

    if (plano.colocacoes.length === 0) {
      registrar("Nenhuma sugestao boa o bastante para entrar sozinha.", "aviso");
      estado("nada a inserir", "ok");
      return;
    }

    registrar(`${plano.colocacoes.length} B-rolls a inserir:`, "ok");
    for (const c of plano.colocacoes) {
      registrar(
        `${relogio(c.inicio)}  ${c.arquivo}  ${c.duracao.toFixed(1)}s · ${Math.round(c.score * 100)}% · ${c.motivo}`,
        "passo"
      );
    }

    estado("inserindo");
    const feito = await comLimite(
      "inserir plano",
      inserirPlano(plano.colocacoes, {
        videoTrackIndex: config.videoTrackIndex,
        audioTrackIndex: config.audioTrackIndex,
        removerAudio: config.removeAudio,
        preencherTela: config.fillScreen,
      }),
      120000
    );
    for (const passo of feito.passos) registrar(`  ${passo}`, "ok");
    for (const aviso of feito.avisos) registrar(`  ${aviso}`, "aviso");
    registrar("Tres Ctrl+Z desfazem tudo.", "vazio");

    // Guarda o que entrou. Apague na timeline o que nao serviu: a proxima
    // analise le a faixa, compara com isto e ajusta o peso de cada par.
    try {
      await writeJson(
        PENDENTES_FILE,
        comPendente(pendentes, nomeSequencia, {
          quando: new Date().toISOString(),
          itens: plano.colocacoes.map((c) => ({
            arquivo: c.arquivo,
            conceito: c.conceito,
            termosCasados: c.termosCasados,
          })),
        })
      );
      registrar("Apague os que nao serviram: a proxima analise aprende com isso.", "vazio");
    } catch (e) {
      registrar(`Plano nao ficou guardado, esta rodada nao vai ensinar nada. ${mensagemDeErro(e)}`, "aviso");
    }

    estado("pronto", "ok");
  } catch (e) {
    registrar(mensagemDeErro(e), "erro");
    estado("falhou", "erro");
  } finally {
    botao.disabled = false;
    await salvarLog();
  }
}

// ---------------------------------------------------------------- inicio

function iniciar(): void {
  // Primeira coisa visivel: se o distintivo continuar dizendo "carregando",
  // o script nao rodou, e o problema esta no carregamento — nao na logica.
  estado("ligando");

  // Os botoes sao ligados PRIMEIRO e de forma sincrona. Qualquer I/O do UXP
  // pode pendurar para sempre; se a ligacao viesse depois, um `await` travado
  // deixaria o painel inteiro inerte — sem log, sem erro, sem reacao ao clique.
  el("analisar").addEventListener("click", () => {
    void analisarSequencia();
  });
  el("atualizar").addEventListener("click", () => {
    void relerSequencia();
  });
  // Com os botoes ja vivos, o resto pode falhar sem deixar o painel inutil.
  preencherFormulario(DEFAULT_CONFIG);
  estado("pronto", "ok");
  registrar("Painel pronto.", "vazio");

  void (async () => {
    try {
      const salva = await comLimite("ler configuracao", readJson(CONFIG_FILE), 5000);
      if (salva !== null) preencherFormulario(parseConfig(salva));
    } catch (e) {
      registrar(`Configuracao nao carregou, usando padrao. ${mensagemDeErro(e)}`, "aviso");
    }
    await relerSequencia();
  })();
}

iniciar();
