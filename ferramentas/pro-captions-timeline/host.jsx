/*
 * Pro Captions: Timeline \u2014 lado ExtendScript.
 *
 * Pega o legendas.srt e o precos.srt que o Pro Captions acabou de gerar e
 * cria as faixas de legenda na sequencia ativa, com Sequence.createCaptionTrack().
 *
 * ExtendScript e ES3: nada de let/const, arrow function, template string nem
 * JSON (nao existe aqui). Cada funcao devolve texto simples para o painel.
 */

var PROCAPTIONS_PASTA_BIN = "Pro Captions";

/** Onde o Pro Captions grava os .srt: a pasta de dados do plugin UXP. */
function proCaptions_candidatas() {
    var appData = Folder.userData.fsName; // C:\Users\<voce>\AppData\Roaming
    var versao = String(app.version).split(".")[0];
    var versoes = [versao, "27", "26", "25"];
    var ids = ["com.leogi.proedition", "com.leogi.procaptions"];
    var pastas = [];
    var vistas = {};
    for (var v = 0; v < versoes.length; v++) {
        if (vistas[versoes[v]]) continue;
        vistas[versoes[v]] = true;
        for (var i = 0; i < ids.length; i++) {
            pastas.push(appData + "\\Adobe\\UXP\\PluginsStorage\\PPRO\\" + versoes[v] +
                "\\External\\" + ids[i] + "\\PluginData");
        }
    }
    return pastas;
}

/** O legendas.srt mais recente entre as pastas candidatas, com o precos.srt da mesma pasta. */
function proCaptions_acharSrts() {
    var pastas = proCaptions_candidatas();
    var melhor = null;
    for (var i = 0; i < pastas.length; i++) {
        var legendas = new File(pastas[i] + "\\legendas.srt");
        if (!legendas.exists) continue;
        if (melhor === null || legendas.modified.getTime() > melhor.legendas.modified.getTime()) {
            var precos = new File(pastas[i] + "\\precos.srt");
            // O Pro Captions so grava precos.srt quando o video tem preco. Um
            // precos.srt de uma geracao ANTERIOR ficaria na pasta e entraria no
            // video errado — so vale o que nasceu junto com o legendas.srt.
            var mesmaGeracao = precos.exists &&
                Math.abs(precos.modified.getTime() - legendas.modified.getTime()) <= 120000;
            melhor = {
                pasta: pastas[i],
                legendas: legendas,
                precos: mesmaGeracao ? precos : null,
                precosAntigo: precos.exists && !mesmaGeracao
            };
        }
    }
    return melhor;
}

function proCaptions_ehBin(item) {
    var BIN = (typeof ProjectItemType !== "undefined" && ProjectItemType.BIN !== undefined) ? ProjectItemType.BIN : 2;
    return item.type === BIN || item.type === "BIN";
}

/** A pasta "Pro Captions" no painel Projeto; cria se nao existir. */
function proCaptions_bin() {
    var raiz = app.project.rootItem;
    for (var i = 0; i < raiz.children.numItems; i++) {
        var filho = raiz.children[i];
        if (filho && filho.name === PROCAPTIONS_PASTA_BIN && proCaptions_ehBin(filho)) return filho;
    }
    var novo = raiz.createBin(PROCAPTIONS_PASTA_BIN);
    return novo ? novo : raiz;
}

/** nodeIds dos itens da pasta que apontam para `caminho`. */
function proCaptions_idsCom(bin, caminho) {
    var ids = {};
    for (var i = 0; i < bin.children.numItems; i++) {
        var item = bin.children[i];
        if (!item || proCaptions_ehBin(item)) continue;
        var p = "";
        try { p = item.getMediaPath(); } catch (e) { p = ""; }
        if (proCaptions_mesmoCaminho(p, caminho)) ids[item.nodeId] = item;
    }
    return ids;
}

