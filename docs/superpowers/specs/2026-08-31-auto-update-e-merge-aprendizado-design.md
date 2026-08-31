# Pro Edition — auto-update e merge de aprendizado

Data: 2026-08-31
Status: aprovado em chat, aguardando revisão do spec escrito

## Objetivo

Duas coisas acopladas num fluxo só, do ponto de vista de quem usa:

1. **Cada máquina descobre sozinha que tem versão nova** do Pro Edition e a
   pessoa atualiza com um clique — sem `git`, sem Node, sem depender de aviso
   manual.
2. **A atualização também traz o aprendizado que o dono ensina.** A máquina da
   editora mantém tudo que já aprendeu por conta própria e recebe, por cima,
   o que o dono ensinou desde a última vez — somando de verdade, sem contar
   em dobro o que já veio antes.

Motivação: hoje instalar/atualizar numa segunda máquina é o passo manual
documentado em `instalar/INSTALAR.md` (`git pull` + copiar `dist` + rodar o
instalador). E o aprendizado de cada máquina fica isolado para sempre — a
editora nunca recebe o que o dono ensina no dia a dia.

## Não-objetivos

- **Não é sincronia de mão dupla.** O aprendizado só flui dono → editoras.
  O que a editora ensina fica na máquina dela (não é apagado, mas não volta
  para o dono).
- **Não mexe em `vistos`, `pendentes.json`, `config.json`, `frases.json`.**
  São estado de sessão / máquina. `vistos` em especial já causou o bug de
  "recreditar colocação manual" quando copiado entre máquinas
  (`auto-broll-premiere`, nota de 2026-08-26).
- **Não assina o plugin na Adobe, não empacota `.ccx`.** Cada máquina ainda
  precisa, uma vez, ativar "plugins de desenvolvedor" nas preferências do
  Premiere. Isso está fora de escopo.
- **Não roda nada em segundo plano.** Sem tarefa agendada, sem serviço. A
  checagem de versão acontece só quando o painel abre.
- **Não tem tela de merge.** Roda silencioso, com backup e uma linha no log.
- **Não fecha nem reabre o Premiere sozinho.** O script avisa; a pessoa
  reinicia.

## Decisões travadas (chat)

| Tema | Decisão |
|---|---|
| Como avisar | Selo dentro do painel (opção "C1"): o plugin faz `fetch` de um arquivo de versão e mostra uma faixa se houver versão nova. |
| Rede no plugin | Passa a pedir permissão de rede, escopo mínimo: só o host `raw.githubusercontent.com`, só leitura de um número de versão. Offline → selo não aparece, plugin funciona igual. |
| Algoritmo do merge | Baseline-delta: `novo = canônico_atual + (local − baseline)`. |
| Onde roda o merge | Dentro do plugin, no mount (motor JS do UXP) — sem runtime externo, idêntico em Windows e macOS, testável com `node --test`. |
| O que vai no snapshot canônico | Só aprendizado: `pares` + `arquivos` de `aprendizado.json`, `pares` de `ligacoes.json`, `sinonimos.json` inteiro. **Sem `vistos`.** |
| Distribuição | Opção A: repo de código segue privado; um repo público novo `Pro-Edition-dist` recebe só o build + `VERSION` + `aprendizado-canonico.json`. |
| Direção | Mão única, dono → editoras. |

## Arquitetura

Quatro peças. Uma nova no plugin, um script novo de release, dois scripts de
atualização, um repo público novo.

```
  [ máquina do dono ]                          [ Pro-Edition-dist  (público) ]
  npm run release                               dist/  manifest.json  icons/
    ├─ npm run verify                            VERSION
    ├─ gera aprendizado-canonico.json  ───────►  aprendizado-canonico.json
    ├─ bump version + escreve VERSION
    └─ commit + push  ──────────────────────────►

  [ máquina da editora ]
  painel abre ──► fetch VERSION ──► faixa "atualização disponível" (se maior)
  pessoa clica em Atualizar(.ps1 / -mac.command)
    ├─ baixa tarball do Pro-Edition-dist  (curl + tar, nativo)
    ├─ copia dist/ manifest.json icons/  ──► pasta do plugin instalado
    └─ copia aprendizado-canonico.json   ──► PPRO/*/External/com.leogi.proedition/PluginData/
  pessoa reinicia o Premiere
  painel abre ──► mesclarCanonico() ──► aprendizado.json / ligacoes.json / sinonimos.json
                                        atualizados; aprendizado-canonico.base.json gravado
```

### Peça 1 — selo de versão no painel

**Onde:** `Pro-Edition/src/ui/main.ts` (boot do shell), na montagem do
seletor.

