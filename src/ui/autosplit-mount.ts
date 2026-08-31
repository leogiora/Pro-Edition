/*
 * Painel do Auto Split. So orquestra: le a sequencia, mostra, e chama o
 * adapter. Nenhuma chamada a `premierepro` mora aqui.
 *
 * `root` chega mas nao e usado para escopar busca de elemento: o shell
 * substitui document.body inteiro antes de cada mount(), entao nunca ha duas
 * telas no mesmo documento. Se isso mudar, este arquivo muda junto.
 */

export function mount(root: HTMLElement): void {
  const log = root.querySelector<HTMLPreElement>("#asLog")!;
  log.textContent = "Auto Split — tela no ar. Adapter ainda nao ligado.";
}
