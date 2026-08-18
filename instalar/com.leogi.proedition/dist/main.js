"use strict";(()=>{var te=(e=>typeof require<"u"?require:typeof Proxy<"u"?new Proxy(e,{get:(o,a)=>(typeof require<"u"?require:o)[a]}):e)(function(e){if(typeof require<"u")return require.apply(this,arguments);throw Error('Dynamic require of "'+e+'" is not supported')});function Be(e,o){return e[o]}function be(e){let o=/<body[^>]*>([\s\S]*?)<!--SCRIPT-->/.exec(e);if(!o)throw new Error("HTML sem <body>...<!--SCRIPT--> no formato esperado");return o[1].trim()}var Ue=`<!DOCTYPE html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <title>Auto B-roll</title>
    <!-- O build substitui esta marca pelo conteudo de styles.css.
         <link rel="stylesheet"> nao carrega no UXP. -->
    <!--ESTILOS-->
  </head>
  <body>
    <header class="topo">
      <div class="marca">
        <span class="marca-nome">Auto B-roll</span>
        <span class="marca-fase">Fase 1</span>
      </div>
      <div id="estado" class="badge">carregando</div>
    </header>

    <main class="conteudo">
      <section class="secao">
        <div class="secao-cabeca">
          <span class="cod">SEQ</span>
          <span class="secao-rotulo">Sequencia ativa</span>
        </div>
        <div class="secao-corpo">
          <div id="seqNome" class="seq-nome" data-vazio="sim">Nenhuma sequencia selecionada</div>
          <div id="seqDica" class="dica">
            Abra ou selecione uma sequencia no Premiere. O painel le sozinho a que estiver ativa.
          </div>
          <div class="fatos">
            <div class="fato">
              <span class="fato-rotulo">Formato</span>
              <span id="seqFormato" class="fato-valor">\u2014</span>
            </div>
            <div class="fato">
              <span class="fato-rotulo">Frame rate</span>
              <span id="seqFps" class="fato-valor">\u2014</span>
            </div>
            <div class="fato">
              <span class="fato-rotulo">Duracao</span>
              <span id="seqDuracao" class="fato-valor">\u2014</span>
            </div>
            <div class="fato">
              <span class="fato-rotulo">Faixas</span>
              <span id="seqFaixas" class="fato-valor">\u2014</span>
            </div>
          </div>
        </div>
      </section>

      <div class="par">
        <section class="secao">
          <div class="secao-cabeca">
            <span class="cod cod-video">V2</span>
            <span class="secao-rotulo">Video do B-roll</span>
          </div>
          <div class="secao-corpo">
            <sp-checkbox id="fillScreen">Preencher a tela</sp-checkbox>
            <sp-checkbox id="densidadeMaxima">Densidade maxima</sp-checkbox>
          </div>
        </section>

        <section class="secao">
          <div class="secao-cabeca">
            <span class="cod cod-audio">A3</span>
            <span class="secao-rotulo">Audio do B-roll</span>
          </div>
          <div class="secao-corpo">
            <sp-checkbox id="removeAudio">Remover o audio</sp-checkbox>
          </div>
        </section>
      </div>

      <section class="secao">
        <div class="secao-cabeca">
          <span class="cod">SRC</span>
          <span class="secao-rotulo">Pasta de B-rolls</span>
        </div>
        <div class="secao-corpo">
          <label class="campo">
            <span class="campo-rotulo">Caminho da pasta no disco</span>
            <sp-textfield id="libraryPath" placeholder="caminho da pasta de B-rolls"></sp-textfield>
            <span class="campo-nota">Cole o caminho da pasta. Ele fica gravado depois da primeira analise que funcionar.</span>
          </label>
        </div>
      </section>

      <div class="acao">
        <sp-button id="analisar" variant="cta">Analisar e inserir</sp-button>
        <sp-button id="aprender" variant="secondary" quiet>Aprender</sp-button>
      </div>

      <section id="secaoLog" class="secao secao-log" data-aberto="sim">
        <div class="secao-cabeca">
          <span class="cod">LOG</span>
          <span class="secao-rotulo">Registro da execucao</span>
          <div
            id="logToggle"
            class="secao-acao"
            role="button"
            tabindex="0"
            aria-expanded="true"
            aria-controls="log"
            aria-label="Recolher o registro"
          >
            Recolher
          </div>
        </div>
        <div class="secao-corpo">
          <div id="log" class="log"></div>
        </div>
      </section>
    </main>

    <!-- O build substitui esta marca pelo bundle inteiro.
         Caminho relativo nao resolve: o UXP procura a partir da raiz do
         plugin, nao da pasta do HTML. -->
    <!--SCRIPT-->
  </body>
</html>
`;var _e=`/*
 * ============================================================================
 * FAMILIA PRO EDITION \u2014 folha de componentes do Auto B-roll
 * ============================================================================
 *
 * Restricoes do UXP que ditam TODA a estrutura abaixo (ver
 * docs/UXP_ARMADILHAS.md, cada uma custou um ciclo de reiniciar o Premiere):
 *
 *  - \`<link rel="stylesheet">\` NAO carrega. Este arquivo e embutido como
 *    <style> por scripts/build.mjs.
 *  - \`display: grid\` e IGNORADO. Layout inteiro em flexbox.
 *  - \`gap\` e \`var()\` NAO sao confiaveis. Por isso os tokens abaixo sao um
 *    bloco documentado com valores literais, e nao \`:root { --token: ... }\`;
 *    espacamento sai de margin, nunca de gap.
 *  - Media query nao e confiavel, e este painel nunca roda em telefone. A
 *    responsividade real e a largura do painel acoplado no Premiere, e sai de
 *    \`flex-wrap\` com \`flex: 1 1 <base>\`: blocos lado a lado quando ha largura,
 *    empilhados quando nao ha.
 *  - Num flex column os filhos NAO esticam: encolhem ate o conteudo e ficam
 *    centralizados. \`align-items: stretch\` explicito e o que resolve;
 *    \`text-align: left\` sozinho nao basta.
 *  - \`<button>\` nativo e renderizado como controle do host: ignora o CSS do
 *    proprio elemento e achata os filhos numa linha so. Onde precisamos de um
 *    botao estilizado usamos \`div[role="button"][tabindex="0"]\`.
 *
 * ---------------------------------------------------------------- TOKENS ---
 * Mesma tabela nos tres plugins da familia (Auto B-roll, Pro Captions, Pro
 * Edition). Repetida de proposito em cada folha: sao repos independentes que
 * precisam construir sozinhos, e var() nao funciona aqui.
 *
 *   SUPERFICIE
 *     bg-0        #0d0f13   fundo do painel (quase preto)
 *     bg-1        #14171d   superficie: secoes e cards
 *     bg-2        #1a1e26   superficie elevada: topo, cabeca de secao, chips
 *     bg-3        #202631   hover de superficie clicavel
 *     line        #232830   borda sutil (padrao)
 *     line-2      #333b47   borda em hover
 *
 *   TEXTO
 *     txt         #eceef2   conteudo principal
 *     txt-2       #9098a6   secundario, rotulos
 *     txt-3       #5f6774   apagado: vazio, placeholder, dica
 *
 *   SEMANTICA
 *     azul        #3b82f6   acao primaria, foco
 *     verde       #4ecb8d   sucesso / pronto / faixa de audio
 *     ambar       #eeab4c   atencao / processando
 *     vermelho    #ff7d71   erro
 *     violeta     #8d82f5   acento do Auto B-roll / faixa de video
 *
 *   FORMA
 *     raio-lg     10px      secoes e cards
 *     raio-md     8px       campos e controles
 *     raio-full   999px     chips de status
 *     transicao   150ms     hover, focus, active
 *
 *   TIPOGRAFIA
 *     sans        Inter, adobe-clean, Segoe UI      (Inter se instalada)
 *     mono        Roboto Mono, Consolas             (dado tecnico e codigo)
 *     escala      15/13/12/11/9 px
 * ============================================================================
 */

html,
body {
  height: 100%;
  margin: 0;
  padding: 0;
}

body {
  display: flex;
  flex-direction: column;
  background-color: #0d0f13;
  color: #eceef2;
  font-family: Inter, adobe-clean, "Source Sans 3", "Segoe UI", sans-serif;
  font-size: 13px;
  line-height: 1.45;
  overflow: hidden;
  /* O UXP centraliza texto por padrao em varios contextos. Fixar aqui e
     repetir nos rotulos, senao tudo fica no meio do bloco. */
  text-align: left;
}

/* =============================================================== HEADER === */

.topo {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  flex: none;
  padding: 10px 12px;
  background-color: #1a1e26;
  border-bottom: 1px solid #232830;
}

.marca {
  display: flex;
  flex-direction: row;
  align-items: baseline;
  min-width: 0;
}

/* Tarja de 3px antes do nome: a mesma linguagem de cor dos codigos de faixa,
   so que na marca \u2014 o acento deste plugin (violeta) aparece antes mesmo de
   abrir qualquer secao. E o fio que costura os tres plugins da familia. */
.marca-nome::before {
  content: "";
  display: inline-block;
  width: 3px;
  height: 12px;
  margin-right: 8px;
  vertical-align: -1px;
  background-color: #8d82f5;
  border-radius: 2px;
}

.marca-nome {
  text-align: left;
  font-size: 15px;
  font-weight: 700;
  letter-spacing: -0.01em;
  color: #ffffff;
  white-space: nowrap;
}

.marca-fase {
  margin-left: 8px;
  font-family: "Roboto Mono", Consolas, monospace;
  font-size: 10px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #5f6774;
  white-space: nowrap;
}

/* ========================================================= STATUS BADGE === */

/* Discreto por definicao: chip de contorno, nunca preenchido. O glifo antes do
   texto e o que faz o status nao depender so de cor. */
.badge {
  display: flex;
  flex-direction: row;
  align-items: center;
  flex: none;
  padding: 2px 9px;
  background-color: #14171d;
  border: 1px solid #232830;
  border-radius: 999px;
  font-family: "Roboto Mono", Consolas, monospace;
  font-size: 10px;
  letter-spacing: 0.02em;
  color: #9098a6;
  white-space: nowrap;
}

.badge::before {
  content: "\\2022";
  margin-right: 5px;
  font-size: 10px;
}

.badge[data-tom="ok"] {
  color: #4ecb8d;
  border-color: #26493a;
}

.badge[data-tom="ok"]::before {
  content: "\\2713";
}

.badge[data-tom="ativo"] {
  color: #eeab4c;
  border-color: #4a3a20;
}

.badge[data-tom="ativo"]::before {
  content: "\\25cc";
}

.badge[data-tom="aviso"] {
  color: #eeab4c;
  border-color: #4a3a20;
}

.badge[data-tom="aviso"]::before {
  content: "!";
}

.badge[data-tom="erro"] {
  color: #ff7d71;
  border-color: #542c29;
}

.badge[data-tom="erro"]::before {
  content: "\\00d7";
}

/* ================================================================ CORPO === */

.conteudo {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 12px;
}

/* Linha que quebra sozinha: e isto que torna o painel responsivo sem grid nem
   media query. Duas colunas quando o painel esta largo, uma quando esta
   acoplado estreito. */
/*
 * \`flex: none\` em TODO filho direto de \`.conteudo\`, aqui e nas duas regras
 * abaixo.
 *
 * \`.conteudo\` e um flex column de altura definida (o painel inteiro), e num
 * flex column o filho encolhe por padrao. Sem isto, o conteudo que nao cabe
 * espreme as secoes em vez de rolar: medido no Chrome, a secao SRC ficava 18px
 * mais baixa que o proprio conteudo e cortava a ultima linha dentro do
 * \`overflow: hidden\`. Quem rola e \`.conteudo\`; as secoes nunca encolhem.
 */
.par {
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  align-items: stretch;
  flex: none;
  margin-left: -4px;
  margin-right: -4px;
}

/* 180px: V2 e A3 pareiam a partir de ~390px de painel e empilham abaixo
   disso. Medido no Chrome com as previas de 300px e 420px. */
.par > .secao {
  flex: 1 1 180px;
  margin-left: 4px;
  margin-right: 4px;
}

/* ============================================================== SECTION === */

/*
 * A secao substituiu a canaleta vertical de 44px que existia antes. O codigo
 * da faixa (SEQ, V2, A3, SRC, LOG) continua sendo a identidade do painel, mas
 * agora mora numa cabeca horizontal: devolve 44px de largura ao conteudo em
 * todas as secoes \u2014 o que importa muito num painel acoplado estreito \u2014 e poe o
 * rotulo acima do que ele rotula, em vez de ao lado.
 */
.secao {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  flex: none;
  margin-bottom: 8px;
  background-color: #14171d;
  border: 1px solid #232830;
  border-radius: 10px;
  overflow: hidden;
}

.secao-cabeca {
  display: flex;
  flex-direction: row;
  align-items: center;
  flex: none;
  padding: 7px 12px;
  background-color: #1a1e26;
  border-bottom: 1px solid #232830;
}

.cod {
  flex: none;
  margin-right: 9px;
  font-family: "Roboto Mono", Consolas, monospace;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.08em;
  color: #6b7381;
  white-space: nowrap;
}

.cod-video {
  color: #8d82f5;
}

.cod-audio {
  color: #4ecb8d;
}

.secao-rotulo {
  flex: 1 1 auto;
  min-width: 0;
  text-align: left;
  font-size: 11px;
  font-weight: 500;
  color: #9098a6;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.secao-corpo {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  flex: 1 1 auto;
  min-width: 0;
  padding: 11px 12px;
}

/* ============================================================ SEQUENCIA === */

.seq-nome {
  text-align: left;
  font-size: 15px;
  font-weight: 600;
  letter-spacing: -0.01em;
  color: #ffffff;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
  margin-bottom: 9px;
}

.seq-nome[data-vazio="sim"] {
  font-size: 13px;
  font-weight: 500;
  color: #9098a6;
}

/* EmptyState: a dica so existe enquanto nao ha sequencia. Quem esconde e o
   mount(), nao o CSS \u2014 seletor de irmao adjacente nao e garantido no UXP e
   uma dica presa na tela mentiria sobre o estado real. */
.dica {
  text-align: left;
  font-size: 12px;
  color: #5f6774;
  margin-bottom: 9px;
}

.fatos {
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  margin-left: -6px;
  margin-right: -6px;
  margin-bottom: -4px;
}

.fato {
  flex: 1 1 88px;
  min-width: 0;
  padding-left: 6px;
  padding-right: 6px;
  margin-bottom: 4px;
}

.fato-rotulo {
  text-align: left;
  display: block;
  font-size: 9px;
  letter-spacing: 0.09em;
  text-transform: uppercase;
  color: #5f6774;
  white-space: nowrap;
}

.fato-valor {
  text-align: left;
  display: block;
  font-family: "Roboto Mono", Consolas, monospace;
  font-size: 12px;
  color: #eceef2;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/* ============================================================ FORMFIELD === */

/* \`align-items: stretch\` e obrigatorio: no UXP os filhos de um flex column nao
   esticam, encolhem e ficam centralizados \u2014 e ai \`text-align\` nao adianta,
   porque a caixa do texto ja e do tamanho do texto. */
.campo {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  min-width: 0;
}

.campo-rotulo {
  display: block;
  text-align: left;
  font-size: 11px;
  color: #9098a6;
  margin-bottom: 4px;
}

.campo sp-textfield {
  width: 100%;
}

.campo-nota {
  display: block;
  text-align: left;
  font-size: 11px;
  color: #5f6774;
  margin-top: 5px;
}

/* ======================================================= TOGGLE/CHECKBOX === */

/* Nao mexer no \`display\` do sp-checkbox: ele e inline-flex por dentro, e
   forcar block joga o rotulo para baixo da caixa. So espacamento e tamanho. */
.secao-corpo sp-checkbox {
  font-size: 12px;
  margin-bottom: 6px;
}

.secao-corpo sp-checkbox:last-child {
  margin-bottom: 0;
}

/* =============================================================== BUTTON === */

/*
 * Hierarquia de acao: a primaria ganha o dobro de base flexivel da secundaria,
 * entao ela e sempre visualmente maior quando as duas cabem na mesma linha, e
 * e a primeira a ocupar a linha inteira quando o painel estreita. A secundaria
 * e \`quiet\` (so texto) para nao disputar com ela.
 */
.acao {
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  align-items: center;
  flex: none;
  margin-left: -4px;
  margin-right: -4px;
  margin-bottom: 8px;
}

.acao sp-button {
  margin-left: 4px;
  margin-right: 4px;
  margin-bottom: 4px;
}

.acao sp-button#analisar {
  flex: 2 1 180px;
}

.acao sp-button#aprender {
  flex: 1 1 110px;
}

/* ============================================================== LOGPANEL === */

/*
 * O log rola por dentro, com altura propria e recolhivel.
 *
 * Sem altura propria ele cresce para baixo e as ultimas linhas \u2014 que sao as que
 * importam \u2014 nascem fora da area visivel do painel. Foi exatamente o que fez o
 * plugin parecer morto: as mensagens estavam sendo escritas, so nao dava para
 * ve-las. Por isso nasce ABERTO: recolher e escolha do usuario, nunca o padrao.
 */
.secao-log {
  margin-bottom: 0;
}

.secao-log .secao-corpo {
  padding: 0;
}

.secao[data-aberto="nao"] .secao-corpo {
  display: none;
}

/* Acao de cabeca de secao. \`div[role=button]\` e nao \`<button>\`: o botao nativo
   do UXP ignora o CSS do proprio elemento e vira pilula cinza. */
.secao-acao {
  flex: none;
  margin-left: 8px;
  padding: 2px 8px;
  background-color: #14171d;
  border: 1px solid #232830;
  border-radius: 8px;
  font-size: 11px;
  color: #9098a6;
  white-space: nowrap;
  cursor: pointer;
  transition: background-color 150ms, border-color 150ms, color 150ms;
}

.secao-acao:hover {
  background-color: #202631;
  border-color: #333b47;
  color: #eceef2;
}

.secao-acao:active {
  background-color: #1a1e26;
}

.secao-acao:focus {
  border-color: #3b82f6;
  color: #eceef2;
  outline: none;
}

.log {
  height: 132px;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 9px 12px;
  font-family: "Roboto Mono", Consolas, monospace;
  font-size: 11px;
  line-height: 1.6;
  color: #9098a6;
  white-space: pre-wrap;
  word-break: break-word;
}

.l-ok {
  color: #4ecb8d;
}

.l-erro {
  color: #ff7d71;
}

.l-passo {
  color: #c9cfd8;
}

.l-aviso {
  color: #eeab4c;
}

.l-vazio {
  color: #5f6774;
}
`;function ve(e,o){return o<e.inPointSeconds||o>=e.outPointSeconds?null:e.startSeconds+(o-e.inPointSeconds)/e.speed}function Ge(e,o){if(e.width<=0||e.height<=0)throw new RangeError(`dimensao invalida do clipe: ${e.width}x${e.height}`);return Math.max(o.width/e.width,o.height/e.height)*100}var xe=.1;function He(e,o,a){if(!Number.isFinite(e)||!Number.isFinite(o))return null;let n=Math.max(0,e),t=Math.min(o,a);return t-n<xe||n<=xe&&t>=a-xe?null:{inicio:n,fim:t}}function Ve(e,o){if(!Number.isFinite(e)||!Number.isFinite(o)||o<=0)return"--:--:--:--";let a=Math.max(1,Math.round(o)),n=Math.max(0,Math.round(e*a)),t=n%a,r=Math.floor(n/a),i=s=>String(s).padStart(2,"0");return`${i(Math.floor(r/3600))}:${i(Math.floor(r/60)%60)}:${i(r%60)}:${i(t)}`}function T(e){let o=Math.max(0,Math.round(e)),a=n=>String(n).padStart(2,"0");return`${a(Math.floor(o/60))}:${a(o%60)}`}var $={schema:1,videoTrackIndex:1,audioTrackIndex:2,removeAudio:!0,fillScreen:!0,densidadeMaxima:!0,libraryPath:""};function Xe(e){if(typeof e!="object"||e===null)return $;let o=e,a=(t,r)=>typeof t=="number"&&Number.isInteger(t)&&t>=0?t:r,n=(t,r)=>typeof t=="boolean"?t:r;return{schema:1,videoTrackIndex:a(o.videoTrackIndex,$.videoTrackIndex),audioTrackIndex:a(o.audioTrackIndex,$.audioTrackIndex),removeAudio:n(o.removeAudio,$.removeAudio),fillScreen:n(o.fillScreen,$.fillScreen),densidadeMaxima:n(o.densidadeMaxima,$.densidadeMaxima),libraryPath:typeof o.libraryPath=="string"?o.libraryPath:$.libraryPath}}var za=new Set(["mp4","mov","m4v","mxf","avi","mkv","webm"]);function Je(e){let o=e.lastIndexOf(".");return o<0?!1:za.has(e.slice(o+1).toLowerCase())}function re(e){let o=e.trim().replace(/^["']+|["']+$/g,"");o=o.replace(/^file:\/*/i,"");for(let n=0;n<3;n++){let t;try{t=decodeURI(o)}catch{break}if(t===o)break;o=t}let a=o.replace(/\\/g,"/").replace(/\/+$/,"").replace(/^\/+/,"");if(a.length===0)throw new RangeError("caminho vazio");return`file:/${a}`}function Qe(e,o){return`${e}${o+1}`}var Fa=new Set(["que","com","para","por","uma","uns","umas","dos","das","nos","nas","ele","ela","eles","elas","isso","isto","aquilo","seu","sua","meu","minha","voce","vocs","nao","sim","mas","como","quando","onde","porque","muito","mais","menos","tudo","todo","toda","todos","todas","ser","estar","tem","ter","foi","sao","era","esta","essa","esse","aqui","ali","lah","ja","ainda","entao","assim","bem","vai","vou","pode"]);function We(e){let o=e;return o.length>4&&o.endsWith("oes")?`${o.slice(0,-3)}ao`:o.length>4&&(o.endsWith("aes")||o.endsWith("ais"))?`${o.slice(0,-3)}al`:o.length>4&&o.endsWith("ns")?`${o.slice(0,-2)}m`:(o.length>3&&o.endsWith("s")&&(o=o.slice(0,-1)),o)}function V(e){return e.normalize("NFD").replace(/[̀-ͯ]/g,"").toLowerCase().replace(/[^a-z0-9\s]/g," ").split(/\s+/).filter(o=>o.length>=3&&!Fa.has(o)).map(We)}var ye=new Map([["viagra",["disfuncao","eretil","impotencia","erecao","ereto","remedio","comprimido","pilula","azul","potencia","desempenho","ejaculacao","precoce","libido","rigidez"]],["teleconsulta",["telemedicina","online","distancia","videochamada","atendimento","clicando","botao","link","celular","aplicativo"]],["doutor",["medico","urologista","especialista","profissional","clinica","andrologista"]],["falhou",["brochar","brochou","falha","falhar","vexame","fracasso","decepcionar","perder","ejaculacao","precoce"]],["cama",["sexual","sexo","relacao","intimidade","transar","desempenho","performance","noite"]],["frustrado",["frustracao","vergonha","humilhacao","deprimido","triste","desanimo","briga","problema","piora","sofrimento"]],["desanimado",["desanimo","animo","cansado","abatido","energia","apatia","disfuncao","eretil","ejaculacao","precoce","impotencia","libido"]],["separacao",["divorcio","separar","terminar","briga","distanciamento","afastamento","traicao","casamento"]],["infarto",["cardiaco","coracao","avc","entupimento","pressao","risco","derrame","circulatorio"]],["sanguineo",["circulacao","sangue","arteria","veia","fluxo","irrigacao","vascular","entupimento"]],["vaso",["arteria","veia","circulacao","irrigacao"]],["tratamento",["tratar","solucao","cura","protocolo","terapia","adequado","resolver"]],["consulta",["consultorio","avaliacao","diagnostico","atendimento","exame"]],["medica",["medico","saude","clinica"]],["exames",["exame","diagnostico","laboratorio","ultrassom","doppler","sangue"]],["doppler",["ultrassom","exame","circulacao","fluxo"]],["medicamento",["remedio","comprimido","medicacao","tarja","receita","dose"]],["injetaveis",["injecao","injetavel","aplicacao","agulha","aplicar"]],["paliativa",["paliativo","temporario","tapar","disfarcar","provisorio","engana"]],["medida",["solucao","saida","alternativa"]],["diabetes",["diabetico","glicemia","acucar","glicose"]],["academia",["exercicio","treino","musculacao","atividade","fisica","esporte"]],["corpo",["fisico","saude","organismo"]],["casal",["casais","relacionamento","parceira","esposa","mulher","namorada","conjuge"]],["feliz",["felicidade","alegria","satisfacao","prazer"]],["milhare",["milhoes","milhao","muitos","maioria","brasileiros"]],["homem",["homens","masculino","cara","rapaz"]],["alivio",["aliviar","melhora","solucao","conforto","tranquilidade"]],["emocional",["emocao","sentimento","psicologico","distanciamento","autoestima"]],["tempo",["bomba","relogio","urgente","urgencia","prazo","demora","adiar","piora"]],["acabando",["acabar","explodir","estourar","limite","fim"]],["disposicao",["energia","animo","vitalidade","vigor"]],["receita",["caseiro","cha","simpatia","milagroso","internet"]],["gaveta",["escondido","guardado","vergonha"]],["jogando",["jogar","largar","parar","abandonar","livrar"]],["comparacao",["comparar","antes","depois","diferenca"]],["jovem",["jovens","idade"]],["paciente",["atendido","avaliado","diagnostico"]],["reservada",["privacidade","discricao","sigilo","particular"]]]),Ke=ye;function Ze(e){Ke=e}function Ye(e){if(typeof e!="object"||e===null)return null;let o=e.sinonimos;if(typeof o!="object"||o===null)return null;let a=new Map;for(let[n,t]of Object.entries(o)){if(!Array.isArray(t))continue;let r=t.filter(i=>typeof i=="string"&&i.length>0);r.length>0&&a.set(n,r)}return a.size>0?a:null}function eo(e){let o={};for(let[a,n]of e)o[a]=n;return{schema:1,sinonimos:o}}function oo(e){let o=new Map;for(let n of e){let t=n.replace(/\.[a-z0-9]+$/i,"").replace(/\s*\(\d+\)\s*$/,"").trim();if(t.length===0)continue;let r=o.get(t);r?r.push(n):o.set(t,[n])}let a=[];for(let[n,t]of o)a.push({rotulo:n,arquivos:t,termos:V(n)});return a.sort((n,t)=>n.rotulo.localeCompare(t.rotulo,"pt-BR")),a}var ja=6,Da=.6;function K(e,o){if(e===o)return!0;let a=Math.min(e.length,o.length),n=0;for(;n<a&&e[n]===o[n];)n++;return n>=ja&&n/a>=Da}function La(e){let o=new Map;for(let n of e)for(let t of new Set(n.termos))o.set(t,(o.get(t)??0)+1);let a=new Map;for(let[n,t]of o)a.set(n,1/t);return a}function X(e,o){if(o.some(n=>K(e,n)))return!0;let a=Ke.get(e);return a?a.some(n=>o.some(t=>K(We(n),t))):!1}function ao(e,o,a=3){let n=V(e);if(n.length===0)return[];let t=La(o),r=[];for(let i of o){if(i.termos.length===0)continue;let s=i.termos.filter(p=>X(p,n));if(s.length===0)continue;let c=i.termos.reduce((p,d)=>p+(t.get(d)??1),0),l=s.reduce((p,d)=>p+(t.get(d)??1),0),u=c>0?l/c:0;r.push({conceito:i,score:u,motivo:s.length===i.termos.length?`frase contem "${i.rotulo}"`:`casou ${s.join(", ")} de "${i.rotulo}"`,termosCasados:s})}return r.sort((i,s)=>s.score!==i.score?s.score-i.score:s.conceito.termos.length!==i.conceito.termos.length?s.conceito.termos.length-i.conceito.termos.length:i.conceito.rotulo.localeCompare(s.conceito.rotulo,"pt-BR")),r.slice(0,a)}function no(e){let o;try{o=JSON.parse(e)}catch{return null}if(typeof o!="object"||o===null)return null;let a=o;if(!Array.isArray(a.segments))return null;let n=[];for(let t of a.segments){if(typeof t!="object"||t===null)continue;let r=t;if(!Array.isArray(r.words))continue;let i=[];for(let s of r.words){if(typeof s!="object"||s===null)continue;let c=s;typeof c.text!="string"||typeof c.start!="number"||i.push({text:c.text,start:c.start,duration:typeof c.duration=="number"?c.duration:0,confidence:typeof c.confidence=="number"?c.confidence:1,eos:c.eos===!0,type:typeof c.type=="string"?c.type:"word"})}n.push({start:typeof r.start=="number"?r.start:0,duration:typeof r.duration=="number"?r.duration:0,speaker:typeof r.speaker=="string"?r.speaker:"",words:i})}return{language:typeof a.language=="string"?a.language:"",segments:n}}function to(e,o){let a=[];for(let n of e){let t=o.get(n.sourceName);if(t)for(let r of t.segments)for(let i of r.words){if(i.type!=="word")continue;let s=ve(n,i.start);if(s===null)continue;let c=i.start+i.duration,l=ve(n,c)??n.endSeconds;a.push({text:i.text,inicio:s,fim:Math.max(s,l),confidence:i.confidence,eos:i.eos,sourceName:n.sourceName})}}return a.sort((n,t)=>n.inicio-t.inicio),a}var Ba=1.5,Ua=.05;function ro(e){let o=[],a=[],n=()=>{if(a.length===0)return;let t=a[0],r=a[a.length-1];if(!t||!r)return;let i=[];for(let s of a)for(let c of V(s.text))i.push({termo:c,inicio:s.inicio});o.push({texto:a.map(s=>s.text).join(" "),inicio:t.inicio,fim:r.fim,duracao:r.fim-t.inicio,palavras:a.length,confiancaMinima:Math.min(...a.map(s=>s.confidence)),termosNoTempo:i}),a=[]};for(let t=0;t<e.length;t++){let r=e[t];if(!r)continue;let i=a[a.length-1];i&&r.inicio-i.fim>Ba&&n(),a.push(r);let s=e[t+1],c=s?s.inicio-r.fim:Number.POSITIVE_INFINITY;r.eos&&c>=Ua&&n()}return n(),o}var _a=.6,Ga=1.2,Ha=.5,Va=.75;function Xa(e,o,a,n){if(a===void 0||a.size===0)return[];let t=new Set(e.termosNoTempo.map(s=>s.termo)),r=new Set(n.map(s=>s.conceito.rotulo)),i=[];for(let s of o){if(r.has(s.rotulo))continue;let c=a.get(s.rotulo);if(c===void 0)continue;let l=c.filter(u=>t.has(u));l.length!==0&&i.push({conceito:s,score:Va,motivo:`voce ensinou: "${l.join(", ")}" pede "${s.rotulo}"`,termosCasados:l})}return i}function io(e){let o=[],a=e.duracaoMinima??Ga,n=e.scoreMinimo??Ha,t=new Map;for(let[l,u]of e.transcricoesJson){let p=no(u);p?t.set(l,p):o.push(`Transcricao ilegivel em ${l}.`)}t.size===0&&o.push("Nenhuma midia da timeline tem transcricao. Gere a transcricao no Premiere primeiro.");let r=to(e.clipes,t),i=ro(r),s=oo(e.biblioteca);s.length===0&&o.push("Nenhum conceito encontrado no projeto.");let c=[];for(let l of i){if(l.duracao<a)continue;let u=ao(l.texto,s).filter(d=>d.score>=n),p=[...u,...Xa(l,s,e.ligacoes,u)].sort((d,f)=>f.score-d.score).slice(0,3);p.length!==0&&(l.confiancaMinima<_a&&o.push(`Trecho incerto em ${l.inicio.toFixed(1)}s (confianca ${l.confiancaMinima.toFixed(2)}): "${l.texto}"`),c.push({frase:l,sugestoes:p}))}return{palavras:r.length,frases:i,conceitos:s,oportunidades:c,avisos:o}}var Ja=.15,Qa=.5,Wa=1.5,uo={schema:3,pares:{},arquivos:{},vistos:{}};function ie(e,o){return`${e}|${o}`}function mo(e,o,a){if(a.length===0)return 1;let n=0;for(let t of a){let r=e.pares[ie(o,t)],i=r===void 0?1:1+Ja*(r.acertos-r.erros);n+=Math.min(Wa,Math.max(Qa,i))}return n/a.length}function po(e,o,a){let n={...e.pares},t={...e.arquivos},r=0,i=0;for(let s of o.itens){let c=a.has(s.arquivo);c?r++:i++,Z(t,s.arquivo,c);for(let l of s.termosCasados)Z(n,ie(s.conceito,l),c)}return{memoria:{...e,schema:3,pares:n,arquivos:t},acertos:r,erros:i}}var Ka=20;function Z(e,o,a){let n=e[o]??{acertos:0,erros:0},t=n.acertos+(a?1:0),r=n.erros+(a?0:1);for(;t+r>Ka;)t=Math.round(t/2),r=Math.round(r/2);e[o]={acertos:t,erros:r}}function Za(e){if(e.length<=60)return e;let o=e.lastIndexOf(" ",60);return`${e.slice(0,o>20?o:60)}\u2026`}var fo=.5;function Ya(e,o){let a,n=0;for(let t of e){let r=Math.min(o.fim,t.fim)-Math.max(o.inicio,t.inicio);r>n&&(n=r,a=t)}return a!==void 0?a:e.find(t=>o.inicio>=t.inicio-fo&&o.inicio<t.fim)}function go(e,o,a,n,t,r=we){let i=r,s={...e.pares},c={...e.arquivos},l={...e.vistos},u=[],p=0,d=0,f=0,h=0;for(let m of a){let v=t.find(q=>q.arquivos.includes(m.arquivo));if(v===void 0){f++;continue}let y=Ya(n,m);if(y===void 0){h++;continue}let P=v.termos.filter(q=>X(q,V(y.texto)));if(P.length===0){let q=`assoc|${o}|${m.arquivo}|${Math.round(m.inicio)}`;if(l[q]!==!0){l[q]=!0,Z(c,m.arquivo,!0);let R=new Set(y.termosNoTempo.filter(E=>E.inicio>=m.inicio-fo&&E.inicio<=m.fim).map(E=>E.termo));for(let E of R)i=en(i,v.rotulo,E)}u.push(`${T(m.inicio)} voce colocou "${v.rotulo}" onde se diz "${Za(y.texto)}" \u2014 o dicionario nao explica, mas vale: o take ganhou credito e contei as palavras cobertas.`);continue}let C=`${o}|${m.arquivo}|${Math.round(m.inicio)}`;if(l[C]===!0){d++;continue}l[C]=!0,p++,Z(c,m.arquivo,!0);for(let q of P)Z(s,ie(v.rotulo,q),!0)}return{memoria:{schema:3,pares:s,arquivos:c,vistos:l},associacoes:i,creditados:p,jaContados:d,foraDaBiblioteca:f,semFala:h,semLigacao:u}}function ho(e,o){let a,n=Number.NEGATIVE_INFINITY;for(let t of o){let r=e.arquivos[t],i=r===void 0?0:r.acertos-r.erros;i>n&&(n=i,a=t)}return a}var bo=2;function xo(e,o,a){return e.some(n=>{let t=n.inicio;return t===void 0?a.has(n.arquivo):o.some(r=>r.arquivo===n.arquivo&&Math.abs(r.inicio-t)<=bo)})}function se(e,o,a){let n=e.porSequencia[o],t=new Map;for(let i of n?.postos??[])t.set(so(i),i);for(let i of a?.itens??[]){let s={arquivo:i.arquivo,...i.inicio!==void 0?{inicio:i.inicio}:{}};t.set(so(s),s)}let r={...e.porSequencia};return r[o]={quando:a?.quando??n?.quando??"",itens:a?.itens??[],postos:[...t.values()]},{schema:1,porSequencia:r}}function so(e){return e.inicio===void 0?e.arquivo:`${e.arquivo}|${Math.round(e.inicio)}`}function vo(e,o){if(o===void 0)return!1;let a=(n,t)=>n===e.arquivo&&(t===void 0||Math.abs(t-e.inicio)<=bo);return o.itens.some(n=>a(n.arquivo,n.inicio))||(o.postos??[]).some(n=>a(n.arquivo,n.inicio))}var we={schema:1,pares:{}},Pe=3;function en(e,o,a){let n=ie(o,a);return{schema:1,pares:{...e.pares,[n]:(e.pares[n]??0)+1}}}function ce(e){let o=new Map;for(let[a,n]of Object.entries(e.pares)){if(n<Pe)continue;let t=a.indexOf("|");if(t<0)continue;let r=a.slice(0,t),i=a.slice(t+1);o.set(r,[...o.get(r)??[],i])}return o}function Ae(e){if(typeof e!="object"||e===null)return we;let o=e.pares;if(typeof o!="object"||o===null)return we;let a={};for(let[n,t]of Object.entries(o))typeof t=="number"&&Number.isFinite(t)&&t>0&&(a[n]=Math.floor(t));return{schema:1,pares:a}}function yo(e){let o={};if(typeof e=="object"&&e!==null){let a=e.vistos;if(typeof a=="object"&&a!==null)for(let n of Object.keys(a))o[n]=!0}return{schema:3,pares:co(e,"pares"),arquivos:co(e,"arquivos"),vistos:o}}function co(e,o){let a={};for(let[n,t]of Po(e,o)){let r=lo(t.acertos),i=lo(t.erros);r!==null&&i!==null&&(a[n]={acertos:r,erros:i})}return a}function wo(e){let o={};for(let[a,n]of Po(e,"porSequencia")){let t=n;if(!Array.isArray(t.itens))continue;let r=[];for(let s of t.itens){if(typeof s!="object"||s===null)continue;let c=s;typeof c.arquivo!="string"||typeof c.conceito!="string"||r.push({arquivo:c.arquivo,conceito:c.conceito,termosCasados:Array.isArray(c.termosCasados)?c.termosCasados.filter(l=>typeof l=="string"):[],...typeof c.inicio=="number"&&Number.isFinite(c.inicio)?{inicio:c.inicio}:{}})}let i=[];for(let s of Array.isArray(t.postos)?t.postos:[])if(typeof s=="string")i.push({arquivo:s});else if(typeof s=="object"&&s!==null){let c=s;if(typeof c.arquivo!="string")continue;i.push({arquivo:c.arquivo,...typeof c.inicio=="number"&&Number.isFinite(c.inicio)?{inicio:c.inicio}:{}})}o[a]={quando:typeof t.quando=="string"?t.quando:"",itens:r,postos:i}}return{schema:1,porSequencia:o}}function Po(e,o){if(typeof e!="object"||e===null)return[];let a=e[o];return typeof a!="object"||a===null?[]:Object.entries(a).filter(n=>typeof n[1]=="object"&&n[1]!==null)}function lo(e){return typeof e=="number"&&Number.isFinite(e)&&e>=0?Math.floor(e):null}function Ao(e){let o=e.filter(t=>t!==null);if(o.length===0)return e.map(()=>null);if(o.length===1)return e.map(t=>t===null?null:.5);let a=[...o].sort((t,r)=>t-r),n=a.length-1;return e.map(t=>t===null?null:a.indexOf(t)/n)}function So(e,o,a){let n=[];return e.forEach((t,r)=>{(t===null||Math.abs(t-o)<=a)&&n.push(r)}),n}function de(e,o){return o>0?e/o:0}var le={schema:1,arquivos:{}};function qo(e,o){return o.filter(a=>!(a in e.arquivos))}function ko(e,o,a){return{schema:1,arquivos:{...e.arquivos,[o]:a}}}function Co(e){if(typeof e!="object"||e===null)return le;let o=e.arquivos;if(typeof o!="object"||o===null)return le;let a={};for(let[n,t]of Object.entries(o))t===null?a[n]=null:typeof t=="number"&&Number.isFinite(t)&&t>=0&&(a[n]=t);return{schema:1,arquivos:a}}var ue={duracaoMinima:1.5,duracaoMaxima:4,intervaloMinimo:2,scoreMinimo:.6,janelaSemRepetir:20,janelaMesmoArquivo:60,antecipacao:.3,toleranciaIntensidade:.35},Io={...ue,duracaoMinima:1.2,duracaoMaxima:3,intervaloMinimo:0,janelaSemRepetir:8};function To(e,o){for(let a of e.termosNoTempo)if(o.some(n=>K(n,a.termo)))return a.inicio;for(let a of e.termosNoTempo)if(o.some(n=>X(n,[a.termo])))return a.inicio;return e.inicio}var on=1.5;function an(e,o){if(o.length<2)return 0;let a=o.map(r=>e.termosNoTempo.filter(i=>K(r,i.termo)||X(r,[i.termo])).map(i=>i.inicio));if(a.some(r=>r.length===0))return null;let n=a[0];if(n===void 0)return null;let t=Number.POSITIVE_INFINITY;for(let r of n){let i=0;for(let s of a.slice(1)){let c=Math.min(...s.map(l=>Math.abs(l-r)));i=Math.max(i,c)}t=Math.min(t,i)}return t}function Ro(e,o,a=ue,n=uo,t){let r=[],i=[],s=t?[...t.ritmoDasFrases].sort((d,f)=>d-f):[],c=[];for(let d of e){if(d.frase.duracao<a.duracaoMinima){i.push(`${T(d.frase.inicio)} frase curta demais (${d.frase.duracao.toFixed(1)}s)`);continue}let f=!1,h=null;for(let m of d.sugestoes){let v=an(d.frase,m.termosCasados);if(v!==null&&v>on){i.push(`${T(d.frase.inicio)} ${m.conceito.rotulo}: palavras a ${v.toFixed(1)}s uma da outra, falam de coisas diferentes`);continue}let y=mo(n,m.conceito.rotulo,m.termosCasados),P=m.score*y;h=Math.max(h??0,P),!(P<a.scoreMinimo)&&(f=!0,c.push({frase:d.frase,conceito:m.conceito.rotulo,arquivos:m.conceito.arquivos,score:P,motivo:y===1?m.motivo:`${m.motivo} \xB7 aprendizado ${sn(y)}`,termosCasados:m.termosCasados,palavraEm:To(d.frase,m.termosCasados),ancoraEm:Math.max(d.frase.inicio,To(d.frase,m.termosCasados)-a.antecipacao)}))}if(!f){let m=d.sugestoes[0]?.score,v=m!==void 0&&h!==null&&h<m-.005;i.push(v?`${T(d.frase.inicio)} nenhuma sugestao passou (melhor: ${Se(m)}, caiu para ${Se(h??0)} pelo aprendizado)`:`${T(d.frase.inicio)} nenhuma sugestao passou (melhor: ${Se(m)})`)}}c.sort((d,f)=>d.ancoraEm!==f.ancoraEm?d.ancoraEm-f.ancoraEm:f.score-d.score);let l=new Map,u=new Map,p=Number.NEGATIVE_INFINITY;for(let d of c){let f=`${T(d.ancoraEm)} ${d.conceito}`;if(d.ancoraEm<p+a.intervaloMinimo){i.push(`${f}: muito perto do B-roll anterior`);continue}let h=u.get(d.conceito);if(h!==void 0&&d.ancoraEm-h<a.janelaSemRepetir){i.push(`${f}: conceito repetido ha menos de ${a.janelaSemRepetir}s`);continue}let m=d.arquivos.filter(g=>!l.has(g)),v=m.length===0,y=v?d.arquivos.filter(g=>d.ancoraEm-(l.get(g)??0)>=a.janelaMesmoArquivo):m,P=nn(y,d.frase,t,a,s),C=ho(n,P.arquivos);if(C===void 0){i.push(`${f}: todas as variacoes apareceram ha menos de ${a.janelaMesmoArquivo}s`);continue}let q=C!==y[0],R=o.caminhos.get(C);if(R===void 0){i.push(`${f}: ${C} nao esta na pasta`);continue}let E=Math.max(0,d.frase.fim-d.ancoraEm);if(E<a.duracaoMinima){i.push(`${f}: sobra so ${E.toFixed(1)}s ate o fim da frase`);continue}let W=Math.min(a.duracaoMaxima,E);r.push({arquivo:C,caminho:R,conceito:d.conceito,score:d.score,motivo:rn(d.motivo,q,P.rotulo,v),termosCasados:d.termosCasados,textoDaFrase:d.frase.texto,ancoradoEm:d.palavraEm,inicio:d.ancoraEm,duracao:W}),l.set(C,d.ancoraEm),u.set(d.conceito,d.ancoraEm),p=d.ancoraEm+W}return{colocacoes:r,descartes:i}}function nn(e,o,a,n,t){if(a===void 0||e.length<2||t.length<2)return{arquivos:e,rotulo:null};let r=de(o.palavras,o.duracao),i=t.indexOf(tn(t,r))/(t.length-1),s=Ao(e.map(l=>a.porArquivo.get(l)??null)),c=So(s,i,n.toleranciaIntensidade);return c.length===0?{arquivos:e,rotulo:null}:{arquivos:c.map(l=>e[l]).filter(l=>l!==void 0),rotulo:i>=.5?"take agitado, a fala corre aqui":"take parado, momento calmo"}}function tn(e,o){let a=e[0]??0;for(let n of e)Math.abs(n-o)<Math.abs(a-o)&&(a=n);return a}function rn(e,o,a,n=!1){let t=e;return a!==null&&(t+=` \xB7 ${a}`),o&&(t+=" \xB7 outro take, o anterior foi apagado"),n&&(t+=" \xB7 take repetido, nao sobrou inedito"),t}var Eo=.05;function Mo(e,o){let a=[],n=[];for(let t of e){let r=t.inicio+t.duracao;if(o.some(s=>t.inicio<s.fim-Eo&&s.inicio<r-Eo)){n.push(`${T(t.inicio)} ${t.conceito}: ja ha B-roll ai, deixei como esta`);continue}a.push(t)}return{entram:a,bloqueadas:n}}function sn(e){let o=Math.round((e-1)*100);return`${o>0?"+":""}${o}%`}function Se(e){return e===void 0?"nenhuma":`${Math.round(e*100)}%`}var cn=new Set(["moov","trak","mdia","edts","minf","stbl"]),ln=6;function dn(e,o){return String.fromCharCode(e[o]??0,e[o+1]??0,e[o+2]??0,e[o+3]??0)}function B(e,o){return((e[o]??0)<<24|(e[o+1]??0)<<16|(e[o+2]??0)<<8|(e[o+3]??0))>>>0}function Oo(e,o,a){let n=[],t=o;for(;t+8<=a;){let r=B(e,t),i=dn(e,t+4),s=t+8;if(r===1?(r=B(e,t+12),s=t+16):r===0&&(r=a-t),r<8||t+r>a)return null;n.push({tipo:i,conteudo:s,fim:t+r}),t+=r}return n}function me(e,o,a,n,t=0){if(t>ln)return null;let r=Oo(e,o,a);if(r===null)return null;for(let i of r){if(i.tipo===n)return i;if(cn.has(i.tipo)){let s=me(e,i.conteudo,i.fim,n,t+1);if(s)return s}}return null}function $o(e){let o=me(e,0,e.length,"moov");if(!o)return null;let a=Oo(e,o.conteudo,o.fim);if(a===null)return null;for(let n of a){if(n.tipo!=="trak")continue;let t=me(e,n.conteudo,n.fim,"tkhd");if(!t)continue;let r=mn(e,t.conteudo);if(!r)continue;let i=me(e,n.conteudo,n.fim,"stsz");return{tamanho:r,amostras:i?un(e,i.conteudo,i.fim):null}}return null}function No(e){return $o(e)?.tamanho??null}function zo(e){let o=$o(e);if(!o?.amostras||o.amostras.length===0)return null;let a=o.tamanho.width*o.tamanho.height;return a<=0?null:o.amostras.reduce((t,r)=>t+r,0)/o.amostras.length/a}function un(e,o,a){if(o+12>a||B(e,o+4)!==0)return null;let t=B(e,o+8);if(t===0)return null;let r=[],i=o+12;for(let s=0;s<t;s++){if(i+4>a)return null;r.push(B(e,i)),i+=4}return r}function mn(e,o){let n=(e[o]??0)===1?32:20,t=o+4+n+52;if(t+8>e.length)return null;let r=B(e,t)>>>16,i=B(e,t+4)>>>16;return r>0&&i>0?{width:r,height:i}:null}var N=te("premierepro"),U=te("uxp");async function S(e,o,a=15e3){let n;try{return await Promise.race([o,new Promise((t,r)=>{n=setTimeout(()=>r(new Error(`${e}: sem resposta em ${a/1e3}s`)),a)})])}finally{n!==void 0&&clearTimeout(n)}}async function F(){let e=await N.Project.getActiveProject();if(!e)throw new Error("Nenhum projeto aberto.");let o=await e.getActiveSequence();if(!o)throw new Error("Nenhuma sequencia ativa. Abra uma sequencia na timeline.");return{project:e,sequence:o,rootItem:await e.getRootItem()}}function qe(e,o,a){let n=null;if(e.lockedAccess(()=>{try{e.executeTransaction(t=>{a(r=>t.addAction(r))},o)}catch(t){let r=t;n=`${r?.name??"Erro"}: ${r?.message??String(t)}`}}),n!==null)throw new Error(n)}var ke=1;async function pn(e){for(let o of["getVideoFrameRate","getFrameRate"]){let a=e[o];if(typeof a=="function"){let n=await a.call(e);return typeof n=="number"?n:n?.value??0}}for(let o of["videoFrameRate","frameRate"]){let a=e[o];if(a!==void 0)return typeof a=="number"?a:a?.value??0}return console.log("[auto-broll] settings sem taxa de quadros conhecida; chaves:",Object.keys(e),Object.getOwnPropertyNames(Object.getPrototypeOf(e??{}))),0}async function Ce(){let{sequence:e}=await F(),o=e,a=await o.getSettings(),n=await a.getVideoFrameRect(),t=await pn(a);return{name:o.name,width:n?.width??0,height:n?.height??0,fps:t,videoTracks:await o.getVideoTrackCount(),audioTracks:await o.getAudioTrackCount(),durationSeconds:(await o.getEndTime())?.seconds??0}}async function Fo(){try{let{sequence:e}=await F(),o=e;if(typeof o.getInPoint!="function"||typeof o.getOutPoint!="function")return null;let a=(await o.getInPoint())?.seconds,n=(await o.getOutPoint())?.seconds;return typeof a!="number"||typeof n!="number"?null:{inicio:a,fim:n}}catch{return null}}async function jo(e){let o=await U.storage.localFileSystem.getEntryWithUrl(re(e));if(!o)throw new Error(`Pasta nao encontrada: ${e}`);if(o.isFolder===!1)throw new Error(`Isto e um arquivo, nao uma pasta: ${e}`);if(typeof o.getEntries!="function")throw new Error("Sem permissao para ler a pasta. Confira localFileSystem no manifest.");let a=[],n=new Set,t=async(r,i)=>{for(let s of await r.getEntries()){if(s.isFolder){i<1&&await t(s,i+1);continue}!Je(s.name)||n.has(s.name)||(n.add(s.name),a.push({name:s.name,nativePath:s.nativePath}))}};return await t(o,0),a.sort((r,i)=>r.name.localeCompare(i.name,"pt-BR")),a}async function Te(e=0){let{sequence:o}=await F(),n=await o.getVideoTrack(e),t=[];for(let r of await n.getTrackItems(ke,!1)){let i=await r.getProjectItem();if(!i?.name)continue;let s=await r.getSpeed();t.push({sourceName:i.name,startSeconds:(await r.getStartTime()).seconds,endSeconds:(await r.getEndTime()).seconds,inPointSeconds:(await r.getInPoint()).seconds,outPointSeconds:(await r.getOutPoint()).seconds,speed:s>0?s:1})}return t}async function Do(){let{sequence:e}=await F(),o=await e.getVideoTrackCount(),a=[];for(let n=1;n<o;n++)try{for(let t of await Te(n))a.push({sourceName:t.sourceName,startSeconds:t.startSeconds,endSeconds:t.endSeconds,videoTrackIndex:n})}catch{}return a}async function Lo(e){let o=await e.getItems(),a=[];for(let n of o){let t=N.FolderItem.cast(n);t?a.push(...await Lo(t)):a.push(n)}return a}async function Bo(e){let{rootItem:o}=await F(),n=await Lo(o),t=new Map,r=[];for(let i of new Set(e)){let s=n.find(c=>c.name===i);if(!s){r.push({nome:i,motivo:"nao encontrado no painel de Projeto (nome nao bate?)"});continue}try{let c=N.ClipProjectItem.cast(s);if(!c){r.push({nome:i,motivo:"nao e um ClipProjectItem (bin ou sequencia?)"});continue}let l=await N.Transcript.exportToJSON(c);l&&t.set(i,l)}catch(c){r.push({nome:i,motivo:c?.message??String(c)})}}return{transcricoes:t,falhas:r}}async function fn(e){try{let o=await U.storage.localFileSystem.getEntryWithUrl(re(e));if(!o)return null;let a=await o.read({format:U.storage.formats.binary});return No(new Uint8Array(a))}catch{return null}}async function Uo(e,o,a){let n=qo(o,e.map(s=>s.name));if(n.length===0)return o;let t=new Map(e.map(s=>[s.name,s.nativePath])),r=o,i=0;for(let s of n){let c=t.get(s),l=null;if(c!==void 0)try{let u=await U.storage.localFileSystem.getEntryWithUrl(re(c));if(u){let p=await u.read({format:U.storage.formats.binary});l=zo(new Uint8Array(p))}}catch{}r=ko(r,s,l),i++,(i%25===0||i===n.length)&&a(i,n.length)}return r}async function _o(e,o){let a=[],n=[];if(e.length===0)return{inseridos:0,passos:a,avisos:n};{let{project:t,rootItem:r}=await F(),i=r,s=new Set((await i.getItems()).map(l=>l.name)),c=e.filter(l=>!s.has(l.arquivo));if(c.length>0&&!await t.importFiles(c.map(p=>p.caminho),!0,r,!1))throw new Error("Premiere recusou importar os B-rolls.");a.push(`${c.length} importados, ${e.length-c.length} ja no projeto`)}{let{project:t,sequence:r,rootItem:i}=await F(),c=await i.getItems(),l=await N.SequenceEditor.getEditor(r),u=[];for(let p of e){let d=c.find(f=>f.name===p.arquivo);if(!d){n.push(`${p.arquivo} nao apareceu no projeto apos importar.`);continue}u.push({item:d,at:await N.TickTime.createWithSeconds(p.inicio)})}if(u.length===0)throw new Error("Nenhum B-roll pronto para inserir.");qe(t,`Auto B-roll: inserir ${u.length} B-rolls`,p=>{for(let d of u)p(l.createOverwriteItemAction(d.item,d.at,o.videoTrackIndex,o.audioTrackIndex))}),a.push(`${u.length} inseridos em ${Qe("V",o.videoTrackIndex)}`)}{let{project:t,sequence:r}=await F(),i=r,c=await(await i.getVideoTrack(o.videoTrackIndex)).getTrackItems(ke,!1),l=o.preencherTela?await(await i.getSettings()).getVideoFrameRect():null,u=[],p=0;for(let d of e){let f=await gn(c,d);if(!f)continue;p++;let h=await N.TickTime.createWithSeconds(d.inicio+d.duracao);if(u.push(()=>f.createSetEndAction(h)),l!==null){let m=await hn(f),v=m?await fn(d.caminho):null;if(m&&v){let y=Ge(v,l);u.push(()=>m.createSetValueAction(m.createKeyframe(y),!0))}else v||n.push(`${d.arquivo}: resolucao indisponivel, sem escala.`)}}u.length>0&&(qe(t,"Auto B-roll: ajustar duracao e escala",d=>{for(let f of u)d(f())}),a.push(`${p} ajustados (duracao${o.preencherTela?" e escala":""})`))}if(o.removerAudio){let{project:t,sequence:r}=await F(),s=await(await r.getAudioTrack(o.audioTrackIndex)).getTrackItems(ke,!1),c=new Set(e.map(u=>u.arquivo)),l=[];for(let u of s)c.has(await u.getName())&&l.push(u);if(l.length>0){let u=await N.SequenceEditor.getEditor(r);qe(t,"Auto B-roll: remover audio",p=>{let d=null;if(N.TrackItemSelection.createEmptySelection(h=>{d=h}),!d)throw new Error("createEmptySelection nao devolveu selecao");let f=d;for(let h of l)f.addItem(h,!1);p(u.createRemoveItemsAction(f,!1,N.Constants.MediaType.AUDIO,!1))}),a.push(`audio removido de ${l.length} B-rolls`)}}return{inseridos:e.length,passos:a,avisos:n}}async function gn(e,o){for(let a of e)if(await a.getName()===o.arquivo&&Math.abs((await a.getStartTime()).seconds-o.inicio)<.5)return a;return null}async function hn(e){let o=await e.getComponentChain();for(let a=0;a<o.getComponentCount();a++){let n=o.getComponentAtIndex(a);if(await n.getMatchName()==="AE.ADBE Motion")for(let t=0;t<n.getParamCount();t++){let r=n.getParam(t);if(r.displayName==="Scale")return r}}return null}async function j(e){try{let a=await(await U.storage.localFileSystem.getDataFolder()).getEntry(e);return JSON.parse(await a.read())}catch{return null}}async function z(e,o){await(await(await U.storage.localFileSystem.getDataFolder()).createFile(e,{overwrite:!0})).write(JSON.stringify(o,null,2))}var Jo="config.json",Go="aprendizado.json",Ee="pendentes.json",Ho="intensidade.json",Ie="ligacoes.json",Y="sinonimos.json",bn="ultimo-log.json",xn="ultimo-aprendizado.json";function w(e){let o=document.getElementById(e);if(!o)throw new Error(`elemento ausente no HTML: #${e}`);return o}var Q,Re=[];function x(e,o="passo"){Re.push(e);let a=document.createElement("div");a.className=`l-${o}`,a.textContent=e,Q.appendChild(a),Q.scrollTop=Q.scrollHeight}function Qo(){Re=[],Q.textContent=""}async function Wo(e){try{let o=await j(e),a=Array.isArray(o?.execucoes)?o.execucoes:[],n=[{quando:new Date().toISOString(),linhas:Re},...a].slice(0,10);await z(e,{execucoes:n})}catch{}}function k(e,o=""){let a=w("estado");a.textContent=e,a.setAttribute("data-tom",o)}var Vo="Analisar e inserir",vn="Aprender";function J(e,o,a){if(!a())return;let n=document.getElementById(e);n&&(n.textContent=o)}function D(e){return e?.message??String(e)}var _=class extends Error{};function I(e){if(!e())throw new _}function Ko(){return{schema:1,videoTrackIndex:$.videoTrackIndex,audioTrackIndex:$.audioTrackIndex,removeAudio:w("removeAudio").checked,fillScreen:w("fillScreen").checked,densidadeMaxima:w("densidadeMaxima").checked,libraryPath:w("libraryPath").value.trim()}}function Xo(e){w("removeAudio").checked=e.removeAudio,w("fillScreen").checked=e.fillScreen,w("densidadeMaxima").checked=e.densidadeMaxima,w("libraryPath").value=e.libraryPath}function Zo(e){let o=w("seqNome");o.textContent=e.name,o.setAttribute("data-vazio","nao"),w("seqDica").style.display="none",w("seqFormato").textContent=`${e.width}x${e.height}`,w("seqFps").textContent=e.fps.toFixed(3).replace(".",","),w("seqDuracao").textContent=Ve(e.durationSeconds,e.fps),w("seqFaixas").textContent=`${e.videoTracks}V \xB7 ${e.audioTracks}A`}async function yn(e){k("lendo","ativo");try{let o=await S("ler sequencia",Ce());if(!e())return;Zo(o),k("pronto","ok")}catch(o){if(!e())return;let a=w("seqNome");a.textContent="Nenhuma sequencia selecionada",a.setAttribute("data-vazio","sim"),w("seqDica").style.display="";for(let n of["seqFormato","seqFps","seqDuracao","seqFaixas"])w(n).textContent="\u2014";k("sem sequencia","aviso"),x(D(o),"erro")}}async function Yo(e,o,a){let n=yo(await S("ler aprendizado",j(Go),5e3)),t=wo(await S("ler pendentes",j(Ee),5e3)),r=t.porSequencia[e];try{let i=await S("ler B-rolls da timeline",Do(),3e4),s=[],c=new Set(i.map(h=>h.sourceName)),l=i.filter(h=>!vo({arquivo:h.sourceName,inicio:h.startSeconds},r)).map(h=>({arquivo:h.sourceName,inicio:h.startSeconds,fim:h.endSeconds})),u=(r?.itens??[]).some(h=>!c.has(h.arquivo)),p=r!==void 0&&!u&&l.length===0,d=n,f=t;if(p)s.push({texto:"Nada mudou na timeline desde a ultima analise: nao havia o que aprender.",tipo:"aviso"});else{if(r!==void 0&&r.itens.length>0)if(!xo(r.itens,i.map(m=>({arquivo:m.sourceName,inicio:m.startSeconds})),c))f=se(t,e,null),s.push({texto:`Os ${r.itens.length} B-rolls da rodada anterior sumiram todos de uma vez \u2014 parece Ctrl+Z desfazendo o lote, nao rejeicao. Nao contei como erro.`,tipo:"aviso"});else{let m=po(d,r,c);d=m.memoria,f=se(t,e,null),s.push({texto:`Aprendi da rodada anterior: voce manteve ${m.acertos} e apagou ${m.erros}.`,tipo:"ok"})}if(l.length>0){let h=Ae(await S("ler ligacoes",j(Ie),5e3)),m=go(d,e,l,o,a,h);if(d=m.memoria,m.associacoes!==h){await z(Ie,m.associacoes);let y=ce(m.associacoes);for(let[P,C]of y)ce(h).has(P)||s.push({texto:`Aprendi que "${C.join(", ")}" pede "${P}" \u2014 voce ligou os dois ${Pe} vezes.`,tipo:"ok"})}let v=[`${m.creditados} aprendidos`];m.jaContados>0&&v.push(`${m.jaContados} ja contados antes`),m.foraDaBiblioteca>0&&v.push(`${m.foraDaBiblioteca} fora da pasta de B-rolls`),m.semFala>0&&v.push(`${m.semFala} sobre silencio`),m.semLigacao.length>0&&v.push(`${m.semLigacao.length} sem ligacao no dicionario`),s.push({texto:`Voce colocou ${l.length} por conta propria: ${v.join(", ")}.`,tipo:m.creditados>0?"ok":"aviso"});for(let y of m.semLigacao)s.push({texto:y,tipo:"aviso"})}}return await z(Go,d),f!==t&&await z(Ee,f),s.length===0&&s.push({texto:"Nada novo para aprender: nenhum plano pendente e nenhum B-roll seu na timeline.",tipo:"aviso"}),{memoria:d,pendentes:f,resumo:s,ocupado:i.map(h=>({inicio:h.startSeconds,fim:h.endSeconds}))}}catch(i){throw new Error(`Nao consegui ler a timeline: ${D(i)}`)}}function wn(e,o=70){return e.length<=o?e:`${e.slice(0,o)}...`}async function ea(e){let o=w("libraryPath").value.trim();if(!o)throw new Error("Informe a pasta de B-rolls.");let a=await S("listar pasta de B-rolls",jo(o),3e4);if(I(e),a.length===0)throw new Error(`Nenhum video em ${o}.`);x(`${a.length} B-rolls na pasta`,"passo"),z(Jo,Ko()).catch(()=>{});let n=await S("ler clipes de V1",Te(0),3e4);if(I(e),n.length===0)throw new Error("V1 esta vazia. Nao ha o que analisar.");x(`${n.length} clipes em V1`,"passo");let t=[...new Set(n.map(p=>p.sourceName))],{transcricoes:r,falhas:i}=await S("ler transcricoes",Bo(t),6e4);I(e),x(`${r.size} de ${t.length} midias com transcricao`,"passo");for(let p of i)x(`"${p.nome}": ${p.motivo}`,"aviso");let s=await S("ler sequencia",Ce());I(e),Zo(s);let c=s.name,l=ce(Ae(await S("ler ligacoes",j(Ie),5e3)));I(e),l.size>0&&x(`${l.size} conceitos com ligacao que voce ensinou`,"passo");let u=io({clipes:n,transcricoesJson:r,biblioteca:a.map(p=>p.name),ligacoes:l});return x(`${u.palavras} palavras \xB7 ${u.frases.length} frases \xB7 ${u.conceitos.length} conceitos`,"passo"),{arquivos:a,resultado:u,nomeSequencia:c,duracaoDaSequencia:s.durationSeconds}}async function Pn(e){let o=w("aprender");o.disabled=!0,J("aprender","Aprendendo...",e),k("aprendendo","ativo"),Qo();let a=[];try{let{resultado:n,nomeSequencia:t}=await ea(e),{resumo:r}=await Yo(t,n.frases,n.conceitos);I(e),a=r,x("Aprendizado gravado. Nada foi inserido na timeline.","ok"),k("pronto","ok")}catch(n){n instanceof _||(x(D(n),"erro"),k("falhou","erro"))}finally{if(e())for(let n of a)x(n.texto,n.tipo);J("aprender",vn,e),o.disabled=!1,await Wo(xn)}}async function An(e){let o=w("analisar");o.disabled=!0,J("analisar","Analisando...",e),k("analisando","ativo"),Qo();let a=[],n=0;try{let t=Ko(),{arquivos:r,resultado:i,nomeSequencia:s,duracaoDaSequencia:c}=await ea(e);for(let g of i.avisos.slice(0,6))x(g,"aviso");let l=await S("ler in/out",Fo(),5e3);I(e);let u=l===null?null:He(l.inicio,l.fim,c);u!==null&&x(`In/out marcados: inserindo so de ${T(u.inicio)} a ${T(u.fim)}. Para a sequencia inteira, limpe o in/out.`,"passo");let{memoria:p,pendentes:d,resumo:f,ocupado:h}=await Yo(s,i.frases,i.conceitos);I(e),a=f;let m=u===null?i.oportunidades:i.oportunidades.filter(g=>g.frase.fim>u.inicio&&g.frase.inicio<u.fim);if(m.length===0){x(u===null?"Nenhuma oportunidade de B-roll encontrada.":"Nenhuma oportunidade de B-roll no trecho marcado.","vazio"),k("nada a inserir","ok");return}I(e);let v=Co(await S("ler intensidade",j(Ho),5e3));I(e);let y=v;try{y=await S("medir intensidade",Uo(r,v,(g,L)=>{e()&&x(`  medindo intensidade: ${g} de ${L}`,"passo")}),3e5),I(e),y!==v&&await z(Ho,y)}catch(g){if(g instanceof _)throw g;x(`Intensidade nao medida, seguindo sem ela. ${D(g)}`,"aviso"),y=le}let P=new Map;for(let[g,L]of Object.entries(y.arquivos))L!==null&&P.set(g,L);let C=Ro(m,{caminhos:new Map(r.map(g=>[g.name,g.nativePath]))},t.densidadeMaxima?Io:ue,p,{porArquivo:P,ritmoDasFrases:i.frases.map(g=>de(g.palavras,g.duracao))});z("frases.json",{quando:new Date().toISOString(),sequencia:s,frases:i.frases.map(g=>({inicio:Number(g.inicio.toFixed(2)),fim:Number(g.fim.toFixed(2)),texto:g.texto}))}).catch(()=>{});for(let g of C.descartes)x(`  ${g}`,"vazio");let q=C.colocacoes;if(u!==null){for(let g of q.filter(L=>L.inicio<u.inicio||L.inicio>=u.fim))x(`  ${T(g.inicio)} ${g.conceito}: fora do trecho marcado`,"vazio");q=q.filter(g=>g.inicio>=u.inicio&&g.inicio<u.fim)}let{entram:R,bloqueadas:E}=Mo(q,h);for(let g of E)x(`  ${g}`,"vazio");if(R.length===0&&E.length>0){x("Tudo o que eu sugeriria ja esta na timeline. Nada a fazer.","ok"),k("nada a inserir","ok");return}if(R.length===0){x("Nenhuma sugestao boa o bastante para entrar sozinha.","aviso"),k("nada a inserir","ok");return}x(`${R.length} B-rolls a inserir:`,"ok");for(let g of R)x(`${T(g.inicio)}  ${g.arquivo}  ${g.duracao.toFixed(1)}s \xB7 ${Math.round(g.score*100)}% \xB7 ${g.motivo}`,"passo"),x(`        "${wn(g.textoDaFrase)}"`,"vazio");k("inserindo","ativo");let W=await S("inserir plano",_o(R,{videoTrackIndex:t.videoTrackIndex,audioTrackIndex:t.audioTrackIndex,removerAudio:t.removeAudio,preencherTela:t.fillScreen}),12e4);I(e),n=R.length;for(let g of W.passos)x(`  ${g}`,"ok");for(let g of W.avisos)x(`  ${g}`,"aviso");x("Tres Ctrl+Z desfazem tudo.","vazio");try{await z(Ee,se(d,s,{quando:new Date().toISOString(),itens:R.map(g=>({arquivo:g.arquivo,conceito:g.conceito,termosCasados:g.termosCasados,inicio:g.inicio}))})),I(e),x("Apague os que nao serviram: a proxima analise aprende com isso.","vazio")}catch(g){if(g instanceof _)throw g;x(`Plano nao ficou guardado, esta rodada nao vai ensinar nada. ${D(g)}`,"aviso")}k("pronto","ok")}catch(t){t instanceof _||(x(D(t),"erro"),k("falhou","erro"))}finally{if(e())for(let t of a)x(t.texto,t.tipo);n>0?(J("analisar",`\u2713 ${n} B-rolls inseridos`,e),setTimeout(()=>J("analisar",Vo,e),2500)):J("analisar",Vo,e),o.disabled=!1,await Wo(bn)}}async function Sn(e){try{let o=await S("ler sinonimos",j(Y),5e3);if(!e())return;if(o===null){if(await z(Y,eo(ye)),!e())return;x(`Dicionario criado em ${Y}, na pasta de dados do plugin.`,"vazio");return}let a=Ye(o);if(a===null){x(`${Y} ilegivel: usando o dicionario padrao.`,"aviso");return}Ze(a),x(`Dicionario: ${a.size} entradas de ${Y}`,"vazio")}catch(o){if(!e())return;x(`Dicionario nao carregou, usando o padrao. ${D(o)}`,"aviso")}}function qn(e,o){e.addEventListener("click",o),e.addEventListener("keydown",a=>{let n=a.key;n!=="Enter"&&n!==" "||(a.preventDefault(),o())})}function kn(){let e=w("secaoLog"),o=w("logToggle"),a=e.getAttribute("data-aberto")!=="nao";e.setAttribute("data-aberto",a?"nao":"sim"),o.textContent=a?"Mostrar":"Recolher",o.setAttribute("aria-expanded",a?"false":"true"),o.setAttribute("aria-label",a?"Mostrar o registro":"Recolher o registro")}function oa(e){Q=w("log");let o=Q,a=()=>document.body.contains(o);k("ligando","ativo"),w("analisar").addEventListener("click",()=>{An(a)}),w("aprender").addEventListener("click",()=>{Pn(a)}),qn(w("logToggle"),kn),Xo($),k("pronto","ok"),x("Painel pronto.","vazio"),(async()=>{if(a()){try{let n=await S("ler configuracao",j(Jo),5e3);if(!a())return;n!==null&&Xo(Xe(n))}catch(n){if(!a())return;x(`Configuracao nao carregou, usando padrao. ${D(n)}`,"aviso")}a()&&(await Sn(a),a()&&await yn(a))}})()}var aa=`<!DOCTYPE html>
<html lang="pt-BR">
  <head>
    <meta charset="utf-8" />
    <title>Pro Captions</title>
    <!-- O build substitui esta marca pelo conteudo de styles.css.
         Folha de estilo externa nao carrega no UXP: o caminho relativo e
         resolvido a partir da raiz do plugin e falha em silencio. -->
    <!--ESTILOS-->
  </head>
  <body>
    <header class="topo">
      <div class="marca">
        <span class="marca-nome">Pro Captions</span>
        <span class="marca-fase">Fase 0</span>
      </div>
      <div id="estado" class="badge">carregando</div>
    </header>

    <main class="conteudo">
      <section class="secao">
        <div class="secao-cabeca">
          <span class="cod">SEQ</span>
          <span class="secao-rotulo">Sequencia ativa</span>
        </div>
        <div class="secao-corpo">
          <div id="seqNome" class="seq-nome" data-vazio="sim">Nenhuma sequencia selecionada</div>
          <div id="seqDica" class="dica">
            Abra a sequencia no Premiere e clique em Gerar legendas. O painel le a que estiver ativa na hora do clique.
          </div>
        </div>
      </section>

      <div class="acao">
        <sp-button id="gerar" variant="cta">Gerar legendas</sp-button>
        <sp-button id="restaurar" variant="secondary" quiet>Restaurar original</sp-button>
      </div>

      <section id="secaoLog" class="secao secao-log" data-aberto="sim">
        <div class="secao-cabeca">
          <span class="cod">LOG</span>
          <span class="secao-rotulo">Registro da execucao</span>
          <div
            id="logToggle"
            class="secao-acao"
            role="button"
            tabindex="0"
            aria-expanded="true"
            aria-controls="log"
            aria-label="Recolher o registro"
          >
            Recolher
          </div>
        </div>
        <div class="secao-corpo">
          <div id="log" class="log"></div>
        </div>
      </section>
    </main>

    <!-- O build substitui esta marca pelo bundle inteiro.
         Caminho relativo nao resolve no UXP. -->
    <!--SCRIPT-->
  </body>
</html>
`;var na=`/*
 * ============================================================================
 * FAMILIA PRO EDITION \u2014 folha de componentes do Pro Captions
 * ============================================================================
 *
 * Restricoes do UXP que ditam TODA a estrutura abaixo (a lista completa, com o
 * custo de cada descoberta, esta em auto-broll-premiere/docs/UXP_ARMADILHAS.md):
 *
 *  - \`<link rel="stylesheet">\` NAO carrega. Este arquivo e embutido como
 *    <style> por scripts/build.mjs.
 *  - \`display: grid\` e IGNORADO. Layout inteiro em flexbox.
 *  - \`gap\` e \`var()\` NAO sao confiaveis. Por isso os tokens abaixo sao um
 *    bloco documentado com valores literais, e nao \`:root { --token: ... }\`;
 *    espacamento sai de margin, nunca de gap.
 *  - Media query nao e confiavel, e este painel nunca roda em telefone. A
 *    responsividade real e a largura do painel acoplado no Premiere, e sai de
 *    \`flex-wrap\` com \`flex: 1 1 <base>\`.
 *  - Num flex column os filhos NAO esticam: encolhem ate o conteudo e ficam
 *    centralizados. \`align-items: stretch\` explicito e o que resolve.
 *  - \`<button>\` nativo e renderizado como controle do host: ignora o CSS do
 *    proprio elemento e achata os filhos numa linha so. Onde precisamos de um
 *    botao estilizado usamos \`div[role="button"][tabindex="0"]\`.
 *
 * ---------------------------------------------------------------- TOKENS ---
 * Mesma tabela nos tres plugins da familia. Repetida de proposito em cada
 * folha: sao repos independentes que precisam construir sozinhos, e var() nao
 * funciona aqui.
 *
 *   SUPERFICIE
 *     bg-0        #0d0f13   fundo do painel (quase preto)
 *     bg-1        #14171d   superficie: secoes e cards
 *     bg-2        #1a1e26   superficie elevada: topo, cabeca de secao, chips
 *     bg-3        #202631   hover de superficie clicavel
 *     line        #232830   borda sutil (padrao)
 *     line-2      #333b47   borda em hover
 *
 *   TEXTO
 *     txt         #eceef2   conteudo principal
 *     txt-2       #9098a6   secundario, rotulos
 *     txt-3       #5f6774   apagado: vazio, placeholder, dica
 *
 *   SEMANTICA
 *     azul        #3b82f6   acao primaria, foco
 *     verde       #4ecb8d   sucesso / pronto
 *     ambar       #eeab4c   atencao / processando / acento do Pro Captions
 *     vermelho    #ff7d71   erro
 *
 *   FORMA
 *     raio-lg     10px      secoes e cards
 *     raio-md     8px       campos e controles
 *     raio-full   999px     chips de status
 *     transicao   150ms     hover, focus, active
 *
 *   TIPOGRAFIA
 *     sans        Inter, adobe-clean, Segoe UI      (Inter se instalada)
 *     mono        Roboto Mono, Consolas             (dado tecnico e codigo)
 *     escala      15/13/12/11/9 px
 *
 * O acento deste plugin e o ambar: o domain aqui e o preco isolado na legenda,
 * e ambar e a cor que ja marca esse destaque no painel.
 * ============================================================================
 */

html,
body {
  height: 100%;
  margin: 0;
  padding: 0;
}

body {
  display: flex;
  flex-direction: column;
  background-color: #0d0f13;
  color: #eceef2;
  font-family: Inter, adobe-clean, "Source Sans 3", "Segoe UI", sans-serif;
  font-size: 13px;
  line-height: 1.45;
  overflow: hidden;
  text-align: left;
}

/* =============================================================== HEADER === */

.topo {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  flex: none;
  padding: 10px 12px;
  background-color: #1a1e26;
  border-bottom: 1px solid #232830;
}

.marca {
  display: flex;
  flex-direction: row;
  align-items: baseline;
  min-width: 0;
}

/* Tarja de 3px antes do nome: a mesma linguagem de cor das secoes, so que na
   marca. E o fio que costura os tres plugins da familia. */
.marca-nome::before {
  content: "";
  display: inline-block;
  width: 3px;
  height: 12px;
  margin-right: 8px;
  vertical-align: -1px;
  background-color: #eeab4c;
  border-radius: 2px;
}

.marca-nome {
  text-align: left;
  font-size: 15px;
  font-weight: 700;
  letter-spacing: -0.01em;
  color: #ffffff;
  white-space: nowrap;
}

.marca-fase {
  margin-left: 8px;
  font-family: "Roboto Mono", Consolas, monospace;
  font-size: 10px;
  letter-spacing: 0.08em;
  text-transform: uppercase;
  color: #5f6774;
  white-space: nowrap;
}

/* ========================================================= STATUS BADGE === */

/* Discreto por definicao: chip de contorno, nunca preenchido. O glifo antes do
   texto e o que faz o status nao depender so de cor. */
.badge {
  display: flex;
  flex-direction: row;
  align-items: center;
  flex: none;
  padding: 2px 9px;
  background-color: #14171d;
  border: 1px solid #232830;
  border-radius: 999px;
  font-family: "Roboto Mono", Consolas, monospace;
  font-size: 10px;
  letter-spacing: 0.02em;
  color: #9098a6;
  white-space: nowrap;
}

.badge::before {
  content: "\\2022";
  margin-right: 5px;
  font-size: 10px;
}

.badge[data-tom="ok"] {
  color: #4ecb8d;
  border-color: #26493a;
}

.badge[data-tom="ok"]::before {
  content: "\\2713";
}

.badge[data-tom="ativo"] {
  color: #eeab4c;
  border-color: #4a3a20;
}

.badge[data-tom="ativo"]::before {
  content: "\\25cc";
}

.badge[data-tom="aviso"] {
  color: #eeab4c;
  border-color: #4a3a20;
}

.badge[data-tom="aviso"]::before {
  content: "!";
}

.badge[data-tom="erro"] {
  color: #ff7d71;
  border-color: #542c29;
}

.badge[data-tom="erro"]::before {
  content: "\\00d7";
}

/* ================================================================ CORPO === */

.conteudo {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 12px;
}

/* ============================================================== SECTION === */

/*
 * A secao substituiu a canaleta vertical de 44px. O codigo da faixa (SEQ, LOG)
 * continua sendo a identidade do painel, mas agora mora numa cabeca
 * horizontal: devolve 44px de largura ao conteudo \u2014 o que importa muito num
 * painel acoplado estreito \u2014 e poe o rotulo acima do que ele rotula.
 */
/*
 * \`flex: none\` aqui e em \`.acao\`: sao filhos diretos de \`.conteudo\`, que e um
 * flex column de altura definida (o painel inteiro). Num flex column o filho
 * encolhe por padrao, e o conteudo que nao cabe espremeria a secao em vez de
 * rolar \u2014 medido no Chrome, cortava a ultima linha dentro do \`overflow:
 * hidden\`. Quem rola e \`.conteudo\`; as secoes nunca encolhem.
 */
.secao {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  flex: none;
  margin-bottom: 8px;
  background-color: #14171d;
  border: 1px solid #232830;
  border-radius: 10px;
  overflow: hidden;
}

.secao-cabeca {
  display: flex;
  flex-direction: row;
  align-items: center;
  flex: none;
  padding: 7px 12px;
  background-color: #1a1e26;
  border-bottom: 1px solid #232830;
}

.cod {
  flex: none;
  margin-right: 9px;
  font-family: "Roboto Mono", Consolas, monospace;
  font-size: 10px;
  font-weight: 700;
  letter-spacing: 0.08em;
  color: #6b7381;
  white-space: nowrap;
}

.secao-rotulo {
  flex: 1 1 auto;
  min-width: 0;
  text-align: left;
  font-size: 11px;
  font-weight: 500;
  color: #9098a6;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.secao-corpo {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  flex: 1 1 auto;
  min-width: 0;
  padding: 11px 12px;
}

/* ============================================================ SEQUENCIA === */

.seq-nome {
  text-align: left;
  font-size: 15px;
  font-weight: 600;
  letter-spacing: -0.01em;
  color: #ffffff;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

/*
 * EMPTY STATE
 *
 * "nenhuma sequencia ativa" dizia o que faltava e nao dizia o que fazer. O
 * estado vazio agora e um titulo mais uma instrucao: qual e o proximo passo, e
 * onde ele acontece (no Premiere, nao aqui \u2014 nao existe API para o plugin
 * escolher a sequencia; quem escolhe e voce, na timeline).
 *
 * Quem esconde a dica e o mount(), nao o CSS: seletor de irmao adjacente nao e
 * garantido no UXP, e uma instrucao presa na tela depois de cumprida mentiria
 * sobre o estado real.
 */
.seq-nome[data-vazio="sim"] {
  font-size: 13px;
  font-weight: 500;
  font-style: normal;
  color: #9098a6;
}

.dica {
  text-align: left;
  font-size: 12px;
  color: #5f6774;
  margin-top: 5px;
}

/* =============================================================== BUTTON === */

/*
 * Hierarquia de acao: "Gerar legendas" ganha o dobro de base flexivel de
 * "Restaurar original", entao e sempre visualmente maior quando as duas cabem
 * na mesma linha, e e a primeira a ocupar a linha inteira quando o painel
 * estreita. A secundaria e \`quiet\` (so texto) para nao disputar com ela \u2014
 * restaurar backup e acao rara e destrutiva, nao merece peso visual.
 */
.acao {
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  align-items: center;
  flex: none;
  margin-left: -4px;
  margin-right: -4px;
  margin-bottom: 8px;
}

.acao sp-button {
  margin-left: 4px;
  margin-right: 4px;
  margin-bottom: 4px;
}

.acao sp-button#gerar {
  flex: 2 1 180px;
}

.acao sp-button#restaurar {
  flex: 1 1 130px;
}

/* ============================================================== LOGPANEL === */

/*
 * O log rola por dentro, com altura propria e recolhivel.
 *
 * Sem altura propria ele cresce para baixo e as ultimas linhas \u2014 que sao as que
 * importam \u2014 nascem fora da area visivel do painel. Foi exatamente o que fez o
 * plugin parecer morto. Por isso nasce ABERTO: recolher e escolha do usuario,
 * nunca o padrao.
 */
.secao-log {
  margin-bottom: 0;
}

.secao-log .secao-corpo {
  padding: 0;
}

.secao[data-aberto="nao"] .secao-corpo {
  display: none;
}

/* Acao de cabeca de secao. \`div[role=button]\` e nao \`<button>\`: o botao nativo
   do UXP ignora o CSS do proprio elemento e vira pilula cinza. */
.secao-acao {
  flex: none;
  margin-left: 8px;
  padding: 2px 8px;
  background-color: #14171d;
  border: 1px solid #232830;
  border-radius: 8px;
  font-size: 11px;
  color: #9098a6;
  white-space: nowrap;
  cursor: pointer;
  transition: background-color 150ms, border-color 150ms, color 150ms;
}

.secao-acao:hover {
  background-color: #202631;
  border-color: #333b47;
  color: #eceef2;
}

.secao-acao:active {
  background-color: #1a1e26;
}

.secao-acao:focus {
  border-color: #3b82f6;
  color: #eceef2;
  outline: none;
}

.log {
  height: 160px;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 9px 12px;
  font-family: "Roboto Mono", Consolas, monospace;
  font-size: 11px;
  line-height: 1.6;
  color: #9098a6;
  white-space: pre-wrap;
  word-break: break-word;
}
`;function Me(e,o){return o<e.inPointSeconds||o>=e.outPointSeconds?null:e.startSeconds+(o-e.inPointSeconds)/e.speed}function Oe(e){let o=Math.max(0,Math.round(e)),a=n=>String(n).padStart(2,"0");return`${a(Math.floor(o/60))}:${a(o%60)}`}var ee={maxCaracteres:20,pausaQuebraSegundos:1.5,toleranciaCorteSegundos:.25,termosProtegidos:["Androclinic","Cristiano Estivalet"],trackDeCortes:0,maiusculas:!0};var ta=new Map([["zero",0],["um",1],["uma",1],["dois",2],["duas",2],["tres",3],["quatro",4],["cinco",5],["seis",6],["sete",7],["oito",8],["nove",9],["dez",10],["onze",11],["doze",12],["treze",13],["quatorze",14],["catorze",14],["quinze",15],["dezesseis",16],["dezessete",17],["dezoito",18],["dezenove",19],["vinte",20],["trinta",30],["quarenta",40],["cinquenta",50],["sessenta",60],["setenta",70],["oitenta",80],["noventa",90],["cem",100],["cento",100],["duzentos",200],["trezentos",300],["quatrocentos",400],["quinhentos",500],["seiscentos",600],["setecentos",700],["oitocentos",800],["novecentos",900]]),ra=new Map([["mil",1e3],["milhao",1e6],["milhoes",1e6]]);function pe(e){return e.normalize("NFD").replace(/\p{Diacritic}/gu,"").toLowerCase().replace(/r\$/g,"").replace(/[^a-z0-9]/g,"")}function $e(e){let o=pe(e);return/^\d+$/.test(o)||ta.has(o)||ra.has(o)}function En(e){let o=0,a=0,n=!1;for(let t of e){let r=pe(t);if(r===""||r==="e")continue;if(/^\d+$/.test(r)){a+=Number(r),n=!0;continue}let i=ra.get(r);if(i!==void 0){a=(a===0?1:a)*i,o+=a,a=0,n=!0;continue}let s=ta.get(r);if(s===void 0)return null;a+=s,n=!0}return n?o+a:null}function In(e){let o=String(Math.trunc(Math.abs(e))),a="";for(let n=0;n<o.length;n++)n>0&&(o.length-n)%3===0&&(a+="."),a+=o[n];return a}function Rn(e){let o=[],a=0;for(;a<e.length;){let n=e[a];if(n===void 0||!$e(n)){a++;continue}let t=a,r=a+1;for(;r<e.length;){let s=e[r];if(s!==void 0&&$e(s)){t=r,r++;continue}let c=e[r+1];if(s!==void 0&&pe(s)==="e"&&c!==void 0&&$e(c)){r+=2,t=r-1;continue}break}let i=En(e.slice(a,t+1));i!==null&&o.push({inicio:a,fim:t,valor:i}),a=t+1}return o}var Mn=new Set(["custa","custava","custam","custou","custar","valor","preco","investimento","pagar","paga","pagava","pagamento","apenas","sai","sair","fica","ficar"]),On=new Set(["ta","esta","e","era","eram","hoje","agora","so","somente","apenas","sai","fica"]),$n=new Set(["reais","real"]),Nn=new Set(["de","era","eram","custava","custavam","valia","valiam"]),zn=4;function ia(e){return`${In(e)} REAIS`}function sa(e){let o=Rn(e),a=r=>{let i=e[r];return i===void 0?"":pe(i)},n=[];for(let r=0;r<o.length;r++){let i=o[r];if(i===void 0)continue;let s=a(i.inicio-1),c=a(i.fim+1),l=a(i.fim+2),u=o[r+1];if(s==="de"&&c==="por"&&u!==void 0&&u.inicio===i.fim+2){n.push({...i,certeza:"alta"}),n.push({...u,certeza:"alta"}),r++;continue}if(c==="por"&&l==="cento"){u!==void 0&&u.inicio===i.fim+2&&r++;continue}if($n.has(c)){n.push({...i,fim:i.fim+1,certeza:"alta"});continue}if(e.slice(i.inicio,i.fim+1).some(f=>/r\$/i.test(f))){n.push({...i,certeza:"alta"});continue}let d=[];for(let f=Math.max(0,i.inicio-zn);f<i.inicio;f++)d.push(a(f));if(d.some(f=>Mn.has(f))){n.push({...i,certeza:"alta"});continue}if(s==="por"){let f=d.some(h=>On.has(h));n.push({...i,certeza:f?"alta":"media"})}}if(n.some(r=>r.certeza==="alta")){let r=new Set(n.map(i=>i.inicio));for(let i of o)r.has(i.inicio)||Nn.has(a(i.inicio-1))&&n.push({...i,certeza:"alta"});n.sort((i,s)=>i.inicio-s.inicio)}return n}function la(e){return e.map(o=>({text:o.text,inicio:o.inicio,fim:o.fim,confidence:o.confidence,eos:o.eos,sugestao:null,motivo:null}))}function A(e){let o=/^(.*?)([.,!?;:…]*)$/u.exec(e);return o?{corpo:o[1]??e,sufixo:o[2]??""}:{corpo:e,sufixo:""}}function fe(e,o){let a=e[0];return a===void 0||a!==a.toUpperCase()?o:o.charAt(0).toUpperCase()+o.slice(1)}var Fn=new Map([["para","pra"],["estava","tava"],["estavam","tavam"],["est\xE1","t\xE1"],["est\xE3o","t\xE3o"],["estou","t\xF4"]]),jn=new Map([["para o","pro"],["para os","pros"]]);function da(e){let o=[],a=0;for(;a<e.length;){let n=e[a];if(n===void 0){a++;continue}let t=A(n.text),r=e[a+1];if(r!==void 0){let s=A(r.text),c=jn.get(`${t.corpo.toLowerCase()} ${s.corpo.toLowerCase()}`);if(c!==void 0){o.push({...n,text:fe(t.corpo,c)+s.sufixo,fim:r.fim,confidence:Math.min(n.confidence,r.confidence),eos:r.eos}),a+=2;continue}}let i=Fn.get(t.corpo.toLowerCase());if(i!==void 0){o.push({...n,text:fe(t.corpo,i)+t.sufixo}),a++;continue}o.push(n),a++}return o}var Dn=new Set(["isso","isto","aquilo","ele","ela","eles","elas","nome","problema","questao","quest\xE3o","objetivo","resultado","segredo","verdade","diferenca","diferen\xE7a","motivo","causa","tudo","nada"]);function ua(e){return e.map((o,a)=>{let n=A(o.text);if(n.corpo.toLowerCase()!=="e")return o;let t=e[a-1],r=e[a+1],i=t===void 0?"":A(t.text).corpo.toLowerCase(),c=(r===void 0?"":A(r.text).corpo.toLowerCase())==="por"&&A(e[a+2]?.text??"").corpo.toLowerCase()==="isso";return Dn.has(i)||c?{...o,text:fe(n.corpo,"\xE9")+n.sufixo}:o})}var Ln=new Set(["sabe","sabia","sabem","entende","entendeu","imagina","adivinha","explica"]),Bn=new Set(["o","um","esse","este","aquele","meu","seu"]);function ma(e){let o=[];for(let r=0;r<e.length;r++){let i=e[r];if(i===void 0)continue;let s=A(i.text),c=s.corpo.toLowerCase();if(c==="porque"||c==="porqu\xEA"){o.push({i:r,consome:1,sufixo:s.sufixo,caixa:s.corpo});continue}if(c==="por"){let l=e[r+1];if(l===void 0)continue;let u=A(l.text),p=u.corpo.toLowerCase();(p==="que"||p==="qu\xEA")&&o.push({i:r,consome:2,sufixo:u.sufixo,caixa:s.corpo})}}if(o.length===0)return[...e];let a=[],n=0,t=0;for(;n<e.length;){let r=o[t],i=e[n];if(i===void 0){n++;continue}if(r===void 0||r.i!==n){a.push(i),n++;continue}t++;let s=e[n+r.consome-1]??i,c=e[n-1],l=c===void 0?"":A(c.text).corpo.toLowerCase(),u=n+r.consome;for(;u<e.length;){let m=e[u];if(u++,m===void 0||m.eos)break}let p=n+r.consome>=e.length,d=n;for(;d>0;){let m=e[d-1];if(m===void 0||m.eos)break;d--}let f=!1;for(let m=d;m<n;m++){let v=e[m];v!==void 0&&Ln.has(A(v.text).corpo.toLowerCase())&&(f=!0)}for(let m=n;m<u;m++)(e[m]?.text??"").includes("?")&&(f=!0);let h;Bn.has(l)?h="porqu\xEA":p?h="por qu\xEA":f?h="por que":h="porque",a.push({...i,text:fe(r.caixa,h)+r.sufixo,fim:s.fim,eos:s.eos,confidence:Math.min(i.confidence,s.confidence)}),n+=r.consome}return a}function ca(e,o){if(e===o)return 0;if(e.length===0)return o.length;if(o.length===0)return e.length;let a=Array.from({length:o.length+1},(t,r)=>r),n=new Array(o.length+1).fill(0);for(let t=1;t<=e.length;t++){n[0]=t;for(let i=1;i<=o.length;i++){let s=e[t-1]===o[i-1]?0:1;n[i]=Math.min((n[i-1]??0)+1,(a[i]??0)+1,(a[i-1]??0)+s)}let r=a;a=n,n=r}return a[o.length]??0}function oe(e){return e.normalize("NFD").replace(/\p{Diacritic}/gu,"").toLowerCase().replace(/[^a-z0-9]/g,"")}function pa(e,o){let a=o.termosProtegidos.map(r=>{let i=r.split(" ");return{canonico:r,partes:i,chaves:i.map(oe)}}),n=[],t=0;for(;t<e.length;){let r=e[t];if(r===void 0){t++;continue}let i=!1;for(let u of a){let p=u.partes.length+1;for(let d=1;d<=p&&t+d<=e.length;d++){let f=e.slice(t,t+d),h=oe(f.map(P=>A(P.text).corpo).join("")),m=u.chaves.join(""),v=Math.max(1,Math.floor(m.length/5));if(h.length===0||ca(h,m)>v||h[0]!==m[0])continue;let y=f[f.length-1]??r;n.push({...r,text:u.canonico+A(y.text).sufixo,fim:y.fim,eos:y.eos,confidence:Math.min(...f.map(P=>P.confidence)),sugestao:null,motivo:null}),t+=d,i=!0;break}if(i)break}if(i)continue;let s=e[t-1],c=null,l=null;if(s!==void 0){let u=oe(A(s.text).corpo);for(let p of a){if(p.partes.length<2||p.chaves[0]!==u)continue;let d=p.partes[1];if(d===void 0)continue;let f=oe(A(r.text).corpo),h=oe(d);if(f===h)break;ca(f,h)<=Math.ceil(h.length/2)?l=d:c=d;break}}if(l!==null){n.push({...r,text:l+A(r.text).sufixo,sugestao:null,motivo:null}),t++;continue}n.push(c===null?r:{...r,sugestao:c,motivo:`esperado depois de "${A(s?.text??"").corpo}"`}),t++}return n}var Un=.5;function _n(e,o){let a=[],n=[];for(let t of e){let r=n[n.length-1];r!==void 0&&t.inicio-r.fim>o.pausaQuebraSegundos&&(a.push(n),n=[]),n.push(t),t.eos&&(a.push(n),n=[])}return n.length>0&&a.push(n),a}var Ne=e=>e.reduce((o,a,n)=>o+a.text.length+(n>0?1:0),0);function Gn(e,o,a=[]){if(Ne(e)<=o.maxCaracteres)return[[...e]];let n=[],t=[...e];for(;t.length>0;){if(Ne(t)<=o.maxCaracteres){n.push(t);break}let r=1;for(let l=1;l<=t.length&&!(Ne(t.slice(0,l))>o.maxCaracteres);l++)r=l;let i=r,s=-1/0,c=Math.max(1,Math.ceil(r*.5));for(let l=c;l<=r;l++){let u=t[l-1];if(u===void 0)continue;let p=0;p+=l/r*2,/[.,;:!?]$/.test(u.text)&&(p+=3),Math.min(...a.map(f=>Math.abs(f-u.fim)),1/0)<=o.toleranciaCorteSegundos&&(p+=4),t.length-l===1&&(p-=2),p>s&&(s=p,i=l)}n.push(t.slice(0,i)),t=t.slice(i)}return n}function fa(e,o){let a=e[0],n=e[e.length-1];if(a===void 0||n===void 0)throw new RangeError("bloco sem palavras");let t=[],r=Math.min(...e.map(i=>i.confidence));r<Un&&t.push(`confianca ${r.toFixed(2)}`);for(let i of e)i.sugestao!==null&&t.push(`"${A(i.text).corpo}" pode ser "${i.sugestao}"`);return{texto:e.map(i=>i.text).join(" ").replace(/\s*\n\s*/g," ").replace(/[,;.]+$/,"").replace(/^[,;.]+\s*/,"").trim(),inicio:a.inicio,fim:n.fim,estilo:o,precisaRevisao:t.length>0,motivos:t}}function Hn(e,o){if(o.length===0)return[[...e]];let a=[],n=[];for(let t of e){let r=n[n.length-1];r!==void 0&&o.some(i=>i>=r.fim&&i<=t.inicio)&&(a.push(n),n=[]),n.push(t)}return n.length>0&&a.push(n),a}function Vn(e){let o=sa(e.map(t=>A(t.text).corpo));if(o.length===0)return[{palavras:e,estilo:"normal",preco:null}];let a=[],n=0;for(let t of o)t.inicio>n&&a.push({palavras:e.slice(n,t.inicio),estilo:"normal",preco:null}),a.push({palavras:e.slice(t.inicio,t.fim+1),estilo:"preco",preco:t}),n=t.fim+1;return n<e.length&&a.push({palavras:e.slice(n),estilo:"normal",preco:null}),a.filter(t=>t.palavras.length>0)}function ga(e,o,a=ee){let n=[];for(let t of _n(e,a))for(let r of Vn(t)){if(r.estilo==="preco"&&r.preco!==null){let i=fa(r.palavras,"preco");n.push({...i,texto:ia(r.preco.valor),precisaRevisao:i.precisaRevisao||r.preco.certeza==="media",motivos:r.preco.certeza==="media"?[...i.motivos,"contexto monetario incerto"]:i.motivos});continue}for(let i of Hn(r.palavras,o))for(let s of Gn(i,a,o))s.length>0&&n.push(fa(s,"normal"))}return n}function ha(e,o=ee){let a=[];return e.forEach((n,t)=>{let r=`bloco ${t+1} ("${n.texto}")`;n.texto.includes(`
`)&&a.push(`${r}: tem quebra de linha`),n.texto.trim().length===0&&a.push(`${r}: vazio`),n.texto.length>o.maxCaracteres&&a.push(`${r}: ${n.texto.length} caracteres, orcamento e ${o.maxCaracteres}`),n.texto.endsWith(",")&&a.push(`${r}: termina em virgula`),n.texto.endsWith(".")&&a.push(`${r}: termina em ponto (D-15)`),n.estilo==="normal"&&/\bREAIS\b/.test(n.texto)&&a.push(`${r}: preco misturado com texto normal`),n.fim<n.inicio&&a.push(`${r}: termina antes de comecar`)}),a}function xa(e,o,a=ee){let n=la(e);return n=pa(n,a),n=da(n),n=ua(n),n=ma(n),ga(n,o,a)}function ba(e){let o=Math.max(0,Math.round(e*1e3)),a=Math.floor(o/36e5),n=Math.floor(o%36e5/6e4),t=Math.floor(o%6e4/1e3),r=o%1e3,i=(s,c)=>String(s).padStart(c,"0");return`${i(a,2)}:${i(n,2)}:${i(t,2)},${i(r,3)}`}function ze(e){return e.map((o,a)=>`${a+1}
${ba(o.inicio)} --> ${ba(o.fim)}
${o.texto}
`).join(`
`)}var G=te("premierepro"),Fe=te("uxp");async function M(e,o,a=15e3){let n;try{return await Promise.race([o,new Promise((t,r)=>{n=setTimeout(()=>r(new Error(`${e}: sem resposta em ${a/1e3}s`)),a)})])}finally{n!==void 0&&clearTimeout(n)}}async function ae(){let e=await G.Project.getActiveProject();if(!e)throw new Error("Nenhum projeto aberto.");let o=await e.getActiveSequence();if(!o)throw new Error("Nenhuma sequencia ativa. Abra uma sequencia na timeline.");return{project:e,sequence:o,rootItem:await e.getRootItem()}}var Xn=1;async function Jn(e){for(let o of["getVideoFrameRate","getFrameRate"]){let a=e[o];if(typeof a=="function"){let n=await a.call(e);return typeof n=="number"?n:n?.value??0}}for(let o of["videoFrameRate","frameRate"]){let a=e[o];if(a!==void 0)return typeof a=="number"?a:a?.value??0}return console.log("[pro-captions] settings sem taxa de quadros conhecida; chaves:",Object.keys(e),Object.getOwnPropertyNames(Object.getPrototypeOf(e??{}))),0}async function va(){let{sequence:e}=await ae(),o=e,a=await Jn(await o.getSettings());return{name:o.name,fps:a,videoTracks:await o.getVideoTrackCount(),captionTracks:await o.getCaptionTrackCount()}}async function ge(e=0){let{sequence:o}=await ae(),n=await o.getVideoTrack(e),t=[];for(let r of await n.getTrackItems(Xn,!1)){let i=await r.getProjectItem();if(!i?.name)continue;let s=await r.getSpeed();t.push({sourceName:i.name,startSeconds:(await r.getStartTime()).seconds,endSeconds:(await r.getEndTime()).seconds,inPointSeconds:(await r.getInPoint()).seconds,outPointSeconds:(await r.getOutPoint()).seconds,speed:s>0?s:1})}return t}async function ya(e=0){return(await ge(e)).slice(1).map(a=>a.startSeconds)}async function wa(e){let o=await e.getItems(),a=[];for(let n of o){let t=G.FolderItem.cast(n);t?a.push(...await wa(t)):a.push(n)}return a}async function Pa(e){let{rootItem:o}=await ae(),n=await wa(o),t=new Map,r=[];for(let i of new Set(e)){let s=n.find(c=>c.name===i);if(!s){r.push({nome:i,motivo:"nao encontrado no painel de Projeto (nome nao bate?)"});continue}try{let c=G.ClipProjectItem.cast(s);if(!c){r.push({nome:i,motivo:"nao e um ClipProjectItem (bin ou sequencia?)"});continue}let l=await G.Transcript.exportToJSON(c);l&&t.set(i,l)}catch(c){r.push({nome:i,motivo:c?.message??String(c)})}}return{transcricoes:t,falhas:r}}function Qn(e,o,a){let n=null;if(e.lockedAccess(()=>{try{e.executeTransaction(t=>{a(r=>t.addAction(r))},o)}catch(t){let r=t;n=`${r?.name??"Erro"}: ${r?.message??String(t)}`}}),n!==null)throw new Error(n)}var Wn=e=>e.replace(/[^a-zA-Z0-9._-]/g,"_");async function Aa(e){let o=await Fe.storage.localFileSystem.getDataFolder();try{return await(await o.getEntry(`original-${Wn(e)}.json`)).read()}catch{return null}}async function Sa(e){let o=await Fe.storage.localFileSystem.getDataFolder(),a=[];try{let r=await o.getEntry("ultimo-log-captions.json"),s=JSON.parse(await r.read())?.execucoes;Array.isArray(s)&&(a=s)}catch{}let n=[{quando:new Date().toISOString(),linhas:[...e]},...a].slice(0,10),t=await o.createFile("ultimo-log-captions.json",{overwrite:!0});return await t.write(JSON.stringify({execucoes:n},null,2)),t.nativePath}async function je(e,o){let n=await(await Fe.storage.localFileSystem.getDataFolder()).createFile(e,{overwrite:!0});return await n.write(o),n.nativePath}async function qa(e){let{project:o}=await ae();return o.importFiles([...e],!0)}async function ka(e,o){let{project:a,rootItem:n}=await ae(),r=(await n.getItems()).find(s=>s.name===e);if(!r)throw new Error(`midia nao encontrada no projeto: ${e}`);let i=G.ClipProjectItem.cast(r)??r;Qn(a,"Pro Captions: escrever transcricao",s=>{let c=G.Transcript.importFromJSON(o);s(G.Transcript.createImportTextSegmentsAction(c,i))})}function Ca(e){let o;try{o=JSON.parse(e)}catch{return null}if(typeof o!="object"||o===null)return null;let a=o;if(!Array.isArray(a.segments))return null;let n=[];for(let t of a.segments){if(typeof t!="object"||t===null)continue;let r=t;if(!Array.isArray(r.words))continue;let i=[];for(let s of r.words){if(typeof s!="object"||s===null)continue;let c=s;typeof c.text!="string"||typeof c.start!="number"||i.push({text:c.text,start:c.start,duration:typeof c.duration=="number"?c.duration:0,confidence:typeof c.confidence=="number"?c.confidence:1,eos:c.eos===!0,type:typeof c.type=="string"?c.type:"word"})}n.push({start:typeof r.start=="number"?r.start:0,duration:typeof r.duration=="number"?r.duration:0,speaker:typeof r.speaker=="string"?r.speaker:"",words:i})}return{language:typeof a.language=="string"?a.language:"",segments:n}}function Ta(e,o){let a=[];for(let n of e){let t=o.get(n.sourceName);if(t)for(let r of t.segments)for(let i of r.words){if(i.type!=="word")continue;let s=Me(n,i.start);if(s===null)continue;let c=i.start+i.duration,l=Me(n,c)??n.endSeconds;a.push({text:i.text,inicio:s,fim:Math.max(s,l),confidence:i.confidence,eos:i.eos,sourceName:n.sourceName})}}return a.sort((n,t)=>n.inicio-t.inicio),a}var O=e=>{let o=document.getElementById(e);if(!o)throw new Error(`elemento ausente no HTML: ${e}`);return o},ne=[];function b(e){ne.push(e);let o=O("log");o.textContent=ne.join(`
`),o.scrollTop=o.scrollHeight}function H(e,o=""){let a=O("estado");a.textContent=e,a.setAttribute("data-tom",o)}function Ea(e){for(let o of["gerar","restaurar"]){let a=O(o);a.disabled=e}}var Kn={gerar:"Gerar legendas",restaurar:"Restaurar original"};async function Ia(e,o,a){ne=[],Ea(!0),a&&(O(a.id).textContent=a.enquanto),b(`== ${e} ==`);try{await o()}catch(n){b(`ERRO: ${n?.message??String(n)}`),H("erro","erro")}finally{Ea(!1),a&&(O(a.id).textContent=Kn[a.id]??a.enquanto);try{let n=await M("log",Sa(ne));b(""),b(`log salvo em ${n}`)}catch{}}}async function Zn(){let e=await M("sequencia",va()),o=O("seqNome");o.textContent=e.name,o.setAttribute("data-vazio","nao"),O("seqDica").style.display="none",b(`${e.fps.toFixed(2)} fps \xB7 ${e.videoTracks} video \xB7 ${e.captionTracks} caption`);let a=await M("clipes",ge(0)),n=await M("cortes",ya(0));b(`V1: ${a.length} clipes \xB7 ${n.length} cortes`);let{transcricoes:t,falhas:r}=await M("transcricoes",Pa(a.map(c=>c.sourceName)),6e4);b(`${t.size} midias com transcricao`);for(let c of r)b(`"${c.nome}": ${c.motivo}`);let i=new Map;for(let[c,l]of t){let u=Ca(l);u?i.set(c,u):b(`transcricao ilegivel: ${c}`)}let s=Ta(a,i);return b(`${s.length} palavras no corte final`),{clipes:a,cortes:n,palavras:s}}async function Yn(){H("lendo sequencia","ativo");let{clipes:e,cortes:o,palavras:a}=await Zn();if(a.length===0)throw new Error("Nenhuma palavra encontrada. A camera principal da V1 tem transcricao?");H("montando legendas","ativo");let n=xa(a,o),t=ha(n),r=n.filter(l=>l.estilo==="preco"),i=n.filter(l=>l.precisaRevisao);if(t.length>0){b(""),b(`${t.length} bloco(s) reprovado(s) na validacao, nada foi escrito:`);for(let l of t.slice(0,10))b(`  ${l}`);H("reprovado","aviso");return}b(""),b(`${n.length} blocos \xB7 ${r.length} preco(s) \xB7 ${i.length} para revisar`),b("");for(let l of n.slice(0,12)){let u=l.estilo==="preco"?"R$":"  ";b(`${u} ${Oe(l.inicio)} ${l.texto}`)}if(n.length>12&&b(`   ... mais ${n.length-12}`),i.length>0){b(""),b("precisam de revisao:");for(let l of i.slice(0,8))b(`  ${Oe(l.inicio)} ${l.motivos.join("; ")}`)}let s=n.filter(l=>l.estilo==="normal"),c=[await M("srt",je("legendas.srt",ze(s)))];r.length>0&&c.push(await M("srt precos",je("precos.srt",ze(r)))),b("");for(let l of c)b(`gerado: ${l}`);try{await M("importar",qa(c)),b(""),b("importados no painel Projeto")}catch(l){let u=l instanceof Error?l.message:String(l);b(`importacao automatica falhou (${u})`),b("Importar na mao: Arquivo > Importar, escolher os arquivos acima")}b(""),b("AGORA, NO PREMIERE (2 arrastos + 2 estilos, e o minimo que a API permite):"),b("  1. Arrastar legendas.srt do painel Projeto para a timeline"),b("  2. Arrastar precos.srt na area vazia ACIMA da faixa criada"),b("  3. Estilo Pro-Captions (96) na faixa de texto"),b("  4. Estilo Pro-Captions Preco (150) na faixa de preco"),H(i.length>0?`${i.length} para revisar`:"legendas geradas",i.length>0?"aviso":"ok")}async function et(){let e=await M("clipes",ge(0)),o=[...new Set(e.map(n=>n.sourceName))],a=0;for(let n of o){let t=await M("backup",Aa(n));if(t===null){b(`${n}: sem backup guardado`);continue}await M("escrita",ka(n,t)),b(`${n}: transcricao original restaurada`),a++}b(""),b(`${a} de ${o.length} midia(s) restaurada(s)`),H(a>0?"restaurado":"nada a restaurar",a>0?"ok":"aviso")}function ot(e,o){e.addEventListener("click",o),e.addEventListener("keydown",a=>{let n=a.key;n!=="Enter"&&n!==" "||(a.preventDefault(),o())})}function at(){let e=O("secaoLog"),o=O("logToggle"),a=e.getAttribute("data-aberto")!=="nao";e.setAttribute("data-aberto",a?"nao":"sim"),o.textContent=a?"Mostrar":"Recolher",o.setAttribute("aria-expanded",a?"false":"true"),o.setAttribute("aria-label",a?"Mostrar o registro":"Recolher o registro")}function Ra(e){ne=[],H("pronto","ok"),b("painel carregado"),O("gerar").addEventListener("click",()=>{Ia("gerar legendas",Yn,{id:"gerar",enquanto:"Gerando..."})}),O("restaurar").addEventListener("click",()=>{Ia("restaurar original",et,{id:"restaurar",enquanto:"Restaurando..."})}),ot(O("logToggle"),at)}var Ma=`<header class="topo">
  <div class="marca">
    <span class="marca-nome">Pro Edition</span>
  </div>
  <div class="badge">2 ferramentas</div>
</header>

<main class="conteudo">
  <p class="hall-intro">Escolha uma ferramenta. Ela abre neste mesmo painel.</p>

  <div class="cards">
    <div
      id="cardBroll"
      class="card card-broll"
      role="button"
      tabindex="0"
      aria-label="Abrir Auto B-roll"
    >
      <span class="card-topo">
        <span class="card-nome">Auto B-roll</span>
        <span class="card-seta">&rarr;</span>
      </span>
      <span class="card-desc">
        Insere B-rolls na V2 a partir da transcricao da sequencia, e aprende com o que voce mantem na timeline.
      </span>
      <span class="card-rodape">
        <span class="card-meta">Video \xB7 V2 e A3</span>
      </span>
    </div>

    <div
      id="cardCaptions"
      class="card card-captions"
      role="button"
      tabindex="0"
      aria-label="Abrir Pro Captions"
    >
      <span class="card-topo">
        <span class="card-nome">Pro Captions</span>
        <span class="card-seta">&rarr;</span>
      </span>
      <span class="card-desc">
        Gera legendas em .srt a partir da transcricao, com o preco isolado no proprio arquivo.
      </span>
      <span class="card-rodape">
        <span class="card-meta">Legendas \xB7 .srt</span>
      </span>
    </div>
  </div>

  <p class="hall-nota">
    As duas trabalham na sequencia que estiver ativa no Premiere. Depois de atualizar qualquer uma delas, reinicie o Premiere.
  </p>
</main>
`;var Oa=`/*
 * ============================================================================
 * FAMILIA PRO EDITION \u2014 folha de componentes da tela de selecao (o hall)
 * ============================================================================
 *
 * Restricoes do UXP que ditam TODA a estrutura abaixo (lista completa em
 * auto-broll-premiere/docs/UXP_ARMADILHAS.md):
 *
 *  - \`display: grid\` e IGNORADO. Layout inteiro em flexbox.
 *  - \`gap\` e \`var()\` NAO sao confiaveis. Tokens sao um bloco documentado com
 *    valores literais; espacamento sai de margin, nunca de gap.
 *  - Media query nao e confiavel, e este painel nunca roda em telefone. A
 *    responsividade real e a largura do painel acoplado no Premiere: os cards
 *    ficam lado a lado com \`flex-wrap\` + \`flex: 1 1 250px\` e empilham sozinhos
 *    quando o painel estreita.
 *  - Num flex column os filhos NAO esticam. \`align-items: stretch\` explicito.
 *
 *  - **\`<button>\` nativo e renderizado como controle do host.** Ele ignora o
 *    CSS do proprio elemento e achata os filhos numa linha so \u2014 foi
 *    exatamente por isso que estes cards apareciam como pilulas cinzas de
 *    texto centralizado, apesar do CSS correto no disco. Card e alternador
 *    agora sao \`div[role="button"][tabindex="0"]\`, com Enter/Espaco ligados na
 *    mao em main.ts.
 *
 * ---------------------------------------------------------------- TOKENS ---
 * Mesma tabela nos tres plugins da familia. Repetida de proposito em cada
 * folha: sao repos independentes que precisam construir sozinhos, e var() nao
 * funciona aqui.
 *
 *   SUPERFICIE
 *     bg-0        #0d0f13   fundo do painel (quase preto)
 *     bg-1        #14171d   superficie: secoes e cards
 *     bg-2        #1a1e26   superficie elevada: topo, chips
 *     bg-3        #202631   hover de superficie clicavel
 *     line        #232830   borda sutil (padrao)
 *     line-2      #333b47   borda em hover
 *
 *   TEXTO
 *     txt         #eceef2   conteudo principal
 *     txt-2       #9098a6   secundario, rotulos
 *     txt-3       #5f6774   apagado: dica, nota de rodape
 *
 *   SEMANTICA
 *     azul        #3b82f6   foco
 *     verde       #4ecb8d   sucesso
 *     ambar       #eeab4c   acento do Pro Captions
 *     vermelho    #ff7d71   erro
 *     violeta     #8d82f5   acento do Auto B-roll
 *
 *   FORMA
 *     raio-lg     10px \xB7 raio-md 8px \xB7 raio-full 999px \xB7 transicao 150ms
 *
 * O hall e neutro de proposito: nao tem acento de cor proprio. A cor de cada
 * ferramenta aparece so na tarja do card dela \u2014 previa do que tem la dentro \u2014
 * e depois de fato dentro da ferramenta escolhida.
 * ============================================================================
 */

html,
body {
  height: 100%;
}

body {
  display: flex;
  flex-direction: column;
  margin: 0;
  padding: 0;
  background-color: #0d0f13;
  color: #eceef2;
  font-family: Inter, adobe-clean, "Source Sans 3", "Segoe UI", sans-serif;
  font-size: 13px;
  line-height: 1.45;
  overflow: hidden;
  text-align: left;
}

/* =============================================================== HEADER === */

.topo {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  flex: none;
  padding: 10px 12px;
  background-color: #1a1e26;
  border-bottom: 1px solid #232830;
}

.marca {
  display: flex;
  flex-direction: row;
  align-items: baseline;
  min-width: 0;
}

.marca-nome {
  text-align: left;
  font-size: 15px;
  font-weight: 700;
  letter-spacing: -0.01em;
  color: #ffffff;
  white-space: nowrap;
}

/* ========================================================= STATUS BADGE === */

.badge {
  display: flex;
  flex-direction: row;
  align-items: center;
  flex: none;
  padding: 2px 9px;
  background-color: #14171d;
  border: 1px solid #232830;
  border-radius: 999px;
  font-family: "Roboto Mono", Consolas, monospace;
  font-size: 10px;
  letter-spacing: 0.02em;
  color: #9098a6;
  white-space: nowrap;
}

.badge::before {
  content: "\\2022";
  margin-right: 5px;
  font-size: 10px;
}

.badge[data-tom="ok"] {
  color: #4ecb8d;
  border-color: #26493a;
}

.badge[data-tom="ok"]::before {
  content: "\\2713";
}

/* ================================================================ CORPO === */

.conteudo {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  flex: 1 1 auto;
  min-height: 0;
  overflow-y: auto;
  overflow-x: hidden;
  padding: 14px 12px;
}

/* \`flex: none\` aqui, em \`.cards\` e em \`.hall-nota\`: sao filhos diretos de
   \`.conteudo\`, que e um flex column de altura definida. Sem isto o filho
   encolhe em vez de deixar \`.conteudo\` rolar, e o texto e cortado. */
.hall-intro {
  flex: none;
  margin: 0 0 12px 0;
  text-align: left;
  font-size: 12px;
  color: #9098a6;
}

/* A nota de rodape ocupa o vazio que sobra num painel alto sem inventar
   funcionalidade: e a unica instrucao que as duas ferramentas compartilham. */
.hall-nota {
  flex: none;
  margin: 14px 0 0 0;
  padding-top: 12px;
  border-top: 1px solid #232830;
  text-align: left;
  font-size: 11px;
  line-height: 1.55;
  color: #5f6774;
}

/* ================================================================= CARD === */

/* Lado a lado quando ha largura, empilhados quando nao ha. Sem media query. */
.cards {
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  align-items: stretch;
  flex: none;
  margin-left: -4px;
  margin-right: -4px;
}

.card {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  flex: 1 1 250px;
  min-width: 0;
  margin: 0 4px 8px 4px;
  padding: 13px 14px;
  background-color: #14171d;
  border: 1px solid #232830;
  border-radius: 10px;
  text-align: left;
  color: inherit;
  cursor: pointer;
  transition: background-color 150ms, border-color 150ms;
}

.card:hover {
  background-color: #1a1e26;
  border-color: #333b47;
}

.card:active {
  background-color: #14171d;
}

.card:focus {
  border-color: #3b82f6;
  outline: none;
}

.card-topo {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: space-between;
  margin-bottom: 6px;
}

/* Tarja de 3px antes do nome: mesma linguagem das marcas dos dois plugins.
   E aqui que a cor de cada ferramenta aparece \u2014 previa do que tem la dentro. */
.card-nome::before {
  content: "";
  display: inline-block;
  width: 3px;
  height: 12px;
  margin-right: 8px;
  vertical-align: -1px;
  background-color: #333b47;
  border-radius: 2px;
}

.card-broll .card-nome::before {
  background-color: #8d82f5;
}

.card-captions .card-nome::before {
  background-color: #eeab4c;
}

.card-nome {
  flex: 1 1 auto;
  min-width: 0;
  text-align: left;
  font-size: 14px;
  font-weight: 600;
  letter-spacing: -0.01em;
  color: #ffffff;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.card-seta {
  flex: none;
  margin-left: 10px;
  font-size: 14px;
  color: #5f6774;
  transition: color 150ms;
}

.card:hover .card-seta {
  color: #eceef2;
}

.card-desc {
  display: block;
  text-align: left;
  font-size: 12px;
  line-height: 1.5;
  color: #9098a6;
  margin-bottom: 10px;
}

.card-rodape {
  display: flex;
  flex-direction: row;
  align-items: center;
  padding-top: 9px;
  border-top: 1px solid #1e232b;
}

.card-meta {
  flex: 1 1 auto;
  min-width: 0;
  text-align: left;
  font-family: "Roboto Mono", Consolas, monospace;
  font-size: 10px;
  letter-spacing: 0.04em;
  color: #5f6774;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
`;var De={seletor:"Pro Edition",broll:"Auto B-roll",captions:"Pro Captions"},rt=`
.pe-nav {
  display: flex;
  flex-direction: row;
  align-items: center;
  flex: none;
  /* align-self:stretch e nao width:100%: com width, os 24px de padding
     somam POR FORA da largura do painel (sem box-sizing garantido no UXP) e
     abrem uma barra de rolagem horizontal. Esticar resolve sem depender de
     box-sizing, e e o mesmo remedio que o resto da familia usa para os filhos
     de flex column no UXP. */
  align-self: stretch;
  margin: 0;
  padding: 7px 12px;
  background-color: #14171d;
  border: none;
  border-bottom: 1px solid #232830;
  font-family: Inter, adobe-clean, "Source Sans 3", "Segoe UI", sans-serif;
  font-size: 11px;
  text-align: left;
  cursor: pointer;
  transition: background-color 150ms;
}

.pe-nav:hover {
  background-color: #1a1e26;
}

.pe-nav:focus {
  background-color: #1a1e26;
  outline: none;
}

.pe-nav-seta {
  flex: none;
  margin-right: 8px;
  font-size: 12px;
  color: #5f6774;
  transition: color 150ms;
}

.pe-nav:hover .pe-nav-seta {
  color: #eceef2;
}

.pe-nav-raiz {
  flex: none;
  color: #9098a6;
  white-space: nowrap;
  transition: color 150ms;
}

.pe-nav:hover .pe-nav-raiz {
  color: #eceef2;
}

.pe-nav-sep {
  flex: none;
  margin-left: 6px;
  margin-right: 6px;
  color: #333b47;
}

.pe-nav-atual {
  flex: 1 1 auto;
  min-width: 0;
  color: #5f6774;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}
`;function Le(e,o){e.addEventListener("click",o),e.addEventListener("keydown",a=>{let n=a.key;n!=="Enter"&&n!==" "||(a.preventDefault(),o())})}function it(e){Le(e.querySelector("#cardBroll"),()=>he("broll")),Le(e.querySelector("#cardCaptions"),()=>he("captions"))}var st={seletor:{html:Ma,css:Oa,montar:it},broll:{html:be(Ue),css:_e,montar:oa},captions:{html:be(aa),css:na,montar:Ra}};function he(e){let o=Be(st,e),a=e==="seletor"?"":`<div id="peVoltar" class="pe-nav" role="button" tabindex="0" aria-label="Voltar para o ${De.seletor}"><span class="pe-nav-seta">&larr;</span><span class="pe-nav-raiz">${De.seletor}</span><span class="pe-nav-sep">/</span><span class="pe-nav-atual">${De[e]}</span></div>`;document.body.innerHTML=`${a}<style>
${rt}
${o.css}
</style>
${o.html}`,e!=="seletor"&&Le(document.getElementById("peVoltar"),()=>he("seletor")),o.montar(document.body)}he("seletor");})();
