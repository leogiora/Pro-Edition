#!/bin/bash
# Instala o Pro Edition no Premiere deste Mac.
#
# Como rodar: clique duas vezes neste arquivo.
# Se o macOS disser que nao pode ser aberto: botao direito > Abrir > Abrir.
#
# Feche o Premiere antes.
#
# NAO pede senha: instala na pasta de plugins do SEU usuario, nao na do
# sistema. E onde o Premiere procura plugins UXP de desenvolvedor.

set -e
cd "$(dirname "$0")"
ORIGEM="$(pwd)"

EXT="$HOME/Library/Application Support/Adobe/UXP/Plugins/External"
DESTINO="$EXT/com.leogi.proedition"

if [ ! -d "$ORIGEM/com.leogi.proedition" ]; then
  echo "ERRO: nao achei a pasta com.leogi.proedition aqui do lado."
  echo "Copie a pasta Pro-Edition-Instalar INTEIRA para o Mac, nao so este arquivo."
  read -p "Enter para fechar."
  exit 1
fi

echo "Instalando em: $DESTINO"
mkdir -p "$EXT"
rm -rf "$DESTINO"
cp -R "$ORIGEM/com.leogi.proedition" "$DESTINO"
echo "plugin instalado."

# Aprendizado: uma copia para cada versao do Premiere presente.
DADOS="$ORIGEM/PluginData"
RAIZ="$HOME/Library/Application Support/Adobe/UXP/PluginsStorage/PPRO"

if [ -d "$DADOS" ]; then
  if [ -d "$RAIZ" ]; then
    for V in "$RAIZ"/*/; do
      ALVO="$V/External/com.leogi.proedition/PluginData"
      mkdir -p "$ALVO"
      cp -f "$DADOS"/* "$ALVO"/
      echo "aprendizado copiado para PPRO/$(basename "$V")"
    done
  else
    echo ""
    echo "AVISO: o Premiere ainda nao criou a pasta de dados neste Mac."
    echo "Abra o Premiere uma vez, feche, e rode este script de novo para"
    echo "levar o aprendizado. O plugin ja esta instalado de qualquer forma."
  fi
fi

echo ""
echo "PRONTO. Abra o Premiere: Window > Extensions > Pro Edition."
read -p "Enter para fechar."
