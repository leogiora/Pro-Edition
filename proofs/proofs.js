/*
 * Fase 0 — provas de API executadas dentro do Premiere Pro.
 * Objetivo: descobrir o que a versao instalada realmente suporta.
 * Nao e codigo de produto. Nada aqui vira arquitetura antes do relatorio.
 *
 * Toda chamada passa por probe(): se a API nao existir ou falhar, o erro e
 * registrado e a execucao continua. Nenhuma suposicao e tratada como verdade.
 */

const ppro = require("premierepro");
const uxp = require("uxp");

const logEl = document.getElementById("log");
let buffer = [];
// Arquivos separados por prova: rodar a leitura apagava o log da escrita.
let logName = "provas.txt";

/** Uma linha (ou bloco) por chamada. textContent, nunca innerHTML: o log
 *  carrega dados vindos do projeto do usuario e nao deve interpretar markup. */
function out(line) {
  buffer.push(line);
  const div = document.createElement("div");
  div.textContent = line;
  if (line.startsWith("[OK]")) div.className = "ok";
  else if (line.startsWith("[FALHA]") || line.startsWith("[ERRO")) div.className = "fail";
  else if (line.startsWith("    ")) div.className = "data";
  else if (line.startsWith("-----") || line.startsWith("AGORA")) div.className = "muted";
  else div.className = "head";
  logEl.appendChild(div);
  logEl.scrollTop = logEl.scrollHeight;
}

function json(value) {
  try {
    return JSON.stringify(value, null, 2);
  } catch (e) {
    return String(value);
  }
}

/** Executa fn e registra OK/FALHA. Nunca lanca, nunca trava.
 *  O timeout existe porque varias chamadas UXP simplesmente nunca resolvem
 *  (getFileForOpening, importFiles em certos estados). Sem ele, uma promise
 *  pendurada mata a prova inteira e nao sobra log nenhum. */
async function probe(label, fn, timeoutMs = 20000) {
  let timer = null;
  try {
    const result = await Promise.race([
      fn(),
      new Promise((_, rej) => {
        timer = setTimeout(() => rej(new Error(`TIMEOUT: sem resposta em ${timeoutMs}ms`)), timeoutMs);
      }),
    ]);
    out(`\n[OK] ${label}`);
    if (result !== undefined) out(indent(typeof result === "string" ? result : json(result)));
    return { ok: true, result };
  } catch (e) {
    out(`\n[FALHA] ${label}`);
    out(indent(`${e && e.name}: ${e && e.message}`));
    return { ok: false, error: e };
  } finally {
    if (timer) clearTimeout(timer);
  }
}

function indent(text) {
  return String(text)
    .split("\n")
    .map((l) => "    " + l)
    .join("\n");
}

/** Nomes de metodos de um objeto, incluindo o prototype. Usado para descobrir APIs nao documentadas. */
function surface(obj) {
  if (!obj) return [];
  const names = new Set();
  let cur = obj;
  while (cur && cur !== Object.prototype) {
    Object.getOwnPropertyNames(cur).forEach((n) => {
      if (n !== "constructor") names.add(n);
    });
    cur = Object.getPrototypeOf(cur);
  }
  return [...names].sort();
}

function tick(t) {
  if (!t) return null;
  return { seconds: t.seconds, ticks: t.ticks };
}

/** Chama todo getter sem argumento e registra o retorno. Unica forma de
 *  inspecionar classes que a Adobe nao documenta. */
async function dumpGetters(obj) {
  const row = { superficie: surface(obj) };
  for (const nome of row.superficie) {
    if (!nome.startsWith("get") && !nome.startsWith("is")) continue;
    const fn = obj[nome];
    if (typeof fn !== "function" || fn.length > 0) continue;
    try {
      const v = await fn.call(obj);
      row[nome] = v && typeof v === "object" && "seconds" in v ? tick(v) : v;
    } catch (e) {
      row[nome] = `<erro: ${e && e.message}>`;
    }
  }
  return row;
}

// ---------------------------------------------------------------- leitura

