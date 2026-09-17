# ARCHITECTURE

**Estado: nao definida.** Ver DECISIONS.md D-004.

A arquitetura-alvo esta descrita no CLAUDE.md secao 6 e continua sendo a intencao,
mas nao vira estrutura de pastas antes das provas da Fase 0. Duas incognitas
mudam o desenho inteiro:

1. **Transcricao acessivel ou nao** (P3.1, P3.3, P3.4). Se a leitura direta falhar,
   toda a camada de reconstrucao da secao 9 do CLAUDE.md passa a ser o nucleo do
   produto, com peso de teste muito maior que o previsto.
2. **Custo real da leitura da timeline** (P2.1). Se `getTrackItems` e os getters
   forem lentos por item, o snapshot precisa de estrategia de batching e a fronteira
   entre JS e addon nativo muda de lugar.

O unico compromisso ja assumido e o invariante: **a UI nunca fala com o addon
nativo diretamente**, e todo acesso ao Premiere passa por adapters isolaveis, para
que domain e application rodem em teste sem abrir o Premiere.

Este documento e preenchido ao final da Fase 0, com base no relatorio de capacidade.
