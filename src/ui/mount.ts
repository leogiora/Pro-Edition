/*
 * Painel. So orquestra: le a configuracao, desenha, e chama o adapter.
 * Nenhuma chamada a `premierepro` mora aqui.
 */

import {
  DEFAULT_CONFIG,
  formatTimecode,
  parseConfig,
  recorte,
  relogio,
  type Config,
} from "../domain.ts";
import { analisar, type Analise } from "../analise.ts";
import {
  quantosNoLugar,
  pareceUndoEmLote,
  aprender,
  comPendente,
  creditarManuais,
  foiOPlugin,
  LIGACAO_MINIMA,
  ligacoesFirmes,
  parseAssociacoes,
  parseMemoria,
  parsePendentes,
  type Memoria,
  type Pendentes,
} from "../aprendizado.ts";
import { aplicarMerge, parseCanonico } from "../mesclar-canonico.ts";
import { CACHE_VAZIO, parseCacheIntensidade, ritmo } from "../intensidade.ts";
import {
  parseSinonimos,
  rotuloDoArquivo,
  sinonimosParaJson,
  SINONIMOS_PADRAO,
  usarSinonimos,
  type Conceito,
} from "../match.ts";
import { planejar, REGRAS_DENSAS, REGRAS_PADRAO, semSobrepor, type Ocupado } from "../plano.ts";
import type { Frase } from "../transcript.ts";
import {
  comLimite,
  getSequenceInfo,
  inserirPlano,
  lerBrollsAcimaDeV1,
  lerClipes,
  lerInOut,
  lerTranscricoes,
  listarPastaBrolls,
  medirBiblioteca,
  readJson,
  writeJson,
  type ArquivoBroll,
  type SequenceInfo,
} from "../premiere.ts";

const CONFIG_FILE = "config.json";
const MEMORIA_FILE = "aprendizado.json";
const PENDENTES_FILE = "pendentes.json";
const INTENSIDADE_FILE = "intensidade.json";
const ASSOCIACOES_FILE = "ligacoes.json";
const SINONIMOS_FILE = "sinonimos.json";
const CANONICO_FILE = "aprendizado-canonico.json";
const CANONICO_BASE_FILE = "aprendizado-canonico.base.json";
const LOG_ANALISE = "ultimo-log.json";
const LOG_APRENDER = "ultimo-aprendizado.json";

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

let log: HTMLElement;

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

/**
 * Grava o log onde da para ler de fora do Premiere. Nunca lanca.
 *
 * Arquivo por acao, e nao um so: com um arquivo unico, clicar em Analisar logo
 * depois de Aprender apagava a unica prova do que o Aprender tinha feito — foi
 * assim que um aprendizado inteiro passou por "nao aconteceu nada".
 */
async function salvarLog(arquivo: string): Promise<void> {
  try {
    // Guarda as ultimas execucoes, nao so a ultima. Um log que se apaga nao e
    // log: clicar duas vezes destruia a prova do clique que fez o trabalho, e
    // sobrava a do clique que nao tinha mais nada a fazer.
    const antes = await readJson(arquivo);
    const anteriores = Array.isArray((antes as { execucoes?: unknown })?.execucoes)
      ? ((antes as { execucoes: unknown[] }).execucoes as unknown[])
      : [];
    const execucoes = [{ quando: new Date().toISOString(), linhas }, ...anteriores].slice(0, 10);
    await writeJson(arquivo, { execucoes });
  } catch {
    // Sem log em arquivo o painel ainda funciona; nao vale derrubar nada.
  }
}

function estado(texto: string, tom: "" | "ativo" | "ok" | "aviso" | "erro" = ""): void {
  const node = el("estado");
  node.textContent = texto;
  node.setAttribute("data-tom", tom);
}

// Rotulos padrao dos dois botoes. Ficam aqui porque o botao troca de texto
// enquanto a acao roda, e precisa de para onde voltar.
const ROTULO_ANALISAR = "Analisar e inserir";
const ROTULO_APRENDER = "Aprender";

/**
 * Troca o texto de um botao. Puramente cosmetico — nunca lanca e nunca
 * interrompe nada.
 *
 * `aindaValido` nao e opcional de proposito: um rotulo tardio (o `setTimeout`
 * de sucesso, por exemplo) escreveria no botao do painel que estiver na tela
 * agora, que pode ser o do outro plugin dentro do shell. Mesma classe de bug
 * que o guard do log resolve.
 */
