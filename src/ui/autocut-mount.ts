/*
 * Painel do Podcast AutoCut. So orquestra: le a sequencia, mostra, e chama o
 * adapter. Nenhuma chamada a `premierepro` mora aqui.
 */

import {
  CONFIG_NIVEL_PADRAO,
  CONFIG_PADRAO,
  MAPA_PADRAO,
  segmentar,
  type Mapa,
  type Segmento,
} from "../autocut.ts";
import {
  analisarFala,
  analisarNivel,
  aplicar,
  getSequenceInfo,
  lerFps,
  validar,
  type Diagnostico,
} from "../autocut-premiere.ts";

let segmentos: Segmento[] = [];

/** As taxas que aparecem em podcast. Serve de rede quando o Premiere nao conta. */
const FPS_COMUNS = [23.976, 24, 25, 29.97, 30, 50, 59.94, 60];

function preencher(select: HTMLSelectElement, prefixo: string, quantas: number, escolhido: number): void {
  select.innerHTML = "";
  for (let i = 0; i < quantas; i++) {
    const opcao = document.createElement("option");
    opcao.value = String(i);
    opcao.textContent = `${prefixo}${i + 1}`;
    if (i === escolhido) opcao.selected = true;
    select.appendChild(opcao);
  }
}

/**
 * O fps detectado ja vem escolhido. Quando o Premiere nao entrega a taxa, a
 * lista continua util: melhor o usuario apontar do que o plugin chutar 30 e
 * cortar entre quadros sem avisar.
 */
function preencherFps(select: HTMLSelectElement, detectado: number): void {
  select.innerHTML = "";
  if (!(detectado > 0)) {
    const aviso = document.createElement("option");
    aviso.value = "0";
    aviso.textContent = "escolha";
    aviso.selected = true;
    select.appendChild(aviso);
  }
  const lista = detectado > 0 && !FPS_COMUNS.some((f) => Math.abs(f - detectado) < 0.01)
    ? [...FPS_COMUNS, detectado].sort((a, b) => a - b)
    : FPS_COMUNS;

  for (const f of lista) {
    const opcao = document.createElement("option");
    opcao.value = String(f);
    opcao.textContent = f.toFixed(3).replace(/\.?0+$/, "");
    if (Math.abs(f - detectado) < 0.01) opcao.selected = true;
    select.appendChild(opcao);
  }
}

/** mm:ss — o preview de um podcast de 1h fica ilegivel em segundos corridos. */
function relogio(segundos: number): string {
  const m = Math.floor(segundos / 60);
  const s = Math.floor(segundos % 60);
  return `${String(m).padStart(2, "0")}:${String(s).padStart(2, "0")}`;
}

function ligarAcao(node: HTMLElement, acao: () => void): void {
  node.addEventListener("click", acao);
  node.addEventListener("keydown", (evento) => {
    const tecla = (evento as KeyboardEvent).key;
    if (tecla !== "Enter" && tecla !== " ") return;
    evento.preventDefault();
    acao();
  });
}

