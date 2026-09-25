# Pro Captions: Timeline (a ponte)

Um ajudante **sem janela** que cria as faixas de legenda na sequência ativa:
**legendas.srt** e **precos.srt** viram duas faixas, começando no zero. Quem
pede é o Pro Edition — o botão **Editar** e o cartão **Pro Captions** — sozinho,
no fim de cada geração. Não aparece em Window > Extensions (o painel com botão
saiu em 2026-09-24).

## Por que é um plugin separado

O Pro Edition é um plugin UXP (o formato novo da Adobe), e o UXP ainda não
cria faixa de legenda — conferido até a tipagem `27.0.0-beta.57`, de
2026-09-23. O formato antigo (CEP + ExtendScript) tem
`Sequence.createCaptionTrack()`, e é só isso que a ponte usa.

Quando a Adobe liberar isso no UXP, a ponte pode ser apagada. A Adobe vai
aposentar o CEP; funciona no Premiere 2025 e 2026.

## Instalar (uma vez, e de novo quando este código mudar)

1. Feche o Premiere.
2. Botão direito em `INSTALAR.ps1` > **Executar com o PowerShell**.

## Como funciona

A ponte (`ponte.html`) abre escondida quando a janela do Premiere é ativada e,
a cada 1,5 s, chama `proCaptions_atenderPedido()`. O Pro Edition grava
`timeline-pedido.txt` na pasta de dados do plugin
(`%APPDATA%\Adobe\UXP\PluginsStorage\PPRO\<versão>\External\...\PluginData`):
id, caminho do legendas.srt, caminho do precos.srt. A ponte importa os .srt na
pasta **Pro Captions** do painel Projeto, cria as faixas e responde em
`timeline-resposta.txt`. Só olha a pasta da própria versão do Premiere: com o
2025 e o 2026 abertos juntos, cada um atende o seu.

Sem resposta em 20 s, o Pro Edition importa os .srt no painel Projeto e avisa
para arrastar na mão.

O estilo de cada faixa continua manual: **Pro-Captions** (96) na do texto e
**Pro-Captions Preço** (150) na do preço. Estilo de legenda não é scriptável
(D-02, reconferido na UXP 26.3).

## Arquivos

- `CSXS/manifest.xml` — registro da ponte no Premiere
- `ponte.html` — o laço escondido
- `host.jsx` — o ExtendScript que importa e cria as faixas (só ASCII: o
  ExtendScript lê o arquivo sem saber que é UTF-8)
- `INSTALAR.ps1` — copia para `%APPDATA%\Adobe\CEP\extensions` e liga o
  `PlayerDebugMode` (necessário para plugin CEP não assinado)