function rotular(id: string, texto: string, aindaValido: () => boolean): void {
  if (!aindaValido()) return;
  const botao = document.getElementById(id);
  if (botao) botao.textContent = texto;
}

function mensagemDeErro(e: unknown): string {
  const err = e as Error;
  return err?.message ?? String(e);
}

/**
 * Sinaliza que o painel foi desmontado (troca de tela no shell) enquanto uma
 * operacao assincrona ainda rodava. Nunca deve virar log nem mudar `estado`:
 * o #log e o #estado atuais, se existirem, pertencem a um mount() diferente
 * — escrever neles corromperia o log/status do painel que esta na tela agora.
 */
class PainelDesmontado extends Error {}

function checarMontado(aindaValido: () => boolean): void {
  if (!aindaValido()) throw new PainelDesmontado();
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

/**
 * Preenche o cabecalho com a sequencia.
 *
 * Separado porque toda acao ja le a sequencia de qualquer forma: pintar o
 * cabecalho junto custa nada e mantem o painel sempre falando da sequencia em
 * que ele esta trabalhando de verdade. Foi isto que tornou o botao "Reler"
 * dispensavel.
 */
function mostrarSequencia(info: SequenceInfo): void {
  const nome = el("seqNome");
  nome.textContent = info.name;
  nome.setAttribute("data-vazio", "nao");
  // A dica do estado vazio some assim que ha sequencia de verdade: instrucao
  // que continua na tela depois de cumprida vira ruido.
  el("seqDica").style.display = "none";
  el("seqFormato").textContent = `${info.width}x${info.height}`;
  el("seqFps").textContent = info.fps.toFixed(3).replace(".", ",");
  el("seqDuracao").textContent = formatTimecode(info.durationSeconds, info.fps);
  el("seqFaixas").textContent = `${info.videoTracks}V · ${info.audioTracks}A`;
}

async function relerSequencia(aindaValido: () => boolean): Promise<void> {
  estado("lendo", "ativo");
  try {
    const info = await comLimite("ler sequencia", getSequenceInfo());
    if (!aindaValido()) return;
    mostrarSequencia(info);
    estado("pronto", "ok");
  } catch (e) {
    if (!aindaValido()) return;
    const nome = el("seqNome");
    nome.textContent = "Nenhuma sequencia selecionada";
    nome.setAttribute("data-vazio", "sim");
    el("seqDica").style.display = "";
    for (const id of ["seqFormato", "seqFps", "seqDuracao", "seqFaixas"]) {
      el(id).textContent = "—";
    }
    estado("sem sequencia", "aviso");
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
  /**
   * O que ja ocupa as faixas de B-roll.
   *
   * Vem daqui porque a leitura ja foi feita para julgar — e e o mesmo instante
   * que interessa. Serve para nao inserir por cima do que voce fez.
   */
  readonly ocupado: readonly Ocupado[];
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
 * **Lanca se nao conseguir ler a timeline**, e isso mudou de proposito. Antes,
 * falhar aqui so adiava o aprendizado. Agora a mesma leitura diz o que ja esta
 * ocupado, e seguir sem ela significaria inserir por cima do trabalho do
 * usuario. Perder uma rodada de aprendizado custa pouco; apagar uma edicao dele
 * custa caro.
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

    // Tudo que veio do plugin — o que espera julgamento e o que ja foi julgado.
    // Sem a segunda parte, o proprio trabalho do plugin vira "colocacao sua".
    // Por POSICAO (D-033): so por nome, colocacao manual sua com arquivo que o
    // plugin ja usou era engolida como trabalho dele e nunca creditada.
    const presentes = new Set(naTimeline.map((c) => c.sourceName));
    const manuais = naTimeline
      .filter((c) => !foiOPlugin({ arquivo: c.sourceName, inicio: c.startSeconds }, pendente))
      .map((c) => ({ arquivo: c.sourceName, inicio: c.startSeconds, fim: c.endSeconds }));

    // Nada apagado e nada colocado desde o plano anterior significa que ninguem
    // editou — provavelmente foi so um segundo clique em Analisar. Contar isso
    // seria inventar sinal: no uso real essa esteira inflou um par ate 106
    // acertos, e af afogou as exclusoes de verdade.
    // So o que espera julgamento conta como "apagado". Os `postos` de rodadas
    // ja julgadas sumiram ha muito tempo e nao sao noticia.
    const apagou = (pendente?.itens ?? []).some((i) => !presentes.has(i.arquivo));
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
        // Quase nada do lote sobrou: mais provavel Ctrl+Z ou varrida da faixa
        // (o proprio painel sugere "Tres Ctrl+Z desfazem tudo") do que voce ter
        // apagado um por um. Contar isso como erro puniria os conceitos por um
        // teste, nao por rejeicao real — mesmo raciocinio do "semEdicao" acima,
        // so que para o outro extremo.
        // "Sobreviver" aqui e POR POSICAO (D-032): nome sozinho colide com
        // B-roll manual e sobra de rodada antiga, e ja furou esta trava.
        const sobreviventes = quantosNoLugar(
          pendente.itens,
          naTimeline.map((c) => ({ arquivo: c.sourceName, inicio: c.startSeconds })),
          presentes
        );
        if (pareceUndoEmLote(pendente.itens.length, sobreviventes)) {
          julgado = comPendente(pendentes, sequencia, null);
          resumo.push({
            texto: `Sobrou ${sobreviventes} de ${pendente.itens.length} B-rolls da rodada anterior — parece o lote desfeito, nao rejeicao item a item. Nao contei como erro.`,
            tipo: "aviso",
          });
        } else {
          const r = aprender(atual, pendente, presentes);
          atual = r.memoria;
          // O pendente sai da lista na mesma rodada em que e contado.
          julgado = comPendente(pendentes, sequencia, null);
          resumo.push({
            texto: `Aprendi da rodada anterior: voce manteve ${r.acertos} e apagou ${r.erros}.`,
            tipo: "ok",
          });
        }
      }

      // 2. O que esta na timeline sem ter vindo do plano foi voce quem pos.
      if (manuais.length > 0) {
        const antes = parseAssociacoes(
          await comLimite("ler ligacoes", readJson(ASSOCIACOES_FILE), 5000)
        );
        const credito = creditarManuais(atual, sequencia, manuais, frases, conceitos, antes);
        atual = credito.memoria;

        if (credito.associacoes !== antes) {
          await writeJson(ASSOCIACOES_FILE, credito.associacoes);
          // Ligacao nova e o plugin inventando dicionario: tem de aparecer.
          const novas = ligacoesFirmes(credito.associacoes);
          for (const [conceito, termos] of novas) {
            if (ligacoesFirmes(antes).has(conceito)) continue;
            resumo.push({
              texto: `Aprendi que "${termos.join(", ")}" pede "${conceito}" — voce ligou os dois ${LIGACAO_MINIMA} vezes.`,
              tipo: "ok",
            });
          }
        }
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
        // Nao ha o que contar aqui, mas ha o que dizer: falta ligacao no
        // dicionario. TODAS, sem cortar em tres — a lista cortada fazia
        // parecer que as colocacoes mais adiante nao tinham sido vistas.
        for (const sugestao of credito.semLigacao) {
          resumo.push({ texto: sugestao, tipo: "aviso" });
        }
      }
    }

    await writeJson(MEMORIA_FILE, atual);
    if (julgado !== pendentes) await writeJson(PENDENTES_FILE, julgado);

    // TERCEIRA vez que este projeto confunde silencio com falha. Sem plano
    // pendente e sem colocacao sua nao ha mesmo o que aprender — mas isso e uma
    // resposta, e resposta se escreve.
    if (resumo.length === 0) {
      resumo.push({
        texto: "Nada novo para aprender: nenhum plano pendente e nenhum B-roll seu na timeline.",
        tipo: "aviso",
      });
    }

    return {
      memoria: atual,
      pendentes: julgado,
      resumo,
      ocupado: naTimeline.map((c) => ({
        inicio: c.startSeconds,
        fim: c.endSeconds,
        arquivo: c.sourceName,
        conceito: rotuloDoArquivo(c.sourceName),
      })),
    };
  } catch (e) {
    // Sem saber o que ha na timeline, o seguro e nao inserir nada por cima:
    // lista vazia aqui liberaria tudo, entao o erro precisa parar a insercao.
    throw new Error(`Nao consegui ler a timeline: ${mensagemDeErro(e)}`);
  }
}

