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
| E1 | `Transcript.exportToJSON` no clipe da V1 | | |
| E2 | Backup gravado em PluginData | | |
| E3 | `createImportTextSegmentsAction` aceita nosso JSON | | |
| E4 | Os 5 blocos aparecem no painel Transcricao | | |
| E5 | **1 `segment` produz 1 legenda de 1 linha** | | |
| E6 | Um unico Ctrl+Z desfaz a escrita | | |

### Veredito

_(Sairam quantas legendas? Se nao foram cinco, como o Premiere quebrou os
blocos? Colar aqui o texto exato das legendas geradas.)_

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