async function proofsReadOnly() {
  buffer = [];
  logName = "provas-leitura.txt";
  out(`Auto B-roll — provas de leitura — ${new Date().toISOString()}`);
  out(`UXP host: ${uxp.host.name} ${uxp.host.version}`);

  await probe("P0.1 modulo premierepro carregado — chaves de topo", async () =>
    Object.keys(ppro).sort()
  );

  await probe("P0.2 ppro.Constants — grupos disponiveis", async () =>
    ppro.Constants ? Object.keys(ppro.Constants).sort() : "ppro.Constants ausente"
  );

  await probe("P0.3 ppro.Constants.TrackItemType", async () =>
    ppro.Constants && ppro.Constants.TrackItemType
      ? ppro.Constants.TrackItemType
      : "TrackItemType ausente"
  );

  const projectRes = await probe("P1.1 Project.getActiveProject()", async () => {
    const p = await ppro.Project.getActiveProject();
    if (!p) throw new Error("nenhum projeto ativo");
    return { name: p.name, path: p.path, guid: String(p.guid) };
  });
  if (!projectRes.ok) return;
  const project = await ppro.Project.getActiveProject();

  const seqRes = await probe("P1.2 project.getActiveSequence()", async () => {
    const s = await project.getActiveSequence();
    if (!s) throw new Error("nenhuma sequencia ativa — abra uma sequencia na timeline");
    return { name: s.name, guid: String(s.guid) };
  });
  if (!seqRes.ok) return;
  const sequence = await project.getActiveSequence();

  await probe("P1.3 metodos disponiveis em Sequence", async () => surface(sequence));

  await probe("P1.4 timebase / frame rate / settings", async () => {
    const settings = await sequence.getSettings();
    const frameRate = settings ? await settings.getVideoFrameRate() : null;
    const rect = settings ? await settings.getVideoFrameRect() : null;
    return {
      timebase: await sequence.getTimebase(),
      endTime: tick(await sequence.getEndTime()),
      // RectF nao serializa via JSON.stringify; ler os campos um a um.
      frameRect: rect ? { w: rect.width, h: rect.height, x: rect.x, y: rect.y } : null,
      frameRateSuperficie: frameRate ? surface(frameRate) : null,
      frameRateValor: frameRate ? (frameRate.value ?? String(frameRate)) : null,
      frameRateTicks: frameRate && frameRate.ticksPerFrame ? String(frameRate.ticksPerFrame) : null,
    };
  });

  await probe("P1.5 contagem de faixas", async () => ({
    video: await sequence.getVideoTrackCount(),
    audio: await sequence.getAudioTrackCount(),
    caption: await sequence.getCaptionTrackCount(),
  }));

  // ---- P2: leitura de tracks e items
  const clipType =
    (ppro.Constants && ppro.Constants.TrackItemType && ppro.Constants.TrackItemType.CLIP) ?? 1;

  const items = [];
  await probe("P2.1 varredura de VideoTracks e TrackItems", async () => {
    const count = await sequence.getVideoTrackCount();
    const dump = [];
    for (let i = 0; i < count; i++) {
      const track = await sequence.getVideoTrack(i);
      const trackItems = await track.getTrackItems(clipType, false);
      const rows = [];
      for (const it of trackItems) {
        const projectItem = await it.getProjectItem();
        const row = {
          name: await it.getName(),
          start: tick(await it.getStartTime()),
          end: tick(await it.getEndTime()),
          inPoint: tick(await it.getInPoint()),
          outPoint: tick(await it.getOutPoint()),
          speed: await it.getSpeed(),
          reversed: await it.isSpeedReversed(),
          disabled: await it.isDisabled(),
          adjustmentLayer: await it.isAdjustmentLayer(),
          projectItemName: projectItem ? projectItem.name : null,
        };
        rows.push(row);
        if (projectItem) items.push(projectItem);
      }
      dump.push({ index: i, name: track.name, id: track.id, muted: await track.isMuted(), items: rows });
    }
    return dump;
  });

  await probe("P2.2 metodos disponiveis em VideoClipTrackItem (1o item)", async () => {
    const track = await sequence.getVideoTrack(0);
    const trackItems = await track.getTrackItems(clipType, false);
    if (!trackItems.length) throw new Error("V1 sem clips");
    return surface(trackItems[0]);
  });

  await probe("P2.3 metodos disponiveis em ProjectItem (1o item)", async () => {
    if (!items.length) throw new Error("nenhum projectItem coletado");
    return surface(items[0]);
  });

  // ---- P3: transcricao / captions da sequencia (caminho preferido da Fase 3)
  await probe("P3.1 CaptionTrack da sequencia — existe conteudo?", async () => {
    const count = await sequence.getCaptionTrackCount();
    if (!count) return "0 caption tracks — nao ha transcricao no nivel da sequencia";
    const track = await sequence.getCaptionTrack(0);
    return { superficie: surface(track), items: (await track.getTrackItems(clipType, false)).length };
  });

  // A pergunta que decide a Fase 3: os 1029 itens da caption track carregam o
  // texto final ja cortado? Se sim, nao ha reconstrucao a fazer.
  await probe("P3.1b CaptionTrack — estrutura dos itens", async () => {
    const count = await sequence.getCaptionTrackCount();
    if (!count) throw new Error("sem caption track");
    const track = await sequence.getCaptionTrack(0);
    const itens = await track.getTrackItems(clipType, false);
    if (!itens.length) throw new Error("caption track vazia");

    const amostras = [];
    for (const it of itens.slice(0, 3)) amostras.push(await dumpGetters(it));
    return { total: itens.length, amostras };
  });

  // P3.1b mostrou que o texto NAO esta nos getters do CaptionTrackItem
  // (getName retorna "SyntheticCaption"). Ultima rota possivel: o
  // ComponentChain. Se falhar aqui, a caption track serve so para timing.
  await probe("P3.1c CaptionTrackItem — o texto esta no ComponentChain?", async () => {
    const track = await sequence.getCaptionTrack(0);
    const itens = await track.getTrackItems(clipType, false);
    if (!itens.length) throw new Error("caption track vazia");

    const chain = await itens[0].getComponentChain();
    if (!chain) throw new Error("getComponentChain retornou null");

    const info = { chain: await dumpGetters(chain) };

    // Procurar um acessor por indice (arity 1) e puxar os primeiros componentes.
    const acessor = surface(chain).find(
      (n) => /^get.*Component/i.test(n) && typeof chain[n] === "function" && chain[n].length === 1
    );
    info.acessorUsado = acessor || "<nenhum acessor por indice encontrado>";
    if (!acessor) return info;

    info.componentes = [];
    for (let i = 0; i < 3; i++) {
      try {
        const comp = await chain[acessor](i);
        if (!comp) break;
        const dump = await dumpGetters(comp);
        // Propriedades sao onde o texto normalmente vive.
        const propAcessor = surface(comp).find(
          (n) => /^get.*Propert/i.test(n) && typeof comp[n] === "function" && comp[n].length === 1
        );
        if (propAcessor) {
          dump.propriedades = [];
          for (let p = 0; p < 12; p++) {
            try {
              const prop = await comp[propAcessor](p);
              if (!prop) break;
              dump.propriedades.push(await dumpGetters(prop));
            } catch (e) {
              break;
            }
          }
        }
        info.componentes.push(dump);
      } catch (e) {
        info.componentes.push(`<erro no indice ${i}: ${e && e.message}>`);
        break;
      }
    }
    return info;
  });

  await probe("P3.2 ppro.Transcript — superficie estatica", async () =>
    ppro.Transcript ? surface(ppro.Transcript) : "ppro.Transcript ausente"
  );

  await probe("P3.3 Transcript.hasTranscript por ClipProjectItem da timeline", async () => {
    if (!items.length) throw new Error("nenhum projectItem coletado");
    const seen = new Set();
    const rows = [];
    for (const pi of items) {
      if (seen.has(pi.name)) continue;
      seen.add(pi.name);
      let has = null;
      let erro = null;
      try {
        const clip = ppro.ClipProjectItem ? ppro.ClipProjectItem.cast(pi) : pi;
        has = await ppro.Transcript.hasTranscript(clip || pi);
      } catch (e) {
        erro = String(e && e.message);
      }
      rows.push({ item: pi.name, hasTranscript: has, erro });
    }
    return rows;
  });

  await probe("P3.4 Transcript.exportToJSON — amostra do 1o item com transcricao", async () => {
    for (const pi of items) {
      try {
        const clip = ppro.ClipProjectItem ? ppro.ClipProjectItem.cast(pi) : pi;
        if (!(await ppro.Transcript.hasTranscript(clip || pi))) continue;
        const raw = await ppro.Transcript.exportToJSON(clip || pi);
        return {
          item: pi.name,
          tamanhoJSON: raw.length,
          amostra: raw.slice(0, 1500),
        };
      } catch (e) {
        /* proximo item */
      }
    }
    throw new Error("nenhum item da timeline retornou transcricao");
  });

  // ---- P4: superficie de edicao/transacao (sem escrever nada)
  await probe("P4.1 SequenceEditor.getEditor + superficie", async () => {
    const editor = ppro.SequenceEditor.getEditor(sequence);
    return surface(editor);
  });

  await probe("P4.2 Project — executeTransaction / lockedAccess presentes?", async () => ({
    executeTransaction: typeof project.executeTransaction,
    lockedAccess: typeof project.lockedAccess,
    importFiles: typeof project.importFiles,
  }));
}