- `manifest.json` ganha:
  - `version` que sobe a cada release (hoje `0.1.0`).
  - `requiredPermissions.network` com o host de leitura da versão. Sintaxe
    exata do manifest v5 a confirmar num spike (ver "Riscos e spikes").
- No boot, `fetch("https://raw.githubusercontent.com/leogiora/Pro-Edition-dist/main/VERSION")`,
  com timeout curto (~3 s) e `catch` que engole tudo.
- Compara com a versão que está rodando. Essa versão entra no bundle como
  constante em tempo de build: `scripts/build.mjs` lê `manifest.json` e passa
  `define: { __VERSION__: JSON.stringify(version) }` para o esbuild. Sem
  leitura de arquivo em runtime. Comparação numérica por segmento
  (`0.2.0` > `0.1.0`); sem sufixo de pré-release.
- Se a remota for maior: injeta uma faixa no topo do seletor —
  *"Atualização disponível (X). Rode o Atualizar e reinicie o Premiere."*
- Se o `fetch` falhar (offline, host fora, JSON estranho): nada. Painel
  normal.

A faixa é **informativa**. O painel UXP não roda `git`/script; quem atualiza
é o script externo.

### Peça 2 — `npm run release` (máquina do dono)

**Onde:** `Pro-Edition/scripts/release.mjs`, novo. `package.json` ganha
`"release": "node scripts/release.mjs"`.

Passos:

1. `npm run verify` (types + testes + build dos três repos). Aborta se
   quebrar.
2. Lê o `PluginData` **ao vivo** do dono. A pasta certa é a do Premiere mais
   recente presente em
   `%APPDATA%\Adobe\UXP\PluginsStorage\PPRO\<v>\External\com.leogi.proedition\PluginData\`
   (Windows) — o script pega a maior `<v>`.
3. Monta `aprendizado-canonico.json`:
   ```json
   {
     "schema": 1,
     "version": "<nova>",
     "aprendizado": { "pares": {...}, "arquivos": {...} },
     "ligacoes":    { "pares": {...} },
     "sinonimos":   { ...arquivo inteiro... }
   }
   ```
   **Descarta** `vistos`, `pendentes.json`, `config.json`, `frases.json`,
   `intensidade.json`, backups.
4. Bump da `version` no `manifest.json`; escreve `VERSION` (só o número, com
   `\n`).
5. Copia `dist/`, `manifest.json`, `icons/`, `VERSION`,
   `aprendizado-canonico.json` para o clone local de `Pro-Edition-dist`;
   `git add -A && git commit -m "release <versão>" && git push`.

O caminho do clone de `Pro-Edition-dist` fica em `package.json` ou num
`.release.json` fora do controle de versão (é máquina do dono, caminho
local).

### Peça 3 — scripts `Atualizar` (máquina da editora)

**Onde:** `Pro-Edition/instalar/Atualizar.ps1` e
`Pro-Edition/instalar/Atualizar-mac.command`, novos. Absorvem o que os
`INSTALAR.*` atuais fazem (primeira instalação = mesmo fluxo, só detecta que
o plugin ainda não existe).

Fluxo idêntico nos dois SO:

1. `curl -L` de
   `https://github.com/leogiora/Pro-Edition-dist/archive/refs/heads/main.tar.gz`
   para um temp; extrai com `tar -xzf` (ambos nativos: `curl.exe` e `tar.exe`
   existem no Windows 10 1803+ e no macOS).
2. Copia `dist/`, `manifest.json`, `icons/` por cima do plugin instalado:
   - Windows: `C:\Program Files\Common Files\Adobe\UXP\Plugins\External\com.leogi.proedition`
     — precisa de elevação; o `.ps1` se auto-eleva (`Start-Process -Verb
     RunAs`) se não estiver como admin.
   - macOS: `~/Library/Application Support/Adobe/UXP/Plugins/External/com.leogi.proedition`
     — sem `sudo`.
3. Copia `aprendizado-canonico.json` do tarball para **cada**
   `.../PluginStorage/PPRO/*/External/com.leogi.proedition/PluginData/`
   presente (cria `PluginData` se faltar). Se nenhuma existir: avisa para
   abrir e fechar o Premiere uma vez e rodar de novo.
4. Imprime *"Pronto. Reinicie o Premiere."*

Sem `git`, sem Node, sem dependência instalável. `.gitattributes` fixa
`*.command eol=lf` e `*.sh eol=lf` para o script não quebrar ao passar por
uma máquina Windows; a nota sobre `chmod +x` que já está no `LEIA-ME.txt`
continua valendo.