/** Frase cortada para caber numa linha do painel, que e estreito. */
function trecho(texto: string, limite = 70): string {
  return texto.length <= limite ? texto : `${texto.slice(0, limite)}...`;
}

/**
 * Tudo o que os dois botoes precisam antes de divergir: a biblioteca no disco, o
 * corte de V1, a transcricao reconstruida e as ligacoes ja aprendidas.
 */
async function lerContexto(aindaValido: () => boolean): Promise<{
  arquivos: ArquivoBroll[];
  resultado: Analise;
  nomeSequencia: string;
  duracaoDaSequencia: number;
}> {
  const pasta = el<Campo>("libraryPath").value.trim();
  if (!pasta) throw new Error("Informe a pasta de B-rolls.");

  const arquivos = await comLimite("listar pasta de B-rolls", listarPastaBrolls(pasta), 30000);
  checarMontado(aindaValido);
  if (arquivos.length === 0) throw new Error(`Nenhum video em ${pasta}.`);
  registrar(`${arquivos.length} B-rolls na pasta`, "passo");

  // Pasta que funcionou fica gravada: digitar uma vez basta.
  void writeJson(CONFIG_FILE, lerFormulario()).catch(() => undefined);

  const clipes = await comLimite("ler clipes de V1", lerClipes(0), 30000);
  checarMontado(aindaValido);
  if (clipes.length === 0) throw new Error("V1 esta vazia. Nao ha o que analisar.");
  registrar(`${clipes.length} clipes em V1`, "passo");

  const nomes = [...new Set(clipes.map((c) => c.sourceName))];
  const { transcricoes: transcricoesJson, falhas } = await comLimite(
    "ler transcricoes",
    lerTranscricoes(nomes),
    60000
  );
  checarMontado(aindaValido);
  registrar(`${transcricoesJson.size} de ${nomes.length} midias com transcricao`, "passo");
  for (const f of falhas) registrar(`"${f.nome}": ${f.motivo}`, "aviso");

  const info = await comLimite("ler sequencia", getSequenceInfo());
  checarMontado(aindaValido);
  mostrarSequencia(info);
  const nomeSequencia = info.name;

  const ligacoes = ligacoesFirmes(
    parseAssociacoes(await comLimite("ler ligacoes", readJson(ASSOCIACOES_FILE), 5000))
  );
  checarMontado(aindaValido);
  if (ligacoes.size > 0) {
    registrar(`${ligacoes.size} conceitos com ligacao que voce ensinou`, "passo");
  }

  const resultado = analisar({
    clipes,
    transcricoesJson,
    biblioteca: arquivos.map((a) => a.name),
    ligacoes,
  });

  registrar(
    `${resultado.palavras} palavras · ${resultado.frases.length} frases · ${resultado.conceitos.length} conceitos`,
    "passo"
  );

  return { arquivos, resultado, nomeSequencia, duracaoDaSequencia: info.durationSeconds };
}