export function mount(root: HTMLElement): void {
  const pega = <T extends HTMLElement>(id: string) => root.querySelector<T>(`#${id}`)!;
  const log = pega<HTMLPreElement>("acLog");
  const aplicarBotao = pega("acAplicar");
  const wav = pega<HTMLInputElement>("acWav");
  const selects = {
    fps: pega<HTMLSelectElement>("acFps"),
    canalA: pega<HTMLSelectElement>("acCanalA"),
    canalB: pega<HTMLSelectElement>("acCanalB"),
    videoA: pega<HTMLSelectElement>("acVideoA"),
    audioA: pega<HTMLSelectElement>("acAudioA"),
    videoB: pega<HTMLSelectElement>("acVideoB"),
    audioB: pega<HTMLSelectElement>("acAudioB"),
  };

  const escrever = (...linhas: readonly string[]) => {
    log.textContent = linhas.join("\n");
  };
  const liberar = (pode: boolean) => aplicarBotao.setAttribute("aria-disabled", pode ? "false" : "true");
  const mapa = (): Mapa => ({
    videoA: Number(selects.videoA.value),
    audioA: Number(selects.audioA.value),
    videoB: Number(selects.videoB.value),
    audioB: Number(selects.audioB.value),
  });

  // Falha aqui nao pode deixar a tela em branco: o usuario precisa ver o motivo.
  const mostrarErro = (e: unknown) => {
    liberar(false);
    escrever(`Erro: ${(e as Error)?.message ?? String(e)}`);
  };

  /**
   * Le a sequencia e reflete o que achou nos seletores.
   *
   * Roda na abertura E a cada ANALISAR: trocar de sequencia no Premiere sem
   * fechar o painel deixava os seletores mostrando a sequencia antiga, e o fps
   * errado e o unico jeito de o corte sair do quadro.
   */
  const sincronizar = async (): Promise<string[]> => {
    const info = await getSequenceInfo();
    const f = await lerFps();
    preencherFps(selects.fps, f.valor);
    // 8 canais cobre qualquer gravador de podcast; canal inexistente vira erro
    // com nome na analise, que e mais barato que ler o WAV so para contar.
    preencher(selects.canalA, "Canal ", 8, 0);
    preencher(selects.canalB, "Canal ", 8, 1);
    preencher(selects.videoA, "V", info.videoTracks, MAPA_PADRAO.videoA);
    preencher(selects.audioA, "A", info.audioTracks, MAPA_PADRAO.audioA);
    preencher(selects.videoB, "V", info.videoTracks, MAPA_PADRAO.videoB);
    preencher(selects.audioB, "A", info.audioTracks, MAPA_PADRAO.audioB);
    return [
      `${info.name} — ${info.videoTracks}V / ${info.audioTracks}A`,
      f.valor > 0
        ? `${f.valor.toFixed(3)} fps detectados (${f.origem})`
        : `Premiere nao entregou a taxa de quadros — escolha acima. ${f.origem}`,
    ];
  };

  void (async () => {
    try {
      escrever(...(await sincronizar()));
    } catch (e) {
      mostrarErro(e);
    }
  })();

  ligarAcao(pega("acAnalisar"), () => {
    void (async () => {
      try {
        liberar(false);
        escrever("Analisando...");
        const cabecalho = await sincronizar();
        const fps = Number(selects.fps.value);
        if (!(fps > 0)) throw new Error("Escolha a taxa de quadros da sequencia antes de analisar.");

        const caminho = wav.value.trim();
        const fala = caminho
          ? await analisarNivel(
              caminho,
              Number(selects.canalA.value),
              Number(selects.canalB.value),
              CONFIG_PADRAO,
              CONFIG_NIVEL_PADRAO
            )
          : await analisarFala(mapa(), CONFIG_PADRAO);
        segmentos = segmentar(fala.trechos, fps);
        const d: Diagnostico = await validar(mapa(), segmentos, fps);
        liberar(d.ok);
        // Preview inteiro num podcast de 1h seriam centenas de linhas: as
        // primeiras bastam para ver se a deteccao acertou.
        const previa = segmentos.slice(0, 40).map((s) => `${relogio(s.inicioF / fps)}  ${s.speaker}`);
        if (segmentos.length > previa.length) previa.push(`... e mais ${segmentos.length - previa.length} planos`);

        escrever(
          ...cabecalho,
          "",
          ...fala.linhas,
          "",
          ...d.linhas,
          "",
          ...previa,
          "",
          d.ok ? "Pronto para aplicar." : "Corrija os pontos acima antes de aplicar."
        );
      } catch (e) {
        mostrarErro(e);
      }
    })();
  });

  ligarAcao(aplicarBotao, () => {
    if (aplicarBotao.getAttribute("aria-disabled") === "true") return;
    void (async () => {
      try {
        liberar(false);
        escrever("Aplicando...");
        const d = await aplicar(mapa(), segmentos, Number(selects.fps.value));
        escrever(...d.linhas, "", d.ok ? "AutoCut aplicado." : "Aplicado COM PROBLEMA — desfaca e me mostre o log.");
      } catch (e) {
        mostrarErro(e);
      }
    })();
  });
}
