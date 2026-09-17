# Auto B-roll para Adobe Premiere — Instruções do projeto

## 1. Missão
Construir um plugin instalado e executado dentro do Adobe Premiere Pro que analise a sequência ativa já editada, obtenha a transcrição correspondente ao conteúdo que permaneceu no corte, encontre B-rolls semanticamente relacionados em uma biblioteca local e os insira em uma faixa de vídeo escolhida.

O Claude é usado apenas para desenvolver o produto. O plugin final deve funcionar sem Claude, sem API de IA na nuvem, sem assinatura por uso e sem enviar mídia ou transcrições para a internet.

## 2. Resultado esperado
O usuário deve conseguir:
1. Instalar um arquivo `.ccx`.
2. Abrir o painel em `Janela > UXP Plugins`.
3. Selecionar uma pasta local de B-rolls.
4. Indexar somente arquivos novos ou alterados.
5. Abrir uma sequência finalizada e clicar em `Analisar sequência`.
6. Revisar oportunidades e sugestões de B-roll.
7. Clicar em `Inserir B-rolls` para preencher V2/V3 sem alterar V1 e o áudio principal.
8. Desfazer toda a operação de inserção com uma única ação de Undo, quando a API permitir.

## 3. Premissas iniciais
- Alvo inicial: Windows x64; preparar arquitetura para macOS Intel e Apple Silicon depois.
- Premiere mínimo para o produto completo: 26.2+, devido ao suporte oficial a plugins UXP híbridos.
- Linguagem da interface: português do Brasil.
- Runtime: completamente local e offline.
- UI e integração com Premiere: UXP + TypeScript.
- Processamento pesado: addon nativo C++ (`.uxpaddon`).
- Inferência local preferida: ONNX Runtime, após prova técnica de compatibilidade.
- Indexação: SQLite ou equivalente embutido; não exigir servidor externo.
- Não escolher modelo, banco vetorial ou biblioteca por popularidade. Medir compatibilidade, licença, tamanho, velocidade e qualidade.

## 4. Fontes de verdade
Antes de implementar uma API do Premiere, consulte a documentação oficial atual. Nunca invente métodos, propriedades, permissões ou formatos.

Referências principais:
- https://developer.adobe.com/premiere-pro/uxp/
- https://developer.adobe.com/premiere-pro/uxp/ppro-reference/
- https://developer.adobe.com/premiere-pro/uxp/ppro-reference/classes/transcript
- https://developer.adobe.com/premiere-pro/uxp/ppro-reference/classes/sequenceeditor
- https://developer.adobe.com/premiere-pro/uxp/plugins/hybrid-plugins/
- https://developer.adobe.com/premiere-pro/uxp/plugins/distribution/package/
- https://developer.adobe.com/premiere-pro/uxp/resources/fundamentals/typescript-support/

Registre em `docs/API_PROOFS.md` toda API crítica validada no Premiere real, incluindo versão do Premiere, código mínimo, resultado e limitações.

## 5. Regras obrigatórias para o Claude
- Trabalhe em uma fase por vez. Não implemente o produto inteiro em uma única tentativa.
- Antes de alterar código, leia `CLAUDE.md`, `docs/BUILD_STATUS.md`, os testes relevantes e os arquivos que serão modificados.
- Para cada fase, apresente: objetivo, hipótese técnica, arquivos afetados, teste e critério de conclusão.
- Não avance de fase sem uma demonstração executável ou um teste reproduzível.
- Não esconda limitações atrás de mocks. Mocks são permitidos apenas para testes unitários identificados como mocks.
- Não substitua uma função local por chamada de API externa.
- Não adicione telemetria, upload, login ou rede sem autorização explícita.
- Não execute comandos destrutivos, não apague mídia e não sobrescreva projetos do usuário.
- Sempre preserve V1 e áudio principal. Inserções automáticas usam faixa configurável, inicialmente V2.
- Cada lote de edição deve ser transacional quando a API oferecer Actions/CompoundAction.
- Toda falha deve produzir mensagem legível e log técnico, sem deixar a timeline parcialmente modificada.
- Use TypeScript estrito; evite `any`; valide dados vindos do Premiere, do filesystem e do addon nativo.
- Use as tipagens oficiais `@adobe/premierepro` e o ESLint oficial quando compatíveis.
- Para dúvidas sobre UXP, crie primeiro um experimento mínimo no UXP Developer Tool/Playground.
- Ao encerrar uma sessão, atualize `docs/BUILD_STATUS.md` com feito, testes, bloqueios e próximo passo exato.
- Sempre que uma mudança alterar o que o usuário vê ou como ele usa o painel (novo botão, novo comportamento, nova mensagem de log, nova limitação), atualize `docs/GUIA-DE-USO.md` na mesma sessão — é o documento de apresentação/treinamento, e fica desatualizado se só os docs técnicos forem mantidos.

