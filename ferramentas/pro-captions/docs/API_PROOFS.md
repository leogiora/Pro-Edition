# API_PROOFS — Pro Captions

Premiere alvo: 26.3.2 (Windows x64). Nada entra em codigo de produto sem uma
linha aqui com resultado **real**, obtido na versao instalada.

Modulo: `const ppro = require("premierepro")`

---

## Herdado do auto-broll, nao refeito

As provas abaixo foram executadas em 2026-08-06 no mesmo Premiere e valem para
este projeto. Fonte: `auto-broll-premiere/docs/API_PROOFS.md`.

| # | Requisito | Resultado |
|---|---|---|
| P0.1 | Modulo carrega | OK — 70 classes expostas |
| P0.3 | Enum de track item | OK — `CLIP = 1` |
| P1.1 | Projeto ativo | OK |
| P1.2 | Sequencia ativa | OK |
| P1.4 | Frame rate | OK via `getSettings().getVideoFrameRate()`. `getFrameSize()` devolve `{}` e e inutil |
| P1.5 | Contagem de faixas | OK |
| P2.1 | Semantica de tempo | OK — `inPoint`/`outPoint` sao tempo da ORIGEM, `start`/`end` da SEQUENCIA |
| P3.1 | Transcricao da sequencia | **NAO EXISTE** — caption track sem texto acessivel, `getComponentCount() = 0` |
| P3.3 | Transcricao por clipe | OK — camera principal tem, B-roll nao |
| P3.4 | Formato do JSON | OK — palavra a palavra, com `confidence` e `eos` |

---

## Fase 0 deste projeto — escrita do transcript

Executar pelo botao **Prova da Fase 0** do painel, num **projeto de teste
descartavel**: a escrita sobrescreve a transcricao do clipe.

| # | Requisito | Resultado | Risco restante |
|---|---|---|---|
| E1 | `Transcript.exportToJSON` no clipe da V1 | OK (2026-08-11, sequencia real de 32 clipes) | |
| E2 | Backup gravado em PluginData | OK — `original-IMG_1190.MOV.json` integro | |
| E3 | `createImportTextSegmentsAction` aceita nosso JSON | OK — 49 blocos escritos, log 19:01:55 | |
| E4 | Blocos aparecem no painel Transcricao | OK | |
| E5 | **1 `segment` produz 1 legenda de 1 linha** | **FALHOU** — ver veredito | O caminho `.srt` precisa da prova E5b abaixo |
| E6 | Um unico Ctrl+Z desfaz a escrita | Nao medido isoladamente | Backup + Restaurar cobrem o risco |

### Veredito do E5 (2026-08-11) — FALHOU, plano B assumido

Medicao real: 49 segments escritos → "Criar legendas a partir da
transcricao" → **47 legendas com fronteiras re-segmentadas**. Evidencia
extraida do proprio `.prproj` (auto-save 16:25, base64 dos
`CaptionDataClipTrackItem` decodificado):

- Nosso segment `É exatamente essa a sensação que` virou TRES legendas:
  `É exatamente essa` + `a sensação` + `que milhões de casais no Brasil` —
  o "que" migrou para a legenda seguinte, junto com o bloco vizinho.
- Nosso par `quando o homem começa a perder o` + `desempenho sexual.` virou
  `quando o homem começa` + `a perder o desempenho sexual.` — fronteira
  movida no meio do segment.

O Premiere ignora as fronteiras dos segments e re-segmenta com o proprio
algoritmo. A aposta central do desenho (§2.3) esta morta para esse comando.
Nao adianta mexer nos knobs da telinha: Single Line e maximo 42 estavam
corretos e a re-segmentacao aconteceu mesmo assim.

Fatos de plataforma anotados na mesma medicao:

- O slider **Minimum duration** da telinha tem piso de **1,2s** — nao aceita 0.
- **Remove Punctuation** vem marcado por padrao e apaga a pontuacao.
- Duas linhas na tela com legenda de uma linha nos dados = **largura**, nao
  segmentacao: com Bebas Neue 96 em 1080 de largura, 21 caracteres couberam
  e 29 dobraram. Orcamento do preset ajustado de 32 para 24.

### E5b — a prova que substitui o E5

