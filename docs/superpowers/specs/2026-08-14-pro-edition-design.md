# Pro Edition — design

Data: 2026-08-14
Status: aprovado em chat, aguardando revisão do spec escrito

## Objetivo

Um plugin UXP novo, **Pro Edition**, com um único painel dockado no Premiere.
Ao abrir, mostra uma tela de seleção (cards) para escolher entre **Auto
B-roll** e **Pro Captions**; escolher troca o conteúdo do mesmo painel para a
ferramenta escolhida, com um caminho de volta para o seletor.

Motivação: hoje `Auto B-roll` e `Pro Captions` são dois plugins separados,
cada um com sua própria entrada em `Window > Extensions`. Um teste ao vivo
(ver seção "Provas") confirmou que agrupar sob um manifest só junta as duas
em uma entrada com submenu nativo — mas o usuário quer uma tela de seleção
com UI própria, não o submenu nativo do Windows/Adobe, então isso sozinho não
basta.

## Não-objetivos

- Não funde o código dos dois plugins. Cada um mantém seu repositório, seus
  testes, seu `PluginData`, seu histórico de aprendizado/dados reais.
- Não descontinua os dois plugins originais — continuam instaláveis e
  utilizáveis sozinhos, exatamente como hoje.
- Não migra ou altera nenhum dado já acumulado (ex.: `aprendizado.json` do
  Auto B-roll).

## Provas já coletadas

- **Teste ao vivo (2026-08-14, Premiere 25):** um manifest com dois
  `entrypoints` do tipo `panel` aparece em `Window > Extensions > UXP
  Plugins` como **uma entrada com submenu**, não duas soltas — confirmado por
  print real (`teste-dois-paineis`, descartável, symlink em
  `...UXP\Plugins\External\com.leogi.testedoispaineis`). Relevante para
  descartar a hipótese de que só o manifest resolveria o pedido do usuário.
- **UDT (UXP Developer Tool) não conecta nesse ambiente** — já documentado em
  `auto-broll-premiere/docs/UXP_ARMADILHAS.md` §7 antes deste projeto, e
  reproduzido de novo durante o teste acima ("No applications are connected
  to the service"). O caminho que funciona é sempre symlink +
  `developer: true` em
  `C:\Program Files\Common Files\Adobe\UXP\Developer\settings.json` + restart
  do Premiere. **Pro Edition usa esse mesmo caminho de instalação, não o
  UDT.**
- **Ícones com `scale: [1, 2]` exigem `icon@1x.png` e `icon@2x.png` no
  manifest**, não só `icon.png` — confirmado nesta sessão ao reproduzir o
  erro de load com um manifest que só tinha `icon.png`.
- **Colisão real de `id` entre os dois HTMLs**, lida direto dos arquivos
  fonte: `estado`, `log` e `seqNome` existem nos dois
  (`auto-broll-premiere/src/ui/index.html` e
  `Pro-Captions/src/ui/index.html`). Se as duas telas estiverem no `document`
  ao mesmo tempo, `document.getElementById` vira ambíguo — pega o que
  aparecer primeiro na ordem do DOM, não necessariamente o certo. Isso decide
  o contrato de montagem da seção abaixo.
- **Sobreposição grande de nomes de classe CSS** entre os dois
  `styles.css` (`.acao`, `.canaleta`, `.cod`, `.conteudo`, `.corpo`,
  `.estado`, `.faixa`, `.log`, `.marca`, `.marca-fase`, `.marca-nome`,
  `.seq-nome`, `.topo`) — esperado, o Pro Captions reaproveitou o esqueleto
  visual do Auto B-roll de propósito. Não é bug, mas reforça que as duas
  folhas de estilo não podem conviver soltas no mesmo documento sem uma
  delas vencer a outra por ordem de carregamento — ver contrato abaixo.

## Arquitetura

### Layout de repositórios

Três pastas irmãs em `Desktop`, cada uma seu próprio repositório Git,
instaladas por symlink (padrão já usado pelos dois existentes):

```
Desktop/
  auto-broll-premiere/   (inalterado no domínio, pequeno ajuste de UI — ver abaixo)
  Pro-Captions/          (inalterado no domínio, pequeno ajuste de UI — ver abaixo)
  Pro-Edition/           (novo)
```

`Pro-Edition` não depende de workspace/monorepo nem de dependência nova: o
bundler (`esbuild`, já usado nos dois outros) resolve imports por caminho
relativo entre pastas irmãs sem configuração extra.

### Contrato `mount()` nos dois plugins existentes

Cada um dos dois plugins ganha uma função exportada, comportamento
preservado 1:1 com o que já roda hoje standalone:

```ts
// auto-broll-premiere/src/ui/mount.ts (novo, pequeno)
export function mount(root: HTMLElement): void { ... }
```

- **Auto B-roll:** já tem uma função `iniciar()` bem isolada no fim do
  `main.ts` (chamada de forma síncrona, botões ligados antes de qualquer
  `await`). Vira `export function mount(root: HTMLElement): void`, recebe o
  HTML+CSS do painel injetados em `root` antes de rodar. `main.ts` (uso
  standalone) passa a só chamar `mount(document.body)`.
- **Pro Captions:** hoje não tem uma função equivalente — o boot é código
  solto no topo do módulo. Vira o mesmo formato: o código solto entra dentro
  de `export function mount(root: HTMLElement): void`, `main.ts` standalone
  chama `mount(document.body)` no fim.
- Em ambos, `el()`/`elemento()` (que usam `document.getElementById`)
  **não mudam de implementação** — IDs continuam globais no documento. A
  segurança contra a colisão documentada acima vem do contrato de troca no
  shell, não de escopar o `getElementById`.

Mudança mecânica, sem alterar lógica de domínio (`aprendizado.ts`,
`plano.ts`, `segmentar.ts`, etc. — nenhum desses arquivos muda).

### Contrato de troca de view no shell

Para nunca ter as duas telas no `document` ao mesmo tempo (evita a colisão
de IDs e a de CSS):

```ts
function mostrar(ferramenta: "seletor" | "broll" | "captions"): void {
  painel.innerHTML = "";              // limpa DOM + <style> anterior junto
  switch (ferramenta) {
    case "seletor":  montarSeletor(painel); break;
    case "broll":    montarComEstilo(painel, htmlBroll, cssBroll, mountBroll); break;
    case "captions": montarComEstilo(painel, htmlCaptions, cssCaptions, mountCaptions); break;
  }
}
```

Cada mudança de tela **substitui** o conteúdo do painel inteiro (HTML + tag
`<style>` própria), nunca acumula. Não há polling/`setInterval` em nenhum
dos dois plugins (confirmado por busca no código), então não existe timer
órfão para limpar ao trocar de tela — só o DOM.

### Tela de seleção

Dois cards (ícone + nome + descrição de uma linha) — "Auto B-roll" e "Pro
Captions" — layout flexbox (sem CSS Grid, armadilha já documentada em
`UXP_ARMADILHAS.md`). Reaproveita as classes visuais já existentes
(`.acao`, `.topo`, `.corpo`) já que os três plugins compartilham o mesmo
esqueleto visual — sem inventar um sistema novo. Cada tela de ferramenta
ganha um botão "← voltar" que chama `mostrar("seletor")`.