### Peça 4 — merge no plugin (`mesclarCanonico`)

**Onde:** `auto-broll-premiere/src/mesclar-canonico.ts`, novo — o schema do
aprendizado (`aprendizado.ts`) mora nesse repo, e o Pro Edition já importa
dele. Chamado de `auto-broll-premiere/src/ui/mount.ts`, no começo da
sequência de mount, **antes** de qualquer leitura de `aprendizado.json` pela
análise.

Gatilho: existe `aprendizado-canonico.json` na pasta de dados **e** ele é
diferente de `aprendizado-canonico.base.json` (o baseline gravado da última
vez). Se `aprendizado-canonico.json` não existe (Auto B-roll standalone, ou
máquina que nunca rodou o Atualizar novo): no-op.

Funções puras, testáveis:

```ts
// Saldo = { acertos, erros };  Mapa = Record<string, Saldo>
function mesclarMapa(canonico: Mapa, local: Mapa, base: Mapa): Mapa
```

Para cada chave presente em `canonico` **ou** `local`:

- `delta.acertos = (local[k]?.acertos ?? 0) − (base[k]?.acertos ?? 0)`
  (idem `erros`). Chave sem `base` → `delta = local[k]` inteiro: é o que a
  editora aprendeu sozinha desde o último snapshot.
- `novo = canonico[k] + delta`, com **chão em 0** nos dois lados.
- Aplica a **mesma regra de `TETO = 20`** que `somar()` já usa em
  `aprendizado.ts`: enquanto `acertos + erros > 20`, divide os dois por 2
  (arredondando). Extrair essa regra para uma função reutilizável em
  `aprendizado.ts` e usar nos dois lugares.

Aplicado a:

- `aprendizado.json` → `pares` e `arquivos` (cada um via `mesclarMapa`).
  `vistos` **não é tocado** — fica o da editora, byte a byte.
- `ligacoes.json` → `pares` é `Record<string, number>` (contagem simples):
  `novo = canonico + max(0, local − base)`.
- `sinonimos.json` → união dos grupos; onde os dois têm o mesmo termo-chave,
  **o canônico vence** (o dono é a autoridade do dicionário).

Depois:

- Backup antes de escrever: `aprendizado.json.bak-antes-merge-<data>`,
  `ligacoes.json.bak-antes-merge-<data>` (mesmo padrão dos reparos
  anteriores).
- Escreve `aprendizado.json`, `ligacoes.json`, `sinonimos.json` mesclados.
- Grava o `aprendizado-canonico.json` recebido como novo
  `aprendizado-canonico.base.json`.
- Uma linha no log: `merge canônico vX: N pares, M arquivos, K ligações`.

Se o `aprendizado-canonico.json` estiver corrompido / não parsear: pula o
merge, loga, deixa o aprendizado da editora intocado.

### Repo novo — `Pro-Edition-dist`

Público. Só recebe build; ninguém edita à mão. Conteúdo:

```
dist/               ← copiado do build do Pro-Edition
manifest.json
icons/
VERSION             ← "0.2.0\n"
aprendizado-canonico.json
README.md           ← 1 parágrafo: "saída compilada do Pro Edition, ver repo privado"
```

O `instalar/PluginData/` **sai** do repo de código (`git rm`): os arquivos de
sessão (`pendentes.json`, `config.json` com o caminho do dono) não deviam
estar versionados, e o `release.mjs` gera o `aprendizado-canonico.json` limpo
quando precisa. Histórico não precisa ser reescrito — o repo de código segue
privado.

## Fluxo de dados

**Baseline-delta, exemplo real.** Par `Viagra|viagra`.

| Momento | Canônico (dono) | Baseline na máquina da editora | Local (editora) | Resultado do merge |
|---|---|---|---|---|
| 1º Atualizar | `{12,2}` | *(ausente)* | `{4,0}` | `12+4, 2+0` = `{16,2}` |
| grava base | — | vira `{12,2}` | — | — |
| editora trabalha | — | `{12,2}` | `{16,3}` | — |
| 2º Atualizar | `{15,2}` | `{12,2}` | `{16,3}` | `15+(16−12), 2+(3−2)` = `{19,3}` |
| grava base | — | vira `{15,2}` | — | — |

O `{12,2}` que veio no 1º snapshot **não é contado de novo** no 2º — só o que
a editora somou por cima dele (`+4 acertos`, `+1 erro`). Sem baseline, o 2º
merge daria `15+16 = 31` acertos (o `12` original entrando duas vezes).

## Erros e casos de borda

- **Máquina nova, sem aprendizado:** `local` vazio, `base` vazio → resultado =
  canônico. A editora começa com o aprendizado do dono.
