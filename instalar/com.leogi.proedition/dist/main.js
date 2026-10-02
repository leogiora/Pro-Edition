"use strict";(()=>{var ro=(o=>typeof require<"u"?require:typeof Proxy<"u"?new Proxy(o,{get:(e,a)=>(typeof require<"u"?require:e)[a]}):o)(function(o){if(typeof require<"u")return require.apply(this,arguments);throw Error('Dynamic require of "'+o+'" is not supported')});var ac={"#":"novo","=":"base","-":"vazio"};function xt(o){let e=o.split("|").map(a=>a.trim().split(/\s+/));if(new Set(e.map(([,a=""])=>a.length)).size>1)throw new Error(`Trilhas "${o}" com tamanhos diferentes`);return e.map(([a,n=""])=>{let t=(n.match(/(.)\1*/g)??[]).map(r=>{let i=ac[r[0]];if(!i)throw new Error(`Trilha "${a}": caractere "${r[0]}" nao existe na notacao`);return`<span class="seg seg-${i}" style="flex-grow: ${r.length}"></span>`});return`<span class="trilha" data-faixa="${a}"><span class="trilha-rotulo">${a}</span><span class="trilha-faixa">${t.join("")}</span></span>`}).join("")}function lo(o,e){let a=s=>`<span style="display: flex; flex: none; ${s}"></span>`,n=(s,c="center")=>`<span style="display: flex; flex-direction: row; align-items: ${c}; justify-content: center; width: 14px; height: 14px">${s}</span>`,t=s=>`<span style="display: flex; flex-direction: column; align-items: center; justify-content: center; width: 14px; height: 14px">${s}</span>`,r=(s,c,l="0 1px")=>a(`width: ${s}px; height: ${c}px; margin: ${l}; background-color: ${e}; border-radius: 1px`),i=(s,c,l="0")=>a(`width: ${s}px; height: ${c}px; margin: ${l}; border: 2px solid ${e}; border-radius: 2px`);switch(o){case"pausas":return n(r(3,11,"0 1.5px")+r(3,11,"0 1.5px"));case"broll":return n(i(10,8));case"split":return t(i(10,3,"0 0 2px 0")+r(14,5,"0"));case"leak":return n(a(`width: 8px; height: 8px; border: 2px solid ${e}; border-radius: 6px; background-color: ${e}`));case"trilha":return n(r(2,6)+r(2,12)+r(2,8)+r(2,10),"flex-end");case"legendas":return t(r(13,2,"0 0 3px 0")+r(9,2,"0"));case"podcast":return n(i(4,8,"0 1px")+i(4,8,"0 1px"));case"todas":return t(r(12,3,"0 0 2px 0")+r(12,3,"0 0 2px 0")+r(12,3,"0"));case"selecao":return n(`<span style="display: flex; align-items: center; justify-content: center; width: 9px; height: 9px; border: 1.5px dashed ${e}; border-radius: 2px">${r(4,4,"0")}</span>`);case"reler":return n(a(`width: 8px; height: 8px; border: 2px solid ${e}; border-top-color: transparent; border-radius: 6px`))}}function vt(o,e="#eceef2",a="#ff7d71"){let n=o/256,t=d=>`${(d*n).toFixed(2)}px`,r=(d,u,g="")=>`<span style="display: flex; flex: none; width: ${t(d)}; height: ${t(u)}; ${g}"></span>`,i=(d,u)=>`<span style="display: flex; flex-direction: row; flex: none; margin-top: ${t(u)}">${d}</span>`,s=t(22),c=(d,u)=>r(d,44,`background-color: ${e}; ${u==="esq"?`border-top-left-radius: ${s}; border-bottom-left-radius: ${s}`:`border-top-right-radius: ${s}; border-bottom-right-radius: ${s}`}`),l=[56,42,28,14].map((d,u)=>i(r(128-d/2,9)+r(d,9,`background-color: ${a}`),u===0?18:0)).join(""),m=[[28,196,12],[64,228,16],[44,212,16]].map(([d,u,g])=>i(r(d,44)+c(116-d,"esq")+r(24,44)+c(u-140,"dir"),g)).join("");return`<span style="display: flex; flex-direction: column; flex: none; width: ${t(256)}; height: ${t(256)}">${l}${m}</span>`}function Ke(o,e){let a=[],n=i=>Math.round(i*100),t=0,r=o.map((i,s)=>({...i,item:s})).sort((i,s)=>i.de-s.de);for(let i of r){let s=Math.max(i.de,t),c=Math.min(i.ate,e);n(c)<=n(s)||(n(s)>n(t)&&a.push({grow:n(s)-n(t),de:t,item:-1}),a.push({grow:n(c)-n(s),de:s,item:i.item}),t=c)}return n(e)>n(t)&&a.push({grow:n(e)-n(t),de:t,item:-1}),a}function Wa(o){let e=/<body[^>]*>([\s\S]*?)<!--SCRIPT-->/.exec(o);if(!e)throw new Error("HTML sem <body>...<!--SCRIPT--> no formato esperado");return e[1].trim()}var yt=`<!DOCTYPE html>\r
<html lang="pt-BR">\r
  <head>\r
    <meta charset="utf-8" />\r
    <title>B-Roller</title>\r
    <!-- O build substitui esta marca pelo conteudo de styles.css.\r
         <link rel="stylesheet"> nao carrega no UXP. -->\r
    <!--ESTILOS-->\r
  </head>\r
  <body>\r
    <header class="topo">\r
      <div class="marca">\r
        <span class="marca-nome">B-Roller</span>\r
      </div>\r
      <div id="estado" class="badge">carregando</div>\r
    </header>\r
\r
    <main class="conteudo">\r
      <section class="secao">\r
        <div class="secao-cabeca">\r
          <span class="cod">SEQ</span>\r
          <span class="secao-rotulo">Sequ\xEAncia ativa</span>\r
        </div>\r
        <div class="secao-corpo">\r
          <div id="seqNome" class="seq-nome" data-vazio="sim">Nenhuma sequ\xEAncia selecionada</div>\r
          <div id="seqDica" class="dica">\r
            Abra ou selecione uma sequ\xEAncia no Premiere. O painel l\xEA sozinho a que estiver ativa.\r
          </div>\r
          <div class="fatos">\r
            <div class="fato">\r
              <span class="fato-rotulo">Formato</span>\r
              <span id="seqFormato" class="fato-valor">\u2014</span>\r
            </div>\r
            <div class="fato">\r
              <span class="fato-rotulo">Frame rate</span>\r
              <span id="seqFps" class="fato-valor">\u2014</span>\r
            </div>\r
            <div class="fato">\r
              <span class="fato-rotulo">Dura\xE7\xE3o</span>\r
              <span id="seqDuracao" class="fato-valor">\u2014</span>\r
            </div>\r
            <div class="fato">\r
              <span class="fato-rotulo">Faixas</span>\r
              <span id="seqFaixas" class="fato-valor">\u2014</span>\r
            </div>\r
          </div>\r
        </div>\r
      </section>\r
\r
      <div class="par">\r
        <section class="secao">\r
          <div class="secao-cabeca">\r
            <span class="cod cod-video">V2</span>\r
            <span class="secao-rotulo">V\xEDdeo do B-roll</span>\r
          </div>\r
          <div class="secao-corpo">\r
            <sp-checkbox id="fillScreen">Preencher a tela</sp-checkbox>\r
            <sp-checkbox id="densidadeMaxima">Densidade m\xE1xima</sp-checkbox>\r
          </div>\r
        </section>\r
\r
        <section class="secao">\r
          <div class="secao-cabeca">\r
            <span class="cod cod-audio">A3</span>\r
            <span class="secao-rotulo">\xC1udio do B-roll</span>\r
          </div>\r
          <div class="secao-corpo">\r
            <sp-checkbox id="removeAudio">Remover o \xE1udio</sp-checkbox>\r
          </div>\r
        </section>\r
      </div>\r
\r
      <section class="secao">\r
        <div class="secao-cabeca">\r
          <span class="cod">SRC</span>\r
          <span class="secao-rotulo">Pasta de B-rolls</span>\r
        </div>\r
        <div class="secao-corpo">\r
          <label class="campo">\r
            <span class="campo-rotulo">Caminho da pasta no disco</span>\r
            <sp-textfield id="libraryPath" placeholder="caminho da pasta de B-rolls"></sp-textfield>\r
            <span class="campo-nota">Cole o caminho da pasta. Ele fica salvo depois da primeira an\xE1lise que der certo.</span>\r
          </label>\r
        </div>\r
      </section>\r
\r
      <div class="acao">\r
        <sp-button id="analisar" variant="cta">Analisar e inserir</sp-button>\r
        <sp-button id="aprender" variant="secondary" quiet>Aprender</sp-button>\r
      </div>\r
\r
      <section id="secaoLog" class="secao secao-log" data-aberto="sim">\r
        <div class="secao-cabeca">\r
          <span class="cod">LOG</span>\r
          <span class="secao-rotulo">Registro</span>\r
          <div\r
            id="logToggle"\r
            class="secao-acao"\r
            role="button"\r
            tabindex="0"\r
            aria-expanded="true"\r
            aria-controls="log"\r
            aria-label="Recolher o registro"\r
          >\r
            Recolher\r
          </div>\r
        </div>\r
        <div class="secao-corpo">\r
          <div id="log" class="log"></div>\r
        </div>\r
      </section>\r
    </main>\r
\r
    <!-- O build substitui esta marca pelo bundle inteiro.\r
         Caminho relativo nao resolve: o UXP procura a partir da raiz do\r
         plugin, nao da pasta do HTML. -->\r
    <!--SCRIPT-->\r
  </body>\r
</html>\r
`;var re=`/*\r
 * ============================================================================\r
 * FAMILIA PRO EDITION \u2014 folha de componentes do Auto B-roll\r
 * ============================================================================\r
 *\r
 * Restricoes do UXP que ditam TODA a estrutura abaixo (ver\r
 * docs/UXP_ARMADILHAS.md, cada uma custou um ciclo de reiniciar o Premiere):\r
 *\r
 *  - \`<link rel="stylesheet">\` NAO carrega. Este arquivo e embutido como\r
 *    <style> por scripts/build.mjs.\r
 *  - \`display: grid\` e IGNORADO. Layout inteiro em flexbox.\r
 *  - \`gap\` e \`var()\` NAO sao confiaveis. Por isso os tokens abaixo sao um\r
 *    bloco documentado com valores literais, e nao \`:root { --token: ... }\`;\r
 *    espacamento sai de margin, nunca de gap.\r
 *  - Media query nao e confiavel, e este painel nunca roda em telefone. A\r
 *    responsividade real e a largura do painel acoplado no Premiere, e sai de\r
 *    \`flex-wrap\` com \`flex: 1 1 <base>\`: blocos lado a lado quando ha largura,\r
 *    empilhados quando nao ha.\r
 *  - Num flex column os filhos NAO esticam: encolhem ate o conteudo e ficam\r
 *    centralizados. \`align-items: stretch\` explicito e o que resolve;\r
 *    \`text-align: left\` sozinho nao basta.\r
 *  - \`<button>\` nativo e renderizado como controle do host: ignora o CSS do\r
 *    proprio elemento e achata os filhos numa linha so. Onde precisamos de um\r
 *    botao estilizado usamos \`div[role="button"][tabindex="0"]\`.\r
 *\r
 * ---------------------------------------------------------------- TOKENS ---\r
 * Mesma tabela nos tres plugins da familia (Auto B-roll, Pro Captions, Pro\r
 * Edition). Repetida de proposito em cada folha: sao repos independentes que\r
 * precisam construir sozinhos, e var() nao funciona aqui.\r
 *\r
 *   SUPERFICIE\r
 *     bg-0        #0d0f13   fundo do painel (quase preto)\r
 *     bg-1        #14171d   superficie: secoes e cards\r
 *     bg-2        #1a1e26   superficie elevada: topo, cabeca de secao, chips\r
 *     bg-3        #202631   hover de superficie clicavel\r
 *     line        #232830   borda sutil (padrao)\r
 *     line-2      #333b47   borda em hover\r
 *\r
 *   TEXTO\r
 *     txt         #eceef2   conteudo principal\r
 *     txt-2       #9098a6   secundario, rotulos\r
 *     txt-3       #5f6774   apagado: vazio, placeholder, dica\r
 *\r
 *   SEMANTICA\r
 *     azul        #3b82f6   acao primaria, foco\r
 *     verde       #4ecb8d   sucesso / pronto / faixa de audio\r
 *     ambar       #eeab4c   atencao / processando\r
 *     vermelho    #ff7d71   erro\r
 *     violeta     #8d82f5   acento do Auto B-roll / faixa de video\r
 *\r
 *   FORMA\r
 *     raio-lg     10px      secoes e cards\r
 *     raio-md     8px       campos e controles\r
 *     raio-full   999px     chips de status\r
 *     transicao   150ms     hover, focus, active\r
 *\r
 *   TIPOGRAFIA\r
 *     sans        Inter, adobe-clean, Segoe UI      (Inter se instalada)\r
 *     mono        Roboto Mono, Consolas             (dado tecnico e codigo)\r
 *     escala      15/13/12/11/9 px\r
 * ============================================================================\r
 */\r
\r
html,\r
body {\r
  height: 100%;\r
  margin: 0;\r
  padding: 0;\r
}\r
\r
body {\r
  display: flex;\r
  flex-direction: column;\r
  background-color: #0d0f13;\r
  color: #eceef2;\r
  font-family: Inter, adobe-clean, "Source Sans 3", "Segoe UI", sans-serif;\r
  font-size: 13px;\r
  line-height: 1.45;\r
  overflow: hidden;\r
  /* O UXP centraliza texto por padrao em varios contextos. Fixar aqui e\r
     repetir nos rotulos, senao tudo fica no meio do bloco. */\r
  text-align: left;\r
}\r
\r
/* =============================================================== HEADER === */\r
\r
.topo {\r
  display: flex;\r
  flex-direction: row;\r
  align-items: center;\r
  justify-content: space-between;\r
  flex: none;\r
  padding: 10px 12px;\r
  background-color: #1a1e26;\r
  border-bottom: 1px solid #232830;\r
}\r
\r
.marca {\r
  display: flex;\r
  flex-direction: row;\r
  align-items: baseline;\r
  min-width: 0;\r
}\r
\r
/* Tarja de 3px antes do nome: a mesma linguagem de cor dos codigos de faixa,\r
   so que na marca \u2014 o acento deste plugin (violeta) aparece antes mesmo de\r
   abrir qualquer secao. E o fio que costura os tres plugins da familia. */\r
.marca-nome::before {\r
  content: "";\r
  display: inline-block;\r
  width: 3px;\r
  height: 12px;\r
  margin-right: 8px;\r
  vertical-align: -1px;\r
  background-color: #8d82f5;\r
  border-radius: 2px;\r
}\r
\r
.marca-nome {\r
  text-align: left;\r
  font-size: 15px;\r
  font-weight: 700;\r
  letter-spacing: -0.01em;\r
  color: #ffffff;\r
  white-space: nowrap;\r
}\r
\r
/* ========================================================= STATUS BADGE === */\r
\r
/* Discreto por definicao: chip de contorno, nunca preenchido. O glifo antes do\r
   texto e o que faz o status nao depender so de cor. */\r
.badge {\r
  display: flex;\r
  flex-direction: row;\r
  align-items: center;\r
  flex: none;\r
  padding: 2px 9px;\r
  background-color: #14171d;\r
  border: 1px solid #232830;\r
  border-radius: 999px;\r
  font-family: "Roboto Mono", Consolas, monospace;\r
  font-size: 10px;\r
  letter-spacing: 0.02em;\r
  color: #9098a6;\r
  white-space: nowrap;\r
}\r
\r
.badge::before {\r
  content: "\\2022";\r
  margin-right: 5px;\r
  font-size: 10px;\r
}\r
\r
.badge[data-tom="ok"] {\r
  color: #4ecb8d;\r
  border-color: #26493a;\r
}\r
\r
.badge[data-tom="ok"]::before {\r
  content: "\\2713";\r
}\r
\r
.badge[data-tom="ativo"] {\r
  color: #eeab4c;\r
  border-color: #4a3a20;\r
}\r
\r
.badge[data-tom="ativo"]::before {\r
  content: "\\25cc";\r
}\r
\r
.badge[data-tom="aviso"] {\r
  color: #eeab4c;\r
  border-color: #4a3a20;\r
}\r
\r
.badge[data-tom="aviso"]::before {\r
  content: "!";\r
}\r
\r
.badge[data-tom="erro"] {\r
  color: #ff7d71;\r
  border-color: #542c29;\r
}\r
\r
.badge[data-tom="erro"]::before {\r
  content: "\\00d7";\r
}\r
\r
/* ================================================================ CORPO === */\r
\r
.conteudo {\r
  display: flex;\r
  flex-direction: column;\r
  align-items: stretch;\r
  flex: 1 1 auto;\r
  min-height: 0;\r
  overflow-y: auto;\r
  overflow-x: hidden;\r
  padding: 12px;\r
}\r
\r
/* Linha que quebra sozinha: e isto que torna o painel responsivo sem grid nem\r
   media query. Duas colunas quando o painel esta largo, uma quando esta\r
   acoplado estreito. */\r
/*\r
 * \`flex: none\` em TODO filho direto de \`.conteudo\`, aqui e nas duas regras\r
 * abaixo.\r
 *\r
 * \`.conteudo\` e um flex column de altura definida (o painel inteiro), e num\r
 * flex column o filho encolhe por padrao. Sem isto, o conteudo que nao cabe\r
 * espreme as secoes em vez de rolar: medido no Chrome, a secao SRC ficava 18px\r
 * mais baixa que o proprio conteudo e cortava a ultima linha dentro do\r
 * \`overflow: hidden\`. Quem rola e \`.conteudo\`; as secoes nunca encolhem.\r
 */\r
.par {\r
  display: flex;\r
  flex-direction: row;\r
  flex-wrap: wrap;\r
  align-items: stretch;\r
  flex: none;\r
  margin-left: -4px;\r
  margin-right: -4px;\r
}\r
\r
/* 180px: V2 e A3 pareiam a partir de ~390px de painel e empilham abaixo\r
   disso. Medido no Chrome com as previas de 300px e 420px. */\r
.par > .secao {\r
  flex: 1 1 180px;\r
  margin-left: 4px;\r
  margin-right: 4px;\r
}\r
\r
/* ============================================================== SECTION === */\r
\r
/*\r
 * A secao substituiu a canaleta vertical de 44px que existia antes. O codigo\r
 * da faixa (SEQ, V2, A3, SRC, LOG) continua sendo a identidade do painel, mas\r
 * agora mora numa cabeca horizontal: devolve 44px de largura ao conteudo em\r
 * todas as secoes \u2014 o que importa muito num painel acoplado estreito \u2014 e poe o\r
 * rotulo acima do que ele rotula, em vez de ao lado.\r
 */\r
.secao {\r
  display: flex;\r
  flex-direction: column;\r
  align-items: stretch;\r
  flex: none;\r
  margin-bottom: 8px;\r
  background-color: #14171d;\r
  border: 1px solid #232830;\r
  border-radius: 10px;\r
  overflow: hidden;\r
}\r
\r
.secao-cabeca {\r
  display: flex;\r
  flex-direction: row;\r
  align-items: center;\r
  flex: none;\r
  padding: 7px 12px;\r
  background-color: #1a1e26;\r
  border-bottom: 1px solid #232830;\r
}\r
\r
.cod {\r
  flex: none;\r
  margin-right: 9px;\r
  font-family: "Roboto Mono", Consolas, monospace;\r
  font-size: 10px;\r
  font-weight: 700;\r
  letter-spacing: 0.08em;\r
  color: #6b7381;\r
  white-space: nowrap;\r
}\r
\r
.cod-video {\r
  color: #8d82f5;\r
}\r
\r
.cod-audio {\r
  color: #4ecb8d;\r
}\r
\r
.secao-rotulo {\r
  flex: 1 1 auto;\r
  min-width: 0;\r
  text-align: left;\r
  font-size: 11px;\r
  font-weight: 500;\r
  color: #9098a6;\r
  white-space: nowrap;\r
  overflow: hidden;\r
  text-overflow: ellipsis;\r
}\r
\r
.secao-corpo {\r
  display: flex;\r
  flex-direction: column;\r
  align-items: stretch;\r
  flex: 1 1 auto;\r
  min-width: 0;\r
  padding: 11px 12px;\r
}\r
\r
/* ============================================================ SEQUENCIA === */\r
\r
.seq-nome {\r
  text-align: left;\r
  font-size: 15px;\r
  font-weight: 600;\r
  letter-spacing: -0.01em;\r
  color: #ffffff;\r
  white-space: nowrap;\r
  overflow: hidden;\r
  text-overflow: ellipsis;\r
  margin-bottom: 9px;\r
}\r
\r
.seq-nome[data-vazio="sim"] {\r
  font-size: 13px;\r
  font-weight: 500;\r
  color: #9098a6;\r
}\r
\r
/* EmptyState: a dica so existe enquanto nao ha sequencia. Quem esconde e o\r
   mount(), nao o CSS \u2014 seletor de irmao adjacente nao e garantido no UXP e\r
   uma dica presa na tela mentiria sobre o estado real. */\r
.dica {\r
  text-align: left;\r
  font-size: 12px;\r
  color: #5f6774;\r
  margin-bottom: 9px;\r
}\r
\r
.fatos {\r
  display: flex;\r
  flex-direction: row;\r
  flex-wrap: wrap;\r
  margin-left: -6px;\r
  margin-right: -6px;\r
  margin-bottom: -4px;\r
}\r
\r
.fato {\r
  flex: 1 1 88px;\r
  min-width: 0;\r
  padding-left: 6px;\r
  padding-right: 6px;\r
  margin-bottom: 4px;\r
}\r
\r
.fato-rotulo {\r
  text-align: left;\r
  display: block;\r
  font-size: 9px;\r
  letter-spacing: 0.09em;\r
  text-transform: uppercase;\r
  color: #5f6774;\r
  white-space: nowrap;\r
}\r
\r
.fato-valor {\r
  text-align: left;\r
  display: block;\r
  font-family: "Roboto Mono", Consolas, monospace;\r
  font-size: 12px;\r
  color: #eceef2;\r
  white-space: nowrap;\r
  overflow: hidden;\r
  text-overflow: ellipsis;\r
}\r
\r
/* ============================================================ FORMFIELD === */\r
\r
/* \`align-items: stretch\` e obrigatorio: no UXP os filhos de um flex column nao\r
   esticam, encolhem e ficam centralizados \u2014 e ai \`text-align\` nao adianta,\r
   porque a caixa do texto ja e do tamanho do texto. */\r
.campo {\r
  display: flex;\r
  flex-direction: column;\r
  align-items: stretch;\r
  min-width: 0;\r
}\r
\r
.campo-rotulo {\r
  display: block;\r
  text-align: left;\r
  font-size: 11px;\r
  color: #9098a6;\r
  margin-bottom: 4px;\r
}\r
\r
.campo sp-textfield {\r
  width: 100%;\r
}\r
\r
.campo-nota {\r
  display: block;\r
  text-align: left;\r
  font-size: 11px;\r
  color: #5f6774;\r
  margin-top: 5px;\r
}\r
\r
/* ======================================================= TOGGLE/CHECKBOX === */\r
\r
/* Nao mexer no \`display\` do sp-checkbox: ele e inline-flex por dentro, e\r
   forcar block joga o rotulo para baixo da caixa. So espacamento e tamanho. */\r
.secao-corpo sp-checkbox {\r
  font-size: 12px;\r
  margin-bottom: 6px;\r
}\r
\r
.secao-corpo sp-checkbox:last-child {\r
  margin-bottom: 0;\r
}\r
\r
/* =============================================================== BUTTON === */\r
\r
/*\r
 * Hierarquia de acao: a primaria ganha o dobro de base flexivel da secundaria,\r
 * entao ela e sempre visualmente maior quando as duas cabem na mesma linha, e\r
 * e a primeira a ocupar a linha inteira quando o painel estreita. A secundaria\r
 * e \`quiet\` (so texto) para nao disputar com ela.\r
 */\r
.acao {\r
  display: flex;\r
  flex-direction: row;\r
  flex-wrap: wrap;\r
  align-items: center;\r
  flex: none;\r
  margin-left: -4px;\r
  margin-right: -4px;\r
  margin-bottom: 8px;\r
}\r
\r
.acao sp-button {\r
  margin-left: 4px;\r
  margin-right: 4px;\r
  margin-bottom: 4px;\r
}\r
\r
.acao sp-button#analisar {\r
  flex: 2 1 180px;\r
}\r
\r
.acao sp-button#aprender {\r
  flex: 1 1 110px;\r
}\r
\r
/* ============================================================== LOGPANEL === */\r
\r
/*\r
 * O log rola por dentro, com altura propria e recolhivel.\r
 *\r
 * Sem altura propria ele cresce para baixo e as ultimas linhas \u2014 que sao as que\r
 * importam \u2014 nascem fora da area visivel do painel. Foi exatamente o que fez o\r
 * plugin parecer morto: as mensagens estavam sendo escritas, so nao dava para\r
 * ve-las. Por isso nasce ABERTO: recolher e escolha do usuario, nunca o padrao.\r
 */\r
.secao-log {\r
  margin-bottom: 0;\r
}\r
\r
.secao-log .secao-corpo {\r
  padding: 0;\r
}\r
\r
.secao[data-aberto="nao"] .secao-corpo {\r
  display: none;\r
}\r
\r
/* Acao de cabeca de secao. \`div[role=button]\` e nao \`<button>\`: o botao nativo\r
   do UXP ignora o CSS do proprio elemento e vira pilula cinza. */\r
.secao-acao {\r
  flex: none;\r
  margin-left: 8px;\r
  padding: 2px 8px;\r
  background-color: #14171d;\r
  border: 1px solid #232830;\r
  border-radius: 8px;\r
  font-size: 11px;\r
  color: #9098a6;\r
  white-space: nowrap;\r
  cursor: pointer;\r
  transition: background-color 150ms, border-color 150ms, color 150ms;\r
}\r
\r
.secao-acao:hover {\r
  background-color: #202631;\r
  border-color: #333b47;\r
  color: #eceef2;\r
}\r
\r
.secao-acao:active {\r
  background-color: #1a1e26;\r
}\r
\r
.secao-acao:focus {\r
  border-color: #3b82f6;\r
  color: #eceef2;\r
  outline: none;\r
}\r
\r
.log {\r
  height: 132px;\r
  overflow-y: auto;\r
  overflow-x: hidden;\r
  padding: 9px 12px;\r
  font-family: "Roboto Mono", Consolas, monospace;\r
  font-size: 11px;\r
  line-height: 1.6;\r
  color: #9098a6;\r
  white-space: pre-wrap;\r
  word-break: break-word;\r
}\r
\r
.l-ok {\r
  color: #4ecb8d;\r
}\r
\r
.l-erro {\r
  color: #ff7d71;\r
}\r
\r
.l-passo {\r
  color: #c9cfd8;\r
}\r
\r
.l-aviso {\r
  color: #eeab4c;\r
}\r
\r
.l-vazio {\r
  color: #5f6774;\r
}\r
`;function Re(o,e){return e<o.inPointSeconds||e>=o.outPointSeconds?null:o.startSeconds+(e-o.inPointSeconds)/o.speed}function wt(o,e){if(o.width<=0||o.height<=0)throw new RangeError(`dimensao invalida do clipe: ${o.width}x${o.height}`);return Math.max(e.width/o.width,e.height/o.height)*100}var Xa=.1;function Et(o,e,a){if(!Number.isFinite(o)||!Number.isFinite(e))return null;let n=Math.max(0,o),t=Math.min(e,a);return t-n<Xa||n<=Xa&&t>=a-Xa?null:{inicio:n,fim:t}}function Pt(o,e){if(!Number.isFinite(o)||!Number.isFinite(e)||e<=0)return"--:--:--:--";let a=Math.max(1,Math.round(e)),n=Math.max(0,Math.round(o*a)),t=n%a,r=Math.floor(n/a),i=s=>String(s).padStart(2,"0");return`${i(Math.floor(r/3600))}:${i(Math.floor(r/60)%60)}:${i(r%60)}:${i(t)}`}function j(o){let e=Math.max(0,Math.round(o)),a=n=>String(n).padStart(2,"0");return`${a(Math.floor(e/60))}:${a(e%60)}`}var uo={schema:1,videoTrackIndex:1,audioTrackIndex:2,removeAudio:!0,fillScreen:!0,densidadeMaxima:!0,libraryPath:""};function Yo(o){if(typeof o!="object"||o===null)return uo;let e=o,a=(t,r)=>typeof t=="number"&&Number.isInteger(t)&&t>=0?t:r,n=(t,r)=>typeof t=="boolean"?t:r;return{schema:1,videoTrackIndex:a(e.videoTrackIndex,uo.videoTrackIndex),audioTrackIndex:a(e.audioTrackIndex,uo.audioTrackIndex),removeAudio:n(e.removeAudio,uo.removeAudio),fillScreen:n(e.fillScreen,uo.fillScreen),densidadeMaxima:n(e.densidadeMaxima,uo.densidadeMaxima),libraryPath:typeof e.libraryPath=="string"?e.libraryPath:uo.libraryPath}}var rc=new Set(["mp4","mov","m4v","mxf","avi","mkv","webm"]);function Mo(o){let e=o.lastIndexOf(".");return e<0?!1:rc.has(o.slice(e+1).toLowerCase())}function ho(o){let e=o.trim().replace(/^["']+|["']+$/g,"");e=e.replace(/^file:\/*/i,"");for(let n=0;n<3;n++){let t;try{t=decodeURI(e)}catch{break}if(t===e)break;e=t}let a=e.replace(/\\/g,"/").replace(/\/+$/,"").replace(/^\/+/,"");if(a.length===0)throw new RangeError("caminho vazio");return`file:/${a}`}function At(o,e){return`${o}${e+1}`}var ic=new Set(["que","com","para","por","uma","uns","umas","dos","das","nos","nas","ele","ela","eles","elas","isso","isto","aquilo","seu","sua","meu","minha","voce","vocs","nao","sim","mas","como","quando","onde","porque","muito","mais","menos","tudo","todo","toda","todos","todas","ser","estar","tem","ter","foi","sao","era","esta","essa","esse","aqui","ali","lah","ja","ainda","entao","assim","bem","vai","vou","pode"]);function Tt(o){let e=o;return e.length>4&&e.endsWith("oes")?`${e.slice(0,-3)}ao`:e.length>4&&(e.endsWith("aes")||e.endsWith("ais"))?`${e.slice(0,-3)}al`:e.length>4&&e.endsWith("ns")?`${e.slice(0,-2)}m`:(e.length>3&&e.endsWith("s")&&(e=e.slice(0,-1)),e)}function ie(o){return o.normalize("NFD").replace(/[̀-ͯ]/g,"").toLowerCase().replace(/[^a-z0-9\s]/g," ").split(/\s+/).filter(e=>e.length>=3&&!ic.has(e)).map(Tt)}var se=new Map([["viagra",["disfuncao","eretil","impotencia","erecao","ereto","remedio","comprimido","pilula","azul","potencia","desempenho","ejaculacao","precoce","libido","rigidez"]],["teleconsulta",["telemedicina","online","distancia","videochamada","atendimento","clicando","botao","link","celular","aplicativo"]],["doutor",["medico","urologista","especialista","profissional","clinica","andrologista"]],["falhou",["brochar","brochou","falha","falhar","vexame","fracasso","decepcionar","perder","ejaculacao","precoce"]],["cama",["sexual","sexo","relacao","intimidade","transar","desempenho","performance","noite"]],["frustrado",["frustracao","vergonha","humilhacao","deprimido","triste","desanimo","briga","problema","piora","sofrimento"]],["desanimado",["desanimo","animo","cansado","abatido","energia","apatia","disfuncao","eretil","ejaculacao","precoce","impotencia","libido"]],["separacao",["divorcio","separar","terminar","briga","distanciamento","afastamento","traicao","casamento"]],["infarto",["cardiaco","coracao","avc","entupimento","pressao","risco","derrame","circulatorio"]],["sanguineo",["circulacao","sangue","arteria","veia","fluxo","irrigacao","vascular","entupimento"]],["vaso",["arteria","veia","circulacao","irrigacao"]],["tratamento",["tratar","solucao","cura","protocolo","terapia","adequado","resolver"]],["consulta",["consultorio","avaliacao","diagnostico","atendimento","exame"]],["medica",["medico","saude","clinica"]],["exames",["exame","diagnostico","laboratorio","ultrassom","doppler","sangue"]],["doppler",["ultrassom","exame","circulacao","fluxo"]],["medicamento",["remedio","comprimido","medicacao","tarja","receita","dose"]],["injetaveis",["injecao","injetavel","aplicacao","agulha","aplicar"]],["paliativa",["paliativo","temporario","tapar","disfarcar","provisorio","engana"]],["medida",["solucao","saida","alternativa"]],["diabetes",["diabetico","glicemia","acucar","glicose"]],["academia",["exercicio","treino","musculacao","atividade","fisica","esporte"]],["corpo",["fisico","saude","organismo"]],["casal",["casais","relacionamento","parceira","esposa","mulher","namorada","conjuge"]],["feliz",["felicidade","alegria","satisfacao","prazer"]],["milhare",["milhoes","milhao","muitos","maioria","brasileiros"]],["homem",["homens","masculino","cara","rapaz"]],["alivio",["aliviar","melhora","solucao","conforto","tranquilidade"]],["emocional",["emocao","sentimento","psicologico","distanciamento","autoestima"]],["tempo",["bomba","relogio","urgente","urgencia","prazo","demora","adiar","piora"]],["acabando",["acabar","explodir","estourar","limite","fim"]],["disposicao",["energia","animo","vitalidade","vigor"]],["receita",["caseiro","cha","simpatia","milagroso","internet"]],["gaveta",["escondido","guardado","vergonha"]],["jogando",["jogar","largar","parar","abandonar","livrar"]],["comparacao",["comparar","antes","depois","diferenca"]],["jovem",["jovens","idade"]],["paciente",["atendido","avaliado","diagnostico"]],["reservada",["privacidade","discricao","sigilo","particular"]]]),St=se;function Ze(o){St=o}function Bo(o){if(typeof o!="object"||o===null)return null;let e=o.sinonimos;if(typeof e!="object"||e===null)return null;let a=new Map;for(let[n,t]of Object.entries(e)){if(!Array.isArray(t))continue;let r=t.filter(i=>typeof i=="string"&&i.length>0);r.length>0&&a.set(n,r)}return a.size>0?a:null}function Ka(o){let e={};for(let[a,n]of o)e[a]=n;return{schema:1,sinonimos:e}}function Qo(o){return o.replace(/\.[a-z0-9]+$/i,"").replace(/\s*\(\d+\)\s*$/,"").trim()}function oa(o){let e=new Map;for(let n of o){let t=Qo(n);if(t.length===0)continue;let r=e.get(t);r?r.push(n):e.set(t,[n])}let a=[];for(let[n,t]of e)a.push({rotulo:n,arquivos:t,termos:ie(n)});return a.sort((n,t)=>n.rotulo.localeCompare(t.rotulo,"pt-BR")),a}var sc=6,cc=.6;function Ne(o,e){if(o===e)return!0;let a=Math.min(o.length,e.length),n=0;for(;n<a&&o[n]===e[n];)n++;return n>=sc&&n/a>=cc}function lc(o){let e=new Map;for(let n of o)for(let t of new Set(n.termos))e.set(t,(e.get(t)??0)+1);let a=new Map;for(let[n,t]of e)a.set(n,1/t);return a}function ce(o,e){if(e.some(n=>Ne(o,n)))return!0;let a=St.get(o);return a?a.some(n=>e.some(t=>Ne(Tt(n),t))):!1}function kt(o,e,a=3){let n=ie(o);if(n.length===0)return[];let t=lc(e),r=[];for(let i of e){if(i.termos.length===0)continue;let s=i.termos.filter(d=>ce(d,n));if(s.length===0)continue;let c=i.termos.reduce((d,u)=>d+(t.get(u)??1),0),l=s.reduce((d,u)=>d+(t.get(u)??1),0),m=c>0?l/c:0;r.push({conceito:i,score:m,motivo:s.length===i.termos.length?`frase contem "${i.rotulo}"`:`casou ${s.join(", ")} de "${i.rotulo}"`,termosCasados:s})}return r.sort((i,s)=>s.score!==i.score?s.score-i.score:s.conceito.termos.length!==i.conceito.termos.length?s.conceito.termos.length-i.conceito.termos.length:i.conceito.rotulo.localeCompare(s.conceito.rotulo,"pt-BR")),r.slice(0,a)}function le(o){let e;try{e=JSON.parse(o)}catch{return null}if(typeof e!="object"||e===null)return null;let a=e;if(!Array.isArray(a.segments))return null;let n=[];for(let t of a.segments){if(typeof t!="object"||t===null)continue;let r=t;if(!Array.isArray(r.words))continue;let i=[];for(let s of r.words){if(typeof s!="object"||s===null)continue;let c=s;typeof c.text!="string"||typeof c.start!="number"||i.push({text:c.text,start:c.start,duration:typeof c.duration=="number"?c.duration:0,confidence:typeof c.confidence=="number"?c.confidence:1,eos:c.eos===!0,type:typeof c.type=="string"?c.type:"word"})}n.push({start:typeof r.start=="number"?r.start:0,duration:typeof r.duration=="number"?r.duration:0,speaker:typeof r.speaker=="string"?r.speaker:"",words:i})}return{language:typeof a.language=="string"?a.language:"",segments:n}}function ea(o,e){let a=[];for(let n of o){let t=e.get(n.sourceName);if(t)for(let r of t.segments)for(let i of r.words){if(i.type!=="word")continue;let s=Re(n,i.start);if(s===null)continue;let c=i.start+i.duration,l=Re(n,c)??n.endSeconds;a.push({text:i.text,inicio:s,fim:Math.max(s,l),confidence:i.confidence,eos:i.eos,sourceName:n.sourceName})}}return a.sort((n,t)=>n.inicio-t.inicio),a}var Mt=1.5,dc=.05;function Ct(o){let e=[],a=[],n=()=>{if(a.length===0)return;let r=a[0],i=a[a.length-1];if(!r||!i)return;let s=[];for(let c of a)for(let l of ie(c.text))s.push({termo:l,inicio:c.inicio});e.push({texto:a.map(c=>c.text).join(" "),inicio:r.inicio,fim:i.fim,duracao:i.fim-r.inicio,palavras:a.length,confiancaMinima:Math.min(...a.map(c=>c.confidence)),termosNoTempo:s}),a=[]};for(let r=0;r<o.length;r++){let i=o[r];if(!i)continue;let s=a[a.length-1];s&&i.inicio-s.fim>Mt&&n(),a.push(i);let c=o[r+1],l=c?c.inicio-i.fim:Number.POSITIVE_INFINITY;i.eos&&l>=dc&&n()}n();let t=Number.NEGATIVE_INFINITY;for(let r=e.length-1;r>=0;r--){let i=e[r];if(!i)continue;let s=e[r+1];(!s||s.inicio-i.fim>Mt)&&(t=i.fim),e[r]={...i,fimDaFala:t}}return e}var uc=.6,mc=1.2,pc=.5,fc=.75;function gc(o,e,a,n){if(a===void 0||a.size===0)return[];let t=new Set(o.termosNoTempo.map(s=>s.termo)),r=new Set(n.map(s=>s.conceito.rotulo)),i=[];for(let s of e){if(r.has(s.rotulo))continue;let c=a.get(s.rotulo);if(c===void 0)continue;let l=c.filter(m=>t.has(m));l.length!==0&&i.push({conceito:s,score:fc,motivo:`voce ensinou: "${l.join(", ")}" pede "${s.rotulo}"`,termosCasados:l})}return i}function $t(o){let e=[],a=new Map;for(let[r,i]of o.transcricoesJson){let s=le(i);s?a.set(r,s):e.push(`Transcricao ilegivel em ${r}.`)}a.size===0&&e.push("Nenhuma midia da timeline tem transcricao. Gere a transcricao no Premiere primeiro.");let n=ea(o.clipes,a),t=Za(n,o);return{...t,avisos:[...e,...t.avisos]}}function Za(o,e){let a=[],n=e.duracaoMinima??mc,t=e.scoreMinimo??pc,r=Ct(o),i=oa(e.biblioteca);i.length===0&&a.push("Nenhum conceito encontrado no projeto.");let s=[];for(let c of r){if(c.duracao<n)continue;let l=kt(c.texto,i).filter(d=>d.score>=t),m=[...l,...gc(c,i,e.ligacoes,l)].sort((d,u)=>u.score-d.score).slice(0,3);m.length!==0&&(c.confiancaMinima<uc&&a.push(`Trecho incerto em ${c.inicio.toFixed(1)}s (confianca ${c.confiancaMinima.toFixed(2)}): "${c.texto}"`),s.push({frase:c,sugestoes:m}))}return{palavras:o.length,frases:r,conceitos:i,oportunidades:s,avisos:a}}var hc=.25,bc=.5,xc=1.5,Rt={schema:3,pares:{},arquivos:{},vistos:{}};function na(o,e){return`${o}|${e}`}function Nt(o,e,a){if(a.length===0)return 1;let n=0;for(let t of a){let r=o.pares[na(e,t)],i=r===void 0?1:1+hc*(r.acertos-r.erros);n+=Math.min(xc,Math.max(bc,i))}return n/a.length}function Ot(o,e,a){let n={...o.pares},t={...o.arquivos},r=0,i=0;for(let s of e.itens){let c=a.has(s.arquivo);c?r++:i++,Oe(t,s.arquivo,c);for(let l of s.termosCasados)Oe(n,na(s.conceito,l),c)}return{memoria:{...o,schema:3,pares:n,arquivos:t},acertos:r,erros:i}}var vc=20;function en(o){let e=o.acertos,a=o.erros;for(;e+a>vc;)e=Math.round(e/2),a=Math.round(a/2);return{acertos:e,erros:a}}function Oe(o,e,a){let n=o[e]??{acertos:0,erros:0};o[e]=en({acertos:n.acertos+(a?1:0),erros:n.erros+(a?0:1)})}function yc(o){if(o.length<=60)return o;let e=o.lastIndexOf(" ",60);return`${o.slice(0,e>20?e:60)}\u2026`}var Dt=.5;function wc(o,e){let a,n=0;for(let t of o){let r=Math.min(e.fim,t.fim)-Math.max(e.inicio,t.inicio);r>n&&(n=r,a=t)}return a!==void 0?a:o.find(t=>e.inicio>=t.inicio-Dt&&e.inicio<t.fim)}function Ft(o,e,a,n,t,r=on){let i=r,s={...o.pares},c={...o.arquivos},l={...o.vistos},m=[],d=0,u=0,g=0,p=0;for(let f of a){let y=t.find(M=>M.arquivos.includes(f.arquivo));if(y===void 0){g++;continue}let b=wc(n,f);if(b===void 0){p++;continue}let P=y.termos.filter(M=>ce(M,ie(b.texto)));if(P.length===0){let M=`assoc|${e}|${f.arquivo}|${Math.round(f.inicio)}`;if(l[M]!==!0){l[M]=!0,Oe(c,f.arquivo,!0);let w=new Set(b.termosNoTempo.filter(S=>S.inicio>=f.inicio-Dt&&S.inicio<=f.fim).map(S=>S.termo));for(let S of w)i=Ac(i,y.rotulo,S)}m.push(`${j(f.inicio)} voce colocou "${y.rotulo}" onde se diz "${yc(b.texto)}" \u2014 o dicionario nao explica, mas vale: o take ganhou credito e contei as palavras cobertas.`);continue}let T=`${e}|${f.arquivo}|${Math.round(f.inicio)}`;if(l[T]===!0){u++;continue}l[T]=!0,d++,Oe(c,f.arquivo,!0);for(let M of P)Oe(s,na(y.rotulo,M),!0)}return{memoria:{schema:3,pares:s,arquivos:c,vistos:l},associacoes:i,creditados:d,jaContados:u,foraDaBiblioteca:g,semFala:p,semLigacao:m}}function Lt(o,e){let a,n=Number.NEGATIVE_INFINITY;for(let t of e){let r=o.arquivos[t],i=r===void 0?0:r.acertos-r.erros;i>n&&(n=i,a=t)}return a}var zt=2;function jt(o,e,a){return o.filter(n=>{let t=n.inicio;return t===void 0?a.has(n.arquivo):e.some(r=>r.arquivo===n.arquivo&&Math.abs(r.inicio-t)<=zt)}).length}var Ec=10,Pc=1/3;function Vt(o,e){return e===0?!0:o>=Ec&&e<o*Pc}function de(o,e,a){let n=o.porSequencia[e],t=new Map;for(let i of n?.postos??[])t.set(qt(i),i);for(let i of a?.itens??[]){let s={arquivo:i.arquivo,...i.inicio!==void 0?{inicio:i.inicio}:{}};t.set(qt(s),s)}let r={...o.porSequencia};return r[e]={quando:a?.quando??n?.quando??"",itens:a?.itens??[],postos:[...t.values()]},{schema:1,porSequencia:r}}function qt(o){return o.inicio===void 0?o.arquivo:`${o.arquivo}|${Math.round(o.inicio)}`}function Yt(o,e){if(e===void 0)return!1;let a=(n,t)=>n===o.arquivo&&(t===void 0||Math.abs(t-o.inicio)<=zt);return e.itens.some(n=>a(n.arquivo,n.inicio))||(e.postos??[]).some(n=>a(n.arquivo,n.inicio))}var on={schema:1,pares:{}},an=3;function Ac(o,e,a){let n=na(e,a);return{schema:1,pares:{...o.pares,[n]:(o.pares[n]??0)+1}}}function ue(o){let e=new Map;for(let[a,n]of Object.entries(o.pares)){if(n<an)continue;let t=a.indexOf("|");if(t<0)continue;let r=a.slice(0,t),i=a.slice(t+1);e.set(r,[...e.get(r)??[],i])}return e}function Co(o){if(typeof o!="object"||o===null)return on;let e=o.pares;if(typeof e!="object"||e===null)return on;let a={};for(let[n,t]of Object.entries(e))typeof t=="number"&&Number.isFinite(t)&&t>0&&(a[n]=Math.floor(t));return{schema:1,pares:a}}function _o(o){let e={};if(typeof o=="object"&&o!==null){let a=o.vistos;if(typeof a=="object"&&a!==null)for(let n of Object.keys(a))e[n]=!0}return{schema:3,pares:It(o,"pares"),arquivos:It(o,"arquivos"),vistos:e}}function It(o,e){let a={};for(let[n,t]of nn(o,e)){let r=aa(t.acertos),i=aa(t.erros);r!==null&&i!==null&&(a[n]={acertos:r,erros:i})}return a}function ta(o){let e={};for(let[a,n]of nn(o,"porSequencia")){let t=n;if(!Array.isArray(t.itens))continue;let r=[];for(let s of t.itens){if(typeof s!="object"||s===null)continue;let c=s;typeof c.arquivo!="string"||typeof c.conceito!="string"||r.push({arquivo:c.arquivo,conceito:c.conceito,termosCasados:Array.isArray(c.termosCasados)?c.termosCasados.filter(l=>typeof l=="string"):[],...typeof c.inicio=="number"&&Number.isFinite(c.inicio)?{inicio:c.inicio}:{}})}let i=[];for(let s of Array.isArray(t.postos)?t.postos:[])if(typeof s=="string")i.push({arquivo:s});else if(typeof s=="object"&&s!==null){let c=s;if(typeof c.arquivo!="string")continue;i.push({arquivo:c.arquivo,...typeof c.inicio=="number"&&Number.isFinite(c.inicio)?{inicio:c.inicio}:{}})}e[a]={quando:typeof t.quando=="string"?t.quando:"",itens:r,postos:i}}return{schema:1,porSequencia:e}}function nn(o,e){if(typeof o!="object"||o===null)return[];let a=o[e];return typeof a!="object"||a===null?[]:Object.entries(a).filter(n=>typeof n[1]=="object"&&n[1]!==null)}function aa(o){return typeof o=="number"&&Number.isFinite(o)&&o>=0?Math.floor(o):null}function ra(o){let e={};for(let[a,n]of nn(o,"porCaminho")){if(typeof n.nome!="string"||n.nome.length===0)continue;let t=aa(n.w),r=aa(n.h);e[a]={nome:n.nome,...t&&r?{w:t,h:r}:{}}}return{schema:1,porCaminho:e}}function Bt(o,e,a){return{schema:1,porCaminho:{...o.porCaminho,[e]:a}}}var Tc=o=>o.split(/[\\/]/).pop()??o,Sc=o=>/\.[^.\\/]+$/.exec(o)?.[0]??"";function kc(o,e){let a=0;for(let n of o){if(Qo(n)!==e)continue;let t=/\((\d+)\)\s*\.[^.]+$/.exec(n)?.[1];a=Math.max(a,t===void 0?1:Number(t))}return a+1}function Qt(o,e,a){let n=[...e],t=[],r=[],i=new Map,s=new Set;for(let c of o){if(s.has(c.caminho))continue;s.add(c.caminho);let l=Tc(c.caminho),m=a.porCaminho[c.caminho];if(m!==void 0){n.includes(m.nome)&&i.set(c.caminho,m.nome);continue}let d=Qo(c.nomeNoProjeto);if(d.length===0||d===Qo(l)||/[\\/:*?"<>|]/.test(d)){r.push(l);continue}let u=`${d} (${kc(n,d)})${Sc(l)}`;n.push(u),t.push({caminho:c.caminho,nome:u})}return{copiar:t,semNome:r,jaNaPasta:i}}function rn(o){if(typeof o!="object"||o===null)return null;let e=o;if(typeof e.version!="string"||e.version.length===0)return null;let a=_o(e.aprendizado),n=Co(e.ligacoes),t=Bo(o);return{schema:1,version:e.version,aprendizado:{pares:a.pares,arquivos:a.arquivos},ligacoes:{pares:n.pares},sinonimos:t??new Map}}var tn={acertos:0,erros:0};function _t(o,e,a){let n={};for(let t of new Set([...Object.keys(o),...Object.keys(e)])){let r=o[t]??tn,i=e[t]??tn,s=a[t]??tn,c=en({acertos:r.acertos+Math.max(0,i.acertos-s.acertos),erros:r.erros+Math.max(0,i.erros-s.erros)});n[t]={acertos:Math.max(r.acertos,c.acertos),erros:Math.max(r.erros,c.erros)}}return n}function Mc(o,e,a){let n={};for(let t of new Set([...Object.keys(o),...Object.keys(e)]))n[t]=(o[t]??0)+Math.max(0,(e[t]??0)-(a[t]??0));return n}function Cc(o,e){let a=new Map(e);for(let[n,t]of o)a.set(n,t);return a}function Ut(o,e,a){return{memoria:{schema:3,pares:_t(e.aprendizado.pares,o.memoria.pares,a?.aprendizado.pares??{}),arquivos:_t(e.aprendizado.arquivos,o.memoria.arquivos,a?.aprendizado.arquivos??{}),vistos:o.memoria.vistos},associacoes:{schema:1,pares:Mc(e.ligacoes.pares,o.associacoes.pares,a?.ligacoes.pares??{})},sinonimos:Cc(e.sinonimos,o.sinonimos)}}function Ht(o){let e=o.filter(t=>t!==null);if(e.length===0)return o.map(()=>null);if(e.length===1)return o.map(t=>t===null?null:.5);let a=[...e].sort((t,r)=>t-r),n=a.length-1;return o.map(t=>t===null?null:a.indexOf(t)/n)}function Gt(o,e,a){let n=[];return o.forEach((t,r)=>{(t===null||Math.abs(t-e)<=a)&&n.push(r)}),n}function me(o,e){return e>0?o/e:0}var ia={schema:1,arquivos:{}};function Jt(o,e){return e.filter(a=>!(a in o.arquivos))}function Wt(o,e,a){return{schema:1,arquivos:{...o.arquivos,[e]:a}}}function sa(o){if(typeof o!="object"||o===null)return ia;let e=o.arquivos;if(typeof e!="object"||e===null)return ia;let a={};for(let[n,t]of Object.entries(e))t===null?a[n]=null:typeof t=="number"&&Number.isFinite(t)&&t>=0&&(a[n]=t);return{schema:1,arquivos:a}}var pe={duracaoMinima:1.5,duracaoMaxima:4,intervaloMinimo:2,scoreMinimo:.6,janelaSemRepetir:60,janelaMesmoArquivo:180,antecipacao:.3,toleranciaIntensidade:.35,ateOProximo:!1},ca={...pe,duracaoMinima:1.2,duracaoMaxima:3,intervaloMinimo:0,janelaSemRepetir:8,ateOProximo:!0};function Xt(o,e){for(let a of o.termosNoTempo)if(e.some(n=>Ne(n,a.termo)))return a.inicio;for(let a of o.termosNoTempo)if(e.some(n=>ce(n,[a.termo])))return a.inicio;return o.inicio}var $c=1.5;function qc(o,e){if(e.length<2)return 0;let a=e.map(r=>o.termosNoTempo.filter(i=>Ne(r,i.termo)||ce(r,[i.termo])).map(i=>i.inicio));if(a.some(r=>r.length===0))return null;let n=a[0];if(n===void 0)return null;let t=Number.POSITIVE_INFINITY;for(let r of n){let i=0;for(let s of a.slice(1)){let c=Math.min(...s.map(l=>Math.abs(l-r)));i=Math.max(i,c)}t=Math.min(t,i)}return t}function la(o,e,a=pe,n=Rt,t,r=[]){let i=[],s=[],c=t?[...t.ritmoDasFrases].sort((p,f)=>p-f):[],l=[];for(let p of o){if(p.frase.duracao<a.duracaoMinima){s.push(`${j(p.frase.inicio)} frase curta demais (${p.frase.duracao.toFixed(1)}s)`);continue}let f=!1,y=null;for(let b of p.sugestoes){let P=qc(p.frase,b.termosCasados);if(P!==null&&P>$c){s.push(`${j(p.frase.inicio)} ${b.conceito.rotulo}: palavras a ${P.toFixed(1)}s uma da outra, falam de coisas diferentes`);continue}let T=Nt(n,b.conceito.rotulo,b.termosCasados),M=b.score*T;y=Math.max(y??0,M),!(M<a.scoreMinimo)&&(f=!0,l.push({frase:p.frase,conceito:b.conceito.rotulo,arquivos:b.conceito.arquivos,score:M,motivo:T===1?b.motivo:`${b.motivo} \xB7 aprendizado ${Oc(T)}`,termosCasados:b.termosCasados,palavraEm:Xt(p.frase,b.termosCasados),ancoraEm:Math.max(p.frase.inicio,Xt(p.frase,b.termosCasados)-a.antecipacao)}))}if(!f){let b=p.sugestoes[0]?.score,P=b!==void 0&&y!==null&&y<b-.005;s.push(P?`${j(p.frase.inicio)} nenhuma sugestao passou (melhor: ${sn(b)}, caiu para ${sn(y??0)} pelo aprendizado)`:`${j(p.frase.inicio)} nenhuma sugestao passou (melhor: ${sn(b)})`)}}l.sort((p,f)=>p.ancoraEm!==f.ancoraEm?p.ancoraEm-f.ancoraEm:f.score-p.score);let m=new Map,d=new Map,u=new Map,g=Number.NEGATIVE_INFINITY;for(let p of r)p.arquivo!==void 0&&(m.set(p.arquivo,Math.max(p.inicio,m.get(p.arquivo)??p.inicio)),d.set(p.arquivo,(d.get(p.arquivo)??0)+1)),p.conceito!==void 0&&u.set(p.conceito,Math.max(p.inicio,u.get(p.conceito)??p.inicio));for(let p of l){let f=`${j(p.ancoraEm)} ${p.conceito}`,y=i[i.length-1],b=a.ateOProximo&&y!==void 0&&p.ancoraEm<g&&p.ancoraEm-y.inicio>=a.duracaoMinima;if(!b&&p.ancoraEm<g+a.intervaloMinimo){s.push(`${f}: muito perto do B-roll anterior`);continue}let P=u.get(p.conceito);if(P!==void 0&&Math.abs(p.ancoraEm-P)<a.janelaSemRepetir){s.push(`${f}: conceito repetido ha menos de ${a.janelaSemRepetir}s`);continue}let T=N=>d.get(N)??0,M=Math.min(...p.arquivos.map(T)),w=p.arquivos.filter(N=>T(N)===M),S=M===0?w:w.filter(N=>Math.abs(p.ancoraEm-(m.get(N)??0))>=a.janelaMesmoArquivo),h=Ic(S,p.frase,t,a,c),E=Lt(n,h.arquivos);if(E===void 0){s.push(`${f}: todas as variacoes apareceram ha menos de ${a.janelaMesmoArquivo}s`);continue}let q=E!==S[0],x=e.caminhos.get(E);if(x===void 0){s.push(`${f}: ${E} nao esta na pasta`);continue}let R=a.ateOProximo?p.frase.fimDaFala??p.frase.fim:p.frase.fim,A=Math.max(0,R-p.ancoraEm);if(A<a.duracaoMinima){s.push(`${f}: sobra so ${A.toFixed(1)}s ate o fim da ${a.ateOProximo?"fala":"frase"}`);continue}let $=Math.min(a.duracaoMaxima,A);b&&(i[i.length-1]={...y,duracao:p.ancoraEm-y.inicio}),i.push({arquivo:E,caminho:x,conceito:p.conceito,score:p.score,motivo:Nc(p.motivo,q,h.rotulo,M),termosCasados:p.termosCasados,textoDaFrase:p.frase.texto,ancoradoEm:p.palavraEm,inicio:p.ancoraEm,duracao:$}),m.set(E,p.ancoraEm),d.set(E,T(E)+1),u.set(p.conceito,p.ancoraEm),g=p.ancoraEm+$}return{colocacoes:i,descartes:s}}function Ic(o,e,a,n,t){if(a===void 0||o.length<2||t.length<2)return{arquivos:o,rotulo:null};let r=me(e.palavras,e.duracao),i=t.indexOf(Rc(t,r))/(t.length-1),s=Ht(o.map(l=>a.porArquivo.get(l)??null)),c=Gt(s,i,n.toleranciaIntensidade);return c.length===0?{arquivos:o,rotulo:null}:{arquivos:c.map(l=>o[l]).filter(l=>l!==void 0),rotulo:i>=.5?"take agitado, a fala corre aqui":"take parado, momento calmo"}}function Rc(o,e){let a=o[0]??0;for(let n of o)Math.abs(n-e)<Math.abs(a-e)&&(a=n);return a}function Nc(o,e,a,n=0){let t=o;return a!==null&&(t+=` \xB7 ${a}`),e&&(t+=" \xB7 outro take, o anterior foi apagado"),n>=1&&(t+=` \xB7 take repetido, ciclo ${n+1}`),t}var Kt=.05;function da(o,e){let a=[],n=[];for(let t of o){let r=t.inicio+t.duracao;if(e.some(s=>t.inicio<s.fim-Kt&&s.inicio<r-Kt)){n.push(`${j(t.inicio)} ${t.conceito}: ja ha B-roll ai, deixei como esta`);continue}a.push(t)}return{entram:a,bloqueadas:n}}function Oc(o){let e=Math.round((o-1)*100);return`${e>0?"+":""}${e}%`}function sn(o){return o===void 0?"nenhuma":`${Math.round(o*100)}%`}var Dc=new Set(["moov","trak","mdia","edts","minf","stbl"]),Fc=6;function Lc(o,e){return String.fromCharCode(o[e]??0,o[e+1]??0,o[e+2]??0,o[e+3]??0)}function Uo(o,e){return((o[e]??0)<<24|(o[e+1]??0)<<16|(o[e+2]??0)<<8|(o[e+3]??0))>>>0}function Zt(o,e,a){let n=[],t=e;for(;t+8<=a;){let r=Uo(o,t),i=Lc(o,t+4),s=t+8;if(r===1?(r=Uo(o,t+12),s=t+16):r===0&&(r=a-t),r<8||t+r>a)return null;n.push({tipo:i,conteudo:s,fim:t+r}),t+=r}return n}function ua(o,e,a,n,t=0){if(t>Fc)return null;let r=Zt(o,e,a);if(r===null)return null;for(let i of r){if(i.tipo===n)return i;if(Dc.has(i.tipo)){let s=ua(o,i.conteudo,i.fim,n,t+1);if(s)return s}}return null}function or(o){let e=ua(o,0,o.length,"moov");if(!e)return null;let a=Zt(o,e.conteudo,e.fim);if(a===null)return null;for(let n of a){if(n.tipo!=="trak")continue;let t=ua(o,n.conteudo,n.fim,"tkhd");if(!t)continue;let r=jc(o,t.conteudo);if(!r)continue;let i=ua(o,n.conteudo,n.fim,"stsz");return{tamanho:r,amostras:i?zc(o,i.conteudo,i.fim):null}}return null}function er(o){return or(o)?.tamanho??null}function ar(o){let e=or(o);if(!e?.amostras||e.amostras.length===0)return null;let a=e.tamanho.width*e.tamanho.height;return a<=0?null:e.amostras.reduce((t,r)=>t+r,0)/e.amostras.length/a}function zc(o,e,a){if(e+12>a||Uo(o,e+4)!==0)return null;let t=Uo(o,e+8);if(t===0)return null;let r=[],i=e+12;for(let s=0;s<t;s++){if(i+4>a)return null;r.push(Uo(o,i)),i+=4}return r}function jc(o,e){let n=(o[e]??0)===1?32:20,t=e+4+n+52;if(t+8>o.length)return null;let r=Uo(o,t)>>>16,i=Uo(o,t+4)>>>16;return r>0&&i>0?{width:r,height:i}:null}var mo=ro("premierepro"),$o=ro("uxp");async function I(o,e,a=15e3){let n;try{return await Promise.race([e,new Promise((t,r)=>{n=setTimeout(()=>r(new Error(`${o}: sem resposta em ${a/1e3}s`)),a)})])}finally{n!==void 0&&clearTimeout(n)}}async function wo(){let o=await mo.Project.getActiveProject();if(!o)throw new Error("Nenhum projeto aberto.");let e=await o.getActiveSequence();if(!e)throw new Error("Nenhuma sequencia ativa. Abra uma sequencia na timeline.");return{project:o,sequence:e,rootItem:await o.getRootItem()}}function Q(o,e,a){let n=null;if(o.lockedAccess(()=>{try{o.executeTransaction(t=>{a(r=>t.addAction(r))},e)}catch(t){let r=t;n=`${r?.name??"Erro"}: ${r?.message??String(t)}`}}),n!==null)throw new Error(n)}var cn=1;async function Vc(o){for(let e of["getVideoFrameRate","getFrameRate"]){let a=o[e];if(typeof a=="function"){let n=await a.call(o);return typeof n=="number"?n:n?.value??0}}for(let e of["videoFrameRate","frameRate"]){let a=o[e];if(a!==void 0)return typeof a=="number"?a:a?.value??0}return console.log("[auto-broll] settings sem taxa de quadros conhecida; chaves:",Object.keys(o),Object.getOwnPropertyNames(Object.getPrototypeOf(o??{}))),0}async function no(){let{sequence:o}=await wo(),e=o,a=await e.getSettings(),n=await a.getVideoFrameRect(),t=await Vc(a);return{name:e.name,width:n?.width??0,height:n?.height??0,fps:t,videoTracks:await e.getVideoTrackCount(),audioTracks:await e.getAudioTrackCount(),durationSeconds:(await e.getEndTime())?.seconds??0}}async function nr(){try{let{sequence:o}=await wo(),e=o;if(typeof e.getInPoint!="function"||typeof e.getOutPoint!="function")return null;let a=(await e.getInPoint())?.seconds,n=(await e.getOutPoint())?.seconds;return typeof a!="number"||typeof n!="number"?null:{inicio:a,fim:n}}catch{return null}}async function ma(o){let e=await $o.storage.localFileSystem.getEntryWithUrl(ho(o));if(!e)throw new Error(`Pasta nao encontrada: ${o}`);if(e.isFolder===!1)throw new Error(`Isto e um arquivo, nao uma pasta: ${o}`);if(typeof e.getEntries!="function")throw new Error("Sem permissao para ler a pasta. Confira localFileSystem no manifest.");let a=[],n=new Set,t=async(r,i)=>{for(let s of await r.getEntries()){if(s.isFolder){i<1&&await t(s,i+1);continue}!Mo(s.name)||n.has(s.name)||(n.add(s.name),a.push({name:s.name,nativePath:s.nativePath}))}};return await t(e,0),a.sort((r,i)=>r.name.localeCompare(i.name,"pt-BR")),a}async function tr(o){return(await rr(o)).split(/[\\/]/).pop()||(o.name??"")}async function rr(o){try{return String(await mo.ClipProjectItem.cast(o)?.getMediaFilePath()??"")}catch{return""}}async function ln(o=0,e=!1){let{sequence:a}=await wo(),t=await a.getVideoTrack(o),r=[],i=new Map;for(let s of await t.getTrackItems(cn,!1)){let c=await s.getProjectItem();if(!c?.name)continue;let l=await s.getSpeed();e&&!i.has(c.name)&&i.set(c.name,await rr(c));let m=i.get(c.name)??"";r.push({sourceName:e&&m.split(/[\\/]/).pop()||c.name,...e?{caminho:m,nomeNoProjeto:c.name}:{},startSeconds:(await s.getStartTime()).seconds,endSeconds:(await s.getEndTime()).seconds,inPointSeconds:(await s.getInPoint()).seconds,outPointSeconds:(await s.getOutPoint()).seconds,speed:l>0?l:1})}return r}async function qo(){let{sequence:o}=await wo(),e=await o.getVideoTrackCount(),a=[];for(let n=1;n<e;n++)try{for(let t of await ln(n,!0))a.push({sourceName:t.sourceName,caminho:t.caminho??"",nomeNoProjeto:t.nomeNoProjeto??t.sourceName,startSeconds:t.startSeconds,endSeconds:t.endSeconds,videoTrackIndex:n})}catch{}return a}async function pa(o){let e=await o.getItems(),a=[];for(let n of e){let t=mo.FolderItem.cast(n);t?a.push(...await pa(t)):a.push(n)}return a}async function fa(o){let{rootItem:e}=await wo(),n=await pa(e),t=new Map,r=[];for(let i of new Set(o)){let s=n.find(c=>c.name===i);if(!s){r.push({nome:i,motivo:"nao encontrado no painel de Projeto (nome nao bate?)"});continue}try{let c=mo.ClipProjectItem.cast(s);if(!c){r.push({nome:i,motivo:"nao e um ClipProjectItem (bin ou sequencia?)"});continue}let l=await mo.Transcript.exportToJSON(c);l&&t.set(i,l)}catch(c){r.push({nome:i,motivo:c?.message??String(c)})}}return{transcricoes:t,falhas:r}}async function dn(o){try{let e=await $o.storage.localFileSystem.getEntryWithUrl(ho(o));if(!e)return null;let a=await e.read({format:$o.storage.formats.binary});return er(new Uint8Array(a))}catch{return null}}async function ir(o,e,a){let n=$o.storage.localFileSystem,t=await n.getEntryWithUrl(ho(o));if(!t?.copyTo||t.isFolder)throw new Error(`arquivo nao encontrado: ${o}`);let r=await n.getEntryWithUrl(ho(e));if(!r?.isFolder)throw new Error(`pasta de B-rolls nao encontrada: ${e}`);let i=await t.copyTo(await n.getDataFolder(),{overwrite:!0});if(!i.moveTo)throw new Error("a copia nao voltou como arquivo");await i.moveTo(r,{newName:a})}async function ga(o,e,a){let n=Jt(e,o.map(s=>s.name));if(n.length===0)return e;let t=new Map(o.map(s=>[s.name,s.nativePath])),r=e,i=0;for(let s of n){let c=t.get(s),l=null;if(c!==void 0)try{let m=await $o.storage.localFileSystem.getEntryWithUrl(ho(c));if(m){let d=await m.read({format:$o.storage.formats.binary});l=ar(new Uint8Array(d))}}catch{}r=Wt(r,s,l),i++,(i%25===0||i===n.length)&&a(i,n.length)}return r}async function ha(o,e){let a=[],n=[];if(o.length===0)return{inseridos:0,passos:a,avisos:n};{let{project:t,rootItem:r}=await wo(),i=r,s=new Set((await i.getItems()).map(l=>l.name)),c=o.filter(l=>!s.has(l.arquivo));if(c.length>0&&!await t.importFiles(c.map(d=>d.caminho),!0,r,!1))throw new Error("Premiere recusou importar os B-rolls.");a.push(`${c.length} importados, ${o.length-c.length} ja no projeto`)}{let{project:t,sequence:r,rootItem:i}=await wo(),c=await i.getItems(),l=await mo.SequenceEditor.getEditor(r),m=[];for(let d of o){let u=c.find(g=>g.name===d.arquivo);if(!u){n.push(`${d.arquivo} nao apareceu no projeto apos importar.`);continue}m.push({item:u,at:await mo.TickTime.createWithSeconds(d.inicio)})}if(m.length===0)throw new Error("Nenhum B-roll pronto para inserir.");Q(t,`B-Roller: inserir ${m.length} B-rolls`,d=>{for(let u of m)d(l.createOverwriteItemAction(u.item,u.at,e.videoTrackIndex,e.audioTrackIndex))}),a.push(`${m.length} inseridos em ${At("V",e.videoTrackIndex)}`)}{let{project:t,sequence:r}=await wo(),i=r,c=await(await i.getVideoTrack(e.videoTrackIndex)).getTrackItems(cn,!1),l=e.preencherTela?await(await i.getSettings()).getVideoFrameRect():null,m=[],d=0;for(let u of o){let g=await Yc(c,u);if(!g)continue;d++;let p=await mo.TickTime.createWithSeconds(u.inicio+u.duracao);if(m.push(()=>g.createSetEndAction(p)),l!==null){let f=await Bc(g),y=f?await dn(u.caminho):null;if(f&&y){let b=wt(y,l);m.push(()=>f.createSetValueAction(f.createKeyframe(b),!0))}else y||n.push(`${u.arquivo}: resolucao indisponivel, sem escala.`)}}m.length>0&&(Q(t,"B-Roller: ajustar duracao e escala",u=>{for(let g of m)u(g())}),a.push(`${d} ajustados (duracao${e.preencherTela?" e escala":""})`))}if(e.removerAudio){let{project:t,sequence:r}=await wo(),s=await(await r.getAudioTrack(e.audioTrackIndex)).getTrackItems(cn,!1),c=new Set(o.map(m=>m.arquivo)),l=[];for(let m of s)c.has(await m.getName())&&l.push(m);if(l.length>0){let m=await mo.SequenceEditor.getEditor(r);Q(t,"B-Roller: remover audio",d=>{let u=null;if(mo.TrackItemSelection.createEmptySelection(p=>{u=p}),!u)throw new Error("createEmptySelection nao devolveu selecao");let g=u;for(let p of l)g.addItem(p,!1);d(m.createRemoveItemsAction(g,!1,mo.Constants.MediaType.AUDIO,!1))}),a.push(`audio removido de ${l.length} B-rolls`)}}return{inseridos:o.length,passos:a,avisos:n}}async function Yc(o,e){for(let a of o)if(await a.getName()===e.arquivo&&Math.abs((await a.getStartTime()).seconds-e.inicio)<.5)return a;return null}async function Bc(o){let e=await o.getComponentChain();for(let a=0;a<e.getComponentCount();a++){let n=e.getComponentAtIndex(a);if(await n.getMatchName()==="AE.ADBE Motion")for(let t=0;t<n.getParamCount();t++){let r=n.getParam(t);if(r.displayName==="Scale")return r}}return null}async function z(o){try{let a=await(await $o.storage.localFileSystem.getDataFolder()).getEntry(o);return JSON.parse(await a.read())}catch{return null}}async function F(o,e){await(await(await $o.storage.localFileSystem.getDataFolder()).createFile(o,{overwrite:!0})).write(JSON.stringify(e,null,2))}var pr="config.json",De="aprendizado.json",un="pendentes.json",sr="intensidade.json",ge="ligacoes.json",Io="sinonimos.json",cr="aprendizado-canonico.json",lr="aprendizado-canonico.base.json",Qc="ultimo-log.json",_c="ultimo-aprendizado.json",dr="trazidos.json";function V(o){let e=document.getElementById(o);if(!e)throw new Error(`elemento ausente no HTML: #${o}`);return e}var he,mn=[];function L(o,e="passo"){mn.push(o);let a=document.createElement("div");a.className=`l-${e}`,a.textContent=o,he.appendChild(a),he.scrollTop=he.scrollHeight}function fr(){mn=[],he.textContent=""}async function gr(o){try{let e=await z(o),a=Array.isArray(e?.execucoes)?e.execucoes:[],n=[{quando:new Date().toISOString(),linhas:mn},...a].slice(0,10);await F(o,{execucoes:n})}catch{}}function X(o,e=""){let a=V("estado");a.textContent=o,a.setAttribute("data-tom",e)}var ur="Analisar e inserir",Uc="Aprender";function fe(o,e,a){if(!a())return;let n=document.getElementById(o);n&&(n.textContent=e)}function bo(o){return o?.message??String(o)}var Ho=class extends Error{};function to(o){if(!o())throw new Ho}function hr(){return{schema:1,videoTrackIndex:uo.videoTrackIndex,audioTrackIndex:uo.audioTrackIndex,removeAudio:V("removeAudio").checked,fillScreen:V("fillScreen").checked,densidadeMaxima:V("densidadeMaxima").checked,libraryPath:V("libraryPath").value.trim()}}function mr(o){V("removeAudio").checked=o.removeAudio,V("fillScreen").checked=o.fillScreen,V("densidadeMaxima").checked=o.densidadeMaxima,V("libraryPath").value=o.libraryPath}function br(o){let e=V("seqNome");e.textContent=o.name,e.setAttribute("data-vazio","nao"),V("seqDica").style.display="none",V("seqFormato").textContent=`${o.width}x${o.height}`,V("seqFps").textContent=o.fps.toFixed(3).replace(".",","),V("seqDuracao").textContent=Pt(o.durationSeconds,o.fps),V("seqFaixas").textContent=`${o.videoTracks}V \xB7 ${o.audioTracks}A`}async function Hc(o){X("lendo","ativo");try{let e=await I("ler sequencia",no());if(!o())return;br(e),X("pronto","ok")}catch(e){if(!o())return;let a=V("seqNome");a.textContent="Nenhuma sequ\xEAncia selecionada",a.setAttribute("data-vazio","sim"),V("seqDica").style.display="";for(let n of["seqFormato","seqFps","seqDuracao","seqFaixas"])V(n).textContent="\u2014";X("sem sequ\xEAncia","aviso"),L(bo(e),"erro")}}async function xr(o,e,a,n,t){let r=_o(await I("ler aprendizado",z(De),5e3)),i=ta(await I("ler pendentes",z(un),5e3)),s=i.porSequencia[o];try{let c=await I("ler B-rolls da timeline",qo(),3e4),l=[],m=new Set(n.nomes),d=ra(await I("ler trazidos",z(dr),5e3).catch(()=>null)),u=Qt(c.filter(h=>h.caminho!==""&&Mo(h.sourceName)&&!m.has(h.sourceName)).map(h=>({caminho:h.caminho,nomeNoProjeto:h.nomeNoProjeto})),n.nomes,d),g=new Map(u.jaNaPasta),p=[];if(t){let h=d;for(let E of u.copiar){let q=E.caminho.split(/[\\/]/).pop()??E.caminho;try{await I(`copiar ${E.nome}`,ir(E.caminho,n.pasta,E.nome),6e5);let x=await I(`medir ${E.nome}`,dn(E.caminho),12e4).catch(()=>null);h=Bt(h,E.caminho,{nome:E.nome,...x?{w:x.width,h:x.height}:{}}),g.set(E.caminho,E.nome),p.push(E.nome),l.push({texto:`Levei "${q}" para a pasta de B-rolls como "${E.nome}".`,tipo:"ok"})}catch(x){l.push({texto:`Nao consegui levar "${q}" para a pasta: ${bo(x)}`,tipo:"aviso"})}}h!==d&&await F(dr,h),u.semNome.length>0&&l.push({texto:`${u.semNome.length} clipe(s) de fora da pasta sem nome de conceito: ${u.semNome.join(", ")}. Renomeie no painel Projeto (ex.: "Mulher triste") e clique em Aprender de novo.`,tipo:"aviso"})}let f=h=>g.get(h.caminho)??h.sourceName,y=p.length>0?oa([...n.nomes,...p]):a,b=new Set(c.map(h=>h.sourceName)),P=c.filter(h=>Mo(h.sourceName)).filter(h=>!Yt({arquivo:h.sourceName,inicio:h.startSeconds},s)).map(h=>({arquivo:f(h),inicio:h.startSeconds,fim:h.endSeconds})),T=(s?.itens??[]).some(h=>!b.has(h.arquivo)),M=s!==void 0&&!T&&P.length===0,w=r,S=i;if(M)l.push({texto:"Nada mudou na timeline desde a ultima analise: nao havia o que aprender.",tipo:"aviso"});else{if(s!==void 0&&s.itens.length>0){let h=jt(s.itens,c.map(E=>({arquivo:E.sourceName,inicio:E.startSeconds})),b);if(Vt(s.itens.length,h))S=de(i,o,null),l.push({texto:`Sobrou ${h} de ${s.itens.length} B-rolls da rodada anterior \u2014 parece o lote desfeito, nao rejeicao item a item. Nao contei como erro.`,tipo:"aviso"});else{let E=Ot(w,s,b);w=E.memoria,S=de(i,o,null),l.push({texto:`Aprendi da rodada anterior: voce manteve ${E.acertos} e apagou ${E.erros}.`,tipo:"ok"})}}if(P.length>0){let h=Co(await I("ler ligacoes",z(ge),5e3)),E=Ft(w,o,P,e,y,h);if(w=E.memoria,E.associacoes!==h){await F(ge,E.associacoes);let x=ue(E.associacoes);for(let[R,A]of x)ue(h).has(R)||l.push({texto:`Aprendi que "${A.join(", ")}" pede "${R}" \u2014 voce ligou os dois ${an} vezes.`,tipo:"ok"})}let q=[`${E.creditados} aprendidos`];E.jaContados>0&&q.push(`${E.jaContados} ja contados antes`),E.foraDaBiblioteca>0&&q.push(`${E.foraDaBiblioteca} fora da pasta de B-rolls`),E.semFala>0&&q.push(`${E.semFala} sobre silencio`),E.semLigacao.length>0&&q.push(`${E.semLigacao.length} sem ligacao no dicionario`),l.push({texto:`Voce colocou ${P.length} por conta propria: ${q.join(", ")}.`,tipo:E.creditados>0?"ok":"aviso"});for(let x of E.semLigacao)l.push({texto:x,tipo:"aviso"})}}return await F(De,w),S!==i&&await F(un,S),l.length===0&&l.push({texto:"Nada novo para aprender: nenhum plano pendente e nenhum B-roll seu na timeline.",tipo:"aviso"}),{memoria:w,pendentes:S,resumo:l,ocupado:c.map(h=>({inicio:h.startSeconds,fim:h.endSeconds,arquivo:f(h),conceito:Qo(f(h))}))}}catch(c){throw new Error(`Nao consegui ler a timeline: ${bo(c)}`)}}function Gc(o,e=70){return o.length<=e?o:`${o.slice(0,e)}...`}async function vr(o){let e=V("libraryPath").value.trim();if(!e)throw new Error("Informe a pasta de B-rolls.");let a=await I("listar pasta de B-rolls",ma(e),3e4);if(to(o),a.length===0)throw new Error(`Nenhum video em ${e}.`);L(`${a.length} B-rolls na pasta`,"passo"),F(pr,hr()).catch(()=>{});let n=await I("ler clipes de V1",ln(0),3e4);if(to(o),n.length===0)throw new Error("V1 esta vazia. Nao ha o que analisar.");L(`${n.length} clipes em V1`,"passo");let t=[...new Set(n.map(d=>d.sourceName))],{transcricoes:r,falhas:i}=await I("ler transcricoes",fa(t),6e4);to(o),L(`${r.size} de ${t.length} midias com transcricao`,"passo");for(let d of i)L(`"${d.nome}": ${d.motivo}`,"aviso");let s=await I("ler sequencia",no());to(o),br(s);let c=s.name,l=ue(Co(await I("ler ligacoes",z(ge),5e3)));to(o),l.size>0&&L(`${l.size} conceitos com ligacao que voce ensinou`,"passo");let m=$t({clipes:n,transcricoesJson:r,biblioteca:a.map(d=>d.name),ligacoes:l});return L(`${m.palavras} palavras \xB7 ${m.frases.length} frases \xB7 ${m.conceitos.length} conceitos`,"passo"),{pasta:e,arquivos:a,resultado:m,nomeSequencia:c,duracaoDaSequencia:s.durationSeconds}}async function Jc(o){let e=V("aprender");e.disabled=!0,fe("aprender","Aprendendo...",o),X("aprendendo","ativo"),fr();let a=[];try{let{pasta:n,arquivos:t,resultado:r,nomeSequencia:i}=await vr(o),s={pasta:n,nomes:t.map(l=>l.name)},{resumo:c}=await xr(i,r.frases,r.conceitos,s,!0);to(o),a=c,L("Aprendizado gravado. Nada foi inserido na timeline.","ok"),X("pronto","ok")}catch(n){n instanceof Ho||(L(bo(n),"erro"),X("falhou","erro"))}finally{if(o())for(let n of a)L(n.texto,n.tipo);fe("aprender",Uc,o),e.disabled=!1,await gr(_c)}}async function Wc(o){let e=V("analisar");e.disabled=!0,fe("analisar","Analisando...",o),X("analisando","ativo"),fr();let a=[],n=0;try{let t=hr(),{pasta:r,arquivos:i,resultado:s,nomeSequencia:c,duracaoDaSequencia:l}=await vr(o);for(let x of s.avisos.slice(0,6))L(x,"aviso");let m=await I("ler in/out",nr(),5e3);to(o);let d=m===null?null:Et(m.inicio,m.fim,l);d!==null&&L(`In/out marcados: inserindo so de ${j(d.inicio)} a ${j(d.fim)}. Para a sequencia inteira, limpe o in/out.`,"passo");let{memoria:u,pendentes:g,resumo:p,ocupado:f}=await xr(c,s.frases,s.conceitos,{pasta:r,nomes:i.map(x=>x.name)},!1);to(o),a=p;let y=d===null?s.oportunidades:s.oportunidades.filter(x=>x.frase.fim>d.inicio&&x.frase.inicio<d.fim);if(y.length===0){L(d===null?"Nenhuma oportunidade de B-roll encontrada.":"Nenhuma oportunidade de B-roll no trecho marcado.","vazio"),X("nada a inserir","ok");return}to(o);let b=sa(await I("ler intensidade",z(sr),5e3));to(o);let P=b;try{P=await I("medir intensidade",ga(i,b,(x,R)=>{o()&&L(`  medindo intensidade: ${x} de ${R}`,"passo")}),3e5),to(o),P!==b&&await F(sr,P)}catch(x){if(x instanceof Ho)throw x;L(`Intensidade nao medida, seguindo sem ela. ${bo(x)}`,"aviso"),P=ia}let T=new Map;for(let[x,R]of Object.entries(P.arquivos))R!==null&&T.set(x,R);let M=d===null?[]:f.filter(x=>x.fim<=d.inicio||x.inicio>=d.fim),w=la(y,{caminhos:new Map(i.map(x=>[x.name,x.nativePath]))},t.densidadeMaxima?ca:pe,u,{porArquivo:T,ritmoDasFrases:s.frases.map(x=>me(x.palavras,x.duracao))},M);F("frases.json",{quando:new Date().toISOString(),sequencia:c,frases:s.frases.map(x=>({inicio:Number(x.inicio.toFixed(2)),fim:Number(x.fim.toFixed(2)),texto:x.texto}))}).catch(()=>{});for(let x of w.descartes)L(`  ${x}`,"vazio");let S=w.colocacoes;if(d!==null){for(let x of S.filter(R=>R.inicio<d.inicio||R.inicio>=d.fim))L(`  ${j(x.inicio)} ${x.conceito}: fora do trecho marcado`,"vazio");S=S.filter(x=>x.inicio>=d.inicio&&x.inicio<d.fim)}let{entram:h,bloqueadas:E}=da(S,f);for(let x of E)L(`  ${x}`,"vazio");if(h.length===0&&E.length>0){L("Tudo o que eu sugeriria ja esta na timeline. Nada a fazer.","ok"),X("nada a inserir","ok");return}if(h.length===0){L("Nenhuma sugestao boa o bastante para entrar sozinha.","aviso"),X("nada a inserir","ok");return}L(`${h.length} B-rolls a inserir:`,"ok");for(let x of h)L(`${j(x.inicio)}  ${x.arquivo}  ${x.duracao.toFixed(1)}s \xB7 ${Math.round(x.score*100)}% \xB7 ${x.motivo}`,"passo"),L(`        "${Gc(x.textoDaFrase)}"`,"vazio");X("inserindo","ativo");let q=await I("inserir plano",ha(h,{videoTrackIndex:t.videoTrackIndex,audioTrackIndex:t.audioTrackIndex,removerAudio:t.removeAudio,preencherTela:t.fillScreen}),12e4);to(o),n=h.length;for(let x of q.passos)L(`  ${x}`,"ok");for(let x of q.avisos)L(`  ${x}`,"aviso");L("Tres Ctrl+Z desfazem tudo.","vazio");try{await F(un,de(g,c,{quando:new Date().toISOString(),itens:h.map(x=>({arquivo:x.arquivo,conceito:x.conceito,termosCasados:x.termosCasados,inicio:x.inicio}))})),to(o),L("Apague os que nao serviram: a proxima analise aprende com isso.","vazio")}catch(x){if(x instanceof Ho)throw x;L(`Plano nao ficou guardado, esta rodada nao vai ensinar nada. ${bo(x)}`,"aviso")}X("pronto","ok")}catch(t){t instanceof Ho||(L(bo(t),"erro"),X("falhou","erro"))}finally{if(o())for(let t of a)L(t.texto,t.tipo);n>0?(fe("analisar",`\u2713 ${n} B-rolls inseridos`,o),setTimeout(()=>fe("analisar",ur,o),2500)):fe("analisar",ur,o),e.disabled=!1,await gr(Qc)}}async function Xc(o){try{let e=await I("ler canonico",z(cr),5e3);if(!o()||e===null)return;let a=rn(e);if(a===null){L(`${cr} ilegivel: merge ignorado, aprendizado local intacto.`,"aviso");return}let n=rn(await I("ler base do canonico",z(lr),5e3));if(!o()||n!==null&&n.version===a.version)return;let t=_o(await I("ler aprendizado",z(De),5e3)),r=Co(await I("ler ligacoes",z(ge),5e3)),i=await I("ler sinonimos",z(Io),5e3),s=Bo(i);if(!o())return;let c=Ut({memoria:t,associacoes:r,sinonimos:s??se},a,n),l=new Date().toISOString().slice(0,10);await F(`${De}.bak-antes-merge-${l}`,t),await F(`${ge}.bak-antes-merge-${l}`,r),i!==null&&await F(`${Io}.bak-antes-merge-${l}`,i),await F(lr,e),await F(De,c.memoria),await F(ge,c.associacoes),await F(Io,Ka(c.sinonimos));let m=Object.keys(c.memoria.pares).length,d=Object.keys(c.memoria.arquivos).length,u=Object.keys(c.associacoes.pares).length;L(`Merge do aprendizado canonico v${a.version}: ${m} pares, ${d} arquivos, ${u} ligacoes.`,"ok")}catch(e){if(!o())return;L(`Merge do canonico falhou. ${bo(e)}`,"aviso")}}async function Kc(o){try{let e=await I("ler sinonimos",z(Io),5e3);if(!o())return;if(e===null){if(await F(Io,Ka(se)),!o())return;L(`Dicionario criado em ${Io}, na pasta de dados do plugin.`,"vazio");return}let a=Bo(e);if(a===null){L(`${Io} ilegivel: usando o dicionario padrao.`,"aviso");return}Ze(a),L(`Dicionario: ${a.size} entradas de ${Io}`,"vazio")}catch(e){if(!o())return;L(`Dicionario nao carregou, usando o padrao. ${bo(e)}`,"aviso")}}function Zc(o,e){o.addEventListener("click",e),o.addEventListener("keydown",a=>{let n=a.key;n!=="Enter"&&n!==" "||(a.preventDefault(),e())})}function ol(){let o=V("secaoLog"),e=V("logToggle"),a=o.getAttribute("data-aberto")!=="nao";o.setAttribute("data-aberto",a?"nao":"sim"),e.textContent=a?"Mostrar":"Recolher",e.setAttribute("aria-expanded",a?"false":"true"),e.setAttribute("aria-label",a?"Mostrar o registro":"Recolher o registro")}function yr(o){he=V("log");let e=he,a=()=>document.body.contains(e);X("ligando","ativo"),V("analisar").addEventListener("click",()=>{Wc(a)}),V("aprender").addEventListener("click",()=>{Jc(a)}),Zc(V("logToggle"),ol),mr(uo),X("pronto","ok"),L("Painel pronto.","vazio"),(async()=>{if(a()){try{let n=await I("ler configuracao",z(pr),5e3);if(!a())return;n!==null&&mr(Yo(n))}catch(n){if(!a())return;L(`Configuracao nao carregou, usando padrao. ${bo(n)}`,"aviso")}a()&&(await Xc(a),a()&&(await Kc(a),a()&&await Hc(a)))}})()}var wr=`<!DOCTYPE html>\r
<html lang="pt-BR">\r
  <head>\r
    <meta charset="utf-8" />\r
    <title>Captions</title>\r
    <!-- O build substitui esta marca pelo conteudo de styles.css.\r
         Folha de estilo externa nao carrega no UXP: o caminho relativo e\r
         resolvido a partir da raiz do plugin e falha em silencio. -->\r
    <!--ESTILOS-->\r
  </head>\r
  <body>\r
    <header class="topo">\r
      <div class="marca">\r
        <span class="marca-nome">Captions</span>\r
      </div>\r
      <div id="estado" class="badge">carregando</div>\r
    </header>\r
\r
    <main class="conteudo">\r
      <section class="secao">\r
        <div class="secao-cabeca">\r
          <span class="cod">SEQ</span>\r
          <span class="secao-rotulo">Sequ\xEAncia ativa</span>\r
        </div>\r
        <div class="secao-corpo">\r
          <div id="seqNome" class="seq-nome" data-vazio="sim">Nenhuma sequ\xEAncia selecionada</div>\r
          <div id="seqDica" class="dica">\r
            Abra a sequ\xEAncia no Premiere e clique em Gerar legendas. O painel l\xEA a que estiver ativa na hora do clique.\r
          </div>\r
        </div>\r
      </section>\r
\r
      <section class="secao">\r
        <div class="secao-cabeca">\r
          <span class="cod">ASR</span>\r
          <span class="secao-rotulo">Quem ouve o \xE1udio</span>\r
        </div>\r
        <div class="secao-corpo">\r
          <sp-checkbox id="usarEleven" checked>Ouvir o \xE1udio com ElevenLabs (mais fiel)</sp-checkbox>\r
          <div id="chaveEstado" class="dica">Verificando a chave\u2026</div>\r
          <div class="linha-chave">\r
            <sp-textfield id="chave" class="campo-chave" placeholder="Colar a chave de API do ElevenLabs"></sp-textfield>\r
            <sp-button id="salvarChave" variant="secondary">Salvar chave</sp-button>\r
          </div>\r
          <div class="dica">\r
            Desmarcado, usa a transcri\xE7\xE3o do pr\xF3prio Premiere, como antes.\r
          </div>\r
        </div>\r
      </section>\r
\r
      <div class="acao">\r
        <sp-button id="gerar" variant="cta">Gerar legendas</sp-button>\r
        <sp-button id="restaurar" variant="secondary" quiet>Restaurar original</sp-button>\r
      </div>\r
\r
      <section id="secaoLog" class="secao secao-log" data-aberto="sim">\r
        <div class="secao-cabeca">\r
          <span class="cod">LOG</span>\r
          <span class="secao-rotulo">Registro</span>\r
          <div\r
            id="logToggle"\r
            class="secao-acao"\r
            role="button"\r
            tabindex="0"\r
            aria-expanded="true"\r
            aria-controls="log"\r
            aria-label="Recolher o registro"\r
          >\r
            Recolher\r
          </div>\r
        </div>\r
        <div class="secao-corpo">\r
          <div id="log" class="log"></div>\r
        </div>\r
      </section>\r
    </main>\r
\r
    <!-- O build substitui esta marca pelo bundle inteiro.\r
         Caminho relativo nao resolve no UXP. -->\r
    <!--SCRIPT-->\r
  </body>\r
</html>\r
`;var Er=`/*
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

/* ================================================================= CHAVE === */

/*
 * Campo da chave e botao na mesma linha, em flexbox (grid nao funciona no
 * UXP). O campo fica com o espaco que sobrar; em painel estreito o botao
 * desce para a linha de baixo em vez de espremer o campo.
 */
.linha-chave {
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
  align-items: center;
  flex: none;
  margin-top: 6px;
  margin-left: -4px;
  margin-right: -4px;
}

.linha-chave .campo-chave {
  flex: 1 1 160px;
  margin-left: 4px;
  margin-right: 4px;
  margin-bottom: 4px;
}

.linha-chave sp-button {
  flex: none;
  margin-left: 4px;
  margin-right: 4px;
  margin-bottom: 4px;
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
`;var pn="WAV_Mono_16bit_16kHz.epr";function Pr(o,e){let a=Number.parseInt(o,10),n=Number.isFinite(a)?`Adobe Premiere Pro ${2e3+a}`:"",t=e.filter(r=>r.startsWith("Adobe Premiere Pro")&&r!==n).sort().reverse();return[n,...t].filter(r=>r!=="").map(r=>`C:\\Program Files\\Adobe\\${r}\\Settings\\EncoderPresets\\${pn}`)}function fn(o){if(o.byteLength<12)return!1;let e=new DataView(o.buffer,o.byteOffset,o.byteLength);return String.fromCharCode(e.getUint8(0),e.getUint8(1),e.getUint8(2),e.getUint8(3))==="RIFF"&&e.getUint32(4,!0)+8===o.byteLength}function gn(o){if(o.byteLength<44)return null;let e=new DataView(o.buffer,o.byteOffset,o.byteLength),a=i=>String.fromCharCode(e.getUint8(i),e.getUint8(i+1),e.getUint8(i+2),e.getUint8(i+3));if(a(0)!=="RIFF"||a(8)!=="WAVE")return null;let n=0,t=0,r=12;for(;r+8<=o.byteLength;){let i=a(r),s=e.getUint32(r+4,!0);if(i==="fmt "&&r+24<=o.byteLength&&(n=e.getUint32(r+16,!0),t=e.getUint16(r+22,!0)),i==="data")return n===0?null:{bytesPorSegundo:n,bitsPorAmostra:t,inicio:r+8,tamanho:Math.min(s,o.byteLength-r-8)};r+=8+s+s%2}return null}function Ar(o){let e=gn(o);return e===null?o:o.subarray(e.inicio,e.inicio+e.tamanho)}function Tr(o){let e=gn(o);return e===null?null:e.tamanho/e.bytesPorSegundo}function ba(o){let e=gn(o);if(e===null||e.bitsPorAmostra!==16)return!1;let a=new DataView(o.buffer,o.byteOffset,o.byteLength),n=Math.floor(e.tamanho/2),t=Math.max(1,Math.floor(n/2e5)),r=0;for(let i=0;i<n;i+=t){let s=Math.abs(a.getInt16(e.inicio+i*2,!0));s>r&&(r=s)}return r<33}function hn(o,e){return e<o.inPointSeconds||e>=o.outPointSeconds?null:o.startSeconds+(e-o.inPointSeconds)/o.speed}function be(o){let e=Math.max(0,Math.round(o)),a=n=>String(n).padStart(2,"0");return`${a(Math.floor(e/60))}:${a(e%60)}`}var xa={url:"https://api.elevenlabs.io/v1/speech-to-text",modelo:"scribe_v2",idioma:"por"},nl="elevenlabs";function va(o){let e=new Set,a=[];for(let n of[...o.termosProtegidos,...o.termosChave]){let t=n.trim().replace(/\s+/g," ");if(t.length===0||t.length>50||t.split(" ").length>5)continue;let r=t.toLowerCase();if(!e.has(r)&&(e.add(r),a.push(t),a.length===1e3))break}return a}function Sr(o,e=!0){let a=[{nome:"model_id",valor:xa.modelo},{nome:"language_code",valor:xa.idioma},{nome:"timestamps_granularity",valor:"word"},{nome:"tag_audio_events",valor:"false"},{nome:"diarize",valor:"false"}];if(e)for(let n of o)a.push({nome:"keyterms",valor:n});return a}function bn(o){let e=[];for(let a of o){let n=a.codePointAt(0)??0;n<128?e.push(n):n<2048?e.push(192|n>>6,128|n&63):n<65536?e.push(224|n>>12,128|n>>6&63,128|n&63):e.push(240|n>>18,128|n>>12&63,128|n>>6&63,128|n&63)}return new Uint8Array(e)}function kr(o,e,a){let n=[];for(let s of o)n.push(bn(`--${a}\r
Content-Disposition: form-data; name="${s.nome}"\r
\r
${s.valor}\r
`));n.push(bn(`--${a}\r
Content-Disposition: form-data; name="file"; filename="${e.nome}"\r
Content-Type: ${e.tipo}\r
\r
`)),n.push(e.bytes),n.push(bn(`\r
--${a}--\r
`));let t=n.reduce((s,c)=>s+c.byteLength,0),r=new Uint8Array(t),i=0;for(let s of n)r.set(s,i),i+=s.byteLength;return{corpo:r,contentType:`multipart/form-data; boundary=${a}`}}function Fe(o){return typeof o=="number"&&Number.isFinite(o)?o:null}function tl(o){if(Array.isArray(o.words))return o.words;if(Array.isArray(o.segments))return o.segments.flatMap(e=>typeof e=="object"&&e!==null&&Array.isArray(e.words)?e.words:[]);if(Array.isArray(o.transcripts)&&o.transcripts[0]&&typeof o.transcripts[0]=="object"){let e=o.transcripts[0].words;if(Array.isArray(e))return e}return[]}var rl=/[.!?…]["'”’)]*$/u;function ya(o,e=0){let a;try{a=JSON.parse(o)}catch{return null}if(typeof a!="object"||a===null)return null;let n=[];for(let t of tl(a)){if(typeof t!="object"||t===null)continue;let r=t;if((typeof r.type=="string"?r.type:"word")!=="word")continue;let s=typeof r.text=="string"?r.text.trim():"";if(s.length===0)continue;let c=Fe(r.start)??Fe(r.start_time);if(c===null)continue;let l=Fe(r.end)??Fe(r.end_time)??c,m=Fe(r.logprob);n.push({text:s,inicio:c+e,fim:Math.max(c,l)+e,confidence:m===null?1:Math.min(1,Math.exp(m)),eos:rl.test(s),sourceName:nl})}return n.sort((t,r)=>t.inicio-r.inicio),n}function Mr(o,e){let a=e.replace(/\s+/g," ").slice(0,300);return/api_key_id_used_as_api_key/.test(e)?"A chave colada \xE9 o ID da chave, n\xE3o a chave secreta. No ElevenLabs, crie uma chave nova e copie o valor que come\xE7a com sk_ (ele s\xF3 aparece na hora de criar). Nada foi cobrado.":o===401||o===403||/invalid_api_key|authentication_error/.test(e)?`ElevenLabs recusou a chave (${o}). Confira a chave de API salva no painel. Detalhe: ${a}`:o===402||/quota|credit|insufficient/i.test(e)?`ElevenLabs sem credito para transcrever (${o}). Detalhe: ${a}`:o===413?`Audio grande demais para o ElevenLabs (${o}).`:o===429?`ElevenLabs ocupado ou limite de uso atingido (${o}). Tente de novo em alguns minutos.`:o>=500?`ElevenLabs fora do ar (${o}). Tente de novo em alguns minutos.`:`ElevenLabs respondeu ${o}. Detalhe: ${a}`}function Cr(o,e){return(o===400||o===422)&&/keyterm/i.test(e)}function wa(o){let e=Ar(o),a=2166136261,n=i=>{a^=i&255,a=Math.imul(a,16777619)>>>0},t=e.byteLength;for(let i=0;i<4;i++)n(t>>>8*i);let r=Math.max(1,Math.floor(t/2e5));for(let i=0;i<t;i+=r)n(e[i]??0);return`${t.toString(16)}-${a.toString(16).padStart(8,"0")}`}async function $r(o,e,a,n){let t=`----procaptions${Date.now().toString(16)}${Math.random().toString(16).slice(2)}`,{corpo:r,contentType:i}=kr(Sr(a,n),{nome:"sequencia.wav",tipo:"audio/wav",bytes:o},t),s=await fetch(xa.url,{method:"POST",headers:{"xi-api-key":e,"Content-Type":i,Accept:"application/json"},body:r.buffer});return{status:s.status,texto:await s.text()}}async function Ea(o,e,a,n){let t=await $r(o,e,a,a.length>0);if(t.status>=200&&t.status<300||a.length>0&&Cr(t.status,t.texto)&&(n(`ElevenLabs recusou os termos-chave (${t.status}); tentando sem eles`),t=await $r(o,e,a,!1),t.status>=200&&t.status<300))return t.texto;throw new Error(Mr(t.status,t.texto))}var qr=new Map([["zero",0],["um",1],["uma",1],["dois",2],["duas",2],["tres",3],["quatro",4],["cinco",5],["seis",6],["sete",7],["oito",8],["nove",9],["dez",10],["onze",11],["doze",12],["treze",13],["quatorze",14],["catorze",14],["quinze",15],["dezesseis",16],["dezessete",17],["dezoito",18],["dezenove",19],["vinte",20],["trinta",30],["quarenta",40],["cinquenta",50],["sessenta",60],["setenta",70],["oitenta",80],["noventa",90],["cem",100],["cento",100],["duzentos",200],["trezentos",300],["quatrocentos",400],["quinhentos",500],["seiscentos",600],["setecentos",700],["oitocentos",800],["novecentos",900]]),Ir=new Map([["mil",1e3],["milhao",1e6],["milhoes",1e6]]);function Pa(o){return o.normalize("NFD").replace(/\p{Diacritic}/gu,"").toLowerCase().replace(/r\$/g,"").replace(/[^a-z0-9]/g,"")}function xn(o){let e=Pa(o);return/^\d+$/.test(e)||qr.has(e)||Ir.has(e)}function il(o){let e=0,a=0,n=!1;for(let t of o){let r=Pa(t);if(r===""||r==="e")continue;if(/^\d+$/.test(r)){a+=Number(r),n=!0;continue}let i=Ir.get(r);if(i!==void 0){a=(a===0?1:a)*i,e+=a,a=0,n=!0;continue}let s=qr.get(r);if(s===void 0)return null;a+=s,n=!0}return n?e+a:null}function sl(o){let e=String(Math.trunc(Math.abs(o))),a="";for(let n=0;n<e.length;n++)n>0&&(e.length-n)%3===0&&(a+="."),a+=e[n];return a}function cl(o){let e=[],a=0;for(;a<o.length;){let n=o[a];if(n===void 0||!xn(n)){a++;continue}let t=a,r=a+1;for(;r<o.length;){let s=o[r];if(s!==void 0&&xn(s)){t=r,r++;continue}let c=o[r+1];if(s!==void 0&&Pa(s)==="e"&&c!==void 0&&xn(c)){r+=2,t=r-1;continue}break}let i=il(o.slice(a,t+1));i!==null&&e.push({inicio:a,fim:t,valor:i}),a=t+1}return e}var ll=new Set(["custa","custava","custam","custou","custar","valor","preco","investimento","pagar","paga","pagava","pagamento","apenas","sai","sair","fica","ficar"]),dl=new Set(["ta","esta","e","era","eram","hoje","agora","so","somente","apenas","sai","fica"]),ul=new Set(["reais","real"]),ml=new Set(["hora","horas","h","horario"]),pl=new Set(["manha","tarde","noite","madrugada"]),fl=new Set(["de","era","eram","custava","custavam","valia","valiam"]),gl=4;function vn(o){return`${sl(o)} REAIS`}function yn(o){let e=cl(o),a=r=>{let i=o[r];return i===void 0?"":Pa(i)},n=[];for(let r=0;r<e.length;r++){let i=e[r];if(i===void 0)continue;let s=a(i.inicio-1),c=a(i.fim+1),l=a(i.fim+2),m=e[r+1];if(s==="de"&&c==="por"&&m!==void 0&&m.inicio===i.fim+2){n.push({...i,certeza:"alta"}),n.push({...m,certeza:"alta"}),r++;continue}if(c==="por"&&l==="cento"){m!==void 0&&m.inicio===i.fim+2&&r++;continue}if(ul.has(c)){n.push({...i,fim:i.fim+1,certeza:"alta"});continue}if(o.slice(i.inicio,i.fim+1).some(g=>/r\$/i.test(g))){n.push({...i,certeza:"alta"});continue}if(s==="as"||ml.has(c)||c==="e"&&l==="meia"||c==="da"&&pl.has(l))continue;let u=[];for(let g=Math.max(0,i.inicio-gl);g<i.inicio;g++)u.push(a(g));if(u.some(g=>ll.has(g))){n.push({...i,certeza:"alta"});continue}if(s==="por"){let g=u.some(p=>dl.has(p));n.push({...i,certeza:g?"alta":"media"})}}if(n.some(r=>r.certeza==="alta")){let r=new Set(n.map(i=>i.inicio));for(let i of e){if(r.has(i.inicio))continue;if(fl.has(a(i.inicio-1))){n.push({...i,certeza:"alta"});continue}let s=i.fim===o.length-1,c=n.some(l=>l.certeza==="alta"&&l.fim<i.inicio);s&&c&&i.valor>=10&&n.push({...i,certeza:"media"})}n.sort((i,s)=>i.inicio-s.inicio)}return n}var oo={androclinic:{nome:"AndroClinic",termosProtegidos:["Androclinic","Cristiano Estivalet"],termosChave:["AndroClinic","Estivalet","anamnese","testosterona","telemedicina","teleconsulta","disfun\xE7\xE3o er\xE9til","azulzinho","hora H","sigilo total","libido","ere\xE7\xE3o","urologista","horm\xF4nio","estresse"]},grandcare:{nome:"GrandCare",termosProtegidos:["GrandCare","Edemilson Banach"],termosChave:["GrandCare","Edemilson","Banach","Florian\xF3polis","Alzheimer","Esclerose Lateral Amiotr\xF3fica","home care","cuidadores","enfermagem","interna\xE7\xE3o domiciliar","readmiss\xE3o hospitalar","multidisciplinar","videochamada"]},menopausa:{nome:"Menopausa Cancelada",termosProtegidos:["Menopausa Cancelada","Femme Healthy"],termosChave:["Menopausa Cancelada","Reset 90","Femme Healthy","menopausa","DHA","\xF4mega 3","B12","coenzima Q10","col\xE1geno","magn\xE9sio","homociste\xEDna","metilcobalamina","metilfolato","polivitam\xEDnico","LDL","TPM"]}};function xe(o){let e=o?.empresa;return typeof e=="string"&&Object.prototype.hasOwnProperty.call(oo,e)?e:"androclinic"}var Ro={maxCaracteres:20,maxPalavras:1/0,pausaQuebraSegundos:1.5,toleranciaCorteSegundos:.25,termosProtegidos:oo.androclinic.termosProtegidos,termosChave:oo.androclinic.termosChave,trackDeCortes:0,maiusculas:!0,confiarNoAcento:!1,quebrarEmPontuacao:!1},hl={...Ro,confiarNoAcento:!0,quebrarEmPontuacao:!0,maxPalavras:3};function Aa(o,e=hl){let{termosProtegidos:a,termosChave:n}=oo[o];return{...e,termosProtegidos:a,termosChave:n}}function Nr(o){return o.map(e=>({text:e.text,inicio:e.inicio,fim:e.fim,confidence:e.confidence,eos:e.eos,sugestao:null,motivo:null}))}function _(o){let e=/^(.*?)([.,!?;:…]*)$/u.exec(o);return e?{corpo:e[1]??o,sufixo:e[2]??""}:{corpo:o,sufixo:""}}function Ta(o,e){let a=o[0];return a===void 0||a!==a.toUpperCase()?e:e.charAt(0).toUpperCase()+e.slice(1)}var bl=new Map([["para","pra"],["estava","tava"],["estavam","tavam"],["est\xE1","t\xE1"],["est\xE3o","t\xE3o"],["estou","t\xF4"]]),xl=new Map([["para o","pro"],["para os","pros"]]);function Or(o){let e=[],a=0;for(;a<o.length;){let n=o[a];if(n===void 0){a++;continue}let t=_(n.text),r=o[a+1];if(r!==void 0){let s=_(r.text),c=xl.get(`${t.corpo.toLowerCase()} ${s.corpo.toLowerCase()}`);if(c!==void 0){e.push({...n,text:Ta(t.corpo,c)+s.sufixo,fim:r.fim,confidence:Math.min(n.confidence,r.confidence),eos:r.eos}),a+=2;continue}}let i=bl.get(t.corpo.toLowerCase());if(i!==void 0){e.push({...n,text:Ta(t.corpo,i)+t.sufixo}),a++;continue}e.push(n),a++}return e}var vl=new Set(["isso","isto","aquilo","ele","ela","eles","elas","nome","problema","questao","quest\xE3o","objetivo","resultado","segredo","verdade","diferenca","diferen\xE7a","motivo","causa","tudo","nada"]);function Dr(o){return o.map((e,a)=>{let n=_(e.text);if(n.corpo.toLowerCase()!=="e")return e;let t=o[a-1],r=o[a+1],i=t===void 0?"":_(t.text).corpo.toLowerCase(),c=(r===void 0?"":_(r.text).corpo.toLowerCase())==="por"&&_(o[a+2]?.text??"").corpo.toLowerCase()==="isso";return vl.has(i)||c?{...e,text:Ta(n.corpo,"\xE9")+n.sufixo}:e})}var yl=new Set(["sabe","sabia","sabem","entende","entendeu","imagina","adivinha","explica"]),wl=new Set(["o","um","esse","este","aquele","meu","seu"]);function Fr(o){let e=[];for(let r=0;r<o.length;r++){let i=o[r];if(i===void 0)continue;let s=_(i.text),c=s.corpo.toLowerCase();if(c==="porque"||c==="porqu\xEA"){e.push({i:r,consome:1,sufixo:s.sufixo,caixa:s.corpo});continue}if(c==="por"){let l=o[r+1];if(l===void 0)continue;let m=_(l.text),d=m.corpo.toLowerCase();(d==="que"||d==="qu\xEA")&&e.push({i:r,consome:2,sufixo:m.sufixo,caixa:s.corpo})}}if(e.length===0)return[...o];let a=[],n=0,t=0;for(;n<o.length;){let r=e[t],i=o[n];if(i===void 0){n++;continue}if(r===void 0||r.i!==n){a.push(i),n++;continue}t++;let s=o[n+r.consome-1]??i,c=o[n-1],l=c===void 0?"":_(c.text).corpo.toLowerCase(),m=n+r.consome;for(;m<o.length;){let f=o[m];if(m++,f===void 0||f.eos)break}let d=n+r.consome>=o.length,u=n;for(;u>0;){let f=o[u-1];if(f===void 0||f.eos)break;u--}let g=!1;for(let f=u;f<n;f++){let y=o[f];y!==void 0&&yl.has(_(y.text).corpo.toLowerCase())&&(g=!0)}for(let f=n;f<m;f++)(o[f]?.text??"").includes("?")&&(g=!0);let p;wl.has(l)?p="porqu\xEA":d?p="por qu\xEA":g?p="por que":p="porque",a.push({...i,text:Ta(r.caixa,p)+r.sufixo,fim:s.fim,eos:s.eos,confidence:Math.min(i.confidence,s.confidence)}),n+=r.consome}return a}function Rr(o,e){if(o===e)return 0;if(o.length===0)return e.length;if(e.length===0)return o.length;let a=Array.from({length:e.length+1},(t,r)=>r),n=new Array(e.length+1).fill(0);for(let t=1;t<=o.length;t++){n[0]=t;for(let i=1;i<=e.length;i++){let s=o[t-1]===e[i-1]?0:1;n[i]=Math.min((n[i-1]??0)+1,(a[i]??0)+1,(a[i-1]??0)+s)}let r=a;a=n,n=r}return a[e.length]??0}function Le(o){return o.normalize("NFD").replace(/\p{Diacritic}/gu,"").toLowerCase().replace(/[^a-z0-9]/g,"")}function Lr(o,e){let a=e.termosProtegidos.map(r=>{let i=r.split(" ");return{canonico:r,partes:i,chaves:i.map(Le)}}),n=[],t=0;for(;t<o.length;){let r=o[t];if(r===void 0){t++;continue}let i=!1;for(let m of a){let d=m.partes.length+1;for(let u=1;u<=d&&t+u<=o.length;u++){let g=o.slice(t,t+u),p=Le(g.map(P=>_(P.text).corpo).join("")),f=m.chaves.join(""),y=Math.max(1,Math.floor(f.length/5));if(p.length===0||Rr(p,f)>y||p[0]!==f[0])continue;let b=g[g.length-1]??r;n.push({...r,text:m.canonico+_(b.text).sufixo,fim:b.fim,eos:b.eos,confidence:Math.min(...g.map(P=>P.confidence)),sugestao:null,motivo:null}),t+=u,i=!0;break}if(i)break}if(i)continue;let s=o[t-1],c=null,l=null;if(s!==void 0){let m=Le(_(s.text).corpo);for(let d of a){if(d.partes.length<2||d.chaves[0]!==m)continue;let u=d.partes[1];if(u===void 0)continue;let g=Le(_(r.text).corpo),p=Le(u);if(g===p)break;Rr(g,p)<=Math.ceil(p.length/2)?l=u:c=u;break}}if(l!==null){n.push({...r,text:l+_(r.text).sufixo,sugestao:null,motivo:null}),t++;continue}n.push(c===null?r:{...r,sugestao:c,motivo:`esperado depois de "${_(s?.text??"").corpo}"`}),t++}return n}var El=.5;function zr(o,e){let a=[],n=[];for(let t of o){let r=n[n.length-1];r!==void 0&&t.inicio-r.fim>e.pausaQuebraSegundos&&(a.push(n),n=[]),n.push(t),t.eos&&(a.push(n),n=[])}return n.length>0&&a.push(n),a}var jr=o=>o.reduce((e,a,n)=>e+a.text.length+(n>0?1:0),0),Pl=(o,e)=>jr(o)<=e.maxCaracteres&&o.length<=e.maxPalavras,Al=new Set(["o","a","os","as","um","uma","uns","umas","de","do","da","dos","das","em","no","na","nos","nas","ao","\xE0","por","pelo","pela","pra","pro","com","sem","me","te","se","lhe","meu","minha","seu","sua","e","ou","mas","que","porque"]);function Tl(o,e,a,n){let t=o[o.length-1];if(t===void 0)return 1/0;let r=1;return o.length===1&&_(t.text).corpo.length<4&&(r+=2),o.length>a.maxPalavras&&(r+=1.5),e||(Al.has(_(t.text).corpo.toLowerCase())&&(r+=3),/[.,;:!?]$/.test(t.text)&&(r-=1.5),n.some(i=>Math.abs(i-t.fim)<=a.toleranciaCorteSegundos)&&(r-=2)),r}function Sl(o,e,a=[]){if(Pl(o,e))return[[...o]];let n=o.length,t=[0],r=[0];for(let s=1;s<=n;s++){t[s]=1/0,r[s]=s-1;for(let c=s-1;c>=0;c--){let l=o.slice(c,s);if(l.length>1&&(jr(l)>e.maxCaracteres||l.length>e.maxPalavras+1))break;let m=(t[c]??1/0)+Tl(l,s===n,e,a);m<(t[s]??1/0)&&(t[s]=m,r[s]=c)}}let i=[];for(let s=n;s>0;s=r[s]??0)i.unshift(o.slice(r[s]??0,s));return i}function wn(o,e){let a=o[0],n=o[o.length-1];if(a===void 0||n===void 0)throw new RangeError("bloco sem palavras");let t=[],r=Math.min(...o.map(i=>i.confidence));r<El&&t.push(`confianca ${r.toFixed(2)}`);for(let i of o)i.sugestao!==null&&t.push(`"${_(i.text).corpo}" pode ser "${i.sugestao}"`);return{texto:o.map(i=>i.text).join(" ").replace(/\s*\n\s*/g," ").replace(/["“”]/g,"").replace(/[,;:.]+$/,"").replace(/^[,;:.]+\s*/,"").trim(),inicio:a.inicio,fim:n.fim,estilo:e,precisaRevisao:t.length>0,motivos:t}}function kl(o,e){if(e.length===0)return[[...o]];let a=[],n=[];for(let t of o){let r=n[n.length-1];r!==void 0&&e.some(i=>i>=r.fim&&i<=t.inicio)&&(a.push(n),n=[]),n.push(t)}return n.length>0&&a.push(n),a}function Ml(o){let e=[],a=[];for(let n of o)a.push(n),/[,;:]["'”’]*$/.test(n.text)&&(e.push(a),a=[]);return a.length>0&&e.push(a),e}function Cl(o){let e=yn(o.map(t=>_(t.text).corpo));if(e.length===0)return[{palavras:o,estilo:"normal",preco:null}];let a=[],n=0;for(let t of e)t.inicio>n&&a.push({palavras:o.slice(n,t.inicio),estilo:"normal",preco:null}),a.push({palavras:o.slice(t.inicio,t.fim+1),estilo:"preco",preco:t}),n=t.fim+1;return n<o.length&&a.push({palavras:o.slice(n),estilo:"normal",preco:null}),a.filter(t=>t.palavras.length>0)}function Vr(o,e,a=Ro){let n=[];for(let t of zr(o,a))for(let r of Cl(t)){if(r.estilo==="preco"&&r.preco!==null){let s=wn(r.palavras,"preco");n.push({...s,texto:vn(r.preco.valor),precisaRevisao:s.precisaRevisao||r.preco.certeza==="media",motivos:r.preco.certeza==="media"?[...s.motivos,"contexto monetario incerto"]:s.motivos});continue}let i=a.quebrarEmPontuacao?Ml(r.palavras):[r.palavras];for(let s of i)for(let c of kl(s,e))for(let l of Sl(c,a,e))l.length>0&&n.push(wn(l,"normal"))}return n}function Sa(o,e=Ro){let a=[];return o.forEach((n,t)=>{let r=`bloco ${t+1} ("${n.texto}")`;n.texto.includes(`
`)&&a.push(`${r}: tem quebra de linha`),n.texto.trim().length===0&&a.push(`${r}: vazio`),n.texto.length>e.maxCaracteres&&a.push(`${r}: ${n.texto.length} caracteres, orcamento e ${e.maxCaracteres}`),n.texto.endsWith(",")&&a.push(`${r}: termina em virgula`),n.texto.endsWith(".")&&a.push(`${r}: termina em ponto (D-15)`),n.estilo==="normal"&&/\bREAIS\b/.test(n.texto)&&a.push(`${r}: preco misturado com texto normal`),n.fim<n.inicio&&a.push(`${r}: termina antes de comecar`)}),a}function $l(o,e){let a=Nr(o);return a=Lr(a,e),a=Or(a),e.confiarNoAcento||(a=Dr(a)),Fr(a)}var ql=1;function ka(o,e,a=Ro){let n=Vr($l(o,a),e,a);return n.map((t,r)=>{let i=n[r+1];return i!==void 0&&i.inicio>t.fim&&i.inicio-t.fim<ql?{...t,fim:i.inicio}:t})}function Yr(o){let e=Math.max(0,Math.round(o*1e3)),a=Math.floor(e/36e5),n=Math.floor(e%36e5/6e4),t=Math.floor(e%6e4/1e3),r=e%1e3,i=(s,c)=>String(s).padStart(c,"0");return`${i(a,2)}:${i(n,2)}:${i(t,2)},${i(r,3)}`}function ve(o){return o.map((e,a)=>`${a+1}
${Yr(e.inicio)} --> ${Yr(e.fim)}
${e.texto}
`).join(`
`)}var xo=ro("premierepro"),po=ro("uxp");async function U(o,e,a=15e3){let n;try{return await Promise.race([e,new Promise((t,r)=>{n=setTimeout(()=>r(new Error(`${o}: sem resposta em ${a/1e3}s`)),a)})])}finally{n!==void 0&&clearTimeout(n)}}async function ye(){let o=await xo.Project.getActiveProject();if(!o)throw new Error("Nenhum projeto aberto.");let e=await o.getActiveSequence();if(!e)throw new Error("Nenhuma sequencia ativa. Abra uma sequencia na timeline.");return{project:o,sequence:e,rootItem:await o.getRootItem()}}var Il=1;async function Rl(o){for(let e of["getVideoFrameRate","getFrameRate"]){let a=o[e];if(typeof a=="function"){let n=await a.call(o);return typeof n=="number"?n:n?.value??0}}for(let e of["videoFrameRate","frameRate"]){let a=o[e];if(a!==void 0)return typeof a=="number"?a:a?.value??0}return console.log("[pro-captions] settings sem taxa de quadros conhecida; chaves:",Object.keys(o),Object.getOwnPropertyNames(Object.getPrototypeOf(o??{}))),0}async function Qr(){let{sequence:o}=await ye(),e=o,a=await Rl(await e.getSettings());return{name:e.name,fps:a,videoTracks:await e.getVideoTrackCount(),captionTracks:await e.getCaptionTrackCount()}}async function Ca(o=0){let{sequence:e}=await ye(),n=await e.getVideoTrack(o),t=[];for(let r of await n.getTrackItems(Il,!1)){let i=await r.getProjectItem();if(!i?.name)continue;let s=await r.getSpeed();t.push({sourceName:i.name,startSeconds:(await r.getStartTime()).seconds,endSeconds:(await r.getEndTime()).seconds,inPointSeconds:(await r.getInPoint()).seconds,outPointSeconds:(await r.getOutPoint()).seconds,speed:s>0?s:1})}return t}async function Tn(o=0){return(await Ca(o)).slice(1).map(a=>a.startSeconds)}async function _r(o){let e=await o.getItems(),a=[];for(let n of e){let t=xo.FolderItem.cast(n);t?a.push(...await _r(t)):a.push(n)}return a}async function Ur(o){let{rootItem:e}=await ye(),n=await _r(e),t=new Map,r=[];for(let i of new Set(o)){let s=n.find(c=>c.name===i);if(!s){r.push({nome:i,motivo:"nao encontrado no painel de Projeto (nome nao bate?)"});continue}try{let c=xo.ClipProjectItem.cast(s);if(!c){r.push({nome:i,motivo:"nao e um ClipProjectItem (bin ou sequencia?)"});continue}let l=await xo.Transcript.exportToJSON(c);l&&t.set(i,l)}catch(c){r.push({nome:i,motivo:c?.message??String(c)})}}return{transcricoes:t,falhas:r}}function Nl(o,e,a){let n=null;if(o.lockedAccess(()=>{try{o.executeTransaction(t=>{a(r=>t.addAction(r))},e)}catch(t){let r=t;n=`${r?.name??"Erro"}: ${r?.message??String(t)}`}}),n!==null)throw new Error(n)}var Ol=o=>o.replace(/[^a-zA-Z0-9._-]/g,"_");async function Hr(o){let e=await po.storage.localFileSystem.getDataFolder();try{return await(await e.getEntry(`original-${Ol(o)}.json`)).read()}catch{return null}}async function Gr(o){let e=await po.storage.localFileSystem.getDataFolder(),a=[];try{let r=await e.getEntry("ultimo-log-captions.json"),s=JSON.parse(await r.read())?.execucoes;Array.isArray(s)&&(a=s)}catch{}let n=[{quando:new Date().toISOString(),linhas:[...o]},...a].slice(0,10),t=await e.createFile("ultimo-log-captions.json",{overwrite:!0});return await t.write(JSON.stringify({execucoes:n},null,2)),t.nativePath}async function Go(o,e){let n=await(await po.storage.localFileSystem.getDataFolder()).createFile(o,{overwrite:!0});return await n.write(e),n.nativePath}async function Dl(o){let{project:e}=await ye();return e.importFiles([...o],!0)}async function En(o){let e=await po.storage.localFileSystem.getDataFolder();try{return await e.getEntry(o)}catch{return null}}async function Fl(o,e){let a=await En("timeline-resposta.txt");a&&await a.delete();let n=String(Date.now());await Go("timeline-pedido.txt",[n,o,e??""].join(`
`));for(let r=0;r<40;r++){await new Promise(l=>setTimeout(l,500));let i=await En("timeline-resposta.txt");if(!i)continue;let[s,...c]=(await i.read()).split(`
`);if(s?.trim()===n)return await i.delete(),c.join(`
`)}let t=await En("timeline-pedido.txt");return t&&await t.delete(),null}async function $a(o,e){let a=await Fl(o,e);if(a===null){let r=await Dl(e?[o,e]:[o]).catch(()=>!1);return[{texto:"a ponte da timeline n\xE3o respondeu (ela liga junto com o Premiere; se persistir, rode o INSTALAR.ps1 do pro-captions-timeline)",tipo:"aviso"},r?{texto:"os .srt foram importados no painel Projeto: arraste cada um para a timeline",tipo:"aviso"}:{texto:`importe e arraste na m\xE3o: ${o}${e?` e ${e}`:""}`,tipo:"aviso"}]}if(!a.startsWith("OK|"))return[{texto:`a ponte recusou: ${a.replace(/^ERRO\|/,"")}`,tipo:"erro"}];let[n,...t]=a.slice(3).split(`
`);return[{texto:n||"legendas na timeline",tipo:"ok"},...t.filter(r=>r.trim()).map(r=>({texto:r,tipo:"aviso"}))]}async function Jr(o,e){let{project:a,rootItem:n}=await ye(),r=(await n.getItems()).find(s=>s.name===o);if(!r)throw new Error(`midia nao encontrada no projeto: ${o}`);let i=xo.ClipProjectItem.cast(r)??r;Nl(a,"Captions: escrever transcricao",s=>{let c=xo.Transcript.importFromJSON(e);s(xo.Transcript.createImportTextSegmentsAction(c,i))})}function Ll(o){return`file:/${o.trim().replace(/\\/g,"/").replace(/^\/+/,"")}`}async function Ma(o){try{return await po.storage.localFileSystem.getEntryWithUrl(Ll(o))??null}catch{return null}}async function Br(o){return new Uint8Array(await o.read({format:po.storage.formats.binary}))}async function Sn(o){let e=await Ma(o);e&&await e.delete()}async function zl(){let o=await Ma("C:\\Program Files\\Adobe"),e=o?.getEntries?(await o.getEntries()).filter(n=>n.isFolder).map(n=>n.name):[],a=Pr(String(po.host?.version??""),e);for(let n of a)if(await Ma(n))return n;throw new Error(`N\xE3o achei o preset de \xE1udio do Premiere (${pn}). Procurei em: ${a.join(" ; ")||"nenhuma pasta do Premiere em C:\\Program Files\\Adobe"}.`)}async function Wr(){let o=await zl(),a=`${(await po.storage.localFileSystem.getDataFolder()).nativePath.replace(/[\\/]+$/,"")}\\captions-audio.wav`;await Sn(a);let{sequence:n}=await ye(),t=xo.EncoderManager.getManager(),r=xo.Constants?.ExportType?.IMMEDIATELY??xo.EncoderManager.EXPORT_IMMEDIATELY,i=Date.now();if(!await t.exportSequence(n,r,a,o,!0))throw new Error("O Premiere recusou exportar o \xE1udio da sequ\xEAncia.");let c=Date.now()-i,l=await Ma(a);if(!l)throw new Error(`O export terminou, mas o arquivo n\xE3o apareceu em ${a}.`);let m=await Br(l);for(let d=0;!fn(m)&&d<20;d++)await new Promise(u=>setTimeout(u,500)),m=await Br(l);if(!fn(m))throw new Error("O WAV exportado ficou incompleto. Clique de novo.");return{caminho:a,bytes:m,ms:c}}var Xr="elevenlabs-chave.json",Pn="elevenlabs-transcricao-",jl=10;async function qa(o){let e=await po.storage.localFileSystem.getDataFolder();try{return await(await e.getEntry(o)).read()}catch{return null}}async function An(o,e){let n=await(await po.storage.localFileSystem.getDataFolder()).createFile(o,{overwrite:!0});return await n.write(e),n.nativePath}async function we(){let o=await qa(Xr);if(o===null)return null;try{let e=JSON.parse(o).chave;return typeof e=="string"&&e.trim().length>0?e.trim():null}catch{return null}}async function Ee(){let o=await qa("perfil.json");try{return xe(o===null?null:JSON.parse(o))}catch{return xe(null)}}async function Kr(o){await An(Xr,JSON.stringify({chave:o.trim()}))}async function Ia(o){return qa(`${Pn}${o}.json`)}async function Ra(o,e){let a=`${Pn}${o}.json`,n=await An(a,e);try{let t=JSON.parse(await qa("elevenlabs-indice.json")??"[]"),r=[a,...t.filter(c=>c!==a)].slice(0,jl),i=new Set(r),s=await po.storage.localFileSystem.getDataFolder();for(let c of await s.getEntries())c.name.startsWith(Pn)&&!i.has(c.name)&&await c.delete();await An("elevenlabs-indice.json",JSON.stringify(r))}catch{}return n}function Zr(o){let e;try{e=JSON.parse(o)}catch{return null}if(typeof e!="object"||e===null)return null;let a=e;if(!Array.isArray(a.segments))return null;let n=[];for(let t of a.segments){if(typeof t!="object"||t===null)continue;let r=t;if(!Array.isArray(r.words))continue;let i=[];for(let s of r.words){if(typeof s!="object"||s===null)continue;let c=s;typeof c.text!="string"||typeof c.start!="number"||i.push({text:c.text,start:c.start,duration:typeof c.duration=="number"?c.duration:0,confidence:typeof c.confidence=="number"?c.confidence:1,eos:c.eos===!0,type:typeof c.type=="string"?c.type:"word"})}n.push({start:typeof r.start=="number"?r.start:0,duration:typeof r.duration=="number"?r.duration:0,speaker:typeof r.speaker=="string"?r.speaker:"",words:i})}return{language:typeof a.language=="string"?a.language:"",segments:n}}function oi(o,e){let a=[];for(let n of o){let t=e.get(n.sourceName);if(t)for(let r of t.segments)for(let i of r.words){if(i.type!=="word")continue;let s=hn(n,i.start);if(s===null)continue;let c=i.start+i.duration,l=hn(n,c)??n.endSeconds;a.push({text:i.text,inicio:s,fim:Math.max(s,l),confidence:i.confidence,eos:i.eos,sourceName:n.sourceName})}}return a.sort((n,t)=>n.inicio-t.inicio),a}var G=o=>{let e=document.getElementById(o);if(!e)throw new Error(`elemento ausente no HTML: ${o}`);return e},ze=[];function D(o){ze.push(o);let e=G("log");e.textContent=ze.join(`
`),e.scrollTop=e.scrollHeight}function fo(o,e=""){let a=G("estado");a.textContent=o,a.setAttribute("data-tom",e)}function ei(o){for(let e of["gerar","restaurar","salvarChave"]){let a=G(e);a.disabled=o}}var Vl={gerar:"Gerar legendas",restaurar:"Restaurar original",salvarChave:"Salvar chave"};async function kn(o,e,a){ze=[],ei(!0),a&&(G(a.id).textContent=a.enquanto),D(`== ${o} ==`);try{await e()}catch(n){D(`ERRO: ${n?.message??String(n)}`),fo("erro","erro")}finally{ei(!1),a&&(G(a.id).textContent=Vl[a.id]??a.enquanto);try{let n=await U("log",Gr(ze));D(""),D(`log salvo em ${n}`)}catch{}}}async function ai(){let o=await U("sequencia",Qr()),e=G("seqNome");return e.textContent=o.name,e.setAttribute("data-vazio","nao"),G("seqDica").style.display="none",D(`${o.fps.toFixed(2)} fps \xB7 ${o.videoTracks} video \xB7 ${o.captionTracks} caption`),o}async function Yl(){await ai();let o=await U("clipes",Ca(0)),e=await U("cortes",Tn(0));D(`V1: ${o.length} clipes \xB7 ${e.length} cortes`);let{transcricoes:a,falhas:n}=await U("transcricoes",Ur(o.map(i=>i.sourceName)),6e4);D(`${a.size} midias com transcricao`);for(let i of n)D(`"${i.nome}": ${i.motivo}`);let t=new Map;for(let[i,s]of a){let c=Zr(s);c?t.set(i,c):D(`transcricao ilegivel: ${i}`)}let r=oi(o,t);return D(`${r.length} palavras no corte final (transcricao do Premiere)`),{cortes:e,palavras:r,preset:Ro}}async function Bl(){let o=await U("chave",we());if(!o)throw new Error("Sem chave do ElevenLabs. Cole a chave em 'Quem ouve o \xE1udio' e clique em Salvar chave \u2014 ou desmarque o ElevenLabs para usar a transcri\xE7\xE3o do Premiere.");await ai();let e=await U("cortes",Tn(0));D(`V1: ${e.length} cortes`);let a=await U("empresa",Ee()),n=Aa(a);D(`termos de ${oo[a].nome} (troca no Editar)`),fo("exportando \xE1udio","ativo");let t=await U("exportar o \xE1udio",Wr(),600*1e3),r;try{let l=Tr(t.bytes);if(D(`\xE1udio: ${l===null?"?":be(l)} \xB7 ${(t.bytes.byteLength/1e6).toFixed(1)} MB \xB7 exportado em ${(t.ms/1e3).toFixed(1)} s`),ba(t.bytes))throw new Error("O \xE1udio exportado da sequ\xEAncia est\xE1 mudo \u2014 nada foi enviado ao ElevenLabs. Confira se a faixa de \xE1udio da fala (A1) n\xE3o est\xE1 silenciada (M) ou com outra faixa em solo (S).");let m=wa(t.bytes);if(r=await U("transcri\xE7\xE3o guardada",Ia(m)),r!==null)D("mesmo \xE1udio de antes: transcri\xE7\xE3o reaproveitada, sem custo");else{fo("ElevenLabs ouvindo","ativo");let d=va(n);D(`enviando ao ElevenLabs (${d.length} termos-chave)\u2026`);let u=Date.now();r=await U("ElevenLabs",Ea(t.bytes,o,d,D),900*1e3),D(`ElevenLabs respondeu em ${((Date.now()-u)/1e3).toFixed(0)} s`);let g=await U("guardar transcri\xE7\xE3o",Ra(m,r));D(`resposta guardada em ${g}`)}}finally{await Sn(t.caminho).catch(()=>{})}let i=ya(r);if(i===null)throw new Error("A resposta do ElevenLabs n\xE3o \xE9 JSON leg\xEDvel.");D(`${i.length} palavras ouvidas pelo ElevenLabs`);let s=i[i.length-1]?.fim??0,c=Math.max(0,...e);return c-s>60&&D(`AVISO: a fala acaba em ${be(s)} e a V1 vai at\xE9 ${be(c)}. Clipe de \xE1udio mudo nesse trecho? Ali fica sem legenda.`),{cortes:e,palavras:i,preset:n}}function Ql(o){return G(o).checked===!0}async function _l(){fo("lendo sequ\xEAncia","ativo");let o=Ql("usarEleven"),{cortes:e,palavras:a,preset:n}=o?await Bl():await Yl();if(a.length===0)throw new Error(o?"O ElevenLabs n\xE3o ouviu nenhuma palavra. O \xE1udio da sequ\xEAncia est\xE1 mudo (faixa silenciada)?":"Nenhuma palavra encontrada. A camera principal da V1 tem transcricao?");fo("montando legendas","ativo");let t=ka(a,e,n),r=Sa(t,n),i=t.filter(m=>m.estilo==="preco"),s=t.filter(m=>m.precisaRevisao);if(r.length>0){D(""),D(`${r.length} bloco(s) reprovado(s) na validacao, nada foi escrito:`);for(let m of r.slice(0,10))D(`  ${m}`);fo("reprovado","aviso");return}D(""),D(`${t.length} blocos \xB7 ${i.length} preco(s) \xB7 ${s.length} para revisar`),D("");for(let m of t.slice(0,12)){let d=m.estilo==="preco"?"R$":"  ";D(`${d} ${be(m.inicio)} ${m.texto}`)}if(t.length>12&&D(`   ... mais ${t.length-12}`),s.length>0){D(""),D("precisam de revisao:");for(let m of s.slice(0,8))D(`  ${be(m.inicio)} ${m.motivos.join("; ")}`)}let c=t.filter(m=>m.estilo==="normal"),l=[await U("srt",Go("legendas.srt",ve(c)))];i.length>0&&l.push(await U("srt precos",Go("precos.srt",ve(i)))),D("");for(let m of l)D(`gerado: ${m}`);D("");for(let m of await $a(l[0],l[1]??null))D(m.texto);fo(s.length>0?`${s.length} para revisar`:"legendas geradas",s.length>0?"aviso":"ok")}async function Ul(){let o=await U("clipes",Ca(0)),e=[...new Set(o.map(n=>n.sourceName))],a=0;for(let n of e){let t=await U("backup",Hr(n));if(t===null){D(`${n}: sem backup guardado`);continue}await U("escrita",Jr(n,t)),D(`${n}: transcricao original restaurada`),a++}D(""),D(`${a} de ${e.length} midia(s) restaurada(s)`),fo(a>0?"restaurado":"nada a restaurar",a>0?"ok":"aviso")}async function ni(){let o=await U("chave",we());G("chaveEstado").textContent=o===null?"Sem chave salva. Crie uma em elevenlabs.io > Developers > API Keys e cole abaixo.":`Chave salva (termina em ${o.slice(-4)}).`,o===null&&(G("usarEleven").checked=!1)}async function Hl(){let o=G("chave"),e=(o.value??"").trim();if(e.length<10){D("Cole a chave inteira no campo antes de salvar."),fo("sem chave","aviso");return}e.startsWith("sk_")||D("Aten\xE7\xE3o: chaves do ElevenLabs come\xE7am com sk_. Essa n\xE3o come\xE7a \u2014 confira se n\xE3o \xE9 o ID da chave."),await U("salvar chave",Kr(e)),o.value="",G("usarEleven").checked=!0,await ni(),D("chave do ElevenLabs salva neste computador"),fo("chave salva","ok")}function Gl(o,e){o.addEventListener("click",e),o.addEventListener("keydown",a=>{let n=a.key;n!=="Enter"&&n!==" "||(a.preventDefault(),e())})}function Jl(){let o=G("secaoLog"),e=G("logToggle"),a=o.getAttribute("data-aberto")!=="nao";o.setAttribute("data-aberto",a?"nao":"sim"),e.textContent=a?"Mostrar":"Recolher",e.setAttribute("aria-expanded",a?"false":"true"),e.setAttribute("aria-label",a?"Mostrar o registro":"Recolher o registro")}function ti(o){ze=[],fo("pronto","ok"),D("painel carregado"),G("gerar").addEventListener("click",()=>{kn("gerar legendas",_l,{id:"gerar",enquanto:"Gerando..."})}),G("restaurar").addEventListener("click",()=>{kn("restaurar original",Ul,{id:"restaurar",enquanto:"Restaurando..."})}),G("salvarChave").addEventListener("click",()=>{kn("salvar chave",Hl,{id:"salvarChave",enquanto:"Salvando..."})}),Gl(G("logToggle"),Jl),ni().catch(()=>{G("chaveEstado").textContent="N\xE3o consegui ler a chave salva."})}var ri=`<!-- Fragmento: o shell injeta isto em document.body, depois da folha da\r
     familia (ferramentas/auto-broll/src/ui/styles.css). Layout do prototipo\r
     escolhido pelo Leo em 01/10. UXP: sem CSS Grid, sem gap, sem var(), sem\r
     largura em %; o que e clicavel e div[role=button] (UXP_ARMADILHAS.md). -->\r
<style>\r
  /* ---- etapas: bolinha com o simbolo e o nome embaixo */\r
  .etapas {\r
    display: flex;\r
    flex-direction: row;\r
    padding-top: 6px;\r
  }\r
\r
  .etapa {\r
    display: flex;\r
    flex-direction: column;\r
    align-items: center;\r
    flex: 1 1 0px;\r
    min-width: 0;\r
    cursor: pointer;\r
  }\r
\r
  .bola {\r
    display: flex;\r
    flex-direction: row;\r
    align-items: center;\r
    justify-content: center;\r
    width: 26px;\r
    height: 26px;\r
    margin-bottom: 3px;\r
    border: 1px solid #333b47;\r
    border-radius: 13px;\r
    background-color: #14171d;\r
  }\r
\r
  .etapa-nome {\r
    font-size: 11px;\r
    color: #9098a6;\r
    text-align: center;\r
    white-space: nowrap;\r
  }\r
\r
  /* ---- grade de variacoes */\r
  .grade {\r
    display: flex;\r
    flex-direction: row;\r
    flex-wrap: wrap;\r
    margin: 4px -3px 0 -3px;\r
  }\r
\r
  .var {\r
    display: flex;\r
    flex-direction: column;\r
    align-items: stretch;\r
    flex: none;\r
    width: 58px;\r
    margin: 3px;\r
    padding: 5px 6px;\r
    background-color: #14171d;\r
    border: 1px solid #232830;\r
    border-radius: 7px;\r
    cursor: pointer;\r
  }\r
\r
  .var[data-sel="sim"] {\r
    background-color: #1a1e26;\r
    border-color: #3b82f6;\r
  }\r
\r
  .var-cima {\r
    display: flex;\r
    flex-direction: row;\r
    align-items: center;\r
  }\r
\r
  .var-nome {\r
    flex: 1 1 auto;\r
    font-size: 11px;\r
    font-weight: 600;\r
    color: #eceef2;\r
  }\r
\r
  .var-st {\r
    flex: none;\r
    font-size: 11px;\r
    color: #5f6774;\r
  }\r
\r
  .var-st[data-tom="ok"] { color: #4ecb8d; }\r
  .var-st[data-tom="aviso"] { color: #eeab4c; }\r
  .var-st[data-tom="ativo"] { color: #3b82f6; }\r
\r
  .var-barra {\r
    display: flex;\r
    flex-direction: row;\r
    height: 3px;\r
    margin-top: 5px;\r
    border-radius: 2px;\r
    overflow: hidden;\r
    background-color: #101318;\r
  }\r
\r
  .var-feito { background-color: #3b82f6; }\r
  .var-feito[data-tom="ok"] { background-color: #4ecb8d; }\r
  .var-feito[data-tom="aviso"] { background-color: #eeab4c; }\r
\r
  .aviso-var {\r
    margin-top: 4px;\r
    font-size: 12px;\r
    color: #eeab4c;\r
  }\r
\r
  /* ---- abas */\r
  .abas {\r
    display: flex;\r
    flex-direction: row;\r
    margin: 8px 0 6px 0;\r
  }\r
\r
  .aba {\r
    flex: none;\r
    padding: 3px 12px;\r
    margin-right: 4px;\r
    border: 1px solid transparent;\r
    border-radius: 11px;\r
    font-size: 12px;\r
    color: #9098a6;\r
    cursor: pointer;\r
  }\r
\r
  .aba[data-on="sim"] {\r
    border-color: #333b47;\r
    background-color: #1a1e26;\r
    color: #eceef2;\r
  }\r
\r
  #edReguaAntes {\r
    height: 3px;\r
    border-radius: 2px;\r
    background-color: #ff7d71;\r
  }\r
\r
  /* ---- quadros: um por pedaco da V1 */\r
  .quadros {\r
    display: flex;\r
    flex-direction: row;\r
    flex-wrap: wrap;\r
    margin: 0 -3px;\r
  }\r
\r
  .qd {\r
    display: flex;\r
    flex-direction: column;\r
    align-items: stretch;\r
    flex: none;\r
    width: 46px;\r
    margin: 3px;\r
    cursor: pointer;\r
  }\r
\r
  .qd-tela {\r
    display: flex;\r
    flex-direction: column;\r
    align-items: stretch;\r
    height: 82px;\r
    border: 1px solid #232830;\r
    border-radius: 5px;\r
    overflow: hidden;\r
    background-color: #000000;\r
  }\r
\r
  .qd-tela[data-leak="sim"] {\r
    border-color: #eeab4c;\r
  }\r
\r
  .qd-tempo {\r
    margin-top: 2px;\r
    font-size: 11px;\r
    color: #5f6774;\r
    text-align: center;\r
  }\r
\r
  .qd-leg {\r
    font-size: 11px;\r
    color: #eceef2;\r
    text-align: center;\r
    white-space: nowrap;\r
    overflow: hidden;\r
    text-overflow: ellipsis;\r
  }\r
\r
  .qd-leg[data-preco="sim"] {\r
    color: #ff7d71;\r
  }\r
\r
  /* ---- fala: cada palavra e um item de flex-wrap (sem texto corrido no UXP) */\r
  .fala {\r
    display: flex;\r
    flex-direction: row;\r
    flex-wrap: wrap;\r
    align-items: center;\r
  }\r
\r
  .pl {\r
    flex: none;\r
    margin: 0 4px 6px 0;\r
    padding: 0 1px;\r
    font-size: 13px;\r
    color: #c9ced8;\r
    cursor: pointer;\r
  }\r
\r
  .pl[data-coberta="sim"] {\r
    background-color: #2b2650;\r
    color: #eceef2;\r
    border-bottom: 2px solid #8d82f5;\r
  }\r
\r
  .pl[data-preco="sim"] {\r
    background-color: #ff7d71;\r
    color: #4a1b0c;\r
    font-weight: 600;\r
  }\r
\r
  .pl-tag {\r
    flex: none;\r
    margin: 0 3px 6px 0;\r
    padding: 0 5px;\r
    border-radius: 4px;\r
    font-size: 11px;\r
    color: #cecbf6;\r
    background-color: #2b2650;\r
  }\r
\r
  .pl-quebra,\r
  .pl-corte {\r
    flex: none;\r
    height: 14px;\r
    margin: 0 5px 6px 0;\r
  }\r
\r
  .pl-quebra {\r
    width: 1px;\r
    background-color: #9098a6;\r
  }\r
\r
  .pl-corte {\r
    width: 2px;\r
    background-color: #ff7d71;\r
  }\r
\r
  .pl-mudo {\r
    flex: none;\r
    margin-bottom: 6px;\r
    font-size: 12px;\r
    color: #eeab4c;\r
  }\r
</style>\r
\r
<header class="ed-topo">\r
  <span class="ed-titulo">AutoEdit <span id="edSeq" class="ed-seq">\xB7 lendo\u2026</span></span>\r
  <span id="edPill" class="pill" data-tom="ativo">lendo</span>\r
</header>\r
\r
<main id="edRolagem" class="conteudo">\r
  <div class="bloco">\r
    <div id="edEmpresas" class="chips"></div>\r
    <div id="edEtapas" class="etapas"></div>\r
    <div class="prog-linha"><span id="edProg" class="prog-txt">lendo a sequ\xEAncia\u2026</span><span id="edCont" class="prog-cont"></span></div>\r
    <div class="barra"><span id="edBarraFeito" class="barra-feito" style="flex-grow: 0"></span><span id="edBarraResto" style="flex-grow: 1"></span></div>\r
    <div id="edGrade" class="grade"></div>\r
  </div>\r
\r
  <div class="det">\r
    <div class="det-cabeca"><span id="edVarNome" class="det-nome"></span><span id="edVarDur" class="det-dur"></span></div>\r
    <div class="mets">\r
      <div class="met"><span class="met-rot">Cortes</span><span id="edMetCortes" class="met-val">\u2013</span></div>\r
      <div class="met"><span class="met-rot">B-rolls</span><span id="edMetBroll" class="met-val" style="color: #8d82f5">\u2013</span></div>\r
      <div class="met"><span class="met-rot">Legendas</span><span id="edMetLeg" class="met-val">\u2013</span></div>\r
      <div class="met"><span class="met-rot">Pre\xE7os</span><span id="edMetPreco" class="met-val" style="color: #ff7d71">\u2013</span></div>\r
    </div>\r
    <div id="edAvisoVar" class="aviso-var" style="display: none"></div>\r
\r
    <div class="abas">\r
      <div id="edAba_tl" class="aba" role="button" tabindex="0" data-on="sim">Timeline</div>\r
      <div id="edAba_qd" class="aba" role="button" tabindex="0" data-on="nao">Quadros</div>\r
      <div id="edAba_fl" class="aba" role="button" tabindex="0" data-on="nao">Fala</div>\r
    </div>\r
\r
    <div id="edVista_tl">\r
      <div class="tl-caixa">\r
        <div class="tl">\r
          <div class="tl-linha"><span class="tl-rot"></span><div class="tl-faixa tl-regua"><span id="edReguaAntes" style="flex-grow: 0"></span><span class="tl-cursor"></span><span id="edReguaDepois" style="flex-grow: 1"></span></div></div>\r
          <div class="tl-linha"><span class="tl-rot">C2</span><div id="edTl_C2" class="tl-faixa"></div></div>\r
          <div class="tl-linha"><span class="tl-rot">C1</span><div id="edTl_C1" class="tl-faixa"></div></div>\r
          <div class="tl-linha"><span class="tl-rot">V3</span><div id="edTl_V3" class="tl-faixa"></div></div>\r
          <div class="tl-linha"><span class="tl-rot">V2</span><div id="edTl_V2" class="tl-faixa"></div></div>\r
          <div class="tl-linha"><span class="tl-rot">V1</span><div id="edTl_V1" class="tl-faixa"></div></div>\r
          <div class="tl-linha"><span class="tl-rot">A2</span><div id="edTl_A2" class="tl-faixa"></div></div>\r
          <div class="tl-ctrl"><span id="edPlay" class="tl-play" role="button" tabindex="0">\u25B6</span><span id="edTempo">0:00</span><span class="tl-dica">clique na timeline para pular</span></div>\r
        </div>\r
        <div id="edTela" class="tela">\r
          <div id="edTelaA" class="tela-parte" data-tipo="doutor" style="flex-grow: 1">doutor</div>\r
          <div id="edTelaB" class="tela-parte" data-tipo="broll" style="flex-grow: 0"></div>\r
        </div>\r
      </div>\r
      <div id="edTelaLeg" class="tela-leg"></div>\r
    </div>\r
    <div id="edVista_qd" class="quadros" style="display: none"></div>\r
    <div id="edVista_fl" style="display: none">\r
      <div class="legenda-fala">vermelho: a imagem corta \xB7 cinza: legenda nova \xB7 roxo: debaixo do B-roll</div>\r
      <div id="edFala" class="fala"></div>\r
    </div>\r
\r
    <div id="edFeed" class="feed"></div>\r
    <div id="edVerLog" class="ver-log" role="button" tabindex="0">ver o registro completo</div>\r
    <pre id="edLog" class="log" style="display: none"></pre>\r
  </div>\r
</main>\r
\r
<footer class="rodape">\r
  <div id="edEditar" class="btn-pri" role="button" tabindex="0"><span id="edIcoTodas" class="btn-ico"></span>Editar todas</div>\r
  <div id="edSelecao" class="btn-sec btn-selecao" role="button" tabindex="0"><span id="edIcoSel" class="btn-ico"></span>S\xF3 a sele\xE7\xE3o</div>\r
  <div id="edRelir" class="btn-redondo" role="button" tabindex="0" title="Ler a sequ\xEAncia de novo" aria-label="Ler a sequ\xEAncia de novo"><span id="edIcoReler" class="btn-ico-so"></span></div>\r
</footer>\r
`;function Cn(o){return o.replace(/\.[^.]+$/,"").replace(/\s*\(\d+\)\s*$/,"").trim()}var Xl={assunto:"pessoa",ancoraY:.35,cropTopoExtra:0},Kl={assunto:"pessoa",ancoraY:.45,cropTopoExtra:0};function si(o,e,a,n){let t=o.porArquivo[a],r=o.padraoPorConceito[Cn(a)],i=t??r??(n==="retrato"?Xl:Kl),s=t?"arquivo":r?"conceito":"default",c=e[a];return c?{assunto:i.assunto,ancoraY:c.ancoraY,cropTopoExtra:c.cropTopoExtra,origem:"override"}:{assunto:i.assunto,ancoraY:i.ancoraY,cropTopoExtra:i.cropTopoExtra,origem:s}}var Zl={rosto:.18,pessoa:.12,dupla:.1,aberto:.05},od=.6,ed=.4,Na=7,ci=0,No=58,Mn=(o,e,a)=>Math.min(Math.max(o,e),a);function li(o){let e=(Number.isFinite(o)?o:No)/100;return Mn(e,.4,.6)}function di(o){let e=o.H*o.brollTopoFrac,a=o.W,n=o.H-e,t=Mn(o.ancoraY-Zl[o.assunto]+o.cropTopoExtra,0,od),r=o.h*(1-t),i=t<1?(o.ancoraY-t)/(1-t):0,s=Math.max(a/o.w,n/r),c=o.W/2,l=e+ed*n-(t-.5)*o.h*s-i*r*s,m=o.H-.5*o.h*s,d=e-(t-.5)*o.h*s;return l=m<=d?Mn(l,m,d):m,{escalaPct:s*100,posX:c,posY:l,cropTopoPct:t*100}}function ui(o){let e=/(\d{3,4})_(\d{3,4})_\d+fps/.exec(o);return e?{w:Number(e[1]),h:Number(e[2])}:void 0}var Jo={androclinic:{lado:"baixo",divisao:No,feather:Na},grandcare:{lado:"baixo",divisao:No,feather:Na},menopausa:{lado:"cima",divisao:45,feather:5}},ad=1.2;function mi(o,e,a,n,t){let r=e*t,i=Math.max(o/a,ad*r/n),s=r/2,c=Math.max(0,s+n*i/2-r);return{escalaPct:i*100,posX:o/2,posY:s,cropTopoPct:0,cropBasePct:c/(n*i)*100}}var ii={W:1080,H:1920},nd=[[3840,2160],[2160,3840],[1920,1080],[1080,1920],[1280,720],[720,1280]];function pi(o){let e;for(let[a,n]of nd){let t=Math.max(ii.W/a,ii.H/n)*100,r=Math.abs(o-t)/t;r<.05&&(e===void 0||r<e.erro)&&(e={w:a,h:n,erro:r})}return e&&{w:e.w,h:e.h}}function fi(o){let e=new Map;for(let a of o)e.set(Math.round(a*10)/10,(e.get(Math.round(a*10)/10)??0)+1);return[...e.entries()].sort((a,n)=>n[1]-a[1])[0]?.[0]}var $n=1.2;function qn(o,e,a,n=1){return Math.max(o/e,o/a)*n*100}var td=1;function Eo(o,e){let a=[];for(let n of[...o].sort((t,r)=>t.inicioQ-r.inicioQ)){let t=a[a.length-1];t!==void 0&&n.inicioQ-t.fimQ<td*e?a[a.length-1]={inicioQ:t.inicioQ,fimQ:Math.max(t.fimQ,n.fimQ)}:a.push({inicioQ:n.inicioQ,fimQ:n.fimQ})}return a}function gi(o,e,a){let n=[];for(let t of e){let r=t.origemQ/a,i=(t.origemQ+t.midiaAteQ-t.midiaDeQ)/a,s=t.destinoQ/a-r;for(let c of o)c.inicio<r||c.inicio>=i||n.push({...c,inicio:c.inicio+s,fim:Math.min(c.fim,i)+s})}return n.sort((t,r)=>t.inicio-r.inicio)}function hi(o,e){return o.slice(1).map(a=>a.destinoQ/e)}var rd=.36,bi=.84;function xi(o,e,a,n=[]){let t=.5/a,r=(s,c)=>Math.abs(s-c)<t,i=[];for(let s of o.flatMap(c=>[c.inicio,c.fim]).sort((c,l)=>c-l)){let c=o.filter(u=>r(u.inicio,s)||r(u.fim,s)).length>1,l=e.some(u=>r(u.inicioQ/a,s)||r(u.fimQ/a,s)),m=Math.round((s-rd)*a)/a,d=m+bi;c||l||n.some(u=>m<u.fim-t&&u.inicio<d-t)||i.push(m)}return i}function vi(o,e,a,n){let t=.5/e,r=(c,l)=>a.some(m=>c<m.fim-t&&m.inicio<l-t),i=[],s=[];for(let c of o){let l=c.inicioQ/e;r(l,c.fimQ/e)||(r(l,l+n)?s:i).push(c)}return{entram:i,pulam:s}}var id=3;function In(o,e,a,n){return o.map((t,r)=>{let i=t.inicioQ/a,s=t.fimQ/a,c=g=>g>=i&&g<s,l=(g,p)=>({de:g-i,ate:Math.min(p,s)-i}),m=n.palavras.filter(g=>c(g.inicio)),d=Math.max(i,...m.map(g=>g.fim)),u=e.length===o.length?e[r]:null;return{duracaoS:s-i,antesS:u?(u.fimQ-u.inicioQ)/a:null,clipes:n.clipes.filter(g=>c(g.inicio)).map(g=>l(g.inicio,g.fim)),brolls:n.brolls.filter(g=>c(g.inicio)).map(g=>({...l(g.inicio,g.fim),nome:g.nome})),leaks:n.leaks.filter(c).map(g=>l(g,g+bi)),legendas:n.blocos.filter(g=>c(g.inicio)).map(g=>({...l(g.inicio,g.fim),nome:g.texto,preco:g.estilo==="preco"})),trilha:n.trilha.some(g=>g.inicioQ<t.fimQ&&t.inicioQ<g.fimQ),palavras:m.map(g=>({...l(g.inicio,g.fim),nome:g.text})),falaSomeEmS:n.palavras.length===0||s-d<=id?null:d-i}})}function yi(o,e,a){return o.flatMap((n,t)=>a.some(r=>r.inicio<n.fimQ/e&&n.inicioQ/e<r.fim)?[t]:[])}function wi(o,e,a){return o.flatMap((n,t)=>a.includes(t)?[]:[{texto:"",inicio:n.inicioQ/e,fim:n.fimQ/e}])}var je=(o,e)=>o>=e.de&&o<e.ate;function Ei(o){let e=new Set,a;return o.palavras.map((n,t)=>{let r=(n.de+n.ate)/2,i=o.brolls.find(d=>je(r,d)),s=i!==void 0&&!e.has(i);i&&e.add(i);let c=o.legendas.find(d=>je(r,d)),l=t>0&&c!==void 0&&c!==a;c&&(a=c);let m=o.palavras[t-1];return{de:n.de,texto:n.nome??"",...s?{broll:i.nome??"B-roll"}:{},coberta:i!==void 0,preco:c?.preco===!0,quebra:l,corte:m!==void 0&&o.clipes.some(d=>d.de>m.de&&d.de<=n.de)}})}function Pi(o){return o.clipes.map(e=>{let a=(e.de+e.ate)/2,n=o.brolls.find(r=>je(a,r)),t=o.legendas.find(r=>je(e.de+.05,r))??o.legendas.find(r=>je(a,r));return{de:e.de,...n?{broll:n.nome??"B-roll"}:{},leak:o.leaks.some(r=>r.de<e.ate&&e.de<r.ate),legenda:t?.nome??"",preco:t?.preco===!0}})}function Rn(o){let e=o?.bibliotecas,a={};if(typeof e=="object"&&e!==null)for(let[n,t]of Object.entries(e))typeof t=="string"&&xe({empresa:n})===n&&(a[n]=t);return{empresa:xe(o),bibliotecas:a}}function Ai(o,e,a){let n=e?{...o.bibliotecas,[o.empresa]:e}:o.bibliotecas;return{perfil:{empresa:a,bibliotecas:n},pasta:n[a]??""}}var sd=1;function Ti(o,e,a){let n=[],t=[],r=0;for(let i of o){let s=e.find(m=>i.inicio*a>=m.inicioQ&&i.inicio*a<m.fimQ);if(s===void 0){t.push(`${i.arquivo}: cairia no espa\xE7o entre v\xEDdeos`);continue}let c=s.fimQ/a;if(i.inicio+i.duracao<=c){n.push(i);continue}let l=c-i.inicio;if(l<sd){t.push(`${i.arquivo}: sobraria ${l.toFixed(1)} s antes do fim do v\xEDdeo`);continue}r++,n.push({...i,duracao:l})}return{ficam:n,aparados:r,fora:t}}var Si=[{id:"pausas",nome:"Pausas",cor:"#4ecb8d"},{id:"broll",nome:"B-roll",cor:"#8d82f5"},{id:"split",nome:"Split",cor:"#67c7e2"},{id:"leak",nome:"Leak",cor:"#eeab4c"},{id:"trilha",nome:"Trilha",cor:"#4fc3a1"},{id:"legendas",nome:"Legendas",cor:"#eceef2"}],cd={androclinic:"#3b82f6",grandcare:"#4fc3a1",menopausa:"#e07ba8"},ld=["C2","C1","V3","V2","V1","A2"],ki=o=>o.legendas.filter(e=>!e.preco).length,dd=o=>o.legendas.length-ki(o),Nn=o=>o>0?String(o):"\u2013";function ud(o,e){return e==="C2"?o.legendas.filter(a=>a.preco):e==="C1"?o.legendas.filter(a=>!a.preco):e==="V3"?o.leaks:e==="V2"?o.brolls:e==="V1"?o.clipes:o.trilha?[{de:0,ate:o.duracaoS}]:[]}function Mi(o,e){let a=v=>o.querySelector(`#${v}`),n=v=>{for(;v.firstChild;)v.removeChild(v.firstChild)},t=(v,k,C,O="")=>{let Y=document.createElement(k);return Y.className=C,Y.textContent=O,v.appendChild(Y),Y},r=v=>{v.setAttribute("data-apertado","sim"),setTimeout(()=>v.setAttribute("data-apertado","nao"),180)},i=(v,k)=>{v.setAttribute("role","button"),v.setAttribute("tabindex","0");let C=()=>{r(v),k()};v.addEventListener("click",C),v.addEventListener("keydown",O=>{(O.key==="Enter"||O.key===" ")&&C()})},s="",c="androclinic",l={pausas:!0,broll:!0,split:!1,leak:!0,trilha:!0,legendas:!0},m={},d=[],u=!1,g=new Set,p=new Set,f=!1,y=!1,b=0,P=0,T=0,M=null,w=a("edLog"),S=[],h=[],E=()=>{let v=a("edFeed");n(v),h.length===0&&t(v,"span","feed-linha","O que acontece aparece aqui.");for(let k of h.slice(-4))t(v,"span","feed-linha",k.texto).setAttribute("data-tom",k.tom)},q=(v,k="passo")=>{let C=k==="erro"?"\u2717 ":k==="aviso"?"! ":k==="ok"?"\u2713 ":"";S.push(`${C}${v}`),w.textContent=S.join(`
`),w.scrollTop=w.scrollHeight,k!=="vazio"&&(h.push({texto:`${C}${v}`,tom:k}),E())},x=!1;i(a("edVerLog"),()=>{x=!x,w.setAttribute("style",x?"":"display: none"),a("edVerLog").textContent=x?"esconder o registro completo":"ver o registro completo",x&&setTimeout(()=>a("edRolagem").scrollTop=a("edRolagem").scrollHeight,0)});let R=(v,k)=>{let C=a("edPill");C.textContent=v,C.setAttribute("data-tom",k)},A=()=>{let v=a("edEmpresas");n(v);for(let[k,C]of Object.entries(oo)){let O=t(v,"div","chip",C.nome);O.setAttribute("data-on",k===c?"sim":"nao"),k===c&&O.setAttribute("style",`border-color: ${cd[k]}`),i(O,()=>$(k))}},$=v=>{f||v===c||(c=v,A(),e.trocarEmpresa(v).then(({nome:k,pasta:C})=>{C?q(`${k}: B-roll de ${C}`,"passo"):q(`${k}: escolha a pasta de B-roll dela no B-Roller`,"aviso")}).catch(k=>q(`empresa: ${k?.message??String(k)}`,"erro")))},N=!1,B=()=>{let v=a("edEtapas");n(v);for(let k of Si){let C=m[k.id],O=t(v,"div","etapa"),Y=t(O,"span","bola"),co=t(O,"span","etapa-nome",k.nome),H=C==="ok"?k.cor:C==="aviso"?"#eeab4c":C==="erro"?"#ff7d71":null,te=k.cor;H?(te="#0d0f13",Y.setAttribute("style",`background-color: ${H}; border-color: ${H}`),co.setAttribute("style",`color: ${H}`)):C==="rodando"?(Y.setAttribute("style",`background-color: ${N?"#2a3550":"#141a2a"}; border-color: ${k.cor}; border-width: 2px`),co.setAttribute("style",`color: ${k.cor}`)):l[k.id]?(Y.setAttribute("style",`border-color: ${k.cor}`),co.setAttribute("style","color: #eceef2")):(te="#4a515c",Y.setAttribute("style","border-color: #2a2f38; background-color: #101318"),co.setAttribute("style","color: #4a515c")),Y.innerHTML=lo(k.id,te),i(O,()=>{f||(l[k.id]=!l[k.id],a("edProg").textContent=`${k.nome} ${l[k.id]?"ligado":"desligado"} para o pr\xF3ximo AutoEdit`,B())})}},K=null,W=v=>{K!==null&&clearInterval(K),K=v?setInterval(()=>{N=!N,B()},450):null},Z=()=>d.filter((v,k)=>p.has(k)&&v.falaSomeEmS!==null).length,ao=()=>{a("edBarraFeito").setAttribute("style",`flex-grow: ${u&&!f?1:T}`),a("edBarraResto").setAttribute("style",`flex-grow: ${u&&!f?0:Math.max(P-T,P===0?1:0)}`);let v=a("edCont");v.textContent=u&&!f?`${p.size-Z()} ok${Z()>0?` \xB7 ${Z()} com aviso`:""}`:""},qe=()=>{let v=a("edGrade");n(v),d.forEach((k,C)=>{let O=t(v,"div","var");O.setAttribute("data-sel",C===b?"sim":"nao");let Y=t(O,"div","var-cima");t(Y,"span","var-nome",String(C+1));let co=f&&g.has(C),H=co?"ativo":p.has(C)?k.falaSomeEmS!==null?"aviso":"ok":"";t(Y,"span","var-st",H==="ativo"?"\u2026":H==="ok"?"\u2713":H==="aviso"?"!":"\u25CB").setAttribute("data-tom",H);let te=t(O,"div","var-barra"),bt=t(te,"span","var-feito");bt.setAttribute("data-tom",H);let ec=co?T:p.has(C)?1:0;bt.setAttribute("style",`flex-grow: ${ec}`),t(te,"span","").setAttribute("style",`flex-grow: ${co?Math.max(P-T,0):p.has(C)?0:1}`),i(O,()=>{b=C,J=0,jo(),qe(),Ha()})})},Ha=()=>{let v=d[b],k=v?v.palavras.slice(0,4).map(Y=>Y.nome??"").join(" "):"";a("edVarNome").textContent=v?`${s} ${b+1}${k?` \xB7 ${k}`:""}`:"Nenhuma varia\xE7\xE3o",a("edVarDur").textContent=v?v.antesS!==null&&v.antesS-v.duracaoS>=.5?`${j(v.antesS)} \u2192 ${j(v.duracaoS)}`:j(v.duracaoS):"";let C=m.pausas==="ok"||m.pausas==="aviso";a("edMetCortes").textContent=v&&C?String(Math.max(0,v.clipes.length-1)):"\u2013",a("edMetBroll").textContent=v?Nn(v.brolls.length):"\u2013",a("edMetLeg").textContent=v?Nn(ki(v)):"\u2013",a("edMetPreco").textContent=v?Nn(dd(v)):"\u2013";let O=a("edAvisoVar");v&&v.falaSomeEmS!==null?(O.textContent=v.falaSomeEmS===0?"! Sem fala nenhuma nesta varia\xE7\xE3o: \xE1udio mudo?":`! A fala some em ${j(v.falaSomeEmS)}: \xE1udio mudo nesse trecho? Ali fica sem legenda.`,O.setAttribute("style","")):O.setAttribute("style","display: none"),Ja()},J=0,Ie=null,ne=()=>d[b]??null,ko=(v,k,C,O)=>{v.setAttribute("data-tipo",k),v.setAttribute("style",`flex-grow: ${C}`),v.textContent=O},pt=(v,k,C)=>{C===void 0?(ko(v,"doutor",1,"doutor"),ko(k,"broll",0,"")):M?M.lado==="cima"?(ko(v,"broll",M.divisao,C),ko(k,"doutor",100-M.divisao,"doutor")):(ko(v,"doutor",M.divisao,"doutor"),ko(k,"broll",100-M.divisao,C)):(ko(v,"broll",1,C),ko(k,"doutor",0,""))},Ga=()=>{let v=ne();if(!v)return;let k=H=>J>=H.de&&J<H.ate;a("edReguaAntes").setAttribute("style",`flex-grow: ${Math.round(J*100)}`),a("edReguaDepois").setAttribute("style",`flex-grow: ${Math.max(1,Math.round((v.duracaoS-J)*100))}`),a("edTempo").textContent=`${j(J)} / ${j(v.duracaoS)}`;let C=v.brolls.find(k);pt(a("edTelaA"),a("edTelaB"),C?C.nome??"B-roll":void 0),a("edTela").setAttribute("data-leak",v.leaks.some(k)?"sim":"nao");let O=v.legendas.find(H=>H.preco&&k(H)),Y=v.legendas.find(H=>!H.preco&&k(H)),co=a("edTelaLeg");co.textContent=O?.nome??Y?.nome??"",co.setAttribute("data-preco",O?"sim":"nao")},Ws=()=>{let v=ne();for(let k of ld){let C=a(`edTl_${k}`);if(n(C),!!v)for(let O of Ke(ud(v,k),v.duracaoS)){let Y=t(C,"span",O.item<0?"tl-seg":`tl-seg tl-${k}`);Y.setAttribute("style",`flex-grow: ${O.grow}`),Y.addEventListener("click",()=>{J=O.de,Ga()})}}v&&J>v.duracaoS&&(J=0),Ga()},jo=()=>{Ie!==null&&clearInterval(Ie),Ie=null,a("edPlay").textContent="\u25B6"},Xs=()=>{let v=ne();if(v){if(Ie!==null)return jo();J>=v.duracaoS-.1&&(J=0),a("edPlay").textContent="||",Ie=setInterval(()=>{let k=ne();if(!k)return jo();J=Math.min(J+.1,k.duracaoS),J>=k.duracaoS&&jo(),Ga()},100)}};i(a("edPlay"),Xs);let Vo="tl",ft=v=>{J=v,Vo="tl",Ja()},Ks=()=>{let v=a("edVista_qd");n(v);let k=ne();if(k)for(let C of Pi(k)){let O=t(v,"div","qd"),Y=t(O,"div","qd-tela");Y.setAttribute("data-leak",C.leak?"sim":"nao"),pt(t(Y,"div","tela-parte"),t(Y,"div","tela-parte"),C.broll),t(O,"span","qd-tempo",j(C.de)),t(O,"span","qd-leg",C.legenda).setAttribute("data-preco",C.preco?"sim":"nao"),i(O,()=>ft(C.de))}},Zs=()=>{let v=a("edFala");n(v);let k=ne();if(k){k.palavras.length===0&&t(v,"span","pl-mudo","A fala aparece aqui depois que o Editar ouvir a sequ\xEAncia.");for(let C of Ei(k)){C.corte?t(v,"span","pl-corte"):C.quebra&&t(v,"span","pl-quebra"),C.broll&&t(v,"span","pl-tag",C.broll);let O=t(v,"span","pl",C.texto);O.setAttribute("data-coberta",C.coberta?"sim":"nao"),O.setAttribute("data-preco",C.preco?"sim":"nao"),O.addEventListener("click",()=>ft(C.de))}k.falaSomeEmS!==null&&k.palavras.length>0&&t(v,"span","pl-mudo","\xB7 \xE1udio mudo daqui em diante")}},Ja=()=>{for(let v of["tl","qd","fl"])a(`edAba_${v}`).setAttribute("data-on",v===Vo?"sim":"nao"),a(`edVista_${v}`).setAttribute("style",v===Vo?"":"display: none");Vo!=="tl"&&jo(),Vo==="tl"?Ws():Vo==="qd"?Ks():Zs()};for(let v of["tl","qd","fl"])i(a(`edAba_${v}`),()=>{Vo=v,Ja()});let Xe=()=>{B(),ao(),qe(),Ha()},oc={etapa(v,k){m[v]=k,k!=="rodando"&&T++,v==="split"&&(k==="ok"||k==="aviso")&&(M=Jo[c]??null),B(),ao(),qe()},variacoes(v){d=v,b>=v.length&&(b=0);let k=v.findIndex(C=>C.falaSomeEmS!==null);k>=0&&!y&&(b=k),qe(),Ha()},alvo(v){g=new Set(v),qe()}};a("edGrade").addEventListener("click",()=>{f&&(y=!0)});let gt=async()=>{R("lendo","ativo");try{let v=await e.lerEstado();s=v.nome,a("edSeq").textContent=`\xB7 ${v.nome}`,l.broll=v.brollsAcimaDaV1===0,l.legendas=v.faixasDeLegenda===0,d=v.resumo,u=!1,p.clear(),g=new Set,b=0,J=0,M=null;for(let k of Object.keys(m))delete m[k];jo(),a("edProg").textContent=`${v.variacoes} varia\xE7\xE3o(\xF5es) na sequ\xEAncia \xB7 ${j(v.duracaoS)}`,Xe(),v.temChave||q("Sem chave do ElevenLabs: salve a chave no Captions antes de editar.","aviso"),R("pronto","ok")}catch(v){a("edSeq").textContent="\xB7 sem sequ\xEAncia",a("edProg").textContent=v?.message??String(v),d=[],Xe(),R("sem sequ\xEAncia","aviso")}},ht=v=>{if(f)return;g=new Set(v?[]:d.map((C,O)=>O)),f=!0,y=!1,S.length=0,h.length=0,E(),R("editando","ativo");for(let C of Object.keys(m))delete m[C];P=Si.filter(C=>l[C.id]).length,T=0,M=null,J=0,jo(),W(!0),Xe();let k=C=>{a("edProg").textContent=`Editando \xB7 ${C}`};e.editar({...l,soSelecao:v},q,k,oc).then(()=>{R("pronto","ok"),u=!0;for(let C of g)p.add(C);a("edProg").textContent=v?`Varia\xE7\xE3o ${[...g].map(C=>C+1).join(", ")} editada`:`${d.length} varia\xE7\xE3o(\xF5es) editada(s)`}).catch(C=>{let O=C?.message??String(C);q(O,"erro"),R("falhou","erro");let Y=l.pausas&&/clipe a clipe/.test(O)?" Desligue Pausas para editar o resto.":"";a("edProg").textContent=`Parou: ${O}${Y}`}).finally(()=>{f=!1,W(!1),Xe(),e.guardarLog(S).catch(()=>{})})};i(a("edEditar"),()=>ht(!1)),i(a("edSelecao"),()=>ht(!0)),a("edIcoTodas").innerHTML=lo("todas","#ffffff"),a("edIcoSel").innerHTML=lo("selecao","#85b7eb"),a("edIcoReler").innerHTML=lo("reler","#9098a6"),i(a("edRelir"),()=>{f||gt()}),A(),B(),E(),e.lerEmpresa().then(v=>{c=v,A()}).catch(()=>{}),gt()}var Ci={versao:1,padraoPorConceito:{"14.000 mil homens":{assunto:"aberto",ancoraY:.45,cropTopoExtra:0},Academia:{assunto:"pessoa",ancoraY:.4,cropTopoExtra:0},"Al\xEDvio Emocional":{assunto:"pessoa",ancoraY:.26,cropTopoExtra:0},"Casal feliz":{assunto:"dupla",ancoraY:.33,cropTopoExtra:0},"Consulta m\xE9dica":{assunto:"dupla",ancoraY:.24,cropTopoExtra:0},"Corpo do homem":{assunto:"aberto",ancoraY:.5,cropTopoExtra:0},Cristiano:{assunto:"pessoa",ancoraY:.27,cropTopoExtra:0},Desanimado:{assunto:"pessoa",ancoraY:.28,cropTopoExtra:0},Diabetes:{assunto:"pessoa",ancoraY:.22,cropTopoExtra:0},Disposi\u00E7\u00E3o:{assunto:"pessoa",ancoraY:.25,cropTopoExtra:0},Doppler:{assunto:"aberto",ancoraY:.38,cropTopoExtra:0},Doutor:{assunto:"pessoa",ancoraY:.22,cropTopoExtra:0},Exames:{assunto:"aberto",ancoraY:.48,cropTopoExtra:0},"Falhou na cama":{assunto:"pessoa",ancoraY:.3,cropTopoExtra:0},Frustrado:{assunto:"pessoa",ancoraY:.3,cropTopoExtra:0},Horm\u00F4nio:{assunto:"aberto",ancoraY:.45,cropTopoExtra:0},Injet\u00E1veis:{assunto:"aberto",ancoraY:.45,cropTopoExtra:0},"Jogando fora o viagra":{assunto:"aberto",ancoraY:.42,cropTopoExtra:.04},Medicamento:{assunto:"aberto",ancoraY:.5,cropTopoExtra:0},"Medida paliativa":{assunto:"aberto",ancoraY:.5,cropTopoExtra:0},"Milhares de homens":{assunto:"aberto",ancoraY:.48,cropTopoExtra:0},"Risco de infarto":{assunto:"pessoa",ancoraY:.3,cropTopoExtra:0},"Sala reservada":{assunto:"dupla",ancoraY:.32,cropTopoExtra:0},Separa\u00E7\u00E3o:{assunto:"pessoa",ancoraY:.3,cropTopoExtra:0},Teleconsulta:{assunto:"pessoa",ancoraY:.25,cropTopoExtra:0},"Vasos sangu\xEDneos":{assunto:"aberto",ancoraY:.5,cropTopoExtra:0},Viagra:{assunto:"pessoa",ancoraY:.26,cropTopoExtra:0},lifestyle:{assunto:"pessoa",ancoraY:.32,cropTopoExtra:0}},porArquivo:{"14.000 mil homens (1).mp4":{assunto:"aberto",ancoraY:.45,cropTopoExtra:0,w:720,h:1280},"14.000 mil homens (2).mp4":{assunto:"aberto",ancoraY:.45,cropTopoExtra:0,w:720,h:1280},"14.000 mil homens (3).mp4":{assunto:"aberto",ancoraY:.45,cropTopoExtra:0,w:720,h:1280},"14.000 mil homens (4).mp4":{assunto:"aberto",ancoraY:.45,cropTopoExtra:0,w:720,h:1280},"14.000 mil homens (5).mp4":{assunto:"aberto",ancoraY:.45,cropTopoExtra:0,w:720,h:1280},"14.000 mil homens (6).mp4":{assunto:"aberto",ancoraY:.45,cropTopoExtra:0,w:720,h:1280},"14.000 mil homens (7).mp4":{assunto:"aberto",ancoraY:.45,cropTopoExtra:0,w:464,h:832},"Academia.mp4":{assunto:"pessoa",ancoraY:.4,cropTopoExtra:0,w:720,h:1280},"Al\xEDvio Emocional (1).mp4":{assunto:"pessoa",ancoraY:.26,cropTopoExtra:0,w:464,h:832},"Al\xEDvio Emocional (2).mp4":{assunto:"pessoa",ancoraY:.26,cropTopoExtra:0,w:464,h:832},"Al\xEDvio Emocional (3).mp4":{assunto:"pessoa",ancoraY:.26,cropTopoExtra:0,w:464,h:832},"Al\xEDvio Emocional (4).mp4":{assunto:"pessoa",ancoraY:.26,cropTopoExtra:0,w:464,h:832},"Casal feliz (1).mp4":{assunto:"dupla",ancoraY:.33,cropTopoExtra:0,w:464,h:832},"Casal feliz (10).mp4":{assunto:"dupla",ancoraY:.33,cropTopoExtra:0,w:720,h:1280},"Casal feliz (11).mp4":{assunto:"dupla",ancoraY:.33,cropTopoExtra:0,w:720,h:1280},"Casal feliz (12).mp4":{assunto:"dupla",ancoraY:.33,cropTopoExtra:0,w:720,h:1280},"Casal feliz (13).mp4":{assunto:"dupla",ancoraY:.33,cropTopoExtra:0,w:720,h:1280},"Casal feliz (14).mp4":{assunto:"dupla",ancoraY:.33,cropTopoExtra:0,w:720,h:1280},"Casal feliz (2).mp4":{assunto:"dupla",ancoraY:.33,cropTopoExtra:0,w:464,h:832},"Casal feliz (3).mp4":{assunto:"dupla",ancoraY:.33,cropTopoExtra:0,w:464,h:832},"Casal feliz (4).mp4":{assunto:"dupla",ancoraY:.33,cropTopoExtra:0,w:464,h:832},"Casal feliz (5).mp4":{assunto:"dupla",ancoraY:.33,cropTopoExtra:0,w:464,h:832},"Casal feliz (6).mp4":{assunto:"dupla",ancoraY:.33,cropTopoExtra:0,w:464,h:832},"Casal feliz (7).mp4":{assunto:"dupla",ancoraY:.33,cropTopoExtra:0,w:720,h:1280},"Casal feliz (8).mp4":{assunto:"dupla",ancoraY:.33,cropTopoExtra:0,w:464,h:832},"Casal feliz (9).mp4":{assunto:"dupla",ancoraY:.33,cropTopoExtra:0,w:464,h:832},"Celular (1).mov":{assunto:"pessoa",ancoraY:.35,cropTopoExtra:0,w:1080,h:1920},"Consulta m\xE9dica (1).mp4":{assunto:"dupla",ancoraY:.24,cropTopoExtra:0,w:720,h:1280},"Consulta m\xE9dica (2).mp4":{assunto:"dupla",ancoraY:.24,cropTopoExtra:0,w:720,h:1280},"Consulta m\xE9dica (3).mp4":{assunto:"dupla",ancoraY:.24,cropTopoExtra:0,w:720,h:1280},"Consulta m\xE9dica (4).mp4":{assunto:"dupla",ancoraY:.24,cropTopoExtra:0,w:720,h:1280},"Consulta m\xE9dica (5).mp4":{assunto:"dupla",ancoraY:.24,cropTopoExtra:0,w:720,h:1280},"Consulta m\xE9dica (6).mp4":{assunto:"dupla",ancoraY:.24,cropTopoExtra:0,w:720,h:1280},"Consulta m\xE9dica (7).mp4":{assunto:"dupla",ancoraY:.24,cropTopoExtra:0,w:720,h:1280},"Corpo do homem (1).mp4":{assunto:"aberto",ancoraY:.5,cropTopoExtra:0,w:720,h:1280},"Corpo do homem (2).mp4":{assunto:"aberto",ancoraY:.5,cropTopoExtra:0,w:720,h:1280},"Corpo do homem (3).mp4":{assunto:"aberto",ancoraY:.5,cropTopoExtra:0,w:720,h:1280},"Corpo do homem (4).mp4":{assunto:"aberto",ancoraY:.5,cropTopoExtra:0,w:720,h:1280},"Corpo do homem (5).mp4":{assunto:"aberto",ancoraY:.5,cropTopoExtra:0,w:720,h:1280},"Corpo do homem (6).mp4":{assunto:"aberto",ancoraY:.5,cropTopoExtra:0,w:720,h:1280},"Corpo do homem (7).mp4":{assunto:"aberto",ancoraY:.5,cropTopoExtra:0,w:720,h:1280},"Corpo do homem (8).mp4":{assunto:"aberto",ancoraY:.5,cropTopoExtra:0,w:720,h:1280},"Corpo do homem (9).mp4":{assunto:"aberto",ancoraY:.5,cropTopoExtra:0,w:720,h:1280},"Cristiano (1).mp4":{assunto:"pessoa",ancoraY:.27,cropTopoExtra:0,w:720,h:1280},"Cristiano (2).mp4":{assunto:"pessoa",ancoraY:.27,cropTopoExtra:0,w:720,h:1280},"Cristiano (3).mp4":{assunto:"pessoa",ancoraY:.27,cropTopoExtra:0,w:464,h:832},"Desanimado (1).mp4":{assunto:"pessoa",ancoraY:.28,cropTopoExtra:0,w:720,h:1280},"Desanimado (2).mp4":{assunto:"pessoa",ancoraY:.28,cropTopoExtra:0,w:720,h:1280},"Desanimado (3).mp4":{assunto:"pessoa",ancoraY:.28,cropTopoExtra:0,w:720,h:1280},"Desanimado (4).mp4":{assunto:"pessoa",ancoraY:.28,cropTopoExtra:0,w:720,h:1280},"Desanimado (5).mp4":{assunto:"pessoa",ancoraY:.28,cropTopoExtra:0,w:720,h:1280},"Desanimado (6).mp4":{assunto:"pessoa",ancoraY:.28,cropTopoExtra:0,w:720,h:1280},"Desanimado (7).mp4":{assunto:"pessoa",ancoraY:.28,cropTopoExtra:0,w:720,h:1280},"Desanimado (8).mp4":{assunto:"pessoa",ancoraY:.28,cropTopoExtra:0,w:720,h:1280},"Desanimado (9).mov":{assunto:"pessoa",ancoraY:.28,cropTopoExtra:0,w:1080,h:1920},"Diabetes.mp4":{assunto:"pessoa",ancoraY:.22,cropTopoExtra:0,w:464,h:832},"Disposi\xE7\xE3o.mp4":{assunto:"pessoa",ancoraY:.25,cropTopoExtra:0,w:720,h:1280},"Doppler.mp4":{assunto:"aberto",ancoraY:.38,cropTopoExtra:0,w:720,h:1280},"Doutor (10).mp4":{assunto:"pessoa",ancoraY:.22,cropTopoExtra:0,w:464,h:832},"Doutor (12).mp4":{assunto:"pessoa",ancoraY:.22,cropTopoExtra:0,w:720,h:1280},"Doutor (13).mp4":{assunto:"pessoa",ancoraY:.22,cropTopoExtra:0,w:720,h:1280},"Doutor (14).mp4":{assunto:"pessoa",ancoraY:.22,cropTopoExtra:0,w:464,h:832},"Doutor (15).mp4":{assunto:"pessoa",ancoraY:.22,cropTopoExtra:0,w:464,h:832},"Doutor (16).mp4":{assunto:"pessoa",ancoraY:.22,cropTopoExtra:0,w:464,h:832},"Doutor (17).mp4":{assunto:"pessoa",ancoraY:.22,cropTopoExtra:0,w:464,h:832},"Doutor (19).mp4":{assunto:"pessoa",ancoraY:.22,cropTopoExtra:0,w:720,h:1280},"Doutor (20).mp4":{assunto:"pessoa",ancoraY:.22,cropTopoExtra:0,w:464,h:832},"Doutor (21).mp4":{assunto:"pessoa",ancoraY:.22,cropTopoExtra:0,w:720,h:1280},"Doutor (22).mp4":{assunto:"pessoa",ancoraY:.22,cropTopoExtra:0,w:720,h:1280},"Doutor (23).mp4":{assunto:"pessoa",ancoraY:.22,cropTopoExtra:0,w:720,h:1280},"Doutor (24).mp4":{assunto:"pessoa",ancoraY:.22,cropTopoExtra:0,w:464,h:832},"Doutor (25).mp4":{assunto:"pessoa",ancoraY:.22,cropTopoExtra:0,w:464,h:832},"Doutor (26).mp4":{assunto:"pessoa",ancoraY:.22,cropTopoExtra:0,w:464,h:832},"Doutor (27).mp4":{assunto:"pessoa",ancoraY:.22,cropTopoExtra:0,w:464,h:832},"Doutor (28).mp4":{assunto:"pessoa",ancoraY:.22,cropTopoExtra:0,w:464,h:832},"Doutor (29).mp4":{assunto:"pessoa",ancoraY:.22,cropTopoExtra:0,w:464,h:832},"Doutor (30).mp4":{assunto:"pessoa",ancoraY:.22,cropTopoExtra:0,w:464,h:832},"Doutor (31).mp4":{assunto:"pessoa",ancoraY:.22,cropTopoExtra:0,w:464,h:832},"Doutor (32).mp4":{assunto:"pessoa",ancoraY:.22,cropTopoExtra:0,w:720,h:1280},"Doutor (33).mp4":{assunto:"pessoa",ancoraY:.22,cropTopoExtra:0,w:720,h:1280},"Doutor (34).mp4":{assunto:"pessoa",ancoraY:.22,cropTopoExtra:0,w:720,h:1280},"Doutor (35).mp4":{assunto:"pessoa",ancoraY:.22,cropTopoExtra:0,w:720,h:1280},"Doutor (36).mp4":{assunto:"pessoa",ancoraY:.22,cropTopoExtra:0,w:720,h:1280},"Doutor (37).mp4":{assunto:"pessoa",ancoraY:.22,cropTopoExtra:0,w:720,h:1280},"Doutor (38).mp4":{assunto:"pessoa",ancoraY:.22,cropTopoExtra:0,w:720,h:1280},"Doutor (4).mp4":{assunto:"pessoa",ancoraY:.22,cropTopoExtra:0,w:464,h:832},"Doutor (5).mp4":{assunto:"pessoa",ancoraY:.22,cropTopoExtra:0,w:464,h:832},"Doutor (6).mp4":{assunto:"pessoa",ancoraY:.22,cropTopoExtra:0,w:464,h:832},"Doutor (7).mp4":{assunto:"pessoa",ancoraY:.22,cropTopoExtra:0,w:720,h:1280},"Exames.mp4":{assunto:"aberto",ancoraY:.48,cropTopoExtra:0,w:720,h:1280},"Falhou na cama (1).mp4":{assunto:"pessoa",ancoraY:.3,cropTopoExtra:0,w:464,h:832},"Falhou na cama (10).mp4":{assunto:"pessoa",ancoraY:.3,cropTopoExtra:0,w:464,h:832},"Falhou na cama (11).mp4":{assunto:"pessoa",ancoraY:.3,cropTopoExtra:0,w:464,h:832},"Falhou na cama (12).mp4":{assunto:"pessoa",ancoraY:.3,cropTopoExtra:0,w:464,h:832},"Falhou na cama (13).mp4":{assunto:"pessoa",ancoraY:.3,cropTopoExtra:0,w:464,h:832},"Falhou na cama (14).mp4":{assunto:"pessoa",ancoraY:.3,cropTopoExtra:0,w:464,h:832},"Falhou na cama (15).mp4":{assunto:"pessoa",ancoraY:.3,cropTopoExtra:0,w:464,h:832},"Falhou na cama (16).mp4":{assunto:"pessoa",ancoraY:.3,cropTopoExtra:0,w:464,h:832},"Falhou na cama (17).mp4":{assunto:"pessoa",ancoraY:.3,cropTopoExtra:0,w:720,h:1280},"Falhou na cama (18).mp4":{assunto:"pessoa",ancoraY:.3,cropTopoExtra:0,w:720,h:1280},"Falhou na cama (19).mp4":{assunto:"pessoa",ancoraY:.3,cropTopoExtra:0,w:720,h:1280},"Falhou na cama (2).mp4":{assunto:"pessoa",ancoraY:.3,cropTopoExtra:0,w:464,h:832},"Falhou na cama (20).mp4":{assunto:"pessoa",ancoraY:.3,cropTopoExtra:0,w:720,h:1280},"Falhou na cama (21).mp4":{assunto:"pessoa",ancoraY:.3,cropTopoExtra:0,w:720,h:1280},"Falhou na cama (22).mp4":{assunto:"pessoa",ancoraY:.3,cropTopoExtra:0,w:720,h:1280},"Falhou na cama (23).mp4":{assunto:"pessoa",ancoraY:.3,cropTopoExtra:0,w:720,h:1280},"Falhou na cama (24).mp4":{assunto:"pessoa",ancoraY:.3,cropTopoExtra:0,w:720,h:1280},"Falhou na cama (3).mp4":{assunto:"pessoa",ancoraY:.3,cropTopoExtra:0,w:720,h:1280},"Falhou na cama (4).mp4":{assunto:"pessoa",ancoraY:.3,cropTopoExtra:0,w:464,h:832},"Falhou na cama (5).mp4":{assunto:"pessoa",ancoraY:.3,cropTopoExtra:0,w:464,h:832},"Falhou na cama (6).mp4":{assunto:"pessoa",ancoraY:.3,cropTopoExtra:0,w:464,h:832},"Falhou na cama (7).mp4":{assunto:"pessoa",ancoraY:.3,cropTopoExtra:0,w:464,h:832},"Falhou na cama (8).mp4":{assunto:"pessoa",ancoraY:.3,cropTopoExtra:0,w:464,h:832},"Falhou na cama (9).mp4":{assunto:"pessoa",ancoraY:.3,cropTopoExtra:0,w:464,h:832},"Frustrado (1).mp4":{assunto:"pessoa",ancoraY:.3,cropTopoExtra:0,w:464,h:832},"Frustrado (10).mp4":{assunto:"pessoa",ancoraY:.3,cropTopoExtra:0,w:464,h:832},"Frustrado (11).mp4":{assunto:"pessoa",ancoraY:.3,cropTopoExtra:0,w:464,h:832},"Frustrado (12).mp4":{assunto:"pessoa",ancoraY:.3,cropTopoExtra:0,w:464,h:832},"Frustrado (13).mp4":{assunto:"pessoa",ancoraY:.3,cropTopoExtra:0,w:464,h:832},"Frustrado (14).mp4":{assunto:"pessoa",ancoraY:.3,cropTopoExtra:0,w:464,h:832},"Frustrado (15).mp4":{assunto:"pessoa",ancoraY:.3,cropTopoExtra:0,w:720,h:1280},"Frustrado (16).mp4":{assunto:"pessoa",ancoraY:.3,cropTopoExtra:0,w:720,h:1280},"Frustrado (17).mp4":{assunto:"pessoa",ancoraY:.3,cropTopoExtra:0,w:720,h:1280},"Frustrado (18).mp4":{assunto:"pessoa",ancoraY:.3,cropTopoExtra:0,w:464,h:832},"Frustrado (19).mp4":{assunto:"pessoa",ancoraY:.3,cropTopoExtra:0,w:464,h:832},"Frustrado (2).mp4":{assunto:"pessoa",ancoraY:.3,cropTopoExtra:0,w:464,h:832},"Frustrado (20).mp4":{assunto:"pessoa",ancoraY:.3,cropTopoExtra:0,w:464,h:832},"Frustrado (21).mp4":{assunto:"pessoa",ancoraY:.3,cropTopoExtra:0,w:464,h:832},"Frustrado (22).mp4":{assunto:"pessoa",ancoraY:.3,cropTopoExtra:0,w:464,h:832},"Frustrado (23).mp4":{assunto:"pessoa",ancoraY:.3,cropTopoExtra:0,w:464,h:832},"Frustrado (24).mp4":{assunto:"pessoa",ancoraY:.3,cropTopoExtra:0,w:720,h:1280},"Frustrado (25).mp4":{assunto:"pessoa",ancoraY:.3,cropTopoExtra:0,w:464,h:832},"Frustrado (26).mp4":{assunto:"pessoa",ancoraY:.3,cropTopoExtra:0,w:720,h:1280},"Frustrado (27).mp4":{assunto:"pessoa",ancoraY:.3,cropTopoExtra:0,w:720,h:1280},"Frustrado (28).mp4":{assunto:"pessoa",ancoraY:.3,cropTopoExtra:0,w:720,h:1280},"Frustrado (29).mp4":{assunto:"pessoa",ancoraY:.3,cropTopoExtra:0,w:720,h:1280},"Frustrado (3).mp4":{assunto:"pessoa",ancoraY:.3,cropTopoExtra:0,w:720,h:1280},"Frustrado (30).mp4":{assunto:"pessoa",ancoraY:.3,cropTopoExtra:0,w:720,h:1280},"Frustrado (31).mp4":{assunto:"pessoa",ancoraY:.3,cropTopoExtra:0,w:720,h:1280},"Frustrado (32).mp4":{assunto:"pessoa",ancoraY:.3,cropTopoExtra:0,w:720,h:1280},"Frustrado (33).mp4":{assunto:"pessoa",ancoraY:.3,cropTopoExtra:0,w:720,h:1280},"Frustrado (34).mp4":{assunto:"pessoa",ancoraY:.3,cropTopoExtra:0,w:720,h:1280},"Frustrado (35).mp4":{assunto:"pessoa",ancoraY:.3,cropTopoExtra:0,w:720,h:1280},"Frustrado (36).mp4":{assunto:"pessoa",ancoraY:.3,cropTopoExtra:0,w:720,h:1280},"Frustrado (37).mp4":{assunto:"pessoa",ancoraY:.3,cropTopoExtra:0,w:720,h:1280},"Frustrado (4).mp4":{assunto:"pessoa",ancoraY:.3,cropTopoExtra:0,w:464,h:832},"Frustrado (5).mp4":{assunto:"pessoa",ancoraY:.3,cropTopoExtra:0,w:720,h:1280},"Frustrado (6).mp4":{assunto:"pessoa",ancoraY:.3,cropTopoExtra:0,w:720,h:1280},"Frustrado (7).mp4":{assunto:"pessoa",ancoraY:.3,cropTopoExtra:0,w:464,h:832},"Frustrado (8).mp4":{assunto:"pessoa",ancoraY:.3,cropTopoExtra:0,w:464,h:832},"Frustrado (9).mp4":{assunto:"pessoa",ancoraY:.3,cropTopoExtra:0,w:464,h:832},"Horm\xF4nio.mp4":{assunto:"aberto",ancoraY:.45,cropTopoExtra:0,w:720,h:1280},"Injet\xE1veis (1).mp4":{assunto:"aberto",ancoraY:.45,cropTopoExtra:0,w:720,h:1280},"Injet\xE1veis (2).mp4":{assunto:"aberto",ancoraY:.45,cropTopoExtra:0,w:720,h:1280},"Jogando fora o viagra (1).mp4":{assunto:"aberto",ancoraY:.42,cropTopoExtra:.04,w:720,h:1280},"Jogando fora o viagra (2).mp4":{assunto:"aberto",ancoraY:.42,cropTopoExtra:.04,w:720,h:1280},"Jogando fora o viagra (3).mp4":{assunto:"aberto",ancoraY:.42,cropTopoExtra:.04,w:464,h:832},"Medicamento (2).mp4":{assunto:"aberto",ancoraY:.5,cropTopoExtra:0,w:1080,h:1920},"Medicamento.mp4":{assunto:"aberto",ancoraY:.5,cropTopoExtra:0,w:1080,h:1920},"Medida paliativa (1).mp4":{assunto:"aberto",ancoraY:.5,cropTopoExtra:0,w:720,h:1280},"Medida paliativa (2).mp4":{assunto:"aberto",ancoraY:.5,cropTopoExtra:0,w:720,h:1280},"Medida paliativa (3).mp4":{assunto:"aberto",ancoraY:.5,cropTopoExtra:0,w:720,h:1280},"Medida paliativa (4).mp4":{assunto:"aberto",ancoraY:.5,cropTopoExtra:0,w:720,h:1280},"Medida paliativa (5).mp4":{assunto:"aberto",ancoraY:.5,cropTopoExtra:0,w:720,h:1280},"Medida paliativa (6).mp4":{assunto:"aberto",ancoraY:.5,cropTopoExtra:0,w:720,h:1280},"Medida paliativa (7).mp4":{assunto:"aberto",ancoraY:.5,cropTopoExtra:0,w:720,h:1280},"Medida paliativa (8).mp4":{assunto:"aberto",ancoraY:.5,cropTopoExtra:0,w:720,h:1280},"Milhares de homens (1).mp4":{assunto:"aberto",ancoraY:.48,cropTopoExtra:0,w:464,h:832},"Mulher triste (1).mov":{assunto:"pessoa",ancoraY:.45,cropTopoExtra:0,w:1920,h:1080},"Mulher triste (2).mov":{assunto:"pessoa",ancoraY:.35,cropTopoExtra:0,w:2160,h:4096},"Risco de infarto (1).mp4":{assunto:"pessoa",ancoraY:.3,cropTopoExtra:0,w:720,h:1280},"Risco de infarto (2).mp4":{assunto:"pessoa",ancoraY:.3,cropTopoExtra:0,w:464,h:832},"Risco de infarto (3).mp4":{assunto:"pessoa",ancoraY:.3,cropTopoExtra:0,w:720,h:1280},"Sala reservada.mp4":{assunto:"dupla",ancoraY:.32,cropTopoExtra:0,w:720,h:1280},"Separa\xE7\xE3o (1).mp4":{assunto:"pessoa",ancoraY:.3,cropTopoExtra:0,w:720,h:1280},"Separa\xE7\xE3o (2).mp4":{assunto:"pessoa",ancoraY:.3,cropTopoExtra:0,w:464,h:832},"Separa\xE7\xE3o (3).mp4":{assunto:"pessoa",ancoraY:.3,cropTopoExtra:0,w:464,h:832},"Separa\xE7\xE3o (4).mp4":{assunto:"pessoa",ancoraY:.3,cropTopoExtra:0,w:720,h:1280},"Separa\xE7\xE3o (5).mov":{assunto:"pessoa",ancoraY:.3,cropTopoExtra:0,w:1920,h:1080},"Sono (1).mp4":{assunto:"pessoa",ancoraY:.45,cropTopoExtra:0,w:1920,h:1080},"Sono (2).mp4":{assunto:"pessoa",ancoraY:.35,cropTopoExtra:0,w:1080,h:1920},"Teleconsulta (1).mp4":{assunto:"pessoa",ancoraY:.25,cropTopoExtra:0,w:464,h:832},"Teleconsulta (10).mp4":{assunto:"pessoa",ancoraY:.25,cropTopoExtra:0,w:464,h:832},"Teleconsulta (11).mp4":{assunto:"pessoa",ancoraY:.25,cropTopoExtra:0,w:464,h:832},"Teleconsulta (12).mp4":{assunto:"pessoa",ancoraY:.25,cropTopoExtra:0,w:720,h:1280},"Teleconsulta (13).mp4":{assunto:"pessoa",ancoraY:.25,cropTopoExtra:0,w:720,h:1280},"Teleconsulta (14).mp4":{assunto:"pessoa",ancoraY:.25,cropTopoExtra:0,w:720,h:1280},"Teleconsulta (15).mp4":{assunto:"pessoa",ancoraY:.25,cropTopoExtra:0,w:720,h:1280},"Teleconsulta (16).mp4":{assunto:"pessoa",ancoraY:.25,cropTopoExtra:0,w:464,h:832},"Teleconsulta (17).mp4":{assunto:"pessoa",ancoraY:.25,cropTopoExtra:0,w:464,h:832},"Teleconsulta (18).mp4":{assunto:"pessoa",ancoraY:.25,cropTopoExtra:0,w:464,h:832},"Teleconsulta (19).mp4":{assunto:"pessoa",ancoraY:.25,cropTopoExtra:0,w:464,h:832},"Teleconsulta (2).mp4":{assunto:"pessoa",ancoraY:.25,cropTopoExtra:0,w:464,h:832},"Teleconsulta (20).mp4":{assunto:"pessoa",ancoraY:.25,cropTopoExtra:0,w:720,h:1280},"Teleconsulta (21).mp4":{assunto:"pessoa",ancoraY:.25,cropTopoExtra:0,w:720,h:1280},"Teleconsulta (22).mp4":{assunto:"pessoa",ancoraY:.25,cropTopoExtra:0,w:720,h:1280},"Teleconsulta (23).mp4":{assunto:"pessoa",ancoraY:.25,cropTopoExtra:0,w:720,h:1280},"Teleconsulta (24).mp4":{assunto:"pessoa",ancoraY:.25,cropTopoExtra:0,w:720,h:1280},"Teleconsulta (25).mp4":{assunto:"pessoa",ancoraY:.25,cropTopoExtra:0,w:720,h:1280},"Teleconsulta (3).mp4":{assunto:"pessoa",ancoraY:.25,cropTopoExtra:0,w:464,h:832},"Teleconsulta (4).mp4":{assunto:"pessoa",ancoraY:.25,cropTopoExtra:0,w:464,h:832},"Teleconsulta (5).mp4":{assunto:"pessoa",ancoraY:.25,cropTopoExtra:0,w:464,h:832},"Teleconsulta (6).mp4":{assunto:"pessoa",ancoraY:.25,cropTopoExtra:0,w:464,h:832},"Teleconsulta (7).mp4":{assunto:"pessoa",ancoraY:.25,cropTopoExtra:0,w:464,h:832},"Teleconsulta (8).mp4":{assunto:"pessoa",ancoraY:.25,cropTopoExtra:0,w:720,h:1280},"Teleconsulta (9).mp4":{assunto:"pessoa",ancoraY:.25,cropTopoExtra:0,w:464,h:832},"Vasos sangu\xEDneos (1).mp4":{assunto:"aberto",ancoraY:.5,cropTopoExtra:0,w:464,h:832},"Vasos sangu\xEDneos (2).mp4":{assunto:"aberto",ancoraY:.5,cropTopoExtra:0,w:720,h:1280},"Vasos sangu\xEDneos (3).mp4":{assunto:"aberto",ancoraY:.5,cropTopoExtra:0,w:720,h:1280},"Vasos sangu\xEDneos (4).mp4":{assunto:"aberto",ancoraY:.5,cropTopoExtra:0,w:720,h:1280},"Vasos sangu\xEDneos (5).mp4":{assunto:"aberto",ancoraY:.5,cropTopoExtra:0,w:720,h:1280},"Vasos sangu\xEDneos (6).mp4":{assunto:"aberto",ancoraY:.5,cropTopoExtra:0,w:720,h:1280},"Vasos sangu\xEDneos (7).mp4":{assunto:"aberto",ancoraY:.5,cropTopoExtra:0,w:720,h:1280},"Viagra (1).mp4":{assunto:"pessoa",ancoraY:.26,cropTopoExtra:0,w:720,h:1280},"Viagra (10).mp4":{assunto:"pessoa",ancoraY:.26,cropTopoExtra:0,w:464,h:832},"Viagra (11).mp4":{assunto:"pessoa",ancoraY:.26,cropTopoExtra:0,w:464,h:832},"Viagra (12).mp4":{assunto:"pessoa",ancoraY:.26,cropTopoExtra:0,w:464,h:832},"Viagra (13).mp4":{assunto:"pessoa",ancoraY:.26,cropTopoExtra:0,w:464,h:832},"Viagra (14).mp4":{assunto:"pessoa",ancoraY:.26,cropTopoExtra:0,w:464,h:832},"Viagra (15).mp4":{assunto:"pessoa",ancoraY:.26,cropTopoExtra:0,w:464,h:832},"Viagra (16).mp4":{assunto:"pessoa",ancoraY:.26,cropTopoExtra:0,w:464,h:832},"Viagra (17).mp4":{assunto:"pessoa",ancoraY:.26,cropTopoExtra:0,w:464,h:832},"Viagra (18).mp4":{assunto:"pessoa",ancoraY:.26,cropTopoExtra:0,w:464,h:832},"Viagra (19).mp4":{assunto:"pessoa",ancoraY:.26,cropTopoExtra:0,w:464,h:832},"Viagra (2).mp4":{assunto:"pessoa",ancoraY:.26,cropTopoExtra:0,w:720,h:1280},"Viagra (20).mp4":{assunto:"pessoa",ancoraY:.26,cropTopoExtra:0,w:464,h:832},"Viagra (21).mp4":{assunto:"pessoa",ancoraY:.26,cropTopoExtra:0,w:464,h:832},"Viagra (22).mp4":{assunto:"pessoa",ancoraY:.26,cropTopoExtra:0,w:464,h:832},"Viagra (23).mp4":{assunto:"pessoa",ancoraY:.26,cropTopoExtra:0,w:464,h:832},"Viagra (24).mp4":{assunto:"pessoa",ancoraY:.26,cropTopoExtra:0,w:464,h:832},"Viagra (25).mp4":{assunto:"pessoa",ancoraY:.26,cropTopoExtra:0,w:464,h:832},"Viagra (26).mp4":{assunto:"pessoa",ancoraY:.26,cropTopoExtra:0,w:464,h:832},"Viagra (27).mp4":{assunto:"pessoa",ancoraY:.26,cropTopoExtra:0,w:464,h:832},"Viagra (28).mp4":{assunto:"pessoa",ancoraY:.26,cropTopoExtra:0,w:464,h:832},"Viagra (29).mp4":{assunto:"pessoa",ancoraY:.26,cropTopoExtra:0,w:720,h:1280},"Viagra (3).mp4":{assunto:"pessoa",ancoraY:.26,cropTopoExtra:0,w:720,h:1280},"Viagra (30).mp4":{assunto:"pessoa",ancoraY:.26,cropTopoExtra:0,w:720,h:1280},"Viagra (31).mp4":{assunto:"pessoa",ancoraY:.26,cropTopoExtra:0,w:464,h:832},"Viagra (32).mp4":{assunto:"pessoa",ancoraY:.26,cropTopoExtra:0,w:464,h:832},"Viagra (33).mp4":{assunto:"pessoa",ancoraY:.26,cropTopoExtra:0,w:464,h:832},"Viagra (34).mp4":{assunto:"pessoa",ancoraY:.26,cropTopoExtra:0,w:464,h:832},"Viagra (35).mp4":{assunto:"pessoa",ancoraY:.26,cropTopoExtra:0,w:464,h:832},"Viagra (36).mp4":{assunto:"pessoa",ancoraY:.26,cropTopoExtra:0,w:464,h:832},"Viagra (37).mp4":{assunto:"pessoa",ancoraY:.26,cropTopoExtra:0,w:720,h:1280},"Viagra (38).mp4":{assunto:"pessoa",ancoraY:.26,cropTopoExtra:0,w:720,h:1280},"Viagra (39).mp4":{assunto:"pessoa",ancoraY:.26,cropTopoExtra:0,w:720,h:1280},"Viagra (4).mp4":{assunto:"pessoa",ancoraY:.26,cropTopoExtra:0,w:720,h:1280},"Viagra (40).mp4":{assunto:"pessoa",ancoraY:.26,cropTopoExtra:0,w:720,h:1280},"Viagra (41).mp4":{assunto:"pessoa",ancoraY:.26,cropTopoExtra:0,w:720,h:1280},"Viagra (42).mp4":{assunto:"pessoa",ancoraY:.26,cropTopoExtra:0,w:720,h:1280},"Viagra (43).mp4":{assunto:"pessoa",ancoraY:.26,cropTopoExtra:0,w:720,h:1280},"Viagra (5).mp4":{assunto:"pessoa",ancoraY:.26,cropTopoExtra:0,w:720,h:1280},"Viagra (6).mp4":{assunto:"pessoa",ancoraY:.26,cropTopoExtra:0,w:720,h:1280},"Viagra (7).mp4":{assunto:"pessoa",ancoraY:.26,cropTopoExtra:0,w:464,h:832},"Viagra (8).mp4":{assunto:"pessoa",ancoraY:.26,cropTopoExtra:0,w:464,h:832},"Viagra (9).mp4":{assunto:"pessoa",ancoraY:.26,cropTopoExtra:0,w:464,h:832},"lifestyle (1).mp4":{assunto:"pessoa",ancoraY:.32,cropTopoExtra:0,w:464,h:832},"lifestyle (2).mp4":{assunto:"pessoa",ancoraY:.32,cropTopoExtra:0,w:464,h:832},"lifestyle (3).mp4":{assunto:"pessoa",ancoraY:.32,cropTopoExtra:0,w:464,h:832}}};var Oo=ro("premierepro"),Ni=1,_e="AE.ADBE Motion",Ve="AE.Impact_Crop_FX",Oi="AE.ADBE AECrop",$i="Top",pd="Bottom",qi="Feather",Ii="Roundness",Ri=Ci;async function Ye(){let o=await Oo.Project.getActiveProject();if(!o)throw new Error("Nenhum projeto aberto.");let e=await o.getActiveSequence();if(!e)throw new Error("Nenhuma sequencia ativa. Abra a sequencia do video.");return{project:o,sequence:e}}async function fd(){let o=await z("autosplit-perfil-override.json");return o&&typeof o=="object"?o:{}}async function gd(){let o=new Map;for(let[e,a]of Object.entries(ra(await z("trazidos.json")).porCaminho))!a.w||!a.h||(o.set(e,a),o.set(a.nome,a));return o}async function Dn(o){let e=await no();if(!(e.width>0)||!(e.height>0))throw new Error("Nao deu pra ler o quadro da sequencia.");let a=await fd(),n=await gd(),t=li(o.divisao),r=await qo(),i=(o.faixa===null?r:r.filter(m=>m.videoTrackIndex===o.faixa)).filter(m=>!o.entre||o.entre.some(d=>m.startSeconds>=d.inicio-.02&&m.startSeconds<d.fim)),s=[],c=[],l=new Map;for(let m of i){let d=Ri.porArquivo[m.sourceName],u=n.get(m.caminho)??n.get(m.sourceName),g=(d?.w&&d?.h?{w:d.w,h:d.h}:void 0)??(u?.w&&u?.h?u:void 0)??ui(m.sourceName);if(!g?.w||!g?.h){l.set(m.sourceName,(l.get(m.sourceName)??0)+1);continue}let p=g.h>=g.w?"retrato":"paisagem",f=si(Ri,a,d?m.sourceName:u?.nome??m.sourceName,p),y={W:e.width,H:e.height,brollTopoFrac:t,w:g.w,h:g.h,ancoraY:f.ancoraY,assunto:f.assunto,cropTopoExtra:f.cropTopoExtra};c.push({sourceName:m.sourceName,startSeconds:m.startSeconds,endSeconds:m.endSeconds,videoTrackIndex:m.videoTrackIndex,orientacao:p,perfilOrigem:f.origem,enquadramento:o.lado==="cima"?mi(e.width,e.height,g.w,g.h,t):di(y),geom:y})}if(s.push(`${e.name} \u2014 ${e.width}x${e.height}`),s.push(`${i.length} clipes acima da V1${o.faixa===null?"":` (so a V${o.faixa+1})`}`),s.push(`${c.length} sao B-roll da biblioteca \u2014 so nesses eu mexo.`),l.size>0){s.push(`${[...l.values()].reduce((m,d)=>m+d,0)} intocados (fora da biblioteca):`);for(let[m,d]of l)s.push(`   ${m}${d>1?` x${d}`:""}`)}return c.length===0&&s.push("Nada a fazer."),{W:e.width,H:e.height,itens:c,linhas:s}}async function Be(o,e){let a=await o.getVideoTrack(e);if(!a)throw new Error(`V${e+1} nao existe nesta sequencia.`);return a.getTrackItems(Ni,!1)}async function Fn(o){let e=await o.getProjectItem?.();return e?tr(e):o.name}async function Oa(o,e,a){for(let n of o)if(await Fn(n)===e&&Math.abs((await n.getStartTime()).seconds-a)<.5)return n;return null}async function Po(o,e){for(let a=0;a<o.getComponentCount();a++){let n=o.getComponentAtIndex(a);if(await n.getMatchName()===e)return n}return null}async function vo(o,e){for(let a=0;a<o.getParamCount();a++){let n=o.getParam(a);if(n.displayName===e)return n}return null}function On(o,e,a,n){let t=Oo.PointF,r=o/a,i=e/n,s=new t(r,i);return s.x=r,s.y=i,{ponto:s,leu:`${s.x.toFixed(4)},${s.y.toFixed(4)}`}}async function Qe(o){try{let a=(await o.getStartValue?.())?.value;if(a&&typeof a=="object"&&"value"in a)return a.value;if(a!==void 0)return a}catch{}try{return await o.getValueAtTime?.(await Oo.TickTime.createWithSeconds(0))}catch{return}}function hd(o){let e=Number(typeof o=="object"&&o!==null?o.value:o);return Number.isFinite(e)?e:NaN}function bd(o){if(Array.isArray(o))return Number(o[1]);let e=Number(o?.y);return Number.isFinite(e)?e:NaN}async function Da(o){let e=await Dn(o),a=[...e.linhas];if(e.itens.length===0)return await F("ultimo-log-autosplit.json",{quando:Date.now(),linhas:a}),{ok:!0,linhas:a};let{project:n,sequence:t}=await Ye(),r={},i=!0,s=[],c=[],l=o.feather??Na,m=o.lado==="cima"?"de cima":"de baixo",d=[],u=0,g=0,p=0;for(let f of e.itens){let y=await Oa(await Be(t,f.videoTrackIndex),f.sourceName,f.startSeconds);if(!y){a.push(`${f.sourceName}: nao achei na timeline, pulado`),i=!1;continue}let b=await y.getComponentChain(),P=await Po(b,_e),T=P?await vo(P,"Scale"):null,M=P?await vo(P,"Position"):null;if(!T||!M){a.push(`${f.sourceName}: sem Scale/Position no Motion, pulado`),i=!1;continue}let w=f.enquadramento;s.push(()=>T.createSetValueAction(T.createKeyframe(w.escalaPct),!0)),s.push(()=>{let{ponto:E,leu:q}=On(w.posX,w.posY,e.W,e.H);return d.length<2&&d.push(`${f.sourceName}: pedi ${w.posX},${Math.round(w.posY)} px = ${q} normalizado`),M.createSetValueAction(M.createKeyframe(E),!0)});let S=await Po(b,Oi);S&&(s.push(()=>b.createRemoveComponentAction(S)),p++);let h=await Po(b,Ve);if(h&&!o.refazer)u++;else{h&&s.push(()=>b.createRemoveComponentAction(h));let E=await Oo.VideoFilterFactory.createComponent(Ve);s.push(()=>b.createAppendComponentAction(E)),c.push({sourceName:f.sourceName,videoTrackIndex:f.videoTrackIndex,startSeconds:f.startSeconds,topoPct:w.cropTopoPct,basePct:w.cropBasePct??0})}r[`${f.sourceName}@${f.startSeconds.toFixed(3)}`]={sourceName:f.sourceName,startSeconds:f.startSeconds,videoTrackIndex:f.videoTrackIndex,geom:f.geom,usado:w},g++}if(s.length===0)return a.push("Nada aplicavel."),await F("ultimo-log-autosplit.json",{quando:Date.now(),linhas:a}),{ok:!1,linhas:a};Q(n,`SplitScreen: ${g} B-rolls`,f=>{for(let y of s)f(y())}),a.push(`${g} B-rolls posicionados na caixa ${m}.`);for(let f of d)a.push(`   ${f}`);if(u>0&&a.push(`${u} ja tinham o Rounded Crop (pulados; marque "Refazer do zero" pra refazer).`),p>0&&a.push(`${p} tinham o Crop do Premiere de um split antigo: tirado, senao os dois cortes somam.`),c.length>0){let f=await Ye(),y=[];for(let P of c){let T=await Oa(await Be(f.sequence,P.videoTrackIndex),P.sourceName,P.startSeconds),M=T?await Po(await T.getComponentChain(),Ve):null;if(!M){a.push(`${P.sourceName}: efeito sumiu antes de setar`),i=!1;continue}for(let[w,S]of[[$i,P.topoPct],[pd,P.basePct],[qi,l],[Ii,ci]]){let h=await vo(M,w);h?y.push(()=>h.createSetValueAction(h.createKeyframe(S),!0)):a.push(`${P.sourceName}: param "${w}" nao encontrado no efeito`)}}y.length>0&&(Q(f.project,"SplitScreen: corte de topo e feather",P=>{for(let T of y)P(T())}),a.push(`${c.length} Rounded Crop aplicados (corte ${o.lado==="cima"?"embaixo":"em cima"} por clipe, feather ${l}%).`));let b=c[0];if(b){let P=await Ye(),T=await Oa(await Be(P.sequence,b.videoTrackIndex),b.sourceName,b.startSeconds);if(T){let M=await T.getComponentChain(),w=await Po(M,_e),S=await Po(M,Ve),h=[];if(w){let E=await vo(w,"Scale"),q=await vo(w,"Position");if(E&&h.push(`Scale=${JSON.stringify(await Qe(E))}`),q){let x=await Qe(q),R=bd(x);h.push(`Position y=${R} normalizado = ${Math.round(R*e.H)} px`)}}if(S)for(let E of[$i,qi,Ii]){let q=await vo(S,E);h.push(`${E}=${q?JSON.stringify(await Qe(q)):"(param sumiu)"}`)}else h.push("Rounded Crop NAO esta na chain");a.push(`conferindo ${b.sourceName} (pedi Top=${b.topoPct.toFixed(1)}):`);for(let E of h)a.push(`   ${E}`)}}}return await F("autosplit-aplicado.json",{quando:Date.now(),divisao:o.divisao,itens:r}),await F("ultimo-log-autosplit.json",{quando:Date.now(),linhas:a}),{ok:i,linhas:a}}function xd(o){if(Array.isArray(o))return Number(o[0]);let e=Number(o?.x);return Number.isFinite(e)?e:NaN}async function Di(){let o=await no();if(!(o.width>0)||o.width!==o.height)throw new Error(`A sequencia ativa e ${o.width}x${o.height}. Duplique a Reels, mude para 1080x1080 (Sequence Settings) e rode de novo.`);let e=o.width,a=[`${o.name} \u2014 ${e}x${e}`],{project:n,sequence:t}=await Ye(),r=[];for(let d of await Be(t,0)){let u=await Po(await d.getComponentChain(),_e),g=u?await vo(u,"Scale"):null,p=u?await vo(u,"Position"):null;if(!g||!p)continue;let f=hd(await Qe(g)),y=xd(await Qe(p));Number.isFinite(f)&&f>0&&Number.isFinite(y)&&r.push({nome:await Fn(d)??"",escala:g,pos:p,s:f,x:y})}let i=new Map;for(let d of new Set(r.map(u=>u.nome))){let u=fi(r.filter(p=>p.nome===d).map(p=>p.s)),g=u===void 0?void 0:pi(u);g?i.set(d,qn(e,g.w,g.h)):a.push(`V1: ${d} com escala-base ${u} \u2014 tamanho desconhecido, ficou como estava`)}let s=[];for(let d of r){let u=i.get(d.nome);if(u===void 0)continue;let g=e*(.5+(d.x-.5)*(u/d.s));s.push(()=>d.escala.createSetValueAction(d.escala.createKeyframe(u),!0)),s.push(()=>d.pos.createSetValueAction(d.pos.createKeyframe(On(g,e/2,e,e).ponto),!0))}s.length>0&&Q(n,`Quadrado: ${s.length/2} clipes da V1`,d=>{for(let u of s)d(u())}),a.push(`V1: ${s.length/2} de ${r.length} clipes cobrindo o quadrado (${[...i.values()].map(d=>Math.round(d)).join(", ")}%).`);let c=await Dn({faixa:null,divisao:No,subirDoutor:!1,refazer:!1}),l=[],m=[];for(let d of c.itens){let u=await Oa(await Be(t,d.videoTrackIndex),d.sourceName,d.startSeconds),g=u?await u.getComponentChain():null,p=g?await Po(g,_e):null,f=p?await vo(p,"Scale"):null,y=p?await vo(p,"Position"):null;if(!g||!f||!y)continue;let b=qn(e,d.geom.w,d.geom.h,$n);l.push(()=>f.createSetValueAction(f.createKeyframe(b),!0)),l.push(()=>y.createSetValueAction(y.createKeyframe(On(e/2,e/2,e,e).ponto),!0));for(let P of[Ve,Oi]){let T=await Po(g,P);T&&m.push(()=>g.createRemoveComponentAction(T))}}return l.length>0&&Q(n,`Quadrado: ${l.length/2} B-rolls`,d=>{for(let u of l)d(u())}),m.length>0&&Q(n,"Quadrado: tirar o corte do split",d=>{for(let u of m)d(u())}),a.push(`B-roll: ${l.length/2} cobrindo o quadrado com ${Math.round(($n-1)*100)}% de sobra, ${m.length} corte(s) do split tirado(s).`),a.push(...c.linhas.filter(d=>/intocados|^\s{3}/.test(d))),await F("ultimo-log-autosplit.json",{quando:Date.now(),linhas:a}),{ok:!0,linhas:a}}async function Fi(){let o=[],e={},a=await Oo.VideoFilterFactory.getDisplayNames(),n=await Oo.VideoFilterFactory.getMatchNames();e.displayNames=a,e.matchNames=n,o.push(`${a.length} efeitos de video disponiveis`);let t=a.findIndex(h=>/cantos?\s+arredondad|rounded/i.test(h)),r=t>=0?{display:a[t],match:n[t]}:null;e.candidato=r,o.push(r?`candidato: "${r.display}" (${r.match})`:"nenhum candidato obvio \u2014 ver a lista no JSON");let i=await Dn({faixa:null,divisao:No,subirDoutor:!1,refazer:!1});if(i.itens.length===0)return o.push("sem B-roll acima da V1 \u2014 nao deu pra testar Motion/efeito no clipe"),await F("diag-autosplit.json",e),o;let s=i.itens[0],{project:c,sequence:l}=await Ye(),d=await(await l.getVideoTrack(s.videoTrackIndex)).getTrackItems(Ni,!1),u;for(let h of d)if(await Fn(h)===s.sourceName){u=h;break}if(!u)return o.push(`nao achei "${s.sourceName}" na V${s.videoTrackIndex+1}`),await F("diag-autosplit.json",e),o;let g=await u.getComponentChain(),p=async h=>{for(let E=0;E<g.getComponentCount();E++){let q=g.getComponentAtIndex(E);if(await q.getMatchName()===h)return q}return null},f=async(h,E)=>{for(let q=0;q<h.getParamCount();q++){let x=h.getParam(q);if(x.displayName===E)return x}return null},y=await p(_e);e.motionParams=y?Array.from({length:y.getParamCount()},(h,E)=>y.getParam(E).displayName):"Motion nao encontrado";let b=y?await f(y,"Scale"):null,P=y?await f(y,"Position"):null;for(let[h,E]of[["Scale",b],["Position",P]])try{if(!E?.getStartValue){e[`ler${h}`]="getStartValue ausente";continue}let q=await E.getStartValue();e[`ler${h}`]={tipo:typeof q,json:JSON.stringify(q),chaves:q?Object.keys(q):null}}catch(q){e[`ler${h}`]=`erro: ${q.message}`}let T=Oo.PointF,M=s.enquadramento.posX,w=s.enquadramento.posY,S=[["array",()=>[M,w]],["new PointF",()=>T?new T(M,w):null],["PointF()",()=>T?T(M,w):null]];if(P)for(let[h,E]of S)try{let q=E();if(q===null){e[`pos_${h}`]="ppro.PointF ausente";continue}Q(c,`diag: Position ${h}`,x=>{x(P.createSetValueAction(P.createKeyframe(q),!0))}),e[`pos_${h}`]="ok",o.push(`Position via ${h}: ok`)}catch(q){e[`pos_${h}`]=`erro: ${q.message}`}else e.pos_geral="param Position nao encontrado no Motion";if(r)try{let h=await Oo.VideoFilterFactory.createComponent(r.match);e.createComponent="ok",Q(c,"diag: anexar efeito",x=>{x(g.createAppendComponentAction(h))}),e.append="ok";let E=await p(r.match),q=[];if(E)for(let x=0;x<E.getParamCount();x++)q.push(E.getParam(x).displayName);e.paramsDoEfeito=q,o.push(`efeito anexado \u2014 params: ${q.join(", ")}`);for(let x of["Top","Feather","Roundness"]){let R=E?await f(E,x):null;try{R?(Q(c,`diag: set ${x}`,A=>{A(R.createSetValueAction(R.createKeyframe(x==="Top"?20:x==="Feather"?5:0),!0))}),e[`set${x}`]="ok"):e[`set${x}`]="param nao encontrado"}catch(A){e[`set${x}`]=`erro: ${A.message}`}}}catch(h){e.efeitoErro=`${h.message}`,o.push(`efeito: FALHOU \u2014 ${h.message}`)}return await F("diag-autosplit.json",e),o.push(""),o.push("Desfaca no Premiere (Ctrl+Z) ate a timeline voltar ao que era."),o.push("Me mande o diag-autosplit.json (PluginData do Cutline)."),o}function Fa(o,e){return String.fromCharCode(o.getUint8(e),o.getUint8(e+1),o.getUint8(e+2),o.getUint8(e+3))}function Ln(o){if(o.byteLength<12)return!1;let e=new DataView(o.buffer,o.byteOffset,o.byteLength);return Fa(e,0)==="RIFF"&&e.getUint32(4,!0)+8===o.byteLength}function vd(o,e,a,n){if(n&&a===32)return o.getFloat32(e,!0);if(a===16)return o.getInt16(e,!0)/32768;if(a===32)return o.getInt32(e,!0)/2147483648;if(a===24){let t=o.getUint8(e)|o.getUint8(e+1)<<8|o.getUint8(e+2)<<16;return(t&8388608?t-16777216:t)/8388608}throw new Error(`WAV de ${a} bits${n?" float":""} nao suportado. Exporte em 16 ou 24 bits.`)}function Pe(o,e=20){let a=new DataView(o.buffer,o.byteOffset,o.byteLength);if(o.byteLength<44||Fa(a,0)!=="RIFF"||Fa(a,8)!=="WAVE")throw new Error("Isto nao e um arquivo WAV.");let n=0,t=0,r=0,i=0,s=-1,c=0;for(let b=12;b+8<=o.byteLength;){let P=Fa(a,b),T=a.getUint32(b+4,!0),M=b+8;P==="fmt "&&T>=16?(n=a.getUint16(M,!0),t=a.getUint16(M+2,!0),r=a.getUint32(M+4,!0),i=a.getUint16(M+14,!0),n===65534&&T>=26&&(n=a.getUint16(M+24,!0))):P==="data"&&(s=M,c=Math.min(T,o.byteLength-M)),b=M+T+T%2}if(t<1||r<1||s<0)throw new Error("WAV sem cabecalho fmt/data legivel.");if(n!==1&&n!==3)throw new Error(`WAV comprimido (formato ${n}). Exporte em PCM.`);let l=i/8,m=l*t,d=Math.floor(c/m),u=Math.max(1,Math.round(r*e/1e3)),g=Array.from({length:t},()=>[]),p=new Float64Array(t),f=0,y=()=>{for(let b=0;b<t;b++){let P=Math.sqrt(p[b]/f);g[b].push(P>0?20*Math.log10(P):-120),p[b]=0}f=0};for(let b=0;b<d;b++){let P=s+b*m;for(let T=0;T<t;T++){let M=vd(a,P+T*l,i,n===3);p[T]=p[T]+M*M}++f===u&&y()}return f>0&&y(),{taxa:r,janelaMs:e,db:g}}var Ue={videoA:0,audioA:0,videoB:1,audioB:1};function Li(o,e){if(!(e>0))throw new Error(`fps invalido: ${e}`);return Math.round(o/1e3*e)}function Bi(o,e){let a=[];for(let n of o){let t=Li(n.inicioMs,e),r=Li(n.fimMs,e);if(r<=t)continue;let i=a[a.length-1];if(i&&i.speaker===n.speaker&&t<=i.fimF){a[a.length-1]={...i,fimF:Math.max(i.fimF,r)};continue}a.push({inicioF:t,fimF:r,speaker:n.speaker})}return a}function Qi(o){let e=o.flatMap(a=>[a.inicioF,a.fimF]);return[...new Set(e)].filter(a=>a>0).sort((a,n)=>a-n)}function zn(o,e){let a=o.find(n=>e>=n.inicioF&&e<n.fimF);return a?a.speaker:null}function _i(o,e,a){return o+(a-e)}var jn={duracaoMinimaPlanoMs:1200,falaMinimaMs:250,silencioParaJuntarMs:500,preRollMs:80,postRollMs:120};function zi(o,e){let a=[...o].sort((t,r)=>t.inicioMs-r.inicioMs),n=[];for(let t of a){let r=n[n.length-1];if(r&&t.inicioMs-r.fimMs<=e){n[n.length-1]={inicioMs:r.inicioMs,fimMs:Math.max(r.fimMs,t.fimMs)};continue}n.push(t)}return n}function ji(o,e){let t=zi(o,e.silencioParaJuntarMs).filter(r=>r.fimMs-r.inicioMs>=e.falaMinimaMs).map(r=>({inicioMs:Math.max(0,r.inicioMs-e.preRollMs),fimMs:r.fimMs+e.postRollMs}));return zi(t,0)}function Vi(o,e){return o.some(a=>e>=a.inicioMs&&e<a.fimMs)}function Vn(o,e,a){let n=ji(o,a),t=ji(e,a);if(n.length===0&&t.length===0)return[];let r=[...new Set([0,...n.flatMap(l=>[l.inicioMs,l.fimMs]),...t.flatMap(l=>[l.inicioMs,l.fimMs])])].sort((l,m)=>l-m),s=(n[0]?.inicioMs??1/0)<=(t[0]?.inicioMs??1/0)?"A":"B",c=[];for(let l=0;l<r.length-1;l++){let m=r[l],d=r[l+1],u=Vi(n,m),g=Vi(t,m);u&&!g?s="A":g&&!u&&(s="B"),c.push({inicioMs:m,fimMs:d,speaker:s})}return yd(c,a.duracaoMinimaPlanoMs)}function yd(o,e){let a=[],n=i=>{let s=a[a.length-1];if(s&&s.speaker===i.speaker){a[a.length-1]={...s,fimMs:i.fimMs};return}a.push(i)};for(let i of o)n(i);let t=[];for(let i of a){let s=i.fimMs-i.inicioMs<e,c=t[t.length-1];if(s&&c){t[t.length-1]={...c,fimMs:i.fimMs};continue}if(s&&!c&&a.length>1){t.push({...i,speaker:a[1].speaker});continue}t.push(i)}let r=[];for(let i of t){let s=r[r.length-1];if(s&&s.speaker===i.speaker){r[r.length-1]={...s,fimMs:i.fimMs};continue}r.push(i)}return r}var Ui={limiarDb:12,dominanciaDb:6};function Yi(o){if(o.length===0)return 0;let e=[...o].sort((a,n)=>a-n);return e[Math.floor(e.length*.2)]}function Hi(o,e,a,n){let t=Yi(o)+n.limiarDb,r=Yi(e)+n.limiarDb,i=Math.min(o.length,e.length),s=[],c=[],l=(m,d)=>{let u=m[m.length-1],g=d*a;if(u&&u.fimMs===g){m[m.length-1]={inicioMs:u.inicioMs,fimMs:g+a};return}m.push({inicioMs:g,fimMs:g+a})};for(let m=0;m<i;m++){let d=o[m],u=e[m],g=d>t,p=u>r;g&&d-u>=n.dominanciaDb?l(s,m):p&&u-d>=n.dominanciaDb?l(c,m):g&&!p?l(s,m):p&&!g&&l(c,m)}return{a:s,b:c}}var La=ro("premierepro"),Gi=ro("uxp"),wd=1,Do=254016e6;function Yn(o){if(!o)return String(o);let e=Object.getPrototypeOf(o)??{};return[...new Set([...Object.keys(o),...Object.getOwnPropertyNames(e)])].filter(a=>a!=="constructor").join(", ")}var Ed=["getVideoFrameRate","getFrameRate","videoFrameRate","frameRate"];async function Pd(o){for(let e of Ed){let a=o?.[e];if(a==null)continue;let n=typeof a=="function"?await a.call(o):a;if(n!=null)return n}}function Wi(o){let e=r=>{let i=Number(r);return Number.isFinite(i)&&i>0?i:0};if(typeof o=="number"||typeof o=="string"){let r=e(o);return r>0?{valor:r,tpf:0}:null}let a=o,n=e(a?.ticksPerFrame),t=e(a?.value)||(n>0?Do/n:0);return t>0?{valor:t,tpf:n}:null}async function Te(){let{sequence:o}=await Wo(),e=null;try{let a=Number(await o.getTimebase?.());if(Number.isFinite(a)&&a>0)return{valor:Do/a,tpf:a,origem:"sequence.getTimebase()"};e=await o.getSettings();for(let[n,t]of[["settings",e],["sequence",o]]){let r=Wi(await Pd(t));if(r)return{...r,origem:n}}return{valor:0,tpf:0,origem:`settings expoe: ${Yn(e)} | sequence expoe: ${Yn(o)}`}}catch(a){return{valor:0,tpf:0,origem:`${a?.message??String(a)} | settings expoe: ${Yn(e)}`}}}async function Xi(o){let e=await Te();if(e.tpf>0)return{tpf:e.tpf,aviso:null};if(!(o>0))throw new Error("Sem taxa de quadros: nao da para cortar sem saber onde ficam os quadros.");let a=Wi(await La.FrameRate?.createWithValue?.(o));return a&&a.tpf>0?{tpf:a.tpf,aviso:null}:{tpf:Math.round(Do/o),aviso:`Quadro estimado por divisao (${o} fps): o Premiere nao informou a taxa e FrameRate.createWithValue nao respondeu. Em 29.97/59.94 o corte pode sair 1 quadro. (${e.origem})`}}function Bn(o,e){let a=typeof o?.ticksNumber=="number"?o.ticksNumber:(o?.seconds??0)*Do;return Math.round(a/e)}function Qn(o,e){return La.TickTime.createWithTicks(String(Math.round(o*e)))}function yo(o,e){return`${(o*e/Do).toFixed(3)}s`}function _n(o,e){return Math.round(o*Do/e)}function Ad(o,e){return o.createSetDisabledAction(!e)}function Ki(o){return[{video:!0,indice:o.videoA,pessoa:"A"},{video:!1,indice:o.audioA,pessoa:"A"},{video:!0,indice:o.videoB,pessoa:"B"},{video:!1,indice:o.audioB,pessoa:"B"}]}function io(o){return`${o.video?"V":"A"}${o.indice+1}`}async function Wo(){let o=await La.Project.getActiveProject();if(!o)throw new Error("Nenhum projeto aberto.");let e=await o.getActiveSequence();if(!e)throw new Error("Nenhuma sequencia ativa. Abra a sequencia do podcast.");return{project:o,sequence:e}}async function Ae(o,e){let a=o,n=e.video?await a.getVideoTrack(e.indice):await a.getAudioTrack(e.indice);if(!n)throw new Error(`Track ${io(e)} nao existe nesta sequencia.`);let t=await n.getTrackItems(wd,!1);return(await Promise.all(t.map(async i=>({i,s:(await i.getStartTime()).seconds})))).sort((i,s)=>i.s-s.s).map(i=>i.i)}async function He(o,e){return{inicioQ:Bn(await o.getStartTime(),e),fimQ:Bn(await o.getEndTime(),e),fonteQ:Bn(await o.getInPoint(),e)}}async function Zi(o,e,a){let n=[],t=!0,{tpf:r,aviso:i}=await Xi(a);i&&n.push(i);let s=_n((e[0]?.inicioF??0)/a,r),c=_n((e[e.length-1]?.fimF??0)/a,r),{sequence:l}=await Wo();(o.videoA===o.videoB||o.audioA===o.audioB)&&(n.push("As duas pessoas nao podem dividir a mesma track."),t=!1);for(let m of Ki(o)){let d=await Ae(l,m);if(d.length!==1){n.push(`${io(m)}: ${d.length} clipes \u2014 o MVP precisa de exatamente 1 clipe continuo.`),t=!1;continue}let u=d[0];for(let p of["createSetDisabledAction","createSetInPointAction","createSetEndAction"])typeof u[p]!="function"&&(n.push(`${io(m)}: este Premiere nao tem ${p} (precisa de 25.6+).`),t=!1);let g=await He(u,r);g.inicioQ>s||g.fimQ<c?(n.push(`${io(m)}: clipe cobre ${yo(g.inicioQ,r)}-${yo(g.fimQ,r)}, o plano precisa de ${yo(s,r)}-${yo(c,r)}.`),t=!1):n.push(`${io(m)}: ok \u2014 ${yo(g.inicioQ,r)}-${yo(g.fimQ,r)}, fonte em ${yo(g.fonteQ,r)}`)}return{ok:t,linhas:n}}async function os(o,e,a){let n=[],t=Ki(o),{tpf:r,aviso:i}=await Xi(a);i&&n.push(i);let s=Qi(e).map(w=>_n(w/a,r)),c=new Map;{let{sequence:w}=await Wo();for(let S of t){let h=await Ae(w,S);if(h.length!==1)throw new Error(`${io(S)} nao tem 1 clipe continuo. Rode ANALISAR antes.`);c.set(io(S),await He(h[0],r))}}let l=0;for(let w of s){let{project:S,sequence:h}=await Wo(),E=await La.SequenceEditor.getEditor(h),q=[];for(let x of t)for(let R of await Ae(h,x)){let A=await He(R,r);w<=A.inicioQ||w>=A.fimQ||q.push({item:R,deslocamento:Qn(w-A.inicioQ,r)})}q.length!==0&&(q.length!==4&&n.push(`corte em ${yo(w,r)}: ${q.length} tracks atingidas, esperado 4.`),Q(S,`PodCut: corte em ${yo(w,r)}`,x=>{for(let R of q)x(E.createCloneTrackItemAction(R.item,R.deslocamento,0,0,!0,!1))}),l++)}n.push(`${l} cortes aplicados.`);let{project:m,sequence:d}=await Wo(),u=[],g=new Map,p=0,f=0,y=0;for(let w of t){let S=c.get(io(w)),h=await Ae(d,w),E=[];for(let[q,x]of h.entries()){let R=await He(x,r);if(E.push(R.inicioQ),q===h.length-1&&R.fimQ>S.fimQ){let N=Qn(S.fimQ,r);u.push(()=>x.createSetEndAction(N)),f++}let A=_i(S.fonteQ,S.inicioQ,R.inicioQ);if(R.fonteQ!==A){let N=Qn(A,r);u.push(()=>x.createSetInPointAction(N)),p++}let $=zn(e,Math.round(R.inicioQ*r/Do*a));if($===null){y++;continue}u.push(()=>Ad(x,$===w.pessoa))}g.set(io(w),E.join(","))}Q(m,"PodCut: sincronizar e alternar",w=>{for(let S of u)w(S())}),n.push(`${f} pedacos aparados de volta ao fim original.`),n.push(`${p} pedacos tiveram a fonte corrigida.`),y>0&&n.push(`${y} pedacos fora do plano ficaram como estavam.`);let b=!0,P=new Set(g.values());if(P.size===1)n.push(`boundaries identicos nas 4 tracks: [${[...P][0]}]`);else{for(let[w,S]of g)n.push(`${w}: [${S}]`);n.push("BOUNDARIES DIFERENTES \u2014 o corte nao ficou alinhado."),b=!1}let T=[],M=0;for(let w of t)for(let S of await Ae(await(await Wo()).sequence,w)){if(typeof S.isDisabled!="function")continue;let h=await He(S,r),E=zn(e,Math.round(h.inicioQ*r/Do*a));if(E===null)continue;M++;let q=E===w.pessoa;await S.isDisabled()===q&&T.push(`${io(w)}@${yo(h.inicioQ,r)} deveria estar ${q?"ON":"OFF"}`)}return T.length>0?(n.push(`ON/OFF errado em ${T.length} de ${M} pedacos:`,...T.slice(0,8)),b=!1):M>0?n.push(`ON/OFF conferido e correto nos ${M} pedacos do plano.`):n.push("Este Premiere nao tem isDisabled(): nao deu para conferir o ON/OFF."),{ok:b,linhas:n}}function Ji(o,e){let a=[];for(let[,n]of es(o,e))a.push(...n);return a.sort((n,t)=>n.inicioMs-t.inicioMs)}var Td=["speaker","speakerId","speakerLabel","speakerName","speaker_id","speaker_label","talker"];function Sd(o){let e=new Map;try{let a=JSON.parse(o);for(let n of Array.isArray(a.segments)?a.segments:[]){if(typeof n!="object"||n===null)continue;let t=n;if(typeof t.start=="number")for(let r of Td){let i=t[r];if(i!=null&&i!==""){e.set(t.start,String(i));break}}}}catch{}return e}function kd(o){try{let e=JSON.parse(o),a=Array.isArray(e.segments)?e.segments:[],n=new Set;for(let t of a.slice(0,50))if(typeof t=="object"&&t!==null)for(let r of Object.keys(t))n.add(r);return`${a.length} segmentos, campos: ${[...n].join(", ")||"nenhum"}`}catch{return"JSON da transcricao ilegivel"}}function es(o,e){let a=Sd(o),n=new Map;for(let t of le(o)?.segments??[]){let r=a.get(t.start)??t.speaker;for(let i of t.words){let s=Re(e,i.start);if(s===null)continue;let c=n.get(r)??[];c.length===0&&n.set(r,c),c.push({inicioMs:s*1e3,fimMs:(s+i.duration/e.speed)*1e3})}}return n}async function as(o,e){let a=[],{sequence:n}=await Wo(),t=[{pessoa:"A",alvo:{video:!1,indice:o.audioA,pessoa:"A"}},{pessoa:"B",alvo:{video:!1,indice:o.audioB,pessoa:"B"}}],r=new Map;for(let f of t){let y=await Ae(n,f.alvo);if(y.length!==1)throw new Error(`${io(f.alvo)}: ${y.length} clipes \u2014 o MVP precisa de 1 clipe continuo por microfone.`);let b=y[0],P=(await b.getProjectItem())?.name;if(!P)throw new Error(`${io(f.alvo)}: nao deu para identificar a midia deste clipe.`);let T=await b.getSpeed();r.set(f.pessoa,{nome:P,clip:{startSeconds:(await b.getStartTime()).seconds,endSeconds:(await b.getEndTime()).seconds,inPointSeconds:(await b.getInPoint()).seconds,outPointSeconds:(await b.getOutPoint()).seconds,speed:T>0?T:1}})}let i=r.get("A"),s=r.get("B"),c=i.nome===s.nome,{transcricoes:l,falhas:m}=await fa(c?[i.nome]:[i.nome,s.nome]);for(let f of m)a.push(`${f.nome}: ${f.motivo}`);let d=(c?[i]:[i,s]).filter(f=>!l.get(f.nome));if(d.length>0)throw new Error(`Sem transcricao para ${d.map(f=>f.nome).join(" e ")}. No Premiere: painel Texto > Transcrever, em cada clipe de audio.`);let u,g;if(c){let f=es(l.get(i.nome),i.clip),y=[...f.keys()];if(y.length<2)throw new Error(`${i.nome} esta nas duas tracks de audio e sua transcricao tem um interlocutor so (${kd(l.get(i.nome))}), entao nao da para saber quem fala por ela. Saida melhor: preencha o campo de WAV la em cima e analise pelo nivel de cada canal, que nao usa transcricao nenhuma. Alternativa: retranscrever no Premiere com a deteccao de interlocutores ligada.`);u=f.get(y[0]),g=f.get(y[1]),a.push(`${i.nome}: um arquivo para os dois microfones.`),a.push(`Pessoa A = "${y[0]}", Pessoa B = "${y[1]}" \u2014 pela ordem de quem falou primeiro.`,"Se estiver trocado, inverta os seletores: Pessoa A = V2/A2 e Pessoa B = V1/A1."),y.length>2&&a.push(`Ignorados: ${y.slice(2).join(", ")}.`)}else u=Ji(l.get(i.nome),i.clip),g=Ji(l.get(s.nome),s.clip);a.push(`Pessoa A: ${u.length} palavras`,`Pessoa B: ${g.length} palavras`);let p=Vn(u,g,e);if(p.length===0)throw new Error("Nenhuma fala reconhecida nos dois microfones.");return a.push(`${p.length} planos, ${p.length-1} trocas de camera.`),{trechos:p,linhas:a}}async function ns(o,e,a,n,t){let r=[];if(e===a)throw new Error("Pessoa A e Pessoa B nao podem usar o mesmo canal.");let i=await Gi.storage.localFileSystem.getEntryWithUrl(ho(o));if(!i)throw new Error(`Arquivo nao encontrado: ${o}`);if(typeof i.read!="function")throw new Error(`Isto e uma pasta, nao um arquivo: ${o}`);let s=new Uint8Array(await i.read({format:Gi.storage.formats.binary})),c=Pe(s),l=c.db.length;if(r.push(`WAV: ${l} canais a ${c.taxa} Hz, ${(s.byteLength/1e6).toFixed(0)} MB.`),e>=l||a>=l)throw new Error(`O arquivo tem ${l} canais; foram pedidos os canais ${e+1} e ${a+1}.`);let{a:m,b:d}=Hi(c.db[e],c.db[a],c.janelaMs,t);r.push(`Canal ${e+1}: ${m.length} blocos de voz`,`Canal ${a+1}: ${d.length} blocos de voz`);let u=Vn(m,d,n);if(u.length===0)throw new Error("Nenhuma voz reconhecida nos dois canais.");return r.push(`${u.length} planos, ${u.length-1} trocas de camera.`),{trechos:u,linhas:r}}function rs(o){return o.filter(e=>e.fim>e.inicio).map(e=>({texto:e.text,inicio:e.inicio,fim:e.fim}))}function is(o,e){let a=[],n=0;for(let i of o)n<e.length&&e[n].texto===i.texto?n++:a.push(`"${i.texto}" (${i.inicio.toFixed(2)} s) sumiu`);let t=e.length-n,r=o.length-a.length;return a.length===0&&t===0?{ok:!0,linhas:[`${o.length} de ${o.length} palavras presentes.`]}:{ok:!1,linhas:[`${r} de ${o.length} palavras presentes:`,...a.slice(0,10),...a.length>10?[`e mais ${a.length-10}`]:[],...t>0?[`${t} palavra(s) a mais ou fora de ordem`]:[]]}}function za(o,e){let a=Math.max(0,Math.round(o/e));return`${Math.floor(a/60)}:${String(a%60).padStart(2,"0")}`}function Se(o,e){let{fps:a,duracaoQ:n,margemS:t}=e;if(!(a>0))throw new Error(`fps invalido: ${a}`);if(!(n>0))throw new Error(`duracao invalida: ${n}`);if(o.length===0)return{trechos:[],cortes:[],duracaoAntesQ:n,duracaoDepoisQ:n};let r=[...o].sort((b,P)=>b.inicio-P.inicio),i=[],s=b=>Math.ceil(b*a),c=b=>Math.floor(b*a),l=(b,P,T,M)=>{let w={inicio:Math.max(0,b),fim:Math.min(n,P)};w.fim-w.inicio<2||i.push({inicioQ:w.inicio,fimQ:w.fim,antes:T,depois:M})},m=r[0];l(0,c(m.inicio-t),"",m.texto);let d=m.fim;for(let b=0;b+1<r.length;b++){let P=r[b],T=r[b+1];d=Math.max(d,P.fim),l(s(d+t),c(T.inicio-t),P.texto,T.texto)}let u=r[r.length-1];l(s(Math.max(d,u.fim)+t),n,u.texto,"");let g=[],p=0,f=0,y=(b,P)=>{P<=b||(g.push({inicioQ:b,fimQ:P,destinoQ:f}),f+=P-b)};for(let b of i)y(p,b.inicioQ),p=b.fimQ;return y(p,n),{trechos:g,cortes:i,duracaoAntesQ:n,duracaoDepoisQ:f}}var Md={somAcimaDoPisoDb:10,vozAbaixoDoTipicoDb:20,buracoMaxS:.15,ataqueMaxS:.15,caudaMaxS:.15,vozSemPalavraMinS:.25,protecaoMaxS:.5},Xo=1e-9;function ts(o,e){let a=[...o].sort((n,t)=>n-t);return a[Math.min(a.length-1,Math.floor(a.length*e))]}function ja(o,e,a,n=Md){let t=o.length>0?ts(o,.2)+n.somAcimaDoPisoDb:1/0,r=o.length>0?Math.max(t,ts(o,.9)-n.vozAbaixoDoTipicoDb):1/0,i=p=>p*e,s=[];for(let p=0;p<o.length;p++){if(o[p]<=r)continue;let f=s[s.length-1];f&&(p-f.ate)*e<n.buracoMaxS-Xo?f.ate=p+1:s.push({de:p,ate:p+1})}let c=p=>{let f=p;for(;f<o.length&&(f+1-p)*e<=n.caudaMaxS+Xo&&o[f]>t;)f++;return i(f)},l=p=>({texto:p.texto,inicio:p.inicio,fim:p.inicio+Math.min(Math.max(p.fim-p.inicio,e),n.protecaoMaxS),motivo:"palavra-baixa"}),m=[...a].sort((p,f)=>p.inicio-f.inicio),d=[],u=0;for(let p of s){let f=i(p.de),y=i(p.ate);for(;u<m.length&&m[u].inicio<f-n.ataqueMaxS-Xo;)d.push(l(m[u++]));let b=u;for(;u<m.length&&m[u].inicio<y-Xo;)u++;let P=m.slice(b,u);if(P.length===0){let T=m[u-1];if(T&&T.fim>f+Xo){d.push({texto:"",inicio:T.inicio,fim:c(p.ate),motivo:"fala"});continue}y-f>=n.vozSemPalavraMinS-Xo&&d.push({texto:"",inicio:f,fim:c(p.ate),motivo:"voz-sem-palavra"});continue}d.push({texto:P.map(T=>T.texto).join(" "),inicio:Math.min(f,P[0].inicio),fim:c(p.ate),motivo:"fala"})}for(;u<m.length;)d.push(l(m[u++]));d.sort((p,f)=>p.inicio-f.inicio);let g=[];for(let p of d){let f=g[g.length-1];f&&p.inicio<=f.fim+Xo?g[g.length-1]={texto:[f.texto,p.texto].filter(y=>y!=="").join(" "),inicio:f.inicio,fim:Math.max(f.fim,p.fim),motivo:f.motivo==="fala"||p.motivo==="fala"?"fala":f.motivo}:g.push(p)}return g}function Va(o,e){let a=[...e].sort((i,s)=>i.inicioQ-s.inicioQ),n=[],t=0,r=0;for(let i of a){t+=Math.max(0,i.inicioQ-r),r=i.fimQ;for(let s of o){let c=Math.max(s.inicioQ,i.inicioQ),l=Math.min(s.fimQ,i.fimQ);l<=c||(n.push({fonte:i.fonte,midiaDeQ:i.midiaQ+(c-i.inicioQ),midiaAteQ:i.midiaQ+(l-i.inicioQ),destinoQ:t,origemQ:c}),t+=l-c)}}return{pedacos:n,totalQ:t}}function ss(o,e,a){let n=t=>Math.ceil(t/e/a-1e-6);return[n(o.inicioQ),n(o.fimQ)]}function cs(o,e,a,n){return Math.round((o.midiaQ/e+n*a-o.inicioQ/e)/a)}function ls(o,e,a,n,t){for(let r of a){let i=t[r.fonte],[s,c]=ss(r,n,e);for(let l=s;l<Math.min(c,o.length);l++)i[cs(r,n,e,l)]=o[l]}}function ds(o,e,a,n,t,r){let i=new Array(Math.ceil(t/n/e-1e-6)).fill(r);for(let s of a){let c=o[s.fonte];if(!c)return null;let[l,m]=ss(s,n,e);for(let d=l;d<Math.min(m,i.length);d++){let u=cs(s,n,e,d),g=c[u]??c[u-1]??c[u+1];if(g===void 0)return null;i[d]=g}}return i}function us(o){let e=[];for(let a of[...o].sort((n,t)=>n.inicioQ-t.inicioQ)){let n=e[e.length-1];n&&n[1]===a.inicioQ&&n[3]===a.fonte&&n[2]+(n[1]-n[0])===a.midiaQ?n[1]=a.fimQ:e.push([a.inicioQ,a.fimQ,a.midiaQ,a.fonte])}return JSON.stringify(e)}function ms(o){return o.trim().split(/\s+/).pop()||"\u2026"}function ps(o){return o.trim().split(/\s+/)[0]||"\u2026"}var Un="WAV_Mono_16bit_16kHz.epr";function fs(o,e){let a=Number.parseInt(o,10),n=Number.isFinite(a)?`Adobe Premiere Pro ${2e3+a}`:"",t=e.filter(r=>r.startsWith("Adobe Premiere Pro")&&r!==n).sort().reverse();return[n,...t].filter(r=>r!=="").map(r=>`C:\\Program Files\\Adobe\\${r}\\Settings\\EncoderPresets\\${Un}`)}var eo=ro("premierepro"),Qa=ro("uxp"),vs=1,$d=254016e6;async function go(){let o=await eo.Project.getActiveProject();if(!o)throw new Error("Nenhum projeto aberto.");let e=await o.getActiveSequence();if(!e)throw new Error("Nenhuma sequ\xEAncia ativa. Abra a sequ\xEAncia da grava\xE7\xE3o.");return{project:o,sequence:e}}async function Ao(o,e,a){let n=o,t=e?await n.getVideoTrack(a):await n.getAudioTrack(a);if(!t)return[];let r=await t.getTrackItems(vs,!1);return(await Promise.all(r.map(async s=>({i:s,s:(await s.getStartTime()).seconds})))).sort((s,c)=>s.s-c.s).map(s=>s.i)}async function qd(o,e){try{return String(await o.getMediaFilePath()||e)}catch{return e}}async function ke(o){let{sequence:e}=await go();return Promise.all((await Ao(e,o,0)).map(async a=>{let n=await a.getProjectItem();return{item:a,nome:n?.name??"?",inicio:await a.getStartTime(),fim:await a.getEndTime(),entrada:await a.getInPoint(),saida:await a.getOutPoint(),velocidade:await a.getSpeed(),projectItem:n,clip:eo.ClipProjectItem.cast(n)}}))}async function To(o=!0){let e=await no(),a=(await Te()).valor;if(!(a>0))throw new Error("N\xE3o consegui ler a taxa de quadros da sequ\xEAncia.");let n=await ke(!0);if(n.length===0)throw new Error("Nenhum clipe na V1. Ponha a grava\xE7\xE3o na V1 com o \xE1udio na A1.");for(let s of n){let c=za(Math.round(s.inicio.seconds*a),a);if(!s.clip)throw new Error(`O clipe da V1 em ${c} n\xE3o \xE9 um arquivo de m\xEDdia (sequ\xEAncia aninhada?).`);if(Math.abs(s.velocidade-1)>1e-6)throw new Error(`O clipe da V1 em ${c} est\xE1 com a velocidade alterada. Volte para 100% e rode de novo.`)}let t=o?await ke(!1):n,r=s=>[s.nome,s.inicio.seconds,s.fim.seconds,s.entrada.seconds].map(c=>typeof c=="number"?Math.round(c*a):c).join("|");if(t.length!==n.length||n.some((s,c)=>r(s)!==r(t[c])))throw new Error("O \xE1udio da A1 n\xE3o acompanha a V1 clipe a clipe (\xE1udio de gravador separado?). Cada clipe precisa estar com o pr\xF3prio \xE1udio.");let i=new Map;for(let s of n)i.has(s.nome)||i.set(s.nome,{nome:s.nome,projectItem:s.projectItem,clip:s.clip,arquivo:await qd(s.clip,s.nome)});return{info:e,fps:a,v1:n,fontes:[...i.values()]}}function ee(o){let e=n=>Math.round(n.seconds*o.fps),a=new Map(o.fontes.map((n,t)=>[n.nome,t]));return o.v1.map(n=>({inicioQ:e(n.inicio),fimQ:e(n.fim),midiaQ:e(n.entrada),fonte:a.get(n.nome)}))}async function Wn(o){let e=new Map;for(let a of o){let n=null;try{n=await I("ler a transcri\xE7\xE3o",eo.Transcript.exportToJSON(a.clip))}catch(r){let i=r?.message??String(r);if(!/illegal parameter/i.test(i))throw new Error(`N\xE3o consegui ler a transcri\xE7\xE3o de "${a.nome}": ${i}`)}if(!n)throw new Error(`"${a.nome}" n\xE3o tem transcri\xE7\xE3o. No Premiere: selecione o clipe, Janela > Texto > aba Transcri\xE7\xE3o > Transcrever, e rode de novo.`);let t=le(n);if(!t)throw new Error(`A transcri\xE7\xE3o de "${a.nome}" veio num formato que n\xE3o consegui ler.`);e.set(a.nome,{json:n,t})}return e}function Id(o){return o.map(e=>({sourceName:e.nome,startSeconds:e.inicio.seconds,endSeconds:e.fim.seconds,inPointSeconds:e.entrada.seconds,outPointSeconds:e.saida.seconds,speed:1}))}function ys(o,e){let a=new Map([...e].map(([n,t])=>[n,t.t]));return rs(ea(Id(o),a))}function ws(o,e){let a=ys(o.v1,e);if(a.length===0)throw new Error("A transcri\xE7\xE3o n\xE3o tem nenhuma palavra dentro da timeline.");let n=ee(o);return{nomeSequencia:o.info.name,fps:o.fps,duracaoQ:Math.max(...n.map(t=>t.fimQ)),clipes:o.v1.length,clipesQ:n,palavras:a}}async function Es(){let o=await To();return ws(o,await Wn(o.fontes))}async function Ya(o){try{return await Qa.storage.localFileSystem.getEntryWithUrl(ho(o))??null}catch{return null}}async function gs(o){return new Uint8Array(await o.read({format:Qa.storage.formats.binary}))}async function _a(o){let e=await Ya(o);e&&await e.delete()}async function Rd(){let o=await Ya("C:\\Program Files\\Adobe"),e=o?.getEntries?(await o.getEntries()).filter(n=>n.isFolder).map(n=>n.name):[],a=fs(String(Qa.host?.version??""),e);for(let n of a)if(await Ya(n))return n;throw new Error(`N\xE3o achei o preset de \xE1udio do Premiere (${Un}). Procurei em: ${a.join(" ; ")||"nenhuma pasta do Premiere em C:\\Program Files\\Adobe"}.`)}async function Xn(o){let e=await Rd(),n=`${(await Qa.storage.localFileSystem.getDataFolder()).nativePath.replace(/[\\/]+$/,"")}\\${o}`;await _a(n);let{sequence:t}=await go(),r=eo.EncoderManager.getManager(),i=eo.Constants?.ExportType?.IMMEDIATELY??eo.EncoderManager.EXPORT_IMMEDIATELY,s=Date.now();if(!await I("exportar o \xE1udio da sequ\xEAncia",r.exportSequence(t,i,n,e,!0),600*1e3))throw new Error("O Premiere recusou exportar o \xE1udio da sequ\xEAncia.");let l=Date.now()-s,m=await Ya(n);if(!m)throw new Error(`O export terminou, mas o arquivo n\xE3o apareceu em ${n}.`);let d=await gs(m),u=Ln(d);for(let g=0;!Ln(d)&&g<20;g++)await new Promise(p=>setTimeout(p,500)),d=await gs(m);return{caminho:n,preset:e,ms:l,bytes:d,completoNaHora:u}}async function Ps(o){let e=await z("pausas-registro.json"),a=Array.isArray(e?.historico)?e.historico:[];await F("pausas-registro.json",{historico:[...a,{quando:new Date().toISOString(),linhas:o}].slice(-20)})}var Ba=.02,Ko=new Map;function Gn(o){let e=ee(o),a=Math.max(...e.map(n=>n.fimQ));return ds(o.fontes.map(n=>Ko.get(n.arquivo)),Ba,e,o.fps,a,-120)}function hs(o){return`${o.info.name}|${us(ee(o).map(e=>({...e,fonte:o.fontes[e.fonte].arquivo})))}`}async function Nd(){let o=await To(),e=await Xn("pausas-audio.wav");try{if(hs(await To())!==hs(o))throw new Error("A timeline mudou enquanto o \xE1udio era lido. Clique de novo sem mexer nela.");let a=o.fontes.map(t=>Ko.get(t.arquivo)??[]),n=Pe(e.bytes,Ba*1e3).db[0]??[];for(ls(n,Ba,ee(o),o.fps,a),o.fontes.forEach((t,r)=>{Ko.delete(t.arquivo),Ko.set(t.arquivo,a[r])});Ko.size>4;)Ko.delete(Ko.keys().next().value);return e.ms}finally{await _a(e.caminho)}}var oe=null;function Kn(){return oe??(oe=Nd().finally(()=>{oe=null})),oe}async function As(){let{sequence:o}=await go(),e=o,a=await e.getVideoTrack(0),n=a?await a.getTrackItems(vs,!1):[];return`${String(e.guid??"")}|${e.name??""}|${n.length}`}async function Ts(){return Gn(await To())!==null}async function Zn(o=()=>{}){let e=await To(),a=ws(e,await Wn(e.fontes)),n=Date.now();oe&&await oe.catch(()=>{});let t=Gn(e);if(t||(o(),await Kn(),t=Gn(e)),!t)throw new Error("A timeline mudou enquanto o \xE1udio era lido. Clique de novo sem mexer nela.");return{...a,blocos:ja(t,Ba,a.palavras),segundosAudio:(Date.now()-n)/1e3}}var Jn="pausas-desfazer.json",Od=o=>o.seconds<-1e3,Zo=o=>eo.TickTime.createWithTicks(o);function bs(o,e){let a=null;if(eo.TrackItemSelection.createEmptySelection(t=>{a=t}),!a)throw new Error("createEmptySelection nao devolveu selecao");let n=a;for(let t of e)n.addItem(t,!1);return o.createRemoveItemsAction(n,!1,eo.Constants.MediaType.ANY,!1)}async function Dd(){let{sequence:o}=await go();return[...await Ao(o,!0,0),...await Ao(o,!1,0)]}var ot=async o=>(await o.getProjectItem())?.name??"?";async function xs(o){let{sequence:e}=await go(),a=await e.getAudioTrackCount(),n=[];for(let t=1;t<a;t++){let r=await Ao(e,!1,t),i=await Promise.all(r.map(ot));n.push(r.filter((s,c)=>o.has(i[c])))}return n}async function Ss(o){let{sequence:e}=await go(),a=await e.getAudioTrackCount(),n=[];for(let r=1;r<a;r++)for(let i of await Promise.all((await Ao(e,!1,r)).map(ot)))o.has(i)||n.push(`"${i}" na A${r+1}`);if(n.length===0)return;let t=[...new Set(n)].slice(0,3).join(", ");throw new Error(`Tem ${t} embaixo da fala. O SilenceCut recoloca a bruta com todos os canais e apagaria isso: rode antes da trilha e do B-roll, ou tire esses clipes e tente de novo. Nada foi mexido.`)}async function ks(o,e,a,n,t,r,i=async()=>{},s={passos:0,msPremiere:0}){let c=(u,g,p)=>{let f=Date.now();Q(u,g,p),s.msPremiere+=Date.now()-f,s.passos++},l=new Set(await Promise.all((await Ao((await go()).sequence,!0,0)).map(ot))),m=await xs(l);{let u=[...await Dd(),...m.flat()],{project:g,sequence:p}=await go(),f=await eo.SequenceEditor.getEditor(p);c(g,`${e}: preparar`,y=>{u.length>0&&y(bs(f,u)),y(a(o[0]))})}for(let u=0;u<o.length;u++){let{project:g,sequence:p}=await go(),f=await eo.SequenceEditor.getEditor(p),y=o[u+1];c(g,`${e}: ${u+1} de ${o.length}`,b=>{b(n(f,o[u]));for(let P of y?[a(y)]:t())b(P)}),r(u+1,o.length),u===0&&await i()}let d=(await xs(l)).flatMap((u,g)=>m[g]?.length?[]:u);if(d.length>0){let{project:u,sequence:g}=await go(),p=await eo.SequenceEditor.getEditor(g);c(u,`${e}: tirar canais que n\xE3o estavam`,f=>f(bs(p,d)))}}async function Hn(o,e){return(await ke(o)).map(a=>({de:Math.round(a.inicio.seconds*e),ate:Math.round(a.fim.seconds*e),midia:Math.round(a.entrada.seconds*e)}))}async function et(o,e,a){let n=await Te(),t=n.tpf>0?n.tpf:Math.round($d/o.fps),r=w=>eo.TickTime.createWithTicks(String(Math.round(w*t))),i=w=>Math.round(Number(w.ticks)/t),s=new Map(o.fontes.map((w,S)=>[w.nome,S])),c=o.v1.map(w=>({inicioQ:i(w.inicio),fimQ:i(w.fim),midiaQ:i(w.entrada),fonte:s.get(w.nome)})),{pedacos:l,totalQ:m}=Va(e,c);if(l.length===0)throw new Error("O plano n\xE3o deixou nenhum trecho de fala. Nada foi mexido.");await Ss(new Set(o.fontes.map(w=>w.nome)));let d=eo.Constants.MediaType.VIDEO,u=await Promise.all(o.fontes.map(async w=>{let S=await w.clip.getInPoint(d),h=await w.clip.getOutPoint(d);return Od(S)?null:{inTicks:S.ticks,outTicks:h.ticks}})),g={sequencia:o.info.name,fontes:o.fontes.map((w,S)=>({nome:w.nome,marcas:u[S]??null})),clipes:o.v1.map(w=>({fonte:s.get(w.nome),inicioTicks:w.inicio.ticks,inTicks:w.entrada.ticks,outTicks:w.saida.ticks})),quando:new Date().toISOString()};await F(Jn,g);let p=w=>o.fontes[w.fonte],f=()=>o.fontes.map((w,S)=>{let h=u[S];return h?w.clip.createSetInOutPointsAction(Zo(h.inTicks),Zo(h.outTicks)):w.clip.createClearInOutPointsAction()}),y=async()=>{let w=l[0],S=(await Hn(!0,o.fps))[0],h=w.midiaAteQ-w.midiaDeQ,E=S?S.ate-S.de:0;if(!S||S.de!==w.destinoQ||E<h)throw new Error(`o primeiro peda\xE7o saiu com ${E} quadros, o plano pedia ${h}`);if(Math.abs(S.midia-w.midiaDeQ)>1)throw new Error(`o primeiro peda\xE7o parte do quadro ${S.midia} da m\xEDdia, o plano pedia ${w.midiaDeQ}`)},b={passos:0,msPremiere:0};try{await ks(l,"SilenceCut",w=>p(w).clip.createSetInOutPointsAction(r(w.midiaDeQ),r(w.midiaAteQ)),(w,S)=>w.createOverwriteItemAction(p(S).projectItem,r(S.destinoQ),0,0),f,(w,S)=>a(`cortando ${w}/${S}`),y,b)}catch(w){let S=w?.message??String(w),h="A sequ\xEAncia foi devolvida como estava.";try{await nt(o.fontes)}catch(E){h=`E N\xC3O consegui devolver a sequ\xEAncia (${E?.message??String(E)}): use Ctrl+Z.`}throw new Error(`O corte parou depois de ${b.passos} passo(s): ${S}. ${h}`)}let P=await Hn(!0,o.fps),T=await Hn(!1,o.fps),M=P.length>0?Math.max(...P.map(w=>w.ate)):0;return{pedacos:l,totalQ:m,pecasV1:P.length,emSincronia:JSON.stringify(P.map(w=>[w.de,w.ate]))===JSON.stringify(T.map(w=>[w.de,w.ate])),contagemOk:P.length===l.length,duracaoOk:Math.abs(M-m)<=1,fimV1:M,msPremiere:b.msPremiere,passos:b.passos}}function at(o,e){return[o.emSincronia?"V1 e A1 em sincronia.":"V1 e A1 N\xC3O est\xE3o com os mesmos peda\xE7os nas mesmas posi\xE7\xF5es.",o.contagemOk?`${o.pecasV1} peda\xE7os na V1, como o plano.`:`A V1 tem ${o.pecasV1} peda\xE7os, o plano tinha ${e}.`,o.duracaoOk?"Dura\xE7\xE3o confere com o plano.":`Dura\xE7\xE3o N\xC3O confere: a V1 termina no quadro ${o.fimV1}, o plano dizia ${o.totalQ}.`]}async function Ms(o,e){let a=Date.now(),n=await To(),t=await Zn(()=>e("1/3 lendo \xE1udio\u2026")),r=Date.now(),i=Se(t.blocos,{fps:t.fps,duracaoQ:t.duracaoQ,margemS:o});if(i.cortes.length===0)return{ok:!0,linhas:["Nenhuma pausa para cortar."]};let s=await et(n,i.trechos,g=>e(`2/3 ${g}`)),c=Date.now();e("3/3 conferindo\u2026");let l=await ke(!0),m=is(t.palavras,ys(l,await Wn(n.fontes))),d=(g,p)=>((p-g)/1e3).toFixed(1).replace(".",","),u=Date.now();return{ok:m.ok&&s.emSincronia&&s.duracaoOk&&s.contagemOk,linhas:[`${i.cortes.length} pausas cortadas \xB7 ${za(i.duracaoAntesQ,t.fps)} \u2192 ${za(s.totalQ,t.fps)} \xB7 levou ${d(a,u)} s`,`tempos: leitura ${d(a,r)} s (${t.segundosAudio>=.5?`\xE1udio lido na hora: ${t.segundosAudio.toFixed(1).replace(".",",")} s`:"\xE1udio j\xE1 lido"}) \xB7 corte ${d(r,c)} s, ${d(0,s.msPremiere)} s dentro do Premiere \xB7 confer\xEAncia ${d(c,u)} s`,...m.linhas,...at(s,s.pedacos.length),"Para desfazer tudo, use o bot\xE3o Desfazer (o Ctrl+Z do Premiere desfaz um peda\xE7o por vez)."]}}async function nt(o){oe&&await oe.catch(()=>{});let e=await z(Jn);if(!e)throw new Error("N\xE3o h\xE1 corte do SilenceCut para desfazer.");let{sequence:a}=await go();if(a.name!==e.sequencia)throw new Error(`O \xFAltimo corte foi na sequ\xEAncia "${e.sequencia}". Abra ela e clique em Desfazer de novo.`);await Ss(new Set(e.fontes.map(s=>s.nome)));let t=o??await ke(!0),r=e.fontes.map(s=>{let c=t.find(l=>l.nome===s.nome&&l.clip);if(!c)throw new Error(`N\xE3o achei "${s.nome}" na timeline para recolocar. Use Ctrl+Z.`);return{projectItem:c.projectItem,clip:c.clip}});await ks(e.clipes,"SilenceCut: desfazer",s=>r[s.fonte].clip.createSetInOutPointsAction(Zo(s.inTicks),Zo(s.outTicks)),(s,c)=>s.createOverwriteItemAction(r[c.fonte].projectItem,Zo(c.inicioTicks),0,0),()=>e.fontes.map((s,c)=>s.marcas?r[c].clip.createSetInOutPointsAction(Zo(s.marcas.inTicks),Zo(s.marcas.outTicks)):r[c].clip.createClearInOutPointsAction()),()=>{}),await F(Jn,null);let i=await ke(!0);return i.length===e.clipes.length?[`Desfeito: a sequ\xEAncia voltou como estava (${i.length} clipe${i.length===1?"":"s"}).`]:[`Desfeito, mas a V1 ficou com ${i.length} clipes e antes tinha ${e.clipes.length}: confira a timeline.`]}var so=ro("premierepro"),qp=ro("uxp"),Ld=1,$s=.02,qs="AE.ADBE Motion",zd="AE.ADBE Lumetri";async function rt(o,e){try{let a=await I("B-rolls",qo(),1e4),n=await(await so.Project.getActiveProject()).getActiveSequence(),t=await Promise.all((await Ao(n,!1,Ge)).map(async r=>({inicio:(await r.getStartTime()).seconds,fim:(await r.getEndTime()).seconds})));return{acima:a.length,brolls:a.filter(r=>!st(r)&&Mo(r.sourceName)).map(r=>({inicio:r.startSeconds,fim:r.endSeconds,nome:Cn(r.sourceName)})),leaks:a.filter(st).map(r=>r.startSeconds),trilha:o.filter(r=>t.some(i=>i.inicio<r.fimQ/e&&r.inicioQ/e<i.fim))}}catch{return{acima:0,brolls:[],leaks:[],trilha:[]}}}async function Is(){let o=await I("ler a sequ\xEAncia",To(!1),2e4),e=ee(o),n=await(await so.Project.getActiveProject()).getActiveSequence(),t=0;try{t=await I("faixas de legenda",n.getCaptionTrackCount(),5e3)}catch{}let r=Eo(e,o.fps),i=await rt(r,o.fps);return{nome:o.info.name,duracaoS:Math.max(...e.map(s=>s.fimQ))/o.fps,clipesV1:o.v1.length,variacoes:r.length,resumo:In(r,[],o.fps,{clipes:e.map(s=>({inicio:s.inicioQ/o.fps,fim:s.fimQ/o.fps})),brolls:i.brolls,leaks:i.leaks,blocos:[],palavras:[],trilha:i.trilha}),brollsAcimaDaV1:i.acima,faixasDeLegenda:t,temChave:await I("chave",we(),5e3)!==null}}async function jd(o,e,a){let n=await I("chave",we(),5e3);if(!n)throw new Error("Sem chave do ElevenLabs. Salve a chave (sk_\u2026) no Captions e clique de novo.");a("exportando o \xE1udio");let t=await Xn("editar-audio.wav");try{if(e(`\xE1udio da sequ\xEAncia: ${(t.bytes.byteLength/1e6).toFixed(1)} MB em ${(t.ms/1e3).toFixed(1)} s`,"passo"),ba(t.bytes))throw new Error("O \xE1udio da sequ\xEAncia saiu mudo: m\xEDdia offline, A1 silenciada ou outra faixa em solo. Nada foi enviado ao ElevenLabs.");let r=Pe(t.bytes,$s*1e3).db[0]??[],i=wa(t.bytes),s=await I("transcri\xE7\xE3o guardada",Ia(i),5e3);if(s!==null)e("mesmo \xE1udio de antes: transcri\xE7\xE3o reaproveitada, sem custo","passo");else{a("ElevenLabs ouvindo");let l=Date.now();s=await I("ElevenLabs",Ea(t.bytes,n,va(o),m=>e(m,"aviso")),900*1e3),e(`ElevenLabs respondeu em ${((Date.now()-l)/1e3).toFixed(0)} s`,"passo"),await I("guardar transcri\xE7\xE3o",Ra(i,s),1e4)}let c=ya(s);if(c===null||c.length===0)throw new Error("O ElevenLabs n\xE3o ouviu nenhuma palavra nesta sequ\xEAncia.");return e(`${c.length} palavras ouvidas`,"ok"),{palavras:c,db:r}}finally{await _a(t.caminho).catch(()=>{})}}async function Vd(o){let e=await o.getComponentChain(),a=[];for(let n=0;n<e.getComponentCount();n++)a.push(e.getComponentAtIndex(n));return a}async function it(o,e){for(let a of await Vd(o))if(await a.getMatchName()===e)return a;return null}function Je(o,e){for(let a=0;a<o.getParamCount();a++)if(o.getParam(a).displayName===e)return o.getParam(a);return null}async function tt(o){if(o===null||!o.getStartValue)return;let a=(await I("ler par\xE2metro",o.getStartValue(),3e3))?.value;return a&&typeof a=="object"&&"value"in a?a.value:a}function Yd(o){let e=Array.isArray(o)?Number(o[0]):Number(o?.x),a=Array.isArray(o)?Number(o[1]):Number(o?.y);return Number.isFinite(e)&&Number.isFinite(a)?{x:e,y:a}:void 0}async function Bd(o){let e=[];for(let a of o){let n=await it(a.item,qs),t=await it(a.item,zd);e.push({escala:n?await tt(Je(n,"Scale")).catch(()=>{}):void 0,bruto:n?await tt(Je(n,"Position")).catch(r=>`erro: ${r.message}`):void 0,posicao:n?Yd(await tt(Je(n,"Position")).catch(()=>{})):void 0,temLumetri:t!==null,lumetri:t})}return e}function Qd(o){if(o==null)return String(o);if(Array.isArray(o))return`lista ${JSON.stringify(o)}`;if(typeof o!="object")return`${typeof o} ${String(o)}`;let e=[];for(let a=o;a&&a!==Object.prototype;a=Object.getPrototypeOf(a))e.push(...Object.getOwnPropertyNames(a));return`objeto {${[...new Set(e)].slice(0,12).join(",")}}`}var Cs=o=>{let e=Number(o.escala),a=o.posicao;return(!Number.isFinite(e)||Math.abs(e-100)<1e-6)&&(!a||Math.abs((a.x??.5)-.5)<1e-6&&Math.abs((a.y??.5)-.5)<1e-6)};async function _d(o,e,a,n){if(a.every(Cs)&&!a.some(p=>p.temLumetri))return;let t=await so.Project.getActiveProject(),s=await(await(await t.getActiveSequence()).getVideoTrack(0)).getTrackItems(Ld,!1),l=(await Promise.all(s.map(async p=>({i:p,s:(await p.getStartTime()).seconds})))).sort((p,f)=>p.s-f.s).map(p=>p.i);if(l.length!==o.length){n(`zoom/posi\xE7\xE3o n\xE3o reaplicados: a V1 tem ${l.length} peda\xE7os e o plano ${o.length}`,"aviso");return}let m=[],d=[],u=0,g=0;a.forEach((p,f)=>{let y=p.posicao;n(`  clipe ${f+1}: escala ${String(p.escala)} \xB7 posi\xE7\xE3o ${y?`${y.x.toFixed(3)},${y.y.toFixed(3)}`:`n\xE3o lida (${Qd(p.bruto)})`}${p.temLumetri?" \xB7 Lumetri":""}`,"vazio")});for(let[p,f]of o.entries()){let y=e.findIndex(T=>f.origemQ>=T.inicioQ&&f.origemQ<T.fimQ),b=a[y];if(b===void 0)continue;let P=l[p];if(!Cs(b)){let T=await it(P,qs),M=T?Je(T,"Scale"):null,w=T?Je(T,"Position"):null;M&&Number.isFinite(Number(b.escala))&&(u++,m.push(()=>M.createSetValueAction(M.createKeyframe(Number(b.escala)),!0)));let S=b.posicao;w&&S&&Number.isFinite(S.x)&&Number.isFinite(S.y)&&(g++,m.push(()=>{let h=so.PointF,E=new h(S.x,S.y);return E.x=S.x,E.y=S.y,w.createSetValueAction(w.createKeyframe(E),!0)}))}if(b.temLumetri&&b.lumetri){let T=await P.getComponentChain();d.push(()=>T.createAppendComponentAction(b.lumetri))}}if(m.length>0&&(Q(t,"AutoEdit: zoom e posi\xE7\xE3o dos peda\xE7os",p=>{for(let f of m)p(f())}),n(`zoom devolvido a ${u} e posi\xE7\xE3o a ${g} de ${o.length} peda\xE7os`,"ok")),d.length>0)try{Q(t,"AutoEdit: cor dos peda\xE7os",p=>{for(let f of d)p(f())}),n(`cor (Lumetri) copiada para ${d.length} peda\xE7os \u2014 confira no Lumetri`,"ok")}catch(p){n(`a cor (Lumetri) n\xE3o acompanhou os peda\xE7os (${p.message}): aplique de novo na V1`,"aviso")}}async function Ud(o,e,a,n,t,r){let i=Yo(await I("ler config",z("config.json"),5e3));if(!i.libraryPath)throw new Error("Pasta de B-rolls n\xE3o configurada. Abra o B-Roller uma vez e escolha a pasta.");Ze(Bo(await I("ler sin\xF4nimos",z("sinonimos.json"),5e3))??se);let s=_o(await I("ler aprendizado",z("aprendizado.json"),5e3)),c=ue(Co(await I("ler liga\xE7\xF5es",z("ligacoes.json"),5e3))),l=await I("listar B-rolls",ma(i.libraryPath),2e4);t(`biblioteca: ${l.length} B-rolls \xB7 ${Object.keys(s.pares).length} pares aprendidos`,"passo");let m=Za(o,{biblioteca:l.map(h=>h.name),ligacoes:c});r("medindo os takes");let d=sa(await I("ler intensidade",z("intensidade.json"),5e3)),u=await I("medir intensidade",ga(l,d,()=>{}),3e5).catch(()=>d);u!==d&&await F("intensidade.json",u);let g=new Map(Object.entries(u.arquivos).filter(h=>h[1]!==null)),p=la(m.oportunidades,{caminhos:new Map(l.map(h=>[h.name,h.nativePath]))},i.densidadeMaxima?ca:pe,s,{porArquivo:g,ritmoDasFrases:m.frases.map(h=>me(h.palavras,h.duracao))}),{ficam:f,aparados:y,fora:b}=Ti(p.colocacoes,e,a),P=(await I("B-rolls na timeline",qo(),1e4)).map(h=>({inicio:h.startSeconds,fim:h.endSeconds,arquivo:h.sourceName})),{entram:T,bloqueadas:M}=da(f,P);for(let h of[...b,...M])t(`  ${h}`,"vazio");if(y>0&&t(`${y} B-roll(s) aparados para terminar junto com o v\xEDdeo`,"passo"),T.length===0)return t("nenhum B-roll bom o bastante para entrar sozinho","aviso"),{resumo:"nenhum entrou",aviso:!0,trechos:[]};r(`colocando ${T.length} B-rolls`);let w=await I("inserir B-rolls",ha(T,{videoTrackIndex:i.videoTrackIndex,audioTrackIndex:i.audioTrackIndex,removerAudio:i.removeAudio,preencherTela:i.fillScreen}),12e4);for(let h of T)t(`  ${j(h.inicio)} ${h.arquivo} \xB7 ${h.motivo}`,"vazio");for(let h of w.avisos)t(`  ${h}`,"aviso");let S=ta(await I("ler pendentes",z("pendentes.json"),5e3));return await F("pendentes.json",de(S,n,{quando:new Date().toISOString(),itens:T.map(h=>({arquivo:h.arquivo,conceito:h.conceito,termosCasados:h.termosCasados,inicio:h.inicio}))})),t(`${T.length} B-rolls na V${i.videoTrackIndex+1}`,"ok"),{resumo:`${T.length} na V${i.videoTrackIndex+1}`,aviso:w.avisos.length>0,trechos:T.map(h=>({inicio:h.inicio,fim:h.inicio+h.duracao,nome:h.conceito||h.arquivo}))}}var st=o=>/light leak/i.test(`${o.nomeNoProjeto} ${o.caminho}`);async function Hd(o,e,a){let n=Yo(await I("ler config",z("config.json"),5e3)),t=await I("ler a timeline",qo(),1e4),r=t.find(st),i=r?.videoTrackIndex??n.videoTrackIndex+1,s=await so.Project.getActiveProject(),l=(await I("ler o projeto",pa(await s.getRootItem()),2e4)).find(f=>r?f.name===r.nomeNoProjeto:/light leak/i.test(f.name));if(l===void 0)return a("light leak: nenhum no projeto. Gere um no Premiere Composer e rode de novo","aviso"),{resumo:"nenhum no projeto",aviso:!0,inicios:[]};let m=f=>({inicio:f.startSeconds,fim:f.endSeconds}),d=f=>o.some(y=>f.startSeconds*e>=y.inicioQ-.5&&f.startSeconds*e<y.fimQ),u=xi(t.filter(f=>Mo(f.sourceName)&&d(f)).map(m),o,e,t.filter(f=>f.videoTrackIndex===i).map(m));if(u.length===0)return a("light leak: toda troca de B-roll j\xE1 tem","passo"),{resumo:"toda troca j\xE1 tem",inicios:[]};let g=await so.SequenceEditor.getEditor(await s.getActiveSequence()),p=await Promise.all(u.map(f=>so.TickTime.createWithSeconds(f)));return Q(s,`AutoEdit: ${u.length} light leaks`,f=>{for(let y of p)f(g.createOverwriteItemAction(l,y,i,n.audioTrackIndex))}),a(`${u.length} light leaks na V${i+1} (${l.name})`,"ok"),{resumo:`${u.length} na V${i+1}`,inicios:u}}var Ge=1;async function Gd(o,e,a){let n=await so.Project.getActiveProject(),t=await n.getActiveSequence(),r=async()=>Promise.all((await Ao(t,!1,Ge)).map(async f=>({i:f,inicio:(await f.getStartTime()).seconds,fim:(await f.getEndTime()).seconds}))),i=await r(),s=i[0];if(s===void 0)return a(`trilha: ponha a m\xFAsica embaixo de uma varia\xE7\xE3o na A${Ge+1} e o Editar copia para as outras`,"aviso"),{resumo:`sem m\xFAsica na A${Ge+1}`,aviso:!0,com:[]};let{entram:c,pulam:l}=vi(o,e,i,s.fim-s.inicio),m=o.filter(f=>!l.includes(f));for(let f of l)a(`  trilha: ${j(f.inicioQ/e)} ficou de fora (a c\xF3pia cairia na m\xFAsica da varia\xE7\xE3o seguinte)`,"aviso");if(c.length===0)return l.length===0&&a("trilha: toda varia\xE7\xE3o j\xE1 tem","passo"),l.length===0?{resumo:"toda varia\xE7\xE3o j\xE1 tem",com:m}:{resumo:`${l.length} ficaram de fora`,aviso:!0,com:m};let d=await so.SequenceEditor.getEditor(t),u=await Promise.all(c.map(f=>so.TickTime.createWithSeconds(f.inicioQ/e-s.inicio)));Q(n,`AutoEdit: trilha em ${c.length} varia\xE7\xF5es`,f=>{for(let y of u)f(d.createCloneTrackItemAction(s.i,y,0,0,!1,!1))});let g=await r(),p=[];for(let f of c){let y=g.find(b=>Math.abs(b.inicio-f.inicioQ/e)<.5/e);y&&p.push({item:y.i,fim:await so.TickTime.createWithSeconds(f.fimQ/e)})}return Q(n,"AutoEdit: trilha termina com a varia\xE7\xE3o",f=>{for(let y of p)f(y.item.createSetEndAction(y.fim))}),a(`trilha em ${p.length} de ${c.length} varia\xE7\xE3o(\xF5es) na A${Ge+1}, c\xF3pia da que j\xE1 estava`,p.length===c.length?"ok":"aviso"),{resumo:`${p.length} varia\xE7\xF5es`,aviso:p.length<c.length||l.length>0,com:m}}async function Jd(o,e,a,n){let t=ka(o,e,a),r=Sa(t,a);if(r.length>0)throw new Error(`legenda reprovada na valida\xE7\xE3o: ${r.slice(0,3).join("; ")}`);let i=t.filter(u=>u.estilo==="normal"),s=t.filter(u=>u.estilo==="preco"),c=t.filter(u=>u.precisaRevisao),l=await Go("legendas.srt",ve(i)),m=s.length>0?await Go("precos.srt",ve(s)):null;n(`${t.length} legendas \xB7 ${s.length} pre\xE7o(s) \xB7 ${c.length} para revisar`,"passo");for(let u of c.slice(0,6))n(`  revisar ${j(u.inicio)}: ${u.motivos.join("; ")}`,"aviso");let d=await $a(l,m);for(let u of d)n(u.texto,u.tipo);return{resumo:`${i.length} \xB7 ${s.length} pre\xE7o(s)`,aviso:d.some(u=>u.tipo==="erro"||u.tipo==="aviso"),blocos:t}}async function Wd(){let e=await(await(await(await so.Project.getActiveProject()).getActiveSequence()).getSelection()).getTrackItems();return Promise.all(e.map(async a=>({inicio:(await a.getStartTime()).seconds,fim:(await a.getEndTime()).seconds})))}async function Rs(o,e,a,n){let t=Date.now(),r=await I("ler a sequ\xEAncia",To(o.pausas),2e4),i=r.fps,s=ee(r);e(`${r.info.name}: ${r.v1.length} clipe(s) na V1, ${Eo(s,i).length} varia\xE7\xE3o(\xF5es)`,"passo");let c=Eo(s,i),l=o.soSelecao?yi(c,i,await I("sele\xE7\xE3o",Wd(),1e4)):c.map((x,R)=>R);if(l.length===0)throw new Error("Nada selecionado: clique num clipe da varia\xE7\xE3o que quer editar e tente de novo.");o.soSelecao&&e(`s\xF3 a sele\xE7\xE3o: varia\xE7\xE3o ${l.map(x=>x+1).join(", ")} de ${c.length}`,"passo"),n?.alvo(l);let m=[],d=s,u=await rt(Eo(s,i),i),g=[],p=[],f=[],y=[],b=()=>n?.variacoes(In(Eo(d,i),Eo(s,i),i,{clipes:d.map(x=>({inicio:x.inicioQ/i,fim:x.fimQ/i})),brolls:[...u.brolls,...g],leaks:[...u.leaks,...p],blocos:y,palavras:m,trilha:[...u.trilha,...f]})),P=async(x,R,A)=>{a(R.toLowerCase()),n?.etapa(x,"rodando");try{let $=await A();return n?.etapa(x,$.aviso?"aviso":"ok",$.resumo),$}catch($){let N=$?.message??String($);return e(`${R}: ${N}`,"erro"),n?.etapa(x,"erro",N),null}finally{b(),await new Promise($=>setTimeout($,300))}},T=await I("empresa",Ee(),5e3),M=Aa(T);e(`empresa: ${oo[T].nome} (termos do ElevenLabs e da legenda)`,"passo");let w=o.pausas||o.broll||o.legendas?await jd(M,e,a):{palavras:[],db:[]};m=w.palavras;let S=s.slice(1).map(x=>x.inicioQ/i);if(b(),o.pausas){a("decidindo as pausas"),n?.etapa("pausas","rodando");try{let x=m.filter(N=>N.fim>N.inicio).map(N=>({texto:N.text,inicio:N.inicio,fim:N.fim})),R=[...ja(w.db,$s,x),...wi(c,i,l).map(N=>({...N,motivo:"fala"}))],A=Math.max(...s.map(N=>N.fimQ)),$=Se(R,{fps:i,duracaoQ:A,margemS:.08});if($.cortes.length===0)e("nenhuma pausa para cortar","passo"),n?.etapa("pausas","ok","nenhuma pausa");else{let N=await Bd(r.v1),B=await et(r,$.trechos,a),K=B.emSincronia&&B.contagemOk&&B.duracaoOk;for(let W of at(B,B.pedacos.length))e(W,K?"passo":"aviso");e(`${$.cortes.length} pausas cortadas \xB7 ${j(A/i)} \u2192 ${j(B.totalQ/i)}`,"ok"),await _d(B.pedacos,s,N,e).catch(W=>e(`zoom/posi\xE7\xE3o n\xE3o reaplicados: ${W.message}`,"aviso")),m=gi(m,B.pedacos,i),S=hi(B.pedacos,i),d=B.pedacos.map(W=>({inicioQ:W.destinoQ,fimQ:W.destinoQ+W.midiaAteQ-W.midiaDeQ})),u=await rt(Eo(d,i),i),n?.etapa("pausas",K?"ok":"aviso",`${$.cortes.length} cortes \xB7 ${j(A/i)} \u2192 ${j(B.totalQ/i)}`)}}catch(x){throw n?.etapa("pausas","erro",x?.message??String(x)),x}b()}let h=Eo(d,i);if(o.soSelecao&&h.length!==c.length)throw new Error(`o corte mudou o n\xFAmero de varia\xE7\xF5es (${c.length} \u2192 ${h.length}); rode o resto com "Editar todas"`);let E=l.flatMap(x=>h[x]?[h[x]]:[]),q=x=>E.some(R=>x*i>=R.inicioQ&&x*i<R.fimQ);return o.broll&&(g=(await P("broll","B-roll",()=>Ud(m,E,i,r.info.name,e,a)))?.trechos??[]),o.split&&await P("split","Split",async()=>{let{lado:x,divisao:R,feather:A}=Jo[T],$=await Da({faixa:null,divisao:R,lado:x,feather:A,subirDoutor:!1,refazer:!1,entre:E.map(N=>({inicio:N.inicioQ/i,fim:N.fimQ/i}))});for(let N of $.linhas.slice(-4))e(`  ${N}`,"vazio");return e($.ok?"split aplicado":"split com avisos",$.ok?"ok":"aviso"),{resumo:$.ok?"aplicado":"com avisos",aviso:!$.ok}}),o.leak&&await P("leak","Light leak",async()=>{let x=await Hd(E,i,e);return p=x.inicios,x}),o.trilha&&await P("trilha","Trilha",async()=>{let x=await Gd(E,i,e);return f=x.com,x}),o.legendas&&await P("legendas","Legendas",async()=>{let x=await Jd(o.soSelecao?m.filter(R=>q(R.inicio)):m,S,M,e);return y=x.blocos,x}),e(`pronto em ${((Date.now()-t)/1e3).toFixed(0)} s`,"ok"),!0}var Ns="editar-log.json",ct="perfil.json",Fo={lerEstado:Is,editar:Rs,lerEmpresa:async()=>Rn(await z(ct)).empresa,trocarEmpresa:async o=>{let e=Yo(await z("config.json")),a=Ai(Rn(await z(ct)),e.libraryPath,o);return await F(ct,a.perfil),await F("config.json",{...e,libraryPath:a.pasta}),{nome:oo[a.perfil.empresa].nome,pasta:a.pasta}},guardarLog:async o=>{let e=await z(Ns).catch(()=>null),a=Array.isArray(e?.execucoes)?e.execucoes:[];await F(Ns,{execucoes:[...a,{quando:new Date().toISOString(),linhas:[...o]}].slice(-10)})}};var Os=`<!-- SilenceCut, no layout das telas novas (estilo comum em telas.css). A mesma
     tela no painel e no programa; o motor e que muda (src/silencecut.ts).
     UXP: sem grid, sem gap, sem var(); clicavel e div[role=button]. -->
<style>
  .sc-rotulo {
    margin-bottom: 5px;
    font-size: 11px;
    color: #9098a6;
  }

  .sc-barras {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    margin: 10px 0 4px 0;
  }

  .sc-barra-linha {
    display: flex;
    flex-direction: row;
    align-items: center;
    margin: 3px 0;
    font-size: 11px;
    color: #9098a6;
  }

  .sc-barra-rot {
    flex: none;
    width: 48px;
  }

  .sc-barra {
    display: flex;
    flex-direction: row;
    flex: 1 1 auto;
    height: 10px;
    border-radius: 3px;
    overflow: hidden;
    background-color: #101318;
  }

  .sc-barra-tempo {
    flex: none;
    width: 44px;
    margin-left: 8px;
    text-align: right;
  }

  .sc-cheio-antes { background-color: #5f6774; }
  .sc-cheio-depois { background-color: #4ecb8d; }

  .tl-seg.sc-corta { background-color: #ff7d71; }
  .tl-seg.sc-fica { background-color: #5f6774; }

  .sc-lista {
    display: flex;
    flex-direction: column;
    align-items: stretch;
    margin-top: 8px;
  }

  .sc-corte {
    display: flex;
    flex-direction: row;
    align-items: center;
    padding: 4px 6px;
    border-bottom: 1px solid #1a1e26;
    font-size: 12px;
    color: #c9ced8;
  }

  .sc-corte-tempo {
    flex: none;
    width: 44px;
    color: #9098a6;
  }

  .sc-corte-dur {
    flex: none;
    width: 46px;
    color: #ff7d71;
  }

  .sc-corte-palavras {
    flex: 1 1 auto;
    min-width: 0;
    white-space: nowrap;
    overflow: hidden;
    text-overflow: ellipsis;
  }

  .sc-confira {
    flex: none;
    margin-left: 6px;
    padding: 0 6px;
    border-radius: 8px;
    font-size: 11px;
    background-color: #3a2c14;
    color: #eeab4c;
  }

  .sc-mais {
    padding: 6px;
    font-size: 11px;
    color: #5f6774;
  }
</style>

<header class="ed-topo">
  <span class="ed-titulo">SilenceCut <span id="scSeq" class="ed-seq">\xB7 lendo\u2026</span></span>
  <span id="scPill" class="pill" data-tom="ativo">lendo</span>
</header>

<main id="scRolagem" class="conteudo">
  <div class="bloco">
    <div class="sc-rotulo">Sil\xEAncio que fica de cada lado da palavra (menor = mais colado)</div>
    <div id="scMargens" class="chips"></div>
    <div class="prog-linha"><span id="scProg" class="prog-txt">lendo a sequ\xEAncia\u2026</span></div>
  </div>

  <div class="det">
    <div class="mets">
      <div class="met"><span class="met-rot">Pausas</span><span id="scMetPausas" class="met-val" style="color: #ff7d71">\u2013</span></div>
      <div class="met"><span class="met-rot">Cortado</span><span id="scMetMenos" class="met-val" style="color: #4ecb8d">\u2013</span></div>
      <div class="met"><span class="met-rot">Para conferir</span><span id="scMetConfira" class="met-val" style="color: #eeab4c">\u2013</span></div>
    </div>

    <div class="sc-barras">
      <div class="sc-barra-linha">
        <span class="sc-barra-rot">antes</span>
        <span class="sc-barra"><span class="sc-cheio-antes" style="flex-grow: 1"></span></span>
        <span id="scAntes" class="sc-barra-tempo">\u2013</span>
      </div>
      <div class="sc-barra-linha">
        <span class="sc-barra-rot">depois</span>
        <span class="sc-barra"><span id="scDepoisCheio" class="sc-cheio-depois" style="flex-grow: 1"></span><span id="scDepoisResto" style="flex-grow: 0"></span></span>
        <span id="scDepois" class="sc-barra-tempo">\u2013</span>
      </div>
    </div>

    <div class="tl-linha"><span class="tl-rot">V1</span><div id="scFaixa" class="tl-faixa"></div></div>

    <div id="scLista" class="sc-lista"></div>

    <div id="scFeed" class="feed"></div>
    <div id="scVerLog" class="ver-log" role="button" tabindex="0">ver o registro completo</div>
    <pre id="scLog" class="log" style="display: none"></pre>
  </div>
</main>

<footer class="rodape">
  <div id="scCortar" class="btn-pri" role="button" tabindex="0"><span id="scIcoCortar" class="btn-ico"></span>Cortar pausas</div>
  <div id="scPrevia" class="btn-sec btn-selecao" role="button" tabindex="0"><span id="scIcoPrevia" class="btn-ico"></span>Ver pr\xE9via</div>
  <div id="scDesfazer" class="btn-redondo" role="button" tabindex="0" title="Desfazer o \xFAltimo corte" aria-label="Desfazer o \xFAltimo corte"><span id="scIcoDesfazer" class="btn-ico-so"></span></div>
</footer>
`;var Ds=[.05,.08,.12,.2],Kd=1;function Fs(o,e){let a=Se(o.blocos,{fps:o.fps,duracaoQ:o.duracaoQ,margemS:e}),{totalQ:n}=Va(a.trechos,o.clipesQ);return{nomeSequencia:o.nomeSequencia,antesS:a.duracaoAntesQ/o.fps,depoisS:n/o.fps,cortes:a.cortes.map(t=>({inicioS:t.inicioQ/o.fps,fimS:t.fimQ/o.fps,antes:ms(t.antes),depois:ps(t.depois),confira:(t.fimQ-t.inicioQ)/o.fps>Kd})),palavras:o.palavras.length,clipes:o.clipes,protegidos:o.blocos.filter(t=>t.motivo!=="fala").length}}var Ls=.08,lt=60,We=(o,e=1)=>o.toFixed(e).replace(".",","),Lo=o=>{let e=Math.max(0,Math.round(o));return`${Math.floor(e/60)}:${String(e%60).padStart(2,"0")}`},Zd=0;function zs(o,e){let a=A=>o.querySelector(`#${A}`),n=o.ownerDocument,t=A=>{for(;A.firstChild;)A.removeChild(A.firstChild)},r=(A,$,N,B="")=>{let K=n.createElement($);return K.className=N,K.textContent=B,A.appendChild(K),K},i=(A,$)=>{let N=()=>{A.setAttribute("data-apertado","sim"),setTimeout(()=>A.setAttribute("data-apertado","nao"),180),$()};A.addEventListener("click",N),A.addEventListener("keydown",B=>{(B.key==="Enter"||B.key===" ")&&N()})},s=Ls,c=null,l=!1,m=a("scLog"),d=[],u=[],g=()=>{let A=a("scFeed");t(A),u.length===0&&r(A,"span","feed-linha","O que acontece aparece aqui.");for(let $ of u.slice(-4))r(A,"span","feed-linha",$.texto).setAttribute("data-tom",$.tom)},p=(A,$="passo")=>{let N=$==="erro"?"\u2717 ":$==="aviso"?"! ":$==="ok"?"\u2713 ":"";d.push(`${N}${A}`),m.textContent=d.join(`
`),u.push({texto:`${N}${A}`,tom:$}),g()},f=!1;i(a("scVerLog"),()=>{f=!f,m.setAttribute("style",f?"":"display: none"),a("scVerLog").textContent=f?"esconder o registro completo":"ver o registro completo",f&&setTimeout(()=>a("scRolagem").scrollTop=a("scRolagem").scrollHeight,0)});let y=(A,$)=>{a("scPill").textContent=A,a("scPill").setAttribute("data-tom",$)},b=A=>{a("scProg").textContent=A},P=A=>{let $=A?.message??String(A);p($,"erro"),y("falhou","erro"),b(`Parou: ${$}`)},T=()=>{let A=a("scMargens");t(A);for(let $ of Ds){let N=r(A,"div","chip",`${We($,2)} s${$===Ls?" \xB7 padr\xE3o":""}`);N.setAttribute("role","button"),N.setAttribute("tabindex","0"),N.setAttribute("data-on",$===s?"sim":"nao"),$===s&&N.setAttribute("style","border-color: #4ecb8d"),i(N,()=>{l||$===s||(s=$,T(),c&&h())})}},M=()=>{let A=c;a("scMetPausas").textContent=A?String(A.cortes.length):"\u2013";let $=A?A.antesS-A.depoisS:0;a("scMetMenos").textContent=A?`\u2212${$<60?`${We($)} s`:Lo($)}`:"\u2013";let N=A?A.cortes.filter(Z=>Z.confira).length:0;a("scMetConfira").textContent=A?String(N):"\u2013",a("scAntes").textContent=A?Lo(A.antesS):"\u2013",a("scDepois").textContent=A?Lo(A.depoisS):"\u2013";let B=A&&A.antesS>0?Math.round(A.depoisS/A.antesS*1e3):1e3;a("scDepoisCheio").setAttribute("style",`flex-grow: ${B}`),a("scDepoisResto").setAttribute("style",`flex-grow: ${1e3-B}`);let K=a("scFaixa");if(t(K),A){let Z=A.cortes.map(ao=>({de:ao.inicioS,ate:ao.fimS}));for(let ao of Ke(Z,A.antesS))r(K,"span",`tl-seg ${ao.item<0?"sc-fica":"sc-corta"}`).setAttribute("style",`flex-grow: ${ao.grow}`)}let W=a("scLista");if(t(W),!!A){for(let Z of A.cortes.slice(0,lt)){let ao=r(W,"div","sc-corte");r(ao,"span","sc-corte-tempo",Lo(Z.inicioS)),r(ao,"span","sc-corte-dur",`${We(Z.fimS-Z.inicioS)} s`),r(ao,"span","sc-corte-palavras",`"${Z.antes}" | "${Z.depois}"`),Z.confira&&r(ao,"span","sc-confira","confira")}A.cortes.length>lt&&r(W,"div","sc-mais",`e mais ${A.cortes.length-lt} cortes no registro completo`)}},w=A=>async()=>{if(!l){l=!0;try{await A()}catch($){P($)}finally{l=!1,e.guardarLog(d).catch(()=>{})}}},S=w(async()=>{y("lendo","ativo");let A=await e.ler();a("scSeq").textContent=`\xB7 ${A.nome}`,b(`${A.clipes} clipe(s) na V1 \xB7 ${A.palavras} palavras na transcri\xE7\xE3o \xB7 ${Lo(A.duracaoS)} de grava\xE7\xE3o`),y("pronto","ok")}),h=w(async()=>{y("analisando","ativo"),b("Medindo a fala\u2026 a primeira vez l\xEA o \xE1udio da bruta (uns segundos)."),c=await e.previa(s),M();let A=c;b(`${A.cortes.length} pausas \xB7 ${Lo(A.antesS)} \u2192 ${Lo(A.depoisS)} \xB7 margem ${We(s,2)} s`+(A.protegidos>0?` \xB7 ${A.protegidos} trecho(s) de voz protegido(s)`:"")),d.push(...A.cortes.map($=>`${Lo($.inicioS)} \xB7 ${We($.fimS-$.inicioS)} s \xB7 "${$.antes}" | "${$.depois}"${$.confira?"  <- confira":""}`)),m.textContent=d.join(`
`),y("pr\xE9via pronta","ok")}),E=w(async()=>{y("cortando","ativo"),b("Cortando. N\xE3o mexa na timeline at\xE9 terminar.");let A=await e.cortar(s,$=>b(`Cortando \xB7 ${$}`));for(let $ of A.linhas)p($,A.ok?"passo":"aviso");y(A.ok?"cortado":"cortado com problema",A.ok?"ok":"erro"),b(A.ok?"Pausas cortadas. O bot\xE3o redondo desfaz.":"Cortado com problema: veja o registro."),c=null,M()}),q=w(async()=>{y("desfazendo","ativo");for(let A of await e.desfazer())p(A,"passo");y("desfeito","ok"),b("Corte desfeito.")});i(a("scPrevia"),()=>void h()),i(a("scCortar"),()=>void E()),i(a("scDesfazer"),()=>void q()),a("scIcoCortar").innerHTML=lo("pausas","#ffffff"),a("scIcoPrevia").innerHTML=lo("selecao","#85b7eb"),a("scIcoDesfazer").innerHTML=lo("reler","#9098a6");let x=String(++Zd);m.setAttribute("data-abertura",x);let R=setInterval(()=>{if(n.getElementById("scLog")?.getAttribute("data-abertura")!==x){clearInterval(R);return}l||e.preparar().then(A=>{A&&p("\xE1udio da bruta nova lido: a pr\xE9via e o corte j\xE1 v\xE3o direto","ok")}).catch(()=>{})},2e3);T(),g(),M(),S()}var js="",Vs="",So={ler:async()=>{let o=await Es();return{nome:o.nomeSequencia,duracaoS:o.duracaoQ/o.fps,clipes:o.clipes,palavras:o.palavras.length}},previa:async o=>Fs(await Zn(),o),cortar:(o,e)=>Ms(o,e),desfazer:()=>nt(),preparar:async()=>{let o=await As(),e=o===js;return js=o,!e||o===Vs||(Vs=o,await Ts())?!1:(await Kn(),!0)},guardarLog:o=>Ps(o)};var dt=`/*
 * Estilo comum das telas novas (AutoEdit e SilenceCut), no painel e no
 * programa: topo com pilula, empresas, andamento, numeros, faixas da
 * timeline, tela 9:16, registro curto e rodape com botoes de icone. Vem
 * depois da folha da familia (ferramentas/auto-broll/src/ui/styles.css).
 * UXP: sem grid, sem gap, sem var(), sem largura em % (UXP_ARMADILHAS.md).
 */

.ed-topo {
  display: flex;
  flex-direction: row;
  align-items: center;
  flex: none;
  padding: 9px 12px;
  background-color: #1a1e26;
  border-bottom: 1px solid #232830;
}

.ed-titulo {
  flex: 1 1 auto;
  min-width: 0;
  font-size: 14px;
  font-weight: 600;
  color: #eceef2;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.ed-seq {
  font-weight: 400;
  color: #9098a6;
}

.pill {
  flex: none;
  padding: 2px 10px;
  border-radius: 10px;
  font-size: 11px;
  background-color: #14301f;
  color: #4ecb8d;
}

.pill[data-tom="ativo"] {
  background-color: #1a2440;
  color: #85b7eb;
}

.pill[data-tom="aviso"] {
  background-color: #3a2c14;
  color: #eeab4c;
}

.pill[data-tom="erro"] {
  background-color: #3a1e1c;
  color: #ff7d71;
}

.conteudo {
  padding: 0;
}

.bloco {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  flex: none;
  padding: 8px 12px 0 12px;
}

/* ---- empresas */
.chips {
  display: flex;
  flex-direction: row;
  flex-wrap: wrap;
}

.chip {
  flex: none;
  margin: 0 6px 4px 0;
  padding: 2px 10px;
  border: 1px solid #333b47;
  border-radius: 10px;
  font-size: 11px;
  color: #9098a6;
  cursor: pointer;
}

.chip[data-on="sim"] {
  background-color: #1a1e26;
  color: #eceef2;
  font-weight: 600;
}

.chip[data-on="sim"][data-empresa="androclinic"] { border-color: #3b82f6; }
.chip[data-on="sim"][data-empresa="grandcare"] { border-color: #4fc3a1; }
.chip[data-on="sim"][data-empresa="menopausa"] { border-color: #e07ba8; }

/* ---- andamento */
.prog-linha {
  display: flex;
  flex-direction: row;
  margin-top: 6px;
  font-size: 12px;
  color: #9098a6;
}

/* Quebra linha: e aqui que aparece o motivo quando o Editar para. */
.prog-txt {
  flex: 1 1 auto;
  min-width: 0;
}

.prog-cont {
  flex: none;
  margin-left: 8px;
}

.barra {
  display: flex;
  flex-direction: row;
  flex: none;
  height: 4px;
  margin-top: 5px;
  border-radius: 2px;
  overflow: hidden;
  background-color: #1a1e26;
}

.barra-feito {
  background-color: #3b82f6;
}

/* ---- detalhe da variacao escolhida */
.det {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  flex: none;
  margin-top: 8px;
  padding: 8px 12px 4px 12px;
  border-top: 1px solid #232830;
}

.det-cabeca {
  display: flex;
  flex-direction: row;
  align-items: center;
  margin-bottom: 4px;
}

.det-nome {
  flex: 1 1 auto;
  min-width: 0;
  font-weight: 600;
  color: #eceef2;
  white-space: nowrap;
  overflow: hidden;
  text-overflow: ellipsis;
}

.det-dur {
  flex: none;
  margin-left: 8px;
  font-size: 12px;
  color: #9098a6;
}

.mets {
  display: flex;
  flex-direction: row;
  margin: 0 -3px;
}

.met {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  flex: 1 1 0px;
  min-width: 0;
  margin: 3px;
  padding: 5px 7px;
  background-color: #14171d;
  border: 1px solid #232830;
  border-radius: 7px;
}

.met-rot {
  font-size: 11px;
  color: #9098a6;
}

.met-val {
  font-size: 17px;
  font-weight: 600;
  color: #eceef2;
}

/* ---- timeline viva + tela 9:16 (faixas em flex-grow, segmentos() em shell.ts) */
.tl-caixa {
  display: flex;
  flex-direction: row;
  align-items: flex-start;
}

.tl {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  flex: 1 1 auto;
  min-width: 0;
}

.tl-linha {
  display: flex;
  flex-direction: row;
  align-items: center;
  margin: 3px 0;
}

.tl-rot {
  flex: none;
  width: 20px;
  font-size: 11px;
  color: #5f6774;
}

.tl-faixa {
  display: flex;
  flex-direction: row;
  flex: 1 1 auto;
  min-width: 0;
  height: 11px;
  border-radius: 3px;
  overflow: hidden;
  background-color: #101318;
}

.tl-seg {
  flex-basis: 0px;
  min-width: 0;
  height: 11px;
  cursor: pointer;
}

.tl-V1 { background-color: #5f6774; border-right: 1px solid #101318; }
.tl-V2 { background-color: #8d82f5; }
.tl-V3 { background-color: #eeab4c; }
.tl-A2 { background-color: #4fc3a1; }
.tl-C1 { background-color: #eceef2; border-right: 1px solid #101318; }
.tl-C2 { background-color: #ff7d71; }

/* Linha vermelha do comeco ate o cursor: no Premiere, so o cursor era um
   ponto que ninguem via. */
.tl-regua {
  align-items: center;
  height: 10px;
  background-color: transparent;
}

.tl-cursor {
  flex: none;
  width: 3px;
  height: 10px;
  border-radius: 1px;
  background-color: #ff7d71;
}

.tl-ctrl {
  display: flex;
  flex-direction: row;
  align-items: center;
  margin-top: 6px;
  font-size: 11px;
  color: #9098a6;
}

.tl-play {
  flex: none;
  margin-right: 6px;
  padding: 0 4px;
  font-size: 13px;
  color: #eceef2;
  cursor: pointer;
}

.tl-dica {
  margin-left: 8px;
  color: #5f6774;
  white-space: nowrap;
  overflow: hidden;
}

.tela {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  flex: none;
  width: 86px;
  height: 153px;
  margin-left: 10px;
  border: 2px solid #232830;
  border-radius: 9px;
  overflow: hidden;
  background-color: #000000;
}

.tela[data-leak="sim"] {
  border-color: #eeab4c;
}

.tela-parte {
  display: flex;
  flex-direction: column;
  justify-content: center;
  align-items: center;
  flex-basis: 0px;
  min-height: 0;
  overflow: hidden;
  font-size: 11px;
  text-align: center;
}

.tela-parte[data-tipo="doutor"] {
  background-color: #262b34;
  color: #9098a6;
}

.tela-parte[data-tipo="broll"] {
  background-color: #2b2650;
  color: #cecbf6;
}

.tela-leg {
  margin-top: 6px;
  min-height: 16px;
  font-size: 12px;
  font-weight: 600;
  color: #eceef2;
  text-align: right;
}

.tela-leg[data-preco="sim"] {
  color: #ff7d71;
}

.legenda-fala {
  margin-bottom: 6px;
  font-size: 11px;
  color: #5f6774;
}

/* ---- registro curto */
.feed {
  display: flex;
  flex-direction: column;
  align-items: stretch;
  margin-top: 8px;
  padding-top: 6px;
  border-top: 1px solid #1a1e26;
  min-height: 60px;
}

.feed-linha {
  margin: 1px 0;
  font-size: 12px;
  color: #9098a6;
}

.feed-linha[data-tom="ok"] { color: #4ecb8d; }
.feed-linha[data-tom="aviso"] { color: #eeab4c; }
.feed-linha[data-tom="erro"] { color: #ff7d71; }

.ver-log {
  margin: 4px 0 8px 0;
  font-size: 11px;
  color: #5f6774;
  cursor: pointer;
}

.log {
  height: 200px;
  margin: 0 0 8px 0;
}

/* ---- resposta ao clique: o que foi tocado acende por um instante (JS liga
   data-apertado; o UXP nao garante :active nem transicao). */
[data-apertado="sim"] {
  background-color: #2a3550;
}

.btn-pri[data-apertado="sim"] {
  background-color: #1d4ed8;
  border-color: #1d4ed8;
}

.var:hover,
.chip:hover,
.aba:hover,
.btn-sec:hover {
  border-color: #4a5466;
}

/* ---- rodape */
.rodape {
  display: flex;
  flex-direction: row;
  align-items: center;
  flex: none;
  padding: 10px 12px;
  border-top: 1px solid #232830;
  background-color: #0d0f13;
}

/* Botoes com icone de caixa (icone() em shell.ts), sem fonte nem emoji. */
.btn-pri,
.btn-sec {
  display: flex;
  flex-direction: row;
  align-items: center;
  flex: none;
  border-radius: 18px;
  font-weight: 600;
  cursor: pointer;
}

.btn-pri {
  padding: 8px 16px;
  border: 1px solid #3b82f6;
  background-color: #3b82f6;
  color: #ffffff;
}

.btn-sec {
  margin-left: 8px;
  padding: 8px 14px;
  border: 1px solid #333b47;
  background-color: #14171d;
  color: #c9ced8;
}

.btn-selecao {
  border-color: #3b82f6;
  color: #85b7eb;
}

.btn-ico {
  display: flex;
  flex: none;
  margin-right: 8px;
}

.btn-redondo {
  display: flex;
  flex-direction: row;
  align-items: center;
  justify-content: center;
  flex: none;
  width: 34px;
  height: 34px;
  margin-left: auto;
  border: 1px solid #333b47;
  border-radius: 17px;
  background-color: #14171d;
  cursor: pointer;
}

.btn-ico-so {
  display: flex;
}

.btn-sec:hover,
.btn-redondo:hover {
  border-color: #4a5466;
}

.btn-selecao:hover {
  border-color: #85b7eb;
}
`;var Ys=`<!-- Fragmento: o shell injeta isto direto em document.body, depois da folha da\r
     familia (ferramentas/auto-broll/src/ui/styles.css). Aqui fica so o acento\r
     desta ferramenta e o que nao existe na folha: a linha rotulo + select.\r
\r
     Sem CSS Grid, sem gap, sem var(): nada disso e confiavel no UXP (ver\r
     ferramentas/auto-broll/docs/UXP_ARMADILHAS.md). -->\r
<style>\r
  .marca-nome::before {\r
    background-color: #4fc3a1;\r
  }\r
\r
  .cod-pessoa {\r
    color: #4fc3a1;\r
  }\r
\r
  .linha {\r
    display: flex;\r
    flex-direction: row;\r
    align-items: center;\r
    margin-bottom: 6px;\r
  }\r
\r
  .linha:last-child {\r
    margin-bottom: 0;\r
  }\r
\r
  .linha label {\r
    flex: 1 1 auto;\r
    min-width: 0;\r
    font-size: 12px;\r
    color: #9098a6;\r
  }\r
\r
  .linha select {\r
    flex: none;\r
    width: 96px;\r
  }\r
\r
  .campo {\r
    margin-bottom: 10px;\r
  }\r
\r
  .acao sp-button {\r
    flex: 1 1 130px;\r
  }\r
\r
  /* A previa lista ate 40 planos: mais alto que o log padrao da familia. */\r
  .log {\r
    height: 220px;\r
    margin: 0;\r
  }\r
</style>\r
\r
<header class="topo">\r
  <div class="marca">\r
    <span class="marca-nome">PodCut</span>\r
  </div>\r
  <div id="acEstado" class="badge">carregando</div>\r
</header>\r
\r
<main class="conteudo">\r
  <section class="secao">\r
    <div class="secao-cabeca">\r
      <span class="cod">SEQ</span>\r
      <span class="secao-rotulo">Sequ\xEAncia ativa</span>\r
    </div>\r
    <div class="secao-corpo">\r
      <div id="acSeqNome" class="seq-nome" data-vazio="sim">Nenhuma sequ\xEAncia selecionada</div>\r
      <div class="linha"><label for="acFps">Quadros por segundo</label><select id="acFps"></select></div>\r
    </div>\r
  </section>\r
\r
  <div class="par">\r
    <section class="secao">\r
      <div class="secao-cabeca">\r
        <span class="cod cod-pessoa">A</span>\r
        <span class="secao-rotulo">Pessoa A</span>\r
      </div>\r
      <div class="secao-corpo">\r
        <div class="linha"><label for="acVideoA">C\xE2mera</label><select id="acVideoA"></select></div>\r
        <div class="linha"><label for="acAudioA">Microfone</label><select id="acAudioA"></select></div>\r
      </div>\r
    </section>\r
\r
    <section class="secao">\r
      <div class="secao-cabeca">\r
        <span class="cod cod-pessoa">B</span>\r
        <span class="secao-rotulo">Pessoa B</span>\r
      </div>\r
      <div class="secao-corpo">\r
        <div class="linha"><label for="acVideoB">C\xE2mera</label><select id="acVideoB"></select></div>\r
        <div class="linha"><label for="acAudioB">Microfone</label><select id="acAudioB"></select></div>\r
      </div>\r
    </section>\r
  </div>\r
\r
  <section class="secao">\r
    <div class="secao-cabeca">\r
      <span class="cod">WAV</span>\r
      <span class="secao-rotulo">Quem fala, pelo n\xEDvel do \xE1udio (opcional)</span>\r
    </div>\r
    <div class="secao-corpo">\r
      <label class="campo">\r
        <span class="campo-rotulo">Caminho do WAV com um canal por pessoa</span>\r
        <sp-textfield id="acWav" placeholder="vazio = usa a transcri\xE7\xE3o"></sp-textfield>\r
        <span class="campo-nota">\r
          Exporte do Premiere em WAV PCM mantendo os canais; 16 kHz basta. Vazio, a an\xE1lise usa a transcri\xE7\xE3o dos\r
          clipes de \xE1udio.\r
        </span>\r
      </label>\r
      <div class="linha"><label for="acCanalA">Canal da pessoa A</label><select id="acCanalA"></select></div>\r
      <div class="linha"><label for="acCanalB">Canal da pessoa B</label><select id="acCanalB"></select></div>\r
    </div>\r
  </section>\r
\r
  <div class="acao">\r
    <sp-button id="acAnalisar" variant="secondary">Analisar</sp-button>\r
    <sp-button id="acAplicar" variant="cta" disabled>Aplicar cortes</sp-button>\r
  </div>\r
\r
  <section class="secao secao-log">\r
    <div class="secao-cabeca">\r
      <span class="cod">LOG</span>\r
      <span class="secao-rotulo">Registro</span>\r
    </div>\r
    <div class="secao-corpo">\r
      <pre id="acLog" class="log">Abra a sequ\xEAncia do podcast e clique em Analisar.</pre>\r
    </div>\r
  </section>\r
</main>\r
`;var Me=[],ut=[23.976,24,25,29.97,30,50,59.94,60];function Ce(o,e,a,n){o.innerHTML="";for(let t=0;t<a;t++){let r=document.createElement("option");r.value=String(t),r.textContent=`${e}${t+1}`,t===n&&(r.selected=!0),o.appendChild(r)}}function au(o,e){if(o.innerHTML="",!(e>0)){let n=document.createElement("option");n.value="0",n.textContent="escolha",n.selected=!0,o.appendChild(n)}let a=e>0&&!ut.some(n=>Math.abs(n-e)<.01)?[...ut,e].sort((n,t)=>n-t):ut;for(let n of a){let t=document.createElement("option");t.value=String(n),t.textContent=n.toFixed(3).replace(/\.?0+$/,""),Math.abs(n-e)<.01&&(t.selected=!0),o.appendChild(t)}}function nu(o){let e=Math.floor(o/60),a=Math.floor(o%60);return`${String(e).padStart(2,"0")}:${String(a).padStart(2,"0")}`}function Bs(o){let e=u=>o.querySelector(`#${u}`),a=e("acLog"),n=e("acAplicar"),t=e("acWav"),r={fps:e("acFps"),canalA:e("acCanalA"),canalB:e("acCanalB"),videoA:e("acVideoA"),audioA:e("acAudioA"),videoB:e("acVideoB"),audioB:e("acAudioB")},i=(...u)=>{a.textContent=u.join(`
`),a.scrollTop=a.scrollHeight},s=(u,g)=>{let p=e("acEstado");p.textContent=u,p.setAttribute("data-tom",g)},c=u=>{u?n.removeAttribute("disabled"):n.setAttribute("disabled","")},l=()=>({videoA:Number(r.videoA.value),audioA:Number(r.audioA.value),videoB:Number(r.videoB.value),audioB:Number(r.audioB.value)}),m=u=>{c(!1),s("falhou","erro"),i(`Erro: ${u?.message??String(u)}`)},d=async()=>{let u=await no(),g=e("acSeqNome");g.textContent=u.name,g.setAttribute("data-vazio","nao");let p=await Te();return au(r.fps,p.valor),Ce(r.canalA,"Canal ",8,0),Ce(r.canalB,"Canal ",8,1),Ce(r.videoA,"V",u.videoTracks,Ue.videoA),Ce(r.audioA,"A",u.audioTracks,Ue.audioA),Ce(r.videoB,"V",u.videoTracks,Ue.videoB),Ce(r.audioB,"A",u.audioTracks,Ue.audioB),[`${u.name} \u2014 ${u.videoTracks}V / ${u.audioTracks}A`,p.valor>0?`${p.valor.toFixed(3)} fps detectados (${p.origem})`:`Premiere nao entregou a taxa de quadros \u2014 escolha acima. ${p.origem}`]};(async()=>{try{i(...await d()),s("pronto","ok")}catch(u){m(u)}})(),e("acAnalisar").addEventListener("click",()=>{(async()=>{try{c(!1),s("analisando","ativo"),i("Analisando...");let u=await d(),g=Number(r.fps.value);if(!(g>0))throw new Error("Escolha a taxa de quadros da sequencia antes de analisar.");let p=t.value.trim(),f=p?await ns(p,Number(r.canalA.value),Number(r.canalB.value),jn,Ui):await as(l(),jn);Me=Bi(f.trechos,g);let y=await Zi(l(),Me,g);c(y.ok),s(y.ok?"pronto para aplicar":"revise o registro",y.ok?"ok":"aviso");let b=Me.slice(0,40).map(P=>`${nu(P.inicioF/g)}  ${P.speaker}`);Me.length>b.length&&b.push(`... e mais ${Me.length-b.length} planos`),i(...u,"",...f.linhas,"",...y.linhas,"",...b,"",y.ok?"Pronto para aplicar.":"Corrija os pontos acima antes de aplicar.")}catch(u){m(u)}})()}),n.addEventListener("click",()=>{n.hasAttribute("disabled")||(async()=>{try{c(!1),s("aplicando","ativo"),i("Aplicando...");let u=await os(l(),Me,Number(r.fps.value));s(u.ok?"cortes aplicados":"aplicado com problema",u.ok?"ok":"erro"),i(...u.linhas,"",u.ok?"Cortes aplicados.":"Aplicado com problema: desfa\xE7a (Ctrl+Z) e mande este registro.")}catch(u){m(u)}})()})}var Qs=`<!-- Fragmento: o shell injeta isto direto em document.body, depois da folha da\r
     familia (ferramentas/auto-broll/src/ui/styles.css). Aqui fica so o acento\r
     desta ferramenta e o que nao existe na folha.\r
\r
     Botoes sao sp-button, nao <button>: o <button> nativo ignora o CSS no UXP.\r
     Sem CSS Grid, sem gap, sem var() (ver\r
     ferramentas/auto-broll/docs/UXP_ARMADILHAS.md). -->\r
<style>\r
  .marca-nome::before {\r
    background-color: #e07ba8;\r
  }\r
\r
  .cod-split {\r
    color: #e07ba8;\r
  }\r
\r
  .campo {\r
    margin-bottom: 12px;\r
  }\r
\r
  .acao sp-button#asAplicar {\r
    flex: 2 1 180px;\r
  }\r
\r
  .acao sp-button#asDiag,\r
  .acao sp-button#asQuadrado {\r
    flex: 1 1 110px;\r
  }\r
\r
  .log {\r
    height: 180px;\r
    margin: 0;\r
  }\r
</style>\r
\r
<header class="topo">\r
  <div class="marca">\r
    <span class="marca-nome">SplitScreen</span>\r
  </div>\r
  <div id="asEstado" class="badge">carregando</div>\r
</header>\r
\r
<main class="conteudo">\r
  <section class="secao">\r
    <div class="secao-cabeca">\r
      <span class="cod">SEQ</span>\r
      <span class="secao-rotulo">Sequ\xEAncia ativa</span>\r
    </div>\r
    <div class="secao-corpo">\r
      <div id="asSeqNome" class="seq-nome" data-vazio="sim">Nenhuma sequ\xEAncia selecionada</div>\r
      <div class="dica">\r
        \xDAltimo passo da edi\xE7\xE3o: revise os B-rolls antes de aplicar. Um Ctrl+Z desfaz cada etapa.\r
      </div>\r
    </div>\r
  </section>\r
\r
  <section class="secao">\r
    <div class="secao-cabeca">\r
      <span class="cod cod-split">V2+</span>\r
      <span class="secao-rotulo">Tela dividida</span>\r
    </div>\r
    <div class="secao-corpo">\r
      <label class="campo">\r
        <span class="campo-rotulo">Faixa dos B-rolls</span>\r
        <sp-textfield id="asFaixa" placeholder="todas acima da V1"></sp-textfield>\r
        <span class="campo-nota">O n\xFAmero como aparece no Premiere: V2 = 2. Vazio usa todas acima da V1.</span>\r
      </label>\r
      <label class="campo">\r
        <span class="campo-rotulo">Onde a tela divide (% da altura)</span>\r
        <sp-textfield id="asDivisao" value="58"></sp-textfield>\r
        <span class="campo-nota">50 = meio a meio. Aceita de 40 a 60.</span>\r
      </label>\r
      <sp-checkbox id="asRefazer">Refazer do zero (troca o efeito j\xE1 aplicado)</sp-checkbox>\r
    </div>\r
  </section>\r
\r
  <div class="acao">\r
    <sp-button id="asAplicar" variant="cta">Aplicar SplitScreen</sp-button>\r
    <sp-button id="asQuadrado" variant="secondary">Quadrado 1:1</sp-button>\r
    <sp-button id="asDiag" variant="secondary" quiet>Diagn\xF3stico</sp-button>\r
  </div>\r
\r
  <section class="secao secao-log">\r
    <div class="secao-cabeca">\r
      <span class="cod">LOG</span>\r
      <span class="secao-rotulo">Registro</span>\r
    </div>\r
    <div class="secao-corpo">\r
      <pre id="asLog" class="log">Lendo a sequ\xEAncia...</pre>\r
    </div>\r
  </section>\r
</main>\r
`;function _s(o){let e=d=>o.querySelector(`#${d}`),a=e("asLog"),n=e("asFaixa"),t=e("asDivisao"),r=e("asRefazer"),i=(...d)=>{a.textContent=d.join(`
`),a.scrollTop=a.scrollHeight},s=(d,u)=>{let g=e("asEstado");g.textContent=d,g.setAttribute("data-tom",u)},c=d=>{s("falhou","erro"),i(`Erro: ${d?.message??String(d)}`)},l=Jo.androclinic,m=()=>{let d=n.value.trim(),u=Number(d);return{faixa:d===""||!Number.isFinite(u)||u<1?null:u-1,divisao:Number(t.value)||No,subirDoutor:!1,refazer:r.checked,lado:l.lado,feather:l.feather}};(async()=>{try{let d=await Ee();l=Jo[d],t.value=String(l.divisao);let u=await no(),g=e("asSeqNome");g.textContent=u.name,g.setAttribute("data-vazio","nao"),i(`${u.name} \u2014 ${u.width}x${u.height}`,`${oo[d].nome}: B-roll ${l.lado==="cima"?"em cima":"embaixo"} (troca no Editar)`),s("pronto","ok")}catch(d){c(d)}})(),e("asAplicar").addEventListener("click",()=>{(async()=>{try{s("aplicando","ativo"),i("Aplicando...");let d=await Da(m());s(d.ok?"aplicado":"aplicado com problema",d.ok?"ok":"erro"),i(...d.linhas,"",d.ok?"Pronto. Ajuste o que precisar no Premiere.":"Aplicado com problema: veja as linhas acima.")}catch(d){c(d)}})()}),e("asQuadrado").addEventListener("click",()=>{(async()=>{try{s("quadrado","ativo"),i("Montando o quadrado (a V1 inteira leva um tempo)...");let d=await Di();s("quadrado pronto","ok"),i(...d.linhas,"","Pronto. Confira no Program e ajuste o que precisar.")}catch(d){c(d)}})()}),e("asDiag").addEventListener("click",()=>{(async()=>{try{s("diagn\xF3stico","ativo"),i("Rodando diagn\xF3stico..."),i(...await Fi()),s("pronto","ok")}catch(d){c(d)}})()})}var ru="http://127.0.0.1:47800",Us=500,mt=(o,e)=>fetch(`${ru}${o}`,{method:"POST",headers:{"Content-Type":"text/plain"},body:JSON.stringify(e)}),Ua=Promise.resolve(),$e=o=>{Ua=Ua.then(()=>mt("/evento",o)).catch(()=>{})};async function iu(o){switch(o.nome){case"lerEstado":return Fo.lerEstado();case"lerEmpresa":return Fo.lerEmpresa();case"trocarEmpresa":return Fo.trocarEmpresa(o.args[0]);case"guardarLog":return Fo.guardarLog(o.args[0]);case"editar":return Fo.editar(o.args[0],(e,a)=>$e({tipo:"registro",texto:e,tom:a??"passo"}),e=>$e({tipo:"progresso",texto:e}),{etapa:(e,a,n)=>$e({tipo:"etapa",id:e,estado:a,resumo:n}),variacoes:e=>$e({tipo:"variacoes",lista:e}),alvo:e=>$e({tipo:"alvo",indices:e})});case"pausas:ler":return So.ler();case"pausas:previa":return So.previa(o.args[0]);case"pausas:cortar":return So.cortar(o.args[0],e=>$e({tipo:"progresso",texto:e}));case"pausas:desfazer":return So.desfazer();case"pausas:preparar":return So.preparar();case"pausas:guardarLog":return So.guardarLog(o.args[0]);default:throw new Error(`pedido desconhecido: ${o.nome}`)}}function su(o){iu(o).then(e=>({id:o.id,ok:!0,valor:e??null})).catch(e=>({id:o.id,ok:!1,erro:e?.message??String(e)})).then(e=>Ua=Ua.then(()=>mt("/resposta",e)).catch(()=>{}))}function Hs(){let o=ro("premierepro"),e=(s,c)=>I(s,c,2e3),a=0,n="",t=async()=>{let s=await e("projeto",o.Project.getActiveProject()),c=s?await e("sequ\xEAncia",s.getActiveSequence()):null,l=c?await e("cursor",c.getPlayerPosition()):null,m=c?await e("sele\xE7\xE3o",c.getSelection()):null,d=m?await e("itens",m.getTrackItems()):[];return{projeto:s?.name??null,sequencia:c?.name??null,cursorS:l?.seconds??null,selecionados:d.length,quando:Date.now()}},r=null,i=async()=>{try{r=a>0&&r?{...r,quando:Date.now()}:await t();let c=await(await mt("/premiere",r)).json().catch(()=>({}));for(let l of c.pedidos??[])su(l);a=0}catch(s){a++;let c=`${s?.name??"Erro"}: ${s?.message??String(s)}`;c!==n&&(n=c,F("ponte-log.json",{quando:new Date().toISOString(),erro:c}).catch(()=>{}))}setTimeout(()=>void i(),a===0?Us:Math.min(5e3,Us*2**a))};setTimeout(()=>void i(),1e3)}var Gs=`<header class="topo">\r
  <span id="marcaTopo" class="marca-simbolo" aria-hidden="true"></span>\r
  <span class="marca-nome">Cutline</span>\r
  <span class="topo-sub">AndroClinic \xB7 GrandCare \xB7 Menopausa</span>\r
</header>\r
\r
<main class="conteudo">\r
  <!-- O Editar e o botao do dia a dia: card grande no alto, com as etapas em\r
       bolinhas e a timeline nas cores da tela dele. As ferramentas avulsas vem\r
       embaixo, na ordem da edicao.\r
\r
       data-trilhas: miniatura da timeline, desenhada por desenharTrilhas()\r
       em shell.ts. # = o que a ferramenta cria ou ajusta, = = o que ja estava\r
       na sequencia, - = vazio. A cor vem da faixa (data-faixa) ou do card. -->\r
  <div id="cardEditar" class="heroi" role="button" tabindex="0" aria-label="Abrir AutoEdit">\r
    <span class="heroi-cima">\r
      <span class="heroi-nome">AutoEdit</span>\r
      <span class="heroi-cta">Abrir</span>\r
    </span>\r
    <span class="heroi-desc">Um clique na sequ\xEAncia aberta faz a edi\xE7\xE3o inteira, em todas as varia\xE7\xF5es. A fala \xE9 transcrita uma vez s\xF3.</span>\r
    <span class="bolas">\r
      <span class="bola-item"><span class="bola" data-icone="pausas" style="background-color: #4ecb8d"></span><span class="bola-nome">Pausas</span></span>\r
      <span class="bola-item"><span class="bola" data-icone="broll" style="background-color: #8d82f5"></span><span class="bola-nome">B-roll</span></span>\r
      <span class="bola-item"><span class="bola" data-icone="split" style="background-color: #67c7e2"></span><span class="bola-nome">Split</span></span>\r
      <span class="bola-item"><span class="bola" data-icone="leak" style="background-color: #eeab4c"></span><span class="bola-nome">Leak</span></span>\r
      <span class="bola-item"><span class="bola" data-icone="trilha" style="background-color: #4fc3a1"></span><span class="bola-nome">Trilha</span></span>\r
      <span class="bola-item"><span class="bola" data-icone="legendas" style="background-color: #eceef2"></span><span class="bola-nome">Legendas</span></span>\r
    </span>\r
    <span class="mapa mapa-heroi" aria-hidden="true"\r
      data-trilhas="C2 -------------##---------|C1 ##-###-##-####-##-###-##|V3 -#--#----#---#----#--#--|V2 --###-----###----###----|V1 ========================|A2 ########################"></span>\r
  </div>\r
\r
  <p class="grupo-nome">Ferramentas avulsas</p>\r
\r
  <div id="cardPausas" class="card card-pausas" role="button" tabindex="0" aria-label="Abrir SilenceCut">\r
    <span class="card-ico" data-icone="pausas" style="background-color: #4ecb8d"></span>\r
    <span class="card-texto">\r
      <span class="card-nome">SilenceCut</span>\r
      <span class="card-desc">Tira as pausas e os respiros da grava\xE7\xE3o bruta, sempre com a mesma margem.</span>\r
    </span>\r
    <span class="mapa" aria-hidden="true"\r
      data-trilhas="V1 ###-###-##-####-###-##|A1 ###-###-##-####-###-##"></span>\r
  </div>\r
\r
  <div id="cardBroll" class="card card-broll" role="button" tabindex="0" aria-label="Abrir B-Roller">\r
    <span class="card-ico" data-icone="broll" style="background-color: #8d82f5"></span>\r
    <span class="card-texto">\r
      <span class="card-nome">B-Roller</span>\r
      <span class="card-desc">Coloca B-rolls da biblioteca onde a fala pede e aprende com o que voc\xEA mant\xE9m.</span>\r
    </span>\r
    <span class="mapa" aria-hidden="true"\r
      data-trilhas="V2 --###-----##----###---|V1 ======================|A3 --###-----##----###---"></span>\r
  </div>\r
\r
  <div id="cardCaptions" class="card card-captions" role="button" tabindex="0" aria-label="Abrir Captions">\r
    <span class="card-ico" data-icone="legendas" style="background-color: #eceef2"></span>\r
    <span class="card-texto">\r
      <span class="card-nome">Captions</span>\r
      <span class="card-desc">Gera as legendas a partir da fala, com os pre\xE7os numa faixa separada.</span>\r
    </span>\r
    <span class="mapa" aria-hidden="true"\r
      data-trilhas="C2 -------##------##-----|C1 ##-###-##-####-##-###-|V1 ======================"></span>\r
  </div>\r
\r
  <div id="cardAutosplit" class="card card-autosplit" role="button" tabindex="0" aria-label="Abrir SplitScreen">\r
    <span class="card-ico" data-icone="split" style="background-color: #67c7e2"></span>\r
    <span class="card-texto">\r
      <span class="card-nome">SplitScreen</span>\r
      <span class="card-desc">Fecha a edi\xE7\xE3o com a tela dividida, cada B-roll enquadrado na sua metade. Tamb\xE9m faz o quadrado 1:1.</span>\r
    </span>\r
    <span class="mapa" aria-hidden="true"\r
      data-trilhas="V2 --###-----##----###---|V1 ======================"></span>\r
  </div>\r
\r
  <p class="grupo-nome">Podcast</p>\r
\r
  <div id="cardAutocut" class="card card-autocut" role="button" tabindex="0" aria-label="Abrir PodCut">\r
    <span class="card-ico" data-icone="podcast" style="background-color: #4fc3a1"></span>\r
    <span class="card-texto">\r
      <span class="card-nome">PodCut</span>\r
      <span class="card-desc">Corta pela voz, trocando para a c\xE2mera e o microfone de quem est\xE1 falando.</span>\r
    </span>\r
    <span class="mapa" aria-hidden="true"\r
      data-trilhas="V2 #####-----###----#####|V1 -----#####---####-----|A2 #####-----###----#####|A1 -----#####---####-----"></span>\r
  </div>\r
\r
  <p class="hall-nota">\r
    As miniaturas mostram o que cada ferramenta faz na sequ\xEAncia: em cinza o que j\xE1 est\xE1 nela, em cor o que ela coloca.\r
  </p>\r
</main>\r
`;var Js=`/*\r
 * ============================================================================\r
 * FAMILIA PRO EDITION \u2014 folha de componentes da tela de selecao (o hall)\r
 * ============================================================================\r
 *\r
 * Restricoes do UXP que ditam TODA a estrutura abaixo (lista completa em\r
 * ferramentas/auto-broll/docs/UXP_ARMADILHAS.md):\r
 *\r
 *  - \`display: grid\` e IGNORADO. Layout inteiro em flexbox.\r
 *  - \`gap\` e \`var()\` NAO sao confiaveis. Tokens sao um bloco documentado com\r
 *    valores literais; espacamento sai de margin, nunca de gap.\r
 *  - Media query nao e confiavel, e este painel nunca roda em telefone. A\r
 *    responsividade real e a largura do painel acoplado no Premiere: os cards\r
 *    ficam lado a lado com \`flex-wrap\` + \`flex: 1 1 250px\` e empilham sozinhos\r
 *    quando o painel estreita.\r
 *  - Num flex column os filhos NAO esticam. \`align-items: stretch\` explicito.\r
 *\r
 *  - **\`<button>\` nativo e renderizado como controle do host.** Ele ignora o\r
 *    CSS do proprio elemento e achata os filhos numa linha so \u2014 foi\r
 *    exatamente por isso que estes cards apareciam como pilulas cinzas de\r
 *    texto centralizado, apesar do CSS correto no disco. Card e alternador\r
 *    agora sao \`div[role="button"][tabindex="0"]\`, com Enter/Espaco ligados na\r
 *    mao em main.ts.\r
 *\r
 * ---------------------------------------------------------------- TOKENS ---\r
 * Mesma tabela nos tres plugins da familia. Repetida de proposito em cada\r
 * folha: sao repos independentes que precisam construir sozinhos, e var() nao\r
 * funciona aqui.\r
 *\r
 *   SUPERFICIE\r
 *     bg-0        #0d0f13   fundo do painel (quase preto)\r
 *     bg-1        #14171d   superficie: secoes e cards\r
 *     bg-2        #1a1e26   superficie elevada: topo, chips\r
 *     bg-3        #202631   hover de superficie clicavel\r
 *     line        #232830   borda sutil (padrao)\r
 *     line-2      #333b47   borda em hover\r
 *\r
 *   TEXTO\r
 *     txt         #eceef2   conteudo principal\r
 *     txt-2       #9098a6   secundario, rotulos\r
 *     txt-3       #5f6774   apagado: dica, nota de rodape\r
 *\r
 *   SEMANTICA\r
 *     azul        #3b82f6   foco\r
 *     verde       #4ecb8d   sucesso\r
 *     ambar       #eeab4c   acento do Pro Captions\r
 *     vermelho    #ff7d71   erro\r
 *     violeta     #8d82f5   acento do Auto B-roll\r
 *\r
 *   FORMA\r
 *     raio-lg     10px \xB7 raio-md 8px \xB7 raio-full 999px \xB7 transicao 150ms\r
 *\r
 * Desde 01/10 o hall segue a tela do Editar: o Editar em destaque (borda\r
 * azul, etapas em bolinhas, timeline nas cores dele) e cada ferramenta com a\r
 * cor da bolinha dela no Editar.\r
 * ============================================================================\r
 */\r
\r
html,\r
body {\r
  height: 100%;\r
}\r
\r
body {\r
  display: flex;\r
  flex-direction: column;\r
  margin: 0;\r
  padding: 0;\r
  background-color: #0d0f13;\r
  color: #eceef2;\r
  font-family: Inter, adobe-clean, "Source Sans 3", "Segoe UI", sans-serif;\r
  font-size: 13px;\r
  line-height: 1.45;\r
  overflow: hidden;\r
  text-align: left;\r
}\r
\r
/* =============================================================== HEADER === */\r
\r
/* Mesmo topo da tela do Editar (layout escolhido pelo Leo em 01/10). */\r
.topo {\r
  display: flex;\r
  flex-direction: row;\r
  align-items: center;\r
  flex: none;\r
  padding: 10px 14px;\r
  background-color: #1a1e26;\r
  border-bottom: 1px solid #232830;\r
}\r
\r
.marca-simbolo {\r
  display: flex;\r
  flex: none;\r
  margin-right: 8px;\r
}\r
\r
.marca-nome {\r
  flex: none;\r
  font-size: 15px;\r
  font-weight: 700;\r
  letter-spacing: -0.01em;\r
  color: #ffffff;\r
  white-space: nowrap;\r
}\r
\r
.topo-sub {\r
  flex: 1 1 auto;\r
  min-width: 0;\r
  margin-left: 10px;\r
  font-size: 11px;\r
  color: #5f6774;\r
  text-align: right;\r
  white-space: nowrap;\r
  overflow: hidden;\r
  text-overflow: ellipsis;\r
}\r
\r
/* ================================================================ CORPO === */\r
\r
.conteudo {\r
  display: flex;\r
  flex-direction: column;\r
  align-items: stretch;\r
  flex: 1 1 auto;\r
  min-height: 0;\r
  overflow-y: auto;\r
  overflow-x: hidden;\r
  padding: 12px;\r
}\r
\r
/* \`flex: none\` em todo filho direto de \`.conteudo\`: e um flex column de altura\r
   definida, e sem isto o filho encolhe em vez de deixar \`.conteudo\` rolar. */\r
.heroi,\r
.card,\r
.grupo-nome,\r
.hall-nota {\r
  flex: none;\r
}\r
\r
.grupo-nome {\r
  margin: 14px 0 8px 2px;\r
  font-size: 11px;\r
  font-weight: 600;\r
  letter-spacing: 0.06em;\r
  text-transform: uppercase;\r
  color: #9098a6;\r
}\r
\r
.hall-nota {\r
  margin: 8px 0 0 0;\r
  padding: 12px 2px 0 2px;\r
  border-top: 1px solid #232830;\r
  font-size: 11px;\r
  line-height: 1.55;\r
  color: #5f6774;\r
}\r
\r
/* ============================================================ EDITAR === */\r
\r
.heroi {\r
  display: flex;\r
  flex-direction: column;\r
  align-items: stretch;\r
  padding: 14px;\r
  background-color: #14171d;\r
  border: 1px solid #3b82f6;\r
  border-radius: 12px;\r
  cursor: pointer;\r
  transition: background-color 150ms;\r
}\r
\r
.heroi:hover {\r
  background-color: #1a1e26;\r
}\r
\r
.heroi:focus {\r
  outline: none;\r
  background-color: #1a1e26;\r
}\r
\r
.heroi-cima {\r
  display: flex;\r
  flex-direction: row;\r
  align-items: center;\r
}\r
\r
.heroi-nome {\r
  flex: 1 1 auto;\r
  font-size: 17px;\r
  font-weight: 700;\r
  color: #ffffff;\r
}\r
\r
.heroi-cta {\r
  flex: none;\r
  padding: 4px 16px;\r
  border-radius: 14px;\r
  background-color: #3b82f6;\r
  color: #ffffff;\r
  font-size: 12px;\r
  font-weight: 600;\r
}\r
\r
.heroi-desc {\r
  margin: 6px 0 10px 0;\r
  font-size: 12px;\r
  line-height: 1.5;\r
  color: #9098a6;\r
}\r
\r
.bolas {\r
  display: flex;\r
  flex-direction: row;\r
  margin-bottom: 8px;\r
}\r
\r
.bola-item {\r
  display: flex;\r
  flex-direction: column;\r
  align-items: center;\r
  flex: 1 1 0px;\r
  min-width: 0;\r
}\r
\r
.bola {\r
  display: flex;\r
  flex-direction: row;\r
  align-items: center;\r
  justify-content: center;\r
  width: 26px;\r
  height: 26px;\r
  margin-bottom: 3px;\r
  border-radius: 13px;\r
  font-size: 13px;\r
  color: #0d0f13;\r
}\r
\r
.bola-nome {\r
  font-size: 11px;\r
  color: #9098a6;\r
  white-space: nowrap;\r
}\r
\r
/* ================================================================= CARD === */\r
\r
/* Uma ferramenta por linha: simbolo, texto e miniatura lado a lado quando\r
   cabem; num painel estreito a miniatura desce e ocupa a linha toda. */\r
.card {\r
  display: flex;\r
  flex-direction: row;\r
  flex-wrap: wrap;\r
  align-items: center;\r
  margin-bottom: 6px;\r
  padding: 10px 12px;\r
  background-color: #14171d;\r
  border: 1px solid #232830;\r
  border-radius: 10px;\r
  color: inherit;\r
  cursor: pointer;\r
  transition: background-color 150ms, border-color 150ms;\r
}\r
\r
.card:hover {\r
  background-color: #1a1e26;\r
  border-color: #333b47;\r
}\r
\r
.card:focus {\r
  border-color: #3b82f6;\r
  outline: none;\r
}\r
\r
.card-ico {\r
  display: flex;\r
  flex-direction: row;\r
  align-items: center;\r
  justify-content: center;\r
  flex: none;\r
  width: 30px;\r
  height: 30px;\r
  margin-right: 10px;\r
  border-radius: 15px;\r
  font-size: 14px;\r
  color: #0d0f13;\r
}\r
\r
.card-texto {\r
  display: flex;\r
  flex-direction: column;\r
  align-items: stretch;\r
  flex: 3 1 150px;\r
  min-width: 0;\r
  margin-right: 12px;\r
}\r
\r
.card-nome {\r
  margin-bottom: 2px;\r
  font-size: 14px;\r
  font-weight: 600;\r
  color: #ffffff;\r
  white-space: nowrap;\r
  overflow: hidden;\r
  text-overflow: ellipsis;\r
}\r
\r
.card-desc {\r
  font-size: 12px;\r
  line-height: 1.45;\r
  color: #9098a6;\r
}\r
\r
/* ========================================================== MINIATURA === */\r
\r
.mapa {\r
  display: flex;\r
  flex-direction: column;\r
  align-items: stretch;\r
  flex: 1 0 130px;\r
  margin: 6px 0;\r
}\r
\r
.mapa-heroi {\r
  flex: none;\r
  margin: 0;\r
}\r
\r
.trilha {\r
  display: flex;\r
  flex-direction: row;\r
  align-items: center;\r
  height: 10px;\r
}\r
\r
.mapa-heroi .trilha {\r
  height: 13px;\r
}\r
\r
.trilha-rotulo {\r
  flex: 0 0 20px;\r
  font-size: 10px;\r
  line-height: 10px;\r
  color: #5f6774;\r
}\r
\r
.trilha-faixa {\r
  display: flex;\r
  flex-direction: row;\r
  align-items: stretch;\r
  flex: 1 1 auto;\r
  height: 6px;\r
  background-color: #101318;\r
  border-radius: 2px;\r
  overflow: hidden;\r
}\r
\r
.mapa-heroi .trilha-faixa {\r
  height: 9px;\r
}\r
\r
/* flex-grow vem inline, do tamanho do trecho na notacao. */\r
.seg {\r
  flex: 1 1 0px;\r
  min-width: 0;\r
  border-radius: 1px;\r
}\r
\r
.seg-base {\r
  background-color: #5f6774;\r
}\r
\r
/* Cor de cada ferramenta, a mesma da bolinha dela no Editar. */\r
.card-pausas .seg-novo { background-color: #4ecb8d; }\r
.card-broll .seg-novo { background-color: #8d82f5; }\r
.card-captions .seg-novo { background-color: #eceef2; }\r
.card-autosplit .seg-novo { background-color: #67c7e2; }\r
.card-autocut .seg-novo { background-color: #4fc3a1; }\r
\r
/* Cor da faixa, a mesma da timeline do Editar. */\r
.trilha[data-faixa="C2"] .seg-novo { background-color: #ff7d71; }\r
.heroi .trilha[data-faixa="C1"] .seg-novo { background-color: #eceef2; }\r
.heroi .trilha[data-faixa="V3"] .seg-novo { background-color: #eeab4c; }\r
.heroi .trilha[data-faixa="V2"] .seg-novo { background-color: #8d82f5; }\r
.heroi .trilha[data-faixa="A2"] .seg-novo { background-color: #4fc3a1; }\r
`;var du=`
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
`;function ae(o,e){o.addEventListener("click",e),o.addEventListener("keydown",a=>{let n=a.key;n!=="Enter"&&n!==" "||(a.preventDefault(),e())})}function uu(o){ae(o.querySelector("#cardEditar"),()=>zo("editar")),ae(o.querySelector("#cardPausas"),()=>zo("pausas")),ae(o.querySelector("#cardBroll"),()=>zo("broll")),ae(o.querySelector("#cardCaptions"),()=>zo("captions")),ae(o.querySelector("#cardAutocut"),()=>zo("autocut")),ae(o.querySelector("#cardAutosplit"),()=>zo("autosplit")),o.querySelectorAll("[data-trilhas]").forEach(e=>{e.innerHTML=xt(e.dataset.trilhas??"")}),o.querySelector("#marcaTopo").innerHTML=vt(22),o.querySelectorAll("[data-icone]").forEach(e=>{e.innerHTML=lo(e.dataset.icone,"#0d0f13")})}var mu={seletor:{html:Gs,css:Js,montar:uu},editar:{html:ri,css:`${re}
${dt}`,montar:o=>Mi(o,Fo)},pausas:{html:Os,css:`${re}
${dt}`,montar:o=>zs(o,So)},broll:{html:Wa(yt),css:re,montar:yr},captions:{html:Wa(wr),css:Er,montar:ti},autocut:{html:Ys,css:re,montar:Bs},autosplit:{html:Qs,css:re,montar:_s}};function zo(o){let e=mu[o],a=o==="seletor"?"":'<div id="peVoltar" class="pe-nav" role="button" tabindex="0" aria-label="Voltar para o Cutline"><span class="pe-nav-seta">&larr;</span><span class="pe-nav-raiz">Cutline</span></div>';document.body.innerHTML=`${a}<style>
${du}
${e.css}
</style>
${e.html}`,o!=="seletor"&&ae(document.getElementById("peVoltar"),()=>zo("seletor")),e.montar(document.body)}zo("seletor");Hs();})();
