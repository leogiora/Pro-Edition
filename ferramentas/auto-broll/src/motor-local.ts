/*
 * Motor do B-Roller dentro do plugin: le a timeline, analisa, insere e
 * aprende. Era o corpo do painel antigo (ui/mount.ts); a tela agora so pede
 * (motor local no painel, remoto pela ponte no programa) e desenha.
 * Nada aqui toca no DOM.
 */

import {
  DEFAULT_CONFIG,
  ehVideo,
  parseConfig,
  recorte,
  relogio,
  type Config,
} from "./domain.ts";
import { analisar, type Analise } from "./analise.ts";
import {
  quantosNoLugar,
  pareceUndoEmLote,
  aprender,
  comPendente,
  comTrazido,
  creditarManuais,
  foiOPlugin,
  LIGACAO_MINIMA,
  ligacoesFirmes,
  parseAssociacoes,
  parseMemoria,
  parsePendentes,
  parseTrazidos,
  planejarTrazer,
  type Memoria,
  type Pendentes,
} from "./aprendizado.ts";
import { aplicarMerge, parseCanonico } from "./mesclar-canonico.ts";
import { CACHE_VAZIO, parseCacheIntensidade, ritmo } from "./intensidade.ts";
import {
  conceitosDeArquivos,
  parseSinonimos,
  rotuloDoArquivo,
  sinonimosParaJson,
  SINONIMOS_PADRAO,
  usarSinonimos,
  type Conceito,
} from "./match.ts";
import { planejar, REGRAS_DENSAS, REGRAS_PADRAO, semSobrepor, type Ocupado } from "./plano.ts";
import type { Frase } from "./transcript.ts";
import type { Inserido, MotorBroll, RegistrarBroll, ResultadoBroll, TomBroll, TrechoBroll } from "./broller.ts";
import {
  comLimite,
  copiarParaBiblioteca,
  dimensoesDoArquivo,
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
  type BrollNaTimeline,
  type SequenceInfo,
} from "./premiere.ts";

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
/** Clipes baixados que o Aprender levou para a pasta (o Auto Split le o tamanho daqui). */
const TRAZIDOS_FILE = "trazidos.json";


/** Para onde vai cada linha da acao em curso (a tela do painel ou a ponte). */
let saida: RegistrarBroll = () => undefined;

/** Espelho do registro em texto: tudo tambem vai para arquivo (salvarLog). */
let linhas: string[] = [];

function registrar(texto: string, tipo: TomBroll = "passo"): void {
  linhas.push(texto);
  saida(texto, tipo);
}