/**
 * Aprender sem inserir nada.
 *
 * Edite a sequencia como quiser — apague o que nao serviu, ponha o que faltava —
 * e clique aqui. O plugin le a timeline, entende o que voce fez e guarda. Antes
 * disto, a unica forma de ensinar era deixar ele inserir de novo.
 */
async function aprenderDaTimeline(aindaValido: () => boolean): Promise<void> {
  const botao = el<HTMLButtonElement & { disabled: boolean }>("aprender");
  botao.disabled = true;
  rotular("aprender", "Aprendendo...", aindaValido);
  estado("aprendendo", "ativo");
  limparLog();

  let resumoAprendizado: Julgamento["resumo"] = [];
  try {
    const { resultado, nomeSequencia } = await lerContexto(aindaValido);
    const { resumo } = await julgarFaixa(nomeSequencia, resultado.frases, resultado.conceitos);
    checarMontado(aindaValido);
    resumoAprendizado = resumo;
    // Este botao nao insere nada, entao o log dele e curto e some no clique
    // seguinte. Vale dizer que terminou.
    registrar("Aprendizado gravado. Nada foi inserido na timeline.", "ok");
    estado("pronto", "ok");
  } catch (e) {
    if (!(e instanceof PainelDesmontado)) {
      registrar(mensagemDeErro(e), "erro");
      estado("falhou", "erro");
    }
  } finally {
    if (aindaValido()) {
      for (const linha of resumoAprendizado) registrar(linha.texto, linha.tipo);
    }
    rotular("aprender", ROTULO_APRENDER, aindaValido);
    botao.disabled = false;
    await salvarLog(LOG_APRENDER);
  }
}

