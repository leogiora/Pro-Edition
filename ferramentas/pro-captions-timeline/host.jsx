/*
 * Pro Captions: Timeline \u2014 lado ExtendScript.
 *
 * A ponte recebe do Pro Edition (UXP) o caminho do legendas.srt e do precos.srt
 * e cria as faixas de legenda na sequencia ativa, com Sequence.createCaptionTrack().
 *
 * ExtendScript e ES3: nada de let/const, arrow function, template string nem
 * JSON (nao existe aqui). Cada funcao devolve texto simples para o painel.
 */

var PROCAPTIONS_PASTA_BIN = "Pro Captions";

/**
 * A pasta de dados do plugin UXP DESTE Premiere, onde chega o pedido. So a da
 * propria versao: com o 2025 e o 2026 abertos juntos, a ponte do outro
 * pegaria o pedido e criaria as legendas na sequencia errada.
 */
function proCaptions_candidatas() {
    var appData = Folder.userData.fsName; // C:\Users\<voce>\AppData\Roaming
    var versao = String(app.version).split(".")[0];
    var ids = ["com.leogi.proedition", "com.leogi.procaptions"];
    var pastas = [];
    for (var i = 0; i < ids.length; i++) {
        pastas.push(appData + "\\Adobe\\UXP\\PluginsStorage\\PPRO\\" + versao +
            "\\External\\" + ids[i] + "\\PluginData");
    }
    return pastas;
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

/**
 * Importa os .srt dados e cria as faixas de legenda no zero da sequencia ativa.
 * `precos` pode ser null (video sem preco).
 */
function proCaptions_colocarArquivos(legendas, precos) {
    var seq = app.project.activeSequence;
    if (!seq) return "ERRO|Nenhuma sequ\u00eancia ativa. Abra a sequ\u00eancia na timeline.";
    var bin = proCaptions_bin();
    var formato = (typeof Sequence !== "undefined" && Sequence.CAPTION_FORMAT_SUBTITLE !== undefined)
        ? Sequence.CAPTION_FORMAT_SUBTITLE : undefined;
    var feitas = [];
    var arquivos = [legendas];
    if (precos) arquivos.push(precos);

    for (var i = 0; i < arquivos.length; i++) {
        var item = proCaptions_importar(bin, arquivos[i]);
        if (!item) return "ERRO|N\u00e3o consegui importar " + arquivos[i].fsName;
        var ok = (formato === undefined)
            ? seq.createCaptionTrack(item, 0)
            : seq.createCaptionTrack(item, 0, formato);
        if (!ok) return "ERRO|O Premiere recusou criar a faixa de " + arquivos[i].name;
        feitas.push(arquivos[i].name);
    }
    return "OK|Faixas de legenda criadas em \u201c" + seq.name + "\u201d: " + feitas.join(" e ") + ".\n" +
        "Falta s\u00f3 o estilo: Pro-Captions (96) na faixa do texto e Pro-Captions Pre\u00e7o (150) na do pre\u00e7o.";
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
        var pedido = new File(pastas[i] + "\\timeline-pedido.txt");
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
                : "ERRO|legendas.srt n\u00e3o encontrado em " + linhas[1];
        } catch (e) {
            r = "ERRO|" + e.toString() + (e.line ? " (linha " + e.line + ")" : "");
        }

        var resposta = new File(pastas[i] + "\\timeline-resposta.txt");
        resposta.encoding = "UTF-8";
        resposta.open("w");
        resposta.write(id + "\n" + r);
        resposta.close();
        return "ATENDIDO|" + r;
    }
    return "NADA|";
}
