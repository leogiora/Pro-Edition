# Instalar o Pro Edition (para o Claude Code executar)

Plugin UXP para o Adobe Premiere Pro 25.0+. Esta pasta contem o build pronto:
**nao rode `npm install` nem `npm run build`** para instalar. O `dist/` daqui ja
esta compilado e e autocontido (JS inline, zero dependencia externa).

Peca ao usuario para **fechar o Premiere Pro** antes de comecar.

## macOS

```bash
EXT="$HOME/Library/Application Support/Adobe/UXP/Plugins/External"
mkdir -p "$EXT"
rm -rf "$EXT/com.leogi.proedition"
cp -R instalar/com.leogi.proedition "$EXT/com.leogi.proedition"
```

Nao use `sudo` e nao instale em `/Library`: a pasta do usuario funciona e nao
exige privilegio. Se aparecer `Operation not permitted`, o repositorio esta numa
pasta protegida pelo macOS (Mesa, Documentos, Downloads) — mova-o para
`~/pro-edition` e repita.

Depois, o aprendizado. A pasta de dados so existe se o Premiere ja foi aberto
alguma vez neste Mac; e uma pasta por versao (`25`, `26`):

```bash
RAIZ="$HOME/Library/Application Support/Adobe/UXP/PluginsStorage/PPRO"
for V in "$RAIZ"/*/; do
  ALVO="$V/External/com.leogi.proedition/PluginData"
  mkdir -p "$ALVO"
  cp -f instalar/PluginData/* "$ALVO"/
done
```

Se `$RAIZ` nao existir: instale o plugin mesmo assim, peca para o usuario abrir
e fechar o Premiere uma vez, e rode so este segundo bloco depois.

## Windows

Mesma coisa, com PowerShell como administrador:

- plugin -> `C:\Program Files\Common Files\Adobe\UXP\Plugins\External\com.leogi.proedition`
- dados  -> `%APPDATA%\Adobe\UXP\PluginsStorage\PPRO\<versao>\External\com.leogi.proedition\PluginData`

Ou rode `instalar\INSTALAR.ps1`.

## Conferir

Peca ao usuario para abrir o Premiere e ir em **Window > Extensions > Pro
Edition**. Se o painel nao estiver no menu, e a politica de plugins nao
assinados: nas preferencias do Premiere, ative o carregamento de plugins de
desenvolvedor, e reinicie.

## Depois de instalar

- O **caminho da pasta de B-rolls** precisa ser digitado de novo no painel: o
  `config.json` que veio junto aponta para a maquina de origem.
- As 201 associacoes ensinadas, os pesos e o dicionario ja vao carregados.
- A partir daqui, cada maquina aprende separado. Nao ha sincronia.

## Atualizar depois

Quem gera o build e a maquina de desenvolvimento (`npm run build` na raiz do
repo, com os repos `auto-broll-premiere` e `Pro-Captions` ao lado — o shell
embute a UI dos dois em tempo de build). O resultado e copiado para
`instalar/com.leogi.proedition/`. Aqui no Mac, so `git pull` e repetir o passo
de instalacao.