async function analisarSequencia(aindaValido: () => boolean): Promise<void> {
  const botao = el<HTMLButtonElement & { disabled: boolean }>("analisar");
  botao.disabled = true;
  rotular("analisar", "Analisando...", aindaValido);
  estado("analisando", "ativo");
  limparLog();

  // Sai no `finally`: assim aparece por ultimo — visivel — em qualquer saida,
  // inclusive quando a analise nao acha oportunidade ou falha no meio.
  let resumoAprendizado: Julgamento["resumo"] = [];
  // Quantos entraram de verdade na timeline: e o que o rotulo do botao anuncia
  // no fim. Zero e uma resposta legitima (nada a inserir), nao um sucesso.
  let inseridos = 0;

  try {
    const config = lerFormulario();
    const { arquivos, resultado, nomeSequencia, duracaoDaSequencia } = await lerContexto(aindaValido);

    for (const aviso of resultado.avisos.slice(0, 6)) registrar(aviso, "aviso");

    // In/out marcados na timeline recortam ONDE o plugin insere. So o
    // Analisar respeita o recorte — o Aprender continua lendo a sequencia
    // inteira, senao colocacao sua fora do trecho deixaria de ensinar.
    const marcado = await comLimite("ler in/out", lerInOut(), 5000);
    checarMontado(aindaValido);
    const selecao = marcado === null ? null : recorte(marcado.inicio, marcado.fim, duracaoDaSequencia);
    if (selecao !== null) {
      registrar(
        `In/out marcados: inserindo so de ${relogio(selecao.inicio)} a ${relogio(selecao.fim)}. Para a sequencia inteira, limpe o in/out.`,
        "passo"
      );
    }

    // Depois da analise, de proposito: creditar o que voce colocou na mao exige
    // saber o que estava sendo dito naquele instante, e isso so existe agora.
    const { memoria, pendentes, resumo, ocupado } = await julgarFaixa(
      nomeSequencia,
      resultado.frases,
      resultado.conceitos
    );
    checarMontado(aindaValido);
    resumoAprendizado = resumo;

    // Frases que nem encostam no trecho marcado ficam de fora ANTES do
    // planejamento: espacamento e janela de repeticao valem dentro do trecho,
    // sem colocacao fantasma de fora consumindo o espaco de quem esta dentro.
    const oportunidades =
      selecao === null
        ? resultado.oportunidades
        : resultado.oportunidades.filter((o) => o.frase.fim > selecao.inicio && o.frase.inicio < selecao.fim);

    if (oportunidades.length === 0) {
      registrar(
        selecao === null
          ? "Nenhuma oportunidade de B-roll encontrada."
          : "Nenhuma oportunidade de B-roll no trecho marcado.",
        "vazio"
      );
      estado("nada a inserir", "ok");
      return;
    }

    // Medir a biblioteca: a primeira vez custa dezenas de segundos, as
    // seguintes nao custam nada. Falhar aqui so tira a escolha de take pelo
    // momento; nao pode tirar a insercao.
    checarMontado(aindaValido);
    const cache = parseCacheIntensidade(
      await comLimite("ler intensidade", readJson(INTENSIDADE_FILE), 5000)
    );
    checarMontado(aindaValido);
    let medido = cache;
    try {
      medido = await comLimite(
        "medir intensidade",
        medirBiblioteca(arquivos, cache, (feitos, total) => {
          if (aindaValido()) registrar(`  medindo intensidade: ${feitos} de ${total}`, "passo");
        }),
        300000
      );
      checarMontado(aindaValido);
      if (medido !== cache) await writeJson(INTENSIDADE_FILE, medido);
    } catch (e) {
      if (e instanceof PainelDesmontado) throw e;
      registrar(`Intensidade nao medida, seguindo sem ela. ${mensagemDeErro(e)}`, "aviso");
      medido = CACHE_VAZIO;
    }

    const porArquivo = new Map<string, number>();
    for (const [nome, valor] of Object.entries(medido.arquivos)) {
      if (valor !== null) porArquivo.set(nome, valor);
    }

    // Os B-rolls que ja estao na timeline FORA do trecho marcado (de reels
    // vizinhos ja analisados, ou colocados por voce) contam como uso anterior:
    // sem isto cada trecho replaneja cego ao vizinho e repete os mesmos takes.
    // So o que esta fora — dentro do trecho, `semSobrepor` ja resolve, e semear
    // ali encheria o log de "conceito repetido" a cada reanalise.
    const jaNaTimeline =
      selecao === null
        ? []
        : ocupado.filter((o) => o.fim <= selecao.inicio || o.inicio >= selecao.fim);

    const plano = planejar(
      oportunidades,
      { caminhos: new Map(arquivos.map((a) => [a.name, a.nativePath])) },
      config.densidadeMaxima ? REGRAS_DENSAS : REGRAS_PADRAO,
      memoria,
      { porArquivo, ritmoDasFrases: resultado.frases.map((f) => ritmo(f.palavras, f.duracao)) },
      jaNaTimeline
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

    // Uma frase que atravessa o in ou o out ainda pode ancorar fora do trecho.
    // A borda e dura: o que comeca fora, nao entra.
    let colocacoes = plano.colocacoes;
    if (selecao !== null) {
      for (const fora of colocacoes.filter((c) => c.inicio < selecao.inicio || c.inicio >= selecao.fim)) {
        registrar(`  ${relogio(fora.inicio)} ${fora.conceito}: fora do trecho marcado`, "vazio");
      }
      colocacoes = colocacoes.filter((c) => c.inicio >= selecao.inicio && c.inicio < selecao.fim);
    }

    // O planejador monta o plano ideal do zero, cego para o que ja foi feito.
    // Aqui o que ja esta na timeline manda: nada entra por cima.
    const { entram, bloqueadas } = semSobrepor(colocacoes, ocupado);
    for (const b of bloqueadas) registrar(`  ${b}`, "vazio");

    if (entram.length === 0 && bloqueadas.length > 0) {
      registrar("Tudo o que eu sugeriria ja esta na timeline. Nada a fazer.", "ok");
      estado("nada a inserir", "ok");
      return;
    }

    if (entram.length === 0) {
      registrar("Nenhuma sugestao boa o bastante para entrar sozinha.", "aviso");
      estado("nada a inserir", "ok");
      return;
    }

    registrar(`${entram.length} B-rolls a inserir:`, "ok");
    for (const c of entram) {
      registrar(
        `${relogio(c.inicio)}  ${c.arquivo}  ${c.duracao.toFixed(1)}s · ${Math.round(c.score * 100)}% · ${c.motivo}`,
        "passo"
      );
      // A fala daquele ponto, logo abaixo: e o que permite ver de relance se o
      // corte esta no contexto certo, sem abrir a timeline.
      registrar(`        "${trecho(c.textoDaFrase)}"`, "vazio");
    }

    estado("inserindo", "ativo");
    const feito = await comLimite(
      "inserir plano",
      inserirPlano(entram, {
        videoTrackIndex: config.videoTrackIndex,
        audioTrackIndex: config.audioTrackIndex,
        removerAudio: config.removeAudio,
        preencherTela: config.fillScreen,
      }),
      120000
    );
    checarMontado(aindaValido);
    inseridos = entram.length;
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
          itens: entram.map((c) => ({
            arquivo: c.arquivo,
            conceito: c.conceito,
            termosCasados: c.termosCasados,
            inicio: c.inicio,
          })),
        })
      );
      checarMontado(aindaValido);
      registrar("Apague os que nao serviram: a proxima analise aprende com isso.", "vazio");
    } catch (e) {
      if (e instanceof PainelDesmontado) throw e;
      registrar(`Plano nao ficou guardado, esta rodada nao vai ensinar nada. ${mensagemDeErro(e)}`, "aviso");
    }

    estado("pronto", "ok");
  } catch (e) {
    if (!(e instanceof PainelDesmontado)) {
      registrar(mensagemDeErro(e), "erro");
      estado("falhou", "erro");
    }
  } finally {
    if (aindaValido()) {
      for (const linha of resumoAprendizado) registrar(linha.texto, linha.tipo);
    }
    if (inseridos > 0) {
      // Confirmacao curta no proprio botao, e depois ele volta a convidar o
      // clique seguinte. Um botao que fica "✓ inserido" para sempre deixa de
      // dizer o que faz.
      rotular("analisar", `✓ ${inseridos} B-rolls inseridos`, aindaValido);
      setTimeout(() => rotular("analisar", ROTULO_ANALISAR, aindaValido), 2500);
    } else {
      rotular("analisar", ROTULO_ANALISAR, aindaValido);
    }
    botao.disabled = false;
    await salvarLog(LOG_ANALISE);
  }
}

