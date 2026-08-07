/*
 * Painel. So orquestra: le a configuracao, desenha, e chama o adapter.
 * Nenhuma chamada a `premierepro` mora aqui.
 */

import {
  DEFAULT_CONFIG,
  formatTimecode,
  parseConfig,
  relogio,
  type Config,
} from "../domain.ts";
import { analisar } from "../analise.ts";
import {
  aprender,
  comPendente,
  creditarManuais,
  parseMemoria,
  parsePendentes,
  type Memoria,
  type Pendentes,
} from "../aprendizado.ts";
import { CACHE_VAZIO, parseCacheIntensidade, ritmo } from "../intensidade.ts";
import type { Conceito } from "../match.ts";
import { planejar, REGRAS_DENSAS, REGRAS_PADRAO } from "../plano.ts";
import type { Frase } from "../transcript.ts";
import {
  comLimite,
  getSequenceInfo,
  inserirPlano,
  lerBrollsAcimaDeV1,
  lerClipes,
  lerTranscricoes,
  listarPastaBrolls,
  medirBiblioteca,
  readJson,
  writeJson,
} from "../premiere.ts";

const CONFIG_FILE = "config.json";
const MEMORIA_FILE = "aprendizado.json";
const PENDENTES_FILE = "pendentes.json";
const INTENSIDADE_FILE = "intensidade.json";

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
    densidadeMaxima: el<Caixa>("densidadeMaxima").checked,
    libraryPath: el<Campo>("libraryPath").value.trim(),
  };
}