## 6. Arquitetura-alvo
```text
auto-broll-premiere/
├── CLAUDE.md
├── manifest.json
├── package.json
├── src/
│   ├── ui/                 # painel e estado visual
│   ├── premiere/           # adapters da API UXP/Premiere
│   ├── domain/             # regras puras e tipos
│   ├── application/        # casos de uso
│   └── infrastructure/     # filesystem, banco e ponte nativa
├── native/
│   ├── include/
│   ├── src/
│   ├── models/
│   └── CMakeLists.txt
├── tests/
│   ├── unit/
│   ├── integration/
│   └── fixtures/
├── scripts/
└── docs/
    ├── BUILD_STATUS.md
    ├── API_PROOFS.md
    ├── ARCHITECTURE.md
    ├── TEST_PLAN.md
    └── DECISIONS.md
```

A UI nunca chama diretamente detalhes do addon. Use interfaces de domínio e adapters para permitir testes sem abrir o Premiere.

## 7. Modelo de dados mínimo
- `SequenceSnapshot`: sequência, frame rate, faixas e itens usados.
- `TranscriptWord`: texto, sourceIn, sourceOut, sequenceIn, sequenceOut, confiança.
- `TranscriptSegment`: frase, intervalo na sequência, importância e intenção visual.
- `BrollAsset`: caminho, hash, tamanho, modificação, duração, dimensões e status.
- `BrollShot`: asset, intervalo interno, frames-chave, descrição e embedding.
- `BrollCandidate`: shot, score semântico, score técnico, penalidades e motivo.
- `PlacementPlan`: faixa, sequenceIn, sequenceOut, sourceIn, sourceOut e candidato.
- `InsertionReceipt`: itens criados, ação/undo, avisos e erros.

Dados persistidos devem ter versão de schema e migração segura.

## 8. Regras iniciais de montagem
- Não colocar B-roll em todas as frases.
- Ignorar segmentos menores que o limite configurado.
- Duração padrão entre 1,5 e 4 segundos, ajustável.
- Não repetir o mesmo shot em uma sequência, salvo ausência de alternativa.
- Penalizar arquivos recentemente usados e imagens muito semelhantes.
- Desativar ou não inserir o áudio dos B-rolls.
- Nunca deslocar o conteúdo existente: preferir overwrite na faixa de destino.
- Não cobrir momentos marcados pelo usuário como obrigatórios para câmera principal.
- Toda decisão automática deve mostrar motivo e permitir trocar, ignorar ou bloquear.

## 9. Estratégia para transcrição
A API oficial documenta exportação de transcrição de `ClipProjectItem`; não presuma que exista exportação direta da transcrição final da sequência.

Implementar nesta ordem:
1. Provar se a versão instalada oferece leitura útil de caption/transcript da sequência.
2. Caso não ofereça, reconstruir o texto final por item da timeline.
3. Para cada item: identificar mídia de origem, obter transcrição, recortar pelas entradas/saídas e remapear para o tempo da sequência.
4. Tratar velocidade diferente de 100%, reverse, nested sequence, multicam, gaps e mídia sem transcrição.
5. Marcar trechos incertos em vez de inventar texto ou timecode.

A reconstrução precisa de fixtures determinísticas e tolerância explícita de alinhamento em frames/milissegundos.

## 10. Estratégia de indexação local
- Varredura incremental por caminho normalizado + tamanho + `mtime` + hash quando necessário.
- Extrair metadados e frames-chave sem decodificar o vídeo inteiro desnecessariamente.
- Gerar múltiplos shots para vídeos longos; não representar todo arquivo por um único embedding.
- Guardar modelo, versão, dimensão do embedding e parâmetros usados.
- Permitir pausar, cancelar e retomar.
- Nunca bloquear a UI do Premiere durante indexação ou inferência.
- Exibir progresso, arquivo atual, erros e estimativa baseada somente no trabalho já medido.