/**
 * Funde o aprendizado canonico do dono (entregue no PluginData pelo script
 * Atualizar) com o aprendizado local. Roda uma vez por versao de snapshot —
 * o gate e o `version` gravado em aprendizado-canonico.base.json.
 *
 * Nunca lanca e nunca toca `vistos`: se algo der errado, o aprendizado da
 * editora fica exatamente como estava.
 */
async function mesclarCanonicoNoDisco(aindaValido: () => boolean): Promise<void> {
  try {
    const bruto = await comLimite("ler canonico", readJson(CANONICO_FILE), 5000);
    if (!aindaValido()) return;
    if (bruto === null) return; // nenhum snapshot para fundir

    const canonico = parseCanonico(bruto);
    if (canonico === null) {
      registrar(`${CANONICO_FILE} ilegivel: merge ignorado, aprendizado local intacto.`, "aviso");
      return;
    }

    const base = parseCanonico(
      await comLimite("ler base do canonico", readJson(CANONICO_BASE_FILE), 5000)
    );
    if (!aindaValido()) return;
    if (base !== null && base.version === canonico.version) return; // ja fundido

    const memoria = parseMemoria(
      await comLimite("ler aprendizado", readJson(MEMORIA_FILE), 5000)
    );
    const associacoes = parseAssociacoes(
      await comLimite("ler ligacoes", readJson(ASSOCIACOES_FILE), 5000)
    );
    const sinDisco = parseSinonimos(
      await comLimite("ler sinonimos", readJson(SINONIMOS_FILE), 5000)
    );
    if (!aindaValido()) return;

    const fundido = aplicarMerge(
      { memoria, associacoes, sinonimos: sinDisco ?? SINONIMOS_PADRAO },
      canonico,
      base
    );

    const carimbo = new Date().toISOString().slice(0, 10);
    await writeJson(`${MEMORIA_FILE}.bak-antes-merge-${carimbo}`, memoria);
    await writeJson(`${ASSOCIACOES_FILE}.bak-antes-merge-${carimbo}`, associacoes);
    await writeJson(MEMORIA_FILE, fundido.memoria);
    await writeJson(ASSOCIACOES_FILE, fundido.associacoes);
    await writeJson(SINONIMOS_FILE, sinonimosParaJson(fundido.sinonimos));
    // Grava o snapshot BRUTO, nao o `canonico` parseado: `CanonicoSnapshot.sinonimos`
    // e um Map, e `JSON.stringify(Map)` vira `{}` — a baseline perderia os
    // sinonimos em silencio. `parseCanonico(bruto)` no proximo boot reconstroi
    // a mesma base, e o gate por `version` continua valendo.
    await writeJson(CANONICO_BASE_FILE, bruto);

    const nP = Object.keys(fundido.memoria.pares).length;
    const nA = Object.keys(fundido.memoria.arquivos).length;
    const nL = Object.keys(fundido.associacoes.pares).length;
    registrar(
      `Merge do aprendizado canonico v${canonico.version}: ${nP} pares, ${nA} arquivos, ${nL} ligacoes.`,
      "ok"
    );
  } catch (e) {
    if (!aindaValido()) return;
    registrar(`Merge do canonico falhou (aprendizado local intacto). ${mensagemDeErro(e)}`, "aviso");
  }
}

