# Cutline (antes Pro Edition)

Painel UXP para o Premiere Pro que reúne as ferramentas de edição num lugar só.
O **programa** `app/` é o Cutline fora do Premiere (ver `app/LEIA-ME.md`).

**Nomes na tela desde 01/10:** Cutline (o painel), AutoEdit (Editar), SilenceCut
(Auto Pausas), B-Roller (Auto B-roll), Captions (Pro Captions), SplitScreen
(Auto Split) e PodCut (Podcast AutoCut). O botão Aprender continua Aprender.
No código e nos documentos ficam os nomes antigos. Também não mudaram:
- o ID do plugin (`com.leogi.proedition`), porque mudá-lo apaga a pasta de dados com o aprendizado e a chave;
- o nome do programa instalado;
- a pasta "Pro Captions" no painel Projeto.

**Logo:** em `marca/`, com o guia de uso em `marca/GUIA.md`. O símbolo são as
faixas da timeline com o cursor coral cortando todas. No topo do painel ele é
desenhado com caixas (`marca()` em `src/shell.ts`), porque o UXP não garante SVG.


| Grupo   | Ferramenta      | Código                      |
|---------|-----------------|-----------------------------|
| Pro Ads | **Editar** (tudo de uma vez) | `src/editar*.ts`   |
| Pro Ads | Auto B-roll     | `ferramentas/auto-broll/`   |
| Pro Ads | Pro Captions    | `ferramentas/pro-captions/` |
| Pro Ads | ponte das legendas (CEP escondido, sem menu) | `ferramentas/pro-captions-timeline/` |
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
de cada clipe voltam em cada pedaço), põe os B-rolls, opcionalmente o Split, o
light leak em cada troca doutor ↔ B-roll, a trilha em cada variação, e cria as
faixas de legenda e de preço.
O registro de cada execução fica em `editar-log.json`, na pasta de dados do plugin.

**Quadrado 1:1** (botão no cartão Auto Split): na Reels duplicada e já mudada para
1080×1080, o doutor cobre o quadrado, centrado na altura e com o mesmo desvio de
enquadramento na largura, e o B-roll cobre com 20% de sobra, centrado, sem o Rounded
Crop. O UXP não dá o tamanho do clipe; o da V1 sai da escala-base dele na Reels
(`tamanhoPelaEscala`: 4K deitado entra a 90, em pé a 50), o do B-roll de onde o Auto
Split já tira. Cor, legenda e light leak ficam. Provado em 29/09 na cópia do Andro
19.09: 697 clipes da V1 a 50% (o que o Leo pôs à mão) e 100 B-rolls.

A **empresa** (AndroClinic, GrandCare ou Menopausa Cancelada) é escolhida no topo do
cartão e fica em `perfil.json`: dá os termos do ElevenLabs e a pasta de B-roll de cada
uma. Trocar de empresa guarda a pasta em uso na empresa que sai e põe no Auto B-roll a
pasta da que entra. O split também é da empresa (`SPLIT_DA_EMPRESA`): AndroClinic e
GrandCare com o B-roll embaixo, Menopausa com o B-roll em cima, cortado embaixo.

O light leak é o do Premiere Composer que já está no projeto (o da timeline, ou o
primeiro com "Light Leak" no nome), inteiro, começando 0,36 s antes da borda do
B-roll, na faixa do leak que já existe ou logo acima do B-roll. Não entra entre dois
B-rolls colados, no começo ou fim da variação, nem onde a faixa já tem algo
(`inicioDosLeaks` em `src/editar.ts`). Nas 79 bordas das variações 1–6 do Andro
19.09 a regra põe os 79 leaks que o Leo pôs, no mesmo quadro. Falta provar no
Premiere que o `.aegraphic` entra pelo overwrite como um clipe comum.

A trilha é a música que o Leo pôs embaixo de uma variação na A2, **clonada**
(`createCloneTrackItemAction`) para as outras e aparada no fim de cada uma: o clone
leva o ganho e o trecho da música, e a API não tem como ajustar volume. No Andro
19.09 as 20 variações têm "stillness.WAV" do 0 da música, começando e terminando com
a variação (−10 dB de ganho de clipe nas acabadas). Variação que já tem música fica;
se a cópia, antes de aparada, cairia na música da vizinha, fica de fora com aviso
(`trilhaFaltando` em `src/editar.ts`).

Light leak e trilha **provados ao vivo** em 29/09, numa cópia do Andro 19.09
(Premiere 25): 16 leaks nas 16 bordas da variação 10, cada um 0,36 s antes da borda
(0,80 s: o Premiere arredonda o 0,834 s do arquivo para 20 quadros); a trilha clonada
na variação 12, do 0, do começo ao fim dela, com o ganho do clipe de origem. Split,
light leak e trilha rodam sem ElevenLabs: a fala só é pedida com Pausas, B-roll ou
Legendas marcados.

UXP não cria faixa de legenda. Quem cria é a **ponte**: uma extensão CEP escondida
(`ferramentas/pro-captions-timeline/ponte.html`) que abre com o Premiere e atende
o pedido que o Editar grava em `timeline-pedido.txt`. Ela só liga quando a janela
do Premiere é ativada. O cartão Pro Captions usa a mesma ponte. Sem ela, os .srt vão para o painel
Projeto e o registro manda arrastar.

Provado no Premiere 25.6.6 (TESTE Editar 3 e 5, 3:00 → 2:27 em 11 s); light leak,
trilha, empresa e split da Menopausa provados em 29/09 (acima).

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