function preencherFormulario(c: Config): void {
  el<Caixa>("removeAudio").checked = c.removeAudio;
  el<Caixa>("fillScreen").checked = c.fillScreen;
  el<Caixa>("densidadeMaxima").checked = c.densidadeMaxima;
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

interface Linha {
  readonly texto: string;
  readonly tipo: "ok" | "aviso";
}

interface Julgamento {
  readonly memoria: Memoria;
  readonly pendentes: Pendentes;
  /**
   * Resumo guardado para o FIM do log, nao registrado na hora.
   *
   * O julgamento acontece no meio da analise, mas o log rola sozinho para o
   * fim — e o painel e curto demais para mostrar as duas pontas. Medido no
   * Premiere real: a linha do aprendizado saiu da vista e o usuario concluiu
   * que a contagem nao tinha acontecido.
   */
  readonly resumo: readonly Linha[];
}

/**
 * Le a faixa de destino uma vez e aprende as duas coisas que ela conta.
 *
 * 1. **O que o plugin pos e o usuario manteve ou apagou.** Continuar la foi
 *    acerto; ter sumido foi erro.
 * 2. **O que o usuario pos por conta propria.** Esta na faixa e nao estava no
 *    plano — logo foi escolha dele, e e o sinal mais forte que existe: diz qual
 *    B-roll faltava e exatamente onde.
 *
 * O usuario "treina" o plugin editando normalmente. Nao ha botao de nota, nao ha
 * modelo, so contagem.
 *
 * Nunca lanca: falhar em aprender nao pode impedir a analise. Quando a leitura
 * da faixa ou a gravacao falham, o plano continua pendente e sera julgado na
 * proxima rodada — melhor adiar que contar errado.
 */
async function julgarFaixa(
  sequencia: string,
  frases: readonly Frase[],
  conceitos: readonly Conceito[]
): Promise<Julgamento> {
  const memoria = parseMemoria(await comLimite("ler aprendizado", readJson(MEMORIA_FILE), 5000));
  const pendentes = parsePendentes(await comLimite("ler pendentes", readJson(PENDENTES_FILE), 5000));
  const pendente = pendentes.porSequencia[sequencia];

  try {
    // Qualquer faixa acima de V1, nao so a de destino: empilhar na V3 e o que
    // o editor faz quando nao quer sobrescrever.
    const naTimeline = await comLimite("ler B-rolls da timeline", lerBrollsAcimaDeV1(), 30000);
    const resumo: Linha[] = [];

    const doPlano = new Set(pendente?.itens.map((i) => i.arquivo) ?? []);
    const presentes = new Set(naTimeline.map((c) => c.sourceName));
    const manuais = naTimeline
      .filter((c) => !doPlano.has(c.sourceName))
      .map((c) => ({ arquivo: c.sourceName, inicio: c.startSeconds }));

    // Nada apagado e nada colocado desde o plano anterior significa que ninguem
    // editou — provavelmente foi so um segundo clique em Analisar. Contar isso
    // seria inventar sinal: no uso real essa esteira inflou um par ate 106
    // acertos, e af afogou as exclusoes de verdade.
    const apagou = [...doPlano].some((a) => !presentes.has(a));
    const semEdicao = pendente !== undefined && !apagou && manuais.length === 0;

    let atual = memoria;
    let julgado = pendentes;

    if (semEdicao) {
      resumo.push({
        texto: "Nada mudou na timeline desde a ultima analise: nao havia o que aprender.",
        tipo: "aviso",
      });
    } else {
      // 1. Sobrevivencia do que o plugin inseriu.
      if (pendente !== undefined && pendente.itens.length > 0) {
        const r = aprender(atual, pendente, presentes);
        atual = r.memoria;
        // O pendente sai da lista na mesma rodada em que e contado.
        julgado = comPendente(pendentes, sequencia, null);
        resumo.push({
          texto: `Aprendi da rodada anterior: voce manteve ${r.acertos} e apagou ${r.erros}.`,
          tipo: "ok",
        });
      }

      // 2. O que esta na timeline sem ter vindo do plano foi voce quem pos.
      if (manuais.length > 0) {
        const credito = creditarManuais(atual, sequencia, manuais, frases, conceitos);
        atual = credito.memoria;
        // Falar mesmo quando o numero e zero: silencio se parece com falha, e foi
        // exatamente assim que este aprendizado passou por quebrado. E dizer o
        // motivo CERTO de cada um — juntar tudo em "ja contados" esconderia
        // arquivo de fora da pasta, que e problema, atras de algo que nao e.
        const detalhe: string[] = [`${credito.creditados} aprendidos`];
        if (credito.jaContados > 0) detalhe.push(`${credito.jaContados} ja contados antes`);
        if (credito.foraDaBiblioteca > 0) {
          detalhe.push(`${credito.foraDaBiblioteca} fora da pasta de B-rolls`);
        }
        if (credito.semFala > 0) detalhe.push(`${credito.semFala} sobre silencio`);
        if (credito.semLigacao.length > 0) {
          detalhe.push(`${credito.semLigacao.length} sem ligacao no dicionario`);
        }
        resumo.push({
          texto: `Voce colocou ${manuais.length} por conta propria: ${detalhe.join(", ")}.`,
          tipo: credito.creditados > 0 ? "ok" : "aviso",
        });
        // Nao ha o que contar aqui, mas ha o que dizer: falta ligacao no dicionario.
        for (const sugestao of credito.semLigacao.slice(0, 3)) {
          resumo.push({ texto: sugestao, tipo: "aviso" });
        }
      }
    }

    await writeJson(MEMORIA_FILE, atual);
    if (julgado !== pendentes) await writeJson(PENDENTES_FILE, julgado);

    return { memoria: atual, pendentes: julgado, resumo };
  } catch (e) {
    return {
      memoria,
      pendentes,
      resumo: [{ texto: `Aprendizado adiado: ${mensagemDeErro(e)}`, tipo: "aviso" }],
    };
  }
}

/** Frase cortada para caber numa linha do painel, que e estreito. */
function trecho(texto: string, limite = 70): string {
  return texto.length <= limite ? texto : `${texto.slice(0, limite)}...`;
}

async function analisarSequencia(): Promise<void> {
  const botao = el<HTMLButtonElement & { disabled: boolean }>("analisar");
  botao.disabled = true;
  estado("analisando");
  limparLog();

  // Sai no `finally`: assim aparece por ultimo — visivel — em qualquer saida,
  // inclusive quando a analise nao acha oportunidade ou falha no meio.
  let resumoAprendizado: Julgamento["resumo"] = [];

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

    const resultado = analisar({
      clipes,
      transcricoesJson,
      biblioteca: arquivos.map((a) => a.name),
    });

    registrar(
      `${resultado.palavras} palavras · ${resultado.frases.length} frases · ${resultado.conceitos.length} conceitos`,
      "passo"
    );
    for (const aviso of resultado.avisos.slice(0, 6)) registrar(aviso, "aviso");

    // Depois da analise, de proposito: creditar o que voce colocou na mao exige
    // saber o que estava sendo dito naquele instante, e isso so existe agora.
    const { memoria, pendentes, resumo } = await julgarFaixa(
      nomeSequencia,
      resultado.frases,
      resultado.conceitos
    );
    resumoAprendizado = resumo;

    if (resultado.oportunidades.length === 0) {
      registrar("Nenhuma oportunidade de B-roll encontrada.", "vazio");
      estado("nada a inserir", "ok");
      return;
    }

    // Medir a biblioteca: a primeira vez custa dezenas de segundos, as
    // seguintes nao custam nada. Falhar aqui so tira a escolha de take pelo
    // momento; nao pode tirar a insercao.
    const cache = parseCacheIntensidade(
      await comLimite("ler intensidade", readJson(INTENSIDADE_FILE), 5000)
    );
    let medido = cache;
    try {
      medido = await comLimite(
        "medir intensidade",
        medirBiblioteca(arquivos, cache, (feitos, total) =>
          registrar(`  medindo intensidade: ${feitos} de ${total}`, "passo")
        ),
        300000
      );
      if (medido !== cache) await writeJson(INTENSIDADE_FILE, medido);
    } catch (e) {
      registrar(`Intensidade nao medida, seguindo sem ela. ${mensagemDeErro(e)}`, "aviso");
      medido = CACHE_VAZIO;
    }

    const porArquivo = new Map<string, number>();
    for (const [nome, valor] of Object.entries(medido.arquivos)) {
      if (valor !== null) porArquivo.set(nome, valor);
    }

    const plano = planejar(
      resultado.oportunidades,
      { caminhos: new Map(arquivos.map((a) => [a.name, a.nativePath])) },
      config.densidadeMaxima ? REGRAS_DENSAS : REGRAS_PADRAO,
      memoria,
      { porArquivo, ritmoDasFrases: resultado.frases.map((f) => ritmo(f.palavras, f.duracao)) }
    );

    // Toda frase reconstruida, com o tempo que o plugin acha que ela ocupa.
    // E o unico jeito de separar "casou com a palavra errada" de "esta fora de
    // sincronia": basta comparar duas ou tres com a timeline aberta.
    void writeJson("frases.json", {
      quando: new Date().toISOString(),
      sequencia: nomeSequencia,
      frases: resultado.frases.map((f) => ({
        inicio: Number(f.inicio.toFixed(2)),
        fim: Number(f.fim.toFixed(2)),
        texto: f.texto,
      })),
    }).catch(() => undefined);

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
      // A fala daquele ponto, logo abaixo: e o que permite ver de relance se o
      // corte esta no contexto certo, sem abrir a timeline.
      registrar(`        "${trecho(c.textoDaFrase)}"`, "vazio");
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
    for (const linha of resumoAprendizado) registrar(linha.texto, linha.tipo);
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