## 11. Ranking de candidatos
Começar simples e explicável:
`scoreFinal = semantico + qualidadeTecnica + diversidade - repeticao - conflito - inadequacaoDuracao`.

Cada componente deve estar normalizado, testado e registrado. O sistema deve retornar top 3 para revisão antes do modo totalmente automático. Não usar LLM para o ranking em runtime.

## 12. Fases e gates
### Fase 0 — Descoberta e provas de API
Entregas: ambiente reproduzível, plugin vazio carregando, API proofs para sequência ativa, leitura de tracks/items, importação e overwrite em V2, transcrição e undo/transação. Gate: relatório real com suportado, não suportado e fallback.

### Fase 1 — Esqueleto do produto
Entregas: TypeScript, lint, testes, painel, logs, configuração, adapters e CI local. Gate: painel abre sem erros e testes unitários passam.

### Fase 2 — Snapshot da sequência
Entregas: leitura determinística de tracks, clips, in/out, origem, velocidade e frame rate. Gate: exportar JSON conferível com a timeline de teste.

### Fase 3 — Transcrição final
Entregas: leitura direta quando possível e reconstrução como fallback. Gate: texto e timecodes correspondem a pelo menos cinco cenários de edição definidos em fixtures.

### Fase 4 — Inserção segura
Entregas: importar B-roll, definir source in/out, overwrite em faixa escolhida, remover áudio e desfazer lote. Gate: projeto de teste permanece íntegro após inserir, desfazer e repetir.

### Fase 5 — Indexador local
Entregas: scan incremental, banco versionado, frames-chave, metadados, embeddings e cancelamento. Gate: segunda indexação sem mudanças ignora os arquivos já processados.

### Fase 6 — Busca e revisão
Entregas: segmentação da transcrição, top 3 candidatos, preview, motivo e controles aprovar/trocar/ignorar. Gate: usuário consegue montar uma sequência sem inserção automática cega.

### Fase 7 — Preenchimento automático
Entregas: regras de densidade, diversidade, duração, conflitos e plano de inserção. Gate: plano é revisável antes da aplicação e a aplicação é atômica.

### Fase 8 — Empacotamento
Entregas: build limpo, `.ccx`, instalador independente, permissões mínimas, manual e matriz de compatibilidade. Gate: instalação em máquina limpa e execução offline.

## 13. Testes obrigatórios
- Unitários para tempo, remapeamento, ranking, seleção e migrações.
- Integração para ponte UXP/addon e banco.
- Projetos manuais: cortes simples, jump cuts, gaps, nested, multicam, speed change, mídia offline e transcrição ausente.
- Teste de idempotência: analisar duas vezes não duplica índice nem inserções aprovadas.
- Teste de cancelamento e recuperação após falha.
- Teste com caminhos Unicode, espaços, arquivos grandes e biblioteca em disco externo.
- Benchmark inicial: tempo de indexação por minuto de mídia, uso de RAM/VRAM e latência por consulta.

## 14. Definição de pronto
Uma tarefa só está pronta quando código, testes, logs, documentação e demonstração reproduzível estão concluídos. O MVP só está pronto quando funciona offline do começo ao fim em uma sequência real e produz um `.ccx` instalável.

## 15. Primeiro procedimento do Claude
1. Não comece implementando o motor de IA.
2. Verifique sistema operacional, versão exata do Premiere, hardware e tamanho aproximado da biblioteca.
3. Crie os arquivos de documentação e o esqueleto do repositório.
4. Execute somente a Fase 0.
5. Apresente uma tabela de capacidade: requisito, API oficial, prova executada, resultado, risco e fallback.
6. Aguarde os resultados reais do Premiere antes de decidir arquitetura definitiva do addon e da transcrição.

## 16. Comando inicial sugerido
Ao iniciar o Claude Code na raiz do projeto, use:

> Leia integralmente o CLAUDE.md. Não escreva o produto completo. Comece pela Fase 0, crie o esqueleto mínimo e um plano de provas executáveis no UXP Developer Tool. Antes de usar qualquer método do Premiere, confirme-o na documentação oficial atual. Ao final, atualize `docs/BUILD_STATUS.md` e informe exatamente o que preciso testar dentro do Premiere.