/** O painel UXP nao permite copiar texto. O log vai para arquivo. */
async function finish() {
  out("\n----- fim -----");
  try {
    const folder = await uxp.storage.localFileSystem.getDataFolder();
    const file = await folder.createFile(logName, { overwrite: true });
    await file.write(buffer.join("\n"));
    out(`\nLog salvo em:\n${file.nativePath}`);
  } catch (e) {
    out(`\n[FALHA] nao consegui salvar o log em arquivo: ${e && e.message}`);
  }
}

// ---------------------------------------------------------------- escrita

async function proofWrite() {
  buffer = [];
  logName = "provas-escrita.txt";
  out(`Auto B-roll — prova de escrita — ${new Date().toISOString()}`);
  out("Esta prova MODIFICA a sequencia ativa. Use projeto de teste.");

  // Sem seletor de arquivo. getFileForOpening() trava e nunca resolve neste
  // painel, e ele nao e necessario: quem le a midia e o Premiere, via
  // importFiles(caminho), nao o sandbox do UXP.
  // ponytail: caminho fixo serve para a prova; a escolha de pasta pelo usuario
  // e trabalho da Fase 5, com o indexador.
  const file = {
    nativePath: "C:\\Users\\leogi\\Downloads\\Brolls - 2026\\Academia.mp4",
    name: "Academia.mp4",
  };
  out(`\nArquivo (fixo, sem seletor): ${file.nativePath}`);

  // importFiles altera o projeto e invalida qualquer handle obtido antes dele
  // ("The script object is no longer valid"). Por isso nada e reaproveitado
  // entre etapas: cada uma pega referencias novas.
  async function handles() {
    const project = await ppro.Project.getActiveProject();
    if (!project) throw new Error("sem projeto ativo");
    const sequence = await project.getActiveSequence();
    if (!sequence) throw new Error("sem sequencia ativa");
    return { project, sequence, rootItem: await project.getRootItem() };
  }

  const alvo = await probe("P5.0 onde a prova vai escrever", async () => {
    const { project, sequence } = await handles();
    return { projeto: project.name, sequencia: sequence.name };
  });
  if (!alvo.ok) return;

  const before = await probe("P5.1 estado de V2 antes", async () => {
    const { sequence } = await handles();
    const count = await sequence.getVideoTrackCount();
    if (count < 2) throw new Error(`sequencia tem ${count} faixa(s) de video; crie V2 antes`);
    const clipType =
      (ppro.Constants && ppro.Constants.TrackItemType && ppro.Constants.TrackItemType.CLIP) ?? 1;
    const v2 = await sequence.getVideoTrack(1);
    return { itensEmV2: (await v2.getTrackItems(clipType, false)).length };
  });
  if (!before.ok) return;

  const importRes = await probe("P5.2 project.importFiles (suppressUI=true)", async () => {
    const { project, rootItem } = await handles();
    // Nao reimportar o que ja esta no projeto: a prova pode rodar varias vezes.
    const jaExiste = (await rootItem.getItems()).some((c) => c.name === file.name);
    if (jaExiste) return "ja estava no projeto — import pulado";
    return project.importFiles([file.nativePath], true, rootItem, false);
  });
  if (!importRes.ok) return;

  const found = await probe("P5.3 localizar o ProjectItem importado", async () => {
    const { rootItem } = await handles();
    const children = await rootItem.getItems();
    const hit = children.find((c) => c.name === file.name || file.name.startsWith(c.name));
    if (!hit) throw new Error(`nao encontrado na raiz; itens: ${children.map((c) => c.name).join(", ")}`);
    return hit.name;
  });
  if (!found.ok) return;

  // Mecanica ja resolvida: Action criada DENTRO de lockedAccess, transacao
  // tambem dentro. O que resta provar e o destino das faixas.
  //
  // audioTrackIndex -1 NAO suprime audio — cai no padrao e vai para A1, por
  // cima do audio principal. Indice explicito e obrigatorio.
  // A d.ts garante: indice maior que o numero de faixas cria faixa nova.
  // Logo indice 2 e sempre A3: usa a existente ou cria.
  const V2 = 1;
  const A3 = 2;

  await probe("P5.4 overwrite: video em V2, audio em A3 (indices explicitos)", async () => {
    const { project, sequence, rootItem } = await handles();
    const item = (await rootItem.getItems()).find((c) => c.name === found.result);
    if (!item) throw new Error("projectItem nao encontrado");

    const audioAntes = await sequence.getAudioTrackCount();
    // getEditor e TickTime nao exigem lock — so a criacao da Action exige.
    const editor = await ppro.SequenceEditor.getEditor(sequence);
    const at = await ppro.TickTime.createWithSeconds(0);

    let erro = null;
    let acao = null;
    // lockedAccess e SINCRONO: nada de await aqui dentro.
    project.lockedAccess(() => {
      try {
        acao = editor.createOverwriteItemAction(item, at, V2, A3);
        project.executeTransaction((compound) => {
          compound.addAction(acao);
        }, "Auto B-roll: inserir B-roll (prova)");
      } catch (e) {
        erro = `dentro do lock — ${e && e.name}: ${e && e.message}`;
      }
    });
    if (erro) throw new Error(erro);

    const { sequence: seq2 } = await handles();
    return {
      videoTrackIndex: V2,
      audioTrackIndex: A3,
      faixasAudioAntes: audioAntes,
      faixasAudioDepois: await seq2.getAudioTrackCount(),
    };
  });

  await probe("P5.5 estado de V2 depois", async () => {
    const { sequence } = await handles();
    const clipType =
      (ppro.Constants && ppro.Constants.TrackItemType && ppro.Constants.TrackItemType.CLIP) ?? 1;
    const rows = [];
    for (const it of await (await sequence.getVideoTrack(1)).getTrackItems(clipType, false)) {
      rows.push({ name: await it.getName(), start: tick(await it.getStartTime()) });
    }
    const v1 = [];
    for (const it of await (await sequence.getVideoTrack(0)).getTrackItems(clipType, false)) {
      v1.push(await it.getName());
    }
    return { itensEmV2: rows, itensEmV1: v1.length, faixasAudio: await sequence.getAudioTrackCount() };
  });

  // audioTrackIndex -1 nao suprimiu audio: criou uma faixa nova (2 -> 3 faixas).
  // A d.ts confirma: "If you pass a track index greater than the number of
  // existing tracks, a new track will be created". Nao existe valor para
  // "sem audio". Descobrir o que de fato foi parar la.
  await probe("P6 o que foi parar nas faixas de audio?", async () => {
    const { sequence } = await handles();
    const clipType = ppro.Constants.TrackItemType.CLIP;
    const faixas = [];
    const total = await sequence.getAudioTrackCount();
    for (let i = 0; i < total; i++) {
      const t = await sequence.getAudioTrack(i);
      const itens = await t.getTrackItems(clipType, false);
      const rows = [];
      for (const it of itens) {
        rows.push({ nome: await it.getName(), start: tick(await it.getStartTime()) });
      }
      faixas.push({ indice: i, nome: t.name, qtdItens: rows.length, itens: rows.slice(0, 5) });
    }
    return { totalFaixas: total, faixas };
  });

  // P7 deu TIMEOUT na versao anterior porque dumpGetters chamava todo getter
  // sem argumento do ComponentParam, e getStartValue()/getKeyframePtr()
  // penduram. Aqui so se le `displayName`, que a d.ts declara como propriedade.
  await probe("P7 componentes do clipe em V2 — da para escalar?", async () => {
    const { sequence } = await handles();
    const v2 = await sequence.getVideoTrack(1);
    const itens = await v2.getTrackItems(ppro.Constants.TrackItemType.CLIP, false);
    if (!itens.length) throw new Error("V2 vazia — a insercao nao aconteceu");

    const chain = await itens[0].getComponentChain();
    if (!chain) throw new Error("getComponentChain retornou null");
    const qtd = chain.getComponentCount();

    const componentes = [];
    for (let i = 0; i < qtd; i++) {
      const c = chain.getComponentAtIndex(i);
      const params = [];
      const np = c.getParamCount();
      for (let p = 0; p < np; p++) {
        try {
          params.push({ i: p, displayName: c.getParam(p).displayName });
        } catch (e) {
          params.push({ i: p, erro: String(e && e.message) });
        }
      }
      componentes.push({
        indice: i,
        matchName: await c.getMatchName(),
        displayName: await c.getDisplayName(),
        qtdParams: np,
        params,
      });
    }
    return { qtdComponentes: qtd, componentes };
  });

  // P6 provou que o audio do B-roll cai na A3 como um item so, com o nome do
  // arquivo. Agora remover de fato — 147 dos 260 B-rolls tem audio.
  await probe("P8 remover o item de audio do B-roll da A3", async () => {
    const { project, sequence } = await handles();
    const a3 = await sequence.getAudioTrack(A3);
    if (!a3) throw new Error("A3 nao existe");

    const itens = await a3.getTrackItems(ppro.Constants.TrackItemType.CLIP, false);
    let alvo = null;
    for (const it of itens) {
      if ((await it.getName()) === found.result) {
        alvo = it;
        break;
      }
    }
    if (!alvo) throw new Error(`nenhum item chamado ${found.result} na A3`);

    const editor = await ppro.SequenceEditor.getEditor(sequence);
    let erro = null;
    // A selecao tambem precisa nascer dentro do lock — montada fora, ela chega
    // invalida ("script object is no longer valid"). createEmptySelection e
    // addItem sao sincronos, entao cabem aqui.
    project.lockedAccess(() => {
      try {
        let selecao = null;
        ppro.TrackItemSelection.createEmptySelection((sel) => {
          selecao = sel;
        });
        if (!selecao) throw new Error("createEmptySelection nao devolveu selecao");
        selecao.addItem(alvo, false);

        // ripple=false: nao desloca nada. shiftOverLapping=false: idem.
        const acao = editor.createRemoveItemsAction(
          selecao,
          false,
          ppro.Constants.MediaType.AUDIO,
          false
        );
        project.executeTransaction((compound) => {
          compound.addAction(acao);
        }, "Auto B-roll: remover audio do B-roll");
      } catch (e) {
        erro = `dentro do lock — ${e && e.name}: ${e && e.message}`;
      }
    });
    if (erro) throw new Error(erro);

    const { sequence: seq2 } = await handles();
    const conta = async (i) =>
      (await (await seq2.getAudioTrack(i)).getTrackItems(ppro.Constants.TrackItemType.CLIP, false))
        .length;
    return { itensA1: await conta(0), itensA2: await conta(1), itensA3: await conta(A3) };
  });

  // P7 provou que Motion/Scale e alcancavel. Aqui aplica de fato.
  // Academia.mp4 e 720x1280 numa sequencia 1080x1920 -> 150% para preencher.
  // ponytail: dimensao fixa nesta prova. Ler a resolucao real do ProjectItem
  // e problema separado — ProjectItem nao expoe largura/altura, vai precisar
  // de ppro.Media ou FootageInterpretation. Fase 4.
  await probe("P9 escalar o clipe de V2 para preencher a tela", async () => {
    const { project, sequence } = await handles();
    const seqW = 1080;
    const seqH = 1920;
    const clipW = 720;
    const clipH = 1280;
    const escala = Math.max(seqW / clipW, seqH / clipH) * 100;

    const v2 = await sequence.getVideoTrack(V2);
    const itens = await v2.getTrackItems(ppro.Constants.TrackItemType.CLIP, false);
    if (!itens.length) throw new Error("V2 vazia");

    const chain = await itens[0].getComponentChain();
    let motion = null;
    for (let i = 0; i < chain.getComponentCount(); i++) {
      const c = chain.getComponentAtIndex(i);
      if ((await c.getMatchName()) === "AE.ADBE Motion") {
        motion = c;
        break;
      }
    }
    if (!motion) throw new Error("componente Motion nao encontrado");

    // Localizar o param pelo displayName em vez de fixar o indice 1.
    let scaleParam = null;
    for (let p = 0; p < motion.getParamCount(); p++) {
      const par = motion.getParam(p);
      if (par.displayName === "Scale") {
        scaleParam = par;
        break;
      }
    }
    if (!scaleParam) throw new Error("param Scale nao encontrado");

    const antes = await scaleParam.getValueAtTime(await ppro.TickTime.createWithSeconds(0));

    let erro = null;
    project.lockedAccess(() => {
      try {
        const kf = scaleParam.createKeyframe(escala);
        const acao = scaleParam.createSetValueAction(kf, true);
        project.executeTransaction((compound) => {
          compound.addAction(acao);
        }, "Auto B-roll: escalar para preencher");
      } catch (e) {
        erro = `dentro do lock — ${e && e.name}: ${e && e.message}`;
      }
    });
    if (erro) throw new Error(erro);

    const depois = await scaleParam.getValueAtTime(await ppro.TickTime.createWithSeconds(0));
    return { clip: `${clipW}x${clipH}`, sequencia: `${seqW}x${seqH}`, escalaAplicada: escala, antes, depois };
  });

  out("\nAGORA, MANUALMENTE:");
  out("  1. Confira V2 na timeline e se V1/audio nao mudaram.");
  out("  2. Pressione Ctrl+Z UMA vez.");
  out("  3. Diga se um unico Undo desfez tudo (clip + import) ou so parte.");
}

// ---------------------------------------------------------------- eventos

/** finish() no finally: qualquer saida — sucesso, erro ou cancelamento —
 *  grava o log. Sem isso, uma falha precoce nao deixava rastro nenhum. */
function rodar(botao, fn) {
  document.getElementById(botao).addEventListener("click", () => {
    fn()
      .catch((e) => out(`\n[ERRO FATAL] ${e && e.name}: ${e && e.message}`))
      .then(finish, finish);
  });
}

rodar("runReadOnly", proofsReadOnly);
rodar("runWrite", proofWrite);

document.getElementById("clear").addEventListener("click", () => {
  buffer = [];
  logEl.textContent = "";
});

out("Pronto. Abra uma sequencia editada e escolha o passo 1 ou o passo 2.");
out("Cada passo grava seu proprio arquivo — o painel UXP nao deixa copiar texto.");