/** Uma acao por vez: as linhas dela, do comeco, para a tela que pediu. */
function comecar(para: RegistrarBroll): void {
  linhas = [];
  saida = para;
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

function mensagemDeErro(e: unknown): string {
  const err = e as Error;
  return err?.message ?? String(e);
}

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
  conceitos: readonly Conceito[],
  biblioteca: { readonly pasta: string; readonly nomes: readonly string[] },
  trazer: boolean
): Promise<Julgamento> {
  const memoria = parseMemoria(await comLimite("ler aprendizado", readJson(MEMORIA_FILE), 5000));
  const pendentes = parsePendentes(await comLimite("ler pendentes", readJson(PENDENTES_FILE), 5000));
  const pendente = pendentes.porSequencia[sequencia];

  try {
    // Qualquer faixa acima de V1, nao so a de destino: empilhar na V3 e o que
    // o editor faz quando nao quer sobrescrever.
    const naTimeline = await comLimite("ler B-rolls da timeline", lerBrollsAcimaDeV1(), 30000);
    const resumo: Linha[] = [];

    // 0. Clipe baixado (fora da pasta) e renomeado no painel Projeto vai para a
    // pasta com esse nome — so no Aprender, que e onde o Leo pede. O que ja foi
    // levado antes passa a contar pelo nome na pasta, nos dois botoes.
    const nomesNaPasta = new Set(biblioteca.nomes);
    const trazidosAntes = parseTrazidos(await comLimite("ler trazidos", readJson(TRAZIDOS_FILE), 5000).catch(() => null));
    const plano = planejarTrazer(
      naTimeline
        .filter((c) => c.caminho !== "" && ehVideo(c.sourceName) && !nomesNaPasta.has(c.sourceName))
        .map((c) => ({ caminho: c.caminho, nomeNoProjeto: c.nomeNoProjeto })),
      biblioteca.nomes,
      trazidosAntes
    );
    const naPasta = new Map(plano.jaNaPasta);
    const levados: string[] = [];
    if (trazer) {
      let trazidos = trazidosAntes;
      for (const c of plano.copiar) {
        const origem = c.caminho.split(/[\\/]/).pop() ?? c.caminho;
        try {
          // 10 min: e disco local, mas o Envato manda .mov de 500 MB.
          await comLimite(`copiar ${c.nome}`, copiarParaBiblioteca(c.caminho, biblioteca.pasta, c.nome), 600000);
          // O Auto Split precisa do tamanho, e o perfil empacotado nao conhece arquivo novo.
          const tam = await comLimite(`medir ${c.nome}`, dimensoesDoArquivo(c.caminho), 120000).catch(() => null);
          trazidos = comTrazido(trazidos, c.caminho, { nome: c.nome, ...(tam ? { w: tam.width, h: tam.height } : {}) });
          naPasta.set(c.caminho, c.nome);
          levados.push(c.nome);
          resumo.push({ texto: `Levei "${origem}" para a pasta de B-rolls como "${c.nome}".`, tipo: "ok" });
        } catch (e) {
          resumo.push({ texto: `Nao consegui levar "${origem}" para a pasta: ${mensagemDeErro(e)}`, tipo: "aviso" });
        }
      }
      if (trazidos !== trazidosAntes) await writeJson(TRAZIDOS_FILE, trazidos);
      if (plano.semNome.length > 0) {
        resumo.push({
          texto: `${plano.semNome.length} clipe(s) de fora da pasta sem nome de conceito: ${plano.semNome.join(", ")}. Renomeie no painel Projeto (ex.: "Mulher triste") e clique em Aprender de novo.`,
          tipo: "aviso",
        });
      }
    }
    const nomeNaPasta = (c: BrollNaTimeline): string => naPasta.get(c.caminho) ?? c.sourceName;
    // Arquivo recem-levado ainda nao estava na lista que a analise montou.
    const conceitosDoCredito = levados.length > 0 ? conceitosDeArquivos([...biblioteca.nomes, ...levados]) : conceitos;

    // Tudo que veio do plugin — o que espera julgamento e o que ja foi julgado.
    // Sem a segunda parte, o proprio trabalho do plugin vira "colocacao sua".
    // Por POSICAO (D-033): so por nome, colocacao manual sua com arquivo que o
    // plugin ja usou era engolida como trabalho dele e nunca creditada.
    const presentes = new Set(naTimeline.map((c) => c.sourceName));
    const manuais = naTimeline
      // Light leak (.aegraphic) e grafico nao sao B-roll: no Andro 19.09 eram a
      // maior parte dos 133 "fora da pasta" do log, escondendo o que importa.
      .filter((c) => ehVideo(c.sourceName))
      .filter((c) => !foiOPlugin({ arquivo: c.sourceName, inicio: c.startSeconds }, pendente))
      .map((c) => ({ arquivo: nomeNaPasta(c), inicio: c.startSeconds, fim: c.endSeconds }));

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
        const credito = creditarManuais(atual, sequencia, manuais, frases, conceitosDoCredito, antes);
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
        arquivo: nomeNaPasta(c),
        conceito: rotuloDoArquivo(nomeNaPasta(c)),
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
async function lerContexto(config: Config): Promise<{
  pasta: string;
  arquivos: ArquivoBroll[];
  resultado: Analise;
  nomeSequencia: string;
  duracaoDaSequencia: number;
}> {
  const pasta = config.libraryPath.trim();
  if (!pasta) throw new Error("Informe a pasta de B-rolls.");

  const arquivos = await comLimite("listar pasta de B-rolls", listarPastaBrolls(pasta), 30000);
  if (arquivos.length === 0) throw new Error(`Nenhum video em ${pasta}.`);
  registrar(`${arquivos.length} B-rolls na pasta`, "passo");

  // Pasta que funcionou fica gravada: digitar uma vez basta.
  void writeJson(CONFIG_FILE, { ...config, libraryPath: pasta }).catch(() => undefined);

  const clipes = await comLimite("ler clipes de V1", lerClipes(0), 30000);
  if (clipes.length === 0) throw new Error("V1 esta vazia. Nao ha o que analisar.");
  registrar(`${clipes.length} clipes em V1`, "passo");

  const nomes = [...new Set(clipes.map((c) => c.sourceName))];
  const { transcricoes: transcricoesJson, falhas } = await comLimite(
    "ler transcricoes",
    lerTranscricoes(nomes),
    60000
  );
  registrar(`${transcricoesJson.size} de ${nomes.length} midias com transcricao`, "passo");
  for (const f of falhas) registrar(`"${f.nome}": ${f.motivo}`, "aviso");

  const info = await comLimite("ler sequencia", getSequenceInfo());

  const ligacoes = ligacoesFirmes(
    parseAssociacoes(await comLimite("ler ligacoes", readJson(ASSOCIACOES_FILE), 5000))
  );
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

  return { pasta, arquivos, resultado, nomeSequencia: info.name, duracaoDaSequencia: info.durationSeconds };
}

/**
 * Aprender sem inserir nada.
 *
 * Edite a sequencia como quiser — apague o que nao serviu, ponha o que faltava —
 * e clique aqui. O plugin le a timeline, entende o que voce fez e guarda. Antes
 * disto, a unica forma de ensinar era deixar ele inserir de novo.
 */
async function aprenderDaTimeline(config: Config, para: RegistrarBroll): Promise<void> {
  comecar(para);
  let resumoAprendizado: Julgamento["resumo"] = [];
  try {
    const { pasta, arquivos, resultado, nomeSequencia } = await lerContexto(config);
    const biblioteca = { pasta, nomes: arquivos.map((a) => a.name) };
    const { resumo } = await julgarFaixa(nomeSequencia, resultado.frases, resultado.conceitos, biblioteca, true);
    resumoAprendizado = resumo;
    // Este botao nao insere nada, entao o log dele e curto e some no clique
    // seguinte. Vale dizer que terminou.
    registrar("Aprendizado gravado. Nada foi inserido na timeline.", "ok");
  } catch (e) {
    registrar(mensagemDeErro(e), "erro");
    throw e;
  } finally {
    for (const linha of resumoAprendizado) registrar(linha.texto, linha.tipo);
    await salvarLog(LOG_APRENDER);
  }
}

async function analisarSequencia(config: Config, para: RegistrarBroll): Promise<ResultadoBroll> {
  comecar(para);
  // Sai no `finally`: assim aparece por ultimo — visivel — em qualquer saida,
  // inclusive quando a analise nao acha oportunidade ou falha no meio.
  let resumoAprendizado: Julgamento["resumo"] = [];

  try {
    const { pasta, arquivos, resultado, nomeSequencia, duracaoDaSequencia } = await lerContexto(config);
    // A tela desenha a timeline com o que ja estava e o que entrou.
    let antes: readonly TrechoBroll[] = [];
    const resultado_ = (inseridos: readonly Inserido[]): ResultadoBroll => ({
      nome: nomeSequencia,
      duracaoS: duracaoDaSequencia,
      naPasta: arquivos.length,
      naTimeline: antes,
      inseridos,
    });

    for (const aviso of resultado.avisos.slice(0, 6)) registrar(aviso, "aviso");

    // In/out marcados na timeline recortam ONDE o plugin insere. So o
    // Analisar respeita o recorte — o Aprender continua lendo a sequencia
    // inteira, senao colocacao sua fora do trecho deixaria de ensinar.
    const marcado = await comLimite("ler in/out", lerInOut(), 5000);
    const selecao = marcado === null ? null : recorte(marcado.inicio, marcado.fim, duracaoDaSequencia);
    if (selecao !== null) {
      registrar(
        `In/out marcados: inserindo so de ${relogio(selecao.inicio)} a ${relogio(selecao.fim)}. Para a sequencia inteira, limpe o in/out.`,
        "passo"
      );
    }

    // Depois da analise, de proposito: creditar o que voce colocou na mao exige
    // saber o que estava sendo dito naquele instante, e isso so existe agora.
    // Analisar nao copia arquivo: isso e so no Aprender.
    const { memoria, pendentes, resumo, ocupado } = await julgarFaixa(
      nomeSequencia,
      resultado.frases,
      resultado.conceitos,
      { pasta, nomes: arquivos.map((a) => a.name) },
      false
    );
    resumoAprendizado = resumo;
    antes = ocupado.map((o) => ({ inicio: o.inicio, fim: o.fim, arquivo: o.arquivo ?? "" }));

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
      return resultado_([]);
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
        medirBiblioteca(arquivos, cache, (feitos, total) => {
          registrar(`  medindo intensidade: ${feitos} de ${total}`, "passo");
        }),
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
      return resultado_([]);
    }

    if (entram.length === 0) {
      registrar("Nenhuma sugestao boa o bastante para entrar sozinha.", "aviso");
      return resultado_([]);
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
      registrar("Apague os que nao serviram: a proxima analise aprende com isso.", "vazio");
    } catch (e) {
      registrar(`Plano nao ficou guardado, esta rodada nao vai ensinar nada. ${mensagemDeErro(e)}`, "aviso");
    }

    return resultado_(
      entram.map((c) => ({ inicio: c.inicio, fim: c.inicio + c.duracao, arquivo: c.arquivo, frase: c.textoDaFrase }))
    );

  } catch (e) {
    registrar(mensagemDeErro(e), "erro");
    throw e;
  } finally {
    for (const linha of resumoAprendizado) registrar(linha.texto, linha.tipo);
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
async function mesclarCanonicoNoDisco(): Promise<void> {
  try {
    const bruto = await comLimite("ler canonico", readJson(CANONICO_FILE), 5000);
    if (bruto === null) return; // nenhum snapshot para fundir

    const canonico = parseCanonico(bruto);
    if (canonico === null) {
      registrar(`${CANONICO_FILE} ilegivel: merge ignorado, aprendizado local intacto.`, "aviso");
      return;
    }

    const base = parseCanonico(
      await comLimite("ler base do canonico", readJson(CANONICO_BASE_FILE), 5000)
    );
    if (base !== null && base.version === canonico.version) return; // ja fundido

    const memoria = parseMemoria(
      await comLimite("ler aprendizado", readJson(MEMORIA_FILE), 5000)
    );
    const associacoes = parseAssociacoes(
      await comLimite("ler ligacoes", readJson(ASSOCIACOES_FILE), 5000)
    );
    const sinBruto = await comLimite("ler sinonimos", readJson(SINONIMOS_FILE), 5000);
    const sinDisco = parseSinonimos(sinBruto);

    const fundido = aplicarMerge(
      { memoria, associacoes, sinonimos: sinDisco ?? SINONIMOS_PADRAO },
      canonico,
      base
    );

    const carimbo = new Date().toISOString().slice(0, 10);
    await writeJson(`${MEMORIA_FILE}.bak-antes-merge-${carimbo}`, memoria);
    await writeJson(`${ASSOCIACOES_FILE}.bak-antes-merge-${carimbo}`, associacoes);
    if (sinBruto !== null) {
      await writeJson(`${SINONIMOS_FILE}.bak-antes-merge-${carimbo}`, sinBruto);
    }

    // Baseline PRIMEIRO, antes das tres lojas mescladas: o gate por `version`
    // avanca aqui. Se um write de loja falhar depois (ou o host derrubar o
    // painel no meio), o proximo boot pula o merge em vez de re-mesclar sobre
    // dado ja mesclado — `mesclarContagens` (ligacoes) nao tem teto e infla sem
    // limite a cada re-run. A loja nao gravada so perde ESTA versao do canonico
    // e pega a curadoria no proximo bump de `version` (o snapshot e versionado
    // e re-entregue). Grava o snapshot BRUTO, nao o `canonico` parseado:
    // `CanonicoSnapshot.sinonimos` e um Map e `JSON.stringify(Map)` vira `{}`;
    // `parseCanonico(bruto)` no proximo boot reconstroi a mesma base.
    await writeJson(CANONICO_BASE_FILE, bruto);
    await writeJson(MEMORIA_FILE, fundido.memoria);
    await writeJson(ASSOCIACOES_FILE, fundido.associacoes);
    await writeJson(SINONIMOS_FILE, sinonimosParaJson(fundido.sinonimos));

    const nP = Object.keys(fundido.memoria.pares).length;
    const nA = Object.keys(fundido.memoria.arquivos).length;
    const nL = Object.keys(fundido.associacoes.pares).length;
    registrar(
      `Merge do aprendizado canonico v${canonico.version}: ${nP} pares, ${nA} arquivos, ${nL} ligacoes.`,
      "ok"
    );
  } catch (e) {
    registrar(`Merge do canonico falhou. ${mensagemDeErro(e)}`, "aviso");
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
async function carregarSinonimos(): Promise<void> {
  try {
    const bruto = await comLimite("ler sinonimos", readJson(SINONIMOS_FILE), 5000);
    if (bruto === null) {
      // Primeira vez: grava o padrao para o usuario ter o que editar.
      await writeJson(SINONIMOS_FILE, sinonimosParaJson(SINONIMOS_PADRAO));
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
    registrar(`Dicionario nao carregou, usando o padrao. ${mensagemDeErro(e)}`, "aviso");
  }
}

// ---------------------------------------------------------------- motor

export const motorBrollLocal: MotorBroll = {
  iniciar: async (para) => {
    comecar(para);
    let config = DEFAULT_CONFIG;
    try {
      const salva = await comLimite("ler configuracao", readJson(CONFIG_FILE), 5000);
      if (salva !== null) config = parseConfig(salva);
    } catch (e) {
      registrar(`Configuracao nao carregou, usando padrao. ${mensagemDeErro(e)}`, "aviso");
    }
    await mesclarCanonicoNoDisco();
    await carregarSinonimos();
    return config;
  },
  ler: async () => {
    const info = await comLimite("ler sequencia", getSequenceInfo());
    // So enfeite da tela: sem a leitura, a faixa aparece vazia.
    const acima = await comLimite("ler B-rolls da timeline", lerBrollsAcimaDeV1(), 30000).catch(() => []);
    return {
      nome: info.name,
      duracaoS: info.durationSeconds,
      formato: `${info.width}x${info.height}`,
      fps: info.fps,
      naTimeline: acima.map((c) => ({ inicio: c.startSeconds, fim: c.endSeconds, arquivo: c.sourceName })),
    };
  },
  analisar: analisarSequencia,
  aprender: aprenderDaTimeline,
};
