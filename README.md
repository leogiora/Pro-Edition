# Pro Edition

Painel UXP para o Premiere Pro que reúne as ferramentas de edição num lugar só:

| Grupo   | Ferramenta      | Código                      |
|---------|-----------------|-----------------------------|
| Pro Ads | Auto B-roll     | `ferramentas/auto-broll/`   |
| Pro Ads | Pro Captions    | `ferramentas/pro-captions/` |
| Pro Ads | Pro Captions: Timeline (ajudante CEP, painel separado) | `ferramentas/pro-captions-timeline/` |
| Pro Ads | Auto Split      | `src/autosplit*.ts`         |
| Podcast | Podcast AutoCut | `src/autocut*.ts`           |

Tudo mora **neste repositório, no branch `main`**. Até 2026-09-17 o Auto B-roll e o
Pro Captions eram repositórios separados (`leogiora/auto-broll-premiere` e
`leogiora/Pro-Captions`, hoje arquivados). Eles foram trazidos para `ferramentas/`
com o histórico inteiro.

## Estrutura

```
Pro-Edition/                 raiz = o plugin que o Premiere carrega (manifest.json, dist/)
├─ src/                      tela inicial, navegação, Podcast AutoCut e Auto Split
├─ tests/
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
