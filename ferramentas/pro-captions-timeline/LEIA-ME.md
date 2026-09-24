# Pro Captions: Timeline

Um botão que coloca na timeline as legendas que o Pro Captions gerou:
**legendas.srt** e **precos.srt** viram duas faixas de legenda na sequência
ativa, começando no zero. Acaba com os 2 arrastos por vídeo.

## Por que é um plugin separado

O Pro Edition é um plugin UXP (o formato novo da Adobe), e o UXP ainda não
cria faixa de legenda — conferido até a tipagem `27.0.0-beta.57`, de
2026-09-23. O formato antigo (CEP + ExtendScript) tem
`Sequence.createCaptionTrack()`, e é só isso que este ajudante usa.

Quando a Adobe liberar isso no UXP, o botão passa para o Pro Captions e este
ajudante pode ser apagado. A Adobe vai aposentar o CEP, mas não deu data;
funciona no Premiere 2025 e 2026.

## Instalar (uma vez)

1. Feche o Premiere.
2. Botão direito em `INSTALAR.ps1` > **Executar com o PowerShell**.
3. Abra o Premiere > **Window > Extensions > Pro Captions: Timeline**.

## Usar (por vídeo)

1. Pro Edition > Pro Captions > **Gerar legendas**.
2. Pro Captions: Timeline > **Colocar legendas na timeline**.
3. Escolher o estilo de cada faixa: **Pro-Captions** (96) na do texto e
   **Pro-Captions Preço** (150) na do preço. Estilo de legenda não é
   scriptável em nenhum dos dois formatos de plugin.

Clicar duas vezes cria as faixas duas vezes — Ctrl+Z desfaz.

## Como ele acha os arquivos

Procura `legendas.srt` na pasta de dados do Pro Edition e do Pro Captions
(`%APPDATA%\Adobe\UXP\PluginsStorage\PPRO\<versão>\External\...\PluginData`) e
usa o mais recente. O `precos.srt` só entra se foi gerado junto (até 2 min de
diferença): um `precos.srt` de outro vídeo é ignorado e o painel avisa.

Os .srt são importados de novo a cada clique, dentro da pasta **Pro Captions**
do painel Projeto, para pegar sempre o conteúdo atual.

## Arquivos

- `CSXS/manifest.xml` — registro do painel no Premiere
- `index.html` — o painel (um botão)
- `host.jsx` — o ExtendScript que importa e cria as faixas
- `INSTALAR.ps1` — copia para `%APPDATA%\Adobe\CEP\extensions` e liga o
  `PlayerDebugMode` (necessário para plugin CEP não assinado)
