# Cutline — guia da marca

**A ideia:** as faixas da timeline com o cursor coral cortando todas de uma vez,
a edição inteira num clique. É a mesma linguagem do painel (as miniaturas de faixa
e o cursor da timeline viva).

## Versões

| Arquivo | Quando usar |
|---|---|
| `cutline-horizontal-claro.svg` / `-escuro.svg` | assinatura principal: símbolo + nome, em fundo claro / escuro |
| `cutline-empilhado-claro.svg` / `-escuro.svg` | espaços quadrados (capa, abertura) |
| `cutline-simbolo-claro.svg` / `-escuro.svg` | só o símbolo, a partir de 32 px |
| `cutline-simbolo-pequeno-*.svg` | **de 16 a 32 px**: faixas mais grossas, corte mais largo, cursor maior |
| `cutline-icone-app.svg` | ícone do plugin, do programa e de perfil (bloco escuro) |
| `cutline-nome-*.svg` | só o nome, quando o símbolo já aparece por perto |
| `*-preto.svg` / `*-branco.svg` | uma cor só (carimbo, gravação, fundo com foto) |

Os PNGs ficam em `png/`. O ícone do plugin está em `../icons/` (23 e 46 px), e o do
programa em `../app/scripts/icone.ico`.

## Cores

| Nome | HEX | RGB | Uso |
|---|---|---|---|
| Noite | `#0d0f13` | 13 15 19 | faixas e nome em fundo claro; fundo do ícone |
| Papel | `#eceef2` | 236 238 242 | faixas e nome em fundo escuro |
| Corte | `#ff7d71` | 255 125 113 | só o cursor e o pingo do i, nunca as faixas |

O azul do painel (`#3b82f6`) é a cor de ação da interface, não da marca.

## Tipografia

O nome é a **Montserrat Bold** (licença SIL OFL, que permite uso em logo), já
convertida em desenho; não precisa da fonte instalada. O pingo do "i" é o cursor
coral. Para textos de apoio, use Montserrat ou Inter.

## Área de proteção e tamanho mínimo

- **Área livre** em volta: a altura de uma faixa do símbolo (28 de 256) dos quatro lados.
- **Horizontal:** no mínimo 96 px de largura (ou 20 mm impresso).
- **Símbolo:** a partir de 32 px. Abaixo disso, use o `simbolo-pequeno`.
- **Ícone de app:** de 16 px para cima.

## Não fazer

- Pintar as faixas de coral ou o cursor de outra cor que não o coral (na versão de uma cor, tudo vai na mesma cor).
- Fechar o corte no meio das faixas, alinhar as faixas ou mudar o comprimento delas.
- Esticar, girar, pôr sombra, contorno ou degradê.
- Trocar a fonte do nome ou escrever "CutLine" / "cutline".
- Usar a versão clara em fundo escuro ou o contrário.

## Como refazer

`gerar/kit.py` desenha todas as versões a partir das medidas do símbolo e da
Montserrat Bold (`gerar/ttfpath.py` lê a fonte, sem dependências):
`python marca/gerar/kit.py`. Os PNGs e ícones saem do `render_png.py` da skill
de logo.

A busca de marca registrada não foi feita. Antes de vender o produto, faça uma
pesquisa profissional (INPI e USPTO).