function proCaptions_mesmoCaminho(a, b) {
    var n = function (s) { return String(s).replace(/\//g, "\\").toLowerCase(); };
    return n(a) === n(b);
}

/**
 * Importa o arquivo DE NOVO (o conteudo pode ter mudado desde a ultima
 * importacao) e devolve o item novo \u2014 o que nao existia antes.
 */
function proCaptions_importar(bin, arquivo) {
    var caminho = arquivo.fsName;
    var antes = proCaptions_idsCom(bin, caminho);
    var ok = app.project.importFiles([caminho], true, bin, false);
    if (!ok) return null;
    var depois = proCaptions_idsCom(bin, caminho);
    var novo = null;
    for (var id in depois) {
        if (!antes[id]) novo = depois[id];
    }
    return novo;
}

function proCaptions_minutosDesde(arquivo) {
    return Math.round((new Date().getTime() - arquivo.modified.getTime()) / 60000);
}

/** Consulta sem mexer em nada: o que o botao vai usar. */
function proCaptions_status() {
    try {
        var seq = app.project.activeSequence;
        var achados = proCaptions_acharSrts();
        var linhas = [];
        linhas.push(seq ? "Sequ\u00eancia ativa: " + seq.name : "Nenhuma sequ\u00eancia ativa.");
        if (!achados) {
            linhas.push("Nenhum legendas.srt encontrado. Gere as legendas no Pro Captions primeiro.");
        } else {
            linhas.push("legendas.srt gerado h\u00e1 " + proCaptions_minutosDesde(achados.legendas) + " min.");
            linhas.push(achados.precos ? "precos.srt encontrado." :
                achados.precosAntigo ? "precos.srt antigo ignorado (\u00e9 de outra gera\u00e7\u00e3o)." :
                "Sem precos.srt (v\u00eddeo sem pre\u00e7o?).");
        }
        return "OK|" + linhas.join("\n");
    } catch (e) {
        return "ERRO|" + e.toString();
    }
}

/**
 * Importa os .srt dados e cria as faixas de legenda no zero da sequencia ativa.
 * `precos` pode ser null (video sem preco).
 */
function proCaptions_colocarArquivos(legendas, precos) {
    var seq = app.project.activeSequence;
    if (!seq) return "ERRO|Nenhuma sequência ativa. Abra a sequência na timeline.";
    var bin = proCaptions_bin();
    var formato = (typeof Sequence !== "undefined" && Sequence.CAPTION_FORMAT_SUBTITLE !== undefined)
        ? Sequence.CAPTION_FORMAT_SUBTITLE : undefined;
    var feitas = [];
    var arquivos = [legendas];
    if (precos) arquivos.push(precos);

    for (var i = 0; i < arquivos.length; i++) {
        var item = proCaptions_importar(bin, arquivos[i]);
        if (!item) return "ERRO|Não consegui importar " + arquivos[i].fsName;
        var ok = (formato === undefined)
            ? seq.createCaptionTrack(item, 0)
            : seq.createCaptionTrack(item, 0, formato);
        if (!ok) return "ERRO|O Premiere recusou criar a faixa de " + arquivos[i].name;
        feitas.push(arquivos[i].name);
    }
    return "OK|Faixas de legenda criadas em “" + seq.name + "”: " + feitas.join(" e ") + ".\n" +
        "Falta só o estilo: Pro-Captions (96) na faixa do texto e Pro-Captions Preço (150) na do preço.";
}

/** O botao: importa os .srt e cria as faixas de legenda no zero da sequencia. */
function proCaptions_colocarNaTimeline() {
    try {
        var achados = proCaptions_acharSrts();
        if (!achados) return "ERRO|Nenhum legendas.srt encontrado. Gere as legendas no Pro Captions primeiro.";
        var r = proCaptions_colocarArquivos(achados.legendas, achados.precos);
        return r.indexOf("OK|") === 0
            ? r + "\nlegendas.srt gerado há " + proCaptions_minutosDesde(achados.legendas) + " min."
            : r;
    } catch (e) {
        return "ERRO|" + e.toString() + (e.line ? " (linha " + e.line + ")" : "");
    }
}

/**
 * A ponte com o painel Pro Edition (UXP), que nao cria faixa de legenda.
 *
 * O botao Editar grava `timeline-pedido.txt` na pasta de dados do plugin:
 * linha 1 = id, linha 2 = caminho do legendas.srt, linha 3 = caminho do
 * precos.srt (ou vazia). A ponte (ponte.html, aberta escondida junto com o
 * Premiere) chama isto a cada segundo e meio; a resposta vai em
 * `timeline-resposta.txt`, comecando pelo mesmo id.
 */
function proCaptions_atenderPedido() {
    var pastas = proCaptions_candidatas();
    for (var i = 0; i < pastas.length; i++) {
        var pedido = new File(pastas[i] + "\timeline-pedido.txt");
        if (!pedido.exists) continue;
        pedido.encoding = "UTF-8";
        pedido.open("r");
        var texto = pedido.read();
        pedido.close();
        pedido.remove();

        var linhas = texto.replace(/\r/g, "").split("\n");
        var id = linhas[0];
        var r;
        try {
            var legendas = new File(linhas[1]);
            var precos = linhas[2] ? new File(linhas[2]) : null;
            r = legendas.exists
                ? proCaptions_colocarArquivos(legendas, precos && precos.exists ? precos : null)
                : "ERRO|legendas.srt não encontrado em " + linhas[1];
        } catch (e) {
            r = "ERRO|" + e.toString() + (e.line ? " (linha " + e.line + ")" : "");
        }

        var resposta = new File(pastas[i] + "\timeline-resposta.txt");
        resposta.encoding = "UTF-8";
        resposta.open("w");
        resposta.write(id + "\n" + r);
        resposta.close();
        return "ATENDIDO|" + r;
    }
    return "NADA|";
}