O plano B do desenho virou o caminho principal: o botao gera `legendas.srt`
em PluginData (um bloco = um cue).

| # | Requisito | Resultado |
|---|---|---|
| E5b | Importar `legendas.srt` preserva 1 cue = 1 legenda, sem re-segmentar | **OK** (2026-08-11) — prints do monitor mostram os cues #7 e #24 na tela com o texto identico ao arquivo, fronteiras intactas. Precos "1.000 REAIS" e "197 REAIS" isolados |

Ressalva da mesma rodada: 21 caracteres couberam na linha, 23 e 24 dobraram
(quebra visual, nao de cue) — orcamento do preset ajustado 24 → 20. A
fronteira exata varia com a largura dos glifos da Bebas Neue.

### E7 — importacao automatica do .srt (pendente)

`Project.importFiles(caminhos, suppressUI)` existe na tipagem 26.3 e o botao
passou a chama-lo com `legendas.srt` e `precos.srt`. Falta a prova real:

| # | Requisito | Resultado |
|---|---|---|
| E7 | `importFiles` traz os .srt para o painel Projeto sem dialogo | **OK** (2026-08-12) — print do painel Projeto com legendas.srt e precos.srt importados |
| E7b | Reimportar o mesmo caminho substitui ou duplica o item? | |
| E7c | `createInsertProjectItemAction` com item .srt roteia para faixa de legenda? | **FALHOU** (2026-08-12) — a acao executa sem erro e nada aparece na timeline; falha silenciosa classica do UXP. Codigo do experimento removido |

Teto final da automacao, todo provado: importar para o painel Projeto e o
maximo que a API alcanca. Arrastar cada .srt para a faixa (2 arrastos) e
escolher o estilo por faixa (2 dropdowns) e o piso manual por video.
Aplicar ESTILO por codigo segue impossivel (D-02).

---

## "Criar legendas a partir da transcrição" não é scriptável

Verificado em 2026-08-11 lendo
`node_modules/@adobe/premierepro/src/premierepro.d.ts` (tipagem oficial
26.3) por inteiro, não só testado na hora — o mesmo padrão de prova das
linhas acima.

| # | Requisito | Resultado |
|---|---|---|
| P4.1 | Método para criar legendas a partir da transcrição | **NÃO EXISTE**. `TranscriptStatic` só tem `importFromJSON`, `createImportTextSegmentsAction`, `querySupportedLanguages`, `hasTranscript`, `exportToJSON` |
| P4.2 | Controle de formato/layout/estilo/duração mínima da legenda | **NÃO EXISTE**. `CaptionTrackStatic = {}`; `CaptionTrack` só tem `createSetNameAction`, `setMute`, `getMediaType`, `getIndex`, `isMuted`, `getTrackItems` |
| P4.3 | Escape hatch genérico (`executeCommand`, `invokeCommand` etc.) | **NÃO EXISTE** em toda a tipagem |

**Conclusão:** o comando `Texto > Legendas > Criar legendas a partir da
transcrição` e a telinha "Create captions" (Layout, Maximum length,
Minimum duration, Style) são exclusivos da GUI do Premiere. O plugin não
tem como automatizar esse passo nem passar o estilo obrigatório (§1.6 do
desenho) por código — é limite da plataforma, não decisão de escopo. Não
reabrir essa pergunta sem uma tipagem nova do Premiere que mude isso.

**Mitigação real, sem código:** criar o Caption Style (§1.6) e salvar como
Caption Style no Premiere; ajustar Layout=Single Line e Minimum duration
baixo na telinha e salvar a combinação como um Caption preset novo. Depois
disso, por vídeo, sobra so escolher esse preset e clicar em "Create
captions" — dois cliques, não reconfiguração manual.

---

## Como reproduzir

1. Uma vez, como administrador:
   `powershell -ExecutionPolicy Bypass -File scripts\install-link.ps1`
2. Reiniciar o Premiere. Nao ha hot reload — toda alteracao de codigo exige
   reinicio.
3. Abrir um projeto de teste com sequencia editada e transcricao na camera
   principal da V1.
4. `Janela > UXP Plugins > Pro Captions`.
5. Ao abrir, o painel ja roda a leitura sozinho. Para a escrita, clicar em
   **Prova da Fase 0**.
