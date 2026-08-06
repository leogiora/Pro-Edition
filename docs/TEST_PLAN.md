# TEST_PLAN

## Fase 0 — validacao manual

Nao ha teste automatizado nesta fase: nada aqui e codigo de produto, e o objeto
sob teste e o proprio Premiere. A validacao e a execucao do painel de provas e o
preenchimento da tabela de capacidade em `API_PROOFS.md`.

**Criterio de conclusao da Fase 0:** toda linha da tabela de capacidade tem
resultado real, e cada linha com resultado negativo tem um fallback escrito.

### Projetos de teste necessarios

O usuario precisa preparar, no minimo:

| Projeto | Conteudo | Serve para |
|---|---|---|
| T1 — corte simples | uma camera, 5-10 cortes, transcricao gerada no Premiere | P1, P2, P3 |
| T2 — descartavel | qualquer coisa, com V2 vazia | P5 (escrita e undo) |

Os cenarios dificeis (jump cuts, gaps, nested, multicam, speed change, midia
offline, sem transcricao) entram na Fase 3, quando existir o que quebrar.

## Fases 1+ — a definir

A suite automatizada (unitarios de tempo/remapeamento/ranking, integracao da ponte
e do banco, idempotencia, cancelamento, Unicode) entra na Fase 1 junto com o
esqueleto de TypeScript. A lista completa esta no CLAUDE.md secao 13 e sera
transcrita aqui como checklist executavel quando houver runner configurado.
