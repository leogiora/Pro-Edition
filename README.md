# Pro Edition

Painel UXP para o Premiere Pro que reúne as ferramentas de edição num lugar só.
O **programa** `app/` é o Pro Edition fora do Premiere (ver `app/LEIA-ME.md`).


| Grupo   | Ferramenta      | Código                      |
|---------|-----------------|-----------------------------|
| Pro Ads | **Editar** (tudo de uma vez) | `src/editar*.ts`   |
| Pro Ads | Auto B-roll     | `ferramentas/auto-broll/`   |
| Pro Ads | Pro Captions    | `ferramentas/pro-captions/` |
| Pro Ads | Pro Captions: Timeline (ajudante CEP, painel separado) | `ferramentas/pro-captions-timeline/` |
| Pro Ads | Auto Split      | `src/autosplit*.ts`         |
| Podcast | Podcast AutoCut | `src/autocut*.ts`           |

Tudo mora **neste repositório, no branch `main`**. Até 2026-09-17 o Auto B-roll e o
Pro Captions eram repositórios separados (`leogiora/auto-broll-premiere` e
`leogiora/Pro-Captions`, hoje arquivados). Eles foram trazidos para `ferramentas/`
com o histórico inteiro.

## Editar

O primeiro cartão do Pro Ads. Lê a sequência aberta (clipes da V1, variações
separadas por 1 s ou mais de vão, B-rolls e legendas que já existem) e, num clique:
manda o áudio uma vez para o ElevenLabs, corta as pausas (zoom, posição e Lumetri
de cada clipe voltam em cada pedaço), põe os B-rolls, opcionalmente o Split, e
cria as faixas de legenda e de preço. O registro de cada execução fica em
`editar-log.json`, na pasta de dados do plugin.

UXP não cria faixa de legenda. Quem cria é a **ponte**: uma extensão CEP escondida
(`ferramentas/pro-captions-timeline/ponte.html`) que abre com o Premiere e atende
o pedido que o Editar grava em `timeline-pedido.txt`. Ela só liga quando a janela
do Premiere é ativada. Sem ela o Editar avisa e as legendas entram pelo painel
Pro Captions: Timeline.

Provado no Premiere 25.6.6 (TESTE Editar 3 e 5, 3:00 → 2:27 em 11 s). Ainda
falta: a trilha e o fim de variação só existem no programa `app/`.

O estilo da legenda (Pro-Captions 96 / Preço 150) fica à mão, por escolha do Leo
(2026-09-24). Nenhuma API aplica estilo em faixa de legenda (D-02, reconferido
na tipagem UXP 26.3, no ExtendScript e nas preferências, que só guardam a fonte).
O único caminho automático seria texto gráfico (`insertMogrtFromPath`) em vez de
faixa de legenda, e ele preferiu manter a faixa editável no painel Text.

## Estrutura

```
Pro-Edition/                 raiz = o plugin que o Premiere carrega (manifest.json, dist/)
├─ src/                      tela inicial, navegação, Podcast AutoCut e Auto Split
├─ tests/
├─ app/                      o programa (Electron): gera .srt e sequências XML
├─ ferramentas/
│  ├─ auto-broll/            também continua funcionando como plugin sozinho
│  └─ pro-captions/          idem
└─ instalar/                 pacote pronto para instalar em outra máquina
```

O shell importa a tela de cada ferramenta de `ferramentas/` na hora do build. Por
isso não existe mais "qual branch está aberto no outro repositório": o que está
neste commit é o que vai para o painel.

## Comandos

```
npm run preparar   # instala as dependências da raiz e das duas ferramentas
npm run verify     # testes + checagem de tipos + build das três partes
npm run build      # só o painel do Pro Edition (dist/)
```

Depois de qualquer build, reinicie o Premiere: não há recarga automática.

Antes de mexer no painel, leia `ferramentas/auto-broll/docs/UXP_ARMADILHAS.md`.