/**
 * Carrega o dicionario editavel, criando-o na primeira vez.
 *
 * Ate agora, ligar "disfuncao" a "Desanimado" ou desligar "consultorio" de
 * "Doutor" exigia alterar codigo e recompilar. Sao ajustes de vocabulario, e
 * quem sabe o vocabulario e quem edita — nao quem programa.
 *
 * Arquivo quebrado nunca vira dicionario vazio: cai no padrao e avisa. Um
 * dicionario vazio degradaria o casamento inteiro em silencio.
 */
async function carregarSinonimos(aindaValido: () => boolean): Promise<void> {
  try {
    const bruto = await comLimite("ler sinonimos", readJson(SINONIMOS_FILE), 5000);
    if (!aindaValido()) return;
    if (bruto === null) {
      // Primeira vez: grava o padrao para o usuario ter o que editar.
      await writeJson(SINONIMOS_FILE, sinonimosParaJson(SINONIMOS_PADRAO));
      if (!aindaValido()) return;
      registrar(`Dicionario criado em ${SINONIMOS_FILE}, na pasta de dados do plugin.`, "vazio");
      return;
    }

    const doDisco = parseSinonimos(bruto);
    if (doDisco === null) {
      registrar(`${SINONIMOS_FILE} ilegivel: usando o dicionario padrao.`, "aviso");
      return;
    }

    usarSinonimos(doDisco);
    registrar(`Dicionario: ${doDisco.size} entradas de ${SINONIMOS_FILE}`, "vazio");
  } catch (e) {
    if (!aindaValido()) return;
    registrar(`Dicionario nao carregou, usando o padrao. ${mensagemDeErro(e)}`, "aviso");
  }
}