- **Sem baseline (1ª vez):** `base` vazio → `delta = local` → soma tudo. A
  editora mantém o que tinha e ganha o do dono.
- **`arquivos` com nomes que a editora não tem** (biblioteca de B-roll
  diferente): entram no `aprendizado.json` mas nunca casam com nada. Inócuo —
  `melhorArquivo()` só olha os arquivos candidatos da vez.
- **`fetch` da versão falha:** sem faixa, plugin normal.
- **`curl`/`tar` ausente** (Windows < 1803): o script detecta e manda
  atualizar o Windows ou instalar manualmente pelo `INSTALAR.md`.
- **Premiere aberto durante o Atualizar:** o script avisa para fechar antes;
  se arquivos estiverem travados, falha com mensagem clara em vez de meia
  cópia.
- **Corrida assíncrona no mount** (histórico do repo: escrever no painel
  errado ao trocar de tela): `mesclarCanonico()` é `await`-ado no início do
  mount e respeita o mesmo guard `aindaValido` que já existe — se o painel
  for trocado no meio, o merge termina de gravar em disco mas não pinta tela.

## Riscos e spikes

Antes de implementar, três coisas precisam de prova real (sem hot reload,
UXP costuma surpreender — ver `auto-broll-premiere/docs/UXP_ARMADILHAS.md`):

1. **Sintaxe de `requiredPermissions.network` no manifest v5** e se o Premiere
   pede aprovação de permissão na primeira carga depois da mudança. Testar num
   plugin descartável antes de mexer no manifest de produção.
2. **`fetch` a partir do painel UXP** para `raw.githubusercontent.com` —
   confirmar que resolve, que CORS não barra (o host manda
   `access-control-allow-origin: *`, mas UXP tem regras próprias), e o
   comportamento em offline (rejeita rápido vs. pendura — várias APIs do UXP
   penduram para sempre).
3. **`curl.exe` + `tar.exe` nativos** na versão de Windows das máquinas das
   editoras (10 1803+ tem os dois; confirmar caso alguma seja mais antiga).

Se (1) ou (2) não derem certo, o fallback é a opção "C2" do brainstorm
(tarefa agendada escreve um arquivo local, plugin lê o arquivo) — mais peças,
mas sem rede no plugin.

## Testes

- `mesclar-canonico.ts` (`node --test`, sem framework, como o resto):
  - baseline ausente → soma total;
  - chave só no canônico → entra como está;
  - chave só no local → preservada;
  - chave nos dois com soma passando de `TETO` → halving aplicado;
  - `delta` negativo (editora "desaprendeu") → chão em 0, nunca negativo;
  - `vistos` do input local sai idêntico no output;
  - `ligacoes.pares` (número puro) soma certo;
  - `sinonimos`: canônico vence no conflito, união no resto.
- `release.mjs`: um teste garante que o `aprendizado-canonico.json` gerado
  **não** contém `vistos` nem chave de `pendentes`/`config`.
- `Atualizar.ps1` / `-mac.command`: verificação manual numa segunda máquina
  (ou VM) de cada SO — roteiro no fim deste spec. Não dá para cobrir com
  `node --test`.

## Escopo cortado (YAGNI)

- Sincronia editora → dono.
- Tarefa agendada / notificação fora do painel / selo no menu do Windows.
- `.ccx`, assinatura Adobe, auto-restart do Premiere.
- UI de merge, diff visível, desfazer merge (o backup `.bak` cobre).
- Merge de `intensidade.json` (é cache que se refaz sozinho — não vale a
  complexidade).
- Pré-release / canais de versão (`beta`) — `VERSION` é um número e pronto.

## Roteiro de verificação manual (segunda máquina)

1. Máquina limpa, Premiere fechado. Rodar `Atualizar` do SO. Confirmar:
   plugin aparece em `Window > Extensions > Pro Edition` depois de reiniciar.
2. Abrir o painel offline (sem internet): nenhuma faixa, tudo funciona.
3. Na máquina do dono: ensinar 1 par novo, `npm run release`.
4. Na segunda máquina, abrir o painel com internet: faixa "atualização
   disponível" aparece.
5. Rodar `Atualizar`, reiniciar. Confirmar no log a linha `merge canônico`,
   e que `aprendizado.json.bak-antes-merge-<data>` foi criado.
6. Conferir que um par que só a segunda máquina tinha continua lá, e que o
   par novo do dono entrou.
7. `npm run release` de novo sem ensinar nada; `Atualizar` na segunda
   máquina: merge roda uma vez, e uma segunda abertura do painel não
   remescla (baseline == canônico).