### Manifest e instalação

```jsonc
{
  "id": "com.leogi.proedition",
  "name": "Pro Edition",
  "entrypoints": [
    { "type": "panel", "id": "proEditionPanel", "label": { "default": "Pro Edition" } }
  ]
}
```

Um `entrypoint` só (não dois) — a troca de ferramenta acontece **dentro**
do painel, não via submenu nativo. `minVersion: 25.0.0` (mesmo piso dos
outros dois, já provado ao vivo no 25 pelo Auto B-roll). Instalação por
`scripts/install-link.ps1` idêntico ao padrão existente, symlink em
`...UXP\Plugins\External\com.leogi.proedition`.

### Dados e aprendizado

Cada plugin original continua lendo/escrevendo seu próprio `PluginData`
(`%APPDATA%\...\PPRO\<versão>\External\com.leogi.autobroll\...` e
`com.leogi.procaptions\...`) — esses caminhos vêm do `id` de cada plugin
original no manifest dele, que não muda. O `Pro Edition` tem seu próprio
`id`/`PluginData`, essencialmente vazio (não guarda nada hoje). **Nenhuma
migração necessária**, o aprendizado real do Auto B-roll continua intacto e
funcionando do mesmo jeito, seja aberto pelo plugin original ou pelo shell.

## Testes

- `Pro-Edition` ganha sua própria suíte pequena (mesmo padrão `node --test`
  dos outros dois): a função `mostrar()`/troca de view é pura o bastante
  para testar sem Premiere — dado um estado, qual tela deveria estar
  montada. Não precisa de framework novo.
- As suítes existentes de `auto-broll-premiere` (229 testes) e
  `Pro-Captions` não mudam de escopo — o refactor `iniciar()`→`mount()` é
  mecânico; testes de domínio já cobrem a lógica que não muda.
- **Teste ao vivo obrigatório antes de considerar pronto** (sem hot reload,
  já é o padrão dos outros dois): abrir os dois pelo seletor do shell e
  confirmar que cada um funciona igual ao abrir standalone — nenhum dos
  dois foi testado nesse modo "montado por fora" ainda.

## Riscos / perguntas em aberto

- As duas folhas de estilo (`styles.css`) têm regras com o mesmo nome de
  classe — se divergirem em algum detalhe (ex.: um `.log` com padding
  diferente do outro), o contrato de "substituir, nunca acumular" evita
  conflito, mas vale um diff rápido das duas folhas durante a implementação
  pra confirmar que não há surpresa visual entre trocar de ferramenta.
- Pro Captions ainda não foi testado ao vivo standalone no Premiere 25 (nota
  já existente antes deste projeto). Isso é um risco pré-existente, não
  criado por este desenho — mas o teste ao vivo do shell (seção Testes) vai
  expor isso também, já que passa pelas duas ferramentas.