// ------------------------------------------------------------ log panel

/**
 * Liga um `div[role="button"]` — clique E teclado.
 *
 * Um `<button>` nativo daria o teclado de graca, mas o UXP o renderiza como
 * controle do host: ignora o CSS do proprio elemento e achata os filhos numa
 * linha so (foi assim que os cards do Pro Edition viraram pilula cinza). Com
 * div o visual e nosso, e o Enter/Espaco volta a ser responsabilidade nossa.
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
 * escondido por padrao repete o erro que ja fez este plugin parecer morto duas
 * vezes (docs/UXP_ARMADILHAS.md §8). Recolher e escolha de quem ja sabe o que
 * esta acontecendo.
 */
function alternarLog(): void {
  const secao = el("secaoLog");
  const alternador = el("logToggle");
  const aberto = secao.getAttribute("data-aberto") !== "nao";
  secao.setAttribute("data-aberto", aberto ? "nao" : "sim");
  alternador.textContent = aberto ? "Mostrar" : "Recolher";
  alternador.setAttribute("aria-expanded", aberto ? "false" : "true");
  alternador.setAttribute("aria-label", aberto ? "Mostrar o registro" : "Recolher o registro");
}

// ---------------------------------------------------------------- inicio

/**
 * `root` nao e usado no corpo: el() busca por id em `document` inteiro, nao
 * escopado a `root`. So e seguro porque o shell (Pro Edition) nunca monta
 * duas ferramentas ao mesmo tempo — troca document.body.innerHTML inteiro
 * antes de cada mount() (contrato documentado no spec do Pro Edition). Se
 * isso mudar (montagem parcial, mount() chamado 2x sem substituir o DOM),
 * el() precisa passar a escopar a busca a partir de `root`.
 */
export function mount(root: HTMLElement): void {
  log = el("log");
  const meuLog = log; // snapshot desta chamada — log e reatribuido a cada mount()
  // Vale para QUALQUER operacao assincrona disparada por este mount: boot e
  // cliques nos botoes. Sem isto, uma Analise ainda em andamento quando o
  // shell troca de tela (Pro Edition) escreve seu resultado tardio no #log
  // e no #estado do painel que esta na tela agora, nao mais no seu.
  const aindaValido = () => document.body.contains(meuLog);

  // Primeira coisa visivel: se o distintivo continuar dizendo "carregando",
  // o script nao rodou, e o problema esta no carregamento — nao na logica.
  estado("ligando", "ativo");

  // Os botoes sao ligados PRIMEIRO e de forma sincrona. Qualquer I/O do UXP
  // pode pendurar para sempre; se a ligacao viesse depois, um `await` travado
  // deixaria o painel inteiro inerte — sem log, sem erro, sem reacao ao clique.
  el("analisar").addEventListener("click", () => {
    void analisarSequencia(aindaValido);
  });
  el("aprender").addEventListener("click", () => {
    void aprenderDaTimeline(aindaValido);
  });
  ligarAcao(el("logToggle"), alternarLog);
  // Com os botoes ja vivos, o resto pode falhar sem deixar o painel inutil.
  preencherFormulario(DEFAULT_CONFIG);
  estado("pronto", "ok");
  registrar("Painel pronto.", "vazio");

  void (async () => {
    if (!aindaValido()) return;

    try {
      const salva = await comLimite("ler configuracao", readJson(CONFIG_FILE), 5000);
      if (!aindaValido()) return;
      if (salva !== null) preencherFormulario(parseConfig(salva));
    } catch (e) {
      if (!aindaValido()) return;
      registrar(`Configuracao nao carregou, usando padrao. ${mensagemDeErro(e)}`, "aviso");
    }
    if (!aindaValido()) return;
    await mesclarCanonicoNoDisco(aindaValido);
    if (!aindaValido()) return;
    await carregarSinonimos(aindaValido);
    if (!aindaValido()) return;
    await relerSequencia(aindaValido);
  })();
}
